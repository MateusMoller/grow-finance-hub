import { sectorOptions } from "@/components/portal/types";
import { supabase } from "@/integrations/supabase/client";

export type PortalRequestFieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "email"
  | "phone"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "file";

export interface PortalRequestTypeField {
  id: string;
  label: string;
  type: PortalRequestFieldType;
  required?: boolean;
  options?: string[];
}

export interface PortalRequestType {
  id: string;
  organization_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  sector: string;
  task_title_template: string;
  task_description_template: string | null;
  form_fields: PortalRequestTypeField[];
  is_active: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

type SupabaseErrorLike = { message?: string; details?: string; code?: string } | null;

type RequestTypesManyResult = {
  data: unknown[] | null;
  error: SupabaseErrorLike;
};

type RequestTypesSingleResult = {
  data: unknown | null;
  error: SupabaseErrorLike;
};

type RequestTypesDeleteResult = {
  error: SupabaseErrorLike;
};

interface RequestTypesSelectBuilder extends PromiseLike<RequestTypesManyResult> {
  eq(column: string, value: unknown): RequestTypesSelectBuilder;
  is(column: string, value: null): RequestTypesSelectBuilder;
  or(filters: string): RequestTypesSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): RequestTypesSelectBuilder;
  maybeSingle(): PromiseLike<RequestTypesSingleResult>;
}

interface RequestTypesWriteBuilder extends PromiseLike<RequestTypesSingleResult> {
  eq(column: string, value: unknown): RequestTypesWriteBuilder;
  select(columns?: string): RequestTypesWriteBuilder;
  single(): RequestTypesWriteBuilder;
}

interface RequestTypesDeleteBuilder extends PromiseLike<RequestTypesDeleteResult> {
  eq(column: string, value: unknown): RequestTypesDeleteBuilder;
}

interface RequestTypesTable {
  select(columns?: string): RequestTypesSelectBuilder;
  insert(values: Record<string, unknown>): RequestTypesWriteBuilder;
  update(values: Record<string, unknown>): RequestTypesWriteBuilder;
  delete(): RequestTypesDeleteBuilder;
}

const portalRequestTypesClient = supabase as unknown as {
  from(table: "portal_request_types"): RequestTypesTable;
};

export const portalRequestTypesTable = () => portalRequestTypesClient.from("portal_request_types");

export const defaultPortalRequestTypes: PortalRequestType[] = [
  {
    id: "default-nota-fiscal",
    organization_id: null,
    title: "Nota fiscal",
    slug: "nota-fiscal",
    description: "Solicite emissão, ajuste ou conferência de nota fiscal.",
    sector: "Fiscal",
    task_title_template: "Nota fiscal",
    task_description_template: "Solicitação relacionada a nota fiscal.",
    form_fields: [
      { id: "tipo_nota", label: "Tipo de nota", type: "text" },
      { id: "competencia", label: "Competência", type: "text" },
    ],
    is_active: true,
    sort_order: 10,
  },
  {
    id: "default-admissao",
    organization_id: null,
    title: "Admissão",
    slug: "admissao",
    description: "Envie informações para abertura de admissão de colaborador.",
    sector: "Departamento Pessoal",
    task_title_template: "Admissão de colaborador",
    task_description_template: "Solicitação de admissão de colaborador.",
    form_fields: [
      { id: "nome_colaborador", label: "Nome do colaborador", type: "text", required: true },
      { id: "data_admissao", label: "Data prevista de admissão", type: "date" },
    ],
    is_active: true,
    sort_order: 20,
  },
  {
    id: "default-demissao",
    organization_id: null,
    title: "Demissão",
    slug: "demissao",
    description: "Encaminhe uma solicitação de encerramento de vínculo.",
    sector: "Departamento Pessoal",
    task_title_template: "Demissão de colaborador",
    task_description_template: "Solicitação de demissão de colaborador.",
    form_fields: [
      { id: "nome_colaborador", label: "Nome do colaborador", type: "text", required: true },
      { id: "data_desligamento", label: "Data prevista de desligamento", type: "date" },
    ],
    is_active: true,
    sort_order: 30,
  },
];

export const portalRequestFieldTypeLabels: Record<PortalRequestFieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  date: "Data",
  number: "Número",
  email: "E-mail",
  phone: "Telefone",
  select: "Seleção",
  multiselect: "Múltipla escolha",
  radio: "Opção única",
  checkbox: "Sim/Não",
  file: "Anexo de arquivo",
};

export const portalRequestFieldTypes = Object.keys(portalRequestFieldTypeLabels) as PortalRequestFieldType[];

export const portalRequestFieldTypesWithOptions = new Set<PortalRequestFieldType>([
  "select",
  "multiselect",
  "radio",
]);

const fieldTypeSet = new Set<PortalRequestFieldType>(portalRequestFieldTypes);

const normalizeSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildPortalRequestTypeSlug = (title: string) => normalizeSlug(title) || `solicitacao-${Date.now()}`;

export const normalizeRequestTypeSector = (sector: string | null | undefined) =>
  sector && sectorOptions.includes(sector) ? sector : "Geral";

export const normalizeRequestTypeFields = (value: unknown): PortalRequestTypeField[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((field, index) => {
      if (!field || typeof field !== "object") return null;
      const source = field as Partial<PortalRequestTypeField>;
      const label = String(source.label || "").trim();
      if (!label) return null;
      const id = String(source.id || normalizeSlug(label) || `campo_${index + 1}`).trim();
      const type = fieldTypeSet.has(source.type as PortalRequestFieldType)
        ? (source.type as PortalRequestFieldType)
        : "text";
      const rawOptions = Array.isArray((source as { options?: unknown }).options)
        ? ((source as { options?: unknown[] }).options || [])
        : [];
      const options = rawOptions
        .map((option) => String(option || "").trim())
        .filter(Boolean)
        .slice(0, 20);

      return {
        id,
        label,
        type,
        required: Boolean(source.required),
        options: portalRequestFieldTypesWithOptions.has(type) ? options : undefined,
      };
    })
    .filter((field): field is PortalRequestTypeField => Boolean(field));
};

export const normalizePortalRequestType = (row: unknown): PortalRequestType | null => {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  const title = String(source.title || "").trim();
  if (!title) return null;

  return {
    id: String(source.id || crypto.randomUUID()),
    organization_id: typeof source.organization_id === "string" ? source.organization_id : null,
    title,
    slug: String(source.slug || buildPortalRequestTypeSlug(title)),
    description: typeof source.description === "string" ? source.description : null,
    sector: normalizeRequestTypeSector(typeof source.sector === "string" ? source.sector : null),
    task_title_template:
      typeof source.task_title_template === "string" && source.task_title_template.trim()
        ? source.task_title_template
        : title,
    task_description_template:
      typeof source.task_description_template === "string" ? source.task_description_template : null,
    form_fields: normalizeRequestTypeFields(source.form_fields),
    is_active: source.is_active !== false,
    sort_order: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : 100,
    created_by: typeof source.created_by === "string" ? source.created_by : null,
    created_at: typeof source.created_at === "string" ? source.created_at : undefined,
    updated_at: typeof source.updated_at === "string" ? source.updated_at : undefined,
  };
};

export const sortPortalRequestTypes = (items: PortalRequestType[]) =>
  [...items].sort((left, right) => {
    const orderDiff = left.sort_order - right.sort_order;
    if (orderDiff !== 0) return orderDiff;
    return left.title.localeCompare(right.title, "pt-BR");
  });

export const mergePortalRequestTypesWithDefaults = (items: PortalRequestType[]) => {
  const bySlug = new Map<string, PortalRequestType>();
  [...defaultPortalRequestTypes, ...items].forEach((item) => {
    const current = bySlug.get(item.slug);
    if (!current || (!current.organization_id && item.organization_id)) {
      bySlug.set(item.slug, item);
    }
  });

  return sortPortalRequestTypes(Array.from(bySlug.values()).filter((item) => item.is_active));
};

export const resolvePortalRequestTypesForManagement = (items: PortalRequestType[]) => {
  const bySlug = new Map<string, PortalRequestType>();
  [...defaultPortalRequestTypes, ...items].forEach((item) => {
    const current = bySlug.get(item.slug);
    if (!current || (!current.organization_id && item.organization_id)) {
      bySlug.set(item.slug, item);
    }
  });

  return sortPortalRequestTypes(Array.from(bySlug.values()).filter((item) => item.is_active));
};
