import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Filter, Building2, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clientSegmentOptions } from "@/lib/clientSegments";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface Client {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  regime: string | null;
  sector: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  portal_user_id: string | null;
}

type NewClientForm = {
  code: string;
  name: string;
  trade_name: string;
  cnpj: string;
  state_registration: string;
  municipal_registration: string;
  cnae_main: string;
  regime: string;
  simples_annex: string;
  opened_at: string;
  cnpj_status: string;
  city: string;
  state: string;
  address: string;
  ddd: string;
  phone: string;
  whatsapp: string;
  contact: string;
  email: string;
  has_digital_certificate: boolean | null;
  certificate_type: string;
  certificate_expires_on: string;
  status: string;
  notes: string;
  gov_password: string;
  sector: string;
  password: string;
};

const normalizeEmail = (value: string | null | undefined) => (value || "").trim().toLowerCase();

const statusColors: Record<string, string> = {
  Ativo: "bg-primary/10 text-primary",
  Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  Inativo: "bg-muted text-muted-foreground",
};

const initialNewClient: NewClientForm = {
  code: "",
  name: "",
  trade_name: "",
  cnpj: "",
  state_registration: "",
  municipal_registration: "",
  cnae_main: "",
  regime: "Simples Nacional",
  simples_annex: "",
  opened_at: "",
  cnpj_status: "",
  city: "",
  state: "",
  address: "",
  ddd: "",
  phone: "",
  whatsapp: "",
  contact: "",
  email: "",
  has_digital_certificate: null,
  certificate_type: "",
  certificate_expires_on: "",
  status: "Ativo",
  notes: "",
  gov_password: "",
  sector: clientSegmentOptions[0],
  password: "",
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resettingPortalPasswords, setResettingPortalPasswords] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>({ ...initialNewClient });

  const canCreateClients = role === "admin" || role === "director" || role === "manager" || role === "commercial";
  const canManagePortalPermissions = role === "admin";

  useEffect(() => {
    void loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, trade_name, cnpj, regime, sector, status, contact, email, phone, portal_user_id")
      .order("name");
    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar clientes");
      return;
    }

    setClients(
      ((data || []) as Client[]).map((client) => ({
        ...client,
        email: client.email ? normalizeEmail(client.email) : client.email,
      })),
    );
  };

  const ensurePortalClientRole = async (portalUserIds: string[], notifySuccess: boolean) => {
    if (!canManagePortalPermissions || portalUserIds.length === 0) return;

    const deduplicatedIds = [...new Set(portalUserIds)];

    const { data: existingRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("user_id", deduplicatedIds)
      .eq("role", "client");

    if (rolesError) {
      toast.error("Nao foi possivel validar permissoes atuais do portal.");
      return;
    }

    const alreadyAllowed = new Set((existingRoles || []).map((row) => row.user_id));
    const missingRoleIds = deduplicatedIds.filter((userId) => !alreadyAllowed.has(userId));

    if (missingRoleIds.length === 0) {
      if (notifySuccess) toast.success("Todos os clientes ja possuem permissao do portal.");
      return;
    }

    const { error: upsertError } = await supabase
      .from("user_roles")
      .upsert(
        missingRoleIds.map((userId) => ({
          user_id: userId,
          role: "client" as const,
        })),
        { onConflict: "user_id,role" },
      );

    if (upsertError) {
      toast.error("Nao foi possivel aplicar permissao do portal para todos os clientes.");
      return;
    }

    if (notifySuccess) {
      toast.success(`${missingRoleIds.length} cliente(s) receberam permissao de portal.`);
    }
  };

  const syncPortalPermissionsForLoadedClients = async () => {
    if (!canManagePortalPermissions) return;

    const userIds = clients
      .map((client) => client.portal_user_id)
      .filter((userId): userId is string => Boolean(userId));

    if (userIds.length === 0) {
      toast.error("Nenhum cliente com usuario de portal vinculado para sincronizar.");
      return;
    }

    await ensurePortalClientRole(userIds, true);
  };

  const resetAllPortalPasswords = async () => {
    if (!canManagePortalPermissions) {
      toast.error("Apenas admin pode redefinir senhas de portal.");
      return;
    }

    const confirmed = window.confirm(
      "Confirma redefinir a senha de todos os clientes do portal para 123456?",
    );
    if (!confirmed) return;

    setResettingPortalPasswords(true);

    const { data, error } = await supabase.functions.invoke("reset-client-portal-passwords", {
      body: { password: "123456" },
    });

    setResettingPortalPasswords(false);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const errorResponse = await error.context.json();
          if (errorResponse && typeof errorResponse === "object" && "error" in errorResponse) {
            toast.error(String(errorResponse.error));
            return;
          }
        } catch {
          // ignore parsing errors and fallback to generic message
        }
      }

      toast.error(error.message || "Nao foi possivel redefinir as senhas do portal.");
      return;
    }

    const result = (data || {}) as {
      passwords_reset?: number;
      skipped_count?: number;
      auth_users_created?: number;
      portal_links_created?: number;
      skipped_preview?: Array<{ email?: string | null; reason?: string | null }>;
    };

    const passwordsReset = Number(result.passwords_reset || 0);
    const skippedCount = Number(result.skipped_count || 0);
    const usersCreated = Number(result.auth_users_created || 0);
    const linksCreated = Number(result.portal_links_created || 0);
    const skippedPreview = Array.isArray(result.skipped_preview) ? result.skipped_preview : [];

    toast.success(
      `${passwordsReset} senha(s) de portal redefinida(s) para 123456. ` +
        `${usersCreated} usuario(s) criado(s), ${linksCreated} vinculo(s) criados.`,
    );

    if (skippedCount > 0) {
      const previewLabel = skippedPreview
        .slice(0, 3)
        .map((item) => `${item.email || "sem_email"} (${item.reason || "motivo_indefinido"})`)
        .join(" | ");

      toast.warning(
        `${skippedCount} cliente(s) nao puderam ser processados.` +
          (previewLabel ? ` Ex.: ${previewLabel}` : ""),
      );
    }

    void loadClients();
  };

  const filtered = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.trade_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (client.cnpj || "").includes(search)
  );

  const handleCreate = async () => {
    if (!canCreateClients) {
      toast.error("Seu perfil nao possui permissao para cadastrar clientes");
      return;
    }

    if (!newClient.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    if (!newClient.email.trim()) {
      toast.error("Informe o e-mail para criar o acesso do portal");
      return;
    }

    const password = newClient.password.trim();
    const isValidPassword = password.length >= 6;
    if (!isValidPassword) {
      toast.error("A senha do portal precisa ter no minimo 6 caracteres");
      return;
    }

    setCreating(true);
    const normalizedEmail = normalizeEmail(newClient.email);
    const { error } = await supabase.functions.invoke("create-client-with-portal", {
      body: {
        code: newClient.code || null,
        name: newClient.name,
        trade_name: newClient.trade_name || null,
        cnpj: newClient.cnpj || null,
        state_registration: newClient.state_registration || null,
        municipal_registration: newClient.municipal_registration || null,
        cnae_main: newClient.cnae_main || null,
        regime: newClient.regime,
        simples_annex: newClient.simples_annex || null,
        opened_at: newClient.opened_at || null,
        cnpj_status: newClient.cnpj_status || null,
        city: newClient.city || null,
        state: newClient.state || null,
        address: newClient.address || null,
        ddd: newClient.ddd || null,
        sector: newClient.sector,
        status: newClient.status,
        contact: newClient.contact || null,
        email: normalizedEmail,
        phone: newClient.phone || null,
        whatsapp: newClient.whatsapp || null,
        has_digital_certificate: newClient.has_digital_certificate,
        certificate_type: newClient.certificate_type || null,
        certificate_expires_on: newClient.certificate_expires_on || null,
        notes: newClient.notes || null,
        gov_password: newClient.gov_password || null,
        password,
      },
    });
    setCreating(false);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const errorResponse = await error.context.json();
          if (errorResponse && typeof errorResponse === "object" && "error" in errorResponse) {
            toast.error(String(errorResponse.error));
            return;
          }
        } catch {
          // ignore parsing errors and fallback to generic message
        }
      }

      toast.error(error.message || "Erro ao cadastrar cliente");
      return;
    }

    setCreateOpen(false);
    setNewClient({ ...initialNewClient });
    toast.success("Cliente cadastrado e acesso do portal criado com sucesso");
    void loadClients();

    if (canManagePortalPermissions) {
      const { data: createdClient } = await supabase
        .from("clients")
        .select("portal_user_id")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const portalUserId = createdClient?.portal_user_id || null;
      if (portalUserId) {
        await ensurePortalClientRole([portalUserId], false);
      }
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
          </div>
          {canCreateClients && (
            <div className="flex items-center gap-2">
              {canManagePortalPermissions && (
                <Button size="sm" variant="outline" onClick={() => void syncPortalPermissionsForLoadedClients()}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> Sincronizar portal
                </Button>
              )}
              {canManagePortalPermissions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void resetAllPortalPasswords()}
                  disabled={resettingPortalPasswords}
                >
                  {resettingPortalPasswords ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
                  Senhas portal 123456
                </Button>
              )}
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Cliente
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por razao social, nome fantasia ou CNPJ..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" /> Filtros
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4">Empresa</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden md:table-cell">CNPJ</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden lg:table-cell">Regime</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden lg:table-cell">Segmento</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((client, index) => (
                    <motion.tr
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/clientes/${client.id}`)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.trade_name || client.contact || "Sem contato"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{client.cnpj}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.regime}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.sector || "Nao informado"}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status || ""] || "bg-muted"}`}>
                          {client.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Dados Cadastrais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Codigo</Label>
                  <Input value={newClient.code} onChange={(event) => setNewClient((prev) => ({ ...prev, code: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Razao Social *</Label>
                  <Input value={newClient.name} onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>Nome Fantasia</Label>
                  <Input value={newClient.trade_name} onChange={(event) => setNewClient((prev) => ({ ...prev, trade_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={newClient.cnpj} onChange={(event) => setNewClient((prev) => ({ ...prev, cnpj: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Inscricao Estadual</Label>
                  <Input value={newClient.state_registration} onChange={(event) => setNewClient((prev) => ({ ...prev, state_registration: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Inscricao Municipal</Label>
                  <Input value={newClient.municipal_registration} onChange={(event) => setNewClient((prev) => ({ ...prev, municipal_registration: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CNAE Principal</Label>
                  <Input value={newClient.cnae_main} onChange={(event) => setNewClient((prev) => ({ ...prev, cnae_main: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Regime Tributario</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.regime} onChange={(event) => setNewClient((prev) => ({ ...prev, regime: event.target.value }))}>
                    {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map((regime) => <option key={regime}>{regime}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Anexo Simples</Label>
                  <Input value={newClient.simples_annex} onChange={(event) => setNewClient((prev) => ({ ...prev, simples_annex: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Data de Abertura</Label>
                  <Input type="date" value={newClient.opened_at} onChange={(event) => setNewClient((prev) => ({ ...prev, opened_at: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Situacao CNPJ</Label>
                  <Input value={newClient.cnpj_status} onChange={(event) => setNewClient((prev) => ({ ...prev, cnpj_status: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status Cliente</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.status} onChange={(event) => setNewClient((prev) => ({ ...prev, status: event.target.value }))}>
                    {["Ativo", "Onboarding", "Inativo"].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Segmento do Cliente</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.sector} onChange={(event) => setNewClient((prev) => ({ ...prev, sector: event.target.value }))}>
                    {clientSegmentOptions.map((segment) => <option key={segment}>{segment}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Contato e Endereco</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={newClient.city} onChange={(event) => setNewClient((prev) => ({ ...prev, city: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={newClient.state} onChange={(event) => setNewClient((prev) => ({ ...prev, state: event.target.value }))} />
                </div>
                <div className="space-y-2 lg:col-span-1 sm:col-span-2">
                  <Label>Endereco</Label>
                  <Input value={newClient.address} onChange={(event) => setNewClient((prev) => ({ ...prev, address: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>DDD</Label>
                  <Input value={newClient.ddd} onChange={(event) => setNewClient((prev) => ({ ...prev, ddd: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={newClient.phone} onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={newClient.whatsapp} onChange={(event) => setNewClient((prev) => ({ ...prev, whatsapp: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Contato Principal</Label>
                  <Input value={newClient.contact} onChange={(event) => setNewClient((prev) => ({ ...prev, contact: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>E-mail do Portal *</Label>
                  <Input type="email" value={newClient.email} onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value.toLowerCase() }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Certificado e Credenciais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Certificado Digital</Label>
                  <select
                    className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none"
                    value={
                      newClient.has_digital_certificate === null
                        ? ""
                        : newClient.has_digital_certificate
                          ? "sim"
                          : "nao"
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setNewClient((prev) => ({
                        ...prev,
                        has_digital_certificate:
                          nextValue === ""
                            ? null
                            : nextValue === "sim",
                      }));
                    }}
                  >
                    <option value="">Nao informado</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Nao</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo Certificado</Label>
                  <Input placeholder="A1 / A3" value={newClient.certificate_type} onChange={(event) => setNewClient((prev) => ({ ...prev, certificate_type: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento Certificado</Label>
                  <Input type="date" value={newClient.certificate_expires_on} onChange={(event) => setNewClient((prev) => ({ ...prev, certificate_expires_on: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>Senha do gov</Label>
                  <Input value={newClient.gov_password} onChange={(event) => setNewClient((prev) => ({ ...prev, gov_password: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                  <Label>Observacoes Gerais</Label>
                  <Textarea rows={3} value={newClient.notes} onChange={(event) => setNewClient((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Acesso ao Portal</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Senha do Portal *</Label>
                  <Input type="password" placeholder="Minimo 6 caracteres" value={newClient.password} onChange={(event) => setNewClient((prev) => ({ ...prev, password: event.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {creating ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
