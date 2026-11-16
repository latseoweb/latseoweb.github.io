# IndexNow (ThinkPad)

`scripts/indexnow.py` paziņo Bing, Yandex, Seznam un Naver (caur api.indexnow.org) par latseo.com
lapām, kas mainījušās kopš pēdējās paziņošanas. ChatGPT meklēšana balstās uz Bing, tāpēc tas palīdz arī tur.

- Mainītās lapas = `index.html` faili, kas atšķiras starp pēdējo paziņoto commit un `main`,
  tikai tās, kas ir sitemap.xml (vai tikko no tā izņemtas). Citas lapas netiek sūtītas.
- Neko nesūta, kamēr GitHub Pages vēl rāda veco versiju; nākamajā reizē mēģina vēlreiz.
- Atslēga: `97de27636abf50b8586beebde010f6ab.txt` repozitorija saknē (nedzēst, nepārsaukt).
- Pirmajā palaišanā (nav state faila) tiek nosūtītas visas sitemap lapas vienu reizi.

## Uz servera
- Klons: `/opt/latseo-indexnow/site` (tikai lasīšanai, izmanto autobloga deploy key)
- Pēdējais paziņotais commit: `/var/lib/latseo-indexnow/last-commit`
- `systemctl list-timers latseo-indexnow.timer` · `journalctl -u latseo-indexnow -n 30`

## Ar roku
```
python3 scripts/indexnow.py --since HEAD~3 --dry-run   # ko sūtītu
python3 scripts/indexnow.py --all                      # visas sitemap lapas
```
