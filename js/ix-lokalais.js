/* Lokālais SEO: velkams uzņēmuma marķieris ar atsperi, kartes pakas pārkārtošana, soļu celiņš, rezultāta salīdzinājums */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  /* skaitlis, kas saskaita līdz vērtībai */
  function countTo(node, to, ms, fmt) {
    var from = +node.getAttribute('data-n') || 0; node.setAttribute('data-n', to);
    if (node.__raf) cancelAnimationFrame(node.__raf);
    if (calm) { node.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function s(t) {
      var k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) node.__raf = requestAnimationFrame(s);
    })(t0);
  }

  function lazy(root, init) {
    if (!root) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
    else init();
  }

  /* 1) karte */
  var root = document.querySelector('[data-ixl]');
  lazy(root, function () {
    var T = {
      lv: {areas: [['CENTRS', 470, 30], ['PĀRDAUGAVA', 84, 392], ['DAUGAVA', 540, 196]], you: 'Jūsu uzņēmums', comp: 'Konkurents ', yes: 'jā', no: 'nē', dist: 'attālums ', place: function (n, t) { return 'Jūsu vieta: ' + n + '. no ' + t + (n <= 3 ? ' — kartes pakā' : ' — ārpus kartes pakas'); }},
      en: {areas: [['CENTRE', 470, 30], ['PĀRDAUGAVA', 84, 392], ['DAUGAVA', 540, 196]], you: 'Your business', comp: 'Competitor ', yes: 'yes', no: 'no', dist: 'distance ', place: function (n, t) { return 'Your rank: ' + n + ' of ' + t + (n <= 3 ? ' — in the map pack' : ' — outside the map pack'); }}
    }[root.getAttribute('data-lang') || 'lv'];
    var W = 600, H = 400, DMAX = 320, REV_MAX = 200;
    var $ = function (s) { return root.querySelector(s); };
    var svg = $('.ixl__svg'), you = $('[data-you]'), link = $('[data-link]'), sp = $('[data-sp]'),
      rev = $('[data-rev]'), out = $('[data-rev-out]'), cat = $('[data-cat]'), catv = $('[data-cat-v]'),
      pack = $('[data-pack]'), rank = $('[data-rank]'), panel = $('[data-panel]');
    var spx = +sp.getAttribute('data-x'), spy = +sp.getAttribute('data-y');
    var comps = [].map.call(root.querySelectorAll('[data-c]'), function (g) {
      return {g: g, n: T.comp + g.getAttribute('data-c'), x: +g.getAttribute('data-x'), y: +g.getAttribute('data-y'), r: +g.getAttribute('data-r'), m: g.getAttribute('data-m') === '1'};
    });
    var me = {x: +you.getAttribute('data-x'), y: +you.getAttribute('data-y')}, tgt = {x: me.x, y: me.y}, vel = {x: 0, y: 0};

    /* kartes rasējums: upes plūsma, rādiusa gredzens, reitinga nozīmītes, pulsējošs gredzens */
    /* pilsētas kvartāli starp ielām, divi parki un rajonu nosaukumi (tikai zīmējums) */
    var st0 = $('.ixl__st'), XS = [0, 45, 105, 170, 235, 300, 365, 430, 495, 555, 600], YS = [0, 40, 95, 150, 205, 260, 315, 365, 400];
    var bk = el('g', {'class': 'ixl__blocks', 'aria-hidden': 'true'}); st0.parentNode.insertBefore(bk, st0);
    var parks = {'1,6': 1, '8,6': 1, '6,1': 1};
    for (var xi = 0; xi < XS.length - 1; xi++) for (var yi = 0; yi < YS.length - 1; yi++) {
      var x0 = XS[xi] + 6, y0 = YS[yi] + 6, w = XS[xi + 1] - XS[xi] - 12, h = YS[yi + 1] - YS[yi] - 12;
      if (w < 14 || h < 14) continue;
      el('rect', {x: x0, y: y0, width: w, height: h, 'class': parks[xi + ',' + yi] ? 'ixl__park' : 'ixl__blk'}, bk);
    }
    var D = T.areas; D.forEach(function (a, i) { var t = el('text', {'class': 'ixl__area ixl__area--' + i, x: a[1], y: a[2]}, bk); t.textContent = a[0]; });
    var river = $('.ixl__river2');
    if (river) { var fl = el('path', {'class': 'ixl__flow', d: river.getAttribute('d')}); river.parentNode.insertBefore(fl, river.nextSibling); }
    var radius = el('circle', {'class': 'ixl__radius', cx: spx, cy: spy, r: 0}); link.parentNode.insertBefore(radius, link);
    var dl = el('text', {'class': 'ixl__dl'}); link.parentNode.insertBefore(dl, link.nextSibling);
    comps.forEach(function (c) {
      var k = el('g', {'class': 'ixl__rk'}, c.g);
      el('circle', {cx: 16, cy: -16, r: 9}, k); var t = el('text', {'class': 'ixl__rkt', x: 16, y: -11.5}, k); c.rk = t;
    });
    var spt = sp.querySelector('.ixl__spt'); if (spt) { spt.setAttribute('x', spx + 16); spt.setAttribute('y', spy - 14); spt.style.textAnchor = 'start'; }
    el('circle', {'class': 'ixl__pulse', r: 24}, you).setAttribute('pointer-events', 'none');
    you.insertBefore(you.lastChild, you.firstChild.nextSibling);
    if (!calm) {
      [].forEach.call(root.querySelectorAll('.ixl__st path'), function (p, i) { p.setAttribute('pathLength', '1'); p.style.setProperty('--d', i); });
      ['.ixl__river', '.ixl__river2'].forEach(function (s) { var p = $(s); if (p) { p.setAttribute('pathLength', '1'); p.style.setProperty('--d', 6); } });
      root.classList.add('ixl--draw');
    }

    /* kartes pakas rindas: 6 rindas, top 3 redzamas, pārbīda ar atsperes pārejām */
    var rows = comps.map(function (c) { return {c: c, n: c.n}; }); rows.push({you: true, n: T.you});
    rows.forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><b></b><em></em>'; li.children[1].textContent = r.n;
      if (r.you) li.classList.add('is-you');
      pack.appendChild(li); r.li = li; r.num = li.children[0]; r.sc = li.children[2];
    });

    function prom(r) { return Math.min(1, Math.log(1 + r) / Math.log(1 + REV_MAX)); }
    function dist(x, y) { return Math.max(0, 1 - Math.hypot(x - spx, y - spy) / DMAX); }
    function f(x, y, r, m) { var a = m ? 1 : 0.35, d = dist(x, y), p = prom(r); return {rel: a, dist: d, prom: p, tot: (a + d + p) / 3}; }
    function pct(v) { return Math.round(v * 100); }
    var shown = {rel: 0, dist: 0, prom: 0, tot: 0}, lastPlace = 0, readyDone = false;
    var bars = {}; ['rel', 'dist', 'prom', 'tot'].forEach(function (k) { bars[k] = $('[data-b="' + k + '"]'); });

    function render() {
      var catOn = cat.getAttribute('aria-pressed') === 'true';
      var mine = f(me.x, me.y, +rev.value, catOn);
      rows.forEach(function (r) { r.tot = r.you ? mine.tot : f(r.c.x, r.c.y, r.c.r, r.c.m).tot; });
      var order = rows.slice().sort(function (a, b) { return b.tot - a.tot; });
      order.forEach(function (r, i) {
        r.li.style.setProperty('--r', i);
        r.li.classList.toggle('is-in', i < 3);
        r.li.setAttribute('aria-hidden', i < 3 ? 'false' : 'true');
        r.num.textContent = i < 3 ? i + 1 : '';
        r.sc.textContent = pct(r.tot);
        r.li.style.zIndex = r.you ? 2 : 0;
        if (r.c) { r.c.g.classList.toggle('is-top', i < 3); if (i < 3) r.c.rk.textContent = i + 1; }
      });
      var place = 1 + order.map(function (r) { return !!r.you; }).indexOf(true);
      if (place !== lastPlace) { lastPlace = place; rank.textContent = T.place(place, rows.length); rank.classList.toggle('is-in-pack', place <= 3); }
      mine.target = mine;
      return mine;
    }
    function draw(mine) {
      var d = Math.hypot(me.x - spx, me.y - spy);
      you.setAttribute('transform', 'translate(' + me.x.toFixed(1) + ' ' + me.y.toFixed(1) + ')');
      var left = me.x > 390; if (left !== lblLeft) { lblLeft = left; lbl.setAttribute('x', left ? -28 : 28); lbl.setAttribute('y', 6); lbl.style.textAnchor = left ? 'end' : 'start'; }
      link.setAttribute('x2', me.x); link.setAttribute('y2', me.y);
      radius.setAttribute('r', d.toFixed(1));
      dl.setAttribute('x', ((me.x + spx) / 2).toFixed(1)); dl.setAttribute('y', ((me.y + spy) / 2 - 8).toFixed(1));
      dl.textContent = d > 70 ? T.dist + pct(mine.dist) : '';
    }
    var lbl = you.querySelector('.ixl__lbl'), lblLeft = null;
    var want = null;
    function eased() {
      var more = false;
      ['rel', 'dist', 'prom', 'tot'].forEach(function (k) {
        var t = want[k] * 100, c = shown[k] * 100, n = calm ? t : c + (t - c) * 0.22;
        if (Math.abs(t - n) < 0.4) n = t; else more = true;
        shown[k] = n / 100;
        bars[k].style.setProperty('--v', n.toFixed(1) + '%');
        bars[k].nextElementSibling.textContent = Math.round(n);
      });
      return more;
    }
    var raf = 0, dragging = false;
    function frame() {
      raf = 0;
      var moving = false;
      if (calm) { me.x = tgt.x; me.y = tgt.y; }
      else {
        vel.x = (vel.x + (tgt.x - me.x) * 0.2) * 0.72; vel.y = (vel.y + (tgt.y - me.y) * 0.2) * 0.72;
        me.x += vel.x; me.y += vel.y;
        moving = Math.abs(vel.x) + Math.abs(vel.y) > 0.05 || Math.abs(tgt.x - me.x) + Math.abs(tgt.y - me.y) > 0.1;
        if (!moving) { me.x = tgt.x; me.y = tgt.y; vel.x = vel.y = 0; }
      }
      want = render(); draw(want);
      var more = eased();
      if (!readyDone) { readyDone = true; requestAnimationFrame(function () { pack.classList.add('is-ready'); }); }
      if (moving || more) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function move(x, y) { tgt.x = Math.max(24, Math.min(W - 24, x)); tgt.y = Math.max(24, Math.min(H - 24, y)); kick(); }
    function toSvg(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    var drag = null;
    you.addEventListener('pointerdown', function (e) {
      var q = toSvg(e); drag = {dx: tgt.x - q.x, dy: tgt.y - q.y}; dragging = true; you.classList.add('is-drag');
      you.setPointerCapture(e.pointerId); you.focus({preventScroll: true}); e.preventDefault();
    });
    you.addEventListener('pointermove', function (e) { if (drag) { var q = toSvg(e); move(q.x + drag.dx, q.y + drag.dy); } });
    function end() { drag = null; dragging = false; you.classList.remove('is-drag'); }
    you.addEventListener('pointerup', end); you.addEventListener('pointercancel', end);
    you.addEventListener('keydown', function (e) {
      var s = e.shiftKey ? 40 : 12, k = e.key;
      if (k === 'ArrowLeft') move(tgt.x - s, tgt.y);
      else if (k === 'ArrowRight') move(tgt.x + s, tgt.y);
      else if (k === 'ArrowUp') move(tgt.x, tgt.y - s);
      else if (k === 'ArrowDown') move(tgt.x, tgt.y + s);
      else return;
      e.preventDefault();
    });
    function setVals() {
      out.textContent = rev.value; catv.textContent = cat.getAttribute('aria-pressed') === 'true' ? T.yes : T.no;
      rev.style.setProperty('--fill', (rev.value / +rev.max * 100).toFixed(1) + '%');
    }
    rev.addEventListener('input', function () { setVals(); kick(); });
    cat.addEventListener('click', function () { cat.setAttribute('aria-pressed', cat.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); setVals(); kick(); });
    link.setAttribute('x1', spx); link.setAttribute('y1', spy);
    panel.hidden = false;
    you.setAttribute('tabindex', '0');
    setVals();
    want = render(); ['rel', 'dist', 'prom', 'tot'].forEach(function (k) { shown[k] = want[k]; });
    draw(want); eased();
    if (!calm) { me.x = tgt.x = spx + (me.x - spx) * 0.2; me.y = tgt.y = spy + (me.y - spy) * 0.2; tgt.x = +you.getAttribute('data-x'); tgt.y = +you.getAttribute('data-y'); }
    kick();
  });

  /* 2) soļu celiņš */
  var ol = document.querySelector('[data-ixt]');
  lazy(ol, function () {
    var lis = [].slice.call(ol.children), btns = [];
    function open(n) {
      ol.style.setProperty('--n', n);
      lis.forEach(function (li, i) { li.classList.toggle('is-on', i === n); btns[i].setAttribute('aria-expanded', i === n ? 'true' : 'false'); });
      cur = n; fit();
    }
    /* platā skatā aktīvā soļa saturs ir absolūti novietots zem virsrakstiem: rezervē tam vietu */
    var cur = 0;
    function fit() {
      var li = lis[cur], t = li.querySelector('.ixt__t'), bp = li.querySelector('.ixt__bp');
      if (getComputedStyle(t).position !== 'absolute') { ol.style.paddingBottom = ''; return; }
      var gap = t.offsetTop - li.offsetHeight;
      ol.style.paddingBottom = (gap + Math.max(t.offsetHeight, bp ? bp.offsetHeight : 0) + 8) + 'px';
    }
    window.addEventListener('resize', function () { if (lis.length) fit(); });
    lis.forEach(function (li, i) {
      var s = li.querySelector('strong'), b = document.createElement('button');
      b.type = 'button'; b.className = 'ixt__btn'; b.textContent = s.textContent;
      b.setAttribute('aria-controls', li.querySelector('.ixt__t').id);
      s.textContent = ''; s.appendChild(b); btns.push(b);
      b.addEventListener('click', function () { open(i); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % 4 : k === 'ArrowLeft' || k === 'ArrowUp' ? (i + 3) % 4 : k === 'Home' ? 0 : k === 'End' ? 3 : -1;
        if (j < 0) return; e.preventDefault(); btns[j].focus(); open(j);
      });
    });
    ol.classList.add('is-live'); open(0);
  });

  /* 3) rezultāta salīdzinājums: divas joslas uz vienas ass (tikai lapā jau esošie skaitļi) */
  var cs = document.querySelector('[data-ixc]');
  if (cs && !calm) cs.classList.add('is-pre');
  lazy(cs, function () {
    var val = cs.querySelector('[data-val]'), d = cs.querySelector('[data-d]'),
      seg = cs.querySelector('.ixc__seg'), b = [].slice.call(cs.querySelectorAll('[data-y]'));
    var sepm = /\D/.exec(cs.getAttribute('data-now')), sep = sepm ? sepm[0] : '';
    function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
    function num(s) { return parseInt(s.replace(/\D/g, ''), 10); }
    val.setAttribute('data-n', num(val.textContent));
    function set(y) {
      var now = y === 'now';
      cs.setAttribute('data-on', y);
      countTo(val, num(cs.getAttribute(now ? 'data-now' : 'data-prev')), 700, fmt);
      d.textContent = cs.getAttribute(now ? 'data-dnow' : 'data-dprev');
      b.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-y') === y ? 'true' : 'false'); });
    }
    b.forEach(function (x) { x.addEventListener('click', function () { set(x.getAttribute('data-y')); }); });
    seg.hidden = false; cs.setAttribute('data-on', 'now');
    requestAnimationFrame(function () { requestAnimationFrame(function () { cs.classList.remove('is-pre'); }); });
  });
})();
