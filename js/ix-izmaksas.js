/* Izmaksas pēc palaišanas: rindas ieslēdz/izslēdz, summa un stabiņš rēķinās no tabulas šūnām. */
(function () {
  var root = document.querySelector('[data-ix-cost]');
  if (!root) return;
  var lv = (document.documentElement.lang || 'lv').slice(0, 2) !== 'en';
  var L = lv ? {
    cap: 'Aprēķins no tabulas augstāk, bez PVN. Atzīmējiet, kas Jums vajadzīgs.',
    hint: 'Hostingu var izvēlēties vienu: mājaslapai vai e-veikalam.',
    avg: 'Vidēji mēnesī', y1: 'Pirmajā gadā', host: 'Hostings', dom: 'Domēns', edit: 'Labojumi',
    hours: 'stundas', empty: 'Nekas nav atzīmēts', yr: 'gads = ', loc: 'lv-LV', sfx: ' €', pre: ''
  } : {
    cap: 'Calculated from the table above, excl. VAT. Tick what you need.',
    hint: 'Choose one hosting plan: website or online store.',
    avg: 'Average per month', y1: 'First year', host: 'Hosting', dom: 'Domain', edit: 'Edits',
    hours: 'hours', empty: 'Nothing selected', yr: 'year = ', loc: 'en-GB', sfx: '', pre: '€'
  };
  var table = root.parentNode.querySelector('table.table');
  if (!table) return;
  var started = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* skaitlis saskaitās līdz jaunajai vērtībai */
  function tween(el, to, fmt, pre) {
    var from = el._v == null ? to : el._v;
    if (el._raf) cancelAnimationFrame(el._raf);
    el._v = to;
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 600;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(tick);
    })(t0);
    el.classList.remove('is-bump'); void el.offsetWidth; if (!reduce) el.classList.add('is-bump');
  }

  function money(n) {
    var s = n.toLocaleString(L.loc, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return L.pre + s + L.sfx;
  }

  function init() {
    if (started) return;
    started = true;
    table.classList.add('ix-tbl');
    var rows = [], i, tr, tds, txt, m, unit;
    var trs = table.querySelectorAll('tbody tr');
    for (i = 0; i < trs.length; i++) {
      tr = trs[i]; tds = tr.children;
      txt = tds[1].textContent;
      m = txt.match(/(\d+(?:[.,]\d+)?)/);
      if (!m) continue;
      unit = /mēn|month/i.test(txt) ? 'm' : /gad|year/i.test(txt) ? 'y' : /\/\s*h\b|stund|hour/i.test(txt) ? 'h' : '';
      if (!unit) continue;
      rows.push({ tr: tr, price: parseFloat(m[1].replace(',', '.')), unit: unit, on: false, qty: 0 });
    }
    if (!rows.length) return;
    var seenM = false;
    var bar, rl, rlv, outA, outY;

    function update() {
      var rec = 0, once = 0, segs = [];
      rows.forEach(function (r) {
        var a = r.unit === 'm' ? r.price * 12 : r.unit === 'y' ? r.price : r.price * r.qty;
        var off = !r.on || a === 0;
        r.tr.classList.toggle('is-off', off);
        if (off) return;
        if (r.unit === 'h') once += a; else rec += a;
        segs.push({ r: r, cls: r.cls, v: a });
      });
      var tot = rec + once;
      bar.classList.toggle('is-empty', !tot);
      rows.forEach(function (r) {
        var on = segs.some(function (s) { return s.r === r; });
        var v = on ? segs.filter(function (s) { return s.r === r; })[0].v : 0;
        r.seg.style.flexGrow = v;
        r.seg.classList.toggle('is-on', on);
      });
      if (tot) tween(rlv, tot, function (n) { return L.yr + money(Math.round(n * 100) / 100); });
      else { rlv._v = 0; rl.textContent = L.empty; }
      tween(outA, Math.round(rec / 12 * 100) / 100, function (n) { return money(Math.round(n * 100) / 100); });
      tween(outY, tot, function (n) { return money(Math.round(n * 100) / 100); });
    }

    rows.forEach(function (r) {
      r.cls = r.unit === 'm' ? 'host' : r.unit === 'y' ? 'dom' : 'edit';
      if (r.unit === 'm' && !seenM) { r.on = true; seenM = true; }
      if (r.unit === 'y') r.on = true;
      var td = r.tr.children[0], lab = document.createElement('label'), sw = document.createElement('span');
      lab.className = 'ix-row';
      sw.className = 'ix-sw ix-sw--' + r.cls; sw.setAttribute('aria-hidden', 'true');
      var txtWrap = document.createElement('span');
      while (td.firstChild) txtWrap.appendChild(td.firstChild);
      if (r.unit === 'h') {
        var inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '40'; inp.step = '1'; inp.value = '0'; inp.className = 'ix-qty';
        inp.setAttribute('aria-label', txtWrap.textContent.trim() + ' (' + L.hours + ')');
        inp.addEventListener('input', function () {
          var v = Math.max(0, Math.min(40, parseInt(inp.value, 10) || 0));
          r.qty = v; r.on = v > 0; update();
        });
        var u = document.createElement('span'); u.className = 'ix-u'; u.textContent = 'h'; u.setAttribute('aria-hidden', 'true');
        lab.appendChild(sw); lab.appendChild(txtWrap); lab.appendChild(inp); lab.appendChild(u);
      } else {
        var cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = r.on; cb.className = 'ix-cb';
        cb.addEventListener('change', function () {
          r.on = cb.checked;
          if (r.on && r.unit === 'm') rows.forEach(function (o) { if (o !== r && o.unit === 'm') { o.on = false; o.cb.checked = false; } });
          update();
        });
        lab.appendChild(cb); lab.appendChild(sw); lab.appendChild(txtWrap);
        r.cb = cb;
      }
      td.appendChild(lab);
    });

    root.innerHTML = '<p class="ix-cost__cap"></p><div class="ix-bar" aria-hidden="true"></div>' +
      '<div class="ix-ruler" aria-hidden="true"><span></span></div>' +
      '<dl class="ix-tot" aria-live="polite"><div><dt></dt><dd data-a></dd></div><div><dt></dt><dd data-y></dd></div></dl>' +
      '<p class="ix-cost__hint small muted"></p>';
    root.querySelector('.ix-cost__cap').textContent = L.cap;
    root.querySelector('.ix-cost__hint').textContent = L.hint;
    var dts = root.querySelectorAll('dt'); dts[0].textContent = L.avg; dts[1].textContent = L.y1;
    bar = root.querySelector('.ix-bar'); rl = root.querySelector('.ix-ruler span'); rlv = rl;
    rows.forEach(function (r) {
      var e = document.createElement('span');
      e.className = 'ix-seg ix-seg--' + r.cls;
      e.textContent = r.cls === 'host' ? L.host : r.cls === 'dom' ? L.dom : L.edit;
      bar.appendChild(e); r.seg = e;
    });
    outA = root.querySelector('[data-a]'); outY = root.querySelector('[data-y]');
    root.classList.add('ix-panel');
    update();
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '300px 0px' });
    io.observe(root);
  } else init();
})();
