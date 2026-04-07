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
type ClientRow = {
  id: string;
  name: string | null;
  contact: string | null;
  email: string | null;
  portal_user_id: string | null;
};

type SkippedItem = {
  client_id: string;
  email: string | null;
  reason: string;
};

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

function isValidPassword(value: string) {
  return value.length >= 6;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function isUserAlreadyRegisteredError(message?: string) {
  if (!message) return false;
  const lowered = message.toLowerCase();
  return lowered.includes("already been registered") || lowered.includes("already registered");
}

async function listAllAuthUsers(supabaseAdmin: ReturnType<typeof createClient>) {
  let page = 1;
  const perPage = 200;
  const users: Array<{ id: string; email: string | null }> = [];

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? null })));
    if (!data.nextPage) return users;
    page = data.nextPage;
  }
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const users = await listAllAuthUsers(supabaseAdmin);
  return users.find((user) => user.email?.toLowerCase() === email) || null;
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

    const isCallerAdmin = (callerRoles || []).some((row) => row.role === "admin");
    if (!isCallerAdmin) {
      return jsonResponse({ error: "Only admins can reset client portal passwords" }, 403);
    }

    const rawBody = await req.json().catch(() => ({}));
    const body = asRecord(rawBody) || {};
    const requestedPassword = asTrimmedString(body.password) || "123456";

    if (!isValidPassword(requestedPassword)) {
      return jsonResponse({ error: "Password must have at least 6 characters" }, 400);
    }

    const { data: clientRows, error: clientRowsError } = await supabaseAdmin
      .from("clients")
      .select("id, name, contact, email, portal_user_id")
      .order("created_at", { ascending: true });

    if (clientRowsError) throw clientRowsError;

    const clients = (clientRows || []) as ClientRow[];
    const authUsers = await listAllAuthUsers(supabaseAdmin);
    const authUserByEmail = new Map<string, string>();
    authUsers.forEach((user) => {
      const email = normalizeEmail(user.email);
      if (email && !authUserByEmail.has(email)) {
        authUserByEmail.set(email, user.id);
      }
    });

    const processedUsers = new Set<string>();
    const skipped: SkippedItem[] = [];

    let authUsersCreated = 0;
    let portalLinksCreated = 0;
    let rolesUpserted = 0;
    let passwordsReset = 0;

    for (const client of clients) {
      const normalizedEmail = normalizeEmail(client.email);
      let portalUserId = client.portal_user_id;

      if (!portalUserId && normalizedEmail) {
        const mappedUserId = authUserByEmail.get(normalizedEmail);
        if (mappedUserId) {
          portalUserId = mappedUserId;
        } else {
          const displayName = asTrimmedString(client.contact) || asTrimmedString(client.name) || normalizedEmail.split("@")[0];
          const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: requestedPassword,
            email_confirm: true,
            user_metadata: { display_name: displayName },
          });

          if (createUserError) {
            if (!isUserAlreadyRegisteredError(createUserError.message)) {
              skipped.push({
                client_id: client.id,
                email: normalizedEmail,
                reason: `create_auth_user_failed: ${createUserError.message}`,
              });
              continue;
            }

            const existingUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
            if (!existingUser) {
              skipped.push({
                client_id: client.id,
                email: normalizedEmail,
                reason: "auth_user_exists_but_not_found",
              });
              continue;
            }
            portalUserId = existingUser.id;
          } else {
            portalUserId = createdUser.user?.id || null;
            if (portalUserId) {
              authUsersCreated += 1;
              authUserByEmail.set(normalizedEmail, portalUserId);
            }
          }
        }
      }

      if (!portalUserId) {
        skipped.push({
          client_id: client.id,
          email: normalizedEmail,
          reason: "missing_portal_user_and_unable_to_resolve_by_email",
        });
        continue;
      }

      const { data: userRoles, error: userRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", portalUserId);

      if (userRolesError) {
        skipped.push({
          client_id: client.id,
          email: normalizedEmail,
          reason: `read_user_roles_failed: ${userRolesError.message}`,
        });
        continue;
      }

      const hasInternalRole = (userRoles || []).some((row) => internalRoles.has(String(row.role || "")));
      if (hasInternalRole) {
        skipped.push({
          client_id: client.id,
          email: normalizedEmail,
          reason: "portal_user_has_internal_role",
        });
        continue;
      }

      if (!client.portal_user_id) {
        const { error: linkError } = await supabaseAdmin
          .from("clients")
          .update({ portal_user_id: portalUserId, updated_at: new Date().toISOString() })
          .eq("id", client.id);

        if (linkError) {
          skipped.push({
            client_id: client.id,
            email: normalizedEmail,
            reason: `link_portal_user_failed: ${linkError.message}`,
          });
          continue;
        }

        portalLinksCreated += 1;
      }

      const { error: roleUpsertError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: portalUserId, role: "client" }, { onConflict: "user_id,role" });

      if (roleUpsertError) {
        skipped.push({
          client_id: client.id,
          email: normalizedEmail,
          reason: `upsert_client_role_failed: ${roleUpsertError.message}`,
        });
        continue;
      }

      rolesUpserted += 1;

      const displayName = asTrimmedString(client.contact) || asTrimmedString(client.name) || normalizedEmail || portalUserId.slice(0, 8);
      const { error: profileUpsertError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            user_id: portalUserId,
            display_name: displayName,
          },
          { onConflict: "user_id" },
        );

      if (profileUpsertError) {
        skipped.push({
          client_id: client.id,
          email: normalizedEmail,
          reason: `upsert_profile_failed: ${profileUpsertError.message}`,
        });
        continue;
      }

      if (!processedUsers.has(portalUserId)) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(portalUserId, {
          password: requestedPassword,
          email_confirm: true,
        });

        if (passwordError) {
          skipped.push({
            client_id: client.id,
            email: normalizedEmail,
            reason: `reset_password_failed: ${passwordError.message}`,
          });
          continue;
        }

        processedUsers.add(portalUserId);
        passwordsReset += 1;
      }
    }

    return jsonResponse({
      ok: true,
      password_applied: requestedPassword,
      clients_total: clients.length,
      users_processed: processedUsers.size,
      passwords_reset: passwordsReset,
      auth_users_created: authUsersCreated,
      portal_links_created: portalLinksCreated,
      client_roles_upserted: rolesUpserted,
      skipped_count: skipped.length,
      skipped_preview: skipped.slice(0, 20),
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

