import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildDefisDeclarationData, buildDefisEnvelope } from "./client.ts";

const validInput = {
  cnpj: "12.345.678/0001-90", year: 2025, capitalGain: 0, employeesAtStart: 1, employeesAtEnd: 2,
  directExportRevenue: 0, variableIncomeGain: 0,
  partners: [{ cpf: "123.456.789-01", rendimentosIsentos: 0, rendimentosTributaveis: 10, participacaoCapitalSocial: 100, irRetidoFonte: 0 }],
  establishments: [{ cnpjCompleto: "12.345.678/0001-90", estoqueInicial: 0, estoqueFinal: 0, saldoCaixaInicial: 10, saldoCaixaFinal: 20, aquisicoesMercadoInterno: 0, importacoes: 0, totalEntradasPorTransferencia: 0, totalSaidasPorTransferencia: 0, totalDevolucoesVendas: 0, totalEntradas: 100, totalDevolucoesCompras: 0, totalDespesas: 80 }],
};

Deno.test("DEFIS builds the documented annual declaration contract", () => {
  const data = buildDefisDeclarationData(validInput);
  assertEquals(data.ano, 2025);
  assertEquals(data.inatividade, null);
  assertEquals(data.empresa.socios[0].cpf, "12345678901");
  assertEquals(data.empresa.estabelecimentos[0].cnpjCompleto, "12345678000190");
  const envelope = buildDefisEnvelope(validInput.cnpj, "TRANSDECLARACAO141", data);
  assertEquals(envelope.pedidoDados.idSistema, "DEFIS");
  assertEquals(envelope.pedidoDados.versaoSistema, "1.0");
});

Deno.test("DEFIS requires inactivity for years before 2025", () => {
  assertThrows(() => buildDefisDeclarationData({ ...validInput, year: 2024 }), Error, "DEFIS_INACTIVITY_REQUIRED");
});
