/* Satura stratēģija: AI pārskats bīda rezultātu uz leju (ilustrācija) */
(function () {
  var root = document.querySelector('[data-ixs]');
  if (!root) return;
  var L = {
    lv: {on: 'ieslēgts', off: 'izslēgts', first: 'pirmajā ekrānā', part: 'ekrāna malā, daļēji redzama', below: 'zem ekrāna malas, jāritina',
      s: function (on, y, d, st) { return 'AI pārskats ' + (on ? 'ieslēgts' : 'izslēgts') + '. Jūsu lapa atrodas ' + y + ' px no lapas augšas' + (on ? ' (' + d + ' px zemāk nekā bez AI pārskata)' : '') + ' — ' + st + '.'; }},
    en: {on: 'on', off: 'off', first: 'on the first screen', part: 'on the screen edge, partly visible', below: 'below the screen edge, needs scrolling',
      s: function (on, y, d, st) { return 'AI overview ' + (on ? 'on' : 'off') + '. Your page is ' + y + ' px from the top of the page' + (on ? ' (' + d + ' px lower than without the AI overview)' : '') + ' — ' + st + '.'; }}
  }[root.getAttribute('data-lang') || 'lv'];
  function init() {
    var $ = function (s) { return root.querySelector(s); };
    var btn = $('[data-sw]'), wrap = $('.ixs__wrap'), page = $('.ixs__page'), you = $('.ixs__r--you'),
      search = $('.ixs__search'), fold = $('.ixs__fold'), dim = $('.ixs__dim'), lab = $('.ixs__dimlab'),
      ghost = $('.ixs__ghost'), st = $('[data-status]'), v = $('[data-v-top]'), vs = $('[data-v-state]'), vl = $('[data-sw-label]'),
      blocks = root.querySelectorAll('[data-ai]'), base = null;
    function pos() {
      var p = page.getBoundingClientRect(), y = you.getBoundingClientRect();
      return {top: y.top - p.top, h: y.height, start: search.offsetTop + search.offsetHeight, fold: fold.offsetTop, off: p.top - wrap.getBoundingClientRect().top};
    }
    function set(on) {
      for (var i = 0; i < blocks.length; i++) blocks[i].hidden = !on;
      var m = pos();
      if (base === null) base = m.top;
      var d = Math.round(m.top - base), bottom = m.top + m.h;
      var state = m.top >= m.fold ? L.below : bottom > m.fold ? L.part : L.first;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      vl.textContent = on ? L.on : L.off;
      dim.style.top = m.off + m.start + 'px';
      dim.style.height = Math.max(0, m.top - m.start) + 'px';
      lab.style.top = m.off + m.start + (m.top - m.start) / 2 + 'px';
      lab.textContent = Math.round(m.top - m.start) + ' px';
      ghost.hidden = !on;
      ghost.style.top = base + 'px';
      ghost.style.height = m.h + 'px';
      v.textContent = Math.round(m.top) + ' px';
      vs.textContent = state;
      st.textContent = L.s(on, Math.round(m.top), d, state);
    }
    btn.hidden = false;
    set(false);
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-pressed') !== 'true'); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); init(); } }, {rootMargin: '300px'}).observe(root);
  } else init();
})();
