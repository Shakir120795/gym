/* Gym Manager — Super Admin panel.
   Talks to the `admin` Edge Function, which is the only place the master
   (service_role) key lives. This page alone is useless without the admin
   account: the function checks app_metadata.role === 'admin' server-side
   on every call. */
'use strict';

const $ = s => document.querySelector(s);
const C = window.GYM_CLOUD || {};
const FN = (C.url || '').replace(/\/$/, '') + '/functions/v1/admin';
const KEY = 'gymadmin.auth';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

let session = null;
try { session = JSON.parse(localStorage.getItem(KEY)); } catch (e) { session = null; }
let gyms = [];

/* ---------- auth ---------- */
async function authReq(grant, body) {
  const r = await fetch(`${C.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: C.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || 'Login failed');
  session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || body.email || '' };
  localStorage.setItem(KEY, JSON.stringify(session));
}
async function ensureToken() {
  if (!session) throw new Error('auth');
  if (session.exp - Date.now() > 60000) return;
  await authReq('refresh_token', { refresh_token: session.refresh });
}
function logout() {
  session = null;
  try { localStorage.removeItem(KEY); } catch (e) {}
  $('#panelView').hidden = true;
  $('#loginView').hidden = false;
}

/* ---------- function calls ---------- */
async function call(action, payload) {
  await ensureToken();
  const r = await fetch(FN, {
    method: 'POST',
    headers: { apikey: C.key, Authorization: 'Bearer ' + session.access, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...(payload || {}) }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) { logout(); throw new Error(j.error || 'No admin access'); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

/* ---------- status ---------- */
const PLAN_BTNS = [['monthly', 'Monthly · 30 days', 30], ['quarterly', '3 Months', 90], ['half', '6 Months', 180], ['yearly', 'Yearly', 365], ['lifetime', 'Lifetime', null]];
const daysTo = s => Math.round((parseD(s) - parseD(todayStr())) / 864e5);
const displayName = g => g.name || g.gymId.replace(/^gym-/, '').split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || g.gymId;
function statusOf(g) {
  if (g.status === 'active') {
    if (g.planEnds && daysTo(g.planEnds) < 0) return { key: 'locked', label: 'Locked · plan over' };
    return { key: 'active', label: 'Active' };
  }
  if (g.status !== 'trial' || !g.trialEnds) return { key: 'none', label: 'No license' };
  const left = daysTo(g.trialEnds);
  if (left < 0) return { key: 'locked', label: 'Locked' };
  if (left === 0) return { key: 'trial', label: 'Trial · aaj last day' };
  return { key: 'trial', label: `Trial · ${left} day${left === 1 ? '' : 's'} left` };
}

/* ---------- render ---------- */
function renderStats() {
  const n = { all: gyms.length, active: 0, trial: 0, locked: 0 };
  gyms.forEach(g => { const s = statusOf(g).key; if (s === 'active') n.active++; else if (s === 'trial') n.trial++; else if (s === 'locked') n.locked++; });
  $('#statStrip').innerHTML = [['Total gyms', n.all], ['Active (paid)', n.active], ['Trial par', n.trial], ['Locked', n.locked]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
}
function renderAlerts() {
  const box = $('#alertStrip');
  if (!box) return;
  const locked = [], soon = [];
  gyms.forEach(g => {
    const s = statusOf(g);
    if (s.key === 'locked') locked.push(displayName(g));
    else {
      const ends = g.status === 'trial' ? g.trialEnds : g.planEnds;
      if (ends && daysTo(ends) >= 0 && daysTo(ends) <= 3) soon.push(`${displayName(g)} (${daysTo(ends) === 0 ? 'last day today' : daysTo(ends) + ' days'})`);
    }
  });
  let h = '';
  if (locked.length) h += `<div class="alertbox bad">⚠ These gyms' access is <b>OFF</b> (plan/trial ended): <b>${locked.map(esc).join(', ')}</b> — take the payment and restart them with a plan button below.</div>`;
  if (soon.length) h += `<div class="alertbox warn">⏳ These gyms will be locked within 3 days: <b>${soon.map(esc).join(', ')}</b> — send the owner a renewal reminder on WhatsApp in advance.</div>`;
  box.innerHTML = h;
}
function gymCard(g) {
  const s = statusOf(g);
  const last = g.lastActive ? new Date(g.lastActive).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never';
  const users = g.users.length ? g.users.map(u => `
    <div class="userrow"><span>${esc(u.email)}</span>
      <span style="display:flex;gap:6px">
        <button class="btn small" data-aact="setPw" data-u="${u.id}" data-e="${esc(u.email)}">Reset password</button>
        <button class="btn small danger" data-aact="delUser" data-u="${u.id}" data-e="${esc(u.email)}">Revoke access</button>
      </span></div>`).join('')
    : '<p class="small" style="margin-top:8px">This gym has no login.</p>';
  const isLifetime = g.status === 'active' && !g.planEnds;
  const planLine = g.status === 'active'
    ? `<p class="small" style="margin:8px 0 0">Plan: <b style="color:var(--gold2)">${esc(g.plan || 'Lifetime')}</b>${g.planEnds ? ` · ends: ${fmtDate(g.planEnds)} (${daysTo(g.planEnds)} days)` : ''}</p>`
    : (g.status === 'trial' && g.trialEnds ? `<p class="small" style="margin:8px 0 0">Plan: <b style="color:var(--gold2)">Trial</b> · ends: ${fmtDate(g.trialEnds)}</p>` : '');
  const planBtns = (act, primary) => PLAN_BTNS.map(([k, l]) => `<button class="btn small${primary ? ' primary' : ''}" data-aact="${act}" data-plan="${k}" data-g="${esc(g.gymId)}">${l}</button>`).join('');
  const upgradeRow = isLifetime ? '' : `
    <p class="small" style="margin:12px 0 0">Give plan / renew (remaining duration carries forward):</p>
    <div class="rowbtns" style="margin-top:6px">${planBtns('upgrade', true)}</div>`;
  const changeRow = `
    <p class="small" style="margin:12px 0 0">Change plan (fresh plan from today — the remaining duration will be lost):</p>
    <div class="rowbtns" style="margin-top:6px">${planBtns('setPlan', false)}</div>`;
  const addUserForm = g.users.length ? '' : `
    <div id="nu-form-${esc(g.gymId)}" style="margin-top:12px;border-top:1px dashed var(--line);padding-top:10px">
      <p class="small" style="margin:0 0 6px">This gym has no login — create one; this is how the gym gets access (data and plan stay as they are):</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input id="nu-e-${esc(g.gymId)}" type="email" placeholder="Email" style="flex:1;min-width:150px">
        <input id="nu-p-${esc(g.gymId)}" type="text" placeholder="Password (6+)" style="flex:1;min-width:110px">
        <button class="btn small primary" data-aact="addUser" data-g="${esc(g.gymId)}">Create login</button>
      </div>
    </div>`;
  return `<div class="card">
    <div class="gym-head"><div><b>${esc(displayName(g))}</b><br><span class="small">${esc(g.gymId)} · ${g.members} members · last active: ${last}</span></div>
      <span class="pill ${s.key}">${s.label}</span></div>
    ${planLine}
    ${upgradeRow}
    ${changeRow}
    <div class="rowbtns">
      ${g.status === 'trial' ? `<button class="btn small" data-aact="extend" data-g="${esc(g.gymId)}">+7 days trial</button>` : ''}
      ${s.key !== 'locked' ? `<button class="btn small danger" data-aact="lock" data-g="${esc(g.gymId)}">Lock now</button>` : ''}
    </div>
    ${users}
    ${addUserForm}
  </div>`;
}
function render() {
  renderAlerts();
  renderStats();
  $('#gymList').innerHTML = gyms.length ? gyms.map(gymCard).join('') : '<div class="empty">No gyms yet. Create the first demo from the tab above.</div>';
}
async function loadGyms() {
  $('#gymList').innerHTML = '<div class="empty">Loading...</div>';
  const j = await call('list');
  gyms = j.gyms || [];
  render();
}

/* ---------- actions ---------- */
async function gymAction(act, gid) {
  const labels = { lock: 'Lock it? The gym owner will not be able to open the app.', extend: 'Extend the trial by 7 days?' };
  if (!confirm(labels[act] || 'Pakka?')) return;
  try { await call(act, { gymId: gid }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
async function upgradeAction(gid, planKey) {
  const p = PLAN_BTNS.find(x => x[0] === planKey);
  const label = p ? p[0] === 'lifetime' ? 'Lifetime' : p[1].split(' ·')[0] : planKey;
  const days = p ? p[2] : null;
  if (!confirm(`Give ${gid} the ${label} plan? ${days ? 'It will run ' + days + ' days (the app locks itself when the plan ends).' : 'It will never expire.'}`)) return;
  try { await call('upgrade', { gymId: gid, plan: planKey }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
async function setPlanAction(gid, planKey) {
  const p = PLAN_BTNS.find(x => x[0] === planKey);
  const label = p ? p[0] === 'lifetime' ? 'Lifetime' : p[1].split(' ·')[0] : planKey;
  const days = p ? p[2] : null;
  if (!confirm(`Change ${gid}'s plan? The new plan ${label} starts TODAY${days ? ' and runs ' + days + ' days' : ''} — the remaining duration of the old plan will be lost.`)) return;
  try { await call('setPlan', { gymId: gid, plan: planKey }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
function switchTab(which) {
  const gymsOn = which === 'gyms';
  $('#tabGyms').hidden = !gymsOn;
  $('#tabNew').hidden = gymsOn;
  $('#tabBtnGyms').className = 'btn' + (gymsOn ? ' primary' : '');
  $('#tabBtnNew').className = 'btn' + (gymsOn ? '' : ' primary');
}
document.addEventListener('click', async e => {
  const tb = e.target.closest('[data-atab]');
  if (tb) { switchTab(tb.dataset.atab); return; }
  const b = e.target.closest('[data-aact]');
  if (!b) return;
  const act = b.dataset.aact;
  if (act === 'refresh') { try { await loadGyms(); } catch (err) { alert(err.message); } }
  else if (act === 'logout') logout();
  else if (act === 'genPw') { $('#demoPw').value = 'Gym@' + Math.floor(100000 + Math.random() * 900000); }
  else if (act === 'upgrade') upgradeAction(b.dataset.g, b.dataset.plan);
  else if (act === 'setPlan') setPlanAction(b.dataset.g, b.dataset.plan);
  else if (act === 'extend' || act === 'lock') gymAction(act, b.dataset.g);
  else if (act === 'addUser') {
    const gid = b.dataset.g;
    const email = (($('#nu-e-' + gid) || {}).value || '').trim();
    const pw = ($('#nu-p-' + gid) || {}).value || '';
    if (!email.includes('@')) { alert('Sahi email likho'); return; }
    if (pw.length < 6) { alert('Password kam se kam 6 character ka rakho'); return; }
    try {
      await call('addUser', { gymId: gid, email, password: pw });
      alert(`Login created!\nEmail: ${email}\nPassword: ${pw}\nSend these to the owner — all their old data will be there as it is.`);
      await loadGyms();
    } catch (err) { alert(err.message); }
  } else if (act === 'setPw') {
    const pw = prompt(`Type a new password for ${b.dataset.e} (at least 6 characters):`);
    if (!pw) return;
    try { await call('setPassword', { userId: b.dataset.u, password: pw }); alert('Password changed. Tell the owner the new password.'); }
    catch (err) { alert(err.message); }
  } else if (act === 'delUser') {
    const gym = gyms.find(g => g.users.some(u => u.id === b.dataset.u));
    const lastOne = gym && gym.users.length === 1;
    const warn = lastOne ? '\n\nWARNING: this is the gym\'s LAST login — after revoking, nobody will be able to log in to the app. A new login can be created from the form below the card (data stays safe).' : '';
    if (!confirm(`Revoke access for ${b.dataset.e}? This login will be deleted; the gym data stays safe.${warn}`)) return;
    try { await call('deleteUser', { userId: b.dataset.u }); await loadGyms(); }
    catch (err) { alert(err.message); }
  } else if (act === 'copyDemo') {
    const t = $('#demoResult').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy login details', 1500); });
  }
});

/* ---------- forms ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $('#msg');
  msg.textContent = 'Signing in...';
  try {
    await authReq('password', { email: f.get('email').trim(), password: f.get('password') });
    await loadGyms(); // this also checks whether the caller is an admin
    msg.textContent = '';
    $('#whoLine').textContent = 'Logged in: ' + session.email;
    $('#loginView').hidden = true;
    $('#panelView').hidden = false;
  } catch (err) { msg.textContent = err.message; }
});
$('#demoForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $('#demoMsg');
  msg.textContent = 'Creating the gym...';
  try {
    const j = await call('createDemo', { gymName: f.get('gymName'), email: f.get('email'), password: f.get('password'), plan: f.get('plan') || 'trial' });
    msg.textContent = '';
    const link = location.origin + '/';
    $('#demoResult').hidden = false;
    const isTrial = !j.plan || j.plan === 'Trial';
    $('#demoResult').textContent = isTrial ?
`Gym Manager — your 7-day FREE demo is ready!

App: ${link}
Email: ${j.email}
Password: ${f.get('password')}
Demo valid till: ${fmtDate(j.trialEnds)}

Log in and set up your gym. If you like it, message me to activate.` :
`Gym Manager — your gym is ready!

App: ${link}
Email: ${j.email}
Password: ${f.get('password')}
Plan: ${j.plan}${j.planEnds ? ' · valid till: ' + fmtDate(j.planEnds) : ' · never expires'}

Log in and set up your gym. Message me if you face any problem.`;
    if (!$('#copyBtn')) {
      const btn = document.createElement('button');
      btn.className = 'btn small'; btn.id = 'copyBtn'; btn.dataset.aact = 'copyDemo'; btn.textContent = 'Copy login details';
      btn.style.marginTop = '10px';
      $('#demoResult').after(btn);
    }
    e.target.reset();
    await loadGyms();
  } catch (err) { msg.textContent = err.message; }
});

/* ---------- boot ---------- */
(async function boot() {
  if (!C.url || !C.key) { $('#loginView').hidden = false; $('#msg').textContent = 'Supabase details are missing in config.js.'; return; }
  if (!session) { $('#loginView').hidden = false; return; }
  try {
    await loadGyms();
    $('#whoLine').textContent = 'Logged in: ' + (session.email || '');
    $('#panelView').hidden = false;
  } catch (e) { $('#loginView').hidden = false; }
})();
