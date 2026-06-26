import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { hasAnyInternalRole, hasClientRole, normalizeRoles } from "@/lib/accessControl";
import type { OrganizationFeatureKey } from "@/lib/organizationFeatures";
import { canAccessModule, resolveRouteModule } from "@/lib/userPermissions";

type RouteScope = "authenticated" | "internal" | "portal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  scope?: RouteScope;
  feature?: OrganizationFeatureKey;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  children,
  scope = "authenticated",
  feature,
  adminOnly = false,
}: ProtectedRouteProps) {
  const {
    user,
    loading,
    role,
    roles,
    roleLoaded,
    effectiveAccess,
  } = useAuth();
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
  const hasInternalAccess =
    effectiveAccess?.primaryRole === "admin" ||
    effectiveAccess?.primaryRole === "colaborador" ||
    hasAnyInternalRole(normalizedRoleList);
  const hasClientAccess =
    effectiveAccess?.primaryRole === "cliente" ||
    hasClientRole(normalizedRoleList);
  const isAdmin =
    effectiveAccess?.primaryRole === "admin" ||
    normalizedRoleList.includes("admin");

  if (
    effectiveAccess &&
    (effectiveAccess.status !== "active" || effectiveAccess.requiresAccessReview)
  ) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-lg rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">
            {effectiveAccess.requiresAccessReview ? "Acesso em revisão" : "Acesso indisponível"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Procure um administrador para revisar a configuração deste usuário.
          </p>
        </div>
      </div>
    );
  }

  if (scope === "internal" && !hasInternalAccess) {
    return <Navigate to={hasClientAccess ? "/app/portal" : "/app/login"} replace />;
  }

  if (scope === "portal" && !hasInternalAccess && !hasClientAccess) {
    return <Navigate to="/app/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={hasInternalAccess ? "/app/tarefas" : "/app/login"} replace />;
  }

  const routeModule = resolveRouteModule(location.pathname);
  if (
    scope === "internal" &&
    effectiveAccess &&
    routeModule &&
    !canAccessModule(effectiveAccess, routeModule)
  ) {
    return <Navigate to="/app/tarefas" replace />;
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
