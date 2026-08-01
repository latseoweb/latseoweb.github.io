#!/usr/bin/env python3
"""
Daily Blog Post Generator for LatSEO
=====================================
Generates a new SEO blog post every day based on the 52-week content plan.
Uses OpenAI API for content generation in both Latvian and English.
Runs via GitHub Actions on a cron schedule — no computer needed.

Required GitHub Secrets:
  - OPENAI_API_KEY: Your OpenAI API key

Usage:
  python scripts/generate_post.py          # Generate today's post
  python scripts/generate_post.py --dry-run  # Preview without saving
  python scripts/generate_post.py --date 2026-08-15  # Generate for specific date
  python scripts/generate_post.py --day 42  # Generate specific day number
"""

import json
import os
import sys
import re
import argparse
from datetime import date
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
TOPICS_FILE = PROJECT_ROOT / "scripts" / "topics.json"
PROGRESS_FILE = PROJECT_ROOT / "scripts" / ".blog-progress.json"
BLOGS_DIR_LV = PROJECT_ROOT / "blogs"
BLOGS_DIR_EN = PROJECT_ROOT / "en" / "blogs"
BLOG_INDEX_LV = BLOGS_DIR_LV / "index.html"
BLOG_INDEX_EN = BLOGS_DIR_EN / "index.html"
SITEMAP_FILE = PROJECT_ROOT / "sitemap.xml"

# SEO metadata
SITE_URL = "https://latseo.com"
AUTHOR_NAME = "Adrians Stankevičs"
AUTHOR_NAME_EN = "Adrians Stankevics"
COMPANY = "Baltic SEO, SIA"
GTAG_ID = "G-MF7Q1R9722"
GTAG_AW = "AW-18351772465"

# ── AI API Configuration ────────────────────────────────────────────────────
# Uses DEEPSEEK_API_KEY from environment (set in GitHub Secrets)
# DeepSeek is OpenAI-compatible — we use the same `openai` package
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"  # ~$0.27 per 1M input tokens — extremely cheap


# ── Helper Functions ─────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def slugify(text: str) -> str:
    """Convert Latvian/English text to URL-friendly slug."""
    text = text.lower().strip()
    # Transliterate Latvian characters
    replacements = {
        "ā": "a", "č": "c", "ē": "e", "ģ": "g", "ī": "i",
        "ķ": "k", "ļ": "l", "ņ": "n", "š": "s", "ū": "u", "ž": "z",
        "Ā": "a", "Č": "c", "Ē": "e", "Ģ": "g", "Ī": "i",
        "Ķ": "k", "Ļ": "l", "Ņ": "n", "Š": "s", "Ū": "u", "Ž": "z",
    }
    for lv, en in replacements.items():
        text = text.replace(lv, en)
    # Remove special chars, keep alphanumeric and hyphens
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def get_today_lv() -> str:
    """Get today's date in Latvian format."""
    months = [
        "janvāris", "februāris", "marts", "aprīlis", "maijs", "jūnijs",
        "jūlijs", "augusts", "septembris", "oktobris", "novembris", "decembris"
    ]
    today = date.today()
    return f"{today.year}. gada {today.day}. {months[today.month - 1]}"


def get_today_en() -> str:
    """Get today's date in English format."""
    today = date.today()
    return today.strftime("%B %d, %Y")


def load_progress() -> dict:
    """Load or initialize the progress tracking file."""
    if PROGRESS_FILE.exists():
        return load_json(PROGRESS_FILE)
    return {"lastPublishedDay": 0, "lastPublishedDate": None, "publishedPosts": []}


def save_progress(progress: dict):
    save_json(PROGRESS_FILE, progress)


def get_day_info(day_number: int) -> dict:
    """Get the topic info for a specific day (1-365)."""
    topics_data = load_json(TOPICS_FILE)

    # Day 365 is the bonus day
    if day_number == 365:
        bonus = topics_data["bonusDay365"]
        return {
            "day": 365,
            "week": "Bonuss",
            "quarter": "Bonuss",
            "theme": bonus["theme"],
            "themeSlug": bonus["themeSlug"],
            "category": bonus["category"],
            "topicTitle": bonus["theme"],
            "topicSlug": bonus["themeSlug"],
            "format": "Gada atskats",
            "style": "Pārskats / Year in review",
        }

    # Calculate week and day of week (1-7)
    week_idx = (day_number - 1) // 7  # 0-based week index
    day_of_week = ((day_number - 1) % 7) + 1  # 1-7

    if week_idx >= len(topics_data["weeks"]):
        raise ValueError(f"Day {day_number} exceeds available topics ({len(topics_data['weeks']) * 7} days)")

    week_data = topics_data["weeks"][week_idx]
    format_data = topics_data["meta"]["dailyFormats"][str(day_of_week)]
    topic_title = week_data["topics"][day_of_week - 1]

    # Derive slug from the topic title (first part)
    slug_base = slugify(topic_title[:60])

    return {
        "day": day_number,
        "week": week_data["week"],
        "quarter": week_data["quarter"],
        "theme": week_data["theme"],
        "themeSlug": week_data["themeSlug"],
        "category": week_data["category"],
        "topicTitle": topic_title,
        "topicSlug": slug_base,
        "dayOfWeek": day_of_week,
        "dayNameLV": format_data["dayName"],
        "formatLV": format_data["format"],
        "styleLV": format_data["style"],
    }


def generate_content_with_ai(topic_info: dict, lang: str = "lv") -> dict:
    """
    Generate blog post content using OpenAI API.
    Returns dict with: title, metaDescription, content (HTML), imageDescription
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY environment variable not set. Add it to GitHub Secrets.")

    try:
        from openai import OpenAI
    except ImportError:
        print("Installing openai package...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "openai"])
        from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)

    # ── Build the prompt based on language ──────────────────────────────────
    if lang == "lv":
        system_prompt = """Tu esi latviešu SEO eksperts un satura veidotājs ar dziļām zināšanām par SEO, digitālo mārketingu un mājaslapu izstrādi Latvijas tirgū. Tu raksti LatSEO aģentūras blogam (https://latseo.com).

Tavs rakstīšanas stils:
- Profesionāls, bet sarunvalodas tonis — kā runātu ar kolēģi pie kafijas
- Izmanto reālus piemērus no Latvijas tirgus (Rīga, reģioni, Latvijas uzņēmumi)
- Vienmēr iekļauj iekšējās saites uz citiem LatSEO pakalpojumiem
- Raksti 600-1000 vārdu garumā latviešu valodā
- Strukturē ar H2 un H3 virsrakstiem, sarakstiem (ul/li) un īsām rindkopām
- Iekļauj vismaz 2-3 iekšējās saites uz: /lokalais-seo/, /tehniskais-seo/, /satura-strategija/, /majaslapas-izstrade/, /pakalpojumi-un-cenas/, /saisu-veidosana/, /kontakti/
- Beigās iekļauj CTA (call-to-action) uz /kontakti/ vai /pakalpojumi-un-cenas/
- NELIETO Markdown formatting - izmanto tikai HTML tagus (p, h2, h3, ul, li, strong, em, a)

Svarīgi: Atgriez TIKAI derīgu JSON ar šādiem laukiem:
{
  "title": "Raksta virsraksts (50-70 zīmes)",
  "metaDescription": "Meta apraksts (140-160 zīmes) ar atslēgvārdiem",
  "content": "<h2>...</h2><p>...</p>... (tīrs HTML, bez Markdown)",
  "imageQuery": "Īss attēla apraksts priekš Pexels/Unsplash meklēšanas (angliski, 3-5 vārdi)"
}"""

        user_prompt = f"""Uzraksti SEO bloga rakstu latviešu valodā.

KONTEKSTS:
- Nedēļas tēma: {topic_info['theme']}
- Dienas formāts: {topic_info['styleLV']}
- Dienas tēmas virsraksts: {topic_info['topicTitle']}
- Kategorija: {topic_info['category']}
- Dienas numurs no 365: {topic_info['day']}
- Publicēšanas datums: {get_today_lv()}

Rakstam jābūt:
- ~600-1000 vārdu
- Ar iekšējām saitēm uz LatSEO pakalpojumiem
- Ar CTA beigās, kas aicina sazināties vai pieteikties bezmaksas SEO auditam
- Izmantot tikai HTML tagus (bez Markdown)
- Rakstīt latviski, ar Latvijas tirgus piemēriem

Atgriez tikai JSON."""

    else:  # English
        system_prompt = """You are an SEO expert and content creator with deep knowledge of SEO, digital marketing, and web development. You write for the LatSEO agency blog (https://latseo.com/en/).

Your writing style:
- Professional but conversational tone
- Use practical, real-world examples
- Always include internal links to other LatSEO services
- Write 500-800 words in English
- Structure with H2 and H3 headings, lists (ul/li), and short paragraphs
- Include at least 2-3 internal links to: /en/lokalais-seo/, /en/tehniskais-seo/, /en/satura-strategija/, /en/majaslapas-izstrade/, /en/pakalpojumi-un-cenas/, /en/saisu-veidosana/, /en/kontakti/
- End with a CTA to /en/kontakti/ or /en/pakalpojumi-un-cenas/
- DO NOT use Markdown - use only HTML tags (p, h2, h3, ul, li, strong, em, a)

IMPORTANT: Return ONLY valid JSON with these fields:
{
  "title": "Article title (50-70 chars)",
  "metaDescription": "Meta description (140-160 chars) with keywords",
  "content": "<h2>...</h2><p>...</p>... (clean HTML, no Markdown)",
  "imageQuery": "Short image description for Pexels/Unsplash search (3-5 words)"
}"""

        user_prompt = f"""Write an SEO blog post in English.

CONTEXT:
- Weekly theme: {topic_info['theme']}
- Day format/style: {topic_info['styleLV']}
- Day topic title: {topic_info['topicTitle']}
- Category: {topic_info['category']}
- Day number out of 365: {topic_info['day']}
- Publication date: {get_today_en()}

The article should:
- Be 500-800 words
- Include internal links to LatSEO services (English versions)
- Have a CTA at the end inviting readers to contact or request a free SEO audit
- Use only HTML tags (no Markdown)
- Be written for an international/Latvian business audience

Return only JSON."""

    print(f"  🤖 Generating {lang.upper()} content with {DEEPSEEK_MODEL}...")
    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.8,
        max_tokens=4000,
    )

    raw = response.choices[0].message.content.strip()
    # Remove markdown code fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            print(f"  ⚠️ Failed to parse JSON. Raw response:\n{raw[:500]}")
            raise

    return result


def get_fallback_content(topic_info: dict, lang: str = "lv") -> dict:
    """
    Fallback content if AI generation fails. Uses the topic title and theme
    to create a basic structured blog post template.
    """
    title = topic_info["topicTitle"]
    theme = topic_info["theme"]
    category = topic_info["category"]

    if lang == "lv":
        return {
            "title": title,
            "metaDescription": f"{title}. Uzzini vairāk par {theme.lower()} mūsu SEO blogā. Praktiski padomi un ekspertu ieskati no LatSEO.",
            "content": f"""<p>Šajā rakstā mēs padziļināti aplūkojam tēmu &mdash; <strong>{title.lower()}</strong>. Tā ir daļa no mūsu plašākās sērijas par <em>{theme.lower()}</em>, kurā dalāmies ar praktiskām atziņām un pieredzi, kas uzkrāta, strādājot ar desmitiem Latvijas uzņēmumu.</p>

<h2>Kāpēc šī tēma ir svarīga?</h2>
<p>Mūsdienu digitālajā vidē <strong>{theme.lower()}</strong> ir viens no stūrakmeņiem veiksmīgai tiešsaistes stratēģijai. Neatkarīgi no tā, vai esi mazs vietējais uzņēmums vai lielāks spēlētājs, izpratne par šo tēmu var būtiski ietekmēt tavus rezultātus Google meklētājā.</p>

<h2>Mūsu pieeja</h2>
<p>LatSEO mēs pieejam šai tēmai ar datiem un praktisku pieredzi. Mēs neticam vispārīgiem padomiem &mdash; katra mūsu rekomendācija ir balstīta reālos projektos un izmērāmos rezultātos. <a href="/pakalpojumi-un-cenas/">Apskati mūsu SEO pakalpojumus un cenas &rarr;</a></p>

<h2>Ko tu vari darīt jau šodien?</h2>
<ul>
<li><strong>Sāc ar auditu:</strong> Izproti savu pašreizējo situāciju. <a href="/tehniskais-seo/">Tehniskais SEO audits</a> ir labākais pirmais solis.</li>
<li><strong>Izveido stratēģiju:</strong> Laba <a href="/satura-strategija/">satura stratēģija</a> ir pamats ilgtermiņa izaugsmei.</li>
<li><strong>Domā lokāli:</strong> Ja apkalpo klientus noteiktā reģionā, <a href="/lokalais-seo/">lokālais SEO</a> ir obligāts.</li>
</ul>

<h2>Secinājums</h2>
<p>{theme} ir plaša un dinamiska tēma. Mēs turpināsim dalīties ar jaunākajām atziņām un praktiskiem padomiem arī turpmākajos rakstos. <a href="/kontakti/">Sazinies ar mums</a>, lai uzzinātu, kā mēs varam palīdzēt tieši tavam biznesam!</p>""",
            "imageQuery": "SEO digital marketing workplace",
        }
    else:
        return {
            "title": title,
            "metaDescription": f"{title}. Learn more about {theme.lower()} on our SEO blog. Practical tips and expert insights from LatSEO.",
            "content": f"""<p>In this article, we take a deep dive into <strong>{title.lower()}</strong>. This is part of our broader series on <em>{theme.lower()}</em>, where we share practical insights and experience gained from working with businesses across Latvia and beyond.</p>

<h2>Why This Topic Matters</h2>
<p>In today's digital landscape, <strong>{theme.lower()}</strong> is one of the cornerstones of a successful online strategy. Whether you run a small local business or a larger enterprise, understanding this topic can significantly impact your Google search results.</p>

<h2>Our Approach</h2>
<p>At LatSEO, we take a data-driven, practical approach. We don't believe in generic advice &mdash; every recommendation is based on real projects and measurable results. <a href="/en/pakalpojumi-un-cenas/">Check out our SEO services and pricing &rarr;</a></p>

<h2>What You Can Do Today</h2>
<ul>
<li><strong>Start with an audit:</strong> Understand your current situation. A <a href="/en/tehniskais-seo/">technical SEO audit</a> is the best first step.</li>
<li><strong>Build a strategy:</strong> A solid <a href="/en/satura-strategija/">content strategy</a> is the foundation for long-term growth.</li>
<li><strong>Think local:</strong> If you serve customers in a specific region, <a href="/en/lokalais-seo/">local SEO</a> is essential.</li>
</ul>

<h2>Conclusion</h2>
<p>{theme} is a broad and dynamic topic. We'll continue sharing the latest insights and practical tips in future posts. <a href="/en/kontakti/">Get in touch with us</a> to find out how we can help your business specifically!</p>""",
            "imageQuery": "SEO digital marketing workplace",
        }


# ── HTML Templates ───────────────────────────────────────────────────────────

def build_blog_html(
    title: str,
    meta_description: str,
    slug: str,
    category: str,
    date_lv: str,
    date_en: str,
    content_html: str,
    image_src: str,
    image_alt: str,
    lang: str = "lv",
    en_slug: str = None,
    lv_slug: str = None,
) -> str:
    """Build a complete blog post HTML page."""
    is_lv = (lang == "lv")
    lang_attr = "lv" if is_lv else "en"
    og_locale = "lv_LV" if is_lv else "en_US"
    base_path = "../../" if is_lv else "../../../"
    canonical_base = "" if is_lv else "/en"
    blog_path = "blogs" if is_lv else "en/blogs"
    page_url = f"{SITE_URL}{canonical_base}/{blog_path}/{slug}/"
    home_url = "/" if is_lv else "/en/"
    blogs_url = "/blogs/" if is_lv else "/en/blogs/"
    author = AUTHOR_NAME if is_lv else AUTHOR_NAME_EN
    site_name = "SEO pakalpojumi - SEO optimizācija | LatSEO" if is_lv else "SEO services - SEO optimization | LatSEO"
    og_title = f"{title} | LatSEO Blog" if is_lv else f"{title} | LatSEO Blog"

    # Breadcrumb translations
    home_label = "Sākums" if is_lv else "Home"
    blog_label = "Blogs" if is_lv else "Blog"
    back_label = "Atpakaļ uz blogu" if is_lv else "Back to blog"
    author_label = "Autors" if is_lv else "Author"
    reading_label = "min lasīšanai" if is_lv else "min read"
    skip_label = "Pāriet uz saturu" if is_lv else "Skip to content"
    nav_label = "Galvenā navigācija" if is_lv else "Main navigation"
    mobile_label = "Mobilā navigācija" if is_lv else "Mobile navigation"
    lang_sel_label = "Valodas izvēle" if is_lv else "Language selection"
    menu_label = "Izvēlne" if is_lv else "Menu"
    services_label = "Pakalpojumi un cenas" if is_lv else "Services & Pricing"
    home_nav = "Sākums" if is_lv else "Home"
    services_pricing = "Pakalpojumu cenas" if is_lv else "Service Pricing"
    web_dev = "Mājaslapu izstrāde" if is_lv else "Website Development"
    tech_seo = "Tehniskais SEO" if is_lv else "Technical SEO"
    local_seo = "Lokālais SEO" if is_lv else "Local SEO"
    link_building = "Saišu veidošana" if is_lv else "Link Building"
    content_strat = "Satura stratēģija" if is_lv else "Content Strategy"
    projects_nav = "Projekti" if is_lv else "Projects"
    blog_nav = "Blogs" if is_lv else "Blog"
    contact_nav = "Kontakti" if is_lv else "Contact"
    cta_text = "Bezmaksas SEO Audits" if is_lv else "Request Audit"
    footer_company = "Uzņēmums" if is_lv else "Company"
    footer_home = "Sākumlapa" if is_lv else "Home"
    footer_pricing = "Pakalpojumi un cenas" if is_lv else "Services & Pricing"
    footer_projects = "Mūsu projekti" if is_lv else "Our Projects"
    footer_seo_services = "SEO Pakalpojumi" if is_lv else "SEO Services"
    footer_tech_audit = "Tehniskais SEO Audits" if is_lv else "Technical SEO Audit"
    footer_local_seo = "Lokālais SEO (Maps)" if is_lv else "Local SEO (Maps)"
    footer_other = "Citi Pakalpojumi" if is_lv else "Other Services"
    footer_contact = "Saziņa" if is_lv else "Contact"
    footer_brand = "Mēs palīdzam uzņēmumiem augt tiešsaistē ar datu balstītām SEO stratēģijām, kas sniedz izmērāmus rezultātus Google meklētājā." if is_lv else "We help businesses grow online with data-driven SEO strategies that deliver measurable results on Google."
    footer_rights = "Visas tiesības aizsargātas" if is_lv else "All rights reserved"
    call_label = "Zvanīt" if is_lv else "Call"
    scroll_label = "Uz augšu" if is_lv else "Back to top"
    related_label = "Saistītie SEO pakalpojumi" if is_lv else "Related SEO Services"
    all_services = "Visi pakalpojumi un cenas" if is_lv else "All Services & Pricing"
    # Alternate URLs
    lv_url = f"{SITE_URL}/blogs/{lv_slug or slug}/"
    en_url = f"{SITE_URL}/en/blogs/{en_slug or slug}/"
    lv_alt = lv_url if is_lv else f"{SITE_URL}/blogs/{lv_slug or slug}/"
    en_alt = en_url if not is_lv else f"{SITE_URL}/en/blogs/{en_slug or slug}/"

    # Derive reading time from content length
    word_count = len(re.sub(r"<[^>]+>", "", content_html).split())
    read_time = max(1, round(word_count / 200))

    # Services links based on language
    services_base = "" if is_lv else "/en"

    return f"""<!DOCTYPE html>
<html lang="{lang_attr}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231F1501'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='700' font-size='17' fill='%23F5F5F0'%3ELS%3C/text%3E%3Cstyle%3E@media(prefers-color-scheme:dark){{rect{{fill:%23EAE5DA}}text{{fill:%231F1501}}}}%3C/style%3E%3C/svg%3E">
  <link rel="icon" type="image/png" sizes="32x32" href="{base_path}assets/images/LatSEO%20logo%20black.png">
  <meta name="description" content="{meta_description}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:locale" content="{og_locale}"><meta property="og:type" content="article">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{meta_description}">
  <meta property="og:url" content="{page_url}">
  <meta property="og:site_name" content="{site_name}">
  <meta property="og:image" content="{image_src}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="{page_url}">
  <link rel="alternate" hreflang="lv" href="{lv_alt}">
  <link rel="alternate" hreflang="en" href="{en_alt}">
  <link rel="alternate" hreflang="x-default" href="{lv_alt}">
  <title>{og_title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{base_path}css/style.css">
  <script type="application/ld+json">{{"@context":"https://schema.org","@graph":[{{"@type":"Organization","@id":"{SITE_URL}/#org","name":"{COMPANY}","alternateName":"LatSEO","url":"{SITE_URL}/","logo":"/assets/images/LatSEO%20logo%20black.png","taxID":"LV40203749304","vatID":"LV40203749304","address":{{"@type":"PostalAddress","streetAddress":"Kārklu iela 4, Odukalns","addressLocality":"Ķekavas novads","addressCountry":"LV","postalCode":"LV-2123"}},"email":"sales@latseo.com","telephone":"+37124424434","founder":{{"@type":"Person","name":"{author}","jobTitle":"Dibinātājs un SEO stratēģis"}}}},{{"@type":"Article","@id":"{page_url}#article","headline":"{title}","description":"{meta_description}","author":{{"@type":"Person","name":"{author}","url":"{SITE_URL}{canonical_base}/"}},"publisher":{{"@id":"{SITE_URL}/#org"}},"datePublished":"{date.today().isoformat()}","dateModified":"{date.today().isoformat()}","image":"{image_src}","inLanguage":"{lang_attr}","mainEntityOfPage":{{"@type":"WebPage","@id":"{page_url}"}}}},{{"@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"{home_label}","item":"{SITE_URL}{canonical_base}/"}},{{"@type":"ListItem","position":2,"name":"{blog_label}","item":"{SITE_URL}{canonical_base}/blogs/"}},{{"@type":"ListItem","position":3,"name":"{title}","item":"{page_url}"}}]}}]}}</script>
  <meta name="date" content="{date.today().isoformat()}">
  <meta name="author" content="{author}, {COMPANY}">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={GTAG_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', '{GTAG_ID}');
    gtag('config', '{GTAG_AW}');
  </script>
</head>
<body>
  <a href="#main-content" class="skip-link">{skip_label}</a>
  <header class="site-header" role="banner">
    <div class="header__inner">
      <a href="{home_url}" class="header__logo" aria-label="LatSEO - {home_label}">
        <img src="/assets/images/LatSEO%20logo%20black.png" alt="LatSEO" class="header__logo-img" width="140" height="38">
      </a>
      <nav class="header__nav" role="navigation" aria-label="{nav_label}">
        <ul class="header__nav-list">
          <li><a href="{home_url}" class="header__nav-link">{home_nav}</a></li>
          <li class="header__dropdown">
            <span class="header__dropdown-toggle" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false">
              {services_label}
              <span class="header__dropdown-toggle-icon" aria-hidden="true">▾</span>
            </span>
            <div class="header__dropdown-menu">
              <a href="{services_base}/pakalpojumi-un-cenas/">{services_pricing}</a>
              <a href="{services_base}/majaslapas-izstrade/">{web_dev}</a>
              <a href="{services_base}/tehniskais-seo/">{tech_seo}</a>
              <a href="{services_base}/lokalais-seo/">{local_seo}</a>
              <a href="{services_base}/saisu-veidosana/">{link_building}</a>
              <a href="{services_base}/satura-strategija/">{content_strat}</a>
            </div>
          </li>
          <li><a href="{services_base}/projekti/" class="header__nav-link">{projects_nav}</a></li>
          <li><a href="{blogs_url}" class="header__nav-link">{blog_nav}</a></li>
          <li><a href="{services_base}/kontakti/" class="header__nav-link">{contact_nav}</a></li>
        </ul>
        <div class="header__lang-switch" role="group" aria-label="{lang_sel_label}">
          <a href="/blogs/{lv_slug or slug}/" class="header__lang-btn{" header__lang-btn--active" if is_lv else ""}"{' aria-current="page"' if is_lv else ""}>LV</a>
          <a href="/en/blogs/{en_slug or slug}/" class="header__lang-btn{"" if is_lv else " header__lang-btn--active"}" hreflang="en" lang="en"{' aria-current="page"' if not is_lv else ""}>EN</a>
        </div>
        <a href="{services_base}/kontakti/" class="header__cta">
          {cta_text}
          <span aria-hidden="true">→</span>
        </a>
      </nav>
      <button class="header__mobile-toggle" aria-label="{menu_label}" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="header__mobile-menu" role="dialog" aria-label="{mobile_label}">
      <a href="{home_url}">{home_nav}</a>
      <a href="{services_base}/pakalpojumi-un-cenas/">{services_label}</a>
      <a href="{services_base}/majaslapas-izstrade/">{web_dev}</a>
      <a href="{services_base}/tehniskais-seo/">{tech_seo}</a>
      <a href="{services_base}/lokalais-seo/">{local_seo}</a>
      <a href="{services_base}/saisu-veidosana/">{link_building}</a>
      <a href="{services_base}/satura-strategija/">{content_strat}</a>
      <a href="{services_base}/projekti/">{projects_nav}</a>
      <a href="{blogs_url}">{blog_nav}</a>
      <a href="{services_base}/kontakti/">{contact_nav}</a>
      <div class="header__mobile-lang">
        <a href="/blogs/{lv_slug or slug}/" class="header__lang-btn{" header__lang-btn--active" if is_lv else ""}">LV</a>
        <a href="/en/blogs/{en_slug or slug}/" class="header__lang-btn{"" if is_lv else " header__lang-btn--active"}" hreflang="en" lang="en">EN</a>
      </div>
    </div>
  </header>

  <main id="main-content">
    <article class="section section--light" style="padding-top:calc(var(--header-height) + var(--sp-2xl))">
      <div class="container" style="max-width:800px;margin:0 auto">

        <nav aria-label="Breadcrumb" style="margin-bottom:var(--sp-lg);font-size:var(--fs-sm);color:var(--clr-text-muted)">
          <a href="{home_url}" style="color:var(--clr-text-muted);text-decoration:none">{home_label}</a> &rsaquo;
          <a href="{blogs_url}" style="color:var(--clr-text-muted);text-decoration:none">{blog_label}</a> &rsaquo;
          <span style="color:var(--clr-text-secondary)">{title}</span>
        </nav>

        <div style="font-size:var(--fs-xs);color:var(--clr-accent-text);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-sm)">
          {category} &bull; {date_lv if is_lv else date_en}
        </div>

        <h1 class="section__title" style="font-size:clamp(1.8rem,4vw,2.6rem);margin-bottom:var(--sp-lg)">
          {title}
        </h1>

        <div style="display:flex;align-items:center;gap:var(--sp-sm);margin-bottom:var(--sp-xl);font-size:var(--fs-sm);color:var(--clr-text-secondary)">
          <span>{author_label}: <strong>{author}</strong></span>
          <span aria-hidden="true">&bull;</span>
          <span>~{read_time} {reading_label}</span>
        </div>

        <figure style="margin-bottom:var(--sp-xl)">
          <img
            src="{image_src}"
            alt="{image_alt}"
            style="width:100%;height:auto;border-radius:var(--br-lg)"
            loading="eager"
          >
          <figcaption style="font-size:var(--fs-xs);color:var(--clr-text-muted);text-align:center;margin-top:var(--sp-xs)">{image_alt}</figcaption>
        </figure>

        <div class="blog-content" style="font-size:var(--fs-base);line-height:1.8;color:var(--clr-text-primary)">
          {content_html}
        </div>

        <div style="margin-top:var(--sp-xl);padding:var(--sp-lg);background:var(--clr-bg-secondary);border-radius:var(--br-lg)">
          <h3 style="font-size:var(--fs-lg);margin-bottom:var(--sp-md)">{related_label}</h3>
          <ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:var(--sp-sm)">
            <li><a href="{services_base}/lokalais-seo/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">📍 {local_seo}</a></li>
            <li><a href="{services_base}/tehniskais-seo/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">⚙️ {footer_tech_audit}</a></li>
            <li><a href="{services_base}/satura-strategija/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">📝 {content_strat}</a></li>
            <li><a href="{services_base}/pakalpojumi-un-cenas/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">💼 {all_services}</a></li>
          </ul>
        </div>

        <div style="margin-top:var(--sp-2xl);padding-top:var(--sp-lg);border-top:1px solid var(--clr-border)">
          <a href="{blogs_url}" class="service-card__link" style="font-size:var(--fs-base)">&larr; {back_label}</a>
        </div>

      </div>
    </article>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <div class="footer__grid">
        <div>
          <a href="{home_url}" class="header__logo" aria-label="LatSEO">
            <img src="/assets/images/LatSEO%20logo%20black.png" alt="LatSEO" class="header__logo-img" width="140" height="38">
          </a>
          <p class="footer__brand-text">{footer_brand}</p>
        </div>
        <div>
          <div class="footer__heading">{footer_company}</div>
          <ul class="footer__links">
            <li><a href="{home_url}">{footer_home}</a></li>
            <li><a href="{services_base}/pakalpojumi-un-cenas/">{footer_pricing}</a></li>
            <li><a href="{services_base}/projekti/">{footer_projects}</a></li>
            <li><a href="{blogs_url}">{blog_nav}</a></li>
            <li><a href="{services_base}/kontakti/">{contact_nav}</a></li>
          </ul>
        </div>
        <div>
          <div class="footer__heading">{footer_seo_services}</div>
          <ul class="footer__links">
            <li><a href="{services_base}/tehniskais-seo/">{footer_tech_audit}</a></li>
            <li><a href="{services_base}/satura-strategija/">{content_strat}</a></li>
            <li><a href="{services_base}/lokalais-seo/">{footer_local_seo}</a></li>
          </ul>
        </div>
        <div>
          <div class="footer__heading">{footer_other}</div>
          <ul class="footer__links">
            <li><a href="{services_base}/majaslapas-izstrade/">{web_dev}</a></li>
          </ul>
        </div>
        <div>
          <div class="footer__heading">{footer_contact}</div>
          <div class="footer__contact-item"><svg class="footer__contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:sales@latseo.com">sales@latseo.com</a></div>
          <div class="footer__contact-item"><svg class="footer__contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:+37124424434">+371 24424434</a></div>
          <div class="footer__contact-item"><svg class="footer__contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>Rīga, Latvija</span></div>
        </div>
      </div>
      <div class="footer__bottom">
        <p>&copy; {date.today().year} LatSEO. {footer_rights}.</p>
        <p style="font-size:var(--fs-xs);color:var(--clr-text-muted)">Baltic SEO, SIA | Reģ. Nr. 40203749304 | PVN: LV40203749304 | Kārklu iela 4, Odukalns, LV-2123</p>
      </div>
    </div>
  </footer>

  <script src="{base_path}js/main.js"></script>

  <div class="floating-ctas" aria-label="Ātrā saziņa">
    <a href="tel:+37124424434" class="floating-cta floating-cta--call" aria-label="{call_label}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span class="floating-cta__label">{call_label}</span>
    </a>
    <a href="https://wa.me/37124424434" class="floating-cta floating-cta--whatsapp" aria-label="WhatsApp" target="_blank" rel="noopener">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
      <span class="floating-cta__label">WhatsApp</span>
    </a>
  </div>

  <button class="scroll-top" aria-label="{scroll_label}" title="{scroll_label}">↑</button>
</body>
</html>"""


def build_blog_card_html(title: str, slug: str, description: str, category: str, date_str: str, image_src: str, image_alt: str, lang: str = "lv") -> str:
    """Build the HTML for a blog card on the index page."""
    blog_base = "/blogs/" if lang == "lv" else "/en/blogs/"
    return f"""
          <article class="service-card">
            <a href="{blog_base}{slug}/" style="display:block;margin-bottom:var(--sp-md)">
              <img src="{image_src}" alt="{image_alt}" style="width:100%;height:auto;border-radius:var(--br-lg)" loading="lazy">
            </a>
            <div style="font-size:var(--fs-xs);color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-2xs)">{category} &middot; {date_str}</div>
            <h3 class="service-card__title">
              <a href="{blog_base}{slug}/" style="color:inherit;text-decoration:none">{title}</a>
            </h3>
            <p class="service-card__text">{description}</p>
            <a href="{blog_base}{slug}/" class="service-card__link">{"Lasīt vairāk" if lang == "lv" else "Read more"} <span class="service-card__link-arrow">→</span></a>
          </article>"""


def update_blog_index(lang: str, new_card_html: str, post_date: str):
    """Insert a new blog card at the top of the blog index page."""
    index_path = BLOG_INDEX_LV if lang == "lv" else BLOG_INDEX_EN

    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the blog posts container and insert the new card after it
    marker = 'id="blog-posts-container"'
    insertion_point = content.find(marker)
    if insertion_point == -1:
        print(f"  ⚠️ Could not find blog posts container in {index_path}")
        return

    # Find the end of the container opening tag
    insertion_point = content.find(">", insertion_point) + 1

    # Update the dateModified in JSON-LD
    today_iso = date.today().isoformat()
    content = re.sub(r'"dateModified":"[^"]*"', f'"dateModified":"{today_iso}"', content)

    # Update the meta date
    content = re.sub(
        r'<meta name="date" content="[^"]*">',
        f'<meta name="date" content="{today_iso}">',
        content,
    )

    # Insert the new card
    new_content = content[:insertion_point] + new_card_html + content[insertion_point:]

    with open(index_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"  ✅ Updated {index_path}")


# ── Main Logic ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate daily LatSEO blog post")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving files")
    parser.add_argument("--date", type=str, help="Generate for specific date (YYYY-MM-DD)")
    parser.add_argument("--day", type=int, help="Generate specific day number (1-365)")
    parser.add_argument("--no-ai", action="store_true", help="Skip AI generation, use fallback content")
    parser.add_argument("--skip-en", action="store_true", help="Skip English version generation")
    parser.add_argument("--force", action="store_true", help="Re-generate even if already published today")
    args = parser.parse_args()

    # ── Determine which day to generate ──────────────────────────────────
    # Priority: --day flag > --date flag > progress-file-based next day
    progress = load_progress()

    if args.day:
        day_number = args.day
    elif args.date:
        target_date = date.fromisoformat(args.date)
        topics_data = load_json(TOPICS_FILE)
        start_date = date.fromisoformat(topics_data["meta"]["startDate"])
        day_number = (target_date - start_date).days + 1
    else:
        # Auto mode: publish the NEXT unpublished day
        day_number = progress.get("lastPublishedDay", 0) + 1

    if day_number < 1 or day_number > 365:
        if day_number > 365:
            print(f"🎉 All 365 posts have been published! Nothing to do.")
            sys.exit(0)
        print(f"❌ Day {day_number} is out of range (1-365)")
        sys.exit(1)

    # ── Check if already published today ─────────────────────────────────
    already_published = any(
        p.get("day") == day_number for p in progress.get("publishedPosts", [])
    )
    if already_published and not args.force and not args.day and not args.date:
        print(f"ℹ️  Day {day_number} has already been published. Nothing to do.")
        print(f"   Use --force to re-generate or --day N to publish a different day.")
        sys.exit(0)

    print(f"{'='*60}")
    print(f"📝 LatSEO Daily Blog Generator — Day {day_number}/365")
    print(f"{'='*60}")

    # ── Get topic info ───────────────────────────────────────────────────
    topic_info = get_day_info(day_number)
    print(f"  📅 Week {topic_info['week']} | {topic_info['dayNameLV']}")
    print(f"  📂 Theme: {topic_info['theme']}")
    print(f"  📝 Title: {topic_info['topicTitle']}")
    print(f"  🏷️  Category: {topic_info['category']}")
    print(f"  🎨 Format: {topic_info['styleLV']}")

    # ── Determine slugs ──────────────────────────────────────────────────
    lv_slug = topic_info["topicSlug"]
    en_slug = None  # Will be set after EN content is generated

    # ── Generate content ─────────────────────────────────────────────────
    if args.no_ai:
        print("\n  ⚠️ Skipping AI, using fallback content...")
        lv_content = get_fallback_content(topic_info, "lv")
        en_content = get_fallback_content(topic_info, "en") if not args.skip_en else None
    else:
        try:
            lv_content = generate_content_with_ai(topic_info, "lv")
        except Exception as e:
            print(f"  ⚠️ AI generation for LV failed: {e}")
            print("  ℹ️  Using fallback content for LV...")
            lv_content = get_fallback_content(topic_info, "lv")

        if not args.skip_en:
            try:
                en_content = generate_content_with_ai(topic_info, "en")
            except Exception as e:
                print(f"  ⚠️ AI generation for EN failed: {e}")
                print("  ℹ️  Using fallback content for EN...")
                en_content = get_fallback_content(topic_info, "en")
        else:
            en_content = None

    # ── Determine EN slug from actual EN title ───────────────────────────
    if en_content:
        en_slug = slugify(en_content["title"][:80])

    # ── Image ────────────────────────────────────────────────────────────
    image_query = lv_content.get("imageQuery", "SEO digital marketing").replace(" ", "-")
    image_src = f"https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=1200&h=628&fit=crop"
    image_alt = lv_content.get("imageQuery", "SEO digitālais mārketings")

    # ── Dates ────────────────────────────────────────────────────────────
    date_lv = get_today_lv()
    date_en = get_today_en()

    if args.dry_run:
        print(f"\n{'='*60}")
        print("🔍 DRY RUN — Preview of generated content:")
        print(f"{'='*60}")
        print(f"\n--- LV Title ---\n{lv_content['title']}")
        print(f"\n--- LV Meta Description ---\n{lv_content['metaDescription']}")
        print(f"\n--- LV Content Preview (first 300 chars) ---\n{lv_content['content'][:300]}...")
        print(f"\n--- Image Query ---\n{lv_content.get('imageQuery', 'N/A')}")
        print(f"\n--- LV Slug ---\n{lv_slug}")
        if en_content:
            print(f"\n--- EN Title ---\n{en_content['title']}")
            print(f"\n--- EN Slug ---\n{en_slug}")
        print(f"\nWould create: blogs/{lv_slug}/index.html")
        if en_content:
            print(f"Would create: en/blogs/{en_slug}/index.html")
        print(f"Would update: blogs/index.html")
        print(f"Would update: en/blogs/index.html")
        return

    # ── Create directory and save files ──────────────────────────────────
    # LV version
    lv_dir = BLOGS_DIR_LV / lv_slug
    lv_dir.mkdir(parents=True, exist_ok=True)

    lv_html = build_blog_html(
        title=lv_content["title"],
        meta_description=lv_content["metaDescription"],
        slug=lv_slug,
        category=topic_info["category"],
        date_lv=date_lv,
        date_en=date_en,
        content_html=lv_content["content"],
        image_src=image_src,
        image_alt=image_alt,
        lang="lv",
        en_slug=en_slug,
        lv_slug=lv_slug,
    )

    with open(lv_dir / "index.html", "w", encoding="utf-8") as f:
        f.write(lv_html)
    print(f"  ✅ Created {lv_dir}/index.html")

    # Update LV blog index
    card_html = build_blog_card_html(
        title=lv_content["title"],
        slug=lv_slug,
        description=lv_content["metaDescription"],
        category=topic_info["category"],
        date_str=date_lv,
        image_src=image_src,
        image_alt=image_alt,
        lang="lv",
    )
    update_blog_index("lv", card_html, date_lv)

    # EN version
    if en_content and not args.skip_en:
        # Generate EN slug from the actual English title
        en_slug = slugify(en_content["title"][:80])

        en_dir = BLOGS_DIR_EN / en_slug
        en_dir.mkdir(parents=True, exist_ok=True)

        en_html = build_blog_html(
            title=en_content["title"],
            meta_description=en_content["metaDescription"],
            slug=en_slug,
            category=topic_info["category"],
            date_lv=date_lv,
            date_en=date_en,
            content_html=en_content["content"],
            image_src=image_src,
            image_alt=image_alt,
            lang="en",
            en_slug=en_slug,
            lv_slug=lv_slug,
        )

        with open(en_dir / "index.html", "w", encoding="utf-8") as f:
            f.write(en_html)
        print(f"  ✅ Created {en_dir}/index.html")

        # Update EN blog index
        en_card_html = build_blog_card_html(
            title=en_content["title"],
            slug=en_slug,
            description=en_content["metaDescription"],
            category=topic_info["category"],
            date_str=date_en,
            image_src=image_src,
            image_alt=image_alt,
            lang="en",
        )
        update_blog_index("en", en_card_html, date_en)

    # ── Save progress ────────────────────────────────────────────────────
    progress = load_progress()
    progress["lastPublishedDay"] = day_number
    progress["lastPublishedDate"] = date.today().isoformat()
    progress["publishedPosts"].append({
        "day": day_number,
        "date": date.today().isoformat(),
        "lvSlug": lv_slug,
        "enSlug": en_slug,
        "titleLV": lv_content["title"],
        "titleEN": en_content["title"] if en_content else None,
    })
    save_progress(progress)

    print(f"\n{'='*60}")
    print(f"🎉 Day {day_number}/365 published successfully!")
    print(f"   LV: {SITE_URL}/blogs/{lv_slug}/")
    if en_content and not args.skip_en:
        print(f"   EN: {SITE_URL}/en/blogs/{en_slug}/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
