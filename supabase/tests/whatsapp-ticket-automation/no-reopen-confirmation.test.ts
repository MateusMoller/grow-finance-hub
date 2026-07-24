import { describe, expect, it } from "vitest";

import { buildFallbackClassification } from "../../functions/_shared/whatsapp-ticket/classification";

describe("post resolution classification", () => {
  it("treats thanks as a confirmation instead of a reopen", () => {
    expect(buildFallbackClassification("Obrigado, perfeito").intent).toBe("thanks_or_confirmation");
  });
});
