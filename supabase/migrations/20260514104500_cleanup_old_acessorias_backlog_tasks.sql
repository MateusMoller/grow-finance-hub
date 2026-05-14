DELETE FROM public.kanban_tasks
WHERE integration_source IN ('acessorias_obrigacao', 'acessorias_obrigacao_semanal')
  AND status = 'backlog'
  AND due_date < current_date;
