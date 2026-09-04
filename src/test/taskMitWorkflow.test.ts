import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backend=readFileSync(resolve(process.cwd(),"supabase/functions/integra-contador-module/index.ts"),"utf8");
const provider=readFileSync(resolve(process.cwd(),"supabase/functions/_shared/integra-contador/domains/mit/client.ts"),"utf8");
const panel=readFileSync(resolve(process.cwd(),"src/features/integra-contador/components/TaskMitPanel.tsx"),"utf8");
const migration=readFileSync(resolve(process.cwd(),"supabase/migrations/20260904140514_add_mit_internal_workflow.sql"),"utf8");

describe("MIT internal obligation workflow",()=>{
  it("creates a protected internal system obligation without client delivery",()=>{
    expect(migration).toContain("'mit', 'MIT - Módulo de Inclusão de Tributos'");
    expect(migration).toContain("completion_email_enabled=false");
    expect(migration).toContain("completion_whatsapp_enabled=false");
    expect(migration).toContain("requires_document=false");
  });
  it("only completes after the provider confirms a receipt",()=>{
    expect(backend).toContain('action==="verify_mit"');
    expect(backend).toContain('result.status==="transmitted"&&result.receiptNumber');
    expect(backend).toContain('status:"concluida"');
    expect(backend).toContain('body.confirmation!=="ENCERRAR E TRANSMITIR MIT"');
  });
  it("keeps SERPRO credentials and traffic outside the browser",()=>{
    expect(provider).toContain('Deno.env.get("MIT_SERPRO_BEARER")');
    expect(panel).not.toContain("MIT_SERPRO_BEARER");
    expect(panel).not.toContain("Authorization:");
  });
  it("supports preparation, validation, submission and verification inside the task",()=>{
    for(const label of ["Adicionar débito","Salvar apuração","Validar débitos","Encerrar e transmitir MIT","Confirmar transmissão"]) expect(panel).toContain(label);
  });
});
