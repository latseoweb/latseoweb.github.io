/* Homepage instruments (css/ix-home.css).
   1) Google result builder: the title is measured with canvas measureText in Arial 20px (Google's desktop
      title font) against the ~580 px cut-off; the description is counted against ~160 characters.
   2) Build-stage scrubber: a range input across the 4 "Kā notiek darbs" steps switches an SVG page sketch. */
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
      var k = Math.min(1, (shot.clientWidth - parseFloat(getComputedStyle(shot).paddingLeft) * 2) / 600);
      g.style.transform = "scale(" + k + ")";
      g.style.marginBottom = (g.offsetHeight * (k - 1)) + "px";
    }

    box.addEventListener("input", update);
    var t; window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(fit, 100); });
    update(); fit();
  }

  function build(frame) {
    var range = document.getElementById("build-range");
    var steps = frame.closest(".container").querySelectorAll(".steps > li");
    var tag = frame.querySelector(".build__tag"), names = frame.getAttribute("data-names").split("|");
    if (!range || steps.length !== 4) return;
    steps[0].parentNode.classList.add("is-scrub");
    function set(v) {
      v = Math.max(1, Math.min(4, Math.round(v)));
      frame.setAttribute("data-s", v); tag.textContent = names[v - 1]; range.value = v;
      steps.forEach(function (li, i) { li.classList.toggle("is-on", i === v - 1); });
      range.setAttribute("aria-valuetext", v + ". " + steps[v - 1].querySelector("strong").textContent + " — " + names[v - 1].toLowerCase());
    }
    range.addEventListener("input", function () { set(+range.value); });
    steps.forEach(function (li, i) { li.addEventListener("click", function () { set(i + 1); }); });
    set(+range.value);
  }

  lazy(document.querySelector("[data-serp]"), serp);
  lazy(document.querySelector("[data-build]"), build);
})();
