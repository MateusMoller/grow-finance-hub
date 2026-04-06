import { FunctionsHttpError } from "@supabase/supabase-js";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type UploadMode = "new" | "existing";
type ProcessRepositoryAction =
  | "list"
  | "upsert_file"
  | "delete_file"
  | "download_file"
  | "update_process_metadata";

interface ProcessDocumentRow {
  id: string;
  process_id: string;
  process_name: string;
  process_description: string | null;
  department: string;
  status: string;
  file_name: string;
  repository_path: string;
  relative_path: string;
  file_size: number | null;
  sha: string | null;
  created_at: string;
  updated_at: string;
}

interface RepositoryInfo {
  owner: string;
  name: string;
  branch: string;
  base_path: string;
  web_url: string;
}

interface ProcessRepositoryListResponse {
  ok: boolean;
  repo: RepositoryInfo;
  documents: ProcessDocumentRow[];
}

interface ProcessRepositoryActionResponse {
  ok: boolean;
  message?: string;
  repository_path?: string;
  sha?: string;
  file_name?: string;
  content_base64?: string;
  content_type?: string;
}

interface ProcessGroup {
  processId: string;
  processName: string;
  processDescription: string | null;
  department: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  documents: ProcessDocumentRow[];
  totalBytes: number;
}

interface DepartmentShowcaseCard {
  value: string;
  title: string;
  imageUrl: string;
}

interface UploadQueueItem {
  file: File;
  relativePath: string;
}

const repositoryFunctionName = "process-repository";

const departmentOptions = [
  { value: "geral", label: "Geral" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "fiscal", label: "Fiscal" },
  { value: "dp", label: "Departamento Pessoal" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
];

const departmentShowcaseCards: DepartmentShowcaseCard[] = [
  {
    value: "dp",
    title: "Departamento Pessoal",
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  },
  {
    value: "fiscal",
    title: "Fiscal",
    imageUrl: "https://images.unsplash.com/photo-1565514020179-026b92b2d95b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    value: "contabilidade",
    title: "Contabil",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    value: "geral",
    title: "Gerencia",
    imageUrl: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&w=1200&q=80",
  },
];

const statusOptions = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_documentos", label: "Aguardando documentos" },
  { value: "concluido", label: "Concluido" },
  { value: "arquivado", label: "Arquivado" },
];

const statusClassMap: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  em_andamento: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  aguardando_documentos: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  concluido: "bg-primary/10 text-primary",
  arquivado: "bg-muted text-muted-foreground",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

const getStatusLabel = (status: string) =>
  statusOptions.find((option) => option.value === status)?.label || status;

const getDepartmentLabel = (department: string) =>
  departmentOptions.find((option) => option.value === department)?.label || department;

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
  const candidate = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.replace(/\\/g, "/");
  }
  return file.name;
};

const getRepositoryRelativePath = (document: ProcessDocumentRow) => {
  if (document.relative_path?.trim()) return document.relative_path;
  return document.file_name;
};

const toProcessSlug = (value: string) => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `processo-${Date.now()}`;
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

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Nao foi possivel ler o arquivo selecionado."));
        return;
      }

      const base64 = reader.result.split(",")[1] || "";
      if (!base64) {
        reject(new Error("Arquivo invalido para upload."));
        return;
      }

      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao converter arquivo para base64."));
    reader.readAsDataURL(file);
  });

const base64ToBlob = (base64: string, contentType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType || "application/octet-stream" });
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

const extractFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload === "object" && "error" in payload) {
        const detailed = String((payload as { error?: unknown }).error || "").trim();
        if (detailed) return detailed;
      }
    } catch {
      // fallback below
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export default function ProcessosPage() {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<ProcessDocumentRow[]>([]);
  const [repositoryInfo, setRepositoryInfo] = useState<RepositoryInfo | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const [uploadMode, setUploadMode] = useState<UploadMode>("new");
  const [processName, setProcessName] = useState("");
  const [processDescription, setProcessDescription] = useState("");
  const [processDepartment, setProcessDepartment] = useState("geral");
  const [processStatus, setProcessStatus] = useState("aberto");
  const [selectedProcessId, setSelectedProcessId] = useState("none");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [updatingProcessId, setUpdatingProcessId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const invokeRepositoryFunction = useCallback(
    async <TData,>(body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(repositoryFunctionName, { body });
      if (error) throw error;
      return data as TData;
    },
    [],
  );

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    try {
      const data = await invokeRepositoryFunction<ProcessRepositoryListResponse>({
        action: "list" as ProcessRepositoryAction,
      });
      setDocuments(data.documents || []);
      setRepositoryInfo(data.repo || null);
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, "Erro ao carregar repositorio de processos.");
      toast.error(message);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [invokeRepositoryFunction]);

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
          createdAt: document.created_at,
          updatedAt: document.updated_at,
          documents: [document],
          totalBytes: document.file_size || 0,
        });
        continue;
      }

      current.documents.push(document);
      current.totalBytes += document.file_size || 0;

      if (new Date(document.created_at).getTime() < new Date(current.createdAt).getTime()) {
        current.createdAt = document.created_at;
      }

      if (new Date(document.updated_at).getTime() >= new Date(current.updatedAt).getTime()) {
        current.updatedAt = document.updated_at;
        current.status = document.status;
        current.department = document.department;
        current.processName = document.process_name;
        current.processDescription = document.process_description;
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

  const filteredProcesses = useMemo(() => {
    const term = normalizeText(search);

    return processGroups.filter((group) => {
      if (statusFilter !== "all" && group.status !== statusFilter) return false;
      if (departmentFilter !== "all" && group.department !== departmentFilter) return false;

      if (!term) return true;

      const matchProcess =
        normalizeText(group.processName).includes(term) ||
        normalizeText(group.processDescription || "").includes(term);

      if (matchProcess) return true;

      return group.documents.some((document) => {
        const repositoryPath = getRepositoryRelativePath(document);
        return (
          normalizeText(document.file_name).includes(term) ||
          normalizeText(repositoryPath).includes(term)
        );
      });
    });
  }, [departmentFilter, processGroups, search, statusFilter]);

  const processStats = useMemo(
    () => ({
      totalProcesses: processGroups.length,
      totalDocuments: documents.length,
      completedProcesses: processGroups.filter((group) => group.status === "concluido").length,
    }),
    [documents.length, processGroups],
  );

  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const group of processGroups) {
      counts[group.department] = (counts[group.department] || 0) + 1;
    }

    return counts;
  }, [processGroups]);

  const handleDepartmentShowcaseClick = (department: string) => {
    setDepartmentFilter((previous) => (previous === department ? "all" : department));
  };

  const resetUploadSelection = () => {
    setUploadQueue([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
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

  const resetNewProcessFields = () => {
    setProcessName("");
    setProcessDescription("");
    setProcessDepartment("geral");
    setProcessStatus("aberto");
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error("Sessao invalida. Entre novamente no sistema.");
      return;
    }

    if (uploadQueue.length === 0) {
      toast.error("Selecione arquivos ou uma pasta completa para upload.");
      return;
    }

    const trimmedProcessName = processName.trim();

    let targetProcessId = "";
    let targetProcessName = "";
    let targetDescription: string | null = null;
    let targetDepartment = "geral";
    let targetStatus = "aberto";

    if (uploadMode === "new") {
      if (!trimmedProcessName) {
        toast.error("Informe o nome do processo.");
        return;
      }

      const existingIds = new Set(processGroups.map((group) => group.processId.toLowerCase()));
      const baseId = toProcessSlug(trimmedProcessName);
      let nextId = baseId;
      let suffix = 2;

      while (existingIds.has(nextId.toLowerCase())) {
        nextId = `${baseId}-${suffix}`;
        suffix += 1;
      }

      targetProcessId = nextId;
      targetProcessName = trimmedProcessName;
      targetDescription = processDescription.trim() || null;
      targetDepartment = processDepartment;
      targetStatus = processStatus;
    } else {
      if (selectedProcessId === "none") {
        toast.error("Selecione um processo para anexar os documentos.");
        return;
      }

      const selected = processGroups.find((group) => group.processId === selectedProcessId);
      if (!selected) {
        toast.error("Processo selecionado nao encontrado.");
        return;
      }

      targetProcessId = selected.processId;
      targetProcessName = selected.processName;
      targetDescription = selected.processDescription;
      targetDepartment = selected.department;
      targetStatus = selected.status;
    }

    setUploadingDocuments(true);
    let successCount = 0;
    let failCount = 0;
    let firstErrorMessage: string | null = null;

    for (const item of uploadQueue) {
      try {
        const relativePath = normalizeUploadRelativePath(item.relativePath, targetProcessId);
        const contentBase64 = await fileToBase64(item.file);

        await invokeRepositoryFunction<ProcessRepositoryActionResponse>({
          action: "upsert_file" as ProcessRepositoryAction,
          process_id: targetProcessId,
          process_name: targetProcessName,
          process_description: targetDescription,
          department: targetDepartment,
          status: targetStatus,
          relative_path: relativePath,
          file_name: item.file.name,
          file_size: item.file.size,
          mime_type: item.file.type || "application/octet-stream",
          content_base64: contentBase64,
        });

        successCount += 1;
      } catch (error) {
        failCount += 1;
        if (!firstErrorMessage) {
          firstErrorMessage = await extractFunctionErrorMessage(error, "Falha no envio para o repositorio.");
        }
      }
    }

    setUploadingDocuments(false);

    if (successCount > 0) {
      await fetchDocuments();
      resetUploadSelection();

      if (uploadMode === "new") {
        resetNewProcessFields();
      }
    }

    if (failCount > 0) {
      const baseMessage = `Upload concluido com ressalvas: ${successCount} arquivo(s) enviado(s), ${failCount} falha(s).`;
      toast.warning(firstErrorMessage ? `${baseMessage} ${firstErrorMessage}` : baseMessage);
      return;
    }

    toast.success(`${successCount} arquivo(s) enviado(s) para o repositorio do processo.`);
  };

  const handleDownload = async (document: ProcessDocumentRow) => {
    try {
      const data = await invokeRepositoryFunction<ProcessRepositoryActionResponse>({
        action: "download_file" as ProcessRepositoryAction,
        repository_path: document.repository_path,
      });

      if (!data.content_base64) {
        toast.error("Nao foi possivel baixar o arquivo selecionado.");
        return;
      }

      const blob = base64ToBlob(data.content_base64, data.content_type || "application/octet-stream");
      triggerBlobDownload(blob, data.file_name || document.file_name);
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, "Nao foi possivel baixar o arquivo.");
      toast.error(message);
    }
  };

  const handleDeleteDocument = async (document: ProcessDocumentRow) => {
    const shouldDelete = window.confirm(`Excluir o arquivo \"${document.file_name}\" do repositorio?`);
    if (!shouldDelete) return;

    setDeletingDocumentId(document.id);

    try {
      await invokeRepositoryFunction<ProcessRepositoryActionResponse>({
        action: "delete_file" as ProcessRepositoryAction,
        repository_path: document.repository_path,
        sha: document.sha,
      });

      setDocuments((previous) => previous.filter((item) => item.id !== document.id));
      toast.success("Arquivo removido do repositorio.");
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, "Erro ao excluir arquivo no repositorio.");
      toast.error(message);
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleProcessStatusChange = async (group: ProcessGroup, nextStatus: string) => {
    setUpdatingProcessId(group.processId);

    try {
      await invokeRepositoryFunction<ProcessRepositoryActionResponse>({
        action: "update_process_metadata" as ProcessRepositoryAction,
        process_id: group.processId,
        process_name: group.processName,
        process_description: group.processDescription,
        department: group.department,
        status: nextStatus,
      });

      setDocuments((previous) =>
        previous.map((document) =>
          document.process_id === group.processId
            ? { ...document, status: nextStatus, updated_at: new Date().toISOString() }
            : document,
        ),
      );

      toast.success("Status do processo atualizado.");
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, "Nao foi possivel atualizar o status do processo.");
      toast.error(message);
    } finally {
      setUpdatingProcessId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Repositorio de pastas integrado ao GitHub para armazenar os processos da Grow.
          </p>
        </motion.div>

        {repositoryInfo && (
          <Card>
            <CardContent className="p-4 text-sm space-y-1">
              <p>
                Repositorio conectado:{" "}
                <a
                  href={repositoryInfo.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {repositoryInfo.owner}/{repositoryInfo.name}
                </a>
              </p>
              <p className="text-muted-foreground">
                Branch: <strong>{repositoryInfo.branch}</strong>
                {repositoryInfo.base_path ? ` | Pasta base: ${repositoryInfo.base_path}` : " | Pasta base: raiz do repositorio"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="rounded-2xl border bg-zinc-950 p-3 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {departmentShowcaseCards.map((department, index) => {
              const isActive = departmentFilter === department.value;
              const processCount = departmentCounts[department.value] || 0;

              return (
                <motion.button
                  type="button"
                  key={department.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleDepartmentShowcaseClick(department.value)}
                  className={`group relative overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 ${
                    isActive
                      ? "border-primary ring-2 ring-primary/80 ring-offset-2 ring-offset-zinc-950"
                      : "border-white/15 hover:border-white/40"
                  }`}
                >
                  <div className="relative h-[188px]">
                    <img
                      src={department.imageUrl}
                      alt={department.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
                    <div className="absolute inset-x-0 bottom-0 px-3 py-2.5">
                      <p className="text-[22px] font-semibold text-white leading-tight">{department.title}</p>
                      <p className="text-xs text-white/75 mt-0.5">{processCount} processo(s)</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
            <span>
              Filtro rapido por setor:{" "}
              <strong className="text-zinc-100">
                {departmentFilter === "all" ? "Todos os setores" : getDepartmentLabel(departmentFilter)}
              </strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-50"
              onClick={() => setDepartmentFilter("all")}
              disabled={departmentFilter === "all"}
            >
              Limpar filtro
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Processos ativos</p>
              <p className="text-2xl font-semibold mt-1">{processStats.totalProcesses}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Arquivos versionados</p>
              <p className="text-2xl font-semibold mt-1">{processStats.totalDocuments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Processos concluidos</p>
              <p className="text-2xl font-semibold mt-1">{processStats.completedProcesses}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repositorio do processo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as UploadMode)}>
              <TabsList className="grid grid-cols-2 w-full sm:w-[320px]">
                <TabsTrigger value="new">Novo processo</TabsTrigger>
                <TabsTrigger value="existing">Processo existente</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="space-y-3 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium">Nome do processo</label>
                    <Input
                      value={processName}
                      onChange={(event) => setProcessName(event.target.value)}
                      placeholder="Ex: Admissao - Colaborador Joao"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Setor</label>
                    <Select value={processDepartment} onValueChange={setProcessDepartment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Status inicial</label>
                    <Select value={processStatus} onValueChange={setProcessStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium">Descricao (opcional)</label>
                    <Input
                      value={processDescription}
                      onChange={(event) => setProcessDescription(event.target.value)}
                      placeholder="Resumo rapido para contextualizar o processo"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="existing" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Selecione o processo</label>
                  <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um processo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecionar...</SelectItem>
                      {processGroups.map((group) => (
                        <SelectItem key={group.processId} value={group.processId}>
                          {group.processName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

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
              <p className="text-xs text-muted-foreground">
                Use <strong>Selecionar pasta</strong> para enviar a estrutura completa (subpastas e arquivos).
                Pastas vazias nao sao enviadas pelo navegador.
              </p>

              {uploadQueue.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  {uploadQueue.map((item) => (
                    <div key={`${item.relativePath}-${item.file.size}`} className="text-sm text-muted-foreground truncate">
                      {item.relativePath} - {formatBytes(item.file.size)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleUpload()} disabled={uploadingDocuments} className="gap-2">
                {uploadingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar para repositorio
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetUploadSelection}
                disabled={uploadingDocuments || uploadQueue.length === 0}
              >
                Limpar selecao
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_220px] gap-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                placeholder="Buscar por processo, descricao, arquivo ou caminho..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {departmentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loadingDocuments ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredProcesses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhum processo encontrado com os filtros atuais.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProcesses.map((group, index) => (
              <motion.div
                key={group.processId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{group.processName}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {group.processDescription || "Sem descricao cadastrada."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`border-0 ${statusClassMap[group.status] || "bg-muted text-muted-foreground"}`}>
                          {getStatusLabel(group.status)}
                        </Badge>
                        <Badge variant="secondary">{getDepartmentLabel(group.department)}</Badge>
                        <Badge variant="outline">{group.documents.length} arquivo(s)</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Atualizado em {new Date(group.updatedAt).toLocaleString("pt-BR")}
                      </span>
                      <span>Total de arquivos: {formatBytes(group.totalBytes)}</span>
                    </div>

                    <div className="max-w-[260px]">
                      <Select
                        value={group.status}
                        onValueChange={(value) => void handleProcessStatusChange(group, value)}
                        disabled={updatingProcessId === group.processId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="text-left p-3 font-medium text-muted-foreground">Arquivo</th>
                              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Caminho</th>
                              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Atualizado</th>
                              <th className="text-left p-3 font-medium text-muted-foreground">Tamanho</th>
                              <th className="p-3 w-[120px]" />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {group.documents.map((document) => (
                              <tr key={document.id} className="hover:bg-muted/20 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="truncate">{document.file_name}</p>
                                      <p className="truncate text-xs text-muted-foreground lg:hidden">
                                        {getRepositoryRelativePath(document)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 hidden lg:table-cell text-muted-foreground">
                                  <span className="truncate block max-w-[380px]">{getRepositoryRelativePath(document)}</span>
                                </td>
                                <td className="p-3 hidden md:table-cell text-muted-foreground">
                                  {new Date(document.updated_at).toLocaleDateString("pt-BR")}
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
