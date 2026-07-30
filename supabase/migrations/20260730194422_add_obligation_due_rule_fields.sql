ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS due_rule_type text NOT NULL DEFAULT 'calendar_day',
  ADD COLUMN IF NOT EXISTS due_business_day_index integer,
  ADD COLUMN IF NOT EXISTS due_fixed_month integer,
  ADD COLUMN IF NOT EXISTS due_fixed_day integer;

UPDATE public.obligation_templates
SET
  due_rule_type = COALESCE(NULLIF(due_rule_type, ''), 'calendar_day'),
  due_fixed_month = COALESCE(due_fixed_month, yearly_due_month)
WHERE due_rule_type IS NULL
  OR due_fixed_month IS NULL;

ALTER TABLE public.obligation_templates
  ADD CONSTRAINT obligation_templates_due_rule_type_check
  CHECK (due_rule_type IN ('calendar_day', 'business_day_from_month_start', 'last_business_day', 'fixed_date'));

ALTER TABLE public.obligation_templates
  ADD CONSTRAINT obligation_templates_due_business_day_index_check
  CHECK (due_business_day_index IS NULL OR due_business_day_index BETWEEN 1 AND 23);

ALTER TABLE public.obligation_templates
  ADD CONSTRAINT obligation_templates_due_fixed_month_check
  CHECK (due_fixed_month IS NULL OR due_fixed_month BETWEEN 1 AND 12);

ALTER TABLE public.obligation_templates
  ADD CONSTRAINT obligation_templates_due_fixed_day_check
  CHECK (due_fixed_day IS NULL OR due_fixed_day BETWEEN 1 AND 31);

CREATE OR REPLACE FUNCTION public.compute_obligation_due_date(
  _competence_date date,
  _due_day integer,
  _technical_due_month_reference text DEFAULT 'vigente',
  _due_rule_type text DEFAULT 'calendar_day',
  _due_business_day_index integer DEFAULT NULL,
  _due_fixed_month integer DEFAULT NULL,
  _due_fixed_day integer DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  due_base date;
  cursor_date date;
  month_start date;
  month_end date;
  seen_business_days integer := 0;
  target_business_day integer := greatest(1, least(coalesce(_due_business_day_index, _due_day, 1), 23));
  target_month integer;
  target_day integer;
BEGIN
  due_base := date_trunc('month', _competence_date)::date;

  IF coalesce(_technical_due_month_reference, 'vigente') = 'anterior' THEN
    due_base := (due_base - interval '1 month')::date;
  END IF;

  IF coalesce(_due_rule_type, 'calendar_day') = 'business_day_from_month_start' THEN
    cursor_date := due_base;
    WHILE date_trunc('month', cursor_date)::date = due_base LOOP
      IF extract(isodow from cursor_date)::int BETWEEN 1 AND 5 THEN
        seen_business_days := seen_business_days + 1;
        IF seen_business_days = target_business_day THEN
          RETURN cursor_date;
        END IF;
      END IF;
      cursor_date := cursor_date + 1;
    END LOOP;
  END IF;

  IF coalesce(_due_rule_type, 'calendar_day') = 'last_business_day' THEN
    cursor_date := (due_base + interval '1 month - 1 day')::date;
    WHILE extract(isodow from cursor_date)::int NOT BETWEEN 1 AND 5 LOOP
      cursor_date := cursor_date - 1;
    END LOOP;
    RETURN cursor_date;
  END IF;

  IF coalesce(_due_rule_type, 'calendar_day') = 'fixed_date' THEN
    target_month := greatest(1, least(coalesce(_due_fixed_month, extract(month from due_base)::int), 12));
    month_start := make_date(extract(year from _competence_date)::int, target_month, 1);
    month_end := (month_start + interval '1 month - 1 day')::date;
    target_day := greatest(1, least(coalesce(_due_fixed_day, _due_day, 1), extract(day from month_end)::int));
    RETURN make_date(extract(year from _competence_date)::int, target_month, target_day);
  END IF;

  month_end := (due_base + interval '1 month - 1 day')::date;
  target_day := greatest(1, least(coalesce(_due_day, 1), extract(day from month_end)::int));
  RETURN due_base + (target_day - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_month_obligation_tasks(_base_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(created_instances integer, created_tasks integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_month date := (date_trunc('month', _base_date)::date + interval '1 month')::date;
BEGIN
  WITH candidate_profiles AS (
    SELECT
      profile.id AS profile_id,
      profile.client_id,
      profile.template_id,
      profile.organization_id AS profile_organization_id,
      profile.assigned_to,
      profile.start_date,
      profile.end_date,
      profile.due_day_override,
      profile.yearly_due_month_override,
      profile.legal_due_day_override,
      template.organization_id AS template_organization_id,
      template.name AS template_name,
      template.sector,
      template.periodicity,
      template.due_day,
      template.due_rule_type,
      template.due_business_day_index,
      template.due_fixed_month,
      template.due_fixed_day,
      template.yearly_due_month,
      template.legal_due_day,
      template.priority,
      template.technical_due_month_reference,
      client.organization_id AS client_organization_id,
      client.name AS client_name
    FROM public.client_obligation_profiles profile
    JOIN public.obligation_templates template
      ON template.id = profile.template_id
    JOIN public.clients client
      ON client.id = profile.client_id
    WHERE profile.is_active = true
      AND template.is_active = true
      AND date_trunc('month', profile.start_date)::date <= target_month
      AND (
        profile.end_date IS NULL
        OR date_trunc('month', profile.end_date)::date >= target_month
      )
      AND (
        template.periodicity = 'monthly'
        OR (
          template.periodicity = 'quarterly'
          AND extract(month from target_month)::int IN (1, 4, 7, 10)
        )
        OR (
          template.periodicity = 'yearly'
          AND extract(month from target_month)::int = COALESCE(profile.yearly_due_month_override, template.due_fixed_month, template.yearly_due_month, 1)
        )
      )
  ),
  instance_rows AS (
    INSERT INTO public.obligation_instances (
      organization_id,
      client_id,
      profile_id,
      template_id,
      competence_label,
      competence_date,
      competence_key,
      technical_due_date,
      legal_due_date,
      status,
      priority,
      current_assignee,
      origin,
      document_required,
      created_by
    )
    SELECT
      COALESCE(candidate.profile_organization_id, candidate.template_organization_id, candidate.client_organization_id),
      candidate.client_id,
      candidate.profile_id,
      candidate.template_id,
      to_char(target_month, 'MM/YYYY'),
      target_month,
      to_char(target_month, 'YYYY-MM'),
      public.compute_obligation_due_date(
        target_month,
        COALESCE(candidate.due_day_override, candidate.due_day),
        candidate.technical_due_month_reference,
        candidate.due_rule_type,
        candidate.due_business_day_index,
        candidate.due_fixed_month,
        candidate.due_fixed_day
      ),
      CASE
        WHEN candidate.legal_due_day IS NULL THEN NULL
        ELSE public.compute_obligation_due_date(target_month, COALESCE(candidate.legal_due_day_override, candidate.legal_due_day))
      END,
      'pendente',
      candidate.priority,
      candidate.assigned_to,
      'grow_native',
      true,
      NULL
    FROM candidate_profiles candidate
    WHERE COALESCE(candidate.profile_organization_id, candidate.template_organization_id, candidate.client_organization_id) IS NOT NULL
    ON CONFLICT (client_id, template_id, competence_key) DO NOTHING
    RETURNING *
  ),
  target_instances AS (
    SELECT
      instance.*,
      template.name AS template_name,
      template.sector,
      client.name AS client_name
    FROM (
      SELECT * FROM instance_rows
      UNION ALL
      SELECT existing_instance.*
      FROM public.obligation_instances existing_instance
      WHERE existing_instance.competence_key = to_char(target_month, 'YYYY-MM')
        AND existing_instance.organization_id IS NOT NULL
    ) instance
    JOIN public.obligation_templates template
      ON template.id = instance.template_id
    JOIN public.clients client
      ON client.id = instance.client_id
  ),
  task_rows AS (
    INSERT INTO public.kanban_tasks (
      organization_id,
      title,
      description,
      sector,
      client_name,
      assignee,
      assigned_to_user_id,
      priority,
      status,
      due_date,
      integration_source,
      integration_task_id,
      integration_payload
    )
    SELECT
      instance.organization_id,
      instance.template_name || ' - ' || instance.client_name,
      'Obrigacao Grow' || E'\nCompetencia: ' || instance.competence_label,
      instance.sector,
      instance.client_name,
      instance.current_assignee::text,
      instance.current_assignee,
      instance.priority,
      'backlog',
      instance.technical_due_date,
      'grow_obligation_task',
      'instance:' || instance.id::text,
      jsonb_build_object(
        'instance_id', instance.id,
        'template_id', instance.template_id,
        'profile_id', instance.profile_id,
        'generated_by', 'monthly_cron',
        'target_competence_key', instance.competence_key
      )
    FROM target_instances instance
    ON CONFLICT (integration_source, integration_task_id) DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT count(*)::integer FROM instance_rows),
    (SELECT count(*)::integer FROM task_rows)
  INTO created_instances, created_tasks;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_month_obligation_tasks(date) FROM PUBLIC, anon, authenticated;
