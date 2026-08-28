import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { extractPreviousPgdasValues, previousCompetence } from "./prior-period.ts";

Deno.test("previousCompetence handles year boundaries", () => {
  assertEquals(previousCompetence("202601"), "202512");
  assertEquals(previousCompetence("202608"), "202607");
});

Deno.test("previousCompetence rejects invalid periods", () => {
  assertThrows(() => previousCompetence("202613"), Error, "PGDASD_INVALID_COMPETENCE");
});

Deno.test("extractPreviousPgdasValues sums domestic and foreign revenue", () => {
  assertEquals(extractPreviousPgdasValues({
    numeroDeclaracao: "123",
    declaracao: {
      receitaPaCompetenciaInterno: 12500.25,
      receitaPaCompetenciaExterno: 500,
    },
  }, "202607"), {
    competence: "202607",
    grossRevenue: 13000.25,
    declarationId: "123",
    declarationPdf: null,
  });
});
