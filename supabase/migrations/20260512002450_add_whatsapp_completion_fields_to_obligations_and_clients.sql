alter table public.clients
  add column if not exists obligation_completion_whatsapp_enabled boolean not null default false;

alter table public.obligation_templates
  add column if not exists completion_whatsapp_enabled boolean not null default false,
  add column if not exists completion_whatsapp_body text;

comment on column public.clients.obligation_completion_whatsapp_enabled is
  'Permite disparo automatico de WhatsApp ao concluir obrigacoes deste cliente.';

comment on column public.obligation_templates.completion_whatsapp_enabled is
  'Ativa disparo automatico de WhatsApp quando a obrigacao e concluida por documento valido.';

comment on column public.obligation_templates.completion_whatsapp_body is
  'Mensagem padrao de WhatsApp enviada ao concluir a obrigacao.';
