import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const error = (code: string, status: number) => json({ error: { code } }, status);
const MAX_CERTIFICATE_BYTES = 1024 * 1024;
const BUCKET = "client-certificate-vault";

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importVaultKey() {
  const encoded = Deno.env.get("CLIENT_CERTIFICATE_VAULT_MASTER_KEY") || "";
  const raw = decodeBase64(encoded);
  if (raw.byteLength !== 32) throw new Error("vault_key_invalid");
  try {
    return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  } finally {
    raw.fill(0);
  }
}

async function encrypt(value: Uint8Array, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, value.slice().buffer as ArrayBuffer);
  return { ciphertext: new Uint8Array(encrypted), iv };
}

function validateCertificateFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pfx" && extension !== "p12") throw new Error("invalid_certificate_file");
  if (file.size < 32 || file.size > MAX_CERTIFICATE_BYTES) throw new Error("invalid_certificate_size");
}

function inspectPkcs12(bytes: Uint8Array, password: string) {
  try {
    const der = forge.util.createBuffer(bytes);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    const certificates = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const privateKeys = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const plainKeys = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
    const certificate = certificates[0]?.cert;
    if (!certificate || privateKeys.length + plainKeys.length === 0) throw new Error("invalid_certificate_contents");
    const now = new Date();
    if (certificate.validity.notAfter <= now) throw new Error("certificate_expired");
    return {
      serialNumber: String(certificate.serialNumber || "").slice(0, 128) || null,
      validFrom: certificate.validity.notBefore.toISOString(),
      expiresAt: certificate.validity.notAfter.toISOString(),
    };
  } catch (cause) {
    if (cause instanceof Error && ["invalid_certificate_contents", "certificate_expired"].includes(cause.message)) throw cause;
    throw new Error("certificate_password_or_file_invalid");
  }
}

function publicStatus(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    fingerprintSuffix: String(row.certificate_fingerprint_sha256 || "").slice(-8).toUpperCase(),
    validFrom: row.valid_from,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return error("invalid_request", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !anonKey || !serviceKey) return error("operation_failed", 500);
  if (!authorization?.toLowerCase().startsWith("bearer ")) return error("unauthorized", 401);

  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: authData } = await userDb.auth.getUser();
  if (!authData.user) return error("unauthorized", 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const form = await request.formData();
    const action = String(form.get("action") || "");
    const organizationId = String(form.get("organizationId") || "");
    const clientId = String(form.get("clientId") || "");
    if (!organizationId || !clientId || !["status", "upload", "remove"].includes(action)) return error("invalid_request", 400);

    const [accessResult, clientResult] = await Promise.all([
      admin.from("organization_user_access").select("primary_role,status").eq("organization_id", organizationId).eq("user_id", authData.user.id).maybeSingle(),
      admin.from("clients").select("id").eq("id", clientId).eq("organization_id", organizationId).maybeSingle(),
    ]);
    if (accessResult.error || clientResult.error) throw accessResult.error || clientResult.error;
    if (!clientResult.data) return error("client_not_found", 404);
    if (accessResult.data?.status !== "active" || accessResult.data?.primary_role !== "admin") return error("forbidden", 403);

    const existingResult = await admin.from("client_a1_certificates").select("*").eq("organization_id", organizationId).eq("client_id", clientId).maybeSingle();
    if (existingResult.error) throw existingResult.error;
    const existing = existingResult.data as Record<string, unknown> | null;

    if (action === "status") {
      const auditResult = await admin.from("client_a1_certificate_audit").insert({ organization_id: organizationId, client_id: clientId, certificate_id: existing?.id || null, actor_user_id: authData.user.id, action: "status_viewed" });
      if (auditResult.error) throw auditResult.error;
      return json({ certificate: publicStatus(existing) });
    }

    if (action === "remove") {
      if (!existing) return json({ certificate: null });
      const deleteResult = await admin.from("client_a1_certificates").delete().eq("id", existing.id);
      if (deleteResult.error) throw deleteResult.error;
      const auditResult = await admin.from("client_a1_certificate_audit").insert({ organization_id: organizationId, client_id: clientId, certificate_id: null, actor_user_id: authData.user.id, action: "removed" });
      if (auditResult.error) throw auditResult.error;
      const storageResult = await admin.storage.from(BUCKET).remove([String(existing.storage_path)]);
      if (storageResult.error) console.error("certificate ciphertext cleanup failed", { certificateId: existing.id });
      return json({ certificate: null });
    }

    const certificate = form.get("certificate");
    const password = String(form.get("password") || "");
    if (!(certificate instanceof File) || password.length < 1 || password.length > 256) return error("invalid_request", 400);
    validateCertificateFile(certificate);
    const fileBytes = new Uint8Array(await certificate.arrayBuffer());
    const passwordBytes = new TextEncoder().encode(password);
    try {
      const metadata = inspectPkcs12(fileBytes, password);
      const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", fileBytes))]
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      const key = await importVaultKey();
      const [encryptedFile, encryptedPassword] = await Promise.all([encrypt(fileBytes, key), encrypt(passwordBytes, key)]);
      const certificateId = existing?.id || crypto.randomUUID();
      const storagePath = `${organizationId}/${clientId}/${crypto.randomUUID()}.bin`;
      const uploadResult = await admin.storage.from(BUCKET).upload(storagePath, encryptedFile.ciphertext, { contentType: "application/octet-stream", upsert: false });
      if (uploadResult.error) throw uploadResult.error;

      const upsertResult = await admin.from("client_a1_certificates").upsert({
        id: certificateId, organization_id: organizationId, client_id: clientId, storage_bucket: BUCKET, storage_path: storagePath,
        password_ciphertext: encodeBase64(encryptedPassword.ciphertext), password_iv: encodeBase64(encryptedPassword.iv), file_iv: encodeBase64(encryptedFile.iv),
        certificate_fingerprint_sha256: fingerprint, certificate_serial_number: metadata.serialNumber,
        valid_from: metadata.validFrom, expires_at: metadata.expiresAt, status: "active", created_by: authData.user.id,
        replaced_by: existing ? authData.user.id : null, updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,client_id" }).select("*").single();
      if (upsertResult.error) { await admin.storage.from(BUCKET).remove([storagePath]); throw upsertResult.error; }
      const auditResult = await admin.from("client_a1_certificate_audit").insert({ organization_id: organizationId, client_id: clientId, certificate_id: certificateId, actor_user_id: authData.user.id, action: existing ? "replaced" : "uploaded" });
      if (auditResult.error) throw auditResult.error;
      if (existing?.storage_path && existing.storage_path !== storagePath) {
        const cleanupResult = await admin.storage.from(BUCKET).remove([String(existing.storage_path)]);
        if (cleanupResult.error) console.error("replaced certificate ciphertext cleanup failed", { certificateId });
      }
      return json({ certificate: publicStatus(upsertResult.data) });
    } finally {
      fileBytes.fill(0);
      passwordBytes.fill(0);
    }
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "operation_failed";
    const known = new Set(["invalid_certificate_file", "invalid_certificate_size", "invalid_certificate_contents", "certificate_expired", "certificate_password_or_file_invalid", "vault_key_invalid"]);
    if (!known.has(code)) console.error("client-certificate-vault operation failed", cause);
    return error(known.has(code) ? code : "operation_failed", known.has(code) && code !== "vault_key_invalid" ? 400 : 500);
  }
});
