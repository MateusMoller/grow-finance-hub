import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const internalRoles = new Set([
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "partner",
  "departamento_pessoal",
  "fiscal",
  "contabil",
]);

const templateManagerRoles = new Set(["admin", "director", "manager"]);

type JsonRecord = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof createClient>;

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  sector: string;
  periodicity: string;
  competence_reference: string;
  due_day: number;
  yearly_due_month: number | null;
  legal_due_day: number | null;
  priority: string;
  expected_documents: unknown;
  is_active: boolean;
  generates_calendar: boolean;
  generates_kanban: boolean;
  requires_protocol: boolean;
  requires_document: boolean;
  operational_notes: string | null;
};

type ProfileRow = {
  id: string;
  client_id: string;
  template_id: string;
  assigned_to: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  due_day_override: number | null;
  yearly_due_month_override: number | null;
  legal_due_day_override: number | null;
  expected_documents_override: unknown;
  notes: string | null;
  parameters: unknown;
};

type InstanceRow = {
  id: string;
  client_id: string;
  profile_id: string;
  template_id: string;
  competence_label: string;
  competence_date: string;
  competence_key: string;
  technical_due_date: string;
  legal_due_date: string | null;
  status: string;
  priority: string;
  current_assignee: string | null;
  protocol: string | null;
  completion_notes: string | null;
  document_required: boolean;
  protocol_required: boolean;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item));
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const token = String(value || "").trim().toLowerCase();
  if (["1", "true", "sim", "yes"].includes(token)) return true;
  if (["0", "false", "nao", "não", "no"].includes(token)) return false;
  return fallback;
}

function asInteger(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number(asTrimmedString(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTemplateCode(value: string) {
  return normalizeToken(value).replace(/_+/g, "-");
}

function extractBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${year}`;
}

function competenceKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function clampDay(day: number, year: number, monthIndex: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.max(1, Math.min(day, lastDay));
}

function computeCompetenceDate(
  periodicity: string,
  cursor: Date,
  competenceReference: string,
  yearlyDueMonth?: number | null,
) {
  let baseDate: Date;

  if (periodicity === "yearly") {
    const dueMonthIndex = Math.max(0, Math.min(11, (yearlyDueMonth || 1) - 1));
    baseDate = new Date(Date.UTC(cursor.getUTCFullYear(), dueMonthIndex, 1));
  } else {
    baseDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  }

  if (competenceReference === "anterior") {
    baseDate.setUTCMonth(baseDate.getUTCMonth() - 1);
  }

  return baseDate;
}

function computeDueDate(competenceDate: Date, dueDay: number) {
  const year = competenceDate.getUTCFullYear();
  const monthIndex = competenceDate.getUTCMonth();
  const day = clampDay(dueDay, year, monthIndex);
  return new Date(Date.UTC(year, monthIndex, day));
}

async function buildAuthContext(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing Supabase environment configuration");
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { error: jsonResponse({ error: "Authorization token is required" }, 401) };
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: "Invalid or expired session" }, 401) };
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) throw roleError;

  const roles = (roleRows || [])
    .map((row) => asTrimmedString((row as JsonRecord).role))
    .filter((role): role is string => Boolean(role));
  const internal = roles.some((role) => internalRoles.has(role));

  if (!internal) {
    return { error: jsonResponse({ error: "Only internal users can access this module" }, 403) };
  }

  return { supabaseAdmin, user, roles };
}

async function loadClientsMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, sector, status")
    .order("name");

  if (error) throw error;

  return new Map(
    (data || []).map((row) => [
      String((row as JsonRecord).id),
      {
        id: String((row as JsonRecord).id),
        name: String((row as JsonRecord).name || ""),
        sector: asTrimmedString((row as JsonRecord).sector) || "Geral",
        status: asTrimmedString((row as JsonRecord).status) || "Ativo",
      },
    ]),
  );
}

async function loadTemplatesMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("obligation_templates")
    .select("*")
    .order("name");

  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as TemplateRow]));
}

async function loadProfilesMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as ProfileRow]));
}

async function createInstanceEvent(
  supabaseAdmin: SupabaseAdmin,
  instanceId: string,
  createdBy: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  comment?: string | null,
  metadata?: JsonRecord,
) {
  const { error } = await supabaseAdmin
    .from("obligation_instance_events")
    .insert({
      instance_id: instanceId,
      event_type: eventType,
      from_status: fromStatus,
      to_status: toStatus,
      comment: comment || null,
      metadata: metadata || {},
      created_by: createdBy,
    });

  if (error) throw error;
}

async function syncInstanceArtifacts(
  supabaseAdmin: SupabaseAdmin,
  instance: InstanceRow,
  template: TemplateRow,
  clientName: string,
) {
  const obligationTitle = `${template.name} · ${clientName}`;
  const integrationKey = `instance:${instance.id}`;
  const taskIntegrationKey = `instance:${instance.id}`;
  const instanceDone = instance.status === "concluida" || instance.status === "cancelada";
  const dueDate = `${instance.technical_due_date}T09:00:00.000Z`;

  if (template.generates_calendar) {
    const payload = {
      title: `${template.name} · ${instance.competence_label}`,
      description: `${clientName}\nCompetência: ${instance.competence_label}`,
      entry_type: "obrigação",
      priority: instance.priority,
      sector: template.sector,
      due_at: dueDate,
      all_day: true,
      status: instanceDone ? "completed" : "pending",
      client_name: clientName,
      integration_source: "grow_obligation",
      integration_key: integrationKey,
    };

    const { data: existingEvent, error: eventLookupError } = await supabaseAdmin
      .from("calendar_events")
      .select("id")
      .eq("integration_source", "grow_obligation")
      .eq("integration_key", integrationKey)
      .maybeSingle();

    if (eventLookupError) throw eventLookupError;

    if (existingEvent?.id) {
      const { error } = await supabaseAdmin
        .from("calendar_events")
        .update(payload)
        .eq("id", existingEvent.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("calendar_events").insert(payload);
      if (error) throw error;
    }
  }

  const { data: existingTask, error: taskLookupError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id")
    .eq("integration_source", "grow_obligation_task")
    .eq("integration_task_id", taskIntegrationKey)
    .maybeSingle();

  if (taskLookupError) throw taskLookupError;

  if (!template.generates_kanban) {
    if (existingTask?.id) {
      const { error } = await supabaseAdmin
        .from("kanban_tasks")
        .delete()
        .eq("id", existingTask.id);
      if (error) throw error;
    }
    return;
  }

  const taskStatus =
    instance.status === "concluida"
      ? "done"
      : instance.status === "em_revisao"
        ? "review"
        : instance.status === "em_andamento"
          ? "doing"
          : instance.status === "atrasada"
            ? "todo"
            : "backlog";

  const taskPayload = {
    title: obligationTitle,
    description: `Obrigação Grow\nCompetência: ${instance.competence_label}`,
    sector: template.sector,
    client_name: clientName,
    assignee: instance.current_assignee,
    priority: instance.priority,
    status: taskStatus,
    due_date: instance.technical_due_date,
    integration_source: "grow_obligation_task",
    integration_task_id: taskIntegrationKey,
    integration_payload: {
      instance_id: instance.id,
      template_id: template.id,
      profile_id: instance.profile_id,
    },
  };

  if (existingTask?.id) {
    const { error } = await supabaseAdmin.from("kanban_tasks").update(taskPayload).eq("id", existingTask.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("kanban_tasks").insert(taskPayload);
  if (error) throw error;
}

async function ensureInstancesForProfiles(
  supabaseAdmin: SupabaseAdmin,
  profiles: ProfileRow[],
  templatesMap: Map<string, TemplateRow>,
  actorId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  if (profiles.length === 0) return { created: 0 };

  const profileIds = profiles.map((profile) => profile.id);
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("obligation_instances")
    .select("id, client_id, template_id, competence_key")
    .in("profile_id", profileIds);

  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existingRows || []).map((row) =>
      `${String((row as JsonRecord).client_id)}::${String((row as JsonRecord).template_id)}::${String((row as JsonRecord).competence_key)}`,
    ),
  );

  const inserts: JsonRecord[] = [];

  for (const profile of profiles) {
    if (!profile.is_active) continue;
    const template = templatesMap.get(profile.template_id);
    if (!template || !template.is_active) continue;

    const assignedStart = new Date(`${profile.start_date}T00:00:00.000Z`);
    const assignedEnd = profile.end_date ? new Date(`${profile.end_date}T00:00:00.000Z`) : null;

    const cursor = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1));
    while (cursor <= windowEnd) {
      const currentCompetenceDate = computeCompetenceDate(
        template.periodicity,
        cursor,
        template.competence_reference,
        profile.yearly_due_month_override ?? template.yearly_due_month,
      );

      const currentCompetenceKey = competenceKey(currentCompetenceDate);
      const currentCompetenceLabel = monthLabel(currentCompetenceDate);
      const currentCompetenceTime = currentCompetenceDate.getTime();

      if (currentCompetenceTime < assignedStart.getTime()) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (assignedEnd && currentCompetenceTime > assignedEnd.getTime()) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (template.periodicity === "quarterly" && ![0, 3, 6, 9].includes(currentCompetenceDate.getUTCMonth())) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (template.periodicity === "yearly" && currentCompetenceDate.getUTCMonth() !== (profile.yearly_due_month_override ?? template.yearly_due_month ?? 1) - 1) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      const uniqueKey = `${profile.client_id}::${profile.template_id}::${currentCompetenceKey}`;
      if (!existingKeys.has(uniqueKey)) {
        const technicalDueDate = computeDueDate(
          currentCompetenceDate,
          profile.due_day_override ?? template.due_day,
        );
        const legalDueDate = template.legal_due_day
          ? computeDueDate(currentCompetenceDate, profile.legal_due_day_override ?? template.legal_due_day)
          : null;

        inserts.push({
          client_id: profile.client_id,
          profile_id: profile.id,
          template_id: profile.template_id,
          competence_label: currentCompetenceLabel,
          competence_date: toIsoDate(currentCompetenceDate),
          competence_key: currentCompetenceKey,
          technical_due_date: toIsoDate(technicalDueDate),
          legal_due_date: legalDueDate ? toIsoDate(legalDueDate) : null,
          status: "pendente",
          priority: template.priority,
          current_assignee: profile.assigned_to,
          origin: "grow_native",
          document_required: template.requires_document,
          protocol_required: template.requires_protocol,
          created_by: actorId,
        });
        existingKeys.add(uniqueKey);
      }

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  if (inserts.length === 0) return { created: 0 };

  const { data: insertedInstances, error: insertError } = await supabaseAdmin
    .from("obligation_instances")
    .insert(inserts)
    .select("*");

  if (insertError) throw insertError;

  const clientsMap = await loadClientsMap(supabaseAdmin);
  for (const row of (insertedInstances || []) as InstanceRow[]) {
    const template = templatesMap.get(row.template_id);
    const client = clientsMap.get(row.client_id);
    if (!template || !client) continue;
    await createInstanceEvent(
      supabaseAdmin,
      row.id,
      actorId,
      "instance_created",
      null,
      row.status,
      `Competência ${row.competence_label} gerada automaticamente.`,
    );
    await syncInstanceArtifacts(supabaseAdmin, row, template, client.name);
  }

  return { created: inserts.length };
}

async function markOverdueInstances(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const today = toIsoDate(new Date());
  const { data: dueRows, error } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .lt("technical_due_date", today)
    .in("status", ["pendente", "em_andamento", "aguardando_documento", "em_revisao"]);

  if (error) throw error;

  const rows = (dueRows || []) as InstanceRow[];
  if (rows.length === 0) return 0;

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);

  for (const row of rows) {
    const { error: updateError } = await supabaseAdmin
      .from("obligation_instances")
      .update({ status: "atrasada", last_status_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw updateError;

    await createInstanceEvent(
      supabaseAdmin,
      row.id,
      actorId,
      "status_change",
      row.status,
      "atrasada",
      "Obrigação marcada como atrasada automaticamente.",
    );

    const template = templatesMap.get(row.template_id);
    const client = clientsMap.get(row.client_id);
    if (template && client) {
      await syncInstanceArtifacts(
        supabaseAdmin,
        { ...row, status: "atrasada" },
        template,
        client.name,
      );
    }
  }

  return rows.length;
}

async function buildOverview(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profilesMap = await loadProfilesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);

  const windowStart = new Date();
  windowStart.setUTCMonth(windowStart.getUTCMonth() - 1);
  windowStart.setUTCDate(1);
  const windowEnd = new Date();
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 2);
  windowEnd.setUTCDate(1);

  await ensureInstancesForProfiles(
    supabaseAdmin,
    Array.from(profilesMap.values()),
    templatesMap,
    actorId,
    windowStart,
    windowEnd,
  );
  await markOverdueInstances(supabaseAdmin, actorId);

  const [{ data: instancesData, error: instancesError }, { data: docsData, error: docsError }] = await Promise.all([
    supabaseAdmin
      .from("obligation_instances")
      .select("*")
      .order("technical_due_date", { ascending: true })
      .limit(240),
    supabaseAdmin
      .from("document_inbox_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  if (instancesError) throw instancesError;
  if (docsError) throw docsError;

  const templates = Array.from(templatesMap.values()).map((template) => ({
    ...template,
    expected_documents: Array.isArray(template.expected_documents) ? template.expected_documents : [],
  }));

  const profiles = Array.from(profilesMap.values()).map((profile) => ({
    ...profile,
    template: templatesMap.get(profile.template_id) || null,
    client: clientsMap.get(profile.client_id) || null,
  }));

  const instances = ((instancesData || []) as InstanceRow[]).map((instance) => ({
    ...instance,
    template: templatesMap.get(instance.template_id) || null,
    client: clientsMap.get(instance.client_id) || null,
    profile: profilesMap.get(instance.profile_id) || null,
  }));

  const documents = (docsData || []).map((item) => {
    const row = item as JsonRecord;
    return {
      ...row,
      client: clientsMap.get(String(row.client_id || row.suggested_client_id || "")) || null,
      template: templatesMap.get(String(row.suggested_template_id || "")) || null,
      linked_instance: instances.find((instance) => instance.id === String(row.linked_instance_id || row.suggested_instance_id || "")) || null,
    };
  });

  const summary = {
    templates_total: templates.length,
    templates_active: templates.filter((template) => template.is_active).length,
    active_profiles: profiles.filter((profile) => profile.is_active).length,
    pending_instances: instances.filter((instance) => instance.status === "pendente").length,
    overdue_instances: instances.filter((instance) => instance.status === "atrasada").length,
    waiting_documents: instances.filter((instance) => instance.status === "aguardando_documento").length,
    done_instances: instances.filter((instance) => instance.status === "concluida").length,
    inbox_pending: documents.filter((item) => item.status === "pending_review").length,
  };

  return {
    ok: true,
    summary,
    clients: Array.from(clientsMap.values()),
    templates,
    profiles,
    instances,
    documents,
  };
}

async function handleUpsertTemplate(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
  payload: JsonRecord,
) {
  if (!roles.some((role) => templateManagerRoles.has(role))) {
    return jsonResponse({ error: "Only admin, director, or manager can manage templates" }, 403);
  }

  const id = asTrimmedString(payload.id);
  const name = asTrimmedString(payload.name);
  const codeSource = asTrimmedString(payload.code) || name;
  if (!name || !codeSource) {
    return jsonResponse({ error: "Nome e código da obrigação são obrigatórios." }, 400);
  }

  const row = {
    code: normalizeTemplateCode(codeSource),
    name,
    sector: asTrimmedString(payload.sector) || "Geral",
    periodicity: asTrimmedString(payload.periodicity) || "monthly",
    competence_reference: asTrimmedString(payload.competence_reference) || "vigente",
    due_day: asInteger(payload.due_day, 10),
    yearly_due_month: asInteger(payload.yearly_due_month, null),
    legal_due_day: asInteger(payload.legal_due_day, null),
    priority: asTrimmedString(payload.priority) || "media",
    expected_documents: asStringArray(payload.expected_documents),
    is_active: asBoolean(payload.is_active, true),
    generates_calendar: asBoolean(payload.generates_calendar, true),
    generates_kanban: asBoolean(payload.generates_kanban, false),
    requires_protocol: asBoolean(payload.requires_protocol, false),
    requires_document: asBoolean(payload.requires_document, true),
    operational_notes: asTrimmedString(payload.operational_notes),
    created_by: actorId,
  };

  const query = id
    ? supabaseAdmin.from("obligation_templates").update(row).eq("id", id).select("*").single()
    : supabaseAdmin.from("obligation_templates").insert(row).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ ok: true, template: data });
}

async function handleUpsertProfile(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const id = asTrimmedString(payload.id);
  const clientId = asTrimmedString(payload.client_id);
  const templateId = asTrimmedString(payload.template_id);
  if (!clientId || !templateId) {
    return jsonResponse({ error: "Cliente e obrigação são obrigatórios." }, 400);
  }

  const row = {
    client_id: clientId,
    template_id: templateId,
    assigned_to: asTrimmedString(payload.assigned_to),
    start_date: asTrimmedString(payload.start_date) || toIsoDate(new Date()),
    end_date: asTrimmedString(payload.end_date),
    is_active: asBoolean(payload.is_active, true),
    due_day_override: asInteger(payload.due_day_override, null),
    yearly_due_month_override: asInteger(payload.yearly_due_month_override, null),
    legal_due_day_override: asInteger(payload.legal_due_day_override, null),
    expected_documents_override: asStringArray(payload.expected_documents_override),
    notes: asTrimmedString(payload.notes),
    parameters: asRecord(payload.parameters) || {},
    created_by: actorId,
  };

  const query = id
    ? supabaseAdmin.from("client_obligation_profiles").update(row).eq("id", id).select("*").single()
    : supabaseAdmin.from("client_obligation_profiles").upsert(row, { onConflict: "client_id,template_id" }).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profile = data as ProfileRow;
  await ensureInstancesForProfiles(
    supabaseAdmin,
    [profile],
    templatesMap,
    actorId,
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)),
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 2, 1)),
  );

  return jsonResponse({ ok: true, profile: data });
}

async function handleGenerateInstances(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);
  const monthsBack = Math.max(0, asInteger(payload.months_back, 1) || 1);
  const monthsForward = Math.max(0, asInteger(payload.months_forward, 2) || 2);

  let profilesQuery = supabaseAdmin.from("client_obligation_profiles").select("*").eq("is_active", true);
  if (clientId) profilesQuery = profilesQuery.eq("client_id", clientId);

  const { data: profilesData, error: profilesError } = await profilesQuery;
  if (profilesError) return jsonResponse({ error: profilesError.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  start.setUTCDate(1);
  const end = new Date();
  end.setUTCMonth(end.getUTCMonth() + monthsForward);
  end.setUTCDate(1);

  const result = await ensureInstancesForProfiles(
    supabaseAdmin,
    (profilesData || []) as ProfileRow[],
    templatesMap,
    actorId,
    start,
    end,
  );

  return jsonResponse({ ok: true, created_instances: result.created });
}

async function handleUpdateInstance(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) return jsonResponse({ error: "Instância obrigatória." }, 400);

  const { data: currentData, error: currentError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("id", instanceId)
    .single();

  if (currentError || !currentData) {
    return jsonResponse({ error: "Instância não encontrada." }, 404);
  }

  const current = currentData as InstanceRow;
  const nextStatus = asTrimmedString(payload.status) || current.status;
  const updates = {
    status: nextStatus,
    priority: asTrimmedString(payload.priority) || current.priority,
    current_assignee: asTrimmedString(payload.current_assignee) ?? current.current_assignee,
    protocol: asTrimmedString(payload.protocol) ?? current.protocol,
    completion_notes: asTrimmedString(payload.completion_notes) ?? current.completion_notes,
    completed_at: nextStatus === "concluida" ? new Date().toISOString() : null,
    last_status_at: current.status !== nextStatus ? new Date().toISOString() : current.updated_at,
  };

  const { data: updatedData, error: updateError } = await supabaseAdmin
    .from("obligation_instances")
    .update(updates)
    .eq("id", instanceId)
    .select("*")
    .single();

  if (updateError || !updatedData) {
    return jsonResponse({ error: updateError?.message || "Falha ao atualizar instância." }, 400);
  }

  const updated = updatedData as InstanceRow;
  await createInstanceEvent(
    supabaseAdmin,
    updated.id,
    actorId,
    "status_change",
    current.status,
    updated.status,
    asTrimmedString(payload.event_comment),
  );

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const template = templatesMap.get(updated.template_id);
  const client = clientsMap.get(updated.client_id);
  if (template && client) {
    await syncInstanceArtifacts(supabaseAdmin, updated, template, client.name);
  }

  return jsonResponse({ ok: true, instance: updated });
}

async function handleRegisterDocumentUpload(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  const storagePath = asTrimmedString(payload.storage_path);
  const storageBucket = asTrimmedString(payload.storage_bucket) || "obligation-files";
  if (!fileName || !storagePath) {
    return jsonResponse({ error: "Arquivo e caminho de storage são obrigatórios." }, 400);
  }

  const providedInstanceId = asTrimmedString(payload.instance_id);
  const clientId = asTrimmedString(payload.client_id);
  const templateId = asTrimmedString(payload.template_id);
  const suggestedCompetenceLabel = asTrimmedString(payload.suggested_competence_label);

  let resolvedInstanceId = providedInstanceId;
  let confidence = providedInstanceId ? 1 : 0.45;

  if (!resolvedInstanceId && clientId && templateId && suggestedCompetenceLabel) {
    const normalizedCompetenceKey = normalizeToken(suggestedCompetenceLabel).replace(/_/g, "-");
    const { data: exactInstances, error: instanceLookupError } = await supabaseAdmin
      .from("obligation_instances")
      .select("id")
      .eq("client_id", clientId)
      .eq("template_id", templateId)
      .or(`competence_label.eq.${suggestedCompetenceLabel},competence_key.eq.${normalizedCompetenceKey}`);

    if (instanceLookupError) throw instanceLookupError;

    if ((exactInstances || []).length === 1) {
      resolvedInstanceId = String((exactInstances?.[0] as JsonRecord).id);
      confidence = 0.9;
    }
  }

  const inboxRow = {
    client_id: clientId,
    suggested_client_id: clientId,
    suggested_template_id: templateId,
    suggested_instance_id: resolvedInstanceId,
    linked_instance_id: resolvedInstanceId,
    file_name: fileName,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    content_type: asTrimmedString(payload.content_type),
    file_size: asInteger(payload.file_size, null),
    suggested_competence_label: suggestedCompetenceLabel,
    identification_confidence: confidence,
    status: resolvedInstanceId ? "linked" : "pending_review",
    blocking_reason: resolvedInstanceId ? null : "Aguardando validação humana para vincular o arquivo.",
    notes: asTrimmedString(payload.notes),
    created_by: actorId,
    reviewed_by: resolvedInstanceId ? actorId : null,
    reviewed_at: resolvedInstanceId ? new Date().toISOString() : null,
  };

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .insert(inboxRow)
    .select("*")
    .single();

  if (inboxError || !inboxItem) {
    return jsonResponse({ error: inboxError?.message || "Falha ao registrar documento." }, 400);
  }

  if (resolvedInstanceId) {
    const { error: fileError } = await supabaseAdmin
      .from("obligation_instance_files")
      .insert({
        instance_id: resolvedInstanceId,
        inbox_item_id: String((inboxItem as JsonRecord).id),
        file_name: fileName,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        content_type: asTrimmedString(payload.content_type),
        file_size: asInteger(payload.file_size, null),
        triage_status: "accepted",
        source: "manual_upload",
        uploaded_by: actorId,
        identification_confidence: confidence,
      });

    if (fileError) throw fileError;
  }

  return jsonResponse({ ok: true, inbox_item: inboxItem });
}

async function handleResolveDocument(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const inboxItemId = asTrimmedString(payload.inbox_item_id);
  const decision = asTrimmedString(payload.decision);
  if (!inboxItemId || !decision) {
    return jsonResponse({ error: "Documento e decisão são obrigatórios." }, 400);
  }

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .select("*")
    .eq("id", inboxItemId)
    .single();

  if (inboxError || !inboxItem) {
    return jsonResponse({ error: "Documento não encontrado." }, 404);
  }

  if (decision === "reject") {
    const { error } = await supabaseAdmin
      .from("document_inbox_items")
      .update({
        status: "rejected",
        blocking_reason: asTrimmedString(payload.blocking_reason) || "Documento rejeitado manualmente.",
        notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", inboxItemId);

    if (error) throw error;
    return jsonResponse({ ok: true });
  }

  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) {
    return jsonResponse({ error: "Selecione a instância de obrigação para vincular o documento." }, 400);
  }

  const { error: inboxUpdateError } = await supabaseAdmin
    .from("document_inbox_items")
    .update({
      status: "linked",
      linked_instance_id: instanceId,
      blocking_reason: null,
      notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", inboxItemId);

  if (inboxUpdateError) throw inboxUpdateError;

  const { error: fileError } = await supabaseAdmin
    .from("obligation_instance_files")
    .upsert({
      instance_id: instanceId,
      inbox_item_id: inboxItemId,
      file_name: asTrimmedString((inboxItem as JsonRecord).file_name),
      storage_bucket: asTrimmedString((inboxItem as JsonRecord).storage_bucket) || "obligation-files",
      storage_path: asTrimmedString((inboxItem as JsonRecord).storage_path),
      content_type: asTrimmedString((inboxItem as JsonRecord).content_type),
      file_size: asInteger((inboxItem as JsonRecord).file_size, null),
      triage_status: "reviewed",
      source: "manual_review",
      uploaded_by: actorId,
      identification_confidence: Number((inboxItem as JsonRecord).identification_confidence || 1),
    }, { onConflict: "storage_bucket,storage_path" });

  if (fileError) throw fileError;

  return jsonResponse({ ok: true });
}

async function handleClientSnapshot(supabaseAdmin: SupabaseAdmin, actorId: string, clientId: string) {
  const overview = await buildOverview(supabaseAdmin, actorId);
  return jsonResponse({
    ok: true,
    client_id: clientId,
    profiles: overview.profiles.filter((profile) => String((profile.client || {}).id || profile.client_id) === clientId),
    instances: overview.instances.filter((instance) => String((instance.client || {}).id || instance.client_id) === clientId),
    templates: overview.templates,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authContext = await buildAuthContext(req);
    if ("error" in authContext) return authContext.error;

    const { supabaseAdmin, user, roles } = authContext;
    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) return jsonResponse({ error: "Invalid payload" }, 400);

    const action = asTrimmedString(payload.action);
    if (!action) return jsonResponse({ error: "Action is required" }, 400);

    if (action === "overview") {
      return jsonResponse(await buildOverview(supabaseAdmin, user.id));
    }

    if (action === "upsert_template") {
      return await handleUpsertTemplate(supabaseAdmin, user.id, roles, payload);
    }

    if (action === "upsert_profile") {
      return await handleUpsertProfile(supabaseAdmin, user.id, payload);
    }

    if (action === "generate_instances") {
      return await handleGenerateInstances(supabaseAdmin, user.id, payload);
    }

    if (action === "update_instance") {
      return await handleUpdateInstance(supabaseAdmin, user.id, payload);
    }

    if (action === "register_document_upload") {
      return await handleRegisterDocumentUpload(supabaseAdmin, user.id, payload);
    }

    if (action === "resolve_document") {
      return await handleResolveDocument(supabaseAdmin, user.id, payload);
    }

    if (action === "list_client_snapshot") {
      const clientId = asTrimmedString(payload.client_id);
      if (!clientId) return jsonResponse({ error: "Client id is required" }, 400);
      return await handleClientSnapshot(supabaseAdmin, user.id, clientId);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
