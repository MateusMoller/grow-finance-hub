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
type CreateTeamUserPayload = {
  displayName: string;
  email: string;
  password: string;
  role: string;
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

function normalizeRole(value: unknown): string | null {
  const role = asTrimmedString(value)?.toLowerCase();
  if (!role) return null;
  return manageableRoles.has(role) ? role : null;
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

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const foundUser = data.users.find((user) => user.email?.toLowerCase() === email);
    if (foundUser) return foundUser;

    if (!data.nextPage) return null;
    page = data.nextPage;
  }
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
      return jsonResponse({ error: "Only admins can create users" }, 403);
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const parsedPayload: CreateTeamUserPayload = {
      displayName: asTrimmedString(payload.displayName) || "",
      email: normalizeEmail(payload.email) || "",
      password: asTrimmedString(payload.password) || "",
      role: normalizeRole(payload.role) || "",
    };

    if (!parsedPayload.displayName) {
      return jsonResponse({ error: "Display name is required" }, 400);
    }

    if (!parsedPayload.email) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }

    if (!isValidPassword(parsedPayload.password)) {
      return jsonResponse(
        { error: "Password must have at least 6 characters" },
        400,
      );
    }

    if (!parsedPayload.role) {
      return jsonResponse({ error: "Role is required and must be valid" }, 400);
    }

    let userId: string | null = null;
    let createdNow = false;

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: parsedPayload.email,
      password: parsedPayload.password,
      email_confirm: true,
      user_metadata: { display_name: parsedPayload.displayName },
    });

    if (createUserError) {
      if (!isUserAlreadyRegisteredError(createUserError.message)) {
        throw createUserError;
      }

      const existingUser = await findAuthUserByEmail(supabaseAdmin, parsedPayload.email);
      if (!existingUser) {
        return jsonResponse({ error: "User already exists but was not found" }, 409);
      }

      userId = existingUser.id;

      const { data: existingRoles, error: existingRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (existingRolesError) {
        throw existingRolesError;
      }

      const existingRoleValues = (existingRoles || [])
        .map((row) => String(row.role || "").trim().toLowerCase())
        .filter(Boolean);

      const hasInternalRole = existingRoleValues.some((role) => role !== "client");
      if (hasInternalRole) {
        return jsonResponse(
          { error: "This email is already linked to an internal profile in the system" },
          409,
        );
      }

      const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: parsedPayload.password,
        email_confirm: true,
        user_metadata: { display_name: parsedPayload.displayName },
      });

      if (updateUserError) {
        throw updateUserError;
      }
    } else {
      userId = createdUser.user?.id || null;
      createdNow = Boolean(userId);
    }

    if (!userId) {
      return jsonResponse({ error: "Unable to resolve user id" }, 400);
    }

    const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: parsedPayload.role,
    });

    if (roleInsertError) {
      throw roleInsertError;
    }

    const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: userId,
        display_name: parsedPayload.displayName,
      },
      { onConflict: "user_id" },
    );

    if (profileUpsertError) {
      throw profileUpsertError;
    }

    return jsonResponse({
      ok: true,
      user: {
        user_id: userId,
        email: parsedPayload.email,
        display_name: parsedPayload.displayName,
        role: parsedPayload.role,
      },
      created_now: createdNow,
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
