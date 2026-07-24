import { describe, expect, it } from "vitest";

import {
  buildAutoActionRowId,
  buildTicketRowId,
  parseAutoServiceReplyId,
} from "../../functions/_shared/whatsapp-ticket/interactive-messages";

describe("WhatsApp interactive auto service", () => {
  it("parses ticket selections from official list rows", () => {
    const parsed = parseAutoServiceReplyId(buildTicketRowId("ticket-123"));

    expect(parsed.type).toBe("ticket");
    expect(parsed.id).toBe("ticket-123");
  });

  it("parses supported auto service actions", () => {
    const parsed = parseAutoServiceReplyId(buildAutoActionRowId("requests"));

    expect(parsed.type).toBe("action");
    expect(parsed.action).toBe("requests");
  });

  it("keeps legacy auto service actions compatible", () => {
    const parsed = parseAutoServiceReplyId(buildAutoActionRowId("new_request"));

    expect(parsed.type).toBe("action");
    expect(parsed.action).toBe("new_request");
  });

  it("parses the requests flow actions", () => {
    const consultTasks = parseAutoServiceReplyId(buildAutoActionRowId("consult_tasks"));
    const createTask = parseAutoServiceReplyId(buildAutoActionRowId("create_task"));

    expect(consultTasks.type).toBe("action");
    expect(consultTasks.action).toBe("consult_tasks");
    expect(createTask.type).toBe("action");
    expect(createTask.action).toBe("create_task");
  });
});
