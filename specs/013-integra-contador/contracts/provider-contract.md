# Contract: Integra Contador Provider Boundary

## Purpose

Define the only boundary through which fiscal domains communicate with Integra Contador. Domain/workflow code never assembles OAuth, certificate, headers, external routes, `idSistema`, `idServico`, version or serialized `pedidoDados.dados`.

## Provider interface

```ts
type IntegraAction = "Apoiar" | "Consultar" | "Declarar" | "Emitir" | "Monitorar";

type TaxIdentifier = {
  type: "CPF" | "CNPJ" | "CPF_BATCH" | "CNPJ_BATCH";
  value: string;
};

// value is canonical digit-only text (11 characters for CPF, 14 for CNPJ).
// Leading zeros are significant; length/check digits are validated before construction.

type FiscalAuthorizationContext = {
  connectionId: string;
  contractor: TaxIdentifier;
  requestAuthor: TaxIdentifier;
  taxpayer: TaxIdentifier;
  procuration?: {
    status: "valid" | "missing" | "expired" | "insufficient" | "pending_validation";
    validUntil?: string;
    authorizationReference?: string;
  };
};

type ProviderRequest<TInput> = {
  capabilityKey: string;
  authorization: FiscalAuthorizationContext;
  input: TInput;
  correlationId: string;
  requestId: string;
  requestTag: string;
};

type ProviderResult<TOutput> =
  | { kind: "completed"; output: TOutput; externalReference?: string; sourceUpdatedAt?: string }
  | { kind: "waiting_external"; protocol?: string; retryAt: string; etag?: string }
  | { kind: "no_content"; retryAt?: string; etag?: string };

interface IntegraContadorProvider {
  execute<TInput, TOutput>(request: ProviderRequest<TInput>): Promise<ProviderResult<TOutput>>;
}
```

## Service registry contract

Each capability has one immutable registry entry per adapter version:

```ts
type ServiceRegistryEntry = {
  capabilityKey: string;
  domain: string;
  operation: string;
  action: IntegraAction;
  externalSystemId: string;
  externalServiceId: string;
  externalVersion: string;
  adapterVersion: string;
  requiresProcuration: boolean;
  cachePolicy: "static" | "semi_static" | "transactional" | "real_time";
  retryPolicy: "read_default" | "async_poll" | "no_automatic_retry";
  idempotencyPolicy: "fingerprint" | "external_effect";
  monitoringCapability?: string;
  storesRawPayload: boolean;
};
```

External identifiers marked `EXTERNAL_CONTRACT_PENDING` must not be invented. The real-provider registry refuses to start a capability whose verified values are absent.

## Envelope responsibility

Only `SerproIntegraContadorProvider` may translate the provider request to:

```json
{
  "contratante": {},
  "autorPedidoDados": {},
  "contribuinte": {},
  "pedidoDados": {
    "idSistema": "registry-owned",
    "idServico": "registry-owned",
    "versaoSistema": "registry-owned",
    "dados": "serialized-json-string"
  }
}
```

## Authentication contract

- Obtain Consumer Key/Secret and certificate through backend providers.
- Use OAuth2 client credentials with mutual TLS.
- Cache both access and JWT tokens until the provider `expires_in` minus configured margin.
- Send access token and the verified JWT header name required by the contracted environment.
- On 401: invalidate shared token, refresh once and replay once.
- Never return tokens or secret material from this boundary.

## Error contract

```ts
type FiscalIntegrationErrorCode =
  | "SERPRO_AUTHENTICATION"
  | "SERPRO_AUTHORIZATION"
  | "SERPRO_VALIDATION"
  | "SERPRO_RATE_LIMIT"
  | "SERPRO_TEMPORARY"
  | "SERPRO_BUSINESS"
  | "SERPRO_TIMEOUT"
  | "SERPRO_UNAVAILABLE"
  | "PROCURATION_REQUIRED"
  | "CERTIFICATE_INVALID"
  | "EXTERNAL_CONTRACT_UNVERIFIED";
```

Every thrown integration error includes safe code, retry classification, user-action classification, correlation ID and request ID. It excludes raw request/response, tokens and certificate data.

## HTTP outcome mapping

| Provider outcome | Internal result |
|---|---|
| 200 | completed |
| 202 | waiting_external using provider wait |
| 204 | no_content/waiting using response header guidance |
| 304 | cached/not modified according to capability |
| 400 | non-retryable validation/business error |
| 401 | refresh once; then authentication failure |
| 403 | authorization/procuration requires action |
| 404 | capability-specific no-result; never blind retry |
| 429 | rate limited; reschedule outside documented window |
| 500/503/timeout | bounded temporary retry with jitter |

## Fake provider

The fake accepts fixture scenarios by capability and produces the same `ProviderResult`/error types. It must simulate completed, waiting, no-content, authorization, rate limit, timeout, duplicate and malformed-response cases.

## Pilot normalized contract

```ts
type CaixaPostalIndicatorInput = {
  taxpayer: TaxIdentifier;
};

type CaixaPostalIndicator = {
  hasNewMessages: boolean;
  indicatorCode?: string;
  sourceUpdatedAt?: string;
};
```

No message content is part of the pilot output.
