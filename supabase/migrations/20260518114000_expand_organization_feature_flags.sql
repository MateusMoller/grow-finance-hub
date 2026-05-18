-- Expand organization feature flags used by frontend navigation and route guards.

UPDATE public.organization_settings
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || jsonb_build_object(
  'portal', COALESCE((feature_flags ->> 'portal')::boolean, true),
  'financeiro', COALESCE((feature_flags ->> 'financeiro')::boolean, true),
  'obrigacoes', COALESCE((feature_flags ->> 'obrigacoes')::boolean, true),
  'ia', COALESCE((feature_flags ->> 'ia')::boolean, true),
  'whatsapp', COALESCE((feature_flags ->> 'whatsapp')::boolean, true),
  'open_finance', COALESCE((feature_flags ->> 'open_finance')::boolean, true),
  'acessorias', COALESCE((feature_flags ->> 'acessorias')::boolean, true),
  'robo_documentos', COALESCE((feature_flags ->> 'robo_documentos')::boolean, true),
  'crm', COALESCE((feature_flags ->> 'crm')::boolean, true),
  'calendario', COALESCE((feature_flags ->> 'calendario')::boolean, true),
  'tarefas', COALESCE((feature_flags ->> 'tarefas')::boolean, true),
  'relatorios', COALESCE((feature_flags ->> 'relatorios')::boolean, true),
  'usuarios', COALESCE((feature_flags ->> 'usuarios')::boolean, true),
  'newsletter', COALESCE((feature_flags ->> 'newsletter')::boolean, true)
);
