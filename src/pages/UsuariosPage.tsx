import { useCallback, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Loader2, Pencil, Plus, Search, ShieldAlert, Trash2, UserCog, Users } from "lucide-react";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  created_at: string;
};

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gerente" },
  { value: "employee", label: "Colaborador" },
  { value: "commercial", label: "Comercial" },
  { value: "departamento_pessoal", label: "Departamento Pessoal" },
  { value: "fiscal", label: "Fiscal" },
  { value: "contabil", label: "Contabil" },
  { value: "partner", label: "Parceiro" },
] as const;

const roleLabelMap = new Map(roleOptions.map((option) => [option.value, option.label]));

const roleColorMap: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  director: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
  commercial: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  employee: "bg-muted text-foreground",
  departamento_pessoal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20",
  fiscal: "bg-violet-100 text-violet-700 dark:bg-violet-900/20",
  contabil: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20",
  partner: "bg-orange-100 text-orange-700 dark:bg-orange-900/20",
};

export default function UsuariosPage() {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "employee",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    role: "employee",
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === "admin";

  const resetCreateForm = () => {
    setForm({
      displayName: "",
      email: "",
      password: "",
      role: "employee",
    });
  };

  const extractFunctionErrorMessage = async (error: unknown) => {
    if (!(error instanceof FunctionsHttpError)) return null;

    try {
      const errorResponse = await error.context.json();
      if (errorResponse && typeof errorResponse === "object" && "error" in errorResponse) {
        return String(errorResponse.error);
      }
    } catch {
      // ignore parsing errors and fallback to generic message
    }

    return null;
  };

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);

    const { data, error } = await supabase.rpc("list_admin_users");
    setLoadingUsers(false);

    if (error) {
      toast.error(`NÃ£o foi possÃ­vel carregar usuÃ¡rios: ${error.message}`);
      return;
    }

    setUsers((data || []) as AdminUserRow[]);
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const tryPromoteExistingPortalUser = async (email: string, nextRole: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return false;

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("portal_user_id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (clientError) {
      toast.error("NÃ£o foi possÃ­vel validar o usuÃ¡rio existente para promocao de perfil.");
      return false;
    }

    const portalUserId = clientRow?.portal_user_id;
    if (!portalUserId) return false;

    const { error: upsertRoleError } = await supabase.from("user_roles").upsert(
      {
        user_id: portalUserId,
        role: nextRole as "admin" | "director" | "manager" | "employee" | "commercial" | "partner" | "departamento_pessoal" | "fiscal" | "contabil" | "client",
      },
      { onConflict: "user_id,role" },
    );

    if (upsertRoleError) {
      toast.error("NÃ£o foi possÃ­vel aplicar o novo perfil no usuÃ¡rio existente.");
      return false;
    }

    const { error: removeClientRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", portalUserId)
      .eq("role", "client");

    if (removeClientRoleError) {
      toast.error("NÃ£o foi possÃ­vel remover o perfil de cliente do usuÃ¡rio promovido.");
      return false;
    }

    const { error: removeClientRecordError } = await supabase
      .from("clients")
      .delete()
      .eq("portal_user_id", portalUserId);

    if (removeClientRecordError) {
      toast.error("NÃ£o foi possÃ­vel remover o vinculo de cliente do usuÃ¡rio promovido.");
      return false;
    }

    return true;
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return users;

    return users.filter((user) => {
      const name = (user.display_name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const roleLabel = roleLabelMap.get(user.role || "")?.toLowerCase() || "";
      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        roleLabel.includes(normalizedSearch)
      );
    });
  }, [search, users]);

  const handleCreateUser = async () => {
    if (!isAdmin) {
      toast.error("Apenas admin pode cadastrar usuÃ¡rios.");
      return;
    }

    if (!form.displayName.trim()) {
      toast.error("Informe o nome do usuÃ¡rio.");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Informe o e-mail do usuÃ¡rio.");
      return;
    }

    const password = form.password.trim();
    const isValidPassword = password.length >= 6;
    if (!isValidPassword) {
      toast.error("A senha precisa ter no mÃ­nimo 6 caracteres.");
      return;
    }

    setCreating(true);
    const { error } = await supabase.functions.invoke("create-team-user", {
      body: {
        displayName: form.displayName,
        email: form.email,
        password,
        role: form.role,
      },
    });
    setCreating(false);

    if (error) {
      const detailedErrorMessage = await extractFunctionErrorMessage(error);

      const normalizedMessage = (detailedErrorMessage || error.message || "").toLowerCase();
      const shouldTryPromotion =
        normalizedMessage.includes("already linked to another profile") ||
        normalizedMessage.includes("linked to an internal profile");

      if (shouldTryPromotion) {
        setCreating(true);
        const promoted = await tryPromoteExistingPortalUser(form.email, form.role);
        setCreating(false);

        if (promoted) {
          toast.success("UsuÃ¡rio existente encontrado. Perfil interno aplicado com sucesso.");
          setCreateOpen(false);
          resetCreateForm();
          void loadUsers();
          return;
        }
      }

      if (detailedErrorMessage) {
        toast.error(detailedErrorMessage);
        return;
      }

      toast.error(error.message || "NÃ£o foi possÃ­vel cadastrar usuÃ¡rio.");
      return;
    }

    toast.success("UsuÃ¡rio cadastrado com sucesso.");
    setCreateOpen(false);
    resetCreateForm();
    void loadUsers();
  };

  const openEditDialog = (userRow: AdminUserRow) => {
    setEditingUser(userRow);
    setEditForm({
      displayName: userRow.display_name?.trim() || "",
      role: userRow.role || "employee",
    });
    setEditOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!isAdmin || !editingUser) {
      toast.error("Apenas admin pode editar usuÃƒÂ¡rios.");
      return;
    }

    if (!editForm.displayName.trim()) {
      toast.error("Informe o nome do usuÃƒÂ¡rio.");
      return;
    }

    if (!editForm.role.trim()) {
      toast.error("Selecione um perfil.");
      return;
    }

    setSavingEdit(true);
    const { error } = await supabase.functions.invoke("manage-team-user", {
      body: {
        action: "update",
        userId: editingUser.user_id,
        displayName: editForm.displayName,
        role: editForm.role,
      },
    });
    setSavingEdit(false);

    if (error) {
      const detailedErrorMessage = await extractFunctionErrorMessage(error);
      toast.error(detailedErrorMessage || error.message || "NÃƒÂ£o foi possÃƒÂ­vel atualizar usuÃƒÂ¡rio.");
      return;
    }

    toast.success("UsuÃƒÂ¡rio atualizado com sucesso.");
    setEditOpen(false);
    setEditingUser(null);
    void loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!isAdmin || !deleteTarget) {
      toast.error("Apenas admin pode excluir usuÃƒÂ¡rios.");
      return;
    }

    if (deleteTarget.user_id === user?.id) {
      toast.error("NÃƒÂ£o ÃƒÂ© permitido excluir o prÃƒÂ³prio usuÃƒÂ¡rio.");
      return;
    }

    setDeleting(true);
    const { error } = await supabase.functions.invoke("manage-team-user", {
      body: {
        action: "delete",
        userId: deleteTarget.user_id,
      },
    });
    setDeleting(false);

    if (error) {
      const detailedErrorMessage = await extractFunctionErrorMessage(error);
      toast.error(detailedErrorMessage || error.message || "NÃƒÂ£o foi possÃƒÂ­vel excluir usuÃƒÂ¡rio.");
      return;
    }

    toast.success("UsuÃƒÂ¡rio excluÃƒÂ­do com sucesso.");
    setDeleteTarget(null);
    void loadUsers();
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl space-y-4">
          <h1 className="font-heading text-2xl font-bold">Controle de UsuÃ¡rios</h1>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-sm font-semibold">Acesso restrito</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem acessar o controle de usuÃ¡rios.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Controle de UsuÃ¡rios</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre novos usuÃ¡rios internos e gerencie permissoes da equipe.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar UsuÃ¡rio
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">UsuÃ¡rios internos</p>
            <p className="font-heading text-2xl font-bold">{users.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Administradores</p>
            <p className="font-heading text-2xl font-bold">
              {users.filter((user) => user.role === "admin").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Perfis diferentes</p>
            <p className="font-heading text-2xl font-bold">
              {new Set(users.map((user) => user.role || "sem_perfil")).size}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, e-mail ou perfil..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">UsuÃ¡rio</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">E-mail</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Perfil</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Criado em</th>
                    <th className="p-4 text-right text-xs font-semibold text-muted-foreground">AÃƒÂ§ÃƒÂµes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((userRow, index) => {
                    const label = roleLabelMap.get(userRow.role || "") || "Sem perfil";
                    const badgeClass = roleColorMap[userRow.role || ""] || "bg-muted text-foreground";
                    const isOwnUser = userRow.user_id === user?.id;

                    return (
                      <motion.tr
                        key={userRow.user_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <UserCog className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {userRow.display_name?.trim() || "Sem nome definido"}
                              </p>
                              <p className="text-xs text-muted-foreground md:hidden">
                                {userRow.email || "Sem e-mail"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm hidden md:table-cell">{userRow.email || "-"}</td>
                        <td className="p-4">
                          <Badge variant="outline" className={`border-0 ${badgeClass}`}>
                            {label}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">
                          {new Date(userRow.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openEditDialog(userRow)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(userRow)}
                              disabled={isOwnUser}
                              title={isOwnUser ? "NÃƒÂ£o ÃƒÂ© permitido excluir seu prÃƒÂ³prio usuÃƒÂ¡rio." : undefined}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-14 text-center text-sm text-muted-foreground">
                        <div className="inline-flex flex-col items-center gap-2">
                          <Users className="h-6 w-6" />
                          Nenhum usuÃ¡rio encontrado para esse filtro.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário interno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                placeholder="Nome do colaborador"
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="usuÃ¡rio@empresa.com"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha temporaria *</Label>
              <Input
                type="password"
                placeholder="MÃ­nimo 6 caracteres"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>PermissÃ£o *</Label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {creating ? "Cadastrando..." : "Cadastrar usuÃ¡rio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize nome e permissão do usuário selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input
                placeholder="Nome do colaborador"
                value={editForm.displayName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editingUser?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>PermissÃƒÂ£o *</Label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                value={editForm.role}
                onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUserEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {savingEdit ? "Salvando..." : "Salvar alteraÃƒÂ§ÃƒÂµes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuÃƒÂ¡rio</AlertDialogTitle>
            <AlertDialogDescription>
              Essa aÃƒÂ§ÃƒÂ£o irÃƒÂ¡ remover o acesso de{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.display_name?.trim() || deleteTarget?.email || "este usuÃƒÂ¡rio"}
              </span>{" "}
              permanentemente. Essa aÃƒÂ§ÃƒÂ£o nÃƒÂ£o pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {deleting ? "Excluindo..." : "Confirmar exclusÃƒÂ£o"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

