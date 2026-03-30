import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import {
  Bell,
  Clock3,
  Filter,
  LogOut,
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { usePriorityNotifications } from "@/hooks/usePriorityNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface QuickLink {
  title: string;
  url: string;
}

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

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const buildQuickLinks = (isDepartmentRole: boolean, role: string | null): QuickLink[] => {
  const base = [
    { title: "Dashboard", url: "/app" },
    { title: "Kanban", url: "/app/kanban" },
    { title: "Calendario", url: "/app/calendario" },
    { title: "Tarefas", url: "/app/tarefas" },
    { title: "Clientes", url: "/app/clientes" },
    { title: "Atendimento Portal", url: "/app/solicitacoes" },
    { title: "Formularios", url: "/app/formularios" },
    { title: "CRM", url: "/app/crm" },
    { title: "Chat Interno", url: "/app/chat-interno" },
    { title: "Relatorios", url: "/app/relatorios" },
    { title: "Notificacoes", url: "/app/notificacoes" },
    { title: "Usuarios", url: "/app/usuarios" },
    { title: "Configuracoes", url: "/app/configuracoes" },
    { title: "Manual de uso", url: "/app/manual" },
  ];

  if (role !== "admin") {
    const withoutUsers = base.filter((item) => item.url !== "/app/usuarios");
    if (!isDepartmentRole) return withoutUsers;

    return withoutUsers.filter((item) =>
      item.url === "/app/kanban" ||
      item.url === "/app/calendario" ||
        item.url === "/app/tarefas" ||
        item.url === "/app/clientes" ||
        item.url === "/app/solicitacoes" ||
        item.url === "/app/chat-interno" ||
        item.url === "/app/manual",
    );
  }

  if (!isDepartmentRole) return base;

  return base.filter((item) =>
    item.url === "/app/kanban" ||
    item.url === "/app/calendario" ||
      item.url === "/app/tarefas" ||
      item.url === "/app/clientes" ||
      item.url === "/app/solicitacoes" ||
      item.url === "/app/chat-interno" ||
      item.url === "/app/manual",
  );
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
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
  } = usePriorityNotifications();

  const navigate = useNavigate();
  const isDepartmentRole = role === "departamento_pessoal" || role === "fiscal" || role === "contabil";
  const quickLinks = useMemo(() => buildQuickLinks(isDepartmentRole, role), [isDepartmentRole, role]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

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
    return () => {
      if (!audioContextRef.current) return;
      void audioContextRef.current.close();
      audioContextRef.current = null;
    };
  }, []);

  const filteredLinks = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return quickLinks;
    return quickLinks.filter((item) => normalizeText(item.title).includes(term));
  }, [quickLinks, searchTerm]);

  const userInitials = useMemo(() => {
    const fallback = "U";
    if (!user?.email) return fallback;
    const username = user.email.split("@")[0] || fallback;
    return username.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const openLink = (url: string) => {
    setSearchOpen(false);
    setSearchTerm("");
    navigate(url);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b px-3 md:px-4 bg-card shrink-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger />
              <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-44 lg:w-56"
                  placeholder="Buscar paginas..."
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
              <div className="hidden lg:flex items-center gap-2">
                <select
                  className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm outline-none"
                  value={selectedCompany || ""}
                  onChange={(event) => setSelectedCompany(event.target.value || null)}
                >
                  <option value="">Empresa: Total</option>
                  {companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 min-w-[190px] rounded-md border bg-background px-3 text-sm outline-none"
                  value={selectedCompetence || ""}
                  onChange={(event) => setSelectedCompetence(event.target.value || null)}
                >
                  <option value="">Competencia: Total</option>
                  {competenceOptions.map((competence) => (
                    <option key={competence} value={competence}>
                      {formatCompetence(competence)}
                    </option>
                  ))}
                </select>
                {loadingOptions && (
                  <span className="text-xs text-muted-foreground">Atualizando filtros...</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1rem))]">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificacoes</span>
                    <span className="text-xs text-muted-foreground">{unreadCount} nao lidas</span>
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
                            className="flex items-start gap-2 py-2 cursor-pointer"
                            onClick={() => {
                              markAsRead(notification.id);
                              navigate("/app/notificacoes");
                            }}
                          >
                            <KindIcon className={`h-4 w-4 mt-0.5 ${priorityClass}`} />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm ${notification.read ? "text-muted-foreground" : "font-medium"}`}>
                                {notification.title}
                              </div>
                              <div className="text-xs text-muted-foreground">{notification.description}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
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
                    Ver central de notificacoes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <span className="text-xs font-semibold">{userInitials}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(14rem,calc(100vw-1rem))]">
                  <DropdownMenuLabel className="truncate">{user?.email || "Usuario"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
                    <UserRound className="h-4 w-4 mr-2" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
                    <Settings className="h-4 w-4 mr-2" /> Configuracoes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/notificacoes")}>
                    <Bell className="h-4 w-4 mr-2" /> Notificacoes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-muted/20 p-3 sm:p-4 lg:p-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6 [&>div]:w-full [&>div]:mx-auto [&>div]:min-w-0">
            {children}
          </main>

          <footer className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground mb-[calc(env(safe-area-inset-bottom)+4rem)] md:mb-0">
            Grow Finance Hub - Area interna
          </footer>

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
            <DialogTitle>Busca rapida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
              placeholder="Buscar pagina..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredLinks.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhuma pagina encontrada.
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
              <label className="text-sm font-medium">Competencia</label>
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
            {loadingOptions && <p className="text-xs text-muted-foreground">Atualizando opcoes...</p>}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
