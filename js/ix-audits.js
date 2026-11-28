/* Bezmaksas audits: trīs soļu celiņš. Teksts paliek HTML; šis tikai izceļ soli un rāda ilustrāciju. */
(function () {
  'use strict';
  /* atradumi: 40 lapu režģis, 10 iekļautas sitemap.xml */
  var grid = document.querySelector('.af__grid');
  if (grid) { var h = ''; for (var g = 0; g < 40; g++) h += '<span' + (g < 10 ? ' class="on"' : '') + '></span>'; grid.innerHTML = h; }
  var ax = document.querySelector('[data-ax]');
  if (!ax) return;
  function start() {
    var sec = ax.closest('section'), lis = [].slice.call(sec.querySelectorAll('.steps li'));
    var ns = [].slice.call(ax.querySelectorAll('.ax__n')), gs = [].slice.call(ax.querySelectorAll('.ax__g'));
    var next = ax.querySelector('.ax__next'), cur = -1, fig = ax.querySelector('.ax__fig');
    var cap = fig.querySelector('figcaption');
    gs.forEach(function (g) {
      [].forEach.call(g.querySelectorAll('rect,path,text'), function (e, k) {
        e.style.setProperty('--d', (k * 0.09).toFixed(2) + 's');
        if (e.getTotalLength) { try { e.style.setProperty('--len', Math.ceil(e.getTotalLength()) + ''); } catch (x) { e.style.setProperty('--len', '400'); } }
      });
    });
    function go(i, focus) {
      cur = i;
      ns.forEach(function (n, k) {
        if (k === i) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
        n.classList.toggle('is-past', k < i);
      });
      gs.forEach(function (g, k) { g.classList.toggle('is-cur', k === i); });
      lis.forEach(function (l, k) { l.classList.toggle('is-cur', k === i); });
      ax.style.setProperty('--p', i * 50);
      fig.setAttribute('data-f', '0' + (i + 1));
      if (cap && cap.getAttribute('data-c' + i)) cap.textContent = cap.getAttribute('data-c' + i);
      next.textContent = i < 2 ? 'Nākamais solis' : 'Atkārtot no 1. soļa';
      if (focus) ns[i].focus();
    }
    ns.forEach(function (n, k) {
      n.addEventListener('click', function () { go(k); });
      n.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d && ns[k + d]) { e.preventDefault(); go(k + d, true); }
      });
    });
    lis.forEach(function (l, k) { l.addEventListener('click', function () { go(k); }); l.style.cursor = 'pointer'; });
    next.addEventListener('click', function () { go(cur < 2 ? cur + 1 : 0); });
    sec.classList.add('ax-on');
    ax.hidden = false;
    go(0);
  }
  if (!('IntersectionObserver' in window)) { start(); return; }
  var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '300px' });
  io.observe(ax.parentNode);
})();
