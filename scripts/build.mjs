// A-SPECS static site build. Zero dependencies.
//   node scripts/build.mjs           production build from src/data/vehicles.json
//   node scripts/build.mjs --demo    development build with clearly labelled sample cars
//   node scripts/build.mjs --strict  production build that fails on launch blockers
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const DEMO = process.argv.includes('--demo');
const STRICT = process.argv.includes('--strict');

const config = JSON.parse(fs.readFileSync(path.join(SRC, 'config.json'), 'utf8'));
const vehiclesFile = DEMO ? 'vehicles.demo.json' : 'vehicles.json';
const vehicles = JSON.parse(fs.readFileSync(path.join(SRC, 'data', vehiclesFile), 'utf8'));
const C = config.contact || {};
const BRAND = config.brand;
// SITE_URL env var overrides config (useful for staging builds).
const SITE_URL = process.env.SITE_URL || config.siteUrl;
const SITE = SITE_URL ? SITE_URL.replace(/\/+$/, '') : null;
const INDEXABLE = !!SITE && !DEMO;
const SELL = !!(config.services && config.services.sellYourCar);
// FORM_ENDPOINT env var overrides config (used for local testing against a mock endpoint).
const FORM_ENDPOINT = process.env.FORM_ENDPOINT || (config.forms && config.forms.endpoint) || '';
const FORM_KEY = (config.forms && config.forms.accessKey) || '';
const UPDATED = '9 November 2026';

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const abs = (p) => (SITE ? SITE + p : p);
const nfIN = new Intl.NumberFormat('en-IN');
const fmtKm = (n) => nfIN.format(n) + ' km';
function fmtPrice(n) {
  if (n == null) return null;
  const trim = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  if (n >= 1e7) return '₹' + trim(n / 1e7) + ' Crore';
  if (n >= 1e5) return '₹' + trim(n / 1e5) + ' Lakh';
  return '₹' + nfIN.format(n);
}
const fmtPriceFull = (n) => (n == null ? null : '₹' + nfIN.format(n));
const digits = (s) => String(s || '').replace(/\D/g, '');
const telHref = (s) => 'tel:+' + digits(s);
const waHref = (text) => (C.whatsapp ? 'https://wa.me/' + digits(C.whatsapp) + (text ? '?text=' + encodeURIComponent(text) : '') : null);
const vName = (v) => `${v.year} ${v.make} ${v.model}${v.variant ? ' ' + v.variant : ''}`;
const vShort = (v) => `${v.make} ${v.model}`;
const statusLabel = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };

function isUnsplash(src) { return /^https:\/\/images\.unsplash\.com\//.test(src); }
function imgUrl(src, w) { return isUnsplash(src) ? `${src}?w=${w}&q=72&auto=format&fit=crop` : src; }
function srcset(src, widths = [480, 800, 1200, 1600, 2000]) {
  return isUnsplash(src) ? widths.map((w) => `${imgUrl(src, w)} ${w}w`).join(', ') : '';
}
function img({ src, alt, sizes, w = 1600, h = 1000, eager = false, cls = '' }) {
  const ss = srcset(src);
  return `<img src="${esc(imgUrl(src, 1200))}"${ss ? ` srcset="${esc(ss)}" sizes="${esc(sizes || '100vw')}"` : ''} alt="${esc(alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${cls ? ` class="${cls}"` : ''}>`;
}

const I = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="m3 6 9 7 9-7"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3Z"/></svg>',
};

const CATEGORIES = [
  { id: 'luxury-sedan', name: 'Luxury sedans', desc: 'Executive saloons built for the back seat and the long drive.' },
  { id: 'luxury-suv', name: 'Luxury SUVs', desc: 'Full-size and performance SUVs with space, comfort and presence.' },
  { id: 'sports', name: 'Sports cars', desc: 'Coupes and convertibles set up for the open road.' },
  { id: 'performance', name: 'Performance cars', desc: 'High-output saloons, estates and coupes from the performance divisions.' },
  { id: 'supercar', name: 'Supercars', desc: 'Mid-engined machines at the sharp end of the market.' },
  { id: 'exotic', name: 'Exotics', desc: 'Rare, limited and collectible automobiles.' },
];
const catName = (id) => (CATEGORIES.find((c) => c.id === id) || { name: id }).name;

// ---------------------------------------------------------------- validate data
const problems = [];
const seen = new Set();
for (const v of vehicles) {
  for (const k of ['slug', 'make', 'model', 'year', 'km', 'fuel', 'transmission', 'category', 'bodyType', 'status', 'listedOn', 'images']) {
    if (v[k] == null || v[k] === '') problems.push(`Vehicle ${v.slug || v.id || '?'}: missing "${k}"`);
  }
  if (!/^[a-z0-9-]+$/.test(v.slug || '')) problems.push(`Vehicle ${v.slug}: slug must be lowercase letters, numbers and hyphens`);
  if (seen.has(v.slug)) problems.push(`Duplicate slug ${v.slug}`);
  seen.add(v.slug);
  if (!CATEGORIES.some((c) => c.id === v.category)) problems.push(`Vehicle ${v.slug}: unknown category "${v.category}"`);
  if (!statusLabel[v.status]) problems.push(`Vehicle ${v.slug}: status must be available, reserved or sold`);
  if (!Array.isArray(v.images) || !v.images.length) problems.push(`Vehicle ${v.slug}: needs at least one image`);
  else v.images.forEach((im, i) => { if (!im.alt) problems.push(`Vehicle ${v.slug}: image ${i + 1} needs alt text`); });
}
if (problems.length) { console.error('Inventory data errors:\n  ' + problems.join('\n  ')); process.exit(1); }

const byNewest = (a, b) => (a.status === 'sold') - (b.status === 'sold') || String(b.listedOn).localeCompare(String(a.listedOn));
vehicles.sort(byNewest);
const live = vehicles.filter((v) => v.status !== 'sold');

// ---------------------------------------------------------------- assets
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const assetVer = {};
for (const f of fs.readdirSync(path.join(SRC, 'assets'))) {
  let content = fs.readFileSync(path.join(SRC, 'assets', f), 'utf8');
  if (f.endsWith('.css')) content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n');
  fs.writeFileSync(path.join(OUT, 'assets', f), content);
  assetVer[f] = crypto.createHash('sha1').update(content).digest('hex').slice(0, 8);
}
// Motion layer: bundle src/motion/index.js (imports the Motion library) into one minified file.
{
  const outfile = path.join(OUT, 'assets', 'motion.js');
  buildSync({ entryPoints: [path.join(SRC, 'motion', 'index.js')], bundle: true, minify: true, format: 'iife', target: ['es2019'], outfile, legalComments: 'none', logLevel: 'warning' });
  assetVer['motion.js'] = crypto.createHash('sha1').update(fs.readFileSync(outfile)).digest('hex').slice(0, 8);
}
const asset = (f) => `/assets/${f}?v=${assetVer[f]}`;
(function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b); } else fs.copyFileSync(a, b);
  }
})(path.join(SRC, 'static'), OUT);

// ---------------------------------------------------------------- layout
const NAV = [
  { href: '/inventory/', label: 'Collection' },
  ...(SELL ? [{ href: '/sell-your-car/', label: 'Sell your car' }] : []),
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
];

function header(active) {
  return `<header class="site-header">
  <div class="wrap">
    <a class="wordmark" href="/" aria-label="${esc(BRAND)} home">A<i aria-hidden="true"></i>SPECS</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span></button>
    <nav class="nav" id="site-nav" aria-label="Main">
      <ul class="nav__list">
        ${NAV.map((n) => `<li><a href="${n.href}"${active === n.href ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('')}
      </ul>
      <a class="btn btn--sm btn--gold" href="/contact/">Enquire</a>
    </nav>
  </div>
</header>`;
}

function contactLinks() {
  const out = [];
  if (C.phone) out.push(`<li><a href="${telHref(C.phone)}">${esc(C.phone)}</a></li>`);
  if (C.whatsapp) out.push(`<li><a href="${waHref()}" rel="noopener" target="_blank">WhatsApp</a></li>`);
  if (C.email) out.push(`<li><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>`);
  return out.join('');
}

function footer() {
  const contact = contactLinks();
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="wordmark wordmark--lg" href="/" aria-label="${esc(BRAND)} home">A<i aria-hidden="true"></i>SPECS</a>
        <p>Pre-owned luxury, sports and exotic automobiles, bought and sold.${C.city ? ' ' + esc(C.city) + '.' : ''}</p>
      </div>
      <div>
        <h2>Collection</h2>
        <ul>
          <li><a href="/inventory/">All cars</a></li>
          ${CATEGORIES.map((c) => `<li><a href="/inventory/?category=${c.id}">${c.name}</a></li>`).join('')}
        </ul>
      </div>
      <div>
        <h2>A-SPECS</h2>
        <ul>
          <li><a href="/about/">About</a></li>
          ${SELL ? '<li><a href="/sell-your-car/">Sell your car</a></li>' : ''}
          <li><a href="/contact/">Contact</a></li>
          ${config.social && config.social.instagram ? `<li><a href="${esc(config.social.instagram)}" rel="noopener" target="_blank">Instagram</a></li>` : ''}
        </ul>
      </div>
      <div>
        <h2>${contact ? 'Get in touch' : 'Legal'}</h2>
        <ul>
          ${contact}
          ${contact ? '' : '<li><a href="/privacy-policy/">Privacy policy</a></li><li><a href="/terms/">Terms and conditions</a></li>'}
        </ul>
      </div>
    </div>
    <div class="footer-base">
      <span>&copy; ${year} ${esc(config.legalName || BRAND)}. All rights reserved.</span>
      <span><a href="/privacy-policy/">Privacy policy</a> &nbsp;/&nbsp; <a href="/terms/">Terms and conditions</a></span>
    </div>
  </div>
</footer>`;
}

function layout({ title, description, urlPath, body, active, scripts = [], jsonld = [], ogImage, noindex = false, bodyClass = '', head = '' }) {
  const robots = !INDEXABLE || noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const og = ogImage || abs('/og-image.png');
  const ld = jsonld.filter(Boolean).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="${esc(config.locale || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
${SITE ? `<link rel="canonical" href="${esc(abs(urlPath))}">` : ''}
<meta name="theme-color" content="#0a0a0b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${SITE ? `<meta property="og:url" content="${esc(abs(urlPath))}">` : ''}
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:alt" content="${esc(BRAND)}: pre-owned luxury, sports and exotic automobiles">
<meta property="og:locale" content="${esc((config.locale || 'en-IN').replace('-', '_'))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${asset('styles.css')}">
<script src="${asset('boot.js')}"></script>
${head}
${ld}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip-link" href="#main">Skip to content</a>
${DEMO ? '<div class="demo-banner" role="note">Development preview. Cars marked DEMO are sample data, not A-SPECS stock, and are never published.</div>' : ''}
${header(active)}
<main id="main" tabindex="-1">
${body}
</main>
${footer()}
<script src="${asset('main.js')}" defer></script>
<script src="${asset('motion.js')}" defer></script>
${scripts.map((s) => `<script src="${asset(s)}" defer></script>`).join('\n')}
</body>
</html>`;
}

const pages = []; // { urlPath, file, html, sitemap }
function page(urlPath, html, { sitemap = true } = {}) {
  // Keep the brand name on one line in visible body text (never inside tags or attributes).
  const i = html.indexOf('<body');
  html = html.slice(0, i) + html.slice(i).replace(/A-SPECS(?![^<]*>)/g, '<span class="nb">A-SPECS</span>');
  const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
  pages.push({ urlPath, file, html, sitemap });
}

// ---------------------------------------------------------------- components
function card(v, { headingLevel = 3 } = {}) {
  const href = `/inventory/${v.slug}/`;
  const price = fmtPrice(v.price);
  const im = v.images[0];
  const q = [v.make, v.model, v.variant, v.year, v.exteriorColour, catName(v.category), v.bodyType].join(' ').toLowerCase();
  const H = `h${headingLevel}`;
  return `<article class="card${v.status === 'sold' ? ' card--sold' : ''}" data-q="${esc(q)}" data-category="${esc(v.category)}" data-body="${esc(v.bodyType)}" data-fuel="${esc(v.fuel)}" data-trans="${esc(v.transmission)}" data-price="${v.price ?? ''}" data-year="${v.year}" data-km="${v.km}" data-listed="${esc(v.listedOn)}" data-status="${v.status}">
  <div class="card__media">
    ${img({ src: im.src, alt: im.alt, sizes: '(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 420px' })}
    ${v.status !== 'available' ? `<span class="card__status card__status--${v.status}">${statusLabel[v.status]}</span>` : ''}
    ${DEMO ? '<span class="card__demo">DEMO</span>' : ''}
  </div>
  <div class="card__body">
    <div>
      <p class="card__make">${esc(v.make)} &middot; ${v.year}</p>
      <${H} class="card__title"><a href="${href}">${esc(v.model)}</a></${H}>
      ${v.variant ? `<p class="card__variant">${esc(v.variant)}</p>` : ''}
    </div>
    <dl class="spec-row">
      <div><dt>Year</dt><dd>${v.year}</dd></div>
      <div><dt>Driven</dt><dd>${esc(nfIN.format(v.km))}</dd></div>
      <div><dt>Fuel</dt><dd>${esc(v.fuel)}</dd></div>
      <div><dt>Gear</dt><dd>${v.transmission === 'Automatic' ? 'Auto' : esc(v.transmission)}</dd></div>
    </dl>
    <div class="card__foot">
      ${price ? `<p class="price">${esc(price)}</p>` : '<p class="price price--req">Price on request</p>'}
      <span class="card__cta">${v.status === 'sold' ? 'Sold' : 'View car'} ${I.arrow}</span>
    </div>
  </div>
</article>`;
}

function emptyCollection() {
  return `<div class="empty" data-reveal>
  <div>
    <p class="kicker">The collection</p>
    <h3>New listings are being prepared.</h3>
    <p>Cars will appear here as they are added. If you are looking for a particular make or model, send us the details and the A-SPECS team will get back to you.</p>
  </div>
  <div class="empty__actions">
    <a class="btn" href="/contact/">Send an enquiry</a>
    ${SELL ? '<a class="btn btn--ghost" href="/sell-your-car/">Sell your car</a>' : ''}
  </div>
</div>`;
}

function fallbackHtml() {
  const bits = [];
  if (C.phone) bits.push(`call <a href="${telHref(C.phone)}">${esc(C.phone)}</a>`);
  if (C.whatsapp) bits.push(`message us on <a href="${waHref()}" rel="noopener" target="_blank">WhatsApp</a>`);
  if (C.email) bits.push(`email <a href="mailto:${esc(C.email)}">${esc(C.email)}</a>`);
  return bits.length ? 'You can also ' + bits.join(', ').replace(/, ([^,]*)$/, ' or $1') + '.' : '';
}

function field({ name, label, type = 'text', required = false, attrs = '', hint = '', full = false, value = '' }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  const hintId = hint ? `${id}-hint` : '';
  const errId = `${id}-err`;
  const described = [hintId, errId].filter(Boolean).join(' ');
  let control;
  if (type === 'textarea') control = `<textarea class="textarea" id="${id}" name="${name}" aria-describedby="${described}"${required ? ' required' : ''} ${attrs}>${esc(value)}</textarea>`;
  else if (type === 'select') control = `<select class="select" id="${id}" name="${name}" aria-describedby="${described}"${required ? ' required' : ''}>${attrs}</select>`;
  else control = `<input class="input${type === 'file' ? ' file-input' : ''}" id="${id}" name="${name}" type="${type}" aria-describedby="${described}"${required ? ' required' : ''}${value ? ` value="${esc(value)}"` : ''} ${attrs}>`;
  return `<div class="field"${full ? ' data-full' : ''}>
  <label for="${id}">${esc(label)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
  ${control}
  ${hint ? `<p class="field__hint" id="${hintId}">${hint}</p>` : ''}
  <p class="field__err" id="${errId}" aria-live="polite"></p>
</div>`;
}

const PHONE_ATTRS = 'autocomplete="tel" inputmode="tel" pattern="\\+?[0-9\\s\\-\\(\\)]{10,20}" maxlength="20"';

function formShell({ id, subject, success, submitLabel, inner, multipart = false }) {
  return `<form class="form" id="${id}" data-form novalidate${FORM_ENDPOINT ? ` action="${esc(FORM_ENDPOINT)}" method="post"` : ''}${multipart ? ' enctype="multipart/form-data"' : ''} data-endpoint="${esc(FORM_ENDPOINT)}" data-fallback="${esc(fallbackHtml())}" data-success="${esc(success)}">
  <input type="hidden" name="subject" value="${esc(subject)}">
  <input type="hidden" name="form_name" value="${esc(id)}">
  ${FORM_KEY ? `<input type="hidden" name="access_key" value="${esc(FORM_KEY)}">` : ''}
  <div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="company_website" tabindex="-1" autocomplete="off"></label></div>
  ${inner}
  <div class="field">
    <label class="check"><input type="checkbox" name="consent" value="yes" required aria-describedby="${id}-consent-err"> <span>I agree that A-SPECS may use these details to respond to my enquiry, as described in the <a href="/privacy-policy/">privacy policy</a>.</span></label>
    <p class="field__err" id="${id}-consent-err" aria-live="polite"></p>
  </div>
  <div class="form-status" role="status" aria-live="polite" tabindex="-1"></div>
  <div class="form__foot">
    <button class="btn" type="submit">${esc(submitLabel)}</button>
    <span class="field__hint">Fields marked <span class="req">*</span> are required.</span>
  </div>
</form>`;
}

function enquiryForm({ vehicle = null, id = 'enquiry' } = {}) {
  const vLabel = vehicle ? vName(vehicle) : '';
  return formShell({
    id,
    subject: vehicle ? `Vehicle enquiry: ${vLabel}` : 'General enquiry',
    success: 'Thank you. Your enquiry has been sent to the A-SPECS team.',
    submitLabel: 'Send enquiry',
    inner: `<div class="form__row">
    ${field({ name: 'name', label: 'Full name', required: true, attrs: 'autocomplete="name" maxlength="80" minlength="2"' })}
    ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, attrs: PHONE_ATTRS })}
  </div>
  <div class="form__row">
    ${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: 'autocomplete="email" maxlength="120"' })}
    ${field({ name: 'vehicle', label: 'Car of interest', value: vLabel, attrs: `maxlength="120" placeholder="Make and model"${vehicle ? ' readonly' : ''}` })}
  </div>
  ${vehicle ? `<input type="hidden" name="vehicle_url" value="${esc(abs('/inventory/' + vehicle.slug + '/'))}">` : ''}
  ${field({ name: 'message', label: 'Message', type: 'textarea', required: true, value: vehicle ? `I am interested in the ${vLabel}. Please share more details.` : '', attrs: 'maxlength="2000" minlength="5"' })}`,
  });
}

function sellForm() {
  const thisYear = new Date().getFullYear() + 1;
  return formShell({
    id: 'sell-your-car',
    subject: 'Sell your car enquiry',
    success: 'Thank you. The details of your car have been sent to the A-SPECS team.',
    submitLabel: 'Send car details',
    multipart: true,
    inner: `<fieldset class="form fieldset">
  <legend class="kicker kicker--plain">Your details</legend>
  <div class="form__row">
    ${field({ name: 'name', label: 'Full name', required: true, attrs: 'autocomplete="name" maxlength="80" minlength="2"' })}
    ${field({ name: 'phone', label: 'Phone number', type: 'tel', required: true, attrs: PHONE_ATTRS })}
  </div>
  <div class="form__row">
    ${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: 'autocomplete="email" maxlength="120"' })}
    ${field({ name: 'location', label: 'City', required: true, attrs: 'autocomplete="address-level2" maxlength="80"' })}
  </div>
</fieldset>
<fieldset class="form fieldset">
  <legend class="kicker kicker--plain">Your car</legend>
  <div class="form__row">
    ${field({ name: 'make', label: 'Make', required: true, attrs: 'maxlength="60" placeholder="For example, Porsche"' })}
    ${field({ name: 'model', label: 'Model and variant', required: true, attrs: 'maxlength="80" placeholder="For example, 911 Carrera S"' })}
  </div>
  <div class="form__row form__row--3">
    ${field({ name: 'year', label: 'Year of manufacture', type: 'number', required: true, attrs: `inputmode="numeric" min="1950" max="${thisYear}" step="1"` })}
    ${field({ name: 'km', label: 'Kilometres driven', type: 'number', required: true, attrs: 'inputmode="numeric" min="0" max="999999" step="1"' })}
    ${field({ name: 'expected_price', label: 'Expected price (₹)', type: 'number', attrs: 'inputmode="numeric" min="0" max="999999999" step="1"' })}
  </div>
  ${field({ name: 'photos', label: 'Photographs', type: 'file', attrs: 'accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple', hint: 'Optional. Up to 8 images, 8 MB each. JPG, PNG, WebP or HEIC.' })}
  ${field({ name: 'message', label: 'Anything else we should know', type: 'textarea', attrs: 'maxlength="2000" placeholder="Service history, number of owners, modifications, condition"' })}
</fieldset>`,
  });
}

function contactChannels() {
  const rows = [];
  if (C.phone) rows.push(`<li><span class="k">Phone</span><a href="${telHref(C.phone)}">${esc(C.phone)}</a></li>`);
  if (C.whatsapp) rows.push(`<li><span class="k">WhatsApp</span><a href="${waHref('Hello A-SPECS, I have an enquiry.')}" rel="noopener" target="_blank">${esc(C.whatsapp)}</a></li>`);
  if (C.email) rows.push(`<li><span class="k">Email</span><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>`);
  if (C.address) rows.push(`<li><span class="k">Address</span><span>${esc(C.address)}${C.mapsUrl ? `<br><a class="link-arrow" href="${esc(C.mapsUrl)}" rel="noopener" target="_blank">Open in Google Maps ${I.arrow}</a>` : ''}</span></li>`);
  if (C.hours) rows.push(`<li><span class="k">Hours</span><span>${esc(C.hours)}</span></li>`);
  return rows.length ? `<ul class="contact-list">${rows.join('')}</ul>` : '';
}

function marquee() {
  const diamond = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor"/></svg>';
  const items = CATEGORIES.map((c, i) => `<span class="marquee__item${i % 2 ? ' marquee__item--it' : ''}">${c.name}${diamond}</span>`).join('');
  // Rendered twice so the loop is seamless; hidden from assistive tech because it repeats the category list.
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${items}${items}</div></div>`;
}

// Decorative tachometer drawn in SVG and animated by src/motion/index.js.
function tachometer() {
  const cx = 200, cy = 200, r = 160;
  const pt = (deg, rad) => { const a = (deg * Math.PI) / 180; return [(cx + rad * Math.sin(a)).toFixed(2), (cy - rad * Math.cos(a)).toFixed(2)]; };
  const arc = (from, to, rad) => { const [x1, y1] = pt(from, rad), [x2, y2] = pt(to, rad); return `M${x1} ${y1} A${rad} ${rad} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const deg = (k) => -120 + k * 30; // 0 to 8 thousand rpm across 240 degrees
  let ticks = '', nums = '';
  for (let k = 0; k <= 8; k += 0.5) {
    const major = Number.isInteger(k);
    const [x1, y1] = pt(deg(k), r - 12), [x2, y2] = pt(deg(k), r - (major ? 30 : 21));
    ticks += `<line class="tach__tick${major ? ' tach__tick--major' : ''}${k >= 6.5 ? ' tach__tick--red' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (major) { const [nx, ny] = pt(deg(k), r - 52); nums += `<text class="tach__num" x="${nx}" y="${ny}">${k}</text>`; }
  }
  return `<figure class="tach" aria-hidden="true">
  <svg viewBox="0 0 400 300">
    <path class="tach__track" d="${arc(-120, 120, r)}"/>
    <path class="tach__arc" pathLength="1" d="${arc(-120, 75, r)}"/>
    <path class="tach__red" pathLength="1" d="${arc(75, 120, r)}"/>
    ${ticks}${nums}
    <text class="tach__unit" x="200" y="262">RPM &#215; 1000</text>
    <g class="tach__needle"><line x1="200" y1="214" x2="200" y2="58"/><circle cx="200" cy="200" r="9"/></g>
  </svg>
  <figcaption>Specification first</figcaption>
</figure>`;
}

// ---------------------------------------------------------------- JSON-LD
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'AutoDealer',
  name: BRAND,
  ...(config.legalName ? { legalName: config.legalName } : {}),
  ...(SITE ? { url: SITE + '/', logo: SITE + '/apple-touch-icon.png', image: SITE + '/og-image.png' } : {}),
  description: 'Buying and selling pre-owned luxury, sports and exotic automobiles.',
  ...(C.phone ? { telephone: C.phone } : {}),
  ...(C.email ? { email: C.email } : {}),
  ...(C.address ? { address: { '@type': 'PostalAddress', streetAddress: C.address, ...(C.city ? { addressLocality: C.city } : {}), addressCountry: config.country } } : {}),
  ...(config.social && config.social.instagram ? { sameAs: [config.social.instagram] } : {}),
};
const siteLd = SITE ? { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE + '/' } : null;
function crumbsLd(items) {
  if (!SITE) return null;
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })) };
}
function carLd(v) {
  if (DEMO || !SITE) return null; // never emit structured data for sample cars
  const availability = { available: 'https://schema.org/InStock', reserved: 'https://schema.org/LimitedAvailability', sold: 'https://schema.org/SoldOut' }[v.status];
  const o = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: vName(v),
    url: abs(`/inventory/${v.slug}/`),
    image: v.images.map((im) => (/^https?:/.test(im.src) ? imgUrl(im.src, 1600) : abs(im.src))),
    brand: { '@type': 'Brand', name: v.make },
    model: v.model,
    ...(v.variant ? { vehicleConfiguration: v.variant } : {}),
    vehicleModelDate: String(v.year),
    ...(v.registrationYear ? { dateVehicleFirstRegistered: String(v.registrationYear) } : {}),
    itemCondition: 'https://schema.org/UsedCondition',
    bodyType: v.bodyType,
    fuelType: v.fuel,
    vehicleTransmission: v.transmission,
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.km, unitCode: 'KMT' },
    ...(v.exteriorColour ? { color: v.exteriorColour } : {}),
    ...(v.owners ? { numberOfPreviousOwners: v.owners } : {}),
    ...(v.drivetrain ? { driveWheelConfiguration: v.drivetrain } : {}),
    ...(v.engine && v.engine.description ? { vehicleEngine: { '@type': 'EngineSpecification', name: v.engine.description, ...(v.engine.powerBhp ? { enginePower: { '@type': 'QuantitativeValue', value: v.engine.powerBhp, unitCode: 'BHP' } } : {}), ...(v.engine.torqueNm ? { torque: { '@type': 'QuantitativeValue', value: v.engine.torqueNm, unitCode: 'NU' } } : {}) } } : {}),
  };
  if (v.price != null && v.status !== 'sold') {
    o.offers = { '@type': 'Offer', price: v.price, priceCurrency: config.currency, availability, url: o.url, seller: { '@type': 'AutoDealer', name: BRAND } };
  }
  return o;
}

// ---------------------------------------------------------------- pages
const hero = config.heroImage;
const featured = (live.filter((v) => v.featured).length ? live.filter((v) => v.featured) : live).slice(0, 3);
const catCount = (id) => live.filter((v) => v.category === id).length;

// Home
page('/', layout({
  title: `${BRAND} | Pre-owned Luxury, Sports and Exotic Cars`,
  description: `${BRAND} buys and sells pre-owned luxury, sports and exotic automobiles. Browse the collection with full specifications, or sell your car to ${BRAND}.`,
  urlPath: '/',
  active: '/',
  jsonld: [orgLd, siteLd],
  body: `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media">${img({ src: hero.src, alt: hero.alt, sizes: '100vw', eager: true, w: 2000, h: 1333 })}</div>
  <div class="wrap hero__inner">
    <div class="hero__copy">
      <p class="kicker">Pre-owned luxury, sports and exotic cars</p>
      <h1 class="display" id="hero-title" data-split>Exceptional cars, <em class="serif-it">presented to specification.</em></h1>
      <p class="lede">${BRAND} buys and sells pre-owned luxury, sports and exotic automobiles. Every listing sets out the full specification, ownership and registration details, so you can judge the car properly before you pick up the phone.</p>
      <div class="hero__ctas">
        <a class="btn" href="/inventory/">Browse the collection ${I.arrow}</a>
        ${SELL ? '<a class="btn btn--ghost" href="/sell-your-car/">Sell your car</a>' : ''}
      </div>
    </div>
    <nav class="hero__index" aria-label="Browse by type">
      <a href="/inventory/?category=luxury-sedan,luxury-suv"><span class="mono">01</span><span>Luxury sedans and SUVs</span></a>
      <a href="/inventory/?category=sports,performance"><span class="mono">02</span><span>Sports and performance</span></a>
      <a href="/inventory/?category=supercar,exotic"><span class="mono">03</span><span>Supercars and exotics</span></a>
    </nav>
  </div>
</section>

${marquee()}

<section class="section" aria-labelledby="featured-title">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <div>
        <p class="kicker">Currently listed</p>
        <h2 data-split class="h2" id="featured-title">Selected from the collection</h2>
      </div>
      <a class="link-arrow" href="/inventory/">View all cars ${I.arrow}</a>
    </div>
    ${featured.length ? `<div class="grid-cards" data-reveal-group>${featured.map((v) => card(v)).join('')}</div>` : emptyCollection()}
  </div>
</section>

<section class="section section--graphite" aria-labelledby="cats-title">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <div>
        <p class="kicker">What we deal in</p>
        <h2 data-split class="h2" id="cats-title">Six kinds of car. One standard of listing.</h2>
      </div>
      <p class="muted">From executive saloons to mid-engined exotics. Choose a category to see what is listed now.</p>
    </div>
    <ul class="cat-index" data-reveal-group>
      ${CATEGORIES.map((c, i) => `<li><a href="/inventory/?category=${c.id}"><span class="n">0${i + 1}</span><span class="t">${c.name}${catCount(c.id) ? `<span class="c">${catCount(c.id)}</span>` : ''}</span><span class="d">${c.desc}</span>${I.arrow}</a></li>`).join('')}
    </ul>
  </div>
</section>

<section class="section section--bone" aria-labelledby="listing-title">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <div>
        <p class="kicker">The ${BRAND} listing</p>
        <h2 data-split class="h2" id="listing-title">What you see before you call.</h2>
      </div>
      <p class="lede">A luxury car is a considered purchase. Each listing is built to answer the first questions a serious buyer asks.</p>
    </div>
    <ol class="principles" data-reveal-group>
      <li><span class="n">01</span><h3>Full specification</h3><p>Engine, output, drivetrain, transmission, colours and fitted options, set out in one place for every car.</p></li>
      <li><span class="n">02</span><h3>Ownership and registration</h3><p>Year of manufacture, year and state of registration, number of owners and kilometres driven, stated plainly.</p></li>
      <li><span class="n">03</span><h3>Clear pricing</h3><p>Where a price is confirmed it is shown. Where it is not, the listing says so, and one message gets you the figure.</p></li>
      <li><span class="n">04</span><h3>A direct conversation</h3><p>Every enquiry reaches the ${BRAND} team directly, with the car you are asking about already attached.</p></li>
    </ol>
  </div>
</section>

<section class="section" aria-labelledby="about-title">
  <div data-reveal-group class="wrap split split--wide-left">
    <div>
      <p class="kicker">About ${BRAND}</p>
      <h2 data-split class="statement" id="about-title">A dealership for pre-owned automobiles that are worth talking about.</h2>
      ${tachometer()}
    </div>
    <div class="prose">
      <p>${BRAND} buys and sells luxury saloons, SUVs, sports cars, supercars and exotics. The name says how we work: a car is judged on its specification and its history, so both belong on the table from the first conversation.</p>
      <p>Whether you are looking for your next car or ready to part with your current one, you deal with people who care about these automobiles as much as you do.</p>
      <a class="link-arrow" href="/about/">More about ${BRAND} ${I.arrow}</a>
    </div>
  </div>
</section>

<section class="section section--graphite" aria-labelledby="process-title">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <div>
        <p class="kicker">How it works</p>
        <h2 data-split class="h2" id="process-title">Buying${SELL ? ' and selling' : ''}, step by step.</h2>
      </div>
    </div>
    <div class="process">
      <div>
        <h3>Buying a car</h3>
        <ol class="steps" data-reveal-group>
          <li><div><strong>Find the car</strong><p>Browse the collection and narrow it down by category, body style, fuel, year or price.</p></div></li>
          <li><div><strong>Send an enquiry</strong><p>Use the form on the car's page${C.whatsapp ? ' or message us on WhatsApp' : ''}. Your enquiry carries the car's details with it.</p></div></li>
          <li><div><strong>Talk it through</strong><p>The ${BRAND} team replies to answer your questions on the car, its paperwork and the next steps.</p></div></li>
        </ol>
        <a class="link-arrow" href="/inventory/">Browse the collection ${I.arrow}</a>
      </div>
      ${SELL ? `<div>
        <h3>Selling your car</h3>
        <ol class="steps" data-reveal-group>
          <li><div><strong>Tell us about it</strong><p>Share the make, model, year, kilometres and a few photographs using the online form.</p></div></li>
          <li><div><strong>We review the details</strong><p>The team looks over the car and the information you have sent.</p></div></li>
          <li><div><strong>We get in touch</strong><p>You hear back from ${BRAND} to discuss your car and what happens next.</p></div></li>
        </ol>
        <a class="link-arrow" href="/sell-your-car/">Sell your car ${I.arrow}</a>
      </div>` : ''}
    </div>
  </div>
</section>

<section class="section" id="enquire" aria-labelledby="enquire-title">
  <div data-reveal-group class="wrap split">
    <div>
      <p class="kicker">Enquire</p>
      <h2 data-split class="h2" id="enquire-title">Tell us what you are looking for.</h2>
      <p class="lede">A specific car from the collection, a make and model you have in mind, or a question about selling. Send it here and the team will reply.</p>
      ${contactChannels()}
    </div>
    ${enquiryForm({ id: 'home-enquiry' })}
  </div>
</section>`,
}));

// Inventory
const makes = [...new Set(vehicles.map((v) => v.make))].sort();
const bodies = [...new Set(vehicles.map((v) => v.bodyType))].sort();
const fuels = [...new Set(vehicles.map((v) => v.fuel))].sort();
const trans = [...new Set(vehicles.map((v) => v.transmission))].sort();
const years = vehicles.map((v) => v.year);
const yearOpts = years.length ? Array.from({ length: Math.max(...years) - Math.min(...years) + 1 }, (_, i) => Math.max(...years) - i) : [];
const PRICE_STEPS = [2500000, 5000000, 7500000, 10000000, 15000000, 20000000, 30000000, 50000000, 100000000];
const chips = (name, list, labeller = (x) => x) => `<div class="chips">${list.map((x) => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(x)}"><span>${esc(labeller(x))}</span></label>`).join('')}</div>`;
const usedCats = CATEGORIES.filter((c) => vehicles.some((v) => v.category === c.id));

page('/inventory/', layout({
  title: `Pre-owned Luxury and Exotic Cars for Sale | ${BRAND}`,
  description: `Browse pre-owned luxury sedans, SUVs, sports cars, supercars and exotics listed by ${BRAND}. Filter by make, price, year, fuel and transmission, then enquire directly.`,
  urlPath: '/inventory/',
  active: '/inventory/',
  scripts: vehicles.length ? ['inventory.js'] : [],
  jsonld: [crumbsLd([['Home', '/'], ['Collection', '/inventory/']])],
  body: `
<header class="page-head">
  <div class="wrap">
    <p class="kicker">The collection</p>
    <h1>Pre-owned luxury and exotic cars</h1>
    <p class="lede">Every car listed by ${BRAND}, with the specification set out in full. Filter the collection, open a car for its complete details, and enquire directly from its page.</p>
  </div>
</header>
<section class="section--tight">
  <div class="wrap">
  ${vehicles.length ? `
    <div class="inv-layout">
      <form class="filters" id="inv-filters" role="search" aria-label="Filter cars">
        <div class="filters__head"><h2>Refine</h2><button class="text-btn" type="button" data-reset>Clear all</button></div>
        <div class="field"><label for="f-q">Search make or model</label><input class="input" id="f-q" name="q" type="search" placeholder="For example, Porsche 911" autocomplete="off" list="make-list"><datalist id="make-list">${makes.map((m) => `<option value="${esc(m)}">`).join('')}</datalist></div>
        ${usedCats.length > 1 ? `<fieldset class="field"><legend>Category</legend>${chips('category', usedCats.map((c) => c.id), catName)}</fieldset>` : '<div hidden>' + chips('category', usedCats.map((c) => c.id)) + '</div>'}
        ${bodies.length > 1 ? `<fieldset class="field"><legend>Body type</legend>${chips('body', bodies)}</fieldset>` : '<div hidden>' + chips('body', bodies) + '</div>'}
        <fieldset class="field"><legend>Price</legend><div class="range-pair">
          <label class="sr-only" for="f-pmin">Minimum price</label><select class="select" id="f-pmin" name="pmin"><option value="">Min</option>${PRICE_STEPS.map((p) => `<option value="${p}">${fmtPrice(p)}</option>`).join('')}</select>
          <label class="sr-only" for="f-pmax">Maximum price</label><select class="select" id="f-pmax" name="pmax"><option value="">Max</option>${PRICE_STEPS.map((p) => `<option value="${p}">${fmtPrice(p)}</option>`).join('')}</select>
        </div><p class="field__hint">Price-on-request cars are hidden while a price range is set.</p></fieldset>
        <fieldset class="field"><legend>Year of manufacture</legend><div class="range-pair">
          <label class="sr-only" for="f-ymin">From year</label><select class="select" id="f-ymin" name="ymin"><option value="">From</option>${yearOpts.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
          <label class="sr-only" for="f-ymax">To year</label><select class="select" id="f-ymax" name="ymax"><option value="">To</option>${yearOpts.map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
        </div></fieldset>
        <fieldset class="field"><legend>Fuel</legend>${chips('fuel', fuels)}</fieldset>
        <fieldset class="field"><legend>Transmission</legend>${chips('trans', trans)}</fieldset>
        ${vehicles.some((v) => v.status === 'sold') ? '<label class="check"><input type="checkbox" name="sold" value="1"> <span>Include sold cars</span></label>' : '<input type="checkbox" name="sold" value="1" hidden>'}
      </form>
      <div>
        <div class="inv-toolbar">
          <p class="inv-count" id="inv-count" aria-live="polite"><strong>${live.length}</strong> ${live.length === 1 ? 'car' : 'cars'} listed</p>
          <button class="btn btn--sm btn--ghost filters-toggle" type="button" aria-expanded="false" aria-controls="inv-filters">Filters</button>
          <div class="inv-sort"><label for="inv-sort">Sort</label><select class="select" id="inv-sort"><option value="newest">Newest listings</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option><option value="year-desc">Year, newest first</option><option value="km-asc">Kilometres, lowest first</option></select></div>
        </div>
        <div class="grid-cards" id="inv-grid">${vehicles.map((v) => card(v, { headingLevel: 2 })).join('')}</div>
        <div class="no-results" id="inv-none" hidden>
          <h3>No cars match these filters.</h3>
          <p>Try widening the price or year range, or clear the filters to see the full collection.</p>
          <button class="btn btn--ghost" type="button" data-reset>Clear all filters</button>
        </div>
      </div>
    </div>` : emptyCollection()}
  </div>
</section>
<section class="cta-band" data-reveal aria-label="Enquire">
  <div class="wrap">
    <h2>Looking for a car that is not listed?</h2>
    <div class="actions"><a class="btn" href="/contact/">Tell us what you want</a>${C.phone ? `<a class="btn btn--ghost" href="${telHref(C.phone)}">${I.phone} Call</a>` : ''}</div>
  </div>
</section>`,
}));

// Vehicle detail pages
for (const v of vehicles) {
  const url = `/inventory/${v.slug}/`;
  const name = vName(v);
  const price = fmtPrice(v.price);
  const similar = live.filter((o) => o.slug !== v.slug).map((o) => ({ o, s: (o.category === v.category ? 2 : 0) + (o.bodyType === v.bodyType ? 1 : 0) + (o.make === v.make ? 1 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.o);
  const wa = v.status !== 'sold' ? waHref(`Hello A-SPECS, I am interested in the ${name}${SITE ? ' (' + abs(url) + ')' : ''}. Is it available?`) : null;
  const rows = (list) => list.filter(([, val]) => val != null && val !== '').map(([k, val]) => `<tr><th scope="row">${k}</th><td>${esc(val)}</td></tr>`).join('');
  const e = v.engine || {};
  const descParts = [`Pre-owned ${name}`, fmtKm(v.km), v.fuel, v.transmission, price ? `Price ${price}` : 'Price on request'];
  page(url, layout({
    title: `${name} for Sale | ${BRAND}`,
    description: `${descParts.join(', ')}. See the full specification and enquire with ${BRAND}.`,
    urlPath: url,
    active: '/inventory/',
    noindex: DEMO,
    bodyClass: v.status !== 'sold' ? 'has-mobile-bar' : '',
    head: '<link rel="expect" href="#vehicle-photo" blocking="render">',
    ogImage: /^https?:/.test(v.images[0].src) ? imgUrl(v.images[0].src, 1200) : abs(v.images[0].src),
    jsonld: [carLd(v), crumbsLd([['Home', '/'], ['Collection', '/inventory/'], [name, url]])],
    body: `
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/inventory/">Collection</a></li><li aria-current="page">${esc(vShort(v))}</li></ol></nav>
  <div class="vd">
    <div class="vd__gallery">
      <div class="gallery" data-gallery tabindex="0" aria-label="Photographs of the ${esc(name)}. Use the left and right arrow keys to browse.">
        <div class="gallery__main" id="vehicle-photo">
          ${img({ src: v.images[0].src, alt: v.images[0].alt, sizes: '(max-width: 1000px) 100vw, 60vw', eager: true })}
          ${v.images.length > 1 ? `<button class="gallery__nav gallery__nav--prev" type="button" aria-label="Previous photograph">${I.left}</button><button class="gallery__nav gallery__nav--next" type="button" aria-label="Next photograph">${I.right}</button><span class="gallery__count">1 / ${v.images.length}</span>` : ''}
          ${v.status !== 'available' ? `<span class="card__status card__status--${v.status}">${statusLabel[v.status]}</span>` : ''}
          ${DEMO ? '<span class="card__demo">DEMO</span>' : ''}
        </div>
        ${v.images.length > 1 ? `<div class="gallery__thumbs">${v.images.map((im, i) => `<button type="button" aria-label="Show photograph ${i + 1} of ${v.images.length}" aria-current="${i === 0}" data-src="${esc(imgUrl(im.src, 1200))}" data-srcset="${esc(srcset(im.src))}" data-alt="${esc(im.alt)}">${img({ src: im.src, alt: '', sizes: '160px', w: 160, h: 100 })}</button>`).join('')}</div>` : ''}
      </div>
      ${DEMO ? '<p class="demo-note">Sample listing for development only. These details are illustrative and are not A-SPECS stock.</p>' : ''}
    </div>
    <aside class="vd__summary" aria-label="Summary and enquiry">
      <p class="kicker">${esc(v.make)}</p>
      <h1>${esc(v.model)}</h1>
      <p class="vd__variant">${esc([v.variant, v.year, v.exteriorColour].filter(Boolean).join(' · '))}</p>
      <div class="vd__price">
        <span class="k">${v.status === 'sold' ? 'Sold' : 'Asking price'}</span>
        ${v.status === 'sold' ? '<span class="price price--req">No longer available</span>' : price ? `<span class="price" title="${esc(fmtPriceFull(v.price))}">${esc(price)}</span>` : '<span class="price price--req">Price on request</span>'}
      </div>
      <dl class="vd__key">
        <div><dt>Year</dt><dd>${v.year}</dd></div>
        <div><dt>Kilometres</dt><dd>${esc(nfIN.format(v.km))}</dd></div>
        <div><dt>Fuel</dt><dd>${esc(v.fuel)}</dd></div>
        <div><dt>Transmission</dt><dd>${esc(v.transmission)}</dd></div>
        ${v.owners != null ? `<div><dt>Owners</dt><dd>${v.owners}</dd></div>` : ''}
        ${v.registrationYear ? `<div><dt>Registered</dt><dd>${v.registrationYear}</dd></div>` : ''}
      </dl>
      ${v.status !== 'sold' ? `<div class="vd__ctas">
        <a class="btn" href="#vehicle-enquiry">Enquire about this car</a>
        ${wa || C.phone ? `<div class="vd__ctas-row">${wa ? `<a class="btn btn--ghost" href="${esc(wa)}" rel="noopener" target="_blank">${I.whatsapp} WhatsApp</a>` : ''}${C.phone ? `<a class="btn btn--ghost" href="${telHref(C.phone)}">${I.phone} Call</a>` : ''}</div>` : ''}
      </div>
      ${v.status === 'reserved' ? '<p class="vd__note">This car is currently reserved. You can still enquire to be told if it becomes available.</p>' : ''}` : `<a class="btn btn--ghost btn--block" href="/inventory/">See available cars</a>`}
    </aside>
    <div class="vd__specs section--tight">
        ${v.description && !DEMO ? `<div class="prose spec-group"><p class="lede">${esc(v.description)}</p></div>` : ''}
        <div class="spec-group" data-reveal>
          <h2>Specification</h2>
          <table class="spec-table"><tbody data-reveal-group>${rows([
            ['Make', v.make], ['Model', v.model], ['Variant', v.variant], ['Body type', v.bodyType], ['Category', catName(v.category)],
            ['Engine', e.description], ['Power', e.powerBhp ? `${e.powerBhp} bhp` : null], ['Torque', e.torqueNm ? `${e.torqueNm} Nm` : null],
            ['Transmission', v.transmission], ['Drivetrain', v.drivetrain], ['Fuel', v.fuel],
          ])}</tbody></table>
        </div>
        <div class="spec-group" data-reveal>
          <h2>History and registration</h2>
          <table class="spec-table"><tbody data-reveal-group>${rows([
            ['Year of manufacture', v.year], ['Year of registration', v.registrationYear], ['Registered in', v.registrationState],
            ['Kilometres driven', fmtKm(v.km)], ['Owners', v.owners != null ? (v.owners === 1 ? 'First owner' : `${v.owners} owners`) : null],
            ['Condition', v.condition], ['Documentation', v.documentation],
          ])}</tbody></table>
        </div>
        <div class="spec-group" data-reveal>
          <h2>Colour and interior</h2>
          <table class="spec-table"><tbody data-reveal-group>${rows([['Exterior colour', v.exteriorColour], ['Interior', v.interior]])}</tbody></table>
        </div>
        ${v.features && v.features.length ? `<div class="spec-group" data-reveal><h2>Features and options</h2><ul class="feature-list" data-reveal-group>${v.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </div>
</div>

${v.status !== 'sold' ? `<section class="section section--graphite" id="vehicle-enquiry" aria-labelledby="ve-title">
  <div data-reveal-group class="wrap split">
    <div>
      <p class="kicker">Enquire</p>
      <h2 data-split class="h2" id="ve-title">Ask about the ${esc(vShort(v))}.</h2>
      <p class="lede">Your message goes to the ${BRAND} team with this car's details attached. Ask about availability, history, paperwork or viewing.</p>
      ${contactChannels()}
    </div>
    ${enquiryForm({ vehicle: v, id: 'vehicle-enquiry-form' })}
  </div>
</section>` : ''}

${similar.length ? `<section class="section" aria-labelledby="sim-title">
  <div class="wrap">
    <div class="section-head" data-reveal><div><p class="kicker">Also listed</p><h2 data-split class="h2" id="sim-title">Similar cars</h2></div><a class="link-arrow" href="/inventory/?category=${v.category}">More ${esc(catName(v.category).toLowerCase())} ${I.arrow}</a></div>
    <div class="grid-cards" data-reveal-group>${similar.map((o) => card(o)).join('')}</div>
  </div>
</section>` : ''}

${v.status !== 'sold' ? `<div class="mobile-bar">
  <a class="btn" href="#vehicle-enquiry">Enquire</a>
  ${wa ? `<a class="btn btn--ghost" href="${esc(wa)}" rel="noopener" target="_blank">${I.whatsapp}<span class="sr-only">Message on</span> WhatsApp</a>` : ''}
  ${C.phone ? `<a class="btn btn--ghost" href="${telHref(C.phone)}">${I.phone} Call</a>` : ''}
</div>` : ''}`,
  }), { sitemap: !DEMO });
}

// About
page('/about/', layout({
  title: `About ${BRAND} | Pre-owned Luxury and Exotic Car Dealership`,
  description: `${BRAND} buys and sells pre-owned luxury sedans, SUVs, sports cars, supercars and exotics. Learn how we approach every car we list.`,
  urlPath: '/about/',
  active: '/about/',
  jsonld: [crumbsLd([['Home', '/'], ['About', '/about/']])],
  body: `
<header class="page-head">
  <div class="wrap">
    <p class="kicker">About</p>
    <h1>About ${BRAND}</h1>
    <p class="lede">${BRAND} is a dealer in pre-owned luxury, sports and exotic automobiles. We buy cars from owners and sell them to people who will enjoy them.</p>
  </div>
</header>
<section class="section">
  <div data-reveal-group class="wrap split split--wide-left">
    <div class="prose">
      <h2>What we do</h2>
      <p>${BRAND} deals in the upper end of the pre-owned market: luxury sedans and SUVs, sports and performance cars, supercars and exotics. We list cars for sale${SELL ? ' and buy cars from private owners who are ready to sell' : ''}.</p>
      <h2>Why the name</h2>
      <p>In this part of the market, the details decide everything. Engine and output, options fitted at the factory, the number of owners, the kilometres, where and when the car was registered. ${BRAND} is built around putting that specification on the table first, so buyers and sellers can have a straight conversation about the car itself.</p>
      <h2>How we present a car</h2>
      <p>Every listing on this website follows the same structure:</p>
      <ul>
        <li>A full specification, including engine, output, transmission and drivetrain.</li>
        <li>Ownership and registration details: year of manufacture, year and state of registration, owners and kilometres.</li>
        <li>Exterior colour, interior trim and the options fitted to that car.</li>
        <li>An asking price where it is confirmed, or a clear note where the price is on request.</li>
      </ul>
      <h2>Talk to us</h2>
      <p>If you are looking for a particular car, or thinking about selling one, the simplest first step is a message. The team will take it from there.</p>
      <p><a class="link-arrow" href="/contact/">Contact ${BRAND} ${I.arrow}</a></p>
    </div>
    <div>
      <p class="kicker">At a glance</p>
      <ul class="contact-list">
        <li><span class="k">Business</span><span>Pre-owned automobile dealer</span></li>
        <li><span class="k">Focus</span><span>Luxury, sports and exotic cars</span></li>
        <li><span class="k">Services</span><span>Buying and selling pre-owned cars</span></li>
        ${C.city ? `<li><span class="k">Based in</span><span>${esc(C.city)}</span></li>` : ''}
      </ul>
    </div>
  </div>
</section>
<section class="cta-band" data-reveal aria-label="Next steps">
  <div class="wrap">
    <h2>See what is in the collection now.</h2>
    <div class="actions"><a class="btn" href="/inventory/">Browse the collection</a>${SELL ? '<a class="btn btn--ghost" href="/sell-your-car/">Sell your car</a>' : ''}</div>
  </div>
</section>`,
}));

// Sell your car
if (SELL) page('/sell-your-car/', layout({
  title: `Sell Your Luxury or Exotic Car | ${BRAND}`,
  description: `Thinking of selling a luxury, sports or exotic car? Send ${BRAND} the details and photographs of your car and the team will get back to you.`,
  urlPath: '/sell-your-car/',
  active: '/sell-your-car/',
  jsonld: [crumbsLd([['Home', '/'], ['Sell your car', '/sell-your-car/']])],
  body: `
<header class="page-head">
  <div class="wrap">
    <p class="kicker">Sell your car</p>
    <h1>Sell your car to ${BRAND}</h1>
    <p class="lede">If you own a luxury, sports or exotic car and are thinking of selling, send us the details below. The team will review them and get back to you.</p>
  </div>
</header>
<section class="section">
  <div data-reveal-group class="wrap split split--wide-left">
    ${sellForm()}
    <div>
      <p class="kicker">What helps</p>
      <ul class="contact-list">
        <li><span class="k">Photographs</span><span>Front three-quarter, rear, side profile, interior, and the odometer reading.</span></li>
        <li><span class="k">History</span><span>Service records and the number of previous owners, if you have them to hand.</span></li>
        <li><span class="k">Registration</span><span>The year and state of registration.</span></li>
        <li><span class="k">Changes</span><span>Any modifications, repairs or non-standard parts.</span></li>
      </ul>
      <p class="kicker next-steps">What happens next</p>
      <ol class="steps" data-reveal-group>
        <li><div><strong>We review</strong><p>The team looks over your car's details and photographs.</p></div></li>
        <li><div><strong>We get in touch</strong><p>You hear back by phone or email to talk about your car.</p></div></li>
      </ol>
      ${contactChannels()}
    </div>
  </div>
</section>`,
}));

// Contact
const mapEmbed = C.mapsEmbedUrl ? `<iframe class="map-frame" src="${esc(C.mapsEmbedUrl)}" title="Map showing the ${esc(BRAND)} location" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '';
page('/contact/', layout({
  title: `Contact ${BRAND} | Enquire About a Car`,
  description: `Enquire about a car in the ${BRAND} collection, ask about a specific make or model, or discuss selling your car.`,
  urlPath: '/contact/',
  active: '/contact/',
  jsonld: [crumbsLd([['Home', '/'], ['Contact', '/contact/']])],
  body: `
<header class="page-head">
  <div class="wrap">
    <p class="kicker">Contact</p>
    <h1>Contact ${BRAND}</h1>
    <p class="lede">Ask about a car in the collection, tell us about a car you are looking for, or start a conversation about selling. We will reply as soon as we can.</p>
  </div>
</header>
<section class="section">
  <div data-reveal-group class="wrap split">
    ${enquiryForm({ id: 'contact-form' })}
    <div>
      ${contactChannels() ? `<p class="kicker">Reach us directly</p>${contactChannels()}` : ''}
      ${mapEmbed}
    </div>
  </div>
</section>`,
}));

// Legal
const formProcessor = FORM_ENDPOINT ? new URL(FORM_ENDPOINT).hostname : null;
page('/privacy-policy/', layout({
  title: `Privacy Policy | ${BRAND}`,
  description: `How ${BRAND} collects, uses and protects the personal information you share through this website.`,
  urlPath: '/privacy-policy/',
  body: `
<header class="page-head"><div class="wrap"><p class="kicker">Legal</p><h1>Privacy policy</h1><p class="lede">Last updated ${UPDATED}.</p></div></header>
<section class="section"><div class="wrap prose prose--legal">
  <p>This policy explains what personal information ${esc(config.legalName || BRAND)} ("${BRAND}", "we", "us") collects through this website, why, and what choices you have. It applies only to this website.</p>
  <h2>Information we collect</h2>
  <p>We collect information only when you choose to send it to us through a form on this website:</p>
  <ul>
    <li><strong>Enquiry forms:</strong> your name, phone number, email address, the car you are interested in and your message.</li>
    ${SELL ? '<li><strong>Sell your car form:</strong> your name, phone number, email address and city, details of your car (make, model, year, kilometres, expected price), any notes you add and any photographs you upload.</li>' : ''}
  </ul>
  <p>This website does not use analytics or advertising trackers and does not set cookies.</p>
  <h2>How we use it</h2>
  <ul>
    <li>To reply to your enquiry and discuss the car you asked about.</li>
    ${SELL ? '<li>To assess a car you have offered to sell and contact you about it.</li>' : ''}
    <li>To keep a record of our correspondence with you.</li>
  </ul>
  <p>We do not sell your personal information, and we do not use it for unrelated marketing without your consent.</p>
  <h2>Services that process data for us</h2>
  <ul>
    <li><strong>Form delivery:</strong> ${formProcessor ? `form submissions are delivered to us through a third-party form service (${esc(formProcessor)}), which processes them on our behalf.` : 'form submissions are delivered to us through a third-party form service, which processes them on our behalf.'}</li>
    <li><strong>Fonts:</strong> this website loads typefaces from Google Fonts. Your browser connects to Google's servers to download them, which shares your IP address with Google.</li>
    <li><strong>Images:</strong> some photographs are served from the Unsplash image service, which receives your IP address when your browser loads them.</li>
    ${C.mapsEmbedUrl ? '<li><strong>Maps:</strong> the contact page embeds Google Maps, which may set its own cookies when it loads.</li>' : ''}
    ${C.whatsapp ? '<li><strong>WhatsApp:</strong> if you choose to contact us on WhatsApp, your conversation is subject to WhatsApp\'s own privacy policy.</li>' : ''}
  </ul>
  <h2>How long we keep it</h2>
  <p>We keep enquiry information for as long as needed to respond to you and for a reasonable period afterwards in case you contact us again, unless a longer period is required by law.</p>
  <h2>Your choices and rights</h2>
  <p>You can ask us to access, correct or delete the personal information you have sent us, or withdraw the consent you gave when submitting a form, subject to applicable law, including India's Digital Personal Data Protection Act, 2023.${C.email ? ` To make a request, email <a href="mailto:${esc(C.email)}">${esc(C.email)}</a>.` : ' To make a request, contact us through the <a href="/contact/">contact page</a>.'}</p>
  <h2>Security</h2>
  <p>This website is served over an encrypted HTTPS connection. No method of transmission or storage is completely secure, but we take reasonable steps to protect the information you send us.</p>
  <h2>Changes to this policy</h2>
  <p>We may update this policy from time to time. The date at the top of this page shows when it was last changed.</p>
  <h2>Contact</h2>
  <p>Questions about this policy can be sent through the <a href="/contact/">contact page</a>${C.email ? ` or to <a href="mailto:${esc(C.email)}">${esc(C.email)}</a>` : ''}.</p>
</div></section>`,
}));

page('/terms/', layout({
  title: `Terms and Conditions | ${BRAND}`,
  description: `The terms that apply when you use the ${BRAND} website and its vehicle listings.`,
  urlPath: '/terms/',
  body: `
<header class="page-head"><div class="wrap"><p class="kicker">Legal</p><h1>Terms and conditions</h1><p class="lede">Last updated ${UPDATED}.</p></div></header>
<section class="section"><div class="wrap prose prose--legal">
  <p>These terms apply to your use of this website, operated by ${esc(config.legalName || BRAND)} ("${BRAND}", "we", "us"). By using the website you accept them.</p>
  <h2>Vehicle listings</h2>
  <ul>
    <li>Listings are provided for information and are an invitation to enquire. They are not an offer that can be accepted online.</li>
    <li>We aim to keep specifications, kilometres, prices and availability accurate and up to date, but errors can occur and details can change. Please confirm all details with us before making any decision.</li>
    <li>A car marked as available may already be under discussion with another buyer. Availability is confirmed only when we confirm it to you directly.</li>
    <li>Asking prices are shown in Indian rupees and may exclude taxes, registration transfer, insurance and other charges unless stated otherwise.</li>
  </ul>
  <h2>Buying or selling a car</h2>
  <p>Any purchase or sale of a vehicle is governed by a separate written agreement between you and ${BRAND}. Nothing on this website forms part of that agreement unless it is expressly included in it. You should inspect any car, and review its documentation, before agreeing to buy it.</p>
  ${SELL ? `<h2>Information you send us</h2><p>When you send us details or photographs of a car, you confirm that the information is accurate to the best of your knowledge and that you are entitled to share it. Submitting a car does not create any obligation on either side to buy or sell.</p>` : ''}
  <h2>Photographs and content</h2>
  <p>Photographs of listed cars show the specific vehicle unless the listing states otherwise. Other photographs on this website, such as the homepage image, are illustrative and do not represent cars for sale. The design, text and branding of this website belong to ${BRAND} or its licensors and may not be reused without permission.</p>
  <h2>Use of the website</h2>
  <p>Please do not misuse the website, including by submitting false enquiries, attempting to interfere with its operation, or collecting data from it by automated means.</p>
  <h2>Links to other websites</h2>
  <p>Links to third-party services, such as WhatsApp or Google Maps, are provided for convenience. We are not responsible for their content or practices.</p>
  <h2>Liability</h2>
  <p>To the extent permitted by law, ${BRAND} is not liable for any loss arising from reliance on information on this website without confirming it with us. Nothing in these terms limits any liability that cannot be limited under applicable law.</p>
  <h2>Governing law</h2>
  <p>These terms are governed by the laws of India.</p>
  <h2>Changes</h2>
  <p>We may update these terms from time to time. The date at the top of this page shows when they were last changed.</p>
  <h2>Contact</h2>
  <p>Questions about these terms can be sent through the <a href="/contact/">contact page</a>.</p>
</div></section>`,
}));

// 404
page('/404.html', layout({
  title: `Page not found | ${BRAND}`,
  description: 'The page you were looking for could not be found.',
  urlPath: '/404.html',
  noindex: true,
  body: `
<section class="notfound"><div class="wrap">
  <p class="code" aria-hidden="true">404</p>
  <h1 class="h2">This page is not in the collection.</h1>
  <p class="lede">The link may be out of date, or the car may no longer be listed.</p>
  <div class="hero__ctas"><a class="btn" href="/inventory/">Browse the collection</a><a class="btn btn--ghost" href="/">Return home</a></div>
</div></section>`,
}), { sitemap: false });

// ---------------------------------------------------------------- write pages
for (const p of pages) {
  fs.mkdirSync(path.dirname(p.file), { recursive: true });
  fs.writeFileSync(p.file, p.html);
}

// robots, sitemap, manifest, headers
fs.writeFileSync(path.join(OUT, 'robots.txt'), INDEXABLE
  ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
  : `# Indexing disabled: ${DEMO ? 'demo build' : 'siteUrl is not set in src/config.json'}.\nUser-agent: *\nDisallow: /\n`);
if (INDEXABLE) {
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.sitemap).map((p) => `  <url><loc>${esc(abs(p.urlPath))}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
}
fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({ name: BRAND, short_name: BRAND, start_url: '/', display: 'browser', background_color: '#0a0a0b', theme_color: '#0a0a0b', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] }, null, 2));

const formOrigin = FORM_ENDPOINT ? new URL(FORM_ENDPOINT).origin : '';
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://images.unsplash.com",
  `connect-src 'self'${formOrigin ? ' ' + formOrigin : ''}`,
  `form-action 'self'${formOrigin ? ' ' + formOrigin : ''}`,
  `frame-src ${C.mapsEmbedUrl ? 'https://www.google.com' : "'none'"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
fs.writeFileSync(path.join(OUT, '_headers'), `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
${DEMO || !SITE ? '  X-Robots-Tag: noindex\n' : ''}
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

// ---------------------------------------------------------------- QA checks
const errors = [];
const files = new Set(pages.map((p) => p.file));
for (const p of pages) {
  const text = p.html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  if (/\u2014/.test(text)) errors.push(`${p.urlPath}: contains an em dash`);
  if ((p.html.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${p.urlPath}: should have exactly one <h1>`);
  if (/<img(?![^>]*\balt=)[^>]*>/.test(p.html)) errors.push(`${p.urlPath}: <img> without alt`);
  if (/\sstyle="/.test(p.html)) errors.push(`${p.urlPath}: inline style attribute (blocked by CSP)`);
  for (const m of p.html.matchAll(/href="(\/[^"#?]*)/g)) {
    const h = m[1];
    if (h.startsWith('/assets/')) continue;
    const target = h.endsWith('/') ? path.join(OUT, h, 'index.html') : path.join(OUT, h);
    if (!files.has(target) && !fs.existsSync(target)) errors.push(`${p.urlPath}: broken link ${h}`);
  }
  for (const m of p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { errors.push(`${p.urlPath}: invalid JSON-LD`); }
  }
}
for (const f of ['favicon-32.png', 'apple-touch-icon.png', 'og-image.png']) if (!fs.existsSync(path.join(OUT, f))) errors.push(`missing static file ${f}`);

const blockers = [];
if (!SITE) blockers.push('siteUrl (custom domain) is not set: canonicals, sitemap and indexing are disabled');
if (!FORM_ENDPOINT) blockers.push('forms.endpoint is not set: enquiry forms cannot deliver messages');
if (!C.phone && !C.email && !C.whatsapp) blockers.push('no verified phone, WhatsApp or email in contact');
if (!vehicles.length) blockers.push('src/data/vehicles.json is empty: the collection shows its empty state');
if (!config.legalName) blockers.push('legalName is not set: legal pages name the brand, not the registered entity');

console.log(`Built ${pages.length} pages to dist/ (${DEMO ? 'DEMO data, noindex' : 'production data'}; ${vehicles.length} vehicles).`);
if (errors.length) { console.error('QA errors:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('QA checks passed: one h1 per page, alt text, internal links, JSON-LD, no em dashes, no inline styles.');
if (blockers.length) {
  console.log('\nLaunch blockers:\n  - ' + blockers.join('\n  - '));
  if (STRICT) process.exit(2);
}
