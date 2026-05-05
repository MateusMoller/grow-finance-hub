-- Grow native obligations and document intake module.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('obligation-files', 'obligation-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.obligation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sector text NOT NULL DEFAULT 'Geral',
  periodicity text NOT NULL DEFAULT 'monthly',
  due_day integer NOT NULL DEFAULT 10,
  yearly_due_month integer,
  legal_due_day integer,
  sla_days integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'media',
  expected_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  generates_calendar boolean NOT NULL DEFAULT true,
  generates_kanban boolean NOT NULL DEFAULT false,
  requires_protocol boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT true,
  operational_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_templates_periodicity_check
    CHECK (periodicity IN ('monthly', 'quarterly', 'yearly', 'custom')),
  CONSTRAINT obligation_templates_due_day_check
    CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT obligation_templates_yearly_due_month_check
    CHECK (yearly_due_month IS NULL OR yearly_due_month BETWEEN 1 AND 12),
  CONSTRAINT obligation_templates_legal_due_day_check
    CHECK (legal_due_day IS NULL OR legal_due_day BETWEEN 1 AND 31),
  CONSTRAINT obligation_templates_sla_days_check
    CHECK (sla_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_obligation_templates_sector
  ON public.obligation_templates (sector);

ALTER TABLE public.obligation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation templates" ON public.obligation_templates;
DROP POLICY IF EXISTS "Managers can manage obligation templates" ON public.obligation_templates;

CREATE POLICY "Internal can view obligation templates"
  ON public.obligation_templates
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Managers can manage obligation templates"
  ON public.obligation_templates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'manager')
  );

DROP TRIGGER IF EXISTS update_obligation_templates_updated_at ON public.obligation_templates;
CREATE TRIGGER update_obligation_templates_updated_at
  BEFORE UPDATE ON public.obligation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_obligation_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.obligation_templates(id) ON DELETE CASCADE,
  assigned_to uuid,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  due_day_override integer,
  yearly_due_month_override integer,
  legal_due_day_override integer,
  expected_documents_override jsonb,
  notes text,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_obligation_profiles_unique UNIQUE (client_id, template_id),
  CONSTRAINT client_obligation_profiles_due_day_override_check
    CHECK (due_day_override IS NULL OR due_day_override BETWEEN 1 AND 31),
  CONSTRAINT client_obligation_profiles_yearly_due_month_override_check
    CHECK (yearly_due_month_override IS NULL OR yearly_due_month_override BETWEEN 1 AND 12),
  CONSTRAINT client_obligation_profiles_legal_due_day_override_check
    CHECK (legal_due_day_override IS NULL OR legal_due_day_override BETWEEN 1 AND 31),
  CONSTRAINT client_obligation_profiles_date_range_check
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_client_obligation_profiles_client_id
  ON public.client_obligation_profiles (client_id);

CREATE INDEX IF NOT EXISTS idx_client_obligation_profiles_template_id
  ON public.client_obligation_profiles (template_id);

ALTER TABLE public.client_obligation_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation profiles" ON public.client_obligation_profiles;
DROP POLICY IF EXISTS "Internal can manage obligation profiles" ON public.client_obligation_profiles;

CREATE POLICY "Internal can view obligation profiles"
  ON public.client_obligation_profiles
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage obligation profiles"
  ON public.client_obligation_profiles
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_client_obligation_profiles_updated_at ON public.client_obligation_profiles;
CREATE TRIGGER update_client_obligation_profiles_updated_at
  BEFORE UPDATE ON public.client_obligation_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.obligation_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.client_obligation_profiles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.obligation_templates(id) ON DELETE CASCADE,
  competence_label text NOT NULL,
  competence_date date NOT NULL,
  competence_key text NOT NULL,
  technical_due_date date NOT NULL,
  legal_due_date date,
  status text NOT NULL DEFAULT 'pendente',
  priority text NOT NULL DEFAULT 'media',
  current_assignee uuid,
  protocol text,
  origin text NOT NULL DEFAULT 'grow_native',
  completion_notes text,
  document_required boolean NOT NULL DEFAULT true,
  protocol_required boolean NOT NULL DEFAULT false,
  created_by uuid,
  completed_at timestamptz,
  last_status_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_instances_unique UNIQUE (client_id, template_id, competence_key),
  CONSTRAINT obligation_instances_status_check
    CHECK (status IN ('pendente', 'em_andamento', 'aguardando_documento', 'em_revisao', 'concluida', 'atrasada', 'cancelada')),
  CONSTRAINT obligation_instances_priority_check
    CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'))
);

CREATE INDEX IF NOT EXISTS idx_obligation_instances_client_id
  ON public.obligation_instances (client_id);

CREATE INDEX IF NOT EXISTS idx_obligation_instances_due_dates
  ON public.obligation_instances (technical_due_date, legal_due_date);

CREATE INDEX IF NOT EXISTS idx_obligation_instances_status
  ON public.obligation_instances (status);

ALTER TABLE public.obligation_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation instances" ON public.obligation_instances;
DROP POLICY IF EXISTS "Internal can manage obligation instances" ON public.obligation_instances;

CREATE POLICY "Internal can view obligation instances"
  ON public.obligation_instances
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage obligation instances"
  ON public.obligation_instances
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_obligation_instances_updated_at ON public.obligation_instances;
CREATE TRIGGER update_obligation_instances_updated_at
  BEFORE UPDATE ON public.obligation_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.obligation_instance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'status_change',
  from_status text,
  to_status text,
  comment text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obligation_instance_events_instance_id
  ON public.obligation_instance_events (instance_id, created_at DESC);

ALTER TABLE public.obligation_instance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation events" ON public.obligation_instance_events;
DROP POLICY IF EXISTS "Internal can manage obligation events" ON public.obligation_instance_events;

CREATE POLICY "Internal can view obligation events"
  ON public.obligation_instance_events
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage obligation events"
  ON public.obligation_instance_events
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.document_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  suggested_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  suggested_template_id uuid REFERENCES public.obligation_templates(id) ON DELETE SET NULL,
  suggested_instance_id uuid REFERENCES public.obligation_instances(id) ON DELETE SET NULL,
  linked_instance_id uuid REFERENCES public.obligation_instances(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'obligation-files',
  storage_path text NOT NULL,
  content_type text,
  file_size bigint,
  suggested_competence_label text,
  identification_confidence numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_review',
  blocking_reason text,
  notes text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_inbox_items_status_check
    CHECK (status IN ('pending_review', 'linked', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_status
  ON public.document_inbox_items (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_inbox_items_client_id
  ON public.document_inbox_items (client_id);

ALTER TABLE public.document_inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view document inbox items" ON public.document_inbox_items;
DROP POLICY IF EXISTS "Internal can manage document inbox items" ON public.document_inbox_items;

CREATE POLICY "Internal can view document inbox items"
  ON public.document_inbox_items
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage document inbox items"
  ON public.document_inbox_items
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS update_document_inbox_items_updated_at ON public.document_inbox_items;
CREATE TRIGGER update_document_inbox_items_updated_at
  BEFORE UPDATE ON public.document_inbox_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.obligation_instance_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.obligation_instances(id) ON DELETE CASCADE,
  inbox_item_id uuid REFERENCES public.document_inbox_items(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'obligation-files',
  storage_path text NOT NULL,
  content_type text,
  file_size bigint,
  triage_status text NOT NULL DEFAULT 'accepted',
  source text NOT NULL DEFAULT 'manual_upload',
  uploaded_by uuid,
  identification_confidence numeric(5,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obligation_instance_files_unique_path UNIQUE (storage_bucket, storage_path),
  CONSTRAINT obligation_instance_files_triage_status_check
    CHECK (triage_status IN ('accepted', 'reviewed', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_obligation_instance_files_instance_id
  ON public.obligation_instance_files (instance_id, created_at DESC);

ALTER TABLE public.obligation_instance_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal can view obligation files" ON public.obligation_instance_files;
DROP POLICY IF EXISTS "Internal can manage obligation files" ON public.obligation_instance_files;

CREATE POLICY "Internal can view obligation files"
  ON public.obligation_instance_files
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can manage obligation files"
  ON public.obligation_instance_files
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal can upload obligation files" ON storage.objects;
DROP POLICY IF EXISTS "Internal can view obligation files" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete obligation files" ON storage.objects;

CREATE POLICY "Internal can upload obligation files"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'obligation-files'
    AND public.is_internal_user(auth.uid())
  );

CREATE POLICY "Internal can view obligation files"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'obligation-files'
    AND public.is_internal_user(auth.uid())
  );

CREATE POLICY "Managers can delete obligation files"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'obligation-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'director')
      OR public.has_role(auth.uid(), 'manager')
    )
  );
