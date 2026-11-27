# Lapas ātrā pārbaude (Cloudflare Worker)

`/tehniskais-seo/` sadaļa "Pārbaudiet savu lapu 10 sekundēs" → `js/ix-check.js` → šis Worker
(`https://latseo-check.adrians-79c.workers.dev/`) → apmeklētāja domēna sākumlapa, `/sitemap.xml`, `/robots.txt`.

Atgriež JSON ar 6 mērījumiem: H1 (skaits, teksts), meta description (garums), `<title>` (garums),
HTTPS (gala adrese), sitemap.xml (atrasts tieši vai caur robots.txt), schema.org JSON-LD (bloki, @type).

## Drošība
- Origin/Referer tikai `https://latseo.com` un `https://www.latseo.com`.
- Cloudflare Turnstile — tas pats widget/site key kā kontaktformai (`js/main.js`), secret `TURNSTILE_SECRET`.
- Rate limit 5 pārbaudes stundā no IP (KV `RL`). Atslēga = `chk:` + SHA-256(IP), TTL 1 h. IP netiek žurnalēts.
- SSRF: tikai stingri validēts publisks hostname (bez IP, porta, localhost, .local/.internal/.lan u.c.),
  tikai GET `/`, `/sitemap.xml`, `/robots.txt` un robots.txt Sitemap adrese tajā pašā vietnē;
  pāradresācijas ar roku, maks. 3, tikai tas pats hosts vai tā www. variants; 6 s taimauts katram
  pieprasījumam; HTML maks. 1,5 MB, sitemap/robots maks. 256 KB. Workers no Cloudflare malas nevar
  sasniegt privātos tīklus.
- Garuma sliekšņi (piem. "title X–Y zīmes") apzināti netiek vērtēti — rāda tikai izmērīto garumu.
  Ja Adrians grib sliekšņus, tos pievieno `js/ix-check.js`.

## Izvietošana (Adrians / tehniskais palīgs)
Ar paneli (kā formas Worker):
1. Cloudflare → Workers & Pages → Create → Worker, nosaukums **`latseo-check`** → Deploy → Edit code →
   ielīmē `worker.js` → Deploy.
2. Settings → Variables and Secrets: `TURNSTILE_SECRET` (Secret) — tā pati vērtība kā formas Worker.
3. Settings → Bindings → KV namespace, mainīgais `RL` (var izmantot formas Worker namespace).
4. Turnstile widget hostnames jau ir `latseo.com`, `www.latseo.com` — nekas nav jāmaina.
5. Pārbaude: atver https://latseo.com/tehniskais-seo/, ievadi domēnu. Kamēr Worker nav izvietots,
   lapa rāda draudzīgu paziņojumu ar saiti uz bezmaksas video auditu.

Ar wrangler (no šīs mapes): `wrangler kv namespace create RL` → ieraksti id `wrangler.toml` →
`wrangler secret put TURNSTILE_SECRET` → `wrangler deploy`.

Ja Worker adrese atšķiras, nomaini `ENDPOINT` `js/ix-check.js` augšā.

## Testi
`node scripts/check-worker/test.mjs` — hostname validācija, pāradresācijas, HTML analīze, handler ar
mock fetch (bez tīkla), rate limit.
