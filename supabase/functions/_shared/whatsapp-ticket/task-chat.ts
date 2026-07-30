export function formatTaskCustomerMessage(input: {
  ticketProtocol: string;
  taskTitle: string;
  attendantName: string;
  attendantSector?: string | null;
  message: string;
}): string {
  return [
    `*Ticket:* #${input.ticketProtocol}`,
    `*Tarefa:* ${input.taskTitle}`,
    `*Atendente:* ${input.attendantName}`,
    `*Setor:* ${input.attendantSector || "Equipe Grow"}`,
    "",
    input.message,
  ].join("\n");
}

export function formatTicketOpeningMessage(input: {
  ticketProtocol: string;
  taskTitle: string;
  responsibleName: string;
  message?: string | null;
}): string {
  return [
    "*Ticket de atendimento criado*",
    "",
    `*Número do ticket:* #${input.ticketProtocol}`,
    `*Título:* ${input.taskTitle}`,
    `*Responsável:* ${input.responsibleName || "Equipe Grow"}`,
    "",
    input.message || "Recebemos sua solicitação e nossa equipe dará continuidade ao atendimento por este ticket.",
  ].join("\n");
}
