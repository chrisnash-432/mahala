/* The pay plugin: the ways to give to The Seed.

   One giving flow, ending where this page can take it:
     Mahala's own site, provider connected   card checkout on the provider's own page, through the pay-checkout edge
                                             function; only the provider's verified notification (pay-webhook) marks a
                                             gift paid
     claude.ai (no server)                   the payment link a steward set opens in a new tab, the giver quotes the
                                             reference there, and a steward confirms the gift by hand
     nothing connected                       the pledge is saved, and nothing pretends money moved
     a saved copy (solo)                     it explains how giving works in the shared Mahalaverse, and records nothing
   It starts on a gate's card ("Choose this gate"), goes through the Support The Seed door ("Choose a gate"), then the
   Your gift step (an amount in rand), then "Stay in touch", whose last button saves the pledge and starts the payment
   (patch_v7_pay.py opens the join flow to it). A pledge is always written before any payment starts.

   It also gives: the raised bar (HOOK7.raised: the keeper's ledger plus confirmed online gifts not yet folded into it),
   the notes beside the working figures (HOOK7.payNote), "Your gifts to The Seed" in Your path (receipts only for
   confirmed gifts), "Gifts to The Seed" in the stewards' tools, gifts (badges) for a confirmed gift, ctx.giftState, and
   the bus events pledge:made and pledge:paid. The data and its rules: core.js and rules/pay.json. */
import { PAY } from './config.js';
import { COPY } from './copy.js';
import * as C from './core.js';

let M = null, V = null, ctx = null, PF = null, DL = undefined;   // PF: the platform (ctx.platform; a test may hand it another)
const S = {
  mode: 'solo', uid: null, signedIn: false, canWrite: false, steward: false, readOnly: false, known: false,
  db: null, status: null, links: {}, online: {}, pledges: null, paid: null,
  all: { pledges: {}, paid: {} }, subs: [], ssubs: [], ret: null, told: new Set(), gen: 0,
};
// the gift being made in the join flow: its gate, reference, what was typed, what the last button will do, and how it ended
const G = { gate: 0, ref: '', raw: '', err: '', action: '', amount: null, acted: false, done: null };
const TKEY = 'mahala.pay.told';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Copy with every pledge reference in it set in mono and kept on one line (a reference is letters, digits and dashes only). */
const tx = s => esc(s).replace(/MH[1-7]-[0-9A-Z]{5}-[0-9A-Z]{5}(?:\.[0-9A-Z]{6})?/g, m => `<span class="mono mv-nowrap">${m}</span>`);
const icon = n => (M && M.icon ? M.icon(n) : '');
const chip = (t, tone) => `<span class="chip ${esc(tone)}">${esc(t)}</span>`;
const toast = t => { try { M.toast(t); } catch (e) { } };
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const $ = (s, r = document) => r.querySelector(s);
const R = n => C.fmtR(n);
const lc = s => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);
// repaint only when something changed, so live updates never take a keyboard user's focus
const setHTML = (el, html) => { if (!el) return; if (el.__v7html === html && el.__v7ser === el.innerHTML) return; el.innerHTML = html; el.__v7html = html; el.__v7ser = el.innerHTML; };

export async function start(m, c) {
  M = m; V = m && m.v7; ctx = c; PF = (c && c.platform) || null;
  if (!V || !M.HOOK7) return null;
  S.mode = modeNow();
  try { (JSON.parse(localStorage.getItem(TKEY) || '[]') || []).forEach(r => S.told.add(r)); } catch (e) { }
  addCss(); addReturnSheet();

  const H = M.HOOK7;
  H.raised = () => C.raisedNow(ledgerNow(), V.CONFIG && V.CONFIG.raise, S.online);
  H.payNote = (kind, n) => noteFor(kind, n);
  H.give = { ready: () => true, step: drawStep, touch, ending, give: n => { if (!V.giveStep) return false; V.giveStep(n); return true; } };

  const JM = $('#joinModal');
  if (JM) {
    JM.addEventListener('click', onJoinClick);
    JM.addEventListener('input', e => { if (e.target && e.target.id === 'v7pay-amt') { G.raw = e.target.value; G.err = ''; paintStep(); } });
    JM.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'v7pay-amt') { e.preventDefault(); stepNext(); } });
  }

  ctx.dashboard.push({ id: 'pay', title: COPY.dashTitle, order: 60, render: renderDash,
    export: () => ({ pledges: clone(S.pledges) || null, gifts: clone(S.paid) || null }), erase: eraseMine });
  ctx.steward.push({ id: 'pay', title: COPY.sTitle, order: 50, count: waitingCount, render: renderSteward });
  ctx.gifts.push({ id: 'pay-giver', title: COPY.giverTitle, kind: 'badge', icon: 'gift', why: COPY.giverWhy, test: s => !!(s && +s.paid > 0) });
  for (const g of V.DATA.gates) {
    if (!g.badge) continue;
    ctx.gifts.push({ id: 'pay-gate-' + g.n, title: g.badge, kind: 'badge', icon: 'star', why: COPY.gateWhy(C.gateLabel(g)),
      test: s => !!(s && Array.isArray(s.paidGates) && s.paidGates.includes(g.n)) });
  }
  const giftState = async () => { const got = myGifts(); return { pledges: C.pledgeList(S.pledges).filter(p => p.st !== 'withdrawn').length, paid: got.length, paidGates: [...new Set(got.map(g => g.gate))] }; };
  ctx.bus.on('ready', () => { if (Array.isArray(ctx.giftState) && !ctx.giftState.includes(giftState)) ctx.giftState.push(giftState); });
  ctx.bus.on('auth:changed', () => { connect().catch(e => console.warn('pay', e)); });

  S.ret = readReturn();
  connect().catch(e => console.warn('The pay plugin could not connect:', e));
  const api = { S, G, C, COPY, PAY, paint: () => changed('all'),
    usePlatform: p => { PF = p || null; S.mode = modeNow(); return connect(); },   // for tests: run as another platform would
    useDownloads: d => { DL = d; },
    showReturn: (pay, ref) => { S.ret = { pay, ref: C.isRef(ref) ? ref : null, slow: false, shown: false }; openReturn(); } };   // for tests: the return panel without a reload
  window.__v7pay = api;
  return api;
}

/* ====================== who is viewing, and the data ====================== */
const modeNow = () => (PF && PF.mode) || (window.claude && typeof window.claude.use === 'function' ? 'claude' : 'solo');
async function use(name) {
  if (S.mode === 'solo') return null;
  try { if (PF && typeof PF.use === 'function') return await PF.use(name); } catch (e) { }
  try { if (window.claude && typeof window.claude.use === 'function') return await window.claude.use(name); } catch (e) { }
  return null;
}
async function whoami() {
  if (PF && typeof PF.me === 'function') {
    try { const m = await PF.me(); return { id: m.id || null, signedIn: !!(m.signedIn || m.id), canWrite: m.canWrite !== false, steward: !!(m.isSteward || m.isOwner) }; } catch (e) { }
  }
  const u = await use('user');
  if (!u) return { id: null, signedIn: false, canWrite: false, steward: false };
  let id = null, ed = false, own = false, w = null;
  try { id = await u.id(); } catch (e) { } try { ed = !!(await u.canEdit()); } catch (e) { } try { own = !!(await u.isOwner()); } catch (e) { } try { w = await u.can('data.write'); } catch (e) { }
  return { id, signedIn: !!id, canWrite: w !== false, steward: ed || own };
}
async function connect() {
  const gen = ++S.gen;
  if (PF && PF.ready) { try { await Promise.race([PF.ready, new Promise(r => setTimeout(r, 10000))]); } catch (e) { } }
  const me = await whoami(), db = await use('db');
  if (gen !== S.gen) return;
  Object.assign(S, { uid: me.id, signedIn: me.signedIn, canWrite: me.canWrite, steward: me.steward, readOnly: false, db });
  S.subs.forEach(u => { try { u(); } catch (e) { } }); S.subs = [];
  S.ssubs.forEach(u => { try { u(); } catch (e) { } }); S.ssubs = [];
  S.pledges = null; S.paid = null; S.all = { pledges: {}, paid: {} };
  if (S.db) {
    sub(S.subs, S.db.doc('paytotals/online'), d => { S.online = d || {}; changed('totals'); });
    if (S.mode === 'claude') sub(S.subs, S.db.doc('payconfig/links'), d => { S.links = d || {}; changed('links'); });
    if (S.uid) {
      sub(S.subs, S.db.doc('pledges/' + S.uid), d => { S.pledges = d; changed('mine'); });
      sub(S.subs, S.db.doc('paid/' + S.uid), d => { S.paid = d; changed('paid'); });
    }
    if (S.steward) {
      sub(S.ssubs, S.db.doc('leads/ledger'), d => { S.ledger = d || null; changed('steward'); changed('totals'); });   // the fold waits on it
      sub(S.ssubs, S.db.collection('pledges'), o => { S.all.pledges = o; changed('steward'); }, true);
      sub(S.ssubs, S.db.collection('paid'), o => { S.all.paid = o; changed('steward'); }, true);
    }
  }
  if (S.mode === 'standalone') {
    let st = null; try { st = await callFn({ action: 'status' }); } catch (e) { st = null; }
    if (gen !== S.gen) return;
    S.status = st && st.ok === true ? st : { ok: false, provider: null, error: true };
  }
  S.known = true;
  changed('all');
  if (S.ret && !S.ret.shown) openReturn();
}
function sub(list, ref, fn, coll = false) {
  try {
    list.push(ref.onSnapshot(s => {
      if (coll) { const o = {}; s.docs.forEach(d => { const v = d.data(); if (v && typeof v === 'object') o[d.id] = v; }); fn(o); }
      else fn(s.exists ? s.data() : null);
    }, e => console.warn('pay: a subscription stopped', e && e.code)));
  } catch (e) { console.warn('pay', e); }
}
let paintQueued = false;
function changed(what) {
  if (what === 'paid' || what === 'all') announcePaid();
  if (what === 'totals' || what === 'all') { try { V.renderRaise(); } catch (e) { } }
  if (paintQueued) return; paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; paintDash(); paintSteward(); paintReturn(); paintStep(true); });
}
// one write at a time per document: read, change, write. fn(current) returns the next body, or null for no change
const WQ = new Map();
function writeOne(path, fn) {
  const run = (WQ.get(path) || Promise.resolve()).then(async () => {
    if (!S.db) return false;
    const ref = S.db.doc(path), cur = await ref.get(), next = fn(cur.exists ? clone(cur.data()) : null);
    if (!next) return true;
    await ref.set(next); return true;
  }).catch(e => { console.warn('pay: a write failed', path, e && e.code); if (e && (e.code === 'invalid_argument' || e.code === 'not_granted' || e.code === 'revoked')) S.readOnly = true; return false; });
  WQ.set(path, run.then(() => { }, () => { }));
  return run;
}
async function lease(path) {          // stewards' shared totals: one steward at a time (a courtesy between pages, not a lock)
  try { for (let i = 0; i < 4; i++) { const r = await S.db.doc(path).acquire({ holder: S.uid || 'steward', ttlMs: 8000 }); if (r && r.acquired) return; await new Promise(z => setTimeout(z, 600 + Math.random() * 600)); } } catch (e) { }
}
const sharedOK = () => !!(S.db && S.uid && S.canWrite !== false && !S.readOnly);
const myGifts = () => C.paidList(S.paid).filter(C.counts);

/* ====================== how this page pays (the way, for a gate and an amount) ====================== */
const provName = k => C.providerName(k) || 'the payment provider';
const cardOn = () => S.mode === 'standalone' && !!(S.status && S.status.ok && PAY.providers[S.status.provider]);
function linkFor(n) {                 // claude.ai only: the steward's link for this gate, or for any amount, if it is safe to open
  if (S.mode !== 'claude') return null;
  const L = (S.links && S.links.links) || {}, p = S.links && S.links.provider;
  for (const u of [L[String(n)], L.any]) if (u && C.okLinkUrl(u, p)) return C.safeHttps(u);
  return null;
}
const anyLink = () => S.mode === 'claude' && V.DATA.gates.some(g => linkFor(g.n));
const liveProvider = () => cardOn() ? S.status.provider : S.mode === 'claude' && anyLink() ? S.links.provider : null;
/** What giving through this gate can do here: 'solo' | 'signin' | 'ro' | 'rolink' | 'big' | 'card' | 'link' | 'none'. */
function way(n, amount) {
  if (S.mode === 'solo') return 'solo';
  if (S.mode === 'standalone' && S.known && !S.uid) return 'signin';
  if (S.known && !sharedOK()) return linkFor(n) ? 'rolink' : 'ro';
  const chk = C.checkAmount(amount);
  if (chk.ok && !chk.card) return 'big';
  if (S.mode === 'standalone') return cardOn() ? 'card' : 'none';
  return linkFor(n) ? 'link' : 'none';
}
/** The accounts keeper's ledger: a steward's own subscription when there is one (it may arrive before the game's), else the game's. */
const ledgerNow = () => (S.ledger !== undefined ? S.ledger : (V.LIVE && V.LIVE.leads && V.LIVE.leads.ledger) || null);
function noteFor(kind, n) {            // the words beside the working figures, true in every state
  if (kind === 'cur') { const gs = n ? [V.GATE_BY(n)] : (V.DATA && V.DATA.gates) || []; return gs.some(g => g && /^\s*\$/.test(String(g.amount || ''))) ? COPY.note.cur : ''; }
  const p = n ? (cardOn() ? S.status.provider : linkFor(n) ? S.links.provider : null) : liveProvider();
  if (kind === 'list') return S.mode === 'solo' ? COPY.note.listSolo : p ? COPY.note.listLive(provName(p)) : COPY.note.listOff;
  return `${S.mode === 'solo' ? COPY.note.solo : p ? COPY.note.live(provName(p)) : COPY.note.off} ${COPY.note.gate}`;
}
async function callFn(body) {
  const P = PF || {};
  if (typeof P.invoke === 'function') return P.invoke(PAY.fn, body);
  throw new Error('This page has no way to reach the payment service.');
}
function postForm(action, fields) {
  const f = document.createElement('form'); f.method = 'POST'; f.action = action; f.style.display = 'none';
  for (const [k, v] of fields) { const i = document.createElement('input'); i.type = 'hidden'; i.name = String(k); i.value = String(v); f.appendChild(i); }
  document.body.appendChild(f); f.submit();
}
const ERR = { not_connected: () => COPY.errOff, already_paid: () => COPY.errPaid, rate_limited: () => COPY.errBusy, auth: () => COPY.errAuth,
  provider: () => COPY.errProvider(provName(S.status && S.status.provider)), bad_pledge: () => COPY.errBad };
async function checkout(ref) {
  let r;
  try { r = await callFn({ action: 'checkout', ref }); } catch (e) { return { ok: false, message: COPY.errNet }; }
  if (!r || r.ok !== true) return { ok: false, code: r && r.code, message: (ERR[r && r.code] || (() => COPY.errNet))() };
  const prov = S.status && S.status.provider;
  const form = r.kind === 'form' && C.okCheckoutUrl(r.action, prov) && Array.isArray(r.fields) && r.fields.length < 60 &&
    r.fields.every(f => Array.isArray(f) && f.length === 2 && typeof f[0] === 'string' && typeof f[1] === 'string');
  const away = r.kind === 'redirect' && C.okCheckoutUrl(r.url, prov);
  if (!form && !away) return { ok: false, message: COPY.errBad };     // never send a giver anywhere but the provider's own page
  await writeOne('pledges/' + S.uid, cur => C.patchPledge(cur, ref, { go: Date.now() }));
  if (away) location.assign(r.url); else postForm(r.action, r.fields);
  return { ok: true };
}
async function savePledge(entry) {
  if (!sharedOK()) return false;
  const ok = await writeOne('pledges/' + S.uid, cur => C.upsertPledge(cur || {}, entry));
  if (ok) ctx.bus.emit('pledge:made', { uid: S.uid, mine: true, ref: entry.ref, gate: entry.gate, amount: entry.amount, cur: C.CUR });
  return ok;
}

/* ====================== the Your gift step ====================== */
const GIVING = ['card', 'link', 'none', 'big'];       // the ways that save a pledge
const amountNow = () => C.parseRand(G.raw);
const errText = why => ({ empty: COPY.err.empty, nan: COPY.err.nan, small: COPY.err.small(R(PAY.min)), big: COPY.err.big, cents: COPY.err.cents })[why] || COPY.err.nan;
function resetGift(n) { Object.assign(G, { gate: n, ref: C.newRef(n), raw: '', err: '', action: '', amount: null, acted: false, done: null }); }
const onStep = () => { const B = $('#joinBody'); return !!(B && B.querySelector('.v7-pay-give')); };
function figHTML(g) {
  const a = String(g.amount || ''), usd = /^\s*\$/.test(a);
  return `<div class="v7-pay-fig"><span class="mono">${esc(a)}</span>${chip(COPY.figChip, 'wait')}</div><small>${esc(usd ? COPY.figUSD : COPY.figZAR)}</small>`;
}
const headHTML = g => `<div class="v7-pay-head"><span class="eyebrow">${esc(COPY.giveEyebrow)}</span><b>${esc(C.gateLabel(g))}</b>${figHTML(g)}</div>`;
const refundHTML = () => `<details class="v7-pay-more"><summary>${esc(COPY.refundTitle)}</summary><ul>${COPY.refund.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`;
function nextItems(w, n) {
  const chk = C.checkAmount(n), amt = chk.ok ? R(n) : '', p = provName(S.status && S.status.provider || S.links.provider), first = COPY.yourPledge(amt, G.ref);
  if (w === 'card') return [first, ...COPY.next.card(p)];
  if (w === 'link') return [first, ...COPY.next.link(provName(S.links.provider), C.hostOf(linkFor(G.gate)), amt)];
  if (w === 'big') return [first, ...COPY.next.big()];
  return [first, ...COPY.next.none()];
}
function drawStep(B, F) {
  const n = +(V.JF && V.JF.gate) || 1;
  if (G.gate !== n || !G.ref || G.acted) resetGift(n);
  const g = V.GATE_BY(G.gate) || V.DATA.gates[0], w = way(G.gate, amountNow());
  G.drawn = w;
  const back = `<button class="btn" data-j="back">Back</button>`, cont = `<button class="btn primary" data-v7pay="next">${esc(COPY.btnContinue)}</button>`;
  const notNow = `<button class="btn" data-v7pay="skip">${esc(COPY.btnNotNow)}</button>`;
  if (w === 'solo') {
    B.innerHTML = `<div class="v7-pay-give">${headHTML(g)}<p class="spine">${esc(COPY.soloLead)}</p>
      <div class="v7-pay-next"><span class="eyebrow">${esc(COPY.soloHowTitle)}</span><ol>${COPY.soloHow.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <p class="note strong">${esc(COPY.notDeductible)}</p></div>`;
    F.innerHTML = back + cont; return;
  }
  if (w === 'signin') {
    B.innerHTML = `<div class="v7-pay-give">${headHTML(g)}<p class="spine">${esc(COPY.signInLead)}</p><p class="note">${esc(COPY.privacy)}</p>
      <p class="note strong">${esc(COPY.notDeductible)}</p>${refundHTML()}</div>`;
    F.innerHTML = back + notNow + `<button class="btn primary" data-v7pay="signin">${icon('lock')}${esc(COPY.btnSignIn)}</button>`; return;
  }
  if (w === 'ro' || w === 'rolink') {
    const u = linkFor(G.gate);
    B.innerHTML = `<div class="v7-pay-give">${headHTML(g)}<p class="spine">${esc(COPY.roLead)}</p>
      ${w === 'rolink' ? `<p>${tx(COPY.roLink(provName(S.links.provider), C.hostOf(u), G.ref))}</p>` : ''}<p class="note">${esc(COPY.roAsk)}</p>
      <p class="note strong">${esc(COPY.notDeductible)}</p></div>`;
    F.innerHTML = back + cont; return;
  }
  B.innerHTML = `<div class="v7-pay-give">${headHTML(g)}
    <div class="field"><label for="v7pay-amt">${esc(COPY.amountLabel)}</label>
      <div class="v7-pay-amt"><span aria-hidden="true">R</span><input id="v7pay-amt" inputmode="decimal" autocomplete="off" maxlength="16" value="${esc(G.raw)}" aria-describedby="v7pay-help v7pay-err"></div>
      <small class="note" id="v7pay-help">${esc(COPY.amountHelp(R(PAY.min)))}</small>
      <p class="v7-pay-err" id="v7pay-err" role="alert"></p>
      <p class="note v7-pay-over" hidden>${esc(COPY.overCard(R(PAY.max)))}</p></div>
    <div class="v7-pay-next"><span class="eyebrow">${esc(COPY.nextTitle)}</span><ol id="v7pay-next"></ol></div>
    <p class="note">${esc(COPY.privacy)}</p>
    <p class="note strong">${esc(COPY.notDeductible)}</p>${refundHTML()}</div>`;
  F.innerHTML = back + notNow + cont;
  paintStep();
}
function paintStep(fromData = false) {
  const B = $('#joinBody'); if (!B || !onStep()) return;
  const n = amountNow(), w = way(G.gate, n);
  if (fromData && w !== G.drawn && !(GIVING.includes(w) && GIVING.includes(G.drawn))) {   // what this page can do changed: draw again
    const a = document.activeElement, typing = a && a.id === 'v7pay-amt';
    drawStep(B, $('#joinFoot'));
    const i = typing && $('#v7pay-amt'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { } }
    return;
  }
  G.drawn = w;
  const list = B.querySelector('#v7pay-next'); if (list) setHTML(list, nextItems(w, n).map(t => `<li>${tx(t)}</li>`).join(''));
  const err = B.querySelector('#v7pay-err'); if (err) { err.textContent = G.err || ''; err.hidden = !G.err; }
  const chk = C.checkAmount(n), over = B.querySelector('.v7-pay-over'); if (over) over.hidden = !(chk.ok && !chk.card);
}
function advance() { V.JF.step++; V.renderJoin(); }
function stepNext() {
  if (!onStep()) return;
  const n = amountNow(), w = way(G.gate, n);
  if (w === 'signin') return;
  if (w === 'solo' || w === 'ro' || w === 'rolink') { G.action = w; G.amount = null; advance(); return; }
  const chk = C.checkAmount(n);
  if (!chk.ok) { G.err = errText(chk.why); paintStep(); const i = $('#v7pay-amt'); if (i) i.focus(); return; }
  G.action = w; G.amount = n; advance();
}
function onJoinClick(e) {
  const b = e.target.closest('[data-v7pay]'); if (!b) return;
  const k = b.dataset.v7pay;
  if (k === 'next') { stepNext(); return; }
  if (k === 'skip') { G.action = 'skip'; G.amount = null; advance(); return; }
  if (k === 'signin') { try { PF.signIn(); } catch (er) { } return; }
  if (k === 'retry') { retry(); return; }
}

/* ====================== Stay in touch: what the last button will do ====================== */
function labelFor(a) {
  if (a === 'card') return COPY.btnGiveCard(R(G.amount), provName(S.status.provider));
  if (a === 'link') return COPY.btnSaveLink;
  if (a === 'rolink') return COPY.btnOpenLink;
  return COPY.btnSave;
}
function touch(B, F) {
  if (!G.action || G.gate !== +V.JF.gate || G.acted) return;
  if (GIVING.includes(G.action)) { const w = way(G.gate, G.amount); if (GIVING.includes(w)) G.action = w; }
  const a = G.action; if (!GIVING.includes(a) && a !== 'rolink') return;
  const g = V.GATE_BY(G.gate), pn = provName(a === 'card' ? S.status.provider : S.links.provider);
  const line = a === 'rolink' ? `${COPY.refLabel}: ${G.ref}` : COPY.recapLine(R(G.amount), C.gateLabel(g), G.ref);
  const next = a === 'card' ? COPY.recapNext.card(pn) : a === 'link' ? COPY.recapNext.link(pn) : a === 'rolink' ? COPY.recapNext.rolink(pn) : a === 'big' ? COPY.recapNext.big : COPY.recapNext.none;
  B.insertAdjacentHTML('beforeend', `<div class="v7-pay-recap mv-summary"><span class="eyebrow">${esc(COPY.recapEyebrow)}</span><b>${tx(line)}</b><p class="note">${esc(next)}</p><p class="note strong">${esc(COPY.notDeductible)}</p></div>`);
  const btn = F.querySelector('[data-j="next"]');
  if (btn) btn.innerHTML = icon('gift') + esc(labelFor(a));
}

/* ====================== the ending: save the pledge, then the payment ====================== */
function ending(B, F) {
  if (!G.action) G.action = 'skip';
  if (!G.acted) { G.acted = true; act(); }
  drawEnd(B, F);
  return true;
}
function act() {
  const a = G.action, d = G.done = { how: a, amount: G.amount, ref: G.ref, state: 'saving' };
  if (a === 'link' || a === 'rolink') {
    d.link = linkFor(G.gate);
    if (d.link) { try { window.open(d.link, '_blank', 'noopener,noreferrer'); } catch (e) { } }   // still inside the giver's click
    if (a === 'link') saveThen(); else d.state = 'done';
    return;
  }
  if (GIVING.includes(a)) { saveThen(); return; }
  d.state = 'done';
}
async function saveThen() {
  const d = G.done;
  const entry = C.pledgeEntry(d.ref, G.gate, d.amount, Date.now());
  if (d.how === 'link') entry.go = Date.now();
  const ok = await savePledge(entry);
  if (!ok) { d.state = 'unsaved'; repaintEnd(); return; }
  if (d.how !== 'card') { d.state = 'saved'; repaintEnd(); return; }
  await goCard();
}
async function goCard() {
  const d = G.done; d.state = 'going'; repaintEnd();
  const r = await checkout(d.ref);
  if (!r.ok) { d.state = 'error'; d.msg = r.message; repaintEnd(); }
}
function retry() {
  const d = G.done; if (!d || (d.state !== 'error' && d.state !== 'unsaved')) return;
  if (d.state === 'unsaved') { d.state = 'saving'; repaintEnd(); saveThen(); } else goCard();
}
function repaintEnd() {               // only while the ending this plugin drew is still on screen
  const B = $('#joinBody'), F = $('#joinFoot'), JM = $('#joinModal');
  if (!B || !F || !JM || JM.hidden || !B.querySelector('.v7-pay-end')) return;
  drawEnd(B, F);
}
function drawEnd(B, F) {
  const d = G.done || { how: 'skip' }, g = V.GATE_BY(G.gate) || V.DATA.gates[0], name = V.ME && V.ME.name ? String(V.ME.name) : '';
  const T = $('#joinTitle'); if (T) T.textContent = COPY.thanksTitle(name);      // the name in the title, once
  const pn = provName(d.how === 'card' ? S.status && S.status.provider : S.links.provider);
  const tone = ['yellow', 'cyan', 'magenta'].includes(g.col) ? g.col : 'yellow';
  const hero = `<div class="v7-pay-gatehead" style="--tone: var(--${tone})"><span class="v7-pay-gatemark" aria-hidden="true">${icon('gate')}</span><span class="eyebrow">${esc(COPY.gateEyebrow)}</span><h4>${esc(C.capFirst(C.gateLabel(g)))}</h4></div>`;
  const box = `<div class="v7-pay-pledge mv-summary"><span class="eyebrow">${esc(COPY.pledgeEyebrow)}</span><b>${esc(d.amount != null ? R(d.amount) : '')}</b><span class="mono mv-nowrap">${esc(d.ref)}</span></div>`;
  const again = `<div class="actions"><button class="btn primary" data-v7pay="retry">${icon('gift')}${esc(COPY.btnTryAgain)}</button></div>`;
  const linkA = d.link ? ` <a class="v7-pay-again" href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">${esc(COPY.endLinkAgain)}</a>` : '';
  const warn = t => `<p class="v7-pay-warn" role="alert">${tx(t)}</p>`;
  let block = '';
  if (d.how === 'card') block = box + (d.state === 'error' ? warn(d.msg) + again : d.state === 'unsaved' ? warn(COPY.endSaveFailed) + again : `<p class="spine" role="status">${esc(COPY.endGoing(pn))}</p>`);
  else if (d.how === 'link') block = box + `<p>${tx(COPY.endLink(pn, R(d.amount), d.ref))}${linkA}</p>` + (d.state === 'unsaved' ? warn(COPY.endLinkUnsaved(d.ref)) : `<p class="note">${esc(COPY.endLinkMore)}</p>`);
  else if (d.how === 'none' || d.how === 'big') block = box + (d.state === 'unsaved' ? warn(COPY.endSaveFailed) + again
    : d.state === 'saved' ? `<p>${tx(COPY.endSaved(R(d.amount), d.ref))}</p><p class="note">${esc(d.how === 'big' ? COPY.endBigMore : COPY.endNoneMore)}</p>` : '');
  else if (d.how === 'rolink') block = `<p>${tx(COPY.endRoLink(pn, d.ref))}${linkA}</p>`;
  else if (d.how === 'ro') block = `<p>${esc(COPY.endRo)}</p>`;
  else if (d.how === 'solo') block = `<p>${esc(COPY.endSolo)}</p>`;
  else block = `<p>${esc(COPY.endSkip)}</p>`;
  // no badge here: a gate's gift comes only with a confirmed payment, with its own word when it does
  B.innerHTML = `<div class="v7-pay-end">${hero}${block}
    ${g.builds ? `<p class="v7-pay-builds">${esc(COPY.builds(lc(g.builds)))}</p>` : ''}
    <p class="note strong">${esc(COPY.notDeductible)}</p></div>`;
  F.innerHTML = `<button class="btn ghost v7-pay-share" data-j="sharegift">${icon('share')}${esc(COPY.btnShare)}</button><button class="btn" data-j="path">${icon('path')}${esc(COPY.btnPath)}</button><button class="btn primary" data-j="close">${esc(COPY.btnClose)}</button>`;
}

/* ====================== back from the provider's page ====================== */
function readReturn() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return null; }
  const pay = q.get('pay'), ref = q.get('ref');
  if (!['back', 'cancel', 'fail'].includes(pay)) return null;
  try { const u = new URL(location.href); for (const k of ['pay', 'ref', 'trxref', 'reference']) u.searchParams.delete(k); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { }
  return { pay, ref: C.isRef(ref) ? ref : null, slow: false, shown: false };
}
function addReturnSheet() {
  if ($('#v7payModal')) return;
  const host = ($('#joinModal') && $('#joinModal').parentElement) || document.body;
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'v7payModal'; m.hidden = true;
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="v7payTitle"><div class="sheet-head"><h3 id="v7payTitle">${esc(COPY.retTitle)}</h3><button class="iconbtn x" type="button" data-v7ret="close" aria-label="Close">${icon('x')}</button></div><div class="sheet-body" id="v7payBody"></div><div class="sheet-foot" id="v7payFoot"></div></div>`;
  host.appendChild(m);
  m.addEventListener('click', e => {
    if (e.target === m) { closeReturn(); return; }
    const b = e.target.closest('[data-v7ret]'); if (!b) return; const k = b.dataset.v7ret;
    if (k === 'close') closeReturn();
    if (k === 'signin') { try { PF.signIn(); } catch (er) { } }
    if (k === 'gifts') { closeReturn(); try { V.openPath(); } catch (er) { } }
    if (k === 'again' && S.ret && S.ret.ref) { const ref = S.ret.ref; closeReturn(); payPledge(ref); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) closeReturn(); });
}
function openReturn() {
  const Rt = S.ret; if (!Rt || Rt.shown) return; Rt.shown = true;
  const m = $('#v7payModal'); if (!m) return;
  m.hidden = false;
  if (Rt.pay !== 'back' && Rt.ref && sharedOK()) writeOne('pledges/' + S.uid, cur => C.patchPledge(cur, Rt.ref, { go: null }));
  if (Rt.pay === 'back') {
    setTimeout(() => { if (S.ret === Rt) { Rt.slow = true; paintReturn(); } }, PAY.confirmWait);
    if (cardOn() && S.status.provider === 'paystack' && Rt.ref) callFn({ action: 'check', ref: Rt.ref }).then(r => { if (r && r.ok && (r.status === 'failed' || r.status === 'abandoned')) { Rt.pay = 'fail'; paintReturn(); } }).catch(() => { });
  }
  paintReturn();
  setTimeout(() => { const b = m.querySelector('.sheet-foot .btn.primary') || m.querySelector('.iconbtn.x'); if (b) b.focus(); }, 40);
}
function closeReturn() { const m = $('#v7payModal'); if (m) m.hidden = true; S.ret = null; }
function paintReturn() {
  const Rt = S.ret, m = $('#v7payModal'); if (!Rt || !m || m.hidden) return;
  const B = $('#v7payBody'), F = $('#v7payFoot'), pn = provName(S.status && S.status.provider);
  const close = `<button class="btn primary" data-v7ret="close">${esc(COPY.btnClose)}</button>`;
  if (!S.uid) { setHTML(B, `<p>${esc(COPY.retSignIn)}</p>`); setHTML(F, (PF && PF.signIn ? `<button class="btn" data-v7ret="signin">${icon('lock')}${esc(COPY.btnSignInShort)}</button>` : '') + close); return; }
  const got = Rt.ref && C.paidList(S.paid).find(e => e.ref === Rt.ref);
  if (got) {
    const gate = V.GATE_BY(got.gate);
    setHTML(B, `<div class="badge">${V.BADGE_SVG || ''}<span class="eyebrow">${esc(COPY.st.paid)}</span><h4>${esc(R(got.amount))}</h4></div>
      <p class="spine">${esc(COPY.retPaid(R(got.amount), C.gateLabel(gate)))}</p>${got.test ? `<p class="note strong">${esc(COPY.retTest)}</p>` : ''}
      <p class="note">${esc(COPY.receiptNotDeductible)}</p>`);
    setHTML(F, `<button class="btn" data-v7ret="gifts">${icon('path')}${esc(COPY.btnYourGifts)}</button>` + close); return;
  }
  if (Rt.pay === 'cancel' || Rt.pay === 'fail') {
    setHTML(B, `<p class="spine">${esc(Rt.pay === 'cancel' ? COPY.retCancel : COPY.retFail)}</p><p class="note">${esc(COPY.notDeductible)}</p>`);
    setHTML(F, (Rt.ref && cardOn() ? `<button class="btn" data-v7ret="again">${icon('gift')}${esc(COPY.btnTryAgain)}</button>` : `<button class="btn" data-v7ret="gifts">${icon('path')}${esc(COPY.btnYourGifts)}</button>`) + close); return;
  }
  if (Rt.ref && C.checkList(S.paid).some(e => e.ref === Rt.ref && e.why !== 'refund')) { setHTML(B, `<p>${esc(COPY.retCheck(pn))}</p><p class="note">${esc(COPY.notDeductible)}</p>`); setHTML(F, close); return; }
  if (!Rt.ref) { setHTML(B, `<p>${esc(COPY.retUnknown)}</p>`); setHTML(F, close); return; }
  setHTML(B, `<p class="spine" role="status">${esc(Rt.slow ? COPY.retSlow(pn) : COPY.retWait(pn))}</p>${Rt.slow ? '' : `<p class="note">${esc(COPY.retWaitMore)}</p>`}
    <div class="v7-pay-pledge mv-summary"><span class="eyebrow">${esc(COPY.refLabel)}</span><b class="mono mv-nowrap">${esc(Rt.ref)}</b></div>`);
  setHTML(F, close);
}
function announcePaid() {
  for (const g of C.paidList(S.paid)) {
    if (!C.counts(g) || S.told.has(g.ref)) continue;
    S.told.add(g.ref);
    try { localStorage.setItem(TKEY, JSON.stringify([...S.told].slice(-200))); } catch (e) { }
    ctx.bus.emit('pledge:paid', { uid: S.uid, mine: true, ref: g.ref, gate: g.gate, amount: g.amount, cur: C.CUR, via: g.via });
  }
}
/** Give for a pledge already made (the dashboard, or Try again on the return). */
async function payPledge(ref) {
  const pl = C.pledgeList(S.pledges).find(p => p.ref === ref);
  if (!pl) { toast(COPY.retUnknown); return; }
  if (way(pl.gate, pl.amount) !== 'card') { toast(COPY.errOff); return; }
  toast(COPY.endGoing(provName(S.status.provider)));
  const r = await checkout(ref); if (!r.ok) toast(r.message);
}

/* ====================== the giver's dashboard: Your gifts to The Seed ====================== */
const D = { els: new Set(), ask: null };
const CHIP = { paid: 'done', waiting: 'wait', open: 'now', withdrawn: 'lock', check: 'wait', refunded: 'lock', test: 'lock' };
function renderDash(el) {
  if (!el.__v7pay) { el.__v7pay = true; el.addEventListener('click', onDashClick); }
  D.els.add(el); el.__v7html = null; paintDash();
}
function dashHTML() {
  const empty = (t, btn = '') => `<div class="v7-pay-dash"><div class="mv-empty"><p class="v7-pay-emptyline">${esc(t)}</p>${btn}</div></div>`;
  if (S.mode === 'solo') return empty(COPY.dashSolo);
  if (S.known && !S.uid) return S.mode === 'standalone' ? empty(COPY.dashSignedOut, PF && PF.signIn ? `<button class="btn" data-v7d="signin">${icon('lock')}${esc(COPY.btnSignInShort)}</button>` : '')
    : empty(COPY.dashSignedOutLink);
  const rows = C.pledgeList(S.pledges).map(p => ({ p, st: C.statusOf(p, S.paid) }));
  for (const g of C.paidList(S.paid)) if (!rows.some(r => r.p.ref === g.ref)) rows.push({ p: { ref: g.ref, gate: g.gate, amount: g.amount, t: g.t, st: 'open' }, st: g.refunded ? 'refunded' : g.test ? 'test' : 'paid' });
  if (!rows.length) return S.known && !sharedOK() ? empty(COPY.dashRo) : empty(COPY.dashEmpty, `<button class="btn" data-v7d="gates">${icon('gift')}${esc(COPY.dashSeeGates)}</button>`);
  const html = rows.slice(0, 40).map(({ p, st }) => {
    const g = V.GATE_BY(p.gate), paid = C.paidList(S.paid).find(e => e.ref === p.ref);
    const day = C.dayText(paid ? paid.t : p.t), when = st === 'open' || st === 'paid' ? day : paid ? COPY.confirmedOn(day) : COPY.pledgedOn(day);   // the chip already says Pledged or Confirmed
    let more = '', acts = '';
    if (st === 'paid') more = receiptHTML(paid, g);
    if (st === 'test') more = `<p class="note">${esc(COPY.retTest)}</p>`;
    if (st === 'refunded') more = `<p class="note">${esc(COPY.rcRefunded)}</p>`;
    if (st === 'check') more = `<p class="note">${esc(COPY.retCheck(provName(S.status && S.status.provider)))}</p>`;
    const stale = st === 'waiting' && p.go && Date.now() - p.go > 15 * 60 * 1000;
    if (st === 'open' || stale) {
      const w = way(p.gate, p.amount);
      if (D.ask === p.ref) acts = `<span class="note">${esc(COPY.withdrawAsk)}</span><button class="btn" data-v7d="withdraw:${esc(p.ref)}">${esc(COPY.btnWithdraw)}</button><button class="btn" data-v7d="keep">${esc(COPY.btnKeep)}</button>`;
      else {
        if (w === 'link') acts += `<a class="btn primary" href="${esc(linkFor(p.gate))}" target="_blank" rel="noopener noreferrer" data-v7d="link:${esc(p.ref)}">${icon('gift')}${esc(COPY.btnGiveNow)}</a>`;
        else if (w === 'card') acts += `<button class="btn primary" data-v7d="give:${esc(p.ref)}">${icon('gift')}${esc(COPY.btnGiveNow)}</button>`;
        if (st === 'open' && sharedOK()) acts += `<button class="btn" data-v7d="ask:${esc(p.ref)}">${esc(COPY.btnWithdraw)}</button>`;
      }
      if (stale) more = `<p class="note">${esc(w === 'card' || w === 'link' ? COPY.dashStale : COPY.dashStaleWait)}</p>`;   // went to pay a while ago: say what happens if they did
      else if (w === 'none') more = `<p class="note">${esc(COPY.dashNotLive)}</p>`;
      else if (w === 'big') more = `<p class="note">${esc(COPY.endBigMore)}</p>`;
    }
    return `<div class="v7-pay-row"><div class="v7-pay-row1"><b>${esc(C.gateLabel(g))}</b><span class="mono">${esc(R(paid ? paid.amount : p.amount))}</span></div>
      <div class="v7-pay-row2">${chip(COPY.st[st] || st, CHIP[st] || 'now')}<span class="mono">${esc(p.ref)}</span><span>${esc(when)}</span></div>
      ${more}${acts ? `<div class="actions">${acts}</div>` : ''}</div>`;
  }).join('');
  return `<div class="v7-pay-dash">${html}<p class="note">${esc(COPY.privacy)} ${esc(COPY.dashKept)}</p></div>`;
}
function receiptHTML(gift, g) {
  const via = gift.via === 'steward' ? COPY.rcHand : provName(gift.via);
  return `<div class="v7-pay-receipt"><b>${esc(COPY.rcTitle)}</b>
    <dl class="kv"><div><dt>${esc(COPY.rcAmount)}</dt><dd class="mono">${esc(R(gift.amount))}</dd></div><div><dt>${esc(COPY.rcGate)}</dt><dd>${esc(C.gateLabel(g))}</dd></div>
      <div><dt>${esc(COPY.rcRef)}</dt><dd class="mono">${esc(gift.ref)}</dd></div><div><dt>${esc(COPY.rcDate)}</dt><dd>${esc(C.dayText(gift.t))}</dd></div>
      <div><dt>${esc(COPY.rcVia)}</dt><dd>${esc(via)}</dd></div></dl>
    <p class="note strong">${esc(COPY.receiptNotDeductible)}</p>
    <div class="actions"><button class="btn" data-v7d="receipt:${esc(gift.ref)}">${icon('save')}${esc(COPY.rcSave)}</button></div></div>`;
}
function receiptText(gift) {
  const g = V.GATE_BY(gift.gate), via = gift.via === 'steward' ? COPY.rcHand : provName(gift.via);
  return [COPY.rcFileHead, '', `${COPY.rcAmount}: ${R(gift.amount)}`, `${COPY.rcGate}: ${C.gateLabel(g)}`, `${COPY.rcRef}: ${gift.ref}`,
    `${COPY.rcDate}: ${C.dayText(gift.t)}`, `${COPY.rcVia}: ${via}`, '', COPY.receiptNotDeductible, COPY.rcFileThanks, ''].join('\r\n');
}
function paintDash() {
  const html = dashHTML();
  for (const el of [...D.els]) { if (!el.isConnected) { D.els.delete(el); continue; } setHTML(el, html); }
}
async function eraseMine() {          // the me plugin's "delete my data": the pledges go; confirmed gifts stay in the camp's accounts
  try { localStorage.removeItem(TKEY); } catch (e) { }
  if (S.db && S.uid && S.pledges) await S.db.doc('pledges/' + S.uid).delete();
  S.pledges = null; paintDash();
}
function onDashClick(e) {
  const b = e.target.closest('[data-v7d]'); if (!b) return; const v = b.dataset.v7d, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
  if (k === 'gates') { try { V.openJoin('back'); } catch (er) { } return; }
  if (k === 'signin') { try { PF.signIn(); } catch (er) { } return; }
  if (k === 'give') { payPledge(x); return; }
  if (k === 'link') { if (sharedOK()) writeOne('pledges/' + S.uid, cur => C.patchPledge(cur, x, { go: Date.now() })); return; }   // the link opens by itself
  if (k === 'ask') { D.ask = x; paintDash(); return; }
  if (k === 'keep') { D.ask = null; paintDash(); return; }
  if (k === 'withdraw') { D.ask = null; writeOne('pledges/' + S.uid, cur => C.patchPledge(cur, x, { st: 'withdrawn', w: Date.now() })).then(ok => toast(ok ? COPY.withdrawn : COPY.sFailed)); return; }
  if (k === 'receipt') { const g = C.paidList(S.paid).find(e2 => e2.ref === x && C.counts(e2)); if (g) saveFile(`mahala-gift-${g.ref}.txt`, receiptText(g), 'text/plain').then(r => toast(r === 'saved' ? COPY.rcSaved : r === 'off' ? COPY.saveOff : r === 'declined' ? '' : COPY.sFailed)); return; }
}
async function saveFile(filename, data, type) {
  const dl = DL !== undefined ? DL : await use('downloads');
  if (dl && typeof dl.save === 'function') {
    try { await dl.save({ filename, data }); return 'saved'; }
    catch (e) { return e && e.code === 'declined' ? 'declined' : e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code) ? 'off' : 'failed'; }
  }
  if (S.mode !== 'standalone') return 'off';          // on claude.ai only the downloads capability may save a file
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return 'saved'; }
  catch (e) { return 'off'; }
}

/* ====================== the stewards' tools: Gifts to The Seed ====================== */
const W = { els: new Set(), filter: 'all', ask: null, askAmt: '', unticked: new Set(), foldAsk: false, foldKeys: '', draft: null, msg: '' };
function stewardItems() {
  const out = [], seen = new Set(), folds = (S.all.paid && S.all.paid.folds) || {}, f = folds.f || {};
  const add = (uid, pl, g) => {
    const ref = (pl || g).ref, k = C.foldKey(uid, ref), doc = S.all.paid[uid];
    const checks = C.checkList(doc).filter(x => x.ref === ref);
    const st = g ? (g.refunded ? 'refunded' : g.test ? 'test' : 'paid') : pl.st === 'withdrawn' ? 'withdrawn' : pl.go ? 'waiting' : 'open';
    out.push({ uid, k, ref, gate: (pl || g).gate, pledged: pl ? pl.amount : null, t: pl ? pl.t : g.t, go: pl ? pl.go : null, g, st, folded: f[k] || null, checks });
  };
  for (const [uid, doc] of Object.entries(S.all.pledges || {})) {
    const paid = C.paidList(S.all.paid[uid]);
    for (const pl of C.pledgeList(doc)) { add(uid, pl, paid.find(g => g.ref === pl.ref)); seen.add(C.foldKey(uid, pl.ref)); }
  }
  for (const [uid, doc] of Object.entries(S.all.paid || {})) {
    if (C.RESERVED.has(uid)) continue;
    for (const g of C.paidList(doc)) if (!seen.has(C.foldKey(uid, g.ref))) add(uid, null, g);
  }
  return out.sort((a, b) => (b.t || 0) - (a.t || 0));
}
function nameOf(uid) {               // a name only where the person chose "Show my name" (their builders/<uid> carries it then)
  const b = ((V.LIVE && V.LIVE.builders) || []).find(x => x && x.id === uid);
  return (b && typeof b.name === 'string' && b.name.trim()) ? b.name.trim().slice(0, 40) : '';
}
function waitingCount() {             // what needs a steward: checks still open, and on claude.ai gifts waiting to be confirmed by hand
  if (!S.steward) return 0;
  const items = stewardItems();
  return items.filter(it => it.checks.some(x => C.checkOpen(x, it.st)) || (S.mode !== 'standalone' && it.st === 'waiting')).length + C.checkList(S.all.paid && S.all.paid.unmatched).length;
}
function renderSteward(el) {
  if (!S.steward) { el.textContent = ''; return; }
  const box = document.createElement('div'); box.className = 'v7-pay-st';
  box.addEventListener('click', onStewardClick); box.addEventListener('submit', onStewardSubmit); box.addEventListener('change', onStewardChange); box.addEventListener('input', onStewardInput);
  el.replaceChildren(box); W.els.add(box); paintSteward();
}
function paintSteward() {
  if (!W.els.size) return;
  const html = S.steward ? stewardHTML() : '';
  for (const el of [...W.els]) {
    if (!el.isConnected && el.__v7drawn) { W.els.delete(el); continue; }
    if (el.__v7html === html && el.__v7ser === el.innerHTML) continue;
    const a = document.activeElement, focus = a && el.contains(a) ? (a.name ? 'name:' + a.name : a.dataset && a.dataset.v7s ? 'v7s:' + a.dataset.v7s : null) : null;
    const open = [...el.querySelectorAll('details')].map(d => d.open);
    el.innerHTML = html; el.__v7html = html; el.__v7drawn = true;
    el.querySelectorAll('details').forEach((d, i) => { if (i < open.length) d.open = open[i]; });
    if (focus) { const t = focus.startsWith('name:') ? el.querySelector(`[name="${CSS.escape(focus.slice(5))}"]`) : el.querySelector(`[data-v7s="${CSS.escape(focus.slice(4))}"]`); if (t) t.focus(); }
    el.__v7ser = el.innerHTML;
  }
  for (const el of W.els) paintHead(el);
}
function paintHead(el) {               // co draws the section's heading once, with how many things wait: keep that number true
  const sec = el.closest && el.closest('.v7-co-sec'), h4 = sec && sec.querySelector(':scope > h4');
  if (!h4) return;
  let n = 0; try { n = waitingCount(); } catch (e) { n = 0; }
  const c = h4.querySelector('.chip'), t = `${n} waiting`;
  if (n > 0) { if (!c) { const sp = document.createElement('span'); sp.className = 'chip now'; sp.textContent = t; h4.append(' ', sp); } else if (c.textContent !== t) c.textContent = t; }
  else if (c) c.remove();
}
function stewardHTML() {
  const items = stewardItems(), folds = (S.all.paid && S.all.paid.folds) || {}, un = C.unfolded(S.all.paid, folds);
  const L = ledgerNow(), bar = V.raiseNow ? V.raiseNow() : null;
  const ledgerSet = C.ledgerSet(L), dollars = ledgerSet && L.cur === '$';
  const ledgerShown = ledgerSet ? V.money(Math.max(0, +L.raised || 0), dollars ? '$' : 'R') : R(+(V.CONFIG.raise && V.CONFIG.raise.raised) || 0);
  const stale = Math.abs(C.safeTotal(S.online) - un.amount) > 0.004 || (+(S.online && S.online.n) || 0) !== un.n;
  const ro = !sharedOK(), dis = ro ? ' disabled' : '';
  const p = liveProvider();
  const status = S.mode === 'standalone' ? (cardOn() ? COPY.sOn(provName(S.status.provider), S.status.mode) : S.status && S.status.error ? COPY.sUnknown : COPY.sOff)
    : p ? COPY.sClaudeOn(provName(p)) : COPY.sClaudeOff;
  const F = W.filter, shown = items.filter(it => F === 'all' || (F === 'open' && (it.st === 'open' || it.st === 'waiting')) || (F === 'paid' && it.st === 'paid')
    || (F === 'unfolded' && it.st === 'paid' && !it.folded) || (F === 'check' && it.checks.length));
  const unmatched = C.checkList(S.all.paid && S.all.paid.unmatched);
  const ticked = un.list.filter(g => !W.unticked.has(g.k)), tAmt = ticked.reduce((s, g) => s + g.amount, 0);
  if (W.foldAsk && W.foldKeys !== ticked.map(g => g.k).join('|')) W.foldAsk = false;   // the gifts changed since the steward asked: ask again
  const foldForm = un.n ? `<p class="note">${esc(COPY.sFoldHelp)}</p>
      <form data-v7s-form="fold"><ul class="v7-pay-folds">${un.list.slice(0, 100).map(g => `<li><label class="check"><input type="checkbox" name="f:${esc(g.k)}"${W.unticked.has(g.k) ? '' : ' checked'}${dis}><span><b>${esc(nameOf(g.uid) || COPY.sGiver)}, ${esc(R(g.amount))}</b><small>${esc(g.ref)} · ${esc(C.gateLabel(V.GATE_BY(g.gate)))} · ${esc(C.dayText(g.t))}</small></span></label></li>`).join('')}</ul>
      ${W.foldAsk && ticked.length && ledgerSet ? `<p class="note strong">${esc(COPY.sFoldAsk(ticked.length, R(Math.round(tAmt * 100) / 100)))}</p><div class="actions"><button class="btn primary" type="submit"${dis}>${esc(COPY.sFoldDo)}</button><button class="btn" type="button" data-v7s="foldcancel">${esc(COPY.sCancel)}</button></div>`
        : `${ledgerSet ? '' : `<p class="note strong">${esc(COPY.sFoldWait)}</p>`}<div class="actions"><button class="btn" type="button" data-v7s="foldask"${ticked.length && !ro && ledgerSet ? '' : ' disabled'}>${esc(COPY.sFoldBtn(ticked.length, R(Math.round(tAmt * 100) / 100)))}</button></div>`}</form>`
    : `<p class="note">${esc(items.some(it => it.g && C.counts(it.g)) ? COPY.sFoldNone : COPY.sFoldEmpty)}</p>`;
  return `<p class="note">${esc(COPY.sIntro)}</p>
    <p class="v7-pay-status">${icon(cardOn() || p ? 'check' : 'lock')}<span>${esc(status)}</span></p>
    ${ro ? `<p class="note strong">${esc(COPY.sReadOnly)}</p>` : ''}
    <div class="sect"><h4>${esc(COPY.sRaisedTitle)}</h4>
      <dl class="kv"><div><dt>${esc(ledgerSet ? COPY.sLedger : COPY.sLedgerStart)}</dt><dd class="mono">${esc(ledgerShown)}</dd></div>
      <div><dt>${esc(COPY.sOnline(un.n))}</dt><dd class="mono">${esc(R(un.amount))}</dd></div>
      <div><dt>${esc(COPY.sBar)}</dt><dd class="mono">${esc(bar ? V.money(bar.raised, bar.cur) : '')}</dd></div></dl>
      ${ledgerSet ? '' : `<p class="note">${esc(COPY.sLedgerPage)}</p>`}${dollars ? `<p class="note">${esc(COPY.sLedgerDollars)}</p>` : ''}<p class="note">${esc(COPY.sRule)}</p>
      ${stale ? `<div class="lockrow"><span>${esc(COPY.sStale)}</span><button class="btn" data-v7s="recount"${dis}>${esc(COPY.sRecount)}</button></div>` : ''}</div>
    <div class="sect"><h4>${esc(COPY.sFoldTitle)}</h4>${foldForm}</div>
    ${unmatched.length ? `<div class="sect"><h4>${esc(COPY.sUnmatchedTitle)}</h4>${unmatched.slice(-10).map(x => `<div class="v7-pay-warn"><p>${esc(COPY.sUnmatched(provName(x.via), R(+x.got || 0), C.dayText(x.t)))}</p><div class="actions"><button class="btn" data-v7s="dismiss:unmatched|${esc(x.via)}|${esc(String(x.pid))}|${esc(x.why)}"${dis}>${esc(COPY.sDismiss)}</button></div></div>`).join('')}</div>` : ''}
    <div class="sect"><h4>${esc(COPY.sGiftsTitle)}</h4>
      <div class="pick" role="group" aria-label="Show">${Object.entries(COPY.sFilter).map(([k, t]) => `<button type="button" data-v7s="filter:${k}" aria-pressed="${F === k}">${esc(t)}</button>`).join('')}</div>
      <div class="v7-pay-list">${shown.length ? shown.slice(0, 200).map(it => stewardRow(it, ro)).join('') : `<p class="note">${esc(COPY.sNone)}</p>`}</div>
      <div class="actions"><button class="btn" data-v7s="export">${icon('save')}${esc(COPY.sExport)}</button></div></div>
    ${S.mode === 'claude' ? linksForm(ro) : ''}
    ${W.msg ? `<p class="note" role="status">${esc(W.msg)}</p>` : ''}`;
}
function stewardRow(it, ro) {
  const g = V.GATE_BY(it.gate), dis = ro ? ' disabled' : '';
  let acts = '', notes = '';
  for (const x of it.checks.filter(c => C.checkOpen(c, it.st)).slice(-3)) {
    const pn = provName(x.via), dismiss = `<button class="btn" data-v7s="dismiss:${esc(it.uid)}|${esc(x.via)}|${esc(String(x.pid))}|${esc(x.why)}"${dis}>${esc(COPY.sDismiss)}</button>`;
    const text = x.why === 'amount' ? COPY.sCheckAmount(pn, R(+x.got || 0), R(+x.want || it.pledged || 0)) : x.why === 'again' ? COPY.sCheckAgain(pn, R(+x.got || 0)) : COPY.sCheckRefund(pn);
    notes += `<div class="v7-pay-warn"><p>${esc(text)}</p><div class="actions">${dismiss}</div></div>`;
  }
  if (W.ask && W.ask.k === it.k) {
    if (W.ask.what === 'confirm') acts = `<form class="v7-pay-mark" data-v7s-form="confirm:${esc(it.k)}"><label class="field"><span>${esc(COPY.sConfirmAmount)}</span><input name="amt" inputmode="decimal" value="${esc(W.askAmt)}" maxlength="16" required></label>
      <p class="note">${tx(COPY.sConfirmAsk(it.ref))}</p><div class="actions"><button class="btn primary" type="submit"${dis}>${esc(COPY.sConfirmDo)}</button><button class="btn" type="button" data-v7s="cancel">${esc(COPY.sCancel)}</button></div></form>`;
    else acts = `<p class="note">${tx(COPY.sRefundAsk(it.ref))}</p><div class="actions"><button class="btn primary" data-v7s="refunddo:${esc(it.k)}"${dis}>${esc(COPY.sRefundDo)}</button><button class="btn" data-v7s="cancel">${esc(COPY.sCancel)}</button></div>`;
  } else {
    if (it.st === 'open' || it.st === 'waiting' || it.st === 'withdrawn') acts += `<button class="btn" data-v7s="confirm:${esc(it.k)}"${dis}>${icon('check')}${esc(COPY.sConfirm)}</button>`;
    if (it.st === 'paid' && it.folded) acts += `<button class="btn" data-v7s="unfold:${esc(it.k)}"${dis}>${esc(COPY.sUnfold)}</button>`;
    if (it.st === 'paid') acts += `<button class="btn" data-v7s="refund:${esc(it.k)}"${dis}>${esc(COPY.sRefund)}</button>`;
  }
  const facts = [it.g && it.g.via === 'steward' ? COPY.sHand : it.g ? `${provName(it.g.via)}${it.g.pid ? ' ' + it.g.pid : ''}` : '', it.st === 'test' ? COPY.sTest : '',
    it.folded ? COPY.sFolded(C.dayText(it.folded.t)) : '', it.g && it.g.refunded ? COPY.sRefunded(C.dayText(it.g.refunded)) : '', !it.g && it.go ? COPY.sWent(C.dayText(it.go)) : ''].filter(Boolean);
  const name = nameOf(it.uid) || COPY.sGiver;
  return `<div class="v7-pay-row"><div class="v7-pay-row1"><b>${esc(name)}</b><span class="mono">${esc(R(it.g ? it.g.amount : it.pledged))}</span></div>
    <div class="v7-pay-row2">${chip(COPY.st[it.st] || it.st, CHIP[it.st] || 'now')}<span class="mono">${esc(it.ref)}</span><span>${esc(C.gateLabel(g))}</span><span>${esc(C.dayText(it.t))}</span></div>
    ${facts.length ? `<p class="note">${esc(facts.join(' · '))}</p>` : ''}${it.pledged != null && it.g && Math.abs(it.g.amount - it.pledged) > 0.004 ? `<p class="note">${esc(COPY.sPledged(R(it.pledged)))}</p>` : ''}${notes}
    ${acts ? `<div class="actions">${acts}</div>` : ''}</div>`;
}
function linksForm(ro) {
  const cfg = W.draft || { provider: (S.links && S.links.provider) || 'payfast', links: (S.links && S.links.links) || {} };
  const prov = PAY.providers[cfg.provider] ? cfg.provider : 'payfast', L = cfg.links || {}, dis = ro ? ' disabled' : '';
  return `<div class="sect"><h4>${esc(COPY.sLinksTitle)}</h4>
    <form class="v7-pay-links" data-v7s-form="links" autocomplete="off">
      <p class="note">${esc(COPY.sLinksHelp)} ${esc(COPY.sLinksWhere(C.orList(PAY.providers[prov].links)))}</p>
      <label class="field"><span>${esc(COPY.sProvider)}</span><select name="provider"${dis}>${Object.entries(PAY.providers).map(([k, v]) => `<option value="${esc(k)}"${prov === k ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      ${V.DATA.gates.map(g => `<label class="field"><span>${esc(COPY.sLinkGate(C.gateLabel(g)))}</span><input name="l${g.n}" type="url" inputmode="url" maxlength="300" value="${esc(L[String(g.n)] || '')}"${dis}></label>`).join('')}
      <label class="field"><span>${esc(COPY.sLinkAny)}</span><input name="lany" type="url" inputmode="url" maxlength="300" value="${esc(L.any || '')}"${dis}></label>
      <div class="actions"><button class="btn primary" type="submit"${dis}>${icon('check')}${esc(COPY.sSaveLinks)}</button></div>
    </form></div>`;
}
function say(msg) { W.msg = msg; paintSteward(); setTimeout(() => { if (W.msg === msg) { W.msg = ''; paintSteward(); } }, 6000); }
function onStewardClick(e) {
  const b = e.target.closest('[data-v7s]'); if (!b) return; const v = b.dataset.v7s, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
  if (k === 'filter') { W.filter = x; paintSteward(); return; }
  if (k === 'cancel') { W.ask = null; paintSteward(); return; }
  if (k === 'confirm') { const it = stewardItems().find(t => t.k === x); W.ask = { k: x, what: 'confirm' }; W.askAmt = it && it.pledged != null ? String(it.pledged) : ''; paintSteward(); return; }
  if (k === 'refund') { W.ask = { k: x, what: 'refund' }; paintSteward(); return; }
  if (k === 'refunddo') { W.ask = null; refund(x); return; }
  if (k === 'unfold') { unfold(x); return; }
  if (k === 'foldask') { const un = C.unfolded(S.all.paid, (S.all.paid && S.all.paid.folds) || {}); W.foldKeys = un.list.filter(g => !W.unticked.has(g.k)).map(g => g.k).join('|'); W.foldAsk = true; paintSteward(); return; }
  if (k === 'dismiss') { dismiss(x); return; }
  if (k === 'foldcancel') { W.foldAsk = false; paintSteward(); return; }
  if (k === 'recount') { recount().then(ok => say(ok ? COPY.sDone : COPY.sFailed)); return; }
  if (k === 'export') { exportCsv(); return; }
}
function onStewardChange(e) {
  const t = e.target;
  if (t.name && t.name.startsWith('f:')) { const k = t.name.slice(2); if (t.checked) W.unticked.delete(k); else W.unticked.add(k); W.foldAsk = false; paintSteward(); return; }
  if (t.name === 'provider' && t.closest('[data-v7s-form="links"]')) { W.draft = draftOf(t.form); paintSteward(); }
}
function onStewardInput(e) {
  const t = e.target;
  if (t.name === 'amt' && t.closest('.v7-pay-mark')) { W.askAmt = t.value; return; }
  if (t.closest('[data-v7s-form="links"]')) W.draft = draftOf(t.form);
}
function draftOf(f) {
  const links = {}; for (const g of V.DATA.gates) links[String(g.n)] = String(f.elements['l' + g.n].value || '').trim();
  links.any = String(f.elements.lany.value || '').trim();
  return { provider: f.elements.provider.value, links };
}
function onStewardSubmit(e) {
  const f = e.target.closest('[data-v7s-form]'); if (!f) return; e.preventDefault();
  const v = f.dataset.v7sForm, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
  if (k === 'confirm') { const n = C.parseRand(f.elements.amt.value), chk = C.checkAmount(n, Object.assign({}, PAY, { min: 0.01 })); if (!chk.ok) { say(errText(chk.why)); return; } W.ask = null; confirmPaid(x, n); return; }
  if (k === 'fold') { fold(); return; }
  if (k === 'links') saveLinks(f);
}
async function confirmPaid(k, amount) {
  const [uid, ref] = C.splitKey(k), it = stewardItems().find(t => t.k === k); if (!it || !C.isRef(ref)) return;
  const ok = await writeOne('paid/' + uid, cur => C.confirmByHand(cur, { ref, gate: it.gate, amount, t: Date.now(), by: S.uid || '' }));
  if (ok) await recount();
  say(ok ? COPY.sDone : COPY.sFailed);
}
async function refund(k) {
  const [uid, ref] = C.splitKey(k); if (!C.isRef(ref)) return;
  const ok = await writeOne('paid/' + uid, cur => C.markRefunded(cur, ref, Date.now(), S.uid || ''));
  if (ok) await recount();
  say(ok ? COPY.sDone : COPY.sFailed);
}
async function fold() {                // exactly the gifts the steward saw and agreed to, never one that arrived since
  if (!C.ledgerSet(ledgerNow())) { W.foldAsk = false; say(COPY.sFoldWait); return; }   // folding into no ledger would drop the gifts from the bar
  const un = C.unfolded(S.all.paid, (S.all.paid && S.all.paid.folds) || {}), keys = un.list.filter(g => !W.unticked.has(g.k)).map(g => g.k);
  if (keys.join('|') !== W.foldKeys) { W.foldAsk = false; paintSteward(); return; }
  W.foldAsk = false; if (!keys.length) { paintSteward(); return; }
  await lease('paid/folds');
  const ok = await writeOne('paid/folds', cur => C.foldWith(cur, keys, Date.now(), S.uid || ''));
  if (ok) await recount();
  say(ok ? COPY.sDone : COPY.sFailed);
}
async function dismiss(spec) {
  const [who, via, pid, why] = String(spec).split('|'); if (!who || !via || !why) return;
  const ok = await writeOne('paid/' + who, cur => C.dropCheck(cur, via, pid, why));
  say(ok ? COPY.sDone : COPY.sFailed);
}
async function unfold(k) {
  await lease('paid/folds');
  const ok = await writeOne('paid/folds', cur => C.unfoldWith(cur, k));
  if (ok) await recount();
  say(ok ? COPY.sDone : COPY.sFailed);
}
async function recount() {             // paytotals/online, counted again from every paid document: never added to by hand
  if (!sharedOK() || !S.steward) return false;
  await lease('paytotals/online');
  const fresh = {};
  try { const s = await S.db.collection('paid').get(); s.docs.forEach(d => { fresh[d.id] = d.data(); }); } catch (e) { Object.assign(fresh, S.all.paid); }
  const next = C.onlineDoc(fresh, fresh.folds, Date.now()), cur = S.online || {};
  if (Math.abs(C.safeTotal(cur) - next.amount) < 0.005 && (+cur.n || 0) === next.n && cur.t) return true;
  return writeOne('paytotals/online', () => next);
}
async function saveLinks(f) {
  const d = draftOf(f), prov = PAY.providers[d.provider] ? d.provider : null, hosts = prov ? C.orList(PAY.providers[prov].links) : '';
  if (!prov) { say(COPY.sFailed); return; }
  const links = {};
  for (const [key, u] of Object.entries(d.links)) {
    if (!u) continue;
    if (!C.okLinkUrl(u, prov)) { say(COPY.sBadLink(key === 'any' ? COPY.sLinkAny : C.gateLabel(V.GATE_BY(+key)), hosts)); return; }
    links[key] = C.safeHttps(u);
  }
  const ok = await writeOne('payconfig/links', () => ({ provider: prov, links, t: Date.now(), by: S.uid || '' }));
  if (ok) W.draft = null;
  say(ok ? COPY.sSaved : COPY.sFailed);
}
async function exportCsv() {
  const names = {}; for (const it of stewardItems()) { const n = nameOf(it.uid); if (n) names[it.uid] = n; }
  const csv = C.toCSV(C.CSV_HEAD, C.giftRows(S.all.pledges, S.all.paid, (S.all.paid && S.all.paid.folds) || {}, names));
  const r = await saveFile(`mahala-gifts-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  if (r !== 'declined') say(r === 'saved' ? COPY.sExported : r === 'off' ? COPY.sExportOff : COPY.sFailed);
}

/* ====================== the plugin's own styles, on the game's variables ====================== */
function addCss() {
  if ($('#v7-pay-css')) return;
  const s = document.createElement('style'); s.id = 'v7-pay-css';
  s.textContent = `
/* sizes from the shared type scale (v5.css: --fs-xs to --fs-h1, --lh-body, --lh-display); the fallbacks are the same values */
.v7-pay-give, .v7-pay-end { display: grid; gap: 16px; }
.v7-pay-end > p { margin: 0; }
.v7-pay-gatehead { display: grid; justify-items: center; text-align: center; gap: 6px; padding-top: 4px; }
.v7-pay-gatemark { width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 6px; color: var(--ink);
  background: color-mix(in srgb, var(--tone, var(--yellow)) 18%, var(--card-strong)); border: 2px solid color-mix(in srgb, var(--tone, var(--yellow)) 55%, transparent); }
.v7-pay-gatemark .i, .v7-pay-gatemark svg { width: 48px; height: 48px; }
.v7-pay-gatehead .eyebrow { font-size: var(--fs-xs, 11.5px); }
.v7-pay-gatehead h4 { margin: 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3, 22px); line-height: var(--lh-display, 1.15); color: var(--ink); }
.v7-pay-builds { color: var(--ink-2); }
.v7-pay-again { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
.v7-pay-again:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px; }
.v7-pay-head { display: grid; gap: 4px; }
.v7-pay-head b { font-family: var(--display); font-weight: 400; font-size: var(--fs-h3, 22px); line-height: var(--lh-display, 1.15); color: var(--ink); }
.v7-pay-head small { font-size: var(--fs-s, 12.5px); color: var(--ink-2); line-height: var(--lh-body, 1.45); }
.v7-pay-fig { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
.v7-pay-fig .mono { font-size: var(--fs-xl, 18px); color: var(--ink); }
.v7-pay-amt { display: flex; align-items: center; border: 1px solid var(--card-line); border-radius: 10px; background: var(--ground); max-width: 260px; }
.v7-pay-amt span { padding: 0 4px 0 12px; font-family: var(--mono); color: var(--ink-2); }
.v7-pay-amt input { border: 0 !important; background: none !important; flex: 1; min-width: 0; font-family: var(--mono); font-size: var(--fs-xl, 18px); height: 46px !important; padding-left: 2px !important; color: var(--ink); }
.v7-pay-amt:focus-within { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-pay-amt input:focus, .v7-pay-amt input:focus-visible { outline: none !important; box-shadow: none !important; }
.v7-pay-err { margin: 0; color: var(--magenta-ink, #b0135f) !important; font-size: var(--fs-m, 13.5px); }
.v7-pay-err:empty { display: none; }
.v7-pay-next { display: grid; gap: 6px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--card); }
.v7-pay-next ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: var(--fs-m, 13.5px); line-height: var(--lh-body, 1.45); color: var(--ink); }
.v7-pay-pledge, .v7-pay-recap { display: grid; gap: 4px; }
.v7-pay-pledge { grid-template-columns: auto 1fr auto; align-items: baseline; gap: 10px; }
.v7-pay-pledge b { font-family: var(--mono); font-size: var(--fs-l, 15px); color: var(--ink); }
.v7-pay-pledge .mono { color: var(--ink-2); letter-spacing: 0.04em; }
.v7-pay-recap { margin-top: 14px; }
.v7-pay-recap b { font-weight: 500; color: var(--ink); }
.v7-pay-recap .note { margin: 0; }
.v7-pay-dash .mv-summary, .v7-pay-end .mv-summary { margin: 0; }
.v7-pay-emptyline { margin: 0; }
.v7-pay-more { border-top: 1px solid var(--card-line); padding-top: 10px; }
.v7-pay-more summary { cursor: pointer; font-size: var(--fs-m, 13.5px); font-weight: 500; color: var(--ink-2); }
.v7-pay-more ol, .v7-pay-more ul { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 6px; font-size: var(--fs-m, 13.5px); color: var(--ink-2); line-height: var(--lh-body, 1.45); }
.v7-pay-dash, .v7-pay-st { display: grid; gap: 12px; }
.v7-pay-list { display: grid; gap: 8px; }
.v7-pay-row { display: grid; gap: 6px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--card); }
.v7-pay-row1 { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.v7-pay-row1 b { font-weight: 500; min-width: 0; overflow-wrap: anywhere; }
.v7-pay-row1 .mono { white-space: nowrap; }
.v7-pay-row2 { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: var(--fs-s, 12.5px); color: var(--ink-3); }
.v7-pay-row2 .mono { white-space: nowrap; }
.v7-pay-row .note { margin: 0; }
.v7-pay-row .btn { height: 34px; }
.v7-pay-receipt { display: grid; gap: 8px; padding: 10px 12px; border-radius: 10px; background: var(--done-bg, var(--card-strong)); }
.v7-pay-receipt b { font-weight: 500; color: var(--ink); }
.v7-pay-receipt dl.kv { margin: 0; }
.v7-pay-receipt dd { margin: 0; overflow-wrap: anywhere; }
.v7-pay-status { display: flex; gap: 8px; align-items: flex-start; margin: 0; font-size: var(--fs-m, 13.5px); color: var(--ink); }
.v7-pay-status .i { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.v7-pay-warn { margin: 0; font-size: var(--fs-m, 13.5px); color: var(--ink); padding: 8px 10px; border-radius: 10px; background: var(--wait-bg); }
.v7-pay-folds { list-style: none; margin: 8px 0; padding: 0; display: grid; gap: 6px; }
.v7-pay-folds small { overflow-wrap: anywhere; }
.v7-pay-links, .v7-pay-mark { display: grid; gap: 10px; margin-top: 10px; }
.v7-pay-links { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; }
.v7-pay-links > .note, .v7-pay-links > .actions, .v7-pay-links > .field:first-of-type, .v7-pay-links > .field:last-of-type { grid-column: 1 / -1; }
.v7-pay-links .field span, .v7-pay-mark .field span { font-size: var(--fs-m, 13.5px); color: var(--ink-2); font-weight: 500; }
.v7-pay-st dl.kv dd { margin: 0; }
.v7-pay-st dl.kv dt { color: var(--ink-2); }
.v7-pay-cur { display: block; margin-top: 4px; font-size: var(--fs-s, 12.5px); color: var(--ink-2); line-height: var(--lh-body, 1.45); }
#v7payModal .badge h4 { font-family: var(--mono); font-size: var(--fs-h3, 22px); }
#joinFoot .v7-pay-share { margin-right: auto; }
@media (max-width: 600px) {
  .v7-pay-amt { max-width: none; }
  .v7-pay-links { grid-template-columns: minmax(0, 1fr); }
  .v7-pay-pledge { grid-template-columns: 1fr auto; }
  .v7-pay-pledge .eyebrow { grid-column: 1 / -1; }
  #joinFoot .btn { padding: 0 12px; }
  #joinFoot .v7-pay-share { flex-basis: 100%; justify-content: center; margin: 0 0 4px; }
}`;
  document.head.appendChild(s);
}
