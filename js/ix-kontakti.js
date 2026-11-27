/* Kontakti: atbildes termiņš (tagad + 24 h, Rīgas laiks) un kopēšanas pogas tālrunim/e-pastam. */
(function () {
  var lv = (document.documentElement.lang || 'lv').slice(0, 2) !== 'en';

  /* ---------- atbildes termiņš ---------- */
  var line = document.querySelector('[data-ix-reply]');
  if (line && window.Intl && Intl.DateTimeFormat) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat(lv ? 'lv-LV' : 'en-GB', {
        timeZone: 'Europe/Riga', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
    } catch (e) { fmt = null; }
    var hero = document.querySelector('[data-kt-now]');
    var txt = document.createElement('span'), led = document.createElement('span');
    txt.className = 'ix-reply__t'; led.className = 'ix-clk__led'; led.setAttribute('aria-hidden', 'true');
    line.textContent = ''; line.appendChild(led); line.appendChild(txt); line.classList.add('ix-reply--live');
    var nowF, dayF, partF;
    try {
      nowF = new Intl.DateTimeFormat('lv-LV', { timeZone: 'Europe/Riga', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      dayF = new Intl.DateTimeFormat(lv ? 'lv-LV' : 'en-GB', { timeZone: 'Europe/Riga', weekday: 'long', day: 'numeric', month: 'long' });
      partF = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Riga', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
    } catch (e) { nowF = null; }
    var q = function (s) { return hero ? hero.querySelector(s) : null; };
    var tEl = q('[data-kt-time]'), dEl = q('[data-kt-day]'), byEl = q('[data-kt-by]'), preEl = q('[data-kt-pre]'), scale = q('.kt-now__scale');
    if (preEl) preEl.textContent = lv ? 'Ja rakstīsiet tagad, atbildēšu ne vēlāk kā' : 'If you write now, I will reply by';
    var sec = function () {
      if (!nowF) return;
      var d = new Date();
      if (tEl) tEl.textContent = nowF.format(d);
      if (scale && partF) {
        var p = {}; partF.formatToParts(d).forEach(function (x) { p[x.type] = +x.value; });
        var h = (p.hour % 24) + p.minute / 60 + p.second / 3600;
        scale.style.setProperty('--kt-now', (h / 48 * 100).toFixed(3) + '%');
        scale.style.setProperty('--kt-by', ((h + 24) / 48 * 100).toFixed(3) + '%');
      }
    };
    var tick = function () {
      var p = {};
      fmt.formatToParts(new Date(Date.now() + 24 * 3600 * 1000)).forEach(function (x) { p[x.type] = x.value; });
      if (!p.weekday || !p.hour) return;
      var t = p.weekday + ', ' + p.hour + ':' + p.minute;
      txt.textContent = lv ? 'Atbilde ne vēlāk kā ' + t + ' (Rīgas laiks).' : 'Reply by ' + t + ' (Riga time).';
      if (byEl) byEl.textContent = t;
      if (dEl && dayF) dEl.textContent = dayF.format(new Date());
    };
    sec(); setInterval(sec, 1000);
    if (fmt) { tick(); setInterval(tick, 60000); }
    if (hero) hero.classList.add('is-live');
  }

  /* ---------- kopēt ---------- */
  var list = document.querySelector('.contact-list');
  if (!list || !navigator.clipboard) return;
  var T = lv ? { btn: 'Kopēt', done: 'nokopēts', aria: 'Kopēt: ' } : { btn: 'Copy', done: 'copied', aria: 'Copy: ' };
  var live = document.createElement('span');
  live.className = 'ix-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  list.appendChild(live);
  var timer;
  function setBtn(b, txt, ok) {
    b.textContent = '';
    if (ok) { b.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2.5 8.5l3.5 3.5 7.5-8" pathLength="1"/></svg>'); }
    b.appendChild(document.createTextNode(txt));
  }
  list.classList.add('has-copy');
  Array.prototype.forEach.call(list.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]'), function (a) {
    var val = a.getAttribute('href').replace(/^(tel|mailto):/, '');
    var human = a.querySelector('strong') ? a.querySelector('strong').textContent.trim() : val;
    var row = document.createElement('div'); row.className = 'ix-crow';
    a.parentNode.insertBefore(row, a); row.appendChild(a);
    addCopy(row, val.indexOf('+') === 0 || /^\d/.test(val) ? human : val, human);
  });
  /* rekvizīti: reģ. nr. un PVN nr. grāmatvedībai */
  Array.prototype.forEach.call(document.querySelectorAll('.kt-req [data-copy]'), function (dd) {
    var dt = dd.parentNode.querySelector('dt');
    addCopy(dd.parentNode, dd.getAttribute('data-copy'), (dt ? dt.textContent.replace(/:\s*$/, '') + ' ' : '') + dd.getAttribute('data-copy'));
    dd.parentNode.classList.add('has-copy');
  });
  function addCopy(row, text, human) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ix-copy';
    setBtn(b, T.btn, false); b.setAttribute('aria-label', T.aria + human);
    row.appendChild(b);
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(text).then(function () {
        clearTimeout(timer);
        Array.prototype.forEach.call(document.querySelectorAll('.ix-copy'), function (x) { setBtn(x, T.btn, false); x.classList.remove('is-done'); });
        setBtn(b, T.done, true); b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-done'); live.textContent = '';
        setTimeout(function () { live.textContent = human + ': ' + T.done; }, 30);
        timer = setTimeout(function () { setBtn(b, T.btn, false); b.classList.remove('is-done'); }, 2200);
      }, function () {});
    });
  }
})();
