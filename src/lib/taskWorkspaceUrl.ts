export const buildTaskWorkspaceSearch = (
  currentSearch: string,
  taskId: string | null,
) => {
  const params = new URLSearchParams(currentSearch);

  if (taskId) {
    params.set("task", taskId);
  } else {
    params.delete("task");
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
};
