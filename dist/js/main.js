import { register, isStated, handleOf } from './register.js';
import { GATES, scanDom } from './gates.js';
import { loadTrending } from './market.js';
import { loadOwn } from './own.js';
import { reveal, parallax, progress, spotlight, countTo, reduced } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LOGO = 'brand/once-mark-192.png';

/* ---------- formatting ---------- */
const fmtPrice = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  return '$' + v.toPrecision(3).replace(/e-(\d+)/, (_, n) => '').replace(/0+$/, '');
};
const fmtPriceSafe = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 0.01) return fmtPrice(v);
  if (!(v > 0)) return '$0';
  return '$' + v.toFixed(Math.min(12, Math.max(4, 4 - Math.floor(Math.log10(v))))).replace(/0+$/, '').replace(/\.$/, '');
};
const fmtChange = (v) => (v === null || v === undefined ? '—' : (v >= 0 ? '▲ +' : '▼ −') + Math.abs(v).toFixed(2) + '%');
const fmtMoney = (v) => {
  if (v === null || v === undefined) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
};
const fmtInt = (v) => Math.round(v).toLocaleString('en-US');

/* ---------- register -> DOM (gates) ---------- */
function applyCA() {
  const r = register.ca;
  const live = isStated(r) && !!r.value;
  const root = $('[data-slot="ca"]');
  root.dataset.state = live ? 'stated' : r.state;
  const btn = $('[data-ca-btn]', root);
  const txt = $('[data-ca-text]', root);
  $$('[data-ca-mirror]').forEach((m) => { m.textContent = live ? r.value : 'Not announced yet'; m.dataset.state = live ? 'stated' : 'absent'; });
  txt.textContent = live ? r.value : 'Not announced yet';
  btn.disabled = !live;
  btn.setAttribute('aria-disabled', String(!live));
  btn.setAttribute('aria-label', live ? 'Copy contract address' : 'Contract address not announced yet');
  $('[data-ca-hint]', root).textContent = live ? 'Click to copy' : 'Inert until stated';
  if (!live) return;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(r.value); }
    catch {
      const t = document.createElement('textarea'); t.value = r.value; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch {} t.remove();
    }
    root.classList.add('copied');
    $('[data-ca-hint]', root).textContent = 'Copied';
    $('[data-ca-live]').textContent = 'Contract address copied';
    setTimeout(() => { root.classList.remove('copied'); $('[data-ca-hint]', root).textContent = 'Click to copy'; $('[data-ca-live]').textContent = ''; }, 1800);
  });
}

function applyLinks() {
  for (const a of $$('[data-link]')) {
    const rec = register[a.dataset.link];
    const handle = rec && rec.url ? handleOf(rec.url) : null;
    if (isStated(rec) && rec.url) {
      a.href = rec.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.removeAttribute('aria-disabled'); a.dataset.state = 'stated';
      const base = a.dataset.label || a.dataset.link;
      a.setAttribute('aria-label', handle ? `${base} ${handle}` : base);
    } else {
      a.removeAttribute('href'); a.removeAttribute('target');
      a.setAttribute('aria-disabled', 'true'); a.dataset.state = rec ? rec.state : 'absent';
      a.setAttribute('aria-label', `${a.dataset.label || a.dataset.link}, not announced yet`);
    }
  }
}

/* ---------- board ---------- */
const store = { trend: null, own: null, ownFailed: false, trendFailed: false };
const cache = new Map(); // key -> { el, v }
const rowsEl = $('[data-rows]');

function tile(row) {
  const t = document.createElement('span'); t.className = 'tile';
  const letter = () => { t.textContent = (row.symbol && row.symbol !== '—' ? row.symbol : row.name || '?').trim().charAt(0).toUpperCase() || '?'; t.classList.add('letter'); };
  if (row.logo) {
    const img = new Image(); img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); letter(); };
    img.src = row.logo; t.appendChild(img);
  } else if (row.brand) {
    const img = new Image(); img.alt = ''; img.src = LOGO; img.className = 'brand'; t.appendChild(img);
  } else letter();
  return t;
}

function makeRow(row) {
  const el = document.createElement('div');
  el.className = 'row' + (row.own ? ' own' : '') + (row.placeholder ? ' placeholder' : '');
  el.setAttribute('role', 'row');
  el.setAttribute('data-spot', '');
  const cell = (cls, label) => { const c = document.createElement('span'); c.className = 'c ' + cls; c.dataset.label = label; c.setAttribute('role', 'cell'); return c; };
  const rk = cell('rk', '#'); const tk = cell('tk', 'Token'); const pr = cell('pr', 'Price'); const ch = cell('ch', '24h'); const vo = cell('vo', 'Volume 24h'); const li = cell('li', 'Liquidity');
  tk.append(tile(row));
  const nm = document.createElement('span'); nm.className = 'nm';
  nm.innerHTML = '<b class="sym"></b><i class="full"></i>'; tk.append(nm);
  el.append(rk, tk, pr, ch, vo, li);
  return { el, cells: { rk, tk, pr, ch, vo, li, sym: $('.sym', nm), full: $('.full', nm) }, v: { price: null, change: null, vol: null, liq: null } };
}

function paintRow(entry, row, rank) {
  const { cells, v } = entry;
  cells.rk.textContent = String(rank);
  cells.sym.textContent = row.placeholder ? 'ONCE' : row.symbol;
  cells.full.textContent = row.placeholder ? 'Contract pending' : row.name;
  if (row.placeholder) {
    for (const k of ['pr', 'ch', 'vo', 'li']) cells[k].textContent = '· · · · ·';
    return;
  }
  countTo(cells.pr, v.price, row.price, fmtPriceSafe);
  countTo(cells.ch, v.change, row.change, fmtChange);
  cells.ch.dataset.dir = row.change === null ? '' : row.change >= 0 ? 'up' : 'down';
  countTo(cells.vo, v.vol, row.vol, fmtMoney);
  countTo(cells.li, v.liq, row.liq, fmtMoney);
  v.price = row.price; v.change = row.change; v.vol = row.vol; v.liq = row.liq;
}

function ownGate() { return GATES.find((g) => g.id === 'G3-own-row').run(register); }

function desiredRows() {
  const out = [];
  const mode = ownGate();
  if (mode === 'live') {
    const ca = register.ca.value;
    out.push(store.own || { key: 'own:' + ca, own: true, symbol: '—', name: store.ownFailed ? 'Source unreachable' : 'Loading', logo: null, brand: true, price: null, change: null, vol: null, liq: null });
    if (store.own && !store.own.logo) out[0] = { ...store.own, brand: true };
    (store.trend || []).filter((t) => t.key !== ca).forEach((t) => out.push(t));
  } else {
    out.push({ key: 'own:placeholder', own: true, placeholder: true, brand: true });
    (store.trend || []).forEach((t) => out.push(t));
  }
  return out;
}

function paintBoard() {
  const list = desiredRows();
  const skel = $$('.row.skeleton', rowsEl);
  const firstReal = skel.length && (store.trend || store.own);
  if (firstReal || (store.trendFailed && !store.trend)) skel.forEach((s) => s.remove());
  const seen = new Set();
  let prev = null;
  list.forEach((row, i) => {
    seen.add(row.key);
    let entry = cache.get(row.key);
    if (!entry || entry.placeholder !== !!row.placeholder) {
      if (entry) entry.el.remove();
      entry = makeRow(row); entry.placeholder = !!row.placeholder; cache.set(row.key, entry);
      entry.el.classList.add('enter'); entry.el.style.setProperty('--i', i);
    } else if (row.own && row.logo && !$('.tile img:not(.brand)', entry.el)) {
      const old = $('.tile', entry.cells.tk); old.replaceWith(tile(row));
    }
    paintRow(entry, row, i + 1);
    const at = prev ? prev.nextSibling : rowsEl.firstChild;
    if (entry.el !== at) rowsEl.insertBefore(entry.el, at);
    prev = entry.el;
  });
  for (const [k, e] of cache) if (!seen.has(k)) { e.el.remove(); cache.delete(k); }
  // failed and nothing to show: dashes
  const err = $('[data-error]');
  if (store.trendFailed && !store.trend) {
    err.hidden = false;
    if (!$('.row.dash', rowsEl)) for (let i = 0; i < 3; i++) {
      const d = document.createElement('div'); d.className = 'row dash'; d.innerHTML = '<span class="c rk">—</span><span class="c tk"><span class="tile letter">—</span><span class="nm"><b class="sym">—</b><i class="full">—</i></span></span><span class="c pr">—</span><span class="c ch">—</span><span class="c vo">—</span><span class="c li">—</span>';
      rowsEl.appendChild(d);
    }
  } else { err.hidden = true; $$('.row.dash', rowsEl).forEach((d) => d.remove()); }
  paintTicker(); paintNumbers(); status();
  scan();
}

function paintTicker() {
  const track = $('[data-track]');
  const t = store.trend;
  if (!t) return;
  const item = (r) => `<span class="tick"><span class="tile"></span><b>${esc(r.symbol)}</b><span>${fmtPriceSafe(r.price)}</span><em data-dir="${r.change === null ? '' : r.change >= 0 ? 'up' : 'down'}">${fmtChange(r.change)}</em></span>`;
  const html = t.map(item).join('');
  track.innerHTML = html + html;
  const tiles = $$('.tile', track);
  tiles.forEach((tl, i) => { const row = t[i % t.length]; tl.replaceWith(tile(row)); });
  track.parentElement.dataset.ready = 'true';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const numState = { n: null, v: null };
function paintNumbers() {
  const t = store.trend;
  if (!t) return;
  const vol = t.reduce((s, r) => s + (r.vol || 0), 0);
  const nEl = $('[data-num="tokens"]'), vEl = $('[data-num="volume"]');
  countTo(nEl, numState.n, t.length, fmtInt); countTo(vEl, numState.v, vol, fmtMoney);
  $('[data-hero-tokens]').textContent = String(t.length);
  const up = t.filter((r) => r.change !== null && r.change >= 0).length, dn = t.filter((r) => r.change !== null && r.change < 0).length;
  const bar = $('[data-tug]');
  if (up + dn) { bar.classList.remove('empty'); $('.tug-up', bar).style.flexGrow = up || 0.001; $('.tug-down', bar).style.flexGrow = dn || 0.001; }
  $('[data-tug-up]').textContent = up + ' rising'; $('[data-tug-down]').textContent = dn + ' falling';
  numState.n = t.length; numState.v = vol;
  $$('[data-skel]').forEach((e) => e.classList.remove('skel'));
}

function status() {
  const s = $('[data-status]');
  const bad = store.trendFailed;
  s.dataset.state = bad ? (store.trend ? 'stale' : 'down') : store.trend ? 'live' : 'wait';
  $('[data-status-text]').textContent = bad ? (store.trend ? 'Source slow, last read kept' : 'Source offline') : store.trend ? 'Board live' : 'Connecting';
}

function scan() {
  const bad = scanDom(document.body, register);
  document.documentElement.dataset.addressScan = bad.length ? 'flagged:' + bad.length : 'clean';
  if (bad.length) console.warn('[gate] address-shaped strings outside the stated registry:', bad);
}

/* ---------- polling: 60 s, paused while hidden, immediate on visible ---------- */
let timer = null, inflight = false;
async function cycle() {
  if (inflight) return; inflight = true;
  const tasks = [
    loadTrending().then((t) => { store.trend = t; store.trendFailed = false; }).catch(() => { store.trendFailed = true; })
  ];
  if (ownGate() === 'live') {
    tasks.push(loadOwn(register.ca.value).then((o) => { store.own = o; store.ownFailed = false; }).catch(() => { store.ownFailed = true; }));
  }
  await Promise.allSettled(tasks);
  inflight = false;
  paintBoard();
  schedule();
}
function schedule() { clearTimeout(timer); if (!document.hidden) timer = setTimeout(cycle, register.marketSource.pollMs); }
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else { clearTimeout(timer); cycle(); } });

/* ---------- boot ---------- */
applyCA();
applyLinks();
progress($('[data-progress]'));
spotlight();
parallax($('[data-hero]'));
reveal();
paintBoard();
status();
cycle();
scan();

// Harness handle: anchors read the current record at runtime, never a hard-coded state.
window.__once = { register, gates: GATES, reduced, store };
