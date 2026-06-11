# Security Review Schedule

| Risk | Maximum due date | Review expectation |
| --- | --- | --- |
| Critical | 30 days or emergency path | Validate immediately, block release if exposure is plausible. |
| High | 30 days | Review code and staging behavior before hardening is considered complete. |
| Medium | 60 days | Assign owner and acceptance criteria. |
| Low | 90 days | Track as hygiene or documentation hardening. |

Recurring cadence:

- Weekly: review new critical/high rows from `security-control-matrix.md`.
- Monthly: review Supabase dashboard access, deploy platform access and secrets.
- Quarterly: rehearse restore process and incident response tabletop.
- Per release: re-run `npm run security:inventory`.
