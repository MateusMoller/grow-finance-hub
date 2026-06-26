import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Columns3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app/AppLayout";
import { ReportDatasetSelector } from "@/components/reports/ReportDatasetSelector";
import { ReportFilterSummary } from "@/components/reports/ReportFilterSummary";
import { ReportExportControls } from "@/components/reports/ReportExportControls";
import { ReportFieldBrowser } from "@/components/reports/ReportFieldBrowser";
import { ReportPreviewTable } from "@/components/reports/ReportPreviewTable";
import { SelectedReportFields } from "@/components/reports/SelectedReportFields";
import { SavedReportForm } from "@/components/reports/SavedReportForm";
import { SavedReportList } from "@/components/reports/SavedReportList";
import { SavedReportWarnings } from "@/components/reports/SavedReportWarnings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { getDefaultReportColumns, reportCatalogById } from "@/lib/reports/catalog";
import { exportReport } from "@/lib/reports/exportClient";
import { normalizeReportFilters } from "@/lib/reports/filters";
import { filterAuthorizedReportFields } from "@/lib/reports/permissions";
import type { ReportDatasetId } from "@/lib/reports/types";
import { applyReportFilters, fetchRowsForDataset, useReportCatalog, useReportPreview } from "@/hooks/reports/useReports";
import { useSavedReports } from "@/hooks/reports/useSavedReports";
import type { ReportColumnWarning, ReportExportResult, SavedReportModel } from "@/lib/reports/types";

const initialDatasetId: ReportDatasetId = "clientes";

export default function RelatoriosPage() {
  const { roles, role, currentOrganizationId, user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const activeRoles = useMemo(() => (roles.length > 0 ? roles : role ? [role] : []), [role, roles]);
  const [datasetId, setDatasetId] = useState<ReportDatasetId>(initialDatasetId);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => getDefaultReportColumns(initialDatasetId));
  const [savedReportName, setSavedReportName] = useState("");
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [savedReportWarnings, setSavedReportWarnings] = useState<ReportColumnWarning[]>([]);
  const [exportResult, setExportResult] = useState<ReportExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const skipDatasetResetRef = useRef(false);

  const catalogQuery = useReportCatalog(currentOrganizationId, activeRoles);
  const datasets = useMemo(() => catalogQuery.data || [], [catalogQuery.data]);
  const activeDataset = reportCatalogById.get(datasetId) || datasets[0] || reportCatalogById.get(initialDatasetId)!;
  const filters = useMemo(
    () =>
      normalizeReportFilters({
        organizationId: currentOrganizationId,
        company: selectedCompany,
        competence: selectedCompetence,
      }),
    [currentOrganizationId, selectedCompany, selectedCompetence],
  );
  const authorizedFields = useMemo(
    () => filterAuthorizedReportFields(activeDataset, activeRoles, { preview: true }),
    [activeDataset, activeRoles],
  );
  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns]);
  const selectedFieldDefinitions = useMemo(() => {
    const fieldByKey = new Map(authorizedFields.map((field) => [field.key, field]));
    return selectedColumns.flatMap((columnKey) => {
      const field = fieldByKey.get(columnKey);
      return field ? [field] : [];
    });
  }, [authorizedFields, selectedColumns]);
  const previewQuery = useReportPreview({
    datasetId: activeDataset.id,
    filters,
    columnKeys: selectedColumns,
    roles: activeRoles,
  });
  const savedReportsQuery = useSavedReports({ organizationId: currentOrganizationId, userId: user?.id || null });

  useEffect(() => {
    if (datasets.length > 0 && !datasets.some((dataset) => dataset.id === datasetId)) {
      setDatasetId(datasets[0].id);
    }
  }, [datasetId, datasets]);

  useEffect(() => {
    if (skipDatasetResetRef.current) {
      skipDatasetResetRef.current = false;
      return;
    }
    const defaults = getDefaultReportColumns(datasetId);
    setSelectedColumns(defaults);
    setSavedReportWarnings([]);
  }, [datasetId]);

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns((current) =>
      current.includes(columnKey)
        ? current.filter((key) => key !== columnKey)
        : [...current, columnKey],
    );
  };

  const removeColumn = (columnKey: string) => {
    setSelectedColumns((current) => current.filter((key) => key !== columnKey));
  };

  const moveColumn = (columnKey: string, direction: "up" | "down") => {
    setSelectedColumns((current) => {
      const index = current.indexOf(columnKey);
      if (index < 0) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleSaveReport = async () => {
    if (!currentOrganizationId) {
      toast.error("Organizacao ativa obrigatoria para salvar modelo.");
      return;
    }
    if (!user?.id) {
      toast.error("Usuario autenticado obrigatorio para salvar modelo.");
      return;
    }
    const name = savedReportName.trim();
    if (!name) {
      toast.error("Informe um nome para o modelo.");
      return;
    }

    try {
      const result = await savedReportsQuery.saveReport({
        id: editingReportId,
        name,
        datasetId: activeDataset.id,
        columnKeys: selectedColumns,
      });
      setEditingReportId(result.model.id);
      setSavedReportName(result.model.name);
      setSavedReportWarnings(result.validation.warnings);
      toast.success(editingReportId ? "Modelo atualizado." : "Modelo salvo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar modelo.";
      toast.error(message);
    }
  };

  const loadSavedReport = (model: SavedReportModel, edit = false) => {
    const validation = savedReportsQuery.validateSavedReportModel(model);
    skipDatasetResetRef.current = true;
    setDatasetId(model.datasetId);
    setSelectedColumns(validation.validColumnKeys);
    setSavedReportName(model.name);
    setEditingReportId(edit ? model.id : null);
    setSavedReportWarnings(validation.warnings);
    toast.success(edit ? "Modelo carregado para edicao." : "Modelo carregado.");
  };

  const handleDeleteReport = async (model: SavedReportModel) => {
    try {
      await savedReportsQuery.deleteReport(model);
      if (editingReportId === model.id) {
        setEditingReportId(null);
        setSavedReportName("");
      }
      toast.success("Modelo removido.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao remover modelo.";
      toast.error(message);
    }
  };

  const handleExport = async () => {
    if (!currentOrganizationId || !previewQuery.data) return;
    setIsExporting(true);
    setExportResult(null);

    try {
      const exportableFieldByKey = new Map(
        filterAuthorizedReportFields(activeDataset, activeRoles, { export: true }).map((field) => [field.key, field]),
      );
      const exportFields = selectedColumns.flatMap((columnKey) => {
        const field = exportableFieldByKey.get(columnKey);
        return field ? [field] : [];
      });
      const allRows = await fetchRowsForDataset(activeDataset, currentOrganizationId);
      const filteredRows = applyReportFilters(activeDataset.id, allRows, filters);
      const result = await exportReport({
        organizationId: currentOrganizationId,
        dataset: activeDataset,
        filters,
        fields: exportFields,
        rows: filteredRows,
        modelId: editingReportId,
      });
      setExportResult(result);
      if (result.status === "completed") toast.success("Exportacao processada.");
      if (result.status === "blocked") toast.warning(result.message || "Exportacao bloqueada.");
      if (result.status === "failed") toast.error(result.message || "Falha ao exportar.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao exportar relatorio.";
      setExportResult({ status: "failed", message, warnings: [] });
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Relatorios</h1>
            <p className="text-sm text-muted-foreground">
              Preview governado por base, filtros, permissao e classificacao de dados.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-fit gap-2"
            onClick={() => void previewQuery.refetch()}
            disabled={previewQuery.isFetching || !currentOrganizationId}
          >
            {previewQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar preview
          </Button>
        </div>

        <ReportFilterSummary filters={filters} />

        {!currentOrganizationId && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Nenhuma organizacao ativa encontrada para carregar relatorios.
          </div>
        )}

        {catalogQuery.isLoading ? (
          <div className="flex min-h-52 items-center justify-center rounded-lg border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma base de relatorio disponivel para seu perfil.</p>
            <p className="mt-1 text-sm text-muted-foreground">Verifique permissoes e organizacao ativa.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-heading font-semibold">Gerar relatorio</h2>
                  <p className="text-xs text-muted-foreground">
                    Ajuste a base, escolha as colunas e exporte em XLSX.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit gap-1.5">
                  <Columns3 className="h-3.5 w-3.5" />
                  {selectedColumns.length} colunas
                </Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
                <ReportDatasetSelector
                  datasets={datasets}
                  value={activeDataset.id}
                  onValueChange={setDatasetId}
                  disabled={catalogQuery.isFetching}
                />
                <div className="rounded-lg border bg-muted/20 p-3">
                  <SavedReportForm
                    name={savedReportName}
                    onNameChange={setSavedReportName}
                    onSubmit={() => void handleSaveReport()}
                    isSaving={savedReportsQuery.isSaving}
                    isEditing={Boolean(editingReportId)}
                    disabled={!currentOrganizationId || selectedColumns.length === 0}
                  />
                  <SavedReportWarnings warnings={savedReportWarnings} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Campos disponiveis</p>
                      <p className="text-xs text-muted-foreground">
                        Selecione os campos que entram no relatorio.
                      </p>
                    </div>
                    <Badge variant="outline">{authorizedFields.length}</Badge>
                  </div>
                  <ReportFieldBrowser fields={authorizedFields} selectedKeys={selectedSet} onToggle={toggleColumn} />
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Colunas selecionadas</p>
                      <p className="text-xs text-muted-foreground">
                        Reordene ou remova campos antes de exportar.
                      </p>
                    </div>
                    <Badge variant="outline">{selectedFieldDefinitions.length}</Badge>
                  </div>
                  <SelectedReportFields fields={selectedFieldDefinitions} onRemove={removeColumn} onMove={moveColumn} />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Preview limitado a {activeDataset.previewLimit} linhas. Exportacao direta planejada ate {activeDataset.exportLimit} linhas.
                </div>
                <ReportExportControls
                  onExport={() => void handleExport()}
                  disabled={!previewQuery.data || previewQuery.data.columns.length === 0 || previewQuery.data.rows.length === 0}
                  isExporting={isExporting}
                  result={exportResult}
                />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Modelos salvos</p>
                  <Badge variant="outline">{savedReportsQuery.data?.length || 0}</Badge>
                </div>
                {savedReportsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando modelos...</p>
                ) : (
                  <SavedReportList
                    reports={savedReportsQuery.data || []}
                    onLoad={(model) => loadSavedReport(model)}
                    onEdit={(model) => loadSavedReport(model, true)}
                    onDelete={(model) => void handleDeleteReport(model)}
                    isDeleting={savedReportsQuery.isDeleting}
                  />
                )}
              </div>
            </section>

            <section className="rounded-xl border bg-card">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading font-semibold">Preview do relatorio</h2>
                    <Badge variant="outline">{activeDataset.name}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mostrando ate {activeDataset.previewLimit} linhas da base selecionada.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit">{selectedColumns.length} colunas</Badge>
              </div>

              {previewQuery.isLoading || previewQuery.isFetching ? (
                <div className="flex min-h-72 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : previewQuery.isError ? (
                <div className="p-8 text-center text-sm text-destructive">
                  Falha ao carregar preview. Verifique permissoes, filtros e disponibilidade da base.
                </div>
              ) : previewQuery.data ? (
                <div>
                  {previewQuery.data.warnings.length > 0 && (
                    <div className="border-b bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {previewQuery.data.warnings.length} coluna(s) foram ignoradas por validacao de catalogo ou permissao.
                    </div>
                  )}
                  <ReportPreviewTable preview={previewQuery.data} />
                  <div className="border-t p-3 text-xs text-muted-foreground">
                    Mostrando {previewQuery.data.rows.length} de {previewQuery.data.rowCount} registro(s) elegiveis.
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">Selecione colunas para carregar o preview.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
