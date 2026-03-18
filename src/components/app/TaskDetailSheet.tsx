import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  User,
  Building2,
  FolderOpen,
  Paperclip,
  MessageSquare,
  Tag,
  Clock,
  Send,
  Edit,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface Task {
  id: string;
  title: string;
  description: string;
  client: string;
  sector: string;
  assignee: string;
  priority: string;
  dueDate: string;
  status: string;
  tags: string[];
  subtasks: { title: string; done: boolean }[];
  attachments: number;
  comments: number;
}

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubtaskToggle?: (taskId: string, subtaskIndex: number) => void;
}

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgente: { color: "text-destructive", bg: "bg-destructive/10" },
  Alta: { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/20" },
  Média: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Baixa: { color: "text-muted-foreground", bg: "bg-muted" },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  Pendente: { color: "text-muted-foreground", bg: "bg-muted" },
  "Em andamento": { color: "text-primary", bg: "bg-primary/10" },
  "Em revisão": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Concluído: { color: "text-primary", bg: "bg-primary/10" },
  Atrasado: { color: "text-destructive", bg: "bg-destructive/10" },
};

const mockComments = [
  { author: "Maria Santos", text: "Já iniciei a conciliação das contas principais.", time: "Há 2 horas" },
  { author: "Carlos Ribeiro", text: "Preciso do extrato do Banco X para continuar.", time: "Há 1 hora" },
  { author: "Ana Lima", text: "Enviei os documentos pendentes por e-mail.", time: "Há 30 min" },
];

export function TaskDetailSheet({ task, open, onOpenChange, onSubtaskToggle }: TaskDetailSheetProps) {
  const [comment, setComment] = useState("");

  if (!task) return null;

  const subtaskDone = task.subtasks.filter(s => s.done).length;
  const subtaskPct = Math.round((subtaskDone / task.subtasks.length) * 100);
  const priority = priorityConfig[task.priority] || priorityConfig.Média;
  const status = statusConfig[task.status] || statusConfig.Pendente;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs border-0 ${priority.color} ${priority.bg}`}>{task.priority}</Badge>
            <Badge variant="outline" className={`text-xs border-0 ${status.color} ${status.bg}`}>{task.status}</Badge>
          </div>
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente</span>
              <span className="text-sm font-medium">{task.client}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Responsável</span>
              <span className="text-sm font-medium">{task.assignee}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Setor</span>
              <span className="text-sm font-medium">{task.sector}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Prazo</span>
              <span className="text-sm font-medium">{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Tag className="h-3 w-3" /> Etiquetas</span>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Subtarefas</span>
              <span className="text-xs text-muted-foreground">{subtaskDone}/{task.subtasks.length} concluídas</span>
            </div>
            <Progress value={subtaskPct} className="h-2 mb-3" />
            <div className="space-y-2">
              {task.subtasks.map((sub, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={sub.done}
                    onCheckedChange={() => onSubtaskToggle?.(task.id, idx)}
                  />
                  <span className={`text-sm ${sub.done ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Attachments */}
          <div>
            <span className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4" /> Anexos ({task.attachments})
            </span>
            <div className="space-y-2">
              {Array.from({ length: Math.min(task.attachments, 3) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">documento_{i + 1}.pdf</div>
                    <div className="text-xs text-muted-foreground">{(120 + i * 80)} KB</div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full gap-1 text-xs">
              <Paperclip className="h-3 w-3" /> Adicionar anexo
            </Button>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <span className="text-sm font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" /> Comentários ({task.comments})
            </span>
            <div className="space-y-3 mb-4">
              {mockComments.slice(0, task.comments || 3).map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-primary">
                      {c.author.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{c.author}</span>
                      <span className="text-xs text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Escrever comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
            <Button size="sm" className="mt-2 gap-1">
              <Send className="h-3 w-3" /> Enviar
            </Button>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1"><Edit className="h-3.5 w-3.5" /> Editar</Button>
            <Button variant="outline" className="text-destructive hover:text-destructive gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
