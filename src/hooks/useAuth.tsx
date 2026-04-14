import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";
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
  roleLoaded: boolean;
  isInternalUser: boolean;
  isClientUser: boolean;
  isDepartmentUser: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
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
        setRoleLoaded(true);
      }
    });

    const initializeAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        setRoleLoaded(false);
        await fetchRole(initialSession.user.id);
      } else {
        setRole(null);
        setRoles([]);
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
      .select("role")
      .eq("user_id", userId);

    if (error) {
      setRole(null);
      setRoles([]);
      setRoleLoaded(true);
      return;
    }

    const mappedRoles = (data || [])
      .map((item) => String(item.role || ""))
      .filter((value) => value.length > 0);
    const normalizedRoles = normalizeRoles(mappedRoles);

    setRoles(normalizedRoles);
    setRole(getPrimaryRole(normalizedRoles));
    setRoleLoaded(true);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
    setRoleLoaded(true);
  };

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
        roleLoaded,
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
