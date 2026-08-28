# Storage Policy Matrix

Evidence sources: `src/lib/fileUploadSecurity.ts`, Storage references from `npm run security:inventory`.

## Upload Baseline

| Control | Current baseline |
| --- | --- |
| Allowed extensions | pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt |
| Allowed MIME types | PDF, PNG, JPEG, WebP, Word, Excel, CSV, plain text |
| Max file size | 10 MB |
| Filename handling | `sanitizeStorageFilename` and `buildSecureStoragePath` sanitize path segments |
| Blocked examples | exe, bat, cmd, js, sh and unknown extensions |

## Bucket Requirements

| Bucket class | Public | Requirements |
| --- | --- | --- |
| Client documents | No | RLS/Storage policy, signed URL, upload/download audit. |
| Payroll documents | No | Department and client scoping, signed URL, strict retention. |
| Tax guides/reports | No | Organization/client scoping and download audit. |
| Public assets | Yes | No sensitive client, payroll or financial data. |

## Current Validation Status

- Bucket privacy and policies require staging validation.
- Dynamic bucket references must be resolved manually by reviewing generated `storage:*` rows in `security-control-matrix.md`.
- Legacy document/process flows must be treated as high or critical until unauthorized download tests pass.

## Code Evidence

- `src/pages/PortalClientePage.tsx` uploads to `client-documents`, creates 120-second signed URLs for downloads and records `portal_document_uploaded` audit rows.
- `src/pages/ClientDetailPage.tsx` validates files with `validateSecureDocument`, uploads to `client-files` and performs direct downloads from that bucket.
- `src/components/obligations/GrowObligationsWorkspace.tsx`, `supabase/functions/acessorias-module/index.ts` and `supabase/functions/grow-obligations-module/index.ts` are included in the generated Storage inventory and require policy validation.
- Unauthorized download, expired signed URL and invalid file type checks are documented in `docs/security/manual-scenarios/storage-documents.md`.

## Integra Contador (feature 013)

The Caixa Postal pilot stores only the normalized new-message indicator and creates no bucket or object path. `fiscal_documents.storage_bucket/storage_path` remain unused in this slice. A future document capability must first define a private bucket, tenant/client policies, signed URL lifetime, file validation, retention and audited portal publication.
- Supabase connector confirmed `storage.buckets` and `storage.objects` have RLS enabled in the active project. This proves RLS is enabled, but not that bucket policies reject unauthorized private object access.

## Integra Contador (feature 013)

The Caixa Postal pilot persists only the normalized new-message indicator and does not fetch or store message content or documents. It therefore creates no bucket, object path or portal publication policy. `fiscal_documents.storage_bucket/storage_path` remain reserved and null for this slice. Any future document-producing capability must define a private bucket, tenant/client-scoped policies, signed-URL lifetime, malware/type validation, retention and audited publication before activation.
