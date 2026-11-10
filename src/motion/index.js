/* A-SPECS motion layer, built on Motion (the library formerly called Framer Motion).
   Bundled by scripts/build.mjs with esbuild into dist/assets/motion.js, so only the
   functions imported here ship to the browser.

   Covers: hero entrance and scroll choreography, word-by-word heading reveals, staggered
   section reveals, the category marquee, the tachometer graphic, the scroll progress line,
   spring tilt + clipped-circle reveal on vehicle cards, button press springs, the mobile menu,
   and helpers that inventory.js uses for layout animation when filters change.

   prefers-reduced-motion: everything is skipped and content is shown immediately.
   Pointer effects (tilt, circle reveal) run only on devices with a fine pointer. */
import { animate, scroll, inView, stagger, press } from 'motion';

window.__aspecsMotion = true;

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

const EASE_OUT = [0.16, 1, 0.3, 1];
const SPRING_SOFT = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };
const SPRING_TILT = { type: 'spring', stiffness: 220, damping: 22 };

// Shared with inventory.js (layout animation on filter/sort).
window.ASPECS_MOTION = { animate, stagger, reduce };

// ------------------------------------------------------------------ image fade-in
$$('.card__media img, .gallery__main img').forEach((img) => {
  const box = img.parentElement;
  const done = () => box.classList.add('is-loaded');
  if (img.complete && img.naturalWidth) done();
  else { img.addEventListener('load', done); img.addEventListener('error', done); }
});

// ------------------------------------------------------------------ header hide/show
const header = $('.site-header');
if (header && !reduce) {
  let lastY = window.scrollY;
  scroll(() => {
    const y = window.scrollY;
    const menuOpen = document.body.classList.contains('menu-open');
    if (!menuOpen && y > 240 && y > lastY + 4) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 240 || menuOpen) header.classList.remove('is-hidden');
    lastY = y;
  });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
}

if (reduce) {
  // Show everything that would otherwise wait for an animation.
  $$('[data-reveal], [data-reveal-group]').forEach((el) => el.classList.add('is-in'));
} else {
  runMotion();
}

function runMotion() {
  // ---------------------------------------------------------------- word splitting
  // Wraps each word in a mask so it can rise into view. Text stays real text for
  // screen readers and search engines; only inline spans are added.
  function splitWords(el) {
    if (el.dataset.splitDone) return $$('.wi', el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
            w.appendChild(wi); frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.classList.contains('w')) {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = '1';
    return $$('.wi', el);
  }

  // ---------------------------------------------------------------- scroll progress line
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  scroll(animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }));

  // ---------------------------------------------------------------- hero
  const hero = $('.hero');
  if (hero) {
    const media = $('.hero__media', hero);
    const img = $('img', media);
    const copy = $('.hero__copy', hero);
    const h1 = $('h1', hero);
    const words = splitWords(h1);

    animate(img, { scale: [1.18, 1] }, { duration: 2.6, ease: EASE_OUT });
    animate(media, { opacity: [0, 1] }, { duration: 1.2, ease: 'easeOut' });
    animate($('.kicker', copy), { opacity: [0, 1], x: [-16, 0] }, { duration: 0.9, delay: 0.15, ease: EASE_OUT });
    animate(h1, { opacity: 1 }, { duration: 0 });
    animate(words, { y: ['110%', '0%'], rotate: [4, 0] }, { delay: stagger(0.07, { startDelay: 0.25 }), duration: 1.1, ease: EASE_OUT });
    animate($$('.lede, .hero__ctas', copy), { opacity: [0, 1], y: [28, 0] }, { delay: stagger(0.12, { startDelay: 0.75 }), duration: 1, ease: EASE_OUT });
    animate($$('.hero__index a', hero), { opacity: [0, 1], y: [24, 0] }, { delay: stagger(0.09, { startDelay: 1.0 }), duration: 0.9, ease: EASE_OUT });
    animate($('.hero__index', hero), { borderTopColor: ['rgba(58,58,63,0)', 'rgba(58,58,63,1)'] }, { duration: 1.4, delay: 0.9 });

    // As the hero scrolls away: photo drifts and deepens, copy lifts and fades.
    scroll(animate(media, { y: ['0%', '22%'], scale: [1, 1.06] }, { ease: 'linear' }), { target: hero, offset: ['start start', 'end start'] });
    scroll(animate(copy, { y: [0, -80], opacity: [1, 0] }, { ease: 'linear' }), { target: hero, offset: ['start start', 'end 30%'] });
  }

  // ---------------------------------------------------------------- headings: word rise
  $$('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return;
    const words = splitWords(el);
    animate(words, { y: '110%' }, { duration: 0 });
    inView(el, () => {
      animate(words, { y: ['110%', '0%'] }, { delay: stagger(0.045), duration: 0.95, ease: EASE_OUT });
    }, { amount: 0.4 });
  });

  // ---------------------------------------------------------------- section reveals
  $$('[data-reveal]').forEach((el) => {
    inView(el, () => {
      el.classList.add('is-in');
      animate(el, { opacity: [0, 1], y: [40, 0] }, { duration: 1, ease: EASE_OUT });
    }, { amount: 0.15, margin: '0px 0px -8% 0px' });
  });
  $$('[data-reveal-group]').forEach((group) => {
    inView(group, () => {
      group.classList.add('is-in');
      const kids = Array.from(group.children);
      animate(kids, { opacity: [0, 1], y: [48, 0] }, { delay: stagger(0.09), duration: 1.05, ease: EASE_OUT });
    }, { amount: 0.1, margin: '0px 0px -8% 0px' });
  });

  // Category index: the rule under each row draws across as the list arrives.
  $$('.cat-index li').forEach((li) => {
    const rule = document.createElement('span');
    rule.className = 'cat-rule';
    rule.setAttribute('aria-hidden', 'true');
    li.appendChild(rule);
  });
  const catIndex = $('.cat-index');
  if (catIndex) {
    inView(catIndex, () => {
      animate($$('.cat-rule', catIndex), { scaleX: [0, 1] }, { delay: stagger(0.08, { startDelay: 0.2 }), duration: 1.2, ease: EASE_OUT });
    }, { amount: 0.2 });
  }

  // ---------------------------------------------------------------- marquee
  const track = $('.marquee__track');
  if (track) {
    const loop = animate(track, { x: ['0%', '-50%'] }, { duration: 48, ease: 'linear', repeat: Infinity });
    // Scrolling makes the band surge, then it eases back to cruising speed.
    let lastY = window.scrollY, boost = 1;
    scroll(() => {
      const v = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      boost = Math.min(1 + v / 18, 6);
    });
    let running = false;
    const settle = () => {
      if (!running) return;
      boost += (1 - boost) * 0.06;
      loop.speed = boost;
      requestAnimationFrame(settle);
    };
    inView(track.parentElement, () => {
      loop.play();
      running = true;
      requestAnimationFrame(settle);
      return () => { loop.pause(); running = false; };
    });
  }

  // ---------------------------------------------------------------- tachometer graphic
  const tach = $('.tach');
  if (tach) {
    const needle = $('.tach__needle', tach);
    const arc = $('.tach__arc', tach);
    const red = $('.tach__red', tach);
    const ticks = $$('.tach__tick', tach);
    const nums = $$('.tach__num', tach);
    const IDLE = 'rotate(-96deg)';
    animate([arc, red], { strokeDashoffset: 1 }, { duration: 0 });
    animate(ticks, { opacity: 0 }, { duration: 0 });
    animate(nums, { opacity: 0 }, { duration: 0 });
    animate(needle, { transform: 'rotate(-120deg)' }, { duration: 0 });
    const rev = () => animate(needle,
      { transform: ['rotate(-120deg)', 'rotate(88deg)', 'rotate(64deg)', IDLE] },
      { duration: 2.4, times: [0, 0.38, 0.5, 1], ease: ['easeIn', 'easeOut', [0.16, 1, 0.3, 1]] });
    inView(tach, () => {
      animate(arc, { strokeDashoffset: [1, 0] }, { duration: 1.4, ease: EASE_OUT });
      animate(red, { strokeDashoffset: [1, 0] }, { duration: 0.8, delay: 1.0, ease: EASE_OUT });
      animate(ticks, { opacity: [0, 1] }, { delay: stagger(0.03, { startDelay: 0.2 }), duration: 0.3 });
      animate(nums, { opacity: [0, 1], y: [6, 0] }, { delay: stagger(0.06, { startDelay: 0.4 }), duration: 0.5 });
      setTimeout(rev, 900);
    }, { amount: 0.5 });
    // Blip the throttle on hover or tap.
    tach.addEventListener('pointerenter', rev);
  }

  // ---------------------------------------------------------------- button press
  press('.btn', (el) => {
    animate(el, { scale: 0.96 }, { duration: 0.12 });
    return () => animate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 18 });
  });

  // ---------------------------------------------------------------- mobile menu
  const menuBtn = $('.menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      if (menuBtn.getAttribute('aria-expanded') !== 'true') return;
      animate($$('.nav__list li, .nav > .btn'), { opacity: [0, 1], y: [24, 0] }, { delay: stagger(0.06, { startDelay: 0.05 }), duration: 0.6, ease: EASE_OUT });
    });
  }

  // ---------------------------------------------------------------- preload detail photo
  // Hovering or touching a card starts loading the photo its page opens with, which also
  // lets the card-to-gallery page transition morph a real image.
  const preloaded = new Set();
  $$('.card').forEach((card) => {
    const img = $('.card__media img', card);
    const warm = () => {
      if (!img || preloaded.has(img.src)) return;
      preloaded.add(img.src);
      const link = document.createElement('link');
      link.rel = 'preload'; link.as = 'image';
      link.href = img.getAttribute('src');
      if (img.getAttribute('srcset')) {
        link.setAttribute('imagesrcset', img.getAttribute('srcset'));
        link.setAttribute('imagesizes', '(max-width: 1000px) 100vw, 60vw');
      }
      document.head.appendChild(link);
    };
    card.addEventListener('pointerenter', warm, { passive: true });
    card.addEventListener('touchstart', warm, { passive: true });
    card.addEventListener('focusin', warm);
  });

  if (!finePointer) return;

  // ---------------------------------------------------------------- card tilt (Motion springs)
  // Port of tilt.tsx: perspective 1000px, rotateX from pointer y, rotateY from pointer x,
  // with the photo drifting the opposite way for depth.
  $$('.card').forEach((card) => {
    const img = $('.card__media img', card);
    const MAX = 6;
    let rect = null;
    animate(card, { transformPerspective: 1000 }, { duration: 0 });
    card.addEventListener('pointerenter', () => {
      rect = card.getBoundingClientRect();
      animate(card, { scale: 1.02 }, SPRING_TILT);
      if (img) animate(img, { scale: 1.08 }, SPRING_SOFT);
    });
    card.addEventListener('pointermove', (e) => {
      if (!rect) rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      animate(card, { rotateX: y * 2 * MAX, rotateY: -x * 2 * MAX }, SPRING_TILT);
      if (img) animate(img, { x: -x * 14, y: -y * 10 }, SPRING_SOFT);
    });
    card.addEventListener('pointerleave', () => {
      rect = null;
      animate(card, { rotateX: 0, rotateY: 0, scale: 1 }, SPRING_SOFT);
      if (img) animate(img, { x: 0, y: 0, scale: 1 }, SPRING_SOFT);
    });
    window.addEventListener('scroll', () => { rect = null; }, { passive: true });
  });

  // ---------------------------------------------------------------- clipped circle reveal
  // Port of clipped-circle.tsx: a circle grows from the pointer and reveals a light copy of
  // the card's details (clip-path on a duplicate, so photographs are never colour-inverted).
  const toTag = (node, tag) => {
    const repl = document.createElement(tag);
    repl.className = node.className;
    while (node.firstChild) repl.appendChild(node.firstChild);
    node.replaceWith(repl);
  };
  $$('.card').forEach((card) => {
    const body = $('.card__body', card);
    if (!body) return;
    const layer = body.cloneNode(true);
    layer.classList.add('card__invert');
    layer.setAttribute('aria-hidden', 'true');
    $$('[id]', layer).forEach((n) => n.removeAttribute('id'));
    $$('a', layer).forEach((a) => toTag(a, 'span'));
    $$('h1, h2, h3, h4', layer).forEach((h) => toTag(h, 'div'));
    card.appendChild(layer);
    const size = () => { layer.style.top = body.offsetTop + 'px'; layer.style.height = body.offsetHeight + 'px'; };
    size();
    window.addEventListener('resize', size);
    const place = (e) => {
      const r = layer.getBoundingClientRect();
      layer.style.setProperty('--cx', (e.clientX - r.left) + 'px');
      layer.style.setProperty('--cy', (e.clientY - r.top) + 'px');
    };
    card.addEventListener('pointerenter', (e) => {
      size();
      layer.classList.add('no-move');
      place(e);
      requestAnimationFrame(() => { layer.classList.remove('no-move'); card.classList.add('is-hot'); });
    });
    card.addEventListener('pointermove', place);
    card.addEventListener('pointerleave', (e) => { place(e); card.classList.remove('is-hot'); });
  });
}
