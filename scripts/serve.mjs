// Minimal static server for local preview. Mirrors production clean URLs
// (/inventory/ -> /inventory/index.html) and applies the headers from dist/_headers.
// Usage: node scripts/serve.mjs [dir] [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4321);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function globalHeaders() {
  // Reads the "/*" block of a Netlify/Cloudflare style _headers file.
  try {
    const raw = fs.readFileSync(path.join(root, '_headers'), 'utf8');
    const out = {};
    let inGlobal = false;
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (!/^\s/.test(line)) { inGlobal = line.trim() === '/*'; continue; }
      if (inGlobal) {
        const i = line.indexOf(':');
        out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    }
    return out;
  } catch { return {}; }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Local stand-in for a form service, for testing the success path only.
  if (req.method === 'POST' && url.pathname === '/__mock-form') {
    let size = 0;
    req.on('data', (c) => { size += c.length; });
    req.on('end', () => {
      console.log('[mock-form] received', size, 'bytes');
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
    });
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  let file = path.join(root, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + url.search }).end(); return; }
    file = path.join(file, 'index.html');
  }
  let status = 200;
  if (!fs.existsSync(file)) { file = path.join(root, '404.html'); status = 404; }
  if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(status, {
    ...globalHeaders(),
    'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
