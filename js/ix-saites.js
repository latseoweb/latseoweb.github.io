/* Saišu veidošana: velkams saišu tīkls (kvalitatīvas / surogātsaites) un esošo saišu pārbaude (ilustrācija) */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  function lazy(root, init) {
    if (!root) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
    else init();
  }
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  /* 1) saišu tīkls */
  var net = document.querySelector('[data-ixk]');
  lazy(net, function () {
    var lv = net.getAttribute('data-lang') !== 'en';
    var T = lv ? {
      q: ['nozares katalogs', 'vietējais portāls', 'partneris', 'nozares medijs', 'reģionālais blogs'],
      s: ['nesaistīts forums', 'komentāru surogāts', 'automātiska vietne'],
      sq: 'Ilustrācija: 5 avoti, visi nozarei vai vietai atbilstoši. Katra saite ir savā kontekstā — tā nāk no vietas, kur par Jūsu nozari tiešām runā.',
      ss: function (n) { return 'Ilustrācija: ' + n + ' avoti bez saistības ar Jūsu nozari, saites no vienādiem komentāriem un automātiski radītām vietnēm. Tāda saišu shēma ir pretrunā ar Google surogātpasta politiku.'; },
      vq: ['5', 'augsta', 'zems'], vs: function (n) { return [String(n), 'nav', 'augsts']; }
    } : {
      q: ['industry directory', 'local portal', 'partner site', 'industry media', 'regional blog'],
      s: ['unrelated forum', 'comment spam', 'auto-generated site'],
      sq: 'Illustration: 5 sources, all relevant to the industry or place. Every link sits in context — it comes from a place that genuinely talks about your industry.',
      ss: function (n) { return 'Illustration: ' + n + ' sources unrelated to your industry, links from identical comments and auto-generated sites. This kind of link scheme goes against Google\'s spam policy.'; },
      vq: ['5', 'high', 'low'], vs: function (n) { return [String(n), 'none', 'high']; }
    };
    var $ = function (s) { return net.querySelector(s); };
    var svg = $('.ixk__svg'), layer = $('[data-layer]'), me = $('[data-me]'), st = $('[data-status]'),
      btns = net.querySelectorAll('[data-mode]'), vals = net.querySelectorAll('[data-v]');
    var W = 600, H = 380, C = {x: 300, y: 190}, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var Q = [[110, 80], [490, 85], [75, 265], [515, 275], [300, 330]].map(function (p, i) { return {x: p[0], y: p[1], l: T.q[i]}; });
    var S = [], i;
    for (i = 0; i < 26; i++) {
      var x, y;
      do { x = 20 + rnd() * (W - 40); y = 20 + rnd() * (H - 40); } while (Math.hypot(x - C.x, y - C.y) < 70);
      S.push({x: x, y: y, l: i < 3 ? T.s[i] : ''});
    }
    var X = []; for (i = 0; i < 22; i++) X.push([Math.floor(rnd() * S.length), Math.floor(rnd() * S.length)]);
    var mode = 'q', items = [], lines = [];
    function pt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
    function upd() {
      me.setAttribute('transform', 'translate(' + C.x + ' ' + C.y + ')');
      var set = mode === 'q' ? Q : S;
      lines.forEach(function (l) {
        var a = l.a === -1 ? C : set[l.a], b = l.b === -1 ? C : set[l.b];
        l.e.setAttribute('x1', a.x); l.e.setAttribute('y1', a.y); l.e.setAttribute('x2', b.x); l.e.setAttribute('y2', b.y);
      });
      items.forEach(function (n) { n.g.setAttribute('transform', 'translate(' + n.d.x + ' ' + n.d.y + ')'); });
    }
    function clamp(d, x, y) { d.x = Math.max(16, Math.min(W - 16, x)); d.y = Math.max(16, Math.min(H - 30, y)); upd(); }
    function drag(g, d, focusable) {
      var o = null;
      g.addEventListener('pointerdown', function (e) { var q = pt(e); o = {x: d.x - q.x, y: d.y - q.y}; g.setPointerCapture(e.pointerId); e.preventDefault(); });
      g.addEventListener('pointermove', function (e) { if (o) { var q = pt(e); clamp(d, q.x + o.x, q.y + o.y); } });
      g.addEventListener('pointerup', function () { o = null; });
      g.addEventListener('pointercancel', function () { o = null; });
      if (focusable) g.addEventListener('keydown', function (e) {
        var s = e.shiftKey ? 40 : 12, k = e.key;
        if (k === 'ArrowLeft') clamp(d, d.x - s, d.y); else if (k === 'ArrowRight') clamp(d, d.x + s, d.y);
        else if (k === 'ArrowUp') clamp(d, d.x, d.y - s); else if (k === 'ArrowDown') clamp(d, d.x, d.y + s); else return;
        e.preventDefault();
      });
    }
    function build(m) {
      mode = m; layer.textContent = ''; items = []; lines = [];
      var data = m === 'q' ? Q : S, edges = [], ll = el('g', {}, layer), nl = el('g', {}, layer);
      data.forEach(function (d, j) { edges.push([-1, j, 1]); });
      if (m === 's') X.forEach(function (p) { if (p[0] !== p[1]) edges.push([p[0], p[1], 0]); });
      edges.forEach(function (p) { lines.push({a: p[0], b: p[1], e: el('line', {'class': 'ixk__ln ixk__ln--' + m + (p[2] ? '' : ' ixk__ln--x')}, ll)}); });
      data.forEach(function (d) {
        var g = el('g', {'class': 'ixk__n ixk__n--' + m}, nl), h = m === 'q' ? 15 : 5;
        el('circle', {r: m === 'q' ? 26 : 14, 'class': 'ixk__hit'}, g);
        el('rect', {x: -h, y: -h, width: 2 * h, height: 2 * h}, g);
        if (d.l) { var t = el('text', {y: h + 15}, g); t.textContent = d.l; }
        if (m === 'q') { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', d.l); }
        drag(g, d, m === 'q'); items.push({g: g, d: d});
      });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m ? 'true' : 'false'); });
      var v = m === 'q' ? T.vq : T.vs(S.length);
      vals.forEach(function (n, j) { n.textContent = v[j]; });
      st.textContent = m === 'q' ? T.sq : T.ss(S.length);
      net.setAttribute('data-state', m);
      upd();
    }
    drag(me, C, true);
    btns.forEach(function (b) { b.addEventListener('click', function () { build(b.getAttribute('data-mode')); }); });
    $('[data-ctl]').hidden = false;
    build('q');
  });

  /* 2) esošo saišu pārbaude */
  var ins = document.querySelector('[data-ixi]');
  lazy(ins, function () {
    var lv = ins.getAttribute('data-lang') !== 'en';
    var rows = [].slice.call(ins.querySelectorAll('.ixi__row')), score = ins.querySelector('[data-score]'),
      fin = ins.querySelector('[data-final]'), reset = ins.querySelector('[data-reset]'), done = 0, good = 0;
    function say() {
      score.textContent = lv ? ('Pārbaudīts ' + done + ' no ' + rows.length + ', pareizi: ' + good) : ('Checked ' + done + ' of ' + rows.length + ', correct: ' + good);
      fin.hidden = done < rows.length; reset.hidden = done === 0;
    }
    function clear() {
      done = good = 0;
      rows.forEach(function (r) {
        r.classList.remove('is-ok', 'is-bad'); r.querySelector('.ixi__why').hidden = true;
        r.querySelector('.ixi__pick').hidden = false;
        [].forEach.call(r.querySelectorAll('[data-pick]'), function (b) { b.setAttribute('aria-pressed', 'false'); b.disabled = false; });
      });
      say();
    }
    rows.forEach(function (r) {
      [].forEach.call(r.querySelectorAll('[data-pick]'), function (b) {
        b.addEventListener('click', function () {
          var ok = b.getAttribute('data-pick') === r.getAttribute('data-ans');
          done++; if (ok) good++;
          r.classList.add(ok ? 'is-ok' : 'is-bad');
          [].forEach.call(r.querySelectorAll('[data-pick]'), function (x) { x.disabled = true; x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          r.querySelector('.ixi__why').hidden = false;
          r.querySelector('[data-res]').textContent = ok ? (lv ? 'Pareizi. ' : 'Correct. ') : (lv ? 'Ne gluži. ' : 'Not quite. ');
          say();
        });
      });
    });
    reset.addEventListener('click', clear);
    ins.classList.add('is-live'); clear();
  });
})();
