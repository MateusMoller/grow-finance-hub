import type {
  ProviderAdapter,
  ProviderAccount,
  ProviderConnectionRef,
  ProviderSessionResult,
  ProviderTransaction,
  SyncResult,
  WebhookEvent,
} from "./types.ts";
import {
  asRecord,
  asString,
  fetchJson,
  normalizeDirection,
  pickFirstNumber,
  pickFirstString,
  toIso,
  toPositiveMoney,
  type JsonRecord,
} from "./http.ts";

type OpeniAuthResponse = {
  access_token?: string;
  token?: string;
  expires_in?: number;
};

function ensureEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function readPath(name: string, fallback: string): string {
  const value = Deno.env.get(name)?.trim();
  return value && value.startsWith("/") ? value : fallback;
}

async function getOpeniAccessToken(baseUrl: string, clientId: string, clientSecret: string, authPath: string) {
  const { data } = await fetchJson<OpeniAuthResponse>(`${baseUrl}${authPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  const token = asString(data.access_token) || asString(data.token);
  if (!token) throw new Error("Openi auth did not return access token");
  return token;
}

function mapAccount(raw: JsonRecord): ProviderAccount | null {
  const externalAccountId = pickFirstString(raw, ["id", "accountId"]);
  if (!externalAccountId) return null;

  return {
    externalAccountId,
    accountName: pickFirstString(raw, ["name", "displayName", "accountName"]),
    accountType: pickFirstString(raw, ["type", "subtype"]),
    institutionName: pickFirstString(raw, ["institutionName", "bankName"]),
    accountMask: pickFirstString(raw, ["mask", "number", "accountNumber"]),
    currencyCode: pickFirstString(raw, ["currencyCode", "currency"]) || "BRL",
    isActive: raw["isActive"] === false ? false : true,
  };
}

function mapTransaction(raw: JsonRecord): ProviderTransaction | null {
  const externalTransactionId = pickFirstString(raw, ["id", "transactionId"]);
  const externalAccountId = pickFirstString(raw, ["accountId"]);
  const occurredAtRaw = pickFirstString(raw, ["date", "occurredAt", "createdAt"]);
  const description = pickFirstString(raw, ["description", "name", "title"]) || "Lancamento bancario";
  const amountRaw = pickFirstNumber(raw, ["amount", "value"]);
  if (!externalTransactionId || !externalAccountId || !occurredAtRaw || amountRaw === null) return null;
  const occurredAt = toIso(occurredAtRaw);
  if (!occurredAt) return null;

  const direction = normalizeDirection(amountRaw, pickFirstString(raw, ["direction", "type"]));
  return {
    externalTransactionId,
    externalAccountId,
    occurredAt,
    description,
    amount: toPositiveMoney(amountRaw),
    direction,
    category: pickFirstString(raw, ["category", "mccDescription"]),
    payloadMin: {
      status: pickFirstString(raw, ["status"]),
      currencyCode: pickFirstString(raw, ["currencyCode", "currency"]),
      providerType: pickFirstString(raw, ["type"]),
    },
  };
}

export function createOpeniAdapter(): ProviderAdapter {
  const baseUrl = ensureEnv("OPENI_API_BASE_URL").replace(/\/$/, "");
  const clientId = ensureEnv("OPENI_CLIENT_ID");
  const clientSecret = ensureEnv("OPENI_CLIENT_SECRET");
  const webhookSecret = ensureEnv("OPEN_FINANCE_WEBHOOK_SECRET_OPENI");

  const authPath = readPath("OPENI_AUTH_PATH", "/auth/token");
  const createSessionPath = readPath("OPENI_CREATE_SESSION_PATH", "/connect/session");
  const connectionsPath = readPath("OPENI_CONNECTIONS_PATH", "/connections");
  const accountsPath = readPath("OPENI_ACCOUNTS_PATH", "/accounts");
  const transactionsPath = readPath("OPENI_TRANSACTIONS_PATH", "/transactions");
  const syncPathTemplate = readPath("OPENI_SYNC_PATH", "/connections/{connectionId}/sync");

  async function authHeaders(): Promise<HeadersInit> {
    const accessToken = await getOpeniAccessToken(baseUrl, clientId, clientSecret, authPath);
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return {
    async createConnectSession(params): Promise<ProviderSessionResult> {
      const headers = await authHeaders();
      const { data } = await fetchJson<JsonRecord>(`${baseUrl}${createSessionPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientUserId: params.clientUserId,
          webhookUrl: params.webhookUrl,
        }),
      });

      const sessionToken =
        pickFirstString(data, ["sessionToken", "accessToken", "token"]) || "";
      if (!sessionToken) throw new Error("Openi session token not returned");

      return {
        sessionToken,
        connectUrl: pickFirstString(data, ["connectUrl", "url"]),
        expiresAt: toIso(pickFirstString(data, ["expiresAt"])),
      };
    },

    async syncConnection(params): Promise<SyncResult> {
      const headers = await authHeaders();
      const externalConnectionId = params.externalConnectionId;
      const syncPath = syncPathTemplate.replace("{connectionId}", encodeURIComponent(externalConnectionId));

      await fetchJson(`${baseUrl}${syncPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      const { data: connectionData } = await fetchJson<JsonRecord>(
        `${baseUrl}${connectionsPath}/${encodeURIComponent(externalConnectionId)}`,
        { method: "GET", headers },
      );

      const { data: accountPayload } = await fetchJson<{ results?: unknown[] }>(
        `${baseUrl}${accountsPath}?connectionId=${encodeURIComponent(externalConnectionId)}`,
        { method: "GET", headers },
      );

      const accounts = (accountPayload.results || [])
        .map((raw) => asRecord(raw))
        .filter((raw): raw is JsonRecord => Boolean(raw))
        .map(mapAccount)
        .filter((raw): raw is ProviderAccount => Boolean(raw));

      const transactions: ProviderTransaction[] = [];
      for (const account of accounts) {
        const { data: transactionsPayload } = await fetchJson<{ results?: unknown[] }>(
          `${baseUrl}${transactionsPath}?accountId=${encodeURIComponent(account.externalAccountId)}`,
          { method: "GET", headers },
        );

        for (const raw of transactionsPayload.results || []) {
          const record = asRecord(raw);
          if (!record) continue;
          const mapped = mapTransaction(record);
          if (mapped) transactions.push(mapped);
        }
      }

      const connection: ProviderConnectionRef = {
        externalConnectionId,
        status: pickFirstString(connectionData, ["status"]) || "active",
        consentStatus: pickFirstString(connectionData, ["consentStatus", "status"]) || "granted",
        consentExpiresAt: toIso(pickFirstString(connectionData, ["consentExpiresAt"])),
      };

      return { connection, accounts, transactions };
    },

    async disconnectConnection(params): Promise<void> {
      const headers = await authHeaders();
      await fetchJson(`${baseUrl}${connectionsPath}/${encodeURIComponent(params.externalConnectionId)}`, {
        method: "DELETE",
        headers,
      });
    },

    async parseWebhookEvent(params): Promise<WebhookEvent> {
      const provided = params.headers.get("x-webhook-secret")?.trim();
      if (!provided || provided !== webhookSecret) {
        throw new Error("Unauthorized Openi webhook");
      }

      const body = params.body;
      const eventType = pickFirstString(body, ["event", "eventType", "type"]) || "unknown";
      const eventId =
        pickFirstString(body, ["id", "eventId"]) ||
        `${eventType}:${pickFirstString(body, ["connectionId"]) || crypto.randomUUID()}`;
      const externalConnectionId =
        pickFirstString(body, ["connectionId"]) ||
        pickFirstString(asRecord(body["connection"]) || {}, ["id"]) ||
        null;

      return {
        provider: "openi",
        eventId,
        eventType,
        externalConnectionId,
        payloadMin: {
          connectionId: externalConnectionId,
          status: pickFirstString(body, ["status"]),
          message: pickFirstString(body, ["message"]),
        },
      };
    },
  };
}
