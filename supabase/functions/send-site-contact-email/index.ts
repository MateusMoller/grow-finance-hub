const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const email = asTrimmedString(value)?.toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmailViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (response.ok) {
    return { ok: true as const };
  }

  const responseText = await response.text();
  return {
    ok: false as const,
    status: response.status,
    message: responseText || "Unknown provider error",
  };
}

function buildEmailHtml(params: {
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  message: string;
  originPage: string | null;
}) {
  return `
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 12px;font-size:12px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Novo contato via site</p>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;">Lead enviado pelo formulário de contato</h1>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:bold;">Nome</td><td style="padding:8px 0;">${escapeHtml(params.fullName)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Empresa</td><td style="padding:8px 0;">${escapeHtml(params.companyName || "-")}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">E-mail</td><td style="padding:8px 0;">${escapeHtml(params.email)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Telefone</td><td style="padding:8px 0;">${escapeHtml(params.phone || "-")}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Origem</td><td style="padding:8px 0;">${escapeHtml(params.originPage || "contact")}</td></tr>
          <tr><td style="padding:8px 0 6px;font-weight:bold;vertical-align:top;">Mensagem</td><td style="padding:8px 0 6px;white-space:pre-line;">${escapeHtml(params.message)}</td></tr>
        </table>
      </div>
    </div>
  `;
}

function buildEmailText(params: {
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  message: string;
  originPage: string | null;
}) {
  return [
    "Novo contato via site",
    "",
    `Nome: ${params.fullName}`,
    `Empresa: ${params.companyName || "-"}`,
    `E-mail: ${params.email}`,
    `Telefone: ${params.phone || "-"}`,
    `Origem: ${params.originPage || "contact"}`,
    "",
    "Mensagem:",
    params.message,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail =
      asTrimmedString(Deno.env.get("SITE_CONTACT_FROM_EMAIL")) ||
      asTrimmedString(Deno.env.get("NEWSLETTER_FROM_EMAIL")) ||
      "Grow Contabilidade <contato@contabilidadegrow.com.br>";
    const recipientEmail =
      asTrimmedString(Deno.env.get("SITE_CONTACT_TO_EMAIL")) ||
      "contato@contabilidadegrow.com.br";

    if (!resendApiKey) {
      return jsonResponse({ error: "Missing RESEND_API_KEY environment variable" }, 500);
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const fullName = asTrimmedString(payload.fullName);
    const companyName = asTrimmedString(payload.companyName);
    const email = normalizeEmail(payload.email);
    const phone = asTrimmedString(payload.phone);
    const message = asTrimmedString(payload.message);
    const originPage = asTrimmedString(payload.originPage);

    if (!fullName) {
      return jsonResponse({ error: "fullName is required" }, 400);
    }

    if (!email) {
      return jsonResponse({ error: "A valid email is required" }, 400);
    }

    if (!message) {
      return jsonResponse({ error: "message is required" }, 400);
    }

    const subject = `Novo contato do site | ${fullName}`;
    const htmlBody = buildEmailHtml({ fullName, companyName, email, phone, message, originPage });
    const textBody = buildEmailText({ fullName, companyName, email, phone, message, originPage });

    const sendResult = await sendEmailViaResend({
      apiKey: resendApiKey,
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (!sendResult.ok) {
      return jsonResponse(
        {
          error: "Failed to send e-mail notification",
          provider_status: sendResult.status,
          provider_message: sendResult.message,
        },
        502,
      );
    }

    return jsonResponse({ ok: true });
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
