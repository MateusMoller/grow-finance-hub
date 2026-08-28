begin;
select plan(4);
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_sync_runs_active_uidx'::regclass), 'active sync requests use partial unique deduplication');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_documents_external_uidx'::regclass), 'external documents use partial unique deduplication');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_documents_hash_uidx'::regclass), 'document content uses partial unique deduplication');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_reviews_open_uidx'::regclass), 'open reviews use partial unique deduplication');
select * from finish(); rollback;
