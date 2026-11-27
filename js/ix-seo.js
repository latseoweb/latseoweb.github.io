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
    cmpS: "Tiešā līnija: Jūs runājat ar cilvēku, kurš veic darbu."
  };
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
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
    var g = h("div", "ix-gauge"), row = h("div", "ix-gauge__row"), num = h("span", "ix-gauge__n"), bar = h("div", "ix-gauge__bar"),
        live = h("p", "ix-live"), segs = [];
    live.setAttribute("aria-live", "polite");
    row.append(num, h("span", "ix-cap", T.own));
    for (var k = 0; k < n; k++) { var s = h("i"); segs.push(s); bar.appendChild(s); }
    g.append(row, bar, live); ul.after(g);
    function upd() {
      var c = ul.querySelectorAll("input:checked").length;
      segs.forEach(function (s, j) { s.classList.toggle("on", j < c); });
      num.textContent = c + T.of + n;
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
    var N = data.length, w = h("div", "ix-cyc"), tr = h("div", "ix-cyc__track"), pn = h("div", "ix-cyc__panel"), btns = [];
    tr.setAttribute("role", "tablist"); pn.setAttribute("role", "tabpanel"); pn.setAttribute("aria-live", "polite");
    data.forEach(function (d, i) {
      var c = h("div", "ix-cyc__cell"), b = h("button", "ix-cyc__btn");
      b.type = "button"; b.setAttribute("role", "tab"); b.id = "ix-cyc-" + i; b.setAttribute("aria-label", d.t);
      b.append(h("span", "ix-cyc__no", ("0" + (i + 1)).slice(-2)), h("span", "ix-cyc__lab", d.t));
      b.addEventListener("click", function () { sel(i, false); });
      b.addEventListener("keydown", function (e) {
        var k = e.key, j = k === "ArrowRight" || k === "ArrowDown" ? (i + 1) % N : k === "ArrowLeft" || k === "ArrowUp" ? (i + N - 1) % N : k === "Home" ? 0 : k === "End" ? N - 1 : -1;
        if (j > -1) { e.preventDefault(); sel(j, true); }
      });
      c.appendChild(b); tr.appendChild(c); btns.push(b);
    });
    tr.style.gridTemplateColumns = "repeat(" + N + ",1fr)";
    function sel(i, focus) {
      btns.forEach(function (b, j) { b.setAttribute("aria-selected", j === i); b.tabIndex = j === i ? 0 : -1; });
      pn.setAttribute("aria-labelledby", "ix-cyc-" + i);
      pn.innerHTML = ""; pn.appendChild(h("strong", "", data[i].t)); pn.insertAdjacentHTML("beforeend", data[i].rest);
      if (focus) btns[i].focus();
    }
    w.append(tr, h("div", "ix-cyc__loop"), h("span", "ix-cap", T.cycle), pn);
    ul.after(w); ul.style.display = "none"; sel(0, false);
  });

  /* 3. compare: role diagram (LV page) */
  lazy('[data-ix="compare"]', function (sec) {
    var wrap = sec.querySelector(".table-wrap"); if (!wrap || EN) return;
    var box = h("div", "ix-cmp"), tog = h("div", "ix-cmp__tog"), sheet = h("div", "ix-cmp__sheet"), flow = h("div", "ix-cmp__flow"),
        live = h("p", "ix-live"), bt = [];
    tog.setAttribute("role", "group"); flow.setAttribute("role", "img"); live.setAttribute("aria-live", "polite");
    T.tg.forEach(function (t, i) { var b = h("button", "", t); b.type = "button"; b.addEventListener("click", function () { draw(i); }); bt.push(b); tog.appendChild(b); });
    sheet.append(flow, live); box.append(tog, sheet); wrap.before(box);
    function draw(i) {
      bt.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i); });
      var names = i ? [T.me].concat(T.roles) : [T.me, T.spec];
      box.classList.toggle("ix-cmp--spec", !i);
      flow.innerHTML = "";
      names.forEach(function (nm, j) {
        if (j) flow.appendChild(h("span", "ix-cmp__c"));
        flow.appendChild(h("span", "ix-cmp__n" + (j === 0 ? " ix-cmp__n--me" : (!i || nm === T.spec) ? " ix-cmp__n--do" : ""), nm));
      });
      flow.setAttribute("aria-label", names.join(" > "));
      live.textContent = i ? T.cmpA : T.cmpS;
    }
    draw(0);
  });

  /* 4. what is SEO: wireframe zones */
  lazy('[data-ix="what"]', function (sec) {
    var pr = sec.querySelector(".prose"); if (!pr) return;
    var w = h("div", "ix-wf"), sheet = h("div", "ix-wf__sheet"), live = h("p", "ix-live", T.wfHint), cap = h("span", "ix-cap", T.wfCap), zs = [];
    live.setAttribute("aria-live", "polite"); cap.style.marginTop = ".4rem";
    T.wf.forEach(function (z, i) {
      var b = h("button", "ix-wf__z ix-wf__z--" + z[0]); b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.append(h("small", "", ("0" + (i + 1)).slice(-2)), document.createTextNode(z[1]));
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        zs.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", on); live.textContent = on ? z[2] : T.wfHint;
      });
      zs.push(b); sheet.appendChild(b);
    });
    w.append(sheet, live, cap); pr.appendChild(w);
  });
})();
