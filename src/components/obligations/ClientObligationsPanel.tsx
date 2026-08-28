import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { ObligationDeliveryCard } from "@/components/obligations/ObligationDeliveryCard";
import { FactorRObligationAlert } from "@/components/obligations/FactorRObligationAlert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredCurrentOrganizationId,
  growObligationSourceLabel,
  invokeGrowObligations,
  type GrowClientSnapshotPayload,
  type GrowObligationInstance,
  type GrowObligationDeliveryAttempt,
  type GrowObligationProfile,
  type GrowObligationTemplate,
} from "@/lib/growObligations";

interface ClientObligationsPanelProps {
  clientId: string;
}

interface ProfileDraft {
  template_id: string;
  start_date: string;
  due_day_override: string;
  notes: string;
}

const snapshotKey = (clientId: string) => ["grow-obligations-client", clientId];
const taskKey = (clientId: string, instanceIds: string[]) => ["grow-obligations-client-tasks", clientId, instanceIds];
const attemptsKey = (clientId: string, instanceIds: string[]) => ["grow-obligations-client-attempts", clientId, instanceIds];

type InstanceFilter = "pending" | "completed" | "all";

type LinkedObligationTask = {
  id: string;
  integration_task_id: string | null;
};

const openInstanceStatuses = new Set<GrowObligationInstance["status"]>([
  "pendente",
  "em_andamento",
  "aguardando_documento",
  "em_revisao",
  "pronto_para_envio",
  "enviando",
  "falha_envio",
  "atrasada",
]);

const buildToday = () => new Date().toISOString().slice(0, 10);

const toTemplate = (row: unknown): GrowObligationTemplate => row as GrowObligationTemplate;
const toProfile = (row: unknown): GrowObligationProfile => row as GrowObligationProfile;
const toInstance = (row: unknown): GrowObligationInstance => row as GrowObligationInstance;

const formatMonthYear = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });

async function loadLinkedTasks(instanceIds: string[]): Promise<LinkedObligationTask[]> {
  if (instanceIds.length === 0) return [];
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const integrationTaskIds = instanceIds.map((instanceId) => `instance:${instanceId}`);
  const batches = Array.from({ length: Math.ceil(integrationTaskIds.length / 100) }, (_, index) =>
    integrationTaskIds.slice(index * 100, (index + 1) * 100),
  );
  const responses = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("kanban_tasks")
        .select("id, integration_task_id")
        .eq("organization_id", organizationId)
        .eq("integration_source", "grow_obligation_task")
        .in("integration_task_id", batch),
    ),
  );

  const failedResponse = responses.find((response) => response.error);
  if (failedResponse?.error) throw failedResponse.error;
  return responses.flatMap((response) => (response.data || []) as LinkedObligationTask[]);
}

async function loadDeliveryAttempts(instanceIds: string[]): Promise<GrowObligationDeliveryAttempt[]> {
  if (instanceIds.length === 0) return [];
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organização ativa não encontrada.");
  const responses = await Promise.all(
    Array.from({ length: Math.ceil(instanceIds.length / 100) }, (_, index) => instanceIds.slice(index * 100, (index + 1) * 100))
      .map((batch) => supabase.from("obligation_delivery_attempts").select("*").eq("organization_id", organizationId).in("instance_id", batch).order("created_at", { ascending: false })),
  );
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
  return responses.flatMap((response) => (response.data || []) as GrowObligationDeliveryAttempt[]);
}

function getProfileDecisionState(profile: GrowObligationProfile) {
  if (!profile.is_active && profile.inactivation_reason === "regime_change") {
    return {
      label: "Auto-inativada",
      description: "Default de regime anterior encerrado apenas para efeitos futuros.",
      badgeVariant: "outline" as const,
    };
  }
  if (profile.sync_status === "skipped") {
    return {
      label: "Condicional ignorada",
      description: "Sem evidencia positiva. Sera aplicada automaticamente quando a evidencia for registrada.",
      badgeVariant: "outline" as const,
    };
  }
  if (profile.sync_status === "not_applicable") {
    return {
      label: "Nao aplicavel",
      description: profile.inactivation_reason
        ? `Estado encerrado: ${profile.inactivation_reason}.`
        : "Vinculo mantido no historico sem aplicacao futura.",
      badgeVariant: "secondary" as const,
    };
  }
  if (profile.source_kind === "regime_migration") {
    return {
      label: "Adicionada por troca de regime",
      description: "Incluida automaticamente pela matriz do regime tributario atual.",
      badgeVariant: "default" as const,
    };
  }
  if (profile.source_kind === "standard_load") {
    return {
      label: "Mantida no padrao",
      description: "Obrigacao padrao ativa para o regime tributario atual.",
      badgeVariant: "default" as const,
    };
  }
  if (profile.source_kind === "manual") {
    return {
      label: "Manual",
      description: "Obrigacao complementar criada pelo usuario.",
      badgeVariant: "secondary" as const,
    };
  }
  return null;
}

async function loadClientSnapshotDirectly(clientId: string): Promise<GrowClientSnapshotPayload> {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const [templatesResponse, profilesResponse, instancesResponse] = await Promise.all([
    supabase
      .from("obligation_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("client_obligation_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("is_active", { ascending: false })
      .order("start_date", { ascending: false }),
    supabase
      .from("obligation_instances")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("competence_key", { ascending: false }),
  ]);

  if (templatesResponse.error) throw templatesResponse.error;
  if (profilesResponse.error) throw profilesResponse.error;
  if (instancesResponse.error) throw instancesResponse.error;

  const templates = (templatesResponse.data || []).map(toTemplate);
  const templatesById = new Map(templates.map((template) => [template.id, template]));

  const profiles = (profilesResponse.data || []).map((profileRow) => {
    const profile = toProfile(profileRow);
    return {
      ...profile,
      template: templatesById.get(profile.template_id) || null,
      client: null,
    };
  });
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  const instances = (instancesResponse.data || []).map((instanceRow) => {
    const instance = toInstance(instanceRow);
    return {
      ...instance,
      template: templatesById.get(instance.template_id) || null,
      profile: profilesById.get(instance.profile_id) || null,
      client: null,
    };
  });

  return {
    ok: true,
    client_id: clientId,
    templates,
    profiles,
    instances,
  };
}

async function loadClientSnapshot(clientId: string): Promise<GrowClientSnapshotPayload> {
  try {
    return await loadClientSnapshotDirectly(clientId);
  } catch (error) {
    console.warn("Direct client obligation snapshot failed, using edge-function fallback", error);
    return invokeGrowObligations<GrowClientSnapshotPayload>({
      action: "list_client_snapshot",
      client_id: clientId,
    });
  }
}

export function ClientObligationsPanel({ clientId }: ClientObligationsPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [instanceFilter, setInstanceFilter] = useState<InstanceFilter>("pending");
  const [competenceMonthFilter, setCompetenceMonthFilter] = useState("latest");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    template_id: "",
    start_date: buildToday(),
    due_day_override: "",
    notes: "",
  });

  const snapshotQuery = useQuery({
    queryKey: snapshotKey(clientId),
    queryFn: () => loadClientSnapshot(clientId),
  });

  const snapshot = snapshotQuery.data;
  const instanceIds = useMemo(() => (snapshot?.instances || []).map((instance) => instance.id), [snapshot?.instances]);

  const linkedTasksQuery = useQuery({
    queryKey: taskKey(clientId, instanceIds),
    queryFn: () => loadLinkedTasks(instanceIds),
    enabled: instanceIds.length > 0,
  });

  const deliveryAttemptsQuery = useQuery({
    queryKey: attemptsKey(clientId, instanceIds),
    queryFn: () => loadDeliveryAttempts(instanceIds),
    enabled: instanceIds.length > 0,
    staleTime: 60_000,
  });

  const taskByInstanceId = useMemo(() => {
    const tasks = new Map<string, LinkedObligationTask>();
    for (const task of linkedTasksQuery.data || []) {
      const integrationId = task.integration_task_id || "";
      if (integrationId.startsWith("instance:")) tasks.set(integrationId.slice("instance:".length), task);
    }
    return tasks;
  }, [linkedTasksQuery.data]);

  const attemptsByInstanceId = useMemo(() => {
    const attempts = new Map<string, GrowObligationDeliveryAttempt[]>();
    for (const attempt of deliveryAttemptsQuery.data || []) {
      const current = attempts.get(attempt.instance_id) || [];
      current.push(attempt);
      attempts.set(attempt.instance_id, current);
    }
    return attempts;
  }, [deliveryAttemptsQuery.data]);

  const competenceMonths = useMemo(() => {
    const months = new Map<string, string>();
    for (const instance of snapshot?.instances || []) {
      const monthKey = instance.competence_date.slice(0, 7);
      if (!months.has(monthKey)) months.set(monthKey, formatMonthYear(`${monthKey}-01`));
    }
    return Array.from(months, ([value, label]) => ({ value, label })).sort((left, right) =>
      right.value.localeCompare(left.value),
    );
  }, [snapshot?.instances]);

  const effectiveCompetenceMonth =
    competenceMonthFilter === "latest" ? competenceMonths[0]?.value || "all" : competenceMonthFilter;

  const monthInstances = useMemo(() => {
    const instances = snapshot?.instances || [];
    if (effectiveCompetenceMonth === "all") return instances;
    return instances.filter((instance) => instance.competence_date.startsWith(effectiveCompetenceMonth));
  }, [effectiveCompetenceMonth, snapshot?.instances]);

  const instanceSummary = useMemo(() => {
    return {
      pending: monthInstances.filter((instance) => openInstanceStatuses.has(instance.status)).length,
      completed: monthInstances.filter((instance) => instance.status === "concluida").length,
      total: monthInstances.length,
    };
  }, [monthInstances]);

  const filteredInstances = useMemo(() => {
    if (instanceFilter === "pending") return monthInstances.filter((instance) => openInstanceStatuses.has(instance.status));
    if (instanceFilter === "completed") return monthInstances.filter((instance) => instance.status === "concluida");
    return monthInstances;
  }, [instanceFilter, monthInstances]);

  const availableTemplates = useMemo(() => {
    const assigned = new Set((snapshot?.profiles || []).map((profile) => profile.template_id));
    return (snapshot?.templates || []).filter((template) => !assigned.has(template.id) && template.is_active);
  }, [snapshot?.profiles, snapshot?.templates]);

  const createProfileMutation = useMutation({
    mutationFn: (draft: ProfileDraft) =>
      invokeGrowObligations({
        action: "upsert_profile",
        client_id: clientId,
        template_id: draft.template_id,
        start_date: draft.start_date,
        due_day_override: draft.due_day_override ? Number(draft.due_day_override) : null,
        notes: draft.notes || null,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("Obrigação vinculada ao cliente.");
      setDialogOpen(false);
      setProfileDraft({
        template_id: "",
        start_date: buildToday(),
        due_day_override: "",
        notes: "",
      });
      await queryClient.invalidateQueries({ queryKey: snapshotKey(clientId) });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations-overview"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao vincular obrigação.");
    },
  });

  if (snapshotQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (snapshotQuery.isError || !snapshot) {
    return (
      <Card className="rounded-3xl border-destructive/30">
        <CardHeader>
          <CardTitle>Falha ao carregar obrigações do cliente</CardTitle>
          <CardDescription>
            {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : "Não foi possível consultar o domínio nativo da Grow."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Obrigações do cliente</CardTitle>
            <CardDescription>
              Vínculos ativos que geram tarefas mensais automaticamente pela competência vigente.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="rounded-2xl" onClick={() => setDialogOpen(true)} disabled={availableTemplates.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Vincular obrigação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 rounded-3xl border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Vínculos ativos</p>
            </div>
            {(snapshot.profiles || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente ainda não possui obrigações vinculadas.</p>
            ) : (
              snapshot.profiles.map((profile) => {
                const decisionState = getProfileDecisionState(profile);
                const hasDuplicateRisk = profile.conditional_review_reason === "duplicate_risk" || profile.notes?.toLowerCase().includes("duplic");
                const isBlocked = profile.sync_status === "not_applicable" && profile.inactivation_reason === "blocked";
                return (
                <div key={profile.id} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{profile.template?.name || "Obrigação"}</p>
                    <Badge variant="outline">{profile.template?.sector || "Geral"}</Badge>
                    {profile.source_kind && (
                      <Badge variant="secondary">
                        {growObligationSourceLabel[profile.source_kind] || profile.source_kind}
                      </Badge>
                    )}
                    {!profile.is_active && <Badge variant="destructive">Inativo</Badge>}
                    {profile.sync_status === "skipped" && <Badge variant="outline">Condicional ignorada</Badge>}
                    {decisionState ? <Badge variant={decisionState.badgeVariant}>{decisionState.label}</Badge> : null}
                    {hasDuplicateRisk ? <Badge variant="outline">Risco de duplicidade</Badge> : null}
                    {isBlocked ? <Badge variant="destructive">Bloqueada</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mês de vinculação: {formatMonthYear(profile.start_date)}
                    {profile.due_day_override ? ` · vencimento customizado dia ${profile.due_day_override}` : ""}
                  </p>
                  {profile.sync_status === "skipped" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Condicional sem evidencia positiva. Sera aplicada automaticamente quando a evidencia for registrada.
                    </p>
                  )}
                  {decisionState?.description ? (
                    <p className="mt-2 text-xs text-muted-foreground">{decisionState.description}</p>
                  ) : null}
                  {profile.conditional_skip_reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">Motivo: {profile.conditional_skip_reason}</p>
                  ) : null}
                  {profile.notes && <p className="mt-2 text-xs text-muted-foreground">{profile.notes}</p>}
                </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Lista de entregas</CardTitle>
            <CardDescription>
              Obrigações geradas para este cliente, com documentos, leitura e andamento da entrega.
            </CardDescription>
          </div>
          <div className="w-full space-y-2 sm:w-64">
            <Label htmlFor="competence-month-filter">Competência mensal</Label>
            <Select value={competenceMonthFilter} onValueChange={setCompetenceMonthFilter}>
              <SelectTrigger id="competence-month-filter" className="rounded-xl">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Selecione a competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest" disabled={competenceMonths.length === 0}>
                  {competenceMonths[0] ? `Mais recente · ${competenceMonths[0].label}` : "Nenhuma competência disponível"}
                </SelectItem>
                {competenceMonths.slice(1).map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
                <SelectItem value="all">Todas as competências</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar lista de entregas">
            {([
              ["pending", `Pendentes (${instanceSummary.pending})`],
              ["completed", `Concluídas (${instanceSummary.completed})`],
              ["all", `Todas (${instanceSummary.total})`],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={instanceFilter === value ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setInstanceFilter(value)}
                aria-pressed={instanceFilter === value}
              >
                {label}
              </Button>
            ))}
          </div>

          {filteredInstances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">
                {instanceSummary.total === 0 ? "Nenhuma competência foi gerada ainda." : "Nenhuma competência neste filtro."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                As novas instâncias aparecerão aqui e permanecerão disponíveis após a conclusão.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInstances.map((instance) => {
                const attempts = attemptsByInstanceId.get(instance.id) || [];
                const deliveryInstance = { ...instance, delivery_attempts: attempts, latest_delivery_attempt: attempts[0] || null };
                return (
                  <div key={instance.id} className="space-y-2">
                    <FactorRObligationAlert instance={deliveryInstance} />
                    <ObligationDeliveryCard instance={deliveryInstance} taskId={taskByInstanceId.get(instance.id)?.id} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vincular obrigação ao cliente</DialogTitle>
            <DialogDescription>
              A obrigação nasce do catálogo mestre da Grow e passa a gerar tarefas mensais para este cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Obrigação do catálogo</Label>
              <Select value={profileDraft.template_id} onValueChange={(value) => setProfileDraft((prev) => ({ ...prev, template_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma obrigação" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Início da vigência</Label>
                <Input type="date" value={profileDraft.start_date} onChange={(event) => setProfileDraft((prev) => ({ ...prev, start_date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Override do dia de vencimento</Label>
                <Input value={profileDraft.due_day_override} onChange={(event) => setProfileDraft((prev) => ({ ...prev, due_day_override: event.target.value }))} placeholder="Opcional" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea value={profileDraft.notes} onChange={(event) => setProfileDraft((prev) => ({ ...prev, notes: event.target.value }))} rows={4} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createProfileMutation.mutate(profileDraft)} disabled={!profileDraft.template_id || createProfileMutation.isPending}>
              {createProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Vincular obrigação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
