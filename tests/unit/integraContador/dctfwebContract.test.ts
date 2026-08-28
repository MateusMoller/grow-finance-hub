import { describe,expect,it,vi } from "vitest";
import { buildDctfwebData,buildDctfwebEnvelope,generateDctfwebDarfTrial } from "../../../supabase/functions/_shared/integra-contador/domains/dctfweb/client";
const input={cnpj:"12.345.678/0001-90",competence:"2026-08",category:"GERAL_MENSAL" as const,receiptNumber:"24573"};
describe("DCTFWeb SERPRO contract",()=>{
 it("normalizes the period and serializes the official envelope",()=>{expect(buildDctfwebData(input)).toEqual({categoria:"GERAL_MENSAL",anoPA:"2026",mesPA:"08",numeroReciboEntrega:24573});expect(buildDctfwebEnvelope(input.cnpj,"GERARGUIA31",buildDctfwebData(input)).pedidoDados).toMatchObject({idSistema:"DCTFWEB",idServico:"GERARGUIA31",versaoSistema:"1.0"});});
 it("uses the dedicated in-progress guide service",async()=>{const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));expect(body.pedidoDados.idServico).toBe("GERARGUIAANDAMENTO313");return new Response(JSON.stringify({status:200,dados:JSON.stringify([{pdf:btoa("pdf")}])}),{status:200});}) as unknown as typeof fetch;await expect(generateDctfwebDarfTrial(input,true,"tag",fetcher)).resolves.toMatchObject({mimeType:"application/pdf"});});
});
