export type WhatsAppContactLinkState = {
  clientId?: string | null;
  autoLinkSource?: "unique_phone_match" | "manual" | null;
  matchStatus?: "matched" | "unmatched" | "manual" | "conflict" | null;
};

export function normalizeWhatsAppPhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export function buildPhoneMatchCandidates(value: string | null | undefined): string[] {
  const normalized = normalizeWhatsAppPhone(value);
  if (!normalized) {
    return [];
  }

  const withoutCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  const candidates = new Set([normalized, withoutCountry]);

  if (withoutCountry.length === 11 && withoutCountry[2] === "9") {
    candidates.add(`55${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
    candidates.add(`${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
  }

  return [...candidates].filter(Boolean);
}

export function shouldPreserveManualClientLink(contact: WhatsAppContactLinkState): boolean {
  return Boolean(contact.clientId && (contact.autoLinkSource === "manual" || contact.matchStatus === "manual"));
}

export function chooseSafeClientMatch(
  candidateClientIds: Array<string | null | undefined>,
): { clientId: string | null; matchStatus: "matched" | "unmatched" | "conflict" } {
  const uniqueIds = [...new Set(candidateClientIds.filter((id): id is string => Boolean(id)))];

  if (uniqueIds.length === 1) {
    return { clientId: uniqueIds[0], matchStatus: "matched" };
  }

  if (uniqueIds.length > 1) {
    return { clientId: null, matchStatus: "conflict" };
  }

  return { clientId: null, matchStatus: "unmatched" };
}
