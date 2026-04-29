import { normalizeText } from "./utils.ts";

export type IntentClassification = {
  intent: string;
  toolHints: string[];
  summary: string;
};

export function classifyOperationalIntent(message: string): IntentClassification {
  const normalized = normalizeText(message);

  if (normalized.includes("segunda via") || normalized.includes("das") || normalized.includes("guia")) {
    return {
      intent: "solicitar_guia_ou_segunda_via",
      toolHints: ["consultar_status_guias", "solicitar_envio_relatorio"],
      summary: "O pedido parece relacionado a guias, segunda via ou disponibilidade de tributo.",
    };
  }

  if (
    normalized.includes("relatorio") ||
    normalized.includes("balancete") ||
    normalized.includes("dre") ||
    normalized.includes("financeiro")
  ) {
    return {
      intent: "solicitar_relatorio",
      toolHints: ["gerar_resumo_cliente", "solicitar_envio_relatorio"],
      summary: "O pedido parece relacionado a relatorio, resumo financeiro ou demonstrativo.",
    };
  }

  if (normalized.includes("pendenc") || normalized.includes("documento pendente") || normalized.includes("faltando")) {
    return {
      intent: "consultar_pendencias",
      toolHints: ["consultar_pendencias_cliente"],
      summary: "O pedido parece relacionado a pendencias, documentos faltantes ou tarefas em aberto.",
    };
  }

  if (normalized.includes("chamado") || normalized.includes("protocolo") || normalized.includes("status")) {
    return {
      intent: "consultar_chamados",
      toolHints: ["consultar_status_chamados"],
      summary: "O pedido parece relacionado a status de chamados, protocolos ou acompanhamento.",
    };
  }

  if (
    normalized.includes("abrir chamado") ||
    normalized.includes("criar chamado") ||
    normalized.includes("preciso de ajuda") ||
    normalized.includes("solicitacao")
  ) {
    return {
      intent: "criar_chamado",
      toolHints: ["detectar_duplicidade", "criar_chamado"],
      summary: "O pedido parece uma abertura de solicitacao operacional.",
    };
  }

  return {
    intent: "triagem_geral",
    toolHints: ["consultar_pendencias_cliente", "consultar_status_chamados", "gerar_resumo_cliente"],
    summary: "Pedido geral para triagem operacional da assistente.",
  };
}
