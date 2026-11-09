/* BUILT from Mahala OS platform/shim/claude-shim.js (rules 746824445fc6). Do not edit here: change the source and rebuild. */
/* The Mahalaverse on Mahala's own site: window.claude on Supabase.
 *
 * The game reaches all its data through window.claude.use(name), the interface claude.ai gives an artifact. On
 * wearemahala.com this file gives the same interface, backed by the member database (Supabase), so the game is not
 * rewritten (platform/docs/ARCHITECTURE.md). It also draws the sign-in, welcome, account and delete sheets.
 *
 *   use('db')         the game's store, with the claude.ai db contract (members only; null otherwise)
 *   use('user')       who is viewing (signed in and claimed; null when signed out)
 *   use('assets')     uploads, into a private bucket (members only)
 *   use('downloads')  save a file the page made
 *   __standalone      true: the platform plugin knows it is on Mahala's own site
 *   __auth            info, onChange, open('signin' | 'account' | 'delete'), signOut, invoke, removals, finishRemoval
 *   window.MahalaMembers   the same account for pages without the game (camp.html, seed.html)
 *
 * It switches itself on only when site.js carries members: { url, anonKey }; without it the site runs as today.
 * Source: Mahala OS platform/shim/claude-shim.js. The site's copy (assets/shim/claude-shim.js) is built from it by
 * platform/shim/build.mjs; change the source, never the copy.
 */
(function () {
  'use strict';
  var SITE = window.MAHALA_SITE || {};
  var CFG = SITE.members || {};
  // Google sign-in is offered only once site.js says members: { google: true }, after the Google provider is set up in
  // Supabase (platform/docs/SETUP.md). Until then the email link is the one way in.
  var GOOGLE_ON = CFG.google === true;
  // Your Mahala, the member's own page (site.js members.mePage)
  var MEPAGE = typeof CFG.mePage === 'string' && /^[a-z0-9-]+\.html$/.test(CFG.mePage) ? CFG.mePage : null;
  function onMe() { return !!MEPAGE && new RegExp('/' + MEPAGE.replace('.', '\\.') + '$').test(location.pathname); }
  // Inside a pane over the front page (the tribe page opens in a frame): the front page draws the sheets, not the frame.
  var EMBEDDED = (function () { try { return window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { return false; } })();
  if (!CFG.url || !CFG.anonKey || window.claude) return;

  var RULES_VERSION = '746824445fc6';
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var SUPABASE_SRI = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';   // that exact file, so a changed copy never runs
  var STORE_KEY = 'mahala-auth', EDITION = 'mahala.edition', THREAD = 'mahala.thread', AFTER = 'mahala.after';
  var KEEP = 'mahala.keep', RECOVERY = 'mahala.recovery', INVITE = 'mahala.invite', NOTED = 'mahala.inviteNoted';
  var ASKED = 'mahala.asked';        // when this browser last asked for a sign-in link or Google (security review, 8 Nov 2026)
  var BASECAMP = 'basecamp.html';   // wearemahala.com's Basecamp, behind sign-in (T-216)
  var URL_AUTH = null;                // what the email link or Google brought back in the address, read once
  // Google's own button (one tap, and it names wearemahala.com, not the database's address) when site.js gives the
  // web client ID; otherwise "Continue with Google" goes through Supabase's redirect.
  var GOOGLE_CLIENT = typeof CFG.googleClientId === 'string' && /\.apps\.googleusercontent\.com$/.test(CFG.googleClientId) ? CFG.googleClientId : null;
  var POLL_MS = Number(window.__MV_POLL_MS) > 0 ? Number(window.__MV_POLL_MS) : 30000;
  var MAX_SUBS = 64;

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } },
  };
  var ss = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { } },
  };

  /* ------------------------------------------------------------------ the letter's link: ?thread=<token> */
  (function keepToken() {
    try {
      var u = new URL(location.href), t = u.searchParams.get('thread');
      if (t && /^[A-Za-z0-9_-]{20,200}$/.test(t)) { ls.set(THREAD, JSON.stringify({ t: t, at: Date.now() })); ss.set('mahala.fromLetter', '1'); }
      // The email link, a password reset or Google comes back with the sign-in in the address (#access_token=...).
      // Keep it here for the client, then take it out of the address at once, so it is never bookmarked or shared.
      // (Before 7 Nov 2026 the address was cleaned before the client had read it, so links landed signed out.)
      var authInUrl = /access_token|error_description/.test(u.hash);
      if (authInUrl) {
        var h = new URLSearchParams(u.hash.slice(1));
        URL_AUTH = { access: h.get('access_token'), refresh: h.get('refresh_token'), type: h.get('type'), error: h.get('error_description') || h.get('error') };
        // A sign-in this browser did not ask for may be someone else's account, sent to plant it here (login fixation):
        // it is taken only after the visitor confirms the address it signs them in as. The note is used once.
        URL_AUTH.asked = Date.now() - Number(ls.get(ASKED) || 0) < 864e5; ls.set(ASKED, null);
        if (URL_AUTH.type === 'recovery' && URL_AUTH.access) ss.set(RECOVERY, '1');
      }
      if (t !== null || u.searchParams.has('signin') || authInUrl) {
        u.searchParams.delete('thread'); u.searchParams.delete('signin');
        history.replaceState(null, '', u.pathname + (u.search || '') + (authInUrl ? '' : u.hash));
      }
    } catch (e) { }
  })();

  // The invitation letter's link (camp.html?ref=<token>&by=<nominator>, or ?inv=): kept on this device for 60 days,
  // so the camp application still opens after the sign-in round trip (the email link and Google come back without
  // it), and the account learns it came by a letter (note_letter).
  (function keepInvite() {
    try {
      var u = new URL(location.href), r = u.searchParams.get('ref') || u.searchParams.get('inv') || '', by = u.searchParams.get('by') || '';
      if (/^[A-Za-z0-9_.~-]{8,200}$/.test(r) || by) ls.set(INVITE, JSON.stringify({ ref: /^[A-Za-z0-9_.~-]{8,200}$/.test(r) ? r : '', by: by.slice(0, 120), at: Date.now() }));
    } catch (e) { }
  })();
  function invite() { try { var o = JSON.parse(ls.get(INVITE) || 'null'); if (o && Date.now() - o.at < 60 * 864e5) return o; } catch (e) { } return null; }

  // Keep me signed in: on (the default), the sign-in stays on this device; off, it ends when the browser closes.
  function keepOn() { return ls.get(KEEP) !== '0'; }
  var authStore = {
    getItem: function (k) { return ss.get(k) || ls.get(k); },
    setItem: function (k, v) { if (keepOn()) { ls.set(k, v); ss.set(k, null); } else { ss.set(k, v); ls.set(k, null); } },
    removeItem: function (k) { ls.set(k, null); ss.set(k, null); },
  };

  /* ------------------------------------------------------------------ the client */
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      if (window.supabase && window.supabase.createClient) return ok();
      var s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.integrity = SUPABASE_SRI;
      s.onload = function () { ok(); }; s.onerror = function () { fail(new Error('supabase-js did not load')); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  var clientP = (window.__MV_SUPABASE ? Promise.resolve() : loadScript(SUPABASE_JS)).then(function () {
    var lib = window.__MV_SUPABASE || window.supabase;
    return lib.createClient(CFG.url, CFG.anonKey, {
      auth: { storageKey: STORE_KEY, storage: authStore, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  });

  // The letter's token waits here for at most an hour, for the sign-in it was opened for (a token left in a
  // shared browser must not claim a thread for whoever signs in next).
  function letterToken() {
    try { var o = JSON.parse(ls.get(THREAD) || 'null'); if (o && o.t && Date.now() - o.at < 3600 * 1000) return o.t; } catch (e) { }
    ls.set(THREAD, null); return null;
  }
  var startUser = undefined;          // the sign-in this page started as (a change starts the page again)
  var info = null;                    // whoami(), after claiming
  var authFns = [];

  function rpc(name, args) {
    return clientP.then(function (c) { return c.rpc(name, args || {}); }).then(function (r) {
      if (r.error) throw toErr(r.error);
      return r.data;
    });
  }
  function toErr(e) {
    var m = String((e && e.message) || ''), mm = m.match(/^(invalid_argument|quota_exceeded|resource_exhausted|not_granted|not_signed_in|not_claimed):\s*(.*)$/);
    if (mm) return { code: mm[1] === 'not_signed_in' || mm[1] === 'not_claimed' ? 'not_granted' : mm[1], message: mm[2] };
    if (e && (e.code === '42501' || e.code === 'PGRST301')) return { code: 'not_granted', message: m };
    return { code: 'unavailable', message: m || 'The Mahalaverse could not be reached.' };
  }

  // Who is here: sign-in, then claim (the letter's token, else the verified address), then whoami.
  var infoP = clientP.then(function (c) {
    if (URL_AUTH && URL_AUTH.access && !URL_AUTH.asked) {
      var em = '';
      try { em = JSON.parse(atob(URL_AUTH.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch (e) { }
      if (!window.confirm('Sign in to Mahala as ' + (em || 'this account') + '?\n\nContinue only if you asked for this link yourself.')) { URL_AUTH.access = null; ss.set(RECOVERY, null); }
    }
    var fromLink = URL_AUTH && URL_AUTH.access && URL_AUTH.refresh
      ? c.auth.setSession({ access_token: URL_AUTH.access, refresh_token: URL_AUTH.refresh }).then(function (r) { if (r && r.error) URL_AUTH.error = r.error.message; }, function () { URL_AUTH.error = 'expired'; })
      : Promise.resolve();
    return fromLink.then(function () { return c.auth.getSession(); }).then(function (r) {
      var s = r && r.data && r.data.session;
      startUser = s ? s.user.id : null;
      c.auth.onAuthStateChange(function (ev, sess) {
        var now = sess ? sess.user.id : null;
        if (ev === 'INITIAL_SESSION' || ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED') return;
        if (now === startUser) return;
        startUser = now;
        if (!now) { ls.set(EDITION, null); ls.set(THREAD, null); }
        authFns.slice().forEach(function (f) { try { f({ signedIn: !!now }); } catch (e) { } });
        setTimeout(restart, 900);
      });
      if (!s) { var gone = ss.get('mahala.ended') === '1'; ss.set('mahala.ended', null); return { signedIn: false, level: 0, rulesVersion: null, ended: gone }; }
      // A sign-in that ended with its account (deleted here a moment ago, or on another device): forget it on this
      // device and carry on signed out, never claim the thread again with it (F-030).
      var forget = function () {
        startUser = null; authStore.removeItem(STORE_KEY);
        c.auth.signOut({ scope: 'local' }).catch(function () { });
        return { signedIn: false, level: 0, rulesVersion: null, ended: true };
      };
      return rpc('whoami').then(function (w) {
        if (w.ended || w.signedIn === false) return forget();
        if (w.claimed) { ls.set(THREAD, null); return w; }
        var tok = letterToken(); ls.set(THREAD, null);
        return rpc('claim_thread', { p_token: tok }).catch(function (e) {
          if (e && /ended with its account/.test(e.message || '')) return forget();
          throw e;
        });
      });
    });
  }).then(function (w) {
    var inv = invite();
    // noted once per account, not per device: someone who deletes their account and comes back, or a second
    // person on the same device, still has their letter noted
    var noted = inv && inv.ref + '|' + w.personId;
    if (!w.claimed || !inv || !inv.ref || ls.get(NOTED) === noted || (w.journey && w.journey.tier !== 'tribe')) return w;
    return rpc('note_letter', { p_ref: inv.ref, p_by: inv.by || null }).then(function (r) {
      ls.set(NOTED, noted); if (r && r.journey) w.journey = r.journey; return w;
    }, function () { return w; });
  }).then(function (w) {
    info = w;
    var want = w.level >= 2 ? 'members' : null;
    if ((ls.get(EDITION) || null) !== want) {                     // the edition this page was drawn as is not this person's
      ls.set(EDITION, want);
      if (!ss.get('mahala.restarted')) { ss.set('mahala.restarted', '1'); restart(); return w; }
    } else ss.set('mahala.restarted', null);
    afterSignIn(w);
    return w;
  }, function (e) {
    console.warn('Mahalaverse accounts:', e && e.message);
    info = { signedIn: false, level: 0, error: true };
    return info;
  });

  // Where the page goes back to after a sign-in round trip: kept for half an hour at most, and never an example page,
  // so an old one cannot surface much later (8 Nov 2026, F-032: after deleting an account, Your Mahala opened an example
  // profile left from a sign-in begun on it earlier).
  function setAfter(h) { ss.set(AFTER, h ? JSON.stringify({ h: h, at: Date.now() }) : null); }
  function takeAfter() {
    var a = null; try { a = JSON.parse(ss.get(AFTER) || 'null'); } catch (e) { }
    ss.set(AFTER, null);
    return a && typeof a.h === 'string' && Date.now() - a.at < 30 * 60 * 1000 && /^#[A-Za-z0-9_-]{1,38}$/.test(a.h) && !/^#demo/i.test(a.h) ? a.h : null;
  }
  var LAND = 'mahala.land';            // the page a first sign-in lands on: Your Mahala (F-024, F-025)
  var ending = false;                 // the account is being deleted: no restart, the delete sheet leads on
  function restart() {
    if (ending) return;
    var land = ss.get(LAND); ss.set(LAND, null);
    if (land && MEPAGE && !onMe()) { setAfter(null); goMe(true); return; }
    var after = takeAfter();
    if (after) location.replace(location.pathname + location.search + after); else location.reload();
  }

  /* ------------------------------------------------------------------ the game's store (db contract) */
  var SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
  function segs(path, isDoc) {
    if (typeof path !== 'string' || !path) throw new TypeError((isDoc ? 'doc' : 'collection') + ': the path must be a non-empty string');
    var s = path.split('/');
    if (s.length > 16 || path.length > 1000 || s.some(function (x) { return !x || x === '.' || x === '..' || x.length > 200 || !SEG.test(x); }))
      throw new TypeError((isDoc ? 'doc' : 'collection') + ': not a valid path: ' + path);
    if ((s.length % 2 === 0) !== isDoc) throw new TypeError((isDoc ? 'doc: a document path needs an even' : 'collection: a collection path needs an odd') + ' number of segments (' + s.length + '): ' + path);
    return s;
  }
  var META_LIVE = Object.freeze({ fromCache: false, hasPendingWrites: false });
  var META_CACHE = Object.freeze({ fromCache: true, hasPendingWrites: false });
  var snapCache = new Map();          // path -> { v, snap }: an unchanged document is the same object across deliveries
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); } return o; }
  function docSnap(path, row, meta) {
    var id = path.split('/').pop();
    if (!row) return Object.freeze({ id: id, exists: false, data: function () { return undefined; }, metadata: meta || META_LIVE });
    var key = row.version + ':' + (row.updated_at || '');
    var c = snapCache.get(path);
    if (c && c.v === key && (meta || META_LIVE) === c.meta) return c.snap;
    var data = deepFreeze(row.data);
    var snap = Object.freeze({ id: id, exists: true, data: function () { return data; }, metadata: meta || META_LIVE });
    snapCache.set(path, { v: key, snap: snap, meta: meta || META_LIVE });
    return snap;
  }

  var OPS = { '==': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1, 'in': 1, 'not-in': 1, 'array-contains': 1 };
  function cmp(a, b) {
    var ta = typeof a, tb = typeof b;
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (a === b) return 0;
    if (ta === 'object') { var ja = JSON.stringify(a), jb = JSON.stringify(b); return ja < jb ? -1 : ja > jb ? 1 : 0; }
    return a < b ? -1 : 1;
  }
  var eq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  function test(d, f) {
    var has = Object.prototype.hasOwnProperty.call(d, f[0]), v = d[f[0]], x = f[2];
    switch (f[1]) {
      case '==': return has && eq(v, x);
      case '!=': return has && !eq(v, x);
      case '<': return has && typeof v === typeof x && cmp(v, x) < 0;
      case '<=': return has && typeof v === typeof x && cmp(v, x) <= 0;
      case '>': return has && typeof v === typeof x && cmp(v, x) > 0;
      case '>=': return has && typeof v === typeof x && cmp(v, x) >= 0;
      case 'in': return has && x.some(function (y) { return eq(v, y); });
      case 'not-in': return has && !x.some(function (y) { return eq(v, y); });
      case 'array-contains': return has && Array.isArray(v) && v.some(function (y) { return eq(y, x); });
    }
    return false;
  }

  function fetchDoc(path) {
    return clientP.then(function (c) { return c.from('docs').select('data,version,updated_at').eq('path', path).limit(1); })
      .then(function (r) { if (r.error) throw toErr(r.error); return r.data[0] || null; });
  }
  // Supabase serves at most 1000 rows a request: read a collection in pages, up to 5000 documents.
  function fetchColl(coll) {
    var all = [];
    function page(from) {
      return clientP.then(function (c) { return c.from('docs').select('id,path,data,version,updated_at').eq('coll', coll).order('id').range(from, from + 999); })
        .then(function (r) {
          if (r.error) throw toErr(r.error);
          all = all.concat(r.data);
          return r.data.length === 1000 && all.length <= 5000 ? page(from + 1000) : all;
        });
    }
    return page(0);
  }
  function runQuery(coll, q) {
    return fetchColl(coll).then(function (rows) {
      var big = rows.length > 5000;
      if (big) rows = rows.slice(0, 5000);
      var out = rows.filter(function (r) { return q.where.every(function (f) { return test(r.data, f); }); });
      if (q.order) {
        var f = q.order[0], dir = q.order[1] === 'desc' ? -1 : 1;
        out.sort(function (a, b) {
          var ha = Object.prototype.hasOwnProperty.call(a.data, f), hb = Object.prototype.hasOwnProperty.call(b.data, f);
          if (ha !== hb) return ha ? -1 : 1;                      // documents missing the field sort last
          var c = ha ? cmp(a.data[f], b.data[f]) * dir : 0;
          return c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        });
      }
      if (q.limit) out = out.slice(0, q.limit);
      var meta = big ? META_CACHE : META_LIVE;
      return out.map(function (r) { return docSnap(r.path, r, meta); }).concat(big ? [{ __big: true }] : []);
    });
  }
  function querySnap(docs, prev) {
    var big = docs.length && docs[docs.length - 1].__big; if (big) docs = docs.slice(0, -1);
    var changes = [], before = prev || [], idx = {};
    before.forEach(function (d, i) { idx[d.id] = i; });
    var seen = {};
    docs.forEach(function (d, i) {
      seen[d.id] = 1;
      if (!(d.id in idx)) changes.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i });
      else if (before[idx[d.id]] !== d || idx[d.id] !== i) changes.push({ type: 'modified', doc: d, oldIndex: idx[d.id], newIndex: i });
    });
    before.forEach(function (d, i) { if (!seen[d.id]) changes.push({ type: 'removed', doc: d, oldIndex: i, newIndex: -1 }); });
    var frozen = Object.freeze(docs.slice()), ch = Object.freeze(changes.map(Object.freeze));
    return { snap: Object.freeze({ docs: frozen, size: frozen.length, empty: !frozen.length, docChanges: function () { return ch; }, metadata: big ? META_CACHE : META_LIVE }), changed: changes.length > 0 };
  }

  // Live updates: one Realtime channel per collection, shared by its watchers; every change re-reads (so the rules
  // apply), and every watcher also refreshes on a timer, as claude.ai does when its stream is blocked.
  var watchers = new Set(), channels = new Map();
  function channelFor(coll, w) {
    var ch = channels.get(coll);
    if (!ch) {
      ch = { ws: new Set(), sub: null };
      channels.set(coll, ch);
      clientP.then(function (c) {
        try {
          ch.sub = c.channel('mv:' + coll).on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'coll=eq.' + coll },
            function () { ch.ws.forEach(function (x) { x.soon(); }); }).subscribe();
        } catch (e) { ch.sub = null; }
      });
    }
    ch.ws.add(w);
    return function () {
      ch.ws.delete(w);
      if (!ch.ws.size) { channels.delete(coll); clientP.then(function (c) { if (ch.sub) { try { c.removeChannel(ch.sub); } catch (e) { } } }); }
    };
  }
  function watch(coll, load, next, error) {
    if (watchers.size >= MAX_SUBS) { setTimeout(function () { if (error) error({ code: 'resource_exhausted', message: 'at most 64 subscriptions' }); }, 0); return function () { }; }
    var dead = false, timer = null, t2 = null, w = {};
    w.run = function () {
      if (dead) return;
      load().then(function (v) { if (!dead) next(v); }, function (e) {
        if (dead) return;
        if (e && e.code !== 'unavailable') { dead = true; stop(); if (error) error(e); }
      });
    };
    w.soon = function () { clearTimeout(t2); t2 = setTimeout(w.run, 120); };
    w.coll = coll;
    watchers.add(w);
    var unchan = channelFor(coll, w);
    function stop() { watchers.delete(w); clearInterval(timer); clearTimeout(t2); unchan(); }
    timer = setInterval(function () { if (!document.hidden) w.run(); }, POLL_MS);
    w.run();
    return function () { if (!dead) { dead = true; stop(); } };
  }
  function touched(coll) { watchers.forEach(function (w) { if (w.coll === coll) w.soon(); }); }

  function docRef(path) {
    var s = segs(path, true), id = s[s.length - 1], coll = s.slice(0, -1).join('/');
    var after = function (p) { return p.then(function (v) { touched(coll); return v; }); };
    return Object.freeze({
      id: id, path: path,
      get: function () { return fetchDoc(path).then(function (row) { return docSnap(path, row); }); },
      set: function (data) { return after(rpc('doc_set', { p_path: path, p_data: plain(data) })).then(function () { }); },
      update: function (data) { return after(rpc('doc_update', { p_path: path, p_data: plain(data) })).then(function () { }); },
      delete: function () { return after(rpc('doc_delete', { p_path: path })).then(function () { }); },
      acquire: function (o) {
        o = o || {};
        return after(rpc('doc_acquire', { p_path: path, p_holder: String(o.holder || ''), p_ttl_ms: Number(o.ttlMs) || 0, p_data: o.data ? plain(o.data) : null }));
      },
      onSnapshot: function (next, error) {
        if (typeof next !== 'function') throw new TypeError('onSnapshot needs a function');
        var last;
        return watch(coll, function () { return fetchDoc(path).then(function (row) { return docSnap(path, row); }); },
          function (snap) { if (snap !== last) { last = snap; next(snap); } }, error);
      },
      collection: function (sub) { return collRef(path + '/' + sub); },
    });
  }
  function plain(d) {
    if (d === null || typeof d !== 'object' || Array.isArray(d)) throw { code: 'invalid_argument', message: 'a document body is a JSON object' };
    return JSON.parse(JSON.stringify(d));
  }
  function query(path, q) {
    var add = function (k, v) { var n = { where: q.where.slice(), order: q.order, limit: q.limit }; if (k === 'where') n.where.push(v); else n[k] = v; return query(path, n); };
    return {
      where: function (f, op, v) {
        if (!OPS[op]) throw new TypeError('where: unknown operator ' + op);
        if (q.where.length >= 10) throw new TypeError('where: at most 10 filters');
        if ((op === 'in' || op === 'not-in') && (!Array.isArray(v) || v.length > 30)) throw new TypeError('where: ' + op + ' takes an array of at most 30');
        return add('where', [String(f), op, v]);
      },
      orderBy: function (f, dir) { if (q.order) throw new TypeError('orderBy: at most one'); return add('order', [String(f), dir === 'desc' ? 'desc' : 'asc']); },
      limit: function (n) { n = Math.floor(Number(n)); if (!(n >= 1 && n <= 1000)) throw new TypeError('limit: 1 to 1000'); return add('limit', n); },
      get: function () { return runQuery(path, q).then(function (docs) { return querySnap(docs).snap; }); },
      onSnapshot: function (next, error) {
        if (typeof next !== 'function') throw new TypeError('onSnapshot needs a function');
        var prev = null, first = true;
        return watch(path, function () { return runQuery(path, q); }, function (docs) {
          var r = querySnap(docs, prev);
          if (first || r.changed) { first = false; prev = r.snap.docs; next(r.snap); }
        }, error);
      },
    };
  }
  function collRef(path) {
    segs(path, false);
    var q = query(path, { where: [], order: null, limit: 0 });
    return Object.freeze(Object.assign(q, {
      path: path,
      doc: function (id) { return docRef(path + '/' + (id === undefined ? autoId() : id)); },
      add: function (data) { var ref = docRef(path + '/' + autoId()); return ref.set(data).then(function () { return ref; }); },
    }));
  }
  function autoId(n) {
    var a = new Uint8Array(n || 20), abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return abc[x % abc.length]; }).join('');
  }
  var DB = Object.freeze({ doc: docRef, collection: collRef });

  /* ------------------------------------------------------------------ who is viewing (user contract) */
  var PALETTE = ['#D8197F', '#14A8E0', '#C99A00', '#2E8558', '#7E57C2', '#E06A2C', '#2F6F73', '#B0413E'];
  function colourOf(id) { var h = 2166136261, s = String(id || ''); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return PALETTE[(h >>> 0) % PALETTE.length]; }
  function avatar(name, colour) {
    var w = String(name || '').trim().split(/\s+/).filter(Boolean), ini = w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="' + colour + '"/>' +
      (ini ? '<text x="32" y="41" font-family="sans-serif" font-size="24" fill="#fff" text-anchor="middle">' + ini.replace(/[<&]/g, '') + '</text>' : '<circle cx="32" cy="26" r="10" fill="#fff"/><rect x="16" y="40" width="32" height="14" rx="7" fill="#fff"/>') + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  var profCache = new Map();
  function profile(id, name, guest) {
    var c = colourOf(id);
    return Object.freeze({ id: id, name: name || '', avatarUrl: avatar(name, c), color: c, email: null, isMe: !!(info && info.uid === id), guest: !!guest });
  }
  var USER = Object.freeze({
    id: function () { return infoP.then(function (w) { return w.uid || null; }); },
    me: function () { return infoP.then(function (w) { var p = profile(w.uid, w.name, false); return myPicture().then(function (u) { return u ? Object.freeze(Object.assign({}, p, { avatarUrl: u })) : p; }, function () { return p; }); }); },
    name: function () { return infoP.then(function (w) { return w.name || ''; }); },
    avatarUrl: function () { return infoP.then(function (w) { return w.uid ? myPicture().then(function (u) { return u || avatar(w.name, colourOf(w.uid)); }) : null; }); },
    email: function () { return Promise.resolve(null); },
    isOwner: function () { return infoP.then(function (w) { return w.level >= 4; }); },
    canEdit: function () { return infoP.then(function (w) { return w.level >= 3; }); },
    can: function (name) { return infoP.then(function (w) { return name === 'data.write' ? w.level >= 2 : null; }); },
    profiles: function (ids) {
      ids = Array.isArray(ids) ? ids : [ids];
      var uniq = ids.filter(function (x, i) { return typeof x === 'string' && ids.indexOf(x) === i; });
      var need = uniq.filter(function (x) { return !profCache.has(x); });
      var p = need.length ? rpc('profiles_for', { p_ids: need }).then(function (m) {
        need.forEach(function (x) { var e = m && m[x]; profCache.set(x, profile(x, e && e.name, e && e.guest)); });
      }, function () { }) : Promise.resolve();
      return p.then(function () {
        var out = {}; uniq.forEach(function (x) { out[x] = profCache.get(x) || profile(x, '', false); }); return out;
      });
    },
    search: function () { return Promise.resolve([]); },
  });

  /* ------------------------------------------------------------------ uploads (assets contract) */
  var BUCKET = 'mv-assets';
  var signed = new Map();
  function signUrl(name) {
    var c = signed.get(name);
    if (c && c.until > Date.now()) return Promise.resolve(c.url);
    return clientP.then(function (cl) { return cl.storage.from(BUCKET).createSignedUrl(name, 3600); }).then(function (r) {
      if (r.error) throw toErr(r.error);
      var url = r.data.signedUrl; if (url && url[0] === '/') url = CFG.url.replace(/\/$/, '') + url;
      signed.set(name, { url: url, until: Date.now() + 3000 * 1000 });
      return url;
    });
  }
  var ASSETS = Object.freeze({
    upload: function (blob, opts) {
      return infoP.then(function (w) {
        if (!(w.level >= 2)) throw { code: 'not_granted', message: 'members only' };
        if (!blob || !blob.size) throw { code: 'invalid_argument', message: 'nothing to upload' };
        if (blob.size > 20 * 1024 * 1024) throw { code: 'invalid_argument', message: 'at most 20 MiB' };
        var id = autoId(32), name = w.uid + '/' + id, type = (opts && opts.type) || blob.type || 'application/octet-stream';
        return clientP.then(function (c) { return c.storage.from(BUCKET).upload(name, blob, { contentType: type, upsert: false }); })
          .then(function (r) { if (r.error) throw toErr(r.error); return rpc('asset_register', { p_id: id, p_type: type, p_size: blob.size }); })
          .then(function () { return signUrl(name); })
          .then(function (url) { return { id: id, url: url, sizeBytes: blob.size, contentType: type }; });
      });
    },
    list: function () {
      return infoP.then(function (w) {
        return clientP.then(function (c) { return c.from('assets').select('id,object_name,content_type,size_bytes').limit(1000); }).then(function (r) {
          if (r.error) throw toErr(r.error);
          var mine = r.data.filter(function (a) { return a.object_name.indexOf(w.uid + '/') === 0; });
          return { assets: mine.map(function (a) { return { id: a.id, url: '/_blob/' + a.id, sizeBytes: a.size_bytes, contentType: a.content_type }; }),
                   usage: { bytes: mine.reduce(function (n, a) { return n + a.size_bytes; }, 0) } };
        });
      });
    },
    delete: function (id) {
      return clientP.then(function (c) {
        return c.from('assets').select('object_name').eq('id', id).limit(1).then(function (r) {
          var nm = r.data && r.data[0] && r.data[0].object_name;
          return (nm ? c.storage.from(BUCKET).remove([nm]) : Promise.resolve()).then(function () { return rpc('asset_forget', { p_id: id }); });
        });
      }).then(function () { return { ok: true }; });
    },
  });
  // The game shows an upload at "/_blob/<id>" (claude.ai serves that path); here, swap in a signed link.
  function resolveBlobs(root) {
    var els = (root.querySelectorAll ? root : document).querySelectorAll('img[src^="/_blob/"],video[src^="/_blob/"],source[src^="/_blob/"],a[href^="/_blob/"]');
    Array.prototype.forEach.call(els, function (el) {
      var attr = el.tagName === 'A' ? 'href' : 'src', id = el.getAttribute(attr).slice(7);
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id) || el.dataset.mvBlob === id) return;
      el.dataset.mvBlob = id;
      clientP.then(function (c) { return c.from('assets').select('object_name').eq('id', id).limit(1); })
        .then(function (r) { var nm = r.data && r.data[0] && r.data[0].object_name; return nm ? signUrl(nm) : null; })
        .then(function (url) { if (url) el.setAttribute(attr, url); }, function () { });
    });
  }
  function watchBlobs() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'attributes') resolveBlobs(m.target.parentNode || document); else m.addedNodes.forEach(function (n) { if (n.nodeType === 1) resolveBlobs(n.parentNode || n); }); }); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
    resolveBlobs(document);
  }

  /* ------------------------------------------------------------------ downloads */
  var DOWNLOADS = Object.freeze({
    save: function (o) {
      return new Promise(function (ok, fail) {
        try {
          var data = o && o.data, name = String((o && o.filename) || 'mahala.txt').replace(/[\\/:*?"<>|]+/g, '-');
          var blob = data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: (o && o.type) || 'application/octet-stream' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          ok({ saved: true });
        } catch (e) { fail({ code: 'unavailable', message: String(e && e.message) }); }
      });
    },
  });

  /* ------------------------------------------------------------------ your picture (F-034) */
  // Your own picture, in this order: one you chose (kept in your folder of the private bucket as me-<random>, made
  // small on your device first), the one from your slide in the members' directory that the community map holds
  // (pushed by Mahala OS, read only by you: my_map_photo), else your emblem: a Seed of Life drawn
  // from your id, the same on every device and never anyone else's. Only ever shown to you here; the "photo" choice
  // decides more later. myPictureInfo says which one it is, for the words under it.
  var EMBLEM_HUES = [['#FFD81F', '#14A8E0'], ['#14A8E0', '#D8197F'], ['#D8197F', '#FFD81F'], ['#E06A2C', '#7E57C2'], ['#2E8558', '#FFD81F'], ['#7E57C2', '#14A8E0']];
  function seeded(seed) { var h = 2166136261, x = String(seed || 'mahala'); for (var i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function emblem(seed) {
    var r = seeded(seed), hue = EMBLEM_HUES[Math.floor(r() * EMBLEM_HUES.length)], n = [6, 8, 12][Math.floor(r() * 3)], rot = Math.round(r() * 60);
    var R = 15 + Math.round(r() * 5), rings = 1 + Math.floor(r() * 2), out = '';
    for (var k = 0; k < rings; k++) for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2, d = R * (k + 1) * (k ? 0.95 : 1);
      out += '<circle cx="' + (50 + d * Math.cos(a)).toFixed(2) + '" cy="' + (50 + d * Math.sin(a)).toFixed(2) + '" r="' + R + '" fill="none" stroke="#FBF8F3" stroke-opacity="' + (k ? .45 : .9) + '" stroke-width="' + (k ? .9 : 1.3) + '"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + hue[0] + '"/><stop offset="1" stop-color="' + hue[1] + '"/></linearGradient>' +
      '<clipPath id="c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#c)"><rect width="100" height="100" fill="url(#e)"/><g transform="rotate(' + rot + ' 50 50)">' + out + '</g>' +
      '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="#FBF8F3" stroke-width="1.6"/><circle cx="50" cy="50" r="5" fill="#2A221C"/></g></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  var mapPhotoP = null;
  function myPictureInfo(opts) {
    var useMap = !(opts && opts.map === false);
    return infoP.then(function (w) {
      if (!w || !w.signedIn) return null;
      // Never the picture Google gave (Chris, 8 Nov 2026): it is often just a letter, and the community map's is the one
      // Mahala knows people by. Your own, then the community map's, then your emblem.
      var last = function () { return { src: emblem(w.uid || w.personId), from: 'emblem' }; };
      var fallback = function () {
        if (!useMap || !w.claimed) return last();
        // chose the emblem over the community map's picture on Your Mahala (kept in their own yourmahala document)
        prefP = prefP || (w.level >= 2 && w.uid ? docRef('data/users/' + w.uid + '/yourmahala').get().then(function (d) { return d.exists && d.data() && d.data().pic === 'emblem'; }, function () { return false; }) : Promise.resolve(false));
        return prefP.then(function (emb) { return emb ? { src: emblem(w.uid || w.personId), from: 'chosen-emblem' } : mapped(); });
      };
      var mapped = function () {
        mapPhotoP = mapPhotoP || rpc('my_map_photo').then(function (r) { return r && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo || '') ? r.photo : null; }, function () { return null; });
        return mapPhotoP.then(function (u) { return u ? { src: u, from: 'map' } : last(); });
      };
      if (w.photo && w.uid) return signUrl(w.uid + '/' + w.photo).then(function (u) { return u ? { src: u, from: 'own' } : fallback(); }, fallback);
      return fallback();
    });
  }
  function myPicture(opts) { return myPictureInfo(opts).then(function (x) { return x && x.src; }); }
  var prefP = null;

  // The account chip on every page shows the same picture as Your Mahala (own, the community map's, the emblem):
  // <button data-mahala-account> (the shim's chips) and any element marked data-mahala-picture (a page's own account
  // button, as on Basecamp and the community map). Page code that rewrites the button's text loses the picture, so
  // each chip is watched and the picture put back.
  var CHIP_PIC = 'width:26px;height:26px;border-radius:50%;object-fit:cover;margin:0 8px 0 -8px;vertical-align:middle;flex:none';
  function paintChip(b, src) {
    var im = b.querySelector('img.mvm-pic');
    if (!src) { if (im) im.remove(); return; }
    if (!im) { im = document.createElement('img'); im.className = 'mvm-pic'; im.alt = ''; im.width = im.height = 26; im.referrerPolicy = 'no-referrer'; im.style.cssText = CHIP_PIC; b.prepend(im); }
    if (im.getAttribute('src') !== src) im.src = src;
  }
  var chipSrc = null, chipWatch = typeof MutationObserver === 'function' ? new MutationObserver(function (list) {
    list.forEach(function (m) { var b = m.target.closest ? m.target.closest('[data-mahala-account], [data-mahala-picture]') : null; if (b && chipSrc && !b.querySelector('img.mvm-pic')) paintChip(b, chipSrc); });
  }) : null;
  function paintChips() {
    return infoP.then(function (w) {
      var all = document.querySelectorAll('[data-mahala-account], [data-mahala-picture]');
      if (!all.length) return;
      var go = function (src) {
        chipSrc = src;
        Array.prototype.forEach.call(all, function (b) {
          paintChip(b, src);
          if (chipWatch && !b.dataset.mvPicWatch) { b.dataset.mvPicWatch = '1'; chipWatch.observe(b, { childList: true }); }
        });
      };
      if (!w || !w.signedIn || !w.claimed) return go(null);
      return myPicture().then(go, function () { });
    });
  }
  // Basecamp and the Community Map in the top bar, beside the account chip, on every page (Chris, 8 Nov 2026,
  // F-059): only for the people the database opens them to (journey_of: basecamp, community). A page marks the
  // place with data-mahala-doors, else they sit just before its account chip. A page's own way there is not repeated.
  var DOORS_CSS = '.mvm-doors{display:inline-flex;align-items:center;gap:6px;margin:0 6px;vertical-align:middle}' +
    '.mvm-door{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid currentColor;color:inherit;' +
    'font:500 12.5px/1 Jost,system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;white-space:nowrap;opacity:.9}' +
    '.mvm-door:hover,.mvm-door:focus-visible{opacity:1;background:rgba(127,127,127,.12)}' +
    '.mvm-door svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;margin-right:6px;flex:none}' +
    '@media (max-width:640px){.mvm-doors{gap:4px;margin:0 2px}.mvm-door{width:34px;min-height:34px;padding:0;justify-content:center}.mvm-door svg{margin:0}.mvm-door .mvm-dl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}';
  var DOOR_ICONS = {
    basecamp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 20l7-14 7 14M12 6v14M9.5 20l2.5-5 2.5 5"/></svg>',
    community: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="17" r="2.2"/><path d="M8 8.2l2.8 6.9M16.4 7.5l-3.2 7.6M8.2 7h7.6"/></svg>' };
  function mountDoors() {
    return infoP.then(function (w) {
      var j = w && w.signedIn && w.claimed ? w.journey || {} : {}, old = document.getElementById('mvm-doors');
      if (old) old.remove();
      var anchor = document.querySelector('[data-mahala-doors]') || document.querySelector('[data-mahala-account], [data-mahala-picture]');
      var here = (location.pathname.split('/').pop() || 'index.html'), links = [];
      if (j.basecamp && here !== 'basecamp.html' && !document.getElementById('toBasecamp')) links.push(['basecamp.html', 'Basecamp', 'basecamp']);
      if (j.community && here !== 'community.html' && !document.getElementById('toCommunity')) links.push(['community.html', 'Community Map', 'community']);
      if (!anchor || !links.length) return;
      if (!document.getElementById('mvm-doors-css')) { var st = document.createElement('style'); st.id = 'mvm-doors-css'; st.textContent = DOORS_CSS; document.head.appendChild(st); }
      var sp = document.createElement('span'); sp.id = 'mvm-doors'; sp.className = 'mvm-doors';
      sp.innerHTML = links.map(function (a) { var label = a[1].replace(/<[^>]+>/g, ''); return '<a class="mvm-door" data-door="' + a[2] + '" href="' + a[0] + '" title="' + label + '" aria-label="' + label + '">' + DOOR_ICONS[a[2]] + '<span class="mvm-dl">' + a[1] + '</span></a>'; }).join('');
      if (anchor.hasAttribute('data-mahala-doors')) anchor.appendChild(sp); else anchor.parentNode.insertBefore(sp, anchor);
    });
  }

  // A screenshot for the feedback form (F-060): made smaller on this device (at most 1600 px wide, JPEG), then kept in
  // the person's own folder of the private bucket as fb-<random>.jpg, which only they and the stewards can open.
  function shotOf(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type || '')) return fail({ code: 'invalid_argument', message: 'Choose a screenshot or an image file.' });
      if (file.size > 25 * 1024 * 1024) return fail({ code: 'invalid_argument', message: 'That image is very large. Try a smaller one.' });
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / img.naturalWidth), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) ok(b); else fail({ code: 'invalid_argument', message: 'That image could not be read.' }); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail({ code: 'invalid_argument', message: 'That image could not be read. Try a PNG or JPEG.' }); };
      img.src = url;
    });
  }
  function feedbackShot(file) {
    return infoP.then(function (w) {
      if (!w || !w.signedIn || !w.uid || !(w.level >= 2)) throw { code: 'not_granted', message: 'Sign in first.' };
      return shotOf(file).then(function (blob) {
        var name = 'fb-' + autoId(24) + '.jpg';
        return clientP.then(function (c) { return c.storage.from(BUCKET).upload(w.uid + '/' + name, blob, { contentType: 'image/jpeg', upsert: false }); })
          .then(function (r) { if (r.error) throw toErr(r.error); return { name: name, bytes: blob.size }; });
      });
    });
  }

  // After a picture is chosen, removed or swapped for the emblem: read it again and repaint every chip on this page.
  function pictureChanged() { mapPhotoP = null; prefP = null; return paintChips(); }
  // a picture made square and small (at most 480 px, JPEG) on this device before it goes anywhere
  function shrink(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type || '')) return fail({ code: 'invalid_argument', message: 'Choose a picture (a photo or an image file).' });
      if (file.size > 25 * 1024 * 1024) return fail({ code: 'invalid_argument', message: 'That picture is very large. Try a smaller one.' });
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var side = Math.min(img.naturalWidth, img.naturalHeight), out = Math.min(480, side), c = document.createElement('canvas');
        c.width = c.height = out;
        var g = c.getContext('2d'); g.fillStyle = '#F7F2EA'; g.fillRect(0, 0, out, out);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) ok(b); else fail({ code: 'invalid_argument', message: 'That picture could not be read.' }); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail({ code: 'invalid_argument', message: 'That picture could not be read. Try a JPEG or PNG.' }); };
      img.src = url;
    });
  }
  function setPhoto(file) {
    return infoP.then(function (w) {
      if (!w || !w.signedIn || !w.uid) throw { code: 'not_granted', message: 'Sign in first.' };
      if (!(w.level >= 2)) throw { code: 'not_granted', message: 'Pictures open once your account is a member\'s.' };
      return shrink(file).then(function (blob) {
        var name = 'me-' + autoId(24), old = w.photo;
        return clientP.then(function (c) { return c.storage.from(BUCKET).upload(w.uid + '/' + name, blob, { contentType: 'image/jpeg', upsert: false }); })
          .then(function (r) { if (r.error) throw toErr(r.error); return rpc('set_profile', { p_field: 'photo', p_text: name, p_visibility: 'me' }); })
          .then(function () {
            w.photo = name;
            if (old && old !== name) clientP.then(function (c) { return c.storage.from(BUCKET).remove([w.uid + '/' + old]); }).catch(function () { });
            return signUrl(w.uid + '/' + name);
          });
      });
    });
  }
  function clearPhoto() {
    return infoP.then(function (w) {
      var old = w && w.photo; if (!old) return myPicture();
      return rpc('set_profile', { p_field: 'photo', p_text: '', p_visibility: 'me' }).then(function () {
        w.photo = null;
        clientP.then(function (c) { return c.storage.from(BUCKET).remove([w.uid + '/' + old]); }).catch(function () { });
        return myPicture();
      });
    });
  }

  /* ------------------------------------------------------------------ window.claude */
  function use(name) {
    return infoP.then(function (w) {
      if (name === 'downloads') return DOWNLOADS;
      if (!w.signedIn || !w.claimed) return null;
      if (name === 'user') return USER;
      if (w.level < 2) return null;
      if (name === 'db') return DB;
      if (name === 'assets') return ASSETS;
      return null;                                                 // room, sample and the rest: not on Mahala's own site yet
    });
  }

  var AUTH = {
    info: function () {
      return infoP.then(function (w) {
        return { signedIn: !!(w.signedIn && w.claimed), uid: w.uid || null, name: w.name || '', email: w.email || '',
                 isNew: !!w.isNew, rulesDiffer: !!(w.rulesVersion && w.rulesVersion !== RULES_VERSION),
                 // the 2027 journey (tier, next step, roles) and whether the first-sign-in welcome is done, for the
                 // camp page and Your Mahala
                 journey: w.journey || null, noticeSeen: w.claimed ? !!w.noticeSeen : null, isSteward: !!w.isSteward,
                 level: w.level || 0, hasPhoto: !!w.photo, picture: w.picture || null, ended: !!w.ended };
      });
    },
    onChange: function (fn) { if (typeof fn === 'function') authFns.push(fn); return function () { authFns = authFns.filter(function (f) { return f !== fn; }); }; },
    open: function (mode, note) { return infoP.then(function () { UI.open(mode, note); }); },
    signOut: function () { return clientP.then(function (c) { ls.set(EDITION, null); ls.set(THREAD, null); return c.auth.signOut(); }).then(function () { }); },
    invoke: function (name, body) {
      return clientP.then(function (c) { return c.functions.invoke(name, { body: body || {} }); }).then(function (r) {
        if (r.error) throw { code: 'unavailable', message: String(r.error.message || r.error) };
        return r.data;
      });
    },
    removals: function () { return rpc('steward_removals').catch(function () { return []; }); },
    finishRemoval: function (uid) { return rpc('steward_finish_removal', { p_user: uid }).then(function () { return { ok: true }; }, function () { return { ok: false }; }); },
  };

  /* ------------------------------------------------------------------ quest progress, one record (F-065) */
  // Each person's quests live in the member database (quest_progress, migration 20261110000600), so a step ticked on
  // Your Mahala shows in the Mahalaverse and on Basecamp, and the other way round. Quest ids are the Mahalaverse's
  // (Q-01 to Q-07); steps count from 0. Each call gives back every quest of yours, as
  //   { 'Q-07': { steps: [true, false, false], takenAt: '...', updatedAt: '...' } }
  // quests() gives {} when signed out; the others refuse. Every change is also announced on the window as the event
  // 'mahala:quests' (detail: the same object), so any page open in the same tab can redraw.
  function questsSaid(q) {
    q = q && typeof q === 'object' && !Array.isArray(q) ? q : {};
    try { window.dispatchEvent(new CustomEvent('mahala:quests', { detail: q })); } catch (e) { }
    return q;
  }
  function asMember(fn) {
    return infoP.then(function (w) { if (!(w.signedIn && w.claimed)) throw { code: 'unauthenticated', message: 'sign in first' }; return fn(); });
  }
  var QUESTS = {
    quests: function () { return infoP.then(function (w) { return w.signedIn && w.claimed ? rpc('my_quests').then(function (q) { return q || {}; }) : {}; }); },
    markStep: function (quest, step, done) {
      var i = Number(step);
      if (!(i >= 0 && i <= 11 && Math.floor(i) === i)) return Promise.reject({ code: 'invalid-argument', message: 'unknown step' });
      return asMember(function () { return rpc('quest_mark', { p_quest: String(quest || ''), p_step: i, p_done: done !== false }).then(questsSaid); });
    },
    takeQuest: function (quest) { return asMember(function () { return rpc('quest_mark', { p_quest: String(quest || ''), p_step: null, p_done: true }).then(questsSaid); }); },
    dropQuest: function (quest) { return asMember(function () { return rpc('quest_drop', { p_quest: String(quest || '') }).then(questsSaid); }); },
  };

  /* ------------------------------------------------------------------ what Mahala already knows (F-050) */
  // For any form to fill in, so nobody is asked anything twice: from this device (the copy Join the tribe keeps for a
  // day, and the forms this browser sent; the WhatsApp number lives only there, since the member record never holds a
  // phone number) and, signed in, from the member record (name, address, playa name, where you live, what you bring,
  // who called you in). The record wins over the device. `from` says where each answer came from: 'profile' or 'device'.
  function splitHome(h) {
    var s = String(h || '').trim(), at = s.lastIndexOf(',');
    return at > 0 ? { town: s.slice(0, at).trim(), country: s.slice(at + 1).trim() } : { town: s, country: '' };
  }
  function known() {
    var out = { signedIn: false, name: '', email: '', playaName: '', based: '', town: '', country: '', home: '', gifts: '', skills: [], nominatedBy: '', whatsapp: '', from: {}, seen: {} };
    var put = function (k, v, from) { if (v && (!out[k] || from === 'profile') && !(Array.isArray(v) && !v.length)) { out[k] = v; out.from[k] = from; } };
    var box = [], ts = null;
    try { box = JSON.parse(ls.get('mahala.outbox') || '[]') || []; } catch (e) { }
    try { ts = JSON.parse(ls.get('mahala.tribeSkills') || 'null'); } catch (e) { }
    var sent = (Array.isArray(box) ? box : []).slice().reverse(), tribeRow = sent.filter(function (r) { return r && r.type === 'tribe'; })[0] || null;
    var t = tribeAnswers() || ts || tribeRow || {};
    var wa = sent.filter(function (r) { return r && r.whatsapp && (r.type !== 'tribe' || r.whatsappCommunity); })[0];
    put('name', String((tribeRow && tribeRow.name) || t.name || (sent.filter(function (r) { return r && r.name; })[0] || {}).name || '').slice(0, 80), 'device');
    put('email', String((sent.filter(function (r) { return r && r.email; })[0] || {}).email || '').slice(0, 120), 'device');
    put('town', String(t.town || '').slice(0, 60), 'device');
    put('country', String(t.country || '').slice(0, 60), 'device');
    put('based', t.based === 'sa' || t.based === 'away' ? t.based : t.country ? (SA_RE.test(String(t.country).trim()) ? 'sa' : 'away') : '', 'device');
    put('skills', Array.isArray(t.skills) ? t.skills.slice(0, 20) : [], 'device');
    put('whatsapp', wa ? String(wa.whatsapp).slice(0, 30) : '', 'device');
    return infoP.then(function (w) {
      if (!(w.signedIn && w.claimed)) return out;
      out.signedIn = true;
      put('email', w.email || '', 'profile');
      return rpc('my_thread').then(function (th) {
        var prof = {}; (th.profile || []).forEach(function (f) { prof[f.field] = f.text; out.seen[f.field] = f.visibility; });   // seen: who sees each field
        put('name', th.name || th.goesBy || w.name || '', 'profile');
        put('playaName', prof.playa_name || th.playaName || '', 'profile');
        if (prof.based === 'sa' || prof.based === 'away') put('based', prof.based, 'profile');
        if (prof.home_base) { var h = splitHome(prof.home_base); put('home', prof.home_base, 'profile'); put('town', h.town, 'profile'); put('country', h.country, 'profile'); }
        put('gifts', prof.gifts || '', 'profile');
        put('nominatedBy', (th.journey && th.journey.nominatedBy) || th.nominatedBy || '', 'profile');
        if (!out.home) out.home = [out.town, out.country].filter(Boolean).join(', ');
        return out;
      }, function () { return out; });
    }).then(function (o) { if (!o.home) o.home = [o.town, o.country].filter(Boolean).join(', '); return o; });
  }

  window.claude = Object.freeze({ use: use, __standalone: true, __auth: Object.freeze(AUTH) });
  window.MahalaMembers = Object.freeze({
    ready: infoP.then(function () { return AUTH.info(); }),
    info: AUTH.info, onChange: AUTH.onChange, signIn: function (note) { return AUTH.open('signin', note); }, account: function () { return AUTH.open('account'); },
    words: function (j) { return words(j); }, invite: function () { return invite(); },
    signOut: AUTH.signOut, rpc: rpc,
    // the Mahalaverse asks for an account before anyone steps onto the playa
    gate: function () { return AUTH.open('gate'); },
    // Your Mahala (F-034): your picture (chosen, the community map's, or your emblem), and choosing or removing one
    picture: myPicture, pictureInfo: myPictureInfo, emblem: emblem, pictureChanged: pictureChanged, feedbackShot: feedbackShot,
    setPicture: function (f) { return setPhoto(f).then(function (u) { pictureChanged(); return u; }); },
    clearPicture: function () { return clearPhoto().then(function (u) { pictureChanged(); return u; }); },
    // the end of Join the tribe: make the account with the address just given, and land on Your Mahala (F-025)
    join: function (o) { return infoP.then(function () { UI.join(o || {}); }); },
    correct: function (text) { return rpc('report_correction', { p_text: String(text || '').slice(0, 1000) }); },
    // quest progress, one record for Your Mahala, the Mahalaverse and Basecamp (F-065)
    quests: QUESTS.quests, markStep: QUESTS.markStep, takeQuest: QUESTS.takeQuest, dropQuest: QUESTS.dropQuest,
    // what Mahala already knows of you, for any form to fill in (F-050)
    known: known,
    mePage: MEPAGE,
  });

  /* ------------------------------------------------------------------ Join the tribe, once signed in (F-029) */
  // Every "Join the tribe" on every page (the front page's menu and frames, the tribe page, The Seed, the camp page)
  // takes someone already signed in to Your Mahala instead of the form. One listener here, so pages need no change:
  // links to tribe.html#join, [data-tribe-join] buttons, and anything marked data-mahala-join.
  var JOIN_SEL = 'a[href*="tribe.html#join"],[data-tribe-join],[data-mahala-join]';
  function goMe(replace) {
    if (!MEPAGE) return false;
    var url = new URL(MEPAGE, location.href).href, w = EMBEDDED ? window.top : window;
    if (replace) w.location.replace(url); else w.location.href = url;
    return true;
  }
  function hasSession() { try { return !!authStore.getItem(STORE_KEY); } catch (e) { return false; } }
  window.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest(JOIN_SEL) : null;
    if (!el || !MEPAGE || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (el.__mvPass) { el.__mvPass = false; return; }
    if (info && info.signedIn && info.claimed) { e.preventDefault(); e.stopImmediatePropagation(); goMe(); return; }
    if (info || !hasSession()) return;                        // signed out: the form, as before
    e.preventDefault(); e.stopImmediatePropagation();         // still finding out who this is: wait a moment
    infoP.then(function (w) { if (w && w.signedIn && w.claimed) goMe(); else { el.__mvPass = true; el.click(); } });
  }, true);

  /* ------------------------------------------------------------------ the journey's words */
  // The database says where someone stands and which step is next (journey_of, keys only); the words live here,
  // and Your Mahala reads them through MahalaMembers.words(journey). No figures: the fee is set by the stewards.
  var TIERS = { tribe: 'Tribe member', invited: 'Invited to camp 2027', applicant: 'Applied for camp 2027', camp: 'Camp member 2027' };
  var STEP_NAMES = { account: 'Your account', gathering: 'A gathering', quest: 'A quest', crew: 'A crew', apply: 'Your camp application',
                     call: 'A call with a camp lead', contribution: 'Your camp fee', camp_life: 'Camp life' };
  function words(j) {
    if (!j) return null;
    var by = j.nominatedBy ? ', called in by ' + j.nominatedBy : '';
    var nexts = {
      gathering: { title: 'Come to a gathering', text: 'Meet the tribe at one of the season\'s gatherings, and your thread ties its next knot.', href: 'tribe.html#events', cta: 'See the gatherings' },
      apply: { title: 'Accept your invitation', text: 'You are invited to camp with Mahala at AfrikaBurn 2027' + by + '. Send your camp application to claim your place: places are limited to 50.', href: 'camp.html?inv=account#join', cta: 'Open my application' },
      call: { title: 'Your application is in', text: 'The stewards are reading it, and a camp lead will be in touch for a short call. Nothing to do until then.' },
      waitlist: { title: 'You are on the waitlist', text: 'Places are limited to 50. We will tell you as soon as one opens.' },
      contribution: { title: 'Your place is confirmed', text: 'Welcome to camp! Look out for your secure payment link by email, for the plan you chose in your application (one, two or four instalments), with a receipt for each payment. Nothing is paid on the site.', href: 'camp.html', cta: 'About the camp' },
    };
    return {
      tier: j.tier, tierName: TIERS[j.tier] || TIERS.tribe, next: nexts[j.next] || nexts.gathering,
      steps: (j.steps || []).map(function (s) { return { key: s.key, label: STEP_NAMES[s.key] || s.key, state: s.state }; }),
      roles: (j.roles || []).map(function (r) { return { role: r.role, label: { core: 'Core team', camp_lead: 'Camp lead', crew_lead: 'Crew lead' + (r.crew ? ', ' + r.crew : ''), treasurer: 'Treasurer', steward: 'Steward', owner: 'Camp account' }[r.role] || r.role }; }),
      basecamp: j.basecamp ? BASECAMP : null,
    };
  }

  /* ------------------------------------------------------------------ what Join the tribe already asked */
  // The tribe form (tribe-join.js) keeps a copy of its answers on this device for a day, so the first sign-in never
  // asks them again (F-025, F-028): the name, the choices about staying in touch, where you live, what you bring.
  // The WhatsApp number never comes here; it stays with the camp's sheet.
  var TRIBE = 'mahala.tribe';
  var SA_RE = /^(south africa|suid-afrika|sa|rsa|za)$/i;
  function tribeAnswers() { try { var o = JSON.parse(ls.get(TRIBE) || 'null'); if (o && Date.now() - o.at < 864e5) return o; } catch (e) { } return null; }
  function tribeProfile(a) {
    var shareTo = a.share ? 'members' : 'stewards', out = [];
    var home = [a.town, a.country].filter(Boolean).join(', ');
    if (home) out.push(['home_base', home, 'stewards']);
    // where you live, asked once (F-046): in South Africa or abroad, so the camp application never asks again
    var based = a.based === 'sa' || a.based === 'away' ? a.based : a.country ? (SA_RE.test(String(a.country).trim()) ? 'sa' : 'away') : '';
    if (based) out.push(['based', based, 'stewards']);
    var gifts = [].concat(a.skills || [], a.other ? [a.other] : [], a.passions || []).filter(Boolean).join(', ');
    if (gifts) out.push(['gifts', gifts, shareTo]);
    if (a.creating) out.push(['about', a.creating, shareTo]);
    return out;
  }

  /* ------------------------------------------------------------------ the sheets */
  var NOTICE_VERSION = '2026-11-draft';
  var NOTICE = [
    ['Who we are', 'Mahala is a theme camp at AfrikaBurn and a community of temple builders. The camp\'s stewards look after this record. You can reach them at love@wearemahala.com.'],
    ['What we hold', 'What Mahala already knows of your time with the camp (the years, your roles, who brought you in), what you add here (a playa name, your gifts, your choices), and what you do in the Mahalaverse (your path, your book, the cards you keep). We never ask for health details, ID numbers or bank details here, and other members never see your address.'],
    ['Why', 'To welcome you, to keep your thread with Mahala, and, only if you say yes below, to send you Mahala news.'],
    ['Where it lives', 'In a member database in Frankfurt (Supabase, in the EU, which protects it to the standard POPIA section 72 asks), and in Mahala\'s private record, kept by the stewards. Claude, an AI assistant, helps the stewards read that record; it never contacts anyone by itself.'],
    ['Who sees what', 'You choose, for each thing: only you, the stewards, other members, or everyone. Your book is only ever yours.'],
    ['Your rights', 'See, correct, download or delete everything here at any time, in Account and privacy. If something is wrong, tell the stewards; you may also complain to the Information Regulator (inforegulator.org.za).'],
  ];
  var SCOPES = [
    ['news', 'Send me Mahala news by email, now and then. I can stop it any time.'],
    ['whatsapp', 'I am happy to hear from Mahala on WhatsApp.'],
    ['name', 'Show my name to other members in the Mahalaverse.'],
    ['directory', 'Show me in the members\' directory, when there is one.'],
    ['photo', 'Show my photo to other members.'],
  ];
  var FIELDS = [['gifts', 'Your gifts', 'What you bring: a craft, a skill, a song, a way of holding people'], ['about', 'A few words about you', '']];
  var VIS = [['me', 'Only me'], ['stewards', 'The stewards'], ['members', 'Members'], ['public', 'Everyone']];

  var CSS = '' +
    '.mvs-veil{position:fixed;inset:0;z-index:2147483000;overscroll-behavior:contain;background:rgba(14,12,20,.55);display:grid;place-items:center;padding:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));overflow:auto}' +
    '.mvs-veil,.mvs,.mvs *{box-sizing:border-box} .mvs{--i:#2A221C;--i2:#5B5047;--g:#F7F2EA;--l:#DCD2C3;--a:#8A5A2B;width:min(520px,100%);max-height:calc(var(--mvs-vh,100vh) - 32px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:var(--g);color:var(--i);border-radius:22px;padding:26px 24px 22px;box-shadow:0 24px 70px rgba(0,0,0,.35);font:400 15.5px/1.55 Jost,"Avenir Next","Segoe UI",system-ui,sans-serif;position:relative;text-align:left}' +
    '.mvs h2{font:400 26px/1.15 Marcellus,"Cormorant Garamond",Georgia,serif;letter-spacing:.02em;margin:0 36px 8px 0;text-transform:none;text-align:left}' +
    '.mvs h3{font:500 12px/1.4 Jost,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--i2);margin:20px 0 8px}' +
    '.mvs p{margin:0 0 10px;color:var(--i2)} .mvs p.lead{color:var(--i)} .mvs small{color:var(--i2);font-size:13px}' +
    '.mvs-x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:1px solid var(--l);background:none;color:var(--i);font-size:20px;line-height:1;cursor:pointer}' +
    '.mvs-b{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:46px;margin:8px 0 0;padding:0 18px;border-radius:999px;border:1px solid var(--i);background:var(--i);color:var(--g);font:500 15px Jost,system-ui,sans-serif;cursor:pointer}' +
    '.mvs-b.q{background:none;color:var(--i);border-color:var(--l)} .mvs-b.warn{background:#7A2E22;border-color:#7A2E22} .mvs-b[disabled]{opacity:.55;cursor:default}' +
    '.mvs-or{display:flex;align-items:center;gap:12px;margin:14px 0 6px;color:var(--i2);font-size:13px}.mvs-or:before,.mvs-or:after{content:"";flex:1;height:1px;background:var(--l)}' +
    '.mvs input[type=email],.mvs input[type=password],.mvs input[type=text],.mvs textarea,.mvs select{width:100%;box-sizing:border-box;min-height:44px;padding:10px 14px;border-radius:14px;border:1px solid var(--l);background:#fff;color:var(--i);font:inherit}' +
    '.mvs textarea{min-height:80px;resize:vertical} .mvs label{display:block}' +
    '.mvs label.mvs-ck{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--l);cursor:pointer} .mvs-ck input{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin:2px 0 0;flex:none;border:1.5px solid var(--i);border-radius:5px;background:#fff;display:grid;place-items:center;cursor:pointer}' +
    '.mvs-ck input:checked{background:var(--i)} .mvs-ck input:checked::after{content:"";width:5px;height:10px;border:solid var(--g);border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)} .mvs-ck input:focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
    '.mvs [hidden]{display:none!important} .mvs-row{display:grid;gap:6px;margin:0 0 12px} .mvs-row .mvs-two{display:grid;grid-template-columns:1fr auto;gap:8px}' +
    '.mvs-rung{border:1px solid var(--l);border-radius:16px;padding:12px 14px;margin:6px 0 4px} .mvs-rung b{font:400 19px Marcellus,Georgia,serif;display:block}' +
    '.mvs ul.mvs-th{margin:0;padding:0 0 0 18px;color:var(--i2)} .mvs ul.mvs-th li{margin:3px 0}' +
    '.mvs details{border-top:1px solid var(--l);padding:8px 0} .mvs summary{cursor:pointer;color:var(--i)}' +
    '.mvs-msg{min-height:1.4em;color:var(--a);font-size:14px;margin-top:8px} .mvs a{color:var(--a)} .mvs a.mvs-b{color:var(--g);text-decoration:none} .mvs a.mvs-b.q{color:var(--i)}' +
    '.mvs-g{width:18px;height:18px;flex:none}' +
    '.mvs-foot{position:sticky;bottom:-22px;margin:16px -24px -22px;padding:12px 24px 18px;background:linear-gradient(rgba(247,242,234,0),var(--g) 30%)} .mvs-foot .mvs-msg{margin-top:6px}' +
    '.mvs label.mvs-keep{border-top:0;padding:2px 0 6px} .mvs-row small{margin-top:-2px}' +
    '.mvs-hold{border:1px solid var(--l);border-radius:16px;padding:12px 14px;margin:0 0 12px;background:#fffdf9} .mvs-hold p{margin:0 0 6px;color:var(--i)} .mvs-inv{font-style:italic}' +
    '.mvs-b.q.on{border-color:var(--i);box-shadow:inset 0 0 0 1px var(--i)} .mvs-ask{border:1px solid var(--a);border-radius:16px;padding:12px 14px;margin:0 0 12px} .mvs-ask p{color:var(--i)}' +
    '.mvs-rung span{display:block;color:var(--i2);margin:4px 0 2px} .mvs-fix{margin-top:8px} .mvs-fix textarea{margin-top:8px}' +
    '.mvs-steps{list-style:none;margin:14px 0 8px;padding:0;counter-reset:s} .mvs-steps li{display:flex;justify-content:space-between;gap:10px;padding:8px 0 8px 30px;border-top:1px solid var(--l);position:relative;counter-increment:s;color:var(--i2)}' +
    '.mvs-steps li:before{content:counter(s);position:absolute;left:0;top:7px;width:20px;height:20px;border-radius:50%;border:1px solid var(--l);font-size:12px;display:grid;place-items:center}' +
    '.mvs-steps li.done{color:var(--i)} .mvs-steps li.done:before{content:"\\2713";background:var(--i);color:var(--g);border-color:var(--i)} .mvs-steps li.now{color:var(--i);font-weight:500} .mvs-steps li.now:before{border-color:var(--a);color:var(--a)}' +
    '.mvs-links{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;margin:12px 0 4px;font-size:14px} .mvs-alt{margin:10px 0 6px;font-size:14px;text-align:center}' +
    '.mvs-gw{min-height:46px;margin:8px 0 0;display:flex;justify-content:center} .mvs-gw .mvs-b{margin:0} .mvs-gbtn{display:flex;justify-content:center;width:100%}' +
    '.mvs-toast{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483001;background:#2A221C;color:#F7F2EA;padding:10px 18px;border-radius:999px;font:500 14px Jost,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:calc(100vw - 32px)}' +
    '.mvm-chip{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid currentColor;background:none;color:inherit;font:500 14px Jost,system-ui,sans-serif;cursor:pointer}' +
    '@media (prefers-reduced-motion:no-preference){.mvs{animation:mvsIn .25s ease}}@keyframes mvsIn{from{opacity:0;transform:translateY(8px)}}';

  var UI = (function () {
    var veil = null, lastFocus = null;
    function css() { if (!document.getElementById('mvs-css')) { var s = document.createElement('style'); s.id = 'mvs-css'; s.textContent = CSS; document.head.appendChild(s); } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function close() { if (veil) { veil.remove(); veil = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); } }
    function sheet(html, label, closable) {
      css(); close();
      lastFocus = document.activeElement;
      veil = document.createElement('div'); veil.className = 'mvs-veil';
      veil.innerHTML = '<div class="mvs" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + (closable === false ? '' : '<button type="button" class="mvs-x" data-k="close" aria-label="Close">&times;</button>') + html + '</div>';
      document.body.appendChild(veil);
      // the sheet's height follows what the phone actually shows (toolbars and the keyboard come and go)
      var v = veil, vv = window.visualViewport, fit = function () { if (v.isConnected) v.style.setProperty('--mvs-vh', Math.round(Math.min(vv ? vv.height : Infinity, innerHeight)) + 'px'); };
      fit(); (vv || window).addEventListener('resize', fit);
      veil.addEventListener('click', function (e) { if (e.target === veil && closable !== false) close(); var b = e.target.closest('[data-k="close"]'); if (b) close(); });
      // The front page drives its own scroll from window listeners (touch, wheel, keys). Inside a sheet those must
      // not reach it, or a long sheet cannot be scrolled on a phone (7 Nov 2026: the welcome's button out of reach).
      ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach(function (t) { veil.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
      veil.addEventListener('keydown', function (e) { e.stopPropagation(); });
      veil.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && closable !== false) { e.stopPropagation(); close(); }
        if (e.key === 'Tab') {
          var f = veil.querySelectorAll('button,input,select,textarea,a[href],summary'); if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      var first = veil.querySelector('input,button:not(.mvs-x)'); if (first) setTimeout(function () { first.focus(); }, 30);
      return veil.querySelector('.mvs');
    }
    function toast(t) { css(); [].forEach.call(document.querySelectorAll('.mvs-toast'), function (o) { o.remove(); }); var d = document.createElement('div'); d.className = 'mvs-toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4200); }
    function msg(el, t) { var m = el.querySelector('.mvs-msg'); if (m) m.textContent = t || ''; }
    function noticeHtml() { return NOTICE.map(function (n) { return '<details><summary>' + esc(n[0]) + '</summary><p>' + esc(n[1]) + '</p></details>'; }).join(''); }
    var GOOGLE = '<svg class="mvs-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

    function redirectTo(gate) {
      ls.set(ASKED, String(Date.now()));       // this browser asked: only then is a sign-in in the address taken (security review, 8 Nov)
      if (ss.get(LAND) === '1' && MEPAGE) { setAfter(null); return new URL(MEPAGE, location.href).href + '?signin=1'; }
      if (gate || /^#(mahalaverse|enter|play)/i.test(location.hash) || document.documentElement.classList.contains('to-mv') || document.body.classList.contains('from-seed')) setAfter('#mahalaverse');
      else setAfter(location.hash && location.hash.length < 40 ? location.hash : null);
      return location.origin + location.pathname + '?signin=1';
    }

    // What went wrong, in the camp's words. Supabase's own message decides; the address is never confirmed or denied.
    function authMsg(e, what) {
      var m = String((e && e.message) || ''), code = String((e && e.code) || ''), wait = m.match(/after (\d+) seconds?/i);
      if (wait) return 'We sent you a link ' + (what === 'reset' ? 'to reset your password ' : '') + 'a moment ago. Look in your inbox (and Promotions or Spam). You can ask for another in ' + wait[1] + ' seconds.';
      if (/rate limit|too many/i.test(m) || /rate_limit/.test(code)) return 'Lots of people are signing in just now. Try again in a few minutes.';
      if (/invalid login credentials/i.test(m) || code === 'invalid_credentials') return 'That email and password do not match. Try again, or use Forgot your password.';
      if (/email not confirmed/i.test(m) || code === 'email_not_confirmed') return 'confirm';
      if (/password should be|weak_password|at least/i.test(m) || code === 'weak_password') return 'Choose a password of at least 8 characters.';
      if (/same password|same_password/i.test(m)) return 'That is your current password. Choose a new one.';
      if (/signups not allowed|signup_disabled/i.test(m)) return 'New accounts are closed just now. Write to love@wearemahala.com.';
      return 'That did not work. Try again in a little while.';
    }
    var PW_MIN = 8;
    function keepBox() { return '<label class="mvs-ck mvs-keep"><input type="checkbox" name="keep"' + (keepOn() ? ' checked' : '') + '><span>Keep me signed in on this device</span></label>'; }
    function setKeep(el) { var k = el.querySelector('[name="keep"]'); if (k) ls.set(KEEP, k.checked ? '1' : '0'); }

    // Sign in, or make an account. A password, an email link, or Google; a first sign-in by link or Google makes the
    // account too. As the gate to the Mahalaverse (gate: true) it cannot be closed, only left for the front page.
    function signIn(gate, mode, note) {
      mode = mode || 'in';
      var letter = ss.get('mahala.fromLetter') === '1';
      var title = mode === 'up' ? 'Make your account' : mode === 'forgot' ? 'Forgot your password?' : mode === 'link' ? 'Come in by email'
        : letter ? 'Your thread is waiting' : gate ? 'Step into the Mahalaverse' : 'Your Mahala account';
      var lead = mode === 'up' ? 'Your path, your book and your card stay with you on every device.'
        : mode === 'forgot' ? 'Give us your address and we will send you a link to choose a new password.'
        : mode === 'link' ? 'No password needed: we send you a link, and opening it signs you in. It makes your account if you are new.'
        : letter ? 'You came by your letter. Sign in, and the thread Mahala holds for you is yours: the years, the people, the choices you make.'
        : gate ? 'The Mahalaverse is home to Mahala\'s online community of temple builders. Sign in, or make your account, to step onto the playa.'
        : 'Sign in, or make your account. Your path, your book and your card stay with you on every device.';
      var email = '<label class="mvs-row"><span>Your email address</span><input type="email" name="email" autocomplete="' + (mode === 'up' ? 'email' : 'username') + '" required></label>';
      var google = GOOGLE_ON && (mode === 'in' || mode === 'up')
        ? '<div class="mvs-gw" data-k="gwrap"><button type="button" class="mvs-b q" data-k="google">' + GOOGLE + 'Continue with Google</button></div><div class="mvs-or">or with your email</div>' : '';
      var body;
      if (mode === 'in') body = '<form data-k="form">' + email +
        '<label class="mvs-row"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>' +
        keepBox() + '<button type="submit" class="mvs-b">Sign in</button></form>' +
        '<p class="mvs-links"><a href="#" data-m="forgot">Forgot your password?</a><a href="#" data-m="link">Email me a link instead</a></p>' +
        '<p class="mvs-alt">New here? <a href="#" data-m="up">Make your account</a></p>';
      else if (mode === 'up') body = '<form data-k="form">' + email +
        '<label class="mvs-row"><span>Choose a password</span><input type="password" name="password" autocomplete="new-password" required><small>At least ' + PW_MIN + ' characters.</small></label>' +
        keepBox() + '<button type="submit" class="mvs-b">Make my account</button></form>' +
        '<p class="mvs-links"><a href="#" data-m="link">Rather have no password? Email me a link</a></p>' +
        '<p class="mvs-alt">Already have an account? <a href="#" data-m="in">Sign in</a></p>';
      else if (mode === 'forgot') body = '<form data-k="form">' + email +
        '<button type="submit" class="mvs-b">Email me a reset link</button></form>' +
        '<p class="mvs-alt"><a href="#" data-m="in">Back to sign in</a></p>';
      else body = '<form data-k="form">' + email + keepBox() +
        '<button type="submit" class="mvs-b">Email me a link to come in</button></form>' +
        '<p class="mvs-alt"><a href="#" data-m="in">Sign in with a password instead</a></p>';
      var el = sheet('<h2>' + title + '</h2><p class="lead">' + lead + '</p>' + google + body +
        '<div class="mvs-msg" role="status">' + esc(note || '') + '</div>' +
        '<p><small>' + (GOOGLE_ON && (mode === 'in' || mode === 'up') ? 'Google shares only your name, address and photo with Mahala, never your Gmail. ' : '') + '<a href="#" data-k="notice">How Mahala looks after your thread</a>.</small></p>' +
        (gate ? '<a class="mvs-b q" href="./" data-k="back">Back to The Seed</a>' : ''), mode === 'up' ? 'Make your account' : 'Sign in', !gate);
      var form = el.querySelector('form'), addrIn = el.querySelector('[name="email"]');
      var last = ss.get('mahala.lastEmail'); if (last && addrIn) addrIn.value = last;
      Array.prototype.forEach.call(el.querySelectorAll('[data-m]'), function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); if (addrIn && addrIn.value) ss.set('mahala.lastEmail', addrIn.value.trim()); signIn(gate, a.getAttribute('data-m')); });
      });
      el.querySelector('[data-k="notice"]').addEventListener('click', function (e) { e.preventDefault(); showNotice(); });
      if (google) mountGoogle(el, gate);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var addr = String(addrIn.value || '').trim(), pw = form.password ? form.password.value : '', b = form.querySelector('button[type="submit"]');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(addr)) { msg(el, 'That address does not look right.'); addrIn.focus(); return; }
        if (mode === 'up' && pw.length < PW_MIN) { msg(el, 'Choose a password of at least ' + PW_MIN + ' characters.'); form.password.focus(); return; }
        ss.set('mahala.lastEmail', addr); setKeep(el);
        b.disabled = true; msg(el, mode === 'in' ? 'Signing in...' : 'Sending...');
        var done = function (html) { msg(el, ''); form.outerHTML = '<p class="lead mvs-sent">' + html + '</p>'; };
        clientP.then(function (c) {
          if (mode === 'in') return c.auth.signInWithPassword({ email: addr, password: pw });
          if (mode === 'up') return c.auth.signUp({ email: addr, password: pw, options: { emailRedirectTo: redirectTo(gate) } });
          if (mode === 'forgot') return c.auth.resetPasswordForEmail(addr, { redirectTo: redirectTo(gate) });
          return c.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(gate), shouldCreateUser: true } });
        }).then(function (r) {
          b.disabled = false;
          if (r && r.error) {
            var t = authMsg(r.error, mode === 'forgot' ? 'reset' : 'link');
            if (t === 'confirm') {     // made with a password but not confirmed yet: send the confirmation again
              clientP.then(function (c) { return c.auth.resend({ type: 'signup', email: addr, options: { emailRedirectTo: redirectTo(gate) } }); });
              t = 'Confirm your address first. We have sent the confirmation link to ' + addr + ' again.';
            }
            msg(el, t); return;
          }
          if (mode === 'in') { msg(el, 'Welcome back. One moment...'); return; }     // the page starts again, signed in
          if (mode === 'up') {
            var d = r && r.data;
            if (d && d.session) { msg(el, 'Your account is made. One moment...'); return; }
            if (d && d.user && Array.isArray(d.user.identities) && !d.user.identities.length) { signIn(gate, 'in', 'You already have an account with ' + addr + '. Sign in, or use Forgot your password to set one.'); return; }
            done('One last step: we have sent a link to <b>' + esc(addr) + '</b>. Open it to confirm your address, and you arrive signed in.');
            return;
          }
          if (mode === 'forgot') { done('If ' + esc(addr) + ' has a Mahala account, a link to choose a new password is on its way. Open it on this device.'); return; }
          done('A link is on its way to <b>' + esc(addr) + '</b>. Open it on this device, and you arrive signed in. It can take a minute; look in Promotions or Spam too.');
        }, function () { b.disabled = false; msg(el, 'Signing in is not available right now. Try again in a little while.'); });
      });
    }

    // Continue with Google. With the web client ID in site.js: Google's own button (one tap, signed in on this page).
    // Without it, or if Google's script does not load: Supabase's redirect to Google and back.
    function mountGoogle(el, gate) {
      var wrap = el.querySelector('[data-k="gwrap"]'), btn = el.querySelector('[data-k="google"]');
      var redirect = function () {
        msg(el, 'Opening Google...'); setKeep(el);
        clientP.then(function (c) { return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo(gate) } }); })
          .then(function (r) { if (r && r.error) msg(el, 'Google sign-in is not open yet. Use your email for now.'); }, function () { msg(el, 'Signing in is not available right now.'); });
      };
      btn.addEventListener('click', redirect);
      if (!GOOGLE_CLIENT || !window.crypto || !crypto.subtle) return;
      var raw = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(24)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      Promise.all([loadGsi(), crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))]).then(function (v) {
        var hashed = Array.prototype.map.call(new Uint8Array(v[1]), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        if (!document.body.contains(wrap)) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT, nonce: hashed, ux_mode: 'popup', use_fedcm_for_prompt: true,
          callback: function (resp) {
            setKeep(el); msg(el, 'Signing in with Google...');
            clientP.then(function (c) { return c.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: raw }); })
              .then(function (r) { if (r && r.error) msg(el, 'Google sign-in did not work. Try again, or use your email.'); else msg(el, 'Welcome. One moment...'); },
                function () { msg(el, 'Signing in is not available right now.'); });
          },
        });
        var slot = document.createElement('div'); slot.className = 'mvs-gbtn';
        wrap.replaceChildren(slot);
        window.google.accounts.id.renderButton(slot, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center', width: Math.min(400, Math.max(240, wrap.clientWidth || 320)) });
      }).catch(function () { /* keep the redirect button */ });
    }
    var gsiP = null;
    function loadGsi() {
      if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
      return gsiP || (gsiP = new Promise(function (ok, fail) {
        var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
        s.onload = function () { ok(); }; s.onerror = function () { gsiP = null; fail(new Error('gsi')); };
        setTimeout(function () { fail(new Error('gsi timeout')); }, 6000);
        document.head.appendChild(s);
      }));
    }

    // After a reset link: choose the new password (the link has already signed this browser in).
    function newPassword(fromAccount, then) {
      var el = sheet('<h2>' + (fromAccount ? 'Your password' : 'Choose a new password') + '</h2>' +
        '<p class="lead">' + (fromAccount ? 'Set a password to sign in with your email and password, on any device. The email link and Google keep working too.' : 'You are signed in. Choose the password you will use from now on.') + '</p>' +
        '<form data-k="form"><label class="mvs-row"><span>New password</span><input type="password" name="password" autocomplete="new-password" required><small>At least ' + PW_MIN + ' characters.</small></label>' +
        '<label class="mvs-row"><span>The same again</span><input type="password" name="again" autocomplete="new-password" required></label>' +
        '<button type="submit" class="mvs-b">Save my password</button></form><div class="mvs-msg" role="status"></div>', 'Choose a password', true);
      var form = el.querySelector('form');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = form.password.value, b = form.querySelector('button');
        if (pw.length < PW_MIN) { msg(el, 'Choose a password of at least ' + PW_MIN + ' characters.'); return; }
        if (pw !== form.again.value) { msg(el, 'The two passwords are not the same.'); return; }
        b.disabled = true; msg(el, 'Saving...');
        clientP.then(function (c) { return c.auth.updateUser({ password: pw }); }).then(function (r) {
          b.disabled = false;
          if (r && r.error) { var t = authMsg(r.error); msg(el, t === 'confirm' ? 'That did not save. Try again.' : t); return; }
          ss.set(RECOVERY, null); close(); toast('Your password is saved.'); if (typeof then === 'function') setTimeout(then, 400);
        }, function () { b.disabled = false; msg(el, 'That did not save. Try again in a little while.'); });
      });
    }

    function showNotice() {
      sheet('<h2>How Mahala looks after your thread</h2><p><small>Draft ' + esc(NOTICE_VERSION) + ', for the stewards to approve.</small></p>' + noticeHtml() +
        '<button type="button" class="mvs-b q" data-k="close">Close</button>', 'Privacy notice');
    }

    // The first time someone signs in. Someone Mahala knows (their verified address matched) is welcomed back and
    // shown what Mahala holds, to confirm or correct, not to fill in again. Someone new gives the name they go by;
    // if it is the full name of exactly one person Mahala knows, they are asked "Is that you?", and a yes goes to the
    // stewards to confirm (nothing is joined on a name alone). Either way: the notice, and every choice unticked.
    function welcome(w) {
      if (w.isNew) return drawWelcome(w, null);
      rpc('my_thread').then(function (t) { drawWelcome(w, t); }, function () { drawWelcome(w, null); });
    }
    // Three points at most (Chris, 8 Nov 2026, F-047): when you last camped with Mahala, then what is yours alone and
    // shows you are known and loved (your own words, what you bring, the people your thread runs with), from your own
    // profile (my_thread, only ever yours). Enough to be sure it is you; the rest waits on Your Mahala.
    var CAMP_OF = { 2024: 'Nowhere\u2019s End', 2025: 'The Portal', 2026: 'Through the Prism', 2027: 'The Seed' };
    function threePoints(t) {
      var years = (t.years || []).map(Number).filter(function (y) { return y && y < 2027; }), last = years.length ? Math.max.apply(null, years) : 0;
      var K = t.ownProfile && typeof t.ownProfile === 'object' ? t.ownProfile : {}, S = t.soul && Array.isArray(t.soul.lines) ? t.soul.lines : [];
      var str = function (x) { return typeof x === 'string' ? x : ''; }, cut = function (x, n) { x = str(x).replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : x; };
      var pts = [];
      if (last) pts.push('You last camped with us in <b>' + last + '</b>' + (CAMP_OF[last] ? ', ' + esc(CAMP_OF[last]) : (last <= 2023 ? ', at The State of Bliss' : '')) + (years.length > 1 ? ', one of your ' + years.length + ' years with Mahala.' : '.'));
      var own = (K.own || []).concat(K.gifts || []).filter(function (q) { return Array.isArray(q) && str(q[1]).length > 12; })[0];
      var said = S.filter(function (l) { return l && str(l.q); })[0];
      if (own) pts.push('In your words: <i>\u201c' + esc(cut(own[1], 110)) + '\u201d</i>');
      else if (said) pts.push('In your words: <i>\u201c' + esc(cut(said.q, 110)) + '\u201d</i>');
      var B = K.bring && typeof K.bring === 'object' ? K.bring : null, tags = B ? (B.tags || []).concat(B.values || []).filter(str).slice(0, 3) : [];
      var th = (K.threads || []).filter(function (x) { return Array.isArray(x) && str(x[1]); }).slice(0, 2);
      if (tags.length) pts.push('What you bring: ' + esc(tags.join(', ')) + '.');
      else if (th.length) pts.push('Your thread runs with ' + esc(th.map(function (x) { return x[1]; }).join(' and ')) + '.');
      if (pts.length < 2) (t.thread || []).slice().reverse().filter(function (l) { return l && l.text && +l.year !== 2027 && !/nominated/i.test(l.text); }).slice(0, 3 - pts.length)
        .forEach(function (l) { pts.push((l.year ? '<b>' + esc(l.year) + '</b>: ' : '') + esc(cut(l.text, 120))); });
      return pts.slice(0, 3);
    }
    function holds(t) {
      var pts = threePoints(t);
      return '<h3>Is this you?</h3><div class="mvs-hold">' +
        '<p><b>' + esc(t.name || t.goesBy || '') + '</b></p>' +
        (pts.length ? '<ul class="mvs-th mvs-three">' + pts.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' +
        '<label class="mvs-row"><span>Your playa name</span><input type="text" name="playa" maxlength="60" autocomplete="off" value="' + esc(t.playaName || '') + '" placeholder="The name you go by at the burn"></label>' +
        '<div class="mvs-two"><button type="button" class="mvs-b q on" data-k="right" style="margin:0">Yes, that is me</button><button type="button" class="mvs-b q" data-k="wrong" style="margin:0">Something is not right</button></div>' +
        '<label class="mvs-row" data-k="fixbox" hidden style="margin-top:10px"><span>What should we change or add?</span><textarea name="fix" maxlength="1000" placeholder="A year you camped, a role, a name, anything"></textarea></label>';
    }
    function drawWelcome(w, t) {
      var fresh = !!w.isNew, asked = !!w.asked, checkedName = '', pending = null, shown = false, answered = false;
      // what the tribe form already asked: never asked again, only shown, to change if wanted
      var ta = tribeAnswers(), said = ta ? { news: !!ta.news, whatsapp: !!ta.wa, name: !!ta.share, directory: !!ta.share } : null;
      var knownName = (ta && ta.name) || '';
      var nameRow = knownName
        ? '<div class="mvs-hold" data-k="namebox"><p>We will call you <b data-k="nmshow">' + esc(knownName) + '</b>, as you told us when you joined. <a href="#" data-k="nmchange">Change</a></p>' +
          '<input type="text" name="nm" maxlength="80" autocomplete="name" value="' + esc(knownName) + '" hidden></div>'
        : '<label class="mvs-row"><span>What should we call you? Your first and last name helps us find your thread.</span><input type="text" name="nm" maxlength="80" autocomplete="name" required value="' + esc(w.name || '') + '"></label>';
      var el = sheet('<h2>' + (fresh ? (knownName ? 'Welcome to the tribe, ' + esc(knownName.split(/\s+/)[0]) : 'Welcome to Mahala') : 'Welcome back, ' + esc(w.name || 'temple builder')) + '</h2>' +
        '<p class="lead">' + (fresh ? (ta ? 'Your account is made, and what you told us when you joined is already here. One look at how Mahala looks after it, and your page opens.'
          : 'You are part of Mahala\'s online community now. Tell us what to call you, choose how we stay in touch, and step onto the playa.')
          : 'It is good to see you again. Here is what Mahala holds of your journey with us: have a look, and tell us if anything is missing or wrong.') + '</p>' +
        (fresh ? nameRow + '<div class="mvs-ask" data-k="ask" hidden></div>' +
                 (ta ? '' : '<label class="mvs-row"><span>Your playa name, if you have one</span><input type="text" name="playa" maxlength="60" autocomplete="off"></label>')
               : (t ? holds(t) : '')) +
        '<h3>Stay in touch</h3>' + SCOPES.map(function (s) { return '<label class="mvs-ck"><input type="checkbox" name="' + s[0] + '"' + (said && said[s[0]] ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') +
        '<p><small>' + (said ? 'Ticked as you chose on the tribe form; nothing else is ticked for you.' : 'Nothing is ticked for you.') + ' You can change any of it later in Account and privacy.</small></p>' +
        '<h3>How Mahala looks after your thread</h3>' + noticeHtml() +
        '<div class="mvs-foot"><button type="button" class="mvs-b" data-k="save">' + (fresh ? 'Make my account' : 'I have read this. Continue') + '</button><div class="mvs-msg" role="status"></div></div>', 'Welcome', false);
      var nm = el.querySelector('[name="nm"]'), playa = el.querySelector('[name="playa"]'), ask = el.querySelector('[data-k="ask"]'), fixbox = el.querySelector('[data-k="fixbox"]');
      // "Is that you?": only a full name, only once per name, only for someone new who has not asked already
      function lookUp() {
        var v = nm ? nm.value.trim().replace(/\s+/g, ' ') : '';
        if (!fresh || asked || !ask || !/^\S{2,} .*\S{2,}$/.test(v)) return Promise.resolve(false);
        if (v === checkedName) return pending || Promise.resolve(shown);
        checkedName = v; shown = false; answered = false;
        return (pending = rpc('find_my_thread', { p_name: v }).then(function (r) {
          if (!r || !r.match) { ask.hidden = true; return false; }
          shown = true;
          ask.innerHTML = '<p>Mahala knows someone called <b>' + esc(v) + '</b>. Is that you?</p>' +
            '<div class="mvs-two"><button type="button" class="mvs-b q" data-k="yes" style="margin:0">Yes, that is me</button><button type="button" class="mvs-b q" data-k="no" style="margin:0">No, not me</button></div>';
          ask.hidden = false;
          return true;
        }, function () { return false; }));
      }
      if (nm) { nm.addEventListener('change', lookUp); nm.addEventListener('blur', lookUp); }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        var k = b.getAttribute('data-k');
        if (k === 'yes') {
          b.disabled = true; answered = true;
          rpc('ask_for_my_thread', { p_name: checkedName }).then(function (r) {
            asked = !!(r && r.asked); info.asked = asked;
            ask.innerHTML = '<p>' + (asked ? 'Thank you. A steward will join your thread to this account, usually within a day: your years and camps will then appear on Your Mahala.'
              : 'We could not ask just now. Tell the stewards at love@wearemahala.com and they will join your thread.') + '</p>';
          }, function () { b.disabled = false; });
        }
        if (k === 'no') { ask.hidden = true; answered = true; }
        if (k === 'nmchange') { e.preventDefault(); b.parentNode.hidden = true; nm.hidden = false; nm.focus(); }
        if (k === 'right') { b.classList.add('on'); var wr = el.querySelector('[data-k="wrong"]'); if (wr) wr.classList.remove('on'); if (fixbox) fixbox.hidden = true; }
        if (k === 'wrong') { b.classList.add('on'); var ri = el.querySelector('[data-k="right"]'); if (ri) ri.classList.remove('on'); if (fixbox) { fixbox.hidden = false; fixbox.querySelector('textarea').focus(); } }
      });
      el.querySelector('[data-k="save"]').addEventListener('click', function (e) {
        var b = e.currentTarget, fix = el.querySelector('[name="fix"]');
        if (nm && !nm.value.trim()) { msg(el, 'Tell us what to call you.'); nm.focus(); return; }
        b.disabled = true; msg(el, 'Saving...');
        // a full name not looked up yet: ask first, and let them answer before the account is made
        lookUp().then(function (isShown) {
          if (isShown && !answered && !asked) { b.disabled = false; msg(el, 'One question first, just above.'); ask.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
          var steps = (nm ? rpc('set_my_name', { p_name: nm.value.trim() }) : Promise.resolve())
            .then(function () { return playa && playa.value.trim() && playa.value.trim() !== ((t && t.playaName) || '') ? rpc('set_profile', { p_field: 'playa_name', p_text: playa.value.trim(), p_visibility: 'members' }) : null; })
            .then(function () { return fix && fix.value.trim() && fixbox && !fixbox.hidden ? rpc('report_correction', { p_text: fix.value.trim() }) : null; })
            // what the tribe form told us joins the record once, with who sees it as the form said
            .then(function () {
              if (!ta) return null;
              return tribeProfile(ta).reduce(function (p, f) { return p.then(function () { return rpc('set_profile', { p_field: f[0], p_text: f[1].slice(0, 2000), p_visibility: f[2] }).catch(function () { }); }); }, Promise.resolve());
            })
            .then(function () { return rpc('accept_notice', { p_version: w.noticeVersion }); })
            .then(function () {
              return SCOPES.reduce(function (p, s) {
                return p.then(function () { return rpc('set_consent', { p_scope: s[0], p_granted: !!el.querySelector('[name="' + s[0] + '"]').checked, p_source: 'first-sign-in' }); });
              }, Promise.resolve());
            });
          steps.then(function () {
            close();
            if (ta) { ls.set('mahala.tribeSkills', JSON.stringify({ skills: ta.skills || [], country: ta.country || '', town: ta.town || '', based: ta.based || '', at: Date.now() })); ls.set(TRIBE, null); }
            info.noticeSeen = true;
            try { window.dispatchEvent(new CustomEvent('mahala:changed', { detail: { welcomed: true } })); } catch (er) { }
            toast(fresh ? (onMe() ? 'Welcome. This page is yours.' : 'Welcome to the Mahalaverse.') : (fix && fix.value.trim() && fixbox && !fixbox.hidden ? 'Thank you. The stewards will look at what you sent.' : 'Your thread is yours. Welcome back.'));
            if (fresh && nm) { info.name = nm.value.trim().split(/\s+/)[0]; mountChips(true); var c = document.querySelector('#v7-platform-chip .v7-platform-nm'); if (c) c.textContent = info.name; }
            setTimeout(function () { guide(w.journey); }, 600);
          }, function (er) { b.disabled = false; msg(el, (er && er.message) || 'That did not save. Try again.'); });
        });
      });
    }

    // After the welcome, or on any page later: someone invited is shown the way to their camp application. On the
    // camp page the application itself opens; elsewhere a short sheet offers it, once per visit.
    var guided = false;
    function guide(j) {
      if (guided || !j || j.tier !== 'invited' || onMe()) return;
      guided = true;
      if (/camp\.html$/.test(location.pathname) && window.__join && window.__join.open) {
        if (ss.get('mahala.openJoin') === '1' || /^#(join|apply)$/i.test(location.hash) || ss.get('mahala.guided') !== '1') { ss.set('mahala.openJoin', null); ss.set('mahala.guided', '1'); toast('Your invitation is open.'); window.__join.open(); }
        return;
      }
      if (ss.get('mahala.guided') === '1') return;
      ss.set('mahala.guided', '1');
      var x = words(j);
      sheet('<h2>Your invitation is waiting</h2><p class="lead">' + esc(x.next.text) + '</p>' + stepsHtml(x) +
        '<a class="mvs-b" href="' + esc(x.next.href) + '" style="text-decoration:none">' + esc(x.next.cta) + '</a>' +
        '<button type="button" class="mvs-b q" data-k="close">Later</button>', 'Your invitation', true);
    }
    function stepsHtml(x) {
      return '<ol class="mvs-steps">' + x.steps.map(function (s) { return '<li class="' + esc(s.state) + '"><span>' + esc(s.label) + '</span><small>' + (s.state === 'done' ? 'Done' : s.state === 'now' ? 'Next' : '') + '</small></li>'; }).join('') + '</ol>';
    }

    function account() {
      if (!info || !info.signedIn) { signIn(); return; }
      var el = sheet('<h2>Account and privacy</h2><p>Loading your thread...</p>', 'Account and privacy');
      rpc('my_thread').then(function (t) {
        var p = {}; (t.profile || []).forEach(function (f) { p[f.field] = f; });
        var lines = (t.thread || []).map(function (l) { return '<li>' + (l.year ? '<b>' + esc(l.year) + '</b>: ' : '') + esc(l.text) + '</li>'; }).join('');
        el.innerHTML = '<button type="button" class="mvs-x" data-k="close" aria-label="Close">&times;</button>' +
          '<h2>' + esc(t.goesBy || t.name || 'Your thread') + '</h2>' +
          '<p><small>Signed in as ' + esc(info.email || '') + (t.signIns > 1 ? ' (one of ' + t.signIns + ' sign-ins)' : '') + '</small></p>' +
          (CFG.mePage ? '<p><a class="mvs-b" href="' + esc(CFG.mePage) + '" style="text-decoration:none">Open Your Mahala, your own page</a></p>' : '') +
          (t.isNew ? '<p class="lead">You are part of Mahala\'s online community.' + (info.asked ? ' A steward will join your thread to this account soon.' : '') + '</p>' +
            // "I am already in the community under another address": the address is checked, never kept (ask_to_be_joined)
            (info.asked ? '' : '<details class="mvs-fix" data-k="joinbox"><summary>Already part of Mahala under another email address?</summary>' +
              '<p>Give the address Mahala knows you by, or tell us how we know you. A steward checks and joins your thread to this account, and your years and camps then show here.</p>' +
              '<input type="email" name="other" autocomplete="off" placeholder="The other address"><textarea name="how" maxlength="300" placeholder="Anything that helps: a camp year, the name you went by"></textarea>' +
              '<button type="button" class="mvs-b q" data-k="joinask">Ask the stewards</button></details>') : '') +
          (function () {
            var x = words(t.journey); if (!x) return '';
            return '<h3>Where you stand</h3><div class="mvs-rung"><b>' + esc(x.tierName) + '</b><span>' + esc(x.next.title) + '. ' + esc(x.next.text) + '</span>' +
              (x.next.href ? '<a class="mvs-b q" href="' + esc(x.next.href) + '" style="text-decoration:none">' + esc(x.next.cta) + '</a>' : '') + '</div>' +
              (x.roles.length ? '<p><small>Your roles for 2027: ' + x.roles.map(function (r) { return esc(r.label); }).join(', ') + '</small></p>' : '') +
              (x.basecamp ? '<a class="mvs-b q" href="' + esc(x.basecamp) + '" target="_blank" rel="noopener" style="text-decoration:none">Open Basecamp</a>' : '');
          })() +
          (lines ? '<h3>Your thread</h3><ul class="mvs-th">' + lines + '</ul>' : '') +
          '<details class="mvs-fix"><summary>Something missing or wrong in what Mahala holds?</summary><textarea name="fix" maxlength="1000" placeholder="A year you camped, a role, a name, anything"></textarea><button type="button" class="mvs-b q" data-k="fix">Send to the stewards</button></details>' +
          '<h3>Your playa name</h3><div class="mvs-row"><div class="mvs-two"><input type="text" name="playa" maxlength="60" value="' + esc((p.playa_name && p.playa_name.text) || t.playaName || '') + '" placeholder="The name you go by at the burn"><button type="button" class="mvs-b q" data-k="playa" style="margin:0;width:auto">Save</button></div></div>' +
          '<h3>Your choices</h3>' + SCOPES.map(function (s) { return '<label class="mvs-ck"><input type="checkbox" data-scope="' + s[0] + '"' + (t.consent && t.consent[s[0]] ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') +
          '<h3>What you share</h3>' + FIELDS.map(function (f) {
            var cur = p[f[0]] || {};
            return '<div class="mvs-row"><label><span>' + esc(f[1]) + '</span><textarea data-field="' + f[0] + '" maxlength="2000" placeholder="' + esc(f[2]) + '">' + esc(cur.text || '') + '</textarea></label>' +
              '<div class="mvs-two"><select data-vis="' + f[0] + '" aria-label="Who sees it">' + VIS.map(function (v) { return '<option value="' + v[0] + '"' + ((cur.visibility || 'me') === v[0] ? ' selected' : '') + '>Seen by: ' + v[1] + '</option>'; }).join('') + '</select>' +
              '<button type="button" class="mvs-b q" data-save="' + f[0] + '" style="margin:0;width:auto">Save</button></div></div>';
          }).join('') +
          '<h3>Your data</h3><p>Everything this site holds about you is yours to see, take and remove.</p>' +
          '<button type="button" class="mvs-b q" data-k="password">Set or change your password</button>' +
          '<button type="button" class="mvs-b q" data-k="export">Download my data</button>' +
          '<button type="button" class="mvs-b q" data-k="signout">Sign out</button>' +
          '<button type="button" class="mvs-b q" data-k="delete">Delete my account</button>' +
          (info.isSteward ? '<h3>For stewards: new members</h3><p data-k="pending">Checking...</p><h3>For stewards: notes about the record</h3><p data-k="fixes">Checking...</p>' : '') +
          '<div class="mvs-msg" role="status"></div>' +
          '<p><small><a href="#" data-k="notice">How Mahala looks after your thread</a></small></p>';
        el.addEventListener('change', function (e) {
          var s = e.target.getAttribute('data-scope'); if (!s) return;
          rpc('set_consent', { p_scope: s, p_granted: e.target.checked }).then(function () { msg(el, 'Saved.'); }, function () { e.target.checked = !e.target.checked; msg(el, 'That did not save. Try again.'); });
        });
        el.addEventListener('click', function (e) {
          var b = e.target.closest('button,a'); if (!b) return;
          var k = b.getAttribute('data-k'), f = b.getAttribute('data-save');
          if (k === 'playa') rpc('set_profile', { p_field: 'playa_name', p_text: el.querySelector('[name="playa"]').value, p_visibility: 'members' }).then(function () { msg(el, 'Saved.'); }, function () { msg(el, 'That did not save.'); });
          if (f) rpc('set_profile', { p_field: f, p_text: el.querySelector('[data-field="' + f + '"]').value, p_visibility: el.querySelector('[data-vis="' + f + '"]').value }).then(function () { msg(el, 'Saved.'); }, function () { msg(el, 'That did not save.'); });
          if (k === 'export') rpc('export_my_data').then(function (d) { return DOWNLOADS.save({ filename: 'my-mahala-thread.json', data: d, type: 'application/json' }); }).then(function () { msg(el, 'Your data is downloading.'); }, function () { msg(el, 'That did not work. Try again.'); });
          if (k === 'signout') { msg(el, 'Signing out...'); AUTH.signOut(); }
          if (k === 'fix') { var fx = el.querySelector('[name="fix"]'); if (!fx.value.trim()) { msg(el, 'Tell us what is not right.'); return; } rpc('report_correction', { p_text: fx.value.trim() }).then(function () { fx.value = ''; msg(el, 'Thank you. The stewards will look at it.'); }, function () { msg(el, 'That did not send. Try again.'); }); }
          if (k === 'joinask') {
            var jb = el.querySelector('[data-k="joinbox"]'), oa = jb.querySelector('[name="other"]').value.trim(), hw = jb.querySelector('[name="how"]').value.trim();
            if (!oa && !hw) { msg(el, 'Give the other address, or tell us how Mahala knows you.'); return; }
            if (oa && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(oa)) { msg(el, 'That address does not look right.'); return; }
            b.disabled = true;
            rpc('ask_to_be_joined', { p_address: oa || null, p_note: hw || null }).then(function () {
              info.asked = true; jb.outerHTML = '<p class="lead">Thank you. A steward will check and join your thread to this account, usually within a day.</p>'; msg(el, '');
            }, function (er) { b.disabled = false; msg(el, (er && er.code !== 'unavailable' && er.message) || 'That did not send. Try again, or write to love@wearemahala.com.'); });
          }
          if (k === 'password') newPassword(true);
          if (k === 'delete') del();
          if (k === 'notice') { e.preventDefault(); showNotice(); }
        });
        if (info.isSteward) { stewardList(el); stewardFixes(el); }
      }, function () { el.innerHTML = '<button type="button" class="mvs-x" data-k="close" aria-label="Close">&times;</button><h2>Account and privacy</h2><p>Your thread could not be loaded. Try again in a little while.</p>'; });
    }

    // For stewards: the newest members Mahala OS has not taken in yet (the next sync does that by itself). If one is
    // someone Mahala already knows under another address, join them to that person (their id, as on their page in
    // community/people/); or make an account a guest, or block it.
    function stewardList(el) {
      var pe = el.querySelector('[data-k="pending"]'); if (!pe) return;
      rpc('steward_new_members').then(function (list) {
        if (!list.length) { pe.textContent = 'No new members since the last sync.'; return; }
        var box = document.createElement('div');
        box.innerHTML = '<p>' + list.length + (list.length === 1 ? ' new member' : ' new members') + ' since the last sync. The next sync takes them into Mahala OS. Join someone to a person Mahala already knows only when the address shows it is them.</p>' + list.map(function (x, i) {
          var addrs = (x.signIns || []).map(function (s) { return esc(s.address) + ' (' + esc(s.method) + ')'; }).join(', ');
          return '<div class="mvs-row" data-i="' + i + '" style="border-top:1px solid var(--l);padding-top:10px">' +
            '<b>' + esc(x.name || 'No name yet') + '</b><small>' + (addrs || 'No address') + ', joined ' + esc(String(x.since || '').slice(0, 10)) + (x.access && x.access !== 'auto' ? ', ' + esc(x.access) : '') + (x.letter ? ', came by a letter' : '') + '</small>' +
            (x.asksToBe ? '<small>Says they are <b>' + esc(x.asksToBe.name) + '</b>' + (x.asksToBe.years && x.asksToBe.years.length ? ' (' + esc(x.asksToBe.years.join(', ')) + ')' : '') +
              (x.asksToBe.via === 'address' ? ': the other address they gave is on that record (they have not signed in with it), so check with them before joining.' : ': join them if the address fits.') + '</small>' : '') +
            (x.asks || []).filter(function (a) { return a.note; }).slice(0, 2).map(function (a) { return '<small>Their note: ' + esc(a.note) + '</small>'; }).join('') +
            (x.asks && x.asks.length && !x.asksToBe ? '<small>Says they are already in the community; nobody matched what they gave.</small>' : '') +
            (x.addressOnSeveral ? '<small>Their address is on more than one record, so it matched nobody.</small>' : '') +
            '<div class="mvs-two"><input type="text" data-pid placeholder="Same person as: p-firstname-surname" aria-label="Mahala OS id this member already has" value="' + esc(x.asksToBe ? x.asksToBe.personId : '') + '">' +
            '<button type="button" class="mvs-b q" data-s="merge" style="margin:0;width:auto">Join them</button></div>' +
            '<div class="mvs-two"><button type="button" class="mvs-b q" data-s="guest" style="margin:0">Guest only</button><button type="button" class="mvs-b q" data-s="blocked" style="margin:0;width:auto">Block</button></div></div>';
        }).join('');
        pe.replaceWith(box);
        box.addEventListener('click', function (e) {
          var b = e.target.closest('[data-s]'); if (!b) return;
          var row = b.closest('[data-i]'), x = list[+row.getAttribute('data-i')], k = b.getAttribute('data-s'), done;
          if (k === 'merge') {
            var pid = row.querySelector('[data-pid]').value.trim();
            if (!/^p-[a-z0-9][a-z0-9-]{0,80}$/.test(pid)) { msg(el, 'That does not look like a Mahala OS id (p-firstname-surname).'); return; }
            done = rpc('steward_merge', { p_new: x.personId, p_person: pid });
          } else done = rpc('steward_set_access', { p_person: x.personId, p_access: k });
          b.disabled = true;
          done.then(function () { if (k === 'merge') row.remove(); else b.disabled = false; msg(el, k === 'merge' ? 'Joined. Their accounts are one thread now.' : k === 'guest' ? 'Made a guest: signed in, but nothing in the game.' : 'Blocked.'); },
            function (er) { b.disabled = false; msg(el, (er && er.message) || 'That did not work.'); });
        });
      }, function () { pe.textContent = 'The list of new members could not be loaded.'; });
    }

    function stewardFixes(el) {
      var fe = el.querySelector('[data-k="fixes"]'); if (!fe) return;
      rpc('steward_corrections').then(function (list) {
        fe.outerHTML = list.length ? '<ul class="mvs-th">' + list.slice(0, 20).map(function (c) { return '<li><b>' + esc(c.name || c.personId) + '</b> (' + esc(c.personId) + ', ' + esc(String(c.at).slice(0, 10)) + '): ' + esc(c.text) + '</li>'; }).join('') + '</ul><p><small>The next pull carries these into Mahala OS too.</small></p>'
          : '<p>No notes yet.</p>';
      }, function () { fe.textContent = 'The notes could not be loaded.'; });
    }

    function del() {
      var el = sheet('<h2>Delete my account</h2>' +
        '<p class="lead">This removes your sign-ins, your choices, what you shared, your Mahalaverse path, book and uploads from this site. It cannot be undone.</p>' +
        '<p>Mahala\'s private record of your time with the camp stays with the stewards; they get a note that you asked, and will remove what you ask them to.</p>' +
        '<label class="mvs-row"><span>Type <b>delete</b> to confirm</span><input type="text" name="confirm" autocomplete="off"></label>' +
        '<button type="button" class="mvs-b warn" data-k="go" disabled>Delete my account</button><button type="button" class="mvs-b q" data-k="close">Keep my account</button><div class="mvs-msg" role="status"></div>', 'Delete my account');
      var go = el.querySelector('[data-k="go"]');
      el.querySelector('[name="confirm"]').addEventListener('input', function (e) { go.disabled = e.target.value.trim().toLowerCase() !== 'delete'; });
      go.addEventListener('click', function () {
        go.disabled = true; msg(el, 'Removing your uploads...');
        // Every folder that is yours, not only the current one (T-267, 9 Nov 2026): after two records of one person are
        // joined, older uploads stay under the old game id, and my_folders() names it. Without the function (before the
        // back-end review migration), the current folder as before. The database counts what is left either way.
        clientP.then(function (c) {
          var own = info.uid ? [info.uid] : [];
          return Promise.resolve(rpc('my_folders')).then(function (d) { return Array.isArray(d) && d.length ? d : own; }, function () { return own; })
            .then(function (dirs) {
              return dirs.reduce(function (p, dir) {
                return p.then(function () {
                  return c.storage.from(BUCKET).list(dir, { limit: 1000 }).then(function (r) {
                    var names = (r.data || []).map(function (f) { return dir + '/' + f.name; });
                    return names.length ? c.storage.from(BUCKET).remove(names) : null;
                  }).catch(function () { });
                });
              }, Promise.resolve());
            }).catch(function () { });
        }).then(function () { msg(el, 'Deleting your account...'); ending = true; return rpc('delete_my_account'); })
          // Forget the sign-in on this device whatever the server says (8 Nov 2026, F-030: the page reloaded still
          // holding it, and the account came straight back). Then a fresh page, signed out, with no old return address.
          .then(function () {
            [EDITION, THREAD, NOTED, 'mahala.tribe'].forEach(function (k) { ls.set(k, null); });
            [AFTER, LAND, RECOVERY, 'mahala.lastEmail', 'mahala.openJoin', 'mahala.guided', 'mahala.restarted'].forEach(function (k) { ss.set(k, null); });
            authStore.removeItem(STORE_KEY); ss.set('mahala.ended', '1');      // the next page says the account is gone
            return clientP.then(function (c) { return c.auth.signOut({ scope: 'local' }).catch(function () { }); }).then(function () { authStore.removeItem(STORE_KEY); });
          })
          .then(function () {
            el.innerHTML = '<h2>Your account is deleted</h2><p class="lead">Thank you for walking with Mahala. Your sign-in, your choices and what you shared here are gone. The door stays open, whenever you want to come back.</p>' +
              '<a class="mvs-b" href="./" style="text-decoration:none">Back to the website</a>';
            setTimeout(function () { location.replace(MEPAGE && onMe() ? MEPAGE : location.pathname); }, 4000);
          }, function () { ending = false; go.disabled = false; msg(el, 'That did not work. Try again, or write to the stewards at love@wearemahala.com.'); });
      });
    }

    // The end of Join the tribe (F-025): the form has the address already, so the account is one tap: Google, or a
    // link to that address. No second form, and the welcome that follows asks nothing the form asked. Lands on Your Mahala.
    function join(o) {
      var addr = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(o.email || '').trim()) ? String(o.email).trim() : '';
      var first = String(o.name || '').trim().split(/\s+/)[0] || '';
      ss.set(LAND, '1'); setAfter(null);
      if (addr) ss.set('mahala.lastEmail', addr);
      var google = GOOGLE_ON ? '<div class="mvs-gw" data-k="gwrap"><button type="button" class="mvs-b q" data-k="google">' + GOOGLE + 'Continue with Google</button></div>' : '';
      var el = sheet('<h2>Your page is waiting' + (first ? ', ' + esc(first) : '') + '</h2>' +
        '<p class="lead">You are in the tribe. One last tap opens Your Mahala: your own page, with the gatherings ahead, your card from the deck and your thread with Mahala. Nothing to fill in again.</p>' +
        google + (addr ? (google ? '<div class="mvs-or">or</div>' : '') +
          '<button type="button" class="mvs-b' + (google ? ' q' : '') + '" data-k="mail">Email my link to ' + esc(addr) + '</button>' +
          '<p class="mvs-alt"><small>Open it on this device and you arrive on your page, signed in.</small></p>' : '') +
        keepBox() +
        '<div class="mvs-msg" role="status"></div>' +
        '<p class="mvs-links"><a href="#" data-k="pw">Use a password instead</a><a href="#" data-k="notice">How Mahala looks after your thread</a></p>' +
        '<button type="button" class="mvs-b q" data-k="later">Later</button>', 'Your page is waiting', true);
      if (google) mountGoogle(el, false);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        var k = b.getAttribute('data-k');
        if (k === 'notice') { e.preventDefault(); showNotice(); }
        if (k === 'pw') { e.preventDefault(); signIn(false, 'up'); }
        if (k === 'later') { ss.set(LAND, null); close(); }
        if (k === 'mail') {
          b.disabled = true; setKeep(el); msg(el, 'Sending...');
          clientP.then(function (c) { return c.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(false), shouldCreateUser: true } }); }).then(function (r) {
            b.disabled = false;
            if (r && r.error) { msg(el, authMsg(r.error, 'link')); return; }
            msg(el, '');
            b.outerHTML = '<p class="lead mvs-sent">A link is on its way to <b>' + esc(addr) + '</b>. Open it on this device, and you arrive on your page. It can take a minute; look in Promotions or Spam too.</p>';
          }, function () { b.disabled = false; msg(el, 'Signing in is not available right now. Try again in a little while.'); });
        }
      });
    }

    return {
      join: join,
      toast: toast,
      open: function (mode, note) { if (mode === 'gate') signIn(true); else if (mode === 'newpass') newPassword(false); else if (mode === 'password') newPassword(true); else if (mode === 'link') signIn(false, 'link', note); else if (mode === 'account') account(); else if (mode === 'delete') del(); else if (mode === 'notice') showNotice(); else if (info && info.signedIn) account(); else signIn(false, 'in', note); },
      welcome: welcome, newPassword: newPassword, guide: guide,
    };
  })();

  function afterSignIn(w) {
    var ready = function (f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); };
    ready(function () {
      watchBlobs();
      mountChips();
      var needsWelcome = w.signedIn && w.claimed && !w.noticeSeen;
      var recovering = w.signedIn && ss.get(RECOVERY) === '1';
      // The tribe page's Join, opened while signed in (a shared link, or the front page's pane): Your Mahala (F-029)
      if (!recovering && w.signedIn && w.claimed && /tribe\.html$/.test(location.pathname) && /^#join$/i.test(location.hash) && goMe(true)) return;
      // The first sign-in lands on Your Mahala, where the welcome happens and an invitation shows in full (F-024,
      // F-025), wherever it began: the tribe form, the Mahalaverse's door, the camp page, a letter. The one exception:
      // an application that asked for the account first opens straight after it, on the camp page.
      var land = ss.get(LAND) === '1'; ss.set(LAND, null);
      // Basecamp is a working tool someone came to on purpose: it keeps them.
      if (!recovering && w.signedIn && w.claimed && (needsWelcome || land) && !onMe() && !/basecamp\.html$/.test(location.pathname) && ss.get('mahala.openJoin') !== '1' && goMe(true)) return;
      if (recovering) UI.newPassword(false, needsWelcome ? function () { UI.welcome(w); } : null);   // a reset link: the new password first
      else if (needsWelcome) UI.welcome(w);
      else if (w.signedIn && w.claimed) setTimeout(function () { UI.guide(w.journey); }, 800);
      else if (!w.signedIn && URL_AUTH && URL_AUTH.error) UI.open('link', 'That link has expired or has already been used. Ask for a new one here.');
      else if (!w.signedIn && ss.get('mahala.fromLetter') === '1' && !ss.get('mahala.letterShown')) { ss.set('mahala.letterShown', '1'); UI.open('signin'); }
    });
  }

  // Pages without the game (camp.html, seed.html) put <button data-mahala-account> where a sign-in belongs.
  function mountChips(refresh) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-mahala-account]'), function (b) {
      if (b.dataset.mvOn) { if (refresh) { b.textContent = info && info.signedIn ? (info.name || 'Your account') : 'Sign in'; paintChips(); } return; }
      b.dataset.mvOn = '1';
      b.classList.add('mvm-chip'); b.hidden = false;
      b.textContent = info && info.signedIn ? (info.name || 'Your account') : 'Sign in';
      // signed in, the chip opens the member's own page (site.js members.mePage), else the account box
      b.addEventListener('click', function () {
        if (info && info.signedIn && MEPAGE && !onMe()) { goMe(); return; }
        UI.open(info && info.signedIn ? 'account' : 'signin');
      });
    });
    paintChips(); mountDoors();
    if (document.querySelector('[data-mahala-account]') && !document.getElementById('mvs-css')) { var s = document.createElement('style'); s.id = 'mvs-css'; s.textContent = CSS; document.head.appendChild(s); }
  }
})();
