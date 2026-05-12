import { AppLayout } from "@/components/app/AppLayout";
import { clientSegmentOptions } from "@/lib/clientSegments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  FolderClosed,
  FolderOpen,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  regime: string | null;
  sector: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  obligation_completion_whatsapp_enabled: boolean;
  portal_user_id: string | null;
}

type CnpjLookupResponse = {
  ok?: boolean;
  source?: string;
  data?: {
    legal_name?: string | null;
    trade_name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  error?: string;
};

const normalizeEmail = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const isValidEmail = (value: string | null | undefined) => {
  const normalized = normalizeEmail(value);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const formatCnpjValue = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const normalizeCnpjForSave = (value: string | null | undefined) => {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 14) return null;
  return digits;
};

const normalizeBrazilPhoneDigits = (value: string | null | undefined) => {
  const rawDigits = (value || "").replace(/\D/g, "");
  if (!rawDigits) return "";

  if (rawDigits.startsWith("55") && rawDigits.length >= 12) {
    const withoutCountryCode = rawDigits.slice(2);
    if (withoutCountryCode.length >= 10) {
      return withoutCountryCode.slice(-11);
    }
  }

  if (rawDigits.length > 11) {
    return rawDigits.slice(-11);
  }

  return rawDigits;
};

const formatPhoneValue = (value: string) => {
  const digits = normalizeBrazilPhoneDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const phone = digits.slice(2);
  if (phone.length <= 4) return `(${ddd}) ${phone}`;
  if (phone.length <= 8) return `(${ddd}) ${phone.slice(0, 4)}-${phone.slice(4)}`;
  return `(${ddd}) ${phone.slice(0, 5)}-${phone.slice(5)}`;
};

const normalizePhoneDigits = (value: string | null | undefined) => normalizeBrazilPhoneDigits(value);

const normalizeRegime = (value: string | null | undefined) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "simples") return "Simples Nacional";
  return trimmed;
};

const parseFunctionErrorMessage = async (error: unknown) => {
  if (!(error instanceof FunctionsHttpError)) {
    return error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.";
  }

  try {
    const payload = await error.context.json();
    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // ignore payload parsing failures
  }

  return error.message || "Não foi possível cadastrar o cliente.";
};

const statusColors: Record<string, string> = {
  Ativo: "bg-primary/10 text-primary",
  Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  Inativo: "bg-muted text-muted-foreground",
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inactiveFolderOpen, setInactiveFolderOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [searchingNewClientCnpj, setSearchingNewClientCnpj] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    cnpj: "",
    regime: "Simples Nacional",
    sector: clientSegmentOptions[0],
    contact: "",
    email: "",
    phone: "",
    obligationCompletionWhatsAppEnabled: false,
    portalPassword: "123456",
  });

  const canCreateClients =
    role === "admin" || role === "director" || role === "manager" || role === "commercial";

  useEffect(() => {
    void loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, cnpj, regime, sector, status, contact, email, phone, obligation_completion_whatsapp_enabled, portal_user_id")
      .order("name");
    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar clientes");
      return;
    }

    setClients(
      ((data || []) as Client[]).map((client) => ({
        ...client,
        cnpj: client.cnpj ? formatCnpjValue(client.cnpj) : client.cnpj,
        regime: normalizeRegime(client.regime),
        email: client.email ? normalizeEmail(client.email) : client.email,
        phone: client.phone ? formatPhoneValue(client.phone) : client.phone,
      })),
    );
  };

  const filtered = clients.filter((client) => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;

    const searchDigits = normalizedSearch.replace(/\D/g, "");
    const cnpjDigits = (client.cnpj || "").replace(/\D/g, "");

    return (
      client.name.toLowerCase().includes(normalizedSearch) ||
      (client.contact || "").toLowerCase().includes(normalizedSearch) ||
      (client.email || "").toLowerCase().includes(normalizedSearch) ||
      (searchDigits.length > 0 && cnpjDigits.includes(searchDigits)) ||
      (client.cnpj || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const totalActiveClients = useMemo(
    () => clients.filter((client) => String(client.status || "").trim().toLowerCase() === "ativo").length,
    [clients],
  );

  const isInactiveClient = (client: Client) =>
    String(client.status || "").trim().toLowerCase() === "inativo";

  const activeClients = filtered.filter((client) => !isInactiveClient(client));
  const inactiveClients = filtered.filter(isInactiveClient);

  const openCreateDialog = () => {
    if (!canCreateClients) {
      toast.error("Seu perfil nÃ£o possui permissÃ£o para cadastrar clientes.");
      return;
    }

    setCreateOpen(true);
  };

  const handleLookupNewClientCnpj = async (options?: { auto?: boolean }) => {
    const normalizedCnpj = normalizeCnpjForSave(newClient.cnpj);
    if (!normalizedCnpj) {
      if (!options?.auto) {
        toast.error("Informe um CNPJ valido com 14 digitos.");
      }
      return;
    }

    if (searchingNewClientCnpj) return;
    setSearchingNewClientCnpj(true);

    try {
      const { data, error } = await supabase.functions.invoke<CnpjLookupResponse>("lookup-cnpj", {
        body: { cnpj: normalizedCnpj },
      });

      if (error || !data?.data) {
        if (!options?.auto) {
          toast.error(data?.error || "Nao foi possivel consultar o CNPJ no momento.");
        }
        return;
      }

      const cnpjData = data.data;
      let appliedCount = 0;

      setNewClient((prev) => {
        const next = { ...prev };
        if (!next.name.trim() && cnpjData.legal_name) {
          next.name = cnpjData.legal_name;
          appliedCount += 1;
        }
        if (!next.phone.trim() && cnpjData.phone) {
          next.phone = formatPhoneValue(cnpjData.phone);
          appliedCount += 1;
        }
        if (!next.email.trim() && cnpjData.email) {
          next.email = normalizeEmail(cnpjData.email);
          appliedCount += 1;
        }
        return next;
      });

      if (!options?.auto) {
        if (appliedCount > 0) {
          toast.success(`${appliedCount} campos preenchidos pelo CNPJ (${data.source || "consulta"}).`);
        } else {
          toast.message("Nenhum campo vazio encontrado para preenchimento automatico.");
        }
      }
    } catch (lookupError) {
      if (!options?.auto) {
        const message = lookupError instanceof Error ? lookupError.message : "Erro ao consultar CNPJ.";
        toast.error(message);
      }
    } finally {
      setSearchingNewClientCnpj(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreateClients) {
      toast.error("Seu perfil nÃ£o possui permissÃ£o para cadastrar clientes.");
      return;
    }

    if (!newClient.name.trim()) {
      toast.error("Informe a razÃ£o social do cliente.");
      return;
    }

    const normalizedEmail = normalizeEmail(newClient.email);
    if (!isValidEmail(normalizedEmail)) {
      toast.error("Informe um e-mail vÃ¡lido para o portal.");
      return;
    }

    const normalizedName = newClient.name.trim();
    const normalizedContact = newClient.contact.trim();
    const normalizedCnpj = normalizeCnpjForSave(newClient.cnpj);
    const normalizedPhone = formatPhoneValue(newClient.phone);
    const phoneDigits = normalizePhoneDigits(normalizedPhone);
    const password = newClient.portalPassword.trim() || "123456";

    if (newClient.cnpj.trim() && !normalizedCnpj) {
      toast.error("Informe um CNPJ valido com 14 digitos ou deixe em branco.");
      return;
    }

    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      toast.error("Informe um telefone valido com DDD.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha inicial do portal deve ter no minimo 6 caracteres.");
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      toast.error("Sessao expirada. Entre novamente para cadastrar o cliente.");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase.functions.invoke<{
      portal_access_link?: string | null;
      portal_access_link_type?: "invite" | "recovery" | "password" | null;
      portal_password_applied?: boolean;
    }>("create-client-with-portal", {
      body: {
        name: normalizedName,
        cnpj: normalizedCnpj,
        regime: newClient.regime.trim(),
        sector: newClient.sector.trim(),
        contact: normalizedContact || null,
        email: normalizedEmail,
        phone: normalizedPhone || null,
        obligationCompletionWhatsAppEnabled: newClient.obligationCompletionWhatsAppEnabled,
        portalPassword: password,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    setCreating(false);

    if (error) {
      const errorMessage = await parseFunctionErrorMessage(error);
      toast.error(errorMessage || "NÃ£o foi possÃ­vel cadastrar o cliente.");
      return;
    }

    const portalPasswordApplied = Boolean(data?.portal_password_applied);

    if (portalPasswordApplied) {
      toast.success(`Cliente cadastrado. Senha inicial do portal: ${password}.`);
    } else {
      toast.success("Cliente cadastrado com acesso de portal.");
    }
    setCreateOpen(false);
    setNewClient({
      name: "",
      cnpj: "",
      regime: "Simples Nacional",
      sector: clientSegmentOptions[0],
      contact: "",
      email: "",
      phone: "",
      obligationCompletionWhatsAppEnabled: false,
      portalPassword: "123456",
    });
    void loadClients();
  };

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              {clients.length} clientes cadastrados <span className="mx-1">•</span> {totalActiveClients} ativos
            </p>
          </div>
          {canCreateClients && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="mr-1 h-4 w-4" />
                Novo cliente
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-1 h-4 w-4" /> Filtros
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Empresa</th>
                    <th className="hidden p-4 text-left text-xs font-semibold text-muted-foreground md:table-cell">CNPJ</th>
                    <th className="hidden p-4 text-left text-xs font-semibold text-muted-foreground lg:table-cell">Regime</th>
                    <th className="hidden p-4 text-left text-xs font-semibold text-muted-foreground lg:table-cell">Segmento</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeClients.map((client, index) => (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="cursor-pointer transition-colors hover:bg-muted/20"
                      onClick={() => navigate(`/app/clientes/${client.id}`)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.contact}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden p-4 text-sm text-muted-foreground md:table-cell">{client.cnpj}</td>
                      <td className="hidden p-4 text-sm lg:table-cell">{client.regime}</td>
                      <td className="hidden p-4 text-sm lg:table-cell">{client.sector || "NÃ£o informado"}</td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[client.status || ""] || "bg-muted"}`}
                        >
                          {client.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {inactiveClients.length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                            onClick={() => setInactiveFolderOpen((prev) => !prev)}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {inactiveFolderOpen ? (
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <FolderClosed className="h-4 w-4 text-muted-foreground" />
                              )}
                              Empresas Inativas ({inactiveClients.length})
                            </span>
                            {inactiveFolderOpen ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {inactiveFolderOpen &&
                        inactiveClients.map((client, index) => (
                          <motion.tr
                            key={client.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className="cursor-pointer transition-colors hover:bg-muted/20 opacity-85"
                            onClick={() => navigate(`/app/clientes/${client.id}`)}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{client.name}</div>
                                  <div className="text-xs text-muted-foreground">{client.contact}</div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden p-4 text-sm text-muted-foreground md:table-cell">{client.cnpj}</td>
                            <td className="hidden p-4 text-sm lg:table-cell">{client.regime}</td>
                            <td className="hidden p-4 text-sm lg:table-cell">{client.sector || "NÃ£o informado"}</td>
                            <td className="p-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[client.status || ""] || "bg-muted"}`}
                              >
                                {client.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                    </>
                  )}
                  {activeClients.length === 0 && inactiveClients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                        Nenhum cliente encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Razao Social *</Label>
                <Input
                  placeholder="Nome da empresa"
                  value={newClient.name}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={140}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={newClient.cnpj}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, cnpj: formatCnpjValue(event.target.value) }))}
                    onBlur={() => {
                      const normalizedCnpj = normalizeCnpjForSave(newClient.cnpj);
                      if (normalizedCnpj && !newClient.name.trim()) {
                        void handleLookupNewClientCnpj({ auto: true });
                      }
                    }}
                    inputMode="numeric"
                    maxLength={18}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void handleLookupNewClientCnpj()}
                    disabled={searchingNewClientCnpj}
                  >
                    {searchingNewClientCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar CNPJ"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Regime Tributario</Label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                  value={newClient.regime}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, regime: event.target.value }))}
                >
                  {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map((regime) => (
                    <option key={regime}>{regime}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Segmento do Cliente</Label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                  value={newClient.sector}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, sector: event.target.value }))}
                >
                  {clientSegmentOptions.map((segment) => (
                    <option key={segment}>{segment}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contato Principal</Label>
              <Input
                placeholder="Nome do contato"
                value={newClient.contact}
                onChange={(event) => setNewClient((prev) => ({ ...prev, contact: event.target.value }))}
                maxLength={100}
                autoComplete="name"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>E-mail do Portal *</Label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={newClient.email}
                  onChange={(event) =>
                    setNewClient((prev) => ({ ...prev, email: event.target.value.toLowerCase() }))
                  }
                  maxLength={120}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha do Portal</Label>
                <Input
                  type="password"
                  placeholder="123456"
                  value={newClient.portalPassword}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, portalPassword: event.target.value }))}
                  minLength={6}
                  maxLength={64}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={newClient.phone}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, phone: formatPhoneValue(event.target.value) }))}
                  inputMode="tel"
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Enviar WhatsApp automático ao concluir obrigações</p>
                  <p className="text-xs text-muted-foreground">
                    Ative apenas para clientes que devem receber confirmação automática no WhatsApp. O número será buscado no cadastro do cliente.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newClient.obligationCompletionWhatsAppEnabled}
                  onChange={(event) =>
                    setNewClient((prev) => ({
                      ...prev,
                      obligationCompletionWhatsAppEnabled: event.target.checked,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Acesso do Portal</Label>
              <Input
                type="text"
                placeholder="Acesso inicial do portal"
                value={`Acesso inicial por senha: ${newClient.portalPassword.trim() || "123456"}`}
                readOnly
                disabled
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {creating ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

