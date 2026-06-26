import { useState, useEffect, useRef, createContext, useContext } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import {
  getPrimaryRole,
  hasAnyDepartmentRole,
  hasAnyInternalRole,
  hasClientRole,
  mapLegacyRoleToCanonical,
  normalizeRoles,
} from "@/lib/accessControl";
import {
  MODULE_KEYS,
  type EffectiveAccess,
  type ModuleKey,
  type PrimaryRole,
  type SectorCode,
  type UserStatus,
} from "@/lib/userPermissions";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  roles: string[];
  allRoles: string[];
  roleLoaded: boolean;
  organizations: OrganizationSummary[];
  currentOrganization: OrganizationSummary | null;
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (organizationId: string) => void;
  isInternalUser: boolean;
  isClientUser: boolean;
  isDepartmentUser: boolean;
  effectiveAccess: EffectiveAccess | null;
  enabledModules: ModuleKey[];
  sectorCode: SectorCode | null;
  accessStatus: UserStatus | null;
  requiresAccessReview: boolean;
  activeClientIds: string[];
  refreshAccess: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

type OrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  is_active?: boolean | null;
};

type RoleRow = {
  role: string | null;
  organization_id?: string | null;
};

type AccessRow = {
  organization_id: string;
  user_id: string;
  primary_role: PrimaryRole;
  status: UserStatus;
  sector_code: SectorCode | null;
  requires_access_review: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const buildOrganizationStorageKey = (userId: string) => `grow-current-organization-${userId}`;
const sameUserSessionEvents = new Set(["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"]);

function isMissingOrganizationColumnError(error: { message?: string; details?: string } | null) {
  const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return text.includes("organization_id") && (text.includes("column") || text.includes("schema cache"));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<string[]>([]);
  const [organizationRoles, setOrganizationRoles] = useState<RoleRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [effectiveAccess, setEffectiveAccess] = useState<EffectiveAccess | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRole(null);
      setRoles([]);
      setAllRoles([]);
      setOrganizationRoles([]);
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setRoleLoaded(true);
      setEffectiveAccess(null);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const isSameUserSessionEvent =
        Boolean(nextUserId) &&
        nextUserId === currentUserIdRef.current &&
        sameUserSessionEvents.has(event);

      if (isSameUserSessionEvent) {
        return;
      }

      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setRoleLoaded(false);
        setTimeout(() => {
          void fetchRole(nextSession.user.id);
        }, 0);
      } else {
        currentUserIdRef.current = null;
        setRole(null);
        setRoles([]);
        setAllRoles([]);
        setOrganizationRoles([]);
        setOrganizations([]);
        setCurrentOrganizationIdState(null);
        setRoleLoaded(true);
        setEffectiveAccess(null);
      }
    });

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        currentUserIdRef.current = initialSession?.user?.id ?? null;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          setRoleLoaded(false);
          await fetchRole(initialSession.user.id);
        } else {
          setRole(null);
          setRoles([]);
          setAllRoles([]);
          setOrganizationRoles([]);
          setOrganizations([]);
          setCurrentOrganizationIdState(null);
          setRoleLoaded(true);
          setEffectiveAccess(null);
        }
      } catch {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setRoles([]);
        setAllRoles([]);
        setOrganizationRoles([]);
        setOrganizations([]);
        setCurrentOrganizationIdState(null);
        setRoleLoaded(true);
      }

      setLoading(false);
    };

    void initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string, requestedOrganizationId?: string | null) => {
    const [canonicalResult, legacyResult] = await Promise.all([
      supabase
        .from("organization_user_access")
        .select("organization_id, user_id, primary_role, status, sector_code, requires_access_review")
        .eq("user_id", userId),
      supabase
        .from("user_roles")
        .select("role, organization_id")
        .eq("user_id", userId),
    ]);

    const canonicalRows = ((canonicalResult.data || []) as AccessRow[])
      .filter((item) => item.organization_id && item.primary_role);

    if (!canonicalResult.error && canonicalRows.length > 0) {
      const organizationIds = Array.from(new Set(canonicalRows.map((item) => item.organization_id)));
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, slug, name, is_active")
        .in("id", organizationIds);

      const organizationRows = ((orgData || []) as OrganizationSummary[])
        .filter((organization) => organizationIds.includes(organization.id));
      const storedOrganizationId = requestedOrganizationId || localStorage.getItem(buildOrganizationStorageKey(userId));
      const preferredOrganization =
        organizationRows.find((organization) => organization.id === storedOrganizationId) ||
        organizationRows.find((organization) => organization.slug === "grow") ||
        organizationRows[0] ||
        null;
      const activeOrganizationId = preferredOrganization?.id ?? organizationIds[0] ?? null;
      const activeAccess = canonicalRows.find((item) => item.organization_id === activeOrganizationId) || canonicalRows[0];

      const [grantResult, linkResult] = await Promise.all([
        activeAccess.primary_role === "colaborador"
          ? supabase
              .from("user_module_grants")
              .select("module_key")
              .eq("organization_id", activeAccess.organization_id)
              .eq("user_id", userId)
          : Promise.resolve({ data: [], error: null }),
        activeAccess.primary_role === "cliente"
          ? supabase
              .from("client_users")
              .select("client_id")
              .eq("organization_id", activeAccess.organization_id)
              .eq("user_id", userId)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      ]);

      const enabledModules = activeAccess.primary_role === "admin"
        ? [...MODULE_KEYS]
        : Array.from(
            new Set(
              ((grantResult.data || []) as { module_key?: string | null }[])
                .map((item) => item.module_key)
                .filter((item): item is ModuleKey => MODULE_KEYS.includes(item as ModuleKey)),
            ),
          );
      const activeClientIds = ((linkResult.data || []) as { client_id?: string | null }[])
        .map((item) => item.client_id)
        .filter((item): item is string => Boolean(item));
      const resolvedAccess: EffectiveAccess = {
        organizationId: activeAccess.organization_id,
        userId,
        status: activeAccess.status,
        primaryRole: activeAccess.primary_role,
        sectorCode: activeAccess.sector_code,
        enabledModules,
        activeClientIds,
        requiresAccessReview: activeAccess.requires_access_review,
      };

      setOrganizationRoles(
        canonicalRows.map((item) => ({
          organization_id: item.organization_id,
          role: item.primary_role,
        })),
      );
      setOrganizations(organizationRows);
      setCurrentOrganizationIdState(activeAccess.organization_id);
      setAllRoles(Array.from(new Set(canonicalRows.map((item) => item.primary_role))));
      setRoles([activeAccess.primary_role]);
      setRole(activeAccess.primary_role);
      setEffectiveAccess(resolvedAccess);
      setRoleLoaded(true);
      return;
    }

    let { data, error } = legacyResult;

    if (error && isMissingOrganizationColumnError(error)) {
      const fallback = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      data = fallback.data?.map((item) => ({ ...item, organization_id: null })) || null;
      error = fallback.error;
    }

    if (error) {
      setRole(null);
      setRoles([]);
      setAllRoles([]);
      setOrganizationRoles([]);
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setRoleLoaded(true);
      setEffectiveAccess(null);
      return;
    }

    const roleRows = ((data || []) as RoleRow[])
      .map((item) => ({
        role: item.role ? String(item.role) : null,
        organization_id: item.organization_id ? String(item.organization_id) : null,
      }))
      .filter((item) => item.role);

    const mappedRoles = roleRows
      .map((item) => String(item.role || ""))
      .filter((value) => value.length > 0);
    const normalizedAllRoles = normalizeRoles(mappedRoles);
    const organizationIds = Array.from(
      new Set(roleRows.map((item) => item.organization_id).filter((value): value is string => Boolean(value))),
    );

    let organizationRows: OrganizationSummary[] = [];

    if (organizationIds.length > 0) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, slug, name, is_active")
        .in("id", organizationIds);

      organizationRows = ((orgData || []) as OrganizationSummary[]).filter((org) => organizationIds.includes(org.id));
    }

    const storedOrganizationId = localStorage.getItem(buildOrganizationStorageKey(userId));
    const preferredOrganization =
      organizationRows.find((org) => org.id === storedOrganizationId) ||
      organizationRows.find((org) => org.slug === "grow") ||
      organizationRows[0] ||
      null;

    const activeOrganizationId = preferredOrganization?.id ?? organizationIds[0] ?? null;
    const activeRoles = activeOrganizationId
      ? normalizeRoles(
          roleRows
            .filter((item) => item.organization_id === activeOrganizationId)
            .map((item) => item.role),
        )
      : normalizedAllRoles;

    setOrganizationRoles(roleRows);
    setOrganizations(organizationRows);
    setCurrentOrganizationIdState(activeOrganizationId);
    setAllRoles(normalizedAllRoles);
    setRoles(activeRoles);
    const legacyRoles = activeRoles.length > 0 ? activeRoles : normalizedAllRoles;
    const canonicalRole = mapLegacyRoleToCanonical(legacyRoles);
    setRole(canonicalRole || getPrimaryRole(legacyRoles));
    setEffectiveAccess(
      activeOrganizationId && canonicalRole
        ? {
            organizationId: activeOrganizationId,
            userId,
            status: "active",
            primaryRole: canonicalRole,
            sectorCode: null,
            enabledModules: canonicalRole === "admin" ? [...MODULE_KEYS] : [],
            activeClientIds: [],
            requiresAccessReview: false,
          }
        : null,
    );
    setRoleLoaded(true);
  };

  const setCurrentOrganizationId = (organizationId: string) => {
    if (!user || !organizations.some((organization) => organization.id === organizationId)) return;

    localStorage.setItem(buildOrganizationStorageKey(user.id), organizationId);
    setCurrentOrganizationIdState(organizationId);

    const activeRoles = normalizeRoles(
      organizationRoles
        .filter((item) => item.organization_id === organizationId)
        .map((item) => item.role),
    );

    setRoles(activeRoles);
    setRole(getPrimaryRole(activeRoles.length > 0 ? activeRoles : allRoles));
    void fetchRole(user.id, organizationId);
  };

  const refreshAccess = async () => {
    if (!user?.id) return;
    setRoleLoaded(false);
    await fetchRole(user.id, currentOrganizationId);
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error("Configuracao do Supabase ausente. Verifique runtime-config.js ou variaveis VITE_SUPABASE_*."),
      };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
    setAllRoles([]);
    setOrganizationRoles([]);
    setOrganizations([]);
    setCurrentOrganizationIdState(null);
    setRoleLoaded(true);
    setEffectiveAccess(null);
  };

  const currentOrganization = organizations.find((organization) => organization.id === currentOrganizationId) || null;
  const isInternalUser =
    effectiveAccess?.primaryRole === "admin" ||
    effectiveAccess?.primaryRole === "colaborador" ||
    hasAnyInternalRole(roles);
  const isClientUser = effectiveAccess?.primaryRole === "cliente" || hasClientRole(roles);
  const isDepartmentUser = Boolean(effectiveAccess?.sectorCode) || hasAnyDepartmentRole(roles);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        roles,
        allRoles,
        roleLoaded,
        organizations,
        currentOrganization,
        currentOrganizationId,
        setCurrentOrganizationId,
        isInternalUser,
        isClientUser,
        isDepartmentUser,
        effectiveAccess,
        enabledModules: effectiveAccess?.enabledModules || [],
        sectorCode: effectiveAccess?.sectorCode || null,
        accessStatus: effectiveAccess?.status || null,
        requiresAccessReview: effectiveAccess?.requiresAccessReview || false,
        activeClientIds: effectiveAccess?.activeClientIds || [],
        refreshAccess,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
