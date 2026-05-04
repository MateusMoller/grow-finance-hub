ALTER TABLE public.client_acessorias_obligations
  ADD COLUMN IF NOT EXISTS has_financial_impact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS projected_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS financial_entry_type text NOT NULL DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS financial_category text,
  ADD COLUMN IF NOT EXISTS cashflow_account_id uuid REFERENCES public.client_cashflow_accounts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_acessorias_obligations_projected_amount_check'
  ) THEN
    ALTER TABLE public.client_acessorias_obligations
      ADD CONSTRAINT client_acessorias_obligations_projected_amount_check
      CHECK (projected_amount IS NULL OR projected_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_acessorias_obligations_financial_entry_type_check'
  ) THEN
    ALTER TABLE public.client_acessorias_obligations
      ADD CONSTRAINT client_acessorias_obligations_financial_entry_type_check
      CHECK (financial_entry_type IN ('income', 'expense'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.client_cashflow_consultive_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_key text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_cashflow_consultive_alerts_unique UNIQUE (client_id, source_type, source_key)
);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_consultive_alerts_client_id
  ON public.client_cashflow_consultive_alerts (client_id);

CREATE INDEX IF NOT EXISTS idx_client_cashflow_consultive_alerts_status
  ON public.client_cashflow_consultive_alerts (status);

ALTER TABLE public.client_cashflow_consultive_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client and internal can view consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
CREATE POLICY "Client and internal can view consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_cashflow(client_id));

DROP POLICY IF EXISTS "Internal can manage consultive cashflow alerts" ON public.client_cashflow_consultive_alerts;
CREATE POLICY "Internal can manage consultive cashflow alerts"
  ON public.client_cashflow_consultive_alerts
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_cashflow_consultive_alerts_updated_at ON public.client_cashflow_consultive_alerts;
CREATE TRIGGER update_client_cashflow_consultive_alerts_updated_at
  BEFORE UPDATE ON public.client_cashflow_consultive_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_cashflow_health_snapshots (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  health_status text NOT NULL DEFAULT 'em_dia',
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  projected_balance_7 numeric(14,2) NOT NULL DEFAULT 0,
  projected_balance_15 numeric(14,2) NOT NULL DEFAULT 0,
  projected_balance_30 numeric(14,2) NOT NULL DEFAULT 0,
  overdue_entries integer NOT NULL DEFAULT 0,
  pending_review_entries integer NOT NULL DEFAULT 0,
  pending_reconciliation_entries integer NOT NULL DEFAULT 0,
  review_coverage numeric(5,4) NOT NULL DEFAULT 1,
  critical_calendar_events integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  projected_gap_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_cashflow_health_snapshots_health_status_check'
  ) THEN
    ALTER TABLE public.client_cashflow_health_snapshots
      ADD CONSTRAINT client_cashflow_health_snapshots_health_status_check
      CHECK (health_status IN ('em_dia', 'atencao', 'critico'));
  END IF;
END
$$;

ALTER TABLE public.client_cashflow_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client and internal can view cashflow health snapshots" ON public.client_cashflow_health_snapshots;
CREATE POLICY "Client and internal can view cashflow health snapshots"
  ON public.client_cashflow_health_snapshots
  FOR SELECT
  TO authenticated
  USING (public.can_access_client_cashflow(client_id));

DROP POLICY IF EXISTS "Internal can manage cashflow health snapshots" ON public.client_cashflow_health_snapshots;
CREATE POLICY "Internal can manage cashflow health snapshots"
  ON public.client_cashflow_health_snapshots
  FOR ALL
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_cashflow_health_snapshots_updated_at ON public.client_cashflow_health_snapshots;
CREATE TRIGGER update_client_cashflow_health_snapshots_updated_at
  BEFORE UPDATE ON public.client_cashflow_health_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.infer_cashflow_category_from_obligation(
  _obligation_name text,
  _entry_type text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_name text := lower(
    regexp_replace(
      translate(coalesce(_obligation_name, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
BEGIN
  IF coalesce(_entry_type, 'expense') = 'income' THEN
    RETURN 'Outras entradas';
  END IF;

  IF normalized_name ~ '(simples|das|imposto|tribut|fiscal|guia|iss|icms|pis|cofins|irpj|csll|iptu|taxa)' THEN
    RETURN 'Impostos';
  END IF;

  IF normalized_name ~ '(folha|salario|pro labore|prolabore|inss|fgts|funcionario|ferias|rescisao)' THEN
    RETURN 'Folha de pagamento';
  END IF;

  RETURN 'Despesas operacionais';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_client_cashflow_consultive_alert(
  _client_id uuid,
  _source_key text,
  _severity text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  alert_id uuid;
BEGIN
  INSERT INTO public.client_cashflow_consultive_alerts (
    client_id,
    source_type,
    source_key,
    severity,
    title,
    message,
    status,
    metadata,
    resolved_at
  )
  VALUES (
    _client_id,
    'cashflow_consultive',
    _source_key,
    coalesce(_severity, 'info'),
    _title,
    _message,
    'active',
    coalesce(_metadata, '{}'::jsonb),
    null
  )
  ON CONFLICT (client_id, source_type, source_key)
  DO UPDATE SET
    severity = EXCLUDED.severity,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    status = 'active',
    metadata = EXCLUDED.metadata,
    resolved_at = null,
    updated_at = now()
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_cashflow_consultive_alerts(
  _client_id uuid,
  _active_alert_keys text[] DEFAULT '{}'::text[]
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.client_cashflow_consultive_alerts
  SET
    status = 'resolved',
    resolved_at = now(),
    updated_at = now()
  WHERE client_id = _client_id
    AND source_type = 'cashflow_consultive'
    AND status <> 'resolved'
    AND (
      coalesce(array_length(_active_alert_keys, 1), 0) = 0
      OR NOT (source_key = ANY(_active_alert_keys))
    );
$$;

CREATE OR REPLACE FUNCTION public.upsert_cashflow_consultive_task(
  _client_id uuid,
  _integration_task_id text,
  _title text,
  _description text,
  _priority text,
  _due_date date,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  client_name_value text;
BEGIN
  SELECT c.name
  INTO client_name_value
  FROM public.clients c
  WHERE c.id = _client_id;

  INSERT INTO public.kanban_tasks (
    title,
    description,
    client_name,
    assignee,
    priority,
    sector,
    status,
    due_date,
    tags,
    created_by,
    integration_source,
    integration_task_id,
    integration_payload
  )
  VALUES (
    _title,
    _description,
    client_name_value,
    null,
    coalesce(_priority, 'high'),
    'Financeiro',
    'backlog',
    _due_date,
    ARRAY['Financeiro', 'Caixa consultivo'],
    null,
    'cashflow_consultive',
    _integration_task_id,
    coalesce(_payload, '{}'::jsonb)
  )
  ON CONFLICT (integration_source, integration_task_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    client_name = EXCLUDED.client_name,
    priority = EXCLUDED.priority,
    sector = EXCLUDED.sector,
    due_date = EXCLUDED.due_date,
    tags = EXCLUDED.tags,
    integration_payload = EXCLUDED.integration_payload,
    status = CASE
      WHEN public.kanban_tasks.status = 'done' THEN 'backlog'
      ELSE public.kanban_tasks.status
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_cashflow_consultive_tasks(
  _client_id uuid,
  _active_task_ids text[] DEFAULT '{}'::text[]
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.kanban_tasks
  SET
    status = 'done',
    updated_at = now()
  WHERE integration_source = 'cashflow_consultive'
    AND integration_task_id LIKE _client_id::text || ':%'
    AND status <> 'done'
    AND (
      coalesce(array_length(_active_task_ids, 1), 0) = 0
      OR NOT (integration_task_id = ANY(_active_task_ids))
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_cashflow_projection_from_obligation(_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  obligation_row public.client_acessorias_obligations%ROWTYPE;
  projection_account_id uuid;
  projection_key text;
BEGIN
  SELECT *
  INTO obligation_row
  FROM public.client_acessorias_obligations
  WHERE id = _obligation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  projection_key := 'acessorias:' || obligation_row.id::text;

  SELECT a.id
  INTO projection_account_id
  FROM public.client_cashflow_accounts a
  WHERE a.client_id = obligation_row.client_id
    AND a.is_active = true
    AND (
      obligation_row.cashflow_account_id IS NULL
      OR a.id = obligation_row.cashflow_account_id
    )
  ORDER BY
    CASE WHEN a.id = obligation_row.cashflow_account_id THEN 0 ELSE 1 END,
    a.is_primary DESC,
    a.created_at ASC
  LIMIT 1;

  IF obligation_row.has_financial_impact = true
    AND obligation_row.projected_amount IS NOT NULL
    AND obligation_row.projected_amount > 0
    AND obligation_row.due_date IS NOT NULL THEN
    INSERT INTO public.client_cashflow_entries (
      client_id,
      entry_date,
      due_date,
      effective_date,
      competence_month,
      account_id,
      entry_type,
      category,
      description,
      amount,
      status,
      lifecycle_status,
      origin_type,
      reconciliation_status,
      review_status,
      counterparty_name,
      document_ref,
      notes,
      is_transfer,
      is_hidden_from_projection,
      integration_source,
      integration_key,
      created_by
    )
    VALUES (
      obligation_row.client_id,
      obligation_row.due_date,
      obligation_row.due_date,
      null,
      date_trunc('month', obligation_row.due_date)::date,
      projection_account_id,
      obligation_row.financial_entry_type,
      coalesce(
        nullif(trim(obligation_row.financial_category), ''),
        public.infer_cashflow_category_from_obligation(obligation_row.obligation_name, obligation_row.financial_entry_type)
      ),
      'Projecao automatica: ' || obligation_row.obligation_name || coalesce(' - ' || nullif(obligation_row.obligation_period, ''), ''),
      obligation_row.projected_amount,
      'predicted',
      'predicted',
      'obligation_projection',
      'not_applicable',
      'approved',
      'Acessorias',
      nullif(obligation_row.protocol, ''),
      nullif(obligation_row.notes, ''),
      false,
      false,
      'obligation_projection',
      projection_key,
      null
    )
    ON CONFLICT (client_id, integration_source, integration_key)
    DO UPDATE SET
      entry_date = EXCLUDED.entry_date,
      due_date = EXCLUDED.due_date,
      effective_date = null,
      competence_month = EXCLUDED.competence_month,
      account_id = EXCLUDED.account_id,
      entry_type = EXCLUDED.entry_type,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      amount = EXCLUDED.amount,
      status = 'predicted',
      lifecycle_status = 'predicted',
      origin_type = 'obligation_projection',
      reconciliation_status = 'not_applicable',
      review_status = 'approved',
      counterparty_name = EXCLUDED.counterparty_name,
      document_ref = EXCLUDED.document_ref,
      notes = EXCLUDED.notes,
      is_transfer = false,
      is_hidden_from_projection = false,
      updated_at = now();
  ELSE
    DELETE FROM public.client_cashflow_entries
    WHERE client_id = obligation_row.client_id
      AND integration_source = 'obligation_projection'
      AND integration_key = projection_key;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_cashflow_consultive_state(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  client_name_value text;
  today_date date := current_date;
  horizon_7 date := current_date + 7;
  horizon_15 date := current_date + 15;
  horizon_30 date := current_date + 30;
  current_balance_value numeric(14,2) := 0;
  pending_variation_7 numeric(14,2) := 0;
  pending_variation_15 numeric(14,2) := 0;
  pending_variation_30 numeric(14,2) := 0;
  projected_balance_7_value numeric(14,2) := 0;
  projected_balance_15_value numeric(14,2) := 0;
  projected_balance_30_value numeric(14,2) := 0;
  overdue_count integer := 0;
  pending_review_count integer := 0;
  pending_reconciliation_count integer := 0;
  reviewable_count integer := 0;
  reviewed_count integer := 0;
  review_coverage_value numeric(5,4) := 1;
  future_expense_total_15 numeric(14,2) := 0;
  last_activity_value timestamptz;
  critical_calendar_count integer := 0;
  projected_gap_date_value date;
  projected_gap_balance_value numeric(14,2);
  health_status_value text := 'em_dia';
  health_reasons text[] := '{}'::text[];
  active_alert_keys text[] := '{}'::text[];
  active_task_ids text[] := '{}'::text[];
BEGIN
  SELECT c.name
  INTO client_name_value
  FROM public.clients c
  WHERE c.id = _client_id;

  IF client_name_value IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'client_not_found');
  END IF;

  WITH entry_scope AS (
    SELECT
      e.id,
      e.created_at,
      e.updated_at,
      coalesce(e.due_date, e.entry_date) AS due_date_resolved,
      CASE
        WHEN e.lifecycle_status IS NOT NULL THEN e.lifecycle_status
        WHEN e.status = 'confirmed' OR e.effective_date IS NOT NULL THEN 'confirmed'
        WHEN coalesce(e.due_date, e.entry_date) < today_date THEN 'overdue'
        WHEN coalesce(e.due_date, e.entry_date) = today_date THEN 'due'
        ELSE 'predicted'
      END AS lifecycle_resolved,
      CASE
        WHEN e.entry_type = 'income' THEN e.amount
        ELSE -e.amount
      END AS signed_amount,
      CASE
        WHEN e.status = 'confirmed' OR e.effective_date IS NOT NULL OR e.lifecycle_status = 'confirmed' THEN coalesce(e.effective_date, coalesce(e.due_date, e.entry_date))
        ELSE coalesce(e.due_date, e.entry_date)
      END AS reference_date,
      e.amount,
      e.entry_type,
      e.origin_type,
      e.review_status,
      e.reconciliation_status,
      (NOT e.is_hidden_from_projection AND NOT e.is_transfer) AS visible_in_projection
    FROM public.client_cashflow_entries e
    WHERE e.client_id = _client_id
  )
  SELECT
    coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved = 'confirmed' AND reference_date <= today_date THEN signed_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved <> 'confirmed' AND due_date_resolved <= horizon_7 THEN signed_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved <> 'confirmed' AND due_date_resolved <= horizon_15 THEN signed_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved <> 'confirmed' AND due_date_resolved <= horizon_30 THEN signed_amount ELSE 0 END), 0),
    count(*) FILTER (WHERE lifecycle_resolved = 'overdue'),
    count(*) FILTER (WHERE review_status = 'pending_review'),
    count(*) FILTER (WHERE reconciliation_status = 'pending'),
    count(*) FILTER (WHERE origin_type IN ('open_finance', 'import_file')),
    count(*) FILTER (WHERE origin_type IN ('open_finance', 'import_file') AND review_status IN ('classified', 'approved')),
    coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved <> 'confirmed' AND due_date_resolved <= horizon_15 AND entry_type = 'expense' THEN amount ELSE 0 END), 0),
    max(updated_at)
  INTO
    current_balance_value,
    pending_variation_7,
    pending_variation_15,
    pending_variation_30,
    overdue_count,
    pending_review_count,
    pending_reconciliation_count,
    reviewable_count,
    reviewed_count,
    future_expense_total_15,
    last_activity_value
  FROM entry_scope;

  projected_balance_7_value := current_balance_value + pending_variation_7;
  projected_balance_15_value := current_balance_value + pending_variation_15;
  projected_balance_30_value := current_balance_value + pending_variation_30;
  review_coverage_value := CASE
    WHEN reviewable_count = 0 THEN 1
    ELSE round(reviewed_count::numeric / reviewable_count::numeric, 4)
  END;

  WITH entry_scope AS (
    SELECT
      e.id,
      e.created_at,
      coalesce(e.due_date, e.entry_date) AS due_date_resolved,
      CASE
        WHEN e.lifecycle_status IS NOT NULL THEN e.lifecycle_status
        WHEN e.status = 'confirmed' OR e.effective_date IS NOT NULL THEN 'confirmed'
        WHEN coalesce(e.due_date, e.entry_date) < today_date THEN 'overdue'
        WHEN coalesce(e.due_date, e.entry_date) = today_date THEN 'due'
        ELSE 'predicted'
      END AS lifecycle_resolved,
      CASE
        WHEN e.entry_type = 'income' THEN e.amount
        ELSE -e.amount
      END AS signed_amount,
      (NOT e.is_hidden_from_projection AND NOT e.is_transfer) AS visible_in_projection
    FROM public.client_cashflow_entries e
    WHERE e.client_id = _client_id
  ),
  current_cash AS (
    SELECT coalesce(sum(CASE WHEN visible_in_projection AND lifecycle_resolved = 'confirmed' THEN signed_amount ELSE 0 END), 0) AS balance_value
    FROM entry_scope
  ),
  pending_rows AS (
    SELECT
      due_date_resolved,
      created_at,
      id,
      signed_amount
    FROM entry_scope
    WHERE visible_in_projection
      AND lifecycle_resolved <> 'confirmed'
      AND due_date_resolved BETWEEN today_date AND horizon_30
    ORDER BY due_date_resolved, created_at, id
  ),
  running_balance AS (
    SELECT
      pending_rows.due_date_resolved,
      current_cash.balance_value + sum(pending_rows.signed_amount) OVER (ORDER BY pending_rows.due_date_resolved, pending_rows.created_at, pending_rows.id) AS balance_after
    FROM pending_rows
    CROSS JOIN current_cash
  )
  SELECT due_date_resolved, balance_after
  INTO projected_gap_date_value, projected_gap_balance_value
  FROM running_balance
  WHERE balance_after < 0
  ORDER BY due_date_resolved
  LIMIT 1;

  SELECT count(*)
  INTO critical_calendar_count
  FROM public.calendar_events ce
  JOIN public.clients c
    ON c.name = ce.client_name
  WHERE c.id = _client_id
    AND ce.status = 'pending'
    AND ce.priority IN ('alta', 'urgente')
    AND ce.due_at::date BETWEEN today_date AND horizon_30;

  IF projected_balance_30_value < 0 OR overdue_count >= 5 THEN
    health_status_value := 'critico';
  ELSIF projected_balance_15_value < 0
    OR overdue_count > 0
    OR pending_review_count > 0
    OR pending_reconciliation_count > 0
    OR (reviewable_count >= 5 AND review_coverage_value < 0.70)
    OR critical_calendar_count > 0
    OR (last_activity_value IS NULL OR last_activity_value < now() - interval '21 days') THEN
    health_status_value := 'atencao';
  END IF;

  IF projected_balance_30_value < 0 THEN
    health_reasons := array_append(health_reasons, 'saldo_projetado_insuficiente');
    active_alert_keys := array_append(active_alert_keys, 'projected_negative_cash');
    active_task_ids := array_append(active_task_ids, _client_id::text || ':projected_negative_cash');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'projected_negative_cash',
      'critical',
      'Saldo projetado insuficiente',
      'O caixa projetado fica negativo ate ' || to_char(coalesce(projected_gap_date_value, horizon_30), 'DD/MM/YYYY') || '.',
      jsonb_build_object(
        'projected_balance_30', projected_balance_30_value,
        'projected_gap_date', projected_gap_date_value,
        'projected_gap_balance', projected_gap_balance_value
      )
    );

    PERFORM public.upsert_cashflow_consultive_task(
      _client_id,
      _client_id::text || ':projected_negative_cash',
      '[Caixa consultivo] ' || client_name_value || ' - saldo projetado insuficiente',
      'O saldo projetado do cliente fica negativo ate ' || to_char(coalesce(projected_gap_date_value, horizon_30), 'DD/MM/YYYY') || '. Revise entradas futuras, prazos e necessidade de aporte.',
      'urgent',
      coalesce(projected_gap_date_value, horizon_7),
      jsonb_build_object(
        'alert_key', 'projected_negative_cash',
        'projected_balance_30', projected_balance_30_value,
        'projected_gap_date', projected_gap_date_value
      )
    );
  END IF;

  IF future_expense_total_15 > greatest(current_balance_value, 0) * 0.60
    AND future_expense_total_15 >= 1000 THEN
    health_reasons := array_append(health_reasons, 'saidas_relevantes_sem_provisao');
    active_alert_keys := array_append(active_alert_keys, 'relevant_future_expenses');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'relevant_future_expenses',
      'warning',
      'Ha saidas relevantes sem provisao',
      'As saidas previstas para os proximos 15 dias exigem caixa de apoio ou reorganizacao de prazo.',
      jsonb_build_object(
        'future_expense_total_15', future_expense_total_15,
        'current_balance', current_balance_value
      )
    );
  END IF;

  IF pending_review_count > 0 OR pending_reconciliation_count > 0 THEN
    health_reasons := array_append(health_reasons, 'extratos_sem_revisao');
    active_alert_keys := array_append(active_alert_keys, 'unreviewed_imports');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'unreviewed_imports',
      'warning',
      'Ha extratos importados sem revisao',
      'Ainda existem itens importados aguardando classificacao ou conciliacao no caixa.',
      jsonb_build_object(
        'pending_review_entries', pending_review_count,
        'pending_reconciliation_entries', pending_reconciliation_count
      )
    );
  END IF;

  IF overdue_count > 0 THEN
    health_reasons := array_append(health_reasons, 'lancamentos_vencidos');
    active_alert_keys := array_append(active_alert_keys, 'overdue_entries');
    active_task_ids := array_append(active_task_ids, _client_id::text || ':overdue_entries');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'overdue_entries',
      'warning',
      'Ha lancamentos vencidos sem baixa',
      'Existem itens previstos com vencimento passado que precisam de tratamento operacional.',
      jsonb_build_object('overdue_entries', overdue_count)
    );

    IF overdue_count >= 3 THEN
      PERFORM public.upsert_cashflow_consultive_task(
        _client_id,
        _client_id::text || ':overdue_entries',
        '[Caixa consultivo] ' || client_name_value || ' - vencidos em aberto',
        'O cliente possui ' || overdue_count::text || ' lancamentos vencidos sem baixa. A equipe precisa revisar o que esta realmente em atraso e o que deve ser reclassificado.',
        CASE WHEN overdue_count >= 5 THEN 'urgent' ELSE 'high' END,
        today_date + 1,
        jsonb_build_object(
          'alert_key', 'overdue_entries',
          'overdue_entries', overdue_count
        )
      );
    END IF;
  END IF;

  IF reviewable_count >= 5 AND review_coverage_value < 0.70 THEN
    health_reasons := array_append(health_reasons, 'baixa_cobertura_classificacao');
    active_alert_keys := array_append(active_alert_keys, 'low_classification_coverage');
    active_task_ids := array_append(active_task_ids, _client_id::text || ':low_classification_coverage');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'low_classification_coverage',
      'warning',
      'Baixa cobertura de classificacao',
      'A maior parte das importacoes ainda nao recebeu classificacao confiavel.',
      jsonb_build_object(
        'review_coverage', review_coverage_value,
        'reviewable_entries', reviewable_count
      )
    );

    PERFORM public.upsert_cashflow_consultive_task(
      _client_id,
      _client_id::text || ':low_classification_coverage',
      '[Caixa consultivo] ' || client_name_value || ' - cobertura baixa de classificacao',
      'A cobertura de classificacao automatica/revisada caiu para ' || to_char(review_coverage_value * 100, 'FM990D00') || '%. Revise regras e fila de classificacao.',
      'high',
      today_date + 2,
      jsonb_build_object(
        'alert_key', 'low_classification_coverage',
        'review_coverage', review_coverage_value
      )
    );
  END IF;

  IF last_activity_value IS NULL OR last_activity_value < now() - interval '21 days' THEN
    health_reasons := array_append(health_reasons, 'ausencia_de_atualizacao');
    active_alert_keys := array_append(active_alert_keys, 'cashflow_inactivity');
    active_task_ids := array_append(active_task_ids, _client_id::text || ':cashflow_inactivity');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'cashflow_inactivity',
      'warning',
      'Ha ausencia de atualizacao no caixa',
      'O modulo de caixa nao recebe atualizacao relevante ha mais de 21 dias.',
      jsonb_build_object('last_activity_at', last_activity_value)
    );

    PERFORM public.upsert_cashflow_consultive_task(
      _client_id,
      _client_id::text || ':cashflow_inactivity',
      '[Caixa consultivo] ' || client_name_value || ' - caixa sem atualizacao',
      'O cliente esta ha mais de 21 dias sem atualizacao relevante no caixa. Validar se o processo travou ou se faltam extratos/lancamentos.',
      'high',
      today_date + 3,
      jsonb_build_object(
        'alert_key', 'cashflow_inactivity',
        'last_activity_at', last_activity_value
      )
    );
  END IF;

  IF critical_calendar_count > 0 THEN
    health_reasons := array_append(health_reasons, 'eventos_criticos_no_calendario');
    active_alert_keys := array_append(active_alert_keys, 'critical_calendar_events');

    PERFORM public.upsert_client_cashflow_consultive_alert(
      _client_id,
      'critical_calendar_events',
      'warning',
      'Ha eventos criticos com impacto potencial de caixa',
      'O calendario possui eventos de alta prioridade que podem afetar o caixa e ainda nao viraram provisao financeira confiavel.',
      jsonb_build_object('critical_calendar_events', critical_calendar_count)
    );
  END IF;

  INSERT INTO public.client_cashflow_health_snapshots (
    client_id,
    health_status,
    current_balance,
    projected_balance_7,
    projected_balance_15,
    projected_balance_30,
    overdue_entries,
    pending_review_entries,
    pending_reconciliation_entries,
    review_coverage,
    critical_calendar_events,
    last_activity_at,
    projected_gap_date,
    metadata,
    generated_at
  )
  VALUES (
    _client_id,
    health_status_value,
    round(current_balance_value, 2),
    round(projected_balance_7_value, 2),
    round(projected_balance_15_value, 2),
    round(projected_balance_30_value, 2),
    overdue_count,
    pending_review_count,
    pending_reconciliation_count,
    review_coverage_value,
    critical_calendar_count,
    last_activity_value,
    projected_gap_date_value,
    jsonb_build_object(
      'health_reasons', health_reasons,
      'future_expense_total_15', future_expense_total_15,
      'reviewable_entries', reviewable_count,
      'reviewed_entries', reviewed_count
    ),
    now()
  )
  ON CONFLICT (client_id)
  DO UPDATE SET
    health_status = EXCLUDED.health_status,
    current_balance = EXCLUDED.current_balance,
    projected_balance_7 = EXCLUDED.projected_balance_7,
    projected_balance_15 = EXCLUDED.projected_balance_15,
    projected_balance_30 = EXCLUDED.projected_balance_30,
    overdue_entries = EXCLUDED.overdue_entries,
    pending_review_entries = EXCLUDED.pending_review_entries,
    pending_reconciliation_entries = EXCLUDED.pending_reconciliation_entries,
    review_coverage = EXCLUDED.review_coverage,
    critical_calendar_events = EXCLUDED.critical_calendar_events,
    last_activity_at = EXCLUDED.last_activity_at,
    projected_gap_date = EXCLUDED.projected_gap_date,
    metadata = EXCLUDED.metadata,
    generated_at = now(),
    updated_at = now();

  PERFORM public.resolve_cashflow_consultive_alerts(_client_id, active_alert_keys);
  PERFORM public.resolve_cashflow_consultive_tasks(_client_id, active_task_ids);

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', _client_id,
    'health_status', health_status_value,
    'projected_balance_30', round(projected_balance_30_value, 2),
    'overdue_entries', overdue_count,
    'pending_review_entries', pending_review_count,
    'pending_reconciliation_entries', pending_reconciliation_count,
    'review_coverage', review_coverage_value,
    'projected_gap_date', projected_gap_date_value,
    'critical_calendar_events', critical_calendar_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_client_cashflow_consultive_entry_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_client_id uuid;
BEGIN
  affected_client_id := coalesce(NEW.client_id, OLD.client_id);

  IF affected_client_id IS NOT NULL THEN
    PERFORM public.refresh_client_cashflow_consultive_state(affected_client_id);
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS zz_refresh_client_cashflow_consultive_state ON public.client_cashflow_entries;
CREATE TRIGGER zz_refresh_client_cashflow_consultive_state
  AFTER INSERT OR UPDATE OR DELETE ON public.client_cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_cashflow_consultive_entry_refresh();

CREATE OR REPLACE FUNCTION public.handle_client_acessorias_obligation_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.client_cashflow_entries
    WHERE client_id = OLD.client_id
      AND integration_source = 'obligation_projection'
      AND integration_key = 'acessorias:' || OLD.id::text;

    RETURN OLD;
  END IF;

  PERFORM public.sync_cashflow_projection_from_obligation(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_handle_client_acessorias_obligation_projection ON public.client_acessorias_obligations;
CREATE TRIGGER zz_handle_client_acessorias_obligation_projection
  AFTER INSERT OR UPDATE OR DELETE ON public.client_acessorias_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_acessorias_obligation_projection();

CREATE OR REPLACE FUNCTION public.handle_cashflow_consultive_calendar_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_client_name text := coalesce(NEW.client_name, OLD.client_name);
  affected_client_id uuid;
BEGIN
  IF affected_client_name IS NULL OR btrim(affected_client_name) = '' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT c.id
  INTO affected_client_id
  FROM public.clients c
  WHERE c.name = affected_client_name
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF affected_client_id IS NOT NULL THEN
    PERFORM public.refresh_client_cashflow_consultive_state(affected_client_id);
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS zz_refresh_cashflow_consultive_from_calendar ON public.calendar_events;
CREATE TRIGGER zz_refresh_cashflow_consultive_from_calendar
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cashflow_consultive_calendar_refresh();

DO $$
DECLARE
  client_row record;
BEGIN
  FOR client_row IN
    SELECT c.id
    FROM public.clients c
    WHERE c.portal_cashflow_enabled = true
       OR EXISTS (
         SELECT 1
         FROM public.client_cashflow_entries e
         WHERE e.client_id = c.id
       )
       OR EXISTS (
         SELECT 1
         FROM public.client_acessorias_obligations o
         WHERE o.client_id = c.id
       )
  LOOP
    PERFORM public.refresh_client_cashflow_consultive_state(client_row.id);
  END LOOP;
END;
$$;
