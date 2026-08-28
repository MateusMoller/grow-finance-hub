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
  ReceiptText,
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
  { title: "Notas Fiscais", url: "/app/notas-fiscais", icon: ReceiptText },
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
      { title: "Dashboard de obrigações", url: "/app/obrigacoes?tab=dashboard", icon: LayoutDashboard, tab: "dashboard" },
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
  defaultOpen = true,
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

  if (collapsed) {
    return (
      <SidebarGroup className="items-center px-0 py-1">
        <SidebarGroupContent className="flex justify-center">
          <SidebarMenu className="w-auto items-center gap-1.5">
            {items.map((item) => (
              <SidebarMenuItem key={item.title} className="flex justify-center">
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className="group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0"
                >
                  <NavLink
                    to={item.url}
                    end={item.url === "/app"}
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground [&>svg]:m-0"
                    activeClassName="bg-sidebar-accent/75 text-sidebar-primary shadow-sm ring-1 ring-sidebar-border/40"
                    aria-label={item.title}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.badgeCount && item.badgeCount > 0 ? (
                      <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-sidebar">
                        {item.badgeCount > 9 ? "9+" : item.badgeCount}
                      </span>
                    ) : null}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <SidebarGroup className="px-1.5 py-1">
        <CollapsibleTrigger asChild disabled={collapsed}>
          <SidebarGroupLabel
            className={cn(
              collapsed
                ? "cursor-default"
                : "mb-1 flex h-10 cursor-pointer items-center justify-between rounded-xl px-2.5 text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/25 hover:text-sidebar-foreground",
              isSectionActive && !collapsed && "bg-sidebar-accent/20 text-sidebar-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/30 text-sidebar-foreground/65",
                  isSectionActive && "bg-sidebar-primary/15 text-sidebar-primary",
                )}
              >
                <SectionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em]">
                  {label}
                </span>
              </span>
            </span>
            {!collapsed && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors group-hover/section:bg-sidebar-accent/35">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/section:-rotate-90" />
              </span>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent className="pl-1">
            <SidebarMenu className="gap-1 pl-1">
              {items.map((item) => item.subItems?.length ? (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen
                  className="group/item"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild disabled={collapsed}>
                      <SidebarMenuButton
                        className={cn(
                          "h-9 rounded-lg px-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                          location.pathname === item.url && "bg-sidebar-accent/65 font-semibold text-sidebar-primary",
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
      <SidebarContent className="sidebar-scrollbar gap-1 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="mb-2 flex items-center gap-2 px-2.5 py-2 group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-sidebar-accent/30 p-0.5 opacity-90">
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
        <SidebarFooter className="border-t border-sidebar-border/40 px-3 py-3">
          {footerControls}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

