
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Link2,
  Unlink,
  Upload,
  FileSpreadsheet,
  Building2,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

const normalizeCnpj = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
};

const obligationStatusVariant = (status: string | null) => {
  const token = String(status || "").trim().toLowerCase();
  if (token === "concluido" || token === "completed" || token === "sent") return "default";
  if (token === "atrasado" || token === "overdue") return "destructive";
  if (token === "em_andamento" || token === "processing") return "secondary";
  return "outline";
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

export default function AcessoriasPage() {
  const [loading, setLoading] = useState(true);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [removingClientId, setRemovingClientId] = useState<string | null>(null);
  const [syncingCompanies, setSyncingCompanies] = useState(false);
  const [syncingObligations, setSyncingObligations] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assigningObligation, setAssigningObligation] = useState(false);

  const [hasConfiguration, setHasConfiguration] = useState(false);
  const [clients, setClients] = useState<AcessoriasClientOverview[]>([]);
  const [companies, setCompanies] = useState<AcessoriasCompany[]>([]);
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

  const [clientSearch, setClientSearch] = useState("");
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [syncCreateTasks, setSyncCreateTasks] = useState(true);
  const [obligationClientFilter, setObligationClientFilter] = useState<string>("all");

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

  const companyOptions = useMemo(
    () =>
      [...companies].sort((a, b) =>
        a.company_name.localeCompare(b.company_name, "pt-BR", { sensitivity: "base" }),
      ),
    [companies],
  );

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      const name = String(client.name || "").toLowerCase();
      const cnpj = String(client.cnpj || "");
      const linkedCompany = String(client.acessorias_company_name || "").toLowerCase();
      return name.includes(term) || cnpj.includes(term) || linkedCompany.includes(term);
    });
  }, [clients, clientSearch]);

  const visibleObligations = useMemo(() => {
    if (obligationClientFilter === "all") return obligations;
    return obligations.filter((item) => item.client_id === obligationClientFilter);
  }, [obligations, obligationClientFilter]);

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
    setCompanies(Array.isArray(data.companies) ? data.companies : []);
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

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadOverview(), loadObligations(), loadUploads()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar modulo Acessorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clients.length === 0 || companies.length === 0) return;

    const companyByCnpj = new Map<string, AcessoriasCompany>();
    for (const company of companies) {
      const cnpj = normalizeCnpj(company.cnpj);
      if (!cnpj || companyByCnpj.has(cnpj)) continue;
      companyByCnpj.set(cnpj, company);
    }

    const nextDrafts: Record<string, string> = {};
    for (const client of clients) {
      if (client.link?.acessorias_company_id) {
        nextDrafts[client.id] = client.link.acessorias_company_id;
        continue;
      }
      const cnpj = normalizeCnpj(client.cnpj);
      const suggested = cnpj ? companyByCnpj.get(cnpj) : null;
      if (suggested) {
        nextDrafts[client.id] = suggested.acessorias_company_id;
      }
    }

    setLinkDrafts((current) => ({ ...nextDrafts, ...current }));
  }, [clients, companies]);

  const handleSyncCompanies = async () => {
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
      toast.success(
        `Empresas sincronizadas: ${result.synced || 0}. Clientes criados: ${result.clients_created || 0}. Atualizados: ${result.clients_updated || 0}. Vinculos automaticos: ${result.auto_linked || 0}. Inativados: ${result.clients_inactivated || 0}.`,
      );
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar empresas");
    } finally {
      setSyncingCompanies(false);
    }
  };

  const handleSaveLink = async (clientId: string) => {
    const selectedCompanyId = linkDrafts[clientId];
    if (!selectedCompanyId) {
      toast.error("Selecione uma empresa do Acessorias para vincular.");
      return;
    }

    setSavingClientId(clientId);
    try {
      await invokeAcessorias({
        action: "set_link",
        client_id: clientId,
        acessorias_company_id: selectedCompanyId,
        match_type: "manual",
      });
      toast.success("Vinculo salvo com sucesso.");
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar vinculo");
    } finally {
      setSavingClientId(null);
    }
  };

  const handleRemoveLink = async (clientId: string) => {
    setRemovingClientId(clientId);
    try {
      await invokeAcessorias({
        action: "remove_link",
        client_id: clientId,
      });
      toast.success("Vinculo removido.");
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover vinculo");
    } finally {
      setRemovingClientId(null);
    }
  };

  const handleSyncObligations = async () => {
    setSyncingObligations(true);
    try {
      const result = await invokeAcessorias<{
        synced_obligations: number;
        clients_processed: number;
        created_tasks: number;
      }>({
        action: "sync_obligations",
        create_tasks: syncCreateTasks,
      });

      toast.success(
        `Obrigacoes sincronizadas: ${result.synced_obligations || 0}. Clientes processados: ${result.clients_processed || 0}.`,
      );
      if ((result.created_tasks || 0) > 0) {
        toast.success(`Tarefas de fluxo criadas no Kanban: ${result.created_tasks}.`);
      }
      await Promise.all([loadOverview(), loadObligations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar obrigacoes");
    } finally {
      setSyncingObligations(false);
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
      toast.success("Arquivo enviado para o e-Continuo.");
      setSelectedFile(null);
      setUploadForm((current) => ({ ...current, competence: "", description: "" }));
      await Promise.all([loadOverview(), loadUploads(uploadForm.client_id)]);
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
            <h1 className="font-heading text-2xl font-bold">Modulo Acessorias</h1>
            <p className="text-sm text-muted-foreground">
              Integracao unica para cruzamento de clientes, obrigacoes acessorias e envio e-Continuo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncCompanies}
              disabled={syncingCompanies}
            >
              {syncingCompanies ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Empresas
            </Button>
            <Button
              type="button"
              onClick={handleSyncObligations}
              disabled={syncingObligations}
            >
              {syncingObligations ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Sincronizar Obrigacoes
            </Button>
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
          <Tabs defaultValue="clientes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="clientes">Clientes e Vinculos</TabsTrigger>
              <TabsTrigger value="obrigacoes">Obrigacoes</TabsTrigger>
              <TabsTrigger value="econtinuo">Envio e-Continuo</TabsTrigger>
            </TabsList>

            <TabsContent value="clientes" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cruzamento Grow x Acessorias</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Buscar cliente, CNPJ ou empresa vinculada..."
                      value={clientSearch}
                      onChange={(event) => setClientSearch(event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sync-create-tasks"
                        checked={syncCreateTasks}
                        onCheckedChange={(value) => setSyncCreateTasks(Boolean(value))}
                      />
                      <Label htmlFor="sync-create-tasks" className="text-sm">
                        Gerar tarefas no Kanban ao sincronizar
                      </Label>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr className="bg-muted/40 border-b text-xs text-muted-foreground">
                          <th className="text-left p-3">Cliente Grow</th>
                          <th className="text-left p-3">Empresa Acessorias</th>
                          <th className="text-left p-3">Obrigacoes</th>
                          <th className="text-left p-3">Ultima sincronizacao</th>
                          <th className="text-right p-3">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredClients.map((client) => {
                          const selectedCompanyId = linkDrafts[client.id] || "";
                          const isSaving = savingClientId === client.id;
                          const isRemoving = removingClientId === client.id;
                          return (
                            <tr key={client.id}>
                              <td className="p-3 align-top">
                                <div className="font-medium text-sm">{client.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  CNPJ: {client.cnpj || "Nao informado"} - Status: {client.status || "-"}
                                </div>
                              </td>
                              <td className="p-3 align-top">
                                <Select
                                  value={selectedCompanyId || undefined}
                                  onValueChange={(value) =>
                                    setLinkDrafts((current) => ({ ...current, [client.id]: value }))
                                  }
                                >
                                  <SelectTrigger className="w-[320px] max-w-full">
                                    <SelectValue placeholder="Selecione empresa do Acessorias" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {companyOptions.map((company) => (
                                      <SelectItem
                                        key={company.acessorias_company_id}
                                        value={company.acessorias_company_id}
                                      >
                                        {company.company_name} {company.cnpj ? `(${company.cnpj})` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {client.acessorias_company_name && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Vinculado: {client.acessorias_company_name} ({client.link?.match_type || "manual"})
                                  </div>
                                )}
                              </td>
                              <td className="p-3 align-top">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">Total: {client.obligations.total}</Badge>
                                  <Badge variant="secondary">Pendentes: {client.obligations.pending}</Badge>
                                  {client.obligations.overdue > 0 && (
                                    <Badge variant="destructive">Atrasadas: {client.obligations.overdue}</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 align-top text-sm text-muted-foreground">
                                {formatDateTime(client.obligations.lastSyncedAt || client.link?.last_synced_at)}
                              </td>
                              <td className="p-3 align-top">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => void handleSaveLink(client.id)}
                                    disabled={!selectedCompanyId || isSaving}
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Link2 className="h-4 w-4 mr-1" />
                                    )}
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void handleRemoveLink(client.id)}
                                    disabled={!client.link || isRemoving}
                                  >
                                    {isRemoving ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Unlink className="h-4 w-4 mr-1" />
                                    )}
                                    Remover
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredClients.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-sm text-muted-foreground">
                              Nenhum cliente encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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
                  <CardTitle className="text-base">Obrigacoes sincronizadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[260px_1fr]">
                    <Select
                      value={obligationClientFilter}
                      onValueChange={(value) => setObligationClientFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => void loadObligations()}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Atualizar lista
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                      <thead>
                        <tr className="bg-muted/40 border-b text-xs text-muted-foreground">
                          <th className="text-left p-3">Cliente</th>
                          <th className="text-left p-3">Obrigacao</th>
                          <th className="text-left p-3">Competencia</th>
                          <th className="text-left p-3">Vencimento</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Ult. sincronizacao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleObligations.map((item) => (
                          <tr key={item.id}>
                            <td className="p-3 align-top">
                              <div className="text-sm font-medium">{item.client_name || "-"}</div>
                              <div className="text-xs text-muted-foreground">{item.acessorias_company_name || "-"}</div>
                            </td>
                            <td className="p-3 align-top">
                              <div className="text-sm">{item.obligation_name}</div>
                              {item.protocol && (
                                <div className="text-xs text-muted-foreground">Protocolo: {item.protocol}</div>
                              )}
                            </td>
                            <td className="p-3 align-top text-sm">{item.obligation_period || "-"}</td>
                            <td className="p-3 align-top text-sm">{formatDate(item.due_date)}</td>
                            <td className="p-3 align-top">
                              <Badge variant={obligationStatusVariant(item.status)}>
                                {item.status || "pendente"}
                              </Badge>
                            </td>
                            <td className="p-3 align-top text-sm text-muted-foreground">
                              {formatDateTime(item.last_synced_at)}
                            </td>
                          </tr>
                        ))}
                        {visibleObligations.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-sm text-muted-foreground">
                              Nenhuma obrigacao encontrada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

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
                      Enviar para e-Continuo
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
          </Tabs>
        )}

        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Vinculos por CNPJ e associacao manual no mesmo modulo.
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
              Obrigacoes podem ser sincronizadas ou cadastradas manualmente.
            </span>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3.5 w-3.5 text-primary" />
              Envio e-Continuo com log para rastreabilidade operacional.
            </span>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
