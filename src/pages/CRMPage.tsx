import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Filter } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LeadDetailSheet } from "@/components/app/LeadDetailSheet";
import { toast } from "sonner";

const stages = [
  { label: "Lead Novo", count: 8, color: "bg-muted-foreground" },
  { label: "Contato Iniciado", count: 5, color: "bg-primary/60" },
  { label: "Qualificação", count: 4, color: "bg-primary" },
  { label: "Reunião Agendada", count: 3, color: "bg-amber-500" },
  { label: "Proposta Enviada", count: 6, color: "bg-primary" },
  { label: "Negociação", count: 2, color: "bg-purple-500" },
  { label: "Fechado Ganho", count: 4, color: "bg-primary" },
  { label: "Fechado Perdido", count: 2, color: "bg-destructive/60" },
];

interface Lead {
  name: string;
  contact: string;
  value: string;
  stage: string;
  daysInStage: number;
}

const initialLeads: Lead[] = [
  { name: "Empresa Alpha", contact: "Roberto Dias", value: "R$ 3.500/mês", stage: "Proposta Enviada", daysInStage: 3 },
  { name: "Beta Serviços", contact: "Juliana Melo", value: "R$ 2.800/mês", stage: "Reunião Agendada", daysInStage: 1 },
  { name: "Gamma Tech", contact: "Felipe Rocha", value: "R$ 5.200/mês", stage: "Negociação", daysInStage: 5 },
  { name: "Delta Corp", contact: "Camila Souza", value: "R$ 1.900/mês", stage: "Qualificação", daysInStage: 2 },
  { name: "Epsilon Ltda", contact: "André Lima", value: "R$ 4.100/mês", stage: "Lead Novo", daysInStage: 0 },
];

export default function CRMPage() {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", contact: "", value: "", stage: "Lead Novo" });

  const handleStageChange = (leadName: string, newStage: string) => {
    setLeads(prev => prev.map(l => l.name === leadName ? { ...l, stage: newStage, daysInStage: 0 } : l));
    setSelectedLead(prev => prev && prev.name === leadName ? { ...prev, stage: newStage, daysInStage: 0 } : prev);
    toast.success(`Lead movido para "${newStage}"`);
  };

  const handleCreate = () => {
    if (!newLead.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setLeads(prev => [{ ...newLead, daysInStage: 0 }, ...prev]);
    setCreateOpen(false);
    setNewLead({ name: "", contact: "", value: "", stage: "Lead Novo" });
    toast.success("Lead cadastrado com sucesso");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">CRM / Leads</h1>
            <p className="text-sm text-muted-foreground">Pipeline comercial e gestão de leads</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" /> Filtros</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
          </div>
        </div>

        {/* Pipeline overview */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-heading font-semibold text-sm mb-4">Funil Comercial</h2>
          <div className="flex gap-1 items-end h-20">
            {stages.map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold">{s.count}</span>
                <div className={`w-full rounded-t ${s.color} transition-all`} style={{ height: `${Math.max(s.count * 8, 8)}px` }} />
                <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1 hidden lg:block">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-heading font-semibold">Leads Recentes</h2>
          </div>
          <div className="divide-y">
            {leads.map((lead, i) => (
              <motion.div
                key={lead.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 flex items-center justify-between hover:bg-muted/20 cursor-pointer transition-colors"
                onClick={() => { setSelectedLead(lead); setSheetOpen(true); }}
              >
                <div>
                  <div className="text-sm font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.contact}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium hidden sm:block">{lead.value}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{lead.stage}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <LeadDetailSheet lead={selectedLead} open={sheetOpen} onOpenChange={setSheetOpen} onStageChange={handleStageChange} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Input placeholder="Nome da empresa" value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input placeholder="Nome do contato" value={newLead.contact} onChange={e => setNewLead(p => ({ ...p, contact: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valor Estimado</Label>
                <Input placeholder="R$ 0,00/mês" value={newLead.value} onChange={e => setNewLead(p => ({ ...p, value: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Cadastrar Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
