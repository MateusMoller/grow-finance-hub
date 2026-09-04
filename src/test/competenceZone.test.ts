import { describe, expect, it } from "vitest";
import { parseCompetenceZone } from "../../supabase/functions/_shared/competence-zone";

describe("competence crop parser", () => {
  it.each([
    ["Competência: 08/2026", "2026-08"],
    ["08-2026", "2026-08"],
    ["2026/08", "2026-08"],
    ["Competência: 20/08/2026", "2026-08"],
    ["agosto de 2026", "2026-08"],
    ["Competência: AGOSTO 2026", "2026-08"],
    ["082026", "2026-08"],
  ])("reads %s strictly as %s", (text, expected) => {
    expect(parseCompetenceZone(text)).toBe(expected);
  });

  it("prioritizes the competence value when another date touches the crop", () => {
    expect(parseCompetenceZone("Competência 08/2026 Vencimento 20/09/2026")).toBe("2026-08");
  });
});
