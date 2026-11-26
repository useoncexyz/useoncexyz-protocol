// Market: follows the market-source register record only. No CA state is read here.
import { register } from './register.js';

const src = register.marketSource;

export async function getJSON(url, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

// Exponential backoff: base, 2x, 4x ...
export async function backoff(fn, tries = 4, base = 700) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { err = e; if (i < tries - 1) await new Promise((r) => setTimeout(r, base * 2 ** i)); }
  }
  throw err;
}

export function bestPair(pairs) {
  return [...(pairs || [])].sort((a, b) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0))[0] || null;
}

export function rowFromPair(pair, fallbackIcon) {
  const b = pair?.baseToken || {};
  return {
    key: b.address || '',
    symbol: b.symbol || '—',
    name: b.name || '—',
    logo: pair?.info?.imageUrl || fallbackIcon || null,
    price: num(pair?.priceUsd),
    change: num(pair?.priceChange?.h24),
    vol: num(pair?.volume?.h24),
    liq: num(pair?.liquidity?.usd)
  };
}
const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export async function loadTrending() {
  const boosts = await backoff(() => getJSON(src.boosts));
  const best = new Map();
  for (const b of Array.isArray(boosts) ? boosts : []) {
    if (b.chainId !== src.chainId || !b.tokenAddress) continue;
    const prev = best.get(b.tokenAddress);
    if (!prev || (b.totalAmount || 0) > (prev.totalAmount || 0)) best.set(b.tokenAddress, b);
  }
  const top = [...best.values()].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0)).slice(0, src.top);
  const out = await Promise.all(top.map(async (b) => {
    try {
      const pairs = await backoff(() => getJSON(src.tokens + b.tokenAddress), 3, 500);
      const row = rowFromPair(bestPair(pairs), b.icon);
      row.key = b.tokenAddress;
      return row;
    } catch {
      return { key: b.tokenAddress, symbol: '—', name: 'Unavailable', logo: b.icon || null, price: null, change: null, vol: null, liq: null };
    }
  }));
  if (!out.length) throw new Error('empty');
  return out;
}
