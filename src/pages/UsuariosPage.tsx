import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  type ManagedUser,
  type UserAccessInput,
  type UserFilters,
  useUserManagement,
} from "@/hooks/useUserManagement";
import { formatPermissionAuditValue, usePermissionAudit } from "@/hooks/usePermissionAudit";
import {
  DEFAULT_COLLABORATOR_MODULES,
  MODULE_KEYS,
  MODULE_LABELS,
  PRIMARY_ROLES,
  SECTOR_CODES,
  SECTOR_LABELS,
  USER_STATUSES,
  type ModuleKey,
  type PrimaryRole,
  type SectorCode,
  type UserStatus,
} from "@/lib/userPermissions";

const roleLabels: Record<PrimaryRole, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
  cliente: "Cliente",
};

const statusLabels: Record<UserStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  inactive: "Inativo",
};

const collaboratorModules = MODULE_KEYS.filter((moduleKey) => moduleKey !== "usuarios");

const emptyForm = (): UserAccessInput => ({
  displayName: "",
  email: "",
  password: "",
  primaryRole: "colaborador",
  status: "active",
  sectorCode: "geral",
  enabledModules: [...DEFAULT_COLLABORATOR_MODULES],
  linkedClientIds: [],
  changeReason: "",
});

const userToForm = (user: ManagedUser): UserAccessInput => ({
  userId: user.user_id,
  displayName: user.display_name || "",
  email: user.email || "",
  primaryRole: user.primary_role,
  status: user.status,
  sectorCode: user.sector_code,
  enabledModules: user.enabled_modules,
  linkedClientIds: user.linked_clients.map((client) => client.client_id),
  changeReason: "",
});

const isHiddenSystemUser = (user: ManagedUser) => {
  const displayName = (user.display_name || "").trim().toLowerCase();
  const email = (user.email || "").trim().toLowerCase();
  return (
    displayName.startsWith("grow docume") ||
    displayName.startsWith("grow bot") ||
    email.startsWith("grow.docume") ||
    email.startsWith("growbot") ||
    email.startsWith("grow.bot")
  );
};

export default function UsuariosPage() {
  const { effectiveAccess, currentOrganizationId, refreshAccess } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<Omit<UserFilters, "search">>({
    role: "colaborador",
    sectorCode: "all",
    status: "all",
    moduleKey: "all",
    page: 1,
    pageSize: 25,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [auditAction, setAuditAction] = useState("all");
  const [form, setForm] = useState<UserAccessInput>(emptyForm);

  const queryFilters = useMemo<UserFilters>(
    () => ({ ...filters, search: deferredSearch }),
    [deferredSearch, filters],
  );
  const { usersQuery, clientsQuery, saveMutation, deactivateMutation } =
    useUserManagement(currentOrganizationId, queryFilters);
  const auditQuery = usePermissionAudit(currentOrganizationId, {
    action: auditAction,
    page: 1,
    pageSize: 20,
  });

  const isAdmin = effectiveAccess?.primaryRole === "admin";
  const totalPages = Math.max(1, Math.ceil((usersQuery.data?.total || 0) / filters.pageSize));
  const visibleUsers = useMemo(
    () => (usersQuery.data?.items || []).filter((managedUser) => !isHiddenSystemUser(managedUser)),
    [usersQuery.data?.items],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setForm(userToForm(user));
    setDialogOpen(true);
  };

  const setRole = (primaryRole: PrimaryRole) => {
    setForm((current) => ({
      ...current,
      primaryRole,
      sectorCode: primaryRole === "colaborador" ? current.sectorCode || "geral" : null,
      enabledModules: primaryRole === "colaborador"
        ? Array.from(new Set<ModuleKey>(["tarefas", ...current.enabledModules]))
        : [],
      linkedClientIds: primaryRole === "cliente" ? current.linkedClientIds : [],
    }));
  };

  const toggleModule = (moduleKey: ModuleKey, enabled: boolean) => {
    if (moduleKey === "tarefas") return;
    setForm((current) => ({
      ...current,
      enabledModules: enabled
        ? Array.from(new Set([...current.enabledModules, moduleKey]))
        : current.enabledModules.filter((item) => item !== moduleKey),
    }));
  };

  const toggleClient = (clientId: string, enabled: boolean) => {
    setForm((current) => ({
      ...current,
      linkedClientIds: enabled
        ? Array.from(new Set([...current.linkedClientIds, clientId]))
        : current.linkedClientIds.filter((item) => item !== clientId),
    }));
  };

  const save = async () => {
    if (!form.displayName.trim() || (!form.userId && (!form.email?.trim() || !form.password))) {
      toast.error("Preencha nome, e-mail e senha.");
      return;
    }
    if (form.primaryRole === "colaborador" && form.status === "active" && !form.sectorCode) {
      toast.error("Selecione o setor do colaborador.");
      return;
    }

    try {
      await saveMutation.mutateAsync(form);
      await refreshAccess();
      toast.success(form.userId ? "Usuário atualizado." : "Usuário criado.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o usuário.");
    }
  };

  const deactivate = async (user: ManagedUser) => {
    try {
      await deactivateMutation.mutateAsync(user.user_id);
      toast.success("Usuário desativado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-3xl rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" />
            <h1 className="font-semibold">Acesso restrito</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar usuários e permissões.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Usuários e permissões</h1>
            <p className="text-sm text-muted-foreground">
              Papéis, setores, módulos e empresas vinculadas.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        </div>

        <div className="grid gap-3 border-y py-4 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou e-mail"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setFilters((current) => ({ ...current, page: 1 }));
              }}
            />
          </div>
          <Select value={filters.role} onValueChange={(role) => setFilters((current) => ({ ...current, role: role as UserFilters["role"], page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Papel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {PRIMARY_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(status) => setFilters((current) => ({ ...current, status: status as UserFilters["status"], page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {USER_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.sectorCode} onValueChange={(sectorCode) => setFilters((current) => ({ ...current, sectorCode: sectorCode as UserFilters["sectorCode"], page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {SECTOR_CODES.map((sector) => <SelectItem key={sector} value={sector}>{SECTOR_LABELS[sector]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.moduleKey} onValueChange={(moduleKey) => setFilters((current) => ({ ...current, moduleKey: moduleKey as UserFilters["moduleKey"], page: 1 }))}>
            <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {MODULE_KEYS.map((moduleKey) => (
                <SelectItem key={moduleKey} value={moduleKey}>{MODULE_LABELS[moduleKey]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(220px,1.4fr)_150px_160px_minmax(220px,1fr)_92px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
            <span>Usuário</span><span>Papel</span><span>Setor / status</span><span>Acesso</span><span className="text-right">Ações</span>
          </div>
          {usersQuery.isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : usersQuery.isError ? (
            <div className="p-8 text-sm text-destructive">Não foi possível carregar os usuários.</div>
          ) : visibleUsers.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            visibleUsers.map((managedUser) => (
              <div key={managedUser.user_id} className="grid grid-cols-[minmax(220px,1.4fr)_150px_160px_minmax(220px,1fr)_92px] gap-4 border-b px-4 py-4 text-sm last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{managedUser.display_name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{managedUser.email}</p>
                </div>
                <div><Badge variant="outline">{roleLabels[managedUser.primary_role]}</Badge></div>
                <div>
                  <p>{managedUser.sector_code ? SECTOR_LABELS[managedUser.sector_code] : "-"}</p>
                  <p className="text-xs text-muted-foreground">{statusLabels[managedUser.status]}</p>
                  {managedUser.requires_access_review && <Badge variant="destructive" className="mt-1">Revisar</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {managedUser.primary_role === "admin" && <Badge>Todos os módulos</Badge>}
                  {managedUser.enabled_modules.slice(0, 4).map((moduleKey) => (
                    <Badge key={moduleKey} variant="secondary">{MODULE_LABELS[moduleKey]}</Badge>
                  ))}
                  {managedUser.linked_clients.slice(0, 3).map((client) => (
                    <Badge key={client.client_id} variant="secondary">{client.name}</Badge>
                  ))}
                </div>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(managedUser)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Desativar" disabled={managedUser.status === "inactive"} onClick={() => void deactivate(managedUser)}><UserX className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{visibleUsers.length} usuários</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft className="h-4 w-4" /></Button>
            <span>{filters.page} de {totalPages}</span>
            <Button variant="outline" size="icon" disabled={filters.page >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <section className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Histórico de permissões</h2>
              <p className="text-sm text-muted-foreground">Alterações recentes de acesso nesta organização.</p>
            </div>
            <Select value={auditAction} onValueChange={setAuditAction}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as alterações</SelectItem>
                <SelectItem value="role_changed">Papel</SelectItem>
                <SelectItem value="status_changed">Status</SelectItem>
                <SelectItem value="sector_changed">Setor</SelectItem>
                <SelectItem value="modules_changed">Módulos</SelectItem>
                <SelectItem value="client_links_changed">Empresas</SelectItem>
                <SelectItem value="migration_review_required">Revisão de migração</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-lg border">
            {auditQuery.isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : auditQuery.isError ? (
              <div className="p-6 text-sm text-destructive">Não foi possível carregar o histórico.</div>
            ) : (auditQuery.data?.items || []).length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Nenhuma alteração registrada.</div>
            ) : (
              auditQuery.data?.items.map((entry) => (
                <div key={entry.id} className="grid gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[180px_1fr_1.4fr_150px]">
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p>{entry.target_name || entry.target_user_id}</p>
                    <p className="text-xs text-muted-foreground">por {entry.actor_name || "Sistema"}</p>
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="truncate">Antes: {formatPermissionAuditValue(entry.previous_value)}</p>
                    <p className="truncate">Depois: {formatPermissionAuditValue(entry.new_value)}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={entry.result === "denied" ? "destructive" : "outline"}>
                      {entry.result === "denied" ? "Negado" : "Concluído"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.userId ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>Configure o papel e somente os acessos necessários.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input disabled={Boolean(form.userId)} value={form.email || ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            {!form.userId && (
              <div className="space-y-2">
                <Label>Senha inicial</Label>
                <Input type="password" value={form.password || ""} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.primaryRole} onValueChange={(value) => setRole(value as PrimaryRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIMARY_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as UserStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{USER_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.primaryRole === "colaborador" && (
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={form.sectorCode || "geral"} onValueChange={(value) => setForm((current) => ({ ...current, sectorCode: value as SectorCode }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SECTOR_CODES.map((sector) => <SelectItem key={sector} value={sector}>{SECTOR_LABELS[sector]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          {form.primaryRole === "colaborador" && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label>Módulos</Label>
                <p className="text-xs text-muted-foreground">O módulo Tarefas é obrigatório. Os demais acessos são explícitos.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {collaboratorModules.map((moduleKey) => (
                  <label key={moduleKey} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <Checkbox checked={form.enabledModules.includes(moduleKey)} disabled={moduleKey === "tarefas"} onCheckedChange={(checked) => toggleModule(moduleKey, checked === true)} />
                    {MODULE_LABELS[moduleKey]}
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.primaryRole === "cliente" && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label>Empresas vinculadas</Label>
                <p className="text-xs text-muted-foreground">Sem vínculo ativo, o usuário verá o estado de acesso pendente.</p>
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                {(clientsQuery.data || []).map((client) => (
                  <label key={client.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <Checkbox checked={form.linkedClientIds.includes(client.id)} onCheckedChange={(checked) => toggleClient(client.id, checked === true)} />
                    <span className="truncate">{client.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo da alteração</Label>
            <Input value={form.changeReason || ""} onChange={(event) => setForm((current) => ({ ...current, changeReason: event.target.value }))} placeholder="Opcional" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
