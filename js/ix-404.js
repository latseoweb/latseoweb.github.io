/* 404: rasējuma puzle. Pārvelkams ar pirkstu/peli; tastatūrai pogas "novietot". */
(function () {
  'use strict';
  var root = document.getElementById('pz');
  if (!root) return;
  // [atslēga, nosaukums, mērķa x, y, platums, augstums, sākuma x, y] (procenti no skatuves)
  // Augšā (10–58 %) lapas rāmis ar tukšām vietām, apakšā (62–98 %) paplāte ar sajauktiem gabaliem; 9. vērtība = sākuma slīpums
  var P = [
    ['hdr', 'galvene', 4, 12, 92, 8, 5, 89, -1.2],
    ['h1', 'virsraksts', 4, 24, 42, 9, 3, 64, 2],
    ['img', 'attēls', 62, 24, 34, 24, 63, 63, 2.6],
    ['btn', 'poga', 4, 37, 18, 7, 47, 66, -3],
    ['txt', 'teksts', 4, 48, 52, 10, 6, 77, -1.6]
  ];
  var ART = {
    hdr: '<rect class="f" x="3" y="35" width="14" height="30"/><path class="l" d="M60 50H70M76 50H86M90 50H96"/>',
    h1: '<path class="l" d="M4 32H92M4 68H62" style="stroke-width:4"/>',
    img: '<path class="d" d="M0 0L100 100M100 0L0 100"/>',
    btn: '',
    txt: '<path class="l" d="M0 12H100M0 38H92M0 64H97M0 90H58"/>'
  };
  var addr = /^https?:$/.test(location.protocol) ? location.host + location.pathname : 'latseo.com/…';
  root.innerHTML = '<div class="pz__cap"><strong>Kamēr esat šeit: salieciet šo lapu atpakaļ</strong><span class="pz__cnt" aria-hidden="true"><b>0</b>/5</span></div>'
    + '<p class="ix-hint pz__hint">Velciet gabalus no paplātes uz raustītajiem rāmjiem vai spiediet pogas zem attēla.</p>'
    + '<div class="pz__stage"><div class="pz__bar" aria-hidden="true"><i></i><span></span><em>404</em></div><span class="pz__tray" aria-hidden="true">paplāte</span></div>'
    + '<div class="pz__btns" role="group" aria-label="Novietot gabalus ar pogām"></div><p class="pz__msg" aria-live="polite">Lapa ir izjaukta: 5 gabali paplātē.</p><p class="pz__il">ilustrācija</p>';
  root.querySelector('.pz__bar span').textContent = addr;
  root.hidden = false;
  var cnt = root.querySelector('.pz__cnt b'), stage = root.querySelector('.pz__stage'), btns = root.querySelector('.pz__btns'), msg = root.querySelector('.pz__msg');
  var done = 0, RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  function pos(el, x, y) { el.style.setProperty('--x', x); el.style.setProperty('--y', y); }
  P.forEach(function (p) {
    var s = document.createElement('div');
    s.className = 'pz__slot';
    s.style.cssText = '--x:' + p[2] + ';--y:' + p[3] + ';--w:' + p[4] + ';--h:' + p[5];
    stage.appendChild(s);
  });
  P.forEach(function (p) {
    var el = document.createElement('div'), b = document.createElement('button');
    var it = { el: el, b: b, p: p, set: false };
    el.className = 'pz__pc';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Gabals: ' + p[1]);
    el.style.setProperty('--w', p[4]);
    el.style.setProperty('--h', p[5]);
    el.innerHTML = '<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">' + ART[p[0]] + '</svg><em>' + p[1] + '</em>';
    el.setAttribute('data-k', p[0]);
    pos(el, p[6], p[7]);
    el.style.setProperty('--r', p[8] + 'deg');
    stage.appendChild(el);
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.textContent = p[1];
    btns.appendChild(b);
    b.addEventListener('click', function () { it.set ? unset(it) : place(it); });
    var sx, sy, ox, oy, id = null, lx, ly, lt, vx = 0, vy = 0, raf = 0;
    function cx() { return +el.style.getPropertyValue('--x'); }
    function cy() { return +el.style.getPropertyValue('--y'); }
    function fly() {
      var x = cx(), y = cy(), t0 = performance.now();
      (function step(t) {
        var dt = Math.min(32, t - t0); t0 = t;
        x += vx * dt; y += vy * dt;
        var mx = 100 - p[4], my = 100 - p[5];
        if (x < 0) { x = 0; vx = -vx * .55; } else if (x > mx) { x = mx; vx = -vx * .55; }
        if (y < 0) { y = 0; vy = -vy * .55; } else if (y > my) { y = my; vy = -vy * .55; }
        var f = Math.pow(.92, dt / 16); vx *= f; vy *= f;
        pos(el, x, y);
        el.style.setProperty('--r', (vx * 40).toFixed(2) + 'deg');
        if (Math.abs(vx) + Math.abs(vy) > .0006) raf = requestAnimationFrame(step);
        else { raf = 0; }
      })(t0);
    }
    el.addEventListener('pointerdown', function (e) {
      if (it.set || e.button) return;
      cancelAnimationFrame(raf); raf = 0;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (_) {}
      sx = e.clientX; sy = e.clientY; lx = sx; ly = sy; lt = performance.now(); vx = vy = 0;
      ox = cx(); oy = cy();
      el.classList.add('is-drag');
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (id !== e.pointerId) return;
      var r = stage.getBoundingClientRect();
      var x = ox + (e.clientX - sx) / r.width * 100, y = oy + (e.clientY - sy) / r.height * 100;
      x = Math.max(0, Math.min(100 - p[4], x)); y = Math.max(0, Math.min(100 - p[5], y));
      var dx = x - p[2], dy = y - p[3], d = Math.sqrt(dx * dx + dy * dy);
      if (d < 14) { var k = (14 - d) / 14 * .55; x -= dx * k; y -= dy * k; el.classList.toggle('is-near', d < 9); } else el.classList.remove('is-near');
      pos(el, x, y);
      var now = performance.now(), dt = Math.max(1, now - lt);
      vx = vx * .6 + ((e.clientX - lx) / r.width * 100 / dt) * .4; vy = vy * .6 + ((e.clientY - ly) / r.height * 100 / dt) * .4;
      lx = e.clientX; ly = e.clientY; lt = now;
      el.style.setProperty('--r', Math.max(-7, Math.min(7, vx * 40)).toFixed(2) + 'deg');
    });
    function end() {
      if (id === null) return;
      id = null;
      el.classList.remove('is-drag', 'is-near');
      var dx = cx() - p[2], dy = cy() - p[3];
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) { vx = vy = 0; place(it); return; }
      if (RM || performance.now() - lt > 90 || Math.abs(vx) + Math.abs(vy) < .002) { el.style.setProperty('--r', '0deg'); return; }
      fly();
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
  var items = [], NS = 'http://www.w3.org/2000/svg', winEl = null;
  function win(on) {
    if (winEl) { winEl.remove(); winEl = null; }
    stage.classList.toggle('is-won', on);
    if (!on) return;
    winEl = document.createElementNS(NS, 'svg');
    winEl.setAttribute('class', 'pz__win'); winEl.setAttribute('viewBox', '0 0 160 100'); winEl.setAttribute('aria-hidden', 'true');
    winEl.setAttribute('preserveAspectRatio', 'none');
    winEl.innerHTML = '<rect class="w1" x="1.5" y="1.5" width="157" height="97" pathLength="1"/><path class="w2" pathLength="1" d="M6 21.5H154"/><path class="w3" pathLength="1" d="M66 78L76 88L96 66"/>';
    stage.appendChild(winEl);
  }
  function place(it) {
    if (it.set) return;
    it.set = true;
    it.el.classList.add('is-set'); it.el.style.setProperty('--r', '0deg');
    pos(it.el, it.p[2], it.p[3]);
    it.b.setAttribute('aria-pressed', 'true');
    done++;
    update(it);
    if (done === P.length) win(true);
  }
  function unset(it) {
    it.set = false;
    it.el.classList.remove('is-set');
    pos(it.el, it.p[6], it.p[7]);
    it.el.style.setProperty('--r', it.p[8] + 'deg');
    it.b.setAttribute('aria-pressed', 'false');
    done--;
    update(null);
    win(false);
  }
  function update(it) {
    cnt.textContent = done;
    msg.textContent = done === P.length
      ? 'Lapa salikta. Šī adrese gan paliek tukša: izvēlieties, kur doties tālāk.'
      : (it ? 'Vietā: ' + it.p[1] + '. Atlikuši ' + (P.length - done) + '.' : 'Atlikuši ' + (P.length - done) + ' gabali.');
  }
})();
