# Quickstart: Reestruturacao Profissional do Modulo de Relatorios

## 1. Confirm active feature

```powershell
Get-Content .specify\feature.json
git branch --show-current
```

Expected:
- Feature directory: `specs/002-reports-module-restructure`
- Branch: `002-reports-module-restructure`

## 2. Review product contract

Read, in order:

```text
specs/002-reports-module-restructure/spec.md
specs/002-reports-module-restructure/plan.md
specs/002-reports-module-restructure/research.md
specs/002-reports-module-restructure/data-model.md
specs/002-reports-module-restructure/contracts/report-module-contract.md
specs/002-reports-module-restructure/contracts/report-security-contract.md
```

## 3. Implementation guardrails

- Keep public site, internal app and client portal separated.
- Treat `RelatoriosPage.tsx` as page composition after refactor, not the owner of all business rules.
- Put catalog definitions, field classification and model validation in reusable report modules.
- Use TanStack Query for shared remote report state.
- Revalidate sensitive export permissions at generation time.
- Audit sensitive exports and model mutations.
- Do not expose password, token, credential, senha GOV or raw document fields.

## 4. Recommended validation commands

Run after implementation tasks:

```powershell
npm run lint
npm run test
npm run build
```

Run full deployment gate when environment variables are available:

```powershell
npm run verify:deploy
```

## 5. Manual validation scenarios

Validate at least:

- Admin can open reports, see authorized datasets, preview bounded rows and export allowed XLSX.
- Department-only user sees only permitted datasets/fields.
- Client role cannot access internal reports.
- Saved model can be created, loaded, edited and deleted.
- Saved model with stale field reports invalid column diagnostics.
- Prohibited field is not selectable, previewable or exportable.
- Sensitive export creates operational audit metadata.
- Dataset partial failure does not block an independent dataset.
- Large export above limit is blocked with controlled message.
- Organization feature flag disabled blocks module access while preserving saved models.

## 6. Rollback considerations

- Migrations changing `saved_reports`, export tracking or audit metadata must include down/rollback notes.
- If backend export rollout fails, keep direct client-side export disabled for sensitive datasets rather than falling back unsafely.
- If catalog validation rejects legacy saved models, preserve records and show diagnostics instead of deleting user configurations.
