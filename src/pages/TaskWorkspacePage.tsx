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
      <div className="max-w-none space-y-5">
        <section className="border-b border-border/70 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                Tarefas
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Operação diária por quadro ou lista, com filtros e histórico no detalhe da tarefa.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-1">
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
                        "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all",
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

              <Button className="gap-2 rounded-lg px-4" onClick={handleCreateTask}>
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
