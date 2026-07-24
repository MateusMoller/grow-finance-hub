import { describe, expect, it } from "vitest";

import { resolveWhatsAppTicketRoute } from "../../functions/_shared/whatsapp-ticket/routing";

describe("quoted reply routing", () => {
  it("routes quoted replies directly to the quoted ticket", () => {
    const decision = resolveWhatsAppTicketRoute({ quotedTicketId: "ticket-1" });

    expect(decision.source).toBe("quoted_reply");
    expect(decision.ticketId).toBe("ticket-1");
  });
});
