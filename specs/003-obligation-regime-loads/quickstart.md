# Quickstart: Cargas Padrao de Obrigacoes por Regime Tributario

## Prerequisites

- Use Node >=22.12.0 as required by the project.
- Apply the new Supabase migration for regime loads and seed data.
- Ensure `obrigacoes` feature flag is enabled for the active organization.
- Use an internal user with `admin`, `director` or `manager` role for catalog/load management tests.

## Scenario 1: Validate Baseline Loads

1. Open `/app/obrigacoes`.
2. Go to `Catalogo`.
3. Select each regime: Simples Nacional, Lucro Presumido, Lucro Real, MEI.
4. Confirm each regime has one active load.
5. Confirm shared obligations such as FGTS appear as the same master obligation reused by multiple regimes.
6. Attempt to create another `FGTS`/`F.G.T.S.` obligation and verify duplicate warning/blocking.

Expected result:

- No duplicate master obligations are created.
- Active loads show required/optional/conditional items.

## Scenario 2: New Company Auto-Application

1. Open `/app/clientes`.
2. Create a new company with regime `Simples Nacional`.
3. Save the company.
4. Open the client detail obligation tab.

Expected result:

- The company receives the active Simples Nacional load.
- Client obligation links show source `standard_load`.
- No duplicated active links exist for the same obligation.
- Conditional obligations without sufficient client evidence are shown as review items instead of active links.
- No competencies, tasks or calendar events are generated automatically during client creation.

Repeat for:

- Lucro Presumido
- Lucro Real
- MEI

## Scenario 3: Individual Client Exception

1. Open a client that received a standard load.
2. Change one obligation due-day override.
3. Inactivate one obligation for this client.
4. Add one additional obligation manually.

Expected result:

- Changes affect only this client.
- Load definition and other clients remain unchanged.
- Source/origin identifies manual addition or exception.

## Scenario 4: Regime Change Review

1. Open an existing Simples Nacional client.
2. Change the regime to Lucro Presumido.
3. Request load preview.
4. Review add/keep/inactivate/duplicate-risk summary.
5. Confirm only selected changes.

Expected result:

- Shared obligations are kept, not duplicated.
- Old-regime-only obligations are not inactivated without explicit confirmation.
- Historical competencies, documents and protocols remain available.

## Scenario 5: Published Load Synchronization

1. Open `/app/obrigacoes`.
2. Go to `Catalogo`.
3. Add one obligation to the active Simples Nacional load.
4. Publish/save the active load change.
5. Open an existing Simples Nacional client that already had obligations.

Expected result:

- Existing clients of the same regime receive active/future link synchronization automatically.
- Already generated competencies, tasks, calendar events, documents and protocols remain unchanged.
- Synchronization summary shows processed, created, skipped and review-required counts.
- Conditional items without evidence remain pending review.

## Scenario 6: Branch Company Handling

1. Create or open a branch company with its own tax regime.
2. Confirm the load follows the branch's own regime.
3. Create or open a branch company that inherits the parent regime.

Expected result:

- Branch with own regime receives its own regime load.
- Branch inheriting parent regime is marked for review before active load links are finalized.

## Scenario 7: Missing Load Failure Mode

1. Set a regime load to `in_review` or inactive in a test environment.
2. Create or update a client for that regime.

Expected result:

- Client creation/update does not corrupt obligations.
- Automatic application is blocked with a controlled warning.
- No partial duplicate profiles are created.

## Scenario 8: Validation Commands

Run:

```powershell
npm run lint
npm run test
npm run build
npm run verify:deploy
```

If the active shell uses Node 18, switch to Node >=22.12.0 or use the Node 22 runtime before interpreting failures.
