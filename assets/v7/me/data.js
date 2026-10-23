/* Your data: what is yours in the Mahalaverse, to download or delete. Pure code (no DOM, no network) for the tests.

   Shared documents, one per person per collection, at <collection>/<uid>. The person may delete those whose rule lets
   them write their own (write: interact), except their applications: an application holds a place with the camp, so to
   withdraw one the person writes to the stewards. The documents only stewards write (giftsBy, confirm, answer, review
   notes, confirmed payments) are read for the download and left with the stewards. Private documents live under
   data/users/<uid>/. */

// the game's own collections (rules/base.json), the dashboard's (rules/me.json)
export const OWN = ['builders', 'fire', 'signups', 'chat', 'notes', 'board', 'claims', 'seen', 'sounds', 'shifts', 'avatars'];
export const KEPT_BY_STEWARDS = ['giftsBy', 'confirm', 'answer'];   // answer/<uid>: the camp's answers to your applications (co's rules)
export const ASK_A_STEWARD = ['signups'];          // yours to read and download; a steward removes or withdraws them
export const PRIVATE = ['me', 'gifts'];             // data/users/<uid>/me (the game), data/users/<uid>/gifts (the dashboard)
const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;

/* the per-person collections declared in the rules: every "<col>/{self}" path, with whether the person writes it.
   The patch passes in the merged rules at build time; with none, the lists above are used */
export function selfCollections(rules) {
  const own = new Set(OWN), lead = new Set(KEPT_BY_STEWARDS);
  for (const r of Array.isArray(rules) ? rules : []) {
    const p = String((r && r.path) || '');
    if (!p.endsWith('/{self}')) continue;
    const pre = p.slice(0, -7); if (!pre || pre.includes('/') || !SEG.test(pre) || pre === 'data') continue;   // nested prefixes are left to their plugin's own erase
    if (r.write === 'interact' || r.write === 'view' || !r.write) own.add(pre); else lead.add(pre);
  }
  for (const c of own) lead.delete(c);
  return { own: [...own], lead: [...lead] };
}
/* the paths: own (yours, read for the download), del (what Delete removes: yours, but not your applications),
   keep (yours, kept for the stewards), lead (written by stewards about you), priv (your private space) */
export function docPaths(uid, cols) {
  if (!uid || typeof uid !== 'string' || !SEG.test(uid)) return { own: [], del: [], keep: [], lead: [], priv: [] };
  const own = cols.own.map(c => c + '/' + uid);
  return { own, del: cols.own.filter(c => !ASK_A_STEWARD.includes(c)).map(c => c + '/' + uid), keep: cols.own.filter(c => ASK_A_STEWARD.includes(c)).map(c => c + '/' + uid),
    lead: cols.lead.map(c => c + '/' + uid), priv: PRIVATE.map(d => `data/users/${uid}/${d}`) };
}
export const bookCollection = uid => `data/users/${uid}/me/book`;

// keys this page keeps in the browser that are the person's (the game's, the together layer's, the dashboard's)
const KEY_RE = /^(mahala[._]|mv\.|v7[.-]me)/;
const KEEP = new Set(['mahala.sound']);
export function localKeys(keys) { return [...keys].filter(k => typeof k === 'string' && KEY_RE.test(k) && !KEEP.has(k)); }

// the game's own record of you, back to how it starts (the way you are at and the sound stay, as they are not about you)
export function freshMe(ME) {
  const keep = { way: ME.way, sound: ME.sound };
  const d = { v: 4, gate: 0, test: {}, door: null, name: '', show: false, contact: '', consent: false, crew: null, crewOk: false, from: null,
    quests: {}, done: {}, lines: 0, last: 0, newsSeen: 0, sound: false, visits: 0, week: [] };
  return Object.assign(d, Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)));
}

/* the download: everything that is yours, in one JSON file */
export function exportFile({ when, mode, uid, local, shared, priv, book, lead, hearth, parts }) {
  return {
    about: 'Your data from the Mahalaverse. It holds what you kept in this browser and, when you were signed in, what is stored with your account. Your book is private to you.',
    downloaded: new Date(when).toISOString(), mode, you: uid || null,
    inThisBrowser: local || {},
    shared: shared || {},
    private: priv || {},
    book: book || [],
    keptByTheStewards: lead || {},
    yourLinesAtTheFire: hearth || [],
    fromOtherParts: parts || {},
  };
}
