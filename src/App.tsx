import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { GlobalFiltersProvider } from "@/hooks/useGlobalFilters";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { isFunctionalPwaRoute, syncPwaModeForPath } from "@/lib/pwaScope";

const HomePage = lazy(() => import("./pages/HomePage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SolutionsPage = lazy(() => import("./pages/SolutionsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const NewsletterPage = lazy(() => import("./pages/NewsletterPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CalendarioPage = lazy(() => import("./pages/CalendarioPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const TaskWorkspacePage = lazy(() => import("./pages/TaskWorkspacePage"));
const FormulariosPage = lazy(() => import("./pages/FormulariosPage"));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const ChatInternoPage = lazy(() => import("./pages/ChatInternoPage"));
const RelatoriosPage = lazy(() => import("./pages/RelatoriosPage"));
const ObrigacoesPage = lazy(() => import("./pages/ObrigacoesPage"));
const EContinuoPage = lazy(() => import("./pages/EContinuoPage"));
const NewsletterAdminPage = lazy(() => import("./pages/NewsletterAdminPage"));
const NotificacoesPage = lazy(() => import("./pages/NotificacoesPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));
const PortalClientePage = lazy(() => import("./pages/PortalClientePage"));
const ManualPage = lazy(() => import("./pages/ManualPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const SugestoesPage = lazy(() => import("./pages/SugestoesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const AppRouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    Carregando...
  </div>
);

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
              <Suspense fallback={<AppRouteFallback />}>
                <Routes>
                  {/* Site Institucional */}
                  <Route path="/" element={<AboutPage />} />
                  <Route path="/sobre" element={<AboutPage />} />
                  <Route path="/inicio" element={<HomePage />} />
                  <Route path="/solucoes" element={<SolutionsPage />} />
                  <Route path="/contato" element={<ContactPage />} />
                  <Route path="/newsletter" element={<NewsletterPage />} />
                  <Route path="/privacidade" element={<PrivacyPage />} />
                  <Route path="/termos" element={<TermsPage />} />
                  <Route path="/login" element={<Navigate to="/app/login" replace />} />
                  <Route path="/portal" element={<Navigate to="/app/portal" replace />} />
                  <Route path="/app/login" element={<LoginPage />} />

                  {/* App Interno - Protegido */}
                  <Route path="/app" element={<ProtectedRoute scope="internal"><DashboardPage /></ProtectedRoute>} />
                  <Route path="/app/kanban" element={<ProtectedRoute scope="internal"><Navigate to="/app/tarefas?view=kanban" replace /></ProtectedRoute>} />
                  <Route path="/app/calendario" element={<ProtectedRoute scope="internal"><CalendarioPage /></ProtectedRoute>} />
                  <Route path="/app/clientes" element={<ProtectedRoute scope="internal"><ClientsPage /></ProtectedRoute>} />
                  <Route path="/app/clientes/:id" element={<ProtectedRoute scope="internal"><ClientDetailPage /></ProtectedRoute>} />
                  <Route path="/app/tarefas" element={<ProtectedRoute scope="internal"><TaskWorkspacePage /></ProtectedRoute>} />
                  <Route path="/app/formularios" element={<ProtectedRoute scope="internal"><FormulariosPage /></ProtectedRoute>} />
                  <Route path="/app/processos" element={<ProtectedRoute scope="internal"><Navigate to="/app" replace /></ProtectedRoute>} />
                  <Route path="/app/documentos" element={<ProtectedRoute scope="internal"><Navigate to="/app" replace /></ProtectedRoute>} />
                  <Route path="/app/crm" element={<ProtectedRoute scope="internal"><CRMPage /></ProtectedRoute>} />
                  <Route path="/app/chat-interno" element={<ProtectedRoute scope="internal"><ChatInternoPage /></ProtectedRoute>} />
                  <Route path="/app/newsletter" element={<ProtectedRoute scope="internal"><NewsletterAdminPage /></ProtectedRoute>} />
                  <Route path="/app/comercial" element={<ProtectedRoute scope="internal"><Navigate to="/app/crm" replace /></ProtectedRoute>} />
                  <Route path="/app/relatorios" element={<ProtectedRoute scope="internal"><RelatoriosPage /></ProtectedRoute>} />
                  <Route path="/app/obrigacoes" element={<ProtectedRoute scope="internal"><ObrigacoesPage /></ProtectedRoute>} />
                  <Route path="/app/econtinuo" element={<ProtectedRoute scope="internal"><EContinuoPage /></ProtectedRoute>} />
                  <Route path="/app/acessorias" element={<ProtectedRoute scope="internal"><Navigate to="/app/obrigacoes" replace /></ProtectedRoute>} />
                  <Route path="/app/notificacoes" element={<ProtectedRoute scope="internal"><NotificacoesPage /></ProtectedRoute>} />
                  <Route path="/app/configuracoes" element={<ProtectedRoute scope="internal"><ConfiguracoesPage /></ProtectedRoute>} />
                  <Route path="/app/solicitacoes" element={<ProtectedRoute scope="internal"><Navigate to="/app/tarefas" replace /></ProtectedRoute>} />
                  <Route path="/app/manual" element={<ProtectedRoute scope="internal"><ManualPage /></ProtectedRoute>} />
                  <Route path="/app/usuarios" element={<ProtectedRoute scope="internal"><UsuariosPage /></ProtectedRoute>} />
                  <Route path="/app/sugestoes" element={<ProtectedRoute scope="internal"><SugestoesPage /></ProtectedRoute>} />
                  <Route path="/app/portal" element={<ProtectedRoute scope="portal"><PortalClientePage /></ProtectedRoute>} />

                  {/* Portal do Cliente - Protegido */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </GlobalFiltersProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
