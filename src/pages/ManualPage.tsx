import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Filter,
  Headset,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  Settings,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

const sectionClass = "rounded-xl border bg-card p-5 space-y-4";
const blockClass = "rounded-lg border p-4 space-y-2";

interface GlossaryItem {
  term: string;
  meaning: string;
  example: string;
}

interface ModuleGuide {
  id: string;
  title: string;
  access: string;
  icon: LucideIcon;
  objective: string;
  practicalGoal: string;
  nomenclatures: Array<{ term: string; meaning: string }>;
  possibilities: string[];
  stepByStep: string[];
  carePoints: string[];
}

const platformGoals = [
  "Centralizar a rotina de operação, comercial e atendimento em um unico lugar.",
  "Dar visibilidade real de prazo, responsavel e prioridade para evitar retrabalho.",
  "Padronizar a forma de trabalhar, para qualquer pessoa da equipe continuar o processo sem perda de contexto.",
];

const glossaryItems: GlossaryItem[] = [
  {
    term: "Empresa",
    meaning: "Cliente/empresa usada como contexto principal de leitura dos dados.",
    example: "Quando você escolhe uma empresa no topo, as telas mostram apenas esse recorte.",
  },
  {
    term: "Competência",
    meaning: "Período de referência (AAAA-MM) para análise e operação.",
    example: "2026-03 representa marco de 2026.",
  },
  {
    term: "Lead",
    meaning: "Contato potencial vindo de formulario, site ou outra origem comercial.",
    example: "Uma pessoa preencheu o formulario institucional e entrou como lead.",
  },
  {
    term: "Pipeline",
    meaning: "Funil do CRM com as etapas da negociação ate o fechamento.",
    example: "Oportunidade Nova -> Diagnóstico -> Proposta -> Negociação -> Fechado.",
  },
  {
    term: "Status da tarefa",
    meaning: "Etapa de execucao de uma tarefa dentro da operação.",
    example: "Backlog, A Fazer, Em Andamento, Revisão, Concluído.",
  },
  {
    term: "Prioridade",
    meaning: "Nivel de urgencia para executar uma demanda.",
    example: "Alta prioridade deve entrar primeiro no planejamento diario.",
  },
];

const moduleGuides: ModuleGuide[] = [
  {
    id: "mod-dashboard",
    title: "Dashboard",
    access: "Todos os perfis",
    icon: LayoutDashboard,
    objective: "Ler rapidamente a saúde da operação e decidir o que atacar primeiro no dia.",
    practicalGoal: "Sair da tela com prioridades claras em menos de 3 minutos.",
    nomenclatures: [
      { term: "Widget", meaning: "Card visual com um indicador específico." },
      { term: "Consólidado", meaning: "Visão somada da equipe (mais relevante para admin)." },
      { term: "Indicador", meaning: "Número que mede desempenho, prazo ou carga de trabalho." },
    ],
    possibilities: [
      "Ver produtividade por recorte de empresa/competência.",
      "Identificar tarefas atrasadas e concentracoes de risco.",
      "Comparar tendencia de performance ao longo do período.",
    ],
    stepByStep: [
      "Aplicar Empresa e Competência no topo da tela.",
      "Ler primeiro os cards de alerta e volume.",
      "Entrar nas paginas de origem para agir nos itens criticos.",
    ],
    carePoints: [
      "Não tomar decisão sem conferir se os filtros globais estão corretos.",
      "Se o número parecer estranho, revisar origem dos dados (tarefas/CRM/formulários).",
    ],
  },
  {
    id: "mod-tarefas-kanban",
    title: "Tarefas e Kanban",
    access: "Todos os perfis",
    icon: ClipboardList,
    objective: "Controlar execucao com clareza de dono, prazo e próximo passo.",
    practicalGoal: "Toda tarefa deve ter responsavel, data e status atual.",
    nomenclatures: [
      { term: "Backlog", meaning: "Fila de itens ainda não iniciados." },
      { term: "Subtarefa", meaning: "Quebra de uma entrega grande em etapas menores." },
      { term: "Revisão", meaning: "Fase de conferência antes de concluir." },
    ],
    possibilities: [
      "Criar tarefas detalhadas por cliente e prioridade.",
      "Mover cards no Kanban para atualizar o fluxo rapidamente.",
      "Registrar histórico de alterações para rastreabilidade.",
      "Usar desfazer em ações sensiveis para reduzir erro operacional.",
    ],
    stepByStep: [
      "Criar tarefa com titulo objetivo (cliente + entrega).",
      "Definir responsavel, prazo e prioridade.",
      "Adicionar subtarefas quando a entrega tiver varias etapas.",
      "Mover status diariamente conforme evolução real.",
    ],
    carePoints: [
      "Evitar tarefa sem responsavel: vira gargalo invisivel.",
      "Evitar titulo generico: dificulta delegacao e auditoria.",
    ],
  },
  {
    id: "mod-calendario",
    title: "Calendário",
    access: "Todos os perfis",
    icon: CalendarDays,
    objective: "Transformar prazos em agenda visual para reduzir esquecimentos.",
    practicalGoal: "Enxergar semanas criticas antes do vencimento.",
    nomenclatures: [
      { term: "Compromisso", meaning: "Evento agendado com horario/data." },
      { term: "Janela de entrega", meaning: "Período disponível para executar sem conflito." },
      { term: "Conflito de agenda", meaning: "Sobreposicao de demandas no mesmo horario." },
    ],
    possibilities: [
      "Visualizar compromissos por período.",
      "Planejar semana com antecedencia.",
      "Ajustar distribuicao de carga da equipe.",
    ],
    stepByStep: [
      "Abrir semana atual e identificar picos de volume.",
      "Priorizar itens com prazo mais curto.",
      "Reorganizar o que não cabe no dia, sem perder prazo final.",
    ],
    carePoints: [
      "Evitar deixar tudo para o ultimo dia de competência.",
      "Revisar agenda no início e no fim do expediente.",
    ],
  },
  {
    id: "mod-clientes",
    title: "Clientes",
    access: "Todos os perfis",
    icon: Users,
    objective: "Concentrar informações cadastrais e operacionais de cada cliente.",
    practicalGoal: "Ter contexto completo do cliente antes de qualquer atendimento.",
    nomenclatures: [
      { term: "Cliente ativo", meaning: "Cliente em operação no período." },
      { term: "Responsavel interno", meaning: "Pessoa da equipe que conduz a conta." },
      { term: "Histórico", meaning: "Registro cronológico de mudanças e interacoes." },
    ],
    possibilities: [
      "Consultar base de clientes por filtro.",
      "Abrir detalhes para entender andamento e pendências.",
      "Manter informações atualizadas para evitar retrabalho no atendimento.",
    ],
    stepByStep: [
      "Buscar cliente pelo nome ou filtro global.",
      "Abrir detalhes e validar dados principais.",
      "Registrar atualizacoes sempre que houver mudanca relevante.",
    ],
    carePoints: [
      "Não operar cliente com dados desatualizados.",
      "Sempre registrar mudanças que impactam equipe e prazo.",
    ],
  },
  {
    id: "mod-formulários",
    title: "Formulários",
    access: "Todos os perfis",
    icon: FileText,
    objective: "Controlar entradas vindas do site e transformar solicitações em ação.",
    practicalGoal: "Nenhum envio deve ficar sem tratamento.",
    nomenclatures: [
      { term: "Envio", meaning: "Formulario recebido pelo sistema." },
      { term: "Origem", meaning: "Pagina ou canal de onde veio o preenchimento." },
      { term: "Tag de captação", meaning: "Marcador usado para identificar lead vindo do site." },
    ],
    possibilities: [
      "Listar envios recentes por tipo de formulario.",
      "Priorizar contatos com maior potencial de conversão.",
      "Alimentar o CRM com dados captados via site.",
    ],
    stepByStep: [
      "Revisar envios novos no início do dia.",
      "Validar nome, empresa, e-mail e mensagem.",
      "Encaminhar para CRM/atendimento conforme objetivo do contato.",
    ],
    carePoints: [
      "Não deixar contato sem retorno inicial.",
      "Padronizar classificação de origem para manter relatórios confiáveis.",
    ],
  },
  {
    id: "mod-crm",
    title: "CRM",
    access: "Todos os perfis",
    icon: TrendingUp,
    objective: "Acompanhar negociacoes por etapa e aumentar conversão com previsibilidade.",
    practicalGoal: "Saber quantas oportunidades existem, em que etapa estão e quanto podem gerar.",
    nomenclatures: [
      { term: "Etapa", meaning: "Posicao atual da negociação no funil." },
      { term: "Fechado ganho", meaning: "Negociação convertida em cliente." },
      { term: "Fechado perdido", meaning: "Negociação encerrada sem conversão." },
      { term: "Meta", meaning: "Alvo de receita, ganhos ou conversão no período." },
    ],
    possibilities: [
      "Cadastrar novas negociacoes manualmente.",
      "Acompanhar leads captados via site com tag dedicada.",
      "Mover etapa com histórico e possibilidade de desfazer.",
      "Cadastrar metas de receita, ganhos e conversão.",
    ],
    stepByStep: [
      "Criar negociação com empresa, contato e valor estimado.",
      "Atualizar etapa sempre que houver interação comercial.",
      "Revisar bloco de metas e ajustar quando necessario.",
      "Analisar top negociacoes por valor para priorizar follow-up.",
    ],
    carePoints: [
      "Não pular etapas sem registrar contexto.",
      "Evitar manter negociacoes antigas sem próximo passo definido.",
    ],
  },
  {
    id: "mod-solicitacoes",
    title: "Atendimento Portal",
    access: "Admin e equipe operacional",
    icon: Headset,
    objective: "Organizar demandas de clientes em fila rastreavel.",
    practicalGoal: "Responder com qualidade e sem perder prazos de atendimento.",
    nomenclatures: [
      { term: "Solicitação", meaning: "Pedido aberto pelo cliente no portal." },
      { term: "Fila", meaning: "Lista de atendimentos aguardando ação da equipe." },
      { term: "Encaminhamento", meaning: "Transferencia para o setor correto." },
    ],
    possibilities: [
      "Acompanhar novos pedidos em ordem de prioridade.",
      "Registrar andamento de cada atendimento.",
      "Direcionar para responsavel correto rapidamente.",
    ],
    stepByStep: [
      "Abrir solicitações novas e classificar por urgencia.",
      "Definir responsavel e prazo de retorno.",
      "Atualizar status ate a conclusao.",
    ],
    carePoints: [
      "Não deixar solicitação sem dono.",
      "Registrar retorno ao cliente antes de encerrar o atendimento.",
    ],
  },
  {
    id: "mod-chat",
    title: "Chat Interno",
    access: "Todos os perfis internos",
    icon: MessagesSquare,
    objective: "Acelerar alinhamentos entre colaboradores sem perder contexto do trabalho.",
    practicalGoal: "Usar grupo geral para comunicados e conversas pessoais para tratativas 1:1.",
    nomenclatures: [
      { term: "Conversa interna", meaning: "Troca entre funcionários dentro do sistema." },
      { term: "Mensagem contextual", meaning: "Mensagem com objetivo claro e ação esperada." },
      { term: "Registro", meaning: "Histórico que pode ser consultado depois." },
    ],
    possibilities: [
      "Usar o Grupo Geral para avisos e alinhamentos da equipe inteira.",
      "Abrir conversa pessoal (1:1) com qualquer usuário interno.",
      "Alinhar dúvidas operacionais em tempo real.",
      "Compartilhar contexto rápido para continuidade de tarefas.",
      "Reduzir dependência de canais externos para assuntos internos.",
    ],
    stepByStep: [
      "Enviar mensagem objetiva com contexto mínimo necessario.",
      "Indicar prazo ou urgencia quando houver impacto em entrega.",
      "Confirmar conclusao para fechar o assunto.",
    ],
    carePoints: [
      "Evitar mensagens vagas sem ação esperada.",
      "Usar o chat para alinhamento, não para substituir registro formal de tarefa.",
    ],
  },
  {
    id: "mod-newsletter",
    title: "Newsletter",
    access: "Admin",
    icon: Newspaper,
    objective: "Publicar comunicados e conteúdos para base de assinantes.",
    practicalGoal: "Transformar conteúdo em relacionamento recorrente com leads e clientes.",
    nomenclatures: [
      { term: "Assinante", meaning: "Pessoa que se cadastrou para receber newsletters." },
      { term: "Edicao", meaning: "Newsletter publicada em uma data especifica." },
      { term: "Disparo", meaning: "Envio de e-mail para a base cadastrada." },
    ],
    possibilities: [
      "Cadastrar e editar newsletters.",
      "Controlar base de assinantes ativa.",
      "Disparar comunicação quando houver nova publicação.",
    ],
    stepByStep: [
      "Criar a nova edicao com titulo e conteúdo claro.",
      "Revisar texto e links antes de publicar.",
      "Publicar e acompanhar retorno da base.",
    ],
    carePoints: [
      "Evitar publicação sem revisão final.",
      "Manter periodicidade para não esfriar a base de assinantes.",
    ],
  },
  {
    id: "mod-relatorios",
    title: "Relatórios",
    access: "Admin e liderancas",
    icon: BarChart3,
    objective: "Converter dados da operação em análise gerencial para decisão.",
    practicalGoal: "Ter visão de resultado por cliente, equipe e processo.",
    nomenclatures: [
      { term: "Categoria", meaning: "Grupo de relatórios (clientes, CRM, tarefas, etc.)." },
      { term: "Período", meaning: "Intervalo de dados analisado." },
      { term: "Exportacao", meaning: "Saida em formato como PDF ou XLSX." },
    ],
    possibilities: [
      "Gerar relatórios por area.",
      "Exportar para compartilhamento em reunioes.",
      "Acompanhar tendencias de desempenho.",
    ],
    stepByStep: [
      "Escolher categoria e período.",
      "Gerar relatório e validar dados principais.",
      "Exportar no formato adequado para apresentacao.",
    ],
    carePoints: [
      "Sempre conferir filtros antes de gerar.",
      "Não comparar periodos diferentes sem ajuste de contexto.",
    ],
  },
  {
    id: "mod-notificacoes",
    title: "Notificações",
    access: "Todos os perfis",
    icon: Bell,
    objective: "Avisar riscos operacionais para ação rápida.",
    practicalGoal: "Tratar pendências no momento certo e evitar atraso acumulado.",
    nomenclatures: [
      { term: "Alta prioridade", meaning: "Risco imediato de prazo ou operação." },
      { term: "Media prioridade", meaning: "Atenção necessaria no curto prazo." },
      { term: "Marcar como lida", meaning: "Sinaliza que o alerta ja foi avaliado." },
    ],
    possibilities: [
      "Visualizar alertas por criticidade.",
      "Ir direto para origem do problema.",
      "Limpar fila de alertas ja tratados.",
    ],
    stepByStep: [
      "Comecar por alertas de alta prioridade.",
      "Abrir item de origem e executar ação corretiva.",
      "Marcar como lida apos tratar o problema.",
    ],
    carePoints: [
      "Não usar marcar como lida sem ação real.",
      "Reservar 2 momentos do dia para revisar alertas.",
    ],
  },
  {
    id: "mod-configuracoes",
    title: "Configurações",
    access: "Todos os perfis",
    icon: Settings,
    objective: "Ajustar perfil e preferências para trabalhar com mais eficiência.",
    practicalGoal: "Manter conta organizada e preparada para o uso diario.",
    nomenclatures: [
      { term: "Perfil", meaning: "Dados basicos do usuário logado." },
      { term: "Preferência", meaning: "Ajuste individual de uso e exibicao." },
      { term: "Permissão", meaning: "Nivel de acesso conforme papel no sistema." },
    ],
    possibilities: [
      "Revisar dados da conta.",
      "Ajustar preferências de uso interno.",
      "Garantir que o acesso esteja correto para a função.",
    ],
    stepByStep: [
      "Abrir configuracoes e conferir informações pessoais.",
      "Atualizar preferências que impactam rotina.",
      "Validar com admin se houver limitacao inesperada de acesso.",
    ],
    carePoints: [
      "Não compartilhar credenciais.",
      "Reportar qualquer acesso indevido imediatamente.",
    ],
  },
];

const practicalFlows = [
  {
    title: "Fluxo comercial completo (site -> CRM -> fechamento)",
    steps: [
      "Cliente preenche formulario no site.",
      "Lead entra na base com origem de captação via site.",
      "Equipe qualifica e acompanha no CRM por etapa.",
      "Negociação evolui para fechado ganho ou perdido com histórico.",
    ],
  },
  {
    title: "Fluxo operacional diario (tarefas -> calendário -> notificações)",
    steps: [
      "Planejar o dia por tarefas prioritarias.",
      "Distribuir agenda no calendário para evitar conflitos.",
      "Executar e atualizar status no Kanban/Tarefas.",
      "Tratar alertas de notificação para não acumular atraso.",
    ],
  },
  {
    title: "Fluxo de atendimento (portal -> responsavel -> retorno)",
    steps: [
      "Nova solicitação chega no Atendimento Portal.",
      "Responsavel e prazo sao definidos.",
      "Atendimento e atualizado ate conclusao.",
      "Retorno final ao cliente e registro interno do encerramento.",
    ],
  },
];

const dailyChecklist = [
  "5 min - Revisar notificações de alta prioridade.",
  "5 min - Atualizar status de tarefas e Kanban com o que foi executado.",
  "3 min - Revisar CRM e registrar avancos comerciais do dia.",
  "2 min - Garantir que próximas ações de amanha estão claras.",
];

export default function ManualPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpenText className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-bold">Manual de uso da plataforma</h1>
              <p className="text-sm text-muted-foreground">
                Versão mastigada: o que cada área faz, para que serve, como chamar as coisas e quais resultados você consegue gerar.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            <a href="#objetivos" className="rounded-lg border p-3 hover:bg-muted">
              1. Objetivos
            </a>
            <a href="#nomenclaturas" className="rounded-lg border p-3 hover:bg-muted">
              2. Nomenclaturas
            </a>
            <a href="#funcionalidades" className="rounded-lg border p-3 hover:bg-muted">
              3. Funcionalidades
            </a>
            <a href="#fluxos" className="rounded-lg border p-3 hover:bg-muted">
              4. Fluxos prontos
            </a>
            <a href="#rotina" className="rounded-lg border p-3 hover:bg-muted">
              5. Rotina diaria
            </a>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Como usar este manual: leia primeiro Objetivos e Nomenclaturas. Depois abra apenas os módulos que fazem parte da sua rotina.
          </div>
        </div>

        <section id="objetivos" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> 1) Objetivos da plataforma
          </h2>
          <p className="text-sm text-muted-foreground">
            Objetivo central: transformar trabalho disperso em processo previsivel, com dono, prazo e histórico.
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {platformGoals.map((goal) => (
              <div key={goal} className={blockClass}>
                <p className="text-sm">{goal}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="nomenclaturas" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> 2) Nomenclaturas (dicionario rapido)
          </h2>
          <p className="text-sm text-muted-foreground">
            Esta secao traduz os nomes mais usados no sistema para evitar duvida entre equipe e lideranca.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {glossaryItems.map((item) => (
              <div key={item.term} className={blockClass}>
                <p className="text-sm font-semibold">{item.term}</p>
                <p className="text-sm text-muted-foreground">{item.meaning}</p>
                <p className="text-xs text-muted-foreground">
                  Exemplo prático: {item.example}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="funcionalidades" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> 3) Funcionalidades separadas por módulo
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada módulo abaixo está separado com objetivo, nomenclaturas, possibilidades e passo a passo.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {moduleGuides.map((module, index) => (
              <a
                key={module.id}
                href={`#${module.id}`}
                className="rounded-lg border p-3 hover:bg-muted transition-colors"
              >
                {index + 1}. {module.title}
              </a>
            ))}
          </div>
        </section>

        {moduleGuides.map((module) => {
          const Icon = module.icon;

          return (
            <section id={module.id} className={sectionClass} key={module.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-lg font-semibold">{module.title}</h3>
                <Badge variant="secondary" className="text-[11px]">
                  {module.access}
                </Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className={blockClass}>
                  <p className="text-sm font-semibold">Objetivo do módulo</p>
                  <p className="text-sm text-muted-foreground">{module.objective}</p>
                  <p className="text-xs text-muted-foreground">
                    Resultado esperado: {module.practicalGoal}
                  </p>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Nomenclaturas do módulo</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {module.nomenclatures.map((item) => (
                      <li key={item.term}>
                        <span className="font-medium text-foreground">{item.term}:</span> {item.meaning}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Possibilidades (o que você consegue fazer)</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {module.possibilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Passo a passo recomendado</p>
                  <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                    {module.stepByStep.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Pontos de atencao</p>
                <ul className="list-disc pl-5 space-y-1">
                  {module.carePoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        <section id="fluxos" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> 4) Fluxos prontos (de ponta a ponta)
          </h2>
          <p className="text-sm text-muted-foreground">
            Use estes roteiros como padrão inicial para manter consistencia entre pessoas e setores.
          </p>
          <div className="grid lg:grid-cols-3 gap-3">
            {practicalFlows.map((flow) => (
              <div key={flow.title} className={blockClass}>
                <p className="text-sm font-semibold">{flow.title}</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
                  {flow.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section id="rotina" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> 5) Rotina diaria recomendada (15 minutos)
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {dailyChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="rounded-lg border bg-primary/5 p-3 text-sm">
            Resultado esperado: mais previsibilidade, menos urgencia de ultima hora e melhor continuidade entre colaboradores.
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Guia rapido para novos usuários
          </h2>
          <p className="text-sm text-muted-foreground">
            Se a pessoa entrou hoje na equipe, este e o caminho mais simples para onboarding:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Ler Objetivos e Nomenclaturas do manual.</li>
            <li>Treinar Tarefas/Kanban e Notificações no primeiro dia.</li>
            <li>Treinar módulo principal da função no segundo dia (CRM, Atendimento ou Clientes).</li>
            <li>Validar entendimento com um fluxo real supervisionado.</li>
          </ol>
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Bell className="h-4 w-4 shrink-0 mt-0.5" />
            Sempre que surgir duvida de termo ou processo, atualize este manual para manter o mesmo idioma operacional em toda a empresa.
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
