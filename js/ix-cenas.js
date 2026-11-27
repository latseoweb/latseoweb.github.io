/* Cenu lapa: cenrādis kā tāmes grozs + "Kas ietekmē cenu" rotaļa.
   Cenas tiek nolasītas no tabulu šūnām (vienīgais avots). Bez JS lapa paliek parasts cenrādis. */
(function () {
  'use strict';
  var EN = (document.documentElement.lang || '').indexOf('en') === 0;
  var S = EN ? {
    pick: 'Add to estimate: ', rm: 'Remove: ', clear: 'Clear', send: 'Send this estimate', h: 'My estimate (excl. VAT):',
    once: 'One-off', mon: 'Monthly', yr: 'Yearly', hr: 'Hourly', from: 'from ', none: 'Nothing switched on.',
    shop: 'The online store package already includes the core features, so that add-on is not needed.', items: 'items', mu: '/month', yu: ''
  } : {
    pick: 'Pievienot tāmei: ', rm: 'Noņemt: ', clear: 'Notīrīt', send: 'Nosūtīt šo tāmi', h: 'Mana tāme (bez PVN):',
    once: 'Vienreizēji', mon: 'Mēnesī', yr: 'Gadā', hr: 'Pēc stundām', from: 'no ', none: 'Nekas nav ieslēgts.',
    shop: 'E-veikala paketē pamatfunkcijas jau iekļautas, tāpēc šī opcija nav vajadzīga.', items: 'pozīcijas', mu: '/mēn.', yu: ''
  };
  var rows = document.querySelectorAll('tr[data-k]');
  var panel = document.getElementById('ix-est');
  if (!rows.length || !panel) return;

  function grp(n, sep) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
  function money(n) { return EN ? '€' + grp(n, ',') : grp(n, ' ') + ' €'; }
  function q(root, k) { return root.querySelector('[data-ix="' + k + '"]'); }

  /* ---- read the tables ---- */
  var data = {}, order = [];
  rows.forEach(function (tr) {
    var cells = tr.children, price = cells[cells.length - 1], first = cells[0];
    var t = price.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    var m = t.match(/\d[\d\s,.]*/);
    if (!m) return;
    var nm = first.cloneNode(true);
    [].forEach.call(nm.querySelectorAll('.muted'), function (e) { e.remove(); });
    var it = {
      k: tr.getAttribute('data-k'), tr: tr, text: t, name: nm.textContent.replace(/\s+/g, ' ').trim(),
      n: parseInt(m[0].replace(/[\s,.]/g, ''), 10), min: /^(no|from)\s/i.test(t),
      u: /\/\s*(mēn|month)/i.test(t) ? 'm' : /(gadā|year)/i.test(t) ? 'y' : /\/\s*h\b/i.test(t) ? 'h' : 'o'
    };
    data[it.k] = it; order.push(it.k);
  });

  function totals(keys) {
    var r = { o: [0, 0], m: [0, 0], y: [0, 0], h: [] };
    keys.forEach(function (k) {
      var it = data[k];
      if (it.u === 'h') { r.h.push(it); return; }
      r[it.u][0] += it.n; if (it.min) r[it.u][1] = 1;
    });
    return r;
  }
  function tot(v, unit) { return (v[1] ? S.from : '') + money(v[0]) + unit; }
  function fillTot(dl, keys) {
    var r = totals(keys), h = '';
    function row(a, b) { h += '<div><dt>' + a + '</dt><dd>' + b + '</dd></div>'; }
    if (r.o[0] || keys.some(function (k) { return data[k].u === 'o'; })) row(S.once, tot(r.o, ''));
    if (r.m[0]) row(S.mon, tot(r.m, S.mu));
    if (r.y[0]) row(S.yr, tot(r.y, S.yu));
    r.h.forEach(function (it) { row(S.hr, it.text); });
    dl.innerHTML = h;
  }
  function li(it, rm) {
    return '<li><span>' + it.name + '</span><span class="ix-est__p">' + it.text + '</span>' +
      (rm ? '<button type="button" data-rm="' + it.k + '" aria-label="' + S.rm + it.name.replace(/"/g, '') + '">×</button>' : '') + '</li>';
  }

  /* ---- basket ---- */
  var sel = [], boxes = {};
  var list = q(panel, 'list'), dl = q(panel, 'tot'), hint = q(panel, 'hint'), cnt = q(panel, 'count');
  var send = q(panel, 'send'), clr = q(panel, 'clear'), bar = panel.querySelector('.ix-est__bar'), sum = q(panel, 'barsum');
  send.textContent = S.send; clr.textContent = S.clear;

  order.forEach(function (k) {
    var it = data[k], td = it.tr.children[0];
    var lab = document.createElement('label'), cb = document.createElement('input'), w = document.createElement('div'), t = document.createElement('div');
    lab.className = 'ix-pick'; cb.type = 'checkbox'; cb.setAttribute('aria-label', S.pick + it.name);
    lab.appendChild(cb); w.className = 'ix-cell'; t.className = 'ix-cell__t';
    while (td.firstChild) t.appendChild(td.firstChild);
    w.appendChild(lab); w.appendChild(t); td.appendChild(w);
    it.tr.classList.add('ix-row'); boxes[k] = cb;
    cb.addEventListener('change', function () { set(k, cb.checked); });
  });

  function set(k, on) {
    var i = sel.indexOf(k);
    if (on && i < 0) {
      if (k.indexOf('pkg-') === 0) sel = sel.filter(function (x) { return x.indexOf('pkg-') !== 0; });
      sel.push(k);
    } else if (!on && i >= 0) sel.splice(i, 1);
    draw();
  }
  function sorted() { return order.filter(function (k) { return sel.indexOf(k) >= 0; }); }

  function draw() {
    var keys = sorted(), n = keys.length, w = panel.querySelector('[data-w]');
    if (w) w.remove();
    order.forEach(function (k) {
      var on = sel.indexOf(k) >= 0; boxes[k].checked = on; data[k].tr.classList.toggle('is-picked', on);
    });
    panel.classList.toggle('is-empty', !n);
    cnt.textContent = n ? '· ' + n : '';
    hint.hidden = !!n; list.hidden = dl.hidden = q(panel, "vat").hidden = !n; send.parentNode.hidden = !n;
    list.innerHTML = keys.map(function (k) { return li(data[k], true); }).join('');
    fillTot(dl, keys);
    if (n && sel.indexOf('pkg-shop') >= 0 && sel.indexOf('ad-shop') >= 0) list.insertAdjacentHTML('afterend', '<p class="ix-est__warn" data-w>' + S.shop + '</p>');
    var r = totals(keys), b = [];
    if (r.o[0]) b.push(tot(r.o, '')); if (r.m[0]) b.push(tot(r.m, S.mu));
    sum.textContent = n ? (b.join(' + ') || money(0)) + ' · ' + n : '';
    document.body.classList.toggle('ix-has-est', !!n);
    if (!n) { panel.classList.remove('is-open'); bar.setAttribute('aria-expanded', 'false'); }
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (b) set(b.getAttribute('data-rm'), false);
  });
  clr.addEventListener('click', function () { sel = []; draw(); });
  bar.addEventListener('click', function () {
    var o = panel.classList.toggle('is-open'); bar.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    var tr = e.target.closest('tr.ix-row');
    if (!tr || e.target.closest('a,button,input,label')) return;
    set(tr.getAttribute('data-k'), sel.indexOf(tr.getAttribute('data-k')) < 0);
  });

  send.addEventListener('click', function () {
    panel.classList.remove('is-open'); bar.setAttribute('aria-expanded', 'false');
    var ta = document.getElementById('price-msg') || document.querySelector('#pieteikties textarea');
    if (!ta) return;
    var keys = sorted(), r = totals(keys), L = [S.h];
    keys.forEach(function (k) { L.push('- ' + data[k].name + ': ' + data[k].text); });
    if (r.o[0]) L.push(S.once + ': ' + tot(r.o, ''));
    if (r.m[0]) L.push(S.mon + ': ' + tot(r.m, S.mu));
    if (r.y[0]) L.push(S.yr + ': ' + tot(r.y, S.yu));
    var blk = L.join('\n').replace(/\u00a0/g, ' ');
    ta.value = ta._ixBlk && ta.value.indexOf(ta._ixBlk) >= 0 ? ta.value.replace(ta._ixBlk, blk) : (ta.value.trim() ? blk + '\n\n' + ta.value : blk);
    ta._ixBlk = blk;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });

  panel.hidden = false; draw();

  /* ---- "Kas ietekme cenu" ---- */
  var f = document.getElementById('ix-f');
  if (!f) return;
  var fs = [], fl = q(f, 'flist'), ft = q(f, 'ftot'), fa = q(f, 'fadd');
  var btns = f.querySelectorAll('.ix-f__btn');
  [].forEach.call(btns, function (b) {
    var it = data[b.getAttribute('data-k')]; if (it) q(b, 'p').textContent = it.text;
  });
  function fdraw() {
    var keys = order.filter(function (k) { return fs.indexOf(k) >= 0; });
    [].forEach.call(btns, function (b) { b.setAttribute('aria-pressed', fs.indexOf(b.getAttribute('data-k')) >= 0 ? 'true' : 'false'); });
    fl.innerHTML = keys.length ? keys.map(function (k) { return li(data[k], false); }).join('') : '<li class="ix-f__none">' + S.none + '</li>';
    fillTot(ft, keys); fa.disabled = !keys.length;
  }
  f.addEventListener('click', function (e) {
    var b = e.target.closest('.ix-f__btn');
    if (!b) return;
    var k = b.getAttribute('data-k'), i = fs.indexOf(k);
    if (i >= 0) fs.splice(i, 1);
    else {
      if (b.closest('.ix-f__grp').getAttribute('data-single') === '1')
        fs = fs.filter(function (x) { return x.indexOf('pkg-') !== 0; });
      fs.push(k);
    }
    fdraw();
  });
  fa.addEventListener('click', function () {
    fs.forEach(function (k) { if (sel.indexOf(k) < 0) set(k, true); });
  });
  f.hidden = false; fdraw();
})();
