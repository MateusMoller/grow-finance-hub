-- Cache local para consultas de CNPJ, reduzindo dependência de APIs externas
-- e melhorando estabilidade no preenchimento cadastral em massa.

CREATE TABLE IF NOT EXISTS public.cnpj_lookup_cache (
  cnpj text PRIMARY KEY,
  legal_name text,
  trade_name text,
  main_cnae text,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  phone text,
  email text,
  source text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cnpj_lookup_cache_cnpj_digits CHECK (cnpj ~ '^[0-9]{14}$')
);

CREATE INDEX IF NOT EXISTS cnpj_lookup_cache_updated_at_idx
  ON public.cnpj_lookup_cache (updated_at DESC);

ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_cnpj_lookup_cache_updated_at ON public.cnpj_lookup_cache;
CREATE TRIGGER update_cnpj_lookup_cache_updated_at
  BEFORE UPDATE ON public.cnpj_lookup_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
