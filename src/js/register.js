// REGISTER: every external fact is one record. state: 'stated' | 'absent' | 'unconfirmed'.
// Absent and unconfirmed records render inert. Nothing else in the project holds these facts.
export const register = {
  name: { state: 'stated', value: 'Once' },
  domain: { state: 'stated', value: 'useonce.xyz' },
  chain: { state: 'stated', value: 'Solana mainnet', rpc: 'https://solana-rpc.publicnode.com' },
  ca: { state: 'absent', value: null }, // @ca
  x: { state: 'stated', url: 'https://x.com/useoncexyz' },
  github: { state: 'absent', url: null },
  marketSource: {
    state: 'stated',
    boosts: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokens: 'https://api.dexscreener.com/tokens/v1/solana/',
    chainId: 'solana',
    top: 10,
    pollMs: 60000
  },
  ownSource: {
    state: 'stated',
    dex: 'https://api.dexscreener.com/latest/dex/tokens/',
    pump: 'https://frontend-api.pump.fun/coins/'
  }
};

export const isStated = (rec) => !!rec && rec.state === 'stated';

// Link rule: the URL is stored, the handle is derived. No href for an unstated record.
export function handleOf(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : null;
  } catch { return null; }
}
