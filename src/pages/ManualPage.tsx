import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Bell,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Settings,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const sectionClass = "rounded-xl border bg-card p-5 space-y-4";
const blockClass = "rounded-lg border p-4 space-y-2";

interface ContextScreen {
  context: string;
  objective: string;
  mainScreens: string[];
}

interface GlossaryItem {
  term: string;
  meaning: string;
  whereUsed: string;
}

interface ModuleGuide {
  id: string;
  title: string;
  access: string;
  icon: LucideIcon;
  objective: string;
  features: string[];
  flow: string[];
  carePoints: string[];
}

interface PortalGuideItem {
  tab: string;
  purpose: string;
  actions: string[];
}

interface FlowGuide {
  title: string;
  steps: string[];
}

const contextMap: ContextScreen[] = [
  {
    context: "Site publico (institucional)",
    objective: "Atrair leads e apresentar servicos.",
    mainScreens: ["Inicio", "Sobre", "Solucoes", "Contato", "Newsletter publica"],
  },
  {
    context: "App interno (operacao Grow)",
    objective: "Executar rotina, controlar prazos e operar clientes.",
    mainScreens: [
      "Dashboard",
      "Calendario",
      "Tarefas (Kanban/Lista)",
      "Clientes",
      "CRM",
      "Chat Interno",
      "Relatorios",
      "Financeiro",
      "Obrigacoes",
      "Notificacoes",
      "Usuarios",
      "Sugestoes",
      "Configuracoes",
    ],
  },
  {
    context: "Portal do cliente",
    objective: "Cliente abre solicitacoes, acompanha retorno e envia documentos no mesmo fluxo.",
    mainScreens: [
      "Painel geral",
      "Solicitacoes",
      "Historico",
      "Obrigacoes (envios do e-continuo)",
      "Controle de caixa",
      "Manual do usuario",
      "Configuracoes",
    ],
  },
];

const glossary: GlossaryItem[] = [
  {
    term: "Solicitacao",
    meaning: "Pedido formal aberto no sistema para um setor.",
    whereUsed: "Portal do cliente e acompanhamento interno",
  },
  {
    term: "Pendencia do portal",
    meaning: "Demanda que a equipe envia ao cliente para retorno (documento, prazo ou acao).",
    whereUsed: "Cliente > detalhe > aba Pendencias",
  },
  {
    term: "Solicitacao vinculada",
    meaning: "Registro de solicitacao conectado a uma pendencia para manter historico e comunicacao.",
    whereUsed: "Pendencias criadas para cliente no app interno",
  },
  {
    term: "Chat contextual",
    meaning: "Troca de mensagens dentro da propria solicitacao, sem perder contexto.",
    whereUsed: "Historico de solicitacoes no portal",
  },
  {
    term: "Competencia",
    meaning: "Periodo de referencia para leitura de dados e filtros globais.",
    whereUsed: "Dashboard, relatorios e filtros de operacao",
  },
  {
    term: "Open Finance",
    meaning: "Conexao para leitura de dados bancarios no modulo de caixa, sem pagamento pelo portal.",
    whereUsed: "Portal (controle de caixa) e financeiro",
  },
];

const moduleGuides: ModuleGuide[] = [
  {
    id: "mod-dashboard",
    title: "Dashboard",
    access: "Todos os perfis internos",
    icon: LayoutDashboard,
    objective: "Ler rapidamente volume, alertas e prioridades do dia.",
    features: [
      "Visao consolidada por filtros globais (empresa e competencia).",
      "Entrada para identificar gargalos operacionais.",
      "Atalho para abrir modulos de origem e agir sem trocar fluxo.",
    ],
    flow: [
      "Ajustar filtros globais.",
      "Ler cards de risco e carga de trabalho.",
      "Abrir o modulo de origem para tratar o item critico.",
    ],
    carePoints: [
      "Nao analisar numero sem confirmar filtro ativo.",
      "Atualizar tarefas e status para manter indicadores confiaveis.",
    ],
  },
  {
    id: "mod-calendario",
    title: "Calendario",
    access: "Todos os perfis internos",
    icon: CalendarDays,
    objective: "Controlar prazos e distribuir agenda sem conflito.",
    features: [
      "Leitura por periodo para antecipar semanas criticas.",
      "Apoio para balancear volume entre equipe e prioridades.",
      "Visao de compromissos recorrentes da operacao.",
    ],
    flow: [
      "Abrir semana atual.",
      "Priorizar vencimentos de curto prazo.",
      "Reorganizar agenda com base em capacidade real.",
    ],
    carePoints: [
      "Evitar concentrar entregas no ultimo dia.",
      "Revisar calendario no inicio e no fim do expediente.",
    ],
  },
  {
    id: "mod-tarefas",
    title: "Tarefas (Kanban + Lista)",
    access: "Todos os perfis internos",
    icon: ClipboardList,
    objective: "Executar a operacao em uma unica entrada, com visao de quadro e lista.",
    features: [
      "Modo Kanban como leitura principal da rotina.",
      "Modo Lista para detalhamento e filtros pontuais.",
      "Criacao rapida de tarefa e atualizacao de status em fluxo continuo.",
    ],
    flow: [
      "Abrir em Kanban para leitura geral.",
      "Criar tarefa com responsavel, prazo e prioridade.",
      "Mover status conforme execucao real.",
      "Usar Lista quando precisar de busca e recorte mais fino.",
    ],
    carePoints: [
      "Nao deixar tarefa sem dono ou prazo.",
      "Evitar titulo generico sem contexto operacional.",
    ],
  },
  {
    id: "mod-clientes",
    title: "Clientes",
    access: "Todos os perfis internos",
    icon: Users,
    objective: "Centralizar cadastro, dados operacionais e comunicacao com o cliente.",
    features: [
      "Dados gerais, mensais, cadastrais e obrigacoes por cliente.",
      "Aba Pendencias para enviar demandas diretamente ao portal do cliente.",
      "Criacao de pendencia com solicitacao vinculada e chat contextual.",
    ],
    flow: [
      "Abrir cliente e validar contexto da conta.",
      "Criar pendencia com titulo, descricao, setor, tipo e prazo.",
      "Sistema gera solicitacao vinculada e inicia canal de comunicacao.",
      "Cliente responde no portal em historico unificado da solicitacao.",
    ],
    carePoints: [
      "Se portal do cliente estiver bloqueado, liberar acesso antes de criar pendencia.",
      "Sempre usar titulo e descricao objetivos para acelerar retorno do cliente.",
    ],
  },
  {
    id: "mod-crm",
    title: "CRM",
    access: "Todos os perfis internos",
    icon: TrendingUp,
    objective: "Controlar funil comercial com historico e previsibilidade.",
    features: [
      "Pipeline por etapas com leitura de evolucao comercial.",
      "Registro de oportunidades e metas.",
      "Acompanhamento de avancos sem perder contexto de negociacao.",
    ],
    flow: [
      "Cadastrar oportunidade com contexto minimo obrigatorio.",
      "Atualizar etapa a cada interacao comercial.",
      "Revisar metas e priorizar oportunidades de maior impacto.",
    ],
    carePoints: [
      "Nao pular etapa sem justificativa registrada.",
      "Fechar itens parados para evitar funil inflado.",
    ],
  },
  {
    id: "mod-chat-interno",
    title: "Chat Interno",
    access: "Perfis internos",
    icon: MessagesSquare,
    objective: "Acelerar alinhamento entre equipe sem depender de canal externo.",
    features: [
      "Conversas para comunicacao operacional em tempo real.",
      "Historico para rastrear combinados e retornos.",
      "Apoio ao handoff entre pessoas e setores.",
    ],
    flow: [
      "Enviar mensagem com contexto e acao esperada.",
      "Indicar urgencia quando houver impacto em prazo.",
      "Confirmar conclusao para encerrar assunto.",
    ],
    carePoints: [
      "Nao substituir tarefa por mensagem de chat.",
      "Evitar mensagens vagas sem dono e sem prazo.",
    ],
  },
  {
    id: "mod-newsletter",
    title: "Newsletter (admin)",
    access: "Admin",
    icon: Newspaper,
    objective: "Publicar conteudo e disparar comunicacao para a base.",
    features: [
      "Criacao e edicao de newsletters com slug publico.",
      "Publicacao e envio de e-mails para assinantes.",
      "Upload de imagens e midias (imagem, video e audio) no editor.",
    ],
    flow: [
      "Criar nova newsletter com titulo, slug, resumo e conteudo.",
      "Adicionar midias pelo bloco 'Imagens e midias'.",
      "Publicar e depois disparar envio de e-mails.",
    ],
    carePoints: [
      "Revisar links e conteudo antes de publicar.",
      "Nao disparar e-mail com newsletter ainda em rascunho.",
    ],
  },
  {
    id: "mod-relatorios",
    title: "Relatorios",
    access: "Admin e liderancas",
    icon: BarChart3,
    objective: "Transformar operacao em leitura gerencial.",
    features: [
      "Relatorios por area e periodo.",
      "Comparacao de desempenho e volume.",
      "Apoio para tomada de decisao e reunioes de acompanhamento.",
    ],
    flow: [
      "Definir categoria e periodo.",
      "Gerar relatorio e validar filtros.",
      "Exportar quando necessario para compartilhamento.",
    ],
    carePoints: [
      "Conferir recorte de periodo antes de comparar meses.",
      "Padronizar leitura por categoria para evitar interpretacao incorreta.",
    ],
  },
  {
    id: "mod-financeiro",
    title: "Financeiro",
    access: "Perfis internos habilitados",
    icon: Wallet,
    objective: "Controlar entradas, saidas, classificacoes e pendencias financeiras.",
    features: [
      "Gestao de movimentacoes e status de tratamento.",
      "Classificacao por regras para acelerar operacao.",
      "Leitura integrada de origem, incluindo Open Finance.",
    ],
    flow: [
      "Revisar movimentos por status e categoria.",
      "Aplicar ajustes de classificacao e aprovacoes.",
      "Tratar pendencias para manter caixa consistente.",
    ],
    carePoints: [
      "Separar claramente pendencia de conciliacao x pendencia operacional.",
      "Manter categorias padronizadas para analise confiavel.",
    ],
  },
  {
    id: "mod-obrigacoes",
    title: "Obrigacoes",
    access: "Perfis internos habilitados",
    icon: FileSpreadsheet,
    objective: "Controlar obrigacoes e centralizar os envios/documentos operacionais no mesmo modulo.",
    features: [
      "Leitura de obrigacoes por cliente, status e prazo.",
      "Acompanhamento de execucao em conjunto com tarefas e calendario.",
      "Central de Documentos integrada para envio, triagem e historico.",
      "Base para rotinas recorrentes e previsao de carga.",
    ],
    flow: [
      "Filtrar por cliente e competencia.",
      "Validar status e prazo tecnico.",
      "Usar a aba de documentos para enviar, revisar e consultar anexos.",
      "Encaminhar tratativas para tarefa quando necessario.",
    ],
    carePoints: [
      "Nao deixar obrigacao sem status atualizado.",
      "Evitar processar fora de prioridade de prazo tecnico.",
    ],
  },
  {
    id: "mod-sistema",
    title: "Notificacoes, Usuarios, Sugestoes e Configuracoes",
    access: "Varia por permissao",
    icon: Settings,
    objective: "Sustentar governanca, seguranca e melhoria continua.",
    features: [
      "Notificacoes para leitura de risco e prioridade.",
      "Usuarios para controle de acessos (admin).",
      "Sugestoes para registrar melhorias e gerar pendencias internas.",
      "Configuracoes para dados de conta e preferencias.",
    ],
    flow: [
      "Tratar alertas prioritarios no inicio do dia.",
      "Ajustar acessos de usuarios quando necessario.",
      "Registrar sugestoes com contexto e anexo quando existir evidencias.",
      "Revisar configuracoes de conta periodicamente.",
    ],
    carePoints: [
      "Nao marcar notificacao como lida sem acao.",
      "Aplicar principio de menor privilegio em acessos.",
    ],
  },
];

const portalGuide: PortalGuideItem[] = [
  {
    tab: "Painel geral",
    purpose: "Resumo rapido do que esta aguardando acao do cliente.",
    actions: [
      "Ver pendencias e atualizacoes recentes.",
      "Abrir historico ou iniciar nova solicitacao sem trocar contexto.",
    ],
  },
  {
    tab: "Solicitacoes",
    purpose: "Abrir pedido com setor, motivo e campos guiados.",
    actions: [
      "Selecionar setor e motivo para liberar campos corretos.",
      "Adicionar contexto adicional e anexar arquivos.",
      "Enviar solicitacao com rastreio de status no historico.",
    ],
  },
  {
    tab: "Historico",
    purpose: "Acompanhar cada pedido com status, mensagens e documentos.",
    actions: [
      "Buscar solicitacao por titulo/categoria/setor.",
      "Abrir detalhe e responder no chat da propria solicitacao.",
      "Enviar documentos vinculados ao pedido em andamento.",
    ],
  },
  {
    tab: "Obrigacoes",
    purpose: "Consultar envios de e-continuo disponibilizados para o cliente.",
    actions: [
      "Visualizar historico automatico de envios.",
      "Baixar documentos enviados pela equipe.",
    ],
  },
  {
    tab: "Controle de caixa",
    purpose: "Gerir caixa e conectores financeiros quando o modulo estiver liberado.",
    actions: [
      "Registrar entradas e saidas.",
      "Acompanhar saude financeira e pendencias de conciliacao.",
      "Conectar Open Finance para leitura de extratos (sem pagamento no portal).",
    ],
  },
  {
    tab: "Configuracoes",
    purpose: "Manter dados da conta e seguranca de acesso.",
    actions: [
      "Atualizar senha do portal.",
      "Solicitar atualizacao cadastral e suporte de acesso.",
      "Ver status de liberacao do modulo de caixa.",
    ],
  },
];

const practicalFlows: FlowGuide[] = [
  {
    title: "Fluxo novo: pendencia do cliente com chat vinculado",
    steps: [
      "Equipe interna cria pendencia em Cliente > aba Pendencias.",
      "Sistema cria solicitacao vinculada automaticamente.",
      "Descricao inicial vira primeira mensagem do chat contextual.",
      "Cliente responde no Portal > Historico da solicitacao, com anexos no mesmo registro.",
    ],
  },
  {
    title: "Fluxo de solicitacao do portal (fim a fim)",
    steps: [
      "Cliente abre Portal > Solicitacoes e escolhe setor + motivo.",
      "Portal mostra campos estruturados do motivo selecionado.",
      "Pedido entra no Historico com status e arquivos vinculados.",
      "Equipe responde e cliente acompanha no mesmo card de solicitacao.",
    ],
  },
  {
    title: "Fluxo de newsletter com midias",
    steps: [
      "Admin abre Newsletter, cria ou edita edicao.",
      "Envia imagem/video/audio no bloco de midias do editor.",
      "Publica newsletter e dispara envio de e-mails quando aprovado.",
    ],
  },
];

const internalDailyChecklist = [
  "Revisar notificacoes de alta prioridade.",
  "Atualizar status de tarefas (kanban/lista) com o que foi executado.",
  "Conferir pendencias de clientes que aguardam retorno.",
  "Registrar avancos comerciais no CRM.",
  "Encerrar dia com proximas acoes claras para amanha.",
];

const portalDailyChecklist = [
  "Abrir Painel geral para ver o que esta pendente.",
  "Responder solicitacoes em andamento no Historico.",
  "Anexar documentos sempre vinculando ao pedido correto.",
  "Acompanhar status de retorno da equipe antes de abrir novo pedido repetido.",
];

export default function ManualPage() {
  return (
    <AppLayout>
      <div className="max-w-6xl space-y-6">
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpenText className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-bold">Manual de uso - Grow Finance Hub</h1>
              <p className="text-sm text-muted-foreground">
                Versao atualizada com as telas e fluxos ativos do sistema, incluindo portal do cliente, pendencias vinculadas e newsletter com midias.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <a href="#mapa" className="rounded-lg border p-3 hover:bg-muted">1. Mapa do sistema</a>
            <a href="#nomenclaturas" className="rounded-lg border p-3 hover:bg-muted">2. Nomenclaturas</a>
            <a href="#modulos" className="rounded-lg border p-3 hover:bg-muted">3. Modulos internos</a>
            <a href="#portal" className="rounded-lg border p-3 hover:bg-muted">4. Portal do cliente</a>
            <a href="#fluxos" className="rounded-lg border p-3 hover:bg-muted">5. Fluxos ponta a ponta</a>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Regra de uso: sempre trabalhe no modulo dono do fluxo. Evite tirar a demanda do contexto original.
          </div>
        </div>

        <section id="mapa" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> 1) Mapa atual do sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            O produto esta separado por contexto para reduzir friccao e manter seguranca operacional.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {contextMap.map((item) => (
              <div key={item.context} className={blockClass}>
                <p className="text-sm font-semibold">{item.context}</p>
                <p className="text-sm text-muted-foreground">{item.objective}</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {item.mainScreens.map((screen) => (
                    <li key={screen}>{screen}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="nomenclaturas" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> 2) Nomenclaturas operacionais
          </h2>
          <p className="text-sm text-muted-foreground">
            Use estes termos como padrao para alinhar atendimento, operacao e cliente no mesmo idioma.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {glossary.map((item) => (
              <div key={item.term} className={blockClass}>
                <p className="text-sm font-semibold">{item.term}</p>
                <p className="text-sm text-muted-foreground">{item.meaning}</p>
                <p className="text-xs text-muted-foreground">Onde aparece: {item.whereUsed}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="modulos" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> 3) Guia dos modulos internos
          </h2>
          <p className="text-sm text-muted-foreground">
            Este bloco cobre as telas da barra lateral interna e o fluxo recomendado de uso por modulo.
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
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
                <Badge variant="secondary" className="text-[11px]">{module.access}</Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className={blockClass}>
                  <p className="text-sm font-semibold">Objetivo do modulo</p>
                  <p className="text-sm text-muted-foreground">{module.objective}</p>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">O que voce consegue fazer</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {module.features.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Fluxo recomendado</p>
                  <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                    {module.flow.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>

                <div className={blockClass}>
                  <p className="text-sm font-semibold">Pontos de atencao</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {module.carePoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}

        <section id="portal" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> 4) Portal do cliente - abas e uso
          </h2>
          <p className="text-sm text-muted-foreground">
            O portal foi organizado para cliente resolver solicitacoes, documentos e retorno no mesmo ambiente.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {portalGuide.map((item) => (
              <div key={item.tab} className={blockClass}>
                <p className="text-sm font-semibold">{item.tab}</p>
                <p className="text-sm text-muted-foreground">{item.purpose}</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {item.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="fluxos" className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> 5) Fluxos ponta a ponta (atualizados)
          </h2>
          <p className="text-sm text-muted-foreground">
            Estes fluxos refletem o comportamento atual das telas e sao o padrao recomendado de operacao.
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            {practicalFlows.map((flow) => (
              <div key={flow.title} className={blockClass}>
                <p className="text-sm font-semibold">{flow.title}</p>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                  {flow.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Rotina diaria recomendada
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={blockClass}>
              <p className="text-sm font-semibold">Time interno</p>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                {internalDailyChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div className={blockClass}>
              <p className="text-sm font-semibold">Cliente no portal</p>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                {portalDailyChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-lg border bg-primary/5 p-3 text-sm">
            Resultado esperado: menos retrabalho, historico completo por demanda e retorno mais rapido entre cliente e equipe.
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Referencia rapida de telas
          </h2>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded-lg border p-3">Dashboard e indicadores: <span className="text-muted-foreground">/app</span></div>
            <div className="rounded-lg border p-3">Calendario: <span className="text-muted-foreground">/app/calendario</span></div>
            <div className="rounded-lg border p-3">Tarefas (kanban/lista): <span className="text-muted-foreground">/app/tarefas</span></div>
            <div className="rounded-lg border p-3">Clientes e pendencias: <span className="text-muted-foreground">/app/clientes</span></div>
            <div className="rounded-lg border p-3">CRM: <span className="text-muted-foreground">/app/crm</span></div>
            <div className="rounded-lg border p-3">Chat interno: <span className="text-muted-foreground">/app/chat-interno</span></div>
            <div className="rounded-lg border p-3">Newsletter admin: <span className="text-muted-foreground">/app/newsletter</span></div>
            <div className="rounded-lg border p-3">Relatorios: <span className="text-muted-foreground">/app/relatorios</span></div>
            <div className="rounded-lg border p-3">Financeiro: <span className="text-muted-foreground">/app/financeiro</span></div>
            <div className="rounded-lg border p-3">Obrigacoes: <span className="text-muted-foreground">/app/obrigacoes</span></div>
            <div className="rounded-lg border p-3">Portal do cliente: <span className="text-muted-foreground">/app/portal</span></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Observacao: atalhos antigos como /app/solicitacoes, /app/kanban, /app/comercial, /app/acessorias e /app/econtinuo redirecionam para os modulos atuais.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Onboarding rapido (novo usuario)
          </h2>
          <ol className="list-decimal pl-5 text-sm space-y-2">
            <li>Comecar por Dashboard, Tarefas e Clientes para entender o fluxo central.</li>
            <li>Treinar criacao de pendencia no cliente com solicitacao vinculada.</li>
            <li>Treinar resposta no historico do portal para fechar o ciclo cliente x equipe.</li>
            <li>Se for admin, validar tambem Newsletter com upload de midias e modulo de Usuarios.</li>
          </ol>
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Sempre que uma tela mudar, atualize este manual junto da entrega para manter processo, linguagem e treinamento alinhados.
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1"><LayoutDashboard className="h-3 w-3" /> Dashboard</Badge>
            <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Clientes</Badge>
            <Badge variant="outline" className="gap-1"><Newspaper className="h-3 w-3" /> Newsletter</Badge>
            <Badge variant="outline" className="gap-1"><Wallet className="h-3 w-3" /> Financeiro</Badge>
            <Badge variant="outline" className="gap-1"><UserCog className="h-3 w-3" /> Usuarios</Badge>
            <Badge variant="outline" className="gap-1"><MessagesSquare className="h-3 w-3" /> Chat</Badge>
            <Badge variant="outline" className="gap-1"><BarChart3 className="h-3 w-3" /> Relatorios</Badge>
            <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" /> CRM</Badge>
            <Badge variant="outline" className="gap-1"><Send className="h-3 w-3" /> E-continuo</Badge>
            <Badge variant="outline" className="gap-1"><Settings className="h-3 w-3" /> Configuracoes</Badge>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
