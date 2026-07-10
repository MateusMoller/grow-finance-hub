# Contract: Default Obligations UI

## Company Registration

### Default Assignment Feedback

After saving a company with a supported tax regime, the internal UI must show one of these outcomes:

- Defaults applied successfully with count of assigned obligations.
- Defaults applied with conditional skip count and link to the client obligations view.
- Defaults not applied because tax regime is missing or unsupported.
- Defaults not applied because no active default set exists for that regime.

### Required Display Fields

- Tax regime used for default selection.
- Number of obligations created, kept, reactivated, skipped, blocked, duplicate-risk, and automatically inactivated.
- Conditional skip reasons for missing evidence.

## Client Detail Obligations

### Source Visibility

Each company obligation must clearly identify source:

- Standard/default by regime.
- Manual.
- Regime migration.
- Legacy.
- Exception.

### Conditional Skip Visibility

Conditional obligations skipped for missing evidence must show:

- Obligation name.
- Missing or uncertain evidence.
- That the obligation will be applied automatically when positive evidence is recorded.

### Manual Obligation Flow

Users must be able to:

- Create an additional obligation.
- Link it to the current company or selected companies.
- See duplicate warnings before saving.
- Save without modifying the default regime set for other companies.

## Obligations Catalog

### Default Set Inspection

Authorized internal users must be able to inspect default membership by regime, without create/edit/delete actions for system default definitions:

- MEI.
- Simples Nacional.
- Lucro Presumido.
- Lucro Real.

The catalog must distinguish:

- Master obligation definition.
- Default regime membership.
- Manual/company-specific obligation link.

### Exclusions

The standard default view must not include sector-specific obligations such as DMED, DIMOB, DOI, e-Financeira, and construction-specific routines.

## Regime Change Summary

When a company tax regime changes, the UI must provide an automatic application summary that shows:

- Obligations to add.
- Shared obligations to keep.
- Future old-regime default obligations inactivated automatically.
- Duplicate risks.
- Conditional obligations skipped by missing evidence.

Completed historical obligations remain visible in history and are not changed by the automatic regime migration.

## Error States

- Missing supported tax regime: ask user to complete the tax regime.
- Missing conditional evidence: show conditional skip information, not a hard failure.
- Unauthorized action: show controlled permission error.
- Backend failure: show controlled retry message and preserve existing company data.
