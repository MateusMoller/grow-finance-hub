export const HIGH_CONFIDENCE_THRESHOLD_PERCENT = 90;
export const DEFAULT_ACTIVE_CONTEXT_MINUTES = 24 * 60;

export type WhatsAppTicketStatus =
  | "open"
  | "waiting_customer"
  | "waiting_team"
  | "resolved"
  | "closed"
  | "cancelled";

export type WhatsAppTicketRouteSource =
  | "quoted_reply"
  | "interactive_selection"
  | "protocol"
  | "active_context"
  | "inference"
  | "unrouted";

export type WhatsAppTicketMessageVisibility = "customer" | "internal";

export type WhatsAppTicketRelationType =
  | "customer_reply"
  | "agent_reply"
  | "document"
  | "context"
  | "ticket_opening";

export type WhatsAppTicketRouteInput = {
  quotedTicketId?: string | null;
  interactiveTicketId?: string | null;
  protocolTicketId?: string | null;
  activeContextTicketId?: string | null;
  inferredTicketId?: string | null;
  inferenceConfidence?: number | null;
};

export type WhatsAppTicketRouteDecision = {
  source: WhatsAppTicketRouteSource;
  ticketId: string | null;
  confidencePercent: number | null;
  reason: string;
};

export type WhatsAppCustomerTicket = {
  id: string;
  organizationId: string;
  clientId: string;
  contactId: string | null;
  conversationId: string | null;
  taskId: string;
  publicProtocol: string;
  title: string;
  status: WhatsAppTicketStatus;
  responsibleUserId: string | null;
  responsibleName: string | null;
  openedAt: string;
  updatedAt: string;
};

export type WhatsAppActiveTicketContext = {
  id: string;
  organizationId: string;
  conversationId: string;
  contactId: string;
  ticketId: string;
  taskId: string;
  source: Extract<WhatsAppTicketRouteSource, "interactive_selection" | "protocol" | "active_context">;
  expiresAt: string;
};

export type WhatsAppTicketSlaRecord = {
  id: string;
  organizationId: string;
  ticketId: string;
  taskId: string;
  state: "running" | "paused_waiting_customer" | "resolved" | "breached";
  dueAt: string | null;
  breachedAt: string | null;
};

export type WhatsAppTicketEventPayload = {
  organizationId: string;
  ticketId?: string | null;
  taskId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  details?: Record<string, unknown>;
  idempotencyKey?: string | null;
};
