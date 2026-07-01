alter table public.obligation_templates
  add column if not exists completion_email_enabled boolean not null default false,
  add column if not exists completion_email_subject text,
  add column if not exists completion_email_body text;

comment on column public.obligation_templates.completion_email_enabled is
  'When true, the system prepares the configured email for human-confirmed guide delivery after valid document attachment.';

comment on column public.obligation_templates.completion_email_subject is
  'Default subject template for automatic obligation completion emails.';

comment on column public.obligation_templates.completion_email_body is
  'Default body template for automatic obligation completion emails.';
