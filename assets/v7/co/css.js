/* The co plugin's look: built from the game's own tokens (--ink, --card, --card-line, --ground, --hover, the glass colours),
   so night mode and the phone layout keep working. Every class starts with v7-co-. On a phone every control is at
   least 44 px tall. */
export const CSS = `
.modal.v7-co-modal { z-index: 46; }
.v7-co-modal .sheet.v7-co-wide { width: min(880px, 100%); }
.v7-co-modal .sheet-body { gap: 14px; }
.v7-co-modal .sheet-body h4.v7-co-h { margin: 6px 0 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3); line-height: var(--lh-display); color: var(--ink); }
.v7-co-modal .v7-co-back { margin-right: 2px; }
.v7-co-modal #v7coTitle:focus, .v7-co-modal .v7-co-sec > h4:focus { outline: none; }
.v7-co-lede { font-family: var(--display); font-size: var(--fs-xl) !important; line-height: var(--lh-body); color: var(--ink) !important; text-wrap: pretty; }
.v7-co-modal .note, .v7-co-sec .note, .v7-co-dash .note { margin: 0; }
.v7-co-modal .sheet-foot .btn, .v7-co-modal .sheet-head .iconbtn { min-height: 40px; }

/* the five ways to offer something */
.v7-co-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.v7-co-choice { display: grid; grid-template-columns: 34px 1fr; gap: 4px 12px; align-items: start; text-align: left; padding: 12px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--hover); color: var(--ink); min-height: 64px; }
.v7-co-choice:hover { border-color: var(--ink-3); }
.v7-co-choice:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-co-choice .v7-co-ic { grid-row: span 2; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--card-strong); color: var(--ink-2); }
.v7-co-choice b { font-weight: 500; font-size: var(--fs-l); }
.v7-co-choice small { font-size: var(--fs-s); color: var(--ink-2); line-height: var(--lh-body); }
.v7-co-choice[data-k="journey"] .v7-co-ic { color: var(--magenta-ink); }
.v7-co-choice[data-k="piece"] .v7-co-ic { color: #B87333; }
.v7-co-choice[data-k="art"] .v7-co-ic { color: var(--cyan-ink); }
.v7-co-choice[data-k="set"] .v7-co-ic { color: var(--yellow-ink); }
.v7-co-choice[data-k="sound"] .v7-co-ic { color: var(--done); }
.v7-co-quick { display: flex; flex-wrap: wrap; gap: 6px; }

/* what you have offered, and the rows of a list */
.v7-co-list { display: grid; gap: 8px; }
.v7-co-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: start; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--card-strong); }
.v7-co-item .v7-co-k { font-size: var(--fs-xs); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.v7-co-item .v7-co-ti { display: block; font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); color: var(--ink); overflow-wrap: anywhere; }
.v7-co-item .v7-co-ex { grid-column: 1 / -1; margin: 0; font-family: var(--display); font-size: var(--fs-l); line-height: var(--lh-body); color: var(--ink-2); white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.v7-co-item .v7-co-qq { grid-column: 1 / -1; margin: 0; font-size: var(--fs-s); font-style: italic; color: var(--ink-3); overflow-wrap: anywhere; }
.v7-co-item .actions { grid-column: 1 / -1; }
.v7-co-item .v7-co-host, .v7-co-item .v7-co-where { grid-column: 1 / -1; margin: 0; font-size: var(--fs-s); color: var(--ink-3); overflow-wrap: anywhere; }
.v7-co-item .v7-co-where { color: var(--done); font-weight: 500; }
.btn.v7-co-sm { height: 34px; padding: 0 13px; font-size: var(--fs-m); }
.v7-co-say { grid-column: 1 / -1; margin: 2px 0 0; padding: 8px 10px; border-radius: 10px; background: var(--hover); font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink-2); overflow-wrap: anywhere; }
.v7-co-say b { font-weight: 500; color: var(--ink); }
/* the shared empty state (.mv-empty, v5.css): co's own class is an alias, with the call to action inside, centred */
.v7-co-empty { padding: 14px 16px; border-radius: 12px; border: 1px dashed var(--card-line); text-align: center; font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink-2); margin: 0; }
.v7-co-empty p { margin: 0; }
.v7-co-empty .btn { margin-top: 10px; }
.v7-co-state { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px dashed var(--card-line); font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink-2); }
.v7-co-state > svg { flex: none; }
.v7-co-state .btn { margin-left: auto; }
.v7-co-who { display: flex; gap: 8px; align-items: flex-start; font-size: var(--fs-s); color: var(--ink-2); line-height: var(--lh-body); }
.v7-co-who svg { flex: none; width: 15px; height: 15px; margin-top: 1px; color: var(--ink-3); }

/* the soul journey: the card, its question, and the cards to choose from */
.v7-co-card { display: grid; grid-template-columns: 76px 1fr; gap: 14px; align-items: start; }
.v7-co-card img { width: 76px; aspect-ratio: 120 / 162; object-fit: cover; border-radius: 8px; box-shadow: var(--shadow); background: #2b1d14; }
.v7-co-card .eyebrow { display: block; }
.v7-co-card h4 { margin: 2px 0 2px; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3); line-height: var(--lh-display); color: var(--ink); }
.v7-co-card small { display: block; font-size: var(--fs-s); color: var(--ink-2); line-height: var(--lh-body); }
.v7-co-asks { display: grid; gap: 8px; }
.v7-co-ask { display: grid; grid-template-columns: 20px 1fr; gap: 2px 10px; align-items: start; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-line); background: none; color: var(--ink); min-height: 44px; }
.v7-co-ask i { grid-row: span 2; width: 18px; height: 18px; margin-top: 2px; border-radius: 50%; border: 1.5px solid var(--ink-3); }
.v7-co-ask[aria-checked="true"] { border-color: #B87333; background: rgba(184, 115, 51, .07); }
.v7-co-ask[aria-checked="true"] i { border: 5px solid #B87333; }
.v7-co-ask small { font-size: var(--fs-xs); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.v7-co-ask span { font-family: var(--display); font-size: var(--fs-l); line-height: var(--lh-body); }
.v7-co-q.v7-co-q-s { font-size: var(--fs-l) !important; }
.v7-co-q { font-family: var(--display); font-size: var(--fs-xl) !important; line-height: var(--lh-body); color: var(--ink) !important; border-left: 2px solid #B87333; padding-left: 12px; margin: 0; }
.v7-co-deck { display: grid; grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 8px; }
.v7-co-deck button { display: grid; gap: 4px; padding: 4px; border-radius: 10px; border: 1px solid var(--card-line); background: none; color: var(--ink-2); font-size: var(--fs-xs); line-height: var(--lh-display); text-align: center; }
.v7-co-deck button img { width: 100%; aspect-ratio: 120 / 162; object-fit: cover; border-radius: 6px; }
.v7-co-deck button[aria-pressed="true"] { border-color: var(--ink); color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
.v7-co-modal .field textarea { min-height: 140px; }
.v7-co-modal .field small { font-size: var(--fs-s); color: var(--ink-3); }
.v7-co-modal .field label small { font-size: var(--fs-s); color: var(--ink-3); font-weight: 400; }
.v7-co-modal .check { align-items: flex-start; cursor: pointer; }
.v7-co-modal .check[aria-disabled="true"] { opacity: .6; cursor: default; }
.v7-co-pick { display: flex; flex-wrap: wrap; gap: 6px; }
.v7-co-pick button { height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--card-line); background: none; color: var(--ink); font-size: var(--fs-m); }
.v7-co-pick button[aria-pressed="true"] { background: var(--ink); color: var(--ground); border-color: transparent; }
.v7-co-file { display: grid; gap: 8px; padding: 12px; border-radius: 12px; border: 1px dashed var(--card-line); }
.v7-co-vh { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.v7-co-file .v7-co-pickfile { justify-self: start; cursor: pointer; }
.v7-co-file:focus-within .v7-co-pickfile { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-co-file img { max-width: 100%; max-height: 220px; width: auto; border-radius: 8px; justify-self: start; }
.v7-co-err { color: var(--magenta-ink); font-size: var(--fs-s); margin: 0; }
.v7-co-lab { font-size: var(--fs-m); color: var(--ink-2); font-weight: 500; }

/* Art by camp mates, and a work in it */
.v7-co-works { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 10px; }
.v7-co-work { display: grid; gap: 4px; padding: 0; border: 0; background: none; text-align: left; color: var(--ink); min-width: 0; }
.v7-co-work .v7-co-frame { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: var(--hover); border: 6px solid #6b4a2c; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .25); display: grid; place-items: center; }
.v7-co-work .v7-co-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.v7-co-work .v7-co-frame .v7-co-ln { padding: 10px; font-family: var(--display); font-size: var(--fs-l); line-height: var(--lh-display); text-align: center; color: var(--ink); overflow-wrap: anywhere; }
.v7-co-work .v7-co-frame:not(.has-img) { background: linear-gradient(160deg, rgba(255, 216, 31, .26), var(--hover)); }
.v7-co-work:nth-child(3n+2) .v7-co-frame:not(.has-img) { background: linear-gradient(160deg, rgba(20, 168, 224, .22), var(--hover)); }
.v7-co-work:nth-child(3n) .v7-co-frame:not(.has-img) { background: linear-gradient(160deg, rgba(216, 25, 127, .18), var(--hover)); }
.v7-co-work b { font-weight: 500; font-size: var(--fs-m); line-height: var(--lh-display); overflow-wrap: anywhere; }
.v7-co-work small { font-size: var(--fs-xs); color: var(--ink-3); overflow-wrap: anywhere; }
.v7-co-work:focus-visible .v7-co-frame { outline: 2px solid var(--cyan); outline-offset: 2px; }
.v7-co-big { display: grid; gap: 12px; }
.v7-co-big img { width: 100%; max-height: 60vh; object-fit: contain; border-radius: 12px; background: #0b0a0f; }
.v7-co-big .v7-co-ln { font-family: var(--display); font-size: var(--fs-h3); line-height: var(--lh-display); color: var(--ink); margin: 0; }
.v7-co-miss { font-size: var(--fs-s); color: var(--ink-3); padding: 10px; text-align: center; }
.v7-co-linkart { display: grid; gap: 6px; padding: 18px; border-radius: 12px; border: 8px solid #6b4a2c; background: linear-gradient(160deg, rgba(255, 216, 31, .22), var(--hover)); }
.v7-co-linkart b { font-family: var(--display); font-weight: 400; font-size: var(--fs-h3); line-height: var(--lh-display); color: var(--ink); }

/* Ideas for the Mahalaverse */
.v7-co-ideas { display: grid; gap: 10px; }
.v7-co-idea { display: grid; gap: 8px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--card-line); background: var(--card-strong); }
.v7-co-idea.v7-co-mine { border-color: rgba(184, 115, 51, .45); }
.v7-co-idea.v7-co-off { border-style: dashed; opacity: .8; }
.v7-co-idea h5 { margin: 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); color: var(--ink); overflow-wrap: anywhere; }
.v7-co-idea .v7-co-w { margin: 0; font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink-2); white-space: pre-line; overflow-wrap: anywhere; }
.v7-co-idea .chips .chip { height: 22px; font-size: var(--fs-xs); }
.v7-co-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.v7-co-row .note { margin-left: auto; }
.v7-co-heart { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--card-line); background: none; color: var(--ink-2); font-size: var(--fs-m); }
.v7-co-heart svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.7; }
.v7-co-heart[aria-pressed="true"] { color: var(--magenta-ink); border-color: rgba(216, 25, 127, .35); background: rgba(216, 25, 127, .08); }
.v7-co-heart[aria-pressed="true"] svg { fill: currentColor; }
.v7-co-heart[disabled] { opacity: 1; cursor: default; pointer-events: none; }
.v7-co-replies { display: grid; gap: 6px; padding-left: 12px; border-left: 2px solid var(--card-line); }
.v7-co-reply { display: flex; gap: 6px; align-items: baseline; margin: 0; font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink); overflow-wrap: anywhere; }
.v7-co-reply span { flex: 1; min-width: 0; }
.v7-co-reply small { color: var(--ink-3); font-size: var(--fs-xs); }
.v7-co-reply .iconbtn { width: 32px; height: 32px; }
.v7-co-reply .iconbtn svg { width: 14px; height: 14px; }
.v7-co-reply.v7-co-hid { opacity: .55; }
.v7-co-say-form { display: flex; gap: 6px; }
.v7-co-say-form input { flex: 1; min-width: 0; height: 36px; border-radius: 999px; border: 1px solid var(--card-line); background: var(--ground); padding: 0 12px; color: var(--ink); font: inherit; font-size: var(--fs-m); }
.v7-co-note { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--done-bg); color: var(--ink); font-size: var(--fs-m); line-height: var(--lh-body); overflow-wrap: anywhere; }
.v7-co-note b { font-weight: 500; }
.v7-co-built { display: grid; gap: 8px; padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(255, 216, 31, .16), rgba(20, 168, 224, .10) 55%, rgba(216, 25, 127, .10)); border: 1px solid var(--card-line); }
.v7-co-built h4 { margin: 0; font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); color: var(--ink); }
.v7-co-built ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.v7-co-built li { display: grid; gap: 2px; }
.v7-co-built li b { font-family: var(--display); font-weight: 400; font-size: var(--fs-l); color: var(--ink); overflow-wrap: anywhere; }
.v7-co-built li small { font-size: var(--fs-s); color: var(--ink-2); overflow-wrap: anywhere; }
.v7-co-form { display: grid; gap: 10px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--card-line); background: var(--hover); }
.v7-co-form > b { font-weight: 500; }

/* the stewards' tools */
.v7-co-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.v7-co-counts .v7-co-go { border: 0; cursor: pointer; font: inherit; font-size: var(--fs-xs); font-weight: 500; }
.v7-co-counts .v7-co-go:hover { filter: brightness(.96); }
.v7-co-secbar { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 20px; background: var(--card-strong); border-bottom: 1px solid var(--card-line); position: sticky; top: 0; z-index: 1; }
.v7-co-secbar[hidden] { display: none; }
.v7-co-secbar::-webkit-scrollbar { display: none; }
.v7-co-secbar button { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--card-line); background: none; color: var(--ink-2); font: inherit; font-size: var(--fs-m); cursor: pointer; }
.v7-co-secbar button:hover { background: var(--hover); color: var(--ink); }
.v7-co-secbar button.now { border-color: color-mix(in srgb, var(--now) 45%, transparent); color: var(--ink); }
.v7-co-secbar .chip { height: 20px; padding: 0 7px; font-size: var(--fs-xs); }
.v7-co-sec { scroll-margin-top: 8px; }
.v7-co-sec { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--card-line); }
.v7-co-sec:first-of-type { border-top: 0; padding-top: 0; }
.v7-co-sec > h4 { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3); line-height: var(--lh-display); color: var(--ink); }
.v7-co-sec > h4 .chip { font-family: var(--ui); }
.v7-co-review { display: grid; gap: 8px; padding: 12px; border-radius: 12px; border: 1px dashed var(--card-line); }
.v7-co-review .v7-co-body { margin: 0; font-family: var(--display); font-size: var(--fs-l); line-height: var(--lh-body); color: var(--ink); white-space: pre-line; max-height: 220px; overflow: auto; overflow-wrap: anywhere; padding-right: 4px; }
.v7-co-review .v7-co-body.v7-co-body-s { font-size: var(--fs-m); }
.v7-co-review .v7-co-prev { max-width: 100%; max-height: 240px; border-radius: 8px; justify-self: start; }
.v7-co-review .v7-co-tt { font-family: var(--display); font-weight: 400; font-size: var(--fs-xl); line-height: var(--lh-display); color: var(--ink); overflow-wrap: anywhere; }
.v7-co-review input[type="text"], .v7-co-stw input[type="text"], .v7-co-stw select { height: 38px; border-radius: 10px; border: 1px solid var(--card-line); background: var(--ground); padding: 0 10px; color: var(--ink); font: inherit; font-size: var(--fs-m); min-width: 0; }
.v7-co-review .v7-co-row input[type="text"] { flex: 1 1 220px; }
.v7-co-notef { gap: 4px; }
.v7-co-notef input { height: 38px; border-radius: 10px; border: 1px solid var(--card-line); background: var(--ground); padding: 0 10px; color: var(--ink); font: inherit; font-size: var(--fs-m); }
.v7-co-notef label small { font-weight: 400; color: var(--ink-3); }
.v7-co-fs { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 14px; }
.v7-co-fs[disabled] { opacity: .55; }
.v7-co-meta { font-size: var(--fs-s); color: var(--ink-3); overflow-wrap: anywhere; }
.v7-co-meta b { font-weight: 500; color: var(--ink-2); }
.v7-co-stw { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.v7-co-stw input[type="text"] { flex: 1 1 200px; }
.v7-co-stw > span { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }
.v7-co-app { display: grid; gap: 6px; padding: 12px; border-radius: 12px; border: 1px solid var(--card-line); }
.v7-co-app dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; font-size: var(--fs-m); }
.v7-co-app dt { color: var(--ink-3); }
.v7-co-app dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.v7-co-draft { margin: 0; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--card-line); background: var(--ground); font-size: var(--fs-m); line-height: var(--lh-body); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 360px; overflow: auto; }
.v7-co-other { display: grid; gap: 8px; }
.v7-co-modal .lead-tools { border-style: solid; padding: 12px 14px; }
.v7-co-modal .lead-tools > .eyebrow { display: none; }
.v7-co-modal .lead-tools .sect:first-of-type { margin-top: 0; }
.v7-co-modal details summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; }

/* the way card, the fire, the menu */
.fire-card .fi-lines { align-content: start; }
.v7-co-wayline { margin: 0; font-size: var(--fs-s); color: var(--ink-3); }
.v7-co-wayline button { all: unset; cursor: pointer; color: var(--ink-2); text-decoration: underline; text-decoration-color: var(--card-line); text-underline-offset: 3px; padding: 4px 0; }
.v7-co-wayline button:hover, .v7-co-wayline button:focus-visible { color: var(--ink); text-decoration-color: currentColor; }
.v7-co-wayline button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 4px; }
.way.fold .v7-co-wayline { display: none; }
.topbar #menuBtn { display: grid; }
@media (min-width: 761px) {
  #menuPop.menupop { position: fixed; left: auto; width: 300px; padding: 6px; display: grid; gap: 2px; z-index: 8; }
  #menuPop.menupop[hidden] { display: none; }
  #menuPop.menupop button { display: flex; align-items: center; gap: 10px; width: 100%; height: 40px; padding: 0 12px; border: 0; background: none; border-radius: 10px; text-align: left; font-size: var(--fs-m); color: var(--ink); }
  #menuPop.menupop button:hover, #menuPop.menupop button:focus-visible { background: var(--hover); }
}
#menuPop .v7-co-sep { height: 1px; background: var(--card-line); margin: 4px 6px; }
.menupop .v7-co-m .chip { margin-left: auto; height: 20px; font-size: var(--fs-xs); }
.v7-co-firebox { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; border: 1px dashed var(--card-line); font-size: var(--fs-m); color: var(--ink-2); }
.v7-co-firebox .btn { height: 36px; font-size: var(--fs-m); }

/* inspector cards: the tent's states, the Lotus Mahal's recordings, the camp's way in */
.v7-co-st { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 2px 0 0; font-size: var(--fs-s); color: var(--ink-3); }
.v7-co-st .chip { height: 20px; font-size: var(--fs-xs); }
.v7-co-made .actions { margin-top: 2px; }
/* a long line truncates inside the card, as v5's rows do: no grid track here may grow to fit a line that does not wrap */
.v7-co-lotus, .v7-co-lotus .snd-list, .v7-co-tentcard .sect, .v7-co-tentcard .snd-list { grid-template-columns: minmax(0, 1fr); }
.v7-co-lotus .snd, .v7-co-tentcard .snd { min-width: 0; }

@media (max-width: 760px) {
  .v7-co-choices { grid-template-columns: 1fr; gap: 6px; }
  .v7-co-choice { padding: 10px; grid-template-columns: 30px 1fr; gap: 2px 10px; }
  .v7-co-choice .v7-co-ic { width: 30px; height: 30px; }
  .v7-co-choice small { font-size: var(--fs-s); }
  .v7-co-card { grid-template-columns: 60px 1fr; gap: 12px; }
  .v7-co-card img { width: 60px; }
  .v7-co-works { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .v7-co-modal .sheet-foot .note { max-width: none; flex-basis: 100%; }
  .v7-co-app dl { grid-template-columns: 1fr; }
  .v7-co-app dt { margin-top: 4px; }
  .v7-co-item { grid-template-columns: minmax(0, 1fr); }                /* where it stands goes under the title, which keeps the width */
  .v7-co-item > .chip { justify-self: start; }
  .v7-co-ihead .v7-co-pick.v7-co-scroll { flex: 1 0 100%; }
  .v7-co-pick.v7-co-scroll, .v7-co-secbar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent); }
  .v7-co-pick.v7-co-scroll::-webkit-scrollbar { display: none; }
  .v7-co-pick.v7-co-scroll button { flex: none; }
  .v7-co-secbar { padding: 8px 12px; }
  .v7-co-secbar button, .v7-co-counts .v7-co-go { min-height: 44px; height: 44px; padding: 0 14px; }
  /* every control a finger can find: at least 44 px */
  .v7-co-modal .btn, .v7-co-modal .sheet-foot .btn, .v7-co-dash .btn, .btn.v7-co-sm, .v7-co-made .btn, .v7-co-firebox .btn, .v7-co-lotus .btn, .v7-co-gal .btn { min-height: 44px; height: auto; }
  .v7-co-modal .iconbtn, .v7-co-reply .iconbtn { width: 44px; height: 44px; }
  .v7-co-pick button, .v7-co-heart { height: 44px; min-width: 44px; }
  .v7-co-say-form input, .v7-co-review input[type="text"], .v7-co-notef input, .v7-co-stw input[type="text"], .v7-co-stw select, .v7-co-modal .field input, .v7-co-modal .field select { height: 44px; }
  .v7-co-modal .lead-tools .btn, .v7-co-modal .lead-tools input, .v7-co-modal .lead-tools select { min-height: 44px; height: auto !important; }
  .v7-co-wayline button { padding: 14px 0; display: inline-block; }
  .v7-co-modal details summary { min-height: 44px; }
  .v7-co-deck button { min-height: 44px; }
  .menupop .v7-co-m { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .v7-co-modal * { transition: none !important; animation: none !important; } }
`;
