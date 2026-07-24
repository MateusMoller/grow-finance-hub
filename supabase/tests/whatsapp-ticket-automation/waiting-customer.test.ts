import { describe, expect, it } from "vitest";

import { formatTaskCustomerMessage } from "../../functions/_shared/whatsapp-ticket/task-chat";

describe("task customer chat", () => {
  it("formats outbound messages with ticket, task and attendant context", () => {
    const text = formatTaskCustomerMessage({
      ticketProtocol: "WAT-202607-ABC123",
      taskTitle: "Regularizar DAS",
      attendantName: "Aline",
      message: "Pode enviar a guia?",
    });

    expect(text).toContain("*Ticket:* #WAT-202607-ABC123");
    expect(text).toContain("*Atendente:* Aline");
    expect(text).toContain("Pode enviar a guia?");
  });
});
