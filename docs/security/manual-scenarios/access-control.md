# Manual Scenario: Access Control

Environment: staging.

Required setup:

- Two client organizations or client records with distinct portal users.
- One internal admin.
- One department-only user.
- One standard employee.

## Cross-Client Portal Access

1. Log in as portal user A.
2. Capture a valid client-specific URL or API-backed action for client A.
3. Replace the client identifier with client B.
4. Expected result: no client B data is returned and no state change succeeds.
5. Evidence: screenshot or log showing denied access without exposing real data.

## Department-Only Restriction

1. Log in as a department-only user.
2. Attempt a restricted user-management or unrelated department action.
3. Expected result: action is blocked by backend/RLS, not only by hidden UI.
4. Evidence: response status, toast and backend log if available.

## Organization Switching

1. Log in as an internal user scoped to one organization.
2. Attempt direct access to another organization's client, task or document.
3. Expected result: no unauthorized data is returned.

## Failure Classification

Any successful cross-client or cross-organization read/write is critical.
