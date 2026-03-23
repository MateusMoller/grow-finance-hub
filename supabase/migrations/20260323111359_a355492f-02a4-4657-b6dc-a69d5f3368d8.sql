
-- Calendar events table
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  entry_type text NOT NULL DEFAULT 'task',
  priority text NOT NULL DEFAULT 'Média',
  status text NOT NULL DEFAULT 'pending',
  due_at timestamptz NOT NULL DEFAULT now(),
  all_day boolean DEFAULT false,
  sector text DEFAULT 'Geral',
  client_name text,
  assignee text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view calendar_events" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can insert calendar_events" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director'));

CREATE POLICY "Team can update calendar_events" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director'));

CREATE POLICY "Admins can delete calendar_events" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User settings table
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  phone text,
  job_title text,
  theme_preference text DEFAULT 'system',
  language_code text DEFAULT 'pt-BR',
  compact_mode boolean DEFAULT false,
  company_name text,
  company_document text,
  company_email text,
  company_phone text,
  company_website text,
  notify_assigned_tasks boolean DEFAULT true,
  notify_due_soon boolean DEFAULT true,
  notify_new_forms boolean DEFAULT true,
  notify_new_leads boolean DEFAULT true,
  notify_daily_email boolean DEFAULT true,
  calendar_sync boolean DEFAULT false,
  drive_sync boolean DEFAULT false,
  webhook_url text,
  api_access boolean DEFAULT false,
  api_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Form templates table
CREATE TABLE public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sector text DEFAULT 'Geral',
  is_published boolean DEFAULT false,
  fields jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view form_templates" ON public.form_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team can insert form_templates" ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Team can update form_templates" ON public.form_templates
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Admins can delete form_templates" ON public.form_templates
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Form submissions table
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.form_templates(id) ON DELETE SET NULL,
  template_title text NOT NULL,
  submitted_by uuid,
  submitted_by_name text,
  data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view form_submissions" ON public.form_submissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert form_submissions" ON public.form_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Team can update form_submissions" ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee'));

CREATE POLICY "Admins can delete form_submissions" ON public.form_submissions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
