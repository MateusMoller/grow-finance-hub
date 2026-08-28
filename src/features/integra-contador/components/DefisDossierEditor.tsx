import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SimpleNationalDossier } from "../types";

type Props = {
  dossier: SimpleNationalDossier;
  saving: boolean;
  onSave: (input: Record<string, unknown>, source: string) => Promise<void>;
};

const text = (value: unknown, fallback = "") => value == null ? fallback : String(value);
const number = (value: string) => value.trim() === "" ? 0 : Number(value);

export function DefisDossierEditor({ dossier, saving, onSave }: Props) {
  const input = dossier.input_data;
  const partner = (Array.isArray(input.partners) ? input.partners[0] : null) as Record<string, unknown> | null;
  const establishment = (Array.isArray(input.establishments) ? input.establishments[0] : null) as Record<string, unknown> | null;
  const [source, setSource] = useState(dossier.source_manifest[0]?.reference || "Sistema contábil da Grow");
  const [inactivity, setInactivity] = useState(text(input.inactivity, "2"));
  const [capitalGain, setCapitalGain] = useState(text(input.capital_gain, "0"));
  const [employeesStart, setEmployeesStart] = useState(text(input.employees_at_start, "0"));
  const [employeesEnd, setEmployeesEnd] = useState(text(input.employees_at_end, "0"));
  const [accountingProfit, setAccountingProfit] = useState(text(input.accounting_profit));
  const [directExport, setDirectExport] = useState(text(input.direct_export_revenue, "0"));
  const [variableGain, setVariableGain] = useState(text(input.variable_income_gain, "0"));
  const [partnerCpf, setPartnerCpf] = useState(text(partner?.cpf));
  const [partnerExempt, setPartnerExempt] = useState(text(partner?.rendimentosIsentos, "0"));
  const [partnerTaxable, setPartnerTaxable] = useState(text(partner?.rendimentosTributaveis, "0"));
  const [partnerShare, setPartnerShare] = useState(text(partner?.participacaoCapitalSocial, "100"));
  const [partnerWithholding, setPartnerWithholding] = useState(text(partner?.irRetidoFonte, "0"));
  const [cashStart, setCashStart] = useState(text(establishment?.saldoCaixaInicial, "0"));
  const [cashEnd, setCashEnd] = useState(text(establishment?.saldoCaixaFinal, "0"));
  const [inventoryStart, setInventoryStart] = useState(text(establishment?.estoqueInicial, "0"));
  const [inventoryEnd, setInventoryEnd] = useState(text(establishment?.estoqueFinal, "0"));
  const [purchases, setPurchases] = useState(text(establishment?.aquisicoesMercadoInterno, "0"));
  const [imports, setImports] = useState(text(establishment?.importacoes, "0"));
  const [transferEntries, setTransferEntries] = useState(text(establishment?.totalEntradasPorTransferencia, "0"));
  const [transferExits, setTransferExits] = useState(text(establishment?.totalSaidasPorTransferencia, "0"));
  const [salesReturns, setSalesReturns] = useState(text(establishment?.totalDevolucoesVendas, "0"));
  const [totalEntries, setTotalEntries] = useState(text(establishment?.totalEntradas, input.annual_revenue == null ? "0" : String(input.annual_revenue)));
  const [purchaseReturns, setPurchaseReturns] = useState(text(establishment?.totalDevolucoesCompras, "0"));
  const [expenses, setExpenses] = useState(text(establishment?.totalDespesas, "0"));
  const [partnersReviewed, setPartnersReviewed] = useState(Boolean(input.partners_reviewed));
  const [optionalReviewed, setOptionalReviewed] = useState(Boolean(input.optional_information_reviewed));
  const year = Number(dossier.competence_key);

  const submit = () => onSave({
    ...input,
    inactivity: year < 2025 ? Number(inactivity) : null,
    capital_gain: number(capitalGain), employees_at_start: number(employeesStart), employees_at_end: number(employeesEnd),
    accounting_profit: accountingProfit.trim() === "" ? null : number(accountingProfit), direct_export_revenue: number(directExport), variable_income_gain: number(variableGain),
    partners_reviewed: partnersReviewed, optional_information_reviewed: optionalReviewed,
    partners: [{ cpf: partnerCpf.replace(/\D/g, ""), rendimentosIsentos: number(partnerExempt), rendimentosTributaveis: number(partnerTaxable), participacaoCapitalSocial: number(partnerShare), irRetidoFonte: number(partnerWithholding) }],
    establishments: [{ cnpjCompleto: text(input.cnpj).replace(/\D/g, ""), estoqueInicial: number(inventoryStart), estoqueFinal: number(inventoryEnd), saldoCaixaInicial: number(cashStart), saldoCaixaFinal: number(cashEnd), aquisicoesMercadoInterno: number(purchases), importacoes: number(imports), totalEntradasPorTransferencia: number(transferEntries), totalSaidasPorTransferencia: number(transferExits), totalDevolucoesVendas: number(salesReturns), totalEntradas: number(totalEntries), totalDevolucoesCompras: number(purchaseReturns), totalDespesas: number(expenses) }],
  }, source);

  const moneyField = (id: string, label: string, value: string, setter: (value: string) => void) => <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" step="0.01" value={value} onChange={(event) => setter(event.target.value)} /></div>;

  return <div className="space-y-5 border-t pt-4">
    <div><h4 className="font-medium">Empresa</h4><p className="text-xs text-muted-foreground">Informações anuais obrigatórias da matriz.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {year < 2025 ? <div className="space-y-1.5"><Label>Inatividade</Label><Select value={inactivity} onValueChange={setInactivity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">PGDAS-D zerado, mas houve atividade</SelectItem><SelectItem value="1">Sem qualquer atividade</SelectItem><SelectItem value="2">PGDAS-D com movimento</SelectItem></SelectContent></Select></div> : null}
      {moneyField(`defis-capital-${dossier.id}`, "Ganhos de capital", capitalGain, setCapitalGain)}
      <div className="space-y-1.5"><Label htmlFor={`defis-emp-start-${dossier.id}`}>Empregados no início</Label><Input id={`defis-emp-start-${dossier.id}`} type="number" min="0" step="1" value={employeesStart} onChange={(event) => setEmployeesStart(event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor={`defis-emp-end-${dossier.id}`}>Empregados no final</Label><Input id={`defis-emp-end-${dossier.id}`} type="number" min="0" step="1" value={employeesEnd} onChange={(event) => setEmployeesEnd(event.target.value)} /></div>
      {moneyField(`defis-profit-${dossier.id}`, "Lucro contábil (se aplicável)", accountingProfit, setAccountingProfit)}
      {moneyField(`defis-export-${dossier.id}`, "Exportação direta", directExport, setDirectExport)}
      {moneyField(`defis-variable-${dossier.id}`, "Ganhos de renda variável", variableGain, setVariableGain)}
    </div>
    <div><h4 className="font-medium">Sócio</h4><p className="text-xs text-muted-foreground">Informe o primeiro sócio. Os demais poderão ser adicionados na evolução do dossiê.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5"><Label htmlFor={`defis-cpf-${dossier.id}`}>CPF</Label><Input id={`defis-cpf-${dossier.id}`} inputMode="numeric" value={partnerCpf} onChange={(event) => setPartnerCpf(event.target.value)} /></div>
      {moneyField(`defis-exempt-${dossier.id}`, "Rendimentos isentos", partnerExempt, setPartnerExempt)}
      {moneyField(`defis-taxable-${dossier.id}`, "Rendimentos tributáveis", partnerTaxable, setPartnerTaxable)}
      {moneyField(`defis-share-${dossier.id}`, "Participação no capital (%)", partnerShare, setPartnerShare)}
      {moneyField(`defis-irrf-${dossier.id}`, "IR retido na fonte", partnerWithholding, setPartnerWithholding)}
    </div>
    <div><h4 className="font-medium">Estabelecimento</h4><p className="text-xs text-muted-foreground">Saldos, entradas e despesas do CNPJ vinculado à obrigação.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {moneyField(`defis-stock-start-${dossier.id}`, "Estoque inicial", inventoryStart, setInventoryStart)}
      {moneyField(`defis-stock-end-${dossier.id}`, "Estoque final", inventoryEnd, setInventoryEnd)}
      {moneyField(`defis-cash-start-${dossier.id}`, "Caixa/bancos inicial", cashStart, setCashStart)}
      {moneyField(`defis-cash-end-${dossier.id}`, "Caixa/bancos final", cashEnd, setCashEnd)}
      {moneyField(`defis-purchases-${dossier.id}`, "Aquisições no mercado interno", purchases, setPurchases)}
      {moneyField(`defis-imports-${dossier.id}`, "Importações", imports, setImports)}
      {moneyField(`defis-transfer-in-${dossier.id}`, "Entradas por transferência", transferEntries, setTransferEntries)}
      {moneyField(`defis-transfer-out-${dossier.id}`, "Saídas por transferência", transferExits, setTransferExits)}
      {moneyField(`defis-sales-returns-${dossier.id}`, "Devoluções de vendas", salesReturns, setSalesReturns)}
      {moneyField(`defis-total-entries-${dossier.id}`, "Total de entradas", totalEntries, setTotalEntries)}
      {moneyField(`defis-purchase-returns-${dossier.id}`, "Devoluções de compras", purchaseReturns, setPurchaseReturns)}
      {moneyField(`defis-expenses-${dossier.id}`, "Total de despesas", expenses, setExpenses)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={partnersReviewed} onCheckedChange={(checked) => setPartnersReviewed(checked === true)} />Quadro societário revisado</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={optionalReviewed} onCheckedChange={(checked) => setOptionalReviewed(checked === true)} />Hipóteses de informações opcionais revisadas</label>
    </div>
    <div className="space-y-1.5"><Label htmlFor={`defis-source-${dossier.id}`}>Fonte dos dados</Label><Input id={`defis-source-${dossier.id}`} value={source} onChange={(event) => setSource(event.target.value)} /></div>
    <Button type="button" onClick={() => void submit()} disabled={saving || !source.trim()}><Save className="mr-2 h-4 w-4" />Validar e salvar DEFIS</Button>
  </div>;
}
