DELETE FROM public.user_module_grants
WHERE module_key IN (
  'portal',
  'financeiro',
  'open_finance',
  'acessorias',
  'formularios',
  'manual'
);

ALTER TABLE public.user_module_grants
  DROP CONSTRAINT IF EXISTS user_module_grants_module_check;

ALTER TABLE public.user_module_grants
  ADD CONSTRAINT user_module_grants_module_check
  CHECK (
    module_key IN (
      'dashboard',
      'clientes',
      'cadastrar_clientes',
      'obrigacoes',
      'ia',
      'whatsapp',
      'robo_documentos',
      'crm',
      'chat_interno',
      'calendario',
      'tarefas',
      'relatorios',
      'notificacoes',
      'usuarios',
      'newsletter',
      'sugestoes',
      'configuracoes'
    )
  );
