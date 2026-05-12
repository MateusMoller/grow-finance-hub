import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
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
  return letters.length === 2 ? letters : null;
}

function normalizePhone(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  return number.length <= 8
    ? `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`
    : `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value)?.toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function isFreshCache(updatedAt: string) {
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return false;
  return Date.now() - updatedTime <= CACHE_TTL_HOURS * 60 * 60 * 1000;
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

    return {
      ok: true as const,
      status: response.status,
      data: await response.json(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseBrasilApiPayload(payload: JsonRecord) {
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

async function lookupCnpj(cnpj: string) {
  const response = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (response.ok) {
    const payload = asRecord(response.data);
    if (payload) {
      const parsed = parseBrasilApiPayload(payload);
      if (parsed) return parsed;
    }
  }

  throw new Error(
    response.ok
      ? "BrasilAPI retornou um payload incompleto para este CNPJ."
      : `Nao foi possivel consultar CNPJ agora. BrasilAPI HTTP ${response.status}.`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    if (rolesError) throw rolesError;

    const isInternal = (roleRows || []).some((row) => internalRoles.has(String(row.role || "")));
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

      if (cacheReadError) throw cacheReadError;

      if (cachedRow && isFreshCache(String(cachedRow.updated_at || ""))) {
        return jsonResponse({
          ok: true,
          cnpj,
          source: "cache",
          data: {
            legal_name: cachedRow.legal_name,
            trade_name: cachedRow.trade_name,
            main_cnae: cachedRow.main_cnae,
            cep: cachedRow.cep,
            street: cachedRow.street,
            number: cachedRow.number,
            neighborhood: cachedRow.neighborhood,
            city: cachedRow.city,
            state: cachedRow.state,
            phone: cachedRow.phone,
            email: cachedRow.email,
            source: cachedRow.source || "cache",
            raw_payload: (cachedRow.raw_payload as JsonRecord | null) || {},
          },
          cached_at: cachedRow.updated_at,
        });
      }
    }

    const lookupResult = await lookupCnpj(cnpj);

    const { error: cacheUpsertError } = await supabaseAdmin
      .from("cnpj_lookup_cache")
      .upsert({
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
      }, { onConflict: "cnpj" });

    if (cacheUpsertError) throw cacheUpsertError;

    return jsonResponse({
      ok: true,
      cnpj,
      source: lookupResult.source,
      data: lookupResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 400);
  }
});
