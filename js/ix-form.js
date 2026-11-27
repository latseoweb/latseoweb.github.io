/* Contact block sheet (css/ix-form.css): the blueprint next to a form redraws itself when "Kas Jums vajadzīgs?"
   (select[name=need]) changes. Option order comes from build.py: new site, shop, SEO, free audit, full audit, local SEO, other.
   When the column is too short for the full sheet, build.py's fit script adds .after__sheet--sm and fires "ix-fit":
   the compact sheet shows the sketch from the start. */
(function () {
  var MODE = ["web", "web", "seo", "audit", "audit", "seo", "other"], ORDER = ["web", "seo", "audit", "other"];
  document.querySelectorAll(".after__sheet[data-draw]").forEach(function (sheet) {
    var scope = sheet.closest(".two-col") || document, sel = scope.querySelector('select[name="need"]'),
        svg = sheet.querySelector(".after__draw"), cap = sheet.querySelector("figcaption");
    if (!sel || !svg || sheet.getAttribute("data-ix")) return;
    sheet.setAttribute("data-ix", "1");
    var texts = JSON.parse(sheet.getAttribute("data-draw")), orig = cap.textContent, touched = false;
    function show() {
      var m = MODE[sel.selectedIndex] || "other";
      svg.hidden = false; sheet.setAttribute("data-m", m);
      cap.textContent = texts[ORDER.indexOf(m)];
    }
    function change() { touched = true; show(); }
    sel.addEventListener("change", change);
    sel.addEventListener("input", change);
    sheet.addEventListener("ix-fit", function () {
      if (touched || sheet.classList.contains("after__sheet--sm")) show();
      else { svg.hidden = true; cap.textContent = orig; }
    });
  });
})();
