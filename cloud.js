/* Online-only database through Supabase (free plan). No gym data is stored on
   this device: the browser keeps only the login session. The app does not
   work without internet. Every phone signed in with the owner's account sees
   the same live data. The owner controls everything from Supabase:
   revoke access by deleting the user in Supabase > Authentication. */
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
    b.textContent = { loading: 'Loading', idle: 'Sync', syncing: 'Syncing', ok: 'Online', offline: 'Offline', error: 'Sync error', login: 'Sign in', setup: 'Setup' }[s] || '';
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
    session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || body.email || '' };
    wr(AUTH, session);
  }
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
      let p = `/rest/v1/records?select=kind,id,data,deleted,updated_at&order=updated_at.asc,kind.asc,id.asc&limit=1000&offset=${off}`;
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
    const rows = dirty.map(r => ({ kind: r.kind, id: r.id, data: r.data, deleted: false }))
      .concat(del.map(k => { const i = k.indexOf('|'); return { kind: k.slice(0, i), id: k.slice(i + 1), data: null, deleted: true }; }));
    for (let i = 0; i < rows.length; i += 200) {
      await api('POST', '/rest/v1/records?on_conflict=kind,id', rows.slice(i, i + 200), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    dirty.forEach(r => { meta.base[r.k] = r.h; });
    del.forEach(k => { delete meta.base[k]; });
  }

  /* ---------- the sync cycle ---------- */
  function goOffline(msg) {
    setState('offline');
    showBlock('No internet', msg || 'Ye app bina internet ke nahi chalti. Connection on karke Retry dabao.', true);
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
    try { await api('GET', '/rest/v1/records?select=id&limit=1'); return 'ok'; }
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
      const net = await checkNet();
      if (net === 'auth') { requireLogin(); return; }
      if (net === 'offline') { goOffline(); return; }
      if (net.startsWith('error')) { setState('error'); lastErr = net.slice(6); showBlock('Connection failed', 'Database se connect nahi ho paya: ' + lastErr, true); return; }
      try { await fullPull(); }
      catch (e) {
        if (e.message === 'auth') { requireLogin(); return; }
        goOffline(); return;
      }
      booted = true; setState('ok'); render();
    } finally { starting = false; }
  }
  function retry() { if (booted) sync(); else start(); }

  /* ---------- start ---------- */
  function init() {
    setState(state);
    if (!enabled) {
      setState('setup');
      showBlock('Setup required', 'Cloud database abhi connect nahi hai. Owner se config.js mein Supabase details dalwao. Bina iske app nahi chalegi.', false);
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
    window.addEventListener('online', () => { if (!session) return; if (!booted) start(); else sync(); });
    window.addEventListener('offline', () => { if (session) goOffline('Connection chali gayi hai. Wapas aane ka wait karo ya Retry dabao.'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && session && booted) sync(); });
    window.addEventListener('pagehide', () => { if (session && booted && !running) { clearTimeout(deb); sync(); } });
    setInterval(() => { if (!document.hidden && session && booted) sync(); }, POLL_MS);
    if (!session) showLogin(); else start();
  }

  window.cloud = { enabled, sync, touch, logout, statusText, retry, init, get state() { return state; }, get booted() { return booted; } };
  init();
})();
