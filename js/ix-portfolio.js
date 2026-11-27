/* Portfolio device frames (cards from project_card()/browser() in scripts/build.py, css/ix-portfolio.css).
   Mouse: hover zooms the screenshot, the zoom follows the cursor. Touch: drag sideways to look around
   (vertical swipes still scroll the page). "Rasējums" toggles element boxes read from data-pf-marks. */
(function () {
  var cards = document.querySelectorAll("[data-pf]");
  if (!cards.length) return;
  var en = (document.documentElement.lang || "").slice(0, 2) === "en";
  var L = en ? { bp: "Blueprint", w: "screen width", of: "show element outlines on" }
             : { bp: "Rasējums", w: "ekrāna platums", of: "rādīt elementu kontūras —" };
  var NAMES = { nav: "nav", h1: "<h1>", cta: "CTA" };

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

    function aim(e) {
      var r = frame.getBoundingClientRect();
      stage.style.setProperty("--ox", clamp((e.clientX - r.left) / r.width * 100) + "%");
      stage.style.setProperty("--oy", clamp((e.clientY - r.top) / r.height * 100) + "%");
    }
    frame.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { aim(e); pf.classList.add("is-zoom"); } });
    frame.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") pf.classList.remove("is-zoom"); });
    frame.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      touch = { x: e.clientX, y: e.clientY }; moved = false;
    });
    frame.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse") { aim(e); return; }
      if (!touch) return;
      if (!moved && Math.abs(e.clientX - touch.x) > 8) { moved = true; pf.classList.add("is-zoom"); }
      if (moved) aim(e);
    });
    function end() { if (!touch) return; touch = null; pf.classList.remove("is-zoom"); }
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
      el("span", "pf__note", box, NAMES[kv[0]] || kv[0]);
      if (kv[0] === "nav") navBottom = v[1] + v[3];
    });
    var dim = el("span", "pf__dim", bp);
    dim.style.top = (navBottom + 4) + "%";
    el("span", "", dim, L.w);

    var name = pf.querySelector(".proof__name,.shot__cap");
    var b = el("button", "pf__btn", pf, L.bp);
    b.type = "button"; b.setAttribute("aria-pressed", "false");
    if (name) b.setAttribute("aria-label", L.bp + ": " + L.of + " " + name.textContent);
    b.addEventListener("click", function () {
      var on = pf.classList.toggle("is-bp");
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  if (!("IntersectionObserver" in window)) { cards.forEach(setup); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); setup(e.target); } });
  }, { rootMargin: "400px 0px" });
  cards.forEach(function (c) { io.observe(c); });
})();
