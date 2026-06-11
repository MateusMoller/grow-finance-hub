# Manual Scenario: Operational Controls

Environment: staging and production dashboards.

## MFA

1. Review Supabase and deploy-platform members.
2. Confirm privileged accounts have MFA enabled.

## Redirect URLs

1. Review Supabase Auth redirect URLs.
2. Confirm only approved app, staging and production URLs are allowed.
3. Confirm production wildcard URLs are not used unless explicitly justified.

## Session Policy

1. Review session lifetime and inactivity timeout.
2. Confirm settings match `docs/security/auth-security-settings.md`.

## Rate Limits

1. Review Auth rate limits for login, recovery, OTP and signup flows.
2. Confirm sensitive flows have throttling.

## Backups And Restore

1. Confirm production backup schedule and PITR status.
2. Confirm latest restore rehearsal or schedule a restore test.

## Access Review

1. Review Supabase, deploy, repository and third-party access.
2. Remove users who no longer need access.
3. Record exceptions and next review date.
