# Working on wearemahala.com (instructions for AI agents)

This repo is the public website of Mahala, an AfrikaBurn theme camp and community of temple builders. GitHub Pages serves the `main` branch at **wearemahala.com**, so every file here, including this one and every past version in git history, is public.

## The two repos

- **This repo (`chrisnash-432/mahala`) is public and holds the website only.**
- **Mahala OS (`merbear89/MAHALA-AI-OS`) is private and is the single source of truth** for everything else: the task list (`TASKS.md`), the one log (`strategy/log.md`), the knowledge base (`knowledge/`), strategy, brand and the community graph. If you can, attach it before you start: the reasons behind most site decisions are there.

## Never put in this repo

- People data of any kind: members' or nominees' names, stories, nominators' words, applications, consent status, anything from Mahala OS `community/`.
- Contact details other than the camp inbox, wearemahala@gmail.com.
- Strategy drafts, budgets beyond the public target, task lists, meeting notes.
- Secrets: keys, passphrases, tokens, private sheet links with edit access.
- Personal letters or "Your Mahala thread" pages. They need a private host or unguessable links, never a public repo.

A privacy check runs on every push (`.github/workflows/privacy.yml`). Run it yourself before committing: `python3 .github/privacy_check.py`.

## How the site is built

Static files, no build step. Preview with `python3 -m http.server` and check at phone width as well as desktop.

| File | What it is |
| --- | --- |
| `index.html` | Front page: The Seed's story one line at a time, then the Mahalaverse |
| `seed.html`, `camp.html` | The Seed and The camp. They open over the front page; Close returns to the same place. `camp.html` holds the four-step Join the camp application |
| `mahalaverse.js` | The public edition of the Mahalaverse (no accounts; members' features hidden) |
| `join.js` | The application form logic |
| `site.js` | Settings every page shares: `donateUrl`, `target`, `buildWeek`, `sheet`, `fx`, `raised`, `members` |
| `assets/shim/claude-shim.js` | Accounts: sign-in, "claim your thread", and the game's data on the member database. Built from Mahala OS `platform/shim/`; never edit this copy. It does nothing until `site.js` `members` has the project's address |
| `apps-script-standalone.gs` | A copy of the applications backend that runs in Google Apps Script. Change the live script first, then this copy, so they always match |
| `assets/`, `camp-media/`, `seed-media/`, `seed/` | Images, audio, films and the 3D model. `seed/model/` holds vendor code |

Changing settings:

- **Target or donate link:** change `site.js`. The Donate buttons in `index.html` and `seed.html` also carry the BackaBuddy link inline, so change those too.
- **Raised so far:** `raised` in `site.js` (the money carried from 2026, Mahala OS T-005, plus the BackaBuddy total a steward copies in, with `enteredOn`).
- **After any change to `site.js`:** bump its version in every page (`site.js?v=5` becomes `?v=6`) so browsers fetch the new file. The same goes for `assets/shim/claude-shim.js?v=1` when the shim is rebuilt.
- **Accounts:** `members: { url, anonKey }` in `site.js` turns them on (Mahala OS `platform/docs/SETUP.md`). The anon key is public by design; the service key never comes near this repo.

## Standing rules

- Never invent figures (fundraising totals, costs, dates, attendance). Leave a placeholder and ask.
- Renders of The Seed are labelled "Concept visualisation". Real photos appear only in the camp section.
- The fundraise funds The Seed only. The target is R 718 875, matching BackaBuddy. The full temple is 2030, and The Seed is year one of a four-year vision.
- Visual direction: clean, minimal geometric psychedelia; Marcellus capitals with Jost; warm white ground with deep ink. Divergent and non-templated, never boxy linear layouts.
- Copy is conversational and direct. No long dashes. Letters are signed "Mahala".
- AfrikaBurn footage, the AfrikaBurn name and logo, and aerial Tankwa Town imagery need written permission from AfrikaBurn before any fundraising use (Mahala OS task T-020).
- Keep media compressed. Pages are served to phones on mobile data.

## Working routine

1. **Start:** `git pull`. Read the related tasks in Mahala OS `TASKS.md`.
2. **Change:** use a branch and a pull request for anything beyond a copy fix, because `main` goes live within a minute or two.
3. **End:**
   - Run the privacy check.
   - Commit with a plain message and push.
   - In Mahala OS, add one dated line to `strategy/log.md` and tick or update the task in `TASKS.md`.
