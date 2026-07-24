import { supabase } from "@/integrations/supabase/client";
import { throwDetailedFunctionError } from "@/lib/whatsappFunctionErrors";

const db = supabase as unknown as {
  functions: typeof supabase.functions;
};

export async function sendWhatsAppAttachment(
  conversationId: string,
  file: File,
  caption: string,
  clientMessageId: string,
  taskId?: string | null,
  ticketId?: string | null,
) {
  const filePayload = {
    name: file.name,
    type: file.type,
    size: file.size,
    caption,
  };

  const { data, error } = await db.functions.invoke("whatsapp-media", {
    body: {
      action: "prepare_upload",
      conversationId,
      clientMessageId,
      taskId,
      ticketId,
      file: filePayload,
    },
  });
  if (error) await throwDetailedFunctionError(error);

  const prepared = data as { attachment?: { id?: string }; storagePath?: string };
  if (!prepared.storagePath || !prepared.attachment?.id) return data;

  const { error: uploadError } = await supabase.storage
    .from("whatsapp-media")
    .upload(prepared.storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: finalized, error: finalizeError } = await db.functions.invoke("whatsapp-media", {
    body: {
      action: "finalize_upload",
      attachmentId: prepared.attachment.id,
    },
  });
  if (finalizeError) await throwDetailedFunctionError(finalizeError);

  return finalized;
}

export async function getWhatsAppAttachmentUrl(attachmentId: string) {
  const { data, error } = await db.functions.invoke("whatsapp-media", {
    body: { action: "signed_url", attachmentId },
  });
  if (error) await throwDetailedFunctionError(error);
  return data as { signedUrl?: string };
}
