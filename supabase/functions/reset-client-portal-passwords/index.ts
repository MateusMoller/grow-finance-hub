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

type RoleRow = {
  user_id: string;
  role: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
};

type AuthUserLite = {
  id: string;
  email: string | null;
};

type SkippedItem = {
  client_id: string | null;
  user_id: string | null;
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

function buildRoleMap(rows: RoleRow[]) {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const current = map.get(row.user_id) || new Set<string>();
    current.add(String(row.role || "").toLowerCase());
    map.set(row.user_id, current);
  }
  return map;
}

function userHasInternalRole(rolesByUser: Map<string, Set<string>>, userId: string) {
  const roles = rolesByUser.get(userId);
  if (!roles) return false;
  for (const role of roles) {
    if (internalRoles.has(role)) return true;
  }
  return false;
}

function userHasRole(rolesByUser: Map<string, Set<string>>, userId: string, role: string) {
  return rolesByUser.get(userId)?.has(role) || false;
}

function addRoleToMap(rolesByUser: Map<string, Set<string>>, userId: string, role: string) {
  const current = rolesByUser.get(userId) || new Set<string>();
  current.add(role);
  rolesByUser.set(userId, current);
}

async function listAllAuthUsers(supabaseAdmin: ReturnType<typeof createClient>) {
  let page = 1;
  const perPage = 200;
  const users: AuthUserLite[] = [];

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

async function resolveOrCreateAuthUserByEmail(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  email: string;
  password: string;
  displayName: string;
  authUserByEmail: Map<string, string>;
  authEmailByUserId: Map<string, string>;
}) {
  const { supabaseAdmin, email, password, displayName, authUserByEmail, authEmailByUserId } = params;
  const mappedUserId = authUserByEmail.get(email);
  if (mappedUserId) return { userId: mappedUserId, createdNow: false };

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createUserError) {
    if (!isUserAlreadyRegisteredError(createUserError.message)) {
      throw createUserError;
    }

    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!existingUser) return { userId: null, createdNow: false };

    authUserByEmail.set(email, existingUser.id);
    authEmailByUserId.set(existingUser.id, email);
    return { userId: existingUser.id, createdNow: false };
  }

  const createdUserId = createdUser.user?.id || null;
  if (!createdUserId) return { userId: null, createdNow: false };

  authUserByEmail.set(email, createdUserId);
  authEmailByUserId.set(createdUserId, email);
  return { userId: createdUserId, createdNow: true };
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

    const [clientRowsRes, roleRowsRes, profileRowsRes] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("role", [...internalRoles, "client"]),
      supabaseAdmin
        .from("profiles")
        .select("user_id, display_name"),
    ]);

    if (clientRowsRes.error) throw clientRowsRes.error;
    if (roleRowsRes.error) throw roleRowsRes.error;
    if (profileRowsRes.error) throw profileRowsRes.error;

    const clients = (clientRowsRes.data || []) as ClientRow[];
    const roleRows = (roleRowsRes.data || []) as RoleRow[];
    const profileRows = (profileRowsRes.data || []) as ProfileRow[];
    const profilesByUser = new Map(profileRows.map((row) => [row.user_id, asTrimmedString(row.display_name)]));

    const rolesByUser = buildRoleMap(roleRows);
    const authUsers = await listAllAuthUsers(supabaseAdmin);
    const authUserByEmail = new Map<string, string>();
    const authEmailByUserId = new Map<string, string>();
    authUsers.forEach((user) => {
      const normalized = normalizeEmail(user.email);
      if (!normalized) return;
      if (!authUserByEmail.has(normalized)) authUserByEmail.set(normalized, user.id);
      authEmailByUserId.set(user.id, normalized);
    });

    const processedUsers = new Set<string>();
    const linkedClientUserIds = new Set(
      clients
        .map((client) => client.portal_user_id)
        .filter((userId): userId is string => Boolean(userId)),
    );

    const skipped: SkippedItem[] = [];

    let authUsersCreated = 0;
    let portalLinksCreated = 0;
    let clientRowsCreated = 0;
    let rolesUpserted = 0;
    let passwordsReset = 0;

    for (const client of clients) {
      const normalizedEmail = normalizeEmail(client.email);
      const displayName =
        asTrimmedString(client.contact) ||
        asTrimmedString(client.name) ||
        normalizedEmail?.split("@")[0] ||
        "Cliente";

      let portalUserId = client.portal_user_id;

      if (normalizedEmail) {
        try {
          const resolved = await resolveOrCreateAuthUserByEmail({
            supabaseAdmin,
            email: normalizedEmail,
            password: requestedPassword,
            displayName,
            authUserByEmail,
            authEmailByUserId,
          });

          if (resolved.createdNow) authUsersCreated += 1;

          const preferredUserId = resolved.userId;
          if (preferredUserId) {
            const currentLinkedEmail = normalizeEmail(
              portalUserId ? authEmailByUserId.get(portalUserId) : null,
            );

            if (!portalUserId || currentLinkedEmail !== normalizedEmail) {
              portalUserId = preferredUserId;
            }
          }
        } catch (error) {
          const reason =
            error instanceof Error && error.message
              ? `resolve_or_create_user_failed: ${error.message}`
              : "resolve_or_create_user_failed";
          skipped.push({
            client_id: client.id,
            user_id: portalUserId,
            email: normalizedEmail,
            reason,
          });
          continue;
        }
      }

      if (!portalUserId) {
        skipped.push({
          client_id: client.id,
          user_id: null,
          email: normalizedEmail,
          reason: "missing_portal_user_and_unable_to_resolve_by_email",
        });
        continue;
      }

      if (userHasInternalRole(rolesByUser, portalUserId)) {
        skipped.push({
          client_id: client.id,
          user_id: portalUserId,
          email: normalizedEmail,
          reason: "portal_user_has_internal_role",
        });
        continue;
      }

      if (client.portal_user_id !== portalUserId) {
        const { error: linkError } = await supabaseAdmin
          .from("clients")
          .update({ portal_user_id: portalUserId, updated_at: new Date().toISOString() })
          .eq("id", client.id);

        if (linkError) {
          skipped.push({
            client_id: client.id,
            user_id: portalUserId,
            email: normalizedEmail,
            reason: `link_portal_user_failed: ${linkError.message}`,
          });
          continue;
        }

        linkedClientUserIds.add(portalUserId);
        portalLinksCreated += 1;
      }

      if (!userHasRole(rolesByUser, portalUserId, "client")) {
        const { error: roleUpsertError } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: portalUserId, role: "client" }, { onConflict: "user_id,role" });

        if (roleUpsertError) {
          skipped.push({
            client_id: client.id,
            user_id: portalUserId,
            email: normalizedEmail,
            reason: `upsert_client_role_failed: ${roleUpsertError.message}`,
          });
          continue;
        }

        addRoleToMap(rolesByUser, portalUserId, "client");
      }

      rolesUpserted += 1;

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
          user_id: portalUserId,
          email: normalizedEmail,
          reason: `upsert_profile_failed: ${profileUpsertError.message}`,
        });
        continue;
      }

      profilesByUser.set(portalUserId, displayName);

      if (!processedUsers.has(portalUserId)) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(portalUserId, {
          password: requestedPassword,
          email_confirm: true,
        });

        if (passwordError) {
          skipped.push({
            client_id: client.id,
            user_id: portalUserId,
            email: normalizedEmail,
            reason: `reset_password_failed: ${passwordError.message}`,
          });
          continue;
        }

        processedUsers.add(portalUserId);
        passwordsReset += 1;
      }
    }

    const usersWithClientRole = [...rolesByUser.entries()]
      .filter(([, roles]) => roles.has("client"))
      .map(([userId]) => userId);

    for (const userId of usersWithClientRole) {
      if (userHasInternalRole(rolesByUser, userId)) continue;

      const userEmail = normalizeEmail(authEmailByUserId.get(userId));

      if (!linkedClientUserIds.has(userId)) {
        if (!userEmail) {
          skipped.push({
            client_id: null,
            user_id: userId,
            email: null,
            reason: "client_role_user_without_email_cannot_link_client_record",
          });
          continue;
        }

        const { data: unlinkedClient, error: unlinkedClientError } = await supabaseAdmin
          .from("clients")
          .select("id")
          .ilike("email", userEmail)
          .is("portal_user_id", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (unlinkedClientError) {
          skipped.push({
            client_id: null,
            user_id: userId,
            email: userEmail,
            reason: `lookup_unlinked_client_failed: ${unlinkedClientError.message}`,
          });
          continue;
        }

        if (unlinkedClient?.id) {
          const { error: linkError } = await supabaseAdmin
            .from("clients")
            .update({ portal_user_id: userId, updated_at: new Date().toISOString() })
            .eq("id", unlinkedClient.id);

          if (linkError) {
            skipped.push({
              client_id: unlinkedClient.id,
              user_id: userId,
              email: userEmail,
              reason: `link_existing_unlinked_client_failed: ${linkError.message}`,
            });
            continue;
          }

          linkedClientUserIds.add(userId);
          portalLinksCreated += 1;
        } else {
          const displayName = profilesByUser.get(userId) || userEmail.split("@")[0];
          const { error: createClientError } = await supabaseAdmin.from("clients").insert({
            name: displayName,
            contact: displayName,
            email: userEmail,
            regime: "Simples Nacional",
            sector: "Servicos",
            status: "Ativo",
            portal_user_id: userId,
          });

          if (createClientError) {
            skipped.push({
              client_id: null,
              user_id: userId,
              email: userEmail,
              reason: `create_missing_client_record_failed: ${createClientError.message}`,
            });
            continue;
          }

          linkedClientUserIds.add(userId);
          clientRowsCreated += 1;
        }
      }

      if (!processedUsers.has(userId)) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: requestedPassword,
          email_confirm: true,
        });

        if (passwordError) {
          skipped.push({
            client_id: null,
            user_id: userId,
            email: userEmail,
            reason: `reset_password_failed_secondary: ${passwordError.message}`,
          });
          continue;
        }

        processedUsers.add(userId);
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
      client_rows_created: clientRowsCreated,
      client_roles_upserted: rolesUpserted,
      skipped_count: skipped.length,
      skipped_preview: skipped.slice(0, 30),
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

