// Join the tribe: open to anyone, on the tribe page. Five questions are needed, six more are there for whoever wants
// them, then how we stay in touch. The answers go to the camp's Google Sheet (its Tribe tab) through site.js, until
// member accounts open; then each row becomes an invitation to claim that account. The camp itself is by invitation:
// here a person can only say they would love to come.
(function () {
  var SITE = window.MAHALA_SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var box = $('tjoin'), body = $('tjoinBody'), stepEl = $('tjoinStep');
  if (!box || !body) return;

  var FOUND = ['Someone in Mahala brought me', 'A friend', 'AfrikaBurn', 'Instagram or online', 'Somewhere else'];
  // the same 13 words the tribe page counts, so every answer adds to "What we come for"
  var VALUES = [['connection', 'Connection'], ['play', 'Play'], ['spirit', 'Spirit'], ['healing', 'Healing and growth'], ['creativity', 'Creativity'],
    ['nature', 'Nature'], ['service', 'Service'], ['freedom', 'Freedom'], ['presence', 'Presence'], ['learning', 'Learning'], ['beauty', 'Beauty'],
    ['inclusion', 'Inclusion'], ['legacy', 'Legacy']];
  // the ten skills on the camp page, so an invited person's camp application never asks again
  var SKILLS = ['Building and carpentry', 'Electrics, lighting and power', 'Sound, DJing and music production', 'Live instruments and voice',
    'Art, painting and decor', 'Kitchen and feeding the tribe', 'Healing, bodywork and breathwork', 'Ceremony and space holding',
    'Movement, dance and performance', 'Logistics and getting things done'];
  var MAX_VALUES = 3, MAX_PASSIONS = 5, STEPS = 5;

  var A = { name: '', email: '', town: '', country: '', found: '', broughtBy: '', adult: false, draws: '', values: [], skills: [], other: '',
    passions: [], creating: '', more: '', world: '', news: false, whatsappCommunity: false, whatsapp: '', share: false, loveToCome: false, ref: '' };
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('name')) A.name = q.get('name').slice(0, 40);
    if (q.get('by')) { A.found = FOUND[0]; A.broughtBy = q.get('by').slice(0, 60); }
    A.ref = (q.get('ref') || q.get('inv') || '').slice(0, 60);
  } catch (e) { }
  var step = 1;

  function field(id, label, input, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + (hint ? '<p class="hint" id="' + id + 'H">' + hint + '</p>' : '') + input + '</div>'; }
  function chips(name, items, chosen, multi) {
    return '<div class="opts chips-pick" role="group">' + items.map(function (it) {
      var v = Array.isArray(it) ? it[0] : it, l = Array.isArray(it) ? it[1] : it, on = multi ? chosen.indexOf(v) >= 0 : chosen === v;
      return '<button type="button" class="pick' + (on ? ' on' : '') + '" data-pick="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
  }
  function tick(id, on, words) { return '<label class="opt tick"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span>' + words + '</span></label>'; }
  var seen = function (who) { return '<span class="seen">' + who + '</span>'; };

  var SCREENS = {
    1: function () {
      return '<h2 class="h-sub">Who you are</h2>' +
        field('tName', 'What name do you go by?', '<input type="text" id="tName" maxlength="40" autocomplete="name" value="' + esc(A.name) + '">', 'Your playa name is welcome.') +
        field('tEmail', 'Your email', '<input type="email" id="tEmail" maxlength="80" autocomplete="email" inputmode="email" value="' + esc(A.email) + '">', 'So we can welcome you, and later open your own page in the tribe. Never shown to anyone.') +
        '<div class="two">' + field('tTown', 'Where do you live?', '<input type="text" id="tTown" maxlength="50" autocomplete="address-level2" placeholder="Town or city" value="' + esc(A.town) + '">') +
        field('tCountry', 'Country', '<input type="text" id="tCountry" maxlength="40" autocomplete="country-name" value="' + esc(A.country) + '">') + '</div>' +
        '<fieldset class="field"><legend class="flabel">How did you find Mahala?</legend>' + chips('found', FOUND, A.found, false) + '</fieldset>' +
        (A.found === FOUND[0] ? field('tBy', 'Who brought you?', '<input type="text" id="tBy" maxlength="60" value="' + esc(A.broughtBy) + '">', 'So we can thank them.') : '') +
        tick('tAdult', A.adult, '<b>I am 18 or over.</b>');
    },
    2: function () {
      return '<h2 class="h-sub">Why Mahala</h2>' +
        field('tDraws', 'What draws you to Mahala?', '<textarea id="tDraws" maxlength="1200" aria-describedby="tDrawsH">' + esc(A.draws) + '</textarea>', 'A few lines is plenty. The camp leads read every one.');
    },
    3: function () {
      return '<h2 class="h-sub">What you bring and love</h2>' +
        '<p class="small centre">All optional. Your answers join the tribe page\'s counts, never your name.</p>' +
        '<fieldset class="field"><legend class="flabel">What matters most to you? <small>Up to three.</small></legend>' + chips('values', VALUES, A.values, true) + '</fieldset>' +
        '<fieldset class="field"><legend class="flabel">What do you bring? <small>As many as you like.</small></legend>' + chips('skills', SKILLS, A.skills, true) + '</fieldset>' +
        field('tOther', 'Something else you bring <small>(optional)</small>', '<input type="text" id="tOther" maxlength="120" value="' + esc(A.other) + '">') +
        field('tPassion', 'What lights you up? <small>Up to five, press Enter after each.</small>',
          '<div class="tags" id="tTags">' + A.passions.map(function (p, i) { return '<button type="button" class="tag" data-untag="' + i + '" aria-label="Remove ' + esc(p) + '">' + esc(p) + '<span aria-hidden="true">×</span></button>'; }).join('') +
          (A.passions.length < MAX_PASSIONS ? '<input type="text" id="tPassion" maxlength="30" enterkeyhint="enter" placeholder="' + (A.passions.length ? 'And?' : 'Sound journeys, salsa, woodwork') + '">' : '') + '</div>');
    },
    4: function () {
      return '<h2 class="h-sub">Your dream</h2>' +
        '<p class="small centre">All optional, and only if you feel like it. You can add them later.</p>' +
        field('tCreating', 'What are you creating, or longing to create?', '<textarea id="tCreating" maxlength="800">' + esc(A.creating) + '</textarea>', seen('Members can see this, if you choose to share below.')) +
        field('tMore', 'What do you want more of in your life this year?', '<textarea id="tMore" maxlength="800">' + esc(A.more) + '</textarea>', seen('Only you and the camp\'s stewards. Please leave out health details.')) +
        field('tWorld', 'What world are you dreaming into being?', '<textarea id="tWorld" maxlength="800">' + esc(A.world) + '</textarea>', seen('Members can see this, if you choose to share below.'));
    },
    5: function () {
      return '<h2 class="h-sub">Staying in touch</h2>' +
        tick('tNews', A.news, '<b>Send me Mahala news by email.</b> A few times a year: gatherings, build days, The Seed. One click to stop.') +
        tick('tWaC', A.whatsappCommunity, '<b>Add me to the Mahala WhatsApp Community.</b>') +
        (A.whatsappCommunity ? field('tWa', 'Your WhatsApp number', '<input type="tel" id="tWa" maxlength="30" autocomplete="tel" placeholder="+27 …" value="' + esc(A.whatsapp) + '">', 'With the country code. Only the stewards see it.') : '') +
        tick('tShare', A.share, '<b>Let other tribe members see my answers</b> when the members\' pages open: my name, where I live (town and country), what matters to me, what I bring and love, and my dream. Never my email or number.') +
        '<div class="camp-wish">' + tick('tLove', A.loveToCome, '<b>I would love to come to the camp in 2027.</b>') +
        '<p class="small">The camp is by invitation and holds about 50 to 60 of us. The camp leads read every introduction and invite in waves, so this puts you on their list, with no application.</p></div>' +
        '<input type="text" id="tHp" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">';
    },
  };

  var okEmail = function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim()); };
  function canGo() {
    if (step === 1) return !!A.name.trim() && okEmail() && !!A.town.trim() && !!A.country.trim() && !!A.found && A.adult;
    if (step === 2) return A.draws.trim().length >= 3;
    if (step === 5) return !A.whatsappCommunity || A.whatsapp.replace(/\D/g, '').length >= 8;
    return true;
  }
  function why() {
    if (step === 1) {
      if (!A.name.trim()) return 'Tell us the name you go by.';
      if (!okEmail()) return 'Add your email address so we can welcome you.';
      if (!A.town.trim() || !A.country.trim()) return 'Tell us your town or city, and your country.';
      if (!A.found) return 'Choose how you found Mahala.';
      return 'Profiles are for adults: please confirm you are 18 or over.';
    }
    if (step === 2) return 'A line or two about what draws you here.';
    if (step === 5) return 'Add your WhatsApp number, or untick the WhatsApp Community.';
    return '';
  }
  function read() {
    var v = function (id) { var e = $(id); return e ? e.value : null; }, c = function (id) { var e = $(id); return e ? e.checked : null; };
    if (step === 1) { A.name = (v('tName') || '').trim(); A.email = (v('tEmail') || '').trim(); A.town = (v('tTown') || '').trim(); A.country = (v('tCountry') || '').trim();
      if ($('tBy')) A.broughtBy = v('tBy').trim(); A.adult = !!c('tAdult'); }
    if (step === 2) A.draws = v('tDraws') || '';
    if (step === 3) A.other = (v('tOther') || '').trim();
    if (step === 4) { A.creating = v('tCreating') || ''; A.more = v('tMore') || ''; A.world = v('tWorld') || ''; }
    if (step === 5) { A.news = !!c('tNews'); A.whatsappCommunity = !!c('tWaC'); if ($('tWa')) A.whatsapp = v('tWa').trim(); A.share = !!c('tShare'); A.loveToCome = !!c('tLove'); }
  }
  function draw(focus) {
    stepEl.textContent = step <= STEPS ? step + ' of ' + STEPS : '';
    var optional = step === 3 || step === 4, last = step === STEPS;
    body.innerHTML = SCREENS[step]() +
      '<p class="err" id="tErr" role="alert"></p>' +
      '<div class="j-acts">' +
      '<button class="act solid" type="button" id="tGo"' + (canGo() ? '' : ' aria-disabled="true"') + '>' + (last ? 'Join the tribe' : 'Continue') + '</button>' +
      (optional ? '<button class="act" type="button" id="tSkip">Skip for now</button>' : '') +
      '<button class="act quiet" type="button" id="tBack">' + (step === 1 ? 'Close' : 'Back') + '</button></div>';
    box.scrollTop = 0;
    if (focus) { var h = body.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }
  function keep(fn) { var y = box.scrollTop; fn(); box.scrollTop = y; }
  function refreshGo() { var g = $('tGo'); if (!g) return; if (canGo()) { g.removeAttribute('aria-disabled'); $('tErr').textContent = ''; } else g.setAttribute('aria-disabled', 'true'); }
  function addTag() {
    var i = $('tPassion'); if (!i) return;
    var t = i.value.replace(/[,;]+$/, '').trim().toLowerCase();
    if (t && A.passions.indexOf(t) < 0 && A.passions.length < MAX_PASSIONS) A.passions.push(t);
    read(); keep(function () { draw(false); }); var n = $('tPassion'); if (n) n.focus({ preventScroll: true });
  }

  body.addEventListener('input', function () { read(); refreshGo(); });
  body.addEventListener('change', function (e) {
    if (e.target.id === 'tWaC') { read(); keep(function () { draw(false); }); var w = $('tWa'); if (w) w.focus({ preventScroll: true }); return; }
    read(); refreshGo();
  });
  body.addEventListener('keydown', function (e) {
    if (e.target.id === 'tPassion' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addTag(); }
  });
  body.addEventListener('focusout', function (e) { if (e.target.id === 'tPassion' && e.target.value.trim()) setTimeout(addTag, 0); });
  body.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]');
    if (p) {
      read();
      var k = p.dataset.pick, v = p.dataset.v;
      if (k === 'found') A.found = v;
      else { var arr = A[k], at = arr.indexOf(v); if (at >= 0) arr.splice(at, 1); else if (k !== 'values' || arr.length < MAX_VALUES) arr.push(v); }
      keep(function () { draw(false); });
      var again = body.querySelector('[data-pick="' + k + '"][data-v="' + v.replace(/"/g, '\\"') + '"]'); if (again) again.focus({ preventScroll: true });
      if (k === 'found' && v === FOUND[0] && $('tBy')) $('tBy').focus({ preventScroll: true });
      return;
    }
    var u = e.target.closest('[data-untag]');
    if (u) { read(); A.passions.splice(+u.dataset.untag, 1); keep(function () { draw(false); }); var n = $('tPassion'); if (n) n.focus({ preventScroll: true }); return; }
    if (e.target.closest('#tBack')) { read(); if (step === 1) closeJoin(); else { step--; draw(true); } return; }
    if (e.target.closest('#tSkip')) { read(); step++; draw(true); return; }
    if (e.target.closest('#tGo')) {
      read(); if ($('tPassion') && $('tPassion').value.trim()) addTag();
      if (!canGo()) { $('tErr').textContent = why(); return; }
      if (step < STEPS) { step++; draw(true); return; }
      send();
    }
  });

  function send() {
    var g = $('tGo'); g.setAttribute('aria-disabled', 'true'); g.textContent = 'Sending';
    var row = {
      type: 'tribe', path: 'tribe', id: 'T' + Date.now().toString(36).toUpperCase(),
      name: A.name, email: A.email, town: A.town, country: A.country, found: A.found, broughtBy: A.found === FOUND[0] ? A.broughtBy : '', adult: A.adult,
      draws: A.draws.trim(), values: A.values, skills: A.skills, other: A.other, passions: A.passions,
      creating: A.creating.trim(), more: A.more.trim(), world: A.world.trim(),
      news: A.news, whatsappCommunity: A.whatsappCommunity, whatsapp: A.whatsappCommunity ? A.whatsapp : '', share: A.share, loveToCome: A.loveToCome,
      ref: A.ref, hp: ($('tHp') && $('tHp').value) || ''
    };
    (SITE.post ? SITE.post(row) : Promise.reject(new Error('no sheet'))).then(function () {
      step = STEPS + 1; stepEl.textContent = '';
      var who = (A.name || '').split(/\s+/)[0];
      body.innerHTML = '<div class="j-done" tabindex="-1"><p class="eyebrow">Welcome</p><h2 class="h-sub">Welcome to the tribe' + (who ? ', ' + esc(who) : '') + '.</h2>' +
        '<ol class="next">' +
        '<li><span><b>We read every introduction.</b> Someone from Mahala will say hello by email.</span></li>' +
        (A.loveToCome ? '<li><span><b>You are on the camp leads\' list.</b> Invitations go out in waves; if yours comes, it comes with a letter.</span></li>' : '') +
        '<li><span><b>Your own page is coming.</b> When members\' pages open, you sign in with this email and your answers are waiting.</span></li></ol>' +
        '<div class="j-acts"><a class="act solid" href="./#mahalaverse" id="tMv">Step into the Mahalaverse</a><button class="act" type="button" id="tDone">Back to the tribe</button></div></div>';
      body.querySelector('.j-done').focus({ preventScroll: true });
      $('tDone').addEventListener('click', closeJoin);
      $('tMv').addEventListener('click', function (e) {        // over the front page: close this pane and step in there
        if (window.parent === window) return;
        try { if (window.parent.location.origin !== location.origin) return; } catch (err) { return; }
        e.preventDefault(); parent.postMessage({ mahala: 'go', hash: 'mahalaverse' }, location.origin);
      });
    }).catch(function () {
      $('tErr').textContent = 'That did not go through. Please check your connection and try again.';
      g.removeAttribute('aria-disabled'); g.textContent = 'Join the tribe';
    });
  }

  var opener = null;
  function openJoin(from) {
    opener = from || document.activeElement;
    if (step > STEPS) step = 1;
    box.hidden = false; document.documentElement.classList.add('join-open');
    requestAnimationFrame(function () { box.classList.add('is-open'); });
    draw(true);
  }
  function closeJoin() {
    box.classList.remove('is-open'); document.documentElement.classList.remove('join-open');
    setTimeout(function () { box.hidden = true; }, 250);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  $('tjoinClose').addEventListener('click', function () { read(); closeJoin(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) { e.stopImmediatePropagation(); read(); closeJoin(); } }, true);
  document.querySelectorAll('[data-tribe-join]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openJoin(b); }); });
  if (/^#join$/i.test(location.hash)) openJoin();
  window.__tribeJoin = { open: openJoin, state: function () { return { step: step, A: A }; } };
})();
