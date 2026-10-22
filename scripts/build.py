#!/usr/bin/env python3
"""LatSEO static site builder (LV + EN).

Sources:
  _src/pages/*.html     Latvian pages          _src/en/pages/*.html  English pages
  _src/blog/*.html      Latvian blog posts     _src/en/blog/*.html   English blog posts
  _src/redirects.json    old path -> new path (meta-refresh + canonical stubs)

Each source file starts with a JSON front-matter block:

    <!--meta
    { "path": "/majaslapas-izstrade/", "title": "...", "description": "...", "en": "/en/..." }
    -->
    ...body HTML (inside <main>)...

Run from the repo root:  python3 scripts/build.py
Blog covers / OG images:  ~/.local/share/claude-seo/.venv/bin/python scripts/make_covers.py
"""
import datetime as dt
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
SITE = "https://latseo.com"
PHONE = "+37124424434"
PHONE_H = "+371 24424434"
EMAIL = "sales@latseo.com"
LINKEDIN = "https://www.linkedin.com/in/adrians-stankevics/"
PHOTO = "/assets/images/adrians-stankevics.webp"
FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
TODAY = dt.date.today().isoformat()
ARROW = '<span class="arrow" aria-hidden="true">→</span>'

ORG = {
    "@type": ["ProfessionalService", "LocalBusiness"],
    "@id": f"{SITE}/#org",
    "name": "LatSEO",
    "legalName": "Baltic SEO, SIA",
    "url": f"{SITE}/",
    "logo": f"{SITE}/assets/images/latseo-logo.png",
    "image": f"{SITE}/assets/images/og-latseo.jpg",
    "description": "Mājaslapu izstrāde ar iebūvētu SEO un SEO pakalpojumi Rīgā.",
    "taxID": "40203749304",
    "vatID": "LV40203749304",
    "telephone": PHONE,
    "email": EMAIL,
    "priceRange": "€€",
    "address": {"@type": "PostalAddress", "streetAddress": "Kārklu iela 4, Odukalns",
                "addressLocality": "Ķekavas novads", "postalCode": "LV-2123", "addressCountry": "LV"},
    "areaServed": [{"@type": "City", "name": "Rīga"}, {"@type": "Country", "name": "Latvija"}],
    "founder": {"@id": f"{SITE}/#adrians"},
    "sameAs": ["https://www.linkedin.com/company/latseo"],
}
PERSON = {
    "@type": "Person", "@id": f"{SITE}/#adrians", "name": "Adrians Stankevičs",
    "jobTitle": "Mājaslapu izstrādātājs un SEO speciālists", "url": f"{SITE}/par-mani/",
    "image": f"{SITE}/assets/images/adrians-stankevics.jpg", "worksFor": {"@id": f"{SITE}/#org"}, "sameAs": [LINKEDIN],
    "description": "Mājaslapu izstrādātājs un SEO speciālists Rīgā, 2 gadu pieredze SEO un mājaslapu izstrādē, Bratus oficiālais IT partneris.",
    "knowsAbout": ["Mājaslapu izstrāde", "SEO", "Tehniskais SEO", "Lokālais SEO", "Google Search Console", "WordPress", "Shopify"],
}
ORG_EN = dict(ORG, description="Website development with built-in SEO, and SEO services in Riga, Latvia.",
              areaServed=[{"@type": "City", "name": "Riga"}, {"@type": "Country", "name": "Latvia"}])
PERSON_EN = dict(PERSON, jobTitle="Web developer and SEO specialist", url=f"{SITE}/en/par-mani/",
                 description="Web developer and SEO specialist in Riga with 2 years of experience in SEO and web development; official IT partner of Bratus.",
                 knowsAbout=["Website development", "SEO", "Technical SEO", "Local SEO", "Google Search Console", "WordPress", "Shopify"])
WEBSITE = {"@type": "WebSite", "@id": f"{SITE}/#website", "url": f"{SITE}/", "name": "LatSEO",
           "inLanguage": ["lv", "en"], "publisher": {"@id": f"{SITE}/#org"}}

# ---------------------------------------------------------------- strings
T = {
    "lv": dict(
        home="/", nav=[
            ("/majaslapas-izstrade/", "Mājaslapu izstrāde"),
            ("SEO pakalpojumi", [("/seo-pakalpojumi-riga/", "SEO pakalpojumi Rīgā"), ("/tehniskais-seo/", "Tehniskais SEO un audits"),
                                 ("/lokalais-seo/", "Lokālais SEO"), ("/satura-strategija/", "Satura stratēģija"),
                                 ("/saisu-veidosana/", "Saišu veidošana")]),
            ("/pakalpojumi-un-cenas/", "Cenas"), ("/projekti/", "Projekti"), ("/blogs/", "Blogs"),
            ("/par-mani/", "Par mani"), ("/kontakti/", "Kontakti")],
        home_label="Sākums", logo_aria="LatSEO — uz sākumlapu", nav_aria="Galvenā navigācija", lang_aria="Valoda",
        cta="Aprēķināt cenu", cta_mobile="Aprēķināt mājaslapas cenu", calc="/majaslapas-izstrade/#kalkulators",
        menu_open="Atvērt izvēlni", mobile_aria="Mobilā navigācija", skip="Pāriet uz saturu", crumbs_aria="Ceļš",
        foot_brand="Mājaslapu izstrāde ar iebūvētu SEO un SEO pakalpojumi esošām mājaslapām. Rīga un visa Latvija.",
        foot_legal="Baltic SEO, SIA · Reģ. nr. 40203749304<br>PVN: LV40203749304<br>Kārklu iela 4, Odukalns, Ķekavas nov., LV-2123",
        foot_cols=[("Mājaslapas", [("/majaslapas-izstrade/", "Mājaslapu izstrāde"), ("/majaslapas-izstrade/#kalkulators", "Cenu kalkulators"),
                                   ("/blogs/cik-maksa-majaslapa/", "Cik maksā mājaslapa"), ("/projekti/", "Projekti")]),
                   ("SEO", [("/seo-pakalpojumi-riga/", "SEO pakalpojumi Rīgā"), ("/tehniskais-seo/", "Tehniskais SEO un audits"),
                            ("/lokalais-seo/", "Lokālais SEO"), ("/bezmaksas-audits/", "Bezmaksas video audits"),
                            ("/pakalpojumi-un-cenas/", "Cenas")])],
        foot_contact="Saziņa", foot_more=[("/par-mani/", "Par mani"), ("/kontakti/", "Kontakti")],
        foot_vat="Cenas norādītas bez PVN.", quick="Ātrā saziņa", call="Zvanīt", wa_aria="Rakstīt WhatsApp",
        og_locale="lv_LV",
        # form
        f_name="Vārds *", f_phone="Tālrunis", f_email="E-pasts *", f_need="Kas Jums vajadzīgs?",
        f_site="Esošā mājaslapa (ja ir)", f_site_ph="piemērs.lv", f_msg="Īsi par projektu", f_send="Nosūtīt pieprasījumu",
        f_hint="Atbildu 24 stundu laikā. Bez saistībām.", thanks="/paldies/",
        needs=["Jauna mājaslapa", "E-veikals", "SEO esošai mājaslapai", "Bezmaksas video audits", "Pilns SEO audits",
               "Lokālais SEO / Google Business Profile", "Cits jautājums"],
        # projects
        metric="klikšķi", metric_sub="no Google 90 dienās", shot_alt="sākumlapa",
        # blog
        blog="/blogs/", blog_label="Blogs", author="Autors", published="Publicēts", updated="Atjaunināts",
        read="min lasīšanai", toc="Saturs", more_posts="Citi raksti", read_more="Lasīt rakstu →", aside_aria="Papildinformācija",
        bio="Izstrādā mājaslapas ar iebūvētu SEO un strādā ar SEO esošām mājaslapām. 2 gadu pieredze SEO un mājaslapu izstrādē.",
        about_link=("/par-mani/", "Par mani"),
        cta_web=("Vajag jaunu mājaslapu?", "Vizītkartes lapa no 449 €, uzņēmuma mājaslapa no 799 € (bez PVN). Iebūvēts pamata SEO.", "/majaslapas-izstrade/#kalkulators", "Aprēķināt cenu"),
        cta_audit=("Bezmaksas video audits", "Personalizēts ekrāna ieraksts par Jūsu mājaslapas SEO 24 stundu laikā. Bez saistībām.", "/bezmaksas-audits/", "Pieteikt auditu"),
        blog_title="Blogs par mājaslapām un SEO | LatSEO", blog_h1="Blogs par mājaslapām un SEO",
        blog_desc="Praktiski raksti par mājaslapu izstrādi, cenām un SEO Latvijā: kā sagatavot mājaslapu Google meklēšanai, lokālais SEO, Google Business Profile.",
        blog_lead="Raksti no paša darba: ko pārbaudu auditos, cik maksā mājaslapa un kā Google atrod vietējos uzņēmumus.",
        moved="Pārvietots", moved_text="Raksts ir pārvietots:",
    ),
    "en": dict(
        home="/en/", nav=[
            ("/en/majaslapas-izstrade/", "Website development"),
            ("SEO services", [("/en/seo-pakalpojumi-riga/", "SEO services in Riga"), ("/en/tehniskais-seo/", "Technical SEO & audit"),
                              ("/en/lokalais-seo/", "Local SEO"), ("/en/satura-strategija/", "Content strategy"),
                              ("/en/saisu-veidosana/", "Link building")]),
            ("/en/pakalpojumi-un-cenas/", "Pricing"), ("/en/projekti/", "Projects"), ("/en/blogs/", "Blog"),
            ("/en/par-mani/", "About"), ("/en/kontakti/", "Contact")],
        home_label="Home", logo_aria="LatSEO — home", nav_aria="Main navigation", lang_aria="Language",
        cta="Get a price", cta_mobile="Calculate your website price", calc="/en/majaslapas-izstrade/#calculator",
        menu_open="Open menu", mobile_aria="Mobile navigation", skip="Skip to content", crumbs_aria="Breadcrumb",
        foot_brand="Website development with built-in SEO, and SEO services for existing websites. Riga and all of Latvia.",
        foot_legal="Baltic SEO, SIA · Reg. no. 40203749304<br>VAT: LV40203749304<br>Kārklu iela 4, Odukalns, Ķekava Municipality, LV-2123",
        foot_cols=[("Websites", [("/en/majaslapas-izstrade/", "Website development"), ("/en/majaslapas-izstrade/#calculator", "Price calculator"),
                                 ("/en/blogs/how-much-does-a-website-cost/", "How much a website costs"), ("/en/projekti/", "Projects")]),
                   ("SEO", [("/en/seo-pakalpojumi-riga/", "SEO services in Riga"), ("/en/tehniskais-seo/", "Technical SEO & audit"),
                            ("/en/lokalais-seo/", "Local SEO"), ("/en/kontakti/", "Free video audit"),
                            ("/en/pakalpojumi-un-cenas/", "Pricing")])],
        foot_contact="Contact", foot_more=[("/en/par-mani/", "About"), ("/en/kontakti/", "Contact")],
        foot_vat="Prices exclude VAT.", quick="Quick contact", call="Call", wa_aria="Message on WhatsApp",
        og_locale="en_GB",
        f_name="Name *", f_phone="Phone", f_email="Email *", f_need="What do you need?",
        f_site="Current website (if any)", f_site_ph="example.com", f_msg="About your project", f_send="Send request",
        f_hint="I reply within 24 hours. No obligation.", thanks="/en/thank-you/",
        needs=["New website", "Online store", "SEO for an existing website", "Free video audit", "Full SEO audit",
               "Local SEO / Google Business Profile", "Other question"],
        metric="clicks", metric_sub="from Google in 90 days", shot_alt="homepage",
        blog="/en/blogs/", blog_label="Blog", author="Author", published="Published", updated="Updated",
        read="min read", toc="Contents", more_posts="More articles", read_more="Read article →", aside_aria="Related",
        bio="Builds websites with built-in SEO and works on SEO for existing websites. 2 years of experience in SEO and web development.",
        about_link=("/en/par-mani/", "About me"),
        cta_web=("Need a new website?", "One-page site from €449, business website from €799 (excl. VAT). Basic SEO built in.", "/en/majaslapas-izstrade/#calculator", "Calculate price"),
        cta_audit=("Free video audit", "A personal screen recording about your website's SEO within 24 hours. No obligation.", "/en/kontakti/", "Request an audit"),
        blog_title="Blog on websites and SEO | LatSEO", blog_h1="Blog on websites and SEO",
        blog_desc="Practical articles on website development, pricing and SEO in Latvia: preparing a website for Google, local SEO and Google Business Profile.",
        blog_lead="Notes from my own work: what I check in audits, what a website costs and how Google finds local businesses.",
        moved="Moved", moved_text="This article has moved:",
    ),
}

PROJECTS = {
    "tehnologijuakademija": ("https://tehnologijuakademija.lv/", "work/tehnologijuakademija.webp", "tehnologijuakademija.lv", ("Pilna izstrāde · inženierijas apmācības", "Full build · engineering courses"), "0 → 212"),
    "lazergriezeji": ("https://lazergriezeji.lv/", "work/laser.webp", "lazergriezeji.lv", ("Pilna izstrāde · lāzeriekārtu tirdzniecība", "Full build · laser machine retailer"), "1 → 44"),
    "cncfrezes": ("https://cncfrezes.lv/", "work/cncfrezes.webp", "cncfrezes.lv", ("Pilna izstrāde · CNC frēžu tirdzniecība", "Full build · CNC router retailer"), "2 → 42"),
    "3dpakalpojumi": ("https://3dpakalpojumi.lv/", "work/3dpakalpojumi.webp", "3dpakalpojumi.lv", ("Pilna izstrāde · 3D printēšanas pakalpojumi", "Full build · 3D printing services"), "0 → 10"),
    "cncpakalpojumi": ("https://cncpakalpojumi.lv/", "work/cncpakalpojumi.webp", "cncpakalpojumi.lv", ("Pilna izstrāde · CNC frēzēšanas pakalpojumi", "Full build · CNC milling services"), "0 → 9"),
    "bratus": ("https://bratus.lv/", "work/bratus.webp", "bratus.lv", ("Pilna izstrāde · e-veikals (Shopify) · oficiālais IT partneris", "Full build · online store (Shopify) · official IT partner"), None),
    "ploteris": ("https://ploteris.lv/", "work/ploteri.webp", "ploteris.lv", ("Pilna izstrāde · plotergriezēju tirdzniecība", "Full build · cutting plotter retailer"), None),
    "maropro": ("https://maropro.lv/", "work/maropro.webp", "maropro.lv", ("Landing lapa · DTF un UV printeri", "Landing page · DTF and UV printers"), None),
    "autoestetika": ("https://www.autoestetika.lv/", "work/autoestetika.webp", "autoestetika.lv", ("SEO klients · auto detailing Rīgā", "SEO client · car detailing in Riga"), None),
    "relive": ("https://relive.lv/", "work/relive.webp", "relive.lv", ("SEO klients · nekustamo īpašumu aģentūra", "SEO client · real estate agency"), None),
    "ecar": ("https://e-car.lv/", "work/ecar.webp", "e-car.lv", ("SEO klients kopš 2026. gada oktobra · auto noma", "SEO client since October 2026 · car rental"), None),
}

ICON = {
    "mail": '<svg class="footer__contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    "phone": '<svg class="footer__contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    "in": '<svg class="footer__contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
    "wa": '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>',
    "call": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
}


def esc(s):
    return html.escape(s, quote=True)


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def read_source(p, lang):
    text = p.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", text, re.S)
    if not m:
        raise SystemExit(f"{p}: missing <!--meta {{...}} --> block")
    meta = json.loads(m.group(1))
    meta["body"] = text[m.end():]
    meta["src"] = p
    meta.setdefault("lang", lang)
    return meta


def out_file(path):
    if path.endswith(".html"):
        return ROOT / path.lstrip("/")
    return ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"


# ---------------------------------------------------------------- chrome
def lang_pair(meta):
    """(lv_url, en_url) for the language switch."""
    t = meta["lang"]
    if t == "lv":
        return meta["path"], meta.get("en") or "/en/"
    return meta.get("lv") or "/", meta["path"]


def header(meta):
    t = T[meta["lang"]]
    path = meta["path"]
    lv_url, en_url = lang_pair(meta)
    items, mobile = [], [f'<a href="{t["home"]}">{t["home_label"]}</a>']
    for href, label in t["nav"]:
        if isinstance(label, list):
            sub = "".join(f'<a href="{h}">{esc(x)}</a>' for h, x in label)
            on = " header__nav-link--active" if any(h == path for h, _ in label) else ""
            items.append(f'<li class="header__dropdown"><span class="header__dropdown-toggle{on}" tabindex="0" role="button" aria-haspopup="true">'
                         f'{esc(href)} <span class="header__dropdown-toggle-icon" aria-hidden="true">▾</span></span>'
                         f'<div class="header__dropdown-menu">{sub}</div></li>')
            mobile += [f'<a href="{h}">{esc(x)}</a>' for h, x in label[:3]]
        else:
            cur = ' header__nav-link--active" aria-current="page' if href == path else ""
            items.append(f'<li><a href="{href}" class="header__nav-link{cur}">{esc(label)}</a></li>')
            mobile.append(f'<a href="{href}">{esc(label)}</a>')
    lv_on = meta["lang"] == "lv"
    sw = (f'<a href="{lv_url}" class="header__lang-btn{" header__lang-btn--active" if lv_on else ""}" hreflang="lv" lang="lv"{" aria-current=\"true\"" if lv_on else ""}>LV</a>'
          f'<a href="{en_url}" class="header__lang-btn{"" if lv_on else " header__lang-btn--active"}" hreflang="en" lang="en"{"" if lv_on else " aria-current=\"true\""}>EN</a>')
    return f'''<header class="site-header" role="banner">
  <div class="header__inner">
    <a href="{t["home"]}" class="header__logo" aria-label="{t["logo_aria"]}"><img src="/assets/images/latseo-logo.png" alt="LatSEO" class="header__logo-img" width="46" height="40"></a>
    <nav class="header__nav" aria-label="{t["nav_aria"]}">
      <ul class="header__nav-list">{"".join(items)}</ul>
      <div class="header__lang-switch" role="group" aria-label="{t["lang_aria"]}">{sw}</div>
      <a href="{t["calc"]}" class="header__cta">{t["cta"]} {ARROW}</a>
    </nav>
    <button class="header__mobile-toggle" aria-label="{t["menu_open"]}" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span><span></span></button>
  </div>
  <div class="header__mobile-menu" id="mobile-menu" aria-label="{t["mobile_aria"]}">
    {"".join(mobile)}
    <a href="{t["calc"]}" class="btn btn--primary">{t["cta_mobile"]}</a>
    <div class="header__mobile-lang">{sw}</div>
  </div>
</header>'''


def landing_header(meta):
    t = T[meta["lang"]]
    return (f'<header class="site-header" role="banner"><div class="header__inner">'
            f'<a href="{t["home"]}" class="header__logo" aria-label="{t["logo_aria"]}"><img src="/assets/images/latseo-logo.png" alt="LatSEO" class="header__logo-img" width="46" height="40"></a>'
            f'<a href="tel:{PHONE}" class="header__cta">{PHONE_H}</a></div></header>')


def footer(lang):
    t = T[lang]
    cols = "".join(
        f'<div><div class="footer__heading">{esc(h)}</div><ul class="footer__links">'
        + "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for u, n in links) + "</ul></div>"
        for h, links in t["foot_cols"])
    more = "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for u, n in t["foot_more"])
    return f'''<footer class="site-footer" role="contentinfo">
  <div class="container">
    <div class="footer__grid">
      <div>
        <a href="{t["home"]}" class="header__logo" aria-label="LatSEO"><img src="/assets/images/latseo-logo.png" alt="LatSEO" class="header__logo-img" width="46" height="40" loading="lazy"></a>
        <p class="footer__brand-text">{t["foot_brand"]}</p>
        <p class="footer__legal">{t["foot_legal"]}</p>
      </div>
      {cols}
      <div>
        <div class="footer__heading">{t["foot_contact"]}</div>
        <div class="footer__contact-item">{ICON["phone"]}<a href="tel:{PHONE}">{PHONE_H}</a></div>
        <div class="footer__contact-item">{ICON["mail"]}<a href="mailto:{EMAIL}">{EMAIL}</a></div>
        <div class="footer__contact-item">{ICON["in"]}<a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></div>
        <ul class="footer__links footer__links--more">{more}</ul>
      </div>
    </div>
    <div class="footer__bottom"><p>© 2026 LatSEO · Baltic SEO, SIA</p><p>{t["foot_vat"]}</p></div>
  </div>
</footer>
<div class="floating-ctas" aria-label="{t["quick"]}">
  <a href="tel:{PHONE}" class="floating-cta floating-cta--call" aria-label="{t["call"]} {PHONE_H}">{ICON["call"]}<span class="floating-cta__label">{t["call"]}</span></a>
  <a href="https://wa.me/37124424434" class="floating-cta floating-cta--whatsapp" aria-label="{t["wa_aria"]}" target="_blank" rel="noopener">{ICON["wa"]}<span class="floating-cta__label">WhatsApp</span></a>
</div>'''


def breadcrumb_schema(crumbs):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": strip_tags(n), "item": SITE + h} for i, (h, n) in enumerate(crumbs)]}


def breadcrumbs_html(crumbs, lang):
    parts = []
    for i, (h, n) in enumerate(crumbs):
        if i:
            parts.append('<span aria-hidden="true">/</span>')
        parts.append(f'<a href="{h}">{n}</a>' if i < len(crumbs) - 1 else f'<span aria-current="page">{n}</span>')
    return f'<nav class="breadcrumbs" aria-label="{T[lang]["crumbs_aria"]}">{"".join(parts)}</nav>'


def head(meta, graph):
    t = T[meta["lang"]]
    url = SITE + meta["path"]
    lv_url, en_url = lang_pair(meta)
    has_pair = bool(meta.get("en") if meta["lang"] == "lv" else meta.get("lv"))
    alt = ""
    if has_pair:
        alt = (f'\n  <link rel="alternate" hreflang="lv" href="{SITE}{lv_url}">'
               f'\n  <link rel="alternate" hreflang="en" href="{SITE}{en_url}">'
               f'\n  <link rel="alternate" hreflang="x-default" href="{SITE}{lv_url}">')
    og = meta.get("og_image", f"{SITE}/assets/images/og-latseo.jpg")
    if og.startswith("/"):
        og = SITE + og
    robots = meta.get("robots", "index, follow, max-image-preview:large, max-snippet:-1")
    schema = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    body_class = f' class="{meta["body_class"]}"' if meta.get("body_class") else ""
    return f'''<!DOCTYPE html>
<html lang="{meta["lang"]}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(meta["title"])}</title>
  <meta name="description" content="{esc(meta["description"])}">
  <meta name="robots" content="{robots}">
  <link rel="canonical" href="{url}">{alt}
  <meta property="og:locale" content="{t["og_locale"]}">
  <meta property="og:type" content="{meta.get("og_type", "website")}">
  <meta property="og:site_name" content="LatSEO">
  <meta property="og:title" content="{esc(meta.get("og_title", meta["title"]))}">
  <meta property="og:description" content="{esc(meta["description"])}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{og}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#F6F4EE">
  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{FONTS}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="{FONTS}"></noscript>
  <link rel="stylesheet" href="/css/style.css?v={TODAY}">{meta.get("head_extra", "")}
  <script type="application/ld+json">
{schema}
  </script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-MF7Q1R9722"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-MF7Q1R9722');gtag('config','AW-18351723640');</script>
  <script>(function(){{var d=false;function l(){{if(d)return;d=true;(function(c,l,a,r,i,t,y){{c[a]=c[a]||function(){{(c[a].q=c[a].q||[]).push(arguments)}};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);}})(window,document,"clarity","script","xx3mt1i3hw");}}['scroll','pointerdown','keydown','touchstart'].forEach(function(e){{addEventListener(e,l,{{once:true,passive:true}});}});setTimeout(l,4000);}})();</script>
</head>
<body{body_class}>
<a href="#main-content" class="skip-link">{t["skip"]}</a>
'''


# ---------------------------------------------------------------- reusable blocks
def project_card(key, lang):
    url, img, name, tags, metric = PROJECTS[key]
    t = T[lang]
    tag = tags[0] if lang == "lv" else tags[1]
    m = f'<span class="proof-card__metric">{metric} {t["metric"]}<small>{t["metric_sub"]}</small></span>' if metric else ""
    return (f'<a class="proof-card" href="{url}" target="_blank" rel="noopener">'
            f'<img src="/assets/images/{img}" alt="{name} {t["shot_alt"]}" width="960" height="600" loading="lazy">'
            f'<span class="proof-card__body"><span class="proof-card__name">{name}</span><span class="proof-card__tag">{tag}</span>{m}</span></a>')


def browser(key, lang, cls=""):
    url, img, name, *_ = PROJECTS[key]
    return (f'<figure class="browser {cls}"><div class="browser__bar"><i></i><i></i><i></i><span class="browser__url">{name}</span></div>'
            f'<img src="/assets/images/{img}" alt="{name} {T[lang]["shot_alt"]}" width="960" height="600"{" fetchpriority=\"high\"" if cls == "first" else " loading=\"lazy\""}></figure>')


def form(prefix, source, lang, first=None, button=None):
    t = T[lang]
    first = first or t["needs"][0]
    opts = "".join(f'<option{" selected" if n == first else ""}>{n}</option>' for n in t["needs"])
    return f'''<form class="contact-form" action="#" method="POST" data-redirect="{t["thanks"]}"><input type="hidden" name="page_source" value="{esc(source)}">
<div class="contact-form__row">
  <div class="contact-form__group"><label class="contact-form__label" for="{prefix}-name">{t["f_name"]}</label><input id="{prefix}-name" type="text" name="name" class="contact-form__input" required autocomplete="name"></div>
  <div class="contact-form__group"><label class="contact-form__label" for="{prefix}-phone">{t["f_phone"]}</label><input id="{prefix}-phone" type="tel" name="phone" class="contact-form__input" autocomplete="tel"></div>
</div>
<div class="contact-form__group"><label class="contact-form__label" for="{prefix}-email">{t["f_email"]}</label><input id="{prefix}-email" type="email" name="email" class="contact-form__input" required autocomplete="email"></div>
<div class="contact-form__group"><label class="contact-form__label" for="{prefix}-need">{t["f_need"]}</label><select id="{prefix}-need" name="need" class="contact-form__input">{opts}</select></div>
<div class="contact-form__group"><label class="contact-form__label" for="{prefix}-site">{t["f_site"]}</label><input id="{prefix}-site" type="text" name="website" class="contact-form__input" autocomplete="url" inputmode="url" placeholder="{t["f_site_ph"]}"></div>
<div class="contact-form__group"><label class="contact-form__label" for="{prefix}-msg">{t["f_msg"]}</label><textarea id="{prefix}-msg" name="message" class="contact-form__textarea"></textarea></div>
<input type="text" name="_honey" class="contact-form__honey" tabindex="-1" autocomplete="off" aria-hidden="true">
<button type="submit" class="contact-form__submit">{button or t["f_send"]} {ARROW}</button>
<p class="contact-form__hint">{t["f_hint"]}</p></form>'''


def label_tables(body):
    """Copy <th> texts into data-label on each <td> so tables can stack on mobile."""
    def one(m):
        tbl = m.group(0)
        heads = [strip_tags(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", tbl, re.S)]
        if not heads:
            return tbl
        def row(r):
            cells = iter(heads)
            return re.sub(r"<td(?![^>]*data-label)", lambda c: f'<td data-label="{esc(next(cells, ""))}"', r.group(0))
        tbl = re.sub(r"<tr>.*?</tr>", row, tbl, flags=re.S)
        if len(heads) == 2:
            tbl = tbl.replace('<table class="table">', '<table class="table table--kv">', 1)
        return tbl
    return re.sub(r'<table class="table">.*?</table>', one, body, flags=re.S)


def expand_tokens(body, lang):
    body = re.sub(r"\{\{project:(\w+)\}\}", lambda m: project_card(m.group(1), lang), body)
    first = {"done": False}
    def _browser(m):
        cls = "" if first["done"] else "first"
        first["done"] = True
        return browser(m.group(1), lang, cls)
    body = re.sub(r"\{\{browser:(\w+)\}\}", _browser, body)
    body = re.sub(r"\{\{form:([\w-]+)\|([^|}]+)(?:\|([^|}]+))?(?:\|([^|}]+))?\}\}",
                  lambda m: form(m.group(1), m.group(2), lang, m.group(3), m.group(4)), body)
    body = label_tables(body)
    for k, v in {"{{arrow}}": ARROW, "{{phone}}": PHONE, "{{phone_h}}": PHONE_H, "{{email}}": EMAIL,
                 "{{photo}}": PHOTO, "{{linkedin}}": LINKEDIN}.items():
        body = body.replace(k, v)
    return body


def faq_schema(body):
    qa = re.findall(r'<details data-faq>\s*<summary>(.*?)</summary>\s*<div>(.*?)</div>\s*</details>', body, re.S)
    if not qa:
        return []
    return [{"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip_tags(q), "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}} for q, a in qa]}]


# ---------------------------------------------------------------- render
def render(meta, schema_extra=()):
    lang = meta["lang"]
    path = meta["path"]
    crumbs = meta.get("crumbs")
    graph = [ORG, PERSON, WEBSITE] if lang == "lv" else [ORG_EN, PERSON_EN, WEBSITE]
    node = {"@type": meta.get("page_type", "WebPage"), "@id": f"{SITE}{path}#webpage", "url": SITE + path,
            "name": meta["title"], "description": meta["description"], "inLanguage": lang,
            "isPartOf": {"@id": f"{SITE}/#website"}, "about": {"@id": f"{SITE}/#org"}}
    if meta.get("modified"):
        node["dateModified"] = meta["modified"]
    if crumbs:
        bc = breadcrumb_schema(crumbs)
        bc["@id"] = f"{SITE}{path}#breadcrumb"
        node["breadcrumb"] = {"@id": bc["@id"]}
        graph.append(bc)
    graph.append(node)
    graph += list(meta.get("schema", [])) + list(schema_extra)
    body = meta["body"]
    if crumbs:
        body = body.replace("{{breadcrumbs}}", breadcrumbs_html(crumbs, lang))
    body = expand_tokens(body, lang)
    hdr = header(meta) if meta.get("chrome", "full") == "full" else landing_header(meta)
    scripts = f'<script src="/js/main.js?v={TODAY}" defer></script>' + meta.get("scripts", "")
    page = head(meta, graph) + hdr + '\n<main id="main-content">\n' + body.strip() + "\n</main>\n" + footer(lang) + "\n" + scripts + "\n</body>\n</html>\n"
    f = out_file(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(page, encoding="utf-8")
    return f


MONTHS = {"lv": ["janvāris", "februāris", "marts", "aprīlis", "maijs", "jūnijs", "jūlijs", "augusts", "septembris", "oktobris", "novembris", "decembris"],
          "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]}


def fmt_date(iso, lang):
    d = dt.date.fromisoformat(iso)
    m = MONTHS[lang][d.month - 1]
    return f"{d.year}. gada {d.day}. {m}" if lang == "lv" else f"{d.day} {m} {d.year}"


def slug_of(p):
    return p["path"].strip("/").split("/")[-1]


def cover_of(p):
    """Generated cover if it exists (scripts/make_covers.py), otherwise the site OG image."""
    c = f"/assets/covers/{slug_of(p)}.jpg"
    return c if (ROOT / c.lstrip("/")).exists() else "/assets/images/og-latseo.jpg"


def post_card(p, feature=False):
    t = T[p["lang"]]
    return (f'<a class="post-card{" post-card--feature" if feature else ""}" href="{p["path"]}">'
            f'<img class="post-card__cover" src="{cover_of(p)}" alt="" width="1200" height="630" loading="lazy">'
            f'<span class="post-card__body"><span class="post-card__meta">{esc(p["category"])} · {fmt_date(p["date"], p["lang"])}</span>'
            f'<span class="post-card__title">{p["h1"]}</span><span class="post-card__excerpt">{esc(p["description"])}</span>'
            f'<span class="post-card__more">{t["read_more"]}</span></span></a>')


def render_post(m, posts):
    lang = m["lang"]
    t = T[lang]
    cover = cover_of(m)
    m.setdefault("og_image", cover)
    m["og_type"] = "article"
    m["crumbs"] = [(t["home"], t["home_label"]), (t["blog"], t["blog_label"]), (m["path"], m["h1"])]
    body = m["body"]
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
    toc = "".join(f'<li><a href="#{i}">{x}</a></li>' for i, x in heads)
    words = len(strip_tags(body).split())
    mins = max(3, round(words / 200))
    rel_paths = m.get("related_paths") or []
    related = [p for p in posts if p["path"] in rel_paths] or [p for p in posts if p["path"] != m["path"]][:3]
    rel = "".join(post_card(p) for p in related[:3])
    title, text, href, btn = t["cta_web"] if m.get("cta", "web") == "web" else t["cta_audit"]
    dmod = m.get("modified", m["date"])
    upd = f'<span>{t["updated"]}: <time datetime="{dmod}">{fmt_date(dmod, lang)}</time></span>' if dmod != m["date"] else ""
    about_href, about_txt = t["about_link"]
    m["body"] = f'''<article>
<header class="article-head container">
  {{{{breadcrumbs}}}}
  <p class="eyebrow">{esc(m["category"])}</p>
  <h1>{m["h1"]}</h1>
  <p class="article-meta"><span>{t["author"]}: <a href="{about_href}">Adrians Stankevičs</a></span><span>{t["published"]}: <time datetime="{m["date"]}">{fmt_date(m["date"], lang)}</time></span>{upd}<span>{mins} {t["read"]}</span></p>
</header>
<div class="container"><img class="article-cover" src="{cover}" alt="{esc(strip_tags(m["h1"]))}" width="1200" height="630"></div>
<div class="container article-layout">
  <div class="article-body">
{body.strip()}
    <div class="author-box"><img src="{PHOTO}" alt="Adrians Stankevičs" width="64" height="64" loading="lazy"><div><strong>Adrians Stankevičs</strong><p>{t["bio"]} <a href="{about_href}">{about_txt}</a> · <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></p></div></div>
  </div>
  <aside class="article-aside" aria-label="{t["aside_aria"]}">
    {f'<div class="aside-card"><p class="aside-card__title">{t["toc"]}</p><ol class="toc">{toc}</ol></div>' if len(heads) > 2 else ""}
    <div class="aside-card aside-card--ink"><p class="aside-card__title">{title}</p><p>{text}</p><a class="btn btn--primary" href="{href}">{btn}</a></div>
  </aside>
</div>
</article>
<section class="section section--muted"><div class="container"><h2 class="section__title">{t["more_posts"]}</h2><div class="blog-grid">{rel}</div></div></section>'''
    schema = [{
        "@type": "BlogPosting", "@id": f"{SITE}{m['path']}#article", "headline": strip_tags(m["h1"]),
        "description": m["description"], "image": SITE + cover, "datePublished": m["date"], "dateModified": dmod,
        "author": {"@id": f"{SITE}/#adrians"}, "publisher": {"@id": f"{SITE}/#org"}, "inLanguage": lang,
        "mainEntityOfPage": {"@id": f"{SITE}{m['path']}#webpage"}, "wordCount": words, "articleSection": m["category"]}]
    return render(m, schema + faq_schema(body))


def render_blog_index(posts, lang):
    t = T[lang]
    cards = post_card(posts[0], True) + "".join(post_card(p) for p in posts[1:])
    meta = {"lang": lang, "path": t["blog"], "title": t["blog_title"], "description": t["blog_desc"],
            "crumbs": [(t["home"], t["home_label"]), (t["blog"], t["blog_label"])], "page_type": "CollectionPage",
            "body": f'''<section class="page-hero"><div class="container">{{{{breadcrumbs}}}}
<h1 class="page-title">{t["blog_h1"]}</h1>
<p class="lead">{t["blog_lead"]}</p></div></section>
<section class="section"><div class="container"><div class="blog-grid">{cards}</div></div></section>'''}
    if lang == "lv":
        meta["en"] = "/en/blogs/"
    else:
        meta["lv"] = "/blogs/"
    return render(meta, [{"@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": SITE + p["path"]} for i, p in enumerate(posts)]}])


def write_redirects():
    f = SRC / "redirects.json"
    if not f.exists():
        return []
    out = []
    for old, new in json.loads(f.read_text(encoding="utf-8")).items():
        lang = "en" if old.startswith("/en/") else "lv"
        t = T[lang]
        target = SITE + new
        page = (f'<!DOCTYPE html><html lang="{lang}"><head><meta charset="UTF-8"><title>{t["moved"]} | LatSEO</title>'
                f'<link rel="canonical" href="{target}">'
                f'<meta http-equiv="refresh" content="0; url={new}"></head><body>'
                f'<p>{t["moved_text"]} <a href="{new}">{target}</a></p></body></html>\n')
        p = out_file(old)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(page, encoding="utf-8")
        out.append(p)
    return out


def write_sitemap():
    urls = []
    for p in sorted(ROOT.rglob("index.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith((".git", "_src/", "src/")):
            continue
        s = p.read_text(encoding="utf-8")
        if re.search(r'<meta name="robots" content="[^"]*noindex', s) or 'http-equiv="refresh"' in s:
            continue
        can = re.search(r'<link rel="canonical" href="([^"]+)"', s)
        if not can or can.group(1) != SITE + "/" + rel[: -len("index.html")]:
            continue
        alts = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', s)
        mod = re.search(r'"dateModified":\s*"([\d-]+)"', s)
        urls.append((can.group(1), alts, mod.group(1) if mod else TODAY))

    def prio(u):
        if u in (SITE + "/",):
            return "1.0"
        if u.endswith(("/majaslapas-izstrade/", "/seo-pakalpojumi-riga/", "/pakalpojumi-un-cenas/")) and "/en/" not in u:
            return "0.9"
        if "/en/" in u:
            return "0.5"
        if "/blogs/" in u and not u.endswith("/blogs/"):
            return "0.6"
        return "0.7"
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u, alts, mod in sorted(urls, key=lambda x: (-float(prio(x[0])), x[0])):
        lines.append(f"  <url>\n    <loc>{u}</loc>")
        lines += [f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{h}"/>' for hl, h in alts]
        lines.append(f"    <lastmod>{mod}</lastmod>\n    <priority>{prio(u)}</priority>\n  </url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(urls)


def main():
    built = write_redirects()
    for lang, base in (("lv", SRC), ("en", SRC / "en")):
        for src in sorted((base / "pages").glob("*.html")):
            m = read_source(src, lang)
            built.append(render(m, faq_schema(m["body"])))
        posts = [read_source(p, lang) for p in sorted((base / "blog").glob("*.html"))]
        posts.sort(key=lambda m: m["date"], reverse=True)
        for p in posts:
            built.append(render_post(p, posts))
        if posts:
            built.append(render_blog_index(posts, lang))
    n = write_sitemap()
    for f in built:
        print("  built", f.relative_to(ROOT))
    print(f"{len(built)} pages, sitemap {n} URLs")


if __name__ == "__main__":
    main()
