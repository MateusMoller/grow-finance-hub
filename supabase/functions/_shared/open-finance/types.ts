export type OpenFinanceProvider = "pluggy" | "openi";

export type ProviderSessionResult = {
  sessionToken: string;
  connectUrl?: string | null;
  expiresAt?: string | null;
};

export type ProviderConnectionRef = {
  externalConnectionId: string;
  status?: string | null;
  consentStatus?: string | null;
  consentExpiresAt?: string | null;
};

export type ProviderAccount = {
  externalAccountId: string;
  accountName: string | null;
  accountType: string | null;
  institutionName: string | null;
  accountMask: string | null;
  currencyCode: string | null;
  isActive: boolean;
};

export type ProviderTransaction = {
  externalTransactionId: string;
  externalAccountId: string;
  occurredAt: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  category: string | null;
  payloadMin: Record<string, unknown>;
};

export type SyncResult = {
  connection: ProviderConnectionRef;
  accounts: ProviderAccount[];
  transactions: ProviderTransaction[];
};

export type WebhookEvent = {
  provider: OpenFinanceProvider;
  eventId: string;
  eventType: string;
  externalConnectionId?: string | null;
  payloadMin: Record<string, unknown>;
};

export interface ProviderAdapter {
  createConnectSession(params: {
    clientUserId: string;
    webhookUrl: string;
  }): Promise<ProviderSessionResult>;
  syncConnection(params: {
    externalConnectionId: string;
  }): Promise<SyncResult>;
  disconnectConnection(params: {
    externalConnectionId: string;
  }): Promise<void>;
  parseWebhookEvent(params: {
    headers: Headers;
    body: Record<string, unknown>;
  }): Promise<WebhookEvent>;
}
