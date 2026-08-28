export const CAIXA_POSTAL_INDICATOR_FIXTURES = {
  completed: {
    scenario: "completed",
    result: {
      kind: "completed",
      output: { hasNewMessages: true, indicatorCode: "NEW" },
      sourceUpdatedAt: "2026-08-14T12:00:00.000Z",
    },
  },
  waiting: {
    scenario: "waiting",
    result: {
      kind: "waiting_external",
      protocol: "fixture-protocol",
      retryAfterMs: 3_000,
      etag: "fixture-etag",
    },
  },
  noContent: {
    scenario: "no_content",
    result: { kind: "no_content", retryAfterMs: 3_000 },
  },
  unauthorized: {
    scenario: "unauthorized",
    error: { code: "SERPRO_AUTHORIZATION", retryable: false, requiresAction: true },
  },
  rateLimited: {
    scenario: "rate_limited",
    error: { code: "SERPRO_RATE_LIMIT", retryable: true, retryAfterMs: 60_000 },
  },
  timeout: {
    scenario: "timeout",
    error: { code: "SERPRO_TIMEOUT", retryable: true },
  },
  duplicate: {
    scenario: "duplicate",
    result: {
      kind: "completed",
      output: { hasNewMessages: true, indicatorCode: "NEW" },
      externalReference: "fixture-stable-reference",
    },
  },
  malformed: {
    scenario: "malformed",
    rawResponse: { unexpected: true },
  },
} as const;

export type CaixaPostalFixtureScenario = keyof typeof CAIXA_POSTAL_INDICATOR_FIXTURES;
