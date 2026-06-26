import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  applyUserAccessTransaction,
  asPrimaryRole,
  asRecord,
  asSectorCode,
  asTrimmedString,
  asUserStatus,
  asUuid,
  extractBearerToken,
  jsonResponse,
  normalizeModulesForRole,
} from "../_shared/user-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const normalizeEmail = (value: unknown) => {
  const email = asTrimmedString(value)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (!data.nextPage) return null;
    page = data.nextPage;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  let createdUserId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase configuration", code: "server_config" }, 500);
    }

    const token = extractBearerToken(request);
    if (!token) {
      return jsonResponse({ error: "Authorization token is required", code: "unauthenticated" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerData, error: callerError } = await supabaseUser.auth.getUser();
    if (callerError || !callerData.user) {
      return jsonResponse({ error: "Invalid or expired session", code: "unauthenticated" }, 401);
    }

    const payload = asRecord(await request.json());
    if (!payload) {
      return jsonResponse({ error: "Invalid payload", code: "invalid_payload" }, 400);
    }

    const organizationId = asUuid(payload.organizationId);
    const displayName = asTrimmedString(payload.displayName);
    const email = normalizeEmail(payload.email);
    const password = asTrimmedString(payload.password);
    const primaryRole = asPrimaryRole(payload.primaryRole ?? payload.role);
    const status = asUserStatus(payload.status) || "active";
    const sectorCode = asSectorCode(payload.sectorCode);
    const enabledModules = primaryRole
      ? normalizeModulesForRole(primaryRole, payload.enabledModules)
      : [];
    const linkedClientIds = Array.isArray(payload.linkedClientIds)
      ? payload.linkedClientIds.map(asUuid).filter((value): value is string => Boolean(value))
      : [];

    if (!organizationId || !displayName || !email || !password || password.length < 6 || !primaryRole) {
      return jsonResponse({ error: "Required user fields are invalid", code: "invalid_payload" }, 400);
    }
    if (primaryRole === "colaborador" && status === "active" && !sectorCode) {
      return jsonResponse({ error: "Sector is required", code: "sector_required" }, 400);
    }

    const { data: adminAllowed, error: adminError } = await supabaseUser.rpc("is_permission_admin", {
      _organization_id: organizationId,
    });
    if (adminError || !adminAllowed) {
      return jsonResponse({ error: "Only admins can create users", code: "admin_required" }, 403);
    }

    let authUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !data.user) throw error || new Error("Unable to create user");
      authUser = data.user;
      createdUserId = authUser.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          display_name: displayName,
        },
      });
      if (error) throw error;
    }

    const appliedAccess = await applyUserAccessTransaction(supabaseUser, {
      organizationId,
      targetUserId: authUser.id,
      displayName,
      primaryRole,
      status,
      sectorCode,
      enabledModules,
      linkedClientIds,
      changeReason: asTrimmedString(payload.changeReason) || "User created",
    });

    return jsonResponse({
      ok: true,
      user: {
        user_id: authUser.id,
        email,
        display_name: displayName,
      },
      access: appliedAccess,
      created_now: Boolean(createdUserId),
    });
  } catch (error) {
    if (createdUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        await createClient(supabaseUrl, serviceRoleKey).auth.admin.deleteUser(createdUserId).catch(() => undefined);
      }
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message, code: message }, 400);
  }
});
