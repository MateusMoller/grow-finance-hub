export const integraContadorKeys = {
  connection: (organizationId: string) => ["integra-contador", organizationId, "connection"] as const,
  clientFiscalStatus: (organizationId: string, clientId: string) => ["integra-contador", organizationId, clientId, "fiscal-status"] as const,
  runs: (organizationId:string,filters:unknown) => ["integra-contador",organizationId,"sync-runs",filters] as const,
  summary: (organizationId:string) => ["integra-contador",organizationId,"summary"] as const,
  clients: (organizationId:string,offset:number) => ["integra-contador",organizationId,"clients",offset] as const,
  simplesDossiers: (organizationId:string) => ["integra-contador",organizationId,"simples-nacional","dossiers"] as const,
  simplesClients: (organizationId:string) => ["integra-contador",organizationId,"simples-nacional","clients"] as const,
};
