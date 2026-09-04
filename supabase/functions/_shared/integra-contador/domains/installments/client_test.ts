import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildInstallmentEnvelope, INSTALLMENT_MODALITIES, INSTALLMENT_SERVICE_REGISTRY, issueInstallmentDas, listInstallmentAgreements } from "./client.ts";

Deno.test("installments maps all five official services for eight modalities", () => {
  assertEquals(INSTALLMENT_MODALITIES.length, 8);
  assertEquals(INSTALLMENT_SERVICE_REGISTRY.PARCSN.services, {
    issue: "GERARDAS161", printable: "PARCELASPARAGERAR162", list: "PEDIDOSPARC163", detail: "OBTERPARC164", payment: "DETPAGTOPARC165",
  });
  assertEquals(INSTALLMENT_SERVICE_REGISTRY.RELPMEI.services.payment, "DETPAGTOPARC235");
});

Deno.test("installments envelope separates contractor, author and taxpayer", () => {
  const envelope = buildInstallmentEnvelope("PARCMEI", "detail", { contractorTaxId: "11222333000144" }, "99888777000166", { numeroParcelamento: 7 });
  assertEquals(envelope.pedidoDados.idServico, "OBTERPARC204");
  assertEquals(envelope.contribuinte.numero, "99888777000166");
});

Deno.test("DAS requires the official base64 field", async () => {
  const fetcher = async () => new Response(JSON.stringify({ status: 200, dados: "{}" }), { status: 200 });
  await assertRejects(() => issueInstallmentDas({ baseUrl: "https://example.test", bearerToken: "x", contractorTaxId: "11222333000144" }, "PARCSN", "99888777000166", "202609", "tag", fetcher as typeof fetch), Error, "INSTALLMENT_DAS_PDF_MISSING");
});

Deno.test("successful response without content means an empty installment list", async () => {
  const fetcher = async () => new Response(JSON.stringify({ status: 204, mensagens: [{ codigo: "[Sucesso-PARCSN]" }] }), { status: 200 });
  const agreements = await listInstallmentAgreements({ baseUrl: "https://example.test", bearerToken: "x", contractorTaxId: "11222333000144" }, "PARCSN", "99888777000166", "tag", fetcher as typeof fetch);
  assertEquals(agreements, []);
});
