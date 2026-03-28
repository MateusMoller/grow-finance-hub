import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  User,
  Mail,
  Phone,
  DollarSign,
  CalendarDays,
  MessageSquare,
  Edit,
  Trash2,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import type { ChangeHistoryEntry } from "@/lib/changeHistory";

interface Lead {
  id: string;
  name: string;
  contact: string;
  value: string;
  stage: string;
  daysInStage: number;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  competence?: string;
}

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange?: (leadId: string, newStage: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onEditLead?: (leadId: string) => void;
  onSaveNotes?: (leadId: string, notes: string) => void;
  historyEntries?: ChangeHistoryEntry[];
}

const stages = [
  "Oportunidade Nova",
  "Contato Iniciado",
  "Diagnostico",
  "Reuniao Agendada",
  "Proposta Enviada",
  "Negociacao",
  "Fechado Ganho",
  "Fechado Perdido",
];

const stageColors: Record<string, string> = {
  "Oportunidade Nova": "bg-muted text-muted-foreground",
  "Contato Iniciado": "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
  Diagnostico: "bg-primary/10 text-primary",
  "Reuniao Agendada": "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  "Proposta Enviada": "bg-primary/10 text-primary",
  Negociacao: "bg-purple-100 text-purple-700 dark:bg-purple-900/20",
  "Fechado Ganho": "bg-primary/10 text-primary",
  "Fechado Perdido": "bg-destructive/10 text-destructive",
};

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onStageChange,
  onDeleteLead,
  onEditLead,
  onSaveNotes,
  historyEntries = [],
}: LeadDetailSheetProps) {
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote(lead?.notes || "");
  }, [lead?.id, lead?.notes]);

  if (!lead) return null;

  const stageCfg = stageColors[lead.stage] || "bg-muted";
  const hasNoteChanges = (lead.notes || "") !== note.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">{lead.name}</SheetTitle>
              <Badge variant="outline" className={`text-xs border-0 mt-1 ${stageCfg}`}>
                {lead.stage}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <div>
            <span className="text-xs text-muted-foreground mb-1.5 block">Mover negociacao para etapa</span>
            <Select value={lead.stage} onValueChange={(value) => onStageChange?.(lead.id, value)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Contato
              </span>
              <span className="text-sm font-medium block">{lead.contact}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Valor Estimado
              </span>
              <span className="text-sm font-medium block">{lead.value}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </span>
              <span className="text-sm font-medium block">
                {lead.email || "-"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefone
              </span>
              <span className="text-sm font-medium block">{lead.phone || "-"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Dias na etapa
              </span>
              <span className="text-sm font-medium block">{lead.daysInStage} dias</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Origem</span>
              <span className="text-sm font-medium block">{lead.source || "-"}</span>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">Progresso no funil</h3>
            <div className="flex gap-1">
              {stages.slice(0, -1).map((stage, index) => {
                const currentIdx = stages.indexOf(lead.stage);
                const isActive = index <= currentIdx;
                return (
                  <div
                    key={stage}
                    className={`h-2 flex-1 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
                    title={stage}
                  />
                );
              })}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Historico
            </h3>
            {historyEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Nenhuma alteracao registrada.
              </div>
            ) : (
              <div className="space-y-2">
                {historyEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{entry.action}</div>
                    {entry.details && <div className="text-xs text-muted-foreground mt-0.5">{entry.details}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")} - {entry.actor}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Observacoes
            </h3>
            <Textarea
              placeholder="Adicionar observacao..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="text-sm min-h-[60px]"
            />
            <Button
              size="sm"
              className="mt-2 gap-1"
              disabled={!onSaveNotes || !hasNoteChanges || savingNote}
              onClick={() => {
                if (!onSaveNotes) return;
                setSavingNote(true);
                onSaveNotes(lead.id, note.trim());
                setSavingNote(false);
              }}
            >
              <Send className="h-3 w-3" /> Salvar
            </Button>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => onEditLead?.(lead.id)}
              disabled={!onEditLead}
            >
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive gap-1"
              onClick={() => onDeleteLead?.(lead.id)}
              disabled={!onDeleteLead}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
