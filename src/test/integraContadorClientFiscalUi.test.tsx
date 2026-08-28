import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
import { ClientFiscalStatusSection } from "@/components/clients/ClientFiscalStatusSection";
vi.mock("@/features/integra-contador/hooks/useClientFiscalStatus",()=>({useClientFiscalStatus:()=>({query:{isLoading:false,isError:false,data:{indicator:{hasNewMessages:true,indicatorCode:"NEW",sourceUpdatedAt:null,fetchedAt:"2026-08-14T12:00:00Z",stale:false},run:{id:"r",status:"completed",nextAttemptAt:null,errorCode:null,createdAt:"2026-08-14T12:00:00Z"},allowedActions:["sync"]}},sync:{isPending:false,mutate:vi.fn()}})}));
describe("ClientFiscalStatusSection",()=>{
  it("does not render while feature is disabled",()=>{const {container}=render(<QueryClientProvider client={new QueryClient()}><ClientFiscalStatusSection organizationId="o" clientId="c" enabled={false}/></QueryClientProvider>);expect(container).toBeEmptyDOMElement()});
  it("renders normalized indicator and accessible sync action",()=>{render(<QueryClientProvider client={new QueryClient()}><ClientFiscalStatusSection organizationId="o" clientId="c" enabled/></QueryClientProvider>);expect(screen.getByRole("status")).toHaveTextContent("Há novas mensagens");expect(screen.getByRole("button",{name:/Sincronizar situação fiscal/})).toBeEnabled()});
});
