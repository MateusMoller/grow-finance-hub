import { describe, expect, it } from "vitest";

import { buildTaskWorkspaceSearch } from "@/lib/taskWorkspaceUrl";

describe("buildTaskWorkspaceSearch", () => {
  it("adds the selected task while preserving the current view and filters", () => {
    expect(
      buildTaskWorkspaceSearch("?view=list&sector=Fiscal", "task-123"),
    ).toBe("?view=list&sector=Fiscal&task=task-123");
  });

  it("replaces the selected task without duplicating the parameter", () => {
    expect(buildTaskWorkspaceSearch("?task=old-task", "new-task")).toBe(
      "?task=new-task",
    );
  });

  it("removes only the task parameter when the detail closes", () => {
    expect(
      buildTaskWorkspaceSearch("?view=list&task=task-123&sector=Fiscal", null),
    ).toBe("?view=list&sector=Fiscal");
  });

  it("returns an empty search when task was the only parameter", () => {
    expect(buildTaskWorkspaceSearch("?task=task-123", null)).toBe("");
  });
});
