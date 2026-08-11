import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, Eye, ExternalLink, Loader2, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  getStoredCurrentOrganizationId,
  growObligationStatusClass,
  growObligationStatusLabel,
  growPriorityLabel,
  type GrowObligationDeliveryAttempt,
  type GrowObligationInstance,
} from "@/lib/growObligations";

type DeliveryFile = { id: string; file_name: string; storage_bucket: string; storage_path: string; protocol_number: string | null; created_at: string };
type DeliveryEvent = { id: string; event_type: string; from_status: string | null; to_status: string | null; comment: string | null; created_at: string };
type DocumentAccess = { id: string; file_id: string; access_type: string; access_channel: string; user_agent: string | null; accessed_at: string };

const attemptLabels: Record<GrowObligationDeliveryAttempt["status"], string> = {
  queued: "Na fila", sending: "Enviando", sent: "Enviado", failed: "Falhou", cancelled: "Cancelado",
};

const formatDate = (value: string | null | undefined) => value ? new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const formatDateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("pt-BR") : "-";

function channelLabel(channel: string) {
  if (channel === "email_link") return "Link por e-mail";
  if (channel === "whatsapp_link") return "Link pelo WhatsApp";
  if (channel === "direct_link") return "Link direto";
  return "Portal do cliente";
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Dispositivo não identificado";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Navegador";
  return `${browser} em ${/Android|iPhone|iPad|Mobile/i.test(userAgent) ? "celular" : "computador"}`;
}

async function loadDetails(instanceId: string) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organização ativa não encontrada.");
  const [files, events, accesses] = await Promise.all([
    supabase.from("obligation_instance_files").select("id, file_name, storage_bucket, storage_path, protocol_number, created_at").eq("organization_id", organizationId).eq("instance_id", instanceId).order("created_at", { ascending: false }),
    supabase.from("obligation_instance_events").select("id, event_type, from_status, to_status, comment, created_at").eq("organization_id", organizationId).eq("instance_id", instanceId).order("created_at", { ascending: false }).limit(20),
    supabase.from("obligation_document_access_events").select("id, file_id, access_type, access_channel, user_agent, accessed_at").eq("organization_id", organizationId).eq("instance_id", instanceId).order("accessed_at", { ascending: false }).limit(30),
  ]);
  if (files.error) throw files.error;
  if (events.error) throw events.error;
  if (accesses.error) console.warn("Histórico de leitura indisponível.", accesses.error);
  return { files: (files.data || []) as DeliveryFile[], events: (events.data || []) as DeliveryEvent[], accesses: accesses.error ? [] : (accesses.data || []) as DocumentAccess[] };
}

async function openFile(file: DeliveryFile) {
  const { data, error } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60);
  if (error || !data?.signedUrl) throw error || new Error("Não foi possível abrir o arquivo.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function ObligationDeliveryCard({ instance, taskId }: { instance: GrowObligationInstance; taskId?: string | null }) {
  const [open, setOpen] = useState(false);
  const details = useQuery({ queryKey: ["grow-obligations", "delivery-detail", instance.id], queryFn: () => loadDetails(instance.id), enabled: open, staleTime: 60_000 });
  const attempts = instance.delivery_attempts || [];
  const latestAttempt = instance.latest_delivery_attempt || attempts[0] || null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <CollapsibleTrigger className="group flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{instance.template?.name || "Obrigação"}</p>
            <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>{growObligationStatusLabel[instance.status]}</Badge>
            <Badge variant="outline">{growPriorityLabel[instance.priority]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Competência {instance.competence_label}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>Vencimento: {formatDate(instance.technical_due_date)}</span><span>Setor: {instance.template?.sector || "Geral"}</span><span>Envio: {latestAttempt ? attemptLabels[latestAttempt.status] : "Não realizado"}</span></div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary">{open ? "Ocultar informações" : "Ver informações de envio"}<ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" /></span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/70 bg-muted/10">
        <div className="space-y-5 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Protocolo</p><p className="mt-1 text-sm font-medium">{instance.protocol || "Não informado"}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Destinatário</p><p className="mt-1 truncate text-sm font-medium">{latestAttempt?.recipient_email || latestAttempt?.recipient_phone || "Não definido"}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Último envio</p><p className="mt-1 text-sm font-medium">{formatDateTime(latestAttempt?.sent_at || latestAttempt?.failed_at || latestAttempt?.created_at)}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Documento</p><p className="mt-1 text-sm font-medium">{instance.document_required ? "Obrigatório" : "Opcional"}</p></div>
          </div>
          {details.isLoading ? <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando informações...</div> : details.isError ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Falha ao carregar detalhes.</div> : (
            <div className="space-y-5">
              <section className="space-y-3"><div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Arquivos anexados</h4></div>{details.data?.files.length ? <div className="space-y-2">{details.data.files.map((file) => <button key={file.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left hover:bg-muted/40" onClick={() => void openFile(file).catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao abrir arquivo."))}><span className="min-w-0"><span className="block truncate text-sm font-medium">{file.file_name}</span><span className="text-xs text-muted-foreground">{formatDateTime(file.created_at)}{file.protocol_number ? ` · protocolo ${file.protocol_number}` : ""}</span></span><Download className="h-4 w-4 shrink-0 text-primary" /></button>)}</div> : <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>}</section>
              <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Leitura do cliente</h4></div><Badge variant={details.data?.accesses.length ? "default" : "secondary"}>{details.data?.accesses.length ? "Acesso confirmado" : "Ainda não acessado"}</Badge></div>{details.data?.accesses.length ? <div className="space-y-2">{details.data.accesses.map((access) => { const file = details.data?.files.find((item) => item.id === access.file_id); return <div key={access.id} className="flex flex-col gap-1 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{file?.file_name || "Documento da obrigação"}</p><p className="text-xs text-muted-foreground">{channelLabel(access.access_channel)} · {deviceLabel(access.user_agent)}</p></div><div className="shrink-0 sm:text-right"><p className="text-sm font-medium">{formatDateTime(access.accessed_at)}</p><p className="text-xs text-muted-foreground">Visualizou o arquivo</p></div></div>; })}</div> : <p className="text-sm text-muted-foreground">O link seguro ainda não foi acessado pelo cliente.</p>}</section>
              <section className="space-y-3"><h4 className="text-sm font-semibold">Andamento da entrega</h4>{details.data?.events.length ? <div className="space-y-2 border-l border-border pl-4">{details.data.events.map((event) => <div key={event.id} className="text-sm"><p className="font-medium">{event.comment || event.event_type}</p><p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}{event.from_status || event.to_status ? ` · ${event.from_status || "início"} → ${event.to_status || "sem alteração"}` : ""}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}</section>
            </div>
          )}
          {taskId ? <div className="flex justify-end"><Button asChild variant="outline" className="rounded-xl"><Link to={`/app/tarefas?view=kanban&task=${encodeURIComponent(taskId)}`}>Abrir tarefa<ExternalLink className="ml-2 h-4 w-4" /></Link></Button></div> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
