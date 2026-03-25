import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, Check, Clock3, Loader2, RefreshCcw, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePriorityNotifications } from "@/hooks/usePriorityNotifications";

type NotificationFilter = "all" | "unread" | "alta" | "media" | "baixa";

const toRelativeTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `Ha ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Ha ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Ha ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR");
};

export default function NotificacoesPage() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  } = usePriorityNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((notification) => !notification.read);
    return notifications.filter((notification) => notification.priority === filter);
  }, [filter, notifications]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              Notificacoes
              {unreadCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground">{unreadCount}</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Alertas priorizados: atrasadas, vencendo hoje e tarefas sem responsavel
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()} className="gap-1">
              <RefreshCcw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Todas
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Nao lidas ({unreadCount})
          </Button>
          <Button variant={filter === "alta" ? "default" : "outline"} size="sm" onClick={() => setFilter("alta")}>
            Prioridade alta
          </Button>
          <Button variant={filter === "media" ? "default" : "outline"} size="sm" onClick={() => setFilter("media")}>
            Prioridade media
          </Button>
          <Button variant={filter === "baixa" ? "default" : "outline"} size="sm" onClick={() => setFilter("baixa")}>
            Prioridade baixa
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nenhuma notificacao para este filtro</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando surgirem novos alertas de prioridade, eles aparecerao aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification, index) => {
              const kindIcon =
                notification.kind === "overdue"
                  ? AlertTriangle
                  : notification.kind === "due_today"
                    ? Clock3
                    : UserX;
              const KindIcon = kindIcon;

              const priorityClass =
                notification.priority === "alta"
                  ? "text-destructive bg-destructive/10"
                  : notification.priority === "media"
                    ? "text-amber-700 bg-amber-100 dark:bg-amber-900/20"
                    : "text-muted-foreground bg-muted";

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => markAsRead(notification.id)}
                  className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-sm ${
                    notification.read ? "bg-card" : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${priorityClass}`}>
                    <KindIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`text-sm ${notification.read ? "font-medium" : "font-semibold"}`}>
                          {notification.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{notification.description}</p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">{toRelativeTime(notification.createdAt)}</span>
                      <Badge variant="outline" className="text-[10px] border-0 bg-muted">
                        {notification.priority}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
