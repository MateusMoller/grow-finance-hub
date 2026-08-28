export type DctfwebCategory = "GERAL_MENSAL" | "PF_MENSAL" | "GERAL_ANUAL" | "ESPETACULO_DESPORTIVO";
export type DctfwebInput = { cnpj: string; competence: string; category: DctfwebCategory; receiptNumber?: string | null };
export type DctfwebArtifact = { base64: string; mimeType: string; receiptNumber?: string | null; metadata: Record<string, unknown> };
export type DctfwebTransmissionInput = DctfwebInput & { signedXmlBase64: string };
