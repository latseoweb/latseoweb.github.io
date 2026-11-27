/* ix-theme: tiny shared helpers for instruments (css/ix-theme.css). Loaded deferred on every page.
   window.IX = { reduced, fine, count(el, to), draw(path), spring(from, to, onStep) }
   - .ix-panel: grid highlight follows the pointer (--ix-mx/--ix-my)
   - [data-ix-tilt]: 3D tilt, max 5deg (or the attribute's number), fine pointers only
   - [data-ix-count]: set the attribute to a new number and the text counts to it
   - [data-ix-draw]: SVG path/line draws itself when its "d"/"points" changes, or once in view if value is "in"
   Everything is off under prefers-reduced-motion (states change instantly). */
(function () {
  var mq = function (q) { return window.matchMedia && matchMedia(q).matches; };
  var IX = window.IX = window.IX || {};
  IX.reduced = mq("(prefers-reduced-motion: reduce)");
  IX.fine = mq("(hover: hover) and (pointer: fine)");

  IX.spring = function (from, to, step, done) {
    if (IX.reduced) { step(to); if (done) done(); return function () {}; }
    var x = from, v = 0, raf, last = performance.now();
    function tick(now) {
      var dt = Math.min(0.032, (now - last) / 1000); last = now;
      v += ((to - x) * 170 - v * 18) * dt; x += v * dt;
      if (Math.abs(to - x) < 1e-3 * (Math.abs(to) + 1) && Math.abs(v) < 1e-2) { step(to); if (done) done(); return; }
      step(x); raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(raf); };
  };

  // count: keeps the text around the number ("no 449 €"), formats like the original (spaces, decimals)
  var NUM = /-?\d(?:[\d  ]*\d)?(?:[.,]\d+)?/;
  function parse(s) { var m = String(s).match(NUM); return m ? parseFloat(m[0].replace(/[  ]/g, "").replace(",", ".")) : NaN; }
  IX.count = function (el, to) {
    to = +to; if (isNaN(to)) return;
    var txt = el.textContent, m = txt.match(NUM), from = m ? parse(m[0]) : 0;
    var da = el.getAttribute("data-ix-decimals"), dec = da !== null ? +da : (String(to).split(".")[1] || "").length;
    var sep = m && /[  ]/.test(m[0]) ? " " : (to >= 10000 ? " " : "");
    var comma = m && m[0].indexOf(",") > -1;
    function fmt(x) {
      var s = Math.abs(x).toFixed(dec), p = s.split(".");
      if (sep) p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      return (x < 0 ? "-" : "") + p.join(comma ? "," : ".");
    }
    function put(x) { el.textContent = m ? txt.slice(0, m.index) + fmt(x) + txt.slice(m.index + m[0].length) : fmt(x); txt = el.textContent; m = txt.match(NUM); }
    if (el._ixStop) el._ixStop();
    if (IX.reduced || isNaN(from)) return put(to);
    var t0 = performance.now(), d = 520, raf;
    function tick(now) { var k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 4); put(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick);
    el._ixStop = function () { cancelAnimationFrame(raf); };
  };

  IX.draw = function (p) {
    if (IX.reduced || !p.getTotalLength) return;
    var L = Math.ceil(p.getTotalLength());
    p.style.transition = "none"; p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect();
    p.style.transition = ""; p.style.strokeDashoffset = "0";
  };

  // attribute changes drive count/draw, so other scripts only set attributes
  if (window.MutationObserver) new MutationObserver(function (list) {
    list.forEach(function (r) {
      var t = r.target;
      if (r.attributeName === "data-ix-count") IX.count(t, t.getAttribute("data-ix-count"));
      else if (t.hasAttribute && t.hasAttribute("data-ix-draw")) IX.draw(t);
    });
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-ix-count", "d", "points"] });

  if (!IX.reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); IX.draw(e.target); } }); }, { threshold: .4 });
    document.querySelectorAll('[data-ix-draw="in"]').forEach(function (p) { io.observe(p); });
  }

  // pointer: grid highlight + tilt, one delegated listener, one frame per move
  if (IX.reduced || !IX.fine) return;
  var cur = null, tilt = null, ev = null, queued = false;
  function leave(el) { if (!el) return; el.classList.remove("is-lit", "is-tilting"); el.style.setProperty("--ix-rx", "0deg"); el.style.setProperty("--ix-ry", "0deg"); }
  function frame() {
    queued = false; if (!ev) return;
    var t = ev.target.closest ? ev.target : null;
    var panel = t && t.closest(".ix-panel"), tl = t && t.closest("[data-ix-tilt]");
    if (panel !== cur) { if (cur) cur.classList.remove("is-lit"); cur = panel; }
    if (tl !== tilt) { leave(tilt); tilt = tl; }
    if (panel) { var r = panel.getBoundingClientRect(); panel.style.setProperty("--ix-mx", (ev.clientX - r.left) + "px"); panel.style.setProperty("--ix-my", (ev.clientY - r.top) + "px"); panel.classList.add("is-lit"); }
    if (tl) {
      var b = tl.getBoundingClientRect(), max = Math.min(5, parseFloat(tl.getAttribute("data-ix-tilt")) || 5);
      var nx = (ev.clientX - b.left) / b.width - .5, ny = (ev.clientY - b.top) / b.height - .5;
      tl.classList.add("is-tilting");
      tl.style.setProperty("--ix-ry", (nx * 2 * max).toFixed(2) + "deg"); tl.style.setProperty("--ix-rx", (-ny * 2 * max).toFixed(2) + "deg");
    }
  }
  document.addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; ev = e; if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  document.addEventListener("pointerleave", function () { if (cur) cur.classList.remove("is-lit"); leave(tilt); cur = tilt = null; });
})();
