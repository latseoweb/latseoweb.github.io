/* Hero as an engineering drawing: a decorative clone of this hero is drawn as a blueprint on the right of a
   draggable line. Annotations are measured from the live page (font size, <title> length, schema type). */
(function () {
  var hero = document.querySelector("[data-plan]");
  if (!hero) return;
  var plan = hero.querySelector(".plan"), grip = hero.querySelector(".plan__grip"), range = hero.querySelector(".plan__range");
  var cfg = JSON.parse(hero.getAttribute("data-plan"));
  var used = false;

  function setPos(v) { v = Math.max(0, Math.min(100, v)); hero.style.setProperty("--pos", v + "%"); range.value = Math.round(v); }

  function schemaType() {
    var out = "";
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      if (out) return;
      try { var j = JSON.parse(s.textContent), g = j["@graph"] || [j];
        g.forEach(function (n) { var t = [].concat(n["@type"] || []); if (!out && t.indexOf("ProfessionalService") > -1) out = "ProfessionalService"; });
      } catch (e) {}
    });
    return out || "WebPage";
  }

  function clone() {
    var c = hero.querySelector(".hero__grid").cloneNode(true);
    c.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
    c.querySelectorAll("h1,a").forEach(function (n) {
      var r = document.createElement(n.tagName === "H1" ? "div" : "span");
      r.className = n.className; r.innerHTML = n.innerHTML; n.replaceWith(r);
    });
    plan.innerHTML = ""; plan.appendChild(c);
    return c;
  }

  function el(cls, css, text) {
    var d = document.createElement("div"); d.className = cls;
    for (var k in css) d.style[k] = css[k] + "px";
    if (text) d.textContent = text;
    plan.appendChild(d); return d;
  }

  function annotate() {
    var c = clone(), pr = plan.getBoundingClientRect();
    var h1 = hero.querySelector(".hero__title"), px = Math.round(parseFloat(getComputedStyle(h1).fontSize));
    var map = [[".hero__title", "h1"], [".hero__description", "desc", "minor"], [".hero__actions", "cta"],
               [".hero__meta", "meta", "minor"], [".hero__stats", "stats"], [".hero__proof", "proof", "minor"]];
    map.forEach(function (m) {
      var t = c.querySelector(m[0]); if (!t) return;
      var r = t.getBoundingClientRect(), x = r.left - pr.left, y = r.top - pr.top;
      el("plan__box", { left: x - 6, top: y - 6, width: r.width + 12, height: r.height + 12 });
      // labels sit at the right end of each box, so they stay on the blueprint side of the line
      var note = el("plan__note" + (m[2] ? " plan__note--minor" : ""), { right: pr.width - (x + r.width) - 6, top: y - 30 }, cfg.notes[m[1]].replace("{px}", px));
      if (m[1] === "h1") {
        el("plan__dim", { left: x - 22, top: y, height: r.height });
        note.style.top = (y - 34) + "px";
      }
    });
    var tb = document.createElement("div"); tb.className = "plan__tb";
    cfg.tb.forEach(function (row) {
      [row[0], row[1].replace("{tl}", document.title.length).replace("{schema}", schemaType())].forEach(function (v) {
        var s = document.createElement("span"); s.textContent = v; tb.appendChild(s);
      });
    });
    plan.appendChild(tb);
  }

  // dragging: the grip anywhere, or the hero background (not links/buttons/inputs)
  function fromEvent(e) { var r = hero.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; }
  hero.addEventListener("pointerdown", function (e) {
    if (e.target.closest("a,button,input,label") && e.target !== grip) return;
    if (e.pointerType !== "mouse" && e.target !== grip) return; // on touch only the grip drags, so the page still scrolls
    used = true; hero.classList.add("is-dragging"); hero.setPointerCapture(e.pointerId); setPos(fromEvent(e));
    function move(ev) { setPos(fromEvent(ev)); }
    function up() { hero.classList.remove("is-dragging"); hero.removeEventListener("pointermove", move); hero.removeEventListener("pointerup", up); hero.removeEventListener("pointercancel", up); }
    hero.addEventListener("pointermove", move); hero.addEventListener("pointerup", up); hero.addEventListener("pointercancel", up);
  });
  range.addEventListener("input", function () { used = true; setPos(+range.value); });

  var t; window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(annotate, 150); });
  annotate();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(annotate);

  // one sweep on load: the drawing slides in from the right edge to show the line can be moved
  var end = window.matchMedia("(max-width:700px)").matches ? 74 : +range.value;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPos(end); return; }
  setPos(100);
  window.addEventListener("load", function () {
    var s = null;
    function step(now) {
      if (used) return;
      if (s === null) s = now;
      var k = Math.min(1, (now - s) / 1600), e = 1 - Math.pow(1 - k, 3);
      setPos(100 + (end - 100) * e);
      if (k < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 250);
  });
})();
