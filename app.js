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
let db = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.members)) return d;
  } catch (e) {}
  return { gym: { name: 'My Gym', phone: '' }, plans: DEFAULT_PLANS, members: [], payments: [], attendance: {}, seq: 1 };
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
  attMode: 'daily', attDate: today(), attQ: '', attMonth: today().slice(0, 7),
  repMode: 'monthly', repDate: today(), repMonth: today().slice(0, 7),
};
const TABS = [['home', 'Home', 'home'], ['members', 'Members', 'members'], ['fees', 'Fees', 'fees'],
  ['attendance', 'Attendance', 'attendance'], ['reminders', 'Reminders', 'bell'], ['reports', 'Reports', 'reports']];

function render() {
  $('#gymName').textContent = db.gym.name || 'Gym Manager';
  document.title = (db.gym.name || 'Gym') + ' | Gym Manager';
  $('#settingsBtn').innerHTML = ic('gear', 24);
  $('#tabs').innerHTML = TABS.map(([k, l, i]) =>
    `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('');
  const views = { home: viewHome, members: viewMembers, fees: viewFees, attendance: viewAttendance, reminders: viewReminders, reports: viewReports };
  $('#view').innerHTML = views[ui.tab]();
}
function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }

/* ---------- home ---------- */
function viewHome() {
  const t = today(), ym = t.slice(0, 7), ms = db.members;
  const active = ms.filter(m => m.expiry >= t).length;
  const todayCol = sum(db.payments.filter(p => p.date === t));
  const monthCol = sum(db.payments.filter(p => p.date.startsWith(ym)));
  const pend = ms.filter(m => m.due > 0);
  const came = (db.attendance[t] || []).filter(id => getM(id)).length;
  const soon = ms.filter(m => { const l = daysBetween(t, m.expiry); return l >= 0 && l <= 7; }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  return `
  <section class="board">
    <div><span class="lbl">Today's collection</span><div class="big">${inr(todayCol)}</div></div>
    <div class="side"><div class="num">${came}</div><span class="lbl">came today</span></div>
  </section>
  <div class="tiles">
    <button class="tile t-blue" data-act="tab" data-k="members"><span class="lbl">Total members</span><span class="num">${ms.length}</span></button>
    <button class="tile t-green" data-act="goFilter" data-f="active"><span class="lbl">Active members</span><span class="num">${active}</span></button>
    <button class="tile t-blue" data-act="tab" data-k="reports"><span class="lbl">This month's earning</span><span class="num">${inr(monthCol)}</span></button>
    <button class="tile t-red" data-act="goFees"><span class="lbl">Pending fees</span><span class="num">${inr(sum(pend.map(m => ({ amount: m.due }))))}</span><small>${pend.length} member${pend.length === 1 ? '' : 's'}</small></button>
  </div>
  <div class="quick">
    <button class="btn primary" data-act="add">${ic('plus', 20)} Add member</button>
    <button class="btn" data-act="tab" data-k="attendance">${ic('check', 20)} Mark attendance</button>
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
function attDailyList() {
  const d = ui.attDate, marked = new Set(db.attendance[d] || []), q = ui.attQ.trim().toLowerCase();
  const eligible = db.members.filter(m => m.expiry >= d || marked.has(m.id));
  const list = eligible.filter(m => !q || m.name.toLowerCase().includes(q) || m.mobile.includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const came = eligible.filter(m => marked.has(m.id)).length;
  return `<p class="sum"><b>${came}</b> of ${eligible.length} members came</p>` +
    (list.length ? `<div class="list">${list.map(m => `<button class="row ${marked.has(m.id) ? 'in' : ''}" data-act="att" data-id="${m.id}">
      <span class="check">${marked.has(m.id) ? ic('check', 20) : ''}</span>
      <span class="who"><b>${esc(m.name)}</b><small>${m.expiry < d ? 'Membership expired' : esc(m.mobile)}</small></span>
      ${m.due > 0 ? `<small class="due">Due ${inr(m.due)}</small>` : ''}</button>`).join('')}</div>`
      : `<div class="list"><div class="empty">${db.members.length ? 'No active members found.' : 'Add members first to mark attendance.'}</div></div>`);
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
  const seg = `<div class="seg"><button class="${ui.attMode === 'daily' ? 'on' : ''}" data-act="attMode" data-k="daily">Mark today</button><button class="${ui.attMode === 'monthly' ? 'on' : ''}" data-act="attMode" data-k="monthly">Monthly report</button></div>`;
  if (ui.attMode === 'monthly') return seg + `<div id="attBody">${attMonthly()}</div>`;
  return seg + `<div class="bar"><input type="date" id="attDate" value="${ui.attDate}" max="${today()}"></div>
    <input class="search" id="attQ" type="search" placeholder="Search member" value="${esc(ui.attQ)}" autocomplete="off" style="margin-bottom:6px">
    <div id="attBody">${attDailyList()}</div>`;
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
    <div class="tile t-red" style="grid-column:1/-1"><span class="lbl">Pending payments right now</span><span class="num">${inr(sum(r.pending.map(m => ({ amount: m.due }))))}</span><small>${r.pending.length} members</small></div>
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
  rows.push(['Total collection', sum(r.pays)], ['New admissions', r.admissions.length], ['Expired members', r.expired.length], ['Pending amount (now)', sum(r.pending.map(m => ({ amount: m.due })))], []);
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
      <button class="btn danger" data-act="del" data-id="${id}">Delete</button></div>
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
    const m = { id: uid(), name: f.get('name').trim(), mobile, joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due: fee - paid };
    db.members.push(m);
    if (paid > 0) pay(m, paid, f.get('mode'), 'Admission', join);
    save(); closeSheet(); render(); toast(`${m.name} added`);
  },
  edit(f, id) {
    const m = getM(id), mobile = f.get('mobile').trim();
    if (db.members.some(x => x.id !== id && x.mobile === mobile)) return toast('This mobile number is already registered', true);
    Object.assign(m, { name: f.get('name').trim(), mobile, joinDate: f.get('joinDate'), expiry: f.get('expiry'), due: +f.get('due') || 0 });
    save(); closeSheet(); render(); toast('Changes saved');
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
    save(); closeSheet(); render(); toast(`Renewed until ${fmtDate(m.expiry)}`);
  },
  settings(f) {
    const ids = f.getAll('pid'), names = f.getAll('pn'), months = f.getAll('pm'), fees = f.getAll('pf');
    if (!names.length) return toast('Keep at least one plan', true);
    db.plans = names.map((n, i) => ({ id: ids[i] || 'p' + Date.now().toString(36) + i, name: n.trim(), months: +months[i], fee: +fees[i] }));
    db.gym.name = f.get('gym').trim();
    save(); closeSheet(); render(); toast('Settings saved');
  },
};

function seedDemo() {
  const names = ['Aman Verma', 'Priya Singh', 'Rahul Yadav', 'Neha Gupta', 'Vikas Chauhan', 'Sonia Mishra', 'Karan Patel', 'Anjali Rawat', 'Deepak Kumar', 'Pooja Sahu', 'Sandeep Thakur', 'Rekha Joshi', 'Mohit Saini', 'Kavita Pandey'];
  const t = today(); db.members = []; db.payments = []; db.attendance = {};
  names.forEach((n, i) => {
    const plan = db.plans[i % db.plans.length], join = addDays(t, -Math.floor(Math.random() * 120) - 2);
    const fee = plan.fee, due = i % 4 === 0 ? Math.round(fee * .4) : 0;
    const m = { id: uid(), name: n, mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), joinDate: join, planId: plan.id, planName: plan.name, fee, expiry: addMonths(join, plan.months), due };
    if (i < 4) m.expiry = addDays(t, [1, 3, 6, -5][i]);
    db.members.push(m); pay(m, fee - due, ['Cash', 'UPI', 'Card'][i % 3], 'Admission', join);
  });
  for (let k = 0; k < 25; k++) {
    const d = addDays(t, -k); if (parse(d).getDay() === 0) continue;
    const ids = db.members.filter(m => m.expiry >= d && m.joinDate <= d && Math.random() > .45).map(m => m.id);
    if (ids.length) db.attendance[d] = ids;
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
  att: el => {
    const d = ui.attDate, list = db.attendance[d] || [], id = el.dataset.id, m = getM(id);
    if (list.includes(id)) db.attendance[d] = list.filter(x => x !== id);
    else { db.attendance[d] = [...list, id]; if (m.expiry < d) toast(`${m.name}'s membership has expired`, true); }
    if (!db.attendance[d].length) delete db.attendance[d];
    save(); $('#attBody').innerHTML = attDailyList();
  },
  exportRep: exportReport, exportMembers, exportAtt: exportAttendance,
  settings: settingsSheet,
  closeSheet,
  addPlan: () => $('#plans').insertAdjacentHTML('beforeend', planRow()),
  rmPlan: el => { if (document.querySelectorAll('.planrow').length > 1) el.closest('.planrow').remove(); else toast('Keep at least one plan', true); },
  backup: () => download(`gym-backup-${today()}.json`, JSON.stringify(db), 'application/json'),
  restore: () => $('#restoreFile').click(),
  demo: () => { if (!db.members.length || confirm('This replaces your current data with sample data. Continue?')) seedDemo(); },
  reset: () => { if (confirm('Delete ALL members, payments and attendance? This cannot be undone.')) { db = { gym: db.gym, plans: db.plans, members: [], payments: [], attendance: {}, seq: 1 }; save(); closeSheet(); render(); toast('All data deleted'); } },
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
        db = d; save(); closeSheet(); render(); toast('Backup restored');
      } catch (_) { toast('This file is not a valid backup', true); }
    };
    rd.readAsText(t.files[0]); t.value = '';
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- install + offline ---------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { deferred = null; $('#installBtn').hidden = true; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

render();
