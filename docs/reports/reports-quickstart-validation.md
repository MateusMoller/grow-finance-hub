# Reports Quickstart Validation

Date: 2026-06-12

## Scenarios

- Admin can open reports, see authorized datasets, preview bounded rows and export allowed XLSX: validated by the reports Playwright specs when internal credentials are available; without credentials the specs validate protected-route behavior.
- Department-only user sees only permitted datasets/fields: validated by permission helper tests.
- Client role cannot access internal reports: validated by route protection behavior and catalog permission tests.
- Saved model can be created, loaded, edited and deleted: covered by repository integration tests and Playwright flow; full persistence depends on a Supabase environment with the migration applied.
- Saved model with stale field reports invalid column diagnostics: validated by saved report helper tests.
- Prohibited field is not selectable, previewable or exportable: validated by catalog validation, export policy and E2E export security tests.
- Sensitive export creates operational audit metadata: audit metadata redaction is validated; backend sensitive file generation remains intentionally disabled until storage/download delivery is enabled for the Edge Function.
- Dataset partial failure does not block an independent dataset: validated by integration tests for partial failure handling.
- Large export above limit is blocked with controlled message: validated by export policy tests and E2E export security coverage.
- Organization feature flag disabled blocks module access while preserving saved models: route still uses feature flag and protected-route behavior is covered by E2E fallback.

## Validation Commands

- `npx -y -p node@22 node .\node_modules\vitest\vitest.mjs run`: passed, 14 files and 24 tests.
- `npx -y -p node@22 node .\node_modules\eslint\bin\eslint.js .`: passed.
- `npx -y -p node@22 node .\node_modules\vite\bin\vite.js build`: passed with the existing chunk-size warning.
- `npx -y -p node@22 node .\node_modules\@playwright\test\cli.js test tests/e2e/reports/reports-preview.spec.ts tests/e2e/reports/reports-saved-models.spec.ts tests/e2e/reports/reports-export-security.spec.ts`: passed, 3 specs.

## Remaining Operational Notes

- Direct `npm run ...` commands require the active shell to use Node >=22.12.0. The current shell still resolves `node` to v18.20.8.
- Playwright Chromium was installed locally for browser validation.
- Sensitive backend export currently validates and blocks unsafe requests. Producing a downloadable file for sensitive exports requires enabling the Edge Function storage/download path in a controlled rollout.
