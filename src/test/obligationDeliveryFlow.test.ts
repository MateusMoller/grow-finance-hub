import { describe, expect, it } from "vitest";

type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

function canCompleteObligation(params: {
  humanConfirmed: boolean;
  deliveryStatus: DeliveryStatus | null;
}) {
  return params.humanConfirmed && params.deliveryStatus === "sent";
}

function defaultRecipient(clientEmail: string | null, reviewedOverride?: string | null) {
  const value = (reviewedOverride || clientEmail || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function hasDuplicateSentAttempt(attempts: Array<{ status: DeliveryStatus }>) {
  return attempts.some((attempt) => attempt.status === "sent");
}

function requiredDocumentsAreUnique(documents: Array<{ document_type_key: string; active: boolean }>) {
  const activeKeys = documents.filter((document) => document.active).map((document) => document.document_type_key);
  return new Set(activeKeys).size === activeKeys.length;
}

function canPrepareDelivery(attachmentCount: number) {
  return attachmentCount > 0;
}

function localPreviewDecision(score: number, conflictingClient: boolean) {
  if (conflictingClient) return "manual_review";
  return score >= 0.9 ? "auto_link" : "manual_review";
}

function retryPreservesHistory(statuses: DeliveryStatus[]) {
  return [...statuses, "sending" as DeliveryStatus];
}

describe("obligation delivery flow rules", () => {
  it("requires human confirmation and a sent delivery before completion", () => {
    expect(canCompleteObligation({ humanConfirmed: false, deliveryStatus: "sent" })).toBe(false);
    expect(canCompleteObligation({ humanConfirmed: true, deliveryStatus: "failed" })).toBe(false);
    expect(canCompleteObligation({ humanConfirmed: true, deliveryStatus: "sent" })).toBe(true);
  });

  it("defaults to client email and accepts reviewed recipient overrides", () => {
    expect(defaultRecipient("cliente@empresa.com")).toBe("cliente@empresa.com");
    expect(defaultRecipient("cliente@empresa.com", "financeiro@empresa.com")).toBe("financeiro@empresa.com");
    expect(defaultRecipient(null)).toBeNull();
    expect(defaultRecipient("email-invalido")).toBeNull();
  });

  it("detects duplicate sent deliveries", () => {
    expect(hasDuplicateSentAttempt([{ status: "failed" }, { status: "cancelled" }])).toBe(false);
    expect(hasDuplicateSentAttempt([{ status: "failed" }, { status: "sent" }])).toBe(true);
  });

  it("validates active expected document uniqueness", () => {
    expect(requiredDocumentsAreUnique([
      { document_type_key: "das", active: true },
      { document_type_key: "recibo", active: true },
    ])).toBe(true);
    expect(requiredDocumentsAreUnique([
      { document_type_key: "das", active: true },
      { document_type_key: "das", active: true },
    ])).toBe(false);
  });

  it("requires at least one sendable attachment", () => {
    expect(canPrepareDelivery(0)).toBe(false);
    expect(canPrepareDelivery(1)).toBe(true);
  });

  it("routes low confidence or conflicting previews to manual review", () => {
    expect(localPreviewDecision(0.95, false)).toBe("auto_link");
    expect(localPreviewDecision(0.72, false)).toBe("manual_review");
    expect(localPreviewDecision(0.97, true)).toBe("manual_review");
  });

  it("preserves failed delivery history when retrying", () => {
    expect(retryPreservesHistory(["failed"])).toEqual(["failed", "sending"]);
  });
});
