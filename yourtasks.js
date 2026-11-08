/* Your tasks, on Your Mahala (me.html): the open tasks that are yours in Basecamp, to mark done or say where they
   stand without opening the plan. Shows only for people Basecamp opens for (the core team, camp leads, crews) who
   have a task in their name. What they send reaches the camp's task list within the hour, the same as from
   Basecamp. No plan data lives here: it comes from the member database, for the signed-in person only. */
(function () {
  var M = window.MahalaMembers, page = document.getElementById('page');
  if (!M || !page) return;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], SHOW = 6;
  var box = document.createElement('div'), tasks = [], role = '', open = null;
  box.className = 'letter yourtasks'; box.id = 'yourtasks';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function day(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-').map(Number); return p[2] + ' ' + MON[p[1] - 1]; }
  function overdue(iso) { return iso && new Date(iso + 'T23:59:59+02:00') < new Date(); }

  function draw() {
    if (!tasks.length) { box.remove(); return; }
    var shown = tasks.slice(0, SHOW);
    box.innerHTML = '<span class="from">Your tasks</span>'
      + '<p>From Basecamp, in your name. Mark one done or say where it stands; it reaches the camp’s task list within the hour.</p>'
      + '<ul class="yt">' + shown.map(function (t) {
        var l = t.latest, sent = t.sent;
        return '<li data-id="' + esc(t.id) + '"><div class="ytt"><b>' + esc(t.title || t.id) + '</b><small>'
          + (t.due ? '<span class="' + (overdue(t.due) ? 'late' : '') + '">' + (overdue(t.due) ? 'overdue, ' : 'due ') + day(t.due) + '</span>' : 'no date yet')
          + (sent ? ' · <b>' + esc(sent) + '</b>, sent' : l ? ' · latest: ' + esc(l.status.toLowerCase()) + (l.note ? ', ' + esc(l.note) : '') + ' (' + esc(l.name) + ', ' + day(l.at) + ')' : '')
          + '</small></div>'
          + (sent === 'Done' ? '' : '<button type="button" class="btn small ghost ytopen" data-open aria-expanded="' + (open === t.id) + '">' + (open === t.id ? 'Close' : 'Update') + '</button>'
          + '<div class="ytc"' + (open === t.id ? '' : ' hidden') + '><div class="row"><button type="button" class="btn small" data-yt="Done">Done</button><button type="button" class="btn small ghost" data-yt="Under way">Under way</button><button type="button" class="btn small ghost" data-yt="Blocked">Blocked</button></div>'
          + '<input type="text" class="ytnote" maxlength="600" placeholder="A note for the team (optional)" aria-label="A note on ' + esc(t.title || t.id) + ' (optional)"></div>')
          + '</li>';
      }).join('') + '</ul>'
      + '<div class="row"><a class="btn small ghost" href="basecamp.html#list">' + (tasks.length > SHOW ? 'All ' + tasks.length + ' in Basecamp' : 'Open Basecamp') + '</a></div>'
      + '<p class="said" data-said aria-live="polite"></p>';
    place();
  }

  // me.html redraws its page: keep the card in place, after the next step and the doors
  function place() {
    if (!tasks.length) return;
    var demo = document.getElementById('proto'), host = page.querySelector('.whorest');
    if (demo && !demo.hidden) { box.remove(); return; }
    if (host && box.parentNode !== host) host.appendChild(box);
  }
  new MutationObserver(place).observe(page, { childList: true });

  box.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]');
    if (o) { var id0 = o.closest('li').dataset.id; open = open === id0 ? null : id0; draw(); var n = open && box.querySelector('li[data-id="' + open + '"] .ytnote'); if (n) n.focus(); return; }
    var b = e.target.closest('[data-yt]'); if (!b) return;
    var li = b.closest('li'), id = li.dataset.id, status = b.dataset.yt, note = (li.querySelector('.ytnote') || {}).value || '';
    var said = box.querySelector('[data-said]');
    li.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
    said.textContent = 'Sending…';
    M.rpc('basecamp_update', { p_task: id, p_status: status, p_note: note.trim().slice(0, 600) }).then(function () {
      tasks.forEach(function (t) { if (t.id === id) t.sent = status; }); open = null;
      draw();
      box.querySelector('[data-said]').textContent = status === 'Done' ? 'Done. Thank you. It ticks in the task list within the hour.' : 'Sent. The team sees it in Basecamp now.';
    }, function (err) {
      li.querySelectorAll('button').forEach(function (x) { x.disabled = false; });
      said.textContent = /a lot for one hour/.test((err && err.message) || '') ? 'That is a lot for one hour. Try again a little later.' : 'That did not send. Check your connection and try again.';
    });
  });

  function load() {
    Promise.resolve(M.info()).then(function (i) {
      if (!i || !i.signedIn) { tasks = []; draw(); return; }
      return M.rpc('basecamp_my_tasks').then(function (r) {
        role = (r && r.role) || ''; tasks = (r && r.basecamp && r.tasks) || []; draw();
      });
    }).catch(function () { tasks = []; draw(); });   // before the database knows Basecamp, or offline: simply nothing
  }
  if (M.onChange) M.onChange(load);
  M.ready.then(load);

  var css = document.createElement('style');
  // dressed as Basecamp is: Jost 500 titles, quiet ink-3 detail, overdue in the plan's red, a sent update in green
  css.textContent = '.yourtasks .yt{list-style:none;margin:12px 0 4px;padding:0;display:grid;gap:12px}'
    + '.yourtasks .yt li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px 12px;padding-top:12px;border-top:1px solid var(--rule,#DCD2C3)}'
    + '.yourtasks .ytc{grid-column:1/-1;display:grid;gap:8px;padding:12px;border-radius:12px;background:var(--paper,#F7F2EA)}.yourtasks .ytc[hidden]{display:none}'
    + '.yourtasks .yt li:first-child{border-top:0;padding-top:0}'
    + '.yourtasks .ytt{display:grid;gap:2px;min-width:0}.yourtasks .ytt > b{font-weight:500;overflow-wrap:anywhere}'
    + '.yourtasks .ytt small{color:var(--ink-3,#6F6357);font-size:13.5px;line-height:1.5}.yourtasks .ytt small b{font-weight:500;color:var(--ok,#2E6B4F)}'
    + '.yourtasks .late{color:#A62B22;font-weight:500}'
    + '.yourtasks .row{display:flex;flex-wrap:wrap;gap:8px}'
    + '.yourtasks .ytnote{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px 12px;border:1px solid var(--rule-2,#C9BCA9);border-radius:10px;background:#fff;color:var(--ink,#2A221C);min-height:42px}';
  document.head.appendChild(css);
})();
