import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getInstallmentAgreement,
  getInstallmentPayment,
  INSTALLMENT_MODALITIES,
  INSTALLMENT_SERVICE_REGISTRY,
  issueInstallmentDas,
  listInstallmentAgreements,
  listPrintableInstallments,
  type InstallmentModality,
  type InstallmentProviderConfig,
} from "../_shared/integra-contador/domains/installments/client.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
type DbClient = SupabaseClient;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, status = 400) => json({ error: { code } }, status);
const digits = (value: unknown) => String(value || "").replace(/\D/g, "");
const text = (value: unknown) => value == null ? null : String(value);
const number = (value: unknown) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const date = (value: unknown) => {
  const original = String(value || "").trim();
  if (/^20\d{2}-\d{2}-\d{2}$/.test(original)) return original;
  const raw = digits(original);
  if (!/^\d{8}$/.test(raw)) return null;
  if (raw.startsWith("20")) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return `${raw.slice(4, 8)}-${raw.slice(2, 4)}-${raw.slice(0, 2)}`;
};
const tag = () => crypto.randomUUID().replace(/-/g, "").slice(0, 32);

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array) {
  const input = Uint8Array.from(bytes).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function extractDueDateBestEffort(bytes: Uint8Array) {
  try {
    const pdfJs = await import("npm:pdfjs-dist@5.6.205/legacy/build/pdf.mjs");
    const loadingTask = pdfJs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false });
    const document = await loadingTask.promise;
    const pages: string[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
      }
    } finally { await document.destroy(); }
    const match = pages.join(" ").match(/(?:vencimento|data\s+de\s+vencimento)[^0-9]{0,50}(\d{2})[/.](\d{2})[/.](20\d{2})/i);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
  } catch { return null; }
}

function providerConfig(connection: Record<string, unknown>): InstallmentProviderConfig {
  const provider = Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "trial";
  const trial = provider === "trial";
  const bearerToken = trial
    ? "06aef429-a981-3ec5-a1f8-71d38d86481e"
    : Deno.env.get("INTEGRA_CONTADOR_BEARER_TOKEN") || "";
  if (!bearerToken) throw new Error("SERPRO_CREDENTIALS_MISSING");
  return {
    baseUrl: trial
      ? "https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1"
      : Deno.env.get("INTEGRA_CONTADOR_BASE_URL") || "https://gateway.apiserpro.serpro.gov.br/integra-contador/v1",
    bearerToken,
    jwtToken: trial ? undefined : Deno.env.get("INTEGRA_CONTADOR_JWT_TOKEN") || undefined,
    contractorTaxId: String(connection.contractor_tax_id || ""),
  };
}

async function recordUsage(admin: DbClient, input: { organizationId: string; clientId: string; correlationId: string; requestTag: string; action: string; success: boolean; started: number; error?: string }) {
  await admin.from("serpro_api_usage").insert({
    organization_id: input.organizationId, client_id: input.clientId, correlation_id: input.correlationId,
    request_tag: input.requestTag, capability_key: "installments", action: input.action,
    source: "integra_contador_installments", http_status: input.success ? 200 : null,
    duration_ms: Date.now() - input.started, cache_hit: false, success: input.success,
    billable: input.success, error_type: input.error || null,
    started_at: new Date(input.started).toISOString(), finished_at: new Date().toISOString(),
  });
}

async function assertEnabled(db: DbClient, admin: DbClient, organizationId: string) {
  const authorization = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
  if (authorization.error) throw new Error("FORBIDDEN");
  const [settings, connection] = await Promise.all([
    admin.from("organization_settings").select("feature_flags").eq("organization_id", organizationId).single(),
    admin.from("integra_contador_connections").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const flags = (settings.data?.feature_flags || {}) as Record<string, unknown>;
  if (flags.integra_parcelamentos !== true) throw new Error("INSTALLMENTS_FEATURE_DISABLED");
  if (!connection.data) throw new Error("INTEGRA_CONTADOR_CONNECTION_MISSING");
  return connection.data as Record<string, unknown>;
}

async function assertProcuration(admin: DbClient, organizationId: string, clientId: string, connection: Record<string, unknown>, modality: InstallmentModality, taxpayer: string) {
  const contractor = digits(connection.contractor_tax_id);
  if (contractor === taxpayer) return;
  const requiredCodes = INSTALLMENT_SERVICE_REGISTRY[modality].procurationCodes;
  const result = await admin.from("fiscal_procurations").select("capability_key,status,valid_until,metadata_min")
    .eq("organization_id", organizationId).eq("client_id", clientId).eq("connection_id", String(connection.id));
  if (result.error) throw result.error;
  // An absent local snapshot is not evidence that the e-CAC procuration is absent.
  // In that case SERPRO remains the source of truth and validates the request itself.
  if (!result.data?.length) return;
  const now = Date.now();
  const valid = (result.data || []).some((row) => {
    if (row.status !== "valid") return false;
    if (row.valid_until && new Date(row.valid_until).getTime() < now) return false;
    const metadata = row.metadata_min as Record<string, unknown> | null;
    const codes = [row.capability_key, metadata?.procuration_code, ...(Array.isArray(metadata?.procuration_codes) ? metadata.procuration_codes : [])].map(String);
    return codes.includes("installments") || codes.includes(modality) || requiredCodes.some((code) => codes.includes(code));
  });
  if (!valid) throw new Error(`INSTALLMENT_PROCURATION_REQUIRED:${modality}:${requiredCodes.join("|")}`);
}

async function syncClient(admin: DbClient, organizationId: string, clientId: string, connection: Record<string, unknown>) {
  const clientResult = await admin.from("clients").select("id,name,cnpj,regime,status").eq("id", clientId).eq("organization_id", organizationId).single();
  if (clientResult.error) throw clientResult.error;
  const taxpayer = digits(clientResult.data.cnpj);
  if (taxpayer.length !== 14) throw new Error("CLIENT_CNPJ_INVALID");
  const config = providerConfig(connection);
  const correlationId = crypto.randomUUID();
  const results: Array<{ modality: InstallmentModality; agreements?: number; error?: string }> = [];
  for (const modality of INSTALLMENT_MODALITIES) {
    const requestTag = tag(); const started = Date.now();
    try {
      await assertProcuration(admin, organizationId, clientId, connection, modality, taxpayer);
      const summaries = await listInstallmentAgreements(config, modality, taxpayer, requestTag);
      const printable = summaries.length ? await listPrintableInstallments(config, modality, taxpayer, tag()) : [];
      const printableMap = new Map(printable.map((item) => [digits(item.parcela), number(item.valor)]));
      for (const summary of summaries) {
        const agreementNumber = text(summary.numero);
        if (!agreementNumber) continue;
        const detail = await getInstallmentAgreement(config, modality, taxpayer, agreementNumber, tag());
        const consolidation = (detail.consolidacaoOriginal || {}) as Record<string, unknown>;
        const changes = Array.isArray(detail.alteracoesDivida) ? detail.alteracoesDivida as Array<Record<string, unknown>> : [];
        const latestChange = changes.at(-1) || {};
        const agreement = await admin.from("fiscal_installment_agreements").upsert({
          organization_id: organizationId, client_id: clientId, modality, agreement_number: agreementNumber,
          requested_at: date(detail.dataDoPedido || summary.dataDoPedido), status: text(detail.situacao || summary.situacao) || "unknown",
          status_date: date(detail.dataDaSituacao || summary.dataDaSituacao), total_consolidated: number(latestChange.valorTotalConsolidado ?? consolidation.valorTotalConsolidado),
          installment_count: number(consolidation.quantidadeParcelas), basic_installment_amount: number(latestChange.parcelaBasica ?? consolidation.parcelaBasica),
          remaining_installments: number(latestChange.parcelasRemanescentes), debt_details: consolidation.detalhesConsolidacao || [], debt_changes: changes,
          last_synced_at: new Date().toISOString(), last_error_code: null, updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,client_id,modality,agreement_number" }).select("id").single();
        if (agreement.error) throw agreement.error;
        const payments = Array.isArray(detail.demonstrativoPagamentos) ? detail.demonstrativoPagamentos as Array<Record<string, unknown>> : [];
        const periods = new Set([...printableMap.keys(), ...payments.map((item) => digits(item.mesDaParcela))].filter((period) => /^20\d{4}$/.test(period)));
        for (const periodKey of periods) {
          const payment = payments.find((item) => digits(item.mesDaParcela) === periodKey);
          await admin.from("fiscal_installment_entries").upsert({
            organization_id: organizationId, client_id: clientId, agreement_id: agreement.data.id, period_key: periodKey,
            amount: printableMap.get(periodKey) ?? number(payment?.valorPago), due_date: date(payment?.vencimentoDoDas),
            status: payment?.dataDeArrecadacao ? "paid" : printableMap.has(periodKey) ? "available" : "unknown",
            available_for_issue: printableMap.has(periodKey), paid_at: date(payment?.dataDeArrecadacao), last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }, { onConflict: "agreement_id,period_key" });
        }
      }
      await recordUsage(admin, { organizationId, clientId, correlationId, requestTag, action: `sync:${modality}`, success: true, started });
      results.push({ modality, agreements: summaries.length });
    } catch (error) {
      const code = error instanceof Error ? error.message : "SYNC_FAILED";
      await recordUsage(admin, { organizationId, clientId, correlationId, requestTag, action: `sync:${modality}`, success: false, started, error: code });
      results.push({ modality, error: `${modality}:${code}` });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return results;
}

async function runTrackedSync(admin: DbClient, organizationId: string, clientId: string, connection: Record<string, unknown>, reason: "user_request" | "scheduled_reconciliation", requestedBy?: string) {
  const correlationId = crypto.randomUUID();
  const run = await admin.from("fiscal_sync_runs").insert({ organization_id: organizationId, client_id: clientId, connection_id: connection.id, capability_key: "installments", reason, status: "processing", requested_by: requestedBy || null, source: "integra_contador_installments", correlation_id: correlationId, request_fingerprint: `installments:${clientId}:${new Date().toISOString().slice(0, 10)}`, attempt_count: 1, started_at: new Date().toISOString() }).select("id").single();
  if (run.error) throw run.error;
  try {
    const results = await syncClient(admin, organizationId, clientId, connection);
    const errors = results.filter((result) => "error" in result && result.error);
    await admin.from("fiscal_sync_runs").update({ status: errors.length ? "requires_action" : "completed", records_received: results.reduce((sum, result) => sum + ("agreements" in result ? Number(result.agreements || 0) : 0), 0), error_code: errors.length ? "INSTALLMENT_MODALITIES_PENDING" : null, error_summary: errors.length ? errors.map((result) => "error" in result ? result.error : "").join("; ").slice(0, 500) : null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.data.id);
    return results;
  } catch (error) {
    const code = error instanceof Error ? error.message : "INSTALLMENT_SYNC_FAILED";
    await admin.from("fiscal_sync_runs").update({ status: "requires_action", error_code: code.slice(0, 120), error_summary: code.slice(0, 500), finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.data.id);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return fail("invalid_request", 405);
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !anon || !service || !authorization) return fail("unauthorized", 401);
  const db = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || ""); const organizationId = String(body.organizationId || "");
  const internal = action === "scheduled_sync" && Boolean(Deno.env.get("INTEGRA_CONTADOR_INTERNAL_WORKER_SECRET")) && request.headers.get("x-worker-token") === Deno.env.get("INTEGRA_CONTADOR_INTERNAL_WORKER_SECRET");
  const auth = internal ? null : await db.auth.getUser();
  if (!internal && !auth?.data.user) return fail("unauthorized", 401);
  if (!organizationId && !internal) return fail("invalid_request");
  try {
    if (internal) {
      const discovery = body.mode === "discovery";
      const settings = await admin.from("organization_settings").select("organization_id,feature_flags");
      if (settings.error) throw settings.error;
      let processed = 0;
      for (const setting of settings.data || []) {
        const flags = (setting.feature_flags || {}) as Record<string, unknown>;
        if (flags.integra_parcelamentos !== true || processed >= 10) continue;
        const connection = await admin.from("integra_contador_connections").select("*").eq("organization_id", setting.organization_id).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (!connection.data) continue;
        const active = await admin.from("fiscal_installment_agreements").select("client_id,last_synced_at").eq("organization_id", setting.organization_id).not("status", "ilike", "%encerr%").order("last_synced_at", { ascending: true }).limit(10);
        let clientIds = [...new Set((active.data || []).map((row) => row.client_id))];
        if (discovery) {
          const clients = await admin.from("clients").select("id,cnpj,regime").eq("organization_id", setting.organization_id).neq("status", "inativo").order("updated_at", { ascending: true }).limit(50);
          clientIds = (clients.data || []).filter((client) => digits(client.cnpj).length === 14 && /simples|mei/i.test(String(client.regime || ""))).map((client) => client.id).slice(0, 10);
        }
        for (const clientId of clientIds.slice(0, 10 - processed)) { try { await runTrackedSync(admin, setting.organization_id, clientId, connection.data, "scheduled_reconciliation"); } catch { /* One invalid client must not stop the batch. */ } processed += 1; }
      }
      return json({ processed, mode: discovery ? "discovery" : "active" });
    }
    const connection = await assertEnabled(db, admin, organizationId);
    if (action === "list_installments") {
      let query = admin.from("fiscal_installment_agreements").select("*,clients(name,cnpj),fiscal_installment_entries(*)").eq("organization_id", organizationId).order("updated_at", { ascending: false });
      if (body.clientId) query = query.eq("client_id", String(body.clientId));
      if (body.modality) query = query.eq("modality", String(body.modality));
      if (body.status) query = query.eq("status", String(body.status));
      const result = await query.limit(Math.min(Number(body.limit || 200), 500)); if (result.error) throw result.error;
      return json({ agreements: result.data });
    }
    if (action === "list_installment_clients") {
      const result = await admin.from("clients").select("id,name,cnpj,regime,status").eq("organization_id", organizationId).neq("status", "inativo").order("name");
      if (result.error) throw result.error;
      return json({ clients: (result.data || []).filter((client) => digits(client.cnpj).length === 14 && /simples|mei/i.test(String(client.regime || ""))) });
    }
    if (action === "get_installment_detail") {
      const agreementId = String(body.agreementId || "");
      const agreement = await admin.from("fiscal_installment_agreements").select("*,clients(name,cnpj),fiscal_installment_entries(*,fiscal_installment_payments(*),fiscal_documents(*))").eq("organization_id", organizationId).eq("id", agreementId).single();
      if (agreement.error) throw agreement.error; return json({ agreement: agreement.data });
    }
    if (action === "sync_installments_client") {
      const clientId = String(body.clientId || ""); if (!clientId) return fail("invalid_request");
      return json({ results: await runTrackedSync(admin, organizationId, clientId, connection, "user_request", auth?.data.user?.id) });
    }
    if (action === "list_printable_installments") {
      const result = await admin.from("fiscal_installment_entries").select("*,fiscal_installment_agreements!inner(*)").eq("organization_id", organizationId).eq("available_for_issue", true).order("period_key");
      if (result.error) throw result.error; return json({ installments: result.data });
    }
    if (action === "sync_installment_payment") {
      const entry = await admin.from("fiscal_installment_entries").select("*,fiscal_installment_agreements!inner(*)").eq("organization_id", organizationId).eq("id", String(body.entryId || "")).single();
      if (entry.error) throw entry.error;
      const agreement = entry.data.fiscal_installment_agreements as Record<string, unknown>;
      const client = await admin.from("clients").select("cnpj").eq("organization_id", organizationId).eq("id", entry.data.client_id).single(); if (client.error) throw client.error;
      await assertProcuration(admin, organizationId, entry.data.client_id, connection, agreement.modality as InstallmentModality, digits(client.data.cnpj));
      const payment = await getInstallmentPayment(providerConfig(connection), agreement.modality as InstallmentModality, digits(client.data.cnpj), String(agreement.agreement_number), entry.data.period_key, tag());
      const paymentDate = date(payment.dataPagamento); const paid = Boolean(paymentDate);
      if (paid) {
        const evidenceHash = await sha256(new TextEncoder().encode(JSON.stringify(payment)));
        const saved = await admin.from("fiscal_installment_payments").upsert({
          organization_id: organizationId, client_id: entry.data.client_id, agreement_id: agreement.id, entry_id: entry.data.id,
          period_key: entry.data.period_key, das_number: text(payment.numeroDas), installment_number: text(payment.numeroParcela),
          due_date: date(payment.dataVencimento), acceptance_deadline: date(payment.dataLimiteAcolhimento), paid_at: paymentDate,
          bank_agency: text(payment.bancoAgencia), amount_paid: number(payment.valorPagoArrecadacao) || 0,
          tax_breakdown: payment.pagamentoDebitos || [], evidence_hash: evidenceHash, updated_at: new Date().toISOString(),
        }, { onConflict: "agreement_id,period_key,evidence_hash" });
        if (saved.error) throw saved.error;
      }
      await admin.from("fiscal_installment_entries").update({ status: paid ? "paid" : entry.data.status, paid_at: paymentDate, last_synced_at: new Date().toISOString() }).eq("id", entry.data.id);
      return json({ payment, paid });
    }
    if (action === "issue_installment_das") {
      if (body.confirmation !== "EMITIR DAS PARCELAMENTO") return fail("explicit_confirmation_required", 409);
      const entry = await admin.from("fiscal_installment_entries").select("*,fiscal_installment_agreements!inner(*)").eq("organization_id", organizationId).eq("id", String(body.entryId || "")).single();
      if (entry.error) throw entry.error; if (!entry.data.available_for_issue) return fail("installment_not_available", 409);
      const agreement = entry.data.fiscal_installment_agreements as Record<string, unknown>;
      const client = await admin.from("clients").select("name,cnpj").eq("organization_id", organizationId).eq("id", entry.data.client_id).single(); if (client.error) throw client.error;
      await assertProcuration(admin, organizationId, entry.data.client_id, connection, agreement.modality as InstallmentModality, digits(client.data.cnpj));
      const idempotencyKey = `installment:${entry.data.client_id}:${agreement.modality}:${agreement.agreement_number}:${entry.data.period_key}`;
      const existing = await admin.from("fiscal_operations").select("id,status,external_reference").eq("organization_id", organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing.data?.status === "completed" && entry.data.fiscal_document_id) return json({ entryId: entry.data.id, documentId: entry.data.fiscal_document_id, duplicate: true });
      if (existing.data?.status === "processing" || existing.data?.status === "requires_action") return fail("installment_issuance_reconciliation_required", 409);
      const operation = await admin.from("fiscal_operations").upsert({ organization_id: organizationId, client_id: entry.data.client_id, capability_key: "installments", operation: "issue_das", period_key: entry.data.period_key, idempotency_key: idempotencyKey, request_hash: idempotencyKey, status: "processing", correlation_id: crypto.randomUUID(), updated_at: new Date().toISOString() }, { onConflict: "organization_id,idempotency_key" }).select("id").single(); if (operation.error) throw operation.error;
      try {
        const result = await issueInstallmentDas(providerConfig(connection), agreement.modality as InstallmentModality, digits(client.data.cnpj), entry.data.period_key, tag());
        const bytes = decodeBase64(result.pdfBase64); const digest = await sha256(bytes); const dueDate = await extractDueDateBestEffort(bytes);
        const path = `${organizationId}/${entry.data.client_id}/installments/${agreement.modality}/${agreement.agreement_number}/${entry.data.period_key}-${digest.slice(0, 16)}.pdf`;
        const upload = await admin.storage.from("fiscal-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false }); if (upload.error && !upload.error.message.includes("already exists")) throw upload.error;
        const priorDocument = await admin.from("fiscal_documents").select("id").eq("organization_id", organizationId).eq("client_id", entry.data.client_id).eq("content_hash", digest).maybeSingle();
        const document = priorDocument.data
          ? { data: priorDocument.data, error: null }
          : await admin.from("fiscal_documents").insert({ organization_id: organizationId, client_id: entry.data.client_id, document_type: "installment_das", period_key: entry.data.period_key, source: "integra_contador", external_reference: idempotencyKey, storage_bucket: "fiscal-documents", storage_path: path, content_hash: digest, metadata_min: { modality: agreement.modality, agreement_number: agreement.agreement_number } }).select("id").single();
        if (document.error || !document.data) throw document.error || new Error("INSTALLMENT_DOCUMENT_SAVE_FAILED");
        const priorInbox = await admin.from("document_inbox_items").select("id").eq("organization_id", organizationId).eq("client_id", entry.data.client_id).eq("file_hash", digest).maybeSingle();
        if (!priorInbox.data) {
          const inbox = await admin.from("document_inbox_items").insert({
            organization_id: organizationId, client_id: entry.data.client_id, detected_client_id: entry.data.client_id,
            file_name: `DAS_${agreement.modality}_${agreement.agreement_number}_${entry.data.period_key}.pdf`, storage_bucket: "fiscal-documents", storage_path: path,
            source_kind: "api", file_hash: digest, content_type: "application/pdf", file_size: bytes.byteLength,
            suggested_competence_label: entry.data.period_key, competence_detected: entry.data.period_key,
            identification_confidence: 1, matched_by: "manual_instance", match_score: 1,
            match_reasons: ["Emitido pelo Integra Contador", `Parcelamento ${agreement.agreement_number}`], review_required: false,
            status: "linked", text_extraction_status: "completed", ocr_status: "not_needed", processing_status: "processed",
            processing_completed_at: new Date().toISOString(), classification_status: "classified", application_status: "applied",
            publication_status: "pending", execution_status: "applied", communication_status: "pending", processed_automatically: true,
            document_type_key: "installment_das", fingerprint_payload: { fiscal_document_id: document.data.id, modality: agreement.modality, agreement_number: agreement.agreement_number },
          });
          if (inbox.error) throw inbox.error;
        }
        const task = await admin.rpc("create_fiscal_task_canonical", { _organization_id: organizationId, _client_id: entry.data.client_id, _title: `Parcela ${entry.data.period_key.slice(4)}/${entry.data.period_key.slice(0,4)} - ${agreement.modality}`, _description: `DAS do parcelamento ${agreement.agreement_number} emitido e aguardando envio/pagamento.`, _sector: "fiscal", _priority: "Alta", _due_date: dueDate, _integration_key: idempotencyKey, _context: { installment_entry_id: entry.data.id, agreement_id: agreement.id, modality: agreement.modality, period_key: entry.data.period_key } });
        if (task.error) throw task.error;
        await admin.from("fiscal_installment_entries").update({ status: "issued", available_for_issue: false, issued_at: new Date().toISOString(), due_date: dueDate, task_id: task.data, fiscal_document_id: document.data.id, updated_at: new Date().toISOString() }).eq("id", entry.data.id);
        await admin.from("fiscal_operations").update({ status: "completed", external_reference: document.data.id, updated_at: new Date().toISOString() }).eq("id", operation.data.id);
        return json({ entryId: entry.data.id, documentId: document.data.id, taskId: task.data, dueDate, duplicate: false });
      } catch (error) {
        const code = error instanceof Error ? error.message : "INSTALLMENT_ISSUE_FAILED";
        const ambiguous = /timeout|network|fetch|SERPRO_HTTP_5/i.test(code);
        await admin.from("fiscal_operations").update({ status: ambiguous ? "requires_action" : "failed", updated_at: new Date().toISOString() }).eq("id", operation.data.id);
        throw error;
      }
    }
    if (action === "get_installment_document_url") {
      const document = await admin.from("fiscal_documents").select("storage_bucket,storage_path").eq("organization_id", organizationId).eq("id", String(body.documentId || "")).single(); if (document.error) throw document.error;
      const signed = await admin.storage.from(document.data.storage_bucket).createSignedUrl(document.data.storage_path, 300); if (signed.error) throw signed.error;
      return json({ signedUrl: signed.data.signedUrl });
    }
    return fail("invalid_action", 404);
  } catch (error) {
    const code = error instanceof Error ? error.message : "operation_failed";
    console.error("[integra-contador-installments]", { action, code });
    return fail(code, code === "FORBIDDEN" ? 403 : 500);
  }
});
