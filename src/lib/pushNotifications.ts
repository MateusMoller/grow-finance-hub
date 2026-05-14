import { supabase } from "@/integrations/supabase/client";
import { isFunctionalPwaRoute, normalizePwaAppScopePath, normalizePwaBasePath, syncPwaModeForPath } from "@/lib/pwaScope";

const FALLBACK_WEB_PUSH_PUBLIC_KEY =
  "BC16oL1ad4y93LHHSe4c044NpuDUaPGGqnw39xZ7R9v6yLmh6eKPnuGVX-3amlZxGT45nZDZfQ3UsHFrgZ5DAVk";
const WEB_PUSH_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || FALLBACK_WEB_PUSH_PUBLIC_KEY).trim();

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushSubscriptionStatus {
  supported: boolean;
  hasPublicKey: boolean;
  permission: PushPermissionState;
  subscribed: boolean;
  endpoint: string | null;
}

const getServiceWorkerUrl = () => `${normalizePwaBasePath()}sw.js`;
const getServiceWorkerScopeUrl = () => new URL(normalizePwaAppScopePath(), window.location.origin).href;

const logPushActivationError = (step: string, error: unknown, context: Record<string, unknown> = {}) => {
  console.error("[push-notifications] Activation failed", {
    step,
    error,
    context,
  });
};

const buildPushActivationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const name = error instanceof Error ? error.name : "";
  const normalized = `${name} ${message}`.toLowerCase();

  if (normalized.includes("push service error") || normalized.includes("registration failed")) {
    return new Error(
      "Falha ao registrar no servico de push do navegador. Verifique a conexao, as permissoes de notificacao do navegador/sistema e tente novamente.",
    );
  }

  if (normalized.includes("applicationserverkey") || normalized.includes("vapid")) {
    return new Error("Chave publica VAPID invalida ou incompatível. Verifique VITE_WEB_PUSH_PUBLIC_KEY.");
  }

  return error instanceof Error ? error : new Error(message || "Falha ao ativar notificacoes push.");
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const ensureServiceWorkerRegistration = async () => {
  if (!isPushSupported()) {
    throw new Error("Push notifications não sao suportadas neste navegador.");
  }

  if (!isFunctionalPwaRoute(window.location.pathname)) {
    throw new Error("Notificações push so podem ser ativadas no login, portal e area interna.");
  }

  await syncPwaModeForPath(window.location.pathname);

  const scope = normalizePwaAppScopePath();
  const scopeUrl = getServiceWorkerScopeUrl();
  let registration = await navigator.serviceWorker.getRegistration(scopeUrl);

  if (!registration) {
    registration = await navigator.serviceWorker.register(getServiceWorkerUrl(), {
      scope,
      updateViaCache: "none",
    });
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  const scopedRegistration = await navigator.serviceWorker.getRegistration(scopeUrl);
  const resolvedRegistration = scopedRegistration || readyRegistration || registration;

  if (!resolvedRegistration.active) {
    throw new Error("Service worker ainda nao esta ativo para notificacoes push.");
  }

  return resolvedRegistration;
};

const ensurePermission = async () => {
  if (!isPushSupported()) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
};

const getActiveSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await ensureServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
};

const upsertSubscriptionOnServer = async (userId: string, subscription: PushSubscription, deviceLabel?: string | null) => {
  const payload = subscription.toJSON();
  const endpoint = payload.endpoint || subscription.endpoint;
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Não foi possível ler as chaves da inscricao push.");
  }

  const expiration =
    typeof payload.expirationTime === "number"
      ? new Date(payload.expirationTime).toISOString()
      : null;

  const now = new Date().toISOString();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      expiration_time: expiration,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      device_label: deviceLabel || null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw new Error(error.message || "Falha ao registrar dispositivo para notificações push.");
  }
};

export const getPushSubscriptionStatus = async (): Promise<PushSubscriptionStatus> => {
  const hasPublicKey = WEB_PUSH_PUBLIC_KEY.length > 0;

  if (!isPushSupported()) {
    return {
      supported: false,
      hasPublicKey,
      permission: "unsupported",
      subscribed: false,
      endpoint: null,
    };
  }

  const subscription = await getActiveSubscription();

  return {
    supported: true,
    hasPublicKey,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    endpoint: subscription?.endpoint || null,
  };
};

export const subscribePushOnCurrentDevice = async (userId: string, deviceLabel?: string | null) => {
  if (!WEB_PUSH_PUBLIC_KEY) {
    throw new Error("VITE_WEB_PUSH_PUBLIC_KEY não configurada no frontend.");
  }

  try {
    const permission = await ensurePermission();
    if (permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

    const registration = await ensureServiceWorkerRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
    });
  }

    await upsertSubscriptionOnServer(userId, subscription, deviceLabel);
  } catch (error) {
    logPushActivationError("subscribePushOnCurrentDevice", error, {
      path: typeof window !== "undefined" ? window.location.pathname : null,
      secureContext: typeof window !== "undefined" ? window.isSecureContext : null,
      permission: typeof Notification !== "undefined" ? Notification.permission : null,
      serviceWorkerUrl: typeof window !== "undefined" ? getServiceWorkerUrl() : null,
      serviceWorkerScope: typeof window !== "undefined" ? normalizePwaAppScopePath() : null,
      vapidKeyLength: WEB_PUSH_PUBLIC_KEY.length,
    });
    throw buildPushActivationError(error);
  }
};

export const syncPushSubscriptionOnServer = async (userId: string) => {
  const subscription = await getActiveSubscription();
  if (!subscription) return;
  await upsertSubscriptionOnServer(userId, subscription);
};

export const disablePushOnCurrentDevice = async (userId: string) => {
  const subscription = await getActiveSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    throw new Error(error.message || "Falha ao atualizar status da inscricao push.");
  }
};

const getCurrentAccessToken = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || "Nao foi possivel validar a sessao atual.");
  }

  let accessToken = sessionData.session?.access_token?.trim();
  if (accessToken) return accessToken;

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw new Error(refreshError.message || "Sessao expirada. Faca login novamente.");
  }

  accessToken = refreshedData.session?.access_token?.trim();
  if (!accessToken) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  return accessToken;
};

export const sendPushTestToCurrentUser = async (userId: string) => {
  const accessToken = await getCurrentAccessToken();
  const { data, error } = await supabase.functions.invoke("send-push-notification", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      target_user_id: userId,
      title: "Push de teste",
      body: "As notificações push do Grow Finance Hub estão ativas neste dispositivo.",
      url: "/app/notificacoes",
      tag: `grow-push-test-${Date.now()}`,
    },
  });

  if (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar push de teste.";
    throw new Error(message);
  }

  return data;
};
