(() => {
  const KEY = 'gym-manager-data-v1';
  const defaults = { gymName: 'Gym Manager', members: [], attendance: [], payments: [], settings: { currency: 'INR' } };
  let state;
  try { state = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { state = { ...defaults }; }
  const view = document.getElementById('view');
  const tabs = document.getElementById('tabs');
  const toast = document.getElementById('toast');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.settings?.currency || 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const today = () => new Date().toISOString().slice(0,10);
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  let page = 'dashboard';
  let installPrompt = null;
  const names = { dashboard:'Dashboard', members:'Members', attendance:'Attendance', fees:'Fees & Payments', reports:'Reports' };
  function flash(s) { toast.textContent = s; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
  function tabNav() {
    tabs.innerHTML = Object.keys(names).map(k => `<button class="tab ${page===k?'active':''}" data-page="${k}">${names[k]}</button>`).join('');
  }
  function due(m) { const paid = state.payments.filter(p => p.memberId === m.id).reduce((a,p) => a + Number(p.amount || 0),0); return Math.max(0, Number(m.fee || 0) - paid); }
  function memberName(mid) { return state.members.find(m => m.id === mid)?.name || 'Deleted member'; }
  function render() {
    document.getElementById('gymName').textContent = state.gymName || 'Gym Manager';
    tabNav();
    const todayAttendance = state.attendance.filter(a => a.date === today()).length;
    const totalCollected = state.payments.reduce((a,p)=>a+Number(p.amount||0),0);
    const outstanding = state.members.reduce((a,m)=>a+due(m),0);
    const header = (title, sub='Manage your gym from one place') => `<section class="page-head"><div><p class="eyebrow">GYM MANAGER</p><h1>${title}</h1><p class="muted">${sub}</p></div></section>`;
    if (page === 'dashboard') {
      view.innerHTML = `${header('Dashboard', new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}<section class="stats"><article class="stat"><span>Active members</span><strong>${state.members.filter(m=>m.status!=='inactive').length}</strong></article><article class="stat"><span>Attendance today</span><strong>${todayAttendance}</strong></article><article class="stat"><span>Total collected</span><strong>${money(totalCollected)}</strong></article><article class="stat"><span>Fees outstanding</span><strong>${money(outstanding)}</strong></article></section><section class="panel"><div class="panel-title"><h2>Quick actions</h2></div><div class="actions"><button class="btn primary" data-action="add-member">+ Add member</button><button class="btn" data-action="checkin">Mark attendance</button><button class="btn" data-action="payment">Record payment</button><button class="btn" data-action="export">Backup data</button></div></section><section class="panel"><div class="panel-title"><h2>Recent members</h2><button class="text-btn" data-page="members">View all</button></div>${state.members.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Monthly fee</th></tr></thead><tbody>${state.members.slice(-5).reverse().map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.phone||'—')}</td><td>${money(m.fee)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No members added yet. Add your first gym member to get started.</p>'}</section>`;
    } else if (page === 'members') {
      view.innerHTML = `${header('Members')}<section class="panel"><div class="panel-title"><h2>Member directory</h2><button class="btn primary" data-action="add-member">+ Add member</button></div>${state.members.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Join date</th><th>Monthly fee</th><th>Status</th><th></th></tr></thead><tbody>${state.members.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.phone||'—')}</td><td>${esc(m.joinDate||'—')}</td><td>${money(m.fee)}</td><td><span class="pill ${m.status==='inactive'?'off':''}">${esc(m.status||'active')}</span></td><td><button class="text-btn" data-action="edit-member" data-id="${m.id}">Edit</button> <button class="text-btn danger" data-action="delete-member" data-id="${m.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No members yet. Use Add member to create your first record.</p>'}</section>`;
    } else if (page === 'attendance') {
      view.innerHTML = `${header('Attendance')}<section class="panel"><div class="panel-title"><h2>Mark today's attendance</h2><span class="muted">${today()}</span></div>${state.members.filter(m=>m.status!=='inactive').length ? `<div class="member-list">${state.members.filter(m=>m.status!=='inactive').map(m=>{const present=state.attendance.some(a=>a.memberId===m.id&&a.date===today());return `<div class="member-row"><div><strong>${esc(m.name)}</strong><small>${esc(m.phone||'')}</small></div><button class="btn ${present?'success':'secondary'}" data-action="toggle-attendance" data-id="${m.id}">${present?'Present ✓':'Mark present'}</button></div>`}).join('')}</div>` : '<p class="empty">Add members before marking attendance.</p>'}</section><section class="panel"><div class="panel-title"><h2>Recent attendance</h2></div>${state.attendance.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Member</th><th></th></tr></thead><tbody>${state.attendance.slice().reverse().slice(0,30).map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(memberName(a.memberId))}</td><td><button class="text-btn danger" data-action="remove-attendance" data-id="${a.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No attendance records yet.</p>'}</section>`;
    } else if (page === 'fees') {
      view.innerHTML = `${header('Fees & Payments')}<section class="panel"><div class="panel-title"><h2>Fee status</h2><button class="btn primary" data-action="payment">+ Record payment</button></div>${state.members.length?`<div class="table-wrap"><table><thead><tr><th>Member</th><th>Monthly fee</th><th>Paid so far</th><th>Due</th></tr></thead><tbody>${state.members.map(m=>{const paid=state.payments.filter(p=>p.memberId===m.id).reduce((a,p)=>a+Number(p.amount||0),0);return `<tr><td>${esc(m.name)}</td><td>${money(m.fee)}</td><td>${money(paid)}</td><td>${money(due(m))}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">Add members to manage fees.</p>'}</section><section class="panel"><div class="panel-title"><h2>Payment history</h2></div>${state.payments.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Member</th><th>Amount</th><th>Note</th></tr></thead><tbody>${state.payments.slice().reverse().map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(memberName(p.memberId))}</td><td>${money(p.amount)}</td><td>${esc(p.note||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No payments recorded yet.</p>'}</section>`;
    } else if (page === 'reports') {
      view.innerHTML = `${header('Reports & backup')}<section class="stats"><article class="stat"><span>Members</span><strong>${state.members.length}</strong></article><article class="stat"><span>Attendance entries</span><strong>${state.attendance.length}</strong></article><article class="stat"><span>Payments</span><strong>${state.payments.length}</strong></article><article class="stat"><span>Collected amount</span><strong>${money(totalCollected)}</strong></article></section><section class="panel"><div class="panel-title"><h2>Data backup</h2></div><p class="muted">Your records are stored in this browser on this device. Export backups regularly. Clearing browser data or changing devices can remove access to these records.</p><div class="actions"><button class="btn primary" data-action="export">Download backup</button><button class="btn" data-action="import">Restore backup</button></div><label class="field-label" for="gymNameInput">Gym name</label><div class="inline-form"><input id="gymNameInput" value="${esc(state.gymName)}" maxlength="70"><button class="btn secondary" data-action="save-settings">Save name</button></div></section>`;
    }
  }
  function openForm(title, content) {
    document.getElementById('sheetTitle').textContent = title;
    document.getElementById('sheetBody').innerHTML = content;
    document.getElementById('sheet').hidden = false;
    const first = document.querySelector('#sheetBody input, #sheetBody select'); if (first) first.focus();
  }
  function closeForm() { document.getElementById('sheet').hidden = true; }
  function memberForm(m={}) {
    openForm(m.id?'Edit member':'Add gym member', `<form id="memberForm" class="form-grid"><label class="field-label">Full name<input name="name" required maxlength="100" value="${esc(m.name||'')}"></label><label class="field-label">Phone number<input name="phone" inputmode="tel" maxlength="25" value="${esc(m.phone||'')}"></label><label class="field-label">Monthly fee (₹)<input name="fee" type="number" min="0" step="1" required value="${Number(m.fee||0)}"></label><label class="field-label">Join date<input name="joinDate" type="date" value="${esc(m.joinDate||today())}"></label><label class="field-label">Status<select name="status"><option value="active" ${m.status!=='inactive'?'selected':''}>Active</option><option value="inactive" ${m.status==='inactive'?'selected':''}>Inactive</option></select></label><button class="btn primary full" type="submit">Save member</button></form>`);
    document.getElementById('memberForm').addEventListener('submit', e=>{ e.preventDefault(); const f=new FormData(e.currentTarget); const data={name:String(f.get('name')).trim(),phone:String(f.get('phone')).trim(),fee:Number(f.get('fee')),joinDate:f.get('joinDate'),status:f.get('status')}; if(!data.name||data.fee<0||!Number.isFinite(data.fee))return; if(m.id) Object.assign(m,data); else state.members.push({id:id(),...data}); save(); closeForm(); render(); flash('Member saved'); });
  }
  function paymentForm() {
    if(!state.members.length) return flash('Add a member first');
    openForm('Record payment', `<form id="paymentForm" class="form-grid"><label class="field-label">Member<select name="memberId" required>${state.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label><label class="field-label">Amount (₹)<input name="amount" type="number" min="1" step="1" required></label><label class="field-label">Payment date<input name="date" type="date" value="${today()}" required></label><label class="field-label">Note (optional)<input name="note" maxlength="120" placeholder="Monthly fee, joining fee…"></label><button class="btn primary full" type="submit">Save payment</button></form>`);
    document.getElementById('paymentForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const amount=Number(f.get('amount'));if(amount<=0||!Number.isFinite(amount))return;state.payments.push({id:id(),memberId:f.get('memberId'),amount,date:f.get('date'),note:String(f.get('note')||'').trim()});save();closeForm();render();flash('Payment recorded');});
  }
  function exportData() { const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`gym-manager-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);flash('Backup downloaded'); }
  document.addEventListener('click', e => {
    const pageBtn=e.target.closest('[data-page]'); if(pageBtn){page=pageBtn.dataset.page;render();return;}
    const el=e.target.closest('[data-action],[data-act]'); if(!el)return;
    const action=el.dataset.action||el.dataset.act; const mid=el.dataset.id;
    if(action==='settings'){page='reports';render();}
    else if(action==='closeSheet')closeForm();
    else if(action==='add-member')memberForm();
    else if(action==='edit-member'){const m=state.members.find(x=>x.id===mid);if(m)memberForm(m);}
    else if(action==='delete-member'){const m=state.members.find(x=>x.id===mid);if(m&&confirm(`Delete ${m.name}? Their linked attendance and payment records will remain in history.`)){state.members=state.members.filter(x=>x.id!==mid);save();render();flash('Member deleted');}}
    else if(action==='payment')paymentForm();
    else if(action==='checkin'){page='attendance';render();}
    else if(action==='toggle-attendance'){const existing=state.attendance.find(a=>a.memberId===mid&&a.date===today());if(existing)state.attendance=state.attendance.filter(a=>a.id!==existing.id);else state.attendance.push({id:id(),memberId:mid,date:today()});save();render();flash(existing?'Attendance removed':'Attendance marked');}
    else if(action==='remove-attendance'){state.attendance=state.attendance.filter(a=>a.id!==el.dataset.id);save();render();flash('Attendance removed');}
    else if(action==='export')exportData();
    else if(action==='import')document.getElementById('restoreFile').click();
    else if(action==='save-settings'){const n=document.getElementById('gymNameInput')?.value.trim();if(n){state.gymName=n;save();render();flash('Gym name saved');}}
    else if(action==='install'&&installPrompt){installPrompt.prompt();installPrompt.userChoice.finally(()=>{installPrompt=null;el.hidden=true;});}
  });
  document.getElementById('restoreFile').addEventListener('change', async e=>{const f=e.target.files?.[0];if(!f)return;try{const parsed=JSON.parse(await f.text());const incoming=parsed.data||parsed;if(!Array.isArray(incoming.members)||!Array.isArray(incoming.attendance)||!Array.isArray(incoming.payments))throw new Error('This file is not a valid Gym Manager backup.');if(confirm('Restore backup and replace the current data on this device?')){state={...defaults,...incoming};save();render();flash('Backup restored');}}catch(err){alert(err.message||'Could not restore this backup.');}finally{e.target.value='';}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installBtn').hidden=false;});
  window.addEventListener('appinstalled',()=>flash('Gym Manager installed'));
  render();
})();
