/**
 * LatSEO contact form gateway (Cloudflare Worker on *.workers.dev).
 *
 * Browser form (latseo.com) -> this Worker -> Make.com webhook.
 * The Make URL and the Turnstile secret live only in Worker secrets, never in the site code.
 *
 * Secrets (Settings -> Variables and Secrets, type "Secret"):
 *   MAKE_WEBHOOK_URL   new Make.com webhook URL
 *   TURNSTILE_SECRET   Turnstile widget secret key
 * Optional plain variables:
 *   ALLOWED_ORIGINS    comma list, default "https://latseo.com,https://www.latseo.com"
 *   ALLOWED_HOSTNAMES  comma list of hostnames Turnstile may report, default "latseo.com,www.latseo.com"
 * Optional KV binding (rate limit per IP): RL
 */

const DEFAULT_ORIGINS = "https://latseo.com,https://www.latseo.com";
const DEFAULT_HOSTNAMES = "latseo.com,www.latseo.com";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY = 20000;              // bytes
const RATE_LIMIT = 5;                // submissions per IP ...
const RATE_WINDOW = 3600;            // ... per hour (needs the RL KV binding)

// field -> max length; anything else in the request is dropped
const FIELDS = {
  name: 100, email: 200, phone: 40, need: 100, website: 300, message: 5000,
  page_source: 200, calc_summary: 3000, _src: 500, _t: 20,
};
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const list = (v, d) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...cors },
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
    if (!env.MAKE_WEBHOOK_URL || !env.TURNSTILE_SECRET) return reply(500, { ok: false, error: "config" }, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { ok: false, error: "size" }, cors);
    let data;
    try { data = JSON.parse(raw); } catch { return reply(400, { ok: false, error: "json" }, cors); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, { ok: false, error: "json" }, cors);

    // Honeypot filled: pretend success, forward nothing
    if (typeof data._honey === "string" && data._honey.trim() !== "") return reply(200, { ok: true }, cors);

    // Validate and keep only known fields
    const out = {};
    for (const [key, max] of Object.entries(FIELDS)) {
      const v = data[key];
      if (v === undefined || v === null || v === "") continue;
      const s = String(v).trim();
      if (s.length > max) return reply(400, { ok: false, error: "field", field: key }, cors);
      out[key] = s;
    }
    if (!out.name) return reply(400, { ok: false, error: "field", field: "name" }, cors);
    if (!out.email || !EMAIL_RE.test(out.email)) return reply(400, { ok: false, error: "field", field: "email" }, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "";

    // Rate limit per IP (only when the RL KV namespace is bound)
    if (env.RL && ip) {
      const key = "ip:" + ip;
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

    // Forward to Make.com
    let res;
    try {
      res = await fetch(env.MAKE_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(out),
      });
    } catch {
      return reply(502, { ok: false, error: "upstream" }, cors);
    }
    if (!res.ok) return reply(502, { ok: false, error: "upstream" }, cors);
    return reply(200, { ok: true }, cors);
  },
};
