/* A-SPECS site script: navigation, gallery, forms. No dependencies. */
(function () {
  'use strict';

  // ---------- Mobile navigation ----------
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    var setMenu = function (open) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      // Start the panel exactly below the header, wherever the header currently sits.
      if (open) nav.style.top = Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom) + 'px';
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  // ---------- Gallery ----------
  var gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    var main = gallery.querySelector('.gallery__main img');
    var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.gallery__thumbs button'));
    var count = gallery.querySelector('.gallery__count');
    var idx = 0;
    var show = function (i) {
      if (!thumbs.length) return;
      idx = (i + thumbs.length) % thumbs.length;
      var t = thumbs[idx];
      main.src = t.getAttribute('data-src');
      main.srcset = t.getAttribute('data-srcset') || '';
      main.alt = t.getAttribute('data-alt');
      if (main.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        main.animate([{ opacity: 0.2, transform: 'scale(1.02)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 550, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      thumbs.forEach(function (b, j) { b.setAttribute('aria-current', j === idx ? 'true' : 'false'); });
      if (count) count.textContent = (idx + 1) + ' / ' + thumbs.length;
    };
    thumbs.forEach(function (b, j) { b.addEventListener('click', function () { show(j); }); });
    var prev = gallery.querySelector('.gallery__nav--prev');
    var next = gallery.querySelector('.gallery__nav--next');
    if (prev) prev.addEventListener('click', function () { show(idx - 1); });
    if (next) next.addEventListener('click', function () { show(idx + 1); });
    gallery.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
    });
  }

  // ---------- Forms ----------
  var MAX_FILES = 8;
  var MAX_FILE_MB = 8;
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  function fieldOf(el) { return el.closest('.field'); }
  function setError(el, msg) {
    var f = fieldOf(el); if (!f) return;
    var err = f.querySelector('.field__err');
    f.classList.toggle('has-error', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  }
  function messageFor(el) {
    var v = el.validity;
    var label = (fieldOf(el) && fieldOf(el).querySelector('label')) ? fieldOf(el).querySelector('label').textContent.replace('*', '').trim() : 'This field';
    if (v.valueMissing) return el.type === 'checkbox' ? 'Please confirm to continue.' : label + ' is required.';
    if (v.typeMismatch && el.type === 'email') return 'Enter a valid email address, for example name@domain.com.';
    if (v.patternMismatch && el.name === 'phone') return 'Enter a valid phone number with 10 to 15 digits.';
    if (v.rangeUnderflow || v.rangeOverflow) return 'Enter a value between ' + el.min + ' and ' + el.max + '.';
    if (v.tooShort) return label + ' is too short.';
    if (v.tooLong) return label + ' is too long.';
    if (v.badInput || v.stepMismatch) return 'Enter a whole number.';
    if (el.name === 'phone' && el.value) {
      var d = el.value.replace(/\D/g, '').length;
      if (d < 10 || d > 15) return 'Enter a valid phone number with 10 to 15 digits.';
    }
    return '';
  }
  function validateFiles(input) {
    if (!input || !input.files) return '';
    if (input.files.length > MAX_FILES) return 'Please attach up to ' + MAX_FILES + ' photographs.';
    for (var i = 0; i < input.files.length; i++) {
      var f = input.files[i];
      if (ALLOWED_TYPES.indexOf(f.type) === -1 && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) return f.name + ' is not a supported image type.';
      if (f.size > MAX_FILE_MB * 1024 * 1024) return f.name + ' is larger than ' + MAX_FILE_MB + ' MB.';
    }
    return '';
  }

  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var started = Date.now();
    var status = form.querySelector('.form-status');
    var submit = form.querySelector('button[type="submit"]');
    var endpoint = form.getAttribute('data-endpoint') || '';
    var fallback = form.getAttribute('data-fallback') || '';

    var showStatus = function (kind, html) {
      status.className = 'form-status is-visible form-status--' + kind;
      status.innerHTML = html;
      status.focus();
    };

    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'hidden' || el.closest('.hp')) return;
      el.addEventListener('blur', function () {
        if (el.type === 'file') { setError(el, validateFiles(el)); return; }
        if (el.value || el.type === 'checkbox') setError(el, messageFor(el));
      });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') setError(el, el.type === 'file' ? validateFiles(el) : messageFor(el)); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';

      // Client-side validation
      var firstBad = null;
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        if (el.type === 'hidden' || el.closest('.hp')) return;
        var msg = el.type === 'file' ? validateFiles(el) : messageFor(el);
        setError(el, msg);
        if (msg && !firstBad) firstBad = el;
      });
      if (firstBad) {
        showStatus('err', 'Please correct the highlighted fields.');
        firstBad.focus();
        return;
      }

      // Spam signals: honeypot filled or submitted implausibly fast
      var hp = form.querySelector('.hp input');
      if ((hp && hp.value) || Date.now() - started < 2500) {
        showStatus('err', 'Your message could not be sent. Please wait a moment and try again.');
        return;
      }

      if (!endpoint) {
        showStatus('err', 'Online enquiries are not connected yet, so this message has <strong>not</strong> been sent.' + (fallback ? ' ' + fallback : ''));
        return;
      }

      var data = new FormData(form);
      if (hp) data.delete(hp.name);
      submit.disabled = true;
      var label = submit.textContent;
      submit.textContent = 'Sending';

      fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok || body.success === false || body.ok === false) throw new Error((body && (body.message || body.error)) || 'Request failed');
          });
        })
        .then(function () {
          form.reset();
          form.querySelectorAll('[aria-invalid]').forEach(function (el) { setError(el, ''); });
          showStatus('ok', form.getAttribute('data-success') || 'Thank you. Your message has been sent.');
        })
        .catch(function () {
          showStatus('err', 'Your message could not be sent because of a connection or service error. Please try again.' + (fallback ? ' ' + fallback : ''));
        })
        .then(function () { submit.disabled = false; submit.textContent = label; started = Date.now(); });
    });
  });
})();
