# Gates, accounts and payments: action plan

Draft v0.2, 31 October 2026. Sources for every outside fact are in [RESEARCH.md](RESEARCH.md). The build plan that turns [the journey map](JOURNEY-MAP.md) into the live Mahalaverse.
Written so Claude (or Chris) can pick up any task and implement it. Each task lists where it lands and how we know it
is done. Nothing here is live: this file sits on the `plan/gates-and-payments` branch.

## What is already built (and what is not live)

Reading the code on 31 October, more exists than the live site shows.

| Piece | In the code | Live on wearemahala.com |
|---|---|---|
| Gates 1 to 7, spaces, the seven stops of the way | `mahalaverse.js` (`DATA.gates`, `SPACE`, `WAY`) | Yes, but every space is open: `canEnter()` returns true ("v5: the gates are ways to give") |
| Accounts (email sign-in), Your path, badges, avatar | `assets/v7/platform`, `assets/v7/me` on Supabase through `standalone/shim/claude-shim.js` | No. The shim is not loaded, so the site runs in "solo" mode: nothing is saved beyond the browser |
| Offerings (poem, story, art, music set, sound journey), steward review, ideas | `assets/v7/co` | No (needs the shared store) |
| Pledges, card checkout through PayFast, Yoco or Paystack, verified webhook, receipts, refunds copy | `assets/v7/pay` (edge functions `pay-checkout` and `pay-webhook`, rules `rules/pay.json`) | No. The panel says "No payment is taken here yet" |
| Gate level | Kept in the browser (`localStorage mahala.me`, `ME.gate`) and raised by "Camp lead testing" buttons | Not secure enough for a paywall |
| A paid gift opening a gate | Not built: a confirmed gift gives a badge only | |
| The raised bar | `CONFIG.raise.raised: 70000` placeholder, or the keeper's ledger | Shows a placeholder |
| Camp application | `join.js` posts to the Google Sheet (Apps Script) with no account | Yes |

**Blocker 0: the source.** The public repo is the built site. The source it is built from is not here: `standalone/`
(the Supabase shim, edge functions, `PAYMENTS.md`, the deploy guide), `rules/*.json`, `CONTRACT.md`, the `patch_v7_*.py`
build scripts and the tests. Chris, where does that live? Every task below edits the source and rebuilds, not the
500 KB `mahalaverse.js` by hand. If it lives in a private repo, attach it to the Claude project so Claude can work there.

## The architecture we are building towards

```
 Visitor ── email sign-in ──> Supabase Auth ──> profiles (one row per person)
    │                                              │  role: guest, builder, invited, applicant, member, steward
    │                                              │  entitlements: gates open, and why
    ├─ Give at a gate ──> edge fn pay-checkout ──> PayFast (rand) ──ITN──> edge fn pay-webhook
    │                                                                        │ verifies, writes payments
    │                                                                        └> recompute entitlements
    ├─ Offer in kind ───> offerings (storage + row) ──> steward review ──> recompute entitlements
    ├─ Apply to camp ───> applications ──> (invited? pay now : waitlist) ──> camp fee checkout or EFT
    └─ Donate ──────────> BackaBuddy (public, no gift, no access)

 Invitation list (nominations sheet, All Stars tab) ──sync──> invites (email, token, nominator)
 Public total = BackaBuddy total (entered or read) + build share of confirmed gates and fees
```

One rule above all: **a gate opens only because the server says so.** The browser asks "what can I see?" and the
database answers from payments, invites, memberships and offerings.

## Phase 0. Decisions (Meredith, Chris, Mick)

The open list at the end of the journey map, plus:

- [ ] Where the build source lives (Blocker 0).
- [ ] Who owns the Supabase project and the PayFast account (the four ownerships: site, board, payments, email).
- [ ] The monthly ZAR/USD rate the camp will use, and who updates it.
- [ ] The gift delivery windows and the T-shirt print partner.

## Phase 1. Copy and display fixes (no backend, can ship this week)

Small, safe changes to what people already see. Claude can do these now in the source.

1. **Dual currency everywhere.** Add one `fx` setting to `site.js` (the camp's monthly USD to ZAR rate and the date it was set) and one helper
   `MAHALA_SITE.both(amount, from)` that returns "$100 (about R …)" or "R … (about $100)" by the visitor's side
   (`navigator.language`/region, a saved R/$ toggle). Use it for the gates, the target, the raised bar, the camp fees.
   *Done when* every amount on the front page, the camp page, The Seed page and the Mahalaverse shows both, and changing
   the one rate changes them all.
2. **The gates panel**, `DATA.gates`:
   - Gate 1: "Poems and stories by the fire" as the line; gift stays the badge.
   - Gate 2: "A copper coil pendant or a Seed T-shirt (waitlist)".
   - Gate 3: amount becomes "Invite only", line "Apply to join the camp", button goes to the camp application.
   - Gates 6 and 7: "Everything below, and the badge" (Gate 7, The lighthouses, is cut off at the bottom of the panel
     today: the list needs to scroll or the panel to grow).
   - Footer: "Working amounts, not final. You give in rand on PayFast's secure page." once payments are live; until
     then keep "No payment is taken here yet."
3. **Remove the glass panels KPI** ("Glass panels lit, 0 of 143") and the panel lighting tied to it.
4. **The raised bar.** Replace the R 70 000 placeholder with a real figure from the keeper's ledger (and fix the
   "R0 raised of R0" header). Until the ledger is live, show the BackaBuddy total entered by hand in `site.js`.
5. **The front page line** about the Mahalaverse being open "Freely" (Decision 10 in the journey map).
6. **BackaBuddy.** Add a short paragraph and a campaign update (draft in [BACKABUDDY-COPY.md](BACKABUDDY-COPY.md)).
   Meredith posts it; Claude does not have access.

## Phase 2. Turn the shared Mahalaverse on

1. Create (or confirm) the Supabase project in Frankfurt (no African region), on the paid plan once payments are live
   (free projects pause after a week of quiet). Run the rules files and migrations.
2. Load `claude-shim.js` on `index.html` so the platform plugin runs in "standalone" mode.
3. Load the same shim on `camp.html`, so the camp page and the Mahalaverse share one sign-in.
4. Email sign-in by magic link, sent through a proper email sender (Brevo or Resend) from a Mahala address, because
   Supabase's built-in sender allows only about two emails an hour, with a privacy notice and a consent tick (POPIA: what we keep,
   why, who sees it, how to delete it). Consent and its date are stored on the profile.
5. *Done when* a builder signs in on a phone, draws a card, and sees the same card and path on a laptop.

## Phase 3. Who you are: profiles, invitations, entitlements

Tables (Supabase Postgres, row level security on all of them):

| Table | Holds | Who writes |
|---|---|---|
| `profiles` | uid, name, lives (ZA or abroad), role, consent_at, referred_by | the person (some fields), stewards (role) |
| `invites` | email (lowercased), token, nominated_by, wave, source tab | stewards and the sheet sync only |
| `applications` | uid, answers, invited (bool), stage: waitlist, call booked, accepted, declined | the person creates, stewards move the stage |
| `payments` | uid, kind (gate, camp_fee, instalment), gate, amount_zar, provider ref, status, test | the webhook only |
| `offerings` | uid, kind, title, file or link, gate it opens, status: sent, shown, taken back | the person creates, stewards review |
| `entitlements` | uid, gate, source (payment, offering, membership, steward), source id, at | a database function only |
| `coupons` | code, kind, amount off, for uid, used | stewards |
| `gift_reservations` | uid, payment id, gift, size, status: reserved, making, sent | the webhook creates, stewards move |
| `shares` | referrer uid, new uid, at | a database function on sign-up with `?ref=` |

Tasks:

1. **Invitation sync.** A steward button (or a scheduled Apps Script) copies the nominations sheet's invite list and the
   "Mahala All Stars" tab into `invites`. Each invitation letter link carries `?inv=<token>`, never an email address.
2. **Matching on sign-in.** A database trigger on a new profile: if the sign-in email or the stored `inv` token matches an
   invite, the role becomes `invited`. *Done when* an invited tester signs in with the email on the sheet and sees
   "You are invited" at Gate 3 and on the camp page, and an uninvited tester sees the waitlist wording.
3. **Entitlements function.** `recompute_entitlements(uid)` runs after any payment, offering, application stage change
   or steward grant. Rules:
   - a confirmed gate payment for gate N opens gates 1 to N (and N's space list in `SPACE`)
   - an offering of a kind listed for gate 1 or 2 (with the maker's separate tick allowing Mahala to show it, with
     credit) opens that gate as soon as it is sent; if a steward takes it back,
     the gate closes again unless something else opens it
   - membership (accepted and a fee payment or plan started) opens Gates 1 to 4, the crews and the yard (Decision 2)
   - stewards and camp leads open everything
4. **The game reads entitlements, not `ME.gate`.** `canEnter(key)` and `gateOpen(n)` ask the platform for the person's
   entitlements; `ME.gate` becomes a cache for display only. Remove the "Camp lead testing: open Gate N" buttons from
   the public build (keep them for stewards).
5. **Your path shows everything tracked:** invitation, application stage, consent, payments and plan, gates and why,
   offerings and their status, quests, shares, badges, gifts reserved. Download and delete stay.

## Phase 4. PayFast live

1. Open the PayFast Individual account on the interim Mahala account (already decided). Get merchant id, key and
   passphrase into the Supabase function secrets, never into the site.
2. **Gate checkout.** `pay-checkout` builds the PayFast form server-side: `amount` in rand from the gate's price and the
   month's rate (the giver may add more, never less), `m_payment_id` = the pledge reference,
   `custom_str1` = uid, `custom_str2` = gate, `custom_str3` = gift choice and size, `notify_url` = `pay-webhook`.
3. **Webhook.** `pay-webhook` validates the ITN (signature with the passphrase, PayFast's server confirmation, source
   host, amount matches the checkout, and a 200 answer within about ten seconds; check every step against PayFast's
   official developer docs, which the research could not open), writes `payments`, creates the `gift_reservations` row, recomputes entitlements, and
   updates the online total. Idempotent on `pf_payment_id`.
4. **Camp fee.** For `invited` or `accepted` people only: full payment, or a PayFast subscription of 2 or 4 monthly
   cycles; EFT option showing the account details and the person's reference, with an "I've paid" proof upload.
   Coupons (build crew discount) are applied server-side before the checkout is built.
5. **Sandbox first.** Run every path on PayFast's sandbox (gate, gate plus extra, cancel, failed card, camp fee in full,
   instalments, coupon). *Done when* each one lands in the right table and opens the right gate with no human step.
6. Card fees: absorbed or added (Phase 0 decision, already open in the payments doc). PayFast's card fee is 3.2% + R2
   before VAT; money is free to pay out 48 hours after payment, from R1 000.
7. If PayFast will not open the Individual account on the interim account, switch the provider to Paystack: the pay
   plugin already supports it, so it is a settings change plus its own webhook check.

## Phase 5. The beta: Gate 1, the fire

1. Move the fire's poems and stories into the shared store (`offerings` with status shown, or a `fire_texts` table)
   so the closed ones are not sitting in the public JavaScript. One poem is marked as the free taster.
2. The fire's gate card: the free poem, the closed pages with titles only, and two buttons: "Offer a poem to the fire"
   and "Give $10 (R …)".
3. Either route opens the fire on every device.
4. Test with the camp leads and about ten friendly testers; log where people hesitate (a short form at the end).
5. *Done when* both routes work end to end on a phone, in under two minutes, without help.

## Phase 6. Roll out to the other gates

1. Gate 2: sound journeys, meditations, breathwork and DJ sets behind the gate (recordings in Supabase Storage with
   signed links, so a closed recording cannot be fetched); the live workshop link shown only to people inside.
   Offerings that open it: guided meditation, breathwork, sound journey, DJ set.
2. Gate 3: the camp door as in the journey map, sharing one application with `camp.html` (`join.js` writes to
   `applications` when signed in, and keeps posting to the Sheet so the camp's existing tracking does not break).
3. Gates 4 to 7: spaces close behind their gates; gifts reserved on payment.
4. A gallery of approved offerings (with the maker's consent to show it, and their credit).

## Phase 7. Totals, gifts and the stewards' view

1. **One public total** on the front page, The Seed page and the Mahalaverse: BackaBuddy total (a steward enters it;
   BackaBuddy has no API we could find) plus the build share of confirmed gates
   and fees. Both currencies. The same figure everywhere (Decision 8).
2. **BackaBuddy's Offline donations line** can carry the build share raised through the Mahalaverse, entered by a
   steward when they update the total, so BackaBuddy and the website show the same figure (Decision 9).
3. **Gift waitlists** for stewards: counts per gift and size, addresses, status; a "mark as sent" that emails the person.
4. **Weekly reconciliation:** PayFast payouts against `payments`, BackaBuddy against the entered total.

## How Claude works this plan

- One branch and one pull request per task, small enough to review in five minutes, with a screenshot of the change.
- Never edit the built `mahalaverse.js` by hand once the source is attached; rebuild from source.
- Never put keys, passphrases, emails or account numbers in the repo: it is public and served as the website.
- Every figure shown to visitors comes from `site.js` or the database, and working figures say so.
- Run the existing tests (`pay-tests`, the model tests in `co` and `me`) before every pull request.
