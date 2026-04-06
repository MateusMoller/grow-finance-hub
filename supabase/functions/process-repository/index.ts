import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const internalRoles = new Set([
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "partner",
  "departamento_pessoal",
  "fiscal",
  "contabil",
]);

type JsonRecord = Record<string, unknown>;

type GitHubTreeEntry = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
};

type GitHubContentFile = {
  type: "file";
  encoding?: string;
  size?: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
};

type GitHubRepoConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
  webUrl: string;
};

type ProcessMetadata = {
  process_id: string;
  process_name: string;
  process_description: string | null;
  department: string;
  status: string;
  updated_at: string;
};

type ListedDocument = {
  id: string;
  process_id: string;
  process_name: string;
  process_description: string | null;
  department: string;
  status: string;
  file_name: string;
  repository_path: string;
  relative_path: string;
  file_size: number | null;
  sha: string | null;
  created_at: string;
  updated_at: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return asTrimmedString(value);
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function toPathSegments(value: string) {
  const normalized = normalizePath(value);
  if (!normalized) return [] as string[];

  return normalized.split("/").filter((segment) => segment.length > 0);
}

function assertNoTraversal(segments: string[]) {
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new HttpError(400, "Invalid path segment.");
    }
  }
}

function sanitizeProcessId(value: string | null) {
  if (!value) throw new HttpError(400, "process_id is required.");
  const segments = toPathSegments(value);
  assertNoTraversal(segments);

  if (segments.length !== 1) {
    throw new HttpError(400, "process_id must be a single folder name.");
  }

  return segments[0];
}

function sanitizeRelativePath(value: string | null) {
  if (!value) throw new HttpError(400, "relative_path is required.");
  const segments = toPathSegments(value);
  assertNoTraversal(segments);

  if (segments.length === 0) {
    throw new HttpError(400, "relative_path cannot be empty.");
  }

  return segments.join("/");
}

function sanitizeRepositoryPath(value: string | null) {
  if (!value) throw new HttpError(400, "repository_path is required.");
  const segments = toPathSegments(value);
  assertNoTraversal(segments);

  if (segments.length === 0) {
    throw new HttpError(400, "repository_path cannot be empty.");
  }

  return segments.join("/");
}

function joinPath(...parts: string[]) {
  const allSegments = parts.flatMap((part) => toPathSegments(part));
  assertNoTraversal(allSegments);
  return allSegments.join("/");
}

function ensurePathInsideBase(path: string, basePath: string) {
  if (!basePath) return;
  if (path === basePath) return;
  if (path.startsWith(`${basePath}/`)) return;
  throw new HttpError(400, "Path is outside repository base path.");
}

function encodePathForGitHub(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function utf8ToBase64(value: string) {
  const encoded = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of encoded) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(value: string) {
  const normalized = value.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseGitHubErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { message?: unknown };
    const message = asTrimmedString(parsed.message);
    if (message) return message;
  } catch {
    // ignore parse errors
  }
  return raw.trim() || "Unknown GitHub error.";
}

function parseRepoConfigFromEnv() {
  const token = asTrimmedString(Deno.env.get("GITHUB_PROCESS_REPO_TOKEN"));
  if (!token) {
    throw new HttpError(500, "Missing GITHUB_PROCESS_REPO_TOKEN environment variable.");
  }

  const repository =
    asTrimmedString(Deno.env.get("GITHUB_PROCESS_REPO")) ||
    "MateusMoller/processos-contabeis";

  const [ownerRaw, repoRaw] = repository.split("/");
  const owner = asTrimmedString(ownerRaw);
  const repo = asTrimmedString(repoRaw);

  if (!owner || !repo) {
    throw new HttpError(500, "GITHUB_PROCESS_REPO must be in owner/repo format.");
  }

  const branch = asTrimmedString(Deno.env.get("GITHUB_PROCESS_REPO_BRANCH")) || "main";
  const basePath = normalizePath(asTrimmedString(Deno.env.get("GITHUB_PROCESS_REPO_BASE_PATH")) || "");

  return {
    token,
    owner,
    repo,
    branch,
    basePath,
    webUrl: `https://github.com/${owner}/${repo}`,
  } as GitHubRepoConfig;
}

async function githubRequest<T>(
  config: GitHubRepoConfig,
  path: string,
  init: RequestInit = {},
  expectedStatuses: number[] = [200],
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers,
  });

  if (!expectedStatuses.includes(response.status)) {
    const responseText = await response.text();
    const message = parseGitHubErrorMessage(responseText);
    throw new HttpError(response.status, `GitHub API error: ${message}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

async function getGithubFileContentMaybe(
  config: GitHubRepoConfig,
  repositoryPath: string,
) {
  const encodedPath = encodePathForGitHub(repositoryPath);
  try {
    return await githubRequest<GitHubContentFile>(
      config,
      `/repos/${config.owner}/${config.repo}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`,
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

async function assertInternalCaller(req: Request) {
  const supabaseUrl = asTrimmedString(Deno.env.get("SUPABASE_URL"));
  const serviceRoleKey = asTrimmedString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const anonKey = asTrimmedString(Deno.env.get("SUPABASE_ANON_KEY"));

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new HttpError(500, "Missing Supabase environment configuration.");
  }

  const token = extractBearerToken(req);
  if (!token) {
    throw new HttpError(401, "Authorization token is required.");
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    throw new HttpError(401, "Invalid or expired session.");
  }

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    throw new HttpError(500, rolesError.message || "Unable to verify caller role.");
  }

  const isInternal = (roles || []).some((row) => {
    const role = asTrimmedString((row as { role?: unknown }).role)?.toLowerCase();
    return role ? internalRoles.has(role) : false;
  });

  if (!isInternal) {
    throw new HttpError(403, "Only internal users can manage process repository.");
  }
}

async function listRepositoryDocuments(config: GitHubRepoConfig) {
  const commitData = await githubRequest<{ commit: { tree: { sha: string } } }>(
    config,
    `/repos/${config.owner}/${config.repo}/commits/${encodeURIComponent(config.branch)}`,
  );
  const treeSha = asTrimmedString(commitData?.commit?.tree?.sha);
  if (!treeSha) {
    throw new HttpError(502, "Unable to resolve repository tree.");
  }

  const treeData = await githubRequest<{ tree: GitHubTreeEntry[] }>(
    config,
    `/repos/${config.owner}/${config.repo}/git/trees/${treeSha}?recursive=1`,
  );
  const entries = treeData.tree || [];
  const basePrefix = config.basePath ? `${config.basePath}/` : "";

  const grouped = new Map<
    string,
    {
      metadataPath: string | null;
      files: Array<{ entry: GitHubTreeEntry; relativePath: string }>;
      metadata: ProcessMetadata | null;
    }
  >();

  for (const entry of entries) {
    if (entry.type !== "blob") continue;

    if (config.basePath && !(entry.path === config.basePath || entry.path.startsWith(basePrefix))) {
      continue;
    }

    const scopedPath = config.basePath ? entry.path.slice(basePrefix.length) : entry.path;
    const segments = toPathSegments(scopedPath);
    if (segments.length < 2) continue;

    const [processId, ...rest] = segments;
    const relativePath = rest.join("/");

    const bucket = grouped.get(processId) || { metadataPath: null, files: [], metadata: null };

    if (relativePath === ".process-meta.json") {
      bucket.metadataPath = entry.path;
      grouped.set(processId, bucket);
      continue;
    }

    bucket.files.push({ entry, relativePath });
    grouped.set(processId, bucket);
  }

  for (const [processId, bucket] of grouped.entries()) {
    if (!bucket.metadataPath) continue;

    const metadataContent = await getGithubFileContentMaybe(config, bucket.metadataPath);
    if (!metadataContent || metadataContent.type !== "file" || !metadataContent.content) continue;

    try {
      const parsed = asRecord(JSON.parse(base64ToUtf8(metadataContent.content)));
      if (!parsed) continue;

      bucket.metadata = {
        process_id: processId,
        process_name: asTrimmedString(parsed.process_name) || processId,
        process_description: asNullableString(parsed.process_description),
        department: asTrimmedString(parsed.department) || "geral",
        status: asTrimmedString(parsed.status) || "aberto",
        updated_at: asTrimmedString(parsed.updated_at) || new Date().toISOString(),
      };
    } catch {
      // Ignore malformed metadata and fallback to defaults.
    }
  }

  const listedDocuments: ListedDocument[] = [];
  const now = new Date().toISOString();

  for (const [processId, bucket] of grouped.entries()) {
    const metadata = bucket.metadata || {
      process_id: processId,
      process_name: processId,
      process_description: null,
      department: "geral",
      status: "aberto",
      updated_at: now,
    };

    for (const file of bucket.files) {
      listedDocuments.push({
        id: `${processId}:${file.entry.sha}`,
        process_id: processId,
        process_name: metadata.process_name,
        process_description: metadata.process_description,
        department: metadata.department,
        status: metadata.status,
        file_name: file.relativePath.split("/").pop() || file.entry.path,
        repository_path: file.entry.path,
        relative_path: file.relativePath,
        file_size: typeof file.entry.size === "number" ? file.entry.size : null,
        sha: file.entry.sha,
        created_at: metadata.updated_at,
        updated_at: metadata.updated_at,
      });
    }
  }

  listedDocuments.sort((a, b) => {
    const dateDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.repository_path.localeCompare(b.repository_path);
  });

  return listedDocuments;
}

async function upsertProcessMetadata(config: GitHubRepoConfig, metadata: ProcessMetadata) {
  const metadataPath = joinPath(config.basePath, metadata.process_id, ".process-meta.json");
  const existingMetadata = await getGithubFileContentMaybe(config, metadataPath);

  const metadataContent = `${JSON.stringify(metadata, null, 2)}\n`;
  const payload: JsonRecord = {
    message: `chore(processos): atualiza metadados ${metadata.process_id}`,
    content: utf8ToBase64(metadataContent),
    branch: config.branch,
  };

  if (existingMetadata?.sha) {
    payload.sha = existingMetadata.sha;
  }

  const encodedMetadataPath = encodePathForGitHub(metadataPath);
  await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${encodedMetadataPath}`,
    { method: "PUT", body: JSON.stringify(payload) },
    [200, 201],
  );
}

function guessContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return byExtension[extension] || "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const config = parseRepoConfigFromEnv();
    await assertInternalCaller(req);

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      throw new HttpError(400, "Invalid payload.");
    }

    const action = asTrimmedString(payload.action) as ProcessRepositoryAction | null;
    if (!action) {
      throw new HttpError(400, "action is required.");
    }

    if (action === "list") {
      const documents = await listRepositoryDocuments(config);
      return jsonResponse({
        ok: true,
        repo: {
          owner: config.owner,
          name: config.repo,
          branch: config.branch,
          base_path: config.basePath,
          web_url: config.webUrl,
        },
        documents,
      });
    }

    if (action === "upsert_file") {
      const processId = sanitizeProcessId(asTrimmedString(payload.process_id));
      const relativePath = sanitizeRelativePath(asTrimmedString(payload.relative_path));
      const fileName = asTrimmedString(payload.file_name) || relativePath.split("/").pop() || "arquivo";
      const contentBase64 = asTrimmedString(payload.content_base64);
      if (!contentBase64) {
        throw new HttpError(400, "content_base64 is required.");
      }

      const repositoryPath = joinPath(config.basePath, processId, relativePath);
      ensurePathInsideBase(repositoryPath, config.basePath);

      const normalizedBase64 = contentBase64.replace(/\s/g, "");
      const existingFile = await getGithubFileContentMaybe(config, repositoryPath);

      const uploadPayload: JsonRecord = {
        message: `chore(processos): atualiza ${repositoryPath}`,
        content: normalizedBase64,
        branch: config.branch,
      };

      if (existingFile?.sha) {
        uploadPayload.sha = existingFile.sha;
      }

      const encodedPath = encodePathForGitHub(repositoryPath);
      const upsertResult = await githubRequest<{ content?: { sha?: string } }>(
        config,
        `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`,
        { method: "PUT", body: JSON.stringify(uploadPayload) },
        [200, 201],
      );

      const metadata: ProcessMetadata = {
        process_id: processId,
        process_name: asTrimmedString(payload.process_name) || processId,
        process_description: asNullableString(payload.process_description),
        department: asTrimmedString(payload.department) || "geral",
        status: asTrimmedString(payload.status) || "aberto",
        updated_at: new Date().toISOString(),
      };
      await upsertProcessMetadata(config, metadata);

      return jsonResponse({
        ok: true,
        repository_path: repositoryPath,
        file_name: fileName,
        sha: asTrimmedString(upsertResult?.content?.sha),
      });
    }

    if (action === "update_process_metadata") {
      const processId = sanitizeProcessId(asTrimmedString(payload.process_id));
      const metadata: ProcessMetadata = {
        process_id: processId,
        process_name: asTrimmedString(payload.process_name) || processId,
        process_description: asNullableString(payload.process_description),
        department: asTrimmedString(payload.department) || "geral",
        status: asTrimmedString(payload.status) || "aberto",
        updated_at: new Date().toISOString(),
      };

      await upsertProcessMetadata(config, metadata);
      return jsonResponse({ ok: true, message: "Metadata updated." });
    }

    if (action === "delete_file") {
      const repositoryPath = sanitizeRepositoryPath(asTrimmedString(payload.repository_path));
      ensurePathInsideBase(repositoryPath, config.basePath);

      if (repositoryPath.endsWith("/.process-meta.json")) {
        throw new HttpError(400, "Metadata files cannot be deleted by this action.");
      }

      let sha = asTrimmedString(payload.sha);
      if (!sha) {
        const existing = await getGithubFileContentMaybe(config, repositoryPath);
        if (!existing?.sha) {
          throw new HttpError(404, "File not found in repository.");
        }
        sha = existing.sha;
      }

      const encodedPath = encodePathForGitHub(repositoryPath);
      await githubRequest(
        config,
        `/repos/${config.owner}/${config.repo}/contents/${encodedPath}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            message: `chore(processos): remove ${repositoryPath}`,
            sha,
            branch: config.branch,
          }),
        },
        [200],
      );

      return jsonResponse({ ok: true, repository_path: repositoryPath });
    }

    if (action === "download_file") {
      const repositoryPath = sanitizeRepositoryPath(asTrimmedString(payload.repository_path));
      ensurePathInsideBase(repositoryPath, config.basePath);

      const file = await getGithubFileContentMaybe(config, repositoryPath);
      if (!file || file.type !== "file") {
        throw new HttpError(404, "File not found in repository.");
      }

      if (!file.content) {
        throw new HttpError(502, "File content is not available.");
      }

      const fileName = asTrimmedString(file.name) || repositoryPath.split("/").pop() || "arquivo";
      return jsonResponse({
        ok: true,
        repository_path: repositoryPath,
        file_name: fileName,
        content_base64: file.content.replace(/\s/g, ""),
        content_type: guessContentType(fileName),
      });
    }

    throw new HttpError(400, `Unsupported action: ${action}`);
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Unknown error";

    return jsonResponse({ error: message }, 400);
  }
});
