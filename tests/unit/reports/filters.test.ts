import { describe, expect, it } from "vitest";
import { buildActiveReportFilterLabels, normalizeReportFilters, requireReportOrganization } from "@/lib/reports/filters";

describe("report filters", () => {
  it("normalizes blank values to null", () => {
    expect(normalizeReportFilters({ organizationId: " org ", company: " ", competence: "2026-06" })).toEqual({
      organizationId: "org",
      company: null,
      clientId: null,
      competence: "2026-06",
      period: null,
      status: null,
      sector: null,
      assignee: null,
    });
  });

  it("requires organization for protected report operations", () => {
    expect(() => requireReportOrganization(normalizeReportFilters({ organizationId: null }))).toThrow("organization_id");
  });

  it("builds active filter labels", () => {
    expect(buildActiveReportFilterLabels(normalizeReportFilters({ organizationId: "org", company: "Grow", competence: "2026-06" }))).toEqual([
      "Empresa: Grow",
      "Competencia: 2026-06",
    ]);
  });
});
