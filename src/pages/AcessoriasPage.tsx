
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { motion } from "framer-motion";
import {
  Link2,
  Upload,
  Building2,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  Plus,
  RefreshCcw,
  Pencil,
  FileText,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import {
  getPreflightBlockingErrors,
  normalizePreflightCompetence,
  parseEcontinuoFiles,
  type EcontinuoPreflightRow,
  type ExtractionEvidence,
} from "@/lib/econtinuoPreflightParser";

type AcessoriasCompany = {
  acessorias_company_id: string;
  company_name: string;
  cnpj: string | null;
  status: string | null;
  last_synced_at: string | null;
};

type AcessoriasClientOverview = {
  id: string;
  name: string;
  cnpj: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  whatsapp_phone_digits: string | null;
  linked: boolean;
  acessorias_company_name: string | null;
  acessorias_company_status: string | null;
  link: {
    acessorias_company_id: string;
    match_type: string | null;
    last_synced_at: string | null;
  } | null;
  obligations: {
    total: number;
    pending: number;
    overdue: number;
    lastSyncedAt: string | null;
  };
};

type AcessoriasObligation = {
  id: string;
  client_id: string;
  client_name: string | null;
  acessorias_company_name: string | null;
  obligation_name: string;
  obligation_period: string | null;
  due_date: string | null;
  delivered_at: string | null;
  status: string | null;
  protocol: string | null;
  notes: string | null;
  last_synced_at: string | null;
};

type AcessoriasUpload = {
  id: string;
  client_id: string | null;
  acessorias_company_id: string | null;
  client_name: string | null;
  company_name: string | null;
  obligation_name: string | null;
  competence: string | null;
  file_name: string;
  status: string;
  error_message: string | null;
  uploaded_at: string | null;
};

type OverviewPayload = {
  ok: boolean;
  has_acessorias_configuration: boolean;
  clients: AcessoriasClientOverview[];
  companies: AcessoriasCompany[];
  uploads: AcessoriasUpload[];
  summary: {
    clients_total: number;
    clients_linked: number;
    companies_cached: number;
    obligations_total: number;
    obligations_pending: number;
    obligations_overdue: number;
    recent_uploads: number;
  };
};

type EcontinuoPreflightRowState = EcontinuoPreflightRow & {
  sendStatus: "idle" | "sending" | "sent" | "error";
  sendMessage: string | null;
  whatsappNumber: string;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
};

const obligationStatusVariant = (status: string | null) => {
  const token = String(status || "").trim().toLowerCase();
  if (token === "concluído" || token === "completed" || token === "sent") return "default";
  if (token === "atrasado" || token === "overdue") return "destructive";
  if (token === "em_andamento" || token === "processing") return "secondary";
  return "outline";
};

const normalizeObligationStatusToken = (status: string | null) => {
  const token = String(status || "").trim().toLowerCase();
  if (!token) return "pendente";
  if (["concluído", "completed", "delivered", "sent", "entregue"].includes(token)) return "concluído";
  if (["atrasado", "overdue", "late", "vencido"].includes(token)) return "atrasado";
  if (["em_andamento", "processing", "in_progress", "resolvendo"].includes(token)) return "em_andamento";
  return "pendente";
};

const uploadStatusBadgeClass = (status: string) => {
  const token = String(status || "").trim().toLowerCase();
  if (token === "sent") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (token === "error") return "bg-red-100 text-red-800 border-red-200";
  return "bg-muted text-muted-foreground";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.readAsDataURL(file);
  });

const normalizeWhatsappNumber = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

const formatWhatsappDisplay = (value: string | null | undefined) => {
  const digits = normalizeWhatsappNumber(value);
  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits;
};

interface AcessoriasPageProps {
  module?: "obrigações" | "econtinuo";
}

export function AcessoriasPage({ module = "obrigações" }: AcessoriasPageProps) {
  const [loading, setLoading] = useState(true);
  const [syncingCompanies, setSyncingCompanies] = useState(false);
  const [syncingObligations, setSyncingObligations] = useState(false);
  const [assigningObligation, setAssigningObligation] = useState(false);

  const [hasConfiguration, setHasConfiguration] = useState(false);
  const [clients, setClients] = useState<AcessoriasClientOverview[]>([]);
  const [obligations, setObligations] = useState<AcessoriasObligation[]>([]);
  const [uploads, setUploads] = useState<AcessoriasUpload[]>([]);
  const [summary, setSummary] = useState<OverviewPayload["summary"]>({
    clients_total: 0,
    clients_linked: 0,
    companies_cached: 0,
    obligations_total: 0,
    obligations_pending: 0,
    obligations_overdue: 0,
    recent_uploads: 0,
  });

  const [obligationSearch, setObligationSearch] = useState("");
  const [obligationStatusFilter, setObligationStatusFilter] = useState<string>("all");
  const [editingObligation, setEditingObligation] = useState<AcessoriasObligation | null>(null);
  const [savingObligation, setSavingObligation] = useState(false);
  const [editObligationForm, setEditObligationForm] = useState({
    obligation_name: "",
    obligation_period: "",
    due_date: "",
    status: "pendente",
    protocol: "",
    notes: "",
  });

  const [newObligation, setNewObligation] = useState({
    client_id: "",
    obligation_name: "",
    obligation_period: "",
    due_date: "",
    status: "pendente",
    notes: "",
  });

  const [preflightRows, setPreflightRows] = useState<EcontinuoPreflightRowState[]>([]);
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightParsing, setPreflightParsing] = useState(false);
  const [sendingPreflight, setSendingPreflight] = useState(false);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const econtinuoFileInputRef = useRef<HTMLInputElement | null>(null);
  const isObrigacoesModule = module === "obrigações";

  const filteredObligations = useMemo(() => {
    const searchToken = obligationSearch.trim().toLowerCase();
    return obligations.filter((item) => {
      const statusMatches =
        obligationStatusFilter === "all" ||
        normalizeObligationStatusToken(item.status) === obligationStatusFilter;
      if (!statusMatches) return false;
      if (!searchToken) return true;

      const searchable = [
        item.obligation_name,
        item.client_name,
        item.acessorias_company_name,
        item.obligation_period,
        item.status,
        item.protocol,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchToken);
    });
  }, [obligations, obligationSearch, obligationStatusFilter]);

  const groupedObligations = useMemo(() => {
    const groups = new Map<string, { name: string; items: AcessoriasObligation[] }>();
    filteredObligations.forEach((item) => {
      const groupName = String(item.obligation_name || "Obrigação sem nome").trim() || "Obrigação sem nome";
      const key = groupName.toLowerCase();
      const current = groups.get(key);
      if (current) {
        current.items.push(item);
        return;
      }
      groups.set(key, { name: groupName, items: [item] });
    });

    return Array.from(groups.values())
      .map((group) => {
        const pending = group.items.filter(
          (item) => normalizeObligationStatusToken(item.status) === "pendente",
        ).length;
        const overdue = group.items.filter(
          (item) => normalizeObligationStatusToken(item.status) === "atrasado",
        ).length;
        const inProgress = group.items.filter(
          (item) => normalizeObligationStatusToken(item.status) === "em_andamento",
        ).length;
        const completed = group.items.filter(
          (item) => normalizeObligationStatusToken(item.status) === "concluído",
        ).length;

        return {
          ...group,
          items: [...group.items].sort((a, b) =>
            String(a.client_name || "").localeCompare(String(b.client_name || ""), "pt-BR"),
          ),
          pending,
          overdue,
          inProgress,
          completed,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filteredObligations]);

  const obligationNamesByClient = useMemo(() => {
    const map = new Map<string, string[]>();
    obligations.forEach((row) => {
      const clientId = row.client_id;
      const obligationName = String(row.obligation_name || "").trim();
      if (!clientId || !obligationName) return;
      const current = map.get(clientId) || [];
      if (!current.some((item) => item.toLowerCase() === obligationName.toLowerCase())) {
        current.push(obligationName);
      }
      map.set(clientId, current);
    });
    map.forEach((values, key) => {
      map.set(key, [...values].sort((left, right) => left.localeCompare(right, "pt-BR")));
    });
    return map;
  }, [obligations]);

  const clientWhatsappById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((client) => {
      const candidate =
        normalizeWhatsappNumber(client.whatsapp_phone_digits) ||
        normalizeWhatsappNumber(client.whatsapp_phone) ||
        normalizeWhatsappNumber(client.phone);
      if (!candidate) return;
      map.set(client.id, candidate);
    });
    return map;
  }, [clients]);

  const preflightSummary = useMemo(() => {
    const selected = preflightRows.filter((row) => row.selectedForSend);
    const blocked = selected.filter((row) => row.blockingErrors.length > 0).length;
    const ready = selected.length - blocked;
    return {
      total: preflightRows.length,
      selected: selected.length,
      blocked,
      ready,
    };
  }, [preflightRows]);

  const groupedUploads = useMemo(() => {
    type ObligationGroup = {
      key: string;
      name: string;
      items: AcessoriasUpload[];
      sent: number;
      error: number;
    };

    type CompanyGroup = {
      key: string;
      name: string;
      obligations: ObligationGroup[];
      total: number;
      sent: number;
      error: number;
    };

    const companyMap = new Map<
      string,
      {
        name: string;
        items: AcessoriasUpload[];
      }
    >();

    for (const item of uploads) {
      const companyName = String(item.company_name || item.client_name || "Empresa nao identificada").trim();
      const safeCompanyName = companyName || "Empresa nao identificada";
      const companyKey = String(item.acessorias_company_id || item.client_id || safeCompanyName);
      const current = companyMap.get(companyKey) || { name: safeCompanyName, items: [] };
      current.items.push(item);
      companyMap.set(companyKey, current);
    }

    const groups: CompanyGroup[] = [];
    for (const [companyKey, companyValue] of companyMap.entries()) {
      const obligationMap = new Map<string, AcessoriasUpload[]>();
      for (const item of companyValue.items) {
        const obligationName = String(item.obligation_name || "Obrigacao nao informada").trim() || "Obrigacao nao informada";
        const obligationKey = `${companyKey}:${obligationName.toLowerCase()}`;
        const currentItems = obligationMap.get(obligationKey) || [];
        currentItems.push(item);
        obligationMap.set(obligationKey, currentItems);
      }

      const obligations: ObligationGroup[] = Array.from(obligationMap.entries())
        .map(([obligationKey, items]) => {
          const first = items[0];
          const sent = items.filter((upload) => String(upload.status || "").toLowerCase() === "sent").length;
          const error = items.filter((upload) => String(upload.status || "").toLowerCase() === "error").length;

          return {
            key: obligationKey,
            name: String(first?.obligation_name || "Obrigacao nao informada"),
            items: [...items].sort((left, right) =>
              String(right.uploaded_at || "").localeCompare(String(left.uploaded_at || "")),
            ),
            sent,
            error,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

      const total = companyValue.items.length;
      const sent = companyValue.items.filter((upload) => String(upload.status || "").toLowerCase() === "sent").length;
      const error = companyValue.items.filter((upload) => String(upload.status || "").toLowerCase() === "error").length;

      groups.push({
        key: companyKey,
        name: companyValue.name,
        obligations,
        total,
        sent,
        error,
      });
    }

    return groups.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [uploads]);

  const invokeAcessorias = async <TData extends Record<string, unknown> = Record<string, unknown>>(
    body: Record<string, unknown>,
  ) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error("Não foi possível validar a sessao atual.");
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Sessao expirada. Entre novamente para acessar o módulo Acessorias.");
    }

    const invokeOnce = async (token: string) =>
      supabase.functions.invoke("acessorias-module", {
        body: {
          ...body,
          access_token: token,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

    let { data, error } = await invokeOnce(accessToken);

    if (error instanceof FunctionsHttpError && error.context.status === 401) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.session?.access_token;
      if (!refreshError && refreshedToken) {
        const retried = await invokeOnce(refreshedToken);
        data = retried.data;
        error = retried.error;
      }
    }

    if (error) {
      if (error instanceof FunctionsHttpError) {
        let parsedMessage: string | null = null;
        try {
          const payload = await error.context.json();
          parsedMessage =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : null;
        } catch {
          // ignore and fallback to generic error below
        }
        if (parsedMessage) {
          throw new Error(parsedMessage);
        }
      }
      throw error;
    }

    const parsed = (data || {}) as Record<string, unknown>;
    if (typeof parsed.error === "string" && parsed.error.length > 0) {
      throw new Error(parsed.error);
    }
    return parsed as TData;
  };

  const loadOverview = async () => {
    const data = await invokeAcessorias<OverviewPayload>({ action: "overview" });
    setHasConfiguration(Boolean(data.has_acessorias_configuration));
    setClients(Array.isArray(data.clients) ? data.clients : []);
    setUploads(Array.isArray(data.uploads) ? data.uploads : []);
    if (data.summary) setSummary(data.summary);
  };

  const loadObligations = async (clientId?: string) => {
    const data = await invokeAcessorias<{ obligations: AcessoriasObligation[] }>({
      action: "list_obligations",
      client_id: clientId || undefined,
    });
    setObligations(Array.isArray(data.obligations) ? data.obligations : []);
  };

  const loadUploads = async (clientId?: string) => {
    const data = await invokeAcessorias<{ uploads: AcessoriasUpload[] }>({
      action: "list_uploads",
      client_id: clientId || undefined,
    });
    setUploads(Array.isArray(data.uploads) ? data.uploads : []);
  };

  const refreshCurrentModuleData = async () => {
    setLoading(true);
    try {
      if (isObrigacoesModule) {
        await Promise.all([loadOverview(), loadObligations()]);
      } else {
        await Promise.all([loadOverview(), loadObligations(), loadUploads()]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar módulo Acessorias");
    } finally {
      setLoading(false);
    }
  };

  const cleanupKanbanObligations = async () => {
    try {
      await invokeAcessorias({
        action: "cleanup_kanban_obligations",
      });
    } catch {
      // noop: limpeza de Kanban e processo auxiliar e não deve bloquear a tela
    }
  };

  useEffect(() => {
    void refreshCurrentModuleData();
    if (isObrigacoesModule) {
      void cleanupKanbanObligations();
    }
  }, [isObrigacoesModule]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSyncCompanies({
    silent = false,
    refreshAfter = true,
  }: {
    silent?: boolean;
    refreshAfter?: boolean;
  } = {}) {
    setSyncingCompanies(true);
    try {
      const result = await invokeAcessorias<{
        synced: number;
        auto_linked: number;
        clients_created: number;
        clients_updated: number;
        clients_inactivated: number;
      }>({
        action: "sync_companies",
        sync_grow_clients: true,
        restrict_to_acessorias: true,
      });
      if (!silent) {
        toast.success(
          `Empresas sincronizadas: ${result.synced || 0}. Clientes criados: ${result.clients_created || 0}. Atualizados: ${result.clients_updated || 0}. Vinculos automaticos: ${result.auto_linked || 0}. Inativados: ${result.clients_inactivated || 0}.`,
        );
      }
      if (refreshAfter) {
        await Promise.all([loadOverview(), loadObligations()]);
      }
      return result;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Erro ao sincronizar empresas");
      }
      throw error;
    } finally {
      setSyncingCompanies(false);
    }
  }

  async function handleSyncObligations({
    silent = false,
    initialBatchSize = 20,
    fallbackBatchSize = 10,
    refreshAfter = true,
  }: {
    silent?: boolean;
    initialBatchSize?: number;
    fallbackBatchSize?: number;
    refreshAfter?: boolean;
  } = {}) {
    setSyncingObligations(true);
    try {
      let batchSize = Math.max(1, initialBatchSize);
      let cursor = 0;
      let hasMore = true;
      let rounds = 0;
      let totalSynced = 0;
      let totalProcessedClients = 0;
      let totalAutoLinkedClients = 0;
      let totalLinks = 0;

      while (hasMore && rounds < 100) {
        let result;
        try {
          result = await invokeAcessorias<{
            synced_obligations: number;
            clients_processed: number;
            auto_linked_clients: number;
            total_links: number;
            processed_in_batch: number;
            has_more: boolean;
            next_cursor: number | null;
          }>({
            action: "sync_obligations",
            batch_size: batchSize,
            max_companies_per_run: batchSize,
            max_execution_ms: 22000,
            cursor,
          });
        } catch (error) {
          const lowerBatchSize = Math.max(fallbackBatchSize, Math.floor(batchSize / 2));
          const fallbackAllowed = batchSize > fallbackBatchSize && lowerBatchSize < batchSize;
          if (fallbackAllowed) {
            batchSize = lowerBatchSize;
            continue;
          }
          throw error;
        }

        totalSynced += Number(result.synced_obligations || 0);
        totalProcessedClients += Number(result.clients_processed || 0);
        totalAutoLinkedClients += Number(result.auto_linked_clients || 0);
        totalLinks = Number(result.total_links || totalLinks);
        rounds += 1;

        const processedInBatch = Number(result.processed_in_batch || 0);
        const nextCursor = typeof result.next_cursor === "number" ? result.next_cursor : null;
        hasMore = Boolean(result.has_more) && nextCursor !== null;
        if (!hasMore) break;
        if (processedInBatch <= 0) {
          break;
        }
        cursor = nextCursor as number;
      }

      if (!silent) {
        toast.success(
          `Obrigações sincronizadas: ${totalSynced}. Clientes processados: ${totalProcessedClients}/${totalLinks || totalProcessedClients}.`,
        );
        if (totalAutoLinkedClients > 0) {
          toast.success(`Clientes vinculados automaticamente por CNPJ: ${totalAutoLinkedClients}.`);
        }
      }

      if (refreshAfter) {
        await Promise.all([loadOverview(), loadObligations()]);
      }
      return {
        totalSynced,
        totalProcessedClients,
        totalAutoLinkedClients,
        totalLinks,
      };
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Erro ao sincronizar obrigações");
      }
      throw error;
    } finally {
      setSyncingObligations(false);
    }
  }

  const handleManualSync = async () => {
    if (!isObrigacoesModule) return;

    try {
      const shouldSyncCompaniesFirst = summary.clients_linked <= 0 || summary.companies_cached <= 0;
      if (shouldSyncCompaniesFirst) {
        try {
          await handleSyncCompanies({ silent: true, refreshAfter: false });
        } catch (companiesError) {
          toast.error(
            companiesError instanceof Error
              ? `Sincronização de empresas parcial: ${companiesError.message}`
              : "Sincronização de empresas parcial. Prosseguindo com obrigações.",
          );
        }
      }
      await handleSyncObligations({
        silent: true,
        initialBatchSize: 25,
        fallbackBatchSize: 8,
        refreshAfter: false,
      });
      await Promise.all([loadOverview(), loadObligations()]);
      toast.success("Sincronização concluída. Dados atualizados a partir do Acessorias.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao sincronizar dados com o Acessorias",
      );
    }
  };

  const handleAssignObligation = async () => {
    if (!newObligation.client_id || !newObligation.obligation_name.trim()) {
      toast.error("Selecione o cliente e informe o nome da obrigação.");
      return;
    }

    setAssigningObligation(true);
    try {
      await invokeAcessorias({
        action: "assign_obligation",
        client_id: newObligation.client_id,
        obligation_name: newObligation.obligation_name.trim(),
        obligation_period: newObligation.obligation_period || null,
        due_date: newObligation.due_date || null,
        status: newObligation.status,
        notes: newObligation.notes || null,
      });
      toast.success("Obrigação cadastrada para o cliente.");
      setNewObligation({
        client_id: newObligation.client_id,
        obligation_name: "",
        obligation_period: "",
        due_date: "",
        status: "pendente",
        notes: "",
      });
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar obrigação");
    } finally {
      setAssigningObligation(false);
    }
  };

  const handleOpenEditObligation = (obligation: AcessoriasObligation) => {
    setEditingObligation(obligation);
    setEditObligationForm({
      obligation_name: obligation.obligation_name || "",
      obligation_period: obligation.obligation_period || "",
      due_date: obligation.due_date || "",
      status: normalizeObligationStatusToken(obligation.status),
      protocol: obligation.protocol || "",
      notes: obligation.notes || "",
    });
  };

  const handleUpdateObligation = async () => {
    if (!editingObligation) return;
    const obligationName = editObligationForm.obligation_name.trim();
    if (!obligationName) {
      toast.error("Informe o nome da obrigação.");
      return;
    }

    setSavingObligation(true);
    try {
      const result = await invokeAcessorias<{
        obligation?: AcessoriasObligation;
        remote_sync?: {
          attempted?: boolean;
          ok?: boolean;
          message?: string;
        };
      }>({
        action: "update_obligation",
        obligation_id: editingObligation.id,
        obligation_name: obligationName,
        obligation_period: editObligationForm.obligation_period.trim() || null,
        due_date: editObligationForm.due_date || null,
        status: editObligationForm.status || null,
        protocol: editObligationForm.protocol.trim() || null,
        notes: editObligationForm.notes.trim() || null,
        sync_remote: true,
      });

      const remoteSync = result.remote_sync;
      if (remoteSync?.attempted && remoteSync.ok) {
        toast.success(remoteSync.message || "Obrigação atualizada no Grow e no Acessorias.");
      } else if (remoteSync?.attempted && !remoteSync.ok) {
        toast.success("Obrigação atualizada no Grow. Sincronização remota em processamento.");
        toast.error(remoteSync.message || "Não foi possível confirmar atualizacao no Acessorias.");
      } else {
        toast.success("Obrigação atualizada no Grow.");
      }

      setEditingObligation(null);
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar obrigação");
    } finally {
      setSavingObligation(false);
    }
  };

  const normalizePreflightRow = (row: EcontinuoPreflightRowState): EcontinuoPreflightRowState => {
    const normalizedCompetence = normalizePreflightCompetence(row.competence || "");
    const normalizedWhatsapp = normalizeWhatsappNumber(row.whatsappNumber || "");
    const blockingErrors = getPreflightBlockingErrors({
      clientId: row.clientId,
      competence: normalizedCompetence || row.competence || "",
      obligationName: row.obligationName,
    });

    return {
      ...row,
      competence: normalizedCompetence || row.competence || "",
      whatsappNumber: normalizedWhatsapp || row.whatsappNumber || "",
      blockingErrors,
      selectedForSend: blockingErrors.length > 0 ? false : row.selectedForSend,
    };
  };

  const getWhatsappMessageForRow = (row: EcontinuoPreflightRowState) => {
    const client = clients.find((item) => item.id === row.clientId);
    const clientName = client?.name || "cliente";
    const contactName = client?.contact || clientName;
    const obligationName = row.obligationName?.trim() || "documento";
    const competence = normalizePreflightCompetence(row.competence || "") || row.competence || "nao informada";
    const description = row.description?.trim();
    const sentStatusMessage =
      row.sendStatus === "sent"
        ? "O arquivo ja foi enviado no e-Continuo pela equipe da Grow."
        : "O arquivo esta em conferencia para envio no e-Continuo pela equipe da Grow.";

    return [
      `Ola, ${contactName}!`,
      sentStatusMessage,
      `Cliente: ${clientName}`,
      `Arquivo: ${row.fileName}`,
      `Obrigacao: ${obligationName}`,
      `Competencia: ${competence}`,
      description ? `Descricao: ${description}` : null,
      "",
      "Em caso de duvidas, responda por aqui.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleOpenWhatsappForRow = (rowId: string) => {
    const row = preflightRows.find((item) => item.id === rowId);
    if (!row) return;
    if (!row.clientId) {
      toast.error("Selecione o cliente para abrir o WhatsApp.");
      return;
    }

    const whatsappNumber = normalizeWhatsappNumber(row.whatsappNumber);
    if (!whatsappNumber) {
      toast.error("Numero de WhatsApp nao encontrado para este cliente.");
      return;
    }

    const message = getWhatsappMessageForRow(row);
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    updatePreflightRow(row.id, (current) => ({
      ...current,
      sendMessage: `WhatsApp aberto para ${formatWhatsappDisplay(whatsappNumber)}.`,
    }));
  };

  const updatePreflightRow = (
    rowId: string,
    updater: (row: EcontinuoPreflightRowState) => EcontinuoPreflightRowState,
  ) => {
    setPreflightRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = updater(row);
        return normalizePreflightRow(nextRow);
      }),
    );
  };

  const handleOpenPreflight = async (files: File[]) => {
    if (files.length === 0) return;

    setPreflightParsing(true);
    try {
      const result = await parseEcontinuoFiles({
        files,
        clients: clients.map((client) => ({
          id: client.id,
          name: client.name,
          cnpj: client.cnpj,
        })),
        obligations: obligations.map((row) => ({
          client_id: row.client_id,
          obligation_name: row.obligation_name,
          obligation_period: row.obligation_period,
        })),
      });

      setPreflightWarnings(result.warnings);
      if (result.warnings.length > 0) {
        result.warnings.slice(0, 3).forEach((warning) => toast.warning(warning));
      }

      setPreflightRows(
        result.rows.map((row) => ({
          ...row,
          sendStatus: "idle",
          sendMessage: null,
          whatsappNumber: row.clientId ? clientWhatsappById.get(row.clientId) || "" : "",
        })),
      );
      setPreflightOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível analisar os arquivos.");
    } finally {
      setPreflightParsing(false);
      if (econtinuoFileInputRef.current) {
        econtinuoFileInputRef.current.value = "";
      }
    }
  };

  const handlePreflightFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    void handleOpenPreflight(files);
  };

  const handleDropzoneDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dropzoneActive) setDropzoneActive(true);
  };

  const handleDropzoneDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropzoneActive(false);
  };

  const handleDropzoneDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropzoneActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    void handleOpenPreflight(files);
  };

  const handleToggleAllPreflightRows = (checked: boolean) => {
    setPreflightRows((current) =>
      current.map((row) => {
        const next = normalizePreflightRow(row);
        if (next.blockingErrors.length > 0) return next;
        return { ...next, selectedForSend: checked };
      }),
    );
  };

  const handleSendSelectedPreflightRows = async () => {
    const selectedRows = preflightRows.filter((row) => row.selectedForSend);
    if (selectedRows.length === 0) {
      toast.error("Selecione ao menos um arquivo pronto para envio.");
      return;
    }

    setSendingPreflight(true);
    let sentCount = 0;
    let failedCount = 0;
    let blockedCount = 0;

    for (const row of selectedRows) {
      const blockingErrors = getPreflightBlockingErrors({
        clientId: row.clientId,
        competence: row.competence,
        obligationName: row.obligationName,
      });

      if (blockingErrors.length > 0) {
        blockedCount += 1;
        updatePreflightRow(row.id, (current) => ({
          ...current,
          blockingErrors,
          sendStatus: "error",
          sendMessage: blockingErrors.join(" "),
        }));
        continue;
      }

      updatePreflightRow(row.id, (current) => ({
        ...current,
        sendStatus: "sending",
        sendMessage: "Enviando para o e-Continuo...",
      }));

      try {
        const base64 = await readFileAsDataUrl(row.file);
        await invokeAcessorias({
          action: "send_econtinuo",
          client_id: row.clientId,
          file_name: row.fileName,
          content_type: row.file.type || "application/octet-stream",
          file_content_base64: base64,
          metadata: {
            competência: row.competence || null,
            obrigação: row.obligationName || null,
            descrição: row.description || null,
            whatsapp: normalizeWhatsappNumber(row.whatsappNumber) || null,
            pre_conferencia: {
              confidence: row.confidence,
              warnings: row.warnings,
              evidence: row.evidence as ExtractionEvidence[],
              reviewed_at: new Date().toISOString(),
            },
          },
        });

        sentCount += 1;
        updatePreflightRow(row.id, (current) => ({
          ...current,
          sendStatus: "sent",
          sendMessage: "Arquivo enviado com sucesso.",
        }));
      } catch (error) {
        failedCount += 1;
        updatePreflightRow(row.id, (current) => ({
          ...current,
          sendStatus: "error",
          sendMessage: error instanceof Error ? error.message : "Falha no envio deste arquivo.",
        }));
      }
    }

    setSendingPreflight(false);
    await Promise.all([loadOverview(), loadUploads()]);

    if (sentCount > 0) {
      setPreflightRows((current) =>
        current
          .filter((row) => row.sendStatus !== "sent")
          .map((row) => normalizePreflightRow(row)),
      );
    }

    if (sentCount > 0 && failedCount === 0 && blockedCount === 0) {
      toast.success(`Envio concluído: ${sentCount} arquivo(s) enviado(s).`);
      setPreflightOpen(false);
      setPreflightWarnings([]);
      return;
    }

    toast.info(
      `Resultado do envio: ${sentCount} enviado(s), ${failedCount} falha(s), ${blockedCount} bloqueado(s).`,
    );
  };

  const metrics = [
    {
      label: "Clientes vinculados",
      value: `${summary.clients_linked}/${summary.clients_total}`,
      icon: Link2,
    },
    {
      label: "Empresas no cache",
      value: String(summary.companies_cached),
      icon: Building2,
    },
    {
      label: "Obrigações pendentes",
      value: String(summary.obligations_pending),
      icon: CalendarClock,
    },
    {
      label: "Obrigações atrasadas",
      value: String(summary.obligations_overdue),
      icon: AlertTriangle,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">
              {isObrigacoesModule ? "Módulo Obrigações" : "Módulo E-continuo"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isObrigacoesModule
                ? "Controle das obrigações acessorias com sincronização e acompanhamento por cliente."
                : "Envio de arquivos para o e-Continuo com histórico operacional por cliente."}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground min-h-10 inline-flex items-center gap-2">
              {syncingCompanies || syncingObligations ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
              <span>
                {isObrigacoesModule
                  ? syncingCompanies || syncingObligations
                    ? "Sincronização manual em andamento..."
                    : "Dados carregados do cache. Atualize somente no botao Sincronizar."
                  : "Dados carregados automaticamente ao abrir o módulo."}
              </span>
            </div>
            {isObrigacoesModule && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleManualSync()}
                disabled={syncingCompanies || syncingObligations || !hasConfiguration}
              >
                {syncingCompanies || syncingObligations ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-2" />
                )}
                Sincronizar agora
              </Button>
            )}
          </div>
        </div>

        {!hasConfiguration && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Defina o secret <code>ACESSORIAS_API_TOKEN</code> no Supabase para habilitar sincronização e envio.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <motion.div key={metric.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-semibold">{metric.value}</p>
                  </div>
                  <metric.icon className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {loading ? (
          <div className="h-60 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue={isObrigacoesModule ? "obrigações" : "econtinuo"} className="space-y-4">

            {isObrigacoesModule && (
              <TabsContent value="obrigações" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cadastro de obrigações por cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select
                        value={newObligation.client_id || undefined}
                        onValueChange={(value) => setNewObligation((current) => ({ ...current, client_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da obrigação</Label>
                      <Input
                        placeholder="Ex.: DCTFWeb Mensal"
                        value={newObligation.obligation_name}
                        onChange={(event) =>
                          setNewObligation((current) => ({ ...current, obligation_name: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Competência</Label>
                      <Input
                        placeholder="AAAA-MM"
                        value={newObligation.obligation_period}
                        onChange={(event) =>
                          setNewObligation((current) => ({ ...current, obligation_period: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vencimento</Label>
                      <Input
                        type="date"
                        value={newObligation.due_date}
                        onChange={(event) =>
                          setNewObligation((current) => ({ ...current, due_date: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={newObligation.status}
                        onValueChange={(value) => setNewObligation((current) => ({ ...current, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="atrasado">Atrasado</SelectItem>
                          <SelectItem value="concluído">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observacoes</Label>
                    <Input
                      placeholder="Detalhes adicionais da obrigação"
                      value={newObligation.notes}
                      onChange={(event) =>
                        setNewObligation((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => void handleAssignObligation()} disabled={assigningObligation}>
                      {assigningObligation ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Cadastrar obrigação
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Obrigações organizadas por tipo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                    <Input
                      placeholder="Buscar por obrigação, empresa, cliente ou protocolo..."
                      value={obligationSearch}
                      onChange={(event) => setObligationSearch(event.target.value)}
                    />
                    <Select value={obligationStatusFilter} onValueChange={setObligationStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pendente">Pendentes</SelectItem>
                        <SelectItem value="em_andamento">Em andamento</SelectItem>
                        <SelectItem value="atrasado">Atrasados</SelectItem>
                        <SelectItem value="concluído">Concluidos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {groupedObligations.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                      Nenhuma obrigação encontrada para o filtro aplicado.
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full rounded-lg border px-3">
                      {groupedObligations.map((group) => (
                        <AccordionItem key={group.name} value={group.name}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex flex-col items-start gap-2 text-left md:flex-row md:items-center md:gap-3">
                              <span className="text-sm font-semibold">{group.name}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Empresas: {group.items.length}</Badge>
                                <Badge variant="secondary">Pendentes: {group.pending}</Badge>
                                {group.inProgress > 0 && <Badge variant="secondary">Andamento: {group.inProgress}</Badge>}
                                {group.overdue > 0 && <Badge variant="destructive">Atrasadas: {group.overdue}</Badge>}
                                {group.completed > 0 && <Badge variant="default">Concluídas: {group.completed}</Badge>}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="rounded-lg border overflow-x-auto">
                              <table className="w-full min-w-[960px]">
                                <thead>
                                  <tr className="bg-muted/40 border-b text-xs text-muted-foreground">
                                    <th className="text-left p-3">Empresa</th>
                                    <th className="text-left p-3">Cliente Grow</th>
                                    <th className="text-left p-3">Competência</th>
                                    <th className="text-left p-3">Vencimento</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Ult. sincronização</th>
                                    <th className="text-left p-3">Acao</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {group.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="p-3 align-top text-sm">{item.acessorias_company_name || "-"}</td>
                                      <td className="p-3 align-top">
                                        <div className="text-sm font-medium">{item.client_name || "-"}</div>
                                        {item.protocol && (
                                          <div className="text-xs text-muted-foreground">Protocolo: {item.protocol}</div>
                                        )}
                                      </td>
                                      <td className="p-3 align-top text-sm">{item.obligation_period || "-"}</td>
                                      <td className="p-3 align-top text-sm">{formatDate(item.due_date)}</td>
                                      <td className="p-3 align-top">
                                        <Badge variant={obligationStatusVariant(item.status)}>{item.status || "pendente"}</Badge>
                                      </td>
                                      <td className="p-3 align-top text-sm text-muted-foreground">
                                        {formatDateTime(item.last_synced_at)}
                                      </td>
                                      <td className="p-3 align-top">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEditObligation(item)}>
                                          <Pencil className="h-3.5 w-3.5 mr-1" />
                                          Editar
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
              </TabsContent>
            )}

            {!isObrigacoesModule && (
              <TabsContent value="econtinuo" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Envio rapido com pré-conferência</CardTitle>
                    <CardDescription>
                      Arraste e solte um ou mais arquivos para leitura automatica. Antes do envio, revise cliente, competência e obrigação.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      ref={econtinuoFileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                      onChange={handlePreflightFileSelection}
                    />

                    <div
                      onDragOver={handleDropzoneDragOver}
                      onDragLeave={handleDropzoneDragLeave}
                      onDrop={handleDropzoneDrop}
                      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                        dropzoneActive ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <Upload className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium">Arraste arquivos aqui para enviar ao e-Continuo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Formatos priorizados: PDF, imagens e planilhas (XLS/XLSX/CSV).
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => econtinuoFileInputRef.current?.click()}
                          disabled={preflightParsing}
                        >
                          {preflightParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          {preflightParsing ? "Lendo arquivos..." : "Selecionar arquivos"}
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          disabled={preflightRows.length === 0}
                          onClick={() => setPreflightOpen(true)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Abrir pré-conferência
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                      <p>Arquivos na fila: <strong>{preflightSummary.total}</strong></p>
                      <p>Selecionados para envio: <strong>{preflightSummary.selected}</strong></p>
                      <p>Prontos para envio: <strong>{preflightSummary.ready}</strong></p>
                      <p>Bloqueados por falta de dados: <strong>{preflightSummary.blocked}</strong></p>
                    </div>
                  </CardContent>
                </Card>

                <Dialog open={preflightOpen} onOpenChange={setPreflightOpen}>
                  <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Pré-conferência de arquivos para e-Continuo</DialogTitle>
                      <DialogDescription>
                        Revise rapidamente os dados antes de enviar. Linhas incompletas ficam bloqueadas ate ajuste manual.
                      </DialogDescription>
                    </DialogHeader>

                    {preflightWarnings.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {preflightWarnings.slice(0, 5).map((warning, index) => (
                          <p key={`${warning}-${index}`}>{warning}</p>
                        ))}
                      </div>
                    )}

                    {preflightRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Nenhum arquivo na pré-conferência. Use a area de envio para adicionar arquivos.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {preflightSummary.selected} selecionado(s) | {preflightSummary.ready} pronto(s) | {preflightSummary.blocked} bloqueado(s)
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAllPreflightRows(true)}
                            >
                              Selecionar prontos
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAllPreflightRows(false)}
                            >
                              Limpar seleção
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {preflightRows.map((row) => {
                            const obligationOptions = row.clientId ? obligationNamesByClient.get(row.clientId) || [] : [];
                            return (
                              <div key={row.id} className="rounded-lg border p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                                    <input
                                      type="checkbox"
                                      checked={row.selectedForSend}
                                      disabled={row.blockingErrors.length > 0}
                                      onChange={(event) =>
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          selectedForSend: event.target.checked,
                                        }))
                                      }
                                    />
                                    {row.fileName}
                                  </label>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <Badge variant="outline">Confianca: {row.confidence}%</Badge>
                                      {row.sendStatus === "sending" && <Badge variant="secondary">Enviando...</Badge>}
                                      {row.sendStatus === "sent" && <Badge variant="default">Enviado</Badge>}
                                      {row.sendStatus === "error" && <Badge variant="destructive">Erro</Badge>}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenWhatsappForRow(row.id)}
                                      disabled={!row.clientId || !normalizeWhatsappNumber(row.whatsappNumber)}
                                    >
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      WhatsApp
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid gap-3 xl:grid-cols-5">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Cliente</Label>
                                    <Select
                                      value={row.clientId || "__none__"}
                                      onValueChange={(value) => {
                                        const nextClientId = value === "__none__" ? "" : value;
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          clientId: nextClientId,
                                          obligationName: nextClientId ? current.obligationName : "",
                                          whatsappNumber: nextClientId
                                            ? clientWhatsappById.get(nextClientId) || current.whatsappNumber || ""
                                            : "",
                                        }));
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Não identificado</SelectItem>
                                        {clients.map((client) => (
                                          <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">Competência</Label>
                                    <Input
                                      placeholder="AAAA-MM"
                                      value={row.competence}
                                      onChange={(event) =>
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          competence: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">Obrigação</Label>
                                    <Input
                                      placeholder="Obrigação do cliente"
                                      value={row.obligationName}
                                      onChange={(event) =>
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          obligationName: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">Descrição</Label>
                                    <Input
                                      placeholder="Descrição do envio"
                                      value={row.description}
                                      onChange={(event) =>
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          description: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs">WhatsApp</Label>
                                    <Input
                                      placeholder="+55 (00) 00000-0000"
                                      value={row.whatsappNumber}
                                      onChange={(event) =>
                                        updatePreflightRow(row.id, (current) => ({
                                          ...current,
                                          whatsappNumber: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>

                                {obligationOptions.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {obligationOptions.slice(0, 8).map((option) => (
                                      <button
                                        key={`${row.id}-${option}`}
                                        type="button"
                                        className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
                                        onClick={() =>
                                          updatePreflightRow(row.id, (current) => ({
                                            ...current,
                                            obligationName: option,
                                          }))
                                        }
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {row.blockingErrors.length > 0 && (
                                  <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                                    {row.blockingErrors.join(" ")}
                                  </div>
                                )}

                                {row.warnings.length > 0 && (
                                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                                    {row.warnings.join(" ")}
                                  </div>
                                )}

                                {row.sendMessage && (
                                  <div className="text-xs text-muted-foreground">
                                    {row.sendMessage}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPreflightOpen(false)}>
                        Fechar
                      </Button>
                      <Button
                        onClick={() => void handleSendSelectedPreflightRows()}
                        disabled={sendingPreflight || preflightSummary.selected === 0}
                      >
                        {sendingPreflight ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Enviar selecionados
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Histórico de envios</CardTitle>
                  <CardDescription>Separado por empresa e obrigação para facilitar a conferência.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedUploads.length === 0 && (
                    <div className="text-sm text-muted-foreground">Nenhum envio registrado.</div>
                  )}
                  {groupedUploads.length > 0 && (
                    <Accordion type="multiple" className="w-full rounded-lg border px-3">
                      {groupedUploads.map((company) => (
                        <AccordionItem key={company.key} value={company.key}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex flex-col items-start gap-2 text-left md:flex-row md:items-center md:gap-3">
                              <span className="text-sm font-semibold">{company.name}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Obrigacoes: {company.obligations.length}</Badge>
                                <Badge variant="secondary">Envios: {company.total}</Badge>
                                <Badge variant="default">Enviados: {company.sent}</Badge>
                                {company.error > 0 && <Badge variant="destructive">Falhas: {company.error}</Badge>}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-2 pb-3">
                            <Accordion type="multiple" className="w-full rounded-lg border px-3">
                              {company.obligations.map((obligation) => (
                                <AccordionItem key={obligation.key} value={obligation.key}>
                                  <AccordionTrigger className="py-2 hover:no-underline">
                                    <div className="flex flex-col items-start gap-2 text-left md:flex-row md:items-center md:gap-3">
                                      <span className="text-sm font-medium">{obligation.name}</span>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">Arquivos: {obligation.items.length}</Badge>
                                        <Badge variant="default">Enviados: {obligation.sent}</Badge>
                                        {obligation.error > 0 && <Badge variant="destructive">Falhas: {obligation.error}</Badge>}
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-2 pb-2">
                                      {obligation.items.map((item) => (
                                        <div key={item.id} className="rounded-lg border p-3">
                                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div className="space-y-1">
                                              <div className="font-medium text-sm flex items-center gap-2">
                                                <Upload className="h-4 w-4 text-primary" />
                                                {item.file_name}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                Enviado em {formatDateTime(item.uploaded_at)}
                                              </div>
                                              {item.competence && (
                                                <div className="text-xs text-muted-foreground">
                                                  Competencia: {item.competence}
                                                </div>
                                              )}
                                            </div>
                                            <Badge className={uploadStatusBadgeClass(item.status)}>
                                              {item.status}
                                            </Badge>
                                          </div>
                                          {item.error_message && (
                                            <>
                                              <Separator className="my-2" />
                                              <div className="text-xs text-red-700">{item.error_message}</div>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Vinculos automaticos por CNPJ ativos.
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
              Obrigações usam cache salvo e atualizam somente ao clicar em Sincronizar agora.
            </span>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3.5 w-3.5 text-primary" />
              Envio e-Continuo com log para rastreabilidade operacional.
            </span>
            <span className="inline-flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              Integracao de obrigações com Kanban desativada temporariamente.
            </span>
          </CardContent>
        </Card>

        <Dialog open={Boolean(editingObligation)} onOpenChange={(open) => !open && setEditingObligation(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar obrigação</DialogTitle>
              <DialogDescription>
                Atualize os dados da obrigação para esta empresa. A alteracao e salva no Grow e enviada ao Acessorias.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Obrigação</Label>
                <Input
                  value={editObligationForm.obligation_name}
                  onChange={(event) =>
                    setEditObligationForm((current) => ({ ...current, obligation_name: event.target.value }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Competência</Label>
                  <Input
                    placeholder="AAAA-MM"
                    value={editObligationForm.obligation_period}
                    onChange={(event) =>
                      setEditObligationForm((current) => ({ ...current, obligation_period: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={editObligationForm.due_date}
                    onChange={(event) =>
                      setEditObligationForm((current) => ({ ...current, due_date: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editObligationForm.status}
                    onValueChange={(value) =>
                      setEditObligationForm((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                      <SelectItem value="concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Input
                  value={editObligationForm.protocol}
                  onChange={(event) =>
                    setEditObligationForm((current) => ({ ...current, protocol: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Observacoes</Label>
                <Textarea
                  rows={4}
                  value={editObligationForm.notes}
                  onChange={(event) =>
                    setEditObligationForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingObligation(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleUpdateObligation()} disabled={savingObligation}>
                {savingObligation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar alteracoes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default AcessoriasPage;
