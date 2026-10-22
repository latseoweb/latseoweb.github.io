#!/usr/bin/env python3
"""Copy the header and footer from index.html (between SITE-HEADER / SITE-FOOTER markers)
to every Latvian page, and apply shared fixes (logo, fonts, og:image, main.js defer).
Run from the repo root:  python3 scripts/apply_site_chrome.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {"index.html", "bezmaksas-audits/index.html", "paldies/index.html"}

home = (ROOT / "index.html").read_text(encoding="utf-8")
HEADER = re.search(r"<!-- SITE-HEADER:START -->.*?<!-- SITE-HEADER:END -->", home, re.S).group(0)
FOOTER = re.search(r"<!-- SITE-FOOTER:START -->.*?<!-- SITE-FOOTER:END -->", home, re.S).group(0)

FONTS_OLD = re.compile(r'<link href="(https://fonts\.googleapis\.com/css2\?[^"]+)" rel="stylesheet">')
FONTS_NEW = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" media="print" onload="this.media=\'all\'">'
             '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap"></noscript>')


def header_for(page_url, en_url):
    h = HEADER
    h = h.replace('<a href="/" class="header__lang-btn header__lang-btn--active" aria-current="page">LV</a>',
                  f'<a href="{page_url}" class="header__lang-btn header__lang-btn--active" aria-current="page">LV</a>')
    h = h.replace('<a href="/" class="header__lang-btn header__lang-btn--active">LV</a>',
                  f'<a href="{page_url}" class="header__lang-btn header__lang-btn--active">LV</a>')
    h = h.replace('<a href="/en/" class="header__lang-btn" hreflang="en" lang="en">EN</a>',
                  f'<a href="{en_url}" class="header__lang-btn" hreflang="en" lang="en">EN</a>')
    return h


def process(path):
    rel = path.relative_to(ROOT).as_posix()
    s = path.read_text(encoding="utf-8")
    orig = s
    page_url = "/" + rel[: -len("index.html")]
    m = re.search(r'<link rel="alternate" hreflang="en" href="https://latseo\.com(/[^"]*)"', s)
    en_url = m.group(1) if m and (ROOT / m.group(1).lstrip("/") / "index.html").exists() else "/en/"

    s = re.sub(r'(?:<!-- =+\s*HEADER[^>]*-->\s*)?<header class="site-header".*?</header>',
               lambda _: header_for(page_url, en_url), s, count=1, flags=re.S)
    s = re.sub(r'(?:<!-- =+\s*FOOTER[^>]*-->\s*)?<footer class="site-footer".*?</footer>',
               lambda _: FOOTER, s, count=1, flags=re.S)
    s = re.sub(r'\s*<link rel="icon" type="image/png" sizes="32x32" href="[^"]*LatSEO%20logo%20black\.png">', "", s)
    s = s.replace("/assets/images/LatSEO%20logo%20black.png", "/assets/images/latseo-logo.png")
    s = s.replace("https://latseo.com/wp-content/uploads/2026/02/SEO-photo-in-office.jpeg",
                  "https://latseo.com/assets/images/og-latseo.jpg")
    s = s.replace("https://latseo.com/#organization", "https://latseo.com/#org")
    s = re.sub(r'"logo":\s*"/assets/images/latseo-logo\.png"', '"logo": "https://latseo.com/assets/images/latseo-logo.png"', s)
    s = FONTS_OLD.sub(lambda _: FONTS_NEW, s)
    s = re.sub(r'<script src="(?:\.\./)+js/main\.js"></script>', '<script src="/js/main.js" defer></script>', s)
    s = re.sub(r'href="(?:\.\./)+css/style\.css"', 'href="/css/style.css"', s)

    if s != orig:
        path.write_text(s, encoding="utf-8")
        return True
    return False


changed = []
for p in sorted(ROOT.rglob("index.html")):
    rel = p.relative_to(ROOT).as_posix()
    if rel.startswith(("en/", ".git/")) or rel in SKIP:
        continue
    if process(p):
        changed.append(rel)
print(f"{len(changed)} pages updated")
for c in changed:
    print("  ", c)
