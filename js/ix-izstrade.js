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

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* tilt + kursora gaisma uz tumšā paneļa (ja kopējais window.IX nav ielādēts) */
  function lift(el, max) {
    if (window.IX || reduce || !fine || !el) return;
    el.addEventListener('pointermove', function (e) {
      var b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
      el.style.setProperty('--mx', (px * 100) + '%'); el.style.setProperty('--my', (py * 100) + '%');
      el.style.setProperty('--ix-rx', ((px - .5) * max * 2).toFixed(2) + 'deg');
      el.style.setProperty('--ix-ry', ((.5 - py) * max * 2).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--ix-rx', '0deg'); el.style.setProperty('--ix-ry', '0deg'); });
  }

  /* skaitlis, kas saskaitās līdz vērtībai: "no 1 299 €" -> animē tikai ciparus */
  function countText(el, str) {
    var re = /\d[\d\s\u00a0\u202f,]*\d|\d/;
    var m = str.match(re), old = el._n;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (!m || reduce || old == null) { el.textContent = str; el._n = m ? parseInt(m[0].replace(/\D/g, ''), 10) : null; return; }
    var to = parseInt(m[0].replace(/\D/g, ''), 10), sep = /,/.test(m[0]) ? ',' : '\u00a0', pre = str.slice(0, m.index), post = str.slice(m.index + m[0].length);
    var t0 = performance.now(), dur = 650;
    function f(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + f(old + (to - old) * e) + post;
      if (k < 1) el._raf = requestAnimationFrame(tick); else { el.textContent = str; }
    })(t0);
    el._n = to;
  }

  var CODE = '<b>&lt;head&gt;</b>\n  &lt;title&gt;…&lt;/title&gt;\n  &lt;meta name="description" content="…"&gt;\n  &lt;link rel="canonical" href="https://…"&gt;\n  &lt;meta name="viewport" …&gt;\n  &lt;script type="application/ld+json"&gt;\n<b>&lt;/head&gt;</b>\n&lt;body&gt;\n  &lt;nav&gt;&lt;a href="/"&gt;…&lt;/a&gt;&lt;/nav&gt;\n  &lt;h1&gt;…&lt;/h1&gt;\n  &lt;h2&gt;…&lt;/h2&gt;\n  &lt;img src="…" alt="…" width height&gt;\n  &lt;p&gt;…&lt;/p&gt;&lt;p&gt;…&lt;/p&gt;\n  &lt;footer&gt;…&lt;/footer&gt;';

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

    var bp = root.querySelector('.xray__bp');
    if (bp) { var pre = document.createElement('pre'); pre.className = 'xr-code'; pre.setAttribute('aria-hidden', 'true'); pre.innerHTML = CODE; bp.insertBefore(pre, bp.firstChild); }
    measure();
    root.classList.add('is-on');
    if (!reduce) root.classList.add('is-idle');
    set(w * 0.3, h * 0.34);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { var fx = x / (w || 1), fy = y / (h || 1); measure(); set(fx * w, fy * h); }).observe(view);
    }

    var drag = false, vx = 0, vy = 0, lx = 0, ly = 0, lt = 0, raf = 0;
    function stopInertia() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function glide() {
      vx *= 0.93; vy *= 0.93;
      var nx = x + vx, ny = y + vy;
      if (nx < 0 || nx > w) { vx = -vx * 0.6; nx = Math.max(0, Math.min(w, nx)); }
      if (ny < 0 || ny > h) { vy = -vy * 0.6; ny = Math.max(0, Math.min(h, ny)); }
      set(nx, ny);
      raf = (Math.abs(vx) + Math.abs(vy) > 0.35) ? requestAnimationFrame(glide) : 0;
    }
    function down(e) {
      if (e.button) return;
      stopInertia(); vx = vy = 0; lt = 0;
      root.classList.remove('is-idle');
      view.classList.add('is-drag');
      drag = true;
      try { view.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.target !== lens && !lens.contains(e.target)) { var p = local(e); set(p[0], p[1]); }
      lens.focus({ preventScroll: true });
      e.preventDefault();
    }
    lens.addEventListener('pointerdown', down);
    view.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch' && !lens.contains(e.target)) down(e); });
    view.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = local(e), now = performance.now();
      if (lt) { var dt = Math.max(8, now - lt); vx = vx * 0.5 + (p[0] - lx) / dt * 16 * 0.5; vy = vy * 0.5 + (p[1] - ly) / dt * 16 * 0.5; }
      lx = p[0]; ly = p[1]; lt = now;
      set(p[0], p[1]);
    });
    function up() {
      if (!drag) return;
      drag = false; view.classList.remove('is-drag');
      if (!reduce && performance.now() - lt < 90 && Math.abs(vx) + Math.abs(vy) > 1) raf = requestAnimationFrame(glide);
    }
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
      stopInertia(); root.classList.remove('is-idle');
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

    var svg = root.querySelector('.pick__svg'), first = true;
    var groups = svg ? [svg.querySelector('.w-card'), svg.querySelector('.w-co'), svg.querySelector('.w-sh')] : [];
    /* līnijas "uzzīmējas": stroke-dashoffset no pilna garuma uz nulli */
    function drawGroup(i) {
      var g = groups[i];
      if (!g || reduce || !g.querySelectorAll) return;
      var els = g.querySelectorAll('path,rect'), n = 0;
      [].forEach.call(els, function (el) {
        var len = 0;
        try { len = el.getTotalLength ? el.getTotalLength() : 0; } catch (_) {}
        if (!len) return;
        el.style.transition = 'none';
        el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
        el.getBoundingClientRect();
        var d = Math.min(n++, 14) * 28;
        el.style.transition = 'stroke-dashoffset .7s ' + d + 'ms cubic-bezier(.3,.7,.2,1)';
        el.style.strokeDashoffset = 0;
        setTimeout(function () { el.style.transition = ''; el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; }, 800 + d);
      });
      [].forEach.call(g.querySelectorAll('text'), function (t) {
        t.style.opacity = 0; setTimeout(function () { t.style.opacity = ''; }, 500);
      });
    }
    function show(i) {
      btns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      cards.forEach(function (c, k) { c.classList.toggle('is-picked', k === i); });
      root.setAttribute('data-t', i);
      var c = cards[i];
      countText(price, (c.querySelector('.item__foot strong') || {}).textContent || '');
      if (!first) drawGroup(i);
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
    show(0); first = false;
    lift(root.querySelector('.pick__body'), 3);
  }

  var xr = document.querySelector('[data-xray]');
  lazy(xr, function () { initXray(xr); });
  var pk = document.querySelector('[data-pick]');
  if (pk) initPick(pk);
})();
