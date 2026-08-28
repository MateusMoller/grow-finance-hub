import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTaskAction } from "../_shared/task-authorization.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply({ ok: false, code: "method_not_allowed" }, 405);
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("authorization");
    if (!url || !serviceKey) throw new Error("backend_configuration_missing");
    if (!authorization?.toLowerCase().startsWith("bearer ")) return reply({ ok: false, code: "unauthorized", correlationId }, 401);
    const admin = createClient(url, serviceKey);
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7).trim());
    if (authError || !authData.user) return reply({ ok: false, code: "unauthorized", correlationId }, 401);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = body?.action;
    const organizationId = body?.organizationId;
    const items = Array.isArray(body?.items) ? body.items : body?.taskId || action === "task.create"
      ? [{ taskId: body?.taskId, expectedVersion: body?.expectedVersion, changes: body?.changes }]
      : [];
    if (!isTaskAction(action) || typeof organizationId !== "string" || !uuid.test(organizationId) || items.length < 1 || items.length > 100) {
      return reply({ ok: false, code: "invalid_request", correlationId }, 400);
    }
    const { data, error } = await admin.rpc("mutate_tasks_canonical", {
      _actor_user_id: authData.user.id,
      _organization_id: organizationId,
      _action: action,
      _items: items,
      _actor_source: "internal_app",
      _correlation_id: correlationId,
    });
    if (error) {
      const conflict = error.code === "40001" || error.message?.includes("task_version_conflict");
      const unavailable = error.code === "42501" || error.message?.includes("task_not_available");
      return reply({ ok: false, code: conflict ? "version_conflict" : unavailable ? "task_not_available" : "mutation_failed", correlationId }, conflict ? 409 : unavailable ? 403 : 400);
    }
    return reply(data);
  } catch {
    return reply({ ok: false, code: "mutation_failed", correlationId }, 500);
  }
});
