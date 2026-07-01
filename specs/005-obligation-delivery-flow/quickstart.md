# Quickstart: Obligation Delivery Flow

## Goal

Validate that the existing obligations flow can take a guide from Central de Documentos to a reviewed client email and close the operational task only after an authorized user confirms sending and the email succeeds.

## Local Preparation

1. Install dependencies if needed:

   ```powershell
   npm install
   ```

2. Confirm required environment variables are available for local or deployed verification:

   ```powershell
   npm run check:env
   ```

3. Start the app when testing the UI:

   ```powershell
   npm run dev
   ```

## Happy Path Validation

1. Open the internal obligations workspace.
2. Confirm an obligation template exists with:
   - active status
   - expected document configured
   - reference/template document attached for extraction
   - email delivery enabled
   - subject and body message configured
3. Confirm a client profile exists for that obligation.
4. Generate instances/tasks for the current competence.
5. Upload a real guide through Central de Documentos.
6. Confirm the document is matched to the correct client, obligation, competence, and expected document.
7. Prepare the delivery and verify the default recipient is the client's primary registered email.
8. Review or edit the recipient if needed.
9. Confirm sending as an authorized user.
10. Verify:
   - the guide, not the reference template, is attached to the email
   - the `From` address is a verified Grow sender
   - reply-to, displayed sender context, and audit identity resolve from the user performing the send
   - delivery attempt is recorded as sent
   - obligation instance becomes complete
   - related task is closed

## Failure Path Validation

1. Remove or invalidate the client email and attempt send.
2. Verify the send is blocked and the task remains open.
3. Restore client email and retry.
4. Disable or invalidate the sender email and attempt send.
5. Verify the send is blocked and the task remains open.
6. Attempt to process a high-confidence linked document without human send confirmation.
7. Verify the delivery is prepared but no email is sent and the task remains open.
8. Simulate provider failure.
9. Verify the delivery attempt is failed, audit is recorded, and retry is possible without re-upload.

## Historical Reconciliation Validation

1. Identify a historical completed obligation without email-sent evidence.
2. Run the reconciliation path.
3. Verify the historical completion status is preserved.
4. Verify the record is visibly classified for delivery review/audit.

## Batch Upload Validation

1. Upload a batch of at least 100 guide files where possible.
2. Verify every file receives a status.
3. Confirm low-confidence items go to manual review.
4. Confirm high-confidence items can become ready to send without duplicate tasks.

## Quality Gates

Run before implementation handoff or release:

```powershell
npm run lint
npm run test
npm run build
npm run verify:deploy
```

If Supabase schema changes are included, also validate the new migration against a local or staging Supabase database and record rollback notes in the implementation summary.

## Current Implementation Validation

Executed during implementation:

```powershell
npm run test -- src/test/obligationDeliveryFlow.test.ts
npm run test -- src/test/UsuariosPage.permissions.test.tsx
npm run lint
npm run test
npm run build
npm run verify:deploy
npx supabase db push --local
npx supabase test db --local supabase/tests/obligation_delivery_flow.sql
```

Remote migration application note:

```powershell
npx supabase db query --linked --file supabase/migrations/20260630121959_add_obligation_delivery_attempts.sql
npx supabase test db --linked supabase/tests/obligation_delivery_flow.sql
```

The linked database accepted the migration SQL directly. `supabase db push --linked` was not used because the remote migration history contains versions missing from the local migrations directory. The linked pgTAP test runner does not have the `pgtap` extension available, so the SQL validation was executed successfully against the local Supabase database after applying pending local migrations.
