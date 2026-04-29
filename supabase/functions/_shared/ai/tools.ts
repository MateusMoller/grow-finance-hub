import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import type {
  AssistantActionEnvelope,
  AuthorizedClientContext,
  DuplicateDetectionResult,
  GuideType,
  JsonRecord,
  RequestSector,
  ToolExecutionResult,
} from "./types.ts";
import { GUIDE_TYPES, REQUEST_SECTORS } from "./types.ts";
import { logAiAction, logAiDuplicateCheck } from "./logging.ts";
import {
  classifyOperationRisk,
  classifyReportRisk,
  isSensitiveReportType,
  requiresConfirmationForRisk,
  requiresHumanReviewForRisk,
} from "./risk.ts";
import { createOpenAIResponse, extractResponseText } from "./openaiClient.ts";
import {
  asRecord,
  asTrimmedString,
  calculateTokenOverlap,
  competenciaMatches,
  extractFirstJsonObject,
  isOpenStatus,
  normalizeCompetencia,
  normalizeText,
  parseJsonString,
  tokenizeText,
} from "./utils.ts";

function normalizeSector(value: unknown): RequestSector | null {
  const text = normalizeText(asTrimmedString(value));
  if (!text) return null;

  if (text.includes("fiscal")) return "Fiscal";
  if (text.includes("departamento") || text.includes("pessoal") || text === "dp") return "Departamento Pessoal";
  if (text.includes("contabil")) return "Contabil";
  if (text.includes("finance")) return "Financeiro";
  if (text.includes("atend")) return "Atendimento";

  return null;
}

function normalizeGuideType(value: unknown): GuideType | null {
  const text = String(value || "").trim().toUpperCase();
  return GUIDE_TYPES.includes(text as GuideType) ? (text as GuideType) : null;
}

function normalizePriority(value: unknown) {
  const text = normalizeText(asTrimmedString(value));
  if (text.includes("alta") || text.includes("high")) return "alta";
  if (text.includes("baixa") || text.includes("low")) return "baixa";
  return "media";
}

function getGuideKeywords(tipoGuia: GuideType | null) {
  switch (tipoGuia) {
    case "DAS":
      return ["das", "simples nacional"];
    case "INSS":
      return ["inss", "gps", "previd"];
    case "FGTS":
      return ["fgts"];
    case "IRRF":
      return ["irrf", "imposto de renda"];
    case "PIS":
      return ["pis"];
    case "COFINS":
      return ["cofins"];
    case "ISS":
      return ["iss"];
    case "ICMS":
      return ["icms"];
    default:
      return [];
  }
}

async function persistActionLog(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  requesterUserId: string;
  actionType: string;
  riskLevel: ToolExecutionResult["riskLevel"];
  payload: JsonRecord;
  result: JsonRecord;
  status: string;
  requiresConfirmation?: boolean;
  requiresHumanReview?: boolean;
}) {
  return await logAiAction(params.supabaseAdmin, {
    cliente_id: params.context.client.id,
    user_id: params.requesterUserId,
    action_type: params.actionType,
    action_payload: params.payload,
    action_result: params.result,
    risk_level: params.riskLevel,
    requires_confirmation: params.requiresConfirmation ?? false,
    requires_human_review: params.requiresHumanReview ?? false,
    channel: "assistant",
    status: params.status,
  });
}

function buildActionEnvelope(
  type: AssistantActionEnvelope["type"],
  data: JsonRecord,
  actionId?: string | null,
): AssistantActionEnvelope {
  return {
    type,
    data,
    actionId: actionId ?? null,
  };
}

async function detectSemanticDuplicate(params: {
  assunto: string;
  descricao: string;
  setor: string | null | undefined;
  tipoRegistro: string;
  recentRequests: Array<{
    id: string;
    title: string;
    description: string | null;
    sector: string | null;
    status: string | null;
    created_at?: string | null;
  }>;
}): Promise<DuplicateDetectionResult | null> {
  if (params.recentRequests.length === 0) return null;

  const prompt = [
    "Voce avalia duplicidade operacional para a Grow Contabilidade.",
    "Considere que todos os registros abaixo ja pertencem ao mesmo cliente autorizado.",
    "Responda somente com JSON puro, sem markdown.",
    "Campos obrigatorios: duplicidade_detectada, nivel_confianca, tipo_duplicidade, registro_relacionado_id, motivo, acao_recomendada, exige_validacao_humana.",
    "nivel_confianca deve ser baixo, medio ou alto.",
    "tipo_duplicidade deve ser chamado, documento, guia, cadastro, mensagem ou outro.",
    "acao_recomendada deve ser criar_novo, atualizar_existente, pedir_confirmacao ou validacao_humana.",
    `Tipo do novo registro: ${params.tipoRegistro}`,
    `Setor informado: ${params.setor || "nao informado"}`,
    `Assunto novo: ${params.assunto}`,
    `Descricao nova: ${params.descricao || "sem descricao"}`,
    `Registros recentes: ${JSON.stringify(params.recentRequests)}`,
  ].join("\n");

  try {
    const response = await createOpenAIResponse({
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      store: false,
      max_output_tokens: 400,
    });

    const parsed = parseJsonString<DuplicateDetectionResult | null>(
      extractFirstJsonObject(extractResponseText(response)) || "",
      null,
    );

    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.duplicidade_detectada !== "boolean") return null;
    if (!["baixo", "medio", "alto"].includes(parsed.nivel_confianca)) return null;
    if (!["criar_novo", "atualizar_existente", "pedir_confirmacao", "validacao_humana"].includes(parsed.acao_recomendada)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("[grow-assistant] semantic duplicate fallback:", error);
    return null;
  }
}

async function detectDuplicateInternal(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  tipoRegistro: string;
  assunto: string;
  descricao: string;
  competencia?: string | null;
  setor?: string | null;
  metadados?: JsonRecord | null;
}): Promise<DuplicateDetectionResult> {
  const portalUserId = params.context.client.portalUserId;
  const normalizedCompetencia = normalizeCompetencia(params.competencia);
  const inputTokens = tokenizeText(`${params.assunto} ${params.descricao}`);
  const normalizedSector = normalizeSector(params.setor);

  if (!portalUserId) {
    return {
      duplicidade_detectada: false,
      nivel_confianca: "baixo",
      tipo_duplicidade: "outro",
      registro_relacionado_id: null,
      motivo: "Cliente sem usuario de portal vinculado; nenhuma base de chamados comparavel foi localizada.",
      acao_recomendada: "validacao_humana",
      exige_validacao_humana: true,
    };
  }

  const { data: recentRequests, error } = await params.supabaseAdmin
    .from("client_requests")
    .select("id, title, description, sector, status, created_at")
    .eq("user_id", portalUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  let bestMatch: {
    id: string;
    confidence: DuplicateDetectionResult["nivel_confianca"];
    reason: string;
    recommendedAction: DuplicateDetectionResult["acao_recomendada"];
    requiresHumanReview: boolean;
  } | null = null;

  for (const request of recentRequests || []) {
    if (!isOpenStatus(request.status)) continue;

    const requestTokens = tokenizeText(`${request.title} ${request.description || ""}`);
    const similarity = calculateTokenOverlap(inputTokens, requestTokens);
    const sameTitle = normalizeText(request.title) === normalizeText(params.assunto);
    const sameSector = normalizedSector ? normalizeSector(request.sector) === normalizedSector : true;
    const sameCompetencia = normalizedCompetencia
      ? competenciaMatches(request.description, normalizedCompetencia) || competenciaMatches(request.title, normalizedCompetencia)
      : false;

    if (sameTitle && sameSector) {
      bestMatch = {
        id: request.id,
        confidence: "alto",
        reason: "Assunto igual e mesmo setor em chamado aberto recente.",
        recommendedAction: "atualizar_existente",
        requiresHumanReview: false,
      };
      break;
    }

    if ((similarity >= 0.78 && sameSector) || (similarity >= 0.65 && sameSector && sameCompetencia)) {
      bestMatch = {
        id: request.id,
        confidence: "alto",
        reason: `Descricao muito semelhante a um chamado aberto recente (similaridade ${similarity.toFixed(2)}).`,
        recommendedAction: "atualizar_existente",
        requiresHumanReview: false,
      };
      break;
    }

    if (!bestMatch && similarity >= 0.48 && sameSector) {
      bestMatch = {
        id: request.id,
        confidence: "medio",
        reason: `Solicitacao parecida com um chamado aberto recente (similaridade ${similarity.toFixed(2)}).`,
        recommendedAction: "pedir_confirmacao",
        requiresHumanReview: false,
      };
    }
  }

  if (!bestMatch || bestMatch.confidence === "medio") {
    const semanticDuplicate = await detectSemanticDuplicate({
      assunto: params.assunto,
      descricao: params.descricao,
      setor: params.setor,
      tipoRegistro: params.tipoRegistro,
      recentRequests: (recentRequests || [])
        .filter((request) => isOpenStatus(request.status))
        .slice(0, 8)
        .map((request) => ({
          id: request.id,
          title: request.title,
          description: request.description,
          sector: request.sector,
          status: request.status,
          created_at: request.created_at,
        })),
    });

    if (semanticDuplicate?.duplicidade_detectada && semanticDuplicate.registro_relacionado_id) {
      return semanticDuplicate;
    }
  }

  if (!bestMatch) {
    return {
      duplicidade_detectada: false,
      nivel_confianca: "baixo",
      tipo_duplicidade: params.tipoRegistro === "documento" ? "documento" : "chamado",
      registro_relacionado_id: null,
      motivo: "Nenhuma duplicidade relevante foi localizada na verificacao objetiva inicial.",
      acao_recomendada: "criar_novo",
      exige_validacao_humana: false,
    };
  }

  return {
    duplicidade_detectada: true,
    nivel_confianca: bestMatch.confidence,
    tipo_duplicidade: params.tipoRegistro === "documento" ? "documento" : "chamado",
    registro_relacionado_id: bestMatch.id,
    motivo: bestMatch.reason,
    acao_recomendada: bestMatch.recommendedAction,
    exige_validacao_humana: bestMatch.requiresHumanReview,
  };
}

async function consultarPendenciasCliente(params: {
  context: AuthorizedClientContext;
  competencia?: string | null;
}): Promise<ToolExecutionResult> {
  const riskLevel = classifyOperationRisk("consultar_pendencias");
  const pendencias = params.context.pendingTasks.filter((task) =>
    !params.competencia || competenciaMatches(task.dueDate, params.competencia),
  );

  return {
    toolName: "consultar_pendencias_cliente",
    riskLevel,
    requiresHumanReview: false,
    confirmationRequired: false,
    action: buildActionEnvelope("none", {}),
    data: {
      cliente_id: params.context.client.id,
      competencia: normalizeCompetencia(params.competencia),
      total: pendencias.length,
      pendencias: pendencias.map((item) => ({
        id: item.id,
        titulo: item.title,
        status: item.status,
        setor_responsavel: item.sector,
        vencimento: item.dueDate,
        tipo: item.type,
      })),
    },
    detectedIntent: "consultar_pendencias",
  };
}

async function consultarStatusChamados(params: {
  context: AuthorizedClientContext;
  assunto?: string | null;
  setor?: string | null;
}): Promise<ToolExecutionResult> {
  const riskLevel = classifyOperationRisk("consultar_chamados");
  const assuntoToken = normalizeText(params.assunto);
  const normalizedSector = normalizeSector(params.setor);

  const chamados = params.context.recentRequests.filter((request) => {
    if (normalizedSector && normalizeSector(request.sector) !== normalizedSector) return false;
    if (!assuntoToken) return true;
    return normalizeText(`${request.title} ${request.description || ""}`).includes(assuntoToken);
  });

  return {
    toolName: "consultar_status_chamados",
    riskLevel,
    requiresHumanReview: false,
    confirmationRequired: false,
    action: buildActionEnvelope("none", {}),
    data: {
      cliente_id: params.context.client.id,
      total: chamados.length,
      chamados: chamados.map((item) => ({
        id: item.id,
        assunto: item.title,
        setor: item.sector,
        status: item.status,
        criado_em: item.createdAt,
        atualizado_em: item.updatedAt,
      })),
    },
    detectedIntent: "consultar_chamados",
  };
}

async function detectarDuplicidade(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  requesterUserId: string;
  input: JsonRecord;
}): Promise<ToolExecutionResult> {
  const assunto = asTrimmedString(params.input.assunto) || asTrimmedString(params.input.subject) || "";
  const descricao = asTrimmedString(params.input.descricao) || asTrimmedString(params.input.description) || "";
  const tipoRegistro = asTrimmedString(params.input.tipo_registro) || "chamado";
  const competencia = asTrimmedString(params.input.competencia);
  const setor = asTrimmedString(params.input.setor);
  const metadados = asRecord(params.input.metadados);

  const duplicate = await detectDuplicateInternal({
    supabaseAdmin: params.supabaseAdmin,
    context: params.context,
    tipoRegistro,
    assunto,
    descricao,
    competencia,
    setor,
    metadados,
  });

  await logAiDuplicateCheck(params.supabaseAdmin, {
    cliente_id: params.context.client.id,
    source_type: tipoRegistro,
    source_id: null,
    matched_type: duplicate.tipo_duplicidade,
    matched_id: duplicate.registro_relacionado_id,
    confidence_level: duplicate.nivel_confianca,
    reason: duplicate.motivo,
    recommended_action: duplicate.acao_recomendada,
  });

  return {
    toolName: "detectar_duplicidade",
    riskLevel: duplicate.exige_validacao_humana ? "alto" : duplicate.nivel_confianca === "medio" ? "medio" : "baixo",
    requiresHumanReview: duplicate.exige_validacao_humana,
    confirmationRequired: duplicate.acao_recomendada === "pedir_confirmacao",
    action: buildActionEnvelope(
      duplicate.acao_recomendada === "pedir_confirmacao"
        ? "confirmation_required"
        : duplicate.duplicidade_detectada
        ? "duplicate_found"
        : "none",
      duplicate as unknown as JsonRecord,
    ),
    data: duplicate as unknown as JsonRecord,
    detectedIntent: "detectar_duplicidade",
  };
}

async function criarChamado(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  requesterUserId: string;
  input: JsonRecord;
}): Promise<ToolExecutionResult> {
  const baseRiskLevel = classifyOperationRisk("abrir_chamado");

  if (!params.context.permissions.canCreateTickets) {
    const actionLog = await persistActionLog({
      supabaseAdmin: params.supabaseAdmin,
      context: params.context,
      requesterUserId: params.requesterUserId,
      actionType: "criar_chamado",
      riskLevel: "alto",
      payload: params.input,
      result: { motivo: "Sem permissao para criar chamado." },
      status: "blocked_no_permission",
      requiresHumanReview: true,
    });

    return {
      toolName: "criar_chamado",
      riskLevel: "alto",
      requiresHumanReview: true,
      confirmationRequired: false,
      action: buildActionEnvelope("human_review_required", { motivo: "Requester has no permission to create tickets." }, actionLog.id),
      data: { ok: false, motivo: "Sem permissao para criar chamado." },
      detectedIntent: "criar_chamado",
    };
  }

  const portalUserId = params.context.client.portalUserId;
  if (!portalUserId) {
    const actionLog = await persistActionLog({
      supabaseAdmin: params.supabaseAdmin,
      context: params.context,
      requesterUserId: params.requesterUserId,
      actionType: "criar_chamado",
      riskLevel: "alto",
      payload: params.input,
      result: { motivo: "Cliente sem usuario de portal vinculado." },
      status: "blocked_missing_portal_user",
      requiresHumanReview: true,
    });

    return {
      toolName: "criar_chamado",
      riskLevel: "alto",
      requiresHumanReview: true,
      confirmationRequired: false,
      action: buildActionEnvelope("human_review_required", { motivo: "Cliente sem usuario de portal vinculado." }, actionLog.id),
      data: { ok: false, motivo: "Cliente sem usuario de portal vinculado." },
      detectedIntent: "criar_chamado",
    };
  }

  const setor = normalizeSector(params.input.setor) || "Atendimento";
  const assunto = asTrimmedString(params.input.assunto) || "Solicitacao via assistente Grow";
  const descricao = asTrimmedString(params.input.descricao) || "";
  const prioridade = normalizePriority(params.input.prioridade);
  const origem = asTrimmedString(params.input.origem) || "portal";
  const competencia = asTrimmedString(params.input.competencia);

  const duplicateToolResult = await detectarDuplicidade({
    supabaseAdmin: params.supabaseAdmin,
    context: params.context,
    requesterUserId: params.requesterUserId,
    input: {
      tipo_registro: "chamado",
      assunto,
      descricao,
      competencia,
      setor,
      metadados: {
        prioridade,
        origem,
      },
    },
  });

  const duplicate = duplicateToolResult.data as unknown as DuplicateDetectionResult;

  if (duplicate.duplicidade_detectada && duplicate.nivel_confianca === "alto" && duplicate.registro_relacionado_id) {
    await params.supabaseAdmin.from("request_messages").insert({
      request_id: duplicate.registro_relacionado_id,
      user_id: params.requesterUserId,
      content: `Nova solicitacao semelhante detectada pela assistente Grow. Assunto: ${assunto}. Descricao: ${descricao || "sem descricao adicional"}`,
      is_from_team: params.context.requester.isInternalUser,
    });

    const actionLog = await persistActionLog({
      supabaseAdmin: params.supabaseAdmin,
      context: params.context,
      requesterUserId: params.requesterUserId,
      actionType: "criar_chamado",
      riskLevel: baseRiskLevel,
      payload: {
        setor,
        assunto,
        descricao,
        prioridade,
        origem,
      },
      result: duplicate as unknown as JsonRecord,
      status: "duplicate_updated_existing",
    });

    return {
      toolName: "criar_chamado",
      riskLevel: baseRiskLevel,
      requiresHumanReview: false,
      confirmationRequired: false,
      action: buildActionEnvelope("duplicate_found", duplicate as unknown as JsonRecord, actionLog.id),
      data: {
        ok: true,
        created: false,
        registro_existente_id: duplicate.registro_relacionado_id,
        motivo: duplicate.motivo,
      },
      detectedIntent: "criar_chamado",
    };
  }

  if (duplicate.duplicidade_detectada && duplicate.nivel_confianca === "medio") {
    const pendingPayload = {
      setor,
      assunto,
      descricao,
      prioridade,
      origem,
      competencia,
      duplicate,
    };
    const actionLog = await persistActionLog({
      supabaseAdmin: params.supabaseAdmin,
      context: params.context,
      requesterUserId: params.requesterUserId,
      actionType: "criar_chamado",
      riskLevel: "medio",
      payload: pendingPayload,
      result: { motivo: "Confirmacao explicita necessaria antes de criar novo chamado." },
      status: "pending_confirmation",
      requiresConfirmation: true,
    });

    return {
      toolName: "criar_chamado",
      riskLevel: "medio",
      requiresHumanReview: false,
      confirmationRequired: true,
      action: buildActionEnvelope("confirmation_required", {
        duplicate,
        proposta: {
          setor,
          assunto,
          descricao,
          prioridade,
          origem,
        },
      }, actionLog.id),
      data: {
        ok: false,
        motivo: "Possivel duplicidade encontrada. Confirmacao explicita necessaria.",
        duplicate,
      },
      detectedIntent: "criar_chamado",
    };
  }

  const { data: createdRequest, error } = await params.supabaseAdmin
    .from("client_requests")
    .insert({
      user_id: portalUserId,
      title: assunto,
      description: descricao,
      category: `assistant_${origem}`,
      sector: setor,
      status: "pending",
    })
    .select("id, title, status, sector, created_at")
    .single();

  if (error) throw error;

  const actionLog = await persistActionLog({
    supabaseAdmin: params.supabaseAdmin,
    context: params.context,
    requesterUserId: params.requesterUserId,
    actionType: "criar_chamado",
    riskLevel: baseRiskLevel,
    payload: {
      setor,
      assunto,
      descricao,
      prioridade,
      origem,
    },
    result: createdRequest as unknown as JsonRecord,
    status: "created",
  });

  return {
    toolName: "criar_chamado",
    riskLevel: baseRiskLevel,
    requiresHumanReview: false,
    confirmationRequired: false,
    action: buildActionEnvelope("created_ticket", {
      request_id: createdRequest.id,
      status: createdRequest.status,
      setor: createdRequest.sector,
    }, actionLog.id),
    data: {
      ok: true,
      request_id: createdRequest.id,
      assunto: createdRequest.title,
      status: createdRequest.status,
      setor: createdRequest.sector,
      criado_em: createdRequest.created_at,
    },
    detectedIntent: "criar_chamado",
  };
}

async function consultarStatusGuias(params: {
  context: AuthorizedClientContext;
  competencia?: string | null;
  tipoGuia?: GuideType | null;
}): Promise<ToolExecutionResult> {
  const riskLevel = classifyOperationRisk("consultar_pendencias");
  const keywords = getGuideKeywords(params.tipoGuia || null);

  const guias = params.context.guideStatuses.filter((item) => {
    if (!competenciaMatches(item.obligationPeriod || item.dueDate, params.competencia)) return false;
    if (keywords.length === 0) return true;
    const normalizedName = normalizeText(item.obligationName);
    return keywords.some((keyword) => normalizedName.includes(normalizeText(keyword)));
  });

  return {
    toolName: "consultar_status_guias",
    riskLevel,
    requiresHumanReview: false,
    confirmationRequired: false,
    action: buildActionEnvelope("none", {}),
    data: {
      cliente_id: params.context.client.id,
      competencia: normalizeCompetencia(params.competencia),
      tipo_guia: params.tipoGuia,
      total: guias.length,
      guias: guias.map((item) => ({
        id: item.id,
        nome: item.obligationName,
        competencia: item.obligationPeriod,
        status: item.status,
        vencimento: item.dueDate,
        protocolo: item.protocol,
        observacoes: item.notes,
        disponibilidade: true,
      })),
    },
    detectedIntent: "consultar_guias",
  };
}

async function gerarResumoCliente(params: {
  context: AuthorizedClientContext;
  periodo?: string | null;
  tipoResumo?: string | null;
}): Promise<ToolExecutionResult> {
  const riskLevel = classifyOperationRisk("registrar_solicitacao");
  const tipoResumo = normalizeText(params.tipoResumo) || "geral";
  const competencia = normalizeCompetencia(params.periodo);

  const pendencias = params.context.pendingTasks.filter((task) =>
    !competencia || competenciaMatches(task.dueDate, competencia),
  );
  const chamados = params.context.recentRequests.filter((request) =>
    !competencia || competenciaMatches(request.createdAt, competencia) || competenciaMatches(request.description, competencia),
  );
  const documentos = params.context.recentDocuments.filter((document) =>
    !competencia || competenciaMatches(document.createdAt, competencia),
  );
  const guias = params.context.guideStatuses.filter((guide) =>
    !competencia || competenciaMatches(guide.obligationPeriod || guide.dueDate, competencia),
  );

  const lines = [
    `Cliente: ${params.context.client.name}`,
    `Pendencias abertas: ${pendencias.length}`,
    `Chamados recentes: ${chamados.length}`,
    `Documentos recentes: ${documentos.length}`,
    `Guias/localizacoes relacionadas: ${guias.length}`,
  ];

  const pontosDeAtencao = [
    ...pendencias.slice(0, 3).map((item) => `Pendencia: ${item.title} (${item.status})`),
    ...guias
      .filter((item) => isOpenStatus(item.status || ""))
      .slice(0, 2)
      .map((item) => `Guia/obrigacao em aberto: ${item.obligationName}`),
  ];

  return {
    toolName: "gerar_resumo_cliente",
    riskLevel,
    requiresHumanReview: false,
    confirmationRequired: false,
    action: buildActionEnvelope("none", {}),
    data: {
      cliente_id: params.context.client.id,
      periodo: competencia,
      tipo_resumo: tipoResumo,
      resumo: lines.join(" | "),
      pontos_de_atencao: pontosDeAtencao,
      dados_nao_encontrados: [],
    },
    detectedIntent: "gerar_resumo",
  };
}

async function solicitarEnvioRelatorio(params: {
  supabaseAdmin?: SupabaseClient;
  requesterUserId?: string;
  context: AuthorizedClientContext;
  tipoRelatorio?: string | null;
  competencia?: string | null;
  canal?: string | null;
}): Promise<ToolExecutionResult> {
  const tipoRelatorio = asTrimmedString(params.tipoRelatorio) || "relatorio";
  const channel = asTrimmedString(params.canal) || "portal";
  const baseRiskLevel = classifyReportRisk(tipoRelatorio);
  const escalatedForUnverifiedWhatsapp =
    channel === "whatsapp" && !params.context.requester.isIdentityVerified;
  const riskLevel = escalatedForUnverifiedWhatsapp ? "alto" : baseRiskLevel;
  const requiresHumanReview = requiresHumanReviewForRisk(riskLevel);
  const confirmationRequired = requiresConfirmationForRisk(riskLevel);
  const exigeLinkSeguro = requiresHumanReview || !params.context.permissions.canReceiveSensitiveReportsDirectly;
  const actionPayload = {
    tipo_relatorio: tipoRelatorio,
    competencia: normalizeCompetencia(params.competencia),
    canal: channel,
  };
  let actionId: string | null = null;

  if (params.supabaseAdmin && params.requesterUserId && (requiresHumanReview || confirmationRequired)) {
    const actionLog = await persistActionLog({
      supabaseAdmin: params.supabaseAdmin,
      context: params.context,
      requesterUserId: params.requesterUserId,
      actionType: "solicitar_envio_relatorio",
      riskLevel,
      payload: actionPayload,
      result: {
        exige_link_seguro: exigeLinkSeguro,
      },
      status: requiresHumanReview ? "pending_human_review" : "pending_confirmation",
      requiresConfirmation: confirmationRequired,
      requiresHumanReview,
    });
    actionId = actionLog.id;
  }

  return {
    toolName: "solicitar_envio_relatorio",
    riskLevel,
    requiresHumanReview,
    confirmationRequired,
    action: buildActionEnvelope(
      requiresHumanReview ? "human_review_required" : confirmationRequired ? "confirmation_required" : "none",
      actionPayload,
      actionId,
    ),
    data: {
      pode_enviar: !requiresHumanReview,
      exige_confirmacao: confirmationRequired,
      exige_link_seguro: exigeLinkSeguro,
      motivo: escalatedForUnverifiedWhatsapp
        ? "Pedido recebido por WhatsApp sem identidade validada em sessao. O envio deve seguir por link seguro no portal ou validacao humana."
        : isSensitiveReportType(tipoRelatorio)
        ? "Relatorio sensivel. Preferir link seguro no portal ou aprovacao humana."
        : "Relatorio resumido pode seguir com confirmacao explicita.",
      mensagem_sugerida: exigeLinkSeguro
        ? "Para este relatorio, o envio deve ocorrer por link seguro no portal ou apos validacao da equipe."
        : "Posso preparar a solicitacao e seguir apos a sua confirmacao explicita.",
    },
    detectedIntent: "solicitar_relatorio",
  };
}

export function getGrowAssistantToolDefinitions() {
  return [
    {
      type: "function" as const,
      name: "consultar_pendencias_cliente",
      description: "Consulta pendencias abertas do cliente autorizado por competencia.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          competencia: { type: "string" },
        },
        required: ["cliente_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "consultar_status_chamados",
      description: "Consulta chamados abertos ou recentes do cliente autorizado.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          assunto: { type: "string" },
          setor: { type: "string" },
        },
        required: ["cliente_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "criar_chamado",
      description: "Cria um chamado para o cliente autorizado, com verificacao de duplicidade antes da abertura.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          setor: { type: "string", enum: [...REQUEST_SECTORS] },
          assunto: { type: "string" },
          descricao: { type: "string" },
          prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
          origem: { type: "string", enum: ["portal", "whatsapp", "interno"] },
          competencia: { type: "string" },
        },
        required: ["cliente_id", "setor", "assunto", "descricao", "prioridade", "origem"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "detectar_duplicidade",
      description: "Avalia possivel duplicidade antes de criar chamado, registrar documento ou gerar nova solicitacao.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          tipo_registro: { type: "string" },
          assunto: { type: "string" },
          descricao: { type: "string" },
          competencia: { type: "string" },
          setor: { type: "string" },
          metadados: { type: "object", additionalProperties: true },
        },
        required: ["cliente_id", "tipo_registro", "assunto", "descricao"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "consultar_status_guias",
      description: "Consulta status de guias disponiveis do cliente autorizado por competencia e tipo.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          competencia: { type: "string" },
          tipo_guia: { type: "string", enum: [...GUIDE_TYPES] },
        },
        required: ["cliente_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "gerar_resumo_cliente",
      description: "Gera um resumo operacional do cliente com base nos dados autorizados.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          periodo: { type: "string" },
          tipo_resumo: { type: "string", enum: ["pendencias", "financeiro", "fiscal", "contabil", "dp", "geral"] },
        },
        required: ["cliente_id"],
        additionalProperties: false,
      },
    },
    {
      type: "function" as const,
      name: "solicitar_envio_relatorio",
      description: "Prepara uma solicitacao de envio de relatorio ou de link seguro para o cliente autorizado.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string" },
          tipo_relatorio: { type: "string" },
          competencia: { type: "string" },
          canal: { type: "string", enum: ["portal", "whatsapp", "interno"] },
        },
        required: ["cliente_id", "tipo_relatorio", "canal"],
        additionalProperties: false,
      },
    },
  ];
}

export async function executeGrowAssistantTool(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  requesterUserId: string;
  toolName: string;
  rawArguments: string;
}): Promise<ToolExecutionResult> {
  const parsedArguments = parseJsonString<JsonRecord>(params.rawArguments, {});
  const requestedClientId = asTrimmedString(parsedArguments.cliente_id);

  if (!requestedClientId || requestedClientId !== params.context.client.id) {
    return {
      toolName: params.toolName,
      riskLevel: "alto",
      requiresHumanReview: true,
      confirmationRequired: false,
      action: {
        type: "human_review_required",
        data: { motivo: "Tentativa de uso de cliente_id fora do contexto autorizado." },
      },
      data: {
        ok: false,
        motivo: "cliente_id fora do contexto autorizado.",
      },
    };
  }

  switch (params.toolName) {
    case "consultar_pendencias_cliente":
      return await consultarPendenciasCliente({
        context: params.context,
        competencia: asTrimmedString(parsedArguments.competencia),
      });

    case "consultar_status_chamados":
      return await consultarStatusChamados({
        context: params.context,
        assunto: asTrimmedString(parsedArguments.assunto),
        setor: asTrimmedString(parsedArguments.setor),
      });

    case "detectar_duplicidade":
      return await detectarDuplicidade({
        supabaseAdmin: params.supabaseAdmin,
        context: params.context,
        requesterUserId: params.requesterUserId,
        input: parsedArguments,
      });

    case "criar_chamado":
      return await criarChamado({
        supabaseAdmin: params.supabaseAdmin,
        context: params.context,
        requesterUserId: params.requesterUserId,
        input: parsedArguments,
      });

    case "consultar_status_guias":
      return await consultarStatusGuias({
        context: params.context,
        competencia: asTrimmedString(parsedArguments.competencia),
        tipoGuia: normalizeGuideType(parsedArguments.tipo_guia),
      });

    case "gerar_resumo_cliente":
      return await gerarResumoCliente({
        context: params.context,
        periodo: asTrimmedString(parsedArguments.periodo),
        tipoResumo: asTrimmedString(parsedArguments.tipo_resumo),
      });

    case "solicitar_envio_relatorio":
      return await solicitarEnvioRelatorio({
        supabaseAdmin: params.supabaseAdmin,
        requesterUserId: params.requesterUserId,
        context: params.context,
        tipoRelatorio: asTrimmedString(parsedArguments.tipo_relatorio),
        competencia: asTrimmedString(parsedArguments.competencia),
        canal: asTrimmedString(parsedArguments.canal),
      });

    default:
      return {
        toolName: params.toolName,
        riskLevel: "alto",
        requiresHumanReview: true,
        confirmationRequired: false,
        action: {
          type: "human_review_required",
          data: { motivo: "Ferramenta nao autorizada." },
        },
        data: {
          ok: false,
          motivo: "Ferramenta nao autorizada.",
        },
      };
  }
}
