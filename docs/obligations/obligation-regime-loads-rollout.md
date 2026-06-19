# Obligation Regime Loads Rollout

## Rollout

1. Apply the migration with nullable metadata columns and RLS enabled.
2. Validate seed data for tax regimes, master obligations and active baseline loads.
3. Enable backend actions for internal users with manager, director or admin role.
4. Enable UI entry points after backend contracts are validated.
5. Monitor application batches and sync runs for warnings.

## Rollback

Rollback must preserve client profiles and generated instances.

Recommended rollback path:

1. Disable UI actions that publish or synchronize loads.
2. Disable automatic load application in client creation.
3. Keep new tables readable for investigation.
4. Do not delete generated profiles or historical obligation instances.
5. If needed, set active loads to `in_review` to block automatic application.

## Validation Checklist

- One active load per organization and regime.
- Shared obligations are seeded once in the master catalog.
- Conditional items include `condition_key`.
- New-client application creates links only.
- Sync runs do not mutate `obligation_instances`, tasks, calendar events, documents or protocols.
- RLS blocks anonymous and portal users from load-management tables.
