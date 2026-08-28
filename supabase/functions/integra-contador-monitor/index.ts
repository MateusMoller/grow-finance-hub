import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MONITORING_FIXTURES, type MonitoringFixtureScenario } from "../_shared/integra-contador/testing/fixtures/monitoring.ts";
import { nextMonitorState, selectChangedEvents } from "../_shared/integra-contador/workflows/monitor-fiscal.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: { code: "invalid_request" } }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("INTEGRA_CONTADOR_INTERNAL_WORKER_SECRET");
  if (!url || !service || !secret) return json({ error: { code: "monitor_not_configured" } }, 503);
  if (req.headers.get("x-worker-token") !== secret) return json({ error: { code: "forbidden" } }, 403);
  const providerName = Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake";
  if (providerName === "trial") return json({ ok: true, processed: false, reason: "trial_manual_only" });
  if (providerName !== "fake") return json({ error: { code: "EXTERNAL_CONTRACT_UNVERIFIED" } }, 503);

  const db = createClient(url, service);
  const body = await req.json().catch(() => ({})) as { action?: string; scenario?: MonitoringFixtureScenario };
  const reconciliation = body.action === "reconcile";
  await db.rpc("ensure_integra_contador_monitor_runs", { _reconciliation: reconciliation, _reason: reconciliation ? "scheduled_reconciliation" : null });
  const owner = crypto.randomUUID();
  const { data, error } = await db.rpc("claim_integra_contador_monitor_run", { _owner: owner, _lease_seconds: 60 });
  if (error) return json({ error: { code: "operation_failed" } }, 500);
  const run = data?.[0];
  if (!run) return json({ ok: true, processed: false });

  const [{ data: clients }, { data: knownStates }] = await Promise.all([
    db.from("clients").select("id").eq("organization_id", run.organization_id).eq("status", "Ativo").limit(1000),
    db.from("receita_event_states").select("event_fingerprint").eq("organization_id", run.organization_id).eq("event_type", run.event_type).gte("last_checked_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()).not("event_fingerprint", "is", null).limit(5000),
  ]);
  const scenario = body.scenario || Deno.env.get("INTEGRA_CONTADOR_MONITOR_FAKE_SCENARIO") as MonitoringFixtureScenario || (reconciliation ? "reconciliation" : "changed");
  const fixture = MONITORING_FIXTURES[scenario] || MONITORING_FIXTURES.changed;
  const synthetic = fixture.events.flatMap((event, index) => clients?.[index] ? [{ ...event, clientId: clients[index].id }] : []);
  const knownFingerprints = new Set((knownStates || []).map((state) => state.event_fingerprint).filter(Boolean));
  const changed = selectChangedEvents(synthetic, knownFingerprints);
  const state = nextMonitorState({ quotaRemaining: fixture.quotaRemaining, waitMs: fixture.waitMs, reconciliation });
  const { data: queued, error: applyError } = await db.rpc("apply_integra_contador_monitor_events", { _monitor_run_id: run.id, _events: changed, _quota_remaining: fixture.quotaRemaining, _next_attempt_at: state.nextAttemptAt });
  if (applyError) return json({ error: { code: "operation_failed" } }, 500);
  return json({ ok: true, processed: true, monitorRunId: run.id, queued, quotaRemaining: fixture.quotaRemaining, status: state.status });
});
