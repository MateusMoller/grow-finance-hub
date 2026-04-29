import { confirmGrowAssistantAction } from "../_shared/ai/actions.ts";
import { buildAssistantRequestContext } from "../_shared/ai/authorization.ts";
import { asBoolean, asRecord, asTrimmedString, coerceErrorMessage, jsonResponse } from "../_shared/ai/utils.ts";

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
    const actionId = asTrimmedString(body.actionId);
    const confirm = asBoolean(body.confirm, false);

    if (!actionId) {
      return jsonResponse({ error: "actionId is required." }, 400);
    }

    const result = await confirmGrowAssistantAction({
      supabaseAdmin: authContext.supabaseAdmin,
      userId: authContext.requester.userId,
      requesterRoles: authContext.roles,
      actionId,
      confirm,
      requesterDisplayName: authContext.requester.displayName,
      requesterEmail: authContext.requester.email,
    });

    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: coerceErrorMessage(error, "Failed to confirm Grow assistant action."),
      },
      400,
    );
  }
});
