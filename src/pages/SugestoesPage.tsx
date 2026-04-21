import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ClipboardList, Download, Lightbulb, Loader2, Paperclip, RefreshCcw, Send, X } from "lucide-react";
import { toast } from "sonner";

type SuggestionTask = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "description" | "status" | "priority" | "created_at" | "created_by"
>;

type SuggestionAttachment = Pick<
  Tables<"process_documents">,
  "id" | "process_id" | "file_name" | "file_path" | "file_size" | "updated_at"
>;

const areaOptions = [
  "Portal do cliente",
  "Kanban",
  "Atendimento",
  "Financeiro",
  "Relatórios",
  "Automacoes",
  "Outros",
];

const priorityOptions = ["Baixa", "Media", "Alta", "Urgente"];

const statusMeta: Record<string, { label: string; className: string }> = {
  backlog: { label: "Pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
  todo: { label: "A fazer", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
  doing: { label: "Em andamento", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  review: { label: "Em revisão", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300" },
  done: { label: "Concluída", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  archived: { label: "Arquivada", className: "bg-muted text-muted-foreground" },
};

const priorityMeta: Record<string, string> = {
  Baixa: "bg-muted text-muted-foreground",
  Media: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  Alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  Urgente: "bg-destructive/10 text-destructive",
};

const processStorageBucket = "process-documents";

const formatBytes = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const sanitizePathSegment = (segment: string) => {
  const normalized = segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-\s]/g, "")
    .trim();

  if (!normalized || normalized === "." || normalized === "..") return "arquivo";
  return normalized;
};

const toStoragePath = (suggestionId: string, fileName: string) => {
  const safeName = sanitizePathSegment(fileName).replace(/\s+/g, "_");
  return `suggestions/${suggestionId}/${Date.now()}_${safeName}`;
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export default function SugestoesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [records, setRecords] = useState<SuggestionTask[]>([]);
  const [attachments, setAttachments] = useState<SuggestionAttachment[]>([]);
  const [profileName, setProfileName] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [area, setArea] = useState(areaOptions[0]);
  const [details, setDetails] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [priority, setPriority] = useState("Media");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const name = String(data?.display_name || "").trim();
    setProfileName(name || user.email || "Usuário interno");
  }, [user?.email, user?.id]);

  const loadRecords = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("id, title, description, status, priority, created_at, created_by")
      .contains("tags", ["sugestão_sistema"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Não foi possível carregar o registro de sugestões.");
      setAttachments([]);
      setLoading(false);
      return;
    }

    const taskRows = (data || []) as SuggestionTask[];
    setRecords(taskRows);

    const taskIds = taskRows.map((row) => row.id);
    if (taskIds.length === 0) {
      setAttachments([]);
      setLoading(false);
      return;
    }

    const { data: attachmentRows, error: attachmentsError } = await supabase
      .from("process_documents")
      .select("id, process_id, file_name, file_path, file_size, updated_at")
      .in("process_id", taskIds)
      .order("updated_at", { ascending: false });

    if (attachmentsError) {
      toast.error("Não foi possível carregar os anexos das sugestões.");
      setAttachments([]);
      setLoading(false);
      return;
    }

    setAttachments((attachmentRows || []) as SuggestionAttachment[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadProfile();
    void loadRecords();
  }, [loadProfile, loadRecords, user?.id]);

  const pendingCount = useMemo(
    () => records.filter((record) => record.status !== "done" && record.status !== "archived").length,
    [records],
  );

  const attachmentsBySuggestion = useMemo(() => {
    const map = new Map<string, SuggestionAttachment[]>();
    for (const attachment of attachments) {
      const list = map.get(attachment.process_id) || [];
      list.push(attachment);
      map.set(attachment.process_id, list);
    }
    return map;
  }, [attachments]);

  const handleAttachmentSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setAttachmentFiles((prev) => [...prev, ...files]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleDownloadAttachment = async (attachment: SuggestionAttachment) => {
    setDownloadingAttachmentId(attachment.id);
    const { data, error } = await supabase.storage.from(processStorageBucket).download(attachment.file_path);
    setDownloadingAttachmentId(null);

    if (error || !data) {
      toast.error(error?.message || "Não foi possível baixar o anexo.");
      return;
    }

    triggerBlobDownload(data, attachment.file_name);
  };

  const handleSendSuggestion = async () => {
    if (!user?.id) return;
    if (!title.trim()) {
      toast.error("Informe o titulo da sugestão.");
      return;
    }
    if (!details.trim()) {
      toast.error("Descreva a melhoria sugerida.");
      return;
    }

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    const description = [
      "Solicitação de melhoria enviada por usuário interno.",
      `Area sugerida: ${area}`,
      `Resultado esperado: ${expectedResult.trim() || "Não informado"}`,
      "",
      "Detalhes:",
      details.trim(),
      "",
      `Solicitante: ${profileName || user.email || "Usuário interno"}`,
      `Email: ${user.email || "Não informado"}`,
      `Enviado em: ${now.toLocaleString("pt-BR")}`,
    ].join("\n");

    const normalizedTitle = title.trim();

    setSending(true);
    const { data: createdTask, error } = await supabase
      .from("kanban_tasks")
      .insert({
        title: `[Sugestão] ${normalizedTitle}`,
        description,
        client_name: "Sugestões internas",
        assignee: "Admin",
        priority,
        sector: "Geral",
        status: "backlog",
        due_date: dueDate.toISOString().slice(0, 10),
        tags: ["sugestão_sistema", "sugestão", "admin"],
        created_by: user.id,
      })
      .select("id, title")
      .single();

    if (error || !createdTask) {
      setSending(false);
      toast.error(`Não foi possível registrar a sugestão: ${error?.message || "Erro desconhecido"}`);
      return;
    }

    let uploadSuccess = 0;
    let uploadFail = 0;
    let firstUploadError: string | null = null;

    for (const file of attachmentFiles) {
      const storagePath = toStoragePath(createdTask.id, file.name);

      const { error: uploadError } = await supabase.storage
        .from(processStorageBucket)
        .upload(storagePath, file, { contentType: file.type || undefined });

      if (uploadError) {
        uploadFail += 1;
        if (!firstUploadError) firstUploadError = uploadError.message || "Falha ao enviar anexo.";
        continue;
      }

      const { error: metadataError } = await supabase.from("process_documents").insert({
        process_id: createdTask.id,
        process_name: createdTask.title,
        process_description: `Sugestão enviada por ${profileName || user.email || "Usuário interno"}`,
        department: "geral",
        status: "aberto",
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        created_by: user.id,
      });

      if (metadataError) {
        uploadFail += 1;
        if (!firstUploadError) {
          firstUploadError = metadataError.message || "Falha ao registrar metadados do anexo.";
        }
        await supabase.storage.from(processStorageBucket).remove([storagePath]);
        continue;
      }

      uploadSuccess += 1;
    }

    setSending(false);

    setTitle("");
    setArea(areaOptions[0]);
    setDetails("");
    setExpectedResult("");
    setPriority("Media");
    setAttachmentFiles([]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";

    if (uploadFail > 0) {
      const baseMessage = `Sugestão criada. ${uploadSuccess} anexo(s) enviado(s) e ${uploadFail} com falha.`;
      toast.warning(firstUploadError ? `${baseMessage} ${firstUploadError}` : baseMessage);
    } else if (uploadSuccess > 0) {
      toast.success(`Sugestão enviada ao admin com ${uploadSuccess} anexo(s).`);
    } else {
      toast.success("Sugestão enviada ao admin e pendência criada no Kanban.");
    }

    await loadRecords();
  };

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Sugestoes de melhoria</h1>
            <p className="text-sm text-muted-foreground">
              Envie melhorias para o admin. Cada envio gera uma pendência e um registro desta solicitação.
            </p>
          </div>
          <Button variant="outline" className="gap-1.5" onClick={() => void loadRecords()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Atualizar registro
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Nova sugestão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder="Ex: Adicionar filtro por período no relatório"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Area</Label>
                  <Select value={area} onValueChange={setArea}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {areaOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade sugerida</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Detalhes da melhoria</Label>
                <Textarea
                  className="min-h-[130px]"
                  placeholder="Explique o problema atual e como a melhoria ajudaria no dia a dia."
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Resultado esperado</Label>
                <Input
                  placeholder="Ex: reduzir retrabalho no fechamento mensal"
                  value={expectedResult}
                  onChange={(event) => setExpectedResult(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Anexar documentos (opcional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    Anexar arquivos
                  </Button>
                </div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachmentSelection}
                />
                {attachmentFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum anexo selecionado.</p>
                ) : (
                  <div className="space-y-2">
                    {attachmentFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeAttachmentFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button className="gap-1.5" onClick={() => void handleSendSuggestion()} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar sugestão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo rapido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground">Total de solicitações registradas</p>
                <p className="text-2xl font-semibold">{records.length}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground">Pendências em aberto</p>
                <p className="text-2xl font-semibold">{pendingCount}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground">Fluxo</p>
                <p>
                  Cada sugestão vira tarefa no Kanban com responsavel <strong>Admin</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Registro das solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-lg border bg-muted/20 p-8 text-center">
                <p className="font-medium">Nenhuma sugestão registrada ainda.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Envie a primeira melhoria para gerar a pendência e criar o histórico.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {records.map((record) => {
                  const status = statusMeta[record.status] || {
                    label: record.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  const priorityClass = priorityMeta[record.priority] || "bg-muted text-muted-foreground";
                  const recordAttachments = attachmentsBySuggestion.get(record.id) || [];

                  return (
                    <div key={record.id} className="rounded-lg border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium line-clamp-1">{record.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Criado em {new Date(record.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`border-0 ${status.className}`}>
                            {status.label}
                          </Badge>
                          <Badge variant="outline" className={`border-0 ${priorityClass}`}>
                            {record.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {recordAttachments.length} anexo(s)
                          </Badge>
                        </div>
                      </div>
                      {record.description && (
                        <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line line-clamp-5">
                          {record.description}
                        </p>
                      )}
                      {recordAttachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground">Anexos da solicitação</p>
                          <div className="flex flex-wrap gap-2">
                            {recordAttachments.map((attachment) => (
                              <Button
                                key={attachment.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto py-1.5 gap-1.5"
                                onClick={() => void handleDownloadAttachment(attachment)}
                                disabled={downloadingAttachmentId === attachment.id}
                              >
                                {downloadingAttachmentId === attachment.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                <span className="max-w-[220px] truncate text-xs">{attachment.file_name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({formatBytes(attachment.file_size)})
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
