import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_FILE = path.join(ROOT_DIR, "supabase", "config.toml");
const FUNCTIONS_DIR = path.join(ROOT_DIR, "supabase", "functions");

const PUBLIC_WEBHOOK_HINTS = ["webhook", "open-finance-module"];

const classifyOwnerModule = (name) => {
  if (name.includes("assistant")) return "ai";
  if (name.includes("whatsapp") || name.includes("conecta") || name.includes("email-inbox")) return "webhook";
  if (name.includes("open-finance")) return "open_finance";
  if (name.includes("acessorias")) return "acessorias";
  if (name.includes("obligations")) return "obligations";
  if (name.includes("team") || name.includes("admin") || name.includes("portal")) return "identity_access";
  if (name.includes("newsletter") || name.includes("contact") || name.includes("push")) return "messaging";
  return "general";
};

const isPublicWebhook = (name, verifyJwt) => !verifyJwt || PUBLIC_WEBHOOK_HINTS.some((hint) => name.includes(hint));

async function listFunctionDirectories() {
  try {
    const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_")).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function inventoryEdgeFunctions(configFile = CONFIG_FILE) {
  const source = await readFile(configFile, "utf8");
  const configRegex = /\[functions\.([^\]]+)\]\s+verify_jwt\s*=\s*(true|false)/g;
  const configured = new Map();
  let match;

  while ((match = configRegex.exec(source)) !== null) {
    const name = match[1];
    const verifyJwt = match[2] === "true";
    configured.set(name, {
      name,
      verify_jwt: verifyJwt,
      public_webhook_status: isPublicWebhook(name, verifyJwt) ? "public_or_webhook_review_required" : "jwt_required",
      owner_module: classifyOwnerModule(name),
      evidence_path: "supabase/config.toml",
      validation_status: verifyJwt ? "requires_authorization_validation" : "requires_signature_or_compensating_control_validation",
    });
  }

  for (const name of await listFunctionDirectories()) {
    if (!configured.has(name)) {
      configured.set(name, {
        name,
        verify_jwt: "not_configured",
        public_webhook_status: "configuration_missing",
        owner_module: classifyOwnerModule(name),
        evidence_path: `supabase/functions/${name}/index.ts`,
        validation_status: "requires_config_review",
      });
    }
  }

  return [...configured.values()].sort((a, b) => a.name.localeCompare(b.name));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(await inventoryEdgeFunctions(), null, 2));
}
