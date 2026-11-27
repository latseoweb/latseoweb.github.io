/* Homepage instruments (css/ix-home.css).
   1) Google result builder: the title is measured with canvas measureText in Arial 20px (Google's desktop
      title font) against the ~580 px cut-off; the description is counted against ~160 characters. */
(function () {
  function lazy(node, fn) {
    if (!node) return;
    if (!("IntersectionObserver" in window)) return fn(node);
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); fn(node); }
    }, { rootMargin: "500px 0px" });
    io.observe(node);
  }

  var LIM = 580, TMAX = 700, DLIM = 160, DMAX = 200;

  function serp(box) {
    var L = JSON.parse(box.getAttribute("data-l"));
    var f = {}; ["b", "s", "c", "d"].forEach(function (k) { f[k] = box.querySelector('[name="' + k + '"]'); });
    var g = box.querySelector(".serp__g"), shot = box.querySelector(".serp__shot");
    var out = { t: box.querySelector(".serp__title"), d: box.querySelector(".serp__desc"),
                n: box.querySelector(".serp__sname"), u: box.querySelector(".serp__url") };
    var msg = box.querySelector(".serp__msg");
    var ctx = document.createElement("canvas").getContext("2d");
    ctx.font = '20px Arial, "Liberation Sans", Arimo, sans-serif';
    function w(s) { return ctx.measureText(s).width; }

    var cut = document.createElement("span"); cut.className = "serp__cut"; cut.setAttribute("aria-hidden", "true");
    cut.innerHTML = "<span>~580 px</span>"; g.appendChild(cut);

    var bars = {};
    ["t", "d"].forEach(function (k) {
      var bar = box.querySelector('[data-bar="' + k + '"]'), over = document.createElement("s");
      bar.appendChild(over);
      bar.querySelector("b").style.left = (k === "t" ? LIM / TMAX : DLIM / DMAX) * 100 + "%";
      bars[k] = { i: bar.querySelector("i"), s: over, v: box.querySelector('[data-val="' + k + '"]') };
    });
    function setBar(k, val, lim, max, text) {
      var b = bars[k], a = Math.min(val, lim) / max * 100, o = Math.max(0, Math.min(val, max) - lim) / max * 100;
      b.i.style.width = a + "%"; b.s.style.left = a + "%"; b.s.style.width = o + "%";
      b.v.textContent = text; b.v.classList.toggle("is-over", val > lim);
    }

    function slug(s) {
      return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "piemers";
    }

    function update() {
      var b = f.b.value.trim(), s = f.s.value.trim(), c = f.c.value.trim(), d = f.d.value.trim();
      var title = [[s, c].filter(Boolean).join(" "), b].filter(Boolean).join(" | ");
      var desc = d || L.def.replace("{s}", s).replace("{c}", c).replace("{b}", b).replace(/^\s*\.\s*/, "");
      var tw = Math.round(w(title)), shown = title;
      if (tw > LIM) {
        while (shown.length && w(shown + " ...") > LIM) shown = shown.slice(0, -1);
        shown = shown.replace(/\s+$/, "") + " ...";
      }
      var dshown = desc.length > DLIM ? desc.slice(0, DLIM - 4).replace(/\s+\S*$/, "") + " ..." : desc;
      out.t.textContent = shown; out.d.textContent = dshown;
      out.n.textContent = b || "—"; out.u.textContent = "https://" + slug(b) + L.dom;
      setBar("t", tw, LIM, TMAX, L.px.replace("{w}", tw));
      setBar("d", desc.length, DLIM, DMAX, L.ch.replace("{n}", desc.length));
      msg.textContent = (tw > LIM ? L.long : L.ok) + " " + (desc.length > DLIM ? L.dlong : L.dok);
      msg.classList.toggle("is-over", tw > LIM || desc.length > DLIM);
    }

    function fit() {
      if (window.matchMedia("(max-width:700px)").matches) { g.style.transform = ""; g.style.marginBottom = ""; return; } // reflows in CSS at full size
      var k = Math.min(1, (shot.clientWidth - parseFloat(getComputedStyle(shot).paddingLeft) * 2) / 600);
      g.style.transform = "scale(" + k + ")";
      g.style.marginBottom = (g.offsetHeight * (k - 1)) + "px";
    }

    box.addEventListener("input", update);
    var t; window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(fit, 100); });
    update(); fit();
  }

  /* 2) Impressions timeline: knots of the real Search Console curve in assets/images/hero-impressions.svg
        (weekly points, 2026-02-16 + 7 days each, peak 3135). Only the date/week is shown, no per-week values. */
  function trend(fig) {
    var L = JSON.parse(fig.getAttribute("data-l")), plot = fig.querySelector(".trend__plot"),
        img = plot.querySelector("img"), read = fig.querySelector(".trend__read");
    fetch(img.getAttribute("src")).then(function (r) { return r.text(); }).then(function (txt) {
      var ds = txt.match(/ d="([^"]+)"/g).map(function (x) { return x.slice(4, -1); });
      var n = ds[ds.length - 1].match(/-?\d+\.?\d*/g).map(Number), pts = [[n[0], n[1]]];
      for (var i = 2; i + 5 < n.length; i += 6) pts.push([n[i + 4], n[i + 5]]);
      var last = pts.length - 1, start = Date.UTC(2026, 1, 16);
      var cur = document.createElement("span"), dot = document.createElement("span");
      cur.className = "trend__cur"; dot.className = "trend__dot"; plot.appendChild(cur); plot.appendChild(dot);
      var rg = document.createElement("input"); rg.type = "range"; rg.min = 0; rg.max = last; rg.value = last; rg.step = 1;
      rg.className = "trend__range"; rg.setAttribute("aria-label", L.label); plot.appendChild(rg);
      function fmt(i) {
        var d = new Date(start + i * 7 * 864e5), D = d.getUTCDate(), M = d.getUTCMonth(), Y = d.getUTCFullYear();
        if (L.fmt === "en") return D + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][M] + " " + Y;
        return (D < 10 ? "0" : "") + D + "." + L.m[M] + "." + Y;
      }
      var ax = document.createElement("p"); ax.className = "trend__axis"; ax.setAttribute("aria-hidden", "true");
      ax.innerHTML = "<span>" + fmt(0) + "</span><span>" + fmt(last) + "</span>"; plot.after(ax);
      function set(i) {
        i = Math.max(0, Math.min(last, i)); rg.value = i;
        cur.style.left = dot.style.left = pts[i][0] / 16 + "%"; dot.style.top = pts[i][1] / 6 + "%";
        var t = L.wk.replace("{n}", i + 1).replace("{t}", last + 1) + " · " + L.from.replace("{d}", fmt(i));
        if (i === last) t += " · " + L.peak; else if (i === 0) t += " · " + L.first;
        read.textContent = t; rg.setAttribute("aria-valuetext", t);
      }
      fig.classList.add("is-live"); read.setAttribute("aria-live", "polite");
      rg.addEventListener("input", function () { set(+rg.value); });
      set(last);
    }).catch(function () {});
  }

  lazy(document.querySelector("[data-trend]"), trend);
  lazy(document.querySelector("[data-serp]"), serp);
})();
