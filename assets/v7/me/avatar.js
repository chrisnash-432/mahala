/* The figure each builder walks the playa as: its colour, what it wears on its head and shoulders, what it holds, and the
   emblem of the archetype card it kept. Pure code (no network, no DOM of its own), so the node tests can run it. The
   dashboard draws the portrait from portraitSpec() with DOM APIs (toSvg); the world draws the same pieces as meshes in
   assets/together.js, from the same names.

   Stored at avatars/<uid> (everyone reads, each writes their own) as { c, head, shoulders, held, emblem, t }:
     c          a colour from PALETTE, or null for the colour the platform gives the person
     head       none | hat | scarf | crown | circlet
     shoulders  none | sash-y | sash-c | sash-m | cloak | shawl
     held       none | lantern | staff | drum | brush
     emblem     none | the key of an archetype card (the card the person kept)
     t          when it was last changed (ms)
   Everything read from the store is untrusted: cleanAvatar() checks every field against these lists, so an unknown piece
   becomes none, a colour outside the palette becomes null, and any other field is dropped. (The first drafts called held
   "hand"; cleanAvatar still reads that.) */

// a small palette that reads by day and glows at night (the figures light up in their own colour after dark)
export const PALETTE = [
  ['sun', 'Yellow', '#E8B90C'], ['amber', 'Amber', '#E0862A'], ['copper', 'Copper', '#B87333'], ['clay', 'Clay red', '#B0413E'],
  ['protea', 'Magenta', '#D8197F'], ['violet', 'Violet', '#7E57C2'], ['sky', 'Cyan', '#14A8E0'], ['teal', 'Sea teal', '#2F8F8B'],
  ['bush', 'Bush green', '#4E8A4A'], ['pearl', 'Pearl', '#E6DFD2'],
];
const HEXES = new Set(PALETTE.map(p => p[2].toLowerCase()));
export const DEFAULT_COLOUR = '#E8B90C';

export const SLOTS = [
  { id: 'head', name: 'On your head', pieces: [['none', 'Nothing'], ['hat', 'Wide hat'], ['scarf', 'Desert scarf'], ['crown', 'Flower crown'], ['circlet', 'Copper circlet']] },
  { id: 'shoulders', name: 'On your shoulders', pieces: [['none', 'Nothing'], ['sash-y', 'Yellow sash'], ['sash-c', 'Cyan sash'], ['sash-m', 'Magenta sash'], ['cloak', 'Cloak'], ['shawl', 'Shawl']] },
  { id: 'held', name: 'In your hands', pieces: [['none', 'Nothing'], ['lantern', 'Lantern'], ['staff', 'Staff'], ['drum', 'Hand drum'], ['brush', 'Paintbrush']] },
];
export const SLOT_BY = Object.fromEntries(SLOTS.map(s => [s.id, s]));
export const PIECE_NAME = Object.fromEntries(SLOTS.flatMap(s => s.pieces.map(([k, n]) => [s.id + ':' + k, n])));
// what everyone may wear from the start: the playa basics. The other pieces are gifts (gifts.js says which brings which)
export const FREE = new Set(['head:none', 'head:hat', 'head:scarf', 'shoulders:none', 'shoulders:sash-y', 'shoulders:sash-c', 'shoulders:sash-m',
  'shoulders:cloak', 'shoulders:shawl', 'held:none', 'held:staff']);

/* the emblems of the eleven cards of the Mahala deck: a brass medallion in the card's own colour, with a sign drawn in a
   20 by 20 box (g: the sign's shapes, cream on the colour; i: lines drawn in the colour over the sign) */
export const CARDS = {
  alchemist: { c: '#E0862A', g: '<path d="M8 3h4v5l4.6 7.4A1.6 1.6 0 0 1 15.2 18H4.8a1.6 1.6 0 0 1-1.4-2.6L8 8z"/>' },
  conductor: { c: '#C99A00', g: '<circle cx="10" cy="10" r="4.2"/><path d="M10 1.2v3M10 15.8v3M1.2 10h3M15.8 10h3M3.8 3.8l2.1 2.1M14.1 14.1l2.1 2.1M3.8 16.2l2.1-2.1M14.1 5.9l2.1-2.1" fill="none" stroke="#FFF6DF" stroke-width="1.9" stroke-linecap="round"/>' },
  entertainer: { c: '#D8197F', g: '<path d="M10 1.8l2.5 5.3 5.8.7-4.3 4 1.2 5.7L10 14.6l-5.2 2.9L6 11.8 1.7 7.8l5.8-.7z"/>' },
  guardian: { c: '#3962A3', g: '<path d="M10 1.8l7.2 2.7v5.3c0 4.4-3 7.4-7.2 8.8-4.2-1.4-7.2-4.4-7.2-8.8V4.5z"/>' },
  magician: { c: '#7E57C2', g: '<path d="M10 1.4l2 6.6 6.6 2-6.6 2-2 6.6-2-6.6-6.6-2 6.6-2z"/>' },
  muse: { c: '#C94E8E', g: '<circle cx="10" cy="5" r="3.4"/><circle cx="14.8" cy="8.5" r="3.4"/><circle cx="13" cy="14.1" r="3.4"/><circle cx="7" cy="14.1" r="3.4"/><circle cx="5.2" cy="8.5" r="3.4"/>', i: '<circle cx="10" cy="10" r="2.5"/>' },
  mother: { c: '#B0413E', g: '<path d="M10 17.6S2.4 13 2.4 7.5A4.1 4.1 0 0 1 10 5.3a4.1 4.1 0 0 1 7.6 2.2c0 5.5-7.6 10.1-7.6 10.1z"/>' },
  sage: { c: '#4E8A4A', g: '<path d="M1.8 4.8c2.9-1 5.8-.7 8.2 1 2.4-1.7 5.3-2 8.2-1v11.4c-2.9-1-5.8-.7-8.2 1-2.4-1.7-5.3-2-8.2-1z"/>', i: '<path d="M10 6.2v10.6" fill="none" stroke-width="1.2"/>' },
  seeker: { c: '#14A8E0', g: '<circle cx="10" cy="10" r="7.6" fill="none" stroke="#FFF6DF" stroke-width="1.7"/><path d="M10 3.4l2.4 6.6L10 16.6 7.6 10z"/>' },
  trickster: { c: '#4A3F3A', g: '<path d="M10 1.8l6.2 8.2-6.2 8.2-6.2-8.2z"/>' },
  wildone: { c: '#2F8F8B', g: '<path d="M3.2 16.8C3.2 9 8.4 3.3 17.2 2.8c0 8.8-5.7 14-14 14z"/>', i: '<path d="M4.4 15.6L13 7.2" fill="none" stroke-width="1.3" stroke-linecap="round"/>' },
};
export const CARD_KEYS = Object.keys(CARDS);
const isCard = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(CARDS, k);

export const blankAvatar = () => ({ c: null, head: 'none', shoulders: 'none', held: 'none', emblem: 'none', t: 0 });
export function cleanColour(c) { return typeof c === 'string' && c.length === 7 && HEXES.has(c.toLowerCase()) ? c.toUpperCase() : null; }
export function cleanAvatar(raw) {
  const a = blankAvatar(); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return a;
  a.c = cleanColour(raw.c);
  for (const s of SLOTS) {
    let v = raw[s.id]; if (v === undefined && s.id === 'held') v = raw.hand;           // the first drafts' name for it
    if (typeof v === 'string' && v.length <= 16 && s.pieces.some(p => p[0] === v)) a[s.id] = v;
  }
  if (isCard(raw.emblem)) a.emblem = raw.emblem;
  a.t = typeof raw.t === 'number' && isFinite(raw.t) && raw.t > 0 ? Math.floor(raw.t) : 0;
  return a;
}
/* the emblem is worn only for the card its wearer keeps: your own card (the game's DKX.kept), or for another builder the
   card the world shows as theirs (builders/<uid>.card). A stored emblem for any other card, or with no card kept, is not
   drawn (the document itself is left as it is: on a new device the card comes back a moment later) */
export function wornWith(a, card) {
  a = cleanAvatar(a);
  if (a.emblem !== 'none' && a.emblem !== card) a.emblem = 'none';
  return a;
}
const LOOK = ['c', 'head', 'shoulders', 'held', 'emblem'];
export const sameAvatar = (a, b) => !!a && !!b && LOOK.every(k => a[k] === b[k]);
export const isBlank = a => !a || (!a.c && SLOTS.every(s => a[s.id] === 'none') && a.emblem === 'none');
// the slots whose piece the person has not been given (they come off when that is so)
export const notGiven = (a, unlocked) => SLOTS.filter(s => a[s.id] !== 'none' && !FREE.has(s.id + ':' + a[s.id]) && !unlocked.has(s.id + ':' + a[s.id])).map(s => s.id);

/* ---------- colour arithmetic, in sRGB: close to what the world shows ---------- */
const hx = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0xE8B90C; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export const lighten = (h, k) => toHex(hx(h).map(v => v + (255 - v) * k));
export const darken = (h, k) => toHex(hx(h).map(v => v * k));
export const colourName = h => (PALETTE.find(p => p[2].toLowerCase() === String(h || '').toLowerCase()) || [0, ''])[1];
export function safeHex(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toUpperCase() : DEFAULT_COLOUR; }

/* ---------- the words for a figure, for screen readers and labels ---------- */
export const andList = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
export function describe(a, { own = 'your own colour', cardTitle = () => '' } = {}) {
  a = cleanAvatar(a);
  const c = a.c ? colourName(a.c).toLowerCase() : own;
  const parts = SLOTS.map(s => a[s.id] !== 'none' ? 'a ' + PIECE_NAME[s.id + ':' + a[s.id]].toLowerCase() : null).filter(Boolean);   // every piece name takes "a"
  if (a.emblem !== 'none') { const t = cardTitle(a.emblem); parts.push(t ? 'the emblem of ' + t : 'the emblem of a card'); }
  return `A figure in ${c}${parts.length ? ', with ' + andList(parts) : ''}.`;
}

/* ---------- the portrait: the same figure as the one on the playa, as a tree of SVG nodes ----------
   A node is [tag, attributes, ...children]. The art below is written as markup for reading, and parsed once into nodes
   (it is constant, and the parser reads only self-closing tags). Every value drawn is a constant, a palette colour or a
   number, and the dashboard builds the elements with createElementNS and setAttribute (toSvg), never with innerHTML. */
const TAG_RE = /<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"<>]*")*)\s*\/>/g, ATTR_RE = /([a-zA-Z:-]+)="([^"<>]*)"/g;
export function parseArt(s) {
  const out = [];
  for (const m of String(s).matchAll(TAG_RE)) { const at = {}; for (const x of m[2].matchAll(ATTR_RE)) at[x[1]] = x[2]; out.push([m[1], at]); }
  return out;
}
const ART = {
  'head:hat': '<ellipse cx="50" cy="24.5" rx="21" ry="4.4" fill="#CFA867"/><path d="M41 24.5Q40.6 11 50 11Q59.4 11 59 24.5Z" fill="#C49A55"/><rect x="40.8" y="19.4" width="18.4" height="3.3" rx="1" fill="#6B3F2A"/><ellipse cx="50" cy="24.5" rx="21" ry="4.4" fill="none" stroke="#A9843F" stroke-width=".7"/>',
  'head:scarf': '<path d="M38.2 35Q50 45.5 61.8 35L63 41.6Q50 52.5 37 41.6Z" fill="#C98B6B"/><path d="M57.5 41Q63.6 52 60.4 67L54.4 65.2Q57.2 53 53 43Z" fill="#B47657"/><path d="M38.6 38.4Q50 47.4 61.4 38.4" fill="none" stroke="#A86A4C" stroke-width=".8"/>',
  'head:crown': '<path d="M38.4 25.6Q50 15 61.6 25.6" fill="none" stroke="#4E7A3A" stroke-width="2.4" stroke-linecap="round"/>' +
    [[39.6, 24.8, 3.1, '#D8197F'], [44.6, 20.1, 3.4, '#F2A3C7'], [50, 18.4, 3.7, '#FFD81F'], [55.4, 20.1, 3.4, '#F2A3C7'], [60.4, 24.8, 3.1, '#D8197F']]
      .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${(r * 0.32).toFixed(2)}" fill="#FFF3C4"/>`).join(''),
  'head:circlet': '<path d="M39 25.8Q50 31.6 61 25.8" fill="none" stroke="#8A4F22" stroke-width="3.6" stroke-linecap="round"/><path d="M39 25.8Q50 31.6 61 25.8" fill="none" stroke="#C8844A" stroke-width="2.3" stroke-linecap="round"/><circle cx="50" cy="28.9" r="3.1" fill="#D99A5B" stroke="#8A4F22" stroke-width=".9"/>',
  'shoulders:cloak': '<path d="M33 44Q50 37.5 67 44L79.5 137Q50 145 20.5 137Z" fill="#3B3F8C"/><path d="M36 46Q50 41 64 46L71 133Q50 139 29 133Z" fill="#2F3374"/>',
  'shoulders:cloak-front': '<circle cx="50" cy="42.6" r="2.1" fill="#CA973F"/>',
  'shoulders:shawl': '<path d="M29.4 46.4Q50 35.6 70.6 46.4L76.4 66Q50 79 23.6 66Z" fill="#C77A2E"/><path d="M24.6 64.6Q50 77.4 75.4 64.6" fill="none" stroke="#9E5A1C" stroke-width="1"/>' +
    [28, 34, 40, 46, 52, 58, 64, 70].map((x, i) => `<path d="M${x} ${(66.6 + Math.sin(i / 7 * Math.PI) * 5.4).toFixed(1)}v3.2" stroke="#9E5A1C" stroke-width=".9" stroke-linecap="round"/>`).join(''),
  'held:lantern': '<circle cx="71.5" cy="102" r="10" fill="#FFC870" opacity=".33"/><path d="M67 93Q71.5 86.6 76 93" fill="none" stroke="#3A3633" stroke-width="1.4"/><path d="M65.4 95.6L71.5 90.6L77.6 95.6Z" fill="#3A3633"/><rect x="66.4" y="95.4" width="10.2" height="12" rx="1.6" fill="#FFD98A" stroke="#3A3633" stroke-width="1.3"/><path d="M71.5 96v11" stroke="#3A3633" stroke-width=".8"/><rect x="65.8" y="106.8" width="11.4" height="2.2" rx=".8" fill="#3A3633"/>',
  'held:staff': '<path d="M24.4 20.5L27.2 153" stroke="#8A5A3B" stroke-width="3.1" stroke-linecap="round"/><circle cx="24.3" cy="19.4" r="3.7" fill="#6B4426"/><path d="M24.6 27Q19.4 31 21.2 37" fill="none" stroke="#D8197F" stroke-width="1.6" stroke-linecap="round"/>',
  'held:drum': '<path d="M64.4 92.6Q74 90.4 83.6 92.6L80 104.6Q78.2 110.4 79.4 117H68.6Q69.8 110.4 68 104.6Z" fill="#9B5E34"/><path d="M65.6 95.4L69.2 103.4L72.8 95.4L76.4 103.4L80 95.4" fill="none" stroke="#E9DCC4" stroke-width=".9"/><rect x="68.4" y="115.2" width="11.2" height="2.4" rx="1" fill="#6B4426"/><ellipse cx="74" cy="92.6" rx="9.8" ry="2.7" fill="#E9DCC4" stroke="#7A4826" stroke-width=".8"/>',
  'held:brush': '<path d="M26.6 113L33.4 83.6" stroke="#8A5A3B" stroke-width="2.3" stroke-linecap="round"/><path d="M32.8 86.2L34.2 80.4" stroke="#B9B4AC" stroke-width="2.7"/><path d="M34.3 80.6Q32.6 74.6 36.4 71.2Q38.4 76.4 35.8 80.9Z" fill="#D8197F"/>',
};
const NODES = Object.fromEntries(Object.entries(ART).map(([k, s]) => [k, parseArt(s)]));
const SIGN = Object.fromEntries(CARD_KEYS.map(k => {
  const fill = n => [n[0], Object.assign({ fill: '#FFF6DF' }, n[1])];
  const line = n => [n[0], Object.assign({ fill: CARDS[k].c, stroke: CARDS[k].c }, n[1])];
  return [k, [...parseArt(CARDS[k].g).map(fill), ...parseArt(CARDS[k].i || '').map(line)]];
}));
const SASH = { 'sash-y': '#FFD81F', 'sash-c': '#14A8E0', 'sash-m': '#D8197F' };
export const SVGNS = 'http://www.w3.org/2000/svg';
// the medallion on the chest (beside the sash, which runs the other way), on top of a shawl or a cloak's clasp
export function emblemNodes(key, x = 58.2, y = 56.4, r = 5.8) {
  if (!isCard(key)) return [];
  const k = (r - 1.25) * 2 / 20 * 0.86, o = (r - 1.25) * 0.86;
  return [['circle', { cx: x, cy: y + 0.5, r: r + 0.4, fill: '#000', opacity: '.16' }], ['circle', { cx: x, cy: y, r, fill: '#C9A35B' }],
    ['circle', { cx: x, cy: y, r: r - 1.25, fill: CARDS[key].c }], ['g', { transform: `translate(${(x - o).toFixed(2)} ${(y - o).toFixed(2)}) scale(${k.toFixed(3)})` }, ...SIGN[key]]];
}
/* portraitSpec(a, opts): the figure as SVG nodes.
   opts.colour   the colour to draw when a.c is null (the person's own colour), #rrggbb
   opts.crop     'full' (default), 'top' (the top bar), or a slot: head, shoulders, held, emblem (the tiles of the avatar maker)
   opts.label    an accessible name; without one the SVG is hidden from screen readers */
const CROP = { full: '0 0 100 160', top: '27 7 46 46', top2: '22 4 56 56', head: '20 3 60 60', shoulders: '12 30 76 76', held: '8 66 84 84', emblem: '31 37 46 46' };
let uid = 0;
export function portraitSpec(a, opts = {}) {
  a = cleanAvatar(a);
  const c = safeHex(a.c || opts.colour), light = lighten(c, 0.42), dark = darken(c, 0.5), cp = 'v7me-b' + (++uid);
  const crop = CROP[opts.crop] ? opts.crop : 'full';
  const box = CROP[crop === 'top' && (a.head === 'hat' || a.head === 'crown') ? 'top2' : crop];
  const sh = a.shoulders, kids = [['defs', {}, ['clipPath', { id: cp }, ['rect', { x: 35, y: 40, width: 30, height: 66, rx: 15 }]]]];
  if (crop === 'full') kids.push(['ellipse', { cx: 50, cy: 153, rx: 23, ry: 4, fill: '#000', opacity: '.13' }]);
  if (sh === 'cloak') kids.push(...NODES['shoulders:cloak']);
  kids.push(['rect', { x: 37.8, y: 97, width: 11, height: 56, rx: 5.5, fill: dark }], ['rect', { x: 51.2, y: 97, width: 11, height: 56, rx: 5.5, fill: dark }]);
  kids.push(['rect', { x: 35, y: 40, width: 30, height: 66, rx: 15, fill: c }]);
  if (SASH[sh]) kids.push(['g', { 'clip-path': `url(#${cp})` }, ['path', { d: 'M33 45.5L40.6 39.6L68.4 88.4L60.8 94.4Z', fill: SASH[sh] }], ['path', { d: 'M40.6 39.6L68.4 88.4', stroke: 'rgba(0,0,0,.14)', 'stroke-width': '.8' }]]);
  kids.push(['rect', { x: 25.6, y: 51.5, width: 8.4, height: 45, rx: 4.2, fill: c, transform: 'rotate(7 29.8 52)' }], ['rect', { x: 66, y: 51.5, width: 8.4, height: 45, rx: 4.2, fill: c, transform: 'rotate(-7 70.2 52)' }]);
  if (sh === 'shawl') kids.push(...NODES['shoulders:shawl']);
  kids.push(['circle', { cx: 50, cy: 30, r: 11.2, fill: light }]);
  if (sh === 'cloak') kids.push(...NODES['shoulders:cloak-front']);
  if (a.emblem !== 'none') kids.push(...emblemNodes(a.emblem));
  if (a.head !== 'none') kids.push(...NODES['head:' + a.head]);
  if (a.held !== 'none') kids.push(...NODES['held:' + a.held]);
  const attrs = { viewBox: box, xmlns: SVGNS };
  if (opts.label) { attrs.role = 'img'; attrs['aria-label'] = String(opts.label).slice(0, 240); } else { attrs['aria-hidden'] = 'true'; attrs.focusable = 'false'; }
  return ['svg', attrs, ...kids];
}
// a medallion on its own (the emblem in the avatar maker and in your gifts), as SVG nodes
export function medallionSpec(key, opts = {}) {
  const attrs = { viewBox: '0 0 20 20', xmlns: SVGNS, 'aria-hidden': 'true', focusable: 'false' };
  return ['svg', attrs, ...emblemNodes(key, 10, 10, opts.r || 9.2)];
}
/* a piece on its own, for the gift that brings it (in Your path and its toast): the piece's own glyph, framed close in a
   square box around it, never a whole figure */
const GLYPH = { 'head:hat': '26.5 -3.5 47 47', 'head:scarf': '31.5 32.5 37 37', 'head:crown': '35.5 6.8 29 29', 'head:circlet': '35.5 13.5 29 29',
  'shoulders:sash-y': '20.7 37 60 60', 'shoulders:sash-c': '20.7 37 60 60', 'shoulders:sash-m': '20.7 37 60 60', 'shoulders:cloak': '-4 37 108 108',
  'shoulders:shawl': '21 28 58 58', 'held:lantern': '57 84.8 29 29', 'held:staff': '9 13 32 32', 'held:drum': '58.5 88.2 31 31', 'held:brush': '13.5 74.1 36 36' };
export function pieceSpec(piece) {
  if (typeof piece !== 'string' || !Object.prototype.hasOwnProperty.call(GLYPH, piece)) return null;
  const k = piece.split(':')[1];
  const kids = SASH[k] ? [['path', { d: 'M33 45.5L40.6 39.6L68.4 88.4L60.8 94.4Z', fill: SASH[k] }]]
    : piece === 'shoulders:cloak' ? [...NODES['shoulders:cloak'], ...NODES['shoulders:cloak-front']]
    : piece === 'held:brush' ? [['g', { transform: 'rotate(32 31.5 92.1)' }, ...NODES[piece]]] : NODES[piece] || [];   // the brush leans, to fill its circle
  return ['svg', { viewBox: GLYPH[piece], xmlns: SVGNS, 'aria-hidden': 'true', focusable: 'false' }, ...kids];
}
/* the nodes as elements, with DOM APIs (doc is the page's document) */
export function toSvg(doc, node) {
  const [tag, attrs, ...kids] = node, el = doc.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (k !== 'xmlns') el.setAttribute(k, String(v));
  for (const c of kids) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : toSvg(doc, c));
  return el;
}
/* the nodes as markup, for the node tests and the art sheet only (the page never uses it) */
const escA = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function toMarkup(node) {
  if (typeof node === 'string') return escA(node);
  const [tag, attrs, ...kids] = node;
  return `<${tag}${Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${escA(v)}"`).join('')}>${kids.map(toMarkup).join('')}</${tag}>`;
}
