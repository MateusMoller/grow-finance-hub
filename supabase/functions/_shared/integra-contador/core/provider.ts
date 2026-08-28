export type IntegraAction = "Apoiar" | "Consultar" | "Declarar" | "Emitir" | "Monitorar";
export type TaxIdentifier = { type: "CPF" | "CNPJ" | "CPF_BATCH" | "CNPJ_BATCH"; value: string };
export type FiscalAuthorizationContext = { connectionId: string; organizationId: string; clientId?: string; contractor: TaxIdentifier; requestAuthor: TaxIdentifier; taxpayer: TaxIdentifier; procuration?: { status: "valid" | "missing" | "expired" | "insufficient" | "pending_validation"; validUntil?: string } };
export type ProviderRequest<T=unknown> = { capabilityKey: string; authorization: FiscalAuthorizationContext; input: T; correlationId: string; requestId: string; requestTag: string };
export type ProviderResult<T=unknown> = { kind:"completed"; output:T; externalReference?:string; sourceUpdatedAt?:string } | { kind:"waiting_external"; protocol?:string; retryAt:string; etag?:string } | { kind:"no_content"; retryAt?:string; etag?:string };
export interface IntegraContadorProvider { execute<I,O>(request: ProviderRequest<I>): Promise<ProviderResult<O>> }
export type FiscalJobMessage = { jobId:string; organizationId:string; clientId?:string; capabilityKey:string; correlationId:string };
