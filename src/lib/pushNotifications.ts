import { supabase } from "@/integrations/supabase/client";
import { isFunctionalPwaRoute, normalizePwaAppScopePath, normalizePwaBasePath, syncPwaModeForPath } from "@/lib/pwaScope";

const WEB_PUSH_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || "").trim();

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushSubscriptionStatus {
  supported: boolean;
  hasPublicKey: boolean;
  permission: PushPermissionState;
  subscribed: boolean;
  endpoint: string | null;
}

const getServiceWorkerUrl = () => `${normalizePwaBasePath()}sw.js`;

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
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const ensureServiceWorkerRegistration = async () => {
  if (!isPushSupported()) {
    throw new Error("Push notifications nao sao suportadas neste navegador.");
  }

  if (!isFunctionalPwaRoute(window.location.pathname)) {
    throw new Error("Notificacoes push so podem ser ativadas no login, portal e area interna.");
  }

  await syncPwaModeForPath(window.location.pathname);

  const scope = normalizePwaAppScopePath();
  let registration = await navigator.serviceWorker.getRegistration(scope);

  if (!registration) {
    registration = await navigator.serviceWorker.register(getServiceWorkerUrl(), { scope });
  }

  await navigator.serviceWorker.ready;
  return registration;
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
    throw new Error("Nao foi possivel ler as chaves da inscricao push.");
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
    throw new Error(error.message || "Falha ao registrar dispositivo para notificacoes push.");
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
    throw new Error("VITE_WEB_PUSH_PUBLIC_KEY nao configurada no frontend.");
  }

  const permission = await ensurePermission();
  if (permission !== "granted") {
    throw new Error("Permissao de notificacao nao concedida.");
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

export const sendPushTestToCurrentUser = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke("send-push-notification", {
    body: {
      target_user_id: userId,
      title: "Push de teste",
      body: "As notificacoes push do Grow Finance Hub estao ativas neste dispositivo.",
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
