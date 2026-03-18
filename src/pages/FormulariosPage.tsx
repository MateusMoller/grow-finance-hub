import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  FileText,
  UserPlus,
  UserMinus,
  Palmtree,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Briefcase,
  FolderOpen,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const formTemplates = [
  { id: "admissao", title: "Admissão", description: "Formulário completo para admissão de novos colaboradores", icon: UserPlus, color: "bg-primary/10 text-primary", count: 12 },
  { id: "demissao", title: "Demissão", description: "Processo de desligamento com checklist e documentos", icon: UserMinus, color: "bg-destructive/10 text-destructive", count: 3 },
  { id: "ferias", title: "Férias", description: "Solicitação e programação de férias", icon: Palmtree, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20", count: 8 },
  { id: "alteracao-salarial", title: "Alteração Salarial", description: "Solicitação de reajuste ou alteração de salário", icon: DollarSign, color: "bg-primary/10 text-primary", count: 5 },
  { id: "afastamento", title: "Afastamento", description: "Registro de afastamentos (médico, licença, etc.)", icon: AlertCircle, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20", count: 2 },
  { id: "atualizacao-cadastral", title: "Atualização Cadastral", description: "Atualização de dados cadastrais do colaborador", icon: RefreshCw, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20", count: 6 },
  { id: "pro-labore", title: "Pró-labore", description: "Definição e alteração de pró-labore dos sócios", icon: Briefcase, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20", count: 4 },
  { id: "documentos", title: "Solicitação de Documentos", description: "Solicitar documentos ao cliente para processos diversos", icon: FolderOpen, color: "bg-muted text-muted-foreground", count: 15 },
];

const recentSubmissions = [
  { form: "Admissão", client: "ABC Tecnologia", submittedBy: "João Silva", date: "18/03/2026", status: "Em análise" },
  { form: "Férias", client: "Tech Solutions", submittedBy: "Maria Santos", date: "17/03/2026", status: "Concluído" },
  { form: "Alteração Salarial", client: "Beta Serviços", submittedBy: "Admin", date: "17/03/2026", status: "Pendente" },
  { form: "Admissão", client: "Startup XYZ", submittedBy: "Carlos Ribeiro", date: "16/03/2026", status: "Em andamento" },
  { form: "Demissão", client: "Comércio Rápido", submittedBy: "Ana Lima", date: "15/03/2026", status: "Concluído" },
];

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  "Em análise": { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20", icon: Clock },
  Concluído: { color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  Pendente: { color: "bg-muted text-muted-foreground", icon: AlertCircle },
  "Em andamento": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20", icon: Send },
};

export default function FormulariosPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Formulários</h1>
            <p className="text-sm text-muted-foreground">Formulários inteligentes para operações de departamento pessoal</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Criar Formulário
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Enviados (mês)", value: "55", icon: Send },
            { label: "Em análise", value: "8", icon: Clock },
            { label: "Pendentes", value: "12", icon: AlertCircle },
            { label: "Concluídos", value: "35", icon: CheckCircle2 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Templates */}
        <div>
          <h2 className="font-heading font-semibold mb-4">Modelos de Formulários</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {formTemplates.map((form, i) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border bg-card p-5 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className={`h-10 w-10 rounded-lg ${form.color} flex items-center justify-center mb-3`}>
                  <form.icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-sm">{form.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">{form.count} enviados</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent submissions */}
        <div className="rounded-xl border bg-card">
          <div className="p-5 border-b">
            <h2 className="font-heading font-semibold">Envios Recentes</h2>
          </div>
          <div className="divide-y">
            {recentSubmissions.map((sub, i) => {
              const cfg = statusConfig[sub.status];
              return (
                <div key={i} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{sub.form}</div>
                      <div className="text-xs text-muted-foreground">{sub.client} · {sub.submittedBy}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{sub.date}</span>
                    <Badge variant="outline" className={`text-xs border-0 ${cfg.color}`}>{sub.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
