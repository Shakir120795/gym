-- Run this once in Supabase: SQL Editor > New query > paste > Run
-- Multi-gym: every row belongs to one gym (gym_id). RLS makes sure a login
-- can only read/write rows of its own gym. Each gym's login gets its gym_id
-- in the user's metadata: Authentication > Users > user > User Metadata JSON:
--   { "gym_id": "gym-main" }
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
-- metadata (falls back to 'gym-main' for the first gym's login).
alter table public.records enable row level security;

drop policy if exists "signed in users only" on public.records;
drop policy if exists "own gym only" on public.records;
create policy "own gym only" on public.records
  for all to authenticated
  using (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', 'gym-main'))
  with check (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', 'gym-main'));
