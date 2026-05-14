import { supabase } from "@/integrations/supabase/client";
import { isFunctionalPwaRoute, normalizePwaAppScopePath, normalizePwaBasePath, syncPwaModeForPath } from "@/lib/pwaScope";

type GrowRuntimeConfig = {
  VITE_WEB_PUSH_PUBLIC_KEY?: string;
};

type GrowWindow = Window & {
  __GROW_RUNTIME_CONFIG__?: GrowRuntimeConfig;
};

export type PushPermissionState = NotificationPermission | "unsupported";

export interface PushSubscriptionStatus {
  supported: boolean;
  hasPublicKey: boolean;
  permission: PushPermissionState;
  subscribed: boolean;
  endpoint: string | null;
}

const normalizeConfigValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  if (!normalized) return "";
  if (normalized.includes("Exemplo")) return "";
  if (normalized.includes("example")) return "";
  if (normalized.includes("...")) return "";
  return normalized;
};

const readRuntimePushPublicKey = () => {
  if (typeof window === "undefined") return "";
  return normalizeConfigValue((window as GrowWindow).__GROW_RUNTIME_CONFIG__?.VITE_WEB_PUSH_PUBLIC_KEY);
};

const readWebPushPublicKey = () =>
  normalizeConfigValue(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY) || readRuntimePushPublicKey();

let cachedWebPushPublicKey: string | null = null;
let cachedWebPushPublicKeySource: "env" | "runtime" | "backend" | null = null;

const resolveWebPushPublicKey = async () => {
  const envKey = normalizeConfigValue(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY);
  if (envKey) {
    cachedWebPushPublicKey = envKey;
    cachedWebPushPublicKeySource = "env";
    return envKey;
  }

  const runtimeKey = readRuntimePushPublicKey();
  if (runtimeKey) {
    cachedWebPushPublicKey = runtimeKey;
    cachedWebPushPublicKeySource = "runtime";
    return runtimeKey;
  }

  if (cachedWebPushPublicKey) return cachedWebPushPublicKey;

  const { data, error } = await supabase.functions.invoke<{ public_key?: string }>("send-push-notification", {
    body: { action: "get_public_key" },
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel carregar a chave publica de push.");
  }

  const publicKey = normalizeConfigValue(data?.public_key);
  if (!publicKey) {
    throw new Error("Chave publica VAPID nao configurada no backend.");
  }

  cachedWebPushPublicKey = publicKey;
  cachedWebPushPublicKeySource = "backend";
  return publicKey;
};

const getServiceWorkerUrl = () => `${normalizePwaBasePath()}sw.js`;
const getServiceWorkerScopeUrl = () => new URL(normalizePwaAppScopePath(), window.location.origin).href;

const readErrorDetails = (error: unknown) => ({
  name: error instanceof Error ? error.name : "",
  message: error instanceof Error ? error.message : String(error || ""),
  stack: error instanceof Error ? error.stack : "",
});

const logPushActivationError = (step: string, error: unknown, context: Record<string, unknown> = {}) => {
  const details = readErrorDetails(error);
  console.error(
    `[push-notifications] Activation failed at ${step}: ${details.name || "Error"} - ${details.message}`,
  );
  console.error("[push-notifications] Context", context);
  if (details.stack) console.error("[push-notifications] Stack", details.stack);
};

const buildPushActivationError = (error: unknown) => {
  const { name, message } = readErrorDetails(error);
  const normalized = `${name} ${message}`.toLowerCase();

  if (normalized.includes("push service error") || normalized.includes("registration failed")) {
    return new Error(
      "Falha ao registrar no servico de push do navegador. Verifique a conexao, as permissoes de notificacao do navegador/sistema e tente novamente.",
    );
  }

  if (normalized.includes("applicationserverkey") || normalized.includes("vapid")) {
    return new Error("Chave publica VAPID invalida ou incompativel. Verifique VITE_WEB_PUSH_PUBLIC_KEY.");
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
    throw new Error("Push notifications nao sao suportadas neste navegador.");
  }

  if (!isFunctionalPwaRoute(window.location.pathname)) {
    throw new Error("Notificacoes push so podem ser ativadas no login, portal e area interna.");
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
  let hasPublicKey = readWebPushPublicKey().length > 0 || Boolean(cachedWebPushPublicKey);

  if (hasPublicKey && !cachedWebPushPublicKey) {
    void resolveWebPushPublicKey().catch(() => undefined);
  }

  if (!isPushSupported()) {
    return {
      supported: false,
      hasPublicKey,
      permission: "unsupported",
      subscribed: false,
      endpoint: null,
    };
  }

  if (!hasPublicKey) {
    try {
      await resolveWebPushPublicKey();
      hasPublicKey = true;
    } catch {
      hasPublicKey = false;
    }
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
  try {
    const webPushPublicKey = await resolveWebPushPublicKey();
    const permission = await ensurePermission();
    if (permission !== "granted") {
      throw new Error("Permissao de notificacao nao concedida.");
    }

    const registration = await ensureServiceWorkerRegistration();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(webPushPublicKey),
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
      vapidKeyLength: readWebPushPublicKey().length || cachedWebPushPublicKey?.length || 0,
      vapidKeySource: cachedWebPushPublicKeySource,
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
