const CACHE_NAME = "grow-finance-hub-cache-v3";
const APP_SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const normalizePath = (value) => (value.startsWith("/") ? value : `/${value}`);
const getNormalizedScopePath = () => {
  const scopePath = new URL(self.registration.scope).pathname;
  return scopePath.endsWith("/") ? scopePath : `${scopePath}/`;
};

const isInServiceWorkerScope = (pathname) => {
  const normalizedScopePath = getNormalizedScopePath();
  const scopePathWithoutTrailingSlash = normalizedScopePath.slice(0, -1);
  const normalizedPathname = normalizePath(pathname);

  if (normalizedScopePath === "/") return true;
  return normalizedPathname === scopePathWithoutTrailingSlash || normalizedPathname.startsWith(normalizedScopePath);
};

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") return;
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (!isInServiceWorkerScope(requestUrl.pathname)) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      const networkResponse = await fetch(request);
      const destination = request.destination;
      const shouldCache = ["script", "style", "image", "font", "manifest"].includes(destination);

      if (shouldCache && networkResponse.ok) {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
      }

      return networkResponse;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Nova atualizacao disponivel." };
  }

  const title = payload?.title || "Grow Finance Hub";
  const body = payload?.body || "Voce recebeu uma nova notificacao.";
  const targetUrl = payload?.url || "/app/notificacoes";

  const options = {
    body,
    icon: payload?.icon || "./icons/icon-192.png",
    badge: payload?.badge || "./icons/icon-192.png",
    tag: payload?.tag || "grow-push",
    renotify: Boolean(payload?.renotify),
    requireInteraction: Boolean(payload?.requireInteraction),
    vibrate: Array.isArray(payload?.vibrate) && payload.vibrate.length > 0 ? payload.vibrate : [120, 70, 120],
    data: {
      url: targetUrl,
      payload,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlFromPayload = event.notification?.data?.url || "/app/notificacoes";
  const targetUrl = new URL(urlFromPayload, self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
