# Auth Security Settings

| Control | Requirement |
| --- | --- |
| MFA | Required for admins, owners, internal staff with documents, finance, payroll or user-management access. |
| Session lifetime | 8h to 24h for internal users, based on operational tolerance. |
| Inactivity timeout | 30min to 2h for sensitive roles. |
| Single session | Recommended for critical internal roles where plan supports it. |
| Reauthentication | Required before password, email, role, permission or sensitive setting changes. |
| Rate limits | Configure login, password recovery, magic link, OTP, account creation and password change limits. |
| Redirect URLs | Allow only known app/staging/production URLs; avoid production wildcards. |

Required evidence:

- Screenshot or exported settings from Supabase Auth.
- Test for unauthorized redirect rejection.
- Test for repeated failed login throttling.
- MFA enrollment proof for privileged accounts without exposing recovery codes.
