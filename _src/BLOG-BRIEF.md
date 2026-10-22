# Bloga rakstu pārrakstīšanas instrukcija (LatSEO)

## Mērķis
Pārrakstīt esošos bloga rakstus (`/blogs/<slug>/index.html`) tīros avota failos `_src/blog/<slug>.html`, ko ģenerē `scripts/build.py`.
Raksts paliek autora (Adrians Stankevičs) personīgā pieredzē balstīts, bet:
- uzruna lasītājam VIENMĒR „Jūs/Jūsu/Jums” ar lielo burtu (nekad „tu/tavs/tev”);
- autors runā pirmajā personā vienskaitlī („es”), NEKAD „mēs”, „mūsu komanda”, „mana komanda” (viena persona);
- izņemt šablonfrāzes: „Bet ar to viss nebeidzas”, „Lūk, ko es no tā iemācījos”, „Un tieši tāpēc”, „rezultāti runā paši par sevi”, „Iedomājieties”, „Nav noslēpums”, izsaukuma zīmes, retoriskus jautājumus virknē, emocijzīmes;
- izņemt klišejas („revolucionārs”, „unikāls”, „vadošais”, „dominēt”, „maksimāls”, „neticami”, „pārdošanas mašīna” u. c.);
- teikumi 10–22 vārdi, rindkopās 2–4 teikumi; pareiza latviešu pareizrakstība, pēdiņas „…”, domuzīme ar atstarpēm ( — ).

## FAKTI (drīkst lietot TIKAI šos un to, kas jau ir oriģinālajā rakstā)
- Adrians Stankevičs, 2 gadu pieredze SEO un mājaslapu izstrādē (strādājot darbā, nevis kā uzņēmumam). LatSEO = Baltic SEO, SIA. Bratus oficiālais IT partneris.
- Izstrādāja no nulles: tehnologijuakademija.lv, lazergriezeji.lv, cncfrezes.lv, 3dpakalpojumi.lv, bratus.lv, cncpakalpojumi.lv, ploteris.lv; landing lapa maropro.lv. SEO klienti: autoestetika.lv, relive.lv, e-car.lv.
- Google Search Console klikšķi 90 d. (24.07.–21.10.2026) pret iepriekšējām 90 d.: tehnologijuakademija.lv 0 → 212, lazergriezeji.lv 1 → 44, cncfrezes.lv 2 → 42, 3dpakalpojumi.lv 0 → 10, cncpakalpojumi.lv 0 → 9.
- Cenas (bez PVN): vizītkartes lapa no 449 €, uzņēmuma mājaslapa no 799 €, e-veikals no 1 299 €; SEO audits no 150 €; ikmēneša SEO no 300 €/mēn.; video audits bez maksas 24 h laikā; hostings 10 €/mēn. (e-veikals 15 €/mēn.), .lv domēns 20 €/gadā, labojumi 25 €/h.
- Iebūvētais SEO: tehniski tīrs kods un ātra ielāde (Core Web Vitals), mobilā versija, saprotama URL struktūra, pareiza virsrakstu hierarhija, SSL.
- Rīki: Google Search Console (atver katru rītu), Google Keyword Planner, Screaming Frog, Ahrefs (toolbar).
- Personīgā pieredze (no oriģinālajiem rakstiem): URL maiņa → Google reklāmas 4 dienas veda uz 404 lapu, zaudēts reklāmas budžets; lazergriezeji.lv mazāk nekā mēneša laikā sāka saņemt organiskos apmeklētājus un zvanus; pirmais klients bija uzņēmums, kurā autors iepriekš strādāja; pēc AI Overview ieviešanas sāka optimizēt arī GEO.
- LatSEO paša audits (2026-10): sitemap bija 10 no 40 lapām; 6 iekšējās saites uz 404; vaicājumam „seo pakalpojumi” 1 674 rādījumi un 0 klikšķu 90 dienās.
- NEDRĪKST izdomāt: klientu atsauksmes, citātus, statistiku bez avota (piem., „46 % meklējumu” — izņemt, ja nav avota oriģinālā; „93 %” — izņemt), rezultātus, garantijas, termiņus, sertifikātus, „komandu”.
- Vispārīgus, plaši zināmus faktus par Google (piem., kas ir indeksācija, ka Google Business Profile ir bezmaksas) drīkst skaidrot, bet bez skaitļiem, kurus nevar pārbaudīt.

## Faila formāts (`_src/blog/<slug>.html`)
```
<!--meta
{
  "path": "/blogs/<slug>/",
  "en": "/en/blogs/<en-slug>/",            // ja ir EN pāris (sk. tabulu), citādi izlaist
  "title": "<SEO title līdz ~60 zīmēm> | LatSEO",
  "description": "<meta description 140–160 zīmes, ar Jūs formu>",
  "h1": "<virsraksts, var atšķirties no title>",
  "category": "Mājaslapu izstrāde" | "SEO pamati" | "Tehniskais SEO" | "Lokālais SEO" | "SEO cenas",
  "date": "YYYY-MM-DD",                       // oriģinālais publicēšanas datums (sk. tabulu)
  "modified": "2026-10-23",
  "cta": "web" | "audit",                     // "web" rakstiem par mājaslapām, citādi "audit"
  "related_paths": ["/blogs/...", "/blogs/..."]   // 3 tematiski tuvākie raksti
}
-->
<p class="lead">2–3 teikumu ievads ar tiešu atbildi uz virsraksta jautājumu (40–60 vārdi, citējams).</p>
<h2 id="kebab-id">…</h2>
<p>…</p>
...
```
- Tikai tīrs HTML: `<p>`, `<h2 id>`, `<h3>`, `<ul>/<ol>/<li>`, `<strong>`, `<a>`, `<blockquote>`, `<div class="note">`, `<div class="table-wrap"><table class="table">…</table></div>`. Bez `style=` atribūtiem, bez attēliem (vāku ģenerē builds), bez autora bloka (ģenerē builds), bez „Saistītie raksti” bloka.
- Katram `<h2>` obligāts unikāls `id` (latīņu burti bez garumzīmēm, defises).
- 3–5 iekšējās saites tekstā uz atbilstošām lapām: `/majaslapas-izstrade/`, `/majaslapas-izstrade/#kalkulators`, `/seo-pakalpojumi-riga/`, `/tehniskais-seo/`, `/lokalais-seo/`, `/satura-strategija/`, `/saisu-veidosana/`, `/pakalpojumi-un-cenas/`, `/bezmaksas-audits/`, `/projekti/`, `/blogs/cik-maksa-majaslapa/`, citi raksti.
- Beigās viena rindkopa ar aicinājumu (bez izsaukuma zīmēm).
- Ja rakstā ir BUJ, lieto `<div class="faq"><details data-faq><summary>Jautājums?</summary><div><p>Atbilde.</p></div></details>…</div>` (builds no tā ģenerē FAQPage shēmu).
- Garums: 700–1 200 vārdi. Saglabāt oriģinālā raksta galveno tēmu un stāstu.

## Rakstu tabula
| slug | datums | EN pāris |
|---|---|---|
| lokalais-seo-kas-tas-ir | 2026-07-26 | /en/blogs/local-seo-what-is-it/ |
| google-business-profile-ka-izveidot | 2026-07-27 | /en/blogs/google-business-profile-how-to-create/ |
| mits-seo-ir-tikai-atslegvardi-kapec-sis-uzskats-ir-bistam | 2026-08-03 | /en/blogs/why-seo-is-not-just-about-keywords-lessons-from-my-first-client-project/ |
| 7-seo-pamati-ko-katram-uznemejam-butu-jazina-pirms-majaslap | 2026-08-04 | /en/blogs/the-biggest-seo-mistake-i-see-clients-make-before-building-a-website/ |
| ko-es-iemacijos-par-seo-pamatiem-no-nulles-lidz-pirmajiem | 2026-08-05 | /en/blogs/my-first-seo-mistakes-lessons-from-the-trenches/ |
| aiz-kadra-5-lietas-ko-parbaudu-katra-seo-audita-video-un-k | 2026-08-06 | /en/blogs/what-my-video-seo-audits-reveal-the-first-mistake-i-always-spot/ |
| ka-notiek-google-meklesana-patiesiba-indeksacija-rangi-un | 2026-08-08 | /en/blogs/google-indexing-delays-lessons-from-a-seasons-biggest-miss/ |
| kas-ietekme-seo-pakalpojumu-cenu-latvija-5-faktori-ko-lie | 2026-09-09 | /en/blogs/why-ai-visibility-is-changing-seo-pricing-in-latvia-and-what-it-means-for-you/ |

`ka-seo-mainijis-manu-biznesa-domasanu-5-pamatprincipi-ko` (2026-08-02) ir gandrīz tas pats stāsts — tā unikālo saturu (GSC rīta rituāls, AI Overview / GEO, SEO un kvalitatīvi pieteikumi) iekļaut rakstā `ko-es-iemacijos-par-seo-pamatiem-no-nulles-lidz-pirmajiem`. Pašam `ka-seo-mainijis…` failu NEVEIDOT (builds izveidos pāradresāciju).

## Īpašas piezīmes
- `lokalais-seo-kas-tas-ir` Google rāda 5. vietā vaicājumam „lokālais seo” — saglabāt struktūru, H2 tēmas un garumu; mainīt tonis uz „Jūs”, izņemt nepamatoto „46 %” statistiku un šablonfrāzes. Title saglabāt tuvu oriģinālam: „Lokālais SEO: kas tas ir un vai Jūsu biznesam to vajag? | LatSEO”.
- `kas-ietekme-seo-pakalpojumu-cenu-latvija-5-faktori-ko-lie` — pārveidot par rakstu „Cik maksā SEO Latvijā 2026. gadā”: ar LatSEO cenām tabulā, faktoriem (mājaslapas lielums, nišas konkurence, darbu apjoms) un sadaļu par AI meklēšanu no oriģināla. Kategorija „SEO cenas”.
- `7-seo-pamati…` — tēma „Kāpēc SEO jāsāk jau pirms mājaslapas izstrādes”; cta "web"; saite uz `/majaslapas-izstrade/`.
- Oriģinālo rakstu teksts: `blogs/<slug>/index.html` (lasīt tikai `<article>`/raksta saturu).
