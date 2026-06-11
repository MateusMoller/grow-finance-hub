import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_FILE = path.join(ROOT_DIR, "src", "App.tsx");

const classifyRoute = (routePath, elementSource) => {
  if (elementSource.includes('scope="portal"')) return "client_portal";
  if (elementSource.includes('scope="internal"')) return "internal";
  if (routePath.startsWith("/app/")) return "auth_public_or_redirect";
  return "public";
};

const extractProtectedScope = (elementSource) => {
  const match = elementSource.match(/scope="([^"]+)"/);
  return match?.[1] ?? "";
};

const extractFeature = (elementSource) => {
  const match = elementSource.match(/feature="([^"]+)"/);
  return match?.[1] ?? "";
};

const extractTarget = (elementSource) => {
  const navigateMatch = elementSource.match(/<Navigate\s+to="([^"]+)"/);
  if (navigateMatch) return `redirect:${navigateMatch[1]}`;

  const pageMatch = elementSource.match(/<([A-Z][A-Za-z0-9]*)\s*\/?>/);
  return pageMatch?.[1] ?? "unknown";
};

export async function inventoryRoutes(appFile = APP_FILE) {
  const source = await readFile(appFile, "utf8");
  const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  const routes = [];
  let match;

  while ((match = routeRegex.exec(source)) !== null) {
    const routePath = match[1];
    const elementSource = match[2].replace(/\s+/g, " ").trim();
    routes.push({
      path: routePath,
      surface: classifyRoute(routePath, elementSource),
      protected_scope: extractProtectedScope(elementSource),
      feature: extractFeature(elementSource),
      target: extractTarget(elementSource),
      evidence_path: "src/App.tsx",
      validation_status: elementSource.includes("<ProtectedRoute") ? "requires_staging_validation" : "inventory_only",
    });
  }

  return routes;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(await inventoryRoutes(), null, 2));
}
