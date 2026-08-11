import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  ClipboardList,
  Newspaper,
  MessageCircle,
  MessagesSquare,
  UserCog,
  Lightbulb,
  ChevronDown,
  BookOpen,
  FileUp,
  ListChecks,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import growIcon from "@/assets/grow-icon.png";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { hasAnyInternalRole, normalizeRoles } from "@/lib/accessControl";
import { routeFeatureMap } from "@/lib/organizationFeatures";
import { canAccessModule, resolveRouteModule } from "@/lib/userPermissions";
import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";

interface SidebarItem {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  badgeCount?: number;
  subItems?: Array<{
    title: string;
    url: string;
    icon: ComponentType<{ className?: string }>;
    tab: string;
  }>;
}

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Calendário", url: "/app/calendario", icon: CalendarDays },
  { title: "Tarefas", url: "/app/tarefas", icon: ClipboardList },
  { title: "Clientes", url: "/app/clientes", icon: Users },
];

const operationalItems = [
  { title: "Vendas", url: "/app/crm", icon: TrendingUp },
  { title: "WhatsApp", url: "/app/whatsapp", icon: MessageCircle },
  { title: "Chat Interno", url: "/app/chat-interno", icon: MessagesSquare },
  { title: "Newsletter", url: "/app/newsletter", icon: Newspaper },
  { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
  {
    title: "Obrigações",
    url: "/app/obrigacoes",
    icon: FileSpreadsheet,
    subItems: [
      { title: "Central de documentos", url: "/app/obrigacoes?tab=documentos", icon: FileUp, tab: "documentos" },
      { title: "Catálogo", url: "/app/obrigacoes?tab=catalogo", icon: BookOpen, tab: "catalogo" },
      { title: "Lista de entregas", url: "/app/obrigacoes?tab=entregas", icon: ListChecks, tab: "entregas" },
    ],
  },
];

const systemItems = [
  { title: "Solicitações", url: "/app/solicitacoes", icon: ClipboardList },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog },
  { title: "Sugestões", url: "/app/sugestoes", icon: Lightbulb },
];

function SidebarSection({
  label,
  items,
  icon: SectionIcon,
  defaultOpen = false,
}: {
  label: string;
  items: SidebarItem[];
  icon: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const isSectionActive = items.some((item) =>
    item.url === "/app"
      ? location.pathname === item.url
      : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`),
  );

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <SidebarGroup className="px-1.5 py-1.5">
        <CollapsibleTrigger asChild disabled={collapsed}>
          <SidebarGroupLabel
            className={cn(
              collapsed
                ? "cursor-default"
                : "mb-1 flex h-12 cursor-pointer items-center justify-between rounded-2xl border border-sidebar-border/35 bg-sidebar-accent/10 px-3 text-sidebar-foreground/75 shadow-sm transition-all hover:-translate-y-px hover:border-sidebar-border/60 hover:bg-sidebar-accent/25 hover:text-sidebar-foreground hover:shadow-md",
              isSectionActive && !collapsed && "border-sidebar-primary/25 bg-sidebar-accent/30 text-sidebar-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/45 text-sidebar-foreground/70",
                  isSectionActive && "bg-sidebar-primary/15 text-sidebar-primary",
                )}
              >
                <SectionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em]">
                  {label}
                </span>
                <span className="block text-[10px] font-medium normal-case text-sidebar-foreground/45">
                  {items.length} atalho{items.length === 1 ? "" : "s"}
                </span>
              </span>
            </span>
            {!collapsed && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/30 transition-colors group-hover/section:bg-sidebar-accent/50">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/section:-rotate-90" />
              </span>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent className="pl-2">
            <SidebarMenu className="gap-1 border-l border-sidebar-border/35 pl-2">
              {items.map((item) => item.subItems?.length ? (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={location.pathname === item.url}
                  className="group/item"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild disabled={collapsed}>
                      <SidebarMenuButton
                        className={cn(
                          "h-9 rounded-xl px-2 text-sidebar-foreground/72 transition-all hover:translate-x-0.5 hover:bg-sidebar-accent/35 hover:text-sidebar-foreground",
                          location.pathname === item.url && "bg-sidebar-accent/70 font-semibold text-sidebar-primary shadow-sm ring-1 ring-sidebar-border/35",
                        )}
                      >
                        <item.icon className="mr-2 h-4 w-4 text-sidebar-foreground/60" />
                        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
                        {!collapsed && <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/item:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="mr-0">
                        {item.subItems.map((subItem) => {
                          const activeTab = new URLSearchParams(location.search).get("tab") || "documentos";
                          return (
                            <SidebarMenuSubItem key={subItem.tab}>
                              <SidebarMenuSubButton asChild isActive={location.pathname === item.url && activeTab === subItem.tab}>
                                <NavLink
                                  to={subItem.url}
                                  onClick={() => {
                                    if (isMobile) setOpenMobile(false);
                                  }}
                                >
                                  <subItem.icon />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/app"}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                      className="h-9 rounded-xl px-2 text-sidebar-foreground/72 transition-all hover:translate-x-0.5 hover:bg-sidebar-accent/35 hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent/70 text-sidebar-primary font-semibold shadow-sm ring-1 ring-sidebar-border/35"
                    >
                      <item.icon className="mr-2 h-4 w-4 text-sidebar-foreground/60" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
                      {item.badgeCount && item.badgeCount > 0 ? (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                          {item.badgeCount > 99 ? "99+" : item.badgeCount}
                        </span>
                      ) : null}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar({
  footerControls,
  internalChatUnreadCount = 0,
}: {
  footerControls?: ReactNode;
  internalChatUnreadCount?: number;
}) {
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
        {footerControls && (
          <SidebarFooter className="border-t border-sidebar-border/70 px-3 py-3">
            {footerControls}
          </SidebarFooter>
        )}
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

  const visibleOperationalItems = featureFilteredOperationalItems.map((item) =>
    item.url === "/app/chat-interno"
      ? { ...item, badgeCount: internalChatUnreadCount }
      : item,
  );

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
      <SidebarContent className="gap-2 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-2.5 py-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-sidebar-accent/30 p-0.5 opacity-90 shadow-sm">
            <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-heading text-sm font-bold text-sidebar-foreground/90">
                Grow Finance
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
                Operação interna
              </span>
            </span>
          )}
        </div>

        <SidebarSection label="Principal" icon={LayoutDashboard} items={orderedMainItems} />
        {visibleOperationalItems.length > 0 && (
          <SidebarSection label="Operacional" icon={TrendingUp} items={visibleOperationalItems} defaultOpen />
        )}
        {visibleSystemItems.length > 0 && (
          <SidebarSection label="Sistema" icon={UserCog} items={visibleSystemItems} />
        )}
      </SidebarContent>
      {footerControls && (
        <SidebarFooter className="border-t border-sidebar-border/50 bg-sidebar-accent/10 px-3 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          {footerControls}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

