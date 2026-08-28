import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
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
  const fiscalOrigin = useMemo(() => new URLSearchParams(location.search).get("origin") === "integra_contador", [location.search]);

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
      params.delete("task");
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
      <div className="mx-auto w-full max-w-[1800px] space-y-5 pb-8">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-[0_18px_50px_-32px_hsl(var(--primary)/0.45)] sm:p-7">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/20" />
          <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <ModuleContextPill icon={KanbanSquare} label="Operação diária" />
              <div className="space-y-1"><h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Tarefas
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Operação diária por quadro ou lista, com filtros e histórico no detalhe da tarefa.
              </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-xl border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur">
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
                        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <Button className="h-11 gap-2 rounded-xl px-5 shadow-sm" onClick={handleCreateTask}>
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {fiscalOrigin ? <div role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><strong>Contexto fiscal:</strong> exibindo o trabalho operacional originado pelo Integra Contador. Detalhes técnicos e credenciais não são expostos.</div> : null}
          {viewMode === "kanban" ? <TaskKanbanView embedded /> : <TaskListView embedded />}
        </section>
      </div>
    </AppLayout>
  );
}
