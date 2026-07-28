const PUBLIC_PROTOCOL_PATTERN = /^WAT-\d{6}-[A-Z0-9]{6}$/;

export const WHATSAPP_AUTO_ACTIONS = {
  menu: "menu",
  attendance: "attendance",
  requests: "requests",
  consultTasks: "consult_tasks",
  createTask: "create_task",
  continueContext: "continue_context",
  endFlow: "end_flow",
} as const;

export type WhatsAppAutoAction =
  typeof WHATSAPP_AUTO_ACTIONS[keyof typeof WHATSAPP_AUTO_ACTIONS];

export function buildPublicTicketProtocol(input: {
  openedAt?: Date;
  sequence: number;
  suffix?: string;
}): string {
  const date = input.openedAt ?? new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const suffix = (input.suffix ?? input.sequence.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, "");

  return `WAT-${year}${month}-${suffix.padStart(6, "0").slice(-6)}`;
}

export function isValidPublicTicketProtocol(protocol: string | null | undefined): boolean {
  return PUBLIC_PROTOCOL_PATTERN.test(String(protocol ?? "").trim().toUpperCase());
}

export function extractPublicTicketProtocol(text: string | null | undefined): string | null {
  const match = String(text ?? "").toUpperCase().match(/WAT-\d{6}-[A-Z0-9]{6}/);
  return match?.[0] ?? null;
}
