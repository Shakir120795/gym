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
const PLAN_BTNS = [['monthly', 'Monthly · 30 din', 30], ['quarterly', '3 Months', 90], ['half', '6 Months', 180], ['yearly', 'Yearly', 365], ['lifetime', 'Lifetime', null]];
const daysTo = s => Math.round((parseD(s) - parseD(todayStr())) / 864e5);
function statusOf(g) {
  if (g.status === 'active') {
    if (g.planEnds && daysTo(g.planEnds) < 0) return { key: 'locked', label: 'Locked · plan over' };
    return { key: 'active', label: 'Active' };
  }
  if (g.status !== 'trial' || !g.trialEnds) return { key: 'none', label: 'No license' };
  const left = daysTo(g.trialEnds);
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
function renderAlerts() {
  const box = $('#alertStrip');
  if (!box) return;
  const locked = [], soon = [];
  gyms.forEach(g => {
    const s = statusOf(g);
    if (s.key === 'locked') locked.push(g.name || g.gymId);
    else {
      const ends = g.status === 'trial' ? g.trialEnds : g.planEnds;
      if (ends && daysTo(ends) >= 0 && daysTo(ends) <= 3) soon.push(`${g.name || g.gymId} (${daysTo(ends) === 0 ? 'aaj last day' : daysTo(ends) + ' din'})`);
    }
  });
  let h = '';
  if (locked.length) h += `<div class="alertbox bad">⚠ In gyms ka access <b>BAND</b> hai (plan/trial khatam): <b>${locked.map(esc).join(', ')}</b> — payment lekar neeche plan button se dobara chalu karo.</div>`;
  if (soon.length) h += `<div class="alertbox warn">⏳ Ye gyms 3 din ke andar band hone wale hain: <b>${soon.map(esc).join(', ')}</b> — owner ko pehle hi WhatsApp par renew reminder bhej do.</div>`;
  box.innerHTML = h;
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
  const isLifetime = g.status === 'active' && !g.planEnds;
  const planLine = g.status === 'active'
    ? `<p class="small" style="margin:8px 0 0">Plan: <b style="color:var(--gold2)">${esc(g.plan || 'Lifetime')}</b>${g.planEnds ? ` · khatam: ${fmtDate(g.planEnds)} (${daysTo(g.planEnds)} din)` : ''}</p>`
    : (g.status === 'trial' && g.trialEnds ? `<p class="small" style="margin:8px 0 0">Plan: <b style="color:var(--gold2)">Trial</b> · khatam: ${fmtDate(g.trialEnds)}</p>` : '');
  const upgradeRow = isLifetime ? '' : `
    <p class="small" style="margin:12px 0 0">Payment aane par plan do / renew karo:</p>
    <div class="rowbtns" style="margin-top:6px">
      ${PLAN_BTNS.map(([k, l]) => `<button class="btn small${k === 'lifetime' ? '' : ' primary'}" data-aact="upgrade" data-plan="${k}" data-g="${esc(g.gymId)}">${l}</button>`).join('')}
    </div>`;
  return `<div class="card">
    <div class="gym-head"><div><b>${esc(g.name || g.gymId)}</b><br><span class="small">${esc(g.gymId)} · ${g.members} members · last active: ${last}</span></div>
      <span class="pill ${s.key}">${s.label}</span></div>
    ${planLine}
    ${upgradeRow}
    <div class="rowbtns">
      ${g.status === 'trial' ? `<button class="btn small" data-aact="extend" data-g="${esc(g.gymId)}">+7 din trial</button>` : ''}
      ${s.key !== 'locked' ? `<button class="btn small danger" data-aact="lock" data-g="${esc(g.gymId)}">Abhi lock karo</button>` : ''}
    </div>
    ${users}
    <div style="margin-top:12px;border-top:1px dashed var(--line);padding-top:10px">
      <p class="small" style="margin:0 0 6px">Is gym ke liye naya login banao — purana login band ho gaya ho to yahi se access wapas milta hai (data aur plan pehle jaisa rahega):</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input id="nu-e-${esc(g.gymId)}" type="email" placeholder="Email" style="flex:1;min-width:150px">
        <input id="nu-p-${esc(g.gymId)}" type="text" placeholder="Password (6+)" style="flex:1;min-width:110px">
        <button class="btn small primary" data-aact="addUser" data-g="${esc(g.gymId)}">Login banao</button>
      </div>
    </div>
  </div>`;
}
function render() {
  renderAlerts();
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
  const labels = { lock: 'Lock kar dun? Gym owner app nahi khol payega.', extend: 'Trial 7 din badha dun?' };
  if (!confirm(labels[act] || 'Pakka?')) return;
  try { await call(act, { gymId: gid }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
async function upgradeAction(gid, planKey) {
  const p = PLAN_BTNS.find(x => x[0] === planKey);
  const label = p ? p[0] === 'lifetime' ? 'Lifetime' : p[1].split(' ·')[0] : planKey;
  const days = p ? p[2] : null;
  if (!confirm(`${gid} ko ${label} plan dun? ${days ? days + ' din chalega (plan khatam hote hi app khud lock ho jayegi).' : 'Ye kabhi expire nahi hoga.'}`)) return;
  try { await call('upgrade', { gymId: gid, plan: planKey }); await loadGyms(); }
  catch (e) { alert(e.message); }
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-aact]');
  if (!b) return;
  const act = b.dataset.aact;
  if (act === 'refresh') { try { await loadGyms(); } catch (err) { alert(err.message); } }
  else if (act === 'logout') logout();
  else if (act === 'genPw') { $('#demoPw').value = 'Gym@' + Math.floor(100000 + Math.random() * 900000); }
  else if (act === 'upgrade') upgradeAction(b.dataset.g, b.dataset.plan);
  else if (act === 'extend' || act === 'lock') gymAction(act, b.dataset.g);
  else if (act === 'addUser') {
    const gid = b.dataset.g;
    const email = (($('#nu-e-' + gid) || {}).value || '').trim();
    const pw = ($('#nu-p-' + gid) || {}).value || '';
    if (!email.includes('@')) { alert('Sahi email likho'); return; }
    if (pw.length < 6) { alert('Password kam se kam 6 character ka rakho'); return; }
    try {
      await call('addUser', { gymId: gid, email, password: pw });
      alert(`Login ban gaya!\nEmail: ${email}\nPassword: ${pw}\nYe owner ko bhej do — purana saara data waisa ka waisa milega.`);
      await loadGyms();
    } catch (err) { alert(err.message); }
  } else if (act === 'setPw') {
    const pw = prompt(`${b.dataset.e} ke liye naya password likho (kam se kam 6 character):`);
    if (!pw) return;
    try { await call('setPassword', { userId: b.dataset.u, password: pw }); alert('Password badal gaya. Owner ko naya password bata do.'); }
    catch (err) { alert(err.message); }
  } else if (act === 'delUser') {
    const gym = gyms.find(g => g.users.some(u => u.id === b.dataset.u));
    const lastOne = gym && gym.users.length === 1;
    const warn = lastOne ? '\n\nDHYAN DO: ye is gym ka AKHIRI login hai — band karne ke baad app me koi login nahi kar payega. Naya login card ke neeche wale form se banana padega (data safe rahega).' : '';
    if (!confirm(`${b.dataset.e} ka access band kar dun? Ye login delete ho jayega, gym ka data safe rahega.${warn}`)) return;
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
