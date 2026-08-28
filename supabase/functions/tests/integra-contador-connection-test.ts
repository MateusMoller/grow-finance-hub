import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ConnectionInputError, MAX_CERTIFICATE_BYTES, sanitizeConnection, validateCertificate } from "../_shared/integra-contador/connection.ts";

Deno.test("accepts P12 and rejects unsupported or oversized certificates", () => {
  validateCertificate(new File([new Uint8Array([1])], "client.p12"));
  assertThrows(() => validateCertificate(new File([new Uint8Array([1])], "client.pem")), ConnectionInputError);
  assertThrows(() => validateCertificate(new File([new Uint8Array(MAX_CERTIFICATE_BYTES + 1)], "client.pfx")), ConnectionInputError);
});

Deno.test("sanitized connection never exposes secret sentinels", () => {
  const result = sanitizeConnection({ id: "1", status: "active", credential_secret_ref: "SECRET", certificate_secret_ref: "P12", access_token: "TOKEN" });
  assertEquals(result?.status, "active");
  assertEquals(JSON.stringify(result).includes("SECRET"), false);
  assertEquals(JSON.stringify(result).includes("TOKEN"), false);
});
