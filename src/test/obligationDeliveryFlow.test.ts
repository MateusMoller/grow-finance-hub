import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { groupCentralDeliveries } from "@/lib/obligationCentralDelivery";

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
  const backendSource = readFileSync("supabase/functions/grow-obligations-module/index.ts", "utf8");
  const accessSource = readFileSync("supabase/functions/obligation-document-access/index.ts", "utf8");
  const webhookSource = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  it("groups files from the same obligation into one central delivery", () => {
    expect(groupCentralDeliveries([
      { instanceId: "instance-a", inboxItemId: "file-1", resultIndex: 0 },
      { instanceId: "instance-a", inboxItemId: "file-2", resultIndex: 1 },
    ])).toEqual([{
      instanceId: "instance-a",
      inboxItemIds: ["file-1", "file-2"],
      resultIndexes: [0, 1],
    }]);
  });

  it("keeps different obligations in separate deliveries and removes duplicates", () => {
    expect(groupCentralDeliveries([
      { instanceId: "instance-a", inboxItemId: "file-1", resultIndex: 0 },
      { instanceId: "instance-a", inboxItemId: "file-1", resultIndex: 0 },
      { instanceId: "instance-b", inboxItemId: "file-2", resultIndex: 1 },
    ])).toEqual([
      { instanceId: "instance-a", inboxItemIds: ["file-1"], resultIndexes: [0] },
      { instanceId: "instance-b", inboxItemIds: ["file-2"], resultIndexes: [1] },
    ]);
  });

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

  it("accepts a deterministic CNPJ, competence and document-family route", () => {
    expect(backendSource).toContain("const hasDeterministicBusinessRoute = Boolean(");
    expect(backendSource).toContain("hasDeterministicBusinessRoute ||");
    expect(backendSource).toContain("best.familyMatched &&");
    expect(backendSource).toContain("!best.familyMismatched");
    expect(backendSource).toContain("const autoLinked = Boolean(match.resolvedInstanceId && !match.reviewRequired)");
    expect(backendSource).not.toContain("match.score >= 0.9");
  });

  it("preserves failed delivery history when retrying", () => {
    expect(retryPreservesHistory(["failed"])).toEqual(["failed", "sending"]);
  });

  it("sends WhatsApp deliveries with the same secure-link audit flow", () => {
    expect(backendSource).toContain('prepared.deliveryChannel === "whatsapp" ? "whatsapp_link" : "email_link"');
    expect(backendSource).toContain("sendObligationWhatsAppText(supabaseAdmin");
    expect(backendSource).toContain("dispatchWhatsAppTemplateMessage");
    expect(backendSource).toContain("WHATSAPP_OBLIGATION_TEMPLATE_NAME");
    expect(backendSource).toContain("hasOpenWhatsAppCustomerWindow");
    expect(backendSource).toContain("recipient_phone: prepared.recipientPhone");
    expect(accessSource).toContain('"obligation_delivery_whatsapp"');
    expect(backendSource).toContain('action === "send_configured_delivery"');
    expect(backendSource).toContain('if (asBoolean(template.completion_email_enabled, false)) configuredChannels.push("email")');
    expect(backendSource).toContain('if (asBoolean(template.completion_whatsapp_enabled, false)) configuredChannels.push("whatsapp")');
    expect(backendSource).toContain('const deliveryRequired = template.completion_email_enabled || template.completion_whatsapp_enabled');
    expect(backendSource).toContain('action: "send_configured_delivery"');
    expect(backendSource).toContain('normalizeBrazilWhatsAppRecipient(entries.get("whatsapp"))');
    expect(backendSource).toContain('normalizeBrazilWhatsAppRecipient(combineDddAndPhone(entries.get("ddd"), entries.get("telefone")))');
    expect(backendSource).toContain('new Uint8Array(16)');
    expect(backendSource).toContain('/functions/v1/d?t=');
    expect(backendSource).not.toContain("Documentos disponíveis por 30 dias");
    expect(backendSource).not.toContain("Acesse os documentos pelos links seguros abaixo");
    expect(backendSource).toContain("confirm_duplicate: true");
    expect(backendSource).toContain('const deliveryRequestKey = robotSubmissionId ? `robot:${robotSubmissionId}` : `inbox:${inboxItem.id}`');
    expect(backendSource).toContain("idempotency_key: baseIdempotencyKey ? `${baseIdempotencyKey}:${channel}` : null");
    expect(backendSource).toContain("idempotent: true");
    expect(webhookSource).toContain('from("obligation_delivery_attempts")');
    expect(webhookSource).toContain("whatsapp_delivery_status: status.deliveryStatus");
    expect(webhookSource).toContain('status: "failed"');
  });

  it("requires and renders the document link placeholder at the selected message position", () => {
    expect(backendSource).toContain('const DOCUMENT_LINK_PLACEHOLDER = "{{documento_link}}"');
    expect(backendSource).toContain("hasRequiredDocumentLinkPlaceholder(emailBody)");
    expect(backendSource).toContain("hasRequiredDocumentLinkPlaceholder(whatsappBody)");
    expect(backendSource).toContain("body.replaceAll(DOCUMENT_LINK_PLACEHOLDER, list)");
    expect(backendSource).toContain(".split(DOCUMENT_LINK_PLACEHOLDER)");
    expect(backendSource).not.toContain("appendDocumentLinksToText");
  });
});
