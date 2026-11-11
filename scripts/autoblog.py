#!/usr/bin/env python3
"""LatSEO daily blog post (no Telegram).

Takes the next topic from scripts/autoblog-topics.json, has Claude write a Latvian post
in the _src/blog format (rules from _src/BLOG-BRIEF.md), checks its internal links,
links the new post from its related posts, renders a cover, rebuilds the site with
scripts/build.py, commits and pushes. Runs daily on the ThinkPad (deploy/autoblog/).

Run from anywhere:
  python3 scripts/autoblog.py              # write, build, commit, push
  python3 scripts/autoblog.py --no-push    # write, build, commit locally
  python3 scripts/autoblog.py --dry-run    # print the post, change nothing
  python3 scripts/autoblog.py --from-file post.html --no-git   # skip Claude (tests)
Env: ANTHROPIC_API_KEY, optional AUTOBLOG_MODEL, AUTOBLOG_FONTS (dir with cover fonts).
"""
import argparse
import datetime as dt
import html
import json
import os
import pathlib
import re
import subprocess
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
TOPICS = ROOT / "scripts" / "autoblog-topics.json"
BRIEF = SRC / "BLOG-BRIEF.md"
COVERS = ROOT / "assets" / "covers"
MODEL = os.environ.get("AUTOBLOG_MODEL", "claude-sonnet-5-5")
CATEGORIES = ["Mājaslapu izstrāde", "SEO pamati", "Tehniskais SEO", "Lokālais SEO", "SEO cenas"]
EXTRA_TARGETS = {"/majaslapas-izstrade/#kalkulators": "Mājaslapas cenu kalkulators", "/blogs/": "Visi bloga raksti"}
SKIP_PAGES = {"/404.html", "/paldies/"}
MIN_LINKS, MIN_WORDS, MAX_WORDS = 3, 700, 1500
# Every post links to the main service page; the anchor rotates through the phrases people search
# (DataForSEO, Latvia, 2026-11: mājaslapu/mājas lapas izstrāde 480/mo, mājas lapas izveide 260, mājaslapas izveide 210).
# Blog posts support that page and must not compete with it for these phrases.
MONEY_PAGE = "/majaslapas-izstrade/"
MONEY_ANCHORS = ["mājaslapas izveide", "mājas lapas izstrāde", "mājaslapu izstrāde", "mājas lapas izveide",
                 "mājaslapas izstrāde", "mājaslapas izveide uzņēmumam", "mājas lapu izstrāde"]
META_RE = re.compile(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", re.S)


def log(*a):
    print("[autoblog]", *a, flush=True)


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, check=check, text=True, capture_output=True)


def read_meta(p):
    text = p.read_text(encoding="utf-8")
    m = META_RE.match(text)
    return json.loads(m.group(1)), text[m.end():]


def write_source(p, meta, body):
    p.write_text("<!--meta\n" + json.dumps(meta, ensure_ascii=False, indent=2) + "\n-->\n" + body.strip() + "\n",
                 encoding="utf-8")


def slugify(s, limit=70):
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:limit].rsplit("-", 1)[0] if len(s) > limit else s


def strip_tags(s):
    return re.sub(r"<[^>]+>", " ", s)


# ---------------------------------------------------------------- site inventory
def inventory():
    """Existing LV posts and pages: the only allowed internal link targets."""
    posts = []
    for p in sorted((SRC / "blog").glob("*.html")):
        m, _ = read_meta(p)
        posts.append({"path": m["path"], "h1": m["h1"], "category": m["category"], "date": m["date"], "src": p})
    pages = {}
    for p in sorted((SRC / "pages").glob("*.html")):
        m, _ = read_meta(p)
        if m["path"] not in SKIP_PAGES:
            pages[m["path"]] = m["title"].split(" | ")[0]
    return posts, pages


# ---------------------------------------------------------------- topics
def load_topics():
    return json.loads(TOPICS.read_text(encoding="utf-8"))


def save_topics(data):
    TOPICS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def refill_topics(client, data, posts):
    """Queue ran dry: ask Claude for 30 new search-intent topics."""
    from pydantic import BaseModel

    class Topic(BaseModel):
        title: str
        keyword: str
        category: str
        cta: str

    class Topics(BaseModel):
        topics: list[Topic]

    taken = [t["title"] for t in data["topics"]] + [p["h1"] for p in posts]
    prompt = (
        "Tu plāno bloga tēmas latseo.com (Adrians Stankevičs, mājaslapu izstrāde ar SEO un SEO pakalpojumi Rīgā, "
        "klienti — mazi un vidēji Latvijas uzņēmumi). Galvenais mērķis: lai uzņēmumu atrod pēc frāzēm „mājaslapas "
        "izveide” un „mājas lapas izstrāde”. Piedāvā 30 jaunas tēmas latviešu valodā: vismaz 22 par mājaslapu un "
        "e-veikalu izveidi (process, izvēles, izmaksas, nozares, saturs, dizains, uzturēšana), pārējās par SEO. "
        "Katrai vienu galveno meklēšanas frāzi, ko Latvijas uzņēmējs reāli raksta Google; NE pašas frāzes „mājaslapas "
        "izveide”, „mājaslapu izstrāde” (tās pieder pakalpojuma lapai). Tēmām jābūt informatīvām (kā, kas, cik, kāpēc) "
        "un nedrīkst pārklāties savā starpā vai ar jau esošajām:\n- " + "\n- ".join(taken) +
        f"\n\ncategory: viena no {CATEGORIES}. cta: \"web\" tēmām par jaunu mājaslapu, citādi \"audit\". "
        "Bez personīgiem stāstiem, kas prasa faktus, kurus nevar zināt.")
    resp = client.messages.parse(model=MODEL, max_tokens=16000, output_format=Topics,
                                 messages=[{"role": "user", "content": prompt}])
    new = [t.model_dump() for t in resp.parsed_output.topics if t.category in CATEGORIES and t.cta in ("web", "audit")]
    data["topics"].extend(new)
    log(f"added {len(new)} topics")


def next_topic(client, data, posts):
    todo = [t for t in data["topics"] if not t.get("done")]
    if not todo:
        refill_topics(client, data, posts)
        todo = [t for t in data["topics"] if not t.get("done")]
    return todo[0]


# ---------------------------------------------------------------- prompt
def brief_rules():
    """Facts and format rules from BLOG-BRIEF.md (the rewrite table at the end does not apply)."""
    text = BRIEF.read_text(encoding="utf-8")
    style = text.split("## FAKTI")[0].split("## Mērķis")[-1]
    rules = "## FAKTI" + text.split("## FAKTI", 1)[1].split("## Rakstu tabula")[0]
    return style.strip() + "\n\n" + rules.strip()


def system_prompt(posts, pages, anchor):
    links = "\n".join(f"- {p} — {t}" for p, t in {**pages, **EXTRA_TARGETS}.items())
    blog = "\n".join(f"- {p['path']} — {p['h1']} ({p['category']})" for p in posts)
    return f"""Tu raksti jaunus bloga rakstus mājaslapai latseo.com Adriana Stankeviča vārdā. Raksti latviešu valodā, ar pareizu gramatiku un dabisku valodu, nevis tulkojumu no angļu valodas.

Raksta mērķis: noderīgi un konkrēti atbildēt uz to, ko Latvijas uzņēmējs meklē Google ar doto frāzi, un dabiski novest lasītāju līdz atbilstošajam pakalpojumam.

{brief_rules()}

## Jauna raksta papildnoteikumi
- Šis ir JAUNS raksts, nevis pārrakstīšana — punkts par oriģinālā raksta saglabāšanu neattiecas.
- Neizdomā personīgus stāstus, klientus, skaitļus vai rezultātus. Personīgo pieredzi drīkst minēt tikai no sadaļas FAKTI.
- Galvenā frāze title, h1, ievadā (lead) un vismaz vienā h2 — dabiski, bez pārspīlēšanas.
- {MIN_LINKS}–6 iekšējās saites tekstā ar aprakstošu enkura tekstu. Saites drīkst būt TIKAI uz šīm adresēm:
{links}
{blog}
- Obligāti viena saite uz {MONEY_PAGE}, kuras enkura teksts balstās uz frāzi „{anchor}”. Frāzi loki atbilstoši teikumam (piemēram, „pasūtīt mājaslapas izveidi”, „par mājas lapas izstrādi”); teikumam jābūt gramatiski pareizam un dabiskam, nevis frāzei iespraustai nelocītā formā.
- Title un h1 nedrīkst būt vispārīgas frāzes „mājaslapas izveide”, „mājaslapu izstrāde” vai „mājas lapas izstrāde” — uz tām ranžējas pakalpojuma lapa {MONEY_PAGE}; raksts atbild uz šaurāku jautājumu.
- Nesaisti divreiz uz vienu adresi. Ārējās saites neliec.
- Ja tēma pārklājas ar kādu esošo rakstu, izvēlies citu skatpunktu un saisti uz esošo rakstu, nevis atkārto to.
- Pievieno BUJ bloku ar 3–4 jautājumiem (formāts no instrukcijas).
- "related_paths": 3 tematiski tuvākie raksti no saraksta augstāk (tikai /blogs/... adreses).
- "slug": īss latīņu burtu URL bez garumzīmēm (3–6 vārdi, ar defisēm), balstīts uz galveno frāzi.

## Pirms atbildes
Pārlasi visu tekstu kā latviešu valodas redaktors: izlabo locījumus, vārdu secību un neveiklus teikumus (piem., „tas man ir mācījies” → „to iemācījos”), pārbaudi, ka nav „mēs” formas arī darbības vārdos („pārejam” → „pārejiet” vai „pāreju”).

## Atbildes formāts
Atbildē izvadi TIKAI faila saturu, sākot ar <!--meta. Meta JSON laukos: "slug", "title", "description", "h1", "category", "cta", "related_paths". Lauki path, date un modified tiek pievienoti automātiski."""


def user_prompt(topic):
    return (f"Uzraksti rakstu.\nTēma: {topic['title']}\nGalvenā meklēšanas frāze: {topic['keyword']}\n"
            f"Kategorija: {topic['category']}\ncta: {topic['cta']}")


# ---------------------------------------------------------------- generation
def ask_claude(client, system, messages):
    import anthropic
    with client.beta.messages.stream(
            model=MODEL, max_tokens=32000, system=system, messages=messages,
            output_config={"effort": "high"},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default") as stream:
        resp = stream.get_final_message()
    if resp.stop_reason == "refusal":
        raise SystemExit(f"model refused: {resp.stop_details}")
    if resp.stop_reason == "max_tokens":
        raise SystemExit("model hit max_tokens")
    u = resp.usage
    log(f"model={resp.model} in={u.input_tokens} out={u.output_tokens}")
    return resp, "".join(b.text for b in resp.content if b.type == "text")


def parse_and_check(raw, topic, posts, pages, anchor):
    """Returns (meta, body, errors). Silently fixes link problems it can fix."""
    raw = re.sub(r"^```(?:html)?\s*|\s*```\s*$", "", raw.strip())
    m = META_RE.match(raw)
    if not m:
        return None, None, ["Atbildei jāsākas ar <!--meta { ... } --> bloku."]
    try:
        meta = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        return None, None, [f"Meta JSON nav derīgs: {e}"]
    body = raw[m.end():].strip()
    errors = []

    post_paths = {p["path"] for p in posts}
    allowed = set(pages) | set(EXTRA_TARGETS) | post_paths
    seen = set()

    def fix_link(a):
        href, inner = a.group(1), a.group(2)
        if href not in allowed or href in seen:
            return inner                      # unknown/external/duplicate → plain text
        seen.add(href)
        return f'<a href="{href}">{inner}</a>'
    body = re.sub(r'<a\s+[^>]*?href="([^"]*)"[^>]*>(.*?)</a>', fix_link, body, flags=re.S)
    money = re.findall(rf'<a href="{MONEY_PAGE}">(.*?)</a>', body, re.S)
    if not any(re.search(r"izveid|izstrād", strip_tags(a), re.I) for a in money):
        errors.append(f"Vajag vienu saiti uz {MONEY_PAGE} ar enkura tekstu „{anchor}”.")
    if len(seen) < MIN_LINKS:
        errors.append(f"Tekstā ir tikai {len(seen)} derīgas iekšējās saites, vajag vismaz {MIN_LINKS} uz atļautajām adresēm.")

    for k in ("slug", "title", "description", "h1"):
        if not str(meta.get(k, "")).strip():
            errors.append(f"Meta laukā trūkst \"{k}\".")
    if meta.get("category") not in CATEGORIES:
        meta["category"] = topic["category"]
    if meta.get("cta") not in ("web", "audit"):
        meta["cta"] = topic["cta"]
    rel = [p for p in meta.get("related_paths", []) if p in post_paths]
    meta["related_paths"] = list(dict.fromkeys(rel))[:3]

    if re.search(r"<(img|script|style|h1)\b|\sstyle=", body, re.I):
        errors.append("Tekstā nedrīkst būt <img>, <script>, <style>, <h1> vai style= atribūti.")
    ids = re.findall(r'<h2 id="([^"]+)"', body)
    if len(re.findall(r"<h2\b", body)) != len(ids) or len(ids) != len(set(ids)) or len(ids) < 3:
        errors.append("Vajag vismaz 3 <h2>, katram unikāls id.")
    if not body.startswith('<p class="lead">'):
        errors.append('Tekstam jāsākas ar <p class="lead">.')
    words = len(strip_tags(body).split())
    if not MIN_WORDS <= words <= MAX_WORDS:
        errors.append(f"Garums ir {words} vārdi, vajag {MIN_WORDS}–{MAX_WORDS}.")
    if "!" in strip_tags(body):
        errors.append("Izņem izsaukuma zīmes.")
    if re.search(r"\b(mēs|mūsu|mums)\b", strip_tags(body), re.I):
        errors.append("Autors ir viena persona: nelieto „mēs”, „mūsu”, „mums” par sevi.")
    if re.search(r"\b(tu|tev|tavs|tava|tavu|tavā)\b", strip_tags(body)):
        errors.append("Uzruna vienmēr „Jūs/Jūsu/Jums” ar lielo burtu, nekad „tu/tev/tavs”.")
    return meta, body, errors


def generate(client, topic, posts, pages, anchor):
    system = system_prompt(posts, pages, anchor)
    messages = [{"role": "user", "content": user_prompt(topic)}]
    for attempt in range(3):
        resp, raw = ask_claude(client, system, messages)
        meta, body, errors = parse_and_check(raw, topic, posts, pages, anchor)
        if not errors:
            return meta, body
        log(f"attempt {attempt + 1} rejected:", "; ".join(errors))
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": "Izlabo un izvadi visu failu vēlreiz:\n- " + "\n- ".join(errors)}]
    raise SystemExit("post failed checks 3 times, nothing published")


# ---------------------------------------------------------------- publishing
def link_back(new_path, related, posts):
    """Put the new post first in the 'Citi raksti' cards of its related posts."""
    by_path = {p["path"]: p for p in posts}
    for path in related:
        src = by_path[path]["src"]
        meta, body = read_meta(src)
        meta["related_paths"] = [new_path] + [p for p in meta.get("related_paths", []) if p != new_path][:2]
        write_source(src, meta, body)


def render_cover(slug, title, tag, index):
    """1200x630 cover in the style of scripts/make_covers.py, without a browser."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        log("Pillow missing, post uses the default OG image")
        return
    fonts = pathlib.Path(os.environ.get("AUTOBLOG_FONTS", ROOT / "scripts" / "fonts"))
    head_f, mono_f = fonts / "SchibstedGrotesk.ttf", fonts / "IBMPlexMono-Regular.ttf"
    if not (head_f.exists() and mono_f.exists()):
        log(f"cover fonts not in {fonts}, post uses the default OG image")
        return
    theme = [dict(bg="#FFFFFF", fg="#121614", line="#121614", tag="#1F6045", muted="#5A6560"),
             dict(bg="#121614", fg="#F1F4F2", line="#3A433E", tag="#9CC9B0", muted="#AEB8B3"),
             dict(bg="#F1F3F2", fg="#121614", line="#B7C0BB", tag="#153E2D", muted="#2D3430")][index % 3]

    def grotesk(size):
        f = ImageFont.truetype(str(head_f), size)
        try:
            f.set_variation_by_axes([700])
        except (OSError, AttributeError):
            pass
        return f
    size = 74 if len(title) < 38 else 64 if len(title) < 56 else 56
    big, mono, small = grotesk(size), ImageFont.truetype(str(mono_f), 22), ImageFont.truetype(str(mono_f), 21)
    img = Image.new("RGB", (1200, 630), theme["bg"])
    d = ImageDraw.Draw(img)
    d.text((80, 72), tag, font=mono, fill=theme["tag"])
    d.line([(80, 123), (1120, 123)], fill=theme["line"], width=2)
    lines, cur = [], ""
    for w in title.split():
        trial = f"{cur} {w}".strip()
        if d.textlength(trial, font=big) <= 1000 or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    y = 168
    for ln in lines[:4]:
        d.text((80, y), ln, font=big, fill=theme["fg"])
        y += int(size * 1.06)
    d.line([(80, 508), (1120, 508)], fill=theme["line"], width=2)
    d.text((80, 535), "LATSEO", font=grotesk(28), fill=theme["fg"])
    sub = "Adrians Stankevičs · latseo.com"
    d.text((1120 - d.textlength(sub, font=small), 540), sub, font=small, fill=theme["muted"])
    COVERS.mkdir(parents=True, exist_ok=True)
    img.save(COVERS / f"{slug}.jpg", quality=82, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the post, change nothing")
    ap.add_argument("--no-push", action="store_true", help="commit but do not push")
    ap.add_argument("--no-git", action="store_true", help="no pull, commit or push")
    ap.add_argument("--from-file", help="use this file as the model's answer (tests)")
    args = ap.parse_args()

    if not (args.no_git or args.dry_run):
        if os.environ.get("AUTOBLOG_RESET") == "1":
            # Server clone only: drop leftovers of a failed run so they are never committed
            git("fetch", "--quiet", "origin")
            git("reset", "--hard", "--quiet", "origin/main")
            git("clean", "-fdq")
        else:
            git("pull", "--ff-only", "--quiet")
    posts, pages = inventory()
    data = load_topics()
    client = None
    if not args.from_file:
        import anthropic
        client = anthropic.Anthropic()
    topic = next_topic(client, data, posts)
    anchor = MONEY_ANCHORS[len(posts) % len(MONEY_ANCHORS)]
    log("topic:", topic["title"], "| anchor:", anchor)

    if args.from_file:
        meta, body, errors = parse_and_check(pathlib.Path(args.from_file).read_text(encoding="utf-8"), topic, posts, pages, anchor)
        if errors:
            raise SystemExit("checks failed: " + "; ".join(errors))
    else:
        meta, body = generate(client, topic, posts, pages, anchor)

    today = dt.date.today().isoformat()
    slug = slugify(meta.pop("slug"))
    taken = {p["path"] for p in posts}
    base, n = slug, 2
    while f"/blogs/{slug}/" in taken or (ROOT / "blogs" / slug).exists():
        slug, n = f"{base}-{n}", n + 1
    path = f"/blogs/{slug}/"
    meta = {"path": path, "title": meta["title"] if meta["title"].endswith("| LatSEO") else meta["title"] + " | LatSEO",
            "description": meta["description"], "h1": meta["h1"], "category": meta["category"],
            "date": today, "modified": today, "cta": meta["cta"], "related_paths": meta["related_paths"]}

    if args.dry_run:
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        print(body)
        return

    write_source(SRC / "blog" / f"{slug}.html", meta, body)
    link_back(path, meta["related_paths"], posts)
    render_cover(slug, html.unescape(strip_tags(meta["h1"])).strip(), meta["category"], len(posts))
    topic.update(done=today, path=path)
    save_topics(data)
    subprocess.run([sys.executable, "scripts/build.py"], cwd=ROOT, check=True, capture_output=True)
    log("built", path)

    if args.no_git:
        return
    git("add", "-A")
    git("-c", "user.name=LatSEO Autoblog", "-c", "user.email=sales@latseo.com",
        "commit", "--quiet", "-m", f"Blogs: {meta['h1']}")
    if not args.no_push:
        git("push", "--quiet")
        log("pushed", f"https://latseo.com{path}")


if __name__ == "__main__":
    main()
