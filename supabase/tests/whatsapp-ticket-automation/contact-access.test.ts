import { describe, expect, it } from "vitest";

import { shouldPreserveManualClientLink } from "../../functions/_shared/whatsapp-ticket/contact-matching";

describe("contact access safety", () => {
  it("preserves manual links over automatic matching", () => {
    expect(
      shouldPreserveManualClientLink({
        clientId: "client-1",
        autoLinkSource: "manual",
        matchStatus: "manual",
      }),
    ).toBe(true);
  });
});
