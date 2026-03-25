import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "client") {
    if (!location.pathname.startsWith("/portal")) {
      return <Navigate to="/portal" replace />;
    }
  } else if (location.pathname.startsWith("/portal")) {
    return <Navigate to="/app" replace />;
  }

  const isDepartmentRole = role === "departamento_pessoal" || role === "fiscal" || role === "contabil";
  if (isDepartmentRole) {
    const pathname = location.pathname;
    const allowedPaths = [
      "/app/kanban",
      "/app/calendario",
      "/app/tarefas",
      "/app/clientes",
      "/app/solicitacoes",
      "/app/manual",
    ];
    const isAllowed = allowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));
    if (!isAllowed) {
      return <Navigate to="/app/kanban" replace />;
    }
  }

  return <>{children}</>;
}
