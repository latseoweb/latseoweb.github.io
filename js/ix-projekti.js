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
    var defs = [['all', T.all], ['dev', T.dev], ['seo', T.seo]], btns = [];
    var grp = el('div', 'ix-chips'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', T.group);
    var status = el('p', 'ix-sr'); status.setAttribute('role', 'status');
    defs.forEach(function (d) {
      var b = el('button', 'ix-chip', d[1]); b.type = 'button';
      b.setAttribute('aria-pressed', d[0] === 'all' ? 'true' : 'false');
      b.addEventListener('click', function () { apply(d[0]); });
      btns.push(b); grp.appendChild(b);
    });
    box.appendChild(grp); box.appendChild(status);
    function apply(k) {
      devS.hidden = k === 'seo'; seoS.hidden = k === 'dev';
      btns.forEach(function (b, i) { b.setAttribute('aria-pressed', defs[i][0] === k ? 'true' : 'false'); });
      var n = 0;
      [devS, seoS].forEach(function (s) {
        if (!s.hidden) n += s.querySelectorAll('.proof:not(.proof--next)').length;
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
    hero.appendChild(h); hero.appendChild(el('i', 'ix-sk__ln')); hero.appendChild(el('i', 'ix-sk__ln ix-sk__ln--s'));
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
    inp.addEventListener('input', function () {
      var v = inp.value.replace(/\s+/g, ' ').trim();
      logo.textContent = h.textContent = v || T.ph;
      sk.classList.toggle('is-typed', !!v);
    });
    a.parentNode.replaceChild(card, a);
  }

  filters();
  tryCard();
})();
