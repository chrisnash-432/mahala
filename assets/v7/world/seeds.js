/* Seeds on the map of the temples to come: the pure logic, shared by the plugin and its tests.
   A person's seeds live in one document, places/<uid> = { s: [{ i, t, p }] }: at most MAX_SEEDS, one per place,
   i a short id, t the time it was planted, and p a place key, only ever a key from the built-in list (places.js).
   Everything read from the store is untrusted: cleanDoc() keeps only what fits that shape. */
export const MAX_SEEDS = 3;
const ID_OK = /^[a-z0-9]{1,24}$/;

// a person's document, cleaned: known places only, no repeats, the newest MAX_SEEDS kept, oldest first
export function cleanDoc(doc, byId) {
  const raw = doc && Array.isArray(doc.s) ? doc.s : [];
  const seen = new Set(), out = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const p = typeof x.p === 'string' ? x.p : '', i = typeof x.i === 'string' ? x.i : '', t = Number(x.t);
    if (!Object.prototype.hasOwnProperty.call(byId, p) || seen.has(p) || !ID_OK.test(i) || !Number.isFinite(t)) continue;
    seen.add(p); out.push({ i, t, p });
  }
  out.sort((a, b) => a.t - b.t);
  return { s: out.slice(-MAX_SEEDS) };
}

// how many people would love a temple near each place: one count per person per place
export function countPlaces(docs, byId) {
  const n = new Map();
  for (const d of docs || []) for (const x of cleanDoc(d, byId).s) n.set(x.p, (n.get(x.p) || 0) + 1);
  return n;
}

// plant a seed: a new document, or an error the interface can say in words
export function plant(doc, p, byId, now = Date.now()) {
  const cur = cleanDoc(doc, byId).s;
  if (!Object.prototype.hasOwnProperty.call(byId, p)) return { error: 'unknown' };
  if (cur.some(x => x.p === p)) return { error: 'twice' };
  if (cur.length >= MAX_SEEDS) return { error: 'full' };
  const i = (now.toString(36) + Math.floor(Math.random() * 1296).toString(36)).slice(-12);
  return { doc: { s: cur.concat([{ i, t: now, p }]) } };
}

export function unplant(doc, i, byId) { return { s: cleanDoc(doc, byId).s.filter(x => x.i !== i) }; }

export function countLine(n) {
  n = Math.max(0, Math.floor(+n || 0));
  if (!n) return 'No seeds here yet';
  return n === 1 ? '1 person would love a temple near here' : `${n.toLocaleString('en-US')} people would love a temple near here`;
}

/* the words for who can plant, the same on the map and in Your path. mode is the platform's: 'claude' (the claude.ai
   link), 'standalone' (Mahala's own site) or 'solo' (a saved copy of the page) */
export const CAMP_MAIL = 'wearemahala@gmail.com';      // the camp's own address, shown as text, never a mailto link
export const WHO_LINE = 'The map shows how many seeds each place holds, not who planted them.';
// with no shared store, seeds stay in this browser: why, by where the page runs
export function localLine(mode) {
  return mode === 'solo' ? 'Kept in this browser only: this copy of the Mahalaverse is not connected to the shared map.'
    : 'Seeds you plant here stay in this browser: this link is not connected to the shared map.';
}
// why this person cannot plant a seed here, in words; null when they can
export function whyNot({ mode, local, id, canWrite }) {
  if (local || (id && canWrite)) return null;
  if (mode === 'standalone' && !id) return 'Sign in to plant a seed.';
  return `You can look around ${mode === 'claude' ? 'from this link' : 'here'}, but not plant seeds yet. To take part, write to the camp at ${CAMP_MAIL}.`;
}
