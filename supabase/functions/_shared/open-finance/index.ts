import { createOpeniAdapter } from "./openi.ts";
import { createPluggyAdapter } from "./pluggy.ts";
import type { OpenFinanceProvider, ProviderAdapter } from "./types.ts";

export function parseProvider(value: unknown): OpenFinanceProvider {
  const token = String(value || "").trim().toLowerCase();
  if (token === "pluggy" || token === "openi") return token;
  throw new Error("Unsupported provider. Use pluggy or openi.");
}

export function getProviderAdapter(provider: OpenFinanceProvider): ProviderAdapter {
  if (provider === "pluggy") return createPluggyAdapter();
  if (provider === "openi") return createOpeniAdapter();
  throw new Error(`Unsupported provider: ${provider}`);
}

export * from "./types.ts";
export * from "./http.ts";
