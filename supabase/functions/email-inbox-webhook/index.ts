import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-inbox-webhook-secret, x-webhook-secret",
};

type JsonRecord = Record<string, unknown>;

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

function normalizeEmail(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;

  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return null;

  return match[0].toLowerCase();
}

function normalizeEmailList(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((entry) => normalizeEmailList(entry))
          .filter((email): email is string => Boolean(email)),
      ),
    );
  }

  const record = asRecord(value);
  if (record) {
    return Array.from(
      new Set(
        [record.email, record.address, record.value]
          .map((entry) => normalizeEmail(entry))
          .filter((email): email is string => Boolean(email)),
      ),
    );
  }

  const text = asTrimmedString(value);
  if (!text) return [];

  return Array.from(
    new Set(
      text
        .split(/[,;]+/)
        .map((entry) => normalizeEmail(entry))
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

function getWebhookSecret(req: Request) {
  const headerSecret = req.headers.get("x-inbox-webhook-secret") || req.headers.get("x-webhook-secret");
  if (headerSecret) return headerSecret.trim();

  const querySecret = new URL(req.url).searchParams.get("secret");
  if (querySecret) return querySecret.trim();

  return null;
}

function toIsoTimestamp(value: unknown): string {
  const maybe = asTrimmedString(value);
  if (!maybe) return new Date().toISOString();

  const parsed = new Date(maybe);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();

  return parsed.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
    }

    const configuredSecret = asTrimmedString(Deno.env.get("INBOX_WEBHOOK_SECRET"));
    if (configuredSecret) {
      const providedSecret = getWebhookSecret(req);
      if (!providedSecret || providedSecret !== configuredSecret) {
        return jsonResponse({ error: "Unauthorized webhook call" }, 401);
      }
    }

    const rawPayload = await req.json();
    const payload = asRecord(rawPayload);

    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const envelope = asRecord(payload.envelope);
    const recipients = Array.from(
      new Set([
        ...normalizeEmailList(payload.to),
        ...normalizeEmailList(payload.recipient),
        ...normalizeEmailList(payload.recipients),
        ...normalizeEmailList(envelope?.to),
      ]),
    );

    const sender =
      normalizeEmail(payload.from) ||
      normalizeEmail(payload.from_email) ||
      normalizeEmail(payload.sender) ||
      normalizeEmail(envelope?.from);

    if (!sender || recipients.length === 0) {
      return jsonResponse({ error: "from and at least one recipient are required" }, 400);
    }

    const subject =
      asTrimmedString(payload.subject) ||
      asTrimmedString(payload.title) ||
      "(sem assunto)";

    const textContent =
      asTrimmedString(payload.text) ||
      asTrimmedString(payload.text_body) ||
      asTrimmedString(payload.plain) ||
      null;

    const htmlContent =
      asTrimmedString(payload.html) ||
      asTrimmedString(payload.html_body) ||
      null;

    const preview =
      asTrimmedString(payload.preview) ||
      asTrimmedString(payload.snippet) ||
      (textContent ? textContent.slice(0, 280) : null);

    const provider = asTrimmedString(payload.provider) || "generic_webhook";
    const providerMessageId =
      asTrimmedString(payload.provider_message_id) ||
      asTrimmedString(payload.message_id) ||
      asTrimmedString(payload.id) ||
      null;

    const receivedAt = toIsoTimestamp(payload.received_at ?? payload.date ?? payload.timestamp);

    const rows = recipients.map((recipient) => ({
      to_email: recipient,
      from_email: sender,
      subject,
      preview,
      text_content: textContent,
      html_content: htmlContent,
      provider,
      provider_message_id: providerMessageId,
      source_payload: payload,
      received_at: receivedAt,
    }));

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const query = providerMessageId
      ? supabaseAdmin.from("email_inbox_messages").upsert(rows, {
          onConflict: "provider,provider_message_id,to_email",
          ignoreDuplicates: false,
        })
      : supabaseAdmin.from("email_inbox_messages").insert(rows);

    const { error } = await query;

    if (error) {
      throw error;
    }

    return jsonResponse({
      ok: true,
      inserted: rows.length,
      inboxes: recipients,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Unknown error";

    return jsonResponse({ error: message }, 400);
  }
});
