import { runGrowAssistantWithAuthorizedContext } from "../_shared/ai/assistant.ts";
import { buildAssistantRequestContext, getAuthorizedClientContext } from "../_shared/ai/authorization.ts";
import { jsonResponse, asRecord, asTrimmedString, coerceErrorMessage } from "../_shared/ai/utils.ts";
import type { AssistantChannel, JsonRecord } from "../_shared/ai/types.ts";

function normalizeChannel(value: unknown): AssistantChannel {
  const channel = String(value || "").trim().toLowerCase();
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "interno") return "interno";
  return "portal";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({}, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const authContext = await buildAssistantRequestContext(req);
    if ("error" in authContext) {
      return authContext.error;
    }

    const body = asRecord(await req.json().catch(() => ({}))) || {};
    const message = asTrimmedString(body.message);
    const clienteId = asTrimmedString(body.clienteId);
    const channel = normalizeChannel(body.channel);
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((item) => item && typeof item === "object") as JsonRecord[]
      : [];

    if (!message) {
      return jsonResponse({ error: "message is required." }, 400);
    }

    const authorizedContext = await getAuthorizedClientContext({
      supabaseAdmin: authContext.supabaseAdmin,
      userId: authContext.requester.userId,
      requesterRoles: authContext.roles,
      clienteId,
      requesterDisplayName: authContext.requester.displayName,
      requesterEmail: authContext.requester.email,
    });

    const result = await runGrowAssistantWithAuthorizedContext({
      supabaseAdmin: authContext.supabaseAdmin,
      userId: authContext.requester.userId,
      requesterRoles: authContext.roles,
      clienteId: authorizedContext.client.id,
      message,
      channel,
      attachments,
      authorizedContext,
    });

    return jsonResponse(result, 200);
  } catch (error: unknown) {
    return jsonResponse(
      {
        error: coerceErrorMessage(error, "Failed to execute Grow assistant."),
      },
      400,
    );
  }
});
