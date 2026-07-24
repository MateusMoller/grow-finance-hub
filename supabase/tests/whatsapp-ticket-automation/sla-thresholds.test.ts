import { describe, expect, it } from "vitest";

import { getSlaState } from "../../functions/_shared/whatsapp-ticket/sla";

describe("getSlaState", () => {
  it("marks running SLA as breached after due date", () => {
    expect(getSlaState(new Date("2026-07-23T12:00:00Z"), new Date("2026-07-23T10:00:00Z"), false, false)).toBe("breached");
  });

  it("pauses SLA while waiting for customer", () => {
    expect(getSlaState(new Date("2026-07-23T12:00:00Z"), new Date("2026-07-23T10:00:00Z"), true, false)).toBe("paused_waiting_customer");
  });
});
