#!/usr/bin/env python3
"""Autoblog v2 tests without the API: --from-file, --no-git / local git remote.

  python3 scripts/tests/test_autoblog.py
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FIX = HERE / "fixtures"
SLUG = "ko-atradu-rigas-uznemumu-majaslapas"
sys.path.insert(0, str(ROOT / "scripts"))
import autoblog  # noqa: E402  (module import must not need anthropic)

assert "anthropic" not in sys.modules


def env(**extra):
    e = {k: v for k, v in os.environ.items() if not k.startswith("AUTOBLOG_") and k != "ANTHROPIC_API_KEY"}
    e["AUTOBLOG_STATS"] = "/nonexistent/blog-stats.json"     # → repo copy
    e["PYTHONPATH"] = str(POISON)                            # 'import anthropic' fails loudly
    e.update(extra)
    return e


def run(root, *args, **extra):
    return subprocess.run([sys.executable, str(root / "scripts" / "autoblog.py"), *args],
                          cwd=root, env=env(**extra), text=True, capture_output=True)


def copy_site(dst):
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(".git", "__pycache__"))
    return dst


POISON = pathlib.Path(tempfile.mkdtemp(prefix="autoblog-poison-"))
(POISON / "anthropic").mkdir()
(POISON / "anthropic" / "__init__.py").write_text("raise ImportError('anthropic imported without need')\n")


class FactCheck(unittest.TestCase):
    def check(self, name):
        return run(ROOT, "--from-file", str(FIX / name), "--no-git", "--dry-run", "--entry", SLUG)

    def test_good_post_passes(self):
        r = self.check("good.html")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("pārbaude: iziet", r.stdout)

    def test_invented_number_rejected(self):
        r = self.check("bad-number.html")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("„67”", r.stdout + r.stderr)

    def test_experience_phrase_rejected(self):
        r = self.check("bad-experience.html")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("pieredze rāda", r.stdout + r.stderr)

    def test_client_domain_rejected(self):
        r = self.check("bad-client.html")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("autoestetika.lv", r.stdout + r.stderr)

    def test_generalisation_rejected(self):
        r = self.check("bad-general.html")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("vispārinājums", r.stdout + r.stderr)


class Numbers(unittest.TestCase):
    def test_normalisation(self):
        got = [n for _, n, _ in autoblog.extract_numbers("2 174 rādījumi, 43,5 %, 7,0 s, 1 299 €, 27.11.2026")]
        self.assertEqual(got, ["27", "11", "2026", "2174", "43.5", "7", "1299"])

    def test_allowed_set(self):
        dati = {"dati": {"x": {"procenti": 43.5, "mediāna": 7.0, "teksts": "LCP virs 2,5 s"}}, "facts": []}
        ok = autoblog.allowed_numbers(dati)
        for n in ("43.5", "44", "7", "2.5", "449", "799", "1299", "150", "300", "10", "2026", "5"):
            self.assertIn(n, ok)
        self.assertNotIn("67", ok)

    def test_private_fields_never_given(self):
        raw = {"aukstie_epasti": {"n": 38}, "lapu_parbaudes": {"visas": {"google_pozicija": {"n": 180}, "x": 1},
                                                              "pa_nisam": {"A": {"google_pozicija": {}}}}}
        self.assertEqual(autoblog.drop_private(raw), {"lapu_parbaudes": {"visas": {"x": 1}, "pa_nisam": {"A": {}}}})
        stats = autoblog.drop_private(json.loads(autoblog.STATS_FALLBACK.read_text(encoding="utf-8")))
        for e in autoblog.load_queue()["queue"]:
            text = json.dumps(autoblog.dati_block(e, stats), ensure_ascii=False)
            self.assertNotIn("google_pozicija", text)
            self.assertNotIn("aukstie_epasti", text)
        self.assertNotIn("aukstie_epasti", stats)

    def test_queue_entries_valid(self):
        stats = autoblog.drop_private(json.loads(autoblog.STATS_FALLBACK.read_text(encoding="utf-8")))
        posts, pages = autoblog.inventory()
        targets = set(pages) | set(autoblog.EXTRA_TARGETS) | {p["path"] for p in posts}
        queue = autoblog.load_queue()["queue"]
        self.assertEqual([e["slug"] for e in queue][:1], [SLUG])
        self.assertTrue(queue[0]["review"])
        for e in queue:
            self.assertEqual(autoblog.check_entry(e, stats, targets), [], e["slug"])
        self.assertEqual(autoblog.fill_title(queue[0]["title"], stats), "Ko atradu 207 Rīgas uzņēmumu mājaslapās")


class Publishing(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="autoblog-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_empty_queue_publishes_nothing(self):
        q = self.tmp / "queue.json"
        q.write_text(json.dumps({"queue": [{"slug": "x", "done": "2026-11-01"}]}))
        r = run(ROOT, "--no-git", AUTOBLOG_QUEUE=str(q))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("rinda tukša", r.stdout)

    def test_review_no_git(self):
        site = copy_site(self.tmp / "site")
        r = run(site, "--from-file", str(FIX / "good.html"), "--no-git")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn(f"autoblog-review/{SLUG}", r.stdout)
        self.assertIn('<p class="lead">', r.stdout)                 # full text in the log
        entry = json.loads((site / "scripts/autoblog-queue.json").read_text())["queue"][0]
        self.assertEqual(entry["status"], "review_pending")
        self.assertTrue((site / "_src/autoblog-data/used" / f"{SLUG}.json").exists())

    def test_publish_no_git(self):
        site = copy_site(self.tmp / "site")
        qp = site / "scripts/autoblog-queue.json"
        q = json.loads(qp.read_text())
        q["queue"][0]["review"] = False
        qp.write_text(json.dumps(q, ensure_ascii=False))
        r = run(site, "--from-file", str(FIX / "good.html"), "--no-git")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue((site / "_src/blog" / f"{SLUG}.html").exists())
        self.assertTrue((site / "blogs" / SLUG / "index.html").exists())
        self.assertTrue(json.loads(qp.read_text())["queue"][0]["done"])

    def test_bad_post_not_written(self):
        site = copy_site(self.tmp / "site")
        r = run(site, "--from-file", str(FIX / "bad-number.html"), "--no-git")
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse((site / "_src/blog" / f"{SLUG}.html").exists())

    def test_review_flow_with_git(self):
        """review → branch only; rerun skips it; review: false → published from the branch to main."""
        work, origin = copy_site(self.tmp / "work"), self.tmp / "origin.git"
        g = lambda *a, cwd=work: subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *a], cwd=cwd,
                                                check=True, text=True, capture_output=True).stdout
        g("init", "-q", "-b", "main")
        g("add", "-A")
        g("commit", "-qm", "base")
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(origin)], check=True)
        g("remote", "add", "origin", str(origin))
        g("push", "-qu", "origin", "main")

        r = run(work, "--from-file", str(FIX / "good.html"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        branch = f"autoblog-review/{SLUG}"
        self.assertIn(branch, g("ls-remote", "--heads", "origin"))
        self.assertNotIn(SLUG, g("ls-tree", "-r", "--name-only", "origin/main", "_src/blog"))
        self.assertEqual(g("branch", "--show-current").strip(), "main")

        r = run(work, "--from-file", str(FIX / "good.html"), "--entry", SLUG)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("gaida pārskatīšanu", r.stdout)

        qp = work / "scripts/autoblog-queue.json"
        q = json.loads(qp.read_text())
        q["queue"][0]["review"] = False
        qp.write_text(json.dumps(q, ensure_ascii=False, indent=2))
        g("commit", "-qam", "review: false")
        g("push", "-q")
        r = run(work)          # no --from-file: the post comes from the branch, anthropic is not imported
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("pārskatīts raksts", r.stdout)
        self.assertIn(f"_src/blog/{SLUG}.html", g("ls-tree", "-r", "--name-only", "origin/main", "_src/blog"))
        done = json.loads(g("show", "origin/main:scripts/autoblog-queue.json"))["queue"][0]
        self.assertTrue(done.get("done"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
