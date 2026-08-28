import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type MonthlyValueDraft = {
  referenceMonth: string;
  payrollWithCharges: string;
  grossRevenue: string;
  notes: string;
};

const previousMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const emptyDraft = (): MonthlyValueDraft => ({
  referenceMonth: previousMonth(),
  payrollWithCharges: "",
  grossRevenue: "",
  notes: "",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const queryKey = (organizationId: string, clientId: string) => ["client-monthly-values", organizationId, clientId] as const;

export function ClientMonthlyValuesPanel({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MonthlyValueDraft>(() => emptyDraft());

  const valuesQuery = useQuery({
    queryKey: queryKey(organizationId, clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_monthly_values")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("client_id", clientId)
        .order("reference_month", { ascending: false })
        .limit(36);
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.referenceMonth || draft.payrollWithCharges === "" || draft.grossRevenue === "") {
        throw new Error("Informe a competência, a folha com encargos e a receita bruta.");
      }
      const payroll = Number(draft.payrollWithCharges);
      const revenue = Number(draft.grossRevenue);
      if (!Number.isFinite(payroll) || !Number.isFinite(revenue) || payroll < 0 || revenue < 0) {
        throw new Error("Os valores precisam ser números iguais ou maiores que zero.");
      }
      const { error } = await supabase.from("client_monthly_values").upsert({
        organization_id: organizationId,
        client_id: clientId,
        reference_month: `${draft.referenceMonth}-01`,
        payroll_with_charges: payroll,
        gross_revenue: revenue,
        notes: draft.notes.trim() || null,
        created_by: user?.id || null,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,client_id,reference_month" });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Valores mensais salvos.");
      setDraft(emptyDraft());
      await queryClient.invalidateQueries({ queryKey: queryKey(organizationId, clientId) });
      await queryClient.invalidateQueries({ queryKey: ["factor-r"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar valores mensais."),
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Valores mensais</CardTitle>
              <CardDescription className="mt-1">
                Informe folha de salários com encargos e receita bruta total. Esses valores alimentam o Fator R do PGDAS-D.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly-reference">Competência</Label>
              <Input id="monthly-reference" type="month" value={draft.referenceMonth} onChange={(event) => setDraft((current) => ({ ...current, referenceMonth: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-payroll">Folha com encargos</Label>
              <Input id="monthly-payroll" type="number" min="0" step="0.01" value={draft.payrollWithCharges} onChange={(event) => setDraft((current) => ({ ...current, payrollWithCharges: event.target.value }))} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-revenue">Receita bruta total</Label>
              <Input id="monthly-revenue" type="number" min="0" step="0.01" value={draft.grossRevenue} onChange={(event) => setDraft((current) => ({ ...current, grossRevenue: event.target.value }))} placeholder="0,00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly-notes">Observações</Label>
            <Textarea id="monthly-notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} maxLength={500} rows={2} placeholder="Opcional" />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar competência
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Histórico informado</CardTitle>
          <CardDescription>Selecione uma linha para editar os valores daquela competência.</CardDescription>
        </CardHeader>
        <CardContent>
          {valuesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando valores...</div>
          ) : valuesQuery.data?.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Folha + encargos</th><th className="px-4 py-3">Receita bruta</th><th className="px-4 py-3">Observações</th></tr>
                </thead>
                <tbody>
                  {valuesQuery.data.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t transition-colors hover:bg-muted/40"
                      onClick={() => setDraft({ referenceMonth: row.reference_month.slice(0, 7), payrollWithCharges: String(row.payroll_with_charges ?? ""), grossRevenue: String(row.gross_revenue ?? ""), notes: row.notes || "" })}
                    >
                      <td className="px-4 py-3 font-medium capitalize">{monthFormatter.format(new Date(`${row.reference_month}T00:00:00Z`))}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(row.payroll_with_charges || 0)}</td>
                      <td className="px-4 py-3">{currencyFormatter.format(row.gross_revenue || 0)}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{row.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum valor mensal informado.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
