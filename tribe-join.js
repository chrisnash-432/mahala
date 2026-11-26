// Follow and subscribe (Mik's review, 26 Nov 2026, F-104 to F-115): two clear journeys instead of one long form.
// * Follow and subscribe (#join): a name, an email, how you found Mahala, Mahala news, and the Mahala Tribe
//   Announcements group on WhatsApp (its QR code and link show as soon as you tick it). Nothing more is asked.
// * Your tribe profile, the optional second step: where you live, what matters to you, why Mahala or The Seed, and a
//   password. The password is asked here, on the form, so there is no second sheet; the address is proved with the
//   six-digit code in the confirmation email, typed on this page, and you land on Your Mahala signed in.
// * Apply to join the camp (#apply; the old #waitlist lands here too): the same two steps with the profile required,
//   since every camp member is a tribe member. The camp application itself opens from Your Mahala.
// What a camper brings and their dream belong to the camp application and Your Mahala, not here (F-107, F-109).
// The answers go to the camp's Google Sheet (its Tribe tab) through site.js, one row per person, either way.
(function () {
  var SITE = window.MAHALA_SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var box = $('tjoin'), body = $('tjoinBody'), stepEl = $('tjoinStep');
  if (!box || !body) return;

  // the Mahala Tribe Announcements group: open to anyone who follows (the camp members' group lives behind sign-in)
  var WA_TRIBE = 'https://chat.whatsapp.com/FOKRiNUU6gH41G7vRKWvqt';
  var BEFORE = 'I have camped with Mahala before', BROUGHT = 'Someone in Mahala brought me';
  var FOUND = [BEFORE, BROUGHT, 'A friend', 'AfrikaBurn', 'Instagram or online', 'Somewhere else'];
  // the same 13 words the tribe page counts, so every answer adds to "What we come for"
  var VALUES = [['connection', 'Connection'], ['play', 'Play'], ['spirit', 'Spirit'], ['healing', 'Healing and growth'], ['creativity', 'Creativity'],
    ['nature', 'Nature'], ['service', 'Service'], ['freedom', 'Freedom'], ['presence', 'Presence'], ['learning', 'Learning'], ['beauty', 'Beauty'],
    ['inclusion', 'Inclusion'], ['legacy', 'Legacy']];
  var MAX_VALUES = 3, PW_MIN = 8;

  var A = { name: '', email: '', based: '', town: '', country: '', found: '', broughtBy: '', adult: false, draws: '', values: [],
    news: false, whatsappCommunity: false, whatsapp: '', share: false, loveToCome: false, password: '', code: '', ref: '' };
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('name')) A.name = q.get('name').slice(0, 40);
    if (q.get('by')) { A.found = BROUGHT; A.broughtBy = q.get('by').slice(0, 60); }
    A.ref = (q.get('ref') || q.get('inv') || '').slice(0, 60);
  } catch (e) { }
  // What this browser already sent (a camp application, an email sign-up) fills the same boxes here, so nobody types
  // it twice (F-050). Only empty answers are filled.
  try {
    var sent = (JSON.parse(localStorage.getItem('mahala.outbox') || '[]') || []).slice().reverse();
    var had = function (k) { var r = sent.filter(function (x) { return x && x[k]; })[0]; return r ? String(r[k]) : ''; };
    if (!A.name) A.name = had('name').slice(0, 40);
    if (!A.email) A.email = had('email').slice(0, 80);
    var w = had('whatsapp'); if (w) { A.whatsapp = w.slice(0, 30); }
    var lv = had('livesIn'), tf = had('travelFrom');
    if (lv) { A.based = /south africa/i.test(lv) ? 'sa' : 'away'; if (A.based === 'sa') A.country = 'South Africa'; }
    if (tf) A.town = tf.slice(0, 50);
  } catch (e) { /* storage blocked */ }

  // screens: 1 follow, 2 your tribe profile, 3 the code from the email, 'followed' the end of following only
  var step = 1, MODE = 'follow', SENT = false, BUSY = false;
  var titleEl = $('tjoinH');
  var MM = function () { return window.MahalaMembers || null; };
  var accounts = function () { var m = MM(); return !!(m && m.signUp); };

  function field(id, label, input, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + (hint ? '<p class="hint" id="' + id + 'H">' + hint + '</p>' : '') + input + '</div>'; }
  function chips(name, items, chosen, multi) {
    return '<div class="opts chips-pick" role="group">' + items.map(function (it) {
      var v = Array.isArray(it) ? it[0] : it, l = Array.isArray(it) ? it[1] : it, on = multi ? chosen.indexOf(v) >= 0 : chosen === v;
      return '<button type="button" class="pick' + (on ? ' on' : '') + '" data-pick="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
  }
  function tick(id, on, words) { return '<label class="opt tick"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span>' + words + '</span></label>'; }
  function waBox() {
    return '<div class="wa-join"><img src="assets/wa-tribe-qr.svg" width="148" height="148" alt="QR code for the Mahala Tribe Announcements group on WhatsApp">'
      + '<div><p><b>Scan the code with your phone, or tap to open the group.</b></p>'
      + '<a class="act solid wa-link" href="' + WA_TRIBE + '" target="_blank" rel="noopener" data-count="WhatsApp tribe group" data-count-where="Follow and subscribe">Join the group on WhatsApp</a></div></div>';
  }

  var SCREENS = {
    1: function () {
      var apply = MODE === 'apply';
      return '<h2 class="h-sub">' + (apply ? 'Apply to join the camp' : 'Follow and subscribe') + '</h2>'
        + '<p class="small centre">' + (apply ? 'Every camp member is a tribe member, so it starts with your tribe profile: two short steps. Your camp application opens right after, from your own page.'
          : 'News of the gatherings, the build and The Seed, by email and on WhatsApp. Nothing else is asked of you.') + '</p>'
        + field('tName', 'What name do you go by?', '<input type="text" id="tName" maxlength="40" autocomplete="name" value="' + esc(A.name) + '">', 'Your playa name is welcome.')
        + field('tEmail', 'Your email', '<input type="email" id="tEmail" maxlength="80" autocomplete="email" inputmode="email" value="' + esc(A.email) + '">', 'Never shown to anyone.')
        + '<fieldset class="field"><legend class="flabel">How did you find Mahala?</legend>' + chips('found', FOUND, A.found, false) + '</fieldset>'
        + (A.found === BROUGHT ? field('tBy', 'Who brought you?', '<input type="text" id="tBy" maxlength="60" value="' + esc(A.broughtBy) + '">', 'So we can thank them.') : '')
        + '<div class="camp-wish">'
        + tick('tNews', A.news, '<b>Send me Mahala news by email.</b> A few times a year: gatherings, build days, The Seed. One click to stop.')
        + tick('tWaC', A.whatsappCommunity, '<b>Add me to the Mahala Tribe Announcements group on WhatsApp.</b>')
        + (A.whatsappCommunity ? waBox() + field('tWa', 'Your WhatsApp number <small>(optional)</small>', '<input type="tel" id="tWa" maxlength="30" autocomplete="tel" placeholder="+27 …" value="' + esc(A.whatsapp) + '">', 'With the country code, in case the link does not work for you. Only the stewards see it.') : '')
        + (apply ? '' : tick('tLove', A.loveToCome, '<b>I would love to apply to join the camp in 2027.</b>')
          + '<p class="small">Places in the camp are limited to 50. Ticked or not, you follow Mahala: the tribe is bigger than the camp.</p>')
        + '</div><input type="text" id="tHp" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">';
    },
    2: function () {
      var apply = MODE === 'apply';
      return '<h2 class="h-sub">Getting to know you</h2>'
        + '<p class="small centre">' + (apply ? 'Your tribe profile. Then your page opens, with your camp application one tap away.'
          : 'Make your tribe profile too? It lets you see who the tribe is and where we live around the world, step into the Mahalaverse, and apply to the camp whenever you are ready. Or just follow for now.') + '</p>'
        + '<fieldset class="field"><legend class="flabel">Where do you live?</legend>' + chips('based', [['sa', 'South Africa'], ['away', 'International']], A.based, false) + '</fieldset>'
        + (A.based === 'sa' ? field('tTown', 'Which town or city?', '<input type="text" id="tTown" maxlength="50" autocomplete="address-level2" value="' + esc(A.town) + '">') : '')
        + (A.based === 'away' ? '<div class="two">' + field('tTown', 'Which town or city?', '<input type="text" id="tTown" maxlength="50" autocomplete="address-level2" value="' + esc(A.town) + '">')
          + field('tCountry', 'Which country?', '<input type="text" id="tCountry" maxlength="40" autocomplete="country-name" value="' + esc(A.country) + '">') + '</div>' : '')
        + field('tDraws', 'Why are you interested in Mahala or The Seed?' + (apply ? '' : ' <small>(optional)</small>'), '<textarea id="tDraws" maxlength="1200">' + esc(A.draws) + '</textarea>', 'A few lines is plenty. The camp leads read every one.')
        + '<fieldset class="field"><legend class="flabel">What matters most to you? <small>Up to three, optional.</small></legend>' + chips('values', VALUES, A.values, true) + '</fieldset>'
        + tick('tShare', A.share, '<b>Let other tribe members see my profile:</b> my name, my town and country, and what matters to me. Never my email or number.')
        + tick('tAdult', A.adult, '<b>I am 18 or over.</b>')
        + (accounts() ? field('tPw', 'Choose a password', '<input type="password" id="tPw" minlength="' + PW_MIN + '" maxlength="72" autocomplete="new-password" value="' + esc(A.password) + '">', 'At least ' + PW_MIN + ' characters. You sign in with your email and this password.') : '');
    },
    3: function () {
      return '<h2 class="h-sub">Check your email</h2>'
        + '<p class="small centre">We have sent a six-digit code to <b>' + esc(A.email) + '</b>. Type it here and your tribe profile is made. It can take a minute; look in Promotions or Spam too.</p>'
        + field('tCode', 'The code from the email', '<input type="text" id="tCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" value="' + esc(A.code) + '">')
        + '<p class="small">The email has a link as well: opening it in this browser works too.</p>'
        + '<p><button type="button" class="link" id="tResend">Send me a new code</button></p>';
    },
  };

  var okEmail = function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim()); };
  function profileOk() {
    return !!A.based && !!A.town.trim() && !!A.country.trim() && A.adult && (MODE !== 'apply' || A.draws.trim().length >= 3) && (!accounts() || A.password.length >= PW_MIN);
  }
  function canGo() {
    if (step === 1) return !!A.name.trim() && okEmail() && !!A.found;
    if (step === 2) return profileOk();
    if (step === 3) return A.code.replace(/\D/g, '').length >= 6;
    return true;
  }
  function why() {
    if (step === 1) {
      if (!A.name.trim()) return 'Tell us the name you go by.';
      if (!okEmail()) return 'Add your email address.';
      return 'Choose how you found Mahala.';
    }
    if (step === 2) {
      if (!A.based) return 'Tell us where you live: South Africa, or international.';
      if (!A.town.trim()) return 'Tell us your town or city.';
      if (!A.country.trim()) return 'Tell us which country you live in.';
      if (MODE === 'apply' && A.draws.trim().length < 3) return 'A line or two about why Mahala or The Seed.';
      if (!A.adult) return 'Profiles are for adults: please confirm you are 18 or over.';
      return 'Choose a password of at least ' + PW_MIN + ' characters.';
    }
    if (step === 3) return 'Type the six numbers from the email.';
    return '';
  }
  function read() {
    var v = function (id) { var e = $(id); return e ? e.value : null; }, c = function (id) { var e = $(id); return e ? e.checked : null; };
    if (step === 1) {
      A.name = (v('tName') || '').trim(); A.email = (v('tEmail') || '').trim();
      if ($('tBy')) A.broughtBy = v('tBy').trim();
      A.news = !!c('tNews'); A.whatsappCommunity = !!c('tWaC'); if ($('tWa')) A.whatsapp = v('tWa').trim();
      A.loveToCome = MODE === 'apply' ? true : !!c('tLove');
    }
    if (step === 2) {
      if ($('tTown')) A.town = v('tTown').trim(); if ($('tCountry')) A.country = v('tCountry').trim();
      if (A.based === 'sa') A.country = 'South Africa';
      A.draws = v('tDraws') || ''; A.share = !!c('tShare'); A.adult = !!c('tAdult'); if ($('tPw')) A.password = v('tPw');
    }
    if (step === 3) A.code = (v('tCode') || '').trim();
  }
  function acts() {
    var go = step === 1 ? 'Continue' : step === 2 ? 'Make my tribe profile' : 'Finish';
    return '<div class="j-acts"><button class="act solid" type="button" id="tGo"' + (canGo() ? '' : ' aria-disabled="true"') + '>' + go + '</button>'
      + (step === 2 && MODE !== 'apply' ? '<button class="act" type="button" id="tFollow">Just follow for now</button>' : '')
      + (step === 3 ? '' : '<button class="act quiet" type="button" id="tBack">' + (step === 1 ? 'Close' : 'Back') + '</button>') + '</div>';
  }
  function draw(focus) {
    stepEl.textContent = step <= 2 ? step + ' of 2' : '';
    body.innerHTML = SCREENS[step]() + '<p class="err" id="tErr" role="alert"></p>' + acts();
    box.scrollTop = 0;
    if (focus) { var h = body.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }
  function keep(fn) { var y = box.scrollTop; fn(); box.scrollTop = y; }
  function refreshGo() { var g = $('tGo'); if (!g) return; if (canGo()) { g.removeAttribute('aria-disabled'); $('tErr').textContent = ''; } else g.setAttribute('aria-disabled', 'true'); }
  function say(t) { var e = $('tErr'); if (e) e.textContent = t || ''; }
  function busy(on, label) { BUSY = on; var g = $('tGo'); if (!g) return; if (on) { g.setAttribute('aria-disabled', 'true'); g.dataset.was = g.textContent; g.textContent = label || 'Sending'; } else { g.textContent = g.dataset.was || g.textContent; refreshGo(); } }

  body.addEventListener('input', function () { read(); refreshGo(); });
  body.addEventListener('change', function (e) {
    if (e.target.id === 'tWaC') { read(); keep(function () { draw(false); }); var t = $('tWaC'); if (t) t.focus({ preventScroll: true }); return; }
    read(); refreshGo();
  });
  body.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]');
    if (p) {
      read();
      var k = p.dataset.pick, v = p.dataset.v;
      if (k === 'found') A.found = v;
      else if (k === 'based') { A.based = v; A.country = v === 'sa' ? 'South Africa' : (/^south africa$/i.test(A.country) ? '' : A.country); }
      else { var arr = A[k], at = arr.indexOf(v); if (at >= 0) arr.splice(at, 1); else if (k !== 'values' || arr.length < MAX_VALUES) arr.push(v); }
      keep(function () { draw(false); });
      var again = body.querySelector('[data-pick="' + k + '"][data-v="' + v.replace(/"/g, '\\"') + '"]'); if (again) again.focus({ preventScroll: true });
      if (k === 'found' && v === BROUGHT && $('tBy')) $('tBy').focus({ preventScroll: true });
      if (k === 'based' && $('tTown') && !A.town) $('tTown').focus({ preventScroll: true });
      return;
    }
    if (BUSY) return;
    if (e.target.closest('#tBack')) { read(); if (step === 1) closeJoin(); else { step--; draw(true); } return; }
    if (e.target.closest('#tFollow')) { read(); follow(); return; }
    if (e.target.closest('#tResend')) { resend(); return; }
    if (e.target.closest('#tGo')) {
      read();
      if (!canGo()) { say(why()); return; }
      if (step === 1) { step = 2; draw(true); return; }
      if (step === 2) { profile(); return; }
      if (step === 3) { verify(); }
    }
  });

  // one row in the sheet, whichever way someone goes; a second tap never sends it twice
  function post(withProfile) {
    if (SENT) return Promise.resolve();
    var row = {
      type: 'tribe', path: MODE === 'apply' ? 'apply' : 'tribe', id: 'T' + Date.now().toString(36).toUpperCase(),
      name: A.name, email: A.email, found: A.found, broughtBy: A.found === BROUGHT ? A.broughtBy : '',
      news: A.news, whatsappCommunity: A.whatsappCommunity, whatsapp: A.whatsappCommunity ? A.whatsapp : '', loveToCome: A.loveToCome,
      profile: !!withProfile, town: withProfile ? A.town : '', country: withProfile ? A.country : '', adult: withProfile ? A.adult : false,
      draws: withProfile ? A.draws.trim() : '', values: withProfile ? A.values : [], share: withProfile ? A.share : false,
      waitlist: MODE === 'apply', ref: A.ref, hp: ($('tHp') && $('tHp').value) || ''
    };
    return (SITE.post ? SITE.post(row) : Promise.reject(new Error('no sheet'))).then(function () { SENT = true; });
  }
  function follow() {
    busy(true);
    post(false).then(function () {
      BUSY = false; step = 'followed'; stepEl.textContent = '';
      var who = (A.name || '').split(/\s+/)[0];
      body.innerHTML = '<div class="j-done" tabindex="-1"><p class="eyebrow">Thank you</p><h2 class="h-sub">You are following Mahala' + (who ? ', ' + esc(who) : '') + '.</h2>'
        + '<ol class="next">' + (A.news ? '<li><span><b>Mahala news comes by email</b>, a few times a year. One click to stop.</span></li>' : '')
        + (A.whatsappCommunity ? '<li><span><b>The tribe announcements on WhatsApp:</b> scan the code or tap the button, if you have not yet.</span></li>' : '')
        + (A.loveToCome ? '<li><span><b>Thinking of the camp?</b> Make your tribe profile whenever you are ready; your camp application opens from it.</span></li>' : '')
        + '</ol>' + (A.whatsappCommunity ? waBox() : '')
        + '<div class="j-acts">' + (accounts() ? '<button class="act solid" type="button" id="tMake">Make my tribe profile</button>' : '')
        + '<button class="act" type="button" id="tDone">Back to the tribe</button></div></div>';
      body.querySelector('.j-done').focus({ preventScroll: true });
      $('tDone').addEventListener('click', closeJoin);
      if ($('tMake')) $('tMake').addEventListener('click', function () { step = 2; draw(true); });
    }, function () { busy(false); say('That did not go through. Please check your connection and try again.'); });
  }
  function keepCopy() {
    // never the WhatsApp number or the password: the first sign-in reads this copy so nothing is asked twice
    try { localStorage.setItem('mahala.tribe', JSON.stringify({ name: A.name, based: A.based, town: A.town, country: A.country, skills: [], other: '', passions: [],
      creating: '', news: A.news, wa: A.whatsappCommunity, share: A.share, love: A.loveToCome, at: Date.now() })); } catch (e) { /* storage blocked */ }
  }
  function profile() {
    busy(true, 'Making your profile');
    post(true).then(function () {
      if (!accounts()) { BUSY = false; follow(); return; }
      keepCopy();
      return MM().signUp({ email: A.email, password: A.password, name: A.name }).then(function (r) {
        busy(false);
        if (r.state === 'code') { step = 3; draw(true); var c = $('tCode'); if (c) c.focus({ preventScroll: true }); return; }
        if (r.state === 'in') { body.innerHTML = '<div class="j-done"><h2 class="h-sub">Welcome to the tribe.</h2><p class="small">Opening your page…</p></div>'; return; }
        if (r.state === 'exists') {
          body.innerHTML = '<div class="j-done" tabindex="-1"><h2 class="h-sub">You already have a tribe profile</h2>'
            + '<p class="small">There is already an account with ' + esc(A.email) + '. Sign in with it, or choose a new password from the sign-in box.</p>'
            + '<div class="j-acts"><button class="act solid" type="button" id="tSignIn">Sign in</button><button class="act" type="button" id="tDone">Close</button></div></div>';
          $('tSignIn').addEventListener('click', function () { MM().signIn(); });
          $('tDone').addEventListener('click', closeJoin);
          return;
        }
        say(r.text || 'That did not work. Try again in a little while.');
      });
    }).catch(function () { busy(false); say('That did not go through. Please check your connection and try again.'); });
  }
  function verify() {
    busy(true, 'Checking');
    MM().verifyCode({ email: A.email, code: A.code }).then(function (r) {
      if (r.state === 'in') { body.innerHTML = '<div class="j-done"><h2 class="h-sub">Welcome to the tribe.</h2><p class="small">Opening your page…</p></div>'; return; }
      busy(false); say(r.text);
    });
  }
  function resend() {
    var b = $('tResend'); if (b) b.disabled = true;
    MM().resendCode({ email: A.email }).then(function (r) {
      if (b) b.disabled = false;
      say(r.state === 'error' ? r.text : 'A new code is on its way to ' + A.email + '. Use the newest one: it replaces the last.');
    });
  }

  var opener = null;
  function openJoin(from, mode) {
    opener = from || document.activeElement;
    MODE = mode === 'apply' ? 'apply' : 'follow';
    if (MODE === 'apply') A.loveToCome = true;
    if (step === 'followed' && MODE !== 'apply') step = 1;
    if (step === 'followed') step = 2;
    if (titleEl) titleEl.textContent = MODE === 'apply' ? 'Apply to join the camp' : 'Follow and subscribe';
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
  document.querySelectorAll('[data-tribe-join]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openJoin(b, b.getAttribute('data-tribe-join') === 'apply' ? 'apply' : 'follow'); }); });
  if (/^#join$/i.test(location.hash)) openJoin();
  else if (/^#(apply|waitlist)$/i.test(location.hash)) openJoin(null, 'apply');
  else if (/^#profile$/i.test(location.hash)) openJoin(null, 'follow');
  window.__tribeJoin = { open: openJoin, state: function () { return { step: step, A: A, mode: MODE }; } };
})();
