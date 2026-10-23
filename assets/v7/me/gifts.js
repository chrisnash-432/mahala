/* Gifts for what you give. Badges, artifacts and pieces for your figure mark contributions, building and giving.
   Nothing here scores, counts up, ranks or tracks completion: a gift is either received or not yet, and once received it
   stays yours (until you delete your data, or a steward takes back one they gave by hand). Quests are never looked at.
   Pure code (no DOM, no network), so the node tests can run it.

   A gift rule: { id, title, kind: 'badge'|'artifact'|'outfit', icon, why, test(state) -> bool,
                  unlocks?: ['slot:piece', ...],   pieces for your figure that come with it
                  piece?: 'slot:piece',            an outfit gift is itself one piece
                  fallback?: [pattern, ...] }      the dashboard's own rule steps aside when another plugin's rules match
                                                   a pattern ('id' or 'prefix-*'; the first pattern that matches is used),
                                                   and its pieces come with those rules instead
   title and why may be functions of the state (the archetype card names the card you kept).
   The gift state is CONTRACT.md section 6; other plugins fill their parts through ctx.giftState. */

export const KIND_LABEL = { badge: 'Badge', artifact: 'Artefact', outfit: 'For your figure' };   // the kind's code name stays 'artifact' (CONTRACT section 3)
const n0 = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
const c0 = (s, k) => n0(s && s.contrib && s.contrib[k]);

export function emptyState() {
  return { me: null, card: null, crew: null, crewOk: false, crewConfirmed: false, shifts: [], sounds: 0, setsApproved: 0, hearth: 0,
    contrib: { journey: 0, poem: 0, story: 0, art: 0, set: 0, sound: 0 }, ideas: 0, ideasBuilt: 0, pledges: 0, paid: 0, paidGates: [], seeds: 0,
    visits: 0, quests: {}, applied: false };
}
/* fold a partial state from another plugin into the state: numbers keep the larger (a provider counts its own things;
   the larger never double counts), booleans stay true once true, objects merge key by key, arrays join */
export function mergeState(base, part, depth = 0) {
  if (!part || typeof part !== 'object' || depth > 4) return base;
  for (const [k, v] of Object.entries(part)) {
    if (k === 'me' || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const b = base[k];
    if (typeof v === 'number') { if (isFinite(v)) base[k] = Math.max(typeof b === 'number' ? b : 0, v); }
    else if (typeof v === 'boolean') base[k] = !!b || v;
    else if (Array.isArray(v)) base[k] = Array.isArray(b) ? [...new Set([...b, ...v])].slice(0, 400) : v.slice(0, 400);
    else if (v && typeof v === 'object') base[k] = mergeState(b && typeof b === 'object' && !Array.isArray(b) ? b : {}, v, depth + 1);
    else if (b === undefined && typeof v === 'string') base[k] = v.slice(0, 200);
  }
  return base;
}

/* ---------- reading what you gave, from the game's own state ---------- */
const SHIFT_RE = /^(mon|tue|wed|thu|fri|sat|sun)-d$/;
export const cleanShifts = s => (Array.isArray(s) ? [...new Set(s.filter(k => typeof k === 'string' && SHIFT_RE.test(k)))] : []);
// the words you offered to the fire: a line, or the first line of a reflection or poem you kept and offered
const norm = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
export function offeredLines(book) {
  const out = new Set();
  for (const e of Array.isArray(book) ? book : []) {
    if (!e || !e.fire || typeof e.text !== 'string') continue;
    const line = e.kind === 'line' ? e.text : (e.text.split('\n').map(s => s.trim()).filter(Boolean)[0] || e.text);
    const t = norm(line.slice(0, 160)); if (t) out.add(t);
  }
  return out;
}
// the lines at the fire that are yours: kept under your id (hearth/<uid>~<item>, as the stewards' tools keep them, or marked
// with it), or the words you offered, read there
export const ownerOf = id => { const s = String(id || ''), j = s.lastIndexOf('~'); return j > 0 ? s.slice(0, j) : ''; };
export function isMyLine(h, uid, mine) {
  if (!h || typeof h !== 'object') return false;
  if (uid && (h.uid === uid || h.owner === uid || ownerOf(h.id) === uid)) return true;
  return !!(typeof h.text === 'string' && h.text && mine.has(norm(h.text)));
}
export function hearthByMe(hearth, uid, book) {
  const mine = offeredLines(book); let n = 0;
  for (const h of Array.isArray(hearth) ? hearth : []) if (isMyLine(h, uid, mine)) n++;
  return n;
}
// an application is a request to the camp (yes or maybe) or to the build; choosing a gate or "not now" is not one
export function appliedFrom(signup, ME) {
  if (signup && typeof signup === 'object' && ((signup.d_camp && typeof signup.d_camp === 'object') || (signup.d_build && typeof signup.d_build === 'object'))) return true;
  return !!(ME && (ME.door === 'camp' || ME.door === 'build' || ME.maybe));
}

/* ---------- the gifts the dashboard gives by itself ---------- */
export const CARD_WHY = 'For the card you kept from the Mahala deck. Not your horoscope: a way we have of seeing each other, and we feel this force is very strong in you.';
export function builtInGifts({ crews = [], cardTitle = k => k } = {}) {
  return [
    { id: 'me-card', kind: 'artifact', icon: 'star', title: s => (s && s.card ? cardTitle(s.card) : 'Your archetype card'), why: CARD_WHY, test: s => !!s.card },
    { id: 'me-onway', kind: 'badge', icon: 'path', tone: 'sky', title: 'On the way', why: 'For sending your application to the camp or the build.', test: s => !!s.applied },
    { id: 'me-fireside', kind: 'badge', icon: 'flame', tone: 'fire', title: 'Fireside voice', unlocks: ['head:crown'],
      why: 'For words of yours read at the fire, welcomed there by a steward.',
      test: s => n0(s.hearth) > 0 || c0(s, 'poem') + c0(s, 'story') + c0(s, 'journey') > 0 },
    { id: 'me-kitchen', kind: 'badge', icon: 'users', tone: 'sun', title: 'Kitchen heart', why: 'For cooking a dinner for the camp.', test: s => Array.isArray(s.shifts) && s.shifts.length > 0 },
    // a set or playlist a steward said yes to (co's setsApproved, or its count of approved sets): sharing one is not enough,
    // and a recording for the Lotus Mahal is not music in the main tent
    { id: 'me-sound', kind: 'badge', icon: 'sound', tone: 'protea', title: 'Sound weaver', unlocks: ['held:drum'], why: 'For music you shared, heard in the main tent.',
      test: s => n0(s.setsApproved) > 0 || c0(s, 'set') > 0 },
    // joining a crew is instant in the game (crewOk); the badge waits for a steward's welcome (crewConfirmed)
    ...crews.map(c => ({ id: 'me-crew-' + c.id, kind: 'badge', icon: 'tools', tone: 'copper', title: `${c.name} builder`, crew: c.id, unlocks: c.build ? ['head:circlet'] : [],
      why: `For joining the ${c.name}, welcomed by a steward.`, test: s => s.crew === c.id && !!s.crewConfirmed })),
    // the pay plugin gives its own gift for a confirmed payment; when it is here, the lantern comes with that and this one
    // steps aside (pay's "A gift to The Seed", or, in its first drafts, a badge for each gate)
    { id: 'me-gatekeeper', kind: 'badge', icon: 'gate', tone: 'bush', title: 'Gatekeeper', unlocks: ['held:lantern'], fallback: ['pay-giver', 'pay-gatekeeper-*'],
      why: 'For a confirmed gift through one of the gates.', test: s => n0(s.paid) > 0 || (Array.isArray(s.paidGates) && s.paidGates.length > 0) },
    { id: 'me-brush', kind: 'outfit', icon: 'pen', tone: 'sky', title: 'A paintbrush', piece: 'held:brush', why: 'For art you shared, welcomed by a steward.', test: s => c0(s, 'art') > 0 },
  ];
}
// how each gift piece for the figure is received, warmly and without hurry
export const PIECE_HOW = {
  'head:crown': 'The flower crown comes with Fireside voice, when words of yours are read at the fire.',
  'head:circlet': 'The copper circlet comes when a steward welcomes you onto a build crew: the Frame, Glass, Petal or Temple Tech crew.',
  'held:lantern': 'The lantern comes with a gift through one of the gates, once it is confirmed.',
  'held:drum': 'The hand drum comes with Sound weaver, when a steward approves a set or a playlist you shared for the main tent.',
  'held:brush': 'The paintbrush comes when a steward welcomes art you shared.',
};
// the same, in a few words, under each piece in the avatar maker
export const PIECE_WITH = { 'head:crown': 'With Fireside voice', 'head:circlet': 'With a build crew', 'held:lantern': 'With a gate gift',
  'held:drum': 'With Sound weaver', 'held:brush': 'With art you share' };

/* the medallion's tone: every gift is a ring and a tint in one of the house tones. The three colours of The Seed (the
   conic ring) are kept for the gifts tied to The Seed: pay's gift for a confirmed payment and its gate badges, and the
   dashboard's own Gatekeeper where pay is not here. A gift without a tone of its own takes one from what it is for */
export const TONES = ['sun', 'fire', 'sky', 'protea', 'copper', 'bush'];
const TONE_BY_ID = { 'seed-carrier': 'bush', 'co-creator': 'copper' };
export const isSeedGift = id => typeof id === 'string' && (id === 'me-gatekeeper' || id === 'pay-giver' || /^pay-gate(keeper)?-/.test(id));
export function toneOf(v) {
  const id = v && typeof v === 'object' ? (typeof v.rule === 'string' ? v.rule : v.id) : null;
  if (isSeedGift(id)) return 'seed';
  if (TONES.includes(v && v.tone)) return v.tone;
  if (Object.prototype.hasOwnProperty.call(TONE_BY_ID, id)) return TONE_BY_ID[id];
  return v && (v.kind === 'artifact' || v.hand) ? 'copper' : 'sky';
}
export const titleOf = (rule, state) => { try { const t = typeof rule.title === 'function' ? rule.title(state) : rule.title; return String(t || 'A gift').replace(/\s+/g, ' ').trim().slice(0, 80) || 'A gift'; } catch (e) { return 'A gift'; } };
export const whyOf = (rule, state) => { try { const t = typeof rule.why === 'function' ? rule.why(state) : rule.why; return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 240); } catch (e) { return ''; } };
export const KINDS = new Set(['badge', 'artifact', 'outfit']);
const ID_RE = /^[A-Za-z0-9_.:~+-]{1,64}$/;
const PIECE_RE = /^(head|shoulders|held):[a-z-]{1,12}$/;
const matches = (fb, id) => (fb.endsWith('*') ? id.startsWith(fb.slice(0, -1)) : id === fb);
/* the full set of rules: the dashboard's own, then the other plugins'. A piece that another plugin's gift should bring (the
   lantern with pay's gift for a confirmed payment) comes with that gift when it is here; the dashboard's own rule is then
   left out, so one gift to The Seed brings one gift here, not two. Their rule objects are never changed (copies carry the extra piece) */
export function allRules(own, others) {
  const theirs = usableRules(others), out = [];
  for (const r of own) {
    const pats = (Array.isArray(r.fallback) ? r.fallback : [r.fallback]).filter(x => typeof x === 'string' && x);
    let hit = [];
    for (const fb of pats) { hit = theirs.map((x, i) => (matches(fb, x.id) ? i : -1)).filter(i => i >= 0); if (hit.length) break; }
    if (!hit.length) { out.push(r); continue; }
    const extra = [...(r.unlocks || []), ...(r.piece ? [r.piece] : [])];
    for (const i of hit) theirs[i] = Object.assign({}, theirs[i], { unlocks: [...new Set([...(theirs[i].unlocks || []), ...extra])] });
  }
  return usableRules([...out, ...theirs]);
}
// rules from other plugins are checked once: a usable id, a kind, a test; the first rule with an id wins; pieces are names
export function usableRules(list) {
  const seen = new Set(), out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r !== 'object' || typeof r.test !== 'function' || !ID_RE.test(String(r.id || '')) || seen.has(r.id)) continue;
    seen.add(r.id);
    const u = Array.isArray(r.unlocks) ? r.unlocks.filter(p => typeof p === 'string' && PIECE_RE.test(p)) : [];
    out.push(Object.assign({}, r, { kind: KINDS.has(r.kind) ? r.kind : 'badge', unlocks: u, piece: typeof r.piece === 'string' && PIECE_RE.test(r.piece) ? r.piece : undefined }));
  }
  return out;
}
/* evaluate(rules, state, got, now): which rules hold now that were not received before.
   got = { <id>: { t, s?, k? } } (t: received, s: seen in the dashboard, k: the card, for the archetype card)
   returns { got, fresh: [ids] }; never removes a gift */
const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
export function evaluate(rules, state, got, now = Date.now()) {
  const out = Object.assign({}, got || {}), fresh = [];
  const seen = freeze(JSON.parse(JSON.stringify(state || {})));    // each rule reads the same state, and cannot change it for the next
  for (const r of rules) {
    let ok = false; try { ok = !!r.test(seen); } catch (e) { ok = false; }
    if (!ok) continue;
    if (!out[r.id]) { out[r.id] = { t: now }; fresh.push(r.id); }
    if (r.id === 'me-card' && state.card && out[r.id].k !== state.card) out[r.id] = Object.assign({}, out[r.id], { k: state.card });
  }
  return { got: out, fresh };
}
// the hand-given gifts a steward wrote at giftsBy/<uid>: { g: [{ i, gift?, title?, why, t, by }] }, cleaned
export function cleanHand(doc, catalogue) {
  const ids = new Set((catalogue || []).map(r => r.id)), out = [];
  const arr = doc && typeof doc === 'object' && Array.isArray(doc.g) ? doc.g : [];
  for (const x of arr.slice(-24)) {
    if (!x || typeof x !== 'object' || !ID_RE.test(String(x.i || ''))) continue;
    const gift = typeof x.gift === 'string' && ids.has(x.gift) ? x.gift : null;
    const title = typeof x.title === 'string' ? x.title.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (!gift && !title) continue;
    out.push({ i: String(x.i), gift, title, why: typeof x.why === 'string' ? x.why.replace(/\s+/g, ' ').trim().slice(0, 160) : '', t: typeof x.t === 'number' && isFinite(x.t) ? x.t : 0 });
  }
  return out;
}
// the pieces for the figure that are yours: the free ones, and those your gifts brought
export function unlocked(rules, got, hand, free) {
  const s = new Set(free || []); const has = new Set(Object.keys(got || {}));
  for (const h of hand || []) if (h.gift) has.add(h.gift);
  for (const r of rules) {
    if (!has.has(r.id)) continue;
    for (const p of Array.isArray(r.unlocks) ? r.unlocks : []) s.add(p);
    if (r.kind === 'outfit' && typeof r.piece === 'string') s.add(r.piece);
  }
  return s;
}
// which gift brings a piece (for the maker's note): the first rule that unlocks it
export const giftForPiece = (rules, piece) => rules.find(r => (Array.isArray(r.unlocks) && r.unlocks.includes(piece)) || r.piece === piece) || null;
// the pieces a gift brings, for its story
export const piecesOf = r => (r ? [...new Set([...(Array.isArray(r.unlocks) ? r.unlocks : []), ...(r.kind === 'outfit' && r.piece ? [r.piece] : [])])] : []);
