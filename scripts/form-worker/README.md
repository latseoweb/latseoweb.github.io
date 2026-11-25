# Kontaktformas vārteja (Cloudflare Worker)

latseo.com forma → `worker.js` (Cloudflare Worker, *.workers.dev) → Make.com webhook.
Make adrese un Turnstile slepenā atslēga ir **tikai** Worker Secrets, nekad repozitorijā vai lapas kodā.

Worker pārbauda: Origin/Referer = latseo.com, Cloudflare Turnstile (siteverify ar IP un hostname),
honeypot `_honey` (aizpildīts → atbild "ok", bet neko nesūta), lauku garumus un e-pasta formātu,
pēc izvēles 5 pieteikumi stundā no vienas IP (KV saite `RL`). Make saņem tikai zināmos laukus.

## Cloudflare iestatījumi
- Workers & Pages → worker → Settings → Variables and Secrets:
  - `MAKE_WEBHOOK_URL` (Secret), `TURNSTILE_SECRET` (Secret)
  - pēc izvēles `ALLOWED_ORIGINS` (noklusējums `https://latseo.com,https://www.latseo.com`)
- Pēc izvēles KV namespace, piesaistīts kā `RL`.
- Turnstile widget: hostnames `latseo.com`, `www.latseo.com`; site key ir publisks un ir `js/main.js` (`TURNSTILE_SITEKEY`).

## Mainot kodu
Šis fails ir avots. Cloudflare panelī: worker → Edit code → ielīmē `worker.js` → Deploy.
