import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePriorityNotifications } from "@/hooks/usePriorityNotifications";
import {
  disablePushOnCurrentDevice,
  getPushUnsupportedMessage,
  getPushSubscriptionStatus,
  subscribePushOnCurrentDevice,
  syncPushSubscriptionOnServer,
  type PushSubscriptionStatus,
} from "@/lib/pushNotifications";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  FolderPlus,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Smartphone,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

const priorityLabel: Record<"alta" | "media" | "baixa", string> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

const filterLabels: Record<NotificationFilter, string> = {
  all: "Todas",
  unread: "Nao lidas",
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

export default function NotificacoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  } = usePriorityNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus>({
    supported: false,
    hasPublicKey: false,
    permission: "unsupported",
    subscribed: false,
    endpoint: null,
    unsupportedReason: null,
  });
  const [pushActionLoading, setPushActionLoading] = useState<"enable" | "disable" | null>(null);

  const loadPushStatus = useCallback(async () => {
    try {
      const status = await getPushSubscriptionStatus();
      setPushStatus(status);
      if (status.subscribed && user?.id) {
        try {
          await syncPushSubscriptionOnServer(user.id);
        } catch {
          // Mantem o estado local mesmo se a sincronizacao remota falhar.
        }
      }
    } catch {
      setPushStatus((prev) => ({ ...prev, supported: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPushStatus();
  }, [loadPushStatus]);

  const notificationCounts = useMemo(() => {
    const counts = {
      all: notifications.length,
      unread: unreadCount,
      alta: 0,
      media: 0,
      baixa: 0,
    };

    notifications.forEach((notification) => {
      if (notification.priority === "alta") counts.alta += 1;
      if (notification.priority === "media") counts.media += 1;
      if (notification.priority === "baixa") counts.baixa += 1;
    });

    return counts;
  }, [notifications, unreadCount]);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((notification) => !notification.read);
    return notifications.filter((notification) => notification.priority === filter);
  }, [filter, notifications]);

  const pushStatusLabel = useMemo(() => {
    if (!pushStatus.supported) return getPushUnsupportedMessage(pushStatus.unsupportedReason);
    if (!pushStatus.hasPublicKey) return "Chave publica VAPID sera carregada ao ativar.";
    if (pushStatus.permission === "denied") return "Permissao bloqueada no navegador.";
    if (pushStatus.permission !== "granted") return "Permissao ainda nao concedida.";
    if (!pushStatus.subscribed) return "Pronto para ativar neste dispositivo.";
    return "Ativo para este dispositivo.";
  }, [pushStatus]);

  const handleEnablePush = async () => {
    if (!user?.id) {
      toast.error("Usuario nao autenticado.");
      return;
    }

    setPushActionLoading("enable");
    try {
      await subscribePushOnCurrentDevice(user.id);
      toast.success("Notificacoes push ativadas neste dispositivo.");
      await loadPushStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ativar push.";
      toast.error(message);
    } finally {
      setPushActionLoading(null);
    }
  };

  const handleDisablePush = async () => {
    if (!user?.id) {
      toast.error("Usuario nao autenticado.");
      return;
    }

    setPushActionLoading("disable");
    try {
      await disablePushOnCurrentDevice(user.id);
      toast.success("Notificacoes push desativadas neste dispositivo.");
      await loadPushStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao desativar push.";
      toast.error(message);
    } finally {
      setPushActionLoading(null);
    }
  };

  const openNotificationTask = (notificationId: string, taskId: string) => {
    markAsRead(notificationId);
    const targetUrl = notificationId.startsWith("whatsapp-")
      ? `/app/whatsapp?conversation=${encodeURIComponent(taskId)}`
      : `/app/tarefas?task=${encodeURIComponent(taskId)}`;
    navigate(targetUrl);
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <section className="rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-bold tracking-tight">Notificacoes</h1>
                {unreadCount > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground">
                    {unreadCount} nao lidas
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Alertas de tarefas atrasadas, vencimentos do dia e pendencias sem responsavel.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[21rem]">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{notificationCounts.all}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Nao lidas</p>
                <p className="text-lg font-semibold">{notificationCounts.unread}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">Alta</p>
                <p className="text-lg font-semibold">{notificationCounts.alta}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card px-4 py-3 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Push no dispositivo</h2>
                <Badge variant={pushStatus.subscribed ? "default" : "outline"} className="h-5 px-2 text-[11px]">
                  {pushStatus.subscribed ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{pushStatusLabel}</p>
            </div>

            <div className="w-full sm:w-auto">
              {pushStatus.subscribed ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full px-4 sm:min-w-32"
                  onClick={() => void handleDisablePush()}
                  disabled={pushActionLoading !== null}
                >
                  {pushActionLoading === "disable" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Desativar push
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 w-full px-4 sm:min-w-32"
                  onClick={() => void handleEnablePush()}
                  disabled={
                    pushActionLoading !== null ||
                    !pushStatus.supported
                  }
                >
                  {pushActionLoading === "enable" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Ativar push
                </Button>
              )}
            </div>
          </div>

          {pushStatus.permission === "denied" && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              O navegador bloqueou notificacoes. Libere nas configuracoes do site/app.
            </p>
          )}
          {!pushStatus.hasPublicKey && pushStatus.supported && (
            <p className="mt-2 text-xs text-muted-foreground">
              Se a ativacao falhar, confirme se <code>runtime-config.js</code> atualizado foi publicado e se a
              Edge Function <code>send-push-notification</code> foi redeployada.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Central de alertas
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "unread", "alta", "media", "baixa"] as NotificationFilter[]).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={filter === item ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 rounded-full px-3"
                  onClick={() => setFilter(item)}
                >
                  {filterLabels[item]}
                  <span className="text-[11px] opacity-75">{notificationCounts[item]}</span>
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void refresh()} className="h-8 gap-1">
                <RefreshCcw className="h-3.5 w-3.5" /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-8 gap-1">
                <CheckCheck className="h-3.5 w-3.5" /> Lidas
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center rounded-xl border bg-card py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Nenhuma notificacao neste filtro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando houver novos alertas operacionais, eles aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              {filteredNotifications.map((notification, index) => {
                const kindIcon =
                  notification.kind === "overdue"
                    ? AlertTriangle
                    : notification.kind === "due_today"
                      ? Clock3
                      : notification.kind === "completed"
                        ? Check
                        : notification.kind === "sector_added"
                          ? FolderPlus
                          : notification.kind === "internal_message" || notification.kind === "client_chat"
                            ? MessageSquare
                            : UserX;
                const KindIcon = kindIcon;

                const priorityClass =
                  notification.priority === "alta"
                    ? "bg-destructive/10 text-destructive"
                    : notification.priority === "media"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                      : "bg-muted text-muted-foreground";

                return (
                  <motion.button
                    key={notification.id}
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => openNotificationTask(notification.id, notification.taskId)}
                    className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40 sm:px-5 ${
                      notification.read ? "bg-card" : "bg-primary/5"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${priorityClass}`}>
                      <KindIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={`text-sm ${notification.read ? "font-medium" : "font-semibold"}`}>
                            {notification.title}
                          </h3>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notification.description}
                          </p>
                        </div>
                        {!notification.read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Nao lida" />
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{toRelativeTime(notification.createdAt)}</span>
                        <Badge variant="outline" className="h-5 border-0 bg-muted px-2 text-[10px]">
                          {priorityLabel[notification.priority]}
                        </Badge>
                        {notification.read && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" />
                            Lida
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
