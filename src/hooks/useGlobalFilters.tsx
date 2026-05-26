import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildRecentCompetences,
  formatCompetenceLabel,
  normalizeCompetence,
  normalizeFilterText,
} from "@/lib/globalFilters";

type TaskDateRow = Pick<Tables<"kanban_tasks">, "due_date" | "created_at">;
type ClientRow = Pick<Tables<"clients">, "name">;

interface GlobalFiltersContextType {
  selectedCompany: string | null;
  selectedCompetence: string | null;
  setSelectedCompany: (value: string | null) => void;
  setSelectedCompetence: (value: string | null) => void;
  clearFilters: () => void;
  companyOptions: string[];
  competenceOptions: string[];
  loadingOptions: boolean;
  formatCompetence: (value: string) => string;
}

const GlobalFiltersContext = createContext<GlobalFiltersContextType | undefined>(undefined);

const getCompanyStorageKey = (userId: string) => `grow-global-company-${userId}`;
const getCompetenceStorageKey = (userId: string) => `grow-global-competence-${userId}`;

export function GlobalFiltersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedCompetence, setSelectedCompetence] = useState<string | null>(null);
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [competenceOptions, setCompetenceOptions] = useState<string[]>(buildRecentCompetences(12));
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setSelectedCompany(null);
      setSelectedCompetence(null);
      setCompanyOptions([]);
      setCompetenceOptions(buildRecentCompetences(12));
      return;
    }

    const storedCompany = localStorage.getItem(getCompanyStorageKey(user.id));
    const storedCompetence = localStorage.getItem(getCompetenceStorageKey(user.id));
    setSelectedCompany(storedCompany || null);
    setSelectedCompetence(normalizeCompetence(storedCompetence) || null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (selectedCompany) {
      localStorage.setItem(getCompanyStorageKey(user.id), selectedCompany);
    } else {
      localStorage.removeItem(getCompanyStorageKey(user.id));
    }
  }, [selectedCompany, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (selectedCompetence) {
      localStorage.setItem(getCompetenceStorageKey(user.id), selectedCompetence);
    } else {
      localStorage.removeItem(getCompetenceStorageKey(user.id));
    }
  }, [selectedCompetence, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadOptions = async () => {
      setLoadingOptions(true);

      const [clientsRes, tasksRes] = await Promise.all([
        supabase.from("clients").select("name").order("name"),
        supabase.from("kanban_tasks").select("due_date, created_at").limit(2000),
      ]);

      if (cancelled) return;

      const clients = (clientsRes.data || []) as ClientRow[];
      const taskDates = (tasksRes.data || []) as TaskDateRow[];

      const companies = Array.from(
        new Set(
          clients
            .map((client) => (client.name || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

      const competenceSet = new Set<string>(buildRecentCompetences(12));
      taskDates.forEach((task) => {
        const dueCompetence = normalizeCompetence(task.due_date);
        const createdCompetence = normalizeCompetence(task.created_at);
        if (dueCompetence) competenceSet.add(dueCompetence);
        if (createdCompetence) competenceSet.add(createdCompetence);
      });

      const competences = Array.from(competenceSet).sort((a, b) => b.localeCompare(a));

      setCompanyOptions(companies);
      setCompetenceOptions(competences);
      setLoadingOptions(false);
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedCompany) return;
    const hasCompany = companyOptions.some(
      (option) => normalizeFilterText(option) === normalizeFilterText(selectedCompany)
    );
    if (!hasCompany) setSelectedCompany(null);
  }, [companyOptions, selectedCompany]);

  useEffect(() => {
    if (!selectedCompetence) return;
    const normalized = normalizeCompetence(selectedCompetence);
    const hasCompetence = competenceOptions.some(
      (option) => normalizeCompetence(option) === normalized
    );
    if (!hasCompetence) setSelectedCompetence(null);
  }, [competenceOptions, selectedCompetence]);

  const clearFilters = () => {
    setSelectedCompany(null);
    setSelectedCompetence(null);
  };

  const contextValue = useMemo<GlobalFiltersContextType>(
    () => ({
      selectedCompany,
      selectedCompetence,
      setSelectedCompany,
      setSelectedCompetence,
      clearFilters,
      companyOptions,
      competenceOptions,
      loadingOptions,
      formatCompetence: formatCompetenceLabel,
    }),
    [
      selectedCompany,
      selectedCompetence,
      companyOptions,
      competenceOptions,
      loadingOptions,
    ]
  );

  return (
    <GlobalFiltersContext.Provider value={contextValue}>
      {children}
    </GlobalFiltersContext.Provider>
  );
}

export function useGlobalFilters() {
  const context = useContext(GlobalFiltersContext);
  if (!context) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return context;
}
