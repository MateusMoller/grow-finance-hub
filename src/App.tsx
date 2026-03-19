import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import SolutionsPage from "./pages/SolutionsPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import ClientsPage from "./pages/ClientsPage";
import CRMPage from "./pages/CRMPage";
import TarefasPage from "./pages/TarefasPage";
import FormulariosPage from "./pages/FormulariosPage";
import DocumentosPage from "./pages/DocumentosPage";
import ComercialPage from "./pages/ComercialPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import NotificacoesPage from "./pages/NotificacoesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import PortalClientePage from "./pages/PortalClientePage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Site Institucional */}
            <Route path="/" element={<HomePage />} />
            <Route path="/sobre" element={<AboutPage />} />
            <Route path="/solucoes" element={<SolutionsPage />} />
            <Route path="/contato" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* App Interno */}
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/kanban" element={<KanbanPage />} />
            <Route path="/app/clientes" element={<ClientsPage />} />
            <Route path="/app/crm" element={<CRMPage />} />
            <Route path="/app/tarefas" element={<TarefasPage />} />
            <Route path="/app/formularios" element={<FormulariosPage />} />
            <Route path="/app/documentos" element={<DocumentosPage />} />
            <Route path="/app/comercial" element={<ComercialPage />} />
            <Route path="/app/relatorios" element={<RelatoriosPage />} />
            <Route path="/app/notificacoes" element={<NotificacoesPage />} />
            <Route path="/app/configuracoes" element={<ConfiguracoesPage />} />

            {/* Portal do Cliente */}
            <Route path="/portal" element={<PortalClientePage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
