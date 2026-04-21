import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const manageableRoles = new Set([
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
type ManageAction = "update" | "delete";

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

function asAction(value: unknown): ManageAction | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === "update" || normalized === "delete") return normalized;
  return null;
}

function asUuid(value: unknown): string | null {
  const maybeUuid = asTrimmedString(value);
  if (!maybeUuid) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(maybeUuid) ? maybeUuid : null;
}

function asRole(value: unknown): string | null {
  const role = asTrimmedString(value)?.toLowerCase();
  if (!role) return null;
  return manageableRoles.has(role) ? role : null;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
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

    if (callerRolesError) {
      throw callerRolesError;
    }

    const isCallerAdmin = (callerRoles || []).some((row) => row.role === "admin");
    if (!isCallerAdmin) {
      return jsonResponse({ error: "Only admins can manage users" }, 403);
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const action = asAction(payload.action);
    const userId = asUuid(payload.userId);

    if (!action) {
      return jsonResponse({ error: "Action must be update or delete" }, 400);
    }

    if (!userId) {
      return jsonResponse({ error: "A valid userId is required" }, 400);
    }

    if (action === "delete" && userId === callerUser.id) {
      return jsonResponse({ error: "You cannot delete your own account" }, 400);
    }

    const { data: targetUserData, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );

    if (targetUserError || !targetUserData.user) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    if (action === "delete") {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError) throw deleteUserError;

      return jsonResponse({ ok: true, action: "delete", user_id: userId });
    }

    const displayName = asTrimmedString(payload.displayName);
    const role = asRole(payload.role);

    if (!displayName) {
      return jsonResponse({ error: "Display name is required" }, 400);
    }

    if (!role) {
      return jsonResponse({ error: "Role is required and must be valid" }, 400);
    }

    const mergedMetadata = {
      ...(targetUserData.user.user_metadata || {}),
      display_name: displayName,
    };

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: mergedMetadata,
    });

    if (updateAuthError) {
      throw updateAuthError;
    }

    const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
      },
      { onConflict: "user_id" },
    );

    if (profileUpsertError) {
      throw profileUpsertError;
    }

    const { error: roleUpsertError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role" },
    );

    if (roleUpsertError) {
      throw roleUpsertError;
    }

    const { error: removeOtherRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", role);

    if (removeOtherRolesError) {
      throw removeOtherRolesError;
    }

    return jsonResponse({
      ok: true,
      action: "update",
      user: {
        user_id: userId,
        display_name: displayName,
        email: targetUserData.user.email || null,
        role,
      },
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
