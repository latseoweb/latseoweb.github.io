/* Portfolio device frames (cards from project_card()/browser() in scripts/build.py, css/ix-portfolio.css).
   Mouse: hover zooms the screenshot, the zoom follows the cursor (eased in a rAF loop) and the frame tilts a few degrees.
   Touch: drag sideways to look around (vertical swipes still scroll the page). "Rasējums" sweeps an x-ray overlay with
   element boxes read from data-pf-marks. Tilt is done here on purpose (not data-ix-tilt) so it never doubles up. */
(function () {
  var cards = document.querySelectorAll("[data-pf]");
  if (!cards.length) return;
  var en = (document.documentElement.lang || "").slice(0, 2) === "en";
  var L = en ? { bp: "Blueprint", w: "screen width", of: "show element outlines on" }
             : { bp: "Rasējums", w: "ekrāna platums", of: "rādīt elementu kontūras —" };
  var NAMES = { nav: "nav", h1: "<h1>", cta: "CTA" };
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;

  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function el(tag, cls, parent, text) {
    var d = document.createElement(tag); d.className = cls;
    if (text) d.textContent = text;
    parent.appendChild(d); return d;
  }

  function setup(pf) {
    var frame = pf.querySelector(".pf__frame"), stage = pf.querySelector(".pf__stage");
    if (!frame || !stage || pf.dataset.pfReady) return;
    pf.dataset.pfReady = "1";
    var link = pf.querySelector("a"), touch = null, moved = false;

    /* silky follow: the pointer sets targets, a rAF loop eases scale, zoom origin and tilt towards them */
    var T = { s: 1, ox: 50, oy: 0, rx: 0, ry: 0 }, C = { s: 1, ox: 50, oy: 0, rx: 0, ry: 0 }, raf = 0;
    pf.classList.add("is-js");
    function tick() {
      var k = RM ? 1 : 0.14, busy = false;
      for (var p in T) {
        var d = T[p] - C[p];
        if (Math.abs(d) > 0.002) { C[p] += d * k; busy = true; } else C[p] = T[p];
      }
      stage.style.setProperty("--zs", C.s.toFixed(4));
      stage.style.setProperty("--ox", C.ox.toFixed(2) + "%");
      stage.style.setProperty("--oy", C.oy.toFixed(2) + "%");
      if (!RM) { frame.style.setProperty("--rx", C.rx.toFixed(2) + "deg"); frame.style.setProperty("--ry", C.ry.toFixed(2) + "deg"); }
      raf = busy ? requestAnimationFrame(tick) : 0;
    }
    function go() { if (!raf) raf = requestAnimationFrame(tick); }
    function pos(e) {
      var r = frame.getBoundingClientRect();
      return [clamp((e.clientX - r.left) / r.width * 100), clamp((e.clientY - r.top) / r.height * 100)];
    }
    function aim(e, tilt) {
      var p = pos(e);
      T.ox = p[0]; T.oy = p[1];
      if (tilt && !RM) { T.ry = (p[0] - 50) / 50 * 4; T.rx = -(p[1] - 50) / 50 * 3; }
      frame.style.setProperty("--mx", p[0] + "%"); frame.style.setProperty("--my", p[1] + "%");
      go();
    }
    function rest() { T.s = 1; T.rx = 0; T.ry = 0; go(); }
    frame.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      var p = pos(e); C.ox = p[0]; C.oy = p[1];   // start the zoom already centred on the cursor: no swoop across the image
      aim(e, true); T.s = 1.75; pf.classList.add("is-zoom"); go();
    });
    frame.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { pf.classList.remove("is-zoom"); rest(); } });
    frame.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      touch = { x: e.clientX, y: e.clientY }; moved = false;
    });
    frame.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") { aim(e, true); return; }
      if (!touch) return;
      if (!moved && Math.abs(e.clientX - touch.x) > 8) { moved = true; pf.classList.add("is-zoom"); T.s = 1.75; }
      if (moved) aim(e, false);
    });
    function end() { if (!touch) return; touch = null; pf.classList.remove("is-zoom"); rest(); }
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    // a drag is not a click on the card link
    if (link) link.addEventListener("click", function (e) { if (moved) { e.preventDefault(); moved = false; } });

    var marks = pf.getAttribute("data-pf-marks");
    if (!marks) return;
    var bp = el("span", "pf__bp", stage), navBottom = 0;
    bp.setAttribute("aria-hidden", "true");
    marks.split(";").forEach(function (m) {
      var kv = m.split(":"), v = kv[1].split(",").map(Number);
      var box = el("span", "pf__box", bp);
      box.style.left = v[0] + "%"; box.style.top = v[1] + "%"; box.style.width = v[2] + "%"; box.style.height = v[3] + "%";
      var note = el("span", "pf__note", box, NAMES[kv[0]] || kv[0]);
      // a box at the very bottom of the screenshot gets its label above it, so the frame never clips the label
      if (v[1] + v[3] > 92) { note.style.top = "auto"; note.style.bottom = "100%"; }
      if (kv[0] === "nav") navBottom = v[1] + v[3];
    });
    var dim = el("span", "pf__dim", bp);
    dim.style.top = (navBottom + 4) + "%";
    el("span", "", dim, L.w);
    var scan = el("span", "pf__scan", stage); scan.setAttribute("aria-hidden", "true");

    var name = pf.querySelector(".proof__name,.shot__cap");
    var b = el("button", "pf__btn", pf, L.bp);
    b.type = "button"; b.setAttribute("aria-pressed", "false");
    if (name) b.setAttribute("aria-label", L.bp + ": " + L.of + " " + name.textContent);
    var st;
    b.addEventListener("click", function () {
      var on = pf.classList.toggle("is-bp");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      clearTimeout(st);
      if (on && !RM) { pf.classList.add("is-scan"); st = setTimeout(function () { pf.classList.remove("is-scan"); }, 780); }
      else pf.classList.remove("is-scan");
    });
  }

  if (!("IntersectionObserver" in window)) { cards.forEach(setup); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); setup(e.target); } });
  }, { rootMargin: "400px 0px" });
  cards.forEach(function (c) { io.observe(c); });
})();
