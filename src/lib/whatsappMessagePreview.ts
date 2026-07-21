import type { WhatsAppMessage } from "@/lib/whatsappTypes";

export type WhatsAppReplyReference = {
  id: string;
  providerMessageId: string | null;
  direction: WhatsAppMessage["direction"];
  label: string;
  preview: string;
};

export const whatsAppMessagePreview = (message: Pick<WhatsAppMessage, "body" | "safe_preview" | "message_type">) => {
  const text = (message.body || message.safe_preview || "").trim();
  if (text) return text;
  if (message.message_type === "image") return "Imagem";
  if (message.message_type === "audio") return "Áudio";
  if (message.message_type === "video") return "Vídeo";
  if (message.message_type === "document") return "Documento";
  return "Mensagem";
};

export const whatsAppReplyReferenceFor = (message: WhatsAppMessage): WhatsAppReplyReference => ({
  id: message.id,
  providerMessageId: message.provider_message_id,
  direction: message.direction,
  label: message.direction === "inbound" ? "Cliente" : "Equipe Grow",
  preview: whatsAppMessagePreview(message),
});
