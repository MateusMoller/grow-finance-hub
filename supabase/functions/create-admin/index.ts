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

function isStrongPassword(value: string) {
  if (value.length < 10) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
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
      return jsonResponse({ error: "Only admins can create admin users" }, 403);
    }

    const payload = asRecord(await req.json());
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const email = normalizeEmail(payload.email);
    const password = asTrimmedString(payload.password) || "";

    if (!email) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }

    if (!isStrongPassword(password)) {
      return jsonResponse(
        {
          error:
            "Password must have at least 10 characters and include uppercase, lowercase and number",
        },
        400,
      );
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Admin Grow" },
    });

    if (createError) {
      if (createError.message?.includes("already been registered")) {
        const {
          data: { users },
          error: listError,
        } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const existingUser = users.find((u) => u.email?.toLowerCase() === email);
        if (!existingUser) {
          return jsonResponse({ error: "User already exists but was not found" }, 409);
        }

        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: existingUser.id, role: "admin" }, { onConflict: "user_id,role" });

        if (roleError) throw roleError;

        return jsonResponse({
          ok: true,
          message: "Admin role assigned to existing user",
          user_id: existingUser.id,
        });
      }

      throw createError;
    }

    const userId = userData.user?.id;
    if (!userId) {
      return jsonResponse({ error: "Unable to resolve created user" }, 400);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    return jsonResponse({ ok: true, message: "Admin user created", user_id: userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 400);
  }
});
