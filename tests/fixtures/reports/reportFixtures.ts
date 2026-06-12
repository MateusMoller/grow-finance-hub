import type { ReportFilters, ReportRole, ReportRow } from "@/lib/reports/types";

export const reportRoleFixtures: Record<string, ReportRole[]> = {
  admin: ["admin"],
  manager: ["manager"],
  commercial: ["commercial"],
  department: ["fiscal"],
  client: ["client"],
};

export const baseReportFilters: ReportFilters = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  company: null,
  clientId: null,
  competence: "2026-06",
  period: null,
  status: null,
  sector: null,
  assignee: null,
};

export const clientReportRows: ReportRow[] = [
  {
    id: "client-1",
    nome: "Cliente A",
    status: "ativo",
    segmento: "Servicos",
    email: "cliente@example.com",
  },
];
