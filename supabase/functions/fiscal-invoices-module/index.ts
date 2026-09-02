import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchNfeSefazBatch, fetchNfseAdnBatch, type DistributionBatch } from "../_shared/fiscal-invoices/connectors.ts";
import { loadClientTlsIdentity } from "../_shared/fiscal-invoices/vault.ts";
import { dateValue, numberValue, sha256, xmlAttribute, xmlValue, type DistributedDocument } from "../_shared/fiscal-invoices/xml.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (code: string, status: number) => json({ error: { code } }, status);
const BUCKET = "fiscal-invoice-xml";
type Source = "nfe_sefaz" | "nfse_adn";

function errorCode(cause: unknown, fallback = "operation_failed") {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === "object") {
    const value = cause as Record<string, unknown>;
    for (const key of ["code", "message", "details"]) {
      if (typeof value[key] === "string" && value[key]) return value[key] as string;
    }
  }
  return fallback;
}

function digits(value: unknown) { return String(value || "").replace(/\D/g, ""); }
function xmlBlock(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<(?:(?:\\w+):)?${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:(?:\\w+):)?${name}>`, "i"));
    if (match) return match[0];
  }
  return "";
}
function accessKey(xml: string, source: Source, hint: string | null | undefined) {
  const direct = digits(hint || xmlValue(xml, source === "nfe_sefaz" ? ["chNFe"] : ["chNFSe", "chaveAcesso"]));
  if (direct.length >= 20) return direct;
  const id = xmlAttribute(xml, source === "nfe_sefaz" ? "infNFe" : "infNFSe", "Id") || "";
  const fromId = digits(id);
  return fromId.length >= 20 ? fromId : null;
}

async function normalizeDocument(document: DistributedDocument, source: Source, clientCnpj: string) {
  const hash = await sha256(document.xml);
  const issuerBlock = xmlBlock(document.xml, source === "nfe_sefaz" ? ["emit"] : ["prest", "prestador"]);
  const recipientBlock = xmlBlock(document.xml, source === "nfe_sefaz" ? ["dest"] : ["toma", "tomador"]);
  const issuerTaxId = digits(xmlValue(issuerBlock, ["CNPJ", "CPF"]));
  const recipientTaxId = digits(xmlValue(recipientBlock, ["CNPJ", "CPF"]));
  const key = accessKey(document.xml, source, document.accessKeyHint) || hash;
  const direction = issuerTaxId === clientCnpj ? "issued" : recipientTaxId === clientCnpj ? "received" : "unknown";
  const issuedAt = dateValue(xmlValue(document.xml, ["dhEmi", "dEmi", "dhProc", "dhGer"]));
  const competence = xmlValue(document.xml, ["dCompet", "competencia"]);
  const isSummary = /<(?:\w+:)?resNFe\b/i.test(document.xml);
  const isCancelled = /cancel|101|135/i.test(`${document.schema || ""} ${xmlValue(document.xml, ["xEvento", "cStat"]) || ""}`);
  return {
    organization_id: "", client_id: "", source, nsu: document.nsu, access_key: key,
    document_model: source === "nfe_sefaz" ? (xmlValue(document.xml, ["mod"]) || "55") : "NFSE",
    document_number: xmlValue(document.xml, ["nNF", "nNFSe", "nDPS"]), series: xmlValue(document.xml, ["serie", "serieDPS"]),
    direction, status: isCancelled ? "cancelled" : isSummary ? "summary" : "authorized",
    issued_at: issuedAt, competence_date: competence && /^\d{4}-\d{2}-\d{2}/.test(competence) ? competence.slice(0, 10) : issuedAt?.slice(0, 10) || null,
    issuer_tax_id: issuerTaxId || null, issuer_name: xmlValue(issuerBlock, ["xNome", "xNomePrestador", "razSoc"]),
    recipient_tax_id: recipientTaxId || null, recipient_name: xmlValue(recipientBlock, ["xNome", "xNomeTomador", "razSoc"]),
    total_amount: numberValue(xmlValue(document.xml, ["vNF", "vLiq", "vServ"])), service_amount: numberValue(xmlValue(document.xml, ["vServ"])),
    tax_amount: numberValue(xmlValue(document.xml, ["vISSQN", "vISS", "vTotTrib"])), xml_bucket: BUCKET,
    xml_path: "", content_hash: hash, schema_name: document.schema, metadata_min: { nsu: document.nsu },
    xml: document.xml,
  };
}

async function persistBatch(admin: SupabaseClient, organizationId: string, clientId: string, clientCnpj: string, source: Source, documents: DistributedDocument[]) {
  const normalizedBatch = await Promise.all(documents.filter((document) => document.xml.trim().startsWith("<")).map((document) => normalizeDocument(document, source, clientCnpj)));
  const normalized = Array.from(normalizedBatch.reduce((byAccessKey, item) => {
    const current = byAccessKey.get(item.access_key);
    if (!current || Number(item.nsu || 0) >= Number(current.nsu || 0)) byAccessKey.set(item.access_key, item);
    return byAccessKey;
  }, new Map<string, Awaited<ReturnType<typeof normalizeDocument>>>() ).values());
  if (normalized.length === 0) return { received: documents.length, changed: 0 };
  const existingResult = await admin.from("fiscal_invoices").select("access_key,content_hash,xml_path").eq("organization_id", organizationId).eq("source", source).in("access_key", normalized.map((item) => item.access_key));
  if (existingResult.error) throw existingResult.error;
  const existing = new Map((existingResult.data || []).map((row: { access_key: string; content_hash: string; xml_path: string | null }) => [row.access_key, row]));
  const changed = normalized.filter((item) => existing.get(item.access_key)?.content_hash !== item.content_hash);
  await Promise.all(changed.map(async (item) => {
    item.organization_id = organizationId; item.client_id = clientId;
    item.xml_path = `${organizationId}/${clientId}/${source}/${item.access_key}-${item.content_hash.slice(0, 12)}.xml`;
    const upload = await admin.storage.from(BUCKET).upload(item.xml_path, item.xml, { contentType: "application/xml", upsert: false });
    if (upload.error && !String(upload.error.message).toLowerCase().includes("already exists")) throw upload.error;
  }));
  if (changed.length > 0) {
    const rows = changed.map(({ xml: _xml, ...row }) => ({ ...row, updated_at: new Date().toISOString() }));
    const upsert = await admin.from("fiscal_invoices").upsert(rows, { onConflict: "organization_id,source,access_key" });
    if (upsert.error) throw upsert.error;
  }
  return { received: documents.length, changed: changed.length };
}

async function authorize(admin: SupabaseClient, userDb: SupabaseClient, userId: string, organizationId: string, clientId?: string) {
  const [accessResult, grantResult, clientAccessResult] = await Promise.all([
    admin.from("organization_user_access").select("primary_role,status,requires_access_review").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    admin.from("user_module_grants").select("id").eq("organization_id", organizationId).eq("user_id", userId).eq("module_key", "notas_fiscais").maybeSingle(),
    clientId ? userDb.rpc("can_access_client", { _user_id: userId, _client_id: clientId }) : Promise.resolve({ data: true, error: null }),
  ]);
  const access = accessResult.data;
  if (accessResult.error || grantResult.error || clientAccessResult.error) throw accessResult.error || grantResult.error || clientAccessResult.error;
  if (!access || access.status !== "active" || access.requires_access_review || (access.primary_role !== "admin" && !grantResult.data) || clientAccessResult.data !== true) throw new Error("forbidden");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return fail("invalid_request", 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), authorization = request.headers.get("authorization");
  if (!url || !anon || !service) return fail("operation_failed", 500);
  if (!authorization?.toLowerCase().startsWith("bearer ")) return fail("unauthorized", 401);
  const userDb = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await userDb.auth.getUser();
  if (!auth.user) return fail("unauthorized", 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || ""), organizationId = String(body.organizationId || ""), clientId = body.clientId ? String(body.clientId) : undefined;
    if (!organizationId) return fail("invalid_request", 400);
    await authorize(admin, userDb, auth.user.id, organizationId, clientId);

    if (action === "overview") {
      const [clientsResult, statesResult, totalsResult, runsResult] = await Promise.all([
        admin.from("clients").select("id,name,cnpj,status").eq("organization_id", organizationId).order("name"),
        admin.from("fiscal_invoice_sync_states").select("*").eq("organization_id", organizationId),
        admin.from("fiscal_invoices").select("source,direction,status,total_amount").eq("organization_id", organizationId),
        admin.from("fiscal_invoice_sync_runs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (clientsResult.error || statesResult.error || totalsResult.error || runsResult.error) throw clientsResult.error || statesResult.error || totalsResult.error || runsResult.error;
      const totals = (totalsResult.data || []).reduce((acc: { count: number; amount: number; nfe_sefaz: number; nfse_adn: number }, row: { source: Source; total_amount: number | null }) => { acc.count += 1; acc.amount += Number(row.total_amount || 0); acc[row.source] += 1; return acc; }, { count: 0, amount: 0, nfe_sefaz: 0, nfse_adn: 0 });
      return json({ clients: clientsResult.data || [], states: statesResult.data || [], totals, runs: runsResult.data || [] });
    }

    if (action === "list") {
      const limit = Math.min(Math.max(Number(body.limit || 50), 1), 100), offset = Math.max(Number(body.offset || 0), 0);
      let query = admin.from("fiscal_invoices").select("id,client_id,source,nsu,access_key,document_model,document_number,series,direction,status,issued_at,competence_date,issuer_tax_id,issuer_name,recipient_tax_id,recipient_name,total_amount,service_amount,tax_amount,first_seen_at", { count: "exact" }).eq("organization_id", organizationId).order("issued_at", { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);
      if (clientId) query = query.eq("client_id", clientId); if (body.source) query = query.eq("source", body.source); if (body.direction) query = query.eq("direction", body.direction);
      if (body.search) query = query.or(`access_key.ilike.%${String(body.search).replace(/[%_,()]/g, "")}%,issuer_name.ilike.%${String(body.search).replace(/[%_,()]/g, "")}%,recipient_name.ilike.%${String(body.search).replace(/[%_,()]/g, "")}%`);
      const result = await query; if (result.error) throw result.error;
      return json({ invoices: result.data || [], count: result.count || 0 });
    }

    if (action === "sync") {
      if (!clientId || typeof body.source !== "string" || !["nfe_sefaz", "nfse_adn"].includes(body.source)) return fail("invalid_request", 400);
      const source = body.source as Source, environment = body.environment === "homologation" ? "homologation" : "production";
      const clientResult = await admin.from("clients").select("id,cnpj").eq("id", clientId).eq("organization_id", organizationId).single();
      if (clientResult.error) throw clientResult.error; const cnpj = digits(clientResult.data.cnpj); if (cnpj.length !== 14) throw new Error("client_cnpj_required");
      const stateResult = await admin.from("fiscal_invoice_sync_states").select("*").eq("organization_id", organizationId).eq("client_id", clientId).eq("source", source).eq("environment", environment).maybeSingle();
      if (stateResult.error) throw stateResult.error;
      const lastNsu = Number(stateResult.data?.last_nsu || 0), nextAllowedAt = stateResult.data?.next_allowed_at ? new Date(stateResult.data.next_allowed_at) : null;
      if (nextAllowedAt && nextAllowedAt > new Date()) throw new Error("sync_rate_limited");
      const runResult = await admin.from("fiscal_invoice_sync_runs").insert({ organization_id: organizationId, client_id: clientId, source, reason: lastNsu === 0 ? "initial_import" : "manual", status: "processing", initial_nsu: lastNsu, requested_by: auth.user.id, started_at: new Date().toISOString() }).select("id").single();
      if (runResult.error) throw runResult.error;
      await admin.from("fiscal_invoice_sync_states").upsert({ organization_id: organizationId, client_id: clientId, source, environment, last_nsu: lastNsu, status: "syncing", updated_at: new Date().toISOString() }, { onConflict: "organization_id,client_id,source,environment" });
      try {
        const identity = await loadClientTlsIdentity(admin, organizationId, clientId);
        let batch: DistributionBatch;
        try { batch = source === "nfe_sefaz" ? await fetchNfeSefazBatch({ identity, cnpj, lastNsu, environment }) : await fetchNfseAdnBatch({ identity, cnpj, lastNsu, environment }); }
        finally { identity.cert = ""; identity.key = ""; }
        const persisted = await persistBatch(admin, organizationId, clientId, cnpj, source, batch.documents);
        const now = new Date().toISOString(), nextAllowedAtValue = batch.upToDate ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
        const stateUpdate = await admin.from("fiscal_invoice_sync_states").upsert({ organization_id: organizationId, client_id: clientId, source, environment, last_nsu: batch.lastNsu, max_nsu: batch.maxNsu, status: batch.upToDate ? "up_to_date" : "idle", next_allowed_at: nextAllowedAtValue, last_synced_at: now, last_success_at: now, last_error_code: null, updated_at: now }, { onConflict: "organization_id,client_id,source,environment" });
        if (stateUpdate.error) throw stateUpdate.error;
        await admin.from("fiscal_invoice_sync_runs").update({ status: "completed", final_nsu: batch.lastNsu, documents_received: persisted.received, documents_changed: persisted.changed, finished_at: now }).eq("id", runResult.data.id);
        return json({ ok: true, source, ...persisted, lastNsu: batch.lastNsu, maxNsu: batch.maxNsu, upToDate: batch.upToDate });
      } catch (cause) {
        const code = errorCode(cause, "sync_failed"), now = new Date().toISOString();
        const requiresAction = ["certificate_required", "certificate_expired", "certificate_invalid", "certificate_key_mismatch", "client_cnpj_required", "certificate_vault_not_configured"].includes(code);
        const nextAllowedAtValue = code === "nfe_rate_limited" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
        await Promise.all([
          admin.from("fiscal_invoice_sync_states").upsert({ organization_id: organizationId, client_id: clientId, source, environment, last_nsu: lastNsu, status: requiresAction ? "requires_action" : "failed", next_allowed_at: nextAllowedAtValue, last_synced_at: now, last_error_code: code.slice(0, 120), updated_at: now }, { onConflict: "organization_id,client_id,source,environment" }),
          admin.from("fiscal_invoice_sync_runs").update({ status: requiresAction ? "requires_action" : "failed", error_code: code.slice(0, 120), error_summary: "A sincronização não foi concluída.", finished_at: now }).eq("id", runResult.data.id),
        ]);
        throw cause;
      }
    }
    return fail("invalid_request", 400);
  } catch (cause) {
    const code = errorCode(cause);
    if (!/^(certificate_|client_cnpj_required|sync_rate_limited|nfe_|nfse_|forbidden)/.test(code)) console.error("fiscal-invoices-module failed", cause);
    const status = code === "forbidden" ? 403 : code === "sync_rate_limited" || code === "nfe_rate_limited" ? 429 : code.startsWith("certificate_") || code === "client_cnpj_required" ? 409 : 500;
    return fail(code, status);
  }
});
