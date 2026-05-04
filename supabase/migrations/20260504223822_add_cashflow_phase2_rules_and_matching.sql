-- Cashflow phase 2
-- - Persist client/global cashflow rules
-- - Auto-classify imported and bank entries
-- - Track matched rule and confidence on cashflow entries

CREATE TABLE IF NOT EXISTS public.client_cashflow_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  match_text text NOT NULL,
  entry_type text NOT NULL DEFAULT 'expense',
  category text NOT NULL,
  counterparty_name text,
  mark_as_transfer boolean NOT NULL DEFAULT false,
  auto_approve_threshold numeric(5, 4) NOT NULL DEFAULT 0.92,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_rules_entry_type_check'
  ) THEN
    ALTER TABLE public.client_cashflow_rules
      ADD CONSTRAINT client_cashflow_rules_entry_type_check
      CHECK (entry_type IN ('income', 'expense'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_rules_threshold_check'
  ) THEN
    ALTER TABLE public.client_cashflow_rules
      ADD CONSTRAINT client_cashflow_rules_threshold_check
      CHECK (auto_approve_threshold >= 0 AND auto_approve_threshold <= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_client_cashflow_rules_client_id
  ON public.client_cashflow_rules (client_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_rules_is_active
  ON public.client_cashflow_rules (is_active);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_rules_entry_type
  ON public.client_cashflow_rules (entry_type);

ALTER TABLE public.client_cashflow_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view cashflow rules" ON public.client_cashflow_rules;
CREATE POLICY "Internal can view cashflow rules"
  ON public.client_cashflow_rules
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can manage cashflow rules" ON public.client_cashflow_rules;
CREATE POLICY "Internal can manage cashflow rules"
  ON public.client_cashflow_rules
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_cashflow_rules_updated_at ON public.client_cashflow_rules;
CREATE TRIGGER update_client_cashflow_rules_updated_at
  BEFORE UPDATE ON public.client_cashflow_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_cashflow_entries
  ADD COLUMN IF NOT EXISTS matched_rule_id uuid REFERENCES public.client_cashflow_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rule_match_confidence numeric(5, 4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_entries_rule_match_confidence_check'
  ) THEN
    ALTER TABLE public.client_cashflow_entries
      ADD CONSTRAINT client_cashflow_entries_rule_match_confidence_check
      CHECK (rule_match_confidence IS NULL OR (rule_match_confidence >= 0 AND rule_match_confidence <= 1));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_matched_rule_id
  ON public.client_cashflow_entries (matched_rule_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_rule_match_confidence
  ON public.client_cashflow_entries (rule_match_confidence);

CREATE OR REPLACE FUNCTION public.normalize_cashflow_match_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      lower(unaccent(COALESCE(_value, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.find_matching_cashflow_rule(
  _client_id uuid,
  _description text,
  _entry_type text
)
RETURNS TABLE (
  rule_id uuid,
  category text,
  counterparty_name text,
  mark_as_transfer boolean,
  auto_approve_threshold numeric,
  match_confidence numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT public.normalize_cashflow_match_text(_description) AS description_normalized
  ),
  candidates AS (
    SELECT
      r.id AS rule_id,
      r.category,
      r.counterparty_name,
      r.mark_as_transfer,
      r.auto_approve_threshold,
      CASE
        WHEN n.description_normalized = public.normalize_cashflow_match_text(r.match_text) THEN 1.0::numeric
        WHEN strpos(n.description_normalized, public.normalize_cashflow_match_text(r.match_text)) > 0 THEN
          LEAST(
            0.99::numeric,
            0.55::numeric + (
              LEAST(length(public.normalize_cashflow_match_text(r.match_text)), length(n.description_normalized))::numeric
              / GREATEST(length(n.description_normalized), 1)::numeric
            ) * 0.45::numeric
          )
        ELSE 0::numeric
      END AS match_confidence,
      CASE WHEN r.client_id = _client_id THEN 0 ELSE 1 END AS precedence
    FROM public.client_cashflow_rules r
    CROSS JOIN normalized n
    WHERE r.is_active = true
      AND (r.client_id = _client_id OR r.client_id IS NULL)
      AND r.entry_type = _entry_type
      AND public.normalize_cashflow_match_text(r.match_text) <> ''
  )
  SELECT
    c.rule_id,
    c.category,
    c.counterparty_name,
    c.mark_as_transfer,
    c.auto_approve_threshold,
    round(c.match_confidence, 4)
  FROM candidates c
  WHERE c.match_confidence > 0
  ORDER BY c.precedence ASC, c.match_confidence DESC, c.rule_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_cashflow_rule_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_rule record;
BEGIN
  NEW.matched_rule_id := NULL;
  NEW.rule_match_confidence := NULL;

  IF COALESCE(NEW.origin_type, 'manual') NOT IN ('open_finance', 'import_file', 'obligation_projection', 'recurring_rule', 'manual') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO matched_rule
  FROM public.find_matching_cashflow_rule(NEW.client_id, NEW.description, NEW.entry_type);

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.matched_rule_id := matched_rule.rule_id;
  NEW.rule_match_confidence := matched_rule.match_confidence;
  NEW.category := matched_rule.category;

  IF matched_rule.counterparty_name IS NOT NULL AND btrim(matched_rule.counterparty_name) <> '' THEN
    NEW.counterparty_name := matched_rule.counterparty_name;
  END IF;

  NEW.is_transfer := matched_rule.mark_as_transfer;

  IF NEW.origin_type IN ('open_finance', 'import_file') THEN
    IF matched_rule.match_confidence >= matched_rule.auto_approve_threshold THEN
      NEW.review_status := 'approved';
      NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());

      IF NEW.origin_type = 'open_finance' THEN
        NEW.reconciliation_status := 'reconciled';
      END IF;
    ELSE
      NEW.review_status := 'classified';

      IF NEW.origin_type = 'open_finance' THEN
        NEW.reconciliation_status := 'suggested';
      END IF;
    END IF;
  ELSIF COALESCE(NEW.review_status, '') = '' OR NEW.review_status = 'pending_review' THEN
    NEW.review_status := 'classified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_apply_cashflow_rule_match ON public.client_cashflow_entries;
CREATE TRIGGER zz_apply_cashflow_rule_match
  BEFORE INSERT OR UPDATE ON public.client_cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_cashflow_rule_match();
