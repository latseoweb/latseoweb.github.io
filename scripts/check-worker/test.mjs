// Unit tests for the check Worker. Run: node scripts/check-worker/test.mjs  (Node 18+)
import assert from "node:assert/strict";
import worker from "./worker.js";

const { validateHost, safeUrl, analyse } = worker._test;

// --- hostname validation ---
const ok = ["latseo.com", "www.latseo.com", "LatSEO.com", "example.lv.", "sub.domain.co.uk", "xn--mjaslapa-g8a.lv", "a-b.lv", "1.lv", "123abc.com"];
const bad = ["", " ", "localhost", "localhost.", "foo.localhost", "intranet", "127.0.0.1", "10.0.0.1", "192.168.1.1",
  "0x7f.0.0.1", "2130706433", "[::1]", "::1", "169.254.169.254", "metadata.google.internal", "printer.local",
  "router.lan", "a.home.arpa", "1.0.0.127.in-addr.arpa", "site.test", "x.example", "x.invalid", "abc.onion",
  "https://latseo.com", "latseo.com/path", "latseo.com:8080", "user@latseo.com", "-bad.com", "bad-.com", "a..com",
  ".com", "com", "läti.lv", "a b.com", "a.c", "a.123", "x.workers.dev", "a".repeat(64) + ".com",
  ("a".repeat(60) + ".").repeat(5) + "com", null, undefined, 42, {}];
for (const h of ok) assert.ok(validateHost(h), "should accept " + h);
for (const h of bad) assert.equal(validateHost(h), null, "should reject " + JSON.stringify(h));
assert.equal(validateHost("LatSEO.com."), "latseo.com");

// --- redirect / URL safety ---
assert.ok(safeUrl("https://www.latseo.com/", undefined, "latseo.com"));
assert.ok(safeUrl("/lv/", "https://latseo.com/", "latseo.com"));
assert.equal(safeUrl("https://evil.com/", undefined, "latseo.com"), null);
assert.equal(safeUrl("https://sub.latseo.com/", undefined, "latseo.com"), null);
assert.equal(safeUrl("http://127.0.0.1/", undefined, "latseo.com"), null);
assert.equal(safeUrl("https://latseo.com:8443/", undefined, "latseo.com"), null);
assert.equal(safeUrl("https://u:p@latseo.com/", undefined, "latseo.com"), null);
assert.equal(safeUrl("file:///etc/passwd", undefined, "latseo.com"), null);
assert.equal(safeUrl("javascript:alert(1)", undefined, "latseo.com"), null);

// --- HTML analysis ---
const html = `<!doctype html><html><head><title> Mājaslapu izstrāde &amp; SEO </title>
<meta
  content="Apraksts ar &quot;pēdiņām&quot;" name="Description">
<!-- <h1>comment</h1> -->
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":["WebPage","AboutPage"]}]}</script>
<script type="application/ld+json">{broken</script>
<script>var x="<h1>not real</h1>";</script></head>
<body><h1 class="x">Virsraksts <span>viens</span></h1></body></html>`;
const r = analyse(html);
assert.equal(r.title.status, "pass");
assert.equal(r.title.text, "Mājaslapu izstrāde & SEO");
assert.equal(r.title.length, 24);
assert.equal(r.description.status, "pass");
assert.equal(r.description.text, 'Apraksts ar "pēdiņām"');
assert.equal(r.h1.count, 1);
assert.equal(r.h1.text, "Virsraksts viens");
assert.equal(r.schema.status, "pass");
assert.equal(r.schema.blocks, 2);
assert.equal(r.schema.valid, 1);
assert.deepEqual(r.schema.types, ["Organization", "WebPage", "AboutPage"]);
const empty = analyse("<html><body><h1>a</h1><h1>b</h1></body></html>");
assert.equal(empty.title.status, "fail");
assert.equal(empty.description.status, "fail");
assert.equal(empty.h1.status, "warn");
assert.equal(empty.schema.status, "fail");

// --- handler, with fetch mocked (no network) ---
const pages = {
  "https://demo.lv/": { status: 301, headers: { Location: "https://www.demo.lv/" } },
  "https://www.demo.lv/": { status: 200, body: html },
  "https://www.demo.lv/sitemap.xml": { status: 404, body: "nope" },
  "https://www.demo.lv/robots.txt": { status: 200, body: "User-agent: *\nSitemap: https://www.demo.lv/sm.xml\nSitemap: https://evil.com/x.xml" },
  "https://www.demo.lv/sm.xml": { status: 200, body: '<?xml version="1.0"?><urlset></urlset>' },
  "https://loop.lv/": { status: 302, headers: { Location: "https://evil.com/" } },
};
const seen = [];
globalThis.fetch = async (url, init) => {
  seen.push(String(url));
  if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    return new Response(JSON.stringify({ success: true, hostname: "latseo.com" }));
  }
  const p = pages[url];
  if (!p) throw new TypeError("network");
  assert.equal(init.redirect, "manual");
  return new Response(p.body ?? null, { status: p.status, headers: p.headers });
};
const kv = new Map();
const env = { TURNSTILE_SECRET: "x", RL: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) } };
const ctx = { waitUntil: (p) => p };
const call = (body, origin = "https://latseo.com", ip = "203.0.113.7") => worker.fetch(new Request("https://w.example/", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip },
  body: JSON.stringify(body),
}), env, ctx);

let res = await call({ domain: "demo.lv", "cf-turnstile-response": "t" });
let j = await res.json();
assert.equal(res.status, 200, JSON.stringify(j));
assert.equal(j.final_url, "https://www.demo.lv/");
assert.equal(j.checks.https.status, "pass");
assert.equal(j.checks.sitemap.status, "pass");
assert.equal(j.checks.sitemap.source, "robots.txt");
assert.ok(!seen.includes("https://evil.com/x.xml"), "must not fetch foreign sitemap");

res = await call({ domain: "loop.lv", "cf-turnstile-response": "t" });
assert.equal(res.status, 422);
assert.ok(!seen.includes("https://evil.com/"), "must not follow cross-site redirect");

assert.equal((await call({ domain: "127.0.0.1", "cf-turnstile-response": "t" })).status, 400);
assert.equal((await call({ domain: "demo.lv", "cf-turnstile-response": "t" }, "https://evil.com")).status, 403);
assert.equal((await call({ domain: "demo.lv" }, undefined, "198.51.100.1")).status, 403); // no captcha token

// rate limit: 5 per IP per hour (2 already used above by 203.0.113.7)
for (let i = 0; i < 3; i++) assert.equal((await call({ domain: "demo.lv", "cf-turnstile-response": "t" })).status, 200);
assert.equal((await call({ domain: "demo.lv", "cf-turnstile-response": "t" })).status, 429);
assert.ok([...kv.keys()].every((k) => /^chk:[0-9a-f]{32}$/.test(k)), "IP must be stored hashed only");

console.log("check-worker tests: all passed");
