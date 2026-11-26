// Own token: DexScreener and pump.fun are fetched in parallel; neither blocks the other.
import { register } from './register.js';
import { getJSON, backoff, bestPair, rowFromPair } from './market.js';

export async function loadOwn(ca) {
  const s = register.ownSource;
  const [dex, pump] = await Promise.allSettled([
    backoff(() => getJSON(s.dex + ca), 3, 600),
    backoff(() => getJSON(s.pump + ca), 2, 600)
  ]);
  const pair = dex.status === 'fulfilled' ? bestPair(dex.value?.pairs) : null;
  const pf = pump.status === 'fulfilled' ? pump.value : null;
  if (!pair && !pf) throw new Error('own token: no source answered');
  const row = pair ? rowFromPair(pair) : { symbol: '—', name: '—', logo: null, price: null, change: null, vol: null, liq: null };
  row.key = ca;
  row.own = true;
  // logo order: pump.fun image_uri -> DexScreener -> brand folder (null here) -> letter tile
  row.logo = (pf && pf.image_uri) || (pair && pair.info && pair.info.imageUrl) || null;
  if (pf) { row.symbol = row.symbol === '—' ? pf.symbol || '—' : row.symbol; row.name = row.name === '—' ? pf.name || '—' : row.name; }
  return row;
}
