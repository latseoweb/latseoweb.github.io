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
    var svg = rd.querySelector('.rd__svg'), NS = 'http://www.w3.org/2000/svg', timer = 0, mode = 0, live = [];
    var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    var node404 = rd.querySelector('.rd__no rect.n'), nodeNew = rd.querySelector('.rd__yes rect.n:last-of-type');
    var yesRects = rd.querySelectorAll('.rd__yes rect.n');
    function mk(tag, cls, at) { var e = document.createElementNS(NS, tag); e.setAttribute('class', cls); for (var k in at) e.setAttribute(k, at[k]); svg.appendChild(e); live.push(e); return e; }
    function flash(el, cls) { if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 520); }
    function stop() { clearInterval(timer); live.forEach(function (e) { if (e.__a) e.__a.cancel(); e.remove(); }); live = []; }
    function fire() {
      var m = mode;
      for (var i = 0; i < 3; i++) (function (i) {
        var d = mk('circle', 'ad ' + (m ? 'is-mint' : 'is-sig'), { r: 3.6, cx: 0, cy: 47 });
        var end = m ? 346 : 214, dur = m ? 1900 : 1400, dl = i * 330;
        var kf = m ? [{ transform: 'translateX(12px)', opacity: 0 }, { transform: 'translateX(24px)', opacity: 1, offset: .06 }, { transform: 'translateX(' + end + 'px)', opacity: 1, offset: .94 }, { transform: 'translateX(' + end + 'px)', opacity: 0 }]
          : [{ transform: 'translateX(12px)', opacity: 0 }, { transform: 'translateX(24px)', opacity: 1, offset: .08 }, { transform: 'translateX(' + end + 'px)', opacity: 1, offset: .94 }, { transform: 'translateX(' + (end + 4) + 'px)', opacity: 0 }];
        var a = d.animate(kf, { duration: dur, delay: dl, easing: 'cubic-bezier(.45,.05,.6,.95)', fill: 'backwards' });
        d.__a = a;
        a.onfinish = function () {
          if (mode !== m) return;
          var ring = mk('circle', 'ring', { cx: end, cy: 47, r: 6, stroke: m ? 'var(--ix-mint,#3DDC97)' : 'var(--ix-signal,#FF5B2E)' });
          ring.__a = ring.animate([{ transform: 'scale(.6)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0 }], { duration: 600, easing: 'ease-out' });
          ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
          flash(m ? yesRects[yesRects.length - 1] : node404, m ? 'hit-yes' : 'hit-no');
          setTimeout(function () { d.remove(); ring.remove(); }, 650);
        };
      })(i);
    }
    function run() { stop(); if (RM || !svg.animate) return; fire(); timer = setInterval(fire, m2() ); }
    function m2() { return mode ? 3300 : 2900; }
    var _set = setM;
    setM = function (m) { mode = m; _set(m); run(); };
    setM(0);
    rd.hidden = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { if (!en[0].isIntersecting) stop(); else if (!timer || !live.length) run(); }, { threshold: .1 }).observe(rd);
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
