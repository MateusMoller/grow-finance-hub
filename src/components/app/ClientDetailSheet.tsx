import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  CalendarDays,
  DollarSign,
  Edit,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface Client {
  id: number;
  name: string;
  cnpj: string;
  regime: string;
  sector: string;
  status: string;
  contact: string;
  email: string;
  phone: string;
}

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  Ativo: "bg-primary/10 text-primary",
  Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
  Inativo: "bg-muted text-muted-foreground",
};

const mockServices = ["Contabilidade Completa", "BPO Financeiro", "Departamento Pessoal"];
const mockHistory = [
  { action: "Formulário de admissão enviado", date: "15/03/2026", by: "Maria Santos" },
  { action: "Reunião de alinhamento realizada", date: "10/03/2026", by: "Carlos Ribeiro" },
  { action: "Proposta comercial aceita", date: "01/02/2026", by: "Admin" },
  { action: "Onboarding iniciado", date: "05/02/2026", by: "Ana Lima" },
];

export function ClientDetailSheet({ client, open, onOpenChange }: ClientDetailSheetProps) {
  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">{client.name}</SheetTitle>
              <Badge variant="outline" className={`text-xs border-0 mt-1 ${statusColors[client.status] || "bg-muted"}`}>
                {client.status}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">CNPJ</span>
              <span className="text-sm font-medium block">{client.cnpj}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Regime Tributário</span>
              <span className="text-sm font-medium block">{client.regime}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Segmento do cliente</span>
              <span className="text-sm font-medium block">{client.sector}</span>
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Contato Principal</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.contact}</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Serviços Contratados
            </h3>
            <div className="space-y-2">
              {mockServices.map(s => (
                <div key={s} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* History */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Histórico de Atendimento
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

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" /> Documentos</Button>
            <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="h-3.5 w-3.5" /> Tarefas</Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1"><Edit className="h-3.5 w-3.5" /> Editar</Button>
            <Button variant="outline" className="text-destructive hover:text-destructive gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
