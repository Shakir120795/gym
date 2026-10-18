-- MIGRATION: run this once on a database created with the OLD supabase-setup.sql
-- (before gym_id existed). It adds the gym_id column, backfills existing rows
-- to 'gym-main', and switches RLS so each login only sees its own gym's data.
--
-- After running: Supabase > Authentication > Users > open the gym's login >
-- edit "User Metadata" and set:  { "gym_id": "gym-main" }
-- (Without this the login still works via the 'gym-main' fallback, but set it
-- properly so every gym is explicit.)

alter table public.records
  add column if not exists gym_id text not null default 'gym-main';

update public.records set gym_id = 'gym-main' where gym_id is null;

-- Primary key must include gym_id, otherwise two gyms' rows
-- (e.g. both gyms' settings row kind='cfg', id='main') would collide.
alter table public.records drop constraint if exists records_pkey;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'records_pkey') then
    alter table public.records add primary key (gym_id, kind, id);
  end if;
end $$;

create index if not exists records_gym_id_idx on public.records (gym_id);

drop policy if exists "signed in users only" on public.records;
drop policy if exists "own gym only" on public.records;
create policy "own gym only" on public.records
  for all to authenticated
  using (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', 'gym-main'))
  with check (gym_id = coalesce(auth.jwt() -> 'user_metadata' ->> 'gym_id', 'gym-main'));
