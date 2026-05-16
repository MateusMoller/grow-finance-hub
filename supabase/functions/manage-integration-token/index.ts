import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `gfh_${raw}`;
}

async function syncUserSettingsAccessFlag(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  enabled: boolean,
) {
  await supabaseAdmin.from("user_settings").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      api_access: enabled,
      integrations_api_access: enabled,
    },
    { onConflict: "user_id" },
  );
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

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
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
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", user.id);

    if (rolesError) {
      throw rolesError;
    }

    const firstInternalRole = (roles || []).find((row) => internalRoles.has(String(row.role)));
    const isInternalUser = Boolean(firstInternalRole);
    if (!isInternalUser) {
      return jsonResponse({ error: "Only internal users can manage integration tokens" }, 403);
    }

    const organizationId = firstInternalRole?.organization_id
      ? String(firstInternalRole.organization_id)
      : null;

    if (!organizationId) {
      return jsonResponse({ error: "No organization is linked to this internal user." }, 403);
    }

    const body = asRecord(await req.json().catch(() => ({}))) || {};
    const action = String(body.action || "status");

    const { data: existingCredential, error: existingCredentialError } = await supabaseAdmin
      .from("integration_api_credentials")
      .select("user_id, token_prefix, enabled, last_used_at, revoked_at, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingCredentialError) {
      throw existingCredentialError;
    }

    if (action === "status") {
      return jsonResponse({
        enabled: existingCredential?.enabled === true && !existingCredential?.revoked_at,
        token_configured: Boolean(existingCredential),
        token_prefix: existingCredential?.token_prefix || null,
        last_used_at: existingCredential?.last_used_at || null,
        rotated_at: existingCredential?.updated_at || existingCredential?.created_at || null,
      });
    }

    if (action === "rotate") {
      const revealedToken = generateToken();
      const tokenHash = await sha256Hex(revealedToken);
      const now = new Date().toISOString();

      const { error: upsertError } = await supabaseAdmin.from("integration_api_credentials").upsert(
        {
          user_id: user.id,
          organization_id: organizationId,
          token_hash: tokenHash,
          token_prefix: revealedToken.slice(0, 12),
          enabled: true,
          revoked_at: null,
          last_used_at: existingCredential?.last_used_at || null,
          created_by: user.id,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

      if (upsertError) {
        throw upsertError;
      }

      await syncUserSettingsAccessFlag(supabaseAdmin, user.id, organizationId, true);

      return jsonResponse({
        enabled: true,
        token_configured: true,
        token_prefix: revealedToken.slice(0, 12),
        revealed_token: revealedToken,
        last_used_at: existingCredential?.last_used_at || null,
        rotated_at: now,
      });
    }

    if (action === "set_enabled") {
      if (!existingCredential) {
        return jsonResponse({ error: "No integration token exists for this user yet." }, 404);
      }

      const enabled = asBoolean(body.enabled);
      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("integration_api_credentials")
        .update({
          enabled,
          revoked_at: enabled ? null : now,
          updated_at: now,
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      await syncUserSettingsAccessFlag(supabaseAdmin, user.id, organizationId, enabled);

      return jsonResponse({
        enabled,
        token_configured: true,
        token_prefix: existingCredential.token_prefix || null,
        last_used_at: existingCredential.last_used_at || null,
        rotated_at: now,
      });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
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
