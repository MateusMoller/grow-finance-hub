# Quickstart: Default Obligations by Tax Regime

## Prerequisites

- Use Node >=22.12.0.
- Use an internal user with permission to create clients and manual obligations.
- Ensure the `obrigacoes` feature is enabled for the active organization.
- Apply the migration/seed that defines the generic default matrix.
- Use a test organization or test clients when validating destructive/regime-change behavior.

## Scenario 1: Validate Generic Default Matrix

1. Open the internal obligations catalog.
2. Inspect the default set for each regime:
   - MEI
   - Simples Nacional
   - Lucro Presumido
   - Lucro Real
3. Confirm sector-specific obligations are not present in default sets:
   - DMED
   - DIMOB
   - DOI
   - e-Financeira
   - construction-specific CNO/SERO
4. Confirm the UI does not expose actions to create, edit, delete, or reclassify system default obligations.

Expected result:

- Each supported regime has one active generic default set.
- Sector-specific obligations are absent from default membership.
- Shared obligations such as eSocial, FGTS, DCTFWeb/MIT, ISS, and municipal declaration reuse the same master definitions where appropriate.
- Default definitions are visible for inspection but not editable through the application interface.

## Scenario 2: Register MEI Company

1. Open the client registration flow.
2. Create a company with tax regime MEI.
3. Provide available generic attributes, such as employees and service provision.
4. Save the company.
5. Open the client obligations panel.

Expected result:

- MEI default obligations are assigned.
- Conditional obligations with known positive evidence are active.
- Conditional obligations with missing evidence are skipped with a reason and are applied automatically after positive evidence is recorded.
- No duplicate active obligation links exist.

## Scenario 3: Register Simples Nacional Company

1. Create a company with tax regime Simples Nacional.
2. Mark it as service provider and with employees.
3. Save the company.
4. Open client obligations.

Expected result:

- PGDAS-D and DEFIS are active.
- Employee-related defaults such as eSocial and FGTS are active.
- Service/retention-related defaults appear according to positive evidence.
- State and municipal generic obligations are active only when positive evidence exists; otherwise they are skipped with a reason.

## Scenario 4: Register Lucro Presumido Company

1. Create a company with tax regime Lucro Presumido.
2. Provide evidence for employees, service provision, and tax benefit usage as needed.
3. Save the company.

Expected result:

- DCTFWeb/MIT, EFD-Reinf, ECF, IRPJ/CSLL quarterly, and PIS/COFINS cumulative are included.
- ECD, EFD-Contribuicoes, EFD ICMS/IPI, DIRBI, state, and municipal obligations follow positive-evidence behavior.

## Scenario 5: Register Lucro Real Company

1. Create a company with tax regime Lucro Real.
2. Provide generic conditional evidence.
3. Save the company.

Expected result:

- DCTFWeb/MIT, EFD-Reinf, EFD-Contribuicoes, ECD, ECF, IRPJ/CSLL Lucro Real, and PIS/COFINS non-cumulative are included.
- Employee, service, state, municipal, and DIRBI obligations follow positive-evidence behavior.

## Scenario 6: Automatic Conditional Application After Evidence Update

1. Register a company with a supported tax regime while leaving a conditional evidence field unknown.
2. Confirm the affected conditional obligation is skipped.
3. Update the company with positive evidence for that condition.
4. Open the client obligations panel.

Expected result:

- The previously skipped conditional obligation is applied automatically for future control.
- Existing active defaults are kept without duplication.
- The application batch/audit data records the attribute-driven automatic application.

## Scenario 7: Manual Obligation Add-On

1. Open a company that already received defaults.
2. Create a new manual obligation.
3. Link it only to that company.
4. Save.

Expected result:

- Manual obligation appears with manual source.
- Default obligations remain unchanged.
- Other companies do not receive the manual obligation.
- Duplicate warning appears if the manual obligation resembles an existing active obligation.

## Scenario 8: Reapply Defaults Without Duplicates

1. Open a company with already applied defaults.
2. Reapply or refresh defaults for the same regime.
3. Review the resulting summary.

Expected result:

- Existing active links are kept.
- No duplicate active obligation links are created.
- Manually inactivated defaults are not silently reactivated.

## Scenario 9: Automatic Tax Regime Change

1. Open an existing Simples Nacional test company.
2. Change tax regime to Lucro Presumido.
3. Save the regime change.
4. Review the automatic application summary.

Expected result:

- Shared obligations are kept, not duplicated.
- Lucro Presumido defaults are added for future control.
- Future old-regime-only defaults are inactivated automatically.
- Completed historical obligations remain available.

## Validation Commands

Run:

```powershell
npm run lint
npm run test
npm run build
npm run verify:deploy
```

Expected result:

- All commands pass in a Node >=22.12.0 environment.
- If remote migration history prevents deployment validation, document the migration-history blocker and validate the SQL/action behavior separately.
