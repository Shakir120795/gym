-- ============================================================
-- Gym Manager — SECURITY FIX: gym_id ab app_metadata me
-- Supabase: SQL Editor > New query > poora paste > Run (ek baar).
--
-- Pehle gym_id user_metadata me tha — use login wala khud API se
-- badal sakta tha, matlab ek gym ka owner dusre gym ki id daal ke
-- uska data padh sakta tha. app_metadata sirf admin (service
-- role / SQL) badal sakta hai, login wala khud nahi.
--
-- Ye script: (1) har user ki gym_id app_metadata me copy karti
-- hai, (2) database policies ko app_metadata par switch karti
-- hai. Dobara chalane se kuch nahi bigdega.
-- ============================================================

-- 1) gym_id copy: user_metadata -> app_metadata (jahan hai wahan)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('gym_id', raw_user_meta_data ->> 'gym_id')
where raw_user_meta_data ->> 'gym_id' is not null;

-- 2) Policies ab app_metadata par bharosa karengi
drop policy if exists "own gym only" on public.records;
create policy "own gym only" on public.records
  for all to authenticated
  using (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'))
  with check (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'));

drop policy if exists "read own license" on public.licenses;
create policy "read own license" on public.licenses
  for select to authenticated
  using (gym_id = (auth.jwt() -> 'app_metadata' ->> 'gym_id'));

-- 3) Check kar lo — har gym login ke app_gym me uski id dikhegi:
select email,
       raw_user_meta_data ->> 'gym_id' as purani_jagah,
       raw_app_meta_data ->> 'gym_id' as nayi_jagah_app_metadata,
       raw_app_meta_data ->> 'role' as role
from auth.users order by email;
