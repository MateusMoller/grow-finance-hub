import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
import { ClientFiscalStatusSection } from "@/components/clients/ClientFiscalStatusSection";
vi.mock("@/features/integra-contador/hooks/useClientFiscalStatus",()=>({useClientFiscalStatus:()=>({query:{isLoading:false,isError:false,data:{indicator:{hasNewMessages:true,indicatorCode:"NEW",sourceUpdatedAt:null,fetchedAt:"2026-08-14T12:00:00Z",stale:false},run:{id:"r",status:"completed",nextAttemptAt:null,errorCode:null,createdAt:"2026-08-14T12:00:00Z"},allowedActions:["sync"]}},sync:{isPending:false,mutate:vi.fn()}})}));
vi.mock("@/features/integra-contador/hooks/useClientCnd",()=>({useClientCnd:()=>({query:{isLoading:false,data:{configured:true,certificate:null}},issue:{isPending:false,mutate:vi.fn()},openPdf:vi.fn()})}));
describe("ClientFiscalStatusSection",()=>{
  it("does not render while feature is disabled",()=>{const {container}=render(<QueryClientProvider client={new QueryClient()}><ClientFiscalStatusSection organizationId="o" clientId="c" enabled={false}/></QueryClientProvider>);expect(container).toBeEmptyDOMElement()});
  it("renders fiscal status and CND actions",()=>{render(<QueryClientProvider client={new QueryClient()}><ClientFiscalStatusSection organizationId="o" clientId="c" enabled/></QueryClientProvider>);expect(screen.getByRole("status")).toHaveTextContent("Há novas mensagens");expect(screen.getByRole("button",{name:/Consultar situação fiscal/})).toBeEnabled();expect(screen.getByRole("button",{name:/Gerar CND/})).toBeEnabled();expect(screen.getByText(/não cria nem envia uma pendência/i)).toBeInTheDocument()});
});
