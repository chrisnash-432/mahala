# Research behind the gates plan

31 October 2026. What the plan rests on, with sources. Anything marked **unverified** needs a check before it is relied on.

## 1. BackaBuddy cannot carry gates or gifts

- BackaBuddy is for donations; its terms do not allow rewards in return for a donation (from the camp's own payments
  doc, which read the terms on 27 to 31 Oct). It has no reward tiers ([campaign page](https://www.backabuddy.co.za/campaign/the-seed),
  [platform listing](https://thecrowdspace.com/platform/backabuddy/)).
- Platform fee 0% on all campaigns since June 2025; payment processing fees still apply
  ([Bizcommunity](https://www.bizcommunity.com/article/backabuddy-waives-platform-fees-on-all-campaigns-582980a)).
- The campaign page already shows an **Offline donations** line beside the online total, so money raised outside
  BackaBuddy can be shown there too. That lets BackaBuddy and the website show the same total.
- Campaign updates exist and BackaBuddy recommends them ([BackaBuddy news](https://news.backabuddy.co.za/2026/05/15/keep-donors-engaged-after-donating/)).
- Self-managed payouts take up to 10 working days, one request open at a time ([BackaBuddy news](https://news.backabuddy.co.za/?p=3932)).
- **Unverified:** donor export, any API or webhook (none found), so the website cannot read the BackaBuddy total
  automatically yet. Plan: a steward types it in.
- The South African reward-based platform is Thundafund (all or nothing, 7% plus transaction fees)
  ([Thundafund FAQ](https://blog.thundafund.com/how-does-thundafund-work/faqs/)). Not needed: the Mahalaverse is the reward layer.

## 2. PayFast for gates and camp fees

- Account types: Business, Individual (traders and sole proprietors) and Cause (registered NPO, PBO, NPC or trust only,
  lower fees) ([account types](https://payfast.io/account-types/), [Cause account](https://payfast.kayako.com/article/27-verify-a-cause-account)).
  The Individual account on the interim Mahala account fits now; Cause becomes possible only if the association registers.
  **Unverified:** whether a voluntary association qualifies for anything but Individual. Ask PayFast support.
- Fees, excluding VAT, no monthly fee: cards 3.2% + R2, Instant EFT 2%, payout R8.70 ([fees](https://payfast.io/fees)).
  **Unverified:** whether foreign cards cost more.
- Foreign Visa and Mastercard are accepted; the payer can see a price in USD, EUR, GBP or AUD, but **PayFast charges
  and pays out in rand only** ([multi-currency pricing](https://payfast.io/features/multi-currency-pricing/)).
- ITN, the payment notification: PayFast posts to a `notify_url` on a server, so GitHub Pages alone cannot receive it;
  a Supabase Edge Function can. Four checks: signature with the passphrase, PayFast as the source, the amount matches,
  and a validation call back to PayFast; answer 200 within about 10 seconds or PayFast retries
  ([ITN errors](https://payfast.kayako.com/article/321-what-causes-the-itn-security-check-errors),
  [dj-payfast docs](https://dj-payfast.readthedocs.io/en/latest/webhooks.html)). **Unverified against the official
  developer docs** (blocked during research): check them when building.
- Custom fields `m_payment_id`, `custom_str1` to `custom_str5` come back in the ITN: the pledge reference, the person's
  id and the gate ride on them ([@payfast/core](https://www.npmjs.com/package/@payfast/core)).
- Instalments are a subscription: a set number of monthly cycles; payment requests by email can carry one with no code
  ([subscriptions by payment request](https://payfast.kayako.com/article/12-how-do-i-create-a-subscription-using-payment-request)).
- Money is available 48 hours after payment; automatic payouts from R1 000, usually within 2 working days
  ([automated payouts](https://payfast.kayako.com/article/87-setting-up-automated-payouts)).
- Fallback if PayFast says no: Paystack, which has a starter tier for an individual with a personal bank account and
  3.1% + R1 on international cards ([Paystack pricing](https://paystack.com/za/pricing),
  [Starter business](https://support.paystack.com/hc/en-us/articles/360009972719-What-is-a-Paystack-Starter-Business)).
  Stripe is not available to South African businesses ([Paystack and Stripe](https://paystack.com/stripe/south-africa)).
  The pay plugin already supports PayFast, Yoco and Paystack.

## 3. Accounts on Supabase

- Email magic links; a link lasts an hour ([passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless)).
- The built-in email sender allows about 2 emails an hour, so production needs its own sender (for example Brevo or
  Resend) on a Mahala address ([going into production](https://supabase.com/docs/guides/deployment/going-into-prod.md)).
- Free projects pause after a week without activity; once payments are live the paid plan (about $25 a month) is the
  safe choice ([free tier summary](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), **verify on
  supabase.com/pricing**, which was blocked).
- No African region: Frankfurt or London is closest ([regions](https://supabase.com/docs/guides/platform/regions.md)).

## 4. Privacy (POPIA), in brief

General information, not legal advice.

- Consent must be specific and informed, never pre-ticked, and can be withdrawn; for running an account, "contract" is
  often the better lawful ground ([MJK, consent](https://mjkinc.co.za/popia/consent)).
- Requests to correct or delete must be answered free within 30 days, and people must be told they can object
  ([Michalsons](https://www.michalsons.com/blog/popia-amendment-regulations-commence/77824)).
- Storing data in Frankfurt is allowed under the provider's data processing agreement
  ([MJK, cross-border](https://mjkinc.co.za/popia/cross-border-transfers)).
- For offerings: a separate tick granting Mahala a non-exclusive, revocable licence to show the work with credit; the
  maker keeps copyright; takedown on request. Name an information officer in the privacy notice.

## 5. Two currencies

- PayFast charges in rand, so **rand is the price that is actually paid**. The dollar figure is a guide at a rate the
  camp fixes per month and labels "about".
- Free rate sources if the camp wants a live reference: open.er-api.com (daily, no key) and Frankfurter (ECB rates).
  A fixed monthly rate is still better for prices that should not wobble.

## 6. What works elsewhere

- **Temple of Together**, the 2024 Burning Man Temple: three named tiers with keepsakes, plus any amount and a
  major-gift email ([donate page](https://www.2024temple.com/donate)).
- **Patreon:** every tier has at least one real benefit; a cap per tier creates scarcity
  ([Patreon](https://support.patreon.com/hc/en-us/articles/203913559-Pricing-tiers-and-adding-benefits)).
- **Bandcamp name your price:** fans pay above the minimum about 40% of the time, raising the average by nearly half
  ([Bandcamp](https://get.bandcamp.help/en/articles/15263322-what-pricing-performs-best)). Each gate should let people
  give more than its amount.
- **AfrikaBurn's own fundraising tips** suggest rewards such as backers writing messages on the artwork
  ([AfrikaBurn PDF](https://old.afrikaburn.org/wp-content/uploads/2019/07/Fundraising-Tips-and-Tricks.pdf)).

## 7. The ethos line to hold

AfrikaBurn's guide says paying money to a project should not buy privilege, and Burning Man treats paying instead of
participating as unacceptable ([AfrikaBurn PDF](https://old.afrikaburn.org/wp-content/uploads/2019/07/Fundraising-Tips-and-Tricks.pdf),
[Burning Man on decommodification](https://burningman.org/black-rock-city/camps/cultural-direction-setting-decommodification/commodification-gifting-decommodification-and-participation/)).
So the gates open **online spaces, recognition and handmade gifts, never privileges on the playa**. The camp place
stays invite or apply only, and the in-kind route keeps the world open to anyone without money. This matters for the
Art Grant application too.
