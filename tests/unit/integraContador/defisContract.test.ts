import { describe, expect, it } from "vitest";
import { buildDefisDeclarationData, buildDefisEnvelope } from "../../../supabase/functions/_shared/integra-contador/domains/defis/client";

const input = {
  cnpj: "12.345.678/0001-90", year: 2025, capitalGain: 0, employeesAtStart: 1, employeesAtEnd: 2,
  directExportRevenue: 0, variableIncomeGain: 0,
  partners: [{ cpf: "123.456.789-01", rendimentosIsentos: 0, rendimentosTributaveis: 10, participacaoCapitalSocial: 100, irRetidoFonte: 0 }],
  establishments: [{ cnpjCompleto: "12.345.678/0001-90", estoqueInicial: 0, estoqueFinal: 0, saldoCaixaInicial: 10, saldoCaixaFinal: 20, aquisicoesMercadoInterno: 0, importacoes: 0, totalEntradasPorTransferencia: 0, totalSaidasPorTransferencia: 0, totalDevolucoesVendas: 0, totalEntradas: 100, totalDevolucoesCompras: 0, totalDespesas: 80 }],
};

describe("DEFIS SERPRO contract", () => {
  it("serializes the documented annual payload and envelope", () => {
    const data = buildDefisDeclarationData(input);
    const envelope = buildDefisEnvelope(input.cnpj, "TRANSDECLARACAO141", data);
    expect(data).toMatchObject({ ano: 2025, inatividade: null });
    expect(data.empresa.socios[0].cpf).toBe("12345678901");
    expect(envelope.pedidoDados).toMatchObject({ idSistema: "DEFIS", idServico: "TRANSDECLARACAO141", versaoSistema: "1.0" });
    expect(JSON.parse(envelope.pedidoDados.dados)).toMatchObject({ ano: 2025 });
  });

  it("requires inactivity for calendar years before 2025", () => {
    expect(() => buildDefisDeclarationData({ ...input, year: 2024 })).toThrow("DEFIS_INACTIVITY_REQUIRED");
  });
});
