// Join the camp: the application, in four steps, on the camp page. The answers go to the camp's Google Sheet
// (its Applications tab) through site.js. Nothing is paid here: once a camp lead has confirmed a place, they send
// a payment link. Figures are working figures, and say so.
(function () {
  var SITE = window.MAHALA_SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nb = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };

  var SKILLS = [['Build', 'Frame crew'], ['Fabricate', 'Temple Tech crew'], ['Light', 'Light crew'], ['Cook', 'Camp crew'], ['Art', 'Petal crew'],
    ['Story', 'Story crew'], ['Care', 'Camp crew'], ['Host an event', 'Story crew'], ['Sound', 'Story crew'], ['Money and admin', 'Camp crew']];
  var FEE = { sa: { cur: 'ZAR', sym: 'R ', place: 7500, coil: 9000 }, away: { cur: 'USD', sym: '$ ', place: 1000, coil: 500 } };
  var GIFTS = [0, 250, 500, 1000, 2500];
  var AGREE = [
    ['Leave no trace.', 'We take everything home, down to the last screw.'],
    ['Consent.', 'We ask first, every time.'],
    ['Radical inclusion.', 'Anyone who wants to build the temple is welcome.'],
    ['The kitchen.', 'We cook, clean and carry together. Nobody is a guest.'],
    ['The full agreements.', "I have read the Sacred Agreements and AfrikaBurn's guiding principles below, and I sign them as my own."],
  ];
  var SACRED = [['S', 'Seeking understanding before interpretation'], ['A', 'Assuming good intent'], ['C', 'Choosing presence over reaction'],
    ['R', 'Radical responsibility for what we feel'], ['E', 'Empowered expression of our needs'], ['D', 'Discernment of gossip as distortion']];
  var PRINCIPLES = ['Radical inclusion', 'Gifting', 'Decommodification', 'Radical self-reliance', 'Radical self-expression', 'Communal effort',
    'Civic responsibility', 'Leave no trace', 'Participation', 'Immediacy', 'Each one teach one'];
  var TIMES = ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends'];

  var A = { name: '', email: '', whatsapp: '', lives: '', from: '', skills: [], bigCoil: false, gift: 0, payIn: 1, coupon: '', agreed: [], times: [], message: '', nominatedBy: '' };
  try { var q = new URLSearchParams(location.search); if (q.get('name')) A.name = q.get('name').slice(0, 40); if (q.get('by')) A.nominatedBy = q.get('by').slice(0, 60); } catch (e) { }
  var step = 1, box = $('join'), body = $('joinBody'), stepEl = $('joinStep');

  function fee() { return FEE[A.lives === 'away' ? 'away' : 'sa']; }
  function money(n) { return fee().sym + nb(n); }
  function lines() {
    var f = fee(), L = [['A place at Mahala camp', f.place]];
    if (A.bigCoil) L.push(['The big coil', f.coil]);
    if (A.gift) L.push(['A gift to the art piece', A.gift]);
    return L;
  }
  function total() { return lines().reduce(function (s, l) { return s + l[1]; }, 0); }
  function crew() { var s = SKILLS.filter(function (k) { return k[0] === A.skills[0]; })[0]; return s ? s[1] : ''; }

  function field(id, label, input, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + input + '</div>'; }
  function chips(name, items, chosen, multi) {
    return '<div class="opts chips-pick" role="group">' + items.map(function (it) {
      var v = Array.isArray(it) ? it[0] : it, l = Array.isArray(it) ? it[1] : it, on = multi ? chosen.indexOf(v) >= 0 : chosen === v;
      return '<button type="button" class="pick' + (on ? ' on' : '') + '" data-pick="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
  }

  var STEPS = {
    1: function () {
      return '<h2 class="h-sub">Who you are</h2>' +
        field('jName', 'Your name or playa name', '<input type="text" id="jName" maxlength="40" autocomplete="name" value="' + esc(A.name) + '">') +
        field('jEmail', 'Email', '<input type="email" id="jEmail" maxlength="80" autocomplete="email" inputmode="email" value="' + esc(A.email) + '" required>', 'So we can reply, and send your payment link and receipts.') +
        field('jWa', 'WhatsApp number <small>(optional)</small>', '<input type="tel" id="jWa" maxlength="30" autocomplete="tel" value="' + esc(A.whatsapp) + '">', 'For reminders.') +
        '<fieldset class="field"><legend class="flabel">Where do you live?</legend>' + chips('lives', [['sa', 'South Africa'], ['away', 'Outside South Africa']], A.lives, false) +
        '<p class="hint">Your place is priced by where you travel from.</p></fieldset>' +
        field('jFrom', 'Where you will travel from <small>(city and country, optional)</small>', '<input type="text" id="jFrom" maxlength="60" value="' + esc(A.from) + '">', 'For lifts and logistics.') +
        '<fieldset class="field"><legend class="flabel">What can you bring? <small>As many as you like.</small></legend>' + chips('skills', SKILLS.map(function (s) { return s[0]; }), A.skills, true) + '</fieldset>' +
        '<p class="note">Camp membership is all in: build week, the burn and the strike. Setup arrival is Thursday 22 or Friday 23 April 2027 (to confirm); pack down ends Monday 3 May.</p>' +
        '<p class="small">Only camp leads can read your contact details.</p>';
    },
    2: function () {
      var f = fee(), L = lines(), t = total(), per = A.payIn > 1 ? Math.ceil(t / A.payIn) : t;
      return '<h2 class="h-sub">Your place at the camp</h2>' +
        '<div class="fee"><b>' + money(f.place) + '</b><span>working figure</span></div>' +
        '<p class="centre small">A place in Mahala camp, the kitchen, the Lotus Mahal, the fire, and your coil.</p>' +
        '<div class="coil"><img src="camp-media/icons/wait-coil.png" width="256" height="256" alt="" loading="lazy"><p>Every camp member wears one: a yantra, a small piece of the temple that carries its pattern. A torus, eight times round and seven times through. It magnifies what we build together, and keeps you in the field wherever you are.</p></div>' +
        '<label class="opt tick"><input type="checkbox" id="jCoil"' + (A.bigCoil ? ' checked' : '') + '><span><b>Add the big coil</b> (' + money(f.coil) + '): about 40 cm across, wound by hand.</span></label>' +
        '<fieldset class="field"><legend class="flabel">An extra gift to the art piece <small>(optional)</small></legend>' + chips('gift', GIFTS.map(function (g) { return [String(g), g ? money(g) : 'None']; }), String(A.gift), false) + '</fieldset>' +
        '<fieldset class="field"><legend class="flabel">Pay in</legend>' + chips('payIn', [['1', 'One payment'], ['2', '2 instalments'], ['4', '4 instalments']], String(A.payIn), false) + '</fieldset>' +
        field('jCoupon', 'Coupon code, if you were given one <small>(optional)</small>', '<input type="text" id="jCoupon" maxlength="30" value="' + esc(A.coupon) + '">') +
        '<div class="sum" aria-live="polite">' + L.map(function (l) { return '<div><span>' + l[0] + '</span><b>' + money(l[1]) + '</b></div>'; }).join('') +
        '<div class="tot"><span>Total</span><b>' + money(t) + '</b></div>' +
        (A.payIn > 1 ? '<div class="per"><span>First payment, then ' + (A.payIn - 1) + ' more</span><b>' + money(per) + '</b></div>' : '') +
        (A.coupon ? '<div class="per"><span>Coupon ' + esc(A.coupon) + '</span><b>applied with your payment link</b></div>' : '') + '</div>' +
        '<p class="small">Working amounts, not final. Nothing is paid here: once a camp lead has confirmed your place, we send you a secure payment link.</p>';
    },
    3: function () {
      return '<h2 class="h-sub">The Sacred Agreements</h2>' +
        '<p class="small centre">Before anything else, the agreements. The short form to tick; the full agreements to open below.</p>' +
        AGREE.map(function (a, i) { return '<label class="opt tick"><input type="checkbox" data-agree="' + i + '"' + (A.agreed.indexOf(i) >= 0 ? ' checked' : '') + '><span><b>' + a[0] + '</b> ' + a[1] + '</span></label>'; }).join('') +
        '<details class="more"><summary>The Sacred Agreements</summary><ol class="sacred">' + SACRED.map(function (s) { return '<li><b>' + s[0] + '</b><span>' + s[1] + '</span></li>'; }).join('') + '</ol></details>' +
        '<details class="more"><summary>AfrikaBurn\'s guiding principles</summary><ul class="bring">' + PRINCIPLES.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul><p class="small centre">Read them in full on afrikaburn.org.</p></details>';
    },
    4: function () {
      return '<h2 class="h-sub">Your welcome call</h2>' +
        '<p class="small centre">A short call with one of the camp leads: to welcome you properly, answer your questions and find the crew where your hands are needed. Twenty minutes, by video or phone.</p>' +
        '<fieldset class="field"><legend class="flabel">When suits you best? <small>As many as you like.</small></legend>' + chips('times', TIMES, A.times, true) + '</fieldset>' +
        field('jMsg', 'Anything else you would like us to know <small>(optional)</small>', '<textarea id="jMsg" maxlength="1500">' + esc(A.message) + '</textarea>') +
        '<input type="text" id="jHp" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">';
    },
  };

  function canGo() {
    if (step === 1) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim()) && !!A.lives;
    if (step === 3) return A.agreed.length === AGREE.length;
    return true;
  }
  function why() {
    if (step === 1) return !A.lives ? 'Tell us where you live to continue; your place is priced by where you travel from.' : 'Add your email address to continue.';
    if (step === 3) return 'Tick all five to continue.';
    return '';
  }
  function read() {
    var v = function (id) { var e = $(id); return e ? e.value : null; };
    if (step === 1) { A.name = (v('jName') || '').trim(); A.email = (v('jEmail') || '').trim(); A.whatsapp = (v('jWa') || '').trim(); A.from = (v('jFrom') || '').trim(); }
    if (step === 2) { A.bigCoil = !!($('jCoil') && $('jCoil').checked); A.coupon = (v('jCoupon') || '').trim(); }
    if (step === 4) { A.message = (v('jMsg') || '').trim(); }
  }
  function draw(focus) {
    stepEl.textContent = step <= 4 ? 'Step ' + step + ' of 4' : '';
    var last = step === 4;
    body.innerHTML = STEPS[step]() +
      '<p class="err" id="jErr" role="alert"></p>' +
      '<div class="page-acts join-acts">' +
      '<button class="primary" type="button" id="jGo"' + (canGo() ? '' : ' aria-disabled="true"') + '>' + (last ? 'Send my application' : 'Continue') + '</button>' +
      '<button class="secondary" type="button" id="jBack">' + (step === 1 ? 'Close' : 'Back') + '</button></div>';
    if (!canGo()) $('jErr').textContent = '';
    box.scrollTop = 0;
    if (focus) { var h = body.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }
  function refreshGo() { var g = $('jGo'); if (!g) return; if (canGo()) { g.removeAttribute('aria-disabled'); $('jErr').textContent = ''; } else g.setAttribute('aria-disabled', 'true'); }

  body.addEventListener('input', function (e) {
    read();
    if (step === 2 && (e.target.id === 'jCoupon')) return;          // the summary is redrawn when the coupon box is left
    refreshGo();
  });
  body.addEventListener('change', function (e) {
    if (e.target.id === 'jCoil' || e.target.id === 'jCoupon') { read(); var y = box.scrollTop; draw(false); box.scrollTop = y; }
    if (e.target.dataset.agree != null) { var i = +e.target.dataset.agree; A.agreed = A.agreed.filter(function (x) { return x !== i; }); if (e.target.checked) A.agreed.push(i); refreshGo(); }
  });
  body.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]');
    if (p) {
      read();
      var k = p.dataset.pick, v = p.dataset.v;
      if (k === 'skills' || k === 'times') { var arr = A[k], at = arr.indexOf(v); if (at >= 0) arr.splice(at, 1); else arr.push(v); }
      else if (k === 'lives') A.lives = v;
      else if (k === 'gift') A.gift = +v;
      else if (k === 'payIn') A.payIn = +v;
      var y = box.scrollTop; draw(false); box.scrollTop = y;
      var again = body.querySelector('[data-pick="' + k + '"][data-v="' + v.replace(/"/g, '\\"') + '"]'); if (again) again.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('#jBack')) { read(); if (step === 1) closeJoin(); else { step--; draw(true); } return; }
    if (e.target.closest('#jGo')) {
      read();
      if (!canGo()) { $('jErr').textContent = why(); return; }
      if (step < 4) { step++; draw(true); return; }
      send();
    }
  });

  function send() {
    var g = $('jGo'); g.setAttribute('aria-disabled', 'true'); g.textContent = 'Sending';
    var f = fee(), row = {
      path: 'camp', id: 'M' + Date.now().toString(36).toUpperCase(), name: A.name, email: A.email, whatsapp: A.whatsapp, livesIn: A.lives === 'away' ? 'Outside South Africa' : 'South Africa', travelFrom: A.from,
      skills: A.skills, crew: crew(), currency: f.cur, place: money(f.place), bigCoil: A.bigCoil, gift: A.gift ? money(A.gift) : 'None',
      payIn: A.payIn === 1 ? 'One payment' : A.payIn + ' instalments', total: money(total()), coupon: A.coupon,
      agreements: A.agreed.slice().sort().map(function (i) { return AGREE[i][0].replace(/\.$/, ''); }), callTimes: A.times, message: A.message,
      nominatedBy: A.nominatedBy, hp: ($('jHp') && $('jHp').value) || ''
    };
    (SITE.post ? SITE.post(row) : Promise.reject(new Error('no sheet'))).then(function () {
      toRecord(row);
      step = 5;
      stepEl.textContent = '';
      var who = (A.name || '').split(/\s+/)[0];
      body.innerHTML = '<div class="join-done" tabindex="-1"><h2 class="h-sub">Thank you' + (who ? ', ' + esc(who) : '') + '. Your application is with the camp leads.</h2>' +
        '<ol class="next">' +
        '<li><span><b>We read it, and write to you.</b> A camp lead will be in touch by email' + (A.whatsapp ? ' or WhatsApp' : '') + ' to book your welcome call.</span></li>' +
        '<li><span><b>The welcome call.</b> Twenty minutes to meet, answer your questions and find your crew' + (crew() ? ' (perhaps the ' + esc(crew()) + ')' : '') + '.</span></li>' +
        '<li><span><b>Your payment link.</b> Once your place is confirmed: ' + (A.payIn === 1 ? 'one payment' : A.payIn + ' instalments') + ', with a receipt by email.</span></li>' +
        '<li><span><b>Onboarding.</b> Dietary needs, an emergency contact, your tent and travel, and your AfrikaBurn ticket.</span></li></ol>' +
        '<div class="page-acts"><button class="primary" type="button" id="jDone">Close</button></div></div>';
      body.querySelector('.join-done').focus({ preventScroll: true });
      $('jDone').addEventListener('click', closeJoin);
    }).catch(function () {
      $('jErr').textContent = 'That did not go through. Please check your connection and try again.';
      g.removeAttribute('aria-disabled'); g.textContent = 'Send my application';
    });
  }

  // Signed in: the application also joins the person's thread in the member record. The sheet keeps the contact
  // details and the fee choices; the record never holds either (Mahala OS platform/docs/ARCHITECTURE.md).
  function toRecord(row) {
    var M = window.MahalaMembers; if (!M) return;
    var keep = ['id', 'name', 'livesIn', 'travelFrom', 'skills', 'crew', 'bigCoil', 'agreements', 'callTimes', 'message', 'nominatedBy'];
    M.info().then(function (i) {
      if (!i.signedIn) return;
      var a = {}; keep.forEach(function (k) { if (row[k] !== undefined && row[k] !== '' && row[k] !== null) a[k] = row[k]; });
      return M.rpc('submit_application', { p_answers: a });
    }).catch(function () { /* the sheet has it; the record can catch up */ });
  }

  var opener = null;
  function openJoin(from) {
    opener = from || document.activeElement;
    if (step === 5) { step = 1; }
    box.hidden = false; document.documentElement.classList.add('join-open');
    requestAnimationFrame(function () { box.classList.add('open'); });
    draw(true);
  }
  // opened straight onto the application from inside the Mahalaverse: closing it hands you back to the world
  var direct = /^#(join|apply)$/i.test(location.hash);
  function closeJoin() {
    if (direct && window.parent !== window) { try { if (window.parent.location.origin === location.origin) { window.parent.postMessage({ mahala: 'close' }, location.origin); return; } } catch (e) { /* not ours */ } }
    box.classList.remove('open'); document.documentElement.classList.remove('join-open');
    setTimeout(function () { box.hidden = true; }, 250);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  $('joinClose').addEventListener('click', closeJoin);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) { e.stopImmediatePropagation(); closeJoin(); } }, true);
  document.querySelectorAll('[data-join]').forEach(function (b) { b.addEventListener('click', function () { openJoin(b); }); });
  if (/^#(join|apply)$/i.test(location.hash)) openJoin();
  window.__join = { open: openJoin, state: function () { return { step: step, A: A }; } };
})();
