import type { PrimaryRole } from "@/lib/userPermissions";

export interface PortalClientChoice {
  id: string;
}

export const buildPortalDataQueryKey = (
  userId: string | null | undefined,
  selectedClientId: string | null | undefined,
  primaryRole: PrimaryRole | "legacy" | null | undefined,
) => [
  "portal-cliente",
  userId || "anonymous",
  selectedClientId || "auto",
  primaryRole || "legacy",
] as const;

export const resolveSelectedPortalClient = <TClient extends PortalClientChoice>(
  clients: readonly TClient[],
  selectedClientId: string | null | undefined,
  storedClientId: string | null | undefined,
) =>
  clients.find((client) => client.id === selectedClientId) ||
  clients.find((client) => client.id === storedClientId) ||
  clients[0] ||
  null;
