/* Mājaslapu izstrāde: SEO rentgens + veida pārslēgs. Bez bibliotēkām, lazy init. */
(function () {
  'use strict';

  function lazy(el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); fn(); }
    }, { rootMargin: '300px' });
    io.observe(el);
  }

  /* ---------- X-ray ---------- */
  function initXray(root) {
    var view = root.querySelector('.xray__view');
    var lens = root.querySelector('.xray__lens');
    var read = root.querySelector('[data-read]');
    var boxes = [].slice.call(root.querySelectorAll('.xr-box'));
    var hint = root.getAttribute('data-hint');
    var w = 0, h = 0, r = 90, x = 0, y = 0, cur = null;

    function measure() {
      var b = view.getBoundingClientRect();
      w = b.width; h = b.height;
      r = Math.max(56, Math.min(110, w * 0.17));
      view.style.setProperty('--r', r + 'px');
    }
    function pick() {
      var best = null, bd = 1e9;
      boxes.forEach(function (bx) {
        var l = bx.offsetLeft, t = bx.offsetTop, rr = l + bx.offsetWidth, bb = t + bx.offsetHeight;
        var dx = Math.max(l - x, 0, x - rr), dy = Math.max(t - y, 0, y - bb);
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = bx; }
      });
      if (bd > r * 0.9) best = null;
      if (best !== cur) {
        if (cur) cur.classList.remove('is-on');
        cur = best;
        if (cur) cur.classList.add('is-on');
        read.textContent = cur ? cur.getAttribute('data-d') : hint;
      }
    }
    function set(nx, ny) {
      x = Math.max(0, Math.min(w, nx));
      y = Math.max(0, Math.min(h, ny));
      view.style.setProperty('--x', x + 'px');
      view.style.setProperty('--y', y + 'px');
      pick();
    }
    function local(e) {
      var b = view.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    }

    measure();
    root.classList.add('is-on');
    set(w * 0.3, h * 0.34);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { var fx = x / (w || 1), fy = y / (h || 1); measure(); set(fx * w, fy * h); }).observe(view);
    }

    var drag = false;
    function down(e) {
      if (e.button) return;
      drag = true;
      try { view.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.target !== lens && !lens.contains(e.target)) { var p = local(e); set(p[0], p[1]); }
      lens.focus({ preventScroll: true });
      e.preventDefault();
    }
    lens.addEventListener('pointerdown', down);
    view.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch' && !lens.contains(e.target)) down(e); });
    view.addEventListener('pointermove', function (e) { if (drag) { var p = local(e); set(p[0], p[1]); } });
    function up() { drag = false; }
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);

    /* touch: pieskāriens tukšā vietā pārliek lēcu, pārvilkšana (ritināšana) to neietekmē */
    var tx = null;
    view.addEventListener('touchstart', function (e) { tx = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    view.addEventListener('touchend', function (e) {
      if (!tx || e.target === lens || lens.contains(e.target)) { tx = null; return; }
      var t = e.changedTouches[0];
      if (Math.abs(t.clientX - tx[0]) < 8 && Math.abs(t.clientY - tx[1]) < 8) {
        var b = view.getBoundingClientRect();
        set(t.clientX - b.left, t.clientY - b.top);
      }
      tx = null;
    }, { passive: true });

    lens.addEventListener('keydown', function (e) {
      var s = e.shiftKey ? 48 : 16, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      if (!m) return;
      e.preventDefault();
      set(x + m[0], y + m[1]);
    });
  }

  /* ---------- Veida pārslēgs ---------- */
  function initPick(root) {
    var btns = [].slice.call(root.querySelectorAll('.pick__b'));
    var price = root.querySelector('[data-price]');
    var name = root.querySelector('[data-name]');
    var sum = root.querySelector('[data-sum]');
    var cards = [].slice.call(root.parentNode.querySelectorAll('.grid-4 > .item')).slice(0, 3);
    if (!cards.length) return;

    function show(i) {
      btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      cards.forEach(function (c, k) { c.classList.toggle('is-picked', k === i); });
      root.setAttribute('data-t', i);
      var c = cards[i];
      price.textContent = (c.querySelector('.item__foot strong') || {}).textContent || '';
      name.textContent = (c.querySelector('.item__title') || {}).textContent || '';
      sum.textContent = (c.querySelector('.item__text') || {}).textContent || '';
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus(); show(n);
      });
    });
    root.hidden = false;
    show(0);
  }

  var xr = document.querySelector('[data-xray]');
  lazy(xr, function () { initXray(xr); });
  var pk = document.querySelector('[data-pick]');
  if (pk) initPick(pk);
})();
