/* "Tell me when it is set": asking to hear about an event, on the tribe page, in the Mahalaverse and on Your Mahala
   (F-027). Signed in, one tap notes it in the member database (Mahala OS migration 20261109000200), and the stewards
   tell everyone who asked once the date is set. Signed out, one gentle sign-in, and the ask is noted right after it,
   never asked twice. On Your Mahala the person sees what they asked for and can take it back.
   Pages call window.MahalaInterest: on (accounts exist here), has(id), want({ id, title }) -> { state }, onChange(fn);
   every change also fires a 'mahala:interest' event on window, for pages whose code runs before this file.
   Without accounts (no site.js members) it stays off and the pages keep their old way. */
(function () {
  var M = window.MahalaMembers;
  var PENDING = 'mahala.wantEvent', HOUR = 3600 * 1000;
  var mine = null, fns = [];
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } },
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emit() { fns.forEach(function (f) { try { f(mine); } catch (e) { } }); try { window.dispatchEvent(new CustomEvent('mahala:interest')); } catch (e) { } draw(); }
  function signedIn() { return M ? Promise.resolve(M.info()).then(function (i) { return !!(i && i.signedIn); }, function () { return false; }) : Promise.resolve(false); }
  function has(id) { return !!(mine && mine.some(function (x) { return x.event === id; })); }

  function set(id, title, on) {
    return M.rpc('event_interest_set', { p_event: id, p_on: on, p_title: title || '' }).then(function (r) { mine = (r && r.mine) || []; emit(); return !!(r && r.on); });
  }
  function load() {
    return signedIn().then(function (on) {
      if (!on) { mine = null; emit(); return null; }
      return M.rpc('my_event_interest').then(function (r) { mine = r || []; emit(); flush(); return mine; });
    }).catch(function () { mine = null; emit(); return null; });
  }

  // Tap: signed in, it turns the ask on or off. Signed out, it keeps the ask on this device for an hour and opens the
  // sign-in once; after the sign-in (here, or from the email link in another tab) it is noted without asking again.
  function want(ev) {
    if (!M || !ev || !ev.id) return Promise.resolve({ state: 'none' });
    return signedIn().then(function (on) {
      if (on) return set(ev.id, ev.title, !has(ev.id)).then(function (now) { return { state: now ? 'on' : 'off' }; });
      ls.set(PENDING, JSON.stringify({ id: ev.id, title: ev.title || '', at: Date.now() }));
      M.signIn('Sign in, and we will note that you want to hear about ' + (ev.title || 'this event') + '. There is nothing else to fill in.');
      return { state: 'signin' };
    });
  }
  function flush() {
    var p = null; try { p = JSON.parse(ls.get(PENDING) || 'null'); } catch (e) { }
    if (!p || !p.id) return;
    ls.set(PENDING, null);
    if (Date.now() - (p.at || 0) > HOUR) return;
    set(p.id, p.title, true).then(function () { say('Noted. We will tell you when ' + (p.title || 'it') + ' is set.'); }, function () { });
  }

  // a quiet word at the foot of the screen
  var tip = null, tipT = 0;
  function say(t) {
    if (!tip) { tip = document.createElement('p'); tip.className = 'mi-tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    tip.textContent = t; tip.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(function () { tip.classList.remove('on'); }, 4200);
  }

  // Your Mahala: what you asked to hear about, each with a way to take it back
  var page = document.getElementById('page'), box = null;
  function draw() {
    if (!page || !/(^|\/)me\.html$/.test(location.pathname)) return;
    if (!box) {
      box = document.createElement('div'); box.className = 'letter yourevents'; box.id = 'yourevents';
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-unwant]'); if (!b) return;
        b.disabled = true;
        set(b.dataset.unwant, '', false).then(function () { var s = box.querySelector('[data-said]'); if (s) s.textContent = 'Taken back. We will not write about it.'; },
          function () { b.disabled = false; var s = box.querySelector('[data-said]'); if (s) s.textContent = 'That did not save. Try again in a moment.'; });
      });
      new MutationObserver(place).observe(page, { childList: true });
    }
    if (!mine || !mine.length) { box.remove(); return; }
    box.innerHTML = '<span class="from">Events you asked about</span>'
      + '<p>We will tell you when each is set. Nothing else to do.</p>'
      + '<ul class="ye">' + mine.map(function (x) {
        return '<li><b>' + esc(x.title || x.event) + '</b><button type="button" class="btn small ghost" data-unwant="' + esc(x.event) + '">Take it back</button></li>';
      }).join('') + '</ul>'
      + '<div class="row"><a class="btn small ghost" href="tribe.html#events">The season’s gatherings</a></div><p class="said" data-said aria-live="polite"></p>';
    place();
  }
  function place() {
    if (!box || !mine || !mine.length) return;
    var demo = document.getElementById('proto'), host = page.querySelector('#eventsHost') || page.querySelector('.whorest');
    if (demo && !demo.hidden) { box.remove(); return; }
    if (host && box.parentNode !== host) host.appendChild(box);
  }

  var css = document.createElement('style');
  css.textContent = '.mi-tip{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translate(-50%,12px);z-index:2147483000;margin:0;max-width:min(92vw,460px);'
    + 'padding:12px 18px;border-radius:14px;background:#2A221C;color:#F4EFE6;font:400 14px/1.45 Jost,system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 10px 30px rgba(20,12,6,.28);'
    + 'opacity:0;pointer-events:none;transition:opacity .35s ease,transform .35s ease;text-align:center}.mi-tip.on{opacity:1;transform:translate(-50%,0)}'
    + '.yourevents .ye{list-style:none;margin:12px 0 4px;padding:0;display:grid;gap:10px}'
    + '.yourevents .ye li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid rgba(42,34,28,.12)}'
    + '.yourevents .ye li:first-child{border-top:0;padding-top:0}.yourevents .row{display:flex;flex-wrap:wrap;gap:8px}';
  document.head.appendChild(css);

  window.MahalaInterest = Object.freeze({ on: !!M, has: has, want: want, say: say, list: function () { return mine; },
    onChange: function (f) { if (typeof f === 'function') fns.push(f); } });
  if (M) { if (M.onChange) M.onChange(load); M.ready.then(load, function () { }); }
})();
