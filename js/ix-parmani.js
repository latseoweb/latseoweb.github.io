/* Par mani: pāradresāciju pārslēgs un skaitļu atsauces uz tekstu. Bez bibliotēkām. */
(function () {
  'use strict';

  var rd = document.querySelector('[data-rd]');
  if (rd) {
    var bs = [].slice.call(rd.querySelectorAll('.rd__b')), cap = rd.querySelector('.rd__cap');
    var setM = function (m) {
      rd.setAttribute('data-m', m);
      bs.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-m') === m)); });
      cap.textContent = cap.getAttribute('data-c' + m);
    };
    bs.forEach(function (b) { b.addEventListener('click', function () { setM(+b.getAttribute('data-m')); }); });
    var svg = rd.querySelector('.rd__svg'), NS = 'http://www.w3.org/2000/svg', timer = 0, mode = 0, live = [];
    var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    var node404 = rd.querySelector('.rd__no rect.n'), nodeNew = rd.querySelector('.rd__yes rect.n:last-of-type');
    var yesRects = rd.querySelectorAll('.rd__yes rect.n');
    function mk(tag, cls, at) { var e = document.createElementNS(NS, tag); e.setAttribute('class', cls); for (var k in at) e.setAttribute(k, at[k]); svg.appendChild(e); live.push(e); return e; }
    function flash(el, cls) { if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 520); }
    function stop() { clearInterval(timer); live.forEach(function (e) { if (e.__a) e.__a.cancel(); e.remove(); }); live = []; }
    function fire() {
      var m = mode;
      for (var i = 0; i < 3; i++) (function (i) {
        var d = mk('circle', 'ad ' + (m ? 'is-mint' : 'is-sig'), { r: 3.6, cx: 0, cy: 47 });
        var end = m ? 346 : 214, dur = m ? 1900 : 1400, dl = i * 330;
        var kf = m ? [{ transform: 'translateX(12px)', opacity: 0 }, { transform: 'translateX(24px)', opacity: 1, offset: .06 }, { transform: 'translateX(' + end + 'px)', opacity: 1, offset: .94 }, { transform: 'translateX(' + end + 'px)', opacity: 0 }]
          : [{ transform: 'translateX(12px)', opacity: 0 }, { transform: 'translateX(24px)', opacity: 1, offset: .08 }, { transform: 'translateX(' + end + 'px)', opacity: 1, offset: .94 }, { transform: 'translateX(' + (end + 4) + 'px)', opacity: 0 }];
        var a = d.animate(kf, { duration: dur, delay: dl, easing: 'cubic-bezier(.45,.05,.6,.95)', fill: 'backwards' });
        d.__a = a;
        a.onfinish = function () {
          if (mode !== m) return;
          var ring = mk('circle', 'ring', { cx: end, cy: 47, r: 6, stroke: m ? 'var(--ix-mint)' : 'var(--ix-signal)' });
          ring.__a = ring.animate([{ transform: 'scale(.6)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0 }], { duration: 600, easing: 'ease-out' });
          ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
          flash(m ? yesRects[yesRects.length - 1] : node404, m ? 'hit-yes' : 'hit-no');
          setTimeout(function () { d.remove(); ring.remove(); }, 650);
        };
      })(i);
    }
    function run() { stop(); if (RM || !svg.animate) return; fire(); timer = setInterval(fire, m2() ); }
    function m2() { return mode ? 3300 : 2900; }
    var _set = setM;
    setM = function (m) { mode = m; _set(m); run(); };
    setM(0);
    rd.hidden = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { if (!en[0].isIntersecting) stop(); else if (!timer || !live.length) run(); }, { threshold: .1 }).observe(rd);
  }

  /* ---------- Search Console: latseo.com rādījumi pa nedēļām (reāli dati no assets/data) ---------- */
  var gsc = document.querySelector('[data-gsc]');
  if (gsc) {
    var me = document.querySelector('script[src*="ix-parmani.js"]');
    var base = me ? me.src.replace(/js\/ix-parmani\.js.*$/, '') : '/';
    var src = gsc.getAttribute('data-src');
    if (!/^[a-z]+:/.test(src)) src = base + src.replace(/^\//, '');
    var lazy = function (cb) {
      if (!('IntersectionObserver' in window)) return cb();
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); cb(); } }, { rootMargin: '400px' });
      io.observe(gsc.parentNode);
    };
    lazy(function () {
      var x = new XMLHttpRequest();
      x.open('GET', src);
      x.onload = function () {
        try { var d = JSON.parse(x.responseText); } catch (e) { return; }
        drawGsc(d.weeks.filter(function (w) { return w.impressions > 0; }));
      };
      x.send();
    });
  }
  function drawGsc(W) {
    if (!W.length) return;
    var A = function (k) { return gsc.getAttribute('data-l-' + k); };
    var MON = gsc.getAttribute('data-months').split(','), loc = gsc.getAttribute('data-loc');
    var lvF = loc.indexOf('lv') === 0;
    var nf = function (n) { /* 3 135 / 3,135; 28,7 / 28.7 */
      var p = String(n).split('.'), g = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, lvF ? ' ' : ',');
      return p[1] ? g + (lvF ? ',' : '.') + p[1] : g;
    };
    var plot = gsc.querySelector('[data-plot]'), read = gsc.querySelector('[data-read]');
    gsc.hidden = false;
    var VW = Math.round(Math.max(320, Math.min(600, plot.clientWidth || 600))), VH = VW < 450 ? 210 : 230, L = 50, R = 6, T = 10, B = 44; /* B: x ass + klikšķu josla */
    var max = 0; W.forEach(function (w) { max = Math.max(max, w.impressions); });
    var step = 1000, top = Math.ceil(max / step) * step;
    var pw = VW - L - R, ph = VH - T - B, bw = pw / W.length;
    var y = function (v) { return T + ph - v / top * ph; };
    var h = ['<svg viewBox="0 0 ' + VW + ' ' + VH + '" aria-hidden="true" focusable="false">'];
    for (var g = 0; g <= top; g += step) h.push('<line class="' + (g ? 'gl' : 'gl0') + '" x1="' + L + '" x2="' + (VW - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(g) + 3.5) + '" text-anchor="end">' + nf(g) + '</text>');
    h.push('<g class="bars">');
    var lastM = -1, cmax = 0;
    W.forEach(function (w) { cmax = Math.max(cmax, w.clicks); });
    W.forEach(function (w, i) {
      var x = L + i * bw, bh = Math.max(1, w.impressions / top * ph);
      h.push('<rect class="bar' + (w.days < 7 ? ' is-part' : '') + '" style="--i:' + i + '" x="' + (x + bw * .14).toFixed(1) + '" y="' + (T + ph - bh).toFixed(1) + '" width="' + (bw * .72).toFixed(1) + '" height="' + bh.toFixed(1) + '"/>');
      var m = +w.week_start.slice(5, 7) - 1;
      if (m !== lastM && +w.week_start.slice(8) <= 7) { lastM = m; /* mēneša pirmā nedēļa */ h.push('<line class="gl" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (T + ph) + '" y2="' + (T + ph + 5) + '"/><text class="ax" x="' + (x + 2).toFixed(1) + '" y="' + (T + ph + 15) + '">' + MON[m] + '</text>'); }
    });
    h.push('</g>');
    /* klikšķi: punktu josla zem ass, punkta izmērs = klikšķu skaits */
    var cy = VH - 9;
    h.push('<text class="axt" x="' + (L - 6) + '" y="' + (cy + 3) + '" text-anchor="end">' + A('clk') + '</text><g class="clks">');
    W.forEach(function (w, i) {
      var r = w.clicks ? 1.2 + w.clicks / cmax * 3.2 : .7;
      h.push('<circle class="clk" cx="' + (L + (i + .5) * bw).toFixed(1) + '" cy="' + cy + '" r="' + r.toFixed(2) + '"/>');
    });
    h.push('</g><line class="cur" x1="0" x2="0" y1="' + T + '" y2="' + (VH - 2) + '"/></svg>');
    plot.innerHTML = h.join('');
    var bars = plot.querySelectorAll('.bar'), dots = plot.querySelectorAll('.clk'), cur = plot.querySelector('.cur'), at = -1;
    function pick(i) {
      i = Math.max(0, Math.min(W.length - 1, i));
      if (i === at) return;
      if (at >= 0) { bars[at].classList.remove('is-cur'); dots[at].classList.remove('is-cur'); }
      at = i; bars[i].classList.add('is-cur'); dots[i].classList.add('is-cur');
      var cx = L + (i + .5) * bw; cur.setAttribute('x1', cx); cur.setAttribute('x2', cx);
      var w = W[i], d = w.week_start.split('-');
      var sg = function (t) { return '<span>' + t + '</span>'; };
      read.innerHTML = sg(A('wk') + ' ' + d[2] + '.' + d[1] + '.' + d[0] + (w.days < 7 ? ' (' + A('part') + ')' : '') + ':') + ' ' + sg('<b>' + nf(w.impressions) + '</b> ' + A('imp')) + ' · ' + sg('<b>' + nf(w.clicks) + '</b> ' + A('clk')) + (w.avg_position ? ' · ' + sg(A('pos') + ' <b>' + nf(w.avg_position) + '</b>') : '');
    }
    var fromX = function (e) { var r = plot.getBoundingClientRect(); return Math.floor(((e.clientX - r.left) / r.width * VW - L) / bw); };
    plot.addEventListener('pointermove', function (e) { pick(fromX(e)); });
    plot.addEventListener('pointerdown', function (e) { pick(fromX(e)); });
    plot.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); pick(0); } else if (e.key === 'End') { e.preventDefault(); pick(W.length - 1); } else if (k) { e.preventDefault(); pick(at + k); }
    });
    /* sākumā: pēdējā pilnā nedēļa */
    var last = W.length - 1; while (last > 0 && W[last].days < 7) last--;
    pick(last);
    gsc.hidden = false;
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches)) plot.querySelector('svg').classList.add('grow');
  }

  var facts = document.querySelector('[data-facts]');
  if (facts) {
    var note = document.createElement('p'), hit = null, on = null;
    note.className = 'facts__note';
    note.setAttribute('aria-live', 'polite');
    note.textContent = facts.getAttribute('data-hint');
    facts.appendChild(note);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    [].slice.call(facts.querySelectorAll('[data-go]')).forEach(function (f) {
      f.setAttribute('role', 'button');
      f.setAttribute('tabindex', '0');
      var fire = function () {
        var t = document.getElementById(f.getAttribute('data-go'));
        if (!t) return;
        if (hit) hit.classList.remove('pm-hit');
        if (on) on.classList.remove('is-on');
        hit = t; on = f;
        t.classList.add('pm-hit');
        f.classList.add('is-on');
        note.textContent = f.getAttribute('data-l');
        var r = t.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      };
      f.addEventListener('click', fire);
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      });
    });
  }
})();
