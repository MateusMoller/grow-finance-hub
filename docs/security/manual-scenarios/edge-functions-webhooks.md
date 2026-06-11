# Manual Scenario: Edge Functions And Webhooks

Environment: staging.

Required setup:

- Staging Supabase project.
- Test JWTs for allowed and denied users.
- Provider webhook fixtures or signed payload samples.

## Missing JWT

1. Call a JWT-required function without Authorization header.
2. Expected result: request is rejected before state changes.

## Invalid Role

1. Call a privileged function with a valid JWT for an insufficient role.
2. Expected result: request is rejected and no privileged state change occurs.

## Duplicate Webhook

1. Send the same webhook event twice.
2. Expected result: second event is ignored or safely idempotent.

## Invalid Signature

1. Send a webhook payload with an invalid signature or missing provider validation.
2. Expected result: request is rejected and no state change occurs.

Any service-role or secret-backed state change without strong validation is critical.
