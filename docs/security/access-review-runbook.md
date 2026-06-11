# Access Review Runbook

Cadence: monthly for production, per release for staging, immediately after team changes.

## Review Areas

| Area | Checks |
| --- | --- |
| Supabase dashboard | Owner/admin/developer/read-only users, MFA, removed users, institutional accounts. |
| Deploy platform | Project admins, environment variable access, deployment permissions. |
| Repository | GitHub collaborators, branch protections, secret scanning alerts. |
| Third-party tools | Open Finance, WhatsApp, email, AI provider and CRM access. |
| Application users | Admin/director/manager/client role assignments and inactive users. |

## Evidence

Record review date, reviewer, removed users, retained exceptions and follow-up tasks. Do not export secrets or personal data into the repository.
