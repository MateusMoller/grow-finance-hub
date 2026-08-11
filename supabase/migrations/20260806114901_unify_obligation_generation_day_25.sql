-- Canonical obligation occurrence engine.
-- The database is the only rule owner. The Edge Function only invokes this RPC.

ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS competence_granularity text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS competence_year_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date_adjustment_policy text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'obligation_templates_competence_granularity_check') THEN
    ALTER TABLE public.obligation_templates ADD CONSTRAINT obligation_templates_competence_granularity_check
      CHECK (competence_granularity IN ('month', 'quarter', 'year'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'obligation_templates_competence_year_offset_check') THEN
    ALTER TABLE public.obligation_templates ADD CONSTRAINT obligation_templates_competence_year_offset_check
      CHECK (competence_year_offset BETWEEN -5 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'obligation_templates_due_date_adjustment_policy_check') THEN
    ALTER TABLE public.obligation_templates ADD CONSTRAINT obligation_templates_due_date_adjustment_policy_check
      CHECK (due_date_adjustment_policy IN ('none', 'previous_business_day', 'next_business_day'));
  END IF;
END $$;

UPDATE public.obligation_templates
SET competence_granularity = CASE periodicity WHEN 'quarterly' THEN 'quarter' WHEN 'yearly' THEN 'year' ELSE 'month' END;

ALTER TABLE public.obligation_instances
  ADD COLUMN IF NOT EXISTS operational_month date,
  ADD COLUMN IF NOT EXISTS occurrence_key text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS superseded_by_instance_id uuid REFERENCES public.obligation_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_run_id uuid;

CREATE TABLE IF NOT EXISTS public.obligation_business_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'national' CHECK (scope IN ('national', 'organization')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (organization_id, holiday_date, name)
);

CREATE INDEX IF NOT EXISTS idx_obligation_business_holidays_date_org
  ON public.obligation_business_holidays (holiday_date, organization_id);
ALTER TABLE public.obligation_business_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Internal can view obligation business holidays" ON public.obligation_business_holidays;
CREATE POLICY "Internal can view obligation business holidays" ON public.obligation_business_holidays
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_internal_user((SELECT auth.uid()), organization_id));
REVOKE ALL ON public.obligation_business_holidays FROM anon;
GRANT SELECT ON public.obligation_business_holidays TO authenticated;
GRANT ALL ON public.obligation_business_holidays TO service_role;

CREATE TABLE IF NOT EXISTS public.obligation_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_date date NOT NULL,
  operational_month date NOT NULL,
  source text NOT NULL CHECK (source IN ('monthly_cron', 'manual_rpc', 'migration_repair')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  created_instances integer NOT NULL DEFAULT 0,
  created_tasks integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_obligation_generation_runs_operational_month
  ON public.obligation_generation_runs (operational_month DESC, organization_id, started_at DESC);
ALTER TABLE public.obligation_generation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Internal can view obligation generation runs" ON public.obligation_generation_runs;
CREATE POLICY "Internal can view obligation generation runs" ON public.obligation_generation_runs
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_internal_user((SELECT auth.uid()), organization_id));
REVOKE ALL ON public.obligation_generation_runs FROM anon, authenticated;
GRANT SELECT ON public.obligation_generation_runs TO authenticated;
GRANT ALL ON public.obligation_generation_runs TO service_role;

ALTER TABLE public.obligation_instances
  DROP CONSTRAINT IF EXISTS obligation_instances_generation_run_id_fkey;
ALTER TABLE public.obligation_instances
  ADD CONSTRAINT obligation_instances_generation_run_id_fkey
  FOREIGN KEY (generation_run_id) REFERENCES public.obligation_generation_runs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_obligation_business_day(_date date, _organization_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT extract(isodow FROM _date)::integer BETWEEN 1 AND 5
    AND NOT EXISTS (
      SELECT 1 FROM public.obligation_business_holidays holiday
      WHERE holiday.holiday_date = _date
        AND (holiday.organization_id IS NULL OR holiday.organization_id = _organization_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.adjust_obligation_business_date(
  _date date, _organization_id uuid, _policy text
) RETURNS date LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE result_date date := _date;
BEGIN
  IF coalesce(_policy, 'none') = 'none' THEN RETURN result_date; END IF;
  WHILE NOT public.is_obligation_business_day(result_date, _organization_id) LOOP
    result_date := result_date + CASE WHEN _policy = 'previous_business_day' THEN -1 ELSE 1 END;
  END LOOP;
  RETURN result_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_obligation_due_date_canonical(
  _operational_month date,
  _organization_id uuid,
  _due_day integer,
  _technical_due_month_reference text DEFAULT 'vigente',
  _due_rule_type text DEFAULT 'calendar_day',
  _due_business_day_index integer DEFAULT NULL,
  _due_fixed_month integer DEFAULT NULL,
  _due_fixed_day integer DEFAULT NULL,
  _adjustment_policy text DEFAULT 'none'
) RETURNS date LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  due_base date := date_trunc('month', _operational_month)::date;
  cursor_date date;
  month_end date;
  seen integer := 0;
  wanted integer := greatest(1, least(coalesce(_due_business_day_index, _due_day, 1), 23));
  wanted_month integer;
  wanted_day integer;
BEGIN
  IF coalesce(_technical_due_month_reference, 'vigente') = 'anterior' THEN
    due_base := (due_base - interval '1 month')::date;
  END IF;
  IF coalesce(_due_rule_type, 'calendar_day') = 'fixed_date' THEN
    wanted_month := greatest(1, least(coalesce(_due_fixed_month, extract(month FROM due_base)::integer), 12));
    due_base := make_date(extract(year FROM _operational_month)::integer, wanted_month, 1);
  END IF;
  month_end := (due_base + interval '1 month - 1 day')::date;

  IF _due_rule_type = 'business_day_from_month_start' THEN
    cursor_date := due_base;
    WHILE cursor_date <= month_end LOOP
      IF public.is_obligation_business_day(cursor_date, _organization_id) THEN
        seen := seen + 1;
        IF seen = wanted THEN RETURN cursor_date; END IF;
      END IF;
      cursor_date := cursor_date + 1;
    END LOOP;
  ELSIF _due_rule_type = 'last_business_day' THEN
    cursor_date := month_end;
    WHILE NOT public.is_obligation_business_day(cursor_date, _organization_id) LOOP cursor_date := cursor_date - 1; END LOOP;
    RETURN cursor_date;
  END IF;

  wanted_day := greatest(1, least(coalesce(_due_fixed_day, _due_day, 1), extract(day FROM month_end)::integer));
  RETURN public.adjust_obligation_business_date(due_base + (wanted_day - 1), _organization_id, _adjustment_policy);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_obligation_occurrences(
  _base_date date DEFAULT CURRENT_DATE,
  _organization_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _source text DEFAULT 'manual_rpc'
) RETURNS TABLE(run_id uuid, operational_month date, created_instances integer, created_tasks integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_month date := (date_trunc('month', _base_date)::date + interval '1 month')::date;
  current_run_id uuid;
BEGIN
  IF _source NOT IN ('monthly_cron', 'manual_rpc', 'migration_repair') THEN RAISE EXCEPTION 'Invalid generation source'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('grow-obligations:' || coalesce(_organization_id::text, 'all') || ':' || target_month::text, 0)) THEN
    RAISE EXCEPTION 'Obligation generation is already running for %', target_month;
  END IF;

  INSERT INTO public.obligation_generation_runs (organization_id, base_date, operational_month, source)
  VALUES (_organization_id, _base_date, target_month, _source) RETURNING id INTO current_run_id;

  WITH candidates AS (
    SELECT p.id profile_id, p.client_id, p.template_id,
      coalesce(p.organization_id, t.organization_id, c.organization_id) organization_id,
      p.assigned_to, p.start_date, p.end_date, p.due_day_override, p.yearly_due_month_override,
      p.legal_due_day_override, t.name template_name, t.sector, t.periodicity, t.competence_reference,
      t.competence_year_offset, t.competence_granularity, t.due_day, t.due_rule_type,
      t.due_business_day_index, t.due_fixed_month, t.due_fixed_day, t.due_fixed_dates,
      t.yearly_due_month, t.legal_due_day, t.priority, t.technical_due_month_reference,
      t.due_date_adjustment_policy, c.name client_name
    FROM public.client_obligation_profiles p
    JOIN public.obligation_templates t ON t.id = p.template_id
    JOIN public.clients c ON c.id = p.client_id
    WHERE p.is_active AND t.is_active
      AND (_organization_id IS NULL OR coalesce(p.organization_id, t.organization_id, c.organization_id) = _organization_id)
      AND (_client_id IS NULL OR p.client_id = _client_id)
      AND date_trunc('month', p.start_date)::date <= target_month
      AND (p.end_date IS NULL OR date_trunc('month', p.end_date)::date >= target_month)
      AND (t.periodicity = 'monthly'
        OR (t.periodicity = 'quarterly' AND extract(month FROM target_month)::integer IN (1,4,7,10))
        OR (t.periodicity = 'yearly' AND (
          extract(month FROM target_month)::integer = coalesce(p.yearly_due_month_override, t.due_fixed_month, t.yearly_due_month, 1)
          OR (t.due_rule_type='fixed_date' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(coalesce(t.due_fixed_dates,'[]')) fd
            WHERE (fd->>'month')::integer=extract(month FROM target_month)::integer
          ))
        )))
  ), expanded AS (
    SELECT c.*, x.fixed_month, x.fixed_day, x.fixed_label, x.installment_number
    FROM candidates c
    CROSS JOIN LATERAL (
      SELECT NULL::integer, NULL::integer, NULL::text, 1
      WHERE c.due_rule_type <> 'fixed_date' OR c.periodicity <> 'yearly'
      UNION ALL
      SELECT greatest(1, least(coalesce((v.value->>'month')::integer, c.due_fixed_month, c.yearly_due_month, 1),12)),
             greatest(1, least(coalesce((v.value->>'day')::integer, c.due_fixed_day, c.due_day, 1),31)),
             nullif(v.value->>'label',''), v.ordinality::integer
      FROM jsonb_array_elements(CASE WHEN jsonb_array_length(coalesce(c.due_fixed_dates,'[]')) > 0 THEN c.due_fixed_dates
        ELSE jsonb_build_array(jsonb_build_object('month',coalesce(c.due_fixed_month,c.yearly_due_month,1),'day',coalesce(c.due_fixed_day,c.due_day,1))) END)
        WITH ORDINALITY v(value, ordinality)
      WHERE c.due_rule_type = 'fixed_date' AND c.periodicity = 'yearly'
        AND coalesce((v.value->>'month')::integer, c.due_fixed_month, c.yearly_due_month, 1) = extract(month FROM target_month)::integer
    ) x(fixed_month, fixed_day, fixed_label, installment_number)
  ), calculated AS (
    SELECT e.*,
      CASE WHEN e.competence_reference = 'anterior' THEN (target_month - interval '1 month')::date ELSE target_month END
        + make_interval(years => e.competence_year_offset) AS competence_month,
      public.compute_obligation_due_date_canonical(target_month, e.organization_id,
        coalesce(e.due_day_override,e.due_day), e.technical_due_month_reference, e.due_rule_type,
        e.due_business_day_index, coalesce(e.fixed_month,e.due_fixed_month), coalesce(e.fixed_day,e.due_fixed_day),
        e.due_date_adjustment_policy) AS due_date
    FROM expanded e
  ), inserted AS (
    INSERT INTO public.obligation_instances (
      organization_id, client_id, profile_id, template_id, competence_label, competence_date, competence_key,
      operational_month, occurrence_key, installment_number, technical_due_date, legal_due_date, status,
      priority, current_assignee, origin, document_required, created_by, generation_run_id
    )
    SELECT organization_id, client_id, profile_id, template_id,
      CASE competence_granularity WHEN 'year' THEN extract(year FROM competence_month)::text
        WHEN 'quarter' THEN extract(year FROM competence_month)::text || ' - T' || extract(quarter FROM competence_month)::integer
        ELSE to_char(competence_month,'MM/YYYY') END || coalesce(' - ' || fixed_label,''),
      date_trunc('month', competence_month)::date,
      (CASE competence_granularity WHEN 'year' THEN extract(year FROM competence_month)::text
        WHEN 'quarter' THEN extract(year FROM competence_month)::text || '-Q' || extract(quarter FROM competence_month)::integer
        ELSE to_char(competence_month,'YYYY-MM') END) ||
        CASE WHEN fixed_month IS NULL THEN '' ELSE ':'||lpad(fixed_month::text,2,'0')||'-'||lpad(fixed_day::text,2,'0') END,
      target_month,
      client_id::text || ':' || template_id::text || ':' || to_char(target_month,'YYYY-MM') ||
        CASE WHEN fixed_month IS NULL THEN '' ELSE ':' || lpad(fixed_month::text,2,'0') || '-' || lpad(fixed_day::text,2,'0') END,
      installment_number, due_date,
      CASE WHEN legal_due_day IS NULL THEN NULL ELSE public.compute_obligation_due_date_canonical(target_month, organization_id,
        coalesce(legal_due_day_override,legal_due_day), 'vigente', 'calendar_day', NULL, NULL, NULL, due_date_adjustment_policy) END,
      'pendente', priority, assigned_to, 'grow_native', true, _actor_id, current_run_id
    FROM calculated
    ON CONFLICT (client_id, template_id, competence_key) DO NOTHING
    RETURNING *
  ), task_rows AS (
    INSERT INTO public.kanban_tasks (organization_id,title,description,sector,client_name,assignee,assigned_to_user_id,
      priority,status,due_date,integration_source,integration_task_id,integration_payload)
    SELECT i.organization_id, t.name || ' - ' || c.name, 'Obrigacao Grow' || E'\nCompetencia: ' || i.competence_label,
      t.sector,c.name,i.current_assignee::text,i.current_assignee,i.priority,'backlog',i.technical_due_date,
      'grow_obligation_task','instance:'||i.id::text,
      jsonb_build_object('instance_id',i.id,'template_id',i.template_id,'profile_id',i.profile_id,
        'generated_by',_source,'operational_month',target_month,'occurrence_key',i.occurrence_key)
    FROM inserted i JOIN public.obligation_templates t ON t.id=i.template_id JOIN public.clients c ON c.id=i.client_id
    ON CONFLICT (integration_source,integration_task_id) DO NOTHING RETURNING id
  )
  SELECT (SELECT count(*) FROM inserted), (SELECT count(*) FROM task_rows)
  INTO created_instances, created_tasks;

  UPDATE public.obligation_generation_runs SET status='completed', created_instances=generate_obligation_occurrences.created_instances,
    created_tasks=generate_obligation_occurrences.created_tasks, completed_at=now() WHERE id=current_run_id;
  run_id := current_run_id; operational_month := target_month; RETURN NEXT;
EXCEPTION WHEN OTHERS THEN
  IF current_run_id IS NOT NULL THEN
    UPDATE public.obligation_generation_runs SET status='failed', details=jsonb_build_object('error',SQLERRM), completed_at=now() WHERE id=current_run_id;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_obligation_occurrences(date,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_obligation_occurrences(date,uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_next_month_obligation_tasks(_base_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(created_instances integer, created_tasks integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT generated.created_instances, generated.created_tasks
  FROM public.generate_obligation_occurrences(_base_date, NULL, NULL, NULL, 'monthly_cron') generated;
$$;
REVOKE ALL ON FUNCTION public.generate_next_month_obligation_tasks(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_month_obligation_tasks(date) TO service_role;

-- Backfill canonical identity, then preserve and supersede semantic duplicates.
UPDATE public.obligation_instances i SET
  operational_month = date_trunc('month', i.technical_due_date)::date,
  occurrence_key = i.client_id::text || ':' || i.template_id::text || ':' || to_char(i.technical_due_date,'YYYY-MM')
WHERE i.operational_month IS NULL OR i.occurrence_key IS NULL;

INSERT INTO public.obligation_audit_events (organization_id,client_id,template_id,entity_type,entity_id,action,metadata)
SELECT i.organization_id,i.client_id,i.template_id,'obligation_instance',i.id,'competence_mismatch_detected',
  jsonb_build_object('previous_competence_date',i.competence_date,'previous_competence_key',i.competence_key,
    'expected_competence_date',(i.operational_month-interval '1 month')::date,'technical_due_date',i.technical_due_date)
FROM public.obligation_instances i JOIN public.obligation_templates t ON t.id=i.template_id
WHERE t.periodicity='monthly' AND t.competence_reference='anterior'
  AND i.competence_date<> (i.operational_month-interval '1 month')::date
  AND NOT EXISTS (SELECT 1 FROM public.obligation_audit_events a WHERE a.entity_id=i.id AND a.action='competence_mismatch_detected');

WITH ranked AS (
  SELECT i.id,
    first_value(i.id) OVER (PARTITION BY i.organization_id,i.client_id,i.template_id,i.technical_due_date
      ORDER BY (i.competence_date = CASE WHEN t.competence_reference='anterior'
        THEN (date_trunc('month',i.technical_due_date)-interval '1 month')::date
        ELSE date_trunc('month',i.technical_due_date)::date END) DESC, i.created_at DESC) winner_id,
    row_number() OVER (PARTITION BY i.organization_id,i.client_id,i.template_id,i.technical_due_date
      ORDER BY (i.competence_date = CASE WHEN t.competence_reference='anterior'
        THEN (date_trunc('month',i.technical_due_date)-interval '1 month')::date
        ELSE date_trunc('month',i.technical_due_date)::date END) DESC, i.created_at DESC) rank_no
  FROM public.obligation_instances i JOIN public.obligation_templates t ON t.id=i.template_id
  WHERE i.superseded_by_instance_id IS NULL
), duplicates AS (SELECT id,winner_id FROM ranked WHERE rank_no>1)
UPDATE public.obligation_instances loser SET superseded_by_instance_id=d.winner_id, status='cancelada',
  completion_notes=concat_ws(E'\n',loser.completion_notes,'Instancia suplantada na unificacao do motor de competencias em 06/08/2026.'),
  occurrence_key=loser.occurrence_key||':superseded:'||loser.id::text
FROM duplicates d WHERE loser.id=d.id;

-- Correct standalone legacy rows only after paired duplicates have been isolated.
UPDATE public.obligation_instances i SET
  competence_date=(i.operational_month-interval '1 month')::date,
  competence_key=to_char(i.operational_month-interval '1 month','YYYY-MM'),
  competence_label=to_char(i.operational_month-interval '1 month','MM/YYYY')
FROM public.obligation_templates t
WHERE t.id=i.template_id AND t.periodicity='monthly' AND t.competence_reference='anterior'
  AND i.superseded_by_instance_id IS NULL
  AND i.competence_date<>(i.operational_month-interval '1 month')::date;

UPDATE public.kanban_tasks task SET
  description='Obrigacao Grow'||E'\nCompetencia: '||i.competence_label,
  due_date=i.technical_due_date,
  integration_payload=coalesce(task.integration_payload,'{}') || jsonb_build_object(
    'instance_id',i.id,'target_competence_key',i.competence_key,'operational_month',i.operational_month,'occurrence_key',i.occurrence_key)
FROM public.obligation_instances i
WHERE task.integration_source='grow_obligation_task' AND task.integration_task_id='instance:'||i.id::text
  AND i.superseded_by_instance_id IS NULL;

-- Relink operational evidence to the canonical instance; the superseded record and its events remain for audit.
UPDATE public.document_inbox_items d SET linked_instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE d.linked_instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.document_inbox_items d SET suggested_instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE d.suggested_instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.obligation_instance_files f SET instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE f.instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.document_ingestion_jobs j SET instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE j.instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.obligation_delivery_attempts a SET instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE a.instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.obligation_document_access_events a SET instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE a.instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;
UPDATE public.obligation_document_delivery_links l SET instance_id=i.superseded_by_instance_id
FROM public.obligation_instances i WHERE l.instance_id=i.id AND i.superseded_by_instance_id IS NOT NULL;

UPDATE public.kanban_tasks task SET
  integration_source='grow_obligation_task_superseded',
  integration_task_id=task.integration_task_id||':superseded',
  integration_payload=coalesce(task.integration_payload,'{}') || jsonb_build_object('superseded_by_instance_id',i.superseded_by_instance_id),
  title='[Suplantada] '||task.title,
  tags=array_append(coalesce(task.tags,'{}'),'obrigacao_suplantada'), status='done'
FROM public.obligation_instances i
WHERE task.integration_source='grow_obligation_task' AND task.integration_task_id='instance:'||i.id::text
  AND i.superseded_by_instance_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_obligation_instances_active_occurrence
  ON public.obligation_instances (organization_id, occurrence_key)
  WHERE superseded_by_instance_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_obligation_instances_operational_month
  ON public.obligation_instances (organization_id, operational_month, client_id)
  WHERE superseded_by_instance_id IS NULL;

INSERT INTO public.obligation_audit_events (organization_id,client_id,template_id,entity_type,entity_id,action,metadata)
SELECT organization_id,client_id,template_id,'obligation_instance',id,'instance_superseded_by_canonical_engine',
  jsonb_build_object('canonical_instance_id',superseded_by_instance_id,'previous_competence_key',competence_key)
FROM public.obligation_instances WHERE superseded_by_instance_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.obligation_audit_events a WHERE a.entity_id=obligation_instances.id AND a.action='instance_superseded_by_canonical_engine');

-- The overview filters naturally exclude repaired duplicates through this indexable flag.
-- Schedule only the canonical wrapper, every month on day 25 at 06:00 UTC.
DO $$ DECLARE job record; BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname IN ('generate-next-month-obligation-tasks','generate_next_month_obligation_tasks') LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;
SELECT cron.schedule('generate-next-month-obligation-tasks','0 6 25 * *',
  $$SELECT public.generate_next_month_obligation_tasks(CURRENT_DATE);$$);

-- Migration-time regression checks for month clamping, leap years and holiday-aware business days.
DO $$
DECLARE test_org uuid; result date;
BEGIN
  SELECT id INTO test_org FROM public.organizations ORDER BY created_at LIMIT 1;
  result := public.compute_obligation_due_date_canonical('2026-02-01',test_org,31,'vigente','calendar_day');
  IF result <> '2026-02-28' THEN RAISE EXCEPTION 'day 31 regression: %',result; END IF;
  result := public.compute_obligation_due_date_canonical('2028-02-01',test_org,31,'vigente','calendar_day');
  IF result <> '2028-02-29' THEN RAISE EXCEPTION 'leap year regression: %',result; END IF;
  result := public.compute_obligation_due_date_canonical('2026-02-01',test_org,5,'vigente','business_day_from_month_start',5);
  IF result <> '2026-02-06' THEN RAISE EXCEPTION 'business day regression: %',result; END IF;
  result := public.compute_obligation_due_date_canonical('2026-02-01',test_org,1,'vigente','last_business_day');
  IF result <> '2026-02-27' THEN RAISE EXCEPTION 'last business day regression: %',result; END IF;
END $$;
