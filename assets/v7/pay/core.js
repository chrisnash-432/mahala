/* The pay plugin's logic, free of the page and the game, so node and Deno can test it
   (standalone/supabase/functions/pay-tests/client.test.mjs). Nothing here touches the network or the DOM.

   The documents (rules/pay.json):
     pledges/<uid>   { p: [{ i, t, gate, amount, cur: 'ZAR', ref, st: 'open'|'withdrawn', go? }] }
                     written by the person; read by the person and stewards. An intent, never proof of payment.
                     go: when the person last left for the payment page.
     paid/<uid>      { p: [{ ref, gate, amount, cur, t, via: 'payfast'|'yoco'|'paystack'|'steward', pid?, test?, by?, refunded? }],
                       x: [{ ref, why: 'amount'|'again'|'refund', via, pid, got, want?, cur?, t }] }
                     written only by the server (standalone, after a verified notification) or a steward (by hand);
                     read by the person and stewards. x: what a steward should look at.
     paid/folds      { f: { '<uid>~<ref>': { t, by } } }   confirmed gifts the accounts keeper has folded into the ledger
     paid/unmatched  { x: [...] }   payments a provider confirmed that match no checkout (server)
                     (both under the paid prefix, so only stewards read or write them)
     paychk/<uid>    { c: [{ ref, key, amount, gate, via, t, mode }] }   checkouts the server started (server; stewards read)
     paytotals/online  { amount, n, t }   confirmed online gifts not yet folded into the ledger, in rand. Everyone reads
                     it (the raised bar); the server and stewards write it, always as a full recount of the paid documents.
     payconfig/links { provider, links: { '1'..'7', any }, t, by }   claude.ai payment links. Everyone reads; stewards write.
   The raised bar: the keeper's ledger (leads/ledger, or the page's own figures until it is set) + paytotals/online.amount. */
import { PAY } from './config.js';

export const CUR = 'ZAR';
export const PLEDGE_CAP = 40;
export const PAID_CAP = 100;
export const RESERVED = new Set(['folds', 'unmatched']);       // ids under paid/ that are not people
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';               // 31 symbols, no 0, 1, I, L or O: easy to read out and type
const A = '[23456789ABCDEFGHJKMNPQRSTUVWXYZ]';
export const REF_RE = new RegExp(`^MH[1-7]-${A}{5}-${A}{5}$`);
export const isRef = s => typeof s === 'string' && REF_RE.test(s);
export const VIA = ['payfast', 'yoco', 'paystack', 'steward'];

function randBytes(n) { const a = new Uint8Array(n); globalThis.crypto.getRandomValues(a); return a; }
/** A pledge reference: MH, the gate, then ten letters and digits in two groups (about 50 bits of chance), e.g. MH3-7KQ2X-A9PRT.
    Rejection sampling keeps every symbol equally likely. */
export function newRef(gate, rand = randBytes) {
  const g = Math.min(7, Math.max(1, Math.round(+gate) || 1));
  let out = '';
  while (out.length < 10) { for (const b of rand(16)) { if (b < 248 && out.length < 10) out += ALPHA[b % 31]; } }
  return `MH${g}-${out.slice(0, 5)}-${out.slice(5)}`;
}

/* ---------- money ---------- */
const c2 = x => Math.round(x * 100) / 100;
export const fmtR = n => 'R' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const toCents = n => Math.round(Number(n) * 100);
/** Read an amount in rand as people type it: "1500", "R1 500", "1,500", "1500.50", "1500,50". null when it is not one. */
export function parseRand(input) {
  let s = String(input == null ? '' : input).trim().replace(/^r\s*/i, '').replace(/[\s\u00a0]+/g, '');
  if (!s) return null;
  if (/^\d+([.,]\d{1,2})?$/.test(s)) s = s.replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3}){2,}(,\d{1,2})?$|^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // 1.500,50 and 1.500.000; a lone 1.500 is ambiguous
  else return null;
  const n = Number(s);
  return Number.isFinite(n) ? c2(n) : null;
}
/** May this be pledged? { ok, why: 'empty'|'nan'|'small'|'big'|'cents', card: false above the card limit (a steward arranges it) } */
export function checkAmount(n, cfg = PAY) {
  if (n == null || n === '') return { ok: false, why: 'empty' };
  if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, why: 'nan' };
  if (Math.abs(toCents(n) - n * 100) > 1e-6) return { ok: false, why: 'cents' };
  if (n < cfg.min) return { ok: false, why: 'small' };
  if (n > (cfg.pledgeMax || 2e8)) return { ok: false, why: 'big' };
  return { ok: true, card: n <= cfg.max };
}

/* ---------- the person's pledges ---------- */
const num = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
const str = (x, n = 80) => typeof x === 'string' ? x.slice(0, n) : '';
/** A time the page shows: after 1970 and no later than a day from now. A forged far-future or nonsense time is not a time. */
export const okTime = (t, now = Date.now()) => typeof t === 'number' && Number.isFinite(t) && t > 0 && t < now + 864e5;
/** One of the seven gates. */
export const okGate = g => Number.isInteger(g) && g >= 1 && g <= 7;
/** The pledges in a pledges/<uid> document, cleaned where they are read: a real gate that matches its reference, an amount
    one pledge may hold, a real time. Anything else is left out, everywhere it is shown. Newest first. */
export function pledgeList(doc, now = Date.now()) {
  const p = doc && Array.isArray(doc.p) ? doc.p : [];
  return p.filter(e => e && isRef(e.ref) && okGate(e.gate) && +e.ref.charAt(2) === e.gate && checkAmount(e.amount).ok && okTime(e.t, now))
    .map(e => ({ i: str(e.i, 40) || e.ref, t: e.t, gate: e.gate, amount: c2(e.amount), cur: CUR, ref: e.ref,
      st: e.st === 'withdrawn' ? 'withdrawn' : 'open', go: okTime(e.go, now) ? e.go : null }))
    .sort((a, b) => b.t - a.t);
}
/** Add a pledge, or replace the one with the same reference. Keeps the newest PLEDGE_CAP. */
export function upsertPledge(doc, entry) {
  const list = (doc && Array.isArray(doc.p) ? doc.p : []).filter(e => e && e.ref !== entry.ref);
  list.push(entry);
  list.sort((a, b) => (a.t || 0) - (b.t || 0));
  return Object.assign({}, doc || {}, { p: list.slice(-PLEDGE_CAP) });
}
export function patchPledge(doc, ref, patch) {
  if (!doc || !Array.isArray(doc.p) || !doc.p.some(e => e && e.ref === ref)) return null;
  return Object.assign({}, doc, { p: doc.p.map(e => e && e.ref === ref ? Object.assign({}, e, patch) : e) });
}
export function pledgeEntry(ref, gate, amount, t) { return { i: ref, t, gate, amount, cur: CUR, ref, st: 'open' }; }

/* ---------- confirmed gifts ---------- */
/** One rule for a confirmed gift, here and on the server (ledger.ts onlineTotal): a reference, a known way it was paid,
    the gate of its reference (or none written), an amount above nothing and within what one pledge may hold, a real time. */
export const okPaid = (e, now = Date.now()) => !!e && isRef(e.ref) && VIA.includes(e.via) && (e.gate == null || e.gate === +e.ref.charAt(2))
  && num(e.amount) != null && e.amount > 0 && e.amount <= (PAY.pledgeMax || 2e8) && okTime(e.t, now);
/** The confirmed gifts in a paid/<uid> document, cleaned the same way. */
export function paidList(doc, now = Date.now()) {
  const p = doc && Array.isArray(doc.p) ? doc.p : [];
  return p.filter(e => okPaid(e, now))
    .map(e => ({ ref: e.ref, gate: +e.ref.charAt(2), amount: c2(e.amount), cur: CUR, t: e.t, via: e.via,
      pid: str(e.pid, 80), test: e.test === true, by: str(e.by, 80), refunded: e.refunded ? (okTime(e.refunded, now) ? e.refunded : true) : null }));   // refunded with no real date: still refunded
}
export const checkList = doc => (doc && Array.isArray(doc.x) ? doc.x : []).filter(e => e && typeof e === 'object' && typeof e.why === 'string' && okTime(e.t));
/** Does a confirmed gift count: not a test payment, not refunded. */
export const counts = g => !!g && !g.test && !g.refunded;
export const foldKey = (uid, ref) => `${uid}~${ref}`;
export function splitKey(k) { const i = String(k).lastIndexOf('~'); return i < 1 ? [null, null] : [k.slice(0, i), k.slice(i + 1)]; }
/** Where a pledge stands, as its giver sees it: 'paid' | 'test' | 'refunded' | 'check' | 'waiting' | 'open' | 'withdrawn'. */
export function statusOf(pledge, paidDoc) {
  const got = paidList(paidDoc).find(e => e.ref === pledge.ref);
  if (got) return got.refunded ? 'refunded' : got.test ? 'test' : 'paid';
  if (checkList(paidDoc).some(e => e.ref === pledge.ref && e.why !== 'refund')) return 'check';
  if (pledge.st === 'withdrawn') return 'withdrawn';
  if (pledge.go) return 'waiting';
  return 'open';
}

/* ---------- the money raised, and the rule that nothing is counted twice ----------
   Every confirmed online gift is in exactly one of two places: still to be folded (paytotals/online counts it), or folded
   (the accounts keeper's ledger counts it, and paid/folds holds its key). Folding moves a gift from the first to the
   second, and a steward folds only once the ledger already includes it. Test payments and refunds count nowhere. */
/** The confirmed online gifts not yet folded, from every paid/<uid> document a steward or the server can read. */
export function unfolded(paidDocs, folds) {
  const f = (folds && folds.f) || {};
  let amount = 0, n = 0; const list = [];
  for (const [uid, doc] of Object.entries(paidDocs || {})) {
    if (RESERVED.has(uid)) continue;
    for (const g of paidList(doc)) {
      if (!counts(g)) continue;
      const k = foldKey(uid, g.ref);
      if (f[k]) continue;
      amount += g.amount; n++; list.push(Object.assign({ uid, k }, g));
    }
  }
  return { amount: c2(amount), n, list: list.sort((a, b) => a.t - b.t) };
}
/** What paytotals/online should hold, from the paid documents and the folds. */
export const onlineDoc = (paidDocs, folds, t) => { const u = unfolded(paidDocs, folds); return { amount: u.amount, n: u.n, t }; };
/** A total as the page trusts it: a number of rand, never negative, never absurd. */
export const safeTotal = o => { const a = +(o && o.amount); return Number.isFinite(a) && a > 0 && a < 1e10 ? c2(a) : 0; };
const money = x => { const a = +x; return Number.isFinite(a) && a >= 0 && a < 1e10 ? c2(a) : null; };
/** Has the accounts keeper set the ledger: a raised figure, or a target. A form saved with 0 and 0 has set nothing. */
export const ledgerSet = L => !!L && (money(L.raised) > 0 || money(L.target) > 0);
/** The bar: the keeper's ledger (its raised figure whenever it is set, with its target, or else the page's own target),
    or the page's own figures until then, plus the online gifts not yet folded into it. A ledger kept in dollars is shown
    as it is: rand gifts are not added to it, and the page's rand target is not put beside it. */
export function raisedNow(ledger, fallback, online) {
  const F = fallback && money(fallback.target) > 0 ? { raised: money(fallback.raised) || 0, target: money(fallback.target), cur: fallback.cur === '$' ? '$' : 'R' } : null;
  let base = F;
  if (ledgerSet(ledger)) {
    const cur = ledger.cur === '$' ? '$' : 'R', own = money(ledger.target) || 0;
    base = { raised: money(ledger.raised) || 0, target: own || (F && F.cur === cur ? F.target : 0), cur };
  }
  if (!base) return null;
  if (base.cur !== 'R') return base;
  return { raised: c2(base.raised + safeTotal(online)), target: base.target, cur: 'R' };
}
export function foldWith(folds, keys, t, by) {
  const f = Object.assign({}, (folds && folds.f) || {});
  for (const k of keys) if (!f[k]) f[k] = { t, by };
  return { f };
}
export function unfoldWith(folds, key) { const f = Object.assign({}, (folds && folds.f) || {}); delete f[key]; return { f }; }
/** A confirmation by hand: the gift a steward saw arrive in Mahala's account. null when it is already confirmed. */
export function confirmByHand(doc, { ref, gate, amount, t, by }) {
  const d = Object.assign({}, doc || {}), p = Array.isArray(d.p) ? d.p.slice() : [];
  if (p.some(e => e && e.ref === ref)) return null;
  p.push({ ref, gate, amount, cur: CUR, t, via: 'steward', by });
  d.p = p.slice(-PAID_CAP);
  return d;
}
/** A steward has dealt with something to check: drop it (matched by provider, payment id and reason). null if absent. */
export function dropCheck(doc, via, pid, why) {
  if (!doc || !Array.isArray(doc.x)) return null;
  const x = doc.x.filter(e => !(e && e.via === via && String(e.pid) === String(pid) && e.why === why));
  return x.length === doc.x.length ? null : Object.assign({}, doc, { x });
}
/** Does this check still need a steward? A wrong amount until the pledge is confirmed, a refund until it is marked. */
export function checkOpen(x, st) {
  if (!x) return false;
  if (x.why === 'amount') return st !== 'paid' && st !== 'refunded' && st !== 'test';
  if (x.why === 'refund') return st === 'paid';
  return true;                                       // 'again', 'unmatched': until a steward dismisses it
}
export function markRefunded(doc, ref, t, by) {
  if (!doc || !Array.isArray(doc.p)) return null;
  const i = doc.p.findIndex(e => e && e.ref === ref && !e.refunded);
  if (i < 0) return null;
  const p = doc.p.slice(); p[i] = Object.assign({}, p[i], { refunded: t, rby: by });
  return Object.assign({}, doc, { p });
}

/* ---------- the spreadsheet ---------- */
/** One CSV cell: quoted when it needs to be, and never read as a formula by a spreadsheet. */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export const toCSV = (header, rows) => [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
export const isoDay = t => (typeof t === 'number' && t > 0 && t < 8.64e15 ? new Date(t).toISOString().slice(0, 10) : '');
export const CSV_HEAD = ['reference', 'gate', 'pledged_zar', 'pledged_on', 'status', 'paid_zar', 'paid_on', 'via', 'provider_payment_id', 'test', 'folded_on', 'refunded_on', 'name_if_shown'];
/** Every pledge and every confirmed gift, one row per reference. names: { uid: name } only for people who chose to show it. */
export function giftRows(pledgesBy, paidBy, folds, names = {}) {
  const rows = [], seen = new Set(), f = (folds && folds.f) || {};
  const row = (uid, pl, g) => {
    const k = foldKey(uid, (pl || g).ref);
    const st = g ? (g.refunded ? 'refunded' : g.test ? 'test' : 'paid') : pl.st === 'withdrawn' ? 'withdrawn' : pl.go ? 'waiting' : 'open';
    rows.push([(pl || g).ref, (pl || g).gate, pl ? pl.amount : '', pl ? isoDay(pl.t) : '', st, g ? g.amount : '', g ? isoDay(g.t) : '', g ? g.via : '', g ? g.pid : '',
      g && g.test ? 'yes' : '', f[k] ? isoDay(f[k].t) : '', g && g.refunded ? isoDay(g.refunded) : '', names[uid] || '']);
  };
  for (const [uid, doc] of Object.entries(pledgesBy || {})) {
    const paid = paidList(paidBy && paidBy[uid]);
    for (const pl of pledgeList(doc)) { row(uid, pl, paid.find(g => g.ref === pl.ref)); seen.add(foldKey(uid, pl.ref)); }
  }
  for (const [uid, doc] of Object.entries(paidBy || {})) {
    if (RESERVED.has(uid)) continue;
    for (const g of paidList(doc)) if (!seen.has(foldKey(uid, g.ref))) row(uid, null, g);
  }
  return rows.sort((a, b) => String(b[3] || b[6]).localeCompare(String(a[3] || a[6])));
}

/* ---------- addresses ---------- */
export function safeHttps(u) { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch (e) { return null; } }
export const hostOf = u => { try { return new URL(String(u)).hostname.toLowerCase(); } catch (e) { return ''; } };
const plainHttps = u => { const s = safeHttps(u); if (!s) return null; const x = new URL(s); return x.username || x.password || x.port ? null : x; };
/** May a checkout send the giver here? https, and the connected provider's own domain (or a subdomain of it). */
export function okCheckoutUrl(u, provider, cfg = PAY) {
  const p = cfg.providers[provider], x = p && plainHttps(u); if (!x) return false;
  const h = x.hostname.toLowerCase();
  return p.checkout.some(d => h === d || h.endsWith('.' + d));
}
/** May a steward's payment link point here? https, and exactly one of the chosen provider's hosts. */
export function okLinkUrl(u, provider, cfg = PAY) {
  const p = cfg.providers[provider], x = p && plainHttps(u); if (!x) return false;
  return p.links.includes(x.hostname.toLowerCase());
}
export const providerName = (k, cfg = PAY) => (cfg.providers[k] && cfg.providers[k].name) || '';
/** 'a', 'a or b', 'a, b or c': a list of hosts as a sentence reads it */
export const orList = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/* ---------- words ---------- */
// in running text: "Gate 3, the theme camp", "Gate 6, the cosmic architect" (one way for every gate)
export const gateLabel = g => { if (!g) return 'a gate'; const n = String(g.name); return `Gate ${g.n}, ${/^The /.test(n) ? 'the ' + n.slice(4) : 'the ' + n.charAt(0).toLowerCase() + n.slice(1)}`; };
export const capFirst = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
export const dayText = t => (typeof t === 'number' && t > 0 && t < 8.64e15 ? new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
