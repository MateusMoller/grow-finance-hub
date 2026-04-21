import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Filter, Building2, Loader2, FolderClosed, FolderOpen, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clientSegmentOptions } from "@/lib/clientSegments";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

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
  portal_user_id: string | null;
}

const normalizeEmail = (value: string | null | undefined) => (value || "").trim().toLowerCase();

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
  const [syncingAcessorias, setSyncingAcessorias] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inactiveFolderOpen, setInactiveFolderOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    cnpj: "",
    regime: "Simples Nacional",
    sector: clientSegmentOptions[0],
    contact: "",
    email: "",
    phone: "",
    password: "",
  });

  const canCreateClients = role === "admin" || role === "director" || role === "manager" || role === "commercial";
  const canManagePortalPermissions = role === "admin";

  useEffect(() => {
    void loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, cnpj, regime, sector, status, contact, email, phone, portal_user_id")
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
      toast.error("Não foi possível validar permissões atuais do portal.");
      return;
    }

    const alreadyAllowed = new Set((existingRoles || []).map((row) => row.user_id));
    const missingRoleIds = deduplicatedIds.filter((userId) => !alreadyAllowed.has(userId));

    if (missingRoleIds.length === 0) {
      if (notifySuccess) toast.success("Todos os clientes já possuem permissão do portal.");
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
      toast.error("Não foi possível aplicar permissão do portal para todos os clientes.");
      return;
    }

    if (notifySuccess) {
      toast.success(`${missingRoleIds.length} cliente(s) receberam permissão de portal.`);
    }
  };

  const filtered = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.cnpj || "").includes(search)
  );

  const isInactiveClient = (client: Client) => String(client.status || "").trim().toLowerCase() === "inativo";
  const activeClients = filtered.filter((client) => !isInactiveClient(client));
  const inactiveClients = filtered.filter(isInactiveClient);

  const handleSyncFromAcessorias = async () => {
    if (!canCreateClients) {
      toast.error("Seu perfil não possui permissão para sincronizar clientes.");
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      toast.error("Sessão expirada. Entre novamente para sincronizar com o Acessorias.");
      return;
    }

    setSyncingAcessorias(true);
    const { data, error } = await supabase.functions.invoke("acessorias-module", {
      body: {
        action: "sync_companies",
        sync_grow_clients: true,
        restrict_to_acessorias: false,
        allow_client_inactivation: false,
        access_token: session.access_token,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    setSyncingAcessorias(false);

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

      toast.error(error.message || "Erro ao sincronizar empresas com o Acessorias");
      return;
    }

    const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const synced = Number(payload.synced || 0);
    const created = Number(payload.clients_created || 0);
    const updated = Number(payload.clients_updated || 0);
    const linked = Number(payload.auto_linked || 0);
    const inactivated = Number(payload.clients_inactivated || 0);
    const cadastralSynced = Number(payload.cadastro_clientes_fields_synced || 0);

    toast.success(
      `Sincronização concluída em modo seguro: ${synced} empresas, ${created} criadas, ${updated} atualizadas, ${linked} vinculadas, ${cadastralSynced} campos cadastrais atualizados${inactivated > 0 ? `, ${inactivated} inativadas` : ""}.`,
    );
    void loadClients();
  };

  const handleCreate = async () => {
    toast.error("Cadastro manual desativado. Use a sincronização com o Acessorias.");
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
              <Button size="sm" onClick={() => setSyncConfirmOpen(true)} disabled={syncingAcessorias}>
                {syncingAcessorias ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {syncingAcessorias ? "Sincronizando..." : "Sincronizar com Acessorias"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou CNPJ..."
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
                  {activeClients.map((client, index) => (
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
                            <div className="text-xs text-muted-foreground">{client.contact}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{client.cnpj}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.regime}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.sector || "Não informado"}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status || ""] || "bg-muted"}`}>
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
                            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
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
                            className="hover:bg-muted/20 cursor-pointer transition-colors opacity-85"
                            onClick={() => navigate(`/app/clientes/${client.id}`)}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{client.name}</div>
                                  <div className="text-xs text-muted-foreground">{client.contact}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{client.cnpj}</td>
                            <td className="p-4 text-sm hidden lg:table-cell">{client.regime}</td>
                            <td className="p-4 text-sm hidden lg:table-cell">{client.sector || "Não informado"}</td>
                            <td className="p-4">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status || ""] || "bg-muted"}`}>
                                {client.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                    </>
                  )}
                  {activeClients.length === 0 && inactiveClients.length === 0 && (
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

      <AlertDialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar sincronização de clientes</AlertDialogTitle>
            <AlertDialogDescription>
              Esta sincronização está em modo seguro e não pode inativar clientes automaticamente.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSyncConfirmOpen(false);
                void handleSyncFromAcessorias();
              }}
            >
              Confirmar sincronização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Razao Social *</Label>
                <Input placeholder="Nome da empresa" value={newClient.name} onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input placeholder="00.000.000/0001-00" value={newClient.cnpj} onChange={(event) => setNewClient((prev) => ({ ...prev, cnpj: event.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Regime Tributario</Label>
                <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.regime} onChange={(event) => setNewClient((prev) => ({ ...prev, regime: event.target.value }))}>
                  {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map((regime) => <option key={regime}>{regime}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Segmento do Cliente</Label>
                <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.sector} onChange={(event) => setNewClient((prev) => ({ ...prev, sector: event.target.value }))}>
                  {clientSegmentOptions.map((segment) => <option key={segment}>{segment}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contato Principal</Label>
              <Input placeholder="Nome do contato" value={newClient.contact} onChange={(event) => setNewClient((prev) => ({ ...prev, contact: event.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail do Portal *</Label>
                <Input type="email" placeholder="email@empresa.com" value={newClient.email} onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value.toLowerCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Senha do Portal *</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={newClient.password} onChange={(event) => setNewClient((prev) => ({ ...prev, password: event.target.value }))} />
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
