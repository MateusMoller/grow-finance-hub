# Obligation Regime Loads Validation

## 2026-06-19

- `npm run test -- tests/unit/obligations tests/integration/obligations/regimeLoadContracts.test.ts`: passed, 6 files and 19 tests.
- `npm run lint`: passed.
- `npm run build`: passed. Vite reported existing large chunk warnings after minification.

## 2026-07-10

- `npm run test -- tests/unit/obligations/baselineRegimeLoads.test.ts tests/unit/obligations/conditionalApplicability.test.ts tests/integration/obligations/defaultObligationContracts.test.ts`: passed, 3 files and 21 tests.
- `npm run test -- tests/unit/obligations/obligationDeduplication.test.ts tests/unit/obligations/baselineRegimeLoads.test.ts tests/integration/obligations/defaultObligationContracts.test.ts`: passed, 3 files and 25 tests.
- `npm run lint`: passed.
- `npm run build`: passed. Vite reported existing large chunk warnings after minification.
- `npm run test`: passed, 27 files and 93 tests.
- `npm run verify:deploy`: passed. Environment validation, lint and production build completed successfully.
