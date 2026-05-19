export const clientSegmentOptions = [
  "Advocacia",
  "Agronegocio",
  "Alimenticio",
  "Arquitetura",
  "Auto Pecas",
  "Calcadista",
  "Confeccao",
  "Consultoria",
  "Construcao",
  "Educacao",
  "Engenharia",
  "Farmacia",
  "Grafica",
  "Guincho",
  "Holding",
  "Hotel",
  "Imobiliaria",
  "Mercado",
  "Metalurgica",
  "Oficina",
  "Outros",
  "Posto de Combustivel",
  "Publicidade",
  "Representacao Comercial",
  "Saude",
  "Tecnologia",
  "Transporte e Logistica",
  "Vestuario",
] as const;

export function getClientSegmentOptions(currentSegment?: string | null): string[] {
  const current = (currentSegment || "").trim();
  const baseOptions = [...clientSegmentOptions] as string[];

  if (!current || baseOptions.includes(current)) {
    return baseOptions;
  }

  return [current, ...baseOptions];
}
