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
import hashlib
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
FONT_PRELOAD = ()
GA4, ADS, CLARITY = "G-MF7Q1R9722", "AW-18351723640", "xx3mt1i3hw"
# Consent Mode v2: everything denied until the visitor chooses (stored in localStorage "latseo-consent").
# gtag.js loads on the first interaction or when the browser is idle after load (not during page load),
# Clarity only with analytics consent. The banner itself is in js/main.js.
TAGS = ("<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
        "(function(){var c=null;try{c=JSON.parse(localStorage.getItem('latseo-consent'))}catch(e){}"
        "var a=c&&c.a?'granted':'denied',m=c&&c.m?'granted':'denied';"
        "gtag('consent','default',{analytics_storage:a,ad_storage:m,ad_user_data:m,ad_personalization:m});"
        f"gtag('js',new Date());gtag('config','{GA4}');gtag('config','{ADS}');"
        "window.latseoClarity=function(){if(window.clarity)return;(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};"
        f"t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);}})(window,document,'clarity','script','{CLARITY}');}};"
        "var d=false;function l(){if(d)return;d=true;var s=document.createElement('script');s.async=1;"
        f"s.src='https://www.googletagmanager.com/gtag/js?id={GA4}';document.head.appendChild(s);if(c&&c.a)window.latseoClarity();}}"
        "['scroll','pointerdown','keydown','touchstart'].forEach(function(e){addEventListener(e,l,{once:true,passive:true});});"
        "addEventListener('load',function(){setTimeout(function(){(window.requestIdleCallback||setTimeout)(l,{timeout:2000});},6000);});"
        "})();</script>")
TODAY = dt.date.today().isoformat()
# Cache-busting by content, so a daily blog build does not rewrite every page
ASSET_V = {f: hashlib.md5((ROOT / f).read_bytes()).hexdigest()[:8] for f in ("css/style.css", "js/main.js")}


def asset_v(f):
    """Content hash of a local /css or /js file (cached); '' if missing."""
    if f not in ASSET_V:
        p = ROOT / f
        ASSET_V[f] = hashlib.md5(p.read_bytes()).hexdigest()[:8] if p.is_file() else ""
    return ASSET_V[f]


def bust_assets(html):
    """Append ?v=<content hash> to every local /css/*.css and /js/*.js reference that has no query yet."""
    def sub(m):
        v = asset_v(m.group(2).lstrip("/"))
        return f'{m.group(1)}="{m.group(2)}?v={v}"' if v else m.group(0)
    return re.sub(r'(href|src)="(/(?:css|js)/[\w./-]+\.(?:css|js))"', sub, html)


# Instrument stylesheets (css/ix-*.css) style lazily-initialised sections below the fold, so they must not
# block first render (mobile LCP). ix-theme.css (global accents) and ix-hero.css (hero layout, above the fold)
# stay render-blocking; every other ix-* sheet is loaded with the preload/onload swap + <noscript> fallback.
IX_BLOCKING = ("ix-theme.css", "ix-hero.css")


def defer_ix_css(html):
    def sub(m):
        href = m.group(1)
        if any(b in href for b in IX_BLOCKING):
            return m.group(0)
        return (f'<link rel="preload" href="{href}" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">'
                f'<noscript><link rel="stylesheet" href="{href}"></noscript>')
    return re.sub(r'<link rel="stylesheet" href="(/css/ix-[\w.-]+\.css[^"]*)">', sub, html)
ARROW = ''  # no decorative arrows on buttons/links; {{arrow}} in old sources renders as nothing

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
            ("SEO pakalpojumi", [("/seo-pakalpojumi-riga/", "SEO optimizācija"), ("/tehniskais-seo/", "Tehniskais SEO un audits"),
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
                   ("SEO", [("/seo-pakalpojumi-riga/", "SEO optimizācija"), ("/tehniskais-seo/", "Tehniskais SEO un audits"),
                            ("/lokalais-seo/", "Lokālais SEO"), ("/bezmaksas-audits/", "Bezmaksas video audits"),
                            ("/pakalpojumi-un-cenas/", "Cenas")])],
        foot_contact="Saziņa", foot_more=[("/par-mani/", "Par mani"), ("/kontakti/", "Kontakti")],
        foot_vat="Cenas norādītas bez PVN.", privacy=("/privatuma-politika/", "Privātuma politika"), cookie_settings="Sīkdatņu iestatījumi", quick="Ātrā saziņa", call="Zvanīt", wa_aria="Rakstīt WhatsApp",
        og_locale="lv_LV", og_alt="LatSEO — mājaslapu izstrāde ar iebūvētu SEO, Rīga",
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
        read="min lasīšanai", toc="Saturs", more_posts="Citi raksti", read_more="Lasīt rakstu", aside_aria="Papildinformācija",
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
            ("SEO services", [("/en/seo-pakalpojumi-riga/", "SEO optimisation"), ("/en/tehniskais-seo/", "Technical SEO & audit"),
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
                   ("SEO", [("/en/seo-pakalpojumi-riga/", "SEO optimisation"), ("/en/tehniskais-seo/", "Technical SEO & audit"),
                            ("/en/lokalais-seo/", "Local SEO"), ("/en/kontakti/", "Free video audit"),
                            ("/en/pakalpojumi-un-cenas/", "Pricing")])],
        foot_contact="Contact", foot_more=[("/en/par-mani/", "About"), ("/en/kontakti/", "Contact")],
        foot_vat="Prices exclude VAT.", privacy=("/en/privacy-policy/", "Privacy policy"), cookie_settings="Cookie settings", quick="Quick contact", call="Call", wa_aria="Message on WhatsApp",
        og_locale="en_GB", og_alt="LatSEO — website development with built-in SEO, Riga",
        f_name="Name *", f_phone="Phone", f_email="Email *", f_need="What do you need?",
        f_site="Current website (if any)", f_site_ph="example.com", f_msg="About your project", f_send="Send request",
        f_hint="I reply within 24 hours. No obligation.", thanks="/en/thank-you/",
        needs=["New website", "Online store", "SEO for an existing website", "Free video audit", "Full SEO audit",
               "Local SEO / Google Business Profile", "Other question"],
        metric="clicks", metric_sub="from Google in 90 days", shot_alt="homepage",
        blog="/en/blogs/", blog_label="Blog", author="Author", published="Published", updated="Updated",
        read="min read", toc="Contents", more_posts="More articles", read_more="Read article", aside_aria="Related",
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
    "autoestetika": ("https://www.autoestetika.lv/", "work/autoestetika.webp", "autoestetika.lv", ("SEO un Google Business Profile · auto detailing Rīgā · kopš 2026. gada marta", "SEO and Google Business Profile · car detailing in Riga · since March 2026"), ("+31 %", ("klikšķi no Google, aug.–okt. 2026 pret 2025", "Google clicks, Aug–Oct 2026 vs 2025"))),
    "relive": ("https://relive.lv/", "work/relive.webp", "relive.lv", ("SEO klients · nekustamo īpašumu aģentūra", "SEO client · real estate agency"), (("kopš 04.2026", "since 04.2026"), ("SEO darba sākums", "start of SEO work"), "since")),
    "ecar": ("https://e-car.lv/", "work/ecar.webp", "e-car.lv", ("SEO klients · auto noma", "SEO client · car rental"), (("kopš 10.2026", "since 10.2026"), ("SEO darba sākums", "start of SEO work"), "since")),
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


# ---------------------------------------------------------------- lastmod
# sitemap <lastmod> and JSON-LD dateModified change only when a page's own content changes
# (title, description, h1, body source), never on a template/CSS change or a rebuild.
# Stored in _src/lastmod.json: {path: {"hash": ..., "lastmod": "YYYY-MM-DD"}}.
LASTMOD_FILE = SRC / "lastmod.json"
LASTMOD = json.loads(LASTMOD_FILE.read_text(encoding="utf-8")) if LASTMOD_FILE.exists() else {}
_seen = set()


def _git_date(p):
    """Date of the last commit touching a file (used only to seed a page missing from lastmod.json)."""
    import subprocess
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(p)], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.strip()
        return out or None
    except Exception:
        return None


def content_lastmod(path, content, seed=None):
    """Last content change date for `path`; `content` is what the page says (no template)."""
    h = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    _seen.add(path)
    rec = LASTMOD.get(path)
    if rec and rec["hash"] == h:
        return rec["lastmod"]
    date = TODAY if rec else (seed or TODAY)
    LASTMOD[path] = {"hash": h, "lastmod": date}
    return date


def page_lastmod(meta):
    content = "\n".join([meta["title"], meta["description"], meta.get("h1", ""), meta["body"].strip()])
    seed = meta.get("modified") or meta.get("date") or _git_date(meta["src"])
    return content_lastmod(meta["path"], content, seed)


def write_lastmod():
    for k in [k for k in LASTMOD if k not in _seen]:     # pages that no longer exist
        del LASTMOD[k]
    LASTMOD_FILE.write_text(json.dumps(dict(sorted(LASTMOD.items())), ensure_ascii=False, indent=1) + "\n",
                            encoding="utf-8")


def out_file(path):
    if path.endswith(".html"):
        return ROOT / path.lstrip("/")
    return ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"


# ---------------------------------------------------------------- images
# Smaller WebP variants next to the original: x.webp -> x-480.webp, cover.jpg -> cover.webp + cover-640.webp.
# Made with Pillow when available (ThinkPad autoblog venv, claude-seo venv); without Pillow only
# variants that already exist are used, so the build never breaks.
def _variant(src, width, suffix):
    """Path (site-relative) of a WebP variant of `src`, creating it if possible; None if unavailable."""
    f = ROOT / src.lstrip("/")
    out = f.with_name(f"{f.stem}{suffix}.webp")
    if not out.exists():                # make_covers.py deletes stale variants
        try:
            from PIL import Image
        except ImportError:
            return "/" + out.relative_to(ROOT).as_posix() if out.exists() else None
        with Image.open(f) as im:
            if width and im.width > width:
                im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            im.save(out, "WEBP", quality=80, method=6)
    return "/" + out.relative_to(ROOT).as_posix()


def srcset(src, widths, full_width):
    """(src, srcset) for an <img>: WebP original/full size plus smaller variants."""
    full = src if src.endswith(".webp") else _variant(src, None, "") or src
    parts = [f"{v} {w}w" for w in widths if (v := _variant(src, w, f"-{w}"))]
    if not parts:
        return full, ""
    return full, ", ".join(parts + [f"{full} {full_width}w"])


def img_attrs(src, widths, full_width, sizes):
    full, ss = srcset(src, widths, full_width)
    return f'src="{full}"' + (f' srcset="{ss}" sizes="{sizes}"' if ss else "")


CARD_SIZES = "(max-width: 700px) calc(100vw - 32px), (max-width: 1000px) 50vw, 560px"
WIDE_SIZES = "(max-width: 1240px) calc(100vw - 32px), 1200px"


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
    # the current page in the phone menu gets the same signal mark as the desktop nav (css/ix-theme.css)
    mobile = [m.replace(f'<a href="{path}">', f'<a href="{path}" aria-current="page">', 1) for m in mobile]
    lv_on = meta["lang"] == "lv"
    sw = (f'<a href="{lv_url}" class="header__lang-btn{" header__lang-btn--active" if lv_on else ""}" hreflang="lv" lang="lv"{" aria-current=\"true\"" if lv_on else ""}>LV</a>'
          f'<a href="{en_url}" class="header__lang-btn{"" if lv_on else " header__lang-btn--active"}" hreflang="en" lang="en"{"" if lv_on else " aria-current=\"true\""}>EN</a>')
    return f'''<header class="site-header" role="banner">
  <div class="header__inner">
    <a href="{t["home"]}" class="header__logo" aria-label="{t["logo_aria"]}"><img src="/assets/images/latseo-logo-92.webp" alt="LatSEO" class="header__logo-img" width="46" height="40"></a>
    <nav class="header__nav" aria-label="{t["nav_aria"]}">
      <ul class="header__nav-list">{"".join(items)}</ul>
      <div class="header__lang-switch" role="group" aria-label="{t["lang_aria"]}">{sw}</div>
      <a href="{t["calc"]}" class="header__cta">{t["cta"]}</a>
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
            f'<a href="{t["home"]}" class="header__logo" aria-label="{t["logo_aria"]}"><img src="/assets/images/latseo-logo-92.webp" alt="LatSEO" class="header__logo-img" width="46" height="40"></a>'
            f'<a href="tel:{PHONE}" class="header__cta">{PHONE_H}</a></div></header>')


def has_page(path):
    """True if some _src page renders `path` (so the footer never links to a 404)."""
    if not hasattr(has_page, "paths"):
        has_page.paths = set()
        for f in SRC.glob("**/pages/*.html"):
            m = re.search(r'"path":\s*"([^"]+)"', f.read_text(encoding="utf-8")[:2000])
            if m:
                has_page.paths.add(m.group(1))
    return path in has_page.paths


def footer(lang):
    t = T[lang]
    cols = "".join(
        f'<div><div class="footer__heading">{esc(h)}</div><ul class="footer__links">'
        + "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for u, n in links) + "</ul></div>"
        for h, links in t["foot_cols"])
    more = "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for u, n in t["foot_more"])
    priv_href, priv_txt = t["privacy"]
    legal = (f'<a href="{priv_href}">{priv_txt}</a> · ' if has_page(priv_href) else "") + \
        f'<button type="button" class="footer__cookie-btn" data-consent-open>{t["cookie_settings"]}</button>'
    return f'''<footer class="site-footer" role="contentinfo">
  <div class="container">
    <div class="footer__grid">
      <div>
        <a href="{t["home"]}" class="header__logo" aria-label="LatSEO"><img src="/assets/images/latseo-logo-92.webp" alt="LatSEO" class="header__logo-img" width="46" height="40" loading="lazy"></a>
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
    <div class="footer__bottom"><p>© 2026 LatSEO · Baltic SEO, SIA</p><p class="footer__legal-links">{legal}</p><p>{t["foot_vat"]}</p></div>
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
    default_og = "/assets/images/og-latseo.jpg" if meta["lang"] == "lv" else "/assets/images/og-latseo-en.jpg"
    og = meta.get("og_image", default_og)
    og_alt = meta.get("og_alt") or (strip_tags(meta["h1"]) if meta.get("og_image") and meta.get("h1") else t["og_alt"])
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
  <meta property="og:image:alt" content="{esc(og_alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
{"".join(f'  <link rel="preload" href="{f}" as="font" type="font/woff2" crossorigin>' + chr(10) for f in FONT_PRELOAD)}  <link rel="stylesheet" href="/css/style.css?v={ASSET_V["css/style.css"]}">
  <link rel="stylesheet" href="/css/ix-theme.css">{meta.get("head_extra", "")}
  <script type="application/ld+json">
{schema}
  </script>
  {TAGS}
</head>
<body{body_class}>
<a href="#main-content" class="skip-link">{t["skip"]}</a>
'''


# ---------------------------------------------------------------- reusable blocks
# "Rasējums" overlay on portfolio screenshots (js/ix-portfolio.js): element boxes read off each 960x600
# screenshot by eye, as left,top,width,height in % of the image. Labels only (nav / h1 / cta), no values.
PF_MARKS = {
    "tehnologijuakademija": "nav:0,0,100,6.5;h1:15,26.5,37,21.5;cta:15.4,57.5,34,6.5",
    "lazergriezeji": "nav:0,0,100,7;h1:4,24,46.5,45;cta:4.2,83.5,35,5.8",
    "cncfrezes": "nav:0,4,100,7;h1:31,31.5,38,20;cta:36.8,70,26.6,6",
    "3dpakalpojumi": "nav:0,0,100,7.5;h1:4.5,23,48,59;cta:4.5,94.5,33.5,5.5",
    "cncpakalpojumi": "nav:0,0,100,8;h1:10,15,38,29;cta:10,74,28,7.5",
    "bratus": "nav:0,0,100,12;cta:36,83.5,28,6.5",
    "ploteris": "nav:0,0,100,7.5;h1:4.5,35,50.5,35.5;cta:4.5,83,33,7",
    "maropro": "nav:0,0,100,10;h1:9.5,20,37.5,24;cta:9.5,58,33.5,7",
}


def project_card(key, lang):
    url, img, name, tags, metric = PROJECTS[key]
    t = T[lang]
    i = 0 if lang == "lv" else 1
    name = name[i] if isinstance(name, tuple) else name
    tag = tags[i]
    if isinstance(metric, tuple):
        mod = f" proof__metric--{metric[2]}" if len(metric) > 2 else ""
        big = metric[0][i] if isinstance(metric[0], tuple) else metric[0]
        if "since" in mod:
            big = big.replace(" ", "\u00a0")
        m = f'<span class="proof__metric{mod}">{big}<small>{metric[1][i]}</small></span>'
    else:
        m = f'<span class="proof__metric">{metric} {t["metric"]}<small>{t["metric_sub"]}</small></span>' if metric else ""
    if not url:
        return (f'<div class="proof proof--text"><span class="proof__name">{name}</span>'
                f'<span class="proof__tag">{tag}</span>{m}</div>')
    marks = f' data-pf-marks="{PF_MARKS[key]}"' if key in PF_MARKS else ""
    return (f'<div class="pf" data-pf{marks}><a class="proof" href="{url}" target="_blank" rel="noopener">'
            f'<span class="pf__frame"><span class="pf__stage"><img {img_attrs("/assets/images/" + img, (480,), 960, CARD_SIZES)} alt="{name} {t["shot_alt"]}" width="960" height="600" loading="lazy"></span></span>'
            f'<span class="proof__body"><span class="proof__name">{name}</span><span class="proof__tag">{tag}</span>{m}</span></a></div>')

def browser(key, lang, cls=""):
    url, img, name, *_ = PROJECTS[key]
    marks = f' data-pf-marks="{PF_MARKS[key]}"' if key in PF_MARKS else ""
    return (f'<figure class="shot pf {cls}" data-pf{marks}><span class="pf__frame"><span class="pf__stage"><img {img_attrs("/assets/images/" + img, (480,), 960, CARD_SIZES)} alt="{name} {T[lang]["shot_alt"]}" width="960" height="600"{" data-hero" if cls == "first" else " loading=\"lazy\""}></span></span>'
            f'<figcaption class="shot__cap">{name}</figcaption></figure>')


def hero_shot(key, caption, lang):
    url, img, name, *_ = PROJECTS[key]
    return (f'<figure class="hero-shot"><img {img_attrs("/assets/images/" + img, (480,), 960, CARD_SIZES)} alt="{name} {T[lang]["shot_alt"]}" width="960" height="600" data-hero>'
            f'<figcaption>{caption}</figcaption></figure>')


# ---------------------------------------------------------------- drawing ("rasējums") blocks
# The hero blueprint language reused around the site: grid paper, dashed outlines, green notes.
# Every number on a drawing is measured, never estimated. MEASURED = curl of the live homepage, 27.11.2026.
MEASURED = {"key": "3dpakalpojumi", "date": "27.11.2026", "title": 50, "h1": 1, "img": (5, 5),
            "schema": "Organization, FAQPage, Service"}

# Sketches shown over the sheet by js/ix-form.js when the "need" select changes (hidden until then; no numbers).
DRAWING = ('<svg class="after__draw" viewBox="0 0 160 100" hidden focusable="false">'
           '<g data-m="web"><rect x="10" y="8" width="140" height="84"/><path d="M10 20H150"/><path d="M16 14h22"/>'
           '<rect x="16" y="26" width="128" height="30"/><path d="M16 26l128 30M144 26L16 56"/>'
           '<rect x="16" y="62" width="38" height="24"/><rect x="61" y="62" width="38" height="24"/><rect x="106" y="62" width="38" height="24"/></g>'
           '<g data-m="seo"><path class="s" d="M18 10V86H148"/><path d="M18 62H148M18 38H148" class="g"/>'
           '<path class="a" d="M22 80L50 70L74 74L100 48L124 38L146 18"/><rect class="p" x="143" y="15" width="6" height="6"/></g>'
           '<g data-m="audit"><rect x="26" y="8" width="70" height="84"/><path d="M34 22h40M34 32h54M34 42h48M34 52h54M34 62h30"/>'
           '<circle class="a" cx="102" cy="58" r="22"/><path class="a" d="M118 74L144 92"/></g>'
           '<g data-m="other"><rect x="26" y="24" width="108" height="60"/><path d="M26 14H134M26 10v8M134 10v8"/>'
           '<path d="M14 24V84M10 24h8M10 84h8"/><path d="M26 92H134" class="g"/></g></svg>')

AFTER = {
    "lv": dict(
        draw=["Ilustrācija: jaunas mājaslapas rasējums — struktūra pirms dizaina.",
              "Ilustrācija: SEO esošai mājaslapai — mērķis ir augoša līkne, skaitļi nav solīti.",
              "Ilustrācija: audits — lupa uz lapu.",
              "Ilustrācija: tukša lapa ar izmēru līnijām — pastāstiet, ko vēlaties."],
        title="Kas notiek pēc pieteikuma",
        web=[("Atbilde 24 stundu laikā", "Ar pirmajiem ieteikumiem vai aicinājumu uz īsu sarunu."),
             ("Īsa saruna", "Precizējam vajadzības, apjomu un termiņu."),
             ("Precīza cena", "Precīzu summu nosūtu pēc sarunas vai audita.")],
        audit=[("Video audits 24 stundu laikā", "Ekrāna ieraksts ar Jūsu mājaslapas galvenajām kļūdām un ieteikumiem."),
               ("Īsa saruna", "Ja vēlaties turpināt, izrunājam, ko darīt vispirms."),
               ("Precīza cena", "Precīzu summu nosūtu pēc sarunas vai audita.")],
        notes=("<title> · {title} zīmes", "<h1> · {h1} lapā", "JSON-LD: {schema}"),
        cap="{name}, sākumlapa. Mērīts {date}: {a} no {b} attēliem ar alt tekstu.",
        ask=("Jautājiet tieši", "Nav atbildes? Jautājiet tieši", "Adrians Stankevičs, LatSEO", "Tālrunis", "Rakstīt"),
        next_web=("Nākamā vieta — Jūsu lapa", "Aprēķināt cenu kalkulatorā"),
        next_post=("Jautājums bez raksta?", "Uzrakstiet, un atbildēšu", "/kontakti/"),
        sheet=("ekrānšāviņš 16:10", "<h1>", "klikšķi no Google"),
        sheet_post=("vāks 1200 × 630", "<h1>", "Jūsu jautājums"),
    ),
    "en": dict(
        draw=["Illustration: a new website drawing — structure before design.",
              "Illustration: SEO for an existing website — the goal is a rising line, no figures promised.",
              "Illustration: an audit — a magnifier over a page.",
              "Illustration: a blank page with dimension lines — tell me what you need."],
        title="What happens after you send it",
        web=[("Reply within 24 hours", "With first recommendations or an invitation to a short call."),
             ("A short call", "We clarify your needs, scope and timeline."),
             ("Exact price", "I send the exact amount after a call or an audit.")],
        audit=[("Video audit within 24 hours", "A screen recording with your website's main errors and recommendations."),
               ("A short call", "If you want to continue, we discuss what to do first."),
               ("Exact price", "I send the exact amount after a call or an audit.")],
        notes=("<title> · {title} characters", "<h1> · {h1} per page", "JSON-LD: {schema}"),
        cap="{name}, homepage. Measured {date}: {a} of {b} images have alt text.",
        ask=("Ask directly", "No answer here? Ask me directly", "Adrians Stankevičs, LatSEO", "Phone", "Write"),
        next_web=("Next spot — your website", "Calculate the price"),
        next_post=("A question with no article yet?", "Write to me and I will answer", "/en/kontakti/"),
        sheet=("screenshot 16:10", "<h1>", "clicks from Google"),
        sheet_post=("cover 1200 × 630", "<h1>", "your question"),
    ),
}


def after_form(variant, lang):
    """Left column under a contact form: the next steps promised elsewhere on the site + one measured drawing of a project."""
    a = AFTER[lang]
    steps = "".join(f"<li><strong>{esc(t)}</strong>{esc(x)}</li>" for t, x in a[variant])
    m = MEASURED
    url, img, name, *_ = PROJECTS[m["key"]]
    n1, n2, n3 = (esc(n.format(**m)) for n in a["notes"])
    cap = esc(a["cap"].format(name=name, date=m["date"], a=m["img"][0], b=m["img"][1]))
    draw = esc(json.dumps(a["draw"], ensure_ascii=False))
    return (f'<link rel="stylesheet" href="/css/ix-form.css"><script src="/js/ix-form.js" defer></script>'
            f'<div class="after" data-nosnippet><p class="after__title">{esc(a["title"])}</p><ol class="after__steps">{steps}</ol>'
            f'<figure class="after__sheet sheet" aria-hidden="true" data-m="web" data-draw="{draw}"><div class="sheet__shot">'
            f'<img src="/assets/images/{img.replace(".webp", "-480.webp")}" alt="" width="480" height="300" loading="lazy">'
            f'<span class="plan__box" style="left:4%;top:21%;width:48%;height:63%"></span>'
            f'<span class="plan__note" style="left:3%;top:3%">{n1}</span>'
            f'<span class="plan__note" style="left:5%;top:max(calc(3% + 1.55rem),calc(21% - 1.6rem))">{n2}</span>'
            f'<span class="plan__note" style="right:3%;bottom:6%">{n3}</span>{DRAWING}</div>'
            f'<figcaption>{cap}</figcaption></figure></div>'
            # the full sheet when the column beside the form has room; otherwise the compact sketch (a short strip),
            # dropped only if even that would run far past the form. One column (phones): always the compact sketch.
            '<script>(function(a){var s=a.querySelector(".after__sheet");'
            'function fit(){var f=a.closest(".two-col"),p=f&&f.querySelector(".form-panel");if(!p||!s)return;s.hidden=false;s.classList.remove("after__sheet--sm");function o(){return a.getBoundingClientRect().bottom-p.getBoundingClientRect().bottom}'
            'if(matchMedia("(max-width:899px)").matches)s.classList.add("after__sheet--sm");else if(o()>8){s.classList.add("after__sheet--sm");if(o()>120)s.hidden=true}s.dispatchEvent(new Event("ix-fit"))}'
            'document.addEventListener("DOMContentLoaded",fit);addEventListener("load",fit);addEventListener("resize",fit)})(document.currentScript.previousElementSibling)</script>')


def ask_aside(lang):
    """Sticky card next to a FAQ: the person who answers, phone and WhatsApp."""
    label, title, who, phone, write = AFTER[lang]["ask"]
    return (f'<aside class="ask" aria-label="{label}" data-nosnippet><div class="ask__in sheet">'
            f'<img src="{PHOTO}" alt="" width="72" height="72" loading="lazy">'
            f'<p class="ask__title">{title}</p><p class="ask__who">{who}</p>'
            f'<a class="ask__link" href="tel:{PHONE}"><span>{phone}</span><strong>{PHONE_H}</strong></a>'
            f'<a class="ask__link" href="https://wa.me/37124424434" target="_blank" rel="noopener"><span>WhatsApp</span><strong>{write}</strong></a>'
            f'</div></aside>')


def blank_sheet(lang, ratio, labels="sheet"):
    """An empty drawing: dashed frame and labels, no content."""
    s1, s2, s3 = (esc(x) for x in AFTER[lang][labels])
    return (f'<span class="sheet sheet--blank" style="aspect-ratio:{ratio}" aria-hidden="true">'
            f'<span class="plan__note" style="left:6%;top:8%">{s1}</span>'
            f'<span class="plan__box" style="left:8%;top:34%;width:58%;height:26%"></span>'
            f'<span class="plan__note" style="left:8%;top:calc(34% - 1.6rem)">{s2}</span>'
            f'<span class="plan__note" style="right:6%;bottom:8%">{s3}</span></span>')


def next_spot(lang):
    """Last cell of a project grid. CSS shows it only while the last row is incomplete."""
    t = T[lang]
    name, more = AFTER[lang]["next_web"]
    return (f'<a class="proof proof--next" href="{t["calc"]}" data-nosnippet>{blank_sheet(lang, "16/10")}'
            f'<span class="proof__body"><span class="proof__name">{esc(name)}</span>'
            f'<span class="post-item__more">{esc(more)}</span></span></a>')


def next_post(lang):
    """Last cell of the blog index grid, shown only while the last row is incomplete."""
    title, more, href = AFTER[lang]["next_post"]
    return (f'<a class="post-item post-item--next" href="{href}" data-nosnippet>{blank_sheet(lang, "1200/630", "sheet_post")}'
            f'<span class="post-item__body"><span class="post-item__title">{esc(title)}</span>'
            f'<span class="post-item__more">{esc(more)}</span></span></a>')


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
<button type="submit" class="contact-form__submit">{button or t["f_send"]}</button>
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


# ---------------------------------------------------------------- Search Console chart ({{gsc:hero}}, {{gsc:trend}})
# latseo.com weekly impressions from assets/data/latseo-gsc-weekly.json, full weeks only (16.02.–16.11.2026, 40 weeks).
# Drawn at build time as an SVG with real axes (thousands, months), so it reads without JS. js/hero-plan.js (3D x-ray)
# and js/ix-home.js (week scrubber) read the same numbers from data-v.
GSC_MONTHS = {"lv": ["janv.", "febr.", "marts", "apr.", "maijs", "jūn.", "jūl.", "aug.", "sept.", "okt.", "nov.", "dec."],
              "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
GSC_YMAX, GSC_TICKS = 3500, (0, 1000, 2000, 3000)


def gsc_weeks():
    data = json.loads((ROOT / "assets/data/latseo-gsc-weekly.json").read_text())
    return [(dt.date.fromisoformat(w["week_start"]), w["impressions"]) for w in data["weeks"] if w["days"] == 7]


def _monotone(pts):
    """Fritsch-Carlson monotone cubic through pts -> SVG path (never overshoots below zero)."""
    n = len(pts)
    d = [(pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]) for i in range(n - 1)]
    m = [d[0]] + [0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2 for i in range(1, n - 1)] + [d[-1]]
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0
            continue
        a, b = m[i] / d[i], m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            t = 3 / s ** .5
            m[i], m[i + 1] = t * a * d[i], t * b * d[i]
    f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
    out = [f"M{f(pts[0][0])} {f(pts[0][1])}"]
    for i in range(n - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        h = (x1 - x0) / 3
        out.append(f"C{f(x0 + h)} {f(y0 + m[i] * h)} {f(x1 - h)} {f(y1 - m[i + 1] * h)} {f(x1)} {f(y1)}")
    return "".join(out)


def gsc_chart(kind, lang):
    weeks = gsc_weeks()
    n, start, end = len(weeks), weeks[0][0], weeks[-1][0]
    span = (end - start).days
    W, H = 1000, 300
    pts = [(i * W / (n - 1), H - v / GSC_YMAX * H) for i, (_, v) in enumerate(weeks)]
    line = _monotone(pts)
    area = line + f"L{W} {H}L0 {H}Z"
    grid = "".join(f"M0 {H - t / GSC_YMAX * H:.1f}H{W}" for t in GSC_TICKS[1:])
    thou = (lambda v: f"{v:,}".replace(",", " ")) if lang == "en" else (lambda v: f"{v:,}".replace(",", " "))
    unit = "rādījumi nedēļā" if lang == "lv" else "impressions per week"
    ys = "".join(f'<span class="gsc__y" style="bottom:{t / GSC_YMAX * 100:.2f}%">{thou(t)}'
                 f'{f" <i>{unit}</i>" if t == GSC_TICKS[-1] else ""}</span>' for t in GSC_TICKS)
    xs = []
    for mth in range(start.month + 1, end.month + 1):
        d = dt.date(start.year, mth, 1)
        xs.append(f'<span class="gsc__m" style="left:{(d - start).days / span * 100:.2f}%">{GSC_MONTHS[lang][mth - 1]}</span>')
    peak_i = max(range(n), key=lambda i: weeks[i][1])
    pv, pd = weeks[peak_i][1], weeks[peak_i][0]
    pdate = f"{pd.day:02d}.{pd.month:02d}." if lang == "lv" else f"{pd.day} {GSC_MONTHS['en'][pd.month - 1]}"
    vals = ",".join(str(v) for _, v in weeks)
    svg = (f'<svg class="gsc__svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
           f'<path class="gsc__grid" d="{grid}"/><path class="gsc__area" d="{area}"/>'
           f'<path class="gsc__line" d="{line}"/></svg>')
    return (f'<div class="gsc gsc--{kind}" aria-hidden="true" data-v="{vals}" data-start="{start.isoformat()}" data-ymax="{GSC_YMAX}">'
            f'<div class="gsc__plot">{svg}{ys}'
            f'<span class="gsc__peak" style="left:{peak_i / (n - 1) * 100:.2f}%;bottom:{pv / GSC_YMAX * 100:.2f}%">'
            f'<b>{thou(pv)}</b><small>{pdate}</small></span></div>'
            f'<div class="gsc__x" aria-hidden="true">{"".join(xs)}</div></div>')


def expand_tokens(body, lang):
    body = re.sub(r"\{\{gsc:(hero|trend)\}\}", lambda m: gsc_chart(m.group(1), lang), body)
    body = re.sub(r"\{\{project:(\w+)\}\}", lambda m: project_card(m.group(1), lang), body)
    body = re.sub(r"\{\{after:(web|audit)\}\}", lambda m: after_form(m.group(1), lang), body)
    body = body.replace("{{ask}}", ask_aside(lang)).replace("{{next-spot}}", next_spot(lang))
    first = {"done": False}
    def _browser(m):
        cls = "" if first["done"] else "first"
        first["done"] = True
        return browser(m.group(1), lang, cls)
    body = re.sub(r"\{\{browser:(\w+)\}\}", _browser, body)
    body = re.sub(r"\{\{shot:(\w+)\|(.*?)\}\}", lambda m: hero_shot(m.group(1), m.group(2), lang), body)
    body = re.sub(r"\{\{form:([\w-]+)\|([^|}]+)(?:\|([^|}]+))?(?:\|([^|}]+))?\}\}",
                  lambda m: form(m.group(1), m.group(2), lang, m.group(3), m.group(4)), body)
    body = label_tables(body)
    for k, v in {" {{arrow}}": ARROW, "{{arrow}}": ARROW, "{{phone}}": PHONE, "{{phone_h}}": PHONE_H, "{{email}}": EMAIL,
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
    hero = re.search(r'<img ([^>]*?) data-hero', body)
    if hero:
        a = dict(re.findall(r'(\w+)="([^"]*)"', hero.group(1)))
        extra = (f' imagesrcset="{a["srcset"]}" imagesizes="{a["sizes"]}"' if a.get("srcset") else "")
        meta["head_extra"] = meta.get("head_extra", "") + (
            f'\n  <link rel="preload" as="image" href="{a["src"]}"{extra} media="(min-width: 1001px)" fetchpriority="high">')
        body = body.replace(" data-hero", "", 1)
    body = body.replace(" data-hero", ' loading="lazy"')
    hdr = header(meta) if meta.get("chrome", "full") == "full" else landing_header(meta)
    if 'hero--plan' in body:   # homepage hero (js/hero-plan.js): its styles, incl. the optional 3D layer
        meta["head_extra"] = meta.get("head_extra", "") + '\n  <link rel="stylesheet" href="/css/ix-hero.css">'
    scripts = (f'<script src="/js/main.js?v={ASSET_V["js/main.js"]}" defer></script>'
               '<script src="/js/ix-theme.js" defer></script>' + meta.get("scripts", ""))
    page = head(meta, graph) + hdr + '\n<main id="main-content">\n' + body.strip() + "\n</main>\n" + footer(lang) + "\n" + scripts + "\n</body>\n</html>\n"
    page = defer_ix_css(bust_assets(page))
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
    return (f'<a class="post-item{" post-item--feature" if feature else ""}" href="{p["path"]}">'
            f'<img class="post-item__cover" {img_attrs(cover_of(p), (640,), 1200, CARD_SIZES)} alt="" width="1200" height="630" loading="lazy">'
            f'<span class="post-item__body"><span class="post-item__meta">{esc(p["category"])} · {fmt_date(p["date"], p["lang"])}</span>'
            f'<span class="post-item__title">{p["h1"]}</span><span class="post-item__excerpt">{esc(p["description"])}</span>'
            f'<span class="post-item__more">{t["read_more"]}</span></span></a>')


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
    dmod = max(m["date"], m.get("modified") or m["date"])
    upd = f'<span>{t["updated"]}: <time datetime="{dmod}">{fmt_date(dmod, lang)}</time></span>' if dmod != m["date"] else ""
    about_href, about_txt = t["about_link"]
    m["body"] = f'''<article>
<header class="article-head container">
  {{{{breadcrumbs}}}}
  <h1>{m["h1"]}</h1>
  <p class="article-meta"><span>{esc(m["category"])}</span><span>{t["author"]}: <a href="{about_href}">Adrians Stankevičs</a></span><span>{t["published"]}: <time datetime="{m["date"]}">{fmt_date(m["date"], lang)}</time></span>{upd}<span>{mins} {t["read"]}</span></p>
</header>
<div class="container"><img class="article-cover" {img_attrs(cover, (640,), 1200, WIDE_SIZES)} alt="{esc(strip_tags(m["h1"]))}" width="1200" height="630" fetchpriority="high"></div>
<div class="container article-layout">
  <div class="article-body">
{body.strip()}
    <div class="author-box"><img src="{PHOTO}" alt="Adrians Stankevičs" width="64" height="64" loading="lazy"><div><strong>Adrians Stankevičs</strong><p>{t["bio"]} <a href="{about_href}">{about_txt}</a> · <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></p></div></div>
  </div>
  <aside class="article-aside" aria-label="{t["aside_aria"]}">
    {f'<div class="aside-block"><p class="aside-block__title">{t["toc"]}</p><ol class="toc">{toc}</ol></div>' if len(heads) > 2 else ""}
    <div class="aside-block aside-block--ink"><p class="aside-block__title">{title}</p><p>{text}</p><a class="btn btn--primary" href="{href}">{btn}</a></div>
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
    cards = post_card(posts[0], True) + "".join(post_card(p) for p in posts[1:]) + next_post(lang)
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
    listing = "\n".join(f'{p["path"]}|{p["h1"]}|{p["description"]}|{p["date"]}' for p in posts)
    meta["modified"] = content_lastmod(t["blog"], "\n".join([t["blog_title"], t["blog_desc"], t["blog_lead"], listing]),
                                       max(p["date"] for p in posts))
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
        path = can.group(1)[len(SITE):]
        if path not in LASTMOD:
            raise SystemExit(f"{path}: no lastmod (page not built from _src?)")
        urls.append((can.group(1), alts, LASTMOD[path]["lastmod"]))

    def order(u):        # home, main service pages, LV, then EN
        return (u != SITE + "/", "/en/" in u, "/blogs/" in u, u)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u, alts, mod in sorted(urls, key=lambda x: order(x[0])):
        lines.append(f"  <url>\n    <loc>{u}</loc>")
        lines += [f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{h}"/>' for hl, h in alts]
        lines.append(f"    <lastmod>{mod}</lastmod>\n  </url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(urls)


def main():
    built = write_redirects()
    for lang, base in (("lv", SRC), ("en", SRC / "en")):
        for src in sorted((base / "pages").glob("*.html")):
            m = read_source(src, lang)
            m["modified"] = page_lastmod(m)
            built.append(render(m, faq_schema(m["body"])))
        posts = [read_source(p, lang) for p in sorted((base / "blog").glob("*.html"))]
        for p in posts:
            p["modified"] = page_lastmod(p)
        posts.sort(key=lambda m: m["date"], reverse=True)
        for p in posts:
            built.append(render_post(p, posts))
        if posts:
            built.append(render_blog_index(posts, lang))
    n = write_sitemap()
    write_lastmod()
    for f in built:
        print("  built", f.relative_to(ROOT))
    print(f"{len(built)} pages, sitemap {n} URLs")


if __name__ == "__main__":
    main()
