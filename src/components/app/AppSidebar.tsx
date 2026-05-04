import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Wallet,
  FileSpreadsheet,
  Bell,
  Settings,
  TrendingUp,
  ClipboardList,
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
  { title: "Calendario", url: "/app/calendario", icon: CalendarDays },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];

const operationalItems = [
  { title: "CRM", url: "/app/crm", icon: TrendingUp },
  { title: "Chat Interno", url: "/app/chat-interno", icon: MessagesSquare },
  { title: "Newsletter", url: "/app/newsletter", icon: Newspaper },
  { title: "Relatorios", url: "/app/relatorios", icon: BarChart3 },
  { title: "Financeiro", url: "/app/financeiro", icon: Wallet },
  { title: "Obrigacoes", url: "/app/obrigacoes", icon: FileSpreadsheet },
  { title: "E-continuo", url: "/app/econtinuo", icon: Send },
];

const systemItems = [
  { title: "Notificacoes", url: "/app/notificacoes", icon: Bell },
  { title: "Usuarios", url: "/app/usuarios", icon: UserCog },
  { title: "Sugestoes", url: "/app/sugestoes", icon: Lightbulb },
  { title: "Manual de uso", url: "/app/manual", icon: BookOpenText },
  { title: "Configuracoes", url: "/app/configuracoes", icon: Settings },
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
        item.url === "/app/calendario" ||
        item.url === "/app/tarefas" ||
        item.url === "/app/clientes",
      )
    : mainItems;

  const visibleOperationalItems = isDepartmentRole
    ? operationalItems.filter(
        (item) =>
          item.url === "/app/chat-interno" ||
          item.url === "/app/relatorios" ||
          item.url === "/app/financeiro" ||
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
    "/app/tarefas": 2,
    "/app/clientes": 3,
  };

  const orderedMainItems = [...visibleMainItems].sort(
    (a, b) => (mainItemOrder[a.url] ?? 99) - (mainItemOrder[b.url] ?? 99),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="p-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0">
            <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <span className="font-heading font-bold text-sm text-sidebar-foreground">
              Grow Finance
            </span>
          )}
        </div>

        <SidebarSection label="Principal" items={orderedMainItems} />
        {visibleOperationalItems.length > 0 && <SidebarSection label="Operacional" items={visibleOperationalItems} />}
        {visibleSystemItems.length > 0 && <SidebarSection label="Sistema" items={visibleSystemItems} />}
      </SidebarContent>
    </Sidebar>
  );
}
