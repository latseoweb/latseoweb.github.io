# English translation brief (LatSEO)

Translate the Latvian source files into English source files for `scripts/build.py`.

## Rules
- Plain, professional international English. Address the reader as "you". The author is ONE person and writes "I" (never "we", "our team").
- Translate meaning faithfully. Do NOT add facts, numbers, guarantees, testimonials or claims that are not in the Latvian source. Do not drop facts either.
- Prices: "from €449", "€300/month", "excl. VAT". Dates: "24 Jul–21 Oct 2026".
- Keep Latvian place/brand names (Rīga → "Riga", Latvija → "Latvia").
- Search intent: English pages target people searching in English in Latvia, e.g. "website development Riga", "web design Latvia", "SEO services Riga", "SEO agency Latvia", "SEO audit", "local SEO Latvia", "website cost Latvia". Use those phrases naturally in title / H1 / first paragraph — no keyword stuffing.
- Title ≤ 60 characters ending with " | LatSEO"; description 140–160 characters.
- Keep the exact HTML structure, classes and section order of the source. Keep all `{{tokens}}` unchanged EXCEPT form tokens (see below).
- Internal links: change `/x/` to the English equivalent `/en/x/` (same slug after `/en/`), e.g. `/majaslapas-izstrade/` → `/en/majaslapas-izstrade/`, `/blogs/cik-maksa-majaslapa/` → `/en/blogs/how-much-does-a-website-cost/`. Blog links: use the EN slug from the table below. Links to `/bezmaksas-audits/` (Latvian-only page) → change to `/en/kontakti/` and say "request a free video audit".
- Anchor `#kalkulators` becomes `#calculator` everywhere (and the calculator section id must be `calculator`; the form section id `pieteikties` becomes `get-quote`, and anchors `#pieteikties` → `#get-quote`).
- Breadcrumb `crumbs` in meta: use English names and `/en/...` paths, first crumb `["/en/", "Home"]`.
- Meta: add `"lang": "en"` and `"lv": "<the Latvian path>"`; set `"path"` to the English path. Remove the `"en"` key. Translate `"schema"` names/descriptions into English, keep prices; replace `"https://latseo.com/x/"` URLs with `"https://latseo.com/en/x/"`.
- Form tokens `{{form:prefix|Source|Need|Button}}`: translate Source/Button; the 3rd field must be one of exactly:
  "New website", "Online store", "SEO for an existing website", "Free video audit", "Full SEO audit", "Local SEO / Google Business Profile", "Other question".
- Hand-written forms (website development page): translate labels; `data-redirect="/en/thank-you/"`; select options in English.

## Page mapping (LV source → EN file → EN path)
| LV source | EN file | EN path |
|---|---|---|
| _src/pages/home.html | _src/en/pages/home.html | /en/ |
| _src/pages/majaslapas-izstrade.html | _src/en/pages/majaslapas-izstrade.html | /en/majaslapas-izstrade/ |
| _src/pages/seo-pakalpojumi-riga.html | _src/en/pages/seo-pakalpojumi-riga.html | /en/seo-pakalpojumi-riga/ |
| _src/pages/tehniskais-seo.html | _src/en/pages/tehniskais-seo.html | /en/tehniskais-seo/ |
| _src/pages/lokalais-seo.html | _src/en/pages/lokalais-seo.html | /en/lokalais-seo/ |
| _src/pages/satura-strategija.html | _src/en/pages/satura-strategija.html | /en/satura-strategija/ |
| _src/pages/saisu-veidosana.html | _src/en/pages/saisu-veidosana.html | /en/saisu-veidosana/ |
| _src/pages/pakalpojumi-un-cenas.html | _src/en/pages/pakalpojumi-un-cenas.html | /en/pakalpojumi-un-cenas/ |
| _src/pages/projekti.html | _src/en/pages/projekti.html | /en/projekti/ |
| _src/pages/kontakti.html | _src/en/pages/kontakti.html | /en/kontakti/ |
| _src/pages/par-mani.html | _src/en/pages/par-mani.html | /en/par-mani/ |
| _src/pages/paldies.html | _src/en/pages/thank-you.html | /en/thank-you/ (robots noindex) |
(Do NOT translate bezmaksas-audits.)

## Blog mapping (LV source → EN file/path)
| LV _src/blog/… | EN path (file = _src/en/blog/<slug>.html) |
|---|---|
| cik-maksa-majaslapa | /en/blogs/how-much-does-a-website-cost/ |
| lokalais-seo-kas-tas-ir | /en/blogs/local-seo-what-is-it/ |
| google-business-profile-ka-izveidot | /en/blogs/google-business-profile-how-to-create/ |
| mits-seo-ir-tikai-atslegvardi-kapec-sis-uzskats-ir-bistam | /en/blogs/why-seo-is-not-just-about-keywords-lessons-from-my-first-client-project/ |
| 7-seo-pamati-ko-katram-uznemejam-butu-jazina-pirms-majaslap | /en/blogs/the-biggest-seo-mistake-i-see-clients-make-before-building-a-website/ |
| ko-es-iemacijos-par-seo-pamatiem-no-nulles-lidz-pirmajiem | /en/blogs/my-first-seo-mistakes-lessons-from-the-trenches/ |
| aiz-kadra-5-lietas-ko-parbaudu-katra-seo-audita-video-un-k | /en/blogs/what-my-video-seo-audits-reveal-the-first-mistake-i-always-spot/ |
| ka-notiek-google-meklesana-patiesiba-indeksacija-rangi-un | /en/blogs/google-indexing-delays-lessons-from-a-seasons-biggest-miss/ |
| kas-ietekme-seo-pakalpojumu-cenu-latvija-5-faktori-ko-lie | /en/blogs/why-ai-visibility-is-changing-seo-pricing-in-latvia-and-what-it-means-for-you/ |

Blog meta: `"lang": "en"`, `"lv": "/blogs/<lv-slug>/"`, `"path"`: EN path, translated `title`, `description`, `h1`, `category` (Website development / SEO basics / Technical SEO / Local SEO / SEO pricing), keep `date`, `modified`, `cta`; `related_paths` mapped to EN paths. h2 ids in English kebab-case.
