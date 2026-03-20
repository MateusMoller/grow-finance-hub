
-- Tighten INSERT policy: only team members (not clients) can insert
DROP POLICY "Authenticated can insert tasks" ON public.kanban_tasks;
CREATE POLICY "Team can insert tasks" ON public.kanban_tasks
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'employee') OR
  has_role(auth.uid(), 'director')
);

-- Tighten UPDATE policy: only team members can update
DROP POLICY "Authenticated can update tasks" ON public.kanban_tasks;
CREATE POLICY "Team can update tasks" ON public.kanban_tasks
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'employee') OR
  has_role(auth.uid(), 'director')
);
