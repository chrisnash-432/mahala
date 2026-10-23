/* The Mahalaverse, together.
   For the people building the temple: everyone signed in and invited appears in the world as a figure where they are,
   each place keeps its own conversation, notes can be left where they matter, and the quests and the camp board show
   who is on what. It runs on three claude.ai artifact capabilities: room (who is here right now), db (what lasts) and
   user (who is who). A public or signed-out visitor never connects, and keeps the single-player world as it was.

   What is stored: one document per person in each collection, written only by that person (editors can tidy up).
     chat/<id>    { m: { <channel>: [{ i, t, x }] } }       the last 40 messages per channel
     notes/<id>   { n: [{ i, t, x, y, z, pl, tx }] }        notes left in the world, 24 at most
     board/<id>   { p: [{ i, t, k, c, tx }] }               offers and needs on the camp board, 30 at most
     claims/<id>  { c: ["<owner id>~<post id>"] }           the posts this person is in on
     seen/<id>    { pl, t }                                 where they were last, and when
     live/call    { pl, tx, t, by }                         an editor's call to gather somewhere (editors only)
   Who is on each quest comes from the page's own builders collection, so a quest is taken in one place only; a builder
   is named there only if they chose to show their name on the temple.                                                  */

const CHANNELS = [['all', 'Everyone'], ['temple', 'The temple'], ['fire', 'The fireside'], ['mahal', 'The Lotus Mahal'], ['yard', 'The build yard'], ['gates', 'The gates']];
const CH_NAME = Object.fromEntries(CHANNELS);
const CH_TO = { all: 'to everyone', temple: 'in the temple', fire: 'at the fireside', mahal: 'in the Lotus Mahal', yard: 'at the build yard', gates: 'at the gates' };
const WHERE = { temple: 'in the temple', fire: 'at the fireside', mahal: 'in the Lotus Mahal', yard: 'at the build yard', gates: 'at the gates', camp: 'at the camp', playa: 'on the playa', story: 'in the story' };
const chanOf = pl => (CH_NAME[pl] ? pl : 'all');
const CATS = [['lift', 'Lifts'], ['gear', 'Gear'], ['food', 'Food'], ['hands', 'Hands'], ['other', 'Other']];
const CAT_NAME = Object.fromEntries(CATS);
const HINT = {
  offer: { lift: 'Driving up from Cape Town on 24 April, 3 seats', gear: 'Bringing a generator and shade cloth', food: 'Can cook for 20 on the Tuesday of build week', hands: 'Free all of build week, good with a jigsaw', other: 'What you can bring' },
  ask: { lift: 'Looking for a lift from Johannesburg for 2', gear: 'Need a long ladder for the crown', food: 'Need someone to run breakfast on strike day', hands: 'Two people to sand panels on Saturday', other: 'What you need' },
};
const CAP = { msgs: 40, notes: 24, posts: 30, claims: 120 };
const PALETTE = ['#D8197F', '#14A8E0', '#C99A00', '#2E8558', '#7E57C2', '#E06A2C', '#2F6F73', '#B0413E'];
const SEATS = [1.3, -1.3, 0.8, -0.8, 1.8, -1.8, 0.35, -0.35, 2.25];   // round the fire: the sides first, where you can see them from your seat
const GO = { temple: 'CENTRE', mahal: 'MAHAL_COIL', yard: 'YARD', gates: 'GATE_1', camp: 'CAMP', all: 'CAMP', playa: 'CAMP' };
const CALL_HOURS = 4;

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o || {}));
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const splitKey = k => { const j = String(k).lastIndexOf('~'); return [String(k).slice(0, j), String(k).slice(j + 1)]; };
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
const okT = t => (typeof t === 'number' && t > 0 && t < Date.now() + 600000 ? t : null);   // a time someone stored: real, and not from the future
const cctx = (() => { const c = document.createElement('canvas'); c.width = c.height = 1; return c.getContext('2d', { willReadFrequently: true }); })();
const RGB = {};
function rgbOf(c) {                     // any CSS colour to #rrggbb, by painting one pixel
  if (RGB[c]) return RGB[c];
  cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = '#888888'; try { cctx.fillStyle = c; } catch (e) { }
  cctx.fillRect(0, 0, 1, 1); const d = cctx.getImageData(0, 0, 1, 1).data;
  return (RGB[c] = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
}
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 50) return 'just now';
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  const d = new Date(t);
  if (s < 172800) return 'yesterday';
  if (s < 6 * 86400) return d.toLocaleDateString('en-ZA', { weekday: 'long' });
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export async function start(M) {
  const C = window.claude;
  if (!C || typeof C.use !== 'function') return null;
  let room = null, db = null, user = null;
  try { [room, db, user] = await Promise.all([C.use('room'), C.use('db'), C.use('user')]); } catch (e) { return null; }
  if (!room) return null;                                         // single player: a public link, signed out, or a copy of the page
  const api = await together(M, room, db, user);
  window.__together = api;
  return api;
}

async function together(M, room, db, user) {
  const { THREE, camera, controls, esc, icon } = M;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const P = M.P, labels = M.labels, canvas = M.canvas;
  const me = user ? await user.me() : { id: null, name: '', avatarUrl: '', color: '', canEdit: false };
  const myId = me.id || null, admin = !!me.canEdit;
  const canData = user ? await user.can('data.write') : null;     // true, false, or null when the platform said nothing
  let readOnly = !db || !myId || canData === false;
  const S = { entered: false, open: false, tab: 'talk', ch: 'all', chPinned: 0, filter: 'all', kind: 'offer', roomDead: false, greeted: false };
  try { const s = JSON.parse(M.store.get('mv.together') || '{}'); if (['talk', 'people', 'board'].includes(s.tab)) S.tab = s.tab; S.open = !!s.open && innerWidth > 760; } catch (e) { }   // on a phone the panel covers the world, so it starts closed
  const persist = () => M.store.set('mv.together', JSON.stringify({ tab: S.tab, open: S.open }));

  /* ---------- who is who: names and pictures as this viewer sees them, resolved on every render ---------- */
  const PROF = {};
  async function resolve(ids) {
    if (!user) return; const want = [...new Set(ids.filter(x => typeof x === 'string' && x))]; if (!want.length) return;
    try { Object.assign(PROF, await user.profiles(want)); } catch (e) { }
  }
  const nameOf = id => (id && PROF[id] && PROF[id].name) || (id && id === myId && me.name) || 'A builder';
  const firstName = id => { const n = (id && PROF[id] && PROF[id].name) || (id && id === myId && me.name); return n ? n.split(/\s+/)[0] : 'A builder'; };
  const picOf = id => (id && PROF[id] && PROF[id].avatarUrl) || (id && id === myId && me.avatarUrl) || '';
  const colorOf = (id, salt) => rgbOf((id && PROF[id] && PROF[id].color) || (id && id === myId && me.color) || PALETTE[hash(String(salt || id || 'x')) % PALETTE.length]);
  const avImg = (id, cls = 'tg-av') => { const src = picOf(id); return src ? `<img class="${cls}" src="${esc(src)}" alt="">` : `<span class="${cls} tg-av-none" style="--c:${colorOf(id)}"></span>`; };

  /* ---------- what lasts: one live subscription per collection ---------- */
  const DATA = { chat: {}, notes: {}, board: {}, claims: {}, seen: {} };
  const ready = { chat: false, notes: false, board: false, claims: false, seen: false };
  let CALL = null;
  const mine = col => (myId && DATA[col][myId]) || {};
  if (db) {
    for (const col of Object.keys(DATA)) {
      try {
        db.collection(col).onSnapshot(snap => {
          const o = {}; for (const d of snap.docs) { const v = d.data(); if (v && typeof v === 'object') o[d.id] = v; }
          DATA[col] = o; ready[col] = true; changed(col);
        }, () => { ready[col] = false; changed(col); });
      } catch (e) { }
    }
    try { db.doc('live/call').onSnapshot(s => { CALL = s.exists ? s.data() : null; schedule('call', 'people'); }, () => { }); } catch (e) { }
  }
  const wq = {};
  function save(col, body, id = myId) {                          // one write at a time per document; resolves true or false
    if (!db || !id) { writeFailed({ code: 'invalid_argument' }); return Promise.resolve(false); }
    const path = col + '/' + id;
    const p = (wq[path] || Promise.resolve(true)).then(() => db.doc(path).set(body)).then(() => true, e => { writeFailed(e); return false; });
    return (wq[path] = p);
  }
  function writeFailed(e) {
    const c = e && e.code;
    if (c === 'invalid_argument' || c === 'not_granted' || c === 'revoked') { if (!readOnly) { readOnly = true; schedule('all'); } M.toast('Posting is not open to you yet. To take part, write to the camp at wearemahala@gmail.com.'); }
    else if (c === 'quota_exceeded') M.toast('There is no room for more posts just now. Write to the stewards at wearemahala@gmail.com.');
    else if (c === 'resource_exhausted') M.toast('That was a lot at once. Wait a moment and try again.');
    else M.toast('That did not save. Try again in a moment.');
  }

  /* ---------- the panel ---------- */
  const PLACES = ['temple', 'fire', 'mahal', 'yard', 'gates', 'camp'];
  const placeName = { temple: 'The temple', fire: 'The fireside', mahal: 'The Lotus Mahal', yard: 'The build yard', gates: 'The gates', camp: 'The camp' };
  const root = document.createElement('section'); root.id = 'tg'; root.setAttribute('aria-label', 'Together: the builders in the Mahalaverse');
  root.innerHTML = `
    <button class="tg-pill card" id="tgPill" type="button" aria-expanded="false" aria-controls="tgPanel">
      <span class="tg-stack" id="tgStack"></span><span class="tg-pt"><b id="tgCount">Together</b><small id="tgSub">Talk, people and the camp board</small></span><span class="tg-badge" id="tgBadge" hidden></span>
    </button>
    <div class="tg-panel card" id="tgPanel" hidden>
      <header class="tg-head"><div class="tg-where"><span class="eyebrow">You are</span><b id="tgWhere">on the playa</b></div>
        <span class="tg-conn" id="tgConn" hidden>Reconnecting</span><button class="iconbtn x" id="tgClose" type="button" aria-label="Close Together">${icon('x')}</button></header>
      <div class="tg-tabs" role="tablist" aria-label="Together">
        <button role="tab" type="button" id="tgTab-talk" data-tab="talk" aria-controls="tgTalk">Talk<i class="n" id="tgN-talk"></i></button>
        <button role="tab" type="button" id="tgTab-people" data-tab="people" aria-controls="tgPeople">People<i class="n" id="tgN-people"></i></button>
        <button role="tab" type="button" id="tgTab-board" data-tab="board" aria-controls="tgBoard">Camp board<i class="n" id="tgN-board"></i></button>
      </div>
      <div class="tg-pane" id="tgTalk" role="tabpanel" aria-labelledby="tgTab-talk">
        <div class="tg-chan"><label for="tgChan">Talking</label><select id="tgChan"></select></div>
        <div class="tg-msgs" id="tgMsgs" aria-live="polite"></div>
        <details class="tg-notes" id="tgNotes" hidden><summary id="tgNotesSum"></summary><div id="tgNotesList"></div></details>
        <form class="tg-compose" id="tgCompose">
          <textarea id="tgText" rows="1" maxlength="500" placeholder="Say something to everyone" aria-label="Your message"></textarea>
          <div class="tg-crow"><button type="button" class="btn" id="tgPin">${icon('pin')}Leave as a note here</button><button type="submit" class="btn primary" id="tgSend">Send</button></div>
          <p class="tg-who">Everyone signed in to the Mahalaverse reads this, with your name only if you show it.</p>
        </form>
        <p class="note tg-ro" id="tgRoTalk" hidden>Talk is for the builders taking part. To take part, write to the camp at wearemahala@gmail.com.</p>
      </div>
      <div class="tg-pane" id="tgPeople" role="tabpanel" aria-labelledby="tgTab-people" hidden>
        <div id="tgPeopleList"></div>
        <div class="tg-sect tg-gather" id="tgGather" hidden>
          <h4>Call everyone together</h4>
          <div id="tgGatherOn" hidden><p class="tg-gp" id="tgGatherText"></p><button class="btn" type="button" id="tgCallEnd">End the call</button></div>
          <div id="tgGatherOff" class="tg-gf"><select id="tgCallPl" aria-label="Where to gather">${PLACES.map(p => `<option value="${p}">${placeName[p]}</option>`).join('')}</select>
            <input id="tgCallTx" maxlength="90" placeholder="What for, and when (optional)" aria-label="What the gathering is for">
            <button class="btn primary" type="button" id="tgCallGo">Call everyone</button></div>
        </div>
        <p class="note">${matchMedia('(pointer: coarse)').matches ? 'Double-tap the ground to walk there. Tap a person to wave or go to them.' : 'Walk with the arrow keys or W, A, S and D, or double-click the ground. Click a person to wave or go to them.'}</p>
      </div>
      <div class="tg-pane" id="tgBoard" role="tabpanel" aria-labelledby="tgTab-board" hidden>
        <p class="tg-intro">Offer what you can bring and ask for what you need: lifts to the Tankwa, gear, food, a hand with the build.</p>
        <button class="btn tg-new" id="tgNew" type="button">${icon('plus')}Post an offer or a need</button>
        <form class="tg-post" id="tgPost" hidden>
          <div class="tg-seg" role="group" aria-label="Kind of post"><button type="button" data-kind="offer" aria-pressed="true">I can offer</button><button type="button" data-kind="ask" aria-pressed="false">I need</button></div>
          <select id="tgCat" aria-label="What it is about">${CATS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
          <textarea id="tgPostText" rows="2" maxlength="280" aria-label="Your post"></textarea>
          <div class="tg-crow"><button type="button" class="btn" id="tgPostCancel">Cancel</button><button type="submit" class="btn primary">Post</button></div>
          <p class="tg-who">Everyone signed in to the Mahalaverse reads this, with your name only if you show it. Leave out phone numbers and home addresses.</p>
        </form>
        <p class="note tg-ro" id="tgRoBoard" hidden>The camp board is for the builders taking part. To take part, write to the camp at wearemahala@gmail.com.</p>
        <div class="tg-chips" id="tgFilter" role="group" aria-label="Show">${[['all', 'All']].concat(CATS).map(([k, n]) => `<button type="button" data-f="${k}" aria-pressed="${k === 'all'}">${n}</button>`).join('')}</div>
        <div class="tg-posts" id="tgPosts"></div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const call = document.createElement('div'); call.className = 'tg-call card'; call.id = 'tgCall'; call.hidden = true; call.setAttribute('role', 'status');
  call.innerHTML = `<span class="tg-ci">${icon('bell')}</span><span class="tg-ct"><b id="tgCallT"></b><small id="tgCallN"></small></span><button class="btn primary" type="button" id="tgCallThere">Go there</button><button class="iconbtn x" type="button" id="tgCallX" aria-label="Dismiss the call">${icon('x')}</button>`;
  document.body.appendChild(call);
  const pop = document.createElement('div'); pop.className = 'tg-pop card'; pop.id = 'tgPop'; pop.hidden = true; document.body.appendChild(pop);
  const notice = document.createElement('div'); notice.className = 'tg-notice card'; notice.id = 'tgNotice'; notice.hidden = true; notice.setAttribute('role', 'status'); document.body.appendChild(notice);
  const $ = id => document.getElementById(id);
  const text = $('tgText');

  /* ---------- the figures ---------- */
  const GEO = {
    leg: new THREE.CapsuleGeometry(0.075, 0.55, 4, 10), arm: new THREE.CapsuleGeometry(0.055, 0.44, 4, 8), body: new THREE.CapsuleGeometry(0.2, 0.5, 4, 14), head: new THREE.SphereGeometry(0.13, 16, 12),
    thigh: new THREE.CapsuleGeometry(0.08, 0.32, 4, 10).rotateX(Math.PI / 2), shin: new THREE.CapsuleGeometry(0.07, 0.26, 4, 10),
    ring: new THREE.RingGeometry(0.3, 0.4, 40).rotateX(-Math.PI / 2), nose: new THREE.CircleGeometry(0.09, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
    post: new THREE.CylinderGeometry(0.018, 0.022, 1.06, 8), card: new THREE.BoxGeometry(0.34, 0.22, 0.014), pin: new THREE.SphereGeometry(0.035, 12, 8),
    base: new THREE.RingGeometry(0.1, 0.17, 24).rotateX(-Math.PI / 2),
  };
  const world = new THREE.Group(); world.name = 'TOGETHER'; M.scene.add(world);
  function makeFigure(color, pick) {
    const c = new THREE.Color(color), light = c.clone().lerp(new THREE.Color(0xffffff), 0.42), dark = c.clone().multiplyScalar(0.42);
    const mats = [new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0 }), new THREE.MeshStandardMaterial({ color: light, roughness: 0.6, emissive: light, emissiveIntensity: 0 })];
    const leg = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.7 });
    const g = new THREE.Group(), stand = new THREE.Group(), sit = new THREE.Group(), picks = [];
    const add = (to, geo, mat, x, y, z, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.z = sz; m.castShadow = true; if (pick) { m.userData.pick = pick; picks.push(m); } to.add(m); return m; };
    add(stand, GEO.leg, leg, -0.09, 0.35, 0); add(stand, GEO.leg, leg, 0.09, 0.35, 0); add(stand, GEO.body, mats[0], 0, 1.05, 0, 0.78); add(stand, GEO.head, mats[1], 0, 1.64, 0);
    add(stand, GEO.arm, mats[0], -0.27, 1.04, 0).rotation.z = -0.1; add(stand, GEO.arm, mats[0], 0.27, 1.04, 0).rotation.z = 0.1;
    add(sit, GEO.thigh, leg, -0.09, 0.08, 0.2); add(sit, GEO.thigh, leg, 0.09, 0.08, 0.2); add(sit, GEO.shin, leg, -0.09, -0.16, 0.38); add(sit, GEO.shin, leg, 0.09, -0.16, 0.38);
    add(sit, GEO.body, mats[0], 0, 0.5, 0, 0.78); add(sit, GEO.head, mats[1], 0, 1.09, 0);
    add(sit, GEO.arm, mats[0], -0.25, 0.5, 0.14).rotation.x = -0.75; add(sit, GEO.arm, mats[0], 0.25, 0.5, 0.14).rotation.x = -0.75;
    const ringMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false });
    const ring = new THREE.Group(); ring.add(new THREE.Mesh(GEO.ring, ringMat)); const nose = new THREE.Mesh(GEO.nose, ringMat); nose.position.z = 0.5; ring.add(nose); ring.position.y = 0.025; ring.renderOrder = 3;
    stand.add(ring); sit.visible = false; g.add(stand, sit); world.add(g);
    if (pick) M.PICKABLE.push(...picks);
    return { g, stand, sit, mats, leg, ringMat, picks, col: rgbOf(color), cur: V3(), tgt: V3(), a: 0, ta: 0, fresh: true, ph: Math.random() * 6, sayUntil: 0 };
  }
  function dropFigure(f) {
    world.remove(f.g); for (const m of f.picks) { const i = M.PICKABLE.indexOf(m); if (i >= 0) M.PICKABLE.splice(i, 1); }
    f.mats.forEach(m => m.dispose()); f.leg.dispose(); f.ringMat.dispose(); if (f.tag) f.tag.remove(); if (f.say) f.say.remove();
  }
  function paint(f, color) {                                     // a profile's own colour, once the platform has resolved it
    if (!f || f.col === color) return; f.col = color;
    const c = new THREE.Color(color), light = c.clone().lerp(new THREE.Color(0xffffff), 0.42);
    f.mats[0].color.copy(c); f.mats[0].emissive.copy(c); f.mats[1].color.copy(light); f.mats[1].emissive.copy(light); f.leg.color.copy(c.clone().multiplyScalar(0.42)); f.ringMat.color.copy(c);
    if (f.tag) f.tag.style.setProperty('--c', color);
  }
  function makeTag(f, color, isMe) {
    f.tag = document.createElement('div'); f.tag.className = 'wl tg-tag' + (isMe ? ' me' : ''); f.tag.style.setProperty('--c', color); f.tag.hidden = true;
    f.tag.innerHTML = '<i></i><span></span>'; labels.appendChild(f.tag);
    f.say = document.createElement('div'); f.say.className = 'tg-say'; f.say.hidden = true; labels.appendChild(f.say);
  }
  const say = (f, words) => { if (!f || !f.say) return; f.say.textContent = words.length > 110 ? words.slice(0, 107) + '...' : words; f.sayUntil = performance.now() + 7000; };

  /* ---------- outfits: what each builder's figure wears, from their avatars/<id> document ----------
     The me plugin (assets/v7/me) keeps M.outfits = { all: { <id>: avatar }, mine, me, subs: Set } up to date (every avatar
     cleaned against its own lists), and calls each function in subs when it changes. An avatar is { c, head, shoulders,
     held, emblem } (assets/v7/me/avatar.js names the pieces): c is the figure's colour, or null for the person's own; emblem
     is the key of the archetype card they kept, worn as a small brass medallion in the card's colour. Each piece is one or
     two meshes of merged primitives, built once and shared by every figure, placed for standing and for sitting at the fire. */
  const OUTFIT = M.outfits || (M.outfits = { all: {}, mine: null, me: null, subs: new Set() });
  if (!(OUTFIT.subs instanceof Set)) OUTFIT.subs = new Set();
  let KIT = null;
  function kit() {
    if (KIT) return KIT;
    const E = (x = 0, y = 0, z = 0) => new THREE.Euler(x, y, z);
    const M4 = (x, y, z, r = E(), sc = [1, 1, 1]) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(r), V3(...sc));
    const part = (geo, hex, m4) => {                                // a primitive, placed and coloured, ready to merge
      const g = geo.index ? geo.toNonIndexed() : geo; geo !== g && geo.dispose(); if (m4) g.applyMatrix4(m4);
      const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
    };
    const merge = parts => {
      const out = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'color']) {
        const arr = new Float32Array(parts.reduce((t, g) => t + g.attributes[k].array.length, 0)); let o = 0;
        for (const g of parts) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
        out.setAttribute(k, new THREE.BufferAttribute(arr, 3));
      }
      parts.forEach(g => g.dispose()); out.computeBoundingSphere(); return out;
    };
    const glowing = mat => { mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor;\n#endif'); }; return mat; };   // at night each piece glows in its own colour, like the figure
    const cloth = glowing(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0 }));
    const metal = glowing(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55, emissive: 0xffffff, emissiveIntensity: 0 }));
    const glass = new THREE.MeshStandardMaterial({ color: 0xFFD98A, emissive: 0xFFB347, emissiveIntensity: 0.5, roughness: 0.4 });
    const ring = (R, tube, hex, m4, rs = 8, ts = 28) => part(new THREE.TorusGeometry(R, tube, rs, ts), hex, m4);
    const cyl = (rt, rb, h, hex, m4, seg = 16, open = false, t0 = 0, tl = Math.PI * 2) => part(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl), hex, m4);
    const ball = (r, hex, m4) => part(new THREE.SphereGeometry(r, 10, 8), hex, m4);
    const flat = E(Math.PI / 2);
    const sash = hex => {                                           // a band from one shoulder to the other hip, round the body
      const t = 0.86, pts = [];
      for (let i = 0; i < 32; i++) { const th = i / 32 * Math.PI * 2, u = 0.33 * Math.cos(th); pts.push(V3(u * Math.cos(t), u * Math.sin(t) + 0.03, 0.168 * Math.sin(th))); }
      return merge([part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.026, 6, true), hex)]);
    };
    // each piece in its own frame: around the head, round the body, or at the hand; placed per pose (p position, r rotation)
    const HEAD = { stand: { p: [0, 1.64, 0] }, sit: { p: [0, 1.09, 0] } }, BODY = { stand: { p: [0, 1.05, 0] }, sit: { p: [0, 0.5, 0] } };
    const P_ = {
      'head:hat': { at: HEAD, parts: [[merge([cyl(0.25, 0.25, 0.014, '#CFA867', M4(0, 0.075, 0), 28), cyl(0.098, 0.122, 0.11, '#C49A55', M4(0, 0.135, 0), 18), cyl(0.125, 0.125, 0.026, '#6B3F2A', M4(0, 0.095, 0), 18, true)]), cloth]] },
      'head:scarf': { at: HEAD, parts: [[merge([ring(0.118, 0.042, '#C98B6B', M4(0, -0.15, 0, flat), 8, 22), part(new THREE.BoxGeometry(0.075, 0.26, 0.022), '#B47657', M4(0.075, -0.28, 0.155, E(0.12, 0, 0.18)))]), cloth]] },
      'head:crown': { at: HEAD, parts: [[merge([ring(0.112, 0.012, '#4E7A3A', M4(0, 0.08, 0, flat), 6, 30),
        ...[0, 1, 2, 3, 4, 5].map(i => ball(0.032, ['#D8197F', '#FFD81F', '#F2A3C7'][i % 3], M4(Math.sin(i / 6 * Math.PI * 2) * 0.112, 0.088, Math.cos(i / 6 * Math.PI * 2) * 0.112)))]), cloth]] },
      'head:circlet': { at: HEAD, parts: [[merge([ring(0.124, 0.011, '#B87333', M4(0, 0.045, 0, E(Math.PI / 2 + 0.15)), 6, 30), cyl(0.027, 0.027, 0.01, '#D99A5B', M4(0, 0.028, 0.124, E(Math.PI / 2 - 0.15)), 14)]), metal]] },
      'shoulders:sash-y': { at: BODY, parts: [[sash('#FFD81F'), cloth]] },
      'shoulders:sash-c': { at: BODY, parts: [[sash('#14A8E0'), cloth]] },
      'shoulders:sash-m': { at: BODY, parts: [[sash('#D8197F'), cloth]] },
      'shoulders:cloak': { at: BODY, parts: [[merge([cyl(0.215, 0.33, 0.95, '#3B3F8C', M4(0, -0.145, 0, E(), [1, 1, 0.86]), 18, true, Math.PI / 2, Math.PI), ball(0.022, '#CA973F', M4(0, 0.36, 0.14))]), cloth]] },
      'shoulders:shawl': { at: BODY, parts: [[merge([cyl(0.16, 0.345, 0.26, '#C77A2E', M4(0, 0.26, 0, E(), [1, 1, 0.8]), 20, true)]), cloth]] },
      'held:lantern': { at: { stand: { p: [0.3, 0.765, 0.02] }, sit: { p: [0.4, -0.14, 0.24] } }, parts: [
        [merge([ring(0.032, 0.006, '#3A3633', M4(0, -0.03, 0), 6, 16), cyl(0.0, 0.068, 0.04, '#3A3633', M4(0, -0.075, 0), 6), cyl(0.056, 0.056, 0.016, '#3A3633', M4(0, -0.213, 0), 12)]), metal],
        [merge([part(new THREE.BoxGeometry(0.084, 0.11, 0.084), '#FFD98A', M4(0, -0.15, 0))]), glass]] },
      'held:staff': { at: { stand: { p: [-0.3, 0.766, 0.02] }, sit: { p: [-0.36, 0.4, 0.12], r: [0, 0, 0.1] } }, parts: [[merge([cyl(0.017, 0.021, 1.78, '#8A5A3B', M4(0, 0.124, 0), 8), ball(0.036, '#6B4426', M4(0, 1.03, 0)), part(new THREE.BoxGeometry(0.012, 0.11, 0.04), '#D8197F', M4(0.022, 0.86, 0, E(0, 0, 0.3)))]), cloth]] },
      'held:drum': { at: { stand: { p: [0.31, 0.62, 0.1] }, sit: { p: [0, -0.02, 0.43], r: [-0.35, 0, 0] } }, parts: [[merge([cyl(0.105, 0.075, 0.17, '#9B5E34', M4(0, 0, 0), 16), cyl(0.104, 0.104, 0.012, '#E9DCC4', M4(0, 0.091, 0), 16), cyl(0.055, 0.068, 0.07, '#6B4426', M4(0, -0.12, 0), 12)]), cloth]] },
      'held:brush': { at: { stand: { p: [-0.3, 0.766, 0.03], r: [0.55, 0, 0.15] }, sit: { p: [-0.25, 0.3, 0.34], r: [1.0, 0, 0] } }, parts: [[merge([cyl(0.011, 0.011, 0.3, '#8A5A3B', M4(0, 0.06, 0), 6), cyl(0.014, 0.014, 0.04, '#B9B4AC', M4(0, 0.23, 0), 8), cyl(0.0, 0.017, 0.065, '#D8197F', M4(0, 0.283, 0), 8)]), cloth]] },
    };
    // the emblems: a brass rim and a disc in the card's own colour, on the chest beside the sash (one geometry per card)
    const EMB = { alchemist: '#E0862A', conductor: '#C99A00', entertainer: '#D8197F', guardian: '#3962A3', magician: '#7E57C2', muse: '#C94E8E',
      mother: '#B0413E', sage: '#4E8A4A', seeker: '#14A8E0', trickster: '#4A3F3A', wildone: '#2F8F8B' };
    const embGeo = {};
    const emblem = key => {
      if (!Object.prototype.hasOwnProperty.call(EMB, key)) return null;
      if (!embGeo[key]) embGeo[key] = merge([cyl(0.05, 0.05, 0.014, '#C9A35B', M4(0, 0, 0, flat), 18), cyl(0.038, 0.038, 0.004, EMB[key], M4(0, 0, 0.008, flat), 18)]);
      return embGeo[key];
    };
    return (KIT = { pieces: P_, emblem, cloth, metal, glass });
  }
  const EMB_AT = { stand: [-0.075, 1.25, 0.156], sit: [-0.075, 0.7, 0.156] };   // on the chest, the side the sash leaves free
  function dress(f, av) {                                        // put a figure's pieces on, for both poses; cheap when nothing changed
    const a = av && typeof av === 'object' ? av : null, held = a ? (a.held !== undefined ? a.held : a.hand) : null;
    const key = a ? [a.head, a.shoulders, held, a.emblem].join('|') : '';
    if (!f || f.dressed === key) return; f.dressed = key;
    for (const m of f.wear || []) if (m.parent) m.parent.remove(m);
    f.wear = []; if (!a) return;
    const K = kit(), put = (grp, geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.castShadow = true; grp.add(m); f.wear.push(m); };
    for (const [slot, v] of [['head', a.head], ['shoulders', a.shoulders], ['held', held]]) {
      const pc = typeof v === 'string' ? K.pieces[slot + ':' + v] : null; if (!pc) continue;
      for (const [pose, grp] of [['stand', f.stand], ['sit', f.sit]]) { const pl = pc.at[pose]; for (const [geo, mat] of pc.parts) put(grp, geo, mat, pl.p, pl.r); }
    }
    const eg = typeof a.emblem === 'string' ? K.emblem(a.emblem) : null;
    if (eg) for (const [pose, grp] of [['stand', f.stand], ['sit', f.sit]]) { const p = EMB_AT[pose].slice(); if (a.shoulders === 'shawl') p[2] += 0.085; put(grp, eg, K.metal, p); }   // a brooch over a shawl
  }
  const figColor = (id, salt, av = id ? OUTFIT.all[id] : null) => (av && typeof av.c === 'string' && av.c ? rgbOf(av.c) : colorOf(id, salt));   // the colour the builder chose, or their own
  function dressAll() {
    dress(MYF, OUTFIT.mine); paint(MYF, figColor(myId, 'me', OUTFIT.mine));
    for (const [label, f] of FIG) { const av = f.id ? OUTFIT.all[f.id] : null; dress(f, av); if (av || (f.id && PROF[f.id])) paint(f, figColor(f.id, label)); }
  }

  /* ---------- you ---------- */
  const ME = { x: 0, z: 0, a: 0, pl: 'playa', s: 0, in: 0, fp: false, vx: 0, vz: 0, sent: null, sentAt: 0, frozen: false, last: V3().copy(controls.target) };
  const myColor = figColor(myId, 'me', OUTFIT.mine);
  const MYF = makeFigure(myColor, null); makeTag(MYF, myColor, true); MYF.tag.querySelector('span').textContent = 'You'; dress(MYF, OUTFIT.mine);
  function placeAt(x, z) {
    const d = p => Math.hypot(x - p.x, z - p.z);
    if (Math.hypot(x, z) < 10) return 'temple';
    if (d(P.drift) < 7.5) return 'fire';
    if (d(P.camp) < 7) return 'mahal';
    if (d(P.yard) < 20) return 'yard';
    if ((P.gates || []).some(g => d(g) < 6)) return 'gates';
    if (d(P.heart || P.camp) < 30 || d(P.camp) < 16 || d(P.drift) < 14) return 'camp';
    return 'playa';
  }
  function pose(st, dt) {
    const cam = camera.position, tg = controls.target;
    if (dt > 0) { const kv = Math.min(1, dt * 8); ME.vx += ((tg.x - ME.last.x) / dt - ME.vx) * kv; ME.vz += ((tg.z - ME.last.z) / dt - ME.vz) * kv; } ME.last.copy(tg);
    if (st.story) { ME.frozen = true; return; }
    ME.frozen = false;
    if (st.fire) { ME.fp = true; ME.s = 1; ME.in = 0; ME.pl = 'fire'; ME.x = P.fire.x; ME.z = P.fire.z; ME.a = 0; }
    else if (st.inside) { ME.fp = true; ME.s = 0; ME.in = 1; ME.pl = st.insideAt === 'mahal' ? 'mahal' : 'temple'; ME.x = cam.x; ME.z = cam.z; ME.a = Math.atan2(tg.x - cam.x, tg.z - cam.z); }
    else {
      ME.fp = false; ME.s = 0; ME.in = 0; ME.x = tg.x; ME.z = tg.z;
      ME.a = Math.hypot(ME.vx, ME.vz) > 0.25 ? Math.atan2(ME.vx, ME.vz) : Math.atan2(tg.x - cam.x, tg.z - cam.z);
      ME.pl = placeAt(ME.x, ME.z);
    }
  }
  function sendPose(now) {
    if (ME.frozen || S.roomDead || !M.entered()) return;
    const o = ME.sent, r2 = v => Math.round(v * 100) / 100;
    const moved = !o || o.pl !== ME.pl || o.s !== ME.s || o.in !== ME.in || Math.hypot(o.x - ME.x, o.z - ME.z) > 0.12 || Math.abs(angDiff(o.a, ME.a)) > 0.1;
    if (!moved || now - ME.sentAt < 110) return;
    const p = { x: r2(ME.x), z: r2(ME.z), a: r2(ME.a), pl: ME.pl, s: ME.s, in: ME.in, id: myId };
    const placeMoved = !o || o.pl !== ME.pl; ME.sent = p; ME.sentAt = now;
    room.presence(p).catch(() => { });
    if (placeMoved) placeChanged();
  }
  let seenTimer = 0;
  function placeChanged() {
    $('tgWhere').textContent = WHERE[ME.pl] || 'here';
    if (!S.chPinned || Date.now() - S.chPinned > 90000) { const c = chanOf(ME.pl); if (c !== S.ch && !text.value.trim()) { S.ch = c; schedule('talk'); } }
    clearTimeout(seenTimer); seenTimer = setTimeout(writeSeen, 8000);
    schedule('talk');
  }
  function writeSeen() {                                          // after a real move from one place to another, never on a clock
    if (readOnly || !ready.seen || ME.frozen) return;
    const cur = mine('seen'); if (cur.pl === ME.pl && Date.now() - (num(cur.t) || 0) < 15 * 60000) return;
    save('seen', { pl: ME.pl, t: Date.now() });
  }

  /* ---------- everyone else ---------- */
  const FIG = new Map();            // peer label -> figure
  let PEERS = [], myPeer = null;
  OUTFIT.subs.add(dressAll); dressAll();                         // outfits change live, as builders dress their figures
  // only the platform vouches for who someone is (by): an id a page puts in its own presence could be anyone's
  const keyOf = p => p.by || p.peer;
  const idOf = p => p.by || null;
  function others() {                                            // one figure per person: their most recently active tab
    const best = new Map();
    for (const p of PEERS) {
      if (p.isMe || p.kind !== 'viewer') continue; const pr = p.presence || {};
      if (num(pr.x) === null || num(pr.z) === null) continue;
      const k = keyOf(p), b = best.get(k); if (!b || p.updatedAt > b.updatedAt) best.set(k, p);
    }
    return [...best.values()];
  }
  function syncFigures() {
    const live = new Set();
    for (const p of others()) {
      live.add(p.peer); let f = FIG.get(p.peer);
      if (!f) { const id = idOf(p), col = figColor(id, p.peer); f = makeFigure(col, 'PEER:' + p.peer); makeTag(f, col, false); f.id = id; FIG.set(p.peer, f); dress(f, id ? OUTFIT.all[id] : null); }
      f.pres = p.presence; f.guest = p.guest;
    }
    for (const [k, f] of FIG) if (!live.has(k)) { dropFigure(f); FIG.delete(k); }
  }
  function seats() {                                             // everyone at the fire, each in the same seat on every screen
    const at = PEERS.filter(p => p.kind === 'viewer' && p.presence && p.presence.s === 1).map(p => p.peer).sort();
    const out = new Map();
    at.forEach((label, i) => {
      const tier = i < SEATS.length ? 0 : 1, ph = SEATS[i % SEATS.length] + (tier ? 0.25 : 0);
      const pos = V3(M.fireL.x + Math.cos(ph) * (tier ? 2.45 : 1.78), tier ? 1.06 : 0.68, Math.sin(ph) * (tier ? 1.66 : 1.36)).applyMatrix4(M.driftM);
      out.set(label, { pos, a: Math.atan2(P.fire.x - pos.x, P.fire.z - pos.z) });
    });
    return out;
  }
  const tmp = V3(), prev = V3();
  function drawFigures(dt, t, st, now) {
    const k = 1 - Math.exp(-dt * 5), seat = FIG.size ? seats() : null, glowK = 0.12 * (st.night || 0);   // a soft glow that keeps the figures in the night, not pasted on it (visual review S4)
    if (KIT) { KIT.cloth.emissiveIntensity = glowK; KIT.metal.emissiveIntensity = glowK * 0.6; KIT.glass.emissiveIntensity = 0.45 + 2.4 * (st.night || 0); }   // the outfits glow with the figures, the lanterns more
    for (const [label, f] of FIG) {
      const pr = f.pres || {};
      const s = pr.s === 1 && seat && seat.get(label);
      if (s) { f.tgt.copy(s.pos); f.ta = s.a; } else { f.tgt.set(num(pr.x) || 0, 0, num(pr.z) || 0); f.ta = num(pr.a) || 0; }
      prev.copy(f.cur);
      if (f.fresh) { f.cur.copy(f.tgt); f.a = f.ta; f.fresh = false; } else { f.cur.lerp(f.tgt, k); f.a += angDiff(f.a, f.ta) * k; }
      const speed = dt > 0 ? prev.distanceTo(f.cur) / dt : 0, bob = !st.reduced && speed > 0.4 && !s ? Math.abs(Math.sin(t * 9 + f.ph)) * 0.05 : 0;
      f.g.position.set(f.cur.x, f.cur.y + bob, f.cur.z); f.g.rotation.y = f.a;
      f.stand.visible = !s; f.sit.visible = !!s; f.g.visible = !st.story;
      for (const m of f.mats) m.emissiveIntensity = glowK;
      tagAt(f, !st.story, s ? 1.38 : 1.95, now, firstName(f.id));
    }
    // your own figure, when you are out on the playa and the camera follows you
    const showMe = !ME.fp && !st.story;
    MYF.g.visible = showMe;
    if (showMe) {
      MYF.cur.set(ME.x, 0, ME.z); MYF.a += angDiff(MYF.a, ME.a) * Math.min(1, dt * 10);
      const moving = Math.hypot(ME.vx, ME.vz) > 0.4, bob = !st.reduced && moving ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
      MYF.g.position.set(ME.x, bob, ME.z); MYF.g.rotation.y = MYF.a; for (const m of MYF.mats) m.emissiveIntensity = glowK;
    }
    tagAt(MYF, showMe, 1.95, now, null);
  }
  function tagAt(f, show, h, now, name) {
    if (!f.tag) return;
    if (name !== null && f.tagName !== name) { f.tag.querySelector('span').textContent = name; f.tagName = name; }
    if (!show) { f.tag.hidden = true; f.say.hidden = true; return; }
    tmp.set(f.cur.x, f.cur.y + h, f.cur.z).project(camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.15 || Math.abs(tmp.y) > 1.15) { f.tag.hidden = true; f.say.hidden = true; return; }
    const x = (tmp.x + 1) / 2 * innerWidth, y = (1 - tmp.y) / 2 * innerHeight, far = camera.position.distanceTo(f.cur) > 80;
    f.tag.hidden = false; f.tag.classList.toggle('far', far); f.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    if (f.sayUntil > now) { f.say.hidden = false; f.say.style.transform = `translate(${x.toFixed(1)}px, ${(y - 30).toFixed(1)}px) translate(-50%, -100%)`; } else f.say.hidden = true;
  }
  const figureOfId = id => { if (!id) return null; if (id === myId) return MYF; for (const f of FIG.values()) if (f.id === id) return f; return null; };
  const peerByLabel = label => PEERS.find(p => p.peer === label);

  room.onPeers(ch => {
    PEERS = ch.peers; for (const p of ch.peers) if (p.isMe && p.sameTab) myPeer = p.peer;
    syncFigures(); schedule('people', 'pill');
    if (!S.greeted && others().length) { S.greeted = true; setTimeout(() => { const n = others().length; if (n) M.toast(n === 1 ? 'Another builder is in the Mahalaverse with you. Open Together to talk.' : `${n} other builders are in the Mahalaverse with you. Open Together to talk.`); }, 2500); }
  }, roomDead);
  function roomDead() { S.roomDead = true; for (const f of FIG.values()) dropFigure(f); FIG.clear(); PEERS = []; schedule('people', 'pill'); }
  let connT = 0;
  try { room.onConnection(c => { clearTimeout(connT); if (c) $('tgConn').hidden = true; else connT = setTimeout(() => { $('tgConn').hidden = room.connected(); }, 2500); }, () => { }); } catch (e) { }
  try {
    room.on('wave', msg => {
      const f = msg.isMe ? MYF : (FIG.get(msg.peer) || figureOfId(msg.by));
      if (f) say(f, '\u{1F44B}');
      if (!msg.isMe && msg.data && msg.data.to === myPeer) { const p = peerByLabel(msg.peer); showNotice(p ? idOf(p) : msg.by, msg.peer); }
    }, () => { });
  } catch (e) { }
  function wave(label) {
    const p = peerByLabel(label); if (!p) return;
    room.emit('wave', { to: label }).then(() => M.toast(`You waved to ${firstName(idOf(p))}.`), e => M.toast(e && e.code === 'not_permitted' ? 'Waving is not open to you yet. To take part, write to the camp at wearemahala@gmail.com.' : 'The wave did not get through. Try again.'));
  }
  function showNotice(id, label) {
    const p = peerByLabel(label), where = p && p.presence ? WHERE[p.presence.pl] || '' : '';
    notice.innerHTML = `${avImg(id)}<span class="tg-nt"><b>${esc(nameOf(id))} waves to you</b><small>${esc(where)}</small></span><button class="btn" type="button" data-nw="${esc(label)}">Wave back</button><button class="btn primary" type="button" data-ng="${esc(label)}">Go to them</button><button class="iconbtn x" type="button" data-nx aria-label="Dismiss">${icon('x')}</button>`;
    notice.hidden = false; clearTimeout(showNotice.t); showNotice.t = setTimeout(() => { notice.hidden = true; }, 15000);
  }
  notice.addEventListener('click', e => {
    const w = e.target.closest('[data-nw]'), g = e.target.closest('[data-ng]'), x = e.target.closest('[data-nx]');
    if (w) wave(w.dataset.nw); if (g) goToPeer(g.dataset.ng); if (w || g || x) notice.hidden = true;
  });

  /* ---------- walking: arrow keys or WASD, a double-click or a double-tap on the ground ---------- */
  const KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', shift: 'run' };
  const held = new Set();
  const typing = () => { const a = document.activeElement; return a && (/INPUT|SELECT|TEXTAREA/.test(a.tagName) || a.isContentEditable); };
  const canWalk = st => !st.inside && !st.fire && !st.story && !M.modalsOpen();
  addEventListener('keydown', e => {
    const k = KEYS[e.key.toLowerCase()]; if (!k || typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!canWalk(M.state())) return; held.add(k); if (k !== 'run') e.preventDefault();
  });
  addEventListener('keyup', e => { const k = KEYS[e.key.toLowerCase()]; if (k) held.delete(k); });
  addEventListener('blur', () => held.clear());
  const fwd = V3(), right = V3(), step = V3();
  function walk(dt, st) {
    if (!held.size || st.flying || !canWalk(st)) return;
    const cam = camera.position, tg = controls.target;
    fwd.set(tg.x - cam.x, 0, tg.z - cam.z); if (fwd.lengthSq() < 1e-6) return; fwd.normalize(); right.set(-fwd.z, 0, fwd.x);
    step.set(0, 0, 0);
    if (held.has('f')) step.add(fwd); if (held.has('b')) step.sub(fwd); if (held.has('r')) step.add(right); if (held.has('l')) step.sub(right);
    if (step.lengthSq() < 1e-6) return;
    const speed = THREE.MathUtils.clamp(cam.distanceTo(tg) * 0.35, 3, 60) * (held.has('run') ? 2.5 : 1);
    step.normalize().multiplyScalar(speed * dt); tg.add(step); cam.add(step);
    const r = Math.hypot(tg.x, tg.z); if (r > 250) { const s = 250 / r, ox = tg.x * (1 - s), oz = tg.z * (1 - s); tg.x -= ox; tg.z -= oz; cam.x -= ox; cam.z -= oz; }
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = V3();
  function rayAt(x, y) { const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function walkTo(x, y) {
    const st = M.state(); if (!canWalk(st)) return;
    rayAt(x, y); if (!ray.ray.intersectPlane(ground, hitP)) return;
    const things = ray.intersectObjects(M.PICKABLE, false), h = things[0];
    if (h && h.distance < ray.ray.origin.distanceTo(hitP) - 0.5) { if (h.point.y > 0.35) return; hitP.copy(h.point); }
    if (Math.hypot(hitP.x, hitP.z) > 250) return;
    goPoint(hitP.x, hitP.z);
  }
  function goPoint(x, z, d) {
    const st = M.state(), off = camera.position.clone().sub(controls.target), sph = new THREE.Spherical().setFromVector3(off);
    const dist = Math.hypot(x - controls.target.x, z - controls.target.z);
    const v = { t: V3(x, 1, z), d: d || THREE.MathUtils.clamp(sph.radius, 12, 40), p: THREE.MathUtils.clamp(sph.phi, 0.9, 1.25), a: sph.theta };
    if (st.fire) { M.leaveFireside(false); }
    if (st.inside) { M.leavePlace(v); return; }
    M.flyRaw(v, THREE.MathUtils.clamp(dist / 14, 0.9, 3.2));
  }
  canvas.addEventListener('dblclick', e => walkTo(e.clientX, e.clientY));
  let down = null, lastTap = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; if (!pop.hidden) pop.hidden = true; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved > 6) return;
    const hit = pickMine(e.clientX, e.clientY); if (hit) { openPop(hit, e.clientX, e.clientY); return; }
    if (e.pointerType === 'touch') { const now = performance.now(); if (lastTap && now - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 26) { lastTap = null; walkTo(e.clientX, e.clientY); } else lastTap = { t: now, x: e.clientX, y: e.clientY }; }
  });
  function pickMine(x, y) {
    const list = [];
    for (const f of FIG.values()) if (f.g.visible) list.push(...f.picks);
    for (const n of NOTE3D.values()) list.push(n.card);
    if (!list.length) return null;
    rayAt(x, y); const h = ray.intersectObjects(list, false)[0]; if (!h) return null;
    const all = ray.intersectObjects(M.PICKABLE, false)[0];
    if (all && all.object !== h.object && all.distance < h.distance - 0.05 && !String(all.object.userData.pick || '').startsWith('PEER:')) return null;
    return h.object.userData.pick;
  }

  /* ---------- going to people and places ---------- */
  function goToPeer(label) {
    const p = peerByLabel(label); if (!p || !p.presence) return; const pr = p.presence;
    if (pr.s === 1) { M.openFireside(); return; }
    if (pr.in === 1) { M.select(pr.pl === 'mahal' ? 'MAHAL_COIL' : 'CENTRE'); return; }
    goPoint(num(pr.x) || 0, num(pr.z) || 0, 14);
  }
  function goPlace(pl) { if (pl === 'fire') M.openFireside(); else if (GO[pl]) M.select(GO[pl]); }

  /* ---------- the popover for a person or a note ---------- */
  function openPop(key, x, y) {
    let html = '';
    if (key.startsWith('PEER:')) {
      const label = key.slice(5), p = peerByLabel(label); if (!p) return; const id = idOf(p), pr = p.presence || {};
      html = `<div class="tg-ph">${avImg(id, 'tg-av big')}<div><b>${esc(nameOf(id))}</b><small>${esc(WHERE[pr.pl] || 'here')}${p.guest ? ' · guest' : ''}</small></div></div>
        <div class="tg-acts"><button class="btn" type="button" data-pw="${esc(label)}">Wave</button><button class="btn primary" type="button" data-pg="${esc(label)}">Go to them</button></div>`;
    } else if (key.startsWith('NOTE:')) {
      const n = NOTES.find(n => n.key === key.slice(5)); if (!n) return;
      html = `<div class="tg-ph">${avImg(n.uid)}<div><b>A note from ${esc(firstName(n.uid))}</b><small>${esc(WHERE[n.pl] || '')} · ${esc(ago(n.t))}</small></div></div>
        <p class="tg-nb">${esc(n.tx)}</p>${(n.uid === myId || admin) ? `<div class="tg-acts"><button class="btn" type="button" data-pr="${esc(n.key)}">Take it down</button></div>` : ''}`;
    } else return;
    pop.innerHTML = html + `<button class="iconbtn x" type="button" data-px aria-label="Close">${icon('x')}</button>`; pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - h - 18)) + 'px';
  }
  pop.addEventListener('click', e => {
    const w = e.target.closest('[data-pw]'), g = e.target.closest('[data-pg]'), r = e.target.closest('[data-pr]');
    if (w) wave(w.dataset.pw); if (g) goToPeer(g.dataset.pg); if (r) removeNote(r.dataset.pr);
    if (w || g || r || e.target.closest('[data-px]')) pop.hidden = true;
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { pop.hidden = true; notice.hidden = true; } });

  /* ---------- talk ---------- */
  let MSGS = {}; const known = new Set(); let chatPrimed = false;
  const READ = {}; for (const [ch] of CHANNELS) { const v = +M.store.get('mv.read.' + ch); READ[ch] = v > 0 && v <= Date.now() + 600000 ? v : Date.now() - 86400000; }
  const unread = ch => (MSGS[ch] || []).filter(m => m.t > READ[ch] && m.uid !== myId).length;
  function markRead(ch) { const last = Math.min(Date.now(), (MSGS[ch] || []).reduce((a, m) => Math.max(a, m.t), 0)); if (last > READ[ch]) { READ[ch] = last; M.store.set('mv.read.' + ch, String(last)); schedule('pill', 'chan'); } }
  function rebuildChat() {
    const out = {}; for (const [ch] of CHANNELS) out[ch] = [];
    for (const [uid, doc] of Object.entries(DATA.chat)) {
      const m = doc && doc.m; if (!m || typeof m !== 'object') continue;
      for (const [ch] of CHANNELS) for (const it of (Array.isArray(m[ch]) ? m[ch] : [])) {
        if (!it || typeof it.x !== 'string' || okT(it.t) === null) continue;
        out[ch].push({ uid, i: String(it.i || ''), t: it.t, x: it.x.slice(0, 600), ch });
      }
    }
    for (const ch in out) out[ch].sort((a, b) => a.t - b.t);
    for (const ch in out) for (const m of out[ch]) {
      const k = m.uid + '~' + m.i; if (known.has(k)) continue; known.add(k);
      if (chatPrimed && m.uid !== myId && Date.now() - m.t < 90000) { say(figureOfId(m.uid), m.x); if (!S.open || S.tab !== 'talk' || S.ch !== ch) root.classList.add('ping'); }
    }
    chatPrimed = true; MSGS = out;
  }
  async function send(words) {
    words = clean(words, 500); if (!words) return false;
    if (readOnly) { writeFailed({ code: 'invalid_argument' }); return false; } if (!ready.chat) { M.toast('Still connecting. Try again in a moment.'); return false; }
    const doc = clone(mine('chat')); doc.m = doc.m && typeof doc.m === 'object' ? doc.m : {};
    const arr = Array.isArray(doc.m[S.ch]) ? doc.m[S.ch] : []; arr.push({ i: rid(), t: Date.now(), x: words }); doc.m[S.ch] = arr.slice(-CAP.msgs);
    say(MYF, words); return save('chat', doc);
  }
  function removeMsg(uid, i) {
    if (uid !== myId && !admin) return; const doc = clone(DATA.chat[uid]); if (!doc.m) return;
    for (const ch in doc.m) if (Array.isArray(doc.m[ch])) doc.m[ch] = doc.m[ch].filter(x => String(x.i) !== i);
    save('chat', doc, uid);
  }
  function renderChan() {
    const sel = $('tgChan'), cur = S.ch;
    sel.innerHTML = CHANNELS.map(([k, n]) => { const u = unread(k); return `<option value="${k}"${k === cur ? ' selected' : ''}>${n}${k === chanOf(ME.pl) && k !== 'all' ? ' (where you are)' : ''}${u && k !== cur ? ` (${u} new)` : ''}</option>`; }).join('');
    text.placeholder = `Say something ${CH_TO[cur]}`;
  }
  function renderTalk() {
    renderChan();
    const box = $('tgMsgs'), list = (MSGS[S.ch] || []).slice(-80), nearEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    let last = null;
    box.innerHTML = list.length ? list.map(m => {
      const cont = last && last.uid === m.uid && m.t - last.t < 5 * 60000; last = m;
      const del = (m.uid === myId || admin) ? `<button class="tg-x" type="button" data-del="${esc(m.uid + '~' + m.i)}" aria-label="Remove this message">${icon('x')}</button>` : '';
      return `<div class="tg-msg${cont ? ' cont' : ''}${m.uid === myId ? ' mine' : ''}">${cont ? '<span></span>' : avImg(m.uid)}<div class="tg-mb">${cont ? '' : `<div class="tg-mh"><b>${esc(nameOf(m.uid))}</b><time class="tg-time" datetime="${m.t > 0 && m.t < 8.64e15 ? new Date(m.t).toISOString() : ''}">${esc(ago(m.t))}</time></div>`}<p>${esc(m.x)}</p></div>${del}</div>`;
    }).join('') : readOnly ? '' : `<p class="tg-empty">${S.ch === 'all' ? 'Nothing said to everyone yet. Start the conversation.' : `No one has said anything ${CH_TO[S.ch]} yet. Start the conversation.`}</p>`;
    if (nearEnd || renderTalk.firstFor !== S.ch) box.scrollTop = box.scrollHeight; renderTalk.firstFor = S.ch;
    if (S.open && S.tab === 'talk') markRead(S.ch);
    renderNotesList();
    const ro = readOnly; $('tgCompose').hidden = ro; $('tgRoTalk').hidden = !ro;
  }
  $('tgChan').addEventListener('change', e => { S.ch = e.target.value; S.chPinned = Date.now(); renderTalk(); });
  $('tgCompose').addEventListener('submit', async e => {
    e.preventDefault(); const w = text.value; if (!clean(w, 500)) return;
    text.value = ''; fit(); const ok = await send(w); if (!ok && !text.value) { text.value = w; fit(); }
  });
  text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('tgCompose').requestSubmit(); } if (e.key !== 'Escape') e.stopPropagation(); });
  const fit = () => { text.style.height = 'auto'; text.style.height = Math.min(120, text.scrollHeight + 2) + 'px'; };
  text.addEventListener('input', fit);
  $('tgMsgs').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (!d) return; const [uid, i] = splitKey(d.dataset.del); removeMsg(uid, i); });

  /* ---------- notes in the world ---------- */
  let NOTES = []; const NOTE3D = new Map();
  const paper = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.85, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.8 });
  function rebuildNotes() {
    const out = [];
    for (const [uid, doc] of Object.entries(DATA.notes)) for (const n of (doc && Array.isArray(doc.n) ? doc.n : [])) {
      if (!n || typeof n.tx !== 'string' || num(n.x) === null || num(n.z) === null || okT(n.t) === null) continue;
      out.push({ uid, key: uid + '~' + String(n.i || ''), i: String(n.i || ''), t: n.t, x: n.x, y: num(n.y) || 0, z: n.z, pl: typeof n.pl === 'string' ? n.pl : '', tx: n.tx.slice(0, 500) });
    }
    NOTES = out.sort((a, b) => b.t - a.t);
    const live = new Set(NOTES.map(n => n.key));
    for (const [k, o] of NOTE3D) if (!live.has(k)) { world.remove(o.g); const i = M.PICKABLE.indexOf(o.card); if (i >= 0) M.PICKABLE.splice(i, 1); o.pinMat.dispose(); NOTE3D.delete(k); }
    for (const n of NOTES) if (!NOTE3D.has(n.key)) {
      const g = new THREE.Group(), c = colorOf(n.uid), pinMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, emissive: c, emissiveIntensity: 0.2 });
      const post = new THREE.Mesh(GEO.post, postMat); post.position.y = 0.53; post.castShadow = true;
      const card = new THREE.Mesh(GEO.card, paper); card.position.y = 1.12; card.castShadow = true; card.userData.pick = 'NOTE:' + n.key;
      const pin = new THREE.Mesh(GEO.pin, pinMat); pin.position.set(0, 1.2, 0.012);
      const base = new THREE.Mesh(GEO.base, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, depthWrite: false })); base.position.y = 0.02;
      g.add(post, card, pin, base); g.position.set(n.x, n.y, n.z); world.add(g); M.PICKABLE.push(card);
      NOTE3D.set(n.key, { g, card, pinMat });
    }
  }
  function here() {                                               // a spot just in front of you, on the ground
    const cam = camera.position, tg = controls.target; fwd.set(tg.x - cam.x, 0, tg.z - cam.z).normalize();
    if (ME.s === 1) { const p = P.fire.clone().addScaledVector(V3(cam.x - P.fire.x, 0, cam.z - P.fire.z).normalize(), 0.95); return { x: p.x, y: P.fire.y, z: p.z }; }
    if (ME.fp) return { x: cam.x + fwd.x * 1.3, y: 0, z: cam.z + fwd.z * 1.3 };
    return { x: ME.x - fwd.z * 1.1, y: 0, z: ME.z + fwd.x * 1.1 };
  }
  async function addNote(words) {
    words = clean(words, 500); if (!words) return false;
    if (readOnly) { writeFailed({ code: 'invalid_argument' }); return false; } if (!ready.notes) { M.toast('Still connecting. Try again in a moment.'); return false; }
    const at = here(), r2 = v => Math.round(v * 100) / 100;
    const doc = clone(mine('notes')), arr = Array.isArray(doc.n) ? doc.n : [];
    arr.push({ i: rid(), t: Date.now(), x: r2(at.x), y: r2(at.y), z: r2(at.z), pl: ME.pl, tx: words }); doc.n = arr.slice(-CAP.notes);
    const ok = await save('notes', doc); if (ok) M.toast(`Your note is up ${WHERE[ME.pl] || 'here'}.`); return ok;
  }
  function removeNote(key) {
    const [uid, i] = splitKey(key); if (uid !== myId && !admin) return;
    const doc = clone(DATA.notes[uid]); doc.n = (Array.isArray(doc.n) ? doc.n : []).filter(n => String(n.i) !== i); save('notes', doc, uid);
  }
  function renderNotesList() {
    const pl = S.ch === 'all' ? null : S.ch, list = NOTES.filter(n => !pl || n.pl === pl).slice(0, 12), box = $('tgNotes');
    box.hidden = !list.length; if (!list.length) return;
    $('tgNotesSum').textContent = list.length === 1 ? `1 note left ${pl ? CH_TO[pl] : 'in the world'}` : `${list.length} notes left ${pl ? CH_TO[pl] : 'in the world'}`;
    $('tgNotesList').innerHTML = list.map(n => `<button class="tg-nrow" type="button" data-note="${esc(n.key)}">${icon('pin')}<span><b>${esc(n.tx.length > 70 ? n.tx.slice(0, 67) + '...' : n.tx)}</b><small>${esc(firstName(n.uid))} · ${esc(ago(n.t))}</small></span></button>`).join('');
  }
  $('tgNotesList').addEventListener('click', e => {
    const b = e.target.closest('[data-note]'); if (!b) return; const n = NOTES.find(x => x.key === b.dataset.note); if (!n) return;
    const st = M.state();
    if (n.pl === 'fire' && n.y > 0.1) { if (!st.fire) M.openFireside(); return; }
    if (st.inside && Math.hypot(n.x - camera.position.x, n.z - camera.position.z) < 6) return;
    goPoint(n.x, n.z, 12);
  });
  $('tgPin').addEventListener('click', async () => { const w = text.value; if (!clean(w, 500)) { M.toast('Write the note first, then leave it here.'); text.focus(); return; } text.value = ''; fit(); const ok = await addNote(w); if (!ok && !text.value) { text.value = w; fit(); } });

  /* ---------- people ---------- */
  function renderPeople() {
    const now = others().sort((a, b) => nameOf(idOf(a)).localeCompare(nameOf(idOf(b))));
    const onlineIds = new Set(now.map(idOf).filter(Boolean));
    const row = (id, sub, acts, c) => `<div class="tg-row" style="--c:${c}">${avImg(id)}<div class="tg-rm"><b>${esc(nameOf(id))}</b><small>${esc(sub)}</small></div><div class="tg-acts">${acts}</div></div>`;
    let h = `<div class="tg-sect"><h4>Here now<span class="tg-num">${now.length + 1}</span></h4>`;
    h += `<div class="tg-row me" style="--c:${myColor}">${avImg(myId)}<div class="tg-rm"><b>You</b><small>${esc(WHERE[ME.pl] || 'here')}</small></div><div class="tg-acts"></div></div>`;
    h += now.map(p => { const id = idOf(p), pr = p.presence || {};
      return row(id, (WHERE[pr.pl] || 'here') + (p.guest ? ' · guest' : ''), `<button class="btn" type="button" data-pw="${esc(p.peer)}">Wave</button><button class="btn" type="button" data-pg="${esc(p.peer)}">Go to</button>`, colorOf(id, p.peer)); }).join('');
    if (!now.length) h += `<p class="tg-empty sm">No one else is here right now. Leave a message in Talk, or a note where you are, and they will find it when they come.</p>`;
    h += '</div>';
    const recent = Object.entries(DATA.seen).filter(([id, v]) => id !== myId && !onlineIds.has(id) && v && num(v.t) && Date.now() - v.t < 21 * 86400000).sort((a, b) => b[1].t - a[1].t).slice(0, 12);
    if (recent.length) h += `<div class="tg-sect"><h4>Recently</h4>${recent.map(([id, v]) => row(id, `${WHERE[v.pl] || 'around'} · ${ago(v.t)}`, '', colorOf(id))).join('')}</div>`;
    $('tgPeopleList').innerHTML = h;
    // the call to gather: editors start and end it
    const active = callActive();
    $('tgGather').hidden = !admin || readOnly; $('tgGatherOn').hidden = !active; $('tgGatherOff').hidden = !!active;
    if (active) $('tgGatherText').textContent = `${CALL.by === myId ? 'You are' : nameOf(CALL.by) + ' is'} calling everyone ${WHERE[CALL.pl] ? WHERE[CALL.pl].replace(/^(in|at|on) the /, 'to the ') : 'together'}${CALL.tx ? ': ' + CALL.tx : '.'}`;
  }
  $('tgPeopleList').addEventListener('click', e => { const w = e.target.closest('[data-pw]'), g = e.target.closest('[data-pg]'); if (w) wave(w.dataset.pw); if (g) goToPeer(g.dataset.pg); });

  /* ---------- the call to gather ---------- */
  const callActive = () => CALL && typeof CALL.pl === 'string' && num(CALL.t) && Date.now() - CALL.t < CALL_HOURS * 3600000 ? CALL : null;
  const toPlace = pl => (WHERE[pl] || 'together').replace(/^(in|at|on) the /, 'to the ');
  function renderCall() {
    const c = callActive(), dismissed = +M.store.get('mv.call.dismissed') || 0;
    const st = M.state(), there = c && ((st.fire && c.pl === 'fire') || (!st.fire && ME.pl === c.pl && (c.pl !== 'temple' || st.inside)));
    call.hidden = !c || dismissed === c.t || !!there; document.body.classList.toggle('tg-calling', !call.hidden);
    if (!c) return;
    $('tgCallT').textContent = `${c.by === myId ? 'You are' : firstName(c.by) + ' is'} calling everyone ${toPlace(c.pl)}`;
    $('tgCallN').textContent = (typeof c.tx === 'string' && c.tx ? clean(c.tx, 90) + ' · ' : '') + ago(c.t);
  }
  $('tgCallThere').addEventListener('click', () => { const c = callActive(); if (c) goPlace(c.pl); M.store.set('mv.call.dismissed', String(c ? c.t : 0)); call.hidden = true; });
  $('tgCallX').addEventListener('click', () => { const c = callActive(); M.store.set('mv.call.dismissed', String(c ? c.t : 0)); call.hidden = true; });
  $('tgCallGo').addEventListener('click', async () => {
    if (!db || !admin) return;
    const body = { pl: $('tgCallPl').value, tx: clean($('tgCallTx').value, 90), t: Date.now(), by: myId };
    try { await db.doc('live/call').set(body); $('tgCallTx').value = ''; M.toast(`Everyone in the Mahalaverse can see your call ${toPlace(body.pl)}.`); } catch (e) { writeFailed(e); }
  });
  $('tgCallEnd').addEventListener('click', async () => { if (!db || !admin) return; try { await db.doc('live/call').delete(); } catch (e) { writeFailed(e); } });

  /* ---------- the camp board ---------- */
  let POSTS = [], CLAIMS = new Map();
  function rebuildBoard() {
    const out = [];
    for (const [uid, doc] of Object.entries(DATA.board)) for (const p of (doc && Array.isArray(doc.p) ? doc.p : [])) {
      if (!p || typeof p.tx !== 'string' || okT(p.t) === null) continue;
      out.push({ uid, i: String(p.i || ''), key: uid + '~' + String(p.i || ''), t: p.t, k: p.k === 'ask' ? 'ask' : 'offer', c: CAT_NAME[p.c] ? p.c : 'other', tx: p.tx.slice(0, 300) });
    }
    POSTS = out.sort((a, b) => b.t - a.t);
    CLAIMS = new Map();
    for (const [uid, doc] of Object.entries(DATA.claims)) for (const k of (doc && Array.isArray(doc.c) ? doc.c : [])) if (typeof k === 'string') { if (!CLAIMS.has(k)) CLAIMS.set(k, []); CLAIMS.get(k).push(uid); }
  }
  function renderBoard() {
    const list = POSTS.filter(p => S.filter === 'all' || p.c === S.filter);
    $('tgPosts').innerHTML = list.length ? list.map(p => {
      const ins = (CLAIMS.get(p.key) || []).filter(u => u !== p.uid), mineIn = ins.includes(myId), own = p.uid === myId;
      const who = ins.length ? `<span class="tg-in">${ins.slice(0, 4).map(u => avImg(u, 'tg-av xs')).join('')}<span>${esc(ins.slice(0, 2).map(firstName).join(', '))}${ins.length > 2 ? ` and ${ins.length - 2} more` : ''} ${p.k === 'offer' ? (ins.length === 1 ? 'wants in' : 'want in') : (ins.length === 1 ? 'can help' : 'can help')}</span></span>` : '';
      const act = own || readOnly ? '' : `<button class="btn${mineIn ? ' on' : ''}" type="button" data-claim="${esc(p.key)}" aria-pressed="${mineIn}">${mineIn ? icon('check') + (p.k === 'offer' ? 'You are in' : 'You are helping') : (p.k === 'offer' ? 'Count me in' : 'I can help')}</button>`;
      const del = own || admin ? `<button class="tg-link" type="button" data-unpost="${esc(p.key)}">Take down</button>` : '';
      return `<article class="tg-card"><div class="tg-ch"><span class="chip ${p.k === 'offer' ? 'done' : 'open'}">${p.k === 'offer' ? 'Offer' : 'Need'}</span><span class="tg-cat">${CAT_NAME[p.c]}</span><time class="tg-time">${esc(ago(p.t))}</time></div>
        <p>${esc(p.tx)}</p><div class="tg-cf"><span class="tg-by">${avImg(p.uid, 'tg-av xs')}${esc(own ? 'You' : nameOf(p.uid))}</span>${who}</div>${act || del ? `<div class="tg-cfa">${act}${del}</div>` : ''}</article>`;
    }).join('') : readOnly ? '' : `<p class="tg-empty">${S.filter === 'all' ? 'Nothing on the board yet. Post the first offer or need.' : `Nothing about ${CAT_NAME[S.filter].toLowerCase()} yet.`}</p>`;
    $('tgNew').hidden = readOnly || !$('tgPost').hidden; $('tgRoBoard').hidden = !readOnly;
    $$('#tgFilter [data-f]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === S.filter)));
  }
  const $$ = s => [...document.querySelectorAll(s)];
  function hint() { $('tgPostText').placeholder = HINT[S.kind][$('tgCat').value] || ''; }
  $('tgNew').addEventListener('click', () => { $('tgPost').hidden = false; $('tgNew').hidden = true; hint(); $('tgPostText').focus(); });
  $('tgPostCancel').addEventListener('click', () => { $('tgPost').hidden = true; $('tgNew').hidden = readOnly; });
  $('tgCat').addEventListener('change', hint);
  $('tgPost').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; S.kind = b.dataset.kind; $$('#tgPost [data-kind]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hint(); });
  $('tgPostText').addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  $('tgPost').addEventListener('submit', async e => {
    e.preventDefault(); const words = clean($('tgPostText').value, 280); if (!words) { $('tgPostText').focus(); return; }
    if (readOnly) { writeFailed({ code: 'invalid_argument' }); return; } if (!ready.board) { M.toast('Still connecting. Try again in a moment.'); return; }
    const doc = clone(mine('board')), arr = Array.isArray(doc.p) ? doc.p : [];
    arr.push({ i: rid(), t: Date.now(), k: S.kind, c: $('tgCat').value, tx: words }); doc.p = arr.slice(-CAP.posts);
    if (await save('board', doc)) { $('tgPostText').value = ''; $('tgPost').hidden = true; S.filter = 'all'; schedule('board'); M.toast('Posted on the camp board.'); }
  });
  $('tgFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; S.filter = b.dataset.f; renderBoard(); });
  $('tgPosts').addEventListener('click', e => {
    const c = e.target.closest('[data-claim]'), u = e.target.closest('[data-unpost]');
    if (c) { if (readOnly) { writeFailed({ code: 'invalid_argument' }); return; } if (!ready.claims) { M.toast('Still connecting. Try again in a moment.'); return; }
      const doc = clone(mine('claims')), set = new Set(Array.isArray(doc.c) ? doc.c : []), k = c.dataset.claim;
      set.has(k) ? set.delete(k) : set.add(k); doc.c = [...set].slice(-CAP.claims); save('claims', doc); }
    if (u) { const [uid, i] = splitKey(u.dataset.unpost); if (uid !== myId && !admin) return;
      const doc = clone(DATA.board[uid]); doc.p = (Array.isArray(doc.p) ? doc.p : []).filter(p => String(p.i) !== i); save('board', doc, uid); }
  });

  /* ---------- quests: who is on each one, shown on the quest's card ---------- */
  // the page keeps the quests: taking one writes it to the taker's own builders document, which every builder can read
  const ins = M.inspector;
  const takersOf = qid => ((M.LIVE && M.LIVE.builders) || []).filter(b => b && b.quests && b.quests[qid]);
  function decorate() {
    const qid = M.cur && M.cur(); const body = ins.querySelector('.insp-body');
    if (!qid || !/^Q-\d+$/.test(qid) || !body || !M.LIVE || !M.LIVE.on) return;
    const all = takersOf(qid), mineIn = !!(M.ME.quests && M.ME.quests[qid]);
    const named = all.filter(b => b.id !== myId && typeof b.name === 'string' && b.name.trim()), unnamed = all.filter(b => b.id !== myId).length - named.length;
    const parts = (mineIn ? ['You'] : []).concat(named.slice(0, 3).map(b => esc(clean(b.name, 40)))), more = named.length - Math.min(3, named.length) + unnamed;
    const list = parts.length ? parts.join(', ') + (more ? ` and ${more} other builder${more === 1 ? '' : 's'}` : '') : `${more} builder${more === 1 ? '' : 's'}`;
    const n = parts.length + more;
    let h = n ? `<span class="tg-in">${(mineIn ? [myId] : []).concat(named.slice(0, 4).map(b => b.id)).map(u => avImg(u, 'tg-av xs')).join('')}</span><span>${list} ${n === 1 && !mineIn ? 'is' : 'are'} on this quest.</span>` : `<span>Nobody has taken this quest yet.</span>`;
    if (mineIn) h += `<button class="tg-link" type="button" data-drop="${esc(qid)}">Leave it</button>`;
    if (mineIn && !(M.ME.show && M.ME.name) && !readOnly) h += `<span class="tg-hid">Others see you as a builder, without your name. To show it, add it in <button class="tg-link" type="button" data-showname>Your path</button>.</span>`;
    let box = ins.querySelector('.tg-takers');
    if (!box) { box = document.createElement('div'); box.className = 'tg-takers'; const at = body.querySelector('.chips'); if (at) at.after(box); else body.prepend(box); }
    if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
    for (const c of body.querySelectorAll('.chips .chip')) if (/^\d+ builders? on it$/.test(c.textContent.trim())) c.hidden = true;   // the line above says it, and stays current
  }
  new MutationObserver(() => decorate()).observe(ins, { childList: true, subtree: true });
  setInterval(decorate, 1500);                                   // others take and leave quests while the card is open
  ins.addEventListener('click', e => {
    const d = e.target.closest('[data-drop]'); if (d) { M.dropQuest(d.dataset.drop); return; }
    if (e.target.closest('[data-showname]')) M.openPath();
  });

  /* ---------- the pill, the tabs and the panel ---------- */
  function renderPill() {
    const now = others(), n = now.length, ids = now.map(idOf);
    $('tgStack').innerHTML = [myId].concat(ids).slice(0, 4).map(id => avImg(id, 'tg-sav')).join('');
    $('tgCount').textContent = S.roomDead ? 'Together' : n === 0 ? 'Only you, for now' : n === 1 ? 'You and 1 other' : `You and ${n} others`;
    $('tgSub').textContent = n ? 'in the Mahalaverse right now' : db ? 'Talk, notes and the camp board' : 'Who is in the Mahalaverse';
    const u = CHANNELS.reduce((a, [k]) => a + unread(k), 0), b = $('tgBadge');
    b.hidden = !u || (S.open && S.tab === 'talk' && unread(S.ch) === u); b.textContent = u > 99 ? '99+' : String(u);
    $('tgN-talk').textContent = u ? String(u) : ''; $('tgN-talk').classList.toggle('hot', !!u);
    $('tgN-people').textContent = String(n + 1);
    $('tgN-board').textContent = POSTS.length ? String(POSTS.length) : '';
  }
  function setTab(t) {
    S.tab = t; persist();
    for (const k of ['talk', 'people', 'board']) { $('tgTab-' + k).setAttribute('aria-selected', String(k === t)); $('tgTab-' + k).tabIndex = k === t ? 0 : -1; $({ talk: 'tgTalk', people: 'tgPeople', board: 'tgBoard' }[k]).hidden = k !== t; }
    schedule(t, 'pill'); if (t === 'talk') root.classList.remove('ping');
  }
  function setOpen(v) {
    S.open = v; persist(); document.body.classList.toggle('tg-open', v); $('tgPanel').hidden = !v; $('tgPill').setAttribute('aria-expanded', String(v)); root.classList.toggle('open', v);
    if (v) { root.classList.remove('ping'); setTab(S.tab); }
    schedule('pill');
  }
  $('tgPill').addEventListener('click', () => setOpen(!S.open));
  $('tgClose').addEventListener('click', () => { setOpen(false); $('tgPill').focus(); });
  root.querySelector('.tg-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  root.querySelector('.tg-tabs').addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); e.stopPropagation(); const t = ['talk', 'people', 'board'], i = t.indexOf(S.tab); setTab(t[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]); $('tgTab-' + S.tab).focus(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && S.open) { setOpen(false); $('tgPill').focus(); } });

  /* ---------- rendering, coalesced to one pass per frame ---------- */
  const dirty = new Set(); let raf = 0;
  function schedule(...w) { for (const x of w) dirty.add(x); if (!raf) raf = setTimeout(flush, 24); }
  function changed(col) {
    if (col === 'chat') { rebuildChat(); schedule('talk', 'pill'); }
    if (col === 'notes') { rebuildNotes(); schedule('talk'); }
    if (col === 'board' || col === 'claims') { rebuildBoard(); schedule('board', 'pill'); }
    if (col === 'seen') schedule('people');
  }
  async function flush() {
    raf = 0; const w = new Set(dirty); dirty.clear(); const all = w.has('all');
    const ids = [myId]; PEERS.forEach(p => ids.push(idOf(p)));
    for (const col of Object.keys(DATA)) ids.push(...Object.keys(DATA[col])); for (const v of CLAIMS.values()) ids.push(...v); if (CALL && CALL.by) ids.push(CALL.by);
    await resolve(ids);
    for (const [label, f] of FIG) if (f.id && (PROF[f.id] || OUTFIT.all[f.id])) paint(f, figColor(f.id, label));
    paint(MYF, figColor(myId, 'me', OUTFIT.mine));
    if (all || w.has('pill')) renderPill();
    if (all || w.has('call')) renderCall();
    if (!S.open) return;
    if ((all || w.has('talk') || w.has('chan')) && S.tab === 'talk') { if (w.has('talk') || all) renderTalk(); else renderChan(); }
    if ((all || w.has('people')) && S.tab === 'people') renderPeople();
    if ((all || w.has('board')) && S.tab === 'board') renderBoard();
  }
  setInterval(() => schedule('all'), 60000);                     // keeps "5 min ago" honest

  /* ---------- each frame ---------- */
  let lastClass = '';
  let lastNow = performance.now();
  M.hooks.push((dt, t) => {
    const st = M.state(), now = performance.now(), rdt = Math.min(0.5, (now - lastNow) / 1000); lastNow = now;
    if (st.entered !== S.entered) { S.entered = st.entered; document.body.classList.toggle('tg-in', !!st.entered); }
    walk(Math.min(0.25, rdt), st); pose(st, rdt); sendPose(now); drawFigures(rdt, t, st, now);
    const nk = (st.night || 0) * 0.55; paper.emissiveIntensity = nk;
    for (const o of NOTE3D.values()) o.g.rotation.y = Math.atan2(camera.position.x - o.g.position.x, camera.position.z - o.g.position.z);
    const cls = (st.fire ? 'f' : '') + (st.inside ? 'i' : ''); if (cls !== lastClass) { lastClass = cls; renderCall(); }
  });

  // first paint
  if (!db) { for (const k of ['talk', 'board']) $('tgTab-' + k).hidden = true; S.tab = 'people'; $('tgSub').textContent = 'who is in the Mahalaverse'; }
  ME.pl = placeAt(controls.target.x, controls.target.z); S.ch = chanOf(ME.pl); $('tgWhere').textContent = WHERE[ME.pl];
  setOpen(S.open); setTab(S.tab); schedule('all');
  return { open: () => setOpen(true), state: () => ({ peers: PEERS.length, figures: FIG.size, notes: NOTES.length, posts: POSTS.length, readOnly, admin, me: { x: ME.x, z: ME.z, pl: ME.pl, s: ME.s, fp: ME.fp }, figs: [...FIG.values()].map(f => ({ id: f.id, x: +f.cur.x.toFixed(2), z: +f.cur.z.toFixed(2), y: +f.cur.y.toFixed(2), sit: f.sit.visible, col: f.col, wear: f.dressed || '' })), mine: { col: MYF.col, wear: MYF.dressed || '' } }) };
}

/* ---------- the look, from the page's own tokens ---------- */
const css = document.createElement('style');
css.textContent = `
#tg { position: fixed; left: 16px; top: calc(76px + env(safe-area-inset-top, 0px)); z-index: 27; width: 340px; max-width: calc(100% - 32px); display: flex; flex-direction: column; gap: 8px;
  max-height: calc(100% - 76px - 98px - env(safe-area-inset-top, 0px)); pointer-events: none; font-family: var(--ui); color: var(--ink); }
#tg > * { pointer-events: auto; }
#tg, .tg-call { transition: opacity .35s, transform .35s; }
body.arrival #tg, body.arrival .tg-call { opacity: 0; pointer-events: none; transform: translateY(6px); }
body.arrival #tg > * { pointer-events: none; }
body.inside #tg { top: calc(76px + env(safe-area-inset-top, 0px)); max-height: calc(100% - 76px - 84px - env(safe-area-inset-top, 0px)); }
body.inside.tg-open #tg { max-height: calc(100% - 76px - 16px - env(safe-area-inset-top, 0px)); }
body.inside.tg-open .inwrap { left: 372px; }
body.firemode #tg { top: calc(16px + env(safe-area-inset-top, 0px)); width: 312px; max-height: calc(100% - 32px - env(safe-area-inset-top, 0px)); }
body.firemode.tg-open .fire-card { left: calc(344px + (100% - 344px) / 2); width: min(780px, calc(100% - 376px)); }
body.tg-calling .vision { opacity: 0; pointer-events: none; }
body:not(.tg-in) #tg, body:not(.tg-in) .tg-call, body:not(.tg-in) .tg-notice, body:not(.tg-in) .tg-pop, body:not(.tg-in) .tg-tag, body:not(.tg-in) .tg-say,
body.storymode #tg, body.storymode .tg-call, body.storymode .tg-tag, body.storymode .tg-say, body.storymode .tg-notice { display: none !important; }
.tg-pill { align-self: flex-start; display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px 0 7px; border-radius: 999px; font: inherit; color: var(--ink); cursor: pointer; text-align: left; }
.tg-pill:hover { background: var(--card-strong); }
.tg-pill:focus-visible, .tg-tabs button:focus-visible, .tg-chips button:focus-visible, .tg-seg button:focus-visible, .tg-nrow:focus-visible, .tg-link:focus-visible, .tg-x:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
#tg.ping .tg-pill { box-shadow: 0 0 0 3px rgba(216, 25, 127, .28), var(--shadow); }
.tg-stack { display: flex; }
.tg-sav { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--card-strong); margin-left: -10px; background: var(--hover); display: block; box-sizing: border-box; }
.tg-stack > :first-child { margin-left: 0; }
.tg-pt { display: grid; min-width: 0; } .tg-pt b { font-weight: 500; font-size: 13.5px; line-height: 1.15; white-space: nowrap; } .tg-pt small { font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }
.tg-badge { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: var(--magenta); color: #fff; font-size: 11.5px; font-weight: 600; display: grid; place-items: center; font-variant-numeric: tabular-nums; }
.tg-panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; flex: 0 1 auto; height: 560px; }
.tg-head { display: flex; align-items: center; gap: 10px; padding: 12px 8px 6px 16px; }
.tg-where { display: grid; min-width: 0; } .tg-where b { font-family: var(--display); font-weight: 400; font-size: 19px; line-height: 1.2; }
.tg-head .x { margin-left: auto; }
.tg-conn { font-size: 11.5px; color: var(--now); background: var(--now-bg); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.tg-tabs { display: flex; gap: 2px; padding: 0 8px; border-bottom: 1px solid var(--card-line); }
.tg-tabs button { position: relative; background: none; border: 0; padding: 9px 8px 10px; font: inherit; font-size: 13.5px; color: var(--ink-2); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; border-radius: 8px 8px 0 0; }
.tg-tabs button:hover { color: var(--ink); }
.tg-tabs button[aria-selected="true"] { color: var(--ink); font-weight: 500; }
.tg-tabs button[aria-selected="true"]::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; border-radius: 2px; background: var(--ink); }
.tg-tabs .n { font-style: normal; font-size: 11px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: var(--hover); color: var(--ink-2); display: inline-grid; place-items: center; font-variant-numeric: tabular-nums; font-weight: 500; }
.tg-tabs .n.hot { background: var(--magenta); color: #fff; } .tg-tabs .n:empty { display: none; }
.tg-pane { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; overflow: auto; padding: 10px 14px 14px; gap: 10px; overscroll-behavior: contain; }
#tgTalk { overflow: hidden; }
.tg-chan { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-3); }
.tg-chan select { flex: 1; }
#tg select, #tg input { height: 32px; border-radius: 999px; border: 1px solid var(--card-line); background: var(--card-strong); color: var(--ink); font: inherit; font-size: 13px; padding: 0 10px; min-width: 0; box-sizing: border-box; }
.tg-msgs { flex: 1 1 auto; min-height: 140px; overflow: auto; display: flex; flex-direction: column; padding-right: 2px; overscroll-behavior: contain; }
.tg-msg { display: grid; grid-template-columns: 28px minmax(0, 1fr) 22px; gap: 0 9px; align-items: start; padding: 6px 0 2px; }
.tg-msg.cont { padding-top: 0; }
.tg-av { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: var(--hover); display: block; flex: none; }
.tg-av.big { width: 40px; height: 40px; } .tg-av.xs { width: 20px; height: 20px; }
.tg-av-none { background: var(--c); opacity: .85; }
.tg-mh { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; } .tg-mh b { font-weight: 500; font-size: 13px; }
.tg-time { font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.tg-msg p { margin: 1px 0 0; font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.tg-x { width: 22px; height: 22px; display: grid; place-items: center; border: 0; background: none; color: var(--ink-3); border-radius: 50%; opacity: 0; cursor: pointer; padding: 0; }
.tg-x .i { width: 13px; height: 13px; } .tg-msg:hover .tg-x, .tg-x:focus-visible { opacity: 1; } .tg-x:hover { background: var(--hover); color: var(--ink); }
.tg-empty { margin: auto 0; text-align: center; color: var(--ink-3); font-size: 13px; line-height: 1.45; padding: 18px 8px; text-wrap: balance; }
.tg-empty.sm { margin: 0; padding: 8px 0 2px; text-align: left; }
.tg-notes { border-top: 1px solid var(--card-line); padding-top: 8px; font-size: 13px; }
.tg-notes summary { cursor: pointer; color: var(--ink-2); list-style: none; display: flex; gap: 6px; align-items: center; }
.tg-notes summary::before { content: ""; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .2s; margin-right: 2px; }
.tg-notes[open] summary::before { transform: rotate(45deg); }
.tg-notes summary::-webkit-details-marker { display: none; }
#tgNotesList { display: grid; gap: 2px; margin-top: 6px; max-height: 150px; overflow: auto; }
.tg-nrow { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; text-align: left; border: 0; background: none; padding: 6px 4px; border-radius: 8px; color: var(--ink); font: inherit; cursor: pointer; align-items: start; }
.tg-nrow:hover { background: var(--hover); } .tg-nrow .i { width: 16px; height: 16px; color: var(--ink-3); margin-top: 2px; }
.tg-nrow b { font-weight: 400; font-size: 13px; display: block; overflow-wrap: anywhere; } .tg-nrow small { color: var(--ink-3); font-size: 11.5px; }
.tg-compose { display: grid; gap: 8px; }
#tg textarea { width: 100%; box-sizing: border-box; resize: none; border-radius: 12px; border: 1px solid var(--card-line); background: var(--card-strong); color: var(--ink); font: inherit; font-size: 14px; line-height: 1.4; padding: 9px 12px; max-height: 120px; display: block; }
#tg textarea:focus-visible, #tg input:focus-visible, #tg select:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
.tg-crow { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.tg-crow .btn, .tg-acts .btn, .tg-cfa .btn, .tg-gather .btn, .tg-new { height: 32px; padding: 0 12px; font-size: 13px; }
.tg-crow .btn .i, .tg-new .i, .tg-cfa .btn .i { width: 16px; height: 16px; }
.tg-ro { margin: 0; }
.tg-who { margin: 0; font-size: 11.5px; line-height: 1.4; color: var(--ink-2); }
.tg-sect { display: grid; gap: 4px; }
.tg-sect + .tg-sect { border-top: 1px solid var(--card-line); padding-top: 10px; }
.tg-sect h4 { margin: 0 0 2px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); font-weight: 500; display: flex; gap: 8px; align-items: center; }
.tg-num { font-variant-numeric: tabular-nums; letter-spacing: 0; color: var(--ink-2); }
.tg-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 4px 0; }
.tg-row .tg-av { width: 32px; height: 32px; box-shadow: 0 0 0 2px var(--card-strong), 0 0 0 4px var(--c, transparent); }
.tg-rm { min-width: 0; } .tg-rm b { display: block; font-weight: 500; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .tg-rm small { display: block; color: var(--ink-3); font-size: 12px; }
.tg-acts { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.tg-gather { gap: 8px; } .tg-gf { display: grid; gap: 8px; } .tg-gp { margin: 0; font-size: 13.5px; }
#tgGatherOn { display: grid; gap: 8px; justify-items: start; } #tgGatherOn[hidden] { display: none; }
.tg-intro { margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.45; }
.tg-new { justify-self: start; align-self: flex-start; }
.tg-post { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--card-line); border-radius: 12px; background: var(--hover); }
.tg-seg { display: inline-flex; padding: 2px; border-radius: 999px; background: var(--card-strong); border: 1px solid var(--card-line); justify-self: start; }
.tg-seg button, .tg-chips button { border: 0; background: none; font: inherit; font-size: 12.5px; padding: 5px 11px; border-radius: 999px; color: var(--ink-2); cursor: pointer; }
.tg-seg button[aria-pressed="true"] { background: var(--ink); color: var(--ground); }
.tg-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.tg-chips button { border: 1px solid var(--card-line); background: var(--card-strong); }
.tg-chips button[aria-pressed="true"] { background: var(--ink); color: var(--ground); border-color: transparent; }
.tg-posts { display: grid; gap: 8px; }
.tg-card { border: 1px solid var(--card-line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; background: var(--card-strong); }
.tg-ch { display: flex; gap: 8px; align-items: center; } .tg-ch .chip { height: 22px; font-size: 11.5px; }
.tg-cat { font-size: 12px; color: var(--ink-2); font-weight: 500; } .tg-ch time { margin-left: auto; }
.tg-card p { margin: 0; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
.tg-cf { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--ink-3); }
.tg-by { display: inline-flex; gap: 6px; align-items: center; color: var(--ink-2); }
.tg-in { display: inline-flex; gap: 6px; align-items: center; } .tg-in > .tg-av + .tg-av { margin-left: -10px; } .tg-in .tg-av { box-shadow: 0 0 0 2px var(--card-strong); }
.tg-cfa { display: flex; gap: 10px; align-items: center; justify-content: flex-end; }
.tg-cfa .btn.on { background: var(--done-bg); color: var(--done); border-color: transparent; }
.tg-link { border: 0; background: none; padding: 0; font: inherit; font-size: 12.5px; color: var(--ink-2); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.tg-link:hover { color: var(--ink); }
.tg-takers { display: flex; gap: 6px 8px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--ink-2); }
.tg-hid { flex-basis: 100%; font-size: 12.5px; color: var(--ink-3); }
.tg-tag { background: var(--card-strong); border: 1px solid var(--card-line); box-shadow: var(--shadow); color: var(--ink); font-size: 12px; padding: 3px 9px 3px 6px; pointer-events: none; }
.tg-tag i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); flex: none; }
.tg-tag.me { background: var(--ink); color: var(--ground); border-color: transparent; }
.tg-tag.far { padding: 3px; } .tg-tag.far span { display: none; }
.tg-say { position: absolute; left: 0; top: 0; max-width: 220px; width: max-content; padding: 6px 10px; border-radius: 12px 12px 12px 4px; background: var(--card-strong); border: 1px solid var(--card-line); box-shadow: var(--shadow);
  font-size: 12.5px; line-height: 1.35; color: var(--ink); pointer-events: none; overflow-wrap: anywhere; will-change: transform; }
.tg-call { position: fixed; left: 50%; transform: translateX(-50%); top: calc(76px + env(safe-area-inset-top, 0px)); z-index: 27; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 12px; border-radius: 999px; max-width: min(560px, calc(100% - 32px)); }
body.firemode .tg-call { top: calc(16px + env(safe-area-inset-top, 0px)); }
.tg-ci { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--now-bg); color: var(--now); flex: none; }
.tg-ct { display: grid; min-width: 0; } .tg-ct b { font-weight: 500; font-size: 13.5px; } .tg-ct small { font-size: 12px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tg-call .btn { height: 32px; padding: 0 12px; font-size: 13px; }
.tg-pop { position: fixed; z-index: 29; width: 260px; padding: 12px; display: grid; gap: 10px; }
.tg-pop .x { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; }
.tg-ph { display: flex; gap: 10px; align-items: center; padding-right: 26px; } .tg-ph b { display: block; font-weight: 500; font-size: 14px; } .tg-ph small { display: block; color: var(--ink-3); font-size: 12px; }
.tg-nb { margin: 0; font-family: var(--display); font-size: 16px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 200px; overflow: auto; }
.tg-pop .tg-acts { justify-content: flex-start; } .tg-pop .btn { height: 32px; padding: 0 12px; font-size: 13px; }
.tg-notice { position: fixed; z-index: 28; left: 50%; transform: translateX(-50%); bottom: calc(150px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 10px; align-items: center; padding: 8px 8px 8px 10px; border-radius: 999px; max-width: calc(100% - 32px); }
.tg-nt { display: grid; min-width: 0; } .tg-nt b { font-weight: 500; font-size: 13.5px; white-space: nowrap; } .tg-nt small { font-size: 12px; color: var(--ink-3); }
.tg-notice .btn { height: 32px; padding: 0 12px; font-size: 13px; } .tg-notice .x { width: 30px; height: 30px; }
@media (max-width: 960px) { #tg { max-height: calc(100% - 76px - 98px - env(safe-area-inset-top, 0px)); } }
@media (max-width: 760px) {
  #tg { left: 8px; right: auto; width: auto; max-width: calc(100% - 16px); top: calc(66px + env(safe-area-inset-top, 0px)); max-height: none; }
  body.inside #tg { top: calc(112px + env(safe-area-inset-top, 0px)); max-height: none; }
  body.firemode #tg { top: calc(10px + env(safe-area-inset-top, 0px)); width: auto; max-height: none; }
  body.firemode.tg-open .fire-card { left: 50%; width: min(780px, calc(100% - 32px)); }
  body.inside.tg-open .inwrap { left: 8px; }
  .tg-pill { height: 40px; } .tg-pt small { display: none; }
  .tg-panel { position: fixed; left: 0; right: 0; bottom: 0; height: min(74%, 600px); max-height: none; border-radius: 18px 18px 0 0; z-index: 31; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .tg-call { left: 8px; right: 8px; transform: none; max-width: none; top: calc(66px + env(safe-area-inset-top, 0px)); padding: 5px 5px 5px 8px; gap: 8px; }
  body.tg-calling .kpis { opacity: 0; pointer-events: none; }
  .tg-call .tg-ct small, .tg-call .tg-ci { display: none; } .tg-call .tg-ct b { font-size: 13px; line-height: 1.25; }
  body.firemode .tg-call { top: calc(58px + env(safe-area-inset-top, 0px)); }
  .tg-notice { left: 8px; right: 8px; transform: none; border-radius: 18px; flex-wrap: wrap; bottom: calc(46% + 8px); }
  .tg-msg p, #tg textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .tg-notes summary::before { transition: none; } }
`;
document.head.appendChild(css);
