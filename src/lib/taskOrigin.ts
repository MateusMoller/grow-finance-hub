export type TaskOrigin = "portal" | "obrigacoes" | "interno";

interface ResolveTaskOriginInput {
  requestId?: string | null;
  integrationSource?: string | null;
  integrationTaskId?: string | null;
}

const normalizeOriginText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const resolveTaskOrigin = ({ requestId, integrationSource, integrationTaskId }: ResolveTaskOriginInput): TaskOrigin => {
  if (requestId && requestId.trim()) {
    return "portal";
  }

  const normalizedSource = normalizeOriginText(integrationSource);
  const normalizedTaskId = normalizeOriginText(integrationTaskId);
  if (
    normalizedSource.includes("acessorias") ||
    normalizedSource.includes("obrigac") ||
    normalizedSource.includes("obligation") ||
    normalizedTaskId.startsWith("instance:")
  ) {
    return "obrigacoes";
  }

  return "interno";
};

export const taskOriginMeta: Record<
  TaskOrigin,
  {
    label: string;
    ribbonClass: string;
    glowClass: string;
  }
> = {
  portal: {
    label: "Portal do Cliente",
    ribbonClass: "from-red-500 via-red-500 to-rose-700",
    glowClass: "bg-red-500/20",
  },
  obrigacoes: {
    label: "Obrigações Acessórias",
    ribbonClass: "from-amber-300 via-yellow-400 to-amber-500",
    glowClass: "bg-amber-400/25",
  },
  interno: {
    label: "Criação Interna",
    ribbonClass: "from-sky-400 via-blue-500 to-indigo-600",
    glowClass: "bg-blue-500/20",
  },
};
