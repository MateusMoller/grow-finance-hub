export type MitDebtInput = {
  revenueCode: string;
  description: string;
  debitAmount: number;
  dueDate: string | null;
  establishmentCnpj: string | null;
};

export type MitDeclarationInput = {
  cnpj: string;
  competence: string;
  debts: MitDebtInput[];
  protocolNumber?: string | null;
};

type MitProviderResult = {
  status: "processing" | "transmitted" | "rejected" | "unknown";
  protocolNumber: string | null;
  receiptNumber: string | null;
  raw: Record<string, unknown>;
};

const digits = (value: string) => value.replace(/\D/g, "");

function configuredContract(action: "submit" | "status") {
  const baseUrl = Deno.env.get("MIT_SERPRO_BASE_URL")?.trim().replace(/\/$/, "");
  const bearer = Deno.env.get("MIT_SERPRO_BEARER")?.trim();
  const serviceId = Deno.env.get(action === "submit" ? "MIT_SERPRO_SUBMIT_SERVICE_ID" : "MIT_SERPRO_STATUS_SERVICE_ID")?.trim();
  if (!baseUrl || !bearer || !serviceId) throw new Error("MIT_SERPRO_CONTRACT_NOT_CONFIGURED");
  return { baseUrl, bearer, serviceId };
}

function envelope(input: MitDeclarationInput, serviceId: string, data: Record<string, unknown>) {
  const taxId = digits(input.cnpj);
  if (taxId.length !== 14 || !/^\d{6}$/.test(input.competence)) throw new Error("MIT_INVALID_CONTEXT");
  const party = { numero: taxId, tipo: 2 };
  return {
    contratante: party,
    autorPedidoDados: party,
    contribuinte: party,
    pedidoDados: { idSistema: "MIT", idServico: serviceId, versaoSistema: "1.0", dados: JSON.stringify(data) },
  };
}

async function callMit(action: "submit" | "status", input: MitDeclarationInput, requestTag: string) {
  const contract = configuredContract(action);
  const period = { anoPA: input.competence.slice(0, 4), mesPA: input.competence.slice(4, 6) };
  const data = action === "submit"
    ? {
        ...period,
        debitos: input.debts.map((debt) => ({
          codigoReceita: debt.revenueCode,
          descricao: debt.description,
          valorDebito: debt.debitAmount,
          dataVencimento: debt.dueDate,
          cnpjEstabelecimento: debt.establishmentCnpj ? digits(debt.establishmentCnpj) : null,
        })),
      }
    : { ...period, protocolo: input.protocolNumber };
  const route = action === "submit" ? "Declarar" : "Consultar";
  const providerResponse = await fetch(`${contract.baseUrl}/${route}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain",
      Authorization: `Bearer ${contract.bearer}`,
      "Content-Type": "application/json",
      "X-Request-Tag": requestTag.slice(0, 32),
    },
    body: JSON.stringify(envelope(input, contract.serviceId, data)),
  });
  if (!providerResponse.ok) throw new Error(`SERPRO_HTTP_${providerResponse.status}`);
  const outer = await providerResponse.json() as Record<string, unknown>;
  if (Number(outer.status) !== 200 || typeof outer.dados !== "string") {
    throw new Error(String((outer.mensagens as Array<Record<string, unknown>> | undefined)?.[0]?.codigo || "MIT_PROVIDER_RESPONSE_INVALID"));
  }
  const raw = JSON.parse(outer.dados) as Record<string, unknown>;
  const providerStatus = String(raw.status || raw.situacao || "").toLowerCase();
  const status = /transmit|conclu|sucesso/.test(providerStatus)
    ? "transmitted"
    : /process|fila|andamento/.test(providerStatus)
      ? "processing"
      : /rejeit|erro|invalid/.test(providerStatus)
        ? "rejected"
        : "unknown";
  return {
    status,
    protocolNumber: raw.protocolo == null ? null : String(raw.protocolo),
    receiptNumber: raw.numeroRecibo == null && raw.numeroReciboEntrega == null ? null : String(raw.numeroRecibo || raw.numeroReciboEntrega),
    raw,
  } satisfies MitProviderResult;
}

export const submitMitDeclaration = (input: MitDeclarationInput, requestTag: string) => callMit("submit", input, requestTag);
export const consultMitDeclaration = (input: MitDeclarationInput, requestTag: string) => callMit("status", input, requestTag);
