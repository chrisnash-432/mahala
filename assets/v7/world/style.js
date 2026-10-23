/* The world plugin's styles: one <style id="v7-world-css">, using the game's own variables, so the night sky and the phone
   layout keep working. Light by day; the deep night palette when the sky is dark. */
export const CSS = `
.v7-world-dash-note { color: var(--ink-3); font-size: var(--fs-s, 12.5px); line-height: var(--lh-body, 1.45); margin: 6px 0 0; }
.v7-world-dash-list { list-style: none; margin: 8px 0 10px; padding: 0; display: grid; gap: 4px; }
.v7-world-dash-list small { color: var(--ink-3); }
.v7-world-dash-empty p { margin: 0; }

.v7-world-map {
  --v7w-bg1: #f5eee3; --v7w-bg2: #e6dac8; --v7w-sea: #dce4e3; --v7w-sea-edge: rgba(46, 96, 110, 0.18); --v7w-land: #ecdfc8; --v7w-land-edge: rgba(126, 96, 62, 0.55);
  --v7w-grat: rgba(64, 80, 92, 0.10); --v7w-arc: #1b86a6; --v7w-start: #e2a200; --v7w-first: #b8166c; --v7w-vseed: #0a6a90; --v7w-seed: #d8197f;
  --v7w-label: #2f2822; --v7w-label-halo: rgba(245, 238, 227, 0.92); --v7w-panel: rgba(255, 252, 247, 0.72);
}
body.sky-night .v7-world-map, :root[data-theme="dark"] .v7-world-map {
  --v7w-bg1: #101a3d; --v7w-bg2: #04060f; --v7w-sea: #0c1532; --v7w-sea-edge: rgba(120, 160, 255, 0.22); --v7w-land: #1a2650; --v7w-land-edge: rgba(130, 160, 240, 0.45);
  --v7w-grat: rgba(160, 180, 255, 0.07); --v7w-arc: #62c8ef; --v7w-start: #ffd81f; --v7w-first: #f26fb1; --v7w-vseed: #62c8ef; --v7w-seed: #f26fb1;
  --v7w-label: #ece8f4; --v7w-label-halo: rgba(5, 8, 20, 0.9); --v7w-panel: rgba(16, 20, 40, 0.62);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) body:not(.sky-day) .v7-world-map {
  --v7w-bg1: #101a3d; --v7w-bg2: #04060f; --v7w-sea: #0c1532; --v7w-sea-edge: rgba(120, 160, 255, 0.22); --v7w-land: #1a2650; --v7w-land-edge: rgba(130, 160, 240, 0.45);
  --v7w-grat: rgba(160, 180, 255, 0.07); --v7w-arc: #62c8ef; --v7w-start: #ffd81f; --v7w-first: #f26fb1; --v7w-vseed: #62c8ef; --v7w-seed: #f26fb1;
  --v7w-label: #ece8f4; --v7w-label-halo: rgba(5, 8, 20, 0.9); --v7w-panel: rgba(16, 20, 40, 0.62); } }

.modal.v7-world-map { padding: 0; place-items: stretch; z-index: 45; background: radial-gradient(120% 90% at 55% 40%, var(--v7w-bg1), var(--v7w-bg2)); opacity: 0; transition: opacity .55s ease; }
.modal.v7-world-map.on { opacity: 1; }
.v7-world-wrap { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; color: var(--ink); overflow: hidden; }
.v7-world-head { display: flex; align-items: flex-start; gap: 16px; padding: 22px 22px 6px 28px; }
.v7-world-titles { min-width: 0; }
.v7-world-eye { margin: 0; }
.v7-world-head h2 { margin: 2px 0 6px; font-family: var(--display); font-weight: 400; font-size: var(--fs-h1, clamp(28px, 3vw, 40px)); line-height: var(--lh-display, 1.15); letter-spacing: .01em; }
.v7-world-intro { margin: 0; max-width: 64ch; color: var(--ink-2); font-size: var(--fs-l, 15px); line-height: var(--lh-body, 1.45); }
.v7-world-close { margin-left: auto; }
.v7-world-body { display: grid; grid-template-columns: minmax(0, 1fr) 360px; min-height: 0; }
.v7-world-stage { position: relative; min-height: 0; }
.v7-world-svg { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none;
  transform: translateY(34px) scale(.965); opacity: 0; transition: transform 1s cubic-bezier(.2, .7, .2, 1), opacity .9s ease .1s; }
.v7-world-svg:active { cursor: grabbing; }
.on .v7-world-svg { transform: none; opacity: 1; }
.v7-world-sphere { fill: var(--v7w-sea); stroke: var(--v7w-sea-edge); stroke-width: 1px; }
.v7-world-grat { fill: none; stroke: var(--v7w-grat); stroke-width: 1px; }
.v7-world-land { fill: var(--v7w-land); stroke: var(--v7w-land-edge); stroke-width: .8px; stroke-linejoin: round; }
.v7-world-arc { fill: none; stroke-width: 1.6px; stroke-linecap: round; opacity: 0; transition: opacity 1.4s ease calc(.6s + var(--v7w-i, 0) * .16s); }
.on .v7-world-arc { opacity: .95; }
.v7-world-lead { stroke: var(--ink-3); stroke-width: 1px; }
.v7-world-leaddot { fill: var(--ink-3); }
.v7-world-inset-sea { fill: var(--v7w-sea); }
.v7-world-inset-land { fill: var(--v7w-land); stroke: var(--v7w-land-edge); stroke-width: .25px; }
.v7-world-inset-ring { fill: none; stroke: var(--v7w-start); stroke-width: 1.2px; opacity: .8; }
.v7-world-inset-title { fill: var(--v7w-label); font-family: var(--ui); letter-spacing: .08em; text-transform: uppercase; paint-order: stroke; stroke: var(--v7w-label-halo); stroke-width: 3px; }
.v7-world-inset { transition: opacity .4s ease; }
.v7-world-near .v7-world-inset { opacity: 0; pointer-events: none; visibility: hidden; }
.v7-world-close-sa { display: none; }
.v7-world-near .v7-world-close-sa { display: inline; }
.v7-world-near .v7-world-origin { display: none; }
.v7-world-mark, .v7-world-seed { cursor: pointer; outline: none; }
.v7-world-hit { fill: transparent; stroke: none; }
.v7-world-mark:focus-visible .v7-world-hit, .v7-world-seed:focus-visible .v7-world-hit { stroke: var(--cyan); stroke-width: 2px; }
.v7-world-halo { fill: url(#v7wHalo); }
.v7-world-core { fill: var(--v7w-start); }
.v7-world-pulse { fill: none; stroke: var(--v7w-start); stroke-width: 1.4px; transform-box: fill-box; transform-origin: center; animation: v7wPulse 3.2s ease-out 1.2s 4 both; }
@keyframes v7wPulse { from { transform: scale(1); opacity: .85; } to { transform: scale(3.4); opacity: 0; } }
.v7-world-fhalo { fill: url(#v7wFirstHalo); }
.v7-world-r-first .v7-world-ring { fill: none; stroke: var(--v7w-first); stroke-width: 2.4px; }
.v7-world-r-first .v7-world-core { fill: var(--v7w-first); }
.v7-world-r-seed .v7-world-core { fill: var(--v7w-vseed); }
.v7-world-r-seed .v7-world-seedring { fill: none; stroke: var(--v7w-vseed); stroke-width: 1.3px; stroke-dasharray: 2.4 2.2; opacity: .85; }
.v7-world-label { fill: var(--v7w-label); font-family: var(--ui); font-size: var(--fs-s, 12.5px); font-weight: 500; paint-order: stroke; stroke: var(--v7w-label-halo); stroke-width: 3.2px; stroke-linejoin: round; pointer-events: none; }
.v7-world-r-start .v7-world-label { font-size: var(--fs-m, 13.5px); font-weight: 600; }
.v7-world-mark.sel .v7-world-label { text-decoration: underline; text-underline-offset: 3px; }
.v7-world-mark.sel .v7-world-hit, .v7-world-seed.sel .v7-world-hit { stroke: var(--v7w-label); stroke-width: 1.4px; stroke-dasharray: 3 3; }
.v7-world-shalo { fill: url(#v7wSeedHalo); }
.v7-world-sdot { fill: var(--v7w-seed); stroke: var(--v7w-label-halo); stroke-width: 1px; }
.v7-world-seed.mine .v7-world-sdot { stroke: var(--v7w-label); stroke-width: 1.6px; }
.v7-world-seed.v7-world-empty .v7-world-sdot { fill: none; stroke: var(--v7w-label); stroke-width: 1.4px; stroke-dasharray: 2 2; }
.v7-world-seed.grow .v7-world-sdot, .v7-world-seed.grow .v7-world-shalo { transform-box: fill-box; transform-origin: center; animation: v7wGrow 1.3s cubic-bezier(.2, .8, .3, 1); }
@keyframes v7wGrow { 0% { transform: scale(.15); } 55% { transform: scale(1.7); } 100% { transform: scale(1); } }
.v7-world-tip { position: absolute; left: 0; top: 0; pointer-events: none; padding: 5px 10px; border-radius: 999px; background: var(--card-strong); color: var(--ink); border: 1px solid var(--card-line); box-shadow: var(--shadow); font-size: var(--fs-s, 12.5px); white-space: nowrap; z-index: 2; }
.v7-world-zoom { position: absolute; right: 12px; bottom: 14px; display: grid; gap: 6px; }
.v7-world-zoom .iconbtn { background: var(--card-strong); border: 1px solid var(--card-line); box-shadow: var(--shadow); color: var(--ink); }
.v7-world-panel { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 16px; padding: 6px 22px 28px 6px; }
.v7-world-panel > * { background: var(--v7w-panel); border: 1px solid var(--card-line); border-radius: 16px; padding: 14px 16px; }
.v7-world-panel > .v7-world-live { background: none; border: 0; padding: 0; margin: 0; min-height: 1px; font-size: var(--fs-s, 12.5px); color: var(--ink-2); }
.v7-world-panel h3 { margin: 2px 0 6px; font-family: var(--display); font-weight: 400; font-size: var(--fs-h3, 22px); line-height: var(--lh-display, 1.15); }
.v7-world-panel p { margin: 0 0 8px; line-height: var(--lh-body, 1.45); }
.v7-world-card .eyebrow { margin: 0 0 2px; }
.v7-world-where { color: var(--ink-3); font-size: var(--fs-m, 13.5px); margin-top: -4px !important; }
.v7-world-count { font-weight: 500; }
.v7-world-count.none { color: var(--ink-3); font-weight: 400; }
.v7-world-note { color: var(--ink-2); font-size: var(--fs-m, 13.5px); }
.v7-world-panel p.v7-world-none { margin: 0; padding: 10px 12px; }
.v7-world-strong { color: var(--ink); }
.v7-world-panel .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }
.v7-world-field { display: grid; gap: 5px; margin: 6px 0 0; }
.v7-world-field label { font-size: var(--fs-s, 12.5px); color: var(--ink-2); }
.v7-world-field input { height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--card-line); background: var(--card-strong); color: var(--ink); font: inherit; }
.v7-world-res { list-style: none; margin: 6px 0 0; padding: 4px; border: 1px solid var(--card-line); border-radius: 12px; background: var(--card-strong); max-height: 260px; overflow: auto; }
.v7-world-res li { display: grid; gap: 1px; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.v7-world-res li[aria-selected="true"], .v7-world-res li[data-place]:hover { background: var(--hover); }
.v7-world-res small, .v7-world-minelist small { color: var(--ink-3); font-size: var(--fs-s, 12.5px); }
.v7-world-res .v7-world-nores { cursor: default; color: var(--ink-2); font-size: var(--fs-m, 13.5px); }
.v7-world-mine { margin-top: 12px; }
.v7-world-mine h4 { margin: 0 0 6px; }
.v7-world-minelist { list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 4px; }
.v7-world-minelist li { display: flex; align-items: center; gap: 6px; }
.v7-world-minego { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; text-align: left; padding: 7px 8px; border-radius: 10px; border: 0; background: none; color: var(--ink); }
.v7-world-minego:hover { background: var(--hover); }
.v7-world-minego .i { color: var(--v7w-seed); align-self: center; }
.v7-world-vlist { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 2px; }
.v7-world-vrow { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 7px 8px; border: 0; border-radius: 10px; background: none; color: var(--ink); }
.v7-world-vrow:hover { background: var(--hover); }
.v7-world-vrow span:last-child { display: grid; }
.v7-world-vrow small { color: var(--ink-3); font-size: var(--fs-s, 12.5px); }
.v7-world-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; border: 1.4px dashed var(--v7w-vseed); }
.v7-world-r-start .v7-world-dot { border: 0; background: var(--v7w-start); box-shadow: 0 0 0 4px color-mix(in srgb, var(--v7w-start) 25%, transparent); }
.v7-world-r-first .v7-world-dot { border: 2px solid var(--v7w-first); background: radial-gradient(circle, var(--v7w-first) 35%, transparent 40%); }
body.v7-world-on #labels, body.v7-world-on #tip { visibility: hidden; }
@media (max-width: 760px) {
  .v7-world-head { padding: 14px 12px 4px 16px; }
  .v7-world-intro { font-size: var(--fs-m, 13.5px); }
  .v7-world-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(250px, 44vh) minmax(0, 1fr); }
  .v7-world-panel { padding: 12px 16px 28px; gap: 12px; border-top: 1px solid var(--card-line); }
  .v7-world-zoom { right: 10px; bottom: 10px; }
  .v7-world-label { font-size: var(--fs-s, 12.5px); }
}
@media (prefers-reduced-motion: reduce) {
  .modal.v7-world-map, .v7-world-svg, .v7-world-arc, .v7-world-inset { transition: none; }
  .v7-world-svg { transform: none; }
  .v7-world-pulse { animation: none; opacity: 0; }
}
`;
