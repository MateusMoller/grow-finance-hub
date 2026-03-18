import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { toast } from "sonner";

type KanbanStatus = "backlog" | "todo" | "doing" | "review" | "done";

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  client: string;
  assignee: string;
  priority: "Alta" | "Média" | "Baixa" | "Urgente";
  sector: string;
  dueDate: string;
  tags: string[];
  subtasks: { title: string; done: boolean }[];
  attachments: number;
  comments: number;
}

const columns: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", color: "bg-amber-500" },
  { id: "doing", label: "Em Andamento", color: "bg-primary" },
  { id: "review", label: "Revisão", color: "bg-purple-500" },
  { id: "done", label: "Concluído", color: "bg-primary" },
];

const statusMap: Record<KanbanStatus, string> = {
  backlog: "Pendente",
  todo: "Pendente",
  doing: "Em andamento",
  review: "Em revisão",
  done: "Concluído",
};

const initialCards: Record<KanbanStatus, KanbanCard[]> = {
  backlog: [
    { id: "1", title: "Importar extratos bancários", description: "Importar e conciliar extratos bancários do mês", client: "ABC Ltda", assignee: "Carlos R.", priority: "Média", sector: "Financeiro", dueDate: "2026-03-25", tags: ["Financeiro"], subtasks: [{ title: "Baixar extratos", done: false }, { title: "Conciliar", done: false }], attachments: 1, comments: 0 },
  ],
  todo: [
    { id: "2", title: "Fechamento contábil março", description: "Realizar fechamento contábil completo", client: "Tech Corp", assignee: "Maria S.", priority: "Alta", sector: "Contábil", dueDate: "2026-03-20", tags: ["Contábil", "Mensal"], subtasks: [{ title: "Conciliar contas", done: false }, { title: "Gerar balancete", done: false }], attachments: 2, comments: 3 },
    { id: "3", title: "Cadastrar novo colaborador", description: "Processar admissão do novo funcionário", client: "StartupXYZ", assignee: "Ana L.", priority: "Média", sector: "DP", dueDate: "2026-03-22", tags: ["DP", "Admissão"], subtasks: [{ title: "Coletar documentos", done: true }, { title: "Cadastro eSocial", done: false }], attachments: 5, comments: 1 },
  ],
  doing: [
    { id: "4", title: "Declaração IR PJ", description: "Preparar e enviar declaração de IR da pessoa jurídica", client: "ABC Ltda", assignee: "Maria S.", priority: "Alta", sector: "Fiscal", dueDate: "2026-03-18", tags: ["Fiscal", "IR"], subtasks: [{ title: "Reunir informes", done: true }, { title: "Preencher", done: false }], attachments: 8, comments: 4 },
    { id: "5", title: "Fluxo de caixa semanal", description: "Atualizar fluxo de caixa da semana", client: "Global Trade", assignee: "Lucas M.", priority: "Média", sector: "Financeiro", dueDate: "2026-03-19", tags: ["BPO"], subtasks: [{ title: "Lançamentos", done: true }, { title: "Relatório", done: false }], attachments: 2, comments: 1 },
  ],
  review: [
    { id: "6", title: "Proposta comercial", description: "Revisar e enviar proposta comercial para novo cliente", client: "Nova Empresa", assignee: "Pedro S.", priority: "Alta", sector: "Comercial", dueDate: "2026-03-20", tags: ["Comercial"], subtasks: [{ title: "Montar proposta", done: true }, { title: "Aprovação diretoria", done: false }], attachments: 1, comments: 2 },
  ],
  done: [
    { id: "7", title: "Admissão concluída", description: "Processo de admissão finalizado", client: "Tech Corp", assignee: "Ana L.", priority: "Baixa", sector: "DP", dueDate: "2026-03-15", tags: ["DP"], subtasks: [{ title: "Cadastro eSocial", done: true }, { title: "Contrato assinado", done: true }], attachments: 4, comments: 3 },
  ],
};

const priorityDot: Record<string, string> = {
  Urgente: "bg-destructive",
  Alta: "bg-orange-500",
  Média: "bg-amber-500",
  Baixa: "bg-muted-foreground",
};

export default function KanbanPage() {
  const [cards, setCards] = useState(initialCards);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<KanbanStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCard, setNewCard] = useState({ title: "", client: "", assignee: "", priority: "Média" as KanbanCard["priority"], sector: "Contábil" });

  const taskForSheet = selectedCard ? {
    id: selectedCard.id,
    title: selectedCard.title,
    description: selectedCard.description,
    client: selectedCard.client,
    sector: selectedCard.sector,
    assignee: selectedCard.assignee,
    priority: selectedCard.priority,
    dueDate: selectedCard.dueDate,
    status: statusMap[selectedStatus || "todo"] as any,
    tags: selectedCard.tags,
    subtasks: selectedCard.subtasks,
    attachments: selectedCard.attachments,
    comments: selectedCard.comments,
  } : null;

  const handleSubtaskToggle = (taskId: string, subtaskIndex: number) => {
    setCards(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated) as KanbanStatus[]) {
        updated[key] = updated[key].map(c => {
          if (c.id !== taskId) return c;
          const subtasks = [...c.subtasks];
          subtasks[subtaskIndex] = { ...subtasks[subtaskIndex], done: !subtasks[subtaskIndex].done };
          return { ...c, subtasks };
        });
      }
      return updated;
    });
    setSelectedCard(prev => {
      if (!prev || prev.id !== taskId) return prev;
      const subtasks = [...prev.subtasks];
      subtasks[subtaskIndex] = { ...subtasks[subtaskIndex], done: !subtasks[subtaskIndex].done };
      return { ...prev, subtasks };
    });
  };

  const handleCreate = () => {
    if (!newCard.title.trim()) { toast.error("Título é obrigatório"); return; }
    const card: KanbanCard = {
      id: String(Date.now()),
      title: newCard.title,
      description: "",
      client: newCard.client,
      assignee: newCard.assignee,
      priority: newCard.priority,
      sector: newCard.sector,
      dueDate: new Date().toISOString().split("T")[0],
      tags: [newCard.sector],
      subtasks: [],
      attachments: 0,
      comments: 0,
    };
    setCards(prev => ({ ...prev, todo: [card, ...prev.todo] }));
    setCreateOpen(false);
    setNewCard({ title: "", client: "", assignee: "", priority: "Média", sector: "Contábil" });
    toast.success("Tarefa adicionada ao Kanban");
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Kanban</h1>
            <p className="text-sm text-muted-foreground">Gestão visual de demandas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" /> Filtros</Button>
            <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[280px] w-[280px] shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2 w-2 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">{cards[col.id].length}</span>
              </div>
              <div className="space-y-2">
                {cards[col.id].map((card, i) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border bg-card p-3.5 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => { setSelectedCard(card); setSelectedStatus(col.id); setSheetOpen(true); }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium leading-tight">{card.title}</span>
                      <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${priorityDot[card.priority]}`} />
                    </div>
                    <div className="text-xs text-muted-foreground">{card.client}</div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{card.sector}</span>
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-primary">{card.assignee.split(" ").map((n) => n[0]).join("")}</span>
                      </div>
                    </div>
                    {card.subtasks.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((card.subtasks.filter(s => s.done).length / card.subtasks.length) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{card.subtasks.filter(s => s.done).length}/{card.subtasks.length}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TaskDetailSheet task={taskForSheet} open={sheetOpen} onOpenChange={setSheetOpen} onSubtaskToggle={handleSubtaskToggle} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa no Kanban</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input placeholder="Ex: Fechamento contábil" value={newCard.title} onChange={e => setNewCard(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={newCard.client} onChange={e => setNewCard(p => ({ ...p, client: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input placeholder="Nome" value={newCard.assignee} onChange={e => setNewCard(p => ({ ...p, assignee: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newCard.sector} onChange={e => setNewCard(p => ({ ...p, sector: e.target.value }))}>
                  {["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newCard.priority} onChange={e => setNewCard(p => ({ ...p, priority: e.target.value as KanbanCard["priority"] }))}>
                  {["Urgente", "Alta", "Média", "Baixa"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
