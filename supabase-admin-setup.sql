-- ============================================================
-- Gym Manager — Admin panel setup (ek baar chalana hai)
-- Supabase: SQL Editor > New query > paste > Run.
--
-- Step 1: pehle Authentication > Users > Add user se apna khud ka
--         admin account banao (apna email + password, Auto Confirm ON).
-- Step 2: neeche wali line me apna wahi email daalo aur Run karo.
--         Ye us account ko "admin" bana dega. Role app_metadata me
--         jata hai — use gym owners khud change NAHI kar sakte,
--         isliye admin panel safe hai.
-- ============================================================

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'TUMHARA-ADMIN-EMAIL@example.com';

-- Check karne ke liye (role: admin dikhna chahiye):
-- select email, raw_app_meta_data from auth.users;
