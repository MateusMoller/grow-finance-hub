import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ReportDatasetId = "clientes" | "leads_crm" | "tarefas" | "equipe";
type ExportFormat = "csv" | "xlsx";

type SavedReportRow = Pick<
  Tables<"saved_reports">,
  "id" | "name" | "dataset_id" | "column_keys" | "format" | "created_at" | "updated_at"
>;

interface SavedReportConfig {
  id: string;
  name: string;
  datasetId: ReportDatasetId;
  columnKeys: string[];
  format: ExportFormat;
  createdAt: string;
  updatedAt: string;
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const reportDatasetLabels: Record<ReportDatasetId, string> = {
  clientes: "Clientes",
  leads_crm: "Leads CRM",
  tarefas: "Tarefas",
  equipe: "Equipe",
};

const reportDatasetIds = Object.keys(reportDatasetLabels) as ReportDatasetId[];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const isValidReportDatasetId = (value: string): value is ReportDatasetId =>
  reportDatasetIds.includes(value as ReportDatasetId);

const mapSavedReportRow = (row: SavedReportRow): SavedReportConfig | null => {
  const name = String(row.name || "").trim();
  if (!name || !isValidReportDatasetId(row.dataset_id)) return null;

  const columnKeys = Array.isArray(row.column_keys)
    ? row.column_keys.filter((key): key is string => typeof key === "string" && key.trim().length > 0)
    : [];

  if (columnKeys.length === 0) return null;

  return {
    id: row.id,
    name,
    datasetId: row.dataset_id,
    columnKeys,
    format: row.format === "csv" ? "csv" : "xlsx",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export default function RelatoriosSalvosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportConfig[]>([]);
  const [search, setSearch] = useState("");

  const loadSavedReports = useCallback(async () => {
    if (!user?.id) {
      setSavedReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("saved_reports")
      .select("id, name, dataset_id, column_keys, format, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(`Falha ao carregar relatórios salvos: ${error.message}`);
      setSavedReports([]);
      setLoading(false);
      return;
    }

    const mapped = ((data || []) as SavedReportRow[])
      .map((row) => mapSavedReportRow(row))
      .filter((item): item is SavedReportConfig => Boolean(item));

    setSavedReports(mapped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadSavedReports();
  }, [loadSavedReports]);

  const filteredReports = useMemo(() => {
    const token = normalizeText(search);
    if (!token) return savedReports;

    return savedReports.filter((report) => {
      const datasetLabel = normalizeText(reportDatasetLabels[report.datasetId]);
      return (
        normalizeText(report.name).includes(token) ||
        datasetLabel.includes(token) ||
        report.format.includes(token)
      );
    });
  }, [savedReports, search]);

  const handleDeleteReport = useCallback(async (reportId: string, reportName: string) => {
    if (!user?.id) {
      toast.error("Voce precisa estar autenticado para excluir relatórios salvos.");
      return;
    }

    const shouldDelete = window.confirm(`Excluir o relatório salvo "${reportName}"?`);
    if (!shouldDelete) return;

    setDeletingId(reportId);
    const { error } = await supabase
      .from("saved_reports")
      .delete()
      .eq("id", reportId)
      .eq("user_id", user.id);
    setDeletingId(null);

    if (error) {
      toast.error(`Falha ao remover relatório salvo: ${error.message}`);
      return;
    }

    setSavedReports((current) => current.filter((report) => report.id !== reportId));
    toast.success("Relatório salvo removido.");
  }, [user?.id]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Relatórios Salvos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os modelos de relatório e abra no construtor quando precisar.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/app/relatorios")}>
            Voltar ao construtor
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
            placeholder="Buscar por nome, categoria ou formato..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            {filteredReports.length} relatório(s) encontrado(s)
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {loading ? (
            <div className="py-14 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum relatório salvo encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div key={report.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{report.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {reportDatasetLabels[report.datasetId]} · {report.columnKeys.length} colunas · {report.format.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Atualizado: {formatDateTime(report.updatedAt)}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => navigate(`/app/relatorios?saved=${report.id}`)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Abrir no construtor
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteReport(report.id, report.name)}
                      disabled={deletingId === report.id}
                    >
                      {deletingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
