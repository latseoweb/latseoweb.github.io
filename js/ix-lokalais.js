/* Lokālais SEO: velkams uzņēmuma marķieris, rotaļu modelis (atbilstība, attālums, ievērība) */
(function () {
  var root = document.querySelector('[data-ixl]');
  if (!root) return;
  var T = {
    lv: {you: 'Jūsu uzņēmums', comp: 'Konkurents ', yes: 'jā', no: 'nē', place: function (n, t) { return 'Jūsu vieta: ' + n + '. no ' + t + (n <= 3 ? ' — kartes pakā' : ' — ārpus kartes pakas'); }},
    en: {you: 'Your business', comp: 'Competitor ', yes: 'yes', no: 'no', place: function (n, t) { return 'Your rank: ' + n + ' of ' + t + (n <= 3 ? ' — in the map pack' : ' — outside the map pack'); }}
  }[root.getAttribute('data-lang') || 'lv'];
  var W = 600, H = 400, DMAX = 320, REV_MAX = 200;
  function init() {
    var $ = function (s) { return root.querySelector(s); };
    var svg = $('.ixl__svg'), you = $('[data-you]'), link = $('[data-link]'), sp = $('[data-sp]'),
      rev = $('[data-rev]'), out = $('[data-rev-out]'), cat = $('[data-cat]'), catv = $('[data-cat-v]'),
      pack = $('[data-pack]'), rank = $('[data-rank]'), panel = $('[data-panel]');
    var spx = +sp.getAttribute('data-x'), spy = +sp.getAttribute('data-y');
    var comps = [].map.call(root.querySelectorAll('[data-c]'), function (g) {
      return {g: g, n: T.comp + g.getAttribute('data-c'), x: +g.getAttribute('data-x'), y: +g.getAttribute('data-y'), r: +g.getAttribute('data-r'), m: g.getAttribute('data-m') === '1'};
    });
    var me = {x: +you.getAttribute('data-x'), y: +you.getAttribute('data-y')};
    function prom(r) { return Math.min(1, Math.log(1 + r) / Math.log(1 + REV_MAX)); }
    function dist(x, y) { return Math.max(0, 1 - Math.hypot(x - spx, y - spy) / DMAX); }
    function f(x, y, r, m) { var a = m ? 1 : 0.35, d = dist(x, y), p = prom(r); return {rel: a, dist: d, prom: p, tot: (a + d + p) / 3}; }
    function pct(v) { return Math.round(v * 100); }
    function render() {
      var mine = f(me.x, me.y, +rev.value, cat.getAttribute('aria-pressed') === 'true');
      var rows = comps.map(function (c) { return {c: c, n: c.n, tot: f(c.x, c.y, c.r, c.m).tot}; });
      rows.push({you: true, n: T.you, tot: mine.tot});
      rows.sort(function (a, b) { return b.tot - a.tot; });
      var html = '', i;
      comps.forEach(function (c) { c.g.classList.remove('is-top'); });
      for (i = 0; i < 3; i++) {
        html += '<li' + (rows[i].you ? ' class="is-you"' : '') + '><span>' + (i + 1) + '</span><b>' + rows[i].n + '</b><em>' + pct(rows[i].tot) + '</em></li>';
        if (rows[i].c) rows[i].c.g.classList.add('is-top');
      }
      pack.innerHTML = html;
      var place = 1 + rows.map(function (r) { return !!r.you; }).indexOf(true);
      rank.textContent = T.place(place, rows.length);
      [['rel', mine.rel], ['dist', mine.dist], ['prom', mine.prom], ['tot', mine.tot]].forEach(function (p) {
        var el = $('[data-b="' + p[0] + '"]');
        el.style.setProperty('--v', pct(p[1]) + '%');
        el.nextElementSibling.textContent = pct(p[1]);
      });
      out.textContent = rev.value;
      catv.textContent = cat.getAttribute('aria-pressed') === 'true' ? T.yes : T.no;
      you.setAttribute('transform', 'translate(' + me.x + ' ' + me.y + ')');
      link.setAttribute('x2', me.x); link.setAttribute('y2', me.y);
    }
    function move(x, y) { me.x = Math.max(24, Math.min(W - 24, x)); me.y = Math.max(24, Math.min(H - 24, y)); render(); }
    function toSvg(e) {
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      var q = p.matrixTransform(svg.getScreenCTM().inverse());
      return q;
    }
    var drag = null;
    you.addEventListener('pointerdown', function (e) {
      var q = toSvg(e); drag = {dx: me.x - q.x, dy: me.y - q.y};
      you.setPointerCapture(e.pointerId); you.focus({preventScroll: true}); e.preventDefault();
    });
    you.addEventListener('pointermove', function (e) { if (drag) { var q = toSvg(e); move(q.x + drag.dx, q.y + drag.dy); } });
    function end() { drag = null; }
    you.addEventListener('pointerup', end); you.addEventListener('pointercancel', end);
    you.addEventListener('keydown', function (e) {
      var s = e.shiftKey ? 40 : 12, k = e.key;
      if (k === 'ArrowLeft') move(me.x - s, me.y);
      else if (k === 'ArrowRight') move(me.x + s, me.y);
      else if (k === 'ArrowUp') move(me.x, me.y - s);
      else if (k === 'ArrowDown') move(me.x, me.y + s);
      else return;
      e.preventDefault();
    });
    rev.addEventListener('input', render);
    cat.addEventListener('click', function () { cat.setAttribute('aria-pressed', cat.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); render(); });
    link.setAttribute('x1', spx); link.setAttribute('y1', spy);
    panel.hidden = false;
    you.setAttribute('tabindex', '0');
    render();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
  } else init();
})();

/* Lokālais SEO: klikšķināms soļu celiņš ar rasējumu un rezultāta salīdzinājums (tikai lapā jau esošie skaitļi) */
(function () {
  function lazy(root, init) {
    if (!root) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
    else init();
  }
  var ol = document.querySelector('[data-ixt]');
  lazy(ol, function () {
    var lis = [].slice.call(ol.children), btns = [];
    function open(n) {
      lis.forEach(function (li, i) { li.classList.toggle('is-on', i === n); btns[i].setAttribute('aria-expanded', i === n ? 'true' : 'false'); });
    }
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

  var cs = document.querySelector('[data-ixc]');
  lazy(cs, function () {
    var bar = cs.querySelector('.ixc__bar'), val = cs.querySelector('[data-val]'), d = cs.querySelector('[data-d]'),
      seg = cs.querySelector('.ixc__seg'), b = [].slice.call(cs.querySelectorAll('[data-y]')), m = bar.style.getPropertyValue('--m');
    function set(y) {
      var now = y === 'now';
      bar.style.setProperty('--w', now ? '100%' : m);
      bar.classList.toggle('is-prev', !now);
      val.textContent = cs.getAttribute(now ? 'data-now' : 'data-prev');
      d.textContent = cs.getAttribute(now ? 'data-dnow' : 'data-dprev');
      b.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-y') === y ? 'true' : 'false'); });
    }
    b.forEach(function (x) { x.addEventListener('click', function () { set(x.getAttribute('data-y')); }); });
    seg.hidden = false;
  });
})();
