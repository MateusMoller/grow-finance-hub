import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPgdasDeclarationData } from "./client.ts";

Deno.test("PGDAS-D builds a non-transmitting calculation request", () => {
  const data = buildPgdasDeclarationData({ cnpj: "12345678000195", competence: "202608", revenueRegime: "competencia", domesticRevenue: 1000, foreignRevenue: 250, activityId: 1 }, false);
  assertEquals(data.indicadorTransmissao, false);
  assertEquals(data.indicadorComparacao, false);
  assertEquals(data.declaracao.estabelecimentos[0].atividades[0].valorAtividade, 1250);
});

Deno.test("PGDAS-D rejects invalid identification", () => {
  assertThrows(() => buildPgdasDeclarationData({ cnpj: "123", competence: "20268", revenueRegime: "caixa", domesticRevenue: 0, foreignRevenue: 0, activityId: 1 }, false));
});
