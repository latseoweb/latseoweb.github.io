#!/usr/bin/env python3
"""Render 1200x630 cover/OG images for blog posts (assets/covers/<slug>.jpg) and the site OG image.
Needs Playwright:  ~/.local/share/claude-seo/.venv/bin/python scripts/make_covers.py
"""
import html, json, pathlib, re, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "covers"
OUT.mkdir(parents=True, exist_ok=True)

TPL = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Schibsted+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:"IBM Plex Mono",monospace;background:%(bg)s;color:%(fg)s;position:relative;overflow:hidden}
.wrap{position:absolute;left:80px;right:80px;top:72px;bottom:64px;display:flex;flex-direction:column}
.tag{font-size:22px;letter-spacing:.02em;color:%(tag)s;padding-bottom:22px;border-bottom:2px solid %(line)s}
h1{font-family:"Schibsted Grotesk",sans-serif;font-weight:700;font-size:%(size)spx;line-height:1.06;letter-spacing:-.03em;margin-top:44px;max-width:1000px}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:21px;color:%(muted)s;padding-top:22px;border-top:2px solid %(line)s}
.brand{font-family:"Schibsted Grotesk",sans-serif;font-weight:700;font-size:28px;color:%(fg)s;letter-spacing:.04em}
</style></head><body>
<div class="wrap"><span class="tag">%(tag_text)s</span><h1>%(title)s</h1>
<div class="foot"><span class="brand">LATSEO</span><span>%(sub)s</span></div></div></body></html>"""

THEMES = [
    dict(bg="#FFFFFF", fg="#121614", line="#121614", tag="#1F6045", muted="#5A6560"),
    dict(bg="#121614", fg="#F1F4F2", line="#3A433E", tag="#9CC9B0", muted="#AEB8B3"),
    dict(bg="#F1F3F2", fg="#121614", line="#B7C0BB", tag="#153E2D", muted="#2D3430"),
]


def meta(p):
    m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->", p.read_text(encoding="utf-8"), re.S)
    return json.loads(m.group(1))


def render(page, title, tag, sub, out, theme):
    t = re.sub(r"<[^>]+>", "", title)
    size = 74 if len(t) < 38 else 64 if len(t) < 56 else 56
    page.set_content(TPL % dict(theme, title=html.escape(t), tag_text=html.escape(tag), sub=html.escape(sub), size=size))
    page.wait_for_timeout(600)
    png = pathlib.Path(tempfile.mkstemp(suffix=".png")[1])
    page.screenshot(path=str(png))
    subprocess.run(["magick", str(png), "-quality", "82", "-strip", str(out)], check=True)
    png.unlink()


with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={"width": 1200, "height": 630})
    posts = sorted((ROOT / "_src" / "blog").glob("*.html")) + sorted((ROOT / "_src" / "en" / "blog").glob("*.html"))
    for i, p in enumerate(posts):
        m = meta(p)
        slug = m["path"].strip("/").split("/")[-1]
        if len(sys.argv) > 1 and slug not in sys.argv[1:]:
            continue
        render(page, m["h1"], m["category"], "Adrians Stankevičs · latseo.com", OUT / f"{slug}.jpg", THEMES[i % 3])
        print("cover", slug)
    if len(sys.argv) == 1:
        render(page, "Mājaslapu izstrāde ar iebūvētu SEO", "Rīga · Latvija", "Mājaslapas no 449 € · SEO no 300 €/mēn.",
               ROOT / "assets" / "images" / "og-latseo.jpg", THEMES[1])
        print("og image")
    b.close()
