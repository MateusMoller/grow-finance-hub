# Incident Response Runbook

## Secret Leak

1. Revoke and rotate the leaked key.
2. Search logs and repository history for the exposed value.
3. Identify affected environment and time window.
4. Review service-role actions during the window.
5. Record impact and remediation in the incident log.

## Unauthorized Access

1. Disable affected user/session where possible.
2. Preserve logs for actor, organization, client and accessed entities.
3. Validate RLS, Edge Function checks and route path involved.
4. Patch backend/database control before relying on frontend changes.
5. Notify stakeholders according to legal and contractual requirements.

## Failed Restore

1. Stop destructive changes.
2. Preserve failed restore logs.
3. Escalate to project owner and Supabase support path if needed.
4. Use last known good backup or PITR point.
5. Update restore runbook with root cause.

## Suspicious Login

1. Revoke sessions for the account.
2. Require password reset and MFA review.
3. Review recent privileged actions.
4. Check redirect URL and Auth rate-limit settings.

## Webhook Abuse

1. Disable or restrict affected webhook if abuse is active.
2. Verify signature/idempotency controls.
3. Replay only known-good events from provider logs.
4. Add rate limits or provider allowlists where available.
