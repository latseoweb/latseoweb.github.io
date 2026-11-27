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
    var tick = function () {
      var p = {};
      fmt.formatToParts(new Date(Date.now() + 24 * 3600 * 1000)).forEach(function (x) { p[x.type] = x.value; });
      if (!p.weekday || !p.hour) return;
      var t = p.hour + ':' + p.minute;
      line.textContent = lv ? 'Ja rakstīsiet tagad, atbildēšu ne vēlāk kā ' + p.weekday + ', ' + t + '.'
        : 'If you write now, I will reply by ' + p.weekday + ', ' + t + ' (Riga time).';
    };
    if (fmt) { tick(); setInterval(tick, 60000); }
  }

  /* ---------- kopēt ---------- */
  var list = document.querySelector('.contact-list');
  if (!list || !navigator.clipboard) return;
  var T = lv ? { btn: 'Kopēt', done: 'nokopēts', aria: 'Kopēt: ' } : { btn: 'Copy', done: 'copied', aria: 'Copy: ' };
  var live = document.createElement('span');
  live.className = 'ix-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  list.appendChild(live);
  var timer;
  Array.prototype.forEach.call(list.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]'), function (a) {
    var val = a.getAttribute('href').replace(/^(tel|mailto):/, '');
    var human = a.querySelector('strong') ? a.querySelector('strong').textContent.trim() : val;
    var row = document.createElement('div'); row.className = 'ix-crow';
    a.parentNode.insertBefore(row, a); row.appendChild(a);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ix-copy';
    b.textContent = T.btn; b.setAttribute('aria-label', T.aria + human);
    row.appendChild(b);
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(val.indexOf('+') === 0 || /^\d/.test(val) ? human : val).then(function () {
        clearTimeout(timer);
        Array.prototype.forEach.call(list.querySelectorAll('.ix-copy'), function (x) { x.textContent = T.btn; });
        b.textContent = T.done; live.textContent = '';
        setTimeout(function () { live.textContent = human + ': ' + T.done; }, 30);
        timer = setTimeout(function () { b.textContent = T.btn; }, 2000);
      }, function () {});
    });
  });
})();
