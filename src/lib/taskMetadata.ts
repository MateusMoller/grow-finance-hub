const normalizeText = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const TASK_SECTOR_OPTIONS = [
  "Contabil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societario",
  "Geral",
] as const;

export type TaskSector = (typeof TASK_SECTOR_OPTIONS)[number];

const taskSectorLabels: Record<TaskSector, string> = {
  Contabil: "Cont\u00E1bil",
  Fiscal: "Fiscal",
  "Departamento Pessoal": "Departamento Pessoal",
  Financeiro: "Financeiro",
  Comercial: "Comercial",
  Societario: "Societ\u00E1rio",
  Geral: "Geral",
};

export const normalizeTaskSector = (value: string | null | undefined): TaskSector => {
  const normalized = normalizeText(value);

  if (normalized.includes("contabil")) return "Contabil";
  if (normalized.includes("fiscal")) return "Fiscal";
  if (normalized.includes("pessoal") || normalized === "dp") return "Departamento Pessoal";
  if (normalized.includes("finance")) return "Financeiro";
  if (normalized.includes("comercial")) return "Comercial";
  if (normalized.includes("societ")) return "Societario";
  return "Geral";
};

export const getTaskSectorLabel = (value: string | null | undefined) =>
  taskSectorLabels[normalizeTaskSector(value)];
