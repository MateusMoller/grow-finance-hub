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

export async function inventoryStorageUsage(rootDir = ROOT_DIR) {
  const files = [];
  for (const scanDir of SCAN_DIRS) {
    try {
      files.push(...(await listFiles(path.join(rootDir, scanDir))));
    } catch {
      // Optional scan path.
    }
  }

  const usages = [];
  const literalRegex = /storage\s*\.\s*from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const unresolvedRegex = /storage\s*\.\s*from\s*\(\s*([^)]+)\s*\)/g;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    let match;
    const literalMatches = new Set();

    while ((match = literalRegex.exec(source)) !== null) {
      literalMatches.add(match[0]);
      usages.push({
        bucket: match[1],
        reference_type: "literal",
        file: relativePath(file),
        validation_status: "requires_bucket_policy_validation",
      });
    }

    while ((match = unresolvedRegex.exec(source)) !== null) {
      if (literalMatches.has(match[0])) continue;
      usages.push({
        bucket: match[1].trim(),
        reference_type: "expression",
        file: relativePath(file),
        validation_status: "requires_manual_resolution",
      });
    }
  }

  return usages.sort((a, b) => `${a.bucket}:${a.file}`.localeCompare(`${b.bucket}:${b.file}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(await inventoryStorageUsage(), null, 2));
}
