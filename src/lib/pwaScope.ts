const FUNCTIONAL_PWA_PATH_PREFIXES = ["/login", "/portal", "/app"] as const;
const MANIFEST_LINK_ID = "grow-functional-pwa-manifest";

export const normalizePwaBasePath = () => {
  const base = String(import.meta.env.BASE_URL || "/").trim();
  if (!base) return "/";
  return base.endsWith("/") ? base : `${base}/`;
};

const toScopeRelativePath = (pathname: string) => {
  const basePath = new URL(normalizePwaBasePath(), window.location.origin).pathname;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;

  if (normalizedBasePath === "/") return normalizedPath;
  if (!normalizedPath.startsWith(normalizedBasePath)) return normalizedPath;

  const suffix = normalizedPath.slice(normalizedBasePath.length - 1);
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
};

export const isFunctionalPwaRoute = (pathname: string) => {
  const routePath = toScopeRelativePath(pathname);
  return FUNCTIONAL_PWA_PATH_PREFIXES.some(
    (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`),
  );
};

const ensureManifestLink = () => {
  let manifestLink = document.getElementById(MANIFEST_LINK_ID) as HTMLLinkElement | null;
  if (manifestLink) return manifestLink;

  manifestLink = document.createElement("link");
  manifestLink.id = MANIFEST_LINK_ID;
  manifestLink.rel = "manifest";
  manifestLink.href = `${normalizePwaBasePath()}manifest.webmanifest`;
  document.head.appendChild(manifestLink);
  return manifestLink;
};

const syncManifestForMode = (enabled: boolean) => {
  const existing = document.getElementById(MANIFEST_LINK_ID);
  if (enabled) {
    ensureManifestLink();
    return;
  }
  if (existing) existing.remove();
};

const getGrowServiceWorkerScriptUrl = () =>
  new URL(`${normalizePwaBasePath()}sw.js`, window.location.origin).href;

const isGrowServiceWorkerRegistration = (registration: ServiceWorkerRegistration) => {
  const scriptUrl = getGrowServiceWorkerScriptUrl();
  const activeScriptUrl =
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    "";
  return activeScriptUrl === scriptUrl;
};

const ensureGrowServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  const scopeUrl = new URL(normalizePwaBasePath(), window.location.origin).href;
  let registration = await navigator.serviceWorker.getRegistration(scopeUrl);

  if (!registration || !isGrowServiceWorkerRegistration(registration)) {
    registration = await navigator.serviceWorker.register(`${normalizePwaBasePath()}sw.js`, {
      scope: normalizePwaBasePath(),
    });
  }

  await navigator.serviceWorker.ready;
};

const disableGrowServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => isGrowServiceWorkerRegistration(registration))
      .map((registration) => registration.unregister()),
  );
};

export const syncPwaModeForPath = async (pathname: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const enabled = isFunctionalPwaRoute(pathname);
  syncManifestForMode(enabled);

  if (enabled) {
    await ensureGrowServiceWorker();
  } else {
    await disableGrowServiceWorker();
  }
};
