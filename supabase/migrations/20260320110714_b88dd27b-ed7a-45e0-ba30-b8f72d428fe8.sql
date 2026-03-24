-- Add sector column to client_requests
ALTER TABLE public.client_requests ADD COLUMN sector text NOT NULL DEFAULT 'Geral';
-- Create kanban_tasks table
CREATE TABLE public.kanban_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  client_name text,
  assignee text,
  priority text NOT NULL DEFAULT 'Média',
  sector text NOT NULL DEFAULT 'Geral',
  status text NOT NULL DEFAULT 'backlog',
  due_date date,
  tags text[] DEFAULT '{}',
  request_id uuid REFERENCES public.client_requests(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;
-- RLS policies
CREATE POLICY "Admin full access" ON public.kanban_tasks
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view tasks" ON public.kanban_tasks
FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Authenticated can insert tasks" ON public.kanban_tasks
FOR INSERT TO authenticated
WITH CHECK (true);
CREATE POLICY "Authenticated can update tasks" ON public.kanban_tasks
FOR UPDATE TO authenticated
USING (true);
CREATE POLICY "Authenticated can delete own tasks" ON public.kanban_tasks
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
-- Trigger: auto-create kanban task when client request is created
CREATE OR REPLACE FUNCTION public.create_kanban_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kanban_tasks (title, description, sector, request_id, status, priority, client_name)
  VALUES (
    NEW.title,
    NEW.description,
    NEW.sector,
    NEW.id,
    'backlog',
    'Média',
    (SELECT display_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1)
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_client_request_created
AFTER INSERT ON public.client_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_kanban_from_request();
-- Updated_at trigger
CREATE TRIGGER update_kanban_tasks_updated_at
BEFORE UPDATE ON public.kanban_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
