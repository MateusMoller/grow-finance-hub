const SENSITIVE =
  /(authorization|token|secret|password|certificate|consumer.?key|cpf|cnpj|taxpayer|payload)/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map((
        [k, v],
      ) => [k, SENSITIVE.test(k) ? "[REDACTED]" : redact(v)]),
    );
  }
  return value;
}
export function safeLog(event: string, fields: Record<string, unknown> = {}) {
  const safeFields = redact(fields) as Record<string, unknown>;
  console.log(JSON.stringify({ event, ...safeFields }));
}
