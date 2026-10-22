/* Website price calculator (/majaslapas-izstrade/ and /en/majaslapas-izstrade/) */
(function () {
  'use strict';
  var root = document.getElementById('calc');
  if (!root) return;
  var EN = document.documentElement.lang === 'en';

  var L = EN ? {
    included: 'Included', incl: 'Included', who: 'Best for', time: 'Build time', addons: 'Add-ons',
    choose: 'Choose a website type', from: 'from', none: 'none', approx: 'approx.', excl: 'excl. VAT',
    pick: 'Your choice: ', more: 'Show more add-ons ▾', less: 'Show fewer ▴',
    variant: 'Package', addonsLabel: 'Add-ons', total: 'Approx.', needNew: 'New website', needShop: 'Online store'
  } : {
    included: 'Iekļauts', incl: 'Iekļauts', who: 'Kam piemērots', time: 'Izstrādes laiks', addons: 'Papildopcijas',
    choose: 'Izvēlieties mājaslapas veidu', from: 'no', none: 'nav', approx: 'aptuveni', excl: 'bez PVN',
    pick: 'Jūsu izvēle: ', more: 'Rādīt vairāk papildopciju ▾', less: 'Rādīt mazāk ▴',
    variant: 'Variants', addonsLabel: 'Papildopcijas', total: 'Aptuveni', needNew: 'Jauna mājaslapa', needShop: 'E-veikals'
  };

  var PACKAGES = EN ? {
    vizitkarte: { name: 'One-page website', price: 449, includes: 'Custom design, up to 5 sections, mobile version, built-in basic SEO, SSL certificate', audience: 'Small businesses and sole traders', time: '3–5 working days' },
    bizness: { name: 'Business website', price: 799, includes: 'Custom design, unlimited sections, mobile version, built-in basic SEO, SSL certificate', audience: 'Small and medium-sized businesses', time: '2–4 weeks' },
    veikals: { name: 'Online store', price: 1299, includes: 'Product catalogue, cart and checkout, payment integration, mobile version, built-in basic SEO, SSL certificate', audience: 'Businesses that want to sell online', time: 'agreed based on products and features' }
  } : {
    vizitkarte: { name: 'Vizītkartes lapa', price: 449, includes: 'Pielāgots dizains, līdz 5 sadaļām, mobilā versija, iebūvēts pamata SEO, SSL sertifikāts', audience: 'Maziem uzņēmumiem un pašnodarbinātajiem', time: '3–5 darba dienas' },
    bizness: { name: 'Uzņēmuma mājaslapa', price: 799, includes: 'Pielāgots dizains, neierobežots sadaļu skaits, mobilā versija, iebūvēts pamata SEO, SSL sertifikāts', audience: 'Maziem un vidējiem uzņēmumiem', time: '2–4 nedēļas' },
    veikals: { name: 'Interneta veikals', price: 1299, includes: 'Preču katalogs, grozs un pasūtīšana, maksājumu integrācija, mobilā versija, iebūvēts pamata SEO, SSL sertifikāts', audience: 'Uzņēmumiem, kas vēlas tirgoties tiešsaistē', time: 'precizējam pēc preču skaita un funkcijām' }
  };
  var INCLUDED = { veikals: ['eveikals'] };

  var pkgInputs = root.querySelectorAll('input[name="package"]');
  var addonInputs = root.querySelectorAll('input[name="addon"]');
  var totalEl = document.getElementById('calc-total');
  var pkgEl = document.getElementById('calc-pkg');
  var detailEl = document.getElementById('calc-detail');
  var more = document.getElementById('calc-more');
  var moreToggle = document.getElementById('calc-more-toggle');
  var group = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, EN ? ',' : '\u00a0'); };
  var fmt = function (n) { return EN ? '€' + group(n) : group(n) + '\u00a0€'; };

  function selected() {
    var c = root.querySelector('input[name="package"]:checked');
    return c ? c.value : null;
  }

  function applyIncluded(pkg) {
    var inc = (pkg && INCLUDED[pkg]) || [];
    addonInputs.forEach(function (inp) {
      var row = inp.closest('.calc-row');
      var priceEl = row.querySelector('.calc-row-price');
      if (!row.dataset.label) row.dataset.label = priceEl.textContent;
      if (inc.indexOf(inp.value) >= 0) {
        inp.checked = true; inp.disabled = true;
        row.classList.add('calc-row--included'); priceEl.textContent = L.included;
      } else if (row.classList.contains('calc-row--included')) {
        inp.checked = false; inp.disabled = false;
        row.classList.remove('calc-row--included'); priceEl.textContent = row.dataset.label;
      }
    });
  }

  var update = function () {
    var key = selected();
    var p = key ? PACKAGES[key] : null;
    var total = p ? p.price : 0;
    var chosen = [], included = [];
    addonInputs.forEach(function (inp) {
      if (!inp.checked) return;
      var row = inp.closest('.calc-row');
      var label = row.querySelector('.calc-row-label').textContent.trim();
      if (row.classList.contains('calc-row--included')) { included.push(label); return; }
      var price = parseInt(row.dataset.price, 10) || 0;
      total += price;
      chosen.push(label + ' (+' + fmt(price) + ')');
    });
    totalEl.textContent = p ? fmt(total) : '—';
    pkgEl.textContent = p ? p.name + ' · ' + L.from + ' ' + fmt(p.price) : L.choose;
    detailEl.innerHTML = p
      ? '<div><dt>' + L.incl + '</dt><dd>' + p.includes + (included.length ? ', ' + included.join(', ').toLowerCase() : '') + '</dd></div>' +
        '<div><dt>' + L.who + '</dt><dd>' + p.audience + '</dd></div>' +
        '<div><dt>' + L.time + '</dt><dd>' + p.time + '</dd></div>' +
        (chosen.length ? '<div><dt>' + L.addons + '</dt><dd>' + chosen.join(', ') + '</dd></div>' : '')
      : '';
    var summary = p ? (L.variant + ': ' + p.name + ' (' + L.from + ' ' + fmt(p.price) + ') | ' + L.addonsLabel + ': ' + (chosen.length ? chosen.join(', ') : L.none) + ' | ' + L.total + ': ' + fmt(total) + ' ' + L.excl) : '';
    var hid = document.getElementById('calc-form-summary-text');
    if (hid) hid.value = summary;
    var vis = document.getElementById('calc-form-summary');
    if (vis) vis.textContent = summary ? L.pick + summary.replace(/ \| /g, ' · ') : '';
    var need = document.getElementById('calc-need');
    if (need && key) need.value = key === 'veikals' ? L.needShop : L.needNew;
  };

  // mobile sticky price chip
  var chip = document.createElement('div');
  chip.className = 'calc-chip';
  chip.inert = true;
  chip.innerHTML = '<div><strong></strong><span></span></div><a href="#' + (EN ? 'get-quote' : 'pieteikties') + '">' + (EN ? 'Get a quote' : 'Saņemt piedāvājumu') + '</a>';
  document.body.appendChild(chip);
  var inView = false;
  function chipState() {
    var key = selected();
    chip.querySelector('strong').textContent = totalEl.textContent;
    chip.querySelector('span').textContent = key ? PACKAGES[key].name + ' · ' + L.excl : '';
    var on = !!key && inView;
    chip.classList.toggle('is-on', on);
    chip.inert = !on;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { inView = e[0].isIntersecting; chipState(); }, { threshold: 0.05 }).observe(root);
  }
  var _update = update;
  update = function () { _update(); chipState(); };

  pkgInputs.forEach(function (i) { i.addEventListener('change', function () { applyIncluded(selected()); update(); }); });
  addonInputs.forEach(function (i) { i.addEventListener('change', update); });
  if (moreToggle && more) {
    moreToggle.addEventListener('click', function () {
      var open = !more.hidden;
      more.hidden = open;
      moreToggle.setAttribute('aria-expanded', String(!open));
      moreToggle.textContent = open ? L.more : L.less;
    });
  }
  var m = /[?&](?:pakete|package)=(\w+)/.exec(location.search);
  if (m && PACKAGES[m[1]]) { var el = root.querySelector('input[value="' + m[1] + '"]'); if (el) el.checked = true; }
  applyIncluded(selected());
  update();
})();
