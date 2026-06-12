import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { recordOperationalAuditLog } from "@/lib/operationalAudit";
import { reportCatalogById } from "./catalog";
import { buildReportAuditMetadata } from "./audit";
import { normalizeReportFilters } from "./filters";
import { normalizeSavedReportName, sanitizeSavedReportFormat, validateSavedReportColumns } from "./savedReports";
import type { ReportDatasetId, SavedReportModel, SavedReportValidationResult } from "./types";

type SavedReportRow = Tables<"saved_reports">;

function mapSavedReport(row: SavedReportRow): SavedReportModel | null {
  if (!reportCatalogById.has(row.dataset_id as ReportDatasetId)) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    name: row.name,
    normalizedName: row.normalized_name || normalizeSavedReportName(row.name),
    datasetId: row.dataset_id as ReportDatasetId,
    columnKeys: Array.isArray(row.column_keys) ? row.column_keys : [],
    format: sanitizeSavedReportFormat(row.format),
    autoGenerate: Boolean(row.auto_generate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function auditSavedReport(input: {
  organizationId: string;
  userId: string;
  action: string;
  modelId?: string | null;
  datasetId: ReportDatasetId;
  columnKeys: readonly string[];
  result?: "success" | "error" | "warning";
}) {
  const dataset = reportCatalogById.get(input.datasetId);
  await recordOperationalAuditLog({
    organizationId: input.organizationId,
    action: input.action,
    entityType: "saved_report",
    entityId: input.modelId || null,
    result: input.result || "success",
    metadata: buildReportAuditMetadata({
      datasetId: input.datasetId,
      filters: normalizeReportFilters({ organizationId: input.organizationId }),
      columnKeys: input.columnKeys,
      format: "xlsx",
      classification: dataset?.classification || "internal",
    }) as unknown as Record<string, Json>,
  });
}

export async function listSavedReports(input: { organizationId: string; userId: string }) {
  const { data, error } = await supabase
    .from("saved_reports")
    .select("id, organization_id, user_id, name, normalized_name, dataset_id, column_keys, format, auto_generate, created_at, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as SavedReportRow[]).map(mapSavedReport).filter((item): item is SavedReportModel => Boolean(item));
}

export function validateSavedReportModel(model: SavedReportModel): SavedReportValidationResult {
  const dataset = reportCatalogById.get(model.datasetId);
  if (!dataset) {
    return { validColumnKeys: [], warnings: model.columnKeys.map((columnKey) => ({ columnKey, reason: "unknown" })) };
  }
  return validateSavedReportColumns(dataset, model.columnKeys, { preview: true });
}

export async function saveReportModel(input: {
  id?: string | null;
  organizationId: string;
  userId: string;
  name: string;
  datasetId: ReportDatasetId;
  columnKeys: readonly string[];
}) {
  const dataset = reportCatalogById.get(input.datasetId);
  if (!dataset) throw new Error("invalid_dataset");

  const validation = validateSavedReportColumns(dataset, input.columnKeys, { preview: true });
  if (validation.validColumnKeys.length === 0) throw new Error("missing_valid_columns");

  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organizationId,
    user_id: input.userId,
    name: input.name.trim(),
    normalized_name: normalizeSavedReportName(input.name),
    dataset_id: input.datasetId,
    column_keys: validation.validColumnKeys,
    format: "xlsx",
    auto_generate: false,
    updated_at: now,
  };

  const query = input.id
    ? supabase.from("saved_reports").update(payload).eq("id", input.id).eq("user_id", input.userId).eq("organization_id", input.organizationId)
    : supabase.from("saved_reports").insert(payload);

  const { data, error } = await query
    .select("id, organization_id, user_id, name, normalized_name, dataset_id, column_keys, format, auto_generate, created_at, updated_at")
    .single();

  if (error) throw error;
  const model = mapSavedReport(data as SavedReportRow);
  if (!model) throw new Error("invalid_saved_report_response");

  await auditSavedReport({
    organizationId: input.organizationId,
    userId: input.userId,
    action: input.id ? "report_model_update" : "report_model_create",
    modelId: model.id,
    datasetId: model.datasetId,
    columnKeys: model.columnKeys,
  });

  return { model, validation };
}

export async function deleteReportModel(input: {
  organizationId: string;
  userId: string;
  model: SavedReportModel;
}) {
  const { error } = await supabase
    .from("saved_reports")
    .delete()
    .eq("id", input.model.id)
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);

  if (error) throw error;
  await auditSavedReport({
    organizationId: input.organizationId,
    userId: input.userId,
    action: "report_model_delete",
    modelId: input.model.id,
    datasetId: input.model.datasetId,
    columnKeys: input.model.columnKeys,
  });
}
