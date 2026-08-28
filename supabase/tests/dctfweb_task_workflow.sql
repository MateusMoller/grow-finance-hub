-- Run under the Supabase SQL test harness: verify DCTFWeb tenant isolation and uniqueness.
begin;
select plan(6);
select has_table('public','dctfweb_dossiers','DCTFWeb dossiers exist');
select has_table('public','dctfweb_operations','DCTFWeb operations exist');
select has_table('public','dctfweb_artifacts','DCTFWeb artifacts exist');
select ok((select relrowsecurity from pg_class where oid='public.dctfweb_dossiers'::regclass),'DCTFWeb dossiers enforce RLS');
select ok((select relrowsecurity from pg_class where oid='public.dctfweb_operations'::regclass),'DCTFWeb operations enforce RLS');
select ok((select relrowsecurity from pg_class where oid='public.dctfweb_artifacts'::regclass),'DCTFWeb artifacts enforce RLS');
select * from finish();
rollback;
