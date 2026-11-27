# LatSEO autoblogs v2 (ThinkPad)

Pirmdienās un ceturtdienās ap 09:00 (Rīgas laiks) `scripts/autoblog.py` paņem pirmo nepublicēto
ierakstu no `scripts/autoblog-queue.json`. Claude Sonnet 5.5 uzraksta rakstu pēc `_src/BLOG-BRIEF.md`
noteikumiem, bet skaitļus drīkst ņemt tikai no DATI bloka (sk. „Dati”). Pirms publicēšanas skripts
pārbauda saites, formātu un faktus. Ja raksts trīs reizes neiztur pārbaudes, nekas netiek publicēts,
kļūdas ir žurnālā un serviss beidzas ar kļūdu (`systemctl --failed` to rāda). Ja pārbaude iziet, skripts
pieliek rakstu saistīto rakstu „Citi raksti” blokā, uzzīmē vāku, palaiž `build.py` un nosūta uz GitHub.

## Kas mainīts v2 (2026-11-27)
- Taimeris: `Mon,Thu 09:00` (bija P, T, Pk).
- Tēmas: jauna rinda `scripts/autoblog-queue.json` (slug, title, category, angle, data_keys, facts, links, review).
  `autoblog-topics.json` (v1) vairs neizmanto. Skripts pats tēmas neizdomā. Kad rinda beidzas, nekas netiek
  publicēts, žurnālā ir „rinda tukša”.
- Faktu pārbaude: katrs skaitlis title, description, h1, h2, tekstā un tabulās jābūt no ieraksta DATI
  (data_keys + facts + izlase/periods). Izņēmumi: LatSEO cenas (nolasa no cenu lapas un `build.py`),
  skaitļi 0–10, gadi 2024–2027, HTTP kodi 301/404. Aizliegts: „pieredze rāda”, „no pieredzes zinu”, klientu un projektu
  nosaukumi/domēni (`PROJECTS` failā `build.py`), „grandem”, „nozarē kopumā”, „Latvijas uzņēmumi”/„Latvijā” vienā
  teikumā ar procentiem. Ja CRM dati citēti, jābūt nosauktai izlasei un periodam; PageSpeed jāsauc par laboratorijas mērījumu.
- Pārskatīšana: ierakstam ar `"review": true` (vai `AUTOBLOG_REVIEW=1`) raksts netiek publicēts. Tas aiziet uz zaru
  `autoblog-review/<slug>`, žurnālā ir zara nosaukums un viss teksts. Nākamajā reizē šo ierakstu izlaiž un ņem nākamo.
  Publicēt var divējādi: (1) apvienot zaru ar main; (2) rindā iestatīt `"review": false`. Tad nākamā palaišana paņem
  rakstu no zara (ar cilvēka labojumiem), vēlreiz pārbauda un publicē ar tās dienas datumu. Ja zaru izdzēš, nepublicējot,
  un review paliek true, raksts tiks uzrakstīts no jauna.
- Katram rakstam tiek saglabāts DATI bloks, no kura tas rakstīts: `scripts/autoblog-data/used/<slug>.json`.

## Dati
- Galvenais avots: `/var/lib/latseo/blog-stats.json` (nakts taimeris 01:30, CRM agregāti; `AUTOBLOG_STATS`).
- Ja faila nav: repo kopija `scripts/autoblog-data/blog-stats.json` (CRM agregāti 2026-11-27).
- `google_pozicija` (nepārbaudīts) un `aukstie_epasti` modelim netiek doti nekad. Ja dati vecāki par 7 dienām,
  žurnālā ir brīdinājums.

## Uz servera
- Kods un klons: `/opt/latseo-autoblog/site` (tikai šim servisam, lokālas izmaiņas tiek dzēstas)
- venv: `/opt/latseo-autoblog/.venv` (anthropic, pillow); vāku fonti: `/opt/latseo-autoblog/fonts`
- GitHub deploy key: `/opt/latseo-autoblog/deploy_key` (repo → Settings → Deploy keys, ar write piekļuvi; to pašu lieto review zariem)
- API atslēga: `/etc/latseo-autoblog.env` → `ANTHROPIC_API_KEY=...` (chmod 600)

Pēc v2 apvienošanas ar main unit faili jāpārinstalē (taimerim mainīts laiks, servisam pievienots `AUTOBLOG_STATS`):
```
sudo install -m 644 /opt/latseo-autoblog/site/scripts/autoblog-deploy/latseo-autoblog.service /etc/systemd/system/
sudo install -m 644 /opt/latseo-autoblog/site/scripts/autoblog-deploy/latseo-autoblog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart latseo-autoblog.timer
systemctl list-timers latseo-autoblog.timer     # jābūt nākamajai P vai C 09:00
```

## Komandas
```
systemctl list-timers latseo-autoblog.timer     # nākamā palaišana
systemctl start latseo-autoblog.service         # rakstu tagad (review ieraksts → zars)
journalctl -u latseo-autoblog -n 200            # žurnāls (pārbaudes kļūdas, review zars un teksts)
systemctl disable --now latseo-autoblog.timer   # apturēt
set -a; . /etc/latseo-autoblog.env; set +a; cd /opt/latseo-autoblog/site && ../.venv/bin/python scripts/autoblog.py --dry-run   # tikai izdrukāt rakstu un pārbaudi
```

Tēmas maina, rediģējot `scripts/autoblog-queue.json` repozitorijā: secība = publicēšanas secība.
Lokāli pirms izmaiņām vienmēr `git pull`, jo serveris P un C pievieno commit.

## Testi (bez API atslēgas)
```
python3 scripts/tests/test_autoblog.py
```
