#!/usr/bin/env python3
"""
LatSEO Telegram Bot — Daily Blog Q&A System
=============================================
Sends daily questions about the next blog topic via Telegram.
Collects your answers, then generates a REAL blog post based on YOUR facts.
Hosted 24/7 on Render (free tier).

Setup:
  1. Create a bot via @BotFather on Telegram → get BOT_TOKEN
  2. Get your Telegram user ID (send /start to @userinfobot)
  3. Set env vars: BOT_TOKEN, ADMIN_CHAT_ID, DEEPSEEK_API_KEY
  4. Deploy to Render
"""

import json
import os
import re
import sys
import subprocess
import tempfile
import asyncio
from datetime import date, datetime, timedelta, time, timezone
from pathlib import Path
from typing import Optional

# ── Configuration ────────────────────────────────────────────────────────────
# These MUST be set as environment variables on Render
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_CHAT_ID = int(os.environ.get("ADMIN_CHAT_ID", "0"))
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")  # Personal access token for pushing

# DeepSeek config
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"

# GitHub config
GITHUB_REPO = "latseoweb/latseoweb.github.io"
GITHUB_BRANCH = "main"

# Paths — use the project root (where Render deploys the repo)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
TOPICS_FILE = PROJECT_ROOT / "scripts" / "topics.json"
PROGRESS_FILE = PROJECT_ROOT / "scripts" / ".blog-progress.json"

# Timezone
LV_TZ_HOUR = 3  # Latvia is UTC+3 (summer) / UTC+2 (winter)

# Curated Unsplash photos — all business/office/SEO/tech related, 60+ unique images
UNSPLASH_PHOTOS = [
    "photo-1432888498266-38ffec3eaf0a", "photo-1460925895917-afdab827c52f",
    "photo-1551288049-bebda4e38f71", "photo-1552664730-d307ca884978",
    "photo-1454165804606-c3d57bc86b40", "photo-1522202176988-66273c2fd55f",
    "photo-1512758017271-d7b84c2113f1", "photo-1553877522-43269d4ea984",
    "photo-1504868584819-f8e8b4b6d7e3", "photo-1559028012-481c04fa702d",
    "photo-1532619675605-1ede6c2ed2b0", "photo-1486312338219-ce68d2c6f44d",
    "photo-1499951360447-b19be8fe80f5", "photo-1519389950473-47ba0277781c",
    "photo-1522071820081-009f0129c71c", "photo-1542744173-8e7e53415bb0",
    "photo-1557804506-669a67965ba0", "photo-1571171637578-41eb5d09b1f2",
    "photo-1600880292201-6414f5a5a6c5", "photo-1507003211169-0a1dd7228f2d",
    "photo-1517245386807-bb43f82c33c4", "photo-1552664688-cf287c386cee",
    "photo-1560472354-b33ff0c44a43", "photo-1571728485813-7ecbcf2df42a",
    "photo-1533750349088-bdee7b5f0006", "photo-1562577309-c349a5e21d15",
    "photo-1434030216411-0b793f4b4173", "photo-1559526324-593bc073d938",
    "photo-1498050108023-c5249f4df085", "photo-1516321318423-f06f85e504b3",
    "photo-1559136558-4b0b5f5f8b6a", "photo-1523240795612-9a054b0db5d4",
    "photo-1461749280684-dccba630e2f6", "photo-1504384308090-c894fdcc538d",
    "photo-1517048676732-d65c6e0b2c3c", "photo-1556761175-4b46a572b786",
    "photo-1553028826-b8ddce317e6a", "photo-1599658880436-617b5e1a5a5c",
    "photo-1531482615713-2afd8a5e0b9f", "photo-1549923749-5f50e17f25bd",
    "photo-1607962837359-5e7e89f86776", "photo-1507537297725-24a1c029d3ca",
    "photo-1558403189-ab3f0aad34b1", "photo-1563986768609-322da13575f2",
    "photo-1558403191-14807de17862", "photo-1470790376778-a9fdb86b2dd4",
    "photo-1555421689-d68471e189f2", "photo-1535957998253-d26ff1ca4bc8",
    "photo-1556761175-b413da4cf2f6", "photo-1521791136064-798e4a2eec9f",
    "photo-1568992687947-febf11de21d8", "photo-1601933470099-0e731f668fe1",
    "photo-1573164574230-d99ae9c9b1cb", "photo-1581291518633-83b4a4c1e56e",
    "photo-1551739440-5dd4fc0a3c8a", "photo-1533228872887-8d3c1cf9ecd5",
    "photo-1542623066180-e0cfc08248f4", "photo-1554226655-02e8e2ef4f74",
    "photo-1606857521015-f2e2a0b0c7ec", "photo-1573497620053-e2278f4e0a20",
]

# ── Bot State ────────────────────────────────────────────────────────────────
# In-memory state (simple dict — fine for single-user bot)
user_state = {
    "awaiting_answers": False,
    "current_day": 0,
    "current_topic": {},
    "questions": [],
    "answers": [],
    "question_index": 0,
}


# ── Helper Functions ─────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def slugify(text: str) -> str:
    text = text.lower().strip()
    replacements = {"ā":"a","č":"c","ē":"e","ģ":"g","ī":"i","ķ":"k","ļ":"l","ņ":"n","š":"s","ū":"u","ž":"z"}
    for lv, en in replacements.items():
        text = text.replace(lv, en)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    return text.strip("-")


def get_day_info(day_number: int) -> dict:
    topics_data = load_json(TOPICS_FILE)
    if day_number == 365:
        bonus = topics_data["bonusDay365"]
        return {"day":365,"week":"Bonuss","theme":bonus["theme"],"themeSlug":bonus["themeSlug"],"category":bonus["category"],"topicTitle":bonus["theme"],"topicSlug":bonus["themeSlug"]}
    week_idx = (day_number - 1) // 7
    day_of_week = ((day_number - 1) % 7) + 1
    week_data = topics_data["weeks"][week_idx]
    format_data = topics_data["meta"]["dailyFormats"][str(day_of_week)]
    topic_title = week_data["topics"][day_of_week - 1]
    return {"day":day_number,"week":week_data["week"],"quarter":week_data["quarter"],"theme":week_data["theme"],"themeSlug":week_data["themeSlug"],"category":week_data["category"],"topicTitle":topic_title,"topicSlug":slugify(topic_title[:60]),"dayNameLV":format_data["dayName"],"formatLV":format_data["format"],"styleLV":format_data["style"]}


def generate_questions(topic_info: dict) -> list[str]:
    """Generate 4-5 questions about today's topic using DeepSeek."""
    from openai import OpenAI
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

    prompt = f"""Tu esi SEO bloga redaktors. Tev jāsagatavo 5 jautājumi bloga autoram (Adrianam no LatSEO) par šodienas tēmu.
Mērķis: iegūt personīgu pieredzi, faktus un piemērus, ko pēc tam izmantot bloga rakstā.

ŠODIENAS TĒMA:
- Virsraksts: {topic_info['topicTitle']}
- Nedēļas tēma: {topic_info['theme']}
- Formāts: {topic_info['styleLV']}
- Kategorija: {topic_info['category']}

Izveido 5 jautājumus LATVIEŠU valodā, kas:
1. Ir konkrēti un personīgi (piem., "Kāda bija tava pirmā...", "Cik reizes tu esi...", "Kādu rīku tu izmanto...")
2. Prasa FAKTUS un PIEMĒRUS, nevis vispārīgas atbildes
3. Palīdzēs uzrakstīt dzīvīgu, personīgu bloga rakstu
4. Ir īsi — max 15 vārdi katrs

Atgriez TIKAI numurētu sarakstu, piemēram:
1. Pirmais jautājums?
2. Otrais jautājums?
utt. Bez papildu teksta."""

    response = client.chat.completions.create(model=DEEPSEEK_MODEL, messages=[{"role":"user","content":prompt}], temperature=0.7, max_tokens=500)
    raw = response.choices[0].message.content.strip()
    # Parse numbered questions
    questions = []
    for line in raw.split("\n"):
        line = line.strip()
        match = re.match(r"^\d+[\.\)]\s*(.+)", line)
        if match:
            q = match.group(1).strip()
            if len(q) > 5:
                questions.append(q)
    if len(questions) < 3:
        # Fallback questions
        questions = [
            f"Kāda ir tava personīgā pieredze ar {topic_info['theme'].lower()}?",
            f"Kādu vienu konkrētu piemēru tu vari dot par {topic_info['theme'].lower()}?",
            f"Kāda ir tava galvenā atziņa par {topic_info['theme'].lower()}?",
            f"Ko tu ieteiktu kādam, kas tikai sāk ar {topic_info['theme'].lower()}?",
        ]
    return questions[:5]


def generate_blog_post(topic_info: dict, questions: list[str], answers: list[str], lang: str = "lv") -> dict:
    """Generate blog post using the user's answers as factual context."""
    from openai import OpenAI
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

    # Build Q&A context
    qa_context = ""
    for q, a in zip(questions, answers):
        qa_context += f"J: {q}\nA: {a}\n\n"

    if lang == "lv":
        system_prompt = f"""Tu esi latviešu SEO bloga autors. Tu raksti LatSEO aģentūras blogam.

SVARĪGĀKAIS: Tev ir dotas PATIESAS, PERSONĪGAS atbildes no bloga autora (Adriana). Izmanto šīs atbildes kā FAKTUS. Nekad neizdomā neko, kas nav šajās atbildēs.

Rakstīšanas noteikumi:
- Raksti 1. personā ("es", "mans", "mēs LatSEO") — tas ir PERSONĪGS blogs
- Izmanto tikai faktus no autora atbildēm. Ja kaut kas nav atbildēs, neizdomā
- Profesionāls, bet sarunvalodas tonis
- Katrā rindkopā konkrēts fakts, skaitlis vai piemērs no atbildēm
- Strukturē ar H2, H3, īsām rindkopām, <ul><li> sarakstiem
- Iekļauj 2-3 iekšējās saites uz LatSEO pakalpojumiem
- Beigās CTA uz /kontakti/ vai /pakalpojumi-un-cenas/
- NELIETO Markdown (tikai HTML: p, h2, h3, ul, li, strong, em, a)
- NELIETO #, — (em dash). Domuzīmei lieto "-"
- NELIETO tukšas frāzes ("mūsdienu pasaulē", "digitālais laikmets" utt.)
- Raksti latviski, 600-900 vārdi

AUTORA ATBILDES (FAKTI):
{qa_context}

Atgriez TIKAI JSON: {{"title":"...", "metaDescription":"...", "content":"<h2>...</h2><p>...</p>...", "imageQuery":"..."}}"""
    else:
        system_prompt = f"""You are an SEO blog author writing for LatSEO agency.

CRITICAL: You have REAL, PERSONAL answers from the blog author. Use these as FACTS. Never invent anything not in these answers.

Writing rules:
- Write in 1st person ("I", "my", "we at LatSEO") — this is a PERSONAL blog
- Use ONLY facts from the author's answers
- Professional but conversational tone
- Every paragraph has a concrete fact or example from the answers
- Structure with H2, H3, short paragraphs, <ul><li> lists
- Include 2-3 internal links to LatSEO services (/en/...)
- End with CTA to /en/kontakti/ or /en/pakalpojumi-un-cenas/
- NO Markdown (HTML only: p, h2, h3, ul, li, strong, em, a)
- NO #, — (em dash). Use "-" for dashes
- 500-700 words

AUTHOR'S ANSWERS (FACTS):
{qa_context}

Return ONLY JSON: {{"title":"...", "metaDescription":"...", "content":"<h2>...</h2><p>...</p>...", "imageQuery":"..."}}"""

    response = client.chat.completions.create(model=DEEPSEEK_MODEL, messages=[{"role":"system","content":system_prompt}], temperature=0.7, max_tokens=4000)
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
    return json.loads(raw)


def format_html_content(html: str) -> str:
    """Add line breaks and strip em dashes."""
    html = html.replace("\u2014", "-").replace("&mdash;", "-")
    for tag in ["h2","h3","h4","p","ul","ol","figure","blockquote","table"]:
        html = html.replace(f"<{tag}>", f"\n<{tag}>")
        html = html.replace(f"<{tag} ", f"\n<{tag} ")
        html = html.replace(f"</{tag}>", f"</{tag}>\n")
    html = html.replace("<li>", "\n  <li>")
    html = html.replace("</ul>", "\n</ul>")
    html = html.replace("</ol>", "\n</ol>")
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html.strip()


def build_blog_card_html(title: str, slug: str, desc: str, category: str, date_str: str, image_src: str, image_alt: str, lang: str = "lv") -> str:
    blog_base = "/blogs/" if lang == "lv" else "/en/blogs/"
    read_more = "Lasīt vairāk" if lang == "lv" else "Read more"
    return f"""
          <article class="service-card">
            <a href="{blog_base}{slug}/" style="display:block;margin-bottom:var(--sp-md)">
              <img src="{image_src}" alt="{image_alt}" style="width:100%;height:auto;border-radius:var(--br-lg)" loading="lazy">
            </a>
            <div style="font-size:var(--fs-xs);color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-2xs)">{category} &middot; {date_str}</div>
            <h3 class="service-card__title">
              <a href="{blog_base}{slug}/" style="color:inherit;text-decoration:none">{title}</a>
            </h3>
            <p class="service-card__text">{desc}</p>
            <a href="{blog_base}{slug}/" class="service-card__link">{read_more} <span class="service-card__link-arrow">→</span></a>
          </article>"""


def commit_and_push(lv_slug: str, en_slug: str, day: int):
    """Clone repo, generate files, commit and push."""
    import git
    from git import Repo

    # Clone fresh
    if REPO_DIR.exists():
        subprocess.run(["rm", "-rf", str(REPO_DIR)])
    
    clone_url = f"https://x-access-token:{GITHUB_TOKEN}@github.com/{GITHUB_REPO}.git"
    repo = Repo.clone_from(clone_url, REPO_DIR, branch=GITHUB_BRANCH)

    # Update progress
    progress = load_json(PROGRESS_FILE)
    progress["lastPublishedDay"] = day
    progress["lastPublishedDate"] = date.today().isoformat()
    save_json(PROGRESS_FILE, progress)

    # Git operations
    repo.git.add(A=True)
    repo.git.commit(m=f"📝 Blog post — Day {day}/365 (Telegram Q&A)")
    repo.git.push("origin", GITHUB_BRANCH)

    return True


# ── Telegram Bot ─────────────────────────────────────────────────────────────

async def start_command(update, context):
    """Handle /start command."""
    await update.message.reply_text(
        "👋 Sveiks! Es esmu LatSEO bloga bots.\n\n"
        "Katru dienu plkst. 09:00 es tev atsūtīšu jautājumus par šodienas bloga tēmu.\n"
        "Atbildi uz jautājumiem, un es uzrakstīšu bloga rakstu balstoties uz TAVIEM faktiem.\n\n"
        "Komandas:\n"
        "/jauns - sākt jaunu rakstu tūlīt\n"
        "/izlaist - izlaist šodienas rakstu\n"
        "/status - pārbaudīt statusu\n"
        "/raksti - saraksts ar publicētajiem rakstiem (LinkedIn)\n"
        "/li_mark N - atzīmēt rakstu kā izmantotu LinkedIn"
    )


async def new_post_command(update, context):
    """Handle /jauns — start a new blog post Q&A now."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Tikai administrators var veidot rakstus.")
        return

    # Auto-init progress file if missing
    if not PROGRESS_FILE.exists():
        save_json(PROGRESS_FILE, {"lastPublishedDay": 0, "lastPublishedDate": None, "publishedPosts": []})
    
    progress = load_json(PROGRESS_FILE)
    day_number = progress.get("lastPublishedDay", 0) + 1
    
    if day_number > 365:
        await update.message.reply_text("🎉 Visi 365 raksti jau ir uzrakstīti!")
        return

    topic_info = get_day_info(day_number)
    
    await update.message.reply_text(
        f"📝 *Gatavojam rakstu #{day_number}/365*\n\n"
        f"📅 {topic_info['dayNameLV']}, {topic_info['week']}. nedēļa\n"
        f"📂 {topic_info['category']}\n"
        f"📝 {topic_info['topicTitle']}\n"
        f"🎨 {topic_info['styleLV']}\n\n"
        f"⏳ Ģenerēju jautājumus...",
        parse_mode="Markdown"
    )

    # Generate questions
    questions = generate_questions(topic_info)
    
    user_state = {
        "awaiting_answers": True,
        "current_day": day_number,
        "current_topic": topic_info,
        "questions": questions,
        "answers": [],
        "question_index": 0,
    }

    # Send questions
    q_text = "📋 *Atbildi uz šiem jautājumiem:*\n\n"
    for i, q in enumerate(questions, 1):
        q_text += f"*{i}.* {q}\n\n"
    q_text += "──────────────\n"
    q_text += "Atbildi uz VISIEM jautājumiem vienā ziņā, atdalot atbildes ar tukšu rindu.\n"
    q_text += "Vai arī atbildi pa vienam — es gaidīšu.\n"
    q_text += "Kad esi pabeidzis, raksti /publicet"

    await update.message.reply_text(q_text, parse_mode="Markdown")


async def handle_message(update, context):
    """Handle user's answers — checks LinkedIn mode first, then blog Q&A."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    # Check if in LinkedIn selection mode
    if linkedin_state.get("selecting"):
        await handle_linkedin_number(update, context)
        return

    if not user_state["awaiting_answers"]:
        await update.message.reply_text("Šobrīd negaidu atbildes. Raksti /jauns lai sāktu.")
        return

    text = update.message.text.strip()
    
    # Check if it's a multi-answer (separated by blank lines)
    parts = re.split(r"\n\s*\n", text)
    if len(parts) >= len(user_state["questions"]):
        # Got all answers at once
        user_state["answers"] = [p.strip() for p in parts[:len(user_state["questions"])]]
        await update.message.reply_text(
            f"✅ Saņēmu {len(user_state['answers'])} atbildes!\n"
            "Raksti /publicet lai ģenerētu rakstu, vai turpini atbildēt."
        )
    else:
        # Single answer — add to list
        idx = user_state["question_index"]
        if idx < len(user_state["questions"]):
            user_state["answers"].append(text)
            user_state["question_index"] += 1
            
            if user_state["question_index"] < len(user_state["questions"]):
                next_q = user_state["questions"][user_state["question_index"]]
                await update.message.reply_text(
                    f"✅ Atbilde {user_state['question_index']}/{len(user_state['questions'])} saņemta!\n\n"
                    f"Nākamais jautājums:\n*{user_state['question_index']+1}. {next_q}*",
                    parse_mode="Markdown"
                )
            else:
                await update.message.reply_text(
                    f"✅ Visas {len(user_state['questions'])} atbildes saņemtas!\n"
                    "Raksti /publicet lai ģenerētu rakstu."
                )


async def publish_command(update, context):
    """Handle /publicet — generate and publish the blog post."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    if not user_state.get("awaiting_answers"):
        await update.message.reply_text("Nav aktīva raksta. Raksti /jauns lai sāktu.")
        return

    if len(user_state.get("answers", [])) < len(user_state.get("questions", [])):
        missing = len(user_state["questions"]) - len(user_state["answers"])
        await update.message.reply_text(f"⚠️ Trūkst {missing} atbildes. Atbildi uz visiem jautājumiem.")
        return

    await update.message.reply_text("✍️ Ģenerēju bloga rakstu... Tas var aizņemt ~30 sekundes.")

    try:
        topic = user_state["current_topic"]
        questions = user_state["questions"]
        answers = user_state["answers"]
        day = user_state["current_day"]

        # Generate LV content
        lv_content = generate_blog_post(topic, questions, answers, "lv")
        lv_content["content"] = format_html_content(lv_content["content"])
        
        # Generate EN content
        en_content = generate_blog_post(topic, questions, answers, "en")
        en_content["content"] = format_html_content(en_content["content"])

        lv_slug = topic["topicSlug"]
        en_slug = slugify(en_content["title"][:80])
        image_src = f"https://picsum.photos/1200/628?random={day}"
        
        # Format dates
        lv_months = ["janvāris","februāris","marts","aprīlis","maijs","jūnijs","jūlijs","augusts","septembris","oktobris","novembris","decembris"]
        today_lv = f"{date.today().year}. gada {date.today().day}. {lv_months[date.today().month - 1]}"
        today_en = date.today().strftime("%B %d, %Y")
        today_en = datetime.now().strftime("%B %d, %Y")

        # Clone repo, write files, commit, push
        import git
        from git import Repo
        
        repo_dir = Path("/tmp/latseo-repo")
        if repo_dir.exists():
            subprocess.run(["rm", "-rf", str(repo_dir)])
        
        clone_url = f"https://x-access-token:{GITHUB_TOKEN}@github.com/{GITHUB_REPO}.git"
        repo = Repo.clone_from(clone_url, repo_dir, branch=GITHUB_BRANCH)

        # Write LV blog post
        lv_dir = repo_dir / "blogs" / lv_slug
        lv_dir.mkdir(parents=True, exist_ok=True)
        lv_html = build_full_blog_html(lv_content["title"], lv_content["metaDescription"], lv_slug, topic["category"], today_lv, today_en, lv_content["content"], image_src, lv_content.get("imageQuery","SEO"), "lv", en_slug, lv_slug)
        (lv_dir / "index.html").write_text(lv_html, encoding="utf-8")

        # Write EN blog post
        en_dir = repo_dir / "en" / "blogs" / en_slug
        en_dir.mkdir(parents=True, exist_ok=True)
        en_html = build_full_blog_html(en_content["title"], en_content["metaDescription"], en_slug, topic["category"], today_lv, today_en, en_content["content"], image_src, en_content.get("imageQuery","SEO"), "en", en_slug, lv_slug)
        (en_dir / "index.html").write_text(en_html, encoding="utf-8")

        # Update blog index pages
        update_index(repo_dir / "blogs" / "index.html", lv_content["title"], lv_slug, lv_content["metaDescription"], topic["category"], today_lv, image_src, lv_content.get("imageQuery","SEO"), "lv")
        update_index(repo_dir / "en" / "blogs" / "index.html", en_content["title"], en_slug, en_content["metaDescription"], topic["category"], today_en, image_src, en_content.get("imageQuery","SEO"), "en")

        # Update progress
        progress_path = repo_dir / "scripts" / ".blog-progress.json"
        progress = load_json(progress_path) if progress_path.exists() else {"lastPublishedDay": 0, "publishedPosts": []}
        progress["lastPublishedDay"] = day
        progress["lastPublishedDate"] = date.today().isoformat()
        save_json(progress_path, progress)

        # Also update progress locally (Render copy)
        save_json(PROGRESS_FILE, progress)

        # Git commit & push
        repo.git.config("user.email", "bot@latseo.com")
        repo.git.config("user.name", "LatSEO Bot")
        repo.git.add(A=True)
        repo.git.commit(m=f"📝 Blog post — Day {day}/365 (Telegram Q&A)")
        repo.git.push("origin", GITHUB_BRANCH)

        user_state["awaiting_answers"] = False

        await update.message.reply_text(
            f"✅ *Raksts publicēts!*\n\n"
            f"📝 {lv_content['title']}\n"
            f"🔗 https://latseo.com/blogs/{lv_slug}/\n\n"
            f"🌍 EN: https://latseo.com/en/blogs/{en_slug}/",
            parse_mode="Markdown",
            disable_web_page_preview=True
        )

    except Exception as e:
        await update.message.reply_text(f"❌ Kļūda publicējot: {str(e)}")


def build_full_blog_html(title, meta_desc, slug, category, date_lv, date_en, content, image_src, image_alt, lang, en_slug, lv_slug):
    """Build complete blog post HTML matching the existing site style."""
    is_lv = lang == "lv"
    base_path = "../../" if is_lv else "../../../"
    services_base = "" if is_lv else "/en"
    home_url = "/" if is_lv else "/en/"
    blogs_url = "/blogs/" if is_lv else "/en/blogs/"
    page_url = f"https://latseo.com{'' if is_lv else '/en'}/blogs/{slug}/"
    lv_page = f"https://latseo.com/blogs/{lv_slug}/"
    en_page = f"https://latseo.com/en/blogs/{en_slug}/"
    
    word_count = len(re.sub(r"<[^>]+>", "", content).split())
    read_time = max(1, round(word_count / 200))
    
    labels = {
        "home": "Sākums" if is_lv else "Home",
        "blog": "Blogs" if is_lv else "Blog",
        "back": "Atpakaļ uz blogu" if is_lv else "Back to blog",
        "author_label": "Autors" if is_lv else "Author",
        "author": "Adrians Stankevičs" if is_lv else "Adrians Stankevics",
        "read": "min lasīšanai" if is_lv else "min read",
        "skip": "Pāriet uz saturu" if is_lv else "Skip to content",
        "services": "Pakalpojumi un cenas" if is_lv else "Services & Pricing",
        "webdev": "Mājaslapu izstrāde" if is_lv else "Web Development",
        "tech": "Tehniskais SEO" if is_lv else "Technical SEO",
        "local": "Lokālais SEO" if is_lv else "Local SEO",
        "links": "Saišu veidošana" if is_lv else "Link Building",
        "content_strat": "Satura stratēģija" if is_lv else "Content Strategy",
        "cta": "Bezmaksas SEO Audits" if is_lv else "Free SEO Audit",
        "related": "Saistītie SEO pakalpojumi" if is_lv else "Related SEO Services",
    }
    
    return f"""<!DOCTYPE html>
<html lang="{'lv' if is_lv else 'en'}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231F1501'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='700' font-size='17' fill='%23F5F5F0'%3ELS%3C/text%3E%3Cstyle%3E@media(prefers-color-scheme:dark){{rect{{fill:%23EAE5DA}}text{{fill:%231F1501}}}}%3C/style%3E%3C/svg%3E">
  <link rel="icon" type="image/png" sizes="32x32" href="{base_path}assets/images/LatSEO%20logo%20black.png">
  <meta name="description" content="{meta_desc}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:locale" content="{'lv_LV' if is_lv else 'en_US'}"><meta property="og:type" content="article">
  <meta property="og:title" content="{title} | LatSEO Blog">
  <meta property="og:description" content="{meta_desc}">
  <meta property="og:url" content="{page_url}">
  <meta property="og:image" content="{image_src}">
  <link rel="canonical" href="{page_url}">
  <link rel="alternate" hreflang="lv" href="{lv_page}">
  <link rel="alternate" hreflang="en" href="{en_page}">
  <link rel="alternate" hreflang="x-default" href="{lv_page}">
  <title>{title} | LatSEO Blog</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{base_path}css/style.css">
  <style>
    .blog-content h2 {{ font-size:clamp(1.3rem,3vw,1.7rem); margin-top:var(--sp-xl); margin-bottom:var(--sp-md); }}
    .blog-content h3 {{ font-size:clamp(1.1rem,2.5vw,1.4rem); margin-top:var(--sp-lg); margin-bottom:var(--sp-sm); }}
    .blog-content h4 {{ font-size:clamp(1rem,2vw,1.2rem); margin-top:var(--sp-md); margin-bottom:var(--sp-xs); }}
    .blog-content p {{ margin-bottom:var(--sp-md); }}
    .blog-content ul, .blog-content ol {{ margin-bottom:var(--sp-lg); padding-left:1.2em; }}
    .blog-content li {{ margin-bottom:var(--sp-sm); }}
  </style>
  <meta name="date" content="{date.today().isoformat()}">
  <meta name="author" content="{labels['author']}, Baltic SEO, SIA">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-MF7Q1R9722"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-MF7Q1R9722');gtag('config','AW-18351772465');</script>
</head>
<body>
  <a href="#main-content" class="skip-link">{labels['skip']}</a>
  <header class="site-header"><div class="header__inner">
    <a href="{home_url}" class="header__logo"><img src="/assets/images/LatSEO%20logo%20black.png" alt="LatSEO" class="header__logo-img" width="140" height="38"></a>
    <nav class="header__nav">
      <ul class="header__nav-list">
        <li><a href="{home_url}" class="header__nav-link">{labels['home']}</a></li>
        <li class="header__dropdown"><span class="header__dropdown-toggle" tabindex="0">{labels['services']} <span class="header__dropdown-toggle-icon">▾</span></span>
          <div class="header__dropdown-menu">
            <a href="{services_base}/pakalpojumi-un-cenas/">Pakalpojumu cenas</a>
            <a href="{services_base}/majaslapas-izstrade/">{labels['webdev']}</a>
            <a href="{services_base}/tehniskais-seo/">{labels['tech']}</a>
            <a href="{services_base}/lokalais-seo/">{labels['local']}</a>
            <a href="{services_base}/saisu-veidosana/">{labels['links']}</a>
            <a href="{services_base}/satura-strategija/">{labels['content_strat']}</a>
          </div></li>
        <li><a href="{services_base}/projekti/" class="header__nav-link">Projekti</a></li>
        <li><a href="{blogs_url}" class="header__nav-link">{labels['blog']}</a></li>
        <li><a href="{services_base}/kontakti/" class="header__nav-link">Kontakti</a></li>
      </ul>
      <div class="header__lang-switch">
        <a href="/blogs/{lv_slug}/" class="header__lang-btn{'' if not is_lv else ' header__lang-btn--active'}">LV</a>
        <a href="/en/blogs/{en_slug}/" class="header__lang-btn{'' if is_lv else ' header__lang-btn--active'}" hreflang="en" lang="en">EN</a>
      </div>
      <a href="{services_base}/kontakti/" class="header__cta">{labels['cta']} <span aria-hidden="true">→</span></a>
    </nav>
  </div></header>
  <main id="main-content"><article class="section section--light" style="padding-top:calc(var(--header-height) + var(--sp-2xl))"><div class="container" style="max-width:800px;margin:0 auto">
    <nav style="margin-bottom:var(--sp-lg);font-size:var(--fs-sm);color:var(--clr-text-muted)"><a href="{home_url}" style="color:var(--clr-text-muted);text-decoration:none">{labels['home']}</a> &rsaquo; <a href="{blogs_url}" style="color:var(--clr-text-muted);text-decoration:none">{labels['blog']}</a> &rsaquo; <span style="color:var(--clr-text-secondary)">{title}</span></nav>
    <div style="font-size:var(--fs-xs);color:var(--clr-accent-text);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-sm)">{category} &bull; {date_lv if is_lv else date_en}</div>
    <h1 class="section__title" style="font-size:clamp(1.8rem,4vw,2.6rem);margin-bottom:var(--sp-lg)">{title}</h1>
    <div style="display:flex;align-items:center;gap:var(--sp-sm);margin-bottom:var(--sp-xl);font-size:var(--fs-sm);color:var(--clr-text-secondary)"><span>{labels['author_label']}: <strong>{labels['author']}</strong></span><span>&bull;</span><span>~{read_time} {labels['read']}</span></div>
    <figure style="margin-bottom:var(--sp-xl)"><img src="{image_src}" alt="{image_alt}" style="width:100%;height:auto;border-radius:var(--br-lg)" loading="eager"><figcaption style="font-size:var(--fs-xs);color:var(--clr-text-muted);text-align:center;margin-top:var(--sp-xs)">{image_alt}</figcaption></figure>
    <div class="blog-content" style="font-size:var(--fs-base);line-height:1.8;color:var(--clr-text-primary)">{content}</div>
    <div style="margin-top:var(--sp-xl);padding:var(--sp-lg);background:var(--clr-bg-secondary);border-radius:var(--br-lg)"><h3 style="font-size:var(--fs-lg);margin-bottom:var(--sp-md)">{labels['related']}</h3>
      <ul style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:var(--sp-sm)">
        <li><a href="{services_base}/lokalais-seo/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">📍 {labels['local']}</a></li>
        <li><a href="{services_base}/tehniskais-seo/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">⚙️ {labels['tech']}</a></li>
        <li><a href="{services_base}/satura-strategija/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">📝 {labels['content_strat']}</a></li>
        <li><a href="{services_base}/pakalpojumi-un-cenas/" style="display:inline-block;padding:var(--sp-xs) var(--sp-md);background:var(--clr-bg);border-radius:var(--br-md);font-size:var(--fs-sm);text-decoration:none;color:var(--clr-text-primary);border:1px solid var(--clr-border)">💼 Visi pakalpojumi</a></li>
      </ul></div>
    <div style="margin-top:var(--sp-2xl);padding-top:var(--sp-lg);border-top:1px solid var(--clr-border)"><a href="{blogs_url}" class="service-card__link" style="font-size:var(--fs-base)">&larr; {labels['back']}</a></div>
  </div></article></main>
  <footer class="site-footer"><div class="container"><div class="footer__grid">
    <div><a href="{home_url}" class="header__logo"><img src="/assets/images/LatSEO%20logo%20black.png" alt="LatSEO" class="header__logo-img" width="140" height="38"></a><p class="footer__brand-text">{'Mēs palīdzam uzņēmumiem augt tiešsaistē ar datu balstītām SEO stratēģijām, kas sniedz izmērāmus rezultātus Google meklētājā.' if is_lv else 'We help businesses grow online with data-driven SEO strategies that deliver measurable results on Google.'}</p></div>
    <div><div class="footer__heading">{'Uzņēmums' if is_lv else 'Company'}</div><ul class="footer__links"><li><a href="{home_url}">{'Sākumlapa' if is_lv else 'Home'}</a></li><li><a href="{services_base}/pakalpojumi-un-cenas/">{labels['services']}</a></li><li><a href="{services_base}/projekti/">{'Mūsu projekti' if is_lv else 'Our projects'}</a></li><li><a href="{blogs_url}">{labels['blog']}</a></li><li><a href="{services_base}/kontakti/">Kontakti</a></li></ul></div>
    <div><div class="footer__heading">{'SEO Pakalpojumi' if is_lv else 'SEO Services'}</div><ul class="footer__links"><li><a href="{services_base}/tehniskais-seo/">{labels['tech']}</a></li><li><a href="{services_base}/satura-strategija/">{labels['content_strat']}</a></li><li><a href="{services_base}/lokalais-seo/">{labels['local']}</a></li></ul></div>
    <div><div class="footer__heading">{'Citi' if is_lv else 'Other'}</div><ul class="footer__links"><li><a href="{services_base}/majaslapas-izstrade/">{labels['webdev']}</a></li></ul></div>
    <div><div class="footer__heading">{'Saziņa' if is_lv else 'Contact'}</div><div class="footer__contact-item"><a href="mailto:sales@latseo.com">sales@latseo.com</a></div><div class="footer__contact-item"><a href="tel:+37124424434">+371 24424434</a></div><div class="footer__contact-item"><span>Rīga, Latvija</span></div></div>
  </div><div class="footer__bottom"><p>&copy; {date.today().year} LatSEO. {'Visas tiesības aizsargātas.' if is_lv else 'All rights reserved.'}</p></div></div></footer>
  <script src="{base_path}js/main.js"></script>
  <button class="scroll-top" aria-label="{'Uz augšu' if is_lv else 'Back to top'}">↑</button>
</body></html>"""


def update_index(index_path: Path, title: str, slug: str, desc: str, category: str, date_str: str, image_src: str, image_alt: str, lang: str):
    """Insert a new blog card at the top of a blog index page."""
    if not index_path.exists():
        return
    content = index_path.read_text(encoding="utf-8")
    marker = 'id="blog-posts-container"'
    pos = content.find(marker)
    if pos == -1:
        return
    pos = content.find(">", pos) + 1
    blog_base = "/blogs/" if lang == "lv" else "/en/blogs/"
    read_more = "Lasīt vairāk" if lang == "lv" else "Read more"
    card = f"""
          <article class="service-card">
            <a href="{blog_base}{slug}/" style="display:block;margin-bottom:var(--sp-md)">
              <img src="{image_src}" alt="{image_alt}" style="width:100%;height:auto;border-radius:var(--br-lg)" loading="lazy">
            </a>
            <div style="font-size:var(--fs-xs);color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--sp-2xs)">{category} &middot; {date_str}</div>
            <h3 class="service-card__title">
              <a href="{blog_base}{slug}/" style="color:inherit;text-decoration:none">{title}</a>
            </h3>
            <p class="service-card__text">{desc}</p>
            <a href="{blog_base}{slug}/" class="service-card__link">{read_more} <span class="service-card__link-arrow">→</span></a>
          </article>"""
    new_content = content[:pos] + card + content[pos:]
    index_path.write_text(new_content, encoding="utf-8")


async def status_command(update, context):
    """Handle /status command."""
    if not PROGRESS_FILE.exists():
        save_json(PROGRESS_FILE, {"lastPublishedDay": 0, "lastPublishedDate": None, "publishedPosts": []})
    progress = load_json(PROGRESS_FILE)
    last_day = progress.get("lastPublishedDay", 0)
    next_day = last_day + 1
    
    if next_day > 365:
        status = "🎉 Visi 365 raksti publicēti!"
    else:
        topic = get_day_info(next_day)
        status = (
            f"📊 *Status*\n"
            f"Publicēti: {last_day}/365 raksti\n"
            f"Nākamais: #{next_day} — {topic['topicTitle'][:60]}...\n"
            f"Gaidu komandu /jauns"
        )
    
    await update.message.reply_text(status, parse_mode="Markdown")


async def skip_command(update, context):
    """Handle /izlaist — skip today's post."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    user_state["awaiting_answers"] = False
    await update.message.reply_text("⏭️ Šodienas raksts izlaists. Rīt turpināsim ar nākamo tēmu.")


# ── LinkedIn Post Generation ──────────────────────────────────────────────────

# Track LinkedIn mode state
linkedin_state = {"selecting": False, "posts": []}


async def list_posts_command(update, context):
    """Handle /raksti — list all published blog posts for LinkedIn selection."""
    global linkedin_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    progress = load_json(PROGRESS_FILE) if PROGRESS_FILE.exists() else {"publishedPosts": [], "linkedinPosts": []}
    posts = progress.get("publishedPosts", [])
    linkedin_used = progress.get("linkedinPosts", [])

    if not posts:
        await update.message.reply_text("📭 Nav neviena publicēta raksta. Sāc ar /jauns!")
        return

    linkedin_state["selecting"] = True
    linkedin_state["posts"] = posts
    linkedin_state["linkedin_used"] = linkedin_used

    text = "📋 *Publicētie raksti:*\n\n"
    for i, post in enumerate(posts, 1):
        used = "🔗" if post.get("lvSlug") in linkedin_used else "⬜"
        title = post.get("titleLV", f"Day {post.get('day', '?')}")[:60]
        text += f"*{i}.* {used} {title}\n"

    text += "\n🔗 = jau izmantots LinkedIn\n⬜ = vēl nav postots\n\n"
    text += "Atbildi ar *numuru*, lai ģenerētu LinkedIn postu."
    
    await update.message.reply_text(text, parse_mode="Markdown")


async def handle_linkedin_number(update, context):
    """Handle number input when user is selecting a post for LinkedIn."""
    global linkedin_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    if not linkedin_state.get("selecting"):
        return  # Not in LinkedIn selection mode

    try:
        num = int(update.message.text.strip())
        posts = linkedin_state["posts"]
        
        if num < 1 or num > len(posts):
            await update.message.reply_text(f"⚠️ Izvēlies skaitli no 1 līdz {len(posts)}.")
            return

        post = posts[num - 1]
        lv_slug = post.get("lvSlug", "")
        title = post.get("titleLV", "Bloga raksts")
        
        # Find the blog post HTML file
        blog_path = PROJECT_ROOT / "blogs" / lv_slug / "index.html"
        if not blog_path.exists():
            await update.message.reply_text("⚠️ Nevaru atrast raksta failu. Varbūt tas vēl nav sinhronizēts.")
            return

        # Extract text content from HTML
        html = blog_path.read_text(encoding="utf-8")
        # Get content between blog-content div
        content_match = re.search(r'<div class="blog-content"[^>]*>(.*?)</div>\s*<div style="margin-top', html, re.DOTALL)
        if not content_match:
            content_match = re.search(r'<div class="blog-content"[^>]*>(.*?)</div>', html, re.DOTALL)
        
        if not content_match:
            await update.message.reply_text("⚠️ Nevaru izgūt raksta saturu.")
            return

        raw_html = content_match.group(1)
        # Strip HTML tags for the prompt
        plain_text = re.sub(r'<[^>]+>', ' ', raw_html)
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()

        await update.message.reply_text(f"✍️ Ģenerēju LinkedIn postu no: *{title}*...", parse_mode="Markdown")

        # Generate LinkedIn post
        linkedin_text = generate_linkedin_post(title, plain_text, lv_slug)

        linkedin_state["selecting"] = False

        await update.message.reply_text(
            f"✅ *LinkedIn posts gatavs!*\n\n"
            f"{linkedin_text}\n\n"
            f"📋 _Nokopē augstāk esošo tekstu un ielīmē LinkedIn._\n"
            f"Kad izdarīts, raksti /li_ok lai atzīmētu kā izmantotu.",
            parse_mode="Markdown",
            disable_web_page_preview=True
        )

    except ValueError:
        pass  # Not a number, ignore


async def linkedin_ok_command(update, context):
    """Handle /li_ok — mark the last generated LinkedIn post as used."""
    global linkedin_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    posts = linkedin_state.get("posts", [])
    if not posts:
        await update.message.reply_text("Nav aktīvas LinkedIn sesijas. Raksti /raksti vispirms.")
        return

    # Get the last viewed post from the previous selection
    # We need to store it — let's use the last post that was selected
    # For now, ask the user which one
    await update.message.reply_text(
        "Kuru rakstu tu ieliki LinkedIn? Atbildi ar numuru.\n"
        "Raksti /raksti lai redzētu sarakstu vēlreiz."
    )


def generate_linkedin_post(title: str, content: str, slug: str) -> str:
    """Generate a LinkedIn post from blog content using DeepSeek."""
    from openai import OpenAI
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

    prompt = f"""Pārveido šo bloga rakstu par LinkedIn postu latviešu valodā.

NOTEIKUMI:
- 150-300 vārdi (LinkedIn optimālais garums)
- Sāc ar spēcīgu hook/uzmanības piesaistītāju (1. teikums)
- Saglabā personīgo toni — raksti 1. personā
- Izmanto īsus teikumus, rindkopas atdalītas ar tukšu rindu
- Beigās 1-2 hashtags (piem., #SEO #Latvija)
- Iekļauj saiti uz rakstu: https://latseo.com/blogs/{slug}/
- NAV Markdown, NAV zvaigznīšu, NAV formatējuma. Tikai tīrs teksts.

BLOGA RAKSTS:
Virsraksts: {title}
Saturs: {content[:3000]}

Atgriez TIKAI gatavo LinkedIn posta tekstu, bez paskaidrojumiem."""

    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1000,
    )
    return response.choices[0].message.content.strip()


async def linkedin_mark_command(update, context):
    """Handle /li_mark N — mark post N as used on LinkedIn."""
    global linkedin_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        return

    args = update.message.text.strip().split()
    if len(args) < 2:
        await update.message.reply_text("Lieto: /li_mark [numurs]\nPiemērs: /li_mark 1")
        return

    try:
        num = int(args[1])
    except ValueError:
        await update.message.reply_text("Jānorāda skaitlis. Piemērs: /li_mark 1")
        return

    progress = load_json(PROGRESS_FILE) if PROGRESS_FILE.exists() else {"publishedPosts": [], "linkedinPosts": []}
    posts = progress.get("publishedPosts", [])
    
    if num < 1 or num > len(posts):
        await update.message.reply_text(f"⚠️ Izvēlies skaitli no 1 līdz {len(posts)}.")
        return

    post = posts[num - 1]
    lv_slug = post.get("lvSlug", "")

    if "linkedinPosts" not in progress:
        progress["linkedinPosts"] = []

    if lv_slug in progress["linkedinPosts"]:
        await update.message.reply_text("⚠️ Šis raksts jau ir atzīmēts kā izmantots LinkedIn.")
        return

    progress["linkedinPosts"].append(lv_slug)
    save_json(PROGRESS_FILE, progress)
    
    await update.message.reply_text(f"✅ Raksts #{num} atzīmēts kā izmantots LinkedIn!")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    """Start the Telegram bot."""
    if not BOT_TOKEN:
        print("❌ BOT_TOKEN nav iestatīts!")
        sys.exit(1)
    if not ADMIN_CHAT_ID:
        print("❌ ADMIN_CHAT_ID nav iestatīts!")
        sys.exit(1)
    if not DEEPSEEK_API_KEY:
        print("❌ DEEPSEEK_API_KEY nav iestatīts!")
        sys.exit(1)

    # Start a tiny HTTP server in background to satisfy Render's port check
    import threading
    from http.server import HTTPServer, BaseHTTPRequestHandler
    
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        def do_POST(self):
            # Telegram sends POST to /telegram — health server shouldn't handle these
            self.send_response(404)
            self.end_headers()
        def log_message(self, format, *args):
            pass  # silence logs
    
    port = int(os.environ.get("PORT", "10000"))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"🌐 Health check server on port {port}")

    from telegram.ext import Application, CommandHandler, MessageHandler, filters

    app = Application.builder().token(BOT_TOKEN).build()

    # Command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("jauns", new_post_command))
    app.add_handler(CommandHandler("publicet", publish_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("izlaist", skip_command))
    app.add_handler(CommandHandler("raksti", list_posts_command))
    app.add_handler(CommandHandler("li_ok", linkedin_ok_command))
    app.add_handler(CommandHandler("li_mark", linkedin_mark_command))

    # Message handler (for answers)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Schedule daily job at 06:00 UTC = 09:00 Latvia time
    app.job_queue.run_daily(
        auto_daily_trigger,
        time=time(hour=6, minute=0, tzinfo=timezone.utc),
    )

    # Delete any leftover webhook, then use polling
    import urllib.request
    try:
        urllib.request.urlopen(f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook?drop_pending_updates=true", timeout=5)
    except:
        pass

    print("🤖 LatSEO Blog Bot started! Polling for messages...")
    app.run_polling(drop_pending_updates=True)
    app.run_polling()


async def auto_daily_trigger(context):
    """Send daily prompt to admin at 09:00."""
    try:
        # Auto-initialize progress file if missing
        if not PROGRESS_FILE.exists():
            save_json(PROGRESS_FILE, {"lastPublishedDay": 0, "lastPublishedDate": None, "publishedPosts": []})
            
        progress = load_json(PROGRESS_FILE)
        day_number = progress.get("lastPublishedDay", 0) + 1
        
        if day_number > 365:
            return

        topic_info = get_day_info(day_number)
        questions = generate_questions(topic_info)

        global user_state
        user_state = {
            "awaiting_answers": True,
            "current_day": day_number,
            "current_topic": topic_info,
            "questions": questions,
            "answers": [],
            "question_index": 0,
        }

        q_text = f"🌅 *Labrīt! Šodienas raksts #{day_number}/365*\n\n"
        q_text += f"📝 {topic_info['topicTitle']}\n"
        q_text += f"🎨 {topic_info['styleLV']}\n\n"
        q_text += "📋 *Jautājumi:*\n\n"
        for i, q in enumerate(questions, 1):
            q_text += f"*{i}.* {q}\n\n"
        q_text += "Atbildi uz jautājumiem, tad raksti /publicet"

        await context.bot.send_message(chat_id=ADMIN_CHAT_ID, text=q_text, parse_mode="Markdown")
    except Exception as e:
        print(f"Auto trigger error: {e}")


if __name__ == "__main__":
    main()
