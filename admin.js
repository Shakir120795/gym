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
  if (r.status === 401 || r.status === 403) { logout(); throw new Error(j.error || 'Admin access nahi hai'); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

/* ---------- status ---------- */
function statusOf(g) {
  if (g.status === 'active') return { key: 'active', label: 'Active' };
  if (g.status !== 'trial' || !g.trialEnds) return { key: 'none', label: 'No license' };
  const left = Math.round((parseD(g.trialEnds) - parseD(todayStr())) / 864e5);
  if (left < 0) return { key: 'locked', label: 'Locked' };
  if (left === 0) return { key: 'trial', label: 'Trial · aaj last day' };
  return { key: 'trial', label: `Trial · ${left} din left` };
}

/* ---------- render ---------- */
function renderStats() {
  const n = { all: gyms.length, active: 0, trial: 0, locked: 0 };
  gyms.forEach(g => { const s = statusOf(g).key; if (s === 'active') n.active++; else if (s === 'trial') n.trial++; else if (s === 'locked') n.locked++; });
  $('#statStrip').innerHTML = [['Total gyms', n.all], ['Active (paid)', n.active], ['Trial par', n.trial], ['Locked', n.locked]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
}
function gymCard(g) {
  const s = statusOf(g);
  const last = g.lastActive ? new Date(g.lastActive).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'kabhi nahi';
  const users = g.users.length ? g.users.map(u => `
    <div class="userrow"><span>${esc(u.email)}</span>
      <span style="display:flex;gap:6px">
        <button class="btn small" data-aact="setPw" data-u="${u.id}" data-e="${esc(u.email)}">Reset password</button>
        <button class="btn small danger" data-aact="delUser" data-u="${u.id}" data-e="${esc(u.email)}">Access band karo</button>
      </span></div>`).join('')
    : '<p class="small" style="margin-top:8px">Is gym ka koi login nahi hai.</p>';
  return `<div class="card">
    <div class="gym-head"><div><b>${esc(g.name || g.gymId)}</b><br><span class="small">${esc(g.gymId)} · ${g.members} members · last active: ${last}</span></div>
      <span class="pill ${s.key}">${s.label}</span></div>
    ${g.status === 'trial' && g.trialEnds ? `<p class="small" style="margin:8px 0 0">Trial ends: ${fmtDate(g.trialEnds)}</p>` : ''}
    <div class="rowbtns">
      ${s.key !== 'active' ? `<button class="btn small primary" data-aact="activate" data-g="${esc(g.gymId)}">Activate (paid)</button>` : ''}
      <button class="btn small" data-aact="extend" data-g="${esc(g.gymId)}">+7 din trial</button>
      ${s.key !== 'locked' ? `<button class="btn small danger" data-aact="lock" data-g="${esc(g.gymId)}">Abhi lock karo</button>` : ''}
    </div>
    ${users}
  </div>`;
}
function render() {
  renderStats();
  $('#gymList').innerHTML = gyms.length ? gyms.map(gymCard).join('') : '<div class="empty">Abhi koi gym nahi hai. Pehla demo upar se banao.</div>';
}
async function loadGyms() {
  $('#gymList').innerHTML = '<div class="empty">Loading...</div>';
  const j = await call('list');
  gyms = j.gyms || [];
  render();
}

/* ---------- actions ---------- */
async function gymAction(act, gid) {
  const labels = { activate: 'Activate kar dun? Gym lifetime unlock ho jayega.', lock: 'Lock kar dun? Gym owner app nahi khol payega.', extend: 'Trial 7 din badha dun?' };
  if (!confirm(labels[act] || 'Pakka?')) return;
  try { await call(act, { gymId: gid }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-aact]');
  if (!b) return;
  const act = b.dataset.aact;
  if (act === 'refresh') { try { await loadGyms(); } catch (err) { alert(err.message); } }
  else if (act === 'logout') logout();
  else if (act === 'genPw') { $('#demoPw').value = 'Gym@' + Math.floor(100000 + Math.random() * 900000); }
  else if (act === 'activate' || act === 'extend' || act === 'lock') gymAction(act, b.dataset.g);
  else if (act === 'setPw') {
    const pw = prompt(`${b.dataset.e} ke liye naya password likho (kam se kam 6 character):`);
    if (!pw) return;
    try { await call('setPassword', { userId: b.dataset.u, password: pw }); alert('Password badal gaya. Owner ko naya password bata do.'); }
    catch (err) { alert(err.message); }
  } else if (act === 'delUser') {
    if (!confirm(`${b.dataset.e} ka access band kar dun? Ye login delete ho jayega, gym ka data safe rahega.`)) return;
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
  msg.textContent = 'Login ho raha hai...';
  try {
    await authReq('password', { email: f.get('email').trim(), password: f.get('password') });
    await loadGyms(); // admin hai ya nahi, yahin check ho jayega
    msg.textContent = '';
    $('#whoLine').textContent = 'Logged in: ' + session.email;
    $('#loginView').hidden = true;
    $('#panelView').hidden = false;
  } catch (err) { msg.textContent = err.message; }
});
$('#demoForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $('#demoMsg');
  msg.textContent = 'Demo gym ban raha hai...';
  try {
    const j = await call('createDemo', { gymName: f.get('gymName'), email: f.get('email'), password: f.get('password') });
    msg.textContent = '';
    const link = location.origin + '/';
    $('#demoResult').hidden = false;
    $('#demoResult').textContent =
`Gym Manager — tumhara 7-day FREE demo ready hai!

App: ${link}
Email: ${j.email}
Password: ${f.get('password')}
Demo valid till: ${fmtDate(j.trialEnds)}

Login karke apna gym setup kar lo. Pasand aaye to activate karne ke liye mujhe message karna.`;
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
  if (!C.url || !C.key) { $('#loginView').hidden = false; $('#msg').textContent = 'config.js me Supabase details nahi hain.'; return; }
  if (!session) { $('#loginView').hidden = false; return; }
  try {
    await loadGyms();
    $('#whoLine').textContent = 'Logged in: ' + (session.email || '');
    $('#panelView').hidden = false;
  } catch (e) { $('#loginView').hidden = false; }
})();
