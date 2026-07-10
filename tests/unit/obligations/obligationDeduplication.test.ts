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
      [{ id: "template-1", code: "fgts", name: "FGTS", baseline_source: "default_regime_matrix_20260710" }],
    );

    expect(matches).toEqual([
      expect.objectContaining({
        template_id: "template-1",
        baseline_source: "default_regime_matrix_20260710",
        match_type: "code",
        severity: "block",
      }),
    ]);
  });

  it("blocks manual duplicates against active manual obligations", () => {
    const matches = findObligationDuplicateMatches(
      { code: "iss-municipal", name: "ISS municipal" },
      [{ id: "template-1", code: "iss_municipal", name: "ISS Municipal", baseline_source: "manual" }],
    );

    expect(matches).toEqual([
      expect.objectContaining({
        template_id: "template-1",
        baseline_source: "manual",
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
