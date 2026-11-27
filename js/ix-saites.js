/* Saišu veidošana: dzīvs spēku tīkls (kvalitatīvas saites / surogātsaišu bars), velkami mezgli ar fiziku, esošo saišu pārbaude ar kāršu apvēršanu */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function lazy(root, init) {
    if (!root) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
    else init();
  }
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function countTo(node, to, ms) {
    var from = parseFloat(node.getAttribute('data-n')); if (isNaN(from)) from = 0; node.setAttribute('data-n', to);
    if (node.__raf) cancelAnimationFrame(node.__raf);
    if (calm) { node.textContent = to; return; }
    var t0 = performance.now();
    (function s(t) {
      var k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(from + (to - from) * e);
      if (k < 1) node.__raf = requestAnimationFrame(s);
    })(t0);
  }

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
    var svg = $('.ixk__svg'), layer = $('[data-layer]'), meG = $('[data-me]'), st = $('[data-status]'),
      btns = net.querySelectorAll('[data-mode]'), vals = net.querySelectorAll('[data-v]');
    var W = 600, H = 380, seed = 7;
    /* šaurā ekrānā zīmējums netiek samazināts: koordinātas = ekrāna pikseļi, lai nosaukumi ir lasāmi (≥ 12 px) un nekur netiek nogriezti */
    var sw = svg.getBoundingClientRect().width;
    if (sw && sw < 520) { W = Math.round(sw); H = Math.round(sw * 1.08); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.aspectRatio = W + ' / ' + H; net.classList.add('is-narrow'); }
    var C = {x: W / 2, y: H / 2};
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var Q = [[110, 80], [490, 85], [75, 265], [515, 275], [300, 330]].map(function (p, i) { return {hx: p[0] / 600 * W, hy: p[1] / 380 * H, l: T.q[i]}; });
    var S = [], i;
    for (i = 0; i < 26; i++) {
      var x, y;
      do { x = 20 + rnd() * (W - 40); y = 20 + rnd() * (H - 40); } while (Math.hypot(x - C.x, y - C.y) < 70);
      S.push({hx: x, hy: y, l: i < 3 ? T.s[i] : ''});
    }
    var X = []; for (i = 0; i < 22; i++) X.push([Math.floor(rnd() * S.length), Math.floor(rnd() * S.length)]);

    /* mezgli: 0 = Jūsu lapa */
    var me = {x: C.x, y: C.y, vx: 0, vy: 0, hx: C.x, hy: C.y, m: 3, g: meG, me: true};
    var mode = 'q', P = [me], E = [], lines = [], flows = [], running = false, visible = true, raf = 0, t = 0, drags = 0, REP = 3000, CUT = 150;

    function build(m, first) {
      mode = m; layer.textContent = ''; P = [me]; E = []; lines = []; flows = [];
      var data = m === 'q' ? Q : S, ll = el('g', {}, layer), nl = el('g', {}, layer);
      me.x = C.x; me.y = C.y; me.vx = me.vy = 0;
      REP = m === "q" ? 1400 : 120; CUT = m === 'q' ? 170 : 55;
      data.forEach(function (d, j) {
        var g = el('g', {'class': 'ixk__n ixk__n--' + m}, nl), inn = el('g', {'class': 'ixk__in'}, g);
        el('circle', {r: m === 'q' ? 28 : 14, 'class': 'ixk__hit'}, g);
        if (m === 'q') { el('circle', {r: 16, 'class': 'ixk__c'}, inn); el('circle', {r: 5, 'class': 'ixk__dot'}, inn); }
        else el('circle', {r: 5.5, 'class': 'ixk__c'}, inn);
        var tx = null;
        if (d.l) { tx = el('text', {y: (m === 'q' ? 16 : 5.5) + 16}, g); tx.textContent = d.l; }
        if (m === 'q') { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', d.l); }
        var ang = rnd() * 6.283, rr = 6 + rnd() * 14;
        var n = {x: C.x + Math.cos(ang) * rr, y: C.y + Math.sin(ang) * rr, vx: 0, vy: 0, hx: d.hx, hy: d.hy, m: 1, g: g, ph: rnd() * 6.283, pad: 16};
        /* mezgls nevar pietuvoties malai tuvāk par pusi no sava nosaukuma platuma */
        if (tx) { var tl = 0; try { tl = tx.getComputedTextLength(); } catch (_) {} n.pad = Math.max(m === 'q' ? 30 : 16, (tl || 120) / 2 + 6); }
        if (calm) { n.x = n.hx; n.y = n.hy; }
        P.push(n);
        E.push({a: 0, b: P.length - 1, l: Math.hypot(d.hx - C.x, d.hy - C.y), k: m === 'q' ? 0.035 : 0.03, q: 1});
      });
      if (m === 's') X.forEach(function (p) { if (p[0] !== p[1]) E.push({a: p[0] + 1, b: p[1] + 1, l: 70, k: 0.012, q: 0}); });
      E.forEach(function (e) {
        lines.push(el('line', {'class': 'ixk__ln ixk__ln--' + m + (e.q ? '' : ' ixk__ln--x')}, ll));
        if (m === 'q') flows.push(el('line', {'class': 'ixk__flow'}, ll)); else flows.push(null);
      });
      P.forEach(function (n, j) { if (j) attach(n); });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m ? 'true' : 'false'); });
      var v = m === 'q' ? T.vq : T.vs(S.length);
      vals.forEach(function (n, j) { if (j === 0) countTo(n, +v[0], 600); else n.textContent = v[j]; });
      vals[2].setAttribute('data-risk', m === 'q' ? 'low' : 'high'); vals[1].setAttribute('data-risk', m === 'q' ? 'low' : 'high');
      st.textContent = m === 'q' ? T.sq : T.ss(S.length);
      net.setAttribute('data-state', m);
      draw(); wake();
    }

    function draw() {
      E.forEach(function (e, j) {
        var a = P[e.a], b = P[e.b], l = lines[j], f = flows[j];
        l.setAttribute('x1', a.x.toFixed(1)); l.setAttribute('y1', a.y.toFixed(1)); l.setAttribute('x2', b.x.toFixed(1)); l.setAttribute('y2', b.y.toFixed(1));
        if (f) { f.setAttribute('x1', a.x.toFixed(1)); f.setAttribute('y1', a.y.toFixed(1)); f.setAttribute('x2', b.x.toFixed(1)); f.setAttribute('y2', b.y.toFixed(1)); }
      });
      P.forEach(function (n) { n.g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ')'); });
    }

    function step() {
      var n = P.length, a, b, dx, dy, d2, d, f, j, k;
      t += 0.016;
      for (j = 0; j < n; j++) { P[j].fx = 0; P[j].fy = 0; }
      for (j = 0; j < n; j++) for (k = j + 1; k < n; k++) {
        a = P[j]; b = P[k]; dx = b.x - a.x; dy = b.y - a.y; d2 = dx * dx + dy * dy;
        if (d2 > CUT * CUT) continue;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        d = Math.sqrt(d2); f = REP / (d2 + 60);
        dx = dx / d * f; dy = dy / d * f; a.fx -= dx; a.fy -= dy; b.fx += dx; b.fy += dy;
      }
      E.forEach(function (e) {
        var A = P[e.a], B = P[e.b], ex = B.x - A.x, ey = B.y - A.y, dd = Math.sqrt(ex * ex + ey * ey) || 1, ff = (dd - e.l) * e.k;
        ex = ex / dd * ff; ey = ey / dd * ff; A.fx += ex; A.fy += ey; B.fx -= ex; B.fy -= ey;
      });
      var swarm = mode === 's';
      for (j = 0; j < n; j++) {
        a = P[j]; if (a.pin) { continue; }
        if (!a.me) {
          a.fx += (a.hx - a.x) * (swarm ? 0.025 : 0.05); a.fy += (a.hy - a.y) * (swarm ? 0.025 : 0.05);
          if (swarm) { a.fx += (Math.random() - 0.5) * 0.7; a.fy += (Math.random() - 0.5) * 0.7; }
          else { a.fx += Math.sin(t * 1.1 + a.ph) * 0.05; a.fy += Math.cos(t * 0.9 + a.ph) * 0.05; }
        } else { a.fx += (a.hx - a.x) * 0.02 + Math.sin(t * 0.8) * 0.03; a.fy += (a.hy - a.y) * 0.02 + Math.cos(t * 0.7) * 0.03; }
        a.vx = (a.vx + a.fx / a.m) * 0.86; a.vy = (a.vy + a.fy / a.m) * 0.86;
        a.x += a.vx; a.y += a.vy;
        var pd = a.pad || 40;
        if (a.x < pd) { a.x = pd; a.vx *= -0.4; } else if (a.x > W - pd) { a.x = W - pd; a.vx *= -0.4; }
        if (a.y < 16) { a.y = 16; a.vy *= -0.4; } else if (a.y > H - 34) { a.y = H - 34; a.vy *= -0.4; }
      }
    }
    function loop() { raf = 0; if (!running || !visible || document.hidden) return; step(); draw(); raf = requestAnimationFrame(loop); }
    function wake() { if (calm) { draw(); return; } running = true; if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) wake(); }, {rootMargin: '60px'}).observe(net);
    document.addEventListener('visibilitychange', wake);

    function pt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
    function clampN(n, x, y) { var pd = n.pad || 40; n.x = Math.max(pd, Math.min(W - pd, x)); n.y = Math.max(16, Math.min(H - 34, y)); }
    function attach(n) {
      var g = n.g, o = null, last = null;
      g.addEventListener('pointerdown', function (e) {
        var q = pt(e); o = {x: n.x - q.x, y: n.y - q.y}; last = {x: n.x, y: n.y}; n.pin = true; n.vx = n.vy = 0;
        g.classList.add('is-drag'); net.classList.add('is-grab'); g.setPointerCapture(e.pointerId); e.preventDefault(); wake();
      });
      g.addEventListener('pointermove', function (e) {
        if (!o) return; var q = pt(e); last = {x: n.x, y: n.y}; clampN(n, q.x + o.x, q.y + o.y);
        n.vx = (n.x - last.x) * 0.9; n.vy = (n.y - last.y) * 0.9;
        if (calm) draw();
      });
      function up() { if (!o) return; o = null; n.pin = false; g.classList.remove('is-drag'); net.classList.remove('is-grab'); n.vx = Math.max(-16, Math.min(16, n.vx)); n.vy = Math.max(-16, Math.min(16, n.vy)); wake(); }
      g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
      if (n.me || g.getAttribute('tabindex')) g.addEventListener('keydown', function (e) {
        var s = e.shiftKey ? 40 : 12, k = e.key, dx = 0, dy = 0;
        if (k === 'ArrowLeft') dx = -s; else if (k === 'ArrowRight') dx = s; else if (k === 'ArrowUp') dy = -s; else if (k === 'ArrowDown') dy = s; else return;
        clampN(n, n.x + dx, n.y + dy); n.hx = n.x; n.hy = n.y; n.vx = n.vy = 0; e.preventDefault(); wake(); draw();
      });
    }
    attach(me);
    btns.forEach(function (b) { b.addEventListener('click', function () { build(b.getAttribute('data-mode')); }); });
    $('[data-ctl]').hidden = false;
    build('q');
    /* kursoram sekojošs izgaismojums uz režģa */
    net.addEventListener('pointermove', function (e) { var r = net.getBoundingClientRect(); net.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); net.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); net.classList.add('is-hot'); });
    net.addEventListener('pointerleave', function () { net.classList.remove('is-hot'); });
  });

  /* 2) esošo saišu pārbaude */
  var ins = document.querySelector('[data-ixi]');
  lazy(ins, function () {
    var lv = ins.getAttribute('data-lang') !== 'en';
    var rows = [].slice.call(ins.querySelectorAll('.ixi__row')), score = ins.querySelector('[data-score]'),
      fin = ins.querySelector('[data-final]'), reset = ins.querySelector('[data-reset]'), done = 0, good = 0;
    var pips = document.createElement('span'); pips.className = 'ixi__pips'; pips.setAttribute('aria-hidden', 'true');
    rows.forEach(function () { pips.appendChild(document.createElement('i')); });
    score.parentNode.insertBefore(pips, score);
    function slideIn(node, from) {
      if (calm || !node.animate) return;
      node.animate(from, {duration: 520, easing: 'cubic-bezier(.34,1.45,.64,1)'});
    }
    function say() {
      score.textContent = lv ? ('Pārbaudīts ' + done + ' no ' + rows.length + ', pareizi: ' + good) : ('Checked ' + done + ' of ' + rows.length + ', correct: ' + good);
      var wasHidden = fin.hidden;
      fin.hidden = done < rows.length; reset.hidden = done === 0;
      if (wasHidden && !fin.hidden) slideIn(fin, [{opacity: 0, transform: 'translateY(16px)'}, {opacity: 1, transform: 'none'}]);
    }
    function clear() {
      done = good = 0;
      rows.forEach(function (r, i) {
        r.classList.remove('is-ok', 'is-bad'); r.querySelector('.ixi__why').hidden = true;
        r.querySelector('.ixi__pick').hidden = false; pips.children[i].className = '';
        [].forEach.call(r.querySelectorAll('[data-pick]'), function (b) { b.setAttribute('aria-pressed', 'false'); b.disabled = false; });
      });
      say();
    }
    rows.forEach(function (r, i) {
      [].forEach.call(r.querySelectorAll('[data-pick]'), function (b) {
        b.addEventListener('click', function () {
          var ok = b.getAttribute('data-pick') === r.getAttribute('data-ans');
          done++; if (ok) good++;
          r.classList.add(ok ? 'is-ok' : 'is-bad');
          [].forEach.call(r.querySelectorAll('[data-pick]'), function (x) { x.disabled = true; x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          var why = r.querySelector('.ixi__why');
          why.hidden = false;
          r.querySelector('[data-res]').textContent = ok ? (lv ? 'Pareizi. ' : 'Correct. ') : (lv ? 'Ne gluži. ' : 'Not quite. ');
          pips.children[i].className = ok ? 'is-ok' : 'is-bad';
          if (!calm && why.animate) {
            why.style.transformOrigin = 'top center';
            why.animate([{opacity: 0, transform: 'perspective(700px) rotateX(-85deg)'}, {opacity: 1, transform: 'perspective(700px) rotateX(8deg)', offset: .7}, {opacity: 1, transform: 'perspective(700px) rotateX(0)'}], {duration: 560, easing: 'cubic-bezier(.3,.8,.3,1)'});
            r.animate(ok ? [{transform: 'none'}, {transform: 'translateX(10px)'}, {transform: 'none'}] : [{transform: 'translateX(0)'}, {transform: 'translateX(-9px)'}, {transform: 'translateX(7px)'}, {transform: 'translateX(-4px)'}, {transform: 'none'}], {duration: ok ? 320 : 380, easing: 'ease-out'});
          }
          say();
        });
      });
    });
    reset.addEventListener('click', clear);
    ins.classList.add('is-live'); clear();
  });
})();
