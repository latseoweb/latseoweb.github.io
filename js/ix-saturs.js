/* Satura stratēģija: AI pārskats fiziski bīda rezultātu uz leju (ilustrācija) + nolūka izvēle */
(function () {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPRING = 'cubic-bezier(.3,1.35,.5,1)', MS = 720;
  function backOut(t) { var c = 1.35, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function lazy(root, init) {
    if (!root) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
    else init();
  }

  var root = document.querySelector('[data-ixs]');
  lazy(root, function () {
    var L = {
      lv: {on: 'ieslēgts', off: 'izslēgts', first: 'pirmajā ekrānā', part: 'ekrāna malā, daļēji redzama', below: 'zem ekrāna malas, jāritina',
        s: function (on, y, d, st) { return 'AI pārskats ' + (on ? 'ieslēgts' : 'izslēgts') + '. Jūsu lapa atrodas ' + y + ' px no lapas augšas' + (on ? ' (' + d + ' px zemāk nekā bez AI pārskata)' : '') + ' — ' + st + '.'; }},
      en: {on: 'on', off: 'off', first: 'on the first screen', part: 'on the screen edge, partly visible', below: 'below the screen edge, needs scrolling',
        s: function (on, y, d, st) { return 'AI overview ' + (on ? 'on' : 'off') + '. Your page is ' + y + ' px from the top of the page' + (on ? ' (' + d + ' px lower than without the AI overview)' : '') + ' — ' + st + '.'; }}
    }[root.getAttribute('data-lang') || 'lv'];
    var $ = function (s) { return root.querySelector(s); };
    var btn = $('[data-sw]'), wrap = $('.ixs__wrap'), page = $('.ixs__page'), you = $('.ixs__r--you'),
      search = $('.ixs__search'), fold = $('.ixs__fold'), dim = $('.ixs__dim'), lab = $('.ixs__dimlab'),
      ghost = $('.ixs__ghost'), st = $('[data-status]'), v = $('[data-v-top]'), vs = $('[data-v-state]'), vl = $('[data-sw-label]'),
      out = $('.ixs__out'), blocks = [].slice.call(root.querySelectorAll('[data-ai]')),
      rowsEl = [].slice.call(root.querySelectorAll('.ixs__r')), base = null, last = null, shown = null, anims = [], tween = 0, leaving = [];
    function pos() {
      var ph = page.offsetParent;
      return {top: you.offsetTop, h: you.offsetHeight, start: search.offsetTop + search.offsetHeight, fold: fold.offsetTop, off: ph.offsetTop + ph.clientTop + page.offsetTop};
    }
    function paint(top, m) {
      shown = top;
      dim.style.top = m.off + m.start + 'px';
      dim.style.height = Math.max(0, top - m.start) + 'px';
      lab.style.top = m.off + m.start + Math.max(0, top - m.start) / 2 + 'px';
      lab.textContent = Math.round(Math.max(0, top - m.start)) + ' px';
      v.textContent = Math.round(top) + ' px';
    }
    function clean(b) { b.hidden = true; b.classList.remove('is-leaving'); b.style.top = ''; }
    function set(on, anim) {
      anims.forEach(function (a) { a.cancel(); }); anims = [];
      leaving.forEach(clean); leaving = [];
      cancelAnimationFrame(tween);
      var tops = blocks.map(function (b) { return b.hidden ? 0 : b.offsetTop; });
      blocks.forEach(function (b) { b.hidden = !on; });
      var m = pos();
      if (base === null) base = m.top;
      var d = Math.round(m.top - base), bottom = m.top + m.h;
      var state = m.top >= m.fold ? L.below : bottom > m.fold ? L.part : L.first;
      var key = m.top >= m.fold ? 'below' : bottom > m.fold ? 'part' : 'first';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      vl.textContent = on ? L.on : L.off;
      ghost.hidden = !on;
      ghost.style.top = base + 'px';
      ghost.style.height = m.h + 'px';
      vs.textContent = state;
      out.setAttribute('data-st', key);
      root.setAttribute('data-st', key);
      st.textContent = L.s(on, Math.round(m.top), d, state);
      var from = shown === null ? m.top : shown, delta = m.top - (last === null ? m.top : last);
      last = m.top;
      if (!anim || calm || !delta) { paint(m.top, m); return; }
      var ad = Math.abs(delta), opt = {duration: MS, easing: SPRING, fill: 'backwards'};
      if (on) {
        rowsEl.forEach(function (r, i) { anims.push(r.animate([{transform: 'translateY(' + -ad + 'px)'}, {transform: 'none'}], {duration: MS, easing: SPRING, delay: i * 18, fill: 'backwards'})); });
        blocks.forEach(function (b, i) { anims.push(b.animate([{transform: 'translateY(' + -ad + 'px)', opacity: 0.2}, {transform: 'none', opacity: 1}], {duration: MS, easing: SPRING, delay: i * 55, fill: 'backwards'})); });
      } else {
        rowsEl.forEach(function (r, i) { anims.push(r.animate([{transform: 'translateY(' + ad + 'px)'}, {transform: 'none'}], {duration: MS, easing: SPRING, delay: i * 18, fill: 'backwards'})); });
        blocks.forEach(function (b, i) {
          b.hidden = false; b.classList.add('is-leaving'); b.style.top = tops[i] + 'px'; leaving.push(b);
          var a = b.animate([{transform: 'none', opacity: 1}, {transform: 'translateY(' + -ad + 'px)', opacity: 0}], {duration: 460, easing: 'cubic-bezier(.5,0,.8,.4)', delay: i * 40, fill: 'forwards'});
          a.onfinish = function () { clean(b); };
          anims.push(a);
        });
      }
      var t0 = performance.now(), total = MS + 60;
      (function s(t) {
        var k = Math.max(0, Math.min(1, (t - t0) / total));
        paint(from + (m.top - from) * backOut(k), m);
        if (k < 1) tween = requestAnimationFrame(s); else paint(m.top, m);
      })(t0);
    }
    btn.hidden = false;
    set(false, false);
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-pressed') !== 'true', true); });
    var tl = 0;
    function tilt(e) {
      if (calm || !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) || tl) return;
      tl = requestAnimationFrame(function () {
        tl = 0; var r = root.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        root.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); root.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        root.classList.add('is-hot');
        wrap.style.transform = 'perspective(1200px) rotateY(' + ((x - 0.5) * 5).toFixed(2) + 'deg) rotateX(' + ((0.5 - y) * 3).toFixed(2) + 'deg)';
      });
    }
    root.addEventListener('pointermove', tilt);
    root.addEventListener('pointerleave', function () { root.classList.remove('is-hot'); wrap.style.transform = ''; });
  });

  /* nolūka izvēle -> lapas veids un bloki (ilustrācija; teksts jau ir HTML) */
  var ib = document.querySelector('[data-ixb]');
  lazy(ib, function () {
    var ctl = ib.querySelector('.ixb__ctl'), btns = [].slice.call(ctl.querySelectorAll('[data-i]')),
      cards = [].slice.call(ib.querySelectorAll('[data-bp]'));
    function set(k) {
      btns.forEach(function (b, i) { var on = b.getAttribute('data-i') === k; b.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) ctl.style.setProperty('--i', i); });
      cards.forEach(function (c) { c.hidden = c.getAttribute('data-bp') !== k; });
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { set(b.getAttribute('data-i')); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % btns.length : k === 'ArrowLeft' || k === 'ArrowUp' ? (i + btns.length - 1) % btns.length : -1;
        if (j < 0) return; e.preventDefault(); btns[j].focus(); set(btns[j].getAttribute('data-i'));
      });
    });
    ib.classList.add('is-live'); ctl.hidden = false; set(btns[0].getAttribute('data-i'));
  });
})();
