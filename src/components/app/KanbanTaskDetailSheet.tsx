import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Building2, Download, FileText, FolderOpen, Loader2, User } from "lucide-react";
import { toast } from "sonner";

export type KanbanStatus = "backlog" | "todo" | "doing" | "review" | "done";

export interface KanbanTaskItem {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  assignee: string | null;
  priority: string;
  sector: string;
  status: KanbanStatus;
  due_date: string | null;
  tags: string[];
  request_id: string | null;
  created_at: string;
}

type SavePayload = {
  description: string | null;
  client_name: string | null;
  assignee: string | null;
  priority: string;
  sector: string;
  status: KanbanStatus;
  due_date: string | null;
  tags: string[];
};

interface LinkedRequestInfo {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sector: string;
  status: string;
  created_at: string;
}

interface LinkedRequestAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface KanbanTaskDetailSheetProps {
  task: KanbanTaskItem | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: SavePayload) => Promise<void>;
}

const statusLabels: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "A Fazer",
  doing: "Em Andamento",
  review: "Em Revisao",
  done: "Concluido",
};

const priorityOptions = ["Urgente", "Alta", "Média", "Baixa"];
const sectorOptions = ["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "Societário", "Geral"];

export function KanbanTaskDetailSheet({
  task,
  open,
  saving = false,
  onOpenChange,
  onSave,
}: KanbanTaskDetailSheetProps) {
  const [form, setForm] = useState({
    description: "",
    client_name: "",
    assignee: "",
    priority: "Média",
    sectors: [] as string[],
    status: "backlog" as KanbanStatus,
    due_date: "",
  });
  const [requestInfo, setRequestInfo] = useState<LinkedRequestInfo | null>(null);
  const [requestAttachments, setRequestAttachments] = useState<LinkedRequestAttachment[]>([]);
  const [loadingRequest, setLoadingRequest] = useState(false);

  useEffect(() => {
    if (!task) return;

    const sectors = task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
    setForm({
      description: task.description || "",
      client_name: task.client_name || "",
      assignee: task.assignee || "",
      priority: task.priority || "Média",
      sectors,
      status: task.status,
      due_date: task.due_date || "",
    });
  }, [task]);

  useEffect(() => {
    if (!open || !task?.request_id) {
      setRequestInfo(null);
      setRequestAttachments([]);
      return;
    }

    let cancelled = false;
    const loadRequestData = async () => {
      setLoadingRequest(true);
      const [requestRes, docsRes] = await Promise.all([
        supabase
          .from("client_requests")
          .select("id, title, description, category, sector, status, created_at")
          .eq("id", task.request_id)
          .maybeSingle(),
        supabase
          .from("client_documents")
          .select("id, file_name, file_path, file_size, created_at")
          .eq("request_id", task.request_id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (requestRes.error) {
        toast.error("Nao foi possivel carregar os dados da solicitacao.");
      }
      if (docsRes.error) {
        toast.error("Nao foi possivel carregar os anexos da solicitacao.");
      }

      setRequestInfo((requestRes.data as LinkedRequestInfo | null) || null);
      setRequestAttachments((docsRes.data as LinkedRequestAttachment[]) || []);
      setLoadingRequest(false);
    };

    void loadRequestData();

    return () => {
      cancelled = true;
    };
  }, [open, task?.request_id]);

  if (!task) return null;

  const toggleSector = (sector: string) => {
    setForm((prev) => {
      const selected = prev.sectors.includes(sector)
        ? prev.sectors.filter((item) => item !== sector)
        : [...prev.sectors, sector];
      return { ...prev, sectors: selected };
    });
  };

  const handleSave = async () => {
    if (form.sectors.length === 0) {
      toast.error("Selecione pelo menos um setor.");
      return;
    }

    await onSave(task.id, {
      description: form.description.trim() || null,
      client_name: form.client_name.trim() || null,
      assignee: form.assignee.trim() || null,
      priority: form.priority,
      sector: form.sectors[0],
      status: form.status,
      due_date: form.due_date || null,
      tags: form.sectors,
    });
  };

  const handleDownloadAttachment = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast.error("Nao foi possivel gerar o link do anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs border-0 bg-muted">
              {form.priority}
            </Badge>
            <Badge variant="outline" className="text-xs border-0 bg-primary/10 text-primary">
              {statusLabels[form.status]}
            </Badge>
          </div>
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Cliente
              </span>
              <span className="text-sm font-medium">{form.client_name || "Nao informado"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Responsavel
              </span>
              <span className="text-sm font-medium">{form.assignee || "Nao informado"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-3 w-3" /> Setores
              </span>
              <span className="text-sm font-medium">
                {form.sectors.length > 0 ? form.sectors.join(", ") : "Nao informado"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Prazo
              </span>
              <span className="text-sm font-medium">
                {form.due_date ? new Date(form.due_date).toLocaleDateString("pt-BR") : "Sem prazo"}
              </span>
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="informacoes" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="informacoes">Informacoes</TabsTrigger>
              <TabsTrigger value="solicitacao">Solicitacao</TabsTrigger>
            </TabsList>

            <TabsContent value="informacoes" className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as KanbanStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="doing">Em Andamento</SelectItem>
                    <SelectItem value="review">Em Revisao</SelectItem>
                    <SelectItem value="done">Concluido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input type="date" value={form.due_date} onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input value={form.client_name} onChange={(event) => setForm((prev) => ({ ...prev, client_name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Responsavel</Label>
                  <Input value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Setores (selecao multipla)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3">
                  {sectorOptions.map((sector) => (
                    <label key={sector} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={form.sectors.includes(sector)} onCheckedChange={() => toggleSector(sector)} />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Detalhes da tarefa..."
                />
              </div>
            </TabsContent>

            <TabsContent value="solicitacao" className="space-y-4">
              {!task.request_id ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta tarefa nao veio de uma solicitacao de cliente.
                </div>
              ) : loadingRequest ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Data de envio</Label>
                    <Input
                      value={requestInfo?.created_at ? new Date(requestInfo.created_at).toLocaleString("pt-BR") : "-"}
                      readOnly
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Informacoes</Label>
                    <Textarea
                      rows={5}
                      value={requestInfo?.description || "Sem informacoes adicionais da solicitacao."}
                      readOnly
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Anexos ({requestAttachments.length})</Label>
                    {requestAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhum anexo enviado nesta solicitacao.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {requestAttachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{attachment.file_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {attachment.file_size ? `${Math.round(attachment.file_size / 1024)} KB` : "Tamanho nao informado"}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => handleDownloadAttachment(attachment.file_path)}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Baixar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {requestInfo && (
                    <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Titulo: {requestInfo.title}
                      </div>
                      <div>Categoria: {requestInfo.category}</div>
                      <div>Setor solicitado: {requestInfo.sector}</div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alteracoes"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
