import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildDctfwebData,buildDctfwebEnvelope } from "./client.ts";
Deno.test("DCTFWeb builds official service envelope",()=>{const data=buildDctfwebData({cnpj:"12345678000190",competence:"202608",category:"GERAL_MENSAL",receiptNumber:"24573"});assertEquals(data.anoPA,"2026");assertEquals(buildDctfwebEnvelope("12345678000190","CONSRECIBO32",data).pedidoDados.idSistema,"DCTFWEB");});
Deno.test("DCTFWeb rejects malformed competence",()=>assertRejects(async()=>buildDctfwebData({cnpj:"12345678000190",competence:"2026",category:"GERAL_MENSAL"}),Error,"DCTFWEB_INVALID_CONTEXT"));
