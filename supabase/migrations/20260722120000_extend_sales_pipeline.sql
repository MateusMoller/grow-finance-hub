-- Sales pipeline foundation: configurable stages, commercial catalog,
-- opportunity activities and support for new-client completion tasks.

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_lead_id uuid,
  ADD COLUMN IF NOT EXISTS stage_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS offer_id uuid,
  ADD COLUMN IF NOT EXISTS other_offer_description text,
  ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS probability integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS won_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS completion_task_id uuid REFERENCES public.kanban_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_sale_type_check
    CHECK (sale_type IN ('service', 'product', 'consulting', 'automation', 'system', 'other'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_status_check
    CHECK (status IN ('active', 'won', 'lost', 'archived'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_recurrence_type_check
    CHECK (recurrence_type IN ('recurring', 'one_time'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_probability_check
    CHECK (probability >= 0 AND probability <= 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_lost_reason_check
    CHECK (status <> 'lost' OR NULLIF(trim(COALESCE(loss_reason, '')), '') IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_leads
    ADD CONSTRAINT crm_leads_other_offer_description_check
    CHECK (sale_type <> 'other' OR NULLIF(trim(COALESCE(other_offer_description, '')), '') IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL,
  color text NOT NULL DEFAULT '#4f556f',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_system_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (organization_id, position),
  CHECK (length(trim(name)) > 0),
  CHECK (position > 0),
  CHECK (NOT (is_won AND is_lost))
);

CREATE TABLE IF NOT EXISTS public.crm_commercial_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'service',
  default_recurrence_type text NOT NULL DEFAULT 'recurring',
  default_value numeric(14,2),
  description text,
  is_system_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  CHECK (length(trim(name)) > 0),
  CHECK (category IN ('service', 'product', 'consulting', 'automation', 'system', 'other')),
  CHECK (default_recurrence_type IN ('recurring', 'one_time'))
);

CREATE TABLE IF NOT EXISTS public.crm_commercial_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact text,
  email text,
  phone text,
  source text,
  notes text,
  status text NOT NULL DEFAULT 'prospect',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(name)) > 0),
  CHECK (status IN ('prospect', 'converted', 'discarded'))
);

CREATE TABLE IF NOT EXISTS public.crm_opportunity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (activity_type IN ('note', 'call', 'meeting', 'email', 'whatsapp', 'task', 'stage_change', 'system')),
  CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS public.crm_client_completion_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, opportunity_id),
  UNIQUE (organization_id, client_id, task_id)
);

ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_commercial_lead_id_fkey;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_commercial_lead_id_fkey
  FOREIGN KEY (commercial_lead_id) REFERENCES public.crm_commercial_leads(id) ON DELETE SET NULL;

ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_offer_id_fkey;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES public.crm_commercial_offers(id) ON DELETE SET NULL;

ALTER TABLE public.crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_stage_id_fkey;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_stage_id_fkey
  FOREIGN KEY (stage_id) REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_org_stage_active
  ON public.crm_leads (organization_id, stage, archived_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_client
  ON public.crm_leads (organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_org_active_position
  ON public.crm_pipeline_stages (organization_id, is_active, position);
CREATE INDEX IF NOT EXISTS idx_crm_commercial_offers_org_active_category
  ON public.crm_commercial_offers (organization_id, is_active, category);
CREATE INDEX IF NOT EXISTS idx_crm_commercial_leads_org_status
  ON public.crm_commercial_leads (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_created
  ON public.crm_opportunity_activities (organization_id, opportunity_id, created_at DESC);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_commercial_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_commercial_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_client_completion_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Internal can view sales stages"
    ON public.crm_pipeline_stages
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Managers manage sales stages"
    ON public.crm_pipeline_stages
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Internal can view commercial offers"
    ON public.crm_commercial_offers
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Managers manage commercial offers"
    ON public.crm_commercial_offers
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Internal can manage commercial leads"
    ON public.crm_commercial_leads
    FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Internal can manage opportunity activities"
    ON public.crm_opportunity_activities
    FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Internal can view completion task links"
    ON public.crm_client_completion_tasks
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'commercial')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.crm_pipeline_stages (organization_id, name, position, color, is_won, is_lost, is_system_default)
SELECT org.id, stage.name, stage.position, stage.color, stage.is_won, stage.is_lost, true
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('Oportunidade Nova', 1, '#64748b', false, false),
    ('Contato Iniciado', 2, '#64748b', false, false),
    ('Diagnostico', 3, '#4f46e5', false, false),
    ('Reuniao Agendada', 4, '#f59e0b', false, false),
    ('Proposta Enviada', 5, '#2563eb', false, false),
    ('Negociacao', 6, '#7c3aed', false, false),
    ('Fechado Ganho', 7, '#059669', true, false),
    ('Fechado Perdido', 8, '#dc2626', false, true)
) AS stage(name, position, color, is_won, is_lost)
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.crm_commercial_offers (
  organization_id,
  name,
  category,
  default_recurrence_type,
  description,
  is_system_default
)
SELECT org.id, offer.name, offer.category, offer.recurrence_type, offer.description, true
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('Contabilidade recorrente', 'service', 'recurring', 'Servico contabil mensal.'),
    ('Automacao operacional', 'automation', 'one_time', 'Projeto de automacao ou integracao.'),
    ('Consultoria', 'consulting', 'one_time', 'Diagnostico, planejamento ou execucao consultiva.'),
    ('Sistema', 'system', 'recurring', 'Venda ou assinatura de sistema.'),
    ('Produto avulso', 'product', 'one_time', 'Produto ou entrega comercial pontual.')
) AS offer(name, category, recurrence_type, description)
ON CONFLICT (organization_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.crm_win_new_client_opportunity(_opportunity_id uuid)
RETURNS TABLE(client_id uuid, task_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opportunity public.crm_leads%ROWTYPE;
  next_client_id uuid;
  next_task_id uuid;
  task_title text;
BEGIN
  SELECT *
  INTO opportunity
  FROM public.crm_leads
  WHERE id = _opportunity_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'commercial')
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF opportunity.client_id IS NOT NULL THEN
    next_client_id := opportunity.client_id;
  ELSE
    INSERT INTO public.clients (
      organization_id,
      name,
      contact,
      email,
      phone,
      status,
      sector,
      notes,
      created_by
    )
    VALUES (
      opportunity.organization_id,
      opportunity.name,
      NULLIF(opportunity.contact, ''),
      NULLIF(opportunity.email, ''),
      NULLIF(opportunity.phone, ''),
      'Pendente',
      'Outros',
      NULLIF(opportunity.notes, ''),
      auth.uid()
    )
    RETURNING id INTO next_client_id;

    UPDATE public.crm_leads
    SET client_id = next_client_id,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = opportunity.id;
  END IF;

  SELECT link.task_id
  INTO next_task_id
  FROM public.crm_client_completion_tasks link
  WHERE link.organization_id = opportunity.organization_id
    AND link.opportunity_id = opportunity.id
  LIMIT 1;

  IF next_task_id IS NULL THEN
    SELECT task.id
    INTO next_task_id
    FROM public.kanban_tasks task
    WHERE task.organization_id = opportunity.organization_id
      AND task.integration_source = 'sales_pipeline'
      AND task.integration_task_id = opportunity.id::text
    LIMIT 1;
  END IF;

  IF next_task_id IS NULL THEN
    task_title := 'Complementar cadastro do cliente: ' || opportunity.name;

    INSERT INTO public.kanban_tasks (
      organization_id,
      title,
      description,
      client_name,
      assignee,
      assigned_to_user_id,
      priority,
      sector,
      status,
      tags,
      integration_source,
      integration_task_id,
      integration_payload,
      created_by
    )
    VALUES (
      opportunity.organization_id,
      task_title,
      'Complementar dados cadastrais do cliente criado a partir de venda ganha.',
      opportunity.name,
      NULL,
      NULL,
      'Média',
      'Comercial',
      'backlog',
      ARRAY['vendas', 'cadastro_cliente'],
      'sales_pipeline',
      opportunity.id::text,
      jsonb_build_object('opportunity_id', opportunity.id, 'client_id', next_client_id),
      auth.uid()
    )
    RETURNING id INTO next_task_id;

    INSERT INTO public.crm_client_completion_tasks (
      organization_id,
      opportunity_id,
      client_id,
      task_id,
      created_by
    )
    VALUES (
      opportunity.organization_id,
      opportunity.id,
      next_client_id,
      next_task_id,
      auth.uid()
    );
  ELSE
    INSERT INTO public.crm_client_completion_tasks (
      organization_id,
      opportunity_id,
      client_id,
      task_id,
      created_by
    )
    VALUES (
      opportunity.organization_id,
      opportunity.id,
      next_client_id,
      next_task_id,
      auth.uid()
    )
    ON CONFLICT (organization_id, opportunity_id) DO NOTHING;
  END IF;

  UPDATE public.crm_leads
  SET stage = 'Fechado Ganho',
      won_at = COALESCE(won_at, now()),
      completion_task_id = next_task_id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = opportunity.id;

  INSERT INTO public.crm_opportunity_activities (
    organization_id,
    opportunity_id,
    actor_user_id,
    activity_type,
    title,
    body,
    metadata
  )
  VALUES (
    opportunity.organization_id,
    opportunity.id,
    auth.uid(),
    'system',
    'Venda ganha',
    'Cliente pendente e tarefa comercial de complementacao gerados automaticamente.',
    jsonb_build_object('client_id', next_client_id, 'task_id', next_task_id)
  );

  RETURN QUERY SELECT next_client_id, next_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_win_new_client_opportunity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_win_new_client_opportunity(uuid) TO authenticated;
