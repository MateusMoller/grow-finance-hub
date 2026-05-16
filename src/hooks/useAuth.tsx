import { useState, useEffect, createContext, useContext } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import {
  getPrimaryRole,
  hasAnyDepartmentRole,
  hasAnyInternalRole,
  hasClientRole,
  normalizeRoles,
} from "@/lib/accessControl";

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const buildOrganizationStorageKey = (userId: string) => `grow-current-organization-${userId}`;

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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRole(null);
      setRoles([]);
      setAllRoles([]);
      setOrganizationRoles([]);
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setRoleLoaded(true);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setRoleLoaded(false);
        setTimeout(() => {
          void fetchRole(nextSession.user.id);
        }, 0);
      } else {
        setRole(null);
        setRoles([]);
        setAllRoles([]);
        setOrganizationRoles([]);
        setOrganizations([]);
        setCurrentOrganizationIdState(null);
        setRoleLoaded(true);
      }
    });

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

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
        }
      } catch {
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

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", userId);

    if (error) {
      setRole(null);
      setRoles([]);
      setAllRoles([]);
      setOrganizationRoles([]);
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setRoleLoaded(true);
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
    setRole(getPrimaryRole(activeRoles.length > 0 ? activeRoles : normalizedAllRoles));
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
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
    setAllRoles([]);
    setOrganizationRoles([]);
    setOrganizations([]);
    setCurrentOrganizationIdState(null);
    setRoleLoaded(true);
  };

  const currentOrganization = organizations.find((organization) => organization.id === currentOrganizationId) || null;
  const isInternalUser = hasAnyInternalRole(roles);
  const isClientUser = hasClientRole(roles);
  const isDepartmentUser = hasAnyDepartmentRole(roles);

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
