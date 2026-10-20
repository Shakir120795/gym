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

## Demo gym (7-day trial + lock)

Kisi gym owner ko demo dena ho to usko hamesha **alag login + alag gym_id**
do (apna main login kabhi mat do). App pehle se hi online-only hai — files
copy karke bina login/database ke app chal hi nahi sakti. Uspar trial lock:

1. Upar wale steps se uska user banao, metadata mein naya gym_id do,
   jaise `{ "gym_id": "gym-demo1" }`.
2. Ek baar Supabase mein `supabase-license.sql` chalaya hua hona chahiye
   (license table ban jayegi, tumhara `gym-main` hamesha active rahega).
3. SQL Editor mein demo ki license row banao (7 din ka trial):
   `insert into public.licenses (gym_id, status, trial_ends) values ('gym-demo1', 'trial', current_date + 7);`
4. Owner app chalata rahega; Home par "Demo — X days left" dikhta rahega.
   7 din ke baad app khud lock ho jayegi — owner kuch nahi kar sakta,
   phone ki date badalne se bhi nahi khulegi (date server se aati hai).
5. **Payment aaye to unlock** (sirf tum kar sakte ho, SQL Editor se):
   `update public.licenses set status = 'active', trial_ends = null where gym_id = 'gym-demo1';`
   Demo badhana ho to: `update public.licenses set trial_ends = current_date + 7 where gym_id = 'gym-demo1';`
6. Lock screen par WhatsApp button chahiye to `config.js` mein `support`
   mein apna 10-digit number bhar do — owner ek tap me tumhe message karega.

Note: jis gym ki license row hi nahi hai, wo lock nahi hoga. Demo ke liye
row banana mat bhoolna.

## Owner ka control

- **Data owner ke Supabase mein hai.** Table Editor > `records` mein poora data dekh sakte ho (`gym_id` column mein kaunsa gym hai, ye bhi dikhta hai).
- **Access band karna ho:** Authentication > Users mein us user ko delete kar do ya password badal do. Us phone pe app turant kaam karna band kar degi.
- **Excel download:** app ke andar Reports / Attendance / Members se date-wise ya month-wise Excel (CSV) nikal sakte ho.
- **Ek gym mein ek se zyada staff:** un sabko SAME `gym_id` wali metadata ke saath alag user banao (sabko same gym ka data dikhega). Kisi ko nikalna ho to uska user delete kar do.

## Zaroori baatein

- Internet ke bina app ka koi bhi option kaam nahi karega — ye by design hai.
- Service worker kuch bhi offline save nahi karta; wo sirf "Install app" ke liye hai.
- Member delete karne par uski payments, attendance aur visits bhi delete ho jati hain (reports se bhi hatt jayengi).
