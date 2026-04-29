import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleWhatsAppInboundMessage, verifyWhatsAppWebhook } from "../_shared/ai/whatsapp.ts";
import { coerceErrorMessage, jsonResponse } from "../_shared/ai/utils.ts";

function buildSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase backend configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return verifyWhatsAppWebhook(req);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const supabaseAdmin = buildSupabaseAdminClient();
    const result = await handleWhatsAppInboundMessage({
      payload,
      supabaseAdmin,
    });

    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: coerceErrorMessage(error, "Failed to process WhatsApp webhook."),
      },
      400,
    );
  }
});
