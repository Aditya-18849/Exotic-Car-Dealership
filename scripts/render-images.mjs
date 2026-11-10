// Renders the social preview image and PNG icons into src/static/.
//  - og-image.png (1200x630): screenshot of scripts/og-template.html via headless Edge or Chrome.
//  - apple-touch-icon.png (180) and favicon-32.png: rasterised in pure Node from the favicon geometry.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = (f) => path.join(root, 'src', 'static', f);

// ---------- PNG icons (same geometry as src/static/favicon.svg, 32x32 units)
const A = [[16, 5], [26, 27], [22.2, 27], [20.3, 22.5], [11.7, 22.5], [9.8, 27], [6, 27]];
const HOLE = [[13, 19.3], [19, 19.3], [16, 12]];
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function colourAt(x, y) {
  if (inPoly(x, y, A) && !inPoly(x, y, HOLE)) return [241, 238, 232];
  if (x >= 10 && x <= 22 && y >= 29 && y <= 30.4) return [201, 169, 110];
  return [10, 10, 11];
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function iconPng(size) {
  const ss = 4, raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const [cr, cg, cb] = colourAt(((px + (sx + .5) / ss) / size) * 32, ((py + (sy + .5) / ss) / size) * 32);
        r += cr; g += cg; b += cb;
      }
      const o = py * (size * 3 + 1) + 1 + px * 3, n = ss * ss;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const [size, name] of [[180, 'apple-touch-icon.png'], [32, 'favicon-32.png']]) {
  fs.writeFileSync(out(name), iconPng(size));
  console.log('wrote', name);
}

// favicon.ico wrapping the 32px PNG (browsers request /favicon.ico on their own).
{
  const png = iconPng(32);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head[6] = 32; head[7] = 32; head[8] = 0; head[9] = 0;
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  fs.writeFileSync(out('favicon.ico'), Buffer.concat([head, png]));
  console.log('wrote favicon.ico');
}

// ---------- Social preview image
if (process.argv.includes('--icons-only')) process.exit(0);
const browser = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].filter(Boolean).find((c) => fs.existsSync(c));
if (!browser) { console.error('No Edge or Chrome found for og-image.png. Set BROWSER=/path/to/browser.'); process.exit(1); }
const profile = path.join(root, '.render-profile');
try {
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=8000', `--screenshot=${out('og-image.png')}`,
    pathToFileURL(path.join(root, 'scripts', 'og-template.html')).href + '#og'], { stdio: 'pipe' });
  console.log('wrote og-image.png');
} finally { fs.rmSync(profile, { recursive: true, force: true }); }
