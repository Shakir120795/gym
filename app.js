/* Gym Manager. All data is stored on this device (localStorage). */
'use strict';

const KEY = 'gymmanager.v1';
const $ = (s, r = document) => r.querySelector(s);

/* ---------- data ---------- */
const DEFAULT_PLANS = [
  { id: 'p1', name: 'Monthly', months: 1, fee: 1000 },
  { id: 'p3', name: 'Quarterly', months: 3, fee: 2700 },
  { id: 'p6', name: 'Half-yearly', months: 6, fee: 5000 },
  { id: 'p12', name: 'Yearly', months: 12, fee: 9000 },
];
let db = normalize(load());
if (normalize.fixed) { normalize.fixed = false; save(); } // keep newly made QR codes stable across reloads
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.members)) return d;
  } catch (e) {}
  return { gym: { name: 'My Gym', phone: '' }, plans: DEFAULT_PLANS, members: [], payments: [], attendance: {}, checkins: {}, seq: 1 };
}
function rtoken() { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10); }
function normalize(d) {
  d.gym = d.gym || { name: 'My Gym' }; d.checkins = d.checkins || {}; d.attendance = d.attendance || {}; d.plans = d.plans && d.plans.length ? d.plans : DEFAULT_PLANS;
  d.members.forEach(m => { if (!m.token) { m.token = rtoken(); normalize.fixed = true; } });
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Could not save. Phone storage may be full.', true); }
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
  list.push({ s, t: time });
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
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

function status(m) {
  const left = daysBetween(today(), m.expiry);
  if (left < 0) return { key: 'expired', label: `Expired ${-left}d ago`, left };
  if (left <= 7) return { key: 'expiring', label: left === 0 ? 'Ends today' : `${left}d left`, left };
  return { key: 'active', label: `${left}d left`, left };
}
function pay(m, amount, mode, type, date) {
  db.payments.push({ id: uid(), memberId: m.id, name: m.name, date: date || today(), amount: +amount, mode, type });
}
function phone91(n) { const d = String(n).replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; }
function waLink(m, kind) {
  const g = db.gym.name || 'our gym';
  const msg = kind === 'due'
    ? `Hi ${m.name}, your fees of ${inr(m.due)} are pending at ${g}. Please clear it when you visit. Thank you!`
    : `Hi ${m.name}, your membership at ${g} ${m.expiry < today() ? 'ended' : 'ends'} on ${fmtDate(m.expiry)}. Please renew to keep your workouts going!`;
  return `https://wa.me/${phone91(m.mobile)}?text=${encodeURIComponent(msg)}`;
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
};
const TABS = [['home', 'Home', 'home'], ['members', 'Members', 'members'], ['fees', 'Fees', 'fees'],
  ['attendance', 'Attendance', 'attendance'], ['reminders', 'Reminders', 'bell'], ['reports', 'Reports', 'reports']];

function render() {
  if (!(scan.stream && ui.tab === 'attendance' && ui.attMode === 'scan')) stopCam();
  $('#gymName').textContent = db.gym.name || 'Gym Manager';
  document.title = (db.gym.name || 'Gym') + ' | Gym Manager';
  $('#settingsBtn').innerHTML = ic('gear', 24);
  $('#tabs').innerHTML = TABS.map(([k, l, i]) =>
    `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('');
  const views = { home: viewHome, members: viewMembers, fees: viewFees, attendance: viewAttendance, reminders: viewReminders, reports: viewReports };
  $('#view').innerHTML = views[ui.tab]();
  resumeCam();
}
function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }

/* ---------- home ---------- */
function viewHome() {
  const t = today(), ym = t.slice(0, 7), ms = db.members;
  const active = ms.filter(m => m.expiry >= t).length;
  const todayCol = sum(db.payments.filter(p => p.date === t));
  const monthCol = sum(db.payments.filter(p => p.date.startsWith(ym)));
  const pend = ms.filter(m => m.due > 0);
  const dc = dayCounts(t), came = dc.members;
  const soon = ms.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l <= 7; }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  return `
  <section class="board">
    <div><span class="lbl">Today's collection</span><div class="big">${inr(todayCol)}</div></div>
    <div class="side"><div class="num">${came}</div><span class="lbl">came today</span><div class="mini" style="color:#B7BFC7;margin:2px 0 0">Morning ${dc.M}, evening ${dc.E}</div></div>
  </section>
  <div class="tiles">
    <button class="tile t-blue" data-act="tab" data-k="members"><span class="lbl">Total members</span><span class="num">${ms.length}</span></button>
    <button class="tile t-green" data-act="goFilter" data-f="active"><span class="lbl">Active members</span><span class="num">${active}</span></button>
    <button class="tile t-blue" data-act="tab" data-k="reports"><span class="lbl">This month's earning</span><span class="num">${inr(monthCol)}</span></button>
    <button class="tile t-red" data-act="goFees"><span class="lbl">Pending fees</span><span class="num">${inr(sum(pend.map(m => ({ amount: m.due }))))}</span><small>${pend.length} member${pend.length === 1 ? '' : 's'}</small></button>
  </div>
  <div class="quick">
    <button class="btn primary" data-act="add">${ic('plus', 20)} Add member</button>
    <button class="btn" data-act="tab" data-k="attendance">${ic('check', 20)} Scan entry</button>
  </div>
  <h2>Membership ending this week</h2>
  ${soon.length ? `<div class="list">${soon.slice(0, 6).map(memberRow).join('')}</div>${soon.length > 6 ? `<p class="mini">${soon.length - 6} more in Reminders</p>` : ''}`
      : `<div class="list"><div class="empty">${ms.length ? 'No memberships ending in the next 7 days.' : 'Add your first member to get started.'}</div></div>`}
  `;
}

/* ---------- members ---------- */
function memberRow(m) {
  const s = status(m);
  return `<button class="row" data-act="member" data-id="${m.id}">
    <span class="plate ${s.key}"></span>
    <span class="who"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></span>
    <span class="right"><span class="tag ${s.key}">${s.label}</span>${m.due > 0 ? `<small class="due">Due ${inr(m.due)}</small>` : ''}</span>
  </button>`;
}
function memberMatches(m, f) {
  const k = status(m).key;
  return f === 'active' ? k !== 'expired' : f === 'expiring' ? k === 'expiring' : f === 'expired' ? k === 'expired' : f === 'pending' ? m.due > 0 : true;
}
function memberList() {
  const q = ui.q.trim().toLowerCase();
  const list = db.members.filter(m => memberMatches(m, ui.filter) && (!q || m.name.toLowerCase().includes(q) || m.mobile.includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return `<div class="empty">${db.members.length ? 'No members match this search.' : 'No members yet.<br><button class="btn primary" data-act="add">Add first member</button>'}</div>`;
  return list.map(memberRow).join('');
}
function viewMembers() {
  const F = [['all', 'All'], ['active', 'Active'], ['expiring', 'Ending soon'], ['expired', 'Expired'], ['pending', 'Fees due']];
  return `
  <input class="search" id="q" type="search" placeholder="Search by name or mobile" value="${esc(ui.q)}" autocomplete="off">
  <div class="chips">${F.map(([k, l]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l} ${db.members.filter(m => memberMatches(m, k)).length}</button>`).join('')}</div>
  <div class="list" id="mlist">${memberList()}</div>
  <button class="fab" data-act="add">${ic('plus', 22)} Add member</button>`;
}

/* ---------- fees ---------- */
function viewFees() {
  const t = today();
  const tabs = [['pending', 'Pending'], ['expiring', 'Expiring'], ['history', 'Payment history']];
  let body = '';
  if (ui.feeTab === 'pending') {
    const p = db.members.filter(m => m.due > 0).sort((a, b) => b.due - a.due);
    body = `<p class="sum">Total pending <b>${inr(sum(p.map(m => ({ amount: m.due }))))}</b></p>` +
      (p.length ? `<div class="list">${p.map(m => `<div class="row"><span class="plate ${status(m).key}"></span>
        <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></button>
        <span class="amt due">${inr(m.due)}</span><button class="ib txt" data-act="collect" data-id="${m.id}">Collect</button></div>`).join('')}</div>`
        : '<div class="list"><div class="empty">No pending fees. Everyone is paid up.</div></div>');
  } else if (ui.feeTab === 'expiring') {
    const soon = db.members.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l <= 7; }).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const gone = db.members.filter(m => m.expiry < t).sort((a, b) => b.expiry.localeCompare(a.expiry));
    const row = m => `<div class="row"><span class="plate ${status(m).key}"></span>
      <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>Ends ${fmtDate(m.expiry)}</small></button>
      <button class="ib txt" data-act="renew" data-id="${m.id}">Renew</button></div>`;
    body = `<h2 style="margin-top:6px">Ending in 7 days</h2><div class="list">${soon.length ? soon.map(row).join('') : '<div class="empty">Nobody is ending this week.</div>'}</div>
      <h2>Already expired</h2><div class="list">${gone.length ? gone.map(row).join('') : '<div class="empty">No expired members.</div>'}</div>`;
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
  if (ui.attMode === 'today') return seg + `<div class="bar"><input type="date" id="attDate" value="${ui.attDate}" max="${today()}"></div><div id="attBody">${attDailyList()}</div>`;
  return seg + `<div class="scanbox"><video id="cam" playsinline muted></video><canvas id="camc" hidden></canvas><div class="frame"></div><div id="scanMsg" class="scanmsg">Camera is off</div></div>
    <div id="scanRes"></div>
    <button class="btn primary wide" style="margin-top:0" data-act="camToggle" id="camBtn">Start camera</button>
    <p class="sum" id="scanCount" style="margin-top:14px">${countsLine()}</p>
    <p class="mini">Keep this screen open on the gate phone. The camera starts by itself and keeps scanning one member after another. Each member can check in once in the morning and once in the evening.</p>
    ${window.GYM_PREVIEW ? `<hr><label class="mini">Test without camera
      <select id="simSel" style="width:100%;padding:10px;margin-top:4px">${db.members.map(m => `<option value="${m.id}">${esc(m.name)} (${status(m).key})</option>`).join('')}</select></label>
      <button class="btn ghost wide" data-act="simScan">Simulate scan</button>` : ''}`;
}

/* ---------- QR scanner ---------- */
const scan = { stream: null, timer: 0, last: '', lastAt: 0, hide: 0 };
const playSafe = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
async function startCam() {
  if (scan.starting || scan.stream) return;
  if (typeof jsQR === 'undefined') { $('#scanMsg').textContent = 'Scanner library missing'; return; }
  scan.starting = true;
  try {
    try { scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (e) { const m = $('#scanMsg'); if (m) m.textContent = 'Camera blocked. Allow camera for this site in browser settings.'; return; }
    const v = $('#cam');
    if (!v || ui.tab !== 'attendance' || ui.attMode !== 'scan') { stopCam(); return; }
    v.srcObject = scan.stream; playSafe(v);
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
    v.srcObject = scan.stream; playSafe(v);
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
function showRes(cls, title, lines, m, btn) {
  const el = $('#scanRes'); if (!el) return;
  el.innerHTML = `<div class="scanres ${cls}"><h3>${title}</h3>${lines.map(l => `<div>${l}</div>`).join('')}${btn ? `<button class="btn light small" style="margin-top:10px" data-act="renew" data-id="${m.id}">Renew now</button>` : ''}</div>`;
  const c = $('#scanCount'); if (c) c.innerHTML = countsLine();
  clearTimeout(scan.hide); scan.hide = setTimeout(() => { const e = $('#scanRes'); if (e) e.innerHTML = ''; }, 7000);
}
function onScan(data) {
  const now = Date.now();
  if (!$('#sheet').hidden) return;
  if (data === scan.last && now - scan.lastAt < 6000) { scan.lastAt = now; return; }
  scan.last = data; scan.lastAt = now;
  const p = String(data).split(':'), m = p[0] === 'GYM' && getM(p[1]);
  if (!m) { beep(false); return showRes('stop', 'Member not found', ['This QR was made in a different app or on another phone, or the member was deleted.', 'Open the member here and use their QR entry card from this app.']); }
  if (m.token !== p[2]) { beep(false); return showRes('stop', esc(m.name), ['This is an old QR card.', 'Please use the latest QR card from the gym.']); }
  const s = status(m);
  if (s.key === 'expired') { beep(false); return showRes('stop', esc(m.name), [`Membership ended on ${fmtDate(m.expiry)}.`, 'Entry not allowed. Please renew first.'], m, true); }
  const r = checkIn(m);
  if (r.already) { beep(false); return showRes('dup', esc(m.name), [`Already checked in for ${SESS[r.s].toLowerCase()} at ${r.t}.`]); }
  beep(true);
  const lines = [`${SESS[r.s]} entry at ${r.t}`];
  if (s.key === 'expiring') lines.push(`Membership ends ${s.left === 0 ? 'today' : 'in ' + s.left + ' days'}. Please renew.`); else lines.push(`Valid till ${fmtDate(m.expiry)}, ${s.left} days left`);
  if (m.due > 0) lines.push(`Fees pending ${inr(m.due)}`);
  showRes(s.key === 'expiring' || m.due > 0 ? 'warn' : 'ok', 'Welcome, ' + esc(m.name), lines);
}

/* ---------- QR card ---------- */
function qrCardUrl(m) {
  const qr = qrcode(0, 'M'); qr.addData(`GYM:${m.id}:${m.token}`); qr.make();
  const n = qr.getModuleCount(), cell = Math.floor(440 / (n + 8)), size = cell * (n + 8);
  const W = 600, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#1E2328'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#1D56B0'; x.fillRect(0, 118, W, 8);
  x.fillStyle = '#fff'; x.textAlign = 'center';
  x.font = "700 56px 'Barlow Condensed','Arial Narrow',sans-serif"; x.fillText((db.gym.name || 'Gym').slice(0, 24), W / 2, 84);
  const ox = Math.round((W - size) / 2), oy = 160;
  x.fillStyle = '#fff'; x.fillRect(ox - 10, oy - 10, size + 20, size + 20);
  x.fillStyle = '#1E2328';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(ox + (k + 4) * cell, oy + (r + 4) * cell, cell, cell);
  const F = "'Barlow Condensed','Arial Narrow',sans-serif", B = "'Barlow',Arial,sans-serif", by = oy + size + 80;
  x.fillStyle = '#fff'; x.font = `700 52px ${F}`; x.fillText(m.name.slice(0, 26), W / 2, by);
  x.fillStyle = '#B7BFC7'; x.font = `500 30px ${B}`; x.fillText(m.mobile, W / 2, by + 44);
  x.fillStyle = '#3A424A'; x.fillRect(40, by + 74, W - 80, 2);
  [['Plan', m.planName, 105], ['Joined', fmtDate(m.joinDate), 300], ['Valid till', fmtDate(m.expiry), 495]].forEach(([l, v, cx]) => {
    x.fillStyle = '#B7BFC7'; x.font = `500 22px ${B}`; x.fillText(l, cx, by + 112);
    let px = 32; x.fillStyle = '#fff';
    do { x.font = `700 ${px}px ${F}`; px -= 2; } while (x.measureText(String(v)).width > 170 && px > 14);
    x.fillText(String(v), cx, by + 150);
  });
  x.fillStyle = '#B7BFC7'; x.font = `22px ${B}`; x.fillText('Scan this at the gym entrance', W / 2, by + 205);
  return c.toDataURL('image/png');
}
async function qrFile(m) {
  const blob = await (await fetch(qrCardUrl(m))).blob();
  return new File([blob], `${m.name.replace(/\W+/g, '-')}-gym-qr.png`, { type: 'image/png' });
}
function qrSheet(id, note) {
  const m = getM(id); save();
  openSheet('QR entry card', `${note ? `<p style="margin:0 0 10px;font-weight:600">${esc(note)}</p>` : ''}<img class="qrimg" src="${qrCardUrl(m)}" alt="QR card for ${esc(m.name)}">
    <div class="actions"><button class="btn primary" data-act="qrShare" data-id="${id}">Send on WhatsApp</button><button class="btn ghost" data-act="qrSave" data-id="${id}">Download image</button></div>
    <p class="mini">The QR stays the same after renewal. Only the dates on the card change, so send the updated card after a renewal. Entry always follows the dates saved in the app.</p>
    <button class="btn danger small" style="margin-top:12px" data-act="qrNew" data-id="${id}">Make a new QR (old one stops working)</button>`);
}

/* ---------- reminders ---------- */
function remRow(m, kind) {
  const s = status(m);
  return `<div class="row"><span class="plate ${s.key}"></span>
    <button class="who" style="background:none;border:0;text-align:left;padding:0" data-act="member" data-id="${m.id}"><b>${esc(m.name)}</b><small>${kind === 'due' ? 'Pending ' + inr(m.due) : (s.key === 'expired' ? 'Ended ' : 'Ends ') + fmtDate(m.expiry)}</small></button>
    <span class="acts"><a class="ib" href="tel:${esc(m.mobile)}" aria-label="Call ${esc(m.name)}">${ic('phone', 20)}</a>
    <a class="ib" href="${waLink(m, kind)}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(m.name)}">${ic('chat', 20)}</a>
    <button class="ib txt" data-act="${kind === 'due' ? 'collect' : 'renew'}" data-id="${m.id}">${kind === 'due' ? 'Collect' : 'Renew'}</button></span></div>`;
}
function viewReminders() {
  const t = today(), ms = db.members;
  const soon = ms.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l <= 7; }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const gone = ms.filter(m => m.expiry < t).sort((a, b) => b.expiry.localeCompare(a.expiry));
  const due = ms.filter(m => m.due > 0).sort((a, b) => b.due - a.due);
  const sec = (title, arr, kind, none) => `<h2>${title} (${arr.length})</h2><div class="list">${arr.length ? arr.map(m => remRow(m, kind)).join('') : `<div class="empty">${none}</div>`}</div>`;
  return `<p class="sum" style="margin-top:0">Tap the chat icon to send a ready WhatsApp message, or the phone icon to call.</p>` +
    sec('Ending in 7 days', soon, 'exp', 'Nobody is ending this week.') +
    sec('Fees pending', due, 'due', 'No pending fees.') +
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
  return `
  <div class="seg"><button class="${r.daily ? 'on' : ''}" data-act="repMode" data-k="daily">Daily</button><button class="${!r.daily ? 'on' : ''}" data-act="repMode" data-k="monthly">Monthly</button></div>
  <div class="bar">${r.daily ? `<input type="date" id="repDate" value="${ui.repDate}">` : `<input type="month" id="repMonth" value="${ui.repMonth}">`}
    <button class="btn primary small" data-act="exportRep">Export Excel</button></div>
  <section class="board"><div><span class="lbl">Collection, ${r.label}</span><div class="big">${inr(sum(r.pays))}</div>
    ${byMode.length ? `<div class="mini" style="color:#B7BFC7">${byMode.map(([k, v]) => `${k} ${inr(v)}`).join('   ')}</div>` : ''}</div></section>
  <div class="tiles">
    <div class="tile t-green"><span class="lbl">New admissions</span><span class="num">${r.admissions.length}</span></div>
    <div class="tile t-yellow"><span class="lbl">Expired members</span><span class="num">${r.expired.length}</span></div>
    ${r.daily ? `<div class="tile t-blue"><span class="lbl">Members came</span><span class="num">${dayCounts(r.key).members}</span><small>Morning ${dayCounts(r.key).M}, evening ${dayCounts(r.key).E}</small></div>`
      : `<div class="tile t-blue"><span class="lbl">Members came</span><span class="num">${monthAtt(r.key).rows.length}</span><small>${monthAtt(r.key).total} member-days</small></div>`}
    <div class="tile t-red"><span class="lbl">Pending payments right now</span><span class="num">${inr(sum(r.pending.map(m => ({ amount: m.due }))))}</span><small>${r.pending.length} members</small></div>
  </div>
  ${!r.daily && Object.keys(perDay).length ? `<h2>Day-wise collection</h2><div class="list repdays">${Object.keys(perDay).sort().map(d => `<div class="row"><span class="who"><b>${fmtDate(d)}</b></span><span class="amt">${inr(perDay[d])}</span></div>`).join('')}</div>` : ''}
  <h2>Payments received</h2>${simple(r.pays, p => `<div class="row"><span class="who"><b>${esc(p.name)}</b><small>${r.daily ? '' : fmtDate(p.date) + ', '}${esc(p.mode)}, ${esc(p.type)}</small></span><span class="amt">${inr(p.amount)}</span></div>`)}
  <h2>New admissions</h2>${simple(r.admissions, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.planName)}, joined ${fmtDate(m.joinDate)}</small></span></div>`)}
  <h2>Expired members</h2>${simple(r.expired, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>Ended ${fmtDate(m.expiry)}</small></span></div>`)}
  <h2>Pending payments</h2>${simple(r.pending, m => `<div class="row"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.mobile)}</small></span><span class="amt due">${inr(m.due)}</span></div>`)}
  <hr><button class="btn ghost wide" data-act="exportMembers">Export all members to Excel</button>`;
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
function exportMembers() {
  const rows = [['Name', 'Mobile', 'Joining date', 'Plan', 'Plan fee', 'Membership ends', 'Status', 'Fees due']];
  db.members.forEach(m => rows.push([m.name, txt(m.mobile), m.joinDate, m.planName, m.fee, m.expiry, status(m).key, m.due || 0]));
  download(`gym-members-${today()}.csv`, csv(rows));
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

function addForm() {
  const p = db.plans[0] || { fee: 0 };
  openSheet('Add member', `<form data-form="add" autocomplete="off">
    <label>Name<input name="name" required></label>
    <label>Mobile number<input name="mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required placeholder="10 digit number"></label>
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
    <label>Name<input name="name" required value="${esc(m.name)}"></label>
    <label>Mobile number<input name="mobile" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required value="${esc(m.mobile)}"></label>
    <label>Joining date<input name="joinDate" type="date" required value="${m.joinDate}"></label>
    <label>Membership ends on<input name="expiry" type="date" required value="${m.expiry}"></label>
    <label>Fees due<input name="due" type="number" min="0" value="${m.due || 0}"></label>
    <button class="btn primary wide">Save changes</button></form>`);
}
function collectForm(id) {
  const m = getM(id);
  if (!(m.due > 0)) return toast('No pending fees for ' + m.name);
  openSheet('Collect fees', `<form data-form="collect" data-id="${id}">
    <div class="hdrline"><span class="plate ${status(m).key}"></span><div><b>${esc(m.name)}</b><br><span class="due">Pending ${inr(m.due)}</span></div></div>
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
    <div class="hdrline"><span class="plate ${status(m).key}"></span><div><b>${esc(m.name)}</b><br><small>Currently ends ${fmtDate(m.expiry)}</small></div></div>
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
  const visits = Object.keys(db.attendance).filter(d => d.startsWith(ym) && db.attendance[d].includes(id)).length;
  openSheet(m.name, `
    <div class="hdrline"><span class="plate ${s.key}"></span><span class="tag ${s.key}">${s.label}</span></div>
    <dl class="kv"><dt>Mobile</dt><dd>${esc(m.mobile)}</dd><dt>Plan</dt><dd>${esc(m.planName)}</dd><dt>Joined</dt><dd>${fmtDate(m.joinDate)}</dd>
    <dt>Membership ends</dt><dd>${fmtDate(m.expiry)}</dd><dt>Fees due</dt><dd class="${m.due > 0 ? 'due' : ''}">${inr(m.due)}</dd><dt>Visits this month</dt><dd>${visits}</dd></dl>
    <div class="actions">
      <button class="btn primary" data-act="renew" data-id="${id}">Renew</button>
      <button class="btn" data-act="collect" data-id="${id}" ${m.due > 0 ? '' : 'disabled style="opacity:.4"'}>Collect fees</button>
      <a class="btn ghost" href="tel:${esc(m.mobile)}">${ic('phone', 18)} Call</a>
      <a class="btn ghost" href="${waLink(m, m.due > 0 ? 'due' : 'exp')}" target="_blank" rel="noopener">${ic('chat', 18)} WhatsApp</a>
      <button class="btn ghost" data-act="edit" data-id="${id}">Edit</button>
      <button class="btn danger" data-act="del" data-id="${id}">Delete</button>
      <button class="btn" style="grid-column:1/-1" data-act="qr" data-id="${id}">QR entry card</button></div>
    <h3 style="font-size:20px;margin:6px 0 8px">Payment history</h3>
    ${pays.length ? `<div class="list">${pays.map(p => `<div class="row"><span class="who"><b>${fmtDate(p.date)}</b><small>${esc(p.mode)}, ${esc(p.type)}</small></span><span class="amt">${inr(p.amount)}</span></div>`).join('')}</div>` : '<div class="list"><div class="empty">No payments yet.</div></div>'}`);
}
function planRow(p = {}) {
  return `<div class="planrow"><input type="hidden" name="pid" value="${esc(p.id || '')}">
    <label>Plan<input name="pn" required value="${esc(p.name || '')}" placeholder="Name"></label>
    <label>Months<input name="pm" type="number" min="1" required value="${p.months || ''}"></label>
    <label>Fee<input name="pf" type="number" min="0" required value="${p.fee ?? ''}"></label>
    <button type="button" class="ib" data-act="rmPlan" aria-label="Remove plan">&times;</button></div>`;
}
function settingsSheet() {
  openSheet('Settings', `<form data-form="settings" autocomplete="off">
    <label>Gym name<input name="gym" required value="${esc(db.gym.name)}"></label>
    <div class="two"><label>Owner PIN (4 digits)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${esc(db.gym.pin || '')}" placeholder="For manual entry"></label>
    <label>Evening starts at (hour)<input name="ef" type="number" min="1" max="23" value="${db.gym.eveningFrom || 12}"></label></div>
    <h3 style="font-size:20px;margin:20px 0 0">Membership plans</h3>
    <div id="plans">${db.plans.map(planRow).join('')}</div>
    <button type="button" class="btn ghost small" style="margin-top:10px" data-act="addPlan">Add plan</button>
    <button class="btn primary wide">Save settings</button></form>
    <hr><h3 style="font-size:20px;margin:0 0 8px">Backup</h3>
    <p class="mini" style="margin:0 0 10px">Data lives on this phone or computer only. Download a backup regularly.</p>
    <div class="actions"><button class="btn ghost" data-act="backup">Download backup</button><button class="btn ghost" data-act="restore">Restore backup</button></div>
    <hr><div class="actions"><button class="btn ghost" data-act="demo">Load demo data</button><button class="btn danger" data-act="reset">Delete all data</button></div>`);
}

/* ---------- form handlers ---------- */
const handlers = {
  add(f) {
    const mobile = f.get('mobile').trim();
    if (db.members.some(m => m.mobile === mobile)) return toast('This mobile number is already registered', true);
    const plan = db.plans.find(p => p.id === f.get('plan')); if (!plan) return toast('Add a plan in Settings first', true);
    const fee = +f.get('fee'), paid = Math.min(+f.get('paid'), fee), join = f.get('joinDate');
    const m = { id: uid(), name: f.get('name').trim(), mobile, joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due: fee - paid, token: rtoken() };
    db.members.push(m);
    if (paid > 0) pay(m, paid, f.get('mode'), 'Admission', join);
    save(); closeSheet(); render(); toast(`${m.name} added`);
  },
  edit(f, id) {
    const m = getM(id), mobile = f.get('mobile').trim();
    if (db.members.some(x => x.id !== id && x.mobile === mobile)) return toast('This mobile number is already registered', true);
    const changed = m.expiry !== f.get('expiry') || m.mobile !== mobile || m.joinDate !== f.get('joinDate') || m.name !== f.get('name').trim();
    Object.assign(m, { name: f.get('name').trim(), mobile, joinDate: f.get('joinDate'), expiry: f.get('expiry'), due: +f.get('due') || 0 });
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
    db.gym.name = f.get('gym').trim(); db.gym.pin = f.get('pin').trim(); db.gym.eveningFrom = +f.get('ef') || 12;
    save(); closeSheet(); render(); toast('Settings saved');
  },
};

function seedDemo() {
  const names = ['Aman Verma', 'Priya Singh', 'Rahul Yadav', 'Neha Gupta', 'Vikas Chauhan', 'Sonia Mishra', 'Karan Patel', 'Anjali Rawat', 'Deepak Kumar', 'Pooja Sahu', 'Sandeep Thakur', 'Rekha Joshi', 'Mohit Saini', 'Kavita Pandey'];
  const t = today(); db.members = []; db.payments = []; db.attendance = {}; db.checkins = {};
  names.forEach((n, i) => {
    const plan = db.plans[i % db.plans.length], join = addDays(t, -Math.floor(Math.random() * 120) - 2);
    const fee = plan.fee, due = i % 4 === 0 ? Math.round(fee * .4) : 0;
    const m = { id: uid(), name: n, mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due, token: rtoken() };
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
    if (confirm(`Delete ${m.name}? Past payments stay in reports.`)) {
      db.members = db.members.filter(x => x.id !== m.id); save(); closeSheet(); render(); toast('Member deleted');
    }
  },
  camToggle: () => { if (scan.stream) { ui.camWanted = false; stopCam(); $('#camBtn').textContent = 'Start camera'; $('#scanMsg').textContent = 'Camera is off'; } else { ui.camWanted = true; startCam(); } },
  simScan: () => { const m = getM($('#simSel').value); if (m) { scan.last = ''; onScan(`GYM:${m.id}:${m.token}`); } },
  manual: () => {
    if (!db.gym.pin) { toast('Set an owner PIN in Settings first', true); return settingsSheet(); }
    openSheet('Owner PIN', `<form data-form="pin"><label>Enter PIN<input name="pin" type="password" inputmode="numeric" maxlength="4" required autofocus></label><button class="btn primary wide">Unlock manual entry</button></form>`);
  },
  qr: el => qrSheet(el.dataset.id),
  qrSave: async el => { const f = await qrFile(getM(el.dataset.id)), a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); },
  qrShare: async el => {
    const m = getM(el.dataset.id), f = await qrFile(m);
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: `${m.name}, this is your entry QR for ${db.gym.name}. Show it at the gate.` }).catch(() => {});
    else actions.qrSave(el);
  },
  qrNew: el => { const m = getM(el.dataset.id); if (confirm(`Make a new QR for ${m.name}? The old QR will stop working.`)) { m.token = rtoken(); save(); qrSheet(m.id); toast('New QR created'); } },
  att: el => {
    const m = getM(el.dataset.id), r = checkIn(m);
    toast(r.already ? `${m.name} already has a ${SESS[r.s].toLowerCase()} entry` : `${m.name} marked, ${SESS[r.s].toLowerCase()} ${r.t}`, r.already);
    $('#attBody').innerHTML = attDailyList();
  },
  exportRep: exportReport, exportMembers, exportAtt: exportAttendance,
  settings: settingsSheet,
  closeSheet,
  addPlan: () => $('#plans').insertAdjacentHTML('beforeend', planRow()),
  rmPlan: el => { if (document.querySelectorAll('.planrow').length > 1) el.closest('.planrow').remove(); else toast('Keep at least one plan', true); },
  backup: () => download(`gym-backup-${today()}.json`, JSON.stringify(db), 'application/json'),
  restore: () => $('#restoreFile').click(),
  demo: () => { if (!db.members.length || confirm('This replaces your current data with sample data. Continue?')) seedDemo(); },
  reset: () => { if (confirm('Delete ALL members, payments and attendance? This cannot be undone.')) { db = { gym: db.gym, plans: db.plans, members: [], payments: [], attendance: {}, checkins: {}, seq: 1 }; save(); closeSheet(); render(); toast('All data deleted'); } },
  install: async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; },
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
  } else if (t.id === 'attDate') { ui.attDate = t.value || today(); $('#attBody').innerHTML = attDailyList(); }
  else if (t.id === 'attMonth') { ui.attMonth = t.value || ui.attMonth; $('#attBody').innerHTML = attMonthly(); }
  else if (t.id === 'repDate') { ui.repDate = t.value || ui.repDate; render(); }
  else if (t.id === 'repMonth') { ui.repMonth = t.value || ui.repMonth; render(); }
  else if (t.id === 'restoreFile' && t.files[0]) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!Array.isArray(d.members) || !Array.isArray(d.payments)) throw 0;
        db = normalize(d); save(); closeSheet(); render(); toast('Backup restored');
      } catch (_) { toast('This file is not a valid backup', true); }
    };
    rd.readAsText(t.files[0]); t.value = '';
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeCam(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- install + offline ---------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { deferred = null; $('#installBtn').hidden = true; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

render();
