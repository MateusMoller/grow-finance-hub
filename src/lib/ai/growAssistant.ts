import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type GrowAssistantActionType =
  | "none"
  | "created_ticket"
  | "duplicate_found"
  | "confirmation_required"
  | "human_review_required";

export type GrowAssistantRiskLevel = "baixo" | "medio" | "alto";

export interface GrowAssistantResponse {
  reply: string;
  action: {
    type: GrowAssistantActionType;
    data: Record<string, unknown>;
    actionId?: string | null;
  };
  safety: {
    riskLevel: GrowAssistantRiskLevel;
    requiresHumanReview: boolean;
    requiresConfirmation?: boolean;
  };
  interactionId?: string | null;
  detectedIntent?: string | null;
}

export interface ConfirmGrowAssistantActionInput {
  actionId: string;
  confirm: boolean;
}

export interface AskGrowAssistantInput {
  clienteId: string;
  message: string;
  channel?: "portal" | "whatsapp" | "interno";
  attachments?: Record<string, unknown>[];
}

export class GrowAssistantError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "GrowAssistantError";
    this.status = status;
  }
}

async function parseFunctionsError(error: unknown): Promise<GrowAssistantError> {
  if (!(error instanceof FunctionsHttpError)) {
    return new GrowAssistantError(error instanceof Error ? error.message : "Falha ao consultar a assistente Grow.");
  }

  try {
    const payload = await error.context.json();
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error || "Falha ao consultar a assistente Grow.")
        : "Falha ao consultar a assistente Grow.";

    return new GrowAssistantError(message, error.context.status);
  } catch {
    return new GrowAssistantError("Falha ao consultar a assistente Grow.", error.context.status);
  }
}

export async function askGrowAssistant(input: AskGrowAssistantInput): Promise<GrowAssistantResponse> {
  const { data, error } = await supabase.functions.invoke<GrowAssistantResponse>("grow-assistant", {
    body: {
      clienteId: input.clienteId,
      message: input.message,
      channel: input.channel || "portal",
      attachments: input.attachments || [],
    },
  });

  if (error) {
    throw await parseFunctionsError(error);
  }

  if (!data) {
    throw new GrowAssistantError("A assistente Grow nao retornou dados.");
  }

  return data;
}

export async function confirmGrowAssistantAction(input: ConfirmGrowAssistantActionInput): Promise<GrowAssistantResponse> {
  const { data, error } = await supabase.functions.invoke<GrowAssistantResponse>("grow-assistant-confirm-action", {
    body: {
      actionId: input.actionId,
      confirm: input.confirm,
    },
  });

  if (error) {
    throw await parseFunctionsError(error);
  }

  if (!data) {
    throw new GrowAssistantError("A confirmacao da assistente Grow nao retornou dados.");
  }

  return data;
}
