export function applyOrganizationScope<T>(query: T, organizationId: string | null | undefined): T {
  if (!organizationId) return query;
  return (query as { eq: (column: string, value: string) => T }).eq("organization_id", organizationId);
}

export function withOrganizationId<T extends Record<string, unknown>>(
  payload: T,
  organizationId: string | null | undefined,
) {
  if (!organizationId) return payload;
  return {
    ...payload,
    organization_id: organizationId,
  };
}
