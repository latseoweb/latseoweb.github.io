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

  lazy(frame, build);
})();
