/* Inventory search, filter and sort. Cards are server-rendered; this script
   shows, hides and reorders them, and keeps the state in the URL so filtered
   views can be shared and linked (for example /inventory/?category=supercar). */
(function () {
  'use strict';
  var form = document.getElementById('inv-filters');
  var grid = document.getElementById('inv-grid');
  if (!form || !grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var countEl = document.getElementById('inv-count');
  var noResults = document.getElementById('inv-none');
  var sortSel = document.getElementById('inv-sort');
  var toggle = document.querySelector('.filters-toggle');
  var MULTI = ['category', 'body', 'fuel', 'trans'];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var firstRun = true, prevKey = '';

  function num(v) { return v === '' || v == null ? null : Number(v); }

  function readState() {
    var s = { q: form.q.value.trim().toLowerCase(), sort: sortSel.value, sold: form.sold.checked };
    MULTI.forEach(function (k) {
      s[k] = Array.prototype.slice.call(form.querySelectorAll('input[name="' + k + '"]:checked')).map(function (i) { return i.value; });
    });
    s.pmin = num(form.pmin.value); s.pmax = num(form.pmax.value);
    s.ymin = num(form.ymin.value); s.ymax = num(form.ymax.value);
    return s;
  }

  function writeUrl(s) {
    var p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    MULTI.forEach(function (k) { if (s[k].length) p.set(k, s[k].join(',')); });
    ['pmin', 'pmax', 'ymin', 'ymax'].forEach(function (k) { if (s[k] != null) p.set(k, s[k]); });
    if (s.sold) p.set('sold', '1');
    if (s.sort !== 'newest') p.set('sort', s.sort);
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) form.q.value = p.get('q');
    MULTI.forEach(function (k) {
      var vals = (p.get(k) || '').split(',').filter(Boolean);
      form.querySelectorAll('input[name="' + k + '"]').forEach(function (i) { i.checked = vals.indexOf(i.value) !== -1; });
    });
    ['pmin', 'pmax', 'ymin', 'ymax'].forEach(function (k) {
      var v = p.get(k);
      if (v != null && form[k].querySelector('option[value="' + v + '"]')) form[k].value = v;
    });
    form.sold.checked = p.get('sold') === '1';
    var sort = p.get('sort');
    if (sort && sortSel.querySelector('option[value="' + sort + '"]')) sortSel.value = sort;
  }

  function matches(c, s) {
    var d = c.dataset;
    if (!s.sold && d.status === 'sold') return false;
    if (s.q && d.q.indexOf(s.q) === -1) {
      // every word must match somewhere
      var words = s.q.split(/\s+/);
      for (var i = 0; i < words.length; i++) if (d.q.indexOf(words[i]) === -1) return false;
    }
    if (s.category.length && s.category.indexOf(d.category) === -1) return false;
    if (s.body.length && s.body.indexOf(d.body) === -1) return false;
    if (s.fuel.length && s.fuel.indexOf(d.fuel) === -1) return false;
    if (s.trans.length && s.trans.indexOf(d.trans) === -1) return false;
    var price = num(d.price), year = num(d.year);
    // Price-on-request cars are excluded only when a price range is applied.
    if (s.pmin != null && (price == null || price < s.pmin)) return false;
    if (s.pmax != null && (price == null || price > s.pmax)) return false;
    if (s.ymin != null && year < s.ymin) return false;
    if (s.ymax != null && year > s.ymax) return false;
    return true;
  }

  function cmp(sort) {
    var big = Number.MAX_SAFE_INTEGER;
    return function (a, b) {
      var A = a.dataset, B = b.dataset;
      // Sold cars always sink to the end.
      var sa = A.status === 'sold' ? 1 : 0, sb = B.status === 'sold' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      switch (sort) {
        case 'price-asc': return (num(A.price) == null ? big : +A.price) - (num(B.price) == null ? big : +B.price);
        case 'price-desc': return (num(B.price) == null ? -1 : +B.price) - (num(A.price) == null ? -1 : +A.price);
        case 'year-desc': return +B.year - +A.year;
        case 'km-asc': return +A.km - +B.km;
        default: return B.listed.localeCompare(A.listed);
      }
    };
  }

  // Layout animation with Motion (window.ASPECS_MOTION, set by motion.js): cards that stay in
  // the results glide to their new slots on a spring; cards that appear are dealt in.
  function layoutAnimate(before, visible, first) {
    var M = window.ASPECS_MOTION;
    if (!M || M.reduce || reduce) { visible.forEach(function (c) { c.style.opacity = '1'; }); return; }
    var entering = [];
    visible.forEach(function (c) {
      var b = before.get(c);
      if (b && !first) {
        var a = c.getBoundingClientRect();
        var dx = b.left - a.left, dy = b.top - a.top;
        if (dx || dy) M.animate(c, { x: [dx, 0], y: [dy, 0] }, { type: 'spring', stiffness: 260, damping: 30 });
      } else {
        entering.push(c);
      }
    });
    if (entering.length) {
      M.animate(entering, { opacity: [0, 1], y: [36, 0], scale: [0.96, 1] },
        { delay: M.stagger(0.06, { startDelay: first ? 0.15 : 0 }), duration: 0.75, ease: [0.16, 1, 0.3, 1] });
    }
  }

  function apply() {
    var s = readState();
    if (s.pmin != null && s.pmax != null && s.pmin > s.pmax) { var t = s.pmin; s.pmin = s.pmax; s.pmax = t; }
    if (s.ymin != null && s.ymax != null && s.ymin > s.ymax) { var u = s.ymin; s.ymin = s.ymax; s.ymax = u; }
    // FLIP: remember where visible cards are before the change.
    var before = new Map();
    cards.forEach(function (c) { if (!c.hidden) before.set(c, c.getBoundingClientRect()); });

    var shown = 0, visible = [];
    cards.slice().sort(cmp(s.sort)).forEach(function (c) {
      var ok = matches(c, s);
      c.hidden = !ok;
      if (ok) { shown++; visible.push(c); }
      grid.appendChild(c);
    });

    var key = visible.map(function (c) { return c.dataset.listed + c.dataset.q; }).join('|');
    if (firstRun || key !== prevKey) layoutAnimate(before, visible, firstRun);
    prevKey = key; firstRun = false;
    countEl.innerHTML = '<strong>' + shown + '</strong> ' + (shown === 1 ? 'car' : 'cars') + ' shown';
    noResults.hidden = shown !== 0;
    writeUrl(s);
  }

  readUrl();
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
  sortSel.addEventListener('change', apply);
  document.querySelectorAll('[data-reset]').forEach(function (b) {
    b.addEventListener('click', function () { form.reset(); sortSel.value = 'newest'; apply(); });
  });
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      form.classList.toggle('is-open', open);
    });
  }
  apply();
})();
