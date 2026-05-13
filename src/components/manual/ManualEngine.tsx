import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenText, CheckCircle2, Compass, PlayCircle, Search, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManualProgress } from "@/hooks/useManualProgress";
import {
  getManualModulesByContexts,
  getRecommendedManualTrack,
  manualContexts,
} from "@/lib/manual/content";
import type { ManualContextKey, ManualLesson, ManualModule } from "@/lib/manual/types";
import { cn } from "@/lib/utils";

interface ManualEngineProps {
  mode: "internal" | "portal";
  title: string;
  subtitle: string;
  allowedContexts: ManualContextKey[];
  role?: string | null;
  canViewAdoption?: boolean;
  onRunAction?: (actionKey: string) => boolean | void;
}

const getLessonUniqueKey = (contextKey: ManualContextKey, moduleKey: string, lessonKey: string) =>
  `${contextKey}__${moduleKey}__${lessonKey}`;

const getModuleProgressValue = (
  contextKey: ManualContextKey,
  moduleKey: string,
  lessons: ManualLesson[],
  getStatus: (context: ManualContextKey, module: string, lesson: string) => "in_progress" | "completed" | null,
) => {
  if (lessons.length === 0) return 0;
  const completed = lessons.filter((lesson) => getStatus(contextKey, moduleKey, lesson.key) === "completed").length;
  return Math.round((completed / lessons.length) * 100);
};

export function ManualEngine({
  mode,
  title,
  subtitle,
  allowedContexts,
  role,
  canViewAdoption = false,
  onRunAction,
}: ManualEngineProps) {
  const navigate = useNavigate();
  const {
    loading,
    saving,
    userState,
    getLessonStatus,
    upsertLessonProgress,
    dismissManualOnboarding,
    saveLastModule,
    getManualAdoptionSnapshot,
  } = useManualProgress();

  const visibleContexts = useMemo(
    () => manualContexts.filter((context) => allowedContexts.includes(context.key)),
    [allowedContexts],
  );

  const defaultContext = visibleContexts[0]?.key || "internal";
  const [activeContext, setActiveContext] = useState<ManualContextKey>(defaultContext);
  const [activeModuleKey, setActiveModuleKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [adoptionContextFilter, setAdoptionContextFilter] = useState<ManualContextKey | "all">("all");
  const [adoptionProfileFilter, setAdoptionProfileFilter] = useState<string>("all");
  const [adoptionPeriodDays, setAdoptionPeriodDays] = useState<number>(90);
  const [activeTab, setActiveTab] = useState<"guide" | "adoption">("guide");
  const [adoptionRows, setAdoptionRows] = useState<
    Array<{
      context_key: ManualContextKey;
      module_key: string;
      profile: string;
      total_users: number;
      completed_users: number;
      pending_users: number;
      avg_completion: number;
    }>
  >([]);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);

  useEffect(() => {
    if (!visibleContexts.some((context) => context.key === activeContext)) {
      setActiveContext(defaultContext);
      return;
    }
    if (userState.last_context_key && visibleContexts.some((context) => context.key === userState.last_context_key)) {
      setActiveContext(userState.last_context_key);
    }
  }, [defaultContext, userState.last_context_key, visibleContexts, activeContext]);

  const allModules = useMemo(
    () => getManualModulesByContexts(allowedContexts),
    [allowedContexts],
  );

  const searchedModules = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term ? allModules : allModules.filter((module) => module.contextKey === activeContext);
    if (!term) return base;

    return base.filter((module) => {
      const moduleText = `${module.title} ${module.objective}`.toLowerCase();
      if (moduleText.includes(term)) return true;
      return module.lessons.some((lesson) => {
        const lessonText = [
          lesson.title,
          lesson.summary,
          ...(lesson.steps || []),
          ...(lesson.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return lessonText.includes(term);
      });
    });
  }, [activeContext, allModules, search]);

  const moduleByKey = useMemo(() => {
    const map = new Map<string, ManualModule>();
    searchedModules.forEach((module) => map.set(module.key, module));
    return map;
  }, [searchedModules]);

  useEffect(() => {
    if (searchedModules.length === 0) {
      setActiveModuleKey("");
      return;
    }

    const preferredKey = userState.last_context_key === activeContext ? userState.last_module_key : null;
    if (preferredKey && moduleByKey.has(preferredKey)) {
      setActiveModuleKey(preferredKey);
      return;
    }

    if (!activeModuleKey || !moduleByKey.has(activeModuleKey)) {
      setActiveModuleKey(searchedModules[0].key);
    }
  }, [activeContext, activeModuleKey, moduleByKey, searchedModules, userState.last_context_key, userState.last_module_key]);

  const activeModule = useMemo(
    () => searchedModules.find((module) => module.key === activeModuleKey) || null,
    [activeModuleKey, searchedModules],
  );

  const recommendedTrack = useMemo(
    () => getRecommendedManualTrack(role, allowedContexts),
    [allowedContexts, role],
  );

  const firstIncompleteRecommended = useMemo(() => {
    for (const moduleKey of recommendedTrack) {
      const module = allModules.find((item) => item.key === moduleKey);
      if (!module) continue;
      const progressValue = getModuleProgressValue(module.contextKey, module.key, module.lessons, getLessonStatus);
      if (progressValue < 100) return module;
    }
    return allModules[0] || null;
  }, [recommendedTrack, allModules, getLessonStatus]);

  const handleSelectModule = async (module: ManualModule) => {
    setActiveContext(module.contextKey);
    setActiveModuleKey(module.key);
    await saveLastModule(module.contextKey, module.key);
  };

  const handleAction = (actionKey: string) => {
    const handled = onRunAction?.(actionKey);
    if (handled) return;

    if (actionKey.startsWith("route:")) {
      navigate(actionKey.replace("route:", ""));
      return;
    }

    if (actionKey.startsWith("hash:")) {
      window.location.hash = actionKey.replace("hash:", "");
    }
  };

  const markLesson = async (module: ManualModule, lesson: ManualLesson, nextStatus: "in_progress" | "completed") => {
    await upsertLessonProgress({
      contextKey: module.contextKey,
      moduleKey: module.key,
      lessonKey: lesson.key,
      status: nextStatus,
    });
  };

  const fetchAdoption = useCallback(async () => {
    if (!canViewAdoption) return;
    setAdoptionLoading(true);
    setAdoptionError(null);
    const { data, error } = await getManualAdoptionSnapshot({
      contextKey: adoptionContextFilter,
      profile: adoptionProfileFilter,
      periodDays: adoptionPeriodDays,
    });
    if (error) {
      setAdoptionError("Não foi possível carregar os indicadores de adoção.");
      setAdoptionRows([]);
    } else {
      setAdoptionRows(data || []);
    }
    setAdoptionLoading(false);
  }, [adoptionContextFilter, adoptionPeriodDays, adoptionProfileFilter, canViewAdoption, getManualAdoptionSnapshot]);

  useEffect(() => {
    if (!canViewAdoption) return;
    if (activeTab !== "adoption") return;
    void fetchAdoption();
  }, [activeTab, canViewAdoption, fetchAdoption]);

  const profileOptions = useMemo(() => {
    const options = new Set<string>();
    adoptionRows.forEach((row) => options.add(row.profile));
    return Array.from(options).sort();
  }, [adoptionRows]);

  const adoptionContextRows = useMemo(
    () => adoptionRows.filter((row) => row.module_key === "__all__"),
    [adoptionRows],
  );

  const adoptionModuleRows = useMemo(
    () =>
      adoptionRows
        .filter((row) => row.module_key !== "__all__")
        .sort((left, right) => right.pending_users - left.pending_users),
    [adoptionRows],
  );

  const adoptionTotals = useMemo(() => {
    const totalUsers = adoptionContextRows.reduce((sum, row) => sum + row.total_users, 0);
    const completedUsers = adoptionContextRows.reduce((sum, row) => sum + row.completed_users, 0);
    const pendingUsers = adoptionContextRows.reduce((sum, row) => sum + row.pending_users, 0);
    const avgCompletion =
      adoptionContextRows.length > 0
        ? adoptionContextRows.reduce((sum, row) => sum + Number(row.avg_completion || 0), 0) / adoptionContextRows.length
        : 0;
    return {
      totalUsers,
      completedUsers,
      pendingUsers,
      avgCompletion: Math.round(avgCompletion * 100),
    };
  }, [adoptionContextRows]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className="bg-slate-100/10 text-slate-100">Manual Interativo Grow</Badge>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="text-slate-300">{subtitle}</CardDescription>
            </div>
            <div className="hidden rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4 md:block">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Status</p>
              <p className="mt-2 text-sm text-slate-100">{saving ? "Salvando progresso..." : "Progresso sincronizado"}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!userState.onboarding_dismissed_at && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Primeiro acesso ao manual interativo</p>
              <p className="text-sm text-muted-foreground">
                Comece pela trilha recomendada para seu perfil e acompanhe o progresso por módulo.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void dismissManualOnboarding()}
              >
                Ocultar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!firstIncompleteRecommended) return;
                  void handleSelectModule(firstIncompleteRecommended);
                }}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Começar trilha recomendada
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "guide" | "adoption")} className="space-y-4">
        <TabsList className={cn("grid w-full", canViewAdoption ? "grid-cols-2" : "grid-cols-1")}>
          <TabsTrigger value="guide">Guia interativo</TabsTrigger>
          {canViewAdoption && <TabsTrigger value="adoption">Adoção</TabsTrigger>}
        </TabsList>

        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar módulo, lição, passo ou palavra-chave"
                  className="pl-9"
                />
              </div>
              <Select value={activeContext} onValueChange={(value) => setActiveContext(value as ManualContextKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contexto" />
                </SelectTrigger>
                <SelectContent>
                  {visibleContexts.map((context) => (
                    <SelectItem key={context.key} value={context.key}>
                      {context.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Índice de módulos</CardTitle>
                <CardDescription>
                  {loading ? "Carregando progresso..." : `${searchedModules.length} módulo(s) encontrado(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {searchedModules.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum módulo encontrado para esta busca.</p>
                )}
                {searchedModules.map((module) => {
                  const progressValue = getModuleProgressValue(
                    module.contextKey,
                    module.key,
                    module.lessons,
                    getLessonStatus,
                  );
                  const isActive = module.key === activeModuleKey;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => void handleSelectModule(module)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                        isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <p className="text-sm font-medium">{module.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{module.lessons.length} lições</p>
                      <Progress value={progressValue} className="mt-2 h-2" />
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {activeModule ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle>{activeModule.title}</CardTitle>
                        <CardDescription>{activeModule.objective}</CardDescription>
                      </div>
                      <Badge variant="secondary">{activeModule.contextKey}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Progress
                      value={getModuleProgressValue(activeModule.contextKey, activeModule.key, activeModule.lessons, getLessonStatus)}
                      className="h-2"
                    />
                  </CardContent>
                </Card>

                {activeModule.lessons.map((lesson) => {
                  const lessonStatus = getLessonStatus(activeModule.contextKey, activeModule.key, lesson.key);
                  const completed = lessonStatus === "completed";
                  const lessonUniqueKey = getLessonUniqueKey(activeModule.contextKey, activeModule.key, lesson.key);

                  return (
                    <Card key={lessonUniqueKey}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{lesson.title}</CardTitle>
                            <CardDescription>{lesson.summary}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={completed}
                              onCheckedChange={(checked) =>
                                void markLesson(
                                  activeModule,
                                  lesson,
                                  checked ? "completed" : "in_progress",
                                )
                              }
                              aria-label={`Concluir lição ${lesson.title}`}
                            />
                            {completed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{lesson.estimatedMinutes} min</span>
                          {(lesson.tags || []).map((tag) => (
                            <Badge key={`${lessonUniqueKey}-${tag}`} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                          {lesson.steps.map((step) => (
                            <li key={`${lessonUniqueKey}-${step}`}>{step}</li>
                          ))}
                        </ol>

                        {(lesson.tips || []).length > 0 && (
                          <div className="rounded-lg border bg-emerald-50/70 p-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
                            <p className="font-medium">Dica</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5">
                              {lesson.tips?.map((tip) => <li key={`${lessonUniqueKey}-${tip}`}>{tip}</li>)}
                            </ul>
                          </div>
                        )}

                        {(lesson.commonMistakes || []).length > 0 && (
                          <div className="rounded-lg border bg-amber-50/70 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                            <p className="font-medium">Evite</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5">
                              {lesson.commonMistakes?.map((mistake) => <li key={`${lessonUniqueKey}-${mistake}`}>{mistake}</li>)}
                            </ul>
                          </div>
                        )}

                        {(lesson.actions || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {lesson.actions?.map((action) => (
                              <Button
                                key={`${lessonUniqueKey}-${action.actionKey}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(action.actionKey)}
                              >
                                <Compass className="mr-1.5 h-3.5 w-3.5" />
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex min-h-[220px] items-center justify-center p-6 text-center text-muted-foreground">
                  Selecione um módulo para iniciar a trilha.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {canViewAdoption && (
          <TabsContent value="adoption" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Painel de adoção do manual</CardTitle>
                <CardDescription>Consolidação por contexto, módulo e perfil.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={adoptionContextFilter} onValueChange={(value) => setAdoptionContextFilter(value as ManualContextKey | "all")}>
                  <SelectTrigger><SelectValue placeholder="Contexto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os contextos</SelectItem>
                    {allowedContexts.map((context) => (
                      <SelectItem key={context} value={context}>{context}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={adoptionProfileFilter} onValueChange={setAdoptionProfileFilter}>
                  <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os perfis</SelectItem>
                    {profileOptions.map((profile) => (
                      <SelectItem key={profile} value={profile}>{profile}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(adoptionPeriodDays)} onValueChange={(value) => setAdoptionPeriodDays(Number(value))}>
                  <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="60">Últimos 60 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="180">Últimos 180 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => void fetchAdoption()}>
                  Atualizar métricas
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Usuários no recorte</p>
                  <p className="mt-2 text-2xl font-semibold">{adoptionTotals.totalUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Concluíram trilhas</p>
                  <p className="mt-2 text-2xl font-semibold">{adoptionTotals.completedUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Com pendências</p>
                  <p className="mt-2 text-2xl font-semibold">{adoptionTotals.pendingUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Conclusão média</p>
                  <p className="mt-2 text-2xl font-semibold">{adoptionTotals.avgCompletion}%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Módulos com mais pendências
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adoptionLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando métricas...</p>
                ) : adoptionError ? (
                  <p className="text-sm text-destructive">{adoptionError}</p>
                ) : adoptionModuleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
                ) : (
                  <div className="space-y-2">
                    {adoptionModuleRows.slice(0, 10).map((row) => (
                      <div key={`${row.context_key}-${row.module_key}-${row.profile}`} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{row.module_key}</p>
                            <p className="text-xs text-muted-foreground">{row.context_key} · perfil {row.profile}</p>
                          </div>
                          <Badge variant="outline">{row.pending_users} pendente(s)</Badge>
                        </div>
                        <Progress value={Math.round(Number(row.avg_completion || 0) * 100)} className="mt-2 h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        <BookOpenText className="mr-1 inline h-3.5 w-3.5" />
        O manual é versionado no código para manter consistência entre produto, processo e treinamento.
      </div>
    </div>
  );
}
