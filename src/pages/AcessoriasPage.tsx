
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  client_id: string;
  file_name: string;
  status: string;
  error_message: string | null;
  uploaded_at: string;
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
  if (token === "concluido" || token === "completed" || token === "sent") return "default";
  if (token === "atrasado" || token === "overdue") return "destructive";
  if (token === "em_andamento" || token === "processing") return "secondary";
  return "outline";
};

const normalizeObligationStatusToken = (status: string | null) => {
  const token = String(status || "").trim().toLowerCase();
  if (!token) return "pendente";
  if (["concluido", "completed", "delivered", "sent", "entregue"].includes(token)) return "concluido";
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
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo"));
    reader.readAsDataURL(file);
  });

interface AcessoriasPageProps {
  module?: "obrigacoes" | "econtinuo";
}

export function AcessoriasPage({ module = "obrigacoes" }: AcessoriasPageProps) {
  const [loading, setLoading] = useState(true);
  const [syncingCompanies, setSyncingCompanies] = useState(false);
  const [syncingObligations, setSyncingObligations] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const syncCreateTasks = true;
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
    create_task: true,
  });

  const [uploadForm, setUploadForm] = useState({
    client_id: "",
    competence: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const isObrigacoesModule = module === "obrigacoes";

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
      const groupName = String(item.obligation_name || "Obrigacao sem nome").trim() || "Obrigacao sem nome";
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
          (item) => normalizeObligationStatusToken(item.status) === "concluido",
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

  const invokeAcessorias = async <TData extends Record<string, unknown> = Record<string, unknown>>(
    body: Record<string, unknown>,
  ) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error("Nao foi possivel validar a sessao atual.");
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Sessao expirada. Entre novamente para acessar o modulo Acessorias.");
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
        await Promise.all([loadOverview(), loadUploads()]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar modulo Acessorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCurrentModuleData();
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
      let totalCreatedTasks = 0;
      let totalAutoLinkedClients = 0;
      let totalLinks = 0;

      while (hasMore && rounds < 100) {
        let result;
        try {
          result = await invokeAcessorias<{
            synced_obligations: number;
            clients_processed: number;
            created_tasks: number;
            auto_linked_clients: number;
            total_links: number;
            processed_in_batch: number;
            has_more: boolean;
            next_cursor: number | null;
          }>({
            action: "sync_obligations",
            create_tasks: syncCreateTasks,
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
        totalCreatedTasks += Number(result.created_tasks || 0);
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
          `Obrigacoes sincronizadas: ${totalSynced}. Clientes processados: ${totalProcessedClients}/${totalLinks || totalProcessedClients}.`,
        );
        if (totalAutoLinkedClients > 0) {
          toast.success(`Clientes vinculados automaticamente por CNPJ: ${totalAutoLinkedClients}.`);
        }
        if (totalCreatedTasks > 0) {
          toast.success(`Tarefas de fluxo criadas no Kanban: ${totalCreatedTasks}.`);
        }
      }

      if (refreshAfter) {
        await Promise.all([loadOverview(), loadObligations()]);
      }
      return {
        totalSynced,
        totalProcessedClients,
        totalCreatedTasks,
        totalAutoLinkedClients,
        totalLinks,
      };
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Erro ao sincronizar obrigacoes");
      }
      throw error;
    } finally {
      setSyncingObligations(false);
    }
  }

  const handleManualSync = async () => {
    if (!isObrigacoesModule) return;

    try {
      try {
        await handleSyncCompanies({ silent: true, refreshAfter: false });
      } catch (companiesError) {
        toast.error(
          companiesError instanceof Error
            ? `Sincronizacao de empresas parcial: ${companiesError.message}`
            : "Sincronizacao de empresas parcial. Prosseguindo com obrigacoes.",
        );
      }
      await handleSyncObligations({
        silent: true,
        initialBatchSize: 25,
        fallbackBatchSize: 8,
        refreshAfter: false,
      });
      await Promise.all([loadOverview(), loadObligations()]);
      toast.success("Sincronizacao concluida. Dados atualizados a partir do Acessorias.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao sincronizar dados com o Acessorias",
      );
    }
  };

  const handleAssignObligation = async () => {
    if (!newObligation.client_id || !newObligation.obligation_name.trim()) {
      toast.error("Selecione o cliente e informe o nome da obrigacao.");
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
        create_task: newObligation.create_task,
      });
      toast.success("Obrigacao cadastrada para o cliente.");
      setNewObligation({
        client_id: newObligation.client_id,
        obligation_name: "",
        obligation_period: "",
        due_date: "",
        status: "pendente",
        notes: "",
        create_task: true,
      });
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar obrigacao");
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
      toast.error("Informe o nome da obrigacao.");
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
        toast.success(remoteSync.message || "Obrigacao atualizada no Grow e no Acessorias.");
      } else if (remoteSync?.attempted && !remoteSync.ok) {
        toast.success("Obrigacao atualizada no Grow. Sincronizacao remota em processamento.");
        toast.error(remoteSync.message || "Nao foi possivel confirmar atualizacao no Acessorias.");
      } else {
        toast.success("Obrigacao atualizada no Grow.");
      }

      setEditingObligation(null);
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar obrigacao");
    } finally {
      setSavingObligation(false);
    }
  };

  const handleSendUpload = async () => {
    if (!uploadForm.client_id) {
      toast.error("Selecione o cliente para envio.");
      return;
    }
    if (!selectedFile) {
      toast.error("Selecione o arquivo para envio.");
      return;
    }

    setUploading(true);
    try {
      const base64 = await readFileAsDataUrl(selectedFile);
      await invokeAcessorias({
        action: "send_econtinuo",
        client_id: uploadForm.client_id,
        file_name: selectedFile.name,
        content_type: selectedFile.type || "application/octet-stream",
        file_content_base64: base64,
        metadata: {
          competencia: uploadForm.competence || null,
          descricao: uploadForm.description || null,
        },
      });

      toast.success("Arquivo enviado para o e-Continuo. Obrigacoes serao atualizadas na proxima sincronizacao manual.");
      setSelectedFile(null);
      setUploadForm((current) => ({ ...current, competence: "", description: "" }));
      await Promise.all([loadOverview(), loadObligations(uploadForm.client_id), loadUploads(uploadForm.client_id)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
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
      label: "Obrigacoes pendentes",
      value: String(summary.obligations_pending),
      icon: CalendarClock,
    },
    {
      label: "Obrigacoes atrasadas",
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
              {isObrigacoesModule ? "Modulo Obrigacoes" : "Modulo E-continuo"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isObrigacoesModule
                ? "Controle das obrigacoes acessorias com sincronizacao e acompanhamento por cliente."
                : "Envio de arquivos para o e-Continuo com historico operacional por cliente."}
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
                    ? "Sincronizacao manual em andamento..."
                    : "Dados carregados do cache. Atualize somente no botao Sincronizar."
                  : "Dados carregados automaticamente ao abrir o modulo."}
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
            Defina o secret <code>ACESSORIAS_API_TOKEN</code> no Supabase para habilitar sincronizacao e envio.
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
          <Tabs defaultValue={isObrigacoesModule ? "obrigacoes" : "econtinuo"} className="space-y-4">

            {isObrigacoesModule && (
              <TabsContent value="obrigacoes" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cadastro de obrigacoes por cliente</CardTitle>
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
                      <Label>Nome da obrigacao</Label>
                      <Input
                        placeholder="Ex.: DCTFWeb Mensal"
                        value={newObligation.obligation_name}
                        onChange={(event) =>
                          setNewObligation((current) => ({ ...current, obligation_name: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Competencia</Label>
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
                          <SelectItem value="concluido">Concluido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fluxo</Label>
                      <div className="h-10 px-3 border rounded-md flex items-center gap-2">
                        <Checkbox
                          id="create-task-obligation"
                          checked={newObligation.create_task}
                          onCheckedChange={(value) =>
                            setNewObligation((current) => ({ ...current, create_task: Boolean(value) }))
                          }
                        />
                        <Label htmlFor="create-task-obligation" className="text-sm">
                          Criar tarefa no Kanban
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observacoes</Label>
                    <Input
                      placeholder="Detalhes adicionais da obrigacao"
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
                      Cadastrar obrigacao
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Obrigacoes organizadas por tipo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                    <Input
                      placeholder="Buscar por obrigacao, empresa, cliente ou protocolo..."
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
                        <SelectItem value="concluido">Concluidos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {groupedObligations.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                      Nenhuma obrigacao encontrada para o filtro aplicado.
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
                                {group.completed > 0 && <Badge variant="default">Concluidas: {group.completed}</Badge>}
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
                                    <th className="text-left p-3">Competencia</th>
                                    <th className="text-left p-3">Vencimento</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Ult. sincronizacao</th>
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
                  <CardTitle className="text-base">Upload e envio para e-Continuo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cliente vinculado</Label>
                      <Select
                        value={uploadForm.client_id || undefined}
                        onValueChange={(value) => setUploadForm((current) => ({ ...current, client_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients
                            .filter((client) => client.linked)
                            .map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo</Label>
                      <Input
                        type="file"
                        onChange={(event) =>
                          setSelectedFile(event.target.files && event.target.files.length > 0 ? event.target.files[0] : null)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Competencia</Label>
                      <Input
                        placeholder="AAAA-MM"
                        value={uploadForm.competence}
                        onChange={(event) =>
                          setUploadForm((current) => ({ ...current, competence: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descricao</Label>
                      <Input
                        placeholder="Ex.: Envio folha mensal"
                        value={uploadForm.description}
                        onChange={(event) =>
                          setUploadForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      {selectedFile ? `Arquivo selecionado: ${selectedFile.name}` : "Nenhum arquivo selecionado"}
                    </div>
                    <Button onClick={() => void handleSendUpload()} disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar e Atualizar Status
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Historico de envios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {uploads.map((item) => (
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
                  {uploads.length === 0 && (
                    <div className="text-sm text-muted-foreground">Nenhum envio registrado.</div>
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
              Vinculos realizados automaticamente por CNPJ.
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
              Obrigacoes usam cache salvo e atualizam somente ao clicar em Sincronizar agora.
            </span>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3.5 w-3.5 text-primary" />
              Envio e-Continuo com log para rastreabilidade operacional.
            </span>
            <span className="inline-flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              Alteracoes manuais criam solicitacao no Acessorias para manter o fluxo alinhado.
            </span>
          </CardContent>
        </Card>

        <Dialog open={Boolean(editingObligation)} onOpenChange={(open) => !open && setEditingObligation(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar obrigacao</DialogTitle>
              <DialogDescription>
                Atualize os dados da obrigacao para esta empresa. A alteracao e salva no Grow e enviada ao Acessorias.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Obrigacao</Label>
                <Input
                  value={editObligationForm.obligation_name}
                  onChange={(event) =>
                    setEditObligationForm((current) => ({ ...current, obligation_name: event.target.value }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Competencia</Label>
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
                      <SelectItem value="concluido">Concluido</SelectItem>
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
