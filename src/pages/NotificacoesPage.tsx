import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  UserPlus,
  MessageSquare,
  Settings,
  Check,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: string;
  title: string;
  description: string;
  type: "task" | "deadline" | "form" | "system" | "lead" | "comment";
  time: string;
  read: boolean;
}

const initialNotifications: Notification[] = [
  { id: "1", title: "Nova tarefa atribuída", description: "Fechamento contábil - ABC Tecnologia foi atribuída a você", type: "task", time: "Há 5 minutos", read: false },
  { id: "2", title: "Prazo próximo", description: "Declaração IR - Tech Solutions vence em 2 dias", type: "deadline", time: "Há 15 minutos", read: false },
  { id: "3", title: "Formulário recebido", description: "Admissão enviada por João Silva (Startup XYZ)", type: "form", time: "Há 30 minutos", read: false },
  { id: "4", title: "Novo lead capturado", description: "Empresa Delta solicitou contato pelo site", type: "lead", time: "Há 1 hora", read: false },
  { id: "5", title: "Comentário em tarefa", description: "Maria Santos comentou em BPO Financeiro - Março", type: "comment", time: "Há 2 horas", read: true },
  { id: "6", title: "Prazo vencido", description: "5 tarefas com prazo vencido precisam de atenção", type: "deadline", time: "Há 3 horas", read: true },
  { id: "7", title: "Novo cliente ativado", description: "Nova Empresa Ltda foi ativada no sistema", type: "system", time: "Há 5 horas", read: true },
  { id: "8", title: "Formulário concluído", description: "Processo de férias de Pedro Santos foi finalizado", type: "form", time: "Ontem", read: true },
  { id: "9", title: "Relatório disponível", description: "Relatório de produtividade de fevereiro está pronto", type: "system", time: "Ontem", read: true },
  { id: "10", title: "Nova demanda", description: "Carlos Ribeiro criou nova demanda de departamento pessoal", type: "task", time: "2 dias atrás", read: true },
];

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  task: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  deadline: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  form: { icon: FileText, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/20" },
  system: { icon: Settings, color: "text-muted-foreground", bg: "bg-muted" },
  lead: { icon: UserPlus, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  comment: { icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/20" },
};

export default function NotificacoesPage() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              Notificações
              {unreadCount > 0 && <Badge className="bg-destructive text-destructive-foreground">{unreadCount}</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">Centro de alertas e atualizações do sistema</p>
          </div>
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1">
            <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Todas</Button>
          <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>Não lidas ({unreadCount})</Button>
        </div>

        {/* Notification list */}
        <div className="space-y-2">
          {filtered.map((notif, i) => {
            const cfg = typeConfig[notif.type];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => markRead(notif.id)}
                className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-sm ${!notif.read ? "bg-primary/5 border-primary/20" : "bg-card"}`}
              >
                <div className={`h-9 w-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`text-sm ${!notif.read ? "font-semibold" : "font-medium"}`}>{notif.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{notif.description}</p>
                    </div>
                    {!notif.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1.5 block">{notif.time}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
