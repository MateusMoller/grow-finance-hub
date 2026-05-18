import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const INTERNAL_ROLES = [
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "partner",
  "departamento_pessoal",
  "fiscal",
  "contabil",
] as const;

export const CLIENT_ROLE = "client" as const;

export const REQUEST_SECTORS = [
  "Fiscal",
  "Departamento Pessoal",
  "Contabil",
  "Financeiro",
  "Atendimento",
] as const;

export const GUIDE_TYPES = [
  "DAS",
  "INSS",
  "FGTS",
  "IRRF",
  "PIS",
  "COFINS",
  "ISS",
  "ICMS",
  "OUTRA",
] as const;

export type JsonRecord = Record<string, unknown>;
export type AssistantChannel = "portal" | "whatsapp" | "interno";
export type RiskLevel = "baixo" | "medio" | "alto";
export type AssistantActionType =
  | "none"
  | "created_ticket"
  | "duplicate_found"
  | "confirmation_required"
  | "human_review_required";
export type DuplicateConfidence = "baixo" | "medio" | "alto";
export type DuplicateType = "chamado" | "documento" | "guia" | "cadastro" | "mensagem" | "outro";
export type DuplicateRecommendedAction =
  | "criar_novo"
  | "atualizar_existente"
  | "pedir_confirmacao"
  | "validacao_humana";
export type GuideType = (typeof GUIDE_TYPES)[number];
export type RequestSector = (typeof REQUEST_SECTORS)[number];
export type RequesterIdentityMethod = "session" | "phone_match";

export type AuthenticatedAssistantRequestContext = {
  supabaseAdmin: SupabaseClient;
  supabaseUser: SupabaseClient;
  requester: {
    userId: string;
    email: string | null;
    displayName: string | null;
    identityMethod: RequesterIdentityMethod;
    isIdentityVerified: boolean;
  };
  roles: string[];
  organizationIds: string[];
  isInternalUser: boolean;
  isClientUser: boolean;
};

export type AuthorizedClientSummary = {
  id: string;
  organizationId: string;
  name: string;
  cnpjMasked: string | null;
  cnpjDigits: string | null;
  sector: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  portalUserId: string | null;
  portalCashflowEnabled: boolean;
};

export type AuthorizedClientPendingTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sector: string;
  type: string;
  dueDate: string | null;
};

export type AuthorizedClientRequest = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sector: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthorizedClientDocument = {
  id: string;
  fileName: string;
  category: string;
  createdAt: string;
  requestId: string | null;
};

export type AuthorizedClientGuideStatus = {
  id: string;
  obligationName: string;
  obligationPeriod: string | null;
  dueDate: string | null;
  status: string | null;
  protocol: string | null;
  notes: string | null;
};

export type AuthorizedClientPermissions = {
  canConsultClientData: boolean;
  canCreateTickets: boolean;
  canConsultGuides: boolean;
  canGenerateOperationalSummaries: boolean;
  canRequestReports: boolean;
  canReceiveSensitiveReportsDirectly: boolean;
  requiresHumanReviewForSensitiveActions: boolean;
  requiresSecureLinkForSensitiveReports: boolean;
};

export type AuthorizedClientContext = {
  requester: AuthenticatedAssistantRequestContext["requester"] & {
    roles: string[];
    isInternalUser: boolean;
    isClientUser: boolean;
  };
  client: AuthorizedClientSummary;
  permissions: AuthorizedClientPermissions;
  pendingTasks: AuthorizedClientPendingTask[];
  recentRequests: AuthorizedClientRequest[];
  recentDocuments: AuthorizedClientDocument[];
  guideStatuses: AuthorizedClientGuideStatus[];
};

export type AssistantActionEnvelope = {
  type: AssistantActionType;
  data: JsonRecord;
  actionId?: string | null;
};

export type AssistantSafetyEnvelope = {
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
  requiresConfirmation?: boolean;
};

export type ToolExecutionResult = {
  toolName: string;
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
  confirmationRequired: boolean;
  action: AssistantActionEnvelope;
  data: JsonRecord;
  detectedIntent?: string | null;
};

export type DuplicateDetectionResult = {
  duplicidade_detectada: boolean;
  nivel_confianca: DuplicateConfidence;
  tipo_duplicidade: DuplicateType;
  registro_relacionado_id: string | null;
  motivo: string;
  acao_recomendada: DuplicateRecommendedAction;
  exige_validacao_humana: boolean;
};

export type RunGrowAssistantParams = {
  supabaseAdmin: SupabaseClient;
  userId: string;
  requesterRoles?: string[];
  clienteId?: string | null;
  message: string;
  channel: AssistantChannel;
  attachments?: JsonRecord[];
};

export type GrowAssistantRunResult = {
  reply: string;
  action: AssistantActionEnvelope;
  safety: AssistantSafetyEnvelope;
  context: {
    clientId: string;
    clientName: string;
  };
  detectedIntent: string | null;
  toolExecutions: ToolExecutionResult[];
  interactionId: string | null;
};

export type ParsedWhatsAppInboundMessage = {
  from: string;
  profileName: string | null;
  messageId: string | null;
  messageType: string;
  text: string;
  rawText: string | null;
  attachments: JsonRecord[];
  timestamp: string | null;
};

export type WhatsAppClientMatch = {
  clientId: string;
  organizationId: string;
  clientName: string;
  portalUserId: string | null;
  phone: string | null;
  cnpjMasked: string | null;
  cnpjDigits: string | null;
  matchedBy: "clients.phone" | "client_data.whatsapp" | "client_data.telefone";
};
