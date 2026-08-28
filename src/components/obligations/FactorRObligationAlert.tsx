import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { GrowObligationInstance } from "@/lib/growObligations";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isPgdasInstance = (instance: GrowObligationInstance) => {
  const code = instance.template?.code?.trim().toLowerCase();
  const name = instance.template?.normalized_name || instance.template?.name || "";
  return code === "pgdas_d" || name.toLowerCase().includes("pgdas");
};

export function FactorRObligationAlert({ instance, compact = false }: { instance: GrowObligationInstance; compact?: boolean }) {
  const enabled = isPgdasInstance(instance);
  const calculationQuery = useQuery({
    queryKey: ["factor-r", instance.client_id, instance.competence_date],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_client_factor_r", {
        _client_id: instance.client_id,
        _pgdas_competence: instance.competence_date,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  if (!enabled || calculationQuery.data?.result_status === "not_applicable") return null;
  if (calculationQuery.isLoading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Calculando Fator R...</div>;
  if (calculationQuery.isError || !calculationQuery.data) return <div className="text-xs text-destructive">Não foi possível calcular o Fator R.</div>;

  const calculation = calculationQuery.data;
  if (calculation.result_status === "insufficient_data") {
    return (
      <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-xs"><strong>PGDAS-D bloqueado:</strong> {calculation.months_complete} de 12 competências possuem folha e receita preenchidas.</div>
      </div>
    );
  }

  const belowThreshold = calculation.result_status === "below_threshold";
  return (
    <div className={`flex gap-2 rounded-xl border p-3 ${belowThreshold ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"}`}>
      {belowThreshold ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="text-xs">
        <strong>{belowThreshold ? "PGDAS-D bloqueado: Fator R abaixo de 28%." : "Fator R igual ou superior a 28%. PGDAS-D liberado."}</strong>
        {!compact ? <span className="mt-1 block">FS12 {currencyFormatter.format(calculation.payroll_fs12)} ÷ RBT12 {currencyFormatter.format(calculation.gross_revenue_rbt12)} = {percentFormatter.format(calculation.factor_r || 0)}.</span> : <span> Resultado: {percentFormatter.format(calculation.factor_r || 0)}.</span>}
      </div>
    </div>
  );
}
