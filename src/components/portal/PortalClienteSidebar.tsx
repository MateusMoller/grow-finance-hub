import {
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  Headset,
  LayoutDashboard,
  ListChecks,
  Settings2,
  Wallet,
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

export type PortalTab =
  | "overview"
  | "pending"
  | "requests"
  | "documents"
  | "cashflow"
  | "forms"
  | "manual"
  | "settings"
  | "support";

interface PortalClienteSidebarProps {
  activeTab: PortalTab;
  onChangeTab: (tab: PortalTab) => void;
}

interface PortalMenuItem {
  key: PortalTab;
  title: string;
  icon: typeof LayoutDashboard;
}

interface PortalMenuSection {
  label: string;
  items: PortalMenuItem[];
}

const menuSections: PortalMenuSection[] = [
  {
    label: "Visão Geral",
    items: [
      { key: "overview", title: "Painel geral", icon: LayoutDashboard },
      { key: "pending", title: "Pendências", icon: ListChecks },
    ],
  },
  {
    label: "Operação",
    items: [
      { key: "requests", title: "Solicitações", icon: ClipboardList },
      { key: "documents", title: "Documentos", icon: FolderOpen },
      { key: "forms", title: "Formulários", icon: FileText },
    ],
  },
  {
    label: "Financeiro",
    items: [{ key: "cashflow", title: "Controle de caixa", icon: Wallet }],
  },
  {
    label: "Conta e Suporte",
    items: [
      { key: "support", title: "Atendimento", icon: Headset },
      { key: "manual", title: "Manual do usuário", icon: BookOpen },
      { key: "settings", title: "Configurações", icon: Settings2 },
    ],
  },
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

        {menuSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
