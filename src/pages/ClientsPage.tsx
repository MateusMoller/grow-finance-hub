import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter, Building2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClientDetailSheet } from "@/components/app/ClientDetailSheet";
import { toast } from "sonner";

interface Client {
  id: number;
  name: string;
  cnpj: string;
  regime: string;
  sector: string;
  status: string;
  contact: string;
  email: string;
  phone: string;
}

const initialClients: Client[] = [
  { id: 1, name: "ABC Ltda", cnpj: "12.345.678/0001-00", regime: "Lucro Presumido", sector: "Contábil", status: "Ativo", contact: "João Silva", email: "joao@abc.com", phone: "(11) 98888-0001" },
  { id: 2, name: "Tech Corp", cnpj: "23.456.789/0001-00", regime: "Simples Nacional", sector: "Financeiro", status: "Ativo", contact: "Maria Santos", email: "maria@tech.com", phone: "(11) 98888-0002" },
  { id: 3, name: "Global Trade", cnpj: "34.567.890/0001-00", regime: "Lucro Real", sector: "Contábil", status: "Ativo", contact: "Pedro Lima", email: "pedro@global.com", phone: "(11) 98888-0003" },
  { id: 4, name: "StartupXYZ", cnpj: "45.678.901/0001-00", regime: "Simples Nacional", sector: "DP", status: "Ativo", contact: "Ana Costa", email: "ana@startup.com", phone: "(11) 98888-0004" },
  { id: 5, name: "Nova Empresa", cnpj: "56.789.012/0001-00", regime: "MEI", sector: "Contábil", status: "Onboarding", contact: "Lucas Oliveira", email: "lucas@nova.com", phone: "(11) 98888-0005" },
];

const statusColors: Record<string, string> = {
  Ativo: "bg-primary/10 text-primary",
  Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  Inativo: "bg-muted text-muted-foreground",
};

export default function ClientsPage() {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", cnpj: "", regime: "Simples Nacional", sector: "Contábil", contact: "", email: "", phone: "" });

  const filtered = clients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search)
  );

  const handleCreate = () => {
    if (!newClient.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const client: Client = { id: Date.now(), ...newClient, status: "Onboarding" };
    setClients(prev => [client, ...prev]);
    setCreateOpen(false);
    setNewClient({ name: "", cnpj: "", regime: "Simples Nacional", sector: "Contábil", contact: "", email: "", phone: "" });
    toast.success("Cliente cadastrado com sucesso");
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" /> Filtros</Button>
        </div>

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
                {filtered.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => { setSelectedClient(client); setSheetOpen(true); }}
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
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status] || "bg-muted"}`}>
                        {client.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ClientDetailSheet client={selectedClient} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input placeholder="Nome da empresa" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input placeholder="00.000.000/0001-00" value={newClient.cnpj} onChange={e => setNewClient(p => ({ ...p, cnpj: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Regime Tributário</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newClient.regime} onChange={e => setNewClient(p => ({ ...p, regime: e.target.value }))}>
                  {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newClient.sector} onChange={e => setNewClient(p => ({ ...p, sector: e.target.value }))}>
                  {["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contato Principal</Label>
              <Input placeholder="Nome do contato" value={newClient.contact} onChange={e => setNewClient(p => ({ ...p, contact: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" placeholder="email@empresa.com" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
