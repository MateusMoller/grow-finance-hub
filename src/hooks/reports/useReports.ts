import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { reportCatalog, reportCatalogById } from "@/lib/reports/catalog";
import { normalizeReportFilters } from "@/lib/reports/filters";
import { canAccessReportDataset, filterAuthorizedReportDatasets } from "@/lib/reports/permissions";
import { buildReportPreview } from "@/lib/reports/previewService";
import {
  buildClientReportRows,
  buildLeadReportRows,
  buildTaskReportRows,
  buildTeamReportRows,
  type ClientDataSourceRow,
  type ClientSourceRow,
  type LeadSourceRow,
  type ProfileSourceRow,
  type RoleSourceRow,
  type TaskSourceRow,
} from "@/lib/reports/rowBuilders";
import type { ReportDatasetDefinition, ReportDatasetId, ReportFilters, ReportRow } from "@/lib/reports/types";
import { reportQueryKeys } from "./reportQueryKeys";

const REPORT_PAGE_SIZE = 1000;
const CLIENT_DATA_CLIENT_CHUNK_SIZE = 100;
const CLIENT_DATA_CATEGORIES = [
  "cadastro_clientes",
  "cadastro_fiscal",
  "cadastro_departamento_pessoal",
  "cadastro_contabil",
  "cadastro_obrigacoes",
  "cadastro_honorarios",
  "cadastro_documentos",
];

function chunkClientIds(clientIds: readonly string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < clientIds.length; index += CLIENT_DATA_CLIENT_CHUNK_SIZE) {
    chunks.push(clientIds.slice(index, index + CLIENT_DATA_CLIENT_CHUNK_SIZE));
  }
  return chunks;
}

async function fetchClientDataRows(organizationId: string, clientIds: readonly string[]) {
  const rows: ClientDataSourceRow[] = [];
  const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));
  if (uniqueClientIds.length === 0) return rows;

  for (const clientIdChunk of chunkClientIds(uniqueClientIds)) {
    for (let from = 0; ; from += REPORT_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("client_data")
        .select("client_id, category, field_name, field_value, updated_at, created_at")
        .eq("organization_id", organizationId)
        .in("client_id", clientIdChunk)
        .in("category", CLIENT_DATA_CATEGORIES)
        .order("client_id", { ascending: true })
        .order("category", { ascending: true })
        .order("field_name", { ascending: true })
        .range(from, from + REPORT_PAGE_SIZE - 1);

      if (error) throw error;
      const page = (data || []) as ClientDataSourceRow[];
      rows.push(...page);
      if (page.length < REPORT_PAGE_SIZE) break;
    }
  }

  return rows;
}

export async function fetchRowsForDataset(dataset: ReportDatasetDefinition, organizationId: string | null): Promise<ReportRow[]> {
  if (!organizationId) return [];
  const maxRows = dataset.exportLimit + 1;

  if (dataset.id === "clientes") {
    const clientsRes = await supabase
      .from("clients")
      .select("id, name, cnpj, regime, sector, status, contact, email, phone, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("name")
      .range(0, maxRows - 1);
    if (clientsRes.error) throw clientsRes.error;
    const clients = (clientsRes.data || []) as ClientSourceRow[];
    const clientDataRows = await fetchClientDataRows(
      organizationId,
      clients.map((client) => client.id),
    );
    return buildClientReportRows(
      clients,
      clientDataRows,
      normalizeReportFilters({ organizationId }),
    );
  }

  if (dataset.id === "leads_crm") {
    const { data, error } = await supabase
      .from("site_leads")
      .select("id, full_name, company_name, email, phone, source_tag, origin_page, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, maxRows - 1);
    if (error) throw error;
    return buildLeadReportRows((data || []) as LeadSourceRow[], normalizeReportFilters({ organizationId }));
  }

  if (dataset.id === "tarefas") {
    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("id, title, client_name, assignee, sector, priority, status, due_date, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, maxRows - 1);
    if (error) throw error;
    return buildTaskReportRows((data || []) as TaskSourceRow[], normalizeReportFilters({ organizationId }));
  }

  const [profilesRes, rolesRes, grantsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, maxRows - 1),
    supabase
      .from("organization_user_access")
      .select("user_id, role:primary_role, sector_code, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, maxRows - 1),
    supabase
      .from("user_module_grants")
      .select("user_id, module_key")
      .eq("organization_id", organizationId),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (rolesRes.error) throw rolesRes.error;
  if (grantsRes.error) throw grantsRes.error;
  const modulesByUser = new Map<string, string[]>();
  (grantsRes.data || []).forEach((grant) => {
    const userId = String(grant.user_id);
    const current = modulesByUser.get(userId) || [];
    current.push(String(grant.module_key));
    modulesByUser.set(userId, current);
  });
  return buildTeamReportRows(
    (profilesRes.data || []) as ProfileSourceRow[],
    ((rolesRes.data || []) as RoleSourceRow[]).map((row) => ({
      ...row,
      enabled_modules: modulesByUser.get(row.user_id) || [],
    })),
    normalizeReportFilters({ organizationId }),
  );
}

export function applyReportFilters(datasetId: ReportDatasetId, rows: readonly ReportRow[], filters: ReportFilters) {
  if (datasetId === "clientes") {
    return rows.filter((row) => !filters.company || String(row.nome || "").trim() === filters.company);
  }
  return rows;
}

export function useReportCatalog(organizationId: string | null, roles: readonly string[]) {
  return useQuery({
    queryKey: reportQueryKeys.catalog(organizationId, roles),
    queryFn: async () => filterAuthorizedReportDatasets(reportCatalog, roles),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportPreview(input: {
  datasetId: ReportDatasetId;
  filters: Partial<ReportFilters>;
  columnKeys: readonly string[];
  roles: readonly string[];
}) {
  const filters = useMemo(() => normalizeReportFilters(input.filters), [input.filters]);
  const dataset = reportCatalogById.get(input.datasetId) || reportCatalog[0];

  return useQuery({
    queryKey: reportQueryKeys.preview(input.datasetId, filters, input.columnKeys),
    queryFn: async () => {
      if (!canAccessReportDataset(dataset, input.roles)) {
        throw new Error("permission_denied");
      }
      const rows = await fetchRowsForDataset(dataset, filters.organizationId);
      return buildReportPreview({
        dataset,
        rows: applyReportFilters(input.datasetId, rows, filters),
        columnKeys: input.columnKeys,
        roles: input.roles,
      });
    },
    enabled: Boolean(filters.organizationId && input.columnKeys.length > 0),
  });
}
