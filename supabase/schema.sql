create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null check (role in ('Instrutor', 'Personal Trainer', 'Estagiário', 'Coordenador', 'Recepcionista')),
  email text,
  phone text,
  color text not null default '#10B981',
  active boolean not null default true,
  scheduled_shift text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'professor' check (role in ('manager', 'professor')),
  staff_id text references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_one_user_per_staff_idx
  on public.profiles (staff_id)
  where staff_id is not null and role = 'professor';

create table if not exists public.staff_payroll (
  staff_id text primary key references public.staff(id) on delete cascade,
  hourly_rate numeric(10, 2) not null check (hourly_rate > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_records (
  id text primary key,
  staff_id text not null references public.staff(id),
  staff_name text not null,
  staff_role text not null,
  date date not null,
  time text not null,
  timestamp bigint not null,
  type text not null check (type in ('ENTRADA', 'SAIDA', 'INTERVALO_SAIDA', 'INTERVALO_RETORNO')),
  location text not null,
  notes text,
  code text not null,
  created_at timestamptz not null default now()
);

create index if not exists time_records_staff_date_idx
  on public.time_records (staff_id, date, timestamp);

create or replace function public.register_time_punch(
  p_staff_id text,
  p_type text,
  p_location text,
  p_notes text default null
)
returns setof public.time_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id text;
  v_staff_name text;
  v_staff_role text;
  v_active boolean;
  v_last_type text;
  v_last_timestamp bigint;
  v_expected_type text;
  v_now timestamptz;
  v_local_now timestamp;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if public.is_manager() then
    v_staff_id := p_staff_id;
  else
    select staff_id into v_staff_id
    from public.profiles
    where id = auth.uid();

    if v_staff_id is null or (p_staff_id is not null and p_staff_id <> v_staff_id) then
      raise exception 'Professor sem vínculo válido com um colaborador.';
    end if;
  end if;

  select name, role, active
    into v_staff_name, v_staff_role, v_active
  from public.staff
  where id = v_staff_id
  for update;

  if not found or not v_active then
    raise exception 'Colaborador inexistente ou inativo.';
  end if;

  select type, timestamp into v_last_type, v_last_timestamp
  from public.time_records
  where staff_id = v_staff_id and type in ('ENTRADA', 'SAIDA')
  order by timestamp desc
  limit 1;

  v_expected_type := case when v_last_type is null or v_last_type = 'SAIDA' then 'ENTRADA' else 'SAIDA' end;
  if p_type <> v_expected_type then
    raise exception 'Batida inválida. Próximo registro esperado: %.', v_expected_type;
  end if;

  v_now := clock_timestamp();
  if v_last_timestamp is not null and floor(extract(epoch from v_now) * 1000)::bigint <= v_last_timestamp then
    v_now := to_timestamp((v_last_timestamp + 1) / 1000.0);
  end if;
  v_local_now := timezone('America/Sao_Paulo', v_now);

  return query
  insert into public.time_records (
    id, staff_id, staff_name, staff_role, date, time, timestamp, type, location, notes, code
  ) values (
    'tr-' || gen_random_uuid()::text,
    v_staff_id,
    v_staff_name,
    v_staff_role,
    v_local_now::date,
    to_char(v_local_now, 'HH24:MI:SS'),
    floor(extract(epoch from v_now) * 1000)::bigint,
    p_type,
    coalesce(nullif(p_location, ''), 'OG FITNESS'),
    nullif(trim(p_notes), ''),
    'PG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  )
  returning *;
end;
$$;

create table if not exists public.holidays (
  date date primary key,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default 'false'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.limit_manager_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_count integer;
begin
  if new.role = 'manager' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(732010);
    elsif old.role is distinct from new.role then
      perform pg_advisory_xact_lock(732010);
    else
      return new;
    end if;

    select count(*) into v_manager_count
    from public.profiles
    where role = 'manager';
    if v_manager_count >= 2 then
      raise exception 'O sistema permite no máximo dois gestores.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.link_staff_account(p_email text, p_staff_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_manager() then
    raise exception 'Somente gestores podem vincular contas.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'Não existe conta Supabase para este e-mail.';
  end if;

  update public.profiles
  set staff_id = p_staff_id
  where id = v_user_id and role = 'professor';

  if not found then
    raise exception 'A conta informada não é um perfil de professor.';
  end if;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

drop trigger if exists enforce_two_managers on public.profiles;
create trigger enforce_two_managers
  before insert or update of role on public.profiles
  for each row execute procedure public.limit_manager_accounts();

alter table public.staff enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_payroll enable row level security;
alter table public.time_records enable row level security;
alter table public.holidays enable row level security;
alter table public.app_config enable row level security;

drop policy if exists "Authenticated users read staff directory" on public.staff;
create policy "Authenticated users read staff directory"
  on public.staff for select to authenticated using (true);
drop policy if exists "Managers manage staff directory" on public.staff;
create policy "Managers manage staff directory"
  on public.staff for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "Users read own profile and managers read all" on public.profiles;
create policy "Users read own profile and managers read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());

drop policy if exists "Only managers read payroll" on public.staff_payroll;
create policy "Only managers read payroll"
  on public.staff_payroll for select to authenticated using (public.is_manager());
drop policy if exists "Only managers manage payroll" on public.staff_payroll;
create policy "Only managers manage payroll"
  on public.staff_payroll for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "Users read own time records and managers read all" on public.time_records;
create policy "Users read own time records and managers read all"
  on public.time_records for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.staff_id = time_records.staff_id
    )
  );
drop policy if exists "Users create own time records and managers create all" on public.time_records;
drop policy if exists "Managers import time records" on public.time_records;
create policy "Managers import time records"
  on public.time_records for insert to authenticated
  with check (public.is_manager());
drop policy if exists "Only managers update time records" on public.time_records;
create policy "Only managers update time records"
  on public.time_records for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
drop policy if exists "Only managers delete time records" on public.time_records;
create policy "Only managers delete time records"
  on public.time_records for delete to authenticated using (public.is_manager());

drop policy if exists "Only managers access holidays" on public.holidays;
create policy "Only managers access holidays"
  on public.holidays for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "Authenticated users read migration status" on public.app_config;
create policy "Authenticated users read migration status"
  on public.app_config for select to anon, authenticated using (key = 'payroll_migration_complete');
drop policy if exists "Only managers manage app config" on public.app_config;
create policy "Only managers manage app config"
  on public.app_config for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

grant select, insert, update, delete on public.staff to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.staff_payroll to authenticated;
grant select, insert, update, delete on public.time_records to authenticated;
grant select, insert, update, delete on public.holidays to authenticated;
grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;
revoke insert on public.time_records from anon;
revoke all on function public.register_time_punch(text, text, text, text) from public, anon;
revoke all on function public.is_manager() from public, anon;
revoke all on function public.link_staff_account(text, text) from public, anon;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.register_time_punch(text, text, text, text) to authenticated;
grant execute on function public.link_staff_account(text, text) to authenticated;

-- Depois de criar os dois usuários gestores no Supabase Auth, promova-os:
-- update public.profiles
-- set role = 'manager'
-- where id in (
--   (select id from auth.users where email = 'gestor1@exemplo.com'),
--   (select id from auth.users where email = 'gestor2@exemplo.com')
-- );
--
-- Vincule cada professor ao cadastro correspondente:
-- update public.profiles
-- set staff_id = 'st-1'
-- where id = (select id from auth.users where email = 'professor@exemplo.com');
