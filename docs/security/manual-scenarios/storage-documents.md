# Manual Scenario: Storage Documents

Environment: staging.

Required setup:

- Private document bucket with representative client document.
- Authorized portal user.
- Unauthorized portal user.
- Expired signed URL sample.

## Unauthorized Download

1. Log in as unauthorized user.
2. Attempt to fetch a private document path from another client.
3. Expected result: denied access.

## Signed URL Expiry

1. Generate a short-lived signed URL as an authorized user.
2. Wait until expiry.
3. Attempt reuse.
4. Expected result: URL is rejected.

## Invalid File Type

1. Attempt upload of `.exe`, `.js` or `.sh`.
2. Expected result: client-side validation rejects it and backend/Storage policy does not accept it.

## Audit Evidence

1. Upload and download a valid PDF.
2. Confirm audit evidence identifies actor, client/organization, object and timestamp.

Any unauthorized private document access is critical.
