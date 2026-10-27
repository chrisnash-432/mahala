/* The co plugin: what people make and offer in the Mahalaverse, the co-creation loop, and the stewards' tools.

   Offer something   a soul journey reflection (private by default, in the person's own book; "Share it at the fire"
                     sends a copy for a steward to read), a poem or a story for the fire, digital art (an upload or an
                     https link, a title, a line, an optional credit), a music set for the main tent (its own store,
                     sounds/<uid>), a sound journey recording for the Lotus Mahal. What is shared waits for a steward.
   Ideas for the Mahalaverse   anyone who can write proposes an idea; others add one heart each and a short reply;
                     stewards give each idea a state and a note; "You asked, we built" lists what was built.
   The stewards' tools   one panel for stewards: offerings to read, the lines at the fire, ideas, applications,
                     the camp lead tools the game already had, and every section other plugins add to ctx.steward.
   The data model and its checks live in model.js (tested in node), the look in css.js, the doors into the game in
   patch_v7_co.py. Everything read from the shared store is untrusted: it is escaped, links are https only, and images
   come only from the artifact's own asset store, through <img> (or a texture drawn from one). */
import * as C from './model.js';
import { CSS as STYLE } from './css.js';

const COLS = ['contrib', 'review', 'answer', 'shown', 'ideas', 'support', 'replies', 'ideaState'];
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.6-4.7-7.6-10.3A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.6 2.5C19.6 15.3 12 20 12 20z"/></svg>';
const wait = ms => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), wait(ms).then(() => { throw Object.assign(new Error('timeout'), { code: 'timeout' }); })]);

export async function start(M, ctx) {
  const V = M.v7; if (!V || !M.HOOK7) return null;
  const H7 = M.HOOK7, esc = M.esc, icon = M.icon, toast = M.toast;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CARDS = V.ARCH_BY, ARCH = V.ARCH;
  const chip = (t, tone = '') => `<span class="chip ${tone}">${esc(t)}</span>`;
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  function ago(t) {
    const s = (Date.now() - t) / 1000; if (!t || s < 0) return '';
    if (s < 50) return 'just now'; if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 172800) return 'yesterday';
    return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: s > 300 * 86400 ? 'numeric' : undefined });
  }
  const day = t => (t ? new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '');

  /* ---------- the look: after the game's own styles, so equal selectors resolve to ours ---------- */
  if (!document.getElementById('v7-co-css')) { const st = document.createElement('style'); st.id = 'v7-co-css'; st.textContent = STYLE; document.body.appendChild(st); }

  /* ---------- who is here, and how the data is reached (the platform plugin, or the runtime itself) ---------- */
  const S = {
    db: null, user: null, mode: 'solo', connected: false, gen: 0, unsubs: [], got: {}, readOnly: false,
    me: { id: null, name: '', signedIn: false, canWrite: false, isSteward: false, isOwner: false },
    contrib: {}, review: {}, answer: {}, shown: {}, ideas: {}, support: {}, replies: {}, ideaState: {}, prof: {},
    assets: null, sample: null, sum: null, last: new Map(), lastIdea: new Map(), watch: false,
  };
  const P = () => ctx.platform || null;
  async function use(name) {
    try { const p = P(); if (p && typeof p.use === 'function') return (await p.use(name)) || null;
      const c = window.claude; return c && typeof c.use === 'function' ? (await c.use(name)) || null : null; } catch (e) { return null; }
  }
  const modeNow = () => (P() && P().mode) || (window.claude && typeof window.claude.use === 'function' ? 'claude' : 'solo');
  async function whoAmI() {
    const p = P();
    if (p && typeof p.me === 'function') {
      try { const m = await p.me(); if (m) return { id: m.id || null, name: m.name || '', signedIn: !!m.signedIn, canWrite: m.canWrite !== false, isSteward: !!m.isSteward, isOwner: !!m.isOwner }; } catch (e) { }
    }
    const u = S.user; let id = null, steward = false, w = null, owner = false;              // no platform plugin: ask the runtime itself
    if (u) { try { id = await u.id(); } catch (e) { } try { steward = !!(await u.canEdit()); } catch (e) { } try { w = await u.can('data.write'); } catch (e) { } try { owner = !!(await u.isOwner()); } catch (e) { } }
    return { id, name: '', signedIn: !!id, canWrite: !!id && w !== false, isSteward: steward, isOwner: owner };
  }
  const myId = () => S.me.id || null;
  const canShare = () => !!(S.db && S.me.id && S.me.canWrite && !S.readOnly && V.LIVE.write !== false);
  const isSteward = () => !!(S.db && S.me.id && S.me.isSteward);
  const CAMP_MAIL = 'wearemahala@gmail.com';     // the camp's own address (the camp page and the sign-in sheet use it), shown as text, never a mailto link
  const TO_CAMP = 'To take part, write to the camp at ' + CAMP_MAIL + '.', TO_STEWARDS = 'Write to the stewards at ' + CAMP_MAIL + '.';
  function why(what = 'offer your work') {                         // why this viewer cannot write here, in words; null when they can
    if (canShare()) return null;
    if (!S.connected) return 'Reaching the shared Mahalaverse. One moment.';
    if (S.mode === 'standalone' && !S.me.id) return `Sign in to ${what}.`;
    if (S.mode === 'solo' && !S.db) return `This copy of the page is not connected to the shared Mahalaverse, so you cannot ${what} here.`;
    return `You can look around ${S.mode === 'claude' ? 'from this link' : 'here'}, but not ${what} yet. ${TO_CAMP}`;
  }
  const signInOffer = () => S.mode === 'standalone' && !S.me.id && P() && typeof P().signIn === 'function';
  function stateLine(what, extra = '') {
    const w = why(what); if (!w) return '';
    return `<div class="v7-co-state" role="status">${icon(S.db ? 'lock' : 'users')}<span>${esc(w)}${extra ? ' ' + esc(extra) : ''}</span>${signInOffer() ? '<button class="btn v7-co-sm" type="button" data-co="signin">Sign in</button>' : ''}</div>`;
  }
  const coming = col => !!S.db && !S.got[col];                       // still on its way: the first answer from the store has not come
  const noStore = what => (S.mode === 'solo' ? `${what.replace(/^./, c => c.toUpperCase())} live in the shared Mahalaverse, which this copy of the page cannot reach.` : `Only people signed in to the shared Mahalaverse can see ${what}.`);
  const whoLine = t => `<p class="v7-co-who">${icon('eye')}<span>${esc(t)}</span></p>`;
  // names: only the name a person chose to show (builders/<uid>.name is set only with "Show my name"); never the account name
  const nameOf = uid => { const b = (V.LIVE.builders || []).find(x => x && x.id === uid); return b && typeof b.name === 'string' ? C.clean(b.name, 40, true) : ''; };
  const myName = () => (V.ME.show && V.ME.name ? C.clean(V.ME.name, 40, true) : '');
  const byOf = uid => (uid && uid === myId() ? (myName() ? myName() + ' (you)' : 'You') : nameOf(uid) || 'A builder');            // a person (ideas, replies)
  const creditOf = uid => (uid && uid === myId() ? (myName() ? myName() + ' (you)' : 'You') : nameOf(uid) || 'A camp mate');     // the public credit on work
  const shownAs = () => (myName() ? `as ${myName()}` : 'without your name');

  /* ---------- the shared store: one subscription per collection, one write at a time per document ---------- */
  async function connect() {
    const gen = ++S.gen, p = P();
    if (p && p.ready) { try { await Promise.race([p.ready, wait(12000)]); } catch (e) { } }
    S.mode = modeNow();
    const [db, user] = await Promise.all([use('db'), use('user')]); if (gen !== S.gen) return;
    S.db = db; S.user = user; S.me = await whoAmI(); if (gen !== S.gen) return;
    if (S.ownFeeds) { S.ownFeeds = false; V.LIVE.admin = false; if (!isSteward()) { V.LIVE.fire = []; V.LIVE.signups = []; } }
    S.unsubs.forEach(f => { try { f(); } catch (e) { } }); S.unsubs = []; S.got = {}; S.watch = false; S.last = new Map(); S.lastIdea = new Map(); S.readOnly = false;
    for (const k of COLS) S[k] = {};
    if (db) {
      for (const col of COLS) {
        try {
          S.unsubs.push(db.collection(col).onSnapshot(snap => {
            const o = {}; for (const d of snap.docs) { const v = d.data(); if (v && typeof v === 'object') o[d.id] = v; }
            S[col] = o; S.got[col] = true; changed(col);
          }, () => { S.got[col] = 'error'; changed(col); }));
        } catch (e) { console.warn('co: cannot subscribe to', col, e && e.code); }
      }
      if (isSteward()) stewardFeeds();
    }
    S.assets = canShare() ? await use('assets') : null;              // null where this viewer may not upload
    S.sample = isSteward() && S.mode === 'claude' ? await use('sample') : null;
    S.connected = true; changed('all', true);
    setTimeout(() => { if (gen === S.gen) { S.watch = true; noteStatuses(true); } }, 5000);
  }
  // a steward who signed in after the page loaded: the game's own steward feeds (the fire's lines, the sign-ups) never opened
  function stewardFeeds() {
    const L = V.LIVE; if (!S.db || L.admin) return;
    L.admin = true; S.ownFeeds = true;
    const rows = s => s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    try { S.unsubs.push(S.db.collection('fire').onSnapshot(s => { L.fire = rows(s).sort((a, b) => (a.at || 0) - (b.at || 0)); changed('fire'); }, () => { })); } catch (e) { }
    try { S.unsubs.push(S.db.collection('signups').onSnapshot(s => { L.signups = rows(s); changed('signups'); }, () => { })); } catch (e) { }
  }
  const WQ = {};
  function write(path, fn, steward = false) {
    if (!S.db) return Promise.resolve(false);
    const run = async () => {
      for (let n = 0; n < 2; n++) {
        try { await fn(S.db.doc(path)); return true; }
        catch (e) { if (e && e.code === 'unavailable' && n === 0) { await wait(600 + Math.random() * 600); continue; } return failed(e, steward); }
      }
      return false;
    };
    return (WQ[path] = (WQ[path] || Promise.resolve()).then(run, run));
  }
  const put = (path, body, stw) => write(path, ref => ref.set(body), stw);
  const del = (path, stw) => write(path, ref => ref.delete(), stw);
  function failed(e, steward) {
    const c = e && e.code;
    if (c === 'invalid_argument' || c === 'not_granted' || c === 'revoked') {
      if (steward) toast('That needs a steward\'s access, which this account does not have here.');
      else { S.readOnly = true; changed('all'); toast('That could not be saved: this account cannot post here yet. ' + TO_CAMP); }
    } else if (c === 'quota_exceeded') toast('The Mahalaverse is full for now, so that was not saved. ' + TO_STEWARDS);
    else if (c === 'resource_exhausted') toast('That was a lot at once. Wait a moment and try again.');
    else toast('That did not save. Try again in a moment.');
    return false;
  }

  /* ---------- what follows from the data ---------- */
  const answersOf = uid => ((S.answer[uid] || {}).n) || {};
  const lookFor = uid => ({ review: S.review, answer: answersOf(uid) });
  const myContrib = () => S.contrib[myId()] || { items: [] };
  const mySounds = () => (V.V5.sounds || []).find(d => d && d.id === myId()) || {};
  function myItems() {
    const uid = myId();
    if (!uid || !S.db) return C.mine('local', { contrib: {}, sounds: {}, book: V.ME.book, look: { review: {}, answer: {} }, cards: CARDS });
    return C.mine(uid, { contrib: myContrib(), sounds: mySounds(), book: V.ME.book, look: lookFor(uid), cards: CARDS });
  }
  const queueNow = () => C.queue(S.contrib, V.V5.sounds || [], S.review);
  const ideasNow = (all = false) => C.ideasList(S.ideas, S.ideaState, S.support, S.replies, myId(), all && isSteward());
  function applications() {
    const out = [];
    for (const d of V.LIVE.signups || []) {
      if (!d || !C.segOk(String(d.id || ''))) continue;
      for (const k of Object.keys(d)) {
        if (!k.startsWith('d_') || !d[k] || typeof d[k] !== 'object') continue;
        const s = d[k], door = ['camp', 'build', 'back', 'notnow'].includes(s.door) ? s.door : k.slice(2);
        out.push({ uid: d.id, door, s, at: +s.at || +d.at || 0, name: C.clean(s.name || d.name, 40, true), contact: (s.consent || d.consent) ? C.clean(s.contact || d.contact, 80, true) : '' });
      }
    }
    return out.sort((a, b) => b.at - a.at);
  }
  const decidable = a => a.door === 'camp' || a.door === 'build';
  const appField = a => (a.door === 'camp' ? 'camp' : 'build');
  const appState = a => C.appsOf(S.answer[a.uid])[appField(a)] || null;   // the camp's answer, kept with the person and the stewards (answer/<uid>)
  const linesNow = () => (V.LIVE.fire || []).filter(f => f && typeof f.text === 'string' && f.text.trim() && C.segOk(String(f.id || '')));
  function stewardCounts() {   // never throws: the stewards' sheet must always open, whatever one document holds
    const n = f => { try { return f(); } catch (e) { console.warn('co: a count failed', e); return 0; } };
    const q = n(() => queueNow().length), lines = n(() => linesNow().length), ideas = n(() => ideasNow(true).filter(x => !x.s && !x.off).length), apps = n(() => applications().filter(a => decidable(a) && !appState(a)).length);
    return { q, lines, ideas, apps, all: q + lines + ideas + apps };
  }
  // tell the person, gently, when a steward has read something of theirs (and the other plugins, for the gifts)
  function noteStatuses(first = false) {
    const uid = myId(); if (!uid) return;
    for (const it of myItems()) {
      if (it.book) continue; const was = S.last.get(it.key); S.last.set(it.key, it.st.s);
      if (first || !S.watch || was !== 'wait' || it.st.s === 'wait') continue;
      ctx.bus.emit('contrib:reviewed', { key: it.key, kind: it.k, s: it.st.s, mine: true, uid });
      const K = C.KINDS[it.k];
      if (it.st.s === 'ok') toast(`A steward ${K.verb} your ${K.noun}: it is ${K.home.replace(/^./, ch => ch.toLowerCase())} now.`);
      else toast(`A steward ${K.verb} your ${K.noun} and kept it back this time.${it.st.note ? ' They left you a note, in What you have offered.' : ''}`);
    }
    for (const x of ideasNow()) {
      if (!x.mine) continue; const was = S.lastIdea.get(x.key); S.lastIdea.set(x.key, x.s);
      if (first || !S.watch || was === x.s || x.s !== 'built') continue;
      ctx.bus.emit('idea:added', { key: x.key, uid, mine: true, built: true });
      toast(`Your idea, ${x.title}, is built.`);
    }
  }

  /* ---------- the fire: poems, stories and reflections a steward put on the hearth, read as fireside pieces ---------- */
  let lastHearth = null, lastShown = null;
  function syncPieces(force = false) {
    if (!force && V.LIVE.hearth === lastHearth && S.shown === lastShown) return;
    lastHearth = V.LIVE.hearth; lastShown = S.shown;
    const want = C.firePieces(V.LIVE.hearth || [], S.shown, CARDS).slice(0, 24), F = V.FIRESIDE, FB = V.FIRE_BY, reading = V.fireOn ? V.firePiece : null;
    const ids = new Set(want.map(p => p.id));
    for (const p of want) FB[p.id] = p;                                 // kept in FIRE_BY even when it leaves the list, so a reader is never cut off
    const curated = F.filter(p => !p.camp), keep = F.filter(p => p.camp && !ids.has(p.id) && p.id === reading);
    F.length = 0; F.push(...curated, ...want, ...keep);
  }
  H7.live.push(() => { syncPieces(); changed('live'); });
  H7.circle.push(body => {
    const box = document.createElement('div'); box.className = 'v7-co-firebox';
    box.innerHTML = canShare() ? `<span>Written something for the fire? A steward reads it, then it joins the pieces here.</span><button class="btn" type="button" data-co-open="piece">${icon('pen')}Offer a poem or a story</button>`
      : '<span>Poems and stories by camp mates join the fire here, once a steward has read them.</span>';
    body.appendChild(box);
  });

  /* ---------- the sheet: one view at a time, over the world and over the dashboard ---------- */
  const ROOT = document.createElement('div'); ROOT.className = 'modal v7-co-modal'; ROOT.hidden = true;
  ROOT.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="v7coTitle"><div class="sheet-head"><button class="iconbtn v7-co-back" type="button" data-co="back" aria-label="Back" hidden>${icon('left')}</button><h3 id="v7coTitle" tabindex="-1"></h3><button class="iconbtn x" type="button" data-co="close" aria-label="Close">${icon('x')}</button></div><nav class="v7-co-secbar" id="v7coBar" aria-label="Sections of the stewards' tools" hidden></nav><div class="sheet-body" id="v7coBody"></div><div class="sheet-foot" id="v7coFoot"></div></div>`;
  (document.getElementById('mvRoot') || document.body).appendChild(ROOT);
  const SHEET = ROOT.firstElementChild, TITLE = $('#v7coTitle', ROOT), BODY = $('#v7coBody', ROOT), FOOT = $('#v7coFoot', ROOT), BACK = $('.v7-co-back', ROOT), BAR = $('#v7coBar', ROOT);
  let VIEW = null, STACK = [], lastFocus = null;
  function open(name, args = {}) {
    if (!VIEWS[name]) return;
    if (name === 'stewards' && !isSteward()) { toast('The stewards\' tools are for the camp\'s stewards.'); return; }
    if (ROOT.hidden) { const a = document.activeElement; lastFocus = a && a !== document.body && a.getClientRects().length ? a : $('#menuBtn'); STACK = []; }
    else if (VIEW) { grab(); STACK.push(VIEW); }
    VIEW = { name, args, form: Object.assign({}, args.form || {}) }; ROOT.hidden = false; render(true);
    if (name === 'stewards') ctx.bus.emit('steward:opened', {});
  }
  function back() { if (!STACK.length) { close(); return; } VIEW = STACK.pop(); render(true); }
  function close() {
    ROOT.hidden = true; for (const v of [VIEW, ...STACK]) if (v && v.form.preview) { try { URL.revokeObjectURL(v.form.preview); } catch (e) { } }
    VIEW = null; STACK = [];
    const f = lastFocus && lastFocus.isConnected && lastFocus.getClientRects().length ? lastFocus : $('#menuBtn'); if (f && f.getClientRects().length) f.focus();
  }
  function done() { if (STACK.length) back(); else close(); }
  // what the person has typed, kept across a redraw of the same sheet
  function grab(root = ROOT) { if (!VIEW) return; for (const el of $$('[data-f]', root)) VIEW.form[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; }
  // where the focus is, in a way that survives a redraw: its id, or what its button does
  const focusKey = root => { const a = document.activeElement; if (!a || !root.contains(a)) return null;
    return a.id ? '#' + CSS.escape(a.id) : a.dataset && a.dataset.co ? `[data-co="${CSS.escape(a.dataset.co)}"]` : a.dataset && a.dataset.p ? `[data-p="${CSS.escape(a.dataset.p)}"]` : null; };
  const refocus = (root, k) => { if (!k) return; const f = $(k, root); if (f) f.focus({ preventScroll: true }); };
  function render(first = false) {
    if (!VIEW) return; const fn = VIEWS[VIEW.name]; if (!fn) { close(); return; }
    if (!first) grab();
    let out; try { out = fn(VIEW.args, VIEW); } catch (e) { console.warn('co view', VIEW.name, e); close(); return; }
    const foot = out.foot || `<button class="btn" type="button" data-co="close">Close</button>`;
    if (!first && !out.after && out.body === VIEW.body && foot === VIEW.foot && out.title === TITLE.textContent) { VIEW.pending = false; return; }   // nothing changed
    const top = BODY.scrollTop, fk = first ? null : focusKey(ROOT);
    TITLE.textContent = out.title; BODY.innerHTML = out.body; FOOT.innerHTML = foot; VIEW.body = out.body; VIEW.foot = foot;
    SHEET.classList.toggle('v7-co-wide', !!out.wide); BACK.hidden = !STACK.length; VIEW.pending = false;
    if (VIEW.name !== 'stewards') { BAR.hidden = true; BAR.replaceChildren(); }
    if (out.after) { try { out.after(); } catch (e) { console.warn(e); } }
    if (first) { BODY.scrollTop = 0; setTimeout(() => { if (!ROOT.hidden) TITLE.focus({ preventScroll: true }); }, 40); }
    else { BODY.scrollTop = top; refocus(ROOT, fk); }
  }
  // someone is typing here, or changed a field since it was drawn: a redraw would lose it, so it waits
  const typing = root => { const a = document.activeElement; if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(checkbox|radio|file|button|submit)$/.test(a.type)) return true;
    return $$('input, textarea, select', root).some(x => x.tagName === 'SELECT' ? x.selectedIndex !== Math.max(0, [...x.options].findIndex(o => o.defaultSelected))
      : !/^(checkbox|radio|file|button|submit|hidden)$/.test(x.type) && x.value !== x.defaultValue); };
  // once a field is saved, what it holds is no longer a change of the person's: a redraw may take it
  const settle = (...els) => { for (const x of els.flat()) { if (!x) continue; if (x.tagName === 'SELECT') for (const o of x.options) o.defaultSelected = o.selected; else x.defaultValue = x.value; } };
  ROOT.addEventListener('focusout', () => setTimeout(() => { if (VIEW && VIEW.pending && !typing(ROOT)) render(); }, 0));
  ROOT.addEventListener('click', e => {
    if (e.target === ROOT) { if (!typing(ROOT)) close(); return; }
    const lead = e.target.closest('[data-p^="lead:"]'); if (lead) { leadClick(lead); return; }
    const b = e.target.closest('[data-co]'); if (b && !b.disabled) act(b.dataset.co, b, ROOT);
  });
  ROOT.addEventListener('submit', e => { const f = e.target.closest('[data-co-form]'); if (!f) return; e.preventDefault(); act(f.dataset.coForm, f, ROOT); });
  ROOT.addEventListener('keydown', e => {                             // the question picker is a radio group: the arrows move the choice
    const r = e.target.closest && e.target.closest('[role="radio"]'); if (!r || !/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
    const all = $$('[role="radio"]', r.parentElement), j = all.indexOf(r), k = (j + (/Down|Right/.test(e.key) ? 1 : all.length - 1)) % all.length;
    e.preventDefault(); if (all[k]) all[k].click();
  });
  ROOT.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'v7co-file') { pickFile(t); return; }
    if (t.id === 'v7co-share') { const s = $('[data-co="submit:journey"] span', ROOT); if (s) s.textContent = t.checked ? 'Keep it and share it' : 'Keep it'; }
  });
  // the keys: Escape closes, and Tab stays inside the sheet (before the game's own handlers, which look at the first open modal)
  window.addEventListener('keydown', e => {
    if (ROOT.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])', ROOT).filter(x => !x.disabled && x.offsetParent !== null && !x.closest('[hidden]'));
    e.stopPropagation(); if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (i < 0) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && i === 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }, true);
  // a picture that cannot be shown (taken away, or not served to this viewer) becomes a quiet line
  document.addEventListener('error', e => {
    const im = e.target; if (!im || im.tagName !== 'IMG' || !im.hasAttribute('data-co-img')) return;
    const fr = im.closest('.v7-co-frame'); const msg = document.createElement('span'); msg.className = 'v7-co-miss'; msg.textContent = 'The picture cannot be shown here.';
    if (fr) { fr.classList.remove('has-img'); fr.replaceChildren(msg); } else im.replaceWith(msg);
  }, true);

  /* ---------- small pieces the views share ---------- */
  const CHOICES = [['journey', 'star', 'A soul journey reflection', 'The card you drew, the question it asked, what came up. Private unless you share it at the fire.', 'Soul journey'],
    ['piece', 'flame', 'A poem or a story', 'For the fire in Blissfull Drift, where everyone who opens the Mahalaverse can read them.', 'Poem or story'],
    ['art', 'eye', 'Digital art', 'An image of your own, or a link to where it lives, for Art by camp mates.', 'Digital art'],
    ['set', 'sound', 'A music set or a playlist', 'For the shade of the main tent.', 'Music set'],
    ['sound', 'petal', 'A sound journey recording', 'A link to a recording, for the Lotus Mahal.', 'Sound journey']];
  const choicesHTML = (compact = false) => compact
    ? `<div class="v7-co-quick" role="group" aria-label="Offer something new">${CHOICES.map(([k, ic, t, , short]) => `<button class="btn v7-co-sm" type="button" data-co="open:${k}" aria-label="${esc(t)}">${icon(ic)}${esc(short)}</button>`).join('')}</div>`
    : `<div class="v7-co-choices">${CHOICES.map(([k, ic, t, s]) => `<button class="v7-co-choice" type="button" data-co="open:${k}" data-k="${k}"><span class="v7-co-ic">${icon(ic)}</span><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`;
  const assetSrc = a => (C.assetOk(a) ? '/_blob/' + a : null);           // the one path the platform serves an asset from (on Mahala's own site it redirects to the file)
  const SEE = { fire: ['fire', 'flame', 'Sit by the fire'], gallery: ['gallery', 'eye', 'See Art by camp mates'], tent: ['tent', 'sound', 'The main tent'], lotus: ['lotus', 'petal', 'The Lotus Mahal'] };
  function itemRow(it) {
    const K = C.KINDS[it.k], st = it.st, acts = [];
    if (st.s === 'private' && canShare()) acts.push(`<button class="btn v7-co-sm" type="button" data-co="sharebook:${esc(it.i)}">${icon('flame')}Share it at the fire</button>`);
    if (st.s === 'ok' && SEE[K.where]) { const [a, ic, t] = SEE[K.where]; acts.push(`<button class="btn v7-co-sm" type="button" data-co="${a}">${icon(ic)}${t}</button>`); }
    if (!it.book && myId() && canShare()) acts.push(`<button class="btn v7-co-sm" type="button" data-co="withdraw:${esc(it.key)}">${st.s === 'no' ? 'Remove it' : 'Take it back'}</button>`);
    const ex = it.k === 'set' ? '' : it.text;
    return `<div class="v7-co-item"><div><span class="v7-co-k">${esc(K.short)}${it.t ? ' · ' + esc(day(it.t)) : ''}</span><b class="v7-co-ti">${esc(it.title || K.label)}</b></div>${chip(st.label, st.tone)}
      ${it.q ? `<p class="v7-co-qq">${esc(it.q)}</p>` : ''}${ex ? `<p class="v7-co-ex">${esc(ex)}</p>` : ''}${it.url ? `<p class="v7-co-host">${esc(C.hostOf(it.url))}</p>` : ''}${it.asset ? '<p class="v7-co-host">An image you uploaded</p>' : ''}
      ${st.where ? `<p class="v7-co-where">${esc(st.where)}</p>` : ''}
      ${st.s === 'wait' ? '<p class="v7-co-host">Until a steward has seen it, only you and the stewards can.</p>' : ''}
      ${st.note ? `<p class="v7-co-say"><b>A note from a steward, for you:</b> ${esc(st.note)}</p>` : st.s === 'no' ? '<p class="v7-co-say">A steward kept this back for now. Only you can see it here.</p>' : ''}
      ${acts.length ? `<div class="actions">${acts.join('')}</div>` : ''}</div>`;
  }
  function offeredList() {
    if (coming('contrib')) return '<p class="mv-empty v7-co-empty">Gathering what you have offered...</p>';
    const items = myItems();
    if (!items.length) return `<p class="mv-empty v7-co-empty">${myId() && S.db ? 'Nothing offered yet. A first piece could be a few lines on a card you drew.' : 'Nothing here yet. Soul journey reflections you keep in this browser show here.'}</p>`;
    return `<div class="v7-co-list">${items.slice(0, 40).map(itemRow).join('')}</div>`;
  }
  const pickHTML = (group, opts, cur, label, cls = '') => `<div class="v7-co-pick${cls ? ' ' + cls : ''}" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button type="button" data-co="pick" data-group="${esc(group)}" data-val="${esc(v)}" aria-pressed="${String(cur === v)}">${esc(t)}</button>`).join('')}</div>`;
  const field = (id, f, label, val, o = {}) => `<div class="field"><label for="${id}">${esc(label)}${o.opt ? ' <small>(optional)</small>' : ''}</label>${o.area
    ? `<textarea id="${id}" data-f="${f}" maxlength="${o.max}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${esc(val || '')}</textarea>`
    : `<input id="${id}" data-f="${f}" ${o.url ? 'type="url" inputmode="url" placeholder="https://"' : 'type="text"'} maxlength="${o.max}" value="${esc(val || '')}" autocomplete="off">`}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</div>`;
  const ERR = { card: 'Choose your card first.', text: 'Write a few words first.', title: 'Give it a title first.', url: 'That link needs to start with https://',
    art: 'Choose an image, or add a link to the work.', ititle: 'Give your idea a few words first.', what: 'Say a little about what and why.', place: 'Choose where it belongs.', reply: 'Write a few words first.' };
  function flash(msg) { const el = $('#v7coErr', ROOT); if (el) { el.textContent = msg; el.hidden = false; } toast(msg); }
  const errLine = '<p class="v7-co-err" id="v7coErr" role="alert" hidden></p>';
  function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.was = btn.innerHTML; btn.disabled = true; if (label) btn.textContent = label; } else { btn.disabled = false; if (btn.dataset.was) btn.innerHTML = btn.dataset.was; } }

  /* ---------- the views ---------- */
  const VIEWS = {
    offer() {
      return { title: 'Offer something', wide: true,
        body: `<p class="v7-co-lede">Bring something of yours to the camp: a soul journey reflection, a poem or a story for the fire, digital art, a music set or a sound journey recording.</p>
          ${stateLine('offer your work', S.db ? '' : 'Soul journey reflections can still be kept in this browser.')}
          ${choicesHTML()}
          ${whoLine('A steward reads, looks at or listens to everything first, and only then can anyone else see it. Soul journey reflections stay private unless you share them.')}
          <h4 class="v7-co-h">What you have offered</h4>${offeredList()}
          <p class="note">Offering a lift, gear or a hand with the build? Post it on the camp board, in Together (at the top left, where it shows who is here).</p>`,
        foot: `<button class="btn" type="button" data-co="gallery">${icon('eye')}Art by camp mates</button><button class="btn" type="button" data-co="close">Done</button>` };
    },
    journey(a, v) {
      if (v.form.card === undefined) v.form.card = a.card && CARDS[a.card] ? a.card : (V.DKX.drawn && CARDS[V.DKX.drawn] ? V.DKX.drawn : V.DKX.kept && CARDS[V.DKX.kept] ? V.DKX.kept : null);
      const c = v.form.card && CARDS[v.form.card], can = canShare();
      const ask = c ? C.askOf(c, v.form.ask) : null; if (c) v.form.ask = ask;
      const asks = c ? [['q', 'The card\'s question', c.q], ['sq', 'In its shadow', c.sq]].filter(x => x[2]) : [];
      const eyebrow = !c ? '' : a.card && V.DKX.drawn === v.form.card ? 'The card you drew' : V.DKX.kept === v.form.card ? 'Your card' : 'The card';
      const cardHTML = c && !v.form.choosing
        ? `<div class="v7-co-card"><img src="${esc(c.src)}" alt="${esc(c.title)}, a card of the Mahala Archetype Deck"><div><span class="eyebrow">${esc(eyebrow)}</span><h4>${esc(c.title)}</h4><small>${esc(c.cap)}</small>
            <div class="actions" style="margin-top:8px"><button class="btn v7-co-sm" type="button" data-co="choosecard">Choose another card</button></div></div></div>
          ${asks.length > 1 ? `<div class="field"><span class="v7-co-lab" id="v7co-askl">The question it asked you</span><div class="v7-co-asks" role="radiogroup" aria-labelledby="v7co-askl">${asks.map(([k, t, q]) => `<button type="button" class="v7-co-ask" role="radio" data-co="pick" data-group="ask" data-val="${k}" aria-checked="${String(ask === k)}" tabindex="${ask === k ? 0 : -1}"><i aria-hidden="true"></i><small>${esc(t)}</small><span>${esc(q)}</span></button>`).join('')}</div></div>`
            : asks.length ? `<p class="v7-co-q">${esc(asks[0][2])}</p>` : ''}`
        : `<p>Which card did you draw? Choose it here, or draw one by the fire.</p>
          <div class="v7-co-deck" role="group" aria-label="The eleven cards of the Mahala Archetype Deck">${ARCH.map(x => `<button type="button" data-co="pick" data-group="card" data-val="${esc(x.key)}" aria-pressed="${String(v.form.card === x.key)}"><img src="${esc(x.src)}" alt="" loading="lazy">${esc(x.title)}</button>`).join('')}</div>
          <div class="actions"><button class="btn" type="button" data-co="drawcard">${icon('flame')}Draw a card by the fire</button></div>`;
      return { title: 'A soul journey reflection',
        body: `${cardHTML}
          <p class="note">This card is not your horoscope: a way we have of seeing each other, and we feel this force is very strong in you.</p>
          ${field('v7co-x', 'text', 'What came up', v.form.text, { area: true, max: C.LIMIT.journey, hint: 'Write freely. A few lines are enough. You might write about what it asks of you, of the people around you, or of the camp.' })}
          <label class="check" for="v7co-share"${can ? '' : ' aria-disabled="true"'}><input type="checkbox" id="v7co-share" data-f="share" ${v.form.share && can ? 'checked' : ''} ${can ? '' : 'disabled'}><span><b>Share it at the fire</b><small>${can ? 'A steward reads it first. Then everyone who opens the Mahalaverse can read it by the fire, without your name.' : esc(why('share it at the fire'))}</small></span></label>
          ${errLine}
          ${whoLine('Private by default: it is kept in your own book, where only you can read it. You can share it at the fire later, from What you have offered.')}`,
        foot: `<button class="btn" type="button" data-co="close">Not now</button><button class="btn primary" type="button" data-co="submit:journey">${icon('book')}<span>${v.form.share && can ? 'Keep it and share it' : 'Keep it'}</span></button>` };
    },
    piece(a, v) {
      const kind = v.form.kind = v.form.kind === 'story' || (!v.form.kind && a.kind === 'story') ? 'story' : 'poem', can = canShare();
      return { title: 'A poem or a story for the fire',
        body: `<p class="v7-co-lede">Camp mates gather in the hull of Blissfull Drift to read poems and stories by the fire. Offer yours.</p>
          ${pickHTML('kind', [['poem', 'A poem'], ['story', 'A story']], kind, 'Is it a poem or a story?')}
          ${field('v7co-ti', 'title', 'Its title', v.form.title, { max: C.LIMIT.title, opt: true })}
          ${field('v7co-x', 'text', kind === 'poem' ? 'The poem' : 'The story', v.form.text, { area: true, max: C.LIMIT.piece, hint: kind === 'poem' ? 'Leave an empty line between verses.' : 'Leave an empty line between paragraphs.' })}
          ${errLine}${can ? whoLine('A steward reads it first. Then everyone who opens the Mahalaverse can read it by the fire, without your name. A copy stays in your own book.') : stateLine('offer it to the fire', 'You can still keep it in your own book.')}`,
        foot: `<button class="btn" type="button" data-co="close">Not now</button><button class="btn" type="button" data-co="submit:piece:book">${icon('book')}Keep it in my book</button><button class="btn primary" type="button" data-co="submit:piece:fire" ${can ? '' : 'disabled'}>${icon('flame')}Offer it to the fire</button>` };
    },
    art(a, v) {
      const can = canShare(), up = can && !!S.assets;
      return { title: 'Digital art',
        body: `<p class="v7-co-lede">Offer a piece of your own digital art for Art by camp mates, at the camp: an image, or a link to where it lives.</p>
          ${stateLine('offer art')}
          ${up ? `<div class="v7-co-file"><span class="v7-co-lab">An image <small class="note">PNG, JPEG, WebP or GIF, up to 10 MB</small></span>${v.form.preview ? `<img src="${esc(v.form.preview)}" alt="Your image, as it will be offered"><small class="note">${esc(`Ready to offer: ${v.form.fileName || 'your image'}.`)}</small>` : ''}
            <input type="file" id="v7co-file" class="v7-co-vh" accept="image/png,image/jpeg,image/webp,image/gif"><label for="v7co-file" class="btn v7-co-sm v7-co-pickfile">${icon(v.form.preview ? 'shuffle' : 'plus')}${v.form.preview ? 'Choose another image' : 'Choose an image'}</label>${v.form.fileErr ? `<p class="v7-co-err" role="alert">${esc(v.form.fileErr)}</p>` : ''}</div>` : ''}
          <fieldset class="v7-co-fs"${can ? '' : ' disabled'}>
          ${field('v7co-u', 'url', up ? 'Or a link to the work' : 'A link to the work', v.form.url, { max: C.LIMIT.url, url: true, opt: up })}
          ${can && !up ? '<p class="note">Uploading an image is not open to you here, so share a link to where the work lives.</p>' : ''}
          ${field('v7co-ti', 'title', 'Its title', v.form.title, { max: C.LIMIT.title })}
          ${field('v7co-x', 'text', 'A line about it', v.form.text, { max: C.LIMIT.line, opt: true })}
          ${field('v7co-cr', 'credit', 'A name to show with it', v.form.credit, { max: C.LIMIT.credit, opt: true, hint: 'Your playa name, or the name you make art under. Leave it empty to share it without a name.' })}
          </fieldset>
          ${errLine}${can ? whoLine(`Only your own work, please. A steward looks at it first. Then it hangs in Art by camp mates for everyone who opens the Mahalaverse, with the name you chose, or without one.${up ? ' Photos are saved again without their hidden details, such as where a photo was taken. A GIF is kept as it is, so it still moves.' : ''}`) : ''}`,
        foot: `<button class="btn" type="button" data-co="close">Not now</button><button class="btn primary" type="button" data-co="submit:art" ${can ? '' : 'disabled'}>${icon('eye')}Offer it</button>` };
    },
    set(a, v) {
      const live = !!(S.db && myId()), can = live ? canShare() : true;   // with no shared store the main tent keeps your sets in this browser
      return { title: 'A music set or a playlist',
        body: `<p class="v7-co-lede">Share music you love with the camp: a playlist, a DJ set or a recording. It plays in the shade of the main tent.</p>
          ${field('v7co-ti', 'title', 'What it is called', v.form.title, { max: C.LIMIT.title })}
          ${field('v7co-u', 'url', 'Its link', v.form.url, { max: C.LIMIT.url, url: true })}
          <div class="field"><span class="v7-co-lab">What kind it is</span>${pickHTML('sk', C.SET_KINDS, v.form.sk || 'playlist', 'What kind it is')}</div>
          ${errLine}${whoLine(canShare() ? `A steward listens first. Then it is listed in the main tent for everyone who can open the Mahalaverse, shown ${shownAs()}.` : live ? why('share music') : 'The shared Mahalaverse cannot be reached from here, so your link is kept in this browser.')}`,
        foot: `<button class="btn" type="button" data-co="close">Not now</button><button class="btn primary" type="button" data-co="submit:set" ${can ? '' : 'disabled'}>${icon('sound')}Offer it</button>` };
    },
    sound(a, v) {
      const can = canShare();
      return { title: 'A sound journey recording',
        body: `<p class="v7-co-lede">Sound journeys gather in the Lotus Mahal, the camp's temple tent. Share a recording of one as a link: once a steward has listened, it is listed on the Lotus Mahal's card.</p>
          ${stateLine('share a recording')}
          <fieldset class="v7-co-fs"${can ? '' : ' disabled'}>
          ${field('v7co-ti', 'title', 'Its title', v.form.title, { max: C.LIMIT.title })}
          ${field('v7co-u', 'url', 'Its link', v.form.url, { max: C.LIMIT.url, url: true })}
          ${field('v7co-x', 'text', 'A line about it', v.form.text, { max: C.LIMIT.line, opt: true })}
          </fieldset>
          ${errLine}${can ? whoLine(`Share only recordings you made or may share, and leave out the names of guides and guests. A steward listens first. Then it is listed at the Lotus Mahal, shown ${shownAs()}.`) : ''}`,
        foot: `<button class="btn" type="button" data-co="close">Not now</button><button class="btn primary" type="button" data-co="submit:sound" ${can ? '' : 'disabled'}>${icon('petal')}Offer it</button>` };
    },
    work(a) {
      const w = C.galleryWorks(S.review, S.shown).find(x => x.key === a.key);
      if (!w) return { title: 'Art by camp mates', body: '<p class="mv-empty v7-co-empty">This work is no longer in Art by camp mates.</p>' };
      const src = w.asset ? assetSrc(w.asset) : null;
      return { title: w.title,
        body: `<div class="v7-co-big">${src ? `<img src="${esc(src)}" alt="${esc(w.title)}" data-co-img>` : `<div class="v7-co-linkart"><span class="eyebrow">Digital art, online</span><b>${esc(w.title)}</b>${w.url ? `<small class="note">On ${esc(C.hostOf(w.url))}</small>` : ''}</div>`}
          <div><span class="eyebrow">${esc(w.credit ? 'By ' + w.credit : 'By a camp mate')}${C.monthOf(w.at) ? ' · ' + esc(C.monthOf(w.at)) : ''}</span>${w.text ? `<p class="v7-co-ln">${esc(w.text)}</p>` : ''}</div>
          ${w.url ? `<div class="actions"><a class="btn" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">${icon('right')}Open the work on ${esc(C.hostOf(w.url))}</a></div>` : ''}
          <p class="note">Offered by a camp mate, and hung here once a steward had looked at it.${w.url ? ' The link opens in a new tab, on the site that holds the work.' : ''}</p></div>`,
        foot: `${isSteward() ? `<button class="btn" type="button" data-co="takedown:${esc(w.key)}">Take it down</button>` : ''}<button class="btn" type="button" data-co="close">Close</button>` };
    },
    ideas(a, v) {
      const list = ideasNow(), built = C.builtList(list), place = v.form.place || 'all', can = canShare();   // as everyone sees them, stewards too (their own panel has the rest)
      const shown = list.filter(x => place === 'all' || x.k === place);
      if (v.form.compose === undefined) v.form.compose = !!a.compose && can;
      const form = !S.db ? '' : !can ? stateLine('share an idea', 'You can still read the ideas and what the stewards say.')
        : v.form.compose ? `<form class="v7-co-form" data-co-form="submit:idea" aria-label="Share an idea">
            ${field('v7co-ti', 'title', 'Your idea, in a few words', v.form.title, { max: C.LIMIT.title })}
            ${field('v7co-w', 'tx', 'What, and why', v.form.tx, { area: true, max: C.LIMIT.idea })}
            <div class="field"><span class="v7-co-lab">Where it belongs</span>${pickHTML('k', C.PLACES, v.form.k || null, 'Where it belongs')}</div>
            ${errLine}${whoLine(`Everyone who can open the Mahalaverse can read your idea, add a heart and reply, shown ${shownAs()}. A steward gives each idea a state, from heard to built.`)}
            <div class="actions"><button class="btn" type="button" data-co="compose:0">Not now</button><button class="btn primary" type="submit">${icon('light')}Share the idea</button></div></form>`
          : `<div class="actions"><button class="btn primary" type="button" data-co="compose:1">${icon('plus')}Share an idea</button></div>`;
      return { title: 'Ideas for the Mahalaverse', wide: true,
        body: `<p class="v7-co-lede">The Mahalaverse is still being made. Tell us what you would add or change, and help each other's ideas along. The stewards say where each one stands.</p>
          ${form}
          ${built.length ? `<section class="v7-co-built" aria-labelledby="v7co-built"><h4 id="v7co-built">You asked, we built</h4><ol>${built.slice(0, 8).map(x => `<li><b>${esc(x.title)}</b><small>${esc(x.note || C.PLACE_BY[x.k])}${x.st ? ' · built ' + esc(ago(x.st)) : ''}</small></li>`).join('')}</ol></section>` : ''}
          <div class="v7-co-row v7-co-ihead"><h4 class="v7-co-h" style="margin:0">Ideas${list.length ? ` <span class="note">${list.length}</span>` : ''}</h4>${list.length ? pickHTML('place', [['all', 'All'], ...C.PLACES], place, 'Show ideas for', 'v7-co-scroll') : ''}</div>
          ${list.length ? `<p class="note">A heart says you would like it too. Ideas are listed newest first, never by hearts.</p>` : ''}
          ${list.length && can ? whoLine('Everyone who can open the Mahalaverse reads the ideas, the hearts and the replies. A name shows only for people who chose to show theirs.') : ''}
          <div class="v7-co-ideas">${shown.length ? shown.slice(0, 60).map(x => ideaCard(x, v)).join('') : `<p class="mv-empty v7-co-empty">${!S.db || !S.me.id ? esc(noStore('the ideas')) : coming('ideas') ? 'Gathering the ideas...' : list.length ? 'No ideas here yet.' : 'No ideas yet. Yours could be the first.'}</p>`}</div>`,
        foot: `<button class="btn" type="button" data-co="close">Close</button>` };
    },
    stewards() {
      if (!isSteward()) return { title: 'Stewards\' tools', body: '<p class="mv-empty v7-co-empty">The stewards\' tools are for the camp\'s stewards.</p>' };
      return { title: 'Stewards\' tools', wide: true,
        body: `<p class="note">For stewards only. Contact details, and the notes you leave for people, stay in this panel and with the person they are for.</p>
          <div class="v7-co-counts" hidden>${countsHTML()}</div>
          <div id="v7coStw" class="v7-co-other"></div>`,
        after: () => renderStewardSections($('#v7coStw', ROOT)) };
    },
  };

  /* ---------- an idea, as everyone sees it ---------- */
  function ideaCard(x, v) {
    const st = x.s ? C.STATE_BY[x.s] : null, can = canShare(), all = v && v.form.more && v.form.more[x.key];
    const reps = all ? x.replies : x.replies.slice(-4);
    const heartLabel = x.mine ? `${plural(x.hearts, 'heart')} from others` : x.hearted ? `Take your heart back. ${plural(x.hearts, 'heart')}` : `Add your heart to this idea. ${plural(x.hearts, 'heart')} so far`;
    return `<article class="v7-co-idea${x.mine ? ' v7-co-mine' : ''}${x.off ? ' v7-co-off' : ''}" aria-label="${esc(x.title)}">
      <div class="chips">${chip(C.PLACE_BY[x.k], 'c-cyan')}${st ? chip(st.t, st.tone) : chip('New', 'open')}${x.mine ? chip('Yours', 'c-yellow') : ''}${x.off ? chip('Set aside by a steward', 'wait') : ''}</div>
      <h5>${esc(x.title)}</h5><p class="v7-co-w">${esc(x.tx)}</p>
      ${x.off && x.mine ? '<p class="v7-co-say">A steward set this idea aside, so only you and the stewards can see it.</p>' : ''}
      ${x.note ? `<p class="v7-co-note"><b>From the stewards:</b> ${esc(x.note)}</p>` : ''}
      <div class="v7-co-row"><button class="v7-co-heart" type="button" data-co="heart:${esc(x.key)}" aria-pressed="${String(!!x.hearted)}" aria-label="${esc(heartLabel)}" ${x.mine || !can ? 'disabled' : ''}>${HEART}<span>${x.hearts}</span></button>
        <span class="note">${esc(byOf(x.uid))} · ${esc(ago(x.t))}</span></div>
      ${reps.length ? `<div class="v7-co-replies">${x.replies.length > reps.length ? `<button class="btn ghost v7-co-sm" type="button" data-co="more:${esc(x.key)}">Show all ${x.replies.length} replies</button>` : ''}${reps.map(r => `<p class="v7-co-reply${r.hidden ? ' v7-co-hid' : ''}"><span>${esc(r.tx)} <small>${esc(byOf(r.uid))} · ${esc(ago(r.t))}${r.hidden ? (r.mine ? ' · hidden by a steward, so only you and the stewards see it' : ' · hidden by a steward') : ''}</small></span>${r.mine && can ? `<button class="iconbtn" type="button" data-co="unreply:${esc(r.i)}" aria-label="Take back your reply">${icon('x')}</button>` : ''}</p>`).join('')}</div>` : ''}
      ${can && !x.off && (!x.mine || x.replies.some(r => !r.mine)) ? `<form class="v7-co-say-form" data-co-form="reply:${esc(x.key)}"><input type="text" maxlength="${C.LIMIT.reply}" aria-label="${esc(`Reply to ${x.title}`)}" placeholder="Add a reply" autocomplete="off" id="v7co-r-${esc(x.key.replace(/[^A-Za-z0-9_-]/g, '_'))}"><button class="btn v7-co-sm" type="submit">Reply</button></form>` : ''}
      ${x.mine && can ? `<div class="actions"><button class="btn v7-co-sm" type="button" data-co="unidea:${esc(x.i)}">Take it back</button></div>` : ''}</article>`;
  }

  /* ---------- the stewards' sections, in their order: these, and what other plugins add ---------- */
  function who(uid) {                                                // for stewards only: the name shown, and the account name beside it
    const shown = nameOf(uid), acct = S.prof[uid] && C.clean(S.prof[uid].name, 60, true);
    return `${shown ? `<b>${esc(shown)}</b>` : 'Name not shown'}${acct && acct !== shown ? ` · account: ${esc(acct)}` : ''}`;
  }
  async function resolve(ids) {
    const u = S.user, want = [...new Set(ids)].filter(id => id && C.segOk(id) && !S.prof[id]); if (!u || !want.length || typeof u.profiles !== 'function') return;
    want.forEach(id => { S.prof[id] = { name: '' }; });
    try { const ps = await u.profiles(want); for (const id of want) S.prof[id] = { name: ps && ps[id] && typeof ps[id].name === 'string' ? ps[id].name : '' }; changed('prof'); } catch (e) { }
  }
  function reviewCard(q) {
    const it = q.item, K = C.KINDS[q.k], c = it.card && CARDS[it.card], u = C.safeUrl(it.url), src = it.asset ? assetSrc(it.asset) : null, key = esc(q.key);
    const title = q.k === 'journey' ? (c ? c.title : 'A soul journey') : C.clean(it.title, C.LIMIT.title, true);
    const qq = q.k === 'journey' ? C.questionOf(c, it.ask) : '';
    return `<div class="v7-co-review">
      <div class="v7-co-row">${chip(K.short, 'c-yellow')}<span class="v7-co-meta">${who(q.uid)} · ${esc(ago(q.t))}</span></div>
      <b class="v7-co-tt">${esc(title || K.label)}</b>
      ${qq ? `<p class="v7-co-q v7-co-q-s">${esc(qq)}</p>` : ''}
      ${it.text ? `<p class="v7-co-body">${esc(it.text)}</p>` : ''}
      ${src ? `<img class="v7-co-prev" src="${esc(src)}" alt="The image they offered" data-co-img>` : ''}
      ${u ? `<div class="actions"><a class="btn v7-co-sm" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon('right')}Open the link, on ${esc(C.hostOf(u))}</a></div>` : ''}
      ${it.credit ? `<span class="v7-co-meta">The name they chose to show with it: <b>${esc(it.credit)}</b></span>` : q.k === 'art' ? '<span class="v7-co-meta">Shown without a name</span>' : ''}
      <div class="field v7-co-notef"><label for="v7co-n-${esc(q.key.replace(/[^A-Za-z0-9_-]/g, '_'))}">A note for them, if you like <small>(only they see it)</small></label><input type="text" id="v7co-n-${esc(q.key.replace(/[^A-Za-z0-9_-]/g, '_'))}" maxlength="${C.LIMIT.note}" data-note="${key}"></div>
      <div class="actions"><button class="btn v7-co-sm" type="button" data-co="decline:${key}">Decline</button><button class="btn primary v7-co-sm" type="button" data-co="approve:${key}">${icon('check')}Approve</button></div>
      <p class="note">${esc(`Approving puts it ${K.home.replace(/^./, ch => ch.toLowerCase())}. Declining shows nothing to anyone else: they see it was not shared, with your note if you leave one.`)}</p></div>`;
  }
  function publicNow() {                                            // approved work everyone sees, newest first, for taking down
    const out = [];
    const atFire = new Set(C.firePieces(V.LIVE.hearth || [], S.shown, CARDS).map(x => x.key));
    for (const h of V.LIVE.hearth || []) { if (!h || !atFire.has(h.id)) continue; const [uid, i] = C.splitKey(h.id); if (uid) out.push({ key: h.id, uid, i, k: h.k, t: +h.at || 0, title: h.k === 'journey' ? ((CARDS[h.card] || {}).title || 'A soul journey') : C.clean(h.title, C.LIMIT.title, true) }); }
    const seen = new Set([...C.galleryWorks(S.review, S.shown), ...C.recordings(S.review, S.shown)].map(w => w.key));   // what viewers really see, nothing else
    for (const [key, r] of Object.entries(S.review)) {
      if (!r || r.s !== 'ok' || !C.KINDS[r.k] || C.FIRE_KINDS.has(r.k)) continue; const [uid, i] = C.splitKey(key); if (!uid) continue;
      let title = C.clean(r.title, C.LIMIT.title, true);
      if (r.k === 'set') { const d = (V.V5.sounds || []).find(x => x.id === uid); const p = d && (d.p || []).find(x => x.i === i); if (!p || C.decisionOf('set', uid, i, { review: S.review, sounds: { [i]: C.safeUrl(p.url) } }) !== 'ok') continue; title = C.clean(p.title, C.LIMIT.title, true); }
      else if (!seen.has(key)) continue;
      out.push({ key, uid, i, k: r.k, t: +r.t || 0, title });
    }
    return out.sort((a, b) => b.t - a.t);
  }
  const SECTIONS = [
    { id: 'co-review', title: 'Offerings to read', order: 10, count: () => queueNow().length, render(el) {
      const q = queueNow(), pub = publicNow(), back = S.got.shown ? C.takenBack(S.review, V.LIVE.hearth || [], S.shown, S.contrib) : [];
      resolve(q.map(x => x.uid).concat(pub.slice(0, 12).map(x => x.uid)));
      el.innerHTML = (q.length ? q.slice(0, 30).map(reviewCard).join('') : `<p class="mv-empty v7-co-empty">${coming('contrib') ? 'Gathering what was offered...' : 'Nothing waiting. Everything offered has been read.'}</p>`)
        + (back.length ? `<div class="v7-co-form"><b>Taken back by the people who offered them</b><p class="note">These are hidden from everyone already, because their makers took them back or deleted their data. Clearing removes the copy from the store.</p>${back.slice(0, 20).map(p => `<div class="v7-co-stw"><span>${esc(C.KINDS[p.k].short)}: ${esc(p.title || 'Untitled')}</span><button class="btn v7-co-sm" type="button" data-co="tidy:${esc(p.key)}" data-k="${esc(p.k)}">Clear it</button></div>`).join('')}</div>` : '')
        + (pub.length ? `<details><summary class="v7-co-meta">Shared lately (${pub.length})</summary><div class="v7-co-list" style="margin-top:8px">${pub.slice(0, 16).map(p => `<div class="v7-co-stw"><span>${chip(C.KINDS[p.k].short, 'done')} ${esc(p.title || 'Untitled')} <span class="v7-co-meta">${who(p.uid)} · ${esc(ago(p.t))}</span></span><button class="btn v7-co-sm" type="button" data-co="takedown:${esc(p.key)}">Take it down</button></div>`).join('')}</div></details>` : '');
    } },
    { id: 'co-lines', title: 'Lines at the fire', order: 15, count: () => linesNow().length, render(el) {
      const list = linesNow();
      el.innerHTML = `<p class="note">One line each, left at the fire by camp mates. Approving puts the line on the hearth, where everyone at the fire reads it, with the person's name only if they chose to show it.</p>`
        + (list.length ? list.map(f => `<div class="v7-co-review"><p class="v7-co-body">"${esc(C.clean(f.text, 160, true))}"</p>
            <span class="v7-co-meta">${f.name ? esc(C.clean(f.name, 40, true)) : 'No name shown'}${f.card && CARDS[f.card] ? ' · ' + esc(CARDS[f.card].title) : ''}${f.at ? ' · ' + esc(ago(f.at)) : ''}</span>
            <div class="actions"><button class="btn v7-co-sm" type="button" data-co="linedecline:${esc(f.id)}">Decline</button><button class="btn primary v7-co-sm" type="button" data-co="lineok:${esc(f.id)}">${icon('check')}Approve</button></div></div>`).join('')
          : '<p class="mv-empty v7-co-empty">No lines waiting at the fire.</p>');
    } },
    { id: 'co-ideas', title: 'Ideas', order: 20, count: () => ideasNow(true).filter(x => !x.s && !x.off).length, render(el) {
      const list = ideasNow(true).sort((a, b) => (!!a.s - !!b.s) || b.t - a.t);
      resolve(list.map(x => x.uid));
      const sum = S.sample ? `<div class="v7-co-form mv-summary"><b>What people are asking for</b>
          <p class="note">Asks Claude to read the ideas' own words, never who wrote them, and draft a short summary for you. It uses your own Claude account, and only when you press the button.</p>
          <div class="actions"><button class="btn" type="button" data-co="summarise" ${S.sum && S.sum.running ? 'disabled' : ''}>${icon('light')}Summarise what people are asking for</button>${S.sum && S.sum.running ? '<button class="btn" type="button" data-co="stopsum">Stop</button>' : ''}</div>
          ${S.sum && S.sum.text != null ? `<p class="v7-co-draft" id="v7coDraft" aria-live="polite">${esc(S.sum.text || 'Thinking...')}</p>${S.sum.note ? `<p class="note">${esc(S.sum.note)}</p>` : ''}${!S.sum.running && S.sum.text ? '<div class="actions"><button class="btn v7-co-sm" type="button" data-co="copysum">Copy the draft</button></div>' : ''}` : ''}
          <p class="note">A draft for you only: it is not kept, and nobody else sees it.</p></div>` : '';
      el.innerHTML = sum + (list.length ? '<p class="note">Ideas about the temple of 2030 or the temples to come stay a vision: use Heard or Being shaped.</p>' + list.slice(0, 40).map(x => `<div class="v7-co-review">
          <div class="v7-co-row">${chip(C.PLACE_BY[x.k], 'c-cyan')}${x.s ? chip(C.STATE_BY[x.s].t, C.STATE_BY[x.s].tone) : chip('New', 'open')}${x.off ? chip('Set aside', 'wait') : ''}<span class="v7-co-meta">${who(x.uid)} · ${esc(ago(x.t))} · ${plural(x.hearts, 'heart')} · ${plural(x.replies.length, 'reply', 'replies')}</span></div>
          <b class="v7-co-tt">${esc(x.title)}</b><p class="v7-co-body v7-co-body-s">${esc(x.tx)}</p>
          <div class="v7-co-stw"><select data-state="${esc(x.key)}" aria-label="Its state"><option value="">No state yet</option>${C.STATES.map(([k, t]) => `<option value="${k}" ${x.s === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
            <input type="text" data-snote="${esc(x.key)}" maxlength="${C.LIMIT.note}" value="${esc(x.note)}" aria-label="A short note, shown to everyone with the state" placeholder="A short note, shown with the state"><button class="btn v7-co-sm" type="button" data-co="state:${esc(x.key)}">Save</button>
            <button class="btn v7-co-sm" type="button" data-co="${x.off ? 'unoff' : 'off'}:${esc(x.key)}">${x.off ? 'Bring it back' : 'Set it aside'}</button></div>
          ${x.replies.length ? `<div class="v7-co-replies">${x.replies.map(r => `<p class="v7-co-reply${r.hidden ? ' v7-co-hid' : ''}"><span>${esc(r.tx)} <small>${esc(byOf(r.uid))} · ${esc(ago(r.t))}${r.hidden ? ' · hidden: only its writer and the stewards see it' : ''}</small></span><button class="btn ghost v7-co-sm" type="button" data-co="${r.hidden ? 'showreply' : 'hidereply'}:${esc(x.key)}" data-r="${esc(r.key)}">${r.hidden ? 'Show it' : 'Hide it'}</button></p>`).join('')}</div>` : ''}</div>`).join('')
        + `<p class="note">Setting an idea aside hides it from everyone but its writer and the stewards. A state's note is public.</p><div class="actions"><button class="btn v7-co-sm" type="button" data-co="ideascsv">${icon('save')}Download the ideas</button></div>`
        : '<p class="mv-empty v7-co-empty">No ideas shared yet.</p>');
    } },
    { id: 'co-apps', title: 'Applications', order: 30, count: () => applications().filter(a => decidable(a) && !appState(a)).length, render(el) {
      const list = applications().sort((a, b) => ((decidable(b) && !appState(b)) - (decidable(a) && !appState(a))) || b.at - a.at);
      const DOOR = { camp: 'The camp', build: 'The build', back: 'Support The Seed', notnow: 'Next year' };
      const row = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : '');
      el.innerHTML = list.length ? `<p class="note">People who applied through Take part. Give a place in the camp or the build, or put them on the waiting list: they see it in Your path. Contact details are for following up with them only.</p>` + list.slice(0, 60).map(x => {
        const s = x.s, st = appState(x), crew = s.crew && V.CREW_BY(s.crew), gate = s.gate && V.GATE_BY(+s.gate);
        return `<div class="v7-co-app"><div class="v7-co-row">${chip(DOOR[x.door] || 'Take part', 'c-yellow')}${x.door === 'camp' ? chip(s.camp === 'maybe' ? 'Maybe' : 'Yes', s.camp === 'maybe' ? 'wait' : 'done') : ''}${st ? chip(st === 'accepted' ? 'Place given' : 'On the waiting list', st === 'accepted' ? 'done' : 'now') : ''}<span class="v7-co-meta">${esc(ago(x.at))}</span></div>
          <b>${esc(x.name || 'No name given')}</b>
          <dl>${row('Contact', x.contact || 'None left')}${row('Based', C.clean(s.based, 60, true))}${row('Found Mahala', C.clean(s.heard, 60, true))}${row('Skills', (Array.isArray(s.skills) ? s.skills : []).map(z => C.clean(z, 30, true)).join(', '))}${row('When', (Array.isArray(s.when) ? s.when : []).map(z => C.clean(z, 40, true)).join(', '))}${row('Rate', s.rate === 'abroad' ? 'Abroad' : s.rate === 'local' ? 'Local' : '')}${row('Instalments', s.parts ? String(+s.parts || '') : '')}${row('Gate', gate ? `Gate ${gate.n}: ${gate.name}` : '')}${row('Crew', crew ? crew.name : '')}${row('What would change it', C.clean(s.change, 600))}${row('By when', { week: 'In a week', month: 'In a month', year: 'By the end of the year', unsure: 'Not sure yet' }[s.by] || '')}${row('A call', s.call === 'yes' ? 'Yes, please' : s.call === 'no' ? 'Not yet' : '')}${row('Next year', s.nextYear ? 'Keep them on the list' : '')}</dl>
          ${decidable(x) ? `<div class="actions"><button class="btn v7-co-sm" type="button" data-co="app" data-uid="${esc(x.uid)}" data-door="${esc(x.door)}" data-val="accepted" aria-pressed="${String(st === 'accepted')}">${icon('check')}${x.door === 'camp' ? 'Give a place in the camp' : 'Welcome to the build'}</button><button class="btn v7-co-sm" type="button" data-co="app" data-uid="${esc(x.uid)}" data-door="${esc(x.door)}" data-val="waitlisted" aria-pressed="${String(st === 'waitlisted')}">The waiting list</button>${st ? `<button class="btn ghost v7-co-sm" type="button" data-co="app" data-uid="${esc(x.uid)}" data-door="${esc(x.door)}" data-val="">Undo</button>` : ''}</div>` : ''}</div>`; }).join('')
        + `<div class="actions"><button class="btn v7-co-sm" type="button" data-p="lead:signups">${icon('save')}Download the follow-ups</button></div><p class="note">The follow-ups file holds contact details: keep it with the camp's members board, and nowhere else.</p>`
        : '<p class="mv-empty v7-co-empty">No applications yet.</p>';
    } },
    { id: 'co-leads', title: 'Crews, the bell and the camp\'s numbers', order: 40, count: () => 0, render(el) {
      if (!(V.LIVE.db && typeof V.leadTools === 'function')) { el.innerHTML = '<p class="note">These tools need the shared Mahalaverse, which cannot be reached from here.</p>'; return; }
      const box = document.createElement('div'); box.innerHTML = V.leadTools(true);
      const lt = $('.lead-tools', box), first = lt && $('.sect', lt); if (first && /fire/i.test($('h4', first) ? $('h4', first).textContent : '')) first.remove();   // the lines at the fire have their own section above
      el.replaceChildren(...box.childNodes);
    } },
  ];
  SECTIONS.forEach(s => ctx.steward.push(s));
  function countsHTML() { const n = stewardCounts();
    const go = (id, t, k) => `<button type="button" class="chip ${k ? 'now' : 'done'} v7-co-go" data-co="jump:${id}">${esc(t)}</button>`;
    return `${go('co-review', plural(n.q, 'offering') + ' to read', n.q)}${go('co-lines', plural(n.lines, 'line') + ' at the fire', n.lines)}${go('co-ideas', plural(n.ideas, 'new idea'), n.ideas)}${go('co-apps', plural(n.apps, 'application') + ' to answer', n.apps)}`; }
  // S9: every section of the stewards' tools in one row under the sheet head, with what waits in each
  const SHORT = { 'co-review': 'Offerings', 'co-lines': 'Fire', 'co-ideas': 'Ideas', 'co-apps': 'Applications', 'co-leads': 'Camp', pay: 'Gifts to The Seed', 'me-gifts': 'By hand', 'platform-removals': 'Removals' };
  const secCount = s => { try { const n = typeof s.count === 'function' ? s.count() : 0; return typeof n === 'number' && n > 0 ? Math.floor(n) : 0; } catch (e) { return 0; } };
  function secBar() {
    if (!VIEW || VIEW.name !== 'stewards' || !isSteward()) { BAR.hidden = true; return; }
    const list = ctx.steward.slice().filter(x => x && x.id).sort((a, b) => (+a.order || 0) - (+b.order || 0));
    const h = list.map(x => { const n = secCount(x), t = String(x.short || SHORT[x.id] || x.title || '');
      return `<button type="button" data-co="jump:${esc(String(x.id))}"${n ? ` class="now" aria-label="${esc(`${t}, ${n} waiting`)}"` : ''}>${esc(t)}${n ? `<span class="chip now" aria-hidden="true">${n} waiting</span>` : ''}</button>`; }).join('');
    if (BAR.innerHTML !== h) BAR.innerHTML = h;
    BAR.hidden = false;
  }
  function jumpTo(id) {
    const sec = $$('.v7-co-sec', ROOT).find(x => x.dataset.sec === id); if (!sec) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const h = $('h4', sec); if (h) setTimeout(() => h.focus({ preventScroll: true }), reduce ? 0 : 400);
  }
  function refreshStewards() {
    if (!isSteward()) { render(); return; }
    const box = $('#v7coStw', ROOT); if (!box) { render(); return; }
    const c = $('.v7-co-counts', ROOT); if (c) { const h = countsHTML(); if (c.innerHTML !== h) c.innerHTML = h; }
    secBar();
    for (const s of SECTIONS) {                                       // only this plugin's own sections redraw; other plugins' sections keep theirs
      const sec = $(`[data-sec="${s.id}"]`, box); if (!sec) continue;
      const body = $('.v7-co-other', sec), h4 = $('h4', sec); if (!body) continue;
      if (typing(sec)) { sec.dataset.pending = '1'; continue; } delete sec.dataset.pending;
      const fk = focusKey(sec), open = $$('details[open]', sec).length > 0, tmp = document.createElement('div'); try { s.render(tmp, S.me); } catch (e) { continue; }
      if (open) $$('details', tmp).forEach(d => { d.open = true; });
      if (tmp.innerHTML !== body.innerHTML) { body.replaceChildren(...tmp.childNodes); refocus(sec, fk); }
      if (h4) { let n = null; try { n = s.count(); } catch (e) { } const chipEl = $('.chip', h4); if (n > 0) { if (chipEl) chipEl.textContent = `${n} waiting`; else h4.insertAdjacentHTML('beforeend', ` <span class="chip now">${n} waiting</span>`); } else if (chipEl) chipEl.remove(); }
    }
  }
  ROOT.addEventListener('focusout', () => setTimeout(() => { for (const sec of $$('.v7-co-sec[data-pending]', ROOT)) if (!typing(sec)) { refreshStewards(); break; } }, 0));
  function renderStewardSections(box) {
    if (!box) return; box.replaceChildren();
    const list = ctx.steward.slice().sort((a, b) => (+a.order || 0) - (+b.order || 0));
    for (const s of list) {
      const sec = document.createElement('section'); sec.className = 'v7-co-sec'; sec.dataset.sec = String(s.id || '');
      const h = document.createElement('h4'); h.textContent = String(s.title || ''); h.tabIndex = -1;
      let n = null; try { n = typeof s.count === 'function' ? s.count() : null; } catch (e) { }
      if (typeof n === 'number' && n > 0) { const c = document.createElement('span'); c.className = 'chip now'; c.textContent = `${n} waiting`; h.append(' ', c); }
      const body = document.createElement('div'); body.className = 'v7-co-other';
      sec.append(h, body); box.appendChild(sec);
      try { Promise.resolve(s.render(body, Object.assign({}, S.me))).catch(e => { console.warn('co: a stewards section failed', s.id, e); body.textContent = 'This section did not load. Close the stewards\' tools and open them again.'; }); }
      catch (e) { console.warn('co: a stewards section failed', s.id, e); body.textContent = 'This section did not load. Close the stewards\' tools and open them again.'; }
    }
    secBar();
  }
  const LEAD_FIELDS = { news: '#ld-news', week: '#ld-week', firenight: '#ld-firenight', gifts: '#ld-gifts, #ld-raised, #ld-target, #ld-cur', events: '[data-ev]' };
  function leadClick(b) {                                           // the camp lead tools, as the game wrote them, run from this panel
    if (!isSteward() || b.disabled) return;
    const p = b.dataset.p.slice(5), j = p.indexOf(':'), k = j < 0 ? p : p.slice(0, j), arg = j < 0 ? undefined : p.slice(j + 1);
    if (typeof V.leadAction !== 'function') return;
    Promise.resolve(V.leadAction(k, arg, b)).then(() => { if (LEAD_FIELDS[k]) settle($$(LEAD_FIELDS[k], ROOT)); changed('leads', true); });
  }

  /* ---------- what every button does ---------- */
  async function act(spec, el, root) {
    const j = spec.indexOf(':'), a = j < 0 ? spec : spec.slice(0, j), arg = j < 0 ? '' : spec.slice(j + 1);
    if (a === 'close') { close(); return; }
    if (a === 'back') { back(); return; }
    if (a === 'open') { open(arg, { kind: el.dataset.kind, card: el.dataset.card, compose: arg === 'ideas' && el.dataset.compose === '1' }); return; }
    if (a === 'signin') { try { P().signIn(); } catch (e) { } return; }
    if (a === 'jump') { jumpTo(arg); return; }
    if (a === 'gallery' || a === 'tent' || a === 'lotus' || a === 'fire') { close(); leaveDashboard(el);
      if (a === 'fire') V.openFireside(); else V.select({ gallery: 'CO_GALLERY', tent: 'CAMP_TENT', lotus: 'CAMP_LOTUS' }[a]); return; }
    if (a === 'work') { open('work', { key: arg }); return; }
    if (a === 'drawcard') { close(); leaveDashboard(el); V.openFireside('deck'); return; }
    if (a === 'pick') { const g = el.dataset.group, val = el.dataset.val; grab(); VIEW.form[g] = val; if (g === 'card') VIEW.form.choosing = false; render();
      const f = g === 'card' ? $('#v7co-x', ROOT) : $(`[data-co="pick"][data-group="${CSS.escape(g)}"][data-val="${CSS.escape(val)}"]`, root.contains && root.contains(el) ? root : ROOT); if (f) f.focus(); return; }
    if (a === 'choosecard') { grab(); VIEW.form.choosing = true; render(); return; }
    if (a === 'compose') { grab(); VIEW.form.compose = arg === '1'; render(); if (arg !== '1') { const b = $('[data-co="compose:1"]', ROOT); if (b) b.focus(); } else { const f = $('#v7co-ti', ROOT); if (f) f.focus(); } return; }
    if (a === 'more') { grab(); VIEW.form.more = Object.assign({}, VIEW.form.more, { [arg]: true }); render(); return; }
    if (a === 'submit') { await submit(arg, el); return; }
    if (a === 'sharebook') { await shareBook(arg, el); return; }
    if (a === 'withdraw') { if (!sure(el)) return; await withdrawIt(arg, el); return; }
    if (a === 'heart') { await heart(arg, el); return; }
    if (a === 'reply') { await reply(arg, el); return; }
    if (a === 'unreply') { const uid = myId(); if (!uid || !canShare()) return; const d = C.dropReply(S.replies[uid], arg); S.replies = Object.assign({}, S.replies, { [uid]: d }); changed('replies', true); await put('replies/' + uid, d); return; }
    if (a === 'unidea') { if (!sure(el)) return; const uid = myId(); if (!uid || !canShare()) return; const p = ((S.ideas[uid] || {}).p || []).filter(x => x && x.i !== arg); S.ideas = Object.assign({}, S.ideas, { [uid]: { p } }); changed('ideas', true); await put('ideas/' + uid, { p }); toast('Your idea is taken back.'); return; }
    if (a === 'copysum') { const t = S.sum && S.sum.text; if (!t) return; try { await navigator.clipboard.writeText(t); toast('Copied.'); } catch (e) { toast('Copying is not allowed here. Select the draft and copy it by hand.'); } return; }
    if (!isSteward()) return;
    if (a === 'approve' || a === 'decline') { await decide(a, arg, el, root); return; }
    if (a === 'lineok' || a === 'linedecline') { await decideLine(a === 'lineok', arg, el); return; }
    if (a === 'takedown') { if (!sure(el)) return; await takeDown(arg, el); return; }
    if (a === 'tidy') { const [uid] = C.splitKey(arg); if (!uid) return; busy(el, true); for (const p of C.publicPaths(el.dataset.k, arg)) await del(p, true); changed('all', true); return; }
    if (a === 'state') { await setState(arg, el, root); return; }
    if (a === 'off' || a === 'unoff') { await setOff(arg, a === 'off', el); return; }
    if (a === 'hidereply' || a === 'showreply') { await hideReply(arg, el.dataset.r, a === 'hidereply'); return; }
    if (a === 'app') { await answerApp(el); return; }
    if (a === 'summarise') { await summarise(); return; }
    if (a === 'stopsum') { if (S.sum && S.sum.ctl) S.sum.ctl.abort(); return; }
    if (a === 'ideascsv') { if (typeof V.saveFile === 'function') V.saveFile('mahala-ideas.csv', C.ideasCsv(ideasNow(true))); return; }
  }
  // a second press makes it so: for taking things back and down
  function sure(el) { if (el.dataset.sure) return true; el.dataset.sure = '1'; el.dataset.was = el.innerHTML; el.textContent = 'Sure? Press again'; setTimeout(() => { if (el.isConnected && el.dataset.sure) { delete el.dataset.sure; el.innerHTML = el.dataset.was; } }, 4000); return false; }
  // from the dashboard, a place in the world: close the dashboard first, so the world is in view
  function leaveDashboard(el) {
    const m = el && el.closest && el.closest('.modal, .v7-me-panel, [role="dialog"]'); if (!m || m === ROOT || ROOT.contains(m)) return;
    const x = $('[data-me="close"], .sheet-head .x, [data-close], .x', m); if (x) x.click(); else m.hidden = true;
  }

  /* ---------- offering ---------- */
  async function addContrib(item) {
    const uid = myId(); if (!uid) return false;
    const cur = myContrib(), look = lookFor(uid);
    const items = C.prune((cur.items || []).concat([item]), C.LIMIT.items, it => { const r = C.readItem(it); return !r || C.statusOf(r.k, uid, r.i, look).s !== 'wait'; });
    S.contrib = Object.assign({}, S.contrib, { [uid]: { items } }); changed('contrib');
    const ok = await put('contrib/' + uid, { items });
    if (ok) {
      const sh = C.keepShown(S.shown[uid], item.i); S.shown = Object.assign({}, S.shown, { [uid]: sh }); await put('shown/' + uid, sh);
      S.last.set(C.keyOf(uid, item.i), 'wait'); ctx.bus.emit('contrib:added', { kind: item.k, key: C.keyOf(uid, item.i), uid, mine: true });
    } else { S.contrib = Object.assign({}, S.contrib, { [uid]: cur }); changed('contrib'); }
    return ok;
  }
  const newEntry = (kind, prompt, text, extra = {}) => Object.assign({ id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), gate: 1, kind, prompt, text, img: null, at: Date.now(), fire: false }, extra);
  function keepInBook(e) { V.ME.book.push(e); V.saveMe(); try { V.pushBook(e); } catch (er) { } return e; }
  // a book entry read back from the store is frozen: change one by putting a changed copy in its place, then save it
  function bookPatch(id, patch) {
    const b = V.ME.book, j = b.findIndex(x => x && x.id === id); if (j < 0) return null;
    const ne = Object.assign({}, b[j], patch);
    try { b[j] = ne; } catch (er) { V.ME.book = b.map((x, k) => k === j ? ne : x); }
    V.saveMe(); try { V.pushBook(ne); } catch (er) { } return ne;
  }
  async function submit(what, el) {
    grab(); const f = VIEW ? VIEW.form : {}, [kind, mode] = what.split(':');
    if (kind === 'journey') {
      const card = f.card; if (!card || !CARDS[card]) { flash(ERR.card); return; }
      const text = C.clean(f.text, C.LIMIT.journey); if (!text) { flash(ERR.text); return; }
      const c = CARDS[card], ask = C.askOf(c, f.ask) || 'q', share = !!f.share && canShare();
      const e = keepInBook(newEntry('reflect', C.questionOf(c, ask) || 'What did this card ask of you?', text, { card, ask, journey: true, fire: share }));
      if (share) { const r = C.makeItem('journey', { card, ask, text, src: e.id }, Date.now(), CARDS); busy(el, true, 'Sharing...'); const ok = r.item && await addContrib(r.item); busy(el, false);
        if (!ok) { bookPatch(e.id, { fire: false }); toast('Kept in your book. It could not be shared just now: share it later, from What you have offered.'); done(); return; } }
      V.chime('soft'); toast(share ? 'Kept in your book, and waiting for a steward to read it.' : 'Kept in your book. Only you can read it.'); done(); changed('book'); return;
    }
    if (kind === 'piece') {
      const k = f.kind === 'story' ? 'story' : 'poem', r = C.makeItem(k, { title: f.title, text: f.text }, Date.now(), CARDS);
      if (r.error) { flash(ERR[r.error] || ERR.text); return; }
      const toFire = mode === 'fire' && canShare();
      const e = keepInBook(newEntry(k, r.item.title || (k === 'poem' ? 'A poem for the fire' : 'A story for the fire'), r.item.text, { title: r.item.title, fire: toFire }));
      if (toFire) { r.item.src = e.id; busy(el, true, 'Offering...'); const ok = await addContrib(r.item); busy(el, false);
        if (!ok) { bookPatch(e.id, { fire: false }); toast('Kept in your book. It could not be offered just now: try again later.'); done(); return; } }
      V.chime('soft'); toast(toFire ? 'Offered to the fire. A steward reads it first, and a copy is in your book.' : 'Kept in your book.'); done(); changed('book'); return;
    }
    if (kind === 'idea') { await submitIdea(f, el); return; }
    if (kind === 'set') { await submitSet(f, el); return; }
    if (!canShare()) { flash(why() || ERR.text); return; }
    if (kind === 'art') {
      if (!f.blob && !String(f.url || '').trim()) { flash(ERR.art); return; }
      if (!C.clean(f.title, C.LIMIT.title, true)) { flash(ERR.title); return; }
      if (String(f.url || '').trim() && !C.safeUrl(f.url)) { flash(ERR.url); return; }
      let asset = null;
      if (f.blob) {
        busy(el, true, 'Uploading...');
        try { const p = P(), r = p && typeof p.upload === 'function' ? await p.upload(f.blob, { type: f.type }) : S.assets ? await S.assets.upload(f.blob, { type: f.type }) : null;
          if (!r || !C.assetOk(r.id)) throw { code: 'not_granted' }; asset = r.id; }
        catch (e) { busy(el, false); flash(UPLOAD_ERR[e && e.code] || UPLOAD_ERR.other); return; }
      }
      const r = C.makeItem('art', { title: f.title, text: f.text, url: f.url, asset, credit: f.credit }, Date.now(), CARDS);
      if (r.error) { busy(el, false); flash(ERR[r.error] || ERR.art); return; }
      busy(el, true, 'Offering...'); const ok = await addContrib(r.item); busy(el, false);
      if (!ok) { if (asset && S.assets) { try { await S.assets.delete(asset); } catch (e) { } } return; }
      V.chime('soft'); toast('Thank you. A steward looks at it first, then it hangs in Art by camp mates.'); done(); return;
    }
    if (kind === 'sound') {
      const r = C.makeItem('sound', { title: f.title, text: f.text, url: f.url }, Date.now(), CARDS);
      if (r.error) { flash(ERR[r.error] || ERR.url); return; }
      busy(el, true, 'Offering...'); const ok = await addContrib(r.item); busy(el, false); if (!ok) return;
      V.chime('soft'); toast('Thank you. A steward listens first, then it is listed at the Lotus Mahal.'); done(); return;
    }
  }
  async function submitSet(f, el) {
    const r = C.makeSet({ title: f.title, url: f.url, k: f.sk });
    if (r.error) { flash(ERR[r.error] || ERR.url); return; }
    if (S.db && myId()) {
      if (!canShare()) { flash(why('share music')); return; }
      const uid = myId(), d = mySounds(), list = (Array.isArray(d.p) ? d.p : []).concat([r.item]).slice(-C.LIMIT.sounds);
      busy(el, true, 'Offering...');
      const ok = await V.writeDoc('sounds/' + uid, { p: list, name: V.ME.show ? String(V.ME.name || '').slice(0, 40) : '', at: Date.now() });
      busy(el, false); if (!ok || V.LIVE.write === false) { flash('That did not save. Try again in a moment.'); return; }
      S.last.set(C.keyOf(uid, r.item.i), 'wait'); ctx.bus.emit('contrib:added', { kind: 'set', key: C.keyOf(uid, r.item.i), uid, mine: true });
      toast('Thank you. A steward listens first, then it plays in the main tent.');
    } else {
      V.V5.mySounds = V.V5.mySounds.concat([r.item]).slice(-C.LIMIT.sounds); try { localStorage.setItem('mahala.sounds', JSON.stringify(V.V5.mySounds)); } catch (e) { }
      toast('Kept in this browser, in the main tent.');
    }
    V.chime('soft'); done(); if (V.current === 'CAMP_TENT' && typeof V.refreshCard === 'function') V.refreshCard('CAMP_TENT');
  }
  async function submitIdea(f, el) {
    if (!canShare()) { flash(why('share an idea')); return; }
    const r = C.makeIdea({ title: f.title, tx: f.tx, k: f.k }); if (r.error) { flash(ERR[r.error]); return; }
    const uid = myId(), p = C.prune(((S.ideas[uid] || {}).p || []).concat([r.item]), C.LIMIT.ideas, () => false, C.LIMIT.docBytes, list => ({ p: list }));
    const btn = $('button[type="submit"]', el) || el; busy(btn, true, 'Sharing...');
    const before = S.ideas[uid]; S.ideas = Object.assign({}, S.ideas, { [uid]: { p } });
    const ok = await put('ideas/' + uid, { p });
    if (!ok) { S.ideas = Object.assign({}, S.ideas, { [uid]: before || { p: [] } }); busy(btn, false); return; }
    S.lastIdea.set(C.keyOf(uid, r.item.i), null);
    ctx.bus.emit('idea:added', { key: C.keyOf(uid, r.item.i), uid, mine: true }); V.chime('soft'); toast('Your idea is shared. Others can add their heart and reply.');
    Object.assign(VIEW.form, { title: '', tx: '', k: null, compose: false }); render(); const b = $('[data-co="compose:1"]', ROOT); if (b) b.focus();
  }
  const UPLOAD_ERR = { too_large: 'That image is too large. Try a smaller one, or share a link.', unsupported_type: 'That kind of file cannot be shared here. Try a PNG, JPEG, WebP or GIF.',
    quota_or_state: 'There is no room for more images just now. Share a link to the work instead.', not_granted: 'Uploading is not open to you here. Share a link to the work instead.',
    capability_disabled: 'Uploading is not open here. Share a link to the work instead.', capability_removed: 'Uploading is not open here. Share a link to the work instead.',
    rate_limited: 'That was a lot at once. Wait a moment and try again.', upstream_auth: 'Sign in again, then try once more.', other: 'The image did not upload. Try again, or share a link instead.' };
  async function pickFile(input) {
    const file = input.files && input.files[0]; grab(); const f = VIEW.form; f.fileErr = '';
    if (f.preview) { try { URL.revokeObjectURL(f.preview); } catch (e) { } } f.preview = null; f.blob = null;
    if (file) {
      const r = await prepImage(file);
      if (r.error) f.fileErr = { type: 'That kind of file cannot be shared here. Try a PNG, JPEG, WebP or GIF.', size: 'That image is over 10 MB. Try a smaller one.', read: 'That image could not be read. Try another one.' }[r.error];
      else { f.blob = r.blob; f.type = r.type; f.preview = URL.createObjectURL(r.blob); f.fileName = C.clean(file.name, 60, true); }
    }
    render();
  }
  // the image is drawn again before it is shared: no larger than 2048 pixels a side, and without its hidden details (where and when)
  async function prepImage(file) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type || '')) return { error: 'type' };
    if (file.size > 10 * 1024 * 1024) return { error: 'size' };
    if (file.type === 'image/gif') return { blob: file, type: 'image/gif' };   // kept as it is, so it still moves
    try {
      const bmp = await createImageBitmap(file), s = Math.min(1, 2048 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      if (type === 'image/jpeg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); }
      g.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
      const blob = await new Promise(r => cv.toBlob(r, type, 0.88));
      return blob && blob.size ? { blob, type } : { error: 'read' };
    } catch (e) { return { error: 'read' }; }
  }
  async function shareBook(entryId, el) {
    if (!canShare()) { toast(why('share it at the fire')); return; }
    const e = V.ME.book.find(x => x && x.id === entryId); if (!e || !e.card || !CARDS[e.card]) return;
    const r = C.makeItem('journey', { card: e.card, ask: e.ask, text: e.text, src: e.id }, Date.now(), CARDS); if (r.error) return;
    busy(el, true, 'Sharing...'); const ok = await addContrib(r.item); busy(el, false);
    if (ok) { bookPatch(e.id, { fire: true }); toast('Shared. It waits for a steward to read it.'); changed('all', true); }
  }
  async function withdrawIt(key, el) {
    const uid = myId(); if (!uid || !canShare()) return; const [, i] = C.splitKey(key); const it = myItems().find(x => x.key === key); if (!it || !i) return;
    busy(el, true);
    if (it.k === 'set') {
      const d = mySounds(), list = (d.p || []).filter(p => p && p.i !== i);
      await V.writeDoc('sounds/' + uid, { p: list, name: V.ME.show ? String(V.ME.name || '').slice(0, 40) : '', at: Date.now() });
    } else {
      const sh = C.unshow(S.shown[uid], i); S.shown = Object.assign({}, S.shown, { [uid]: sh }); await put('shown/' + uid, sh);   // first the yes: it hides the work at once
      const items = (myContrib().items || []).filter(x => x && x.i !== i); S.contrib = Object.assign({}, S.contrib, { [uid]: { items } }); changed('contrib');
      await put('contrib/' + uid, { items });
      if (it.src && V.ME.book.some(x => x && x.id === it.src)) bookPatch(it.src, { fire: false });   // the copy in the book is no longer offered: a reflection is private again
      if (it.asset) await dropUpload(it.asset);                       // your own uploaded picture goes with it
    }
    toast(it.st.s === 'ok' ? 'Taken back. It is hidden from everyone now, and a steward clears the copy.' : 'Taken back.'); changed('all', true);
  }

  /* ---------- hearts and replies ---------- */
  async function heart(key, el) {
    const uid = myId(); if (!canShare() || !uid) { toast(why('add your heart') || 'Sign in to add your heart.'); return; }
    const [owner] = C.splitKey(key); if (!owner || owner === uid) return;
    const d = C.toggleSupport(S.support[uid], key); S.support = Object.assign({}, S.support, { [uid]: d });
    el.setAttribute('aria-pressed', String(d.s.includes(key)));
    changed('support', true);
    await put('support/' + uid, d);
  }
  async function reply(key, form) {
    const uid = myId(), inp = $('input', form); if (!canShare() || !uid || !inp) return;
    const r = C.addReply(S.replies[uid], key, inp.value); if (r.error) { toast(ERR.reply); return; }
    inp.value = ''; inp.defaultValue = ''; S.replies = Object.assign({}, S.replies, { [uid]: r.doc });
    if (VIEW && VIEW.name === 'ideas' && ROOT.contains(form)) render(); else changed('replies', true);
    const ok = await put('replies/' + uid, r.doc);
    if (ok) { const f = form.isConnected ? $('input', form) : $(`#v7co-r-${CSS.escape(key.replace(/[^A-Za-z0-9_-]/g, '_'))}`, ROOT); if (f) f.focus(); }
  }

  /* ---------- the stewards' decisions ---------- */
  async function decide(a, key, el, root) {
    const q = queueNow().find(x => x.key === key); if (!q) { toast('Someone has already decided on that one.'); changed('all', true); return; }
    const noteEl = $$('[data-note]', root).find(x => x.dataset.note === key), note = noteEl ? noteEl.value : '';
    busy(el, true); const now = Date.now(), steward = myId() || '';
    if (a === 'approve') { for (const [path, body] of C.approval(q.uid, q.item, steward, now)) if (!(await put(path, body, true))) { busy(el, false); return; } }
    else if (!(await put('review/' + key, C.declineDoc(q.item, steward, now), true))) { busy(el, false); return; }
    if (C.clean(note, C.LIMIT.note) || a !== 'approve') await put('answer/' + q.uid, C.answerDoc(S.answer[q.uid], q.item.i, a === 'approve' ? 'ok' : 'no', note, now), true);
    toast(a === 'approve' ? `Approved: it is ${C.KINDS[q.k].home.replace(/^./, ch => ch.toLowerCase())} now.` : 'Declined. Nobody else sees it. They see your note, if you left one.');
    if (noteEl) { noteEl.value = ''; noteEl.defaultValue = ''; }
    ctx.bus.emit('contrib:reviewed', { key, kind: q.k, s: a === 'approve' ? 'ok' : 'no', owner: q.uid, by: steward });
    changed('all', true);
  }
  async function decideLine(yes, uid, el) {
    const f = linesNow().find(x => x.id === uid); if (!f) { toast('Someone has already decided on that one.'); changed('all', true); return; }
    busy(el, true);
    if (yes) {
      const at = +f.at || Date.now(), id = 'l' + Math.floor(at).toString(36);
      // no copy of a name: the fire circle shows the name its writer shows now (builders/<uid>), so a later "hide my name" holds
      const ok = await put(`hearth/${uid}~${id}`, { text: C.clean(f.text, 160, true), card: f.card && CARDS[f.card] ? f.card : null, name: '', at: Date.now() }, true);
      if (!ok) { busy(el, false); return; }
    }
    await del('fire/' + uid, true);
    V.LIVE.fire = (V.LIVE.fire || []).filter(x => x.id !== uid);
    toast(yes ? 'The line is on the hearth now.' : 'Declined. The line is gone from the fire.'); changed('all', true);
  }
  async function takeDown(key, el) {
    const p = publicNow().find(x => x.key === key); if (!p) return;
    busy(el, true); const now = Date.now();
    if (C.FIRE_KINDS.has(p.k)) await del('hearth/' + key, true);
    if (!(await put('review/' + key, { s: 'no', t: now, by: myId() || '', k: p.k }, true))) { busy(el, false); return; }
    await put('answer/' + p.uid, C.answerDoc(S.answer[p.uid], p.i, 'no', 'A steward took this down.', now), true);
    toast('Taken down.'); if (VIEW && VIEW.name === 'work') close(); changed('all', true);
  }
  async function setState(key, el, root) {
    const sel = $$('[data-state]', root).find(x => x.dataset.state === key), inp = $$('[data-snote]', root).find(x => x.dataset.snote === key);
    const s = sel ? sel.value : '', cur = S.ideaState[key] || {}; busy(el, true);
    const body = C.stateDoc(cur, { s, note: inp ? inp.value : '' }, myId());
    const ok = !body.s && !body.note && !body.off && !body.hide.length ? await del('ideaState/' + key, true) : await put('ideaState/' + key, body, true);
    busy(el, false); if (ok) { settle(sel, inp); toast(s ? `Saved: ${C.STATE_BY[s].t.toLowerCase()}.` : 'Saved.'); S.ideaState = Object.assign({}, S.ideaState, { [key]: body }); changed('ideaState', true); }
  }
  async function setOff(key, off, el) {
    busy(el, true); const body = C.stateDoc(S.ideaState[key], { off }, myId());
    const ok = await put('ideaState/' + key, body, true); busy(el, false);
    if (ok) { toast(off ? 'Set aside: only its writer and the stewards see it now.' : 'It is back for everyone.'); S.ideaState = Object.assign({}, S.ideaState, { [key]: body }); changed('ideaState', true); }
  }
  async function hideReply(key, rkey, hide) {
    const cur = S.ideaState[key] || {}, set = new Set((cur.hide || []).map(String)); if (hide) set.add(rkey); else set.delete(rkey);
    const body = C.stateDoc(cur, { hide: [...set] }, myId());
    if (await put('ideaState/' + key, body, true)) { toast(hide ? 'Hidden: only its writer and the stewards see the reply now.' : 'The reply shows for everyone again.'); S.ideaState = Object.assign({}, S.ideaState, { [key]: body }); changed('ideaState', true); }
  }
  async function answerApp(el) {
    const uid = el.dataset.uid, door = el.dataset.door, val = el.dataset.val; if (!C.segOk(uid) || !['accepted', 'waitlisted', ''].includes(val)) return;
    const f = door === 'camp' ? 'camp' : 'build'; busy(el, true); let cur = {};
    const ok = await write('answer/' + uid, async ref => {              // read, change one field, write: the stewards' notes kept there stay
      const s = await ref.get(); cur = C.answerApp(s.exists ? s.data() : {}, f, val, Date.now());
      await ref.set(cur);
    }, true);
    busy(el, false);
    if (ok) {
      S.answer = Object.assign({}, S.answer, { [uid]: cur });
      toast(!val ? 'Undone. They see it as Received again.' : val === 'accepted' ? 'Done. They see it in Your path.' : 'On the waiting list. They see it in Your path.');
      ctx.bus.emit('application:answered', { owner: uid, door, val }); changed('all', true);
    }
  }
  async function summarise() {
    if (!S.sample || (S.sum && S.sum.running)) return;
    const list = ideasNow(true).filter(x => !x.off); if (!list.length) { toast('There are no ideas to summarise yet.'); return; }
    const ctl = new AbortController(); S.sum = { running: true, text: '', note: '', ctl }; changed('summary', true);
    try {
      const r = await S.sample(C.summaryPrompt(list), { signal: ctl.signal, onText: ({ text }) => { if (!S.sum) return; S.sum.text = C.tidySummary(text); const d = document.getElementById('v7coDraft'); if (d) d.textContent = S.sum.text; } });
      S.sum = { running: false, text: C.tidySummary(r && r.text), note: r && r.truncated ? 'The draft was cut short. Try again in a moment.' : '' };
    } catch (e) {
      const c = e && e.code, keep = e && e.text ? C.tidySummary(e.text) : '';
      const note = { cancelled: '', not_granted: 'Claude is not allowed for this page in your account, so the summary is off.', sampling_disabled: 'Claude is not available for this account.', rate_limited: 'Claude is busy for your account just now. Try again later.',
        refused: 'Claude would not summarise these ideas. Read them below instead.', session_expired: 'Sign in again to ask Claude.' }[c];
      S.sum = { running: false, text: c === 'refused' ? '' : keep, note: note == null ? 'The summary did not come through. Try again in a moment.' : note };
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) S.sample = null;
      if (!S.sum.text && !S.sum.note) S.sum = null;
    }
    changed('summary', true);
  }

  /* ---------- cards in the inspector: Art by camp mates, the camp, the fire, the main tent, the Lotus Mahal ---------- */
  V.GLYPH.gallery = 'eye';
  const camp0 = () => V.REG.CAMP.focus();
  V.reg('CO_GALLERY', { kind: 'gallery', title: 'Art by camp mates', chip: 'At the camp', obj: null, anchor: 'CAMP', focus: () => (ART.view ? ART.view() : camp0()) });
  if (Array.isArray(V.INDEX)) V.INDEX.push({ id: 'CO_GALLERY', label: 'Art by camp mates', sub: 'Camp · digital art by camp mates', key: '' });
  function galleryCard() {
    const works = C.galleryWorks(S.review, S.shown);
    const tile = w => { const src = w.asset ? assetSrc(w.asset) : null, by = w.credit || 'A camp mate';
      return `<button class="v7-co-work" type="button" data-act="co:work:${esc(w.key)}" aria-label="${esc(w.title)}, ${esc(by)}"><span class="v7-co-frame${src ? ' has-img' : ''}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" data-co-img>` : `<span class="v7-co-ln">${esc(w.title)}</span>`}</span><b>${esc(w.title)}</b><small>${esc(by)}${!src && w.url ? ' · ' + esc(C.hostOf(w.url)) : ''}</small></button>`; };
    return V.head('gallery', 'Mahala camp · art by camp mates', 'Art by camp mates', 'Digital art made by camp mates') + `<div class="insp-body v7-co-gal">
      <p>Digital art made by camp mates, hung here once a steward has looked at it. Choose one to see it larger.</p>
      ${works.length ? `<div class="v7-co-works">${works.slice(0, 48).map(tile).join('')}</div>` : `<div class="mv-empty v7-co-empty"><p>${!S.db || !S.me.id ? esc(noStore('the works')) : coming('review') ? 'Gathering the works...' : 'Nothing hangs here yet. Yours could be the first.'}</p>${canShare() && !coming('review') ? `<button class="btn" type="button" data-act="co:open:art">${icon('plus')}Offer your art</button>` : ''}</div>`}
      <div class="actions">${works.length && canShare() ? `<button class="btn primary" type="button" data-act="co:open:art">${icon('plus')}Offer your art</button>` : ''}<button class="btn" type="button" data-sel="CAMP">The camp</button></div>
      <p class="note">Only work its maker offered, with the name they chose. Links open in a new tab, on the site that holds the work.</p></div>`;
  }
  const V5_TENT_NOTE = 'Everyone with the link to the Mahalaverse can see it, with your name if you chose to show your name.';
  function tentCard() {                                              // the main tent as v5 draws it, with its list filtered (HOOK7.sounds) and its line about who sees what made true
    let h = V.tentCard().replace('class="insp-body"', 'class="insp-body v7-co-tentcard"');
    if (S.db && myId()) h = h.replace(V5_TENT_NOTE, esc(canShare() ? `A steward listens first. Then it is listed here for everyone who can open the Mahalaverse, shown ${shownAs()}.` : why('share music')));
    return h;
  }
  H7.sounds = all => {
    if (!S.db || !myId()) return all;                                  // no shared list: the tent keeps sets in this browser, as it always did
    const out = C.tentList(all, S.got.review ? S.review : {}, myId(), S.answer[myId()]);
    return out.map(p => (p.st && p.st.s !== 'ok' ? Object.assign({}, p, { by: p.st.s === 'no' ? 'Yours, kept back' : 'Yours, waiting for a steward' }) : p));
  };
  function lotusSection() {
    const recs = C.recordings(S.review, S.shown);
    const row = r => `<div class="snd"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span class="snd-ic">${icon('petal')}</span><span class="snd-t"><b>${esc(r.title)}</b><small>${esc(r.text || 'A sound journey recording')} · ${esc(creditOf(r.uid))} · ${esc(C.hostOf(r.url))}</small></span>${icon('right')}</a></div>`;
    return `<div class="sect v7-co-lotus"><h4>Sound journeys from the camp</h4>${recs.length ? `<div class="snd-list">${recs.slice(0, 12).map(row).join('')}</div>` : `<p class="note">${S.db && S.me.id ? 'Recordings of sound journeys, offered by camp mates and listed here once a steward has listened. None yet.' : esc(noStore('the recordings camp mates offer'))}</p>`}
      ${canShare() ? `<div class="actions"><button class="btn" type="button" data-act="co:open:sound">${icon('plus')}Offer a recording</button></div>` : ''}</div>`;
  }
  const before = (h, extra) => { const j = h.lastIndexOf('</div>'); return j > 0 ? h.slice(0, j) + extra + h.slice(j) : h + extra; };
  H7.cardIn.push((it, h) => {
    if (it.kind === 'gallery') return galleryCard();
    if (it.kind === 'tent') return tentCard();
    if (it.kind === 'lotus') return before(V.injectTop(h, '<p class="note strong">Sound journeys gather here. Dates and guests are announced once they are confirmed.</p>'), lotusSection());   // v5's line, then the recordings
    if (it.kind === 'camp') return before(h, `<div class="sect v7-co-made"><h4>Made by camp mates</h4><p>Digital art, poems, stories and music from the people of the camp.</p>
      <div class="actions"><button class="btn" type="button" data-act="co:gallery">${icon('eye')}Art by camp mates</button><button class="btn" type="button" data-act="co:open:offer">${icon('gift')}Offer something</button></div></div>`);
    if (it.kind === 'fire') return before(h, `<div class="sect v7-co-made"><h4>Offer yours</h4><p>Written a poem or a story? A steward reads it first, then it joins the pieces at the fire.</p>
      <div class="actions"><button class="btn" type="button" data-act="co:open:piece">${icon('pen')}Offer a poem or a story</button></div></div>`);
    return null;
  });
  H7.act.push((a, el) => { if (!a.startsWith('co:')) return; act(a.slice(3), el, M.inspector); return true; });
  // the main tent's own form (v5) saves the set; here it says what happens next
  let tentOk = false;
  M.inspector.addEventListener('submit', e => { if (e.target.id !== 'sndForm') return; const t = $('#snd-t'), u = $('#snd-u'); tentOk = !!(t && t.value.trim() && C.safeUrl(u && u.value)); }, true);
  M.inspector.addEventListener('submit', e => { if (e.target.id !== 'sndForm' || !tentOk) return; tentOk = false;
    if (canShare()) setTimeout(() => { toast('Thank you. A steward listens first, then it plays in the tent for everyone.'); ctx.bus.emit('contrib:added', { kind: 'set', uid: myId(), mine: true }); }, 0); });

  /* ---------- a few framed works in the world, at the camp: the newest images a steward hung ---------- */
  const ART = { group: null, keys: '', meshes: [], tex: [], view: null };
  function wayFrame(s) { const T = M.THREE, p = M.wayP(s), a = M.wayP(Math.max(0, s - 0.6)), b = M.wayP(s + 0.6), t = b.clone().sub(a).setY(0).normalize(); return { p, t, n: new T.Vector3(-t.z, 0, t.x) }; }
  function artTexture(src, title) {                                  // the work, fitted into a square canvas on a dark mount; its title if it cannot be shown
    const T = M.THREE, cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    // a work that cannot be shown keeps the panel tile's own card: a pastel ground in one of The Seed's colours, and its
    // title in the display face, as large as it fits (from about 0.28 of the frame's width), so it never reads as a dark screen
    const face = (getComputedStyle(document.documentElement).getPropertyValue('--display') || '').trim() || 'Georgia, serif';
    const tint = ['rgba(255, 216, 31, 0.30)', 'rgba(20, 168, 224, 0.24)', 'rgba(216, 25, 127, 0.20)'][[...String(title || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 3];
    const wrap = (size, words) => { g.font = `${size}px ${face}`; const out = []; let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 432 && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line);
      return out; };
    const paint = img => {
      if (img) { g.fillStyle = '#1d1712'; g.fillRect(0, 0, 512, 512); const s = Math.min(472 / img.width, 472 / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h); return; }
      g.fillStyle = '#f4ede1'; g.fillRect(0, 0, 512, 512);
      const gr = g.createLinearGradient(80, 0, 432, 512); gr.addColorStop(0, tint); gr.addColorStop(1, 'rgba(244, 237, 225, 0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      const words = String(title || 'Art by camp mates').split(/\s+/).filter(Boolean); let size = Math.round(512 * 0.28), lines = wrap(size, words);
      while (size > 40 && (lines.length > 3 || lines.length * size * 1.15 > 340 || lines.some(l => g.measureText(l).width > 448))) { size -= 6; lines = wrap(size, words); }
      g.fillStyle = '#2b211a'; g.textAlign = 'center'; g.textBaseline = 'middle'; const lh = size * 1.15, y0 = 236 - ((lines.length - 1) * lh) / 2;
      lines.slice(0, 3).forEach((l, i) => g.fillText(l, 256, y0 + i * lh));
      g.font = `26px ${face}`; g.fillStyle = '#7a6c5c'; g.fillText('Art by camp mates', 256, 452);
    };
    paint(null); const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; ART.tex.push(tex);
    if (src) { const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
      im.onload = () => { try { paint(im); tex.needsUpdate = true; } catch (e) { paint(null); tex.needsUpdate = true; } };   // a picture from elsewhere that cannot be drawn keeps the title card
      im.onerror = () => { };                                         // not served to this viewer, or taken away: the title card stays
      im.src = src; }
    return tex;
  }
  function clearFrames() {
    if (!ART.group) return;
    const P2 = M.PICKABLE || [];
    for (const m of ART.meshes) { const j = P2.indexOf(m); if (j >= 0) P2.splice(j, 1); }
    ART.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(x => x.dispose()); } });
    ART.tex.forEach(t => t.dispose()); ART.tex = []; ART.meshes = [];
    M.scene.remove(ART.group); ART.group = null; ART.view = null; delete V.REG.CO_GALLERY.meshes;
  }
  function syncFrames() {
    const T = M.THREE; if (!T || !M.scene || typeof M.wayP !== 'function' || !M.ST || !(M.ST.camp > 0)) return;
    const works = C.galleryWorks(S.review, S.shown).filter(w => w.asset).slice(0, 3);
    const keys = works.map(w => w.key).join('|'); if (keys === ART.keys) return; ART.keys = keys;
    clearFrames(); if (!works.length) return;
    const g = new T.Group(); g.name = 'co-art';
    const wood = new T.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 }), S0 = M.ST.camp - 9.5, OFF = 4.4;
    const box = (w, h, d, x, y, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
    works.forEach((w, j) => {
      const s = S0 + j * 2.7, f = wayFrame(s), at = f.p.clone().addScaledVector(f.n, OFF), d = f.p.clone().sub(at);
      const fr = new T.Group(); fr.position.copy(at); fr.rotation.y = Math.atan2(d.x, d.z);
      const tex = artTexture(assetSrc(w.asset), w.title);
      const art = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), new T.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 }));
      art.position.set(0, 1.45, 0.045); fr.add(art);
      fr.add(box(1.26, 0.08, 0.08, 0, 2.04, 0, wood), box(1.26, 0.08, 0.08, 0, 0.86, 0, wood), box(0.08, 1.26, 0.08, -0.59, 1.45, 0, wood), box(0.08, 1.26, 0.08, 0.59, 1.45, 0, wood));
      fr.add(box(0.07, 2.1, 0.07, -0.5, 1.05, -0.06, wood), box(0.07, 2.1, 0.07, 0.5, 1.05, -0.06, wood));
      fr.traverse(o => { if (o.isMesh) { o.userData.pick = 'CO_GALLERY'; ART.meshes.push(o); } });
      g.add(fr);
    });
    M.scene.add(g); ART.group = g; (M.PICKABLE || []).push(...ART.meshes);
    V.REG.CO_GALLERY.meshes = [g];
    // the view: from across the way and above, at a point over the way in front of the works. The together layer stands
    // "You" under that point, so the figure is seen below and in front of the works, never over them
    const mid = S0 + (works.length - 1) * 1.35, at = M.wayP(mid).setY(2.6);
    ART.view = () => (typeof V.wayLook === 'function' ? V.wayLook(mid, at, { d: 7 + (works.length - 1) * 1.4, p: 1.0, back: 0.12, side: -1 }) : camp0());
  }
  let nightAt = 0;
  if (Array.isArray(M.hooks)) M.hooks.push(() => {                    // after dark the works glow softly, as if a lamp were on them
    if (!ART.group || ++nightAt % 30) return;
    const n = (M.state && M.state().night) || 0; ART.group.traverse(o => { if (o.isMesh && o.material && o.material.emissiveMap) o.material.emissiveIntensity = 0.06 + 0.5 * n; });
  });

  /* ---------- the ways in: the menu, the way, the old path panel, the drawn card, the other plugins ---------- */
  const MENU = $('#menuPop');
  function menuItems() {
    if (!MENU || MENU.hidden || $('.v7-co-m', MENU)) return;
    const n = isSteward() ? stewardCounts().all : 0;
    MENU.insertAdjacentHTML('beforeend', `<div class="v7-co-sep" aria-hidden="true"></div><button type="button" class="v7-co-m" data-m="co-offer">${icon('gift')}Offer something</button><button type="button" class="v7-co-m" data-m="co-gallery">${icon('eye')}Art by camp mates</button><button type="button" class="v7-co-m" data-m="co-ideas">${icon('light')}Ideas</button>${isSteward() ? `<button type="button" class="v7-co-m" data-m="co-stewards">${icon('tools')}Stewards' tools${n ? chip(n + ' waiting', 'now') : ''}</button>` : ''}`);
    const mb = $('#menuBtn');
    if (innerWidth > 760 && mb) { const r = mb.getBoundingClientRect(); MENU.style.top = Math.round(r.bottom + 8) + 'px'; MENU.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px'; }
    else { MENU.style.top = ''; MENU.style.right = ''; }
  }
  if (MENU) {
    new MutationObserver(() => menuItems()).observe(MENU, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    MENU.addEventListener('click', e => { const b = e.target.closest('[data-m^="co-"]'); if (!b) return; const k = b.dataset.m.slice(3);
      if (k === 'gallery') V.select('CO_GALLERY'); else open(k); });
  }
  const WAYI = k => V.WAY.findIndex(s => s.id === k);
  { const camp = V.WAY[WAYI('camp')], mahal = V.WAY[WAYI('mahal')], drift = V.WAY[WAYI('drift')];
    if (camp && !camp.acts.some(x => x[0] === 'co-gallery')) { const j = camp.acts.findIndex(x => x[0] === 'camppage'); camp.acts.splice(j < 0 ? camp.acts.length : j, 0, ['co-gallery', 'eye', 'Art by camp mates']); }
    if (mahal && !mahal.acts.some(x => x[0] === 'co-sound')) mahal.acts.push(['co-sound', 'petal', 'Sound journeys from the camp']);
    if (drift && !drift.acts.some(x => x[0] === 'co-piece')) drift.acts.push(['co-piece', 'pen', 'Offer a poem or a story']); }
  const WAYEL = $('#way');
  function wayLine() {
    if (!WAYEL || V.WY.i !== V.WAY.length - 1 || $('.v7-co-wayline', WAYEL)) return;
    const inn = $('.way-in', WAYEL); if (!inn) return;
    const p = document.createElement('p'); p.className = 'v7-co-wayline';
    p.innerHTML = '<button type="button" data-w="co-ideas">Something you would add to the Mahalaverse? Share an idea.</button>'; inn.appendChild(p);
  }
  if (WAYEL) new MutationObserver(wayLine).observe(WAYEL, { childList: true });
  try { if (!document.body.classList.contains('insp-on')) V.renderWay(); wayLine(); } catch (e) { }
  document.addEventListener('click', e => {
    const w = e.target.closest('#way [data-w^="co-"]');
    if (w) { const k = w.dataset.w.slice(3); if (k === 'gallery') V.select('CO_GALLERY'); else if (k === 'sound') V.select('CAMP_LOTUS'); else open(k); return; }
    const o = e.target.closest('[data-co-open]');
    if (o && !ROOT.contains(o)) { const pm = $('#pathModal'); if (pm && !pm.hidden && pm.contains(o)) { const x = $('#pathClose'); if (x) x.click(); } open(o.dataset.coOpen); }
  });
  H7.stewardTools = () => `<div class="lead-tools"><span class="eyebrow">For stewards</span><p class="note" style="margin:0">Everything stewards look after is in one place now: offerings to read, lines at the fire, ideas, applications, and the crews, the bell and the camp's numbers.</p><div class="actions"><button class="btn" type="button" data-co-open="stewards">${icon('tools')}Open the stewards' tools</button></div></div>`;
  H7.journey = key => open('journey', { card: key && CARDS[key] ? key : null });
  ctx.bus.on('steward:open', () => open('stewards'));
  ctx.bus.on('auth:changed', m => { if (!S.connected || !m) return;
    if ((m.id || null) !== S.me.id || !!m.isSteward !== !!S.me.isSteward || (m.canWrite !== false) !== S.me.canWrite || m.changing) connect(); });

  /* ---------- the dashboard: what you have offered, and your ideas ---------- */
  const MOUNTS = new Set();
  function dashOffered() {
    return `<div class="v7-co-dash">${stateLine('offer your work', S.db ? '' : 'Soul journey reflections can still be kept in this browser.')}${choicesHTML(true)}${offeredList()}
      <p class="note">Everything you offer waits for a steward before anyone else sees it. Only you see this list.</p>
      <div class="actions"><button class="btn v7-co-sm" type="button" data-co="gallery">${icon('eye')}Art by camp mates</button></div></div>`;
  }
  function dashIdeas() {
    const uid = myId(), mine = uid ? ideasNow().filter(x => x.mine) : [];
    return `<div class="v7-co-dash">${mine.length ? `<div class="v7-co-list">${mine.map(x => { const st = x.s ? C.STATE_BY[x.s] : null;
        return `<div class="v7-co-item"><div><span class="v7-co-k">${esc(C.PLACE_BY[x.k])} · ${esc(ago(x.t))}</span><b class="v7-co-ti">${esc(x.title)}</b></div>${x.off ? chip('Set aside by a steward', 'wait') : st ? chip(st.t, st.tone) : chip('Waiting to be heard', 'wait')}
          <p class="v7-co-host">${esc(plural(x.hearts, 'heart'))} · ${esc(plural(x.replies.length, 'reply', 'replies'))}</p>${x.note ? `<p class="v7-co-say"><b>From the stewards:</b> ${esc(x.note)}</p>` : ''}</div>`; }).join('')}</div>`
      : `<div class="mv-empty v7-co-empty"><p>${canShare() ? 'No ideas from you yet. What would you add to the Mahalaverse?' : esc(why('share an idea') || 'Your ideas show here.')}</p>${canShare() ? `<button class="btn v7-co-sm" type="button" data-co="open:ideas" data-compose="1">${icon('plus')}Share an idea</button>` : ''}</div>`}
      <div class="actions">${mine.length && canShare() ? `<button class="btn v7-co-sm primary" type="button" data-co="open:ideas" data-compose="1">${icon('plus')}Share an idea</button>` : ''}<button class="btn v7-co-sm" type="button" data-co="open:ideas">${icon('light')}Ideas for the Mahalaverse</button></div></div>`;
  }
  function mount(el, which) {
    if (!el) return; el.dataset.coMount = which; MOUNTS.add(el);
    el.innerHTML = which === 'offered' ? dashOffered() : dashIdeas();
    if (!el.__co) { el.__co = true; el.addEventListener('click', e => { const b = e.target.closest('[data-co]'); if (b && b !== el && !b.disabled) act(b.dataset.co, b, el); }); }
  }
  ctx.dashboard.push({ id: 'co-offered', title: 'What you have offered', order: 40, render: el => mount(el, 'offered'), export: () => exportMine(), erase: () => eraseMine() });
  ctx.dashboard.push({ id: 'co-ideas', title: 'Your ideas', order: 50, render: el => mount(el, 'ideas') });
  // a copy of everything this plugin keeps about you: what you offered and where it stands, your ideas, hearts, replies and the stewards' notes to you
  async function exportMine() {
    const uid = myId(); if (!uid || !S.db) return { note: 'What you offered and your ideas live in the shared Mahalaverse, which cannot be reached from here.' };
    return { offered: myItems().filter(x => !x.book).map(x => ({ kind: x.k, title: x.title, text: x.text || '', link: x.url || '', credit: x.credit || '', state: x.st.label, where: x.st.where || '', note: x.st.note || '', at: x.t > 0 && x.t < 8.64e15 ? new Date(x.t).toISOString() : '' })),
      ideas: ((S.ideas[uid] || {}).p || []).map(x => ({ idea: C.clean(x.title, C.LIMIT.title, true), what: C.clean(x.tx, C.LIMIT.idea), where: C.PLACE_BY[x.k] || '', state: ((S.ideaState[C.keyOf(uid, x.i)] || {}).s) || 'new', at: x.t > 0 && x.t < 8.64e15 ? new Date(x.t).toISOString() : '' })),
      hearts: ((S.support[uid] || {}).s || []).length, replies: ((S.replies[uid] || {}).r || []).map(r => ({ text: C.clean(r.tx, C.LIMIT.reply, true), at: r.t > 0 && r.t < 8.64e15 ? new Date(r.t).toISOString() : '' })) };
  }
  // deleting your data: your yes to what is shown first (so a steward's public copy hides at once), then your offerings, ideas,
  // hearts and replies. The stewards' tools list what was hidden this way, for a steward to clear (only stewards write those)
  // an upload of your own, deleted (best effort: a file someone else uploaded, or a runtime without uploads, is left alone)
  async function dropUpload(id) {
    if (!C.assetOk(id) || !S.assets || typeof S.assets.delete !== 'function') return;
    try { await S.assets.delete(id); } catch (e) { if (!e || e.code !== 'not_uploader') console.warn('co: the upload was not deleted', e && e.code); }
  }
  async function eraseMine() {
    const uid = myId(); if (!uid || !S.db) return;
    for (const it of (myContrib().items || [])) if (it && it.asset) await dropUpload(it.asset);
    const ok = [await del('shown/' + uid), await del('contrib/' + uid), await del('ideas/' + uid), await del('support/' + uid), await del('replies/' + uid)];
    if (ok.includes(false)) throw new Error('Some of what you offered could not be deleted.');
  }

  /* ---------- gifts: Co-creator, when an idea of yours is built; and the counts the gift rules read ---------- */
  ctx.gifts.push({ id: 'co-creator', title: 'Co-creator', kind: 'badge', icon: 'seed', why: 'For an idea you shared that was built in the Mahalaverse.', test: s => !!s && (+s.ideasBuilt || 0) > 0 });
  const giftState = async me => C.giftState((me && me.id) || myId(), { hearth: V.LIVE.hearth || [], review: S.review, ideas: S.ideas, states: S.ideaState, shown: S.shown, sounds: V.V5.sounds || [] });
  if (!Array.isArray(ctx.giftState)) ctx.giftState = [];
  if (!ctx.giftState.includes(giftState)) ctx.giftState.push(giftState);

  /* ---------- keeping every view in step with the data, one pass at a time ---------- */
  let tick = null;
  function changed(what, now = false) {
    if (tick && !now) return; clearTimeout(tick);
    tick = setTimeout(() => { tick = null; flush(); }, now ? 0 : 40);
  }
  let mending = false;
  function mendShown() {                                             // what you offered and never took back is yours to show: put back an id a failed write lost
    const uid = myId(); if (!uid || mending || !S.got.shown || !S.got.contrib || !canShare()) return;
    const have = new Set(((S.shown[uid] || {}).s || []).map(String)), miss = ((myContrib().items) || []).filter(it => it && C.idOk(String(it.i)) && !have.has(String(it.i)));
    if (!miss.length) return;
    let d = S.shown[uid]; for (const it of miss) d = C.keepShown(d, it.i);
    mending = true; S.shown = Object.assign({}, S.shown, { [uid]: d }); put('shown/' + uid, d).finally(() => { mending = false; });
  }
  function flush() {
    syncPieces(); mendShown(); try { syncFrames(); } catch (e) { console.warn('co: the framed works', e); }
    if (!ROOT.hidden && VIEW && VIEW.name === 'stewards' && $('#v7coStw', ROOT)) refreshStewards();
    else if (!ROOT.hidden && VIEW) { if (typing(ROOT)) VIEW.pending = true; else render(); }
    for (const el of [...MOUNTS]) { if (!el.isConnected) { MOUNTS.delete(el); continue; } if (!typing(el)) mount(el, el.dataset.coMount); }
    const cur = V.current, sig = CARD_SIG[cur];                       // the card open in the inspector redraws only when what it shows changed
    if (sig && typeof V.refreshCard === 'function') { let s = ''; try { s = sig(); } catch (e) { } if (s !== cardSeen[cur]) { cardSeen[cur] = s; try { V.refreshCard(cur, true); } catch (e) { } } }
    noteStatuses();
  }
  const cardSeen = {};
  const CARD_SIG = {
    CO_GALLERY: () => JSON.stringify([C.galleryWorks(S.review, S.shown).map(w => [w.key, w.title, w.credit, w.text]), canShare(), !!S.db, !!S.got.review]),
    CAMP_TENT: () => JSON.stringify([Object.entries(S.review).filter(([, r]) => r && r.k === 'set'), answersOf(myId()), canShare(), !!S.got.review]),
    CAMP_LOTUS: () => JSON.stringify([C.recordings(S.review, S.shown).map(r => [r.key, r.title, r.text]), canShare(), !!S.db]),
    CAMP_FIRE: () => V.FIRESIDE.map(p => p.id).join('|'),
  };

  const api = { open, close, state: S, refresh: () => changed('all', true), connect, views: Object.keys(VIEWS), frames: () => ({ keys: ART.keys, n: ART.group ? ART.group.children.length : 0 }),
    _setSample: fn => { S.sample = fn; changed('all', true); } };
  ctx.co = api;
  connect().catch(e => console.warn('co: could not connect', e && e.code));
  return api;
}
