import { AppLayout } from "@/components/app/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  FileText, UserPlus, UserMinus, Palmtree, DollarSign,
  AlertCircle, RefreshCw, Briefcase, FolderOpen, Plus,
  ArrowLeft, Clock, CheckCircle2, Send, Loader2, X,
  ChevronRight, Eye, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ---- Types ----
interface FormTemplate {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
  color: string;
  fields: FormField[];
}

interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "date" | "select" | "textarea" | "phone" | "currency";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface FormSubmission {
  id: string;
  templateId: string;
  templateTitle: string;
  client: string;
  submittedBy: string;
  date: string;
  status: "Pendente" | "Em análise" | "Em andamento" | "Concluído" | "Cancelado";
  data: Record<string, string>;
}

// ---- Templates ----
const formTemplates: FormTemplate[] = [
  {
    id: "admissao",
    title: "Admissão",
    description: "Formulário completo para admissão de novos colaboradores",
    icon: UserPlus,
    color: "bg-primary/10 text-primary",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true, placeholder: "Nome da empresa" },
      { name: "nome_colaborador", label: "Nome Completo do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true, placeholder: "000.000.000-00" },
      { name: "data_nascimento", label: "Data de Nascimento", type: "date", required: true },
      { name: "email", label: "E-mail do Colaborador", type: "email" },
      { name: "telefone", label: "Telefone", type: "phone", placeholder: "(00) 00000-0000" },
      { name: "cargo", label: "Cargo", type: "text", required: true },
      { name: "salario", label: "Salário", type: "currency", required: true, placeholder: "R$ 0,00" },
      { name: "data_admissao", label: "Data de Admissão", type: "date", required: true },
      { name: "tipo_contrato", label: "Tipo de Contrato", type: "select", options: ["CLT", "Estágio", "Temporário", "PJ"], required: true },
      { name: "jornada", label: "Jornada de Trabalho", type: "select", options: ["44h semanais", "30h semanais", "20h semanais", "Livre"] },
      { name: "observacoes", label: "Observações", type: "textarea", placeholder: "Informações adicionais sobre a admissão..." },
    ],
  },
  {
    id: "demissao",
    title: "Demissão",
    description: "Processo de desligamento com checklist e documentos",
    icon: UserMinus,
    color: "bg-destructive/10 text-destructive",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true },
      { name: "nome_colaborador", label: "Nome do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "cargo", label: "Cargo Atual", type: "text" },
      { name: "data_demissao", label: "Data de Demissão", type: "date", required: true },
      { name: "tipo_demissao", label: "Tipo de Demissão", type: "select", options: ["Sem justa causa", "Com justa causa", "Pedido de demissão", "Acordo mútuo"], required: true },
      { name: "aviso_previo", label: "Aviso Prévio", type: "select", options: ["Trabalhado", "Indenizado", "Dispensado"] },
      { name: "motivo", label: "Motivo", type: "textarea", placeholder: "Descreva o motivo do desligamento..." },
    ],
  },
  {
    id: "ferias",
    title: "Férias",
    description: "Solicitação e programação de férias",
    icon: Palmtree,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true },
      { name: "nome_colaborador", label: "Nome do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "periodo_aquisitivo", label: "Período Aquisitivo", type: "text", placeholder: "Ex: 01/03/2025 a 28/02/2026" },
      { name: "data_inicio", label: "Data de Início das Férias", type: "date", required: true },
      { name: "dias", label: "Quantidade de Dias", type: "select", options: ["30 dias", "20 dias + 10 abono", "15 dias + 15 dias", "10 dias + 20 dias"], required: true },
      { name: "abono_pecuniario", label: "Abono Pecuniário (vender 1/3)?", type: "select", options: ["Sim", "Não"] },
      { name: "adiantamento_13", label: "Adiantamento de 13º?", type: "select", options: ["Sim", "Não"] },
      { name: "observacoes", label: "Observações", type: "textarea" },
    ],
  },
  {
    id: "alteracao-salarial",
    title: "Alteração Salarial",
    description: "Solicitação de reajuste ou alteração de salário",
    icon: DollarSign,
    color: "bg-primary/10 text-primary",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true },
      { name: "nome_colaborador", label: "Nome do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "cargo_atual", label: "Cargo Atual", type: "text" },
      { name: "salario_atual", label: "Salário Atual", type: "currency", required: true },
      { name: "novo_salario", label: "Novo Salário", type: "currency", required: true },
      { name: "motivo", label: "Motivo da Alteração", type: "select", options: ["Promoção", "Reajuste anual", "Dissídio", "Mérito", "Outro"], required: true },
      { name: "data_vigencia", label: "Data de Vigência", type: "date", required: true },
      { name: "observacoes", label: "Observações", type: "textarea" },
    ],
  },
  {
    id: "afastamento",
    title: "Afastamento",
    description: "Registro de afastamentos (médico, licença, etc.)",
    icon: AlertCircle,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/20",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true },
      { name: "nome_colaborador", label: "Nome do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "tipo_afastamento", label: "Tipo de Afastamento", type: "select", options: ["Atestado médico", "Licença maternidade", "Licença paternidade", "Acidente de trabalho", "Auxílio doença", "Outro"], required: true },
      { name: "data_inicio", label: "Data de Início", type: "date", required: true },
      { name: "data_retorno", label: "Data Prevista de Retorno", type: "date" },
      { name: "cid", label: "CID (se aplicável)", type: "text" },
      { name: "observacoes", label: "Observações", type: "textarea" },
    ],
  },
  {
    id: "atualizacao-cadastral",
    title: "Atualização Cadastral",
    description: "Atualização de dados cadastrais do colaborador",
    icon: RefreshCw,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
    fields: [
      { name: "empresa", label: "Empresa / Cliente", type: "text", required: true },
      { name: "nome_colaborador", label: "Nome do Colaborador", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "campo_atualizado", label: "Campo a Atualizar", type: "select", options: ["Endereço", "Telefone", "Estado civil", "Dependentes", "Conta bancária", "Outro"], required: true },
      { name: "valor_anterior", label: "Valor Anterior", type: "text" },
      { name: "novo_valor", label: "Novo Valor", type: "text", required: true },
      { name: "observacoes", label: "Observações", type: "textarea" },
    ],
  },
];

// ---- Status config ----
const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  Pendente: { color: "bg-muted text-muted-foreground", icon: Clock },
  "Em análise": { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20", icon: Clock },
  "Em andamento": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20", icon: Send },
  Concluído: { color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  Cancelado: { color: "bg-destructive/10 text-destructive", icon: X },
};

export default function FormulariosPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([
    {
      id: "1", templateId: "admissao", templateTitle: "Admissão", client: "ABC Tecnologia",
      submittedBy: "João Silva", date: "18/03/2026", status: "Em análise",
      data: { empresa: "ABC Tecnologia", nome_colaborador: "Carlos Pereira", cargo: "Analista Fiscal", salario: "R$ 4.500,00" },
    },
    {
      id: "2", templateId: "ferias", templateTitle: "Férias", client: "Tech Solutions",
      submittedBy: "Maria Santos", date: "17/03/2026", status: "Concluído",
      data: { empresa: "Tech Solutions", nome_colaborador: "Ana Lima", dias: "30 dias" },
    },
    {
      id: "3", templateId: "alteracao-salarial", templateTitle: "Alteração Salarial", client: "Beta Serviços",
      submittedBy: "Admin", date: "17/03/2026", status: "Pendente",
      data: { empresa: "Beta Serviços", nome_colaborador: "Pedro Souza", salario_atual: "R$ 3.200,00", novo_salario: "R$ 3.800,00" },
    },
  ]);

  // View state
  const [activeView, setActiveView] = useState<"templates" | "fill">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState("Todos");

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === "Pendente" || s.status === "Em análise").length,
    inProgress: submissions.filter(s => s.status === "Em andamento").length,
    done: submissions.filter(s => s.status === "Concluído").length,
  };

  const filteredSubmissions = submissions.filter(s => {
    if (statusFilter === "Todos") return true;
    return s.status === statusFilter;
  });

  const openTemplate = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setFormData({});
    setActiveView("fill");
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = () => {
    if (!selectedTemplate) return;

    // Validate required
    const missing = selectedTemplate.fields.filter(f => f.required && !formData[f.name]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha o campo: ${missing[0].label}`);
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      const newSubmission: FormSubmission = {
        id: String(Date.now()),
        templateId: selectedTemplate.id,
        templateTitle: selectedTemplate.title,
        client: formData.empresa || "—",
        submittedBy: "Você",
        date: new Date().toLocaleDateString("pt-BR"),
        status: "Pendente",
        data: { ...formData },
      };
      setSubmissions(prev => [newSubmission, ...prev]);
      setSubmitting(false);
      setActiveView("templates");
      setSelectedTemplate(null);
      setFormData({});
      toast.success("Formulário enviado com sucesso! Uma tarefa foi criada automaticamente.");
    }, 800);
  };

  const handleStatusChange = (submissionId: string, newStatus: FormSubmission["status"]) => {
    setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: newStatus } : s));
    if (selectedSubmission?.id === submissionId) {
      setSelectedSubmission(prev => prev ? { ...prev, status: newStatus } : prev);
    }
    toast.success("Status atualizado");
  };

  const handleDelete = (submissionId: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    setDetailOpen(false);
    toast.success("Envio excluído");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <AnimatePresence mode="wait">
          {activeView === "templates" ? (
            <motion.div
              key="templates"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-heading text-2xl font-bold">Formulários</h1>
                  <p className="text-sm text-muted-foreground">Formulários inteligentes para operações de departamento pessoal</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Enviados", value: stats.total, icon: Send, color: "text-foreground" },
                  { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-600" },
                  { label: "Em andamento", value: stats.inProgress, icon: AlertCircle, color: "text-blue-600" },
                  { label: "Concluídos", value: stats.done, icon: CheckCircle2, color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
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
                <h2 className="font-heading font-semibold mb-4">Preencher Formulário</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formTemplates.map((form, i) => (
                    <motion.div
                      key={form.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => openTemplate(form)}
                      className="rounded-xl border bg-card p-5 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className={`h-10 w-10 rounded-lg ${form.color} flex items-center justify-center mb-3`}>
                        <form.icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-medium text-sm">{form.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">{form.fields.length} campos</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Submissions */}
              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b flex items-center justify-between">
                  <h2 className="font-heading font-semibold">Envios Recentes</h2>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Todos", "Pendente", "Em análise", "Em andamento", "Concluído", "Cancelado"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filteredSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nenhum envio encontrado</div>
                ) : (
                  <div className="divide-y">
                    {filteredSubmissions.map((sub, i) => {
                      const cfg = statusConfig[sub.status] || statusConfig.Pendente;
                      return (
                        <motion.div
                          key={sub.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => { setSelectedSubmission(sub); setDetailOpen(true); }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{sub.templateTitle} — {sub.data.nome_colaborador || sub.client}</div>
                              <div className="text-xs text-muted-foreground">{sub.client} · {sub.submittedBy} · {sub.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs border-0 ${cfg.color}`}>{sub.status}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* ---- FORM FILL VIEW ---- */
            <motion.div
              key="fill"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setActiveView("templates")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="font-heading text-2xl font-bold">{selectedTemplate?.title}</h1>
                  <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6 max-w-2xl">
                <div className="space-y-5">
                  {selectedTemplate?.fields.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.type === "select" ? (
                        <Select
                          value={formData[field.name] || ""}
                          onValueChange={(v) => handleFieldChange(field.name, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.type === "textarea" ? (
                        <Textarea
                          placeholder={field.placeholder || ""}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <Input
                          type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
                          placeholder={field.placeholder || ""}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar Formulário
                  </Button>
                  <Button variant="outline" onClick={() => setActiveView("templates")}>Cancelar</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedSubmission && (() => {
            const cfg = statusConfig[selectedSubmission.status] || statusConfig.Pendente;
            const template = formTemplates.find(t => t.id === selectedSubmission.templateId);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">
                    {selectedSubmission.templateTitle}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-5 mt-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className={`border-0 ${cfg.color}`}>
                      {selectedSubmission.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{selectedSubmission.client}</span>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">{selectedSubmission.date}</span>
                  </div>

                  {/* Status change */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Alterar Status</Label>
                    <Select
                      value={selectedSubmission.status}
                      onValueChange={(v) => handleStatusChange(selectedSubmission.id, v as FormSubmission["status"])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Pendente", "Em análise", "Em andamento", "Concluído", "Cancelado"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Form data */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Dados do Formulário</h4>
                    <div className="space-y-3">
                      {template?.fields.map(field => {
                        const value = selectedSubmission.data[field.name];
                        if (!value) return null;
                        return (
                          <div key={field.name} className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{field.label}</span>
                            <span className="text-sm font-medium">{value}</span>
                          </div>
                        );
                      })}
                      {/* Show any data not in template */}
                      {Object.entries(selectedSubmission.data)
                        .filter(([key]) => !template?.fields.some(f => f.name === key))
                        .map(([key, value]) => (
                          <div key={key} className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{key}</span>
                            <span className="text-sm font-medium">{value}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <Separator />

                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDelete(selectedSubmission.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir Envio
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
