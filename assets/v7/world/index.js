/* The world plugin: the map of the temples to come, and the seeds visitors plant on it.
   start(M, ctx) returns at once: it registers the section "Seeds you planted" in Your path, the "Seed carrier" gift and its
   share of the gift state, and tells the game how to open the map (M.v7.W7.open). The map itself (map.js, land.js)
   loads only when someone opens it.
   Data: places/<uid> = { s: [{ i, t, p }] }, one document per person, at most three seeds, each p a place key from the
   built-in list (places.js). The map shows only counts, not who planted a seed (each person's list can still be read
   by id: see the README's open questions). With no shared store at all (a saved copy, or a claude.ai link with no data
   access) seeds are kept in this browser only, and the map says so. */
import { PLACES, PLACE_BY } from './places.js';
import { MAX_SEEDS, cleanDoc, countPlaces, plant as plantIn, unplant as unplantIn, countLine, WHO_LINE, localLine, whyNot } from './seeds.js';
import { CSS } from './style.js';

const COL = 'places', LOCAL_KEY = 'mahala.seeds';

/* seeds kept in this browser, for when there is no shared store */
export const localSeeds = {
  read() { try { return cleanDoc(JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'), PLACE_BY); } catch (e) { return { s: [] }; } },
  write(doc) { try { if (doc.s.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(doc)); else localStorage.removeItem(LOCAL_KEY); return true; } catch (e) { return false; } },
};

/* ---------- data: through ctx.platform when it is there, else straight through window.claude.use ---------- */
export function makeApi(M, ctx) {
  const P = ctx && ctx.platform;
  const use = name => Promise.resolve(P && typeof P.use === 'function' ? P.use(name) : (window.claude && typeof window.claude.use === 'function' ? window.claude.use(name) : null)).catch(() => null);
  let meP = null, refused = false, dbP = null;
  const emit = (n, d) => { if (ctx && ctx.bus) ctx.bus.emit(n, d); };
  const api = {
    mode: P ? P.mode : (window.claude ? 'claude' : 'solo'),
    async me() {
      if (P && typeof P.me === 'function') { try { const m = await P.me(); return Object.assign({}, m, { canWrite: !!(m && m.canWrite && m.id) && !refused }); } catch (e) { } }
      if (!meP) meP = (async () => {
        const user = await use('user'); let id = null, can = null;
        if (user) { try { id = await user.id(); } catch (e) { } try { can = await user.can('data.write'); } catch (e) { } }
        return { id, name: '', signedIn: !!id, canWrite: !!id && can !== false, isSteward: false, isOwner: false, guest: !id };
      })();
      const m = await meP; return Object.assign({}, m, { canWrite: m.canWrite && !refused });
    },
    signIn: P && typeof P.signIn === 'function' ? () => P.signIn() : null,
    db() { return dbP || (dbP = use('db')); },
    // no shared store at all: seeds are kept in this browser only
    async local() { return !(await api.db()); },
    // my seeds, cleaned
    async mine() {
      const db = await api.db(); if (!db) return localSeeds.read();
      const me = await api.me(); if (!me.id) return { s: [] };
      try { const d = await db.doc(COL + '/' + me.id).get(); return cleanDoc(d.exists ? d.data() : null, PLACE_BY); } catch (e) { return { s: [] }; }
    },
    // everyone's seeds, live: fn(counts Map, docs) on every change; returns an unsubscribe
    watch(fn) {
      let stop = null, dead = false;
      (async () => {
        const db = await api.db(); if (dead) return;
        if (!db) { const d = localSeeds.read(); fn(countPlaces([d], PLACE_BY), [d]); return; }
        try {
          stop = db.collection(COL).limit(1000).onSnapshot(snap => {
            const docs = snap.docs.map(d => Object.assign({ _id: d.id }, d.data() || {}));
            fn(countPlaces(docs, PLACE_BY), docs);
          }, e => { console.warn('places', e && e.code); fn(new Map(), []); });
        } catch (e) { fn(new Map(), []); }
      })();
      return () => { dead = true; if (stop) try { stop(); } catch (e) { } };
    },
    async plant(place) {
      const db = await api.db();
      if (!db) {                                                // kept in this browser
        const r = plantIn(localSeeds.read(), place, PLACE_BY); if (r.error) return r;
        if (!localSeeds.write(r.doc)) return { error: 'nolocal' };
        emit('seed:planted', { uid: null, place, seeds: r.doc.s.length, local: true });
        return { doc: r.doc, seeds: r.doc.s.length, local: true };
      }
      const me = await api.me();
      if (!me.id) return { error: 'signin' };
      if (!me.canWrite) return { error: 'readonly' };
      const cur = await api.mine(), r = plantIn(cur, place, PLACE_BY);
      if (r.error) return r;
      try { await db.doc(COL + '/' + me.id).set(r.doc); }
      catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'not_granted')) { refused = true; return { error: 'readonly' }; } if (e && e.code === 'quota_exceeded') return { error: 'full-store' }; return { error: 'failed' }; }
      const n = r.doc.s.length;
      emit('seed:planted', { uid: me.id, place, seeds: n });
      return { doc: r.doc, seeds: n };
    },
    async unplant(i) {
      const db = await api.db();
      if (!db) { const doc = unplantIn(localSeeds.read(), i, PLACE_BY); if (!localSeeds.write(doc)) return { error: 'nolocal' }; emit('seed:removed', { uid: null, seeds: doc.s.length, local: true }); return { doc, local: true }; }
      const me = await api.me(); if (!me.id || !me.canWrite) return { error: 'readonly' };
      const doc = unplantIn(await api.mine(), i, PLACE_BY);
      try { if (doc.s.length) await db.doc(COL + '/' + me.id).set(doc); else await db.doc(COL + '/' + me.id).delete(); } catch (e) { return { error: 'failed' }; }
      emit('seed:removed', { uid: me.id, seeds: doc.s.length });
      return { doc };
    },
    // everything this person planted, gone (from "Delete my data" in Your path)
    async erase() {
      const db = await api.db(); if (!db) { localSeeds.write({ s: [] }); emit('seed:removed', { uid: null, seeds: 0, local: true }); return; }
      const me = await api.me(); if (!me.id) return; await db.doc(COL + '/' + me.id).delete(); emit('seed:removed', { uid: me.id, seeds: 0 });
    },
  };
  return api;
}

/* ---------- the map, loaded when it is first opened ---------- */
let mapMod = null;
async function openMap(M, api, from) {
  try { mapMod = mapMod || await import('./map.js'); }
  catch (e) { console.warn('The world map did not load:', e); M.toast && M.toast('The map of the temples to come did not open. Try again in a moment.'); return; }
  return mapMod.open(M, api, from);
}
// without the plugin layer (a saved copy, or the plugins did not start): the map still opens
export function openAlone(M, from) { addStyle(); return openMap(M, makeApi(M, null), from); }

function addStyle() { if (document.getElementById('v7-world-css')) return; const st = document.createElement('style'); st.id = 'v7-world-css'; st.textContent = CSS; document.head.appendChild(st); }

export async function start(M, ctx) {
  addStyle();
  const api = makeApi(M, ctx);
  const W7 = M.v7 && M.v7.W7; if (W7) W7.open = from => openMap(M, api, from);
  ctx.world = { api, open: from => openMap(M, api, from) };

  // Your path (ctx.dashboard): the seeds you planted
  ctx.dashboard.push({ id: 'world-seeds', title: 'Seeds you planted', order: 60, render: (el, me) => renderSeedsSection(M, api, el, ctx),
    // your data: what you planted, to download, and to delete with everything else
    export: async () => ({ seeds: (await api.mine()).s.map(x => ({ near: PLACE_BY[x.p].name, where: PLACE_BY[x.p].where, planted: x.t > 0 && x.t < 8.64e15 ? new Date(x.t).toISOString() : '' })) }),
    erase: () => api.erase() });
  // the gift: a seed carrier is anyone who planted a seed for a temple to come
  ctx.gifts.push({ id: 'seed-carrier', title: 'Seed carrier', kind: 'badge', icon: 'seed', why: 'For planting a seed on the map of the temples to come.', test: s => (+s.seeds || 0) > 0 });
  (ctx.giftState = ctx.giftState || []).push(async () => ({ seeds: (await api.mine()).s.length }));
  return { api };
}

/* "Seeds you planted", in Your path. Built with DOM calls: no stored text is ever parsed as HTML */
function renderSeedsSection(M, api, el, ctx) {
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  el.replaceChildren(h('p', 'v7-world-dash-note', 'Looking for your seeds...'));
  Promise.all([api.me(), api.mine(), api.local()]).then(([me, doc, local]) => {
    el.replaceChildren();
    const s = doc.s, why = whyNot({ mode: api.mode, local, id: me.id, canWrite: me.canWrite });
    // a button only offers to plant to someone who can; anyone else is shown the map
    const b = h('button', 'btn', s.length || why ? 'See the map' : 'Plant a seed'); b.type = 'button';
    b.addEventListener('click', () => { if (ctx && ctx.world) ctx.world.open('dashboard'); });
    if (s.length) {
      el.appendChild(h('p', null, `You planted ${s.length} of ${MAX_SEEDS} seeds for the temples to come.`));
      const ul = h('ul', 'v7-world-dash-list');
      for (const x of s) { const p = PLACE_BY[x.p]; const li = h('li'); li.appendChild(h('b', null, p.name)); li.appendChild(h('small', null, ' ' + p.where)); ul.appendChild(li); }
      el.append(ul, b);
    } else {                                                    // nothing planted yet: the house's empty state
      const e = h('div', 'mv-empty v7-world-dash-empty');
      e.append(h('p', null, why ? 'No seeds planted yet. The map shows where people would love a temple space.' : 'Where would you love a temple space? Plant up to three seeds on the map of the temples to come.'), b);
      el.appendChild(e);
    }
    if (local) el.appendChild(h('p', 'v7-world-dash-note', localLine(api.mode)));
    else {
      el.appendChild(h('p', 'v7-world-dash-note', WHO_LINE));
      if (why) el.appendChild(h('p', 'v7-world-dash-note', why));
    }
  }).catch(() => { el.replaceChildren(h('p', 'v7-world-dash-note', 'Your seeds could not be reached just now. Try again in a moment.')); });
}

export { PLACES, countLine };
