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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse(null);
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

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
    const targetUserId = asUuid(payload.userId ?? payload.targetUserId);
    const action = asTrimmedString(payload.action)?.toLowerCase() || "update";
    if (!organizationId || !targetUserId || !["update", "deactivate", "delete"].includes(action)) {
      return jsonResponse({ error: "Invalid management request", code: "invalid_payload" }, 400);
    }

    const { data: adminAllowed, error: adminError } = await supabaseUser.rpc("is_permission_admin", {
      _organization_id: organizationId,
    });
    if (adminError || !adminAllowed) {
      return jsonResponse({ error: "Only admins can manage users", code: "admin_required" }, 403);
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("organization_user_access")
      .select("primary_role, status, sector_code")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (existingError || !existing) {
      return jsonResponse({ error: "User access was not found", code: "not_found" }, 404);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", targetUserId)
      .maybeSingle();
    const { data: existingGrants } = await supabaseAdmin
      .from("user_module_grants")
      .select("module_key")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId);
    const { data: existingLinks } = await supabaseAdmin
      .from("client_users")
      .select("client_id")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)
      .eq("status", "active");

    const primaryRole = asPrimaryRole(payload.primaryRole ?? payload.primary_role ?? payload.role) || existing.primary_role;
    const status = action === "update"
      ? asUserStatus(payload.status) || existing.status
      : "inactive";
    const sectorCode = primaryRole === "colaborador"
      ? asSectorCode(payload.sectorCode) || existing.sector_code
      : null;
    const enabledModules = normalizeModulesForRole(
      primaryRole,
      Array.isArray(payload.enabledModules)
        ? payload.enabledModules
        : (existingGrants || []).map((item) => item.module_key),
    );
    const linkedClientIds = Array.isArray(payload.linkedClientIds)
      ? payload.linkedClientIds.map(asUuid).filter((value): value is string => Boolean(value))
      : (existingLinks || []).map((item) => String(item.client_id));
    const displayName = asTrimmedString(payload.displayName) || profile?.display_name || "Usuário";

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: { display_name: displayName },
    });
    if (authUpdateError) throw authUpdateError;

    const appliedAccess = await applyUserAccessTransaction(supabaseUser, {
      organizationId,
      targetUserId,
      displayName,
      primaryRole,
      status,
      sectorCode,
      enabledModules,
      linkedClientIds,
      changeReason: asTrimmedString(payload.changeReason) || (
        action === "update" ? "User access updated" : "User deactivated"
      ),
    });

    return jsonResponse({
      ok: true,
      action: action === "delete" ? "deactivate" : action,
      target_user_id: targetUserId,
      access: appliedAccess,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("last_admin_blocked") ? 409 : 400;
    return jsonResponse({ error: message, code: message }, status);
  }
});
