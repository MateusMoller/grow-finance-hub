import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KanbanSquare, LayoutList, Plus } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TaskKanbanView } from "./KanbanPage";
import { TaskListView } from "./TarefasPage";

type TaskViewMode = "list" | "kanban";

const resolveViewMode = (search: string): TaskViewMode => {
  const params = new URLSearchParams(search);
  return params.get("view") === "list" ? "list" : "kanban";
};

export default function TaskWorkspacePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const viewMode = useMemo(() => resolveViewMode(location.search), [location.search]);

  const updateSearch = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search);
    updater(params);
    const nextSearch = params.toString();

    navigate(
      {
        pathname: "/app/tarefas",
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  };

  const handleViewChange = (nextView: TaskViewMode) => {
    updateSearch((params) => {
      if (nextView === "list") {
        params.set("view", "list");
        return;
      }

      params.delete("view");
    });
  };

  const handleCreateTask = () => {
    updateSearch((params) => {
      params.set("create", "1");
      if (viewMode === "list") {
        params.set("view", "list");
        return;
      }

      params.delete("view");
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <section className="rounded-3xl border border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">
                Central de Trabalho
              </div>
              <div className="space-y-1">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Tarefas em uma unica entrada
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  O kanban vira a leitura principal da operação, com a lista disponível quando o time precisar de uma visão mais detalhada.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-2xl border border-border/70 bg-muted/40 p-1">
                {[
                  { id: "list" as const, label: "Lista", icon: LayoutList },
                  { id: "kanban" as const, label: "Kanban", icon: KanbanSquare },
                ].map((option) => {
                  const active = viewMode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleViewChange(option.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Button className="gap-2 rounded-2xl px-5" onClick={handleCreateTask}>
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {viewMode === "kanban" ? <TaskKanbanView embedded /> : <TaskListView embedded />}
        </section>
      </div>
    </AppLayout>
  );
}
