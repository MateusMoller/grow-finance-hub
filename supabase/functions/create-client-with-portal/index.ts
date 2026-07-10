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
  clientEntityType: "matriz" | "filial";
  parentClientId?: string | null;
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

type ParentClientRow = {
  id: string;
  organization_id: string;
  client_entity_type: string | null;
};

type RoleRow = {
  role: string;
  organization_id: string | null;
};

type AccessRow = {
  organization_id: string;
  primary_role: string | null;
  status: string | null;
  requires_access_review: boolean | null;
};

type ModuleGrantRow = {
  organization_id: string;
  module_key: string | null;
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

function asUuid(value: unknown): string | null {
  const maybeUuid = asTrimmedString(value);
  if (!maybeUuid) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(maybeUuid) ? maybeUuid : null;
}

function normalizeClientEntityType(value: unknown): "matriz" | "filial" {
  const normalized = asTrimmedString(value)?.toLowerCase();
  return normalized === "filial" ? "filial" : "matriz";
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

function normalizePhone(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const rawDigits = text.replace(/\D/g, "");
  let digits = rawDigits;

  if (rawDigits.startsWith("55") && rawDigits.length >= 12) {
    const withoutCountryCode = rawDigits.slice(2);
    if (withoutCountryCode.length >= 10) {
      digits = withoutCountryCode.slice(-11);
    }
  } else if (rawDigits.length > 11) {
    digits = rawDigits.slice(-11);
  }

  if (digits.length < 10 || digits.length > 11) return null;

  const ddd = digits.slice(0, 2);
  const phoneDigits = digits.slice(2);
  if (phoneDigits.length <= 8) {
    return `(${ddd}) ${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
  }
  return `(${ddd}) ${phoneDigits.slice(0, 5)}-${phoneDigits.slice(5)}`;
}

function normalizeTaxRegime(value: unknown): string | null {
  const normalized = (asTrimmedString(value) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const aliases = new Map([
    ["simples", "simples_nacional"],
    ["simples nacional", "simples_nacional"],
    ["lucro presumido", "lucro_presumido"],
    ["presumido", "lucro_presumido"],
    ["lucro real", "lucro_real"],
    ["real", "lucro_real"],
    ["mei", "mei"],
    ["simei", "mei"],
  ]);
  return aliases.get(normalized) || null;
}

async function applyDefaultObligationsAfterClientCreate(params: {
  supabaseUrl: string;
  anonKey: string;
  token: string;
  organizationId: string;
  clientId: string;
  taxRegimeCode: string | null;
}) {
  if (!params.taxRegimeCode) {
    return { ok: false, warning: "Regime tributario ausente ou nao suportado; obrigacoes padrao nao aplicadas." };
  }

  const response = await fetch(`${params.supabaseUrl}/functions/v1/grow-obligations-module`, {
    method: "POST",
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
      apikey: params.anonKey,
    },
    body: JSON.stringify({
      action: "apply_default_obligations",
      organization_id: params.organizationId,
      client_id: params.clientId,
      tax_regime_code: params.taxRegimeCode,
      mode: "new_client",
      evidence: {},
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      warning: payload?.error || "Cliente cadastrado, mas houve falha ao aplicar obrigacoes padrao.",
    };
  }
  return { ok: true, payload };
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

async function insertAuditLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    organizationId: string;
    actorUserId: string;
    clientId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    result?: string;
    metadata?: JsonRecord;
  },
) {
  await supabaseAdmin.from("operational_audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId,
    client_id: params.clientId || null,
    action: params.action,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
    result: params.result || "success",
    metadata: params.metadata || {},
  });
}

async function ensureOrganizationFeatureEnabled(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  featureKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  const flags = asRecord(data?.feature_flags);
  if (flags && flags[featureKey] === false) {
    throw new Error(`Modulo ${featureKey} desativado para esta organizacao.`);
  }
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

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }
    const requestedOrganizationId = asUuid(payload.organizationId ?? payload.organization_id);

    const { data: callerAccessRows, error: callerAccessError } = await supabaseAdmin
      .from("organization_user_access")
      .select("organization_id, primary_role, status, requires_access_review")
      .eq("user_id", callerUser.id)
      .eq("status", "active");

    if (callerAccessError) {
      throw callerAccessError;
    }

    const activeCanonicalAccess = ((callerAccessRows || []) as AccessRow[]).filter(
      (row) => !row.requires_access_review && (!requestedOrganizationId || row.organization_id === requestedOrganizationId),
    );

    const canonicalOrganizationIds = activeCanonicalAccess.map((row) => row.organization_id);
    const { data: callerModuleGrants, error: callerModuleGrantsError } = canonicalOrganizationIds.length > 0
      ? await supabaseAdmin
          .from("user_module_grants")
          .select("organization_id, module_key")
          .eq("user_id", callerUser.id)
          .in("organization_id", canonicalOrganizationIds)
          .eq("module_key", "cadastrar_clientes")
      : { data: [], error: null };

    if (callerModuleGrantsError) {
      throw callerModuleGrantsError;
    }

    const createClientGrantOrganizations = new Set(
      ((callerModuleGrants || []) as ModuleGrantRow[]).map((row) => row.organization_id),
    );
    const canonicalCreatorAccess = activeCanonicalAccess.find(
      (row) =>
        row.primary_role === "admin" ||
        (row.primary_role === "colaborador" && createClientGrantOrganizations.has(row.organization_id)),
    );

    const { data: callerRoles, error: callerRolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", callerUser.id);

    if (callerRolesError) {
      throw callerRolesError;
    }

    const legacyCreatorRole = ((callerRoles || []) as RoleRow[]).find(
      (roleRow) =>
        clientCreatorRoles.has(roleRow.role) &&
        roleRow.organization_id &&
        (!requestedOrganizationId || roleRow.organization_id === requestedOrganizationId),
    );
    const organizationId = canonicalCreatorAccess?.organization_id || legacyCreatorRole?.organization_id;
    if (!organizationId) {
      return jsonResponse(
        { error: "Seu perfil nao possui permissao para cadastrar clientes." },
        403,
      );
    }
    await ensureOrganizationFeatureEnabled(supabaseAdmin, organizationId, "portal");

    const parsedPayload: CreateClientPayload = {
      name: asTrimmedString(payload.name) || "",
      cnpj: asTrimmedString(payload.cnpj) || undefined,
      regime: asTrimmedString(payload.regime) || undefined,
      sector: asTrimmedString(payload.sector) || undefined,
      contact: asTrimmedString(payload.contact) || undefined,
      email: normalizeEmail(payload.email) || "",
      phone: asTrimmedString(payload.phone) || undefined,
      clientEntityType: normalizeClientEntityType(payload.clientEntityType),
      parentClientId: asUuid(payload.parentClientId),
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

    const normalizedPhone = parsedPayload.phone ? normalizePhone(parsedPayload.phone) : null;
    if (parsedPayload.phone && !normalizedPhone) {
      return jsonResponse({ error: "Informe um telefone valido com DDD ou deixe o campo em branco." }, 400);
    }

    const normalizedPortalPassword = parsedPayload.portalPassword || "123456";
    const isBranchClient = parsedPayload.clientEntityType === "filial";
    let parentClient: ParentClientRow | null = null;

    if (isBranchClient) {
      if (!parsedPayload.parentClientId) {
        return jsonResponse({ error: "Selecione a matriz desta filial." }, 400);
      }

      const { data: parentClientData, error: parentClientError } = await supabaseAdmin
        .from("clients")
        .select("id, organization_id, client_entity_type")
        .eq("id", parsedPayload.parentClientId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (parentClientError) {
        throw parentClientError;
      }

      parentClient = parentClientData as ParentClientRow | null;
      if (!parentClient || parentClient.client_entity_type === "filial") {
        return jsonResponse({ error: "A matriz vinculada precisa ser um cliente do tipo matriz." }, 400);
      }
    }

    const clientMatchFilters = [
      isBranchClient ? null : `email.ilike.${parsedPayload.email}`,
      normalizedCnpj ? `cnpj.eq.${normalizedCnpj}` : null,
    ].filter(Boolean);

    let existingClientToLink: ExistingClientRow | null = null;
    if (clientMatchFilters.length > 0) {
      const { data: existingClientMatches, error: existingClientError } = await supabaseAdmin
        .from("clients")
        .select("id, email, cnpj, portal_user_id, status")
        .or(clientMatchFilters.join(","))
        .eq("organization_id", organizationId)
        .limit(10);

      if (existingClientError) {
        throw existingClientError;
      }

      const matches = (existingClientMatches || []) as ExistingClientRow[];
      const emailMatch = isBranchClient
        ? null
        : matches.find((client) => normalizeEmail(client.email) === parsedPayload.email);
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
      .select("role, organization_id")
      .eq("user_id", portalUserId);

    if (existingRolesError) {
      throw existingRolesError;
    }

    const hasInternalRole = ((existingRoles || []) as RoleRow[]).some(
      (row) => row.organization_id === organizationId && internalRoles.has(row.role),
    );
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
        .eq("organization_id", organizationId)
        .limit(1);

    if (existingClientByPortalUserError) {
      throw existingClientByPortalUserError;
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
      { user_id: portalUserId, organization_id: organizationId, role: "client" },
      { onConflict: "user_id,organization_id,role" },
    );

    if (roleUpsertError) {
      throw roleUpsertError;
    }

    const { error: canonicalAccessError } = await supabaseAdmin
      .from("organization_user_access")
      .upsert(
        {
          user_id: portalUserId,
          organization_id: organizationId,
          primary_role: "cliente",
          status: "active",
          sector_code: null,
          requires_access_review: false,
          updated_by: callerUser.id,
        },
        { onConflict: "organization_id,user_id" },
      );

    if (canonicalAccessError) {
      throw canonicalAccessError;
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
      phone: normalizedPhone || null,
      obligation_completion_whatsapp_enabled: Boolean(parsedPayload.obligationCompletionWhatsAppEnabled),
      portal_user_id: portalUserId,
      client_entity_type: parsedPayload.clientEntityType,
      parent_client_id: isBranchClient ? parsedPayload.parentClientId : null,
      organization_id: organizationId,
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
      await insertAuditLog(supabaseAdmin, {
        organizationId,
        actorUserId: callerUser.id,
        action: "client_create_with_portal_failed",
        entityType: "client",
        result: "error",
        metadata: { email: parsedPayload.email, error: createClientError.message },
      }).catch(console.error);
      throw createClientError;
    }

    const { error: clientUserLinkError } = await supabaseAdmin.from("client_users").upsert(
      {
        organization_id: organizationId,
        client_id: createdClient.id,
        user_id: portalUserId,
        role: "owner",
        status: "active",
      },
      { onConflict: "client_id,user_id" },
    );

    if (clientUserLinkError) {
      throw clientUserLinkError;
    }

    await insertAuditLog(supabaseAdmin, {
      organizationId,
      actorUserId: callerUser.id,
      clientId: createdClient.id,
      action: existingClientToLink ? "client_portal_access_linked" : "client_created_with_portal",
      entityType: "client",
      entityId: createdClient.id,
      metadata: {
        email: parsedPayload.email,
        clientEntityType: parsedPayload.clientEntityType,
        parentClientId: isBranchClient ? parsedPayload.parentClientId : null,
        portalUserCreatedNow,
        portalAccessLinkType,
      },
    }).catch(console.error);

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

    const defaultObligations = await applyDefaultObligationsAfterClientCreate({
      supabaseUrl,
      anonKey,
      token,
      organizationId,
      clientId: createdClient.id,
      taxRegimeCode: normalizeTaxRegime(clientWritePayload.regime),
    }).catch((error) => ({
      ok: false,
      warning: error instanceof Error ? error.message : "Cliente cadastrado, mas houve falha ao aplicar obrigacoes padrao.",
    }));

    return jsonResponse({
      ok: true,
      client: createdClient,
      default_obligations: defaultObligations,
      portal_user_created_now: portalUserCreatedNow,
      portal_user_id: portalUserId,
      portal_access_link: portalAccessLink,
      portal_access_link_type: portalAccessLinkType,
      portal_password_applied: portalPasswordApplied,
      organization_id: organizationId,
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
