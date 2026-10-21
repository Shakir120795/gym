// @ts-nocheck
/* Gym Manager — Super Admin backend (Supabase Edge Function, name: admin).
 *
 * This is the ONLY place the service_role (master) key is used — it lives
 * in the function's environment on Supabase, never in the website code.
 * Every call must carry the login token of the ONE admin account
 * (the user whose app_metadata has {"role":"admin"} — see
 * supabase-admin-setup.sql). Anyone else gets 403.
 *
 * Actions (POST JSON { action, ... }):
 *   list        -> all gyms: license, name, member count, logins, activity
 *   upgrade     { gymId, plan }      -> paid plan: monthly/quarterly/half/
 *                                       yearly (days from today or from the
 *                                       current plan end, whichever later)
 *                                       or lifetime. Plan end = auto lock.
 *   activate    { gymId }            -> same as upgrade to lifetime
 *   extend      { gymId, days=7 }    -> trial, ends today+days (from the
 *                                       later of today / current end date)
 *   lock        { gymId }            -> trial ended yesterday = locked now
 *   createDemo  { gymName, email, password, plan } -> naya gym + login.
 *                                       plan 'trial' (default) = 7-day
 *                                       trial; warna seedha paid plan
 *                                       (monthly/quarterly/half/yearly/
 *                                       lifetime) — bina trial ke start.
 *   setPlan     { gymId, plan }      -> plan BADLO: aaj se fresh plan,
 *                                       purani bachi duration khatam
 *   addUser     { gymId, email, password } -> existing gym ke liye naya
 *                                       login (access wapas dena / dusra
 *                                       staff login). License nahi badalta.
 *   setPassword { userId, password } -> change a gym login's password
 *   deleteUser  { userId }           -> remove a login (access revoked)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const isoDate = d => d.toISOString().slice(0, 10);
const todayD = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const slug = name => 'gym-' + String(name || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Who is calling? Must be the admin account.
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const caller = userData && userData.user;
    if (userErr || !caller) return json({ error: 'Login required' }, 401);
    if (!caller.app_metadata || caller.app_metadata.role !== 'admin') return json({ error: 'Not an admin account' }, 403);

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'list') {
      const lic = await admin.from('licenses').select('gym_id,status,trial_ends,plan,plan_ends,created_at').order('created_at');
      if (lic.error) return json({ error: 'licenses table/columns missing hai — pehle supabase-license.sql aur supabase-plans.sql chalao. (' + lic.error.message + ')' }, 500);
      const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const byGym = {};
      (usersRes.data ? usersRes.data.users : []).forEach(u => {
        if (u.app_metadata && u.app_metadata.role === 'admin') return; // super admin gym logins me nahi aata
        const gid = (u.app_metadata && u.app_metadata.gym_id) || (u.user_metadata && u.user_metadata.gym_id) || 'gym-main';
        (byGym[gid] = byGym[gid] || []).push({ id: u.id, email: u.email, lastSignIn: u.last_sign_in_at || null });
      });
      const ids = new Set([...lic.data.map(r => r.gym_id), ...Object.keys(byGym)]);
      const gyms = [];
      for (const gid of ids) {
        const row = lic.data.find(r => r.gym_id === gid) || null;
        const cnt = await admin.from('records').select('id', { count: 'exact', head: true })
          .eq('gym_id', gid).eq('kind', 'member').eq('deleted', false);
        const cfg = await admin.from('records').select('data')
          .eq('gym_id', gid).eq('kind', 'cfg').eq('id', 'main').maybeSingle();
        const last = await admin.from('records').select('updated_at')
          .eq('gym_id', gid).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        gyms.push({
          gymId: gid,
          name: (cfg.data && cfg.data.data && cfg.data.data.gym && cfg.data.data.gym.name) || '',
          status: row ? row.status : 'none',
          trialEnds: row ? row.trial_ends : null,
          plan: row ? (row.plan || '') : '',
          planEnds: row ? row.plan_ends : null,
          members: cnt.count || 0,
          lastActive: last.data ? last.data.updated_at : null,
          users: byGym[gid] || [],
        });
      }
      gyms.sort((a, b) => a.gymId.localeCompare(b.gymId));
      return json({ gyms });
    }

    const PLANS = { monthly: ['Monthly', 30], quarterly: ['3 Months', 90], half: ['6 Months', 180], yearly: ['Yearly', 365], lifetime: ['Lifetime', null] };

    if (action === 'upgrade' || action === 'activate') {
      const gid = String(body.gymId || '');
      if (!gid) return json({ error: 'gymId missing' }, 400);
      const p = action === 'activate' ? PLANS.lifetime : PLANS[body.plan];
      if (!p) return json({ error: 'Unknown plan: ' + body.plan }, 400);
      let ends = null;
      if (p[1]) {
        const cur = await admin.from('licenses').select('status,plan_ends').eq('gym_id', gid).maybeSingle();
        const curEnd = cur.data && cur.data.status === 'active' && cur.data.plan_ends
          ? new Date(cur.data.plan_ends + 'T00:00:00Z') : null;
        const base = curEnd && curEnd > todayD() ? curEnd : todayD();
        ends = isoDate(addDays(base, p[1]));
      }
      const patch = { status: 'active', plan: p[0], plan_ends: ends, trial_ends: null };
      const up = await admin.from('licenses').upsert({ gym_id: gid, ...patch }, { onConflict: 'gym_id' });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true, gymId: gid, ...patch });
    }

    if (action === 'setPlan') {
      // Plan BADLO: aaj se fresh plan — purani bachi duration khatam.
      const gid = String(body.gymId || '');
      if (!gid) return json({ error: 'gymId missing' }, 400);
      const p = PLANS[body.plan];
      if (!p) return json({ error: 'Unknown plan: ' + body.plan }, 400);
      const ends = p[1] ? isoDate(addDays(todayD(), p[1])) : null;
      const patch = { status: 'active', plan: p[0], plan_ends: ends, trial_ends: null };
      const up = await admin.from('licenses').upsert({ gym_id: gid, ...patch }, { onConflict: 'gym_id' });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true, gymId: gid, ...patch });
    }

    if (action === 'extend' || action === 'lock') {
      const gid = String(body.gymId || '');
      if (!gid) return json({ error: 'gymId missing' }, 400);
      let patch;
      if (action === 'lock') patch = { status: 'trial', trial_ends: isoDate(addDays(todayD(), -1)), plan: 'Trial', plan_ends: null };
      else {
        const days = Math.max(1, Math.min(90, +body.days || 7));
        const cur = await admin.from('licenses').select('trial_ends').eq('gym_id', gid).maybeSingle();
        const curEnd = cur.data && cur.data.trial_ends ? new Date(cur.data.trial_ends + 'T00:00:00Z') : null;
        const base = curEnd && curEnd > todayD() ? curEnd : todayD();
        patch = { status: 'trial', trial_ends: isoDate(addDays(base, days)), plan: 'Trial', plan_ends: null };
      }
      const up = await admin.from('licenses').upsert({ gym_id: gid, ...patch }, { onConflict: 'gym_id' });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ ok: true, gymId: gid, ...patch });
    }

    if (action === 'createDemo') {
      const gymName = String(body.gymName || '').trim();
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      if (!gymName || !email || password.length < 6) return json({ error: 'Gym name, email aur kam se kam 6 character ka password chahiye' }, 400);
      const planKey = String(body.plan || 'trial');
      if (planKey !== 'trial' && !PLANS[planKey]) return json({ error: 'Unknown plan: ' + planKey }, 400);
      let gid = slug(gymName) || 'gym-demo';
      const existing = await admin.from('licenses').select('gym_id');
      const taken = new Set((existing.data || []).map(r => r.gym_id));
      if (taken.has(gid)) { let i = 2; while (taken.has(gid + '-' + i)) i++; gid = gid + '-' + i; }
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { gym_id: gid },
      });
      if (created.error) return json({ error: created.error.message }, 400);
      let licRow, ends;
      if (planKey === 'trial') {
        ends = isoDate(addDays(todayD(), 7));
        licRow = { gym_id: gid, status: 'trial', trial_ends: ends, plan: 'Trial', plan_ends: null };
      } else {
        const p = PLANS[planKey];
        ends = p[1] ? isoDate(addDays(todayD(), p[1])) : null;
        licRow = { gym_id: gid, status: 'active', trial_ends: null, plan: p[0], plan_ends: ends };
      }
      const lic = await admin.from('licenses').upsert(licRow, { onConflict: 'gym_id' });
      if (lic.error) {
        await admin.auth.admin.deleteUser(created.data.user.id);
        return json({ error: 'License nahi bana: ' + lic.error.message }, 500);
      }
      // Gym ka naam pehle din se save — panel aur app dono me sahi dikhega.
      await admin.from('records').upsert(
        { gym_id: gid, kind: 'cfg', id: 'main', data: { gym: { name: gymName, phone: '' }, plans: [] }, deleted: false, updated_at: new Date().toISOString() },
        { onConflict: 'gym_id,kind,id' });
      return json({ ok: true, gymId: gid, email, plan: licRow.plan, trialEnds: licRow.trial_ends, planEnds: licRow.plan_ends });
    }

    if (action === 'addUser') {
      const gid = String(body.gymId || '');
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      if (!gid || !email || password.length < 6) return json({ error: 'gymId, email aur 6+ character password chahiye' }, 400);
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { gym_id: gid },
      });
      if (created.error) return json({ error: created.error.message }, 400);
      return json({ ok: true, gymId: gid, email });
    }

    if (action === 'setPassword') {
      const userId = String(body.userId || ''), password = String(body.password || '');
      if (!userId || password.length < 6) return json({ error: 'userId aur 6+ character password chahiye' }, 400);
      const r = await admin.auth.admin.updateUserById(userId, { password });
      if (r.error) return json({ error: r.error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'deleteUser') {
      const userId = String(body.userId || '');
      if (!userId) return json({ error: 'userId missing' }, 400);
      if (userId === caller.id) return json({ error: 'Apna khud ka admin account delete nahi kar sakte' }, 400);
      const r = await admin.auth.admin.deleteUser(userId);
      if (r.error) return json({ error: r.error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action: ' + action }, 400);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
});
