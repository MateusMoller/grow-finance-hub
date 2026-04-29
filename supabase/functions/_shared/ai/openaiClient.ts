const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_AI_MODEL = "gpt-5.4-mini";

export class OpenAIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIConfigurationError";
  }
}

export class OpenAIRequestError extends Error {
  status: number;
  requestId: string | null;
  details: unknown;

  constructor(message: string, options: { status: number; requestId?: string | null; details?: unknown }) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? null;
  }
}

export type OpenAIResponsesToolDefinition = {
  type: "function";
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type OpenAIResponsePayload = {
  id?: string;
  model?: string;
  output?: Array<Record<string, unknown>>;
  output_text?: string;
  usage?: Record<string, unknown>;
  error?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CreateOpenAIResponseParams = {
  model?: string;
  instructions?: string;
  input: unknown;
  tools?: OpenAIResponsesToolDefinition[];
  tool_choice?: unknown;
  text?: Record<string, unknown>;
  metadata?: Record<string, string>;
  max_output_tokens?: number;
  parallel_tool_calls?: boolean;
  temperature?: number;
  store?: boolean;
  reasoning?: Record<string, unknown>;
  previous_response_id?: string;
};

function assertBackendOnlyRuntime() {
  if (typeof window !== "undefined") {
    throw new OpenAIConfigurationError(
      "openaiClient must run only in a trusted backend runtime. Do not import it in client-side code.",
    );
  }
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new OpenAIConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}

export function getOpenAIConfig() {
  assertBackendOnlyRuntime();

  return {
    apiKey: readRequiredEnv("OPENAI_API_KEY"),
    baseUrl: readOptionalEnv("OPENAI_BASE_URL") ?? DEFAULT_OPENAI_BASE_URL,
    defaultModel: readOptionalEnv("AI_DEFAULT_MODEL") ?? DEFAULT_AI_MODEL,
  };
}

function buildOpenAIErrorMessage(payload: unknown, fallbackStatus: number) {
  if (payload && typeof payload === "object") {
    const maybeError = (payload as { error?: unknown }).error;
    if (maybeError && typeof maybeError === "object") {
      const message = (maybeError as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message.trim();
      }
    }
  }

  return fallbackStatus >= 500
    ? "OpenAI request failed due to an upstream server error."
    : "OpenAI request failed.";
}

async function parseJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createOpenAIResponse(
  params: CreateOpenAIResponseParams,
): Promise<OpenAIResponsePayload> {
  const config = getOpenAIConfig();
  const requestBody: Record<string, unknown> = {
    model: params.model ?? config.defaultModel,
    input: params.input,
  };

  if (params.instructions) requestBody.instructions = params.instructions;
  if (params.tools && params.tools.length > 0) requestBody.tools = params.tools;
  if (params.tool_choice) requestBody.tool_choice = params.tool_choice;
  if (params.text) requestBody.text = params.text;
  if (params.metadata) requestBody.metadata = params.metadata;
  if (typeof params.max_output_tokens === "number") requestBody.max_output_tokens = params.max_output_tokens;
  if (typeof params.parallel_tool_calls === "boolean") requestBody.parallel_tool_calls = params.parallel_tool_calls;
  if (typeof params.temperature === "number") requestBody.temperature = params.temperature;
  if (typeof params.store === "boolean") requestBody.store = params.store;
  if (params.reasoning) requestBody.reasoning = params.reasoning;
  if (params.previous_response_id) requestBody.previous_response_id = params.previous_response_id;

  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const requestId = response.headers.get("x-request-id");
  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw new OpenAIRequestError(buildOpenAIErrorMessage(payload, response.status), {
      status: response.status,
      requestId,
      details: payload,
    });
  }

  if (!payload || typeof payload !== "object") {
    throw new OpenAIRequestError("OpenAI returned an invalid JSON payload.", {
      status: 502,
      requestId,
    });
  }

  return payload as OpenAIResponsePayload;
}

export function extractResponseText(response: OpenAIResponsePayload) {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!entry || typeof entry !== "object") continue;
      const text = (entry as { text?: unknown }).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text.trim();
      }
    }
  }

  return "";
}
