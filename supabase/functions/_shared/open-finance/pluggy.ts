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
  asNumber,
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

type PluggyAuthResponse = {
  apiKey?: string;
};

type PluggyConnectTokenResponse = {
  accessToken?: string;
  expiresAt?: string;
};

function ensureEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function getApiKey(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const { data } = await fetchJson<PluggyAuthResponse>(`${baseUrl}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const apiKey = asString(data.apiKey);
  if (!apiKey) throw new Error("Pluggy auth did not return apiKey");
  return apiKey;
}

function mapAccount(raw: JsonRecord): ProviderAccount | null {
  const externalAccountId = pickFirstString(raw, ["id"]);
  if (!externalAccountId) return null;
  return {
    externalAccountId,
    accountName: pickFirstString(raw, ["name", "marketingName", "number"]),
    accountType: pickFirstString(raw, ["type", "subtype"]),
    institutionName: pickFirstString(raw, ["institution", "institutionName", "connectorName"]),
    accountMask: pickFirstString(raw, ["number", "maskedNumber"]),
    currencyCode: pickFirstString(raw, ["currencyCode", "currency"]) || "BRL",
    isActive: raw["isActive"] === false ? false : true,
  };
}

function mapTransaction(raw: JsonRecord): ProviderTransaction | null {
  const externalTransactionId = pickFirstString(raw, ["id"]);
  const externalAccountId = pickFirstString(raw, ["accountId"]);
  const occurredAtRaw = pickFirstString(raw, ["date", "createdAt"]);
  const description = pickFirstString(raw, ["description", "merchant", "name"]) || "Lancamento bancario";
  const amountRaw = pickFirstNumber(raw, ["amount"]);

  if (!externalTransactionId || !externalAccountId || !occurredAtRaw || amountRaw === null) return null;
  const occurredAt = toIso(occurredAtRaw);
  if (!occurredAt) return null;

  const direction = normalizeDirection(amountRaw, pickFirstString(raw, ["type", "direction"]));
  return {
    externalTransactionId,
    externalAccountId,
    occurredAt,
    description,
    amount: toPositiveMoney(amountRaw),
    direction,
    category: pickFirstString(raw, ["category", "subcategory"]),
    payloadMin: {
      status: pickFirstString(raw, ["status"]),
      currencyCode: pickFirstString(raw, ["currencyCode", "currency"]),
      providerType: pickFirstString(raw, ["type"]),
    },
  };
}

export function createPluggyAdapter(): ProviderAdapter {
  const baseUrl = ensureEnv("").replace(/\/$/, "");
  const clientId = ensureEnv("1cd9d85c-7d2c-4871-a6dc-6169021cf5da");
  const clientSecret = ensureEnv("7471b994-0f32-4b6c-81c0-2facda8134f8");
  const connectBaseUrl = (Deno.env.get("https://api.pluggy.ai/webhooks") || "https://connect.pluggy.ai").replace(/\/$/, "");
  const webhookSecret = ensureEnv("https://api.pluggy.ai/webhooks");

  async function authorizedHeaders(): Promise<HeadersInit> {
    const apiKey = await getApiKey(baseUrl, clientId, clientSecret);
    return {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    };
  }

  return {
    async createConnectSession(params): Promise<ProviderSessionResult> {
      const headers = await authorizedHeaders();
      const { data } = await fetchJson<PluggyConnectTokenResponse>(`${baseUrl}/connect_token`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientUserId: params.clientUserId,
          webhookUrl: params.webhookUrl,
        }),
      });

      const sessionToken = asString(data.accessToken);
      if (!sessionToken) throw new Error("Pluggy connect token not returned");
      const connectUrl = `${connectBaseUrl}?token=${encodeURIComponent(sessionToken)}`;
      return {
        sessionToken,
        connectUrl,
        expiresAt: toIso(asString(data.expiresAt)),
      };
    },

    async syncConnection(params): Promise<SyncResult> {
      const headers = await authorizedHeaders();
      const externalConnectionId = params.externalConnectionId;

      await fetchJson(`${baseUrl}/items/${encodeURIComponent(externalConnectionId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });

      const { data: itemData } = await fetchJson<JsonRecord>(`${baseUrl}/items/${encodeURIComponent(externalConnectionId)}`, {
        method: "GET",
        headers,
      });

      const { data: accountsPayload } = await fetchJson<{ results?: unknown[] }>(
        `${baseUrl}/accounts?itemId=${encodeURIComponent(externalConnectionId)}`,
        { method: "GET", headers },
      );

      const accounts = (accountsPayload.results || [])
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => Boolean(entry))
        .map(mapAccount)
        .filter((entry): entry is ProviderAccount => Boolean(entry));

      const transactions: ProviderTransaction[] = [];
      for (const account of accounts) {
        const { data: transactionsPayload } = await fetchJson<{ results?: unknown[] }>(
          `${baseUrl}/transactions?accountId=${encodeURIComponent(account.externalAccountId)}`,
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
        status: pickFirstString(itemData, ["status", "executionStatus"]) || "active",
        consentStatus: pickFirstString(itemData, ["status"]) || "granted",
        consentExpiresAt: null,
      };

      return { connection, accounts, transactions };
    },

    async disconnectConnection(params): Promise<void> {
      const headers = await authorizedHeaders();
      await fetchJson(`${baseUrl}/items/${encodeURIComponent(params.externalConnectionId)}`, {
        method: "DELETE",
        headers,
      });
    },

    async parseWebhookEvent(params): Promise<WebhookEvent> {
      const provided = params.headers.get("x-webhook-secret")?.trim();
      if (!provided || provided !== webhookSecret) {
        throw new Error("Unauthorized Pluggy webhook");
      }

      const body = params.body;
      const eventType = asString(body["event"]) || asString(body["type"]) || "unknown";
      const eventId =
        asString(body["id"]) ||
        asString(body["eventId"]) ||
        `${eventType}:${asString(body["itemId"]) || crypto.randomUUID()}`;
      const externalConnectionId =
        asString(body["itemId"]) ||
        asString(asRecord(body["item"])?.id) ||
        null;

      return {
        provider: "pluggy",
        eventId,
        eventType,
        externalConnectionId,
        payloadMin: {
          itemId: externalConnectionId,
          status: asString(body["status"]),
          message: asString(body["message"]),
        },
      };
    },
  };
}
