import type { ReportDatasetId, ReportFilters } from "@/lib/reports/types";

export const reportQueryKeys = {
  all: ["reports"] as const,
  catalog: (organizationId: string | null, roles: readonly string[]) =>
    [...reportQueryKeys.all, "catalog", organizationId || "no-org", [...roles].sort().join(",")] as const,
  preview: (datasetId: ReportDatasetId, filters: ReportFilters, columnKeys: readonly string[]) =>
    [
      ...reportQueryKeys.all,
      "preview",
      datasetId,
      filters.organizationId || "no-org",
      filters.company || "",
      filters.clientId || "",
      filters.competence || "",
      filters.period || "",
      filters.status || "",
      filters.sector || "",
      filters.assignee || "",
      [...columnKeys].join(","),
    ] as const,
  savedReports: (organizationId: string | null, userId: string | null) =>
    [...reportQueryKeys.all, "saved-reports", organizationId || "no-org", userId || "no-user"] as const,
};
