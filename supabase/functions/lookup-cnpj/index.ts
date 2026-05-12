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

const CACHE_TTL_HOURS = 24 * 7;
const FETCH_TIMEOUT_MS = 9000;

type JsonRecord = Record<string, unknown>;

type CnpjLookupResult = {
  legal_name: string | null;
  trade_name: string | null;
  main_cnae: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  raw_payload: JsonRecord;
};

type CacheRow = {
  cnpj: string;
  legal_name: string | null;
  trade_name: string | null;
  main_cnae: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  raw_payload: JsonRecord | null;
  updated_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
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

function normalizeCnpj(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function normalizeCep(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
}

function normalizeState(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const letters = text.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.length !== 2) return null;
  return letters;
}

function normalizePhone(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 8) {
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value)?.toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function mapCacheRowToResult(row: CacheRow): CnpjLookupResult {
  return {
    legal_name: row.legal_name,
    trade_name: row.trade_name,
    main_cnae: row.main_cnae,
    cep: row.cep,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    source: row.source || "cache",
    raw_payload: row.raw_payload || {},
  };
}

function isFreshCache(updatedAt: string) {
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return false;
  const maxAgeMs = CACHE_TTL_HOURS * 60 * 60 * 1000;
  return Date.now() - updatedTime <= maxAgeMs;
}

async function fetchJsonWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false as const, status: response.status, data: null };
    }

    const data = await response.json();
    return { ok: true as const, status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseBrasilApiPayload(payload: JsonRecord): CnpjLookupResult | null {
  const legalName = asTrimmedString(payload.razao_social);
  if (!legalName) return null;

  const ddd = asTrimmedString(payload.ddd_telefone_1)?.replace(/\D/g, "") || "";
  const phoneNumber = asTrimmedString(payload.telefone_1)?.replace(/\D/g, "") || "";
  const compositePhone = ddd || phoneNumber ? `${ddd}${phoneNumber}` : null;

  return {
    legal_name: legalName,
    trade_name: asTrimmedString(payload.nome_fantasia),
    main_cnae: asTrimmedString(payload.cnae_fiscal_descricao) || asTrimmedString(payload.cnae_fiscal),
    cep: normalizeCep(payload.cep),
    street: asTrimmedString(payload.logradouro),
    number: asTrimmedString(payload.numero),
    neighborhood: asTrimmedString(payload.bairro),
    city: asTrimmedString(payload.municipio),
    state: normalizeState(payload.uf),
    phone: normalizePhone(compositePhone),
    email: normalizeEmail(payload.email),
    source: "brasilapi",
    raw_payload: payload,
  };
}

async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const attempts: string[] = [];

  const brasilApiResponse = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (brasilApiResponse.ok && brasilApiResponse.data) {
    const payload = asRecord(brasilApiResponse.data);
    if (payload) {
      const parsed = parseBrasilApiPayload(payload);
      if (parsed) return parsed;
      attempts.push("BrasilAPI payload incompleto");
    } else {
      attempts.push("BrasilAPI payload invalido");
    }
  } else {
    attempts.push(`BrasilAPI HTTP ${brasilApiResponse.status}`);
  }

  throw new Error(`Nao foi possivel consultar CNPJ agora. Falhas: ${attempts.join(" | ")}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authorization token is required" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    if (rolesError) {
      throw rolesError;
    }

    const isInternal = (roleRows || []).some((row) => internalRoles.has(row.role));
    if (!isInternal) {
      return jsonResponse({ error: "Only internal roles can query CNPJ lookup" }, 403);
    }

    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const cnpj = normalizeCnpj(payload.cnpj);
    if (!cnpj) {
      return jsonResponse({ error: "Informe um CNPJ valido com 14 digitos." }, 400);
    }

    const forceRefresh = payload.force_refresh === true;

    if (!forceRefresh) {
      const { data: cachedRow, error: cacheReadError } = await supabaseAdmin
        .from("cnpj_lookup_cache")
        .select("cnpj, legal_name, trade_name, main_cnae, cep, street, number, neighborhood, city, state, phone, email, source, raw_payload, updated_at")
        .eq("cnpj", cnpj)
        .maybeSingle();

      if (cacheReadError) {
        throw cacheReadError;
      }

      if (cachedRow && isFreshCache(cachedRow.updated_at)) {
        return jsonResponse({
          ok: true,
          cnpj,
          source: "cache",
          data: mapCacheRowToResult(cachedRow as CacheRow),
          cached_at: cachedRow.updated_at,
        });
      }
    }

    const lookupResult = await lookupCnpj(cnpj);

    const cachePayload = {
      cnpj,
      legal_name: lookupResult.legal_name,
      trade_name: lookupResult.trade_name,
      main_cnae: lookupResult.main_cnae,
      cep: lookupResult.cep,
      street: lookupResult.street,
      number: lookupResult.number,
      neighborhood: lookupResult.neighborhood,
      city: lookupResult.city,
      state: lookupResult.state,
      phone: lookupResult.phone,
      email: lookupResult.email,
      source: lookupResult.source,
      raw_payload: lookupResult.raw_payload,
      updated_at: new Date().toISOString(),
    };

    const { error: cacheUpsertError } = await supabaseAdmin
      .from("cnpj_lookup_cache")
      .upsert(cachePayload, { onConflict: "cnpj" });

    if (cacheUpsertError) {
      throw cacheUpsertError;
    }

    return jsonResponse({
      ok: true,
      cnpj,
      source: lookupResult.source,
      data: lookupResult,
    });
  } catch (error: unknown) {
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
