// Mahala invitation. The letter comes sealed with Mahala's wine-red wax, the temple pressed into it. Break the seal, the
// flap lifts, the letter rises out and opens. Envelope, seal and opening adapted from Chris's Seed invitation.
(() => {
  const $ = (id) => document.getElementById(id);
  const TO = document.body.dataset.to || '';
  const KEY = 'mahala.invite.' + (document.body.dataset.key || 'x');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const EMBLEM = 'M0 -21C.6 -17.4 1.8 -14.8 4.2 -12.4C10 -6.6 9.4 -1.8 9.4 7.6H-9.4C-9.4 -1.8 -10 -6.6 -4.2 -12.4C-1.8 -14.8 -.6 -17.4 0 -21Z'
    + 'M-4.6 7.6V.5C-4.6 -3 -2.4 -5.2 0 -7.4C2.4 -5.2 4.6 -3 4.6 .5V7.6Z'
    + 'M-11.2 5.5C-16.6 2.4 -17.6 -4.6 -15 -9.4C-12.4 -5.4 -10.6 -.6 -11.2 5.5Z M11.2 5.5C16.6 2.4 17.6 -4.6 15 -9.4C12.4 -5.4 10.6 -.6 11.2 5.5Z'
    + 'M-13.6 8.6C-21.5 7.6 -26.8 1.4 -27.4 -4.6C-21.4 -2 -16.6 2.6 -13.6 8.6Z M13.6 8.6C21.5 7.6 26.8 1.4 27.4 -4.6C21.4 -2 16.6 2.6 13.6 8.6Z'
    + 'M-1.5 10.6C-9 9.6 -21 11.4 -30.5 6.2C-23 14.8 -9.6 14.6 -1.5 12.8Z M1.5 10.6C9 9.6 21 11.4 30.5 6.2C23 14.8 9.6 14.6 1.5 12.8Z';
  const WAX_EDGE = (() => {        // the spill of the wax: a round with a soft, uneven edge
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = 26, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 43.5 + (rnd() - 0.5) * 6 + 2.2 * Math.sin(a * 3 + 1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], f = (v) => v.toFixed(1);
    const m0 = mid(pts[n - 1], pts[0]);
    return `M${f(m0[0])} ${f(m0[1])}` + pts.map((p, i) => { const m = mid(p, pts[(i + 1) % n]); return `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; }).join('') + 'Z';
  })();
  const CRACK = [[-50, 0], [-38, 3.6], [-27, -1.8], [-15, 4.2], [-6, -0.8], [4, 4.8], [14, -1.2], [25, 3], [36, -2.2], [50, 1.8]];
  function sealSVG(u, half) {
    const c = CRACK.map((p) => p.join(',')), poly = half === 'hi' ? ['-50,-60', '60,-60', ...c.slice().reverse()].join(' ') : [...c, '60,60', '-50,60'].join(' ');
    return `<svg viewBox="-50 -50 100 100" aria-hidden="true"><defs>
      <radialGradient id="sw${u}" gradientUnits="userSpaceOnUse" cx="-14" cy="-16" r="66"><stop offset="0" stop-color="#d9578a"/><stop offset=".32" stop-color="#ad2a5d"/><stop offset=".72" stop-color="#7d1741"/><stop offset="1" stop-color="#4c0a23"/></radialGradient>
      <radialGradient id="sp${u}" gradientUnits="userSpaceOnUse" cx="10" cy="12" r="44"><stop offset="0" stop-color="#ab2859"/><stop offset=".7" stop-color="#871c47"/><stop offset="1" stop-color="#5c0e2d"/></radialGradient>
      <clipPath id="sc${u}"><polygon points="${poly}"/></clipPath></defs>
      <g clip-path="url(#sc${u})">
        <path d="${WAX_EDGE}" fill="url(#sw${u})"/><path d="${WAX_EDGE}" fill="none" stroke="#3d0719" stroke-opacity=".45" stroke-width="1"/>
        <circle r="31" fill="url(#sp${u})"/>
        <circle r="31" fill="none" stroke="#ec86ab" stroke-opacity=".5" stroke-width="1.4" transform="translate(.8 .8)"/>
        <circle r="31" fill="none" stroke="#3d0719" stroke-opacity=".6" stroke-width="1.2" transform="translate(-.6 -.6)"/>
        <circle r="27.4" fill="none" stroke="#5a0d2c" stroke-opacity=".55" stroke-width=".7" stroke-dasharray="1.1 2.3"/>
        <g transform="translate(0 2) scale(.76)">
          <path d="${EMBLEM}" fill="#43081f" fill-rule="evenodd" opacity=".8" transform="translate(1.2 1.2)"/>
          <path d="${EMBLEM}" fill="#e97aa2" fill-rule="evenodd" opacity=".55" transform="translate(-.8 -.8)"/>
          <path d="${EMBLEM}" fill="#9d2354" fill-rule="evenodd"/></g>
        <ellipse cx="-17" cy="-22" rx="13" ry="5.5" fill="#fff" opacity=".17" transform="rotate(-32 -17 -22)"/>
      </g></svg>`;
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function envHTML(u) {
    return `<span class="env-in"></span>
    <span class="env-card"><i></i><i></i><b><svg viewBox="-32 -24 64 40"><path d="${EMBLEM}" fill-rule="evenodd"/></svg></b></span>
    <span class="env-pocket"><svg viewBox="0 0 300 200" preserveAspectRatio="none"><defs>
        <linearGradient id="pl${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e5d1ae"/><stop offset="1" stop-color="#efe1c6"/></linearGradient>
        <linearGradient id="pr${u}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#e2cdaa"/><stop offset="1" stop-color="#ecdbbf"/></linearGradient>
        <linearGradient id="pb${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f2e5cd"/><stop offset="1" stop-color="#e8d6b8"/></linearGradient>
        <filter id="fb${u}" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>
      <path d="M0 0L148 104L0 200Z" fill="url(#pl${u})"/><path d="M300 0L152 104L300 200Z" fill="url(#pr${u})"/>
      <path d="M0 200L136 107Q150 97 164 107L300 200Z" fill="url(#pb${u})"/>
      <path d="M0 200L136 107Q150 97 164 107L300 200" fill="none" stroke="#fffaf0" stroke-opacity=".75" stroke-width="1.1"/>
      <path class="fshadow" d="M2 0L298 0L160 116Q150 125 140 116Z" fill="#5a3a1c" opacity=".32" filter="url(#fb${u})"/>
      <rect x=".5" y=".5" width="299" height="199" rx="3" fill="none" stroke="#b09062" stroke-opacity=".5"/></svg>
      <span class="env-to">${esc(TO)}</span><span class="seal-half seal-lo">${sealSVG(u + 'b', 'lo')}</span></span>
    <span class="env-flap">
      <span class="flap-out"><svg viewBox="0 0 300 200" preserveAspectRatio="none"><defs><linearGradient id="fo${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5ecdd"/><stop offset="1" stop-color="#eadabe"/></linearGradient></defs>
        <path d="M0 0L300 0L160 110Q150 119 140 110Z" fill="url(#fo${u})"/><path d="M0 0L140 110Q150 119 160 110L300 0" fill="none" stroke="#b09062" stroke-opacity=".55"/></svg></span>
      <span class="flap-in"><svg viewBox="0 0 300 200" preserveAspectRatio="none"><defs><clipPath id="fi${u}"><path d="M0 200L300 200L160 90Q150 81 140 90Z"/></clipPath>
        <linearGradient id="fg${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2a0c10" stop-opacity=".6"/><stop offset=".6" stop-color="#2a0c10" stop-opacity="0"/></linearGradient></defs>
        <g clip-path="url(#fi${u})"><rect width="300" height="200" fill="#8a3322"/><image href="../assets/flap.jpg" x="0" y="40" width="300" height="160" preserveAspectRatio="xMidYMid slice" opacity=".92"/><rect width="300" height="200" fill="url(#fg${u})"/></g></svg></span>
      <span class="seal-half seal-hi">${sealSVG(u + 'a', 'hi')}</span>
    </span>`;
  }

  const envBig = $('envBig'), envStage = $('envStage'), sealBtn = $('sealBtn'), paper = $('letterPaper'), sheet = $('sheet'), scene = $('scene'), intro = $('intro');
  envBig.innerHTML = envHTML('b');
  let opened = false; try { opened = localStorage.getItem(KEY) === 'open'; } catch (e) { /* storage blocked */ }
  const anims = [];
  const part = (sel) => envBig.querySelector(sel);
  const anim = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.2, .7, .1, 1)' }, o)); anims.push(a); return a.finished.catch(() => {}); };
  let stage = 0;                    // 0 arriving, 2 waiting for the seal, 3 opening, 4 reading

  function showLetter(fade) {
    stage = 4; envStage.hidden = true;
    document.body.classList.add('reading'); sheet.scrollTop = 0;
    if (fade) paper.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.2, .7, .1, 1)' });
    try { localStorage.setItem(KEY, 'open'); } catch (e) { /* storage blocked */ }
    paper.focus({ preventScroll: true });
  }

  function arrive() {
    scene.classList.add('in'); intro.classList.add('on');
    const w = envBig.offsetWidth, h = envBig.offsetHeight, x = (innerWidth - w) / 2, y = (innerHeight - h) / 2 - h * 0.04;
    envBig.style.opacity = '1';
    anim(envBig, [{ transform: `translate(${x}px, ${innerHeight + 40}px) scale(.82) rotate(-6deg)` }, { transform: `translate(${x}px, ${y}px) scale(1) rotate(0deg)` }], { duration: 1500, delay: 500, fill: 'both' }).then(() => {   // 'both': hold the first frame (below the screen) during the delay, so the envelope never flashes in the corner
      stage = 2; envBig.classList.add('ready'); sealBtn.classList.add('on'); sealBtn.focus({ preventScroll: true });
    });
  }
  // keep the envelope centred if the window changes size while it waits
  addEventListener('resize', () => {
    if (stage !== 2) return;
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); anims.length = 0;
    const w = envBig.offsetWidth, h = envBig.offsetHeight;
    envBig.style.transform = `translate(${(innerWidth - w) / 2}px, ${(innerHeight - h) / 2 - h * 0.04}px)`;
  });

  function goFull() {
    const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
    if (f && !document.fullscreenElement) { try { const p = f.call(d, { navigationUI: 'hide' }); p && p.catch && p.catch(() => {}); } catch (e) { /* not allowed here */ } }
  }

  async function breakSeal() {
    if (stage !== 2) return;
    stage = 3; goFull();
    sealBtn.classList.remove('on'); envBig.classList.remove('ready');
    await new Promise((r) => setTimeout(r, 120));       // let the screen settle if it went full
    const hi = part('.seal-hi'), lo = part('.seal-lo'), flap = part('.env-flap'), card = part('.env-card'), fsh = part('.fshadow');
    // re-centre after any change of size from going full screen
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); anims.length = 0;
    const w = envBig.offsetWidth, h = envBig.offsetHeight;
    envBig.style.transform = `translate(${(innerWidth - w) / 2}px, ${(innerHeight - h) / 2 - h * 0.04}px)`;
    const persp = `perspective(${(w * 3.4).toFixed(0)}px)`;
    // the crack: the two halves part along it
    anim(hi, [{ transform: 'translateZ(.5px)' }, { transform: 'translateZ(.5px) translate(-2%, -5%) rotate(-5deg)' }], { duration: 320, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
    await anim(lo, [{ transform: 'none' }, { transform: 'translate(2%, 6%) rotate(4deg)' }], { duration: 320, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
    // the flap lifts towards you and folds back over the top
    anim(fsh, [{ opacity: 0.32 }, { opacity: 0 }], { duration: 300 });
    await anim(flap, [{ transform: `${persp} rotateX(0deg)` }, { transform: `${persp} rotateX(90deg)` }], { duration: 420, easing: 'cubic-bezier(.45, 0, .8, .6)' });
    flap.style.zIndex = '0';
    await anim(flap, [{ transform: `${persp} rotateX(90deg)` }, { transform: `${persp} rotateX(180deg)` }], { duration: 480, easing: 'cubic-bezier(.2, .5, .3, 1)' });
    // the letter rises out, and the envelope drops away below it
    await anim(card, [{ transform: 'none' }, { transform: 'translateY(-64%)' }], { duration: 900, easing: 'cubic-bezier(.3, .1, .2, 1)' });
    const cr = card.getBoundingClientRect();
    document.body.classList.add('opening');
    ['.env-in', '.env-pocket', '.env-flap'].forEach((sel, i) => { const f = sel === '.env-flap', t0 = f ? `${persp} rotateX(180deg)` : 'translateY(0) rotate(0deg)';
      anim(part(sel), [{ opacity: 1, transform: t0 }, { opacity: 0, transform: `${f ? t0 + ' ' : ''}translateY(${f ? -60 : 60}vh) rotate(${i ? 5 : -3}deg)` }], { duration: 750, easing: 'cubic-bezier(.5, 0, .9, .5)' }); });
    intro.classList.remove('on');
    // the letter opens out to its full size
    sheet.scrollTop = 0;
    const pr = paper.getBoundingClientRect(), top = Math.max(pr.top, 24), hh = Math.min(pr.height, innerHeight - top - 24);
    const sx = pr.width / cr.width, sy = hh / cr.height;
    const dx = pr.left - cr.left, dy = top - (cr.top + 0.64 * cr.height);
    card.style.transformOrigin = '0 0';
    card.querySelectorAll('i').forEach((i) => anim(i, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }));
    await anim(card, [{ transform: `translate(0px, ${(-0.64 * cr.height).toFixed(1)}px) scale(1, 1)` }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }], { duration: 750, easing: 'cubic-bezier(.4, .1, .1, 1)' });
    showLetter(false);
    await paper.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease' }).finished.catch(() => {});
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); anims.length = 0;
  }
  sealBtn.addEventListener('click', breakSeal);
  envBig.addEventListener('click', breakSeal);
  addEventListener('keydown', (e) => { if (stage === 2 && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== sealBtn) { e.preventDefault(); breakSeal(); } });


  const start = () => {
    if (opened || REDUCED) { scene.classList.add('in'); showLetter(true); return; }
    envStage.hidden = false; arrive();
  };
  const img = scene.querySelector('img');
  const ready = Promise.all([document.fonts ? document.fonts.ready : 0, img && !img.complete ? new Promise((r) => { img.onload = img.onerror = r; }) : 0]);
  Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(start);
})();
