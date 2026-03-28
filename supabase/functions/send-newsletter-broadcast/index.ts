import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtmlParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin: 0 0 14px; line-height: 1.6;">${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function buildNewsletterHtml(title: string, excerpt: string | null, content: string) {
  const safeTitle = escapeHtml(title);
  const summary = excerpt ? `<p style="margin: 0 0 18px; color: #475569; line-height: 1.6;">${escapeHtml(excerpt)}</p>` : "";
  const body = toHtmlParagraphs(content);

  return `
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 10px;font-size:12px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Grow Contabilidade</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#0f172a;">${safeTitle}</h1>
        ${summary}
        <div style="font-size:15px;color:#1e293b;">
          ${body}
        </div>
      </div>
    </div>
  `;
}

function buildNewsletterText(title: string, excerpt: string | null, content: string) {
  const summaryBlock = excerpt ? `${excerpt}\n\n` : "";
  return `Grow Contabilidade\n\n${title}\n\n${summaryBlock}${content}`;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail =
      Deno.env.get("NEWSLETTER_FROM_EMAIL") || "Grow Contabilidade <contato@contabilidadegrow.com.br>";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
    }

    if (!resendApiKey) {
      return jsonResponse({ error: "Missing RESEND_API_KEY environment variable" }, 500);
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authorization token is required" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: callerRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    if (roleError) {
      throw roleError;
    }

    const isCallerAdmin = (callerRoles || []).some((row) => row.role === "admin");
    if (!isCallerAdmin) {
      return jsonResponse({ error: "Only admins can send newsletters" }, 403);
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const newsletterId = asTrimmedString(payload.newsletter_id);
    if (!newsletterId) {
      return jsonResponse({ error: "newsletter_id is required" }, 400);
    }

    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from("newsletters")
      .select("id, title, excerpt, content, is_published, email_sent_at")
      .eq("id", newsletterId)
      .maybeSingle();

    if (newsletterError) {
      throw newsletterError;
    }

    if (!newsletter) {
      return jsonResponse({ error: "Newsletter not found" }, 404);
    }

    if (!newsletter.is_published) {
      return jsonResponse({ error: "Publish the newsletter before sending emails" }, 400);
    }

    if (newsletter.email_sent_at) {
      return jsonResponse({
        ok: true,
        already_sent: true,
        email_sent_at: newsletter.email_sent_at,
      });
    }

    const { data: subscribers, error: subscribersError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email")
      .eq("status", "active");

    if (subscribersError) {
      throw subscribersError;
    }

    const recipients = Array.from(
      new Set(
        (subscribers || [])
          .map((item) => asTrimmedString(item.email)?.toLowerCase() || null)
          .filter((email): email is string => Boolean(email)),
      ),
    );

    if (recipients.length === 0) {
      const sentAt = new Date().toISOString();
      const { error: markError } = await supabaseAdmin
        .from("newsletters")
        .update({ email_sent_at: sentAt, email_send_error: null })
        .eq("id", newsletter.id);

      if (markError) {
        throw markError;
      }

      return jsonResponse({
        ok: true,
        sent_count: 0,
        subscriber_count: 0,
        email_sent_at: sentAt,
      });
    }

    const subject = `Grow Newsletter | ${newsletter.title}`;
    const htmlBody = buildNewsletterHtml(newsletter.title, newsletter.excerpt, newsletter.content);
    const textBody = buildNewsletterText(newsletter.title, newsletter.excerpt, newsletter.content);

    let sentCount = 0;
    const failures: string[] = [];

    for (const recipient of recipients) {
      const sendResult = await sendEmailViaResend({
        apiKey: resendApiKey,
        from: senderEmail,
        to: recipient,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (!sendResult.ok) {
        failures.push(`${recipient} (${sendResult.status})`);
        continue;
      }

      sentCount += 1;
    }

    if (failures.length > 0) {
      const errorMessage = `Falha no envio para ${failures.length} assinante(s).`;
      const details = `${errorMessage} Exemplo: ${failures.slice(0, 3).join(", ")}`;

      const { error: markError } = await supabaseAdmin
        .from("newsletters")
        .update({ email_send_error: details })
        .eq("id", newsletter.id);

      if (markError) {
        throw markError;
      }

      return jsonResponse(
        {
          error: errorMessage,
          sent_count: sentCount,
          failed_count: failures.length,
          subscriber_count: recipients.length,
        },
        502,
      );
    }

    const sentAt = new Date().toISOString();
    const { error: markError } = await supabaseAdmin
      .from("newsletters")
      .update({ email_sent_at: sentAt, email_send_error: null })
      .eq("id", newsletter.id);

    if (markError) {
      throw markError;
    }

    return jsonResponse({
      ok: true,
      sent_count: sentCount,
      subscriber_count: recipients.length,
      email_sent_at: sentAt,
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
