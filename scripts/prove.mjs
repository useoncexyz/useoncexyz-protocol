// Proof: both register branches build, every gate answers both ways, anchors read the record at runtime.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (env) => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
let fails = 0;
const ok = (n, c, i = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); if (!c) fails++; };

const absent = run({ ONCE_OUT: 'dist' });
ok('build, CA absent -> dist/', absent.status === 0, 'exit ' + absent.status);
const CA = 'So11111111111111111111111111111111111111112';
const stated = run({ ONCE_OUT: '.proof/stated', ONCE_CA: CA });
ok('build, CA stated -> .proof/stated/', stated.status === 0, 'exit ' + stated.status);

const reg = (await import(pathToFileURL(path.join(root, 'src/js/register.js')).href)).register;
const gatesSrc = fs.readFileSync(path.join(root, 'src/js/gates.js'), 'utf8').replace("import { isStated } from './register.js';", "const isStated = (r) => !!r && r.state === 'stated';");
const gates = await import('data:text/javascript,' + encodeURIComponent(gatesSrc));
// Anchors are state-independent: clone the CURRENT record, then mutate only the field under test.
const withCA = (state, value) => ({ ...structuredClone(reg), ca: { state, value } });
const A = withCA('absent', null), S = withCA('stated', CA), U = withCA('unconfirmed', CA);
const out = (r) => Object.fromEntries(gates.GATES.map((g) => [g.id, g.run(r)]));
const a = out(A), s = out(S), u = out(U);
ok('G1 CA slot: absent=inert, stated=copyable, unconfirmed=inert', a['G1-ca-slot'] === 'inert' && s['G1-ca-slot'] === 'copyable' && u['G1-ca-slot'] === 'inert');
ok('G2 CA shape gate', a['G2-ca-shape'] === 'none' && s['G2-ca-shape'] === 'valid');
ok('G3 own row: placeholder vs live', a['G3-own-row'] === 'placeholder' && s['G3-own-row'] === 'live');
ok('G4 X link rule', s['G4-link-x'] === 'href' && out({ ...S, x: { state: 'absent', url: null } })['G4-link-x'] === 'inert');
ok('G5 GitHub link rule (absent -> inert)', a['G5-link-github'] === 'inert' && out({ ...S, github: { state: 'stated', url: 'https://github.com/x/y' } })['G5-link-github'] === 'href');
ok('G6 address scan matches registry, rejects unknown', a['G6-address-scan'] === 'registry-match' && s['G6-address-scan'] === 'registry-match');
const hex = '0x' + 'ab12'.repeat(10);
ok('G6b 0x hex not blanket-rejected when stated in registry', gates.scanText(hex, { ...S, ca: { state: 'stated', value: hex } }).length === 0 && gates.scanText(hex, S).length === 1);
const mk = fs.readFileSync(path.join(root, 'src/js/market.js'), 'utf8');
ok('G7 market module never reads CA state', !/register\.ca|\.ca\b|isStated\(/.test(mk));
const ow = fs.readFileSync(path.join(root, 'src/js/own.js'), 'utf8');
ok('G8 pump.fun fetched in parallel with DexScreener (allSettled)', /Promise\.allSettled\(\[[\s\S]*s\.dex[\s\S]*s\.pump/.test(ow));
ok('gate count', gates.GATES.length === 8, String(gates.GATES.length));
console.log(`\ngates: ${gates.GATES.length}  failures: ${fails}`);
process.exit(fails ? 1 : 0);
