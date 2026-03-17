import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter } from "lucide-react";

type KanbanStatus = "backlog" | "todo" | "doing" | "review" | "done";

interface KanbanCard {
  id: string;
  title: string;
  client: string;
  assignee: string;
  priority: "Alta" | "Média" | "Baixa";
  sector: string;
}

const columns: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", color: "bg-grow-gold" },
  { id: "doing", label: "Em Andamento", color: "bg-primary" },
  { id: "review", label: "Revisão", color: "bg-grow-emerald-light" },
  { id: "done", label: "Concluído", color: "bg-primary" },
];

const initialCards: Record<KanbanStatus, KanbanCard[]> = {
  backlog: [
    { id: "1", title: "Importar extratos bancários", client: "ABC Ltda", assignee: "Carlos R.", priority: "Média", sector: "Financeiro" },
  ],
  todo: [
    { id: "2", title: "Fechamento contábil março", client: "Tech Corp", assignee: "Maria S.", priority: "Alta", sector: "Contábil" },
    { id: "3", title: "Cadastrar novo colaborador", client: "StartupXYZ", assignee: "Ana L.", priority: "Média", sector: "DP" },
  ],
  doing: [
    { id: "4", title: "Declaração IR PJ", client: "ABC Ltda", assignee: "Maria S.", priority: "Alta", sector: "Fiscal" },
    { id: "5", title: "Fluxo de caixa semanal", client: "Global Trade", assignee: "Lucas M.", priority: "Média", sector: "Financeiro" },
  ],
  review: [
    { id: "6", title: "Proposta comercial", client: "Nova Empresa", assignee: "Pedro S.", priority: "Alta", sector: "Comercial" },
  ],
  done: [
    { id: "7", title: "Admissão concluída", client: "Tech Corp", assignee: "Ana L.", priority: "Baixa", sector: "DP" },
  ],
};

const priorityDot: Record<string, string> = {
  Alta: "bg-destructive",
  Média: "bg-grow-gold",
  Baixa: "bg-muted-foreground",
};

export default function KanbanPage() {
  const [cards] = useState(initialCards);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Kanban</h1>
            <p className="text-sm text-muted-foreground">Gestão visual de demandas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" /> Filtros
            </Button>
            <Button variant="default" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
            </Button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[280px] w-[280px] shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2 w-2 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {cards[col.id].length}
                </span>
              </div>
              <div className="space-y-2">
                {cards[col.id].map((card, i) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border bg-card p-3.5 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium leading-tight">{card.title}</span>
                      <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${priorityDot[card.priority]}`} />
                    </div>
                    <div className="text-xs text-muted-foreground">{card.client}</div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {card.sector}
                      </span>
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-primary">
                          {card.assignee.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
