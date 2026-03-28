import {
  LayoutDashboard,
  Users,
  FileText,
  KanbanSquare,
  CalendarDays,
  BarChart3,
  Bell,
  Settings,
  TrendingUp,
  ClipboardList,
  Headset,
  BookOpenText,
  Newspaper,
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

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Kanban", url: "/app/kanban", icon: KanbanSquare },
  { title: "Calendario", url: "/app/calendario", icon: CalendarDays },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];

const operationalItems = [
  { title: "Atendimento Portal", url: "/app/solicitacoes", icon: Headset },
  { title: "Formularios", url: "/app/formularios", icon: FileText },
  { title: "CRM", url: "/app/crm", icon: TrendingUp },
  { title: "Newsletter", url: "/app/newsletter", icon: Newspaper },
  { title: "Relatorios", url: "/app/relatorios", icon: BarChart3 },
];

const systemItems = [
  { title: "Notificacoes", url: "/app/notificacoes", icon: Bell },
  { title: "Manual de uso", url: "/app/manual", icon: BookOpenText },
  { title: "Configuracoes", url: "/app/configuracoes", icon: Settings },
];

function SidebarSection({ label, items }: { label: string; items: typeof mainItems }) {
  const { state } = useSidebar();
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
  const { role } = useAuth();
  const collapsed = state === "collapsed";
  const isDepartmentRole = role === "departamento_pessoal" || role === "fiscal" || role === "contabil";

  const visibleMainItems = isDepartmentRole
    ? mainItems.filter((item) =>
        item.url === "/app/kanban" ||
        item.url === "/app/calendario" ||
        item.url === "/app/tarefas" ||
        item.url === "/app/clientes",
      )
    : mainItems;

  const visibleOperationalItems = isDepartmentRole
    ? operationalItems.filter((item) => item.url === "/app/solicitacoes")
    : role === "admin"
      ? operationalItems
      : operationalItems.filter((item) => item.url !== "/app/newsletter");

  const visibleSystemItems = isDepartmentRole
    ? systemItems.filter((item) => item.url === "/app/manual")
    : systemItems;

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
    <Sidebar collapsible="icon">
      <SidebarContent>
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
