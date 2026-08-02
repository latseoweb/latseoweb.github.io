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

# Paths (relative to the repo root on Render)
REPO_DIR = Path("/app/repo")  # Will be cloned here
TOPICS_FILE = REPO_DIR / "scripts" / "topics.json"
PROGRESS_FILE = REPO_DIR / "scripts" / ".blog-progress.json"

# Timezone
LV_TZ_HOUR = 3  # Latvia is UTC+3 (summer) / UTC+2 (winter)

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
    with open(path, "r", encoding="utf-8") as f:
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
        "/status - pārbaudīt statusu"
    )


async def new_post_command(update, context):
    """Handle /jauns — start a new blog post Q&A now."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Tikai administrators var veidot rakstus.")
        return

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
    """Handle user's answers."""
    global user_state
    
    if update.effective_user.id != ADMIN_CHAT_ID:
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

    if not user_state["awaiting_answers"]:
        await update.message.reply_text("Nav aktīva raksta. Raksti /jauns lai sāktu.")
        return

    if len(user_state["answers"]) < len(user_state["questions"]):
        missing = len(user_state["questions"]) - len(user_state["answers"])
        await update.message.reply_text(f"⚠️ Trūkst {missing} atbildes. Atbildi uz visiem jautājumiem.")
        return

    await update.message.reply_text("✍️ Ģenerēju bloga rakstu... Tas var aizņemt ~30 sekundes.")

    try:
        # Generate LV content
        lv_content = generate_blog_post(
            user_state["current_topic"],
            user_state["questions"],
            user_state["answers"],
            "lv"
        )
        lv_content["content"] = format_html_content(lv_content["content"])
        
        # Generate EN content
        en_content = generate_blog_post(
            user_state["current_topic"],
            user_state["questions"],
            user_state["answers"],
            "en"
        )
        en_content["content"] = format_html_content(en_content["content"])

        lv_slug = user_state["current_topic"]["topicSlug"]
        en_slug = slugify(en_content["title"][:80])
        day = user_state["current_day"]
        image_src = f"https://picsum.photos/seed/day{day}/1200/628"
        image_alt = lv_content.get("imageQuery", "SEO blog illustration")

        # Build HTML (simplified — full template available in generate_post.py)
        # For now, commit the generated content directly
        # The full HTML build would replicate build_blog_html() from generate_post.py
        
        await update.message.reply_text(
            f"✅ *Raksts uzģenerēts!*\n\n"
            f"📝 {lv_content['title']}\n"
            f"🔗 /blogs/{lv_slug}/\n\n"
            f"Bet man vēl jāintegrē pilna HTML ģenerēšana un commit/push.\n"
            f"Pagaidām — šeit ir tavs saturs:\n\n"
            f"{lv_content['content'][:500]}...",
            parse_mode="Markdown"
        )

        user_state["awaiting_answers"] = False

    except Exception as e:
        await update.message.reply_text(f"❌ Kļūda: {str(e)}")


async def status_command(update, context):
    """Handle /status command."""
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


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
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

    from telegram.ext import Application, CommandHandler, MessageHandler, filters

    app = Application.builder().token(BOT_TOKEN).build()

    # Command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("jauns", new_post_command))
    app.add_handler(CommandHandler("publicet", publish_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("izlaist", skip_command))

    # Message handler (for answers)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Schedule daily job using the application's job queue (no separate scheduler needed)
    # Runs at 06:00 UTC = 09:00 Latvia time
    app.job_queue.run_daily(
        auto_daily_trigger,
        time=time(hour=6, minute=0, tzinfo=timezone.utc),
    )

    print("🤖 LatSEO Blog Bot started! Waiting for messages...")
    await app.run_polling()


async def auto_daily_trigger(context):
    """Send daily prompt to admin at 09:00."""
    try:
        # Reload from file in case Render wiped in-memory state
        progress_path = Path("/app/repo/scripts/.blog-progress.json")
        if progress_path.exists():
            progress = load_json(progress_path)
        else:
            progress = {"lastPublishedDay": 0, "publishedPosts": []}
            
        day_number = progress.get("lastPublishedDay", 0) + 1
        
        if day_number > 365:
            return

        # We need the topics file
        topics_path = Path("/app/repo/scripts/topics.json")
        if not topics_path.exists():
            print("Topics file not found, skipping daily trigger")
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
    asyncio.run(main())
