import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Building2, Phone, Mail } from "lucide-react";
import { useState } from "react";

const mockClients = [
  { id: 1, name: "ABC Ltda", cnpj: "12.345.678/0001-00", regime: "Lucro Presumido", sector: "Contábil", status: "Ativo", contact: "João Silva", email: "joao@abc.com", phone: "(11) 98888-0001" },
  { id: 2, name: "Tech Corp", cnpj: "23.456.789/0001-00", regime: "Simples Nacional", sector: "Financeiro", status: "Ativo", contact: "Maria Santos", email: "maria@tech.com", phone: "(11) 98888-0002" },
  { id: 3, name: "Global Trade", cnpj: "34.567.890/0001-00", regime: "Lucro Real", sector: "Contábil", status: "Ativo", contact: "Pedro Lima", email: "pedro@global.com", phone: "(11) 98888-0003" },
  { id: 4, name: "StartupXYZ", cnpj: "45.678.901/0001-00", regime: "Simples Nacional", sector: "DP", status: "Ativo", contact: "Ana Costa", email: "ana@startup.com", phone: "(11) 98888-0004" },
  { id: 5, name: "Nova Empresa", cnpj: "56.789.012/0001-00", regime: "MEI", sector: "Contábil", status: "Onboarding", contact: "Lucas Oliveira", email: "lucas@nova.com", phone: "(11) 98888-0005" },
];

const statusColors: Record<string, string> = {
  Ativo: "bg-primary/10 text-primary",
  Onboarding: "bg-grow-gold/10 text-grow-gold-foreground",
  Inativo: "bg-muted text-muted-foreground",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const filtered = mockClients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search)
  );

  return (
    <AppLayout>
      <div className="space-y-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">{mockClients.length} clientes cadastrados</p>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" /> Filtros
          </Button>
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
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status]}`}>
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
    </AppLayout>
  );
}
