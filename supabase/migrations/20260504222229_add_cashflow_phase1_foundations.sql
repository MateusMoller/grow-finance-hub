-- Cashflow phase 1 foundations
-- - Expand client_cashflow_entries with lifecycle, review and account context
-- - Create client_cashflow_accounts for manual/bank/cash account modeling
-- - Preserve portal compatibility by keeping entry_date/status synced

CREATE TABLE IF NOT EXISTS public.client_cashflow_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  currency_code text NOT NULL DEFAULT 'BRL',
  open_finance_account_id uuid REFERENCES public.open_finance_accounts(id) ON DELETE SET NULL,
  open_finance_connection_id uuid REFERENCES public.open_finance_connections(id) ON DELETE SET NULL,
  institution_name text,
  account_mask text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_accounts_source_type_check'
  ) THEN
    ALTER TABLE public.client_cashflow_accounts
      ADD CONSTRAINT client_cashflow_accounts_source_type_check
      CHECK (source_type IN ('manual', 'bank_open_finance', 'cash', 'other'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_client_cashflow_accounts_open_finance_account
  ON public.client_cashflow_accounts (open_finance_account_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_accounts_client_id
  ON public.client_cashflow_accounts (client_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_accounts_client_primary
  ON public.client_cashflow_accounts (client_id, is_primary);

ALTER TABLE public.client_cashflow_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_client_cashflow(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_internal_user(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = _client_id
        AND c.portal_user_id = auth.uid()
        AND c.portal_cashflow_enabled = true
    );
$$;

DROP POLICY IF EXISTS "Client and internal can view cashflow accounts" ON public.client_cashflow_accounts;
CREATE POLICY "Client and internal can view cashflow accounts"
  ON public.client_cashflow_accounts
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_cashflow(client_id));

DROP POLICY IF EXISTS "Internal can manage cashflow accounts" ON public.client_cashflow_accounts;
CREATE POLICY "Internal can manage cashflow accounts"
  ON public.client_cashflow_accounts
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_cashflow_accounts_updated_at ON public.client_cashflow_accounts;
CREATE TRIGGER update_client_cashflow_accounts_updated_at
  BEFORE UPDATE ON public.client_cashflow_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_cashflow_entries
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS competence_month date,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.client_cashflow_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_type text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS reconciliation_status text,
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS review_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS counterparty_name text,
  ADD COLUMN IF NOT EXISTS document_ref text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden_from_projection boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_origin_type_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_origin_type_check
      CHECK (origin_type IN ('manual', 'import_file', 'open_finance', 'obligation_projection', 'recurring_rule'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_lifecycle_status_check
      CHECK (lifecycle_status IN ('predicted', 'due', 'overdue', 'confirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_reconciliation_status_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_reconciliation_status_check
      CHECK (reconciliation_status IN ('not_applicable', 'pending', 'suggested', 'reconciled', 'ignored'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_review_status_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_review_status_check
      CHECK (review_status IN ('pending_review', 'classified', 'approved'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_due_date
  ON public.client_cashflow_entries (due_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_effective_date
  ON public.client_cashflow_entries (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_competence_month
  ON public.client_cashflow_entries (competence_month DESC);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_account_id
  ON public.client_cashflow_entries (account_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_lifecycle_status
  ON public.client_cashflow_entries (lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_review_status
  ON public.client_cashflow_entries (review_status);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_reconciliation_status
  ON public.client_cashflow_entries (reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_review_owner_id
  ON public.client_cashflow_entries (review_owner_id);

INSERT INTO public.client_cashflow_accounts (
  client_id,
  label,
  source_type,
  is_primary,
  is_active,
  notes
)
SELECT
  c.id,
  'Conta manual principal',
  'manual',
  true,
  true,
  'Conta padrao criada automaticamente para o fluxo de caixa.'
FROM public.clients c
WHERE
  (
    c.portal_cashflow_enabled = true
    OR EXISTS (
      SELECT 1
      FROM public.client_cashflow_entries e
      WHERE e.client_id = c.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.open_finance_accounts ofa
      WHERE ofa.client_id = c.id
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_cashflow_accounts cca
    WHERE cca.client_id = c.id
      AND cca.is_primary = true
  );

INSERT INTO public.client_cashflow_accounts (
  client_id,
  label,
  source_type,
  currency_code,
  open_finance_account_id,
  open_finance_connection_id,
  institution_name,
  account_mask,
  is_primary,
  is_active,
  notes
)
SELECT
  ofa.client_id,
  COALESCE(NULLIF(ofa.account_name, ''), NULLIF(ofa.institution_name, ''), 'Conta bancaria')
    || COALESCE(' (' || NULLIF(ofa.account_mask, '') || ')', ''),
  'bank_open_finance',
  COALESCE(ofa.currency_code, 'BRL'),
  ofa.id,
  ofa.connection_id,
  ofa.institution_name,
  ofa.account_mask,
  false,
  COALESCE(ofa.is_active, true),
  'Conta vinculada automaticamente a partir do Open Finance.'
FROM public.open_finance_accounts ofa
WHERE NOT EXISTS (
  SELECT 1
  FROM public.client_cashflow_accounts cca
  WHERE cca.open_finance_account_id = ofa.id
);

UPDATE public.client_cashflow_entries e
SET
  due_date = COALESCE(e.due_date, e.entry_date),
  effective_date = COALESCE(e.effective_date, CASE WHEN e.status = 'confirmed' THEN e.entry_date END),
  competence_month = COALESCE(
    e.competence_month,
    date_trunc(
      'month',
      COALESCE(
        CASE WHEN e.status = 'confirmed' THEN e.entry_date END,
        e.entry_date
      )::timestamp
    )::date
  ),
  origin_type = COALESCE(
    e.origin_type,
    CASE
      WHEN COALESCE(e.integration_source, '') LIKE 'open_finance_%' THEN 'open_finance'
      ELSE 'manual'
    END
  ),
  lifecycle_status = COALESCE(
    e.lifecycle_status,
    CASE
      WHEN e.status = 'confirmed' THEN 'confirmed'
      WHEN COALESCE(e.entry_date, CURRENT_DATE) < CURRENT_DATE THEN 'overdue'
      WHEN COALESCE(e.entry_date, CURRENT_DATE) = CURRENT_DATE THEN 'due'
      ELSE 'predicted'
    END
  ),
  reconciliation_status = COALESCE(
    e.reconciliation_status,
    CASE
      WHEN COALESCE(e.integration_source, '') LIKE 'open_finance_%' THEN 'pending'
      ELSE 'not_applicable'
    END
  ),
  review_status = COALESCE(
    e.review_status,
    CASE
      WHEN COALESCE(e.integration_source, '') LIKE 'open_finance_%' THEN 'pending_review'
      ELSE 'approved'
    END
  ),
  reviewed_at = COALESCE(
    e.reviewed_at,
    CASE
      WHEN COALESCE(e.integration_source, '') LIKE 'open_finance_%' THEN NULL
      ELSE now()
    END
  ),
  account_id = COALESCE(
    e.account_id,
    (
      SELECT cca.id
      FROM public.client_cashflow_accounts cca
      WHERE cca.open_finance_account_id = e.integration_account_id
      LIMIT 1
    ),
    (
      SELECT cca.id
      FROM public.client_cashflow_accounts cca
      WHERE cca.client_id = e.client_id
        AND cca.is_primary = true
      ORDER BY cca.created_at ASC
      LIMIT 1
    )
  );

CREATE OR REPLACE FUNCTION public.sync_client_cashflow_entry_phase1_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_date date;
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := COALESCE(NEW.entry_date, NEW.effective_date, CURRENT_DATE);
  END IF;

  IF NEW.entry_date IS NULL THEN
    NEW.entry_date := COALESCE(NEW.due_date, NEW.effective_date, CURRENT_DATE);
  END IF;

  IF NEW.status = 'confirmed' AND NEW.effective_date IS NULL THEN
    NEW.effective_date := COALESCE(NEW.entry_date, NEW.due_date, CURRENT_DATE);
  END IF;

  IF NEW.origin_type IS NULL THEN
    NEW.origin_type := CASE
      WHEN COALESCE(NEW.integration_source, '') LIKE 'open_finance_%' THEN 'open_finance'
      ELSE 'manual'
    END;
  END IF;

  IF NEW.account_id IS NULL AND NEW.integration_account_id IS NOT NULL THEN
    SELECT cca.id
    INTO NEW.account_id
    FROM public.client_cashflow_accounts cca
    WHERE cca.open_finance_account_id = NEW.integration_account_id
    LIMIT 1;
  END IF;

  IF NEW.account_id IS NULL THEN
    SELECT cca.id
    INTO NEW.account_id
    FROM public.client_cashflow_accounts cca
    WHERE cca.client_id = NEW.client_id
      AND cca.is_primary = true
      ORDER BY cca.created_at ASC
      LIMIT 1;
  END IF;

  IF NEW.account_id IS NULL THEN
    INSERT INTO public.client_cashflow_accounts (
      client_id,
      label,
      source_type,
      is_primary,
      is_active,
      notes
    )
    VALUES (
      NEW.client_id,
      'Conta manual principal',
      'manual',
      true,
      true,
      'Conta padrao criada automaticamente pelo fluxo de caixa.'
    )
    RETURNING id INTO NEW.account_id;
  END IF;

  derived_date := COALESCE(NEW.effective_date, NEW.due_date, NEW.entry_date, CURRENT_DATE);

  IF NEW.competence_month IS NULL THEN
    NEW.competence_month := date_trunc('month', derived_date::timestamp)::date;
  END IF;

  IF NEW.lifecycle_status IS NULL OR NEW.lifecycle_status NOT IN ('predicted', 'due', 'overdue', 'confirmed') THEN
    NEW.lifecycle_status := CASE
      WHEN NEW.effective_date IS NOT NULL OR NEW.status = 'confirmed' THEN 'confirmed'
      WHEN COALESCE(NEW.due_date, NEW.entry_date, CURRENT_DATE) < CURRENT_DATE THEN 'overdue'
      WHEN COALESCE(NEW.due_date, NEW.entry_date, CURRENT_DATE) = CURRENT_DATE THEN 'due'
      ELSE 'predicted'
    END;
  END IF;

  NEW.status := CASE
    WHEN NEW.lifecycle_status = 'confirmed' THEN 'confirmed'
    ELSE 'predicted'
  END;

  IF NEW.reconciliation_status IS NULL THEN
    NEW.reconciliation_status := CASE
      WHEN NEW.origin_type = 'open_finance' THEN 'pending'
      ELSE 'not_applicable'
    END;
  END IF;

  IF NEW.review_status IS NULL THEN
    NEW.review_status := CASE
      WHEN NEW.origin_type IN ('open_finance', 'import_file', 'obligation_projection', 'recurring_rule') THEN 'pending_review'
      ELSE 'approved'
    END;
  END IF;

  IF NEW.review_status = 'approved' AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  ELSIF NEW.review_status <> 'approved' THEN
    NEW.reviewed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_client_cashflow_entry_phase1_fields ON public.client_cashflow_entries;
CREATE TRIGGER sync_client_cashflow_entry_phase1_fields
  BEFORE INSERT OR UPDATE ON public.client_cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_cashflow_entry_phase1_fields();
