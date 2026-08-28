alter table public.fiscal_reviews add column if not exists integration_key text,add column if not exists audit_log_id uuid references public.operational_audit_logs(id) on delete set null;
create unique index if not exists fiscal_reviews_integration_uidx on public.fiscal_reviews(organization_id,integration_key) where integration_key is not null;
create table public.fiscal_review_resolutions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,review_id uuid not null references public.fiscal_reviews(id) on delete cascade,resolved_by uuid not null references auth.users(id),resolution text not null,resolution_note text,created_at timestamptz not null default now());
alter table public.fiscal_review_resolutions enable row level security;
create policy fiscal_review_resolutions_read on public.fiscal_review_resolutions for select to authenticated using(public.is_internal_user((select auth.uid()),organization_id));
grant select on public.fiscal_review_resolutions to authenticated;

create or replace function public.resolve_fiscal_review(_organization_id uuid,_review_id uuid,_resolution text,_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare _history_id uuid;_audit_id uuid;begin
 if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 if _resolution not in('applied','dismissed','needs_information') then raise exception 'invalid_resolution';end if;
 update public.fiscal_reviews set status=case when _resolution='dismissed' then 'dismissed' else 'resolved' end,resolved_by=auth.uid(),resolved_at=now(),resolution=jsonb_build_object('decision',_resolution,'note',left(_note,500)),updated_at=now() where id=_review_id and organization_id=_organization_id and status in('open','in_review');if not found then raise exception 'review_not_available';end if;
 insert into public.fiscal_review_resolutions(organization_id,review_id,resolved_by,resolution,resolution_note)values(_organization_id,_review_id,auth.uid(),_resolution,left(_note,500))returning id into _history_id;
 _audit_id:=public.record_operational_audit_log(_organization_id,'integra_contador.review_resolved','fiscal_review',_review_id,null,'success',jsonb_build_object('resolution',_resolution),null);
 update public.fiscal_reviews set audit_log_id=_audit_id where id=_review_id;return _history_id;
end $$;
revoke all on function public.resolve_fiscal_review(uuid,uuid,text,text) from public,anon;
grant execute on function public.resolve_fiscal_review(uuid,uuid,text,text) to authenticated;

create or replace function public.create_fiscal_task_canonical(_organization_id uuid,_client_id uuid,_title text,_description text,_sector text,_priority text,_due_date date,_integration_key text,_context jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare _task_id uuid;_client_name text;begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if nullif(trim(_integration_key),'') is null or nullif(trim(_title),'') is null then raise exception 'invalid_task';end if;
 select name into _client_name from public.clients where id=_client_id and organization_id=_organization_id and status='Ativo';if _client_name is null then raise exception 'client_not_available';end if;
 insert into public.kanban_tasks(organization_id,title,description,client_name,priority,sector,status,due_date,tags,created_by,integration_source,integration_task_id,integration_payload)
 values(_organization_id,left(_title,180),left(_description,2000),_client_name,coalesce(_priority,'Média'),coalesce(nullif(_sector,''),'fiscal'),'backlog',_due_date,array['Fiscal','Integra Contador'],null,'integra_contador',_integration_key,_context)
 on conflict(integration_source,integration_task_id) do nothing returning id into _task_id;
 if _task_id is null then select id into _task_id from public.kanban_tasks where integration_source='integra_contador' and integration_task_id=_integration_key;end if;
 insert into public.operational_audit_logs(organization_id,client_id,action,entity_type,entity_id,result,metadata)values(_organization_id,_client_id,'task.create','task',_task_id,'success',jsonb_build_object('actor_kind','system','actor_source','integra_contador','integration_key',_integration_key));return _task_id;
end $$;
revoke all on function public.create_fiscal_task_canonical(uuid,uuid,text,text,text,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_fiscal_task_canonical(uuid,uuid,text,text,text,text,date,text,jsonb) to service_role;

create or replace function public.create_fiscal_review_canonical(_organization_id uuid,_client_id uuid,_sync_run_id uuid,_review_type text,_reason_code text,_integration_key text,_recommended_action text)
returns uuid language plpgsql security definer set search_path=public as $$ declare _id uuid;begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 insert into public.fiscal_reviews(organization_id,client_id,sync_run_id,review_type,reason_code,issue_fingerprint,integration_key,recommended_action)
 values(_organization_id,_client_id,_sync_run_id,_review_type,_reason_code,_integration_key,_integration_key,left(_recommended_action,1000))on conflict(organization_id,integration_key)where integration_key is not null do nothing returning id into _id;
 if _id is null then select id into _id from public.fiscal_reviews where organization_id=_organization_id and integration_key=_integration_key;end if;return _id;
end $$;
revoke all on function public.create_fiscal_review_canonical(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_fiscal_review_canonical(uuid,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.get_client_fiscal_reviews(_organization_id uuid,_client_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null or not public.is_internal_user(auth.uid(),_organization_id) then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'reasonCode',reason_code,'recommendedAction',recommended_action,'createdAt',created_at)order by created_at desc)from(select id,status,reason_code,recommended_action,created_at from public.fiscal_reviews where organization_id=_organization_id and client_id=_client_id order by created_at desc limit 10)r),'[]'::jsonb);
end $$;
revoke all on function public.get_client_fiscal_reviews(uuid,uuid) from public,anon;
grant execute on function public.get_client_fiscal_reviews(uuid,uuid) to authenticated;
