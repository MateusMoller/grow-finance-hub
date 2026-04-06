import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ProcessDocumentRow = Database["public"]["Tables"]["process_documents"]["Row"];
type UploadMode = "new" | "existing";

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

const sanitizeFileName = (fileName: string) =>
  fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

export default function ProcessosPage() {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<ProcessDocumentRow[]>([]);
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [updatingProcessId, setUpdatingProcessId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    const { data, error } = await supabase
      .from("process_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar documentos dos processos.");
      setLoadingDocuments(false);
      return;
    }

    setDocuments((data || []) as ProcessDocumentRow[]);
    setLoadingDocuments(false);
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

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
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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

      return group.documents.some((document) => normalizeText(document.file_name).includes(term));
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

  const resetFileInput = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    if (selectedFiles.length === 0) {
      toast.error("Selecione ao menos um documento para upload.");
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

      targetProcessId = crypto.randomUUID();
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

    for (const file of selectedFiles) {
      const safeName = sanitizeFileName(file.name);
      const filePath = `${targetProcessId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("process-documents")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        failCount += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("process_documents").insert({
        process_id: targetProcessId,
        process_name: targetProcessName,
        process_description: targetDescription,
        department: targetDepartment,
        status: targetStatus,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        created_by: user.id,
      });

      if (insertError) {
        failCount += 1;
        await supabase.storage.from("process-documents").remove([filePath]);
        continue;
      }

      successCount += 1;
    }

    setUploadingDocuments(false);

    if (successCount > 0) {
      await fetchDocuments();
      resetFileInput();

      if (uploadMode === "new") {
        resetNewProcessFields();
      }
    }

    if (failCount > 0) {
      toast.warning(`Upload concluido com ressalvas: ${successCount} arquivo(s) enviado(s), ${failCount} falha(s).`);
      return;
    }

    toast.success(`${successCount} arquivo(s) enviado(s) para o processo.`);
  };

  const handleDownload = async (document: ProcessDocumentRow) => {
    const { data, error } = await supabase.storage
      .from("process-documents")
      .createSignedUrl(document.file_path, 120);

    if (error || !data?.signedUrl) {
      toast.error("Nao foi possivel gerar o link de download.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeleteDocument = async (document: ProcessDocumentRow) => {
    const shouldDelete = window.confirm(`Excluir o documento \"${document.file_name}\"?`);
    if (!shouldDelete) return;

    setDeletingDocumentId(document.id);

    const { error: deleteError } = await supabase
      .from("process_documents")
      .delete()
      .eq("id", document.id);

    if (deleteError) {
      setDeletingDocumentId(null);
      toast.error("Erro ao excluir documento do processo.");
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("process-documents")
      .remove([document.file_path]);

    setDeletingDocumentId(null);

    if (storageError) {
      toast.warning("Documento removido da lista, mas houve falha ao excluir o arquivo fisico.");
    } else {
      toast.success("Documento removido.");
    }

    setDocuments((previous) => previous.filter((item) => item.id !== document.id));
  };

  const handleProcessStatusChange = async (processId: string, nextStatus: string) => {
    setUpdatingProcessId(processId);

    const { error } = await supabase
      .from("process_documents")
      .update({ status: nextStatus })
      .eq("process_id", processId);

    setUpdatingProcessId(null);

    if (error) {
      toast.error("Nao foi possivel atualizar o status do processo.");
      return;
    }

    setDocuments((previous) =>
      previous.map((document) =>
        document.process_id === processId
          ? { ...document, status: nextStatus, updated_at: new Date().toISOString() }
          : document,
      ),
    );

    toast.success("Status do processo atualizado.");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Processos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre processos e concentre todos os documentos em um unico lugar.
          </p>
        </motion.div>

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
              <p className="text-xs text-muted-foreground">Documentos hospedados</p>
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
            <CardTitle className="text-base">Novo upload de processo</CardTitle>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                />
                {selectedFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedFiles.length} arquivo(s) selecionado(s)
                  </span>
                )}
              </div>

              {selectedFiles.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  {selectedFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="text-sm text-muted-foreground truncate">
                      {file.name} - {formatBytes(file.size)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleUpload()} disabled={uploadingDocuments} className="gap-2">
                {uploadingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar documentos
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFileInput}
                disabled={uploadingDocuments || selectedFiles.length === 0}
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
                placeholder="Buscar por processo, descricao ou documento..."
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
                        <Badge variant="outline">{group.documents.length} documento(s)</Badge>
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
                        onValueChange={(value) => void handleProcessStatusChange(group.processId, value)}
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
                              <th className="text-left p-3 font-medium text-muted-foreground">Documento</th>
                              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Data</th>
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
                                    <span className="truncate">{document.file_name}</span>
                                  </div>
                                </td>
                                <td className="p-3 hidden md:table-cell text-muted-foreground">
                                  {new Date(document.created_at).toLocaleDateString("pt-BR")}
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
