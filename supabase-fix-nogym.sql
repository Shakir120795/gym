-- ============================================================
-- Gym Manager — No-gym login fix (ek baar chalana hai)
-- Supabase: SQL Editor > New query > paste > Run.
--
-- Pehle: jis login ke metadata me gym_id nahi tha, wo default
-- 'gym-main' (Gold Gym) ka data khol leta tha — isliye admin wala
-- email bhi app me Gold Gym khol raha tha.
-- Ab: bina gym_id wala login KISI bhi gym ka data nahi dekh
-- payega. Har gym ke login ke metadata me uski gym_id hona
-- zaroori hai (panel se bane login me khud aa jata hai).
-- Dobara chalane se kuch nahi bigdega.
-- ============================================================

drop policy if exists "own gym only" on public.records;
create policy "own gym only" on public.records
  for all to authenticated
  using (gym_id = (auth.jwt() -> 'user_metadata' ->> 'gym_id'))
  with check (gym_id = (auth.jwt() -> 'user_metadata' ->> 'gym_id'));

drop policy if exists "read own license" on public.licenses;
create policy "read own license" on public.licenses
  for select to authenticated
  using (gym_id = (auth.jwt() -> 'user_metadata' ->> 'gym_id'));
