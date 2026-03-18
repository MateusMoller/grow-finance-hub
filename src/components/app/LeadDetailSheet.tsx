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
  ArrowRight,
  MessageSquare,
  Edit,
  Trash2,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface Lead {
  name: string;
  contact: string;
  value: string;
  stage: string;
  daysInStage: number;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
}

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange?: (leadName: string, newStage: string) => void;
}

const stages = [
  "Lead Novo", "Contato Iniciado", "Qualificação", "Reunião Agendada",
  "Proposta Enviada", "Negociação", "Fechado Ganho", "Fechado Perdido",
];

const stageColors: Record<string, string> = {
  "Lead Novo": "bg-muted text-muted-foreground",
  "Contato Iniciado": "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
  "Qualificação": "bg-primary/10 text-primary",
  "Reunião Agendada": "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  "Proposta Enviada": "bg-primary/10 text-primary",
  "Negociação": "bg-purple-100 text-purple-700 dark:bg-purple-900/20",
  "Fechado Ganho": "bg-primary/10 text-primary",
  "Fechado Perdido": "bg-destructive/10 text-destructive",
};

const mockHistory = [
  { action: "Lead capturado pelo site", date: "12/03/2026", by: "Sistema" },
  { action: "Primeiro contato por e-mail", date: "13/03/2026", by: "Carlos Ribeiro" },
  { action: "Reunião de diagnóstico agendada", date: "15/03/2026", by: "Carlos Ribeiro" },
];

export function LeadDetailSheet({ lead, open, onOpenChange, onStageChange }: LeadDetailSheetProps) {
  const [note, setNote] = useState("");

  if (!lead) return null;

  const stageCfg = stageColors[lead.stage] || "bg-muted";

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
          {/* Stage change */}
          <div>
            <span className="text-xs text-muted-foreground mb-1.5 block">Mover para etapa</span>
            <Select defaultValue={lead.stage} onValueChange={(val) => onStageChange?.(lead.name, val)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Contato</span>
              <span className="text-sm font-medium block">{lead.contact}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor Estimado</span>
              <span className="text-sm font-medium block">{lead.value}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</span>
              <span className="text-sm font-medium block">{lead.email || `contato@${lead.name.toLowerCase().replace(/\s/g, '')}.com`}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Telefone</span>
              <span className="text-sm font-medium block">{lead.phone || "(11) 99999-0000"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Dias na etapa</span>
              <span className="text-sm font-medium block">{lead.daysInStage} dias</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Origem</span>
              <span className="text-sm font-medium block">{lead.source || "Site institucional"}</span>
            </div>
          </div>

          <Separator />

          {/* Pipeline visual */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Progresso no Funil</h3>
            <div className="flex gap-1">
              {stages.slice(0, -1).map((s, i) => {
                const currentIdx = stages.indexOf(lead.stage);
                const isActive = i <= currentIdx;
                return (
                  <div key={s} className={`h-2 flex-1 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`} title={s} />
                );
              })}
            </div>
          </div>

          <Separator />

          {/* History */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Histórico
            </h3>
            <div className="space-y-3">
              {mockHistory.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    {i < mockHistory.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3">
                    <div className="text-sm">{h.action}</div>
                    <div className="text-xs text-muted-foreground">{h.date} · {h.by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Observações
            </h3>
            <Textarea placeholder="Adicionar observação..." value={note} onChange={e => setNote(e.target.value)} className="text-sm min-h-[60px]" />
            <Button size="sm" className="mt-2 gap-1"><Send className="h-3 w-3" /> Salvar</Button>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1"><Edit className="h-3.5 w-3.5" /> Editar</Button>
            <Button variant="outline" className="text-destructive hover:text-destructive gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
