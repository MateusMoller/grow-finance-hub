import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSerproTrialProvider, parseTrialNewMessageIndicator, SERPRO_TRIAL_BASE_URL } from "./trial-provider.ts";

Deno.test("parses the official Caixa Postal trial response", () => {
  assertEquals(parseTrialNewMessageIndicator({ status: 200, dados: '{"codigo":"00","conteudo":[{"indicadorMensagensNovas":"2"}]}' }), { hasNewMessages: true, indicatorCode: "2" });
});

Deno.test("uses the documented trial route, bearer and simulated envelope", async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  const provider = createSerproTrialProvider(async (input, init) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({ status: 200, dados: '{"codigo":"00","conteudo":[{"indicadorMensagensNovas":"0"}]}' }), { status: 200 });
  });
  const result = await provider.execute({ capabilityKey: "caixa_postal.new_message_indicator", authorization: { connectionId: "c", organizationId: "o", contractor: { type: "CNPJ", value: "00000000000000" }, requestAuthor: { type: "CNPJ", value: "00000000000000" }, taxpayer: { type: "CPF", value: "99999999999" } }, input: {}, correlationId: "r", requestId: "q", requestTag: "trial-test" });
  assertEquals(captured.url, `${SERPRO_TRIAL_BASE_URL}/Monitorar`);
  assertEquals((captured.init?.headers as Record<string, string>)["Content-Type"], "application/json");
  assertEquals(result.kind, "completed");
});
