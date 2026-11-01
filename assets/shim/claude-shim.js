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
  if (!CFG.url || !CFG.anonKey || window.claude) return;

  var RULES_VERSION = '746824445fc6';
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var SUPABASE_SRI = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';   // that exact file, so a changed copy never runs
  var STORE_KEY = 'mahala-auth', EDITION = 'mahala.edition', THREAD = 'mahala.thread', AFTER = 'mahala.after';
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
      if (t !== null || u.searchParams.has('signin')) {
        u.searchParams.delete('thread'); u.searchParams.delete('signin');
        history.replaceState(null, '', u.pathname + (u.search || '') + (/access_token|error_description/.test(u.hash) ? '' : u.hash));
      }
    } catch (e) { }
  })();

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
      auth: { storageKey: STORE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
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
    return c.auth.getSession().then(function (r) {
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
      if (!s) return { signedIn: false, level: 0, rulesVersion: null };
      return rpc('whoami').then(function (w) {
        if (w.claimed) { ls.set(THREAD, null); return w; }
        var tok = letterToken(); ls.set(THREAD, null);
        return rpc('claim_thread', { p_token: tok });
      });
    });
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

  function restart() {
    var after = ss.get(AFTER); ss.set(AFTER, null);
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
    me: function () { return infoP.then(function (w) { return profile(w.uid, w.name, false); }); },
    name: function () { return infoP.then(function (w) { return w.name || ''; }); },
    avatarUrl: function () { return infoP.then(function (w) { return w.uid ? avatar(w.name, colourOf(w.uid)) : null; }); },
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
                 isNew: !!w.isNew, rulesDiffer: !!(w.rulesVersion && w.rulesVersion !== RULES_VERSION) };
      });
    },
    onChange: function (fn) { if (typeof fn === 'function') authFns.push(fn); return function () { authFns = authFns.filter(function (f) { return f !== fn; }); }; },
    open: function (mode) { return infoP.then(function () { UI.open(mode); }); },
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

  window.claude = Object.freeze({ use: use, __standalone: true, __auth: Object.freeze(AUTH) });
  window.MahalaMembers = Object.freeze({
    ready: infoP.then(function () { return AUTH.info(); }),
    info: AUTH.info, onChange: AUTH.onChange, signIn: function () { return AUTH.open('signin'); }, account: function () { return AUTH.open('account'); },
    signOut: AUTH.signOut, rpc: rpc,
    // the Mahalaverse asks for an account before anyone steps onto the playa
    gate: function () { return AUTH.open('gate'); },
  });

  /* ------------------------------------------------------------------ the sheets */
  var NOTICE_VERSION = '2026-11-draft';
  var NOTICE = [
    ['Who we are', 'Mahala is a theme camp at AfrikaBurn and a community of temple builders. The camp\'s stewards look after this record. You can reach them at wearemahala@gmail.com.'],
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
    '.mvs-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(14,12,20,.55);display:grid;place-items:center;padding:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));overflow:auto}' +
    '.mvs{--i:#2A221C;--i2:#5B5047;--g:#F7F2EA;--l:#DCD2C3;--a:#8A5A2B;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--g);color:var(--i);border-radius:22px;padding:26px 24px 22px;box-shadow:0 24px 70px rgba(0,0,0,.35);font:400 15.5px/1.55 Jost,"Avenir Next","Segoe UI",system-ui,sans-serif;position:relative;text-align:left}' +
    '.mvs h2{font:400 26px/1.15 Marcellus,"Cormorant Garamond",Georgia,serif;letter-spacing:.02em;margin:0 36px 8px 0}' +
    '.mvs h3{font:500 12px/1.4 Jost,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--i2);margin:20px 0 8px}' +
    '.mvs p{margin:0 0 10px;color:var(--i2)} .mvs p.lead{color:var(--i)} .mvs small{color:var(--i2);font-size:13px}' +
    '.mvs-x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:1px solid var(--l);background:none;color:var(--i);font-size:20px;line-height:1;cursor:pointer}' +
    '.mvs-b{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:46px;margin:8px 0 0;padding:0 18px;border-radius:999px;border:1px solid var(--i);background:var(--i);color:var(--g);font:500 15px Jost,system-ui,sans-serif;cursor:pointer}' +
    '.mvs-b.q{background:none;color:var(--i);border-color:var(--l)} .mvs-b.warn{background:#7A2E22;border-color:#7A2E22} .mvs-b[disabled]{opacity:.55;cursor:default}' +
    '.mvs-or{display:flex;align-items:center;gap:12px;margin:14px 0 6px;color:var(--i2);font-size:13px}.mvs-or:before,.mvs-or:after{content:"";flex:1;height:1px;background:var(--l)}' +
    '.mvs input[type=email],.mvs input[type=text],.mvs textarea,.mvs select{width:100%;box-sizing:border-box;min-height:44px;padding:10px 14px;border-radius:14px;border:1px solid var(--l);background:#fff;color:var(--i);font:inherit}' +
    '.mvs textarea{min-height:80px;resize:vertical} .mvs label{display:block}' +
    '.mvs label.mvs-ck{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--l);cursor:pointer} .mvs-ck input{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin:2px 0 0;flex:none;border:1.5px solid var(--i);border-radius:5px;background:#fff;display:grid;place-items:center;cursor:pointer}' +
    '.mvs-ck input:checked{background:var(--i)} .mvs-ck input:checked::after{content:"";width:5px;height:10px;border:solid var(--g);border-width:0 2px 2px 0;transform:translateY(-1px) rotate(45deg)} .mvs-ck input:focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
    '.mvs-row{display:grid;gap:6px;margin:0 0 12px} .mvs-row .mvs-two{display:grid;grid-template-columns:1fr auto;gap:8px}' +
    '.mvs-rung{border:1px solid var(--l);border-radius:16px;padding:12px 14px;margin:6px 0 4px} .mvs-rung b{font:400 19px Marcellus,Georgia,serif;display:block}' +
    '.mvs ul.mvs-th{margin:0;padding:0 0 0 18px;color:var(--i2)} .mvs ul.mvs-th li{margin:3px 0}' +
    '.mvs details{border-top:1px solid var(--l);padding:8px 0} .mvs summary{cursor:pointer;color:var(--i)}' +
    '.mvs-msg{min-height:1.4em;color:var(--a);font-size:14px;margin-top:8px} .mvs a{color:var(--a)} .mvs a.mvs-b{color:var(--i);text-decoration:none}' +
    '.mvs-g{width:18px;height:18px;flex:none}' +
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
      veil.addEventListener('click', function (e) { if (e.target === veil && closable !== false) close(); var b = e.target.closest('[data-k="close"]'); if (b) close(); });
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
    function toast(t) { css(); var d = document.createElement('div'); d.className = 'mvs-toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4200); }
    function msg(el, t) { var m = el.querySelector('.mvs-msg'); if (m) m.textContent = t || ''; }
    function noticeHtml() { return NOTICE.map(function (n) { return '<details><summary>' + esc(n[0]) + '</summary><p>' + esc(n[1]) + '</p></details>'; }).join(''); }
    var GOOGLE = '<svg class="mvs-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

    function redirectTo(gate) {
      if (gate || /^#(mahalaverse|enter|play)/i.test(location.hash) || document.documentElement.classList.contains('to-mv') || document.body.classList.contains('from-seed')) ss.set(AFTER, '#mahalaverse');
      else if (location.hash && location.hash.length < 40) ss.set(AFTER, location.hash);
      return location.origin + location.pathname + '?signin=1';
    }

    // Sign in, or make an account: the same two buttons, since a first sign-in makes the account. As the gate to
    // the Mahalaverse (gate: true) it cannot be closed, only left for the front page.
    function signIn(gate) {
      var letter = ss.get('mahala.fromLetter') === '1';
      var title = letter ? 'Your thread is waiting' : gate ? 'Step into the Mahalaverse' : 'Your Mahala account';
      var lead = letter ? 'You came by your letter. Sign in, and the thread Mahala holds for you is yours: the years, the people, the choices you make.'
        : gate ? 'The Mahalaverse is home to Mahala\'s online community of temple builders. Make your account, or sign in, to step onto the playa. Your path, your book and your card stay with you on every device.'
        : 'Make your account, or sign in. It takes a moment, and your path, your book and your card stay with you on every device.';
      var el = sheet('<h2>' + title + '</h2><p class="lead">' + lead + '</p>' +
        '<button type="button" class="mvs-b" data-k="google">' + GOOGLE + 'Continue with Google</button>' +
        '<div class="mvs-or">or</div>' +
        '<form data-k="email"><label class="mvs-row"><span>Your email address</span><input type="email" name="email" autocomplete="email" required></label>' +
        '<button type="submit" class="mvs-b q">Email me a link to come in</button></form>' +
        '<div class="mvs-msg" role="status"></div>' +
        '<p><small>New here? Either way makes your account. Google shares only your name, address and photo with Mahala, never your Gmail. <a href="#" data-k="notice">How Mahala looks after your thread</a>.</small></p>' +
        (gate ? '<a class="mvs-b q" href="./" data-k="back">Back to The Seed</a>' : ''), gate ? 'Make your account' : 'Sign in', !gate);
      el.querySelector('[data-k="google"]').addEventListener('click', function () {
        msg(el, 'Opening Google...');
        clientP.then(function (c) { return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo(gate) } }); })
          .then(function (r) { if (r && r.error) msg(el, 'Google sign-in is not open yet. Try the email link.'); }, function () { msg(el, 'Signing in is not available right now.'); });
      });
      el.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var addr = String(e.target.email.value || '').trim(), b = e.target.querySelector('button');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(addr)) { msg(el, 'That address does not look right.'); return; }
        b.disabled = true; msg(el, 'Sending...');
        clientP.then(function (c) { return c.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(gate), shouldCreateUser: true } }); }).then(function (r) {
          b.disabled = false;
          if (r && r.error) { msg(el, /rate|seconds/i.test(r.error.message) ? 'A link was sent a moment ago. Give it a minute, then try again.' : 'The link could not be sent. Try again in a little while.'); return; }
          msg(el, ''); el.querySelector('form').outerHTML = '<p class="lead">A link is on its way to <b>' + esc(addr) + '</b>. Open it on this device, and you arrive in the Mahalaverse signed in.</p>';
        }, function () { b.disabled = false; msg(el, 'Signing in is not available right now.'); });
      });
      el.querySelector('[data-k="notice"]').addEventListener('click', function (e) { e.preventDefault(); showNotice(); });
    }

    function showNotice() {
      sheet('<h2>How Mahala looks after your thread</h2><p><small>Draft ' + esc(NOTICE_VERSION) + ', for the stewards to approve.</small></p>' + noticeHtml() +
        '<button type="button" class="mvs-b q" data-k="close">Close</button>', 'Privacy notice');
    }

    // The first time someone signs in. Someone new makes their account here (the name they go by, and their
    // choices); someone Mahala knows is welcomed back. Either way: the notice, and every choice unticked.
    function welcome(w) {
      var fresh = !!w.isNew;
      var el = sheet('<h2>' + (fresh ? 'Welcome to Mahala' : 'Welcome back, ' + esc(w.name || 'temple builder')) + '</h2>' +
        '<p class="lead">' + (fresh ? 'You are part of Mahala\'s online community now. Tell us what to call you, choose how we stay in touch, and step onto the playa.'
          : 'Your thread is here. Before you go on, here is how Mahala looks after it, and the choices that are yours.') + '</p>' +
        (fresh ? '<label class="mvs-row"><span>What should we call you?</span><input type="text" name="nm" maxlength="80" autocomplete="name" required value="' + esc(w.name || '') + '"></label>' +
                 '<label class="mvs-row"><span>Your playa name, if you have one</span><input type="text" name="playa" maxlength="60" autocomplete="off"></label>' : '') +
        '<h3>Stay in touch</h3>' + SCOPES.map(function (s) { return '<label class="mvs-ck"><input type="checkbox" name="' + s[0] + '"><span>' + esc(s[1]) + '</span></label>'; }).join('') +
        '<p><small>Nothing is ticked for you, and you can change any of it later in Account and privacy.</small></p>' +
        '<h3>How Mahala looks after your thread</h3>' + noticeHtml() +
        '<button type="button" class="mvs-b" data-k="save">' + (fresh ? 'Make my account' : 'I have read this. Continue') + '</button><div class="mvs-msg" role="status"></div>', 'Welcome', false);
      el.querySelector('[data-k="save"]').addEventListener('click', function (e) {
        var b = e.currentTarget, nm = el.querySelector('[name="nm"]'), playa = el.querySelector('[name="playa"]');
        if (nm && !nm.value.trim()) { msg(el, 'Tell us what to call you.'); nm.focus(); return; }
        b.disabled = true; msg(el, 'Saving...');
        var steps = (nm ? rpc('set_my_name', { p_name: nm.value.trim() }) : Promise.resolve())
          .then(function () { return playa && playa.value.trim() ? rpc('set_profile', { p_field: 'playa_name', p_text: playa.value.trim(), p_visibility: 'members' }) : null; })
          .then(function () { return rpc('accept_notice', { p_version: w.noticeVersion }); })
          .then(function () {
            return SCOPES.reduce(function (p, s) {
              return p.then(function () { return rpc('set_consent', { p_scope: s[0], p_granted: !!el.querySelector('[name="' + s[0] + '"]').checked, p_source: 'first-sign-in' }); });
            }, Promise.resolve());
          });
        steps.then(function () { close(); toast(fresh ? 'Welcome to the Mahalaverse.' : 'Your thread is yours. Welcome back.'); if (fresh && nm) { info.name = nm.value.trim().split(/\s+/)[0]; mountChips(true); var c = document.querySelector('#v7-platform-chip .v7-platform-nm'); if (c) c.textContent = info.name; } },
          function (er) { b.disabled = false; msg(el, (er && er.message) || 'That did not save. Try again.'); });
      });
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
          (t.isNew ? '<p class="lead">You are part of Mahala\'s online community. Camped with Mahala before, under another address? Tell the stewards at wearemahala@gmail.com and they will join your thread.</p>' : '') +
          (t.rung ? '<h3>Where you stand</h3><div class="mvs-rung"><b>' + esc(t.rung.name) + '</b><span>' + esc(t.rung.next) + '</span></div>' : '') +
          (lines ? '<h3>Your thread</h3><ul class="mvs-th">' + lines + '</ul><p><small>From Mahala\'s record. Something missing or wrong? Tell the stewards at wearemahala@gmail.com.</small></p>' : '') +
          '<h3>Your playa name</h3><div class="mvs-row"><div class="mvs-two"><input type="text" name="playa" maxlength="60" value="' + esc((p.playa_name && p.playa_name.text) || t.playaName || '') + '" placeholder="The name you go by at the burn"><button type="button" class="mvs-b q" data-k="playa" style="margin:0;width:auto">Save</button></div></div>' +
          '<h3>Your choices</h3>' + SCOPES.map(function (s) { return '<label class="mvs-ck"><input type="checkbox" data-scope="' + s[0] + '"' + (t.consent && t.consent[s[0]] ? ' checked' : '') + '><span>' + esc(s[1]) + '</span></label>'; }).join('') +
          '<h3>What you share</h3>' + FIELDS.map(function (f) {
            var cur = p[f[0]] || {};
            return '<div class="mvs-row"><label><span>' + esc(f[1]) + '</span><textarea data-field="' + f[0] + '" maxlength="2000" placeholder="' + esc(f[2]) + '">' + esc(cur.text || '') + '</textarea></label>' +
              '<div class="mvs-two"><select data-vis="' + f[0] + '" aria-label="Who sees it">' + VIS.map(function (v) { return '<option value="' + v[0] + '"' + ((cur.visibility || 'me') === v[0] ? ' selected' : '') + '>Seen by: ' + v[1] + '</option>'; }).join('') + '</select>' +
              '<button type="button" class="mvs-b q" data-save="' + f[0] + '" style="margin:0;width:auto">Save</button></div></div>';
          }).join('') +
          '<h3>Your data</h3><p>Everything this site holds about you is yours to see, take and remove.</p>' +
          '<button type="button" class="mvs-b q" data-k="export">Download my data</button>' +
          '<button type="button" class="mvs-b q" data-k="signout">Sign out</button>' +
          '<button type="button" class="mvs-b q" data-k="delete">Delete my account</button>' +
          (info.isSteward ? '<h3>For stewards: new members</h3><p data-k="pending">Checking...</p>' : '') +
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
          if (k === 'delete') del();
          if (k === 'notice') { e.preventDefault(); showNotice(); }
        });
        if (info.isSteward) stewardList(el);
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
            '<b>' + esc(x.name || 'No name yet') + '</b><small>' + (addrs || 'No address') + ', joined ' + esc(String(x.since || '').slice(0, 10)) + (x.access && x.access !== 'auto' ? ', ' + esc(x.access) : '') + '</small>' +
            '<div class="mvs-two"><input type="text" data-pid placeholder="Same person as: p-firstname-surname" aria-label="Mahala OS id this member already has">' +
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
        clientP.then(function (c) {
          var dir = info.uid;
          return (dir ? c.storage.from(BUCKET).list(dir, { limit: 1000 }).then(function (r) {
            var names = (r.data || []).map(function (f) { return dir + '/' + f.name; });
            return names.length ? c.storage.from(BUCKET).remove(names) : null;
          }) : Promise.resolve()).catch(function () { });
        }).then(function () { msg(el, 'Deleting your account...'); return rpc('delete_my_account'); })
          .then(function () { ls.set(EDITION, null); return clientP.then(function (c) { return c.auth.signOut().catch(function () { }); }); })
          .then(function () { el.innerHTML = '<h2>Your account is deleted</h2><p class="lead">Thank you for walking with Mahala. The door stays open.</p>'; setTimeout(function () { location.reload(); }, 2500); },
            function () { go.disabled = false; msg(el, 'That did not work. Try again, or write to the stewards at wearemahala@gmail.com.'); });
      });
    }

    return {
      toast: toast,
      open: function (mode) { if (mode === 'gate') signIn(true); else if (mode === 'account') account(); else if (mode === 'delete') del(); else if (mode === 'notice') showNotice(); else if (info && info.signedIn) account(); else signIn(); },
      welcome: welcome,
    };
  })();

  function afterSignIn(w) {
    var ready = function (f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); };
    ready(function () {
      watchBlobs();
      mountChips();
      if (w.signedIn && w.claimed && !w.noticeSeen) UI.welcome(w);
      else if (!w.signedIn && ss.get('mahala.fromLetter') === '1' && !ss.get('mahala.letterShown')) { ss.set('mahala.letterShown', '1'); UI.open('signin'); }
    });
  }

  // Pages without the game (camp.html, seed.html) put <button data-mahala-account> where a sign-in belongs.
  function mountChips(refresh) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-mahala-account]'), function (b) {
      if (b.dataset.mvOn) { if (refresh) b.textContent = info && info.signedIn ? (info.name || 'Your account') : 'Sign in'; return; }
      b.dataset.mvOn = '1';
      b.classList.add('mvm-chip'); b.hidden = false;
      b.textContent = info && info.signedIn ? (info.name || 'Your account') : 'Sign in';
      b.addEventListener('click', function () { UI.open(info && info.signedIn ? 'account' : 'signin'); });
    });
    if (document.querySelector('[data-mahala-account]') && !document.getElementById('mvs-css')) { var s = document.createElement('style'); s.id = 'mvs-css'; s.textContent = CSS; document.head.appendChild(s); }
  }
})();
