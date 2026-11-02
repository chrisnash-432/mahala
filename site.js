// Settings shared by every page of the public Mahala site (the front page, The camp and The Seed). Change them here.
window.MAHALA_SITE = {
  // The crowdfunding page for The Seed, live on BackaBuddy. Every Donate button on the site opens it in a new tab.
  // The Donate buttons in index.html and seed.html also carry this link directly, so change it there too if it moves.
  donateUrl: 'https://www.backabuddy.co.za/campaign/the-seed',
  target: 718875,                 // what we are raising to build The Seed, in rand (the BackaBuddy goal)
  buildWeek: [2027, 3, 22],       // the first day of build week: year, month counted from 0 (3 is April), day
  // The Mahala Temple Builder Nominations & Applications sheet, through the "Mahala applications backend" web app
  // (an Apps Script project in Chris's BioHarmonic account; its code is apps-script-standalone.gs). Camp applications go
  // to its Applications tab, and sign-ups for news to its Email list tab.
  sheet: 'https://script.google.com/macros/s/AKfycbzghj0pcukOFS6AyXr7xgEEFx192BIIZYrjOZqCbZvHDwh986SsGEZor4r8l5M8b9o/exec',
  // The camp's rate for showing money in both currencies, set once a month by a steward. Rand is what PayFast charges;
  // the dollar figure beside it is a guide. Working rate: the 30 Oct 2026 close (Pound Sterling Live), until a steward sets one.
  fx: { usdZar: 16.7, set: '2026-10-30' },
  // Raised so far for The Seed, entered by a steward until the ledger is live: money carried from 2026 (Mahala OS T-005)
  // plus the BackaBuddy total (BackaBuddy has no API, so someone copies it here). Change enteredOn when you update it.
  raised: { carried: 70000, backabuddy: 0, enteredOn: '2026-10-31' },
};

(function (S) {
  // R 718 875: rand, with a space between the thousands
  S.money = function (n) { return 'R ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  S.daysToBuild = function () {
    var b = S.buildWeek, t = new Date(b[0], b[1], b[2]), now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((t - now) / 864e5));
  };
  // a row for the sheet: a sign-up for the list (path "list") or a camp application (path "camp"). The sheet answers
  // opaquely (no-cors), so a send that reaches Google counts as sent; a copy stays in this browser in case it needs
  // sending again.
  S.post = function (row) {
    var id = '';
    try { id = localStorage.getItem('mahala.id') || ''; if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 36); localStorage.setItem('mahala.id', id); } } catch (e) { /* storage blocked */ }
    var body = Object.assign({ type: 'application', path: 'list', source: 'website', page: location.pathname.split('/').pop() || 'index.html', id: id, sentAt: new Date().toISOString() }, row);
    try { var box = JSON.parse(localStorage.getItem('mahala.outbox') || '[]'); box.push(body); localStorage.setItem('mahala.outbox', JSON.stringify(box.slice(-5))); } catch (e) { /* storage blocked */ }
    return fetch(S.sheet, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  };
  S.joinList = function (row) { return S.post(Object.assign({ path: 'list', keepPosted: 'yes' }, row)); };

  // Money in both currencies. The visitor's side decides which comes first: rand for South Africa, dollars for everyone
  // else. A choice made with the R / $ toggle wins; otherwise the browser's time zone and language decide.
  S.raisedTotal = function () { var r = S.raised || {}; return (+r.carried || 0) + (+r.backabuddy || 0); };
  S.side = function () {
    try { var c = localStorage.getItem('mahala.cur'); if (c === 'R' || c === '$') return c; } catch (e) { /* storage blocked */ }
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    if (/^Africa\/Johannesburg$/.test(tz) || /-ZA$/i.test(navigator.language || '')) return 'R';
    return '$';
  };
  S.setSide = function (c) {
    try { localStorage.setItem('mahala.cur', c === 'R' ? 'R' : '$'); } catch (e) { /* storage blocked */ }
    try { window.dispatchEvent(new CustomEvent('mahala:cur', { detail: c })); } catch (e) { /* old browser */ }
  };
  function grp(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // both(100, '$') gives "$100 (about R1,670)" abroad and "R1,670 (about $100)" in South Africa
  S.both = function (amount, from, opts) {
    var rate = (S.fx && +S.fx.usdZar) || 0, zar = from === '$' ? amount * rate : amount, usd = from === '$' ? amount : (rate ? amount / rate : 0);
    if (!rate) return from === '$' ? '$' + grp(amount) : 'R' + grp(amount);
    var side = (opts && opts.side) || S.side(), r = 'R' + grp(zar), d = '$' + grp(usd);
    if (opts && opts.short) return side === 'R' ? r : d;
    return side === 'R' ? r + ' (about ' + d + ')' : d + ' (about ' + r + ')';
  };
})(window.MAHALA_SITE);
