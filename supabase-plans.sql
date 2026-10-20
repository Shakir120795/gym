-- ============================================================
-- Gym Manager — Plan system upgrade (ek baar chalana hai)
-- Supabase: SQL Editor > New query > paste > Run.
--
-- licenses table me 2 naye column:
--   plan      -> gym ke paas kaunsa plan hai (Trial / Monthly /
--                3 Months / 6 Months / Yearly / Lifetime)
--   plan_ends -> paid plan kab khatam hoga (Lifetime = khali/NULL)
-- Plan khatam hote hi app khud lock ho jayegi (server date se).
-- Dobara chalane se kuch nahi bigdega.
-- ============================================================

alter table public.licenses add column if not exists plan text;
alter table public.licenses add column if not exists plan_ends date;

-- Purani rows ko naam de do:
update public.licenses set plan = 'Lifetime' where status = 'active' and plan is null;
update public.licenses set plan = 'Trial' where status = 'trial' and plan is null;

-- Check: select * from public.licenses;
