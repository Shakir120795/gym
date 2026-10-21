-- Run this once in Supabase: SQL Editor > New query > paste > Run
-- Multi-gym: every row belongs to one gym (gym_id). RLS makes sure a login
-- can only read/write rows of its own gym. Each gym's login gets its gym_id
-- in the user's APP metadata (sirf admin/SQL badal sakta hai, login wala
-- khud nahi — yahi iski security hai). SQL se:
--   update auth.users set raw_app_meta_data =
--     coalesce(raw_app_meta_data,'{}'::jsonb) || '{"gym_id":"gym-main"}'::jsonb
--   where email = 'gym-ke-login-ka-email';
-- The first gym uses "gym-main". New gyms get their own id, e.g. "gym-fitlife".

create table if not exists public.records (
  kind text not null,
  id text not null,
  gym_id text not null default 'gym-main',
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (gym_id, kind, id)
);

create index if not exists records_updated_at_idx on public.records (updated_at);
create index if not exists records_gym_id_idx on public.records (gym_id);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_updated_at();

-- Each login sees ONLY its own gym's data. The gym comes from the user's
-- app metadata. No gym_id there = no data at all (e.g. the admin login).
alter table public.records enable row level security;

drop policy if exists "signed in users only" on public.records;
drop policy if exists "own gym only" on public.records;
create policy "own gym only" on public.records
  for all to authenticated
  using (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'))
  with check (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'));

-- License / demo lock: one row per gym. The app can only READ its own
-- gym's row; only the SQL editor (super admin) can create or change rows.
-- status 'active' = paid (never locks). status 'trial' locks the app the
-- day after trial_ends. No row = no lock.
create table if not exists public.licenses (
  gym_id text primary key,
  status text not null default 'trial',
  trial_ends date,
  created_at timestamptz not null default now()
);

grant select on public.licenses to authenticated;

alter table public.licenses enable row level security;

drop policy if exists "read own license" on public.licenses;
create policy "read own license" on public.licenses
  for select to authenticated
  using (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'));

insert into public.licenses (gym_id, status, trial_ends)
values ('gym-main', 'active', null)
on conflict (gym_id) do nothing;
