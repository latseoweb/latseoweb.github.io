/* Hero as an engineering drawing: a decorative clone of this hero is drawn as a blueprint on the right of a
   draggable line. Annotations are measured from the live page (font size, <title> length, schema type).
   Optional 3D layer: on desktop/tablet with WebGL and no reduced motion, three.js (self-hosted, loaded with
   import() only when the browser is idle after load or on the first pointer contact) draws the real Search Console
   curve as a solid model. Left of the line it is the finished white object, right of the line an x-ray: edges,
   weekly ribs and the measured marks, its layers pulled apart. The H1/text never depend on any of this. */
(function () {
  var hero = document.querySelector("[data-plan]");
  if (!hero) return;
  var THREE_URL = new URL("vendor/three.module.min.js", (document.currentScript && document.currentScript.src) || location.origin + "/js/").href;
  var plan = hero.querySelector(".plan"), grip = hero.querySelector(".plan__grip"), range = hero.querySelector(".plan__range");
  var box = hero.querySelector(".container");
  var cfg = JSON.parse(hero.getAttribute("data-plan"));
  var mq = function (q) { return window.matchMedia(q).matches; };
  var reduced = mq("(prefers-reduced-motion: reduce)");
  var used = false, pos = +range.value, onPos = null;

  function setPos(v) {
    v = Math.max(0, Math.min(100, v)); pos = v;
    hero.style.setProperty("--pos", v + "%"); range.value = Math.round(v);
    // the 3D mode cuts the real content at the line (container is narrower than the hero)
    var cut = hero.clientWidth * v / 100 - box.offsetLeft;
    hero.style.setProperty("--cut-r", Math.max(-40, box.clientWidth - cut) + "px");
    if (onPos) onPos(v);
  }
  function markUsed() { if (!used) { used = true; hero.classList.add("is-used"); } }

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
    setPos(lastX);
    function move(ev) {
      var x = fromEvent(ev), t = performance.now(), dt = Math.max(1, t - lastT);
      vel = vel * .6 + (x - lastX) / dt * .4; lastX = x; lastT = t; setPos(x);
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

  var t; window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(annotate, 150); });
  annotate();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(annotate);

  // one sweep on load: the drawing slides in from the right edge to show the line can be moved
  var end = mq("(max-width:700px)") ? 74 : +range.value;
  if (reduced) setPos(end);
  else {
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
  }

  /* ---------------- optional 3D layer ---------------- */
  var conn = navigator.connection || {};
  if (reduced || conn.saveData || hero.clientWidth < 768 || mq("(pointer: coarse) and (max-width: 1024px)") || !mq("(min-width: 768px)")) return;
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

  // weekly Search Console impressions, normalised to the peak (3 135); same series as assets/images/hero-impressions.svg
  var D = [0.001,0.001,0.002,0.001,0.002,0.009,0.02,0.056,0.067,0.122,0.11,0.132,0.104,0.112,0.145,0.119,0.105,0.249,0.283,0.297,
           0.315,0.281,0.264,0.451,0.449,0.576,0.713,0.728,0.649,0.646,0.654,0.325,0.291,0.391,0.509,0.608,0.691,0.661,0.77,1.0];

  function start3D(T) {
    var css = getComputedStyle(document.documentElement);
    function col(name, fb) { return new T.Color((css.getPropertyValue(name) || fb).trim() || fb); }
    var NIGHT = col("--ix-night", "#10243A"), LINE = col("--ix-line", "#93B4D3"), MARK = col("--ix-marker", "#FFC65C"),
        INK = col("--ix-ink-on", "#EEF3F8"), GREEN = col("--accent", "#1F6045");

    var canvas = document.createElement("canvas");
    canvas.className = "hero__gl"; canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.firstChild);
    var R;
    try { R = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch (e) { canvas.remove(); return; }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    R.autoClear = false; R.setScissorTest(true);

    var scene = new T.Scene(), cam = new T.PerspectiveCamera(13, 1, 1, 400);
    var world = new T.Group(); scene.add(world);
    var solid = new T.Group(), xray = new T.Group(); world.add(solid, xray);

    // geometry: 40 weeks along x, height = impressions, a slab 1.7 deep
    var L = 16, Z = 2.2, HMAX = 3.6, BASE = .12, n = D.length;
    var pts = D.map(function (v, i) { return new T.Vector2(-L / 2 + i * L / (n - 1), BASE + v * HMAX); });
    var shape = new T.Shape();
    shape.moveTo(-L / 2, 0); shape.lineTo(pts[0].x, pts[0].y); shape.splineThru(pts.slice(1)); shape.lineTo(L / 2, 0); shape.lineTo(-L / 2, 0);
    var geo = new T.ExtrudeGeometry(shape, { depth: Z, bevelEnabled: false, curveSegments: 6 });
    geo.translate(0, 0, -Z / 2);
    var top = new T.SplineCurve(pts).getPoints(n * 8);
    function v3(p, z, dy) { return new T.Vector3(p.x, p.y + (dy || 0), z); }

    // finished side: a pale solid with the brand-green data edge
    solid.add(new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0xC4D1CA })));
    var edge = new T.CatmullRomCurve3(top.map(function (p) { return v3(p, Z / 2 + .004); }));
    solid.add(new T.Mesh(new T.TubeGeometry(edge, n * 8, .035, 6, false), new T.MeshBasicMaterial({ color: GREEN })));
    var backEdge = new T.CatmullRomCurve3(top.map(function (p) { return v3(p, -Z / 2); }));
    solid.add(new T.Mesh(new T.TubeGeometry(backEdge, n * 4, .012, 4, false), new T.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .35 })));
    scene.add(new T.HemisphereLight(0xffffff, 0xB8C6BF, .8));
    var sun = new T.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 8, 6); scene.add(sun);

    function lines(arr, color, opacity) {
      var g = new T.BufferGeometry().setFromPoints(arr);
      return new T.LineSegments(g, new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: false }));
    }
    function strip(arr, color, opacity) {
      return new T.Line(new T.BufferGeometry().setFromPoints(arr), new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity }));
    }

    // x-ray, layer 1 (middle): the body's edges, weekly ribs and drop lines
    var body = new T.Group(); xray.add(body);
    body.add(new T.LineSegments(new T.EdgesGeometry(geo, 25), new T.LineBasicMaterial({ color: LINE, transparent: true, opacity: .6 })));
    var ribs = [], drops = [];
    pts.forEach(function (p) {
      ribs.push(v3(p, Z / 2), v3(p, -Z / 2));
      drops.push(v3(p, Z / 2), new T.Vector3(p.x, 0, Z / 2));
    });
    body.add(lines(ribs, LINE, .45), lines(drops, LINE, .22));

    // layer 2 (lifted): the surface skin, i.e. what the visitor sees, as a light ink outline
    var skin = new T.Group(); xray.add(skin);
    skin.add(strip(top.map(function (p) { return v3(p, Z / 2); }), INK, 1), strip(top.map(function (p) { return v3(p, -Z / 2); }), INK, .25));
    var skinRibs = [];
    pts.forEach(function (p, i) { if (i % 4 === 0 || i === n - 1) skinRibs.push(v3(p, Z / 2), v3(p, -Z / 2)); });
    skin.add(lines(skinRibs, INK, .35));

    // layer 3 (lowered): the floor with measured marks: weekly ticks and the peak dimension
    var floor = new T.Group(); xray.add(floor);
    var grid = [];
    for (var gx = -L / 2; gx <= L / 2 + .01; gx += L / (n - 1) * 4) grid.push(new T.Vector3(gx, 0, -Z / 2 - .6), new T.Vector3(gx, 0, Z / 2 + .6));
    for (var gz = -Z / 2 - .6; gz <= Z / 2 + .61; gz += (Z + 1.2) / 4) grid.push(new T.Vector3(-L / 2 - .4, 0, gz), new T.Vector3(L / 2 + .4, 0, gz));
    floor.add(lines(grid, LINE, .18));
    var ticks = [];
    pts.forEach(function (p, i) { var k = i % 4 === 0 ? .32 : .16; ticks.push(new T.Vector3(p.x, 0, Z / 2 + .6), new T.Vector3(p.x, 0, Z / 2 + .6 + k)); });
    floor.add(lines(ticks, MARK, .9));
    var peak = pts[n - 1], first = pts[0], dx = peak.x + .45;
    var dim = [new T.Vector3(dx, 0, Z / 2), new T.Vector3(dx, peak.y, Z / 2),
               new T.Vector3(dx - .15, 0, Z / 2), new T.Vector3(dx + .15, 0, Z / 2),
               new T.Vector3(dx - .15, peak.y, Z / 2), new T.Vector3(dx + .15, peak.y, Z / 2),
               new T.Vector3(peak.x, peak.y, Z / 2), new T.Vector3(dx + .15, peak.y, Z / 2)];
    xray.add(lines(dim, MARK, 1));
    function label(text, x, y, z, align) {
      var c = document.createElement("canvas"), g = c.getContext("2d"), f = "500 44px 'IBM Plex Mono', ui-monospace, monospace";
      g.font = f; var w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 64;
      g.font = f; g.fillStyle = "#" + MARK.getHexString(); g.textBaseline = "middle"; g.fillText(text, 12, 34);
      var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      var s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      var h = .42; s.scale.set(h * w / 64, h, 1); s.center.set(align === "right" ? 1 : 0, .5); s.position.set(x, y, z);
      return s;
    }
    var nums = (document.querySelector(".hero__bgnote") || {}).textContent || "";
    var m = nums.match(/\(\D*?(\d+)\D+(\d[\d\s\u00a0,]*\d)\)/);   // "(no 2 līdz 3 135)" / "(from 2 to 3,135)"
    xray.add(label(m ? m[2].replace(/[\s,]/g, "\u2009") : "3\u2009135", peak.x - .15, peak.y + .5, Z / 2, "right"));
    xray.add(label(m ? m[1] : "2", first.x - .3, first.y + .35, Z / 2, "right"));

    // camera: fit the 16-unit model to the hero width, model sits in the lower part like the 2D curve
    var W = 0, H = 0;
    function size() {
      W = hero.clientWidth; H = hero.clientHeight;
      R.setSize(W, H, false);
      var a = W / H, half = Math.tan(cam.fov * Math.PI / 360);
      var d = Math.max(20, (L / 2 + 2.2) / (half * a));
      cam.aspect = a; cam.updateProjectionMatrix();
      var hh = d * half, pitch = .2;
      var ty = hh * .62;
      cam.position.set(0, ty + Math.sin(pitch) * d, Math.cos(pitch) * d);
      cam.lookAt(0, ty, 0);
      dirty = true;
    }

    // springs: pointer tilt (max ~5 deg), layer separation (pulls apart more while the line is dragged)
    function S(v) { return { x: v, v: 0, to: v }; }
    var yaw = S(0), pit = S(0), ex = S(0), dirty = true, raf = 0, visible = true, last = 0;
    function stepS(s, dt, k, c) { s.v += ((s.to - s.x) * k - s.v * c) * dt; s.x += s.v * dt; return Math.abs(s.to - s.x) > 1e-4 || Math.abs(s.v) > 1e-4; }
    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = hero.getBoundingClientRect();
      yaw.to = ((e.clientX - r.left) / r.width - .5) * .16; pit.to = ((e.clientY - r.top) / r.height - .5) * .07; kick();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { yaw.to = 0; pit.to = 0; kick(); });
    new MutationObserver(function () { ex.to = hero.classList.contains("is-dragging") ? 1.7 : 1; kick(); }).observe(hero, { attributes: true, attributeFilter: ["class"] });
    onPos = function () { dirty = true; kick(); };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(hero);
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); kick(); }, 120); });

    function frame(now) {
      raf = 0;
      var dt = Math.min(.033, (now - (last || now)) / 1000 || .016); last = now;
      var moving = stepS(yaw, dt, 60, 12) | stepS(pit, dt, 60, 12) | stepS(ex, dt, 110, 11);
      world.rotation.y = yaw.x; world.rotation.x = pit.x;
      var e = ex.x;
      skin.position.set(0, e * .95, e * .35);
      floor.position.set(0, -e * .55, 0);
      body.position.set(0, 0, 0);
      draw();
      if ((moving || dirty) && visible) { dirty = false; kick(); } else last = 0;
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    function draw() {
      var x = Math.round(W * pos / 100);
      R.setScissor(0, 0, x, H); R.setViewport(0, 0, W, H);
      R.setClearColor(0xffffff, 0); R.clear();
      solid.visible = true; xray.visible = false; R.render(scene, cam);
      R.setScissor(x, 0, W - x, H);
      R.setClearColor(NIGHT, 1); R.clear();
      solid.visible = false; xray.visible = true; R.render(scene, cam);
    }

    size(); draw();
    hero.classList.add("hero--3d");
    setTimeout(function () { ex.to = 1; kick(); }, 300);
  }
})();
