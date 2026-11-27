/* ix-seo: interactions for /seo-pakalpojumi-riga/ (LV + EN). Plain DOM enhancement: all text stays in the HTML. */
(function () {
  var EN = document.documentElement.lang === "en";
  var T = EN ? {
    cycle: "Repeats every month", wfHint: "Select a part to see what that work touches. Illustration.", wfCap: "Illustration: parts of a website",
    wf: [["tech", "Technical SEO", "Touches: indexing, Core Web Vitals, page speed and security: whether Google can read the pages."],
         ["content", "Content", "Touches: keyword research, page structure by search intent and updating existing pages."],
         ["links", "Links", "Touches: topically relevant links from other websites."],
         ["local", "Local SEO", "Touches: Google Business Profile, business details in directories and reviews."]]
  } : {
    cycle: "Atkārtojas katru mēnesi", wfHint: "Izvēlieties daļu, lai redzētu, ko šis darbs skar. Ilustrācija.", wfCap: "Ilustrācija: mājaslapas daļas",
    wf: [["tech", "Tehniskais SEO", "Skar: indeksāciju, Core Web Vitals, lapas ātrumu un drošību — vai Google lapas var nolasīt."],
         ["content", "Saturs", "Skar: atslēgvārdu izpēti, lapu struktūru pēc meklēšanas nolūka un esošo lapu atjaunināšanu."],
         ["links", "Saites", "Skar: tematiski atbilstošas saites no citām mājaslapām."],
         ["local", "Lokālais SEO", "Skar: Google Business Profile, uzņēmuma datus katalogos un atsauksmes."]],
    pre: "Atzīmējiet jautājumus, uz kuriem jau esat saņēmis skaidru atbildi. Neatzīmētos pajautājiet savam esošajam izpildītājam.",
    of: " no ", own: "Jūsu atzīmes, tikai šajā lapā",
    v: ["Vēl nekas nav atzīmēts. Katrs neatzīmētais ir jautājums jūsu pašreizējam vai nākamajam izpildītājam.",
        "Vairums jautājumu vēl bez atbildes. Pirms līguma saņemiet atbildes rakstiski.",
        "Lielākā daļa ir skaidra. Atlikušos pajautājiet pirms līguma.",
        "Uz visiem jautājumiem atbildes ir skaidras. Tā nav rezultāta garantija, bet izvēle balstīta uz konkrētām atbildēm."],
    me: "Jūs", roles: ["Projekta vadītājs", "SEO speciālists", "Teksta autors", "Izstrādātājs"], spec: "SEO speciālists",
    tg: ["SEO speciālists", "SEO aģentūra"],
    cmpA: "Ziņa pāriet no vienas lomas citai, līdz sasniedz to, kurš veic darbu. Ilustrācija — lomas aģentūrās atšķiras.",
    cmpS: "Tiešā līnija: Jūs runājat ar cilvēku, kurš veic darbu.",
    hops: "Starpnieki starp Jums un darbu"
  };
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  var FINE = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function tilt(el) {
    if (el.__ixt) return; el.__ixt = 1; el.setAttribute("data-ix-tilt", "");
    if (window.IX && typeof window.IX.tilt === "function") { window.IX.tilt(el); return; }
    if (RM || !FINE) return;
    el.classList.add("ix-tl");
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty("--ix-rx", (-y * 4).toFixed(2) + "deg"); el.style.setProperty("--ix-ry", (x * 5).toFixed(2) + "deg");
      el.style.setProperty("--ix-mx", ((x + .5) * 100).toFixed(1) + "%"); el.style.setProperty("--ix-my", ((y + .5) * 100).toFixed(1) + "%");
    });
    el.addEventListener("pointerleave", function () { el.style.setProperty("--ix-rx", "0deg"); el.style.setProperty("--ix-ry", "0deg"); });
  }
  function countTo(el, to, fmt) {
    var from = parseFloat(el.__v || 0); el.__v = to; fmt = fmt || String;
    if (RM || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), d = 520;
    setTimeout(function () { el.textContent = fmt(to); }, d + 60);
    (function f(t) { var k = Math.max(0, Math.min(1, (t - t0) / d)), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  function lazy(sel, fn) {
    var s = document.querySelector(sel); if (!s) return;
    if (!("IntersectionObserver" in window)) return fn(s);
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); fn(s); } }, { rootMargin: "300px" });
    io.observe(s);
  }

  /* 1. choose: tickable checklist + gauge (LV page) */
  lazy('[data-ix="choose"]', function (sec) {
    var ul = sec.querySelector(".checklist"); if (!ul || EN) return;
    var lis = [].slice.call(ul.children), n = lis.length;
    sec.classList.add("ix-choose");
    lis.forEach(function (li) {
      var l = h("label", "ix-tick"), i = h("input"), b = h("span", "ix-tick__box"), t = h("span");
      i.type = "checkbox"; b.setAttribute("aria-hidden", "true");
      while (li.firstChild) t.appendChild(li.firstChild);
      l.append(i, b, t); li.appendChild(l); i.addEventListener("change", upd);
    });
    var pre = h("p", "small muted", T.pre); pre.style.marginBottom = ".5rem"; ul.before(pre);
    var g = h("div", "ix-gauge ix-panel"), row = h("div", "ix-gauge__row"), num = h("span", "ix-gauge__n ix-readout"),
        live = h("p", "ix-live"), lit = [];
    g.setAttribute("data-ix-tilt", ""); live.setAttribute("aria-live", "polite");
    row.append(h("span", "ix-cap", T.own), num);
    var dial = h("div", "ix-dial"), svg = sv("svg", { viewBox: "0 0 260 150", "aria-hidden": "true", focusable: "false" }, dial);
    var CX = 130, CY = 132, R = 100, step = 180 / n, gap = Math.min(4, step * .18);
    function pt(a, r) { var t = a * Math.PI / 180; return [(CX + r * Math.cos(t)).toFixed(2), (CY - r * Math.sin(t)).toFixed(2)]; }
    sv("path", { d: "M" + pt(180, R + 16).join(" ") + " A" + (R + 16) + " " + (R + 16) + " 0 0 1 " + pt(0, R + 16).join(" "), "class": "ix-dial__ticks" }, svg);
    for (var k = 0; k < n; k++) {
      var a0 = 180 - k * step - gap / 2, a1 = 180 - (k + 1) * step + gap / 2, d = "M" + pt(a0, R).join(" ") + " A" + R + " " + R + " 0 0 1 " + pt(a1, R).join(" ");
      sv("path", { d: d, "class": "ix-dial__seg" }, svg);
      var f = k / Math.max(1, n - 1), l = sv("path", { d: d, pathLength: "1", "class": "ix-dial__lit " + (f < .34 ? "is-sig" : f < .67 ? "is-mark" : "is-mint") }, svg);
      lit.push(l);
    }
    var nd = sv("g", { "class": "ix-dial__needle" }, svg);
    sv("line", { x1: CX, y1: CY, x2: CX - R + 18, y2: CY, "class": "ix-dial__arm" }, nd);
    sv("circle", { cx: CX, cy: CY, r: 7, "class": "ix-dial__hub" }, svg);
    var big = sv("text", { x: CX, y: CY - 36, "text-anchor": "middle", "class": "ix-dial__big" }, svg); big.textContent = "0";
    g.append(row, dial, live); ul.after(g); tilt(g);
    var prev = 0;
    function upd() {
      var c = ul.querySelectorAll("input:checked").length;
      lit.forEach(function (p, j) { p.style.transitionDelay = RM ? "0s" : (Math.abs(j - prev) * 0.04) + "s"; p.classList.toggle("on", j < c); });
      nd.style.transform = "rotate(" + (c / n * 180) + "deg)";
      nd.classList.toggle("is-hit", c === n);
      prev = c; countTo(big, c); num.textContent = c + T.of + n;
      live.textContent = T.v[c === 0 ? 0 : c === n ? 3 : c / n <= 0.4 ? 1 : 2];
    }
    upd();
  });

  /* 2. monthly cycle */
  lazy('[data-ix="monthly"]', function (sec) {
    var ul = sec.querySelector(".checklist"); if (!ul) return;
    var data = [].slice.call(ul.children).map(function (li) {
      var st = li.querySelector("strong"), rest = "", nd = st.nextSibling;
      while (nd) { rest += nd.nodeType === 3 ? nd.textContent : nd.outerHTML; nd = nd.nextSibling; }
      return { t: st.textContent, rest: rest };
    });
    var N = data.length, w = h("div", "ix-cyc"), ring = h("div", "ix-cyc__ring ix-panel"), tr = h("div", "ix-cyc__track"), pn = h("div", "ix-cyc__panel ix-readout"), btns = [], ang = 0, cur = -1;
    ring.setAttribute("data-ix-tilt", "");
    tr.setAttribute("role", "tablist"); pn.setAttribute("role", "tabpanel"); pn.setAttribute("aria-live", "polite");
    var svg = sv("svg", { viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false", "class": "ix-cyc__svg" }, ring);
    sv("circle", { cx: 50, cy: 50, r: 46, "class": "ix-cyc__orbit" }, svg);
    sv("circle", { cx: 50, cy: 50, r: 38, "class": "ix-cyc__base" }, svg);
    var prog = sv("circle", { cx: 50, cy: 50, r: 38, pathLength: 100, "class": "ix-cyc__prog", transform: "rotate(-90 50 50)" }, svg);
    var arm = sv("g", { "class": "ix-cyc__arm" }, svg);
    sv("line", { x1: 50, y1: 32, x2: 50, y2: 15, "class": "ix-cyc__armline" }, arm);
    
    var mid = h("div", "ix-cyc__mid"), midN = h("span", "ix-cyc__midn"), midT = h("span", "ix-cyc__midt");
    mid.append(midN, midT);
    data.forEach(function (d, i) {
      var c = h("div", "ix-cyc__cell"), b = h("button", "ix-cyc__btn"), a = i / N * 2 * Math.PI;
      c.style.left = (50 + 38 * Math.sin(a)).toFixed(2) + "%"; c.style.top = (50 - 38 * Math.cos(a)).toFixed(2) + "%";
      b.type = "button"; b.setAttribute("role", "tab"); b.id = "ix-cyc-" + i; b.setAttribute("aria-label", d.t);
      b.append(h("span", "ix-cyc__no", ("0" + (i + 1)).slice(-2)));
      b.addEventListener("click", function () { sel(i, false); });
      b.addEventListener("keydown", function (e) {
        var k = e.key, j = k === "ArrowRight" || k === "ArrowDown" ? (i + 1) % N : k === "ArrowLeft" || k === "ArrowUp" ? (i + N - 1) % N : k === "Home" ? 0 : k === "End" ? N - 1 : -1;
        if (j > -1) { e.preventDefault(); sel(j, true); }
      });
      c.appendChild(b); tr.appendChild(c); btns.push(b);
    });
    function sel(i, focus) {
      var target = i / N * 360;
      if (cur > -1) { var diff = ((target - ang) % 360 + 540) % 360 - 180; ang += diff; } else ang = target;
      cur = i;
      arm.style.transform = "rotate(" + ang + "deg)";
      prog.style.strokeDasharray = ((i + 1) / N * 100) + " 100";
      btns.forEach(function (b, j) { b.setAttribute("aria-selected", j === i); b.tabIndex = j === i ? 0 : -1; b.classList.toggle("is-past", j < i); });
      midN.textContent = ("0" + (i + 1)).slice(-2); midT.textContent = data[i].t;
      pn.setAttribute("aria-labelledby", "ix-cyc-" + i);
      pn.innerHTML = ""; pn.appendChild(h("strong", "", data[i].t)); pn.insertAdjacentHTML("beforeend", data[i].rest);
      if (focus) btns[i].focus();
    }
    ring.append(tr, mid);
    var side = h("div", "ix-cyc__side"); side.append(h("span", "ix-cap", T.cycle), pn);
    w.append(ring, side);
    ul.after(w); ul.style.display = "none"; sel(0, false); tilt(ring);
  });

  /* 3. compare: role diagram (LV page) */
  lazy('[data-ix="compare"]', function (sec) {
    var wrap = sec.querySelector(".table-wrap"); if (!wrap || EN) return;
    var box = h("div", "ix-cmp"), tog = h("div", "ix-cmp__tog"), sheet = h("div", "ix-cmp__sheet ix-panel"), flow = h("div", "ix-cmp__flow"),
        live = h("p", "ix-live"), bt = [], anims = [], meter = h("div", "ix-cmp__meter"), mv = h("b", "ix-readout"), ml = h("span", "ix-cap", T.hops);
    tog.setAttribute("role", "group"); flow.setAttribute("role", "img"); live.setAttribute("aria-live", "polite");
    meter.append(ml, mv);
    T.tg.forEach(function (t, i) { var b = h("button", "", t); b.type = "button"; b.addEventListener("click", function () { draw(i); }); bt.push(b); tog.appendChild(b); });
    sheet.append(flow, meter, live); box.append(tog, sheet); wrap.before(box); tilt(sheet);
    var vert = window.matchMedia && matchMedia("(max-width:719px)");
    function draw(i) {
      anims.forEach(function (a) { a.cancel(); }); anims = [];
      bt.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i); });
      var names = i ? [T.me].concat(T.roles) : [T.me, T.spec];
      box.classList.toggle("ix-cmp--spec", !i);
      flow.innerHTML = "";
      var cons = [];
      names.forEach(function (nm, j) {
        if (j) { var c = h("span", "ix-cmp__c"), dot = h("i", "ix-cmp__dot"); c.appendChild(dot); flow.appendChild(c); cons.push(dot); }
        flow.appendChild(h("span", "ix-cmp__n" + (j === 0 ? " ix-cmp__n--me" : (!i || nm === T.spec) ? " ix-cmp__n--do" : ""), nm));
      });
      flow.setAttribute("aria-label", names.join(" > "));
      live.textContent = i ? T.cmpA : T.cmpS;
      countTo(mv, cons.length);
      if (RM || !cons[0].animate) return;
      var C = cons.length, seg = 700, total = C * seg + 900, prop = vert && vert.matches ? "top" : "left";
      cons.forEach(function (dot, j) {
        var s0 = j * seg / total, s1 = (j + 1) * seg / total, f = function (v, o, off) { var k = { opacity: o, offset: off }; k[prop] = v; return k; };
        var kf = [f("0%", 0, 0)];
        if (s0 > 0) { kf.push(f("0%", 0, s0 - .0001)); }
        kf.push(f("0%", 1, s0 + .0001), f("100%", 1, s1), f("100%", 0, Math.min(.9999, s1 + .0001)), f("100%", 0, 1));
        anims.push(dot.animate(kf, { duration: total, iterations: Infinity, easing: "linear" }));
      });
    }
    draw(0);
    if (vert && vert.addEventListener) vert.addEventListener("change", function () { draw(bt[1].getAttribute("aria-pressed") === "true" ? 1 : 0); });
  });

  /* 4. what is SEO: wireframe zones */
  lazy('[data-ix="what"]', function (sec) {
    var pr = sec.querySelector(".prose"); if (!pr) return;
    var w = h("div", "ix-wf"), sheet = h("div", "ix-wf__sheet ix-panel"), live = h("p", "ix-live", T.wfHint), cap = h("span", "ix-cap", T.wfCap), zs = [];
    live.setAttribute("aria-live", "polite"); cap.style.marginTop = ".4rem";
    T.wf.forEach(function (z, i) {
      var b = h("button", "ix-wf__z ix-wf__z--" + z[0]); b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.append(h("small", "", ("0" + (i + 1)).slice(-2)), document.createTextNode(z[1]));
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        zs.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        sheet.classList.toggle("has-on", on); b.setAttribute("aria-pressed", on); live.textContent = on ? z[2] : T.wfHint;
      });
      zs.push(b); sheet.appendChild(b);
    });
    w.append(sheet, live, cap); pr.appendChild(w); tilt(sheet);
  });
})();
