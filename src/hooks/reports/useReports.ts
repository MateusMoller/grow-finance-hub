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
import type { ReportDatasetId, ReportFilters, ReportRow } from "@/lib/reports/types";
import { reportQueryKeys } from "./reportQueryKeys";

async function fetchRowsForDataset(datasetId: ReportDatasetId, organizationId: string | null): Promise<ReportRow[]> {
  if (!organizationId) return [];

  if (datasetId === "clientes") {
    const [clientsRes, clientDataRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, cnpj, regime, sector, status, contact, email, phone, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("client_data")
        .select("client_id, category, field_name, field_value, updated_at, created_at")
        .eq("organization_id", organizationId)
        .in("category", [
          "cadastro_clientes",
          "cadastro_fiscal",
          "cadastro_departamento_pessoal",
          "cadastro_contabil",
          "cadastro_obrigacoes",
          "cadastro_honorarios",
          "cadastro_documentos",
        ])
        .limit(5000),
    ]);
    if (clientsRes.error) throw clientsRes.error;
    if (clientDataRes.error) throw clientDataRes.error;
    return buildClientReportRows(
      (clientsRes.data || []) as ClientSourceRow[],
      (clientDataRes.data || []) as ClientDataSourceRow[],
      normalizeReportFilters({ organizationId }),
    );
  }

  if (datasetId === "leads_crm") {
    const { data, error } = await supabase
      .from("site_leads")
      .select("id, full_name, company_name, email, phone, source_tag, origin_page, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return buildLeadReportRows((data || []) as LeadSourceRow[], normalizeReportFilters({ organizationId }));
  }

  if (datasetId === "tarefas") {
    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("id, title, client_name, assignee, sector, priority, status, due_date, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) throw error;
    return buildTaskReportRows((data || []) as TaskSourceRow[], normalizeReportFilters({ organizationId }));
  }

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (rolesRes.error) throw rolesRes.error;
  return buildTeamReportRows(
    (profilesRes.data || []) as ProfileSourceRow[],
    (rolesRes.data || []) as RoleSourceRow[],
    normalizeReportFilters({ organizationId }),
  );
}

function applyFilters(datasetId: ReportDatasetId, rows: readonly ReportRow[], filters: ReportFilters) {
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
      const rows = await fetchRowsForDataset(input.datasetId, filters.organizationId);
      return buildReportPreview({
        dataset,
        rows: applyFilters(input.datasetId, rows, filters),
        columnKeys: input.columnKeys,
        roles: input.roles,
      });
    },
    enabled: Boolean(filters.organizationId && input.columnKeys.length > 0),
  });
}
