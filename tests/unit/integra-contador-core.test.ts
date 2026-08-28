import { describe, expect, it } from "vitest";
import { OAuthTokenManager } from "../../supabase/functions/_shared/integra-contador/core/auth";
import { SerproIntegraContadorProvider } from "../../supabase/functions/_shared/integra-contador/core/client";
import { normalizeTaxIdentifier } from "../../supabase/functions/_shared/integra-contador/core/identifiers";
import { normalizeMoney } from "../../supabase/functions/_shared/integra-contador/core/money";
import { canonicalJson, normalizePeriod } from "../../supabase/functions/_shared/integra-contador/core/periods";
import { assertSafeJob } from "../../supabase/functions/_shared/integra-contador/core/queue";
import { redact } from "../../supabase/functions/_shared/integra-contador/core/safe-logging";
import { retryDecision } from "../../supabase/functions/_shared/integra-contador/core/retry";
import { requestTag } from "../../supabase/functions/_shared/integra-contador/core/tracing";
import { createFakeIntegraContadorProvider } from "../../supabase/functions/_shared/integra-contador/testing/fake-provider";
import type { ProviderRequest } from "../../supabase/functions/_shared/integra-contador/core/provider";
import type { StoredToken, TokenStore } from "../../supabase/functions/_shared/integra-contador/core/token-store";

describe("Integra Contador core", () => {
  it("normalizes and validates fiscal primitives before enqueue", () => {
    expect(normalizeTaxIdentifier("529.982.247-25")).toEqual({ type: "CPF", value: "52998224725" });
    expect(normalizeTaxIdentifier("04.252.011/0001-10")).toEqual({ type: "CNPJ", value: "04252011000110" });
    expect(() => normalizeTaxIdentifier("111.111.111-11")).toThrow("INVALID_TAX_IDENTIFIER");
    expect(normalizePeriod("2026/08")).toBe("2026-08");
    expect(normalizeMoney("1.234,5")).toBe("1234.50");
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("rejects sensitive queue fields and redacts nested secrets", () => {
    expect(assertSafeJob({ jobId: "j", organizationId: "o", capabilityKey: "c", correlationId: "r" })).toBeTruthy();
    expect(() => assertSafeJob({ jobId: "token", organizationId: "o", capabilityKey: "c", correlationId: "r" })).toThrow();
    expect(redact({ token: "secret", nested: { cpf: "123" }, safe: "ok" })).toEqual({ token: "[REDACTED]", nested: { cpf: "[REDACTED]" }, safe: "ok" });
  });

  it("keeps retry, trace and fake-provider contracts stable", async () => {
    expect(retryDecision(400, 0).retry).toBe(false);
    expect(retryDecision(401, 0).retry).toBe(true);
    expect(retryDecision(401, 1).retry).toBe(false);
    expect(retryDecision(202, 0, 5_000)).toMatchObject({ waitingExternal: true, delayMs: 5_000 });
    expect(await requestTag("opaque-seed")).toHaveLength(32);
    const fake = createFakeIntegraContadorProvider();
    await expect(fake.execute({ capabilityKey: "caixa_postal.new_message_indicator", authorization: { connectionId: "c", organizationId: "o", contractor: { type: "CNPJ", value: "04252011000110" }, requestAuthor: { type: "CNPJ", value: "04252011000110" }, taxpayer: { type: "CNPJ", value: "04252011000110" } }, input: {}, correlationId: "r", requestId: "q", requestTag: "tag" })).resolves.toMatchObject({ kind: "completed" });
  });

  it("reuses one shared token and refreshes exactly once after 401", async () => {
    let value: StoredToken | null = null;
    let version = 0;
    let authCalls = 0;
    const store: TokenStore = {
      read: async () => value,
      claimRefresh: async () => ++version,
      store: async (_connection, _owner, claimedVersion, token) => {
        value = { ...token, version: claimedVersion };
        return true;
      },
      invalidate: async () => { value = null; },
    };
    const manager = new OAuthTokenManager(store, async () => ({ accessToken: `access-${++authCalls}`, jwtToken: "jwt", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    let transportCalls = 0;
    const provider = new SerproIntegraContadorProvider(manager, {
      send: async () => ++transportCalls === 1 ? { status: 401 } : { status: 200, result: { kind: "completed", output: { ok: true } } },
    });
    const request = { capabilityKey: "test", authorization: { connectionId: "c", organizationId: "o", contractor: { type: "CNPJ", value: "04252011000110" }, requestAuthor: { type: "CNPJ", value: "04252011000110" }, taxpayer: { type: "CNPJ", value: "04252011000110" } }, input: {}, correlationId: "r", requestId: "q", requestTag: "tag" } as ProviderRequest;
    await expect(provider.execute(request)).resolves.toMatchObject({ kind: "completed" });
    expect(authCalls).toBe(2);
    expect(transportCalls).toBe(2);
  });
});
