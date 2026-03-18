import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  BarChart3,
  Download,
  FileText,
  Filter,
  Users,
  TrendingUp,
  ClipboardList,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const reportCategories = [
  { name: "Clientes", description: "Relatórios de clientes ativos, inativos e análise de carteira", icon: Users, count: 8, color: "bg-primary/10 text-primary" },
  { name: "Leads & CRM", description: "Pipeline de vendas, conversões e origem de leads", icon: TrendingUp, count: 6, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20" },
  { name: "Tarefas", description: "Produtividade, tarefas por setor e prazos", icon: ClipboardList, count: 10, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20" },
  { name: "Formulários", description: "Envios de formulários por tipo e período", icon: FileText, count: 5, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20" },
  { name: "Financeiro", description: "Receita, inadimplência e ticket médio", icon: BarChart3, count: 7, color: "bg-primary/10 text-primary" },
  { name: "Equipe", description: "Produtividade individual e por setor", icon: Users, count: 4, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20" },
];

const recentReports = [
  { name: "Relatório de Clientes Ativos", category: "Clientes", generatedAt: "18/03/2026 14:30", format: "PDF", size: "1.2 MB" },
  { name: "Pipeline de Vendas - Março", category: "Leads & CRM", generatedAt: "17/03/2026 09:15", format: "XLSX", size: "890 KB" },
  { name: "Produtividade da Equipe - Fev", category: "Equipe", generatedAt: "05/03/2026 16:00", format: "PDF", size: "2.4 MB" },
  { name: "Tarefas por Setor - Q1", category: "Tarefas", generatedAt: "01/03/2026 10:45", format: "PDF", size: "1.8 MB" },
  { name: "Formulários Enviados - Fev", category: "Formulários", generatedAt: "28/02/2026 18:20", format: "XLSX", size: "560 KB" },
];

const formatColors: Record<string, string> = {
  PDF: "bg-destructive/10 text-destructive",
  XLSX: "bg-primary/10 text-primary",
};

export default function RelatoriosPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Geração e exportação de relatórios gerenciais</p>
          </div>
          <Button className="gap-2">
            <BarChart3 className="h-4 w-4" /> Gerar Relatório
          </Button>
        </div>

        {/* Categories */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCategories.map((cat, i) => (
            <motion.div key={cat.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border bg-card p-5 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className={`h-10 w-10 rounded-lg ${cat.color} flex items-center justify-center`}>
                  <cat.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-medium mt-3">{cat.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
              <span className="text-xs text-muted-foreground mt-2 block">{cat.count} relatórios disponíveis</span>
            </motion.div>
          ))}
        </div>

        {/* Recent reports */}
        <div className="rounded-xl border bg-card">
          <div className="p-5 border-b">
            <h2 className="font-heading font-semibold">Relatórios Recentes</h2>
          </div>
          <div className="divide-y">
            {recentReports.map((report, i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{report.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{report.category}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{report.generatedAt}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={`text-xs border-0 ${formatColors[report.format] || "bg-muted"}`}>{report.format}</Badge>
                  <span className="text-xs text-muted-foreground">{report.size}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
