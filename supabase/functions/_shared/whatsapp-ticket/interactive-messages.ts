export type WhatsAppInteractiveTicketOption = {
  id: string;
  title: string;
  description?: string | null;
};

const AUTO_ACTION_PREFIX = "grow:auto:";
const TICKET_ROW_PREFIX = "grow:ticket:";
const REQUEST_TYPE_PREFIX = "grow:reqtype:";

export type WhatsAppAutoServiceAction =
  | "menu"
  | "attendance"
  | "requests"
  | "consult_tasks"
  | "create_task"
  | "new_request"
  | "send_document"
  | "talk_team";

const truncateWhatsAppTitle = (value: string, fallback: string) => {
  const title = value.trim() || fallback;
  return title.length > 24 ? `${title.slice(0, 21)}...` : title;
};

const truncateWhatsAppDescription = (value?: string | null) => {
  if (!value) return undefined;
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
};

export const buildTicketRowId = (ticketId: string) => `${TICKET_ROW_PREFIX}${ticketId}`;

export const buildAutoActionRowId = (action: WhatsAppAutoServiceAction) => `${AUTO_ACTION_PREFIX}${action}`;

export const buildRequestTypeRowId = (requestTypeId: string) => `${REQUEST_TYPE_PREFIX}${requestTypeId}`;

const normalizeReplyText = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function parseAutoServiceReplyId(value: string | null | undefined) {
  const id = String(value || "").trim();
  if (!id) return { type: "unknown" as const, id: null, action: null };

  if (id.startsWith(TICKET_ROW_PREFIX)) {
    return { type: "ticket" as const, id: id.slice(TICKET_ROW_PREFIX.length), action: null };
  }

  if (id.startsWith(REQUEST_TYPE_PREFIX)) {
    return { type: "request_type" as const, id: id.slice(REQUEST_TYPE_PREFIX.length), action: null };
  }

  if (id.startsWith(AUTO_ACTION_PREFIX)) {
    const action = id.slice(AUTO_ACTION_PREFIX.length);
    if (
      action === "attendance" ||
      action === "menu" ||
      action === "requests" ||
      action === "consult_tasks" ||
      action === "create_task" ||
      action === "new_request" ||
      action === "send_document" ||
      action === "talk_team"
    ) {
      return { type: "action" as const, id: null, action };
    }
  }

  return { type: "unknown" as const, id: null, action: null };
}

export function parseAutoServiceTextReply(value: string | null | undefined) {
  const text = normalizeReplyText(value);
  if (!text) return { type: "unknown" as const, id: null, action: null };

  if (["menu", "inicio", "iniciar", "oi", "ola", "olá"].includes(text)) {
    return { type: "action" as const, id: null, action: "menu" as const };
  }

  if ([
    "atendimento",
    "falar com atendente",
    "falar com a equipe",
    "falar com alguem",
    "quero falar com alguem",
    "humano",
  ].includes(text)) {
    return { type: "action" as const, id: null, action: "attendance" as const };
  }

  if (["solicitacoes", "solicitacao", "solicitações", "solicitação", "demandas"].includes(text)) {
    return { type: "action" as const, id: null, action: "requests" as const };
  }

  if (["tarefas em andamento", "consultar tarefas", "tarefas abertas"].includes(text)) {
    return { type: "action" as const, id: null, action: "consult_tasks" as const };
  }

  if (["criar nova tarefa", "nova tarefa", "abrir tarefa"].includes(text)) {
    return { type: "action" as const, id: null, action: "create_task" as const };
  }

  return { type: "unknown" as const, id: null, action: null };
}


export function buildTicketSelectionInteractivePayload(input: {
  to: string;
  bodyText: string;
  buttonText?: string;
  options: WhatsAppInteractiveTicketOption[];
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: input.bodyText },
      action: {
        button: input.buttonText ?? "Selecionar ticket",
        sections: [
          {
            title: "Tickets ativos",
            rows: input.options.slice(0, 10).map((option) => ({
              id: buildTicketRowId(option.id),
              title: truncateWhatsAppTitle(option.title, "Ticket"),
              description: truncateWhatsAppDescription(option.description),
            })),
          },
        ],
      },
    },
  };
}

export function buildAutoServiceListPayload(input: {
  to: string;
  bodyText?: string;
  tickets?: WhatsAppInteractiveTicketOption[];
}) {
  const ticketRows = (input.tickets || []).slice(0, 7).map((ticket) => ({
    id: buildTicketRowId(ticket.id),
    title: truncateWhatsAppTitle(ticket.title, "Ticket"),
    description: truncateWhatsAppDescription(ticket.description),
  }));

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: input.bodyText ||
          "Ola. Para direcionarmos seu atendimento corretamente, selecione uma das opcoes abaixo.",
      },
      action: {
        button: "Escolher opcao",
        sections: [
          {
            title: "Menu",
            rows: [
              {
                id: buildAutoActionRowId("attendance"),
                title: "Atendimento",
                description: "Falar diretamente com a equipe.",
              },
              {
                id: buildAutoActionRowId("requests"),
                title: "Solicitacoes",
                description: "Abrir ou acompanhar uma demanda.",
              },
            ],
          },
          ...(ticketRows.length > 0
            ? [
                {
                  title: "Tickets ativos",
                  rows: ticketRows,
                },
              ]
            : []),
        ],
      },
    },
  };
}

export function buildAutoServiceButtonPayload(input: {
  to: string;
  bodyText?: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: input.bodyText ||
          "Ola. Para direcionarmos seu atendimento corretamente, selecione uma das opcoes abaixo.",
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: buildAutoActionRowId("attendance"),
              title: "Atendimento",
            },
          },
          {
            type: "reply",
            reply: {
              id: buildAutoActionRowId("requests"),
              title: "Solicitacoes",
            },
          },
        ],
      },
    },
  };
}

export function buildRequestsFlowButtonPayload(input: {
  to: string;
  bodyText?: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: input.bodyText ||
          "Selecione como deseja prosseguir. Voce pode consultar tarefas em andamento ou abrir uma nova solicitacao para nossa equipe.",
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: buildAutoActionRowId("consult_tasks"),
              title: "Tarefas em andamento",
            },
          },
          {
            type: "reply",
            reply: {
              id: buildAutoActionRowId("create_task"),
              title: "Criar nova tarefa",
            },
          },
        ],
      },
    },
  };
}

export function buildRequestsFlowListPayload(input: {
  to: string;
  bodyText?: string;
  requestTypes: WhatsAppInteractiveTicketOption[];
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: input.bodyText ||
          "Selecione como deseja prosseguir. Voce pode consultar tarefas em andamento ou abrir uma nova solicitacao para nossa equipe.",
      },
      action: {
        button: "Escolher opcao",
        sections: [
          {
            title: "Acompanhamento",
            rows: [
              {
                id: buildAutoActionRowId("consult_tasks"),
                title: "Tarefas em andamento",
                description: "Consultar demandas abertas deste cliente.",
              },
            ],
          },
          {
            title: "Nova solicitacao",
            rows: input.requestTypes.slice(0, 10).map((requestType) => ({
              id: buildRequestTypeRowId(requestType.id),
              title: truncateWhatsAppTitle(requestType.title, "Solicitacao"),
              description: truncateWhatsAppDescription(requestType.description),
            })),
          },
        ],
      },
    },
  };
}
