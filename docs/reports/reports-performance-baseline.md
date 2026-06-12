# Reports Performance Baseline

## Baseline assumptions

- Initial catalog supports at least 500 fields in a dataset search surface.
- Preview remains bounded by each dataset `previewLimit`.
- Dataset loading is scoped to the active dataset instead of all datasets on route open.
- Field lookup and selected column validation use `Map`/`Set` structures.

## Current thresholds

| Area | Threshold |
|------|-----------|
| Field search | 500 fields within 1 second |
| Preview render | Bounded by dataset preview limit |
| Direct export | Block or route above dataset export limit |
| Dataset failure | One dataset failure must not prevent another dataset preview service from working |

## Follow-up measurement

After the app can run under Node >=22.12.0 locally, record `npm run test`, browser smoke test and representative dataset timing in `docs/reports/reports-validation-results.md`.
