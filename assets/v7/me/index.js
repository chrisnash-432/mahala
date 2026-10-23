/* v7 me: your own corner of the Mahalaverse. "Your path" becomes a personal dashboard: who you are (your name, your
   figure, the card you kept, your crew), the gifts you received for what you gave, your private book, your applications,
   your kitchen nights and sets, your quests, what the other plugins add, and your data (download it, or delete it).

   Gifts mark contributions, building and giving. Quests are not scored, nothing tracks completion, nothing is counted,
   ranked or levelled, and your book stays private unless you share it.

   Data (rules/me.json; base.json covers the private parts):
     avatars/<uid>             { c, head, shoulders, held, emblem, t }      your figure (everyone reads, you write)
     giftsBy/<uid>             { g: [{ i, gift?, title?, why, t, by }] }    gifts a steward gave by hand (only stewards write)
     data/users/<uid>/gifts    { got: { <gift id>: { t, s?, k? } }, at }    the gifts you received, and which you have seen
   In this browser: mahala.avatar, mahala.gifts (so solo and signed-out visits keep theirs too).

   For other plugins (see README.md):
     ctx.dashboard.push({ id, title, order, render(el, me), export?(me), erase?(me) })
     ctx.gifts.push({ id, title, kind, icon, why, test(state), unlocks?: ['held:drum'], piece?: 'held:lantern' })
     ctx.giftState.push(async me => partialState)
     M.outfits = { all, mine, me, subs }   the figures' outfits, for assets/together.js */
import { PALETTE, SLOTS, PIECE_NAME, FREE, CARDS, DEFAULT_COLOUR, blankAvatar, cleanAvatar, sameAvatar, isBlank, notGiven, describe, portraitSpec, medallionSpec, pieceSpec, wornWith, toSvg, andList } from './avatar.js';
import { KIND_LABEL, CARD_WHY, emptyState, mergeState, cleanShifts, hearthByMe, isMyLine, offeredLines, appliedFrom, builtInGifts, PIECE_HOW, PIECE_WITH, titleOf, whyOf, allRules, evaluate, cleanHand, unlocked, giftForPiece, piecesOf, toneOf } from './gifts.js';
import { selfCollections, docPaths, bookCollection, localKeys, freshMe, exportFile } from './data.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, j) => setTimeout(() => j(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  keys() { try { return Object.keys(localStorage); } catch (e) { return []; } } };
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const day = t => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
const LS = { avatar: 'mahala.avatar', gifts: 'mahala.gifts' };
const ICONS = new Set('search down right sun moon play pause bell plus minus home x cal timber glass dome petal tent tools gate flag users star gift check seed light film pin pen torus forms boat book spot up left flame shuffle sound mute lock unlock share save path menu eye'.split(' '));
const GOT_ID = /^(hand:)?[A-Za-z0-9_.:~+-]{1,64}$/;
const PHONE = () => matchMedia('(max-width: 760px)').matches;
const cssq = x => (window.CSS && CSS.escape ? CSS.escape(x) : String(x).replace(/[^A-Za-z0-9_-]/g, c => '\\' + c));
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const WALK = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);
const CAMP_MAIL = 'wearemahala@gmail.com';     // the camp's own address (the camp page and the sign-in sheet use it), shown as text, never a mailto link
const TO_STEWARDS = 'write to the stewards at ' + CAMP_MAIL;
const FRAMING = 'Not your horoscope: a way we have of seeing each other, and we feel this force is very strong in you.';

export async function start(M, ctx) {
  const T = M.v7; if (!T || !M.HOOK7) return null;          // without the host layer there is nothing to take over
  const { esc, icon } = M;
  if (!Array.isArray(ctx.giftState)) ctx.giftState = [];
  if (!Array.isArray(ctx.gifts)) ctx.gifts = [];
  if (!Array.isArray(ctx.dashboard)) ctx.dashboard = [];
  if (!Array.isArray(ctx.steward)) ctx.steward = [];
  const P = ctx.platform || fallbackPlatform();
  const cardTitle = k => (T.ARCH_BY[k] || {}).title || '';
  const BUILT = builtInGifts({ crews: T.DATA.crews || [], cardTitle: k => cardTitle(k) || 'Your archetype card' });
  const rules = () => allRules(BUILT, ctx.gifts || []);

  /* ---------- what the dashboard knows ---------- */
  const local = k => { const v = parse(store.get(k)); return v && typeof v === 'object' && 'v' in v ? { owner: typeof v.owner === 'string' ? v.owner : null, v: v.v } : { owner: null, v }; };   // { owner, v }; the first shape had no owner
  const LA = local(LS.avatar), LG = local(LS.gifts);
  const S = {
    me: blankMe(), db: null, user: null, colour: null, readOnly: false,
    avatar: cleanAvatar(LA.v), avOwner: LA.owner, avatars: {}, avatarsLoaded: false,
    got: cleanGot(LG.v), gotOwner: LG.owner, gotLoaded: false, gotErr: false, gotFromDb: false,
    handDoc: null, hand: [], handLoaded: false, handErr: false,
    signup: null, signupLoaded: false,
    state: emptyState(), bus: { seeds: 0, ideas: 0, ideasBuilt: 0, paid: 0, contrib: {} },
    open: false, lastFocus: null, stage: null, newAtOpen: new Set(), pending: [], quiet: false,
    del: 'idle', delNote: '', dl: '', steward: { who: '', gift: '' },
    figOpen: null, gift: null, sawCard: !!T.DKX.kept, lastCard: T.DKX.kept || null, restored: null, figMsg: '', wantGift: null, bRef: 0,
  };

  /* ---------- the look: the game's own tokens, so day, night and the phone keep working ---------- */
  if (!document.getElementById('v7-me-css')) { const st = document.createElement('style'); st.id = 'v7-me-css'; st.textContent = STYLE; document.head.appendChild(st); }

  /* ---------- the panel ---------- */
  const host = document.querySelector('#app .hud') || document.body;
  const panel = document.createElement('section');
  panel.className = 'v7-me-panel'; panel.id = 'v7-me'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'v7-me-title');
  const JUMP = [['figure', 'Figure'], ['gifts', 'Gifts'], ['book', 'Book'], ['apps', 'Applications'], ['camp', 'Kitchen'], ['quests', 'Quests'], ['data', 'Your data']];
  panel.innerHTML = `<div class="v7-me-topbar"><div class="v7-me-bar"><h2 class="v7-me-ttl" id="v7-me-title" tabindex="-1">Your path</h2>
      <button class="iconbtn v7-me-x" type="button" data-me="close" aria-label="Close Your path">${icon('x')}</button></div>
    <nav class="v7-me-jump" aria-label="Parts of Your path">${JUMP.map(([k, t]) => `<button type="button" data-me="jump:${k}">${t}</button>`).join('')}</nav></div>
    <div class="v7-me-body" id="v7-me-body">
      ${['who', 'figure', 'gifts', 'book', 'apps', 'camp', 'quests'].map(k => `<section class="v7-me-sect" id="v7-me-s-${k}" aria-labelledby="v7-me-h-${k}"></section>`).join('')}
      <div id="v7-me-plugins"></div>
      ${['bell', 'steward', 'data'].map(k => `<section class="v7-me-sect" id="v7-me-s-${k}" aria-labelledby="v7-me-h-${k}"></section>`).join('')}
    </div>`;
  host.appendChild(panel);
  const $s = k => document.getElementById('v7-me-s-' + k);

  /* ---------- the platform: who is viewing, and the store ---------- */
  function blankMe() { return { id: null, name: '', signedIn: false, canWrite: false, isSteward: false, isOwner: false, guest: false }; }
  const mode = () => (P.mode === 'standalone' ? 'standalone' : S.db ? 'claude' : 'solo');
  // where nothing can be saved: on a claude.ai link, a way to take part; on Mahala's own site, what happened; in a saved copy, that it runs alone
  const LOOK_ONLY = 'You can look around from this link, but not take part yet: what you do here stays in this browser. To take part, write to the camp at ' + CAMP_MAIL + '.';
  const notSaved = () => (P.mode === 'claude' ? LOOK_ONLY : P.mode === 'standalone' ? 'This did not save to the shared Mahalaverse, so your choices stay in this browser for now.' : 'This copy runs on its own, so everything here is kept in this browser only.');
  const fromHere = () => (P.mode === 'claude' ? 'From this link' : 'From here');
  const canSave = () => !!(S.db && S.me.id && S.me.canWrite && !S.readOnly);
  async function refreshMe() {
    const was = S.me.id;
    let me = null; try { me = await withTimeout(P.me(), 9000); } catch (e) { }
    S.me = Object.assign(blankMe(), me || {});
    try { S.db = await withTimeout(P.use('db'), 9000); } catch (e) { S.db = null; }
    try { S.user = await withTimeout(P.use('user'), 9000); } catch (e) { S.user = null; }
    if (!S.me.id) S.me.canWrite = false;
    // what this browser holds belongs to whoever kept it: someone else's stays out of sight (and stays theirs)
    if (S.gotOwner && S.gotOwner !== S.me.id) { S.got = {}; S.gotOwner = S.me.id; }
    if (S.avOwner && S.avOwner !== S.me.id) { S.avatar = blankAvatar(); S.avOwner = S.me.id; }
    S.colour = null;
    if (S.user && S.me.id) { try { const v = await withTimeout(S.user.me(), 6000); S.colour = hexOf(v && v.color); } catch (e) { } }
    if (was !== S.me.id || !S.subbed || S.subDb !== S.db) subscribe();
    publishOutfits(); refreshWho(); if (S.open) renderAll(); schedule('me');
    restoreFromAccount();
  }

  /* ---------- live documents: everyone's figures, and your own applications, hand-given gifts and received gifts ---------- */
  const subs = [];
  function sub(ref, fn, onErr) { try { subs.push(ref.onSnapshot(fn, e => { console.warn('v7 me db', e && e.code); onErr && onErr(e); })); } catch (e) { console.warn(e); onErr && onErr(e); } }
  function subscribe() {
    subs.splice(0).forEach(u => { try { u(); } catch (e) { } });
    S.subbed = true; S.subDb = S.db; evWaited = 0; S.signup = null; S.apps = {}; S.handDoc = null; S.signupLoaded = S.handLoaded = S.gotLoaded = false; S.handErr = S.gotErr = false; S.gotFromDb = false;
    const db = S.db, id = S.me.id;
    if (!db) { S.signupLoaded = S.handLoaded = S.gotLoaded = true; return; }
    sub(db.collection('avatars'), snap => {
      const all = {}; for (const d of snap.docs) { const v = d.data(); if (v && typeof v === 'object') all[d.id] = cleanAvatar(v); }
      S.avatars = all; S.avatarsLoaded = true; adoptMyAvatar(); publishOutfits();
    });
    if (!id) { S.signupLoaded = S.handLoaded = S.gotLoaded = true; return; }
    sub(db.doc('signups/' + id), s => { S.signup = s.exists ? s.data() : null; S.signupLoaded = true; S.signupSlow = false; schedule('signup'); if (S.open) render('apps'); }, () => { S.signupLoaded = true; S.signupSlow = true; if (S.open) render('apps'); });
    clearTimeout(S.slowT); S.slowT = setTimeout(() => { if (!S.signupLoaded) { S.signupLoaded = true; S.signupSlow = true; if (S.open) render('apps'); } }, 12000);   // a slow line: say so, rather than look forever
    sub(db.doc('giftsBy/' + id), s => { S.handDoc = s.exists ? s.data() : null; S.handLoaded = true; schedule('hand'); }, () => { S.handLoaded = true; S.handErr = true; });
    sub(db.doc('answer/' + id), s => { const a = s.exists ? s.data() : null; S.apps = a && a.apps && typeof a.apps === 'object' && !Array.isArray(a.apps) ? a.apps : {}; if (S.open) render('apps'); });   // the camp's answer to your applications: only you and the stewards read it
    sub(db.doc(`data/users/${id}/gifts`), s => { S.gotFromDb = true; mergeGot(s.exists ? s.data() : null); S.gotLoaded = true; schedule('got'); restoreCard(); }, () => { S.gotLoaded = true; S.gotErr = true; });
  }

  /* ---------- on a new device: your name and card, from what your account kept ----------
     The game keeps your name and the card you kept in this browser; on another device it starts without them. Signed in,
     the dashboard brings back your name (from your private record) and your card (from your gifts), once, and only into
     an empty place: a name typed here, or a card kept or put back here, always wins. */
  async function restoreFromAccount() {
    const id = S.me.id; if (!id || !S.db || S.restored === id || S.deleting) return; S.restored = id;
    if (String(T.ME.name || '').trim()) return;
    try {
      const s = await withTimeout(S.db.doc(`data/users/${id}/me`).get(), 9000), d = s && s.exists ? s.data() : null;
      if (!d || typeof d.name !== 'string' || !d.name.trim() || String(T.ME.name || '').trim() || S.deleting || S.me.id !== id) return;
      T.ME.name = d.name.replace(/\s+/g, ' ').trim().slice(0, 40); if (d.show === true) T.ME.show = true;
      T.saveMe(); try { T.pushMe(); } catch (e) { }
      refreshWho(); if (S.open) { renderHeadName(); render('who'); }
    } catch (e) { }
  }
  function restoreCard() {
    if (S.cardBack || S.sawCard || T.DKX.kept || !S.gotFromDb || S.deleting || !S.me.id) return;
    const k = S.got['me-card'] && S.got['me-card'].k; if (!k || !T.ARCH_BY[k]) return;
    S.cardBack = true; S.sawCard = true; S.lastCard = k;
    try { T.keepCard(k); T.pushMe(); } catch (e) { console.warn(e); }
    refreshWho(); if (S.open) { render('who'); render('figure'); }
  }

  /* ---------- writing: one write at a time per document, the latest wins ---------- */
  const WQ = {};
  function put(path, data) {
    if (!canSave()) return Promise.resolve(false);
    const q = WQ[path] || (WQ[path] = { busy: false, next: null, p: Promise.resolve(true) });
    q.next = data; if (q.busy) return q.p;
    q.busy = true;
    q.p = (async () => {
      let ok = true;
      try {
        while (q.next) {
          const d = q.next; q.next = null;
          for (let tries = 0; tries < 2; tries++) {
            try { await withTimeout(S.db.doc(path).set(d), 30000); ok = true; break; }
            catch (e) { ok = false; if (e && e.code === 'unavailable' && tries === 0) { await wait(600 + Math.random() * 600); continue; } if (!(e && e.code === 'timeout')) writeFailed(e); break; }
          }
        }
      } finally { q.busy = false; }
      return ok;
    })();
    return q.p;
  }
  function writeFailed(e) {
    const c = e && e.code;
    if (c === 'invalid_argument' || c === 'not_granted' || c === 'revoked' || c === 'capability_disabled' || c === 'capability_removed') {
      if (!S.readOnly) { S.readOnly = true; T.toast(P.mode === 'claude' ? 'From this link your choices stay in this browser. To take part, write to the camp at ' + CAMP_MAIL + '.' : notSaved()); refreshWho(); if (S.open) renderAll(); }
    } else if (c === 'quota_exceeded') T.toast('The shared Mahalaverse is full for now, so this stays in this browser. Please ' + TO_STEWARDS + '.');
    else if (c === 'resource_exhausted') T.toast('That was a lot at once. Wait a moment and try again.');
    else T.toast('That did not save. Try again in a moment.');
  }

  /* ---------- your figure ---------- */
  const O = M.outfits || (M.outfits = { all: {}, mine: null, me: null, subs: new Set() });
  if (!(O.subs instanceof Set)) O.subs = new Set();
  // what the world draws: each figure as stored, its emblem only for the card its wearer keeps (yours: the card you kept
  // here; another builder's: the card the world shows as theirs, builders/<uid>.card)
  function publicCards() {
    const m = new Map();
    for (const b of T.LIVE.builders || []) if (b && typeof b.id === 'string' && typeof b.card === 'string' && Object.prototype.hasOwnProperty.call(CARDS, b.card)) m.set(b.id, b.card);
    return m;
  }
  const worn = () => wornWith(S.avatar, myCard());
  function publishOutfits() {
    const cards = publicCards(), all = {}, mine = worn();
    for (const [id, a] of Object.entries(S.avatars)) all[id] = wornWith(a, cards.get(id) || null);
    if (S.me.id) all[S.me.id] = mine;
    O.all = all; O.mine = mine; O.me = S.me.id || null;
    for (const f of [...O.subs]) { try { f(O); } catch (e) { console.warn(e); } }
  }
  function adoptMyAvatar() {   // the stored figure and the one in this browser: the newer wins, and a figure made before signing in is kept
    const id = S.me.id; if (!id || S.deleting) return;
    const db = S.avatars[id];
    if (db && (db.t || 0) >= (S.avatar.t || 0)) { if (!sameAvatar(db, S.avatar)) { S.avatar = db; keepAvatar(db); refreshWho(); if (S.open) { render('who'); render('figure'); } } }
    else if (canSave() && (db ? !sameAvatar(db, S.avatar) : !isBlank(S.avatar))) pushAvatar();
  }
  function keepAvatar(a) { S.avOwner = S.me.id || null; store.set(LS.avatar, JSON.stringify({ owner: S.avOwner, v: a })); }
  function keepGot(g) { S.gotOwner = S.me.id || null; store.set(LS.gifts, JSON.stringify({ owner: S.gotOwner, v: g })); }
  const ownColour = () => S.colour || null;
  const drawColour = () => S.avatar.c || ownColour() || DEFAULT_COLOUR;
  const myCard = () => (T.DKX.kept && T.ARCH_BY[T.DKX.kept] && CARDS[T.DKX.kept] ? T.DKX.kept : null);
  function setAvatar(patch, why = '') {
    const a = cleanAvatar(Object.assign({}, S.avatar, patch, { t: Date.now() }));
    const U = unlockedSet(); for (const sl of SLOTS) if (!FREE.has(sl.id + ':' + a[sl.id]) && !U.has(sl.id + ':' + a[sl.id])) a[sl.id] = S.avatar[sl.id];   // a gift piece is worn only once given
    if (a.emblem !== 'none' && a.emblem !== myCard()) a.emblem = S.avatar.emblem === myCard() ? S.avatar.emblem : 'none';   // the emblem is the card you kept
    if (sameAvatar(a, S.avatar)) return false;
    S.avatar = a; keepAvatar(a);
    publishOutfits(); refreshWho(); updateFigureArt();
    figStatus(canSave() ? 'Saving...' : 'Kept in this browser.');
    clearTimeout(S.avT); S.avT = setTimeout(pushAvatar, 0);      // saved on each choice (one write at a time, the latest wins), "Saving..." until it lands
    ctx.bus.emit('avatar:changed', { id: S.me.id || null, avatar: Object.assign({}, a) });
    return true;
  }
  function pushAvatar() {
    if (S.deleting) return;
    if (!canSave()) { figStatus(S.me.id && !S.me.canWrite || S.readOnly ? 'Kept in this browser. Builders see your figure once you can save to the shared Mahalaverse.' : 'Kept in this browser.'); return; }
    const body = { c: S.avatar.c, head: S.avatar.head, shoulders: S.avatar.shoulders, held: S.avatar.held, emblem: S.avatar.emblem, t: S.avatar.t || Date.now() };
    put('avatars/' + S.me.id, body).then(ok => { figStatus(ok ? 'Saved. Builders see your figure like this.' : 'Kept in this browser.'); });
  }
  function figStatus(t) { S.figMsg = t; const el = document.getElementById('v7-me-figsave'); if (el) el.textContent = t; }
  // the emblem follows the card: a new card kept, a new emblem; a card put back in this page, no emblem
  function followCard() {
    const k = myCard(), was = S.lastCard; S.lastCard = k; if (k) S.sawCard = true;
    if (k === was) return;
    if (S.avatar.emblem !== 'none' && k && S.avatar.emblem !== k) setAvatar({ emblem: k });
    else if (S.avatar.emblem !== 'none' && !k && was) setAvatar({ emblem: 'none' });
    else { publishOutfits(); refreshWho(); updateFigureArt(); }   // what is worn follows the card, even when nothing stored changes
  }

  /* ---------- gifts ---------- */
  function cleanGot(g) {
    const out = {}; if (!g || typeof g !== 'object') return out;
    for (const [k, v] of Object.entries(g).slice(0, 200)) { if (!GOT_ID.test(k) || !v || typeof v !== 'object') continue; const e = { t: typeof v.t === 'number' && isFinite(v.t) ? v.t : 0 }; if (v.s) e.s = 1; if (typeof v.k === 'string' && T.ARCH_BY[v.k]) e.k = v.k; out[k] = e; }
    return out;
  }
  function mergeGot(doc) {   // received on any device is received; seen on any device is seen
    if (S.deleting) return;
    const g = cleanGot(doc && doc.got); let extra = false;
    for (const [k, v] of Object.entries(S.got)) { if (!g[k]) { g[k] = v; extra = true; } else { if (v.s && !g[k].s) { g[k].s = 1; extra = true; } if (v.k && v.t >= g[k].t) g[k].k = v.k; } }
    S.got = g; keepGot(g);
    if (extra) saveGot();
    refreshWho(); if (S.open) render('gifts');
  }
  function saveGot() {
    if (S.deleting) return;
    keepGot(S.got);
    if (canSave()) put(`data/users/${S.me.id}/gifts`, { got: S.got, at: Date.now() });
  }
  const unseen = () => Object.values(S.got).some(v => !v.s);
  const handGift = i => S.hand.find(h => h.i === i);
  function unlockedSet() { return unlocked(rules(), S.got, S.hand, FREE); }
  function giftView(id) {   // what a received gift shows: its title, kind, why, emblem and the pieces it brought
    const R = rules();
    if (id.startsWith('hand:')) {
      const h = handGift(id.slice(5)); if (!h) return null;
      const r = h.gift && R.find(x => x.id === h.gift);
      return { id, rule: r ? r.id : null, kind: r ? r.kind : 'badge', icon: r ? r.icon : 'gift', tone: r && r.tone, piece: r && r.piece, pieces: piecesOf(r), title: r ? titleOf(r, S.state) : h.title, why: h.why || (r ? whyOf(r, S.state) : ''), hand: true };
    }
    const r = R.find(x => x.id === id); if (!r) return null;
    const g = S.got[id] || {}, st = id === 'me-card' ? Object.assign({}, S.state, { card: g.k || S.state.card }) : S.state;
    return { id, rule: r.id, kind: r.kind, icon: r.icon, tone: r.tone, piece: r.piece, pieces: piecesOf(r), card: id === 'me-card' ? (g.k || S.state.card) : null, title: titleOf(r, st), why: whyOf(r, st) };
  }

  // the gift state (CONTRACT.md section 6), from the game's state and the other plugins
  const mineEvt = d => !!(d && typeof d === 'object' && (d.mine === true || (S.me.id && [d.uid, d.owner, d.by_uid].includes(S.me.id))));
  function myShiftKeys() {
    try { if (typeof T.myShifts === 'function') return T.myShifts(); } catch (e) { }
    const V5 = T.V5 || {}, L = T.LIVE; return (L.uid && L.write !== false ? ((V5.shifts || []).find(d => d.id === L.uid) || {}).s : V5.myShifts) || [];
  }
  function mySounds() {
    try { if (typeof T.soundsAll === 'function') return T.soundsAll().filter(x => x && x.mine); } catch (e) { }
    const V5 = T.V5 || {}, L = T.LIVE; return (L.uid && L.write !== false ? ((V5.sounds || []).find(d => d.id === L.uid) || {}).p : V5.mySounds) || [];
  }
  const provCache = { at: 0, part: null };
  async function buildState(fresh) {
    const ME = T.ME, id = S.me.id, s = emptyState();
    s.me = Object.assign({}, S.me); s.card = T.DKX.kept || null; s.crew = ME.crew || null;
    s.crewOk = !!ME.crewOk;                                                     // as the contract has it: the game's own flag
    s.crewConfirmed = !!(ME.crew && id && T.LIVE.confirm && T.LIVE.confirm[id] && T.LIVE.confirm[id].crew === ME.crew);   // a steward's welcome
    s.shifts = cleanShifts(myShiftKeys()); s.sounds = (mySounds() || []).length;
    s.hearth = hearthByMe(T.LIVE.hearth, id || T.LIVE.uid, ME.book);
    s.visits = +ME.visits || 0; s.quests = Object.assign({}, ME.quests); s.applied = appliedFrom(S.signup, ME);
    if (fresh || !provCache.part || Date.now() - provCache.at > 20000) {
      const part = {};
      for (const f of ctx.giftState) { if (typeof f !== 'function') continue; try { mergeState(part, await withTimeout(Promise.resolve().then(() => f(Object.assign({}, S.me))), 4000)); } catch (e) { } }
      provCache.part = part; provCache.at = Date.now();
    }
    mergeState(s, JSON.parse(JSON.stringify(provCache.part || {})));
    mergeState(s, JSON.parse(JSON.stringify(S.bus)));
    return s;
  }
  let evT = 0, evBusy = false, evAgain = false, evFresh = false, evWaited = 0;
  function schedule(why, fresh = false) { if (fresh) evFresh = true; clearTimeout(evT); evT = setTimeout(runEval, why === 'boot' ? 1500 : 500); }
  async function runEval() {
    if (S.deleting) return;
    if (evBusy) { evAgain = true; return; }
    // with an account, wait for the gifts it already holds, so nothing is announced twice
    if (S.db && S.me.id && (!S.gotLoaded || !S.handLoaded) && evWaited < 12) { evWaited++; schedule('wait'); return; }
    evBusy = true;
    try {
      const fresh = evFresh; evFresh = false;
      S.state = await buildState(fresh);
      const R = rules();
      const out = evaluate(R, S.state, S.got);
      S.hand = cleanHand(S.handDoc, R);
      for (const h of S.hand) { const k = 'hand:' + h.i; if (!out.got[k]) { out.got[k] = { t: h.t || Date.now() }; out.fresh.push(k); } }
      if (S.handLoaded && !S.handErr) for (const k of Object.keys(out.got)) if (k.startsWith('hand:') && !handGift(k.slice(5))) delete out.got[k];   // a steward took it back
      if (S.quiet) { for (const k of out.fresh) out.got[k].s = 1; out.fresh.length = 0; S.quiet = false; }
      if (S.open) for (const k of out.fresh) { out.got[k].s = 1; S.newAtOpen.add(k); }
      const changed = JSON.stringify(out.got) !== JSON.stringify(S.got);
      S.got = out.got;
      if (changed && !S.noSave) saveGot();
      S.noSave = false;
      if (out.fresh.length) announce(out.fresh);
      wearOnlyGiven();
      refreshWho();
      if (S.open && (changed || out.fresh.length)) { if (out.fresh.length && !S.gift) S.gift = out.fresh[out.fresh.length - 1]; render('gifts'); render('figure'); }
    } catch (e) { console.warn('v7 me gifts', e); }
    finally { evBusy = false; if (evAgain) { evAgain = false; schedule('again'); } }
  }
  function wearOnlyGiven() {   // a piece whose gift is gone comes off; only once what you hold has loaded, so nothing comes off by mistake
    if (!(S.gotLoaded && S.handLoaded) || S.gotErr || S.handErr) return;
    const off = notGiven(S.avatar, unlockedSet()); if (!off.length) return;
    const a = Object.assign({}, S.avatar, Object.fromEntries(off.map(k => [k, 'none'])), { t: Date.now() });
    S.avatar = cleanAvatar(a); keepAvatar(S.avatar); publishOutfits(); pushAvatar();
  }
  function announce(ids) { S.pending.push(...ids); clearTimeout(S.annT); S.annT = setTimeout(flushAnnounce, 1200); }   // gifts a moment apart share one toast
  function flushAnnounce() {
    if (!S.pending.length) return;
    const st = M.state ? M.state() : {};
    if ((M.entered && !M.entered()) || document.body.classList.contains('arrival') || st.story || st.fire) { clearTimeout(S.annT); S.annT = setTimeout(flushAnnounce, 2500); return; }
    const ids = [...new Set(S.pending.splice(0))], views = ids.map(giftView).filter(Boolean);
    if (!views.length) return;
    giftToast(views);
    try { T.chime('soft'); } catch (e) { }    // the game's chime plays only when sound is on
    for (const v of views) ctx.bus.emit('gift:earned', { id: v.id, title: v.title, kind: v.kind });
    refreshWho();
  }
  /* the gift's own toast: its medallion, one line, and "See it", which opens Your path at the gift. It is the game's toast
     in look and place (the game's own keeps its words for everything else, and this one rises above it while both show),
     stays a little longer, and waits while a pointer or the keyboard is on it */
  let GT = null;
  function giftToastEl() {
    if (GT && document.contains(GT)) return GT;
    GT = document.createElement('div'); GT.className = 'toast card hide v7-me-gtoast'; GT.id = 'v7-me-gtoast'; GT.setAttribute('role', 'status');
    (document.querySelector('#app .hud') || document.body).appendChild(GT);
    GT.addEventListener('click', e => {
      const b = e.target.closest('[data-me-see]'); if (!b) return; const id = b.dataset.meSee;
      if (GT.contains(document.activeElement)) document.activeElement.blur();   // so closing Your path gives focus to the who chip, not a faded toast
      hideGiftToast(); openAt(id);
    });
    const hold = () => clearTimeout(S.gtT), later = () => { if (!GT.classList.contains('hide') && !GT.matches(':hover') && !GT.contains(document.activeElement)) { clearTimeout(S.gtT); S.gtT = setTimeout(hideGiftToast, 2500); } };
    GT.addEventListener('pointerenter', hold); GT.addEventListener('focusin', hold);
    GT.addEventListener('pointerleave', later); GT.addEventListener('focusout', () => setTimeout(later, 0));
    const game = document.getElementById('toast');
    if (game) new MutationObserver(() => {   // up at once when the game speaks (by its own height); back down once its words have faded
      clearTimeout(S.liftT);
      if (!game.classList.contains('hide')) { GT.style.setProperty('--v7-me-up', -(Math.round(game.getBoundingClientRect().height) + 8) + 'px'); GT.classList.add('v7-me-lift'); }
      else S.liftT = setTimeout(() => { if (game.classList.contains('hide')) GT.classList.remove('v7-me-lift'); }, 340);
    }).observe(game, { attributes: true, attributeFilter: ['class'] });
    return GT;
  }
  function giftToast(views) {
    const el = giftToastEl(), n = views.length, first = views[0], game = document.getElementById('toast');
    const line = n === 1 ? `A gift for you: ${first.title}.` : n === 2 ? `Gifts for you: ${first.title} and ${views[1].title}.` : 'New gifts for you.';
    el.innerHTML = `<span class="v7-me-gtm" aria-hidden="true">${views.slice(0, 3).map(v => medal(v, 'mini')).join('')}</span><span class="v7-me-gtt">${esc(line)}</span>`
      + `<button class="btn v7-me-gtb" type="button" data-me-see="${n === 1 ? esc(first.id) : ''}">${n === 1 ? 'See it' : 'See them'}<span class="v7-me-sr"> in Your path</span></button>`;
    fillArt(el);
    clearTimeout(S.liftT);
    if (game && !game.classList.contains('hide')) { el.style.setProperty('--v7-me-up', -(Math.round(game.getBoundingClientRect().height) + 8) + 'px'); el.classList.add('v7-me-lift'); } else el.classList.remove('v7-me-lift');
    el.classList.remove('hide');
    clearTimeout(S.gtT); S.gtT = setTimeout(hideGiftToast, 7000);
  }
  function hideGiftToast() {   // faded, its button leaves the keyboard's way (the words stay, as the game's toast keeps its own)
    clearTimeout(S.gtT); if (!GT) return; GT.classList.add('hide');
    const b = GT.querySelector('[data-me-see]'); if (b) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
  }
  // Your path, opened at a gift (or, for several, at the shelf with the newest open): its story open, in view, and focus on it
  function openAt(id) {
    if (!S.open) { S.wantGift = id || null; openPanel(); } else if (id) { S.gift = id; render('gifts'); }
    setTimeout(() => {
      const sec = $s('gifts'); if (!sec || !S.open) return;
      const t = (S.gift && sec.querySelector(`[data-me="gift:${cssq(S.gift)}"]`)) || sec.querySelector('h3'); if (!t) return;
      t.scrollIntoView({ block: 'center' }); t.focus({ preventScroll: true });   // Your path opens right at it, with no slide down
    }, 90);
  }
  // the old badges are the gifts now: myBadges() asks here (the top bar and the old panel)
  M.HOOK7.gifts = () => Object.keys(S.got).map(giftView).filter(Boolean).map(v => [v.title, v.kind === 'artifact' ? 'legend' : '']);

  /* ---------- the top bar: your figure in the avatar, and a soft glow when a gift is waiting ---------- */
  function refreshWho() {
    const who = document.querySelector('.who'), fresh = unseen() && !S.open;
    if (who) {
      who.setAttribute('role', 'button'); who.tabIndex = 0;
      who.setAttribute('aria-label', fresh ? 'Your path. A new gift is waiting.' : 'Your path'); who.title = fresh ? 'Your path: a new gift is waiting' : 'Your path';
      who.setAttribute('aria-controls', 'v7-me'); who.setAttribute('aria-expanded', String(!!S.open));
      const av = who.querySelector('.avatar'), txt = document.getElementById('avatarTxt'), w = worn(), key = JSON.stringify([w, drawColour()]);
      if (txt && (txt.dataset.v7 !== key || !txt.querySelector('svg'))) { txt.replaceChildren(toSvg(document, portraitSpec(w, { colour: drawColour(), crop: 'top' }))); txt.dataset.v7 = key; }
      if (av) { av.classList.add('v7-me-av'); av.classList.toggle('v7-me-new', fresh); }
      const nm = document.getElementById('whoName'), rl = document.getElementById('whoRole'), a = T.DKX.kept && T.ARCH_BY[T.DKX.kept];
      if (nm) nm.textContent = T.ME.name || 'A builder'; if (rl) rl.textContent = a ? a.title : 'Your path';
    }
    const mb = document.getElementById('menuBtn'); if (mb) { mb.classList.toggle('v7-me-new', fresh); mb.setAttribute('aria-label', fresh ? 'Menu. A new gift is waiting in Your path.' : 'Menu'); }
    const yb = document.getElementById('youBtn'); if (yb) { yb.classList.toggle('v7-me-new', fresh); yb.setAttribute('aria-label', fresh ? 'Your path. A new gift is waiting.' : 'Your path'); yb.setAttribute('aria-controls', 'v7-me'); yb.setAttribute('aria-expanded', String(!!S.open)); }
  }
  M.HOOK7.who = refreshWho;
  { const pop = document.getElementById('menuPop');   // the phone menu marks Your path while a gift is waiting
    if (pop) new MutationObserver(() => { const b = pop.querySelector('[data-m="path"]'); if (b && unseen() && !b.querySelector('.v7-me-dot')) b.insertAdjacentHTML('beforeend', '<span class="v7-me-dot" aria-hidden="true"></span><span class="v7-me-sr"> A new gift is waiting.</span>'); }).observe(pop, { childList: true }); }

  /* ---------- opening and closing ---------- */
  M.HOOK7.openPath = stage => { openPanel(stage); return true; };
  function openPanel(stage = null) {
    if (S.open) { if (stage != null) { S.stage = clampGate(stage); render('book'); } focusTitle(); return; }
    S.lastFocus = document.activeElement; S.open = true;
    if (stage != null) S.stage = clampGate(stage);
    try { T.closePops(); } catch (e) { }
    S.newAtOpen = new Set(Object.entries(S.got).filter(([, v]) => !v.s).map(([k]) => k));
    if (S.newAtOpen.size) { for (const k of S.newAtOpen) S.got[k].s = 1; saveGot(); S.gift = newestOf([...S.newAtOpen]); }
    if (S.wantGift) { if (S.got[S.wantGift]) S.gift = S.wantGift; S.wantGift = null; }
    hideGiftToast(); S.figMsg = '';
    if (S.figOpen === null) S.figOpen = isBlank(S.avatar);       // the first time, the figure is open to dress; after that, folded away
    S.del = 'idle'; S.dl = '';
    renderAll(); renderPlugins(); notePartsSeen();
    panel.hidden = false; panel.setAttribute('aria-modal', String(PHONE()));
    document.body.classList.add('v7-me-open');
    document.getElementById('v7-me-body').scrollTop = 0;
    refreshWho(); focusTitle();
    ctx.bus.emit('dashboard:open', { me: Object.assign({}, S.me) });
    schedule('open', true);
  }
  const newestOf = ids => ids.slice().sort((a, b) => ((S.got[b] || {}).t || 0) - ((S.got[a] || {}).t || 0))[0] || null;
  function closePanel(restore = true) {
    if (!S.open) return; S.open = false; panel.hidden = true; document.body.classList.remove('v7-me-open');
    document.body.classList.add('v7-me-shut'); clearTimeout(S.shutT); S.shutT = setTimeout(() => document.body.classList.remove('v7-me-shut'), 700);   // the way bar goes back without its slide
    refreshWho();
    if (restore) {
      const seen = el => el && document.contains(el) && el !== document.body && el.offsetParent !== null;
      const f = [S.lastFocus, document.querySelector('.who'), document.getElementById('youBtn'), document.getElementById('menuBtn')].find(seen);
      if (f) f.focus();
    }
  }
  function focusTitle() { setTimeout(() => { const h = document.getElementById('v7-me-title'); if (h && S.open) h.focus({ preventScroll: true }); }, 40); }
  const go = fn => { closePanel(false); setTimeout(() => { try { fn(); } catch (e) { console.warn(e); } }, 0); };
  const clampGate = n => Math.max(0, Math.min(7, Math.round(+n) || 0));

  /* ---------- drawing the sections. Every value from the store goes through esc(); figures are built with DOM APIs ---------- */
  const ORDER = ['who', 'figure', 'gifts', 'book', 'apps', 'camp', 'quests', 'bell', 'steward', 'data'];
  function renderAll() { for (const k of ORDER) render(k); }
  function render(k) {
    const el = $s(k); if (!el || !S.open) return;
    const fn = SECT[k]; if (!fn) return;
    const a = document.activeElement, inside = a && el.contains(a);
    if (inside && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'radio' && a.type !== 'checkbox') { el.dataset.stale = '1'; return; }   // never under someone's typing
    const keep = inside ? a.id || (a.dataset && a.dataset.me ? '[data-me="' + a.dataset.me + '"]' : '') : '';
    let html = ''; try { html = fn(); } catch (e) { console.warn('v7 me', k, e); html = `<h3 id="v7-me-h-${k}" tabindex="-1">${esc(TITLES[k] || '')}</h3><p class="note">This part could not be shown just now.</p>`; }
    el.hidden = !html; el.innerHTML = html; delete el.dataset.stale;
    fillArt(el);
    if (k === 'steward' && html && !coHere()) { const box = el.querySelector('#v7-me-gbh'); if (box) stewardRender(box, S.me); }
    if (keep) { const n = keep.startsWith('[') ? el.querySelector(keep) : document.getElementById(keep); if (n) n.focus({ preventScroll: true }); }
  }
  // the figures in a part: each [data-art] is filled with an SVG built from constants and the cleaned figure
  function artFor(spec) {
    const [kind, a, b] = String(spec).split(':'), w = worn();
    if (kind === 'full' || kind === 'top') return portraitSpec(w, { colour: drawColour(), crop: kind, label: a === 'label' ? describe(w, { cardTitle }) : '' });
    if (kind === 'med') return Object.prototype.hasOwnProperty.call(CARDS, a) ? medallionSpec(a) : null;
    if (kind === 'emblem') return portraitSpec(Object.assign({}, w, { emblem: a || 'none' }), { colour: drawColour(), crop: 'emblem' });
    if (kind === 'piece' && SLOTS.some(s => s.id === a)) return portraitSpec(Object.assign({}, w, { [a]: b }), { colour: drawColour(), crop: a });
    if (kind === 'glyph') return pieceSpec(a + ':' + b);       // a gift's piece, on its own
    return null;
  }
  function fillArt(root) { for (const sp of root.querySelectorAll('[data-art]')) { const n = artFor(sp.dataset.art); if (n) sp.replaceChildren(toSvg(document, n)); else sp.replaceChildren(); } }
  function updateFigureArt() { if (S.open) fillArt(panel); const t = describe(worn(), { cardTitle }), d = document.getElementById('v7-me-desc'); if (d) d.textContent = t; const l = document.getElementById('v7-me-figsum'); if (l) l.textContent = t; }
  // a part that changed under someone's typing is drawn again once they leave it, and never while a pointer is down in the
  // panel: replacing a control between press and release would swallow the click
  const flushStale = () => { if (S.ptr) return; for (const el of panel.querySelectorAll('[data-stale]')) if (!el.contains(document.activeElement)) render(el.id.replace('v7-me-s-', '')); };
  panel.addEventListener('pointerdown', () => { S.ptr = true; });
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { if (S.ptr) { S.ptr = false; setTimeout(flushStale, 0); } }, true);
  panel.addEventListener('focusout', () => setTimeout(flushStale, 0));
  const TITLES = { who: 'Who you are', figure: 'Your figure', gifts: 'Your gifts', book: 'Your book', apps: 'Your applications', camp: 'Your kitchen nights and your sets', quests: 'Your quests', bell: 'From the camp', steward: 'For stewards', data: 'Your data' };
  const H = (k, extra = '') => `<div class="v7-me-sh"><h3 id="v7-me-h-${k}" tabindex="-1">${TITLES[k]}</h3>${extra}</div>`;

  function modeLine() {
    if (P.mode === 'standalone' && !S.me.id) return { t: 'Kept in this browser for now.', act: `<button class="btn v7-me-sm" type="button" data-me="signin">${icon('lock')}Sign in to keep Your path</button>` };
    if (P.mode === 'solo') return { t: 'This copy runs on its own, so everything here is kept in this browser only.', act: '' };
    if (!S.db || !S.me.id || !S.me.canWrite || S.readOnly) return { t: notSaved(), act: '' };
    return { t: 'Saved with your account.', act: '' };
  }
  function renderHeadName() { const nm = document.getElementById('whoName'); if (nm) nm.textContent = T.ME.name || 'A builder'; }

  const SECT = {
    who() {
      const ME = T.ME, a = T.DKX.kept && T.ARCH_BY[T.DKX.kept], crew = ME.crew && T.CREW_BY(ME.crew), welcomed = !!S.state.crewConfirmed, ml = modeLine();
      const hintId = a && T.ARCH_CREW && T.ARCH_CREW[a.key] && T.ARCH_CREW[a.key][0], hint = hintId && T.CREW_BY(hintId);
      const cardTile = a
        ? `<div class="v7-me-tb v7-me-cardtb mv-summary"><button class="v7-me-cardbtn" type="button" data-me="card" aria-label="See your card, ${esc(a.title)}"><img class="v7-me-cardimg" src="${esc(a.src)}" alt=""></button>
            <div class="v7-me-tbx"><span class="eyebrow">The card you kept</span><b class="v7-me-tbt">${esc(a.title)}</b><span class="v7-me-cap">${esc(a.cap)}.</span>
            <p class="v7-me-frame">${FRAMING}</p><div class="v7-me-acts"><button class="btn v7-me-sm" type="button" data-me="card">See your card</button></div></div></div>`
        : `<div class="v7-me-tb mv-summary"><span class="v7-me-ic">${icon('star')}</span><div class="v7-me-tbx"><span class="eyebrow">Your card</span><b class="v7-me-tbt">No card kept yet</b>
            <p>Draw one from the Mahala deck at the book, where the way begins. A card is not your horoscope: it is a way we have of seeing each other.</p><div class="v7-me-acts"><button class="btn v7-me-sm" type="button" data-me="draw">Draw a card</button></div></div></div>`;
      const crewTile = `<div class="v7-me-tb mv-summary"><span class="v7-me-ic">${icon(crew && T.isBuildCrew && T.isBuildCrew(crew.id) ? 'tools' : 'users')}</span><div class="v7-me-tbx"><span class="eyebrow">Your crew</span>
          <b class="v7-me-tbt">${crew ? esc(crew.name) : 'No crew yet'}</b>
          <p>${crew ? (welcomed ? 'You are on this crew, welcomed by a steward.' : 'You joined this crew. A steward welcomes each new crew mate.') : 'Each crew carries one part of the temple or the camp.'}${hint && (!crew || crew.id !== hint.id) ? ` Your card, ${esc(a.title)}, is needed in the ${esc(hint.name)}.` : ''}</p>
          <div class="v7-me-acts"><button class="btn v7-me-sm" type="button" data-me="crews">${crew ? 'The crews' : 'Choose a crew'}</button></div></div></div>`;
      return `<h3 class="v7-me-sr" id="v7-me-h-who" tabindex="-1">${TITLES.who}</h3>
        <div class="v7-me-id">
          <button class="v7-me-arch" type="button" data-me="fig:open" aria-label="Dress your figure"><span data-art="full"></span></button>
          <div class="v7-me-idt">
            <label class="v7-me-nml" for="v7-me-name">Your name or playa name</label>
            <div class="v7-me-nmrow"><input id="v7-me-name" class="v7-me-nm" value="${esc(ME.name || '')}" autocomplete="off" maxlength="40" placeholder="A name for the temple" spellcheck="false"${P.mode === 'standalone' ? ' aria-describedby="v7-me-nmh"' : ''}><span class="v7-me-pen" aria-hidden="true">${icon('pen')}</span></div>
            ${P.mode === 'standalone' ? '<p class="v7-me-nmh" id="v7-me-nmh">The name the temple shows. Your account\'s playa name is in Account and privacy.</p>' : ''}
            <label class="v7-me-show" for="v7-me-show"><input type="checkbox" id="v7-me-show" ${ME.show ? 'checked' : ''} aria-describedby="v7-me-showh"><span>Show my name on the temple</span></label>
            <p class="v7-me-showh" id="v7-me-showh">Off by default. Other builders see it beside your light on the temple.</p>
            <p class="v7-me-mode">${esc(ml.t)}</p>${ml.act ? `<div class="v7-me-modeact">${ml.act}</div>` : ''}
          </div>
        </div>
        <div class="v7-me-tiles2">${cardTile}${crewTile}</div>`;
    },
    figure() {
      const a = worn(), own = ownColour(), U = unlockedSet(), R = rules(), m = mode(), open = !!S.figOpen, card = myCard();
      const btn = `<button class="btn v7-me-sm" type="button" data-me="fig" aria-expanded="${open}" aria-controls="v7-me-figbody">${open ? 'Done' : 'Dress your figure'}</button>`;
      if (!open) return `${H('figure', btn)}<p class="v7-me-lede" id="v7-me-figsum">${esc(describe(a, { cardTitle }))}</p>`;
      const sw = [...(own ? [['own', 'Your own colour', own]] : []), ...PALETTE];
      const cur = a.c ? (PALETTE.find(p => p[2] === a.c) || [])[0] : own ? 'own' : 'sun';
      const locked = [];
      const tile = (slot, k, nm, open, art, extra = '') => {
        const id = `v7-me-p-${slot}-${k}`;
        return `<label class="v7-me-tile${open ? '' : ' v7-me-locked'}" for="${id}"><input type="radio" name="v7-me-${slot}" id="${id}" value="${esc(k)}" data-slot="${slot}" ${a[slot] === k ? 'checked' : ''} ${open ? '' : `disabled aria-describedby="v7-me-how-${slot}-${k}"`}>
          <span class="v7-me-tbox"><span class="v7-me-tart" data-art="${art}"></span><span class="v7-me-tname">${esc(nm)}${open ? '' : '<span class="v7-me-sr">, a gift</span>'}</span>${extra}${open ? '' : `<span class="v7-me-with">${esc(PIECE_WITH[slot + ':' + k] || 'A gift')}</span><span class="v7-me-lock">${icon('lock')}</span>`}</span></label>`;
      };
      const slots = SLOTS.map(sl => `<fieldset class="v7-me-fs"><legend>${esc(sl.name)}</legend><div class="v7-me-tiles" style="--n:${sl.pieces.length}">${sl.pieces.map(([k, nm]) => {
        const key = sl.id + ':' + k, op = FREE.has(key) || U.has(key); if (!op) locked.push(key);
        return tile(sl.id, k, nm, op, `piece:${sl.id}:${k}`); }).join('')}</div></fieldset>`).join('');
      const emb = `<fieldset class="v7-me-fs"><legend>Over your heart</legend><div class="v7-me-tiles" style="--n:5">${tile('emblem', 'none', 'Nothing', true, 'emblem:none')}${card ? tile('emblem', card, cardTitle(card), true, 'emblem:' + card) : ''}</div>
          ${card ? '' : `<p class="note v7-me-embn">Keep a card from the Mahala deck, and you can wear its emblem here. <button class="v7-me-link" type="button" data-me="draw">Draw a card</button></p>`}</fieldset>`;
      const how = locked.map(k => { const g = giftForPiece(R, k); return `<li id="v7-me-how-${k.replace(':', '-')}">${esc(PIECE_HOW[k] || (g ? `The ${PIECE_NAME[k].toLowerCase()} comes with ${titleOf(g, S.state)}.` : ''))}</li>`; }).join('');
      const seen = m === 'solo' ? 'Your figure is kept in this browser. Builders see it when you are signed in and together in the shared Mahalaverse.'
        : !canSave() ? 'Your figure is kept in this browser. Builders see it once you can save to the shared Mahalaverse.'
        : 'Builders in the shared Mahalaverse see your figure like this, never your name unless you show it.';
      return `${H('figure', btn)}<p class="v7-me-lede">The figure you walk the playa as. Choose its colour, and what it wears.</p>
        <div class="v7-me-fig" id="v7-me-figbody">
          <div class="v7-me-prev"><span class="v7-me-prevart" data-art="full:label"></span><div class="v7-me-prevt"><p class="v7-me-desc" id="v7-me-desc" aria-live="polite">${esc(describe(a, { cardTitle }))}</p>
            <p class="v7-me-status" id="v7-me-figsave" role="status">${esc(S.figMsg || '')}</p></div></div>
          <div class="v7-me-opts">
            <fieldset class="v7-me-fs"><legend>Colour</legend><div class="v7-me-sw">${sw.map(([k, nm, hex]) => `<label class="v7-me-swl${k === 'own' ? ' v7-me-own' : ''}" title="${esc(nm)}"><input type="radio" name="v7-me-c" id="v7-me-c-${k}" value="${k}" ${cur === k ? 'checked' : ''} aria-label="${esc(nm)}"><span style="--c:${/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : DEFAULT_COLOUR}"></span></label>`).join('')}</div></fieldset>
            ${slots}${emb}
            ${locked.length ? `<details class="v7-me-how"><summary>A few pieces are gifts, and come in their own time</summary><ul>${how}</ul></details>` : ''}
            <p class="note">${esc(seen)}</p>
          </div>
        </div>`;
    },
    gifts() {
      const ids = Object.entries(S.got).sort((x, y) => (y[1].t || 0) - (x[1].t || 0)).map(([k]) => k);
      const views = ids.map(giftView).filter(Boolean);
      if (!views.length) return `${H('gifts')}<div class="mv-empty"><p>${esc(emptyShelf())}</p></div>`;
      const sel = views.find(v => v.id === S.gift) || null;
      return `${H('gifts')}<p class="v7-me-lede">Gifts for what you give. Open one to see why it came.</p>
        <ul class="v7-me-shelf">${views.map(v => `<li><button class="v7-me-tok" type="button" data-me="gift:${esc(v.id)}" aria-expanded="${sel === v}" aria-controls="v7-me-gd">${medal(v)}<span class="v7-me-tokt">${esc(v.title)}</span>${S.newAtOpen.has(v.id) ? '<span class="v7-me-newdot" aria-hidden="true"></span><span class="v7-me-sr">, new</span>' : ''}</button></li>`).join('')}</ul>
        <div class="v7-me-gd mv-summary" id="v7-me-gd" role="region" aria-label="About this gift" aria-live="polite"${sel ? '' : ' hidden'}>${sel ? giftDetail(sel) : ''}</div>`;
    },
    book() {
      const ME = T.ME, st = S.stage ?? clampGate(ME.gate), G = [T.GATE0 || { n: 0, name: 'The invitation' }, ...T.DATA.gates], P5 = T.PATHS[st] || T.PATHS[0];
      const a = T.DKX.kept && T.ARCH_BY[T.DKX.kept], book = Array.isArray(ME.book) ? ME.book : [];
      const KT = { reflect: 'Reflection', poem: 'Poem', story: 'Story', art: 'Drawing', line: 'A line for the fire' };
      const groups = G.map(g => ({ g, es: book.filter(e => e && e.gate === g.n).slice().reverse() })).filter(x => x.es.length);
      const img = s => (typeof s === 'string' && s.length < 3000000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '');
      const entry = e => `<div class="entry v7-me-entry"><small>${esc(e.journey ? 'Soul journey' : (KT[e.kind] || 'A note'))} · ${esc(day(e.at))}${e.fire ? ' · offered to the fire' : ''}</small>${e.prompt ? `<p class="v7-me-pr">${esc(e.prompt)}</p>` : ''}${img(e.img) ? `<img src="${img(e.img)}" alt="${esc('Your drawing' + (e.prompt ? ': ' + e.prompt : ''))}">` : ''}${e.text ? `<p>${esc(e.text)}</p>` : ''}${e.text && !e.fire && e.kind !== 'art' ? `<div class="actions"><button class="btn v7-me-sm" type="button" data-me="offer:${esc(e.id)}">${icon('flame')}Offer a line to the fire</button></div>` : ''}</div>`;
      return `${H('book', `<span class="chip lock v7-me-priv">${icon('lock')}Private to you</span>`)}<p class="v7-me-lede">Your journal: reflections, poems, sketches and lines for the fire. Only you can read it unless you share it.</p>
        <div class="v7-me-stage"><div class="field"><label for="v7-me-stagesel">Prompts from</label><select id="v7-me-stagesel">${G.map(g => `<option value="${g.n}" ${g.n === st ? 'selected' : ''}>${esc(gateLabel(g))}</option>`).join('')}</select></div>
          <button class="btn" type="button" data-me="write:line">${icon('flame')}A line for the fire</button></div>
        <div class="prompts">${[['reflect', 'Reflect', P5.reflect], ['poem', 'A poem', P5.poem], ['art', 'Draw', P5.art]].map(([k, t, p]) => `<button class="prompt" type="button" data-me="write:${k}"><span class="k">${t}</span><span>${esc(st === 1 && k === 'reflect' && a && a.q ? a.q : p)}</span></button>`).join('')}</div>
        ${groups.length ? groups.map(({ g, es }) => `<div class="v7-me-group"><h4>${esc(gateLabel(g))}</h4><div class="entries">${es.slice(0, 4).map(entry).join('')}</div>${es.length > 4 ? `<details class="v7-me-more"><summary>Earlier at this gate</summary><div class="entries">${es.slice(4).map(entry).join('')}</div></details>` : ''}</div>`).join('')
          : '<div class="mv-empty"><p>Your book is empty so far. Choose a prompt to begin.</p></div>'}
        <p class="note">A line you offer waits for a steward to read, then joins the lines at the fire, with your name only if you chose to show it.</p>
        ${book.length ? `<div class="actions"><button class="btn" type="button" data-me="bookdl">${icon('save')}Download my book</button></div>` : ''}`;
    },
    apps() {
      const rows = appRows();
      const looking = S.db && S.me.id && !S.signupLoaded;
      const d = S.signup || {};
      const contact = typeof d.contact === 'string' && d.contact.trim() ? d.contact.trim().slice(0, 80) : '';
      return `${H('apps')}${looking ? '<p class="note">Looking for your applications...</p>' : ''}${S.signupSlow && !S.signup ? '<p class="note">Your applications could not be reached just now. What you sent is safe; look again in a moment.</p>' : ''}
        ${rows.length ? `<div class="v7-me-rows">${rows.map(r => `<div class="v7-me-row"><span class="v7-me-ic">${icon(r.icon)}</span><span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span>${r.chip ? `<span class="chip ${r.chip[0]}">${esc(r.chip[1])}</span>` : '<span></span>'}</div>`).join('')}</div>`
          : looking ? '' : `<div class="mv-empty"><p>Nothing sent yet. When you apply to the camp or the build, you will see here what you sent and what the camp said.</p><button class="btn" type="button" data-me="join">${icon('gate')}Take part</button></div>`}
        ${contact ? `<p class="note">You left this way to reach you: ${esc(contact)}.</p>` : ''}
        <p class="note">${S.db ? 'What you send is seen only by you and the stewards. To change or withdraw an application, ' + TO_STEWARDS + '.' : 'In this browser only. What you send in the shared Mahalaverse is seen only by you and the stewards.'}</p>`;
    },
    camp() {
      const keys = cleanShifts(myShiftKeys()), KD = Object.fromEntries((T.KDAYS || []).map(([k, t]) => [k, t]));
      const nights = keys.map(k => KD[k.split('-')[0]] || k).filter(Boolean), sets = (mySounds() || []).filter(x => x && typeof x === 'object'), KS = T.KIND_S || {};
      const safe = u => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
      const hostOf = u => { try { return new URL(u).hostname.replace(/^www\.|^open\./, ''); } catch (e) { return ''; } };
      const kitchen = `<button class="btn v7-me-sm" type="button" data-me="kitchen">Open the kitchen</button>`, tent = `<button class="btn v7-me-sm" type="button" data-me="tent">Open the main tent</button>`;
      const links = sets.map(x => ({ x, u: safe(x.url) })).filter(o => o.u);
      if (!nights.length && !links.length) return `${H('camp')}<div class="mv-empty"><p>No dinner night or music yet. The camp shares one main dinner a day, cooked by a team of camp mates, and the main tent plays the music camp mates share, once a steward has listened.</p><div class="v7-me-acts v7-me-mid">${kitchen}${tent}</div></div>`;
      // where each set stands: heard in the main tent once a steward said yes (the stewards' tools say so), or still waiting
      const where = x => (x.local ? 'Kept in this browser' : x.st && x.st.s === 'ok' ? 'Heard in the main tent' : x.st && x.st.s === 'no' ? 'Not shared' : x.st ? 'Waiting for a steward' : '');
      return `${H('camp')}<div class="v7-me-rows">
        <div class="v7-me-row"><span class="v7-me-ic">${icon('users')}</span><span><b>${nights.length ? 'Your dinner nights' : 'No dinner night yet'}</b><small>${nights.length ? esc(andList(nights)) + '. The kitchen crew plans the menu with you.' : 'The camp shares one main dinner a day, cooked by a team of camp mates.'}</small></span>${kitchen}</div>
        <div class="v7-me-row v7-me-top"><span class="v7-me-ic">${icon('sound')}</span><span><b>${links.length ? 'Your music for the main tent' : 'No music shared yet'}</b>${links.length ? `<span class="v7-me-links">${links.slice(0, 12).map(({ x, u }) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(String(x.title || 'A set').slice(0, 80))}<small>${esc([KS[x.k] || 'A set', hostOf(u), where(x)].filter(Boolean).join(' · '))}</small></a>`).join('')}</span><small>Heard by everyone in the main tent once a steward has listened.</small>` : '<small>Playlists, DJ sets and recordings for the main tent, heard by everyone once a steward has listened.</small>'}</span>${tent}</div>
      </div>`;
    },
    quests() {
      const ME = T.ME, qs = Object.keys(ME.quests || {}).map(id => T.DATA.quests.find(q => q.id === id)).filter(Boolean);
      return `${H('quests')}${qs.length ? `<p class="v7-me-lede">The quests on your list. Each is a way to help the build, at your own pace.</p><div class="v7-me-rows">${qs.map(q => `<div class="v7-me-row"><span class="v7-me-ic">${icon('pin')}</span><span><b>${esc(q.name)}</b><small>${esc(q.crew)}${ME.quests[q.id] && ME.quests[q.id].at ? ' · on your list since ' + esc(day(ME.quests[q.id].at)) : ''}</small></span><span class="v7-me-acts"><button class="btn v7-me-sm" type="button" data-me="quest:${esc(q.id)}">See it</button><button class="btn ghost v7-me-sm" type="button" data-me="qdrop:${esc(q.id)}" aria-label="Take ${esc(q.name)} off my list">Take it off</button></span></div>`).join('')}</div>`
        : `<div class="mv-empty"><p>No quests on your list. Each quest is a way to help the build: take one when it calls you.</p><button class="btn" type="button" data-me="quests">${icon('pin')}See the quests</button></div>`}`;
    },
    bell() {
      if (!PHONE()) return '';
      const items = (T.LIVE.bell || []).slice(0, 3); if (!items.length) return '';
      return `${H('bell')}<div class="v7-me-rows">${items.map(i => `<div class="v7-me-row v7-me-one"><span><b>${esc(i.t || '')}</b><small>${esc(i.s || '')}</small></span></div>`).join('')}</div>`;
    },
    steward() {
      if (!S.me.isSteward && !T.LIVE.admin) return '';
      if (coHere()) return `${H('steward')}<p class="v7-me-lede">Moderation, crews, applications and gifts by hand live in the stewards' tools.</p><div class="actions"><button class="btn" type="button" data-me="steward">${icon('tools')}Open the stewards' tools</button></div>`;
      return `${H('steward')}<p class="note">Only stewards see this part.</p><div class="actions"><button class="btn" type="button" data-me="oldlead">${icon('tools')}Open the stewards' tools</button></div>
        <div class="v7-me-sub2"><h4>Gifts by hand</h4><div id="v7-me-gbh"></div></div>`;
    },
    data() {
      const m = mode(), acc = !!(S.db && S.me.id), can = canSave();
      const box = S.del === 'ask' ? `<div class="v7-me-confirm" id="v7-me-confirm" role="group" aria-labelledby="v7-me-delh"><h4 id="v7-me-delh" tabindex="-1">Delete your data?</h4>
          <p>${esc(acc && can ? 'This deletes ' + deleteList() + ', here and with your account.' : 'This deletes everything this page keeps in this browser: your book, your figure, your gifts (the badges and pieces in Your path), your name and card, and your choices.')} It cannot be undone.</p>
          ${acc && !can ? `<p class="note">${esc(fromHere() + ' you cannot change what is stored with your account. To delete that too, ' + TO_STEWARDS + '.')}</p>` : ''}
          ${acc && can ? `<p class="note">${esc(stewardsKeep())}</p>` : ''}
          <div class="actions"><button class="btn" type="button" data-me="delno">Keep my data</button><button class="btn v7-me-danger" type="button" data-me="delyes">Delete everything</button></div></div>`
        : S.del === 'busy' ? '<p class="note" role="status">Deleting your data...</p>'
        : S.del === 'done' ? `<div class="v7-me-done mv-summary" role="status"><p>${esc(S.delNote || 'Your data is deleted.')}</p><div class="actions"><button class="btn" type="button" data-me="reload">Start again</button></div></div>` : '';
      return `${H('data')}<p class="v7-me-lede">${m === 'solo' ? 'Everything here is kept in this browser only.' : acc ? 'What is yours here is kept in this browser and with your account.' : 'What is yours here is kept in this browser.'} Your book is private to you. Builders see your figure, and your name only if you chose to show it.</p>
        <div class="actions"><button class="btn" type="button" data-me="dl" ${S.dl === 'busy' ? 'disabled' : ''}>${icon('save')}Download my data</button>${S.del === 'idle' ? `<button class="btn v7-me-danger" type="button" data-me="delask">Delete my data</button>` : ''}</div>
        ${S.dl && S.dl !== 'busy' ? `<p class="note" role="status">${esc(S.dl)}</p>` : S.dl === 'busy' ? '<p class="note" role="status">Gathering your data...</p>' : ''}
        <p class="note">The download is a JSON file of everything that is yours here: your choices, your book, your figure, your gifts, your applications and what you shared.</p>
        ${m === 'standalone' && S.me.id ? '<p class="note">To close your account itself, choose Account and privacy: at your name in the top bar, or in the menu on a phone.</p>' : ''}${box}`;
    },
  };
  const gateLabel = g => (g.n === 0 ? `${g.name}, before the gates` : `Gate ${g.n}: ${g.name}`);
  const listOr = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ', or ' + xs[xs.length - 1]);
  const ruleHere = test => rules().some(r => test(r.id));
  // the ways a gift comes that are here: the other parts' only when they are loaded
  function emptyShelf() {
    const ways = ['cook a camp dinner', 'share music in the main tent', 'offer words to the fire', 'join a crew', 'apply to the camp or the build'];
    if (ruleHere(id => id === 'seed-carrier')) ways.push('plant a seed');
    if (coHere()) ways.push('offer art');
    if (ruleHere(id => id.startsWith('pay-'))) ways.push('give through a gate');
    if (ruleHere(id => id === 'co-creator')) ways.push('see an idea of yours built');
    return 'Gifts for what you give arrive here on their own: when you ' + listOr(ways) + '.';
  }
  // what Delete removes: yours here, and what each other part says it erases (only the parts that are loaded)
  const ERASES = { 'co-offered': 'what you offered, your ideas, hearts and replies', 'world-seeds': 'your seeds on the map', pay: 'your pledges' };
  const erasers = () => (ctx.dashboard || []).filter(x => x && typeof x.erase === 'function');
  function deleteList() {
    const theirs = erasers().map(x => ERASES[x.id] || (t => (t ? t.charAt(0).toLowerCase() + t.slice(1) : ''))(String(x.title || '').replace(/\s+/g, ' ').trim().slice(0, 60))).filter(Boolean);
    const xs = ['your book', 'your figure', 'your gifts (the badges and pieces in Your path)', 'your name and card', 'your kitchen nights', 'your music for the main tent', ...new Set(theirs), 'a line waiting at the fire', 'your messages and notes'];
    return xs.slice(0, -1).join(', ') + ', and ' + xs[xs.length - 1];
  }
  function stewardsKeep() {
    const paid = erasers().some(x => x.id === 'pay');
    return 'Your applications stay with the stewards, as they hold your place with the camp. The stewards also keep words already read at the fire, gifts they gave by hand, '
      + (paid ? 'the record of any gift you paid (for the camp\'s accounts), ' : '') + 'and their answers to your applications. To withdraw an application, or to have any of these removed, ' + TO_STEWARDS + '.';
  }
  /* one medallion for every gift: a ring and a tint in its tone (toneOf), with its sign. The card you kept shows its own art
     in a ring of the card's colour; a piece for your figure shows the piece itself. size: '' (the shelf), 'big', 'mini' (the toast) */
  const isPiece = x => typeof x === 'string' && Object.prototype.hasOwnProperty.call(PIECE_NAME, x) && !x.endsWith(':none');
  function medal(v, size = '') {
    const cls = 'v7-me-emb' + (size ? ' v7-me-' + size : '');
    if (v.card && T.ARCH_BY[v.card] && Object.prototype.hasOwnProperty.call(CARDS, v.card)) return `<span class="${cls} v7-me-card" style="--tone:${CARDS[v.card].c}"><span><img src="${esc(T.ARCH_BY[v.card].src)}" alt=""></span></span>`;
    const p = v.kind === 'outfit' ? [v.piece, ...(v.pieces || [])].find(isPiece) : null;
    return `<span class="${cls}" data-tone="${toneOf(v)}">${p ? `<span data-art="glyph:${p}"></span>` : `<span>${icon(ICONS.has(v.icon) ? v.icon : 'gift')}</span>`}</span>`;
  }
  function giftDetail(v) {
    const g = S.got[v.id] || {}, pcs = (v.pieces || []).filter(p => PIECE_NAME[p]);
    const brought = pcs.length ? `<p class="v7-me-brought">It brought ${esc(andList(pcs.map(p => 'the ' + PIECE_NAME[p].toLowerCase())))} for your figure.</p>
      <div class="v7-me-acts">${pcs.map(p => { const [sl, k] = p.split(':'); return S.avatar[sl] === k ? `<span class="chip done">Wearing the ${esc(PIECE_NAME[p].toLowerCase())}</span>` : `<button class="btn v7-me-sm" type="button" data-me="wear:${esc(p)}">Wear the ${esc(PIECE_NAME[p].toLowerCase())}</button>`; }).join('')}</div>` : '';
    return `<div class="v7-me-gdi">${medal(v, 'big')}</div><div class="v7-me-gdt"><span class="eyebrow">${esc(v.hand ? 'Given by a steward' : KIND_LABEL[v.kind] || 'A gift')}</span><h4>${esc(v.title)}</h4>
      ${v.why ? `<p class="v7-me-why">${esc(v.why)}</p>` : ''}${g.t ? `<small class="v7-me-when">Came on ${esc(day(g.t))}</small>` : ''}${brought}</div>`;
  }
  function appRows() {
    const d = S.signup && typeof S.signup === 'object' ? S.signup : {}, ME = T.ME, id = S.me.id || T.LIVE.uid, conf = (id && T.LIVE.confirm && T.LIVE.confirm[id]) || {};
    const ans = S.apps || {}, ok = v => (v === 'accepted' || v === 'waitlisted' ? v : null);   // the camp's answers (answer/<uid>.apps); crews stay in confirm
    const local = !canSave(), rows = [], sent = t => (t ? 'Sent ' + day(t) + '. ' : ''), said = t => (t ? ' (' + day(t) + ')' : '');
    const kept = ['wait', 'Kept in this browser'];
    const camp = d.d_camp && typeof d.d_camp === 'object' ? d.d_camp : (local && (ME.door === 'camp' || ME.maybe) ? { camp: ME.door === 'camp' ? 'yes' : 'maybe' } : null);
    if (camp) {
      const maybe = camp.camp === 'maybe', v = ok(ans.camp);
      rows.push(local ? { icon: 'tent', title: maybe ? 'Maybe, for the camp' : 'A place in the camp', sub: 'In the shared Mahalaverse this reaches the stewards, who read every application.', chip: kept }
        : v === 'accepted' ? { icon: 'tent', title: 'A place in the camp', sub: sent(camp.at) + 'The camp said yes' + said(ans.campAt) + '. Your place in the camp is held.', chip: ['done', 'Welcome'] }
        : v === 'waitlisted' ? { icon: 'tent', title: 'A place in the camp', sub: sent(camp.at) + 'The camp is full for now, so you are on the waiting list' + said(ans.campAt) + '. A steward will write if a place opens.', chip: ['wait', 'On the waiting list'] }
        : { icon: 'tent', title: maybe ? 'Maybe, for the camp' : 'A place in the camp', sub: sent(camp.at) + (maybe ? 'A steward reads every application, and a camp mate will follow up on your three answers.' : 'A steward reads every application. Next comes your welcome call with a camp mate.'), chip: ['now', 'Received'] });
    }
    const build = d.d_build && typeof d.d_build === 'object' ? d.d_build : (local && ME.door === 'build' ? { crew: ME.crew } : null);
    if (build) {
      const cid = ME.crew || build.crew, crew = typeof cid === 'string' && T.CREW_BY(cid), onCrew = !!(crew && conf.crew === crew.id), v = ok(ans.build);
      const crewLine = crew ? (onCrew ? ` A steward welcomed you onto the ${crew.name}.` : ` You asked to join the ${crew.name}.`) : '';
      rows.push(local ? { icon: 'tools', title: 'Join the build', sub: (crew ? `You chose the ${crew.name}. ` : '') + 'In the shared Mahalaverse this reaches the stewards.', chip: kept }
        : v === 'accepted' || (onCrew && v !== 'waitlisted') ? { icon: 'tools', title: 'Join the build', sub: sent(build.at) + 'You are on the build' + said(ans.buildAt) + '.' + crewLine, chip: ['done', 'Welcome'] }
        : v === 'waitlisted' ? { icon: 'tools', title: 'Join the build', sub: sent(build.at) + 'The build is full for now, so you are on the waiting list' + said(ans.buildAt) + '.' + crewLine, chip: ['wait', 'On the waiting list'] }
        : { icon: 'tools', title: 'Join the build', sub: sent(build.at) + 'A steward reads every application.' + (crew ? ` You asked to join the ${crew.name}.` : ' A steward will be in touch.'), chip: ['now', 'Received'] });
    }
    const back = d.d_back && typeof d.d_back === 'object' ? d.d_back : null;
    if (back) { const g = back.gate && T.GATE_BY(+back.gate); rows.push({ icon: 'gift', title: 'A way to give', sub: sent(back.at) + (g ? `You chose Gate ${g.n}: ${g.name}.` : 'You chose to give to The Seed.'), chip: null }); }
    const nn = d.d_notnow && typeof d.d_notnow === 'object' ? d.d_notnow : (local && ME.notNow ? {} : null);
    if (nn) rows.push({ icon: 'cal', title: 'Not this year', sub: sent(nn.at) + (nn.nextYear && d.consent ? 'You are on the list for next year. A camp mate will write when the next build begins.' : 'The doors stay open, whenever you are ready.'), chip: null });
    const ev = ME.notify && typeof ME.notify === 'object' ? Object.keys(ME.notify).map(k => (T.DATA.events.find(e => e.id === k) || {}).name).filter(Boolean) : [];
    if (ev.length) rows.push({ icon: 'bell', title: 'News of events', sub: `You asked for news of ${andList(ev)}, once ${ev.length === 1 ? 'its date is' : 'their dates are'} set.`, chip: null });
    return rows;
  }

  /* ---------- the sections other plugins add, after your quests (sorted by their order) ---------- */
  function renderPlugins() {
    const box = document.getElementById('v7-me-plugins'); if (!box) return; box.replaceChildren();
    const list = (ctx.dashboard || []).filter(s => s && typeof s.render === 'function').slice().sort((a, b) => (+a.order || 0) - (+b.order || 0));
    list.forEach((s, i) => {
      const sec = document.createElement('section'); sec.className = 'v7-me-sect'; const hid = 'v7-me-h-p' + i;
      sec.setAttribute('aria-labelledby', hid); sec.dataset.plugin = String(s.id || i).slice(0, 40);
      const hd = document.createElement('div'); hd.className = 'v7-me-sh';
      const h = document.createElement('h3'); h.id = hid; h.tabIndex = -1; h.textContent = String(s.title || '').slice(0, 80); hd.appendChild(h); sec.appendChild(hd);
      const el = document.createElement('div'); el.className = 'v7-me-pbody'; sec.appendChild(el); box.appendChild(sec);
      Promise.resolve().then(() => s.render(el, Object.assign({}, S.me))).catch(e => { console.warn('v7 me section', s.id, e); el.innerHTML = '<p class="note">This part could not be shown just now.</p>'; });
    });
  }

  /* ---------- what you do in the panel ---------- */
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-me]'); if (!b || b.disabled || !panel.contains(b)) return;
    const v = b.dataset.me, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
    act(k, x, b);
  });
  function jump(k) {
    const sec = $s(k); if (!sec || sec.hidden) return;
    sec.scrollIntoView({ behavior: REDUCED() ? 'auto' : 'smooth', block: 'start' });
    const h = sec.querySelector('h3'); if (h) setTimeout(() => h.focus({ preventScroll: true }), REDUCED() ? 0 : 350);
  }
  function act(k, x, b) {
    const ME = T.ME;
    if (k === 'close') return closePanel();
    if (k === 'jump') { if (x === 'figure' && !S.figOpen) { S.figOpen = true; render('figure'); } jump(x); return; }
    if (k === 'fig') {
      S.figOpen = x === 'open' ? true : !S.figOpen; render('figure');
      if (S.figOpen) { jump('figure'); } else { const n = $s('figure').querySelector('[data-me="fig"]'); if (n) n.focus({ preventScroll: true }); }
      return;
    }
    if (k === 'gift') {
      S.gift = S.gift === x ? null : x; render('gifts');
      const t = $s('gifts').querySelector(`[data-me="gift:${window.CSS && CSS.escape ? CSS.escape(x) : x}"]`); if (t) t.focus({ preventScroll: true });
      const gd = document.getElementById('v7-me-gd'); if (gd && !gd.hidden) gd.scrollIntoView({ block: 'nearest', behavior: REDUCED() ? 'auto' : 'smooth' });
      return;
    }
    if (k === 'wear') { const [sl, pc] = x.split(':'); if (SLOTS.some(s => s.id === sl)) { setAvatar({ [sl]: pc }, 'now'); render('gifts'); const t = $s('gifts').querySelector('.v7-me-gd .chip.done'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); } } return; }
    if (k === 'signin') { try { P.signIn && P.signIn(); } catch (e) { console.warn(e); } return; }
    if (k === 'card') { const key = T.DKX.kept; if (key) go(() => T.openFireside('ARCH_' + key.toUpperCase(), 'kept')); return; }
    if (k === 'draw') { go(() => (T.openPlinthDeck ? T.openPlinthDeck() : T.openFireside('deck'))); return; }
    if (k === 'crews') { go(() => T.select('CREWS')); return; }
    if (k === 'write') { T.openWrite(x, S.stage ?? clampGate(ME.gate)); return; }
    if (k === 'offer') { offer(x); return; }
    if (k === 'bookdl') { try { T.downloadBook(); } catch (e) { T.toast('Files cannot be saved from here.'); } return; }
    if (k === 'join') { go(() => T.openJoin()); return; }
    if (k === 'kitchen') { go(() => T.select('CAMP_KITCHEN')); return; }
    if (k === 'tent') { go(() => T.select('CAMP_TENT')); return; }
    if (k === 'quest') { go(() => T.select(x)); return; }
    if (k === 'qdrop') { if (M.dropQuest) M.dropQuest(x); else { delete ME.quests[x]; T.saveMe(); T.pushMe(); } render('quests'); schedule('quest'); const n = $s('quests').querySelector('button'); if (n) n.focus(); return; }
    if (k === 'quests') { go(() => (T.openExplore ? T.openExplore('quests') : T.select('Q-01'))); return; }
    if (k === 'steward') { go(() => ctx.bus.emit('steward:open', { me: Object.assign({}, S.me) })); return; }
    if (k === 'oldlead') { go(openOldPanel); return; }
    if (k === 'dl') { downloadData(); return; }
    if (k === 'delask') { S.del = 'ask'; render('data'); setTimeout(() => { const box = document.getElementById('v7-me-confirm'), h = document.getElementById('v7-me-delh'); if (box) box.scrollIntoView({ block: 'nearest', behavior: REDUCED() ? 'auto' : 'smooth' }); if (h) h.focus({ preventScroll: true }); }, 30); return; }
    if (k === 'delno') { S.del = 'idle'; render('data'); const n = $s('data').querySelector('[data-me="delask"]'); if (n) n.focus(); return; }
    if (k === 'delyes') { deleteData(); return; }
    if (k === 'reload') { try { location.reload(); } catch (e) { } return; }
  }
  panel.addEventListener('input', e => {
    if (e.target.id === 'v7-me-name') { const ME = T.ME; ME.name = e.target.value.replace(/\s+/g, ' ').slice(0, 40); T.saveMe(); clearTimeout(S.nmT); S.nmT = setTimeout(() => { try { T.pushMe(); } catch (er) { } }, 900); renderHeadName(); }
  });
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'v7-me-name') { const v = t.value.replace(/\s+/g, ' ').trim().slice(0, 40); if (v !== T.ME.name) { T.ME.name = v; T.saveMe(); } clearTimeout(S.nmT); try { T.pushMe(); } catch (er) { } return; }
    if (t.id === 'v7-me-show') { T.ME.show = t.checked; T.saveMe(); try { T.pushMe(); } catch (er) { } return; }
    if (t.name === 'v7-me-c') { const p = PALETTE.find(x => x[0] === t.value); setAvatar({ c: t.value === 'own' ? null : p ? p[2] : null }); return; }
    if (t.dataset && t.dataset.slot) { setAvatar({ [t.dataset.slot]: t.value }); return; }
    if (t.id === 'v7-me-stagesel') { S.stage = clampGate(t.value); render('book'); return; }
  });
  // keys you press in the panel stay in the panel: the arrow keys do not walk your figure, Escape closes, the phone keeps focus in
  panel.addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase(), t = e.target;
    if (WALK.has(k) && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) e.stopPropagation();
    if (k === 'enter' && t.id === 'v7-me-name') { e.preventDefault(); t.blur(); return; }
    if (k === 'tab' && PHONE()) {
      const f = [...panel.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !S.open) return;
    if ([...document.querySelectorAll('.modal')].some(m => !m.hidden)) return;     // the sheet above answers first
    const a = document.activeElement, st = M.state ? M.state() : {};
    const idle = !a || a === document.body || a.id === 'scene';
    if (panel.contains(a) || (idle && !st.fire && !st.story && !st.current && !st.inside)) { e.preventDefault(); e.stopImmediatePropagation(); closePanel(); }
  }, true);
  addEventListener('resize', () => { if (S.open) { panel.setAttribute('aria-modal', String(PHONE())); render('bell'); } });

  // back from writing, the book shows what you kept; back from the join flow, your name, crew and applications are fresh
  { const wm = document.getElementById('writeModal'), jm = document.getElementById('joinModal');
    if (wm) new MutationObserver(() => { if (wm.hidden && S.open) { render('book'); schedule('book'); } }).observe(wm, { attributes: true, attributeFilter: ['hidden'] });
    if (jm) new MutationObserver(() => { if (jm.hidden && S.open) { render('who'); render('apps'); schedule('join'); } }).observe(jm, { attributes: true, attributeFilter: ['hidden'] }); }
  function offer(entryId) {
    const e = (T.ME.book || []).find(x => x && x.id === entryId); if (!e || !e.text || e.fire) return;
    const line = (e.kind === 'line' ? e.text : (e.text.split('\n').map(s => s.trim()).filter(Boolean)[0] || e.text)).slice(0, 160);
    try { T.offerLine(line); } catch (er) { console.warn(er); T.toast('That did not reach the fire. Try again in a moment.'); return; }
    // entries read back from the store are frozen: replace the entry with a changed copy, never change it in place
    const b = T.ME.book, j = b.indexOf(e), ne = Object.assign({}, e, { fire: true });
    try { b[j] = ne; } catch (er) { T.ME.book = b.map((x, k) => k === j ? ne : x); }
    T.saveMe(); try { T.pushBook(ne); } catch (er) { }
    render('book'); schedule('offer');
  }
  function openOldPanel() { const h = M.HOOK7.openPath; M.HOOK7.openPath = null; try { T.openPath(); } finally { M.HOOK7.openPath = h; } }
  const coHere = () => Array.isArray(ctx.started) && ctx.started.includes('co');

  /* ---------- your data: download it, or delete it ---------- */
  async function getDoc(path) { try { const s = await withTimeout(S.db.doc(path).get(), 9000); return s.exists ? s.data() : undefined; } catch (e) { return { _error: 'This could not be read just now.' }; } }
  function ownLocal() {
    const ME = T.ME, me = Object.assign({}, ME); delete me.book;
    return { me, archetype: T.DKX.kept || null, sounds: (T.V5 && T.V5.mySounds) || [], shifts: (T.V5 && T.V5.myShifts) || [], avatar: S.avatar, gifts: S.got };
  }
  async function downloadData() {
    if (S.dl === 'busy') return; S.dl = 'busy'; render('data');
    try {
      const id = S.me.id, cols = selfCollections(T.meSelf), paths = docPaths(id, cols), shared = {}, lead = {}, priv = {};
      let book = (T.ME.book || []).slice();
      if (S.db && id) {
        await Promise.all(paths.own.map(async p => { const d = await getDoc(p); if (d !== undefined) shared[p] = d; }));
        await Promise.all(paths.lead.map(async p => { const d = await getDoc(p); if (d !== undefined) lead[p] = d; }));
        await Promise.all(paths.priv.map(async p => { const d = await getDoc(p); if (d !== undefined) priv[p] = d; }));
        try { const s = await withTimeout(S.db.collection(bookCollection(id)).get(), 9000); const have = new Set(book.map(b => b && b.id)); for (const d of s.docs) { const v = d.data(); if (v && !have.has(v.id)) book.push(v); } } catch (e) { }
      }
      const mine = offeredLines(T.ME.book), hearth = (T.LIVE.hearth || []).filter(h => isMyLine(h, id, mine)).map(h => ({ text: h.text, at: h.at || null }));
      const parts = {};
      for (const s of ctx.dashboard || []) if (s && typeof s.export === 'function') { try { parts[String(s.id || s.title)] = await withTimeout(s.export(Object.assign({}, S.me)), 9000); } catch (e) { parts[String(s.id || s.title)] = { _error: 'This could not be read just now.' }; } }
      const file = exportFile({ when: Date.now(), mode: mode(), uid: id, local: ownLocal(), shared, priv, book, lead, hearth, parts });
      const r = await saveFile('my-mahalaverse-data.json', JSON.stringify(file, null, 2));
      S.dl = r === 'saved' ? 'Your data is downloaded.' : r === 'declined' ? '' : r === 'busy' ? 'A download is already waiting for your answer.' : 'Files cannot be saved from here.';
    } catch (e) { console.warn(e); S.dl = 'Your data could not be gathered just now. Try again in a moment.'; }
    render('data');
  }
  /* the downloads capability where the page runs on claude.ai (the platform asks the viewer first); on Mahala's own site
     and in a saved copy, an ordinary download */
  async function saveFile(name, data) {
    let dl = null; try { dl = await withTimeout(P.use('downloads'), 9000); } catch (e) { dl = null; }
    if (dl && typeof dl.save === 'function') {
      try { await dl.save({ filename: name, data }); return 'saved'; }
      catch (e) { const c = e && e.code; if (c === 'declined') return 'declined'; if (c === 'rate_limited') return 'busy'; if (mode() === 'claude') return 'failed'; }
    } else if (mode() === 'claude') return 'failed';                 // inside claude.ai a page cannot download by itself
    try { const u = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return 'saved'; }
    catch (e) { return 'failed'; }
  }
  const PART = { builders: 'your name and card', fire: 'your line waiting at the fire', chat: 'your messages', notes: 'your notes', board: 'your offers and needs on the camp board',
    claims: 'what you are in on', seen: 'where you were last', sounds: 'your music for the main tent', shifts: 'your kitchen nights', avatars: 'your figure', data: 'your private book and gifts' };
  async function deleteData() {
    if (S.del === 'busy') return; S.del = 'busy'; S.deleting = true; render('data');
    clearTimeout(S.avT); clearTimeout(S.nmT); clearTimeout(evT);
    const id = S.me.id, fails = new Set(); let leftAccount = false;
    try {
      // first this page forgets you, so nothing it holds is written back while the store is cleared
      const ME = T.ME, fresh = freshMe(ME);
      for (const key of Object.keys(ME)) delete ME[key]; Object.assign(ME, fresh, { book: [] });
      T.DKX.kept = null; S.lastCard = null; if (T.V5) { T.V5.mySounds = []; T.V5.myShifts = []; }
      S.avatar = blankAvatar(); S.got = {}; S.gift = null; S.signup = null; provCache.part = null; S.bus = { seeds: 0, ideas: 0, ideasBuilt: 0, paid: 0, contrib: {} };
      for (const k of localKeys(store.keys())) store.del(k);
      publishOutfits(); refreshWho();
      try { T.showKept(); } catch (e) { }
      try { T.renderKpis(); } catch (e) { }
      // then what the other parts keep, and the documents (your applications stay with the stewards)
      for (const s of ctx.dashboard || []) if (s && typeof s.erase === 'function') { try { await withTimeout(s.erase(Object.assign({}, S.me)), 12000); } catch (e) { fails.add(String(s.title || 'a part of another section')); } }
      if (S.db && id && canSave()) {
        const paths = docPaths(id, selfCollections(T.meSelf)), list = [...paths.del, ...paths.priv];
        try { const s = await withTimeout(S.db.collection(bookCollection(id)).get(), 9000); for (const d of s.docs) list.push(bookCollection(id) + '/' + d.id); } catch (e) { fails.add(PART.data); }
        await Promise.all(list.map(async p => { try { await withTimeout(S.db.doc(p).delete(), 12000); } catch (e) { const c = p.split('/')[0]; fails.add(PART[c] || 'a part another section keeps'); } }));
      } else if (S.db && id) leftAccount = true;
      for (const k of localKeys(store.keys())) store.del(k);    // and once more, for anything written while that ran
      S.delNote = fails.size ? `Most of your data is deleted, but not all of it yet: ${andList([...fails])}. Try again in a moment.`
        : leftAccount ? 'What this browser kept is deleted. ' + fromHere() + ' you cannot change what is stored with your account: to delete that too, ' + TO_STEWARDS + '.'
        : S.db && id ? 'Your data is deleted. The Mahalaverse starts fresh for you. Your applications stay with the stewards: to withdraw one, ' + TO_STEWARDS + '.'
        : 'Your data is deleted. The Mahalaverse starts fresh for you.';
    } catch (e) { console.warn(e); S.delNote = 'Your data could not be deleted just now. Try again in a moment.'; }
    S.del = 'done'; S.figOpen = true; renderAll(); renderPlugins();
    // the store settles before gifts are looked at again; what the stewards keep (gifts by hand) returns quietly, unsaved
    setTimeout(() => { S.deleting = false; S.quiet = true; S.noSave = true; schedule('deleted'); }, 2500);
    setTimeout(() => { const n = $s('data').querySelector('.v7-me-done'); if (n) { n.scrollIntoView({ block: 'nearest' }); const b = n.querySelector('button'); if (b) b.focus({ preventScroll: true }); } }, 40);
  }

  /* ---------- for stewards: gifts by hand, for what the Mahalaverse cannot see ---------- */
  function stewardRender(el, me) {
    if (!el) return;
    const isLead = !!((me && me.isSteward) || S.me.isSteward || T.LIVE.admin);
    if (!isLead) { el.innerHTML = '<p class="note">Only stewards give gifts by hand.</p>'; return; }
    if (!S.db) { el.innerHTML = '<p class="note">Gifts by hand need the shared Mahalaverse, which cannot be reached from here.</p>'; return; }
    const R = rules().filter(r => r.id !== 'me-card');
    const people = new Map();
    for (const b of T.LIVE.builders || []) if (b && typeof b.id === 'string') people.set(b.id, { id: b.id, shown: typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '', card: b.card, crew: b.crew });
    for (const s of T.LIVE.signups || []) if (s && typeof s.id === 'string' && !people.has(s.id)) people.set(s.id, { id: s.id, shown: '', card: null, crew: null });
    people.delete(S.me.id);                                       // a gift by hand is for someone else
    const ids = [...people.keys()].slice(0, 400);
    const draw = prof => {
      const label = p => { const pr = prof && prof[p.id]; const nm = p.shown || (pr && pr.name) || 'A builder'; const bits = [typeof p.card === 'string' && T.ARCH_BY[p.card] ? T.ARCH_BY[p.card].title : '', typeof p.crew === 'string' && T.CREW_BY(p.crew) ? T.CREW_BY(p.crew).name : ''].filter(Boolean); return nm + (bits.length ? ' (' + bits.join(', ') + ')' : ''); };
      const who = S.steward.who && people.has(S.steward.who) ? S.steward.who : '';
      const g = S.steward.gift || (R[0] ? R[0].id : 'own'), rule = R.find(r => r.id === g);
      el.innerHTML = `<p class="v7-me-lede">For what the Mahalaverse cannot see: a meal cooked on the night, a hand on build day. The builder finds it in Your path, with your words.</p>
        ${ids.length ? `<div class="v7-me-gbf">
          <div class="field"><label for="v7-me-gb-who">For</label><select id="v7-me-gb-who"><option value="">Choose a builder</option>${ids.map(id => `<option value="${esc(id)}" ${id === who ? 'selected' : ''}>${esc(label(people.get(id)))}</option>`).join('')}</select></div>
          <div class="field"><label for="v7-me-gb-gift">The gift</label><select id="v7-me-gb-gift">${R.map(r => `<option value="${esc(r.id)}" ${r.id === g ? 'selected' : ''}>${esc(titleOf(r, {}))}</option>`).join('')}<option value="own" ${g === 'own' ? 'selected' : ''}>A thank-you of your own</option></select></div>
          ${g === 'own' ? '<div class="field"><label for="v7-me-gb-title">Its name</label><input id="v7-me-gb-title" maxlength="60" placeholder="Water bearer"></div>' : ''}
          <div class="field"><label for="v7-me-gb-why">Why it is given</label><input id="v7-me-gb-why" maxlength="160" value="${esc(rule ? whyOf(rule, {}) : '')}" aria-describedby="v7-me-gb-who-sees"></div>
          <p class="note" id="v7-me-gb-who-sees">Anyone who opens the Mahalaverse can read a gift given by hand, with your words, so write what you are happy to share.</p>
          <div class="actions"><button class="btn primary" type="button" id="v7-me-gb-give" ${who ? '' : 'disabled'}>${icon('gift')}Give it</button></div></div>
          <div id="v7-me-gb-list"></div>` : '<div class="mv-empty"><p>No builders yet. When builders join, you can give them gifts here.</p></div>'}`;
      if (who) listHand(who);
    };
    const listHand = async who => {
      const box = el.querySelector('#v7-me-gb-list'); if (!box) return;
      const d = await getDoc('giftsBy/' + who), arr = cleanHand(d && !d._error ? d : null, rules());
      box.innerHTML = arr.length ? `<h4>Given by hand to this builder</h4><div class="v7-me-rows">${arr.map(h => { const r = h.gift && rules().find(x => x.id === h.gift); return `<div class="v7-me-row v7-me-one2"><span><b>${esc(r ? titleOf(r, {}) : h.title)}</b><small>${esc(h.why)}${h.t ? ' · ' + esc(day(h.t)) : ''}</small></span><button class="btn ghost v7-me-sm" type="button" data-gb-back="${esc(h.i)}">Take it back</button></div>`; }).join('')}</div>` : '<p class="note">Nothing given by hand to this builder yet.</p>';
    };
    el.onchange = e => {
      if (e.target.id === 'v7-me-gb-who') { S.steward.who = e.target.value; draw(el._prof); const n = el.querySelector('#v7-me-gb-who'); if (n) n.focus(); }
      if (e.target.id === 'v7-me-gb-gift') { S.steward.gift = e.target.value; draw(el._prof); const n = el.querySelector('#v7-me-gb-gift'); if (n) n.focus(); }
    };
    el.onclick = async e => {
      const give = e.target.closest('#v7-me-gb-give'), back = e.target.closest('[data-gb-back]'); if (!give && !back) return;
      const who = S.steward.who; if (!who) return;
      const btn = give || back; btn.disabled = true;
      try {
        const cur = await getDoc('giftsBy/' + who); if (cur && cur._error) throw new Error('read');
        const g = cur && Array.isArray(cur.g) ? cur.g.filter(x => x && typeof x === 'object').slice(-24) : [];
        if (give) {
          const gift = S.steward.gift || (rules()[0] || {}).id, own = gift === 'own';
          const title = own ? String((el.querySelector('#v7-me-gb-title') || {}).value || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
          const why = String((el.querySelector('#v7-me-gb-why') || {}).value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
          if (own && !title) { T.toast('Give your thank-you a name first.'); btn.disabled = false; return; }
          g.push(Object.assign({ i: rid(), t: Date.now(), why, by: S.me.id || null }, own ? { title } : { gift }));
          await withTimeout(S.db.doc('giftsBy/' + who).set({ g: g.slice(-24), at: Date.now() }), 15000);
          T.toast('Given. They will find it in Your path.');
        } else {
          await withTimeout(S.db.doc('giftsBy/' + who).set({ g: g.filter(x => x.i !== back.dataset.gbBack), at: Date.now() }), 15000);
          T.toast('Taken back.');
        }
      } catch (er) { console.warn(er); T.toast(er && er.code === 'invalid_argument' ? 'Only stewards can give gifts by hand.' : 'That did not save. Try again in a moment.'); }
      btn.disabled = false; listHand(who);
    };
    draw(null);
    if (S.user && ids.length) S.user.profiles(ids).then(p => { el._prof = p; draw(p); }).catch(() => { });
  }
  ctx.steward.push({ id: 'me-gifts', title: 'Gifts by hand', order: 55, render: (el, me) => stewardRender(el, me) });

  /* ---------- what changes elsewhere, and when to look again ---------- */
  const seq = new WeakMap(); let seqN = 0; const ref = o => (o && typeof o === 'object' ? (seq.get(o) || (seq.set(o, ++seqN), seqN)) : 0);
  let sig = '';
  function signature() {
    const ME = T.ME, L = T.LIVE, V5 = T.V5 || {};
    return [ME.crew, ME.crewOk, ME.door, ME.maybe, ME.notNow, (ME.book || []).length, ME.lines, Object.keys(ME.quests || {}).join(), Object.keys(ME.notify || {}).join(), T.DKX.kept,
      ref(L.hearth), ref(L.confirm), ref(L.builders), ref(V5.sounds), ref(V5.shifts), (V5.mySounds || []).length, (V5.myShifts || []).join(), L.uid, L.write, L.admin].join('|');
  }
  // each part is drawn again only when what it shows has changed, so a control is never replaced for nothing
  const PART_SIG = {
    who: () => [T.DKX.kept, T.ME.crew, !!S.state.crewConfirmed, !!T.ME.show, modeLine().t, S.me.isSteward].join('|'),
    figure: () => [T.DKX.kept, mode(), canSave(), [...unlockedSet()].sort().join()].join('|'),
    book: () => [(T.ME.book || []).length, (T.ME.book || []).filter(e => e && e.fire).length, T.ME.gate, T.DKX.kept].join('|'),
    apps: () => [ref(S.signup), ref(T.LIVE.confirm), ref(S.apps), T.ME.door, T.ME.maybe, T.ME.notNow, Object.keys(T.ME.notify || {}).join(), T.ME.crew, canSave()].join('|'),
    camp: () => [cleanShifts(myShiftKeys()).join(), (mySounds() || []).map(x => x && [x.url, x.local, x.st && x.st.s].join()).join()].join('|'),
    quests: () => Object.keys(T.ME.quests || {}).join(),
  };
  const partSeen = {};
  function notePartsSeen() { for (const k of Object.keys(PART_SIG)) { try { partSeen[k] = PART_SIG[k](); } catch (e) { } } }
  let beat = 0;
  setInterval(() => {
    const s = signature(); const first = !sig; const moved = s !== sig; sig = s;
    if (moved) followCard();
    // every 15 seconds the gifts are looked at again, and the other parts asked again once their answer is 20 seconds old,
    // so a gift from what they hold (a set a steward approved since) comes even when no event says so
    if (++beat % 15 === 0 && !S.deleting && document.visibilityState !== 'hidden') schedule('beat');
    const br = ref(T.LIVE.builders); if (br !== S.bRef) { S.bRef = br; publishOutfits(); }   // the cards builders show decide the emblems their figures wear
    if (moved && !first) schedule('watch');
    if (!S.open) return;
    for (const k of Object.keys(PART_SIG)) { let v = ''; try { v = PART_SIG[k](); } catch (e) { } if (partSeen[k] !== v) { const was = partSeen[k]; partSeen[k] = v; if (was !== undefined) render(k); } }
  }, 1000);
  ctx.bus.on('application:answered', () => { if (S.open) render('apps'); });
  for (const n of ['contrib:reviewed', 'contrib:added', 'pledge:made', 'pledge:paid', 'seed:planted', 'seed:removed', 'idea:added']) ctx.bus.on(n, d => {
    const mine = mineEvt(d), own = d == null || mine || (d && typeof d === 'object' && !('uid' in d) && !('owner' in d));
    if (n === 'seed:planted' && own) S.bus.seeds = Math.max(S.bus.seeds, 1);
    if (n === 'idea:added' && own) { S.bus.ideas = Math.max(S.bus.ideas, 1); if (d && d.built) S.bus.ideasBuilt = Math.max(S.bus.ideasBuilt, 1); }
    if (n === 'pledge:paid' && mine) S.bus.paid = Math.max(S.bus.paid, 1);
    if (n === 'contrib:reviewed' && mine && d && (d.s === 'ok' || d.ok === true) && typeof d.kind === 'string' && /^[a-z]{2,12}$/.test(d.kind)) S.bus.contrib[d.kind] = Math.max(S.bus.contrib[d.kind] || 0, 1);
    schedule(n, true);
    if (S.open) renderPlugins();
  });
  ctx.bus.on('auth:changed', () => { refreshMe(); });
  ctx.bus.on('ready', () => { schedule('ready', true); if (S.open) renderPlugins(); });

  /* ---------- start: draw the top bar now, reach the store in the background ---------- */
  publishOutfits(); refreshWho();
  (async () => {
    try { await withTimeout(P.ready, 11000); } catch (e) { }
    await refreshMe();
    try { if (typeof P.onAuth === 'function') P.onAuth(() => { refreshMe(); }); } catch (e) { }
    schedule('boot', true);
  })();

  const api = { open: openPanel, close: closePanel, state: () => ({ open: S.open, me: Object.assign({}, S.me), avatar: Object.assign({}, S.avatar), got: JSON.parse(JSON.stringify(S.got)), hand: S.hand.slice(), gift: S.state, unseen: unseen(), readOnly: S.readOnly, mode: mode(), figOpen: !!S.figOpen }),
    rules: () => rules().map(r => ({ id: r.id, kind: r.kind, title: titleOf(r, S.state), unlocks: (r.unlocks || []).slice() })), evaluate: () => runEval(), setAvatar };
  ctx.me = api;
  return api;
}

/* the platform plugin's contract, from window.claude, for when that plugin is not here (tests, or an older build) */
function fallbackPlatform() {
  const C = window.claude, has = !!(C && typeof C.use === 'function'), memo = {};
  const use = name => { if (!has) return Promise.resolve(null); if (!memo[name]) memo[name] = Promise.resolve().then(() => C.use(name)).catch(() => null); return memo[name]; };
  const ready = has ? Promise.race([use('db'), wait(10000)]).then(() => { }, () => { }) : Promise.resolve();
  const me = async () => {
    const [db, u] = await Promise.all([use('db'), use('user')]);
    if (!u) return { id: null, name: '', signedIn: false, canWrite: false, isSteward: false, isOwner: false, guest: false };
    let v = {}, w = null, edit = false; try { v = await u.me(); } catch (e) { } try { w = await u.can('data.write'); } catch (e) { } try { edit = await u.canEdit(); } catch (e) { }
    return { id: v.id || null, name: v.name || '', signedIn: !!v.id, canWrite: !!(db && v.id && w !== false), isSteward: !!edit, isOwner: !!v.isOwner, guest: false };
  };
  return { mode: has ? (C.__standalone === true ? 'standalone' : 'claude') : 'solo', ready, use, me, onAuth: () => () => { }, signIn() { }, signOut() { } };
}
const cv = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function hexOf(c) {   // any CSS colour the platform gives, as #RRGGBB
  if (typeof c !== 'string' || !c || c.length > 64) return null;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  try { cv.fillStyle = '#000000'; cv.fillStyle = c; const v = String(cv.fillStyle); if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v); if (m) return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase(); } catch (e) { }
  return null;
}

const STYLE = `
/* v7 me: Your path, the personal dashboard. Every size is a step of the house type scale (--fs-* and --lh-* on :root, in
   v5's stylesheet), the empty and recap states are the house ones (mv-empty, mv-summary), and there is one focus ring: 2px
   of cyan, 2px off the control */
.v7-me-panel { position: absolute; top: calc(76px + env(safe-area-inset-top, 0px)); right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); width: min(640px, calc(100% - 420px)); z-index: 12;
  display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--card-line); border-radius: 18px; box-shadow: var(--shadow); color: var(--ink); font-size: var(--fs-l); line-height: var(--lh-body);
  background: linear-gradient(var(--card-strong), var(--card-strong)), var(--ground); }   /* opaque: the card's own colour over the ground, so nothing shows through the words */
.v7-me-panel[hidden] { display: none !important; }
.v7-me-panel :focus-visible, .v7-me-gtoast :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-me-topbar { flex: none; border-bottom: 1px solid var(--card-line); }
.v7-me-bar { display: flex; align-items: center; gap: 10px; padding: 10px 10px 2px 22px; }
.v7-me-ttl { margin: 0; flex: 1; font-size: var(--fs-xs); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); font-weight: 500; font-family: var(--ui); }
.v7-me-panel .v7-me-ttl:focus, .v7-me-panel .v7-me-ttl:focus-visible { outline: none; }   /* the title takes focus when the panel opens, for screen readers; it is not a control */
.v7-me-jump { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 18px 10px; }
.v7-me-jump::-webkit-scrollbar { display: none; }
.v7-me-jump button { flex: none; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--card-line); background: none; color: var(--ink-2); font: inherit; font-size: var(--fs-m); cursor: pointer; }
.v7-me-jump button:hover { background: var(--hover); color: var(--ink); }
.v7-me-body { flex: 1; min-height: 0; overflow: auto; padding: 0 22px 28px; overscroll-behavior: contain; }
.v7-me-sect { display: grid; gap: 12px; padding: 22px 0 10px; min-width: 0; scroll-margin-top: 6px; }
.v7-me-sect + .v7-me-sect, #v7-me-plugins > .v7-me-sect, #v7-me-plugins + .v7-me-sect { border-top: 1px solid var(--card-line); margin-top: 12px; }
.v7-me-sect[hidden] { display: none; }
.v7-me-sh { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.v7-me-sh h3 { margin: 0; flex: 1; min-width: 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3); line-height: var(--lh-display); }
.v7-me-sect h3:focus:not(:focus-visible) { outline: none; }
.v7-me-sect h4 { margin: 4px 0 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); color: var(--ink); }
.v7-me-sect p { margin: 0; }
.v7-me-lede { color: var(--ink-2); font-size: var(--fs-l); line-height: var(--lh-body); }
.v7-me-sect .note { font-size: var(--fs-s); color: var(--ink-2); }
.v7-me-sm { height: 34px; padding: 0 13px; font-size: var(--fs-m); }
.v7-me-acts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.v7-me-acts.v7-me-mid { justify-content: center; gap: 8px; }
.v7-me-link { border: 0; background: none; padding: 0; font: inherit; color: var(--ink); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.v7-me-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; margin: -1px; padding: 0; border: 0; }
.v7-me-panel .mv-empty p + .btn, .v7-me-panel .mv-empty p + .v7-me-acts { margin-top: 10px; }
.v7-me-panel .mv-empty .v7-me-acts .btn { margin-top: 0; }
/* who you are: your figure in an arched doorway, your name, the card you kept and your crew */
.v7-me-id { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: start; }
.v7-me-arch { width: 86px; height: 124px; border-radius: 43px 43px 14px 14px; overflow: hidden; display: grid; place-items: end center; padding: 0; cursor: pointer; border: 0;
  background: linear-gradient(180deg, rgba(255, 216, 31, .38), rgba(20, 168, 224, .18) 55%, rgba(216, 25, 127, .2)); box-shadow: inset 0 0 0 1px var(--card-line); }
.v7-me-arch:hover { box-shadow: inset 0 0 0 1px var(--ink-3); }
.v7-me-arch svg { width: 78px; height: 125px; display: block; margin-bottom: -3px; }
.v7-me-idt { min-width: 0; display: grid; gap: 4px; }
.v7-me-nml { font-size: var(--fs-xs); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); font-weight: 500; }
.v7-me-nmrow { display: flex; align-items: center; gap: 6px; min-width: 0; border-bottom: 1px dashed var(--ink-3); }
.v7-me-nmrow:focus-within { border-bottom: 1px solid var(--ink); outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 6px 6px 0 0; }   /* the one ring, around the name as you type it */
.v7-me-panel .v7-me-nm { flex: 1; min-width: 0; width: 100%; height: 44px; border: 0; background: none; padding: 0; color: var(--ink); font-family: var(--display); font-size: var(--fs-h2); line-height: var(--lh-display); outline: none; text-overflow: ellipsis; }
.v7-me-nm::placeholder { color: var(--ink-3); opacity: 1; }
.v7-me-pen { color: var(--ink-3); flex: none; display: grid; } .v7-me-pen .i { width: 16px; height: 16px; }
.v7-me-show { display: flex; align-items: center; gap: 9px; min-height: 36px; margin-top: 4px; cursor: pointer; font-size: var(--fs-m); color: var(--ink); width: fit-content; }
.v7-me-show input { width: 18px; height: 18px; margin: 0; accent-color: var(--ink); flex: none; }
.v7-me-showh { font-size: var(--fs-s); color: var(--ink-2); margin-top: -4px !important; padding-left: 27px; }
.v7-me-nmh { font-size: var(--fs-s); color: var(--ink-2); margin-top: 2px !important; }
.v7-me-mode { font-size: var(--fs-s); color: var(--ink-2); line-height: var(--lh-body); margin-top: 6px !important; }
.v7-me-modeact { margin-top: 4px; }
.v7-me-tiles2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 6px; }
.v7-me-tb { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; }
.v7-me-tbx { display: grid; gap: 3px; min-width: 0; }
.v7-me-tbx p { font-size: var(--fs-m); color: var(--ink-2); line-height: var(--lh-body); }
.v7-me-tbx .v7-me-acts { margin-top: 6px; }
.v7-me-tbt { font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); }
.v7-me-cap { font-family: var(--display); font-style: italic; font-size: var(--fs-l); color: var(--ink-2); line-height: var(--lh-display); }
.v7-me-frame { font-size: var(--fs-s) !important; color: var(--ink-2); margin-top: 4px !important; }
.v7-me-cardbtn { padding: 0; border: 0; background: none; cursor: pointer; border-radius: 7px; }
.v7-me-cardimg { width: 54px; height: 78px; border-radius: 7px; object-fit: cover; display: block; box-shadow: 0 0 0 1.5px #B87333, 0 4px 10px rgba(0, 0, 0, .22); }
.v7-me-ic { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--card-strong); color: var(--ink-2); flex: none; box-shadow: inset 0 0 0 1px var(--card-line); }
.v7-me-rows .v7-me-ic { background: var(--hover); box-shadow: none; }
.v7-me-rows { display: grid; }
.v7-me-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 0; border-top: 1px solid var(--card-line); }
.v7-me-row:first-child { border-top: 0; }
.v7-me-row.v7-me-top { align-items: start; }
.v7-me-row.v7-me-one, .v7-me-row.v7-me-one2 { grid-template-columns: minmax(0, 1fr) auto; }
.v7-me-row b { font-weight: 500; display: block; font-size: var(--fs-l); }
.v7-me-row small { display: block; color: var(--ink-2); font-size: var(--fs-m); line-height: var(--lh-body); margin-top: 1px; }
.v7-me-row .chip { justify-self: end; }
.v7-me-links { display: grid; gap: 6px; margin: 6px 0 4px; }
.v7-me-links a { color: var(--ink); text-decoration: none; display: grid; border-radius: 4px; }
.v7-me-links a:hover { text-decoration: underline; }
.v7-me-links a small { margin: 0; color: var(--ink-3); font-size: var(--fs-s); }
/* your figure: a preview beside the choices, with the save line under it */
.v7-me-fig { display: grid; grid-template-columns: 134px minmax(0, 1fr); gap: 16px; align-items: start; }
.v7-me-prev { position: sticky; top: 8px; z-index: 2; display: grid; gap: 8px; justify-items: center; padding: 12px 8px 10px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 216, 31, .22), rgba(20, 168, 224, .1) 55%, rgba(216, 25, 127, .12)), var(--card-strong); box-shadow: inset 0 0 0 1px var(--card-line); }
.v7-me-prevart svg { width: 104px; height: 166px; display: block; }
.v7-me-prevt { display: grid; gap: 4px; min-width: 0; }
.v7-me-desc { font-size: var(--fs-s); color: var(--ink-2); text-align: center; line-height: var(--lh-body); }
.v7-me-prev .v7-me-status { font-size: var(--fs-xs); color: var(--ink-3); text-align: center; line-height: var(--lh-display); }
.v7-me-opts { display: grid; gap: 16px; min-width: 0; }
.v7-me-fs { border: 0; padding: 0; margin: 0; min-width: 0; }
.v7-me-fs legend { padding: 0; margin: 0 0 8px; font-size: var(--fs-m); color: var(--ink-2); font-weight: 500; }
.v7-me-sw { display: flex; flex-wrap: wrap; gap: 9px; }
.v7-me-swl { position: relative; width: 34px; height: 34px; display: block; }
.v7-me-swl input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.v7-me-swl span { display: block; width: 100%; height: 100%; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .14); pointer-events: none; }
.v7-me-swl input:checked + span { box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .14), inset 0 0 0 3px var(--card-strong), inset 0 0 0 5px var(--ink); }
.v7-me-swl input:focus-visible + span { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-me-own { margin-right: 6px; }
.v7-me-own span { box-shadow: inset 0 0 0 3px var(--card-strong), inset 0 0 0 4px rgba(0, 0, 0, .14); }
.v7-me-own input:checked + span { box-shadow: inset 0 0 0 3px var(--card-strong), inset 0 0 0 5px var(--ink); }
.v7-me-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
.v7-me-opts .v7-me-tiles { grid-template-columns: repeat(var(--n, 5), minmax(0, 1fr)); gap: 7px; }
.v7-me-tile { position: relative; display: block; cursor: pointer; }
.v7-me-tile input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.v7-me-tile input:disabled { cursor: default; }
.v7-me-tbox { display: grid; justify-items: center; align-content: start; gap: 2px; padding: 6px 4px 8px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--hover); color: var(--ink-2); font-size: var(--fs-s); line-height: var(--lh-display); text-align: center; height: 100%; }
.v7-me-tart svg { width: 56px; height: 56px; display: block; }
.v7-me-tile input:checked + .v7-me-tbox { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); color: var(--ink); background: var(--card-strong); }
.v7-me-tile input:focus-visible + .v7-me-tbox { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-me-tile:hover input:not(:disabled) + .v7-me-tbox { border-color: var(--ink-3); }
.v7-me-locked .v7-me-tbox { background: none; border-style: dashed; }
.v7-me-locked .v7-me-tart, .v7-me-locked .v7-me-tname { opacity: .55; }
.v7-me-lock { position: absolute; top: 5px; right: 5px; color: var(--ink-3); }
.v7-me-lock .i { width: 13px; height: 13px; }
.v7-me-with { font-size: var(--fs-xs); color: var(--ink-2); line-height: var(--lh-display); }
.v7-me-embn { margin-top: 8px !important; }
.v7-me-how { padding: 10px 14px; border-radius: 12px; background: var(--hover); font-size: var(--fs-m); color: var(--ink-2); }
.v7-me-how summary { cursor: pointer; color: var(--ink-2); font-weight: 500; min-height: 24px; border-radius: 6px; }
.v7-me-how ul { margin: 8px 0 0; padding-left: 18px; display: grid; gap: 3px; }
.v7-me-status:empty { display: none; }
/* your gifts: a shelf of medallions; each opens to the story of why it came */
.v7-me-shelf { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.v7-me-tok { position: relative; width: 100%; height: 100%; display: grid; justify-items: center; align-content: start; gap: 7px; padding: 12px 6px 10px; border-radius: 14px; border: 1px solid transparent; background: none; color: var(--ink); font: inherit; font-size: var(--fs-m); line-height: var(--lh-display); text-align: center; cursor: pointer; }
.v7-me-tok:hover { background: var(--hover); }
.v7-me-tok[aria-expanded="true"] { background: var(--hover); border-color: var(--card-line); }
.v7-me-tokt { overflow-wrap: anywhere; }
.v7-me-newdot { position: absolute; top: 9px; right: calc(50% - 34px); width: 10px; height: 10px; border-radius: 50%; background: var(--magenta); box-shadow: 0 0 0 2px var(--card-strong); }
/* one medallion for every gift: a 3px ring and a tint in the gift's tone. The three colours of The Seed only for the gifts
   tied to The Seed; the card you kept in a ring of its own colour; a piece for your figure as the piece itself */
.v7-me-emb { --tone: #B87333; --tone-ink: #9A5B26; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--tone); }
.v7-me-emb > span { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; background: color-mix(in srgb, var(--tone) 17%, var(--card-strong)); color: var(--tone-ink); }
.v7-me-emb .i { width: 22px; height: 22px; }
.v7-me-emb [data-art] svg { width: 34px; height: 34px; display: block; }
.v7-me-emb[data-tone="sun"] { --tone: #E8B90C; --tone-ink: var(--yellow-ink); } .v7-me-emb[data-tone="fire"] { --tone: #E0862A; --tone-ink: var(--now); }
.v7-me-emb[data-tone="sky"] { --tone: #14A8E0; --tone-ink: var(--cyan-ink); } .v7-me-emb[data-tone="protea"] { --tone: #D8197F; --tone-ink: var(--magenta-ink); }
.v7-me-emb[data-tone="copper"] { --tone: #B87333; --tone-ink: #9A5B26; } .v7-me-emb[data-tone="bush"] { --tone: #4E8A4A; --tone-ink: var(--done); }
body.sky-night .v7-me-emb[data-tone="copper"] { --tone-ink: #E2A66B; }
.v7-me-emb[data-tone="seed"] { background: conic-gradient(var(--yellow) 0 33%, var(--cyan) 0 66%, var(--magenta) 0); }
.v7-me-emb[data-tone="seed"] > span { background: color-mix(in srgb, var(--yellow) 12%, var(--card-strong)); color: var(--ink); }
.v7-me-emb.v7-me-card > span { background: var(--card-strong); }
.v7-me-emb.v7-me-card img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; display: block; }
.v7-me-emb.v7-me-big { width: 72px; height: 72px; } .v7-me-emb.v7-me-big > span { width: 66px; height: 66px; } .v7-me-emb.v7-me-big .i { width: 28px; height: 28px; } .v7-me-emb.v7-me-big [data-art] svg { width: 44px; height: 44px; }
.v7-me-emb.v7-me-mini { width: 28px; height: 28px; } .v7-me-emb.v7-me-mini > span { width: 24px; height: 24px; } .v7-me-emb.v7-me-mini .i { width: 14px; height: 14px; } .v7-me-emb.v7-me-mini [data-art] svg { width: 17px; height: 17px; }
.v7-me-gd { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; align-items: start; }
.v7-me-gd[hidden] { display: none; }
.v7-me-gdt { display: grid; gap: 4px; min-width: 0; }
.v7-me-gdt h4 { margin: 0 !important; font-size: var(--fs-h3) !important; }
.v7-me-why { font-family: var(--display); font-size: var(--fs-xl); line-height: var(--lh-body); color: var(--ink); }
.v7-me-when { color: var(--ink-3); font-size: var(--fs-s); }
.v7-me-brought { font-size: var(--fs-m); color: var(--ink-2); margin-top: 6px !important; }
/* the gift's own toast: the game's toast, with the gift's medallion and a way to it */
.toast.v7-me-gtoast { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 10px; white-space: normal; text-align: left; width: max-content; max-width: min(560px, calc(100% - 32px)); font-size: var(--fs-m); line-height: var(--lh-display); }
.toast.v7-me-gtoast.v7-me-lift:not(.hide) { transform: translate(-50%, var(--v7-me-up, -54px)); }
.v7-me-gtm { display: flex; flex: none; }
.v7-me-gtm .v7-me-emb + .v7-me-emb { margin-left: -9px; box-shadow: 0 0 0 2px var(--card-strong); }
.v7-me-gtt { min-width: 0; }
.v7-me-gtoast .btn.v7-me-gtb { flex: none; height: 30px; padding: 0 12px; border-radius: 999px; font-size: var(--fs-s); }
/* your book */
.v7-me-priv { gap: 5px; } .v7-me-priv::before { display: none; } .v7-me-priv .i { width: 12px; height: 12px; }
.v7-me-stage { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
.v7-me-stage .field { flex: 1 1 240px; min-width: 0; }
.v7-me-stage select { width: 100%; }
.v7-me-group { display: grid; gap: 8px; }
.v7-me-entry .v7-me-pr { font-family: var(--ui); font-size: var(--fs-m); font-style: italic; color: var(--ink-3); }
.v7-me-entry .actions { margin-top: 4px; }
.v7-me-more summary { cursor: pointer; color: var(--ink-2); font-size: var(--fs-m); margin: 6px 0; border-radius: 6px; }
/* your data */
.v7-me-panel .btn.v7-me-danger { color: var(--magenta-ink); border-color: rgba(216, 25, 127, .32); }
.v7-me-panel .btn.v7-me-danger:hover { background: rgba(216, 25, 127, .08); }
.v7-me-confirm .btn.v7-me-danger { background: var(--magenta-ink); color: #fff; border-color: transparent; }
.v7-me-confirm .btn.v7-me-danger:hover { opacity: .9; background: var(--magenta-ink); }
.v7-me-confirm { display: grid; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(216, 25, 127, .38); background: rgba(216, 25, 127, .05); }
.v7-me-confirm h4 { margin: 0; } .v7-me-confirm h4:focus { outline: none; }
.v7-me-done { display: grid; gap: 10px; }
.v7-me-sub2 { display: grid; gap: 10px; }
.v7-me-gbf { display: grid; gap: 10px; margin-top: 12px; }
#v7-me-gb-list { margin-top: 14px; display: grid; gap: 6px; }
.v7-me-gbf select, .v7-me-stage select { height: 42px; border-radius: 10px; border: 1px solid var(--card-line); background: var(--ground); padding: 0 10px; color: var(--ink); font: inherit; }
/* the top bar: your figure in the avatar, and a soft glow while a gift is waiting */
.avatar.v7-me-av #avatarTxt { overflow: hidden; background: var(--card-strong); }
.avatar.v7-me-av #avatarTxt svg { width: 28px; height: 28px; display: block; border-radius: 50%; }
.avatar.v7-me-new { box-shadow: 0 0 0 3px rgba(255, 216, 31, .45), 0 0 14px 4px rgba(216, 25, 127, .35); animation: v7-me-glow 2.6s ease-in-out 3; }
@keyframes v7-me-glow { 50% { box-shadow: 0 0 0 4px rgba(20, 168, 224, .5), 0 0 20px 7px rgba(255, 216, 31, .45); } }
#menuBtn.v7-me-new::after, #youBtn.v7-me-new::after { content: ""; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--magenta); box-shadow: 0 0 0 2px var(--card-strong); }
.v7-me-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--magenta); margin-left: auto; }
/* the way bar steps aside for the panel on a wide screen, and rests under it on a narrower one */
@media (min-width: 1281px) { body.v7-me-open:not(.inside):not(.arrival) .waybar { left: 16px; transform: none; transition: opacity .35s; } body.v7-me-shut .waybar { transition: opacity .35s; } }
@media (max-width: 1280px) and (min-width: 761px) { body.v7-me-open .waybar { opacity: 0; pointer-events: none; } .v7-me-panel { width: min(580px, calc(100% - 400px)); } }
@media (max-width: 1100px) and (min-width: 761px) { .v7-me-fig { grid-template-columns: minmax(0, 1fr); } .v7-me-prev { grid-template-columns: auto minmax(0, 1fr); justify-items: start; align-items: center; } .v7-me-prevart svg { width: 64px; height: 102px; } .v7-me-desc, .v7-me-prev .v7-me-status { text-align: left; } .v7-me-tiles2 { grid-template-columns: minmax(0, 1fr); } }
/* the phone: a full-height sheet, with targets a thumb can find */
@media (max-width: 760px) {
  .v7-me-panel { inset: 0; width: auto; border-radius: 0; border: 0; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  .v7-me-bar { padding: 4px 6px 0 16px; }
  .v7-me-panel .v7-me-x { width: 44px; height: 44px; }
  .v7-me-jump { padding: 2px 12px 8px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent); mask-image: linear-gradient(90deg, #000 88%, transparent); }
  .v7-me-jump::-webkit-scrollbar { display: none; }
  .v7-me-jump button { height: 44px; padding: 0 14px; }
  .v7-me-jump button:last-child { margin-right: 28px; }
  .v7-me-body { padding: 0 16px 28px; }
  .v7-me-id { gap: 12px; }
  .v7-me-arch { width: 64px; height: 96px; border-radius: 32px 32px 12px 12px; } .v7-me-arch svg { width: 60px; height: 97px; }
  .v7-me-panel .v7-me-nm { font-size: var(--fs-h3); }     /* the whole placeholder fits a phone's width */
  .v7-me-pen { display: none; }
  .v7-me-show { min-height: 44px; margin-top: 0; }
  .v7-me-tiles2 { grid-template-columns: minmax(0, 1fr); }
  .v7-me-sm, .v7-me-panel .btn { min-height: 44px; }
  .v7-me-fig { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .v7-me-prev { top: 0; grid-template-columns: auto minmax(0, 1fr); justify-items: start; align-items: center; padding: 8px 14px 8px 8px; }   /* the figure stays in view while you dress it */
  .v7-me-prevart svg { width: 60px; height: 96px; } .v7-me-desc, .v7-me-prev .v7-me-status { text-align: left; }
  .v7-me-sw { gap: 10px; } .v7-me-swl { width: 44px; height: 44px; }
  .v7-me-panel .prompts { grid-template-columns: 1fr; }
  .v7-me-shelf { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  .v7-me-gd { grid-template-columns: minmax(0, 1fr); justify-items: start; }
  .v7-me-tiles, .v7-me-opts .v7-me-tiles { grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 8px; }
  .v7-me-row { grid-template-columns: auto minmax(0, 1fr); }
  .v7-me-row > .btn, .v7-me-row > .v7-me-acts, .v7-me-row > .chip { grid-column: 2; justify-self: start; }
  .v7-me-row.v7-me-one2 > .btn { grid-column: auto; }
  .v7-me-how summary, .v7-me-more summary { min-height: 44px; display: flex; align-items: center; }
  .v7-me-panel select { height: 44px !important; }
  .v7-me-links a { min-height: 44px; align-content: center; }
  .v7-me-gtoast .btn.v7-me-gtb { height: 44px; padding: 0 14px; }
  body.v7-me-open #tg, body.v7-me-open .tg-call, body.v7-me-open .tg-notice, body.v7-me-open .tg-pop, body.v7-me-open .tg-tag, body.v7-me-open .tg-say { display: none !important; }
}
@media (max-width: 374px) { .v7-me-panel .v7-me-nm { font-size: var(--fs-xl); } }
@media (prefers-reduced-motion: reduce) { .avatar.v7-me-new { animation: none; } }
`;
