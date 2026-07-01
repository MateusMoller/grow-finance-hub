import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  growObligationStatusClass,
  growObligationStatusLabel,
  invokeGrowObligations,
  type GrowClientSnapshotPayload,
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

const buildToday = () => new Date().toISOString().slice(0, 10);

export function ClientObligationsPanel({ clientId }: ClientObligationsPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    template_id: "",
    start_date: buildToday(),
    due_day_override: "",
    notes: "",
  });

  const snapshotQuery = useQuery({
    queryKey: snapshotKey(clientId),
    queryFn: () => invokeGrowObligations<GrowClientSnapshotPayload>({ action: "list_client_snapshot", client_id: clientId }),
  });

  const snapshot = snapshotQuery.data;

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

  const generateMutation = useMutation({
    mutationFn: () => invokeGrowObligations({ action: "generate_instances", client_id: clientId }),
    onSuccess: async () => {
      toast.success("Competencias sincronizadas sem duplicar tarefas existentes.");
      await queryClient.invalidateQueries({ queryKey: snapshotKey(clientId) });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations-overview"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar competências.");
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
              Vínculos ativos, próximas competências e geração operacional nativa da Grow.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="rounded-2xl" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              Gerar competências
            </Button>
            <Button className="rounded-2xl" onClick={() => setDialogOpen(true)} disabled={availableTemplates.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Vincular obrigação
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3 rounded-3xl border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Vínculos ativos</p>
            </div>
            {(snapshot.profiles || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente ainda não possui obrigações vinculadas.</p>
            ) : (
              snapshot.profiles.map((profile) => (
                <div key={profile.id} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{profile.template?.name || "Obrigação"}</p>
                    <Badge variant="outline">{profile.template?.sector || "Geral"}</Badge>
                    {!profile.is_active && <Badge variant="destructive">Inativo</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Vigência inicial: {new Date(`${profile.start_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    {profile.due_day_override ? ` · vencimento customizado dia ${profile.due_day_override}` : ""}
                  </p>
                  {profile.notes && <p className="mt-2 text-xs text-muted-foreground">{profile.notes}</p>}
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-border/70 p-4">
            <p className="text-sm font-medium">Competências recentes</p>
            {(snapshot.instances || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma competência gerada para este cliente ainda.</p>
            ) : (
              snapshot.instances.slice(0, 10).map((instance) => (
                <div key={instance.id} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{instance.template?.name || "Obrigação"}</p>
                    <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>
                      {growObligationStatusLabel[instance.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Competência {instance.competence_label} · vencimento {new Date(`${instance.technical_due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vincular obrigação ao cliente</DialogTitle>
            <DialogDescription>
              A obrigação nasce do catálogo mestre da Grow e passa a gerar competências próprias para este cliente.
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
