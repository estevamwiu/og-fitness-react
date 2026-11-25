begin;

create table if not exists public.occupancy_counts (
  date date not null,
  time_slot text not null check (time_slot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  payload jsonb not null,
  primary key (date, time_slot)
);

create table if not exists public.staff_device_sessions (
  token_hash text primary key,
  staff_id text not null references public.staff(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.occupancy_counts enable row level security;
alter table public.staff_device_sessions enable row level security;
revoke all on public.occupancy_counts, public.staff_device_sessions from public, anon, authenticated;
grant select, insert on public.occupancy_counts to authenticated;
drop policy if exists "Managers import local counts" on public.occupancy_counts;
drop policy if exists "Managers read counts" on public.occupancy_counts;
create policy "Managers import local counts" on public.occupancy_counts
  for insert to authenticated with check (public.is_manager());
create policy "Managers read counts" on public.occupancy_counts
  for select to authenticated using (public.is_manager());

create or replace function public.start_staff_device_session(p_username text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_result jsonb := public.verify_staff_login(p_username, p_pin);
  v_token text;
begin
  if v_result->>'success' = 'true' then
    v_token := gen_random_uuid()::text || gen_random_uuid()::text;
    delete from public.staff_device_sessions where expires_at <= now();
    insert into public.staff_device_sessions (token_hash, staff_id, expires_at)
    values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
      v_result #>> '{staff,id}', now() + interval '12 hours');
    return v_result || jsonb_build_object('token', v_token);
  end if;
  return v_result;
end;
$$;

create or replace function public.device_staff_id(p_token text)
returns text
language sql stable security definer set search_path = ''
as $$
  select s.id from public.staff_device_sessions d
  join public.staff s on s.id = d.staff_id
  where d.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and d.expires_at > now() and s.active;
$$;

create or replace function public.read_shared_occupancy(p_token text default null)
returns table (payload jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_manager() and public.device_staff_id(p_token) is null
    and not exists (select 1 from public.profiles p join public.staff s on s.id = p.staff_id
      where p.id = auth.uid() and s.active) then
    raise exception 'Acesso expirado. Entre novamente.';
  end if;
  return query select c.payload from public.occupancy_counts c order by c.date desc, c.time_slot desc;
end;
$$;

create or replace function public.save_shared_occupancy(p_count jsonb, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff_id text := public.device_staff_id(p_token);
  v_staff_name text;
  v_payload jsonb;
begin
  if public.is_manager() then
    v_staff_id := p_count->>'loggedByStaffId';
  elsif v_staff_id is null then
    select staff_id into v_staff_id from public.profiles where id = auth.uid();
  end if;
  select name into v_staff_name from public.staff where id = v_staff_id and active;
  if not found then
    raise exception 'Colaborador ativo não identificado. Confira o cadastro ou entre novamente.';
  end if;
  v_payload := p_count || jsonb_build_object('loggedByStaffId', v_staff_id, 'loggedByStaffName', v_staff_name);
  insert into public.occupancy_counts (date, time_slot, payload)
  values ((v_payload->>'date')::date, v_payload->>'timeSlot', v_payload)
  on conflict (date, time_slot) do update set payload = excluded.payload;
  return v_payload;
end;
$$;

create or replace function public.register_shared_punch(
  p_staff_id text, p_type text, p_location text, p_notes text, p_token text default null
)
returns setof public.time_records
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff_id text := public.device_staff_id(p_token);
begin
  if public.is_manager() then
    v_staff_id := p_staff_id;
  elsif v_staff_id is null then
    select staff_id into v_staff_id from public.profiles where id = auth.uid();
  end if;
  if v_staff_id is null or v_staff_id is distinct from p_staff_id then
    raise exception 'Acesso ao ponto não autorizado. Entre novamente.';
  end if;
  return query select * from public.register_time_punch(v_staff_id, p_type, p_location, p_notes);
end;
$$;

create or replace function public.read_shared_punches(p_token text default null)
returns setof public.time_records
language sql stable security definer set search_path = ''
as $$
  select r.* from public.time_records r
  where public.is_manager() or r.staff_id = coalesce(public.device_staff_id(p_token), (
    select p.staff_id from public.profiles p join public.staff s on s.id = p.staff_id
    where p.id = auth.uid() and s.active
  ));
$$;

create or replace function public.read_manager_staff()
returns setof public.staff
language sql stable security definer set search_path = ''
as $$
  select s.* from public.staff s where public.is_manager() order by s.name;
$$;

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
    pin = excluded.pin, role = excluded.role, email = excluded.email, phone = excluded.phone,
    color = excluded.color, active = excluded.active, scheduled_shift = excluded.scheduled_shift;
end;
$$;

revoke select on public.staff from anon, authenticated;
grant select (id, name, username, role, email, phone, color, active, scheduled_shift)
  on public.staff to anon, authenticated;
revoke select on public.staff_payroll from anon;
drop policy if exists "Only managers read payroll" on public.staff_payroll;
create policy "Only managers read payroll" on public.staff_payroll
  for select to authenticated using (public.is_manager());
revoke select on public.time_records from anon;
drop policy if exists "Users read time records" on public.time_records;
create policy "Users read time records" on public.time_records
  for select to authenticated
  using (public.is_manager() or staff_id = (
    select p.staff_id from public.profiles p where p.id = auth.uid()
  ));

revoke execute on function public.device_staff_id(text) from public, anon, authenticated;
revoke execute on function public.verify_staff_login(text, text) from public, anon, authenticated;
revoke execute on function public.register_time_punch(text, text, text, text) from public, anon, authenticated;
revoke insert on public.time_records from anon;
revoke execute on function public.start_staff_device_session(text, text),
  public.read_shared_occupancy(text), public.save_shared_occupancy(jsonb, text),
  public.register_shared_punch(text, text, text, text, text), public.read_shared_punches(text),
  public.read_manager_staff(), public.save_manager_staff(jsonb) from public, anon;
grant execute on function public.start_staff_device_session(text, text),
  public.read_shared_occupancy(text), public.save_shared_occupancy(jsonb, text),
  public.register_shared_punch(text, text, text, text, text), public.read_shared_punches(text)
  to anon, authenticated;
grant execute on function public.read_manager_staff(), public.save_manager_staff(jsonb) to authenticated;

commit;
