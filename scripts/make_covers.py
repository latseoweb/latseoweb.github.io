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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:Inter,sans-serif;background:%(bg)s;color:%(fg)s;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(%(line)s 1px,transparent 1px),linear-gradient(90deg,%(line)s 1px,transparent 1px);background-size:60px 60px;opacity:.55}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:#2E6A4E}
.wrap{position:absolute;left:92px;right:92px;top:78px;bottom:70px;display:flex;flex-direction:column}
.tag{align-self:flex-start;font-weight:600;font-size:22px;letter-spacing:.08em;text-transform:uppercase;color:%(tag)s;border:1.5px solid %(tag)s;border-radius:999px;padding:8px 18px}
h1{font-family:"Plus Jakarta Sans",sans-serif;font-weight:700;font-size:%(size)spx;line-height:1.08;letter-spacing:-.03em;margin-top:42px;max-width:960px}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:22px;color:%(muted)s}
.brand{display:flex;align-items:center;gap:14px;font-family:"Plus Jakarta Sans";font-weight:700;font-size:28px;color:%(fg)s;letter-spacing:.06em}
.dot{width:16px;height:16px;border-radius:50%%;background:#2E6A4E}
</style></head><body><div class="grid"></div><div class="bar"></div>
<div class="wrap"><span class="tag">%(tag_text)s</span><h1>%(title)s</h1>
<div class="foot"><span class="brand"><span class="dot"></span>LATSEO</span><span>%(sub)s</span></div></div></body></html>"""

THEMES = [
    dict(bg="#F6F4EE", fg="#17140F", line="#E6E1D5", tag="#2E6A4E", muted="#6B6357"),
    dict(bg="#17140F", fg="#F3F0E8", line="#25211A", tag="#9FCDB3", muted="#B5AE9F"),
    dict(bg="#E3EDE6", fg="#17140F", line="#D3E1D7", tag="#1C4733", muted="#3A342B"),
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
