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

type ForgeCertificate = ReturnType<typeof forge.pki.certificateFromPem>;

function certificateHash(certificate: ForgeCertificate, field: "issuer" | "subject") {
  const name = certificate[field] as { hash?: string; attributes?: Array<{ type?: string; value?: string }> };
  if (name.hash) return name.hash;
  return JSON.stringify((name.attributes || []).map((attribute) => [attribute.type || "", attribute.value || ""]));
}

function caIssuerUrl(certificate: ForgeCertificate) {
  const extension = certificate.getExtension("authorityInfoAccess") as { accessDescriptions?: Record<string, Array<{ value?: string }>> } | null;
  const descriptions = extension?.accessDescriptions || {};
  for (const entries of Object.values(descriptions)) {
    for (const entry of entries || []) {
      const value = String(entry.value || "");
      if (/^https?:\/\//i.test(value)) return value;
    }
  }
  return null;
}

async function downloadIssuer(certificate: ForgeCertificate) {
  const url = caIssuerUrl(certificate);
  if (!url) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 1_048_576) return null;
  try {
    const text = new TextDecoder().decode(bytes);
    if (text.includes("-----BEGIN CERTIFICATE-----")) return forge.pki.certificateFromPem(text);
    return forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(bytes)));
  } catch {
    return null;
  } finally {
    bytes.fill(0);
  }
}

async function orderedClientChain(certificates: ForgeCertificate[], leafIndex: number) {
  const leaf = certificates[leafIndex];
  const remaining = certificates.filter((_, index) => index !== leafIndex);
  const chain = [leaf];
  let current = leaf;

  for (let depth = 0; depth < 4; depth += 1) {
    const issuerHash = certificateHash(current, "issuer");
    if (issuerHash === certificateHash(current, "subject")) break;
    const issuerIndex = remaining.findIndex((candidate) => certificateHash(candidate, "subject") === issuerHash);
    const issuer = issuerIndex >= 0 ? remaining.splice(issuerIndex, 1)[0] : await downloadIssuer(current);
    if (!issuer) break;
    if (certificateHash(issuer, "subject") === certificateHash(issuer, "issuer")) break;
    chain.push(issuer);
    current = issuer;
  }

  for (const certificate of remaining) {
    const selfSigned = certificateHash(certificate, "subject") === certificateHash(certificate, "issuer");
    const duplicated = chain.some((item) => certificateHash(item, "subject") === certificateHash(certificate, "subject"));
    if (!selfSigned && !duplicated) chain.push(certificate);
  }
  return chain;
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
    const cert = (await orderedClientChain(certificates.map((bag: { cert: ForgeCertificate }) => bag.cert), leafIndex))
      .map((certificate) => forge.pki.certificateToPem(certificate))
      .join("");
    const privateKeyInfo = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey));
    return { cert, key: forge.pki.privateKeyInfoToPem(privateKeyInfo) };
  } finally {
    encryptedFile.fill(0); encryptedPassword.fill(0); pfxBytes.fill(0); passwordBytes.fill(0);
  }
}
