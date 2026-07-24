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
          AND extract(month from target_month)::int = COALESCE(profile.yearly_due_month_override, template.yearly_due_month, 1)
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
      (
        date_trunc(
          'month',
          CASE
            WHEN COALESCE(candidate.technical_due_month_reference, 'vigente') = 'anterior'
              THEN target_month - interval '1 month'
            ELSE target_month
          END
        )::date
        + (
          LEAST(
            COALESCE(candidate.due_day_override, candidate.due_day),
            extract(day from (
              date_trunc(
                'month',
                CASE
                  WHEN COALESCE(candidate.technical_due_month_reference, 'vigente') = 'anterior'
                    THEN target_month - interval '1 month'
                  ELSE target_month
                END
              ) + interval '1 month - 1 day'
            ))::int
          ) - 1
        )
      )::date,
      CASE
        WHEN candidate.legal_due_day IS NULL THEN NULL
        ELSE (
          target_month
          + (
            LEAST(
              COALESCE(candidate.legal_due_day_override, candidate.legal_due_day),
              extract(day from (target_month + interval '1 month - 1 day'))::int
            ) - 1
          )
        )::date
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
