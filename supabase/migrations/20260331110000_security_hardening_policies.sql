-- Security hardening: tighten read/write scopes for internal operational data

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_user_id, 'admin')
    OR has_role(_user_id, 'director')
    OR has_role(_user_id, 'manager')
    OR has_role(_user_id, 'employee')
    OR has_role(_user_id, 'commercial')
    OR has_role(_user_id, 'partner')
    OR has_role(_user_id, 'departamento_pessoal')
    OR has_role(_user_id, 'fiscal')
    OR has_role(_user_id, 'contabil');
$$;

REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;

-- Restrict profiles visibility: user sees own profile, internal team can see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Internal can view all profiles and users can view own profile" ON public.profiles;

CREATE POLICY "Internal can view all profiles and users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_internal_user(auth.uid())
  );

-- Harden kanban tasks policies
DROP POLICY IF EXISTS "Admin full access" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Authenticated can insert tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Authenticated can delete own tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Team can insert tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Team can update tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal team can insert tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal team can update tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal can view kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal can insert kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Internal can update kanban tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Managers can delete kanban tasks" ON public.kanban_tasks;

CREATE POLICY "Internal can view kanban tasks"
  ON public.kanban_tasks
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert kanban tasks"
  ON public.kanban_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update kanban tasks"
  ON public.kanban_tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Managers can delete kanban tasks"
  ON public.kanban_tasks
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
  );

-- Harden calendar events policies
DROP POLICY IF EXISTS "Authenticated can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Team can view calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Team can insert calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Team can update calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins can delete calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Team can insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Team can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Managers can delete calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal can insert calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Internal can update calendar events" ON public.calendar_events;

CREATE POLICY "Internal can view calendar events"
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can insert calendar events"
  ON public.calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Internal can update calendar events"
  ON public.calendar_events
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

CREATE POLICY "Managers can delete calendar events"
  ON public.calendar_events
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
  );

-- Ensure clients can only read published form templates, while internal can read all
DROP POLICY IF EXISTS "Team can view form_templates" ON public.form_templates;
DROP POLICY IF EXISTS "Clients can view only published forms" ON public.form_templates;
DROP POLICY IF EXISTS "Clients can view published forms and internal can view all forms" ON public.form_templates;

CREATE POLICY "Clients can view published forms and internal can view all forms"
  ON public.form_templates
  FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR public.is_internal_user(auth.uid())
  );
