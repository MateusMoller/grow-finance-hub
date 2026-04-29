import type {
  AssistantActionEnvelope,
  AssistantSafetyEnvelope,
  RiskLevel,
  ToolExecutionResult,
} from "./types.ts";
import { normalizeText } from "./utils.ts";

export type RiskManagedOperation =
  | "consultar_pendencias"
  | "consultar_chamados"
  | "listar_documentos"
  | "abrir_chamado"
  | "registrar_solicitacao"
  | "confirmar_recebimento"
  | "enviar_segunda_via_guia"
  | "enviar_relatorio_resumido"
  | "atualizar_dados_simples"
  | "solicitar_reemissao"
  | "gerar_link_documento"
  | "excluir_documentos"
  | "recalcular_guia"
  | "emitir_guia"
  | "alterar_dados_fiscais_sensiveis"
  | "enviar_obrigacao_acessoria"
  | "cancelar_documento_fiscal"
  | "alterar_cadastro_empresarial_critico"
  | "enviar_folha_pagamento"
  | "enviar_dados_pessoais_empregados";

const riskRank: Record<RiskLevel, number> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};

export function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  return riskRank[left] >= riskRank[right] ? left : right;
}

export function classifyOperationRisk(operation: RiskManagedOperation): RiskLevel {
  switch (operation) {
    case "consultar_pendencias":
    case "consultar_chamados":
    case "listar_documentos":
    case "abrir_chamado":
    case "registrar_solicitacao":
    case "confirmar_recebimento":
      return "baixo";
    case "enviar_segunda_via_guia":
    case "enviar_relatorio_resumido":
    case "atualizar_dados_simples":
    case "solicitar_reemissao":
    case "gerar_link_documento":
      return "medio";
    default:
      return "alto";
  }
}

export function requiresConfirmationForRisk(riskLevel: RiskLevel) {
  return riskLevel === "medio";
}

export function requiresHumanReviewForRisk(riskLevel: RiskLevel) {
  return riskLevel === "alto";
}

export function isSensitiveReportType(tipoRelatorio: string | null | undefined) {
  const normalized = normalizeText(tipoRelatorio);

  if (!normalized) return false;

  return [
    "folha",
    "pro labore",
    "prolabore",
    "cpf",
    "bancario",
    "bancarios",
    "dados pessoais",
    "contabil completo",
    "relatorio contabil completo",
    "fiscal estrategico",
  ].some((token) => normalized.includes(token));
}

export function classifyReportRisk(tipoRelatorio: string | null | undefined): RiskLevel {
  return isSensitiveReportType(tipoRelatorio)
    ? classifyOperationRisk("enviar_folha_pagamento")
    : classifyOperationRisk("enviar_relatorio_resumido");
}

export function buildSafetyEnvelope(toolExecutions: ToolExecutionResult[]): AssistantSafetyEnvelope {
  let riskLevel: RiskLevel = "baixo";
  let requiresHumanReview = false;
  let requiresConfirmation = false;

  for (const execution of toolExecutions) {
    riskLevel = maxRiskLevel(riskLevel, execution.riskLevel);
    requiresHumanReview = requiresHumanReview || execution.requiresHumanReview;
    requiresConfirmation = requiresConfirmation || execution.confirmationRequired;
  }

  return { riskLevel, requiresHumanReview, requiresConfirmation };
}

export function buildDefaultAction(): AssistantActionEnvelope {
  return {
    type: "none",
    data: {},
  };
}
