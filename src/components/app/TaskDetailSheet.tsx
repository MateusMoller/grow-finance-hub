import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CalendarDays,
  User,
  Building2,
  FolderOpen,
  Paperclip,
  MessageSquare,
  Tag,
  Send,
  Edit,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ChangeHistoryEntry } from "@/lib/changeHistory";

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
  onDeleteTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onCommentCountChange?: (taskId: string, count: number) => void;
  onAttachmentCountChange?: (taskId: string, count: number) => void;
  actorName?: string;
  historyEntries?: ChangeHistoryEntry[];
}

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgente: { color: "text-destructive", bg: "bg-destructive/10" },
  Alta: { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/20" },
  Media: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  "Média": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Baixa: { color: "text-muted-foreground", bg: "bg-muted" },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  Pendente: { color: "text-muted-foreground", bg: "bg-muted" },
  "Em andamento": { color: "text-primary", bg: "bg-primary/10" },
  "Em revisao": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  "Em revisão": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Concluido: { color: "text-primary", bg: "bg-primary/10" },
  "Concluído": { color: "text-primary", bg: "bg-primary/10" },
  Atrasado: { color: "text-destructive", bg: "bg-destructive/10" },
};

interface TaskCommentItem {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface TaskAttachmentItem {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
}

interface TaskDetailLocalData {
  comments: TaskCommentItem[];
  attachments: TaskAttachmentItem[];
}

const safeParseTaskData = (rawValue: string | null): TaskDetailLocalData => {
  if (!rawValue) {
    return { comments: [], attachments: [] };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TaskDetailLocalData>;
    return {
      comments: Array.isArray(parsed.comments)
        ? parsed.comments.filter((item): item is TaskCommentItem => {
            if (!item || typeof item !== "object") return false;
            return (
              typeof item.id === "string" &&
              typeof item.author === "string" &&
              typeof item.text === "string" &&
              typeof item.createdAt === "string"
            );
          })
        : [],
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((item): item is TaskAttachmentItem => {
            if (!item || typeof item !== "object") return false;
            return (
              typeof item.id === "string" &&
              typeof item.fileName === "string" &&
              typeof item.size === "number" &&
              typeof item.createdAt === "string"
            );
          })
        : [],
    };
  } catch {
    return { comments: [], attachments: [] };
  }
};

const buildStorageKey = (taskId: string) => `grow-task-detail-${taskId}`;

const formatRelativeTime = (isoDate: string) => {
  const nowMs = Date.now();
  const valueMs = new Date(isoDate).getTime();
  if (Number.isNaN(valueMs)) return "Agora";

  const diffMinutes = Math.max(0, Math.floor((nowMs - valueMs) / 60000));
  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Ha ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Ha ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Ha ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
};

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onSubtaskToggle,
  onDeleteTask,
  onEditTask,
  onCommentCountChange,
  onAttachmentCountChange,
  actorName,
  historyEntries = [],
}: TaskDetailSheetProps) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<TaskCommentItem[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taskId = task?.id;

  const saveTaskLocalData = (taskId: string, nextComments: TaskCommentItem[], nextAttachments: TaskAttachmentItem[]) => {
    localStorage.setItem(
      buildStorageKey(taskId),
      JSON.stringify({
        comments: nextComments.slice(0, 100),
        attachments: nextAttachments.slice(0, 100),
      }),
    );
  };

  useEffect(() => {
    if (!taskId) return;
    const stored = safeParseTaskData(localStorage.getItem(buildStorageKey(taskId)));
    setComments(stored.comments);
    setAttachments(stored.attachments);
    setComment("");
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    onCommentCountChange?.(taskId, comments.length);
  }, [comments.length, onCommentCountChange, taskId]);

  useEffect(() => {
    if (!taskId) return;
    onAttachmentCountChange?.(taskId, attachments.length);
  }, [attachments.length, onAttachmentCountChange, taskId]);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [comments],
  );

  const handleSendComment = () => {
    if (!task) return;
    const normalizedComment = comment.trim();
    if (!normalizedComment) {
      toast.error("Escreva um comentario antes de enviar.");
      return;
    }

    const nextComment: TaskCommentItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: actorName || "Equipe",
      text: normalizedComment,
      createdAt: new Date().toISOString(),
    };

    const nextComments = [nextComment, ...comments];
    setComments(nextComments);
    saveTaskLocalData(task.id, nextComments, attachments);
    setComment("");
    toast.success("Comentario enviado.");
  };

  const handleAttachmentSelection = (event: ChangeEvent<HTMLInputElement>) => {
    if (!task) return;
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const nextAttachments = [
      ...attachments,
      ...Array.from(selectedFiles).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        size: file.size,
        createdAt: new Date().toISOString(),
      })),
    ];

    setAttachments(nextAttachments);
    saveTaskLocalData(task.id, comments, nextAttachments);
    event.target.value = "";
    toast.success(
      selectedFiles.length === 1
        ? "Anexo adicionado com sucesso."
        : `${selectedFiles.length} anexos adicionados com sucesso.`,
    );
  };

  if (!task) return null;

  const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;
  const subtaskPct = task.subtasks.length ? Math.round((subtaskDone / task.subtasks.length) * 100) : 0;
  const priority = priorityConfig[task.priority] || priorityConfig.Media;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente</span>
              <span className="text-sm font-medium">{task.client || "Sem cliente"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Responsavel</span>
              <span className="text-sm font-medium">{task.assignee || "Sem responsavel"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Setor</span>
              <span className="text-sm font-medium">{task.sector}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Prazo</span>
              <span className="text-sm font-medium">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "Sem prazo"}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Tag className="h-3 w-3" /> Etiquetas</span>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Subtarefas</span>
              <span className="text-xs text-muted-foreground">{subtaskDone}/{task.subtasks.length} concluidas</span>
            </div>
            <Progress value={subtaskPct} className="h-2 mb-3" />
            <div className="space-y-2">
              {task.subtasks.map((subtask, index) => (
                <label
                  key={`${task.id}-${index}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={subtask.done}
                    onCheckedChange={() => onSubtaskToggle?.(task.id, index)}
                  />
                  <span className={`text-sm ${subtask.done ? "line-through text-muted-foreground" : ""}`}>{subtask.title}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <span className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4" /> Anexos ({attachments.length})
            </span>
            {attachments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum anexo adicionado.
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{attachment.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {attachment.size > 0 ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : "Tamanho nao informado"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleAttachmentSelection}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full gap-1 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-3 w-3" /> Adicionar anexo
            </Button>
          </div>

          <Separator />

          <div>
            <span className="text-sm font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" /> Comentarios ({comments.length})
            </span>
            {sortedComments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground mb-4">
                Nenhum comentario registrado.
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {sortedComments.map((commentItem) => (
                  <div key={commentItem.id} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-primary">
                        {commentItem.author
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((name) => name[0]?.toUpperCase() || "")
                          .join("")}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{commentItem.author}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(commentItem.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{commentItem.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                placeholder="Escrever comentario..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
            <Button type="button" size="sm" className="mt-2 gap-1" onClick={handleSendComment}>
              <Send className="h-3 w-3" /> Enviar
            </Button>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">Historico de alteracoes</h3>
            {historyEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Nenhuma alteracao registrada.
              </div>
            ) : (
              <div className="space-y-2">
                {historyEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{entry.action}</div>
                    {entry.details && <div className="text-xs text-muted-foreground mt-0.5">{entry.details}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")} - {entry.actor}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => {
                if (onEditTask) {
                  onEditTask(task.id);
                  return;
                }
                toast.info("Edicao direta desta tela ainda nao esta disponivel.");
              }}
            >
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive gap-1"
              onClick={() => onDeleteTask?.(task.id)}
              disabled={!onDeleteTask}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

