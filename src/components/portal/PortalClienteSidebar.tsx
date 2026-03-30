import {
  ClipboardList,
  FileText,
  FolderOpen,
  Headset,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
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

export type PortalTab = "overview" | "pending" | "requests" | "documents" | "forms" | "support";

interface PortalClienteSidebarProps {
  activeTab: PortalTab;
  onChangeTab: (tab: PortalTab) => void;
}

const menuItems: Array<{ key: PortalTab; title: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", title: "Visão Geral", icon: LayoutDashboard },
  { key: "pending", title: "Pendências", icon: ListChecks },
  { key: "requests", title: "Solicitações", icon: ClipboardList },
  { key: "documents", title: "Documentos", icon: FolderOpen },
  { key: "forms", title: "Formulários", icon: FileText },
  { key: "support", title: "Atendimento", icon: Headset },
];

export function PortalClienteSidebar({ activeTab, onChangeTab }: PortalClienteSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="p-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0">
            <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <span className="font-heading font-bold text-sm text-sidebar-foreground">
              Portal do Cliente
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={activeTab === item.key}
                    onClick={() => {
                      onChangeTab(item.key);
                      if (isMobile) setOpenMobile(false);
                    }}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

