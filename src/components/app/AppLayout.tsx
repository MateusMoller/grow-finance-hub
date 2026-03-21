import { ReactNode, useMemo, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, LogOut, Search, Settings, UserRound } from "lucide-react";
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

interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  read: boolean;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<HeaderNotification[]>([
    { id: "1", title: "Nova solicitação recebida", time: "Agora", read: false },
    { id: "2", title: "Tarefa com prazo próximo", time: "Há 20 min", read: false },
    { id: "3", title: "Documento enviado por cliente", time: "Há 1h", read: true },
  ]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const userInitials = useMemo(() => {
    const fallback = "U";
    if (!user?.email) return fallback;
    const username = user.email.split("@")[0] || fallback;
    return username.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-48"
                  placeholder="Buscar..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificações</span>
                    <span className="text-xs text-muted-foreground">{unreadCount} não lidas</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                        onClick={() => {
                          markAsRead(notification.id);
                          navigate("/app/notificacoes");
                        }}
                      >
                        <span className={`text-sm ${notification.read ? "text-muted-foreground" : "font-medium"}`}>
                          {notification.title}
                        </span>
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={markAllAsRead}>Marcar todas como lidas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/notificacoes")}>
                    Ver central de notificações
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user?.email || "Usuário"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
                    <UserRound className="h-4 w-4 mr-2" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/configuracoes")}>
                    <Settings className="h-4 w-4 mr-2" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/notificacoes")}>
                    <Bell className="h-4 w-4 mr-2" /> Notificações
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
          <main className="flex-1 overflow-auto p-6 bg-muted/20">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
