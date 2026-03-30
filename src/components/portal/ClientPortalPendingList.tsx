import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FolderOpen, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import type { PortalActionItem } from "@/components/portal/types";

interface PendingGroup {
  key: string;
  title: string;
  emptyText: string;
  items: PortalActionItem[];
  icon: "document" | "request" | "analysis" | "done";
}

interface ClientPortalPendingListProps {
  loading: boolean;
  groups: PendingGroup[];
}

const iconMap = {
  document: FolderOpen,
  request: MessageSquare,
  analysis: Loader2,
  done: ShieldCheck,
};

export function ClientPortalPendingList({ loading, groups }: ClientPortalPendingListProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const Icon = iconMap[group.icon];
        return (
          <Card key={group.key} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.icon === "analysis" ? "animate-spin" : ""}`} />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">Carregando pendencias...</div>
              ) : group.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">{group.emptyText}</div>
              ) : (
                group.items.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-background px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.sector && (
                          <Badge variant="outline" className="text-[10px]">
                            {item.sector}
                          </Badge>
                        )}
                        {item.dueDate && (
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
