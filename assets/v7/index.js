/* The v7 plugins, started in order once the game has loaded. Each workstream keeps its plugin in its own folder here,
   with an index.js that exports start(M, ctx). M is window.__mahala (the game: M.v7 is its toolkit, M.HOOK7 its hooks).
   ctx is shared by the plugins:
     ctx.platform            what the platform plugin returns: who is viewing, how data is reached (see platform/)
     ctx.dashboard           sections other plugins add to the personal dashboard: { id, title, order, render(el, me) }
     ctx.steward             sections other plugins add to the stewards' tools:      { id, title, order, render(el, me) }
     ctx.gifts               gift rules other plugins add (badges, artifacts):       { id, title, kind, test(state) }
     ctx.giftState           async me => partial gift state, from other plugins (see CONTRACT.md section 6)
     ctx.bus                 a small event bus between plugins: on(name, fn), emit(name, data)
   A plugin must return from start() quickly and do slow work in the background. A missing or failing plugin never
   stops the others. */
const PLUGINS = ['platform', 'world', 'me', 'co', 'pay'];
const ONLY = Array.isArray(window.__V7_ONLY) ? window.__V7_ONLY : null;   // tests may load a few plugins only

export async function start(M) {
  const handlers = {};
  const ctx = {
    M, platform: null, dashboard: [], steward: [], gifts: [], giftState: [],
    bus: { on: (n, f) => { (handlers[n] = handlers[n] || []).push(f); return () => { handlers[n] = handlers[n].filter(x => x !== f); }; },
           emit: (n, d) => (handlers[n] || []).slice().forEach(f => { try { f(d); } catch (e) { console.warn('v7 bus', n, e); } }) },
    started: [],
  };
  window.__v7 = ctx;
  for (const name of PLUGINS) {
    if (ONLY && !ONLY.includes(name)) continue;
    let mod = null;
    try { mod = await import(`./${name}/index.js`); }
    catch (e) { continue; }                                   // this workstream has no plugin (yet)
    try {
      const r = mod && typeof mod.start === 'function' ? await mod.start(M, ctx) : null;
      if (name === 'platform') ctx.platform = r || null;
      ctx.started.push(name);
    } catch (e) { console.warn(`The ${name} plugin did not start:`, e); }
  }
  ctx.bus.emit('ready', ctx);
  return ctx;
}
