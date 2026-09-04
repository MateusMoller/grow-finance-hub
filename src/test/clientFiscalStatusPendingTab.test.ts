import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page=readFileSync(resolve(process.cwd(),"src/pages/ClientDetailPage.tsx"),"utf8");

describe("client pending tab fiscal consultation",()=>{
  it("replaces the old pending form with the fiscal status consultation",()=>{
    const tab=page.slice(page.indexOf('<TabsContent value="pendencias"'));
    expect(tab).toContain("<ClientFiscalStatusSection");
    expect(tab).not.toContain("Criar pendencia");
    expect(tab).not.toContain("Titulo da pendencia");
  });
});
