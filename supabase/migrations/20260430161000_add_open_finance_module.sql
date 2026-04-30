-- Open Finance module (v1)
-- - Connections, accounts, transactions and webhook audit
-- - Cashflow traceability fields for dedupe/source tracking
-- - RLS scoped by client ownership or internal roles

CREATE TABLE IF NOT EXISTS public.open_finance_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending_consent',
  consent_status text NOT NULL DEFAULT 'pending',
  consent_expires_at timestamptz,
  external_item_id text NOT NULL,
  external_user_ref text,
  last_synced_at timestamptz,
  last_sync_error text,
  disconnected_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.open_finance_connections
  ADD CONSTRAINT open_finance_connections_provider_check
  CHECK (provider IN ('pluggy', 'openi'));

ALTER TABLE public.open_finance_connections
  ADD CONSTRAINT open_finance_connections_status_check
  CHECK (status IN ('pending_consent', 'active', 'inactive', 'error'));

ALTER TABLE public.open_finance_connections
  ADD CONSTRAINT open_finance_connections_consent_status_check
  CHECK (consent_status IN ('pending', 'granted', 'revoked', 'expired', 'unknown'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_open_finance_connections_provider_external_item
  ON public.open_finance_connections (provider, external_item_id);

CREATE INDEX IF NOT EXISTS idx_open_finance_connections_client_id
  ON public.open_finance_connections (client_id);

CREATE TABLE IF NOT EXISTS public.open_finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.open_finance_connections(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  account_name text,
  account_type text,
  institution_name text,
  account_mask text,
  currency_code text NOT NULL DEFAULT 'BRL',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_open_finance_accounts_connection_external_account
  ON public.open_finance_accounts (connection_id, external_account_id);

CREATE INDEX IF NOT EXISTS idx_open_finance_accounts_client_id
  ON public.open_finance_accounts (client_id);

CREATE TABLE IF NOT EXISTS public.open_finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.open_finance_connections(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.open_finance_accounts(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_transaction_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  direction text NOT NULL,
  category text,
  provider_payload_min jsonb,
  imported_to_cashflow_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.open_finance_transactions
  ADD CONSTRAINT open_finance_transactions_direction_check
  CHECK (direction IN ('in', 'out'));

ALTER TABLE public.open_finance_transactions
  ADD CONSTRAINT open_finance_transactions_amount_check
  CHECK (amount >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_open_finance_transactions_connection_external_txn
  ON public.open_finance_transactions (connection_id, external_transaction_id);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_client_occurred_at
  ON public.open_finance_transactions (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_imported_to_cashflow_at
  ON public.open_finance_transactions (imported_to_cashflow_at);

CREATE TABLE IF NOT EXISTS public.open_finance_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload_min jsonb,
  processing_status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 1,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.open_finance_webhook_events
  ADD CONSTRAINT open_finance_webhook_events_provider_check
  CHECK (provider IN ('pluggy', 'openi'));

ALTER TABLE public.open_finance_webhook_events
  ADD CONSTRAINT open_finance_webhook_events_status_check
  CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_open_finance_webhook_events_provider_event
  ON public.open_finance_webhook_events (provider, event_id);

CREATE INDEX IF NOT EXISTS idx_open_finance_webhook_events_received_at
  ON public.open_finance_webhook_events (received_at DESC);

ALTER TABLE public.client_cashflow_entries
  ADD COLUMN IF NOT EXISTS integration_source text,
  ADD COLUMN IF NOT EXISTS integration_key text,
  ADD COLUMN IF NOT EXISTS integration_connection_id uuid REFERENCES public.open_finance_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integration_account_id uuid REFERENCES public.open_finance_accounts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_client_cashflow_entries_integration_dedupe
  ON public.client_cashflow_entries (client_id, integration_source, integration_key)
  WHERE integration_source IS NOT NULL AND integration_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_integration_connection
  ON public.client_cashflow_entries (integration_connection_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_entries_integration_account
  ON public.client_cashflow_entries (integration_account_id);

DROP TRIGGER IF EXISTS update_open_finance_connections_updated_at ON public.open_finance_connections;
CREATE TRIGGER update_open_finance_connections_updated_at
  BEFORE UPDATE ON public.open_finance_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_open_finance_accounts_updated_at ON public.open_finance_accounts;
CREATE TRIGGER update_open_finance_accounts_updated_at
  BEFORE UPDATE ON public.open_finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_open_finance_transactions_updated_at ON public.open_finance_transactions;
CREATE TRIGGER update_open_finance_transactions_updated_at
  BEFORE UPDATE ON public.open_finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_client_open_finance(_client_id uuid)
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

ALTER TABLE public.open_finance_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_finance_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client and internal can view open finance connections" ON public.open_finance_connections;
CREATE POLICY "Client and internal can view open finance connections"
  ON public.open_finance_connections
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_open_finance(client_id));

DROP POLICY IF EXISTS "Internal can manage open finance connections" ON public.open_finance_connections;
CREATE POLICY "Internal can manage open finance connections"
  ON public.open_finance_connections
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Client and internal can view open finance accounts" ON public.open_finance_accounts;
CREATE POLICY "Client and internal can view open finance accounts"
  ON public.open_finance_accounts
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_open_finance(client_id));

DROP POLICY IF EXISTS "Internal can manage open finance accounts" ON public.open_finance_accounts;
CREATE POLICY "Internal can manage open finance accounts"
  ON public.open_finance_accounts
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Client and internal can view open finance transactions" ON public.open_finance_transactions;
CREATE POLICY "Client and internal can view open finance transactions"
  ON public.open_finance_transactions
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_open_finance(client_id));

DROP POLICY IF EXISTS "Internal can manage open finance transactions" ON public.open_finance_transactions;
CREATE POLICY "Internal can manage open finance transactions"
  ON public.open_finance_transactions
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can view open finance webhook events" ON public.open_finance_webhook_events;
CREATE POLICY "Internal can view open finance webhook events"
  ON public.open_finance_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can manage open finance webhook events" ON public.open_finance_webhook_events;
CREATE POLICY "Internal can manage open finance webhook events"
  ON public.open_finance_webhook_events
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.cleanup_open_finance_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  DELETE FROM public.open_finance_transactions
  WHERE occurred_at < (now() - interval '12 months');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_open_finance_transactions IS
  'Cleanup detailed Open Finance transactions older than 12 months while preserving cashflow entries.';
