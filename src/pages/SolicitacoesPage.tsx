import { useState, useEffect } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  MessageSquare, Clock, AlertCircle, CheckCircle2, X,
  Search, Filter, ChevronRight, Loader2, User, Headset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RequestChat } from "@/components/app/RequestChat";

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
  user_id: string;
  profile?: { display_name: string | null } | null;
}

const statusConfig: Record<RequestStatus, { label: string; icon: typeof Clock; class: string }> = {
  pending: { label: "Pendente", icon: Clock, class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  in_progress: { label: "Em andamento", icon: AlertCircle, class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Concluída", icon: CheckCircle2, class: "bg-primary/10 text-primary" },
  cancelled: { label: "Cancelada", icon: X, class: "bg-destructive/10 text-destructive" },
};

export default function SolicitacoesPage() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Get profiles for user names
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      setRequests(
        data.map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) || null }))
      );
    }
    if (error) toast.error("Erro ao carregar solicitações");
    setLoading(false);
  };

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    setUpdatingStatus(true);
    const { error } = await supabase
      .from("client_requests")
      .update({ status: newStatus })
      .eq("id", requestId);

    setUpdatingStatus(false);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado!");
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );
    if (selectedRequest?.id === requestId) {
      setSelectedRequest((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
  };

  const filtered = requests.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.profile?.display_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    inProgress: requests.filter((r) => r.status === "in_progress").length,
  };

  return (
    <AppLayout>
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Solicitações de Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie solicitações e comunique-se diretamente com os clientes
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, icon: MessageSquare },
          { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-600" },
          { label: "Em Andamento", value: stats.inProgress, icon: AlertCircle, color: "text-blue-600" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color || "text-foreground"}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-2xl font-bold">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            placeholder="Buscar por título ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
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

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req, i) => {
            const sc = statusConfig[req.status];
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-4"
                onClick={() => { setSelectedRequest(req); setDetailOpen(true); }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{req.title}</span>
                    <Badge variant="outline" className={`text-xs border-0 shrink-0 ${sc.class}`}>
                      <sc.icon className="h-3 w-3 mr-1" />{sc.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {req.profile?.display_name || "Cliente"}
                    </span>
                    <span>•</span>
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

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedRequest && (() => {
            const sc = statusConfig[selectedRequest.status];
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{selectedRequest.title}</SheetTitle>
                </SheetHeader>
                <div className="space-y-5 mt-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className={`border-0 ${sc.class}`}>
                      <sc.icon className="h-3 w-3 mr-1" />{sc.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{selectedRequest.category}</span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {selectedRequest.profile?.display_name || "Cliente"}
                    </span>
                  </div>

                  {/* Status change */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Alterar Status</label>
                    <Select
                      value={selectedRequest.status}
                      onValueChange={(v) => handleStatusChange(selectedRequest.id, v as RequestStatus)}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <span className="font-medium">
                        {new Date(selectedRequest.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Atualizada em</span>
                      <span className="font-medium">
                        {new Date(selectedRequest.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Chat */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Headset className="h-3.5 w-3.5" /> Conversa com o Cliente
                    </h4>
                    <RequestChat requestId={selectedRequest.id} isTeamMember={true} />
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
    </AppLayout>
  );
}
