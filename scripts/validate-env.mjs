import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENV_FILE = join(process.cwd(), ".env");
const REQUIRED_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

function parseEnv(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value.replace(/^["']|["']$/g, "");
  }
  return parsed;
}

function isPlaceholderValue(key, value) {
  if (!value) return true;
  if (value.includes("your-project-id")) return true;
  if (key === "VITE_SUPABASE_PUBLISHABLE_KEY" && value.includes("xxxxxxxx")) return true;
  return false;
}

if (!existsSync(ENV_FILE)) {
  process.stderr.write(
    "Arquivo .env nao encontrado. Copie .env.example para .env e preencha as variaveis de producao.\n",
  );
  process.exit(1);
}

const env = parseEnv(readFileSync(ENV_FILE, "utf8"));
const missing = REQUIRED_KEYS.filter((key) => !env[key] || isPlaceholderValue(key, env[key]));

if (missing.length > 0) {
  process.stderr.write(
    `Variaveis obrigatorias ausentes/invalidas no .env: ${missing.join(", ")}\n`,
  );
  process.exit(1);
}

process.stdout.write("Variaveis de ambiente obrigatorias validadas com sucesso.\n");
