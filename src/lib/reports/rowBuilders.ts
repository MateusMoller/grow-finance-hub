import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";
import { formatReportRole, parseReportNumber } from "./formatters";
import type { ReportFilters, ReportRow } from "./types";

export interface ClientSourceRow {
  id: string;
  name: string;
  cnpj?: string | null;
  regime?: string | null;
  sector?: string | null;
  status?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ClientDataSourceRow {
  client_id: string;
  category: string;
  field_name: string;
  field_value?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface LeadSourceRow {
  id: string;
  full_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source_tag?: string | null;
  origin_page?: string | null;
  created_at?: string | null;
}

export interface TaskSourceRow {
  id: string;
  title: string;
  client_name?: string | null;
  assignee?: string | null;
  sector?: string | null;
  priority?: string | null;
  status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProfileSourceRow {
  user_id: string;
  display_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoleSourceRow {
  user_id: string;
  role?: string | null;
  created_at?: string | null;
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function repairCommonEncodingIssues(value: string) {
  return value
    .replace(/Ã¡/g, "a")
    .replace(/Ã£/g, "a")
    .replace(/Ã§/g, "c")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u");
}

function readPartnerText(partner: Record<string, unknown>, ...keys: string[]) {
  const value = keys.map((key) => partner[key]).find((candidate) => typeof candidate === "string");
  return typeof value === "string" ? value.trim() : "";
}

function buildPartnerSummary(rawValue: string | null | undefined) {
  try {
    const parsed = JSON.parse(rawValue || "[]") as unknown;
    if (!Array.isArray(parsed)) return null;

    const partners = parsed.filter(
      (partner): partner is Record<string, unknown> => Boolean(partner) && typeof partner === "object" && !Array.isArray(partner),
    );
    const names = partners.map((partner) => readPartnerText(partner, "nome", "name")).filter(Boolean);
    const participationByPartner = partners.map((partner) => {
      const name = readPartnerText(partner, "nome", "name") || "Socio sem nome";
      const participation = parseReportNumber(
        partner.percentual_participacao ?? partner.percentual ?? partner.ownershipPercent,
      ) || 0;
      return `${name}: ${participation.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    });

    return {
      quantidade: partners.length,
      nomes: names.join("; "),
      participacaoTotal: partners.reduce(
        (sum, partner) =>
          sum + (parseReportNumber(partner.percentual_participacao ?? partner.percentual ?? partner.ownershipPercent) || 0),
        0,
      ),
      participacaoPorSocio: participationByPartner.join(" | "),
      proLaboreTotal: partners.reduce(
        (sum, partner) => sum + (parseReportNumber(partner.pro_labore ?? partner.proLabore ?? partner.prolabore) || 0),
        0,
      ),
    };
  } catch {
    return null;
  }
}

function buildClientDataByClientId(entries: readonly ClientDataSourceRow[]) {
  const byClientId = new Map<string, Record<string, string>>();

  entries.forEach((entry) => {
    const current = byClientId.get(entry.client_id) || {};
    const category = normalizeToken(repairCommonEncodingIssues(entry.category));
    const fieldName = normalizeToken(repairCommonEncodingIssues(entry.field_name));
    const columnKey = `cadastral_${category}_${fieldName}`;

    if (category === "cadastro_clientes" && fieldName === "socios") {
      const summary = buildPartnerSummary(entry.field_value);
      current.cadastral_cadastro_clientes_socios_quantidade = String(summary?.quantidade || 0);
      current.cadastral_cadastro_clientes_socios_nomes = summary?.nomes || "";
      current.cadastral_cadastro_clientes_socios_participacao_total = String(summary?.participacaoTotal || 0);
      current.cadastral_cadastro_clientes_socios_participacao_por_socio = summary?.participacaoPorSocio || "";
      current.cadastral_cadastro_clientes_socios_pro_labore_total = String(summary?.proLaboreTotal || 0);
    } else {
      current[columnKey] = entry.field_value || "";
    }

    byClientId.set(entry.client_id, current);
  });

  return byClientId;
}

export function buildClientReportRows(
  clients: readonly ClientSourceRow[],
  clientDataEntries: readonly ClientDataSourceRow[],
  filters: ReportFilters,
): ReportRow[] {
  const clientDataByClientId = buildClientDataByClientId(clientDataEntries);

  return clients
    .filter((client) => matchesSelectedCompany(client.name, filters.company || null))
    .map((client) => ({
      id: client.id,
      nome: client.name,
      cnpj: client.cnpj || "",
      regime: client.regime || "",
      segmento: client.sector || "",
      status: client.status || "",
      contato: client.contact || "",
      email: (client.email || "").toLowerCase(),
      telefone: client.phone || "",
      criado_em: client.created_at || "",
      atualizado_em: client.updated_at || "",
      ...(clientDataByClientId.get(client.id) || {}),
    }));
}

export function buildLeadReportRows(leads: readonly LeadSourceRow[], filters: ReportFilters): ReportRow[] {
  return leads
    .filter(
      (lead) =>
        matchesSelectedCompany(lead.company_name || lead.full_name, filters.company || null) &&
        matchesSelectedCompetence(lead.created_at || null, filters.competence || null),
    )
    .map((lead) => ({
      id: lead.id,
      nome: lead.full_name,
      empresa: lead.company_name || "",
      email: lead.email || "",
      telefone: lead.phone || "",
      origem: lead.source_tag || "",
      pagina_origem: lead.origin_page || "",
      criado_em: lead.created_at || "",
    }));
}

export function buildTaskReportRows(tasks: readonly TaskSourceRow[], filters: ReportFilters): ReportRow[] {
  return tasks
    .filter(
      (task) =>
        matchesSelectedCompany(task.client_name || "", filters.company || null) &&
        matchesSelectedCompetence(getTaskCompetence(task.due_date || null, task.created_at || null), filters.competence || null) &&
        (!filters.sector || task.sector === filters.sector) &&
        (!filters.assignee || task.assignee === filters.assignee),
    )
    .map((task) => ({
      id: task.id,
      titulo: task.title,
      cliente: task.client_name || "",
      responsavel: task.assignee || "",
      setor: task.sector || "",
      prioridade: task.priority || "",
      status: task.status || "",
      prazo: task.due_date || "",
      criado_em: task.created_at || "",
      atualizado_em: task.updated_at || "",
    }));
}

export function buildTeamReportRows(
  profiles: readonly ProfileSourceRow[],
  roles: readonly RoleSourceRow[],
  filters: ReportFilters,
): ReportRow[] {
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const rolesByUserId = new Map<string, RoleSourceRow[]>();

  roles.forEach((role) => {
    const current = rolesByUserId.get(role.user_id) || [];
    current.push(role);
    rolesByUserId.set(role.user_id, current);
  });

  return Array.from(new Set([...profiles.map((profile) => profile.user_id), ...roles.map((role) => role.user_id)]))
    .map((userId) => {
      const profile = profileByUserId.get(userId);
      const [firstRole] = rolesByUserId.get(userId) || [];
      return {
        id: userId,
        colaborador: profile?.display_name || `Usuario ${userId.slice(0, 6)}`,
        papel: formatReportRole(firstRole?.role || ""),
        usuario_id: userId,
        criado_em: profile?.created_at || firstRole?.created_at || "",
        atualizado_em: profile?.updated_at || profile?.created_at || firstRole?.created_at || "",
        papel_definido_em: firstRole?.created_at || "",
      };
    })
    .filter((member) => matchesSelectedCompetence(String(member.criado_em || ""), filters.competence || null))
    .sort((a, b) => String(a.colaborador).localeCompare(String(b.colaborador), "pt-BR"));
}
