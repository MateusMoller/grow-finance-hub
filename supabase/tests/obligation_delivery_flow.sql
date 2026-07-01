-- Obligation delivery flow schema validation.
-- Run after migrations against local or staging/linked database.

BEGIN;

SELECT plan(7);

SELECT ok(
  to_regclass('public.obligation_delivery_attempts') IS NOT NULL,
  'public.obligation_delivery_attempts exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    JOIN pg_type type
      ON type.oid = attribute.atttypid
    WHERE attribute.attrelid = 'public.obligation_templates'::regclass
      AND attribute.attname = 'expected_documents'
      AND type.typname = 'jsonb'
      AND NOT attribute.attisdropped
  ),
  'obligation_templates.expected_documents is jsonb'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_instances_status_check'
      AND pg_get_constraintdef(oid) LIKE '%pronto_para_envio%'
      AND pg_get_constraintdef(oid) LIKE '%falha_envio%'
  ),
  'obligation instance status constraint includes delivery states'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_inbox_items_status_check'
      AND pg_get_constraintdef(oid) LIKE '%pending_review%'
      AND pg_get_constraintdef(oid) LIKE '%linked%'
      AND pg_get_constraintdef(oid) LIKE '%rejected%'
  ),
  'document inbox status constraint includes triage states'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.obligation_delivery_attempts'::regclass
      AND attribute.attname = 'human_confirmed_at'
      AND NOT attribute.attisdropped
  ),
  'delivery attempts include human confirmation timestamp'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_delivery_attempts_status_check'
      AND pg_get_constraintdef(oid) LIKE '%sent%'
      AND pg_get_constraintdef(oid) LIKE '%failed%'
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ),
  'delivery attempt status constraint includes sent, failed, and cancelled states'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.obligation_instances'::regclass
      AND attribute.attname IN ('delivery_review_required', 'delivery_review_reason', 'ready_for_delivery_at')
      AND NOT attribute.attisdropped
    GROUP BY attribute.attrelid
    HAVING COUNT(*) = 3
  ),
  'obligation instances include delivery review and ready-for-delivery fields'
);

SELECT * FROM finish();

ROLLBACK;
