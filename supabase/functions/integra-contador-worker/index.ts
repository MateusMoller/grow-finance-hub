import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFakeIntegraContadorProvider } from "../_shared/integra-contador/testing/fake-provider.ts";
import { createSerproTrialProvider } from "../_shared/integra-contador/testing/trial-provider.ts";
import { fetchCaixaPostalIndicator } from "../_shared/integra-contador/domains/caixa-postal/indicator.ts";
import { normalizeTaxIdentifier } from "../_shared/integra-contador/core/identifiers.ts";
import { retryDecision } from "../_shared/integra-contador/core/retry.ts";
import { createFiscalTask } from "../_shared/integra-contador/outputs/tasks.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const errorStatus = (code: string) => code === "SERPRO_RATE_LIMIT" ? 429 : code === "SERPRO_TIMEOUT" ? 503 : code === "SERPRO_AUTHORIZATION" ? 403 : 500;
const errorCategory = (code: string) => code === "SERPRO_RATE_LIMIT" ? "rate_limit" : code === "SERPRO_TIMEOUT" ? "timeout" : code.includes("AUTHORIZATION") || code.includes("procuration") || code.includes("connection_not_ready") ? "authorization" : "temporary";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: { code: "invalid_request" } }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expected = Deno.env.get("INTEGRA_CONTADOR_INTERNAL_WORKER_SECRET");
  if (!url || !service || !expected) return json({ error: { code: "worker_not_configured" } }, 503);
  if (req.headers.get("x-worker-token") !== expected) return json({ error: { code: "forbidden" } }, 403);
  const providerName = Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake";
  if (!["fake", "trial"].includes(providerName)) return json({ error: { code: "EXTERNAL_CONTRACT_UNVERIFIED" } }, 503);

  const db = createClient(url, service);
  const body = await req.json().catch(() => ({})) as { scenario?: Parameters<typeof createFakeIntegraContadorProvider>[0] };
  const { data: claimedJob, error: claimError } = await db.rpc("claim_fiscal_sync_job", { _visibility_seconds: 90 });
  if (claimError) return json({ error: { code: "operation_failed" } }, 500);
  if (!claimedJob?.runId) return json({ ok: true, processed: false });
  const messageId = Number(claimedJob.messageId);
  const runId = String(claimedJob.runId);

  const { data: run } = await db.from("fiscal_sync_runs").select("id,organization_id,client_id,connection_id,capability_key,correlation_id,status,attempt_count,max_attempts").eq("id", runId).eq("status", "processing").maybeSingle();
  if (!run) { await db.rpc("archive_fiscal_sync_job", { _message_id: messageId }); return json({ ok: true, processed: false }); }
  const started = Date.now();
  const requestTag = run.id.replaceAll("-", "").slice(0, 32);
  let usageStatus = 200;
  let usageSuccess = false;
  let usageError: string | null = null;
  try {
    const [{ data: client }, { data: connection }, { data: procuration }] = await Promise.all([
      db.from("clients").select("id,organization_id,cnpj,status").eq("id", run.client_id).eq("organization_id", run.organization_id).maybeSingle(),
      db.from("integra_contador_connections").select("id,contractor_tax_id,status").eq("id", run.connection_id).eq("organization_id", run.organization_id).maybeSingle(),
      db.from("fiscal_procurations").select("status").eq("client_id", run.client_id).eq("capability_key", run.capability_key).maybeSingle(),
    ]);
    if (!client || !connection || connection.status !== "active") throw new Error("connection_not_ready");
    if (procuration && procuration.status !== "valid") throw new Error("procuration_required");
    // Trial identifiers are SERPRO-owned simulation values and intentionally
    // fail real CPF/CNPJ check digits; production/fake client data remains validated.
    const taxpayer = providerName === "trial" ? { type: "CPF" as const, value: "99999999999" } : normalizeTaxIdentifier(client.cnpj || "");
    const contractor = providerName === "trial" ? { type: "CNPJ" as const, value: "00000000000000" } : normalizeTaxIdentifier(connection.contractor_tax_id);
    const scenario = body.scenario || Deno.env.get("INTEGRA_CONTADOR_FAKE_SCENARIO") as Parameters<typeof createFakeIntegraContadorProvider>[0] || "completed";
    const provider = providerName === "trial" ? createSerproTrialProvider() : createFakeIntegraContadorProvider(scenario);
    const result = await fetchCaixaPostalIndicator(provider, { capabilityKey: run.capability_key, authorization: { connectionId: connection.id, organizationId: run.organization_id, clientId: client.id, contractor, requestAuthor: contractor, taxpayer }, input: { taxpayer }, correlationId: run.correlation_id, requestId: run.id, requestTag });
    if (result.kind === "completed") {
      const { error } = await db.rpc("complete_caixa_postal_indicator_sync", { _run_id: run.id, _has_new_messages: result.output.hasNewMessages, _indicator_code: result.output.indicatorCode || null, _source_updated_at: result.sourceUpdatedAt || result.output.sourceUpdatedAt || null });
      if (error) throw error;
      usageSuccess = true;
    } else if (result.kind === "no_content") {
      const { error } = await db.rpc("complete_caixa_postal_indicator_sync", { _run_id: run.id, _has_new_messages: false, _indicator_code: null, _source_updated_at: null });
      if (error) throw error;
      usageStatus = 204; usageSuccess = true;
    } else if (run.attempt_count < run.max_attempts) {
      usageStatus = 202; usageSuccess = true;
      await db.from("fiscal_sync_runs").update({ status: "waiting_external", next_attempt_at: result.retryAt, external_protocol: result.protocol || null, updated_at: new Date().toISOString() }).eq("id", run.id).eq("status", "processing");
    } else {
      usageStatus = 202;
      usageError = "EXTERNAL_WAIT_EXHAUSTED";
      await db.from("fiscal_sync_runs").update({ status: "failed", error_code: usageError, error_category: "timeout", error_summary: "O processamento externo excedeu o limite de acompanhamento.", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id).eq("status", "processing");
    }
    return json({ ok: true, processed: true, runId: run.id, status: result.kind });
  } catch (error) {
    const code = String((error as Error).message || "SERPRO_UNAVAILABLE");
    usageStatus = errorStatus(code); usageError = code;
    const category = errorCategory(code);
    const action = category === "authorization";
    const decision = retryDecision(usageStatus, Math.max(0, run.attempt_count - 1));
    const retry = !action && decision.retry && run.attempt_count < run.max_attempts;
    await db.from("fiscal_sync_runs").update(retry ? { status: "waiting_external", error_code: code, error_category: category, error_summary: "Serviço temporariamente indisponível.", next_attempt_at: new Date(Date.now() + decision.delayMs).toISOString(), updated_at: new Date().toISOString() } : { status: action ? "requires_action" : "failed", error_code: code, error_category: category, error_summary: action ? "Regularização necessária." : "Serviço temporariamente indisponível.", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id).eq("status", "processing");
    if (action && run.client_id) await createFiscalTask(async (name, args) => { const { data, error } = await db.rpc(name, args); return { data, error: error ? { message: error.message } : null }; }, { organizationId: run.organization_id, clientId: run.client_id, title: "Regularizar acesso fiscal do cliente", description: "A sincronização fiscal identificou uma pendência de configuração ou procuração.", sector: "fiscal", priority: "Alta", integrationKey: `integra-contador:${run.id}:${code}`, context: { syncRunId: run.id, reasonCode: code, source: "integra_contador" } }).catch(() => undefined);
    return json({ ok: false, code: action ? "procuration_required" : retry ? "retry_scheduled" : "provider_unavailable", runId: run.id }, action ? 409 : 503);
  } finally {
    await Promise.all([
      db.rpc("archive_fiscal_sync_job", { _message_id: messageId }),
      db.from("serpro_api_usage").insert({ organization_id: run.organization_id, client_id: run.client_id, sync_run_id: run.id, correlation_id: run.correlation_id, request_tag: requestTag, capability_key: run.capability_key, action: "Consultar", source: "integra_contador_worker", http_status: usageStatus, duration_ms: Date.now() - started, cache_hit: false, success: usageSuccess, billable: usageStatus === 200 || usageStatus === 202, error_type: usageError, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString() }),
    ]);
  }
});
