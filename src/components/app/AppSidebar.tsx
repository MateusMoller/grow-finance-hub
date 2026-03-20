import {
  LayoutDashboard,
  Users,
  FileText,
  KanbanSquare,
  BarChart3,
  Bell,
  Settings,
  FolderOpen,
  UserPlus,
  TrendingUp,
  ClipboardList,
  Headset,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Kanban", url: "/app/kanban", icon: KanbanSquare },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
  { title: "Leads / CRM", url: "/app/crm", icon: UserPlus },
];

const operationalItems = [
  { title: "Solicitações", url: "/app/solicitacoes", icon: Headset },
  { title: "Formulários", url: "/app/formularios", icon: FileText },
  { title: "Documentos", url: "/app/documentos", icon: FolderOpen },
  { title: "Comercial", url: "/app/comercial", icon: TrendingUp },
  { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
];

const systemItems = [
  { title: "Notificações", url: "/app/notificacoes", icon: Bell },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

function SidebarSection({ label, items }: { label: string; items: typeof mainItems }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

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
  const collapsed = state === "collapsed";

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

        <SidebarSection label="Principal" items={mainItems} />
        <SidebarSection label="Operacional" items={operationalItems} />
        <SidebarSection label="Sistema" items={systemItems} />
      </SidebarContent>
    </Sidebar>
  );
}
