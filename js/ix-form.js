/* Contact block sheet (css/ix-form.css): the blueprint next to a form redraws itself when "Kas Jums vajadzīgs?"
   (select[name=need]) changes. Option order comes from build.py: new site, shop, SEO, free audit, full audit, local SEO, other.
   When the column is too short for the full sheet, build.py's fit script adds .after__sheet--sm and fires "ix-fit":
   the compact sheet shows the sketch from the start. Every shape of the active sketch draws itself line by line. */
(function () {
  var MODE = ["web", "web", "seo", "audit", "audit", "seo", "other"], ORDER = ["web", "seo", "audit", "other"];
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  document.querySelectorAll(".after__sheet[data-draw]").forEach(function (sheet) {
    var scope = sheet.closest(".two-col") || document, sel = scope.querySelector('select[name="need"]'),
        svg = sheet.querySelector(".after__draw"), cap = sheet.querySelector("figcaption");
    if (!sel || !svg || sheet.getAttribute("data-ix")) return;
    sheet.setAttribute("data-ix", "1");
    var texts = JSON.parse(sheet.getAttribute("data-draw")), orig = cap.textContent, touched = false, last = "";
    // pathLength=1 lets one dash value draw every shape, whatever its real length
    svg.querySelectorAll("g > *").forEach(function (n, i) {
      n.setAttribute("pathLength", "1");
      n.style.setProperty("--i", i % 12);
    });
    function draw(m) {
      var g = svg.querySelector('g[data-m="' + m + '"]');
      svg.querySelectorAll("g.is-drawing").forEach(function (x) { x.classList.remove("is-drawing"); });
      if (!g || RM) return;
      void g.getBoundingClientRect();
      g.classList.add("is-drawing");
    }
    function show() {
      var m = MODE[sel.selectedIndex] || "other";
      var wasHidden = svg.hasAttribute("hidden");
      svg.removeAttribute("hidden"); sheet.setAttribute("data-m", m);
      cap.textContent = texts[ORDER.indexOf(m)];
      if (m !== last || wasHidden) draw(m);
      last = m;
    }
    function change() { touched = true; show(); }
    sel.addEventListener("change", change);
    sel.addEventListener("input", change);
    sheet.addEventListener("ix-fit", function () {
      if (touched || sheet.classList.contains("after__sheet--sm")) show();
      else { svg.setAttribute("hidden", ""); cap.textContent = orig; last = ""; }
    });
  });
})();
