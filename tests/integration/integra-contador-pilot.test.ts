import { describe,expect,it } from "vitest";
import { buildFiscalSyncMessage,isFreshFiscalCache } from "../../supabase/functions/_shared/integra-contador/workflows/sync-receita";
describe("Integra Contador pilot workflow",()=>{
  it("queues identifiers only and recognizes fresh cache",()=>{const message=buildFiscalSyncMessage({id:"run",organizationId:"org",clientId:"client",correlationId:"corr"});expect(JSON.stringify(message)).not.toMatch(/cpf|cnpj|taxpayer|secret/i);expect(isFreshFiscalCache(new Date(Date.now()+1000).toISOString())).toBe(true)});
  it("rejects stale cache",()=>expect(isFreshFiscalCache(new Date(Date.now()-1000).toISOString())).toBe(false));
});
