const extractFunctionErrorPayload = async (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;

  const payload = await context.clone().json().catch(() => null);
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { error?: unknown; message?: unknown }).error ?? (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
};

export async function throwDetailedFunctionError(error: unknown): Promise<never> {
  const payloadMessage = await extractFunctionErrorPayload(error);
  if (payloadMessage) throw new Error(payloadMessage);
  if (error instanceof Error) throw error;
  throw new Error("Nao foi possivel concluir a acao.");
}
