const textDecoder = new TextDecoder();

export type DistributedDocument = { nsu: number; schema: string | null; xml: string; accessKeyHint?: string | null };

function decodeBase64(value: string) {
  const compact = value.replace(/\s+/g, "");
  const binary = atob(compact);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function gunzip(bytes: Uint8Array) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return textDecoder.decode(bytes);
  const body = new Response(bytes.slice().buffer as ArrayBuffer).body;
  if (!body) throw new Error("gzip_stream_unavailable");
  const stream = body.pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export async function decodeXmlPayload(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) return trimmed;
  return gunzip(decodeBase64(trimmed));
}

function entityDecode(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export function xmlValue(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<(?:(?:\\w+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`, "i"));
    if (match) return entityDecode(match[1].trim());
  }
  return null;
}

export function xmlAttribute(xml: string, element: string, attribute: string) {
  const match = xml.match(new RegExp(`<(?:(?:\\w+):)?${element}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i"));
  return match ? entityDecode(match[1]) : null;
}

export function extractSoapValue(xml: string, name: string) {
  return xmlValue(xml, [name]);
}

export async function extractNfeDocZip(soapXml: string): Promise<DistributedDocument[]> {
  const documents: DistributedDocument[] = [];
  const regex = /<(?:\w+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?docZip>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(soapXml))) {
    const nsu = Number(match[1].match(/\bNSU=["'](\d+)["']/i)?.[1] || 0);
    const schema = match[1].match(/\bschema=["']([^"']+)["']/i)?.[1] || null;
    documents.push({ nsu, schema, xml: await gunzip(decodeBase64(match[2])) });
  }
  return documents;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function numberValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function dateValue(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
