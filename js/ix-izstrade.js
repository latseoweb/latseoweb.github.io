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

  /* koda iekrāsošana inspektoram: HTML (tagi, atribūti, vērtības), JSON, HTTP, teksts */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hl(src, lang) {
    var s = esc(src);
    if (lang === 'txt') return s.replace(/\b(h[1-3])\b/g, '<span class=t>$1</span>');
    if (lang === 'http') return s.replace(/^(GET|POST) (.*)$/gm, '<span class=t>$1</span> $2')
      .replace(/^(\d{3}) (.*)$/gm, '<span class=s>$1 $2</span>')
      .replace(/^([\w-]+):( .*)$/gm, '<span class=a>$1</span>:<span class=v>$2</span>');
    if (lang === 'json') s = s.replace(/("[^"\n]*")(\s*:)/g, '<span class=a>$1</span>$2')
      .replace(/(:\s*)("[^"\n]*")/g, '$1<span class=v>$2</span>');
    else s = s.replace(/([\w:-]+)=("[^"]*")/g, '<span class=a>$1</span>=<span class=v>$2</span>');
    return s.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '<span class=t>$1$2</span>').replace(/(\/?&gt;)/g, '<span class=t>$1</span>')
      .replace(/^(@media.*|\s+\.[\w-]+ \{.*|\})$/gm, '<span class=c>$1</span>');
  }

  /* ---------- X-ray ---------- */
  function initXray(root) {
    var view = root.querySelector('.xray__view');
    var page = root.querySelector('.xray__page');
    var bp = root.querySelector('.xray__bp');
    var lens = root.querySelector('.xray__lens');
    var all = root.querySelector('.xray__all');
    var legend = root.querySelector('.xray__legend');
    var hint = root.getAttribute('data-hint');
    var I = {
      path: root.querySelector('.xi__path'), tag: root.querySelector('.xi__tag'), name: root.querySelector('.xi__name [data-name]'),
      ok: root.querySelector('.xi__ok'), read: root.querySelector('.xray__read'), serp: root.querySelector('.xi__serp'),
      code: root.querySelector('.xi__code'), checks: root.querySelector('.xi__checks')
    };
    var data = {};
    [].forEach.call(root.querySelectorAll('.xr-data [data-k]'), function (d) { data[d.getAttribute('data-k')] = d; });
    var targets = [].slice.call(page.querySelectorAll('[data-x]'));

    /* rentgena slānis = tās pašas lapas kopija "caurspīdīgā" stilā + rāmji ap elementiem */
    var ghost = page.cloneNode(true);
    ghost.classList.add('xr-ghost');
    [].forEach.call(ghost.querySelectorAll('[data-x]'), function (e) { e.removeAttribute('data-x'); });
    var layer = document.createElement('div'); layer.className = 'xr-boxes';
    bp.appendChild(ghost); bp.appendChild(layer);
    var boxes = targets.map(function (t) {
      var k = t.getAttribute('data-x'), d = data[k], b = document.createElement('span'), tg = document.createElement('i');
      b.className = 'xr-box' + (d && d.getAttribute('data-ok') ? ' is-ok' : '');
      b.setAttribute('data-k', k);
      tg.className = 'xr-tag'; tg.textContent = d ? d.getAttribute('data-tag') : k;
      b.appendChild(tg); layer.appendChild(b);
      return { t: t, k: k, el: b, tag: tg, x: 0, y: 0, w: 0, h: 0, vis: true };
    });

    var w = 0, h = 0, r = 100, x = 0, y = 0, cur = null, mode = 'lens';

    function layout() {
      var v = view.getBoundingClientRect();
      w = v.width; h = v.height;
      r = Math.max(64, Math.min(130, w * 0.17));
      view.style.setProperty('--r', r + 'px');
      bp.style.setProperty('--h', h + 'px');
      var placed = [];
      boxes.forEach(function (b) {
        var q = b.t.getBoundingClientRect(), p = 3;
        b.vis = q.width > 0 && q.height > 0;
        b.el.style.display = b.vis ? '' : 'none';
        if (!b.vis) return;
        b.x = q.left - v.left - p; b.y = q.top - v.top - p; b.w = q.width + p * 2; b.h = q.height + p * 2;
        b.el.style.cssText = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px';
      });
      /* birkas: virs, iekšā, zem, labajā pusē — pirmā vieta, kas nepārklājas ar citām */
      /* šaurā skatā birkas tikai iebūvētajiem elementiem, lai tās nesaplūst */
      boxes.forEach(function (b) { b.tag.style.display = (w < 520 && !b.el.classList.contains('is-ok')) ? 'none' : ''; });
      boxes.filter(function (b) { return b.vis && b.tag.style.display !== 'none'; }).sort(function (a, c) { return a.y - c.y || a.x - c.x; }).forEach(function (b) {
        var tw = b.tag.offsetWidth, th = b.tag.offsetHeight, best = null;
        var c = [[b.x, b.y - th], [b.x + 3, b.y + 3], [b.x, b.y + b.h], [b.x + b.w - tw, b.y - th], [b.x + b.w - tw - 3, b.y + 3], [b.x + b.w - tw, b.y + b.h]];
        function free(cx, cy, list) { return !list.some(function (o) { return cx < o[0] + o[2] + 2 && cx + tw + 2 > o[0] && cy < o[1] + o[3] + 1 && cy + th + 1 > o[1]; }); }
        /* vispirms vieta, kas neaizsedz ne citas birkas, ne citus rāmjus; tad — tikai ne birkas */
        var others = boxes.filter(function (o) { return o !== b && o.vis; }).map(function (o) { return [o.x + 1, o.y + 1, o.w - 2, o.h - 2]; });
        [placed.concat(others), placed].forEach(function (list) {
          for (var i = 0; i < c.length && !best; i++) {
            var cx = Math.max(1, Math.min(w - tw - 1, c[i][0])), cy = Math.max(1, Math.min(h - th - 1, c[i][1]));
            if (free(cx, cy, list)) best = [cx, cy];
          }
        });
        if (!best) best = [Math.max(1, Math.min(w - tw - 1, b.x)), Math.max(1, b.y - th)];
        placed.push([best[0], best[1], tw, th]);
        b.tag.style.left = (best[0] - b.x) + 'px'; b.tag.style.top = (best[1] - b.y) + 'px';
      });
    }

    function show(k) {
      if (k === cur) return;
      cur = k;
      boxes.forEach(function (b) { b.el.classList.toggle('is-on', b.k === k); });
      [].forEach.call(root.querySelectorAll('[data-go]'), function (g) { g.setAttribute('aria-pressed', g.getAttribute('data-go') === k ? 'true' : 'false'); });
      var d = k && data[k];
      if (!d) { I.tag.textContent = ''; I.name.textContent = ''; I.ok.hidden = true; I.serp.hidden = true; I.code.innerHTML = ''; I.checks.innerHTML = ''; I.read.textContent = hint; I.path.textContent = ''; return; }
      I.path.textContent = d.getAttribute('data-path') || '';
      I.tag.textContent = d.getAttribute('data-tag');
      I.name.textContent = d.getAttribute('data-name');
      I.ok.hidden = !d.getAttribute('data-ok');
      I.read.textContent = d.getAttribute('data-d');
      I.serp.hidden = !d.getAttribute('data-serp');
      var pre = d.querySelector('pre');
      I.code.innerHTML = pre ? hl(pre.textContent, d.getAttribute('data-lang') || 'html') : '';
      I.code.scrollTop = 0;
      var ul = d.querySelector('ul');
      I.checks.innerHTML = ul ? ul.innerHTML : '';
    }

    function boxAt(px, py, reach) {
      var best = null, bd = 1e9;
      boxes.forEach(function (b) {
        if (!b.vis) return;
        var dx = Math.max(b.x - px, 0, px - b.x - b.w), dy = Math.max(b.y - py, 0, py - b.y - b.h), d = Math.sqrt(dx * dx + dy * dy);
        if (!d) d = -1 / (b.w * b.h); /* iekšā: mazākais rāmis uzvar */
        if (d < bd) { bd = d; best = b; }
      });
      return bd <= reach ? best : null;
    }
    function set(nx, ny) {
      x = Math.max(0, Math.min(w, nx));
      y = Math.max(0, Math.min(h, ny));
      view.style.setProperty('--x', x + 'px');
      view.style.setProperty('--y', y + 'px');
      if (mode === 'lens') { var b = boxAt(x, y, r * 0.6); if (b) show(b.k); }
    }
    function local(e) {
      var b = view.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    }

    /* inspektora saraksts "iebūvētais SEO": klikšķis aizved lēcu pie elementa */
    [].forEach.call(root.querySelectorAll('[data-go]'), function (g) {
      g.addEventListener('click', function () {
        var k = g.getAttribute('data-go'), b = boxes.filter(function (o) { return o.k === k && o.vis; })[0];
        if (!b) return;
        root.classList.remove('is-idle'); stopInertia();
        if (mode === 'lens') set(b.x + Math.min(b.w / 2, r * 0.8), b.y + b.h / 2);
        show(k);
      });
    });
    root.classList.add('is-on');
    if (legend) { legend.textContent = hint; legend.classList.add('ix-hint'); }
    layout();
    if (!reduce) root.classList.add('is-idle');
    var h1 = boxes.filter(function (b) { return b.k === 'h1' && b.vis; })[0];
    set(h1 ? h1.x + Math.min(h1.w * 0.35, r) : w * 0.3, h1 ? h1.y + h1.h / 2 : h * 0.3);
    function relayout() { var fx = x / (w || 1), fy = y / (h || 1); layout(); set(fx * w, fy * h); }
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(view);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

    /* "Rādīt visu kodu": lēcas aplis izplešas pa visu lapu; elementus izvēlas ar klikšķi vai kursoru */
    if (all) {
      all.hidden = false;
      all.addEventListener('click', function () {
        mode = mode === 'lens' ? 'all' : 'lens';
        all.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
        root.classList.remove('is-idle');
        if (!reduce) { root.classList.add('is-sweep'); setTimeout(function () { root.classList.remove('is-sweep'); }, 800); }
        root.classList.toggle('is-all', mode === 'all');
        if (mode === 'lens') { var b = boxAt(x, y, r * 0.6); if (b) show(b.k); }
      });
      layer.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.xr-box');
        if (mode === 'all' && b) show(b.getAttribute('data-k'));
      });
      if (fine) view.addEventListener('pointermove', function (e) {
        if (mode !== 'all') return;
        var p = local(e), b = boxAt(p[0], p[1], 0);
        if (b) show(b.k);
      });
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
      if (e.button || mode !== 'lens') return;
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
      if (!tx || mode !== 'lens' || e.target === lens || lens.contains(e.target)) { tx = null; return; }
      var t = e.changedTouches[0];
      if (Math.abs(t.clientX - tx[0]) < 8 && Math.abs(t.clientY - tx[1]) < 8) {
        var b = view.getBoundingClientRect();
        root.classList.remove('is-idle');
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
