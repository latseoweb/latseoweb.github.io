/* Hero: blueprint -> website slider. The range input drives --pos; one short sweep on load shows it can be dragged. */
(function () {
  var el = document.querySelector("[data-build]");
  if (!el) return;
  var range = el.querySelector(".build__range");
  function set(v) { el.style.setProperty("--pos", v + "%"); range.value = v; }
  range.addEventListener("input", function () { el.classList.add("is-used"); set(range.value); });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var start = null, from = 92, to = 50, dur = 1400;
  function step(t) {
    if (el.classList.contains("is-used")) return;
    if (start === null) start = t;
    var k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
    set(Math.round((from + (to - from) * e) * 10) / 10);
    if (k < 1) requestAnimationFrame(step);
  }
  set(from);
  window.addEventListener("load", function () { setTimeout(function () { requestAnimationFrame(step); }, 300); });
})();
