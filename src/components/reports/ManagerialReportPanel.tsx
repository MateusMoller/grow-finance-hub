import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface ManagerialReportPanelProps {
  organizationId: string | null;
}

interface ActiveClientOption {
  id: string;
  name: string;
  cnpj: string | null;
  regime: string | null;
  sector: string | null;
}

export function ManagerialReportPanel({ organizationId }: ManagerialReportPanelProps) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [competence, setCompetence] = useState("");
  const [externalSource, setExternalSource] = useState("");
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [externalNotes, setExternalNotes] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["managerial-report-active-clients", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cnpj, regime, sector")
        .eq("organization_id", organizationId)
        .eq("status", "Ativo")
        .order("name");

      if (error) throw error;
      return (data || []) as ActiveClientOption[];
    },
  });

  const selectedClient = useMemo(
    () => (clientsQuery.data || []).find((client) => client.id === selectedClientId) || null,
    [clientsQuery.data, selectedClientId],
  );

  const hasDraftContent = Boolean(
    selectedClientId || competence.trim() || externalSource.trim() || executiveSummary.trim() || externalNotes.trim(),
  );

  const handlePrepareDraft = () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente ativo para iniciar o relatorio gerencial.");
      return;
    }

    toast.success("Rascunho gerencial preparado.");
  };

  const handleClear = () => {
    setSelectedClientId("");
    setCompetence("");
    setExternalSource("");
    setExecutiveSummary("");
    setExternalNotes("");
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-heading font-semibold">Relatorio gerencial</h2>
          <p className="text-xs text-muted-foreground">
            Selecione um cliente ativo e registre as informacoes externas para a montagem do relatorio.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Rascunho
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="managerial-client">Cliente</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                disabled={!organizationId || clientsQuery.isLoading}
              >
                <SelectTrigger id="managerial-client">
                  <SelectValue placeholder={clientsQuery.isLoading ? "Carregando clientes..." : "Selecione um cliente ativo"} />
                </SelectTrigger>
                <SelectContent>
                  {(clientsQuery.data || []).map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientsQuery.isError && (
                <p className="text-xs text-destructive">Nao foi possivel carregar os clientes ativos.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="managerial-competence">Competencia</Label>
              <Input
                id="managerial-competence"
                value={competence}
                onChange={(event) => setCompetence(event.target.value)}
                placeholder="Ex.: 06/2026"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerial-source">Origem das informacoes externas</Label>
            <Input
              id="managerial-source"
              value={externalSource}
              onChange={(event) => setExternalSource(event.target.value)}
              placeholder="Ex.: planilha enviada pelo cliente, reuniao, sistema externo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerial-summary">Resumo gerencial</Label>
            <Textarea
              id="managerial-summary"
              value={executiveSummary}
              onChange={(event) => setExecutiveSummary(event.target.value)}
              placeholder="Registre os principais pontos que devem aparecer no relatorio."
              className="min-h-28"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerial-notes">Informacoes externas complementares</Label>
            <Textarea
              id="managerial-notes"
              value={externalNotes}
              onChange={(event) => setExternalNotes(event.target.value)}
              placeholder="Cole aqui dados externos, observacoes, indicadores ou premissas temporarias."
              className="min-h-36"
            />
          </div>
        </div>

        <aside className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Base do rascunho</p>
            {clientsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{selectedClient?.name || "Nenhum cliente selecionado"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Regime</p>
                <p>{selectedClient?.regime || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Setor</p>
                <p>{selectedClient?.sector || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ</p>
              <p>{selectedClient?.cnpj || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Competencia</p>
              <p>{competence.trim() || "-"}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" className="gap-2" onClick={handlePrepareDraft} disabled={!organizationId}>
              <Sparkles className="h-4 w-4" />
              Preparar rascunho
            </Button>
            <Button type="button" variant="outline" onClick={handleClear} disabled={!hasDraftContent}>
              Limpar campos
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
