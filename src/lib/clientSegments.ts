export const clientSegmentOptions = [
  "Vestuario",
  "Alimenticio",
  "Farmacia",
  "Representacao Comercial",
  "Guincho",
  "Auto Pecas",
  "Arquitetura",
  "Calcadista",
  "Engenharia",
  "Holding",
  "Imobiliaria",
  "Posto de Combustivel",
  "Oficina",
  "Confeccao",
  "Grafica",
  "Tecnologia",
  "Saude",
  "Educacao",
  "Construcao",
  "Agronegocio",
  "Transporte e Logistica",
  "Outros",
] as const;

export function getClientSegmentOptions(currentSegment?: string | null): string[] {
  const current = (currentSegment || "").trim();
  const baseOptions = [...clientSegmentOptions] as string[];

  if (!current || baseOptions.includes(current)) {
    return baseOptions;
  }

  return [current, ...baseOptions];
}
