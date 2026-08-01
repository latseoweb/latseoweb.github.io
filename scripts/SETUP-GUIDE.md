# 🤖 LatSEO Daily Blog Automation — Setup Guide

## Kā tas strādā

Šī automatizācija katru dienu ģenerē un publicē jaunu SEO bloga rakstu, izmantojot:
- **GitHub Actions** — darbojas GitHub serveros, tavs dators var būt izslēgts
- **DeepSeek API** — ģenerē unikālu, kvalitatīvu saturu gan latviešu, gan angļu valodā
- **365 dienu satura plāns** — 52 nedēļu tēmas × 7 dienas formāti + bonusa diena

## 1. SOLIS: Iegūsti DeepSeek API atslēgu

1. Dodies uz https://platform.deepseek.com/api_keys
2. Izveido jaunu API atslēgu (Create new API key)
3. Nokopē to (tu to redzēsi tikai VIENREIZ!)
4. **Izmaksas**: Ar `deepseek-chat` modeli, viens raksts (~800 vārdi) izmaksā mazāk par **$0.001**.
   - 365 raksti = ~$0.30 gadā
   - 365 raksti × 2 valodas = ~$0.60 gadā
   - Tas ir **~20x lētāk nekā OpenAI!**

## 2. SOLIS: Pievieno API atslēgu GitHub Secrets

1. Dodies uz sava repo: https://github.com/latseoweb/latseoweb.github.io
2. Ej uz **Settings** → **Secrets and variables** → **Actions**
3. Spied **New repository secret**
4. **Name**: `DEEPSEEK_API_KEY`
5. **Secret**: ielīmē savu DeepSeek API atslēgu
6. Spied **Add secret**

## 3. SOLIS: Pārbaudi starta datumu

Atver `scripts/topics.json` un pārliecinies, ka `startDate` ir pareizs. 
Pēc noklusējuma: `"2026-08-03"` (pirmdiena).

Sistēma ģenerēs rakstus pēc kārtas — pirmajā dienā 1. rakstu, otrajā 2. utt.

## 4. SOLIS: Palaid pirmo rakstu manuāli (tests)

1. Dodies uz https://github.com/latseoweb/latseoweb.github.io/actions
2. Kreisajā pusē izvēlies **Daily Blog Post** workflow
3. Spied **Run workflow** → zaļo pogu **Run workflow**
4. Tas palaidīs 1. dienas raksta ģenerēšanu

## 5. Automātiskais režīms

Workflow ir iestatīts palaisties **katru dienu 09:00 pēc Latvijas laika** (06:00 UTC).

Tas:
1. Izlasa, kura diena ir nākamā pēc kārtas
2. Paņem atbilstošo tēmu no `topics.json`
2. Izmanto **DeepSeek API**, lai uzģenerētu unikālu saturu LV un EN valodā
4. Izveido HTML failus pareizajās mapēs
5. Atjauno bloga indeksa lapas
6. Commit + push uz GitHub → automātiski publicējas caur GitHub Pages

## Manuālās komandas (lokāli)

```powershell
# Ģenerēt šodienas rakstu (AI režīmā)
python scripts/generate_post.py

# Priekšskatījums bez saglabāšanas
python scripts/generate_post.py --dry-run

# Ģenerēt konkrētu dienu
python scripts/generate_post.py --day 42

# Ģenerēt bez AI (testam — izmanto fallback veidni)
python scripts/generate_post.py --no-ai --day 1

# Tikai LV valodā
python scripts/generate_post.py --skip-en
```

## Failu struktūra

```
scripts/
├── topics.json           # 365 dienu satura plāns (rediģē šo, lai mainītu tēmas!)
├── generate_post.py      # Galvenais ģenerators
├── requirements.txt      # Python atkarības (openai)
└── .blog-progress.json   # Progresa izsekošana (automātiski veidots)

.github/workflows/
└── daily-blog-post.yml   # GitHub Actions workflow
```

## Biežāk uzdotie jautājumi

**Vai varu mainīt tēmas?**
Jā! Rediģē `scripts/topics.json` — nomaini tēmas, formātus, virsrakstus.

**Ko darīt, ja kādu dienu izlaiž?**
Sistēma vienmēr ģenerē NĀKAMO nepublicēto dienu. Ja izlaiž 3 dienas, nākamajā reizē tā publicēs nākamo pēc kārtas (nevis 3 uzreiz).

**Vai vajag maksāt par GitHub Actions?**
Nē! GitHub Pages publiskajiem repozitorijiem Actions ir bezmaksas (2000 min/mēn).

**Kā apturēt automātiku?**
Ej uz GitHub Actions → Daily Blog Post → ... → **Disable workflow**.
