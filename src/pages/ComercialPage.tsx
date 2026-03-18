import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  Target,
  Users,
  FileText,
  ArrowUpRight,
  ArrowRight,
  Star,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const products = [
  { name: "Contabilidade Completa", description: "Contabilidade, fiscal e departamento pessoal", price: "A partir de R$ 890/mês", clients: 142, icon: FileText, popular: true },
  { name: "BPO Financeiro", description: "Gestão financeira terceirizada completa", price: "A partir de R$ 1.200/mês", clients: 67, icon: DollarSign, popular: true },
  { name: "Consultoria Financeira", description: "Consultoria estratégica para crescimento", price: "A partir de R$ 2.500/mês", clients: 28, icon: TrendingUp, popular: false },
  { name: "Departamento Pessoal", description: "Gestão completa de folha e obrigações", price: "A partir de R$ 490/mês", clients: 98, icon: Users, popular: false },
  { name: "Formulários Digitais", description: "Admissão, demissão e férias digitais", price: "Incluso nos planos", clients: 185, icon: FileText, popular: false },
  { name: "Planejamento Tributário", description: "Análise e otimização da carga tributária", price: "Sob consulta", clients: 45, icon: Target, popular: false },
];

const salesMetrics = [
  { label: "Receita Mensal", value: "R$ 342.800", change: "+12%", trend: "up" },
  { label: "Novos Contratos", value: "18", change: "+28%", trend: "up" },
  { label: "Ticket Médio", value: "R$ 1.450", change: "+5%", trend: "up" },
  { label: "Taxa de Churn", value: "2.3%", change: "-0.8%", trend: "down" },
];

const topClients = [
  { name: "ABC Tecnologia Ltda", revenue: "R$ 4.800/mês", services: 4, since: "2023" },
  { name: "Tech Solutions SA", revenue: "R$ 3.200/mês", services: 3, since: "2024" },
  { name: "Beta Serviços SA", revenue: "R$ 2.900/mês", services: 3, since: "2022" },
  { name: "Comércio Rápido Ltda", revenue: "R$ 2.100/mês", services: 2, since: "2024" },
  { name: "Startup XYZ ME", revenue: "R$ 1.800/mês", services: 2, since: "2025" },
];

const salesGoals = [
  { label: "Meta de Receita", current: 342800, target: 400000, pct: 86 },
  { label: "Novos Clientes", current: 18, target: 25, pct: 72 },
  { label: "Upsell", current: 8, target: 12, pct: 67 },
];

export default function ComercialPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Comercial</h1>
          <p className="text-sm text-muted-foreground">Gestão de vendas e soluções Grow Finance</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {salesMetrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${m.trend === "up" ? "text-primary" : "text-destructive"}`}>
                  <ArrowUpRight className="h-3 w-3" />{m.change}
                </span>
              </div>
              <div className="font-heading text-2xl font-bold">{m.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Goals */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-heading font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Metas do Mês</h2>
            <div className="space-y-5">
              {salesGoals.map((goal) => (
                <div key={goal.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">{goal.label}</span>
                    <span className="text-sm font-semibold">{goal.pct}%</span>
                  </div>
                  <Progress value={goal.pct} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Top clients */}
          <div className="lg:col-span-2 rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-heading font-semibold">Top Clientes por Receita</h2>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">Ver todos <ArrowRight className="h-3 w-3" /></Button>
            </div>
            <div className="divide-y">
              {topClients.map((c, i) => (
                <div key={c.name} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">Cliente desde {c.since} · {c.services} serviços</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{c.revenue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Products */}
        <div>
          <h2 className="font-heading font-semibold mb-4">Soluções Grow Finance</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border bg-card p-5 hover:shadow-md transition-all relative">
                {p.popular && (
                  <Badge className="absolute top-3 right-3 bg-primary/10 text-primary border-0 gap-1"><Star className="h-3 w-3" /> Popular</Badge>
                )}
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                <div className="mt-3 text-sm font-semibold text-primary">{p.price}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.clients} clientes ativos</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
