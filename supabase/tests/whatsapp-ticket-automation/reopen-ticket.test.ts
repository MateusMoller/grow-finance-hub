import { describe, expect, it } from "vitest";

import { buildFallbackClassification } from "../../functions/_shared/whatsapp-ticket/classification";

describe("reopen classification", () => {
  it("detects divergence wording as a reopen candidate", () => {
    expect(buildFallbackClassification("Nao resolveu, o problema continua").intent).toBe("divergence");
  });
});
