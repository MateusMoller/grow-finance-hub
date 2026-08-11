import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function textResponse(title: string, message: string, status: number) {
  return new Response(`${title}\n\n${message}`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (!["GET", "POST"].includes(request.method)) return textResponse("Método não permitido", "Utilize o link recebido no e-mail.", 405);

  const token = request.method === "POST"
    ? String((await request.formData()).get("token") || "").trim()
    : new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length < 32) return textResponse("Link inválido", "Este link de documento não é válido.", 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return textResponse("Serviço indisponível", "Tente novamente mais tarde.", 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenDigest = await sha256Hex(token);
  const { data: link, error: linkError } = await admin
    .from("obligation_document_delivery_links")
    .select("id, organization_id, client_id, instance_id, file_id, recipient_email, recipient_phone, access_channel, expires_at, revoked_at")
    .eq("token_digest", tokenDigest)
    .maybeSingle();

  if (linkError || !link) return textResponse("Link não encontrado", "Confira se o endereço foi copiado por completo.", 404);
  if (link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) {
    return textResponse("Link expirado", "Solicite um novo envio deste documento à equipe responsável.", 410);
  }

  const { data: file, error: fileError } = await admin
    .from("obligation_instance_files")
    .select("file_name, storage_bucket, storage_path")
    .eq("id", link.file_id)
    .eq("instance_id", link.instance_id)
    .eq("organization_id", link.organization_id)
    .maybeSingle();
  if (fileError || !file) return textResponse("Documento indisponível", "O documento não está mais disponível.", 404);

  const { data: signed, error: signedError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 120);
  if (signedError || !signed?.signedUrl) return textResponse("Falha ao abrir", "Não foi possível abrir o documento agora.", 500);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { error: accessError } = await admin.from("obligation_document_access_events").insert({
    organization_id: link.organization_id,
    client_id: link.client_id,
    instance_id: link.instance_id,
    file_id: link.file_id,
    user_id: null,
    recipient_email: link.recipient_email,
    access_type: "view",
    access_channel: link.access_channel,
    source_context: link.access_channel === "whatsapp_link" ? "obligation_delivery_whatsapp" : "obligation_delivery_email",
    user_agent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
    metadata: { delivery_link_id: link.id, recipient_phone: link.recipient_phone, ip: forwardedFor },
  });
  if (accessError) console.error("Failed to record obligation document access", accessError);

  return new Response(null, {
    status: 302,
    headers: { location: signed.signedUrl, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
});
