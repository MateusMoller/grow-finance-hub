import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonRecord = Record<string, unknown>;

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time: string | null;
  is_active: boolean;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item));
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function hasPrivilegedRole(roles: string[]) {
  return roles.some((role) => role === "admin" || role === "director" || role === "manager");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function readErrorMessage(error: unknown, fallback = "Unknown error") {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message
    : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const vapidPublicKey = asTrimmedString(Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY"));
    const vapidPrivateKey = asTrimmedString(Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY"));
    const vapidContactEmail =
      asTrimmedString(Deno.env.get("WEB_PUSH_CONTACT_EMAIL")) || "contato@contabilidadegrow.com.br";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: "Missing WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY" }, 500);
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authorization token is required" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: callerRoleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    if (roleError) throw roleError;

    const callerRoles = (callerRoleRows || [])
      .map((row) => String(row.role || "").trim().toLowerCase())
      .filter(Boolean);

    const payload = asRecord(await req.json());
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const singleTarget = asTrimmedString(payload.target_user_id);
    const arrayTargets = asStringArray(payload.target_user_ids);
    const targetUserIds = unique([
      ...(singleTarget ? [singleTarget] : []),
      ...arrayTargets,
    ]);

    const resolvedTargets = targetUserIds.length > 0 ? targetUserIds : [callerUser.id];
    const targetsOnlySelf = resolvedTargets.every((targetId) => targetId === callerUser.id);
    if (!targetsOnlySelf && !hasPrivilegedRole(callerRoles)) {
      return jsonResponse({ error: "Only admin/director/manager can send pushes to other users" }, 403);
    }

    const title = asTrimmedString(payload.title) || "Grow Finance Hub";
    const body = asTrimmedString(payload.body) || "Nova atualizacao recebida.";
    const url = asTrimmedString(payload.url) || "./app/notificacoes";
    const tag = asTrimmedString(payload.tag) || "grow-push";
    const requireInteraction = asBoolean(payload.require_interaction);
    const renotify = asBoolean(payload.renotify);

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, expiration_time, is_active")
      .in("user_id", resolvedTargets)
      .eq("is_active", true);

    if (subscriptionsError) throw subscriptionsError;

    const activeSubscriptions = (subscriptions || []) as PushSubscriptionRow[];
    if (activeSubscriptions.length === 0) {
      return jsonResponse({
        ok: true,
        delivered: 0,
        failed: 0,
        subscriptions: 0,
        targets: resolvedTargets.length,
      });
    }

    webpush.setVapidDetails(`mailto:${vapidContactEmail}`, vapidPublicKey, vapidPrivateKey);

    const notificationPayload = JSON.stringify({
      title,
      body,
      url,
      tag,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      renotify,
      requireInteraction,
      vibrate: [120, 70, 120],
      created_at: new Date().toISOString(),
    });

    let delivered = 0;
    let failed = 0;
    const staleSubscriptionIds: string[] = [];

    for (const subscription of activeSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expiration_time
              ? new Date(subscription.expiration_time).getTime()
              : null,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload,
          { TTL: 120 },
        );

        delivered += 1;
      } catch (pushError) {
        failed += 1;
        const statusCode =
          typeof pushError === "object" &&
          pushError !== null &&
          "statusCode" in pushError &&
          typeof (pushError as { statusCode?: unknown }).statusCode === "number"
            ? (pushError as { statusCode: number }).statusCode
            : null;

        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.push(subscription.id);
        }
      }
    }

    if (staleSubscriptionIds.length > 0) {
      const { error: deactivateError } = await supabaseAdmin
        .from("push_subscriptions")
        .update({
          is_active: false,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", staleSubscriptionIds);

      if (deactivateError) {
        throw deactivateError;
      }
    }

    return jsonResponse({
      ok: true,
      delivered,
      failed,
      subscriptions: activeSubscriptions.length,
      stale_removed: staleSubscriptionIds.length,
      targets: resolvedTargets.length,
    });
  } catch (error: unknown) {
    return jsonResponse({ error: readErrorMessage(error) }, 400);
  }
});
