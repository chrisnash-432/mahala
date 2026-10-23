/* v7 platform plugin: who is viewing, and how data is reached, wherever the Mahalaverse runs.
     claude.ai        the platform gives window.claude and says who you are (the page adds nothing to its top bar)
     standalone       Mahala's own site: standalone/shim/claude-shim.js gives the same window.claude.use() on Supabase,
                      and this plugin adds an account chip to the top bar (on the phone, items in its menu)
     solo             no runtime at all (a saved copy, or a site without accounts): the world works on its own
   Other plugins reach data only through ctx.platform (CONTRACT.md section 5):
     mode, ready, use(name), me(), onAuth(fn), signIn(), signOut(), doc(path), collection(path), upload(blob) */

const WAIT_MS = 10000;                                               // a silent host: claude.ai's use() answers null after 10 s
const NOOP = () => { };
const later = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
const NO_STORE = Object.freeze({ code: 'not_granted', message: 'There is no shared store on this page.' });
const COPY = {
  signIn: 'Sign in', you: 'A builder', dashboard: 'Your path', account: 'Account and privacy', signOut: 'Sign out',
  menuLabel: 'Your account', signedInAs: 'Signed in as', deleteAccount: 'Delete my account',
  // on claude.ai a viewer who cannot write cannot be let in from the page: say so, and give the camp's own address
  claudeSignIn: 'You can look around from this link, but not take part yet. To take part, write to the camp at wearemahala@gmail.com.',
  claudeSignedOut: 'You can look around from this link, but not take part yet. To take part, write to the camp at wearemahala@gmail.com.',
  claudeWriter: 'You are signed in through claude.ai, so you can take part here already.',
  claudeSignOut: 'You are signed in through claude.ai: sign out there.',
  soloSignIn: 'This copy of the Mahalaverse runs on its own, so there is no account to sign in to here.',
  noSheet: 'Signing in is not available right now. Reload the page to try again.',
  nowIn: 'You are signed in. Opening your Mahalaverse...', nowOut: 'You are signed out.',
  removalsTitle: 'Account removals',
  removalsNone: 'Nobody is waiting for their account to be removed.',
  removalsLead: 'These builders deleted their account here, and what they kept here is gone, but their sign-in (an email address) could not be removed by itself. Ask whoever runs the site\'s Supabase project to remove it: Authentication, Users, search for the id, then Delete user (and first, in Storage, any files listed here).',
  removalsFiles: n => (n === 1 ? 'One file is left in Storage.' : `${n} files are left in Storage.`),
  removalsAsked: d => `Asked on ${d}`,
  removalsDone: 'Removed in Supabase', removalsCopy: 'Copy the id', removalsCopied: 'The id is copied.',
  rulesDiffer: 'For stewards: this site\'s rules and its database\'s rules differ, so some posts may be refused. Whoever runs the site should run the latest rules file in Supabase (the deploy guide: "When the rules change").',
};
const CSS = `
.v7-platform-chip { display: inline-flex; align-items: center; gap: 8px; height: 38px; max-width: 200px; padding: 0 10px 0 5px; border-radius: 999px; border: 1px solid var(--card-line); background: none; color: var(--ink); flex: none; font: inherit; font-size: 13.5px; font-weight: 500; }
.v7-platform-chip:hover, .v7-platform-chip[aria-expanded="true"] { background: var(--hover); }
.v7-platform-chip .v7-platform-av { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--c, var(--cyan)); color: #fff; font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; }
.v7-platform-chip .v7-platform-nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v7-platform-chip svg.i { width: 15px; height: 15px; color: var(--ink-3); }
.v7-platform-chip.v7-platform-out { padding: 0 14px; gap: 7px; }
.v7-platform-chip.v7-platform-out svg.i { width: 16px; height: 16px; color: var(--ink-2); }
.v7-platform-menu { position: absolute; top: calc(70px + env(safe-area-inset-top, 0px)); width: 260px; padding: 6px; display: grid; gap: 2px; z-index: 8; }
.v7-platform-menu .v7-platform-who { padding: 8px 10px 9px; font-size: 12px; color: var(--ink-3); border-bottom: 1px solid var(--card-line); margin-bottom: 4px; overflow-wrap: anywhere; }
.v7-platform-menu .v7-platform-who b { display: block; font-size: 13.5px; font-weight: 500; color: var(--ink); }
.v7-platform-menu button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 0 10px; border: 0; background: none; border-radius: 10px; text-align: left; color: var(--ink); font: inherit; font-size: 14px; }
.v7-platform-menu button:hover, .v7-platform-menu button:focus-visible { background: var(--hover); }
.v7-platform-menu button svg.i { color: var(--ink-2); }
.menupop .v7-platform-sep, .v7-platform-menu .v7-platform-msep { height: 1px; background: var(--card-line); margin: 4px 6px; }
.v7-platform-menu button.v7-platform-quiet { color: var(--ink-2); font-size: 13px; min-height: 36px; }
@media (max-width: 760px) { .v7-platform-chip, .v7-platform-menu { display: none !important; } }
@media (min-width: 761px) { .menupop .v7-platform-item, .menupop .v7-platform-sep { display: none !important; } }
.v7-platform-rm { display: grid; gap: 10px; }
.v7-platform-rm p { margin: 0; color: var(--ink-2); font-size: 13.5px; }
.v7-platform-rm ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.v7-platform-rm li { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--card-line); border-radius: 12px; }
.v7-platform-rm code { font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; color: var(--ink); }
.v7-platform-rm small { color: var(--ink-3); font-size: 12px; }
.v7-platform-rm .v7-platform-acts { display: flex; gap: 8px; flex-wrap: wrap; }
`;

export async function start(M, ctx) {
  const WAIT = Number(globalThis.__MV_PLATFORM_WAIT_MS) > 0 ? Number(globalThis.__MV_PLATFORM_WAIT_MS) : WAIT_MS;   // tests only
  const C = window.claude;
  const mode = !C || typeof C.use !== 'function' ? 'solo' : C.__standalone === true ? 'standalone' : 'claude';
  const AUTH = mode === 'standalone' && C.__auth && typeof C.__auth.info === 'function' ? C.__auth : null;
  const toast = t => { try { (M.toast || (M.v7 && M.v7.toast))(t); } catch (e) { } };
  const icon = n => { try { return M.icon(n); } catch (e) { return ''; } };
  const esc = s => (M.esc ? M.esc(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  /* ---------------------------------------------------------- capabilities ---------------------------------------- */
  const memo = new Map();
  const use = name => {
    if (mode === 'solo') return Promise.resolve(null);
    if (!memo.has(name)) memo.set(name, Promise.resolve().then(() => C.use(name)).then(v => v || null, () => null));
    return memo.get(name);
  };
  const ready = mode === 'solo' ? Promise.resolve() : Promise.race([Promise.all([use('user'), use('db')]), later(WAIT)]).then(NOOP, NOOP);

  let refused = false;                                              // a well-formed write was refused: read-only from now
  const liveRefused = () => { try { return !!(M.v7 && M.v7.LIVE && M.v7.LIVE.write === false); } catch (e) { return false; } };
  let meP = null;
  async function computeMe() {
    const [db, user] = await Promise.all([use('db'), use('user')]);
    if (!user) return { id: null, name: '', signedIn: false, canWrite: false, isSteward: false, isOwner: false, guest: false };
    let v = {}, can = null, owner = false, edit = false, guest = false;
    try { [v, can, owner, edit] = await Promise.all([user.me(), user.can('data.write'), user.isOwner(), user.canEdit()]); } catch (e) { }
    const id = (v && v.id) || null;
    if (id) { try { const ps = await user.profiles([id]); guest = !!(ps && ps[id] && ps[id].guest); } catch (e) { } }
    // canWrite is user.can('data.write'), where null (the platform said nothing) counts as yes for a viewer with an id,
    // until a well-formed write is refused (CONTRACT.md section 5); with no store there is nothing to write to
    return { id, name: (v && v.name) || '', signedIn: !!id, canWrite: !!(db && (can === true || (can !== false && id))), isSteward: !!edit, isOwner: !!owner, guest };
  }
  const NOBODY = Object.freeze({ id: null, name: '', signedIn: false, canWrite: false, isSteward: false, isOwner: false, guest: false });
  async function me() {
    if (!meP) {
      const p = meP = Promise.race([computeMe(), later(WAIT + 2000, null)]).then(m => m, () => null);
      p.then(m => { if (!m && meP === p) meP = null; });               // a silent host: answer "nobody" now, ask again next time
    }
    const m = (await meP) || NOBODY;
    return Object.assign({}, m, { canWrite: m.canWrite && !refused && !liveRefused() });
  }

  /* ---------------------------------------------------------- sign in and out ------------------------------------- */
  const authFns = new Set();
  let fired = false;
  const call = (f, m) => { try { f(m); } catch (e) { console.warn('v7 platform onAuth', e); } };
  function onAuth(fn) {
    if (typeof fn !== 'function') return NOOP;
    authFns.add(fn);
    if (fired) me().then(m => { if (authFns.has(fn)) call(fn, m); });
    return () => { authFns.delete(fn); };
  }
  ready.then(() => me()).then(m => { fired = true; for (const f of [...authFns]) call(f, m); try { ctx.bus.emit('auth:changed', m); } catch (e) { } });
  if (AUTH && typeof AUTH.onChange === 'function') {
    AUTH.onChange(ev => {                                            // the shim starts the page again as the new person
      toast(ev && ev.signedIn ? COPY.nowIn : COPY.nowOut);
      me().then(m => {
        const next = Object.assign({}, m, ev && ev.signedIn ? {} : { id: null, name: '', signedIn: false }, { canWrite: false, changing: true });
        for (const f of [...authFns]) call(f, next);
        try { ctx.bus.emit('auth:changed', next); } catch (e) { }
      });
    });
  }
  function openSheet(m) {
    if (!AUTH) return Promise.resolve();
    return AUTH.open(m).catch(() => toast(COPY.noSheet));
  }
  function signIn() {
    if (mode === 'standalone') { openSheet('signin'); return; }
    if (mode === 'claude') { me().then(m => toast(m.canWrite ? COPY.claudeWriter : m.signedIn ? COPY.claudeSignIn : COPY.claudeSignedOut)); return; }
    toast(COPY.soloSignIn);
  }
  function signOut() {
    if (mode === 'standalone' && AUTH) { AUTH.signOut().catch(NOOP); return; }
    if (mode === 'claude') toast(COPY.claudeSignOut);
  }

  /* ---------------------------------------------------------- refs that wait for the store ------------------------ */
  function checkPath(path, doc) {
    if (typeof path !== 'string' || !path) throw new TypeError(`${doc ? 'doc' : 'collection'}: the path must be a non-empty string`);
    const s = path.split('/');
    if (s.length > 16 || s.some(x => !x || x === '.' || x === '..' || !SEG.test(x))) throw new TypeError(`${doc ? 'doc' : 'collection'}: not a valid path: ${path}`);
    if ((s.length % 2 === 0) !== doc) throw new TypeError(`${doc ? 'doc: a document path needs an even' : 'collection: a collection path needs an odd'} number of segments (${s.length}): ${path}`);
    return s;
  }
  const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const meta = Object.freeze({ fromCache: true, hasPendingWrites: false });
  const emptyDoc = id => Object.freeze({ id, exists: false, data: () => undefined, metadata: meta });
  const emptyQuery = () => Object.freeze({ docs: Object.freeze([]), size: 0, empty: true, docChanges: () => Object.freeze([]), metadata: meta });
  const autoId = () => { const a = new Uint8Array(20); crypto.getRandomValues(a); const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; return [...a].map(x => abc[x % abc.length]).join(''); };
  function noteRefusal(e, body) {
    if (e && (e.code === 'not_granted' || e.code === 'revoked' || (e.code === 'invalid_argument' && (body === undefined || isPlain(body))))) {
      if (!refused) { refused = true; meP = null; }
    }
  }
  function lazyDoc(path) {
    const s = checkPath(path, true), id = s[s.length - 1];
    const real = () => use('db').then(db => (db ? db.doc(path) : null));
    const write = verb => async (arg) => {
      const r = await real(); if (!r) throw NO_STORE;
      try { return await r[verb](arg); } catch (e) { if (verb !== 'acquire') noteRefusal(e, arg); throw e; }
    };
    return Object.freeze({
      id, path,
      get: async () => { const r = await real(); return r ? r.get() : emptyDoc(id); },
      set: write('set'), update: write('update'), delete: write('delete'), acquire: write('acquire'),
      onSnapshot(next, error) {
        if (typeof next !== 'function') throw new TypeError('onSnapshot needs a function');
        let un = null, dead = false;
        real().then(r => { if (dead) return; if (!r) { next(emptyDoc(id)); return; } un = r.onSnapshot(next, error); }, e => { if (!dead && typeof error === 'function') error(e); });
        return () => { dead = true; if (un) { un(); un = null; } };
      },
      collection: sub => lazyCollection(path + '/' + sub),
    });
  }
  function lazyQuery(path, ops) {
    const real = () => use('db').then(db => { if (!db) return null; let q = db.collection(path); for (const [k, a] of ops) q = q[k](...a); return q; });
    const add = (k, a) => lazyQuery(path, ops.concat([[k, a]]));
    return {
      where: (f, op, v) => add('where', [f, op, v]), orderBy: (f, d) => add('orderBy', d === undefined ? [f] : [f, d]), limit: n => add('limit', [n]),
      get: async () => { const q = await real(); return q ? q.get() : emptyQuery(); },
      onSnapshot(next, error) {
        if (typeof next !== 'function') throw new TypeError('onSnapshot needs a function');
        let un = null, dead = false;
        real().then(q => { if (dead) return; if (!q) { next(emptyQuery()); return; } un = q.onSnapshot(next, error); }, e => { if (!dead && typeof error === 'function') error(e); });
        return () => { dead = true; if (un) { un(); un = null; } };
      },
    };
  }
  function lazyCollection(path) {
    checkPath(path, false);
    return Object.freeze(Object.assign(lazyQuery(path, []), {
      path,
      doc: id => lazyDoc(path + '/' + (id === undefined ? autoId() : id)),
      add: async data => { const ref = lazyDoc(path + '/' + autoId()); await ref.set(data); return ref; },
    }));
  }
  async function upload(blob, options) {
    const a = await use('assets');
    if (!a) return null;
    return a.upload(blob, options);
  }

  // beyond section 5, on Mahala's own site only: call one of the project's edge functions as the viewer (payments)
  const invoke = AUTH && typeof AUTH.invoke === 'function' ? (name, body) => AUTH.invoke(name, body) : undefined;
  const platform = Object.freeze({ mode, ready, use, me, onAuth, signIn, signOut, doc: lazyDoc, collection: lazyCollection, upload, invoke });

  /* ---------------------------------------------------------- the account chip (Mahala's own site only) ----------- */
  if (mode === 'standalone' && AUTH) {
    try { accountUi(); } catch (e) { console.warn('v7 platform: the account chip did not start', e); }
    try { stewardSection(); } catch (e) { }
  }

  function accountUi() {
    if (!document.getElementById('v7-platform-css')) { const s = document.createElement('style'); s.id = 'v7-platform-css'; s.textContent = CSS; document.head.appendChild(s); }
    const bar = document.querySelector('.topbar');
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'v7-platform-chip v7-platform-out'; chip.id = 'v7-platform-chip';
    chip.innerHTML = `${icon('lock')}<span class="v7-platform-nm">${esc(COPY.signIn)}</span>`;
    chip.hidden = true;                                              // until we know who is here (no "Sign in" flash)
    const anchor = bar && (bar.querySelector('.who') || bar.querySelector('#menuBtn'));
    if (anchor) anchor.parentNode.insertBefore(chip, anchor); else if (bar) bar.appendChild(chip);
    const menu = document.createElement('div');
    menu.className = 'popover card v7-platform-menu'; menu.id = 'v7-platform-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', COPY.menuLabel);
    (document.querySelector('#app .hud') || document.body).appendChild(menu);
    let info = null;

    function paint() {
      const inNow = !!(info && info.signedIn);
      chip.classList.toggle('v7-platform-out', !inNow);
      if (!inNow) {
        chip.innerHTML = `${icon('lock')}<span class="v7-platform-nm">${esc(COPY.signIn)}</span>`;
        chip.removeAttribute('aria-haspopup'); chip.removeAttribute('aria-expanded'); chip.setAttribute('aria-label', COPY.signIn);
        return;
      }
      const name = info.name || COPY.you, ini = initials(info.name);
      chip.innerHTML = `<span class="v7-platform-av" style="--c:${colourOf(info.uid)}" aria-hidden="true">${ini ? esc(ini) : icon('users')}</span><span class="v7-platform-nm"></span>${icon('down')}`;
      chip.querySelector('.v7-platform-nm').textContent = name;
      chip.setAttribute('aria-haspopup', 'menu'); chip.setAttribute('aria-expanded', String(!menu.hidden));
      chip.setAttribute('aria-label', `${COPY.menuLabel}: ${name}`);
      menu.innerHTML = `<div class="v7-platform-who">${esc(COPY.signedInAs)}<b></b></div>
        <button type="button" role="menuitem" data-v7p="dashboard">${icon('star')}${esc(COPY.dashboard)}</button>
        <button type="button" role="menuitem" data-v7p="account">${icon('users')}${esc(COPY.account)}</button>
        <button type="button" role="menuitem" data-v7p="signout">${icon('unlock')}${esc(COPY.signOut)}</button>
        <div class="v7-platform-msep" role="separator"></div>
        <button type="button" role="menuitem" class="v7-platform-quiet" data-v7p="delete">${esc(COPY.deleteAccount)}</button>`;
      menu.querySelector('.v7-platform-who b').textContent = info.email || name;
    }
    const openMenu = () => {
      try { M.v7.closePops(); } catch (e) { }
      const r = chip.getBoundingClientRect();
      menu.style.right = Math.max(8, innerWidth - r.right) + 'px'; menu.style.left = 'auto';
      menu.hidden = false; chip.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('[role=menuitem]'); if (first) first.focus();
    };
    const closeMenu = (focusChip) => { if (menu.hidden) return; menu.hidden = true; chip.setAttribute('aria-expanded', 'false'); if (focusChip) chip.focus(); };
    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (!(info && info.signedIn)) { openSheet('signin'); return; }
      if (menu.hidden) openMenu(); else closeMenu(false);
    });
    menu.addEventListener('click', e => { const b = e.target.closest('[data-v7p]'); if (!b) return; e.stopPropagation(); closeMenu(false); run(b.dataset.v7p); });
    menu.addEventListener('keydown', e => {
      const items = [...menu.querySelectorAll('[role=menuitem]')], i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Tab') closeMenu(false);
    });
    document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#v7-platform-menu, #v7-platform-chip')) closeMenu(false); });
    addEventListener('resize', () => closeMenu(false));
    function run(k) {
      if (k === 'dashboard') { try { M.v7.openPath(); } catch (e) { } }
      if (k === 'account') openSheet('account');
      if (k === 'delete') openSheet('delete');
      if (k === 'signout') signOut();
      if (k === 'signin') openSheet('signin');
    }

    // on the phone the top bar keeps only its menu button: the same choices go in that menu
    const pop = document.getElementById('menuPop');
    if (pop) {
      const addItems = () => {
        if (pop.hidden || pop.querySelector('.v7-platform-item')) return;
        const inNow = !!(info && info.signedIn), b = (k, ic, t) => `<button type="button" class="v7-platform-item" data-m="v7-${k}">${icon(ic)}${esc(t)}</button>`;
        pop.insertAdjacentHTML('beforeend', '<div class="v7-platform-sep" aria-hidden="true"></div>' + (inNow ? b('account', 'users', COPY.account) + b('signout', 'unlock', COPY.signOut) : b('signin', 'lock', COPY.signIn)));
      };
      new MutationObserver(addItems).observe(pop, { childList: true, attributes: true, attributeFilter: ['hidden'] });
      pop.addEventListener('click', e => { const b = e.target.closest('[data-m^="v7-"]'); if (b) run(b.dataset.m.slice(3)); });   // the game's own handler closes the menu
    }

    let warned = false;
    const refresh = () => AUTH.info().then(i => { info = i; paint(); chip.hidden = false; if (i && i.rulesDiffer && !warned) { warned = true; setTimeout(() => toast(COPY.rulesDiffer), 4000); } }, () => { info = null; paint(); chip.hidden = false; });
    refresh();
    AUTH.onChange(() => refresh());
  }

  /* ---------------------------------------------------------- for stewards: account removals still to finish ----- */
  function stewardSection() {
    if (!Array.isArray(ctx.steward)) return;
    ctx.steward.push({
      id: 'platform-removals', title: COPY.removalsTitle, order: 90,
      async render(el, who) {
        if (!who || !(who.isSteward || who.isOwner)) { el.textContent = ''; return; }
        const list = await AUTH.removals();
        el.innerHTML = `<div class="v7-platform-rm"><p></p><ul></ul></div>`;
        el.querySelector('p').textContent = list.length ? COPY.removalsLead : COPY.removalsNone;
        const ul = el.querySelector('ul');
        for (const r of list) {
          const li = document.createElement('li');
          li.innerHTML = `<code></code><small></small><div class="v7-platform-acts"><button type="button" class="btn" data-k="copy">${esc(COPY.removalsCopy)}</button><button type="button" class="btn" data-k="done">${icon('check')}${esc(COPY.removalsDone)}</button></div>`;
          li.querySelector('code').textContent = r.user_id;
          li.querySelector('small').textContent = COPY.removalsAsked(new Date(r.requested_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })) + (r.files_left ? '. ' + COPY.removalsFiles(r.files_left) : '');
          li.addEventListener('click', async e => {
            const b = e.target.closest('[data-k]'); if (!b) return;
            if (b.dataset.k === 'copy') { try { await navigator.clipboard.writeText(r.user_id); toast(COPY.removalsCopied); } catch (er) { } }
            if (b.dataset.k === 'done') { b.disabled = true; const res = await AUTH.finishRemoval(r.user_id); if (res.ok) li.remove(); else b.disabled = false; if (!ul.children.length) el.querySelector('p').textContent = COPY.removalsNone; }
          });
          ul.appendChild(li);
        }
      },
    });
  }

  return platform;
}

const PALETTE = ['#D8197F', '#14A8E0', '#C99A00', '#2E8558', '#7E57C2', '#E06A2C', '#2F6F73', '#B0413E'];
function colourOf(id) { let h = 2166136261; const s = String(id || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return PALETTE[(h >>> 0) % PALETTE.length]; }
function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(x => /^\p{L}/u.test(x));
  return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '';
}
export const _copy = COPY;
