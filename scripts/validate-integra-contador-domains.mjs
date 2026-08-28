import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_SECTIONS = [
  "Requirement",
  "External Capability",
  "Prerequisites",
  "Input",
  "Output",
  "States",
  "Idempotency",
  "Cache",
  "Monitoring",
  "Retry",
  "Audit",
  "Security",
  "Acceptance Criteria",
  "Tests",
];

const REQUIRED_METADATA = ["contract_version", "capability_key", "status"];
const PLACEHOLDER_PATTERNS = [/replace\.with\.capability/i, /replace with domain name/i];

function readFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([a-z_]+):\s*["']?([^"']+?)["']?\s*$/))
      .filter(Boolean)
      .map((entry) => [entry[1], entry[2].trim()]),
  );
}

function readSections(content) {
  const matches = [...content.matchAll(/^##\s+(.+?)\s*$/gm)];
  const sections = new Map();

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    sections.set(match[1].trim(), content.slice(start, end).trim());
  });

  return sections;
}

export function validateDomainContract(content, source = "domain contract") {
  const errors = [];
  const metadata = readFrontmatter(content);
  const sections = readSections(content);

  for (const key of REQUIRED_METADATA) {
    if (!metadata[key]) errors.push(`${source}: missing metadata '${key}'`);
  }

  if (metadata.contract_version && !/^\d+\.\d+$/.test(metadata.contract_version)) {
    errors.push(`${source}: contract_version must use MAJOR.MINOR`);
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!sections.has(heading)) {
      errors.push(`${source}: missing section '## ${heading}'`);
    } else if (!sections.get(heading)) {
      errors.push(`${source}: section '## ${heading}' is empty`);
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) errors.push(`${source}: unresolved template placeholder`);
  }

  return errors;
}

export function validateDomainDirectory(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".md")
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return validateDomainContract(readFileSync(path, "utf8"), path);
    });
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const directory = resolve(process.argv[2] ?? "specs/integra-contador-domains");
  const errors = validateDomainDirectory(directory);

  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exit(1);
  }

  process.stdout.write(`Integra Contador domain contracts validated: ${directory}\n`);
}
