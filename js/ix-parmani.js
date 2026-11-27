/* Par mani: pāradresāciju pārslēgs un skaitļu atsauces uz tekstu. Bez bibliotēkām. */
(function () {
  'use strict';

  var rd = document.querySelector('[data-rd]');
  if (rd) {
    var bs = [].slice.call(rd.querySelectorAll('.rd__b')), cap = rd.querySelector('.rd__cap');
    var setM = function (m) {
      rd.setAttribute('data-m', m);
      bs.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-m') === m)); });
      cap.textContent = cap.getAttribute('data-c' + m);
    };
    bs.forEach(function (b) { b.addEventListener('click', function () { setM(+b.getAttribute('data-m')); }); });
    setM(0);
    rd.hidden = false;
  }

  var facts = document.querySelector('[data-facts]');
  if (facts) {
    var note = document.createElement('p'), hit = null, on = null;
    note.className = 'facts__note';
    note.setAttribute('aria-live', 'polite');
    note.textContent = facts.getAttribute('data-hint');
    facts.appendChild(note);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    [].slice.call(facts.querySelectorAll('[data-go]')).forEach(function (f) {
      f.setAttribute('role', 'button');
      f.setAttribute('tabindex', '0');
      var fire = function () {
        var t = document.getElementById(f.getAttribute('data-go'));
        if (!t) return;
        if (hit) hit.classList.remove('pm-hit');
        if (on) on.classList.remove('is-on');
        hit = t; on = f;
        t.classList.add('pm-hit');
        f.classList.add('is-on');
        note.textContent = f.getAttribute('data-l');
        var r = t.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      };
      f.addEventListener('click', fire);
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      });
    });
  }
})();
