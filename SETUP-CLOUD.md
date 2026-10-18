# Cloud database setup (Supabase, free) — REQUIRED

Ye app 100% online hai. Bina Supabase ke app khulegi hi nahi: koi data phone
mein store nahi hota, sirf login session rehta hai. Internet nahi = app nahi.

## Pehli baar setup (naya project)

1. supabase.com par free account banao, "New project" dabao (naam: gym, ek password rakho, region: Mumbai).
2. Left menu: SQL Editor > New query. `supabase-setup.sql` ka poora text paste karke Run dabao.
3. Authentication > Users > Add user > Create new user. Gym owner ka email aur password daalo, "Auto Confirm User" ON rakho.
4. Us user ko kholo > "User Metadata" edit karo aur ye JSON daalo:
   `{ "gym_id": "gym-main" }`
   (Pehle gym ka id hamesha `gym-main` rakho.)
5. Authentication > Sign In / Providers mein "Allow new users to sign up" ko OFF kar do, taaki koi aur account na bana sake. **Yahi owner ka control hai:** jiska account hai wahi app khol sakta hai.
6. Project Settings > API: "Project URL" aur "anon public" key copy karo.
7. `config.js` kholo, url aur key paste karo, save karo.
8. Folder ko GitHub pe update karo. Vercel khud naya version deploy kar dega.
9. Har phone / computer pe app kholo, wahi email aur password se Sign in karo. Sab jagah same live data dikhega.

## Purana database hai? (migration)

Agar database `gym_id` wale update se PEHLE bana tha to ek baar ye chalao:

1. SQL Editor > New query. `supabase-migrate-gymid.sql` ka poora text paste karke Run dabao.
2. Authentication > Users > gym wale user ko kholo > "User Metadata" mein daalo:
   `{ "gym_id": "gym-main" }`

Bas. Purana data `gym-main` gym ka maan liya jayega, kuch delete nahi hoga.

## Dusra gym add karna (SaaS)

Ek hi Supabase project mein kitne bhi gym chala sakte ho. Har gym ka data
database level par alag rehta hai — ek gym ka login dusre gym ka data dekh
hi nahi sakta, aur ek gym ka QR card dusre gym ke gate par kaam nahi karega.

1. Authentication > Users > Add user > Create new user. Dusre gym ke owner ka email/password daalo, "Auto Confirm User" ON.
2. Us user ki "User Metadata" mein daalo:
   `{ "gym_id": "gym-fitlife" }`
   (Har naye gym ke liye alag id: `gym-fitlife`, `gym-powerhouse`...)
3. Bas. Wo login karega to usko bilkul khaali naya gym milega. Pehle gym ka data usko dikhega hi nahi.

## Owner ka control

- **Data owner ke Supabase mein hai.** Table Editor > `records` mein poora data dekh sakte ho (`gym_id` column mein kaunsa gym hai, ye bhi dikhta hai).
- **Access band karna ho:** Authentication > Users mein us user ko delete kar do ya password badal do. Us phone pe app turant kaam karna band kar degi.
- **Excel download:** app ke andar Reports / Attendance / Members se date-wise ya month-wise Excel (CSV) nikal sakte ho.
- **Ek gym mein ek se zyada staff:** un sabko SAME `gym_id` wali metadata ke saath alag user banao (sabko same gym ka data dikhega). Kisi ko nikalna ho to uska user delete kar do.

## Zaroori baatein

- Internet ke bina app ka koi bhi option kaam nahi karega — ye by design hai.
- Service worker kuch bhi offline save nahi karta; wo sirf "Install app" ke liye hai.
- Member delete karne par uski payments, attendance aur visits bhi delete ho jati hain (reports se bhi hatt jayengi).
