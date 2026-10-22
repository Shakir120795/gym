/* Online-only database through Supabase (free plan). No gym data is stored on
   this device: the browser keeps only the login session. The app does not
   work without internet. Every phone signed in with the same gym's account
   sees the same live data. Multi-gym ready: each login belongs to one gym
   (gym_id in the user's metadata), the database (RLS) enforces that a login
   can only read/write its own gym's rows, and QR cards carry the gym id so a
   card from one gym never works at another. The owner controls everything
   from Supabase: revoke access by deleting the user in Authentication. */
(function () {
  'use strict';
  const C = window.GYM_CLOUD || {};
  const enabled = !!(C.url && C.key);
  const root = (C.url || '').replace(/\/$/, '');
  const AUTH = 'gymmanager.auth'; // login session only. Gym data is NEVER stored locally.
  const WINDOW_DAYS = 45, POLL_MS = 10000;
  const q = s => document.querySelector(s);
  const rd = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let session = rd(AUTH);
  let meta = { base: {}, lastPull: null };
  let state = 'setup';
  let running = false, rerun = false, deb = 0, lastErr = '';
  let booted = false, starting = false;
  let license = null, licCheckedAt = 0, serverDate = '';

  /* ---------- tiny helpers ---------- */
  function canon(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); }
  const sortV = v => [...v].sort((a, b) => a.t.localeCompare(b.t) || a.s.localeCompare(b.s));
  function mergeV(a, b) { const m = {}; [...a, ...b].forEach(x => { if (!m[x.s] || x.t < m[x.s].t) m[x.s] = x; }); return sortV(Object.values(m)); }
  const cutDate = () => addDays(today(), -WINDOW_DAYS);

  /* ---------- overlays ---------- */
  function showBlock(title, msg, retry) {
    const b = q('#netblock'); if (!b) return;
    q('#nbTitle').textContent = title;
    q('#nbMsg').textContent = msg;
    const r = q('#netRetry'); if (r) r.hidden = !retry;
    b.hidden = false;
  }
  function hideBlock() { const b = q('#netblock'); if (b) b.hidden = true; }
  function showLogin() { const l = q('#login'); if (l) l.hidden = false; setState('login'); }
  function hideLogin() { const l = q('#login'); if (l) l.hidden = true; }

  /* ---------- status ---------- */
  function setState(s) {
    state = s;
    const b = q('#syncBtn'); if (!b) return;
    b.hidden = !enabled;
    b.textContent = { loading: 'Loading', idle: 'Sync', syncing: 'Syncing', ok: 'Online', offline: 'Offline', error: 'Sync error', login: 'Sign in', setup: 'Setup', locked: 'Locked' }[s] || '';
    b.className = 'sync ' + s;
  }
  function statusText() {
    if (!enabled) return 'Cloud database is not connected. Ask the owner to set it up.';
    const who = session && session.email ? ` as ${session.email}` : '';
    return ({ ok: 'Online. All your phones show the same live data', loading: 'Loading your data', syncing: 'Syncing now', offline: 'Offline. The app needs internet to work', error: 'Sync problem: ' + lastErr, login: 'Not signed in', idle: 'Ready', setup: 'Not set up' }[state] || '') + (state === 'ok' ? who : '');
  }

  /* ---------- auth + REST ---------- */
  async function authReq(grant, body) {
    const r = await fetch(`${root}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { apikey: C.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error_description || j.msg || j.message || 'Sign in failed'), { status: r.status });
    session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || body.email || '', gymId: (j.user && j.user.app_metadata && j.user.app_metadata.gym_id) || '' };
    wr(AUTH, session);
  }
  function gymId() { return (session && session.gymId) || ''; }

  /* ---------- license / demo lock ----------
     One row per gym in the `licenses` table. The app can only READ its own
     gym's row (RLS); rows are created/changed only from the Supabase SQL
     editor by the super admin. status 'active' = paid, never locks.
     status 'trial' locks the day after trial_ends. No row (or the table
     missing) = no lock, so a setup miss can never lock a paying gym out.
     The date is compared against the SERVER date (Date response header),
     not the phone clock. */
  function serverToday() {
    if (serverDate) { const d = new Date(serverDate); if (!isNaN(d)) return d.toISOString().slice(0, 10); }
    return today();
  }
  function dayDiff(ends) { return Math.round((new Date(ends + 'T00:00:00Z') - new Date(serverToday() + 'T00:00:00Z')) / 864e5); }
  function licenseInfo() {
    if (!license) return { status: 'none', locked: false, kind: '', daysLeft: null, ends: '', plan: '' };
    const plan = license.plan || '';
    if (license.status === 'active') {
      const ends = license.plan_ends || '';
      if (!ends) return { status: 'active', locked: false, kind: '', daysLeft: null, ends: '', plan: plan || 'Lifetime' };
      const left = dayDiff(ends);
      return { status: 'active', locked: left < 0, kind: left < 0 ? 'plan' : '', daysLeft: Math.max(left, 0), ends, plan };
    }
    const ends = license.trial_ends || '';
    const left = ends ? dayDiff(ends) : 0;
    return { status: 'trial', locked: left < 0, kind: left < 0 ? 'trial' : '', daysLeft: Math.max(left, 0), ends, plan: plan || 'Trial' };
  }
  async function fetchLicense() {
    try {
      const rows = await api('GET', `/rest/v1/licenses?select=status,trial_ends,plan,plan_ends&gym_id=eq.${encodeURIComponent(gymId())}&limit=1`);
      license = (rows && rows[0]) || null;
    } catch (e) { /* failed check never locks the app */ }
    licCheckedAt = Date.now();
    return licenseInfo();
  }
  function showLock() {
    const b = q('#lockblock'); if (!b) return;
    const info = licenseInfo();
    const title = q('#lockTitle'), msg = q('#lockMsg');
    const planOver = info.kind === 'plan';
    if (title) title.textContent = planOver ? 'Plan ended' : 'Demo over';
    if (msg) msg.textContent = planOver
      ? 'Your gym\'s plan has ended. Message us to renew — after payment the app will start again right here and all your data stays safe.'
      : 'Your demo period is over. Message us to activate the app — after payment it will unlock right here and all your data stays safe.';
    const wa = q('#lockWa');
    if (wa) {
      const sp = (C.support || '').replace(/\D/g, '');
      const text = planOver
        ? 'I want to renew my Gym Manager app plan. My gym id: ' + gymId()
        : 'I want to activate the Gym Manager app. My gym id: ' + gymId();
      if (sp) wa.href = 'https://wa.me/' + (sp.length === 10 ? '91' + sp : sp) + '?text=' + encodeURIComponent(text);
      wa.hidden = !sp;
    }
    b.hidden = false;
  }
  function hideLock() { const b = q('#lockblock'); if (b) b.hidden = true; }
  function requireLogin() {
    session = null; try { localStorage.removeItem(AUTH); } catch (e) {}
    hideBlock(); showLogin();
  }
  async function ensureToken() {
    if (!session) throw new Error('auth');
    if (session.exp - Date.now() > 60000) return;
    try { await authReq('refresh_token', { refresh_token: session.refresh }); }
    catch (e) { if (e.status >= 400 && e.status < 500) { requireLogin(); throw new Error('auth'); } throw e; }
  }
  async function api(method, path, body, extra) {
    await ensureToken();
    const res = await fetch(root + path, { method, headers: Object.assign({ apikey: C.key, Authorization: 'Bearer ' + session.access, 'Content-Type': 'application/json' }, extra || {}), body: body ? JSON.stringify(body) : undefined });
    if (res.headers && res.headers.get) { const dh = res.headers.get('date'); if (dh) serverDate = dh; }
    if (res.status === 401) { requireLogin(); throw new Error('auth'); }
    const t = await res.text();
    if (!res.ok) throw new Error(t.slice(0, 200) || 'Request failed');
    return t ? JSON.parse(t) : null;
  }

  /* ---------- what to sync ---------- */
  function snapshot() {
    const m = {}, put = (kind, id, data) => { m[kind + '|' + id] = { k: kind + '|' + id, kind, id, data }; };
    put('cfg', 'main', { gym: db.gym, plans: db.plans });
    db.members.forEach(x => put('member', x.id, x));
    db.payments.forEach(x => put('pay', x.id, x));
    const cut = cutDate(), dates = new Set([...Object.keys(db.checkins), ...Object.keys(db.attendance)]);
    dates.forEach(d => {
      if (d < cut) return;
      const ids = new Set([...(db.attendance[d] || []), ...Object.keys(db.checkins[d] || {})]);
      ids.forEach(id => put('chk', d + '|' + id, { date: d, mid: id, v: sortV((db.checkins[d] || {})[id] || []) }));
    });
    return m;
  }
  function diff(snap) {
    const base = meta.base, cut = cutDate(), dirty = [], del = [];
    for (const k in snap) { const r = snap[k]; r.h = hash(canon(r.data)); if (base[k] !== r.h) dirty.push(r); }
    for (const k in base) {
      if (k.startsWith('chk|') && k.split('|')[1] < cut) { delete base[k]; continue; }
      if (!(k in snap)) del.push(k);
    }
    return { dirty, del };
  }

  /* ---------- pull and apply ---------- */
  async function pull() {
    const since = meta.lastPull ? new Date(new Date(meta.lastPull).getTime() - 2000).toISOString() : null;
    let all = [], off = 0;
    for (;;) {
      let p = `/rest/v1/records?select=kind,id,data,deleted,updated_at&gym_id=eq.${encodeURIComponent(gymId())}&order=updated_at.asc,kind.asc,id.asc&limit=1000&offset=${off}`;
      if (since) p += `&updated_at=gte.${encodeURIComponent(since)}`;
      const rows = await api('GET', p);
      all = all.concat(rows || []);
      if (!rows || rows.length < 1000) break;
      off += 1000;
    }
    return all;
  }
  function applyRemote(rows, snap, dirtyKeys, delKeys, first) {
    const base = meta.base; let changed = false;
    rows.forEach(r => {
      const key = r.kind + '|' + r.id;
      if (r.kind === 'chk') {
        const d = r.data || {}; if (!d.date || !d.mid) return;
        const day = (db.checkins[d.date] = db.checkins[d.date] || {});
        const cur = sortV(day[d.mid] || []), merged = mergeV(cur, d.v || []);
        const inAtt = (db.attendance[d.date] || []).includes(d.mid);
        if (canon(merged) !== canon(cur) || !inAtt) {
          day[d.mid] = merged;
          const a = (db.attendance[d.date] = db.attendance[d.date] || []);
          if (!a.includes(d.mid)) a.push(d.mid);
          changed = true;
        }
        base[key] = hash(canon({ date: d.date, mid: d.mid, v: sortV(d.v || []) }));
        return;
      }
      if (dirtyKeys.has(key) && !first && !r.deleted) return; // this phone changed it too, local copy wins and is pushed next
      if (delKeys.has(key) && !first) return;                 // this phone deleted it, the deletion is pushed next
      if (r.deleted) {
        if (r.kind === 'member') { const n = db.members.length; db.members = db.members.filter(x => x.id !== r.id); changed = changed || n !== db.members.length; }
        if (r.kind === 'pay') { const n = db.payments.length; db.payments = db.payments.filter(x => x.id !== r.id); changed = changed || n !== db.payments.length; }
        delete base[key]; return;
      }
      const h = hash(canon(r.data)), mine = snap[key];
      if (mine && hash(canon(mine.data)) === h) { base[key] = h; return; }
      if (r.kind === 'cfg') { db.gym = r.data.gym || db.gym; if (r.data.plans && r.data.plans.length) db.plans = r.data.plans; }
      else if (r.kind === 'member') { const i = db.members.findIndex(x => x.id === r.id); if (i >= 0) db.members[i] = r.data; else db.members.push(r.data); }
      else if (r.kind === 'pay') { if (!db.payments.some(x => x.id === r.id)) db.payments.push(r.data); }
      base[key] = h; changed = true;
    });
    return changed;
  }

  /* ---------- push ---------- */
  async function pushAll(dirty, del) {
    const gid = gymId();
    const rows = dirty.map(r => ({ kind: r.kind, id: r.id, gym_id: gid, data: r.data, deleted: false }))
      .concat(del.map(k => { const i = k.indexOf('|'); return { kind: k.slice(0, i), id: k.slice(i + 1), gym_id: gid, data: null, deleted: true }; }));
    for (let i = 0; i < rows.length; i += 200) {
      await api('POST', '/rest/v1/records?on_conflict=gym_id,kind,id', rows.slice(i, i + 200), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    dirty.forEach(r => { meta.base[r.k] = r.h; });
    del.forEach(k => { delete meta.base[k]; });
  }

  /* ---------- the sync cycle ---------- */
  function goOffline(msg) {
    setState('offline');
    showBlock('No internet', msg || 'This app does not work without internet. Turn on your connection and tap Retry.', true);
  }
  async function sync() {
    if (!enabled || !session || !booted) return;
    if (running) { rerun = true; return; }
    running = true; setState('syncing');
    try {
      const rows = await pull();
      const snap0 = snapshot(), d0 = diff(snap0), dirtyKeys = new Set(d0.dirty.map(r => r.k)), delKeys = new Set(d0.del);
      const changed = applyRemote(rows, snap0, dirtyKeys, delKeys, false);
      if (changed) { normalize(db); }
      const snap = snapshot(), { dirty, del } = diff(snap);
      await pushAll(dirty, del);
      let mx = meta.lastPull ? new Date(meta.lastPull).getTime() : 0;
      rows.forEach(r => { const t = new Date(r.updated_at).getTime(); if (t > mx) mx = t; });
      if (mx) meta.lastPull = new Date(mx).toISOString();
      setState('ok'); hideBlock();
      if (Date.now() - licCheckedAt > 60000) {
        const li = await fetchLicense();
        if (li.locked) { booted = false; setState('locked'); showLock(); return; }
      }
      if (changed && window.refreshLive) refreshLive();
    } catch (e) {
      if (e.message === 'auth') { /* login screen already shown */ }
      else if ((e && e.name === 'TypeError') || !navigator.onLine) goOffline();
      else { lastErr = e.message || 'unknown'; setState('error'); }
    } finally {
      running = false;
      if (rerun) { rerun = false; setTimeout(sync, 300); }
    }
  }
  function touch() { if (!enabled || !session || !booted) return; clearTimeout(deb); deb = setTimeout(sync, 700); }

  async function logout() {
    session = null; try { localStorage.removeItem(AUTH); } catch (e) {}
    booted = false; requireLogin();
  }

  /* ---------- boot ---------- */
  async function checkNet() {
    if (!navigator.onLine) return 'offline';
    try { await api('GET', `/rest/v1/records?select=id&gym_id=eq.${encodeURIComponent(gymId())}&limit=1`); return 'ok'; }
    catch (e) {
      if (e.message === 'auth') return 'auth';
      if (e && (e.name === 'TypeError' || !navigator.onLine)) return 'offline';
      return 'error:' + (e.message || 'unknown');
    }
  }
  async function fullPull() {
    meta = { base: {}, lastPull: null };
    const rows = await pull();
    const cut = cutDate();
    const fresh = rows.filter(r => r.kind !== 'chk' || !r.data || !r.data.date || r.data.date >= cut);
    applyRemote(fresh, snapshot(), new Set(), new Set(), true);
    normalize(db);
    const s = snapshot();
    for (const k in s) meta.base[k] = hash(canon(s[k].data));
    meta.lastPull = new Date().toISOString();
  }
  async function start() {
    if (starting) return;
    starting = true;
    try {
      hideLogin(); hideBlock(); setState('loading');
      if (!gymId()) {
        // Signed in, but no gym is linked (e.g. the admin/panel email).
        // No data opens — straight back to the login screen with the reason.
        requireLogin();
        const lm = q('#loginMsg');
        if (lm) lm.textContent = 'No gym is linked with this email. Log in with your gym email — the admin/panel email is not for the app.';
        return;
      }
      const net = await checkNet();
      if (net === 'auth') { requireLogin(); return; }
      if (net === 'offline') { goOffline(); return; }
      if (net.startsWith('error')) { setState('error'); lastErr = net.slice(6); showBlock('Connection failed', 'Database se connect nahi ho paya: ' + lastErr, true); return; }
      try { await fullPull(); }
      catch (e) {
        if (e.message === 'auth') { requireLogin(); return; }
        goOffline(); return;
      }
      const li = await fetchLicense();
      if (li.locked) { booted = false; setState('locked'); showLock(); return; }
      booted = true; setState('ok'); render();
    } finally { starting = false; }
  }
  function retry() { if (booted) sync(); else start(); }

  /* ---------- start ---------- */
  function init() {
    setState(state);
    if (!enabled) {
      setState('setup');
      showBlock('Setup required', 'The cloud database is not connected yet. Ask the owner to add the Supabase details in config.js. The app cannot work without it.', false);
      return;
    }
    const form = q('#loginForm');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = q('#loginMsg'), f = new FormData(form); msg.textContent = 'Signing in...';
      try {
        await authReq('password', { email: f.get('email').trim(), password: f.get('password') });
        form.reset(); msg.textContent = ''; start();
      } catch (err) { msg.textContent = (err && err.name === 'TypeError') ? 'No internet. Connect and try again.' : (err.status === 400 ? 'Wrong email or password.' : err.message); }
    });
    const rb = q('#netRetry');
    if (rb) rb.addEventListener('click', retry);
    const lr = q('#lockRetry');
    if (lr) lr.addEventListener('click', () => { hideLock(); start(); });
    const lo = q('#lockLogout');
    if (lo) lo.addEventListener('click', () => { hideLock(); logout(); });
    window.addEventListener('online', () => { if (!session) return; if (!booted) start(); else sync(); });
    window.addEventListener('offline', () => { if (session) goOffline('Connection lost. Wait for it to come back or tap Retry.'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && session && booted) sync(); });
    window.addEventListener('pagehide', () => { if (session && booted && !running) { clearTimeout(deb); sync(); } });
    setInterval(() => { if (!document.hidden && session && booted) sync(); }, POLL_MS);
    if (!session) { if (window.startPreview) window.startPreview(); else showLogin(); } else start();
  }

  /* Fetch older check-ins (outside the 45-day window) from the server —
     read-only. Record ids start with 'YYYY-MM-DD|memberId', so the date
     range applies directly on the id. */
  async function fetchChk(from, toNext) {
    if (!enabled || !session) return null;
    let all = [], off = 0;
    for (;;) {
      const rows = await api('GET', `/rest/v1/records?select=id,data&gym_id=eq.${encodeURIComponent(gymId())}&kind=eq.chk&deleted=eq.false&id=gte.${encodeURIComponent(from)}&id=lt.${encodeURIComponent(toNext)}&order=id.asc&limit=1000&offset=${off}`);
      all = all.concat(rows || []);
      if (!rows || rows.length < 1000) break;
      off += 1000;
    }
    return all.map(r => r.data).filter(d => d && d.date && d.mid);
  }

  window.cloud = { enabled, sync, touch, logout, statusText, retry, init, fetchChk, toLogin: () => requireLogin(), get state() { return state; }, get booted() { return booted; }, get gymId() { return gymId(); }, get license() { return licenseInfo(); } };
  init();
})();
