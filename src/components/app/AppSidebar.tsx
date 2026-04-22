import {
  LayoutDashboard,
  Users,
  FileText,
  KanbanSquare,
  CalendarDays,
  BarChart3,
  FileSpreadsheet,
  Bell,
  Settings,
  TrendingUp,
  ClipboardList,
  Headset,
  BookOpenText,
  Newspaper,
  MessagesSquare,
  UserCog,
  Lightbulb,
  Send,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import growIcon from "@/assets/grow-icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { hasAnyInternalRole, isDepartmentOnlyUser, normalizeRoles } from "@/lib/accessControl";

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Kanban", url: "/app/kanban", icon: KanbanSquare },
  { title: "CalendÃ¡rio", url: "/app/calendario", icon: CalendarDays },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];

const operationalItems = [
  { title: "Atendimento Portal", url: "/app/solicitacoes", icon: Headset },
  { title: "FormulÃ¡rios", url: "/app/formularios", icon: FileText },
  { title: "CRM", url: "/app/crm", icon: TrendingUp },
  { title: "Chat Interno", url: "/app/chat-interno", icon: MessagesSquare },
  { title: "Newsletter", url: "/app/newsletter", icon: Newspaper },
  { title: "RelatÃ³rios", url: "/app/relatorios", icon: BarChart3 },
  { title: "ObrigaÃ§Ãµes", url: "/app/obrigacoes", icon: FileSpreadsheet },
  { title: "E-continuo", url: "/app/econtinuo", icon: Send },
];

const systemItems = [
  { title: "NotificaÃ§Ãµes", url: "/app/notificacoes", icon: Bell },
  { title: "UsuÃ¡rios", url: "/app/usuarios", icon: UserCog },
  { title: "Sugestoes", url: "/app/sugestoes", icon: Lightbulb },
  { title: "Manual de uso", url: "/app/manual", icon: BookOpenText },
  { title: "ConfiguraÃ§Ãµes", url: "/app/configuracoes", icon: Settings },
];

function SidebarSection({ label, items }: { label: string; items: typeof mainItems }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/app"}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { role, roles } = useAuth();
  const collapsed = state === "collapsed";
  const normalizedRoleList = normalizeRoles(roles.length > 0 ? roles : role ? [role] : []);
  const isDepartmentRole = isDepartmentOnlyUser(normalizedRoleList);
  const hasInternalAccess = hasAnyInternalRole(normalizedRoleList);
  const isAdmin = normalizedRoleList.includes("admin");

  if (!hasInternalAccess) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="pb-[max(env(safe-area-inset-bottom),0.75rem)]" />
      </Sidebar>
    );
  }

  const visibleMainItems = isDepartmentRole
    ? mainItems.filter((item) =>
        item.url === "/app/kanban" ||
        item.url === "/app/calendario" ||
        item.url === "/app/tarefas" ||
        item.url === "/app/clientes",
      )
    : mainItems;

  const visibleOperationalItems = isDepartmentRole
    ? operationalItems.filter(
        (item) =>
          item.url === "/app/solicitacoes" ||
          item.url === "/app/formularios" ||
          item.url === "/app/chat-interno" ||
          item.url === "/app/relatorios" ||
          item.url === "/app/obrigacoes" ||
          item.url === "/app/econtinuo",
      )
    : isAdmin
      ? operationalItems
      : operationalItems.filter((item) => item.url !== "/app/newsletter");

  const visibleSystemItems = isDepartmentRole
    ? systemItems.filter((item) => item.url === "/app/manual" || item.url === "/app/sugestoes")
    : isAdmin
      ? systemItems
      : systemItems.filter((item) => item.url !== "/app/usuarios");

  const mainItemOrder: Record<string, number> = {
    "/app": 0,
    "/app/calendario": 1,
    "/app/kanban": 2,
    "/app/tarefas": 3,
    "/app/clientes": 4,
  };

  const orderedMainItems = [...visibleMainItems].sort(
    (a, b) => (mainItemOrder[a.url] ?? 99) - (mainItemOrder[b.url] ?? 99),
  );

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarContent className="gap-3 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="mx-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
          <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 border border-white/12 bg-white/10 ring-1 ring-black/10">
            <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold tracking-[0.01em] text-white">Grow Finance</p>
              <p className="text-[11px] text-slate-300">Hub operacional</p>
            </div>
          )}
        </div>

        <SidebarSection label="Principal" items={orderedMainItems} />
        {visibleOperationalItems.length > 0 && <SidebarSection label="Operacional" items={visibleOperationalItems} />}
        {visibleSystemItems.length > 0 && <SidebarSection label="Sistema" items={visibleSystemItems} />}
      </SidebarContent>
    </Sidebar>
  );
}
