import {
  CAIXA_POSTAL_INDICATOR_FIXTURES,
  type CaixaPostalFixtureScenario,
} from "./fixtures/caixa-postal.ts";
import type {
  IntegraContadorProvider,
  ProviderRequest,
  ProviderResult,
} from "../core/provider.ts";

export type FakeProviderRequest = {
  capabilityKey: string;
  scenario?: CaixaPostalFixtureScenario;
};

export function selectFakeProviderFixture(request: FakeProviderRequest) {
  if (request.capabilityKey !== "caixa_postal.new_message_indicator") {
    throw new Error(`Unsupported fake capability: ${request.capabilityKey}`);
  }

  return CAIXA_POSTAL_INDICATOR_FIXTURES[request.scenario ?? "completed"];
}

export function createFakeIntegraContadorProvider(
  scenario: CaixaPostalFixtureScenario = "completed",
): IntegraContadorProvider {
  return {
    async execute<I, O>(request: ProviderRequest<I>): Promise<ProviderResult<O>> {
      const fixture = selectFakeProviderFixture({
        capabilityKey: request.capabilityKey,
        scenario,
      });
      if ("error" in fixture) throw new Error(fixture.error.code);
      if (!("result" in fixture)) throw new Error("MALFORMED_PROVIDER_RESPONSE");
      if (fixture.result.kind === "waiting_external") {
        return {
          kind: "waiting_external",
          protocol: fixture.result.protocol,
          retryAt: new Date(Date.now() + fixture.result.retryAfterMs).toISOString(),
          etag: fixture.result.etag,
        };
      }
      if (fixture.result.kind === "no_content") {
        return {
          kind: "no_content",
          retryAt: new Date(Date.now() + fixture.result.retryAfterMs).toISOString(),
        };
      }
      return fixture.result as ProviderResult<O>;
    },
  };
}
