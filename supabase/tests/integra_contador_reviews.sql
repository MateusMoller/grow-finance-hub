begin;select plan(7);
select ok((select relrowsecurity from pg_class where oid='public.fiscal_reviews'::regclass),'reviews keep tenant RLS');
select ok((select relrowsecurity from pg_class where oid='public.fiscal_review_resolutions'::regclass),'resolution history has RLS');
select ok((select indisunique and indpred is not null from pg_index where indexrelid='public.fiscal_reviews_integration_uidx'::regclass),'review integration keys deduplicate');
select has_function('public','resolve_fiscal_review',array['uuid','uuid','text','text'],'review resolution API exists');
select ok(not has_function_privilege('anon','public.resolve_fiscal_review(uuid,uuid,text,text)','execute'),'anon cannot resolve reviews');
select ok(not has_function_privilege('authenticated','public.create_fiscal_task_canonical(uuid,uuid,text,text,text,text,date,text,jsonb)','execute'),'users cannot create system tasks');
select ok(not exists(select 1 from pg_trigger where tgrelid='public.fiscal_review_resolutions'::regclass and not tgisinternal),'resolution history has no mutation triggers');
select * from finish();rollback;
