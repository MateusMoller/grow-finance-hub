import { supabase } from "@/integrations/supabase/client";

export type WhatsAppFlowSettings = {
  includeHumanAttendance: boolean;
};

export const defaultWhatsAppFlowSettings: WhatsAppFlowSettings = {
  includeHumanAttendance: true,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const parseResponseSettings = (response: unknown): WhatsAppFlowSettings => {
  const root = asRecord(response);
  const settings = asRecord(root.settings);

  return {
    includeHumanAttendance: settings.includeHumanAttendance !== false,
  };
};

export async function getWhatsAppFlowSettings(organizationId: string): Promise<WhatsAppFlowSettings> {
  const { data, error } = await supabase.functions.invoke("whatsapp-ticket-actions", {
    body: {
      action: "load_whatsapp_flow_settings",
      organizationId,
    },
  });
  if (error) throw error;
  return parseResponseSettings(data);
}

export async function saveWhatsAppFlowSettings(
  organizationId: string,
  settings: WhatsAppFlowSettings,
): Promise<WhatsAppFlowSettings> {
  const { data, error } = await supabase.functions.invoke("whatsapp-ticket-actions", {
    body: {
      action: "update_whatsapp_flow_settings",
      organizationId,
      includeHumanAttendance: settings.includeHumanAttendance,
    },
  });
  if (error) throw error;
  return parseResponseSettings(data);
}
