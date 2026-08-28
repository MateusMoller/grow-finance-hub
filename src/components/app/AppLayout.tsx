import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import {
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  FolderPlus,
  LogOut,
  MessageSquare,
  PlusCircle,
  Search,
  Settings,
  TriangleAlert,
  UserRound,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { useInternalChatNotifications } from "@/hooks/useInternalChatNotifications";
import { usePriorityNotifications } from "@/hooks/usePriorityNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { hasAnyInternalRole, normalizeRoles } from "@/lib/accessControl";
import {
  canAccessModule,
  resolveRouteModule,
  type EffectiveAccess,
} from "@/lib/userPermissions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { restorePushSubscriptionIfEnabled } from "@/lib/pushNotifications";
import { normalizePwaAppScopePath, syncPwaModeForPath } from "@/lib/pwaScope";

interface QuickLink {
  title: string;
  url: string;
}

interface UserProfileSummary {
  displayName: string | null;
  avatarUrl: string | null;
}

const toRelativeTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `Há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR");
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const browserNotificationPromptKey = "grow-browser-notification-prompted";

const canUseBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

const showBrowserNotification = async (
  title: string,
  options: NotificationOptions,
  onClick: () => void,
) => {
  if (!canUseBrowserNotifications() || Notification.permission !== "granted") return;

  const data = {
    ...(typeof options.data === "object" && options.data !== null ? options.data : {}),
    url: (options.data as { url?: string } | undefined)?.url || "/app/notificacoes",
  };

  const serviceWorkerRegistration =
    "serviceWorker" in navigator
      ? await syncPwaModeForPath(window.location.pathname)
          .then(() => {
            const scopeUrl = new URL(normalizePwaAppScopePath(), window.location.origin).href;
            return navigator.serviceWorker.getRegistration(scopeUrl);
          })
          .catch(() => null)
      : null;

  if (serviceWorkerRegistration?.active) {
    await serviceWorkerRegistration.showNotification(title, {
      ...options,
      data,
    });
    return;
  }

  const notification = new Notification(title, {
    ...options,
    data,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
    onClick();
  };
};

const buildQuickLinks = (
  effectiveAccess: EffectiveAccess | null,
  hasInternalAccess: boolean,
): QuickLink[] => {
  if (!hasInternalAccess) return [];

  const base = [
    { title: "Dashboard", url: "/app" },
    { title: "Calendário", url: "/app/calendario" },
    { title: "Tarefas", url: "/app/tarefas" },
    { title: "Clientes", url: "/app/clientes" },
    { title: "Vendas", url: "/app/crm" },
    { title: "WhatsApp", url: "/app/whatsapp" },
    { title: "Chat Interno", url: "/app/chat-interno" },
    { title: "Relatórios", url: "/app/relatorios" },
    { title: "Obrigações", url: "/app/obrigacoes" },
    { title: "Notificações", url: "/app/notificacoes" },
    { title: "Usuários", url: "/app/usuarios" },
    { title: "Sugestões", url: "/app/sugestoes" },
    { title: "Configurações", url: "/app/configuracoes" },
  ];

  if (!effectiveAccess) return base;
  return base.filter((item) => {
    const moduleKey = resolveRouteModule(item.url);
    return !moduleKey || canAccessModule(effectiveAccess, moduleKey);
  });
};
export function AppLayout({
  children,
  hideFooter = false,
  flushContentTop = false,
}: {
  children: ReactNode;
  hideFooter?: boolean;
  flushContentTop?: boolean;
}) {
  const { user, role, roles, signOut, effectiveAccess, currentOrganizationId } = useAuth();
  const {
    selectedCompany,
    selectedCompetence,
    setSelectedCompany,
    setSelectedCompetence,
    clearFilters,
    companyOptions,
    competenceOptions,
    loadingOptions,
    formatCompetence,
  } = useGlobalFilters();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    notificationSignal,
    latestRealtimeNotifications,
  } = usePriorityNotifications();
  const {
    unreadCount: internalChatUnreadCount,
    notificationSignal: internalChatNotificationSignal,
    latestRealtimeMessages: latestInternalChatMessages,
  } = useInternalChatNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const normalizedRoleList = normalizeRoles(roles.length > 0 ? roles : role ? [role] : []);
  const hasInternalAccess =
    effectiveAccess?.primaryRole === "admin" ||
    effectiveAccess?.primaryRole === "colaborador" ||
    hasAnyInternalRole(normalizedRoleList);
  const quickLinks = useMemo(
    () => buildQuickLinks(effectiveAccess, hasInternalAccess),
    [effectiveAccess, hasInternalAccess],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileSummary>({
    displayName: null,
    avatarUrl: null,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const shownBrowserNotificationIdsRef = useRef<Set<string>>(new Set());

  const playNotificationSound = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      await context.resume();
    }

    const now = context.currentTime;
    const envelope = context.createGain();
    envelope.connect(context.destination);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    const toneA = context.createOscillator();
    toneA.type = "sine";
    toneA.frequency.setValueAtTime(880, now);
    toneA.frequency.exponentialRampToValueAtTime(720, now + 0.16);
    toneA.connect(envelope);
    toneA.start(now);
    toneA.stop(now + 0.18);

    const toneB = context.createOscillator();
    toneB.type = "sine";
    toneB.frequency.setValueAtTime(960, now + 0.16);
    toneB.frequency.exponentialRampToValueAtTime(760, now + 0.33);
    toneB.connect(envelope);
    toneB.start(now + 0.16);
    toneB.stop(now + 0.35);
  }, []);

  useEffect(() => {
    if (notificationSignal === 0) return;

    void playNotificationSound().catch(() => {
      // Browsers can block autoplay until user interaction; fail silently.
    });
  }, [notificationSignal, playNotificationSound]);

  useEffect(() => {
    if (internalChatNotificationSignal === 0) return;

    void playNotificationSound().catch(() => {
      // Browsers can block autoplay until user interaction; fail silently.
    });
  }, [internalChatNotificationSignal, playNotificationSound]);

  useEffect(() => {
    if (notificationSignal === 0 || latestRealtimeNotifications.length === 0) return;
    if (!canUseBrowserNotifications()) return;

    const requestPermissionFromToast = () => {
      localStorage.setItem(browserNotificationPromptKey, "true");
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          toast.success("Notificacoes do navegador ativadas.");
        } else if (permission === "denied") {
          toast.error("Notificacoes bloqueadas no navegador.");
        }
      });
    };

    if (Notification.permission === "default") {
      const alreadyPrompted = localStorage.getItem(browserNotificationPromptKey) === "true";
      if (!alreadyPrompted) {
        toast("Ative as notificacoes do navegador", {
          description: "Assim os alertas aparecem no canto da tela mesmo com o sistema em segundo plano.",
          action: {
            label: "Ativar",
            onClick: requestPermissionFromToast,
          },
          duration: 10000,
        });
      }
      return;
    }

    if (Notification.permission !== "granted") return;

    const freshNotifications = latestRealtimeNotifications.filter(
      (notification) => !shownBrowserNotificationIdsRef.current.has(notification.id),
    );
    if (freshNotifications.length === 0) return;

    freshNotifications.forEach((notification) => {
      shownBrowserNotificationIdsRef.current.add(notification.id);
    });

    const firstNotification = freshNotifications[0];
    const overflowCount = freshNotifications.length - 1;
    const title =
      overflowCount > 0
        ? `${freshNotifications.length} novas notificacoes`
        : firstNotification.title;
    const body =
      overflowCount > 0
        ? `${firstNotification.title}. E mais ${overflowCount} alerta(s).`
        : firstNotification.description;
    const targetUrl =
      overflowCount > 0
        ? "/app/notificacoes"
        : firstNotification.id.startsWith("whatsapp-")
          ? `/app/whatsapp?conversation=${encodeURIComponent(firstNotification.taskId)}`
          : `/app/tarefas?task=${encodeURIComponent(firstNotification.taskId)}`;

    void showBrowserNotification(
      title,
      {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: overflowCount > 0 ? `grow-notifications-${notificationSignal}` : firstNotification.id,
        renotify: true,
        data: { url: targetUrl },
      },
      () => {
        navigate(targetUrl);
      },
    ).catch(() => undefined);
  }, [latestRealtimeNotifications, navigate, notificationSignal]);

  useEffect(() => {
    if (internalChatNotificationSignal === 0 || latestInternalChatMessages.length === 0) return;
    if (!canUseBrowserNotifications()) return;

    const requestPermissionFromToast = () => {
      localStorage.setItem(browserNotificationPromptKey, "true");
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          toast.success("Notificacoes do navegador ativadas.");
        } else if (permission === "denied") {
          toast.error("Notificacoes bloqueadas no navegador.");
        }
      });
    };

    if (Notification.permission === "default") {
      const alreadyPrompted = localStorage.getItem(browserNotificationPromptKey) === "true";
      if (!alreadyPrompted) {
        toast("Ative as notificacoes do navegador", {
          description: "Assim as mensagens do chat aparecem no canto da tela mesmo com o sistema em segundo plano.",
          action: {
            label: "Ativar",
            onClick: requestPermissionFromToast,
          },
          duration: 10000,
        });
      }
      return;
    }

    if (Notification.permission !== "granted") return;

    const firstMessage = latestInternalChatMessages[0];
    const overflowCount = latestInternalChatMessages.length - 1;
    const title =
      overflowCount > 0
        ? `${latestInternalChatMessages.length} novas mensagens`
        : firstMessage.title;
    const body =
      overflowCount > 0
        ? `${firstMessage.title}. E mais ${overflowCount} mensagem(ns).`
        : firstMessage.body;
    const targetUrl = "/app/chat-interno";

    void showBrowserNotification(
      title,
      {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: overflowCount > 0 ? `grow-internal-chat-${internalChatNotificationSignal}` : firstMessage.id,
        renotify: true,
        data: { url: targetUrl },
      },
      () => {
        navigate(targetUrl);
      },
    ).catch(() => undefined);
  }, [internalChatNotificationSignal, latestInternalChatMessages, navigate]);

  useEffect(() => {
    return () => {
      if (!audioContextRef.current) return;
      void audioContextRef.current.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const restorePush = async () => {
      try {
        await restorePushSubscriptionIfEnabled(user.id, currentOrganizationId);
      } catch {
        if (cancelled) return;
        // A preferencia continua ativa; a tela de notificacoes mostra o erro acionavel.
      }
    };

    void restorePush();

    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUserProfile({ displayName: null, avatarUrl: null });
      return;
    }

    let cancelled = false;

    const loadUserProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setUserProfile({ displayName: null, avatarUrl: null });
        return;
      }

      setUserProfile({
        displayName: data?.display_name?.trim() || null,
        avatarUrl: data?.avatar_url || null,
      });
    };

    void loadUserProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filteredLinks = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return quickLinks;
    return quickLinks.filter((item) => normalizeText(item.title).includes(term));
  }, [quickLinks, searchTerm]);

  const currentPageTitle = useMemo(() => {
    const match = [...quickLinks]
      .sort((a, b) => b.url.length - a.url.length)
      .find((item) => item.url === "/app" ? location.pathname === "/app" : location.pathname.startsWith(item.url));
    return match?.title || "Área interna";
  }, [location.pathname, quickLinks]);

  const userInitials = useMemo(() => {
    const fallback = "U";
    if (!user?.email) return fallback;
    const username = user.email.split("@")[0] || fallback;
    return username.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const userDisplayName = useMemo(() => {
    const metadata = user?.user_metadata as { display_name?: string; full_name?: string; name?: string } | undefined;
    return (
      userProfile.displayName ||
      metadata?.display_name?.trim() ||
      metadata?.full_name?.trim() ||
      metadata?.name?.trim() ||
      user?.email?.split("@")[0] ||
      "Usuário"
    );
  }, [user?.email, user?.user_metadata, userProfile.displayName]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/app/login");
  };

  const openLink = (url: string) => {
    setSearchOpen(false);
    setSearchTerm("");
    navigate(url);
  };

  const sidebarFooterControls = (
    <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-14 min-w-0 flex-1 justify-start gap-2 rounded-2xl border border-sidebar-border/35 bg-sidebar-accent/15 px-2 text-sidebar-foreground shadow-sm transition-all hover:-translate-y-px hover:bg-sidebar-accent/30 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:px-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-primary ring-1 ring-sidebar-border/40">
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userDisplayName} className="h-full w-full object-cover" />
              ) : (
                userInitials
              )}
            </span>
            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-xs font-semibold leading-4">{userDisplayName}</span>
              <span className="block truncate text-[11px] leading-4 text-sidebar-foreground/60">
                {user?.email || "Sem e-mail"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-[min(14rem,calc(100vw-1rem))]">
          <DropdownMenuLabel className="truncate">{user?.email || "Usuário"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
            <UserRound className="mr-2 h-4 w-4" /> Meu perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
            <Settings className="mr-2 h-4 w-4" /> Configurações
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/app/notificacoes")}>
            <Bell className="mr-2 h-4 w-4" /> Notificações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 shrink-0 rounded-xl border border-sidebar-border/35 bg-sidebar-accent/15 text-sidebar-foreground shadow-sm transition-all hover:-translate-y-px hover:bg-sidebar-accent/30">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-[min(20rem,calc(100vw-1rem))]">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificações</span>
            <span className="text-xs text-muted-foreground">{unreadCount} não lidas</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">Sem alertas no momento.</div>
            ) : (
              notifications.slice(0, 12).map((notification) => {
                const kindIcon =
                  notification.kind === "overdue"
                    ? TriangleAlert
                    : notification.kind === "due_today"
                      ? Clock3
                      : notification.kind === "completed"
                        ? Check
                        : notification.kind === "sector_added"
                          ? FolderPlus
                          : notification.kind === "internal_message" || notification.kind === "client_chat"
                            ? MessageSquare
                            : UserX;
                const priorityClass =
                  notification.priority === "alta"
                    ? "text-destructive"
                    : notification.priority === "media"
                      ? "text-amber-600"
                      : "text-muted-foreground";
                const KindIcon = kindIcon;

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex cursor-pointer items-start gap-2 py-2"
                    onClick={() => {
                      markAsRead(notification.id);
                      const targetUrl = notification.id.startsWith("whatsapp-")
                        ? `/app/whatsapp?conversation=${encodeURIComponent(notification.taskId)}`
                        : `/app/tarefas?task=${encodeURIComponent(notification.taskId)}`;
                      navigate(targetUrl);
                    }}
                  >
                    <KindIcon className={`mt-0.5 h-4 w-4 ${priorityClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${notification.read ? "text-muted-foreground" : "font-medium"}`}>
                        {notification.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{notification.description}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {toRelativeTime(notification.createdAt)}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={markAllAsRead}>Marcar todas como lidas</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/app/notificacoes")}>
            Ver central de notificações
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  return (
    <SidebarProvider>
      <div className="app-shell min-h-screen flex w-full bg-background">
        <AppSidebar
          footerControls={sidebarFooterControls}
          internalChatUnreadCount={internalChatUnreadCount}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="app-topbar flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur-xl md:px-5">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground" />
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-semibold text-foreground">{currentPageTitle}</p>
                <p className="text-[11px] text-muted-foreground">Grow Finance Hub</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-transparent bg-muted/45 px-3 transition-colors focus-within:border-border focus-within:bg-background">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground lg:w-60"
                  placeholder="Buscar páginas..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredLinks[0]) {
                      openLink(filteredLinks[0].url);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main
            className={
              flushContentTop
                ? "app-workspace-content flex-1 overflow-auto px-0 pb-0 pt-0 [&>div]:mx-auto [&>div]:min-w-0 [&>div]:w-full"
                : "app-standard-content flex-1 overflow-auto p-3 sm:p-4 lg:p-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6 [&>div]:w-full [&>div]:mx-auto [&>div]:min-w-0"
            }
          >
            {children}
          </main>

          {!hideFooter && (
            <footer className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground mb-[calc(env(safe-area-inset-bottom)+4rem)] md:mb-0">
              Grow Finance Hub - Área interna
            </footer>
          )}

          <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur md:hidden z-30">
            <div
              className="grid grid-cols-3 px-1 pb-[calc(env(safe-area-inset-bottom)+0.125rem)]"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.125rem)" }}
            >
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <Filter className="h-4 w-4" />
                Filtros
              </button>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-primary font-semibold"
                onClick={() => navigate("/app/tarefas?create=1")}
              >
                <PlusCircle className="h-4 w-4" />
                Nova tarefa
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-md max-h-[85svh]">
          <DialogHeader>
            <DialogTitle>Busca rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
              placeholder="Buscar página..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredLinks.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhuma página encontrada.
                </div>
              ) : (
                filteredLinks.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => openLink(item.url)}
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>Filtros globais</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Empresa</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
                value={selectedCompany || ""}
                onChange={(event) => setSelectedCompany(event.target.value || null)}
              >
                <option value="">Total</option>
                {companyOptions.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Competência</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
                value={selectedCompetence || ""}
                onChange={(event) => setSelectedCompetence(event.target.value || null)}
              >
                <option value="">Total</option>
                {competenceOptions.map((competence) => (
                  <option key={competence} value={competence}>
                    {formatCompetence(competence)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
              <Button className="flex-1" onClick={() => setMobileFiltersOpen(false)}>
                Aplicar
              </Button>
            </div>
            {loadingOptions && <p className="text-xs text-muted-foreground">Atualizando opções...</p>}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
