import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-token, x-conecta-token",
};

type JsonRecord = Record<string, unknown>;

const validSectors = [
  "Contabil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societario",
  "Geral",
] as const;

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function getPathValue(source: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[part];
  }
  return current;
}

function pickFirstString(source: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPathValue(source, path);
    const normalized = asTrimmedString(value);
    if (normalized) return normalized;
  }
  return null;
}

function pickFirstPersonName(source: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPathValue(source, path);
    const asString = asTrimmedString(value);
    if (asString) return asString;

    const obj = asRecord(value);
    if (!obj) continue;
    const name =
      asTrimmedString(obj.name) ||
      asTrimmedString(obj.full_name) ||
      asTrimmedString(obj.display_name);
    if (name) return name;
  }
  return null;
}

function pickFirstStringArray(source: unknown, paths: string[]): string[] {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (Array.isArray(value)) {
      const parsed = value
        .map((item) => (typeof item === "string" ? item.trim() : null))
        .filter((item): item is string => Boolean(item));
      if (parsed.length > 0) return parsed;
    }

    const asString = asTrimmedString(value);
    if (asString) {
      const parsed = asString
        .split(/[;,|]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

function normalizePriority(value: string | null): string {
  const token = normalizeToken(value || "");
  if (token.includes("urgent") || token.includes("critic")) return "Urgente";
  if (token === "p1" || token.includes("high") || token.includes("alta")) return "Alta";
  if (token === "p3" || token.includes("low") || token.includes("baixa")) return "Baixa";
  return "Media";
}

function normalizeStatus(value: string | null): string {
  const token = normalizeToken(value || "");

  if (
    token.includes("done") ||
    token.includes("complete") ||
    token.includes("conclu") ||
    token.includes("close") ||
    token.includes("resolv") ||
    token.includes("final")
  ) {
    return "done";
  }

  if (token.includes("review") || token.includes("revis") || token.includes("qa")) {
    return "review";
  }

  if (
    token.includes("doing") ||
    token.includes("progress") ||
    token.includes("andamento") ||
    token.includes("in_work") ||
    token.includes("in_progress")
  ) {
    return "doing";
  }

  if (
    token.includes("backlog") ||
    token.includes("triage") ||
    token.includes("fila") ||
    token.includes("queued")
  ) {
    return "backlog";
  }

  return "todo";
}

function normalizeSector(value: string | null): string {
  if (!value) return "Geral";
  const normalized = normalizeToken(value);

  if (normalized.includes("contabil")) return "Contabil";
  if (normalized.includes("fiscal")) return "Fiscal";
  if (
    normalized.includes("pessoal") ||
    normalized.includes("rh") ||
    normalized.includes("humanos")
  ) {
    return "Departamento Pessoal";
  }
  if (normalized.includes("finance")) return "Financeiro";
  if (normalized.includes("comercial") || normalized.includes("vendas")) return "Comercial";
  if (normalized.includes("societ")) return "Societario";

  const direct = validSectors.find(
    (sector) => normalizeToken(sector) === normalizeToken(value),
  );
  return direct || "Geral";
}

function normalizeDueDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function extractTaskPayload(payload: JsonRecord): JsonRecord {
  const candidates = [
    getPathValue(payload, "task"),
    getPathValue(payload, "data.task"),
    getPathValue(payload, "data"),
    getPathValue(payload, "payload.task"),
    getPathValue(payload, "payload"),
    getPathValue(payload, "card"),
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) return record;
  }

  return payload;
}

function extractEventName(payload: JsonRecord): string | null {
  return pickFirstString(payload, [
    "event",
    "event_type",
    "eventName",
    "type",
    "action",
    "topic",
    "trigger",
  ]);
}

function isTaskLikePayload(payload: JsonRecord): boolean {
  return Boolean(
    pickFirstString(payload, [
      "title",
      "name",
      "task_name",
      "subject",
      "description",
      "status",
      "priority",
    ]),
  );
}

function shouldIgnoreEvent(eventName: string | null): boolean {
  if (!eventName) return false;
  const token = normalizeToken(eventName);
  const isTaskContext = token.includes("task") || token.includes("tarefa") || token.includes("card");
  if (!isTaskContext) return true;
  if (token.includes("delete") || token.includes("remove")) return true;
  return false;
}

function buildDescription(task: JsonRecord, payload: JsonRecord): string | null {
  const description =
    pickFirstString(task, ["description", "details", "content", "body", "message"]) ||
    pickFirstString(payload, ["description", "details", "content"]);

  const notes =
    pickFirstString(task, ["notes", "note", "observations", "obs"]) ||
    pickFirstString(payload, ["notes", "note"]);
  const externalLink =
    pickFirstString(task, ["url", "link", "task_url"]) ||
    pickFirstString(payload, ["url", "link"]);

  const extras: string[] = [];
  if (notes && notes !== description) extras.push(`Observacoes: ${notes}`);
  if (externalLink) extras.push(`Link origem: ${externalLink}`);
  if (extras.length === 0) return description || null;

  return [description || "", "", ...extras].filter(Boolean).join("\n");
}

function parseAuthToken(req: Request): string | null {
  const bearer = req.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice(7).trim();
    if (token) return token;
  }

  const headerToken = req.headers.get("x-api-token") || req.headers.get("x-conecta-token");
  if (headerToken?.trim()) return headerToken.trim();

  const urlToken = new URL(req.url).searchParams.get("token");
  if (urlToken?.trim()) return urlToken.trim();

  return null;
}

function isMissingColumnError(message: string | undefined, columnName: string) {
  if (!message) return false;
  const msg = message.toLowerCase();
  return msg.includes("column") && msg.includes(columnName.toLowerCase());
}

async function resolveIntegrationUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  token: string,
) {
  const modern = await supabaseAdmin
    .from("user_settings")
    .select("user_id")
    .eq("api_access", true)
    .eq("api_token", token)
    .limit(1)
    .maybeSingle();

  if (!modern.error && modern.data?.user_id) {
    return modern.data.user_id as string;
  }

  const modernHasMissingColumns =
    Boolean(modern.error) &&
    (isMissingColumnError(modern.error?.message, "api_access") ||
      isMissingColumnError(modern.error?.message, "api_token"));

  if (modern.error && !modernHasMissingColumns) {
    throw modern.error;
  }

  const shouldTryLegacy = modernHasMissingColumns || (!modern.error && !modern.data);
  if (!shouldTryLegacy) return null;

  const legacy = await supabaseAdmin
    .from("user_settings")
    .select("user_id")
    .eq("integrations_api_access", true)
    .eq("integrations_api_token", token)
    .limit(1)
    .maybeSingle();

  const legacyHasMissingColumns =
    Boolean(legacy.error) &&
    (isMissingColumnError(legacy.error?.message, "integrations_api_access") ||
      isMissingColumnError(legacy.error?.message, "integrations_api_token"));

  if (legacyHasMissingColumns) return null;

  if (legacy.error) {
    throw legacy.error;
  }

  return (legacy.data?.user_id as string | undefined) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const token = parseAuthToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing API token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const integrationUserId = await resolveIntegrationUser(supabaseAdmin, token);

    if (!integrationUserId) {
      return new Response(JSON.stringify({ error: "Invalid API token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid payload body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventName = extractEventName(payload);
    if (shouldIgnoreEvent(eventName)) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "event_not_supported" }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const task = extractTaskPayload(payload);
    if (!isTaskLikePayload(task)) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "not_a_task_payload" }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let externalTaskId =
      pickFirstString(task, [
        "id",
        "task_id",
        "external_id",
        "card_id",
        "ticket_id",
        "uuid",
        "gid",
      ]) ||
      pickFirstString(payload, ["task_id", "external_task_id", "data.id", "id"]);

    if (!externalTaskId) {
      const hash = await sha256Hex(JSON.stringify(task));
      externalTaskId = `auto_${hash.slice(0, 24)}`;
    }

    const title =
      pickFirstString(task, ["title", "task_name", "name", "subject"]) ||
      `Tarefa Conecta Chat ${externalTaskId.slice(0, 8)}`;

    const clientName = pickFirstPersonName(task, [
      "client_name",
      "customer_name",
      "contact_name",
      "lead_name",
      "client",
      "customer",
      "contact",
    ]);

    const assignee = pickFirstPersonName(task, [
      "assignee_name",
      "assignee",
      "owner_name",
      "owner",
      "agent_name",
      "agent",
      "responsible_name",
      "responsible",
    ]);

    const priority = normalizePriority(
      pickFirstString(task, ["priority", "priority_name", "severity", "importance"]),
    );
    const status = normalizeStatus(
      pickFirstString(task, ["status", "status_name", "stage", "column", "phase"]),
    );
    const sector = normalizeSector(
      pickFirstString(task, ["sector", "department", "area", "queue", "team", "category"]),
    );
    const dueDate = normalizeDueDate(
      pickFirstString(task, ["due_date", "due_at", "deadline", "expires_at", "date_limit"]),
    );

    const tags = Array.from(
      new Set([
        ...pickFirstStringArray(task, ["tags", "labels", "categories", "departments"]),
        sector,
        "Conecta Chat",
      ]),
    );

    const description = buildDescription(task, payload);

    const { data: taskRow, error: upsertError } = await supabaseAdmin
      .from("kanban_tasks")
      .upsert(
        {
          title,
          description,
          client_name: clientName,
          assignee,
          priority,
          sector,
          status,
          due_date: dueDate,
          tags,
          created_by: integrationUserId,
          integration_source: "conecta_chat",
          integration_task_id: externalTaskId,
          integration_payload: payload,
        },
        {
          onConflict: "integration_source,integration_task_id",
        },
      )
      .select("id, title, status, priority, sector, updated_at")
      .maybeSingle();

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        event: eventName || "task.created",
        integration_source: "conecta_chat",
        external_task_id: externalTaskId,
        kanban_task: taskRow,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? ((error as { message: string }).message || "Unknown error")
        : "Unknown error";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
