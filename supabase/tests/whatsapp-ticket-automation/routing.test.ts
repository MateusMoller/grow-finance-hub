import { describe, expect, it } from "vitest";

import { resolveWhatsAppTicketRoute } from "../../functions/_shared/whatsapp-ticket/routing";

describe("resolveWhatsAppTicketRoute", () => {
  it("prioritizes quoted replies over every other route", () => {
    const decision = resolveWhatsAppTicketRoute({
      quotedTicketId: "ticket-quoted",
      interactiveTicketId: "ticket-interactive",
      protocolTicketId: "ticket-protocol",
      activeContextTicketId: "ticket-context",
      inferredTicketId: "ticket-inferred",
      inferenceConfidence: 99,
    });

    expect(decision.source).toBe("quoted_reply");
    expect(decision.ticketId).toBe("ticket-quoted");
  });

  it("routes by active context before inference", () => {
    const decision = resolveWhatsAppTicketRoute({
      activeContextTicketId: "ticket-context",
      inferredTicketId: "ticket-inferred",
      inferenceConfidence: 99,
    });

    expect(decision.source).toBe("active_context");
    expect(decision.ticketId).toBe("ticket-context");
  });

  it("uses inference only when confidence reaches the configured threshold", () => {
    expect(
      resolveWhatsAppTicketRoute({
        inferredTicketId: "ticket-inferred",
        inferenceConfidence: 0.9,
      }),
    ).toMatchObject({
      source: "inference",
      ticketId: "ticket-inferred",
    });

    expect(
      resolveWhatsAppTicketRoute({
        inferredTicketId: "ticket-inferred",
        inferenceConfidence: 89,
      }),
    ).toMatchObject({
      source: "unrouted",
      ticketId: null,
    });
  });
});
