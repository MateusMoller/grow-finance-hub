-- Allow department roles to create and update kanban tasks
DROP POLICY IF EXISTS "Team can insert tasks" ON public.kanban_tasks;
DROP POLICY IF EXISTS "Team can update tasks" ON public.kanban_tasks;

CREATE POLICY "Internal team can insert tasks"
ON public.kanban_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'departamento_pessoal')
  OR has_role(auth.uid(), 'fiscal')
  OR has_role(auth.uid(), 'contabil')
);

CREATE POLICY "Internal team can update tasks"
ON public.kanban_tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'departamento_pessoal')
  OR has_role(auth.uid(), 'fiscal')
  OR has_role(auth.uid(), 'contabil')
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'departamento_pessoal')
  OR has_role(auth.uid(), 'fiscal')
  OR has_role(auth.uid(), 'contabil')
);
