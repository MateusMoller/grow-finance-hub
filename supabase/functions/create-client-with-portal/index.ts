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
  name: string;
  cnpj?: string;
  regime?: string;
  sector?: string;
  contact?: string;
  email: string;
  phone?: string;
  obligationCompletionWhatsAppEnabled?: boolean;
  portalPassword?: string;
};

type ExistingClientRow = {
  id: string;
  email: string | null;
  cnpj: string | null;
  portal_user_id: string | null;
  status: string | null;
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

function normalizeCnpj(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function isInactiveClientStatus(value: string | null | undefined) {
  return asTrimmedString(value)?.toLowerCase() === "inativo";
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function getPortalRedirectUrl() {
  return asTrimmedString(Deno.env.get("CLIENT_PORTAL_INVITE_REDIRECT_URL")) ||
    asTrimmedString(Deno.env.get("SITE_URL")) ||
    undefined;
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
      name: asTrimmedString(payload.name) || "",
      cnpj: asTrimmedString(payload.cnpj) || undefined,
      regime: asTrimmedString(payload.regime) || undefined,
      sector: asTrimmedString(payload.sector) || undefined,
      contact: asTrimmedString(payload.contact) || undefined,
      email: normalizeEmail(payload.email) || "",
      phone: asTrimmedString(payload.phone) || undefined,
      obligationCompletionWhatsAppEnabled: typeof payload.obligationCompletionWhatsAppEnabled === "boolean"
        ? payload.obligationCompletionWhatsAppEnabled
        : false,
      portalPassword: asTrimmedString(payload.portalPassword) || undefined,
    };

    if (!parsedPayload.name) {
      return jsonResponse({ error: "Client name is required" }, 400);
    }

    if (!parsedPayload.email) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }

    const normalizedCnpj = parsedPayload.cnpj ? normalizeCnpj(parsedPayload.cnpj) : null;
    if (parsedPayload.cnpj && !normalizedCnpj) {
      return jsonResponse({ error: "Informe um CNPJ valido ou deixe o campo em branco." }, 400);
    }

    const normalizedPortalPassword = parsedPayload.portalPassword || "123456";

    const clientMatchFilters = [
      `email.ilike.${parsedPayload.email}`,
      normalizedCnpj ? `cnpj.eq.${normalizedCnpj}` : null,
    ].filter(Boolean);

    let existingClientToLink: ExistingClientRow | null = null;
    if (clientMatchFilters.length > 0) {
      const { data: existingClientMatches, error: existingClientError } = await supabaseAdmin
        .from("clients")
        .select("id, email, cnpj, portal_user_id, status")
        .or(clientMatchFilters.join(","))
        .limit(10);

      if (existingClientError) {
        throw existingClientError;
      }

      const matches = (existingClientMatches || []) as ExistingClientRow[];
      const emailMatch = matches.find((client) => normalizeEmail(client.email) === parsedPayload.email);
      const cnpjMatch = normalizedCnpj
        ? matches.find((client) => normalizeCnpj(client.cnpj) === normalizedCnpj)
        : null;

      if (emailMatch && cnpjMatch && emailMatch.id !== cnpjMatch.id) {
        return jsonResponse(
          { error: "Encontramos conflito entre e-mail e CNPJ em clientes diferentes. Revise os cadastros antes de continuar." },
          409,
        );
      }

      existingClientToLink = emailMatch || cnpjMatch || null;

      if (existingClientToLink?.portal_user_id) {
        return jsonResponse(
          { error: "Este cliente ja possui um usuario de portal vinculado." },
          409,
        );
      }

      if (existingClientToLink && isInactiveClientStatus(existingClientToLink.status)) {
        return jsonResponse(
          { error: "Este cliente esta inativo. Reative o cadastro antes de liberar o acesso ao portal." },
          409,
        );
      }
    }

    let portalUserId: string | null = null;
    let portalUserCreatedNow = false;
    let portalAccessLink: string | null = null;
    let portalAccessLinkType: "invite" | "recovery" | "password" | null = null;
    let portalPasswordApplied = false;
    const portalRedirectUrl = getPortalRedirectUrl();

    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, parsedPayload.email);
    if (existingAuthUser) {
      portalUserId = existingAuthUser.id;
    }

    if (!portalUserId) {
      if (normalizedPortalPassword) {
        const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: parsedPayload.email,
          password: normalizedPortalPassword,
          email_confirm: true,
          user_metadata: {
            display_name: parsedPayload.contact || parsedPayload.name,
          },
        });

        if (createUserError) {
          throw createUserError;
        }

        portalUserId = createdUserData.user?.id || null;
        portalUserCreatedNow = Boolean(portalUserId);
        portalPasswordApplied = portalUserCreatedNow;
        portalAccessLinkType = portalUserCreatedNow ? "password" : null;
      } else {
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email: parsedPayload.email,
          options: {
            data: {
              display_name: parsedPayload.contact || parsedPayload.name,
            },
            redirectTo: portalRedirectUrl,
          },
        });

        if (inviteError) {
          throw inviteError;
        }

        portalUserId = inviteData.user?.id || null;
        portalUserCreatedNow = Boolean(portalUserId);
        portalAccessLink = inviteData.properties.action_link;
        portalAccessLinkType = "invite";
      }
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

    if (portalUserId && normalizedPortalPassword && !portalUserCreatedNow) {
      const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(portalUserId, {
        password: normalizedPortalPassword,
        email_confirm: true,
        user_metadata: {
          display_name: parsedPayload.contact || parsedPayload.name,
        },
      });

      if (passwordUpdateError) {
        throw passwordUpdateError;
      }

      portalPasswordApplied = true;
      portalAccessLink = null;
      portalAccessLinkType = "password";
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

    const clientWritePayload = {
      name: parsedPayload.name,
      cnpj: normalizedCnpj,
      regime: parsedPayload.regime || "Simples Nacional",
      sector: parsedPayload.sector || "Contabil",
      contact: parsedPayload.contact || null,
      email: parsedPayload.email,
      phone: parsedPayload.phone || null,
      obligation_completion_whatsapp_enabled: Boolean(parsedPayload.obligationCompletionWhatsAppEnabled),
      portal_user_id: portalUserId,
      created_by: callerUser.id,
    };

    const clientWriteQuery = existingClientToLink
      ? supabaseAdmin
          .from("clients")
          .update(clientWritePayload)
          .eq("id", existingClientToLink.id)
      : supabaseAdmin
          .from("clients")
          .insert(clientWritePayload);

    const { data: createdClient, error: createClientError } = await clientWriteQuery
      .select("id, name, email, portal_user_id")
      .single();

    if (createClientError) {
      if (portalUserCreatedNow) {
        await supabaseAdmin.auth.admin.deleteUser(portalUserId);
      }
      throw createClientError;
    }

    if (!portalAccessLink && !portalPasswordApplied) {
      const { data: recoveryData, error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: parsedPayload.email,
        options: portalRedirectUrl
          ? {
              redirectTo: portalRedirectUrl,
            }
          : undefined,
      });

      if (recoveryError) {
        throw recoveryError;
      }

      portalAccessLink = recoveryData.properties.action_link;
      portalAccessLinkType = "recovery";
    }

    return jsonResponse({
      ok: true,
      client: createdClient,
      portal_user_created_now: portalUserCreatedNow,
      portal_user_id: portalUserId,
      portal_access_link: portalAccessLink,
      portal_access_link_type: portalAccessLinkType,
      portal_password_applied: portalPasswordApplied,
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
