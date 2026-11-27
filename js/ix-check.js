/* "Check your page in 10 seconds": domain -> check Worker (scripts/check-worker) -> 6 measured rows.
   Turnstile is loaded the same way as js/main.js, only on first interaction. If the Worker cannot be
   reached the sheet shows a fallback with a link to the free video audit. */
(function () {
  var ENDPOINT = "https://latseo-check.adrians-79c.workers.dev/";
  var SITEKEY = "0x4AAAAAAGSRUIroV_qiy2QQ";
  var root = document.querySelector("[data-ixc]");
  if (!root) return;
  var EN = root.getAttribute("data-lang") === "en";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // test override: <div data-ixc data-endpoint="http://127.0.0.1:8766/"> (captcha skipped on localhost only)
  var endpoint = root.getAttribute("data-endpoint") || ENDPOINT;
  var noCaptcha = local && root.hasAttribute("data-endpoint");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = EN ? {
    bad: "Enter a domain, e.g. example.com", run: "Measuring…", ok: "Done. Measured on ", rate: "5 checks per hour are allowed. For a full check, request the video audit.",
    down: "The quick check is unavailable right now. Request the free video audit instead — I check the page myself.",
    open: "Could not open the homepage within 6 seconds. Request the video audit and I will check it manually.",
    p: "OK", w: "check", f: "missing", none: "not found", chars: function (n) { return n + (n === 1 ? " char" : " chars"); },
    h1: function (c) { return c === 1 ? "1 on the page" : c + " on the page, should be 1"; },
    sm: { "sitemap.xml": "found at /sitemap.xml", "robots.txt": "found via robots.txt" },
    nohttps: "no HTTPS", yes: "active", types: "types", invalid: "block, invalid JSON", audit: "Free video audit", href: "/en/kontakti/"
  } : {
    bad: "Ierakstiet domēnu, piemēram, piemers.lv", run: "Mēru…", ok: "Gatavs. Izmērīts ", rate: "Stundā var veikt 5 pārbaudes. Pilnai pārbaudei piesakiet video auditu.",
    down: "Ātrā pārbaude šobrīd nav pieejama. Piesakiet bezmaksas video auditu — lapu pārbaudīšu pats.",
    open: "Sākumlapu neizdevās atvērt 6 sekundēs. Piesakiet video auditu, un pārbaudīšu to ar roku.",
    p: "atbilst", w: "pārbaudīt", f: "nav", none: "nav atrasts",
    chars: function (n) { return n + (n % 10 === 1 && n % 100 !== 11 ? " zīme" : " zīmes"); },
    h1: function (c) { return c === 1 ? "1 lapā" : c + " lapā, jābūt vienam"; },
    sm: { "sitemap.xml": "atrasts /sitemap.xml", "robots.txt": "atrasts caur robots.txt" },
    nohttps: "nav HTTPS", yes: "ir", types: "tipi", invalid: "bloks, nederīgs JSON", audit: "Bezmaksas video audits", href: "/bezmaksas-audits/"
  };

  var form = root.querySelector(".ixc__form"), input = root.querySelector(".ixc__input"), btn = root.querySelector(".ixc__run");
  var msg = root.querySelector(".ixc__msg"), obj = root.querySelector(".ixc__obj"), sheet = root.querySelector(".ixc__sheet");
  var rows = {};
  root.querySelectorAll(".ixc__list li").forEach(function (li) { rows[li.getAttribute("data-k")] = li; });

  /* Turnstile, as in main.js; reuses window.turnstile if the contact form already loaded it */
  var ts = { id: null, token: "", waiters: [], loading: null };
  function loadTs() {
    if (ts.loading) return ts.loading;
    ts.loading = new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      window.latseoIxCheckReady = function () { resolve(window.turnstile); };
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=latseoIxCheckReady";
      s.async = true;
      s.onerror = function () { ts.loading = null; reject(new Error("turnstile")); };
      document.head.appendChild(s);
    });
    return ts.loading;
  }
  function renderTs() {
    if (noCaptcha || ts.id !== null) return;
    ts.id = "pending";
    loadTs().then(function (t) {
      ts.id = t.render(root.querySelector(".ixc__captcha"), {
        sitekey: SITEKEY, appearance: "interaction-only", size: "flexible", language: EN ? "en" : "lv", "response-field": false,
        callback: function (k) { ts.token = k; ts.waiters.splice(0).forEach(function (w) { w(k); }); },
        "expired-callback": function () { ts.token = ""; }, "error-callback": function () { ts.token = ""; }
      });
    }).catch(function () { ts.id = null; });
  }
  function token() {
    if (noCaptcha) return Promise.resolve("local-test");
    renderTs();
    if (ts.token) { var k = ts.token; ts.token = ""; return Promise.resolve(k); }
    return new Promise(function (resolve, reject) {
      ts.waiters.push(function (k) { ts.token = ""; resolve(k); });
      setTimeout(function () { reject(new Error("captcha")); }, 15000);
    });
  }
  function resetTs() { if (window.turnstile && ts.id && ts.id !== "pending") { try { window.turnstile.reset(ts.id); } catch (e) {} } }

  function host(v) {
    v = v.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[\/?#]/)[0].replace(/\.$/, "");
    if (!v || /[@:\s\[\]]/.test(v)) return "";
    try { v = new URL("https://" + v).hostname; } catch (e) { return ""; }
    var l = v.split(".");
    return l.length > 1 && /^([a-z]{2,63}|xn--[a-z0-9-]+)$/.test(l[l.length - 1]) && /^[a-z0-9.-]{3,253}$/.test(v) ? v : "";
  }

  function set(k, status, value, note) {
    var li = rows[k];
    li.className = "is-" + status;
    li.querySelector(".ixc__v").textContent = value;
    var s = li.querySelector(".ixc__s");
    s.textContent = T[status[0]];
    if (note) { var n = document.createElement("small"); n.textContent = note; li.querySelector(".ixc__v").appendChild(n); }
  }

  function clear() {
    for (var k in rows) { rows[k].className = ""; rows[k].querySelector(".ixc__v").textContent = "—"; rows[k].querySelector(".ixc__s").textContent = ""; }
    var fb = sheet.querySelector(".ixc__fallback"); if (fb) fb.remove();
    sheet.classList.remove("is-down");
  }

  function fallback(text) {
    sheet.classList.add("is-down");
    var p = document.createElement("div"); p.className = "ixc__fallback";
    var t = document.createElement("p"); t.textContent = text;
    var a = document.createElement("a"); a.className = "btn btn--primary"; a.href = T.href; a.textContent = T.audit;
    p.appendChild(t); p.appendChild(a);
    sheet.querySelector(".ixc__list").after(p);
    msg.textContent = text;
  }

  function show(d) {
    var c = d.checks, out = [];
    out.push(["h1", c.h1.status, T.h1(c.h1.count), c.h1.text]);
    out.push(["description", c.description.status, c.description.text ? T.chars(c.description.length) : T.none, c.description.text]);
    out.push(["title", c.title.status, c.title.text ? T.chars(c.title.length) : T.none, c.title.text]);
    out.push(["https", c.https.status, c.https.status === "pass" ? T.yes : T.nohttps, c.https.final_url]);
    out.push(["sitemap", c.sitemap.status, c.sitemap.status === "pass" ? T.sm[c.sitemap.source] : T.none, c.sitemap.url]);
    out.push(["schema", c.schema.status, c.schema.valid ? c.schema.valid + " JSON-LD" : c.schema.blocks ? c.schema.blocks + " " + T.invalid : T.none,
      c.schema.types && c.schema.types.length ? T.types + ": " + c.schema.types.join(", ") : ""]);
    out.forEach(function (r, i) { setTimeout(function () { set(r[0], r[1], r[2], r[3]); }, reduce ? 0 : i * 140); });
    msg.textContent = T.ok + d.host + ".";
  }

  function run(e) {
    e.preventDefault();
    var h = host(input.value);
    if (!h) { msg.textContent = T.bad; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    input.removeAttribute("aria-invalid");
    clear();
    obj.textContent = h;
    btn.disabled = true; root.classList.add("is-busy"); msg.textContent = T.run;
    var ctl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
    token().then(function (k) {
      return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: h, "cf-turnstile-response": k }), signal: ctl ? ctl.signal : undefined });
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "json" }; }).then(function (d) { d._s = r.status; return d; });
    }).then(function (d) {
      if (d.ok && d.checks) show(d);
      else if (d.error === "rate") fallback(T.rate);
      else if (d.error === "host") { msg.textContent = T.bad; input.setAttribute("aria-invalid", "true"); }
      else if (d.error === "unreachable" || d.error === "status") fallback(T.open);
      else fallback(T.down);
    }).catch(function () { fallback(T.down); }).then(function () {
      clearTimeout(timer); btn.disabled = false; root.classList.remove("is-busy"); resetTs();
    });
  }

  function init() {
    form.addEventListener("submit", run);
    form.addEventListener("focusin", renderTs, { once: true });
    form.addEventListener("pointerdown", renderTs, { once: true });
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); init(); } }, { rootMargin: "300px" });
    io.observe(root);
  } else init();
})();
