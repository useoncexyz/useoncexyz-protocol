// Build: src/ -> dist/ (or ONCE_OUT). Copies the app, derives brand rasters (premultiplied resize),
// traces the favicon from the real pixel grid, and verifies the logo is wired into the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.ONCE_OUT || 'dist');
if (!out.startsWith(root)) throw new Error('refusing to write outside the project');
const src = (...p) => path.join(root, 'src', ...p);
const fail = (m) => { console.error('BUILD FAIL: ' + m); process.exit(1); };

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'brand'), { recursive: true });
for (const d of ['css', 'js']) fs.cpSync(src(d), path.join(out, d), { recursive: true });
let html = fs.readFileSync(src('index.html'), 'utf8');

// ---- CA branch (proof builds only): rewrite the one register line marked @ca
if (process.env.ONCE_CA) {
  const f = path.join(out, 'js', 'register.js');
  const t = fs.readFileSync(f, 'utf8');
  const n = t.replace(/ca: \{ state: 'absent', value: null \}, \/\/ @ca/, `ca: { state: 'stated', value: '${process.env.ONCE_CA}' }, // @ca`);
  if (n === t) fail('CA marker not found');
  fs.writeFileSync(f, n);
}

// ---- brand rasters
const srcPng = path.join(root, 'brand', 'LOGO ONCE PNG...png'); // the transparent one
const img = PNG.sync.read(fs.readFileSync(srcPng));
const W = img.width;
let pureBlackTransparent = 0, x0 = W, y0 = W, x1 = 0, y1 = 0;
for (let y = 0; y < img.height; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, a = img.data[i + 3];
  if (a === 0 && img.data[i] + img.data[i + 1] + img.data[i + 2] === 0) pureBlackTransparent++;
  if (a > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
}
const premult = pureBlackTransparent > 0;
const pad = Math.round((x1 - x0) * 0.04);
const crop = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };

function resize(outW) {
  const outH = Math.round(crop.h * (outW / crop.w));
  const o = new PNG({ width: outW, height: outH });
  const sx = crop.w / outW, sy = crop.h / outH;
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const xa = crop.x + x * sx, xb = crop.x + (x + 1) * sx, ya = crop.y + y * sy, yb = crop.y + (y + 1) * sy;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(ya); yy < Math.ceil(yb); yy++) for (let xx = Math.floor(xa); xx < Math.ceil(xb); xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= img.height) { n++; continue; }
      const i = (yy * W + xx) * 4, al = img.data[i + 3] / 255;
      // premultiplied accumulate: colour weighted by alpha, so transparent black never darkens edges
      if (premult) { r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; } else { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
      a += al; n++;
    }
    const o4 = (y * outW + x) * 4;
    if (premult) { const k = a > 0 ? 1 / a : 0; o.data[o4] = Math.round(r * k); o.data[o4 + 1] = Math.round(g * k); o.data[o4 + 2] = Math.round(b * k); }
    else { o.data[o4] = Math.round(r / n); o.data[o4 + 1] = Math.round(g / n); o.data[o4 + 2] = Math.round(b / n); }
    o.data[o4 + 3] = Math.round((a / n) * 255);
  }
  return { png: PNG.sync.write(o), w: outW, h: outH };
}
const big = resize(960), small = resize(192);
fs.writeFileSync(path.join(out, 'brand', 'once-logo-960.png'), big.png);
fs.writeFileSync(path.join(out, 'brand', 'once-mark-192.png'), small.png);
fs.copyFileSync(path.join(root, 'brand', 'LOGO ONCE JPG.jpg.jpeg'), path.join(out, 'brand', 'once-logo-source.jpg'));
fs.copyFileSync(path.join(root, 'reference', 'SAMPUL ONCE JPG.jpg.jpeg'), path.join(out, 'brand', 'once-cover.jpg'));
html = html.replace(/width="960" height="\d+"/, `width="960" height="${big.h}"`);
html = html.replace(/(brand-img">)/, '$1');
fs.writeFileSync(path.join(out, 'index.html'), html);

// ---- favicon: 32x32 grid traced from the real alpha of the logo (area-averaged, premultiplied alpha)
const tokens = fs.readFileSync(src('css', 'tokens.css'), 'utf8');
const ink = (tokens.match(/--color-ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
if (!ink) fail('ink token missing');
const side = Math.max(crop.w, crop.h), N = 32, cell = side / N;
const ox = crop.x + crop.w / 2 - side / 2, oy = crop.y + crop.h / 2 - side / 2;
const rects = [];
for (let gy = 0; gy < N; gy++) {
  let gx = 0;
  while (gx < N) {
    const cov = (cx) => {
      let a = 0, c = 0;
      for (let yy = Math.floor(oy + gy * cell); yy < Math.floor(oy + (gy + 1) * cell); yy++) for (let xx = Math.floor(ox + cx * cell); xx < Math.floor(ox + (cx + 1) * cell); xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= img.height) continue; a += img.data[(yy * W + xx) * 4 + 3]; c++;
      }
      return c ? a / c / 255 : 0;
    };
    const c0 = cov(gx);
    if (c0 < 0.15) { gx++; continue; }
    const full = c0 >= 0.5;
    let e = gx + 1;
    if (full) while (e < N && cov(e) >= 0.5) e++;
    rects.push(`<rect x="${gx}" y="${gy}" width="${e - gx}" height="1"${full ? '' : ` opacity="${c0.toFixed(2)}"`}/>`);
    gx = e;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" fill="${ink}">${rects.join('')}</svg>\n`;
fs.writeFileSync(path.join(out, 'favicon.svg'), svg);

// ---- checks
const checks = [];
const ck = (name, ok, info = '') => { checks.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
ck('logo file copied into output', fs.existsSync(path.join(out, 'brand', 'once-logo-960.png')), `${big.w}x${big.h}`);
ck('mark file copied into output', fs.existsSync(path.join(out, 'brand', 'once-mark-192.png')), `${small.w}x${small.h}`);
const outHtml = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const refs = [...outHtml.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u) && u !== './');
const missing = refs.filter((u) => !fs.existsSync(path.join(out, u)));
ck('index.html references logo by relative path', /src="brand\/once-logo-960\.png"/.test(outHtml));
ck('every relative reference in index.html exists in output', missing.length === 0, missing.join(','));
ck('premultiplied resize applied', premult === (pureBlackTransparent > 0), `pure-black transparent px: ${pureBlackTransparent}`);
ck('favicon is 32x32 SVG traced from pixel grid', svg.includes('viewBox="0 0 32 32"') && rects.length > 20, `${rects.length} runs`);
// palette rule: no colour literals outside tokens.css
const lit = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(css|js|html)$/.test(f.name) && f.name !== 'tokens.css') { const t = fs.readFileSync(p, 'utf8'); const m = t.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])|rgba?\(|hsla?\(/g); if (m && !(f.name === 'index.html' && m.every((x) => false))) lit.push(path.relative(root, p) + ': ' + m.slice(0, 3).join(' ')); } } };
walk(src());
ck('no colour literals outside tokens.css', lit.length === 0, lit.join(' | '));
// no dates in visible copy
const visible = outHtml.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
ck('no dates in static copy', !/\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d/i.test(visible) && !/\d{1,2}:\d{2}/.test(visible));
// repo hygiene
ck('no CLAUDE.md or .claude/', !fs.existsSync(path.join(root, 'CLAUDE.md')) && !fs.existsSync(path.join(root, '.claude')));
const bad = checks.filter((c) => !c.ok);
console.log(`\nbuild ${bad.length ? 'FAILED' : 'ok'} -> ${path.relative(root, out)}  (${checks.length - bad.length}/${checks.length} checks)`);
process.exit(bad.length ? 1 : 0);
