# Admin Panel — Setup Guide (ek baar, ~10 minute)

Panel khulega: **your-app-link/admin.html**
Kaam: saare gyms ek jagah, trial/license ek click me control, naya demo
banana, kisi ka access band karna. SQL/dashboard kholne ki zaroorat nahi.

Peeche ek chhota backend hai (Supabase Edge Function) — master key sirf
wahi rehti hai, website ke code me kabhi nahi. Panel bina admin login ke
bekar hai: har request par server check karta hai ki login admin hai ya
nahi.

## Setup ke 5 step

### 1. License table (agar pehle nahi chalaya)
Supabase > SQL Editor me `supabase-license.sql` ek baar Run karo.
Phir `supabase-plans.sql` bhi Run karo — ye plan system ke column
(plan, plan_ends) jodta hai.

### 2. Apna admin account banao
Supabase > Authentication > Users > **Add user**:
- Apna email + ek strong password, **Auto Confirm User ON**
- Metadata kuch mat bharo

Phir SQL Editor me `supabase-admin-setup.sql` chalao — usme sirf apna
admin email daalna hai (jahan `TUMHARA-ADMIN-EMAIL@example.com` likha
hai). Isse tumhara account **admin** ban jayega.

### 3. Edge Function deploy karo (backend)
Supabase > **Edge Functions** > **Create a new function**:
- Naam: `admin`  (bilkul yahi naam rakhna)
- Code: `admin-function/index.ts` file ka poora text paste karo
- **Deploy** dabao

Bas. Koi secret/key alag se nahi dalna — Supabase function ko master
key khud deta hai.

### 4. Panel kholo
Browser me `admin.html` kholo, apne admin email/password se login karo.

## Panel me kya-kya hota hai

- **Upar ke number:** total gyms, kitne active (paid), kitne trial par,
  kitne locked.
- **Naya demo gym:** gym ka naam + owner ka email + password (Generate
  button hai) > **Demo gym banao**. 7-day trial khud ban jayega aur ek
  ready-made message milega — Copy karke owner ko WhatsApp kar do,
  usme app link + login + demo ki last date sab hoga.
- **Har gym ke card par:**
  - **Plan line** — gym ke paas kaunsa plan hai (Trial / Monthly /
    3 Months / 6 Months / Yearly / Lifetime) aur kab khatam hoga.
    Plan khatam hote hi app **khud lock** ho jati hai.
  - **Plan buttons (ek click upgrade/renew)** — payment aane par bas
    plan ka button dabao: Monthly (30 din), 3 Months, 6 Months,
    Yearly, Lifetime. Renewal bachi hui duration ke aage se judta
    hai — owner ka ek din bhi waste nahi hota.
  - **+7 din trial** — sirf trial gyms ke liye, demo badhana ho to.
  - **Abhi lock karo** — turant band karna ho to.
  - Status pill: Active / Trial · X din left / Locked / No license.
  - Members count aur last active time — kaunsa gym sach me use ho
    raha hai, pata chalta hai.
  - Har login ke saamne **Reset password** (owner bhool gaya ho to)
    aur **Access band karo** (login delete — data safe rehta hai).
  - Tumhara khud ka admin account is list me **nahi aata** — admin
    gym ka login nahi hota.

Aage ki planning: abhi payment ke baad plan tum panel se dete ho.
Baad me Razorpay jodenge — payment hote hi plan khud activate ho
jayega, panel sirf dekhne ke kaam aayega.

## Safety notes

- Admin password strong rakho — ye ek password saare gyms ki chaabi
  hai. Kisi ke saath share mat karo.
- `admin.html` public link par khulti hai, lekin bina admin login ke
  andar kuch nahi hota — har kaam server par dobara check hota hai.
- Gym owner apna license khud change nahi kar sakta (database sirf
  padhne deta hai). Unlock sirf tum kar sakte ho — panel se ya SQL se.
