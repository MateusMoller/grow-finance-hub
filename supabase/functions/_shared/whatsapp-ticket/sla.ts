export type WhatsAppSlaState = "running" | "paused_waiting_customer" | "resolved" | "breached";

export function addBusinessHours(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

export function getSlaState(now: Date, dueAt: Date | null, paused: boolean, resolved: boolean): WhatsAppSlaState {
  if (resolved) {
    return "resolved";
  }

  if (paused) {
    return "paused_waiting_customer";
  }

  if (dueAt && now.getTime() > dueAt.getTime()) {
    return "breached";
  }

  return "running";
}
