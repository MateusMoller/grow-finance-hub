import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { hasAnyInternalRole, hasClientRole, isDepartmentOnlyUser, normalizeRoles } from "@/lib/accessControl";

type RouteScope = "authenticated" | "internal" | "portal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  scope?: RouteScope;
}

export function ProtectedRoute({ children, scope = "authenticated" }: ProtectedRouteProps) {
  const { user, loading, role, roles, roleLoaded } = useAuth();
  const location = useLocation();

  if (loading || (user && !roleLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const loginPath = location.pathname.startsWith("/app") ? "/app/login" : "/login";
    return <Navigate to={loginPath} replace />;
  }

  const normalizedRoleList = normalizeRoles(roles.length > 0 ? roles : role ? [role] : []);
  const hasInternalAccess = hasAnyInternalRole(normalizedRoleList);
  const hasClientAccess = hasClientRole(normalizedRoleList);
  const isDepartmentUser = isDepartmentOnlyUser(normalizedRoleList);

  if (scope === "internal" && !hasInternalAccess) {
    if (hasClientAccess) {
      return <Navigate to="/app/portal" replace />;
    }
    return <Navigate to="/app/login" replace />;
  }

  if (scope === "portal" && !hasInternalAccess && !hasClientAccess) {
    return <Navigate to="/app/login" replace />;
  }

  if (scope === "internal" && isDepartmentUser && location.pathname.startsWith("/app")) {
    const pathname = location.pathname;
    const allowedPaths = [
      "/app/kanban",
      "/app/calendario",
      "/app/tarefas",
      "/app/clientes",
      "/app/solicitacoes",
      "/app/formulários",
      "/app/relatorios",
      "/app/obrigacoes",
      "/app/econtinuo",
      "/app/acessorias",
      "/app/sugestoes",
      "/app/manual",
    ];
    const isAllowed = allowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));
    if (!isAllowed) {
      return <Navigate to="/app/kanban" replace />;
    }
  }

  return <>{children}</>;
}
