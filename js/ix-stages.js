/* Build-stage scrubber (css/ix-stages.css): a range input across the 4 process steps switches an SVG page sketch
   (sketch, layout, content, live). Used on the homepage and on /majaslapas-izstrade/. */
(function () {
  var frame = document.querySelector("[data-build]");
  if (!frame) return;
  function lazy(node, fn) {
    if (!("IntersectionObserver" in window)) return fn(node);
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); fn(node); }
    }, { rootMargin: "500px 0px" });
    io.observe(node);
  }

  function build(frame) {
    var range = document.getElementById("build-range");
    var steps = frame.closest(".container").querySelectorAll(".steps > li");
    var tag = frame.querySelector(".build__tag"), names = frame.getAttribute("data-names").split("|");
    if (!range || steps.length !== 4) return;
    steps[0].parentNode.classList.add("is-scrub");
    // narrow screens: the steps stack, so the slider gets its own stage names underneath
    var ticks = document.createElement("div"); ticks.className = "build__ticks"; ticks.setAttribute("aria-hidden", "true");
    names.forEach(function (n, i) {
      var t = document.createElement("span"); t.textContent = n; t.style.left = (i / 3 * 100) + "%";
      t.addEventListener("click", function () { set(i + 1); }); ticks.appendChild(t);
    });
    range.parentNode.appendChild(ticks);
    var RM = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches, cur = 0;
    var svg = frame.querySelector("svg"), NS = "http://www.w3.org/2000/svg";
    var scan = document.createElementNS(NS, "line");
    scan.setAttribute("class", "b-scan"); scan.setAttribute("x1", 0); scan.setAttribute("x2", 0);
    scan.setAttribute("y1", 17); scan.setAttribute("y2", 200);
    if (svg) svg.appendChild(scan);
    function set(v) {
      v = Math.max(1, Math.min(4, Math.round(v)));
      range.style.setProperty("--p", ((v - 1) / 3).toFixed(4));
      if (v !== cur && !RM) {
        // the new stage draws itself in, a signal line sweeps across; the slider thumb pops
        frame.removeAttribute("data-a"); void frame.offsetWidth;
        if (v > cur) frame.setAttribute("data-a", v);
        if (cur) { range.classList.remove("is-snap"); void range.offsetWidth; range.classList.add("is-snap"); }
      }
      cur = v;
      frame.setAttribute("data-s", v); tag.textContent = names[v - 1]; range.value = v;
      steps.forEach(function (li, i) { li.classList.toggle("is-on", i === v - 1); });
      [].forEach.call(ticks.children, function (t, i) { t.classList.toggle("is-on", i === v - 1); });
      range.setAttribute("aria-valuetext", v + ". " + steps[v - 1].querySelector("strong").textContent + " — " + names[v - 1].toLowerCase());
    }
    range.addEventListener("input", function () { set(+range.value); });
    steps.forEach(function (li, i) { li.addEventListener("click", function () { set(i + 1); }); });
    set(+range.value);
  }

  lazy(frame, build);
})();
