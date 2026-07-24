import { describe, expect, it } from "vitest";

import { resolveWhatsAppTicketRoute } from "../../functions/_shared/whatsapp-ticket/routing";

describe("selected ticket routing", () => {
  it("routes official interactive selections before active context", () => {
    const decision = resolveWhatsAppTicketRoute({
      interactiveTicketId: "ticket-selected",
      activeContextTicketId: "ticket-context",
    });

    expect(decision.source).toBe("interactive_selection");
    expect(decision.ticketId).toBe("ticket-selected");
  });
});
