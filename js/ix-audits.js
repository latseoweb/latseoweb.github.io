/* Bezmaksas audits: trīs soļu celiņš. Teksts paliek HTML; šis tikai izceļ soli un rāda ilustrāciju. */
(function () {
  'use strict';
  var ax = document.querySelector('[data-ax]');
  if (!ax) return;
  function start() {
    var sec = ax.closest('section'), lis = [].slice.call(sec.querySelectorAll('.steps li'));
    var ns = [].slice.call(ax.querySelectorAll('.ax__n')), gs = [].slice.call(ax.querySelectorAll('.ax__g'));
    var next = ax.querySelector('.ax__next'), cur = -1, fig = ax.querySelector('.ax__fig');
    gs.forEach(function (g) {
      [].forEach.call(g.querySelectorAll('rect,path,text'), function (e, k) {
        e.style.setProperty('--d', (k * 0.09).toFixed(2) + 's');
        if (e.getTotalLength) { try { e.style.setProperty('--len', Math.ceil(e.getTotalLength()) + ''); } catch (x) { e.style.setProperty('--len', '400'); } }
      });
    });
    ax.setAttribute('data-ix-tilt', '');
    if (window.IX && typeof window.IX.tilt === 'function') window.IX.tilt(ax);
    else if (matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ax.addEventListener('pointermove', function (e) {
        var r = ax.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        ax.style.setProperty('--ix-rx', (-y * 3).toFixed(2) + 'deg'); ax.style.setProperty('--ix-ry', (x * 4).toFixed(2) + 'deg');
      });
      ax.addEventListener('pointerleave', function () { ax.style.setProperty('--ix-rx', '0deg'); ax.style.setProperty('--ix-ry', '0deg'); });
    }
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
