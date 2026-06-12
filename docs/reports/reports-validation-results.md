# Reports Validation Results

Date: 2026-06-12

## Environment

- Shell `node -v`: v18.20.8
- Required by `package.json`: >=22.12.0
- Validation runtime used for final gates: Node v22.22.3 via `npx -y -p node@22 node`

The project already declares Node 22 through `.nvmrc` and `package.json`. Direct `npm run ...` commands still fail in a shell where `node` resolves to v18.20.8; the final validation below was executed with Node 22.

## Commands

### Targeted Vitest reports tests

Command:

```powershell
npx -y -p node@22 node .\node_modules\vitest\vitest.mjs run
```

Result: passed.

- Test files: 14 passed
- Tests: 24 passed

### Full lint

Command:

```powershell
npx -y -p node@22 node .\node_modules\eslint\bin\eslint.js .
```

Result: passed.

### Full test

Command:

```powershell
npx -y -p node@22 node .\node_modules\vitest\vitest.mjs run
```

Result: passed.

- Test files: 14 passed
- Tests: 24 passed

`vitest.config.ts` was adjusted so Playwright files under `tests/e2e/` are not collected by Vitest.

### Build

Command:

```powershell
npx -y -p node@22 node .\node_modules\vite\bin\vite.js build
```

Result: passed.

Note: Vite emitted the existing chunk-size warning for bundles above 500 kB.

### Verify deploy

Command:

```powershell
npx -y -p node@22 node scripts\validate-env.mjs
npx -y -p node@22 node .\node_modules\eslint\bin\eslint.js .
npx -y -p node@22 node .\node_modules\vite\bin\vite.js build
```

Result: passed for the equivalent gate sequence.

- `check:env`: passed
- lint: passed
- build: passed, with the existing chunk-size warning

### Reports E2E

Command:

```powershell
npx -y -p node@22 node .\node_modules\@playwright\test\cli.js install chromium
npx -y -p node@22 node .\node_modules\@playwright\test\cli.js test tests/e2e/reports/reports-preview.spec.ts tests/e2e/reports/reports-saved-models.spec.ts tests/e2e/reports/reports-export-security.spec.ts
```

Result: passed.

- Specs: 3 passed
- Local Vite server used for the run: `http://127.0.0.1:4173`

The E2E specs support both environments with internal credentials and environments without them. When no internal credentials are configured, they validate the protected-route behavior instead of forcing seeded production data.

### TypeScript check

Command:

```powershell
npx tsc -p tsconfig.app.json --noEmit
```

Result: not used as a release gate for this feature. Earlier execution with the shell's Node v18 surfaced existing unrelated project errors in modules outside the reports work, including `TaskDetailSheet.tsx`, `ClientPortalCashflow.tsx`, `newsletter.ts`, `ClientDetailPage.tsx`, `ClientsPage.tsx`, `FinanceiroPage.tsx`, `FormulariosPage.tsx`, `KanbanPage.tsx`, `PortalClientePage.tsx` and `UsuariosPage.tsx`.
