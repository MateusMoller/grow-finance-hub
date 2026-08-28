import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasValidSystemContext } from "./task-authorization.ts";

Deno.test("system context requires idempotency and technical link", () => {
  assertEquals(hasValidSystemContext({ kind: "system", source: "grow_obligations", idempotencyKey: "short", technicalLink: {} }), false);
  assertEquals(hasValidSystemContext({ kind: "system", source: "grow_obligations", idempotencyKey: "obligation:123", technicalLink: { instanceId: "123" } }), true);
});
