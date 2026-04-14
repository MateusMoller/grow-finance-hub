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

type ClientRow = {
  id: string;
  name: string | null;
  contact: string | null;
  email: string | null;
  status: string | null;
  portal_user_id: string | null;
  created_at?: string | null;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function isInactiveClientStatus(status: unknown): boolean {
  return String(status || "").trim().toLowerCase() === "inativo";
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
      data: { user: callerUser },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: callerRoles, error: callerRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    if (callerRolesError) throw callerRolesError;

    const roles = (callerRoles || []).map((row) => String(row.role || "").toLowerCase());
    const hasInternalRole = roles.some((role) => internalRoles.has(role));
    if (hasInternalRole) {
      return jsonResponse({ error: "Internal users cannot access the client portal profile flow" }, 403);
    }

    const { data: existingClientRows, error: existingClientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, contact, email, status, portal_user_id, created_at")
      .eq("portal_user_id", callerUser.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingClientError) throw existingClientError;
    const existingClient = ((existingClientRows || [])[0] || null) as ClientRow | null;
    if (existingClient) {
      if (isInactiveClientStatus(existingClient.status)) {
        return jsonResponse(
          { error: "Cliente inativo. O acesso ao portal esta bloqueado." },
          403,
        );
      }

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: callerUser.id, role: "client" }, { onConflict: "user_id,role" });
      return jsonResponse({ ok: true, action: "already_linked", client: existingClient });
    }

    const normalizedEmail = normalizeEmail(callerUser.email);
    if (!normalizedEmail) {
      return jsonResponse({ error: "Authenticated user has no valid email" }, 400);
    }

    const { data: emailClientRows, error: emailClientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, contact, email, status, portal_user_id, created_at")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (emailClientError) throw emailClientError;
    const emailClient = ((emailClientRows || [])[0] || null) as ClientRow | null;

    if (emailClient && isInactiveClientStatus(emailClient.status)) {
      return jsonResponse(
        { error: "Cliente inativo. O acesso ao portal esta bloqueado." },
        403,
      );
    }

    if (emailClient && emailClient.portal_user_id && emailClient.portal_user_id !== callerUser.id) {
      return jsonResponse(
        { error: "This email is already linked to another portal user. Contact support." },
        409,
      );
    }

    if (emailClient && !emailClient.portal_user_id) {
      const { error: linkError } = await supabaseAdmin
        .from("clients")
        .update({ portal_user_id: callerUser.id, updated_at: new Date().toISOString() })
        .eq("id", emailClient.id);

      if (linkError) throw linkError;

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: callerUser.id, role: "client" }, { onConflict: "user_id,role" });

      const { data: linkedClient, error: linkedClientError } = await supabaseAdmin
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .eq("id", emailClient.id)
        .maybeSingle();

      if (linkedClientError) throw linkedClientError;

      return jsonResponse({ ok: true, action: "linked_by_email", client: linkedClient });
    }

    const hasClientRole = roles.includes("client");
    if (!hasClientRole) {
      return jsonResponse(
        { error: "No client profile was found for this account. Ask admin to validate portal access." },
        403,
      );
    }

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    const displayName = asTrimmedString(profileRow?.display_name) || normalizedEmail.split("@")[0];
    const { data: createdClient, error: createClientError } = await supabaseAdmin
      .from("clients")
      .insert({
        name: displayName,
        contact: displayName,
        email: normalizedEmail,
        regime: "Simples Nacional",
        sector: "Servicos",
        status: "Ativo",
        portal_user_id: callerUser.id,
      })
      .select("id, name, contact, email, portal_user_id")
      .single();

    if (createClientError) throw createClientError;

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: callerUser.id, role: "client" }, { onConflict: "user_id,role" });

    return jsonResponse({ ok: true, action: "created_client_profile", client: createdClient });
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
