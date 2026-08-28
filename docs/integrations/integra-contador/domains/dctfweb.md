# DCTFWeb domain checklist

- Version: 1.0 / 2026-08-21
- Services: GERARGUIA31, GERARGUIAANDAMENTO313, CONSRECIBO32, CONSDECCOMPLETA33, CONSXMLDECLARACAO38, TRANSDECLARACAO310
- Preconditions: tenant task/instance/client match, valid monthly competence, authorization and enabled capability
- Idempotency: organization+dossier+service+approved-version/input hash
- Storage: private obligation-files; XML/PDF content excluded from logs
- Retry: reads may retry bounded; emission/transmission consult state after ambiguous response
- Human review: required for DARF and transmission; transmission disabled by default
- Regression: PGDAS-D, DEFIS and generic tasks must remain unchanged
