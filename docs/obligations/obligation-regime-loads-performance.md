# Obligation Regime Loads Performance Review

## Review Date

2026-07-10

## Result

Performance review passed for the implemented default-obligation flow.

## Checks

- Default load application reads the active load and its items once per client application.
- Existing active profiles are loaded once and indexed in memory for duplicate-safe add/keep decisions.
- Conditional evaluation is local and does not issue per-condition database calls.
- Registration default assignment does not generate competencies, tasks, calendar events, documents or protocols.
- Catalog UI source checks are derived from loaded template metadata and add no extra requests.
- Migration adds indexes for profile source fields and load application review batch/template lookup.

## Residual Risk

For bulk imports, run the default application in batches or a background job. The current path is optimized for single client creation and single client regime updates.
