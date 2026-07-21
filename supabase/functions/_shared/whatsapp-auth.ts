import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function buildSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase backend configuration.");
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getAuthenticatedUser(request: Request, supabaseAdmin: ReturnType<typeof buildSupabaseAdminClient>) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new Error("missing_authorization");
  }

  const token = authorization.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("invalid_authorization");
  return data.user;
}

export async function assertWhatsAppModuleAccess(
  supabaseAdmin: ReturnType<typeof buildSupabaseAdminClient>,
  userId: string,
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin.rpc("has_effective_module_access", {
    _user_id: userId,
    _organization_id: organizationId,
    _module_key: "whatsapp",
  });
  if (error) throw error;
  if (data !== true) throw new Error("whatsapp_access_denied");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
