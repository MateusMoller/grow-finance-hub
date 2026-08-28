import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeXmlPayload, extractNfeDocZip, sha256, xmlAttribute, xmlValue } from "../../supabase/functions/_shared/fiscal-invoices/xml";

const toBase64 = (value: Uint8Array) => Buffer.from(value).toString("base64");

describe("fiscal invoice distribution contracts", () => {
  it("extracts namespaced invoice fields without evaluating XML", () => {
    const xml = '<nfe:procNFe xmlns:nfe="urn:test"><nfe:infNFe Id="NFe35260812345678000190550010000001231000001234"><nfe:emit><nfe:CNPJ>12345678000190</nfe:CNPJ><nfe:xNome>Empresa &amp; Cia</nfe:xNome></nfe:emit><nfe:vNF>125.90</nfe:vNF></nfe:infNFe></nfe:procNFe>';
    expect(xmlAttribute(xml, "infNFe", "Id")).toContain("352608");
    expect(xmlValue(xml, ["CNPJ"])).toBe("12345678000190");
    expect(xmlValue(xml, ["xNome"])).toBe("Empresa & Cia");
  });

  it("decodes ADN gzip/base64 XML payloads", async () => {
    const xml = '<?xml version="1.0"?><NFSe><chNFSe>12345678901234567890123456789012345678901234567890</chNFSe></NFSe>';
    expect(await decodeXmlPayload(toBase64(gzipSync(xml)))).toBe(xml);
  });

  it("extracts every SEFAZ docZip with its NSU and schema", async () => {
    const first = "<resNFe><chNFe>35123456789012345678901234567890123456789012</chNFe></resNFe>";
    const second = "<procNFe><protNFe><chNFe>35987654321098765432109876543210987654321098</chNFe></protNFe></procNFe>";
    const soap = `<soap:Envelope><soap:Body><retDistDFeInt><loteDistDFeInt><docZip NSU="000000000000123" schema="resNFe_v1.01.xsd">${toBase64(gzipSync(first))}</docZip><docZip NSU="000000000000124" schema="procNFe_v4.00.xsd">${toBase64(gzipSync(second))}</docZip></loteDistDFeInt></retDistDFeInt></soap:Body></soap:Envelope>`;
    const documents = await extractNfeDocZip(soap);
    expect(documents).toEqual([{ nsu: 123, schema: "resNFe_v1.01.xsd", xml: first }, { nsu: 124, schema: "procNFe_v4.00.xsd", xml: second }]);
    expect(await sha256(first)).toMatch(/^[a-f0-9]{64}$/);
  });
});
