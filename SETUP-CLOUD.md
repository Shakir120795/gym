# Cloud sync setup (Supabase, free)

1. supabase.com par free account banao, "New project" dabao (naam: gym, ek password rakho, region: Mumbai).
2. Left menu: SQL Editor > New query. `supabase-setup.sql` ka poora text paste karke Run dabao.
3. Authentication > Users > Add user > Create new user. Apna email aur password daalo, "Auto Confirm User" ON rakho.
4. Authentication > Sign In / Providers (ya Settings) mein "Allow new users to sign up" ko OFF kar do, taaki koi aur account na bana sake.
5. Project Settings > API: "Project URL" aur "anon public" key copy karo.
6. `config.js` kholo, url aur key paste karo, save karo.
7. Folder ko GitHub pe update karo. Vercel khud naya version deploy kar dega.
8. Har phone / computer pe app kholo, wahi email aur password se Sign in karo. Bas, sab jagah same data dikhega.
