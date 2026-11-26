begin;

create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    );
$$;

create table if not exists public.manager_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  manager_id uuid not null,
  resource text not null,
  record_key text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE'))
);

alter table public.manager_audit_log enable row level security;
revoke all on public.manager_audit_log from public, anon, authenticated;
grant select on public.manager_audit_log to authenticated;
drop policy if exists "Verified managers read audit log" on public.manager_audit_log;
create policy "Verified managers read audit log" on public.manager_audit_log
  for select to authenticated using (public.is_manager());

create or replace function public.audit_manager_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_record jsonb;
begin
  if public.is_manager() then
    v_record := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    insert into public.manager_audit_log (manager_id, resource, record_key, action)
    values (auth.uid(), tg_table_name, v_record ->> tg_argv[0], tg_op);
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_manager_change() from public, anon, authenticated;

drop trigger if exists audit_manager_change on public.staff;
create trigger audit_manager_change after insert or update or delete on public.staff
  for each row execute function public.audit_manager_change('id');
drop trigger if exists audit_manager_change on public.staff_payroll;
create trigger audit_manager_change after insert or update or delete on public.staff_payroll
  for each row execute function public.audit_manager_change('staff_id');
drop trigger if exists audit_manager_change on public.time_records;
create trigger audit_manager_change after insert or update or delete on public.time_records
  for each row execute function public.audit_manager_change('id');
drop trigger if exists audit_manager_change on public.holidays;
create trigger audit_manager_change after insert or update or delete on public.holidays
  for each row execute function public.audit_manager_change('date');
drop trigger if exists audit_manager_change on public.app_config;
create trigger audit_manager_change after insert or update or delete on public.app_config
  for each row execute function public.audit_manager_change('key');

commit;
