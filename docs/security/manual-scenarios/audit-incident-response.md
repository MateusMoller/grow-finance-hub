# Manual Scenario: Audit And Incident Response

Environment: staging.

## Permission Change

1. Change a test user's role.
2. Confirm audit evidence includes actor, target user, old value, new value, timestamp and result.

## Document Download

1. Download a staging document.
2. Confirm audit evidence includes actor, organization/client, object reference, timestamp and result.

## Integration Failure

1. Trigger an integration failure with safe test credentials or fixture payload.
2. Confirm logs record provider, operation and result without secrets.

## Secret Redaction

1. Inspect logs for token, API key, service-role key and webhook secret patterns.
2. Expected result: no raw secrets appear in logs or user-visible errors.

Missing audit on sensitive actions is at least high risk; secret exposure is critical.
