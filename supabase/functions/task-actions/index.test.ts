import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTaskAction } from "../_shared/task-authorization.ts";

Deno.test("accepts only canonical task actions", () => {
  assertEquals(isTaskAction("task.change_status"), true);
  assertEquals(isTaskAction("task.truncate"), false);
});
