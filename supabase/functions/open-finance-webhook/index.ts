import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asRecord,
  asString,
  getProviderAdapter,
  parseProvider,
  type OpenFinanceProvider,
  type ProviderAccount,
  type ProviderConnectionRef,
  type ProviderTransaction,
} from "../_shared/open-finance/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-open-finance-provider, x-provider, x-webhook-provider, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function resolveProvider(headers: Headers, payload: Record<string, unknown>): OpenFinanceProvider {
  const headerProvider =
    headers.get("x-open-finance-provider") ||
    headers.get("x-webhook-provider") ||
    headers.get("x-provider");
  const payloadProvider = asString(payload.provider);
  const selected = headerProvider || payloadProvider;
  if (!selected) {
    throw new Error("Webhook provider is required. Use x-open-finance-provider header.");
  }
  return parseProvider(selected);
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
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
    }

    const rawBody = await req.json().catch(() => ({}));
    const body = asRecord(rawBody) || {};
    const provider = resolveProvider(req.headers, body);
    const adapter = getProviderAdapter(provider);
    const event = await adapter.parseWebhookEvent({
      headers: req.headers,
      body,
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const receivedAt = new Date().toISOString();

    const { error: eventUpsertError } = await supabaseAdmin
      .from("open_finance_webhook_events")
      .upsert(
        {
          provider,
          event_id: event.eventId,
          event_type: event.eventType,
          payload_min: event.payloadMin,
          processing_status: "pending",
          attempt_count: 1,
          received_at: receivedAt,
        },
        { onConflict: "provider,event_id" },
      );
    if (eventUpsertError) throw eventUpsertError;

    if (!event.externalConnectionId) {
      await supabaseAdmin
        .from("open_finance_webhook_events")
        .update({
          processing_status: "ignored",
          processed_at: new Date().toISOString(),
          last_error: "Missing externalConnectionId in webhook payload",
        })
        .eq("provider", provider)
        .eq("event_id", event.eventId);
      return jsonResponse({ ok: true, ignored: true });
    }

    const { data: initialConnectionRow, error: connectionError } = await supabaseAdmin
      .from("open_finance_connections")
      .select("id, client_id, provider, external_item_id")
      .eq("provider", provider)
      .eq("external_item_id", event.externalConnectionId)
      .maybeSingle();
    if (connectionError) throw connectionError;
    let connectionRow = initialConnectionRow;

    if (!connectionRow) {
      const candidateClientId =
        asString(body.clientUserId) ||
        asString(asRecord(body.item)?.clientUserId) ||
        asString(asRecord(body.connection)?.clientUserId);
      if (!candidateClientId) {
        await supabaseAdmin
          .from("open_finance_webhook_events")
          .update({
            processing_status: "ignored",
            processed_at: new Date().toISOString(),
            last_error: "Connection not mapped and clientUserId missing",
          })
          .eq("provider", provider)
          .eq("event_id", event.eventId);
        return jsonResponse({ ok: true, ignored: true });
      }

      const { data: insertedConnection, error: insertedConnectionError } = await supabaseAdmin
        .from("open_finance_connections")
        .upsert(
          {
            client_id: candidateClientId,
            provider,
            external_item_id: event.externalConnectionId,
            status: "pending_consent",
            consent_status: "pending",
            external_user_ref: candidateClientId,
          },
          { onConflict: "provider,external_item_id" },
        )
        .select("id, client_id, provider, external_item_id")
        .single();
      if (insertedConnectionError) throw insertedConnectionError;
      connectionRow = insertedConnection;
    }

    const syncData = await adapter.syncConnection({
      externalConnectionId: String(connectionRow.external_item_id),
    });

    await persistSyncData({
      supabaseAdmin,
      clientId: String(connectionRow.client_id),
      provider,
      connection: syncData.connection,
      accounts: syncData.accounts,
      transactions: syncData.transactions,
    });

    await supabaseAdmin
      .from("open_finance_webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("provider", provider)
      .eq("event_id", event.eventId);

    return jsonResponse({ ok: true });
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
