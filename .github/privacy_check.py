"""Block commits that put people data or contact details into this public repo.

Everything in this repo is served on wearemahala.com, so the check is strict:
- no email address except the camp inbox (and the two below, until task T-027 moves them out)
- no phone numbers
- no data exports (spreadsheets, contact cards, raw JSON lines)
Vendor code (seed/model/) is skipped: minified numbers look like phone numbers.
Run: python3 .github/privacy_check.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "model"}
TEXT = {".html", ".js", ".gs", ".md", ".json", ".css", ".txt", ".yml", ".yaml"}
BLOCKED_TYPES = {".csv", ".xlsx", ".xls", ".vcf", ".jsonl", ".zip", ".enc"}

EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?<![\w/#=.\-])(?:\+27|\+\d{2,3}|0)[ \-]?\d{2}[ \-]?\d{3}[ \-]?\d{4}(?![\w/])")
ALLOW_EMAIL = {
    "wearemahala@gmail.com",                 # the camp inbox, public
    "noreply@anthropic.com",                 # commit trailers
    # Temporary: the applications backend's notification list. Task T-027 moves these
    # into Apps Script properties; remove them from this list when it is done.
    "bioharmonicpermaculture@gmail.com",
    "hi@meredithdetko.com",
}


def main():
    problems = []
    for f in ROOT.rglob("*"):
        if not f.is_file() or set(f.relative_to(ROOT).parts) & SKIP:
            continue
        rel = f.relative_to(ROOT)
        if f.suffix.lower() in BLOCKED_TYPES:
            problems.append((rel, 0, "data export file type", f.suffix))
            continue
        if f.suffix.lower() not in TEXT:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for e in EMAIL.findall(line):
                if e.lower() not in ALLOW_EMAIL and not e.lower().endswith((".png", ".jpg", ".webp", ".svg")):
                    problems.append((rel, n, "email address", e[:3] + "…"))
            for p in PHONE.findall(line):
                problems.append((rel, n, "phone number", p[:4] + "…"))
    for rel, n, what, hint in problems:
        print(f"{rel}:{n}: {what} ({hint})")
    if problems:
        print(f"\n{len(problems)} problem(s). This repo is public: people data and contacts belong in Mahala OS, never here.")
        sys.exit(1)
    print("privacy check passed")


if __name__ == "__main__":
    main()
