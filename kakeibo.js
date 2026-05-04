// ─── DATA ──────────────────────────────────────────────
const CATS = [
  {id:'necessities', icon:'🛒', name:'Necessities'},
  {id:'bills',       icon:'🧾', name:'Bills'},
  {id:'eating-out',  icon:'🍽', name:'Eating Out'},
  {id:'transport',   icon:'🚃', name:'Transport'},
  {id:'apparel',     icon:'🛍️', name:'Apparel'},
  {id:'entertainment',icon:'🎮',name:'Entertainment'},
  {id:'travel',      icon:'✈️', name:'Travel'},
  {id:'health',      icon:'💊', name:'Health'},
  {id:'self-care',   icon:'💆🏻‍♂️', name:'Self Care'},
  {id:'gifts',       icon:'🎁', name:'Gifts'},
  {id:'investments', icon:'📈', name:'Investments'},
  {id:'others',      icon:'📦', name:'Others'},
];

const INC_SOURCES = [
  {id:'remittance',     icon:'💸', name:'Remittance'},
  {id:'scholarship',    icon:'🎓', name:'Scholarship'},
  {id:'reimbursement', icon'⏮️',  name'Reimbursement'},
  {id:'baito',          icon:'💼', name:'Baito'},
  {id:'others',         icon:'📦', name:'Others'},
];

const MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ls(k){ try{ return JSON.parse(localStorage.getItem('kb5_'+k)); } catch{ return null; } }
function sv(k,v){ localStorage.setItem('kb5_'+k, JSON.stringify(v)); }

const S = {
  cur: 'JPY',
  mode: 'expense',
  sel: null,
  cY: new Date().getFullYear(),
  cM: new Date().getMonth(),
  cSel: null,
  eAccId: null,
  cfg:  ls('cfg') || {},
  exp:  ls('exp') || [],
  inc:  ls('inc') || [],
  acc:  ls('acc') || [],
};

// ─── INIT ──────────────────────────────────────────────
function init() {
  renderPills();
  renderRecent();
  applyMode();
  renderCal();
  renderAcc();
  loadCfg();
  renderPropLists();
  if (!S.cfg.apiKey || !S.cfg.txDbId) {
    document.getElementById('setupBanner').style.display = 'flex';
  }
  if (S.cfg.apiKey && S.cfg.accDbId) {
    nLoadAccs().then(() => renderAcc()).catch(e => console.error('Acc load:', e.message));
  }
}

// ─── NAV ───────────────────────────────────────────────
function goTab(id, btn) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('on'));
  document.getElementById('s-'+id).classList.add('on');
  btn.classList.add('on');
  if (id === 'cal') renderCal();
  if (id === 'acc') renderAcc();
}

// ─── CURRENCY ──────────────────────────────────────────
function setCur(c) {
  S.cur = c;
  const j = c === 'JPY';
  document.getElementById('bjpy').className = 'cbtn' + (j ? ' aj' : '');
  document.getElementById('bphp').className = 'cbtn' + (!j ? ' ap' : '');
  document.getElementById('aSym').textContent = j ? '¥' : '₱';
}

// ─── MODE ──────────────────────────────────────────────
function setMode(m) {
  S.mode = m;
  S.sel = null;
  applyMode();
  renderPills();
}

function applyMode() {
  const isInc = S.mode === 'income';
  document.getElementById('btn-exp').className = 'ttbtn' + (!isInc ? ' ae' : '');
  document.getElementById('btn-inc').className = 'ttbtn' + (isInc ? ' ai' : '');
  const accent = isInc ? 'var(--inc)' : 'var(--exp)';
  const accentd = isInc ? 'var(--incd)' : 'var(--expd)';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accentd', accentd);
  document.getElementById('aSym').style.color = accent;
  const btn = document.getElementById('subBtn');
  btn.textContent = isInc ? 'Log Income' : 'Log Expense';
  btn.className = 'btn' + (isInc ? ' inc' : '');
  document.getElementById('pillLabel').textContent = isInc ? 'Source' : 'Category';
  document.getElementById('nInp').placeholder = isInc ? 'Add a note (optional)' : 'What was this for?';
}

// ─── PILLS ─────────────────────────────────────────────
function renderPills() {
  const items = S.mode === 'income' ? INC_SOURCES : CATS;
  document.getElementById('pillScroll').innerHTML = items.map(item =>
    `<div class="pill${S.sel===item.id?' on':''}" id="pill-${item.id}" onclick="selPill('${item.id}')">
      <span>${item.icon}</span><span>${item.name}</span>
    </div>`
  ).join('');
}

function selPill(id) {
  S.sel = id;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  const el = document.getElementById('pill-'+id);
  if (el) el.classList.add('on');
}

// ─── SUBMIT ────────────────────────────────────────────
function subMain() {
  if (S.mode === 'income') subInc();
  else subExp();
}

async function subExp() {
  const amt = parseFloat(document.getElementById('aInp').value);
  const note = document.getElementById('nInp').value.trim();
  if (!amt || amt <= 0) { toast('Enter an amount', true); return; }
  if (!S.sel) { toast('Pick a category', true); return; }
  const cat = CATS.find(c => c.id === S.sel);
  const tx = { id: Date.now(), amt, cur: S.cur, catId: S.sel, catName: cat.name, catIcon: cat.icon, note, time: new Date().toISOString(), type: 'expense' };
  setLoad(true);
  S.exp.unshift(tx); if (S.exp.length > 1000) S.exp = S.exp.slice(0,1000);
  sv('exp', S.exp);
  if (S.cfg.apiKey && S.cfg.txDbId) {
    try { await nSaveTx(tx); toast(cat.icon + ' Saved to Notion'); }
    catch(e) { toast(e.message, true); }
  } else toast(cat.icon + ' Saved locally');
  document.getElementById('aInp').value = '';
  document.getElementById('nInp').value = '';
  S.sel = null;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  setLoad(false);
  renderRecent();
}

async function subInc() {
  const amt = parseFloat(document.getElementById('aInp').value);
  const note = document.getElementById('nInp').value.trim();
  if (!amt || amt <= 0) { toast('Enter an amount', true); return; }
  if (!S.sel) { toast('Pick a source', true); return; }
  const src = INC_SOURCES.find(s => s.id === S.sel);
  const tx = { id: Date.now(), amt, cur: S.cur, catId: S.sel, catName: src.name, catIcon: src.icon, note, time: new Date().toISOString(), type: 'income' };
  setLoad(true);
  S.inc.unshift(tx); if (S.inc.length > 1000) S.inc = S.inc.slice(0,1000);
  sv('inc', S.inc);
  if (S.cfg.apiKey && S.cfg.txDbId) {
    try { await nSaveTx(tx); toast(src.icon + ' Saved to Notion'); }
    catch(e) { toast(e.message, true); }
  } else toast(src.icon + ' Saved locally');
  document.getElementById('aInp').value = '';
  document.getElementById('nInp').value = '';
  S.sel = null;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  setLoad(false);
  renderRecent();
}

function setLoad(on) {
  const b = document.getElementById('subBtn');
  b.disabled = on;
  b.textContent = on ? 'Saving…' : (S.mode === 'income' ? 'Log Income' : 'Log Expense');
}

// ─── RECENT LIST ───────────────────────────────────────
function renderRecent() {
  const list = document.getElementById('recList');
  const all = [
    ...S.exp.map(e => ({...e, _t:'e'})),
    ...S.inc.map(i => ({...i, _t:'i'}))
  ].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 20);

  if (!all.length) {
    list.innerHTML = `<div class="empty"><div class="ei">🗒</div><div class="et">Nothing logged yet</div></div>`;
    return;
  }
  list.innerHTML = all.map(tx => {
    const sym = tx.cur === 'JPY' ? '¥' : '₱';
    const amt = fmtN(tx.amt, tx.cur);
    const d = new Date(tx.time);
    const time = isToday(d)
      ? d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})
      : MS[d.getMonth()] + ' ' + d.getDate();
    const pfx = tx._t === 'i' ? '+' : '-';
    return `<div class="li">
      <div class="lic">${tx.catIcon}</div>
      <div class="lim">
        <div class="lit">${tx.catName}</div>
        ${tx.note ? `<div class="lis">${tx.note}</div>` : ''}
      </div>
      <div class="lir">
        <div class="lia ${tx._t}">${pfx}${sym}${amt}</div>
        <div class="litime">${time}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── CALENDAR ──────────────────────────────────────────
function renderCal() {
  const {cY:y, cM:m} = S;
  document.getElementById('cLabel').textContent = MN[m] + ' ' + y;
  const first = new Date(y,m,1).getDay();
  const days  = new Date(y,m+1,0).getDate();
  const prev  = new Date(y,m,0).getDate();
  const today = new Date();
  const em = {}, im = {};
  S.exp.forEach(e => { const d = new Date(e.time); if(d.getFullYear()===y&&d.getMonth()===m){const k=d.getDate();if(!em[k])em[k]=[];em[k].push(e);} });
  S.inc.forEach(i => { const d = new Date(i.time); if(d.getFullYear()===y&&d.getMonth()===m){const k=d.getDate();if(!im[k])im[k]=[];im[k].push(i);} });
  let h = '';
  for (let i=first-1; i>=0; i--) h += `<div class="cday other"><span class="cdn">${prev-i}</span></div>`;
  for (let d=1; d<=days; d++) {
    const td = d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
    const sl = S.cSel===d;
    const he = em[d]?.length>0, hi = im[d]?.length>0;
    h += `<div class="cday${td?' today':''}${sl?' sel':''}" onclick="selCal(${d})">
      <span class="cdn">${d}</span>
      ${he?'<div class="cdot e"></div>':''}
      ${hi?`<div class="cdot i" style="${he?'right:6px':''}"></div>`:''}
    </div>`;
  }
  const rem = (first+days)%7===0 ? 0 : 7-(first+days)%7;
  for (let i=1; i<=rem; i++) h += `<div class="cday other"><span class="cdn">${i}</span></div>`;
  document.getElementById('cDays').innerHTML = h;
  renderCalDetail(em, im);
}

function selCal(d) { S.cSel = S.cSel===d ? null : d; renderCal(); }
function calPrev() { S.cM===0?(S.cM=11,S.cY--):S.cM--; S.cSel=null; renderCal(); }
function calNext() { S.cM===11?(S.cM=0,S.cY++):S.cM++; S.cSel=null; renderCal(); }

// ─── EDIT DATE PICKER ──────────────────────────────────
const ED = { y: 0, m: 0, d: 0 }; // currently selected date in picker

function renderEdCal() {
  document.getElementById('edCalLabel').textContent = MN[ED.m] + ' ' + ED.y;
  const first = new Date(ED.y, ED.m, 1).getDay();
  const days  = new Date(ED.y, ED.m + 1, 0).getDate();
  const prev  = new Date(ED.y, ED.m, 0).getDate();
  const today = new Date();
  let h = '';
  for (let i = first - 1; i >= 0; i--)
    h += `<div class="cday other"><span class="cdn">${prev - i}</span></div>`;
  for (let d = 1; d <= days; d++) {
    const isToday = d === today.getDate() && ED.m === today.getMonth() && ED.y === today.getFullYear();
    const isSel   = d === ED.d;
    h += `<div class="cday${isToday ? ' today' : ''}${isSel ? ' sel' : ''}" onclick="edCalSel(${d})">
      <span class="cdn">${d}</span>
    </div>`;
  }
  const rem = (first + days) % 7 === 0 ? 0 : 7 - (first + days) % 7;
  for (let i = 1; i <= rem; i++)
    h += `<div class="cday other"><span class="cdn">${i}</span></div>`;
  document.getElementById('edCalDays').innerHTML = h;
}

function edCalSel(d) { ED.d = d; renderEdCal(); }
function edCalPrev() { ED.m === 0 ? (ED.m = 11, ED.y--) : ED.m--; renderEdCal(); }
function edCalNext() { ED.m === 11 ? (ED.m = 0, ED.y++) : ED.m++; renderEdCal(); }

function openEditDate(id, listKey) {
  S._editDateId  = id;
  S._editDateKey = listKey;
  const list = listKey === 'inc' ? S.inc : S.exp;
  const tx = list.find(x => String(x.id) === String(id));
  if (!tx) return;
  const d = new Date(tx.time);
  ED.y = d.getFullYear();
  ED.m = d.getMonth();
  ED.d = d.getDate();
  renderEdCal();
  oSheet('sh-edit-date');
}

async function saveEditDate() {
  if (!ED.d) { toast('Pick a date', true); return; }
  const list = S._editDateKey === 'inc' ? S.inc : S.exp;
  const tx = list.find(x => String(x.id) === String(S._editDateId));
  if (!tx) return;
  const orig = new Date(tx.time);
  orig.setFullYear(ED.y, ED.m, ED.d);
  tx.time = orig.toISOString();
  if (S._editDateKey === 'inc') sv('inc', S.inc); else sv('exp', S.exp);
  if (S.cfg.apiKey && S.cfg.txDbId) {
    try { await nPatchTxDate(tx); } catch(e) { console.error('Date sync:', e.message); }
  }
  cSheet('sh-edit-date');
  renderCal();
  renderRecent();
  toast('Date updated');
}

function renderCalDetail(em, im) {
  const d = S.cSel;
  const el = document.getElementById('cDetail');
  if (!d) { el.innerHTML=''; return; }
  const ex = em[d]||[], inc = im[d]||[];
  if (!ex.length && !inc.length) { el.innerHTML=''; return; }
  const et = ex.reduce((s,e)=>s+e.amt,0), it = inc.reduce((s,i)=>s+i.amt,0), net = it-et;
  const cur = ex[0]?.cur || inc[0]?.cur || 'JPY';
  const sym = cur==='JPY'?'¥':'₱';
  el.innerHTML = `<div class="csum">
    <div class="csumh">
      <div class="csumd">${MS[S.cM]} ${d}</div>
      <div class="csumt${net>=0?' pos':''}">${net>=0?'+':''}${sym}${fmtN(Math.abs(net),cur)}</div>
    </div>
    <div class="csuml">
      ${inc.map(i=>`<div class="crow" onclick="openEditDate('${i.id}','inc')" style="cursor:pointer"><div class="cri">${i.catIcon}</div><div class="crn">${i.catName}${i.note?' · '+i.note:''}</div><div class="cra" style="color:var(--inc)">+${i.cur==='JPY'?'¥':'₱'}${fmtN(i.amt,i.cur)}</div></div>`).join('')}
      ${ex.map(e=>`<div class="crow" onclick="openEditDate('${e.id}','exp')" style="cursor:pointer"><div class="cri">${e.catIcon}</div><div class="crn">${e.catName}${e.note?' · '+e.note:''}</div><div class="cra" style="color:var(--exp)">-${e.cur==='JPY'?'¥':'₱'}${fmtN(e.amt,e.cur)}</div></div>`).join('')}
    </div>
  </div>`;
}

// ─── ACCOUNTS ──────────────────────────────────────────
function renderAcc() {
  const banks = S.acc.filter(a => a.type !== 'credit');
  const cards = S.acc.filter(a => a.type === 'credit');
  const noMsg = `<div class="empty" style="padding:12px 0"><div class="et">None added yet</div></div>`;
  document.getElementById('bankList').innerHTML = banks.length ? banks.map(accCard).join('') : noMsg;
  document.getElementById('cardList').innerHTML = cards.length ? cards.map(accCard).join('') : noMsg;

  const jBal = S.acc.filter(a=>a.cur==='JPY').reduce((s,a)=>s+netBal(a),0);
  const pBal = S.acc.filter(a=>a.cur==='PHP').reduce((s,a)=>s+netBal(a),0);
  const parts = [];
  if (S.acc.some(a=>a.cur==='JPY')) parts.push({v:'¥'+fmtN(jBal,'JPY'),l:'JPY',c:jBal>=0?'gi':'ge'});
  if (S.acc.some(a=>a.cur==='PHP')) parts.push({v:'₱'+fmtN(pBal,'PHP'),l:'PHP',c:pBal>=0?'gi':'ge'});
  document.getElementById('nwAmt').textContent = parts[0]?.v || '—';
  document.getElementById('nwSubs').innerHTML = parts.map(p=>`<div><div class="nwsv ${p.c}">${p.v}</div><div class="nwsl">${p.l}</div></div>`).join('');
}

function netBal(a) { return a.type==='credit' ? (a.limit||0)-(a.used||0) : (a.balance||0); }

function accCard(a) {
  const sym = a.cur==='JPY'?'¥':'₱';
  const ic = a.type==='credit';
  const bal = netBal(a);
  const ico = ic?'💳':a.type==='cash'?'💴':'🏦';
  return `<div class="acard2" onclick="openAccDet('${a.id}')">
    <div class="aico ${ic?'cc':a.type==='cash'?'cs':'bk'}">${ico}</div>
    <div class="ainf"><div class="an">${a.name}</div><div class="as2">${a.cur} · ${ic?'Credit Card':a.type==='cash'?'Cash':'Bank'}</div></div>
    <div class="ar"><div class="ab ${a.cur.toLowerCase()}">${sym}${fmtN(bal,a.cur)}</div><div class="atl">${ic?'Available':'Balance'}</div></div>
  </div>`;
}

function toggleCF() {
  const t = document.getElementById('acT').value;
  document.getElementById('acLF').style.display = t==='credit'?'block':'none';
  document.getElementById('acBL').textContent = t==='credit'?'Current Available Credit':'Current Balance';
}

async function saveAcc() {
  const name = document.getElementById('acN').value.trim();
  if (!name) { toast('Enter a name', true); return; }
  const type = document.getElementById('acT').value;
  const cur  = document.getElementById('acC').value;
  const bal  = parseFloat(document.getElementById('acB').value) || 0;
  const lim  = parseFloat(document.getElementById('acL').value) || 0;
  const a = { id:'a'+Date.now(), name, type, cur, balance: bal, limit: type==='credit'?lim:0, used: type==='credit'?Math.max(0,lim-bal):0 };
  S.acc.push(a); sv('acc', S.acc);
  if (S.cfg.apiKey && S.cfg.accDbId) {
    try { await nSaveAcc(a); } catch(e) { console.error('Acc sync:', e.message); }
  }
  cSheet('sh-add-acc');
  document.getElementById('acN').value = '';
  document.getElementById('acB').value = '';
  document.getElementById('acL').value = '';
  document.getElementById('acT').value = 'bank';
  toggleCF();
  renderAcc(); toast('Account added');
}

function openAccDet(id) {
  const a = S.acc.find(x => x.id===id);
  if (!a) return;
  S.eAccId = id;
  const sym = a.cur==='JPY'?'¥':'₱';
  const ic = a.type==='credit';
  const avail = netBal(a);
  document.getElementById('detName').textContent = a.name;
  document.getElementById('upBL').textContent = ic?'New Available Credit':'New Balance';
  document.getElementById('upB').value = '';
  document.getElementById('detGrid').innerHTML = `
    <div style="background:var(--sf2);border-radius:var(--rs);padding:12px">
      <div class="sl" style="margin-bottom:4px">${ic?'Available':'Balance'}</div>
      <div style="font-size:18px;font-weight:700;color:var(--${a.cur.toLowerCase()})">${sym}${fmtN(avail,a.cur)}</div>
    </div>
    <div style="background:var(--sf2);border-radius:var(--rs);padding:12px">
      <div class="sl" style="margin-bottom:4px">${ic?'Limit':'Currency'}</div>
      <div style="font-size:18px;font-weight:700">${ic?sym+fmtN(a.limit||0,a.cur):a.cur}</div>
    </div>`;
  if (ic) {
    const used = a.used||0;
    const pct = (a.limit||0)>0 ? Math.min(100,(used/(a.limit||1))*100) : 0;
    document.getElementById('crBar').style.display='block';
    document.getElementById('crFill').style.width=pct+'%';
    document.getElementById('crUsed').textContent=`Used: ${sym}${fmtN(used,a.cur)}`;
    document.getElementById('crLim').textContent=`Limit: ${sym}${fmtN(a.limit||0,a.cur)}`;
  } else document.getElementById('crBar').style.display='none';
  document.getElementById('upLF').style.display = ic ? 'block' : 'none';
  document.getElementById('upLBtn').style.display = ic ? 'block' : 'none';
  document.getElementById('upL').value = '';
  oSheet('sh-acc-det');
}

async function updBal() {
  const a = S.acc.find(x => x.id===S.eAccId);
  if (!a) return;
  const v = parseFloat(document.getElementById('upB').value);
  if (isNaN(v)) { toast('Enter a valid amount', true); return; }
  if (a.type==='credit') { a.used = Math.max(0,(a.limit||0)-v); a.balance = v; }
  else a.balance = v;
  sv('acc', S.acc);
  if (S.cfg.apiKey && S.cfg.accDbId && a.notionId) {
    try { await nPatchAcc(a); } catch(e) { console.error(e); }
  }
  cSheet('sh-acc-det'); renderAcc(); toast('Balance updated');
}

async function updLim() {
  const a = S.acc.find(x => x.id===S.eAccId);
  if (!a) return;
  const v = parseFloat(document.getElementById('upL').value);
  if (isNaN(v) || v <= 0) { toast('Enter a valid limit', true); return; }
  a.limit = v;
  a.used = Math.max(0, v - (a.balance || 0));
  sv('acc', S.acc);
  if (S.cfg.apiKey && S.cfg.accDbId && a.notionId) {
    try { await nPatchAcc(a); } catch(e) { console.error(e); }
  }
  cSheet('sh-acc-det'); renderAcc(); toast('Limit updated');
}

async function delAcc() {
  const a = S.acc.find(x => x.id===S.eAccId);
  S.acc = S.acc.filter(x => x.id!==S.eAccId);
  sv('acc', S.acc); cSheet('sh-acc-det'); renderAcc(); toast('Account removed');
  if (a?.notionId && S.cfg.apiKey) {
    try {
      await fetch(PROXY + encodeURIComponent(`https://api.notion.com/v1/pages/${a.notionId}`), {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${S.cfg.apiKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ archived: true }),
      });
    } catch(e) { console.error('Del acc:', e.message); }
  }
}

// ─── NOTION API ────────────────────────────────────────
const PROXY = 'https://notion-proxy.reiviennelaxamana.workers.dev/?url=';

async function nPost(url, body) {
  const res = await fetch(PROXY + encodeURIComponent(url), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${S.cfg.apiKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'HTTP '+res.status); }
  return res.json();
}

async function nPatch(url, body) {
  const res = await fetch(PROXY + encodeURIComponent(url), {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${S.cfg.apiKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'HTTP '+res.status); }
  return res.json();
}

function txDateStr(isoTime) {
  const d = new Date(isoTime);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function nSaveTx(tx) {
  const res = await nPost('https://api.notion.com/v1/pages', {
    parent: { database_id: S.cfg.txDbId },
    properties: {
      "Name":     { title: [{ text: { content: tx.catName + (tx.note ? ' — '+tx.note : '') } }] },
      "Amount":   { number: tx.amt },
      "Currency": { select: { name: tx.cur } },
      "Category": { select: { name: tx.catName } },
      "Note":     { rich_text: [{ text: { content: tx.note || '' } }] },
      "Date":     { date: { start: txDateStr(tx.time) } },
      "Type":     { select: { name: tx.type } },
    }
  });
  if (res.id) {
    tx.notionPageId = res.id;
    const key = tx.type === 'income' ? 'inc' : 'exp';
    sv(key, S[key]);
  }
}

async function nPatchTxDate(tx) {
  if (!tx.notionPageId) { await nSaveTx(tx); return; }
  await nPatch(`https://api.notion.com/v1/pages/${tx.notionPageId}`, {
    properties: {
      "Date": { date: { start: txDateStr(tx.time) } },
    }
  });
}

async function nSaveAcc(a) {
  const res = await nPost('https://api.notion.com/v1/pages', {
    parent: { database_id: S.cfg.accDbId },
    properties: {
      "Name":     { title: [{ text: { content: a.name } }] },
      "Type":     { select: { name: a.type } },
      "Currency": { select: { name: a.cur } },
      "Balance":  { number: a.type === 'credit' ? (a.limit||0) - (a.used||0) : (a.balance || 0) },
      "Limit":    { number: a.limit || 0 },
      "Used":     { number: a.used || 0 },
    }
  });
  if (res.id) {
    a.notionId = res.id;
    sv('acc', S.acc);
  }
}

async function nPatchAcc(a) {
  await nPatch(`https://api.notion.com/v1/pages/${a.notionId}`, {
    properties: {
      "Balance": { number: a.type === 'credit' ? (a.limit||0) - (a.used||0) : (a.balance || 0) },
      "Limit":   { number: a.limit || 0 },
      "Used":    { number: a.used || 0 },
    }
  });
}

async function nLoadAccs() {
  const res = await fetch(PROXY + encodeURIComponent('https://api.notion.com/v1/databases/' + S.cfg.accDbId + '/query'), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${S.cfg.apiKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' },
    body: JSON.stringify({ page_size: 100 }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const accs = data.results.map(p => {
    const pr = p.properties;
    const name = pr.Name?.title?.[0]?.plain_text || '';
    const type = (pr.Type?.select?.name || 'bank').toLowerCase();
    const cur  = (pr.Currency?.select?.name || 'JPY').toUpperCase();
    const bal  = pr.Balance?.number ?? 0;
    const lim  = pr.Limit?.number ?? 0;
    const used = pr.Used?.number ?? 0;
    const existing = S.acc.find(a => a.notionId === p.id);
    return { id: existing?.id || ('a' + Date.now() + Math.random().toString(36).slice(2,6)), name, type, cur, balance: bal, limit: lim, used, notionId: p.id };
  });
  S.acc = accs;
  sv('acc', S.acc);
}

async function testConn() {
  const k = document.getElementById('cfgK').value.trim();
  const txId = document.getElementById('cfgTx').value.trim();
  const accId = document.getElementById('cfgAc').value.trim();
  const el = document.getElementById('testResult');
  el.style.display = 'block'; el.style.color = 'var(--t2)'; el.textContent = 'Testing…';
  if (!k) { el.textContent = 'Enter your API key first.'; return; }
  const testDb = async (dbId, label) => {
    if (!dbId) return label + ': (skipped)';
    try {
      const res = await fetch(PROXY + encodeURIComponent('https://api.notion.com/v1/databases/' + dbId), {
        headers: { 'Authorization': 'Bearer ' + k, 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' }
      });
      const data = await res.json();
      if (res.ok) {
        const props = Object.keys(data.properties || {}).join(', ');
        return '✓ ' + label + ': "' + (data.title?.[0]?.plain_text || 'Untitled') + '"\nProps: ' + props;
      } else {
        return '✗ ' + label + ': ' + data.code + ' — ' + data.message;
      }
    } catch(e) { return '✗ ' + label + ': ' + e.message; }
  };
  const results = await Promise.all([testDb(txId, 'Transactions DB'), testDb(accId, 'Accounts DB')]);
  el.style.color = 'var(--t2)';
  el.textContent = results.join('\n\n');
}

// ─── CONFIG ────────────────────────────────────────────
function loadCfg() {
  const c = S.cfg;
  if (c.apiKey)  document.getElementById('cfgK').value   = c.apiKey;
  if (c.txDbId)  document.getElementById('cfgTx').value  = c.txDbId;
  if (c.accDbId) document.getElementById('cfgAc').value  = c.accDbId;
  if (c.base)    document.getElementById('cfgBase').value = c.base;
}

function saveCfg() {
  S.cfg = {
    apiKey:  document.getElementById('cfgK').value.trim(),
    txDbId:  document.getElementById('cfgTx').value.trim(),
    accDbId: document.getElementById('cfgAc').value.trim(),
    base:    document.getElementById('cfgBase').value,
  };
  sv('cfg', S.cfg);
  cSheet('sh-cfg');
  document.getElementById('setupBanner').style.display = (S.cfg.apiKey && S.cfg.txDbId) ? 'none' : 'flex';
  toast('Settings saved');
}

function renderPropLists() {
  const txProps = [
    ['Name','title'],['Amount','number'],['Currency','select'],
    ['Category','select'],['Note','text'],['Date','date'],['Type','select'],
  ];
  const acProps = [
    ['Name','title'],['Type','select'],['Currency','select'],
    ['Balance','number'],['Limit','number'],['Used','number'],
  ];
  const render = (props) => props.map(([n,t]) =>
    `<div class="prop-row"><span style="font-weight:600;color:var(--t)">${n}</span><span style="color:var(--t2);font-size:11px">${t}</span></div>`
  ).join('');
  document.getElementById('propsTx').innerHTML = render(txProps);
  document.getElementById('propsAc').innerHTML = render(acProps);
}

// ─── SHEETS ────────────────────────────────────────────
function oSheet(id) { document.getElementById(id).classList.add('on'); }
function cSheet(id) { document.getElementById(id).classList.remove('on'); }
function overlayClick(e, id) { if (e.target===document.getElementById(id)) cSheet(id); }

// ─── TOAST ─────────────────────────────────────────────
let _tt;
function toast(msg, err=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (err?' err':'') + ' on';
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('on'), 2600);
}

// ─── HELPERS ───────────────────────────────────────────
function fmtN(n, cur) {
  if (cur==='JPY') return Math.round(n||0).toLocaleString();
  return (n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function isToday(d) {
  const n = new Date();
  return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
}

init();
