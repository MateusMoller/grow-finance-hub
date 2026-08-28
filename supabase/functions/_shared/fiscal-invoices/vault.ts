import forge from "npm:node-forge@1.3.1";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decrypt(ciphertext: Uint8Array, iv: string, key: CryptoKey) {
  const input = ciphertext.slice().buffer as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(iv) }, key, input));
}

async function importVaultKey() {
  const raw = decodeBase64(Deno.env.get("CLIENT_CERTIFICATE_VAULT_MASTER_KEY") || "");
  if (raw.byteLength !== 32) throw new Error("certificate_vault_not_configured");
  try { return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]); }
  finally { raw.fill(0); }
}

export async function loadClientTlsIdentity(admin: SupabaseClient, organizationId: string, clientId: string) {
  const result = await admin.from("client_a1_certificates").select("*").eq("organization_id", organizationId).eq("client_id", clientId).eq("status", "active").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("certificate_required");
  if (result.data.expires_at && new Date(result.data.expires_at) <= new Date()) throw new Error("certificate_expired");
  const object = await admin.storage.from(result.data.storage_bucket).download(result.data.storage_path);
  if (object.error) throw object.error;

  const encryptedFile = new Uint8Array(await object.data.arrayBuffer());
  const encryptedPassword = decodeBase64(result.data.password_ciphertext);
  const key = await importVaultKey();
  const [pfxBytes, passwordBytes] = await Promise.all([
    decrypt(encryptedFile, result.data.file_iv, key),
    decrypt(encryptedPassword, result.data.password_iv, key),
  ]);
  try {
    const password = new TextDecoder().decode(passwordBytes);
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(pfxBytes)), false, password);
    const certificates = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const encryptedKeys = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const plainKeys = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
    const privateKey = encryptedKeys[0]?.key || plainKeys[0]?.key;
    if (!privateKey) throw new Error("certificate_invalid");
    type ForgeCertificate = ReturnType<typeof forge.pki.certificateFromPem>;
    type ForgeRsaKey = { n?: { compareTo?: (other: unknown) => number }; e?: { compareTo?: (other: unknown) => number } };
    const rsaPrivateKey = privateKey as ForgeRsaKey;
    const leafIndex = certificates.findIndex((bag: { cert?: ForgeCertificate }) => {
      const publicKey = bag.cert?.publicKey as ForgeRsaKey | undefined;
      return Boolean(
        publicKey?.n?.compareTo && publicKey.e?.compareTo && rsaPrivateKey.n && rsaPrivateKey.e
        && publicKey.n.compareTo(rsaPrivateKey.n) === 0
        && publicKey.e.compareTo(rsaPrivateKey.e) === 0,
      );
    });
    if (leafIndex < 0) throw new Error("certificate_key_mismatch");
    const orderedCertificates = [certificates[leafIndex], ...certificates.filter((_, index: number) => index !== leafIndex)];
    const cert = orderedCertificates.map((bag: { cert: ForgeCertificate }) => forge.pki.certificateToPem(bag.cert)).join("");
    return { cert, key: forge.pki.privateKeyToPem(privateKey) };
  } finally {
    encryptedFile.fill(0); encryptedPassword.fill(0); pfxBytes.fill(0); passwordBytes.fill(0);
  }
}
