import { isStated } from './register.js';

export const BASE58 = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
export const HEX40 = /\b0x[0-9a-fA-F]{40}\b/g;

// Each gate is a pure function of a register snapshot, so a harness can feed it any state.
export const GATES = [
  { id: 'G1-ca-slot', run: (r) => (isStated(r.ca) && !!r.ca.value ? 'copyable' : 'inert') },
  { id: 'G2-ca-shape', run: (r) => (isStated(r.ca) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.ca.value || '') ? 'valid' : 'none') },
  { id: 'G3-own-row', run: (r) => (isStated(r.ca) && !!r.ca.value ? 'live' : 'placeholder') },
  { id: 'G4-link-x', run: (r) => (isStated(r.x) && !!r.x.url ? 'href' : 'inert') },
  { id: 'G5-link-github', run: (r) => (isStated(r.github) && !!r.github.url ? 'href' : 'inert') },
  { id: 'G6-address-scan', run: (r) => {
    const fake = '0x' + 'ab12'.repeat(10);
    const rejectsUnknown = scanText(fake, r).length === 1;
    const passesStated = !r.ca.value || scanText(r.ca.value, r).length === 0;
    return rejectsUnknown && passesStated ? 'registry-match' : 'broken';
  } },
  { id: 'G7-market-independent', run: () => 'source-record-only' },
  { id: 'G8-pump-parallel', run: (r) => (isStated(r.ownSource) ? 'parallel' : 'off') }
];

// Registry of addresses the page may legitimately name: stated records only.
export function statedAddresses(r) {
  const out = new Set();
  if (isStated(r.ca) && r.ca.value) out.add(r.ca.value.toLowerCase());
  return out;
}

// Gate warning: never blanket-reject 0x hex. Every address-shaped string is matched to the stated registry.
export function scanText(text, r) {
  const ok = statedAddresses(r);
  const hits = [...(text.match(BASE58) || []), ...(text.match(HEX40) || [])];
  return hits.filter((h) => !ok.has(h.toLowerCase()) && /[0-9]/.test(h) && /[a-zA-Z]/.test(h) && !/^[a-z]+$/i.test(h));
}

// Scan the rendered DOM; the CA slot is exempt (it is the registry value itself).
export function scanDom(root, r) {
  const bad = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentElement && n.parentElement.closest('[data-ca-exempt]')) continue;
    for (const h of scanText(n.nodeValue, r)) bad.push(h);
  }
  return bad;
}
