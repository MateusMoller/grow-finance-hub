import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Certificate = {
  id: string;
  clientId: string;
  status: string;
  fingerprintSuffix: string;
  serialNumberSuffix: string | null;
  validFrom: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type Client = { id: string; name: string; cnpj: string | null; status: string | null };
type ManagementResponse = { certificates: Certificate[]; clients: Client[] };
type ExpiryGroup = "expired" | "critical" | "warning" | "valid" | "unknown";

const DAY_MS = 24 * 60 * 60 * 1000;
const groupLabels: Record<ExpiryGroup, string> = {
  expired: "Vencido",
  critical: "Vence em até 15 dias",
  warning: "Vence em até 60 dias",
  valid: "Válido",
  unknown: "Sem data",
};

function expiryInfo(expiresAt: string | null): { group: ExpiryGroup; days: number | null } {
  if (!expiresAt) return { group: "unknown", days: null };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { group: "expired", days };
  if (days <= 15) return { group: "critical", days };
  if (days <= 60) return { group: "warning", days };
  return { group: "valid", days };
}

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";
}

function expiryText(group: ExpiryGroup, days: number | null) {
  if (group === "expired") return `Vencido há ${Math.abs(days || 0)} dia(s)`;
  if (group === "unknown") return groupLabels[group];
  return days === 0 ? "Vence hoje" : `Vence em ${days} dia(s)`;
}

function ExpiryBadge({ group, days }: { group: ExpiryGroup; days: number | null }) {
  const className = group === "expired" || group === "critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : group === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : group === "valid"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "";
  return <Badge variant="outline" className={className}>{expiryText(group, days)}</Badge>;
}

async function loadCertificates(organizationId: string) {
  const form = new FormData();
  form.set("action", "list");
  form.set("organizationId", organizationId);
  const { data, error } = await supabase.functions.invoke<ManagementResponse & { error?: { code?: string } }>("client-certificate-vault", { body: form });
  if (error || data?.error) throw new Error(data?.error?.code || "operation_failed");
  return data;
}

export default function CertificateManagementPage() {
  const { currentOrganizationId } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("pt-BR"));
  const query = useQuery({
    queryKey: ["certificate-management", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    queryFn: () => loadCertificates(currentOrganizationId as string),
  });

  const clientById = new Map((query.data?.clients || []).map((client) => [client.id, client]));
  const rows = (query.data?.certificates || []).filter((certificate) => {
    const client = clientById.get(certificate.clientId);
    const group = expiryInfo(certificate.expiresAt).group;
    const matchesStatus = statusFilter === "all" || group === statusFilter;
    const searchable = `${client?.name || ""} ${client?.cnpj || ""} ${certificate.fingerprintSuffix}`.toLocaleLowerCase("pt-BR");
    return matchesStatus && (!deferredSearch || searchable.includes(deferredSearch));
  });
  const counts = (query.data?.certificates || []).reduce<Record<ExpiryGroup, number>>((result, certificate) => {
    result[expiryInfo(certificate.expiresAt).group] += 1;
    return result;
  }, { expired: 0, critical: 0, warning: 0, valid: 0, unknown: 0 });

  return <AppLayout><main className="mx-auto max-w-7xl space-y-6">
    <header>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Gestão segura de certificados A1</div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">Certificados digitais</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acompanhe as datas identificadas automaticamente nos arquivos anexados ao cadastro dos clientes.</p>
    </header>

    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-3" aria-label="Resumo dos certificados">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /><dt className="text-xs text-muted-foreground">Vencidos</dt><dd className="font-semibold tabular-nums">{counts.expired}</dd></div>
      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" /><dt className="text-xs text-muted-foreground">Até 60 dias</dt><dd className="font-semibold tabular-nums">{counts.critical + counts.warning}</dd></div>
      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><dt className="text-xs text-muted-foreground">Válidos acima de 60 dias</dt><dd className="font-semibold tabular-nums">{counts.valid}</dd></div>
      <div className="flex items-center gap-2"><dt className="text-xs text-muted-foreground">Total cadastrado</dt><dd className="font-semibold tabular-nums">{query.data?.certificates.length || 0}</dd></div>
    </dl>

    <section className="space-y-4" aria-label="Relação de certificados">
      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, CNPJ ou final da impressão digital" className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os vencimentos</SelectItem><SelectItem value="expired">Vencidos</SelectItem><SelectItem value="critical">Até 15 dias</SelectItem><SelectItem value="warning">De 16 a 60 dias</SelectItem><SelectItem value="valid">Acima de 60 dias</SelectItem><SelectItem value="unknown">Sem data identificada</SelectItem></SelectContent></Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-sm">
        <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Identificação segura</th><th className="px-4 py-3">Atualizado em</th></tr></thead>
        <tbody>{query.isLoading ? <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : query.isError ? <tr><td colSpan={5} className="py-16 text-center text-destructive">Não foi possível carregar os certificados.</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="py-16 text-center text-muted-foreground">Nenhum certificado encontrado para os filtros selecionados.</td></tr> : rows.map((certificate) => {
          const client = clientById.get(certificate.clientId);
          const expiry = expiryInfo(certificate.expiresAt);
          return <tr key={certificate.id} className="border-b last:border-0"><td className="px-4 py-3"><Link to={`/app/clientes/${certificate.clientId}`} className="font-medium hover:underline">{client?.name || "Cliente"}</Link><p className="text-xs text-muted-foreground">{client?.cnpj || "CNPJ não informado"}</p></td><td className="px-4 py-3"><p className="font-medium tabular-nums">{dateLabel(certificate.expiresAt)}</p><p className="text-xs text-muted-foreground">Válido desde {dateLabel(certificate.validFrom)}</p></td><td className="px-4 py-3"><ExpiryBadge group={expiry.group} days={expiry.days} /></td><td className="px-4 py-3 font-mono text-xs"><p>SHA-256 …{certificate.fingerprintSuffix}</p>{certificate.serialNumberSuffix ? <p className="mt-1 text-muted-foreground">Série …{certificate.serialNumberSuffix}</p> : null}</td><td className="px-4 py-3 text-muted-foreground">{dateLabel(certificate.updatedAt)}</td></tr>;
        })}</tbody>
      </table></div></div>
    </section>
  </main></AppLayout>;
}
