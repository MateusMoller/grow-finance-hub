create or replace function public.sanitize_client_delivery_message(_body text)
returns text
language sql immutable set search_path=''
as $$
  select case when _body is null then null else
    regexp_replace(
      regexp_replace(_body,'esperamos que estejas bem\.?','','gi'),
      E'\r?\n[[:space:]]*\r?\n[[:space:]]*\r?\n',E'\n\n','g'
    )
  end
$$;

revoke all on function public.sanitize_client_delivery_message(text) from public,anon,authenticated;

create temporary table _updated_message_templates(id uuid primary key) on commit drop;
insert into _updated_message_templates(id)
select id from public.obligation_templates
where lower(coalesce(completion_email_body,'')) like '%esperamos que estejas bem%'
   or lower(coalesce(completion_whatsapp_body,'')) like '%esperamos que estejas bem%';

update public.obligation_templates
set completion_email_body=public.sanitize_client_delivery_message(completion_email_body),
    completion_whatsapp_body=public.sanitize_client_delivery_message(completion_whatsapp_body),
    updated_at=now()
where id in(select id from _updated_message_templates);

insert into public.obligation_audit_events(organization_id,template_id,entity_type,entity_id,action,metadata)
select t.organization_id,t.id,'obligation_template',t.id,'client_message_greeting_removed',
  jsonb_build_object('channels',jsonb_build_array('email','whatsapp'),'phrase','esperamos que estejas bem','historical_sent_messages_preserved',true)
from public.obligation_templates t join _updated_message_templates changed on changed.id=t.id;

-- Failed attempts can be retried, so sanitize them. Sent messages remain immutable audit history.
update public.obligation_delivery_attempts
set message_body=public.sanitize_client_delivery_message(message_body)
where status='failed' and lower(coalesce(message_body,'')) like '%esperamos que estejas bem%';

create or replace function public.sanitize_obligation_template_client_messages()
returns trigger language plpgsql set search_path='' as $$
begin
  new.completion_email_body:=public.sanitize_client_delivery_message(new.completion_email_body);
  new.completion_whatsapp_body:=public.sanitize_client_delivery_message(new.completion_whatsapp_body);
  return new;
end $$;

revoke all on function public.sanitize_obligation_template_client_messages() from public,anon,authenticated;
drop trigger if exists sanitize_obligation_template_client_messages on public.obligation_templates;
create trigger sanitize_obligation_template_client_messages
before insert or update of completion_email_body,completion_whatsapp_body on public.obligation_templates
for each row execute function public.sanitize_obligation_template_client_messages();

create or replace function public.sanitize_pending_obligation_delivery_message()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status<>'sent' then new.message_body:=public.sanitize_client_delivery_message(new.message_body); end if;
  return new;
end $$;

revoke all on function public.sanitize_pending_obligation_delivery_message() from public,anon,authenticated;
drop trigger if exists sanitize_pending_obligation_delivery_message on public.obligation_delivery_attempts;
create trigger sanitize_pending_obligation_delivery_message
before insert or update of message_body,status on public.obligation_delivery_attempts
for each row execute function public.sanitize_pending_obligation_delivery_message();
