import { CalendarClock, CheckCircle2, CircleDollarSign, Clock, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatSalesCurrency, type SalesActivityType } from "@/lib/salesPipeline";
import type { SalesActivityRow, SalesOpportunityRow, SalesUserOption } from "@/lib/salesPipelineData";

interface SalesOpportunityDetailSheetProps {
  open: boolean;
  opportunity: SalesOpportunityRow | null;
  activities: SalesActivityRow[];
  users: SalesUserOption[];
  activityTitle: string;
  activityBody: string;
  activityType: SalesActivityType;
  followUpDate: string;
  lossReason: string;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onActivityTitleChange: (value: string) => void;
  onActivityBodyChange: (value: string) => void;
  onActivityTypeChange: (value: SalesActivityType) => void;
  onFollowUpDateChange: (value: string) => void;
  onLossReasonChange: (value: string) => void;
  onAddActivity: () => void;
  onCloseWon: () => void;
  onCloseLost: () => void;
  onReopen: () => void;
  onArchive: () => void;
}

const activityTypeLabels: Record<SalesActivityType, string> = {
  note: "Nota",
  call: "Ligacao",
  meeting: "Reuniao",
  email: "E-mail",
  whatsapp: "WhatsApp",
  task: "Tarefa",
  stage_change: "Etapa",
  system: "Sistema",
};

export function SalesOpportunityDetailSheet({
  open,
  opportunity,
  activities,
  users,
  activityTitle,
  activityBody,
  activityType,
  followUpDate,
  lossReason,
  isSaving = false,
  onOpenChange,
  onEdit,
  onActivityTitleChange,
  onActivityBodyChange,
  onActivityTypeChange,
  onFollowUpDateChange,
  onLossReasonChange,
  onAddActivity,
  onCloseWon,
  onCloseLost,
  onReopen,
  onArchive,
}: SalesOpportunityDetailSheetProps) {
  const owner = users.find((item) => item.user_id === opportunity?.owner_user_id);
  const isTerminal = opportunity?.status === "won" || opportunity?.status === "lost";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {opportunity ? (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{opportunity.status}</Badge>
                <Badge variant="outline" className="rounded-full">{opportunity.stage}</Badge>
              </div>
              <SheetTitle className="text-2xl">{opportunity.name}</SheetTitle>
              <SheetDescription>
                {opportunity.contact || "Sem contato"} - {owner?.display_name || "Sem responsavel"}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border p-4">
                <CircleDollarSign className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="font-semibold">{formatSalesCurrency(Number(opportunity.estimated_value) || 0)}</p>
              </div>
              <div className="rounded-2xl border p-4">
                <CalendarClock className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Previsao</p>
                <p className="font-semibold">
                  {opportunity.expected_close_date
                    ? new Date(opportunity.expected_close_date).toLocaleDateString("pt-BR")
                    : "Sem data"}
                </p>
              </div>
              <div className="rounded-2xl border p-4">
                <Clock className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Probabilidade</p>
                <p className="font-semibold">{opportunity.probability}%</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading font-semibold">Acoes comerciais</h3>
                <Button variant="outline" size="sm" onClick={onEdit}>Editar</Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {isTerminal ? (
                  <Button variant="outline" onClick={onReopen} disabled={isSaving}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reabrir
                  </Button>
                ) : (
                  <>
                    <Button onClick={onCloseWon} disabled={isSaving}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marcar como ganha
                    </Button>
                    <div className="space-y-2">
                      <Input
                        placeholder="Motivo da perda"
                        value={lossReason}
                        onChange={(event) => onLossReasonChange(event.target.value)}
                      />
                      <Button variant="outline" className="w-full" onClick={onCloseLost} disabled={isSaving}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Marcar como perdida
                      </Button>
                    </div>
                  </>
                )}
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onArchive} disabled={isSaving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Arquivar
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border">
              <div className="border-b p-4">
                <h3 className="font-heading font-semibold">Atividades e follow-ups</h3>
                <p className="mt-1 text-xs text-muted-foreground">Registre notas, contatos, reunioes e proximos passos.</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <select
                    className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
                    value={activityType}
                    onChange={(event) => onActivityTypeChange(event.target.value as SalesActivityType)}
                  >
                    {Object.entries(activityTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Titulo da atividade"
                    value={activityTitle}
                    onChange={(event) => onActivityTitleChange(event.target.value)}
                  />
                </div>
                <Textarea
                  className="min-h-24"
                  placeholder="Detalhe o contato, decisao ou proximo passo."
                  value={activityBody}
                  onChange={(event) => onActivityBodyChange(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Input
                    className="max-w-56"
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(event) => onFollowUpDateChange(event.target.value)}
                  />
                  <Button onClick={onAddActivity} disabled={isSaving}>Registrar atividade</Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3 p-4">
                {activities.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma atividade registrada.
                  </div>
                ) : (
                  activities.map((activity) => (
                    <article key={activity.id} className="rounded-xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="secondary" className="mb-2 rounded-full">
                            {activityTypeLabels[activity.activity_type as SalesActivityType] || activity.activity_type}
                          </Badge>
                          <h4 className="text-sm font-semibold">{activity.title}</h4>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {activity.body ? <p className="mt-2 text-sm text-muted-foreground">{activity.body}</p> : null}
                      {activity.due_at ? (
                        <p className="mt-2 text-xs text-primary">
                          Follow-up: {new Date(activity.due_at).toLocaleString("pt-BR")}
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
