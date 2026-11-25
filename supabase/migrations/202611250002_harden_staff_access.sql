begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke create on schema public from public, anon, authenticated;

alter table public.staff add column if not exists pin_hash text;

create or replace function public.hash_staff_pin()
returns trigger
language plpgsql security definer set search_path = pg_catalog, extensions, public
as $$
begin
  if new.pin is not null then
    if new.pin !~ '^[0-9]{6}$' then
      raise exception 'O PIN deve ter seis dígitos.';
    end if;
    new.pin_hash := crypt(new.pin, gen_salt('bf', 10));
    new.pin := null;
  end if;
  if tg_op = 'UPDATE' and (
    new.pin_hash is distinct from old.pin_hash or
    new.username is distinct from old.username or
    (old.active and not new.active)
  ) then
    delete from public.staff_device_sessions where staff_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists hash_staff_pin on public.staff;
create trigger hash_staff_pin before insert or update on public.staff
for each row execute function public.hash_staff_pin();

update public.staff set pin = trim(pin) where trim(pin) ~ '^[0-9]{6}$';
update public.staff set pin = null where pin is not null;

create or replace function public.save_manager_staff(p_staff jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_manager() then raise exception 'Permissão de gestor necessária.'; end if;
  insert into public.staff (id, name, username, pin, role, email, phone, color, active, scheduled_shift)
  select s.id, s.name, s.username, s.pin, s.role, s.email, s.phone, s.color, s.active, s.scheduled_shift
  from jsonb_to_recordset(p_staff) as s(
    id text, name text, username text, pin text, role text, email text, phone text,
    color text, active boolean, scheduled_shift text
  )
  on conflict (id) do update set name = excluded.name, username = excluded.username,
    pin_hash = coalesce(excluded.pin_hash, staff.pin_hash), role = excluded.role,
    email = excluded.email, phone = excluded.phone, color = excluded.color,
    active = excluded.active, scheduled_shift = excluded.scheduled_shift;
end;
$$;

create table if not exists public.staff_login_attempts (
  staff_id text primary key references public.staff(id) on delete cascade,
  failures integer not null default 0,
  reset_at timestamptz not null
);
alter table public.staff_login_attempts enable row level security;
revoke all on public.staff_login_attempts from public, anon, authenticated;

create or replace function public.start_staff_device_session(p_username text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, extensions, public
as $$
declare
  v_staff public.staff%rowtype;
  v_attempt public.staff_login_attempts%rowtype;
  v_token text;
  v_now timestamptz := clock_timestamp();
begin
  if p_username is null or length(p_username) > 120 or p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('success', false);
  end if;

  select * into v_staff from public.staff
  where lower(trim(username)) = lower(trim(p_username)) and active
  for share;
  if not found or v_staff.pin_hash is null then
    return jsonb_build_object('success', false);
  end if;

  insert into public.staff_login_attempts (staff_id, reset_at)
  values (v_staff.id, v_now + interval '15 minutes') on conflict do nothing;
  select * into v_attempt from public.staff_login_attempts where staff_id = v_staff.id for update;
  if v_attempt.reset_at <= v_now then
    v_attempt.failures := 0;
    v_attempt.reset_at := v_now + interval '15 minutes';
  elsif v_attempt.failures >= 5 then
    return jsonb_build_object('success', false, 'throttled', true);
  end if;

  if crypt(p_pin, v_staff.pin_hash) is distinct from v_staff.pin_hash then
    update public.staff_login_attempts
    set failures = v_attempt.failures + 1, reset_at = v_attempt.reset_at
    where staff_id = v_staff.id;
    return jsonb_build_object('success', false);
  end if;

  update public.staff_login_attempts
  set failures = 0, reset_at = v_now + interval '15 minutes'
  where staff_id = v_staff.id;
  v_token := gen_random_uuid()::text || gen_random_uuid()::text;
  delete from public.staff_device_sessions where expires_at <= v_now;
  insert into public.staff_device_sessions (token_hash, staff_id, expires_at)
  values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    v_staff.id, v_now + interval '12 hours');
  return jsonb_build_object('success', true, 'token', v_token, 'staff', jsonb_build_object(
    'id', v_staff.id, 'name', v_staff.name, 'username', v_staff.username,
    'role', v_staff.role, 'color', v_staff.color,
    'scheduledShift', v_staff.scheduled_shift, 'active', true, 'hourlyRate', 0
  ));
end;
$$;

create or replace function public.end_staff_device_session(p_token text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.staff_device_sessions
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function public.read_manager_staff()
returns setof public.staff
language sql stable security definer set search_path = ''
as $$
  select jsonb_populate_record(null::public.staff, to_jsonb(s) - 'pin' - 'pin_hash')
  from public.staff s where public.is_manager() order by s.name;
$$;

create or replace function public.read_own_staff(p_token text default null)
returns setof public.staff
language sql stable security definer set search_path = ''
as $$
  select jsonb_populate_record(null::public.staff, to_jsonb(s) - 'pin' - 'pin_hash' - 'email' - 'phone')
  from public.staff s where s.active and s.id = coalesce(public.device_staff_id(p_token), (
    select p.staff_id from public.profiles p where p.id = auth.uid()
  ));
$$;

revoke select (id, name, username, role, email, phone, color, active, scheduled_shift)
  on public.staff from public, anon, authenticated;
grant select (id) on public.staff to authenticated;
revoke insert, update on public.staff from anon, authenticated;
drop policy if exists "Authenticated users read staff directory" on public.staff;
create policy "Authenticated users read staff directory" on public.staff
  for select to authenticated using (public.is_manager());

drop policy if exists "Authenticated users read migration status" on public.app_config;
create policy "Authenticated users read migration status" on public.app_config
  for select to anon, authenticated using (key = 'payroll_migration_complete');

create or replace function public.read_gym_settings(p_token text default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select value from public.app_config where key = 'gym_settings'
    and (public.is_manager() or public.device_staff_id(p_token) is not null or exists (
      select 1 from public.profiles p join public.staff s on s.id = p.staff_id
      where p.id = auth.uid() and s.active
    ));
$$;

revoke execute on function public.hash_staff_pin() from public, anon, authenticated;
revoke execute on function public.end_staff_device_session(text), public.read_own_staff(text), public.read_gym_settings(text)
  from public;
grant execute on function public.end_staff_device_session(text), public.read_own_staff(text), public.read_gym_settings(text)
  to anon, authenticated;

commit;
