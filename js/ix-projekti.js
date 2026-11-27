/* Projekti: filtra čipi (Visi / Izstrāde / SEO) un "Nākamā vieta" kartiņa ar rakstāmu skici. Nekas netiek saglabāts vai sūtīts. */
(function () {
  var lv = (document.documentElement.lang || 'lv').slice(0, 2) !== 'en';
  var T = lv ? {
    group: 'Filtrēt projektus', all: 'Visi', dev: 'Izstrāde', seo: 'SEO', shown: 'Rādīti projekti: ',
    label: 'Jūsu uzņēmuma nosaukums', ph: 'Jūsu uzņēmums', note: 'Skices ilustrācija. Nosaukums netiek saglabāts vai sūtīts.'
  } : {
    group: 'Filter projects', all: 'All', dev: 'Development', seo: 'SEO', shown: 'Projects shown: ',
    label: 'Your company name', ph: 'Your company', note: 'Sketch illustration. The name is not stored or sent.'
  };

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- filtri ---------- */
  function filters() {
    var box = document.querySelector('[data-ix-filter]');
    var devS = document.getElementById('dev-title'), seoS = document.getElementById('seo-title');
    if (!box || !devS || !seoS) return;
    devS = devS.closest('section'); seoS = seoS.closest('section');
    var defs = [['all', T.all], ['dev', T.dev], ['seo', T.seo]], btns = [], ov = document.querySelector('[data-pj-ix]');
    var grp = el('div', 'ix-chips'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', T.group);
    var status = el('p', 'ix-sr'); status.setAttribute('role', 'status');
    var cnt = function (s) { return s.querySelectorAll('.proof:not(.proof--next)').length; },
      nDev = cnt(devS), nSeo = cnt(seoS), counts = {all: nDev + nSeo, dev: nDev, seo: nSeo};
    defs.forEach(function (d) {
      var b = el('button', 'ix-chip', d[1]); b.type = 'button'; b.setAttribute('data-k', d[0]);
      b.appendChild(el('span', 'ix-chip__n', String(counts[d[0]])));
      b.setAttribute('aria-pressed', d[0] === 'all' ? 'true' : 'false');
      b.addEventListener('click', function () { apply(d[0]); });
      /* čipa priekšskatījums hero pārskatā: kuri projekti paliks redzami */
      var peek = function () { if (ov) ov.setAttribute('data-show', d[0]); }, unpeek = function () { if (ov) ov.setAttribute('data-show', cur); };
      b.addEventListener('pointerenter', peek); b.addEventListener('pointerleave', unpeek);
      b.addEventListener('focus', peek); b.addEventListener('blur', unpeek);
      btns.push(b); grp.appendChild(b);
    });
    box.appendChild(grp); box.appendChild(status);
    var RM = matchMedia('(prefers-reduced-motion: reduce)').matches, cur = 'all';
    function rise(sec) {
      if (RM || !sec.animate) return;
      var items = sec.querySelectorAll('.proof, .section__title, .lead');
      [].forEach.call(items, function (it, i) {
        it.animate([{ opacity: 0, transform: 'translateY(18px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 480, delay: Math.min(i, 8) * 55, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
      });
    }
    function apply(k) {
      var wasHidden = [devS.hidden, seoS.hidden];
      var nh = [k === 'seo', k === 'dev'];
      [devS, seoS].forEach(function (s, i) {
        if (nh[i] && !s.hidden) {
          if (RM || !s.animate) { s.hidden = true; return; }
          var an = s.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 180, easing: 'ease-in' });
          var done = function () { if (nh[i] && cur === k) s.hidden = true; };
          an.onfinish = done; setTimeout(done, 260);
        } else if (!nh[i]) {
          s.hidden = false;
          if (wasHidden[i]) rise(s);
          else if (!RM && s.animate && cur !== k) s.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 300 });
        }
      });
      cur = k;
      if (ov) ov.setAttribute('data-show', k);
      btns.forEach(function (b, i) { b.setAttribute('aria-pressed', defs[i][0] === k ? 'true' : 'false'); });
      var n = 0;
      [devS, seoS].forEach(function (s, i) {
        if (!nh[i]) n += s.querySelectorAll('.proof:not(.proof--next)').length;
      });
      status.textContent = T.shown + n;
    }
  }

  /* ---------- Nākamā vieta ---------- */
  function tryCard() {
    var a = document.querySelector('.proof-grid > a.proof--next');
    if (!a) return;
    var nameEl = a.querySelector('.proof__name'), moreEl = a.querySelector('.post-item__more');
    var card = el('div', 'proof proof--next proof--try');
    var sk = el('span', 'sheet sheet--blank ix-sk'); sk.style.aspectRatio = '16/10'; sk.setAttribute('aria-hidden', 'true');
    var bar = el('span', 'ix-sk__bar'), logo = el('span', 'ix-sk__logo', T.ph);
    bar.appendChild(logo);
    for (var i = 0; i < 3; i++) bar.appendChild(el('i', 'ix-sk__nav'));
    var hero = el('span', 'ix-sk__hero'), h = el('span', 'ix-sk__h', T.ph);
    var pen = el('i', 'ix-sk__pen'); hero.appendChild(h); hero.appendChild(pen); hero.appendChild(el('i', 'ix-sk__ln')); hero.appendChild(el('i', 'ix-sk__ln ix-sk__ln--s'));
    hero.appendChild(el('i', 'ix-sk__btn'));
    var row = el('span', 'ix-sk__row');
    for (var j = 0; j < 3; j++) row.appendChild(el('i', 'ix-sk__box'));
    sk.appendChild(bar); sk.appendChild(hero); sk.appendChild(row);
    card.appendChild(sk);

    var body = el('span', 'proof__body');
    if (nameEl) body.appendChild(el('span', 'proof__name', nameEl.textContent));
    var lab = el('label', 'ix-try__label', T.label); lab.setAttribute('for', 'ix-try-name');
    var inp = el('input', 'ix-try__input'); inp.id = 'ix-try-name'; inp.type = 'text'; inp.maxLength = 30;
    inp.autocomplete = 'off'; inp.setAttribute('placeholder', T.ph);
    body.appendChild(lab); body.appendChild(inp);
    body.appendChild(el('span', 'ix-try__note', T.note));
    if (moreEl) {
      var link = el('a', 'post-item__more', moreEl.textContent); link.href = a.getAttribute('href');
      body.appendChild(link);
    }
    card.appendChild(body);
    var RMc = matchMedia('(prefers-reduced-motion: reduce)').matches, drawn = false;
    tiltIt(sk);
    inp.addEventListener('input', function () {
      var v = inp.value.replace(/\s+/g, ' ').trim();
      logo.textContent = h.textContent = v || T.ph;
      sk.classList.toggle('is-typed', !!v);
      if (!RMc) {
        pen.style.top = (h.offsetTop + h.offsetHeight + 1) + 'px';
        pen.classList.remove('go'); void pen.offsetWidth; pen.classList.add('go');
        if (v && !drawn) { drawn = true; sk.classList.add('draw'); setTimeout(function () { sk.classList.remove('draw'); }, 900); }
        if (!v) drawn = false;
      }
    });
    a.parentNode.replaceChild(card, a);
  }

  function tiltIt(e) {
    e.setAttribute('data-ix-tilt', '');
    if (window.IX && typeof window.IX.tilt === 'function') { window.IX.tilt(e); return; }
    if (!matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var host = e.closest('.proof') || e;
    host.addEventListener('pointermove', function (ev) {
      var r = e.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5;
      e.style.setProperty('--ix-rx', (-y * 5).toFixed(2) + 'deg'); e.style.setProperty('--ix-ry', (x * 6).toFixed(2) + 'deg');
      e.style.setProperty('--ix-mx', ((x + .5) * 100).toFixed(1) + '%'); e.style.setProperty('--ix-my', ((y + .5) * 100).toFixed(1) + '%');
    });
    host.addEventListener('pointerleave', function () { e.style.setProperty('--ix-rx', '0deg'); e.style.setProperty('--ix-ry', '0deg'); });
  }

  /* ---------- gadījuma izpēte: joslas izaug un frāžu kvadrāti parādās, kad attēls ir redzams ---------- */
  function caseFig() {
    var f = document.querySelector('[data-ixq]');
    if (!f || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    [].forEach.call(f.querySelectorAll('.ixq__dots i'), function (d, i) { d.style.transitionDelay = (i * 14) + 'ms'; });
    f.classList.add('is-pre');
    new IntersectionObserver(function (e, o) {
      if (!e[0].isIntersecting) return;
      o.disconnect();
      requestAnimationFrame(function () { requestAnimationFrame(function () { f.classList.remove('is-pre'); }); });
    }, {threshold: 0.25}).observe(f);
  }

  /* hero pārskats: klikšķu joslas izaug pēc ielādes */
  function heroBars() {
    var ov = document.querySelector('[data-pj-ix]');
    if (!ov || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ov.classList.add('is-pre');
    setTimeout(function () { ov.classList.remove('is-pre'); }, 250);
  }

  heroBars();
  filters();
  tryCard();
  caseFig();
})();
