#!/usr/bin/env python3
"""Tell IndexNow (Bing, Yandex, Seznam, Naver; ChatGPT search uses Bing) which pages changed.

Changed pages = built `index.html` files that differ between the last notified commit and HEAD,
limited to URLs in sitemap.xml (plus pages that were removed from it, so engines drop them).
Nothing is sent until GitHub Pages serves the new version of a changed page; the run then
exits quietly and the next timer tick tries again. Runs on the ThinkPad every 20 minutes
(scripts/indexnow-deploy/).

  python3 scripts/indexnow.py --state FILE      # since the commit in FILE, then store HEAD there
  python3 scripts/indexnow.py --since REV       # since REV (no state file)
  python3 scripts/indexnow.py --all             # every sitemap URL
  add --dry-run to print the list and send nothing
With --state and no FILE yet, every sitemap URL is sent once (first submission).
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://latseo.com"
HOST = "latseo.com"
ENDPOINT = "https://api.indexnow.org/indexnow"
KEY_RE = re.compile(r"^[0-9a-f]{32}$")


def log(*a, sep=" "):
    print("[indexnow]", *a, sep=sep, flush=True)


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, text=True, capture_output=True).stdout


def key():
    for p in ROOT.glob("*.txt"):
        if KEY_RE.match(p.stem) and p.read_text().strip() == p.stem:
            return p.stem
    sys.exit("IndexNow atslēgas fails (<32 hex>.txt saknē) nav atrasts")


def sitemap_urls(rev):
    try:
        text = git("show", f"{rev}:sitemap.xml")
    except subprocess.CalledProcessError:
        return set()
    return set(re.findall(r"<loc>(.*?)</loc>", text))


def url_of(path):
    """'blogs/x/index.html' -> https://latseo.com/blogs/x/ ; None for anything else."""
    if path == "index.html":
        return SITE + "/"
    if path.endswith("/index.html") and not path.startswith(("_src/", "scripts/")):
        return f"{SITE}/{path[:-len('index.html')]}"
    return None


def changed(since):
    """[(url, path, deleted)] for pages that changed between `since` and HEAD."""
    out = []
    for line in git("diff", "--name-status", "--no-renames", since, "HEAD").splitlines():
        status, path = line.split("\t", 1)
        url = url_of(path)
        if url:
            out.append((url, path, status == "D"))
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "LatSEO-indexnow", "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def is_live(url, path, deleted):
    """GitHub Pages serves HEAD's version of this page (or 404 for a removed one)."""
    status, body = fetch(url + "?indexnow-check")
    if deleted:
        return status == 404
    want = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, check=True, capture_output=True).stdout
    return status == 200 and body == want


def send(urls, k):
    payload = {"host": HOST, "key": k, "keyLocation": f"{SITE}/{k}.txt", "urlList": sorted(urls)}
    req = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--state", help="file holding the last notified commit")
    g.add_argument("--since", help="notify pages changed since this commit")
    g.add_argument("--all", action="store_true", help="notify every sitemap URL")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    k = key()
    head = git("rev-parse", "HEAD").strip()
    state = pathlib.Path(args.state) if args.state else None
    since = args.since or (state.read_text().strip() if state and state.exists() else None)

    if args.all or since is None:
        urls, check, check_key = sitemap_urls("HEAD"), [], True   # key file must be live first
    else:
        if since == head:
            return
        now, before = sitemap_urls("HEAD"), sitemap_urls(since)
        rows = [r for r in changed(since) if r[0] in now or r[0] in before]   # removed pages too
        urls, check, check_key = {r[0] for r in rows}, rows, False
    if not urls:
        log(f"{since[:7] if since else '-'}..{head[:7]}: nav mainītu lapu")
        if state and not args.dry_run:
            state.write_text(head + "\n")
        return

    if args.dry_run:
        log(f"{len(urls)} URL (dry-run):", *sorted(urls), sep="\n  ")
        return

    if check_key and fetch(f"{SITE}/{k}.txt")[1].decode(errors="replace").strip() != k:
        log("atslēgas fails vēl nav publicēts, mēģinās vēlāk")
        return
    for url, path, deleted in check[:1] + [r for r in check if r[2]][:1]:
        if not is_live(url, path, deleted):
            log(f"GitHub Pages vēl rāda veco versiju ({url}), mēģinās vēlāk")
            return

    status, body = send(urls, k)
    if status in (200, 202):
        log(f"nosūtīti {len(urls)} URL ({status})", *sorted(urls), sep="\n  ")
        if state:
            state.parent.mkdir(parents=True, exist_ok=True)
            state.write_text(head + "\n")
    else:
        sys.exit(f"[indexnow] kļūda {status}: {body}")


if __name__ == "__main__":
    main()
