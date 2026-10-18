# Cloud database setup (Supabase, free) — REQUIRED

Ye app 100% online hai. Bina Supabase ke app khulegi hi nahi: koi data phone
mein store nahi hota, sirf login session rehta hai. Internet nahi = app nahi.

## Pehli baar setup

1. supabase.com par free account banao, "New project" dabao (naam: gym, ek password rakho, region: Mumbai).
2. Left menu: SQL Editor > New query. `supabase-setup.sql` ka poora text paste karke Run dabao.
3. Authentication > Users > Add user > Create new user. Gym owner ka email aur password daalo, "Auto Confirm User" ON rakho.
4. Authentication > Sign In / Providers mein "Allow new users to sign up" ko OFF kar do, taaki koi aur account na bana sake. **Yahi owner ka control hai:** jiska account hai wahi app khol sakta hai.
5. Project Settings > API: "Project URL" aur "anon public" key copy karo.
6. `config.js` kholo, url aur key paste karo, save karo.
7. Folder ko GitHub pe update karo. Vercel khud naya version deploy kar dega.
8. Har phone / computer pe app kholo, wahi email aur password se Sign in karo. Sab jagah same live data dikhega.

## Owner ka control

- **Data owner ke Supabase mein hai.** Table Editor > `records` mein poora data dekh sakte ho.
- **Access band karna ho:** Authentication > Users mein us user ko delete kar do ya password badal do. Us phone pe app turant kaam karna band kar degi.
- **Backup:** app ke Settings mein "Download backup" se kabhi bhi poora data JSON mein nikal sakte ho.
- **Ek se zyada staff:** har staff ko alag user banao (sabko same data dikhega). Kisi ko nikalna ho to uska user delete kar do.

## Zaroori baatein

- Internet ke bina app ka koi bhi option kaam nahi karega — ye by design hai.
- Service worker kuch bhi offline save nahi karta; wo sirf "Install app" ke liye hai.
- Purani PWA files (`manifest.json`, `sw.js`) `pwa-backup/` mein rakhi hain, zaroorat ho to wapas la sakte ho.
