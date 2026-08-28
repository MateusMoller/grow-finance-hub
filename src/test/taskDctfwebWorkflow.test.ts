import {readFileSync} from "node:fs";import {resolve} from "node:path";import {describe,expect,it} from "vitest";
const backend=readFileSync(resolve(process.cwd(),"supabase/functions/integra-contador-module/index.ts"),"utf8");
const panel=readFileSync(resolve(process.cwd(),"src/features/integra-contador/components/TaskDctfwebPanel.tsx"),"utf8");
describe("DCTFWeb inside canonical task",()=>{
 it("authorizes the task and reuses its obligation instance",()=>{expect(backend).toContain('if (action === "get_task_dctfweb_context")');expect(backend).toContain('task.integration_source !== "grow_obligation_task"');expect(backend).toContain('db.rpc("prepare_dctfweb_dossier"');});
 it("keeps the obligation task focused on declaration and controlled transmission",()=>{for(const label of ["Consultar declaração","Consultar recibo","Relatório completo","Revisar e aprovar","Transmitir declaração"])expect(panel).toContain(label);expect(panel).not.toContain("Gerar DARF");expect(backend).toContain('body.confirmation!=="TRANSMITIR DCTFWEB"');});
 it("keeps provider traffic out of the browser component",()=>{expect(panel).not.toContain("gateway.apiserpro");expect(panel).not.toContain("Authorization:");});
});
