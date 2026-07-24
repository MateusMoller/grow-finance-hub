import { supabase } from "@/integrations/supabase/client";
import { throwDetailedFunctionError } from "@/lib/whatsappFunctionErrors";

export type WhatsAppQuickTaskInput = {
  organizationId: string;
  mode?: "create" | "continue";
  title: string;
  description?: string | null;
  clientName?: string | null;
  sector: string;
  priority: string;
  createdBy?: string | null;
  conversationId: string;
  contactPhone?: string | null;
  clientMessageId: string;
  existingTaskId?: string | null;
  contextMessages?: Array<{
    id: string;
    direction: "inbound" | "outbound";
    body: string;
    messageType: string;
    createdAt: string;
  }>;
};

export async function createWhatsAppQuickTask(input: WhatsAppQuickTaskInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Informe o titulo da tarefa.");

  const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
    body: {
      action: "create_quick_task",
      mode: input.mode || "create",
      conversationId: input.conversationId,
      title,
      description: input.description || "",
      sector: input.sector,
      priority: input.priority,
      clientName: input.clientName || null,
      clientMessageId: input.clientMessageId,
      existingTaskId: input.existingTaskId || null,
      contextMessages: input.contextMessages || [],
    },
  });
  if (error) await throwDetailedFunctionError(error);

  return data;
}
