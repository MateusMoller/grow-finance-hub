import { describe, expect, it } from "vitest";
import { reportCatalog } from "@/lib/reports/catalog";
import { validateReportCatalog } from "@/lib/reports/catalogValidation";

describe("validateReportCatalog", () => {
  it("accepts the initial governed catalog", () => {
    expect(validateReportCatalog(reportCatalog)).toEqual([]);
  });

  it("flags prohibited fields that are made available", () => {
    const [dataset] = reportCatalog;
    const issues = validateReportCatalog([
      {
        ...dataset,
        fields: [
          ...dataset.fields,
          {
            key: "senha_gov_export",
            label: "Senha GOV",
            sourcePath: "client_data.senha_gov",
            dataType: "text",
            classification: "prohibited",
            exportable: true,
            previewable: true,
          },
        ],
      },
    ]);

    expect(issues.some((issue) => issue.code === "prohibited_available")).toBe(true);
  });
});
