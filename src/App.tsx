import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { GlobalFiltersProvider } from "@/hooks/useGlobalFilters";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { isFunctionalPwaRoute, syncPwaModeForPath } from "@/lib/pwaScope";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import SolutionsPage from "./pages/SolutionsPage";
import ContactPage from "./pages/ContactPage";
import NewsletterPage from "./pages/NewsletterPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import CalendarioPage from "./pages/CalendarioPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import TarefasPage from "./pages/TarefasPage";
import FormulariosPage from "./pages/FormulariosPage";
import CRMPage from "./pages/CRMPage";
import ChatInternoPage from "./pages/ChatInternoPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import NewsletterAdminPage from "./pages/NewsletterAdminPage";
import NotificacoesPage from "./pages/NotificacoesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import PortalClientePage from "./pages/PortalClientePage";
import SolicitacoesPage from "./pages/SolicitacoesPage";
import ManualPage from "./pages/ManualPage";
import UsuariosPage from "./pages/UsuariosPage";
import SugestoesPage from "./pages/SugestoesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const PwaModeSync = () => {
  const location = useLocation();

  useEffect(() => {
    void syncPwaModeForPath(location.pathname);
  }, [location.pathname]);

  return null;
};

const PwaFunctionalRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;
    if (isFunctionalPwaRoute(location.pathname)) return;

    navigate("/app/login", { replace: true });
  }, [location.pathname, navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="grow-ui-theme"
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <PwaModeSync />
          <PwaFunctionalRouteGuard />
          <AuthProvider>
            <GlobalFiltersProvider>
              <Routes>
                {/* Site Institucional */}
                <Route path="/" element={<AboutPage />} />
                <Route path="/sobre" element={<AboutPage />} />
                <Route path="/inicio" element={<HomePage />} />
                <Route path="/solucoes" element={<SolutionsPage />} />
                <Route path="/contato" element={<ContactPage />} />
                <Route path="/newsletter" element={<NewsletterPage />} />
                <Route path="/login" element={<Navigate to="/app/login" replace />} />
                <Route path="/portal" element={<Navigate to="/app/portal" replace />} />
                <Route path="/app/login" element={<LoginPage />} />

                {/* App Interno - Protegido */}
                <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/app/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
                <Route path="/app/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
                <Route path="/app/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
                <Route path="/app/clientes/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
                <Route path="/app/tarefas" element={<ProtectedRoute><TarefasPage /></ProtectedRoute>} />
                <Route path="/app/formularios" element={<ProtectedRoute><FormulariosPage /></ProtectedRoute>} />
                <Route path="/app/processos" element={<ProtectedRoute><Navigate to="/app" replace /></ProtectedRoute>} />
                <Route path="/app/documentos" element={<ProtectedRoute><Navigate to="/app" replace /></ProtectedRoute>} />
                <Route path="/app/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
                <Route path="/app/chat-interno" element={<ProtectedRoute><ChatInternoPage /></ProtectedRoute>} />
                <Route path="/app/newsletter" element={<ProtectedRoute><NewsletterAdminPage /></ProtectedRoute>} />
                <Route path="/app/comercial" element={<ProtectedRoute><Navigate to="/app/crm" replace /></ProtectedRoute>} />
                <Route path="/app/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
                <Route path="/app/notificacoes" element={<ProtectedRoute><NotificacoesPage /></ProtectedRoute>} />
                <Route path="/app/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
                <Route path="/app/solicitacoes" element={<ProtectedRoute><SolicitacoesPage /></ProtectedRoute>} />
                <Route path="/app/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />
                <Route path="/app/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
                <Route path="/app/sugestoes" element={<ProtectedRoute><SugestoesPage /></ProtectedRoute>} />
                <Route path="/app/portal" element={<ProtectedRoute><PortalClientePage /></ProtectedRoute>} />

                {/* Portal do Cliente - Protegido */}
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
