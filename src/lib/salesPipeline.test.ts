import { describe, expect, it } from "vitest";
import {
  buildClientCompletionTaskTitle,
  buildSalesActivitySummary,
  canManageSalesSettings,
  formatSalesCurrency,
  hasCompletionTaskForOpportunity,
  isOpenSalesStage,
  isWonSalesStage,
  normalizeSalesStage,
  parseSalesCurrency,
  validateSalesCatalogSelection,
} from "./salesPipeline";

describe("salesPipeline helpers", () => {
  it("normalizes unknown stages to the first pipeline stage", () => {
    expect(normalizeSalesStage("Negociacao")).toBe("Negociacao");
    expect(normalizeSalesStage("Etapa inexistente")).toBe("Oportunidade Nova");
    expect(normalizeSalesStage(null)).toBe("Oportunidade Nova");
  });

  it("identifies open and won stages", () => {
    expect(isOpenSalesStage("Proposta Enviada")).toBe(true);
    expect(isOpenSalesStage("Fechado Ganho")).toBe(false);
    expect(isWonSalesStage("Fechado Ganho")).toBe(true);
  });

  it("parses and formats BRL currency values", () => {
    expect(parseSalesCurrency("R$ 12.345,67")).toBe(12345.67);
    expect(parseSalesCurrency("invalid")).toBe(0);
    expect(formatSalesCurrency(5000).replace(/\s/g, " ")).toBe("R$ 5.000");
  });

  it("allows only managers, directors and admins to manage settings", () => {
    expect(canManageSalesSettings("admin")).toBe(true);
    expect(canManageSalesSettings("commercial")).toBe(false);
    expect(canManageSalesSettings(null, ["employee", "manager"])).toBe(true);
  });

  it("requires description only when offer category is other", () => {
    expect(validateSalesCatalogSelection({ offerId: "offer-1", category: "service" })).toBe(true);
    expect(validateSalesCatalogSelection({ offerId: null, category: "service" })).toBe(false);
    expect(validateSalesCatalogSelection({ offerId: null, category: "other", otherOfferDescription: "" })).toBe(false);
    expect(
      validateSalesCatalogSelection({
        offerId: null,
        category: "other",
        otherOfferDescription: "Projeto especial",
      }),
    ).toBe(true);
  });

  it("builds completion task titles and detects active completion tasks", () => {
    expect(buildClientCompletionTaskTitle("  Cliente Teste  ")).toBe(
      "Complementar cadastro do cliente: Cliente Teste",
    );
    expect(buildClientCompletionTaskTitle("")).toBe("Complementar cadastro do cliente: cliente");

    expect(
      hasCompletionTaskForOpportunity(
        [
          { integration_source: "sales_pipeline", integration_task_id: "opp-1", status: "backlog" },
          { integration_source: "sales_pipeline", integration_task_id: "opp-2", status: "archived" },
        ],
        "opp-1",
      ),
    ).toBe(true);
    expect(
      hasCompletionTaskForOpportunity(
        [{ integration_source: "sales_pipeline", integration_task_id: "opp-2", status: "archived" }],
        "opp-2",
      ),
    ).toBe(false);
  });

  it("builds readable activity summaries", () => {
    expect(buildSalesActivitySummary("meeting", "Reuniao inicial")).toBe("Reuniao: Reuniao inicial");
    expect(buildSalesActivitySummary("note", "  ")).toBe("Atividade registrada");
  });
});
