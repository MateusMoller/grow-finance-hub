ALTER TABLE public.user_module_grants
  DROP CONSTRAINT IF EXISTS user_module_grants_module_check;

ALTER TABLE public.user_module_grants
  ADD CONSTRAINT user_module_grants_module_check
  CHECK (
    module_key IN (
      'dashboard',
      'portal',
      'clientes',
      'cadastrar_clientes',
      'financeiro',
      'obrigacoes',
      'ia',
      'whatsapp',
      'open_finance',
      'acessorias',
      'robo_documentos',
      'crm',
      'chat_interno',
      'calendario',
      'tarefas',
      'formularios',
      'relatorios',
      'notificacoes',
      'usuarios',
      'newsletter',
      'sugestoes',
      'manual',
      'configuracoes'
    )
  );
