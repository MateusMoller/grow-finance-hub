import nodemailer from "npm:nodemailer@6.9.16";

type EmailAddress = string | string[];

export type SmtpEmailAttachment = {
  filename: string;
  content: string;
  content_type?: string;
  contentType?: string;
};

export type SmtpEmailParams = {
  from?: string | null;
  replyTo?: string | null;
  to: EmailAddress;
  subject: string;
  html: string;
  text: string;
  attachments?: SmtpEmailAttachment[];
};

export type SmtpEmailResult =
  | { ok: true; id: string | null; status: number }
  | { ok: false; status: number | null; message: string };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBooleanEnv(name: string, fallback: boolean) {
  const value = asTrimmedString(Deno.env.get(name));
  if (!value) return fallback;
  return ["1", "true", "yes", "sim"].includes(value.toLowerCase());
}

function parsePort(value: string | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 587;
}

function formatEmailAddress(email: string, name?: string | null) {
  const cleanEmail = email.trim();
  const cleanName = asTrimmedString(name);
  if (!cleanName) return cleanEmail;
  if (cleanEmail.includes("<") && cleanEmail.includes(">")) return cleanEmail;
  return `${cleanName.replace(/"/g, "'")} <${cleanEmail}>`;
}

export function resolveConfiguredEmailSender(...specificEnvNames: string[]) {
  for (const name of specificEnvNames) {
    const value = asTrimmedString(Deno.env.get(name));
    if (value) return value;
  }

  const fromEmail = asTrimmedString(Deno.env.get("SMTP_FROM_EMAIL"));
  if (fromEmail) {
    return formatEmailAddress(fromEmail, Deno.env.get("SMTP_FROM_NAME"));
  }

  const smtpUser = asTrimmedString(Deno.env.get("SMTP_USER"));
  if (smtpUser && smtpUser.includes("@")) {
    return formatEmailAddress(smtpUser, Deno.env.get("SMTP_FROM_NAME"));
  }

  return null;
}

function getSmtpConfiguration() {
  const host = asTrimmedString(Deno.env.get("SMTP_HOST"));
  const port = parsePort(Deno.env.get("SMTP_PORT"));
  const user = asTrimmedString(Deno.env.get("SMTP_USER"));
  const pass = asTrimmedString(Deno.env.get("SMTP_PASS"));
  const secure = parseBooleanEnv("SMTP_SECURE", port === 465);
  const requireTLS = parseBooleanEnv("SMTP_REQUIRE_TLS", port === 587);

  const missing = [
    !host ? "SMTP_HOST" : null,
    !user ? "SMTP_USER" : null,
    !pass ? "SMTP_PASS" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    return {
      ok: false as const,
      message: `Configuracao SMTP incompleta. Defina ${missing.join(", ")} nos secrets do Supabase.`,
    };
  }

  return {
    ok: true as const,
    host,
    port,
    secure,
    requireTLS,
    auth: {
      user,
      pass,
    },
  };
}

export async function sendEmailViaSmtp(params: SmtpEmailParams): Promise<SmtpEmailResult> {
  const config = getSmtpConfiguration();
  if (!config.ok) {
    return { ok: false, status: null, message: config.message };
  }

  const from = asTrimmedString(params.from) || resolveConfiguredEmailSender();
  if (!from) {
    return {
      ok: false,
      status: null,
      message: "Remetente de e-mail nao configurado. Defina SMTP_FROM_EMAIL ou o remetente especifico do modulo.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: config.auth,
    });

    const info = await transporter.sendMail({
      from,
      to: params.to,
      replyTo: params.replyTo || undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: "base64",
        contentType: attachment.content_type || attachment.contentType,
      })),
    });

    return {
      ok: true,
      id: typeof info.messageId === "string" ? info.messageId : null,
      status: 250,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no envio SMTP.";
    return { ok: false, status: null, message };
  }
}
