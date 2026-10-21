-- ============================================================
-- Gym Manager — License / Demo lock (SaaS control)
-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.
--
-- Ek row = ek gym ka license.
--   status 'active'  -> paid gym, app kabhi lock nahi hoga
--   status 'trial'   -> demo gym, trial_ends ke AGLE din app lock ho jayega
--   row hi nahi hai  -> app lock nahi hoga (safe default)
--
-- App sirf apne gym ki row PADH sakta hai (RLS). Badalna sirf yahin
-- SQL Editor se hoga — gym owner khud apna license change nahi kar sakta.
-- ============================================================

create table if not exists public.licenses (
  gym_id text primary key,
  status text not null default 'trial',
  trial_ends date,
  plan text,
  plan_ends date,
  created_at timestamptz not null default now()
);

-- Purani table ho to naye column jod do (plan system ke liye).
alter table public.licenses add column if not exists plan text;
alter table public.licenses add column if not exists plan_ends date;

grant select on public.licenses to authenticated;

alter table public.licenses enable row level security;

drop policy if exists "read own license" on public.licenses;
create policy "read own license" on public.licenses
  for select to authenticated
  using (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'));

-- Pehla (apna) gym hamesha active — kabhi lock nahi hoga.
insert into public.licenses (gym_id, status, trial_ends, plan, plan_ends)
values ('gym-main', 'active', null, 'Lifetime', null)
on conflict (gym_id) do nothing;

-- ============================================================
-- DEMO GYM banana ho to (pehle Authentication me user banao jiska
-- metadata gym_id yahi ho, phir ye chalao — gym_id badal lena):
--
-- insert into public.licenses (gym_id, status, trial_ends)
-- values ('gym-demo1', 'trial', current_date + 7);
--
-- PAYMENT aa jaye — gym ko lifetime unlock karna:
--
-- update public.licenses set status = 'active', trial_ends = null
-- where gym_id = 'gym-demo1';
--
-- Demo kuch din aur badhana ho:
--
-- update public.licenses set trial_ends = current_date + 7
-- where gym_id = 'gym-demo1';
--
-- Demo turant band karna ho (usi din lock):
--
-- update public.licenses set trial_ends = current_date - 1
-- where gym_id = 'gym-demo1';
--
-- Saare gyms ke license ek saath dekhne ke liye:
--
-- select * from public.licenses order by created_at;
-- ============================================================
