import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getAuthorizedClientContext } from "./authorization.ts";
import { updateAiActionLog } from "./logging.ts";
import type {
  AssistantActionEnvelope,
  AssistantSafetyEnvelope,
  AuthorizedClientContext,
  JsonRecord,
  RiskLevel,
} from "./types.ts";
import { INTERNAL_ROLES } from "./types.ts";
import { classifyOperationRisk, classifyReportRisk } from "./risk.ts";
import { asRecord, asTrimmedString } from "./utils.ts";

const internalRoleSet = new Set<string>(INTERNAL_ROLES);

function buildAction(type: AssistantActionEnvelope["type"], data: JsonRecord, actionId?: string | null): AssistantActionEnvelope {
  return { type, data, actionId: actionId ?? null };
}

function buildSafety(riskLevel: RiskLevel, requiresHumanReview: boolean, requiresConfirmation = false): AssistantSafetyEnvelope {
  return { riskLevel, requiresHumanReview, requiresConfirmation };
}

function normalizeSector(value: unknown) {
  const text = String(value || "").trim();
  return text || "Atendimento";
}

function mapReportRequestSector(tipoRelatorio: string) {
  const normalized = tipoRelatorio.toLowerCase();
  if (normalized.includes("folha") || normalized.includes("dp")) return "Departamento Pessoal";
  if (normalized.includes("fiscal") || normalized.includes("das") || normalized.includes("guia")) return "Fiscal";
  if (normalized.includes("finance")) return "Financeiro";
  if (normalized.includes("contab") || normalized.includes("balancete") || normalized.includes("dre")) return "Contabil";
  return "Atendimento";
}

async function createClientRequest(params: {
  supabaseAdmin: SupabaseClient;
  context: AuthorizedClientContext;
  title: string;
  description: string;
  category: string;
  sector: string;
}) {
  const portalUserId = params.context.client.portalUserId;
  if (!portalUserId) {
    throw new Error("Cliente sem usuario de portal vinculado para executar a acao confirmada.");
  }

  const { data, error } = await params.supabaseAdmin
    .from("client_requests")
    .insert({
      user_id: portalUserId,
      title: params.title,
      description: params.description,
      category: params.category,
      sector: params.sector,
      status: "pending",
    })
    .select("id, title, status, sector, created_at")
    .single();

  if (error) throw error;
  return data;
}

async function executeConfirmedAction(params: {
  supabaseAdmin: SupabaseClient;
  actionId: string;
  actionType: string;
  actionPayload: JsonRecord;
  actionStatus: string;
  riskLevel: RiskLevel;
  context: AuthorizedClientContext;
}) {
  switch (params.actionType) {
    case "criar_chamado": {
      const assunto = asTrimmedString(params.actionPayload.assunto) || "Solicitacao via assistente Grow";
      const descricao = asTrimmedString(params.actionPayload.descricao) || "Solicitacao confirmada pelo usuario.";
      const origem = asTrimmedString(params.actionPayload.origem) || "portal";
      const sector = normalizeSector(params.actionPayload.setor);

      const createdRequest = await createClientRequest({
        supabaseAdmin: params.supabaseAdmin,
        context: params.context,
        title: assunto,
        description: descricao,
        category: `assistant_${origem}`,
        sector,
      });

      return {
        reply: "Solicitacao confirmada e chamado criado com sucesso.",
        action: buildAction("created_ticket", {
          request_id: createdRequest.id,
          status: createdRequest.status,
          setor: createdRequest.sector,
        }, params.actionId),
        safety: buildSafety(params.riskLevel, false, false),
        dbResult: createdRequest as unknown as JsonRecord,
        nextStatus: "confirmed_executed",
      };
    }

    case "solicitar_envio_relatorio": {
      const tipoRelatorio = asTrimmedString(params.actionPayload.tipo_relatorio) || "Relatorio";
      const competencia = asTrimmedString(params.actionPayload.competencia);
      const relatorioRisk = classifyReportRisk(tipoRelatorio);

      if (relatorioRisk === "alto" || params.actionStatus === "pending_human_review") {
        return {
          reply: "Este pedido foi registrado, mas precisa de validacao humana antes de qualquer envio.",
          action: buildAction("human_review_required", {
            tipo_relatorio: tipoRelatorio,
            competencia,
          }, params.actionId),
          safety: buildSafety("alto", true, false),
          dbResult: {
            tipo_relatorio: tipoRelatorio,
            competencia,
          },
          nextStatus: "awaiting_human_review",
        };
      }

      const createdRequest = await createClientRequest({
        supabaseAdmin: params.supabaseAdmin,
        context: params.context,
        title: `Solicitacao de relatorio: ${tipoRelatorio}`,
        description: [
          `Pedido confirmado via assistente Grow.`,
          competencia ? `Competencia: ${competencia}.` : null,
          `Canal original: ${asTrimmedString(params.actionPayload.canal) || "portal"}.`,
        ].filter(Boolean).join(" "),
        category: "assistant_report_request",
        sector: mapReportRequestSector(tipoRelatorio),
      });

      return {
        reply: "Solicitacao confirmada. O pedido de relatorio foi registrado para processamento seguro.",
        action: buildAction("created_ticket", {
          request_id: createdRequest.id,
          status: createdRequest.status,
          setor: createdRequest.sector,
        }, params.actionId),
        safety: buildSafety(classifyOperationRisk("enviar_relatorio_resumido"), false, false),
        dbResult: createdRequest as unknown as JsonRecord,
        nextStatus: "confirmed_executed",
      };
    }

    default:
      throw new Error(`Action type not supported for confirmation: ${params.actionType}`);
  }
}

export async function confirmGrowAssistantAction(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  requesterRoles: string[];
  actionId: string;
  confirm: boolean;
  requesterDisplayName?: string | null;
  requesterEmail?: string | null;
}) {
  const { data: actionLog, error } = await params.supabaseAdmin
    .from("ai_action_logs")
    .select("id, cliente_id, user_id, action_type, action_payload, action_result, status, risk_level, requires_confirmation, requires_human_review")
    .eq("id", params.actionId)
    .maybeSingle();

  if (error) throw error;
  if (!actionLog) throw new Error("Acao da assistente nao encontrada.");

  const isInternalUser = params.requesterRoles.some((role) => internalRoleSet.has(role));
  if (!isInternalUser && actionLog.user_id !== params.userId) {
    throw new Error("Voce nao tem permissao para confirmar esta acao.");
  }

  if (!["pending_confirmation", "pending_human_review"].includes(String(actionLog.status || ""))) {
    throw new Error("Esta acao nao esta mais pendente de confirmacao.");
  }

  if (!params.confirm) {
    await updateAiActionLog(params.supabaseAdmin, params.actionId, {
      status: "confirmation_declined",
      confirmed_at: new Date().toISOString(),
      action_result: {
        declined_by: params.userId,
        declined_at: new Date().toISOString(),
      },
    });

    return {
      reply: "Acao cancelada. Nenhuma operacao adicional foi executada.",
      action: buildAction("none", { cancelled: true }, params.actionId),
      safety: buildSafety((actionLog.risk_level as RiskLevel) || "medio", false, false),
    };
  }

  const context = await getAuthorizedClientContext({
    supabaseAdmin: params.supabaseAdmin,
    userId: params.userId,
    requesterRoles: params.requesterRoles,
    clienteId: String(actionLog.cliente_id),
    requesterDisplayName: params.requesterDisplayName,
    requesterEmail: params.requesterEmail,
  });

  const execution = await executeConfirmedAction({
    supabaseAdmin: params.supabaseAdmin,
    actionId: params.actionId,
    actionType: String(actionLog.action_type || ""),
    actionPayload: asRecord(actionLog.action_payload) || {},
    actionStatus: String(actionLog.status || ""),
    riskLevel: (String(actionLog.risk_level || "medio") as RiskLevel),
    context,
  });

  await updateAiActionLog(params.supabaseAdmin, params.actionId, {
    status: execution.nextStatus,
    confirmed_at: new Date().toISOString(),
    executed_at: execution.nextStatus === "confirmed_executed" ? new Date().toISOString() : null,
    action_result: execution.dbResult,
  });

  return {
    reply: execution.reply,
    action: execution.action,
    safety: execution.safety,
  };
}
