# Report Catalog Governance

## Adding a dataset

1. Add the dataset to `src/lib/reports/catalog.ts`.
2. Declare `sourceOwner`, `sourceTablesOrViews`, `requiredFilters`, role rules and limits.
3. Classify every field before enabling the dataset.
4. Add or update catalog contract tests in `tests/unit/reports/catalog.contract.test.ts`.

## Adding a field

1. Use a stable key that will not change with labels.
2. Add a clear user-facing label.
3. Classify the field as internal, sensitive, regulated or prohibited.
4. Default credential-like fields to prohibited.
5. Add `module` and `group` metadata for search and navigation.

## Review rule

Any field with senha, password, token, secret, credential, key or raw document content in its source or meaning requires explicit security review before becoming previewable or exportable.
