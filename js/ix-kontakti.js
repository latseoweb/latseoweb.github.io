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
    var clk = document.createElement('span'), tm = document.createElement('span'), txt = document.createElement('span');
    clk.className = 'ix-clk'; clk.setAttribute('aria-hidden', 'true'); txt.className = 'ix-reply__t';
    clk.innerHTML = '<span class="ix-clk__row"><span class="ix-clk__led"></span><span class="ix-clk__lab">' + (lv ? 'Rīgā tagad' : 'Riga now') + '</span><b class="ix-clk__time"></b><span class="ix-clk__lab ix-clk__lab--r">+24 h</span></span><span class="ix-clk__track"><i class="ix-clk__fill"></i></span>';
    line.textContent = ''; line.appendChild(clk); line.appendChild(txt); line.classList.add('ix-reply--live');
    var tEl = clk.querySelector('.ix-clk__time'), nowF;
    try { nowF = new Intl.DateTimeFormat('lv-LV', { timeZone: 'Europe/Riga', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch (e) { nowF = null; }
    var sec = function () { if (nowF) tEl.textContent = nowF.format(new Date()); };
    sec(); setInterval(sec, 1000);
    var tick = function () {
      var p = {};
      fmt.formatToParts(new Date(Date.now() + 24 * 3600 * 1000)).forEach(function (x) { p[x.type] = x.value; });
      if (!p.weekday || !p.hour) return;
      var t = p.hour + ':' + p.minute;
      txt.textContent = lv ? 'Ja rakstīsiet tagad, atbildēšu ne vēlāk kā ' + p.weekday + ', ' + t + '.'
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
  function setBtn(b, txt, ok) {
    b.textContent = '';
    if (ok) { b.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2.5 8.5l3.5 3.5 7.5-8" pathLength="1"/></svg>'); }
    b.appendChild(document.createTextNode(txt));
  }
  Array.prototype.forEach.call(list.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]'), function (a) {
    var val = a.getAttribute('href').replace(/^(tel|mailto):/, '');
    var human = a.querySelector('strong') ? a.querySelector('strong').textContent.trim() : val;
    var row = document.createElement('div'); row.className = 'ix-crow';
    a.parentNode.insertBefore(row, a); row.appendChild(a);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ix-copy';
    setBtn(b, T.btn, false); b.setAttribute('aria-label', T.aria + human);
    row.appendChild(b);
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(val.indexOf('+') === 0 || /^\d/.test(val) ? human : val).then(function () {
        clearTimeout(timer);
        Array.prototype.forEach.call(list.querySelectorAll('.ix-copy'), function (x) { setBtn(x, T.btn, false); x.classList.remove('is-done'); });
        setBtn(b, T.done, true); b.classList.remove('is-done'); void b.offsetWidth; b.classList.add('is-done'); live.textContent = '';
        setTimeout(function () { live.textContent = human + ': ' + T.done; }, 30);
        timer = setTimeout(function () { setBtn(b, T.btn, false); b.classList.remove('is-done'); }, 2200);
      }, function () {});
    });
  });
})();
