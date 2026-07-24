const PUBLIC_PROTOCOL_PATTERN = /^WAT-\d{6}-[A-Z0-9]{6}$/;

export function buildPublicTicketProtocol(input: {
  openedAt?: Date;
  sequence: number;
  suffix?: string;
}): string {
  const date = input.openedAt ?? new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const suffix = (input.suffix ?? input.sequence.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, "");

  return `WAT-${year}${month}-${suffix.padStart(6, "0").slice(-6)}`;
}

export function isValidPublicTicketProtocol(protocol: string | null | undefined): boolean {
  return PUBLIC_PROTOCOL_PATTERN.test(String(protocol ?? "").trim().toUpperCase());
}

export function extractPublicTicketProtocol(text: string | null | undefined): string | null {
  const match = String(text ?? "").toUpperCase().match(/WAT-\d{6}-[A-Z0-9]{6}/);
  return match?.[0] ?? null;
}
