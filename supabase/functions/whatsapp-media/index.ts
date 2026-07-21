import { buildSupabaseAdminClient, corsHeaders, getAuthenticatedUser, jsonResponse, assertWhatsAppModuleAccess } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppEvent } from "../_shared/whatsapp-events.ts";
import { dispatchWhatsAppMediaMessage } from "../_shared/whatsapp-provider.ts";
import { asRecord, asString, classifyAttachment, isActiveWindowOpen, safePreview } from "../_shared/whatsapp-validation.ts";

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

async function loadConversation(supabaseAdmin: SupabaseAdmin, conversationId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("*, contact:whatsapp_contacts(*)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("conversation_not_found");
  return data;
}

async function loadSenderDisplayName(supabaseAdmin: SupabaseAdmin, userId: string, organizationId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return asString(data?.display_name) || "Equipe Grow";
}

const formatOutboundCaptionForClient = (caption: string, senderDisplayName: string) => {
  const senderLabel = senderDisplayName === "Equipe Grow" ? senderDisplayName : `${senderDisplayName} - Grow`;
  return caption.trim() ? `*${senderLabel}:*\n${caption.trim()}` : `*${senderLabel}:*`;
};

async function prepareUpload(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const clientMessageId = asString(body.clientMessageId);
  const file = asRecord(body.file);
  const fileName = asString(file.name) || "arquivo";
  const contentType = asString(file.type);
  const sizeBytes = Number(file.size || 0);
  const caption = asString(file.caption);
  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);

  const attachmentPolicy = classifyAttachment(contentType, sizeBytes);
  const blockedReason = !isActiveWindowOpen(conversation.active_window_expires_at)
    ? "active_window_closed"
    : attachmentPolicy.allowed
      ? null
      : attachmentPolicy.reason;
  const now = new Date().toISOString();

  const { data: message, error: messageError } = await supabaseAdmin.from("whatsapp_messages").upsert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    client_id: conversation.client_id,
    direction: "outbound",
    sender_user_id: userId,
    client_message_id: clientMessageId,
    message_type: attachmentPolicy.allowedType === "pdf" ? "document" : attachmentPolicy.allowedType || "document",
    body: caption,
    safe_preview: safePreview(caption || fileName),
    delivery_status: blockedReason ? "failed" : "queued",
    blocked_reason: blockedReason,
    created_at: now,
    updated_at: now,
  }, { onConflict: "organization_id,client_message_id" }).select("*").single();
  if (messageError) throw messageError;

  const storagePath = `${conversation.organization_id}/${conversation.id}/${message.id}/${fileName}`;
  const { data: attachment, error: attachmentError } = await supabaseAdmin
    .from("whatsapp_conversation_attachments")
    .insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      message_id: message.id,
      direction: "outbound",
      storage_path: storagePath,
      file_name: fileName,
      content_type: contentType,
      size_bytes: sizeBytes,
      allowed_type: attachmentPolicy.allowedType,
      status: blockedReason ? "blocked" : "pending",
      failure_reason: blockedReason,
    })
    .select("*")
    .single();
  if (attachmentError) throw attachmentError;

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    message_id: message.id,
    event_type: blockedReason ? "attachment_blocked" : "outbound_requested",
    actor_user_id: userId,
    details: { file_name: fileName, content_type: contentType, blocked_reason: blockedReason },
  });

  if (blockedReason) throw new Error(blockedReason);
  return { ok: true, message, attachment, storagePath };
}

async function finalizeUpload(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const attachmentId = asString(body.attachmentId);
  const { data: attachment, error } = await supabaseAdmin
    .from("whatsapp_conversation_attachments")
    .select(`
      id,
      organization_id,
      conversation_id,
      message_id,
      storage_path,
      file_name,
      content_type,
      message:whatsapp_messages(body),
      conversation:whatsapp_conversations(contact:whatsapp_contacts(phone_number))
    `)
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw error;
  if (!attachment) throw new Error("attachment_not_found");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, attachment.organization_id);

  const { data: storedFile, error: downloadError } = await supabaseAdmin.storage
    .from("whatsapp-media")
    .download(attachment.storage_path);
  if (downloadError) throw downloadError;

  const conversation = asRecord(attachment.conversation);
  const contact = asRecord(conversation.contact);
  const message = asRecord(attachment.message);
  const senderDisplayName = await loadSenderDisplayName(supabaseAdmin, userId, attachment.organization_id);
  const providerResult = await dispatchWhatsAppMediaMessage({
    toPhone: asString(contact.phone_number),
    file: storedFile,
    fileName: attachment.file_name,
    contentType: attachment.content_type,
    caption: formatOutboundCaptionForClient(asString(message.body), senderDisplayName),
  });
  const now = new Date().toISOString();

  await Promise.all([
    supabaseAdmin
      .from("whatsapp_conversation_attachments")
      .update({ status: "sent", provider_media_id: providerResult.providerMediaId, failure_reason: null })
      .eq("id", attachment.id),
    supabaseAdmin
      .from("whatsapp_messages")
      .update({
        provider_message_id: providerResult.providerMessageId,
        delivery_status: providerResult.deliveryStatus,
        sent_at: now,
        updated_at: now,
      })
      .eq("id", attachment.message_id),
  ]);

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: attachment.organization_id,
    conversation_id: attachment.conversation_id,
    message_id: attachment.message_id,
    event_type: "attachment_sent",
    actor_user_id: userId,
    provider_event_id: providerResult.providerMessageId,
    details: { storage_path: attachment.storage_path, provider_media_id: providerResult.providerMediaId, sender_display_name: senderDisplayName },
  });

  return { ok: true };
}

async function signedUrl(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const attachmentId = asString(body.attachmentId);
  const { data: attachment, error } = await supabaseAdmin
    .from("whatsapp_conversation_attachments")
    .select("organization_id, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw error;
  if (!attachment?.storage_path) throw new Error("attachment_not_found");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, attachment.organization_id);

  const { data, error: signedError } = await supabaseAdmin.storage
    .from("whatsapp-media")
    .createSignedUrl(attachment.storage_path, 60 * 5);
  if (signedError) throw signedError;
  return { signedUrl: data?.signedUrl };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = asRecord(await request.json().catch(() => ({})));
    const action = asString(body.action);
    const supabaseAdmin = buildSupabaseAdminClient();
    const user = await getAuthenticatedUser(request, supabaseAdmin);
    if (action === "prepare_upload") return jsonResponse(await prepareUpload(supabaseAdmin, user.id, body));
    if (action === "finalize_upload") return jsonResponse(await finalizeUpload(supabaseAdmin, user.id, body));
    if (action === "signed_url") return jsonResponse(await signedUrl(supabaseAdmin, user.id, body));
    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "media_action_failed" }, 400);
  }
});
