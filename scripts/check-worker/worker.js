/**
 * LatSEO "check your page in 10 seconds" (Cloudflare Worker on *.workers.dev).
 *
 * Browser (latseo.com/tehniskais-seo/) -> POST {domain, cf-turnstile-response} -> this Worker
 * -> GET https://<domain>/ (+ /sitemap.xml, + /robots.txt if needed) -> JSON with 6 measurements.
 *
 * Secrets (Settings -> Variables and Secrets, type "Secret"):
 *   TURNSTILE_SECRET   Turnstile widget secret key (same widget as the contact form)
 * Optional plain variables:
 *   ALLOWED_ORIGINS    comma list, default "https://latseo.com,https://www.latseo.com"
 *   ALLOWED_HOSTNAMES  comma list of hostnames Turnstile may report, default "latseo.com,www.latseo.com"
 * KV binding (rate limit): RL  — key is a SHA-256 hash of the IP, value = count, TTL 1 hour.
 *
 * SSRF safety: only a strictly validated public hostname is accepted (no IPs, no ports, no localhost /
 * internal suffixes), only GET of "/", "/sitemap.xml", "/robots.txt" and a robots.txt Sitemap URL on the
 * same site, redirects followed manually (max 3, only within the same site: same host or www. variant),
 * 6 s timeout per request, at most 1.5 MB of HTML read. Workers cannot reach private networks anyway.
 * Nothing is logged; the visitor IP is used only for Turnstile and the hashed rate-limit key.
 */

const DEFAULT_ORIGINS = "https://latseo.com,https://www.latseo.com";
const DEFAULT_HOSTNAMES = "latseo.com,www.latseo.com";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RATE_LIMIT = 5;          // checks per IP ...
const RATE_WINDOW = 3600;      // ... per hour
const TIMEOUT_MS = 6000;       // per outgoing request
const MAX_HTML = 1500000;      // bytes of homepage read
const MAX_SMALL = 262144;      // bytes of sitemap / robots.txt read
const MAX_HOPS = 3;            // redirects
const UA = "Mozilla/5.0 (compatible; LatSEO-Check/1.0; +https://latseo.com/tehniskais-seo/)";

// suffixes that are never public websites
const BLOCKED_SUFFIX = ["localhost", "local", "localdomain", "internal", "intranet", "lan", "home", "corp",
  "private", "arpa", "test", "example", "invalid", "onion", "alt", "home.arpa", "workers.dev"];
const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

const list = (v, d) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);

/** Returns the normalised hostname or null. Input must be a bare hostname (punycode for IDN). */
function validateHost(input) {
  if (typeof input !== "string") return null;
  let h = input.trim().toLowerCase();
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (!h || h.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;          // no scheme, path, port, user@, brackets, spaces
  const labels = h.split(".");
  if (labels.length < 2) return null;                   // "localhost", "intranet"
  if (!labels.every((l) => LABEL_RE.test(l))) return null;
  if (!TLD_RE.test(labels[labels.length - 1])) return null; // all-digit TLD => IPv4 literal, rejected
  if (labels.some((l) => /^xn--/.test(l) && l.length < 5)) return null;
  for (const s of BLOCKED_SUFFIX) if (h === s || h.endsWith("." + s)) return null;
  return h;
}

const bare = (h) => (h.startsWith("www.") ? h.slice(4) : h);
/** Same site = same host or its www./non-www. twin. */
const sameSite = (a, b) => bare(a) === bare(b);

/** Validates a URL we are about to fetch: http(s), default port, no credentials, same site as `site`. */
function safeUrl(raw, base, site) {
  let u;
  try { u = new URL(raw, base); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  const h = validateHost(u.hostname);
  if (!h || !sameSite(h, site)) return null;
  u.hash = "";
  return u;
}

async function readCapped(res, max) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  const buf = new Uint8Array(Math.min(size, max));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, buf.length - off));
    buf.set(part, off);
    off += part.byteLength;
    if (off >= buf.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/** GET with manual, same-site redirects. Returns {url, status, text} or {error}. */
async function get(startUrl, site, max) {
  let url = safeUrl(startUrl, undefined, site);
  if (!url) return { error: "url" };
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        method: "GET", redirect: "manual", signal: ctl.signal,
        headers: { "User-Agent": UA, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("Location")) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        const next = safeUrl(res.headers.get("Location"), url, site);
        if (!next) return { error: "redirect", url: url.toString(), status: res.status };
        url = next;
        continue;
      }
      const text = await readCapped(res, max);
      return { url: url.toString(), status: res.status, text, type: res.headers.get("Content-Type") || "" };
    } catch (e) {
      return { error: e && e.name === "AbortError" ? "timeout" : "fetch", url: url.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: "hops", url: url.toString() };
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const clean = (s) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const len = (s) => [...s].length;
const cut = (s, n) => (len(s) > n ? [...s].slice(0, n).join("") + "…" : s);

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  const sp = tag.search(/\s/);
  re.lastIndex = sp > 0 ? sp : tag.length;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

/** The four on-page measurements from raw HTML. */
function analyse(html) {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");

  // JSON-LD (before scripts are stripped)
  const types = new Set();
  let blocks = 0, valid = 0;
  for (const m of noComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const a = attrs("<script " + m[1]);
    if ((a.type || "").trim().toLowerCase() !== "application/ld+json") continue;
    blocks++;
    try {
      const j = JSON.parse(m[2].trim());
      valid++;
      const walk = (n, d) => {
        if (!n || typeof n !== "object" || d > 4 || types.size >= 8) return;
        if (Array.isArray(n)) return n.forEach((x) => walk(x, d + 1));
        [].concat(n["@type"] || []).forEach((t) => typeof t === "string" && types.size < 8 && types.add(t.slice(0, 60)));
        if (n["@graph"]) walk(n["@graph"], d + 1);
      };
      walk(j, 0);
    } catch { /* invalid block */ }
  }

  const body = noComments.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ");

  const titles = [...body.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map((m) => clean(m[1]));
  const title = titles[0] ?? null;

  let desc = null, descCount = 0;
  for (const m of body.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.name || "").toLowerCase() === "description") {
      descCount++;
      if (desc === null) desc = decode(a.content || "").replace(/\s+/g, " ").trim();
    }
  }

  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map((m) => clean(m[1]));
  const h1Open = (body.match(/<h1[\s>]/gi) || []).length;
  const h1Count = Math.max(h1s.length, h1Open);

  return {
    h1: { status: h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn", count: h1Count, text: h1s[0] ? cut(h1s[0], 120) : null },
    description: desc ? { status: descCount > 1 ? "warn" : "pass", length: len(desc), count: descCount, text: cut(desc, 300) }
      : { status: "fail", length: 0, count: descCount, text: null },
    title: title ? { status: titles.length > 1 ? "warn" : "pass", length: len(title), count: titles.length, text: cut(title, 200) }
      : { status: "fail", length: 0, count: titles.length, text: null },
    schema: { status: valid ? "pass" : blocks ? "warn" : "fail", blocks, valid, types: [...types] },
  };
}

const isSitemap = (r) => r && !r.error && r.status === 200 && /<(urlset|sitemapindex)\b/i.test(r.text.slice(0, 20000));

async function checkSitemap(origin, site) {
  const direct = await get(origin + "/sitemap.xml", site, MAX_SMALL);
  if (isSitemap(direct)) return { status: "pass", url: direct.url, source: "sitemap.xml" };
  const robots = await get(origin + "/robots.txt", site, MAX_SMALL);
  if (robots && !robots.error && robots.status === 200) {
    const lines = robots.text.split(/\r?\n/).map((l) => l.match(/^\s*sitemap\s*:\s*(\S+)/i)).filter(Boolean);
    for (const m of lines.slice(0, 3)) {
      const u = safeUrl(m[1], robots.url, site);
      if (!u) continue;
      const r = await get(u.toString(), site, MAX_SMALL);
      if (isSitemap(r)) return { status: "pass", url: r.url, source: "robots.txt" };
    }
  }
  return { status: "fail", url: null, http: direct.status || null, source: null };
}

async function runChecks(host) {
  const t0 = Date.now();
  let page = await get("https://" + host + "/", host, MAX_HTML);
  if (page.error || page.status >= 400) {
    const plain = await get("http://" + host + "/", host, MAX_HTML);
    if (!plain.error && plain.status < 400) page = plain;
  }
  if (page.error) return { ok: false, error: "unreachable", detail: page.error };
  if (page.status >= 400) return { ok: false, error: "status", http: page.status };
  const final = new URL(page.url);
  const https = { status: final.protocol === "https:" ? "pass" : "fail", final_url: page.url };

  const checks = analyse(page.text);
  const sitemap = await checkSitemap(final.origin, host);
  return {
    ok: true, host, final_url: page.url, http: page.status,
    truncated: page.text.length >= MAX_HTML,
    checks: { h1: checks.h1, description: checks.description, title: checks.title, https, sitemap, schema: checks.schema },
    ms: Date.now() - t0,
  };
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origins = list(env.ALLOWED_ORIGINS, DEFAULT_ORIGINS);
    const origin = request.headers.get("Origin") || "";
    const allowed = origins.includes(origin);
    const cors = allowed ? {
      "Access-Control-Allow-Origin": origin, "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400",
    } : {};

    if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== "POST") return reply(405, { ok: false, error: "method" }, cors);
    if (!allowed) return reply(403, { ok: false, error: "origin" }, cors);
    const referer = request.headers.get("Referer") || "";
    if (referer && !origins.some((o) => referer === o || referer.startsWith(o + "/"))) {
      return reply(403, { ok: false, error: "referer" }, cors);
    }
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
      return reply(415, { ok: false, error: "type" }, cors);
    }
    if (!env.TURNSTILE_SECRET) return reply(500, { ok: false, error: "config" }, cors);

    const raw = await request.text();
    if (raw.length > 4096) return reply(413, { ok: false, error: "size" }, cors);
    let data;
    try { data = JSON.parse(raw); } catch { return reply(400, { ok: false, error: "json" }, cors); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, { ok: false, error: "json" }, cors);

    const host = validateHost(data.domain);
    if (!host) return reply(400, { ok: false, error: "host" }, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "";

    // Rate limit: hashed IP, TTL 1 h, nothing else stored
    if (env.RL && ip) {
      const key = "chk:" + (await sha256(ip));
      const count = parseInt((await env.RL.get(key)) || "0", 10);
      if (count >= RATE_LIMIT) return reply(429, { ok: false, error: "rate" }, cors);
      ctx.waitUntil(env.RL.put(key, String(count + 1), { expirationTtl: RATE_WINDOW }));
    }

    // Turnstile
    const token = typeof data["cf-turnstile-response"] === "string" ? data["cf-turnstile-response"] : "";
    if (!token || token.length > 2048) return reply(403, { ok: false, error: "captcha" }, cors);
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    let check;
    try {
      check = await (await fetch(SITEVERIFY, { method: "POST", body: form })).json();
    } catch {
      return reply(502, { ok: false, error: "captcha-unavailable" }, cors);
    }
    if (!check.success || !list(env.ALLOWED_HOSTNAMES, DEFAULT_HOSTNAMES).includes(check.hostname)) {
      return reply(403, { ok: false, error: "captcha" }, cors);
    }

    try {
      const out = await runChecks(host);
      return reply(out.ok ? 200 : 422, out, cors);
    } catch {
      return reply(502, { ok: false, error: "check" }, cors);
    }
  },

  // exposed for unit tests only (scripts/check-worker/test.mjs); not reachable over HTTP
  _test: { validateHost, safeUrl, sameSite, analyse },
};
