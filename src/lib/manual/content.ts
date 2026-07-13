import type {
  ManualContextMeta,
  ManualContextKey,
  ManualModule,
} from "@/lib/manual/types";

export const manualContexts: ManualContextMeta[] = [
  {
    key: "institutional",
    title: "Site institucional",
    description: "Apresentação da Grow, captação de leads e conteúdo público.",
  },
  {
    key: "internal",
    title: "App interno",
    description: "Operação da equipe Grow, gestão de clientes, tarefas e execução.",
  },
  {
    key: "portal",
    title: "Portal do cliente",
    description: "Canal do cliente para solicitações, histórico, documentos e caixa.",
  },
];

export const manualModules: ManualModule[] = [
  {
    key: "institutional_positioning",
    contextKey: "institutional",
    audience: ["public_visitor", "internal_team", "leadership", "admin"],
    title: "Posicionamento e páginas públicas",
    objective: "Explicar o valor da Grow com narrativa clara e navegação objetiva.",
    order: 10,
    lessons: [
      {
        key: "institutional_overview",
        title: "Como navegar no site institucional",
        summary: "Entenda a lógica entre Sobre, Soluções, Contato e Newsletter.",
        estimatedMinutes: 4,
        steps: [
          "Abra as páginas públicas e confira a sequência de leitura para o cliente.",
          "Use a seção de soluções para guiar o visitante para a dor correta.",
          "Finalize no contato ou newsletter, sem desviar o fluxo principal.",
        ],
        tips: ["Evite excesso de texto por seção; priorize clareza do benefício."],
        actions: [{ label: "Abrir site", actionKey: "route:/sobre" }],
        tags: ["institucional", "navegação", "leads"],
      },
    ],
  },
  {
    key: "institutional_newsletter",
    contextKey: "institutional",
    audience: ["internal_team", "leadership", "admin"],
    title: "Newsletter pública e distribuição",
    objective: "Publicar conteúdo consistente e distribuir com qualidade.",
    order: 20,
    lessons: [
      {
        key: "institutional_newsletter_flow",
        title: "Fluxo de publicação e envio",
        summary: "Padronize criação, revisão, publicação e disparo de newsletters.",
        estimatedMinutes: 6,
        steps: [
          "Crie a newsletter com título, resumo e conteúdo principal.",
          "Anexe mídias do bloco dedicado e valide visualização final.",
          "Publique e somente depois realize o disparo para a base.",
        ],
        commonMistakes: ["Disparar email com conteúdo ainda em rascunho."],
        actions: [{ label: "Abrir newsletter admin", actionKey: "route:/app/newsletter" }],
        tags: ["newsletter", "mídia", "comunicação"],
      },
    ],
  },
  {
    key: "internal_dashboard",
    contextKey: "internal",
    audience: ["internal_team", "leadership", "admin"],
    title: "Dashboard operacional",
    objective: "Ler prioridades e riscos rapidamente para orientar o dia.",
    order: 10,
    lessons: [
      {
        key: "internal_dashboard_filters",
        title: "Leitura com filtros globais",
        summary: "Ajuste cliente e competência antes de qualquer conclusão.",
        estimatedMinutes: 5,
        steps: [
          "Defina filtros globais para o recorte do dia.",
          "Analise cards de risco e gargalo com o mesmo recorte.",
          "Abra o módulo de origem para execução da ação pendente.",
        ],
        commonMistakes: ["Comparar números entre recortes de filtro diferentes."],
        actions: [{ label: "Ir para dashboard", actionKey: "route:/app" }],
        tags: ["dashboard", "filtros", "prioridade"],
      },
    ],
  },
  {
    key: "internal_tasks",
    contextKey: "internal",
    audience: ["internal_team", "leadership", "admin"],
    title: "Tarefas (Kanban + Lista)",
    objective: "Executar rotina com dono, prazo e histórico confiável.",
    order: 20,
    lessons: [
      {
        key: "internal_tasks_execution",
        title: "Execução diária no Kanban",
        summary: "Transforme prioridades em tarefas com rastreabilidade.",
        estimatedMinutes: 6,
        steps: [
          "Crie tarefas com título objetivo, responsável e prazo.",
          "Use o Kanban para visão macro e lista para filtros finos.",
          "Atualize status no mesmo dia para manter indicadores íntegros.",
        ],
        tips: ["Evite tarefas sem dono e sem data."],
        actions: [{ label: "Ir para tarefas", actionKey: "route:/app/tarefas" }],
        tags: ["kanban", "lista", "produtividade"],
      },
    ],
  },
  {
    key: "internal_clients",
    contextKey: "internal",
    audience: ["internal_team", "leadership", "admin"],
    title: "Módulo de clientes",
    objective: "Centralizar cadastro e comunicação contextual com o cliente.",
    order: 30,
    lessons: [
      {
        key: "internal_clients_register",
        title: "Cadastro e consistência de dados",
        summary: "Preencha dados gerais e cadastrais mantendo coerência entre abas.",
        estimatedMinutes: 7,
        steps: [
          "Revise dados gerais antes de avançar para setores cadastrais.",
          "Use CNPJ/CEP para acelerar preenchimento com validação.",
          "Confirme status e acessos do cliente ao portal.",
        ],
        actions: [{ label: "Ir para clientes", actionKey: "route:/app/clientes" }],
        tags: ["cadastro", "cnpj", "cep"],
      },
      {
        key: "internal_clients_pending_to_request",
        title: "Pendência com solicitação vinculada",
        summary: "Abra pendências já conectadas ao chat contextual do cliente.",
        estimatedMinutes: 8,
        steps: [
          "Crie a pendência com título, setor, tipo e prazo claros.",
          "Confirme geração da solicitação vinculada automaticamente.",
          "Acompanhe retorno no histórico da mesma solicitação.",
        ],
        commonMistakes: ["Criar pendência sem acesso de portal liberado."],
        actions: [{ label: "Abrir cliente", actionKey: "route:/app/clientes" }],
        tags: ["pendência", "solicitação", "chat"],
      },
    ],
  },
  {
    key: "internal_obligations",
    contextKey: "internal",
    audience: ["internal_team", "leadership", "admin"],
    title: "Obrigações e documentos",
    objective: "Controlar prazos técnicos e documentos no mesmo fluxo operacional.",
    order: 40,
    lessons: [
      {
        key: "internal_obligations_core",
        title: "Execução por competência",
        summary: "Filtre, priorize e conclua obrigações com evidência documental.",
        estimatedMinutes: 8,
        steps: [
          "Filtre por cliente e competência.",
          "Priorize itens com prazo técnico próximo.",
          "Conclua somente com documento válido anexado.",
        ],
        actions: [{ label: "Ir para obrigações", actionKey: "route:/app/obrigacoes" }],
        tags: ["obrigações", "competência", "prazo técnico"],
      },
    ],
  },
  {
    key: "internal_reports",
    contextKey: "internal",
    audience: ["leadership", "admin"],
    title: "Relatórios gerenciais",
    objective: "Gerar leitura executiva confiável da operação.",
    order: 60,
    lessons: [
      {
        key: "internal_reports_custom",
        title: "Relatórios personalizados",
        summary: "Monte relatórios com base governada, filtros ativos, colunas classificadas e exportação controlada.",
        estimatedMinutes: 6,
        steps: [
          "Escolha a base de relatório permitida para seu perfil.",
          "Confira filtros globais e selecione somente colunas necessárias.",
          "Salve modelos recorrentes e valide avisos antes de exportar.",
        ],
        actions: [{ label: "Ir para relatórios", actionKey: "route:/app/relatorios" }],
        tags: ["relatórios", "gestão", "indicadores"],
      },
    ],
  },
  {
    key: "internal_governance",
    contextKey: "internal",
    audience: ["leadership", "admin"],
    title: "Governança (usuários, notificações, sugestões)",
    objective: "Manter segurança, priorização e melhoria contínua do sistema.",
    order: 70,
    lessons: [
      {
        key: "internal_governance_ops",
        title: "Rotina de governança",
        summary: "Padronize leitura de alertas e controle de acessos.",
        estimatedMinutes: 6,
        steps: [
          "Trate notificações críticas no início da rotina.",
          "Revise usuários e perfis com princípio de menor privilégio.",
          "Registre sugestões com contexto para priorização.",
        ],
        actions: [
          { label: "Abrir notificações", actionKey: "route:/app/notificacoes" },
          { label: "Abrir usuários", actionKey: "route:/app/usuarios" },
        ],
        tags: ["governança", "segurança", "acessos"],
      },
    ],
  },
  {
    key: "portal_overview",
    contextKey: "portal",
    audience: ["client"],
    title: "Painel geral e prioridades",
    objective: "Ajudar o cliente a agir no que está pendente com a equipe.",
    order: 10,
    lessons: [
      {
        key: "portal_overview_daily",
        title: "Leitura diária do painel",
        summary: "Veja pendências e atualizações antes de abrir novo pedido.",
        estimatedMinutes: 4,
        steps: [
          "Abra o painel para ver itens que aguardam sua ação.",
          "Entre no histórico quando houver atualização da equipe.",
          "Evite criar pedido duplicado sem revisar conversas existentes.",
        ],
        actions: [{ label: "Abrir painel", actionKey: "portal:overview" }],
        tags: ["portal", "painel", "prioridade"],
      },
    ],
  },
  {
    key: "portal_requests",
    contextKey: "portal",
    audience: ["client"],
    title: "Solicitações guiadas",
    objective: "Abrir solicitações com setor e motivo corretos para acelerar atendimento.",
    order: 20,
    lessons: [
      {
        key: "portal_requests_creation",
        title: "Criar solicitação com campos corretos",
        summary: "Escolha setor + motivo para liberar formulário adequado.",
        estimatedMinutes: 6,
        steps: [
          "Abra a aba de solicitações.",
          "Selecione setor e motivo do pedido.",
          "Preencha os campos guiados e envie com título objetivo.",
        ],
        actions: [{ label: "Ir para solicitações", actionKey: "portal:requests" }],
        tags: ["solicitação", "setor", "motivo"],
      },
    ],
  },
  {
    key: "portal_history",
    contextKey: "portal",
    audience: ["client"],
    title: "Histórico e chat contextual",
    objective: "Acompanhar status e responder no mesmo contexto da solicitação.",
    order: 30,
    lessons: [
      {
        key: "portal_history_followup",
        title: "Responder solicitações em andamento",
        summary: "Converse no chat da própria solicitação para manter contexto.",
        estimatedMinutes: 5,
        steps: [
          "Abra a aba histórico e filtre seus pedidos.",
          "Entre no detalhe da solicitação que recebeu retorno.",
          "Responda no chat e, se necessário, anexe arquivos vinculados.",
        ],
        actions: [{ label: "Ir para histórico", actionKey: "portal:request-history" }],
        tags: ["histórico", "chat", "acompanhamento"],
      },
    ],
  },
  {
    key: "portal_uploads",
    contextKey: "portal",
    audience: ["client"],
    title: "Envios de obrigações",
    objective: "Consultar documentos por competência e baixar evidências.",
    order: 40,
    lessons: [
      {
        key: "portal_uploads_competence",
        title: "Consultar documentos por competência",
        summary: "Acesse os envios da equipe organizados mês a mês.",
        estimatedMinutes: 4,
        steps: [
          "Abra a aba obrigações/envios.",
          "Escolha a competência desejada.",
          "Baixe arquivos e valide status do documento.",
        ],
        actions: [{ label: "Ir para obrigações", actionKey: "portal:uploads" }],
        tags: ["documentos", "competência", "download"],
      },
    ],
  },
];

const trackByRole: Record<string, string[]> = {
  admin: ["internal_dashboard", "internal_tasks", "internal_clients", "internal_obligations", "internal_reports", "internal_governance"],
  director: ["internal_dashboard", "internal_tasks", "internal_clients", "internal_reports"],
  manager: ["internal_dashboard", "internal_tasks", "internal_clients", "internal_obligations"],
  employee: ["internal_dashboard", "internal_tasks", "internal_clients", "internal_obligations"],
  commercial: ["institutional_positioning", "internal_clients", "internal_reports"],
  partner: ["internal_dashboard", "internal_clients", "internal_obligations"],
  departamento_pessoal: ["internal_tasks", "internal_clients", "internal_obligations"],
  fiscal: ["internal_tasks", "internal_clients", "internal_obligations"],
  contabil: ["internal_tasks", "internal_clients", "internal_obligations"],
  client: ["portal_overview", "portal_requests", "portal_history", "portal_uploads"],
};

export const getManualModulesByContexts = (contexts: ManualContextKey[]) =>
  manualModules
    .filter((module) => contexts.includes(module.contextKey))
    .sort((left, right) => left.order - right.order);

export const getRecommendedManualTrack = (
  role: string | null | undefined,
  contexts: ManualContextKey[],
) => {
  const normalized = String(role || "").trim().toLowerCase();
  const recommended = trackByRole[normalized] || trackByRole.employee;
  const allowedKeys = new Set(getManualModulesByContexts(contexts).map((module) => module.key));
  return recommended.filter((moduleKey) => allowedKeys.has(moduleKey));
};
