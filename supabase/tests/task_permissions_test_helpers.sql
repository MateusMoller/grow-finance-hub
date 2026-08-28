begin;
select plan(1);

create or replace function pg_temp.set_test_actor(_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', _user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select pass('task permission test helpers loaded');
select * from finish();
rollback;
