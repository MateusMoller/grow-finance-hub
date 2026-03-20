import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Clock, CheckCircle2, AlertCircle, Plus,
  Download, Trash2, Eye, Search, Filter, Send, Paperclip,
  FolderOpen, MessageSquare, ChevronRight, X, Loader2,
} from "lucide-react";
import { RequestChat } from "@/components/app/RequestChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type RequestStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface ClientRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  category: string;
  request_id: string | null;
  created_at: string;
}

const statusConfig: Record<RequestStatus, { label: string; icon: typeof Clock; class: string }> = {
  pending: { label: "Pendente", icon: Clock, class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  in_progress: { label: "Em andamento", icon: AlertCircle, class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Concluída", icon: CheckCircle2, class: "bg-primary/10 text-primary" },
  cancelled: { label: "Cancelada", icon: X, class: "bg-destructive/10 text-destructive" },
};

const docCategories = [
  "Documentos Cadastrais",
  "Documentos Fiscais",
  "Documentos Contábeis",
  "Dept. Pessoal",
  "Contratos",
  "Outros",
];

const requestCategories = [
  "Consulta Fiscal",
  "Documentação",
  "Folha de Pagamento",
  "Contabilidade",
  "Abertura/Alteração Empresa",
  "Outros",
];

const sectorOptions = [
  { label: "Contábil", value: "Contábil" },
  { label: "Fiscal", value: "Fiscal" },
  { label: "Departamento Pessoal", value: "Departamento Pessoal" },
  { label: "Financeiro", value: "Financeiro" },
  { label: "Comercial", value: "Comercial" },
  { label: "Societário", value: "Societário" },
  { label: "Geral", value: "Geral" },
];

export default function PortalClientePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // New request form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Outros");
  const [newSector, setNewSector] = useState("Geral");
  const [submitting, setSubmitting] = useState(false);

  // Upload form
  const [uploadCategory, setUploadCategory] = useState("Outros");
  const [uploadRequestId, setUploadRequestId] = useState<string>("none");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoadingData(true);
    const [reqRes, docRes] = await Promise.all([
      supabase.from("client_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("client_documents").select("*").order("created_at", { ascending: false }),
    ]);
    if (reqRes.data) setRequests(reqRes.data as ClientRequest[]);
    if (docRes.data) setDocuments(docRes.data as ClientDocument[]);
    setLoadingData(false);
  };

  const handleCreateRequest = async () => {
    if (!newTitle.trim()) { toast.error("Informe o título da solicitação"); return; }
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("client_requests").insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      category: newCategory,
    });
    setSubmitting(false);
    if (error) { toast.error("Erro ao criar solicitação"); return; }
    toast.success("Solicitação criada com sucesso!");
    setNewTitle(""); setNewDescription(""); setNewCategory("Outros");
    setNewRequestOpen(false);
    fetchData();
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { error: dbError } = await supabase.from("client_documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        category: uploadCategory,
        request_id: uploadRequestId !== "none" ? uploadRequestId : null,
      });

      if (dbError) {
        toast.error(`Erro ao registrar ${file.name}`);
      } else {
        uploaded++;
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      toast.success(`${uploaded} arquivo(s) enviado(s) com sucesso!`);
      setUploadDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteDocument = async (doc: ClientDocument) => {
    const { error: storageError } = await supabase.storage
      .from("client-documents")
      .remove([doc.file_path]);
    if (storageError) { toast.error("Erro ao excluir arquivo"); return; }

    await supabase.from("client_documents").delete().eq("id", doc.id);
    toast.success("Documento excluído");
    fetchData();
  };

  const handleDownload = async (doc: ClientDocument) => {
    const { data } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    inProgress: requests.filter(r => r.status === "in_progress").length,
    completed: requests.filter(r => r.status === "completed").length,
    docs: documents.length,
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">G</span>
            </div>
            <div>
              <span className="font-bold text-sm">Portal do Cliente</span>
              <span className="text-xs text-muted-foreground block -mt-0.5">Grow Finance</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/login"); }}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Solicitações", value: stats.total, icon: MessageSquare, color: "text-foreground" },
            { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-600" },
            { label: "Em Andamento", value: stats.inProgress, icon: AlertCircle, color: "text-blue-600" },
            { label: "Concluídas", value: stats.completed, icon: CheckCircle2, color: "text-primary" },
            { label: "Documentos", value: stats.docs, icon: FolderOpen, color: "text-foreground" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-2xl font-bold">{s.value}</span>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="requests" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="requests" className="gap-1.5">
                <MessageSquare className="h-4 w-4" /> Solicitações
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5">
                <FolderOpen className="h-4 w-4" /> Documentos
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Nova Solicitação
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Solicitação</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Título</label>
                      <Input placeholder="Ex: Emissão de certidão negativa" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Categoria</label>
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {requestCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Descrição</label>
                      <Textarea placeholder="Descreva sua solicitação em detalhes..." rows={4} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                    </div>
                    <Button className="w-full gap-2" onClick={handleCreateRequest} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar Solicitação
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Upload className="h-4 w-4" /> Enviar Documento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar Documento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Categoria</label>
                      <Select value={uploadCategory} onValueChange={setUploadCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {docCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Vincular a solicitação (opcional)</label>
                      <Select value={uploadRequestId} onValueChange={setUploadRequestId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {requests.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div
                      className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      ) : (
                        <>
                          <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, XLSX, DOC, JPG até 10MB</p>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                  placeholder="Buscar solicitação..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="bg-card border rounded-xl p-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Nenhuma solicitação encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">Crie sua primeira solicitação clicando no botão acima</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((req, i) => {
                  const sc = statusConfig[req.status];
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => { setSelectedRequest(req); setRequestDetailOpen(true); }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{req.title}</span>
                          <Badge variant="outline" className={`text-xs border-0 shrink-0 ${sc.class}`}>
                            <sc.icon className="h-3 w-3 mr-1" />{sc.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{req.category}</span>
                          <span>•</span>
                          <span>{new Date(req.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-card border rounded-xl p-12 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Nenhum documento enviado</p>
                <p className="text-sm text-muted-foreground mt-1">Envie seus documentos clicando no botão acima</p>
              </div>
            ) : (
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium text-muted-foreground">Arquivo</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Tamanho</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documents.map((doc, i) => (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">{doc.file_name}</span>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground">{doc.category}</td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "-"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDocument(doc)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Request Detail Sheet */}
      <Sheet open={requestDetailOpen} onOpenChange={setRequestDetailOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedRequest && (() => {
            const sc = statusConfig[selectedRequest.status];
            const relatedDocs = documents.filter(d => d.request_id === selectedRequest.id);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{selectedRequest.title}</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`border-0 ${sc.class}`}>
                      <sc.icon className="h-3 w-3 mr-1" />{sc.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{selectedRequest.category}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-1">Descrição</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.description || "Sem descrição informada."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Criada em</span>
                      <span className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Atualizada em</span>
                      <span className="font-medium">{new Date(selectedRequest.updated_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>

                  {/* Chat / Mensagens */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Mensagens
                    </h4>
                    <RequestChat requestId={selectedRequest.id} isTeamMember={false} />
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Documentos vinculados ({relatedDocs.length})</h4>
                    {relatedDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum documento vinculado a esta solicitação.</p>
                    ) : (
                      <div className="space-y-2">
                        {relatedDocs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{doc.file_name}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDownload(doc)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
