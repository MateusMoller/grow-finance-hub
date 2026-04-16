export const clientSegmentOptions = [
  "Comércio",
  "Industria",
  "Serviços",
  "Tecnologia",
  "Saúde",
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
