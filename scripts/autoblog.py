#!/usr/bin/env python3
"""LatSEO blog post v2: only real data (no Telegram).

Takes the first unpublished entry from scripts/autoblog-queue.json, gives Claude only that
entry's data (blog-stats.json subtrees + facts + sample size + period), has it write a Latvian
post in the _src/blog format (rules from _src/BLOG-BRIEF.md) and checks it before publishing:
format and internal links as in v1, plus a fact check (every number in title, description, h1
and text must come from the given data, prices or a short list of exceptions; banned phrases,
client names and generalisations). Failing 3 times → nothing is published, exit code 1.
Then it links the new post from its related posts, renders a cover, rebuilds the site with
scripts/build.py, commits and pushes. Entries with review: true (or AUTOBLOG_REVIEW=1) go to the
branch autoblog-review/<slug> instead of main. Runs Mon + Thu on the ThinkPad (autoblog-deploy/).

Run from anywhere:
  python3 scripts/autoblog.py              # write, check, build, commit, push
  python3 scripts/autoblog.py --no-push    # write, build, commit locally
  python3 scripts/autoblog.py --dry-run    # print the post and the check result, change nothing
  python3 scripts/autoblog.py --from-file post.html --no-git   # skip Claude (tests)
Env: ANTHROPIC_API_KEY, optional AUTOBLOG_MODEL, AUTOBLOG_FONTS (dir with cover fonts),
AUTOBLOG_STATS (default /var/lib/latseo/blog-stats.json), AUTOBLOG_REVIEW=1, AUTOBLOG_QUEUE (tests).
"""
import argparse
import ast
import datetime as dt
import html
import json
import os
import pathlib
import re
import subprocess
import sys
import unicodedata
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
QUEUE = pathlib.Path(os.environ.get("AUTOBLOG_QUEUE", ROOT / "scripts" / "autoblog-queue.json"))
STATS = pathlib.Path(os.environ.get("AUTOBLOG_STATS", "/var/lib/latseo/blog-stats.json"))
STATS_FALLBACK = ROOT / "_src" / "autoblog-data" / "blog-stats.json"
USED = ROOT / "_src" / "autoblog-data" / "used"      # DATI block each post was written from
PRICE_PAGE = SRC / "pages" / "pakalpojumi-un-cenas.html"
BUILD_PY = ROOT / "scripts" / "build.py"
BRIEF = SRC / "BLOG-BRIEF.md"
COVERS = ROOT / "assets" / "covers"
MODEL = os.environ.get("AUTOBLOG_MODEL", "claude-sonnet-5-5")
CATEGORIES = ["Mājaslapu izstrāde", "SEO pamati", "Tehniskais SEO", "Lokālais SEO", "SEO cenas"]
EXTRA_TARGETS = {"/majaslapas-izstrade/#kalkulators": "Mājaslapas cenu kalkulators", "/blogs/": "Visi bloga raksti"}
SKIP_PAGES = {"/404.html", "/paldies/"}
MIN_LINKS, MIN_WORDS, MAX_WORDS, MAX_TITLE = 3, 700, 1500, 60
REVIEW_PREFIX = "autoblog-review/"
# Never given to the model: unverified Google positions, cold e-mail reply data
PRIVATE_KEYS = {"google_pozicija", "aukstie_epasti"}
# Numbers always allowed: counting in text (0–10), years 2024–2027, HTTP codes (not statistics)
ALWAYS_OK = {str(n) for n in [*range(0, 11), *range(2024, 2028), 301, 404]}
BANNED_PHRASES = [r"pieredze rāda", r"no pieredzes zinu", r"grandem", r"nozarē kopumā"]
# Generalisation: a sentence about all Latvian companies / the whole sector together with a percentage
GENERAL_RE = re.compile(r"latvijas uzņēmum|\blatvijā\b|vis(?:i|iem|u|os|ās|as) uzņēmum", re.I)
PERCENT_RE = re.compile(r"\d\s*%|procent", re.I)
# Every post links to the main service page; the anchor rotates through the phrases people search
# (DataForSEO, Latvia, 2026-11: mājaslapu/mājas lapas izstrāde 480/mo, mājas lapas izveide 260, mājaslapas izveide 210).
# Blog posts support that page and must not compete with it for these phrases.
MONEY_PAGE = "/majaslapas-izstrade/"
MONEY_ANCHORS = ["mājaslapas izveide", "mājas lapas izstrāde", "mājaslapu izstrāde", "mājas lapas izveide",
                 "mājaslapas izstrāde", "mājaslapas izveide uzņēmumam", "mājas lapu izstrāde"]
META_RE = re.compile(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", re.S)
MONTHS = ["janvārī", "februārī", "martā", "aprīlī", "maijā", "jūnijā", "jūlijā", "augustā", "septembrī",
          "oktobrī", "novembrī", "decembrī"]


def log(*a):
    print("[autoblog]", *a, flush=True)


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, check=check, text=True, capture_output=True)


def read_meta(p):
    text = p.read_text(encoding="utf-8") if isinstance(p, pathlib.Path) else p
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


# ---------------------------------------------------------------- data
def drop_private(x):
    if isinstance(x, dict):
        return {k: drop_private(v) for k, v in x.items() if k not in PRIVATE_KEYS}
    if isinstance(x, list):
        return [drop_private(v) for v in x]
    return x


def load_stats():
    path = STATS
    if not path.exists():
        log(f"{path} nav, lietoju repo kopiju {STATS_FALLBACK.relative_to(ROOT)}")
        path = STATS_FALLBACK
    data = json.loads(path.read_text(encoding="utf-8"))
    made = str(data.get("izveidots", ""))[:10]
    try:
        age = (dt.date.today() - dt.date.fromisoformat(made)).days
        if age > 7:
            log(f"BRĪDINĀJUMS: dati {path} ir {age} dienas veci (izveidots {made})")
    except ValueError:
        log(f"BRĪDINĀJUMS: datiem {path} nav lauka izveidots")
    log("dati:", path)
    return drop_private(data)


SEG_RE = re.compile(r"^(.*?)(?:\[(\w+)=([^\]]*)\])?$")


def select(data, path):
    """'a.b.list[id=x,y]' → subtree. KeyError if anything is missing."""
    cur = data
    for seg in path.split("."):
        name, key, vals = SEG_RE.match(seg).groups()
        if not isinstance(cur, dict) or name not in cur:
            raise KeyError(f"{path}: nav „{name}” (vai tas ir aizliegts lauks)")
        cur = cur[name]
        if key:
            want = vals.split(",")
            cur = [x for x in cur if str(x.get(key)) in want]
            if len(cur) != len(want):
                raise KeyError(f"{path}: ne visi {key} atrasti")
    return cur


def period_text(periods):
    a, b = (dt.date.fromisoformat(p) for p in periods)
    if a == b:
        return f"{a.year}. gada {a.day}. {MONTHS[a.month - 1]}"
    if (a.year, a.month) == (b.year, b.month):
        return f"{a.year}. gada {a.day}.–{b.day}. {MONTHS[a.month - 1]}"
    return f"laikā no {a:%d.%m.%Y} līdz {b:%d.%m.%Y}"


def fill_title(title, stats):
    """'{lapu_parbaudes.n_parbauditas_lapas}' → value from the data at build time."""
    return re.sub(r"\{([^{}]+)\}", lambda m: num_str(select(stats, m.group(1))), title)


def dati_block(entry, stats):
    """Everything the model may use, as one JSON object."""
    lp = stats["lapu_parbaudes"]
    groups = lp.get("pa_nisam", {})
    niches = [k for k in groups if k != "citas nišas (kopā)"]
    more = lp.get("n_neparadītas_mazās_grupās") or len(niches) < len(groups)
    period = period_text(lp["periods"])
    nozares = f"{'vismaz ' if more else ''}{len(niches)} nozarēm"
    return {
        "izlase": {
            "apraksts": f"Rīgas un apkārtnes uzņēmumu mājaslapas no {nozares}, pārbaudītas {period}",
            "periods": lp["periods"],
            "periods_teksts": period,
            "n_parbauditas_lapas": lp["n_parbauditas_lapas"],
            "n_nozares_ar_vismaz_10_lapam": len(niches),
            "parbaude": "automātiska sākumlapas pārbaude un Google PageSpeed tests telefonam (laboratorijas mērījums)",
            "ierobežojumi": stats.get("nav_datu", []),
        },
        "dati": {k: select(stats, k) for k in entry.get("data_keys", [])},
        "facts": entry.get("facts", []),
    }


# ---------------------------------------------------------------- numbers
DATE_ISO = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
DATE_LV = re.compile(r"(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})?(?!\d)")
NUM_RE = re.compile(r"(?<!\w)(\d{1,3}(?:[   ]\d{3}(?!\d))+|\d+)(?:[.,](\d+))?")


def num_str(x):
    """Canonical form: 7.0 → '7', 43.50 → '43.5'."""
    d = Decimal(str(x))
    return str(int(d)) if d == d.to_integral_value() else format(d.normalize(), "f")


def extract_numbers(text):
    """[(raw, canonical, parts)] — parts are the space-separated groups of '2 174' (fallback check)."""
    out = []

    def date(m):
        d, mo = int(m.group(2 if m.re is DATE_ISO else 1)), int(m.group(3 if m.re is DATE_ISO else 2))
        if m.re is DATE_LV and not (1 <= d <= 31 and 1 <= mo <= 12):
            return m.group(0)
        out.extend((m.group(0), num_str(int(g)), []) for g in m.groups() if g)
        return " ¦ "
    text = DATE_LV.sub(date, DATE_ISO.sub(date, text))
    for m in NUM_RE.finditer(text):
        whole, frac = m.group(1), m.group(2)
        parts = re.split(r"[   ]", whole)
        value = "".join(parts) + (f".{frac}" if frac else "")
        out.append((m.group(0), num_str(value), [num_str(p) for p in parts] if len(parts) > 1 else []))
    return out


def add_value(out, v):
    d = Decimal(str(v))
    out.add(num_str(d))
    if d != d.to_integral_value():
        out.add(num_str(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
        out.add(num_str(d.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)))


def collect_numbers(obj, out):
    """All numbers in the DATI block: values, numbers inside strings and keys."""
    if isinstance(obj, bool) or obj is None:
        return
    if isinstance(obj, (int, float)):
        add_value(out, obj)
    elif isinstance(obj, str):
        for _, n, _ in extract_numbers(obj):
            add_value(out, n)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            collect_numbers(k, out)
            collect_numbers(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_numbers(v, out)
    return out


def build_py_strings():
    return [n.value for n in ast.walk(ast.parse(BUILD_PY.read_text(encoding="utf-8")))
            if isinstance(n, ast.Constant) and isinstance(n.value, str)]


PRICE_RE = re.compile(r"(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:&nbsp;)?\s*€|€\s*(\d{1,3}(?:,\d{3})+|\d+)")


def price_numbers():
    """Published LatSEO prices (pricing page + build.py), read from the source every run."""
    out = set()
    for text in [PRICE_PAGE.read_text(encoding="utf-8"), *[s for s in build_py_strings() if "€" in s]]:
        for m in PRICE_RE.finditer(text):
            out.add(num_str(re.sub(r"[  ,]", "", m.group(1) or m.group(2))))
    return out


def allowed_numbers(dati):
    return collect_numbers(dati, set()) | price_numbers() | ALWAYS_OK


def project_terms():
    """Client/project names and domains from PROJECTS in build.py (only for portfolio cards)."""
    tree = ast.parse(BUILD_PY.read_text(encoding="utf-8"))
    projects = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                    and any(getattr(t, "id", None) == "PROJECTS" for t in n.targets))
    terms = set()
    for key, (url, _img, name, *_) in projects.items():
        host = urlparse(url).hostname.removeprefix("www.")
        base = host.rsplit(".", 1)[0]
        terms |= {key, host, name, base, base.replace("-", "")}
    return sorted(terms, key=len, reverse=True)


def banned_res(entry):
    """(regex, message). Leading boundary only, so Latvian endings (autoestetikas) still match."""
    names = "|".join(re.escape(t) for t in project_terms())
    res = [(re.compile(rf"(?<![\w-])(?:{names})", re.I), "klientu/projektu nosaukumus un domēnus nedrīkst minēt")]
    res += [(re.compile(p, re.I), "aizliegta frāze") for p in BANNED_PHRASES]
    res += [(re.compile(re.escape(w), re.I), "šajā rakstā nedrīkst minēt") for w in entry.get("avoid", [])]
    return res


def fact_check(meta, body, dati, allowed, entry):
    """Errors for numbers not in DATI, banned names/phrases and generalisations."""
    errors, bad, hits = [], [], []
    fields = {"title": meta.get("title", ""), "description": meta.get("description", ""), "h1": meta.get("h1", ""),
              "teksts": body}
    for where, raw in fields.items():
        plain = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ¦ ", str(raw))))
        for found, n, parts in extract_numbers(plain):
            if n in allowed or (parts and all(p in allowed for p in parts)):
                continue
            i = plain.find(found)
            ctx = plain[max(0, i - 40):i + len(found) + 20].replace("¦", "").strip()
            bad.append(f"„{found.strip()}” ({where}: …{ctx}…)")
        for rx, why in banned_res(entry):
            for m in rx.finditer(plain):
                hits.append(f"„{m.group(0)}” ({where}) — {why}")
        for sentence in re.split(r"(?<=[.?!])\s+|¦", plain):
            if GENERAL_RE.search(sentence) and PERCENT_RE.search(sentence):
                hits.append(f"vispārinājums ar procentiem ({where}): „{sentence.strip()[:120]}” — dati ir tikai par izlasi")
    if bad:
        errors.append("Šo skaitļu nav DATI blokā (un tie nav cenas, gadi 2024–2027 vai 0–10). Izņem tos vai aizvieto ar "
                      "skaitli no DATI, neko nerēķinot: " + "; ".join(dict.fromkeys(bad)))
    errors += list(dict.fromkeys(hits))
    text = strip_tags(body)
    if entry.get("data_keys"):
        if not re.search(r"Rīgas un apkārtnes", text):
            errors.append(f"Nosauc izlasi: „{dati['izlase']['apraksts']}”.")
        month = MONTHS[dt.date.fromisoformat(dati["izlase"]["periods"][-1]).month - 1][:-1]
        if month not in text and dati["izlase"]["periods_teksts"] not in text:
            errors.append(f"Nosauc pārbaudes periodu: {dati['izlase']['periods_teksts']}.")
    if re.search(r"pagespeed", text, re.I) and "laboratorijas" not in text:
        errors.append("PageSpeed sauc par „Google PageSpeed testu (laboratorijas mērījums)” — tie nav reālu apmeklētāju dati.")
    return errors


# ---------------------------------------------------------------- queue
def load_queue():
    return json.loads(QUEUE.read_text(encoding="utf-8"))


def save_queue(data):
    QUEUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def check_entry(e, stats, targets):
    """Problems with a queue entry (bad entry → nothing is published)."""
    errs = []
    for k in ("slug", "title", "category", "angle", "data_keys", "facts", "links", "review"):
        if k not in e:
            errs.append(f"trūkst lauka {k}")
    if errs:
        return errs
    if e["slug"] != slugify(e["slug"]):
        errs.append("slug jābūt latīņu burtiem ar defisēm")
    if e["category"] not in CATEGORIES:
        errs.append(f"category nav no {CATEGORIES}")
    if not isinstance(e["review"], bool):
        errs.append("review jābūt true/false")
    for k in e["data_keys"]:
        if any(p in k for p in PRIVATE_KEYS):
            errs.append(f"{k}: aizliegts lauks")
            continue
        try:
            select(stats, k)
        except KeyError as x:
            errs.append(str(x))
    for f in e["facts"]:
        if not (isinstance(f, dict) and f.get("text") and f.get("source")):
            errs.append("katram facts vajag text un source")
    errs += [f"saite {link} nav esoša lapa" for link in e["links"] if link not in targets]
    try:
        if len(fill_title(e["title"], stats)) > MAX_TITLE:
            errs.append(f"title garāks par {MAX_TITLE} zīmēm")
    except KeyError as x:
        errs.append(f"title: {x}")
    return errs


def branch_ref(slug, use_git):
    """Review branch for this entry (remote first, then local) or None."""
    if not use_git:
        return None
    for ref in (f"refs/remotes/origin/{REVIEW_PREFIX}{slug}", f"refs/heads/{REVIEW_PREFIX}{slug}"):
        if git("rev-parse", "--verify", "--quiet", ref, check=False).returncode == 0:
            return ref
    return None


def pick(queue, use_git, force_review, only=None):
    """(entry, mode, ref): mode 'new' | 'review' | 'from_branch'; (None, ...) when the queue is empty."""
    for e in queue["queue"]:
        if only and e.get("slug") != only:
            continue
        if e.get("done") or (SRC / "blog" / f"{e['slug']}.html").exists():
            continue
        ref = branch_ref(e["slug"], use_git)
        if e.get("review") or force_review:
            if e.get("status") == "review_pending" or ref:
                log(f"{e['slug']}: gaida pārskatīšanu ({REVIEW_PREFIX}{e['slug']}), izlaižu")
                continue
            return e, "review", None
        if ref:
            return e, "from_branch", ref
        return e, "new", None
    return None, None, None


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

Raksta mērķis: parādīt īstus datus par dotu tēmu un noderīgi un konkrēti atbildēt uz to, ko uzņēmējs meklē Google, un dabiski novest lasītāju līdz atbilstošajam pakalpojumam.

{brief_rules()}

## DATI — vienīgais skaitļu avots (pārbauda automātiski pirms publicēšanas)
- Lietotāja ziņā ir bloks DATI (JSON): "izlase", "dati" un "facts". Katram skaitlim rakstā — arī title, description, h1, h2 un tabulās — jābūt no DATI. Ja vajadzīgā skaitļa DATI nav, raksti bez skaitļa.
- Nerēķini jaunus skaitļus (starpības, summas, jaunus procentus, „katrs trešais”). Drīkst noapaļot līdz veselam skaitlim vai vienai decimāldaļai (43,5 % → 44 %). Bez DATI drīkst lietot tikai skaitļus 0–10 skaitīšanai, gadus 2024–2027 un publicētās LatSEO cenas.
- Kad citē CRM pārbaudes datus, vienmēr nosauc izlasi un periodu, kā "izlase.apraksts" laukā (teikumā locīt dabiski). Pie atsevišķiem skaitļiem norādi n (piem., „53 no 207 lapām”).
- Par CRM datiem nekad neraksti „Latvijā”, „Latvijas uzņēmumi”, „visi uzņēmumi” vai „nozarē kopumā”: izlase nav reprezentatīva. Nišu procentus salīdzini uzmanīgi un piemini, ka nišās ir maz lapu.
- PageSpeed sauc par „Google PageSpeed testu (laboratorijas mērījums)”. Tie nav reālu apmeklētāju dati.
- "facts" citē ar avotu teikumā (piem., „latseo.com Search Console dati, 90 dienas līdz 26.11.2026”).
- Ja kādā laukā ir "piezīme" vai "ierobežojumi", ievēro to.
- Personīgu pieredzi raksti tikai ar konkrētu piemēru no FAKTI vai DATI. Frāzes „mana pieredze rāda”, „pieredze rāda”, „no pieredzes zinu” ir aizliegtas.
- Klientu, projektu un partneru nosaukumus un domēnus nemini (arī tos, kas ir FAKTI vai portfolio).

## Jauna raksta papildnoteikumi
- Šis ir JAUNS raksts, nevis pārrakstīšana — punkts par oriģinālā raksta saglabāšanu neattiecas.
- Neizdomā personīgus stāstus, klientus, skaitļus vai rezultātus.
- Galvenā frāze title, h1, ievadā (lead) un vismaz vienā h2 — dabiski, bez pārspīlēšanas. Title līdz {MAX_TITLE} zīmēm (bez „| LatSEO”).
- {MIN_LINKS}–6 iekšējās saites tekstā ar aprakstošu enkura tekstu. Saites drīkst būt TIKAI uz šīm adresēm:
{links}
{blog}
- Obligāti viena saite uz {MONEY_PAGE}, kuras enkura teksts balstās uz frāzi „{anchor}”. Frāzi loki atbilstoši teikumam (piemēram, „pasūtīt mājaslapas izveidi”, „par mājas lapas izstrādi”); teikumam jābūt gramatiski pareizam un dabiskam, nevis frāzei iespraustai nelocītā formā.
- Obligāti arī saites uz visām adresēm no lietotāja ziņas („Obligātās saites”).
- Title un h1 nedrīkst būt vispārīgas frāzes „mājaslapas izveide”, „mājaslapu izstrāde” vai „mājas lapas izstrāde” — uz tām ranžējas pakalpojuma lapa {MONEY_PAGE}; raksts atbild uz šaurāku jautājumu.
- Nesaisti divreiz uz vienu adresi. Ārējās saites neliec.
- Ja tēma pārklājas ar kādu esošo rakstu, izvēlies citu skatpunktu un saisti uz esošo rakstu, nevis atkārto to.
- Pievieno BUJ bloku ar 3–4 jautājumiem (formāts no instrukcijas).
- "related_paths": 3 tematiski tuvākie raksti no saraksta augstāk (tikai /blogs/... adreses).

## Pirms atbildes
Pārlasi visu tekstu kā latviešu valodas redaktors: izlabo locījumus, vārdu secību un neveiklus teikumus, pārbaudi, ka nav „mēs” formas arī darbības vārdos („atradām” → „atradu”, „pārejam” → „pārejiet”). Pārbaudi katru skaitli pret DATI.

## Atbildes formāts
Atbildē izvadi TIKAI faila saturu, sākot ar <!--meta. Meta JSON laukos: "slug", "title", "description", "h1", "category", "cta", "related_paths". Lauki path, date un modified tiek pievienoti automātiski."""


def user_prompt(entry, title, dati):
    return (f"Uzraksti rakstu.\nDarba virsraksts: {title}\nGalvenā meklēšanas frāze: {entry.get('keyword', title)}\n"
            f"Kategorija: {entry['category']}\ncta: {entry.get('cta', 'audit')}\n"
            f"Ko raksts parāda: {entry['angle']}\n"
            f"Obligātās saites: {', '.join(entry['links'])}\n\n"
            f"DATI:\n{json.dumps(dati, ensure_ascii=False, indent=1)}")


# ---------------------------------------------------------------- generation
def ask_claude(client, system, messages):
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


def parse_and_check(raw, entry, posts, pages, anchor, dati, allowed):
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
    allowed_links = set(pages) | set(EXTRA_TARGETS) | post_paths
    seen = set()

    def fix_link(a):
        href, inner = a.group(1), a.group(2)
        if href not in allowed_links or href in seen:
            return inner                      # unknown/external/duplicate → plain text
        seen.add(href)
        return f'<a href="{href}">{inner}</a>'
    body = re.sub(r'<a\s+[^>]*?href="([^"]*)"[^>]*>(.*?)</a>', fix_link, body, flags=re.S)
    money = re.findall(rf'<a href="{MONEY_PAGE}">(.*?)</a>', body, re.S)
    if not any(re.search(r"izveid|izstrād", strip_tags(a), re.I) for a in money):
        errors.append(f"Vajag vienu saiti uz {MONEY_PAGE} ar enkura tekstu „{anchor}”.")
    if len(seen) < MIN_LINKS:
        errors.append(f"Tekstā ir tikai {len(seen)} derīgas iekšējās saites, vajag vismaz {MIN_LINKS} uz atļautajām adresēm.")
    missing = [link for link in entry["links"] if link not in seen]
    if missing:
        errors.append("Trūkst obligāto saišu: " + ", ".join(missing))

    for k in ("title", "description", "h1"):
        if not str(meta.get(k, "")).strip():
            errors.append(f"Meta laukā trūkst \"{k}\".")
    if len(re.sub(r"\s*\|\s*LatSEO\s*$", "", str(meta.get("title", "")))) > MAX_TITLE:
        errors.append(f"Title garāks par {MAX_TITLE} zīmēm (bez „| LatSEO”).")
    if meta.get("category") not in CATEGORIES:
        meta["category"] = entry["category"]
    if meta.get("cta") not in ("web", "audit"):
        meta["cta"] = entry.get("cta", "audit")
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
    errors += fact_check(meta, body, dati, allowed, entry)
    return meta, body, errors


def generate(client, entry, title, posts, pages, anchor, dati, allowed):
    system = system_prompt(posts, pages, anchor)
    messages = [{"role": "user", "content": user_prompt(entry, title, dati)}]
    raw = ""
    for attempt in range(3):
        resp, raw = ask_claude(client, system, messages)
        meta, body, errors = parse_and_check(raw, entry, posts, pages, anchor, dati, allowed)
        if not errors:
            return meta, body
        log(f"attempt {attempt + 1} rejected:", "; ".join(errors))
        messages += [{"role": "assistant", "content": resp.content},
                     {"role": "user", "content": "Izlabo un izvadi visu failu vēlreiz:\n- " + "\n- ".join(errors)}]
    log("pēdējais noraidītais teksts:\n" + raw)
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



def sync_main():
    """Start every run on a clean, current main (the previous run may have left a review branch checked out)."""
    if os.environ.get("AUTOBLOG_RESET") == "1":
        # Server clone only: drop leftovers of a failed run so they are never committed
        git("fetch", "--quiet", "--prune", "origin")
        git("checkout", "--quiet", "-f", "-B", "main", "origin/main")
        git("clean", "-fdq")
    else:
        git("checkout", "--quiet", "main")
        git("pull", "--ff-only", "--quiet", "--prune")


def from_branch(ref, entry, stats):
    """Reviewed post on autoblog-review/<slug>: its source as a model answer + the DATI it was written from."""
    src = git("show", f"{ref}:_src/blog/{entry['slug']}.html").stdout
    meta, body = read_meta(src)
    meta["slug"] = entry["slug"]
    raw = "<!--meta\n" + json.dumps(meta, ensure_ascii=False) + "\n-->\n" + body
    snap = git("show", f"{ref}:{(USED / (entry['slug'] + '.json')).relative_to(ROOT)}", check=False)
    dati = json.loads(snap.stdout) if snap.returncode == 0 else dati_block(entry, stats)
    return raw, dati


def print_post(meta, body):
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    print(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the post and the check result, change nothing")
    ap.add_argument("--no-push", action="store_true", help="commit but do not push")
    ap.add_argument("--no-git", action="store_true", help="no pull, commit or push")
    ap.add_argument("--from-file", help="use this file as the model's answer (tests)")
    ap.add_argument("--entry", help="use this queue slug instead of the first unpublished one")
    args = ap.parse_args()
    use_git = not (args.no_git or args.dry_run)

    if use_git:
        sync_main()
    posts, pages = inventory()
    queue = load_queue()
    stats = load_stats()
    force_review = os.environ.get("AUTOBLOG_REVIEW") == "1"
    entry, mode, ref = pick(queue, use_git, force_review, args.entry)
    if entry is None:
        log("rinda tukša — nekas netiek publicēts. Papildiniet scripts/autoblog-queue.json")
        return

    targets = set(pages) | set(EXTRA_TARGETS) | {p["path"] for p in posts}
    problems = check_entry(entry, stats, targets)
    if problems:
        raise SystemExit(f"rindas ieraksts {entry.get('slug')} nav derīgs: " + "; ".join(problems))
    title = fill_title(entry["title"], stats)
    anchor = MONEY_ANCHORS[len(posts) % len(MONEY_ANCHORS)]
    log(f"tēma: {title} | slug: {entry['slug']} | režīms: {mode} | anchor: {anchor}")

    if mode == "from_branch":
        log(f"pārskatīts raksts no {ref} (review: false) — publicēju")
        raw, dati = from_branch(ref, entry, stats)
    else:
        dati = dati_block(entry, stats)
        raw = pathlib.Path(args.from_file).read_text(encoding="utf-8") if args.from_file else None
    allowed = allowed_numbers(dati)

    if raw is not None:
        meta, body, errors = parse_and_check(raw, entry, posts, pages, anchor, dati, allowed)
        if errors:
            if args.dry_run and meta:
                print_post(meta, body)
            for e in errors:
                log("PĀRBAUDE NEIZGĀJA:", e)
            raise SystemExit("checks failed, nothing published: " + "; ".join(errors))
    else:
        import anthropic   # only when a post is really generated
        meta, body = generate(anthropic.Anthropic(), entry, title, posts, pages, anchor, dati, allowed)

    today = dt.date.today().isoformat()
    slug = entry["slug"]
    path = f"/blogs/{slug}/"
    if path in {p["path"] for p in posts} or (ROOT / "blogs" / slug).exists():
        raise SystemExit(f"{path} jau eksistē — atzīmējiet ierakstu kā done vai mainiet slug")
    meta = {"path": path, "title": meta["title"] if meta["title"].endswith("| LatSEO") else meta["title"] + " | LatSEO",
            "description": meta["description"], "h1": meta["h1"], "category": meta["category"],
            "date": today, "modified": today, "cta": meta["cta"], "related_paths": meta["related_paths"]}

    if args.dry_run:
        print_post(meta, body)
        log("pārbaude: iziet (skaitļi, frāzes, saites, formāts)")
        return

    review = mode == "review"
    branch = REVIEW_PREFIX + slug
    write_source(SRC / "blog" / f"{slug}.html", meta, body)
    link_back(path, meta["related_paths"], posts)
    render_cover(slug, html.unescape(strip_tags(meta["h1"])).strip(), meta["category"], len(posts))
    USED.mkdir(parents=True, exist_ok=True)
    (USED / f"{slug}.json").write_text(json.dumps(dati, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if review:
        entry.update(status="review_pending", branch=branch)
    else:
        entry.pop("status", None)
        entry.pop("branch", None)
        entry.update(done=today, path=path)
    save_queue(queue)
    subprocess.run([sys.executable, "scripts/build.py"], cwd=ROOT, check=True, capture_output=True)
    log("built", path)
    if review:
        log(f"REVIEW: raksts gaida pārskatīšanu zarā {branch}"
            + (" (netiek izveidots, --no-git)" if args.no_git else "")
            + ". Publicēt: apvienojiet zaru main vai iestatiet review: false rindā.")
        log("raksta teksts:")
        print_post(meta, body)

    if args.no_git:
        return
    if review:
        git("checkout", "--quiet", "-B", branch)
    git("add", "-A")
    git("-c", "user.name=LatSEO Autoblog", "-c", "user.email=sales@latseo.com",
        "commit", "--quiet", "-m", f"{'Blogs (pārskatīšanai)' if review else 'Blogs'}: {meta['h1']}")
    if not args.no_push:
        if review:
            git("push", "--quiet", "origin", f"HEAD:refs/heads/{branch}")
            log("pushed", branch)
        else:
            git("push", "--quiet")
            log("pushed", f"https://latseo.com{path}")
    if review:
        git("checkout", "--quiet", "main")


if __name__ == "__main__":
    main()
