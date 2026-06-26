import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import type {
  AuthenticatedAssistantRequestContext,
  AuthorizedClientContext,
  AuthorizedClientDocument,
  AuthorizedClientGuideStatus,
  AuthorizedClientPendingTask,
  AuthorizedClientRequest,
} from "./types.ts";
import { CLIENT_ROLE, INTERNAL_ROLES } from "./types.ts";
import {
  asTrimmedString,
  jsonResponse,
  maskCnpj,
  normalizeRoles,
} from "./utils.ts";

const internalRoleSet = new Set<string>(INTERNAL_ROLES);
const clientSelect =
  "id, organization_id, name, cnpj, sector, status, contact, email, phone, portal_user_id, portal_cashflow_enabled";

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function buildAssistantRequestContext(
  req: Request,
): Promise<AuthenticatedAssistantRequestContext | { error: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return { error: jsonResponse({ error: "Missing Supabase environment configuration." }, 500) };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { error: jsonResponse({ error: "Authorization token is required." }, 401) };
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: "Invalid or expired session." }, 401) };
  }

  const [
    { data: canonicalData, error: canonicalError },
    { data: rolesData, error: rolesError },
    { data: profileData },
  ] = await Promise.all([
    supabaseAdmin
      .from("organization_user_access")
      .select("primary_role, organization_id, status, requires_access_review")
      .eq("user_id", user.id),
    supabaseAdmin
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", user.id),
    supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (canonicalError || rolesError) {
    return { error: jsonResponse({ error: "Failed to resolve requester roles." }, 500) };
  }

  const canonicalRoles = (canonicalData || [])
    .filter((row) => row.status === "active" && !row.requires_access_review)
    .map((row) => String(row.primary_role || ""));
  const roles = normalizeRoles([
    ...canonicalRoles,
    ...(rolesData || []).map((row) => String(row.role || "")),
  ]);
  const organizationIds = Array.from(
    new Set(
      [...(canonicalData || []), ...(rolesData || [])]
        .map((row) => asTrimmedString((row as { organization_id?: unknown }).organization_id))
        .filter((organizationId): organizationId is string => Boolean(organizationId)),
    ),
  );
  const isInternalUser = roles.some((role) => internalRoleSet.has(role) || role === "colaborador");
  const isClientUser = roles.some((role) => role === CLIENT_ROLE || role === "cliente");

  return {
    supabaseAdmin,
    supabaseUser,
    requester: {
      userId: user.id,
      email: user.email || null,
      displayName: asTrimmedString(profileData?.display_name) || null,
      identityMethod: "session",
      isIdentityVerified: true,
    },
    roles,
    organizationIds,
    isInternalUser,
    isClientUser,
  };
}

async function hasInternalRoleForOrganization(
  supabaseAdmin: SupabaseClient,
  userId: string,
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .in("role", INTERNAL_ROLES as unknown as string[])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function assertOrganizationFeatureEnabled(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  featureKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  const flags = data?.feature_flags;
  if (
    flags &&
    typeof flags === "object" &&
    !Array.isArray(flags) &&
    (flags as Record<string, unknown>)[featureKey] === false
  ) {
    throw new Error("This module is disabled for the active organization.");
  }
}

function buildPermissions(isInternalUser: boolean) {
  return {
    canConsultClientData: true,
    canCreateTickets: true,
    canConsultGuides: true,
    canGenerateOperationalSummaries: true,
    canRequestReports: true,
    canReceiveSensitiveReportsDirectly: isInternalUser,
    requiresHumanReviewForSensitiveActions: true,
    requiresSecureLinkForSensitiveReports: true,
  };
}

export async function getAuthorizedClientContext(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  requesterRoles?: string[];
  clienteId?: string | null;
  requesterDisplayName?: string | null;
  requesterEmail?: string | null;
  requesterIdentityMethod?: "session" | "phone_match";
  requesterIdentityVerified?: boolean;
}): Promise<AuthorizedClientContext> {
  const requesterRoles = normalizeRoles(params.requesterRoles || []);
  const isInternalUser = requesterRoles.some((role) => internalRoleSet.has(role) || role === "colaborador");
  const isClientUser = requesterRoles.some((role) => role === CLIENT_ROLE || role === "cliente");

  if (!isInternalUser && !isClientUser) {
    throw new Error("Requester has no permission to use the Grow assistant.");
  }

  let clientRow:
    | {
        id: string;
        organization_id: string;
        name: string;
        cnpj: string | null;
        sector: string | null;
        status: string | null;
        contact: string | null;
        email: string | null;
        phone: string | null;
        portal_user_id: string | null;
        portal_cashflow_enabled: boolean;
      }
    | null = null;

  if (isClientUser && !isInternalUser) {
    const { data: linkedClientUsers, error: linkedClientUsersError } = await params.supabaseAdmin
      .from("client_users")
      .select("client_id")
      .eq("user_id", params.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (linkedClientUsersError) throw linkedClientUsersError;

    const linkedClientIds = Array.from(
      new Set(
        (linkedClientUsers || [])
          .map((row) => asTrimmedString(row.client_id))
          .filter((clientId): clientId is string => Boolean(clientId)),
      ),
    );

    let linkedClients:
      | Array<{
          id: string;
          organization_id: string;
          name: string;
          cnpj: string | null;
          sector: string | null;
          status: string | null;
          contact: string | null;
          email: string | null;
          phone: string | null;
          portal_user_id: string | null;
          portal_cashflow_enabled: boolean;
        }>
      | null = null;

    if (linkedClientIds.length > 0) {
      const { data, error } = await params.supabaseAdmin
        .from("clients")
        .select(clientSelect)
        .in("id", linkedClientIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      linkedClients = data || [];
    } else {
      const { data, error } = await params.supabaseAdmin
        .from("clients")
        .select(clientSelect)
        .eq("portal_user_id", params.userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      linkedClients = data || [];
    }

    if (!linkedClients || linkedClients.length === 0) {
      throw new Error("No client is linked to this portal user.");
    }
    if (linkedClients.length > 1) {
      throw new Error("More than one client is linked to this portal user. Human review is required.");
    }

    const onlyClient = linkedClients[0];
    if (params.clienteId && onlyClient.id !== params.clienteId) {
      throw new Error("The requester is not authorized to access the requested client.");
    }

    clientRow = onlyClient;
  } else {
    const selectedClientId = asTrimmedString(params.clienteId);
    if (!selectedClientId) {
      throw new Error("clienteId is required for internal assistant usage.");
    }

    const { data, error } = await params.supabaseAdmin
      .from("clients")
      .select(clientSelect)
      .eq("id", selectedClientId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Requested client was not found.");
    }

    clientRow = data;
  }

  if (!clientRow) {
    throw new Error("Unable to resolve an authorized client context.");
  }

  if (isInternalUser) {
    const hasTenantRole = await hasInternalRoleForOrganization(
      params.supabaseAdmin,
      params.userId,
      clientRow.organization_id,
    );

    if (!hasTenantRole) {
      throw new Error("The requester is not authorized for this organization.");
    }
  }

  await assertOrganizationFeatureEnabled(params.supabaseAdmin, clientRow.organization_id, "ia");

  let requestOwnerId = clientRow.portal_user_id;
  if (!requestOwnerId) {
    const { data: clientOwner } = await params.supabaseAdmin
      .from("client_users")
      .select("user_id")
      .eq("organization_id", clientRow.organization_id)
      .eq("client_id", clientRow.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    requestOwnerId = asTrimmedString(clientOwner?.user_id);
  }

  const requestQuery = requestOwnerId
    ? params.supabaseAdmin
        .from("client_requests")
        .select("id, title, description, category, sector, status, created_at, updated_at")
        .eq("organization_id", clientRow.organization_id)
        .eq("client_id", clientRow.id)
        .eq("user_id", requestOwnerId)
        .order("created_at", { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [], error: null });

  const documentQuery = requestOwnerId
    ? params.supabaseAdmin
        .from("client_documents")
        .select("id, file_name, category, created_at, request_id")
        .eq("organization_id", clientRow.organization_id)
        .eq("client_id", clientRow.id)
        .eq("user_id", requestOwnerId)
        .order("created_at", { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [], error: null });

  const [tasksResult, requestsResult, documentsResult, guidesResult] = await Promise.all([
    params.supabaseAdmin
      .from("client_portal_tasks")
      .select("id, title, description, status, sector, type, due_date")
      .eq("organization_id", clientRow.organization_id)
      .eq("client_id", clientRow.id)
      .order("due_date", { ascending: true })
      .limit(15),
    requestQuery,
    documentQuery,
    params.supabaseAdmin
      .from("client_acessorias_obligations")
      .select("id, obligation_name, obligation_period, due_date, status, protocol, notes")
      .eq("organization_id", clientRow.organization_id)
      .eq("client_id", clientRow.id)
      .order("due_date", { ascending: false })
      .limit(15),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (requestsResult.error) throw requestsResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (guidesResult.error) throw guidesResult.error;

  const pendingTasks: AuthorizedClientPendingTask[] = (tasksResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    sector: row.sector,
    type: row.type,
    dueDate: row.due_date,
  }));

  const recentRequests: AuthorizedClientRequest[] = (requestsResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    sector: row.sector,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const recentDocuments: AuthorizedClientDocument[] = (documentsResult.data || []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    category: row.category,
    createdAt: row.created_at,
    requestId: row.request_id,
  }));

  const guideStatuses: AuthorizedClientGuideStatus[] = (guidesResult.data || []).map((row) => ({
    id: row.id,
    obligationName: row.obligation_name,
    obligationPeriod: row.obligation_period,
    dueDate: row.due_date,
    status: row.status,
    protocol: row.protocol,
    notes: row.notes,
  }));

  return {
    requester: {
      userId: params.userId,
      email: params.requesterEmail || null,
      displayName: params.requesterDisplayName || null,
      identityMethod: params.requesterIdentityMethod || "session",
      isIdentityVerified: params.requesterIdentityVerified ?? true,
      roles: requesterRoles,
      isInternalUser,
      isClientUser,
    },
    client: {
      id: clientRow.id,
      organizationId: clientRow.organization_id,
      name: clientRow.name,
      cnpjMasked: maskCnpj(clientRow.cnpj),
      cnpjDigits: asTrimmedString(clientRow.cnpj)?.replace(/\D/g, "") || null,
      sector: clientRow.sector,
      status: clientRow.status,
      contact: clientRow.contact,
      email: clientRow.email,
      phone: clientRow.phone,
      portalUserId: clientRow.portal_user_id,
      portalCashflowEnabled: clientRow.portal_cashflow_enabled,
    },
    permissions: buildPermissions(isInternalUser),
    pendingTasks,
    recentRequests,
    recentDocuments,
    guideStatuses,
  };
}
