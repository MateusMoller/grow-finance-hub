import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter, Building2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
}

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
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    cnpj: "",
    regime: "Simples Nacional",
    sector: "Contabil",
    contact: "",
    email: "",
    phone: "",
    password: "",
  });

  const canCreateClients = role === "admin";

  useEffect(() => {
    void loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, cnpj, regime, sector, status, contact, email, phone")
      .order("name");
    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar clientes");
      return;
    }

    setClients((data || []) as Client[]);
  };

  const filtered = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.cnpj || "").includes(search)
  );

  const handleCreate = async () => {
    if (role !== "admin") {
      toast.error("Apenas admin pode cadastrar clientes");
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
    const isStrongPassword = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    if (!isStrongPassword) {
      toast.error("A senha do portal precisa ter no minimo 8 caracteres com letras e numeros");
      return;
    }

    setCreating(true);
    const { error } = await supabase.functions.invoke("create-client-with-portal", {
      body: {
        name: newClient.name,
        cnpj: newClient.cnpj || null,
        regime: newClient.regime,
        sector: newClient.sector,
        contact: newClient.contact || null,
        email: newClient.email,
        phone: newClient.phone || null,
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
    setNewClient({
      name: "",
      cnpj: "",
      regime: "Simples Nacional",
      sector: "Contabil",
      contact: "",
      email: "",
      phone: "",
      password: "",
    });
    toast.success("Cliente cadastrado e acesso do portal criado com sucesso");
    void loadClients();
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
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo Cliente
            </Button>
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
                    <th className="text-left text-xs font-semibold text-muted-foreground p-4 hidden lg:table-cell">Setor</th>
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
                            <div className="text-xs text-muted-foreground">{client.contact}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{client.cnpj}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.regime}</td>
                      <td className="p-4 text-sm hidden lg:table-cell">{client.sector}</td>
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
                <Label>Setor</Label>
                <select className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none" value={newClient.sector} onChange={(event) => setNewClient((prev) => ({ ...prev, sector: event.target.value }))}>
                  {["Contabil", "Fiscal", "Departamento Pessoal", "Financeiro"].map((sector) => <option key={sector}>{sector}</option>)}
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
                <Input type="email" placeholder="email@empresa.com" value={newClient.email} onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Senha do Portal *</Label>
              <Input type="password" placeholder="Minimo 8 caracteres com letras e numeros" value={newClient.password} onChange={(event) => setNewClient((prev) => ({ ...prev, password: event.target.value }))} />
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
