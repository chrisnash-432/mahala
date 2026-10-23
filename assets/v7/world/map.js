/* The map of the temples to come: a full-screen map of the world that rises from the playa at the eighth stop.
   Tankwa Town glows where it begins; Cape Town is the first permanent temple Mahala dreams of; the other places of the
   vision are faint seeds; soft arcs reach out from Tankwa; and the seeds visitors plant show as counts, never names.
   Everything shown that came from the store is a count or a place from the built-in list: no stored text reaches the page. */
import { PLACES, PLACE_BY, VISION, VISION_BY, project, search } from './places.js';
import { MAX_SEEDS, countLine, WHO_LINE, localLine, whyNot } from './seeds.js';

const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = { M: null, api: null, el: null, box: null, land: null, view: null, counts: new Map(), mine: { s: [] }, me: null, sel: null, unwatch: null, lastFocus: null, from: null, built: false };

const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (text != null) e.textContent = text; return e; };
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const icon = name => { const s = sv('svg', { class: 'i', 'aria-hidden': 'true' }); s.appendChild(sv('use', { href: '#i-' + name })); return s; };
const btn = (cls, label, ic, act) => { const b = el('button', { class: cls, type: 'button' }); if (ic) b.appendChild(icon(ic)); b.appendChild(document.createTextNode(label)); if (act) b.dataset.w7 = act; return b; };

/* ---------- the land, the sphere's outline and the graticule ---------- */
function outline(box) {
  const pts = [];
  for (let la = box.top; la >= box.bottom; la -= 2) pts.push(project(box, 180, la));
  pts.push(project(box, 180, box.bottom));
  for (let la = box.bottom; la <= box.top; la += 2) pts.push(project(box, -180, la));
  pts.push(project(box, -180, box.top));
  return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
}
function graticule(box) {
  let d = '';
  for (let lo = -150; lo <= 150; lo += 30) { const pts = []; for (let la = box.bottom; la <= box.top; la += 4) pts.push(project(box, lo, la)); d += 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'); }
  for (const la of [-30, 0, 30, 60]) { const a = project(box, -180, la), b = project(box, 180, la); d += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }
  return d;
}
// a soft arc from a to b, bowed towards the north, a little more for the long ones
function arcPath(a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; }
  const k = Math.min(0.42, 0.18 + L / 4000) * L;
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${(mx + nx * k).toFixed(1)} ${(my + ny * k).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

/* ---------- where it begins: Tankwa and Cape Town, enlarged in a circle over the Southern Ocean, just down and to the
   right of the real point (a leader and a dot mark where they really are, where the arcs meet) ---------- */
const INSET = { lon: 19.05, lat: -33.1, k: 6, at: [50, -48.5], r: 112 };
function insetXY(box, lon, lat) {
  const c = project(box, INSET.lon, INSET.lat), p = project(box, lon, lat), o = project(box, INSET.at[0], INSET.at[1]);
  return [o[0] + (p[0] - c[0]) * INSET.k, o[1] + (p[1] - c[1]) * INSET.k];
}
const inInset = (box, p) => { const q = insetXY(box, p.lon, p.lat), o = project(box, INSET.at[0], INSET.at[1]); return Math.hypot(q[0] - o[0], q[1] - o[1]) < INSET.r - 8; };

/* ---------- build the overlay once ---------- */
function build() {
  const box = S.box;
  const root = el('div', { class: 'modal v7-world-map', id: 'v7wMap', hidden: '' });
  const wrap = el('div', { class: 'v7-world-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'v7wTitle', 'aria-describedby': 'v7wIntro' });
  root.appendChild(wrap);
  // the head
  const head = el('header', { class: 'v7-world-head' });
  const ht = el('div', { class: 'v7-world-titles' });
  ht.append(el('p', { class: 'eyebrow v7-world-eye' }, 'A vision'), el('h2', { id: 'v7wTitle' }, 'The temples to come'),
    el('p', { id: 'v7wIntro', class: 'v7-world-intro' }, 'Imagine it: from one temple on the Tankwa playa, a network of temple builders around the world. Temple spaces open to all, intentional communities, gatherings and camps, grown by the people of Mahala and their friends.'));
  const close = btn('iconbtn x v7-world-close', '', 'x', 'close'); close.setAttribute('aria-label', 'Back to the playa'); close.title = 'Back to the playa';
  head.append(ht, close);
  // the map
  const body = el('div', { class: 'v7-world-body' });
  const stage = el('div', { class: 'v7-world-stage' });
  const svg = sv('svg', { class: 'v7-world-svg', viewBox: `0 0 ${box.w} ${box.h}`, preserveAspectRatio: 'xMidYMid meet', role: 'group', 'aria-label': 'A map of the world: the places of the vision, and the seeds visitors have planted' });
  const defs = sv('defs');
  defs.innerHTML = `<radialGradient id="v7wHalo"><stop offset="0" stop-color="var(--v7w-start)" stop-opacity=".9"/><stop offset=".35" stop-color="var(--v7w-start)" stop-opacity=".35"/><stop offset="1" stop-color="var(--v7w-start)" stop-opacity="0"/></radialGradient>
    <radialGradient id="v7wFirstHalo"><stop offset="0" stop-color="var(--v7w-first)" stop-opacity="1"/><stop offset=".3" stop-color="var(--v7w-first)" stop-opacity=".5"/><stop offset="1" stop-color="var(--v7w-first)" stop-opacity="0"/></radialGradient>
    <radialGradient id="v7wSeedHalo"><stop offset="0" stop-color="var(--v7w-seed)" stop-opacity=".55"/><stop offset="1" stop-color="var(--v7w-seed)" stop-opacity="0"/></radialGradient>
    <clipPath id="v7wInsetClip"><circle cx="0" cy="0" r="${INSET.r}"/></clipPath><clipPath id="v7wSphereClip"><path d="${outline(box)}"/></clipPath>`;
  svg.appendChild(defs);
  const world = sv('g', { class: 'v7-world-g' });
  world.appendChild(sv('path', { class: 'v7-world-sphere', d: outline(box) }));
  world.appendChild(sv('path', { class: 'v7-world-grat', d: graticule(box), 'vector-effect': 'non-scaling-stroke' }));
  const land = sv('path', { class: 'v7-world-land', id: 'v7wLand', d: S.land, 'clip-path': 'url(#v7wSphereClip)', 'vector-effect': 'non-scaling-stroke' });
  world.appendChild(land);
  // the arcs from Tankwa, each with a gradient from where it begins to where it reaches
  const T = PLACE_BY.tankwa, t0 = project(box, T.lon, T.lat), arcs = sv('g', { class: 'v7-world-arcs' });
  VISION.filter(v => v.id !== 'tankwa' && v.id !== 'cape-town').forEach((v, i) => {
    const p = PLACE_BY[v.id], b = project(box, p.lon, p.lat), id = 'v7wArc' + i;
    const g = sv('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: t0[0], y1: t0[1], x2: b[0], y2: b[1] });
    g.innerHTML = '<stop offset="0" stop-color="var(--v7w-start)" stop-opacity=".95"/><stop offset=".55" stop-color="var(--v7w-arc)" stop-opacity=".6"/><stop offset="1" stop-color="var(--v7w-arc)" stop-opacity=".25"/>';
    defs.appendChild(g);
    const d = arcPath(t0, b), path = sv('path', { class: 'v7-world-arc', d, stroke: `url(#${id})`, 'vector-effect': 'non-scaling-stroke', id: id + 'p' });
    path.style.setProperty('--v7w-i', i); arcs.appendChild(path);
  });
  world.appendChild(arcs);
  world.appendChild(sv('g', { class: 'v7-world-seeds' }));       // the seeds visitors planted
  world.appendChild(sv('g', { class: 'v7-world-marks' }));       // the places of the vision
  // the inset: where it begins
  const o = project(box, INSET.at[0], INSET.at[1]);
  const inset = sv('g', { class: 'v7-world-inset', transform: `translate(${o[0].toFixed(1)} ${o[1].toFixed(1)})` });
  // the leader: from the real point to the circle's edge, and a dot on the real point
  const ld = Math.hypot(t0[0] - o[0], t0[1] - o[1]) || 1, ex = (t0[0] - o[0]) / ld * INSET.r, ey = (t0[1] - o[1]) / ld * INSET.r;
  const lead = sv('g', { class: 'v7-world-leadg' });
  lead.append(sv('line', { class: 'v7-world-lead', x1: (t0[0] - o[0]).toFixed(1), y1: (t0[1] - o[1]).toFixed(1), x2: ex.toFixed(1), y2: ey.toFixed(1), 'vector-effect': 'non-scaling-stroke' }),
    sv('circle', { class: 'v7-world-leaddot', cx: (t0[0] - o[0]).toFixed(1), cy: (t0[1] - o[1]).toFixed(1), r: 4 }));
  const c = project(box, INSET.lon, INSET.lat);
  const zoomLand = sv('g', { 'clip-path': 'url(#v7wInsetClip)' });
  zoomLand.appendChild(sv('circle', { class: 'v7-world-inset-sea', r: INSET.r }));
  zoomLand.appendChild(sv('use', { href: '#v7wLand', class: 'v7-world-inset-land', transform: `scale(${INSET.k}) translate(${(-c[0]).toFixed(2)} ${(-c[1]).toFixed(2)})` }));
  inset.append(lead, zoomLand, sv('circle', { class: 'v7-world-inset-ring', r: INSET.r, 'vector-effect': 'non-scaling-stroke' }));
  const it = sv('text', { class: 'v7-world-inset-title', y: INSET.r + 26, 'text-anchor': 'middle' }); it.textContent = 'Where it begins'; inset.appendChild(it);
  inset.appendChild(sv('g', { class: 'v7-world-inset-seeds' }));
  inset.appendChild(sv('g', { class: 'v7-world-inset-marks' }));
  world.appendChild(inset);
  svg.appendChild(world);
  stage.appendChild(svg);
  const zoom = el('div', { class: 'v7-world-zoom' });
  const zin = btn('iconbtn', '', 'plus', 'zin'), zout = btn('iconbtn', '', 'minus', 'zout'), zall = btn('iconbtn', '', 'home', 'zall');
  zin.setAttribute('aria-label', 'Closer'); zout.setAttribute('aria-label', 'Further'); zall.setAttribute('aria-label', 'The whole world');
  zoom.append(zin, zout, zall); stage.appendChild(zoom);
  stage.appendChild(el('div', { class: 'v7-world-tip', 'aria-hidden': 'true', hidden: '' }));
  body.appendChild(stage);
  // the panel
  const panel = el('aside', { class: 'v7-world-panel', 'aria-label': 'Places and seeds' });
  panel.appendChild(el('div', { class: 'v7-world-card', id: 'v7wCard', 'aria-live': 'polite' }));
  const plant = el('section', { class: 'v7-world-plant', 'aria-labelledby': 'v7wPlantH' });
  plant.append(el('h3', { id: 'v7wPlantH' }, 'Plant a seed'));
  plant.append(el('p', { class: 'v7-world-note' }, 'Where would you love a temple space? Choose a place, then plant a seed there. Each person has three seeds.'));
  const fld = el('div', { class: 'field v7-world-field' });
  fld.append(el('label', { for: 'v7wQ' }, 'Find a place'));
  const q = el('input', { id: 'v7wQ', type: 'search', autocomplete: 'off', maxlength: '60', placeholder: 'A town, a city or a region', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'v7wRes' });
  fld.append(q); plant.append(fld);
  plant.append(el('ul', { class: 'v7-world-res', id: 'v7wRes', role: 'listbox', 'aria-label': 'Places', hidden: '' }));
  plant.append(el('div', { class: 'v7-world-mine', id: 'v7wMine' }));
  plant.append(el('p', { class: 'v7-world-note', id: 'v7wWho' }, WHO_LINE));
  panel.appendChild(plant);
  const list = el('section', { class: 'v7-world-list', 'aria-labelledby': 'v7wListH' });
  list.append(el('h3', { id: 'v7wListH' }, 'The places of the vision'));
  const ul = el('ul', { class: 'v7-world-vlist' });
  for (const v of VISION) { const p = PLACE_BY[v.id]; const li = el('li'); const b = el('button', { type: 'button', class: 'v7-world-vrow v7-world-r-' + v.role }); b.dataset.w7 = 'sel:' + v.id;
    const dot = el('span', { class: 'v7-world-dot', 'aria-hidden': 'true' }); const tx = el('span'); tx.append(el('b', null, p.name), el('small', null, v.eye));
    b.append(dot, tx); li.appendChild(b); ul.appendChild(li); }
  list.append(ul);
  list.append(el('p', { class: 'v7-world-note v7-world-strong' }, 'A vision, not a plan. Every place here is a hope, not an agreement, and AfrikaBurn chooses its own temple builders.'));
  panel.appendChild(list);
  panel.appendChild(el('p', { class: 'v7-world-live', id: 'v7wLive', 'aria-live': 'polite' }));
  body.appendChild(panel);
  wrap.append(head, body);
  document.body.appendChild(root);
  S.el = root; S.svg = svg; S.world = world; S.stage = stage;
  wire();
  S.built = true;
}

/* ---------- markers: the places of the vision, and the planted seeds ---------- */
function markerScale() { const r = S.svg.getBoundingClientRect(); const vb = S.svg.viewBox.baseVal; return r.width ? Math.max(vb.width / r.width, vb.height / r.height) : 1; }
function drawMarks() {
  const box = S.box, g = S.world.querySelector('.v7-world-marks'), gi = S.world.querySelector('.v7-world-inset-marks');
  g.replaceChildren(); gi.replaceChildren();
  for (const v of VISION) {
    const p = PLACE_BY[v.id], n = S.counts.get(v.id) || 0;
    const make = (xy, inset) => {
      const m = sv('g', { class: `v7-world-mark v7-world-r-${v.role}${S.sel === v.id ? ' sel' : ''}`, transform: `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`, tabindex: '0', role: 'button',
        'aria-label': `${p.name}, ${p.where}. ${v.eye}. ${countLine(n)}.` });
      m.dataset.place = v.id;
      const s = sv('g', { class: 'v7-world-s' });
      if (v.role === 'start') { s.appendChild(sv('circle', { class: 'v7-world-halo', r: 20 })); if (!REDUCED) s.appendChild(sv('circle', { class: 'v7-world-pulse', r: 8 })); s.appendChild(sv('circle', { class: 'v7-world-core', r: 5 })); }
      else if (v.role === 'first') { s.appendChild(sv('circle', { class: 'v7-world-fhalo', r: 34 })); s.appendChild(sv('circle', { class: 'v7-world-ring', r: 11 })); s.appendChild(sv('circle', { class: 'v7-world-core', r: 6 })); }
      else { s.appendChild(sv('circle', { class: 'v7-world-seedring', r: 6.5 })); s.appendChild(sv('circle', { class: 'v7-world-core', r: 2.2 })); }
      s.appendChild(sv('circle', { class: 'v7-world-hit', r: 16 }));
      const lab = sv('text', { class: 'v7-world-label', x: v.role === 'start' ? 14 : 11, y: 4 }); lab.textContent = p.name; s.appendChild(lab);
      if (inset && v.id === 'cape-town') { lab.setAttribute('x', 13); lab.setAttribute('y', 15); }
      if (!inset && v.id === 'waterval-boven') { lab.setAttribute('y', -8); }
      m.appendChild(s); return m;
    };
    if (v.id === 'tankwa' || v.id === 'cape-town') {
      // far out, the two are enlarged in the inset (and Tankwa keeps a glow where it really is); close in, they stand on the map itself
      const o = project(box, INSET.at[0], INSET.at[1]), q = insetXY(box, p.lon, p.lat); gi.appendChild(make([q[0] - o[0], q[1] - o[1]], true));
      if (v.id === 'tankwa') { const m = make(project(box, p.lon, p.lat), false); m.classList.add('v7-world-origin'); m.querySelector('.v7-world-label').remove(); m.setAttribute('aria-hidden', 'true'); m.removeAttribute('tabindex'); g.appendChild(m); }
      const near = make(project(box, p.lon, p.lat), false); near.classList.add('v7-world-close-sa');
      if (v.id === 'cape-town') { const l = near.querySelector('.v7-world-label'); l.setAttribute('x', -13); l.setAttribute('y', 14); l.setAttribute('text-anchor', 'end'); }
      g.appendChild(near);
    } else g.appendChild(make(project(box, p.lon, p.lat), false));
  }
  rescale();
}
function drawSeeds() {
  const box = S.box, g = S.world.querySelector('.v7-world-seeds'), gi = S.world.querySelector('.v7-world-inset-seeds'), o = project(box, INSET.at[0], INSET.at[1]);
  g.replaceChildren(); gi.replaceChildren();
  const mine = new Set(S.mine.s.map(x => x.p));
  for (const [id, n] of S.counts) {
    const p = PLACE_BY[id]; if (!p || !n) continue;
    const make = xy => { const r = 3 + Math.sqrt(n) * 1.6;
      const m = sv('g', { class: 'v7-world-seed' + (mine.has(id) ? ' mine' : '') + (S.sel === id ? ' sel' : ''), transform: `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`, tabindex: VISION_BY[id] ? '-1' : '0', role: 'button', 'aria-label': `${p.name}, ${p.where}. ${countLine(n)}.` });
      m.dataset.place = id;
      const s = sv('g', { class: 'v7-world-s' });
      s.append(sv('circle', { class: 'v7-world-shalo', r: r * 2.6 }), sv('circle', { class: 'v7-world-sdot', r }), sv('circle', { class: 'v7-world-hit', r: Math.max(12, r + 6) }));
      m.appendChild(s); return m; };
    if (inInset(box, p)) { const q = insetXY(box, p.lon, p.lat); gi.appendChild(make([q[0] - o[0], q[1] - o[1]])); }
    const main = make(project(box, p.lon, p.lat)); if (id === 'tankwa' || id === 'cape-town') main.classList.add('v7-world-close-sa'); g.appendChild(main);
  }
  // a chosen place that holds no seeds yet still shows where it is
  if (S.sel && !VISION_BY[S.sel] && !S.counts.get(S.sel)) { const p = PLACE_BY[S.sel]; const xy = project(box, p.lon, p.lat);
    const m = sv('g', { class: 'v7-world-seed v7-world-empty sel', transform: `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`, 'aria-hidden': 'true' });
    const s = sv('g', { class: 'v7-world-s' }); s.append(sv('circle', { class: 'v7-world-sdot', r: 4 })); m.appendChild(s); g.appendChild(m); }
  rescale();
}
// markers keep their size on screen at every zoom
function rescale() {
  const k = markerScale(), z = S.view ? S.view.z : 1;
  S.world.querySelectorAll('.v7-world-s').forEach(s => s.setAttribute('transform', `scale(${k.toFixed(4)})`));
  S.world.querySelectorAll('.v7-world-inset-title').forEach(t => t.setAttribute('font-size', (13 * k).toFixed(2)));
  S.world.classList.toggle('v7-world-near', z > 1.8);
}

/* ---------- the view: zoom and pan by changing the viewBox ---------- */
function setView(v, animate) {
  const box = S.box, r = S.stage.getBoundingClientRect(), asp = r.width ? r.height / r.width : box.h / box.w;
  v.z = Math.max(Math.min(1, fitZ()), Math.min(10, v.z));
  const w = box.w / v.z, h = w * asp;
  v.x = w >= box.w ? box.w / 2 : Math.max(w / 2 - box.w * 0.04, Math.min(box.w + box.w * 0.04 - w / 2, v.x));
  v.y = h >= box.h ? box.h / 2 : Math.max(h / 2, Math.min(box.h - h / 2, v.y));
  const to = { ...v };
  if (animate && !REDUCED && S.view) {
    const from = { ...S.view }, t0 = performance.now(), dur = 650; S.anim = t0;
    const step = now => { if (S.anim !== t0) return; const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      apply({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: Math.exp(Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * e) }); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  } else apply(to);
}
function apply(v) {
  const box = S.box, r = S.stage.getBoundingClientRect(), asp = r.width ? r.height / r.width : box.h / box.w;
  const w = box.w / v.z, h = w * asp; S.view = v;
  S.svg.setAttribute('viewBox', `${(v.x - w / 2).toFixed(2)} ${(v.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  rescale();
}
// the whole world contained in the map's own area, with a margin all round, and centred in it (it was drawn a little
// wider than its frame, so the Pacific was cut at the left edge)
function fitZ() {
  const box = S.box, r = S.stage.getBoundingClientRect(); if (!r.width || !r.height) return 1;
  const s = Math.min((r.width - 2 * 28) / box.w, (r.height - 2 * 20) / box.h);
  return Math.max(0.5, s * box.w / r.width);
}
function homeView() {
  const box = S.box, r = S.stage.getBoundingClientRect(), phone = r.width < 600;
  if (phone) { const t = project(box, 22, 6); return { x: t[0], y: t[1], z: 1.9 }; }
  return { x: box.w / 2, y: box.h / 2, z: fitZ() };
}

/* ---------- the card for the chosen place ---------- */
function canPlant() { return !!(S.local || (S.me && S.me.canWrite)); }
function renderCard() {
  const card = S.el.querySelector('#v7wCard'); card.replaceChildren();
  const id = S.sel, p = id && PLACE_BY[id];
  if (!p) {
    card.append(el('p', { class: 'eyebrow' }, 'Choose a place'), el('p', { class: 'v7-world-note' }, `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} a place on the map, or find one below, to see how many seeds it holds.`));
    return;
  }
  const v = VISION_BY[id], n = S.counts.get(id) || 0, mine = S.mine.s.find(x => x.p === id);
  card.append(el('p', { class: 'eyebrow' }, v ? v.eye : 'A place for a seed'), el('h3', null, p.name), el('p', { class: 'v7-world-where' }, p.where));
  if (v) card.append(el('p', null, v.line));
  card.append(el('p', { class: 'v7-world-count' + (n ? '' : ' none') }, countLine(n) + (n ? '.' : '')));
  const acts = el('div', { class: 'actions' });
  if (mine) { acts.append(el('span', { class: 'chip done' }, 'One of your seeds is here')); acts.append(btn('btn', 'Take it back', 'x', 'unplant:' + mine.i)); }
  else if (canPlant() && S.mine.s.length < MAX_SEEDS) acts.append(btn('btn primary', 'Plant a seed here', 'seed', 'plant:' + id));
  else if (canPlant()) card.append(el('p', { class: 'v7-world-note' }, 'You have planted all three of your seeds. Take one back to plant it somewhere else.'));
  if (acts.childNodes.length) card.append(acts);
}
function renderMine() {
  const box = S.el.querySelector('#v7wMine'), who = S.el.querySelector('#v7wWho'); box.replaceChildren();
  const s = S.mine.s, me = S.me || {};
  who.textContent = S.local ? localLine(S.api.mode) : WHO_LINE;
  if (!canPlant()) {
    box.append(el('p', { class: 'v7-world-note v7-world-strong' }, whyNot({ mode: S.api.mode, local: false, id: me.id, canWrite: false })));
    if (S.api.mode === 'standalone' && !me.id && S.api.signIn) { const b = btn('btn', 'Sign in', 'users', 'signin'); box.append(b); }
    return;
  }
  box.append(el('h4', { class: 'eyebrow' }, `Seeds you planted · ${s.length} of ${MAX_SEEDS}`));
  if (!s.length) { box.append(el('p', { class: 'mv-empty v7-world-none' }, 'None planted yet.')); return; }
  const ul = el('ul', { class: 'v7-world-minelist' });
  for (const x of s) { const p = PLACE_BY[x.p]; const li = el('li'); const go = el('button', { type: 'button', class: 'v7-world-minego' }); go.dataset.w7 = 'sel:' + x.p;
    go.append(icon('seed'), el('b', null, p.name), el('small', null, p.where)); const rm = btn('iconbtn', '', 'x', 'unplant:' + x.i); rm.setAttribute('aria-label', `Take back your seed near ${p.name}`);
    li.append(go, rm); ul.appendChild(li); }
  box.append(ul);
}
// with no shared store, the only seeds on the map are the ones kept in this browser
const localCounts = () => new Map(S.mine.s.map(x => [x.p, 1]));
function cardFocus() { const c = S.el.querySelector('#v7wCard'), b = c.querySelector('button') || c.querySelector('h3'); if (b) { if (!b.matches('button')) b.setAttribute('tabindex', '-1'); try { b.focus({ preventScroll: true }); } catch (e) { } } }
function say(t) { const l = S.el.querySelector('#v7wLive'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); }

function focusMark(id) {
  const near = S.world.classList.contains('v7-world-near'), sa = id === 'tankwa' || id === 'cape-town';
  const sel = sa ? (near ? `.v7-world-marks .v7-world-close-sa[data-place="${id}"]` : `.v7-world-inset-marks [data-place="${id}"]`) : `[data-place="${id}"][tabindex="0"]`;
  const t = S.world.querySelector(sel); if (t) try { t.focus({ preventScroll: true }); } catch (e) { }
}
function select(id, fly = true) {
  if (!PLACE_BY[id]) return; const a = document.activeElement, onMark = !!(a && a.closest && S.world.contains(a) && a.closest('[data-place]'));
  S.sel = id; renderCard(); drawMarks(); drawSeeds(); if (onMark) focusMark(id);
  if (fly) { const p = PLACE_BY[id], xy = (id === 'tankwa' || id === 'cape-town') && S.view.z <= 1.8 ? null : project(S.box, p.lon, p.lat);
    if (xy) setView({ x: xy[0], y: xy[1], z: Math.max(S.view.z, 2.2) }, true); }
  const tip = S.stage.querySelector('.v7-world-tip'); tip.hidden = true;
}

const ERR = { twice: 'You already planted a seed there.', full: 'You have planted all three of your seeds. Take one back to plant it somewhere else.',
  nolocal: 'This browser cannot keep seeds just now.', 'full-store': 'The map cannot take more seeds just now. Try again later.', failed: 'That did not work. Try again in a moment.', unknown: 'That place is not on the map.' };
// an error in words: "readonly" and "signin" say why by where the page runs, as the panel does
const errText = k => k === 'readonly' || k === 'signin' ? whyNot({ mode: S.api.mode, local: false, id: k === 'signin' ? null : (S.me && S.me.id), canWrite: false }) : ERR[k] || ERR.failed;
async function doPlant(id) {
  const p = PLACE_BY[id]; if (!p) return;
  const r = await S.api.plant(id);
  if (r.error) { if (r.error === 'readonly') S.me = Object.assign({}, S.me, { canWrite: false }); const m = errText(r.error); say(m); S.M.toast && S.M.toast(m); renderCard(); renderMine(); return; }
  S.mine = r.doc; if (S.local) S.counts = localCounts(); else S.counts.set(id, (S.counts.get(id) || 0) + (S.countsLive ? 0 : 1));
  const inCard = S.el.querySelector('#v7wCard').contains(document.activeElement); renderCard(); renderMine(); drawSeeds(); if (inCard) cardFocus();
  const m = S.world.querySelector(`.v7-world-seed[data-place="${id}"]`); if (m && !REDUCED) { m.classList.add('grow'); setTimeout(() => m.classList.remove('grow'), 1400); }
  const t = `Your seed is planted near ${p.name}.`; say(t); S.M.toast && S.M.toast(t); S.M.v7 && S.M.v7.chime && S.M.v7.chime('soft');
}
async function doUnplant(i) {
  const x = S.mine.s.find(y => y.i === i); const r = await S.api.unplant(i);
  if (r.error) { say(errText(r.error)); return; }
  S.mine = r.doc; if (x && !S.countsLive) S.counts.set(x.p, Math.max(0, (S.counts.get(x.p) || 0) - 1)); if (S.local) S.counts = localCounts();
  const inPanel = S.el.querySelector('.v7-world-panel').contains(document.activeElement); renderCard(); renderMine(); drawSeeds(); if (inPanel) cardFocus();
  if (x) say(`You took back your seed near ${PLACE_BY[x.p].name}.`);
}

/* ---------- the search box: a list of places to choose from ---------- */
function renderResults() {
  const q = S.el.querySelector('#v7wQ'), ul = S.el.querySelector('#v7wRes'), list = search(q.value, PLACES, 7);
  ul.replaceChildren(); S.resI = -1;
  if (!q.value.trim()) { ul.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
  if (!list.length) { const li = el('li', { class: 'v7-world-nores', role: 'option', 'aria-disabled': 'true' }, 'No place by that name on the map yet. Try the nearest town or city.'); ul.appendChild(li); }
  list.forEach((p, k) => { const li = el('li', { role: 'option', id: 'v7wR' + k, 'aria-selected': 'false' }); li.dataset.place = p.id; const n = S.counts.get(p.id) || 0;
    li.append(el('b', null, p.name), el('small', null, p.where + (n ? ' · ' + (n === 1 ? '1 seed' : n + ' seeds') : ''))); ul.appendChild(li); });
  ul.hidden = false; q.setAttribute('aria-expanded', 'true');
}
function pickResult(id) { const q = S.el.querySelector('#v7wQ'); q.value = ''; renderResults(); select(id); const b = S.el.querySelector('#v7wCard [data-w7^="plant:"]'); (b || S.el.querySelector('#v7wCard h3') || q).focus && setTimeout(() => (b || q).focus(), 30); }

/* ---------- the wiring ---------- */
function wire() {
  const root = S.el, svg = S.svg, stage = S.stage, tip = stage.querySelector('.v7-world-tip');
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-w7]'); if (!b) return; const [k, x] = b.dataset.w7.split(':');
    if (k === 'close') close();
    if (k === 'zin') setView({ ...S.view, z: S.view.z * 1.6 }, true);
    if (k === 'zout') setView({ ...S.view, z: S.view.z / 1.6 }, true);
    if (k === 'zall') setView(homeView(), true);
    if (k === 'sel') select(x);
    if (k === 'plant') doPlant(x);
    if (k === 'unplant') doUnplant(x);
    if (k === 'signin' && S.api.signIn) S.api.signIn();
  });
  // the markers: click, Enter or Space
  const markOf = t => t.closest && t.closest('[data-place]');
  svg.addEventListener('click', e => { if (S.drag && S.drag.moved) return; const m = markOf(e.target); if (m && m.getAttribute('aria-hidden') !== 'true') select(m.dataset.place, false); else if (m) select('tankwa', false); });
  svg.addEventListener('keydown', e => { const m = markOf(e.target); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(m.dataset.place, false); } });
  svg.addEventListener('pointermove', e => { if (S.drag) return; const m = markOf(e.target); if (!m) { tip.hidden = true; return; } const p = PLACE_BY[m.dataset.place], n = S.counts.get(p.id) || 0;
    tip.textContent = n ? `${p.name} · ${n === 1 ? '1 seed' : n + ' seeds'}` : p.name; const r = stage.getBoundingClientRect(); tip.style.transform = `translate(${e.clientX - r.left + 12}px, ${e.clientY - r.top - 30}px)`; tip.hidden = false; });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  // focus shows the same label as hover, for the keyboard
  svg.addEventListener('focusin', e => { const m = markOf(e.target); if (!m) return; const p = PLACE_BY[m.dataset.place], r = m.getBoundingClientRect(), sr = stage.getBoundingClientRect(); tip.textContent = p.name; tip.style.transform = `translate(${r.right - sr.left + 4}px, ${r.top - sr.top - 26}px)`; tip.hidden = false; });
  svg.addEventListener('focusout', () => { tip.hidden = true; });
  // drag to pan, wheel and pinch to zoom
  const pts = new Map();
  svg.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) S.drag = { x: e.clientX, y: e.clientY, v: { ...S.view }, moved: false }; if (pts.size === 2) { const [a, b] = [...pts.values()]; S.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), v: { ...S.view } }; } });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = stage.getBoundingClientRect(), upp = (S.box.w / S.view.z) / r.width;
    if (pts.size === 2 && S.pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); setView({ ...S.pinch.v, z: Math.max(1, Math.min(10, S.pinch.v.z * d / (S.pinch.d || 1))) }); if (S.drag) S.drag.moved = true; return; }
    if (!S.drag) return; const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
    if (!S.drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!S.drag.moved) { S.drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (er) { } }
    const u = (S.box.w / S.drag.v.z) / r.width; setView({ x: S.drag.v.x - dx * u, y: S.drag.v.y - dy * u, z: S.drag.v.z }); void upp;
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) S.pinch = null; if (!pts.size) setTimeout(() => { S.drag = null; }, 0); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(), k = Math.exp(-e.deltaY * 0.0015), v = S.view;
    const w = S.box.w / v.z, h = w * (r.height / r.width), mx = v.x - w / 2 + (e.clientX - r.left) / r.width * w, my = v.y - h / 2 + (e.clientY - r.top) / r.height * h;
    const z = Math.max(1, Math.min(10, v.z * k)), f = v.z / z; setView({ x: mx + (v.x - mx) * f, y: my + (v.y - my) * f, z }); }, { passive: false });
  // the search box
  const q = root.querySelector('#v7wQ'), res = root.querySelector('#v7wRes');
  q.addEventListener('input', renderResults);
  q.addEventListener('keydown', e => {
    const items = [...res.querySelectorAll('[data-place]')]; if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); S.resI = (S.resI + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, k) => li.setAttribute('aria-selected', String(k === S.resI))); q.setAttribute('aria-activedescendant', items[S.resI].id); items[S.resI].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); const it = items[Math.max(0, S.resI)]; if (it) pickResult(it.dataset.place); }
  });
  res.addEventListener('click', e => { const li = e.target.closest('[data-place]'); if (li) pickResult(li.dataset.place); });
  // Escape closes the map before anything else hears it
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.el && !S.el.hidden) { e.stopImmediatePropagation(); e.preventDefault(); const qq = root.querySelector('#v7wQ'); if (document.activeElement === qq && qq.value) { qq.value = ''; renderResults(); return; } close(); } }, true);
  addEventListener('resize', () => { if (S.el && !S.el.hidden && S.view) apply(S.view); });
}

/* ---------- open and close ---------- */
export async function open(M, api, from) {
  S.M = M; S.api = api; S.from = from || null;
  if (!S.land) { try { const L = await import('./land.js'); S.land = L.LAND; S.box = L.BOX; } catch (e) { M.toast && M.toast('The map of the temples to come did not open. Try again in a moment.'); return; } }
  if (!S.built) build();
  const already = !!(S.el && !S.el.hidden && S.el.classList.contains('on')); clearTimeout(S.hideT);
  if (!already) S.lastFocus = document.activeElement;
  const W7 = M.v7 && M.v7.W7; if (W7 && W7.rise && !already) try { W7.rise(); } catch (e) { }
  // the world keeps drawing while the map fades in over it (the camera rises), then rests behind it
  clearTimeout(S.restT); S.restT = setTimeout(() => { if (W7 && S.el && !S.el.hidden) W7.mapOpen = true; }, REDUCED ? 0 : 750);
  S.el.hidden = false; document.body.classList.add('v7-world-on');
  void S.el.offsetWidth; S.el.classList.add('on');
  S.view = null; apply(homeView());
  S.me = await api.me().catch(() => ({ canWrite: false }));
  S.local = await api.local().catch(() => false);
  S.mine = await api.mine().catch(() => ({ s: [] }));
  if (!S.sel) S.sel = null;
  renderCard(); renderMine(); drawMarks(); drawSeeds();
  if (S.unwatch) S.unwatch();
  S.unwatch = api.watch(counts => { S.counts = counts; S.countsLive = !S.local; drawSeeds(); drawMarks(); renderCard(); if (S.el.querySelector('#v7wQ').value) renderResults(); });
  setTimeout(() => { const c = S.el.querySelector('.v7-world-close'); c && c.focus(); }, 60);
  if (M.v7 && M.v7.chime) try { M.v7.chime('soft'); } catch (e) { }
}
export function close() {
  if (!S.el || S.el.hidden) return;
  S.el.classList.remove('on'); document.body.classList.remove('v7-world-on');
  const W7 = S.M && S.M.v7 && S.M.v7.W7; clearTimeout(S.restT); if (W7) { W7.mapOpen = false; if (W7.settle) try { W7.settle(); } catch (e) { } }
  if (S.unwatch) { S.unwatch(); S.unwatch = null; }
  clearTimeout(S.hideT); S.hideT = setTimeout(() => { S.el.hidden = true; }, REDUCED ? 0 : 420);
  if (S.lastFocus && document.contains(S.lastFocus)) try { S.lastFocus.focus(); } catch (e) { }
}
export const state = () => ({ open: !!(S.el && !S.el.hidden), sel: S.sel, view: S.view, counts: Object.fromEntries(S.counts), mine: S.mine, me: S.me });
export { select as selectPlace, INSET };
