/* Gym Manager. Online-only: all data lives in the cloud database (Supabase).
   Nothing is stored on this device except the login session. The app does
   not work without internet. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);

/* ---------- data ---------- */
const DEFAULT_PLANS = [
  { id: 'p1', name: 'Monthly', months: 1, fee: 1000 },
  { id: 'p3', name: 'Quarterly', months: 3, fee: 2700 },
  { id: 'p6', name: 'Half-yearly', months: 6, fee: 5000 },
  { id: 'p12', name: 'Yearly', months: 12, fee: 9000 },
];
let db = normalize(load());
function load() {
  // Fresh empty database. The real data is loaded from the cloud on sign-in.
  return { gym: { name: 'My Gym', phone: '' }, plans: DEFAULT_PLANS, members: [], payments: [], attendance: {}, checkins: {}, seq: 1 };
}
function rtoken() { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10); }
function normalize(d) {
  d.gym = d.gym || { name: 'My Gym' }; d.checkins = d.checkins || {}; d.attendance = d.attendance || {}; d.plans = d.plans && d.plans.length ? d.plans : DEFAULT_PLANS;
  d.members.forEach(m => { if (!m.token) { m.token = rtoken(); normalize.fixed = true; } });
  return d;
}
function save() { if (window.cloud) cloud.touch(); } // writes go straight to the online database
/* called after another phone's changes arrive */
function refreshLive() {
  if (ui.tab === 'attendance' && ui.attMode === 'scan') { const c = $('#scanCount'); if (c) c.innerHTML = countsLine(); return; }
  if (!$('#sheet').hidden) return;
  const a = document.activeElement;
  if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && $('#view').contains(a)) return;
  render();
}

/* ---------- helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addMonths = (s, n) => { const d = parse(s), day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() !== day) d.setDate(0); return iso(d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fmtDate = s => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMonth = ym => parse(ym + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = a => a.reduce((s, p) => s + (+p.amount || 0), 0);
const uid = () => 'i' + (db.seq++) + Date.now().toString(36);
const getM = id => db.members.find(m => m.id === id);
const SESS = { M: 'Morning', E: 'Evening' };
const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const sessionOf = t => (+t.slice(0, 2) < (db.gym.eveningFrom || 12) ? 'M' : 'E');
function checkIn(m, date = today(), time = nowTime()) {
  const day = (db.checkins[date] = db.checkins[date] || {}), list = (day[m.id] = day[m.id] || []);
  const s = sessionOf(time), ex = list.find(x => x.s === s);
  if (ex) return { already: true, s, t: ex.t };
  list.push({ s, t: time }); list.sort((a, b) => a.t.localeCompare(b.t));
  const a = (db.attendance[date] = db.attendance[date] || []);
  if (!a.includes(m.id)) a.push(m.id);
  save(); return { already: false, s, t: time };
}
function dayCounts(date = today()) {
  const day = db.checkins[date] || {}, ids = new Set([...(db.attendance[date] || []), ...Object.keys(day)].filter(getM));
  let M = 0, E = 0;
  ids.forEach(id => (day[id] || []).forEach(x => x.s === 'M' ? M++ : E++));
  return { members: ids.size, M, E };
}
const countsLine = (c = dayCounts()) => `<b>${c.members}</b> members came today, morning ${c.M}, evening ${c.E}`;
const daysInMonth = ym => new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();

const I = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  members: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.7a3.4 3.4 0 0 1 0 6.6M18.2 14.2c2 .8 3.3 2.6 3.3 5.8"/>',
  fees: '<path d="M7 5h10M7 9.5h10M7 5c5.5 0 7 1.8 7 4.3S12.500 13.500 7 13.500l7 6.500"/>',
  attendance: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M8.500 13l2.500 2.500 4.500-5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  reports: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  download: '<path d="M12 3v12M6 10l6 6 6-6M4 21h16"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8.200-7 9.200C8.500 19.200 5 16 5 11V6z"/><path d="M9 11.500l2.200 2.200L15.500 9.500"/>',
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

const warnDays = () => +db.gym.warnDays || 10;
const initials = n => String(n).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function avatar(m, size = 40) {
  const k = status(m).key;
  return `<span class="av ${k}" style="--sz:${size}px">${m.photo ? `<img src="${m.photo}" alt="">` : `<span>${esc(initials(m.name))}</span>`}</span>`;
}
function status(m) {
  const left = daysBetween(today(), m.expiry);
  if (left < 0) return { key: 'expired', label: `Expired ${-left}d ago`, left };
  if (left < warnDays()) return { key: 'expiring', label: left === 0 ? 'Ends today' : `${left}d left`, left };
  return { key: 'active', label: `${left}d left`, left };
}
function pay(m, amount, mode, type, date) {
  db.payments.push({ id: uid(), memberId: m.id, name: m.name, date: date || today(), amount: +amount, mode, type });
}
function phone91(n) { const d = String(n).replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; }
/* Which gym this login belongs to. The cloud layer reads it from the signed-in
   user's APP metadata — only the admin can set it (panel/SQL), the login
   itself cannot change it. The database enforces it too
   (RLS), so one gym can never see another gym's data even if the app is fooled. */
function gymId() { return (window.cloud && cloud.gymId) || 'gym-main'; }
function qrPayload(m) { return `GYM:${gymId()}:${m.id}:${m.token}`; }
function waLink(m, kind) {
  const g = db.gym.name || 'our gym';
  const msg = kind === 'due'
    ? `Hi ${m.name}, your fees of ${inr(m.due)} are pending at ${g}. Please clear it when you visit. Thank you!`
    : kind === 'welcome'
    ? `Hi ${m.name}! Welcome to ${g}. Your ${m.planName} membership is valid till ${fmtDate(m.expiry)}. Please save this number. Show your QR entry card at the gate for entry.`
    : `Hi ${m.name}, your membership at ${g} ${m.expiry < today() ? 'ended' : 'ends'} on ${fmtDate(m.expiry)}. Please renew to keep your workouts going!`;
  return `https://wa.me/${phone91(m.mobile)}?text=${encodeURIComponent(msg)}`;
}
/* Plain <a target=_blank> links to wa.me silently fail on some phones, so the
   WhatsApp buttons go through this instead: user tap -> open chat, with a
   direct-navigation fallback if the popup is blocked. */
function openWA(url) {
  let w = null;
  try { w = window.open(url, '_blank', 'noopener'); } catch (e) {}
  if (!w) window.location.href = url;
}
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 2600);
}
const txt = n => '="' + n + '"'; // keeps long numbers as text in Excel
function csv(rows) {
  return '\ufeff' + rows.map(r => r.map(c => {
    c = String(c ?? '');
    return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
  }).join(',')).join('\r\n');
}
function download(name, content, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* ---------- state ---------- */
const ui = {
  tab: 'home', filter: 'all', q: '', feeTab: 'pending',
  attMode: 'scan', attDate: today(), attQ: '', attMonth: today().slice(0, 7),
  repMode: 'monthly', repDate: today(), repMonth: today().slice(0, 7),
  setTab: 'profile',
};
const TABS = [['home', 'Home', 'home'], ['members', 'Members', 'members'], ['fees', 'Fees', 'fees'],
  ['attendance', 'Attendance', 'attendance'], ['reports', 'Reports', 'reports']];

function render() {
  if (!(scan.stream && ui.tab === 'attendance' && ui.attMode === 'scan')) stopCam();
  $('#gymName').textContent = db.gym.name || 'Gym Manager';
  document.title = (db.gym.name || 'Gym') + ' | Gym Manager';
  $('#settingsBtn').innerHTML = ic('menu', 26);
  $('#tabs').innerHTML = TABS.map(([k, l, i]) =>
    `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('');
  const views = { home: viewHome, members: viewMembers, fees: viewFees, attendance: viewAttendance, reports: viewReports };
  const v = $('#view');
  v.innerHTML = views[ui.tab]();
  v.classList.remove('vin'); void v.offsetWidth; v.classList.add('vin');
  animCount();
  resumeCam();
}
function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }

/* ---------- home ---------- */
function animCount() {
  let els = [];
  try { els = [...document.querySelectorAll('#view [data-count]')]; } catch (e) { return; }
  if (!els.length) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach(el => {
    const target = +el.dataset.count || 0, fmt = el.dataset.fmt;
    const show = v => { el.textContent = fmt === 'inr' ? inr(v) : v.toLocaleString('en-IN'); };
    if (reduce) { show(target); return; }
    const t0 = performance.now(), dur = 800;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      show(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function trialBanner() {
  const L = window.cloud && window.cloud.license;
  if (!L) return '';
  if (L.status === 'trial') {
    const txt = L.daysLeft > 0 ? `Demo version — ${L.daysLeft} day${L.daysLeft === 1 ? '' : 's'} left` : 'Demo version — last day today';
    return `<div class="tag expiring" style="display:block;text-align:center;padding:9px 12px;margin-bottom:10px;font-size:13px">${txt}. Activate karne ke liye app provider se contact karo.</div>`;
  }
  if (L.status === 'active' && L.ends && L.daysLeft != null && L.daysLeft <= 30) {
    const txt = L.daysLeft > 0 ? `${L.plan || 'Plan'} — ${L.daysLeft} din bache hain` : `${L.plan || 'Plan'} — aaj last day hai`;
    return `<div class="tag expiring" style="display:block;text-align:center;padding:9px 12px;margin-bottom:10px;font-size:13px">${txt}. Renew karne ke liye app provider se contact karo.</div>`;
  }
  return '';
}
function viewHome() {
  const t = today(), ym = t.slice(0, 7), ms = db.members;
  const active = ms.filter(m => m.expiry >= t).length;
  const todayCol = sum(db.payments.filter(p => p.date === t));
  const monthCol = sum(db.payments.filter(p => p.date.startsWith(ym)));
  const pend = ms.filter(m => m.due > 0), pendAmt = sum(pend.map(m => ({ amount: m.due })));
  const dc = dayCounts(t), came = dc.members;
  const soon = ms.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l < warnDays(); }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const stat = (act, extra, cls, icon, val, fmt, label) =>
    `<button class="stat" data-act="${act}" ${extra}><span class="sic ${cls}">${ic(icon, 22)}</span><span><b data-count="${val}"${fmt ? ` data-fmt="${fmt}"` : ''}>${fmt === 'inr' ? inr(val) : val}</b><small>${label}</small></span></button>`;
  return `
  ${trialBanner()}
  <section class="hero">
    <div class="hero-top"><span>${greeting()}</span><span class="hero-pill">${came} came today</span></div>
    <span class="lbl">Today's collection</span>
    <div class="big" data-count="${todayCol}" data-fmt="inr">${inr(todayCol)}</div>
    <div class="hero-sub"><span>Morning ${dc.M}</span><i></i><span>Evening ${dc.E}</span><i></i><span>${fmtDate(t)}</span></div>
  </section>
  <div class="stats">
    ${stat('tab', 'data-k="members"', 's-b', 'members', ms.length, '', 'Total members')}
    ${stat('goFilter', 'data-f="active"', 's-g', 'check', active, '', 'Active members')}
    ${stat('tab', 'data-k="reports"', 's-g', 'reports', monthCol, 'inr', "This month's earning")}
    ${stat('goFees', '', 's-r', 'fees', pendAmt, 'inr', `Pending fees \u00b7 ${pend.length}`)}
  </div>
  <div class="quick">
    <button class="btn primary" data-act="add">${ic('plus', 20)} Add member</button>
    <button class="btn" data-act="tab" data-k="attendance">${ic('check', 20)} Scan entry</button>
  </div>
  <h2>Membership ending soon</h2>
  ${soon.length ? `<div class="list">${soon.slice(0, 6).map(memberRow).join('')}</div>${soon.length > 6 ? `<p class="mini">${soon.length - 6} more in Fees \u2192 Reminders</p>` : ''}`
      : `<div class="list"><div class="empty">${ms.length ? 'No memberships ending soon.' : 'Add your first member to get started.'}</div></div>`}
  `;
}

/* ---------- members ---------- */
function memberRow(m) {
  const s = status(m);
  return `<button class="row" data-act="member" data-id="${m.id}">
    ${avatar(m, 40)}
    <span class="who"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></span>
    <span class="right">${m.pt ? `<span class="tag pt">PT · ${esc(m.pt)}</span>` : ''}<span class="tag ${s.key}">${s.label}</span>${m.due > 0 ? `<small class="due">Due ${inr(m.due)}</small>` : ''}</span>
  </button>`;
}
function memberMatches(m, f) {
  const k = status(m).key;
  return f === 'active' ? k !== 'expired' : f === 'expiring' ? k === 'expiring' : f === 'expired' ? k === 'expired' : f === 'pending' ? m.due > 0 : f === 'pt' ? !!m.pt : true;
}
function memberList() {
  const q = ui.q.trim().toLowerCase();
  const list = db.members.filter(m => memberMatches(m, ui.filter) && (!q || m.name.toLowerCase().includes(q) || m.mobile.includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return `<div class="empty">${db.members.length ? 'No members match this search.' : 'No members yet.<br><button class="btn primary" data-act="add">Add first member</button>'}</div>`;
  return list.map(memberRow).join('');
}
function viewMembers() {
  const F = [['all', 'All'], ['active', 'Active'], ['expiring', 'Ending soon'], ['expired', 'Expired'], ['pending', 'Fees due'], ['pt', 'PT members']];
  return `
  <input class="search" id="q" type="search" placeholder="Search by name or mobile" value="${esc(ui.q)}" autocomplete="off">
  <div class="chips">${F.map(([k, l]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l} ${db.members.filter(m => memberMatches(m, k)).length}</button>`).join('')}</div>
  <div class="list" id="mlist">${memberList()}</div>
  <button class="fab" data-act="add">${ic('plus', 22)} Add member</button>`;
}

/* ---------- fees ---------- */
function viewFees() {
  const t = today();
  const tabs = [['pending', 'Pending'], ['expiring', 'Expiring'], ['remind', 'Reminders'], ['history', 'Payment history']];
  let body = '';
  if (ui.feeTab === 'pending') {
    const p = db.members.filter(m => m.due > 0).sort((a, b) => b.due - a.due);
    body = `<p class="sum">Total pending <b>${inr(sum(p.map(m => ({ amount: m.due }))))}</b></p>` +
      (p.length ? `<div class="list">${p.map(m => `<div class="row">${avatar(m, 38)}
        <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></button>
        <span class="amt due">${inr(m.due)}</span><button class="ib txt" data-act="collect" data-id="${m.id}">Collect</button></div>`).join('')}</div>`
        : '<div class="list"><div class="empty">No pending fees. Everyone is paid up.</div></div>');
  } else if (ui.feeTab === 'expiring') {
    const soon = db.members.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l < warnDays(); }).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const gone = db.members.filter(m => m.expiry < t).sort((a, b) => b.expiry.localeCompare(a.expiry));
    const row = m => `<div class="row">${avatar(m, 38)}
      <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>Ends ${fmtDate(m.expiry)}</small></button>
      <button class="ib txt" data-act="renew" data-id="${m.id}">Renew</button></div>`;
    body = `<h2 style="margin-top:6px">Ending in less than ${warnDays()} days</h2><div class="list">${soon.length ? soon.map(row).join('') : '<div class="empty">Nobody is ending soon.</div>'}</div>
      <h2>Already expired</h2><div class="list">${gone.length ? gone.map(row).join('') : '<div class="empty">No expired members.</div>'}</div>`;
  } else if (ui.feeTab === 'remind') {
    body = viewReminders();
  } else {
    const ps = [...db.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
    body = `<p class="sum">${ps.length ? `Last ${ps.length} payments, total <b>${inr(sum(ps))}</b>` : ''}</p>` +
      (ps.length ? `<div class="list">${ps.map(p => `<div class="row"><span class="who"><b>${esc(p.name)}</b><small>${fmtDate(p.date)}, ${esc(p.mode)}, ${esc(p.type)}</small></span><span class="amt">${inr(p.amount)}</span></div>`).join('')}</div>`
        : '<div class="list"><div class="empty">No payments recorded yet.</div></div>');
  }
  return `<div class="seg">${tabs.map(([k, l]) => `<button class="${ui.feeTab === k ? 'on' : ''}" data-act="feeTab" data-k="${k}">${l}</button>`).join('')}</div>${body}`;
}

/* ---------- attendance ---------- */
const visitTags = (v = []) => v.map(x => `<span class="tag ${x.s === 'M' ? 'expiring' : 'active'}">${SESS[x.s]} ${x.t}</span>`).join(' ');
const manualOpen = () => Date.now() < (ui.manualUntil || 0) && ui.attDate === today();
function attDailyList() {
  const d = ui.attDate, day = db.checkins[d] || {}, c = dayCounts(d);
  const ids = new Set([...(db.attendance[d] || []), ...Object.keys(day)].filter(getM));
  const came = [...ids].map(getM).sort((a, b) => a.name.localeCompare(b.name));
  let html = `<p class="sum"><b>${c.members}</b> members came, morning ${c.M}, evening ${c.E}</p>` +
    (came.length ? `<div class="list">${came.map(m => `<div class="row in"><span class="check">${ic('check', 20)}</span>
      <span class="who"><b>${esc(m.name)}</b><span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">${visitTags(day[m.id]) || '<small>Marked earlier</small>'}</span></span></div>`).join('')}</div>`
      : '<div class="list"><div class="empty">Nobody has scanned in yet.</div></div>');
  if (ui.attDate === today()) {
    if (manualOpen()) {
      const rest = db.members.filter(m => m.expiry >= d).sort((a, b) => a.name.localeCompare(b.name));
      html += `<h2>Manual entry</h2><p class="mini" style="margin:-4px 0 8px">Unlocked for a few minutes. Tap a member to add this session's entry.</p>
        <div class="list">${rest.map(m => `<button class="row" data-act="att" data-id="${m.id}"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></span><span class="tag expiring">${SESS[sessionOf(nowTime())]}</span></button>`).join('') || '<div class="empty">No active members.</div>'}</div>`;
    } else html += `<button class="btn ghost wide" data-act="manual">Manual entry (owner PIN)</button>`;
  }
  return html;
}
function monthAtt(ym) {
  const n = daysInMonth(ym), dayTotals = Array(n).fill(0);
  const rows = db.members.map(m => {
    const marks = []; let c = 0;
    for (let i = 1; i <= n; i++) { const p = (db.attendance[ym + '-' + pad(i)] || []).includes(m.id); marks.push(p); if (p) { c++; dayTotals[i - 1]++; } }
    return { m, c, marks };
  }).filter(r => r.c > 0).sort((a, b) => b.c - a.c || a.m.name.localeCompare(b.m.name));
  return { n, rows, dayTotals, total: dayTotals.reduce((a, b) => a + b, 0) };
}
function attMonthly() {
  const r = monthAtt(ui.attMonth);
  const busiest = r.total ? r.dayTotals.indexOf(Math.max(...r.dayTotals)) + 1 : 0;
  return `<div class="bar"><input type="month" id="attMonth" value="${ui.attMonth}"><button class="btn ghost small" data-act="exportAtt">Export Excel</button></div>
  <p class="sum"><b>${r.total}</b> check-ins from ${r.rows.length} members${busiest ? `, busiest day ${busiest} ${fmtMonth(ui.attMonth).split(' ')[0]}` : ''}</p>
  ${r.rows.length ? `<div class="list">${r.rows.map(x => `<div class="row"><span class="who"><b>${esc(x.m.name)}</b>
    <span class="strip">${x.marks.map(p => `<i class="${p ? 'p' : ''}"></i>`).join('')}</span></span><span class="amt">${x.c} days</span></div>`).join('')}</div>`
    : '<div class="list"><div class="empty">No attendance marked in this month.</div></div>'}`;
}
function viewAttendance() {
  const M = [['scan', 'Scan entry'], ['today', 'Who came'], ['monthly', 'Monthly']];
  const seg = `<div class="seg">${M.map(([k, l]) => `<button class="${ui.attMode === k ? 'on' : ''}" data-act="attMode" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (ui.attMode === 'monthly') return seg + `<div id="attBody">${attMonthly()}</div>`;
  if (ui.attMode === 'today') return seg + `<div class="bar"><input type="date" id="attDate" value="${ui.attDate}" max="${today()}"><button class="btn ghost small" data-act="exportAttDay">Export Excel</button></div><div id="attBody">${attDailyList()}</div>`;
  return seg + `<div class="scanbox"><video id="cam" playsinline muted></video><canvas id="camc" hidden></canvas><div class="frame"></div><div id="scanMsg" class="scanmsg">Camera is off</div></div>
    <div id="scanRes"></div>
    <button class="btn primary wide" style="margin-top:0" data-act="camToggle" id="camBtn">Start camera</button>
    <button class="btn ghost wide" style="margin-top:8px" data-act="camFlip" id="camFlipBtn">${faceBtnTxt()}</button>
    <p class="sum" id="scanCount" style="margin-top:14px">${countsLine()}</p>
    <p class="mini">Keep this screen open on the gate phone. The camera starts by itself and keeps scanning one member after another. Each member can check in once in the morning and once in the evening.</p>
    ${window.GYM_PREVIEW ? `<hr><label class="mini">Test without camera
      <select id="simSel" style="width:100%;padding:10px;margin-top:4px">${db.members.map(m => `<option value="${m.id}">${esc(m.name)} (${status(m).key})</option>`).join('')}</select></label>
      <button class="btn ghost wide" data-act="simScan">Simulate scan</button>` : ''}`;
}

/* ---------- QR scanner ---------- */
const scan = { stream: null, timer: 0, last: '', lastAt: 0, hide: 0, face: 'environment' };
function faceBtnTxt() { return scan.face === 'user' ? '🔁 Back camera use karo' : '🔁 Front camera use karo'; }
function setCamFaceUI(v) {
  if (v) v.style.transform = scan.face === 'user' ? 'scaleX(-1)' : '';
  const fb = $('#camFlipBtn'); if (fb) fb.textContent = faceBtnTxt();
}
const playSafe = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
async function startCam() {
  if (scan.starting || scan.stream) return;
  if (typeof jsQR === 'undefined') { $('#scanMsg').textContent = 'Scanner library missing'; return; }
  scan.starting = true;
  try {
    try { scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: scan.face } }, audio: false }); }
    catch (e) { const m = $('#scanMsg'); if (m) m.textContent = 'Camera blocked. Allow camera for this site in browser settings.'; return; }
    const v = $('#cam');
    if (!v || ui.tab !== 'attendance' || ui.attMode !== 'scan') { stopCam(); return; }
    v.srcObject = scan.stream; playSafe(v); setCamFaceUI(v);
    $('#camBtn').textContent = 'Stop camera'; $('#scanMsg').textContent = 'Show your QR inside the box';
    keepAwake(); clearTimeout(scan.timer); tick();
  } finally { scan.starting = false; }
}
function keepAwake() {
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { scan.wake = w; }).catch(() => {}); } catch (e) {}
}
function stopCam() {
  clearTimeout(scan.timer); scan.timer = 0;
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
  if (scan.wake) { try { scan.wake.release(); } catch (e) {} scan.wake = null; }
}
/* Camera opens by itself on the scan screen and keeps running after every scan. */
function resumeCam() {
  if (ui.tab !== 'attendance' || ui.attMode !== 'scan') return;
  const v = $('#cam'); if (!v) return;
  if (scan.stream && scan.stream.getTracks().every(t => t.readyState === 'live')) {
    v.srcObject = scan.stream; playSafe(v); setCamFaceUI(v);
    $('#camBtn').textContent = 'Stop camera'; $('#scanMsg').textContent = 'Show your QR inside the box';
    keepAwake(); clearTimeout(scan.timer); tick();
  } else {
    stopCam();
    if (ui.camWanted !== false) startCam();
  }
}
function tick() {
  const v = $('#cam'), c = $('#camc'); if (!scan.stream || !v || !c) return;
  if (v.readyState >= 2 && v.videoWidth) {
    const w = 420, h = Math.round(v.videoHeight * w / v.videoWidth);
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, w, h);
    const r = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    if (r && r.data) onScan(r.data);
  }
  scan.timer = setTimeout(tick, 150);
}
function beep(ok) {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = ok ? 880 : 220; g.gain.value = .15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + (ok ? .12 : .35));
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(ok ? 80 : [180, 80, 180]);
}
function speak(text) {
  if ((db.gym.voice || 'en') === 'off' || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = db.gym.voice === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = .95;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const VOICE = {
  en: {
    welcome: n => `Welcome ${n}.`,
    ends: d => `Your membership ends ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'}. Please renew.`,
    expired: n => `${n}, your membership has expired.`, dup: n => `${n}, already checked in.`, bad: () => 'Invalid QR code.',
  },
  hi: {
    welcome: n => `स्वागत है ${n}.`,
    ends: d => `आपकी मेंबरशिप ${d === 0 ? 'आज' : d === 1 ? 'कल' : d + ' दिन में'} खत्म हो रही है। कृपया रिन्यू कराएं।`,
    expired: n => `${n}, आपकी मेंबरशिप खत्म हो चुकी है।`, dup: n => `${n}, आपकी एंट्री पहले ही हो चुकी है।`, bad: () => 'गलत क्यू आर कोड।',
  },
};
const VL = () => VOICE[db.gym.voice === 'hi' ? 'hi' : 'en'];
function showRes(cls, m, title, lines, btn) {
  const el = $('#scanRes'); if (!el) return;
  el.innerHTML = `<div class="scanres ${cls}"><div class="resrow">${m ? avatar(m, 88) : ''}<div class="restxt"><h3>${title}</h3>${lines.map(l => `<div>${l}</div>`).join('')}</div></div>
    ${m && m.due > 0 ? `<div class="dueline">Due ${inr(m.due)}</div>` : ''}
    ${btn ? `<button class="btn light small" style="margin-top:10px" data-act="renew" data-id="${m.id}">Renew now</button>` : ''}</div>`;
  const c = $('#scanCount'); if (c) c.innerHTML = countsLine();
  clearTimeout(scan.hide); scan.hide = setTimeout(() => { const e = $('#scanRes'); if (e) e.innerHTML = ''; }, 7000);
}
function onScan(data) {
  const now = Date.now();
  if (!$('#sheet').hidden) return;
  if (data === scan.last && now - scan.lastAt < 6000) { scan.lastAt = now; return; }
  scan.last = data; scan.lastAt = now;
  const p = String(data).split(':');
  let m = null, tok = '', wrongGym = false;
  if (p[0] === 'GYM' && p.length === 4) {
    if (p[1] !== gymId()) wrongGym = true; else { m = getM(p[2]); tok = p[3]; }
  } else if (p[0] === 'GYM' && p.length === 3) { m = getM(p[1]); tok = p[2]; } // cards issued before gym_id existed
  if (wrongGym || !m) { beep(false); speak(VL().bad()); return showRes('stop', null, 'QR not accepted', [wrongGym ? 'This QR card belongs to a different gym.' : 'This QR was made in a different app or on another phone, or the member was deleted.', 'Open the member here and use their QR entry card from this app.']); }
  if (m.token !== tok) { beep(false); speak(VL().bad()); return showRes('stop', m, esc(m.name), ['This is an old QR card.', 'Please use the latest QR card from the gym.']); }
  const s = status(m);
  if (s.key === 'expired') { beep(false); speak(VL().expired(m.name)); return showRes('stop', m, esc(m.name), [`Membership ended on ${fmtDate(m.expiry)}.`, 'Entry not allowed. Please renew first.'], true); }
  const r = checkIn(m);
  if (r.already) { beep(false); speak(VL().dup(m.name)); return showRes('dup', m, esc(m.name), [`Already checked in for ${SESS[r.s].toLowerCase()} at ${r.t}.`]); }
  beep(true);
  const lines = [`${SESS[r.s]} entry at ${r.t}`];
  if (s.key === 'expiring') lines.push(`Membership ends ${s.left === 0 ? 'today' : 'in ' + s.left + ' days'} (${fmtDate(m.expiry)}). Please renew.`);
  else lines.push(`Valid till ${fmtDate(m.expiry)}, ${s.left} days left`);
  speak(VL().welcome(m.name) + (s.key === 'expiring' ? ' ' + VL().ends(s.left) : ''));
  showRes(s.key === 'expiring' || m.due > 0 ? 'warn' : 'ok', m, esc(m.name), lines);
}

/* ---------- QR card ---------- */
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function drawCover(x, img, dx, dy, dw, dh) {
  const ir = img.naturalWidth / img.naturalHeight, r = dw / dh;
  let sw, sh, sx, sy;
  if (ir > r) { sh = img.naturalHeight; sw = sh * r; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else { sw = img.naturalWidth; sh = sw / r; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  x.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}
async function qrCardUrl(m) {
  const qr = qrcode(0, 'M'); qr.addData(qrPayload(m)); qr.make();
  const n = qr.getModuleCount(), cell = Math.floor(360 / (n + 8)), size = cell * (n + 8);
  const W = 640, H = 1000, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const F = "'Barlow Condensed','Arial Narrow',sans-serif", B = "'Barlow',Arial,sans-serif";
  x.textAlign = 'center';
  // rich black gradient background
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B0C0E'); bg.addColorStop(0.55, '#131519'); bg.addColorStop(1, '#08090B');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // gold gradient for frames and accents
  const gold = x.createLinearGradient(0, 0, W, 0);
  gold.addColorStop(0, '#A87E1F'); gold.addColorStop(0.5, '#F5D67B'); gold.addColorStop(1, '#A87E1F');
  // double frame
  x.strokeStyle = gold; x.lineWidth = 4; x.strokeRect(18, 18, W - 36, H - 36);
  x.lineWidth = 1; x.globalAlpha = 0.55; x.strokeRect(32, 32, W - 64, H - 64); x.globalAlpha = 1;
  // corner accents
  x.lineWidth = 6; x.strokeStyle = '#F5D67B';
  const L = 46, o = 18;
  [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1]].forEach(([cx, cy, dx, dy]) => {
    x.beginPath(); x.moveTo(cx + dx * L, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + dy * L); x.stroke();
  });
  // top label
  x.fillStyle = '#C9A44A'; x.font = `600 23px ${B}`;
  x.fillText('M E M B E R   E N T R Y   C A R D', W / 2, 96);
  // gym name in gold gradient (shrinks to fit long names)
  const gg = x.createLinearGradient(0, 108, 0, 172);
  gg.addColorStop(0, '#F8E19A'); gg.addColorStop(1, '#D9A93B');
  x.fillStyle = gg;
  let gfz = 66;
  do { x.font = `700 ${gfz}px ${F}`; gfz -= 2; } while (x.measureText((db.gym.name || 'Gym').slice(0, 24)).width > W - 140 && gfz > 28);
  x.fillText((db.gym.name || 'Gym').slice(0, 24), W / 2, 162);
  // divider with diamond
  const dy = 200;
  x.strokeStyle = gold; x.lineWidth = 2;
  x.beginPath(); x.moveTo(90, dy); x.lineTo(W / 2 - 26, dy); x.moveTo(W / 2 + 26, dy); x.lineTo(W - 90, dy); x.stroke();
  x.save(); x.translate(W / 2, dy); x.rotate(Math.PI / 4);
  x.fillStyle = '#E8B84B'; x.fillRect(-9, -9, 18, 18); x.restore();
  // QR in white rounded panel with gold border
  const ox = Math.round((W - size) / 2), oy = 232, pr = 22, px = ox - 16, py = oy - 16, ps = size + 32;
  x.beginPath();
  x.moveTo(px + pr, py); x.arcTo(px + ps, py, px + ps, py + ps, pr); x.arcTo(px + ps, py + ps, px, py + ps, pr);
  x.arcTo(px, py + ps, px, py, pr); x.arcTo(px, py, px + ps, py, pr); x.closePath();
  x.fillStyle = '#ffffff'; x.fill();
  x.strokeStyle = gold; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#101114';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(ox + (k + 4) * cell, oy + (r + 4) * cell, cell, cell);
  // member row: photo left, name + mobile right
  let photo = null;
  if (m.photo) { try { photo = await loadImg(m.photo); } catch (e) {} }
  const rowY = py + ps + 96, phr = 54, phx = 200, tx = phx + phr + 28;
  x.save();
  x.beginPath(); x.arc(phx, rowY, phr, 0, Math.PI * 2); x.clip();
  if (photo) drawCover(x, photo, phx - phr, rowY - phr, phr * 2, phr * 2);
  else { x.fillStyle = '#1B1E23'; x.fillRect(phx - phr, rowY - phr, phr * 2, phr * 2); }
  x.restore();
  x.strokeStyle = gold; x.lineWidth = 4;
  x.beginPath(); x.arc(phx, rowY, phr, 0, Math.PI * 2); x.stroke();
  if (!photo) {
    x.fillStyle = '#E8B84B'; x.font = `700 52px ${F}`; x.textAlign = 'center';
    x.fillText((m.name || '?').trim().charAt(0).toUpperCase(), phx, rowY + 19);
  }
  // name (shrinks to fit) + mobile, left-aligned next to photo
  x.textAlign = 'left';
  let nfz = 54;
  x.fillStyle = '#ffffff';
  do { x.font = `700 ${nfz}px ${F}`; nfz -= 2; } while (x.measureText(m.name.slice(0, 26)).width > 300 && nfz > 24);
  x.fillText(m.name.slice(0, 26), tx, rowY - 6);
  x.fillStyle = '#E8B84B'; x.font = `600 30px ${B}`;
  x.fillText(m.mobile, tx, rowY + 44);
  x.textAlign = 'center';
  // info strip
  const by = rowY + 100;
  x.strokeStyle = 'rgba(232,184,75,0.35)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(70, by); x.lineTo(W - 70, by); x.stroke();
  [['Plan', m.planName, 130], ['Joined', fmtDate(m.joinDate), W / 2], ['Valid till', fmtDate(m.expiry), W - 130]].forEach(([l, v, cx]) => {
    x.fillStyle = '#8E96A0'; x.font = `500 22px ${B}`; x.fillText(l, cx, by + 38);
    let fz = 36; x.fillStyle = '#F5D67B';
    do { x.font = `700 ${fz}px ${F}`; fz -= 2; } while (x.measureText(String(v)).width > 180 && fz > 14);
    x.fillText(String(v), cx, by + 76);
  });
  // footer
  x.fillStyle = '#8E96A0'; x.font = `500 22px ${B}`;
  x.fillText('Scan this at the gym entrance', W / 2, H - 78);
  x.fillStyle = '#C9A44A'; x.font = `600 20px ${B}`;
  x.fillText((db.gym.name || '').slice(0, 30), W / 2, H - 48);
  return c.toDataURL('image/png');
}
async function qrFile(m) {
  const blob = await (await fetch(await qrCardUrl(m))).blob();
  return new File([blob], `${m.name.replace(/\W+/g, '-')}-gym-qr.png`, { type: 'image/png' });
}
async function qrSheet(id, note) {
  const m = getM(id); save();
  const url = await qrCardUrl(m);
  openSheet('QR entry card', `${note ? `<p style="margin:0 0 10px;font-weight:600">${esc(note)}</p>` : ''}<img class="qrimg" src="${url}" alt="QR card for ${esc(m.name)}">
    <div class="actions"><button class="btn primary" data-act="qrShare" data-id="${id}">Send on WhatsApp</button><button class="btn ghost" data-act="qrSave" data-id="${id}">Download image</button></div>
    <p class="mini">The QR stays the same after renewal. Only the dates on the card change, so send the updated card after a renewal. Entry always follows the dates saved in the app.</p>
    <button class="btn danger small" style="margin-top:12px" data-act="qrNew" data-id="${id}">Make a new QR (old one stops working)</button>`);
}

/* ---------- recent visits ---------- */
function recentVisits(id) {
  const days = Object.keys(db.checkins).filter(d => (db.checkins[d][id] || []).length).sort().reverse().slice(0, 7);
  if (!days.length) return '<div class="list"><div class="empty">No visits yet.</div></div>';
  return `<div class="list">${days.map(d => `<div class="row"><span class="who"><b>${fmtDate(d)}</b></span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${visitTags(db.checkins[d][id])}</span></div>`).join('')}</div>`;
}
/* ---------- member attendance detail ---------- */
function memberDays(id) {
  const days = new Set([...Object.keys(db.attendance).filter(d => db.attendance[d].includes(id)),
    ...Object.keys(db.checkins).filter(d => (db.checkins[d][id] || []).length)]);
  return [...days].sort().reverse();
}
function attDetail(id) {
  const days = memberDays(id);
  if (!days.length) return '<div class="list"><div class="empty">No attendance yet.</div></div>';
  const ym = today().slice(0, 7), lm = addMonths(ym + '-01', -1).slice(0, 7);
  let M = 0, E = 0;
  days.forEach(d => ((db.checkins[d] || {})[id] || []).forEach(x => x.s === 'M' ? M++ : E++));
  const thisM = days.filter(d => d.startsWith(ym)).length, lastM = days.filter(d => d.startsWith(lm)).length;
  const shown = days.slice(0, 30);
  return `<div class="stats" style="margin-top:0">
      <div class="stat"><b>${days.length}</b><small>Total visit days</small></div>
      <div class="stat"><b>${thisM}</b><small>This month (${lastM} last month)</small></div>
      <div class="stat"><b>${M}</b><small>Morning visits</small></div>
      <div class="stat"><b>${E}</b><small>Evening visits</small></div>
    </div>
    <p class="mini" style="margin:10px 0 8px">Last visit: <b>${fmtDate(days[0])}</b></p>
    <div class="list">${shown.map(d => { const v = (db.checkins[d] || {})[id] || []; return `<div class="row"><span class="who"><b>${fmtDate(d)}</b></span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${v.length ? visitTags(v) : '<span class="tag active">Present</span>'}</span></div>`; }).join('')}</div>
    ${days.length > 30 ? `<p class="mini" style="margin-top:8px">Showing the last 30 visit days of ${days.length}.</p>` : ''}`;
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed', true); }
  ta.remove();
}
function copyText(text) {
  const done = () => toast('List copied');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}

/* ---------- reminders ---------- */
function remRow(m, kind) {
  const s = status(m);
  return `<div class="row">${avatar(m, 40)}
    <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>${kind === 'due' ? 'Pending ' + inr(m.due) : (s.key === 'expired' ? 'Ended ' : 'Ends ') + fmtDate(m.expiry)}</small></button>
    <span class="acts"><a class="ib" href="tel:${esc(m.mobile)}" aria-label="Call ${esc(m.name)}">${ic('phone', 20)}</a>
    <button class="ib" data-act="wa" data-id="${m.id}" data-k="${kind}" aria-label="WhatsApp ${esc(m.name)}">${ic('chat', 20)}</button>
    <button class="ib txt" data-act="${kind === 'due' ? 'collect' : 'renew'}" data-id="${m.id}">${kind === 'due' ? 'Collect' : 'Renew'}</button></span></div>`;
}
function viewReminders() {
  const t = today(), ms = db.members;
  const soon = ms.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l < warnDays(); }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const gone = ms.filter(m => m.expiry < t).sort((a, b) => b.expiry.localeCompare(a.expiry));
  const due = ms.filter(m => m.due > 0).sort((a, b) => b.due - a.due);
  const sec = (title, arr, kind, none, copyK) => `<div class="sechd"><h2>${title} (${arr.length})</h2>${arr.length && copyK ? `<button class="btn ghost small" data-act="copyRem" data-k="${copyK}">Copy list</button>` : ''}</div><div class="list">${arr.length ? arr.map(m => remRow(m, kind)).join('') : `<div class="empty">${none}</div>`}</div>`;
  return `<p class="sum" style="margin-top:0">Tap the chat icon to send a ready WhatsApp message, or the phone icon to call.</p>` +
    sec(`Ending in less than ${warnDays()} days`, soon, 'exp', 'Nobody is ending soon.', 'soon') +
    sec('Fees pending', due, 'due', 'No pending fees.', 'due') +
    sec('Already expired', gone, 'exp', 'No expired members.');
}

/* ---------- reports ---------- */
function reportData() {
  const t = today(), daily = ui.repMode === 'daily', key = daily ? ui.repDate : ui.repMonth;
  const inP = s => daily ? s === key : s.startsWith(key);
  const pays = db.payments.filter(p => inP(p.date)).sort((a, b) => a.date.localeCompare(b.date));
  return {
    daily, key, pays,
    admissions: db.members.filter(m => inP(m.joinDate)).sort((a, b) => a.joinDate.localeCompare(b.joinDate)),
    expired: db.members.filter(m => inP(m.expiry) && m.expiry < t).sort((a, b) => a.expiry.localeCompare(b.expiry)),
    pending: db.members.filter(m => m.due > 0).sort((a, b) => b.due - a.due),
    label: daily ? fmtDate(key) : fmtMonth(key),
  };
}
function viewReports() {
  const r = reportData();
  const byMode = ['Cash', 'UPI', 'Card'].map(k => [k, sum(r.pays.filter(p => p.mode === k))]).filter(x => x[1] > 0);
  const perDay = {}; r.pays.forEach(p => perDay[p.date] = (perDay[p.date] || 0) + p.amount);
  const simple = (arr, fn) => arr.length ? `<div class="list">${arr.map(fn).join('')}</div>` : '<div class="list"><div class="empty">Nothing in this period.</div></div>';
  const cameN = r.daily ? dayCounts(r.key).members : monthAtt(r.key).rows.length;
  const cameSub = r.daily ? `M ${dayCounts(r.key).M}, E ${dayCounts(r.key).E}` : `${monthAtt(r.key).total} member-days`;
  const pendAmt = sum(r.pending.map(m => ({ amount: m.due })));
  const total = sum(r.pays);
  const rstat = (cls, icon, val, fmt, label) =>
    `<div class="stat"><span class="sic ${cls}">${ic(icon, 22)}</span><span><b data-count="${val}"${fmt ? ` data-fmt="${fmt}"` : ''}>${fmt === 'inr' ? inr(val) : val}</b><small>${label}</small></span></div>`;
  return `
  <div class="seg"><button class="${r.daily ? 'on' : ''}" data-act="repMode" data-k="daily">Daily</button><button class="${!r.daily ? 'on' : ''}" data-act="repMode" data-k="monthly">Monthly</button></div>
  <div class="bar">${r.daily ? `<input type="date" id="repDate" value="${ui.repDate}">` : `<input type="month" id="repMonth" value="${ui.repMonth}">`}
    <button class="btn primary small" data-act="exportRep">Export Excel</button></div>
  <section class="hero">
    <div class="hero-top"><span>${r.daily ? 'Daily' : 'Monthly'} report</span><span class="hero-pill">${r.label}</span></div>
    <span class="lbl">Collection</span>
    <div class="big" data-count="${total}" data-fmt="inr">${inr(total)}</div>
    ${byMode.length ? `<div class="hero-sub">${byMode.map(([k, v]) => `<span>${k} ${inr(v)}</span>`).join('<i></i>')}</div>` : ''}
  </section>
  <div class="stats">
    ${rstat('s-g', 'plus', r.admissions.length, '', 'New admissions')}
    ${rstat('s-r', 'members', r.expired.length, '', 'Expired members')}
    ${rstat('s-b', 'check', cameN, '', `Members came · ${cameSub}`)}
    ${rstat('s-r', 'fees', pendAmt, 'inr', `Pending now · ${r.pending.length}`)}
  </div>
  ${!r.daily && Object.keys(perDay).length ? `<h2>Day-wise collection</h2><div class="list repdays">${Object.keys(perDay).sort().map(d => `<div class="row"><span class="who"><b>${fmtDate(d)}</b></span><span class="amt">${inr(perDay[d])}</span></div>`).join('')}</div>` : ''}
  <h2>Payments received</h2>${simple(r.pays, p => `<div class="row"><span class="who"><b>${esc(p.name)}</b><small>${r.daily ? '' : fmtDate(p.date) + ', '}${esc(p.mode)}, ${esc(p.type)}</small></span><span class="amt">${inr(p.amount)}</span></div>`)}
  <h2>New admissions</h2>${simple(r.admissions, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.planName)}, joined ${fmtDate(m.joinDate)}</small></span></div>`)}
  <h2>Expired members</h2>${simple(r.expired, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>Ended ${fmtDate(m.expiry)}</small></span></div>`)}
  <h2>Pending payments</h2>${simple(r.pending, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></span><span class="amt due">${inr(m.due)}</span></div>`)}
  <hr><div class="actions"><button class="btn ghost" data-act="exportMembers">All members</button><button class="btn ghost" data-act="exportPending">Pending fees</button></div>`;
}
function exportReport() {
  const r = reportData(), rows = [];
  rows.push([`${db.gym.name} - ${r.daily ? 'Daily' : 'Monthly'} report`, r.label], []);
  rows.push(['Total collection', sum(r.pays)], ['Members came', r.daily ? dayCounts(r.key).members : monthAtt(r.key).rows.length], ['New admissions', r.admissions.length], ['Expired members', r.expired.length], ['Pending amount (now)', sum(r.pending.map(m => ({ amount: m.due })))], []);
  rows.push(['PAYMENTS RECEIVED'], ['Date', 'Member', 'Amount', 'Mode', 'Type']);
  r.pays.forEach(p => rows.push([p.date, p.name, p.amount, p.mode, p.type]));
  rows.push([], ['NEW ADMISSIONS'], ['Joining date', 'Member', 'Mobile', 'Plan', 'Fee']);
  r.admissions.forEach(m => rows.push([m.joinDate, m.name, txt(m.mobile), m.planName, m.fee]));
  rows.push([], ['EXPIRED MEMBERS'], ['Expiry date', 'Member', 'Mobile', 'Plan']);
  r.expired.forEach(m => rows.push([m.expiry, m.name, txt(m.mobile), m.planName]));
  rows.push([], ['PENDING PAYMENTS'], ['Member', 'Mobile', 'Due amount', 'Membership ends']);
  r.pending.forEach(m => rows.push([m.name, txt(m.mobile), m.due, m.expiry]));
  download(`gym-report-${r.key}.csv`, csv(rows));
}
function pendingRows() {
  const rows = [['Member', 'Mobile', 'Due amount', 'Plan', 'Membership ends']];
  db.members.filter(m => (m.due || 0) > 0).sort((a, b) => (b.due || 0) - (a.due || 0) || a.name.localeCompare(b.name))
    .forEach(m => rows.push([m.name, txt(m.mobile), m.due, m.planName, m.expiry]));
  rows.push([], ['Total due', sum(db.members.filter(m => (m.due || 0) > 0).map(m => ({ amount: m.due })))]);
  return rows;
}
function exportPending() { download(`gym-pending-fees-${today()}.csv`, csv(pendingRows())); }
function exportAttDay() {
  const d = ui.attDate, day = db.checkins[d] || {};
  const ids = [...new Set([...(db.attendance[d] || []), ...Object.keys(day)])].filter(getM).map(getM).sort((a, b) => a.name.localeCompare(b.name));
  const rows = [[`Attendance ${fmtDate(d)}`], ['Member', 'Mobile', 'Morning', 'Evening']];
  ids.forEach(m => {
    const v = day[m.id] || [], t = s => (v.find(x => x.s === s) || {}).t || '';
    rows.push([m.name, txt(m.mobile), t('M'), t('E')]);
  });
  rows.push([], ['Total members', ids.length]);
  download(`gym-attendance-${d}.csv`, csv(rows));
}
function membersRows() {
  const rows = [['Name', 'Mobile', 'Gender', 'Address', 'Joining date', 'Plan', 'Personal trainer', 'Plan fee', 'Membership ends', 'Status', 'Fees due']];
  db.members.forEach(m => rows.push([m.name, txt(m.mobile), m.gender || '', m.address || '', m.joinDate, m.planName, m.pt || '', m.fee, m.expiry, status(m).key, m.due || 0]));
  return rows;
}
function exportMembers() { download(`gym-members-${today()}.csv`, csv(membersRows())); }
/* Settings > Backup: restore — file padho, summary dikhao, confirm par lagao */
let pendingRestore = null;
function readBackupFile(f) {
  const done = txt => {
    let p; try { p = JSON.parse(txt); } catch (e) { return toast('Ye sahi backup file nahi hai', true); }
    const d = p && p.data ? p.data : p;
    if (!d || !Array.isArray(d.members) || !Array.isArray(d.payments)) return toast('Ye sahi backup file nahi hai', true);
    pendingRestore = d;
    openSheet('Restore backup?', `
      <p style="margin:0 0 6px">Backup file me hai:</p>
      <p class="mini" style="margin:0 0 10px">Gym: <b>${esc((d.gym && d.gym.name) || '-')}</b> · Members: <b>${d.members.length}</b> · Payments: <b>${d.payments.length}</b>${p.exportedAt ? `<br>Backup ki date: ${esc(String(p.exportedAt).slice(0, 10))}` : ''}</p>
      <p style="margin:0 0 6px">Abhi ke data me hai: <b>${db.members.length}</b> members · <b>${db.payments.length}</b> payments</p>
      <p class="mini" style="margin:0 0 6px;color:var(--red)">Restore karne par abhi wala data is backup se BADAL jayega. Ye kadam wapas nahi hoga.</p>
      <div class="actions"><button class="btn danger" data-act="doRestore">Haan, restore karo</button><button class="btn ghost" data-act="closeSheet">Cancel</button></div>`);
  };
  if (f.text) f.text().then(done).catch(() => toast('File padh nahi paya', true));
  else { const r = new FileReader(); r.onload = () => done(r.result); r.onerror = () => toast('File padh nahi paya', true); r.readAsText(f); }
}
function paymentsRows(from, to) {
  const ps = db.payments.filter(p => p.date >= from && p.date <= to).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rows = [['Date', 'Member', 'Amount', 'Mode', 'Type']];
  ps.forEach(p => rows.push([p.date, p.name, p.amount, p.mode, p.type]));
  rows.push([], ['Total', '', sum(ps)]);
  return { rows, count: ps.length };
}
function attendanceRangeRows(from, to) {
  const rows = [['Date', 'Member', 'Mobile', 'Morning', 'Evening']];
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = db.checkins[d] || {}, att = db.attendance[d] || [];
    const ids = [...new Set([...att, ...Object.keys(day)])].filter(getM)
      .sort((x, y) => getM(x).name.localeCompare(getM(y).name));
    ids.forEach(id => {
      const m = getM(id), v = day[id] || [];
      const t = s => (v.find(x => x.s === s) || {}).t || (att.includes(id) ? 'Present' : '');
      rows.push([d, m.name, txt(m.mobile), t('M'), t('E')]); n++;
    });
  }
  return { rows, count: n };
}
/* Settings > Export: type + period (month-wise ya date range) */
function doExport() {
  const type = ($('#expType') || {}).value || 'members';
  if (type === 'members') return exportMembers();
  if (type === 'feesdue') return exportPending();
  const mode = ($('#expMode') || {}).value || 'month';
  let from, to;
  if (mode === 'month') {
    const ym = ($('#expMonth') || {}).value || today().slice(0, 7);
    const [y, mo] = ym.split('-').map(Number);
    from = ym + '-01';
    to = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
  } else { from = ($('#expFrom') || {}).value; to = ($('#expTo') || {}).value; }
  if (!from || !to || from > to) return toast('Sahi date range chuno', true);
  const cap = type === 'payments' ? 3650 : 366; // attendance din-ba-din banta hai, isliye 1 saal ki hadd
  if (daysBetween(from, to) > cap) return toast('Ek baar me zyada se zyada ' + (cap === 366 ? '1 saal' : '10 saal') + ' ka data milega', true);
  if (type === 'payments') {
    const r = paymentsRows(from, to);
    if (!r.count) return toast('Is period me koi payment nahi hai', true);
    return download(`gym-payments-${from}-to-${to}.csv`, csv(r.rows));
  }
  if (type === 'attendance') {
    const r = attendanceRangeRows(from, to);
    if (!r.count) return toast('Is period me attendance nahi hai', true);
    return download(`gym-attendance-${from}-to-${to}.csv`, csv(r.rows));
  }
  const pr = paymentsRows(from, to), ar = attendanceRangeRows(from, to);
  const rows = [[db.gym.name || 'Gym', 'All data export', `${from} to ${to}`], [],
    ['=== MEMBERS ==='], ...membersRows(), [],
    ['=== FEES DUE ==='], ...pendingRows(), [],
    ['=== PAYMENTS ==='], ...pr.rows, [],
    ['=== ATTENDANCE ==='], ...ar.rows];
  download(`gym-all-data-${from}-to-${to}.csv`, csv(rows));
  toast('All data download ho gaya');
}
function exportAttendance() {
  const r = monthAtt(ui.attMonth), head = ['Member', 'Mobile'];
  for (let i = 1; i <= r.n; i++) head.push(i);
  head.push('Total days');
  const rows = [[`Attendance ${fmtMonth(ui.attMonth)}`], head];
  r.rows.forEach(x => rows.push([x.m.name, txt(x.m.mobile), ...x.marks.map(p => p ? 'P' : ''), x.c]));
  rows.push(['Total check-ins', '', ...r.dayTotals, r.total]);
  download(`gym-attendance-${ui.attMonth}.csv`, csv(rows));
}

/* ---------- sheets and forms ---------- */
function openSheet(title, body) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = body;
  $('#sheet').hidden = false; document.body.classList.add('lock');
  $('#sheetBody').scrollTop = 0;
}
function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('lock'); }
const modeSelect = () => `<label>Payment mode<select name="mode"><option>Cash</option><option>UPI</option><option>Card</option></select></label>`;
const planOptions = sel => db.plans.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)} (${inr(p.fee)})</option>`).join('');

function photoField(m) {
  return `<div class="photo"><span id="photoPrev">${m ? avatar(m, 72) : '<span class="av none" style="--sz:72px"><span>+</span></span>'}</span>
    <div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost small" data-act="pickCam">Camera</button><button type="button" class="btn ghost small" data-act="pickPhoto">Gallery</button></div><div class="mini" style="margin-top:4px">${m && m.photo ? 'Photo added' : 'Add member photo'}</div></div>
    <input type="file" id="photoFile" accept="image/*" hidden><input type="file" id="photoCam" accept="image/*" capture="environment" hidden><input type="hidden" name="photo" id="photoVal" value="${m ? m.photo || '' : ''}"></div>`;
}
function genderAddress(m, req) {
  const g = (m && m.gender) || '';
  return `<div class="two"><label>Gender<select name="gender" ${req ? 'required' : ''}><option value="" ${g ? '' : 'selected'} ${req ? 'disabled' : ''}>Select</option>${['Male', 'Female', 'Other'].map(x => `<option ${g === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Address<input name="address" value="${esc(m ? m.address : '')}" placeholder="Area / city"></label></div>`;
}
function ptField(m) {
  return `<label>Personal trainer (optional)<input name="pt" value="${esc(m ? m.pt || '' : '')}" placeholder="Trainer name — leave blank if no PT"></label>`;
}
async function photoFromFile(file) {
  const url = URL.createObjectURL(file), img = new Image();
  img.src = url; await img.decode();
  const S = 144, c = document.createElement('canvas'); c.width = c.height = S;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', .7);
}
function addForm() {
  const p = db.plans[0] || { fee: 0 };
  openSheet('Add member', `<form data-form="add" autocomplete="off">
    ${photoField()}<label>Name<input name="name" required></label>
    <label>Mobile number<input name="mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required placeholder="10 digit number"></label>
    ${genderAddress(null, true)}
    ${ptField(null)}
    <label>Joining date<input name="joinDate" type="date" required value="${today()}"></label>
    <label>Plan<select name="plan" id="planSel">${planOptions()}</select></label>
    <div class="two"><label>Plan fee<input name="fee" id="feeIn" type="number" min="0" required value="${p.fee}"></label>
    <label>Paid now<input name="paid" id="paidIn" type="number" min="0" required value="${p.fee}"></label></div>
    ${modeSelect()}
    <button class="btn primary wide">Add member</button></form>`);
}
function editForm(id) {
  const m = getM(id);
  openSheet('Edit member', `<form data-form="edit" data-id="${id}" autocomplete="off">
    ${photoField(m)}<label>Name<input name="name" required value="${esc(m.name)}"></label>
    <label>Mobile number<input name="mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required value="${esc(m.mobile)}"></label>
    ${genderAddress(m, false)}
    ${ptField(m)}
    <label>Joining date<input name="joinDate" type="date" required value="${m.joinDate}"></label>
    <label>Membership ends on<input name="expiry" type="date" required value="${m.expiry}"></label>
    <label>Fees due<input name="due" type="number" min="0" value="${m.due || 0}"></label>
    <button class="btn primary wide">Save changes</button></form>`);
}
function collectForm(id) {
  const m = getM(id);
  if (!(m.due > 0)) return toast('No pending fees for ' + m.name);
  openSheet('Collect fees', `<form data-form="collect" data-id="${id}">
    <div class="hdrline">${avatar(m, 44)}<div><b>${esc(m.name)}</b><br><span class="due">Pending ${inr(m.due)}</span></div></div>
    <label>Amount received<input name="amount" type="number" min="1" max="${m.due}" required value="${m.due}"></label>
    ${modeSelect()}
    <button class="btn primary wide">Save payment</button></form>`);
}
function renewEnd(m, planId) {
  const p = db.plans.find(x => x.id === planId) || db.plans[0];
  return addMonths(m.expiry >= today() ? m.expiry : today(), p.months);
}
function renewForm(id) {
  const m = getM(id), plan = db.plans.find(p => p.id === m.planId) || db.plans[0];
  openSheet('Renew membership', `<form data-form="renew" data-id="${id}">
    <div class="hdrline">${avatar(m, 44)}<div><b>${esc(m.name)}</b><br><small>Currently ends ${fmtDate(m.expiry)}</small></div></div>
    <label>Plan<select name="plan" id="planSel">${planOptions(plan.id)}</select></label>
    <p class="mini" style="margin:8px 0 0">New end date: <b id="newEnd">${fmtDate(renewEnd(m, plan.id))}</b></p>
    <div class="two"><label>Plan fee<input name="fee" id="feeIn" type="number" min="0" required value="${plan.fee}"></label>
    <label>Paid now<input name="paid" id="paidIn" type="number" min="0" required value="${plan.fee}"></label></div>
    ${modeSelect()}
    <button class="btn primary wide">Renew membership</button></form>`);
}
function memberSheet(id) {
  const m = getM(id), s = status(m), ym = today().slice(0, 7);
  const pays = db.payments.filter(p => p.memberId === id).sort((a, b) => b.date.localeCompare(a.date));
  const visits = memberDays(id).filter(d => d.startsWith(ym)).length;
  openSheet(m.name, `
    <div class="hdrline">${avatar(m, 88)}<div><b style="font:700 28px var(--head)">${esc(m.name)}</b><br><span class="tag ${s.key}">${s.label}</span></div></div>
    <dl class="kv"><dt>Mobile</dt><dd>${esc(m.mobile)}</dd><dt>Gender</dt><dd>${esc(m.gender || '-')}</dd><dt>Address</dt><dd>${esc(m.address || '-')}</dd><dt>Plan</dt><dd>${esc(m.planName)}</dd><dt>Personal trainer</dt><dd>${m.pt ? esc(m.pt) : '-'}</dd><dt>Joined</dt><dd>${fmtDate(m.joinDate)}</dd>
    <dt>Membership ends</dt><dd>${fmtDate(m.expiry)}</dd><dt>Fees due</dt><dd class="${m.due > 0 ? 'due' : ''}">${inr(m.due)}</dd><dt>Visits this month</dt><dd>${visits}</dd></dl>
    <div class="actions">
      <button class="btn primary" data-act="renew" data-id="${id}">Renew</button>
      <button class="btn" data-act="collect" data-id="${id}" ${m.due > 0 ? '' : 'disabled style="opacity:.4"'}>Collect fees</button>
      <a class="btn ghost" href="tel:${esc(m.mobile)}">${ic('phone', 18)} Call</a>
      <button class="btn ghost" data-act="wa" data-id="${id}" data-k="${m.due > 0 ? 'due' : 'exp'}">${ic('chat', 18)} WhatsApp</button>
      <button class="btn ghost" data-act="edit" data-id="${id}">Edit</button>
      <button class="btn danger" data-act="del" data-id="${id}">Delete</button>
      <button class="btn" style="grid-column:1/-1" data-act="qr" data-id="${id}">QR entry card</button></div>
    <h3 style="font-size:20px;margin:6px 0 8px">Attendance detail</h3>
    ${attDetail(id)}
    <h3 style="font-size:20px;margin:14px 0 8px">Payment history</h3>
    ${pays.length ? `<div class="list">${pays.map(p => `<div class="row"><span class="who"><b>${fmtDate(p.date)}</b><small>${esc(p.mode)}, ${esc(p.type)}</small></span><span class="amt">${inr(p.amount)}</span><button class="ib" data-act="delPay" data-id="${p.id}" aria-label="Delete this payment">&times;</button></div>`).join('')}</div>` : '<div class="list"><div class="empty">No payments yet.</div></div>'}`);
}
function planRow(p = {}) {
  return `<div class="planrow"><input type="hidden" name="pid" value="${esc(p.id || '')}">
    <label>Plan<input name="pn" required value="${esc(p.name || '')}" placeholder="Name"></label>
    <label>Months<input name="pm" type="number" min="1" required value="${p.months || ''}"></label>
    <label>Fee<input name="pf" type="number" min="0" required value="${p.fee ?? ''}"></label>
    <button type="button" class="ib" data-act="rmPlan" aria-label="Remove plan">&times;</button></div>`;
}
const SET_TABS = [['profile', 'Profile', 'gear'], ['plans', 'Plans', 'fees'], ['export', 'Export', 'reports'], ['backup', 'Backup', 'download'], ['privacy', 'Privacy', 'shield'], ['account', 'Account', 'members']];
function settingsSheet() {
  const st = ui.setTab || 'profile';
  const panel = (k, body) => `<div data-setpanel="${k}" ${st === k ? '' : 'hidden'}>${body}</div>`;
  const support = (window.GYM_CLOUD && window.GYM_CLOUD.support) || '';
  openSheet('Settings', `
    <div class="setwrap">
    <div class="setside">${SET_TABS.map(([k, l, icn]) => `<button type="button" class="${st === k ? 'on' : ''}" data-act="setTab" data-k="${k}">${ic(icn, 19)}<span>${l}</span></button>`).join('')}</div>
    <div class="setmain">
    <form data-form="settings" autocomplete="off">
    ${panel('profile', `
      <label>Gym name<input name="gym" required value="${esc(db.gym.name)}"></label>
      <label>Gym mobile number<input name="gphone" type="tel" inputmode="numeric" maxlength="15" value="${esc(db.gym.phone || '')}" placeholder="e.g. 9876543210"></label>
      <label>Gym address<input name="gaddr" value="${esc(db.gym.address || '')}" placeholder="e.g. Station Road, Agra"></label>
      <div class="two"><label>Owner PIN (4 digits)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${esc(db.gym.pin || '')}" placeholder="For manual entry"></label>
      <label>Evening starts at (hour)<input name="ef" type="number" min="1" max="23" value="${db.gym.eveningFrom || 12}"></label></div>
      <div class="two"><label>Gate voice<select name="voice">${[['en', 'English'], ['hi', 'Hindi'], ['off', 'Off']].map(([k, l]) => `<option value="${k}" ${(db.gym.voice || 'en') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Warn before expiry (days)<input name="warn" type="number" min="1" max="60" value="${warnDays()}"></label></div>
      <button class="btn primary wide">Save settings</button>`)}
    ${panel('plans', `
      <h3 style="font-size:20px;margin:4px 0 0">Membership plans</h3>
      <div id="plans">${db.plans.map(planRow).join('')}</div>
      <button type="button" class="btn ghost small" style="margin-top:10px" data-act="addPlan">Add plan</button>
      <button class="btn primary wide">Save settings</button>`)}
    </form>
    ${panel('export', `
      <h3 style="font-size:20px;margin:4px 0 8px">Export data (Excel)</h3>
      <p class="mini" style="margin:0 0 10px">Jo data chahiye wo chuno. File CSV me download hogi — Excel me seedha khul jayegi.</p>
      <label>Data type<select id="expType">
        <option value="members">Members (sab)</option>
        <option value="feesdue">Fees due (pending)</option>
        <option value="attendance">Attendance</option>
        <option value="payments">Payments / collection</option>
        <option value="all">All data (sab kuch ek file me)</option>
      </select></label>
      <label>Period<select id="expMode"><option value="month">Month-wise</option><option value="range">Date range (date se date tak)</option></select></label>
      <label id="expMonthWrap">Month<input type="month" id="expMonth" value="${today().slice(0, 7)}"></label>
      <div class="two" id="expRangeWrap" hidden><label>From date<input type="date" id="expFrom" value="${today().slice(0, 8)}01"></label><label>To date<input type="date" id="expTo" value="${today()}"></label></div>
      <p class="mini">Members aur Fees due hamesha aaj ke current hote hain — period sirf Attendance, Payments aur All data par lagta hai.</p>
      <button class="btn primary wide" data-act="doExport">Download</button>`)}
    ${panel('backup', `
      <h3 style="font-size:20px;margin:4px 0 8px">Data backup</h3>
      <p class="mini" style="margin:0 0 10px">Poora gym data ek hi file me — members, payments, attendance, plans aur settings sab. File ko apne paas safe rakho; kabhi data kharab ho jaye to isi file se wapas la sakte hain.</p>
      <p class="mini" style="margin:0 0 10px">Is samay: <b>${db.members.length}</b> members · <b>${db.payments.length}</b> payments</p>
      <button class="btn primary wide" data-act="dlBackup">Download full backup (All data)</button>
      <hr>
      <h3 style="font-size:20px;margin:0 0 8px">Restore backup</h3>
      <p class="mini" style="margin:0 0 10px">Purani backup file se data wapas lao. <b>Dhyan do:</b> restore karne par abhi wala data backup file wale data se badal jayega — pehle upar se current data ka backup le lena sahi rahega.</p>
      <input type="file" id="backupFile" accept=".json,application/json" hidden>
      <button class="btn ghost wide" data-act="pickBackup">Backup file chuno (Restore)</button>`)}
    ${panel('privacy', `
      <h3 style="font-size:20px;margin:4px 0 8px">Privacy</h3>
      <p class="mini" style="margin:0 0 8px"><b>Tumhara data, tumhara hai.</b> Gym ka data (members, payments, attendance) secure cloud me save hota hai, taaki phone badalne ya kharab hone par bhi data na khoye.</p>
      <p class="mini" style="margin:0 0 8px"><b>Kaun dekh sakta hai?</b> Sirf tumhare gym ke login se tumhare gym ka data khulta hai. Koi dusra gym tumhara data nahi dekh sakta. Password koi nahi dekh sakta — na app banane wala; wo sirf reset ho sakta hai.</p>
      <p class="mini" style="margin:0 0 8px"><b>Tumhare control me:</b> Tum kabhi bhi Settings se poora backup aur export le sakte ho. App band karna ho to bata do — tumhara data delete kar diya jayega.</p>
      <p class="mini" style="margin:0">Data becha nahi jata, kisi advertiser ko nahi diya jata.${support ? ` Sawal ho to WhatsApp karo: ${esc(support)}` : ''}</p>`)}
    ${panel('account', `
      <h3 style="font-size:20px;margin:4px 0 8px">Online database</h3>
      <p class="mini" style="margin:0 0 10px">${esc(window.cloud ? cloud.statusText() : '')}</p>
      ${window.cloud && cloud.enabled ? `<div class="actions"><button class="btn ghost" data-act="logout">Log out</button></div>` : ''}
      <hr><div class="actions">${window.cloud && cloud.enabled ? '' : '<button class="btn ghost" data-act="demo">Load demo data</button>'}<button class="btn danger" data-act="reset">Delete all data</button></div>`)}
    </div>
    </div>
  `);
}

/* ---------- form handlers ---------- */
const handlers = {
  add(f) {
    const mobile = f.get('mobile').trim();
    if (db.members.some(m => m.mobile === mobile)) return toast('This mobile number is already registered', true);
    const plan = db.plans.find(p => p.id === f.get('plan')); if (!plan) return toast('Add a plan in Settings first', true);
    const fee = +f.get('fee'), paid = Math.min(+f.get('paid'), fee), join = f.get('joinDate');
    const m = { id: uid(), name: f.get('name').trim(), mobile, joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due: fee - paid, token: rtoken(), gender: f.get('gender') || '', address: (f.get('address') || '').trim(), pt: (f.get('pt') || '').trim(), photo: f.get('photo') || '' };
    db.members.push(m);
    if (paid > 0) pay(m, paid, f.get('mode'), 'Admission', join);
    save(); render();
    openSheet(`${m.name} added`, `
      <div class="hdrline">${avatar(m, 44)}<div><b>${esc(m.name)}</b><br><small>${esc(m.planName)}, valid till ${fmtDate(m.expiry)}${m.due > 0 ? `, due ${inr(m.due)}` : ''}</small></div></div>
      <div class="actions">
        <button class="btn primary" data-act="wa" data-id="${m.id}" data-k="welcome">${ic('chat', 18)} Send welcome on WhatsApp</button>
        <button class="btn" data-act="qr" data-id="${m.id}">QR entry card</button>
      </div>
      <p class="mini">One tap opens the member's WhatsApp chat with the message already typed. Just press send.</p>`);
  },
  edit(f, id) {
    const m = getM(id), mobile = f.get('mobile').trim();
    if (db.members.some(x => x.id !== id && x.mobile === mobile)) return toast('This mobile number is already registered', true);
    const changed = m.expiry !== f.get('expiry') || m.mobile !== mobile || m.joinDate !== f.get('joinDate') || m.name !== f.get('name').trim();
    Object.assign(m, { name: f.get('name').trim(), mobile, joinDate: f.get('joinDate'), expiry: f.get('expiry'), due: +f.get('due') || 0, gender: f.get('gender') || '', address: (f.get('address') || '').trim(), pt: (f.get('pt') || '').trim(), photo: f.get('photo') || '' });
    save(); render();
    if (changed) qrSheet(id, 'Details updated. Send the updated card if the dates or number changed.'); else { closeSheet(); toast('Changes saved'); }
  },
  collect(f, id) {
    const m = getM(id), amt = Math.min(+f.get('amount'), m.due);
    m.due -= amt; pay(m, amt, f.get('mode'), 'Fees due');
    save(); closeSheet(); render(); toast(`${inr(amt)} received from ${m.name}`);
  },
  renew(f, id) {
    const m = getM(id), plan = db.plans.find(p => p.id === f.get('plan')), fee = +f.get('fee'), paid = Math.min(+f.get('paid'), fee);
    m.expiry = renewEnd(m, plan.id); m.planId = plan.id; m.planName = plan.name; m.fee = fee; m.due = (m.due || 0) + fee - paid;
    if (paid > 0) pay(m, paid, f.get('mode'), 'Renewal');
    save(); render(); qrSheet(id, `Renewed until ${fmtDate(m.expiry)}. Send the updated card so the member has the new dates.`);
  },
  pin(f) {
    if (f.get('pin') !== db.gym.pin) return toast('Wrong PIN', true);
    ui.manualUntil = Date.now() + 5 * 60e3; closeSheet(); render();
  },
  settings(f) {
    const ids = f.getAll('pid'), names = f.getAll('pn'), months = f.getAll('pm'), fees = f.getAll('pf');
    if (!names.length) return toast('Keep at least one plan', true);
    db.plans = names.map((n, i) => ({ id: ids[i] || 'p' + Date.now().toString(36) + i, name: n.trim(), months: +months[i], fee: +fees[i] }));
    db.gym.name = f.get('gym').trim(); db.gym.phone = (f.get('gphone') || '').trim(); db.gym.address = (f.get('gaddr') || '').trim(); db.gym.pin = f.get('pin').trim(); db.gym.eveningFrom = +f.get('ef') || 12; db.gym.voice = f.get('voice') || 'en'; db.gym.warnDays = +f.get('warn') || 10;
    save(); closeSheet(); render(); toast('Settings saved');
  },
};

function seedDemo() {
  const names = ['Aman Verma', 'Priya Singh', 'Rahul Yadav', 'Neha Gupta', 'Vikas Chauhan', 'Sonia Mishra', 'Karan Patel', 'Anjali Rawat', 'Deepak Kumar', 'Pooja Sahu', 'Sandeep Thakur', 'Rekha Joshi', 'Mohit Saini', 'Kavita Pandey'];
  const t = today(); db.members = []; db.payments = []; db.attendance = {}; db.checkins = {};
  names.forEach((n, i) => {
    const plan = db.plans[i % db.plans.length], join = addDays(t, -Math.floor(Math.random() * 120) - 2);
    const fee = plan.fee, due = i % 4 === 0 ? Math.round(fee * .4) : 0;
    const m = { id: uid(), gender: ['Priya', 'Neha', 'Sonia', 'Anjali', 'Pooja', 'Rekha', 'Kavita'].includes(n.split(' ')[0]) ? 'Female' : 'Male', address: ['Civil Lines', 'Station Road', 'Model Town', 'Sector 4'][i % 4], photo: '', name: n, mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due, token: rtoken() };
    if (i < 4) m.expiry = addDays(t, [1, 3, 6, -5][i]);
    db.members.push(m); pay(m, fee - due, ['Cash', 'UPI', 'Card'][i % 3], 'Admission', join);
  });
  for (let k = 0; k < 25; k++) {
    const d = addDays(t, -k); if (parse(d).getDay() === 0) continue;
    const ids = db.members.filter(m => m.expiry >= d && m.joinDate <= d && Math.random() > .45).map(m => m.id);
    if (ids.length) {
      db.attendance[d] = ids; db.checkins[d] = {};
      ids.forEach(id => {
        const v = [{ s: 'M', t: `${pad(6 + Math.floor(Math.random() * 3))}:${pad(Math.floor(Math.random() * 60))}` }];
        if (Math.random() > .65) v.push({ s: 'E', t: `${pad(17 + Math.floor(Math.random() * 3))}:${pad(Math.floor(Math.random() * 60))}` });
        db.checkins[d][id] = v;
      });
    }
  }
  save(); closeSheet(); render(); toast('Demo data loaded');
}

/* ---------- events ---------- */
const actions = {
  tab: el => go(el.dataset.k),
  goFilter: el => { ui.filter = el.dataset.f; go('members'); },
  goFees: () => { ui.feeTab = 'pending'; go('fees'); },
  filter: el => { ui.filter = el.dataset.f; render(); },
  feeTab: el => { ui.feeTab = el.dataset.k; render(); },
  attMode: el => { ui.attMode = el.dataset.k; render(); },
  repMode: el => { ui.repMode = el.dataset.k; render(); },
  member: el => memberSheet(el.dataset.id),
  add: addForm,
  edit: el => editForm(el.dataset.id),
  collect: el => collectForm(el.dataset.id),
  renew: el => renewForm(el.dataset.id),
  del: el => {
    const m = getM(el.dataset.id);
    if (confirm(`Delete ${m.name}? Their payments, attendance and visits will also be deleted. This cannot be undone.`)) {
      db.members = db.members.filter(x => x.id !== m.id);
      db.payments = db.payments.filter(x => x.memberId !== m.id);
      Object.keys(db.checkins).forEach(d => { delete db.checkins[d][m.id]; if (!Object.keys(db.checkins[d]).length) delete db.checkins[d]; });
      Object.keys(db.attendance).forEach(d => { db.attendance[d] = db.attendance[d].filter(id => id !== m.id); if (!db.attendance[d].length) delete db.attendance[d]; });
      save(); closeSheet(); render(); toast('Member and all their data deleted');
    }
  },
  camToggle: () => { if (scan.stream) { ui.camWanted = false; stopCam(); $('#camBtn').textContent = 'Start camera'; $('#scanMsg').textContent = 'Camera is off'; } else { ui.camWanted = true; startCam(); } },
  camFlip: () => {
    scan.face = scan.face === 'user' ? 'environment' : 'user';
    setCamFaceUI($('#cam'));
    if (scan.stream) { stopCam(); startCam(); }
    else { const m = $('#scanMsg'); if (m) m.textContent = scan.face === 'user' ? 'Front camera selected — Start dabane par front camera khulega' : 'Back camera selected — Start dabane par back camera khulega'; }
  },
  simScan: () => { const m = getM($('#simSel').value); if (m) { scan.last = ''; onScan(qrPayload(m)); } },
  manual: () => {
    if (!db.gym.pin) { toast('Set an owner PIN in Settings first', true); return settingsSheet(); }
    openSheet('Owner PIN', `<form data-form="pin"><label>Enter PIN<input name="pin" type="password" inputmode="numeric" maxlength="4" required autofocus></label><button class="btn primary wide">Unlock manual entry</button></form>`);
  },
  qr: el => qrSheet(el.dataset.id),
  pickPhoto: () => $('#photoFile').click(),
  pickCam: () => $('#photoCam').click(),
  qrSave: async el => { const f = await qrFile(getM(el.dataset.id)), a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); },
  qrShare: el => {
    // Works exactly like the other WhatsApp buttons: the member's chat opens
    // directly (synchronously inside the tap, so no popup block), and the QR
    // image downloads alongside so it can be attached in the chat.
    const m = getM(el.dataset.id);
    if (!/^\d{10}$/.test(m.mobile || '')) { toast('Is member ka mobile number sahi nahi hai', true); return; }
    openWA(waLink(m, 'welcome'));
    actions.qrSave(el);
    toast('QR downloaded. WhatsApp chat opened - attach the image and send.');
  },
  qrNew: el => { const m = getM(el.dataset.id); if (confirm(`Make a new QR for ${m.name}? The old QR will stop working.`)) { m.token = rtoken(); save(); qrSheet(m.id); toast('New QR created'); } },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#installBtn').hidden = true; },
  wa: el => {
    const m = getM(el.dataset.id); if (!m) return;
    if (!/^\d{10}$/.test(m.mobile || '')) return toast('Is member ka mobile number sahi nahi hai', true);
    openWA(waLink(m, el.dataset.k || 'exp'));
  },
  att: el => {
    const m = getM(el.dataset.id), r = checkIn(m);
    toast(r.already ? `${m.name} already has a ${SESS[r.s].toLowerCase()} entry` : `${m.name} marked, ${SESS[r.s].toLowerCase()} ${r.t}`, r.already);
    $('#attBody').innerHTML = attDailyList();
  },
  exportRep: exportReport, exportMembers, exportPending, exportAtt: exportAttendance, exportAttDay,
  settings: settingsSheet,
  setTab: b => {
    ui.setTab = b.dataset.k;
    document.querySelectorAll('#sheetBody [data-setpanel]').forEach(p => { p.hidden = p.dataset.setpanel !== ui.setTab; });
    document.querySelectorAll('#sheetBody [data-act="setTab"]').forEach(x => x.classList.toggle('on', x.dataset.k === ui.setTab));
  },
  doExport,
  pickBackup: () => { const i = $('#backupFile'); if (i) { i.value = ''; i.click(); } },
  doRestore: () => {
    if (!pendingRestore) return;
    const d = pendingRestore; pendingRestore = null;
    db = { gym: d.gym || db.gym, plans: (d.plans && d.plans.length) ? d.plans : db.plans, members: d.members || [], payments: d.payments || [], attendance: d.attendance || {}, checkins: d.checkins || {}, seq: d.seq || 1 };
    save(); closeSheet(); render();
    toast(`Backup restore ho gaya — ${db.members.length} members wapas aa gaye`);
  },
  logout: () => { if (confirm('Log out from this phone?')) { closeSheet(); cloud.logout(); } },
  dlBackup: () => {
    const payload = { app: 'gym-manager', gymId: (window.cloud && cloud.gymId) || 'gym-main', exportedAt: new Date().toISOString(), data: db };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `gym-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup downloaded — keep this file safe');
  },
  closeSheet,
  addPlan: () => $('#plans').insertAdjacentHTML('beforeend', planRow()),
  rmPlan: el => { if (document.querySelectorAll('.planrow').length > 1) el.closest('.planrow').remove(); else toast('Keep at least one plan', true); },
  delPay: el => {
    const p = db.payments.find(x => x.id === el.dataset.id); if (!p) return;
    if (!confirm(`Delete the ${inr(p.amount)} payment of ${p.name} (${fmtDate(p.date)})? The amount will be added back to their due. Dates are not changed.`)) return;
    db.payments = db.payments.filter(x => x.id !== p.id);
    const m = getM(p.memberId);
    if (m) m.due = (m.due || 0) + p.amount;
    save();
    if (m) memberSheet(m.id); else { closeSheet(); render(); }
    toast('Payment deleted');
  },
  copyRem: el => {
    const t = today(), k = el.dataset.k;
    let lines;
    if (k === 'due') lines = db.members.filter(m => m.due > 0).sort((a, b) => b.due - a.due)
      .map(m => `${m.name} - ${inr(m.due)} pending - ${m.mobile}`);
    else lines = db.members.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l < warnDays(); }).sort((a, b) => a.expiry.localeCompare(b.expiry))
      .map(m => `${m.name} - membership ends ${fmtDate(m.expiry)} - ${m.mobile}`);
    if (!lines.length) return;
    copyText((k === 'due' ? 'Fees pending' : 'Membership ending soon') + ` (${db.gym.name || 'Gym'})\n` + lines.join('\n'));
  },
  demo: () => { if (!db.members.length || confirm('This replaces your current data with sample data. Continue?')) seedDemo(); },
  reset: () => { if (confirm('Delete ALL members, payments and attendance' + (window.cloud && cloud.enabled ? ' on every phone' : '') + '? This cannot be undone.')) { db = { gym: db.gym, plans: db.plans, members: [], payments: [], attendance: {}, checkins: {}, seq: 1 }; save(); closeSheet(); render(); toast('All data deleted'); } },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault(); handlers[form.dataset.form](new FormData(form), form.dataset.id);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { ui.q = t.value; $('#mlist').innerHTML = memberList(); }
  else if (t.id === 'attQ') { ui.attQ = t.value; $('#attBody').innerHTML = attDailyList(); }
  else if (t.id === 'feeIn' && $('#paidIn')) $('#paidIn').value = t.value;
});
document.addEventListener('change', e => {
  const t = e.target, form = t.closest('form');
  if (t.id === 'planSel') {
    const p = db.plans.find(x => x.id === t.value);
    $('#feeIn').value = p.fee; $('#paidIn').value = p.fee;
    if ($('#newEnd')) $('#newEnd').textContent = fmtDate(renewEnd(getM(form.dataset.id), p.id));
  } else if ((t.id === 'photoFile' || t.id === 'photoCam') && t.files[0]) {
    photoFromFile(t.files[0]).then(url => {
      $('#photoVal').value = url;
      $('#photoPrev').innerHTML = `<span class="av active" style="--sz:72px;--c:var(--blue)"><img src="${url}" alt=""></span>`;
    }).catch(() => toast('Could not read this photo', true));
    t.value = '';
  } else if (t.id === 'attDate') { ui.attDate = t.value || today(); $('#attBody').innerHTML = attDailyList(); }
  else if (t.id === 'attMonth') { ui.attMonth = t.value || ui.attMonth; $('#attBody').innerHTML = attMonthly(); }
  else if (t.id === 'repDate') { ui.repDate = t.value || ui.repDate; render(); }
  else if (t.id === 'repMonth') { ui.repMonth = t.value || ui.repMonth; render(); }
  else if (t.id === 'expMode') { const m = t.value === 'month'; if ($('#expMonthWrap')) $('#expMonthWrap').hidden = !m; if ($('#expRangeWrap')) $('#expRangeWrap').hidden = m; }
  else if (t.id === 'backupFile' && t.files && t.files[0]) { readBackupFile(t.files[0]); t.value = ''; }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeCam(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- installable PWA (online-only: the service worker caches nothing) ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = $('#installBtn'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { deferredInstall = null; const b = $('#installBtn'); if (b) b.hidden = true; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* First render happens after the online database loads (cloud.js boot). */
