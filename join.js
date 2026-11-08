// Join the camp: the application, in five steps, on the camp page, for people holding an invitation letter. The answers go
// to the camp's Google Sheet (its Applications tab) through site.js; signed in, they also join the person's thread.
// The last step is the first payment (Chris's review, 8 Nov 2026, F-046 to F-058): by bank transfer (the camp's details
// come from the member database, only for invited people and applicants, never from this public repo) or by card on
// BackaBuddy, then a picture of the proof, or a rough date for paying later. Prices come from FEE below and site.js.
(function () {
  var SITE = window.MAHALA_SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nb = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };

  var SKILLS = [['Build', 'Frame crew'], ['Fabricate', 'Temple Tech crew'], ['Light', 'Light crew'], ['Cook', 'Camp crew'], ['Art', 'Petal crew'],
    ['Story', 'Story crew'], ['Care', 'Camp crew'], ['Host an event', 'Story crew'], ['Sound', 'Story crew'], ['Money and admin', 'Camp crew']];
  // A place and the big coil: in rand in South Africa; in dollars abroad, shown in rand at site.js's rate with the dollars in brackets
  var FEE = { sa: { cur: 'ZAR', place: 7500, coil: 9000 }, away: { cur: 'USD', place: 1000, coil: 500 } };
  var GIFTS = [0, 250, 500, 1000, 2500];
  var DUE = { 1: 'One payment, as soon as you can.', 2: 'Due in November and January.', 4: 'Due in November, December, January and February.' };
  var SPOTS = 50;
  var CALL_URL = 'https://calendar.app.google/MCznbwH6nnkgvK4H6';
  var CAMP_CALL = 'Sunday 16 November at 6pm';                      // the first camp wide call (Chris, 8 Nov 2026)
  var LAST_DAY = '2027-02-28';                                      // everyone has paid in full by February
  var AGREE = [
    ['Leave no trace.', 'We take everything home, down to the last screw.'],
    ['Consent.', 'We ask first, every time.'],
    ['Radical inclusion.', 'Anyone who wants to build the temple is welcome.'],
    ['The kitchen.', 'We cook, clean and carry together. Nobody is a guest.'],
    ['The full agreements.', "I have read the Sacred Agreements and AfrikaBurn's guiding principles above, and I sign them as my own."],
  ];
  var SACRED = [['S', 'Seeking understanding before interpretation'], ['A', 'Assuming good intent'], ['C', 'Choosing presence over reaction'],
    ['R', 'Radical responsibility for what we feel'], ['E', 'Empowered expression of our needs'], ['D', 'Discernment of gossip as distortion']];
  var PRINCIPLES = ['Radical inclusion', 'Gifting', 'Decommodification', 'Radical self-reliance', 'Radical self-expression', 'Communal effort',
    'Civic responsibility', 'Leave no trace', 'Participation', 'Immediacy', 'Each one teach one'];
  var ARROW = '<svg viewBox="0 0 16 22" aria-hidden="true"><path d="M8 1v19M2 14l6 6 6-6"/></svg>';

  var A = { name: '', email: '', whatsapp: '', waFrom: '', based: '', city: '', skills: [], bigCoil: false, gift: 0, payIn: 1, coupon: '', agreed: [],
    message: '', nominatedBy: '', booked: false, when: '', date: '', proof: '', proofUrl: '' };
  try { var q = new URLSearchParams(location.search); if (q.get('name')) A.name = q.get('name').slice(0, 40); if (q.get('by')) A.nominatedBy = q.get('by').slice(0, 60); } catch (e) { }
  var LAST = 5, step = 1, payOnly = false, box = $('join'), body = $('joinBody'), stepEl = $('joinStep');
  // the payment step's view of the account: signed in, the game id (the folder for the proof), the camp's banking details
  var PAY = { signedIn: false, uid: null, details: undefined, uploading: false, msg: '' };

  function fee() { return FEE[A.based === 'away' ? 'away' : 'sa']; }
  function rate() { return (SITE.fx && +SITE.fx.usdZar) || 0; }
  function abroad() { return fee().cur !== 'ZAR' && rate() > 0; }
  // an amount in the fee's own currency, as the page shows it: "R 7 500", or "R 16 700 ($1 000)" abroad
  function money(n) { var f = fee(); if (f.cur === 'ZAR') return 'R ' + nb(n); return rate() ? 'R ' + nb(n * rate()) + ' ($' + nb(n) + ')' : '$' + nb(n); }
  function rand(n) { return fee().cur === 'ZAR' ? 'R ' + nb(n) : rate() ? 'R ' + nb(n * rate()) : '$' + nb(n); }
  function lines() {
    var f = fee(), L = [['A place at Mahala camp', f.place]];
    if (A.bigCoil) L.push(['The big coil', f.coil]);
    if (A.gift) L.push(['A gift to the art piece', A.gift]);
    return L;
  }
  function total() { return lines().reduce(function (s, l) { return s + l[1]; }, 0); }
  function firstPay() { return Math.ceil(total() / A.payIn); }
  function crew() { var s = SKILLS.filter(function (k) { return k[0] === A.skills[0]; })[0]; return s ? s[1] : ''; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function longDate(iso) { try { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' }); } catch (e) { return iso; } }
  function waOk() { return A.whatsapp.replace(/\D/g, '').length >= 8; }

  function field(id, label, input, hint) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + input + '</div>'; }
  function chips(name, items, chosen, multi) {
    return '<div class="opts chips-pick" role="group">' + items.map(function (it) {
      var v = Array.isArray(it) ? it[0] : it, l = Array.isArray(it) ? it[1] : it, on = multi ? chosen.indexOf(v) >= 0 : chosen === v;
      return '<button type="button" class="pick' + (on ? ' on' : '') + '" data-pick="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(l) + '</button>';
    }).join('') + '</div>';
  }
  function feeBig(n) { return '<div class="fee"><b>' + rand(n) + '</b>' + (abroad() ? '<span class="usd">($' + nb(n) + ')</span>' : '') + '</div>'; }

  // the camp's banking details: a list of [label, value] pairs (or an object), from camp_payment_details()
  function bank() {
    var M = window.MahalaMembers;
    if (!PAY.signedIn) return M ? '<p>The banking details show once you are signed in.</p><button class="secondary" type="button" data-signin>Sign in</button><p class="small">Or write to love@wearemahala.com and we send them to you.</p>'
      : '<p>Write to love@wearemahala.com and we send you the banking details.</p>';
    if (PAY.details === undefined) return '<p class="small">Fetching the details.</p>';
    var d = PAY.details, rows = Array.isArray(d) ? d : d && typeof d === 'object' ? Object.keys(d).map(function (k) { return [k, d[k]]; }) : [];
    rows = rows.filter(function (r) { return Array.isArray(r) && r.length === 2; });
    if (!rows.length) return '<p>The banking details are not on this page yet. Write to love@wearemahala.com and we send them to you.</p>';
    return '<dl class="bank">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
  }
  function proofBox() {
    if (!PAY.signedIn) return '<p class="note">Send a screenshot of your payment to love@wearemahala.com, with your name.</p>';
    return '<div class="field"><span class="flabel">Your proof of payment</span><p class="hint">A screenshot of the transfer or the BackaBuddy receipt. Only the stewards see it.</p>' +
      (A.proof ? '<div class="proof-ok"><img src="' + esc(A.proofUrl) + '" alt="Your proof of payment"><span>Uploaded.</span></div>' : '') +
      '<label class="upload"><input type="file" id="jProof" accept="image/*"><span>' + (PAY.uploading ? 'Uploading' : A.proof ? 'Choose another picture' : 'Choose a picture') + '</span></label>' +
      '<p class="msg" id="jProofMsg" role="status">' + esc(PAY.msg) + '</p></div>';
  }

  var STEPS = {
    1: function () {
      return '<h2 class="h-sub">Who you are</h2>' +
        field('jName', 'Your name or playa name', '<input type="text" id="jName" maxlength="40" autocomplete="name" value="' + esc(A.name) + '">') +
        field('jEmail', 'Email', '<input type="email" id="jEmail" maxlength="80" autocomplete="email" inputmode="email" value="' + esc(A.email) + '" required>', 'So we can reply, and send your receipts.') +
        field('jWa', 'WhatsApp number', '<input type="tel" id="jWa" maxlength="30" autocomplete="tel" placeholder="+27 …" value="' + esc(A.whatsapp) + '" required>',
          A.waFrom ? 'From your profile. Change it if it has moved.' : 'With the country code, for the camp group. Only the camp leads see it.') +
        '<fieldset class="field"><legend class="flabel">Where are you based?</legend>' + chips('based', [['sa', 'South Africa'], ['away', 'International']], A.based, false) + '</fieldset>' +
        (A.based ? field('jCity', 'Which city?', '<input type="text" id="jCity" maxlength="60" autocomplete="address-level2" value="' + esc(A.city) + '">') : '') +
        '<fieldset class="field"><legend class="flabel">What can you bring? <small>As many as you like.</small></legend>' + chips('skills', SKILLS.map(function (s) { return s[0]; }), A.skills, true) + '</fieldset>';
    },
    2: function () {
      var f = fee(), L = lines(), t = total();
      return '<h2 class="h-sub">Your place at the camp</h2>' + feeBig(f.place) +
        '<p class="centre small">A place in Mahala camp, the kitchen, the Lotus Mahal, the fire, and your coil necklace.</p>' +
        '<div class="coil"><img src="camp-media/icons/wait-coil.png" width="256" height="256" alt="" loading="lazy"><p><b>Your coil necklace.</b> Every camp member wears one around the neck: a yantra, a small piece of the temple that carries its pattern. A torus, eight times round and seven times through. It magnifies what we build together, and keeps you in the field wherever you are.</p></div>' +
        '<label class="opt tick"><input type="checkbox" id="jCoil"' + (A.bigCoil ? ' checked' : '') + '><span><b>Add the big coil</b>, ' + money(f.coil) + ': about 40 cm across, wound by hand.</span></label>' +
        '<fieldset class="field"><legend class="flabel">An extra gift to the art piece <small>(optional)</small></legend>' + chips('gift', GIFTS.map(function (g) { return [String(g), g ? money(g) : 'None']; }), String(A.gift), false) + '</fieldset>' +
        '<fieldset class="field"><legend class="flabel">Pay in</legend>' + chips('payIn', [['1', 'One payment'], ['2', '2 instalments'], ['4', '4 instalments']], String(A.payIn), false) + '</fieldset>' +
        field('jCoupon', 'Coupon code, if you were given one <small>(optional)</small>', '<input type="text" id="jCoupon" maxlength="30" value="' + esc(A.coupon) + '">') +
        '<div class="sum" aria-live="polite">' + L.map(function (l) { return '<div><span>' + l[0] + '</span><b>' + money(l[1]) + '</b></div>'; }).join('') +
        '<div class="tot"><span>Total</span><b>' + money(t) + '</b></div>' +
        (A.payIn > 1 ? '<div class="per"><span>' + A.payIn + ' payments of</span><b>' + money(firstPay()) + '</b></div>' : '') +
        (A.coupon ? '<div class="per"><span>Coupon ' + esc(A.coupon) + '</span><b>noted with your application</b></div>' : '') + '</div>' +
        '<p class="small centre due">' + DUE[A.payIn] + ' Everyone has paid in full by February.</p>' +
        '<p class="note">Your spot is confirmed on your first payment. There are only ' + SPOTS + ' spots.</p>';
    },
    3: function () {
      return '<h2 class="h-sub">The Sacred Agreements</h2>' +
        '<p class="read-first">Read these first' + ARROW + '</p>' +
        '<ol class="sacred">' + SACRED.map(function (s) { return '<li><b>' + s[0] + '</b><span>' + s[1] + '</span></li>'; }).join('') + '</ol>' +
        '<h3 class="h-mini">AfrikaBurn\'s guiding principles</h3><ul class="chips princ">' + PRINCIPLES.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
        '<p class="small centre">Read them in full on afrikaburn.org.</p>' +
        '<p class="tick-lead">Then tick each one to sign it</p>' +
        AGREE.map(function (a, i) { return '<label class="opt tick"><input type="checkbox" data-agree="' + i + '"' + (A.agreed.indexOf(i) >= 0 ? ' checked' : '') + '><span><b>' + a[0] + '</b> ' + a[1] + '</span></label>'; }).join('');
    },
    4: function () {
      return '<h2 class="h-sub">Your welcome call</h2>' +
        '<p class="small centre">Twenty minutes to welcome you properly, answer your questions and find the crew where your hands are needed.</p>' +
        '<div class="call-book"><a class="primary" id="jBook" href="' + CALL_URL + '" target="_blank" rel="noopener" data-count="Book the welcome call" data-count-where="camp application">Book your welcome call</a>' +
        '<p class="small centre">The call is with Chris for now.</p></div>' +
        field('jMsg', 'Anything else you would like us to know <small>(optional)</small>', '<textarea id="jMsg" maxlength="1500">' + esc(A.message) + '</textarea>') +
        '<input type="text" id="jHp" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">';
    },
    5: function () {
      var known = !payOnly || hasChoices();
      return '<h2 class="h-sub">Your first payment</h2>' + (known ? feeBig(firstPay()) +
        '<p class="centre small">' + (A.payIn > 1 ? 'The first of ' + A.payIn + ' payments. ' : '') + 'It confirms your spot.</p>' : '<p class="centre small">Your first payment, as you chose in your application, confirms your spot.</p>') +
        '<div class="ways">' +
        '<section class="way"><h3>By bank transfer</h3>' + bank() + '</section>' +
        '<section class="way"><h3>By card, on BackaBuddy</h3><p>Pay into The Seed\'s campaign, and write your name in the message so we can match it.</p>' +
        '<a class="secondary" href="' + esc(SITE.donateUrl || 'https://www.backabuddy.co.za/campaign/the-seed') + '" target="_blank" rel="noopener" data-count="Donate" data-count-where="camp payment">Open BackaBuddy</a></section>' +
        '</div>' +
        '<fieldset class="field"><legend class="flabel">When will you pay?</legend>' + chips('when', [['now', 'I\'ll make my first payment now'], ['later', 'I\'ll make it later']], A.when, false) + '</fieldset>' +
        (A.when === 'now' ? proofBox() : '') +
        (A.when === 'later' ? field('jDate', 'Roughly when?', '<input type="date" id="jDate" min="' + today() + '" max="' + LAST_DAY + '" value="' + esc(A.date) + '">') : '') +
        '<p class="gentle">Last minute payments deeply hurt the camp, so please pay as soon as you can.</p>';
    },
  };

  function canGo() {
    if (step === 1) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim()) && waOk() && !!A.based && !!A.city.trim();
    if (step === 3) return A.agreed.length === AGREE.length;
    if (step === 5) return !PAY.uploading && (A.when === 'later' ? !!A.date : A.when === 'now' ? (!PAY.signedIn || !!A.proof) : false);
    return true;
  }
  function why() {
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim())) return 'Add your email address to continue.';
      if (!waOk()) return 'Add your WhatsApp number, with the country code.';
      if (!A.based) return 'Tell us where you are based to continue.';
      return 'Tell us which city you are based in.';
    }
    if (step === 3) return 'Tick all five to continue.';
    if (step === 5) {
      if (PAY.uploading) return 'Your picture is still uploading.';
      if (!A.when) return 'Choose when you will make your first payment.';
      return A.when === 'later' ? 'Give a rough date for your first payment.' : 'Add a picture of your proof of payment.';
    }
    return '';
  }
  // the message sits by the buttons; the thing still missing may be a screen above it, so take the person there
  function missing() {
    var el = null;
    if (step === 1) el = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(A.email.trim()) ? $('jEmail') : !waOk() ? $('jWa') : !A.based ? body.querySelector('[data-pick="based"]') : $('jCity');
    if (step === 3) el = body.querySelector('[data-agree]:not(:checked)');
    if (step === 5) el = !A.when ? body.querySelector('[data-pick="when"]') : A.when === 'later' ? $('jDate') : $('jProof');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }
  function read() {
    var v = function (id) { var e = $(id); return e ? e.value : null; };
    if (step === 1) { A.name = (v('jName') || '').trim(); A.email = (v('jEmail') || '').trim(); A.whatsapp = (v('jWa') || '').trim(); if ($('jCity')) A.city = v('jCity').trim(); }
    if (step === 2) { A.bigCoil = !!($('jCoil') && $('jCoil').checked); A.coupon = (v('jCoupon') || '').trim(); }
    if (step === 4) { A.message = (v('jMsg') || '').trim(); }
    if (step === 5 && $('jDate')) A.date = v('jDate') || '';
  }
  function draw(focus) {
    stepEl.textContent = payOnly || step > LAST ? '' : 'Step ' + step + ' of ' + LAST;
    var last = step === LAST;
    body.innerHTML = STEPS[step]() +
      '<p class="err" id="jErr" role="alert"></p>' +
      '<div class="page-acts join-acts">' +
      '<button class="primary" type="button" id="jGo"' + (canGo() ? '' : ' aria-disabled="true"') + '>' + (payOnly ? 'Confirm' : last ? 'Send my application' : 'Continue') + '</button>' +
      '<button class="secondary" type="button" id="jBack">' + (step === 1 || payOnly ? 'Close' : 'Back') + '</button></div>';
    box.scrollTop = 0;
    if (focus) { var h = body.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  }
  function redraw() { var y = box.scrollTop; draw(false); box.scrollTop = y; }
  function refreshGo() { var g = $('jGo'); if (!g) return; if (canGo()) { g.removeAttribute('aria-disabled'); $('jErr').textContent = ''; } else g.setAttribute('aria-disabled', 'true'); }

  body.addEventListener('input', function (e) {
    read();
    if (step === 2 && (e.target.id === 'jCoupon')) return;          // the summary is redrawn when the coupon box is left
    refreshGo();
  });
  body.addEventListener('change', function (e) {
    if (e.target.id === 'jCoil' || e.target.id === 'jCoupon') { read(); redraw(); }
    if (e.target.id === 'jProof' && e.target.files && e.target.files[0]) uploadProof(e.target.files[0]);
    if (e.target.id === 'jDate') { read(); refreshGo(); }
    if (e.target.dataset.agree != null) { var i = +e.target.dataset.agree; A.agreed = A.agreed.filter(function (x) { return x !== i; }); if (e.target.checked) A.agreed.push(i); refreshGo(); }
  });
  body.addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]');
    if (p) {
      read();
      var k = p.dataset.pick, v = p.dataset.v;
      if (k === 'skills') { var at = A.skills.indexOf(v); if (at >= 0) A.skills.splice(at, 1); else A.skills.push(v); }
      else if (k === 'based') A.based = v;
      else if (k === 'gift') A.gift = +v;
      else if (k === 'payIn') A.payIn = +v;
      else if (k === 'when') { A.when = v; if (v === 'now') A.date = ''; }
      redraw();
      var again = body.querySelector('[data-pick="' + k + '"][data-v="' + v.replace(/"/g, '\\"') + '"]'); if (again) again.focus({ preventScroll: true });
      if (k === 'based' && $('jCity') && !A.city) $('jCity').focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('#jBook')) { A.booked = true; return; }
    if (e.target.closest('[data-signin]')) { saveDraft(); try { sessionStorage.setItem('mahala.openJoin', '1'); } catch (er) { } window.MahalaMembers.signIn('Sign in to see the camp\'s banking details. Your application stays as you left it.'); return; }
    if (e.target.closest('#jBack')) { read(); if (step === 1 || payOnly) closeJoin(); else { step--; draw(true); } return; }
    if (e.target.closest('#jGo')) {
      read();
      if (!canGo()) { $('jErr').textContent = why(); missing(); return; }
      if (step < LAST) { step++; if (step === LAST) loadPay(); draw(true); return; }
      if (payOnly) payNow(); else send();
    }
  });

  /* ------------------------------------------------------------------ the payment step */
  function loadPay() {
    var M = window.MahalaMembers; if (!M || !M.info) { PAY.signedIn = false; return; }
    M.info().then(function (i) {
      PAY.signedIn = !!(i && i.signedIn); PAY.uid = i && i.uid;
      if (!PAY.signedIn) { if (step === LAST) redraw(); return null; }
      if (step === LAST) redraw();
      return M.rpc('camp_payment_details').then(function (d) { PAY.details = d || null; }, function () { PAY.details = null; })
        .then(function () { if (step === LAST && !box.hidden) redraw(); });
    }).catch(function () { });
  }
  // the sign-in this page already holds (the shim keeps it fresh), for the one upload the page makes itself
  function token() {
    var raw = null; try { raw = sessionStorage.getItem('mahala-auth') || localStorage.getItem('mahala-auth'); } catch (e) { }
    try { var s = JSON.parse(raw || 'null'); return (s && (s.access_token || (s.currentSession && s.currentSession.access_token))) || null; } catch (e) { return null; }
  }
  function rid(n) {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', out = '', b = new Uint8Array(n);
    crypto.getRandomValues(b); for (var i = 0; i < n; i++) out += abc[b[i] % abc.length];
    return out;
  }
  // a screenshot made smaller (at most 1600 px on its long side, JPEG) on this device before it goes anywhere
  function shrink(file) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type || '')) return fail(new Error('Choose a picture: a screenshot or a photo.'));
      if (file.size > 25 * 1024 * 1024) return fail(new Error('That picture is very large. Try a smaller one.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) ok(b); else fail(new Error('That picture could not be read.')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('That picture could not be read. Try a JPEG or PNG.')); };
      img.src = url;
    });
  }
  // into the person's own folder in the private bucket, as pay-<random>.jpg (only they and the stewards can read it)
  function uploadProof(file) {
    var cfg = SITE.members || {};
    PAY.uploading = true; PAY.msg = ''; redraw();
    shrink(file).then(function (blob) {
      var tok = token(), name = 'pay-' + rid(24) + '.jpg';
      if (!tok || !PAY.uid || !cfg.url) throw new Error('Sign in again, then add the picture.');
      return fetch(cfg.url.replace(/\/$/, '') + '/storage/v1/object/mv-assets/' + PAY.uid + '/' + name, {
        method: 'POST', headers: { Authorization: 'Bearer ' + tok, apikey: cfg.anonKey, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: blob
      }).then(function (r) {
        if (!r.ok) throw new Error('That did not upload. Please try again.');
        if (A.proofUrl) URL.revokeObjectURL(A.proofUrl);
        A.proof = name; A.proofUrl = URL.createObjectURL(blob);
      });
    }).catch(function (er) { PAY.msg = (er && er.message) || 'That did not upload. Please try again.'; })
      .then(function () { PAY.uploading = false; redraw(); });
  }
  function noteIntent() {
    var M = window.MahalaMembers;
    if (!M || !PAY.signedIn || !A.when) return Promise.resolve(null);
    return M.rpc('camp_payment_intent', { p_when: A.when, p_date: A.when === 'later' ? A.date : null, p_proof: A.proof || null })
      .then(function () { return true; }, function () { return false; });
  }
  // a later payer comes back: the payment step on its own, from the camp page
  function hasChoices() { return !!A.based; }
  function payNow() {
    var g = $('jGo'); g.setAttribute('aria-disabled', 'true'); g.textContent = 'Saving';
    noteIntent().then(function (ok) {
      if (ok === false) { $('jErr').textContent = 'That did not save. Please check your connection and try again.'; g.removeAttribute('aria-disabled'); g.textContent = 'Confirm'; return; }
      done(ok);
    });
  }

  /* ------------------------------------------------------------------ sending */
  function payLine() {
    var plan = A.payIn === 1 ? 'One payment' : A.payIn + ' instalments (' + DUE[A.payIn].replace(/^Due in |\.$/g, '') + ')';
    return plan + '. First payment: ' + (A.when === 'now' ? 'now' + (A.proof ? ', proof uploaded' : ', proof to come by email') : 'later, around ' + A.date);
  }
  function send() {
    var g = $('jGo'); g.setAttribute('aria-disabled', 'true'); g.textContent = 'Sending';
    var row = {
      path: 'camp', id: 'M' + Date.now().toString(36).toUpperCase(), name: A.name, email: A.email, whatsapp: A.whatsapp,
      livesIn: A.based === 'away' ? 'International' : 'South Africa', travelFrom: A.city,
      skills: A.skills, crew: crew(), currency: 'ZAR', place: money(fee().place), bigCoil: A.bigCoil, gift: A.gift ? money(A.gift) : 'None',
      payIn: payLine(), total: money(total()), coupon: A.coupon,
      agreements: A.agreed.slice().sort().map(function (i) { return AGREE[i][0].replace(/\.$/, ''); }),
      callTimes: [A.booked ? 'Opened the booking link' : 'Not booked yet'], message: A.message,
      nominatedBy: A.nominatedBy, hp: ($('jHp') && $('jHp').value) || ''
    };
    (SITE.post ? SITE.post(row) : Promise.reject(new Error('no sheet'))).then(function () {
      try { localStorage.setItem('mahala.applied', JSON.stringify({ at: Date.now(), based: A.based, bigCoil: A.bigCoil, gift: A.gift, payIn: A.payIn })); } catch (e) { /* storage blocked */ }
      return toRecord(row);
    }).then(function (noted) {
      done(noted);
      showApplied();
    }).catch(function () {
      $('jErr').textContent = 'That did not go through. Please check your connection and try again.';
      g.removeAttribute('aria-disabled'); g.textContent = 'Send my application';
    });
  }
  // the next steps (F-058): the call, the payment, the first camp wide call
  function done(noted) {
    step = LAST + 1; stepEl.textContent = '';
    var who = (A.name || '').split(/\s+/)[0], M = window.MahalaMembers, me = PAY.signedIn && M && M.mePage;
    var book = '<a class="linkish" href="' + CALL_URL + '" target="_blank" rel="noopener">';
    var call = A.booked ? '<li><span><b>Your welcome call is booked</b> with Chris. If the calendar did not keep it, ' + book + 'book it here</a>.</span></li>'
      : '<li><span><b>Book your welcome call</b> with Chris: ' + book + 'choose a time</a>.</span></li>';
    var pay = noted === false ? '<li><span><b>Your payment choice did not save.</b> Write to love@wearemahala.com and tell us, and we note it for you.</span></li>'
      : A.when === 'now' ? '<li><span><b>Your payment is noted.</b> ' + (A.proof ? 'Your proof is with the stewards.' : 'Send a screenshot of it to love@wearemahala.com, with your name.') + '</span></li>'
      : '<li><span><b>Your first payment is noted for around ' + esc(longDate(A.date)) + '.</b> Your spot is confirmed when it comes in.</span></li>';
    body.innerHTML = '<div class="join-done" tabindex="-1"><h2 class="h-sub">Thank you' + (who ? ', ' + esc(who) : '') + '. ' + (payOnly ? 'Your payment is noted.' : 'Your application is with the camp leads.') + '</h2>' +
      '<ol class="next">' + (payOnly ? '' : call) + pay +
      '<li><span><b>The first camp wide call</b> is ' + CAMP_CALL + '.</span></li></ol>' +
      '<div class="page-acts">' + (me ? '<a class="primary" href="' + esc(M.mePage) + '">Open Your Mahala</a><button class="secondary" type="button" id="jDone">Close</button>' : '<button class="primary" type="button" id="jDone">Close</button>') + '</div></div>';
    body.querySelector('.join-done').focus({ preventScroll: true });
    $('jDone').addEventListener('click', closeJoin);
    box.scrollTop = 0;
  }

  // Signed in: the application also joins the person's thread in the member record, then the payment choice is noted.
  // The sheet keeps the contact details and the fee choices; the record never holds either (Mahala OS
  // platform/docs/ARCHITECTURE.md), and never an amount.
  function toRecord(row) {
    var M = window.MahalaMembers; if (!M) return Promise.resolve(null);
    var keep = ['id', 'name', 'livesIn', 'travelFrom', 'skills', 'crew', 'bigCoil', 'agreements', 'callTimes', 'message', 'nominatedBy'];
    return M.info().then(function (i) {
      if (!i.signedIn) return null;
      var a = {}; keep.forEach(function (k) { if (row[k] !== undefined && row[k] !== '' && row[k] !== null) a[k] = row[k]; });
      return M.rpc('submit_application', { p_answers: a }).catch(function () { /* the sheet has it; the record can catch up */ }).then(noteIntent);
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------------ opening and closing */
  var opener = null, accountAsked = false;
  function saveDraft() { try { sessionStorage.setItem('mahala.campDraft', JSON.stringify({ A: Object.assign({}, A, { proof: '', proofUrl: '' }), step: step })); } catch (e) { } }
  function takeDraft() {
    var d = null; try { d = JSON.parse(sessionStorage.getItem('mahala.campDraft') || 'null'); sessionStorage.removeItem('mahala.campDraft'); } catch (e) { }
    if (d && d.A) { Object.assign(A, d.A); if (d.step >= 1 && d.step <= LAST) step = d.step; return true; }
    return false;
  }
  // Invited and not signed in: the account comes first, so the application joins your thread and Your Mahala can
  // guide you on from it (Mahala OS strategy/your-mahala-accounts-plan-2026-11-04.md). "Apply without an account"
  // stays possible: the sheet still has the application.
  function openJoin(from) {
    var M = window.MahalaMembers;
    if (M && !accountAsked && from !== 'after-sign-in') {
      accountAsked = true;
      M.info().then(function (i) {
        if (i && i.signedIn) return openJoin('after-sign-in');
        try { sessionStorage.setItem('mahala.openJoin', '1'); } catch (e) { /* storage blocked */ }
        M.signIn('Your invitation is waiting. Make your account first (it takes a moment), and your application opens right after.');
        setTimeout(addSkip, 60);
      }, function () { openJoin('after-sign-in'); });
      return;
    }
    opener = (from && from.nodeType ? from : null) || document.activeElement;
    payOnly = false;
    if (step > LAST) step = 1;
    takeDraft();
    prefillHere();
    show();
    if (step === LAST) loadPay();
    draw(true);
    prefill();
  }
  function show() {
    box.hidden = false; document.documentElement.classList.add('join-open');
    requestAnimationFrame(function () { box.classList.add('open'); });
  }
  function openPay(from) {
    opener = (from && from.nodeType ? from : null) || document.activeElement;
    var c = null; try { c = JSON.parse(localStorage.getItem('mahala.applied') || 'null'); } catch (e) { }
    if (c && c.based) { A.based = c.based; A.bigCoil = !!c.bigCoil; A.gift = +c.gift || 0; A.payIn = +c.payIn || 1; }
    payOnly = true; step = LAST; A.when = ''; A.date = ''; A.proof = '';
    show(); loadPay(); draw(true);
  }
  // What this device already holds fills the first step, so nobody types it twice: the WhatsApp number from Join the
  // tribe (it never goes to the member record, so it is only found on the device that sent it), where they are based
  // and what they bring. Only empty answers are filled, and anything typed wins.
  var TRIBE_TO_CAMP = { 'Building and carpentry': 'Build', 'Electrics, lighting and power': 'Light', 'Sound, DJing and music production': 'Sound',
    'Live instruments and voice': 'Sound', 'Art, painting and decor': 'Art', 'Kitchen and feeding the tribe': 'Cook', 'Healing, bodywork and breathwork': 'Care',
    'Ceremony and space holding': 'Host an event', 'Movement, dance and performance': 'Host an event', 'Logistics and getting things done': 'Money and admin' };
  function prefillHere() {
    var box0 = [], t = null;
    try { box0 = JSON.parse(localStorage.getItem('mahala.outbox') || '[]') || []; } catch (e) { /* storage blocked */ }
    try { t = JSON.parse(localStorage.getItem('mahala.tribeSkills') || localStorage.getItem('mahala.tribe') || 'null'); } catch (e) { /* storage blocked */ }
    var sent = box0.slice().reverse(), tribe = sent.filter(function (r) { return r && r.type === 'tribe'; })[0] || null;
    if (!A.whatsapp) { var w = sent.filter(function (r) { return r && r.whatsapp && (r.type !== 'tribe' || r.whatsappCommunity); })[0]; if (w) { A.whatsapp = String(w.whatsapp).slice(0, 30); A.waFrom = 'profile'; } }
    t = t || tribe;
    if (!t) return;
    if (!A.based && t.country) A.based = /south africa|^sa$|^rsa$|^za$/i.test(String(t.country).trim()) ? 'sa' : 'away';
    if (!A.city && t.town) A.city = String(t.town).slice(0, 60);
    if (!A.skills.length && t.skills && t.skills.length) t.skills.forEach(function (k) { var c = TRIBE_TO_CAMP[k]; if (c && A.skills.indexOf(c) < 0) A.skills.push(c); });
  }
  // Signed in: the name and address the account already holds, and who called you in (F-024, F-028).
  function prefill() {
    var M = window.MahalaMembers; if (!M || !M.info) return;
    M.info().then(function (i) {
      if (!i || !i.signedIn) return;
      var open = step === 1 && !box.hidden, changed = false;
      if (open) read();                                      // keep anything already typed
      [['name', i.name], ['email', i.email]].forEach(function (f) { if (f[1] && !A[f[0]]) { A[f[0]] = String(f[1]); changed = true; } });
      if (!A.nominatedBy && i.journey && i.journey.nominatedBy) A.nominatedBy = String(i.journey.nominatedBy).slice(0, 60);
      if (changed && open) redraw();
    }).catch(function () { /* the boxes stay empty */ });
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
  document.querySelectorAll('[data-pay-later]').forEach(function (b) { b.addEventListener('click', function () { openPay(b); }); });

  // Once the application is in (the record says applicant or camp, or this device sent it), Accept your invitation
  // gives way to Your Mahala, and a later payer finds the payment here (F-056).
  var APPLIED = false;
  function applied() { try { var c = JSON.parse(localStorage.getItem('mahala.applied') || 'null'); return !!(c && Date.now() - c.at < 200 * 864e5); } catch (e) { return false; } }
  function showApplied() {
    APPLIED = true;
    document.querySelectorAll('[data-join]').forEach(function (b) { b.hidden = true; });
    document.querySelectorAll('[data-open-tribe]').forEach(function (a) { a.hidden = true; });
    var bi = $('byInvite'); if (bi) bi.hidden = true;
    var M = window.MahalaMembers;
    document.querySelectorAll('[data-applied]').forEach(function (a) { if (M && M.mePage) a.setAttribute('href', M.mePage); a.hidden = false; });
    if (M && M.info) M.info().then(function (i) {
      if (!i || !i.signedIn) return null;
      return M.rpc('my_camp_payment').then(function (p) {
        var due = !p || (p.when === 'later' && !p.proof);
        document.querySelectorAll('[data-pay-later]').forEach(function (b) { b.hidden = !due; });
      });
    }).catch(function () { });
  }
  function showInvited() {
    if (APPLIED) return;
    document.querySelectorAll('[data-join]').forEach(function (b) { b.hidden = false; });
    document.querySelectorAll('[data-open-tribe]').forEach(function (a) { a.hidden = true; });
    var bi = $('byInvite'); if (bi) bi.hidden = true;
  }
  if (applied()) showApplied();
  // the camp is by invitation: the application opens only from an invitation letter's link (it carries ?ref=, ?inv= or ?by=)
  var INVITED = /[?&](ref|inv|by)=/.test(location.search);
  if (INVITED) {
    showInvited();
    if (!APPLIED && /^#(join|apply)$/i.test(location.hash)) openJoin();
  }
  // "Apply without an account", under the sign-in sheet the application opened
  function addSkip() {
    var sh = document.querySelector('.mvs'); if (!sh || sh.querySelector('[data-skip]')) return;
    var a = document.createElement('p'); a.innerHTML = '<small><a href="#" data-skip>Apply without an account</a></small>';
    sh.appendChild(a);
    a.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault(); try { sessionStorage.removeItem('mahala.openJoin'); } catch (er) { /* storage blocked */ }
      var x = sh.querySelector('.mvs-x'); if (x) x.click();
      openJoin('after-sign-in');
    });
  }
  // the invitation also counts when this device kept it from the letter's link (the sign-in round trip drops it
  // from the address), or when the account holds one (Mahala OS knows the invitation, or the letter was noted)
  var M0 = window.MahalaMembers;
  if (!INVITED) {
    var kept = null; try { kept = JSON.parse(localStorage.getItem('mahala.invite') || 'null'); } catch (e) { /* storage blocked */ }
    if (kept && Date.now() - kept.at < 60 * 864e5) { INVITED = true; showInvited(); if (!A.nominatedBy && kept.by) A.nominatedBy = kept.by; }
  }
  if (M0 && M0.ready) M0.ready.then(function (i) {
    var t = i && i.journey && i.journey.tier;
    if (t === 'applicant' || t === 'camp') { showApplied(); return; }
    if (!INVITED && t === 'invited') { INVITED = true; showInvited(); if (/^#(join|apply)$/i.test(location.hash) && box.hidden) openJoin('after-sign-in'); }
  });
  // back from the sign-in the application asked for: open it now
  try {
    if (sessionStorage.getItem('mahala.openJoin') === '1' && window.MahalaMembers) window.MahalaMembers.ready.then(function (i) {
      if (i && i.signedIn && i.noticeSeen !== false) { sessionStorage.removeItem('mahala.openJoin'); openJoin('after-sign-in'); }
    });
  } catch (e) { /* storage blocked */ }
  window.__join = { open: function () { openJoin('after-sign-in'); }, pay: function () { openPay(); }, state: function () { return { step: step, A: A, PAY: PAY }; } };
})();
