// Settings shared by every page of the public Mahala site (the front page, The camp and The Seed). Change them here.
window.MAHALA_SITE = {
  // The crowdfunding page, once it is live (a BackaBuddy or Thundafund link, say). While it is empty, every Donate
  // button opens the end of The Seed page, where people can leave their email to hear the day giving opens.
  donateUrl: '',
  target: 999999,                 // what we are raising to build The Seed, in rand
  buildWeek: [2027, 3, 22],       // the first day of build week: year, month counted from 0 (3 is April), day
  // The Mahala Temple Builder Nominations & Applications sheet, through its Apps Script web app. Camp applications go
  // to its Applications tab, and sign-ups for news to its Email list tab.
  sheet: 'https://script.google.com/macros/s/AKfycbz9hE1X_QETwBCUOm0PxAFe9T4opCqD-IZQUdoQZtuhTkKGioNO9LmzLLNkMwSRqZVS/exec',
};

(function (S) {
  // R 999 999: rand, with a space between the thousands
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
})(window.MAHALA_SITE);
