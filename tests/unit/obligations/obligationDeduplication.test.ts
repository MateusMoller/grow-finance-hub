import { describe, expect, it } from "vitest";

import {
  findObligationDuplicateMatches,
  normalizeObligationCode,
  normalizeObligationName,
} from "@/lib/obligations/obligationDeduplication";

describe("obligation deduplication", () => {
  it("normalizes codes and names", () => {
    expect(normalizeObligationCode("F.G.T.S.")).toBe("fgts");
    expect(normalizeObligationName("F.G.T.S. Mensal")).toBe("fgts");
  });

  it("blocks exact code duplicates", () => {
    const matches = findObligationDuplicateMatches(
      { code: "F.G.T.S.", name: "FGTS mensal" },
      [{ id: "template-1", code: "fgts", name: "FGTS" }],
    );

    expect(matches).toEqual([
      expect.objectContaining({
        template_id: "template-1",
        match_type: "code",
        severity: "block",
      }),
    ]);
  });

  it("does not match itself during edit", () => {
    expect(
      findObligationDuplicateMatches(
        { id: "template-1", code: "fgts", name: "FGTS" },
        [{ id: "template-1", code: "fgts", name: "FGTS" }],
      ),
    ).toHaveLength(0);
  });
});
