/* Loaded in <head> (tiny, blocking on purpose).
   1. Adds html.js so motion starting states apply before first paint. If the motion script has
      not started within 3 seconds the class is removed, so content can never stay hidden.
   2. Page transitions: when you open a car from a list, its photo morphs into the gallery on the
      car's page (cross-document View Transitions; browsers without support simply navigate). */
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  setTimeout(function () { if (!window.__aspecsMotion) html.classList.remove('js'); }, 3000);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var NAME = 'vehicle-photo';
  var CAR = /^\/inventory\/[^/]+\/$/;

  // Outgoing page: tag the photo of the card being opened.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var to = new URL(e.activation.entry.url);
    if (!CAR.test(to.pathname)) return;
    var link = document.querySelector('.card__title a[href="' + to.pathname + '"]');
    var img = link && link.closest('.card').querySelector('.card__media img');
    if (!img) return;
    img.style.viewTransitionName = NAME;
    e.viewTransition.finished.finally(function () { img.style.viewTransitionName = ''; });
  });

  // Incoming car page: tag the gallery photo so the two snapshots morph.
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var nav = window.navigation;
    var from = nav && nav.activation && nav.activation.from;
    if (!from || from.url === location.href) return;
    var box = document.getElementById(NAME);
    if (!box) return;
    var img = box.querySelector('img');
    box.classList.add('is-loaded');
    img.style.viewTransitionName = NAME;
    e.viewTransition.finished.finally(function () { img.style.viewTransitionName = ''; });
  });
})();
