/* Hero as an engineering drawing: a decorative clone of this hero is drawn as a blueprint on the right of a
   draggable line. Annotations are measured from the live page (font size, <title> length, schema type).
   The Search Console chart (row 2, built by scripts/build.py with real axes) is part of the clone, so the drawing
   shows it too. Optional 3D layer: on desktop/tablet with WebGL and no reduced motion, three.js (self-hosted, loaded
   with import() only when the browser is idle after load or on the first pointer contact) turns the chart's curve
   into an x-ray solid on the blueprint side: its front face is locked to the 2D axes (custom off-axis frustum), the
   depth shows the weekly ribs and the floor. The H1/text never depend on any of this. */
(function () {
  var hero = document.querySelector("[data-plan]");
  if (!hero) return;
  var THREE_URL = new URL("vendor/three.module.min.js", (document.currentScript && document.currentScript.src) || location.origin + "/js/").href;
  var plan = hero.querySelector(".plan"), range = hero.querySelector(".plan__range"), grip = hero.querySelector(".plan__grip");
  var box = hero.querySelector(".container"), grid = hero.querySelector(".hero__grid");
  var chart = grid.querySelector(".hero__chart"), gsc = grid.querySelector(".gsc"), aside = grid.querySelector(".hero__aside");
  var content = grid.querySelector(".hero__content");
  var cfg = JSON.parse(hero.getAttribute("data-plan"));
  var mq = function (q) { return window.matchMedia(q).matches; };
  var reduced = mq("(prefers-reduced-motion: reduce)");
  var used = false, pos = 100, onPos = null, notes = [];
  // tablets/phones: the drawing never lies over the H1 or the intro. It is confined to the chart block below the
  // text (--plan-top), where the line splits the finished chart from its drawing.
  function narrow() { return mq("(max-width:1000px)"); }

  function setPos(v) {
    v = Math.max(0, Math.min(100, v)); pos = v;
    hero.style.setProperty("--pos", v + "%"); range.value = Math.round(v);
    // the 3D mode cuts the real content at the line (container is narrower than the hero)
    var cut = hero.clientWidth * v / 100 - box.offsetLeft;
    hero.style.setProperty("--cut-r", Math.max(-40, box.clientWidth - cut) + "px");
    // a label cut by the line is hidden: every visible label is whole
    var lx = hero.clientWidth * v / 100;
    notes.forEach(function (n) { n.el.style.visibility = n.l < lx + 2 && n.r > lx ? "hidden" : ""; });
    if (onPos) onPos(v);
  }
  function markUsed() { if (!used) { used = true; hero.classList.add("is-used"); } }

  // where the line rests: in the gap between the text and the facts column (desktop); phones/tablets: right edge
  function restPos() {
    if (narrow()) return 60;
    var h = hero.getBoundingClientRect(), c = content.getBoundingClientRect(), a = aside.getBoundingClientRect();
    return ((c.right + a.left) / 2 - h.left) / h.width * 100;
  }
  // grip + hint sit in the empty band between row 1 and the chart caption
  function placeGrip() {
    var h = hero.getBoundingClientRect(), a = aside.getBoundingClientRect(), c = chart.getBoundingClientRect();
    if (narrow() && gsc) {
      var top = Math.round(gsc.getBoundingClientRect().top - h.top);
      hero.style.setProperty("--plan-top", top + "px");
      hero.style.setProperty("--grip-y", (top + 22) + "px");
      return;
    }
    hero.style.setProperty("--plan-top", "0px");
    hero.style.setProperty("--grip-y", Math.round((Math.max(a.bottom, content.getBoundingClientRect().bottom) + c.top) / 2 - h.top) + "px");
  }

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
    var c = grid.cloneNode(true);
    c.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
    c.querySelectorAll(".sr-only").forEach(function (n) { n.remove(); });
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
               [".hero__meta", "meta", "minor"], [".hero__stats", "stats"], [".hero__proof", "proof", "minor"], [".gsc__plot", "chart"]];
    map.forEach(function (m) {
      var t = c.querySelector(m[0]); if (!t) return;
      var r = t.getBoundingClientRect(), x = r.left - pr.left, y = r.top - pr.top;
      el("plan__box", { left: x - 6, top: y - 6, width: r.width + 12, height: r.height + 12 });
      if (!cfg.notes[m[1]]) return;
      // labels sit at the right end of each box, so they stay on the blueprint side of the line
      var note = el("plan__note" + (m[2] ? " plan__note--minor" : ""), { right: pr.width - (x + r.width) - 6, top: y - 30 }, cfg.notes[m[1]].replace("{px}", px));
      if (m[1] === "h1") { el("plan__dim", { left: x - 22, top: y, height: r.height }); note.style.top = (y - 34) + "px"; }
    });
    var tb = document.createElement("div"); tb.className = "plan__tb";
    cfg.tb.forEach(function (row) {
      [row[0], row[1].replace("{tl}", document.title.length).replace("{schema}", schemaType())].forEach(function (v) {
        var s = document.createElement("span"); s.textContent = v; tb.appendChild(s);
      });
    });
    plan.appendChild(tb);
    notes = [].map.call(plan.querySelectorAll(".plan__note"), function (n) { return { el: n, l: n.offsetLeft, r: n.offsetLeft + n.offsetWidth }; });
    placeGrip();
    setPos(pos);
  }

  // dragging: the grip anywhere, or the hero background (not links/buttons/inputs). Release keeps momentum.
  var glide = 0;
  function fromEvent(e) { var r = hero.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; }
  hero.addEventListener("pointerdown", function (e) {
    if (e.target.closest("a,button,input,label") && e.target !== grip) return;
    if (e.pointerType !== "mouse" && e.target !== grip) return; // on touch only the grip drags, so the page still scrolls
    markUsed(); cancelAnimationFrame(glide); hero.classList.add("is-dragging"); hero.setPointerCapture(e.pointerId);
    var lastX = fromEvent(e), lastT = performance.now(), vel = 0;
    if (e.target !== grip) setPos(lastX);
    var off = e.target === grip ? pos - lastX : 0;
    function move(ev) {
      var x = fromEvent(ev), t = performance.now(), dt = Math.max(1, t - lastT);
      vel = vel * .6 + (x - lastX) / dt * .4; lastX = x; lastT = t; setPos(x + off);
    }
    function up() {
      hero.classList.remove("is-dragging"); hero.removeEventListener("pointermove", move); hero.removeEventListener("pointerup", up); hero.removeEventListener("pointercancel", up);
      if (reduced || performance.now() - lastT > 80 || Math.abs(vel) < .02) return;
      var p = pos, prev = performance.now();
      (function step(now) {
        var dt = Math.min(32, now - prev); prev = now;
        p += vel * dt; vel *= Math.pow(.993, dt);
        if (p <= 0 || p >= 100) vel = 0;
        setPos(p);
        if (Math.abs(vel) > .002) glide = requestAnimationFrame(step);
      })(prev);
    }
    hero.addEventListener("pointermove", move); hero.addEventListener("pointerup", up); hero.addEventListener("pointercancel", up);
  });
  range.addEventListener("input", function () { markUsed(); setPos(+range.value); });

  var rt0; window.addEventListener("resize", function () { clearTimeout(rt0); rt0 = setTimeout(function () { annotate(); if (!used) setPos(restPos()); }, 150); });
  annotate();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { annotate(); if (!used && reduced) setPos(restPos()); });

  // one sweep on load: the drawing slides in from the right edge. Desktop: it rests in the gap beside the facts.
  // Phones/tablets: it slides over the right part of the chart only (the text above is never covered).
  if (reduced) setPos(restPos());
  else {
    setPos(100);
    window.addEventListener("load", function () {
      var s = null, end = restPos();
      function step(now) {
        if (used) return;
        if (s === null) s = now;
        var k = Math.min(1, (now - s) / 1600), e = 1 - Math.pow(1 - k, 3);
        setPos(100 + (end - 100) * e);
        if (k < 1) requestAnimationFrame(step);
      }
      setTimeout(function () { requestAnimationFrame(step); }, 350);
    });
  }

  /* ---------------- optional 3D layer ---------------- */
  var conn = navigator.connection || {};
  if (!gsc || reduced || conn.saveData || narrow() || mq("(pointer: coarse) and (max-width: 1024px)") || !mq("(min-width: 768px)")) return;
  var probe = document.createElement("canvas");
  if (!window.WebGLRenderingContext || !(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

  var started = false;
  function go() {
    if (started) return; started = true;
    hero.removeEventListener("pointerenter", go);
    import(THREE_URL).then(start3D).catch(function () {});
  }
  hero.addEventListener("pointerenter", go, { once: true });
  window.addEventListener("load", function () {
    setTimeout(function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1) })(go, { timeout: 4000 }); }, 1200);
  });

  function start3D(T) {
    // the same weekly impressions the 2D chart is drawn from (assets/data/latseo-gsc-weekly.json via build.py)
    var D = gsc.getAttribute("data-v").split(",").map(Number), YMAX = +gsc.getAttribute("data-ymax") || 3500;
    var plot = gsc.querySelector(".gsc__plot");
    var css = getComputedStyle(document.documentElement);
    function col(name, fb) { return new T.Color((css.getPropertyValue(name) || fb).trim() || fb); }
    var NIGHT = col("--ix-night", "#10243A"), LINE = col("--ix-line", "#93B4D3"), MARK = col("--ix-marker", "#FFC65C"),
        INK = col("--ix-ink-on", "#EEF3F8");

    var canvas = document.createElement("canvas");
    canvas.className = "hero__gl"; canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.firstChild);
    var R;
    try { R = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch (e) { canvas.remove(); return; }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    R.autoClear = false; R.setScissorTest(true);

    var scene = new T.Scene(), cam = new T.PerspectiveCamera(20, 1, .5, 200);
    var xray = new T.Group(); scene.add(xray);

    // model units: x spans the 40 weeks (L), y = impressions on the chart's own scale (HM = YMAX), slab Z deep
    var L = 16, HM = 4, Z = 2.2, n = D.length, ZF = Z / 2;
    var pts = D.map(function (v, i) { return new T.Vector2(-L / 2 + i * L / (n - 1), v / YMAX * HM); });
    var shape = new T.Shape();
    shape.moveTo(-L / 2, 0); shape.lineTo(pts[0].x, pts[0].y); shape.splineThru(pts.slice(1)); shape.lineTo(L / 2, 0); shape.lineTo(-L / 2, 0);
    var geo = new T.ExtrudeGeometry(shape, { depth: Z, bevelEnabled: false, curveSegments: 6 });
    geo.translate(0, 0, -ZF);
    var top = new T.SplineCurve(pts).getPoints(n * 8);
    function v3(p, z, dy) { return new T.Vector3(p.x, Math.max(0, p.y) + (dy || 0), z); }
    function lines(arr, color, opacity) {
      return new T.LineSegments(new T.BufferGeometry().setFromPoints(arr), new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: false }));
    }
    function strip(arr, color, opacity) {
      return new T.Line(new T.BufferGeometry().setFromPoints(arr), new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity }));
    }

    // layer 1 (body): edges, weekly ribs across the depth, drop lines to the floor
    var body = new T.Group(); xray.add(body);
    body.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: LINE, transparent: true, opacity: .07, depthWrite: false })));
    body.add(new T.LineSegments(new T.EdgesGeometry(geo, 25), new T.LineBasicMaterial({ color: LINE, transparent: true, opacity: .55 })));
    var ribs = [], drops = [];
    pts.forEach(function (p) { ribs.push(v3(p, ZF), v3(p, -ZF)); drops.push(v3(p, -ZF), new T.Vector3(p.x, 0, -ZF)); });
    body.add(lines(ribs, LINE, .5), lines(drops, LINE, .18));

    // layer 2 (skin, lifts off while the line is dragged): the surface the visitor sees, in ink, its back edge faint
    var skin = new T.Group(); xray.add(skin);
    skin.add(strip(top.map(function (p) { return v3(p, ZF); }), INK, 1), strip(top.map(function (p) { return v3(p, -ZF); }), INK, .3));

    // layer 3 (floor, drops away while dragging): grid and weekly ticks in amber
    var floor = new T.Group(); xray.add(floor);
    var g = [], step = L / (n - 1);
    for (var i = 0; i < n; i += 4) g.push(new T.Vector3(-L / 2 + i * step, 0, -ZF - .5), new T.Vector3(-L / 2 + i * step, 0, ZF));
    for (var k = 0; k <= 3; k++) { var z = -ZF - .5 + k * (Z + .5) / 3; g.push(new T.Vector3(-L / 2, 0, z), new T.Vector3(L / 2, 0, z)); }
    floor.add(lines(g, LINE, .22));
    var ticks = [];
    pts.forEach(function (p, i) { ticks.push(new T.Vector3(p.x, 0, -ZF), new T.Vector3(p.x, 0, -ZF - (i % 4 === 0 ? .45 : .2))); });
    floor.add(lines(ticks, MARK, .85));

    // camera: off-axis frustum so that the slab's front face (z = ZF) lands exactly on the 2D plot rectangle;
    // the camera sits above and to the right, so depth reads as perspective without moving the axes.
    var W = 0, H = 0, P = { x: 0, y: 0, w: 1, h: 1 }, dist = 11;
    function size() {
      W = hero.clientWidth; H = hero.clientHeight;
      R.setSize(W, H, false);
      var hr = hero.getBoundingClientRect(), r = plot.getBoundingClientRect();
      P = { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
      dirty = true;
    }
    function frustum(cx, cy) {
      var sx = P.w / L, sy = P.h / HM, nr = cam.near;
      var X = function (px) { return (px - P.x) / sx - L / 2; }, Y = function (py) { return (P.y + P.h - py) / sy; };
      cam.position.set(cx, cy, ZF + dist); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
      var f = nr / dist;
      cam.projectionMatrix.makePerspective((X(0) - cx) * f, (X(W) - cx) * f, (Y(0) - cy) * f, (Y(H) - cy) * f, nr, cam.far);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }

    // springs: pointer parallax (camera slides, the front face stays on the axes), layer separation while dragging
    function S(v) { return { x: v, v: 0, to: v }; }
    var px_ = S(0), py_ = S(0), ex = S(0), dirty = true, raf = 0, visible = true, last = 0;
    function stepS(s, dt, k, c) { s.v += ((s.to - s.x) * k - s.v * c) * dt; s.x += s.v * dt; return Math.abs(s.to - s.x) > 1e-4 || Math.abs(s.v) > 1e-4; }
    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = hero.getBoundingClientRect();
      px_.to = ((e.clientX - r.left) / r.width - .5) * 4; py_.to = -((e.clientY - r.top) / r.height - .5) * 2.4; kick();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { px_.to = 0; py_.to = 0; kick(); });
    new MutationObserver(function () { ex.to = hero.classList.contains("is-dragging") ? 1 : 0; kick(); }).observe(hero, { attributes: true, attributeFilter: ["class"] });
    onPos = function () { dirty = true; kick(); };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(hero);
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); kick(); }, 160); });

    function frame(now) {
      raf = 0;
      var dt = Math.min(.033, (now - (last || now)) / 1000 || .016); last = now;
      var moving = stepS(px_, dt, 40, 11) | stepS(py_, dt, 40, 11) | stepS(ex, dt, 110, 11);
      frustum(3 + px_.x, HM * 1.45 + py_.x);
      var e = ex.x;
      skin.position.set(0, e * .45, e * .9);
      floor.position.set(0, -e * .5, -e * .4);
      draw();
      if ((moving || dirty) && visible) { dirty = false; kick(); } else last = 0;
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    function draw() {
      var x = Math.round(W * pos / 100);
      R.setViewport(0, 0, W, H);
      R.setScissor(0, 0, W, H); R.setClearColor(0x000000, 0); R.clear();
      if (x >= W || narrow()) return;
      R.setScissor(x, 0, W - x, H); R.setClearColor(NIGHT, 1); R.clear();
      R.render(scene, cam);
    }

    size(); frustum(3, HM * 1.45); draw();
    hero.classList.add("hero--3d");
    kick();
  }
})();
