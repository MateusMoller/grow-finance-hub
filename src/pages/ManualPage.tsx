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
  "Centralizar a rotina de operacao, comercial e atendimento em um unico lugar.",
  "Dar visibilidade real de prazo, responsavel e prioridade para evitar retrabalho.",
  "Padronizar a forma de trabalhar, para qualquer pessoa da equipe continuar o processo sem perda de contexto.",
];

const glossaryItems: GlossaryItem[] = [
  {
    term: "Empresa",
    meaning: "Cliente/empresa usada como contexto principal de leitura dos dados.",
    example: "Quando voce escolhe uma empresa no topo, as telas mostram apenas esse recorte.",
  },
  {
    term: "Competencia",
    meaning: "Periodo de referencia (AAAA-MM) para analise e operacao.",
    example: "2026-03 representa marco de 2026.",
  },
  {
    term: "Lead",
    meaning: "Contato potencial vindo de formulario, site ou outra origem comercial.",
    example: "Uma pessoa preencheu o formulario institucional e entrou como lead.",
  },
  {
    term: "Pipeline",
    meaning: "Funil do CRM com as etapas da negociacao ate o fechamento.",
    example: "Oportunidade Nova -> Diagnostico -> Proposta -> Negociacao -> Fechado.",
  },
  {
    term: "Status da tarefa",
    meaning: "Etapa de execucao de uma tarefa dentro da operacao.",
    example: "Backlog, A Fazer, Em Andamento, Revisao, Concluido.",
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
    objective: "Ler rapidamente a saude da operacao e decidir o que atacar primeiro no dia.",
    practicalGoal: "Sair da tela com prioridades claras em menos de 3 minutos.",
    nomenclatures: [
      { term: "Widget", meaning: "Card visual com um indicador especifico." },
      { term: "Consolidado", meaning: "Visao somada da equipe (mais relevante para admin)." },
      { term: "Indicador", meaning: "Numero que mede desempenho, prazo ou carga de trabalho." },
    ],
    possibilities: [
      "Ver produtividade por recorte de empresa/competencia.",
      "Identificar tarefas atrasadas e concentracoes de risco.",
      "Comparar tendencia de performance ao longo do periodo.",
    ],
    stepByStep: [
      "Aplicar Empresa e Competencia no topo da tela.",
      "Ler primeiro os cards de alerta e volume.",
      "Entrar nas paginas de origem para agir nos itens criticos.",
    ],
    carePoints: [
      "Nao tomar decisao sem conferir se os filtros globais estao corretos.",
      "Se o numero parecer estranho, revisar origem dos dados (tarefas/CRM/formularios).",
    ],
  },
  {
    id: "mod-tarefas-kanban",
    title: "Tarefas e Kanban",
    access: "Todos os perfis",
    icon: ClipboardList,
    objective: "Controlar execucao com clareza de dono, prazo e proximo passo.",
    practicalGoal: "Toda tarefa deve ter responsavel, data e status atual.",
    nomenclatures: [
      { term: "Backlog", meaning: "Fila de itens ainda nao iniciados." },
      { term: "Subtarefa", meaning: "Quebra de uma entrega grande em etapas menores." },
      { term: "Revisao", meaning: "Fase de conferencia antes de concluir." },
    ],
    possibilities: [
      "Criar tarefas detalhadas por cliente e prioridade.",
      "Mover cards no Kanban para atualizar o fluxo rapidamente.",
      "Registrar historico de alteracoes para rastreabilidade.",
      "Usar desfazer em acoes sensiveis para reduzir erro operacional.",
    ],
    stepByStep: [
      "Criar tarefa com titulo objetivo (cliente + entrega).",
      "Definir responsavel, prazo e prioridade.",
      "Adicionar subtarefas quando a entrega tiver varias etapas.",
      "Mover status diariamente conforme evolucao real.",
    ],
    carePoints: [
      "Evitar tarefa sem responsavel: vira gargalo invisivel.",
      "Evitar titulo generico: dificulta delegacao e auditoria.",
    ],
  },
  {
    id: "mod-calendario",
    title: "Calendario",
    access: "Todos os perfis",
    icon: CalendarDays,
    objective: "Transformar prazos em agenda visual para reduzir esquecimentos.",
    practicalGoal: "Enxergar semanas criticas antes do vencimento.",
    nomenclatures: [
      { term: "Compromisso", meaning: "Evento agendado com horario/data." },
      { term: "Janela de entrega", meaning: "Periodo disponivel para executar sem conflito." },
      { term: "Conflito de agenda", meaning: "Sobreposicao de demandas no mesmo horario." },
    ],
    possibilities: [
      "Visualizar compromissos por periodo.",
      "Planejar semana com antecedencia.",
      "Ajustar distribuicao de carga da equipe.",
    ],
    stepByStep: [
      "Abrir semana atual e identificar picos de volume.",
      "Priorizar itens com prazo mais curto.",
      "Reorganizar o que nao cabe no dia, sem perder prazo final.",
    ],
    carePoints: [
      "Evitar deixar tudo para o ultimo dia de competencia.",
      "Revisar agenda no inicio e no fim do expediente.",
    ],
  },
  {
    id: "mod-clientes",
    title: "Clientes",
    access: "Todos os perfis",
    icon: Users,
    objective: "Concentrar informacoes cadastrais e operacionais de cada cliente.",
    practicalGoal: "Ter contexto completo do cliente antes de qualquer atendimento.",
    nomenclatures: [
      { term: "Cliente ativo", meaning: "Cliente em operacao no periodo." },
      { term: "Responsavel interno", meaning: "Pessoa da equipe que conduz a conta." },
      { term: "Historico", meaning: "Registro cronologico de mudancas e interacoes." },
    ],
    possibilities: [
      "Consultar base de clientes por filtro.",
      "Abrir detalhes para entender andamento e pendencias.",
      "Manter informacoes atualizadas para evitar retrabalho no atendimento.",
    ],
    stepByStep: [
      "Buscar cliente pelo nome ou filtro global.",
      "Abrir detalhes e validar dados principais.",
      "Registrar atualizacoes sempre que houver mudanca relevante.",
    ],
    carePoints: [
      "Nao operar cliente com dados desatualizados.",
      "Sempre registrar mudancas que impactam equipe e prazo.",
    ],
  },
  {
    id: "mod-formularios",
    title: "Formularios",
    access: "Todos os perfis",
    icon: FileText,
    objective: "Controlar entradas vindas do site e transformar solicitacoes em acao.",
    practicalGoal: "Nenhum envio deve ficar sem tratamento.",
    nomenclatures: [
      { term: "Envio", meaning: "Formulario recebido pelo sistema." },
      { term: "Origem", meaning: "Pagina ou canal de onde veio o preenchimento." },
      { term: "Tag de captacao", meaning: "Marcador usado para identificar lead vindo do site." },
    ],
    possibilities: [
      "Listar envios recentes por tipo de formulario.",
      "Priorizar contatos com maior potencial de conversao.",
      "Alimentar o CRM com dados captados via site.",
    ],
    stepByStep: [
      "Revisar envios novos no inicio do dia.",
      "Validar nome, empresa, e-mail e mensagem.",
      "Encaminhar para CRM/atendimento conforme objetivo do contato.",
    ],
    carePoints: [
      "Nao deixar contato sem retorno inicial.",
      "Padronizar classificacao de origem para manter relatorios confiaveis.",
    ],
  },
  {
    id: "mod-crm",
    title: "CRM",
    access: "Todos os perfis",
    icon: TrendingUp,
    objective: "Acompanhar negociacoes por etapa e aumentar conversao com previsibilidade.",
    practicalGoal: "Saber quantas oportunidades existem, em que etapa estao e quanto podem gerar.",
    nomenclatures: [
      { term: "Etapa", meaning: "Posicao atual da negociacao no funil." },
      { term: "Fechado ganho", meaning: "Negociacao convertida em cliente." },
      { term: "Fechado perdido", meaning: "Negociacao encerrada sem conversao." },
      { term: "Meta", meaning: "Alvo de receita, ganhos ou conversao no periodo." },
    ],
    possibilities: [
      "Cadastrar novas negociacoes manualmente.",
      "Acompanhar leads captados via site com tag dedicada.",
      "Mover etapa com historico e possibilidade de desfazer.",
      "Cadastrar metas de receita, ganhos e conversao.",
    ],
    stepByStep: [
      "Criar negociacao com empresa, contato e valor estimado.",
      "Atualizar etapa sempre que houver interacao comercial.",
      "Revisar bloco de metas e ajustar quando necessario.",
      "Analisar top negociacoes por valor para priorizar follow-up.",
    ],
    carePoints: [
      "Nao pular etapas sem registrar contexto.",
      "Evitar manter negociacoes antigas sem proximo passo definido.",
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
      { term: "Solicitacao", meaning: "Pedido aberto pelo cliente no portal." },
      { term: "Fila", meaning: "Lista de atendimentos aguardando acao da equipe." },
      { term: "Encaminhamento", meaning: "Transferencia para o setor correto." },
    ],
    possibilities: [
      "Acompanhar novos pedidos em ordem de prioridade.",
      "Registrar andamento de cada atendimento.",
      "Direcionar para responsavel correto rapidamente.",
    ],
    stepByStep: [
      "Abrir solicitacoes novas e classificar por urgencia.",
      "Definir responsavel e prazo de retorno.",
      "Atualizar status ate a conclusao.",
    ],
    carePoints: [
      "Nao deixar solicitacao sem dono.",
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
      { term: "Conversa interna", meaning: "Troca entre funcionarios dentro do sistema." },
      { term: "Mensagem contextual", meaning: "Mensagem com objetivo claro e acao esperada." },
      { term: "Registro", meaning: "Historico que pode ser consultado depois." },
    ],
    possibilities: [
      "Usar o Grupo Geral para avisos e alinhamentos da equipe inteira.",
      "Abrir conversa pessoal (1:1) com qualquer usuario interno.",
      "Alinhar duvidas operacionais em tempo real.",
      "Compartilhar contexto rapido para continuidade de tarefas.",
      "Reduzir dependencia de canais externos para assuntos internos.",
    ],
    stepByStep: [
      "Enviar mensagem objetiva com contexto minimo necessario.",
      "Indicar prazo ou urgencia quando houver impacto em entrega.",
      "Confirmar conclusao para fechar o assunto.",
    ],
    carePoints: [
      "Evitar mensagens vagas sem acao esperada.",
      "Usar o chat para alinhamento, nao para substituir registro formal de tarefa.",
    ],
  },
  {
    id: "mod-newsletter",
    title: "Newsletter",
    access: "Admin",
    icon: Newspaper,
    objective: "Publicar comunicados e conteudos para base de assinantes.",
    practicalGoal: "Transformar conteudo em relacionamento recorrente com leads e clientes.",
    nomenclatures: [
      { term: "Assinante", meaning: "Pessoa que se cadastrou para receber newsletters." },
      { term: "Edicao", meaning: "Newsletter publicada em uma data especifica." },
      { term: "Disparo", meaning: "Envio de e-mail para a base cadastrada." },
    ],
    possibilities: [
      "Cadastrar e editar newsletters.",
      "Controlar base de assinantes ativa.",
      "Disparar comunicacao quando houver nova publicacao.",
    ],
    stepByStep: [
      "Criar a nova edicao com titulo e conteudo claro.",
      "Revisar texto e links antes de publicar.",
      "Publicar e acompanhar retorno da base.",
    ],
    carePoints: [
      "Evitar publicacao sem revisao final.",
      "Manter periodicidade para nao esfriar a base de assinantes.",
    ],
  },
  {
    id: "mod-relatorios",
    title: "Relatorios",
    access: "Admin e liderancas",
    icon: BarChart3,
    objective: "Converter dados da operacao em analise gerencial para decisao.",
    practicalGoal: "Ter visao de resultado por cliente, equipe e processo.",
    nomenclatures: [
      { term: "Categoria", meaning: "Grupo de relatorios (clientes, CRM, tarefas, etc.)." },
      { term: "Periodo", meaning: "Intervalo de dados analisado." },
      { term: "Exportacao", meaning: "Saida em formato como PDF ou XLSX." },
    ],
    possibilities: [
      "Gerar relatorios por area.",
      "Exportar para compartilhamento em reunioes.",
      "Acompanhar tendencias de desempenho.",
    ],
    stepByStep: [
      "Escolher categoria e periodo.",
      "Gerar relatorio e validar dados principais.",
      "Exportar no formato adequado para apresentacao.",
    ],
    carePoints: [
      "Sempre conferir filtros antes de gerar.",
      "Nao comparar periodos diferentes sem ajuste de contexto.",
    ],
  },
  {
    id: "mod-notificacoes",
    title: "Notificacoes",
    access: "Todos os perfis",
    icon: Bell,
    objective: "Avisar riscos operacionais para acao rapida.",
    practicalGoal: "Tratar pendencias no momento certo e evitar atraso acumulado.",
    nomenclatures: [
      { term: "Alta prioridade", meaning: "Risco imediato de prazo ou operacao." },
      { term: "Media prioridade", meaning: "Atencao necessaria no curto prazo." },
      { term: "Marcar como lida", meaning: "Sinaliza que o alerta ja foi avaliado." },
    ],
    possibilities: [
      "Visualizar alertas por criticidade.",
      "Ir direto para origem do problema.",
      "Limpar fila de alertas ja tratados.",
    ],
    stepByStep: [
      "Comecar por alertas de alta prioridade.",
      "Abrir item de origem e executar acao corretiva.",
      "Marcar como lida apos tratar o problema.",
    ],
    carePoints: [
      "Nao usar marcar como lida sem acao real.",
      "Reservar 2 momentos do dia para revisar alertas.",
    ],
  },
  {
    id: "mod-configuracoes",
    title: "Configuracoes",
    access: "Todos os perfis",
    icon: Settings,
    objective: "Ajustar perfil e preferencias para trabalhar com mais eficiencia.",
    practicalGoal: "Manter conta organizada e preparada para o uso diario.",
    nomenclatures: [
      { term: "Perfil", meaning: "Dados basicos do usuario logado." },
      { term: "Preferencia", meaning: "Ajuste individual de uso e exibicao." },
      { term: "Permissao", meaning: "Nivel de acesso conforme papel no sistema." },
    ],
    possibilities: [
      "Revisar dados da conta.",
      "Ajustar preferencias de uso interno.",
      "Garantir que o acesso esteja correto para a funcao.",
    ],
    stepByStep: [
      "Abrir configuracoes e conferir informacoes pessoais.",
      "Atualizar preferencias que impactam rotina.",
      "Validar com admin se houver limitacao inesperada de acesso.",
    ],
    carePoints: [
      "Nao compartilhar credenciais.",
      "Reportar qualquer acesso indevido imediatamente.",
    ],
  },
];

const practicalFlows = [
  {
    title: "Fluxo comercial completo (site -> CRM -> fechamento)",
    steps: [
      "Cliente preenche formulario no site.",
      "Lead entra na base com origem de captacao via site.",
      "Equipe qualifica e acompanha no CRM por etapa.",
      "Negociacao evolui para fechado ganho ou perdido com historico.",
    ],
  },
  {
    title: "Fluxo operacional diario (tarefas -> calendario -> notificacoes)",
    steps: [
      "Planejar o dia por tarefas prioritarias.",
      "Distribuir agenda no calendario para evitar conflitos.",
      "Executar e atualizar status no Kanban/Tarefas.",
      "Tratar alertas de notificacao para nao acumular atraso.",
    ],
  },
  {
    title: "Fluxo de atendimento (portal -> responsavel -> retorno)",
    steps: [
      "Nova solicitacao chega no Atendimento Portal.",
      "Responsavel e prazo sao definidos.",
      "Atendimento e atualizado ate conclusao.",
      "Retorno final ao cliente e registro interno do encerramento.",
    ],
  },
];

const dailyChecklist = [
  "5 min - Revisar notificacoes de alta prioridade.",
  "5 min - Atualizar status de tarefas e Kanban com o que foi executado.",
  "3 min - Revisar CRM e registrar avancos comerciais do dia.",
  "2 min - Garantir que proximas acoes de amanha estao claras.",
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
                Versao mastigada: o que cada area faz, para que serve, como chamar as coisas e quais resultados voce consegue gerar.
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
            Como usar este manual: leia primeiro Objetivos e Nomenclaturas. Depois abra apenas os modulos que fazem parte da sua rotina.
          </div>
        </div>

        <section id="objetivos" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> 1) Objetivos da plataforma
          </h2>
          <p className="text-sm text-muted-foreground">
            Objetivo central: transformar trabalho disperso em processo previsivel, com dono, prazo e historico.
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
                  Exemplo pratico: {item.example}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="funcionalidades" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> 3) Funcionalidades separadas por modulo
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada modulo abaixo esta separado com objetivo, nomenclaturas, possibilidades e passo a passo.
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
                  <p className="text-sm font-semibold">Objetivo do modulo</p>
                  <p className="text-sm text-muted-foreground">{module.objective}</p>
                  <p className="text-xs text-muted-foreground">
                    Resultado esperado: {module.practicalGoal}
                  </p>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Nomenclaturas do modulo</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {module.nomenclatures.map((item) => (
                      <li key={item.term}>
                        <span className="font-medium text-foreground">{item.term}:</span> {item.meaning}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Possibilidades (o que voce consegue fazer)</p>
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
            Use estes roteiros como padrao inicial para manter consistencia entre pessoas e setores.
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
            <Users className="h-5 w-5 text-primary" /> Guia rapido para novos usuarios
          </h2>
          <p className="text-sm text-muted-foreground">
            Se a pessoa entrou hoje na equipe, este e o caminho mais simples para onboarding:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Ler Objetivos e Nomenclaturas do manual.</li>
            <li>Treinar Tarefas/Kanban e Notificacoes no primeiro dia.</li>
            <li>Treinar modulo principal da funcao no segundo dia (CRM, Atendimento ou Clientes).</li>
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
