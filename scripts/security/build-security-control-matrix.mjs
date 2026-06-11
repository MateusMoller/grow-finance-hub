import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryRoutes } from "./inventory-routes.mjs";
import { inventoryEdgeFunctions } from "./inventory-edge-functions.mjs";
import { inventoryStorageUsage } from "./inventory-storage-usage.mjs";
import { inventorySupabaseAccess } from "./inventory-supabase-access.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_FILE = path.join(ROOT_DIR, "docs", "security", "security-control-matrix.md");

const today = "2026-06-10";

const addDays = (dateText, days) => {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dueDateForRisk = (risk) => {
  if (risk === "critical" || risk === "high") return addDays(today, 30);
  if (risk === "medium") return addDays(today, 60);
  return addDays(today, 90);
};

const riskForRoute = (route) => {
  if (route.surface === "client_portal") return "critical";
  if (route.surface === "internal" && ["usuarios", "financeiro", "relatorios", "obrigacoes"].includes(route.feature)) return "high";
  if (route.surface === "internal") return "medium";
  return "low";
};

const riskForFunction = (fn) => {
  if (fn.verify_jwt === false) return "critical";
  if (["identity_access", "ai", "open_finance", "acessorias"].includes(fn.owner_module)) return "high";
  return "medium";
};

const riskForStorage = (usage) => {
  if (/document|file|anexo|attachment|obligation|process|client/i.test(`${usage.bucket} ${usage.file}`)) return "critical";
  return usage.reference_type === "expression" ? "high" : "medium";
};

const mdEscape = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");

const table = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${headers.map((header) => mdEscape(row[header])).join(" | ")} |`),
].join("\n");

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function buildSecurityControlMatrix() {
  const [routes, functions, storage, supabaseAccess] = await Promise.all([
    inventoryRoutes(),
    inventoryEdgeFunctions(),
    inventoryStorageUsage(),
    inventorySupabaseAccess(),
  ]);

  const routeRows = routes.map((route) => {
    const risk = riskForRoute(route);
    return {
      surface_id: `route:${route.path}`,
      surface_type: route.surface,
      owner_layer: route.surface === "public" ? "frontend" : "frontend+rls",
      risk_level: risk,
      access_rule: route.protected_scope ? `ProtectedRoute scope=${route.protected_scope} feature=${route.feature || "none"}` : "public route or redirect",
      evidence_path: route.evidence_path,
      validation_status: route.validation_status,
      review_owner: route.surface === "client_portal" ? "security/backend" : "tech_lead",
      review_due_date: dueDateForRisk(risk),
      remediation_required: route.surface === "client_portal" ? "Validate cross-client access in staging and confirm RLS policies." : "Confirm route-level rule matches backend/RLS controls.",
    };
  });

  const functionRows = functions.map((fn) => {
    const risk = riskForFunction(fn);
    return {
      surface_id: `function:${fn.name}`,
      surface_type: fn.owner_module,
      owner_layer: "edge_function",
      risk_level: risk,
      access_rule: `verify_jwt=${fn.verify_jwt}; public_status=${fn.public_webhook_status}`,
      evidence_path: fn.evidence_path,
      validation_status: fn.validation_status,
      review_owner: fn.verify_jwt === false ? "security/backend" : "backend",
      review_due_date: dueDateForRisk(risk),
      remediation_required: fn.verify_jwt === false ? "Prove signature, idempotency, rate limit and payload validation before production acceptance." : "Validate JWT, role and organization checks.",
    };
  });

  const storageRows = uniqueBy(storage, (item) => `${item.bucket}:${item.file}`).map((usage) => {
    const risk = riskForStorage(usage);
    return {
      surface_id: `storage:${usage.bucket}`,
      surface_type: usage.reference_type,
      owner_layer: "storage+rls",
      risk_level: risk,
      access_rule: "Private bucket policy, signed URL and upload validation required for sensitive documents.",
      evidence_path: usage.file,
      validation_status: usage.validation_status,
      review_owner: risk === "critical" ? "security/backend" : "backend",
      review_due_date: dueDateForRisk(risk),
      remediation_required: usage.reference_type === "expression" ? "Resolve dynamic bucket name and classify sensitivity." : "Confirm bucket privacy, file limits and audit coverage.",
    };
  });

  const tableRows = uniqueBy(supabaseAccess, (item) => `${item.table}:${item.file}`).slice(0, 160).map((call) => ({
    surface_id: `table:${call.table}`,
    surface_type: call.file.startsWith("supabase/functions/") ? "edge_function_data_access" : "browser_data_access",
    owner_layer: call.file.startsWith("supabase/functions/") ? "edge_function+rls" : "rls",
    risk_level: /client|user|profile|document|credential|token|finance|audit|obligation|kanban/i.test(call.table) ? "high" : "medium",
    access_rule: call.file.startsWith("supabase/functions/") ? "Function must validate actor, role, organization and payload before data access." : "RLS must enforce actor, role, organization and client boundaries.",
    evidence_path: call.file,
    validation_status: call.validation_status,
    review_owner: "backend",
    review_due_date: dueDateForRisk(/client|user|profile|document|credential|token|finance|audit|obligation|kanban/i.test(call.table) ? "high" : "medium"),
    remediation_required: "Confirm no SELECT * or overbroad mutation exposes sensitive properties.",
  }));

  const priorityRows = [
    {
      surface_id: "priority:client-portal-cross-client",
      surface_type: "client_portal",
      owner_layer: "rls+frontend",
      risk_level: "critical",
      access_rule: "Client users may access only their own client or organization-linked records.",
      evidence_path: "docs/security/manual-scenarios/access-control.md",
      validation_status: "blocked_pending_staging",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Run cross-client portal scenario and fix any path that returns another client's data.",
    },
    {
      surface_id: "priority:private-documents-storage",
      surface_type: "storage",
      owner_layer: "storage+rls",
      risk_level: "critical",
      access_rule: "Private document buckets must reject unauthorized access and use short-lived signed URLs.",
      evidence_path: "docs/security/manual-scenarios/storage-documents.md",
      validation_status: "blocked_pending_staging",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Validate bucket privacy, signed URL expiry, upload filters and audit events.",
    },
    {
      surface_id: "priority:public-webhooks",
      surface_type: "webhook",
      owner_layer: "edge_function",
      risk_level: "critical",
      access_rule: "Public functions must verify signatures or equivalent provider controls before state changes.",
      evidence_path: "docs/security/manual-scenarios/edge-functions-webhooks.md",
      validation_status: "blocked_pending_staging",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Validate invalid signature, duplicate event and malformed payload handling.",
    },
    {
      surface_id: "priority:ai-actions",
      surface_type: "ai",
      owner_layer: "edge_function",
      risk_level: "high",
      access_rule: "AI actions require JWT, actor authorization, risk confirmation and audit logging.",
      evidence_path: "docs/security/edge-function-security-matrix.md",
      validation_status: "requires_code_review_and_staging",
      review_owner: "backend",
      review_due_date: dueDateForRisk("high"),
      remediation_required: "Confirm high-risk tool calls require explicit confirmation and no secrets are logged.",
    },
    {
      surface_id: "priority:whatsapp",
      surface_type: "webhook",
      owner_layer: "edge_function",
      risk_level: "critical",
      access_rule: "WhatsApp webhook must validate origin/signature where provider supports it and avoid unauthorized state changes.",
      evidence_path: "docs/security/manual-scenarios/edge-functions-webhooks.md",
      validation_status: "blocked_pending_staging",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Validate replay/idempotency and malformed payload rejection.",
    },
    {
      surface_id: "priority:open-finance",
      surface_type: "open_finance",
      owner_layer: "edge_function",
      risk_level: "critical",
      access_rule: "Open Finance actions and webhooks require provider validation, idempotency and scoped secrets.",
      evidence_path: "docs/security/edge-function-security-matrix.md",
      validation_status: "requires_code_review_and_staging",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Confirm JWT/signature boundary and no browser-visible provider credentials.",
    },
    {
      surface_id: "priority:acessorias",
      surface_type: "acessorias",
      owner_layer: "edge_function+rls",
      risk_level: "high",
      access_rule: "Acessorias module must validate organization, role and service-role use before reads or writes.",
      evidence_path: "docs/security/edge-function-security-matrix.md",
      validation_status: "requires_code_review_and_staging",
      review_owner: "backend",
      review_due_date: dueDateForRisk("high"),
      remediation_required: "Confirm service-role paths enforce organization and actor checks.",
    },
    {
      surface_id: "priority:deployed-manage-team-user-verify-jwt",
      surface_type: "identity_access",
      owner_layer: "edge_function",
      risk_level: "critical",
      access_rule: "Deployed Supabase function setting must match local config; live connector showed verify_jwt=false while local config says true.",
      evidence_path: "docs/security/supabase-live-read-validation.md",
      validation_status: "failed_deployment_config_reconciliation",
      review_owner: "security/backend",
      review_due_date: dueDateForRisk("critical"),
      remediation_required: "Redeploy or update Supabase function configuration so JWT expectations are explicit and consistent.",
    },
    {
      surface_id: "priority:deployed-send-push-notification-verify-jwt",
      surface_type: "messaging",
      owner_layer: "edge_function",
      risk_level: "high",
      access_rule: "Deployed Supabase function setting must match local config; live connector showed verify_jwt=false while local config says true.",
      evidence_path: "docs/security/supabase-live-read-validation.md",
      validation_status: "failed_deployment_config_reconciliation",
      review_owner: "backend",
      review_due_date: dueDateForRisk("high"),
      remediation_required: "Review authorization behavior and reconcile deployed function configuration.",
    },
    {
      surface_id: "priority:deployed-send-site-contact-email-config",
      surface_type: "messaging",
      owner_layer: "edge_function",
      risk_level: "high",
      access_rule: "Public contact function is deployed with verify_jwt=false and is absent from local supabase/config.toml.",
      evidence_path: "docs/security/supabase-live-read-validation.md",
      validation_status: "requires_rate_limit_and_config_reconciliation",
      review_owner: "backend",
      review_due_date: dueDateForRisk("high"),
      remediation_required: "Add function to local Supabase config and document rate-limit/spam controls.",
    },
  ];

  const content = `# Security Control Matrix

Generated by \`npm run security:inventory\` on ${today}.

This matrix is the first repository-owned baseline for protected surfaces. It does not replace RLS, Storage policies, Edge Function authorization or deploy-platform controls. Runtime hardening work must be opened from the remediation rows below.

## Required Fields

Protected surface records include \`surface_id\`, \`surface_type\`, \`owner_layer\`, \`risk_level\`, \`access_rule\`, \`review_owner\`, \`review_due_date\`, \`evidence_path\`, \`validation_status\` and \`remediation_required\`.

## Priority Security Findings

${table(["surface_id", "surface_type", "owner_layer", "risk_level", "access_rule", "review_owner", "review_due_date", "evidence_path", "validation_status", "remediation_required"], priorityRows)}

## Live Supabase Validation

Read-only live project evidence is recorded in \`docs/security/supabase-live-read-validation.md\`. The generated local inventory must be reconciled against deployed Supabase settings before a protected surface is treated as hardened.

## Route Inventory

${table(["surface_id", "surface_type", "owner_layer", "risk_level", "access_rule", "review_owner", "review_due_date", "evidence_path", "validation_status", "remediation_required"], routeRows)}

## Edge Function Inventory

${table(["surface_id", "surface_type", "owner_layer", "risk_level", "access_rule", "review_owner", "review_due_date", "evidence_path", "validation_status", "remediation_required"], functionRows)}

## Storage Usage Inventory

${storageRows.length > 0 ? table(["surface_id", "surface_type", "owner_layer", "risk_level", "access_rule", "review_owner", "review_due_date", "evidence_path", "validation_status", "remediation_required"], storageRows) : "No Storage usage was found by the inventory script."}

## Supabase Data Access Inventory

The table below is intentionally capped to the first 160 file/table pairs to keep the baseline reviewable. Re-run the inventory after any new module, route, Edge Function or Supabase table access is added.

${table(["surface_id", "surface_type", "owner_layer", "risk_level", "access_rule", "review_owner", "review_due_date", "evidence_path", "validation_status", "remediation_required"], tableRows)}
`;

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, content, "utf8");
  return {
    outputFile: path.relative(ROOT_DIR, OUTPUT_FILE).replaceAll("\\", "/"),
    counts: {
      routes: routes.length,
      functions: functions.length,
      storage_usages: storage.length,
      supabase_access_calls: supabaseAccess.length,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(await buildSecurityControlMatrix(), null, 2));
}
