-- Tenant scope for CNPJ lookup cache.

ALTER TABLE public.cnpj_lookup_cache
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id();

UPDATE public.cnpj_lookup_cache
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL;

ALTER TABLE public.cnpj_lookup_cache
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.cnpj_lookup_cache'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cnpj_lookup_cache DROP CONSTRAINT %I', pk_name);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS cnpj_lookup_cache_org_cnpj_key
  ON public.cnpj_lookup_cache (organization_id, cnpj);

CREATE INDEX IF NOT EXISTS idx_cnpj_lookup_cache_organization_updated_at
  ON public.cnpj_lookup_cache (organization_id, updated_at DESC);
