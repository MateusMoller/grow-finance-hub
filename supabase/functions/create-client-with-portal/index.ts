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

const clientCreatorRoles = new Set(["admin", "director", "manager", "commercial"]);

type JsonRecord = Record<string, unknown>;
type CreateClientPayload = {
  code?: string;
  name: string;
  trade_name?: string;
  cnpj?: string;
  state_registration?: string;
  municipal_registration?: string;
  cnae_main?: string;
  regime?: string;
  simples_annex?: string;
  opened_at?: string;
  cnpj_status?: string;
  city?: string;
  state?: string;
  address?: string;
  ddd?: string;
  whatsapp?: string;
  has_digital_certificate?: boolean;
  certificate_type?: string;
  certificate_expires_on?: string;
  status?: string;
  notes?: string;
  gov_password?: string;
  sector?: string;
  contact?: string;
  email: string;
  phone?: string;
  password: string;
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

function asDateString(value: unknown): string | undefined {
  const parsed = asTrimmedString(value);
  if (!parsed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return undefined;
  return parsed;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (!normalized) return undefined;
    if (["sim", "true", "1", "yes", "y"].includes(normalized)) return true;
    if (["nao", "false", "0", "no", "n"].includes(normalized)) return false;
  }

  return undefined;
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

    if (!data.nextPage) {
      return null;
    }

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

    const canCreateClients = (callerRoles || []).some((roleRow) => clientCreatorRoles.has(roleRow.role));
    if (!canCreateClients) {
      return jsonResponse(
        { error: "Only admin, director, manager, or commercial roles can create clients" },
        403,
      );
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const parsedPayload: CreateClientPayload = {
      code: asTrimmedString(payload.code) || undefined,
      name: asTrimmedString(payload.name) || "",
      trade_name: asTrimmedString(payload.trade_name) || undefined,
      cnpj: asTrimmedString(payload.cnpj) || undefined,
      state_registration: asTrimmedString(payload.state_registration) || undefined,
      municipal_registration: asTrimmedString(payload.municipal_registration) || undefined,
      cnae_main: asTrimmedString(payload.cnae_main) || undefined,
      regime: asTrimmedString(payload.regime) || undefined,
      simples_annex: asTrimmedString(payload.simples_annex) || undefined,
      opened_at: asDateString(payload.opened_at),
      cnpj_status: asTrimmedString(payload.cnpj_status) || undefined,
      city: asTrimmedString(payload.city) || undefined,
      state: asTrimmedString(payload.state) || undefined,
      address: asTrimmedString(payload.address) || undefined,
      ddd: asTrimmedString(payload.ddd) || undefined,
      whatsapp: asTrimmedString(payload.whatsapp) || undefined,
      has_digital_certificate: asOptionalBoolean(payload.has_digital_certificate),
      certificate_type: asTrimmedString(payload.certificate_type) || undefined,
      certificate_expires_on: asDateString(payload.certificate_expires_on),
      status: asTrimmedString(payload.status) || undefined,
      notes: asTrimmedString(payload.notes) || undefined,
      gov_password: asTrimmedString(payload.gov_password) || undefined,
      sector: asTrimmedString(payload.sector) || undefined,
      contact: asTrimmedString(payload.contact) || undefined,
      email: normalizeEmail(payload.email) || "",
      phone: asTrimmedString(payload.phone) || undefined,
      password: asTrimmedString(payload.password) || "",
    };

    if (!parsedPayload.name) {
      return jsonResponse({ error: "Client name is required" }, 400);
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

    const { data: existingClientByEmail, error: existingClientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .ilike("email", parsedPayload.email)
      .limit(1);

    if (existingClientError) {
      throw existingClientError;
    }

    if ((existingClientByEmail || []).length > 0) {
      return jsonResponse(
        { error: "There is already a registered client with this email" },
        409,
      );
    }

    let portalUserId: string | null = null;
    let portalUserCreatedNow = false;

    const { data: createdAuthUser, error: createAuthUserError } = await supabaseAdmin.auth.admin
      .createUser({
        email: parsedPayload.email,
        password: parsedPayload.password,
        email_confirm: true,
        user_metadata: {
          display_name: parsedPayload.contact || parsedPayload.name,
        },
      });

    if (createAuthUserError) {
      if (!isUserAlreadyRegisteredError(createAuthUserError.message)) {
        throw createAuthUserError;
      }

      const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, parsedPayload.email);
      if (!existingAuthUser) {
        return jsonResponse({ error: "User already exists but was not found for linking" }, 409);
      }

      portalUserId = existingAuthUser.id;
    } else {
      portalUserId = createdAuthUser.user?.id || null;
      portalUserCreatedNow = Boolean(portalUserId);
    }

    if (!portalUserId) {
      return jsonResponse({ error: "Unable to resolve portal user" }, 400);
    }

    const { data: existingRoles, error: existingRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", portalUserId);

    if (existingRolesError) {
      throw existingRolesError;
    }

    const hasInternalRole = (existingRoles || []).some((row) => internalRoles.has(row.role));
    if (hasInternalRole) {
      return jsonResponse(
        { error: "This email is already linked to an internal account" },
        409,
      );
    }

    const { data: existingClientByPortalUser, error: existingClientByPortalUserError } =
      await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("portal_user_id", portalUserId)
        .limit(1);

    if (existingClientByPortalUserError) {
      throw existingClientByPortalUserError;
    }

    if ((existingClientByPortalUser || []).length > 0) {
      return jsonResponse(
        { error: "Portal user is already linked to another client" },
        409,
      );
    }

    const { error: roleUpsertError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: portalUserId, role: "client" },
      { onConflict: "user_id,role" },
    );

    if (roleUpsertError) {
      throw roleUpsertError;
    }

    const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: portalUserId,
        display_name: parsedPayload.contact || parsedPayload.name,
      },
      { onConflict: "user_id" },
    );

    if (profileUpsertError) {
      throw profileUpsertError;
    }

    const { data: createdClient, error: createClientError } = await supabaseAdmin
      .from("clients")
      .insert({
        code: parsedPayload.code || null,
        name: parsedPayload.name,
        trade_name: parsedPayload.trade_name || null,
        cnpj: parsedPayload.cnpj || null,
        state_registration: parsedPayload.state_registration || null,
        municipal_registration: parsedPayload.municipal_registration || null,
        cnae_main: parsedPayload.cnae_main || null,
        regime: parsedPayload.regime || "Simples Nacional",
        simples_annex: parsedPayload.simples_annex || null,
        opened_at: parsedPayload.opened_at || null,
        cnpj_status: parsedPayload.cnpj_status || null,
        city: parsedPayload.city || null,
        state: parsedPayload.state || null,
        address: parsedPayload.address || null,
        ddd: parsedPayload.ddd || null,
        sector: parsedPayload.sector || "Contabil",
        status: parsedPayload.status || "Ativo",
        contact: parsedPayload.contact || null,
        email: parsedPayload.email,
        phone: parsedPayload.phone || null,
        whatsapp: parsedPayload.whatsapp || null,
        has_digital_certificate:
          typeof parsedPayload.has_digital_certificate === "boolean"
            ? parsedPayload.has_digital_certificate
            : null,
        certificate_type: parsedPayload.certificate_type || null,
        certificate_expires_on: parsedPayload.certificate_expires_on || null,
        notes: parsedPayload.notes || null,
        gov_password: parsedPayload.gov_password || null,
        portal_user_id: portalUserId,
        created_by: callerUser.id,
      })
      .select("id, name, email, portal_user_id")
      .single();

    if (createClientError) {
      if (portalUserCreatedNow) {
        await supabaseAdmin.auth.admin.deleteUser(portalUserId);
      }
      throw createClientError;
    }

    return jsonResponse({
      ok: true,
      client: createdClient,
      portal_user_created_now: portalUserCreatedNow,
      portal_user_id: portalUserId,
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
