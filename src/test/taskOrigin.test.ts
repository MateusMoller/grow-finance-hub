import { describe, expect, it } from "vitest";

import { resolveTaskOrigin } from "@/lib/taskOrigin";

describe("resolveTaskOrigin", () => {
  it("classifica a fonte atual de obrigações", () => {
    expect(resolveTaskOrigin({ integrationSource: "grow_obligation_task" })).toBe("obrigacoes");
  });

  it("reconhece tarefas legadas pelo vínculo com a competência", () => {
    expect(resolveTaskOrigin({ integrationTaskId: "instance:00000000-0000-0000-0000-000000000001" })).toBe("obrigacoes");
  });

  it("mantém solicitações do portal com precedência", () => {
    expect(
      resolveTaskOrigin({
        requestId: "request-1",
        integrationSource: "grow_obligation_task",
        integrationTaskId: "instance:1",
      }),
    ).toBe("portal");
  });

  it("usa criação interna quando não há integração", () => {
    expect(resolveTaskOrigin({})).toBe("interno");
  });
});
