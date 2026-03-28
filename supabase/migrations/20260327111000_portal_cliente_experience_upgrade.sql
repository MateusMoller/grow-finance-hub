-- Portal do Cliente: pendencias rastreaveis + melhoria de comunicacao + submissoes estruturadas

-- =====================================================
-- 1) CLIENTS: permitir cliente visualizar o proprio cadastro vinculado
-- =====================================================
-- garantir roles internas que ja sao usadas no app/edge functions
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'departamento_pessoal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fiscal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contabil';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Client can view own client profile" ON public.clients;
CREATE POLICY "Client can view own client profile"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (portal_user_id = auth.uid());

-- =====================================================
-- 2) CLIENT REQUESTS: ampliar visibilidade interna e restringir update ao time
-- =====================================================
DROP POLICY IF EXISTS "Clients can view own requests" ON public.client_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.client_requests;

CREATE POLICY "Clients and internal can view requests"
  ON public.client_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Internal team can update requests"
  ON public.client_requests
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

-- =====================================================
-- 3) CLIENT DOCUMENTS: status de processamento e visibilidade interna
-- =====================================================
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Clients can view own documents" ON public.client_documents;
DROP POLICY IF EXISTS "Clients can delete own documents" ON public.client_documents;

CREATE POLICY "Clients and internal can view documents"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Clients can delete unprocessed documents and internal can delete all"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (
    (
      user_id = auth.uid()
      AND processed_at IS NULL
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

DROP POLICY IF EXISTS "Internal team can update document processing" ON public.client_documents;
CREATE POLICY "Internal team can update document processing"
  ON public.client_documents
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

-- =====================================================
-- 4) REQUEST MESSAGES: padronizar acesso para todo o time interno
-- =====================================================
DROP POLICY IF EXISTS "Users can view messages on own requests" ON public.request_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.request_messages;

CREATE POLICY "Clients and internal can view request messages"
  ON public.request_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.client_requests cr
      WHERE cr.id = request_messages.request_id
      AND cr.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Clients and internal can insert request messages"
  ON public.request_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.client_requests cr
        WHERE cr.id = request_messages.request_id
        AND cr.user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
  );

-- =====================================================
-- 5) FORM SUBMISSIONS: rastreabilidade para request/client + RLS consistente
-- =====================================================
CREATE TABLE IF NOT EXISTS public.form_submissions (
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

DROP TRIGGER IF EXISTS update_form_submissions_updated_at ON public.form_submissions;
CREATE TRIGGER update_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.client_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_client_id
  ON public.form_submissions (client_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_request_id
  ON public.form_submissions (request_id);

DROP POLICY IF EXISTS "Team can view form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Users can insert form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Team can update form_submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Admins can delete form_submissions" ON public.form_submissions;

CREATE POLICY "Clients and internal can view form submissions"
  ON public.form_submissions
  FOR SELECT
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Authenticated can insert own form submissions"
  ON public.form_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = form_submissions.client_id
        AND (
          c.portal_user_id = auth.uid()
          OR has_role(auth.uid(), 'admin')
          OR has_role(auth.uid(), 'director')
          OR has_role(auth.uid(), 'manager')
          OR has_role(auth.uid(), 'employee')
          OR has_role(auth.uid(), 'commercial')
          OR has_role(auth.uid(), 'partner')
          OR has_role(auth.uid(), 'departamento_pessoal')
          OR has_role(auth.uid(), 'fiscal')
          OR has_role(auth.uid(), 'contabil')
        )
      )
    )
  );

CREATE POLICY "Internal team can update form submissions"
  ON public.form_submissions
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Managers can delete form submissions"
  ON public.form_submissions
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
  );

-- =====================================================
-- 6) NOVA TABELA DE PENDENCIAS DO PORTAL: client_portal_tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS public.client_portal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'operational',
  status text NOT NULL DEFAULT 'pending_client',
  due_date date,
  sector text NOT NULL DEFAULT 'Geral',
  request_id uuid REFERENCES public.client_requests(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_portal_tasks_status_check'
  ) THEN
    ALTER TABLE public.client_portal_tasks
      ADD CONSTRAINT client_portal_tasks_status_check
      CHECK (status IN ('pending_client', 'in_analysis', 'completed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_portal_tasks_type_check'
  ) THEN
    ALTER TABLE public.client_portal_tasks
      ADD CONSTRAINT client_portal_tasks_type_check
      CHECK (type IN ('document', 'request_return', 'operational', 'deadline', 'other'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_client_portal_tasks_client_id
  ON public.client_portal_tasks (client_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_tasks_status
  ON public.client_portal_tasks (status);

CREATE INDEX IF NOT EXISTS idx_client_portal_tasks_due_date
  ON public.client_portal_tasks (due_date);

ALTER TABLE public.client_portal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients and internal can view portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Internal can insert portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Clients and internal can update portal tasks" ON public.client_portal_tasks;
DROP POLICY IF EXISTS "Internal can delete portal tasks" ON public.client_portal_tasks;

CREATE POLICY "Clients and internal can view portal tasks"
  ON public.client_portal_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_portal_tasks.client_id
      AND c.portal_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Internal can insert portal tasks"
  ON public.client_portal_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Clients and internal can update portal tasks"
  ON public.client_portal_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_portal_tasks.client_id
      AND c.portal_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_portal_tasks.client_id
      AND c.portal_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

CREATE POLICY "Internal can delete portal tasks"
  ON public.client_portal_tasks
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'partner')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );

DROP TRIGGER IF EXISTS update_client_portal_tasks_updated_at ON public.client_portal_tasks;
CREATE TRIGGER update_client_portal_tasks_updated_at
  BEFORE UPDATE ON public.client_portal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
