import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backend=readFileSync(resolve(process.cwd(),"supabase/functions/integra-contador-module/index.ts"),"utf8");
const provider=readFileSync(resolve(process.cwd(),"supabase/functions/_shared/cnd/client.ts"),"utf8");
const panel=readFileSync(resolve(process.cwd(),"src/components/clients/ClientFiscalStatusSection.tsx"),"utf8");

describe("client federal CND workflow",()=>{
  it("keeps provider credentials and calls on the backend",()=>{
    expect(provider).toContain('Deno.env.get("CND_SERPRO_CLIENT_SECRET")');
    expect(panel).not.toContain("CND_SERPRO_CLIENT_SECRET");
    expect(panel).not.toContain("apigateway.conectagov");
  });
  it("requests the official PDF and handles slow-query keys in memory",()=>{
    expect(provider).toContain("GerarCertidaoPdf:true");
    expect(provider).toContain("result.status!==7");
    expect(provider).toContain("let key:string|undefined");
  });
  it("validates PDF content and does not persist its base64 payload",()=>{
    expect(backend).toContain('signature!=="%PDF-"');
    expect(backend).toContain('key.toLowerCase()!=="documentopdf"');
    expect(panel).toContain("Gerar CND");
    expect(panel).toContain("Baixar PDF");
  });
});
