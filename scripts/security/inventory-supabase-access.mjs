import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_DIRS = ["src", path.join("supabase", "functions")];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath);
      if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) return [fullPath];
      return [];
    }),
  );
  return files.flat();
}

const relativePath = (filePath) => path.relative(ROOT_DIR, filePath).replaceAll("\\", "/");

export async function inventorySupabaseAccess(rootDir = ROOT_DIR) {
  const files = [];
  for (const scanDir of SCAN_DIRS) {
    try {
      files.push(...(await listFiles(path.join(rootDir, scanDir))));
    } catch {
      // Optional scan path.
    }
  }

  const calls = [];
  const fromRegex = /(?<!storage\s*)\.from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    let match;
    while ((match = fromRegex.exec(source)) !== null) {
      calls.push({
        table: match[1],
        file: relativePath(file),
        validation_status: file.includes(`${path.sep}supabase${path.sep}functions${path.sep}`)
          ? "requires_edge_function_authorization_review"
          : "requires_rls_validation",
      });
    }
  }

  return calls.sort((a, b) => `${a.table}:${a.file}`.localeCompare(`${b.table}:${b.file}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(await inventorySupabaseAccess(), null, 2));
}
