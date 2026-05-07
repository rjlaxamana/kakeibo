// ─── ANALYSIS STATE ────────────────────────────────────────────────────────
const AN = {
  view: 'month',       // 'month' | 'category'
  month: null,         // '2025-01' string
  catType: 'expense',  // 'expense' | 'income'
  catId: null,
  txCache: null,       // cached Notion transactions
  loading: false,
};

// ─── CHART PALETTE ─────────────────────────────────────────────────────────
const PALETTE = [
  '#e8a0b4','#7ec8a0','#6ab4d4','#f0c070','#c09ee8',
  '#e07878','#70c8c0','#e8b070','#a0c8e8','#d0e870',
  '#e8d0a0','#b4a0e8','#f0a070','#a0e8c8',
];
const CAT_COLORS = {};
[...CATS, ...INC_SOURCES].forEach((c,i) => { CAT_COLORS[c.id] = PALETTE[i % PALETTE.length]; });
const INC_COLOR  = '#7ec8a0';
const EXP_COLOR  = '#e07878';
const NET_POS    = '#6ab4d4';
const NET_NEG    = '#e8a0b4';
const BG_COLOR   = '#0a0a0b';
const SF_COLOR   = '#17171a';
const MUTED      = '#555566';
const TEXT_COLOR = '#e8e8f0';

// ─── NOTION FETCH ALL TXs ──────────────────────────────────────────────────
async function nLoadTxAll() {
  if (!S.cfg.apiKey || !S.cfg.txDbId) throw new Error('Notion not configured');
  let results = [], cursor = undefined;
  do {
    const body = { page_size: 100, sorts: [{ property: 'Date', direction: 'descending' }] };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(PROXY + encodeURIComponent('https://api.notion.com/v1/databases/' + S.cfg.txDbId + '/query'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${S.cfg.apiKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    results = results.concat(data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results.map(p => {
    const pr = p.properties;
    return {
      id: p.id,
      name: pr.Name?.title?.[0]?.plain_text || '',
      amount: pr.Amount?.number ?? 0,
      currency: pr.Currency?.select?.name || 'JPY',
      category: pr.Category?.select?.name || 'Others',
      note: pr.Note?.rich_text?.[0]?.plain_text || '',
      date: pr.Date?.date?.start || null,
      type: (pr.Type?.select?.name || 'expense').toLowerCase(),
    };
  }).filter(t => t.date && t.currency === (S.cfg.base || 'JPY'));
}

// ─── BUILD MONTH KEY ───────────────────────────────────────────────────────
function monthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // '2025-01'
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return MS[parseInt(m)-1] + ' ' + y;
}

function allMonths(txs) {
  const set = new Set(txs.map(t => monthKey(t.date)).filter(Boolean));
  return Array.from(set).sort();
}

// ─── MAIN ANALYSIS RENDER ──────────────────────────────────────────────────
async function renderAnalysis() {
  const container = document.getElementById('anal-content');

  if (!S.cfg.apiKey || !S.cfg.txDbId) {
    container.innerHTML = `<div class="ano-data"><div class="ano-ico">🔗</div><div class="ano-txt">Connect Notion in settings first</div></div>`;
    return;
  }

  if (AN.loading) return;
  AN.loading = true;
  container.innerHTML = `<div class="aload"><div class="aload-ico">⟳</div><div class="aload-txt">Fetching from Notion…</div></div>`;

  try {
    AN.txCache = await nLoadTxAll();
    AN.loading = false;
    const months = allMonths(AN.txCache);
    if (!months.length) {
      container.innerHTML = `<div class="ano-data"><div class="ano-ico">📭</div><div class="ano-txt">No data in Notion</div></div>`;
      return;
    }
    // default to latest month
    if (!AN.month || !months.includes(AN.month)) AN.month = months[months.length - 1];
    if (!AN.catId) AN.catId = CATS[0].id;
    renderAnalysisView();
  } catch(e) {
    AN.loading = false;
    container.innerHTML = `<div class="ano-data"><div class="ano-ico">⚠️</div><div class="ano-txt">${e.message}</div></div>`;
  }
}

function renderAnalysisView() {
  const container = document.getElementById('anal-content');
  const months = allMonths(AN.txCache);
  let html = '';

  // View toggle
  html += `<div class="av-tog">
    <button class="av-btn${AN.view==='month'?' on':''}" onclick="setAnView('month')">By Month</button>
    <button class="av-btn${AN.view==='category'?' on':''}" onclick="setAnView('category')">By Category</button>
  </div>`;

  if (AN.view === 'month') {
    // Month pills
    html += `<div class="mpick" id="mpick-row">` + months.map(m =>
      `<div class="mpill${AN.month===m?' on':''}" onclick="setAnMonth('${m}')">${monthLabel(m)}</div>`
    ).join('') + `</div>`;
    html += `<div id="month-charts-area"></div>`;
  } else {
    // Category type toggle
    html += `<div class="acat-pick"><div class="acat-type-tog">
      <button class="acat-tbtn exp${AN.catType==='expense'?' on':''}" onclick="setAnCatType('expense')">Expense</button>
      <button class="acat-tbtn inc${AN.catType==='income'?' on':''}" onclick="setAnCatType('income')">Income</button>
    </div>
    <div class="acat-grid" id="cat-grid"></div></div>
    <div id="cat-chart-area"></div>`;
  }

  container.innerHTML = html;

  if (AN.view === 'month') {
    renderMonthView(AN.month);
    // scroll to selected pill
    setTimeout(() => {
      const sel = document.querySelector('.mpill.on');
      if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  } else {
    renderCatGrid();
    renderCategoryView();
  }
}

function setAnView(v) { AN.view = v; renderAnalysisView(); }
function setAnMonth(m) { AN.month = m; renderMonthView(m); document.querySelectorAll('.mpill').forEach(p=>p.classList.remove('on')); document.querySelectorAll('.mpill').forEach(p=>{ if(p.textContent===monthLabel(m)) p.classList.add('on'); }); }
function setAnCatType(t) { AN.catType = t; AN.catId = (t==='expense'?CATS:INC_SOURCES)[0].id; renderCatGrid(); renderCategoryView(); }
function setAnCat(id) { AN.catId = id; renderCatGrid(); renderCategoryView(); }

// ─── MONTH VIEW ────────────────────────────────────────────────────────────
function renderMonthView(month) {
  const area = document.getElementById('month-charts-area');
  if (!area) return;
  const txs = AN.txCache.filter(t => monthKey(t.date) === month);
  const exps = txs.filter(t => t.type === 'expense');
  const incs = txs.filter(t => t.type === 'income');
  const totalExp = exps.reduce((s,t) => s+t.amount, 0);
  const totalInc = incs.reduce((s,t) => s+t.amount, 0);
  const net = totalInc - totalExp;

  // Category breakdown
  const catTotals = {};
  exps.forEach(t => {
    const cid = CATS.find(c => c.name===t.category)?.id || 'others';
    catTotals[cid] = (catTotals[cid]||0) + t.amount;
  });
  const sortedCats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const maxCat = sortedCats[0]?.[1] || 1;

  let html = '';

  // Summary cards
  html += `<div class="asum">
    <div class="asumcard">
      <div class="asuml">Total Expense</div>
      <div class="asuma exp">${fmtYen(totalExp)}</div>
    </div>
    <div class="asumcard">
      <div class="asuml">Total Income</div>
      <div class="asuma inc">${fmtYen(totalInc)}</div>
    </div>
    <div class="asumcard wide">
      <div class="asuml">Net Cash Flow</div>
      <div class="asuma ${net>=0?'pos':'neg'}">${net>=0?'+':''}${fmtYen(net)}</div>
    </div>
  </div>`;

  // Progress bars
  if (sortedCats.length) {
    html += `<div class="achart-wrap"><div class="achart-title">Expenses by Category</div><div class="aprog" id="prog-bars">`;
    sortedCats.forEach(([cid, amt]) => {
      const cat = CATS.find(c => c.id === cid) || { icon: '📦', name: cid };
      const pct = totalExp > 0 ? Math.round((amt/totalExp)*100) : 0;
      const fillPct = maxCat > 0 ? (amt/maxCat)*100 : 0;
      html += `<div class="aprog-item">
        <div class="aprog-head">
          <div class="aprog-name">${cat.icon} ${cat.name}<span class="aprog-pct">${pct}%</span></div>
          <div class="aprog-amt">${fmtYen(amt)}</div>
        </div>
        <div class="aprog-bar"><div class="aprog-fill" style="width:${fillPct}%;background:${CAT_COLORS[cid]||PALETTE[0]}"></div></div>
      </div>`;
    });
    html += `</div></div>`;
  } else {
    html += `<div class="ano-data"><div class="ano-ico">🗒</div><div class="ano-txt">No expenses this month</div></div>`;
  }

  // Chart 1: Income vs Expense bar chart
  html += `<div class="achart-wrap">
    <div class="achart-title">Monthly Income vs Expense</div>
    <div class="achart-scroll"><div class="achart-canvas-wrap">
      <canvas class="achart" id="c-incexp" height="220"></canvas>
    </div></div>
  </div>`;

  // Chart 2: Net cash flow
  html += `<div class="achart-wrap">
    <div class="achart-title">Net Cash Flow — All Months</div>
    <div class="achart-scroll"><div class="achart-canvas-wrap">
      <canvas class="achart" id="c-net" height="200"></canvas>
    </div></div>
  </div>`;

  // Charts 3+4: Pie charts
  html += `<div class="achart-wrap">
    <div class="achart-title">All-time Expenses by Category</div>
    <canvas class="achart" id="c-pie-all" height="260"></canvas>
  </div>`;

  html += `<div class="achart-wrap" style="margin-bottom:32px">
    <div class="achart-title">${monthLabel(month)} — Expenses by Category</div>
    <canvas class="achart" id="c-pie-month" height="260"></canvas>
  </div>`;

  area.innerHTML = html;

  // Draw all charts after DOM settles
  requestAnimationFrame(() => {
    drawIncExpChart('c-incexp', AN.txCache, month);
    drawNetChart('c-net', AN.txCache, month);
    const allExp = AN.txCache.filter(t => t.type === 'expense');
    drawPieChart('c-pie-all', buildCatTotals(allExp), 'All-time');
    drawPieChart('c-pie-month', buildCatTotals(exps), monthLabel(month));
  });
}

function buildCatTotals(exps) {
  const totals = {};
  exps.forEach(t => {
    totals[t.category] = (totals[t.category]||0) + t.amount;
  });
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]);
}

// ─── CATEGORY VIEW ─────────────────────────────────────────────────────────
function renderCatGrid() {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  const items = AN.catType === 'expense' ? CATS : INC_SOURCES;
  grid.innerHTML = items.map(c =>
    `<div class="acat-btn${AN.catId===c.id?' on':''}" onclick="setAnCat('${c.id}')">
      <div class="acat-bico">${c.icon}</div>
      <div class="acat-bname">${c.name}</div>
    </div>`
  ).join('');
}

function renderCategoryView() {
  const area = document.getElementById('cat-chart-area');
  if (!area) return;

  const items = AN.catType === 'expense' ? CATS : INC_SOURCES;
  const selCat = items.find(c => c.id === AN.catId);
  if (!selCat) return;

  const months = allMonths(AN.txCache);
  const type = AN.catType;
  const canvasWidth = Math.max(380, months.length * 52 + 60);

  area.innerHTML = `<div class="achart-wrap" style="margin-bottom:32px">
    <div class="achart-title">${selCat.icon} ${selCat.name} vs Other ${type==='expense'?'Expenses':'Income'}</div>
    <div class="achart-scroll"><div class="achart-canvas-wrap" style="min-width:${canvasWidth}px">
      <canvas class="achart" id="c-catstack" height="280" style="width:${canvasWidth}px"></canvas>
    </div></div>
  </div>`;

  requestAnimationFrame(() => {
    drawStackedCatChart('c-catstack', AN.txCache, selCat, type, months, canvasWidth);
  });
}

// ─── CANVAS CHART: INCOME vs EXPENSE ───────────────────────────────────────
function drawIncExpChart(canvasId, txs, highlightMonth) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const months = allMonths(txs);
  const canvasW = Math.max(380, months.length * 72 + 60);
  canvas.width = canvasW * 2; canvas.height = 440;
  canvas.style.width = canvasW + 'px'; canvas.style.height = '220px';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const dpr = 2;

  // Build data
  const incData = months.map(m => txs.filter(t=>t.type==='income'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0));
  const expData = months.map(m => txs.filter(t=>t.type==='expense'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0));
  const maxVal = Math.max(...incData, ...expData, 1);

  const padL = 80, padR = 20, padT = 20, padB = 70;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = (chartW / months.length) * 0.35;

  ctx.fillStyle = SF_COLOR;
  roundRect(ctx, 0, 0, W, H, 20);

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * (1 - i/4));
    ctx.strokeStyle = '#2a2a35'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = `${22}px Nunito`;
    ctx.textAlign = 'right';
    ctx.fillText(fmtYenShort(maxVal * i/4), padL - 8, y + 7);
  }

  // Bars
  months.forEach((m, i) => {
    const cx = padL + (i + 0.5) * (chartW / months.length);
    const isHighlight = m === highlightMonth;

    const incH = (incData[i]/maxVal) * chartH;
    const expH = (expData[i]/maxVal) * chartH;

    ctx.globalAlpha = isHighlight ? 1 : 0.7;
    ctx.fillStyle = INC_COLOR;
    roundRectPath(ctx, cx - barW - 4, padT + chartH - incH, barW, incH, 5);
    ctx.fill();

    ctx.fillStyle = EXP_COLOR;
    roundRectPath(ctx, cx + 4, padT + chartH - expH, barW, expH, 5);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Labels on bars if space
    if (incH > 30) {
      ctx.fillStyle = '#0a0a0b'; ctx.font = `bold ${18}px Nunito`;
      ctx.textAlign = 'center';
      ctx.fillText(fmtYenShort(incData[i]), cx - barW/2 - 4, padT + chartH - incH + 24);
    }
    if (expH > 30) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${18}px Nunito`;
      ctx.textAlign = 'center';
      ctx.fillText(fmtYenShort(expData[i]), cx + barW/2 + 4, padT + chartH - expH + 24);
    }

    // X label
    ctx.fillStyle = isHighlight ? '#e8a0b4' : MUTED;
    ctx.font = `${isHighlight?'bold ':''} ${20}px Nunito`;
    ctx.textAlign = 'center';
    ctx.fillText(monthLabel(m), cx, H - 28);
  });

  // Legend
  ctx.globalAlpha = 1;
  drawLegendDot(ctx, padL, H - 8, INC_COLOR, 'Income');
  drawLegendDot(ctx, padL + 140, H - 8, EXP_COLOR, 'Expense');
}

// ─── CANVAS CHART: NET FLOW ────────────────────────────────────────────────
function drawNetChart(canvasId, txs, highlightMonth) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const months = allMonths(txs);
  const canvasW = Math.max(380, months.length * 68 + 60);
  canvas.width = canvasW * 2; canvas.height = 400;
  canvas.style.width = canvasW + 'px'; canvas.style.height = '200px';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const netData = months.map(m => {
    const inc = txs.filter(t=>t.type==='income'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0);
    const exp = txs.filter(t=>t.type==='expense'&&monthKey(t.date)===m).reduce((s,t)=>s+t.amount,0);
    return inc - exp;
  });

  const maxAbs = Math.max(...netData.map(Math.abs), 1);
  const padL = 80, padR = 20, padT = 20, padB = 70;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const zeroY = padT + chartH / 2;

  ctx.fillStyle = SF_COLOR;
  roundRect(ctx, 0, 0, W, H, 20);

  // Grid
  for (let i = -2; i <= 2; i++) {
    const y = zeroY - (i/2) * (chartH/2);
    ctx.strokeStyle = i===0 ? '#444455' : '#2a2a35';
    ctx.lineWidth = i===0 ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    if (i !== 0) {
      ctx.fillStyle = MUTED; ctx.font = `${20}px Nunito`; ctx.textAlign = 'right';
      ctx.fillText(fmtYenShort(maxAbs * i/2), padL - 8, y + 7);
    }
  }

  const barW = (chartW / months.length) * 0.55;
  // Bars
  months.forEach((m, i) => {
    const v = netData[i];
    const cx = padL + (i + 0.5) * (chartW / months.length);
    const barH = Math.abs(v/maxAbs) * (chartH/2);
    const isPos = v >= 0;
    ctx.fillStyle = isPos ? NET_POS : NET_NEG;
    ctx.globalAlpha = m === highlightMonth ? 1 : 0.7;
    roundRectPath(ctx, cx - barW/2, isPos ? zeroY - barH : zeroY, barW, barH, 4);
    ctx.fill();

    // Value label
    if (barH > 25) {
      ctx.fillStyle = '#0a0a0b'; ctx.font = `bold ${16}px Nunito`; ctx.textAlign = 'center';
      ctx.fillText(fmtYenShort(Math.abs(v)), cx, isPos ? zeroY - barH + 20 : zeroY + barH - 6);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = m === highlightMonth ? '#e8a0b4' : MUTED;
    ctx.font = `${m===highlightMonth?'bold ':''} ${18}px Nunito`; ctx.textAlign = 'center';
    ctx.fillText(monthLabel(m), cx, H - 28);
  });

  // Line
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = TEXT_COLOR; ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  months.forEach((m, i) => {
    const v = netData[i];
    const cx = padL + (i + 0.5) * (chartW / months.length);
    const y = zeroY - (v / maxAbs) * (chartH/2);
    if (i === 0) ctx.moveTo(cx, y); else ctx.lineTo(cx, y);
  });
  ctx.stroke();
  // Dots
  ctx.globalAlpha = 0.8;
  months.forEach((m, i) => {
    const v = netData[i];
    const cx = padL + (i + 0.5) * (chartW / months.length);
    const y = zeroY - (v / maxAbs) * (chartH/2);
    ctx.beginPath(); ctx.arc(cx, y, m===highlightMonth?8:5, 0, Math.PI*2);
    ctx.fillStyle = v>=0 ? NET_POS : NET_NEG; ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── CANVAS CHART: PIE ─────────────────────────────────────────────────────
function drawPieChart(canvasId, catTotals, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const W = 720, H = 520;
  canvas.width = W; canvas.height = H;
  canvas.style.width = '100%'; canvas.style.height = '260px';
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = SF_COLOR;
  roundRect(ctx, 0, 0, W, H, 20);

  const total = catTotals.reduce((s,[,v])=>s+v, 0);
  if (!total) {
    ctx.fillStyle = MUTED; ctx.font = '22px Nunito'; ctx.textAlign = 'center';
    ctx.fillText('No data', W/2, H/2); return;
  }

  const cx = W/2, cy = 140, r = 110, inner = 55;
  let angle = -Math.PI/2;

  const colors = catTotals.map(([cat]) => {
    const cid = CATS.find(c=>c.name===cat)?.id;
    return cid ? (CAT_COLORS[cid]||PALETTE[0]) : '#aaaaaa';
  });

  // Pie slices
  catTotals.forEach(([cat, val], i) => {
    const slice = (val/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    ctx.strokeStyle = BG_COLOR; ctx.lineWidth = 2;
    ctx.stroke();

    // Pct label inside slice if big enough
    const pct = (val/total)*100;
    if (pct >= 5) {
      const midAngle = angle + slice/2;
      const lx = cx + Math.cos(midAngle) * (r * 0.7);
      const ly = cy + Math.sin(midAngle) * (r * 0.7);
      ctx.fillStyle = '#0a0a0b'; ctx.font = 'bold 17px Nunito'; ctx.textAlign = 'center';
      ctx.fillText(pct.toFixed(0)+'%', lx, ly + 5);
    }
    angle += slice;
  });

  // Donut hole
  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI*2);
  ctx.fillStyle = SF_COLOR; ctx.fill();
  // Center total
  ctx.fillStyle = TEXT_COLOR; ctx.font = 'bold 20px Plus Jakarta Sans'; ctx.textAlign = 'center';
  ctx.fillText(fmtYenShort(total), cx, cy + 8);

  // Legend
  const legendY = 260;
  const cols = 2;
  const itemH = 28;
  catTotals.slice(0, 10).forEach(([cat, val], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = 40 + col * (W/2 - 20);
    const ly = legendY + row * itemH;
    ctx.fillStyle = colors[i];
    ctx.beginPath(); ctx.arc(lx + 7, ly, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = TEXT_COLOR; ctx.font = '15px Nunito'; ctx.textAlign = 'left';
    const label = cat.length > 12 ? cat.slice(0,11)+'…' : cat;
    ctx.fillText(label + '  ' + fmtYenShort(val), lx + 18, ly + 5);
  });
}

// ─── CANVAS CHART: STACKED BAR (Category View) ────────────────────────────
function drawStackedCatChart(canvasId, txs, selCat, type, months, canvasW) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const W = canvasW * 2, H = 560;
  canvas.width = W; canvas.height = H;
  canvas.style.width = canvasW + 'px'; canvas.style.height = '280px';
  const ctx = canvas.getContext('2d');

  const items = type === 'expense' ? CATS : INC_SOURCES;
  const filtered = txs.filter(t => t.type === type);

  // For each month: {selCat: X, others: Y}
  const selName = selCat.name;
  const selColor = CAT_COLORS[selCat.id] || PALETTE[0];
  const otherColor = type === 'expense' ? '#e07878' : '#6ab4d4';

  const monthData = months.map(m => {
    const mTxs = filtered.filter(t => monthKey(t.date) === m);
    const selAmt = mTxs.filter(t=>t.category===selName).reduce((s,t)=>s+t.amount,0);
    const othAmt = mTxs.filter(t=>t.category!==selName).reduce((s,t)=>s+t.amount,0);
    return { sel: selAmt, other: othAmt, total: selAmt+othAmt };
  });

  const maxTotal = Math.max(...monthData.map(d=>d.total), 1);
  const padL = 90, padR = 20, padT = 30, padB = 80;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = (chartW / months.length) * 0.6;

  ctx.fillStyle = SF_COLOR;
  roundRect(ctx, 0, 0, W, H, 20);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH * (1 - i/4);
    ctx.strokeStyle = '#2a2a35'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = '22px Nunito'; ctx.textAlign = 'right';
    ctx.fillText(fmtYenShort(maxTotal * i/4), padL - 8, y + 7);
  }

  // Stacked bars
  months.forEach((m, i) => {
    const d = monthData[i];
    const cx = padL + (i + 0.5) * (chartW / months.length);
    const selH = (d.sel/maxTotal) * chartH;
    const othH = (d.other/maxTotal) * chartH;

    // Other (bottom)
    if (othH > 0) {
      ctx.fillStyle = otherColor; ctx.globalAlpha = 0.55;
      const otherY = padT + chartH - othH; 
      roundRectPath(ctx, cx - barW/2, otherY, barW, othH, selH > 0 ? [0,0,4,4] : [4,4,4,4]);
      ctx.fill();
    }
    // Selected cat (top)
    if (selH > 0) {
      ctx.fillStyle = selColor; ctx.globalAlpha = 0.95;
      const topY = padT + chartH - othH - selH;
      roundRectPath(ctx, cx - barW/2, topY, barW, selH, othH > 0 ? [4,4,0,0] : [4,4,4,4]);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Value on selected segment if visible
    if (selH > 30) {
      ctx.fillStyle = '#0a0a0b'; ctx.font = 'bold 17px Nunito'; ctx.textAlign = 'center';
      ctx.fillText(fmtYenShort(d.sel), cx, padT + chartH - othH - selH/2 + 6);
    }

    ctx.fillStyle = MUTED; ctx.font = '20px Nunito'; ctx.textAlign = 'center';
    ctx.fillText(monthLabel(m), cx, H - 30);
  });

  // Legend
  drawLegendDot(ctx, padL, H - 8, selColor, selCat.name);
  drawLegendDot(ctx, padL + 200, H - 8, otherColor, 'Other ' + (type==='expense'?'Expenses':'Income'));
}

// ─── CANVAS HELPERS ────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath(); ctx.fill();
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  if (typeof r === 'number') r = [r,r,r,r]; // [tl,tr,br,bl]
  const [tl,tr,br,bl] = r.map(v=>Math.min(v,Math.abs(h)/2,Math.abs(w)/2));
  ctx.beginPath();
  ctx.moveTo(x+tl, y);
  ctx.lineTo(x+w-tr, y); ctx.quadraticCurveTo(x+w, y, x+w, y+tr);
  ctx.lineTo(x+w, y+h-br); ctx.quadraticCurveTo(x+w, y+h, x+w-br, y+h);
  ctx.lineTo(x+bl, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-bl);
  ctx.lineTo(x, y+tl); ctx.quadraticCurveTo(x, y, x+tl, y);
  ctx.closePath();
}

function drawLegendDot(ctx, x, y, color, label) {
  ctx.beginPath(); ctx.arc(x+8, y-6, 8, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = TEXT_COLOR; ctx.font = '20px Nunito'; ctx.textAlign = 'left';
  ctx.fillText(label, x+22, y);
}

function fmtYen(n) {
  return '¥' + Math.round(n||0).toLocaleString();
}
function fmtYenShort(n) {
  if (n >= 1000000) return '¥' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '¥' + Math.round(n/1000) + 'k';
  return '¥' + Math.round(n);
}
