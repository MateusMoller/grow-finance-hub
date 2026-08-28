import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OAuthTokenManager } from "../_shared/integra-contador/core/auth.ts";
import {
  buildSerproEnvelope,
  SerproIntegraContadorProvider,
} from "../_shared/integra-contador/core/client.ts";
import { classifyHttpStatus } from "../_shared/integra-contador/core/errors.ts";
import type {
  ProviderRequest,
  ProviderResult,
} from "../_shared/integra-contador/core/provider.ts";
import { retryDecision } from "../_shared/integra-contador/core/retry.ts";
import { redact } from "../_shared/integra-contador/core/safe-logging.ts";
import { requestTag } from "../_shared/integra-contador/core/tracing.ts";
import type {
  StoredToken,
  TokenStore,
} from "../_shared/integra-contador/core/token-store.ts";
import { createFakeIntegraContadorProvider } from "../_shared/integra-contador/testing/fake-provider.ts";

const providerRequest: ProviderRequest<{ indicador: boolean }> = {
  capabilityKey: "caixa_postal.new_message_indicator",
  authorization: {
    connectionId: "connection-1",
    organizationId: "organization-1",
    clientId: "client-1",
    contractor: { type: "CNPJ", value: "11222333000181" },
    requestAuthor: { type: "CPF", value: "52998224725" },
    taxpayer: { type: "CNPJ", value: "04252011000110" },
  },
  input: { indicador: true },
  correlationId: "correlation-1",
  requestId: "request-1",
  requestTag: "opaque-request-tag",
};

Deno.test("SERPRO envelope preserves contractor, author, taxpayer, and serialized data ownership", () => {
  const envelope = buildSerproEnvelope(providerRequest, {
    capabilityKey: providerRequest.capabilityKey,
    domain: "caixa_postal",
    operation: "new_message_indicator",
    action: "Consultar",
    externalSystemId: "SYS",
    externalServiceId: "SERVICE",
    externalVersion: "1.0",
    adapterVersion: "1",
    requiresProcuration: true,
    cachePolicy: "real_time",
    retryPolicy: "async_poll",
    idempotencyPolicy: "fingerprint",
    storesRawPayload: false,
  });

  assertEquals(envelope.contratante, { numero: "11222333000181", tipo: 2 });
  assertEquals(envelope.autorPedidoDados, { numero: "52998224725", tipo: 1 });
  assertEquals(envelope.contribuinte, { numero: "04252011000110", tipo: 2 });
  assertEquals(envelope.pedidoDados, {
    idSistema: "SYS",
    idServico: "SERVICE",
    versaoSistema: "1.0",
    dados: '{"indicador":true}',
  });
});

Deno.test("redacts secrets and identifiers and keeps request tag within provider limit", async () => {
  assertEquals(redact({ token: "x", nested: { cpf: "1", password: "p" } }), {
    token: "[REDACTED]",
    nested: { cpf: "[REDACTED]", password: "[REDACTED]" },
  });
  assertEquals((await requestTag("opaque-seed")).length, 32);
});

Deno.test("HTTP error and retry classification is stable and bounded", () => {
  assertEquals(classifyHttpStatus(403, "c", "r").requiresAction, true);
  assertEquals(classifyHttpStatus(429, "c", "r").retryable, true);
  assertEquals(retryDecision(400, 0).retry, false);
  assertEquals(retryDecision(401, 0).retry, true);
  assertEquals(retryDecision(401, 1).retry, false);
  assertEquals(retryDecision(202, 0, 5_000).waitingExternal, true);
});

Deno.test("fake provider implements the canonical provider contract", async () => {
  const result = await createFakeIntegraContadorProvider("completed").execute(
    providerRequest,
  );
  assertEquals(result.kind, "completed");
  if (result.kind === "completed") {
    assertEquals(result.output, { hasNewMessages: true, indicatorCode: "NEW" });
  }
});

Deno.test("token refresh lease prevents duplicate authentication", async () => {
  let value: StoredToken | null = null;
  let leased = false;
  let authCalls = 0;
  const store: TokenStore = {
    read: () => Promise.resolve(value),
    claimRefresh: () => {
      if (leased) return Promise.resolve(null);
      leased = true;
      return Promise.resolve(1);
    },
    store: (_connection, _owner, _version, token) => {
      value = { ...token, version: 1 };
      return Promise.resolve(true);
    },
    invalidate: () => {
      value = null;
      return Promise.resolve();
    },
  };
  const manager = new OAuthTokenManager(store, () => {
    authCalls++;
    return Promise.resolve({
      accessToken: "a",
      jwtToken: "j",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });
  await manager.get("c");
  await manager.get("c");
  assertEquals(authCalls, 1);
});

Deno.test("concurrent token refresh loser receives controlled state", async () => {
  const store: TokenStore = {
    read: () => Promise.resolve(null),
    claimRefresh: () => Promise.resolve(null),
    store: () => Promise.resolve(false),
    invalidate: () => Promise.resolve(),
  };
  const manager = new OAuthTokenManager(store, () =>
    Promise.resolve({
      accessToken: "a",
      jwtToken: "j",
      expiresAt: new Date().toISOString(),
    }));
  await assertRejects(
    () => manager.get("c"),
    Error,
    "TOKEN_REFRESH_IN_PROGRESS",
  );
});

Deno.test("provider refreshes and replays exactly once after 401", async () => {
  let token: StoredToken | null = {
    accessToken: "old-access",
    jwtToken: "old-jwt",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    version: 1,
  };
  let leaseVersion = 1;
  let sends = 0;
  let invalidations = 0;
  const store: TokenStore = {
    read: () => Promise.resolve(token),
    claimRefresh: () => Promise.resolve(++leaseVersion),
    store: (_connection, _owner, version, fresh) => {
      token = { ...fresh, version };
      return Promise.resolve(true);
    },
    invalidate: () => {
      invalidations++;
      token = null;
      return Promise.resolve();
    },
  };
  const manager = new OAuthTokenManager(store, () =>
    Promise.resolve({
      accessToken: "new-access",
      jwtToken: "new-jwt",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
  const provider = new SerproIntegraContadorProvider(manager, {
    send: <I, O>(
      _request: ProviderRequest<I>,
      _tokens: { accessToken: string; jwtToken: string },
    ): Promise<{ status: number; result?: ProviderResult<O> }> => {
      sends++;
      return Promise.resolve(
        sends === 1 ? { status: 401 } : {
          status: 200,
          result: { kind: "completed", output: "ok" as O },
        },
      );
    },
  });

  assertEquals(await provider.execute(providerRequest), {
    kind: "completed",
    output: "ok",
  });
  assertEquals(sends, 2);
  assertEquals(invalidations, 1);
});
