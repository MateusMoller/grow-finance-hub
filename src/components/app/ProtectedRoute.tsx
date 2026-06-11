import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { hasAnyInternalRole, hasClientRole, isDepartmentOnlyUser, normalizeRoles } from "@/lib/accessControl";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import type { OrganizationFeatureKey } from "@/lib/organizationFeatures";

type RouteScope = "authenticated" | "internal" | "portal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  scope?: RouteScope;
  feature?: OrganizationFeatureKey;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, scope = "authenticated", feature, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading, role, roles, roleLoaded } = useAuth();
  const { isFeatureEnabled, isLoading: settingsLoading } = useOrganizationSettings();
  const location = useLocation();

  if (loading || (user && !roleLoaded) || (user && feature && settingsLoading)) {
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
  const isAdmin = normalizedRoleList.includes("admin");

  if (scope === "internal" && !hasInternalAccess) {
    if (hasClientAccess) {
      return <Navigate to="/app/portal" replace />;
    }
    return <Navigate to="/app/login" replace />;
  }

  if (scope === "portal" && !hasInternalAccess && !hasClientAccess) {
    return <Navigate to="/app/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={hasInternalAccess ? "/app" : "/app/login"} replace />;
  }

  if (scope === "internal" && isDepartmentUser && location.pathname.startsWith("/app")) {
    const pathname = location.pathname;
    const allowedPaths = [
      "/app/kanban",
      "/app/calendario",
      "/app/tarefas",
      "/app/clientes",
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
      return <Navigate to="/app/tarefas" replace />;
    }
  }

  if (feature && !isFeatureEnabled(feature)) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-lg rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Módulo indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este módulo está desativado para a organização atual.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
