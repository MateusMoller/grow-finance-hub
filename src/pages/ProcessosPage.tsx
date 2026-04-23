import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, FolderOpen, Loader2, Trash2, Upload } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const processStorageBucket = "process-documents";

type ProcessDocumentDbRow = Pick<
  Tables<"process_documents">,
  | "id"
  | "process_id"
  | "process_name"
  | "process_description"
  | "department"
  | "status"
  | "file_name"
  | "file_path"
  | "file_size"
  | "updated_at"
>;

interface ProcessDocumentRow extends ProcessDocumentDbRow {
  relative_path: string;
}

interface ProcessGroup {
  processId: string;
  processName: string;
  processDescription: string | null;
  department: string;
  status: string;
  updatedAt: string;
  documents: ProcessDocumentRow[];
  totalBytes: number;
}

interface UploadQueueItem {
  file: File;
  relativePath: string;
}

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

  if (!normalized || normalized === "." || normalized === "..") return "item";
  return normalized;
};

const sanitizeRelativePath = (relativePath: string) => {
  const parts = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment));

  if (parts.length === 0) return "arquivo";
  return parts.join("/");
};

const getBrowserRelativePath = (file: File) => {
  const candidate = (file as File & { webkitRelativePathá: string }).webkitRelativePath;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.replace(/\\/g, "/");
  }
  return file.name;
};

const getDocumentRelativePath = (document: ProcessDocumentRow) => {
  if (document.relative_path?.trim()) return document.relative_path;
  return document.file_name;
};

const generateProcessId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const normalizeUploadRelativePath = (relativePath: string, processId: string) => {
  const normalized = sanitizeRelativePath(relativePath);
  const segments = normalized.split("/");
  if (segments.length === 0) return normalized;

  if (segments[0].toLowerCase() === processId.toLowerCase()) {
    const trimmed = segments.slice(1).join("/");
    return trimmed || segments[segments.length - 1];
  }

  return normalized;
};

const toStoragePath = (processId: string, relativePath: string) => {
  const normalizedRelativePath = sanitizeRelativePath(relativePath).replace(/^\/+/, "");
  return `${processId}/${normalizedRelativePath}`;
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

export default function ProcessosPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProcessDocumentRow[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    const { data, error } = await supabase
      .from("process_documents")
      .select(
        "id, process_id, process_name, process_description, department, status, file_name, file_path, file_size, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(`Erro ao carregar pastas: ${error.message}`);
      setDocuments([]);
      setLoadingDocuments(false);
      return;
    }

    const mapped = ((data || []) as ProcessDocumentDbRow[]).map((document) => {
      const normalizedPath = String(document.file_path || "").replace(/\\/g, "/");
      const processPrefix = `${document.process_id}/`;
      const relativePath = normalizedPath.startsWith(processPrefix)
        ? normalizedPath.slice(processPrefix.length) || document.file_name
        : normalizedPath || document.file_name;

      return {
        ...document,
        relative_path: relativePath,
      };
    });

    setDocuments(mapped);
    setLoadingDocuments(false);
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  const processGroups = useMemo<ProcessGroup[]>(() => {
    const grouped = new Map<string, ProcessGroup>();

    for (const document of documents) {
      const current = grouped.get(document.process_id);

      if (!current) {
        grouped.set(document.process_id, {
          processId: document.process_id,
          processName: document.process_name,
          processDescription: document.process_description,
          department: document.department,
          status: document.status,
          updatedAt: document.updated_at,
          documents: [document],
          totalBytes: document.file_size || 0,
        });
        continue;
      }

      current.documents.push(document);
      current.totalBytes += document.file_size || 0;

      if (new Date(document.updated_at).getTime() >= new Date(current.updatedAt).getTime()) {
        current.updatedAt = document.updated_at;
        current.processName = document.process_name;
        current.processDescription = document.process_description;
        current.department = document.department;
        current.status = document.status;
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        documents: [...group.documents].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [documents]);

  useEffect(() => {
    if (processGroups.length === 0) {
      setSelectedProcessId("");
      return;
    }

    const selectedExists = processGroups.some((group) => group.processId === selectedProcessId);
    if (!selectedExists) {
      setSelectedProcessId(processGroups[0].processId);
    }
  }, [processGroups, selectedProcessId]);

  const selectedGroup = useMemo(
    () => processGroups.find((group) => group.processId === selectedProcessId) || null,
    [processGroups, selectedProcessId],
  );

  const resetUploadSelection = () => {
    setUploadQueue([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const buildUploadQueue = (files: File[]) =>
    files.map((file) => ({
      file,
      relativePath: getBrowserRelativePath(file),
    }));

  const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadQueue(buildUploadQueue(files));
  };

  const handleSelectFolder = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadQueue(buildUploadQueue(files));
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error("Sessao invalida. Entre novamente no sistema.");
      return;
    }

    if (uploadQueue.length === 0) {
      toast.error("Selecione arquivos para upload.");
      return;
    }

    const trimmedFolderName = newFolderName.trim();
    let targetProcessId = "";
    let targetProcessName = "";
    let targetDescription: string | null = null;
    let targetDepartment = "geral";
    let targetStatus = "aberto";

    if (trimmedFolderName) {
      targetProcessId = generateProcessId();
      targetProcessName = trimmedFolderName;
    } else {
      if (!selectedGroup) {
        toast.error("Selecione uma pasta ou informe o nome de uma nova pasta.");
        return;
      }

      targetProcessId = selectedGroup.processId;
      targetProcessName = selectedGroup.processName;
      targetDescription = selectedGroup.processDescription;
      targetDepartment = selectedGroup.department;
      targetStatus = selectedGroup.status;
    }

    setUploadingDocuments(true);
    let successCount = 0;
    let failCount = 0;
    let firstErrorMessage: string | null = null;

    for (const item of uploadQueue) {
      try {
        const relativePath = normalizeUploadRelativePath(item.relativePath, targetProcessId);
        const storagePath = toStoragePath(targetProcessId, relativePath);

        const { error: uploadError } = await supabase.storage
          .from(processStorageBucket)
          .upload(storagePath, item.file, {
            upsert: true,
            contentType: item.file.type || undefined,
          });

        if (uploadError) {
          throw new Error(uploadError.message || "Falha ao enviar arquivo para o armazenamento.");
        }

        const { error: upsertError } = await supabase.from("process_documents").upsert(
          {
            process_id: targetProcessId,
            process_name: targetProcessName,
            process_description: targetDescription,
            department: targetDepartment,
            status: targetStatus,
            file_name: item.file.name,
            file_path: storagePath,
            file_size: item.file.size,
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "file_path" },
        );

        if (upsertError) {
          throw new Error(upsertError.message || "Falha ao registrar metadados do arquivo.");
        }

        successCount += 1;
      } catch (error) {
        failCount += 1;
        if (!firstErrorMessage) {
          firstErrorMessage =
            error instanceof Error && error.message
              ? error.message
              : "Falha no envio para a biblioteca de processos.";
        }
      }
    }

    setUploadingDocuments(false);

    if (successCount > 0) {
      await fetchDocuments();
      resetUploadSelection();
      setNewFolderName("");
      setSelectedProcessId(targetProcessId);
    }

    if (failCount > 0) {
      const baseMessage = `Upload concluído com ressalvas: ${successCount} arquivo(s) enviado(s), ${failCount} falha(s).`;
      toast.warning(firstErrorMessage ? `${baseMessage} ${firstErrorMessage}` : baseMessage);
      return;
    }

    toast.success(`${successCount} arquivo(s) enviado(s).`);
  };

  const handleDownload = async (document: ProcessDocumentRow) => {
    const { data, error } = await supabase.storage.from(processStorageBucket).download(document.file_path);
    if (error || !data) {
      toast.error(error?.message || "Não foi possível baixar o arquivo.");
      return;
    }

    triggerBlobDownload(data, document.file_name);
  };

  const handleDeleteDocument = async (document: ProcessDocumentRow) => {
    const shouldDelete = window.confirm(`Excluir o arquivo "${document.file_name}"?`);
    if (!shouldDelete) return;

    setDeletingDocumentId(document.id);

    try {
      const { error: storageError } = await supabase.storage.from(processStorageBucket).remove([document.file_path]);
      if (storageError) throw new Error(storageError.message || "Erro ao remover arquivo do armazenamento.");

      const { error: deleteError } = await supabase.from("process_documents").delete().eq("id", document.id);
      if (deleteError) throw new Error(deleteError.message || "Erro ao remover registro do processo.");

      setDocuments((previous) => previous.filter((item) => item.id !== document.id));
      toast.success("Arquivo removido.");
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Erro ao excluir arquivo da biblioteca.";
      toast.error(message);
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold">Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biblioteca simples em formato de pastas para guardar e enviar arquivos.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pastas</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDocuments ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : processGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma pasta criada ainda. Envie arquivos para criar a primeira pasta.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {processGroups.map((group) => {
                  const isSelected = selectedProcessId === group.processId;
                  return (
                    <button
                      key={group.processId}
                      type="button"
                      onClick={() => setSelectedProcessId(group.processId)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{group.processName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {group.documents.length} arquivo(s) - {formatBytes(group.totalBytes)}
                          </p>
                        </div>
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Atualizado em {new Date(group.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload de arquivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nova pasta (opcional)</label>
              <Input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Ex: Admissão - Colaborador João"
              />
              <p className="text-xs text-muted-foreground">
                Se preencher, o upload cria uma nova pasta. Se deixar em branco, envia para a pasta selecionada.
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Pasta selecionada:{" "}
              <strong>{selectedGroup ? selectedGroup.processName : "Nenhuma pasta selecionada"}</strong>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" /> Selecionar arquivos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                  className="gap-2"
                >
                  <FolderOpen className="h-4 w-4" /> Selecionar pasta
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleSelectFiles}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleSelectFolder}
                />
                {uploadQueue.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {uploadQueue.length} arquivo(s) selecionado(s)
                  </span>
                )}
              </div>

              {uploadQueue.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 max-h-52 overflow-auto">
                  {uploadQueue.map((item) => (
                    <div
                      key={`${item.relativePath}-${item.file.size}`}
                      className="text-sm text-muted-foreground truncate"
                    >
                      {item.relativePath} - {formatBytes(item.file.size)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleUpload()} disabled={uploadingDocuments} className="gap-2">
                {uploadingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar arquivos
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetUploadSelection}
                disabled={uploadingDocuments || uploadQueue.length === 0}
              >
                Limpar seleção
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos da pasta selecionada</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedGroup ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">Selecione uma pasta para visualizar os arquivos.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left p-3 font-medium text-muted-foreground">Arquivo</th>
                        <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">
                          Caminho
                        </th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Tamanho</th>
                        <th className="p-3 w-[120px]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedGroup.documents.map((document) => (
                        <tr key={document.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate">{document.file_name}</p>
                                <p className="truncate text-xs text-muted-foreground md:hidden">
                                  {getDocumentRelativePath(document)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell text-muted-foreground">
                            <span className="truncate block max-w-[420px]">{getDocumentRelativePath(document)}</span>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatBytes(document.file_size)}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => void handleDownload(document)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => void handleDeleteDocument(document)}
                                disabled={deletingDocumentId === document.id}
                              >
                                {deletingDocumentId === document.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
