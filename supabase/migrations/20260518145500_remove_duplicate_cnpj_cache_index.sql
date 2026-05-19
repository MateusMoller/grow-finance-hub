-- Keep the primary key and remove the older duplicate unique index.

DROP INDEX IF EXISTS public.cnpj_lookup_cache_org_cnpj_key;
