import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof createClient>;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asExpectedDocuments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => Boolean(item))
    .map((item) => {
      const label = asTrimmedString(item.label) || asTrimmedString(item.document_type_key) || "Documento";
      return {
        document_type_key: asTrimmedString(item.document_type_key) || label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        active: item.active !== false,
        required: item.required !== false,
      };
    });
}

async function createInstanceEvent(
  supabaseAdmin: SupabaseAdmin,
  instanceId: string,
  actorId: string | null,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  comment: string,
  metadata: JsonRecord = {},
) {
  await supabaseAdmin.from("obligation_instance_events").insert({
    instance_id: instanceId,
    created_by: actorId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    comment,
    metadata,
  });
}

async function determineNextStatus(supabaseAdmin: SupabaseAdmin, instance: JsonRecord, template: JsonRecord) {
  const currentStatus = asTrimmedString(instance.status);
  if (currentStatus === "concluida" || currentStatus === "cancelada") return currentStatus;

  const requiredDocuments = asExpectedDocuments(template.expected_documents)
    .filter((document) => document.active && document.required)
    .map((document) => document.document_type_key);

  if (requiredDocuments.length === 0) return "concluida";

  const { data, error } = await supabaseAdmin
    .from("document_inbox_items")
    .select("document_type_key")
    .eq("linked_instance_id", instance.id)
    .eq("status", "linked");
  if (error) throw error;

  const received = new Set((data || []).map((row) => asTrimmedString((row as JsonRecord).document_type_key)).filter(Boolean));
  return requiredDocuments.every((documentTypeKey) => received.has(documentTypeKey))
    ? "concluida"
    : currentStatus === "atrasada" ? "atrasada" : "aguardando_documento";
}

async function processInboxItem(supabaseAdmin: SupabaseAdmin, inboxItem: JsonRecord, processorUserId: string) {
  const now = new Date().toISOString();
  const instanceId = asTrimmedString(inboxItem.linked_instance_id);
  if (!instanceId) return { processed: false, reason: "missing_instance" };

  const { data: instance, error: instanceError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("id", instanceId)
    .single();
  if (instanceError || !instance) throw instanceError || new Error("Instancia nao encontrada.");

  const instanceRecord = instance as JsonRecord;
  const { data: template, error: templateError } = await supabaseAdmin
    .from("obligation_templates")
    .select("*")
    .eq("id", instanceRecord.template_id)
    .single();
  if (templateError || !template) throw templateError || new Error("Template nao encontrado.");

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, email")
    .eq("id", instanceRecord.client_id)
    .single();
  if (clientError || !client) throw clientError || new Error("Cliente nao encontrado.");

  await supabaseAdmin.from("obligation_instance_files").upsert({
    organization_id: inboxItem.organization_id,
    instance_id: instanceId,
    inbox_item_id: inboxItem.id,
    file_name: inboxItem.file_name,
    storage_bucket: inboxItem.storage_bucket,
    storage_path: inboxItem.storage_path,
    content_type: inboxItem.content_type,
    file_size: inboxItem.file_size,
    triage_status: "reviewed",
    source: asTrimmedString(inboxItem.matched_by) || "manual_review",
    source_kind: asTrimmedString(inboxItem.source_kind) || "web_manual",
    uploaded_by: inboxItem.created_by || processorUserId,
    identification_confidence: Number(inboxItem.match_score || inboxItem.identification_confidence || 1),
    publication_status: "pending",
  }, { onConflict: "storage_bucket,storage_path" });

  const documentStatus = await determineNextStatus(supabaseAdmin, instanceRecord, template as JsonRecord);
  const deliveryRequired = documentStatus === "concluida" && template.completion_email_enabled === true;
  const nextStatus = deliveryRequired ? "pronto_para_envio" : documentStatus;
  const justCompleted = nextStatus === "concluida" && instanceRecord.status !== "concluida";
  const justReadyForDelivery = nextStatus === "pronto_para_envio" && instanceRecord.status !== "pronto_para_envio";
  const protocolNumber = justCompleted ? (instanceRecord.protocol || `GROW-${String(inboxItem.id).slice(0, 8).toUpperCase()}`) : instanceRecord.protocol;
  const protocolIssuedAt = justCompleted ? now : instanceRecord.protocol_issued_at;

  if (nextStatus !== instanceRecord.status || (justCompleted && !instanceRecord.protocol) || justReadyForDelivery) {
    await supabaseAdmin
      .from("obligation_instances")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "concluida" ? now : null,
        protocol: nextStatus === "concluida" ? protocolNumber : instanceRecord.protocol,
        protocol_issued_at: nextStatus === "concluida" ? protocolIssuedAt : instanceRecord.protocol_issued_at,
        completed_by_inbox_item_id: nextStatus === "concluida" ? inboxItem.id : instanceRecord.completed_by_inbox_item_id,
        processed_automatically: nextStatus === "concluida" ? true : instanceRecord.processed_automatically,
        ready_for_delivery_at: nextStatus === "pronto_para_envio" ? now : null,
        last_status_at: now,
      })
      .eq("id", instanceId);

    await createInstanceEvent(
      supabaseAdmin,
      instanceId,
      processorUserId,
      "status_change",
      asTrimmedString(instanceRecord.status),
      nextStatus,
      deliveryRequired
        ? "Documentos obrigatorios anexados. Aguardando confirmacao humana para envio ao cliente."
        : "Status ajustado apos recebimento do documento.",
      { inbox_item_id: inboxItem.id, protocol_number: protocolNumber, delivery_required: deliveryRequired },
    );
  }

  const communicationStatus = deliveryRequired ? "pending" : "not_applicable";

  await supabaseAdmin
    .from("document_inbox_items")
    .update({
      processing_status: "processed",
      processing_completed_at: now,
      execution_status: "applied",
      application_status: "applied",
      communication_status: communicationStatus,
      publication_status: deliveryRequired ? "pending" : "published",
      execution_notes: deliveryRequired
        ? "Documento anexado. Obrigacao pronta para revisao e envio manual ao cliente."
        : justCompleted
          ? "Documento anexado e obrigacao concluida automaticamente."
        : "Documento anexado. A obrigacao ainda aguarda outros documentos obrigatorios.",
      last_processing_error: null,
      processed_automatically: true,
      protocol_number: protocolNumber,
      protocol_issued_at: protocolIssuedAt,
    })
    .eq("id", inboxItem.id);

  await supabaseAdmin
    .from("document_ingestion_jobs")
    .update({
      status: "completed",
      application_status: "applied",
      communication_status: communicationStatus,
      publication_status: deliveryRequired ? "pending" : "published",
      completed_at: now,
      last_error: null,
      protocol_number: protocolNumber,
      protocol_issued_at: protocolIssuedAt,
      review_required: false,
    })
    .eq("id", inboxItem.ingestion_job_id);

  return { processed: true, nextStatus, deliveryRequired };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase env vars are missing." }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({})) as JsonRecord;
    const organizationId = asTrimmedString(payload.organization_id);
    if (!organizationId) return jsonResponse({ error: "organization_id is required." }, 400);

    const limit = Math.min(50, Math.max(1, Number(payload.limit || 20)));
    const inboxItemId = asTrimmedString(payload.inbox_item_id);
    let query = supabaseAdmin
      .from("document_inbox_items")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "linked")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (inboxItemId) {
      query = query.eq("id", inboxItemId);
    } else {
      query = query.in("processing_status", ["queued", "failed"]);
    }

    const { data, error } = await query;
    if (error) return jsonResponse({ error: error.message }, 400);

    const results = [];
    for (const row of data || []) {
      try {
        results.push({
          inbox_item_id: row.id,
          result: await processInboxItem(supabaseAdmin, row as JsonRecord, userData.user.id),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected processing error";
        await supabaseAdmin
          .from("document_inbox_items")
          .update({
            processing_status: "failed",
            execution_status: "failed",
            application_status: "failed",
            last_processing_error: message,
            processing_completed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ inbox_item_id: row.id, result: { processed: false, reason: message } });
      }
    }

    return jsonResponse({ ok: true, processed: results.filter((item) => item.result.processed).length, total: results.length, results });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
