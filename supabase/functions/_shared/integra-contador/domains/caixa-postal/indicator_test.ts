import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createFakeIntegraContadorProvider } from "../../testing/fake-provider.ts";
import { fetchCaixaPostalIndicator } from "./indicator.ts";
import { mapCaixaPostalIndicator } from "./mapper.ts";
const request = { capabilityKey:"caixa_postal.new_message_indicator", authorization:{ connectionId:"c", organizationId:"o", clientId:"client", contractor:{type:"CNPJ",value:"11222333000181"}, requestAuthor:{type:"CNPJ",value:"11222333000181"}, taxpayer:{type:"CNPJ",value:"11222333000181"}}, input:{taxpayer:{type:"CNPJ",value:"11222333000181"}}, correlationId:"c",requestId:"r",requestTag:"tag" } as const;
Deno.test("maps completed, waiting and no-content without message content", async()=>{
  assertEquals((await fetchCaixaPostalIndicator(createFakeIntegraContadorProvider("completed"),request)).kind,"completed");
  assertEquals((await fetchCaixaPostalIndicator(createFakeIntegraContadorProvider("waiting"),request)).kind,"waiting_external");
  assertEquals((await fetchCaixaPostalIndicator(createFakeIntegraContadorProvider("noContent"),request)).kind,"no_content");
});
Deno.test("rejects malformed and identifier mismatch", async()=>{
  await assertRejects(()=>fetchCaixaPostalIndicator(createFakeIntegraContadorProvider("malformed"),request));
  assertThrows(()=>mapCaixaPostalIndicator({hasNewMessages:true,taxpayerTaxId:"00000000000000"},"11222333000181"));
});
