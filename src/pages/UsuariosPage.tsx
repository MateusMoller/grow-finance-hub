import { useCallback, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, ShieldAlert, UserCog, Users } from "lucide-react";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const { role } = useAuth();
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

  const isAdmin = role === "admin";

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
      toast.error(`Nao foi possivel carregar usuarios: ${error.message}`);
      return;
    }

    setUsers((data || []) as AdminUserRow[]);
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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
      toast.error("Apenas admin pode cadastrar usuarios.");
      return;
    }

    if (!form.displayName.trim()) {
      toast.error("Informe o nome do usuario.");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Informe o e-mail do usuario.");
      return;
    }

    const password = form.password.trim();
    const isStrongPassword = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    if (!isStrongPassword) {
      toast.error("A senha precisa ter no minimo 8 caracteres com letras e numeros.");
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

      toast.error(error.message || "Nao foi possivel cadastrar usuario.");
      return;
    }

    toast.success("Usuario cadastrado com sucesso.");
    setCreateOpen(false);
    setForm({
      displayName: "",
      email: "",
      password: "",
      role: "employee",
    });
    void loadUsers();
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl space-y-4">
          <h1 className="font-heading text-2xl font-bold">Controle de Usuarios</h1>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-sm font-semibold">Acesso restrito</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem acessar o controle de usuarios.
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
            <h1 className="font-heading text-2xl font-bold">Controle de Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre novos usuarios internos e gerencie permissoes da equipe.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Usuario
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Usuarios internos</p>
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
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Usuario</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">E-mail</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground">Perfil</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((userRow, index) => {
                    const label = roleLabelMap.get(userRow.role || "") || "Sem perfil";
                    const badgeClass = roleColorMap[userRow.role || ""] || "bg-muted text-foreground";

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
                      </motion.tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-14 text-center text-sm text-muted-foreground">
                        <div className="inline-flex flex-col items-center gap-2">
                          <Users className="h-6 w-6" />
                          Nenhum usuario encontrado para esse filtro.
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
            <DialogTitle>Adicionar usuario</DialogTitle>
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
                placeholder="usuario@empresa.com"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha temporaria *</Label>
              <Input
                type="password"
                placeholder="Minimo 8 caracteres com letras e numeros"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissao *</Label>
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
              {creating ? "Cadastrando..." : "Cadastrar usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
