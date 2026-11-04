// Counting visits to wearemahala.com: how many people come, where from, how far through the invitation they read, and
// what they click. It uses Umami Cloud (umami.is), which sets no cookies, stores nothing in the visitor's browser and
// keeps no personal data, so the site needs no consent banner. Visitors who ask browsers not to track them are not counted.
//
// Left without a website id, nothing loads and nothing is counted. Mahala OS has the how and why:
// operations/2027/website-analytics.md (what is counted, the tagged links for each channel, who reads the numbers).
(function () {
  var COUNT = {
    id: '',                                              // the website id from Umami (Settings, Websites): public by design
    src: 'https://cloud.umami.is/script.js',
    domains: 'wearemahala.com,www.wearemahala.com'       // only the live site counts; previews and tests never do
  };

  var waiting = [], ready = false;
  function send(name, data) {
    try { if (ready && window.umami && typeof window.umami.track === 'function') { window.umami.track(name, data); return; } } catch (e) { /* never let counting break the page */ }
    if (waiting.length < 40) waiting.push([name, data]);
  }
  // mahalaCount('Scene', { scene: '7 The lantern' }): the pages call this; it does nothing until there is an id
  window.mahalaCount = function (name, data) { if (COUNT.id) send(name, data || undefined); };
  if (!COUNT.id) return;

  var s = document.createElement('script');
  s.async = true; s.src = COUNT.src;
  s.setAttribute('data-website-id', COUNT.id);
  s.setAttribute('data-domains', COUNT.domains);
  s.setAttribute('data-do-not-track', 'true');
  s.onload = function () { ready = true; var w = waiting.splice(0); w.forEach(function (x) { send(x[0], x[1]); }); };
  document.head.appendChild(s);

  // clicks on anything marked data-count="Join" data-count-where="top bar". Our own attribute, not Umami's, so a link
  // that opens a page over the front page keeps working exactly as before.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-count]');
    if (!el) return;
    var where = el.getAttribute('data-count-where') || '';
    window.mahalaCount(el.getAttribute('data-count'), where ? { where: where } : undefined);
  }, true);

  // accounts: someone asks for a sign-in link (the email itself is never counted), and someone arrives back from one
  document.addEventListener('submit', function (e) {
    var f = e.target; if (f && f.matches && f.matches('.mvs form[data-k="email"]')) window.mahalaCount('Asked for a sign-in link');
  }, true);
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && /[?&]signin=1\b/.test(nav.name)) window.mahalaCount('Came back signed in');
  } catch (e) { /* fine */ }

  // sign-ups: the tribe, the camp application and the news list all go to the sheet through MAHALA_SITE.post. Only the
  // kind of sign-up is counted, never what was written in it.
  var SITE = window.MAHALA_SITE;
  if (SITE && typeof SITE.post === 'function') {
    var post = SITE.post;
    SITE.post = function (row) {
      var p = post.apply(this, arguments);
      try {
        var path = row && row.path;
        var name = path === 'tribe' ? 'Joined the tribe' : path === 'camp' ? 'Applied to the camp' : 'Signed up for news';
        var data = path === 'tribe' ? { 'would love to come': row.loveToCome ? 'yes' : 'no' } : undefined;
        if (p && p.then) p.then(function () { window.mahalaCount(name, data); }, function () { /* not sent, not counted */ });
      } catch (e) { /* fine */ }
      return p;
    };
  }
})();
