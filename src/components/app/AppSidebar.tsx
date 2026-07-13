import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
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
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { hasAnyInternalRole, normalizeRoles } from "@/lib/accessControl";
import { routeFeatureMap } from "@/lib/organizationFeatures";
import { canAccessModule, resolveRouteModule } from "@/lib/userPermissions";

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Calendário", url: "/app/calendario", icon: CalendarDays },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];

const operationalItems = [
  { title: "CRM", url: "/app/crm", icon: TrendingUp },
  { title: "Chat Interno", url: "/app/chat-interno", icon: MessagesSquare },
  { title: "Newsletter", url: "/app/newsletter", icon: Newspaper },
  { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
  { title: "Obrigações", url: "/app/obrigacoes", icon: FileSpreadsheet },
];

const systemItems = [
  { title: "Notificações", url: "/app/notificacoes", icon: Bell },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog },
  { title: "Sugestões", url: "/app/sugestoes", icon: Lightbulb },
  { title: "Manual de uso", url: "/app/manual", icon: BookOpenText },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
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
  const { role, roles, effectiveAccess } = useAuth();
  const { isFeatureEnabled } = useOrganizationSettings();
  const collapsed = state === "collapsed";
  const normalizedRoleList = normalizeRoles(roles.length > 0 ? roles : role ? [role] : []);
  const hasInternalAccess =
    effectiveAccess?.primaryRole === "admin" ||
    effectiveAccess?.primaryRole === "colaborador" ||
    hasAnyInternalRole(normalizedRoleList);

  if (!hasInternalAccess) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="pb-[max(env(safe-area-inset-bottom),0.75rem)]" />
      </Sidebar>
    );
  }

  const hasItemAccess = (url: string) => {
    if (!effectiveAccess) return true;
    const moduleKey = resolveRouteModule(url);
    return !moduleKey || canAccessModule(effectiveAccess, moduleKey);
  };

  const featureFilteredMainItems = mainItems.filter((item) => {
    const feature = routeFeatureMap[item.url];
    return (!feature || isFeatureEnabled(feature)) && hasItemAccess(item.url);
  });

  const featureFilteredOperationalItems = operationalItems.filter((item) => {
    const feature = routeFeatureMap[item.url];
    return (!feature || isFeatureEnabled(feature)) && hasItemAccess(item.url);
  });

  const visibleMainItems = featureFilteredMainItems;

  const visibleOperationalItems = featureFilteredOperationalItems;

  const visibleSystemItems = systemItems.filter((item) => {
    const feature = routeFeatureMap[item.url];
    return (!feature || isFeatureEnabled(feature)) && hasItemAccess(item.url);
  });

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
