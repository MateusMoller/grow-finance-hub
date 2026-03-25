import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { GlobalFiltersProvider } from "@/hooks/useGlobalFilters";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { ThemeProvider } from "next-themes";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import SolutionsPage from "./pages/SolutionsPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import CalendarioPage from "./pages/CalendarioPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import TarefasPage from "./pages/TarefasPage";
import FormulariosPage from "./pages/FormulariosPage";
import CRMPage from "./pages/CRMPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import NotificacoesPage from "./pages/NotificacoesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import PortalClientePage from "./pages/PortalClientePage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import ManualPage from "./pages/ManualPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AuthProvider>
            <GlobalFiltersProvider>
              <Routes>
                {/* Site Institucional */}
                <Route path="/" element={<AboutPage />} />
                <Route path="/sobre" element={<AboutPage />} />
                <Route path="/inicio" element={<HomePage />} />
                <Route path="/solucoes" element={<SolutionsPage />} />
                <Route path="/contato" element={<ContactPage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* App Interno - Protegido */}
                <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/app/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
                <Route path="/app/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
                <Route path="/app/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
                <Route path="/app/clientes/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
                <Route path="/app/tarefas" element={<ProtectedRoute><TarefasPage /></ProtectedRoute>} />
                <Route path="/app/formularios" element={<ProtectedRoute><FormulariosPage /></ProtectedRoute>} />
                <Route path="/app/documentos" element={<ProtectedRoute><Navigate to="/app/clientes" replace /></ProtectedRoute>} />
                <Route path="/app/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
                <Route path="/app/comercial" element={<ProtectedRoute><Navigate to="/app/crm" replace /></ProtectedRoute>} />
                <Route path="/app/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
                <Route path="/app/notificacoes" element={<ProtectedRoute><NotificacoesPage /></ProtectedRoute>} />
                <Route path="/app/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
                <Route path="/app/solicitacoes" element={<ProtectedRoute><SolicitacoesPage /></ProtectedRoute>} />
                <Route path="/app/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />

                {/* Portal do Cliente - Protegido */}
                <Route path="/portal" element={<ProtectedRoute><PortalClientePage /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </GlobalFiltersProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
