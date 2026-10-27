import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const icon = (id, cls = 'i') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HOOK7 = { openPath: null, raised: null, signup: [], cardIn: [], act: [] };   // v7: where plugins step in (see patch_v7_host.py)

/* ---------- days to the burn ---------- */
const burn = new Date(2027, 3, 26);
const today = new Date(); today.setHours(0, 0, 0, 0);
const days = Math.max(0, Math.round((burn - today) / 86400000));
$('#kpiDays').textContent = days; $('#siteDays').textContent = days;

/* ---------- v6: the way. One winding path across the playa, from the Book of Mahala in the east to the door of The Seed.
   Every place and every gate stands beside it, in the order you meet them. Side 1 is on your right as you walk, -1 on your left. ---------- */
const WAY_PTS = [[212, -16], [198, -5], [184, 9], [168, 15], [152, 9], [138, -3], [124, -14], [108, -18], [92, -12], [80, -1], [70, 9], [58, 13], [47, 8], [37, 2], [27, 0], [18, 0], [9.5, 0]];
const WAYC = new THREE.CatmullRomCurve3(WAY_PTS.map(([x, z]) => V3(x, 0, z)), false, 'centripetal'); WAYC.arcLengthDivisions = 2000;
const WAY_LEN = WAYC.getLength();
const wayP = s => WAYC.getPointAt(clamp(s / WAY_LEN, 0, 1)), wayT = s => WAYC.getTangentAt(clamp(s / WAY_LEN, 0, 1));
const wayN = s => { const t = wayT(s); return V3(-t.z, 0, t.x); };
const beside = (s, off, side = 1) => wayP(s).addScaledVector(wayN(s), side * off);
const faceWay = (p, s) => { const d = wayP(s).sub(p); return Math.atan2(d.x, d.z); };          // turns local +z at p towards the way at s
const WAY_S = Array.from({ length: Math.floor(WAY_LEN) + 1 }, (_, i) => wayP(i));                 // the way, a point every metre
const nearestS = p => { let best = 0, bd = Infinity; WAY_S.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
const ST = { book: 2.5, portal: 26, gate1: 41, drift: 57, gate2: 75, mahal: 94, gate3: 113, flag: 117, kitchen: 128, camp: 131, sail: 134, gate4: 163, yard: 184,
  gate5: WAY_LEN - 31, gate6: WAY_LEN - 22, gate7: WAY_LEN - 13 };
const CAMP = beside(ST.mahal, 11.5, -1), YARD = beside(ST.yard, 16.5, -1);       // CAMP is the centre of the Lotus Mahal, as it always was
const YARD_RY = (() => { const d = wayP(ST.yard).sub(YARD); return Math.atan2(-d.x, -d.z); })();   // the yard's long side runs along the way, its container side towards it
const YARD_M = new THREE.Matrix4().makeRotationY(YARD_RY).setPosition(YARD);
const YL = (x, y, z) => V3(x, y, z).applyMatrix4(YARD_M);

/* ---------- the one data object (the portal's lists will fill this later) ---------- */
const DATA = {
  quests: [
    { id: 'Q-01', name: 'Fund a ring of glass', crew: 'Glass crew', stage: 'Fund', where: 'RING_E', tone: 'm', pin: V3(-7, 9, -5),
      goal: 'Each ring of the zome is one colour of cast acrylic. Help fund the sheets for one ring.',
      steps: ['Choose a gate that suits you', 'Share the film with three people', 'See your ring glow on the night'], skills: 'None needed', open: true },
    { id: 'Q-02', name: 'Cut the crown star', crew: 'Frame crew', stage: 'Fabricate', where: 'YARD_CNC', tone: 'y', pin: V3(YARD.x + 7, 6, YARD.z - 2),
      goal: 'The top two rings of the frame stay open timber: a star of sky at the crown. Cut and test-fit the first crown timbers.',
      steps: ['Learn the cut list for the crown', 'Cut a test set on the CNC', 'Dry-fit one bay of the crown'], skills: 'CNC, carpentry' },
    { id: 'Q-03', name: 'Paint the Golden Seed of Life', crew: 'Site crew', stage: 'Build at Tankwa', where: 'FLOOR_GRID', tone: 'c', pin: V3(-15, 5, 13),
      goal: 'Set out and paint the floor pattern on the playa around the temple.',
      steps: ['Set out the circles from the centre peg', 'Mark the lines in copper, sea teal, amber and pearl', 'Plan how it comes off again: leave no trace'], skills: 'Setting out, painting' },
    { id: 'Q-04', name: 'Rig the lantern', crew: 'Light crew', stage: 'Light it', where: 'TEMPLE', tone: 'y', pin: V3(0, 11.5, 0),
      goal: 'Design and rig the lantern that makes the dome glow and throws a star of coloured light across the desert floor.',
      steps: ['Test lamps behind the acrylic', 'Plan power and safety', 'Rig it and light it on the night'], skills: 'Lighting, electrics' },
    { id: 'Q-05', name: 'Host the build kitchen', crew: 'Camp crew', stage: 'Build at Tankwa', where: 'CAMP_KITCHEN', tone: 'm', pin: V3(CAMP.x + 9.5, 8.5, CAMP.z + 11),
      goal: 'Keep the build crew fed and watered through build week.',
      steps: ['Plan the menu with the camp', 'Source and pack the kitchen', 'Run the kitchen roster'], skills: 'Cooking, care' },
    { id: 'Q-06', name: 'Make the first light box', crew: 'Temple Tech crew', stage: 'Fabricate', where: 'BENCH', tone: 'c', pin: V3(YARD.x - 9, 5.5, YARD.z + 7.5),
      goal: 'Prototype a small light box: a gift for the gates and the first step of the Temple Tech research into light and geometry.',
      steps: ['Model it in 3D, in Blender', 'Cut a prototype', 'Test it with a light inside'], skills: '3D modelling, making, electronics' },
    { id: 'Q-07', name: 'Share the film', crew: 'Story crew', stage: 'Fund', where: 'PETAL_A01', tone: 'y', pin: V3(10, 6.5, -9),
      goal: 'Send the 30 s film to people who would love to build or back the temple.',
      steps: ['Watch the film', 'Share it with your community', 'Point them to the three doors'], skills: 'Story, sharing', open: true },
  ],
  gates: [
    { n: 1, id: 'GATE_1', name: 'The fire', amount: '$10', space: 'fire', col: 'yellow', gift: 'The Seed giver badge in Your path, and the camp\'s thanks', builds: 'The community of temple builders' },
    { n: 2, id: 'GATE_2', name: 'The Lotus Mahal', amount: '$100', space: 'mahal', col: 'cyan', gift: 'A copper coil pendant or a T-shirt', extra: 'Sound journeys, and a live online workshop with a guest speaker (to be announced)', builds: 'The first Temple Tech gifts, and The Seed', rd: true },
    { n: 3, id: 'GATE_3', name: 'The theme camp', amount: '$500', space: 'camp', col: 'magenta', gift: 'Camp access, a pendant and a T-shirt', extra: 'What camp access covers at AfrikaBurn 2027 is still being set by the camp', builds: 'The camp and the temple build' },
    { n: 4, id: 'GATE_4', name: 'The zome', amount: '$1,000', space: 'zome', col: 'yellow', gift: 'A big coil, an art piece cut by a computer-controlled (CNC) router, or a Temple Tech light box', builds: 'The Temple Tech research behind the gifts, and The Seed', rd: true },
    { n: 5, id: 'GATE_5', name: 'Honorary builder', amount: '$10,000', space: 'all', col: 'cyan', badge: 'Honorary builder', gift: 'A pendant, a CNC-cut art piece, a big coil and a light box', extra: 'You carry the honorary builder badge', builds: 'The temple and the camp', rd: true },
    { n: 6, id: 'GATE_6', name: 'Cosmic architect', amount: '$50,000', space: 'beyond', col: 'magenta', badge: 'Cosmic architect', gift: 'The cosmic architect badge', extra: 'A view beyond the zome, to the bigger vision: the temple of 2029', builds: 'The camp and The Seed: a first step towards the temple of 2029, a vision' },
    { n: 7, id: 'GATE_7', name: 'The lighthouses', amount: '$100,000 to $10,000,000', space: 'lighthouse', col: 'yellow', badge: 'Lighthouse builder', gift: 'The lighthouse badge', extra: 'The much bigger picture, a vision: a permanent temple in Cape Town, and lighthouse temples seeded around the world', builds: 'The camp and The Seed, and the vision of temples to come' },
  ],
  events: [
    { id: 'E-01', name: 'Seed of Hope talks', format: 'Online, in the virtual temple', ticket: 'To be set', date: 'To be announced', speaker: 'Guest speaker to be announced', where: 'PETAL_A01',
      text: 'The temple is a seed of hope. In these online talks, thinkers and makers share what that means to them. You walk in through the arch of the virtual temple, and the call link appears for ticket holders.' },
    { id: 'E-02', name: 'Sound journeys', format: 'At the camp, and online', ticket: 'To be set', date: 'To be announced', where: 'CAMP_LOTUS',
      text: 'Sound journeys to gather the builders and raise money for the build.' },
    { id: 'E-03', name: 'Theatrical dinner', format: 'Dinner and a performance at the camp kitchen', ticket: 'To be set', date: 'To be announced', where: 'CAMP_KITCHEN',
      text: 'A dinner and a performance in one evening, in aid of the temple.' },
    { id: 'E-04', name: 'Gatherings in the Lotus Mahal', format: 'A space for gatherings', ticket: 'Free', date: 'Site being chosen', where: 'CAMP_LOTUS',
      text: "The camp's three-bell lotus tent, for gatherings. Where it goes up for these events is still being chosen." },
  ],
  crews: [
    { id: 'CR-1', name: 'Frame crew', what: 'The timber frame, panel by panel', where: 'FRAME', build: true },
    { id: 'CR-2', name: 'Glass crew', what: 'The coloured glass', where: 'RING_E', build: true },
    { id: 'CR-3', name: 'Petal crew', what: 'The fretwork petals', where: 'PETAL_A03', build: true },
    { id: 'CR-4', name: 'Light crew', what: 'The lantern and the night', where: 'TEMPLE' },
    { id: 'CR-5', name: 'Camp crew', what: 'Kitchen, shade and tents', where: 'CAMP' },
    { id: 'CR-6', name: 'Story crew', what: 'The film, the talks, the invitations', where: 'PETAL_A01' },
    { id: 'CR-7', name: 'Temple Tech crew', what: 'A build sub-crew for the conductive elements: coils, copper pods, pendants and light boxes', where: 'BENCH', build: true },
  ],
  roles: [
    { id: 'RO-1', name: 'Build lead', crew: 'All crews', where: 'TEMPLE' },
    { id: 'RO-2', name: 'Rigger', crew: 'Frame crew', where: 'FRAME' },
    { id: 'RO-3', name: 'Fabricator', crew: 'Frame and Temple Tech crews', where: 'YARD' },
    { id: 'RO-4', name: 'Lighting', crew: 'Light crew', where: 'TEMPLE' },
    { id: 'RO-5', name: 'Camp host', crew: 'Camp crew', where: 'CAMP' },
    { id: 'RO-6', name: 'Storyteller', crew: 'Story crew', where: 'PETAL_A01' },
    { id: 'RO-7', name: 'Event host', crew: 'Story and camp crews', where: 'CAMP_LOTUS' },
  ],
  collaborators: [], // filled from the portal lists
};

/* ---------- v4: the builder's path. One ladder of gates; each gate opens a space in the world and a stage of your own creative work ---------- */
const CONFIG = {
  share: 'https://chrisnash-432.github.io/mahala/',   // the published link that every share carries
  pay: {},       // a payment page per gate, for example pay[1] = 'https://...'. Empty until the camp chooses who runs payments.
  form: null,    // a private sign-up form, for visitors who cannot write to the shared database
  // the camp's own pages from the Temple Builder Journey outline, filled in once each exists
  campPay: null,   // the camp fee checkout (local or abroad rate, 1, 2 or 4 instalments)
  call: null,      // welcome call booking
  home: null,      // the member home: a personal link with the checklist, the documents and the dates
  donate: null,    // the standalone donation page, into the same pool
  principles: 'https://www.afrikaburn.org/about/our-guiding-principles/',
};
const PANELS_N = 143;
const GATE0 = { n: 0, id: 'GATE_0', name: 'The invitation', amount: 'Free', col: 'cyan', gift: 'The teaser, the story, a tour of the playa and the Book of Mahala, up to the portal of the camp' };
const GATE_BY = n => n === 0 ? GATE0 : DATA.gates.find(g => g.n === n);
// the spaces, and the gate that opens each one. A build crew also opens the yard and the workshop.
const SPACE = {
  fire: { gate: 1, name: 'The fireside in Blissfull Drift', at: 'CAMP_FIRE' },
  mahal: { gate: 2, name: 'The Lotus Mahal', at: 'CAMP_LOTUS' },
  camp: { gate: 3, name: 'Your place in the theme camp', at: 'CAMP' },
  kitchen: { gate: 4, name: 'The build kitchen', at: 'CAMP_KITCHEN' },
  zome: { gate: 4, name: 'Inside the zome', at: 'TEMPLE' },
  crews: { gate: 4, name: 'The crews', at: 'CR-1' },
  yard: { gate: 5, crew: true, name: 'The build yard and the workshop', at: 'YARD' },
  beyond: { gate: 6, name: 'Beyond the zome', at: 'TEMPLE' },
  lighthouse: { gate: 7, name: 'The lighthouse temples', at: 'TEMPLE' },
};
const CREW_BY = id => DATA.crews.find(c => c.id === id);
const CREW_OF_NAME = name => DATA.crews.find(c => c.name === name);
// a draft pairing of each archetype with the crew where it is needed, for the camp to agree. The card never sorts anyone.
const ARCH_CREW = { alchemist: ['CR-7', 'Q-06'], conductor: ['CR-1', 'Q-02'], entertainer: ['CR-6', 'Q-07'], guardian: ['CR-5', 'Q-05'], magician: ['CR-4', 'Q-04'],
  muse: ['CR-3', null], mother: ['CR-5', 'Q-05'], sage: ['CR-6', 'Q-07'], seeker: ['CR-2', 'Q-01'], trickster: ['CR-3', 'Q-03'], wildone: ['CR-1', 'Q-02'] };
const SKILL_CREW = { Build: 'CR-1', Fabricate: 'CR-7', Light: 'CR-4', Cook: 'CR-5', Art: 'CR-3', Story: 'CR-6', Care: 'CR-5', 'Host an event': 'CR-6' };
// each stage of the path: what to do there, and three draft prompts for your own book (a reflection, a poem, a drawing)
const PATHS = [
  { feel: 'Curious and inspired', steps: [['teaser', 'Watch the teaser'], ['story', 'Walk the story'], ['tour', 'Take the tour of the playa'], ['book', 'Open the Book of Mahala'], ['portal', 'Stand at the portal of the camp']],
    reflect: 'What called you here? Write down the moment you first felt it.', poem: 'Write four lines that each begin with "Do you remember".', art: 'Draw the door you would walk through to find this place.' },
  { feel: 'Held by the circle', steps: [['sit', 'Sit by the fire'], ['read', 'Read a poem by a camp mate'], ['draw', 'Draw a card'], ['line', 'Leave a line for the fire']],
    reflect: 'Draw a card, then write what its question asks of you.', poem: 'Write three lines for the fire: what you bring, what you leave behind, what you hope.', art: 'Draw your card\'s gift as a sign small enough to carry.' },
  { feel: 'Gathered', steps: [['enter', 'Step inside the Lotus Mahal'], ['coil', 'Sit beneath the big coil'], ['journey', 'Join a sound journey, once dates are set'], ['talk', 'Join the live workshop, once the guest is announced']],
    reflect: 'Where in your life do you need a gathering place, and who would you invite in?', poem: 'Write a poem shaped like a bell: one short line, two long ones, one short.', art: 'Sketch a pendant: one ring, and the way you would wind it.' },
  { feel: 'Part of the camp', steps: [['circle', 'Meet the camp'], ['week', 'Choose your days: setup, the burn, breakdown'], ['call', 'Book your welcome call'], ['lnt', 'Read the Sacred Agreements and plan to leave no trace']],
    reflect: 'What gift will you bring to the camp that is not a thing?', poem: 'Write a blessing for the people you will camp beside.', art: 'Map your corner of the camp: where the sun rises, where the fire is, where you sleep.' },
  { feel: 'A builder', steps: [['zome', 'Step inside the zome'], ['crew', 'Choose a crew'], ['quest', 'Take a quest'], ['panel', 'Light a panel of glass']],
    reflect: 'Something rises inside you as the temple rises outside. What is it?', poem: 'Write a verse for a stone at the build yard.', art: 'Design one panel of glass: its colour, and the light it would throw.' },
  { feel: 'A keeper of the space', steps: [['all', 'Walk every space'], ['host', 'Bring a newcomer to the fire'], ['gather', 'Offer to host a gathering']],
    reflect: 'What does it mean to you to hold a place open for others?', poem: 'Write a welcome for the next builder through the portal.', art: 'Draw the temple as you hope it will look on the night it is lit.' },
  { feel: 'Looking further', steps: [['beyond', 'Look beyond the zome'], ['vision', 'Read the vision of the temple of 2029']],
    reflect: 'What should the temple of 2029 hold that this temple cannot?', poem: 'Write a poem for the temple you hope for.', art: 'Sketch the temple of 2029 as you imagine it, from above.' },
  { feel: 'A light for others', steps: [['city', 'Name a city that needs a lighthouse temple'], ['keepers', 'Imagine who would tend it']],
    reflect: 'Where in the world should a lighthouse temple stand, and who would tend it?', poem: 'Write the words you would carve over its door.', art: 'Draw a lighthouse temple for your own city.' },
];
// you: kept in this browser, and in the shared database when this view may write to it
const ME = (() => {
  const d = { v: 4, gate: 0, test: {}, door: null, name: '', show: false, contact: '', consent: false, crew: null, crewOk: false, from: null,
    quests: {}, done: {}, lines: 0, last: 0, newsSeen: 0, sound: false, visits: 0, week: [] };
  try { Object.assign(d, JSON.parse(localStorage.getItem('mahala.me') || '{}')); } catch (e) { }
  try { d.book = JSON.parse(localStorage.getItem('mahala.book') || '[]'); } catch (e) { d.book = []; }
  if (!Array.isArray(d.book)) d.book = [];
  return d;
})();
function saveMe() { try { const o = Object.assign({}, ME); delete o.book; localStorage.setItem('mahala.me', JSON.stringify(o)); localStorage.setItem('mahala.book', JSON.stringify(ME.book)); } catch (e) { } }
const isBuildCrew = id => !!(id && CREW_BY(id) && CREW_BY(id).build);
function canEnter(key) {
  return true;    // v5: every place on the way is open; the gates are ways to give
  const sp = SPACE[key]; if (!sp) return true;
  if (ME.gate >= 5) return true;
  if (sp.crew && ME.crewOk && isBuildCrew(ME.crew)) return true;
  return ME.gate >= sp.gate;
}
function markDone(gate, step) { const k = gate + ':' + step; if (ME.done[k]) return false; ME.done[k] = Date.now(); saveMe(); if (typeof onPathChange === 'function') onPathChange(); return true; }
const isDone = (gate, step) => !!ME.done[gate + ':' + step];
const LIT = { count: { value: PANELS_N }, mode: { value: 0 }, t: { value: 0 }, shown: PANELS_N };
const litFrac = () => LIT.mode.value ? Math.max(0.12, Math.min(1, LIT.count.value / PANELS_N)) : 1;
function myLight() { let n = ME.door ? 1 : 0; for (const q in ME.quests) n += (ME.quests[q].steps || []).filter(Boolean).length; return n + (ME.lines || 0); }
/* the story: seven chapters woven through the world. Words are drafts from the Seed of Hope script, by camp mates, not final. */
const STORY = [
  { title: 'The dark and the doubt', clock: 6 * 60 + 52, view: () => ({ t: V3(0, 5, 0), d: 150, p: 1.33, a: -1.27 }),
    lines: ['Do you remember, my friends, when the world grew so loud with uncertainty that the easiest thing was to close your eyes?'] },
  { title: 'The call', clock: 7 * 60 + 40, view: () => ({ t: PORTAL.clone().setY(2.6), d: 27, p: 1.24, a: 2.24 }), verse: 1,
    lines: ['But nowhere was safe. So you did something else.', 'Do you remember? You were called.'] },
  { title: 'The gathering', clock: 17 * 60 + 46, view: () => ({ t: DRIFT.clone().setY(2.6), d: 25, p: 1.2, a: 1.25 }),
    lines: ['Called by others who had been called for the same reason, and who you had always been meant to find.', 'First there was a grateful heart. Then a state of bliss. Then the end of nowhere. Then a portal. And now, a seed.'] },
  { title: 'The building', clock: 10 * 60 + 20, view: () => ({ t: V3(YARD.x, 1, YARD.z), d: 50, p: 1.0, a: 0.95 }), verse: 3,
    lines: ['So you built it. With reverence, and with play.', 'And every piece you raised outside, something rose inside you too.'] },
  { title: 'The light', clock: 11 * 60 + 50, inside: true, view: () => ({ t: V3(0, 0.7, 0), d: 3.3, p: 0.82, a: 2.9 }),
    lines: ['And when the light came through the glass, you remembered the whole thing.', 'That this is why you came here. That this is why it felt like family.'] },
  { title: 'The seed', clock: 20 * 60 + 25, view: () => ({ t: V3(0, 0, 0), d: 96, p: 0.06, a: 0 }), verse: 2,
    lines: ['It began as a seed. A seed of hope, planted in the only ground that was ever ours to tend: each other.'] },
  { title: 'The doors', clock: 20 * 60 + 45, view: () => ({ t: V3(24, 1, 0), d: 44, p: 1.08, a: 0.95 }), doors: true,
    lines: ['My friends, you have been chosen to become a temple builder.', 'Come and build it with us. Come and build it for us. Or carry the seed where you are. The doors are open.'] },
];
/* the fireside: poems and stories written by camp mates, read around the fire in the hull of Blissfull Drift.
   Spelling slips are mended and dashes become commas or colons; the words are otherwise as the writers wrote them. */
/* the Mahala Archetype Deck: the eleven cards of the Book of Mahala, each with its gift, its question and its shadow */
const ARCH = [
  {"id": "ARCH_ALCHEMIST", "key": "alchemist", "title": "The Alchemist", "cap": "Transformation Master turning ideas into reality", "look": "a long bearded alchemist in patterned robes, a glowing flask on a table of light, stars and symbols around him", "gift": ["The Alchemist is the master of change, a visionary who transmutes dreams into tangible outcomes. Where others see raw material, the Alchemist sees potential. They blend intuition and intellect, magic and method, to bring forth creation. They see beyond what is, into what could be. They know that beauty and meaning don't just emerge: they are crafted, through presence, patience, and inspired action.", "This card calls on you to recognize the tools already within your grasp (your knowledge, experience, passion, and vision) and begin the sacred process of transformation. Trust the process. Mix, mold, test, refine. What once lived only in your imagination is ready to be brought to life."], "q": "What are you being called to bring into the world?", "shadow": ["When the Alchemist is out of alignment, the pursuit of transformation can become obsession or manipulation. You may be attempting to control outcomes, forcing growth without honoring the process. Or perhaps you are stuck in endless planning, endlessly dreaming, never taking action. This can look like perfectionism, burnout, or staying lost in the planning stage, never grounding the vision. Alternatively, it may be the misuse of one's gifts, crafting illusions instead of truth. The shadow Alchemist becomes a trickster, promising gold but delivering nothing but dust."], "sq": "Where are you trying to skip the sacred mess of the creative process?", "page": 23, "src": "assets/deck/alchemist.jpg"},
  {"id": "ARCH_CONDUCTOR", "key": "conductor", "title": "The Conductor", "cap": "Aligning visions into a cohesive masterpiece, guiding every note into perfect harmony", "look": "a conductor with arms raised before a blazing sun, ribbons of music swirling round", "gift": ["With a presence that is both grounding and electrifying, the Conductor is the unseen force that turns chaos into harmony, the sharp mind that weaves together the dreams of many into a singular, breathtaking masterpiece, ensuring that every moving part flows in sync with the greater vision.", "This card represents leadership, coordination, and the ability to bring disparate elements into harmony, suggesting you are in a position to lead, to align people with a shared vision, and create something greater than the sum of its parts. Whether in work, relationships, or personal projects, you are being asked to direct with purpose, balancing structure with intuition while allowing space for improvisation. Trust in your ability to hold the vision while allowing the inputs and perspectives of others weave into the symphony."], "q": "Where are you being asked to step up as the leader of a great vision?", "shadow": ["In their shadow, the Conductor may become overly controlling and rigid, micromanaging every detail to the point of stifling spontaneity and creativity. Instead of guiding with fluidity, they may impose rigid structures, fearing that without their control, everything will fall apart. In this state, the Conductor might struggle with trusting others, feeling the need to oversee every step instead of allowing the natural rhythm of collaboration to play its song. Their obsession with timelines and precision can cause them to miss the beauty of imperfection, rejecting moments of unpredictability that could lead to even greater magic."], "sq": "How can you lead with clarity while leaving space for spontaneity?", "page": 25, "src": "assets/deck/conductor.jpg"},
  {"id": "ARCH_ENTERTAINER", "key": "entertainer", "title": "The Entertainer", "cap": "Setting the stage for connection with presence & flair", "look": "a laughing performer in a ruffled collar juggling bright balls under ornate arches", "gift": ["The Entertainer is the radiant energy that draws people together, weaving moments of joy, laughter, and enchantment into the fabric of the experience. With a captivating presence, they dissolve barriers, making strangers feel like old friends and transforming ordinary interactions into unforgettable memories. Whether through storytelling, performance, or an effortless ability to lift the energy of a space, the Entertainer reminds us that playfulness and connection are portals to something deeper.", "This card is calling you to embrace your personal power, to shine without fear, and to create space for others to feel seen and uplifted. The Entertainer understands that joy is a gateway to transformation. By stepping fully into your role as a conduit for wonder, you invite others to do the same."], "q": "Where are you playing small or afraid to be seen under the spotlight?", "shadow": ["The shadow of the Entertainer emerges when the need to captivate and uplift others becomes a mask, hiding insecurities of being truly seen, using a persona to avoid vulnerability while keeping others entertained. They may seek validation through applause, relying on external approval rather than genuine self-worth. This ends up draining their energy in an endless cycle of giving without replenishing, overcompensating with exaggerated antics rather than embracing the quiet power of presence. In an attempt to always take center stage, they might not realize where they are taking away the opportunity for someone else to shine.", "The lesson of the shadow is to recognize that joy and connection must come from an authentic place. True magic happens when the Entertainer allows themselves to be seen, not just for their performance, but for their real, unpolished self."], "sq": "How can you use joy as a tool for deeper connection and meaning?", "page": 27, "src": "assets/deck/entertainer.jpg"},
  {"id": "ARCH_GUARDIAN", "key": "guardian", "title": "The Guardian", "cap": "Protector of truth, keeper of trust, holder of space", "look": "a winged guardian in golden armour holding a staff, a halo of light behind", "gift": ["The Guardian stands firm as the protector of people, energy and the sacred. They create a container for safety, ensuring all who enter feel held and supported. Their grounded presence is like an ancient tree with deep roots, unshakable and devoted. The Guardian is not just a keeper of boundaries but a guide, helping others understand what must be preserved and what must be released.", "This card appears when you are called to stand in protection, whether of yourself, a loved one, a vision, or a sacred space in your life. You may need to set clearer boundaries, honor your own limits, or watch over something precious. Trust that your presence holds immense power. Stand firm in your values and create space for what truly matters, whether that's a dream, a relationship, a truth, or a place. Know that your strength lies in your devotion."], "q": "What boundaries do you need to honor in order to protect something meaningful?", "shadow": ["The Guardian's Shadow emerges when protection turns into control, and care becomes suffocation. Operating from fear of harm, change, or loss, they build walls so high that nothing new can enter. It may manifest as distrust, or resistance to allowing others to navigate their own journey.", "This shadow can also lead to martyrdom, where the Guardian exhausts themselves in service to others, feeling burdened rather than empowered. Their watchful eye can become an unyielding grip, mistaking control for safety.", "This card invites you to reflect on whether your protective instincts are serving your growth or keeping you caged. Examine where protection has turned into limitation."], "sq": "Where are you shielding yourself or others from growth?", "page": 29, "src": "assets/deck/guardian.jpg"},
  {"id": "ARCH_MAGICIAN", "key": "magician", "title": "The Magician", "cap": "Master of wonder & awe through the unexpected", "look": "a grinning magician in a wide brimmed hat, a top hat and cards on the table before him, a rubber duck appearing", "gift": ["A master of transformation, the Magician conjures awe through the unexpected: illusions that defy reality, a whisper of magic woven into the air, a perfectly timed moment, a ritual of renewal, a piece of art that speaks directly to the soul, creating enchanting experiences that feel otherworldly and linger through the space of time.", "Their touch turns the mundane into the mystical, revealing the hidden forces that weave through existence. But, their magic is more than a quick trick of the hand. It is a deep understanding of how to shape reality, inviting others to believe in possibilities beyond their own imagination.", "This card is calling you to step into your creative power. Recognize the tools at your disposal, and use them with intention. Whether through art, words, or action, you have the ability to inspire and transform. Trust in your craft, embrace the mystery, and remember that magic is not just in what you create but in how you share it with the world."], "q": "What illusions are you ready to shatter to reveal the deeper magic within?", "shadow": ["The shadow of the Magician archetype emerges whilst the Magician is caught in the endless pursuit of more and forgets to look up. There is stillness between spells and true magic waits, yet they are consumed by the need to prove their power. They chase the next ritual, the next sacred object, the next spark of awe, forgetting that the greatest magic is often found in the ordinary, the breath, the quiet unfolding of now. In the Shadow, they cease to listen, to witness, to BE. They forget that presence is power. That just being, in full authenticity, in heartful stillness, is a portal to the miraculous. They over-identify with doing, performing, crafting... forgetting the inherent magic in their being."], "sq": "How can you pay more attention to miracles that are unfolding around you?", "page": 31, "src": "assets/deck/magician.jpg"},
  {"id": "ARCH_MUSE", "key": "muse", "title": "The Muse", "cap": "Sparks creativity & inspiration with authentic beauty", "look": "a muse with flowing rainbow hair releasing a burst of golden light, flowers and stars swirling", "gift": ["Radiant, inspiring, and endlessly creative, the Muse is the spark that ignites imagination in others. Their presence alone stirs dreams to life, unlocking new possibilities and unseen potential. They can influence without words and create awe without effort. Whether through art, movement, or sheer presence, they channel an energy that awakens something deep within those around them, inviting others to shift perspectives and step into their own creative power.", "The Muse reminds us that creation is not just about doing; it's about feeling, believing, and becoming. This card is calling you to embrace your unique magic and share it with the world. Whether through art, words, ideas or energy, you have the power to inspire those around you. Let your presence spark something in others: remind them of what is possible when imagination leads the way."], "q": "How can you become a living invitation for inspiration?", "shadow": ["The shadow of the Muse is elusiveness, self-doubt, and ungrounded inspiration. While they have the power to ignite creativity in others, they may struggle to channel their own brilliance into tangible action. The Muse's energy can become overwhelming or chaotic, flooding others with too many ideas without grounding them in reality, leaving ideas half-formed and unfinished.", "At times, the Muse may crave validation, relying too much on external admiration rather than their own internal sense of worth. If their inspiration goes unrecognized, they can fall into melancholy, feeling unseen or unappreciated, questioning whether their contributions truly matter.", "True mastery comes when the Muse learns to harness their creativity with intention, becoming not just a source of inspiration, but a force of meaningful transformation."], "sq": "Are you inspiring others while also nurturing your own creativity?", "page": 33, "src": "assets/deck/muse.jpg"},
  {"id": "ARCH_MOTHER", "key": "mother", "title": "The Mother", "cap": "The heart of creation & the power of love", "look": "a mother with long red hair holding a baby, wrapped in flowers, sun and moon medallions around her", "gift": ["Nurturing and steadfast, the Mother is the heart of her community, holding space for belonging where all feel welcome to bring their burdens or joys. She embodies compassion, patience, and the quiet strength that holds everything together. She is a symbol of creation and deep wisdom, representing the power of unconditional love, protection, and the ability to foster growth, whether in relationships, projects, or self-discovery.", "This card suggests you are in a phase of nurturing something important, whether it's a dream, a community, or your own healing. The Mother reminds you to honor cycles, understanding that all seeds of creation must be planted, tended, and allowed to grow in their own time."], "q": "What needs nurturing in your life so that it can flourish?", "shadow": ["When reversed, the Mother archetype can indicate self-sacrifice to the point of depletion or over-protection that stifles growth. The shadow of the Mother emerges when nurturing turns into control, martyrdom, or smothering. Instead of fostering growth, she may overprotect, manipulate, or make others dependent on her care. Are you nurturing from a place of abundance, or are you pouring from an empty cup? Are you holding on too tightly to something that needs space to evolve? This could also be a sign of neglect, a reminder that true care must include your own well-being.", "The key to healing the shadow of the Mother is balance: learning to give without losing oneself, to love without possessing, and to nurture without controlling. True maternal energy empowers others to stand on their own while still providing warmth and support."], "sq": "Where do you need to trust the natural flow of growth and change?", "page": 35, "src": "assets/deck/mother.jpg"},
  {"id": "ARCH_SAGE", "key": "sage", "title": "The Sage", "cap": "Storyteller & keeper of wisdom, finding deeper meaning in every moment", "look": "a white bearded sage in green robes reading a great open book, a staff and stars around him", "gift": ["The Sage is the eternal seeker of wisdom, the one who walks between the known and the unknown, distilling truth from experience. They are the storytellers, the mentors, the keepers of sacred knowledge who illuminate the path for others. The Sage remains open to learning, knowing that wisdom is not about having all the answers, but about asking the right questions. They ground others with their insight and perspective, while holding purpose and deeper meaning at the forefront of every decision. The true essence of a Sage is the ability to embrace the unknown. True wisdom isn't about certainty but about being comfortable with life's mysteries.", "This card calls you to embrace your inner wisdom: not just the knowledge you've gathered from books or teachings, but the deep, intuitive knowing that comes from lived experience. Share this knowledge with others. Your experiences hold value. Who might benefit from your insights?"], "q": "", "shadow": ["Instead of guiding others with insight, the shadow Sage may hoard knowledge rather than share it. The shadow Sage may also develop an over-reliance on intellect, avoiding emotional depth or personal connection. Their endless seeking may trap them in a cycle of learning but not applying, using learning as an escape from action. Or, they may reject perspectives that challenge their beliefs, clinging to rigid opinions and becoming isolated in their pursuit of understanding. Trapped in their own intellectual arrogance, the shadow emerges as dismissive and detached, refusing to acknowledge the wisdom found in different perspectives.", "The Sage's greatest lesson in shadow is humility: true wisdom is not about having all the answers, but about staying open to learning and to empower others to seek their own inner wisdom while guiding them on their way."], "sq": "Where in your life can you embrace a beginner's mindset, allowing curiosity to dissolve old paradigms and reveal a new truth?", "page": 37, "src": "assets/deck/sage.jpg"},
  {"id": "ARCH_SEEKER", "key": "seeker", "title": "The Seeker", "cap": "Follows intuition with a spirit of exploration", "look": "a young explorer in a tricorn hat and long coat on the deck of a ship, a balloon rising behind", "gift": ["The Seeker arrives with wide eyes and an open heart, embodying the essence of curiosity and discovery. They are the traveler, the questioner, the wanderer. Ever in pursuit of wisdom, they question, explore, and seek deeper understanding, forever drawn to the mysteries of people and purpose.", "Even in the vast expanse of the unknown, the Seeker walks with reverence, finding magic hidden in the smallest details. They are the ones who illuminate the way, inviting all who cross their path to embark on their own transformative quests. They uncover the unseen, guide others toward revelation, and remind us all that the journey itself is just as profound as the destination.", "This card is calling you to embrace the unknown with wonder, to ask the big questions, and to trust that every step forward reveals new layers of truth. Follow your curiosity, let it lead you beyond the familiar, and open yourself to the lessons hidden in each experience."], "q": "What truth is waiting to be uncovered if you dare to look beyond the surface?", "shadow": ["While the Seeker embodies curiosity, growth, and the pursuit of deeper truths, its shadow emerges when the journey becomes an endless chase, never satisfied, never arriving. The Seeker becomes restless, ungrounded, and addicted to the quest itself, believing that the next book, the next teacher, or the next experience will finally provide the answers they crave. This can lead to spiritual bypassing, where they avoid sitting with discomfort or integrating what they've already learned.", "At its deepest level, the shadow of the Seeker is a fear of arriving, because if they ever stop searching, they might have to face themselves and they may struggle to trust their own wisdom. But the answers are not always external; sometimes, the journey is about uncovering what has been within you all along."], "sq": "What would happen if you stopped searching and allowed yourself to simply be?", "page": 39, "src": "assets/deck/seeker.jpg"},
  {"id": "ARCH_TRICKSTER", "key": "trickster", "title": "The Trickster", "cap": "Playfully unpredictable creating moments of joy & chaos", "look": "a grinning jester in red and black lounging beside a laughing mask, playing cards and suns around", "gift": ["Playful and unpredictable, the Trickster keeps everyone on their toes with a wink and a joke, dancing on the edge with mischief and wit. They are the spark that lights the room, the laughter that breaks tension, the instigator of unexpected moments. Their presence weaves magic into the air, as they conjure surprises that inspire and delight.", "The Trickster reminds us that joy, disruption, and chaos can be profound teachers. They shake us free from rigid expectations and invite us to see life through a new lens where creativity, resilience, and new perspectives emerge. The Trickster forces us to adapt, grow, and see beyond our assumptions. They prove that wisdom and play are not opposites but partners in transformation.", "This card is calling you to shake up your life, embrace spontaneity, release attachment to plans, and find more room for creativity and play."], "q": "Where can you surrender to the chaos and discover new solutions where familiar ones are no longer working?", "shadow": ["While the Trickster is incredibly intelligent and witty, the shadow side can use wit as a weapon, turning jokes into a tool for hiding vulnerability behind sarcasm. Their cleverness becomes a mask, their surprises a means of control. Constantly caught up in the whirlwind, the Trickster can forget to read the room and tune into the sensitivity or emotional needs of others."], "sq": "Where might you have a tendency to distract, creating unnecessary chaos that derails progress rather than sparking transformation?", "page": 41, "src": "assets/deck/trickster.jpg"},
  {"id": "ARCH_WILDONE", "key": "wildone", "title": "The Wild One", "cap": "Untamed spirit channeling raw energy embodying liberation & fearless creativity", "look": "a wild woman crowned with branches beside a grey wolf, an eagle and swirling leaves around her", "gift": ["The Wild One bursts onto the scene like a streak of lightning, untamed and electric. She channels raw energy, fearless creativity, and an unapologetic embrace of the unknown. The Wild One disrupts stagnation, igniting passion and encouraging others to break free from limitations. Inspiring others to let go, dance, and howl at the moon, she is a reminder that true creation is not meant to be controlled; it is meant to be felt, expressed, and lived.", "When this card appears, it is calling you to unleash your inner fire. Your wild ideas and rebellious nature are exactly what is needed. Stop overthinking and start doing. Break the rules that once bound you. The Wild One does not conform: they rewrite the script with courage and joy. Trust your instincts. Creativity doesn't come from playing it safe. Take the leap, say yes to adventure, and let your heart lead the way. Inspire others by being your fullest self. Your authenticity gives others permission to embrace their own."], "q": "Where are you craving freedom, and what fears are keeping you from fully stepping into it?", "shadow": ["The Wild One's raw and electrifying energy, if unchecked, can turn passion into chaos, freedom into recklessness. Pushing boundaries is powerful, but not at the expense of collaboration. The shadow of this card warns against burning bridges, chasing novelty without depth, or ignoring the impact of your actions. The Wild One's instinct is to roam, but this can turn into running from commitment, dodging accountability, a refusal to listen to others or the inability to see things through. When ungrounded, the Wild One can often mistake impulse for intuition, acting on every whim without discernment.", "The Wild One thrives in independence, but in the shadow, they may reject teamwork, refuse guidance, or dismiss others' needs in pursuit of their own desires. Fighting against rules or expectations without purpose can lead to self-sabotage rather than true freedom. Wildness is a gift when channeled wisely."], "sq": "", "page": 43, "src": "assets/deck/wildone.jpg"}
];
const ARCH_BY = Object.fromEntries(ARCH.map(a => [a.key, a]));

const FIRESIDE = [
  { id: 'P-BLUE', kind: 'Poem', title: 'Out of the Blue', when: 'AfrikaBurn 2025', stanzas: [
    ['It came to me suddenly', 'One Tuesday afternoon', 'That I had quite mistaken', 'My finger for the moon'],
    ['The majesty of Creation', 'Was obscured by the cloud', 'Of my mind so full of memories', 'It was thinking out too loud'],
    ['The color of the stillness', 'At the center of my Being', 'Was being dulled and dirtied', 'By a future I was seeing'],
    ['To live the perfect moments', 'Of life so pure and true', 'I resolved that very Tuesday', 'To dive into my deep deep blue']] },
  { id: 'P-CREATION', kind: 'Poem', title: 'Creation', when: 'AfrikaBurn 2024', stanzas: [
    ['I looked for the Creator', 'Where can she be', 'Up a hill or under a tree', 'I looked and I looked', 'And what did I find', 'The Creator was all in my mind'],
    ['Knowing where not to look', 'I started anew', 'And in ants and elephants', 'And the sky so blue', "I saw the Creator's", 'Footprints shine through'],
    ['Could it be', 'When all said and done', 'Creator and Creation', 'Are really all One']] },
  { id: 'P-BEGIN', kind: 'Poem', title: 'In the Beginning', stanzas: [
    ['From the primordial void of silent formlessness', 'One becomes Two', 'Equal and Opposite', 'A cosmic balance to be retained'],
    ['From stillness into movement', 'Separated from that which she knew', 'A longing and desire starts to stir', 'The will to receive, to have this void filled'],
    ['Attracting exactly what she wants and needs', 'And what a gift, unbeknownst to her', 'Giving meaning to her other half', 'Introducing: The will to bestow'],
    ['That radiant light, emanating', 'Illuminating the darkness', 'To all the wonders that lie within'],
    ['They orbit one another', 'Attraction and Energy', 'Until the two become one, once again', 'Remembering where they came from', 'Their true essence, their origin'],
    ['Ecstatic, Transcendent, Orgasmic', 'Formless Unity', 'And from that union, emerges a third', 'The divine child, a unique creation'],
    ['The creative spirit starts its spiraling descent', 'The journey of embodiment', "To experience one's self"],
    ["One's free will", "One's own creation", 'Oh to be free', "And that's the story of you and me"],
    ['The celestial beings', 'And this Whole, Glorious, Cosmic Symphony', 'A gift received', 'All for Free', 'Or as some may say...', 'For Mahala Baba'],
    ['Now we journey back, one step at a time', 'Playing our way back', 'Back to the Source', 'Tracing our steps, our many lifetimes', 'Back through the Earth, to the Sun', 'To the Galactic Centre', 'To Infinity and Beyond...']] },
  { id: 'P-TEMPLE', kind: 'Poem', title: 'The Temple', stanzas: [
    ['Heavens above radiating light', 'This tree receives', 'My awareness perceives', 'Deep Ancestral roots', 'Grounded by the wisdom of the earth'],
    ["We've done this before.", 'Soul family playfully reflecting', 'Our true divine essence', 'Remembering our mission', 'Who we really are', 'Where we are from'],
    ['Centred in the heart', 'The inner compass spins', 'Only together we can truly feel', 'Co-sensing as parts of a greater whole.'],
    ['An emergent vision arises', 'To listen, remember, to co-create with love.', 'In service of sacred union,', 'Spirit manifest', 'Materialisation, Crystallisation', 'Devotion to wholeness, and to Bliss.'],
    ['The ineffable, unimaginable, un-nameable', 'Infinite', 'Unconditional', 'Absolute', 'Love'],
    ['The beat of our hearts,', 'The rhythm of the drums', 'Weaves these golden threads together', 'A rainbow tapestry', 'Adorned by all of you gems'],
    ['From a temporary tented temple', 'A resonant field of love and beauty resounds', 'We sail upon the cosmic cruiseship', 'Remembering our ancient futures'],
    ['Cultivating communities of temple builders', 'Centred around that sacred Temple', 'Both within and without', 'Collaborative communities co-create', 'Human, non-human and more than human', 'Creating safe nourishing spaces', 'For life to flourish as One']] },
  { id: 'S-AKASH', kind: 'Story', title: 'The Halls of the Akash', prose: true, stanzas: [
    ['Towers. Towers upon towers, row upon row, stretching out through the infinite black void, glowing, illuminated from within, still and filled with absolute silence.'],
    ['Here the sound of every bird chirp ever made and ever to be made is contained, safe between the pages of innumerable volumes. Every soul who rose to power, every soul who lost his way, every moon rise of every night, every flower blossoming of every day.', 'Here in the library beyond all space and time, where every song sung and verse recited is written, all knowing exists atemporally.'],
    ['Where every reason for every battle and every unrelinquished romance, unknown to every Arjuna and every Romeo, is known with absolute certainty.'],
    ['Here the vast chasm between unknown and known, where every fear and trepidation has lived in the mortal lives of men: here in the great halls of the Akash, all is resolved. No ends are loose. All twists of fate are unwound.', 'All that remains is peace and love, the ever fertile soil of all creation.'],
    ['The words of sages point the way to this place of knowing. Knowing in the marrow of the bones of the living and the dust of the crumbling bones of the dead.'],
    ['The knowing from which all unknowing is born, and to which all unknowing returns like the fallen leaves of the Tree of Life, ready to decompose, disintegrate and dissolve, ready to be reabsorbed and resolved,', 'so that every bit of darkness, every bit of fear, every bit of joy and every bit of love can be fully become, fully experienced, fully understood and fully integrated, so that the ultimate knowing can be known ultimately.']] },
];
const FIRE_BY = Object.fromEntries(FIRESIDE.map(p => [p.id, p]));
/* verses from the camp, on stones along the way: each one an opening from a fireside poem */
let inside = false, insideAt = null, clockAnim = null; const story = { on: false, i: 0 }; const fire = { on: false, piece: null, page: 0, prevClock: null, saved: null };
const VERSES = [
  { id: 'VERSE_1', title: 'A verse at the camp gate', at: beside(ST.portal - 10, 3.6, 1), ch: 2, piece: 'P-BLUE', where: 'On a stone at the camp gate', lines: ['It came to me suddenly', 'One Tuesday afternoon', 'That I had quite mistaken', 'My finger for the moon'] },
  { id: 'VERSE_2', title: 'A verse among the forms', at: V3(15.2, 0, -5.6), ch: 6, piece: 'P-BEGIN', where: 'On a stone among the copper forms', lines: ['From the primordial void of silent formlessness', 'One becomes Two', 'Equal and Opposite', 'A cosmic balance to be retained'] },
  { id: 'VERSE_3', title: 'A verse at the build yard', at: beside(ST.yard - 8, 4, 1), ch: 4, piece: 'P-TEMPLE', where: 'On a stone at the build yard', lines: ['Cultivating communities of temple builders', 'Centred around that sacred Temple', 'Both within and without'] },
];
/* the Book of Mahala: the camp's draft storybook, one image per page (filled from the draft design) */
const BOOK = { ratio: 595 / 842,
  pages: [
    {"src": "assets/book/p00.jpg", "alt": "The cover of the Book of Mahala: red leather with brass corner pieces, a brass rosette and a brass clasp", "text": "The Book of Mahala"},
    {"src": "assets/book/p01.jpg", "alt": "For those who dare to wander", "text": "For those who dare to wander..."},
    {"src": "assets/book/p02.jpg", "alt": "A painting of a wooden gateway standing open in the desert, a lotus crest above it, a glowing path leading to a domed temple", "text": ""},
    {"src": "assets/book/p03.jpg", "alt": "A poem about finding your way to Nowhere's End", "text": "Not all who wander are lost, so they say\nAnd you, most esteemed soul,\nAre certainly not.\nYou've found your way to Nowhere's End\nAnd now, yes, right now\nFor indeed there is no other now,\nHave turned the page upon a brand new story.\nBorn from the belief in infinite possibility."},
    {"src": "assets/book/p04.jpg", "alt": "A poem about stumbling upon the doorway", "text": "You stumbled upon the doorway\nBy chance, perhaps fate\nOr maybe happenstance\nBut certainly not by mistake\nAnd behold it stands open to you\nDare to step through\nAnd wander with wonder\nLike an open book\nReady to start telling a new story"},
    {"src": "assets/book/p05.jpg", "alt": "What Mahala is", "text": "Mahala is a living, breathing, evolving manifestation of a collective dream, one rooted in a deep commitment to Infinite & Unconditional Love.\n\nTo those who have felt its embrace, we welcome you to join us in joyous celebration of its eternal abundance and the Infinite Possibilities it calls us to co-create.\n\nTo those for whom this force remains a mystery, we invite you to step into curiosity: to explore, to experience, and to remember through the spaces we create and the journeys we facilitate.\n\nJoin us on this voyage of discovery, and help us offer this vision freely to all who cross our path."},
    {"src": "assets/book/p06.jpg", "alt": "The Story of Mahala: a purple hot air balloon lifts a wooden ship through rainbow clouds and waves, beside a flame", "text": "The Story of Mahala"},
    {"src": "assets/book/p07.jpg", "alt": "Nowhere's End and Back Again: The Story of Mahala", "text": "Nowhere's End and Back Again: The Story of Mahala\n\nThe Ambassadors of Bliss traversed the cosmos in their one-of-a-kind magic airship the \"Blissful Drift\".\n\nBecause, of course, how else would such Blissmakers travel but in absolute style?"},
    {"src": "assets/book/p08.jpg", "alt": "The Blissful Drift: a wooden ship hanging from a purple and white striped balloon, among small clouds", "text": ""},
    {"src": "assets/book/p09.jpg", "alt": "The airship crashed in an orange desert, its balloon slumped beside the broken hull", "text": "Suddenly they were swept up in a Storm of Uncertainty, and the airship came crashing down in a strange and liminal space...\n\nIt wasn't quite here. Nor was it there."},
    {"src": "assets/book/p10.jpg", "alt": "A glowing sign reading Nowhere's End in a desert at night, in an ornate orange frame", "text": "It was Nowhere's End, where the Blissmakers found themselves.\n\nWith many great mysteries abound,\nan opportunity, perhaps, for something new to be found."},
    {"src": "assets/book/p11.jpg", "alt": "The Blissmakers make themselves at home", "text": "Never to waste an opportunity for discovery, the Blissmakers salvaged what they could, and made themselves comfortably at home with a delicious blend of tea and songs to keep them happy."},
    {"src": "assets/book/p12.jpg", "alt": "A glowing bell tent at dusk with music notes rising, beside a little tea bar", "text": "Within the warmth created by firelight and friendship, a profound realisation emerged...\n\nNowhere's End is actually\njust Anywhere's Beginning..."},
    {"src": "assets/book/p13.jpg", "alt": "The search for a sign", "text": "But if the beginning is anywhere, then which way to go?\n\nThey searched the wreckage for a sign.\n\nAnd even in the depths of perceived darkness, deep inside, they found it.\n\nA portal into the heart of the Divine and with it, the great remembering..."},
    {"src": "assets/book/p14.jpg", "alt": "A painted card of a glowing red heart under a sun and moon, among flowers", "text": "That Unconditional Love remains ever-present\n\nA boundless, luminous force, the most potent catalyst for transformation.\n\nAnd so, from the ashes of revelation, it became evident that the long voyage was all for a reason as it had given rise to a new story..."},
    {"src": "assets/book/p15.jpg", "alt": "The Mahala emblem: a lotus of coloured leaves above the word Mahala", "text": "MAHALA"},
    {"src": "assets/book/p16.jpg", "alt": "What the name Mahala means", "text": "A name rich in meaning.\n\nMahala means \"Free\" in isiZulu slang.\n\n\"Mahal\" also signifies a Palace or Gathering Place in Arabic and Indian traditions.\n\nThis fusion of cultures reflects a unified vision:\n\nTo create a sanctuary of radical openness, sacred connection, and shared transformation."},
    {"src": "assets/book/p17.jpg", "alt": "Temple builders at work at dusk: people carry beams and climb ladders around a temple of tall white petals, lanterns glowing in the sand", "text": ""},
    {"src": "assets/book/p18.jpg", "alt": "A place to reconnect", "text": "And in these spaces, a beautiful place to reconnect with\nthe Land beneath us,\nthe Nature within us,\nand the boundless Spirit\nthat weaves it all together."},
    {"src": "assets/book/p19.jpg", "alt": "Mahalan Values: Love, Playful Creativity, Co-Creation and Mystery", "text": "Mahalan Values\n\nLOVE\nWe are in service to infinite and unconditional love, crafting spaces that awaken connection to self, others, and the Universe.\n\nPLAYFUL CREATIVITY\nWe honour the power of imagination and play as a pathway to bold expression, joyful collaboration, and meaningful transformation.\n\nCO-CREATION\nWe create opportunities for inner and outer change, inviting all who join us to rediscover their true nature through art, connection, and ritual.\n\nMYSTERY\nWe embrace the unknown, designing experiences that spark awe, contemplation, and a profound connection to the beauty of existence."},
    {"src": "assets/book/p20.jpg", "alt": "Mahalan Values: Transformation, Ubuntu and Harmony with Nature", "text": "TRANSFORMATION\nWe channel the magic of collaboration, weaving together diverse energies to manifest beauty and wonder beyond the sum of its parts.\n\nUBUNTU\nWe embody the African spirit of \"I am because we are,\" rooted in shared humanity and the joy of collective flourishing.\n\nHARMONY WITH NATURE\nWe honor Mother Nature as a source of wisdom, healing, and connection, creating spaces that deepen reverence for the Earth and inspire alignment with its rhythms."},
    {"src": "assets/book/p21.jpg", "alt": "The cover of the Mahala Archetype Deck: eleven silhouettes in a ring of coloured circles around a golden sun, over a red desert", "text": "The Mahala Archetype Deck"},
    {"src": "assets/book/p22.jpg", "alt": "The Archetypes", "text": "The Archetypes\n\nBut what of those who join this mission?\n\nWhat forces dance among us, seeking to find expression?\n\nThrough deep collective inquiry, the Archetypes revealed themselves: primordial energies seeking form, inviting participation, and shaping the co-creation. Thus, the unfolding is not only a collaboration between people, but also a co-creation with these archetypal forces themselves..."},
    {"src": "assets/book/p23.jpg", "alt": "The Alchemist: the card shows a long bearded alchemist in patterned robes, a glowing flask on a table of light, stars and symbols around him", "text": "THE ALCHEMIST\nTransformation Master turning ideas into reality"},
    {"src": "assets/book/p24.jpg", "alt": "The Alchemist: the words of the card and its shadow", "text": "The Alchemist is the master of change, a visionary who transmutes dreams into tangible outcomes. Where others see raw material, the Alchemist sees potential. They blend intuition and intellect, magic and method, to bring forth creation. They see beyond what is, into what could be. They know that beauty and meaning don't just emerge: they are crafted, through presence, patience, and inspired action.\n\nThis card calls on you to recognize the tools already within your grasp (your knowledge, experience, passion, and vision) and begin the sacred process of transformation. Trust the process. Mix, mold, test, refine. What once lived only in your imagination is ready to be brought to life.\n\nWhat are you being called to bring into the world?\n\nSHADOW ASPECT OF THE ALCHEMIST:\n\nWhen the Alchemist is out of alignment, the pursuit of transformation can become obsession or manipulation. You may be attempting to control outcomes, forcing growth without honoring the process. Or perhaps you are stuck in endless planning, endlessly dreaming, never taking action. This can look like perfectionism, burnout, or staying lost in the planning stage, never grounding the vision. Alternatively, it may be the misuse of one's gifts, crafting illusions instead of truth. The shadow Alchemist becomes a trickster, promising gold but delivering nothing but dust.\n\nWhere are you trying to skip the sacred mess of the creative process?"},
    {"src": "assets/book/p25.jpg", "alt": "The Conductor: the card shows a conductor with arms raised before a blazing sun, ribbons of music swirling round", "text": "THE CONDUCTOR\nAligning visions into a cohesive masterpiece, guiding every note into perfect harmony"},
    {"src": "assets/book/p26.jpg", "alt": "The Conductor: the words of the card and its shadow", "text": "With a presence that is both grounding and electrifying, the Conductor is the unseen force that turns chaos into harmony, the sharp mind that weaves together the dreams of many into a singular, breathtaking masterpiece, ensuring that every moving part flows in sync with the greater vision.\n\nThis card represents leadership, coordination, and the ability to bring disparate elements into harmony, suggesting you are in a position to lead, to align people with a shared vision, and create something greater than the sum of its parts. Whether in work, relationships, or personal projects, you are being asked to direct with purpose, balancing structure with intuition while allowing space for improvisation. Trust in your ability to hold the vision while allowing the inputs and perspectives of others weave into the symphony.\n\nWhere are you being asked to step up as the leader of a great vision?\n\nSHADOW ASPECT OF THE CONDUCTOR:\n\nIn their shadow, the Conductor may become overly controlling and rigid, micromanaging every detail to the point of stifling spontaneity and creativity. Instead of guiding with fluidity, they may impose rigid structures, fearing that without their control, everything will fall apart. In this state, the Conductor might struggle with trusting others, feeling the need to oversee every step instead of allowing the natural rhythm of collaboration to play its song. Their obsession with timelines and precision can cause them to miss the beauty of imperfection, rejecting moments of unpredictability that could lead to even greater magic.\n\nHow can you lead with clarity while leaving space for spontaneity?"},
    {"src": "assets/book/p27.jpg", "alt": "The Entertainer: the card shows a laughing performer in a ruffled collar juggling bright balls under ornate arches", "text": "THE ENTERTAINER\nSetting the stage for connection with presence & flair"},
    {"src": "assets/book/p28.jpg", "alt": "The Entertainer: the words of the card and its shadow", "text": "The Entertainer is the radiant energy that draws people together, weaving moments of joy, laughter, and enchantment into the fabric of the experience. With a captivating presence, they dissolve barriers, making strangers feel like old friends and transforming ordinary interactions into unforgettable memories. Whether through storytelling, performance, or an effortless ability to lift the energy of a space, the Entertainer reminds us that playfulness and connection are portals to something deeper.\n\nThis card is calling you to embrace your personal power, to shine without fear, and to create space for others to feel seen and uplifted. The Entertainer understands that joy is a gateway to transformation. By stepping fully into your role as a conduit for wonder, you invite others to do the same.\n\nWhere are you playing small or afraid to be seen under the spotlight?\n\nSHADOW ASPECT OF THE ENTERTAINER:\n\nThe shadow of the Entertainer emerges when the need to captivate and uplift others becomes a mask, hiding insecurities of being truly seen, using a persona to avoid vulnerability while keeping others entertained. They may seek validation through applause, relying on external approval rather than genuine self-worth. This ends up draining their energy in an endless cycle of giving without replenishing, overcompensating with exaggerated antics rather than embracing the quiet power of presence. In an attempt to always take center stage, they might not realize where they are taking away the opportunity for someone else to shine.\n\nThe lesson of the shadow is to recognize that joy and connection must come from an authentic place. True magic happens when the Entertainer allows themselves to be seen, not just for their performance, but for their real, unpolished self.\n\nHow can you use joy as a tool for deeper connection and meaning?"},
    {"src": "assets/book/p29.jpg", "alt": "The Guardian: the card shows a winged guardian in golden armour holding a staff, a halo of light behind", "text": "THE GUARDIAN\nProtector of truth, keeper of trust, holder of space"},
    {"src": "assets/book/p30.jpg", "alt": "The Guardian: the words of the card and its shadow", "text": "The Guardian stands firm as the protector of people, energy and the sacred. They create a container for safety, ensuring all who enter feel held and supported. Their grounded presence is like an ancient tree with deep roots, unshakable and devoted. The Guardian is not just a keeper of boundaries but a guide, helping others understand what must be preserved and what must be released.\n\nThis card appears when you are called to stand in protection, whether of yourself, a loved one, a vision, or a sacred space in your life. You may need to set clearer boundaries, honor your own limits, or watch over something precious. Trust that your presence holds immense power. Stand firm in your values and create space for what truly matters, whether that's a dream, a relationship, a truth, or a place. Know that your strength lies in your devotion.\n\nWhat boundaries do you need to honor in order to protect something meaningful?\n\nSHADOW ASPECT OF THE GUARDIAN:\n\nThe Guardian's Shadow emerges when protection turns into control, and care becomes suffocation. Operating from fear of harm, change, or loss, they build walls so high that nothing new can enter. It may manifest as distrust, or resistance to allowing others to navigate their own journey.\n\nThis shadow can also lead to martyrdom, where the Guardian exhausts themselves in service to others, feeling burdened rather than empowered. Their watchful eye can become an unyielding grip, mistaking control for safety.\n\nThis card invites you to reflect on whether your protective instincts are serving your growth or keeping you caged. Examine where protection has turned into limitation.\n\nWhere are you shielding yourself or others from growth?"},
    {"src": "assets/book/p31.jpg", "alt": "The Magician: the card shows a grinning magician in a wide brimmed hat, a top hat and cards on the table before him, a rubber duck appearing", "text": "THE MAGICIAN\nMaster of wonder & awe through the unexpected"},
    {"src": "assets/book/p32.jpg", "alt": "The Magician: the words of the card and its shadow", "text": "A master of transformation, the Magician conjures awe through the unexpected: illusions that defy reality, a whisper of magic woven into the air, a perfectly timed moment, a ritual of renewal, a piece of art that speaks directly to the soul, creating enchanting experiences that feel otherworldly and linger through the space of time.\n\nTheir touch turns the mundane into the mystical, revealing the hidden forces that weave through existence. But, their magic is more than a quick trick of the hand. It is a deep understanding of how to shape reality, inviting others to believe in possibilities beyond their own imagination.\n\nThis card is calling you to step into your creative power. Recognize the tools at your disposal, and use them with intention. Whether through art, words, or action, you have the ability to inspire and transform. Trust in your craft, embrace the mystery, and remember that magic is not just in what you create but in how you share it with the world.\n\nWhat illusions are you ready to shatter to reveal the deeper magic within?\n\nSHADOW ASPECT OF THE MAGICIAN:\n\nThe shadow of the Magician archetype emerges whilst the Magician is caught in the endless pursuit of more and forgets to look up. There is stillness between spells and true magic waits, yet they are consumed by the need to prove their power. They chase the next ritual, the next sacred object, the next spark of awe, forgetting that the greatest magic is often found in the ordinary, the breath, the quiet unfolding of now. In the Shadow, they cease to listen, to witness, to BE. They forget that presence is power. That just being, in full authenticity, in heartful stillness, is a portal to the miraculous. They over-identify with doing, performing, crafting... forgetting the inherent magic in their being.\n\nHow can you pay more attention to miracles that are unfolding around you?"},
    {"src": "assets/book/p33.jpg", "alt": "The Muse: the card shows a muse with flowing rainbow hair releasing a burst of golden light, flowers and stars swirling", "text": "THE MUSE\nSparks creativity & inspiration with authentic beauty"},
    {"src": "assets/book/p34.jpg", "alt": "The Muse: the words of the card and its shadow", "text": "Radiant, inspiring, and endlessly creative, the Muse is the spark that ignites imagination in others. Their presence alone stirs dreams to life, unlocking new possibilities and unseen potential. They can influence without words and create awe without effort. Whether through art, movement, or sheer presence, they channel an energy that awakens something deep within those around them, inviting others to shift perspectives and step into their own creative power.\n\nThe Muse reminds us that creation is not just about doing; it's about feeling, believing, and becoming. This card is calling you to embrace your unique magic and share it with the world. Whether through art, words, ideas or energy, you have the power to inspire those around you. Let your presence spark something in others: remind them of what is possible when imagination leads the way.\n\nHow can you become a living invitation for inspiration?\n\nSHADOW ASPECT OF THE MUSE:\n\nThe shadow of the Muse is elusiveness, self-doubt, and ungrounded inspiration. While they have the power to ignite creativity in others, they may struggle to channel their own brilliance into tangible action. The Muse's energy can become overwhelming or chaotic, flooding others with too many ideas without grounding them in reality, leaving ideas half-formed and unfinished.\n\nAt times, the Muse may crave validation, relying too much on external admiration rather than their own internal sense of worth. If their inspiration goes unrecognized, they can fall into melancholy, feeling unseen or unappreciated, questioning whether their contributions truly matter.\n\nTrue mastery comes when the Muse learns to harness their creativity with intention, becoming not just a source of inspiration, but a force of meaningful transformation.\n\nAre you inspiring others while also nurturing your own creativity?"},
    {"src": "assets/book/p35.jpg", "alt": "The Mother: the card shows a mother with long red hair holding a baby, wrapped in flowers, sun and moon medallions around her", "text": "THE MOTHER\nThe heart of creation & the power of love"},
    {"src": "assets/book/p36.jpg", "alt": "The Mother: the words of the card and its shadow", "text": "Nurturing and steadfast, the Mother is the heart of her community, holding space for belonging where all feel welcome to bring their burdens or joys. She embodies compassion, patience, and the quiet strength that holds everything together. She is a symbol of creation and deep wisdom, representing the power of unconditional love, protection, and the ability to foster growth, whether in relationships, projects, or self-discovery.\n\nThis card suggests you are in a phase of nurturing something important, whether it's a dream, a community, or your own healing. The Mother reminds you to honor cycles, understanding that all seeds of creation must be planted, tended, and allowed to grow in their own time.\n\nWhat needs nurturing in your life so that it can flourish?\n\nSHADOW ASPECT OF THE MOTHER:\n\nWhen reversed, the Mother archetype can indicate self-sacrifice to the point of depletion or over-protection that stifles growth. The shadow of the Mother emerges when nurturing turns into control, martyrdom, or smothering. Instead of fostering growth, she may overprotect, manipulate, or make others dependent on her care. Are you nurturing from a place of abundance, or are you pouring from an empty cup? Are you holding on too tightly to something that needs space to evolve? This could also be a sign of neglect, a reminder that true care must include your own well-being.\n\nThe key to healing the shadow of the Mother is balance: learning to give without losing oneself, to love without possessing, and to nurture without controlling. True maternal energy empowers others to stand on their own while still providing warmth and support.\n\nWhere do you need to trust the natural flow of growth and change?"},
    {"src": "assets/book/p37.jpg", "alt": "The Sage: the card shows a white bearded sage in green robes reading a great open book, a staff and stars around him", "text": "THE SAGE\nStoryteller & keeper of wisdom, finding deeper meaning in every moment"},
    {"src": "assets/book/p38.jpg", "alt": "The Sage: the words of the card and its shadow", "text": "The Sage is the eternal seeker of wisdom, the one who walks between the known and the unknown, distilling truth from experience. They are the storytellers, the mentors, the keepers of sacred knowledge who illuminate the path for others. The Sage remains open to learning, knowing that wisdom is not about having all the answers, but about asking the right questions. They ground others with their insight and perspective, while holding purpose and deeper meaning at the forefront of every decision. The true essence of a Sage is the ability to embrace the unknown. True wisdom isn't about certainty but about being comfortable with life's mysteries.\n\nThis card calls you to embrace your inner wisdom: not just the knowledge you've gathered from books or teachings, but the deep, intuitive knowing that comes from lived experience. Share this knowledge with others. Your experiences hold value. Who might benefit from your insights?\n\nSHADOW ASPECT OF THE SAGE:\n\nInstead of guiding others with insight, the shadow Sage may hoard knowledge rather than share it. The shadow Sage may also develop an over-reliance on intellect, avoiding emotional depth or personal connection. Their endless seeking may trap them in a cycle of learning but not applying, using learning as an escape from action. Or, they may reject perspectives that challenge their beliefs, clinging to rigid opinions and becoming isolated in their pursuit of understanding. Trapped in their own intellectual arrogance, the shadow emerges as dismissive and detached, refusing to acknowledge the wisdom found in different perspectives.\n\nThe Sage's greatest lesson in shadow is humility: true wisdom is not about having all the answers, but about staying open to learning and to empower others to seek their own inner wisdom while guiding them on their way.\n\nWhere in your life can you embrace a beginner's mindset, allowing curiosity to dissolve old paradigms and reveal a new truth?"},
    {"src": "assets/book/p39.jpg", "alt": "The Seeker: the card shows a young explorer in a tricorn hat and long coat on the deck of a ship, a balloon rising behind", "text": "THE SEEKER\nFollows intuition with a spirit of exploration"},
    {"src": "assets/book/p40.jpg", "alt": "The Seeker: the words of the card and its shadow", "text": "The Seeker arrives with wide eyes and an open heart, embodying the essence of curiosity and discovery. They are the traveler, the questioner, the wanderer. Ever in pursuit of wisdom, they question, explore, and seek deeper understanding, forever drawn to the mysteries of people and purpose.\n\nEven in the vast expanse of the unknown, the Seeker walks with reverence, finding magic hidden in the smallest details. They are the ones who illuminate the way, inviting all who cross their path to embark on their own transformative quests. They uncover the unseen, guide others toward revelation, and remind us all that the journey itself is just as profound as the destination.\n\nThis card is calling you to embrace the unknown with wonder, to ask the big questions, and to trust that every step forward reveals new layers of truth. Follow your curiosity, let it lead you beyond the familiar, and open yourself to the lessons hidden in each experience.\n\nWhat truth is waiting to be uncovered if you dare to look beyond the surface?\n\nSHADOW ASPECT OF THE SEEKER:\n\nWhile the Seeker embodies curiosity, growth, and the pursuit of deeper truths, its shadow emerges when the journey becomes an endless chase, never satisfied, never arriving. The Seeker becomes restless, ungrounded, and addicted to the quest itself, believing that the next book, the next teacher, or the next experience will finally provide the answers they crave. This can lead to spiritual bypassing, where they avoid sitting with discomfort or integrating what they've already learned.\n\nAt its deepest level, the shadow of the Seeker is a fear of arriving, because if they ever stop searching, they might have to face themselves and they may struggle to trust their own wisdom. But the answers are not always external; sometimes, the journey is about uncovering what has been within you all along.\n\nWhat would happen if you stopped searching and allowed yourself to simply be?"},
    {"src": "assets/book/p41.jpg", "alt": "The Trickster: the card shows a grinning jester in red and black lounging beside a laughing mask, playing cards and suns around", "text": "THE TRICKSTER\nPlayfully unpredictable creating moments of joy & chaos"},
    {"src": "assets/book/p42.jpg", "alt": "The Trickster: the words of the card and its shadow", "text": "Playful and unpredictable, the Trickster keeps everyone on their toes with a wink and a joke, dancing on the edge with mischief and wit. They are the spark that lights the room, the laughter that breaks tension, the instigator of unexpected moments. Their presence weaves magic into the air, as they conjure surprises that inspire and delight.\n\nThe Trickster reminds us that joy, disruption, and chaos can be profound teachers. They shake us free from rigid expectations and invite us to see life through a new lens where creativity, resilience, and new perspectives emerge. The Trickster forces us to adapt, grow, and see beyond our assumptions. They prove that wisdom and play are not opposites but partners in transformation.\n\nThis card is calling you to shake up your life, embrace spontaneity, release attachment to plans, and find more room for creativity and play.\n\nWhere can you surrender to the chaos and discover new solutions where familiar ones are no longer working?\n\nSHADOW ASPECT OF THE TRICKSTER:\n\nWhile the Trickster is incredibly intelligent and witty, the shadow side can use wit as a weapon, turning jokes into a tool for hiding vulnerability behind sarcasm. Their cleverness becomes a mask, their surprises a means of control. Constantly caught up in the whirlwind, the Trickster can forget to read the room and tune into the sensitivity or emotional needs of others.\n\nWhere might you have a tendency to distract, creating unnecessary chaos that derails progress rather than sparking transformation?"},
    {"src": "assets/book/p43.jpg", "alt": "The Wild One: the card shows a wild woman crowned with branches beside a grey wolf, an eagle and swirling leaves around her", "text": "THE WILD ONE\nUntamed spirit channeling raw energy embodying liberation & fearless creativity"},
    {"src": "assets/book/p44.jpg", "alt": "The Wild One: the words of the card and its shadow", "text": "The Wild One bursts onto the scene like a streak of lightning, untamed and electric. She channels raw energy, fearless creativity, and an unapologetic embrace of the unknown. The Wild One disrupts stagnation, igniting passion and encouraging others to break free from limitations. Inspiring others to let go, dance, and howl at the moon, she is a reminder that true creation is not meant to be controlled; it is meant to be felt, expressed, and lived.\n\nWhen this card appears, it is calling you to unleash your inner fire. Your wild ideas and rebellious nature are exactly what is needed. Stop overthinking and start doing. Break the rules that once bound you. The Wild One does not conform: they rewrite the script with courage and joy. Trust your instincts. Creativity doesn't come from playing it safe. Take the leap, say yes to adventure, and let your heart lead the way. Inspire others by being your fullest self. Your authenticity gives others permission to embrace their own.\n\nWhere are you craving freedom, and what fears are keeping you from fully stepping into it?\n\nSHADOW ASPECT OF THE WILD ONE:\n\nThe Wild One's raw and electrifying energy, if unchecked, can turn passion into chaos, freedom into recklessness. Pushing boundaries is powerful, but not at the expense of collaboration. The shadow of this card warns against burning bridges, chasing novelty without depth, or ignoring the impact of your actions. The Wild One's instinct is to roam, but this can turn into running from commitment, dodging accountability, a refusal to listen to others or the inability to see things through. When ungrounded, the Wild One can often mistake impulse for intuition, acting on every whim without discernment.\n\nThe Wild One thrives in independence, but in the shadow, they may reject teamwork, refuse guidance, or dismiss others' needs in pursuit of their own desires. Fighting against rules or expectations without purpose can lead to self-sabotage rather than true freedom. Wildness is a gift when channeled wisely."}
  ],
  chapters: [{"title": "For those who dare to wander", "page": 1}, {"title": "The Story of Mahala", "page": 5}, {"title": "Nowhere's End and back again", "page": 7}, {"title": "A name rich in meaning", "page": 15}, {"title": "Mahalan Values", "page": 19}, {"title": "The Archetypes", "page": 21}, {"title": "The Alchemist", "page": 23, "sub": true}, {"title": "The Conductor", "page": 25, "sub": true}, {"title": "The Entertainer", "page": 27, "sub": true}, {"title": "The Guardian", "page": 29, "sub": true}, {"title": "The Magician", "page": 31, "sub": true}, {"title": "The Muse", "page": 33, "sub": true}, {"title": "The Mother", "page": 35, "sub": true}, {"title": "The Sage", "page": 37, "sub": true}, {"title": "The Seeker", "page": 39, "sub": true}, {"title": "The Trickster", "page": 41, "sub": true}, {"title": "The Wild One", "page": 43, "sub": true}] };
/* Temple Tech: the six copper forms (Set 3, around the temple), the centrepiece, the big coil and the pendants */
const PODS_INFO = {
  TETRA: { name: 'Tetrahedron', element: 'Fire', where: 'East north east, by the way in', hubs: 4, struts: 6, edge: '2.695', height: '2.20', tube: '16.2', opp: 'POD_VE',
    faces: 'four triangles', means: 'The simplest solid: four points, the fewest that can hold a space. Plato paired it with fire. It is the first form you pass on the way in.' },
  ICOSA: { name: 'Icosahedron', element: 'Water', where: 'East south east, by the way in', hubs: 12, struts: 30, edge: '1.735', height: '2.62', tube: '52.1', opp: 'POD_DODECA',
    faces: 'twenty triangles', means: 'The roundest of the forms made only of triangles. Plato paired it with water. It flanks the way in with the tetrahedron.' },
  OCTA: { name: 'Octahedron', element: 'Air', where: 'South', hubs: 6, struts: 12, edge: '2.334', height: '1.91', tube: '28.0', opp: 'POD_CUBE',
    faces: 'eight triangles', means: 'Two pyramids, base to base. Plato paired it with air. Its partner, the cube, faces it across the temple: put a point at the centre of each face of one and you have the other.' },
  VE: { name: 'Vector equilibrium', element: 'Balance, the mother form', where: 'West south west', hubs: 12, struts: 24, edge: '1.650', height: '2.33', tube: '39.6', opp: 'POD_TETRA',
    faces: 'eight triangles and six squares', means: 'Not one of Plato\'s five: Buckminster Fuller\'s vector equilibrium, the cuboctahedron. Every edge is as long as the distance from the centre to each corner, so all its forces sit in balance. It is the mother form of the set.' },
  DODECA: { name: 'Dodecahedron', element: 'Aether, the heavens', where: 'West north west', hubs: 20, struts: 30, edge: '1.178', height: '2.62', tube: '35.3', opp: 'POD_ICOSA',
    faces: 'twelve pentagons', means: 'Twelve pentagons. Plato kept it for the whole of the heavens; later writers called it aether. Its partner, the icosahedron, faces it across the temple.' },
  CUBE: { name: 'Cube', element: 'Earth', where: 'North', hubs: 8, struts: 12, edge: '1.905', height: '1.91', tube: '22.9', opp: 'POD_OCTA',
    faces: 'six squares', means: 'Six squares, the form that sits square on the ground. Plato paired it with earth. Its partner, the octahedron, faces it across the temple.' },
};
const POD_CENTRES = { TETRA: [9.802, 0.55, -5.659], CUBE: [0, 0.953, -11.319], OCTA: [0, 0.953, 11.319], VE: [-9.802, 1.167, 5.659], DODECA: [-9.802, 1.311, -5.659], ICOSA: [9.802, 1.311, 5.659] };
const TECH_ORDER = ['CENTRE', 'MAHAL_COIL', 'COIL_140', 'PENDANT', 'POD_TETRA', 'POD_ICOSA', 'POD_OCTA', 'POD_VE', 'POD_DODECA', 'POD_CUBE'];
const SPOT = {
  CENTRE: { eye: 'Temple Tech · the heart of the temple', title: 'The centrepiece', chips: [['Concept model', 'wait'], ['Stirrer being tested', 'now']],
    what: 'A glass egg resting on a nest of copper coil, on a carved hardwood column at the very centre of the temple, under the open crown.',
    how: 'The nest is a black ring, 3D-printed with grooves like the 140 mm coil and sized, like every part of the centrepiece, by the golden ratio. Two windings of 3 mm copper cross in its grooves: one lies in deep channels and one in shallow channels, so the copper passes cleanly over itself, and each goes seven times through the hole for every eight times round the ring. Under the egg a magnet turns and a stir bar in the water follows it, drawing the water into a slow vortex. Whether a stirrer can do that through the glass is still being tested.',
    means: 'A torus flows out, around and back in through its own centre. Here it holds the egg, the seed at the heart of the temple. The same grooved ring and the same winding run through the big coil at the camp, the coils you can hold and every pendant, so each one carries the pattern back to this centre: one field, many hands around it.',
    facts: [['Column', '<span class="mono">1.02 m</span> to the top, six hardwood panels'], ['Egg', '<span class="mono">0.39 m</span> high, blunt end down'], ['Water', 'about <span class="mono">15</span> litres'], ['Coil', 'Two windings: 8 times round, 7 through'], ['Copper', 'about <span class="mono">77 m</span> of 3 mm wire'], ['Light', 'A warm white ring under the egg'], ['Sizes', 'From the temple\'s base radius, <span class="mono">4.32 m</span>, divided by the golden ratio again and again']] },
  MAHAL_COIL: { eye: 'Temple Tech · at the camp', title: 'The big coil', chips: [['Made by hand', 'done'], ['Temple Tech', 'c-cyan']], render: ['render_coil_big', 'The big coil, rendered'], photos: [['photo_coil_pole', 'On the centre pole'], ['photo_coil_figure', 'On a carved figure']],
    what: 'A black ring wound by hand with copper wire, about 40 cm across. It sits on the centre pole of the Lotus Mahal, the camp\'s temple tent, at heart height.',
    how: 'The black ring is 3D-printed with grooves that guide two windings that cross. One runs in deep channels and one in shallow channels, so the copper passes cleanly over itself. Each winding goes seven times through the hole as it circles the ring eight times, then meets its own start. Shown here as the 140 mm ring, scaled up.',
    means: 'The camp\'s centre, and the big sister of the pendants: the same pattern at a size you can stand beside. Winding it is slow, careful work, and the care is part of the piece.',
    facts: [['Across', 'about <span class="mono">40 cm</span>'], ['Where', 'The centre pole of the Lotus Mahal, <span class="mono">1.2 to 1.4 m</span> up'], ['Windings', 'Two that cross, each 8 times round and 7 times through'], ['Made', 'A 3D-printed grooved ring, wound by hand'], ['Gift', 'A big coil is a gift at Gate 4']] },
  COIL_140: { eye: 'Temple Tech · to hold', title: 'The 140 mm coil', chips: [['Made by hand', 'done'], ['Gate 4', 'c-cyan']], render: ['render_coil_140', 'The 140 mm coil, rendered'],
    what: 'A black ring 140 mm across with a 43.8 mm hole, 3D-printed with grooves and wound by hand with copper wire. It sits in two hands.',
    how: 'Two windings cross on the ring. One lies in deep channels and one in shallow channels, so one passes cleanly over the other where they cross. Each goes seven times through the hole as it circles the ring eight times, then closes on itself. The raised black lands between the grooves make the diamond pattern you see.',
    means: 'The same pattern as the big coil at the camp, the pendants and the nest under the egg in the temple, at the size of a gift you can hold. A big coil is one of the gifts at Gate 4.',
    facts: [['Across', '<span class="mono">140 mm</span>'], ['Hole', '<span class="mono">43.8 mm</span>'], ['Windings', 'Two that cross, each 8 times round and 7 times through'], ['Made', 'A 3D-printed grooved ring, wound by hand'], ['Gift', 'A big coil is a gift at Gate 4']] },
  PENDANT: { eye: 'Temple Tech · to wear', title: 'The pendants', chips: [['First batch: 60 pendants', 'wait'], ['Gate 2', 'c-cyan']], render: ['render_pendant', 'A pendant, rendered'],
    what: 'A small copper coil to wear: a black ring 30 to 40 mm across, grooved and wound by hand in the same pattern as the big coil, on a braided cord looped through its hole.',
    how: 'The ring is 3D-printed with the same grooves as the bigger coils, at a quarter of the size. Fine copper wire is wound into them by hand, two windings that cross, until each closes on itself. The first batch is 60 pendants.',
    means: 'A sign that you are part of the field: everyone who wears one is building the same temple, wherever they are.',
    facts: [['Size', '<span class="mono">30 to 40 mm</span> across'], ['First batch', '<span class="mono">60</span> pendants'], ['Made', 'A 3D-printed ring, wound by hand in copper'], ['Gift', 'Gate 2, the Lotus Mahal']] },
};
for (const k in PODS_INFO) { const f = PODS_INFO[k];
  SPOT['POD_' + k] = { eye: `The copper forms · ${f.where}`, title: f.name, chips: [[f.element, 'c-cyan'], ['First arrangement', 'wait']],
    what: `A space frame of copper tube and copper ball hubs: ${f.faces}, ${f.hubs} hubs and ${f.struts} struts, drawn inside a sphere 1.65 m in radius. It stands 11.32 m from the centre of the temple, on one of the six outer circles of the floor pattern.`,
    how: 'Each strut is cut 80 mm shorter than the distance between hub centres, so it seats 40 mm from each hub centre. All six forms share the one sphere, and its size comes from the same golden-ratio ladder as the temple and the floor, where each size is the one before divided by the golden ratio: 11.32, 7.00, 4.32, 2.67 and 1.65 m.',
    means: f.means + ' Together the six forms ring the temple: the old building blocks of the world, gathered around one centre.',
    facts: [['Hubs and struts', `<span class="mono">${f.hubs}</span> and <span class="mono">${f.struts}</span>`], ['Edge', `<span class="mono">${f.edge} m</span>, hub to hub`], ['Top hub', `<span class="mono">${f.height} m</span> up`], ['Copper tube', `<span class="mono">${f.tube} m</span> in all`], ['Faces it', PODS_INFO[f.opp.slice(4)].name]] };
}
const JOURNEY = [
  ['Dream', 'done', 'seed', 'The vision'], ['Design', 'done', 'pen', 'Oct 2026'], ['Film', 'done', 'film', 'Oct 2026'],
  ['Fund', 'now', 'gift', 'Now'], ['Fabricate', '', 'tools', 'Next'], ['Build at Tankwa', '', 'dome', 'Apr 2027'], ['Light it', '', 'light', 'Burn week'],
];

/* ---------- static UI ---------- */
function renderStepper(el, mobile = false) {
  el.innerHTML = `<header><b>The temple's journey</b><span class="chip now">Funding now</span><small>3 of 7 steps</small></header>
    <div class="track"><span class="fill"></span>${JOURNEY.map(([n, s, ic, sub]) => `<div class="stp ${s}"><span class="c">${s === 'done' ? icon('check') : icon(ic)}</span><b>${n}</b><small>${sub}</small></div>`).join('')}</div>`;
}
renderStepper($('#stepper'));

const TABS = [['story', 'Story'], ['gates', 'Gates'], ['events', 'Events'], ['quests', 'Quests'], ['crews', 'Crews'], ['roles', 'Roles'], ['tech', 'Temple Tech']];
let tab = 'story';
const EXPLORE = { open: false }, V5_LIVE = [];
const pinOn = () => !story.on && !fire.on && !inside && ((EXPLORE.open && tab === 'quests') || !!(current && /^Q-/.test(current)));    // v5: the lists stay closed until you open one; layers that wait for the shared database
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, label]) => `<button class="tab" role="tab" aria-selected="${k === tab && EXPLORE.open}" data-tab="${k}">${label}</button>`).join('') + `<button class="iconbtn tabs-x" type="button" data-tab="close" aria-label="Close the list">${icon('x')}</button>`;
  $('.lists').classList.toggle('open', EXPLORE.open);
  const P = $('#panel'), N = $('#panelNote');
  const r = (id, lead, title, sub, right) => `<button class="row" data-sel="${id}">${lead}<span><b>${esc(title)}</b><small>${sub}</small></span>${right}${icon('right')}</button>`;
  if (tab === 'quests') { P.innerHTML = DATA.quests.map(q => r(q.id, `<span class="lead ${q.tone}">${q.id.slice(2)}</span>`, q.name, `${q.crew} · ${q.stage}`, ME.quests[q.id] ? `<span class="chip done">Yours</span>` : q.open ? `<span class="chip open">Open to all</span>` : `<span class="chip wait">Crew</span>`)).join(''); N.textContent = 'Two quests are open to everyone. The rest belong to a crew: join one from the camp.'; }
  if (tab === 'gates') { P.innerHTML = DATA.gates.map(g => r(g.id, `<span class="lead ${'ycm'[(g.n - 1) % 3]}">${g.n}</span>`, g.name, esc(spaceOf(g)), `<span class="amt">${esc(g.amount.replace(' to ', ' to\u00a0'))}</span>`)).join(''); N.textContent = 'Each gate is a way to give, with its own gift. Working amounts, not final. No payment is taken here yet.'; }
  if (tab === 'events') { P.innerHTML = DATA.events.map(e => r(e.id, `<span class="lead g">${icon('cal')}</span>`, e.name, esc(e.format), (LIVE.leads.events || {})[e.id] ? `<span class="chip done">${esc(LIVE.leads.events[e.id])}</span>` : `<span class="chip wait">${e.date === 'Site being chosen' ? 'Planning' : 'To be set'}</span>`)).join(''); N.textContent = 'Dates and guests are announced once they are confirmed.'; }
  if (tab === 'crews') { P.innerHTML = DATA.crews.map(c => r(c.id, `<span class="lead g">${icon('users')}</span>`, c.name, esc(c.what), ME.crew === c.id ? `<span class="chip done">${ME.crewOk ? 'Yours' : 'Asked'}</span>` : c.build ? `<span class="chip c-cyan">Build crew</span>` : `<span class="chip now">Forming</span>`)).join(''); N.textContent = 'Choose a crew and join it from its card.'; }
  if (tab === 'roles') { P.innerHTML = DATA.roles.map(x => r(x.id, `<span class="lead g">${icon('star')}</span>`, x.name, esc(x.crew), `<span class="chip open">Open</span>`)).join(''); N.textContent = 'Roles are open to anyone with the skills and the time.'; }
  if (tab === 'story') { P.innerHTML = STORY.map((c, i) => `<button class="row" data-story="${i}"><span class="lead ${'ycm'[i % 3]}">${i + 1}</span><span><b>${esc(c.title)}</b><small>${esc(c.lines[0])}</small></span><span></span>${icon('play')}</button>`).join('')
      + r('BOOK', `<span class="lead g">${icon('book')}</span>`, 'The Book of Mahala', 'On the plinth at the way in', `<span class="chip c-yellow">Book</span>`)
      + r('DECK', `<span class="lead g">${icon('star')}</span>`, 'The Mahala Archetype Deck', 'Beside the book', `<span class="chip c-magenta">Cards</span>`)
      + FIRESIDE.map(p => `<button class="row" data-fire="${p.id}"><span class="lead g">${icon('flame')}</span><span><b>${esc(p.title)}</b><small>${p.kind} by the fire${p.when ? ' · ' + p.when : ''}</small></span><span class="chip c-yellow">${p.kind}</span>${icon('right')}</button>`).join('')
      + VERSES.map(v => r(v.id, `<span class="lead g">${icon('pen')}</span>`, v.title, esc(FIRE_BY[v.piece].title), `<span class="chip done">Verse</span>`)).join(''); N.textContent = 'The film\'s draft story, the Book of Mahala, and poems and stories by camp mates.'; }
  if (tab === 'tech') { P.innerHTML = TECH_ORDER.map(id => { const sp = SPOT[id]; const isPod = id.startsWith('POD_'); return r(id, `<span class="lead g">${icon(isPod ? 'forms' : 'torus')}</span>`, sp.title, isPod ? `Copper form · ${esc(PODS_INFO[id.slice(4)].element)}` : esc(sp.eye.split(' · ')[1]), `<span class="chip c-cyan">Spotlight</span>`); }).join(''); N.textContent = 'Temple Tech, an art and research practice, works with light, coils and sacred geometry, in copper, wood and craft.'; }
  if (tab === 'journey') { P.innerHTML = `<div class="stepper m" style="width:auto;padding:10px 6px"></div>`; renderStepper($('.stepper.m', P)); N.textContent = ''; }
  $$('.row', P).forEach(b => b.classList.toggle('sel', b.dataset.sel === current));
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; const k = b.dataset.tab;
  if (k === 'close' || (k === tab && EXPLORE.open)) EXPLORE.open = false; else { tab = k; EXPLORE.open = true; } renderTabs(); });
$('#panel').addEventListener('click', e => { const st = e.target.closest('[data-story]'); if (st) { startStory(+st.dataset.story); return; } const f = e.target.closest('[data-fire]'); if (f) { openFireside(f.dataset.fire); return; } const b = e.target.closest('[data-sel]'); if (b) select(b.dataset.sel); });
$('#nextUp').addEventListener('click', () => select('Q-01'));

/* ---------- renderer and scene ---------- */
const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#loadMsg').textContent = 'This prototype needs WebGL, which this browser has turned off.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 4000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog(0xf2e6d4, 260, 1500);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 10; controls.maxDistance = 360;
controls.minPolarAngle = 0.18; controls.maxPolarAngle = 1.36;
controls.screenSpacePanning = false; controls.zoomSpeed = 0.9; controls.rotateSpeed = 0.6;
controls.addEventListener('change', () => { const t = controls.target; t.y = clamp(t.y, 0, 12); const r = Math.hypot(t.x, t.z); if (r > 250) { t.x *= 250 / r; t.z *= 250 / r; } });

const sun = new THREE.DirectionalLight(0xfff2e0, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfdcea, 0xe6d8c3, 1.0);
scene.add(hemi);
const lantern = new THREE.PointLight(0xffdcae, 0, 34, 1.5); lantern.position.set(0, 3.0, 0); scene.add(lantern);
const campLight = new THREE.PointLight(0xffc98a, 0, 40, 1.6); campLight.position.copy(wayP(ST.camp)).setY(5); scene.add(campLight);
const yardLight = new THREE.PointLight(0xfff0d8, 0, 38, 1.6); yardLight.position.copy(YL(-4, 6, -1)); scene.add(yardLight);
const mahalLight = new THREE.PointLight(0xffc98a, 0, 10, 1.6); mahalLight.position.set(CAMP.x + 0.5, 2.5, CAMP.z + 0.5); scene.add(mahalLight);
const fireLight = new THREE.PointLight(0xff9a52, 0, 13, 2); scene.add(fireLight);
const FX = { night: 0, flare: 0, at: V3(), flames: [], embers: null, bed: null, glow: null, light: fireLight };

/* sky dome, tone mapped like the rest of the scene */
const skyU = { top: { value: new THREE.Color(0x8fb2d4) }, hor: { value: new THREE.Color(0xf2e6d4) }, sunDir: { value: V3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff0d0) }, glow: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(hor, top, pow(smoothstep(0.0, 0.62, h), 0.7));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35 * glow + pow(s, 3.0) * 0.12 * glow);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10; scene.add(sky);

/* stars */
const starGeo = new THREE.BufferGeometry(); { const p = []; const rnd = mulberry(11); for (let i = 0; i < 1600; i++) { const u = rnd(), v = rnd() * 0.92 + 0.08; const th = u * Math.PI * 2, ph = Math.acos(v); p.push(Math.sin(ph) * Math.cos(th) * 2200, Math.cos(ph) * 2200, Math.sin(ph) * Math.sin(th) * 2200); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
scene.add(stars);

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- the playa ---------- */
function crackTexture(size = 512, cells = 9, seed = 7) {
  const rnd = mulberry(seed), pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.12 + 0.76 * rnd()) / cells, (j + 0.12 + 0.76 * rnd()) / cells]);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const img = g.createImageData(size, size), D = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      let ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
      if (ii < 0) { ii += cells; ox = -1; } else if (ii >= cells) { ii -= cells; ox = 1; }
      if (jj < 0) { jj += cells; oy = -1; } else if (jj >= cells) { jj -= cells; oy = 1; }
      const p = pts[jj * cells + ii], dx = p[0] + ox - u, dy = p[1] + oy - v, dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    const e = Math.sqrt(d2) - Math.sqrt(d1), crack = 1 - Math.min(1, e / 0.005);
    const val = clamp(1 - crack * 0.2 - Math.sqrt(d1) * 0.07 + (rnd() - 0.5) * 0.035, 0, 1) * 255, i4 = (y * size + x) * 4;
    D[i4] = val; D[i4 + 1] = val * 0.985; D[i4 + 2] = val * 0.962; D[i4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const crack = crackTexture();
crack.repeat.set(2400 / 13, 2400 / 13);
const groundMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc8, map: crack, roughness: 1, metalness: 0, envMapIntensity: 0.4 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), groundMat);
ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);

/* ---------- materials ---------- */
const ENV = [];
function std(color, o = {}) { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0, envMapIntensity: 0.55 }, o)); ENV.push(m); return m; }
const M = {
  pine: std(0xc9a17a, { roughness: 0.72 }), pineDark: std(0xa7845f), rim: std(0xb98a5d, { roughness: 0.7 }),
  fillA: std(0xe3cba7, { roughness: 0.75, side: THREE.DoubleSide }), fillB: std(0xdcbd9a, { roughness: 0.75, side: THREE.DoubleSide }),
  steel: std(0x8d9096, { metalness: 0.6, roughness: 0.4 }), capSkin: std(0xd8b48a), capRing: std(0xc49b6f), gold: std(0xd4aa3c, { metalness: 0.75, roughness: 0.3 }),
  fgCopper: std(0xb8743f, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), fgTeal: std(0x2b8c8a, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), fgAmber: std(0xe3a33b, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), fgPearl: std(0xf6f1e8, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  person: std(0xe8e3db, { roughness: 0.85 }),
  canvas: std(0xf4eee3, { roughness: 0.9, side: THREE.DoubleSide }), canvas2: std(0xece2d2, { roughness: 0.9, side: THREE.DoubleSide }),
  lotus: std(0xecc8d5, { roughness: 0.85, side: THREE.DoubleSide }), lotusIn: std(0xf6e6ec, { roughness: 0.9, side: THREE.DoubleSide }),
  stone: std(0x9b958d, { roughness: 0.95 }), pole: std(0x8d7a66), dark: std(0x2d2a28, { roughness: 0.6 }),
  container: std(0x2b7f98, { roughness: 0.55, metalness: 0.2 }), grey: std(0x8e959c, { roughness: 0.6, metalness: 0.3 }), ply: std(0xdcc19d),
  pad: std(0xded3c3, { roughness: 1 }), path: std(0xf4eee4, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  road: std(0xd9cfbf, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  bakkie: std(0xf3f1ea, { roughness: 0.45, metalness: 0.1 }), glassDark: std(0x55708a, { roughness: 0.2, metalness: 0.2 }), copper: std(0xc07a45, { metalness: 0.7, roughness: 0.35 }),
};
const GLASS = {};
for (const [k, hex] of [['yellow', 0xffd81f], ['cyan', 0x14a8e0], ['magenta', 0xd8197f]]) {
  GLASS[k] = std(hex, { transparent: true, opacity: 0.58, roughness: 0.12, side: THREE.DoubleSide, depthWrite: false, emissive: hex, emissiveIntensity: 0.12, envMapIntensity: 1.1 });
}
const LAMP = {};
for (const [k, hex] of [['yellow', 0xffd81f], ['cyan', 0x14a8e0], ['magenta', 0xd8197f], ['warm', 0xffd9a0]]) LAMP[k] = std(hex, { emissive: hex, emissiveIntensity: 0.3, roughness: 0.4 });
const SHEET = { yellow: std(0xffd81f, { transparent: true, opacity: 0.72, roughness: 0.2 }), cyan: std(0x14a8e0, { transparent: true, opacity: 0.72, roughness: 0.2 }), magenta: std(0xd8197f, { transparent: true, opacity: 0.72, roughness: 0.2 }) };
const MATS_BY_NAME = {
  'Pine 38x76': M.pine, 'Pine sill': M.pineDark, 'Acrylic #FFD81F': GLASS.yellow, 'Acrylic #14A8E0': GLASS.cyan, 'Acrylic #D8197F': GLASS.magenta,
  'PET_rim_timber': M.rim, 'Cap ply skin': M.capSkin, 'Cap ply structure': M.capRing, 'Gold paint': M.gold, 'PET_hinge_steel': M.steel,
  'FG_copper': M.fgCopper, 'FG_sea_teal': M.fgTeal, 'FG_amber': M.fgAmber, 'FG_pearl': M.fgPearl, 'People, pale clothing': M.person,
};
function matFor(name) { if (MATS_BY_NAME[name]) return MATS_BY_NAME[name]; if (/PET_fill_A/.test(name)) return M.fillA; if (/PET_fill_B/.test(name)) return M.fillB; return M.pine; }

/* glow sprites */
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const GLOWS = [];
function glow(pos, color, size, strength = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.position.copy(pos); s.scale.set(size, size, 1); s.userData.k = strength; scene.add(s); GLOWS.push(s); return s; }

/* ---------- the Rodin winding: a stand-in for the coils until the grooved former has loaded ---------- */
class RodinCurve extends THREE.Curve {
  constructor(R, r, p, q, off) { super(); Object.assign(this, { R, r, p, q, off }); }
  getPoint(t, target = new THREE.Vector3()) { const u = t * Math.PI * 2, tor = this.p * u + this.off, pol = this.q * u, rr = this.R + this.r * Math.cos(pol);
    return target.set(rr * Math.cos(tor), rr * Math.sin(tor), this.r * Math.sin(pol)); }
}
// a ring wound in the Rodin pattern: 12 positions, step 5, two wires side by side. cross adds the second family of turns,
// so the copper crosses in diamonds the way it does on the real coils. merge folds the wire into one mesh for the world.
function rodinCoil(R, r, wire, rounds, mats, o = {}) {
  const g = new THREE.Group(), segs = o.segs ?? 1400, rad = o.radial ?? 6, wires = [];
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R, r, o.bodyRad ?? 40, o.bodySeg ?? 120), mats.body));
  const step = (wire * 2.3) / R;
  for (const dir of o.cross ? [1, -1] : [1]) for (let w = 0; w < 2; w++) for (let k = 0; k < rounds; k++)
    wires.push(new THREE.TubeGeometry(new RodinCurve(R, r + wire * 0.9, 5 * dir, 12, w * Math.PI / 12 + k * step + (dir < 0 ? Math.PI / 24 : 0)), segs, wire, rad, true));
  if (o.merge) g.add(new THREE.Mesh(mergeGeometries(wires, false), mats.wire)); else wires.forEach(w => g.add(new THREE.Mesh(w, mats.wire)));
  g.rotation.x = Math.PI / 2; const out = new THREE.Group(); out.add(g); return out;
}
/* the grooved former: the 140 mm ring (Torus_140mm_7rings.stl), loaded from assets/coil_former_glb.js, in metres, axis up.
   Two crossing windings, each a closed (8, 7) torus knot, phi = k * theta + c. Measured on the STL (cm): ring radius 4.579,
   outer surface 2.40, deep grooves (family A, k = -7/8) bottom at 1.70, shallow grooves (family B, k = +7/8) bottom at 2.05; slots about 2.5 mm wide. */
const FORMER = { geo: null };
class GrooveCurve extends THREE.Curve {
  constructor(k, c, rho) { super(); Object.assign(this, { k, c, rho }); }
  getPoint(t, out = new THREE.Vector3()) { const th = t * Math.PI * 16, ph = this.k * th + this.c, rr = 4.57942 + this.rho * Math.cos(ph);
    return out.set(rr * Math.cos(th) * 0.01, this.rho * Math.sin(ph) * 0.01, -rr * Math.sin(th) * 0.01); }
}
function grooveCoil(mats, o = {}) {     // o: wire radius (cm, before scaling), cols (phase offsets), layers for A and B, segments, radial, merge, scale
  const g = new THREE.Group(), wr = o.wire ?? 0.058, cols = o.cols ?? [-0.03, 0.03], seg = o.seg ?? 1920, rad = o.radial ?? 6, wires = [];
  if (!FORMER.geo) { const f = rodinCoil(0.0458, 0.024, wr * 0.01, 2, mats, { cross: true }); if (o.scale) f.scale.setScalar(o.scale); return f; }
  g.add(new THREE.Mesh(FORMER.geo, mats.body));
  const A = o.layersA ?? [1.758, 1.876, 1.994], B = o.layersB ?? [2.108, 2.226];
  for (const [k, c, rows] of [[-0.875, 0.6787, A], [0.875, 0.2796, B]]) for (const rho of rows) for (const dc of cols)
    wires.push(new THREE.TubeGeometry(new GrooveCurve(k, c + dc, rho), seg, wr * 0.01, rad, true));
  if (o.merge) g.add(new THREE.Mesh(mergeGeometries(wires, false), mats.wire)); else wires.forEach(w => g.add(new THREE.Mesh(w, mats.wire)));
  if (o.scale) g.scale.setScalar(o.scale);
  return g;
}
// once the former has loaded, the big coil on the Mahal's centre pole is rebuilt on it
function worldCoil() {
  const cg = ZONES.MAHAL_COIL; if (!cg || !FORMER.geo) return;
  const c = grooveCoil({ body: M2.coilBlack, wire: M2.copper }, { scale: 40 / 14, wire: 0.05, cols: [-0.03, 0.03], seg: 960, radial: 4, merge: true });
  cg.clear(); cg.add(c); cg.traverse(o => { if (o.isMesh) { o.userData.pick = 'MAHAL_COIL'; o.castShadow = true; } });
}

/* ---------- helpers for procedural zones ---------- */
const mtx = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? V3(s, s, s) : s);
class Bucket {
  constructor() { this.m = new Map(); }
  add(geo, mat, m) { const g = geo.clone(); if (m) g.applyMatrix4(m); if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!this.m.has(mat)) this.m.set(mat, []); this.m.get(mat).push(g); }
  build(pickId, { cast = true, receive = true } = {}) {
    const grp = new THREE.Group();
    for (const [mat, list] of this.m) { const mesh = new THREE.Mesh(mergeGeometries(list, false), mat); mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.userData.pick = pickId; grp.add(mesh); }
    scene.add(grp); return grp;
  }
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
};
const S = (x, y, z) => V3(x, y, z);

/* ribbons for paths and the road */
function ribbon(points, width, mat, y = 0.03) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const len = curve.getLength(), N = Math.max(8, Math.ceil(len / 1.2));
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N); const n = V3(-t.z, 0, t.x).normalize().multiplyScalar(width / 2);
    pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z); nor.push(0, 1, 0, 0, 1, 0); uv.push(0, i / N * len / 4, 1, i / N * len / 4);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return curve;
}
const DOOR = V3(9.5, 0, 0);
// the way itself: one ribbon of trodden playa
{ const n = Math.ceil(WAY_LEN / 2.5); ribbon(Array.from({ length: n + 1 }, (_, i) => wayP(WAY_LEN * i / n)), 3.0, M.path); }
// small lanterns along it, one side and then the other, that light at dusk
{ const bm = new Bucket(), clear = [0, ST.portal, ST.gate1, ST.gate2, ST.gate3, ST.gate4, ST.gate5, ST.gate6, ST.gate7, ST.flag, WAY_LEN];
  for (let s = 9, k = 0; s < WAY_LEN - 4; s += 11, k++) { if (clear.some(q => Math.abs(q - s) < 5)) continue; const p = beside(s, 2.15, k % 2 ? 1 : -1);
    bm.add(G.cyl6, M.pineDark, mtx(p.x, 0.42, p.z, 0, 0, 0, V3(0.1, 0.84, 0.1))); bm.add(G.box, LAMP.warm, mtx(p.x, 0.92, p.z, 0, 0, 0, V3(0.17, 0.2, 0.17)));
    bm.add(new THREE.ConeGeometry(0.16, 0.12, 4), M.rim, mtx(p.x, 1.08, p.z, Math.PI / 4)); glow(p.clone().setY(0.95), 0xffc070, 1.5, 0.9); }
  bm.build(null); }
// the stretches of it the builders walk: through the camp, on to the yard, and through the last gates to the door
const wayPart = (s0, s1) => { const n = Math.ceil((s1 - s0) / 3); return new THREE.CatmullRomCurve3(Array.from({ length: n + 1 }, (_, i) => wayP(s0 + (s1 - s0) * i / n)), false, 'centripetal'); };
const PATH = { camp: wayPart(ST.gate3 - 6, ST.gate4 - 3), yard: wayPart(ST.gate4 + 3, ST.gate5 - 4), east: wayPart(ST.gate5 - 2, WAY_LEN - 2) };
// the bakkie's road comes in from the far south east to the end of the yard, and never crosses the way
const ROAD = ribbon([V3(900, 0, 420), V3(430, 0, 220), V3(240, 0, 118), V3(150, 0, 70), YL(26, 0, 1.5), YL(11, 0, 1)], 3.6, M.road, 0.025); Object.assign(M.road, { transparent: true, opacity: 0.16, depthWrite: false }); M.road.color.set(0x8f7d64);   // only tyre tracks, a faint darkening of the playa, so the way stays the one path you see

/* ---------- the camp, along the way: the portal, Blissfull Drift, the Lotus Mahal, then the kitchen, the shade sail and the bell tents ---------- */
const ZONES = {};
// TOWARD_TEMPLE keeps its old name: it is now the bearing, in x/z, from the Lotus Mahal to the way, where its door looks
const TOWARD_TEMPLE = (() => { const d = wayP(ST.mahal).sub(CAMP); return Math.atan2(d.z, d.x); })();
const C_AT = (r, a, y = 0) => V3(CAMP.x + Math.cos(a) * r, y, CAMP.z + Math.sin(a) * r);
const FLAG_AT = beside(ST.flag, 4.2, -1), PORTAL = wayP(ST.portal), DRIFT = beside(ST.drift, 9, -1), KITCHEN = beside(ST.kitchen, 9.5, -1), SAIL = beside(ST.sail, 11, 1);
const ROT_FACE_TEMPLE = (() => { const t = wayT(ST.portal); return Math.atan2(-t.x, -t.z); })();   // the portal: its face, with the rope spirals, looks back down the way
const ROT_BOW_TEMPLE = (() => { const t = wayT(ST.drift); return Math.atan2(-t.z, t.x); })();     // the boat: its bow sails on along the way, towards The Seed
const SAIL_RY = (() => { const t = wayT(ST.sail); return Math.atan2(-t.z, t.x); })();             // the shade sail lies along the way
const SL = (x, z) => V3(x, 0, z).applyAxisAngle(V3(0, 1, 0), SAIL_RY).add(SAIL);
const CAMP_HEART = wayP(ST.camp);
const TENTS = [[119, 17, -1], [135, 17, -1], [143, 11, -1], [120, 11, 1], [147, 11, 1], [127, 22, 1], [141, 21, 1]].map(([s, o, k]) => beside(s, o, k));
DATA.quests.find(q => q.id === 'Q-05').pin = V3(KITCHEN.x, 8.5, KITCHEN.z);
DATA.quests.find(q => q.id === 'Q-02').pin = YL(7, 6, -2); DATA.quests.find(q => q.id === 'Q-06').pin = YL(-9, 5.5, 7.5);
/* the Lotus Mahal, from the camp's plan and elevation: three bells joined around a taller centre. 12 m across the petal tips;
   a 4.5 m centre pole and three 3.4 m poles 2.7 m out; walls 1.75 m high; six petals to each bell; the door faces the way */
const MH = { hubR: 2.7, wallR: 2.9, eave: 1.75, apex: 4.5, sub: 3.4, cR: 3.1, flare: 0.42, arch: 1.42, doorArch: 1.66, n: 6 };
{ const h = MH.hubR, r = MH.wallR, s = (h + Math.sqrt(4 * r * r - 3 * h * h)) / 2; MH.phi = Math.atan2(0.866 * s, s / 2 - h);
  const ad = -MH.phi / 6; MH.theta0 = TOWARD_TEMPLE - Math.atan2(r * Math.sin(ad), h + r * Math.cos(ad)); }
const MH_HUBS = [0, 1, 2].map(k => { const a = MH.theta0 + k * Math.PI * 2 / 3; return { a, x: Math.cos(a) * MH.hubR, z: Math.sin(a) * MH.hubR }; });
const MAHAL_DOOR = (() => { const H = MH_HUBS[0], t = H.a - MH.phi / 6; return V3(CAMP.x + H.x + Math.cos(t) * MH.wallR, 0, CAMP.z + H.z + Math.sin(t) * MH.wallR); })();
const MAHAL_OUT = (() => { const t = MH_HUBS[0].a - MH.phi / 6; return V3(Math.cos(t), 0, Math.sin(t)); })();
/* the fireside in the hull of Blissfull Drift */
const DRIFT_M = mtx(DRIFT.x, 0, DRIFT.z, ROT_BOW_TEMPLE);
const FIRE_L = V3(0.3, 0.3, 0), FIRE_AT = FIRE_L.clone().applyMatrix4(DRIFT_M);
const DRIFT_STERN = V3(-1, 0, 0).transformDirection(DRIFT_M);
const mtxYXZ = (x, y, z, ry, rx, s = 1) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), typeof s === 'number' ? V3(s, s, s) : s);
const M2 = {
  hull: std(0x8f4526, { roughness: 0.6 }), hullStripe: std(0xe8dcc4, { roughness: 0.6 }), white: std(0xf1ece2, { roughness: 0.5 }),
  gold: std(0xc9a14a, { metalness: 0.6, roughness: 0.35 }), rope: std(0xcbbd9f, { roughness: 1 }), darkwood: std(0x4a3426, { roughness: 0.8 }),
  basket: std(0x6b4a2c, { roughness: 0.9 }), tent: std(0xf3ead8, { roughness: 0.9, emissive: 0xffb070, emissiveIntensity: 0 }), tent2: std(0xe9dcc2, { roughness: 0.9, emissive: 0xffa060, emissiveIntensity: 0 }), coilBlack: std(0x17161a, { roughness: 0.35, metalness: 0.2 }), pole: std(0xe2cfae, { emissive: 0x8a5426, emissiveIntensity: 0 }), copper: std(0xc07a45, { metalness: 0.85, roughness: 0.3 }),
};
function catenary(a, b, sag, n = 24) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); } return pts; }
function bunting(pts, colours, size = 0.42) {           // flags hanging under a line, plus warm bulbs
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-size / 2, 0, 0, size / 2, 0, 0, 0, -size * 1.2, 0], 3)); tri.computeVertexNormals();
  const flags = new THREE.InstancedMesh(tri, std(0xffffff, { side: THREE.DoubleSide, roughness: 0.9 }), pts.length - 1);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), LAMP.warm, Math.ceil((pts.length - 1) / 2));
  const col = new THREE.Color();
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i].clone().lerp(pts[i + 1], 0.5), d = pts[i + 1].clone().sub(pts[i]);
    flags.setMatrixAt(i, mtx(p.x, p.y, p.z, Math.atan2(-d.z, d.x))); flags.setColorAt(i, col.set(colours[i % colours.length]));
    if (i % 2 === 0) bulbs.setMatrixAt(i / 2, mtx(pts[i].x, pts[i].y - 0.05, pts[i].z));
  }
  scene.add(flags, bulbs); return [flags, bulbs];
}
const BUNTING = ['#efe6d6', '#2f6f73', '#c98a8a', '#d8c08a', '#3b4a5c'];
const LANTERNS = [];
{
  const b = new Bucket(), bK = new Bucket(), bL = new Bucket(), bD = new Bucket(), bP = new Bucket();
  // common area: a shade sail on four poles
  const sc = SAIL;
  for (const [x, z, h] of [[-7, -5, 4.4], [7, -5, 3.6], [7, 5, 4.4], [-7, 5, 3.6]]) { const q = SL(x, z); b.add(G.cyl, M.pole, mtx(q.x, h / 2, q.z, 0, 0, 0, V3(0.18, h, 0.18))); }
  const sail = new THREE.PlaneGeometry(14, 10, 14, 10).rotateX(-Math.PI / 2);
  { const p = sail.attributes.position; for (let i = 0; i < p.count; i++) { const hx = p.getX(i) / 7, hz = p.getZ(i) / 5; p.setY(i, 4.0 + 0.4 * hx * hz - 0.55 * (1 - hx * hx) * (1 - hz * hz)); } sail.computeVertexNormals(); }
  b.add(sail, M.canvas, mtx(sc.x, 0, sc.z, SAIL_RY));
  // sleeping bell tents, on both sides of the way through the camp
  for (let i = 0; i < TENTS.length; i++) {
    const p = TENTS[i];
    b.add(new THREE.CylinderGeometry(2.3, 2.3, 0.9, 16, 1, true), i % 2 ? M.canvas : M.canvas2, mtx(p.x, 0.45, p.z));
    b.add(new THREE.ConeGeometry(2.38, 2.4, 16, 1, true), i % 2 ? M.canvas : M.canvas2, mtx(p.x, 2.1, p.z));
    b.add(G.cyl, M.pole, mtx(p.x, 3.45, p.z, 0, 0, 0, V3(0.06, 0.5, 0.06)));
  }
  // flag pole by the way in
  const fp = FLAG_AT; b.add(G.cyl, M.pole, mtx(fp.x, 4, fp.z, 0, 0, 0, V3(0.12, 8, 0.12)));
  // kitchen dome
  bK.add(new THREE.SphereGeometry(4.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.canvas2, mtx(KITCHEN.x, 0, KITCHEN.z));
  { const d = wayP(ST.kitchen).sub(KITCHEN).normalize(), q = KITCHEN.clone().addScaledVector(d, 3.95); bK.add(G.box, M.dark, mtx(q.x, 0.9, q.z, Math.atan2(-d.z, d.x), 0, 0, V3(0.4, 1.8, 1.2))); }   // its door, on the side of the way
  bK.add(new THREE.CylinderGeometry(4.25, 4.25, 0.12, 12), M.pole, mtx(KITCHEN.x, 0.06, KITCHEN.z));

  // THE LOTUS MAHAL: three bells joined around a taller centre (see MH above)
  const T = CAMP, HUBS = MH_HUBS;
  M2.tent.side = THREE.DoubleSide; M2.tent2.side = THREE.DoubleSide;
  const smax = (p, q, k = 0.09) => { const m = Math.max(p, q); return m + k * Math.log(Math.exp((p - m) / k) + Math.exp((q - m) / k)); };
  const roofY = (x, z) => { let y = MH.eave + (MH.apex - MH.eave) * Math.pow(Math.max(0, 1 - Math.hypot(x, z) / MH.cR), 1.45);
    for (const Hh of HUBS) y = smax(y, MH.eave + (MH.sub - MH.eave) * Math.pow(Math.max(0, 1 - Math.hypot(x - Hh.x, z - Hh.z) / MH.wallR), 1.45)); return y; };
  const rimR = th => { const ux = Math.cos(th), uz = Math.sin(th); let best = 0; for (const Hh of HUBS) { const q = ux * Hh.x + uz * Hh.z, disc = q * q - (Hh.x * Hh.x + Hh.z * Hh.z) + MH.wallR * MH.wallR; if (disc >= 0) best = Math.max(best, q + Math.sqrt(disc)); } return best; };
  const scal = al => { const w = 2 * MH.phi / MH.n, j = clamp(Math.floor((al + MH.phi) / w), 0, MH.n - 1); return { j, s: (al + MH.phi - j * w) / w }; };
  const isDoor = (k, j) => k === 0 && j === 2;
  const archY = (k, al) => { const { j, s: q } = scal(al); return (isDoor(k, j) ? MH.doorArch : MH.arch) * Math.pow(Math.max(0, Math.sin(Math.PI * q)), 0.55); };
  const hem = (k, al) => { const e = smooth(0, 0.32, MH.phi - Math.abs(al)), { j } = scal(al), yb = archY(k, al), ah = isDoor(k, j) ? MH.doorArch : MH.arch;
    return { r: MH.wallR + MH.flare * e * (1 - 0.62 * yb / ah), y: yb, e }; };
  const grid = (NU, NV, fn) => {             // a vertex grid in tent space from fn(u, v) -> [x, y, z]
    const pos = [], idx = []; for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const p = fn(i / NU, j / NV); pos.push(T.x + p[0], p[1], T.z + p[2]); }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const q = i * (NV + 1) + j, c = q + NV + 1; idx.push(q, c, q + 1, q + 1, c, c + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  // the roof: each bell a curved cone, blended where they meet so the valleys run soft between the peaks
  bL.add(grid(240, 34, (u, v) => { const th = u * Math.PI * 2, r = rimR(th) * Math.pow(v, 1.25), x = Math.cos(th) * r, z = Math.sin(th) * r; return [x, roofY(x, z), z]; }), M2.tent);
  // the wall, with the door cut as an arch in the bell that faces the temple
  for (let k = 0; k < 3; k++) bL.add(grid(84, 5, (u, v) => { const al = -MH.phi + u * 2 * MH.phi, Hh = HUBS[k], t = Hh.a + al, x = Hh.x + Math.cos(t) * MH.wallR, z = Hh.z + Math.sin(t) * MH.wallR;
    const top = roofY(x, z), y0 = isDoor(k, scal(al).j) ? archY(k, al) : 0; return [x, y0 + (top - y0) * v, z]; }), M2.tent2);
  // the petals: pointed at the ground, arched between, six to each bell
  const hemAt = (k, al, v) => { const Hh = HUBS[k], t = Hh.a + al, c = Math.cos(t), sn = Math.sin(t), top = roofY(Hh.x + c * MH.wallR, Hh.z + sn * MH.wallR), hm = hem(k, al);
    const rr = MH.wallR + (hm.r - MH.wallR) * v + 0.1 * hm.e * Math.sin(Math.PI * v); return [Hh.x + c * rr, top + (hm.y - top) * v, Hh.z + sn * rr]; };
  for (let k = 0; k < 3; k++) bL.add(grid(168, 6, (u, v) => hemAt(k, -MH.phi + u * 2 * MH.phi, v)), M2.tent);
  // poles: the tall centre and the three bell poles
  const poleMat = M2.pole;
  bL.add(G.cyl, poleMat, mtx(T.x, (MH.apex + 0.12) / 2, T.z, 0, 0, 0, V3(0.13, MH.apex + 0.12, 0.13)));
  for (const Hh of HUBS) bL.add(G.cyl, poleMat, mtx(T.x + Hh.x, (MH.sub + 0.3) / 2, T.z + Hh.z, 0, 0, 0, V3(0.09, MH.sub + 0.3, 0.09)));
  // inside: a round rug with the seed of life at the centre, one in each bell, cushions and lanterns along the walls
  const rugTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#7a2f2a'; x.fillRect(0, 0, 512, 512); x.strokeStyle = '#e3b65c'; x.lineWidth = 7; x.beginPath(); x.arc(256, 256, 240, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#2f5f63'; x.beginPath(); x.arc(256, 256, 218, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#ecdcb6'; x.lineWidth = 4; for (let i = 0; i < 7; i++) { const q = i / 6 * Math.PI * 2, cx = i ? 256 + Math.cos(q) * 64 : 256, cy = i ? 256 + Math.sin(q) * 64 : 256; x.beginPath(); x.arc(cx, cy, 64, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = '#e3b65c'; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 140, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 36; i++) { const q = i / 36 * Math.PI * 2; x.beginPath(); x.moveTo(256 + Math.cos(q) * 150, 256 + Math.sin(q) * 150); x.lineTo(256 + Math.cos(q) * 206, 256 + Math.sin(q) * 206); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const rugMat = std(0xffffff, { map: rugTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rugG = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  bL.add(rugG, rugMat, mtx(T.x, 0.02, T.z, 0, 0, 0, V3(2.2, 1, 2.2)));
  const cush = [std(0x8a3b34, { roughness: 0.95 }), std(0x2f6f73, { roughness: 0.95 }), std(0xc9a25e, { roughness: 0.95 }), std(0xe9dcc4, { roughness: 0.95 })];
  const pillow = new THREE.SphereGeometry(0.5, 16, 8), bolster = new THREE.CapsuleGeometry(0.12, 0.5, 4, 10).rotateZ(Math.PI / 2);
  HUBS.forEach((Hh, k) => {
    bL.add(rugG, rugMat, mtx(T.x + Hh.x * 1.12, 0.021, T.z + Hh.z * 1.12, Hh.a, 0, 0, V3(1.45, 1, 1.45)));
    for (let i = 0; i < 7; i++) { const al = -1.55 + i * 0.52; if (isDoor(k, scal(al).j) || (k === 0 && Math.abs(al + MH.phi / 6) < 0.5)) continue;
      const t = Hh.a + al, x = T.x + Hh.x + Math.cos(t) * 2.35, z = T.z + Hh.z + Math.sin(t) * 2.35;
      bL.add(pillow, cush[(i + k) % 4], mtx(x, 0.07, z, -t, 0, 0, V3(0.56, 0.15, 0.56)));
      if (i % 2 === 0) bL.add(bolster, cush[(i + k + 2) % 4], mtx(T.x + Hh.x + Math.cos(t) * 2.66, 0.13, T.z + Hh.z + Math.sin(t) * 2.66, -t + Math.PI / 2, 0, 0, V3(1, 1, 1))); }
    for (const al of [-0.95, 0.95]) { const t = Hh.a + al, x = T.x + Hh.x + Math.cos(t) * 2.0, z = T.z + Hh.z + Math.sin(t) * 2.0;
      bL.add(G.box, LAMP.warm, mtx(x, 0.16, z, t, 0, 0, V3(0.16, 0.26, 0.16))); bL.add(new THREE.ConeGeometry(0.13, 0.12, 4), M2.gold, mtx(x, 0.35, z, t + Math.PI / 4)); glow(V3(x, 0.3, z), 0xffc070, 1.4, 0.9); }
  });
  // the door faces the way in: white drapes gathered at each side, two tall woven baskets, lanterns on the ground
  for (const al of [-MH.phi / 3, 0]) { const Hh = HUBS[0], t = Hh.a + al, x = T.x + Hh.x + Math.cos(t) * (MH.wallR + 0.32), z = T.z + Hh.z + Math.sin(t) * (MH.wallR + 0.32);
    bL.add(new THREE.CylinderGeometry(0.1, 0.24, 1.7, 10), M.canvas, mtx(x, 0.85, z));
    bL.add(new THREE.CylinderGeometry(0.24, 0.17, 1.15, 12), M2.basket, mtx(x + Math.cos(t) * 0.75, 0.575, z + Math.sin(t) * 0.75));
    bL.add(new THREE.ConeGeometry(0.34, 0.75, 9), std(0xc7b184), mtx(x + Math.cos(t) * 0.75, 1.5, z + Math.sin(t) * 0.75)); }
  for (const f of [-0.75, 0.75]) { const p = MAHAL_DOOR.clone().addScaledVector(MAHAL_OUT, 1.2).add(V3(-MAHAL_OUT.z * f, 0, MAHAL_OUT.x * f));
    bL.add(G.box, LAMP.warm, mtx(p.x, 0.15, p.z, 0, 0, 0, V3(0.2, 0.3, 0.2))); glow(p.clone().setY(0.3), 0xffc070, 1.5, 1); }
  ZONES.CAMP_LOTUS = bL.build('CAMP_LOTUS'); ZONES.CAMP_LOTUS.userData.c = T.clone();
  // petal edges, roof seams and guy ropes, as fine lines
  { const sm = [], rp = []; const line = pts => { for (let i = 0; i < pts.length - 1; i++) sm.push(pts[i][0] + T.x, pts[i][1], pts[i][2] + T.z, pts[i + 1][0] + T.x, pts[i + 1][1], pts[i + 1][2] + T.z); };
    for (let k = 0; k < 3; k++) for (let j = 0; j <= MH.n; j++) { const al = -MH.phi + j * 2 * MH.phi / MH.n, Hh = HUBS[k], t = Hh.a + al, c = Math.cos(t), sn = Math.sin(t);
      line(Array.from({ length: 9 }, (_, i) => { const p = hemAt(k, al, i / 8); return [p[0], p[1] + 0.012, p[2]]; }));
      line(Array.from({ length: 11 }, (_, i) => { const f = i / 10, x = Hh.x + c * MH.wallR * (1 - f), z = Hh.z + sn * MH.wallR * (1 - f); return [x, roofY(x, z) + 0.02, z]; }));
      if (j > 0 && j < MH.n) { const x = Hh.x + c * MH.wallR, z = Hh.z + sn * MH.wallR; rp.push(T.x + x, roofY(x, z) + 0.04, T.z + z, T.x + Hh.x + c * 5.5, 0.02, T.z + Hh.z + sn * 5.5); } }
    for (let i = 0; i < 12; i++) { const th = i / 12 * Math.PI * 2 + MH.theta0; line(Array.from({ length: 11 }, (_, q) => { const r = q / 10 * MH.cR * 0.92, x = Math.cos(th) * r, z = Math.sin(th) * r; return [x, roofY(x, z) + 0.02, z]; })); }
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(sm, 3));
    const seams = new THREE.LineSegments(g1, new THREE.LineBasicMaterial({ color: 0xcdbfa6 })); seams.userData.pick = 'CAMP_LOTUS'; scene.add(seams);
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); scene.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ color: 0xbdb3a2 }))); }
  // the lattice lantern on the centre peak: two families of spirals on a pointed ellipsoid make the diamond lattice
  { const pts = [], cols = [], N = 12, S = 14, crownC = V3(T.x, MH.apex + 0.52, T.z); const pal = [new THREE.Color(0xd9473a), new THREE.Color(0xe8b04a), new THREE.Color(0x2e9c9a)];
    for (const dir of [1, -1]) for (let k = 0; k < N; k++) for (let q = 0; q < S; q++) {
      for (const ss of [q, q + 1]) { const t = ss / S; const yy = -0.46 + t * 0.92; const rad = 0.3 * Math.sin(Math.PI * t) ** 0.85; const ph = k / N * Math.PI * 2 + dir * t * Math.PI * 0.75;
        pts.push(crownC.x + Math.cos(ph) * rad, crownC.y + yy, crownC.z + Math.sin(ph) * rad); const c = pal[(k + (dir > 0 ? 0 : 1)) % 3]; cols.push(c.r, c.g, c.b); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const crown = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); crown.userData.pick = 'CAMP_LOTUS'; scene.add(crown);
    glow(crownC, 0xffd59a, 3.0, 0.9); }
  // bunting from the centre peak to each bell's peak
  for (const Hh of HUBS) bunting(catenary(V3(T.x, MH.apex + 0.12, T.z), V3(T.x + Hh.x, MH.sub + 0.28, T.z + Hh.z), 0.1, 10), BUNTING, 0.24);
  // the big coil on the centre pole, at heart height: a black ring wound in copper
  { const cg = rodinCoil(0.14, 0.058, 0.0034, 2, { body: M2.coilBlack, wire: M2.copper }, { cross: true, merge: true, segs: 700, radial: 5, bodyRad: 24, bodySeg: 64 });
    cg.position.set(T.x, 1.3, T.z); cg.traverse(o => { if (o.isMesh) { o.userData.pick = 'MAHAL_COIL'; o.castShadow = true; } }); scene.add(cg); ZONES.MAHAL_COIL = cg; ZONES.MAHAL_COIL.userData.c = V3(T.x, 1.3, T.z); }

  // BLISSFULL DRIFT: the camp's wooden boat, bow towards the way in. The hull is open, and inside it tiers of seats step down
  // like a small amphitheatre to a fire pit shaped like a king protea.
  const BM = DRIFT_M, L = 12, Bm = 5.0, H = 1.6, PR = 0.3;
  const local = (m) => BM.clone().multiply(m), local0 = local;
  const hb = t => Bm / 2 * Math.pow(Math.max(0.0001, Math.sin(Math.PI * (0.06 + 0.94 * t))), 0.5);
  const gun = t => H + 0.2 + 0.9 * Math.pow(t, 4) + 0.3 * Math.pow(1 - t, 5), keel = t => 0.08 + 1.1 * Math.pow(t, 6) + 0.3 * Math.pow(1 - t, 6);
  const sec = (t, a) => keel(t) + (gun(t) - keel(t)) * (1 - Math.pow(Math.sin(a), PR));      // a flat-bottomed section, steep planked sides
  const halfAt = (t, y) => { const f = (y - keel(t)) / (gun(t) - keel(t)); if (f <= 0) return 0; if (f >= 1) return hb(t); return hb(t) * Math.cos(Math.asin(Math.pow(1 - f, 1 / PR))); };
  { const NS = 40, NP = 18, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) { const t = i / NS, x = -L / 2 + t * L; for (let j = 0; j <= NP; j++) { const a = Math.PI * j / NP; pos.push(x, sec(t, a), hb(t) * Math.cos(a)); uv.push(t, j / NP); } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) { const a = i * (NP + 1) + j, c = a + NP + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const hullTex = (named) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
      x.fillStyle = '#8f4526'; x.fillRect(0, 0, 1024, 512);
      for (let y = 0; y < 512; y += 22) { x.fillStyle = 'rgba(40,12,4,.35)'; x.fillRect(0, y, 1024, 2); }
      x.fillStyle = '#ece0c6'; for (const [y, h] of [[2, 9], [20, 6], [486, 6], [501, 9]]) x.fillRect(0, y, 1024, h);
      if (named) { x.fillStyle = '#f4ecdc'; x.font = 'italic 700 46px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        // +z side: the gunwale is at the bottom of the canvas, so the words are flipped top to bottom
        x.save(); x.translate(700, 452); x.scale(1, -1); x.fillText('Blissfull Drift', 0, 0); x.restore();
        // -z side: seen from the other side, so the words are mirrored left to right
        x.save(); x.translate(700, 60); x.scale(-1, 1); x.fillText('Blissfull Drift', 0, 0); x.restore(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    // the generated normals point into the hull, so the outside is the back face
    const hullMat = std(0xffffff, { map: hullTex(true), roughness: 0.55, side: THREE.BackSide });
    const hullIn = std(0xc9ad94, { map: hullTex(false), roughness: 0.7, side: THREE.FrontSide });
    bD.add(g, hullIn, BM); bD.add(g, hullMat, BM);
    const tr = new THREE.Shape(); for (let j = 0; j <= NP; j++) { const a = Math.PI * j / NP; tr[j ? 'lineTo' : 'moveTo'](hb(0) * Math.cos(a), sec(0, a)); }
    bD.add(new THREE.ShapeGeometry(tr).rotateY(-Math.PI / 2), std(0x7a3a20, { side: THREE.DoubleSide }), local0(mtx(-L / 2, 0, 0)));
    // a dark cap rail along both gunwales
    for (const sd of [1, -1]) { const pts = []; for (let i = 0; i <= 40; i++) { const t = 0.015 + i / 40 * 0.97; pts.push(V3(-L / 2 + t * L, gun(t) + 0.02, sd * hb(t))); }
      bD.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.055, 6), M2.darkwood, BM); } }
  // the amphitheatre: a sandy floor, then three tiers of seats rising to the gunwales, each following the hull at its own height
  const SEAT = [[0.3], [0.68, 1.5, 1.08], [1.06, 2.15, 1.45], [1.44, 2.8, 1.85]];   // [height, half length, half width of the opening]
  const reach = (phi, y) => { const c = Math.cos(phi), sn = Math.sin(phi); let lo = 0, hi = L; for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2, x = FIRE_L.x + c * m, z = sn * m, t = (x + L / 2) / L;
    const ok = t > 0.02 && t < 0.98 && Math.abs(z) < halfAt(t, y) - 0.05; if (ok) lo = m; else hi = m; } return lo; };
  const ring = (y, rin, rout, NA = 120) => { const pos = [], idx = []; for (let i = 0; i <= NA; i++) { const ph = i / NA * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph), r1 = rin(ph), r2 = Math.max(r1, rout(ph));
      pos.push(FIRE_L.x + c * r1, y, sn * r1, FIRE_L.x + c * r2, y, sn * r2); if (i < NA) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const riser = (y0, y1, rin, NA = 120) => { const pos = [], idx = []; for (let i = 0; i <= NA; i++) { const ph = i / NA * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph), r = rin(ph);
      pos.push(FIRE_L.x + c * r, y0, sn * r, FIRE_L.x + c * r, y1, sn * r); if (i < NA) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const ell = (ax, az) => ph => 1 / Math.hypot(Math.cos(ph) / ax, Math.sin(ph) / az);
  const seatWood = std(0xb88a5e, { roughness: 0.75 }), riserWood = std(0x8a5a3a, { roughness: 0.8 }), cushD = [std(0xd9cbb0, { roughness: 0.95 }), std(0x2f6f73, { roughness: 0.95 }), std(0x8a3b34, { roughness: 0.95 })], cushG = new THREE.SphereGeometry(0.5, 14, 7);
  bD.add(ring(SEAT[0][0], () => 0, ph => reach(ph, SEAT[0][0])), std(0xd9c7a8, { roughness: 1 }), BM);
  for (let k = 1; k < SEAT.length; k++) { const [y, ax, az] = SEAT[k], inner = ph => Math.min(ell(ax, az)(ph), reach(ph, y) - 0.02);
    bD.add(ring(y, inner, ph => reach(ph, y)), seatWood, BM); bD.add(riser(SEAT[k - 1][0], y, inner), riserWood, BM);
    // cushions along each tier, in the camp's colours
    for (let i = 0; i < 14; i++) { const ph = (i + 0.5 * (k % 2)) / 14 * Math.PI * 2, r1 = inner(ph), r2 = reach(ph, y); if (r2 - r1 < 0.32 || (i + k) % 3 === 0) continue;
      const rm = r1 + 0.22, c = Math.cos(ph), sn = Math.sin(ph); bD.add(cushG, cushD[(i + k) % 3], local(mtx(FIRE_L.x + c * rm, y + 0.045, sn * rm, -ph, 0, 0, V3(0.4, 0.1, 0.46)))); } }
  // the wheel on its post near the bow, on the top tier
  { const wx = L / 2 - 2.1, wy = SEAT[3][0] + 1.0;
    bD.add(G.cyl, M2.white, local(mtx(wx, SEAT[3][0] + 0.45, 0, 0, 0, 0, V3(0.08, 0.9, 0.08))));
    bD.add(new THREE.TorusGeometry(0.42, 0.035, 6, 24), M2.darkwood, local(mtx(wx, wy, 0, Math.PI / 2)));
    for (let k = 0; k < 8; k++) bD.add(G.box, M2.darkwood, local(mtx(wx, wy, 0, 0, k * Math.PI / 8, 0, V3(0.03, 1.05, 0.03)))); }
  // prow: a tall curled post with a crescent moon, and a scroll at the stem
  { const g1 = gun(1); const c = new THREE.CatmullRomCurve3([V3(L / 2 - 0.25, g1 - 0.2, 0), V3(L / 2 + 0.05, g1 + 0.8, 0), V3(L / 2 - 0.05, g1 + 1.7, 0), V3(L / 2 - 0.55, g1 + 2.2, 0)]);
    const g = new THREE.TubeGeometry(c, 24, 0.13, 6); g.scale(1, 1, 0.45); bD.add(g, M2.hull, BM);
    bD.add(new THREE.TorusGeometry(0.5, 0.075, 8, 24, Math.PI * 1.15), M2.gold, local(mtx(L / 2 - 0.85, g1 + 2.35, 0, 0, 0, 2.2)));
    bD.add(new THREE.TorusGeometry(0.32, 0.07, 8, 20, Math.PI * 1.6), M2.hull, local(mtx(L / 2 + 0.1, 1.0, 0, 0, 0, 0.6))); }
  // white turned posts with ball tops, joined by a rope rail
  for (const sd of [1, -1]) { const tops = [];
    for (const t of [0.12, 0.27, 0.42, 0.57, 0.72, 0.86]) { const x = -L / 2 + t * L, z = sd * hb(t) * 0.97, y = gun(t);
      bD.add(G.cyl, M2.white, local(mtx(x, y + 0.35, z, 0, 0, 0, V3(0.09, 0.7, 0.09)))); bD.add(G.sphere, M2.white, local(mtx(x, y + 0.78, z, 0, 0, 0, 0.2))); tops.push(V3(x, y + 0.72, z)); }
    for (let i = 0; i < tops.length - 1; i++) { const c = new THREE.CatmullRomCurve3(catenary(tops[i], tops[i + 1], 0.18, 8)); bD.add(new THREE.TubeGeometry(c, 10, 0.03, 5), M2.rope, BM); } }
  // steps up the side, on the side of the way, for climbing in
  for (let i = 0; i < 4; i++) bD.add(G.box, M2.darkwood, local(mtx(-L / 2 + 2.4, 0.2 + i * 0.4, hb(0.2) + 0.95 - i * 0.28, 0, 0, 0, V3(1.1, 0.08, 0.3))));
  // a pole at the bow, a mast with a spar and a furled sail at the stern, and the bunting strung between them, over the fire
  const bowTop = V3(L / 2 - 0.9, 6.6, 0).applyMatrix4(BM), mastTop = V3(-L / 2 + 1.3, 6.8, 0).applyMatrix4(BM);
  bD.add(G.cyl, M2.darkwood, local(mtx(L / 2 - 0.6, 4.0, 0, 0, 0, 0.12, V3(0.12, 5.4, 0.12))));
  bD.add(G.cyl, M.pole, local(mtx(-L / 2 + 1.3, 1.44 + 2.8, 0, 0, 0, 0, V3(0.16, 5.6, 0.16))));
  bD.add(G.cyl, M.pole, local(mtx(-L / 2 + 1.3, 5.8, 0, 0, Math.PI / 2, 0, V3(0.09, 3.6, 0.09))));
  bD.add(G.cyl, M2.white, local(mtx(-L / 2 + 1.3, 5.62, 0, 0, Math.PI / 2, 0, V3(0.2, 3.0, 0.2))));
  bunting(catenary(bowTop, mastTop, 1.0, 30), BUNTING); bunting(catenary(bowTop.clone().add(V3(0, -0.6, 0)), mastTop.clone().add(V3(0, -0.8, 0)), 1.3, 26), BUNTING);
  for (let i = 0; i < 6; i++) { const p = V3(-L / 2 + 1.2 + i * 1.9, 0.1, 0).applyMatrix4(BM); glow(p, 0xffb36b, 2.6, 0.9); }
  ZONES.CAMP_DRIFT = bD.build('CAMP_DRIFT'); ZONES.CAMP_DRIFT.userData.c = DRIFT.clone();

  // THE PROTEA FIRE PIT: a steel bowl in two rows of pointed bracts, the way a king protea holds its centre
  { const bF = new Bucket(), F = FIRE_L, at = m => BM.clone().multiply(m);
    const corten = std(0x7d3e1f, { roughness: 0.7, metalness: 0.35 }), cortenIn = std(0x6b3318, { roughness: 0.75, metalness: 0.3, side: THREE.DoubleSide });
    bF.add(new THREE.CylinderGeometry(0.34, 0.42, 0.12, 24), corten, at(mtx(F.x, F.y + 0.06, 0)));
    bF.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.12), new THREE.Vector2(0.3, 0.13), new THREE.Vector2(0.44, 0.22), new THREE.Vector2(0.5, 0.36), new THREE.Vector2(0.52, 0.4)], 30), cortenIn, at(mtx(F.x, F.y, 0)));
    const bract = (len, w, curl) => { const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.bezierCurveTo(-w * 1.2, len * 0.45, -w * 0.45, len * 0.82, 0, len); sh.bezierCurveTo(w * 0.45, len * 0.82, w * 1.2, len * 0.45, w, 0); sh.lineTo(-w, 0);
      const g = new THREE.ShapeGeometry(sh, 8), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / len, x = p.getX(i) / w; p.setZ(i, curl * y * y * len + 0.05 * (1 - x * x) * w); } g.computeVertexNormals(); return g; };
    const outer = bract(0.66, 0.15, 0.34), inner = bract(0.46, 0.12, 0.2);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, b = a + Math.PI / 14;
      bF.add(outer, cortenIn, at(mtxYXZ(F.x + Math.cos(a) * 0.48, F.y + 0.3, Math.sin(a) * 0.48, Math.PI / 2 - a, 0.95)));
      bF.add(inner, cortenIn, at(mtxYXZ(F.x + Math.cos(b) * 0.42, F.y + 0.33, Math.sin(b) * 0.42, Math.PI / 2 - b, 0.5))); }
    for (let i = 0; i < 4; i++) bF.add(G.cyl, std(0x3a2418, { roughness: 0.9 }), at(mtx(F.x, F.y + 0.24, 0, i * Math.PI / 4, 0, Math.PI / 2 - 0.12, V3(0.09, 0.62, 0.09))));
    ZONES.CAMP_FIRE = bF.build('CAMP_FIRE'); ZONES.CAMP_FIRE.userData.c = FIRE_AT.clone(); }

  // THE MAHALA PORTAL: a timber gate with an onion sign, a planked door panel beside it, rope spirals and lanterns
  const PM = mtx(PORTAL.x, 0, PORTAL.z, ROT_FACE_TEMPLE), pl = m => PM.clone().multiply(m);
  for (const s of [-1, 1]) { bP.add(G.box, M2.darkwood, pl(mtx(s * 1.25, 1.65, 0, 0, 0, 0, V3(0.16, 3.3, 0.16))));
    for (const f of [-1, 1]) bP.add(G.box, M2.darkwood, pl(mtx(s * 1.25, 0.55, f * 0.55, 0, f * 0.75, 0, V3(0.1, 1.5, 0.1)))); }
  bP.add(G.box, M2.darkwood, pl(mtx(0, 3.25, 0, 0, 0, 0, V3(3.0, 0.16, 0.18))));
  bP.add(G.box, M2.darkwood, pl(mtx(-2.55, 1.35, -0.2, 0.08, 0, 0, V3(1.1, 2.7, 0.08))));
  for (const f of [-1, 1]) bP.add(G.box, M2.darkwood, pl(mtx(-2.55 + f * 0.45, 0.5, -0.75, 0, -0.7, 0, V3(0.08, 1.3, 0.08))));
  for (const [x, z, turns, r1] of [[0.6, 3.2, 3, 1.9], [-2.6, 4.6, 2.5, 1.4]]) {
    const pts = []; for (let i = 0; i <= turns * 40; i++) { const t = i / (turns * 40); const a = t * turns * Math.PI * 2, r = 0.25 + t * r1; pts.push(V3(x + Math.cos(a) * r, 0.08, z + Math.sin(a) * r)); }
    bP.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 60, 0.085, 6), M2.rope, PM); }
  ZONES.CAMP_PORTAL = bP.build('CAMP_PORTAL'); ZONES.CAMP_PORTAL.userData.c = PORTAL.clone();
  { // the onion sign with the lotus and MAHALA, lit from behind at night
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 420; const x = cv.getContext('2d');
    x.fillStyle = '#5b4434'; x.beginPath(); x.moveTo(256, 6); x.bezierCurveTo(300, 70, 500, 150, 500, 300); x.lineTo(500, 414); x.lineTo(12, 414); x.lineTo(12, 300); x.bezierCurveTo(12, 150, 212, 70, 256, 6); x.fill();
    x.fillStyle = '#ffd98c'; x.strokeStyle = '#ffd98c'; x.lineWidth = 6;
    for (const [dx, h, w] of [[0, 150, 34], [-46, 118, 30], [46, 118, 30], [-88, 84, 26], [88, 84, 26]]) { x.beginPath(); x.ellipse(256 + dx, 250 - h / 2, w, h / 2, dx / 220, 0, Math.PI * 2); x.stroke(); }
    x.font = '600 74px "Marcellus", Georgia, serif'; x.textAlign = 'center'; x.fillText('MAHALA', 256, 360);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const ev = document.createElement('canvas'); ev.width = 512; ev.height = 420; const e = ev.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 512, 420); e.strokeStyle = e.fillStyle = '#ffd98c'; e.lineWidth = 6;
    for (const [dx, h, w] of [[0, 150, 34], [-46, 118, 30], [46, 118, 30], [-88, 84, 26], [88, 84, 26]]) { e.beginPath(); e.ellipse(256 + dx, 250 - h / 2, w, h / 2, dx / 220, 0, Math.PI * 2); e.stroke(); }
    e.font = '600 74px "Marcellus", Georgia, serif'; e.textAlign = 'center'; e.fillText('MAHALA', 256, 360);
    const te = new THREE.CanvasTexture(ev); te.colorSpace = THREE.SRGBColorSpace;
    const signMat = std(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: te, emissiveIntensity: 0.05, transparent: true, alphaTest: 0.1, roughness: 0.7, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.72), signMat); sign.applyMatrix4(pl(mtx(0, 4.2, 0.02))); sign.userData.pick = 'CAMP_PORTAL'; scene.add(sign);
    // only the letters glow: alpha from the canvas means the board itself stays dark wood in the day
    ZONES.CAMP_PORTAL.userData.signMat = signMat;
    glow(V3(0, 4.1, -0.3).applyMatrix4(PM), 0xffd59a, 3.5, 0.8);
    for (const [lx, lz] of [[1.6, 0.9], [0.6, 3.2], [-2.6, 4.6], [-2.2, 0.4]]) { const p = V3(lx, 0.25, lz).applyMatrix4(PM); const m = new THREE.Mesh(G.box, LAMP.warm); m.scale.set(0.22, 0.34, 0.22); m.position.copy(p); m.userData.pick = 'CAMP_PORTAL'; scene.add(m); LANTERNS.push(m); glow(p.clone().setY(0.4), 0xffc070, 1.6, 1); }
  }
  ZONES.CAMP = b.build('CAMP'); ZONES.CAMP_KITCHEN = bK.build('CAMP_KITCHEN'); ZONES.CAMP_KITCHEN.userData.c = KITCHEN.clone();
  // fairy lights along the sail edge
  const fl = []; for (let i = 0; i <= 24; i++) { const t = i / 24; for (const e of [-5, 5]) fl.push(SL(-7 + t * 14, e).setY(3.7 - Math.sin(t * Math.PI) * 0.5)); }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), LAMP.warm, fl.length);
  fl.forEach((p, i) => bulbs.setMatrixAt(i, mtx(p.x, p.y, p.z))); scene.add(bulbs);
  glow(V3(sc.x, 3.6, sc.z), 0xffc98a, 26, 0.55);
}
/* the flag, waving */
const flagGeo = new THREE.PlaneGeometry(2.4, 1.4, 12, 4);
const flagTex = (() => { const c = document.createElement('canvas'); c.width = 96; c.height = 64; const g = c.getContext('2d'); ['#FFD81F', '#14A8E0', '#D8197F'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 64 / 3, 96, 64 / 3 + 1); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const flag = new THREE.Mesh(flagGeo, std(0xffffff, { map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }));
flag.position.set(FLAG_AT.x + 1.2, 7.2, FLAG_AT.z);
flag.castShadow = true; flag.userData.pick = 'CAMP'; scene.add(flag);
const flagBase = flagGeo.attributes.position.array.slice();

/* ---------- the fire: flames that face you, embers that rise, a light that breathes ---------- */
{
  FX.at.copy(FIRE_AT); fireLight.position.copy(FIRE_AT).add(V3(0, 0.95, 0));
  const flameMat = seed => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, seed: { value: seed }, power: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform float seed; uniform float power; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n2(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){ float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float n = fbm(vec2(vUv.x * 2.6 + seed * 7.0, y * 2.4 - time * 2.3 + seed));
        float w = (1.0 - pow(y, 0.8)) * (0.48 + 0.52 * n) + 0.02;
        float sh = smoothstep(w, w * 0.25, abs(x + (n - 0.5) * 0.7 * y));
        sh *= smoothstep(1.0, 0.45 + 0.35 * n, y) * smoothstep(0.0, 0.06, y);
        float core = smoothstep(0.55, 1.0, sh) * (1.0 - y * 0.8);
        vec3 col = mix(vec3(0.85, 0.2, 0.03), vec3(1.0, 0.55, 0.14), sh); col = mix(col, vec3(1.0, 0.86, 0.55), core * 0.8);
        float a = sh * power * (1.0 - 0.35 * core); gl_FragColor = vec4(col * a, a); }`,
  });
  const fg = new THREE.PlaneGeometry(0.8, 1.2).translate(0, 0.6, 0);
  for (const [dx, sd, sc] of [[0, 0.1, 1], [0.13, 0.57, 0.8], [-0.12, 0.93, 0.85]]) { const m = new THREE.Mesh(fg, flameMat(sd)); m.position.copy(FIRE_AT).add(V3(0, 0.36, 0)); m.userData.dx = dx; m.userData.sc = sc; m.renderOrder = 5; scene.add(m); FX.flames.push(m); }
  FX.bed = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false, fog: false }));
  FX.bed.position.copy(FIRE_AT).add(V3(0, 0.27, 0)); scene.add(FX.bed);
  const N = 70, ep = new Float32Array(N * 3); FX.life = Array.from({ length: N }, (_, i) => ({ t: (i / N) * 2.4, v: 0.5 + ((i * 37) % 10) / 14, ph: i * 1.7, r: ((i * 53) % 10) / 30 }));
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  FX.embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.07, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  FX.embers.frustumCulled = false; scene.add(FX.embers);
  FX.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a4a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  FX.glow.position.copy(FIRE_AT).add(V3(0, 0.75, 0)); FX.glow.scale.set(3.6, 3.6, 1); scene.add(FX.glow);
}
function updateFire(dt, t) {
  const near = camera.position.distanceTo(FX.at) < 140; FX.flames.forEach(m => m.visible = near); FX.embers.visible = near && !REDUCED;
  FX.flare = Math.max(0, FX.flare - dt * 0.55);
  const tt = REDUCED ? 1 : t, flick = 0.82 + 0.1 * Math.sin(tt * 13.1) + 0.08 * Math.sin(tt * 23.7 + 1.3), boost = 1 + FX.flare * 1.4;
  fireLight.intensity = (1.0 + 5.2 * FX.night) * flick * boost;
  FX.glow.material.opacity = (0.08 + 0.32 * FX.night) * flick * Math.min(1.6, boost);
  FX.bed.material.color.setRGB(1, 0.42 + 0.12 * flick, 0.12);
  if (!near) return;
  for (const m of FX.flames) { const u = m.material.uniforms; u.time.value = tt + m.userData.dx * 10; u.power.value = (0.7 - 0.12 * FX.night) * Math.min(1.4, boost);
    const ang = Math.atan2(camera.position.x - FX.at.x, camera.position.z - FX.at.z); m.rotation.y = ang;
    m.position.set(FX.at.x + Math.cos(ang) * m.userData.dx, FX.at.y + 0.36, FX.at.z - Math.sin(ang) * m.userData.dx);
    const k = m.userData.sc * (0.92 + 0.08 * Math.sin(tt * 7 + m.userData.dx * 20)) * (1 + FX.flare * 0.7); m.scale.set(k, k * (1 + 0.06 * Math.sin(tt * 9.3)), k); }
  if (REDUCED) return;
  const p = FX.embers.geometry.attributes.position;
  FX.life.forEach((e, i) => { e.t += dt * (1 + FX.flare); if (e.t > 2.4) e.t -= 2.4; const h = e.t * e.v * (1 + FX.flare * 0.8);
    p.setXYZ(i, FX.at.x + Math.sin(e.ph + e.t * 2.2) * (e.r + h * 0.12), FX.at.y + 0.55 + h, FX.at.z + Math.cos(e.ph * 1.3 + e.t * 1.7) * (e.r + h * 0.12)); });
  p.needsUpdate = true; FX.embers.material.opacity = 0.35 + 0.65 * FX.night;
}

/* ---------- the Book of Mahala, on a carved plinth at the start of the way ---------- */
const BOOK_AT = beside(ST.book, 2.6, -1), BOOK_RY = faceWay(BOOK_AT, ST.book - 0.6), DECK_AT = V3(0.62, 0, 0.12).applyMatrix4(mtx(BOOK_AT.x, 0, BOOK_AT.z, BOOK_RY));
{
  const bB = new Bucket(), P = mtx(BOOK_AT.x, 0, BOOK_AT.z, BOOK_RY), at = m => P.clone().multiply(m);
  const TOP = at(mtx(0, 1.13, 0, 0, 0.36, 0)), on = m => TOP.clone().multiply(m);
  const wood = std(0x3a261b, { roughness: 0.62 }), brass = std(0xc9a14a, { metalness: 0.75, roughness: 0.3 }), leather = std(0x6a1e2a, { roughness: 0.55 });
  bB.add(G.box, wood, at(mtx(0, 0.04, 0, 0, 0, 0, V3(0.6, 0.08, 0.6)))); bB.add(G.box, wood, at(mtx(0, 0.12, 0, 0, 0, 0, V3(0.46, 0.08, 0.46))));
  bB.add(new THREE.CylinderGeometry(0.105, 0.13, 0.86, 16), wood, at(mtx(0, 0.59, 0)));
  for (const y of [0.2, 0.98]) bB.add(new THREE.TorusGeometry(0.125, 0.018, 6, 20), brass, at(mtx(0, y, 0, 0, Math.PI / 2)));
  bB.add(G.box, wood, at(mtx(0, 1.04, 0, 0, 0, 0, V3(0.32, 0.06, 0.32))));
  bB.add(G.box, wood, on(mtx(0, 0, 0, 0, 0, 0, V3(0.78, 0.045, 0.56)))); bB.add(G.box, wood, on(mtx(0, 0.035, 0.27, 0, 0, 0, V3(0.78, 0.03, 0.025))));
  bB.add(G.box, leather, on(mtx(0, 0.034, -0.01, 0, 0, 0, V3(0.7, 0.022, 0.48))));
  const parchment = (left) => { const c = document.createElement('canvas'); c.width = 256; c.height = 340; const x = c.getContext('2d');
    const g = x.createLinearGradient(left ? 256 : 0, 0, left ? 0 : 256, 0); g.addColorStop(0, '#c9ac7c'); g.addColorStop(0.12, '#ead6ad'); g.addColorStop(1, '#f1e2bf'); x.fillStyle = g; x.fillRect(0, 0, 256, 340);
    x.fillStyle = '#4b3524'; x.textAlign = 'center';
    if (left) { x.font = '600 22px Georgia, serif'; x.fillText('The Story of', 128, 64); x.font = '600 34px Georgia, serif'; x.fillText('MAHALA', 128, 104); x.fillRect(70, 120, 116, 2); }
    else { x.strokeStyle = '#6b4a2e'; x.lineWidth = 2; x.beginPath(); x.moveTo(78, 150); x.bezierCurveTo(98, 70, 158, 70, 178, 150); x.lineTo(78, 150); x.stroke(); x.beginPath(); x.moveTo(128, 50); x.lineTo(128, 75); x.stroke(); }
    x.fillStyle = 'rgba(75,53,36,.55)'; for (let y = left ? 150 : 180; y < 310; y += 13) x.fillRect(34, y, 188 - ((y * 7) % 40), 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const pageG = (sd) => { const g = new THREE.PlaneGeometry(0.33, 0.44, 12, 1).rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = clamp((p.getX(i) + 0.165) / 0.33, 0, 1), f = sd < 0 ? 1 - u : u; p.setY(i, 0.045 * Math.sin(Math.PI * Math.pow(f, 0.6)) * (1 - 0.35 * f)); } g.computeVertexNormals(); return g; };
  // the opening spread of the printed book: "For those who dare to wander..." and the gateway painting
  const spread = (i, left) => { const m = std(0xffffff, { map: parchment(left), roughness: 0.9 });
    new THREE.TextureLoader().load(BOOK.pages[i].src, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; m.map = t; m.needsUpdate = true; }); return m; };
  bB.add(pageG(-1), spread(1, true), on(mtx(-0.168, 0.05, -0.01)));
  bB.add(pageG(1), spread(2, false), on(mtx(0.168, 0.05, -0.01)));
  for (const sd of [-1, 1]) bB.add(G.box, std(0xe9dcc0, { roughness: 0.95 }), on(mtx(sd * 0.17, 0.035, -0.01, 0, 0, 0, V3(0.32, 0.02, 0.43))));
  // ribbons hanging over the front edge, as on the real book: magenta, teal, purple and red
  [[0xc8187a, -0.06], [0x17707a, -0.02], [0x6a2a90, 0.02], [0x9c1b30, 0.055]].forEach(([c, dx], i) => { const len = 0.34 + i * 0.04;
    bB.add(new THREE.PlaneGeometry(0.028, len).translate(0, -len / 2, 0), std(c, { side: THREE.DoubleSide, roughness: 0.8 }), at(mtx(dx, 1.11 - 0.25 * Math.sin(0.36) + 0.02, 0.24 * Math.cos(0.36) + 0.03, 0, -0.08 + i * 0.02, 0.05 * (i - 1.5)))); });
  // a brass candlestick at the back, and a quill in its ink pot
  bB.add(new THREE.CylinderGeometry(0.05, 0.07, 0.03, 16), brass, on(mtx(-0.31, 0.03, -0.2))); bB.add(new THREE.CylinderGeometry(0.014, 0.02, 0.24, 10), brass, on(mtx(-0.31, 0.15, -0.2)));
  bB.add(new THREE.CylinderGeometry(0.04, 0.025, 0.03, 12), brass, on(mtx(-0.31, 0.28, -0.2))); bB.add(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), std(0xf3ecdc, { roughness: 0.7 }), on(mtx(-0.31, 0.35, -0.2)));
  bB.add(new THREE.ConeGeometry(0.009, 0.035, 8), LAMP.warm, on(mtx(-0.31, 0.43, -0.2)));
  bB.add(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 12), std(0x16161a, { roughness: 0.3 }), on(mtx(0.31, 0.05, -0.2)));
  const quill = new THREE.Shape(); quill.moveTo(0, 0); quill.quadraticCurveTo(0.03, 0.12, 0.004, 0.28); quill.quadraticCurveTo(-0.02, 0.14, 0, 0);
  bB.add(new THREE.ShapeGeometry(quill, 6), std(0xf4f1ea, { side: THREE.DoubleSide, roughness: 0.9 }), on(mtx(0.31, 0.06, -0.2, 0.4, -0.25, -0.35)));
  ZONES.BOOK = bB.build('BOOK'); ZONES.BOOK.userData.c = BOOK_AT.clone().setY(1.0);
  // the archetype deck in its box, on a small turned stand beside the plinth, three cards fanned out beside it
  const bK = new Bucket(), SK = at(mtx(0.62, 0, 0.12, -0.35)), sk = m => SK.clone().multiply(m);
  bK.add(new THREE.CylinderGeometry(0.15, 0.17, 0.04, 20), wood, sk(mtx(0, 0.02, 0))); bK.add(new THREE.CylinderGeometry(0.04, 0.055, 0.66, 12), wood, sk(mtx(0, 0.37, 0)));
  bK.add(new THREE.CylinderGeometry(0.19, 0.17, 0.035, 24), wood, sk(mtx(0, 0.715, 0))); bK.add(new THREE.TorusGeometry(0.19, 0.008, 6, 32), brass, sk(mtx(0, 0.733, 0, 0, Math.PI / 2)));
  const backTex = new THREE.TextureLoader().load('assets/deck/back.jpg'); backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 4;
  const cardBack = std(0xffffff, { map: backTex, roughness: 0.55 }), cardG = new THREE.PlaneGeometry(0.105, 0.142).rotateX(-Math.PI / 2);
  bK.add(G.box, std(0x2a1a14, { roughness: 0.5 }), sk(mtx(-0.05, 0.756, 0.0, 0.1, 0, 0, V3(0.12, 0.045, 0.158)))); bK.add(cardG, cardBack, sk(mtx(-0.05, 0.7795, 0.0, 0.1)));
  [[0.07, 0.03, -0.35], [0.085, 0.0, -0.1], [0.1, -0.03, 0.18]].forEach(([x, z, r], i) => bK.add(cardG, cardBack, sk(mtx(x, 0.734 + i * 0.002, z, r))));
  ZONES.DECK = bK.build('DECK'); ZONES.DECK.userData.c = DECK_AT.clone().setY(0.75);
  glow(V3(-0.31, 0.45, -0.2).applyMatrix4(TOP), 0xffd08a, 0.7, 1); glow(BOOK_AT.clone().setY(1.25), 0xffd8a0, 2.4, 0.5);
}

/* ---------- the build yard, beside the way before the last gates: laid out in its own frame (YARD_M), turned to the way ---------- */
{
  const b = new Bucket(), bC = new Bucket(), bB = new Bucket(), Y = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => YARD_M.clone().multiply(mtx(x, y, z, ry, rx, rz, s));
  b.add(new THREE.PlaneGeometry(28, 18).rotateX(-Math.PI / 2), M.pad, Y(0, 0.02, 0));
  // container with corrugation
  const corr = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const g = c.getContext('2d'); for (let x = 0; x < 128; x++) { const v = 200 + Math.sin(x / 128 * Math.PI * 2 * 16) * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const contMat = std(0x2b7f98, { roughness: 0.55, metalness: 0.2, map: corr });
  b.add(G.box, contMat, Y(-8, 1.3, -5, 0.0, 0, 0, V3(6.06, 2.59, 2.44)));
  // pallets of acrylic
  ['yellow', 'cyan', 'magenta'].forEach((k, i) => {
    const x = -6 + i * 3.4, z = 4;
    b.add(G.box, M.pineDark, Y(x, 0.08, z, 0, 0, 0, V3(2.6, 0.16, 1.4)));
    b.add(G.box, SHEET[k], Y(x, 0.32, z, 0, 0, 0, V3(2.44, 0.32, 1.22)));
  });
  // work light mast
  b.add(G.cyl, M.grey, Y(-4, 2.8, -1, 0, 0, 0, V3(0.14, 5.6, 0.14)));
  b.add(G.box, M.grey, Y(-4, 5.6, -1, 0, 0, 0, V3(1.6, 0.08, 0.08)));
  b.add(G.box, LAMP.warm, Y(-4.7, 5.5, -1, 0, 0.5, 0, V3(0.42, 0.28, 0.2)));
  b.add(G.box, LAMP.warm, Y(-3.3, 5.5, -1, 0, 0.5, 0, V3(0.42, 0.28, 0.2)));
  glow(YL(-4, 5.4, -1), 0xfff0d8, 9, 0.8);
  // CNC table
  const cx = 7, cz = -2;
  bC.add(G.box, M.grey, Y(cx, 0.45, cz, 0, 0, 0, V3(3.2, 0.9, 1.7)));
  bC.add(G.box, M.ply, Y(cx, 0.92, cz, 0, 0, 0, V3(3.0, 0.03, 1.5)));
  bC.add(G.box, M.dark, Y(cx + 0.4, 1.35, cz - 0.85, 0, 0, 0, V3(0.12, 0.9, 0.12)));
  bC.add(G.box, M.dark, Y(cx + 0.4, 1.35, cz + 0.85, 0, 0, 0, V3(0.12, 0.9, 0.12)));
  bC.add(G.box, M.dark, Y(cx + 0.4, 1.8, cz, 0, 0, 0, V3(0.16, 0.16, 1.9)));
  bC.add(G.box, LAMP.cyan, Y(cx + 0.4, 1.55, cz + 0.2, 0, 0, 0, V3(0.2, 0.32, 0.2)));
  ZONES.YARD_CNC = bC.build('YARD_CNC');
  // Temple Tech bench
  const bx = -9, bz = 7.5;
  bB.add(G.box, M.pine, Y(bx, 0.9, bz, 0, 0, 0, V3(2.6, 0.07, 0.95)));
  for (const [dx, dz] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) bB.add(G.box, M.pineDark, Y(bx + dx, 0.45, bz + dz, 0, 0, 0, V3(0.08, 0.9, 0.08)));
  bB.add(G.box, LAMP.warm, Y(bx - 0.6, 1.17, bz, 0.4, 0, 0, V3(0.46, 0.46, 0.46)));
  { // coils on the bench: black rings with the former's two crossing windings painted on, w = 7u + 8v and 7u - 8v (cheaper than the full model)
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#19181b'; x.fillRect(0, 0, 1024, 256);
    x.strokeStyle = '#c98552'; x.lineWidth = 3;
    for (const sg of [1, -1]) for (let n = -9; n <= 16; n++) for (const dn of [-0.06, 0.06]) { x.beginPath(); x.moveTo(0, ((n + dn) / 8 * sg) * 256); x.lineTo(1024, ((n + dn - 7) / 8 * sg) * 256); x.stroke(); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4;
    const coilBody = std(0xffffff, { map: tx, roughness: 0.42, metalness: 0.3 });
    for (let i = 0; i < 3; i++) bB.add(new THREE.TorusGeometry(0.13, 0.045, 16, 48), coilBody, Y(bx + 0.3 + i * 0.32, 0.99, bz + 0.1, 0, Math.PI / 2, 0)); }
  ZONES.BENCH = bB.build('BENCH');
  ZONES.BENCH.userData.c = YL(bx, 1, bz);
  ZONES.YARD_CNC.userData.c = YL(cx, 1, cz);
  ZONES.YARD = b.build('YARD');
  // timber stacks, instanced battens
  const bat = new THREE.InstancedMesh(new THREE.BoxGeometry(4.8, 0.076, 0.038), M.pine, 3 * 12 * 9);
  let n = 0; for (let s = 0; s < 3; s++) for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) bat.setMatrixAt(n++, Y(4, 0.1 + row * 0.095, 5 + s * 1.1 + col * 0.06 - 0.33));
  bat.castShadow = bat.receiveShadow = true; bat.userData.pick = 'YARD'; scene.add(bat); ZONES.YARD.add(bat);
}

/* ---------- the gates: seven timber gateways across the way, each with its lantern, in the order you meet them ---------- */
const GATES = {};
const GATE_S = [ST.gate1, ST.gate2, ST.gate3, ST.gate4, ST.gate5, ST.gate6, ST.gate7];
DATA.gates.forEach((g, i) => {
  const s = GATE_S[i], p = wayP(s), t = wayT(s), col = ['yellow', 'cyan', 'magenta'][i % 3], W = 2.05;
  const grp = new THREE.Group(); grp.position.copy(p); grp.rotation.y = Math.atan2(-t.x, -t.z);       // local x runs across the way
  const parts = [], add = (geo, mat, x, y, z, sx, sy, sz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; parts.push(m); return m; };
  for (const sd of [-1, 1]) { add(G.box, M.pineDark, sd * W, 1.6, 0, 0.18, 3.2, 0.18); add(G.box, M.pineDark, sd * W, 0.06, 0, 0.42, 0.12, 0.42); }
  add(G.box, M.pineDark, 0, 3.24, 0, 2 * W + 0.62, 0.17, 0.22); add(G.box, M.rim, 0, 2.95, 0, 2 * W - 0.2, 0.08, 0.12);
  const lampMat = LAMP[col].clone(); add(G.box, lampMat, 0, 2.38, 0, 0.32, 0.4, 0.32);
  add(G.box, M.rim, 0, 2.62, 0, 0.46, 0.05, 0.46); add(G.box, M.rim, 0, 2.15, 0, 0.46, 0.05, 0.46);
  for (const [bx, bz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) add(G.box, M.rim, bx, 2.38, bz, 0.035, 0.5, 0.035);
  add(new THREE.ConeGeometry(0.34, 0.24, 4), M.rim, 0, 2.76, 0, 1, 1, 1, Math.PI / 4); add(G.box, M.rim, 0, 2.92, 0, 0.025, 0.12, 0.025);
  for (const m of parts) { m.castShadow = true; m.userData.pick = g.id; grp.add(m); }
  scene.add(grp); GATES[g.id] = grp; grp.userData.c = p.clone().setY(1.6); grp.userData.lamp = lampMat; grp.userData.s = s;
  grp.userData.glow = glow(p.clone().setY(2.38), { yellow: 0xffd81f, cyan: 0x14a8e0, magenta: 0xd8197f }[col], 3.6, 0.9);
});

/* ---------- quest pins ---------- */
const PINS = {};
const pinGeo = mergeGeometries([new THREE.SphereGeometry(0.85, 18, 12), new THREE.ConeGeometry(0.62, 1.5, 18, 1, true).rotateX(Math.PI).translate(0, -1.05, 0)], false);
const pinDot = new THREE.SphereGeometry(0.34, 12, 8);
const PINMAT = { y: std(0xffd81f, { roughness: 0.35, emissive: 0xffd81f, emissiveIntensity: 0.15 }), c: std(0x14a8e0, { roughness: 0.35, emissive: 0x14a8e0, emissiveIntensity: 0.15 }), m: std(0xd8197f, { roughness: 0.35, emissive: 0xd8197f, emissiveIntensity: 0.15 }) };
const whiteMat = std(0xffffff, { roughness: 0.4 });
DATA.quests.forEach((q, i) => {
  const grp = new THREE.Group(); grp.position.copy(q.pin);
  const body = new THREE.Mesh(pinGeo, PINMAT[q.tone]); body.castShadow = true;
  const dot = new THREE.Mesh(pinDot, whiteMat); dot.position.set(0, 0.05, 0.62);
  body.userData.pick = q.id; dot.userData.pick = q.id;
  grp.add(body, dot); grp.userData.base = q.pin.y; grp.userData.phase = i * 0.9; scene.add(grp); PINS[q.id] = grp;
});

/* ---------- the bakkie ---------- */
const bakkie = new THREE.Group();
{
  const add = (mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(G.box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; bakkie.add(m); return m; };
  add(M.bakkie, 0, 0.75, 0, 5.2, 0.62, 1.86);
  add(M.bakkie, 0.75, 1.42, 0, 1.9, 0.78, 1.78);
  add(M.glassDark, 1.62, 1.46, 0, 0.1, 0.56, 1.6);
  add(M.glassDark, 0.75, 1.48, 0.9, 1.6, 0.46, 0.04); add(M.glassDark, 0.75, 1.48, -0.9, 1.6, 0.46, 0.04);
  add(LAMP.cyan, 0, 0.78, 0.94, 5.1, 0.12, 0.02); add(LAMP.cyan, 0, 0.78, -0.94, 5.1, 0.12, 0.02);
  add(M.pineDark, -1.3, 1.2, 0, 2.3, 0.24, 1.5);
  const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14).rotateX(Math.PI / 2);
  for (const [x, z] of [[1.7, 0.86], [1.7, -0.86], [-1.6, 0.86], [-1.6, -0.86]]) { const w = new THREE.Mesh(wg, M.dark); w.position.set(x, 0.38, z); w.castShadow = true; bakkie.add(w); }
  bakkie.traverse(o => { if (o.isMesh) o.userData.pick = 'YARD'; });
  scene.add(bakkie);
}
const BK = { u: 0, phase: 'in', wait: 0 };

/* ---------- the star on the playa (top-down night render as an additive decal) ---------- */
const texLoader = new THREE.TextureLoader();
const starTex = texLoader.load('assets/star_k9b.jpg'); starTex.colorSpace = THREE.SRGBColorSpace;
const starDecal = new THREE.Mesh(new THREE.PlaneGeometry(70.71, 70.71).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
starDecal.position.y = 0.06; starDecal.rotation.y = THREE.MathUtils.degToRad(-20); starDecal.renderOrder = 2; scene.add(starDecal);
const domeGlow = glow(V3(0, 3.2, 0), 0xffe6b8, 26, 0.7);
const domeGlow2 = glow(V3(0, 2.4, 0), 0xffc27a, 12, 0.9);

/* ---------- registry of everything you can select ---------- */
const REG = {};
const reg = (id, o) => { REG[id] = Object.assign({ id }, o); };
const temple = new THREE.Group(); scene.add(temple);
const RING_INFO = { C: 'yellow', D: 'cyan', E: 'magenta', F: 'yellow', G: 'cyan', H: 'magenta', I: 'yellow', J: 'cyan' };
const PANELS = { C: 18, D: 18, E: 18, F: 18, G: 18, H: 18, I: 18, J: '17, one bay is the doorway' };
const ringBox = {};
const petalBox = {};

reg('TEMPLE', { kind: 'temple', title: 'The Seed', chip: 'The temple', obj: temple, focus: () => ({ t: V3(0, 2.8, 0), d: 40, p: 1.06 }) });
reg('FRAME', { kind: 'frame', title: 'The frame', chip: 'Timber', obj: temple, focus: () => ({ t: V3(0, 2.8, 0), d: 30, p: 1.0 }) });
reg('CAP', { kind: 'cap', title: 'The finial cap', chip: 'The crown', obj: temple, focus: () => ({ t: V3(0, 5.4, 0), d: 17, p: 0.92 }) });
reg('FLOOR_GRID', { kind: 'grid', title: 'The Golden Seed of Life', chip: 'Floor pattern', obj: temple, focus: () => ({ t: V3(0, 0, 0), d: 120, p: 0.32 }) });
for (const L of 'CDEFGHIJ') reg('RING_' + L, { kind: 'ring', L, title: `Ring ${L}, ${RING_INFO[L]}`, chip: 'Cast acrylic', obj: null, focus: () => { const b = ringBox[L]; const y = b ? (b.min.y + b.max.y) / 2 : 2; return { t: V3(0, y, 0), d: 22, p: 1.16 }; } });
for (const r of 'AB') for (let i = 1; i <= 6; i++) { const id = `PETAL_${r}0${i}`; reg(id, { kind: 'petal', row: r, num: i, title: id === 'PETAL_A01' ? 'The way in' : `Petal ${r}0${i}`, chip: id === 'PETAL_A01' ? 'East door' : 'Fixed half open', obj: null, focus: () => {
  const b = petalBox[id]; if (!b) return { t: V3(0, 1.5, 0), d: 20, p: 1.1 };
  const c = b.getCenter(V3()); if (id === 'PETAL_A01') return { t: V3(6, 1.6, 0), d: 27, p: 1.22, a: 1.3 };
  return { t: V3(c.x, 1.4, c.z), d: 17, p: 1.12, a: Math.atan2(c.x, c.z) }; } }); }
reg('CAMP', { kind: 'camp', title: 'Mahala camp', chip: 'Theme camp', obj: ZONES.CAMP, focus: () => ({ t: V3(CAMP.x + 1, 1, CAMP.z + 2), d: 72, p: 0.9 }) });
reg('CAMP_KITCHEN', { kind: 'kitchen', title: 'The camp kitchen', chip: 'Meal shifts', obj: ZONES.CAMP_KITCHEN, focus: () => ({ t: ZONES.CAMP_KITCHEN.userData.c.clone().setY(2), d: 30, p: 1.0 }) });
reg('CAMP_LOTUS', { kind: 'lotus', title: 'The Lotus Mahal', chip: 'Camp', obj: ZONES.CAMP_LOTUS, focus: () => ({ t: ZONES.CAMP_LOTUS.userData.c.clone().setY(2), d: 30, p: 1.05, a: Math.atan2(MAHAL_OUT.x, MAHAL_OUT.z) + 0.35 }) });
reg('YARD', { kind: 'yard', title: 'The build yard', chip: 'Fabrication', obj: ZONES.YARD, focus: () => ({ t: V3(YARD.x, 1, YARD.z), d: 62, p: 0.92 }) });
reg('YARD_CNC', { kind: 'cnc', title: 'The CNC cutting table', chip: 'Build yard', obj: ZONES.YARD_CNC, focus: () => ({ t: ZONES.YARD_CNC.userData.c.clone(), d: 18, p: 1.0 }) });
reg('BENCH', { kind: 'bench', title: 'The Temple Tech bench', chip: 'Gifts and research', obj: ZONES.BENCH, focus: () => ({ t: ZONES.BENCH.userData.c.clone(), d: 14, p: 1.02 }) });
DATA.gates.forEach(g => reg(g.id, { kind: 'gate', g, title: `Gate ${g.n}, ${g.name.replace(/^The /, 'the ')}`, chip: g.amount, obj: GATES[g.id], focus: () => ({ t: GATES[g.id].userData.c.clone(), d: 24, p: 1.1, a: 0.95 }) }));
DATA.quests.forEach(q => reg(q.id, { kind: 'quest', q, title: q.name, chip: 'Open', obj: PINS[q.id], focus: () => { const f = REG[q.where].focus(); return f; } }));
DATA.events.forEach(e => reg(e.id, { kind: 'event', e, title: e.name, chip: e.date, obj: null, anchor: e.where, focus: () => REG[e.where].focus() }));
DATA.crews.forEach(c => reg(c.id, { kind: 'crew', c, title: c.name, chip: 'Forming', obj: null, anchor: c.where, focus: () => REG[c.where].focus() }));
DATA.roles.forEach(r => reg(r.id, { kind: 'role', r, title: r.name, chip: 'Open', obj: null, anchor: r.where, focus: () => REG[r.where].focus() }));
/* Temple Tech, the camp pieces and the verse stones */
const centreGroup = new THREE.Group(); scene.add(centreGroup); centreGroup.visible = false;
const PODS = {};
for (const k in PODS_INFO) { const c = POD_CENTRES[k]; const f = PODS_INFO[k];
  reg('POD_' + k, { kind: 'pod', key: k, title: f.name, chip: f.element, obj: null, focus: () => ({ t: V3(c[0], 1.2, c[2]), d: 15, p: 1.16, a: Math.atan2(c[0], c[2]) }) }); }
reg('CENTRE', { kind: 'centre', title: 'The centrepiece', chip: 'Temple Tech', obj: centreGroup, inside: true, focus: () => ({ t: V3(0, 1.25, 0), d: 2.9, p: 1.45, a: Math.PI / 2 + 0.25 }) });
reg('MAHAL_COIL', { kind: 'coil', title: 'The big coil', chip: 'Temple Tech', obj: ZONES.MAHAL_COIL, inside: 'mahal', focus: () => ({ t: V3(CAMP.x, 1.3, CAMP.z), d: 2.7, p: 1.4, a: Math.atan2(MAHAL_OUT.x, MAHAL_OUT.z) + 0.55 }) });
reg('COIL_140', { kind: 'coil', title: 'The 140 mm coil', chip: 'Temple Tech', obj: null, anchor: 'BENCH', focus: () => REG.BENCH.focus() });
reg('PENDANT', { kind: 'pendant', title: 'The pendants', chip: 'Temple Tech', obj: null, anchor: 'BENCH', focus: () => REG.BENCH.focus() });
reg('CAMP_DRIFT', { kind: 'drift', title: 'Blissfull Drift', chip: 'The camp boat', obj: ZONES.CAMP_DRIFT, focus: () => ({ t: DRIFT.clone().setY(1.6), d: 30, p: 1.02, a: 0.67 }) });
const FIRE_VIEW = () => ({ t: FIRE_AT.clone().setY(1.05), d: 4.8, p: 1.2, a: Math.atan2(DRIFT_STERN.x, DRIFT_STERN.z) + 0.3 });
reg('CAMP_FIRE', { kind: 'fire', title: 'The fireside', chip: 'In Blissfull Drift', obj: ZONES.CAMP_FIRE, focus: () => ({ t: FIRE_AT.clone().setY(0.8), d: 11, p: 0.95, a: Math.atan2(DRIFT_STERN.x, DRIFT_STERN.z) + 0.5 }) });
FIRESIDE.forEach(p => reg(p.id, { kind: 'piece', p, title: p.title, chip: p.kind, obj: ZONES.CAMP_FIRE, focus: FIRE_VIEW }));
reg('DECK', { kind: 'deck', title: 'The Mahala Archetype Deck', chip: 'Beside the book', obj: ZONES.DECK, focus: () => ({ t: DECK_AT.clone().setY(0.78), d: 3.4, p: 0.95, a: BOOK_RY + 0.75 }) });
ARCH.forEach(a => reg(a.id, { kind: 'arch', a, title: a.title, chip: 'Archetype card', obj: ZONES.DECK, focus: FIRE_VIEW }));
reg('BOOK', { kind: 'book', title: 'The Book of Mahala', chip: 'At the way in', obj: ZONES.BOOK, focus: () => ({ t: BOOK_AT.clone().setY(1.0), d: 5.2, p: 1.08, a: BOOK_RY + 0.3 }) });
reg('CAMP_PORTAL', { kind: 'portal', title: 'The MAHALA portal', chip: 'The way into the camp', obj: ZONES.CAMP_PORTAL, focus: () => ({ t: PORTAL.clone().setY(2.4), d: 22, p: 1.2, a: 2.24 }) });
const VERSE_OBJ = {}; let PLAQUE_MAT = null;
{ const plaque = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d'); x.fillStyle = '#efe6d6'; x.fillRect(0, 0, 128, 192); x.strokeStyle = '#b07a4a'; x.lineWidth = 4;
    x.beginPath(); for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 5, r = 4 + i * 0.5; x[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 80 + Math.sin(a) * r); } x.stroke();
    x.fillStyle = '#8a6a50'; for (const y of [146, 160, 174]) x.fillRect(24, y, 80, 3); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const plaqueMat = std(0xffffff, { map: plaque, emissive: 0xffd9a0, emissiveMap: plaque, emissiveIntensity: 0, roughness: 0.8 });
  for (const v of VERSES) {
    const g = new THREE.Group(); g.position.copy(v.at); const face = faceWay(v.at, nearestS(v.at));
    const stone = new THREE.Mesh(G.sphere, M.stone); stone.scale.set(0.95, 1.7, 0.42); stone.position.y = 0.72; stone.castShadow = true; g.add(stone);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.63), plaqueMat); pl.position.set(0, 0.86, 0.19); g.add(pl);
    g.rotation.y = face; g.traverse(o => { if (o.isMesh) o.userData.pick = v.id; }); scene.add(g); VERSE_OBJ[v.id] = g;
    glow(V3(v.at.x, 0.9, v.at.z), 0xffd9a0, 2.2, 0.7);
    reg(v.id, { kind: 'verse', v, title: v.title, chip: FIRE_BY[v.piece].title, obj: g, focus: () => ({ t: v.at.clone().setY(0.8), d: 11, p: 1.18, a: face }) });
  }
  PLAQUE_MAT = plaqueMat;
}
const objFor = id => { const it = REG[id]; if (!it) return null; if (it.obj) return it.obj; if (it.anchor) return objFor(it.anchor); return null; };

/* zone labels in the world */
const ZONE_LABELS = [
  { id: 'TEMPLE', text: 'The Seed', p: V3(0, 9.5, 0), dot: 'var(--yellow)' },
  { id: 'CAMP', text: 'Mahala camp', p: CAMP_HEART.clone().setY(8), dot: 'var(--magenta)' },
  { id: 'YARD', text: 'Build yard', p: V3(YARD.x, 7.5, YARD.z), dot: 'var(--cyan)' },
  { id: 'BOOK', text: 'The Book of Mahala', p: BOOK_AT.clone().setY(5), dot: 'var(--yellow)' },
];
for (const z of ZONE_LABELS) { const el = document.createElement('div'); el.className = 'wl zone'; el.innerHTML = `<i style="background:${z.dot}"></i>${z.text}`; $('#labels').appendChild(el); z.el = el; }

/* ---------- builders (the scale figure from the model, instanced) ---------- */
let builders = null; const WALK = [];
function setupBuilders(personGeo) {
  const g = personGeo.clone(); g.computeBoundingBox(); const bb = g.boundingBox; const c = bb.getCenter(V3());
  g.translate(-c.x, -bb.min.y, -c.z);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const curves = [PATH.camp, PATH.yard, PATH.east];
  const walkers = [[0, 0.1, 1], [0, 0.35, -1], [0, 0.62, 1], [0, 0.85, -1], [1, 0.3, 1], [1, 0.7, -1], [2, 0.18, 1], [2, 0.45, -1], [2, 0.72, 1], [0, 0.5, 1]];
  walkers.forEach(([ci, u, dir], i) => WALK.push({ curve: curves[ci], u, dir, speed: 1.15 + (i % 3) * 0.18, wait: 0, ph: i * 1.7, s: 0.94 + (i % 4) * 0.04 }));
  const kd = beside(ST.kitchen, 4.6, -1), sl = beside(ST.sail - 3, 5.2, 1), md = MAHAL_DOOR.clone().addScaledVector(MAHAL_OUT, 2.4), yp = (x, z, a) => { const q = YL(x, 0, z); return [q.x, q.z, a + YARD_RY]; };
  const stand = [[13.5, 3.2, -1.9], [11.2, 4.9, -1.2], [-7.5, 8.0, 0.6], [5, -9.5, 2.6], [kd.x, kd.z, faceWay(kd, ST.kitchen) + Math.PI], [sl.x, sl.z, faceWay(sl, ST.sail)], [md.x, md.z, Math.atan2(-MAHAL_OUT.x, -MAHAL_OUT.z)], yp(7, -0.6, 3.1), yp(-9, 8.6, 3.3), yp(2, 3.2, -1.2), yp(-5.5, 5.6, 0.2)];
  stand.forEach(([x, z, a], i) => WALK.push({ fixed: V3(x, 0, z), a, s: 0.94 + (i % 4) * 0.04 }));
  builders = new THREE.InstancedMesh(g, M.person, WALK.length); builders.castShadow = true; builders.receiveShadow = true; builders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  builders.frustumCulled = false; scene.add(builders);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function updateBuilders(dt, t) {
  if (!builders) return;
  WALK.forEach((w, i) => {
    let p, a, bob = 0;
    if (w.fixed) { p = w.fixed; a = w.a; }
    else {
      if (w.wait > 0) w.wait -= dt; else { const L = w.curve.getLength(); w.u += w.dir * w.speed * dt / L; if (w.u > 1 || w.u < 0) { w.u = clamp(w.u, 0, 1); w.dir *= -1; w.wait = 2 + (i % 4) * 1.5; } }
      p = w.curve.getPointAt(clamp(w.u, 0, 1)); const tg = w.curve.getTangentAt(clamp(w.u, 0, 1)).multiplyScalar(w.dir);
      a = Math.atan2(tg.x, tg.z); bob = w.wait > 0 ? 0 : Math.abs(Math.sin(t * 5.2 + w.ph)) * 0.045;
      p = V3(p.x + Math.cos(a) * 0.5 * (i % 2 ? 1 : -1), 0, p.z - Math.sin(a) * 0.5 * (i % 2 ? 1 : -1));
    }
    _q.setFromEuler(_e.set(0, a, 0)); _m.compose(V3(p.x, bob, p.z), _q, V3(w.s, w.s, w.s)); builders.setMatrixAt(i, _m);
  });
  builders.instanceMatrix.needsUpdate = true;
}

/* ---------- load the temple model ---------- */
const draco = new DRACOLoader(); draco.setDecoderPath('assets/draco/'); draco.setDecoderConfig({ type: 'js' });
const gltfLoader = new GLTFLoader(); gltfLoader.setDRACOLoader(draco);
const PICKABLE = [];
function partOf(o) { for (let n = o; n; n = n.parent) { const m = /^(FRAME|RING_[A-J]|ENTRANCE|CAP|PETAL_[AB]\d\d|FLOOR_GRID|PERSON)/.exec(n.name || ''); if (m) return m[1]; } return null; }
function onTemple(gltf) {
  let personGeo = null;
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const part = partOf(o); o.material = matFor(o.material && o.material.name);
    if (part === 'PERSON') { personGeo = o.geometry; o.visible = false; return; }
    const isGlass = /^RING_/.test(part); const isGrid = part === 'FLOOR_GRID';
    o.castShadow = !isGlass && !isGrid; o.receiveShadow = true;
    if (isGlass) o.renderOrder = 1;
    o.userData.pick = part === 'ENTRANCE' ? 'PETAL_A01' : part;
    if (o.userData.pick) PICKABLE.push(o);
  });
  temple.add(gltf.scene); temple.updateMatrixWorld(true);
  gltf.scene.traverse(o => { if (!o.isMesh) return; const part = partOf(o); const b = new THREE.Box3().setFromObject(o);
    if (/^RING_/.test(part)) { const L = part.slice(5); ringBox[L] = (ringBox[L] || b.clone()).union(b); REG['RING_' + L].meshes = (REG['RING_' + L].meshes || []).concat(o); }
    if (/^PETAL_/.test(part)) { petalBox[part] = (petalBox[part] || b.clone()).union(b); REG[part].meshes = (REG[part].meshes || []).concat(o); }
    if (part === 'CAP') REG.CAP.meshes = (REG.CAP.meshes || []).concat(o);
    if (part === 'FLOOR_GRID') REG.FLOOR_GRID.meshes = (REG.FLOOR_GRID.meshes || []).concat(o);
    if (part === 'FRAME') REG.FRAME.meshes = (REG.FRAME.meshes || []).concat(o);
  });
  if (personGeo) setupBuilders(personGeo);
  panelize(); collectGlass();
}
// the panels light in columns: from the east door round the temple, and from the ground up in each column
function panelize() {
  const all = [], v = V3();
  'JIHGFEDC'.split('').forEach((L, ringUp) => {
    for (const m of REG['RING_' + L].meshes || []) {
      m.updateMatrixWorld(true); const g = m.geometry, pos = g.attributes.position, idx = g.index, nT = (idx ? idx.count : pos.count) / 3;
      const parent = Array.from({ length: nT }, (_, i) => i), find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      const seen = new Map(), key = i => { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); return Math.round(v.x * 200) + ',' + Math.round(v.y * 200) + ',' + Math.round(v.z * 200); };
      const vi = (t, k) => idx ? idx.getX(t * 3 + k) : t * 3 + k;
      for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const kk = key(vi(t, k)); if (seen.has(kk)) { const a = find(t), b = find(seen.get(kk)); if (a !== b) parent[a] = b; } else seen.set(kk, t); }
      const comps = new Map();
      for (let t = 0; t < nT; t++) { const r = find(t); if (!comps.has(r)) comps.set(r, { tris: [], x: 0, z: 0, n: 0 }); const c = comps.get(r); c.tris.push(t); v.fromBufferAttribute(pos, vi(t, 0)).applyMatrix4(m.matrixWorld); c.x += v.x; c.z += v.z; c.n++; }
      for (const c of comps.values()) { const a = ((Math.atan2(c.z / c.n, c.x / c.n) * 180 / Math.PI) + 360) % 360; all.push({ m, tris: c.tris, ring: ringUp, col: Math.floor(((a + 10) % 360) / 20) }); }
    }
  });
  all.sort((p, q) => p.col - q.col || p.ring - q.ring);
  all.forEach((p, rank) => { p.rank = rank; });
  const byMesh = new Map(); all.forEach(p => { if (!byMesh.has(p.m)) byMesh.set(p.m, []); byMesh.get(p.m).push(p); });
  for (const [m, list] of byMesh) {
    const g = m.geometry, pos = g.attributes.position, idx = g.index, arr = new Float32Array(pos.count), triRank = new Float32Array((idx ? idx.count : pos.count) / 3);
    for (const p of list) for (const t of p.tris) { triRank[t] = p.rank; for (let k = 0; k < 3; k++) arr[idx ? idx.getX(t * 3 + k) : t * 3 + k] = p.rank; }
    g.setAttribute('prank', new THREE.BufferAttribute(arr, 1)); m.userData.triRank = triRank;
  }
  LIT.total = all.length;
}
// the glass shader learns which panels are lit: an unlit panel is clear, pale acrylic waiting for its colour; the newest three pulse
for (const m of Object.values(GLASS)) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uLit = LIT.count; sh.uniforms.uLitMode = LIT.mode; sh.uniforms.uT = LIT.t;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float prank;\nvarying float vRank;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRank = prank;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLit; uniform float uLitMode; uniform float uT; varying float vRank;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat unlit = uLitMode * step(uLit - 0.5, vRank);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.92), unlit * 0.64);\ndiffuseColor.a *= 1.0 - unlit * 0.5;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - unlit * 0.8;\nfloat fresh = uLitMode * (1.0 - step(uLit - 0.5, vRank)) * step(uLit - 3.5, vRank);\ntotalEmissiveRadiance += diffuseColor.rgb * fresh * (0.3 + 0.3 * sin(uT * 3.0));');
  };
  m.customProgramCacheKey = () => 'litglass';
}
/* the copper forms, Set 3, on the outer circles of the floor pattern */
const COPPER = new THREE.Color().setRGB(0.82, 0.44, 0.27, THREE.LinearSRGBColorSpace);
const PODMAT = { PD_Copper_Hub: std(COPPER.clone().multiplyScalar(0.9), { metalness: 0.6, roughness: 0.4, envMapIntensity: 1.1 }), PD_Copper: std(COPPER, { metalness: 0.6, roughness: 0.34, envMapIntensity: 1.1 }) };
function onPods(gltf) {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return; let k = null; for (let n = o; n && !k; n = n.parent) { const m = /^POD_(TETRA|CUBE|OCTA|VE|DODECA|ICOSA)/.exec(n.name || ''); if (m) k = m[1]; }
    if (!k) return; o.material = PODMAT[o.material && o.material.name] || PODMAT.PD_Copper; o.castShadow = true; o.receiveShadow = true; o.userData.pick = 'POD_' + k; PICKABLE.push(o);
    (PODS[k] = PODS[k] || []).push(o);
  });
  scene.add(gltf.scene); gltf.scene.updateMatrixWorld(true);
  for (const k in PODS) { REG['POD_' + k].meshes = PODS[k]; REG['POD_' + k].obj = PODS[k][0]; }
}
/* the centrepiece: plinth, coil nest, glass egg, water and the stirrer */
const CM = {
  IN_Timber_hardwood: std(0xa0703f, { roughness: 0.55 }), IN_Timber_dark_stain: std(0x3b2a20, { roughness: 0.6 }), IN_Steel_dark: std(0x2a2c30, { metalness: 0.8, roughness: 0.4 }),
  IN_Magnet_N_red: std(0xb8322a, { roughness: 0.5 }), IN_Magnet_S_blue: std(0x2a4fb8, { roughness: 0.5 }), IN_LED_warm_2700K: std(0xffd6a0, { emissive: 0xffb060, emissiveIntensity: 2.2 }),
  IN_Coil_former_pale: std(0xe9e1d2, { roughness: 0.7 }), IN_Coil_former_black: std(0x18171a, { roughness: 0.5, metalness: 0.05 }), IN_Copper_wire: std(COPPER, { metalness: 1, roughness: 0.32, envMapIntensity: 1 }),
  IN_Glass_egg: std(0xeef6f8, { transparent: true, opacity: 0.2, roughness: 0.04, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 }),
  IN_Water: std(0x6fb3cc, { transparent: true, opacity: 0.3, roughness: 0.08, depthWrite: false, envMapIntensity: 1.2 }), IN_PTFE_white: std(0xf4f4f0),
};
const SPIN = []; let vortex = null;
function onCentre(gltf) {
  gltf.scene.traverse(o => {
    let part = null; for (let n = o; n && !part; n = n.parent) { const m = /^IN_(PLINTH|MAGNET|LED|COIL_FORMER|COIL_WIRE|EGG|WATER|STIRBAR)/.exec(n.name || ''); if (m) part = m[1]; }
    if ((o.name === 'IN_MAGNET' || o.name === 'IN_STIRBAR') && !o.isMesh) SPIN.push(o);
    if (!o.isMesh) return; if ((o.name === 'IN_MAGNET' || o.name === 'IN_STIRBAR')) SPIN.push(o);
    o.material = CM[o.material && o.material.name] || CM.IN_Timber_hardwood; o.castShadow = part !== 'EGG' && part !== 'WATER'; o.receiveShadow = true;
    if (part === 'WATER') o.renderOrder = 3; if (part === 'EGG') o.renderOrder = 4;
    o.userData.pick = 'CENTRE'; PICKABLE.push(o);
  });
  centreGroup.add(gltf.scene);
  // a slow vortex in the water, drawn as a shallow funnel with a spiral on it
  const prof = []; for (let i = 0; i <= 24; i++) { const r = 0.004 + i / 24 * 0.104; prof.push(new THREE.Vector2(r, -0.075 * Math.exp(-Math.pow(r / 0.034, 2)))); }
  const sp = document.createElement('canvas'); sp.width = sp.height = 256; const x = sp.getContext('2d'); x.fillStyle = '#9fd2e2'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 3;
  for (let k = 0; k < 6; k++) { x.beginPath(); for (let i = 0; i <= 60; i++) { const t = i / 60; x[i ? 'lineTo' : 'moveTo'](t * 256, ((k / 6 + t * 0.6) % 1) * 256); } x.stroke(); }
  const st = new THREE.CanvasTexture(sp); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.colorSpace = THREE.SRGBColorSpace;
  vortex = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshStandardMaterial({ map: st, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  vortex.position.y = 1.3761; vortex.renderOrder = 3; vortex.userData.pick = 'CENTRE'; centreGroup.add(vortex);
  REG.CENTRE.meshes = []; centreGroup.traverse(o => { if (o.isMesh && o !== vortex) REG.CENTRE.meshes.push(o); });
}
// the models ship as script modules (base64 GLB), since artifacts serve scripts but not .glb files
function loadGLB(path) {
  return import(path).then(m => new Promise((res, rej) => { const raw = atob(m.default), bin = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i); gltfLoader.parse(bin.buffer, '', res, rej); }));
}
$('#loadBar').style.width = '30%';
let loadedN = 0; const bump = () => { loadedN++; $('#loadBar').style.width = (30 + loadedN * 22) + '%'; };
Promise.allSettled([
  loadGLB('./assets/mahala_temple_glb.js').then(g => { onTemple(g); bump(); }),
  loadGLB('./assets/pods_glb.js').then(g => { onPods(g); bump(); }),
  loadGLB('./assets/centre_glb.js').then(g => { onCentre(g); bump(); }),
  loadGLB('./assets/coil_former_glb.js').then(g => { g.scene.traverse(o => { if (o.isMesh && !FORMER.geo) FORMER.geo = o.geometry; }); worldCoil(); }),
]).then(res => {
  res.forEach(r => { if (r.status === 'rejected') console.error(r.reason); });
  if (res[0].status === 'rejected') $('#loadMsg').textContent = 'The temple model did not load. The rest of the world is here.';
  finishLoading();
});
function finishLoading() {
  $('#loadBar').style.width = '100%';
  for (const id in ZONES) ZONES[id].traverse(o => { if (o.isMesh || o.isInstancedMesh) PICKABLE.push(o); });
  Object.values(GATES).forEach(g => g.traverse(o => { if (o.isMesh) PICKABLE.push(o); }));
  Object.values(PINS).forEach(g => g.traverse(o => { if (o.isMesh) PICKABLE.push(o); }));
  bakkie.traverse(o => { if (o.isMesh) PICKABLE.push(o); }); PICKABLE.push(flag);
  Object.values(VERSE_OBJ).forEach(g => g.traverse(o => { if (o.isMesh) PICKABLE.push(o); }));
  scene.traverse(o => { if ((o.isLineSegments || (o.isMesh && !o.parent?.isGroup)) && /^CAMP_/.test(o.userData.pick || '') && !PICKABLE.includes(o)) PICKABLE.push(o); });
  worldReady();
}

/* ---------- camera moves ---------- */
const HOME_DESK = { t: V3(104, 0, 6), d: 300, p: 0.84, a: 0.22 }, HOME_PHONE = { t: V3(112, 0, 0), d: 340, p: 0.8, a: Math.PI / 2 - 0.42 };
let HOME = innerWidth <= 760 ? HOME_PHONE : HOME_DESK;
let fly = null;
function setView(v) { const s = new THREE.Spherical(v.d, v.p, v.a); controls.target.copy(v.t); camera.position.copy(v.t).add(V3().setFromSpherical(s)); camera.lookAt(v.t); controls.update(); }
function flyTo(v, dur = 1.2, then = null) {
  const off = camera.position.clone().sub(controls.target); const s0 = new THREE.Spherical().setFromVector3(off);
  const a1 = v.a ?? s0.theta; let dA = a1 - s0.theta; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
  const dm = (innerWidth <= 760 && v !== HOME && v.d) ? 1.5 : 1;
  fly = { t0: performance.now(), dur: REDUCED ? 0.01 : dur * 1000, from: { t: controls.target.clone(), d: s0.radius, p: s0.phi, a: s0.theta }, to: { t: v.t.clone(), d: clamp((v.d ?? s0.radius) * (inside ? 1 : dm), controls.minDistance, controls.maxDistance), p: v.p ?? s0.phi }, dA, then, lift: v.lift || 0 };
}
function stepFly(now) {
  if (!fly) return false;
  const k = ease(clamp((now - fly.t0) / fly.dur, 0, 1)), f = fly.from, T = fly.to;
  let t = f.t.clone().lerp(T.t, k); const arc = Math.sin(Math.PI * k); let d = Math.exp(lerp(Math.log(f.d), Math.log(T.d), k)) + fly.lift * arc;
  let ph = Math.max(0.2, lerp(f.p, T.p, k) - (fly.lift ? 0.28 * arc : 0)), az = f.a + fly.dA * k;
  if (fly.along) {          // on the way: the target walks the path, and halfway the view looks on along it, as a walker would
    const A = fly.along, w = Math.pow(arc, 0.7), s = lerp(A.s0, A.s1, k), tg = wayT(s).multiplyScalar(Math.sign(A.s1 - A.s0));
    t = wayP(s).add(A.off0.clone().lerp(A.off1, k).multiplyScalar(1 - w)).setY(lerp(f.t.y, T.t.y, k));
    let dd = Math.atan2(-tg.x, -tg.z) - az; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); az += dd * w * 0.8;
    d = lerp(d, Math.max(d, A.cruise), w); ph = lerp(ph, A.ph, w);
  }
  const s = new THREE.Spherical(d, ph, az);
  controls.target.copy(t); camera.position.copy(t).add(V3().setFromSpherical(s)); camera.lookAt(t);
  if (k >= 1) { const cb = fly.then; fly = null; controls.update(); if (cb) cb(); }
  return true;
}
// v6: a flight from stop to stop that keeps to the way, for any hop longer than a few steps
function flyAlong(v, dur, then, sTo) {
  const sFrom = nearestS(controls.target);
  flyTo(v, dur, then);
  if (sTo == null || REDUCED || inside || Math.abs(sTo - sFrom) < 14) return;
  fly.along = { s0: sFrom, s1: clamp(sTo, 0, WAY_LEN), off0: fly.from.t.clone().sub(wayP(sFrom)).setY(0), off1: fly.to.t.clone().sub(wayP(clamp(sTo, 0, WAY_LEN))).setY(0),
    cruise: clamp(Math.abs(sTo - sFrom) * 0.32, 24, 58), ph: 1.0 };
}
canvas.addEventListener('pointerdown', () => { if (fly) { if (fly.then) fly.dur = 1; else fly = null; } });
resize(); setView(HOME);

/* ---------- selection ---------- */
let current = null, selBox = null;
const isTemplePart = id => id && (id === 'TEMPLE' || id === 'FRAME' || id === 'CAP' || id === 'FLOOR_GRID' || /^RING_|^PETAL_/.test(id));
function boxFor(id) {
  const it = REG[id]; if (!it) return null;
  if (it.meshes && it.meshes.length) { const b = new THREE.Box3(); it.meshes.forEach(m => b.union(new THREE.Box3().setFromObject(m))); return b; }
  if (it.kind === 'ring' && ringBox[it.L]) return ringBox[it.L];
  if (it.kind === 'petal' && petalBox[id]) return petalBox[id];
  if (it.anchor) return boxFor(it.anchor);
  const o = objFor(id); if (o) { const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty()) return b; }
  return null;
}
function select(id, opts = {}) {
  const it = REG[id]; if (!it) return;
  if (story.on && !opts.story) stopStory(false);
  if (fire.on && !opts.fireside) leaveFireside(false);
  current = id; selBox = boxFor(id);
  if (id === 'CENTRE') selBox = new THREE.Box3(V3(-0.26, 0, -0.26), V3(0.26, 1.48, 0.26));
  if (id === 'TEMPLE' || id === 'FRAME') selBox = new THREE.Box3(V3(-6.2, 0, -6.2), V3(6.2, 6.3, 6.2));
  if (id === 'FLOOR_GRID') selBox = null;
  if (it.kind === 'quest') selBox = new THREE.Box3().setFromObject(PINS[id]);
  renderInspector(it);
  const sl = $('#selLabel'); sl.innerHTML = `${esc(it.title)} <small>${esc(it.chip || '')}</small>`; sl.hidden = false;
  if (it.kind === 'piece' && !opts.fireside) { openFireside(id); return; }
  if (it.kind === 'arch' && !opts.fireside) { openFireside(id, 'show'); return; }
  if (opts.fly !== false) {
    const want = it.inside === true ? 'temple' : (it.inside || null);
    if (want && !(inside && insideAt === want)) enterPlace(want, it.focus());
    else if (inside && !want) leavePlace(it.focus());
    else flyTo(it.focus());
  }
  $$('.row', $('#panel')).forEach(b => b.classList.toggle('sel', b.dataset.sel === id));
  const t = { quest: 'quests', gate: 'gates', event: 'events', crew: 'crews', role: 'roles' }[it.kind]; if (t && t !== tab) { tab = t; renderTabs(); }
}
function deselect(goHome = true) {
  current = null; selBox = null; $('#selLabel').hidden = true; $$('.brk').forEach(b => b.hidden = true);
  showWelcome(); if (goHome) { if (inside) leaveTemple(HOME); else flyTo(HOME, 1.4); }
  $$('.row', $('#panel')).forEach(b => b.classList.remove('sel'));
}

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null, lastHover = 0, hoverId = null;
function pickAt(x, y) {
  const r = canvas.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(PICKABLE, false);
  const shown = o => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };
  for (const h of hits) { let o = h.object; while (o && !o.userData.pick && !o.userData.pickAt) o = o.parent; if (o && shown(o)) return o.userData.pickAt ? o.userData.pickAt(h) : o.userData.pick; }
  return null;
}
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; canvas.classList.add('grab'); });
canvas.addEventListener('pointerup', e => {
  if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved > 6) return;
  closePops(); let id = pickAt(e.clientX, e.clientY);
  if (fire.on) { if (id && id.startsWith('CARD:')) { if (DKX.on && DKX.drawn !== id.slice(5)) drawCard(id.slice(5)); return; }
    if (id === 'CAMP_FIRE' || id === 'CAMP_DRIFT') { FX.flare = 1; toast('Someone puts another log on the fire.'); } return; }
  if (inside) { if (id) select(id, { fly: id === PLACE[insideAt].home }); return; }
  if (!id) { if (current) deselect(); return; }
  if (isTemplePart(id) && id !== 'TEMPLE') id = 'TEMPLE';
  if ((id === 'BENCH' || id === 'YARD_CNC') && !(current && /^(YARD|BENCH)/.test(current))) id = 'YARD';
  select(id);
});
canvas.addEventListener('pointermove', e => {
  const now = performance.now(); if (downAt || now - lastHover < 90) return; lastHover = now;
  let id = pickAt(e.clientX, e.clientY);
  if (id && !inside && isTemplePart(id) && id !== 'TEMPLE') id = 'TEMPLE';
  if (id && /^(BENCH|YARD_CNC)$/.test(id) && !(current && /^(YARD|BENCH)/.test(current))) id = 'YARD';
  hoverId = id; canvas.classList.toggle('point', !!id);
  const tip = $('#tip');
  if (id && REG[id] && id !== current) { tip.textContent = REG[id].title; tip.hidden = false; tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 34}px)`; } else tip.hidden = true;
});
canvas.addEventListener('pointerleave', () => { $('#tip').hidden = true; });

/* ---------- inspector ---------- */
const INS = $('#inspector');
const chip = (t, tone) => `<span class="chip ${tone}">${esc(t)}</span>`;
const kv = list => `<dl class="kv">${list.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const tile = (act, img, label, play) => `<button class="tile" data-act="${act}"><span class="im"><img src="${img}" alt="" loading="lazy">${play ? `<span class="play">${icon('play')}</span>` : ''}</span>${esc(label)}</button>`;
const links = list => `<div class="linklist">${list.map(([id, k, t]) => `<button data-sel="${id}"><span class="k">${esc(k)}</span>${esc(t)}${icon('right')}</button>`).join('')}</div>`;
const doorsHTML = () => [['camp', '1', 'var(--yellow)', 'Join the camp', 'Come to AfrikaBurn 2027 and build from the camp.'], ['build', '2', 'var(--cyan)', 'Join the build', 'Help build the temple without camping with us.'], ['back', '3', 'var(--magenta)', 'Support The Seed', 'The gates, from small to large, each with its gift.'], ['notnow', '4', '#d9cdb8', 'Not now', 'Share it with someone, or stay on the list for next year.']].map(([k, n, c, t, s]) => `<button class="door" data-door="${k}"><span class="n" style="background:${c}">${n}</span><span><b>${t}</b><small>${s}</small></span>${icon('right')}</button>`).join('');
const GLYPH = { deck: 'star', arch: 'star', welcome: 'gate', temple: 'dome', frame: 'timber', cap: 'star', grid: 'seed', ring: 'glass', petal: 'petal', camp: 'tent', kitchen: 'tent', lotus: 'petal', yard: 'tools', cnc: 'tools', bench: 'light', gate: 'gate', quest: 'pin', event: 'cal', crew: 'users', role: 'star', centre: 'torus', coil: 'torus', pendant: 'torus', pod: 'forms', drift: 'boat', portal: 'gate', verse: 'pen', book: 'book', fire: 'flame', piece: 'pen' };
function head(kind, eyebrow, title, sub) {
  return `<div class="insp-head"><span class="glyph">${icon(GLYPH[kind] || 'dome')}</span><div style="min-width:0"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="iconbtn x" data-act="close" aria-label="Back to the way">${icon('x')}</button></div>`;
}
function setInspector(html) { INS.classList.add('leave'); setTimeout(() => { INS.innerHTML = html; INS.hidden = false; requestAnimationFrame(() => INS.classList.remove('leave')); }, REDUCED ? 0 : 140); }
function renderInspector(it) {
  let h = '';
  const k = it.kind;
  if (k === 'temple') h = head(k, 'The art piece · AfrikaBurn 2027', 'The Seed', 'Quaggafontein, Tankwa Karoo') + `<div class="insp-body">
    <div class="tiles">${tile('film', 'assets/film_poster.jpg', 'Watch the 30 s film', true)}${tile('inside', 'assets/K5b.jpg', 'Step inside', true)}${tile('night', 'assets/K8d.jpg', 'See it at night')}</div>
    <p>A zome: a dome of coloured glass panels spiralling up, inspired by the king protea. By day the sun paints the floor and the people inside in fields of colour. At night a lantern inside throws a wheel of coloured rays across the desert floor.</p>
    ${links([['CENTRE', 'Inside', 'The centrepiece: a glass egg on a copper coil'], ['POD_VE', 'Around', 'The six copper forms']])}
    <div class="actions"><button class="btn primary" data-act="givegate">${icon('gift')}Help raise The Seed</button><button class="btn" data-act="join">${icon('gate')}Take part</button></div></div>`;
  if (k === 'frame') h = head(k, 'The temple · structure', 'The frame', 'Every timber cut to the exact zome geometry') + `<div class="insp-body"><div class="chips">${chip('Design final', 'done')}${chip('Engineer sign-off pending', 'now')}</div>
    <p>Pine timbers spiralling up from the ground. The top two rings stay open timber: a star of sky at the crown.</p>
    ${links([['CR-1', 'Crew', 'Frame crew'], ['Q-02', 'Q-02', 'Cut the crown star'], ['RO-2', 'Role', 'Rigger']])}</div>`;
  if (k === 'cap') h = head(k, 'The temple · crown', 'The finial cap', 'Above the open crown') + `<div class="insp-body"><p>Plywood rings and a gold-painted finial, standing over the open timber star at the top of the dome.</p>
    <div class="tiles">${tile('img:K6', 'assets/K6.jpg', 'The crown from inside')}${tile('img:K7a', 'assets/K7a.jpg', 'Sunset on the finial')}</div></div>`;
  if (k === 'grid') h = head(k, 'The temple · the ground', 'The Golden Seed of Life', 'Painted on the playa around the temple') + `<div class="insp-body"><p>Lines of colour on the cracked clay around the temple, in copper, sea teal, amber and pearl. The coloured light falls across them by day and at night.</p>
    <div class="tiles">${tile('img:K2b', 'assets/K2b.jpg', 'From above at dawn')}${tile('night', 'assets/K9b.jpg', 'The star at night')}</div>${links([['Q-03', 'Q-03', 'Paint the Golden Seed of Life']])}</div>`;
  if (k === 'ring') {
    const c = RING_INFO[it.L]; const tone = 'c-' + c; const b = ringBox[it.L];
    const pass = { yellow: 'red and green, so its light falls warm gold', cyan: 'green and blue, so its light falls teal', magenta: 'red and blue, so its light falls rose' }[c];
    h = head(k, `Glass · ring ${it.L} of the zome`, `Ring ${it.L}, ${c}`, 'Cast acrylic, one whole sheet per panel') + `<div class="insp-body"><div class="chips">${chip(c[0].toUpperCase() + c.slice(1), tone)}${chip('Funding open', 'open')}</div>
      <p>This ring lets through ${pass}.</p>
      <p>Where near and far panels overlap, the colours stack: yellow and cyan make green, cyan and magenta make violet blue, magenta and yellow make red.</p>
      ${links([['Q-01', 'Q-01', 'Fund a ring of glass'], ['CR-2', 'Crew', 'Glass crew']])}</div>`;
  }
  if (k === 'petal') {
    const way = it.id === 'PETAL_A01', beside = it.id === 'PETAL_B01' || it.id === 'PETAL_B06';
    if (way) h = head(k, 'Petal A01 · east', 'The way in', 'And the door to the online talks') + `<div class="insp-body"><div class="chips">${chip('East door', 'done')}${chip('Talks: dates to be announced', 'wait')}</div>
      <div class="tiles">${tile('img:K4m', 'assets/K4m.jpg', 'At the arch')}${tile('inside', 'assets/K5b.jpg', 'Step inside')}${tile('floorfilm', 'assets/K1b.jpg', 'A day on the floor', true)}</div>
      <p>Online, this arch is the door to the Seed of Hope talks: you walk in through it, and the call link appears for ticket holders.</p>
      ${links([['E-01', 'Event', 'Seed of Hope talks'], ['Q-07', 'Q-07', 'Share the film']])}</div>`;
    else h = head(k, `Petal ${it.row}0${it.num} · ${it.row === 'A' ? 'inner' : 'outer'} row`, `Petal ${it.row}0${it.num}`, beside ? 'Beside the way in, shaped around the arch' : `One of six in the ${it.row === 'A' ? 'inner' : 'outer'} row`) + `<div class="insp-body"><div class="chips">${chip('Fixed half open', 'done')}</div>
      <p>Petals of plywood fretwork wrap the base of the dome like the bracts of a king protea.</p>${links([['CR-3', 'Crew', 'Petal crew'], ['PETAL_A01', 'East', 'The way in']])}</div>`;
  }
  if (k === 'camp') h = head(k, 'Theme camp · AfrikaBurn 2027', 'Mahala camp', 'Home for the builders during the build and the burn') + `<div class="insp-body"><div class="chips">${chip('Door 1: join the camp', 'c-yellow')}${chip('Illustrative layout', 'wait')}</div>
    <p>You come in through the MAHALA portal. Inside: the Lotus Mahal with the big coil on its pole, Blissfull Drift with its fireside, the kitchen, the main tent and the bell tents. Camp members help build the temple.</p>
    <div class="tiles">${tile('img:photo_portal', 'assets/photo_portal.jpg', 'The portal')}${tile('img:photo_lotus_tent', 'assets/photo_lotus_tent.jpg', 'The Lotus Mahal')}${tile('img:photo_drift_night', 'assets/photo_drift_night.jpg', 'Blissfull Drift')}</div>
    ${kv(DATES.map(([k2, v2]) => [k2, esc(v2)]))}
    <div class="sect"><h4>The team: four circles</h4>${circlesHTML()}<p class="note">Your welcome call places you in one of them. The temple's build crews sit within Art and Gifting.</p></div>
    <div class="sect"><h4>The Sacred Agreements</h4>${sacredHTML()}<p class="note">With the TUNING sequence for conflict, from the camp's Harmonic Framework. And <a href="${esc(CONFIG.principles)}" target="_blank" rel="noopener">AfrikaBurn's guiding principles</a>.</p></div>
    ${links([['CAMP_TENT', 'Place', 'The main tent: playlists and sets'], ['CAMP_KITCHEN', 'Place', 'The camp kitchen: meal shifts'], ['CREWS', 'Crews', 'Join a crew'], ['CAMP_LOTUS', 'Place', 'The Lotus Mahal'], ['CAMP_DRIFT', 'Place', 'Blissfull Drift']])}
    <div class="actions"><button class="btn primary" data-act="join:camp">${icon('tent')}Apply to join the camp</button></div></div>`;
  if (k === 'kitchen') h = head(k, 'Mahala camp', 'The build kitchen', 'Feeds the crew through build week') + `<div class="insp-body"><p>The heart of the camp, and the home of the theatrical dinner.</p>${links([['Q-05', 'Q-05', 'Host the build kitchen'], ['E-03', 'Event', 'Theatrical dinner']])}</div>`;
  if (k === 'lotus') h = head(k, 'Mahala camp', 'The Lotus Mahal', "The camp's temple tent. A mahal is a palace, or a gathering place") + `<div class="insp-body">
    <div class="chips">${chip('Three bells', 'c-cyan')}${chip('You can step inside', 'open')}</div>
    <div class="tiles two">${tile('img:photo_lotus_tent', 'assets/photo_lotus_tent.jpg', 'At the camp')}${tile('img:photo_coil_pole', 'assets/photo_coil_pole.jpg', 'The big coil on its pole')}</div>
    <p>Three bell tents joined around a taller centre, with six petals to each bell pegged out like a lotus. The door faces the temple. On the centre pole, at heart height, sits the big copper coil.</p>
    <div class="actions"><button class="btn primary" data-act="mahal">${icon('gate')}Step inside</button></div>
    ${links([['MAHAL_COIL', 'Temple Tech', 'The big coil'], ['E-04', 'Event', 'Gatherings in the Lotus Mahal'], ['RO-7', 'Role', 'Event host']])}
    <div class="snd"><a href="${esc(CONFIG.album)}" target="_blank" rel="noopener noreferrer"><span class="snd-ic">${icon('sound')}</span><span class="snd-t"><b>Sunrise at the Mahal</b><small>By Gustav Loubser · spotify.com</small></span>${icon('right')}</a></div></div>`;
  if (k === 'drift') h = head(k, 'Mahala camp', 'Blissfull Drift', 'The camp boat, from the years the camp was called State of Bliss') + `<div class="insp-body"><div class="chips">${chip('Camp structure', 'done')}${chip('Fireside inside', 'c-yellow')}</div>
    <div class="tiles">${tile('img:photo_drift_day', 'assets/photo_drift_day.jpg', 'By day')}${tile('img:photo_drift_sunset', 'assets/photo_drift_sunset.jpg', 'At sunset')}${tile('img:photo_drift_night', 'assets/photo_drift_night.jpg', 'At night')}</div>
    <p>A wooden boat on a sea of dust: a curled prow with a crescent moon, a ship's wheel, white posts and a rope rail, and bunting and fairy lights strung from the bow to the mast. The hull is open. Inside it, tiers of seats step down like a small amphitheatre to a fire pit shaped like a king protea.</p>
    <div class="actions"><button class="btn primary" data-act="fire">${icon('flame')}Sit by the fire</button><button class="btn" data-act="story:2">${icon('book')}Its chapter in the story</button></div>
    ${links([['CAMP_FIRE', 'Fireside', 'Poems and camp stories'], ['CAMP_LOTUS', 'Place', 'The Lotus Mahal'], ['CAMP', 'Camp', 'Mahala camp']])}</div>`;
  if (k === 'fire') h = head(k, 'Blissfull Drift · the fireside', 'The fireside', 'Poems and camp stories, around the protea fire') + `<div class="insp-body"><div class="chips">${chip(FIRESIDE.length + ' pieces', 'c-yellow')}${chip('Best after dark', 'wait')}</div>
    <p>In the hull of the boat, tiers of seats step down to a steel fire pit shaped like a king protea. Sit by the fire and read the poems and stories camp mates have written.</p>
    <div class="actions"><button class="btn primary" data-act="fire">${icon('flame')}Sit by the fire</button><button class="btn" data-act="fire:random">Let the fire choose</button><button class="btn" data-act="fire:deck">Draw a card</button></div>
    <div class="linklist">${FIRESIDE.map(p => `<button data-fire="${p.id}"><span class="k">${p.kind}</span>${esc(p.title)}${icon('right')}</button>`).join('')}</div>
    <p class="note">Written by Mahala camp mates and shared for the Mahalaverse.</p></div>`;
  if (k === 'book') h = head(k, 'The start of the way', 'The Book of Mahala', 'The camp\'s own book, on a carved plinth') + `<div class="insp-body"><div class="chips">${chip((BOOK.pages.length - 1) + ' pages', 'c-yellow')}${chip('11 archetypes', 'c-magenta')}</div>
    <button class="bk-cover" data-act="book">${BOOK.pages[0] ? `<img src="${BOOK.pages[0].src}" alt="">` : ''}<span>${icon('book')}Open the book</span></button>
    <p>The red leather book with brass corners that lives at the camp, on a carved plinth with a candle and a quill. Inside: the story of Mahala, from the crash at Nowhere's End to the temple builders, then the camp's values and the eleven archetypes, each with its card, its gift and its shadow.</p>
    <div class="actions"><button class="btn" data-act="fire:deck">${icon('flame')}Draw an archetype card</button><button class="btn" data-sel="DECK">The deck beside the book</button></div>
    ${BOOK.chapters.length ? `<div class="linklist">${BOOK.chapters.filter(c => !c.sub).map(c => `<button data-book="${c.page}"><span class="k">p. ${c.page}</span>${esc(c.title)}${icon('right')}</button>`).join('')}</div>` : ''}
    <p class="note">Pages set from the printed book. Tap Read the words inside to read any page in plain text.</p></div>`;
  if (k === 'portal') h = head(k, 'Mahala camp', 'The MAHALA portal', 'The way into the camp') + `<div class="insp-body">
    <div class="tiles two">${tile('img:photo_portal', 'assets/photo_portal.jpg', 'The portal, lit')}</div>
    <p>A timber gate with the lotus and MAHALA on an onion-shaped sign, lit from behind at night, a planked door beside it, and a spiral of thick rope on the ground, with lanterns, to walk in along.</p>
    <div class="actions"><button class="btn primary" data-act="join:camp">${icon('tent')}Apply to join the camp</button><button class="btn" data-act="story:1">${icon('book')}The call</button></div></div>`;
  if (k === 'pod' || k === 'centre' || k === 'coil' || k === 'pendant') { const sp = SPOT[it.id];
    const extra = k === 'pod' ? links([[PODS_INFO[it.key].opp, 'Faces it', PODS_INFO[PODS_INFO[it.key].opp.slice(4)].name], ['CENTRE', 'Inside', 'The centrepiece']])
      : k === 'centre' ? links([['MAHAL_COIL', 'Same winding', 'The big coil at the camp'], ['COIL_140', 'Same winding', 'The 140 mm coil'], ['PENDANT', 'Same winding', 'The pendants'], ['POD_VE', 'Around', 'The six copper forms']])
      : k === 'coil' ? (it.id === 'COIL_140' ? links([['MAHAL_COIL', 'Bigger', 'The big coil'], ['PENDANT', 'Smaller', 'The pendants'], ['GATE_4', 'Gate 4', 'The zome: a big coil']]) : links([['COIL_140', 'Smaller', 'The 140 mm coil'], ['PENDANT', 'Smallest', 'The pendants'], ['CENTRE', 'In the temple', 'The centrepiece'], ['GATE_4', 'Gate 4', 'The zome: a big coil']]))
      : links([['GATE_2', 'Gate 2', 'The Lotus Mahal: a pendant'], ['COIL_140', 'Bigger', 'The 140 mm coil'], ['BENCH', 'Made at', 'The Temple Tech bench']]);
    const pics = (sp.render ? [sp.render] : []).concat(sp.photos || []);
    const photos = pics.length ? `<div class="tiles${pics.length === 3 ? '' : ' two'}">${pics.map(([f, l]) => tile('img:' + f, `assets/${f}.jpg`, l)).join('')}</div>` : '';
    h = head(k, sp.eye, sp.title, k === 'pod' ? `${PODS_INFO[it.key].element} · ${PODS_INFO[it.key].faces}` : '') + `<div class="insp-body"><div class="chips">${sp.chips.map(([t, tone]) => chip(t, tone)).join('')}</div>
      ${photos}<p>${sp.what}</p>
      <div class="actions"><button class="btn primary" data-act="spot:${it.id}">${icon('spot')}Spotlight</button>${k === 'centre' ? (inside && insideAt === 'temple' ? `<button class="btn" data-act="leave">${icon('gate')}Leave the temple</button>` : `<button class="btn" data-act="enter">${icon('gate')}Step inside</button>`) : it.id === 'MAHAL_COIL' ? (inside && insideAt === 'mahal' ? `<button class="btn" data-act="leave">${icon('gate')}Leave the Mahal</button>` : `<button class="btn" data-act="mahal">${icon('gate')}Step into the Mahal</button>`) : ''}</div>
      ${extra}
      <p class="note">Temple Tech pieces are art and research in copper, geometry and craft. They make no medical claims.</p></div>`; }
  if (k === 'verse') { const p = FIRE_BY[it.v.piece];
    h = head(k, 'A verse from the camp', p.title, it.v.where) + `<div class="insp-body"><div class="chips">${chip(p.kind, 'c-yellow')}${p.when ? chip(p.when, 'wait') : ''}</div>
    <div class="verse">${it.v.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div><p class="note">The opening of ${esc(p.title)}, by a Mahala camp mate.</p>
    <div class="actions"><button class="btn primary" data-fire="${p.id}">${icon('flame')}Read it by the fire</button><button class="btn" data-act="story:${it.v.ch - 1}">${icon('book')}Its chapter in the story</button></div></div>`; }
  if (k === 'yard') h = head(k, 'Fabrication', 'The build yard', 'Where the frame is cut and the glass is prepared') + `<div class="insp-body"><div class="chips">${chip('Fabricate: next', 'open')}${chip('Illustrative layout', 'wait')}</div>
    <p>The frame is cut to the zome's geometry and the glass is prepared here, by volunteers with hand tools, a cutting service and a skilled workshop.</p>
    <div class="actions"><button class="btn primary" data-sel="GUIDE">${icon('book')}The build guideline</button><button class="btn" data-act="buildfilm">${icon('film')}Watch the build</button></div>
    <p>The Temple Tech bench makes the gifts for the gates: copper coil pendants, bigger coils and light boxes.</p>
    ${links([['Q-02', 'Q-02', 'Cut the crown star'], ['Q-06', 'Q-06', 'Make the first light box'], ['BENCH', 'Place', 'The Temple Tech bench'], ['YARD_CNC', 'Place', 'The CNC cutting table']])}</div>`;
  if (k === 'cnc') h = head(k, 'The build yard', 'The CNC cutting table', 'Cutting the timbers and the gifts') + `<div class="insp-body"><p>The timbers are cut here to the exact zome geometry, and the CNC-cut art pieces for the patrons come off here too.</p>${links([['Q-02', 'Q-02', 'Cut the crown star'], ['GATE_4', 'Gate 4', 'The zome: a CNC-cut art piece']])}</div>`;
  if (k === 'bench') h = head(k, 'The build yard', 'The Temple Tech bench', 'Gifts that are also research') + `<div class="insp-body"><div class="chips">${chip('Research and development', 'c-cyan')}</div>
    <p>Temple Tech, an art and research practice, works with light, coils and sacred geometry, and makes the thank-you gifts at its bench in the yard. Copper coil pendants, bigger coils and light boxes are the gifts for the gates, and each gift is also research and development: the first batch is funded by the gates, then refined so the pieces can be made again later.</p>
    ${links([['PENDANT', 'Spotlight', 'The pendants'], ['COIL_140', 'Spotlight', 'The 140 mm coil'], ['MAHAL_COIL', 'Spotlight', 'The big coil'], ['GATE_2', 'Gate 2', 'A pendant'], ['GATE_4', 'Gate 4', 'A big coil, an art piece or a light box'], ['Q-06', 'Q-06', 'Make the first light box']])}</div>`;
  if (k === 'gate') { const g = it.g;
    h = head(k, g.n < 6 ? `Gate ${g.n} of 5 · back the vision` : 'Beyond the gates', g.name, g.n < 6 ? 'A gateway on the way to The Seed' : 'Choose your own amount') + `<div class="insp-body">
      <div class="amount"><b>${esc(g.amount)}</b>${chip('Working figure', 'wait')}</div>
      ${kv([['Gift', esc(g.gift)], ['What it builds', esc(g.builds)]])}
      ${g.rd ? `<p>This gift is also research and development: your gift funds the first batch of light boxes and Seed of Life pieces.</p>` : ''}
      ${g.n === 2 ? `<div class="linklist"><button data-act="spot:PENDANT"><span class="k">Spotlight</span>See the pendant${icon('right')}</button></div>` : ''}${g.n === 3 ? `<div class="linklist"><button data-act="spot:COIL_140"><span class="k">Spotlight</span>See the 140 mm coil${icon('right')}</button><button data-act="spot:MAHAL_COIL"><span class="k">Spotlight</span>See the big coil at the camp${icon('right')}</button></div>` : ''}
      <div class="actions"><button class="btn primary" data-act="gate:${g.n}">${icon('gift')}Choose this gate</button>${g.n > 1 ? `<button class="btn" data-sel="GATE_${g.n - 1}">Gate ${g.n - 1}</button>` : ''}${g.n < 6 ? `<button class="btn" data-sel="GATE_${g.n + 1}">${g.n < 5 ? 'Gate ' + (g.n + 1) : 'Any amount'}</button>` : ''}</div>
      <p class="note">Amounts are working figures and may change. No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.</p></div>`; }
  if (k === 'quest') { const q = it.q;
    h = head(k, `${q.id} · quest`, q.name, `${q.crew} · ${q.stage}`) + `<div class="insp-body"><div class="chips">${chip('Open', 'open')}${chip(q.stage, 'c-' + { y: 'yellow', c: 'cyan', m: 'magenta' }[q.tone])}</div>
      <p>${esc(q.goal)}</p><ol class="steps-ol">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${kv([['Crew', esc(q.crew)], ['Skills', esc(q.skills)], ['Where', esc(REG[q.where].title)]])}
      <div class="actions"><button class="btn primary" data-act="take:${q.id}">${icon('check')}Take this quest</button><button class="btn" data-sel="${q.where}">Go to ${esc(REG[q.where].title.replace(/^The /, 'the '))}</button></div></div>`; }
  if (k === 'event') { const e = it.e;
    h = head(k, 'Event · fundraising', e.name, esc(e.format)) + `<div class="insp-body"><div class="chips">${chip(e.date, 'wait')}</div><p>${esc(e.text)}</p>
      ${kv([['Format', esc(e.format)], ['Tickets', esc(e.ticket)], ['Date', esc(e.date)], ...(e.speaker ? [['Speaker', esc(e.speaker)]] : [])])}
      <div class="actions"><button class="btn" data-act="notify:${e.id}">${icon('bell')}Tell me when it is set</button><button class="btn" data-sel="${e.where}">Go there</button></div></div>`; }
  if (k === 'crew') { const c = it.c;
    h = head(k, 'Crew', c.name, esc(c.what)) + `<div class="insp-body"><div class="chips">${chip('Forming', 'now')}</div><p>Crews form around one part of the temple. Ask through Join the build and choose what you can bring.</p>
      ${links(DATA.quests.filter(q => q.crew === c.name).map(q => [q.id, q.id, q.name]).concat(DATA.roles.filter(r => r.crew.includes(c.name.split(' ')[0])).map(r => [r.id, 'Role', r.name])))}
      <div class="actions"><button class="btn primary" data-act="join:build">${icon('users')}Join this crew</button></div></div>`; }
  if (k === 'deck') h = head(k, 'Beside the book · the way in', 'The Mahala Archetype Deck', 'Eleven cards from the Book of Mahala') + `<div class="insp-body"><div class="chips">${chip('11 cards', 'c-magenta')}${chip('Drawn at the fire', 'c-yellow')}</div>
    <button class="bk-cover dk-cover" data-act="fire:deck"><img src="assets/deck/back.jpg" alt=""><span>${icon('flame')}Draw a card at the fire</span></button>
    <p>The camp's archetypes: the forces that dance among the people who join the mission, each with a gift, a question and a shadow. Take the deck down to the fire in Blissfull Drift, where the cards rise in a ring over the flames. Choose one, read it, pass it round the circle, or keep it as your archetype for the visit.</p>
    <div class="linklist">${ARCH.map(a => `<button data-fire="${a.id}"><span class="k">Card</span>${esc(a.title)}${icon('right')}</button>`).join('')}</div>
    <p class="note">The cards as they are printed in the Book of Mahala.</p></div>`;
  if (k === 'role') { const r = it.r;
    h = head(k, 'Role', r.name, esc(r.crew)) + `<div class="insp-body"><div class="chips">${chip('Open', 'open')}</div><p>This role is open. Tell us what you can bring through Join the build.</p>${kv([['Crew', esc(r.crew)], ['Where', esc(REG[r.where].title)]])}
      <div class="actions"><button class="btn primary" data-act="join:build">${icon('star')}Offer to take this role</button></div></div>`; }
  setInspector(v4Card(it, h));
}
INS.addEventListener('click', e => {
  const s = e.target.closest('[data-sel]'); if (s) { select(s.dataset.sel); return; }
  const d = e.target.closest('[data-door]'); if (d) { openJoin(d.dataset.door); return; }
  const fp = e.target.closest('[data-fire]'); if (fp) { openFireside(fp.dataset.fire); return; }
  const bp = e.target.closest('[data-book]'); if (bp) { openBook(+bp.dataset.book); return; }
  const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
  if (v4Act(act, a)) return;
  if (act === 'mahal') { select('MAHAL_COIL'); return; }
  if (act === 'fire') { openFireside(); return; }
  if (act === 'fire:random') { openFireside('random'); return; }
  if (act === 'fire:deck') { openFireside('deck'); return; }
  if (act === 'book') { openBook(0); return; }
  if (act === 'close') { deselect(); INS.classList.add('leave'); setTimeout(() => { if (!current) INS.hidden = true; }, 200); return; }
  if (act === 'film') openFilm('assets/mahala_30s.mp4', 'Mahala, 30 seconds. Concept visualisation: rendered from the 3D model, with motion added by AI.', true);
  if (act === 'inside' || act === 'enter') select('CENTRE');
  if (act === 'leave') leaveTemple();
  if (act === 'floorfilm') openFilm('assets/floor_day.mp4', 'A day on the floor, 09:00 to 16:30: sunlight through the acrylic paints the floor.', false, true);
  if (act.startsWith('spot:')) openSpot(act.slice(5));
  if (act === 'story') startStory(0);
  if (act.startsWith('story:')) startStory(+act.slice(6));
  if (act === 'night') seeNight();
  if (act.startsWith('img:')) openImage(act.slice(4));
  if (act === 'join') openJoin();
  if (act.startsWith('join:')) openJoin(act.slice(5));
  if (act.startsWith('gate:')) openJoin('back', +act.slice(5));
  if (act.startsWith('take:')) { const q = DATA.quests.find(x => x.id === act.slice(5)); toast(`Added to your quests: ${q.name}`); a.disabled = true; a.innerHTML = icon('check') + 'On your list'; }
  if (act.startsWith('notify:')) { toast('Noted. In the shared Mahalaverse you would hear first.'); a.disabled = true; }
});

/* ---------- the sun paints the floor: each glass panel cast along the sun onto the ground ---------- */
const LM = { cv: document.createElement('canvas'), tris: { yellow: [], cyan: [], magenta: [] }, last: 0, dirty: true, ready: false };
LM.cv.width = LM.cv.height = 1024; const lmx = LM.cv.getContext('2d');
const lmTex = new THREE.CanvasTexture(LM.cv); lmTex.colorSpace = THREE.SRGBColorSpace;
const lmPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: lmTex, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
lmPlane.position.y = 0.035; lmPlane.renderOrder = 2; lmPlane.visible = false; scene.add(lmPlane);
function collectGlass() {
  const a = V3(), b = V3(), c = V3(), n = V3(), e1 = V3(), e2 = V3();
  for (const L of 'CDEFGHIJ') { const T = LM.tris[RING_INFO[L]];
    for (const m of REG['RING_' + L].meshes || []) { m.updateMatrixWorld(true); const pos = m.geometry.attributes.position, idx = m.geometry.index; const cnt = idx ? idx.count : pos.count; const tr = m.userData.triRank;
      for (let i = 0; i < cnt; i += 3) { const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); if (n.lengthSq() < 1e-8) continue; n.normalize();
        T.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, n.x, n.y, n.z, tr ? tr[i / 3] : 0); } } }
  LM.ready = true; LM.dirty = true;
}
function drawLightMap() {
  const sd = sunDir; if (!LM.ready || sd.y < 0.035) { lmPlane.visible = false; return; }
  const k = 1024 / 60, dx = sd.x / sd.y, dz = sd.z / sd.y;
  lmx.globalCompositeOperation = 'source-over'; lmx.globalAlpha = 1; lmx.fillStyle = '#ffffff'; lmx.fillRect(0, 0, 1024, 1024);
  lmx.globalCompositeOperation = 'multiply'; const strength = 0.66 * smooth(0.035, 0.22, sd.y);
  for (const [col, rgb] of [['yellow', '#ffd628'], ['cyan', '#1ea6ff'], ['magenta', '#ee3c98']]) {
    const T = LM.tris[col]; lmx.fillStyle = rgb; lmx.globalAlpha = strength; lmx.beginPath();
    for (let i = 0; i < T.length; i += 13) { if (T[i + 9] * sd.x + T[i + 10] * sd.y + T[i + 11] * sd.z <= 0) continue; if (LIT.mode.value && T[i + 12] >= LIT.count.value) continue;
      for (let v = 0; v < 3; v++) { const x = T[i + v * 3], y = T[i + v * 3 + 1], z = T[i + v * 3 + 2]; const X = (x - y * dx + 30) * k, Y = (z - y * dz + 30) * k; if (v) lmx.lineTo(X, Y); else lmx.moveTo(X, Y); } lmx.closePath(); }
    lmx.fill();
  }
  lmTex.needsUpdate = true; lmPlane.visible = true;
}

/* ---------- time of day ---------- */
function sunPos(mins) {
  const LAT = -32.65, LON = 20.05, TZ = 2, R = Math.PI / 180;
  const utcMin = mins - TZ * 60; const jd = Date.UTC(2027, 3, 29) / 86400000 + 2440587.5 + utcMin / 1440;
  const t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360, m = 357.52911 + t * (35999.05029 - 0.0001537 * t), e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = m * R, c = Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  const omega = 125.04 - 1934.136 * t, lam = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * R);
  const eps = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * R);
  const decl = Math.asin(Math.sin(eps * R) * Math.sin(lam * R));
  const y = Math.tan(eps * R / 2) ** 2, l0r = l0 * R;
  const eqt = 4 / R * (y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr));
  const tst = (((utcMin + eqt + 4 * LON) % 1440) + 1440) % 1440, ha = (tst / 4 - 180) * R, la = LAT * R;
  const cz = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const el = 90 - Math.acos(clamp(cz, -1, 1)) / R;
  const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) / R + 180 + 360) % 360;
  return { az, el };
}
const C = (h) => new THREE.Color(h);
const SKY = { dayTop: C(0x86aed6), dayHor: C(0xf1e6d6), goldTop: C(0x6f8cb6), goldHor: C(0xf4bd8a), nightTop: C(0x050916), nightHor: C(0x1b2240), dusk: C(0x3b3a63) };
let clock = 9 * 60 + 40;
const prefersDark = (document.documentElement.dataset.theme === 'dark') || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
if (prefersDark) clock = 19 * 60 + 25;
let nightK = 0, sunDir = V3(0, 1, 0);
function applyTime(mins) {
  const { az, el } = sunPos(mins); const R = Math.PI / 180;
  sunDir.set(Math.sin(az * R) * Math.cos(el * R), Math.sin(el * R), -Math.cos(az * R) * Math.cos(el * R));
  const day = smooth(-5, 8, el), high = smooth(4, 28, el), night = 1 - smooth(-11, -3, el), gold = smooth(-5, 1, el) * (1 - smooth(3, 18, el));
  nightK = night;
  sun.intensity = 3.3 * smooth(-1.5, 6, el); sun.color.copy(C(0xff9550)).lerp(C(0xfff3e2), smooth(1, 26, el)); sun.castShadow = el > -1.5;
  hemi.color.copy(SKY.nightTop).lerp(C(0x3c4878), 0.7).lerp(C(0xf0b48a), gold * 0.5).lerp(C(0xcfdcea), high);
  hemi.groundColor.copy(C(0x15151d)).lerp(C(0xe6d4bf), day);
  hemi.intensity = 0.55 + 0.45 * day + 0.25 * night;
  const top = SKY.nightTop.clone().lerp(SKY.dusk, smooth(-14, -4, el) * 0.6).lerp(SKY.goldTop, day).lerp(SKY.dayTop, high);
  const hor = SKY.nightHor.clone().lerp(C(0x8a6a7a), smooth(-12, -4, el) * 0.7).lerp(SKY.goldHor, day).lerp(SKY.dayHor, high);
  skyU.top.value.copy(top); skyU.hor.value.copy(hor); skyU.sunDir.value.copy(sunDir); skyU.glow.value = 0.4 + gold * 1.6; skyU.sunCol.value.copy(sun.color).multiplyScalar(day);
  scene.fog.color.copy(hor);
  groundMat.color.copy(C(0x2a2c3a)).lerp(C(0xeac9a6), day).lerp(C(0xd8c09b), high);
  stars.material.opacity = night * 0.9;
  renderer.toneMappingExposure = 1.0 + 0.2 * night - 0.07 * high;
  for (const g of Object.values(GLASS)) { g.emissiveIntensity = 0.1 + 1.55 * night; g.opacity = 0.58 + 0.22 * night; }
  for (const l of Object.values(LAMP)) l.emissiveIntensity = 0.3 + 2.6 * night;
  ENV.forEach(m => { if (!m.userData.envBase) m.userData.envBase = m.envMapIntensity; m.envMapIntensity = m.userData.envBase * (0.25 + 0.75 * day); });
  lantern.intensity = 260 * night; campLight.intensity = 70 * night; yardLight.intensity = 45 * night; mahalLight.intensity = 16 * night; M2.pole.emissiveIntensity = 0.45 * night; FX.night = night;
  M2.tent.emissiveIntensity = 0.55 * night; M2.tent2.emissiveIntensity = 0.4 * night; if (ZONES.CAMP_PORTAL) ZONES.CAMP_PORTAL.userData.signMat.emissiveIntensity = 0.05 + 1.8 * night;
  starDecal.material.opacity = night * litFrac();
  PLAQUE_MAT.emissiveIntensity = 0.9 * night; LM.dirty = true; updateLanterns(night);
  GLOWS.forEach(s => { s.material.opacity = night * s.userData.k * (s.userData.lit ?? 1); s.visible = s.material.opacity > 0.004; });   // unlit glows cost nothing by day
  document.body.classList.toggle('sky-night', night > 0.5); document.body.classList.toggle('sky-day', night <= 0.5);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(Math.floor(mins % 60)).padStart(2, '0');
  $('#clockT').textContent = `${hh}:${mm}`; $('#clock').value = Math.round(mins);
  $('#sunGlyph').innerHTML = `<use href="#i-${el > -2 ? 'sun' : 'moon'}"/>`;
}
let playing = false;
$('#clock').addEventListener('input', e => { clock = +e.target.value; applyTime(clock); });
$('#playBtn').addEventListener('click', () => { playing = !playing; $('#playBtn').innerHTML = icon(playing ? 'pause' : 'play'); $('#playBtn').setAttribute('aria-label', playing ? 'Pause the day' : 'Play one day'); });
$('#sunIcon').addEventListener('click', () => $('#sunctl').classList.toggle('open'));
function seeNight() { clock = 20 * 60 + 15; applyTime(clock); flyTo({ t: V3(0, 0, 0), d: 92, p: 0.42, a: 0.62 }, 1.8); toast('20:15 on 29 April 2027: the lantern is lit.'); }
applyTime(clock);

/* ---------- film and image lightbox ---------- */
const FM = $('#filmModal'), FV = $('#filmVideo');
let lastFocus = null;
function openFilm(src, cap, endDoors, loop = false) {
  lastFocus = document.activeElement; $('#filmEnd').hidden = true; $('#filmDoors').innerHTML = doorsHTML(); if (src !== CONFIG.buildFilm) FV.removeAttribute('poster');
  const old = $('.film img', FM); if (old) old.remove(); FV.hidden = false;
  FV.src = src; FV.loop = loop; FV.muted = loop; FV.controls = !loop; FV.dataset.end = endDoors ? '1' : '';
  $('#filmCap').textContent = cap; FM.hidden = false; FV.play().catch(() => {}); $('#filmClose').focus();
}
function openImage(key) {
  lastFocus = document.activeElement; $('#filmEnd').hidden = true; FV.pause(); FV.removeAttribute('src'); FV.hidden = true;
  let im = $('.film img', FM); if (!im) { im = document.createElement('img'); im.style.cssText = 'display:block;width:100%;height:auto;max-height:calc(100vh - 140px);object-fit:contain;background:#000'; $('.film', FM).prepend(im); }
  const PHOTO = { photo_drift_day: 'Blissfull Drift, the camp boat, by day.', photo_drift_sunset: 'Blissfull Drift at sunset.', photo_drift_night: 'Blissfull Drift lit up at night.', photo_lotus_tent: 'The Lotus Mahal at the camp.', photo_portal: 'The MAHALA portal, the way into the camp, lit at night.', photo_coil_pole: 'The big coil going onto the central pole.', photo_coil_figure: 'The big coil on a carved figure.' };
  const RENDER = { render_coil_big: 'The big coil on the centre pole of the Lotus Mahal, about 40 cm across.', render_coil_140: 'The 140 mm coil: two windings crossing on a grooved ring.', render_pendant: 'A pendant, about 35 mm across, on a braided cord.' };
  im.src = `assets/${key}.jpg`; im.alt = RENDER[key] || PHOTO[key] || 'A render of the temple';
  $('#filmCap').textContent = RENDER[key] ? RENDER[key] + ' Rendered from the 3D model of the grooved ring.' : PHOTO[key] ? PHOTO[key] + ' Photo from the camp.' : { K6: 'The crown, looking straight up from inside.', K7a: 'Sunset: the sun on the tip of the finial.', K2b: 'From above at dawn, 34 m up.', K4m: 'At the ogee arch of the way in.', K1b: 'First light through the open crown.' }[key] + ' Rendered from the 3D model.';
  FM.hidden = false; $('#filmClose').focus();
}
FV.addEventListener('ended', () => { if (FV.dataset.end) $('#filmEnd').hidden = false; });
function closeFilm() { FV.pause(); FM.hidden = true; if (lastFocus) lastFocus.focus(); }
$('#filmClose').addEventListener('click', closeFilm);
FM.addEventListener('click', e => { if (e.target === FM) closeFilm(); const d = e.target.closest('[data-door]'); if (d) { closeFilm(); openJoin(d.dataset.door); } });

/* ---------- take part: four doors, one short path after each, and an ending made for each door ---------- */
// The doors and paths follow the camp's Temple Builder Journey outline (v1.1, 10 Oct 2026): the practical layer stays plain,
// the role is decided on the welcome call, and every door can add a donation. Hand-offs go to the camp's own pages in CONFIG.
const JM = $('#joinModal');
const JF = { door: null, step: 0, gate: null, f: { name: '', based: '', heard: '' }, skills: new Set(), when: new Set(), agree: new Set(), contact: '', consent: false, show: false, out: null,
  camp: null, rate: null, parts: 1, maybe: { change: '', by: '', call: null }, nextYear: false };
const SKILLS = ['Build', 'Fabricate', 'Light', 'Cook', 'Art', 'Story', 'Care', 'Host an event'];
const SACRED = [['S', 'Seek understanding before interpretation'], ['A', 'Assume resonant intent'], ['C', 'Choose presence over reaction'], ['R', 'Radical responsibility as restoration'], ['E', 'Empowered expression of needs'], ['D', 'Discern gossip as distortion']];
const CIRCLES = ['Finance', 'Communitas', 'Operations', 'Art and Gifting'];
const DATES = [['The burn', 'Monday 26 April to Sunday 2 May 2027'], ['Setup arrival', 'Thursday 22 or Friday 23 April, being confirmed'], ['Breakdown', 'Sunday 2 and Monday 3 May'], ['The Great Unpack', 'Tuesday 4 May, in Cape Town']];
const WHEN_OPTS = ['Setup, from 22 or 23 April', 'The burn, 26 April to 2 May', 'Breakdown, 2 and 3 May', 'The Great Unpack, 4 May in Cape Town'];
const DOOR_T = { camp: 'Join the camp', build: 'Join the build', back: 'Support The Seed', notnow: 'Not now' };
const HANDOFF = {
  campPay: ['The camp fee page', 'The camp fee page is being set up. A camp mate will send your link.'],
  call: ['Welcome call booking', 'Welcome call booking is being set up. A camp mate will be in touch to find a time.'],
  home: ['Your member home', 'Your member home is being set up. Your personal link will come by email.'],
  donate: ['The donation page', 'The donation page is being set up: the camp is choosing who runs payments.'],
};
function handoff(key) {
  if (key === 'donate') { openJoin('back'); return; }   // v7 copy: the gates take gifts now
  const url = CONFIG[key], [name, wait] = HANDOFF[key];
  if (url) { try { window.open(url, '_blank', 'noopener'); } catch (e) { } toast(`${name} opened in a new tab.`); } else toast(wait);
}
const sacredHTML = () => `<ol class="sacred">${SACRED.map(([l, t]) => `<li><b>${l}</b><span>${t}</span></li>`).join('')}</ol>`;
const datesHTML = () => kv(DATES.map(([k, v]) => [k, esc(v)]));
const circlesHTML = () => `<div class="chips">${CIRCLES.map(c => chip(c, 'wait')).join('')}</div>`;
function openJoin(door = null, gate = null, jump = null) {
  lastFocus = document.activeElement; JF.door = door; JF.gate = gate ?? (door === 'back' ? Math.min(7, ME.gate + 1) : null); JF.out = null;
  JF.f.name = JF.f.name || ME.name || ''; JF.contact = JF.contact || ME.contact || ''; JF.consent = JF.consent || !!ME.consent; JF.show = JF.show || !!ME.show;
  JF.step = door ? 1 : 0; if (jump === 'touch' && door) { if (door === 'camp' && !JF.camp) JF.camp = 'yes'; JF.step = Math.max(1, flowSteps().indexOf('Stay in touch')); }
  JM.hidden = false; renderJoin();
}
function closeJoin() { JM.hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
function flowSteps() {
  if (JF.door === 'back') return ['Your door', 'Choose a gate', 'Stay in touch'];
  if (JF.door === 'notnow') return ['Your door', 'Not now'];
  if (JF.door === 'camp') return JF.camp === 'maybe' ? ['Your door', 'Yes or maybe', 'Who you are', 'Three questions', 'Stay in touch'] : ['Your door', 'Yes or maybe', 'Who you are', 'Your camp place', 'When', 'Agreements', 'Stay in touch'];
  return ['Your door', 'Who you are', 'What you bring', 'When', 'Agreements', 'Stay in touch'];
}
const liveNote = () => LIVE.uid && LIVE.write !== false ? 'Only the camp\'s stewards can read your contact details. They copy them into the camp\'s members board.' : CONFIG.form ? 'This page cannot reach the shared Mahalaverse from here, so the camp\'s sign-up form opens next.' : 'This page cannot reach the shared Mahalaverse from here: what you send is kept in this browser only.';
const pickOne = (name, opts, cur) => `<div class="pick">${opts.map(([v, t]) => `<button data-one="${name}" data-v="${esc(String(v))}" aria-pressed="${String(cur) === String(v)}">${esc(t)}</button>`).join('')}</div>`;
function renderJoin() {
  const B = $('#joinBody'), F = $('#joinFoot'), steps = flowSteps(), done = JF.step >= steps.length, name = steps[JF.step];
  $('#joinPgs').innerHTML = done ? '' : steps.map((s, i) => `<i class="${i <= JF.step ? 'on' : ''}" title="${s}"></i>`).join('');
  $('#joinTitle').textContent = done ? (JF.door === 'notnow' || JF.door === 'back' || JF.camp === 'maybe' ? 'Thank you' : 'Welcome, temple builder') : DOOR_T[JF.door] || 'Take part';
  const next = (label = 'Continue', dis = false) => `<button class="btn" data-j="back">Back</button><button class="btn primary" data-j="next" ${dis ? 'disabled' : ''}>${label}</button>`;
  if (JF.step === 0) { B.innerHTML = `<p>There are four ways in. Choose the one that fits you now; you can always come back for another. Every door also has a way to give to The Seed.</p><div class="doors">${doorsHTML()}</div>`; F.innerHTML = `<span class="note">${esc(liveNote())}</span>`; return; }
  if (done) { renderEnding(B, F); return; }
  if (name === 'Yes or maybe') {
    B.innerHTML = `<p>Are you ready to join the camp for AfrikaBurn 2027?</p>
      <div class="gatepick"><label><input type="radio" name="campyes" value="yes" ${JF.camp === 'yes' ? 'checked' : ''}><span><b>Yes, I am in</b><small>Choose your rate and instalments, then book your welcome call.</small></span></label>
      <label><input type="radio" name="campyes" value="maybe" ${JF.camp === 'maybe' ? 'checked' : ''}><span><b>Maybe, I am not sure yet</b><small>Three short questions, then a camp mate follows up.</small></span></label></div>`;
    F.innerHTML = next('Continue', !JF.camp); return;
  }
  if (name === 'Choose a gate') {
    const up = DATA.gates.slice();
    if (!up.length) { B.innerHTML = `<p class="spine">Every gate is open for you. Thank you for carrying the temple this far.</p>`; F.innerHTML = `<button class="btn" data-j="back">Back</button><button class="btn primary" data-j="path">Your path</button>`; return; }
    if (!up.some(g => g.n === JF.gate)) JF.gate = up[0].n;
    B.innerHTML = `<p>The gates, from small to large. Each one comes with a gift, and every gift helps raise The Seed.</p>${budgetBar()}${payCur7()}<div class="gatepick">${up.map(g => `<label><input type="radio" name="gate" value="${g.n}" ${JF.gate === g.n ? 'checked' : ''}><span><b>Gate ${g.n}, ${esc(g.name.replace(/^The /, 'the '))}</b><small>Our thank-you: ${esc(g.gift)}.</small></span><span class="amt">${esc(g.amount)}</span></label>`).join('')}</div>`;
    F.innerHTML = `<span class="note">Working amounts, not final. ${payNote7('list')}</span>` + next('Continue'); return;
  }
  if (name === 'Who you are') {
    B.innerHTML = `<div class="field"><label for="jf-name">Your name or playa name</label><input id="jf-name" value="${esc(JF.f.name)}" autocomplete="off" maxlength="40"></div>
      <div class="field"><label for="jf-based">Where you are based</label><input id="jf-based" value="${esc(JF.f.based)}" autocomplete="off" maxlength="60"></div>
      <div class="field"><label for="jf-heard">How you found Mahala</label><select id="jf-heard">${['', 'I was nominated', 'Through a friend', 'The film', 'At AfrikaBurn', 'Somewhere else'].map(o => `<option ${JF.f.heard === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      ${JF.door === 'camp' && JF.camp === 'yes' ? `<div class="field"><label>What you love to do (optional)</label><div class="pick">${SKILLS.map(s => `<button data-skill="${s}" aria-pressed="${JF.skills.has(s)}">${s}</button>`).join('')}</div><small class="note">A hint for your welcome call. Your role in the team is decided on the call, not in a form.</small></div>` : ''}`;
    F.innerHTML = next(); return;
  }
  if (name === 'Your camp place') {
    B.innerHTML = `<p>Your camp fee is your camp place. It includes a small copper coil on a necklace.</p>
      <div class="field"><label>Your rate</label>${pickOne('rate', [['local', 'Local rate: I live in South Africa'], ['abroad', 'Abroad rate: I am coming from outside South Africa']], JF.rate)}</div>
      <div class="field"><label>Pay in</label>${pickOne('parts', [[1, 'One payment'], [2, 'Two instalments'], [4, 'Four instalments']], JF.parts)}</div>
      <p class="note">The camp is confirming both rates. Instalments are fixed in advance. You can add the big coil or a donation for the art piece on top.</p>`;
    F.innerHTML = next('Continue', !JF.rate); return;
  }
  if (name === 'What you bring') { B.innerHTML = `<p>What can you bring? Choose as many as you like.</p><div class="pick">${SKILLS.map(s => `<button data-skill="${s}" aria-pressed="${JF.skills.has(s)}">${s}</button>`).join('')}</div><p class="note">The build-only path is still being shaped: what you commit to, and whether there is a cost.</p>`; F.innerHTML = next(); return; }
  if (name === 'When') {
    const opts = JF.door === 'camp' ? WHEN_OPTS : [...WHEN_OPTS, 'From home'];
    B.innerHTML = `<p>When can you come? Choose all that apply.</p><div class="pick">${opts.map(s => `<button data-when="${s}" aria-pressed="${JF.when.has(s)}">${s}</button>`).join('')}</div>${datesHTML()}`;
    F.innerHTML = next(); return;
  }
  if (name === 'Agreements') {
    B.innerHTML = `<p>The Sacred Agreements: six ways the camp holds itself together.</p>${sacredHTML()}
      <p class="note">With them comes the TUNING sequence, the camp's way through conflict. From the camp's Harmonic Framework.${CONFIG.principles ? ` We also live by <a href="${esc(CONFIG.principles)}" target="_blank" rel="noopener">AfrikaBurn's guiding principles</a>.` : ''}</p>
      <label class="check" for="jf-sacred"><input type="checkbox" id="jf-sacred" data-agree="sacred" ${JF.agree.has('sacred') ? 'checked' : ''}><span><b>I have read the Sacred Agreements and AfrikaBurn's guiding principles</b><small>And I will leave no trace.</small></span></label>`;
    F.innerHTML = next('Continue', !JF.agree.has('sacred')); return;
  }
  if (name === 'Three questions') {
    B.innerHTML = `<div class="field"><label for="jf-change">What would change your decision?</label><textarea id="jf-change" maxlength="600">${esc(JF.maybe.change)}</textarea></div>
      <div class="field"><label>By when will you know?</label>${pickOne('by', [['week', 'In a week'], ['month', 'In a month'], ['year', 'By the end of the year'], ['unsure', 'Not sure yet']], JF.maybe.by)}</div>
      <div class="field"><label>Would you like a call?</label>${pickOne('call', [['yes', 'Yes, please'], ['no', 'Not yet']], JF.maybe.call)}</div>`;
    F.innerHTML = next(); return;
  }
  if (name === 'Not now') {
    B.innerHTML = `<p class="spine">Thank you for coming this far. The temple will be here.</p>
      <p>Two small ways to help, if you like.</p>
      <div class="actions"><button class="btn" data-j="sharegift">${icon('share')}Share the temple with someone who might want to help</button></div>
      <label class="check" for="jf-nextyear"><input type="checkbox" id="jf-nextyear" ${JF.nextYear ? 'checked' : ''}><span><b>Keep me on the list for next year</b><small>Leave a way to reach you below.</small></span></label>
      <div class="field" ${JF.nextYear ? '' : 'hidden'} id="jf-nyfield"><label for="jf-contact">Email or phone</label><input id="jf-contact" value="${esc(JF.contact)}" autocomplete="email" maxlength="80" inputmode="email"><small class="note">${esc(liveNote())}</small></div>`;
    F.innerHTML = next('Done'); return;
  }
  if (name === 'Stay in touch') {
    const need = JF.camp === 'maybe' ? 'A camp mate follows up, so leave a way to reach you.' : 'How should the camp reach you? Leave it empty if you would rather not be contacted.';
    B.innerHTML = `<p>${need}</p>
      ${JF.door === 'back' ? `<div class="field"><label for="jf-name">Your name or playa name</label><input id="jf-name" value="${esc(JF.f.name)}" autocomplete="off" maxlength="40"></div>` : ''}
      <div class="field"><label for="jf-contact">Email or phone</label><input id="jf-contact" value="${esc(JF.contact)}" autocomplete="email" maxlength="80" inputmode="email"></div>
      <label class="check" for="jf-consent"><input type="checkbox" id="jf-consent" ${JF.consent ? 'checked' : ''}><span><b>Yes, the camp may contact me about Mahala</b><small>About your door, the gates, the build and the dates. Ask to be removed at any time.</small></span></label>
      ${JF.camp === 'maybe' ? '' : `<label class="check" for="jf-show"><input type="checkbox" id="jf-show" ${JF.show ? 'checked' : ''}><span><b>Show my name on the temple</b><small>Off by default. Other builders see it beside your light.</small></span></label>`}
      <p class="note">${esc(liveNote())}</p>`;
    F.innerHTML = next(JF.door === 'camp' ? (JF.camp === 'maybe' ? 'Send my answers' : 'Send, then book my call') : { build: 'Join the build', back: 'Continue to the gate' }[JF.door]); return;
  }
}
function finishJoin() {
  const was = !!ME.door, out = { door: JF.door, camp: JF.camp };
  if (JF.f.name) ME.name = JF.f.name.slice(0, 40);
  if (JF.contact && JF.consent) { ME.consent = true; ME.contact = JF.contact.slice(0, 80); }
  const joined = JF.door === 'build' || JF.door === 'back' || (JF.door === 'camp' && JF.camp === 'yes');
  if (joined) { ME.door = JF.door; ME.show = JF.show; }
  if (JF.door === 'camp' && JF.camp === 'maybe') ME.maybe = true;
  if (JF.door === 'notnow') ME.notNow = true;
  if (JF.door === 'camp' && JF.camp === 'yes' && JF.when.size) ME.week = [...JF.when];
  if (JF.door === 'build') {
    const sk = [...JF.skills].find(s => SKILL_CREW[s]), byCard = DKX.kept && ARCH_CREW[DKX.kept];
    const crew = CREW_BY(sk ? SKILL_CREW[sk] : byCard ? byCard[0] : 'CR-1');
    const q = (byCard && byCard[0] === crew.id && byCard[1] && DATA.quests.find(z => z.id === byCard[1])) || DATA.quests.find(z => z.crew === crew.name);
    ME.crew = crew.id; ME.crewOk = canEnter('crews'); out.crew = crew; out.quest = q; out.why = sk ? `your skill, ${sk.toLowerCase()}` : byCard ? `your card, ${ARCH_BY[DKX.kept].title}` : 'the frame, where most hands are needed';
  }
  if (JF.door === 'back') out.gate = GATE_BY(JF.gate);
  JF.out = out; saveMe(); pushMe();
  const keep = JF.door !== 'notnow' || (JF.nextYear && JF.contact && JF.consent);
  if (keep) {
    const row = { door: JF.door, camp: JF.door === 'camp' ? JF.camp || null : null, name: ME.name, based: JF.f.based, heard: JF.f.heard, contact: JF.consent ? JF.contact.slice(0, 80) : '', consent: !!(JF.consent && JF.contact),
      skills: JF.door === 'build' ? [...JF.skills] : [], when: JF.door === 'camp' || JF.door === 'build' ? [...JF.when] : [], rate: JF.door === 'camp' ? JF.rate : null, parts: JF.door === 'camp' && JF.camp === 'yes' ? JF.parts : null, gate: JF.door === 'back' ? JF.gate || null : null, crew: ME.crew || null, from: ME.from || null,
      change: JF.camp === 'maybe' ? JF.maybe.change.slice(0, 600) : '', by: JF.camp === 'maybe' ? JF.maybe.by : '', call: JF.camp === 'maybe' ? JF.maybe.call : null, nextYear: JF.door === 'notnow' };
    // one document per person, one entry per door they came through, so a later door never blurs an earlier one
    const doc = { ['d_' + JF.door]: Object.assign({ at: Date.now() }, row), name: ME.name || '' }; if (row.contact) { doc.contact = row.contact; doc.consent = true; }
    pushSignup(doc).then(ok => { if (!ok && CONFIG.form && row.contact) { try { window.open(CONFIG.form, '_blank', 'noopener'); } catch (e) { } } });
  }
  if (joined) { store.set('mahala_badge', '1'); markBadge(); refreshLight(); }
  onPathChange();
  if (joined && !was) { chime('bell'); buzz([20, 40, 20]); }
}
function renderEnding(B, F) {
  const o = JF.out || { door: JF.door }, nm = ME.name ? ', ' + esc(ME.name) : '';
  const sent = LIVE.uid && LIVE.write !== false ? 'is with the stewards' : 'is kept in this browser. In the shared Mahalaverse it reaches the stewards';
  const donate = `<button class="btn" data-j="handoff:donate">${icon('gift')}Give to The Seed</button>`;
  const gateRow = n => { const g = GATE_BY(n); return `<div class="lockrow">${icon('gift')}<span><b>Gate ${n}: ${esc(g.name.replace(/^The /, 'the '))} · ${esc(g.amount)}</b><small>Our thank-you: ${esc(g.gift)}.</small></span></div><div class="actions"><button class="btn primary" data-j="give:${n}">${icon('gift')}Give ${esc(g.amount.split(' to ')[0])}</button></div>`; };
  const badge = `<div class="badge">${BADGE_SVG}<span class="eyebrow">A gift for you</span><h4>On the way</h4></div>`;
  let body = '';
  if (o.door === 'camp' && o.camp === 'maybe') body = `<p class="spine">Thank you${nm}. Take the time you need.</p>
      <p>${ME.contact ? `A camp mate will follow up${JF.maybe.call === 'yes' ? ' to find a time for a call' : ''}. Your answers ${LIVE.uid && LIVE.write !== false ? 'are with the stewards' : 'are kept in this browser. In the shared Mahalaverse they reach the stewards'}.` : 'You did not leave a way to reach you, so nobody can follow up yet. Come back to this door whenever you are ready.'}</p>
      <div class="actions">${donate}<button class="btn" data-j="sharegift">${icon('share')}Share the temple</button></div>`;
  else if (o.door === 'camp') body = `${badge}<p>Thank you${nm}. Your camp place ${sent}.</p>
      <div class="sect"><h4>Your next three steps</h4><div class="linklist">
        <button data-j="handoff:campPay"><span class="k">1</span>Pay your camp fee${JF.parts > 1 ? `, in ${JF.parts} instalments` : ''}${icon('right')}</button>
        <button data-j="handoff:call"><span class="k">2</span>Book your welcome call${icon('right')}</button>
        <button data-j="handoff:home"><span class="k">3</span>Open your member home: the checklist, the documents and the dates${icon('right')}</button></div></div>
      <div class="sect"><h4>Where you fit</h4><p>Your welcome call places you in the team, in one of the camp's four circles.</p>${circlesHTML()}</div>
      <div class="actions">${donate}</div>`;
  else if (o.door === 'build') body = `${badge}<p>Thank you${nm}. You asked to join the <b>${esc(o.crew.name)}</b>, chosen from ${esc(o.why)}. ${ME.crewOk ? 'You are on the crew now.' : 'A steward accepts you, then the crew\'s quests open to you.'}${isBuildCrew(o.crew.id) ? ' When a steward welcomes you onto the crew, your crew\'s builder gift comes with it.' : ''}</p>
      <div class="sect"><h4>Your crew and a first quest</h4>${links([[o.crew.id, 'Crew', o.crew.name], ...(o.quest ? [[o.quest.id, o.quest.id, o.quest.name]] : [])])}</div>
      ${ME.crewOk ? '' : `<div class="actions"><button class="btn testbtn" data-j="crewok">${icon('unlock')}Camp lead testing: accept me onto the crew</button></div>`}
      <p class="note">The crew is drawn from what you told us, not assigned for good. The build-only path is still being shaped with the stewards.</p><div class="actions">${donate}</div>`;
  else if (o.door === 'back') { const g = o.gate; body = `${badge}<p>Thank you${nm}. You chose Gate ${g.n}, ${esc(g.name.replace(/^The /, 'the '))}.</p>${gateRow(g.n)}
      ${g.builds ? `<p>Your gift builds ${esc(g.builds.charAt(0).toLowerCase() + g.builds.slice(1))}.</p>` : ''}
      <p class="note strong">Working amounts, not final. No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.</p>
      <div class="actions"><button class="btn" data-j="sharegift">${icon('share')}Share the temple with someone</button>${donate}</div>`; }
  else if (o.door === 'notnow') body = `<p class="spine">Thank you. The temple will be here.</p><p>${JF.nextYear && ME.contact ? 'You are on the list for next year.' : 'Come back through any door, whenever the time is right.'}</p>`;
  B.innerHTML = body;
  F.innerHTML = `${o.door === 'notnow' || o.camp === 'maybe' ? '' : `<button class="btn" data-j="path">${icon('path')}Your path</button>`}<button class="btn primary" data-j="close">Back to the playa</button>`;
}
function shareGift() { shareText('Help raise The Seed', 'Help raise The Seed, a temple of coloured glass for AfrikaBurn 2027. Seven gates, from small to large, each with its gift.', 'door=support'); }
JM.addEventListener('input', e => { const t = e.target; if (t.id === 'jf-name') JF.f.name = t.value; if (t.id === 'jf-based') JF.f.based = t.value; if (t.id === 'jf-heard') JF.f.heard = t.value; if (t.id === 'jf-contact') JF.contact = t.value.trim(); if (t.id === 'jf-change') JF.maybe.change = t.value; });
JM.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'gate') { JF.gate = +t.value; }
  if (t.name === 'campyes') { JF.camp = t.value; $('[data-j="next"]', JM).disabled = false; $('#joinPgs').innerHTML = flowSteps().map((s, i) => `<i class="${i <= JF.step ? 'on' : ''}" title="${s}"></i>`).join(''); }
  if (t.dataset.agree) { t.checked ? JF.agree.add(t.dataset.agree) : JF.agree.delete(t.dataset.agree); $('[data-j="next"]', JM).disabled = !JF.agree.has('sacred'); }
  if (t.id === 'jf-heard') JF.f.heard = t.value;
  if (t.id === 'jf-consent') JF.consent = t.checked;
  if (t.id === 'jf-show') JF.show = t.checked;
  if (t.id === 'jf-nextyear') { JF.nextYear = t.checked; JF.consent = t.checked; $('#jf-nyfield').hidden = !t.checked; if (t.checked) setTimeout(() => $('#jf-contact').focus(), 30); }
});
JM.addEventListener('click', e => {
  if (e.target === JM) { closeJoin(); return; }
  const d = e.target.closest('[data-door]'); if (d) { JF.door = d.dataset.door; JF.camp = null; JF.gate = JF.door === 'back' ? Math.min(7, ME.gate + 1) : null; JF.step = 1; renderJoin(); return; }
  const sk = e.target.closest('[data-skill]'); if (sk) { const s = sk.dataset.skill; JF.skills.has(s) ? JF.skills.delete(s) : JF.skills.add(s); sk.setAttribute('aria-pressed', JF.skills.has(s)); return; }
  const w = e.target.closest('[data-when]'); if (w) { const s = w.dataset.when; JF.when.has(s) ? JF.when.delete(s) : JF.when.add(s); w.setAttribute('aria-pressed', JF.when.has(s)); return; }
  const one = e.target.closest('[data-one]'); if (one) { const k = one.dataset.one, v = one.dataset.v;
    if (k === 'rate') JF.rate = v; if (k === 'parts') JF.parts = +v; if (k === 'by') JF.maybe.by = v; if (k === 'call') JF.maybe.call = v;
    $$(`[data-one="${k}"]`, JM).forEach(b => b.setAttribute('aria-pressed', String(b === one))); if (k === 'rate') $('[data-j="next"]', JM).disabled = false; return; }
  const sel = e.target.closest('[data-sel]'); if (sel) { closeJoin(); select(sel.dataset.sel); return; }
  const j = e.target.closest('[data-j]'); if (!j) return; const [k, x] = j.dataset.j.split(':');
  if (k === 'close') closeJoin();
  if (k === 'path') { closeJoin(); openPath(); }
  if (k === 'back') { JF.step = JF.step <= 1 ? 0 : JF.step - 1; if (JF.step === 0) { JF.door = null; JF.camp = null; } renderJoin(); }
  if (k === 'next') {
    const steps = flowSteps(), cur = steps[JF.step];
    if (cur === 'Stay in touch' || cur === 'Not now') {
      const need = cur === 'Stay in touch' || JF.nextYear;
      if (need && JF.contact && !JF.consent) { toast('Tick the box so the camp may contact you, or leave the contact empty.'); return; }
      if (need && JF.contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$|^[+\d][\d\s()-]{6,}$/.test(JF.contact)) { toast('That does not look like an email address or a phone number.'); return; }
      if (cur === 'Not now' && JF.nextYear && !JF.contact) { toast('Leave an email or phone number to stay on the list, or untick the box.'); return; }
      JF.step++; finishJoin(); renderJoin(); return;
    }
    JF.step++; renderJoin();
  }
  if (k === 'give') give(+x);
  if (k === 'test') { testOpen(+x, () => renderJoin()); }
  if (k === 'goto') { closeJoin(); goGate(+x); }
  if (k === 'handoff') { handoff(x); if (x === 'call') markDone(3, 'call'); }
  if (k === 'crewok') { ME.crewOk = true; saveMe(); pushMe(); toast(`You are on the ${CREW_BY(ME.crew).name} now (testing).`); renderKpis(); onPathChange(); renderJoin(); }
  if (k === 'share') shareInvite();
  if (k === 'sharegift') shareGift();
});
$('#joinClose').addEventListener('click', closeJoin);
$('#takePart').addEventListener('click', () => openJoin());
function markBadge() { if (HOOK7.who) { try { HOOK7.who(); return; } catch (e) { console.warn(e); } }   /* v7 me: your figure in the top bar */  if (store.get('mahala_badge') !== '1' && !ME.door) return; $('#whoName').textContent = ME.name || 'A builder'; $('#whoRole').textContent = `Gate ${ME.gate} · ${myBadges().length} badge${myBadges().length === 1 ? '' : 's'}`; $('#avatarTxt').innerHTML = icon('star'); }

markBadge();

/* ---------- search ---------- */
const INDEX = Object.values(REG).map(it => ({ id: it.id, label: it.title, sub: { temple: 'The art piece', frame: 'Temple', cap: 'Temple', grid: 'Temple', ring: 'Glass ring', petal: 'Petal', camp: 'Place', kitchen: 'Camp', lotus: 'Camp', yard: 'Place', cnc: 'Build yard', bench: 'Build yard', gate: 'Gate · ' + (it.g ? it.g.amount : ''), quest: 'Quest · ' + (it.q ? it.q.crew : ''), event: 'Event', crew: 'Crew', role: 'Role', centre: 'Temple Tech', coil: 'Temple Tech', pendant: 'Temple Tech', pod: 'Copper form', drift: 'Camp', portal: 'Camp', verse: 'Story', book: 'At the way in', deck: 'At the way in', arch: 'Archetype card', fire: 'Camp', piece: 'Fireside · ' + (it.p ? it.p.kind : '') }[it.kind], key: it.id.startsWith('Q-') || it.id.startsWith('E-') ? it.id : '' }));
let hits = [], hi = 0;
const Q = $('#q'), RES = $('#results');
function runSearch() {
  const s = Q.value.trim().toLowerCase(); if (!s) { RES.hidden = true; return; }
  hits = INDEX.filter(x => (x.label + ' ' + x.sub + ' ' + x.id).toLowerCase().includes(s)).slice(0, 8); hi = 0;
  RES.innerHTML = hits.length ? hits.map((x, i) => `<button role="option" aria-selected="${i === hi}" data-id="${x.id}"><span class="k">${esc(x.key)}</span><span>${esc(x.label)}<small>${esc(x.sub)}</small></span></button>`).join('') : `<button disabled><span class="k"></span><span>Nothing called that yet<small>Try temple, glass, camp, gate or quest</small></span></button>`;
  RES.hidden = false;
}
Q.addEventListener('input', runSearch);
Q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length); $$('button', RES).forEach((b, i) => b.setAttribute('aria-selected', i === hi)); }
  if (e.key === 'Enter' && hits[hi]) { select(hits[hi].id); Q.value = ''; RES.hidden = true; Q.blur(); $('#search').classList.remove('open'); }
  if (e.key === 'Escape') { Q.value = ''; RES.hidden = true; Q.blur(); $('#search').classList.remove('open'); }
});
RES.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; select(b.dataset.id); Q.value = ''; RES.hidden = true; $('#search').classList.remove('open'); });
$('#search label').addEventListener('click', () => { $('#search').classList.add('open'); setTimeout(() => Q.focus(), 0); });
Q.addEventListener('blur', () => setTimeout(() => { RES.hidden = true; if (!Q.value) $('#search').classList.remove('open'); }, 150));

/* ---------- top bar menus, map controls, keys ---------- */
const SM = $('#siteMenu');
SM.innerHTML = [['TEMPLE', 'TS', 'The Seed', 'The art piece, at the end of the way'], ['CAMP', 'MC', 'Mahala camp', 'Halfway along the way, about 100 m from The Seed'], ['YARD', 'BY', 'Build yard', 'Beside the way, the last stop before The Seed'], ['GATE_1', 'GT', 'The gates', 'Seven gateways, from the portal to The Seed']].map(([id, k, t, s]) => `<button data-sel="${id}"><span class="site"><span class="sq" style="width:26px;height:26px">${k}</span></span><span><b style="font-weight:500">${t}</b><small style="display:block;color:var(--ink-3);font-size:12px">${s}</small></span></button>`).join('');
function closePops() { SM.hidden = true; $('#bellPop').hidden = true; $('#siteBtn').setAttribute('aria-expanded', 'false'); $('#bellBtn').setAttribute('aria-expanded', 'false'); }
$('#siteBtn').addEventListener('click', e => { e.stopPropagation(); const r = $('#siteBtn').getBoundingClientRect(); SM.style.left = r.left + 'px'; const open = SM.hidden; closePops(); SM.hidden = !open; $('#siteBtn').setAttribute('aria-expanded', String(open)); });
SM.addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) { closePops(); select(b.dataset.sel); } });
$('#bellBtn').addEventListener('click', e => { e.stopPropagation(); const open = $('#bellPop').hidden; closePops(); $('#bellPop').hidden = !open; $('#bellBtn').setAttribute('aria-expanded', String(open)); $('.dot', $('#bellBtn')).style.display = 'none'; });
document.addEventListener('click', e => { if (!e.target.closest('#siteMenu,#siteBtn,#bellPop,#bellBtn')) closePops(); });
$('#brandBtn').addEventListener('click', () => deselect());
$('.mapctl').addEventListener('click', e => {
  const b = e.target.closest('[data-map]'); if (!b) return; const m = b.dataset.map;
  const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if (m === 'home') { deselect(); return; }
  if (m === 'in') flyTo({ t: controls.target.clone(), d: Math.max(controls.minDistance, s.radius * 0.68) }, 0.6);
  if (m === 'out') flyTo({ t: controls.target.clone(), d: Math.min(controls.maxDistance, s.radius * 1.45) }, 0.6);
  if (m === 'rl' || m === 'rr') flyTo({ t: controls.target.clone(), a: s.theta + (m === 'rl' ? -1 : 1) * Math.PI / 4 }, 0.8);
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== Q && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').classList.add('open'); Q.focus(); }
  if (!$('#bookModal').hidden) { if (e.key === 'ArrowRight') turn(1); if (e.key === 'ArrowLeft') turn(-1); if (e.key === 'Escape') closeBook(); return; }
  if (fire.on && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { if (e.key === 'Escape') { leaveFireside(); return; } if (fire.piece && e.key === 'ArrowRight') { const p = FIRE_BY[fire.piece]; if (fire.page < p.stanzas.length - 1) readPiece(fire.piece, fire.page + 1); return; } if (fire.piece && e.key === 'ArrowLeft' && fire.page > 0) { readPiece(fire.piece, fire.page - 1); return; } }
  if (e.key === 'Escape') { if (!$('#spotModal').hidden) closeSpot(); else if (!FM.hidden) closeFilm(); else if (!JM.hidden) closeJoin(); else if (story.on) stopStory(); else if (inside) { leavePlace(); showWelcome(); } else if (current) deselect(); }
  if (story.on && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { if (e.key === 'ArrowRight') $('#stNext').click(); else $('#stBack').click(); }
});

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hide'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hide'), 3200); }

renderTabs();

/* ---------- inside: the temple and the Lotus Mahal ---------- */
const SAVED = {};
const PLACE = {
  temple: { home: 'CENTRE', leave: 'Leave the temple', lim: [0.6, 3.6],
    approach: () => ({ t: V3(4.6, 1.15, 0), d: 10, p: 1.52, a: Math.PI / 2 }), out: () => ({ t: V3(5.2, 1.2, 0), d: 10, p: 1.5, a: Math.PI / 2 }), after: () => REG.TEMPLE.focus(),
    bar: [['centre', 'torus', 'The centrepiece'], ['up', 'up', 'Look up'], ['light', 'sun', 'Watch the light move']] },
  mahal: { home: 'MAHAL_COIL', leave: 'Leave the Mahal', lim: [0.6, 3.4],
    approach: () => ({ t: MAHAL_DOOR.clone().setY(0.95), d: 9, p: 1.52, a: Math.atan2(MAHAL_OUT.x, MAHAL_OUT.z) }),
    out: () => ({ t: MAHAL_DOOR.clone().addScaledVector(MAHAL_OUT, 0.8).setY(0.95), d: 8, p: 1.5, a: Math.atan2(MAHAL_OUT.x, MAHAL_OUT.z) }), after: () => REG.CAMP_LOTUS.focus(),
    bar: [['coil', 'torus', 'The big coil'], ['peaks', 'up', 'Look up'], ['lanterns', 'moon', 'Light the lanterns']] },
};
const IN_VIEWS = { centre: () => REG.CENTRE.focus(), up: () => ({ t: V3(0, 4.4, 0), d: 3.1, p: 2.2 }), light: () => ({ t: V3(0, 0.5, 0), d: 3.4, p: 0.78, a: 2.9 }),
  peaks: () => ({ t: V3(CAMP.x, 3.5, CAMP.z), d: 3.2, p: 2.62, a: Math.atan2(MAHAL_OUT.x, MAHAL_OUT.z) }) };
function renderInsideBar() { const P = PLACE[insideAt]; if (!P) return; $('#insideBar').setAttribute('aria-label', insideAt === 'mahal' ? 'Inside the Lotus Mahal' : 'Inside the temple');
  $('#insideBar').innerHTML = P.bar.map(([k, ic, t]) => `<button class="btn" data-in="${k}">${icon(ic)}${t}</button>`).join('') + `<button class="btn primary" data-in="leave">${icon('gate')}${P.leave}</button>`; }
function setInsideControls(on, lim = [0.6, 3.6]) {
  if (on) { Object.assign(SAVED, { min: controls.minDistance, max: controls.maxDistance, pmin: controls.minPolarAngle, pmax: controls.maxPolarAngle, pan: controls.enablePan });
    controls.minDistance = lim[0]; controls.maxDistance = lim[1]; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 2.35; controls.enablePan = false; }
  else { controls.minDistance = SAVED.min ?? 10; controls.maxDistance = SAVED.max ?? 360; controls.minPolarAngle = SAVED.pmin ?? 0.18; controls.maxPolarAngle = SAVED.pmax ?? 1.36; controls.enablePan = SAVED.pan ?? true; }
}
function enterPlace(where, view, then) {
  const P = PLACE[where], key = where === 'temple' ? 'zome' : 'mahal';
  if (!story.on && !canEnter(key)) { showGate(SPACE[key].gate, () => enterPlace(where, view, then)); return; }
  if (!story.on) markDone(key === 'zome' ? 4 : 2, key === 'zome' ? 'zome' : 'enter');
  if (inside && insideAt === where) { flyTo(view || REG[P.home].focus(), 1.4, then); return; }
  if (inside) { leavePlace(P.approach(), () => enterPlace(where, view, then)); return; }
  camera.near = 0.05; camera.updateProjectionMatrix(); $('#tip').hidden = true;
  // walk in through the door: the temple's ogee arch from the east, the Mahal's door from the side that faces the temple
  flyTo(P.approach(), 1.3, () => {
    inside = true; insideAt = where; document.body.classList.add('inside'); setInsideControls(true, P.lim); renderInsideBar();
    if (!story.on) $('#insideBar').hidden = false;
    flyTo(view || REG[P.home].focus(), 2.0, () => { if (!story.on) { if (current !== P.home) select(P.home, { fly: false }); else renderInspector(REG[P.home]); } if (then) then(); });
  });
}
function leavePlace(view, then) {
  if (!inside) { if (view) flyTo(view, 1.4, then); return; }
  const P = PLACE[insideAt]; inside = false; insideAt = null; document.body.classList.remove('inside'); $('#insideBar').hidden = true; setInsideControls(false); clockAnim = null;
  const done = () => { camera.near = 0.5; camera.updateProjectionMatrix(); if (then) then(); };
  if (!view || view === REG.TEMPLE.focus) flyTo(P.out(), 1.3, () => flyTo(P.after(), 1.4, done));
  else flyTo(P.out(), 1.0, () => flyTo(view, 1.6, done));
  if (current === P.home && !story.on) renderInspector(REG[P.home]);
}
function enterTemple(view, then) { enterPlace('temple', view, then); }
function leaveTemple(view, then) { leavePlace(view, then); }
function enterMahal(view, then) { enterPlace('mahal', view, then); }
$('#insideBar').addEventListener('click', e => {
  const b = e.target.closest('[data-in]'); if (!b) return; const k = b.dataset.in;
  if (k === 'leave') { leavePlace(); if (!current) showWelcome(); return; }
  if (k === 'centre') { select('CENTRE'); return; }
  if (k === 'coil') { select('MAHAL_COIL'); return; }
  if (k === 'up') { flyTo(IN_VIEWS.up(), 1.6); toast('The open timber star at the crown, and the glass around it.'); return; }
  if (k === 'peaks') { flyTo(IN_VIEWS.peaks(), 1.6); toast('The centre pole and the three bells, from the floor of the Mahal.'); return; }
  if (k === 'lanterns') { playing = false; clockAnim = { from: clock, to: 20 * 60 + 30, t0: performance.now(), dur: 2600 }; toast('Evening: the lanterns are lit and the canvas glows.'); return; }
  if (k === 'light') { flyTo(IN_VIEWS.light(), 1.4); playing = false; clockAnim = { from: 9 * 60, to: 16 * 60 + 30, t0: performance.now() + 900, dur: 15000 }; toast('29 April 2027, 09:00 to 16:30: the sun moves the colours across the floor.'); }
});

/* ---------- the fireside: poems and camp stories, read in the hull of Blissfull Drift ---------- */
const FI = { el: $('#fire'), body: $('#fiBody'), foot: $('#fiFoot'), title: $('#fiTitle'), eye: $('#fiEye') };
function openFireside(pieceId = null, how = null) {
  if (!canEnter('fire')) { showGate(1, () => openFireside(pieceId, how)); return; }
  markDone(1, 'sit'); if (pieceId === 'deck') markDone(1, 'draw');
  closePops(); if (!$('#spotModal').hidden) closeSpot(); if (!$('#bookModal').hidden) closeBook(); if (story.on) stopStory(false); playing = false;
  const atPlinth = fire.where === 'plinth', VIEW = atPlinth ? PLINTH_VIEW : FIRE_VIEW;
  if (!atPlinth) wayAt('drift');
  DKX.c = atPlinth ? DECK_RING : FIRE_AT; DKX.R = atPlinth ? 1.08 : 1.45;
  if (inside) { leavePlace(VIEW(), () => openFireside(pieceId, how)); return; }
  if (pieceId === 'random') pieceId = FIRESIDE[Math.floor(Math.random() * FIRESIDE.length)].id;
  if (!fire.on) {
    fire.on = true; fire.prevClock = clock; document.body.classList.add('firemode'); FI.el.hidden = false;
    current = null; selBox = null; $('#selLabel').hidden = true; $$('.brk').forEach(b => b.hidden = true); $('#tip').hidden = true;
    resize(); Object.values(PINS).forEach(p => p.visible = false);
    fire.saved = { min: controls.minDistance, max: controls.maxDistance, pmin: controls.minPolarAngle, pmax: controls.maxPolarAngle, pan: controls.enablePan };
    flyTo(VIEW(), 2.4, () => { if (!fire.on) return; controls.minDistance = 2.2; controls.maxDistance = 9; controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.42; controls.enablePan = false; });
    if (!atPlinth && clock < 19 * 60 + 30) clockAnim = { from: clock, to: 20 * 60 + 40, t0: performance.now(), dur: REDUCED ? 1 : 3000 };
    document.body.classList.toggle('plinthdeck', atPlinth);
  }
  if (pieceId === 'deck') renderDeck();
  else if (pieceId && ARCH.some(a => a.id === pieceId)) { renderDeck(); drawCard(ARCH.find(a => a.id === pieceId).key, how || 'show'); }
  else if (pieceId && FIRE_BY[pieceId]) readPiece(pieceId, 0); else renderCircle();
}
function leaveFireside(goTo = true) {
  if (!fire.on) return; fire.on = false; document.body.classList.remove('firemode'); FI.el.hidden = true; DKX.on = false; DKX.drawn = null;
  if (fire.saved) { controls.minDistance = fire.saved.min; controls.maxDistance = fire.saved.max; controls.minPolarAngle = fire.saved.pmin; controls.maxPolarAngle = fire.saved.pmax; controls.enablePan = fire.saved.pan; }
  resize(); Object.values(PINS).forEach(p => p.visible = true);
  if (fire.prevClock != null && fire.prevClock !== clock) clockAnim = { from: clock, to: fire.prevClock, t0: performance.now(), dur: REDUCED ? 1 : 2400 };
  fire.where = null; document.body.classList.remove('plinthdeck');
  if (goTo) deselect();
}
function renderCircle() {
  fire.piece = null; DKX.on = false; DKX.drawn = null; FI.el.querySelector('.fire-card').classList.remove('dk-mode'); FI.eye.textContent = 'The fireside · Blissfull Drift'; FI.title.textContent = 'Around the fire';
  FI.body.innerHTML = `<p class="fi-meta" style="margin:0">Poems and stories written by Mahala camp mates. Choose one to read by the fire.</p>
    <div class="fi-list">${FIRESIDE.map(p => `<button class="fi-item" data-piece="${p.id}"><span class="k">${p.kind}${p.when ? ' · ' + p.when : ''}</span><b>${esc(p.title)}</b><small>${esc(p.stanzas[0][0])}</small></button>`).join('')}</div>`;
  FI.foot.innerHTML = `<span class="note">Click the fire to add a log.</span><button class="btn" data-fi="book">${icon('book')}The Book of Mahala</button><button class="btn" data-fi="deck">${icon('star')}Draw a card</button><button class="btn primary" data-fi="random">${icon('shuffle')}Let the fire choose</button>`;
}
function readPiece(id, page) {
  markDone(1, 'read'); DKX.on = false; DKX.drawn = null; FI.el.querySelector('.fire-card').classList.remove('dk-mode'); const p = FIRE_BY[id]; fire.piece = id; fire.page = page; const n = p.stanzas.length;
  FI.eye.textContent = `${p.kind}${p.when ? ' · ' + p.when : ''} · ${page + 1} of ${n}`; FI.title.textContent = p.title;
  const lines = p.stanzas[page];
  FI.body.innerHTML = `<div class="fi-lines${p.prose ? ' prose' : ''}">${lines.map((l, k) => `<p style="animation-delay:${(REDUCED ? 0 : 0.25 + k * (p.prose ? 0.9 : 0.55)).toFixed(2)}s">${esc(l)}</p>`).join('')}</div>
    <div class="stdots">${p.stanzas.map((_, i) => `<i class="${i <= page ? 'on' : ''}"></i>`).join('')}</div>`;
  const last = page === n - 1; const others = FIRESIDE.filter(x => x.id !== id); const nxt = others[(FIRESIDE.indexOf(p)) % others.length];
  FI.foot.innerHTML = `<span class="note">By a Mahala camp mate.</span><button class="btn" data-fi="circle">${icon('users')}The circle</button>
    <button class="btn" data-fi="back" ${page === 0 ? 'disabled' : ''}>${icon('left')}Back</button>
    ${last ? `<button class="btn primary" data-piece="${nxt.id}">${esc(nxt.title)}${icon('right')}</button>` : `<button class="btn primary" data-fi="next">Next${icon('right')}</button>`}`;
  FX.flare = Math.max(FX.flare, 0.45);
}
FI.el.addEventListener('click', e => {
  const pc = e.target.closest('[data-piece]'); if (pc) { readPiece(pc.dataset.piece, 0); return; }
  const cd = e.target.closest('[data-card]'); if (cd) { drawCard(cd.dataset.card); return; }
  const b = e.target.closest('[data-fi]'); if (!b) return; const k = b.dataset.fi;
  if (k === 'circle') renderCircle();
  if (k === 'random') { const pool = FIRESIDE.filter(x => x.id !== fire.piece); readPiece(pool[Math.floor(Math.random() * pool.length)].id, 0); FX.flare = 1; }
  if (k === 'next' && fire.piece) readPiece(fire.piece, Math.min(fire.page + 1, FIRE_BY[fire.piece].stanzas.length - 1));
  if (k === 'back' && fire.piece) readPiece(fire.piece, Math.max(0, fire.page - 1));
  if (k === 'book') openBook(0);
  if (k === 'deck') renderDeck();
  if (k === 'shuffle') { shuffleDeck(); renderDeck(); }
  if (k === 'fate') { drawCard(ARCH[DKX.order[Math.floor(Math.random() * ARCH.length)]].key); }
  if (k === 'shadow') { const on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(on)); FI.body.querySelector('.dk-shadow').hidden = !on; if (on) FI.body.querySelector('.dk-shadow').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' }); }
  if (k === 'keep' && DKX.drawn) { keepCard(DKX.drawn); const kept = DKX.kept === DKX.drawn; b.setAttribute('aria-pressed', String(kept)); b.innerHTML = `${icon(kept ? 'check' : 'star')}${kept ? 'Your archetype' : 'Keep as my archetype'}`; toast(kept ? `${ARCH_BY[DKX.drawn].title} is your archetype for this visit.` : 'Card put back in the deck.'); }
  if (k === 'inbook' && DKX.drawn) openBook(ARCH_BY[DKX.drawn].page);
  if (k === 'share' && DKX.drawn) shareCard(ARCH_BY[DKX.drawn]);
});

/* ---------- the Mahala Archetype Deck: eleven cards rise from the fire in a ring; choose one and it turns to you ---------- */
const DKX = { on: false, built: false, rise: 0, spin: 0, drawn: null, order: ARCH.map((_, i) => i), cards: [], kept: null };
function shuffleDeck() { const o = DKX.order; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } DKX.drawn = null; FX.flare = Math.max(FX.flare, 0.6); }
function buildDeck3D() {
  if (DKX.built) return; DKX.built = true;
  const loader = new THREE.TextureLoader(), tex = src => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const c = document.createElement('canvas'); c.width = 120; c.height = 162; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 120, 162); x.fillStyle = '#fff'; x.beginPath();
  if (x.roundRect) x.roundRect(1, 1, 118, 160, 9); else x.rect(1, 1, 118, 160); x.fill();
  const alpha = new THREE.CanvasTexture(c), back = tex('assets/deck/back.jpg'), geo = new THREE.PlaneGeometry(0.36, 0.487);
  ARCH.forEach(a => { const g = new THREE.Group(); g.visible = false; scene.add(g);
    const face = (map, turn) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, alphaMap: alpha, alphaTest: 0.03, transparent: true, color: 0xf0e4d4, fog: false }));
      if (turn) m.rotation.y = Math.PI; m.userData.pick = 'CARD:' + a.key; m.renderOrder = 6; g.add(m); PICKABLE.push(m); return m; };
    DKX.cards.push({ a, g, mats: [face(tex(a.src), false).material, face(back, true).material], init: false }); });
}
function renderDeck() {
  buildDeck3D(); DKX.on = true; DKX.drawn = null; fire.piece = null; FI.el.querySelector('.fire-card').classList.remove('dk-mode');
  const atPlinth = fire.where === 'plinth';
  FI.eye.textContent = atPlinth ? 'The Mahala Archetype Deck · at the threshold' : 'The Mahala Archetype Deck'; FI.title.textContent = 'Draw a card';
  FI.body.innerHTML = `<p class="fi-meta" style="margin:0">Take a breath and hold a question. Then choose a card from the ring ${atPlinth ? 'above the deck' : 'over the fire'}, or from the fan below.</p>
    <div class="dk-fan" role="group" aria-label="Eleven cards, face down">${DKX.order.map((i, s) => `<button class="dk-back" data-card="${ARCH[i].key}" style="--r:${((s - 5) * 2.4).toFixed(1)}deg" aria-label="Card ${s + 1} of 11, face down"><img src="assets/deck/back.jpg" alt=""></button>`).join('')}</div>`;
  FI.foot.innerHTML = `<span class="note">The archetypes of the Book of Mahala.</span>${atPlinth ? '' : `<button class="btn" data-fi="circle">${icon('users')}The circle</button>`}<button class="btn" data-fi="shuffle">${icon('shuffle')}Shuffle</button><button class="btn primary" data-fi="fate">${icon(atPlinth ? 'star' : 'flame')}${atPlinth ? 'Choose one for me' : 'Let the fire choose'}</button>`;
}
function drawCard(key, how = 'draw') {
  const a = ARCH_BY[key]; if (!a) return; buildDeck3D(); DKX.on = true; DKX.drawn = key; fire.piece = null; FX.flare = 1;
  FI.eye.textContent = how === 'draw' ? (fire.where === 'plinth' ? 'Drawn at the threshold' : 'Drawn by the fire') : DKX.kept === key ? 'Your archetype' : 'From the deck'; FI.title.textContent = a.title;
  FI.body.innerHTML = `<div class="dk-reveal">
      <div class="dk-card"><div class="dk-in"><img class="dk-f" src="${a.src}" alt="${esc(a.title + ': the card shows ' + a.look)}"><img class="dk-b" src="assets/deck/back.jpg" alt=""></div></div>
      <div class="dk-text"><p class="dk-cap">${esc(a.cap)}</p>${a.gift.map(p => `<p>${esc(p)}</p>`).join('')}${a.q ? `<p class="dk-q">${esc(a.q)}</p>` : ''}
        <button class="dk-sh" data-fi="shadow" aria-expanded="false">${icon('moon')}The shadow</button>
        <div class="dk-shadow" hidden>${a.shadow.map(p => `<p>${esc(p)}</p>`).join('')}${a.sq ? `<p class="dk-q">${esc(a.sq)}</p>` : ''}</div></div></div>`;
  FI.body.scrollTop = 0; FI.el.querySelector('.fire-card').scrollTop = 0; FI.el.querySelector('.fire-card').classList.add('dk-mode');
  const flip = () => FI.body.querySelector('.dk-card')?.classList.add('flipped'); if (REDUCED) flip(); else setTimeout(flip, 420);
  const kept = DKX.kept === key;
  FI.foot.innerHTML = `<span class="note">Book of Mahala, page ${a.page}.</span><button class="btn" data-fi="inbook">${icon('book')}In the book</button>
    <button class="btn" data-fi="share">${icon('users')}Pass it round</button><button class="btn" data-fi="keep" aria-pressed="${kept}">${icon(kept ? 'check' : 'star')}${kept ? 'Your archetype' : 'Keep as my archetype'}</button>
    <button class="btn primary" data-fi="deck">${icon('shuffle')}Draw again</button>`;
}
function keepCard(key) { DKX.kept = DKX.kept === key ? null : key; try { if (DKX.kept) localStorage.setItem('mahala.archetype', DKX.kept); else localStorage.removeItem('mahala.archetype'); } catch (e) { } showKept(); }
function showKept() {
  const a = DKX.kept && ARCH_BY[DKX.kept], who = $('.who'); if (!who) return;
  who.querySelector('.arch-badge')?.remove(); who.classList.toggle('has-arch', !!a);
  if (a) who.querySelector('.avatar').insertAdjacentHTML('beforeend', `<img class="arch-badge" src="${a.src}" alt="">`);
  $('#whoRole').textContent = a ? a.title : (store.get('mahala_badge') === '1' ? 'Badge unlocked' : 'Prototype preview'); who.title = a ? `Your archetype: ${a.title}. Click to see the card.` : '';
  who.tabIndex = a ? 0 : -1; who.setAttribute('role', a ? 'button' : 'group'); if (HOOK7.who) { try { HOOK7.who(); } catch (e) { console.warn(e); } }
}
async function shareCard(a) {
  const text = `By the fire in the Mahalaverse I drew ${a.title}: "${a.cap}." ${a.q || a.sq || ''}`.trim();
  try { if (navigator.share) { await navigator.share({ title: a.title, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied. Pass it round the circle.'); } catch (e) { toast(`${a.title}: ${a.cap}`); }
}
{ try { const k = localStorage.getItem('mahala.archetype'); if (ARCH_BY[k]) DKX.kept = k; } catch (e) { }
  showKept(); const who = $('.who');
  if (who) { const go = () => { if (DKX.kept) openFireside('ARCH_' + DKX.kept.toUpperCase(), 'kept'); }; who.addEventListener('click', go); who.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); } }
const _dkC = new THREE.Vector3(), _dkP = new THREE.Vector3(), _dkM = new THREE.Matrix4(), _dkQ = new THREE.Quaternion(), _dkUp = new THREE.Vector3(0, 1, 0), _dkCam = new THREE.Vector3();
function updateDeck(dt, t) {
  if (!DKX.built) return;
  const want = DKX.on && fire.on ? 1 : 0; DKX.rise += (want - DKX.rise) * Math.min(1, dt * (want ? 1.5 : 2.8));
  if (!REDUCED) DKX.spin += dt * (DKX.drawn ? 0.04 : 0.13);
  const vis = DKX.rise > 0.02, C = DKX.c || FIRE_AT, N = DKX.cards.length, R = DKX.R || 1.45, k = REDUCED ? 1 : Math.min(1, dt * 4.2);
  _dkCam.copy(camera.position).sub(C).setY(0).normalize();
  DKX.cards.forEach((c, i) => {
    c.g.visible = vis; c.g.children.forEach(m => m.visible = vis); if (!vis) { c.init = false; return; }
    const drawn = DKX.drawn === c.a.key, slot = DKX.order.indexOf(i), ang = slot / N * Math.PI * 2 + DKX.spin;
    if (drawn) {   // the drawn card lifts out of the ring and hangs in the air before you, above the words
      _dkP.set(0, 0.53 + 0.012 * Math.sin(t * 1.1), 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(3.8).add(camera.position); _dkM.lookAt(camera.position, _dkP, _dkUp); }
    else { _dkP.set(C.x + Math.cos(ang) * R, C.y + 0.45 + DKX.rise * 1.25 + 0.045 * Math.sin(t * 1.3 + i * 0.9), C.z + Math.sin(ang) * R);
      _dkC.copy(_dkP).sub(camera.position).setY(0).normalize().add(_dkP); _dkM.lookAt(_dkC, _dkP, _dkUp); }   // face down: each card turns its back to you
    _dkQ.setFromRotationMatrix(_dkM);
    if (!c.init) { c.g.position.copy(C).setY(C.y + 0.4); c.g.quaternion.copy(_dkQ); c.init = true; }
    c.g.position.lerp(_dkP, k); c.g.quaternion.slerp(_dkQ, k);
    const s = (drawn ? 1.2 : 1.15) * (0.3 + 0.7 * DKX.rise); c.g.scale.setScalar(c.g.scale.x + (s - c.g.scale.x) * k);
    const op = DKX.drawn && !drawn ? 0.4 : 1; c.mats.forEach(m => { m.opacity += (op - m.opacity) * k; });
  });
}
$('#fiClose').addEventListener('click', () => leaveFireside());

/* ---------- the Book of Mahala: a page-turning reader ---------- */
const BKR = { el: $('#bookModal'), stage: $('#bkStage'), book: $('#bkBook'), i: 0, busy: false, solo: false, w: 0, h: 0 };
const pageImg = i => { const p = BOOK.pages[i]; return p ? `<img src="${p.src}" alt="${esc(p.alt || 'Page ' + (i + 1))}" draggable="false">` : `<div class="bk-blank">${i >= BOOK.pages.length ? 'The end of the book.' : ''}</div>`; };
function bookLayout() {
  BKR.solo = innerWidth <= 760; const r = BKR.stage.getBoundingClientRect(); const R = BOOK.ratio;
  const ph = Math.min(r.height - 8, (BKR.solo ? r.width - 8 : (r.width - 8) / 2) / R); BKR.h = Math.max(120, ph); BKR.w = BKR.h * R;
  BKR.book.style.width = (BKR.solo ? BKR.w : BKR.w * 2) + 'px'; BKR.book.style.height = BKR.h + 'px';
}
const spreadOf = i => i === 0 ? 0 : Math.ceil(i / 2);           // the cover sits alone on the right
const spreadPages = sp => sp === 0 ? [null, 0] : [2 * sp - 1, 2 * sp];
function renderBook() {
  bookLayout(); const N = BOOK.pages.length;
  if (BKR.solo) { BKR.book.innerHTML = `<div class="bk-page solo" style="width:${BKR.w}px">${pageImg(BKR.i)}</div>`; }
  else { const [l, r] = spreadPages(spreadOf(BKR.i));
    BKR.book.innerHTML = (l != null ? `<div class="bk-page l" style="width:${BKR.w}px">${pageImg(l)}</div>` : '') + (r < N ? `<div class="bk-page r" style="width:${BKR.w}px">${pageImg(r)}</div>` : ''); }
  const max = BKR.solo ? N - 1 : spreadOf(N - 1); $('#bkRange').max = Math.max(0, max); $('#bkRange').value = BKR.solo ? BKR.i : spreadOf(BKR.i);
  const [l, r] = spreadPages(spreadOf(BKR.i));
  BKR.book.classList.toggle('at-cover', !BKR.solo && BKR.i === 0);
  $('#bkNum').textContent = BKR.i === 0 ? `Cover · ${N - 1} page${N === 2 ? '' : 's'}` : BKR.solo ? `Page ${BKR.i} of ${N - 1}` : `Pages ${l}${r < N ? ' and ' + r : ''} of ${N - 1}`;   // the cover is not numbered
  $('#bkPrev').disabled = BKR.i === 0; $('#bkNext').disabled = BKR.solo ? BKR.i >= N - 1 : spreadOf(BKR.i) >= spreadOf(N - 1);
  const ch = [...BOOK.chapters].reverse().find(c => c.page <= BKR.i); if (ch) $('#bkToc').value = String(ch.page);
  if (!$('#bkText').hidden) renderBookWords();
  $('#bkDraw').hidden = BKR.i < 21;   // from the deck's own page onwards
  for (const k of [1, 2, 3]) { const p = BOOK.pages[BKR.i + k]; if (p) { const im = new Image(); im.src = p.src; } }
}
function renderBookWords() {
  const N = BOOK.pages.length, idx = BKR.solo ? [BKR.i] : spreadPages(spreadOf(BKR.i)).filter(x => x != null && x < N);
  $('#bkText').innerHTML = idx.map(i => `<h4>${i === 0 ? 'Cover' : 'Page ' + i}</h4><p>${esc(BOOK.pages[i].text || 'A painting, with no words on this page.')}</p>`).join('');
}
function turn(dir) {
  const N = BOOK.pages.length; if (BKR.busy || !N) return;
  if (BKR.solo || REDUCED) { const to = clamp(BKR.i + dir, 0, N - 1); if (to === BKR.i) return; BKR.i = to; renderBook(); return; }
  const sp = spreadOf(BKR.i), to = sp + dir; if (to < 0 || to > spreadOf(N - 1)) return;
  const [l, r] = spreadPages(sp), [nl, nr] = spreadPages(to); BKR.busy = true;
  const leaf = document.createElement('div'); leaf.className = 'bk-leaf'; leaf.style.width = BKR.w + 'px';
  if (dir > 0) { leaf.style.left = BKR.w + 'px'; leaf.style.transformOrigin = '0 50%'; leaf.innerHTML = `<div class="face">${pageImg(r)}</div><div class="face back">${pageImg(nl)}</div>`;
    const under = BKR.book.querySelector('.bk-page.r'); if (under) under.innerHTML = nr < N ? pageImg(nr) : ''; if (under && nr >= N) under.style.visibility = 'hidden'; }
  else { leaf.style.left = '0px'; leaf.style.transformOrigin = '100% 50%'; leaf.innerHTML = `<div class="face">${pageImg(l)}</div><div class="face back">${pageImg(nr)}</div>`;
    let under = BKR.book.querySelector('.bk-page.l'); if (under) { if (nl == null) under.remove(); else under.innerHTML = pageImg(nl); } }
  BKR.book.appendChild(leaf); leaf.getBoundingClientRect(); BKR.book.classList.toggle('at-cover', to === 0);
  requestAnimationFrame(() => { leaf.style.transform = `rotateY(${dir > 0 ? -180 : 180}deg)`; });
  setTimeout(() => { BKR.i = to === 0 ? 0 : 2 * to - 1; BKR.busy = false; renderBook(); }, 870);
}
function openBook(page = 0) {
  if (!BOOK.pages.length) { toast('The pages are still being added to the book.'); return; }
  markDone(0, 'book'); lastFocus = document.activeElement; BKR.el.hidden = false; BKR.i = clamp(page, 0, BOOK.pages.length - 1); if (!BKR.solo && BKR.i > 0 && BKR.i % 2 === 0) BKR.i -= 1; renderBook(); $('#bookClose').focus();
}
function closeBook() { BKR.el.hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
$('#bkToc').innerHTML = BOOK.chapters.map(c => `<option value="${c.page}">${c.sub ? '\u00a0\u00a0\u00a0' : ''}${esc(c.title)}</option>`).join('');
$('#bkToc').hidden = !BOOK.chapters.length;
$('#bkToc').addEventListener('change', e => { BKR.i = +e.target.value; renderBook(); });
$('#bkRange').addEventListener('input', e => { const v = +e.target.value; BKR.i = BKR.solo ? v : (v === 0 ? 0 : 2 * v - 1); renderBook(); });
$('#bkPrev').addEventListener('click', () => turn(-1)); $('#bkNext').addEventListener('click', () => turn(1));
$('#bookClose').addEventListener('click', closeBook);
$('#bkDraw').addEventListener('click', () => { closeBook(); if (WAY[WY.i].id === 'book') openPlinthDeck(); else openFireside('deck'); });
$('#bkWords').addEventListener('click', () => { const on = $('#bkText').hidden; $('#bkText').hidden = !on; $('#bkWords').setAttribute('aria-pressed', String(on)); if (on) renderBookWords(); });
BKR.el.addEventListener('click', e => { if (e.target === BKR.el) closeBook(); });
{ let sx = null; BKR.stage.addEventListener('pointerdown', e => { sx = e.clientX; }); BKR.stage.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1);
  else if (e.target.closest('.bk-page')) { const rr = BKR.book.getBoundingClientRect(); turn(e.clientX > rr.left + rr.width / 2 ? 1 : -1); } }); }
addEventListener('resize', () => { if (!BKR.el.hidden) renderBook(); });

/* ---------- the spotlight: one piece at a time, in its own small 3D view ---------- */
let SP = null, spotKey = null;
function spotEnsure() {
  if (SP) return SP;
  const cv = $('#spotCanvas'); const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setClearColor(0x000000, 0);
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const sc = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff0e0, 2.4); key.position.set(2, 3.5, 2.5); const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4); rim.position.set(-3, 1.2, -2.5);
  sc.add(key, rim, new THREE.HemisphereLight(0x8090b0, 0x201810, 0.5));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100); const ctl = new OrbitControls(cam, cv);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.enablePan = false; ctl.autoRotate = !REDUCED; ctl.autoRotateSpeed = 1.4; ctl.rotateSpeed = 0.7;
  ctl.addEventListener('start', () => { ctl.autoRotate = false; });
  SP = { r, sc, cam, ctl, obj: null, mats: {
    body: new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: 0.5, metalness: 0.05 }), wire: new THREE.MeshStandardMaterial({ color: COPPER, metalness: 1, roughness: 0.24 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xc89a66, roughness: 0.6 }), cord: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.75 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.22 }) } };
  return SP;
}
// the winding drawn as light: rainbow bands that run along the copper's path, and a fine mesh of both families of turns
const FLOW_U = { time: { value: 0 } };
function flowShell(R, r, w = [12, 5, 3, 5, 0]) {
  const [wa, wb, wp, wh, wv] = w.map(n => n.toFixed(2));
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 48, 160), new THREE.ShaderMaterial({ uniforms: FLOW_U, transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float vy = fract(vUv.y + ${wv}), w1 = vUv.x * ${wa} - vy * ${wb}, w2 = vUv.x * ${wa} + vy * ${wb};
        float band = fract(w1 / ${wp} - time * 0.12), idx = floor(w1 / ${wp} - time * 0.12);
        float b = smoothstep(0.0, 0.16, band) * smoothstep(0.66, 0.42, band);
        vec3 base = vec3(0.02, 0.07, 0.3);
        vec3 col = mix(base, hue(fract(idx / ${wh} + 0.02)) * 0.95, b * 0.95);
        float l1 = smoothstep(0.455, 0.49, abs(fract(w1 * 2.0) - 0.5)), l2 = smoothstep(0.455, 0.49, abs(fract(w2 * 2.0) - 0.5));
        col = mix(col, vec3(0.9, 0.94, 1.0), max(l1, l2) * 0.6);
        gl_FragColor = vec4(col, 0.9);
        #include <colorspace_fragment>
      }` }));
  m.visible = false; m.renderOrder = 6; return m;
}
const groovedFlow = c => { const fl = flowShell(0.0458, 0.0246, [7, -8, 1, 7, 0.5]); fl.rotation.x = Math.PI / 2; c.add(fl); return fl; };
const cloneMat = m => { const c = m.clone(); c.envMapIntensity = m.userData.envBase ?? m.envMapIntensity; return c; };
function spotBuild(key) {
  const sp = spotEnsure(), g = new THREE.Group();
  if (key === 'CENTRE') { (REG.CENTRE.meshes || []).forEach(m => { const c = new THREE.Mesh(m.geometry, cloneMat(m.material)); c.applyMatrix4(m.matrixWorld); c.renderOrder = m.renderOrder; g.add(c); });
    if (vortex) { const v = new THREE.Mesh(vortex.geometry, vortex.material); v.position.copy(vortex.position); v.renderOrder = 3; v.userData.spin = true; g.add(v); }
    const fl = flowShell(0.14879, 0.0573, [7, -8, 1, 7, 0.5]); fl.rotation.x = Math.PI / 2; fl.position.y = 1.0767; g.add(fl); g.userData.flow = fl; }
  else if (key === 'MAHAL_COIL') { const c = grooveCoil(sp.mats, { scale: 40 / 14, wire: 0.036, cols: [-0.036, 0, 0.036] }); g.add(c); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 32), sp.mats.wood)); g.userData.flow = groovedFlow(c); }
  else if (key === 'COIL_140') { const c = grooveCoil(sp.mats); c.rotation.set(0.42, 0, 0.12); g.add(c); g.userData.flow = groovedFlow(c); }
  else if (key === 'PENDANT') {          // a 35 mm ring hung face on, a braided cord looped through the hole (lark's head), a bead above
    const ring = grooveCoil(sp.mats, { scale: 0.25, wire: 0.075, cols: [0], layersA: [1.80, 1.95], layersB: [2.16], seg: 1600 }); ring.rotation.x = Math.PI / 2; g.add(ring);
    const R = 0.01145, rt = 0.006, cr = 0.0011, top = R + rt;
    for (const s2 of [-1, 1]) {            // two wraps over the top of the ring, through the hole
      const pts = []; for (let i = 0; i <= 48; i++) { const a2 = -Math.PI * 0.62 + i / 48 * Math.PI * 1.24 * 1.62; pts.push(V3(s2 * 0.0016, R + (rt + cr) * Math.cos(a2), (rt + cr) * Math.sin(a2))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, cr, 8), sp.mats.cord));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(s2 * 0.0016, top + cr, 0.0004), V3(s2 * 0.0012, top + 0.008, 0), V3(s2 * 0.0011, top + 0.016, 0), V3(s2 * 0.003, top + 0.05, 0)]), 40, cr, 8), sp.mats.cord));
    }
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 32, 16), sp.mats.silver); bead.position.y = top + 0.0125; g.add(bead);
    g.userData.flow = groovedFlow(ring); }
  else if (key.startsWith('POD_')) { (REG[key].meshes || []).forEach(m => { const c = new THREE.Mesh(m.geometry, cloneMat(m.material)); c.applyMatrix4(m.matrixWorld); g.add(c); }); }
  const box = new THREE.Box3().setFromObject(g); if (box.isEmpty()) return g;
  const ctr = box.getCenter(V3()); g.children.forEach(c => c.position.sub(ctr)); g.userData.radius = box.getSize(V3()).length() / 2;
  return g;
}
function spotSize() { if (!SP) return; const cv = $('#spotCanvas'); const w = cv.clientWidth || 600, h = cv.clientHeight || 400; SP.r.setSize(w, h, false); SP.cam.aspect = w / h; SP.cam.updateProjectionMatrix(); }
function openSpot(key) {
  const d = SPOT[key]; if (!d) return; spotKey = key; lastFocus = document.activeElement;
  $('#spotModal').hidden = false; const sp = spotEnsure(); spotSize();
  if (sp.obj) { sp.sc.remove(sp.obj); }
  sp.obj = spotBuild(key); sp.sc.add(sp.obj);
  const fb = $('#spotFlow'); fb.hidden = !sp.obj.userData.flow; fb.setAttribute('aria-pressed', 'false'); fb.innerHTML = `${icon('light')}Show the winding as light`;
  const R = sp.obj.userData.radius || 1; const dist = R / Math.sin(THREE.MathUtils.degToRad(sp.cam.fov / 2)) * 1.08;
  sp.cam.near = R / 60; sp.cam.far = R * 60; sp.cam.position.set(dist * 0.62, dist * 0.42, dist * 0.66); sp.cam.lookAt(0, 0, 0); sp.cam.updateProjectionMatrix();
  sp.ctl.target.set(0, 0, 0); sp.ctl.minDistance = R * 1.2; sp.ctl.maxDistance = dist * 2.2; sp.ctl.autoRotate = !REDUCED; sp.ctl.update();
  const isPod = key.startsWith('POD_');
  $('#spotText').innerHTML = `<div class="eyebrow">${esc(d.eye)}</div><h3 id="spotTitle">${esc(d.title)}</h3><div class="chips">${d.chips.map(([t, tone]) => chip(t, tone)).join('')}</div>
    <div class="sect"><h4>What it is</h4><p>${d.what}</p></div><div class="sect"><h4>How it works</h4><p>${d.how}</p></div><div class="sect"><h4>What it means</h4><p>${d.means}</p></div>
    ${kv(d.facts)}
    <div class="actions">${key === 'PENDANT' ? `<button class="btn" data-spotgo="gate:2">${icon('gift')}Gate 2: a pendant</button>` : ''}${key === 'MAHAL_COIL' || key === 'COIL_140' ? `<button class="btn" data-spotgo="gate:4">${icon('gift')}Gate 4: a big coil</button>` : ''}<button class="btn" data-spotgo="sel:${key}">${icon('pin')}Show me where it is</button></div>
    <p class="note">${isPod ? 'The forms are shown in a first arrangement. Which form stands where is still open.' : key === 'CENTRE' ? 'A concept model: the egg, the coil and the stirrer are still being tested.' : 'Modelled on the 140 mm grooved ring, with the copper laid in its grooves.'} Temple Tech pieces are art and research in copper, geometry and craft. They make no medical claims.</p>`;
  $('#spotText').scrollTop = 0; $('#spotClose').focus();
}
function closeSpot() { $('#spotModal').hidden = true; spotKey = null; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
$('#spotClose').addEventListener('click', closeSpot);
$('#spotFlow').addEventListener('click', () => { const f = SP && SP.obj && SP.obj.userData.flow; if (!f) return; f.visible = !f.visible; $('#spotFlow').setAttribute('aria-pressed', String(f.visible));
  $('#spotFlow').innerHTML = `${icon('light')}${f.visible ? 'Hide the light' : 'Show the winding as light'}`; if (f.visible) toast('The path of the copper, drawn as moving colour: a picture of the geometry, not a measurement.'); });
$('#spotModal').addEventListener('click', e => { if (e.target.id === 'spotModal') closeSpot();
  const g = e.target.closest('[data-spotgo]'); if (!g) return; const [k, v] = g.dataset.spotgo.split(':'); closeSpot();
  if (k === 'gate') openJoin('back', +v); if (k === 'sel') { if (v === 'CENTRE' && !inside) enterTemple(); else select(v); } });
const stepSpot = dir => { const i = TECH_ORDER.indexOf(spotKey); openSpot(TECH_ORDER[(i + dir + TECH_ORDER.length) % TECH_ORDER.length]); };
$('#spotPrev').addEventListener('click', () => stepSpot(-1)); $('#spotNext').addEventListener('click', () => stepSpot(1));
addEventListener('resize', () => { if (!$('#spotModal').hidden) spotSize(); });

/* ---------- the story: "Do you remember?", told through the world ---------- */
function startStory(i = 0, seq = STORY) {
  story.seq = seq; $('#stDots').innerHTML = seq.map(() => '<i></i>').join('');
  $('#stNote').textContent = seq === STORY ? 'Words from the draft script of the Seed of Hope film, written by camp mates of Mahala.' : 'A short tour of the playa. The world is a concept visualisation, not yet built.';
  LIT.mode.value = 0; LM.dirty = true;
  closePops(); if (!$('#spotModal').hidden) closeSpot(); if (fire.on) leaveFireside(false); playing = false;
  story.on = true; document.body.classList.add('storymode'); $('#story').hidden = false; $('#insideBar').hidden = true;
  current = null; selBox = null; $('#selLabel').hidden = true; $$('.brk').forEach(b => b.hidden = true); $('#tip').hidden = true;
  camera.clearViewOffset(); camera.updateProjectionMatrix(); Object.values(PINS).forEach(p => p.visible = false);
  showChapter(i);
}
function showChapter(i) {
  const SEQ = story.seq || STORY; story.i = i; const ch = SEQ[i];
  $('#stEye').textContent = `${SEQ === STORY ? 'The story' : 'The tour'} · ${i + 1} of ${SEQ.length}`; $('#stTitle').textContent = ch.title;
  $$('#stDots i').forEach((d, k) => d.classList.toggle('on', k <= i));
  $('#stLines').innerHTML = ch.lines.map((l, k) => `<p style="animation-delay:${(REDUCED ? 0 : 0.5 + k * 1.1).toFixed(1)}s">${esc(l)}</p>`).join('');
  $('#stVerse').hidden = !ch.verse && !ch.act; $('#stDoors').hidden = !ch.doors;
  if (ch.act) $('#stVerse').innerHTML = `${icon(ch.act[1])}<span class="vs"><em>${esc(ch.act[2])}</em></span><button class="btn" data-tour="${ch.act[0]}">${esc(ch.act[3])}</button>`;
  if (ch.verse) { const v = VERSES[ch.verse - 1], p = FIRE_BY[v.piece]; $('#stVerse').innerHTML = `${icon('pen')}<span class="vs"><em>${v.lines.slice(0, 2).map(esc).join(' / ')}</em><small>From ${esc(p.title)}, by a Mahala camp mate</small></span><button class="btn" data-fire="${p.id}">${icon('flame')}Read it</button>`; } if (ch.doors) $('#stDoors').innerHTML = doorsHTML();
  $('#stBack').disabled = i === 0; $('#stNext').innerHTML = (i === SEQ.length - 1 ? 'Finish' : 'Next') + icon('right');
  const v = ch.view();
  const far = controls.target.distanceTo(v.t); if (far > 60 && !REDUCED && !ch.inside) v.lift = clamp(far * 0.45, 30, 90);
  if (ch.inside) enterTemple(v); else if (inside) leaveTemple(v); else flyTo(v, far > 60 ? clamp(2.6 + far / 80, 2.6, 4.6) : 2.6);
  clockAnim = { from: clock, to: ch.clock, t0: performance.now(), dur: REDUCED ? 1 : 2400 };
}
function stopStory(goHome = true) {
  if (!story.on) return; story.on = false; LIT.mode.value = 0; LM.dirty = true;
  const SEQ = story.seq || STORY; if (story.i === SEQ.length - 1) markDone(0, SEQ === STORY ? 'story' : 'tour'); document.body.classList.remove('storymode'); $('#story').hidden = true; resize(); Object.values(PINS).forEach(p => p.visible = true);
  if (inside) $('#insideBar').hidden = false;
  if (goHome) { const v = WAY[WY.i].view(); if (inside) leaveTemple(v); else flyTo(v, 1.8); showWelcome(); }
}
$('#stNext').addEventListener('click', () => { const SEQ = story.seq || STORY; if (story.i < SEQ.length - 1) showChapter(story.i + 1); else { const tour = SEQ !== STORY; stopStory(!tour); if (tour) afterTour(); else afterStory(); } });
$('#stBack').addEventListener('click', () => { if (story.i > 0) showChapter(story.i - 1); });
$('#stClose').addEventListener('click', () => stopStory());
$('#story').addEventListener('click', e => { const tb = e.target.closest('[data-tour]'); if (tb) { const k = tb.dataset.tour; story.i = (story.seq || STORY).length - 1; stopStory(false); if (k === 'book') openBook(0); return; }
  const d = e.target.closest('[data-door]'); if (d) { stopStory(false); flyTo(HOME, 1.6); openJoin(d.dataset.door); return; } const f = e.target.closest('[data-fire]'); if (f) { stopStory(false); openFireside(f.dataset.fire); } });

/* ---------- frame loop ---------- */
const brks = $$('.brk'), selLabel = $('#selLabel');
const corners = Array.from({ length: 8 }, () => V3());
function project(p) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z }; }
function updateLabels() {
  const dist = camera.position.distanceTo(controls.target);
  for (const z of ZONE_LABELS) {
    const s = project(z.p); const show = s.z < 1 && dist > 55 && current !== z.id;
    z.el.classList.toggle('hide', !show); if (show) z.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
  }
  if (current && selBox) {
    const b = selBox; let i = 0; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const zz of [b.min.z, b.max.z]) corners[i++].set(x, y, zz);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
    for (const c of corners) { const s = project(c); if (s.z > 1) behind = true; x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); }
    const pad = 8; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const ok = !behind && x1 - x0 < innerWidth * 1.2;
    brks.forEach(b => b.hidden = !ok);
    if (ok) { brks[0].style.transform = `translate(${x0}px,${y0}px)`; brks[1].style.transform = `translate(${x1 - 14}px,${y0}px)`; brks[2].style.transform = `translate(${x0}px,${y1 - 14}px)`; brks[3].style.transform = `translate(${x1 - 14}px,${y1 - 14}px)`; }
    const top = project(V3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)); selLabel.hidden = !ok; if (ok) selLabel.style.transform = `translate(${top.x}px, ${top.y - 12}px) translate(-50%, -100%)`;
  } else if (current) {
    brks.forEach(b => b.hidden = true);
    const o = objFor(current); const p = current === 'FLOOR_GRID' ? V3(0, 0.5, 0) : (o ? new THREE.Box3().setFromObject(o).getCenter(V3()) : null);
    if (p) { const s = project(p); selLabel.hidden = s.z > 1; selLabel.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`; }
  }
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w <= 760 ? 40 : 28;
  if (story.on) camera.clearViewOffset();
  else if (fire.on) { const k = 0.36; camera.setViewOffset(w, h * (1 + k), 0, h * k, w, h); }
  else if (w > 960) { const k = 0.24; camera.setViewOffset(w * (1 + k), h, 0, 0, w, h); }       // the clear area sits right of the way card
  else if (w <= 760) { const k = 0.34; camera.setViewOffset(w, h * (1 + k), 0, h * k, w, h); } // the clear band sits above the bottom sheet
  else { camera.clearViewOffset(); }
  camera.updateProjectionMatrix(); HOME = w <= 760 ? HOME_PHONE : HOME_DESK;
}
addEventListener('resize', resize); resize();

let last = performance.now(), T = 0; const perf = { n: 0, t: 0 }; let restSkip = 0;
const FRAME_HOOKS = [];   // other layers (the together layer) draw here, once a frame, before the render
function frame(now) {
  // rest: after a while with nothing to do, draw one frame in three
  if (now - IDLE.at > 15000 && !fly && !clockAnim && !playing && !story.on && !fire.on && !DKX.on) { restSkip = (restSkip + 1) % 3; if (restSkip) { requestAnimationFrame(frame); return; } }
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt; LIT.t.value = T;
  if (!BKR.el.hidden) { requestAnimationFrame(frame); return; }   // the book takes the screen while it is open
  if (!$('#spotModal').hidden && SP) {           // the spotlight takes the GPU while it is open
    SP.ctl.update(); FLOW_U.time.value += dt; if (SP.obj) SP.obj.traverse(o => { if (o.userData.spin) o.rotation.y += dt * 1.6; }); SP.r.render(SP.sc, SP.cam); requestAnimationFrame(frame); return;
  }
  if (playing) { clock += dt * 1440 / 40; if (clock > 1380) clock = 300; applyTime(clock); }
  if (clockAnim) { const k = clamp((now - clockAnim.t0) / clockAnim.dur, 0, 1); if (now >= clockAnim.t0) { clock = lerp(clockAnim.from, clockAnim.to, ease(k)); applyTime(clock); } if (k >= 1) clockAnim = null; }
  if (!stepFly(now)) controls.update();
  if (inside && camera.position.y < 0.3) { camera.position.y = 0.3; camera.lookAt(controls.target); }
  // the centrepiece: only drawn up close; the stirrer turns and the water follows
  const cd = camera.position.length(); centreGroup.visible = (inside && insideAt === 'temple') || cd < 70;
  updateFire(dt, T); updateDeck(dt, T); if (ZONES.MAHAL_COIL) ZONES.MAHAL_COIL.visible = camera.position.distanceTo(CAMP) < 60;
  restFar();
  if (centreGroup.visible && !REDUCED) { SPIN.forEach(o => { o.rotation.y += dt * 5; }); if (vortex) vortex.rotation.y -= dt * 1.4; }
  if (LM.dirty && now - LM.last > 140) { drawLightMap(); LM.last = now; LM.dirty = false; }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  // sun and its shadow box follow the view
  const d = camera.position.distanceTo(controls.target); const Sz = clamp(d * 0.42, 18, 110);
  const sc = sun.shadow.camera; if (sc.right !== Sz) { sc.left = -Sz; sc.right = Sz; sc.top = Sz; sc.bottom = -Sz; sc.updateProjectionMatrix(); }
  sun.target.position.set(controls.target.x, 0, controls.target.z); sun.position.copy(sun.target.position).addScaledVector(sunDir.y > 0.02 ? sunDir : V3(0, 1, 0), 200);
  { const on = pinOn(); for (const id in PINS) PINS[id].visible = on; }
  if (!REDUCED) {
    for (const id in PINS) { const p = PINS[id]; p.position.y = p.userData.base + Math.sin(T * Math.PI + p.userData.phase) * 0.35; p.rotation.y = T * 0.6; }
    const fp = flagGeo.attributes.position; for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; const k = (x + 1.2) / 2.4; fp.setZ(i, Math.sin(T * 3 + x * 2.2) * 0.22 * k); } fp.needsUpdate = true; flagGeo.computeVertexNormals();
    updateBuilders(dt, T);
    // the bakkie: in from the horizon, a pause at the yard, out again
    if (BK.phase === 'wait') { BK.wait -= dt; if (BK.wait <= 0) BK.phase = BK.u >= 1 ? 'out' : 'in'; }
    else { const sp = 14 / ROAD.getLength(); BK.u += (BK.phase === 'in' ? 1 : -1) * dt * sp * (BK.phase === 'in' ? (0.25 + 0.75 * (1 - smooth(0.85, 1, BK.u))) : (0.25 + 0.75 * (1 - smooth(0.85, 1, BK.u)))); if (BK.u >= 1) { BK.u = 1; BK.phase = 'wait'; BK.wait = 12; } if (BK.u <= 0) { BK.u = 0; BK.phase = 'wait'; BK.wait = 4; } }
  } else if (builders && T < 0.1) updateBuilders(0, 0);
  const bp = ROAD.getPointAt(clamp(BK.u, 0, 1)), bt = ROAD.getTangentAt(clamp(BK.u, 0, 1));
  const fwd = BK.phase === 'out' ? bt.clone().negate() : bt; bakkie.position.set(bp.x - bt.z * 1.1, 0, bp.z + bt.x * 1.1); bakkie.rotation.y = Math.atan2(-fwd.z, fwd.x);
  for (const h of FRAME_HOOKS) h(dt, T);
  renderer.render(scene, camera);
  updateLabels();
  perf.n++; perf.t += dt; if (perf.t > 2.5) { const avg = perf.t / perf.n; if (avg > 0.034 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); } else if (avg > 0.05 && sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; } perf.n = 0; perf.t = 0; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
/* film capture: renders one frame on demand, for the Temple Tech film made from this scene (the page never calls it) */
function filmFrame(o) {
  if (o.clock != null) { clock = o.clock; applyTime(clock); }
  const w = o.w || 1280, h = o.h || 720;
  if (renderer.getPixelRatio() !== 1) renderer.setPixelRatio(1);
  const sz = renderer.getSize(new THREE.Vector2()); if (sz.x !== w || sz.y !== h) renderer.setSize(w, h, false);
  camera.clearViewOffset(); camera.aspect = w / h; camera.fov = o.fov ?? 28; camera.near = o.near ?? 0.5; camera.updateProjectionMatrix();
  const tg = V3(...o.t); camera.position.copy(tg).add(V3().setFromSpherical(new THREE.Spherical(o.d, o.p, o.a))); camera.lookAt(tg); controls.target.copy(tg);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  const Sz = clamp(Math.max(o.d, 12) * 0.42, 18, 110), sc = sun.shadow.camera; sc.left = -Sz; sc.right = Sz; sc.top = Sz; sc.bottom = -Sz; sc.updateProjectionMatrix();
  const st = o.shadowAt ? V3(...o.shadowAt) : tg; sun.target.position.set(st.x, 0, st.z); sun.position.copy(sun.target.position).addScaledVector(sunDir.y > 0.02 ? sunDir : V3(0, 1, 0), 200);
  Object.values(PINS).forEach(p => p.visible = false); bakkie.visible = !!o.bakkie; if (builders) builders.visible = o.people ?? true;
  const T2 = o.time ?? 0, fp = flagGeo.attributes.position; for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3]; fp.setZ(i, Math.sin(T2 * 3 + x * 2.2) * 0.22 * (x + 1.2) / 2.4); } fp.needsUpdate = true; flagGeo.computeVertexNormals();
  updateBuilders(1 / 24, T2);
  centreGroup.visible = o.centre ?? true; SPIN.forEach(x => { x.rotation.y = T2 * 5; }); if (vortex) vortex.rotation.y = -T2 * 1.4;
  if (o.clock !== filmFrame.lastClock || !lmPlane.visible) { drawLightMap(); filmFrame.lastClock = o.clock; } renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/jpeg', o.q ?? 0.92);
}
function filmSpot(o) {
  const sp = spotEnsure(); if (spotKey !== o.key) { if (sp.obj) sp.sc.remove(sp.obj); sp.obj = spotBuild(o.key); sp.sc.add(sp.obj); spotKey = o.key; }
  const w = o.w || 1280, h = o.h || 720; sp.r.setPixelRatio(1); sp.r.setSize(w, h, false); sp.cam.aspect = w / h; sp.cam.fov = o.fov ?? 30;
  if (!sp.sc.background) { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d'); const g = x.createRadialGradient(320, 150, 10, 320, 170, 380); g.addColorStop(0, '#20263b'); g.addColorStop(1, '#07080f'); x.fillStyle = g; x.fillRect(0, 0, 640, 360); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sp.sc.background = t; }
  const R = sp.obj.userData.radius || 1, dist = R / Math.sin(THREE.MathUtils.degToRad(sp.cam.fov / 2)) * (o.zoom ?? 1.08);
  sp.cam.near = R / 60; sp.cam.far = R * 60; sp.cam.position.setFromSpherical(new THREE.Spherical(dist, o.p ?? 1.15, o.a ?? 0)); sp.cam.position.y += o.ty ?? 0; sp.cam.lookAt(0, o.ty ?? 0, 0); sp.cam.updateProjectionMatrix();
  sp.obj.traverse(x => { if (x.userData.spin) x.rotation.y = (o.time || 0) * 1.6; });
  sp.r.render(sp.sc, sp.cam); return sp.r.domElement.toDataURL('image/jpeg', o.q ?? 0.92);
}
/* ====================== v4: the builder's path, in the world ====================== */
const IDLE = { at: performance.now() };
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { IDLE.at = performance.now(); if (document.body.classList.contains('arrival') && ev !== 'wheel') endArrival(); }, { passive: true }));
const TOUCH = matchMedia('(pointer: coarse)').matches;
const RITE = { on: false };
const fmtN = n => Number(n).toLocaleString('en-US');
const buzz = ms => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { } };
const gateOpen = n => ME.gate >= n;
const GATE_COL = { yellow: 'var(--yellow)', cyan: 'var(--cyan)', magenta: 'var(--magenta)' };
const spaceOf = g => g.gift;

/* ---------- small things far away rest, and a few groups are merged so the phone draws less ---------- */
const FAR = [];
function restFar() {
  const cp = camera.position;
  for (const f of FAR) { const show = cp.distanceTo(f[1]) < f[2]; if (f[0].visible !== show) f[0].visible = show; }
  const t = performance.now() / 1000; for (const id in BEACONS) { const b = BEACONS[id]; if (b.visible) { const k = 0.55 + 0.45 * Math.sin(t * 2.4 + b.userData.ph); b.material.opacity = 0.35 + 0.5 * k; b.scale.setScalar(2.4 + 1.2 * k); } }
}
// a beacon over the place of each event, once a camp lead has set its date
const BEACONS = {};
function updateBeacons() {
  const ev = LIVE.leads.events || {};
  DATA.events.forEach((e, i) => { const on = !!ev[e.id]; let b = BEACONS[e.id];
    if (on && !b) { const bx = boxFor(e.where); if (!bx || bx.isEmpty()) return; const c = bx.getCenter(V3()); c.y = bx.max.y + 2.4;
      b = BEACONS[e.id] = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: [0xffd81f, 0x14a8e0, 0xd8197f][i % 3], transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      b.position.copy(c); b.userData.ph = i * 1.7; b.userData.pick = e.id; scene.add(b); PICKABLE.push(b); }
    if (b) b.visible = on; });
}
{ // the bakkie: one mesh per material
  const byMat = new Map();
  bakkie.children.slice().forEach(m => { if (!m.isMesh) return; m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(g); bakkie.remove(m); });
  for (const [mat, list] of byMat) { const mm = new THREE.Mesh(mergeGeometries(list, false), mat); mm.castShadow = true; mm.userData.pick = 'YARD'; bakkie.add(mm); }
}
{ // the lanterns: posts, cages and caps merged; each lamp stays its own, so it can light alone
  const b = new Bucket(), ids = DATA.gates.map(g => g.id);
  for (const id of ids) { const grp = GATES[id]; grp.updateMatrixWorld(true);
    grp.children.slice().forEach(m => { if (m.material === grp.userData.lamp) return; b.add(m.geometry, m.material, m.matrixWorld.clone()); grp.remove(m); }); }
  const merged = b.build(null);
  const nearest = h => { let best = ids[0], bd = 1e9; for (const id of ids) { const d = Math.abs(GATES[id].userData.c.x - h.point.x) + Math.abs(GATES[id].userData.c.z - h.point.z); if (d < bd) { bd = d; best = id; } } return best; };
  merged.traverse(o => { if (o.isMesh) { o.userData.pick = null; o.userData.pickAt = nearest; PICKABLE.push(o); } });
}
function updateLanterns(night = nightK) {
  DATA.gates.forEach(g => { const grp = GATES[g.id]; if (!grp) return; const open = ME.gate >= g.n;
    grp.userData.lamp.emissiveIntensity = open ? 0.9 + 2.4 * night : 0.04 + 0.35 * night;
    if (grp.userData.glow) { grp.userData.glow.userData.lit = open ? 1 : 0.18; grp.userData.glow.material.opacity = night * grp.userData.glow.userData.k * grp.userData.glow.userData.lit; grp.userData.glow.visible = grp.userData.glow.material.opacity > 0.004; } });
}

/* ---------- the shared temple: the artifact's database, when this view has one ---------- */
const LIVE = { on: false, write: null, admin: false, uid: null, db: null, builders: [], hearth: [], news: [], confirm: {}, leads: {}, fire: [], signups: [], q: new Map(), busy: new Set() };
function writeDoc(path, data, merge = false) {          // one write at a time per document, the latest wins
  if (!LIVE.db || LIVE.write === false) return Promise.resolve(false);
  LIVE.q.set(path, { data, merge });
  if (LIVE.busy.has(path)) return Promise.resolve(true);
  LIVE.busy.add(path);
  return (async () => { try { while (LIVE.q.has(path)) { const { data: d, merge: m } = LIVE.q.get(path); LIVE.q.delete(path); const ref = LIVE.db.doc(path);
        try { if (m) { const cur = await ref.get(); await ref.set(Object.assign({}, cur.exists ? cur.data() : {}, d)); } else await ref.set(d); }
        catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'not_granted')) { LIVE.write = false; onLive(); return false; } if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); LIVE.q.set(path, LIVE.q.get(path) || { data: d, merge: m }); } else console.warn('db write', path, e && e.code); } }
      return true; } finally { LIVE.busy.delete(path); } })();
}
const delDoc = path => LIVE.db ? LIVE.db.doc(path).delete().catch(e => console.warn('db delete', e && e.code)) : null;
function pushMe() {
  if (!LIVE.uid || LIVE.write === false) return;
  const q = {}; for (const k in ME.quests) q[k] = (ME.quests[k].steps || []).map(Boolean);
  writeDoc('builders/' + LIVE.uid, { name: ME.show ? String(ME.name || '').slice(0, 40) : '', card: DKX.kept || null, crew: ME.crew || null, door: !!ME.door, from: ME.from || null, quests: q, at: Date.now() });
  const o = Object.assign({}, ME); delete o.book; delete o.contact; writeDoc('data/users/' + LIVE.uid + '/me', o);
}
function pushBook(entry) { if (!LIVE.uid || LIVE.write === false) return; writeDoc('data/users/' + LIVE.uid + '/me/book/' + entry.id, entry); }
function pushSignup(o) { HOOK7.signup.forEach(f => { try { f(o); } catch (e) { console.warn(e); } }); if (!LIVE.uid || LIVE.write === false) return Promise.resolve(false); return writeDoc('signups/' + LIVE.uid, Object.assign({ at: Date.now() }, o), true); }
async function startLive() {
  const C = window.claude; if (!C || typeof C.use !== 'function') return;
  let db = null, user = null;
  try { [db, user] = await Promise.all([C.use('db'), C.use('user')]); } catch (e) { return; }
  if (!db) return;
  LIVE.db = db; LIVE.on = true;
  if (user) { try { LIVE.uid = await user.id(); } catch (e) { } try { LIVE.admin = !!(await user.canEdit()); } catch (e) { } try { const w = await user.can('data.write'); if (w === false) LIVE.write = false; } catch (e) { } }
  const sub = (path, fn) => { try { db.collection(path).onSnapshot(fn, e => console.warn('db', path, e && e.code)); } catch (e) { console.warn(e); } };
  const rows = snap => snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  sub('builders', s => { LIVE.builders = rows(s); onLive(); });
  sub('hearth', s => { LIVE.hearth = rows(s).sort((a, b) => (b.at || 0) - (a.at || 0)); onLive(); });
  sub('news', s => { LIVE.news = rows(s).sort((a, b) => (b.at || 0) - (a.at || 0)); onLive(); });
  sub('confirm', s => { LIVE.confirm = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); onLive(); });
  sub('leads', s => { LIVE.leads = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); onLive(); });
  if (LIVE.admin) { sub('fire', s => { LIVE.fire = rows(s).sort((a, b) => (a.at || 0) - (b.at || 0)); onLive(); }); sub('signups', s => { LIVE.signups = rows(s); onLive(); }); }
  if (LIVE.uid) {
    try { const mine = await db.doc('data/users/' + LIVE.uid + '/me').get(); if (mine.exists) { const d = mine.data(); /* v7 me: your name comes back on a new device */ if (!String(ME.name || '').trim() && typeof d.name === 'string' && d.name.trim()) { ME.name = d.name.replace(/\s+/g, ' ').trim().slice(0, 40); if (d.show === true) ME.show = true; } for (const k of ['gate', 'door', 'crew', 'crewOk', 'lines', 'from']) if (d[k] != null && ME[k] == null || (k === 'gate' && d.gate > ME.gate)) ME[k] = d[k]; ME.done = Object.assign({}, d.done || {}, ME.done); ME.quests = Object.assign({}, d.quests || {}, ME.quests); ME.test = Object.assign({}, d.test || {}, ME.test); } } catch (e) { }
    try { const bk = await db.collection('data/users/' + LIVE.uid + '/me/book').get(); const have = new Set(ME.book.map(b => b.id)); bk.docs.forEach(d => { if (!have.has(d.id)) ME.book.push(d.data()); }); ME.book.sort((a, b) => a.at - b.at); } catch (e) { }
    saveMe(); pushMe(); ME.book.forEach(pushBook);
  }
  onLive();
  V5_LIVE.forEach(f => { try { f(db); } catch (e) { console.warn(e); } });
}
function sharedLight() {
  const B = LIVE.builders; let n = B.filter(b => b.door).length + LIVE.hearth.length + (+(LIVE.leads.ledger && LIVE.leads.ledger.gifts) || 0);
  for (const uid in LIVE.confirm) { const c = LIVE.confirm[uid] || {}; for (const k in c) if (/^Q-/.test(k) && Array.isArray(c[k])) n += c[k].filter(Boolean).length; }
  return n;
}
const sharedMode = () => LIVE.on && LIVE.builders.length + LIVE.hearth.length > 0 || (LIVE.on && LIVE.write !== false);
function litNow() { return sharedMode() ? sharedLight() : myLight(); }
const liveBuilders = () => LIVE.builders.filter(b => b.door).length;
const questTakers = qid => LIVE.builders.filter(b => b.quests && b.quests[qid]).length;
function onLive() {
  const mine = LIVE.uid && LIVE.confirm[LIVE.uid];
  if (mine && mine.crew && mine.crew === ME.crew && !ME.crewOk) { ME.crewOk = true; saveMe(); toast(`You are on the ${CREW_BY(ME.crew).name} now.`); }
  refreshLight(); renderBell(); renderKpis(); updateNextUp(); updateBeacons(); renderRaise(); if (['events', 'quests', 'crews'].includes(tab)) renderTabs();
  if (!$('#pathModal').hidden) renderPath();
  if (fire.on && !fire.piece && !DKX.on) renderCircle();
}

/* ---------- the panels light ---------- */
function raiseNow() { if (HOOK7.raised) { try { const r = HOOK7.raised(); if (r && +r.target) return r; } catch (e) { console.warn(e); } } const L = LIVE.leads.ledger || {}, t = +L.target || 0; return t ? { raised: Math.max(0, +L.raised || 0), target: t, cur: L.cur === '$' ? '$' : 'R' } : CONFIG.raise; }
function budgetBar(full = false) {
  const R0 = raiseNow(), t = +R0.target || 0;
  if (!t) return full ? '<p class="note">The target for The Seed is being set.</p>' : '';
  const r = Math.max(0, +R0.raised || 0), c = R0.cur === '$' ? '$' : 'R';
  return `<div class="livebar"><div class="lab"><span>Raised for The Seed</span><span class="mono">${money(r, c)} of ${money(t, c)}</span></div><div class="bar"><span style="width:${Math.min(100, r / t * 100).toFixed(1)}%"></span></div>${full ? '<small class="note">Entered by the camp\'s accounts keeper: camp fees and donations, in one pool.</small>' : ''}</div>`;
}
function refreshLight(celebrate = true) {
  const n = litNow(), shown = Math.min(PANELS_N, n), was = LIT.shown;
  LIT.count.value = shown; LIT.shown = shown; LM.dirty = true; starDecal.material.opacity = nightK * litFrac();
  renderKpis();
}
function renderKpis() {
  const n = litNow(); $('#kpiLit').textContent = fmtN(Math.min(PANELS_N, n));
  $('#kpiLitBy').textContent = sharedMode() ? `by ${fmtN(liveBuilders())} temple builder${liveBuilders() === 1 ? '' : 's'}` : 'by you, in this browser';
  const g = GATE_BY(ME.gate); $('#kpiPath').textContent = `Gate ${ME.gate}`;
  const nx = nextStep(); $('#kpiPathNext').textContent = nx ? nx.label : g.name;
}
$('#kpiLitCard').addEventListener('click', () => select('TEMPLE'));
$('#kpiPathCard').addEventListener('click', () => openPath());

/* ---------- your next step: the first step not yet done on your stage, then the next gate ---------- */
const AUTO = { '1:line': () => (ME.lines || 0) > 0, '3:week': () => (ME.week || []).length > 0, '4:crew': () => !!ME.crewOk, '4:quest': () => Object.keys(ME.quests).length > 0, '4:panel': () => myLight() > 0 };
const stepDone = (g, k) => isDone(g, k) || !!(AUTO[g + ':' + k] && AUTO[g + ':' + k]());
const STEP_ACT = {
  '0:teaser': () => playTeaser(), '0:story': () => startStory(0), '0:tour': () => startTour(), '0:book': () => openBook(0), '0:portal': () => goPortal(),
  '1:sit': () => openFireside(), '1:read': () => openFireside(), '1:draw': () => openFireside('deck'), '1:line': () => openWrite('line', 1),
  '2:enter': () => select('MAHAL_COIL'), '2:coil': () => select('MAHAL_COIL'), '3:circle': () => select('CAMP'), '3:lnt': () => select('CAMP'), '3:call': () => { handoff('call'); markDone(3, 'call'); }, '3:week': () => openJoin('camp', null, 'touch'),
  '4:zome': () => select('CENTRE'), '4:crew': () => { tab = 'crews'; renderTabs(); select(ME.crew || 'CR-1'); }, '4:quest': () => { tab = 'quests'; renderTabs(); select('Q-01'); },
  '5:host': () => shareInvite(), '6:beyond': () => goBeyond(6), '6:vision': () => goBeyond(6), '7:city': () => goBeyond(7),
};
function nextStep() {
  for (let g = Math.min(ME.gate, PATHS.length - 1); g >= 0; g--) { const st = PATHS[g].steps.find(([k]) => !stepDone(g, k) && STEP_ACT[g + ':' + k]); if (st) return { gate: g, key: st[0], label: st[1], run: STEP_ACT[g + ':' + st[0]] }; }
  if (ME.gate < 7) { const g = GATE_BY(ME.gate + 1); return { gate: g.n, key: 'gate', label: `Gate ${g.n}: ${g.name.replace(/^The /, 'the ')}`, run: () => showGate(g.n) }; }
  return null;
}
function onPathChange() { renderKpis(); updateNextUp(); markBadge(); if (['gates', 'quests', 'crews'].includes(tab)) renderTabs(); if (!$('#pathModal').hidden) renderPath(); if (!current && !inside && !story.on && !fire.on) showWelcome(); }
function updateNextUp() {
  const wk = LIVE.leads.week && DATA.quests.find(q => q.id === LIVE.leads.week.quest), nx = nextStep(), b = $('#nextUp');
  if (wk) { b.innerHTML = `<span class="eyebrow">Quest of the week</span><span class="row1"><span class="ic">${icon('pin')}</span><span><b>${esc(wk.name)}</b><small>${esc(wk.crew)} · ${questTakers(wk.id)} on it</small></span></span>`; b.dataset.go = 'sel:' + wk.id; }
  else if (nx) { b.innerHTML = `<span class="eyebrow">Next on your path</span><span class="row1"><span class="ic">${icon('path')}</span><span><b>${esc(nx.label)}</b><small>Gate ${ME.gate}: ${esc(GATE_BY(ME.gate).name)}</small></span></span>`; b.dataset.go = 'next'; }
}
$('#nextUp').replaceWith($('#nextUp').cloneNode(true));
$('#nextUp').addEventListener('click', () => { const g = $('#nextUp').dataset.go || 'next'; if (g.startsWith('sel:')) select(g.slice(4)); else { const nx = nextStep(); if (nx) nx.run(); } });

/* ---------- a gate: what it opens, its gift, and how to pass ---------- */
const GM = $('#gateModal'); let gateThen = null, gateN = 0;
function showGate(n, then = null, intro = '') {
  const g = GATE_BY(n); if (!g) return; gateN = n; gateThen = then; lastFocus = document.activeElement;
  const open = gateOpen(n), col = GATE_COL[g.col] || 'var(--yellow)';
  $('#gateTitle').textContent = `Gate ${n}: ${g.name}`;
  $('#gateBody').innerHTML = `${intro ? `<p class="spine">${esc(intro)}</p>` : ''}
    <div class="gate-hero"><span class="gate-lamp ${open ? '' : 'locked'}" style="background:${col}">${n}</span><div><div class="amount"><b>${esc(g.amount)}</b>${n ? chip('Working figure', 'wait') : ''}${open ? chip('Open for you', 'done') : chip('Not open yet', 'lock')}</div><small class="note">${n ? 'One of seven gates on the path of a temple builder' : 'Where every path begins'}</small></div></div>
    <ul class="opens"><li>${icon('gate')}<span><b>Opens:</b> ${esc(spaceOf(g))}${g.extra ? '. ' + esc(g.extra) : ''}</span></li><li>${icon('gift')}<span><b>Gift:</b> ${esc(g.gift)}</span></li>${g.builds ? `<li>${icon('dome')}<span><b>What it builds:</b> ${esc(g.builds)}</span></li>` : ''}${g.badge ? `<li>${icon('star')}<span><b>Badge:</b> ${esc(g.badge)}</span></li>` : ''}</ul>
    ${g.rd ? '<p class="note">The gifts are also research and development: the gates fund the first batch of pendants, coils and light boxes.</p>' : ''}
    ${n === 5 || g.space === 'zome' ? '<p class="note">A build crew also opens the build yard and the workshop: ask through Join the build.</p>' : ''}
    ${n >= 6 ? `<p class="note">${n === 6 ? 'A vision, not a plan.' : 'A vision, not a plan.'}</p>` : ''}
    <div class="sect"><h4>Your creative work at this gate</h4><p>${esc(PATHS[n].reflect)}</p></div>`;
  $('#gateFoot').innerHTML = `<span class="note strong">${n ? 'Working amounts, not final. No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.' : 'Free, for everyone who is invited.'}</span>
    <button class="btn" data-g="close">Not now</button>
    ${open ? `<button class="btn primary" data-g="go">${icon('gate')}Go there</button>` : `<button class="btn testbtn" data-g="test">${icon('unlock')}Camp lead testing: open Gate ${n}</button><button class="btn primary" data-g="give">${icon('gift')}Give ${esc(g.amount.split(' to ')[0])}</button>`}`;
  GM.hidden = false; setTimeout(() => ($('[data-g="give"]', GM) || $('[data-g="go"]', GM) || $('#gateClose')).focus(), 30);
}
function closeGate() { GM.hidden = true; gateThen = null; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
$('#gateClose').addEventListener('click', closeGate);
GM.addEventListener('click', e => { if (e.target === GM) { closeGate(); return; } const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g, n = gateN, then = gateThen;
  if (k === 'close') closeGate();
  if (k === 'give') give(n);
  if (k === 'test') { GM.hidden = true; testOpen(n, then); }
  if (k === 'go') { GM.hidden = true; if (then) then(); else goGate(n); } });
function give(n) {
  const url = CONFIG.pay[n];
  if (url) { try { window.open(url + (url.includes('?') ? '&' : '?') + 'ref=gate' + n, '_blank', 'noopener'); } catch (e) { } toast('The payment page opened in a new tab. Come back here when it is done.'); }
  else toast('The payment page is not set up yet: the camp is still choosing who runs payments. Camp leads can test with the dashed button.');
}
function testOpen(n, then) {
  const was = ME.gate; ME.gate = Math.max(ME.gate, n); ME.test[n] = Date.now(); saveMe(); pushMe();
  updateLanterns(); renderKpis(); updateNextUp();
  const g = GATE_BY(n); chime('bell'); buzz([20, 40, 20]); markBadge();
  toast(was >= n ? `Gate ${n} was already open.` : `Gate ${n} is open: ${spaceOf(g).toLowerCase()}.${g.badge ? ' Badge: ' + g.badge + '.' : ''}`);
  if (GATES[g.id] && !then) flyTo(REG[g.id].focus(), 1.4);
  if (then) setTimeout(then, 500); else if (!$('#pathModal').hidden) renderPath(); else if (!current) showWelcome();
}
function goGate(n) { ({ 1: () => openFireside(), 2: () => select('MAHAL_COIL'), 3: () => select('CAMP'), 4: () => select('CENTRE'), 5: () => openPath(), 6: () => goBeyond(6), 7: () => goBeyond(7) }[n] || (() => openPath()))(); }

/* ---------- the free path: the teaser, the story, the tour, the book, the portal ---------- */
function playTeaser(over = false) { openFilm('assets/mahala_30s.mp4', 'The Mahala teaser, 30 seconds. Concept visualisation: rendered from the 3D model, with motion added by AI.', true); FM.classList.toggle('over', over); markDone(0, 'teaser'); }
FV.addEventListener('ended', () => markDone(0, 'teaser'));
const TOUR = [
  { title: 'The way in', clock: 18 * 60 + 10, view: () => ({ t: V3(2, 2.6, 0), d: 46, p: 1.3, a: Math.PI / 2 - 0.15 }),
    lines: ['This is The Seed, a zome of coloured glass for AfrikaBurn 2027: a dome of rhombus panels in spiralling rings.', 'You come in from the east, along a path of lanterns.'] },
  { title: 'The gates', clock: 19 * 60 + 40, view: () => ({ t: V3(26, 1.6, 0), d: 30, p: 1.18, a: 0.95 }),
    lines: ['Seven timber gateways cross the way, each with its lantern. Each one is a gate: a way to give, with its own gift.'] },
  { title: 'The glass', clock: 12 * 60 + 20, view: () => ({ t: V3(0, 2.6, 0), d: 26, p: 1.12, a: 0.6 }),
    lines: ['Eight rings of glass in yellow, cyan and magenta. By day the sun paints the floor with them.'] },
  { title: 'The copper forms', clock: 10 * 60, view: () => ({ t: V3(0, 1.2, 0), d: 44, p: 1.02, a: 2.4 }),
    lines: ['Six copper forms ring the temple: the old building blocks of the world, gathered round one centre.'] },
  { title: 'The build yard', clock: 10 * 60 + 30, view: () => ({ t: V3(YARD.x, 1, YARD.z), d: 52, p: 1.0, a: 0.95 }),
    lines: ['Here the frame is cut and the gifts are made.'] },
  { title: 'The camp', clock: 17 * 60 + 40, view: () => ({ t: CAMP.clone().setY(2), d: 64, p: 1.05, a: 2.3 }),
    lines: ['Mahala camp: the Lotus Mahal, Blissfull Drift with its fire, the kitchen and the bell tents.', 'The MAHALA portal is the way in.'] },
  { title: 'The Book of Mahala', clock: 18 * 60 + 30, view: () => ({ t: BOOK_AT.clone().setY(1.0), d: 6, p: 1.12, a: BOOK_RY + 0.3 }),
    lines: ['At the start of the way, on a carved plinth, lies the camp\'s own book: the story of Mahala, its values and its eleven archetypes, each with a card you can draw.'],
    act: ['book', 'book', 'Open the book, then walk to the portal of the camp.', 'Open the book'] },
];
function startTour(i = 0) { startStory(i, TOUR); }
function afterStory() { if (RITE.on) toast('Next on your path: a short tour of the playa.'); }
function afterTour() { openBook(0); }
function goPortal() {
  markDone(0, 'portal'); RITE.on = false; select('CAMP_PORTAL');
  setTimeout(() => showGate(1, () => openFireside(), 'You stand at the portal of the camp. Through it, the fire is lit: the first gate.'), REDUCED ? 50 : 1700);
}

/* ---------- beyond the zome, and the lighthouses ---------- */
function goBeyond(n) {
  const sp = n === 6 ? 'beyond' : 'lighthouse'; if (!canEnter(sp)) { showGate(n, () => goBeyond(n)); return; }
  if (inside) leavePlace(); markDone(n, n === 6 ? 'beyond' : 'city');
  clockAnim = { from: clock, to: 21 * 60 + 40, t0: performance.now(), dur: REDUCED ? 1 : 2600 };
  flyTo(n === 6 ? { t: V3(0, 8, 0), d: 120, p: 0.5, a: 0.8 } : { t: V3(0, 20, 0), d: 360, p: 0.28, a: 0.4 }, 3.2);
  current = null; selBox = null; $('#selLabel').hidden = true;
  setInspector(head('temple', n === 6 ? 'Gate 6 · cosmic architect' : 'Gate 7 · the lighthouses', n === 6 ? 'Beyond the zome' : 'The lighthouse temples', n === 6 ? 'The bigger vision' : 'The much bigger picture') + `<div class="insp-body">
    <p class="spine">${n === 6 ? 'This temple, proposed for AfrikaBurn 2027, could be a first step on a longer road: the temple of 2029, a vision.' : 'A vision: a permanent temple in Cape Town, and lighthouse temples seeded around the world.'}</p>
    <p>${n === 6 ? 'From up here the zome is small: a seed. What grows from it is the work of every builder on this path.' : 'Each lighthouse would be a place to gather, built by its own community of temple builders.'}</p>
    <div class="prompts"><button class="prompt" data-act="write:reflect:${n}"><span class="k">Reflect</span><span>${esc(PATHS[n].reflect)}</span></button><button class="prompt" data-act="write:art:${n}"><span class="k">Draw</span><span>${esc(PATHS[n].art)}</span></button></div><div class="actions"><button class="btn" data-act="path">${icon('path')}Your path</button></div>
    <p class="note">${n === 6 ? 'A vision, not a plan.' : 'A vision, not a plan.'} Shared by the camp as an aim, not a promise.</p></div>`);
}

/* ---------- your path: the ladder, your stage, your book ---------- */
const PM = $('#pathModal'); let pathStage = null;
const BADGE_SVG = '<svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"/><g transform="translate(16 12) scale(2)"><defs><clipPath id="bdg"><path d="M16 3.2c2.6 4.2 10.4 8 10.4 17.3V27H5.6v-6.5C5.6 11.2 13.4 7.4 16 3.2z"/></clipPath></defs><g clip-path="url(#bdg)"><rect width="32" height="13" fill="#FFD81F"/><rect y="13" width="32" height="7" fill="#14A8E0"/><rect y="20" width="32" height="8" fill="#D8197F"/></g><path d="M16 3.2c2.6 4.2 10.4 8 10.4 17.3V27H5.6v-6.5C5.6 11.2 13.4 7.4 16 3.2z" fill="none" stroke="currentColor" stroke-width=".8"/></g></svg>';
function myBadges() { if (HOOK7.gifts) { try { return HOOK7.gifts(); } catch (e) { console.warn(e); } }   /* v7 me: the gifts received */
  const b = []; if (ME.door || store.get('mahala_badge') === '1') b.push(['Temple builder', '']);
  if (ME.crewOk && isBuildCrew(ME.crew)) b.push(['Build crew · legendary', 'legend']);
  DATA.gates.forEach(g => { if (g.badge && ME.gate >= g.n) b.push([g.badge, '']); });
  return b;
}
function openPath(stage = null) { if (HOOK7.openPath) { try { if (HOOK7.openPath(stage) !== false) return; } catch (e) { console.warn(e); } } lastFocus = document.activeElement; pathStage = stage ?? ME.gate; PM.hidden = false; renderPath(); setTimeout(() => $('#pathClose').focus(), 30); }
function closePath() { PM.hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
$('#pathClose').addEventListener('click', closePath);
function renderPath() {
  const a = DKX.kept && ARCH_BY[DKX.kept], st = pathStage ?? ME.gate, open = true, P = PATHS[st], g = GATE_BY(st);
  const entries = ME.book.filter(e => e.gate === st).slice().reverse();
  const myQ = Object.keys(ME.quests);
  $('#pathBody').innerHTML = `<div class="path-head">${a ? `<button class="path-ava" data-p="card" style="background-image:url(${a.src})" aria-label="Your card, ${esc(a.title)}"></button>` : `<span class="path-ava">${icon('star')}</span>`}
      <div style="display:grid;gap:6px;min-width:0"><div class="field" style="gap:4px"><label for="pp-name">Your name or playa name</label><input id="pp-name" value="${esc(ME.name || '')}" autocomplete="off" maxlength="40" placeholder="A name for the temple"></div>
      <label class="check" for="pp-show" style="padding:6px 10px"><input type="checkbox" id="pp-show" ${ME.show ? 'checked' : ''}><span><b>Show my name on the temple</b><small>Off by default. Other builders see it beside your light.</small></span></label></div>
      <div class="badges" style="align-self:start">${myBadges().map(([t, c]) => `<span class="badgechip ${c}"><i></i>${esc(t)}</span>`).join('') || '<span class="note">Badges appear as you walk the path.</span>'}</div></div>
    <div class="stage-card ${open ? '' : 'locked'}"><div><span class="eyebrow">Gate ${st} · ${esc(P.feel)}</span><h4>${esc(g.name)}</h4></div>
      ${open ? '' : `<div class="lockrow">${icon('lock')}<span><b>Opens at Gate ${st}</b><small>${esc(g.amount)}, working figure. ${esc(g.gift)}.</small></span><button class="btn" data-p="gate:${st}">See the gate</button></div>`}
      <div class="ticks">${P.steps.map(([k, label]) => { const dn = stepDone(st, k), act = STEP_ACT[st + ':' + k]; return `<button class="tick ${dn ? 'on' : ''}" data-p="${act ? 'do' : 'tick'}:${st}:${k}" ${open ? '' : 'disabled'}><span class="bx">${dn ? icon('check') : ''}</span>${esc(label)}${act && !dn ? ` <span class="note">· ${TOUCH ? 'tap' : 'click'} to go</span>` : ''}</button>`; }).join('')}</div>
      <div class="prompts">${[['reflect', 'Reflect', P.reflect], ['poem', 'A poem', P.poem], ['art', 'Draw', P.art]].map(([k, t, p]) => `<button class="prompt" data-p="write:${k}:${st}" ${open ? '' : 'disabled'}><span class="k">${t}</span><span>${esc(st === 1 && k === 'reflect' && a && a.q ? a.q : p)}</span></button>`).join('')}</div>
      ${entries.length ? `<div class="entries">${entries.map(e => `<div class="entry"><small>${esc({ reflect: 'Reflection', poem: 'Poem', art: 'Drawing', line: 'A line for the fire' }[e.kind] || 'Note')} · ${new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${e.fire ? ' · offered to the fire' : ''}</small>${e.img ? `<img src="${e.img}" alt="Your drawing: ${esc(e.prompt)}">` : ''}${e.text ? `<p>${esc(e.text)}</p>` : ''}</div>`).join('')}</div>` : ''}
    </div>
    <div class="sect"><h4>Your crew and quests</h4>
      <p>${ME.crew ? `${esc(CREW_BY(ME.crew).name)}: ${ME.crewOk ? 'you are on this crew' : 'asked to join, waiting for a steward'}` : 'No crew yet. Join one at the camp.'}${a && ARCH_CREW[a.key] ? ` Your card, ${esc(a.title)}, is needed in the ${esc(CREW_BY(ARCH_CREW[a.key][0]).name)}.` : ''}</p>
      ${myQ.length ? links(myQ.map(q => [q, q, DATA.quests.find(x => x.id === q).name + ` · ${(ME.quests[q].steps || []).filter(Boolean).length} of 3 steps`])) : ''}</div>
    <div class="sect"><h4>The gates</h4><div class="ladder">${[GATE0, ...DATA.gates].map(x => `<button class="rung ${ME.gate >= x.n ? 'open' : ''} ${x.n === st ? 'here' : ''}" data-p="stage:${x.n}"><span class="n" style="${ME.gate >= x.n ? `background:${GATE_COL[x.col]}` : ''}">${x.n}</span><span><b>${esc(x.name)}</b><small>${esc(!x.n ? 'The teaser, the story, the tour and the book' : spaceOf(x) === x.name ? x.gift : spaceOf(x))}</small></span><span class="amt">${esc(x.amount)}<br>${ME.gate >= x.n ? chip('Open', 'done') : chip('Locked', 'lock')}</span></button>`).join('')}</div></div>
    <div class="sect ph-only"><h4>From the camp</h4><div class="hearth">${(LIVE.bell || []).slice(0, 3).map(i => `<p style="font-size:15px">${esc(i.t)}<br><small>${esc(i.s)}</small></p>`).join('')}</div></div>
    ${leadTools()}
    <div class="sect"><h4>Prototype testing</h4><div class="actions"><button class="btn testbtn" data-p="reset">Reset my path in this browser</button>${ME.crew && !ME.crewOk ? `<button class="btn testbtn" data-p="crewok">Camp lead testing: accept my crew</button>` : ''}</div></div>`;
  $('#pathFoot').innerHTML = `<span class="note">Prompts are drafts for the camp to shape. Your book is private: it stays in this browser, and in your own space in the shared database when you are signed in.</span><button class="btn" data-p="download">${icon('save')}Download my book</button><button class="btn primary" data-p="close">Close</button>`;
}
PM.addEventListener('change', e => {
  if (e.target.id === 'pp-show') { ME.show = e.target.checked; saveMe(); pushMe(); }
});
PM.addEventListener('input', e => { if (e.target.id === 'pp-name') { ME.name = e.target.value.slice(0, 40); saveMe(); clearTimeout(PM._t); PM._t = setTimeout(pushMe, 900); } });
PM.addEventListener('click', e => {
  if (e.target === PM) { closePath(); return; }
  const sl = e.target.closest('[data-sel]'); if (sl) { closePath(); select(sl.dataset.sel); return; }
  const b = e.target.closest('[data-p]'); if (!b) return; const [k, x, y] = b.dataset.p.split(':');
  if (k === 'close') closePath();
  if (k === 'stage') { pathStage = +x; renderPath(); }
  if (k === 'card' && DKX.kept) { closePath(); openFireside('ARCH_' + DKX.kept.toUpperCase(), 'kept'); }
  if (k === 'gate') { closePath(); showGate(+x); }
  if (k === 'do') { closePath(); STEP_ACT[x + ':' + y](); }
  if (k === 'tick') { if (isDone(+x, y)) { delete ME.done[x + ':' + y]; saveMe(); } else markDone(+x, y); renderPath(); }
  if (k === 'write') { openWrite(x, +y); }
  if (k === 'download') downloadBook();
  if (k === 'reset') { if (b.dataset.sure) { const keep = ME.book; Object.assign(ME, { gate: 0, test: {}, door: null, crew: null, crewOk: false, quests: {}, done: {}, lines: 0 }); ME.book = keep; store.set('mahala_badge', ''); saveMe(); pushMe(); updateLanterns(); refreshLight(false); renderPath(); toast('Your path starts again at Gate 0. Your book is kept.'); } else { b.dataset.sure = '1'; b.textContent = 'Sure? Tap again to reset'; } }
  if (k === 'crewok') { ME.crewOk = true; saveMe(); pushMe(); renderPath(); toast(`You are on the ${CREW_BY(ME.crew).name} now (testing).`); }
  if (k === 'lead') leadAction(x, y, b);
});
$('#youBtn').addEventListener('click', () => openPath());
{ const who = $('.who'); who.addEventListener('click', e => { e.stopImmediatePropagation(); openPath(); }, true); who.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); openPath(); } }, true); }

/* ---------- camp lead tools: for editors of the published page ---------- */
function leadTools(inPanel) {
  if (!LIVE.admin) return '';
  if (!inPanel && HOOK7.stewardTools) { try { const r = HOOK7.stewardTools(); if (r != null) return r; } catch (e) { console.warn(e); } }
  const pending = LIVE.fire.filter(f => f.text);
  const reqs = LIVE.builders.filter(b => b.crew && !(LIVE.confirm[b.id] && LIVE.confirm[b.id].crew === b.crew));
  const steps = []; LIVE.builders.forEach(b => { for (const q in (b.quests || {})) { if (!DATA.quests.some(x => x.id === q) || !Array.isArray(b.quests[q])) continue; b.quests[q].slice(0, 12).forEach((v, i) => { const c = (LIVE.confirm[b.id] || {})[q] || []; if (v && !c[i]) steps.push([b, q, i]); }); } });
  const nm = b => esc(b.name || 'A builder');
  return `<div class="lead-tools"><span class="eyebrow">Stewards' tools · only stewards see these</span>
    <div class="sect"><h4>Lines waiting at the fire (${pending.length})</h4>${pending.map(f => `<div class="row2"><span>"${esc(f.text)}" <small class="note">${esc(f.name || 'no name shown')}${f.card ? ' · ' + esc(ARCH_BY[f.card]?.title || '') : ''}</small></span><button class="btn" data-p="lead:approve:${f.id}">Approve</button><button class="btn" data-p="lead:decline:${f.id}">Decline</button></div>`).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="sect"><h4>Crew requests (${reqs.length})</h4>${reqs.map(b => `<div class="row2"><span>${nm(b)} asks to join the ${esc(CREW_BY(b.crew)?.name || b.crew)}</span><button class="btn" data-p="lead:crew:${b.id}">Accept</button></div>`).join('') || '<p class="note">No requests.</p>'}</div>
    <div class="sect"><h4>Quest steps to confirm (${steps.length})</h4>${steps.slice(0, 20).map(([b, q, i]) => `<div class="row2"><span>${nm(b)} · ${esc(q)} step ${i + 1}: ${esc(DATA.quests.find(x => x.id === q)?.steps[i] || '')}</span><button class="btn" data-p="lead:step:${esc(b.id)}|${esc(q)}|${i}">Confirm</button></div>`).join('') || '<p class="note">Nothing to confirm.</p>'}</div>
    <div class="sect"><h4>Post to the bell</h4><div class="field"><input id="ld-news" placeholder="A short update for every builder" maxlength="140"></div><div class="actions"><button class="btn" data-p="lead:news">Post</button></div></div>
    <div class="sect"><h4>Quest of the week and the fire night</h4><div class="row2"><select id="ld-week" class="btn" style="height:36px">${DATA.quests.map(q => `<option value="${q.id}" ${LIVE.leads.week && LIVE.leads.week.quest === q.id ? 'selected' : ''}>${esc(q.name)}</option>`).join('')}</select><button class="btn" data-p="lead:week">Set</button></div>
      <div class="field"><input id="ld-firenight" placeholder="Next fire night, for example: Sunday 7 pm, a verse from a camp mate" value="${esc((LIVE.leads.firenight && LIVE.leads.firenight.text) || '')}" maxlength="140"></div><div class="actions"><button class="btn" data-p="lead:firenight">Set the fire night</button></div></div>
    <div class="sect"><h4>The budget, from the accounts</h4>${(() => { const L = LIVE.leads.ledger || {}; return `<div class="row2"><span>Gifts received (a count, each lights one panel)</span><input id="ld-gifts" type="number" min="0" step="1" class="btn" style="height:36px;width:120px" value="${+L.gifts || 0}"></div>
      <div class="row2"><span>Raised so far, camp fees and donations in one pool</span><input id="ld-raised" type="number" min="0" step="0.01" class="btn" style="height:36px;width:140px" value="${L.raised != null && L.raised !== '' ? +L.raised || 0 : +CONFIG.raise.raised || 0}"></div>
      <div class="row2"><span>Target for The Seed</span><input id="ld-target" type="number" min="0" step="0.01" class="btn" style="height:36px;width:140px" value="${+L.target || +CONFIG.raise.target || 0}"></div>
      <div class="row2"><span>Currency</span><select id="ld-cur" class="btn" style="height:36px"><option value="R" ${L.cur !== '$' ? 'selected' : ''}>Rand (R)</option><option value="$" ${L.cur === '$' ? 'selected' : ''}>Dollars ($)</option></select><button class="btn" data-p="lead:gifts">Save the budget</button></div>`; })()}</div>
    <div class="sect"><h4>Event dates</h4>${DATA.events.map(ev => `<div class="row2"><span>${esc(ev.name)}</span><input class="btn" style="height:36px" data-ev="${ev.id}" placeholder="To be announced" value="${esc((LIVE.leads.events || {})[ev.id] || '')}" maxlength="60"></div>`).join('')}<div class="actions"><button class="btn" data-p="lead:events">Save the dates</button></div></div>
    <div class="sect"><h4>Follow-ups for the members board (${LIVE.signups.length})</h4><div class="actions"><button class="btn" data-p="lead:signups">Download the follow-ups</button></div><p class="note">Camp yeses, maybes, gate choices and the next-year list. Copy them into the members board, the camp's one source of truth. Only stewards can read contact details.</p></div></div>`;
}
async function leadAction(k, arg, btn) {
  const now = Date.now(); btn.disabled = true;
  try {
    if (k === 'approve') { const f = LIVE.fire.find(x => x.id === arg); if (f) { await LIVE.db.collection('hearth').add({ text: f.text, card: f.card || null, name: f.name || '', at: now }); await delDoc('fire/' + arg); } }
    if (k === 'decline') await delDoc('fire/' + arg);
    if (k === 'crew') { const b = LIVE.builders.find(x => x.id === arg); if (b) await writeDoc('confirm/' + arg, { crew: b.crew }, true); }
    if (k === 'step') { const [uid, q, i] = arg.split('|'); if (DATA.quests.some(x => x.id === q) && +i >= 0 && +i < 12) { const c = ((LIVE.confirm[uid] || {})[q] || [false, false, false]).slice(); c[+i] = true; await writeDoc('confirm/' + uid, { [q]: c }, true); } }
    if (k === 'news') { const t = $('#ld-news').value.trim(); if (t) { await LIVE.db.collection('news').add({ text: t, at: now }); $('#ld-news').value = ''; toast('Posted to the bell.'); } }
    if (k === 'week') await writeDoc('leads/week', { quest: $('#ld-week').value, at: now });
    if (k === 'firenight') await writeDoc('leads/firenight', { text: $('#ld-firenight').value.trim(), at: now });
    if (k === 'gifts') { const n = id => Math.max(0, Math.round((+$(id).value || 0) * 100) / 100); await writeDoc('leads/ledger', { gifts: n('#ld-gifts'), raised: n('#ld-raised'), target: n('#ld-target'), cur: $('#ld-cur').value === '$' ? '$' : 'R', at: now }); toast('The budget is saved.'); }
    if (k === 'events') { const o = { at: now }; $$('[data-ev]', (btn && btn.closest('.lead-tools')) || PM).forEach(i => { o[i.dataset.ev] = i.value.trim(); }); await writeDoc('leads/events', o); toast('Dates saved.'); }
    if (k === 'signups') { const out = []; LIVE.signups.forEach(p => Object.keys(p).filter(x => x.startsWith('d_')).forEach(x => { const s = p[x] || {}; out.push([s.door === 'back' ? 'support' : s.door, s.camp || '', s.name || p.name || '', s.based || '', s.heard || '', s.contact || p.contact || '', (s.consent || p.consent) ? 'yes' : 'no', (s.skills || []).join(' '), (s.when || []).join('; '), s.rate || '', s.parts || '', s.gate || '', s.change || '', s.by || '', s.call || '', s.nextYear ? 'yes' : '', (t => (t > 0 && t < 8.64e15 ? new Date(t).toISOString().slice(0, 10) : ''))(+(s.at || p.at) || 0)]); }));
      const rows = [['door', 'camp', 'name', 'based', 'heard', 'contact', 'consent', 'skills', 'when', 'rate', 'instalments', 'gate', 'what would change it', 'by when', 'call', 'next year', 'date']].concat(out);
      await saveFile('mahala-follow-ups.csv', rows.map(r => r.map(v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; }).join(',')).join('\n')); }
  } catch (e) { console.warn(e); toast('That did not save. Try again in a moment.'); }
  btn.disabled = false;
}

/* ---------- your book: write, draw, keep, and offer a line to the fire ---------- */
const WM = $('#writeModal'); let W = null;
const KIND_T = { reflect: 'A reflection', poem: 'A poem', art: 'A drawing', line: 'A line for the fire' };
function openWrite(kind, gate = ME.gate) {
  /* v7 me: with the dashboard, every gate's prompts are open */ if (!HOOK7.openPath) if (gate > ME.gate) { showGate(gate); return; }
  if (kind === 'line' && !canEnter('fire')) { showGate(1, () => openWrite(kind, gate)); return; }
  const P = PATHS[gate] || PATHS[0], a = DKX.kept && ARCH_BY[DKX.kept];
  const prompt = kind === 'line' ? (a && a.q ? a.q : 'Leave one line for the fire: a hope, a thanks, or what your card asked of you.') : kind === 'reflect' && gate === 1 && a && a.q ? a.q : P[kind];
  W = { kind, gate, prompt }; lastFocus = document.activeElement;
  $('#writeTitle').textContent = KIND_T[kind] || 'Your book';
  $('#writeBody').innerHTML = `<p class="spine">${esc(prompt)}</p>
    ${kind === 'art' ? `<div class="sketch"><canvas id="skCv" width="800" height="600" aria-label="A sketch pad"></canvas><div class="tools">${['#27211C', '#FFD81F', '#14A8E0', '#D8197F', '#B87333', '#fbf7ef'].map((c, i) => `<button class="sw" data-sw="${c}" aria-label="${['Ink', 'Yellow', 'Cyan', 'Magenta', 'Copper', 'Eraser'][i]}" aria-pressed="${i === 0}" style="background:${c};${i === 5 ? 'box-shadow:inset 0 0 0 1px var(--card-line)' : ''}"></button>`).join('')}<button class="btn" data-sk="thin" style="height:32px">Fine</button><button class="btn" data-sk="thick" style="height:32px">Bold</button><button class="btn" data-sk="undo" style="height:32px">Undo</button><button class="btn" data-sk="clear" style="height:32px">Clear</button></div></div>
      <div class="field"><label for="wr-text">A few words about it (optional)</label><input id="wr-text" maxlength="200"></div>`
    : `<div class="field"><label for="wr-text">${kind === 'line' ? 'One line' : 'Write freely'}</label><textarea id="wr-text" maxlength="${kind === 'line' ? 160 : 4000}"></textarea></div>`}
    ${kind === 'line' ? '<p class="note">Your line waits for a camp mate to read it, then it joins the lines at the fire. It is shown with your playa name only if you chose to show it.</p>' : ''}`;
  const toFire = kind !== 'art' && gate >= 1 && kind !== 'line';
  $('#writeFoot').innerHTML = `<span class="note">Kept in your own book. Only you can read it.</span><button class="btn" data-w="close">Not now</button>${toFire && canEnter('fire') ? `<button class="btn" data-w="fire">${icon('flame')}Keep it, and offer a line to the fire</button>` : ''}<button class="btn primary" data-w="${kind === 'line' ? 'fire' : 'keep'}">${icon(kind === 'line' ? 'flame' : 'book')}${kind === 'line' ? 'Leave it at the fire' : 'Keep it in my book'}</button>`;
  WM.hidden = false; if (kind === 'art') sketchInit(); setTimeout(() => $('#wr-text').focus(), 40);
}
function closeWrite() { WM.hidden = true; W = null; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
$('#writeClose').addEventListener('click', closeWrite);
WM.addEventListener('click', e => {
  if (e.target === WM) { closeWrite(); return; }
  const sw = e.target.closest('[data-sw]'); if (sw) { SK.col = sw.dataset.sw; $$('[data-sw]', WM).forEach(x => x.setAttribute('aria-pressed', String(x === sw))); return; }
  const sk = e.target.closest('[data-sk]'); if (sk) { const k = sk.dataset.sk; if (k === 'thin') SK.w = 3; if (k === 'thick') SK.w = 12; if (k === 'undo' && SK.hist.length) SK.g.putImageData(SK.hist.pop(), 0, 0); if (k === 'clear') { sketchSnap(); SK.g.fillStyle = '#fbf7ef'; SK.g.fillRect(0, 0, 800, 600); } return; }
  const b = e.target.closest('[data-w]'); if (!b || !W) return; const k = b.dataset.w;
  if (k === 'close') { closeWrite(); return; }
  const text = ($('#wr-text').value || '').trim(); const img = W.kind === 'art' && SK.dirty ? SK.cv.toDataURL('image/jpeg', 0.72) : null;
  if (!text && !img) { toast(W.kind === 'art' ? 'Draw something first.' : 'Write something first.'); return; }
  const entry = { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), gate: W.gate, kind: W.kind, prompt: W.prompt, text, img, at: Date.now(), fire: k === 'fire' };
  ME.book.push(entry); saveMe(); pushBook(entry);
  if (k === 'fire') { const line = W.kind === 'line' ? text : text.split('\n').map(s => s.trim()).filter(Boolean)[0] || text; offerLine(line.slice(0, 160)); }
  else toast('Kept in your book.');
  chime('soft'); closeWrite(); if (!PM.hidden) renderPath();
});
function offerLine(text) {
  ME.lines = (ME.lines || 0) + 1; saveMe(); markDone(1, 'line');
  if (LIVE.uid && LIVE.write !== false) { writeDoc('fire/' + LIVE.uid, { text, card: DKX.kept || null, name: ME.show ? ME.name || '' : '', at: Date.now() }); toast('Your line is at the fire, waiting for a steward to read it.'); }
  else toast('Your line is kept in this browser. In the shared Mahalaverse it would wait for a steward to read it.');
  refreshLight();
}
const SK = { cv: null, g: null, col: '#27211C', w: 5, hist: [], dirty: false, down: false, last: null };
function sketchSnap() { SK.hist.push(SK.g.getImageData(0, 0, 800, 600)); if (SK.hist.length > 15) SK.hist.shift(); }
function sketchInit() {
  SK.cv = $('#skCv'); SK.g = SK.cv.getContext('2d'); SK.g.fillStyle = '#fbf7ef'; SK.g.fillRect(0, 0, 800, 600); SK.hist = []; SK.dirty = false; SK.col = '#27211C'; SK.w = 5;
  SK.g.lineCap = 'round'; SK.g.lineJoin = 'round';
  const at = e => { const r = SK.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 800, (e.clientY - r.top) / r.height * 600]; };
  SK.cv.onpointerdown = e => { SK.cv.setPointerCapture(e.pointerId); sketchSnap(); SK.down = true; SK.last = at(e); SK.g.beginPath(); SK.g.fillStyle = SK.col; SK.g.arc(SK.last[0], SK.last[1], SK.w / 2, 0, Math.PI * 2); SK.g.fill(); SK.dirty = true; };
  SK.cv.onpointermove = e => { if (!SK.down) return; const p = at(e); SK.g.strokeStyle = SK.col; SK.g.lineWidth = SK.w * (e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure : 1); SK.g.beginPath(); SK.g.moveTo(...SK.last); SK.g.lineTo(...p); SK.g.stroke(); SK.last = p; };
  SK.cv.onpointerup = SK.cv.onpointercancel = () => { SK.down = false; };
}
async function saveFile(filename, data) {
  try { const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename, data }); return true; } } catch (e) { if (e && e.code === 'cancelled') return false; }
  try { const u = URL.createObjectURL(new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : 'text/html' })); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return true; } catch (e) { toast('Saving files is not available here.'); return false; }
}
function downloadBook() {
  if (!ME.book.length) { toast('Your book is empty so far. Write or draw something first.'); return; }
  const by = [GATE0, ...DATA.gates].map(g => ({ g, es: ME.book.filter(e => e.gate === g.n) })).filter(x => x.es.length);
  const html = `<!doctype html><meta charset="utf-8"><title>My Mahala book</title><style>body{font:17px/1.55 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#27211C;background:#fbf7ef}h1{font-weight:400;letter-spacing:.2em}h2{font-weight:400;border-bottom:1px solid #d9cdb8;padding-bottom:4px;margin-top:2em}.p{color:#8a6a50;font-style:italic}.e{margin:1.2em 0;padding-left:14px;border-left:2px solid #B87333}img{max-width:100%;border-radius:8px}small{color:#978C82;font-family:sans-serif}</style>
<h1>MAHALA</h1><p>My book from the Mahalaverse${ME.name ? ', kept by ' + esc(ME.name) : ''}.</p>
${by.map(({ g, es }) => `<h2>Gate ${g.n}: ${esc(g.name)}</h2>${es.map(e => `<div class="e"><small>${esc(KIND_T[e.kind] || '')} · ${new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</small><p class="p">${esc(e.prompt || '')}</p>${e.img ? `<img src="${e.img}" alt="">` : ''}${e.text ? `<p>${esc(e.text).replace(/\n/g, '<br>')}</p>` : ''}</div>`).join('')}`).join('')}`;
  saveFile('my-mahala-book.html', html);
}

/* ---------- the bell: news from the camp leads, the fire night, and what changed ---------- */
function renderBell() {
  const items = [];
  if (LIVE.leads.firenight && LIVE.leads.firenight.text) items.push({ t: 'The next fire night', s: LIVE.leads.firenight.text, at: LIVE.leads.firenight.at || 0 });
  const evs = LIVE.leads.events || {}; DATA.events.forEach(e => { if (evs[e.id]) items.push({ t: `${e.name}: ${evs[e.id]}`, s: e.format, at: (LIVE.leads.events && LIVE.leads.events.at) || 0, sel: e.id }); });
  LIVE.news.slice(0, 6).forEach(n => items.push({ t: n.text, s: new Date(n.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), at: n.at || 0 }));
  if (!items.length) { items.push({ t: 'Welcome to the Mahalaverse.', s: 'Choose a door to take part, or walk the free path: the teaser, the story, the tour and the book.', at: 0 }, { t: 'Sound journeys and a live online workshop', s: 'In the Lotus Mahal, at Gate 2. Dates and the guest speaker are to be announced.', at: 0 }); }
  const fresh = items.some(i => i.at > (ME.newsSeen || 0));
  $('#bellBtn').hidden = !items.some(i => i.at);
  LIVE.bell = items;
  $('#bellPop').innerHTML = items.map(i => i.sel ? `<p><button class="linkish" data-sel="${i.sel}"><b>${esc(i.t)}</b><small>${esc(i.s)}</small></button></p>` : `<p><b>${esc(i.t)}</b><small>${esc(i.s)}</small></p>`).join('');
  $('.dot', $('#bellBtn')).style.display = fresh ? '' : 'none';
}
$('#bellBtn').addEventListener('click', () => { ME.newsSeen = Date.now(); saveMe(); });
$('#bellPop').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) { closePops(); select(b.dataset.sel); } });

/* ---------- sound and touch: the playa wind, the fire, a chime on the card and the gates ---------- */
const SND = { ctx: null, on: false, wind: null, fireG: null, t: 0 };
function sndInit() {
  if (SND.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = SND.ctx = new AC();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
  const w = ctx.createBufferSource(); w.buffer = buf; w.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420; SND.wind = ctx.createGain(); SND.wind.gain.value = 0;
  w.connect(wf).connect(SND.wind).connect(ctx.destination); w.start(); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 180; lfo.connect(lg).connect(wf.frequency); lfo.start();
  const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 3);
  SND.fireG = ctx.createGain(); SND.fireG.gain.value = 0; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8; bp.connect(SND.fireG).connect(ctx.destination);
  setInterval(() => { if (!SND.on || SND.fireG.gain.value < 0.005 || Math.random() < 0.45) return; const s = ctx.createBufferSource(); s.buffer = nb; const g = ctx.createGain(); g.gain.value = 0.3 + Math.random(); s.playbackRate.value = 0.6 + Math.random() * 1.2; s.connect(g).connect(bp); s.start(); }, 90);
}
function setSound(on) {
  ME.sound = on; saveMe(); if (on) { sndInit(); if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); }
  SND.on = on && !!SND.ctx; const b = $('#soundBtn'); b.setAttribute('aria-pressed', String(SND.on)); b.setAttribute('aria-label', SND.on ? 'Turn sound off' : 'Turn sound on'); b.innerHTML = icon(SND.on ? 'sound' : 'mute'); mixSound();
}
function mixSound() {
  if (!SND.ctx) return; const t = SND.ctx.currentTime, near = fire.on && fire.where !== 'plinth' ? 1 : clamp(1 - camera.position.distanceTo(FX.at) / 28, 0, 1);
  SND.wind.gain.setTargetAtTime(SND.on ? (inside ? 0.015 : 0.05) : 0, t, 0.8); SND.fireG.gain.setTargetAtTime(SND.on ? 0.16 * near : 0, t, 0.4);
}
function chime(kind = 'soft') {
  if (!SND.on || !SND.ctx) return; const ctx = SND.ctx, t = ctx.currentTime, notes = kind === 'bell' ? [392, 587.33, 783.99, 1174.66] : [659.25, 987.77];
  notes.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; const t0 = t + i * (kind === 'bell' ? 0.11 : 0.07);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(kind === 'bell' ? 0.09 : 0.05, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (kind === 'bell' ? 2.6 : 1.4)); o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 2.8); });
}
$('#soundBtn').addEventListener('click', () => setSound(!SND.on));
setInterval(mixSound, 500);

/* ---------- links that open the world in a place, and shares that carry them ---------- */
const shareLink = (hash = '') => CONFIG.share + (hash || LIVE.uid ? '#' + [hash, LIVE.uid ? 'from=' + LIVE.uid : ''].filter(Boolean).join('&') : '');
async function shareText(title, text, hash) {
  const url = shareLink(hash);
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Copied, with a link back to the Mahalaverse.'); } catch (e) { toast(url); }
}
function shareInvite() { markDone(5, 'host'); shareText('An invitation to the Mahalaverse', 'You were chosen to become a temple builder. Come and see the Mahala temple, and find your door.', ''); }
function readLink() {
  const raw = (location.hash || '').replace(/^#/, '') + '&' + (location.search || '').replace(/^\?/, ''); const L = {};
  raw.split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); L[decodeURIComponent(k)] = v == null ? true : decodeURIComponent(v); });
  return L;
}
const LINK = readLink();
if (LINK.from && LINK.from !== LIVE.uid && !ME.from) { ME.from = String(LINK.from).slice(0, 80); saveMe(); }
function runLink() {
  const L = LINK;
  const DOOR_ALIAS = { camp: 'camp', build: 'build', back: 'back', support: 'back', notnow: 'notnow' };
  if (L.door && DOOR_ALIAS[L.door]) openJoin(DOOR_ALIAS[L.door]);
  else if (L.gate) showGate(clamp(+L.gate || 1, 0, 7));
  else if (L.card && ARCH_BY[L.card]) { const a = ARCH_BY[L.card]; if (canEnter('fire')) openFireside(a.id, 'show'); else { openBook(a.page); setTimeout(() => toast(`This invitation carries ${a.title}. Its card waits at the fire, through Gate 1.`), 600); } }
  else if (L.fire) openFireside();
  else if (L.book) openBook(+L.book || 0);
  else if (L.story) startStory(0);
  else if (L.tour) startTour();
  else if (L.sel && REG[L.sel]) select(L.sel);
  else if (L.place) select({ mahal: 'CAMP_LOTUS', camp: 'CAMP', zome: 'TEMPLE', yard: 'YARD', fire: 'CAMP_FIRE' }[L.place] || 'TEMPLE');
  else if (L.path) openPath();
  else if (L.way) goWay(+L.way - 1);
}
const FROM_SEED = window.__mvFromSeed || null;   // arriving from The Seed, the invitation that opens this page
const hasLink = ['door', 'gate', 'card', 'fire', 'book', 'story', 'tour', 'sel', 'place', 'path', 'enter', 'way'].some(k => LINK[k] != null);

/* ---------- the lobby: the invitation opens before the world has loaded ---------- */
$('#lobbyDoors').innerHTML = doorsHTML();
$('#teaserBtn').addEventListener('click', () => playTeaser(true));
$('#lobbyDoors').addEventListener('click', e => { const d = e.target.closest('[data-door]'); if (!d) return; WORLD.after = () => openJoin(d.dataset.door); if (WORLD.ready) enterWorld(false); else { toast('Raising the temple. Your door opens in a moment.'); WORLD.queued = true; } });
$('#enterBtn').addEventListener('click', () => enterWorld(true));
FM.addEventListener('click', () => { if (FM.hidden) FM.classList.remove('over'); });
$('#filmClose').addEventListener('click', () => FM.classList.remove('over'));
const WORLD = { ready: false, entered: false, after: null, queued: false };
function worldReady() {
  WORLD.ready = true; const b = $('#enterBtn'); b.disabled = false; $('#enterLbl').textContent = ME.visits ? 'Return to the playa' : 'Enter the playa'; $('#loadMsg').textContent = 'The temple is standing.';
  if (FROM_SEED) {
    if (FROM_SEED.door) WORLD.after = () => openJoin(FROM_SEED.door); else if (FROM_SEED.sel && REG[FROM_SEED.sel]) WORLD.after = () => select(FROM_SEED.sel);
    enterWorld(!FROM_SEED.quick && !WORLD.after); return;
  }
  if (hasLink || WORLD.queued) enterWorld(false);
}
function enterWorld(arrival) {
  if (WORLD.entered) return; WORLD.entered = true; $('#loader').classList.add('done'); FM.classList.remove('over');
  const returning = ME.visits > 0; ME.visits++; const since = ME.last; ME.last = Date.now(); saveMe();
  LIT.mode.value = 0; refreshLight(false); updateLanterns(); renderKpis(); renderBell(); updateNextUp();
  RITE.on = false;
  wayArrive(arrival && !returning);
  if (ME.sound || (FROM_SEED && FROM_SEED.sound)) setSound(true);
  if (hasLink) setTimeout(runLink, 300);
  if (WORLD.after) { const f = WORLD.after; WORLD.after = null; setTimeout(f, 300); }
}
function tankwaNow() { const d = new Date(), m = ((d.getUTCHours() + 2) % 24) * 60 + d.getUTCMinutes(); return m >= 300 && m <= 1380 ? m : null; }
function arrivalShot() {
  document.body.classList.add('arrival');
  clock = 17 * 60 + 50; applyTime(clock);
  setView({ t: V3(16, 1.7, 0.4), d: 22, p: 1.47, a: Math.PI / 2 - 0.05 });
  clockAnim = { from: clock, to: 18 * 60 + 52, t0: performance.now() + 600, dur: 7600 };
  flyTo({ t: V3(1, 2.8, 0), d: 38, p: 1.3, a: Math.PI / 2 - 0.3 }, 7.5);
  setTimeout(endArrival, 9000);
}
function endArrival() { document.body.classList.remove('arrival'); }

/* ---------- the welcome card follows your path ---------- */
function showWelcome(since = null) {
  const nx = nextStep(), g = GATE_BY(ME.gate), lit = Math.min(PANELS_N, litNow());
  const back = since && sharedMode() ? (() => { const newNews = LIVE.news.filter(n => n.at > since).length, newLines = LIVE.hearth.filter(h => h.at > since).length; return newNews + newLines ? `<p class="note strong">Since you were last here: ${[newLines ? `${newLines} new line${newLines > 1 ? 's' : ''} at the fire` : '', newNews ? `${newNews} update${newNews > 1 ? 's' : ''} on the bell` : ''].filter(Boolean).join(', ')}.</p>` : ''; })() : '';
  setInspector(head('welcome', ME.visits > 1 ? 'Welcome back, builder' : 'Welcome, builder', 'Help us build the Mahala temple', 'Quaggafontein, Tankwa Karoo') + `<div class="insp-body">
    <p class="spine">You were chosen to become a temple builder: of a temple on the playa, and of the temple within.<small>From the draft script of the Seed of Hope film</small></p>
    ${back}
    <div class="lockrow" style="border-style:solid">${icon('path')}<span><b>Your path · Gate ${ME.gate}, ${esc(g.name.replace(/^The /, 'the '))}</b><small>${nx ? 'Next: ' + esc(nx.label) : 'Every gate is open for you.'}</small></span>${nx ? `<button class="btn primary" data-act="next">${TOUCH ? 'Go' : 'Go'}</button>` : ''}</div>
    <div class="livebar"><div class="lab"><span>Glass panels lit${sharedMode() ? ` by ${fmtN(liveBuilders())} builder${liveBuilders() === 1 ? '' : 's'}` : ' by you, in this browser'}</span><span class="mono">${lit} / ${PANELS_N}</span></div><div class="bar"><span style="width:${(lit / PANELS_N * 100).toFixed(1)}%"></span></div></div>${budgetBar()}
    <div class="actions"><button class="btn" data-act="story">${icon('book')}Begin the story</button><button class="btn" data-act="tour">${icon('pin')}Take the tour</button><button class="btn" data-act="path">${icon('path')}Your path</button></div>
    <p>The Mahalaverse is the online home of the people building the Mahala temple, a temple of coloured glass for AfrikaBurn 2027. ${TOUCH ? 'Tap' : 'Click'} anything to look closer.</p>
    <div class="doors">${doorsHTML()}</div>
    <div class="sect"><h4>Places to visit</h4>${links([['BOOK', 'Free', 'The Book of Mahala, at the way in'], ['CAMP_FIRE', canEnter('fire') ? 'Sit' : 'Gate 1', 'The fireside: poems, stories and the deck'], ['MAHAL_COIL', canEnter('mahal') ? 'Enter' : 'Gate 2', 'The Lotus Mahal and the big coil'], ['CENTRE', canEnter('zome') ? 'Enter' : 'Gate 4', 'Inside the zome']])}</div>
    <div class="tiles">${tile('film', 'assets/film_poster.jpg', 'Watch the teaser', true)}${tile('spot:COIL_140', 'assets/render_coil_140.jpg', 'Temple Tech')}${tile('night', 'assets/K8d.jpg', 'See it at night')}</div>
    <p class="note">Concept visualisation of a proposed temple. Nothing here is built yet. ${LIVE.on && LIVE.write !== false ? 'Your path is saved to your own space in the shared database.' : 'Your path is kept in this browser.'}</p></div>`);
}

/* ---------- extra lines on the cards, and new cards for gates, quests and crews ---------- */
const lockRow = (n, what) => `<div class="lockrow">${icon('lock')}<span><b>${esc(what)} opens at Gate ${n}</b><small>${esc(GATE_BY(n).name)} · ${esc(GATE_BY(n).amount)}, working figure</small></span><button class="btn" data-act="gate:${n}">See the gate</button></div>`;
const injectTop = (h, extra) => h.replace('<div class="insp-body">', '<div class="insp-body">' + extra);
function v4Card(it, h) { const o = v4CardIn(it, h); return TOUCH ? o.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap') : o; }
function v4CardIn(it, h) {
  const k = it.kind;
  if (k === 'event') { const d = (LIVE.leads.events || {})[it.e.id]; return d ? injectTop(h, `<div class="lockrow" style="border-style:solid">${icon('cal')}<span><b>Date set: ${esc(d)}</b><small>Set by a steward</small></span></div>`) : h; }
  if (k === 'gate') { const g = it.g, open = gateOpen(g.n);
    return head(k, `Gate ${g.n} of 7 · ${open ? 'open for you' : 'the path of a temple builder'}`, g.name, 'A gateway on the way to The Seed') + `<div class="insp-body">
      <div class="amount"><b>${esc(g.amount)}</b>${chip('Working figure', 'wait')}${open ? chip('Open', 'done') : chip('Locked', 'lock')}</div>
      ${kv([['Opens', esc(spaceOf(g))], ['Gift', esc(g.gift)], ['What it builds', esc(g.builds)], ...(g.badge ? [['Badge', esc(g.badge)]] : [])])}
      ${g.extra ? `<p>${esc(g.extra)}.</p>` : ''}
      ${g.n === 2 ? `<div class="linklist"><button data-act="spot:PENDANT"><span class="k">Spotlight</span>See the pendant${icon('right')}</button></div>` : ''}${g.n === 4 ? `<div class="linklist"><button data-act="spot:MAHAL_COIL"><span class="k">Spotlight</span>See the big coil${icon('right')}</button></div>` : ''}
      <div class="actions">${open ? `<button class="btn primary" data-act="goto:${g.n}">${icon('gate')}Go there</button>` : `<button class="btn primary" data-act="give:${g.n}">${icon('gift')}Give ${esc(g.amount.split(' to ')[0])}</button><button class="btn testbtn" data-act="test:${g.n}">${icon('unlock')}Camp lead testing</button>`}
        ${g.n > 1 ? `<button class="btn" data-sel="GATE_${g.n - 1}">Gate ${g.n - 1}</button>` : ''}${g.n < 7 ? `<button class="btn" data-sel="GATE_${g.n + 1}">Gate ${g.n + 1}</button>` : ''}</div>
      <p class="note strong">Amounts are working figures and may change. No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.</p></div>`; }
  if (k === 'quest') { const q = it.q, mine = ME.quests[q.id], crew = CREW_OF_NAME(q.crew), conf = (LIVE.confirm[LIVE.uid] || {})[q.id] || [];
    const can = q.open || (crew && ME.crew === crew.id), n = questTakers(q.id);
    return head(k, `${q.id} · quest`, q.name, `${q.crew} · ${q.stage}`) + `<div class="insp-body"><div class="chips">${chip(mine ? 'On your list' : 'Open', mine ? 'done' : 'open')}${chip(q.stage, 'c-' + { y: 'yellow', c: 'cyan', m: 'magenta' }[q.tone])}</div>
      <p>${esc(q.goal)}</p>
      ${mine ? `<div class="ticks">${q.steps.map((s2, i) => { const dn = !!(mine.steps || [])[i]; return `<button class="tick ${dn ? 'on' : ''}" data-act="step:${q.id}:${i}"><span class="bx">${dn ? icon('check') : ''}</span>${esc(s2)}${dn ? ` <span class="note">· ${conf[i] ? 'confirmed by a crew lead' : 'waiting for a crew lead'}</span>` : ''}</button>`; }).join('')}</div><p class="note">Each step a crew lead confirms lights a panel of glass.</p>`
        : `<ol class="steps-ol">${q.steps.map(s2 => `<li>${esc(s2)}</li>`).join('')}</ol>`}
      ${kv([['Crew', esc(q.crew)], ['Skills', esc(q.skills)], ['Where', esc(REG[q.where].title)]])}
      ${mine || can ? `<div class="actions">${mine ? '' : `<button class="btn primary" data-act="take:${q.id}">${icon('check')}Take this quest</button>`}<button class="btn" data-sel="${q.where}">Go to ${esc(REG[q.where].title.replace(/^The /, 'the '))}</button></div>`
        : `<div class="lockrow">${icon('users')}<span><b>For the ${esc(q.crew)}</b><small>Join the crew to take this quest.</small></span>${crew ? `<button class="btn" data-act="crewjoin:${crew.id}">Join the crew</button>` : ''}</div>`}</div>`; }
  if (k === 'crew') { const c = it.c, mine = ME.crew === c.id, n = LIVE.builders.filter(b => b.crew === c.id).length;
    return head(k, c.build ? 'Crew · a build crew' : 'Crew', c.name, esc(c.what)) + `<div class="insp-body"><div class="chips">${chip(mine ? (ME.crewOk ? 'Your crew' : 'Asked to join') : 'Forming', mine ? 'done' : 'now')}${c.build ? chip('Build crew', 'c-cyan') : ''}</div>
      <p>Crews form around one part of the temple.${c.build ? ' Build crews sit within Art and Gifting, one of the camp\'s four circles.' : ''}</p>
      ${links(DATA.quests.filter(q => q.crew === c.name).map(q => [q.id, q.id, q.name]).concat(DATA.roles.filter(r => r.crew.includes(c.name.split(' ')[0])).map(r => [r.id, 'Role', r.name])))}
      <div class="actions">${mine ? '' : `<button class="btn primary" data-act="crewjoin:${c.id}">${icon('users')}${canEnter('crews') ? 'Join this crew' : 'Ask to join this crew'}</button>`}</div>
      </div>`; }
  if (k === 'temple') return injectTop(h, `<div class="livebar"><div class="lab"><span>${LIT.mode.value ? 'Panels lit by builders' : 'Showing the full design'}</span><span class="mono">${Math.min(PANELS_N, litNow())} / ${PANELS_N}</span></div><div class="bar"><span style="width:${(Math.min(PANELS_N, litNow()) / PANELS_N * 100).toFixed(1)}%"></span></div></div>${budgetBar(true)}
    <div class="actions"><button class="btn" data-act="litmode">${icon('eye')}${LIT.mode.value ? 'See the full design' : 'See it as lit by builders'}</button><button class="btn" data-act="beyond:6">${icon(canEnter('beyond') ? 'star' : 'lock')}Beyond the zome</button><button class="btn" data-act="beyond:7">${icon(canEnter('lighthouse') ? 'light' : 'lock')}The lighthouses</button></div>`);
  if (k === 'camp') return injectTop(h, canEnter('camp') ? `<div class="sect"><h4>Your place in the camp</h4>${kv([['Camp access', 'Open for you (what it covers is still being set by the camp)'], ['Your days', esc((ME.week || []).join(', ') || 'Not chosen yet')], ...(LIVE.on ? [['Camp mates', String(LIVE.builders.filter(b => b.door).length)]] : [])])}</div>` : lockRow(3, 'Your place in the camp'));
  if (k === 'kitchen') return injectTop(h, canEnter('kitchen') ? chip('Open for you', 'done') : lockRow(4, 'The kitchen'));
  if (k === 'lotus') return injectTop(h, canEnter('mahal') ? `<p class="note strong">Sound journeys and a live online workshop gather here. Dates and the guest are announced once confirmed.</p>` : lockRow(2, 'The Lotus Mahal'));
  if (k === 'drift' || k === 'fire') return injectTop(h, canEnter('fire') ? '' : lockRow(1, 'The fire'));
  if (k === 'centre' && !inside) return injectTop(h, canEnter('zome') ? '' : lockRow(4, 'Inside the zome'));
  if (k === 'yard' || k === 'bench' || k === 'cnc') return injectTop(h, canEnter('yard') ? `<div class="actions"><button class="btn primary" data-act="workshop">${icon('tools')}The crew board</button></div>` : `<div class="lockrow">${icon('lock')}<span><b>The yard and the workshop open to build crews</b><small>Join a build crew, or reach Gate 5</small></span><button class="btn" data-act="join:build">Join the build</button></div>`);
  if (k === 'portal') return injectTop(h, `<div class="lockrow" style="border-style:solid">${icon('flame')}<span><b>Through the portal, the fire</b><small>${canEnter('fire') ? 'The fire is open for you.' : 'Gate 1 · $10, working figure'}</small></span><button class="btn primary" data-act="${canEnter('fire') ? 'fire' : 'gate:1'}">${canEnter('fire') ? 'Sit by the fire' : 'See the gate'}</button></div>`);
  return h;
}
function v4Act(act, a) {
  const [k, x, y] = act.split(':');
  if (k === 'film' && x == null) { playTeaser(); return true; }
  if (k === 'gate') { showGate(+x); return true; }
  if (k === 'give') { give(+x); return true; }
  if (k === 'test') { testOpen(+x, null); if (current) renderInspector(REG[current]); return true; }
  if (k === 'goto') { goGate(+x); return true; }
  if (k === 'next') { const nx = nextStep(); if (nx) nx.run(); return true; }
  if (k === 'tour') { startTour(); return true; }
  if (k === 'path') { openPath(); return true; }
  if (k === 'beyond') { goBeyond(+x); return true; }
  if (k === 'write') { openWrite(x, +y); return true; }
  if (k === 'litmode') { LIT.mode.value = LIT.mode.value ? 0 : 1; LM.dirty = true; starDecal.material.opacity = nightK * litFrac(); if (current) renderInspector(REG[current]); toast(LIT.mode.value ? 'The temple as builders have lit it so far.' : 'The full design, every panel in colour.'); return true; }
  if (k === 'take') { const q = DATA.quests.find(z => z.id === x); ME.quests[x] = { at: Date.now(), steps: [false, false, false] }; saveMe(); pushMe(); markDone(4, 'quest'); toast(`On your list: ${q.name}. Tick each step as you do it.`); renderInspector(REG[x]); return true; }
  if (k === 'step') { const s2 = ME.quests[x]; if (!s2) return true; s2.steps[+y] = !s2.steps[+y]; saveMe(); pushMe(); refreshLight(); renderInspector(REG[x]); return true; }
  if (k === 'crewjoin') { ME.crew = x; ME.crewOk = canEnter('crews'); saveMe(); pushMe(); toast(ME.crewOk ? `You are on the ${CREW_BY(x).name}.${isBuildCrew(x) ? ' The yard and the workshop are open to you.' : ''}` : `Asked to join the ${CREW_BY(x).name}. A steward will accept you.`); renderInspector(REG[x]); renderKpis(); return true; }
  if (k === 'notify') { const e2 = DATA.events.find(z => z.id === x); ME.notify = Object.assign({}, ME.notify, { [x]: true }); saveMe();
    if (ME.contact && ME.consent) { pushSignup({ notify: ME.notify }); toast(`We will tell you when ${e2.name} is set. Only the stewards see your contact.`); } else openJoin(ME.door || 'build', null, 'touch'); a.disabled = true; return true; }
  if (k === 'workshop') { if (!canEnter('yard')) { showGate(5); return true; } select('BENCH'); setTimeout(() => { setInspector(head('bench', 'The workshop · build crews', 'The crew board', 'What the build crews are working on') + `<div class="insp-body">
      ${DATA.crews.filter(c => c.build).map(c => `<div class="sect"><h4>${esc(c.name)}${LIVE.on ? ` · ${LIVE.builders.filter(b => b.crew === c.id).length} on the crew` : ''}</h4>${links(DATA.quests.filter(q => q.crew === c.name).map(q => [q.id, q.id, q.name + (LIVE.on ? ` · ${questTakers(q.id)} on it` : '')]))}</div>`).join('')}
      <p class="note">Crew leads confirm the steps of each quest. Every confirmed step lights a panel of glass.</p></div>`); }, 400); return true; }
  if (k === 'story' && x == null) { startStory(0); return true; }
  return false;
}

/* ---------- the drawn card: where it is needed, and a share that carries a link ---------- */
const _drawCard = drawCard;
drawCard = function (key, how = 'draw') {
  _drawCard(key, how); markDone(1, 'draw');
  const a = ARCH_BY[key], pair = ARCH_CREW[key]; if (!pair) return;
  const crew = CREW_BY(pair[0]), q = pair[1] && DATA.quests.find(z => z.id === pair[1]);
  const box = document.createElement('div'); box.className = 'sect'; box.style.marginTop = '10px';
  box.innerHTML = `<h4>Where this card is needed</h4><div class="linklist"><button data-sel="${crew.id}"><span class="k">Crew</span>${esc(crew.name)}${icon('right')}</button>${q ? `<button data-sel="${q.id}"><span class="k">${q.id}</span>${esc(q.name)}${icon('right')}</button>` : ''}</div>
    <p class="note">Drawn, not assigned: yours for this season, and you can draw again. A draft pairing for the camp to agree.</p>
    <div class="actions" style="margin-top:6px"><button class="btn" data-fi="write">${icon('pen')}Answer its question in your book</button><button class="btn" data-fi="line">${icon('flame')}Leave a line for the fire</button></div>`;
  const t = FI.body.querySelector('.dk-text'); if (t) t.insertBefore(box, t.querySelector('.dk-sh'));
};
shareCard = async function (a) { await shareText(a.title, `By the fire in the Mahalaverse I drew ${a.title}: "${a.cap}." ${a.q || a.sq || ''}`.trim(), 'card=' + a.key); };
FI.el.addEventListener('click', e => {
  const sl = e.target.closest('[data-sel]'); if (sl) { e.stopPropagation(); leaveFireside(false); select(sl.dataset.sel); return; }
  const b = e.target.closest('[data-fi]'); if (!b) return;
  if (b.dataset.fi === 'write') { if (HOOK7.journey) { try { HOOK7.journey(DKX.drawn); return; } catch (e) { console.warn(e); } } openWrite('reflect', 1); }
  if (b.dataset.fi === 'line') openWrite('line', 1);
}, true);
// the circle shows the lines left at the fire, and invites one more
const _renderCircle = renderCircle;
renderCircle = function () {
  _renderCircle();
  const H = LIVE.hearth.slice(0, 5), wk = Date.now() - 7 * 864e5, cards = {}; LIVE.builders.forEach(b => { if (b.card && (b.at || 0) > wk) cards[b.card] = (cards[b.card] || 0) + 1; });
  const fn = LIVE.leads.firenight && LIVE.leads.firenight.text;
  const extra = document.createElement('div'); extra.className = 'hearth';
  extra.innerHTML = `${fn ? `<p class="fi-meta" style="margin:0">${icon('cal')} The next fire night: ${esc(fn)}</p>` : ''}
    ${H.length ? `<span class="eyebrow">Lines left at the fire</span>${H.map(h2 => `<p>"${esc(h2.text)}"<br><small>${esc(h2.name || 'A camp mate')}${h2.card && ARCH_BY[h2.card] ? ' · ' + esc(ARCH_BY[h2.card].title) : ''}</small></p>`).join('')}` : ''}
    ${Object.keys(cards).length ? `<small>Cards at the fire this week: ${Object.entries(cards).map(([c, n]) => `${esc(ARCH_BY[c]?.title || c)} ${n}`).join(', ')}</small>` : ''}`;
  FI.body.appendChild(extra);
  FI.foot.innerHTML = FI.foot.innerHTML.replace('<span class="note">Click the fire to add a log.</span>', `<span class="note">${TOUCH ? 'Tap' : 'Click'} the fire to add a log.</span><button class="btn" data-fi="line">${icon('pen')}Leave a line</button>`);
};

/* ---------- a gentle hand on the modals: focus moves in, and stays in ---------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return; const m = [...document.querySelectorAll('.modal')].find(x => !x.hidden); if (!m) return;
  const f = [...m.querySelectorAll('button, [href], input, select, textarea, canvas, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (i < 0) { e.preventDefault(); f[0].focus(); } else if (e.shiftKey && i === 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
}, true);
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return;
  if (!WM.hidden) { e.stopImmediatePropagation(); closeWrite(); } else if (!GM.hidden) { e.stopImmediatePropagation(); closeGate(); } else if (!PM.hidden) { e.stopImmediatePropagation(); closePath(); } }, true);

renderBell(); renderKpis(); updateLanterns();
startLive();


/* ====================== v5: the way. One path through the world, seven stops, from the book at the threshold to The Seed ======================
   The world stays as it was; what changes is how you move through it. A way card tells you where you are and what you can do there,
   a bar along the bottom shows the seven stops, and Next takes you on. The gates are ways to give: nothing on the way is locked. */
Object.assign(CONFIG, {
  raise: { raised: 70000, target: 999999.99, cur: 'R' },            // raised for The Seed, until the camp's accounts keeper sets the ledger
  album: 'https://open.spotify.com/album/0prxG8cheSrs2hugGQPdw8',  // Sunrise at the Mahal, by Gustav Loubser
  guide: 'https://claude.ai/artifact/24TQxDchG2Z8zvYq1rDhRT',      // the Mahala Temple Build Guide
  campPage: 'camp.html',
  buildFilm: 'assets/build_sequence.mp4',
});
const money = (n, c = 'R') => c + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
GLYPH.tent = 'sound'; GLYPH.crews = 'users'; GLYPH.guide = 'book';

/* the seven stops. Each has its place, its time of day, a few words and what you can do there */
const PLINTH_VIEW = () => ({ t: DECK_AT.clone().setY(1.42), d: 4.6, p: 1.34, a: BOOK_RY + 0.62 });
const DECK_RING = V3(DECK_AT.x, 0.5, DECK_AT.z);
const WAY = [
  { id: 'book', short: 'The book', eye: 'The threshold', name: 'The Book and the card', clock: 7 * 60 + 20,
    view: () => ({ t: BOOK_AT.clone().setY(1.1), d: 8.0, p: 1.14, a: BOOK_RY + 0.4 }),
    lines: ['Every temple builder begins here, at the start of the way to The Seed, the temple of coloured glass at its end.', 'Read a little of the camp\'s own book, then draw a card from the Mahala deck and meet the archetype that walks with you.'],
    acts: [['book', 'book', 'Read the Book of Mahala'], ['card', 'star', 'Draw a card']] },
  { id: 'portal', short: 'Portal', eye: 'The way to the camp', name: 'The MAHALA portal', clock: 8 * 60 + 40,
    view: () => ({ t: PORTAL.clone().setY(2.3), d: 21, p: 1.24, a: 2.24 }),
    lines: ['A timber gate with the lotus on its crown, and a spiral of rope on the ground to follow in.', 'Step through it, into the camp.'],
    photos: [['photo_portal', 'The portal, lit at night']],
    acts: [['through', 'gate', 'Walk through the portal']] },
  { id: 'drift', short: 'Drift', eye: 'The camp boat', name: 'Blissfull Drift', clock: 10 * 60 + 10,
    view: () => ({ t: DRIFT.clone().setY(1.5), d: 24, p: 1.12, a: 0.72 }),
    lines: ['A wooden boat on a sea of dust. In its open hull, seats step down to a fire pit shaped like a king protea.', 'Sit by the fire and read the poems and stories camp mates have written.'],
    photos: [['photo_drift_day', 'By day'], ['photo_drift_night', 'At night']],
    acts: [['fire', 'flame', 'Sit by the fire'], ['firechoose', 'shuffle', 'Let the fire choose']] },
  { id: 'mahal', short: 'Mahal', eye: 'The temple tent', name: 'The Lotus Mahal', clock: 12 * 60 + 30,
    view: () => ({ t: V3(CAMP.x, 2.2, CAMP.z), d: 28, p: 1.02, a: 0.4 }),
    lines: ['Three bell tents joined around a taller centre, pegged out like a lotus. On the centre pole, at heart height, sits a big hand-wound copper coil.', 'Sound journeys gather here. Listen to Sunrise at the Mahal, by Gustav Loubser.'],
    photos: [['photo_lotus_tent', 'The Lotus Mahal'], ['photo_coil_pole', 'The coil on its pole']],
    acts: [['mahal', 'gate', 'Step inside'], ['coil', 'torus', 'See the coil'], ['album', 'sound', 'Sunrise at the Mahal']] },
  { id: 'camp', short: 'Camp', eye: 'Home for the builders', name: 'The camp', clock: 15 * 60 + 30,
    view: () => ({ t: V3(CAMP.x + 1, 1, CAMP.z + 2), d: 66, p: 0.92, a: 2.45 }),
    lines: ['Bell tents, the kitchen and the main tent: home for the builders through build week and the burn.', 'Camp mates apply for their place, then choose how they will help.'],
    acts: [['apply', 'tent', 'Apply to the camp'], ['tent', 'sound', 'The main tent: playlists and sets'], ['kitchen', 'users', 'The kitchen: meal shifts'], ['crews', 'users', 'Join a crew'], ['camppage', 'right', 'The camp in detail']] },
  { id: 'yard', short: 'Yard', eye: 'Where it is made', name: 'The build yard', clock: 17 * 60 + 15,
    view: () => ({ t: V3(YARD.x, 1, YARD.z), d: 52, p: 1.0, a: 0.95 }),
    lines: ['The frame would be made here, panel by panel, and the thank-you gifts for supporters at the Temple Tech bench.', 'Then it would all travel to the playa and rise in five days.'],
    acts: [['guide', 'book', 'The build guideline'], ['buildfilm', 'film', 'Watch the build']] },
  { id: 'seed', short: 'The Seed', eye: 'The temple', name: 'The Seed', clock: 20 * 60 + 45,
    view: () => ({ t: V3(0, 1.2, 0), d: 58, p: 0.86, a: Math.PI / 2 - 0.42 }),
    lines: ['A temple of coloured glass Mahala proposes for AfrikaBurn 2027, opening like a king protea.', 'At night the lantern inside throws a wheel of colour across the playa. Help us raise it.'],
    acts: [['inside', 'gate', 'Step inside'], ['give', 'gift', 'Help raise The Seed']], bar: true },
];
const WAY_BY = Object.fromEntries(WAY.map((s, i) => [s.id, i]));
// where each thing in the world sits on the way, so the bar follows you when you go there another way
const WAY_OF = { BOOK: 'book', DECK: 'book', CAMP_PORTAL: 'portal', CAMP_DRIFT: 'drift', CAMP_FIRE: 'drift', CAMP_LOTUS: 'mahal', MAHAL_COIL: 'mahal',
  CAMP: 'camp', CAMP_KITCHEN: 'camp', CAMP_TENT: 'camp', CREWS: 'camp', YARD: 'yard', YARD_CNC: 'yard', BENCH: 'yard', GUIDE: 'yard', COIL_140: 'yard', PENDANT: 'yard',
  TEMPLE: 'seed', CENTRE: 'seed', FRAME: 'seed', CAP: 'seed', FLOOR_GRID: 'seed' };
const wayOf = id => WAY_OF[id] || (/^RING_|^PETAL_|^GATE_|^POD_/.test(id || '') ? 'seed' : null);
const WY = { i: clamp(+ME.way || 0, 0, WAY.length - 1), el: $('#way'), bar: $('#wayBar'), fold: false, more: false, autoFold: false };

/* the card for the stop you are at */
function renderWay() {
  const s = WAY[WY.i], n = WAY.length, nx = WAY[WY.i + 1], pv = WAY[WY.i - 1];
  const acts = s.acts.map(([k, ic, t], j) => k === 'album' ? `<a class="btn" href="${esc(CONFIG.album)}" target="_blank" rel="noopener noreferrer">${icon(ic)}${esc(t)}</a>`
    : k === 'camppage' ? `<a class="btn" href="${esc(CONFIG.campPage)}">${icon(ic)}${esc(t)}</a>`
    : `<button class="btn${j === 0 ? ' primary' : ''}" type="button" data-w="${k}">${icon(ic)}${esc(t)}</button>`).join('');
  const pics = s.photos ? `<div class="tiles way-tiles${s.photos.length === 1 ? ' one' : ' two'}">${s.photos.map(([f, l]) => tile('img:' + f, `assets/${f}.jpg`, l)).join('')}</div>` : '';
  WY.el.innerHTML = `<div class="way-in">
      <div class="way-top"><span class="eyebrow">${WY.i + 1} of ${n} · ${esc(s.eye)}</span>
        <button class="iconbtn way-fold" type="button" data-w="fold" aria-expanded="${!WY.fold}" aria-label="${WY.fold ? 'Show the whole card' : 'Fold the card away'}">${icon(WY.fold ? 'up' : 'down')}</button></div>
      <h2>${esc(s.name)}</h2>
      <div class="way-lines">${s.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      ${s.lines.length > 1 || pics ? `<button class="linkish way-more" type="button" data-w="more" aria-expanded="${WY.more}">${WY.more ? 'Less' : 'More'}</button>` : ''}
      ${pics}
      <div class="way-acts">${acts}</div>
      ${s.bar ? budgetBar() : ''}
    </div>
    <div class="way-foot">${pv ? `<button class="btn ghost" type="button" data-w="prev">${icon('left')}${esc(pv.short)}</button>` : '<span></span>'}
      ${nx ? `<button class="btn way-next" type="button" data-w="next">Next: ${esc(nx.short)}${icon('right')}</button>`
        : `<button class="btn way-next" type="button" data-w="again">${icon('path')}Walk it again</button>`}</div>`;
  WY.el.classList.toggle('fold', WY.fold); WY.el.classList.toggle('more', WY.more);
}
/* the bar along the bottom: the seven stops */
function renderWayBar() {
  const n = WAY.length;
  WY.bar.innerHTML = `<button class="iconbtn" type="button" data-w="prev" aria-label="Back along the way" ${WY.i === 0 ? 'disabled' : ''}>${icon('left')}</button>
    <ol class="way-track">${WAY.map((s, k) => `<li class="${k < WY.i ? 'done' : k === WY.i ? 'now' : ''}"><button type="button" data-w="go:${k}" aria-label="Stop ${k + 1} of ${n}: ${esc(s.name)}"${k === WY.i ? ' aria-current="step"' : ''}><span class="c">${k + 1}</span><b>${esc(s.short)}</b></button></li>`).join('')}</ol>
    <button class="iconbtn" type="button" data-w="next" aria-label="On along the way" ${WY.i === n - 1 ? 'disabled' : ''}>${icon('right')}</button>`;
}
function showWay() {
  document.body.classList.remove('insp-on');
  if (!INS.hidden) { INS.classList.add('leave'); setTimeout(() => { if (!document.body.classList.contains('insp-on')) INS.hidden = true; }, REDUCED ? 0 : 220); }
  renderWay(); renderWayBar();
}
// the bar follows you to a stop without flying there (for when you went by another road)
function wayAt(k) {
  const i = typeof k === 'number' ? k : WAY_BY[k]; if (i == null || i === WY.i) return;
  WY.i = i; ME.way = i; saveMe(); renderWayBar(); if (!document.body.classList.contains('insp-on')) renderWay();
}
const wayDur = v => clamp(1.8 + controls.target.distanceTo(v.t) / 24, 1.8, 5.2);
function goWay(i, o = {}) {
  i = clamp(Math.round(+i) || 0, 0, WAY.length - 1); const s = WAY[i];
  closePops(); if (story.on) stopStory(false); if (fire.on) leaveFireside(false);
  if (!$('#spotModal').hidden) closeSpot();
  WY.i = i; ME.way = i; saveMe();
  // on a phone the card opens short at every stop, and folded at the vision, so the temple of 2029 and The Seed show together
  WY.more = false; if (WY.autoFold) { WY.fold = false; WY.autoFold = false; }
  if (innerWidth <= 760 && i === WAY_BY.vision && !WY.fold) { WY.fold = true; WY.autoFold = true; }
  current = null; selBox = null; $('#selLabel').hidden = true; brks.forEach(b => b.hidden = true);
  $$('.row', $('#panel')).forEach(b => b.classList.remove('sel'));
  showWay();
  // from stop to stop the camera keeps to the way, as a walker would; from far off the way it rises over the playa and comes down at the stop
  const v = s.view(), dist = controls.target.distanceTo(v.t), sNow = nearestS(controls.target), hop = s.s == null ? 0 : Math.abs(s.s - sNow);
  const along = o.along !== false && !inside && !REDUCED && hop >= 14 && controls.target.distanceTo(wayP(sNow)) < 45;
  const dur = o.dur ?? (along ? clamp(2.2 + hop / 16, 2.4, 7.5) : wayDur(v));
  if (!along && o.lift !== false && dist > 40 && !REDUCED) v.lift = clamp(dist * 0.8, 30, 110);
  playing = false; $('#playBtn').innerHTML = icon('play');
  if (inside) leavePlace(v, o.then); else if (along) flyAlong(v, dur, o.then, s.s); else flyTo(v, dur, o.then);   // leaving a place stops its clock, so the day is set after
  if (o.clock !== false) clockAnim = { from: clock, to: s.clock, t0: performance.now(), dur: REDUCED ? 1 : Math.max(1800, dur * 1000) };
}
function wayAct(k, el) {
  const [a, x] = k.split(':');
  if (a === 'next') { if (WY.i < WAY.length - 1) goWay(WY.i + 1); return; }
  if (a === 'prev') { if (WY.i > 0) goWay(WY.i - 1); return; }
  if (a === 'go') { goWay(+x); return; }
  if (a === 'again') { goWay(0); return; }
  if (a === 'fold') { WY.fold = !WY.fold; WY.autoFold = false; renderWay(); return; }
  if (a === 'more') { WY.more = !WY.more; renderWay(); const b = WY.el.querySelector('.way-more'); if (b) b.focus(); return; }
  if (a === 'book') { openBook(0); return; }
  if (a === 'card') { openPlinthDeck(); return; }
  if (a === 'through') { goWay(WAY_BY.drift); return; }
  if (a === 'fire') { openFireside(); return; }
  if (a === 'firechoose') { openFireside('random'); return; }
  if (a === 'mahal') { select('MAHAL_COIL'); return; }
  if (a === 'coil') { openSpot('MAHAL_COIL'); return; }
  if (a === 'apply') { openJoin('camp'); return; }
  if (a === 'tent') { select('CAMP_TENT'); return; }
  if (a === 'kitchen') { select('CAMP_KITCHEN'); return; }
  if (a === 'crews') { select('CREWS'); return; }
  if (a === 'guide') { select('GUIDE'); return; }
  if (a === 'buildfilm') { openBuildFilm(); return; }
  if (a === 'inside') { select('CENTRE'); return; }
  if (a === 'give') { openJoin('back'); return; }
}
document.addEventListener('click', e => { const b = e.target.closest('#way [data-w], #wayBar [data-w]'); if (b && !b.disabled) wayAct(b.dataset.w, b); });
WY.el.addEventListener('click', e => { const t = e.target.closest('[data-act^="img:"]'); if (t) openImage(t.dataset.act.slice(4)); });

/* the card waits while you look at something else, and comes back when you close it */
const _setInspector = setInspector;
setInspector = function (html) { document.body.classList.add('insp-on'); _setInspector(html); };
deselect = function (goHome = true) {
  current = null; selBox = null; $('#selLabel').hidden = true; brks.forEach(b => b.hidden = true);
  $$('.row', $('#panel')).forEach(b => b.classList.remove('sel'));
  showWay();
  if (goHome) { const v = WAY[WY.i].view(); if (inside) leavePlace(v); else flyTo(v, 1.5); }
};
showWelcome = function () { if (!current && !fire.on && !story.on) showWay(); };
const _select = select;
select = function (id, opts = {}) { _select(id, opts); const w = wayOf(id); if (w && REG[id]) wayAt(w); };
function wayArrive(first) {
  const i = clamp(+ME.way || 0, 0, WAY.length - 1);
  if (first && !REDUCED) {           // the first time: dawn over the whole way, and down to the book where it begins
    clock = 6 * 60 + 40; applyTime(clock); setView(W6.views.arrive());
    document.body.classList.add('arrival'); goWay(0, { dur: 6.2, along: false, lift: false }); setTimeout(endArrival, 6600);
  } else goWay(i, { dur: 2.4 });
}

/* the card at the threshold: the deck rises from its stand beside the book, the way it rises over the fire at the camp */
function openPlinthDeck() { wayAt('book'); fire.where = 'plinth'; openFireside('deck'); }

/* ---------- the money raised for The Seed, in the top bar ---------- */
function renderRaise() {
  const R = raiseNow(), pct = R.target ? Math.min(100, R.raised / R.target * 100) : 0;
  $('#raiseNow').textContent = money(R.raised, R.cur); $('#raiseGoal').textContent = money(R.target, R.cur);
  $('#raiseBar').style.width = Math.max(1.5, pct).toFixed(1) + '%';
  $('#raiseBtn').setAttribute('aria-label', `${money(R.raised, R.cur)} raised of ${money(R.target, R.cur)} for The Seed. See the ways to give.`);
}
$('#raiseBtn').addEventListener('click', () => openJoin('back'));

/* ---------- the gates: ways to give, each with its gift. They lock nothing ---------- */
function gateCard(g) {
  const N = DATA.gates.length;
  return head('gate', `Gate ${g.n} of ${N} · a way to give`, g.name, 'A gateway on the way to The Seed') + `<div class="insp-body">
    <div class="amount"><b>${esc(g.amount)}</b>${chip('Working figure', 'wait')}</div>${payCur7(g.n)}
    <ul class="opens"><li>${icon('gift')}<span><b>Our thank-you:</b> ${esc(g.gift)}</span></li><li>${icon('dome')}<span><b>What it builds:</b> ${esc(g.builds)}</span></li>${g.badge ? `<li>${icon('star')}<span><b>Badge:</b> ${esc(g.badge)}</span></li>` : ''}</ul>
    ${g.extra ? `<p>${esc(g.extra)}.</p>` : ''}
    ${budgetBar()}
    <div class="actions"><button class="btn primary" data-act="pledge:${g.n}">${icon('gift')}Choose this gate</button>${g.n > 1 ? `<button class="btn" data-sel="GATE_${g.n - 1}">Gate ${g.n - 1}</button>` : ''}${g.n < N ? `<button class="btn" data-sel="GATE_${g.n + 1}">Gate ${g.n + 1}</button>` : ''}</div>
    <p class="note strong">Amounts are working figures and may change. ${payNote7('card', g.n)}</p></div>`;
}
showGate = function (n) {
  const g = GATE_BY(n); if (!g || !n) { openJoin('back'); return; } gateN = n; gateThen = null; lastFocus = document.activeElement;
  $('#gateTitle').textContent = `Gate ${n}: ${g.name}`;
  $('#gateBody').innerHTML = `<div class="gate-hero"><span class="gate-lamp" style="background:${GATE_COL[g.col] || 'var(--yellow)'}">${n}</span><div><div class="amount"><b>${esc(g.amount)}</b>${chip('Working figure', 'wait')}</div>${payCur7(n)}<small class="note">One of seven gates on the way in to The Seed</small></div></div>
    <ul class="opens"><li>${icon('gift')}<span><b>Our thank-you:</b> ${esc(g.gift)}</span></li>${g.builds ? `<li>${icon('dome')}<span><b>What it builds:</b> ${esc(g.builds)}</span></li>` : ''}${g.badge ? `<li>${icon('star')}<span><b>Badge:</b> ${esc(g.badge)}</span></li>` : ''}</ul>
    ${g.extra ? `<p>${esc(g.extra)}.</p>` : ''}${g.rd ? '<p class="note">The gifts are also research and development: the gates fund the first batch of pendants, coils and light boxes.</p>' : ''}
    ${n >= 6 ? `<p class="note">A vision, not a plan.</p>` : ''}`;
  $('#gateFoot').innerHTML = `<span class="note strong">Working amounts, not final. ${payNote7('sheet', n)}</span>
    <button class="btn" data-g="close">Not now</button><button class="btn primary" data-g="pledge">${icon('gift')}Choose this gate</button>`;
  GM.hidden = false; setTimeout(() => ($('[data-g="pledge"]', GM) || $('#gateClose')).focus(), 30);
};
GM.addEventListener('click', e => { const b = e.target.closest('[data-g="pledge"]'); if (!b) return; const n = gateN; closeGate(); openJoin('back', n); });

/* ---------- the camp: the main tent, the kitchen and the crews ---------- */
reg('CAMP_TENT', { kind: 'tent', title: 'The main tent', chip: 'Playlists and sets', obj: null, anchor: 'CAMP',
  focus: () => ({ t: V3((CAMP.x + SAIL.x) / 2, 1, (CAMP.z + SAIL.z) / 2), d: 48, p: 1.0, a: 2.45 }) });   // the camp around it: the sail alone reads as a white sheet
reg('CREWS', { kind: 'crews', title: 'The crews', chip: 'Join one', obj: null, anchor: 'CAMP', focus: () => ({ t: V3(CAMP.x + 1, 1, CAMP.z + 2), d: 60, p: 0.95, a: 2.45 }) });
reg('GUIDE', { kind: 'guide', title: 'The build guideline', chip: 'Build yard', obj: null, anchor: 'YARD', focus: () => ({ t: V3(YARD.x, 1, YARD.z), d: 46, p: 0.98, a: 0.95 }) });
INDEX.push({ id: 'CAMP_TENT', label: 'The main tent', sub: 'Camp · playlists and sets', key: '' }, { id: 'CREWS', label: 'The crews', sub: 'Camp', key: '' }, { id: 'GUIDE', label: 'The build guideline', sub: 'Build yard', key: '' });
const V5 = { sounds: [], shifts: [], mySounds: [], myShifts: [] };
try { V5.mySounds = JSON.parse(localStorage.getItem('mahala.sounds') || '[]'); V5.myShifts = JSON.parse(localStorage.getItem('mahala.shifts') || '[]'); } catch (e) { }
if (!Array.isArray(V5.mySounds)) V5.mySounds = []; if (!Array.isArray(V5.myShifts)) V5.myShifts = [];
const canShare = () => !!(LIVE.uid && LIVE.write !== false);
const safeUrl = u => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch (e) { return null; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\.|^open\./, ''); } catch (e) { return ''; } };
const KIND_S = { playlist: 'A playlist', set: 'A DJ set', rec: 'A recording' };
function soundsAll() {      // every camp mate's links, newest first; mine come from the shared list when it is there, else from this browser
  const out = []; const seen = new Set();
  for (const d of V5.sounds) for (const p of (d.p || [])) { const url = safeUrl(p.url); if (!url) continue; out.push({ ...p, url, by: d.name || '', mine: d.id === LIVE.uid, owner: d.id, local: false }); seen.add(d.id + p.i); }
  if (!canShare()) for (const p of V5.mySounds) { const url = safeUrl(p.url); if (url) out.push({ ...p, url, by: ME.show ? ME.name || '' : '', mine: true, local: true }); }
  return out.sort((a, b) => (b.t || 0) - (a.t || 0));
}
const sndRow = it => `<div class="snd"><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer"><span class="snd-ic">${icon('sound')}</span><span class="snd-t"><b>${esc(it.title)}</b><small>${esc(KIND_S[it.k] || 'A set')}${it.by ? ' · ' + esc(it.by) : ''} · ${esc(hostOf(it.url))}</small></span>${icon('right')}</a>${it.mine ? `<button class="iconbtn" data-act="sndrm:${esc(it.i)}" aria-label="Take ${esc(it.title)} off the list">${icon('x')}</button>` : ''}</div>`;
function tentCard() {
  const items = soundsAll(), can = canShare();
  return head('tent', 'Mahala camp · the main tent', 'The main tent', 'Playlists and sets from camp mates') + `<div class="insp-body">
    <p>In the shade of the main tent, camp mates share the music they love: playlists, DJ sets and recordings.</p>
    <div class="snd-list">${items.length ? items.slice(0, 40).map(sndRow).join('') : `<p class="note">${can ? 'No sets yet. Add the first one below.' : 'Camp mates add their playlists and sets here.'}</p>`}</div>
    <form class="snd-form" id="sndForm" autocomplete="off">
      <h4 class="eyebrow">Add yours</h4>
      <div class="field"><label for="snd-t">What it is called</label><input id="snd-t" maxlength="80" required></div>
      <div class="field"><label for="snd-u">Its link</label><input id="snd-u" type="url" inputmode="url" maxlength="300" placeholder="https://" required></div>
      <div class="pick" role="group" aria-label="What kind it is">${Object.entries(KIND_S).map(([k, t], j) => `<button type="button" data-sk="${k}" aria-pressed="${j === 0}">${t}</button>`).join('')}</div>
      <div class="actions"><button class="btn primary" type="submit">${icon('plus')}Add it to the tent</button></div>
      <p class="note">${can ? 'Everyone with the link to the Mahalaverse can see it, with your name if you chose to show your name.' : 'Your link is kept in this browser: it cannot reach the shared list from here.'}</p>
    </form>
    <div class="sect"><h4>From the Lotus Mahal</h4><div class="snd"><a href="${esc(CONFIG.album)}" target="_blank" rel="noopener noreferrer"><span class="snd-ic">${icon('sound')}</span><span class="snd-t"><b>Sunrise at the Mahal</b><small>By Gustav Loubser · spotify.com</small></span>${icon('right')}</a></div></div>
    <p class="note">Links open in a new tab, on the site that holds the music.</p></div>`;
}
// redraw the open card in place: no fade, the same scroll, and never over a camp mate's half-typed link
function refreshCard(id, live = false) {
  if (current !== id || INS.hidden || !REG[id]) return;
  if (live && (INS.querySelector('input:focus, textarea:focus') || [...INS.querySelectorAll('input, textarea')].some(x => x.value.trim()))) { V5.pending = id; return; }
  V5.pending = null;
  const b = INS.querySelector('.insp-body'), top = b ? b.scrollTop : 0, keep = setInspector;
  setInspector = html => { document.body.classList.add('insp-on'); INS.innerHTML = html; INS.hidden = false; INS.classList.remove('leave'); };
  try { renderInspector(REG[id]); } finally { setInspector = keep; }
  const b2 = INS.querySelector('.insp-body'); if (b2) b2.scrollTop = top;
}
INS.addEventListener('focusout', () => setTimeout(() => { if (V5.pending && !INS.contains(document.activeElement)) refreshCard(V5.pending, true); }, 0));
INS.addEventListener('click', e => { const b = e.target.closest('#sndForm [data-sk]'); if (!b) return; $$('#sndForm [data-sk]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
INS.addEventListener('submit', e => {
  if (e.target.id !== 'sndForm') return; e.preventDefault();
  const title = $('#snd-t').value.trim().slice(0, 80), url = safeUrl($('#snd-u').value.trim()), k = ($('#sndForm [data-sk][aria-pressed="true"]') || {}).dataset?.sk || 'playlist';
  if (!title) { toast('Give it a name first.'); return; } if (!url) { toast('That link needs to start with https://'); return; }
  const item = { i: 's' + Date.now().toString(36), t: Date.now(), title, url, k };
  if (canShare()) { const mine = ((V5.sounds.find(d => d.id === LIVE.uid) || {}).p || []).concat([item]).slice(-12);
    writeDoc('sounds/' + LIVE.uid, { p: mine, name: ME.show ? String(ME.name || '').slice(0, 40) : '', at: Date.now() }); toast('Thank you. A steward listens first, then it plays in the tent for everyone.'); }
  else { V5.mySounds = V5.mySounds.concat([item]).slice(-12); try { localStorage.setItem('mahala.sounds', JSON.stringify(V5.mySounds)); } catch (er) { } toast('Kept in this browser.'); }
  chime('soft'); refreshCard('CAMP_TENT');
});
function dropSound(id) {
  if (canShare()) { const mine = ((V5.sounds.find(d => d.id === LIVE.uid) || {}).p || []).filter(p => p.i !== id); writeDoc('sounds/' + LIVE.uid, { p: mine, name: ME.show ? String(ME.name || '').slice(0, 40) : '', at: Date.now() }); }
  else { V5.mySounds = V5.mySounds.filter(p => p.i !== id); try { localStorage.setItem('mahala.sounds', JSON.stringify(V5.mySounds)); } catch (er) { } }
  refreshCard('CAMP_TENT');
}

// the kitchen: the camp cooks one main dinner a day, and each dinner is cooked by a team of camp mates
const MEALS = [['d', 'The main dinner']];
const KDAYS = [['mon', 'Mon 26 Apr'], ['tue', 'Tue 27 Apr'], ['wed', 'Wed 28 Apr'], ['thu', 'Thu 29 Apr'], ['fri', 'Fri 30 Apr'], ['sat', 'Sat 1 May'], ['sun', 'Sun 2 May']];
const SHIFT_N = 8;
const SHIFT_KEYS = new Set(KDAYS.flatMap(([dk]) => MEALS.map(([mk]) => dk + '-' + mk)));
const myShifts = () => (canShare() ? (((V5.shifts.find(d => d.id === LIVE.uid) || {}).s) || []) : V5.myShifts).filter(k => SHIFT_KEYS.has(k));
function shiftCounts() { const c = {}; for (const d of V5.shifts) { if (canShare() && d.id === LIVE.uid) continue; for (const k of (d.s || [])) c[k] = (c[k] || 0) + 1; } for (const k of myShifts()) c[k] = (c[k] || 0) + 1; return c; }
function kitchenCard() {
  const c = shiftCounts(), mine = new Set(myShifts()), can = canShare();
  const cell = (dk, mk, mt) => { const key = dk + '-' + mk, n = c[key] || 0, me = mine.has(key), full = n >= SHIFT_N && !me;
    return `<button class="shift${me ? ' me' : ''}${full ? ' full' : ''}" data-act="shift:${key}" aria-pressed="${me}" aria-label="${mt}, ${n} of ${SHIFT_N} cooks${me ? ', you are on it' : ''}"><span class="lab">${me ? icon('check') + 'You are cooking' : full ? 'Full' : 'Cook this one'}</span><span class="mono">${n}/${SHIFT_N}</span></button>`; };
  return head('kitchen', 'Mahala camp · the kitchen', 'The camp kitchen', 'Meal shifts for the burn') + `<div class="insp-body">
    <p>The camp shares one main dinner a day, cooked by a team of camp mates. Choose the night you will cook, and the kitchen crew will plan the menu with you.</p>
    <div class="shifts one" role="table" aria-label="Dinner teams, 26 April to 2 May 2027"><div class="sh-row sh-head" role="row"><span role="columnheader">The night</span>${MEALS.map(([, t]) => `<span role="columnheader">${t}</span>`).join('')}</div>
      ${KDAYS.map(([dk, dt]) => `<div class="sh-row" role="row"><span role="rowheader">${dt}</span>${MEALS.map(([mk, mt]) => `<span role="cell">${cell(dk, mk, mt + ', ' + dt)}</span>`).join('')}</div>`).join('')}</div>
    <p class="note">${mine.size ? `You are cooking on ${mine.size} night${mine.size === 1 ? '' : 's'}. ` : ''}${can ? 'Here you see how many cook each night. Your name is kept with your nights only if you chose to show it.' : 'Your nights are kept in this browser: they cannot reach the shared roster from here.'} A first plan, for the kitchen crew to shape. Gluten-free, vegetarian and dairy-free needs are planned for.</p>
    ${links([['Q-05', 'Quest', 'Host the build kitchen'], ['E-03', 'Event', 'The theatrical dinner']])}</div>`;
}
function toggleShift(key) {
  const s = new Set(myShifts());
  if (s.has(key)) s.delete(key); else { if ((shiftCounts()[key] || 0) >= SHIFT_N) { toast('That shift is full. Choose another one.'); return; } s.add(key); }
  if (canShare()) writeDoc('shifts/' + LIVE.uid, { s: [...s], name: ME.show ? String(ME.name || '').slice(0, 40) : '', at: Date.now() }).then(() => {});
  else { V5.myShifts = [...s]; try { localStorage.setItem('mahala.shifts', JSON.stringify(V5.myShifts)); } catch (e) { } }
  if (canShare()) { const d = V5.shifts.find(x => x.id === LIVE.uid); if (d) d.s = [...s]; else V5.shifts.push({ id: LIVE.uid, s: [...s] }); }
  chime('soft'); refreshCard('CAMP_KITCHEN');
}
function crewsCard() {
  return head('crews', 'Mahala camp · the crews', 'The crews', 'Choose where your hands go') + `<div class="insp-body">
    <p>Each crew carries one part of the temple or the camp. Join the one that calls you. You can change it later.</p>
    <div class="crew-list">${DATA.crews.map(c => { const mine = ME.crew === c.id;
      return `<div class="crew-row${mine ? ' mine' : ''}"><button class="crew-go" data-sel="${c.id}"><b>${esc(c.name)}</b><small>${esc(c.what)}</small></button>${mine ? chip('Your crew', 'done') : `<button class="btn" data-act="crewjoin:${c.id}">Join</button>`}</div>`; }).join('')}</div>
    <p class="note">Other builders see your crew beside your name, if you chose to show your name.</p></div>`;
}
const DAYS5 = ['Setting out: the floor pattern, the sill ring and the anchors', 'The base and the doorway, then the first rings of the shell', 'Three more rings, glazed as they go up',
  'The scaffold tower goes in, and the last rings close the shell', 'The cap is lifted on, then the spine, the petals, the copper forms and the lights'];
const STEPS13 = [['Timber in', 'Bring the boards in, check them and plane them to one size'], ['The jigs', 'Build a jig for every step before cutting anything'],
  ['Dock', 'Cut the boards into blanks, longest piece first'], ['The joints', 'Housings on the square rings, angled ends on the sharp ones'],
  ['Frame', 'Glue each frame around a plug cut to the panel\'s window'], ['Bevels', 'Trim each frame to its true outline with a saw on a rail'],
  ['Bolt holes', 'Drill every edge, so neighbouring panels meet'], ['Mid-rail', 'A rail across the panel, so the sheet does not drum in the wind'],
  ['Acrylic', 'Cut and drill every coloured sheet of a ring from one master'], ['Glaze', 'Fix the sheet to its frame, from the centre outwards'],
  ['Test', 'Bolt the panels together in the yard'], ['Pack', 'Pack the panels for the road to the playa'], ['Dome', 'Raise the dome on the playa']];
function guideCard() {
  return head('guide', 'The build yard', 'The build guideline', 'From the workshop to the playa') + `<div class="insp-body">
    <p class="spine">The Seed would be made flat in a Cape Town workshop, then raised on the Tankwa Karoo playa in five days.</p>
    <div class="actions"><button class="btn primary" data-act="buildfilm">${icon('film')}Watch the build</button><a class="btn" href="${esc(CONFIG.guide)}" target="_blank" rel="noopener">${icon('book')}The full build guide</a></div>
    <div class="sect"><h4>Five days on the playa</h4><ol class="days">${DAYS5.map((t, i) => `<li><b>Day ${i + 1}</b><span>${esc(t)}</span></li>`).join('')}</ol>
      <p class="note">Never leave a ring open overnight: if a day runs long, the next ring waits for the morning.</p></div>
    <div class="sect"><h4>In the workshop, step by step</h4><ol class="steps13">${STEPS13.map(([t, s]) => `<li><b>${esc(t)}</b><span>${esc(s)}</span></li>`).join('')}</ol></div>
    <p class="note">Concept visualisation of a proposed temple.</p></div>`;
}
function openBuildFilm() { FV.poster = 'assets/build_sequence_poster.jpg'; openFilm(CONFIG.buildFilm, 'The build, 67 seconds: six months in the workshop, then five days on the playa, ring by ring. The figures on screen are estimates from the October 2026 budget. Concept visualisation of a proposed temple.', false); }

/* the cards the inspector shows now: the new places, and the old ones without their locks */
const _v4CardIn = v4CardIn;
v4CardIn = function (it, h) {
  const k = it.kind;
  if (k === 'tent') return tentCard();
  if (k === 'kitchen') return kitchenCard();
  if (k === 'crews') return crewsCard();
  if (k === 'guide') return guideCard();
  if (k === 'gate') return gateCard(it.g);
  if (k === 'temple') return injectTop(h, budgetBar());
  if (k === 'portal') return injectTop(h, `<div class="actions"><button class="btn primary" data-act="waythrough">${icon('gate')}Walk through the portal</button></div>`);
  if (k === 'lotus') return injectTop(h, `<p class="note strong">Sound journeys gather here. Dates and guests are announced once they are confirmed.</p>`);
  if (k === 'camp' || k === 'drift' || k === 'fire' || k === 'centre') return h;
  return _v4CardIn(it, h);
};
const _v4Act = v4Act;
v4Act = function (act, a) {
  const [k, x] = act.split(':');
  if (k === 'pledge') { openJoin('back', +x); return true; }
  if (k === 'shift') { toggleShift(act.slice(6)); return true; }
  if (k === 'sndrm') { dropSound(x); return true; }
  if (k === 'buildfilm') { openBuildFilm(); return true; }
  if (k === 'waythrough') { goWay(WAY_BY.drift); return true; }
  if (k === 'givegate') { openJoin('back'); return true; }
  return _v4Act(act, a);
};

/* ---------- the shared lists of the camp: the main tent and the kitchen roster ---------- */
V5_LIVE.push(db => {
  const rows = s => s.docs.map(d => Object.assign({ id: d.id }, d.data()));
  const sub = (path, fn) => { try { db.collection(path).onSnapshot(fn, e => console.warn('db', path, e && e.code)); } catch (e) { console.warn(e); } };
  sub('sounds', s => { V5.sounds = rows(s); refreshCard('CAMP_TENT', true); });
  sub('shifts', s => { V5.shifts = rows(s); refreshCard('CAMP_KITCHEN', true); });
});

/* ---------- the explore bar: the lists open when you ask for them ---------- */
function openExplore(t) { if (t) tab = t; EXPLORE.open = true; renderTabs(); closeMenu(); }
/* ---------- the phone menu ---------- */
const MENU = $('#menuPop');
function closeMenu() { if (MENU) { MENU.hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); } }
function renderMenu() {
  MENU.innerHTML = [['home', 'left', 'Home: the front page'], ['take', 'gate', 'Take part'], ['explore', 'path', 'The story, gates, events and more'], ['search', 'search', 'Search'], ['time', 'sun', 'Time of day'], ['sound', SND.on ? 'sound' : 'mute', SND.on ? 'Sound off' : 'Sound on'], ['path', 'star', 'Your path']]
    .map(([k, ic, t]) => `<button type="button" data-m="${k}">${icon(ic)}${t}</button>`).join('');
}
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); const open = MENU.hidden; closePops(); if (open) renderMenu(); MENU.hidden = !open; $('#menuBtn').setAttribute('aria-expanded', String(open)); });
MENU.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; const k = b.dataset.m; closeMenu();
  if (k === 'home') { location.href = './'; return; }
  if (k === 'take') openJoin(); if (k === 'explore') openExplore(); if (k === 'path') openPath(); if (k === 'sound') setSound(!SND.on);
  if (k === 'search') { $('#search').classList.add('open'); setTimeout(() => $('#q').focus(), 0); }
  if (k === 'time') $('#sunctl').classList.toggle('open'); });
document.addEventListener('click', e => { if (MENU && !MENU.hidden && !e.target.closest('#menuPop,#menuBtn')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MENU && !MENU.hidden) { e.stopImmediatePropagation(); closeMenu(); const b = $('#menuBtn'); if (b) b.focus(); } }, true);

renderRaise(); renderWayBar(); renderWay();

/* "Show my name" switched off, or a new name: the copies of your name beside your music in the main tent, on the kitchen
   roster and on a line still waiting at the fire follow it, so a name you hid does not stay on show (security review L4) */
let lineNameSeen = null;
function syncMyName() {
  if (!canShare() || !LIVE.db) return;
  const nm = ME.show ? String(ME.name || '').slice(0, 40) : '';
  const snd = V5.sounds.find(d => d.id === LIVE.uid), sh = V5.shifts.find(d => d.id === LIVE.uid);
  if (snd && (snd.name || '') !== nm) writeDoc('sounds/' + LIVE.uid, { p: Array.isArray(snd.p) ? snd.p : [], name: nm, at: Date.now() });
  if (sh && (sh.name || '') !== nm) writeDoc('shifts/' + LIVE.uid, { s: Array.isArray(sh.s) ? sh.s : [], name: nm, at: Date.now() });
  if (lineNameSeen === nm) return; lineNameSeen = nm;
  (async () => { try { const ref = LIVE.db.doc('fire/' + LIVE.uid), cur = await ref.get(); const d = cur.exists ? cur.data() : null; if (d && (d.name || '') !== nm) await ref.set(Object.assign({}, d, { name: nm })); } catch (e) { } })();
}
{ const _pushMe = pushMe; pushMe = function () { const r = _pushMe.apply(this, arguments); try { syncMyName(); } catch (e) { console.warn(e); } return r; }; }


/* ====================== v6: the world laid along the way ======================
   One winding path crosses the playa from the Book of Mahala, far to the east, to the door of The Seed. The seven stops and the
   seven gates stand beside it, or across it, in the order you meet them, and the camera keeps to the way from stop to stop. */
// a view of something by the way: from behind it (back along the way) and out to one side, looking on along the way past it.
// side > 0 stands on your right as you walk; on a wide screen the way ahead then runs off to the clear right of the card
function wayLook(s, at, { d, p, back = 0.8, side = 0 }) {
  const u = wayT(s).multiplyScalar(-back).addScaledVector(wayN(s), side); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize();
  return { t: at.clone(), d, p, a: Math.atan2(u.x, u.z) };
}
const W6 = { wayLook, setView: v => setView(v), views: {} };

/* the seven stops, where they stand on the way and how you see them */
const STOP_S = { book: ST.book, portal: ST.portal, drift: ST.drift, mahal: ST.mahal, camp: ST.camp, yard: ST.yard, seed: WAY_LEN };
const STOP_VIEW = {
  book: () => wayLook(ST.book, BOOK_AT.clone().lerp(wayP(ST.book + 10), innerWidth <= 760 ? 0.12 : 0.4).setY(1.1), { d: 20, p: 1.2, back: 1, side: 0.3 }),   // on a phone the book stays nearer the middle
  portal: () => wayLook(ST.portal, PORTAL.clone().setY(2.2), { d: 30, p: 1.2, back: 1, side: 0.4 }),
  drift: () => wayLook(ST.drift, DRIFT.clone().setY(1.5), { d: 38, p: 1.08, back: 0.7, side: 0.9 }),
  mahal: () => wayLook(ST.mahal, CAMP.clone().setY(2.2), { d: 42, p: 1.04, back: 0.3, side: 1 }),
  camp: () => wayLook(ST.camp, CAMP_HEART.clone().setY(1), { d: 70, p: 0.98, back: 1, side: 0.35 }),
  yard: () => wayLook(ST.yard, YARD.clone().setY(1), { d: 60, p: 1.0, back: 0.6, side: 1 }),
  seed: () => wayLook(WAY_LEN - 4, V3(4, 2.4, 0), { d: 74, p: 1.1, back: 1, side: 0.3 }),
};
WAY.forEach(w => { w.s = STOP_S[w.id]; if (STOP_VIEW[w.id]) w.view = STOP_VIEW[w.id]; });

/* the places, the gates and the camp's own corners, seen from the way */
const GATE_VIEW = id => { const g = GATES[id]; return wayLook(g.userData.s, g.userData.c.clone().setY(1.9), { d: 14, p: 1.22, back: 1, side: 0.45 }); };
DATA.gates.forEach(g => { if (REG[g.id]) REG[g.id].focus = () => GATE_VIEW(g.id); });
REG.CAMP_PORTAL.focus = () => wayLook(ST.portal, PORTAL.clone().setY(2.4), { d: 22, p: 1.2, back: 1, side: 0.4 });
REG.CAMP_DRIFT.focus = () => wayLook(ST.drift, DRIFT.clone().setY(1.6), { d: 30, p: 1.04, back: 0.7, side: 0.9 });
REG.CAMP.focus = () => wayLook(ST.camp, CAMP_HEART.clone().setY(1), { d: 66, p: 0.92, back: 1, side: 0.3 });
REG.CAMP_KITCHEN.focus = () => wayLook(ST.kitchen, KITCHEN.clone().setY(2), { d: 28, p: 1.04, back: 0.6, side: 1 });
REG.YARD.focus = () => wayLook(ST.yard, YARD.clone().setY(1), { d: 60, p: 0.94, back: 0.55, side: 1 });
REG.CAMP_TENT.focus = () => wayLook(ST.sail, beside(ST.sail, 6, 1).setY(1), { d: 40, p: 1.0, back: 0.6, side: -1 });   // the shade sail, with the camp around it
REG.CREWS.focus = () => wayLook(ST.camp, CAMP_HEART.clone().setY(1), { d: 60, p: 0.95, back: 1, side: 0.3 });
REG.GUIDE.focus = () => wayLook(ST.yard, YARD.clone().setY(1), { d: 46, p: 0.98, back: 0.55, side: 1 });

// the verse stones: a little higher than before, so a builder walking the way does not stand in front of the words
for (const v of VERSES) { const face = faceWay(v.at, nearestS(v.at)); if (REG[v.id]) REG[v.id].focus = () => ({ t: v.at.clone().setY(0.85), d: 10, p: 1.02, a: face + 0.3 }); }
// the bar follows you to the stop each gate stands before, and each verse stone to the stop it stands by
Object.assign(WAY_OF, { GATE_1: 'drift', GATE_2: 'mahal', GATE_3: 'camp', GATE_4: 'yard', GATE_5: 'seed', GATE_6: 'seed', GATE_7: 'seed', VERSE_1: 'portal', VERSE_2: 'seed', VERSE_3: 'yard' });

/* the story and the tour, at the places where they now stand */
const chap = (seq, title) => seq.find(c => c.title === title);
chap(STORY, 'The call').view = () => wayLook(ST.portal, PORTAL.clone().setY(2.6), { d: 27, p: 1.24, back: 1, side: 0.4 });
chap(STORY, 'The gathering').view = () => wayLook(ST.drift, DRIFT.clone().setY(2.6), { d: 27, p: 1.2, back: 0.7, side: 0.9 });
chap(STORY, 'The building').view = () => wayLook(ST.yard, YARD.clone().setY(1), { d: 50, p: 1.0, back: 0.55, side: 1 });
chap(TOUR, 'The gates').view = () => wayLook(ST.gate6, wayP(ST.gate6).setY(1.6), { d: 34, p: 1.16, back: -1, side: 0.45 });
chap(TOUR, 'The build yard').view = () => wayLook(ST.yard, YARD.clone().setY(1), { d: 52, p: 1.0, back: 0.55, side: 1 });
chap(TOUR, 'The camp').view = () => wayLook(ST.camp, CAMP_HEART.clone().setY(2), { d: 64, p: 1.0, back: 1, side: 0.3 });

/* the overview: the whole way, from The Seed in the west to the book in the east */
W6.views.top = () => ({ t: wayP(WAY_LEN / 2).setY(0), d: 330, p: 0.02, a: 0 });
W6.views.whole = () => ({ t: V3(104, 0, 4), d: 300, p: 0.86, a: 0.2 });
// arriving at dawn: high over the east end of the way, looking down its length to The Seed, before coming down to the book
W6.views.arrive = () => ({ t: wayP(104).setY(0), d: 300, p: 1.0, a: Math.atan2(0.99, -0.12) });

/* ====================== v7 world: the temple of 2029, the eighth stop, the seat of the cap, and the colours made steady ======================
   Inserted into the module by patch_v7_world.py, before the test hooks, so everything the world is made of is in scope.
   - A phantom far out on the playa, west of The Seed: a vast, faint silhouette of the grand temple Mahala dreams of for
     AfrikaBurn 2029, grown from The Seed. A mirage by day, a faint luminous outline at night. One mesh, one draw call.
   - The eighth stop of the way and the eighth chapter of the tour look over The Seed to it, and open the map of the
     temples to come (the world plugin, assets/v7/world/).
   - The finial cap, the stupa, is lifted onto the frame's top so its foot rests on the members instead of sinking into them.
   - The flat things on the ground (the way's ribbon, the floor pattern, the sun-painted floor, the star) are drawn in a
     fixed order, so they stop fighting each other, and the sun-painted floor no longer tints the glass in front of it.
     The big glows low down no longer show a hard edge where the playa cuts them.
   - A finishing pass on the look, each change named and cheap (see "the finish" below): dawn and dusk, the ground up
     close, the way's edges, the shadows on long views, haze, pools of lamplight, the night sky, the tents. */
const W7 = { open: null, mapOpen: false, phantom: null, capLift: 0, polarWas: null,
  openMap(from) {
    if (typeof W7.open === 'function') { W7.open(from); return; }
    import('./assets/v7/world/index.js').then(m => m.openAlone(window.__mahala, from)).catch(e => { console.warn(e); toast('The map of the temples to come did not open. Try again in a moment.'); });
  } };
{ const st = document.createElement('style'); st.id = 'v7-world-game-css'; st.textContent = "/* v7 world: the eighth stop is a vision, so the bar draws it, and the stretch of way to it, dashed: a path not yet walked */\n.way-track li:last-child:not(.now):not(.done) .c { border-style: dashed; }\n.way-track li:last-child::before { background: none !important; height: 0; border-top: 2px dashed var(--card-line); }\n.way-track li:last-child.done::before, .way-track li:last-child.now::before { border-top-color: var(--ink-3); }\n/* the small note under the vision's lines: a concept visualisation of a hope */\n.v7-world-waynote { margin: -4px 0 0; font-size: var(--fs-s, 12.5px); line-height: var(--lh-body, 1.45); color: var(--ink-3); }\n.way.fold .v7-world-waynote { display: none; }\n"; document.head.appendChild(st); }

/* ---------- the flat things on the ground: one fixed order, so nothing flickers ----------
   The ground writes depth. Everything painted on it writes none, passes the ground by a polygon offset, and is drawn in this
   order: the way (0.1), the dotted way beyond (0.15), the floor pattern's four colours (0.2 to 0.23); then, among the
   see-through things, the sun-painted floor (0.5) and the night star (0.6), both before the glass (1), which is in front of them. */
Object.assign(M.path, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); M.path.needsUpdate = true;
scene.children.forEach(o => { if (o.isMesh && o.material === M.path) o.renderOrder = 0.1; });
for (const k of ['fgCopper', 'fgTeal', 'fgAmber', 'fgPearl']) { Object.assign(M[k], { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); M[k].needsUpdate = true; }
Object.assign(M.pad, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); M.pad.needsUpdate = true;
lmPlane.renderOrder = 0.5; starDecal.renderOrder = 0.6;

/* ---------- the finial cap: seated on the top of the frame ----------
   In the model the cap's foot (a ring 0.516 m in radius at 4.64 m) sits about half a metre down inside the frame's converging
   members, so the stupa's bell is buried in the lattice. The frame's outer face reaches the foot's radius higher up: the cap
   is lifted by that difference, measured on the geometry as it loads, so its foot rests on the members all round. */
function frameTris(meshes, y0) {             // the frame's triangles above height y0, in world space, nine numbers each
  const a = V3(), b = V3(), c = V3(), out = [];
  for (const m of meshes) { const pos = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : pos.count, mw = m.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mw); b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(mw); c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(mw);
      if (Math.max(a.y, b.y, c.y) >= y0) out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); } }
  return out;
}
function frameRadiusAt(T, y) {               // the outermost radius where those triangles cross the plane at height y
  let r = 0;
  for (let i = 0; i < T.length; i += 9) for (let e = 0; e < 3; e++) {
    const p = i + e * 3, q = i + ((e + 1) % 3) * 3, py = T[p + 1], qy = T[q + 1];
    if ((py - y) * (qy - y) > 0 || py === qy) continue;
    const k = (y - py) / (qy - py); r = Math.max(r, Math.hypot(T[p] + k * (T[q] - T[p]), T[p + 2] + k * (T[q + 2] - T[p + 2])));
  }
  return r;
}
function seatCap(gltf) {
  const cap = gltf.scene.getObjectByName('CAP'), frame = REG.FRAME.meshes || [];
  if (!cap || !frame.length) return;
  temple.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cap), footY = box.min.y, footR = Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z);
  const top = frame.reduce((t, m) => Math.max(t, new THREE.Box3().setFromObject(m).max.y), 0);
  if (!(footR > 0.1 && top > footY)) return;
  const T = frameTris(frame, footY - 0.01);
  if (frameRadiusAt(T, footY) <= footR + 0.002) return;                 // already resting on (or above) the frame
  let lo = footY, hi = top;                                             // the frame narrows upwards: find where it is as wide as the foot
  for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (frameRadiusAt(T, mid) > footR) lo = mid; else hi = mid; }
  const lift = clamp(hi - footY + 0.003, 0, 1.2);
  cap.position.y += lift; cap.updateMatrixWorld(true); W7.capLift = lift;
  REG.CAP.focus = () => ({ t: V3(0, 5.4 + lift, 0), d: 17, p: 0.92 });
}
{ const _onTemple = onTemple;
  onTemple = function (gltf) {
    _onTemple(gltf);
    try { seatCap(gltf); } catch (e) { console.warn('the cap', e); }
    (REG.FLOOR_GRID.meshes || []).forEach((m, k) => { m.renderOrder = 0.2 + 0.01 * k; });
    if (builders) { builders.castShadow = false; builders.renderOrder = 0.4; }
  }; }
/* the walkers are the model's scale figures, a second kind of person beside the builders (who are dressed, with names).
   They are drawn as ghosts instead: pale, see-through, casting no shadow. Builders to come, never a stand-in for a person */
Object.assign(M.person, { transparent: true, opacity: 0.34, depthWrite: false }); M.person.color.set(0xefe6d8); M.person.emissive.set(0xefe6d8); M.person.needsUpdate = true;

/* ---------- the glows that reach below the playa ----------
   A glow is a soft disc that always faces the camera. The big ones low down (the sail's, 26 m across at 3.6 m up, and
   The Seed's two) hang partly below the ground, and the ground cut them along a hard line at night: a bright patch with a
   straight edge on the playa by the main tent, and a curved edge across the sail. Each of these now fades out towards
   the ground, by the height of each point of the disc, so nothing is left to cut; and the sail's glow, which also passed
   through the sail, is drawn as a pool of light on the ground under it instead (see the pools below). */
const LOW_GLOWS = GLOWS.filter(g => g.scale.y / 2 > g.position.y);
const SAIL_GLOW = LOW_GLOWS.find(g => g.scale.x > 20 && Math.abs(g.position.y - 3.6) < 0.05);
for (const g of LOW_GLOWS) {
  g.material.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;')
      .replace('mvPosition.xy += rotatedPosition;', 'mvPosition.xy += rotatedPosition;\n\tvWy = dot(viewMatrix[1].xyz, mvPosition.xyz - viewMatrix[3].xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.a *= smoothstep(0.0, 1.6, vWy);');
  };
  g.material.customProgramCacheKey = () => 'v7-lowglow'; g.material.needsUpdate = true;
}
if (SAIL_GLOW) SAIL_GLOW.userData.k = 0;     // its light goes on the ground instead

/* ---------- the temple of 2029: a phantom on the far playa ---------- */
const PH = V3(-236, 0, -4);                      // west of The Seed, behind it as you walk the way in from the east
function phantomGeometry() {
  const pos = [], nor = [], uv = [], part = [], idx = [];
  const add = (x, y, z, nx, ny, nz, u, v, k) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); part.push(k); return pos.length / 3 - 1; };
  // a smooth profile through a few points [r, y]
  const smoothProf = (P, n) => { const c = new THREE.CatmullRomCurve3(P.map(([r, y]) => V3(r, y, 0)), false, 'centripetal'); return c.getSpacedPoints(n).map(p => [Math.max(0, p.x), p.y]); };
  // a surface of revolution: u goes round, v runs up the profile by its length
  const lathe = (prof, seg, k, rot = 0) => {
    const L = [0]; for (let i = 1; i < prof.length; i++) L.push(L[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const base = pos.length / 3;
    for (let i = 0; i < prof.length; i++) {
      const [r, y] = prof[i], A = prof[Math.max(0, i - 1)], B = prof[Math.min(prof.length - 1, i + 1)], dr = B[0] - A[0], dy = B[1] - A[1], nl = Math.hypot(dr, dy) || 1;
      for (let j = 0; j <= seg; j++) { const t = rot + j / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); add(r * c, y, r * s, dy / nl * c, -dr / nl, dy / nl * s, j / seg, L[i] / L[L.length - 1], k); }
    }
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  };
  // the zome: The Seed's own profile, five times wider and almost seven times taller
  const R = 21, H = 38;
  lathe(smoothProf([[1, 0], [1, 0.206], [0.986, 0.305], [0.949, 0.403], [0.88, 0.502], [0.778, 0.602], [0.648, 0.699], [0.509, 0.771], [0.347, 0.828], [0.174, 0.896], [0, 1]].map(([r, y]) => [r * R, y * H]), 30), 72, 0);
  // the crown: a stupa seated where the zome is as wide as its foot, a spire, then the flame
  lathe(smoothProf([[3.6, 34.0], [3.15, 34.45], [2.9, 34.8], [2.9, 35.6], [2.5, 35.95], [2.68, 36.7], [2.7, 37.5], [2.35, 38.5], [1.75, 39.25], [1.2, 39.7], [1.32, 40.1], [1.08, 40.45], [0.88, 42.6], [0.58, 45.2], [0.32, 47.2], [0.16, 48.1], [0.0, 48.5]], 22), 40, 2);
  lathe(smoothProf([[0, 48.7], [0.5, 49.1], [0.78, 49.7], [0.72, 50.4], [0.5, 51.2], [0.24, 52.1], [0, 52.9]], 10), 24, 3);
  // the axis: a pole up the middle, from the floor to the crown, seen only as a faint line through the glass
  lathe([[0.62, 0], [0.52, 14], [0.44, 26], [0.38, 34.2]], 10, 4);
  // the petals: two rows of bracts opening round the base, like a king protea's
  const petal = (az, R0, L, W, a0, a1, cup) => {
    const er = V3(Math.cos(az), 0, Math.sin(az)), et = V3(-Math.sin(az), 0, Math.cos(az)), NS = 9, NT = 7, base = pos.length / 3, grid = [];
    let c = er.clone().multiplyScalar(R0); const cs = [];
    for (let i = 0; i <= NS; i++) { const s = i / NS, al = a0 + (a1 - a0) * Math.pow(s, 1.3); cs.push({ c: c.clone(), al }); c.addScaledVector(er, Math.sin(al) * L / NS).add(V3(0, Math.cos(al) * L / NS, 0)); }
    for (let i = 0; i <= NS; i++) { const s = i / NS, { c: p0, al } = cs[i], w = W * Math.sin(Math.PI * (0.12 + 0.88 * s)), n = er.clone().multiplyScalar(Math.cos(al)).add(V3(0, -Math.sin(al), 0));
      const row = []; for (let j = 0; j <= NT; j++) { const t = j / NT * 2 - 1; row.push(p0.clone().addScaledVector(et, t * w).addScaledVector(n, cup * (1 - t * t) * w)); } grid.push(row); }
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
      const p = grid[i][j], ds = grid[Math.min(NS, i + 1)][j].clone().sub(grid[Math.max(0, i - 1)][j]), dt = grid[i][Math.min(NT, j + 1)].clone().sub(grid[i][Math.max(0, j - 1)]);
      const nn = dt.clone().cross(ds).normalize(); if (nn.dot(er) < 0) nn.negate();
      add(p.x, p.y, p.z, nn.x, nn.y, nn.z, j / NT, i / NS, 1); }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) { const a = base + i * (NT + 1) + j, b = a + NT + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  };
  for (let k = 0; k < 6; k++) petal(k * Math.PI / 3, 19.6, 22, 8.2, 0.1, 0.62, 0.16);
  for (let k = 0; k < 6; k++) petal(k * Math.PI / 3 + Math.PI / 6, 21.6, 15.5, 6.6, 0.26, 0.86, 0.14);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('part', new THREE.Float32BufferAttribute(part, 1)); g.setIndex(idx);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
const PHU = { uTime: { value: 0 }, uNight: { value: 0 }, uVis: { value: 1 }, uSel: { value: 0 }, uDayK: { value: 0.72 }, uLatK: { value: 0.45 }, uHaze: { value: new THREE.Color() }, uSun: { value: V3(0, 1, 0) }, uSunCol: { value: new THREE.Color() } };
const phantomMat = new THREE.ShaderMaterial({
  uniforms: PHU, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, extensions: { derivatives: true },
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: `uniform float uTime; attribute float part; varying vec2 vUv; varying float vPart; varying vec3 vWp; varying vec3 vN;
    void main() {
      vUv = uv; vPart = part; vec3 p = position;
      float low = 1.0 - smoothstep(0.0, 18.0, p.y);                       // the heat shimmer: the lower part wavers, as a mirage does
      p.x += low * 0.9 * (sin(p.y * 0.55 + uTime * 1.3) * 0.6 + sin(p.y * 1.7 - uTime * 2.2 + p.z * 0.1) * 0.3);
      p.z += low * 0.7 * cos(p.y * 0.5 + uTime * 1.1 + p.x * 0.1);
      vec4 wp = modelMatrix * vec4(p, 1.0); vWp = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `uniform float uTime; uniform float uNight; uniform float uVis; uniform float uSel; uniform float uDayK; uniform float uLatK; uniform vec3 uHaze; uniform vec3 uSun; uniform vec3 uSunCol;
    varying vec2 vUv; varying float vPart; varying vec3 vWp; varying vec3 vN;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
    float line(float x, float w) { float d = abs(fract(x) - 0.5), fw = fwidth(x); return smoothstep(0.5 - w - fw, 0.5 - w + fw * 0.5, d); }
    void main() {
      vec3 V = normalize(cameraPosition - vWp), N = normalize(vN); if (!gl_FrontFacing) N = -N;
      float fres = pow(1.0 - abs(dot(N, V)), 2.6);
      // the lattice, only ever a hint: The Seed's two families of spirals on the zome, a looser weave on the petals, rings on the crown
      vec2 g = vPart < 0.5 ? vec2(vUv.x * 18.0 + vUv.y * 9.0, vUv.x * 18.0 - vUv.y * 9.0) : vPart < 1.5 ? vec2(vUv.x * 3.0 + vUv.y * 5.0, vUv.x * 3.0 - vUv.y * 5.0) : vec2(0.0, vUv.y * 9.0);
      float axis = step(3.5, vPart);                                        // the pole: an outline only, no rings
      float dist = length(cameraPosition - vWp), away = smoothstep(200.0, 450.0, dist);
      // thin lines, and thinner still with distance: far away it is an outline and a glow, never a design
      float lat = (vPart < 1.5 ? max(line(g.x, 0.04), line(g.y, 0.04)) : line(g.y, 0.04) * 0.6 * (1.0 - axis)) * mix(1.0, 0.55, away);
      float ring = floor(vUv.y * 9.0 + 0.001), ci = mod(ring, 3.0);
      vec3 glass = ci < 0.5 ? vec3(1.0, 0.86, 0.35) : ci < 1.5 ? vec3(0.45, 0.78, 1.0) : vec3(1.0, 0.5, 0.78);
      float near = smoothstep(70.0, 175.0, dist);                          // walk up to it and the vision dissolves
      float far = 1.0 - 0.55 * smoothstep(200.0, 520.0, dist);             // and from the way it stays a ghost behind The Seed
      // it never holds still or whole: the base melts into the haze, slow patches come and go, the lower air wavers
      float ground = smoothstep(0.0, 13.0, vWp.y + (vn(vWp.xz * 0.06 + vec2(uTime * 0.15, 0.0)) - 0.5) * 8.0);
      float drift = vn(vec2((vWp.x + vWp.z) * 0.05 + uTime * 0.04, vWp.y * 0.06 - uTime * 0.07));
      float shim = (0.25 + 0.75 * smoothstep(0.18, 0.75, drift)) * (0.8 + 0.3 * vn(vec2((vWp.x - vWp.z) * 0.2, vWp.y * 0.3 - uTime * 0.6)));
      float flick = 1.0 - 0.25 * (1.0 - smoothstep(0.0, 18.0, vWp.y)) * (0.5 + 0.5 * sin(vWp.y * 1.3 - uTime * 2.4));
      float vis = near * far * ground * shim * flick * uVis;
      float fl = step(2.5, vPart) * (1.0 - axis);
      // by day: a soft blue-grey shape a shade off the haze it stands in, its edges catching the light, the glass only a tint
      vec3 ghost = mix(uHaze, uHaze * vec3(0.8, 0.88, 1.04), 0.75);
      vec3 dayCol = mix(ghost, mix(uHaze, glass, 0.35), 0.3 * lat) + (uHaze * 0.16 + uSunCol * 0.12) * fres;
      float dayA = (0.013 + 0.062 * fres + 0.016 * lat) * (1.0 + 2.0 * fl) * uDayK;
      // by night: a faint luminous outline, the lattice a whisper in the glass's colours, and the flame at the top
      vec3 nightAdd = (glass * lat * 0.035 * uLatK + vec3(0.55, 0.66, 1.0) * pow(fres, 1.4) * 0.24) * (1.0 - fl);
      vec3 flame = vec3(1.0, 0.72, 0.38) * fl * (1.15 + 0.3 * sin(uTime * 3.1) + 0.15 * sin(uTime * 7.3)) * mix(1.0, 0.45, smoothstep(150.0, 380.0, dist));   // never brighter than The Seed's lantern
      float a = mix(dayA, 0.012 + 0.03 * fres, uNight) * vis;
      vec3 col = mix(dayCol, vec3(0.05, 0.07, 0.15), uNight);
      vec3 addc = (nightAdd * uNight + flame * mix(0.12, 1.0, uNight) + vec3(1.0, 0.95, 0.86) * uSel * (0.025 + 0.07 * fres + 0.02 * lat)) * vis;
      gl_FragColor = vec4(col * a + addc, clamp(a, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const phantom = new THREE.Mesh(phantomGeometry(), phantomMat);
phantom.position.copy(PH); phantom.rotation.y = -0.12; phantom.renderOrder = 0.05; phantom.userData.pick = 'VISION';
phantom.userData.pickAt = () => (camera.position.distanceTo(PH) > 90 ? 'VISION' : null);   // up close it has dissolved: nothing to click
scene.add(phantom); PICKABLE.push(phantom); W7.phantom = phantom;
const FLAME_GLOW = glow(PH.clone().setY(50.7), 0xffc27a, 13, 0.55);                           // the flame's glow, by night, stepped down with distance

/* the way beyond: a faint dotted path from the edge of the floor pattern towards the vision, fading out. A path not yet walked */
const BEYOND = new THREE.CatmullRomCurve3([V3(-24, 0, 0.5), V3(-60, 0, 4.5), V3(-100, 0, 1.5), V3(-140, 0, -3), V3(-175, 0, -4)], false, 'centripetal');
const BEYOND_U = { uCol: { value: new THREE.Color() }, uNight: { value: 0 } };
{ const len = BEYOND.getLength(), N = Math.ceil(len / 1.5), w = 0.55, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, p = BEYOND.getPointAt(t), d = BEYOND.getTangentAt(t), n = V3(-d.z, 0, d.x);
    pos.push(p.x + n.x * w, 0.03, p.z + n.z * w, p.x - n.x * w, 0.03, p.z - n.z * w); uv.push(-1, t * len, 1, t * len);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: BEYOND_U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, fog: false, extensions: { derivatives: true },
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uNight; varying vec2 vUv;
      void main() { float s = vUv.y, k = fract(s / 2.7) - 0.5; float d = length(vec2(k * 2.7, vUv.x * 0.55)); float fw = fwidth(d);
        float dotm = 1.0 - smoothstep(0.24 - fw, 0.24 + fw, d);
        float fade = smoothstep(0.0, 10.0, s) * (1.0 - smoothstep(55.0, ${(BEYOND.getLength() - 4).toFixed(1)}, s));
        float a = dotm * fade * mix(0.3, 0.08, uNight);
        gl_FragColor = vec4(uCol * a + vec3(1.0, 0.78, 0.45) * dotm * fade * 0.3 * uNight, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  m.renderOrder = 0.15; m.receiveShadow = false; scene.add(m); W7.beyond = m; }

// the time of day reaches the vision: its haze, its sun, its night
function syncVision() {
  PHU.uNight.value = nightK; PHU.uHaze.value.copy(skyU.hor.value); PHU.uSun.value.copy(sunDir); PHU.uSunCol.value.copy(sun.color).multiplyScalar(smooth(-2, 8, Math.asin(clamp(sunDir.y, -1, 1)) * 57.3));
  BEYOND_U.uNight.value = nightK; BEYOND_U.uCol.value.copy(groundMat.color).lerp(C(0xffffff), 0.5);
}
FRAME_HOOKS.push((dt, T) => { PHU.uTime.value = REDUCED ? 0 : T; PHU.uSel.value += ((current === 'VISION' ? 1 : 0) - PHU.uSel.value) * Math.min(1, dt * 4);
  FLAME_GLOW.userData.k = 0.55 * lerp(1, 0.45, smooth(150, 380, camera.position.distanceTo(FLAME_GLOW.position))); FLAME_GLOW.material.opacity = nightK * FLAME_GLOW.userData.k; });

// selectable: its own card, with the two ways onward
reg('VISION', { kind: 'vision', title: 'The temple of 2029', chip: 'A vision', obj: phantom, focus: () => visionView() });
GLYPH.vision = 'seed';
INDEX.push({ id: 'VISION', label: 'The temple of 2029', sub: 'A vision · beyond The Seed', key: '' });
WAY_OF.VISION = 'vision';
HOOK7.cardIn.push(it => it.kind === 'vision' ? head('vision', 'A vision · AfrikaBurn 2029', 'The temple of 2029', 'A dream Mahala hopes to grow from The Seed') + `<div class="insp-body">
    <p class="spine">Far out on the playa, beyond The Seed: a grand temple grown from it, its petals opening like a king protea's, an axis rising through it to a stupa crown, and a small flame at the very top.</p>
    <p>A vision, not a plan. AfrikaBurn chooses its own temple builders, so for now it is a hope, and a direction for every builder on this path. Each gift to The Seed, each crew and each build brings it closer.</p>
    <div class="actions"><button class="btn primary" data-act="worldmap">${icon('seed')}See the temples to come</button><button class="btn" data-act="gate6">${icon('gift')}Ways to give</button></div>
    <p class="note">Concept visualisation, drawn faint on purpose: a hope, not a building.</p></div>` : null);
HOOK7.act.push(act => { if (act === 'worldmap') { W7.openMap('card'); return true; } if (act === 'gate6') { helpItGrow(); return true; } });
// its label stays clear of the bar and the presence pill: on a phone the vision's flame stands high on the screen
{ const _updateLabels = updateLabels;
  updateLabels = function () {
    _updateLabels();
    if (current !== 'VISION' || !selBox || selLabel.hidden) return;
    const b = selBox, top = project(V3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2));
    const w = selLabel.offsetWidth, h = selLabel.offsetHeight, y0 = top.y - 12; let y = y0;
    const bars = [...document.querySelectorAll('.hud .topbar, #tgPill')].map(e => e.getBoundingClientRect()).filter(r => r.width).sort((p, q) => p.top - q.top);
    for (const r of bars) if (r.right > top.x - w / 2 && r.left < top.x + w / 2 && r.top < y && r.bottom + 4 > y - h) y = r.bottom + 4 + h;
    if (y !== y0) selLabel.style.transform = `translate(${top.x}px, ${y}px) translate(-50%, -100%)`;
  }; }

/* ---------- the eighth stop: beyond The Seed ----------
   The view stands behind The Seed, on the side the way comes in, and looks west over it to the vision. It looks nearly
   level, lower than the controls usually allow, so for this view only the camera may tilt up to the horizon. */
function visionView(story = false) {
  const phone = innerWidth <= 760, k = phone ? 1 / 1.5 : 1;            // a phone's views are drawn half as far again: this one stays where it is put
  if (story) return tourVisionView(phone, k);
  if (phone && W7.v8phone) return W7.v8phone(k);                                    // tests may try another phone view
  return phone ? { t: V3(-38, 17, -1.5), d: 160 * k, p: 1.595, a: Math.PI / 2 + 0.05 } : { t: V3(-30, 11.5, -1), d: 94, p: 1.575, a: Math.PI / 2 + 0.19 };
}
/* the tour has no card at the side but a panel along the bottom, under a letterbox. The camera stands above the camp,
   higher than any tent and off the way (where the builders walk), and looks west past The Seed to the vision; its pitch is
   fitted to the clear band between the letterbox and the panel, so The Seed stands just above the panel and the flame
   at the vision's top just under the letterbox, on any screen. */
function tourVisionView(phone, k) {
  const C = W7.tourC ? W7.tourC.clone() : phone ? V3(124, 10.5, -5) : V3(110, 13, -12), H = innerHeight || 800;
  const card = $('#story .story-card'), lb = $('#story .lb.top');
  const top = (lb && lb.getBoundingClientRect().bottom) || H * 0.07, bottom = (card && card.getBoundingClientRect().top) || H * 0.55;
  const tanF = Math.tan(camera.fov * Math.PI / 360), ang = y => Math.atan((1 - 2 * y / H) * tanF);      // a screen row, as an angle from the centre
  const el = p => Math.atan2(p.y - C.y, Math.hypot(p.x - C.x, p.z - C.z));                            // a point, as an angle above level
  const wTop = ang(top + 14), wBot = ang(bottom - 12), TIP = PH.clone().setY(53), FOOT = V3(0, 0, 0);
  // a tall panel (a phone, a short window) leaves a narrow band: step back and a little lower until both fit
  for (let i = 0; i < 12 && el(TIP) - el(FOOT) > wTop - wBot; i++) { C.x *= 1.06; C.z *= 1.06; C.y *= 0.96; }
  const lo = el(FOOT), hi = el(TIP);
  // the content centred in the band; if it is taller than the band, the flame keeps its place and The Seed's foot goes under
  const pitch = hi - lo <= wTop - wBot ? (hi + lo) / 2 - (wTop + wBot) / 2 : hi - wTop;
  const az = Math.atan2(PH.x * 0.35 - C.x, PH.z * 0.35 - C.z);                                           // between The Seed and the vision
  const dir = V3(Math.sin(az) * Math.cos(pitch), Math.sin(pitch), Math.cos(az) * Math.cos(pitch)), D = 90, t = C.clone().addScaledVector(dir, D);
  return { t, d: D * k, p: Math.PI / 2 + pitch, a: Math.atan2(-dir.x, -dir.z) };
}
{ const _flyTo = flyTo;   // only outdoors, and only its own change: inside a place and at the fire the game sets its own limits
  flyTo = function (v, dur, then) {
    if (!inside && !fire.on) {
      if (v && v.p > 1.36) { if (W7.polarWas == null) W7.polarWas = controls.maxPolarAngle; controls.maxPolarAngle = Math.max(W7.polarWas, Math.min(1.72, v.p + 0.03)); }
      else if (W7.polarWas != null) { controls.maxPolarAngle = W7.polarWas; W7.polarWas = null; }
    }
    return _flyTo(v, dur, then);
  }; }
WAY.push({ id: 'vision', short: 'Beyond', eye: 'A vision', name: 'The temple of 2029', clock: 22 * 60 + 40, s: WAY_LEN, view: () => visionView(),
  lines: ['Far out on the playa stands a dream: the grand temple Mahala hopes to raise at AfrikaBurn in 2029, grown from The Seed.', 'A vision, not a plan. Each gift to The Seed, each crew and each build brings it closer.'],
  note: 'Concept visualisation of a hope. AfrikaBurn chooses its own temple builders.',
  acts: [['worldmap', 'seed', 'See the temples to come'], ['gate6', 'gift', 'Ways to give']] });
WAY_BY.vision = WAY.length - 1; STOP_S.vision = WAY_LEN;
// the first stop, on a large screen: the book in the right foreground, your figure beside it, the way leading the eye to
// the camp and the dawn sky above (it looked down at the book from 8 m, with no sky). A phone keeps the book near the middle
// (your figure stands where the camera looks: a little along the way from the book, so it stands beside it, not in front)
{ const w = WAY.find(s => s.id === 'book'); if (w) { const v = w.view; w.view = () => innerWidth <= 760 ? v() : { t: wayP(ST.book).lerp(wayP(ST.book + 10), 0.3).setY(1.7), d: 15, p: 1.42, a: Math.PI / 2 - 0.25 }; } }
WY.i = clamp(+ME.way || 0, 0, WAY.length - 1);
// "Ways to give": the gates, from small to large (a gift funds the camp and The Seed; the temple of 2029 stays a vision)
const helpItGrow = () => openJoin('back');
{ const _goWay = goWay;
  goWay = function (i, o = {}) { const s = WAY[clamp(Math.round(+i) || 0, 0, WAY.length - 1)]; if (s && s.id === 'vision' && o.lift === undefined) o = Object.assign({}, o, { lift: false }); return _goWay(i, o); };
  const _wayAct = wayAct;
  wayAct = function (k, el) { if (k === 'worldmap') { W7.openMap('way'); return; } if (k === 'gate6') { helpItGrow(); return; } return _wayAct(k, el); };
  // a stop may carry a small note under its lines: the vision's says it is a concept visualisation of a hope
  const _renderWay = renderWay;
  renderWay = function () { _renderWay(); const s = WAY[WY.i], l = s && s.note && WY.el.querySelector('.way-lines');
    if (l) { const p = document.createElement('p'); p.className = 'note v7-world-waynote'; p.textContent = s.note; l.after(p); } }; }
$('#wayBar').setAttribute('aria-label', 'The eight stops of the way');

/* the tour: an eighth chapter, after the Book of Mahala */
TOUR.push({ title: 'The temple of 2029', clock: 22 * 60 + 40, view: () => visionView(true),
  lines: ['Far out on the playa, beyond The Seed, stands a dream: the grand temple Mahala hopes to raise at AfrikaBurn in 2029.', 'A vision, not a plan. Each gift to The Seed, each crew and each build brings it closer.'],
  act: ['worldmap', 'seed', 'A dream for the world.', 'See the temples to come'] });
// the game's own handler has already closed the tour: go to the eighth stop under the map, so closing the map lands there
$('#story').addEventListener('click', e => { if (e.target.closest('[data-tour="worldmap"]')) { goWay(WAY_BY.vision, { dur: 1.2 }); W7.openMap('tour'); } });
afterTour = function () { goWay(WAY_BY.vision, { dur: 2 }); };

/* ---------- the finish: small changes to how the world looks, each cheap, each named so it can be seen on its own ----------
   grade   dawn and dusk. The playa used to be darkened as soon as the sun was low (its colour was mixed towards the night's
           with the daylight), so at 07:20 and 17:15 it went a heavy orange-brown. Now the clay keeps its colour through the
           golden hour and only darkens in the twilight after; the low sun is gold rather than deep orange; the sky's light
           on the playa is brighter and warmer, so dawn reads soft; the shade is a touch cooler.
   ground  finer cracks inside the big cells up close, and a slow variation across the playa so it never looks tiled. On a
           large screen only: a phone draws the ground it always drew.
   ribbon  the way: soft edges instead of a hard strip, and by night it darkens with the playa instead of glowing white.
   shadow  the sun's shadow box is fitted to the ground the camera sees, so the gates and tents near the camera keep their
           shadows on the long, low views down the way (it was a square round the point looked at).
   haze    a little air between here and the far end of the way, for the low views along it: seen from near the ground,
           haze starts 70 m out (it started at 260 m); from high up the view stays as clear as it was. And the playa meets
           the sky without a line at the horizon (see acesOf below).
   pools   by night, pools of lamplight on the playa under the lanterns along the way, round the fire in the boat, and
           under the main tent's sail (where a glow used to hang that the ground cut in two).
   sky     by night a faint Milky Way arcs across the southern sky, as it does over the Tankwa in late April, and there are
           more, fainter stars; the sky's gradient is dithered by half a level, so the dark night sky no longer steps.
   canvas  the tents: soft seams between the canvas panels, a little playa dust at the hem, and by night a faint glow from
           within, as tents with lanterns in them have. */
const PHONE_GPU = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
const FIN = { grade: true, ground: !PHONE_GPU, ribbon: true, shadow: true, haze: true, pools: true, sky: true, canvas: true, lamps: true, rings: true, props: true, daysky: true };
const FIN_U = { uFine: { value: 1 }, uEdge: { value: 1 }, uCanvas: { value: 1 } };
const GRADE = { mid: 0xd8c09b, alb: 0xecd8b4, sun: 0xffcf8a, sunK: 0.55, sky: 0xf4dcb4, skyK: 0.5, shade: 0xb9c3df, shadeK: 0.18, fill: 0.12, exp: 0.03, hor: 0xf4cf9c, horK: 0.5, mw: 0.45 };
W7.FIN = FIN; W7.GRADE = GRADE; W7.PHU = PHU;
W7.finish = (k, on) => { if (k in FIN) FIN[k] = !!on; applyTime(clock); return Object.assign({}, FIN); };
const PATH_COL = M.path.color.clone();

// the way's ribbon: soft edges
M.path.transparent = true; M.path.defines = Object.assign({}, M.path.defines, { USE_UV: '' });
M.path.onBeforeCompile = sh => { sh.uniforms.uEdge = FIN_U.uEdge;
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEdge;')
    .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n\tdiffuseColor.a *= mix(1.0, smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x), uEdge);'); };
M.path.customProgramCacheKey = () => 'v7-way';
for (const k of ['fgCopper', 'fgTeal', 'fgAmber', 'fgPearl']) Object.assign(M[k], { transparent: true, forceSinglePass: true });   // still drawn after the way, which is now see-through at its edges

// the ground: finer cracks near the camera and a slow variation far off (large screens only)
// the fine layer reads its own copy of the crack texture, without the anisotropic filtering the big cells use (it is only
// read up close, where the angle is gentle, and the filtering was most of its cost)
const CRACK_FINE = crack.clone(); CRACK_FINE.anisotropy = 1; CRACK_FINE.needsUpdate = true;
if (!PHONE_GPU) {
  groundMat.onBeforeCompile = sh => { sh.uniforms.uFine = FIN_U.uFine; sh.uniforms.uFineMap = { value: CRACK_FINE };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGw;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uFine; uniform sampler2D uFineMap; varying vec3 vGw;
float gh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1.0, 0.0)), u.x), mix(gh(i + vec2(0.0, 1.0)), gh(i + vec2(1.0, 1.0)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
	if (uFine > 0.5) { float gd = distance(vGw, cameraPosition);
	  if (gd < 45.0) { vec4 fine = texture2D(uFineMap, vGw.xz * 0.213 + vec2(0.37, 0.61));       // the finer cracks, only near
	    diffuseColor.rgb *= mix(1.0, clamp(fine.r * 1.06, 0.0, 1.1), 0.55 * (1.0 - smoothstep(10.0, 45.0, gd))); }
	  diffuseColor.rgb *= 0.95 + 0.085 * gn(vGw.xz * 0.011 + vec2(3.1, 7.7)); }`);
  };
  groundMat.customProgramCacheKey = () => 'v7-ground';
  groundMat.needsUpdate = true;
}

// the tents and the sail: seams between the panels, dust at the hem, and a glow from within at night. Seams only where the
// geometry has its own uv (the bell tents, the sail, the kitchen): the Lotus Mahal's canvas is built without one
M.canvas.emissive.set(0xffb878); M.canvas2.emissive.set(0xffae6a);
for (const m of [M.canvas, M.canvas2, M2.tent, M2.tent2]) {
  const seams = m === M.canvas || m === M.canvas2;
  if (seams) m.defines = Object.assign({}, m.defines, { USE_UV: '', V7_SEAMS: '' });
  m.onBeforeCompile = sh => { sh.uniforms.uCanvas = FIN_U.uCanvas;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', `#include <begin_vertex>
	{ vec4 wp = vec4(transformed, 1.0);
	#ifdef USE_INSTANCING
	  wp = instanceMatrix * wp;
	#endif
	  vWy = (modelMatrix * wp).y; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uCanvas; varying float vWy;').replace('#include <color_fragment>', `#include <color_fragment>
	if (uCanvas > 0.5) {
	#if defined(V7_SEAMS) && __VERSION__ >= 300
	  float k = vUv.x * 16.0, w = fwidth(k), sd = abs(fract(k) - 0.5);
	  float seam = (1.0 - smoothstep(0.42, 0.5, 0.5 - sd + 0.04)) * (1.0 - smoothstep(0.15, 0.4, w));
	  diffuseColor.rgb *= 1.0 - 0.07 * seam;
	#endif
	  float hem = 1.0 - smoothstep(0.02, 0.75, vWy);
	  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.82, 0.71), hem * 0.55); }`);
  };
  m.customProgramCacheKey = () => seams ? 'v7-canvas-seams' : 'v7-canvas'; m.needsUpdate = true;
}

/* the night sky: a faint Milky Way across the south, a small strip (assets/v7/world/milkyway.jpg, 14 KB, loaded after the
   world, made by the world workstream's make_milkyway.py) laid along the galactic plane. At 22:40 on 29 April 2027 it
   rises in the east south east through Sagittarius, crosses the southern sky with the Southern Cross about 62 degrees up,
   and sets in the west north west, behind the vision. Without the file the sky is as it was. */
const MW = (() => {
  const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  let ok = false;
  new THREE.TextureLoader().load('assets/v7/world/milkyway.jpg', tx => { t.image = tx.image; t.needsUpdate = true; ok = true; skyU.uMW.value = FIN.sky ? GRADE.mw * nightK : 0; }, undefined, () => {});
  // the band's frame: its centre (the galactic centre, low in the east south east) and its pole
  const R = Math.PI / 180, dir = (az, alt) => V3(Math.sin(az * R) * Math.cos(alt * R), Math.sin(alt * R), -Math.cos(az * R) * Math.cos(alt * R));
  const gc = dir(118, 18), crux = dir(180, 62.6), n = gc.clone().cross(crux).normalize(), e2 = n.clone().cross(gc).normalize();
  return { tex: t, n, e1: gc, e2, ready: () => ok };
})();
Object.assign(skyU, { uMW: { value: 0 }, uMWT: { value: MW.tex }, uGN: { value: MW.n }, uGE1: { value: MW.e1 }, uGE2: { value: MW.e2 }, uDither: { value: 1 }, uDayK: { value: 0 } });
// by day a pale blue band above the haze, so the sky never passes through grey on its way up to the blue; at dusk and by night it is the horizon's own colour
{ const MIX = 'vec3 col = mix(hor, top, pow(smoothstep(0.0, 0.62, h), 0.7));';
  if (sky.material.fragmentShader.includes(MIX)) sky.material.fragmentShader = sky.material.fragmentShader.replace('uniform float glow;', 'uniform float glow; uniform float uDayK;').replace(MIX, `vec3 mid = mix(hor, vec3(0.36, 0.56, 0.88), 0.75 * uDayK);
      vec3 col = h < 0.14 ? mix(hor, mid, smoothstep(0.0, 0.14, h)) : mix(mid, top, pow(smoothstep(0.14, 0.62, h), 0.8));`);
  else console.warn('v7 world: the sky shader changed, no blue band'); }
sky.material.fragmentShader = sky.material.fragmentShader
  .replace('uniform float glow;', 'uniform float glow; uniform float uMW; uniform sampler2D uMWT; uniform vec3 uGN; uniform vec3 uGE1; uniform vec3 uGE2; uniform float uDither;')
  .replace('gl_FragColor = vec4(col, 1.0);', `if (uMW > 0.002) { float b = dot(d, uGN);          // the sine of the latitude across the band: within 5% of the angle there
        if (abs(b) < 0.5) { float l = atan(dot(d, uGE2), dot(d, uGE1)); col += texture2D(uMWT, vec2(l / 6.2831853 + 0.5, b + 0.5)).rgb * uMW * smoothstep(0.0, 0.09, d.y); } }
      gl_FragColor = vec4(col, 1.0);`);
sky.material.fragmentShader = sky.material.fragmentShader.replace(/#include <colorspace_fragment>\s*}\s*$/, `#include <colorspace_fragment>
      gl_FragColor.rgb += uDither * (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;   // a dither with no sine in it
    }`);
sky.material.needsUpdate = true;
// fainter stars, more of them, a few tinted, thicker towards the band
const stars2 = (() => {
  const p = [], c = [], rnd = mulberry(41), tint = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.9, 0.78], [1, 0.97, 0.9]];
  for (let i = 0; i < 2600; i++) {
    let d = V3(rnd() * 2 - 1, rnd() * 0.96 + 0.04, rnd() * 2 - 1).normalize();
    if (rnd() < 0.45) { const b = (rnd() + rnd() + rnd() - 1.5) * 0.16, l = rnd() * Math.PI * 2; d = MW.e1.clone().multiplyScalar(Math.cos(l)).addScaledVector(MW.e2, Math.sin(l)).multiplyScalar(Math.cos(b)).addScaledVector(MW.n, Math.sin(b)); if (d.y < 0.03) continue; }
    p.push(d.x * 2150, d.y * 2150, d.z * 2150); const t = tint[Math.floor(rnd() * 4)], k = 0.35 + 0.65 * rnd(); c.push(t[0] * k, t[1] * k, t[2] * k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.35, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  s.renderOrder = -9; s.visible = false; scene.add(s); return s;
})();
FRAME_HOOKS.push(() => { stars2.position.copy(camera.position); });

/* the sun's shadow box, fitted to the ground the camera sees (out to a reach that grows with the view, so a close look
   keeps sharp shadows), instead of a square round the point the camera looks at */
const _sf = { a: V3(), c: [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 0.3]] };
FRAME_HOOKS.push(() => {
  if (!FIN.shadow || inside || !sun.castShadow) { sun.shadow.normalBias = 0.03; return; }
  camera.updateMatrixWorld();
  const c = camera.position, reach = clamp(c.distanceTo(controls.target) * 1.6, 36, 160);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [nx, ny] of _sf.c) {
    const d = _sf.a.set(nx, ny, 0.5).unproject(camera).sub(c).normalize();
    const s = Math.min(d.y < -1e-4 ? -c.y / d.y : Infinity, reach / Math.max(0.2, Math.hypot(d.x, d.z))), x = c.x + d.x * s, z = c.z + d.z * s;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const Sz0 = clamp(c.distanceTo(controls.target) * 0.42, 18, 110);                          // the box the game would use
  const Sz = clamp(Math.min(Math.max(x1 - x0, z1 - z0) / 2 + 3, Math.max(Sz0 * 1.5, 30)), 18, 110), sc = sun.shadow.camera;   // never more than half as big again sun.shadow.normalBias = clamp(0.03 * Sz / 40, 0.03, 0.075);
  if (sc.right !== Sz) { sc.left = -Sz; sc.right = Sz; sc.top = Sz; sc.bottom = -Sz; sc.updateProjectionMatrix(); }
  sun.target.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); sun.position.copy(sun.target.position).addScaledVector(sunDir.y > 0.02 ? sunDir : V3(0, 1, 0), 200);
});

// the haze follows the camera's height: low views look through the dusty air near the playa, views from high up stay clear
FRAME_HOOKS.push(() => { if (!FIN.haze) return; const k = smooth(15, 90, camera.position.y); scene.fog.near = lerp(70, 260, k); scene.fog.far = lerp(1150, 1500, k); });

/* pools of lamplight on the playa by night: under each lantern along the way (the same places v6 puts them) and round the
   fire in the boat. One instanced draw call of soft discs, added to the ground, drawn only after dark. */
/* the portal's four lantern blocks on its rope spiral turned pure white boxes at night, with no light on the ground. They now
   glow a warmer amber, a little less, and each lays a small pool of light on the playa (with the pools below) */
const PORTAL_LAMPS = LANTERNS.filter(m => m.userData.pick === 'CAMP_PORTAL' && m.material === LAMP.warm), PORTAL_LAMP = LAMP.warm.clone();
PORTAL_LAMPS.forEach(m => { m.material = PORTAL_LAMP; });
let POOLS_PORTAL0 = 0, lampsWas = null;
const POOLS = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spots = [], clear = [0, ST.portal, ST.gate1, ST.gate2, ST.gate3, ST.gate4, ST.gate5, ST.gate6, ST.gate7, ST.flag, WAY_LEN];
  for (let s = 9, k = 0; s < WAY_LEN - 4; s += 11, k++) { if (clear.some(q => Math.abs(q - s) < 5)) continue; const p = beside(s, 2.15, k % 2 ? 1 : -1); spots.push([p.x, p.z, 2.6, 0xffc070, 0.3]); }
  spots.push([FIRE_AT.x, FIRE_AT.z, 8, 0xff9a52, 0.34]);
  if (SAIL_GLOW) spots.push([SAIL_GLOW.position.x, SAIL_GLOW.position.z, 11, 0xffc98a, 0.26]);
  POOLS_PORTAL0 = spots.length; PORTAL_LAMPS.forEach(l => spots.push([l.position.x, l.position.z, 2.3, 0xffb060, 0.34]));
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }), spots.length);
  spots.forEach(([x, z, r, col, k], i) => { m.setMatrixAt(i, new THREE.Matrix4().makeScale(r, 1, r).setPosition(x, 0.04, z)); m.setColorAt(i, C(col).multiplyScalar(k)); });
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.renderOrder = 0.3; m.visible = false; m.frustumCulled = false; scene.add(m); return m;
})();
/* the floor pattern's rings by day: faint, so the playa round The Seed never reads as a painted target and the coloured light
   through the glass carries the day view; by night, and while the pattern itself is chosen, they are whole */
const RINGS = ['fgCopper', 'fgTeal', 'fgAmber', 'fgPearl'].map(k => M[k]); let ringK = 1;
FRAME_HOOKS.push((dt) => { const want = !FIN.rings || current === 'FLOOR_GRID' ? 1 : lerp(0.4, 1, nightK);
  if (Math.abs(want - ringK) < 0.002) return; ringK += (want - ringK) * Math.min(1, dt * 3 + 0.02); if (Math.abs(want - ringK) < 0.004) ringK = want; RINGS.forEach(m => { m.opacity = ringK; }); });
/* two props that read as placeholders: the build yard's pad (a pale grey sheet, now a clay a shade darker than the playa)
   and the verse stones (a flat grey, now sandstone) */
const PAD_WAS = M.pad.color.getHex(), STONE_WAS = [M.stone.color.getHex(), M.stone.roughness];
function props() { M.pad.color.set(FIN.props ? 0xcbb497 : PAD_WAS); M.stone.color.set(FIN.props ? 0xc9b79a : STONE_WAS[0]); M.stone.roughness = FIN.props ? 0.9 : STONE_WAS[1]; }
function portalLamps() {
  PORTAL_LAMP.emissive.set(FIN.lamps ? 0xffa64a : 0xffd9a0); PORTAL_LAMP.emissiveIntensity = FIN.lamps ? 0.3 + 1.2 * nightK : LAMP.warm.emissiveIntensity;
  if (lampsWas === FIN.lamps) return; lampsWas = FIN.lamps;
  PORTAL_LAMPS.forEach((l, i) => POOLS.setColorAt(POOLS_PORTAL0 + i, FIN.lamps ? C(0xffb060).multiplyScalar(0.34) : C(0x000000))); POOLS.instanceColor.needsUpdate = true;
}

/* three.js mixes the fog in after the tone mapping, but the sky's horizon goes through it: so the far playa (the fog's
   colour, raw) never matched the sky just above it (the same colour, tone mapped), and a bright line ran along the
   horizon, plainest at night. The fog now takes the horizon colour through the same ACES curve three.js uses (r160). */
function acesOf(c, exposure) {
  const k = exposure / 0.6, r = c.r * k, g = c.g * k, b = c.b * k;
  const f = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const X = f(0.59719 * r + 0.35458 * g + 0.04823 * b), Y = f(0.076 * r + 0.90834 * g + 0.01566 * b), Z = f(0.0284 * r + 0.13383 * g + 0.83777 * b);
  return [clamp(1.60475 * X - 0.53108 * Y - 0.07367 * Z, 0, 1), clamp(-0.10208 * X + 1.10813 * Y - 0.00605 * Z, 0, 1), clamp(-0.00327 * X - 0.07276 * Y + 1.07602 * Z, 0, 1)];
}

function finishLight() {
  const el = Math.asin(clamp(sunDir.y, -1, 1)) * 180 / Math.PI, low = smooth(-4, 2, el) * (1 - smooth(7, 22, el)), G = GRADE;
  if (FIN.grade) {
    // the clay's colour through the golden hour, darkening only in the twilight after (or before) it
    const lit = smooth(-9, 1, el), high = smooth(4, 28, el), day = smooth(-5, 8, el);
    groundMat.color.copy(C(0x2a2c3a)).lerp(C(G.alb), lit).lerp(C(G.mid), high);
    hemi.groundColor.copy(C(0x15151d)).lerp(C(0xe6d4bf), Math.max(day, lit * 0.85));
    if (low > 0.001) {
      sun.color.lerp(C(G.sun), G.sunK * low);
      hemi.color.lerp(C(G.sky), G.skyK * low).lerp(C(G.shade), G.shadeK * low);
      hemi.intensity += G.fill * low;
      renderer.toneMappingExposure += G.exp * low;
      if (G.horK > 0) skyU.hor.value.lerp(C(G.hor), G.horK * low);
    }
  }
  M.path.color.copy(FIN.ribbon ? groundMat.color.clone().lerp(C(0xffffff), lerp(0.36, 0.2, nightK)) : PATH_COL);
  FIN_U.uEdge.value = FIN.ribbon ? 1 : 0; FIN_U.uFine.value = FIN.ground ? 1 : 0; FIN_U.uCanvas.value = FIN.canvas ? 1 : 0;
  M.canvas.emissiveIntensity = FIN.canvas ? 0.16 * nightK : 0; M.canvas2.emissiveIntensity = FIN.canvas ? 0.14 * nightK : 0;
  if (!FIN.haze) { scene.fog.near = 260; scene.fog.far = 1500; scene.fog.color.copy(skyU.hor.value); }
  else { const t = acesOf(skyU.hor.value, renderer.toneMappingExposure); scene.fog.color.setRGB(t[0], t[1], t[2], THREE.LinearSRGBColorSpace); }
  POOLS.material.opacity = nightK; POOLS.visible = FIN.pools && nightK > 0.02;
  // the day sky: a deeper blue at the top (it was 0x86aed6), and the pale blue band above the haze
  const hi = smooth(4, 28, el); skyU.uDayK.value = FIN.daysky ? hi : 0;
  if (FIN.daysky) { const a = C(0x86aed6), b = C(0x5f93c8); skyU.top.value.r += (b.r - a.r) * hi; skyU.top.value.g += (b.g - a.g) * hi; skyU.top.value.b += (b.b - a.b) * hi; }
  M.person.emissiveIntensity = 0.1 * nightK; portalLamps(); props();
  skyU.uMW.value = FIN.sky && MW.ready() ? GRADE.mw * nightK : 0; skyU.uDither.value = FIN.sky ? 1 : 0; stars2.visible = FIN.sky && nightK > 0.02; stars2.material.opacity = 0.85 * nightK;
}
{ const _applyTime = applyTime; applyTime = function (mins) { _applyTime(mins); finishLight(); syncVision(); }; }

/* the map of the temples to come opens with the camera rising over the playa while the map fades in; closing it, the camera
   settles back to where it was, or to where it was flying (the tour's last chapter flies to the eighth stop as the map opens) */
W7.rise = () => {
  if (REDUCED || inside) return;
  const k = innerWidth <= 760 ? 1 / 1.5 : 1, s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  W7.risenFrom = fly ? { t: fly.to.t.clone(), d: fly.to.d * k, p: fly.to.p, a: fly.from.a + fly.dA } : { t: controls.target.clone(), d: s.radius * k, p: s.phi, a: s.theta };
  flyTo({ t: W7.risenFrom.t.clone().setY(Math.min(W7.risenFrom.t.y, 6)), d: Math.min(W7.risenFrom.d / k * 2 + 60, 300) * k, p: 0.62, a: W7.risenFrom.a }, 1.6);
};
W7.settle = () => { const v = W7.risenFrom; W7.risenFrom = null; if (v && !inside) flyTo(v, 1.4); };
/* while the map of the temples to come covers the screen, the world rests */
{ const _frame = frame; frame = function (now) { if (W7.mapOpen) { requestAnimationFrame(frame); return; } return _frame(now); }; }

finishLight(); syncVision(); renderWayBar(); renderWay();


/* ====================== v7 co: doors for Offer something, Ideas and the stewards' tools (the plugin is assets/v7/co/) ====================== */
Object.assign(HOOK7, { live: HOOK7.live || [], circle: HOOK7.circle || [], sounds: HOOK7.sounds || null, journey: HOOK7.journey || null, stewardTools: HOOK7.stewardTools || null });
{ const _ol = onLive; onLive = function () { for (const f of HOOK7.live) { try { f(); } catch (e) { console.warn(e); } } return _ol.apply(this, arguments); }; }
{ const _rc = renderCircle; renderCircle = function () {
    // lines only: the pieces on the hearth are read as pieces. A line approved in the stewards' tools keeps no copy of a
    // name: it shows the name its writer chooses to show now (builders/<uid>.name, set only with "Show my name"), or none
    const all = LIVE.hearth, B = LIVE.builders || [];
    LIVE.hearth = all.filter(h => !(h && h.k)).map(h => {
      const m = h && !h.name && typeof h.id === 'string' ? /^([A-Za-z0-9_.:@+-]{1,128})~l[0-9a-z]{1,12}$/.exec(h.id) : null, b = m && B.find(x => x && x.id === m[1]);
      return b && typeof b.name === 'string' && b.name.trim() ? Object.assign({}, h, { name: b.name.trim().slice(0, 40) }) : h;
    });
    try { _rc.apply(this, arguments); } finally { LIVE.hearth = all; }
    for (const f of HOOK7.circle) { try { f(FI.body, FI.foot); } catch (e) { console.warn(e); } }
  }; }
{ const _sa = soundsAll; soundsAll = function () {
    const all = _sa();
    if (HOOK7.sounds) { try { const r = HOOK7.sounds(all); if (Array.isArray(r)) return r; } catch (e) { console.warn(e); } }
    return all;
  }; }

/* ====================== v7 pay: the Your gift step of the Support The Seed door (patch_v7_pay.py; the plugin is assets/v7/pay/) ====================== */
HOOK7.give = null;      // the pay plugin sets { ready(), step(body, foot), touch(body, foot), ending(body, foot, out), give(n) }
HOOK7.payNote = null;   // the pay plugin sets (kind, gate) => the words beside the working figures, plain text (kind: 'card', 'sheet' or 'list')
const PAYNOTE7 = {
  card: 'No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.',
  sheet: 'No payment is taken here yet. Mahala is not yet a public benefit organisation, so gifts are not tax deductible.',
  list: 'No payment is taken here yet, and gifts are not tax deductible.',
  cur: '',              // under a gate's amount in dollars; only the plugin says it ("A guide in US dollars. You give in rand.")
};
function payNote7(kind, n) {
  if (HOOK7.payNote) { try { const s = HOOK7.payNote(kind, n); if (s) return esc(s); } catch (e) { console.warn(e); } }
  return PAYNOTE7[kind];
}
function payCur7(n) { const s = payNote7('cur', n); return s ? `<small class="note v7-pay-cur">${s}</small>` : ''; }   // n: a gate, or none for the gate list
const giveOn7 = () => { try { return !!(HOOK7.give && HOOK7.give.ready()); } catch (e) { return false; } };
const GIVE7 = 'Your gift';
{ const _fs = flowSteps; flowSteps = function () {
    const s = _fs();
    if (JF.door !== 'back' || !giveOn7() || s.includes(GIVE7)) return s;
    const i = s.indexOf('Choose a gate');
    return i < 0 ? s : s.slice(0, i + 1).concat([GIVE7], s.slice(i + 1));
  }; }
{ const _rj = renderJoin; renderJoin = function () {
    _rj();                                   // the title, the steps and every step the game knows (Your gift it leaves alone)
    if (JF.door !== 'back' || !giveOn7()) return;
    const name = flowSteps()[JF.step];
    try {
      if (name === GIVE7) HOOK7.give.step($('#joinBody'), $('#joinFoot'));
      else if (name === 'Stay in touch') HOOK7.give.touch($('#joinBody'), $('#joinFoot'));
    } catch (e) { console.warn('The gift step did not draw:', e); }
  }; }
{ const _re = renderEnding; renderEnding = function (B, F) {
    if (JF.door === 'back' && giveOn7()) { try { if (HOOK7.give.ending(B, F, JF.out) === true) return; } catch (e) { console.warn('The gift ending did not draw:', e); } }
    return _re(B, F);
  }; }
{ const _gv = give; give = function (n) { if (giveOn7()) { try { if (HOOK7.give.give(n) === true) return; } catch (e) { console.warn(e); } } return _gv(n); }; }
function giveStep7(n) { openJoin('back', n); const i = flowSteps().indexOf(GIVE7); if (i > 0) { JF.step = i; renderJoin(); } }   // straight to Your gift
window.__mahala = { WAY, WY, goWay, V5, renderRaise, W6, ST, WAY_LEN, wayP, nearestS, ME, LIVE, LIT, showGate, openPath, openWrite, testOpen, nextStep, enterWorld, startTour, goPortal, refreshLight, DKX, drawCard, renderDeck, filmFrame, filmSpot, select, enterTemple, leaveTemple, enterMahal, leavePlace, openFireside, leaveFireside, readPiece, openBook, closeBook, turn, BOOK, FX, openSpot, closeSpot, startStory, stopStory, showChapter, LM,  applyTime, REG, renderer, scene, camera, controls, THREE, V3, flyTo: (v) => flyTo({ t: V3(...v.t), d: v.d, p: v.p, a: v.a }), setClock: m => { clock = m; applyTime(m); } };
/* ---------- the together layer: builders who are signed in see each other, talk, leave notes and use the camp board ---------- */
Object.assign(window.__mahala, { toast, icon, esc, store, PICKABLE, hooks: FRAME_HOOKS, canvas, inspector: INS, labels: $('#labels'), flyRaw: (v, dur, then) => flyTo(v, dur, then),
  modalsOpen: () => [...document.querySelectorAll('.modal')].some(m => !m.hidden),
  entered: () => WORLD.entered, cur: () => current,
  state: () => ({ inside, insideAt, fire: fire.on, story: story.on, flying: !!fly, current, night: nightK, reduced: REDUCED, entered: WORLD.entered, arrival: document.body.classList.contains('arrival') }),
  dropQuest: id => { if (!ME.quests[id]) return; delete ME.quests[id]; saveMe(); pushMe(); if (current === id) renderInspector(REG[id]); toast('Off your list. The quest stays open for others.'); },
  P: { camp: CAMP.clone(), heart: CAMP_HEART.clone(), gates: GATE_S.map(s => wayP(s)), yard: YARD.clone(), drift: DRIFT.clone(), fire: FIRE_AT.clone(), portal: PORTAL.clone(), book: BOOK_AT.clone() }, driftM: DRIFT_M.clone(), fireL: FIRE_L.clone() });

/* ====================== v7: the host layer. Plugins under assets/v7/ reach the game through window.__mahala.v7 ====================== */
{ const _ci = v4CardIn; v4CardIn = function (it, h) { for (const f of HOOK7.cardIn) { try { const r = f(it, h); if (r != null) return r; } catch (e) { console.warn(e); } } return _ci(it, h); };
  const _ac = v4Act; v4Act = function (act, a) { for (const f of HOOK7.act) { try { if (f(act, a) === true) return true; } catch (e) { console.warn(e); } } return _ac(act, a); }; }
Object.assign(window.__mahala, { HOOK7, v7: {
  ME, saveMe, pushMe, pushBook, pushSignup, writeDoc, delDoc, LIVE, V5, V5_LIVE, DATA, CONFIG, PATHS, SPACE, ARCH, ARCH_BY, DKX, CREW_BY, GATE_BY, FIRESIDE, FIRE_BY, VERSES,
  REG, reg, INDEX, GLYPH, head, chip, links, tile, injectTop, budgetBar, money, raiseNow, renderRaise, renderKpis, onPathChange, myBadges, markDone, isDone, nextStep,
  openJoin, openWrite, openPath, renderPath, openFireside, openImage, openFilm, openSpot, showGate, closePops, renderTabs, showKept, isBuildCrew, sharedMode, liveBuilders, questTakers,
  select: (...a) => select(...a), deselect: (...a) => deselect(...a), renderInspector: (...a) => renderInspector(...a), setInspector: (...a) => setInspector(...a), showWelcome: (...a) => showWelcome(...a),
  toast, chime, $, $$, WORLD, WAY, WY, goWay, wayAt, showWay, renderWay, renderWayBar, wayLook, STOP_S, STOP_VIEW,
  get current() { return current; }, get inside() { return inside; }, get clock() { return clock; },
  W7,
  saveFile, downloadBook, KIND_T, leadTools, leadAction, GATE0, GATE_COL, ARCH_CREW, offerLine, keepCard, openExplore, openPlinthDeck, closePath,
  KDAYS, MEALS, KIND_S, safeUrl, hostOf, canShare, myShifts, soundsAll, TOUCH, REDUCED, markBadge,
  meSelf: [{"path":"builders/{self}","write":"interact"},{"path":"fire/{self}","write":"interact"},{"path":"signups/{self}","write":"interact"},{"path":"data/users/{self}","write":"interact"},{"path":"chat/{self}","write":"interact"},{"path":"notes/{self}","write":"interact"},{"path":"board/{self}","write":"interact"},{"path":"claims/{self}","write":"interact"},{"path":"seen/{self}","write":"interact"},{"path":"sounds/{self}","write":"interact"},{"path":"shifts/{self}","write":"interact"},{"path":"contrib/{self}","write":"interact"},{"path":"answer/{self}","write":"admin"},{"path":"shown/{self}","write":"interact"},{"path":"ideas/{self}","write":"interact"},{"path":"support/{self}","write":"interact"},{"path":"replies/{self}","write":"interact"},{"path":"avatars/{self}","write":"interact"},{"path":"pledges/{self}","write":"interact"},{"path":"paid/{self}","write":"admin"},{"path":"places/{self}","write":"interact"}],   /* v7 me: per-person collections from rules/*.json */
  leadTools, leadAction, saveFile, closeWrite, FI, refreshCard: (...a) => refreshCard(...a), tentCard: (...a) => tentCard(...a),
  get fireOn() { return fire.on; }, get firePiece() { return fire.piece; },   /* v7 co */
  JF, BADGE_SVG, closeJoin, giveStep: (...a) => giveStep7(...a), renderJoin: (...a) => renderJoin(...a),
  /* v7: host exports end */
} });
/* ---------- the camp's own music: original productions from the Mahala camp, one for each part of the way ----------
   Downtempo as you arrive (the book, the portal and Blissfull Drift), Acoustic Intro at the Lotus Mahal and inside it,
   Flower of Life through the camp and its main tent (and on to the build yard), and Song ID, Track 2 at The Seed and
   inside it. Moving between them crossfades over a few seconds; each track picks up where it was left. It plays only
   while Sound is on, under the playa wind and the fire. */
const MUSIC = {
  src: { arrive: 'assets/audio/downtempo.mp3', mahal: 'assets/audio/acoustic-intro.mp3', camp: 'assets/audio/flower-of-life.mp3', seed: 'assets/audio/song-id-2.mp3' },
  of: { book: 'arrive', portal: 'arrive', drift: 'arrive', mahal: 'mahal', camp: 'camp', yard: 'camp', seed: 'seed' },
  level: 0.6, el: {}, g: {}, stop: {}, now: null,
};
function musicWant() {
  if (inside) return insideAt === 'mahal' ? 'mahal' : 'seed';
  if (current === 'CAMP_TENT') return 'camp';
  const s = WAY[WY.i]; return (s && MUSIC.of[s.id]) || 'arrive';
}
function musicNode(k) {
  if (MUSIC.el[k]) return MUSIC.el[k];
  const el = new Audio(); el.src = MUSIC.src[k]; el.loop = true; el.preload = 'none'; MUSIC.el[k] = el;
  try { const g = SND.ctx.createGain(); g.gain.value = 0; SND.ctx.createMediaElementSource(el).connect(g).connect(SND.ctx.destination); MUSIC.g[k] = g; } catch (e) { el.volume = 0; }
  return el;
}
function musicMix(fromTap) {
  if (!SND.ctx) return;
  const want = SND.on ? musicWant() : null, t = SND.ctx.currentTime;
  if (want) musicNode(want);
  Object.keys(MUSIC.el).forEach((k) => {
    const el = MUSIC.el[k], g = MUSIC.g[k], up = k === want;
    clearTimeout(MUSIC.stop[k]);
    if (g) g.gain.setTargetAtTime(up ? MUSIC.level : 0, t, up ? 1.2 : 0.9); else el.volume = up ? MUSIC.level : 0;
    if (up) { if (el.paused) el.play().catch(() => {}); }
    else if (!el.paused) MUSIC.stop[k] = setTimeout(() => el.pause(), 5200);
  });
  // a tap on Sound is the moment phones allow sound to start, so every track is woken then, silently, for later
  if (fromTap && SND.on) Object.keys(MUSIC.src).forEach((k) => { if (k !== want) { const el = musicNode(k); el.play().then(() => { if (musicWant() !== k) el.pause(); }).catch(() => {}); } });
  MUSIC.now = want;
}
$('#soundBtn').addEventListener('click', () => musicMix(true));
setInterval(() => { const w = SND.on ? musicWant() : null; if (w !== MUSIC.now) musicMix(false); }, 700);
setTimeout(() => { if (SND.on) musicMix(false); }, 1200);       // arriving with Sound already on
window.__mahalaMusic = () => ({ want: MUSIC.now, playing: Object.keys(MUSIC.el).filter((k) => !MUSIC.el[k].paused), sound: SND.on });   // for the tests

import('./assets/together.js').then(m => m.start(window.__mahala)).catch(e => console.warn('The together layer did not start:', e));
import('./assets/v7/index.js').then(m => m.start(window.__mahala)).catch(e => console.warn('The v7 plugins did not start:', e));
