/* 404: rasējuma puzle. Pārvelkams ar pirkstu/peli; tastatūrai pogas "novietot". */
(function () {
  'use strict';
  var root = document.getElementById('pz');
  if (!root) return;
  // [atslēga, nosaukums, mērķa x, y, platums, augstums, sākuma x, y] (procenti no skatuves)
  var P = [
    ['hdr', 'galvene', 4, 5, 92, 12, 4, 84],
    ['h1', 'virsraksts', 4, 24, 50, 14, 46, 56],
    ['img', 'attēls', 60, 24, 36, 34, 8, 44],
    ['btn', 'poga', 4, 46, 20, 11, 74, 8],
    ['txt', 'teksts', 4, 66, 50, 20, 44, 72]
  ];
  var ART = {
    hdr: '<rect class="f" x="3" y="35" width="14" height="30"/><path class="l" d="M60 50H70M76 50H86M90 50H96"/>',
    h1: '<path class="l" d="M4 32H92M4 68H62" style="stroke-width:4"/>',
    img: '<path class="d" d="M0 0L100 100M100 0L0 100"/>',
    btn: '',
    txt: '<path class="l" d="M0 12H100M0 38H92M0 64H97M0 90H58"/>'
  };
  root.innerHTML = '<div class="pz__cap"><span>Salieciet lapu</span><span>ilustrācija</span></div><div class="pz__stage"></div><div class="pz__btns" role="group" aria-label="Novietot gabalus ar pogām"></div><p class="pz__msg" aria-live="polite">Lapa ir izjaukta. Velciet gabalus uz raustītajiem rāmjiem vai lietojiet pogas.</p>';
  root.hidden = false;
  var stage = root.querySelector('.pz__stage'), btns = root.querySelector('.pz__btns'), msg = root.querySelector('.pz__msg');
  var done = 0;
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
    stage.appendChild(el);
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.textContent = p[1];
    btns.appendChild(b);
    b.addEventListener('click', function () { it.set ? unset(it) : place(it); });
    var sx, sy, ox, oy, id = null;
    el.addEventListener('pointerdown', function (e) {
      if (it.set || e.button) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (_) {}
      sx = e.clientX; sy = e.clientY;
      ox = +el.style.getPropertyValue('--x'); oy = +el.style.getPropertyValue('--y');
      el.classList.add('is-drag');
      e.preventDefault();
    });
    el.addEventListener('pointermove', function (e) {
      if (id !== e.pointerId) return;
      var r = stage.getBoundingClientRect();
      var x = ox + (e.clientX - sx) / r.width * 100, y = oy + (e.clientY - sy) / r.height * 100;
      pos(el, Math.max(0, Math.min(100 - p[4], x)), Math.max(0, Math.min(100 - p[5], y)));
    });
    function end() {
      if (id === null) return;
      id = null;
      el.classList.remove('is-drag');
      var dx = +el.style.getPropertyValue('--x') - p[2], dy = +el.style.getPropertyValue('--y') - p[3];
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) place(it);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
  var items = [];
  function place(it) {
    if (it.set) return;
    it.set = true;
    it.el.classList.add('is-set');
    pos(it.el, it.p[2], it.p[3]);
    it.b.setAttribute('aria-pressed', 'true');
    done++;
    update(it);
  }
  function unset(it) {
    it.set = false;
    it.el.classList.remove('is-set');
    pos(it.el, it.p[6], it.p[7]);
    it.b.setAttribute('aria-pressed', 'false');
    done--;
    update(null);
  }
  function update(it) {
    msg.textContent = done === P.length
      ? 'Lapa salikta. Šī adrese gan paliek tukša: izvēlieties, kur doties tālāk.'
      : (it ? 'Vietā: ' + it.p[1] + '. Atlikuši ' + (P.length - done) + '.' : 'Atlikuši ' + (P.length - done) + ' gabali.');
  }
})();
