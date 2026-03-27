import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.icon === "analysis" ? "animate-pulse" : ""}`} />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">Carregando pendencias...</div>
              ) : group.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">{group.emptyText}</div>
              ) : (
                group.items.map((item, index) => (
                  <div key={`${item.id}-${index}`}>
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
                    {index < group.items.length - 1 && <Separator className="mt-3" />}
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
