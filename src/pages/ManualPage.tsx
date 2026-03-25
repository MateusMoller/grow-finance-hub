import { AppLayout } from "@/components/app/AppLayout";
import {
  AlertTriangle,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Filter,
  LayoutDashboard,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const sectionClass = "rounded-xl border bg-card p-5 space-y-3";

export default function ManualPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpenText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Manual de uso da plataforma</h1>
              <p className="text-sm text-muted-foreground">
                Guia completo, passo a passo, com o que cada modulo faz e como usar no dia a dia.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <a href="#visao-geral" className="rounded-lg border p-3 hover:bg-muted">1. Visao geral</a>
            <a href="#filtros" className="rounded-lg border p-3 hover:bg-muted">2. Filtros globais</a>
            <a href="#tarefas-kanban" className="rounded-lg border p-3 hover:bg-muted">3. Tarefas e Kanban</a>
            <a href="#crm" className="rounded-lg border p-3 hover:bg-muted">4. CRM</a>
            <a href="#dashboard" className="rounded-lg border p-3 hover:bg-muted">5. Dashboard</a>
            <a href="#notificacoes" className="rounded-lg border p-3 hover:bg-muted">6. Notificacoes</a>
            <a href="#boas-praticas" className="rounded-lg border p-3 hover:bg-muted">7. Boas praticas</a>
            <a href="#rotina" className="rounded-lg border p-3 hover:bg-muted">8. Rotina recomendada</a>
          </div>
        </div>

        <section id="visao-geral" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" /> 1) Visao geral da ferramenta
          </h2>
          <p className="text-sm text-muted-foreground">
            A plataforma foi desenhada para centralizar operacao, comercial e produtividade em um unico ambiente.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Dashboard</p>
              <p className="text-muted-foreground">Acompanha indicadores individuais e visao consolidada (admin).</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Kanban e Tarefas</p>
              <p className="text-muted-foreground">Organiza o fluxo de execucao com etapas, prioridades e prazos.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">CRM</p>
              <p className="text-muted-foreground">Controla negociacoes por etapa, valor e taxa de conversao.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Notificacoes</p>
              <p className="text-muted-foreground">Mostra alertas de risco: atrasos, vencimento do dia e falta de responsavel.</p>
            </div>
          </div>
        </section>

        <section id="filtros" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> 2) Filtros globais (Empresa e Competencia)
          </h2>
          <p className="text-sm text-muted-foreground">
            Os filtros no topo funcionam como contexto de trabalho. Tudo que voce visualiza considera Empresa e Competencia selecionadas.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Selecione a empresa no campo "Empresa".</li>
            <li>Selecione a competencia no campo "Competencia".</li>
            <li>Todos os modulos passam a refletir esse recorte automaticamente.</li>
            <li>Para voltar ao total geral, limpe os dois filtros.</li>
          </ol>
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Dica: o sistema salva automaticamente o ultimo contexto por usuario para voce continuar exatamente de onde parou.
          </div>
        </section>

        <section id="tarefas-kanban" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> 3) Tarefas e Kanban (execucao operacional)
          </h2>
          <p className="text-sm text-muted-foreground">
            Use Kanban para visao de fluxo e Tarefas para lista detalhada com acompanhamento de subtarefas.
          </p>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Fluxo recomendado:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Criar tarefa com titulo claro, cliente, prioridade e prazo.</li>
              <li>Adicionar subtarefas para quebrar entregas grandes em etapas menores.</li>
              <li>Mover o status conforme evolucao: backlog, a fazer, em andamento, revisao, concluido.</li>
              <li>Revisar diariamente tarefas para hoje e tarefas atrasadas.</li>
              <li>Atualizar responsavel sempre que houver repasse.</li>
            </ol>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Historico de alteracoes</p>
              <p className="text-muted-foreground">
                Toda mudanca importante de tarefa fica registrada para rastreabilidade.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Desfazer acao critica</p>
              <p className="text-muted-foreground">
                Exclusoes e mudancas sensiveis oferecem opcao "Desfazer" para reduzir erro operacional.
              </p>
            </div>
          </div>
        </section>

        <section id="crm" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> 4) CRM (controle de negociacoes)
          </h2>
          <p className="text-sm text-muted-foreground">
            O CRM organiza oportunidades desde o primeiro contato ate o fechamento (ganho ou perdido).
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Cadastre uma negociacao com empresa, contato e valor estimado.</li>
            <li>Atualize a etapa conforme o relacionamento comercial avanca.</li>
            <li>Acompanhe os indicadores do pipeline e do ticket medio.</li>
            <li>Use o historico para entender o caminho percorrido na negociacao.</li>
          </ol>
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Ao mover para "Fechado Perdido", o sistema pede confirmacao e permite desfazer para evitar perdas acidentais.
          </div>
        </section>

        <section id="dashboard" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> 5) Dashboard (indicadores e performance)
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada usuario visualiza seus proprios indicadores. Admin visualiza o consolidado da equipe.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Indicadores principais</p>
              <p className="text-muted-foreground">
                Tempo medio de resolucao, acertividade de prazo, tarefas concluidas por dia e tarefas para hoje.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Widgets favoritos</p>
              <p className="text-muted-foreground">
                Cada usuario pode escolher widgets favoritos e salvar a ordem de exibicao.
              </p>
            </div>
          </div>
        </section>

        <section id="notificacoes" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> 6) Notificacoes por prioridade
          </h2>
          <p className="text-sm text-muted-foreground">
            A central de notificacoes prioriza riscos operacionais com foco em prazo e alocacao.
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Alta
              </p>
              <p className="text-muted-foreground">Tarefa atrasada ou sem responsavel em situacao critica.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium flex items-center gap-1 text-amber-700">
                <CalendarDays className="h-4 w-4" /> Media
              </p>
              <p className="text-muted-foreground">Tarefa vencendo hoje ou sem responsavel.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-4 w-4" /> Tratamento
              </p>
              <p className="text-muted-foreground">Marcar como lida, acompanhar e atuar no item de origem.</p>
            </div>
          </div>
        </section>

        <section id="boas-praticas" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> 7) Boas praticas de uso
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Padronize titulos de tarefa com contexto claro (cliente + entrega).</li>
            <li>Mantenha responsavel e prazo preenchidos para evitar gargalos.</li>
            <li>Atualize etapa do CRM no mesmo dia da interacao comercial.</li>
            <li>Revise notificacoes de alta prioridade no inicio e no fim do expediente.</li>
            <li>Use subtarefas para dividir entregas longas em passos auditaveis.</li>
            <li>Registre observacoes objetivas para facilitar continuidade por outro colaborador.</li>
          </ul>
        </section>

        <section id="rotina" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> 8) Rotina recomendada (15 min diarios)
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>
              <span className="font-medium">Inicio do dia (5 min):</span> revisar notificacoes de prioridade e tarefas para hoje.
            </li>
            <li>
              <span className="font-medium">Meio do dia (5 min):</span> atualizar status do Kanban e registrar avancos no CRM.
            </li>
            <li>
              <span className="font-medium">Fim do dia (5 min):</span> fechar tarefas concluidas, ajustar prazos e deixar proxima acao clara.
            </li>
          </ol>
          <div className="rounded-lg border bg-primary/5 p-3 text-sm">
            Resultado esperado: mais previsibilidade de prazos, menos retrabalho e maior controle da operacao.
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
