import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { SalesCatalogCategory, SalesRecurrenceType, SalesStageName } from "@/lib/salesPipeline";

interface UntypedQueryResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

interface UntypedQueryBuilder<T = unknown> extends PromiseLike<UntypedQueryResult<T>> {
  select: (columns?: string) => UntypedQueryBuilder<T>;
  eq: (column: string, value: unknown) => UntypedQueryBuilder<T>;
  neq: (column: string, value: unknown) => UntypedQueryBuilder<T>;
  in: (column: string, values: unknown[]) => UntypedQueryBuilder<T>;
  is: (column: string, value: unknown) => UntypedQueryBuilder<T>;
  ilike: (column: string, value: string) => UntypedQueryBuilder<T>;
  or: (filters: string) => UntypedQueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQueryBuilder<T>;
  limit: (count: number) => UntypedQueryBuilder<T>;
  insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => UntypedQueryBuilder<T>;
  update: (values: Record<string, unknown>) => UntypedQueryBuilder<T>;
  upsert: (values: Record<string, unknown> | Array<Record<string, unknown>>, options?: Record<string, unknown>) => UntypedQueryBuilder<T>;
  delete: () => UntypedQueryBuilder<T>;
  single: () => PromiseLike<UntypedQueryResult<T>>;
  maybeSingle: () => PromiseLike<UntypedQueryResult<T>>;
}

type UntypedSupabaseClient = SupabaseClient<Database> & {
  from: (relation: string) => UntypedQueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<UntypedQueryResult>;
};

export interface SalesPipelineStageRow {
  id: string;
  organization_id: string;
  name: SalesStageName | string;
  position: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  is_system_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesCatalogOfferRow {
  id: string;
  organization_id: string;
  name: string;
  category: SalesCatalogCategory;
  default_recurrence_type: SalesRecurrenceType;
  default_value: number | null;
  description: string | null;
  is_system_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesClientOption {
  id: string;
  name: string;
  cnpj: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
}

export interface SalesUserOption {
  user_id: string;
  display_name: string | null;
}

export interface SalesOpportunityRow {
  id: string;
  organization_id: string;
  client_id: string | null;
  commercial_lead_id: string | null;
  stage_id: string | null;
  status: "active" | "won" | "lost" | "archived";
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  estimated_value: number;
  sale_type: SalesCatalogCategory;
  offer_id: string | null;
  other_offer_description: string | null;
  recurrence_type: SalesRecurrenceType;
  probability: number;
  stage: string;
  source: string | null;
  competence: string;
  expected_close_date: string | null;
  owner_user_id: string | null;
  notes: string | null;
  loss_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  archived_at: string | null;
  completion_task_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesActivityRow {
  id: string;
  organization_id: string;
  opportunity_id: string;
  actor_user_id: string | null;
  activity_type: string;
  title: string;
  body: string | null;
  due_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const fetchSalesPipelineStages = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_pipeline_stages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data || []) as SalesPipelineStageRow[];
};

export const fetchSalesCatalogOffers = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_commercial_offers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as SalesCatalogOfferRow[];
};

export const fetchSalesClients = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("clients")
    .select("id,name,cnpj,contact,email,phone,status")
    .eq("organization_id", organizationId)
    .neq("status", "Inativo")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as SalesClientOption[];
};

export const fetchSalesUsers = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const [accessResult, profileResult] = await Promise.all([
    (supabase as UntypedSupabaseClient)
      .from("organization_user_access")
      .select("user_id")
      .eq("organization_id", organizationId)
      .in("primary_role", ["admin", "colaborador"])
      .eq("status", "active"),
    (supabase as UntypedSupabaseClient)
      .from("profiles")
      .select("user_id,display_name")
      .eq("organization_id", organizationId),
  ]);

  if (accessResult.error) throw accessResult.error;
  if (profileResult.error) throw profileResult.error;

  const profilesByUserId = new Map(
    ((profileResult.data || []) as Array<{ user_id: string; display_name: string | null }>).map((profile) => [
      profile.user_id,
      profile.display_name,
    ]),
  );

  return ((accessResult.data || []) as Array<{ user_id: string }>).map((item) => ({
    user_id: item.user_id,
    display_name: profilesByUserId.get(item.user_id) ?? null,
  }));
};

export const fetchSalesCommercialLeads = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_commercial_leads")
    .select("id,name,email,phone,status")
    .eq("organization_id", organizationId)
    .neq("status", "discarded");

  if (error) throw error;
  return (data || []) as Array<{ id: string; name: string; email: string | null; phone: string | null; status: string }>;
};

export const saveSalesCommercialLead = async (
  supabase: SupabaseClient<Database>,
  payload: {
    id?: string | null;
    organization_id: string;
    name: string;
    contact?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    notes?: string | null;
    created_by?: string | null;
  },
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_commercial_leads")
    .upsert({
      id: payload.id || undefined,
      organization_id: payload.organization_id,
      name: payload.name,
      contact: payload.contact ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      source: payload.source ?? null,
      notes: payload.notes ?? null,
      created_by: payload.created_by ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as { id: string };
};

export const fetchSalesOpportunities = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_leads")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return (data || []) as SalesOpportunityRow[];
};

export interface SalesOpportunityPayload {
  organization_id: string;
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  estimated_value?: number;
  client_id?: string | null;
  commercial_lead_id?: string | null;
  stage_id?: string | null;
  status?: "active" | "won" | "lost" | "archived";
  sale_type?: SalesCatalogCategory;
  offer_id?: string | null;
  other_offer_description?: string | null;
  recurrence_type?: SalesRecurrenceType;
  probability?: number;
  stage?: string;
  source?: string | null;
  competence: string;
  expected_close_date?: string | null;
  owner_user_id?: string | null;
  notes?: string | null;
  loss_reason?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  updated_by?: string | null;
  created_by?: string | null;
}

export const saveSalesOpportunity = async (
  supabase: SupabaseClient<Database>,
  payload: SalesOpportunityPayload & { id?: string },
) => {
  const queryPayload = { ...payload, updated_at: new Date().toISOString() };
  const query = payload.id
    ? (supabase as UntypedSupabaseClient).from("crm_leads").update(queryPayload).eq("id", payload.id)
    : (supabase as UntypedSupabaseClient).from("crm_leads").insert(queryPayload);

  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data as SalesOpportunityRow;
};

export const archiveSalesOpportunity = async (
  supabase: SupabaseClient<Database>,
  id: string,
  actorUserId?: string | null,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_leads")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_by: actorUserId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as SalesOpportunityRow;
};

export const saveSalesOffer = async (
  supabase: SupabaseClient<Database>,
  payload: Partial<SalesCatalogOfferRow> & { organization_id: string; name: string; category: SalesCatalogCategory },
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_commercial_offers")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) throw error;
  return data as SalesCatalogOfferRow;
};

export const saveSalesStage = async (
  supabase: SupabaseClient<Database>,
  payload: Partial<SalesPipelineStageRow> & { organization_id: string; name: string; position: number },
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_pipeline_stages")
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) throw error;
  return data as SalesPipelineStageRow;
};

export const fetchSalesActivities = async (
  supabase: SupabaseClient<Database>,
  organizationId: string,
  opportunityId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_opportunity_activities")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SalesActivityRow[];
};

export const createSalesActivity = async (
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    opportunityId: string;
    actorUserId?: string | null;
    activityType: string;
    title: string;
    body?: string | null;
    dueAt?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient)
    .from("crm_opportunity_activities")
    .insert({
      organization_id: input.organizationId,
      opportunity_id: input.opportunityId,
      actor_user_id: input.actorUserId ?? null,
      activity_type: input.activityType,
      title: input.title,
      body: input.body ?? null,
      due_at: input.dueAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SalesActivityRow;
};

export const winNewClientOpportunity = async (
  supabase: SupabaseClient<Database>,
  opportunityId: string,
) => {
  const { data, error } = await (supabase as UntypedSupabaseClient).rpc("crm_win_new_client_opportunity", {
    _opportunity_id: opportunityId,
  });

  if (error) throw error;
  return data as Array<{ client_id: string; task_id: string }>;
};
