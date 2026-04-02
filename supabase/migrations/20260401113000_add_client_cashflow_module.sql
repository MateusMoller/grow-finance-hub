-- Client portal cashflow module
-- 1) Enable feature per client (admin release only)
-- 2) Persist client cashflow entries with RLS for portal + internal team

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_cashflow_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.client_cashflow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type text NOT NULL DEFAULT 'expense',
  category text NOT NULL DEFAULT 'Outros',
  description text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_entry_type_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_entry_type_check
      CHECK (entry_type IN ('income', 'expense'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_status_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_status_check
      CHECK (status IN ('predicted', 'confirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_amount_positive'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_amount_positive
      CHECK (amount > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_client_id
  ON public.client_cashflow_entries (client_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_entry_date
  ON public.client_cashflow_entries (entry_date DESC);

ALTER TABLE public.client_cashflow_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients and internal can view cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can insert cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can update cashflow entries" ON public.client_cashflow_entries;
DROP POLICY IF EXISTS "Clients and internal can delete cashflow entries" ON public.client_cashflow_entries;

CREATE POLICY "Clients and internal can view cashflow entries"
  ON public.client_cashflow_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_cashflow_entries.client_id
      AND c.portal_user_id = auth.uid()
      AND c.portal_cashflow_enabled = true
    )
  );

CREATE POLICY "Clients and internal can insert cashflow entries"
  ON public.client_cashflow_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user(auth.uid())
    OR (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = client_cashflow_entries.client_id
        AND c.portal_user_id = auth.uid()
        AND c.portal_cashflow_enabled = true
      )
    )
  );

CREATE POLICY "Clients and internal can update cashflow entries"
  ON public.client_cashflow_entries
  FOR UPDATE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid())
    OR (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = client_cashflow_entries.client_id
        AND c.portal_user_id = auth.uid()
        AND c.portal_cashflow_enabled = true
      )
    )
  )
  WITH CHECK (
    public.is_internal_user(auth.uid())
    OR (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = client_cashflow_entries.client_id
        AND c.portal_user_id = auth.uid()
        AND c.portal_cashflow_enabled = true
      )
    )
  );

CREATE POLICY "Clients and internal can delete cashflow entries"
  ON public.client_cashflow_entries
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid())
    OR (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = client_cashflow_entries.client_id
        AND c.portal_user_id = auth.uid()
        AND c.portal_cashflow_enabled = true
      )
    )
  );

DROP TRIGGER IF EXISTS update_client_cashflow_entries_updated_at ON public.client_cashflow_entries;
CREATE TRIGGER update_client_cashflow_entries_updated_at
  BEFORE UPDATE ON public.client_cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_admin_cashflow_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_cashflow_enabled IS DISTINCT FROM OLD.portal_cashflow_enabled
     AND COALESCE(auth.role(), '') = 'authenticated'
     AND NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admin can change cashflow portal access';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_cashflow_release ON public.clients;
CREATE TRIGGER enforce_admin_cashflow_release
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_cashflow_release();
