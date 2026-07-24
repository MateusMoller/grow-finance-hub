import { describe, expect, it } from "vitest";

import { buildWebhookIdempotencyKey } from "../../functions/_shared/whatsapp-ticket/routing";

describe("buildWebhookIdempotencyKey", () => {
  it("uses provider message id as the stable first choice", () => {
    expect(
      buildWebhookIdempotencyKey({
        organizationId: "org-1",
        providerMessageId: "wamid.123",
        clientMessageId: "client-123",
      }),
    ).toBe("org-1:whatsapp:wamid.123");
  });

  it("falls back to client message id when provider id is absent", () => {
    expect(
      buildWebhookIdempotencyKey({
        organizationId: "org-1",
        clientMessageId: "client-123",
      }),
    ).toBe("org-1:whatsapp:client-123");
  });

  it("uses phone and timestamp only as a last-resort deterministic fallback", () => {
    expect(
      buildWebhookIdempotencyKey({
        organizationId: "org-1",
        fallbackPhone: "555198612360",
        fallbackTimestamp: 178456,
      }),
    ).toBe("org-1:whatsapp:555198612360:178456");
  });
});
