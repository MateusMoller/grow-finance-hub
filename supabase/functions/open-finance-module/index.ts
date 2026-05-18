import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asRecord,
  asString,
  buildWebhookPublicUrl,
  getProviderAdapter,
  parseProvider,
  type OpenFinanceProvider,
  type ProviderAccount,
  type ProviderConnectionRef,
  type ProviderTransaction,
} from "../_shared/open-finance/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickClientStatus(
  providerStatus: string | null | undefined,
  disconnectedAt: string | null | undefined,
) {
  if (disconnectedAt) return "inactive";
  const token = String(providerStatus || "").trim().toLowerCase();
  if (!token) return "active";
  if (["updated", "success", "connected", "active"].includes(token)) return "active";
  if (["waiting_user_input", "pending", "user_authorization_pending"].includes(token)) return "pending_consent";
  if (["revoked", "expired", "login_error", "error", "site_not_available"].includes(token)) return "error";
  return "active";
}

function pickConsentStatus(providerStatus: string | null | undefined) {
  const token = String(providerStatus || "").trim().toLowerCase();
  if (["revoked", "user_authorization_revoked"].includes(token)) return "revoked";
  if (["expired"].includes(token)) return "expired";
  if (["pending", "waiting_user_input", "user_authorization_pending"].includes(token)) return "pending";
  if (!token) return "unknown";
  return "granted";
}

function deriveCashflowType(direction: string): "income" | "expense" {
  return direction === "in" ? "income" : "expense";
}

function deriveCashflowCategory(direction: string, rawCategory: string | null): string {
  if (rawCategory && rawCategory.trim().length > 0) return rawCategory.trim();
  return direction === "in" ? "Recebimento de clientes" : "Outras saidas";
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

async function isInternalUser(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data || []).some((row) => internalRoles.has(String(row.role)));
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

async function resolveClient(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: { userId: string; clientId?: string | null; isInternal: boolean },
) {
  if (params.clientId) {
    const { data: byId, error: byIdError } = await supabaseAdmin
      .from("clients")
      .select("id, organization_id, portal_user_id, portal_cashflow_enabled")
      .eq("id", params.clientId)
      .maybeSingle();
    if (byIdError) throw byIdError;
    if (!byId) throw new Error("Client not found.");

    if (!params.isInternal && byId.portal_user_id !== params.userId) {
      const { data: clientUser, error: clientUserError } = await supabaseAdmin
        .from("client_users")
        .select("id")
        .eq("client_id", byId.id)
        .eq("user_id", params.userId)
        .eq("status", "active")
        .maybeSingle();

      if (clientUserError) throw clientUserError;
      if (!clientUser) {
        throw new Error("Unauthorized client access.");
      }
    }

    return byId;
  }

  const { data: linkedClientUser, error: linkedClientUserError } = await supabaseAdmin
    .from("client_users")
    .select("client_id")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkedClientUserError) throw linkedClientUserError;

  if (linkedClientUser?.client_id) {
    const { data: linkedByMembership, error: linkedByMembershipError } = await supabaseAdmin
      .from("clients")
      .select("id, organization_id, portal_user_id, portal_cashflow_enabled")
      .eq("id", linkedClientUser.client_id)
      .maybeSingle();

    if (linkedByMembershipError) throw linkedByMembershipError;
    if (linkedByMembership) return linkedByMembership;
  }

  const { data: linkedClient, error: linkedClientError } = await supabaseAdmin
    .from("clients")
    .select("id, organization_id, portal_user_id, portal_cashflow_enabled")
    .eq("portal_user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkedClientError) throw linkedClientError;
  if (!linkedClient) throw new Error("No linked client found for this user.");
  return linkedClient;
}

async function upsertCashflowAccountsFromOpenFinanceAccounts(
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: Array<{
    id: string;
    client_id: string;
    connection_id: string;
    account_name: string | null;
    institution_name: string | null;
    account_mask: string | null;
    currency_code: string | null;
    is_active: boolean;
  }>,
) {
  if (rows.length === 0) return;

  const payload = rows.map((row) => ({
    client_id: row.client_id,
    label:
      `${row.account_name || row.institution_name || "Conta bancaria"}${row.account_mask ? ` (${row.account_mask})` : ""}`,
    source_type: "bank_open_finance",
    currency_code: row.currency_code || "BRL",
    open_finance_account_id: row.id,
    open_finance_connection_id: row.connection_id,
    institution_name: row.institution_name,
    account_mask: row.account_mask,
    is_primary: false,
    is_active: row.is_active,
    notes: "Conta vinculada automaticamente a partir do Open Finance.",
  }));

  const { error } = await supabaseAdmin
    .from("client_cashflow_accounts")
    .upsert(payload, { onConflict: "open_finance_account_id" });

  if (error) throw error;
}

async function getCashflowAccountMapForConnection(
  supabaseAdmin: ReturnType<typeof createClient>,
  connectionId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("client_cashflow_accounts")
    .select("id, open_finance_account_id")
    .eq("open_finance_connection_id", connectionId);

  if (error) throw error;

  return new Map(
    (data || [])
      .filter((row) => row.open_finance_account_id)
      .map((row) => [String(row.open_finance_account_id), String(row.id)]),
  );
}

async function persistSyncData(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  clientId: string;
  provider: OpenFinanceProvider;
  connection: ProviderConnectionRef;
  accounts: ProviderAccount[];
  transactions: ProviderTransaction[];
}) {
  const {
    supabaseAdmin,
    clientId,
    provider,
    connection,
    accounts,
    transactions,
  } = params;

  const nowIso = new Date().toISOString();

  const connectionUpsertPayload = {
    client_id: clientId,
    provider,
    external_item_id: connection.externalConnectionId,
    status: pickClientStatus(connection.status, null),
    consent_status: pickConsentStatus(connection.consentStatus),
    consent_expires_at: connection.consentExpiresAt || null,
    last_synced_at: nowIso,
    last_sync_error: null,
    disconnected_at: null,
  };

  const { data: connectionRow, error: connectionUpsertError } = await supabaseAdmin
    .from("open_finance_connections")
    .upsert(connectionUpsertPayload, { onConflict: "provider,external_item_id" })
    .select("id")
    .single();

  if (connectionUpsertError) throw connectionUpsertError;
  const connectionId = String(connectionRow.id);

  const accountUpsertPayload = accounts.map((account) => ({
    connection_id: connectionId,
    client_id: clientId,
    external_account_id: account.externalAccountId,
    account_name: account.accountName,
    account_type: account.accountType,
    institution_name: account.institutionName,
    account_mask: account.accountMask,
    currency_code: account.currencyCode || "BRL",
    is_active: account.isActive,
  }));

  let accountIdByExternalId = new Map<string, string>();
  let persistedOpenFinanceAccounts: Array<{
    id: string;
    client_id: string;
    connection_id: string;
    external_account_id: string;
    account_name: string | null;
    institution_name: string | null;
    account_mask: string | null;
    currency_code: string | null;
    is_active: boolean;
  }> = [];

  if (accountUpsertPayload.length > 0) {
    const { data: accountRows, error: accountUpsertError } = await supabaseAdmin
      .from("open_finance_accounts")
      .upsert(accountUpsertPayload, { onConflict: "connection_id,external_account_id" })
      .select("id, client_id, connection_id, external_account_id, account_name, institution_name, account_mask, currency_code, is_active");
    if (accountUpsertError) throw accountUpsertError;
    persistedOpenFinanceAccounts = (accountRows || []).map((row) => ({
      id: String(row.id),
      client_id: String(row.client_id),
      connection_id: String(row.connection_id),
      external_account_id: String(row.external_account_id),
      account_name: row.account_name ? String(row.account_name) : null,
      institution_name: row.institution_name ? String(row.institution_name) : null,
      account_mask: row.account_mask ? String(row.account_mask) : null,
      currency_code: row.currency_code ? String(row.currency_code) : null,
      is_active: Boolean(row.is_active),
    }));
    accountIdByExternalId = new Map(
      persistedOpenFinanceAccounts.map((row) => [row.external_account_id, row.id]),
    );
  } else {
    const { data: existingAccounts, error: existingAccountsError } = await supabaseAdmin
      .from("open_finance_accounts")
      .select("id, client_id, connection_id, external_account_id, account_name, institution_name, account_mask, currency_code, is_active")
      .eq("connection_id", connectionId);
    if (existingAccountsError) throw existingAccountsError;
    persistedOpenFinanceAccounts = (existingAccounts || []).map((row) => ({
      id: String(row.id),
      client_id: String(row.client_id),
      connection_id: String(row.connection_id),
      external_account_id: String(row.external_account_id),
      account_name: row.account_name ? String(row.account_name) : null,
      institution_name: row.institution_name ? String(row.institution_name) : null,
      account_mask: row.account_mask ? String(row.account_mask) : null,
      currency_code: row.currency_code ? String(row.currency_code) : null,
      is_active: Boolean(row.is_active),
    }));
    accountIdByExternalId = new Map(
      persistedOpenFinanceAccounts.map((row) => [row.external_account_id, row.id]),
    );
  }

  await upsertCashflowAccountsFromOpenFinanceAccounts(supabaseAdmin, persistedOpenFinanceAccounts);
  const cashflowAccountIdByOpenFinanceAccountId = await getCashflowAccountMapForConnection(supabaseAdmin, connectionId);

  const transactionUpsertPayload = transactions
    .map((transaction) => {
      const accountId = accountIdByExternalId.get(transaction.externalAccountId) || null;
      if (!accountId) return null;
      return {
        connection_id: connectionId,
        account_id: accountId,
        client_id: clientId,
        external_transaction_id: transaction.externalTransactionId,
        occurred_at: transaction.occurredAt,
        description: transaction.description,
        amount: transaction.amount,
        direction: transaction.direction,
        category: transaction.category,
        provider_payload_min: transaction.payloadMin,
      };
    })
    .filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));

  if (transactionUpsertPayload.length > 0) {
    const { error: transactionUpsertError } = await supabaseAdmin
      .from("open_finance_transactions")
      .upsert(transactionUpsertPayload, { onConflict: "connection_id,external_transaction_id" });
    if (transactionUpsertError) throw transactionUpsertError;
  }

  const { data: pendingTransactions, error: pendingTransactionsError } = await supabaseAdmin
    .from("open_finance_transactions")
    .select("id, account_id, occurred_at, description, amount, direction, category, external_transaction_id")
    .eq("connection_id", connectionId)
    .is("imported_to_cashflow_at", null)
    .order("occurred_at", { ascending: true })
    .limit(1000);

  if (pendingTransactionsError) throw pendingTransactionsError;

  const source = `open_finance_${provider}`;
  const pendingRows = pendingTransactions || [];
  const integrationKeys = pendingRows.map((row) => `${source}:${row.external_transaction_id}`);

  let existingIntegrationKeys = new Set<string>();
  if (integrationKeys.length > 0) {
    const { data: existingEntries, error: existingEntriesError } = await supabaseAdmin
      .from("client_cashflow_entries")
      .select("integration_key")
      .eq("client_id", clientId)
      .eq("integration_source", source)
      .in("integration_key", integrationKeys);

    if (existingEntriesError) throw existingEntriesError;
    existingIntegrationKeys = new Set((existingEntries || []).map((row) => String(row.integration_key)));
  }

  const cashflowUpsertPayload = pendingRows
    .filter((row) => !existingIntegrationKeys.has(`${source}:${row.external_transaction_id}`))
    .map((row) => {
      const effectiveDate = String(row.occurred_at).slice(0, 10);
      const competenceMonth = `${effectiveDate.slice(0, 7)}-01`;
      const integrationAccountId = String(row.account_id);

      return {
        client_id: clientId,
        entry_date: effectiveDate,
        due_date: effectiveDate,
        effective_date: effectiveDate,
        competence_month: competenceMonth,
        account_id: cashflowAccountIdByOpenFinanceAccountId.get(integrationAccountId) || null,
        entry_type: deriveCashflowType(String(row.direction)),
        category: deriveCashflowCategory(String(row.direction), asString(row.category)),
        description: asString(row.description) || "Lancamento bancario",
        amount: Number(Number(row.amount || 0).toFixed(2)),
        status: "confirmed",
        lifecycle_status: "confirmed",
        origin_type: "open_finance",
        reconciliation_status: "pending",
        review_status: "pending_review",
        created_by: null,
        integration_source: source,
        integration_key: `${source}:${row.external_transaction_id}`,
        integration_connection_id: connectionId,
        integration_account_id: integrationAccountId,
      };
    });

  if (cashflowUpsertPayload.length > 0) {
    const { error: cashflowUpsertError } = await supabaseAdmin
      .from("client_cashflow_entries")
      .upsert(cashflowUpsertPayload, {
        onConflict: "client_id,integration_source,integration_key",
        ignoreDuplicates: true,
      });
    if (cashflowUpsertError) throw cashflowUpsertError;
  }

  if (pendingRows.length > 0) {
    const { error: markImportedError } = await supabaseAdmin
      .from("open_finance_transactions")
      .update({ imported_to_cashflow_at: nowIso })
      .in("id", pendingRows.map((row) => row.id));

    if (markImportedError) throw markImportedError;
  }

  return {
    connectionId,
    syncedAccounts: accounts.length,
    syncedTransactions: transactions.length,
    importedEntries: cashflowUpsertPayload.length,
  };
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
    if (!token) return jsonResponse({ error: "Missing authorization token" }, 401);

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const user = authData.user;
    const internal = await isInternalUser(supabaseAdmin, user.id);

    const rawBody = await req.json().catch(() => ({}));
    const body = asRecord(rawBody) || {};
    const action = asString(body.action) || "list_connections";
    const provider = body.provider ? parseProvider(body.provider) : parseProvider("pluggy");
    const adapter = getProviderAdapter(provider);

    if (action === "create_connect_session") {
      const clientId = asString(body.clientId);
      const client = await resolveClient(supabaseAdmin, { userId: user.id, clientId, isInternal: internal });
      await ensureOrganizationFeatureEnabled(supabaseAdmin, String(client.organization_id), "open_finance");
      if (!client.portal_cashflow_enabled) {
        return jsonResponse({ error: "Cashflow module is not enabled for this client." }, 403);
      }

      const webhookUrl = buildWebhookPublicUrl(supabaseUrl);
      const sessionData = await adapter.createConnectSession({
        clientUserId: client.id,
        webhookUrl,
      });
      return jsonResponse({
        provider,
        clientId: client.id,
        sessionToken: sessionData.sessionToken,
        connectUrl: sessionData.connectUrl || null,
        expiresAt: sessionData.expiresAt || null,
      });
    }

    if (action === "list_connections") {
      const clientId = asString(body.clientId);
      const client = await resolveClient(supabaseAdmin, { userId: user.id, clientId, isInternal: internal });
      await ensureOrganizationFeatureEnabled(supabaseAdmin, String(client.organization_id), "open_finance");

      const { data: connections, error: connectionsError } = await supabaseAdmin
        .from("open_finance_connections")
        .select("id, client_id, provider, status, consent_status, consent_expires_at, external_item_id, last_synced_at, last_sync_error, disconnected_at, created_at, updated_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (connectionsError) throw connectionsError;

      const connectionIds = (connections || []).map((connection) => String(connection.id));
      let accounts: unknown[] = [];
      if (connectionIds.length > 0) {
        const { data: accountsData, error: accountsError } = await supabaseAdmin
          .from("open_finance_accounts")
          .select("id, connection_id, external_account_id, account_name, account_type, institution_name, account_mask, currency_code, is_active")
          .in("connection_id", connectionIds)
          .order("created_at", { ascending: false });
        if (accountsError) throw accountsError;
        accounts = accountsData || [];
      }

      return jsonResponse({ connections: connections || [], accounts });
    }

    if (action === "manual_sync") {
      const connectionId = asString(body.connectionId);
      if (!connectionId) return jsonResponse({ error: "connectionId is required" }, 400);

      const { data: connectionRow, error: connectionError } = await supabaseAdmin
        .from("open_finance_connections")
        .select("id, client_id, provider, external_item_id, status, disconnected_at")
        .eq("id", connectionId)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connectionRow) return jsonResponse({ error: "Connection not found." }, 404);

      const client = await resolveClient(supabaseAdmin, {
        userId: user.id,
        clientId: String(connectionRow.client_id),
        isInternal: internal,
      });
      await ensureOrganizationFeatureEnabled(supabaseAdmin, String(client.organization_id), "open_finance");

      const rowProvider = parseProvider(connectionRow.provider);
      const rowAdapter = getProviderAdapter(rowProvider);
      const syncData = await rowAdapter.syncConnection({
        externalConnectionId: String(connectionRow.external_item_id),
      });

      const persisted = await persistSyncData({
        supabaseAdmin,
        clientId: String(connectionRow.client_id),
        provider: rowProvider,
        connection: syncData.connection,
        accounts: syncData.accounts,
        transactions: syncData.transactions,
      });

      return jsonResponse({
        connectionId,
        syncedAccounts: persisted.syncedAccounts,
        syncedTransactions: persisted.syncedTransactions,
        importedEntries: persisted.importedEntries,
      });
    }

    if (action === "disconnect_connection") {
      const connectionId = asString(body.connectionId);
      if (!connectionId) return jsonResponse({ error: "connectionId is required" }, 400);

      const { data: connectionRow, error: connectionError } = await supabaseAdmin
        .from("open_finance_connections")
        .select("id, client_id, provider, external_item_id")
        .eq("id", connectionId)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connectionRow) return jsonResponse({ error: "Connection not found." }, 404);

      const client = await resolveClient(supabaseAdmin, {
        userId: user.id,
        clientId: String(connectionRow.client_id),
        isInternal: internal,
      });
      await ensureOrganizationFeatureEnabled(supabaseAdmin, String(client.organization_id), "open_finance");

      const rowProvider = parseProvider(connectionRow.provider);
      const rowAdapter = getProviderAdapter(rowProvider);
      await rowAdapter.disconnectConnection({
        externalConnectionId: String(connectionRow.external_item_id),
      });

      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("open_finance_connections")
        .update({
          status: "inactive",
          consent_status: "revoked",
          disconnected_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", connectionId);
      if (updateError) throw updateError;

      return jsonResponse({ success: true });
    }

    if (action === "import_transactions_to_cashflow") {
      const connectionId = asString(body.connectionId);
      if (!connectionId) return jsonResponse({ error: "connectionId is required" }, 400);
      const { data: connectionRow, error: connectionError } = await supabaseAdmin
        .from("open_finance_connections")
        .select("id, client_id, provider, external_item_id")
        .eq("id", connectionId)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connectionRow) return jsonResponse({ error: "Connection not found." }, 404);

      const client = await resolveClient(supabaseAdmin, {
        userId: user.id,
        clientId: String(connectionRow.client_id),
        isInternal: internal,
      });
      await ensureOrganizationFeatureEnabled(supabaseAdmin, String(client.organization_id), "open_finance");

      const rowProvider = parseProvider(connectionRow.provider);
      const rowAdapter = getProviderAdapter(rowProvider);
      const syncData = await rowAdapter.syncConnection({
        externalConnectionId: String(connectionRow.external_item_id),
      });
      const persisted = await persistSyncData({
        supabaseAdmin,
        clientId: String(connectionRow.client_id),
        provider: rowProvider,
        connection: syncData.connection,
        accounts: syncData.accounts,
        transactions: syncData.transactions,
      });

      return jsonResponse({
        success: true,
        syncedAccounts: persisted.syncedAccounts,
        syncedTransactions: persisted.syncedTransactions,
        importedEntries: persisted.importedEntries,
      });
    }

    return jsonResponse({ error: "Unsupported action." }, 400);
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
