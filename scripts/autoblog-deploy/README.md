# LatSEO autoblogs (ThinkPad)

Katru dienu ap 09:00 (Rīgas laiks) `scripts/autoblog.py` paņem nākamo tēmu no
`scripts/autoblog-topics.json`. Claude Sonnet 5.5 uzraksta rakstu pēc `_src/BLOG-BRIEF.md`
noteikumiem. Skripts pārbauda iekšējās saites (tikai uz esošām lapām, vismaz 3), pieliek jauno
rakstu saistīto rakstu „Citi raksti” blokā, uzzīmē vāku, palaiž `build.py` un nosūta uz GitHub.
GitHub Pages publicē pāris minūšu laikā. Ja raksts trīs reizes neiztur pārbaudes, nekas netiek publicēts.

## Uz servera
- Kods un klons: `/opt/latseo-autoblog/site` (tikai šim servisam, lokālas izmaiņas tiek dzēstas)
- venv: `/opt/latseo-autoblog/.venv` (anthropic, pillow); vāku fonti: `/opt/latseo-autoblog/fonts`
- GitHub deploy key: `/opt/latseo-autoblog/deploy_key` (repo → Settings → Deploy keys, ar write piekļuvi)
- API atslēga: `/etc/latseo-autoblog.env` → `ANTHROPIC_API_KEY=...` (chmod 600)

## Komandas
```
systemctl list-timers latseo-autoblog.timer     # nākamā palaišana
systemctl start latseo-autoblog.service         # publicēt rakstu tagad
journalctl -u latseo-autoblog -n 50             # žurnāls
systemctl disable --now latseo-autoblog.timer   # apturēt
```

Tēmas maina, rediģējot `scripts/autoblog-topics.json` repozitorijā: secība = publicēšanas secība.
Kad rinda beidzas, skripts pats paprasa Claude 30 jaunas tēmas.
Lokāli pirms izmaiņām vienmēr `git pull`, jo serveris katru dienu pievieno commit.
