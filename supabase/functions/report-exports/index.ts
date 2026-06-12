import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { ReportExportRequest, ReportExportResponse } from "./types.ts";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: ReportExportResponse, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validateRequest(payload: ReportExportRequest): ReportExportResponse | null {
  if (!payload.organizationId) {
    return { status: "blocked", reason: "missing_organization", message: "Organizacao obrigatoria para exportar relatorio.", warnings: [] };
  }
  if (!payload.datasetId) {
    return { status: "blocked", reason: "missing_dataset", message: "Base de relatorio obrigatoria.", warnings: [] };
  }
  if (payload.format !== "xlsx") {
    return { status: "blocked", reason: "invalid_format", message: "Formato de exportacao invalido.", warnings: [] };
  }
  if (!Array.isArray(payload.columnKeys) || payload.columnKeys.length === 0) {
    return { status: "blocked", reason: "missing_columns", message: "Selecione ao menos uma coluna para exportar.", warnings: [] };
  }
  const prohibitedColumn = payload.columnKeys.find((columnKey) => /senha|password|token|secret|credential|key/i.test(columnKey));
  if (prohibitedColumn) {
    return {
      status: "blocked",
      reason: "prohibited_field",
      message: "Uma ou mais colunas solicitadas nao podem ser exportadas.",
      warnings: [{ columnKey: prohibitedColumn, reason: "prohibited" }],
    };
  }
  return null;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders });
  }
  if (request.method !== "POST") {
    return response({ status: "failed", reason: "method_not_allowed", message: "Metodo nao permitido.", warnings: [] }, 405);
  }

  try {
    const payload = (await request.json()) as ReportExportRequest;
    const blocked = validateRequest(payload);
    if (blocked) return response(blocked, 400);

    return response({
      status: "blocked",
      reason: "backend_export_not_enabled",
      message: "Exportacao backend validada, mas geracao de arquivo ainda nao foi habilitada nesta fase.",
      rowCount: 0,
      classification: "sensitive",
      warnings: [],
    });
  } catch {
    return response({ status: "failed", reason: "invalid_json", message: "Payload invalido.", warnings: [] }, 400);
  }
});
