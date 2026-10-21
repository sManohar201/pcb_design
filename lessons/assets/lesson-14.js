/* Lesson 14 — Final challenge: review a bad board */
(function () {
  'use strict';
  const { el, svg, setAttrs, seg, check, meters, verdicts, explain, lab, sig, clamp, geo } = PCB;
  PCB.renderChrome({ lesson: 14 });
  const host = document.getElementById('lab-review'); if (!host) return;
  const PX = 5, OX = 20, OY = 20, BW = 120, BH = 90;
  const X = v => OX + v * PX, Y = v => OY + v * PX;
  const P = p => ({ x: X(p[0]), y: Y(p[1]) });

  /* ---------------------------------------------------------- the issues */
  const ISSUES = [
    { id: 'cin', layers: ['top'], hits: [[12, 74, 5], [14, 67, 3.5]], area: 'the buck converter', t: 'Buck input capacitor far from the IC', w: 'C_IN sits 13 mm from the VIN pin on a thin trace. The hot loop (C_IN → high-side switch → low-side → GND → C_IN) now encloses a large area with several nH.', c: 'Switch-node ringing, voltage spikes on VIN and strong radiated emission at the ringing frequency.', f: 'Put C_IN directly against VIN and PGND, on the same side as the IC (ROHM §2.1).', l: ['lesson-06.html#layout', '6.2'] },
    { id: 'fb', layers: ['top'], hits: [[27.5, 63.5, 4.5]], area: 'the buck converter', t: 'Feedback trace under the inductor', w: 'The feedback line from the output to the FB divider runs through the inductor\'s footprint, right next to the switch node.', c: 'The inductor\'s field and switch-node edges couple into the most sensitive, high-impedance node: output jitter, noise, even instability.', f: 'Sense at the output capacitor and route the feedback away from the inductor and SW copper, with the divider close to the FB pin.', l: ['lesson-06.html#layout', '6.2'] },
    { id: 'slot', layers: ['gnd'], hits: [[40, 64, 5]], area: 'the USB 3 route', t: 'Slot in the GND plane under USB 3', w: 'A row of merged anti-pads has cut a 14 mm slot in L2, and the USB 3 pairs on L1 run straight across it.', c: 'The return current must detour around the slot: a big loop, an impedance bump and common-mode radiation on a 5 Gb/s link.', f: 'Space the vias so copper remains between the anti-pads (or move them), keeping L2 continuous under every fast route.', l: ['lesson-03.html#plane', '3.2'] },
    { id: 'esd', layers: ['top'], hits: [[40.5, 55, 4]], area: 'the USB 3 route', t: 'ESD protection at the wrong end', w: 'The USB ESD diodes sit next to the module, 25 mm from the connector.', c: 'A discharge travels the whole route (radiating into everything nearby) before it is clamped, and the trace inductance raises the clamp voltage the module sees.', f: 'Place ESD parts right at the connector pins, before anything else, with a short, direct ground connection (Sierra §7.2.10).', l: ['lesson-04.html#chassis', '4.4'] },
    { id: 'serp', layers: ['top'], hits: [[90, 69, 4]], area: 'the HDMI/DP route', t: 'Skew fixed at the wrong end', w: 'The DP pair picks up its P/N mismatch at the first bend near the module, but the compensating serpentine sits near the HDMI connector.', c: 'P and N run out of step for most of the route: common-mode conversion and EMI, even though the total lengths match.', f: 'Compensate within a few mm of where the mismatch starts (Sierra: match per segment).', l: ['lesson-08.html#route', '8.2'] },
    { id: 'stitch', layers: ['top', 'bot'], hits: [[78, 54, 4], [106, 36, 4]], area: 'the camera (CSI) route', t: 'Layer change with no return vias', w: 'The CSI pairs drop from L1 to L4 and back again, with no ground via anywhere near the signal vias.', c: 'Each layer change moves the return current to a different plane, and it has no nearby path to follow: a big loop, impedance discontinuity and noise injected into the planes.', f: 'Put a ground stitching via (or a pair) right beside each signal via pair, or avoid the layer change.', l: ['lesson-03.html#layers', '3.4'] },
    { id: 'decap', layers: ['top'], hits: [[95, 74.5, 4]], area: 'the audio codec', t: 'Decoupling capacitor on a long trace', w: 'The codec\'s supply capacitor is 6 mm away on a thin trace, and its via is farther still.', c: 'Several nH of mounting inductance: above a few MHz the capacitor does nothing, and the codec\'s supply noise ends up in the audio.', f: 'Put the capacitor at the pin, with vias right at its pads (short, wide connections).', l: ['lesson-05.html#mounting', '5.2'] },
    { id: 'pwr', layers: ['top'], hits: [[32, 54.5, 3.8]], area: 'the 5 V feed to the module', t: '5 V module feed is a thin trace', w: 'Several amps for the module flow through a 0.25 mm trace from the buck output to the module power pins.', c: 'IR drop at the module input, a hot trace (IPC: far beyond a safe temperature rise), and higher loop inductance for the load steps.', f: 'Use a wide pour (or a plane region) with multiple vias, sized for the current (lesson 1, IPC-2221).', l: ['lesson-01.html#resistance', '1.1'] },
    { id: 'rj45', layers: ['gnd'], hits: [[74, 85, 6]], area: 'the Ethernet connector', t: 'GND plane under the Ethernet isolation area', w: 'L2 runs solidly under the RJ45 and the line side of its magnetics.', c: 'The plane couples cable-side common-mode noise straight past the transformer\'s isolation, both onto the cable (EMI) and in from it (ESD, surges).', f: 'Void the planes under the line side of the magnetics and the connector; tie the connector shield to chassis instead (Sierra §7.2.9).', l: ['lesson-04.html#chassis', '4.4'] },
    { id: 'split', layers: ['pwr', 'bot'], hits: [[92, 54, 4]], area: 'the camera (CSI) route', t: 'Bottom-layer pair crosses a power-island split', w: 'On L4 the CSI pairs reference L3, and they cross from the 3.3 V island onto the 1.8 V island.', c: 'At the gap the return current has no path except through distant decoupling capacitors: an impedance step and a radiating loop.', f: 'Shape the islands so fast routes stay over one island, route on a layer next to GND, or add stitching capacitors where they cross.', l: ['lesson-03.html#plane', '3.2'] },
    { id: 'xtalk', layers: ['top'], hits: [[40, 71, 3.5]], area: 'the USB 3 route', t: 'USB TX and RX pairs packed together', w: 'The USB 3 transmit and receive pairs run side by side for 25 mm with less than one trace width between pairs.', c: 'Near-end crosstalk from the strong TX into the weak RX at the connector end: the worst place for it. Bit errors, link retraining.', f: 'Keep TX and RX pairs well apart (several W, more than inside a pair), or put a stitched ground between them.', l: ['lesson-08.html#coupling', '8.3'] },
    { id: 'edge', layers: ['top'], hits: [[1, 77, 4]], area: 'the left board edge', t: 'Trace at the board edge', w: 'The fan-power trace runs 0.1 mm from the routed outline.', c: 'Outline routing can nick or expose it, it may short to a metal enclosure, and the fab will flag (or refuse) it.', f: 'Keep copper ≥ 0.3 mm (fab-dependent) from routed edges, more near V-scores and metal standoffs.', l: ['lesson-13.html#fab', '13.1'] },
    { id: 'heat', layers: ['top'], hits: [[27, 71.5, 3.8]], area: 'the buck converter', t: 'Electrolytic cap next to the hot spot', w: 'The bulk electrolytic sits against the buck inductor and IC, the warmest place on the board.', c: 'Electrolytic life halves for every 10 °C: this placement costs years of service life.', f: 'Move the bulk capacitor to the cool input side (by the DC jack), away from regulators.', l: ['lesson-12.html#thermal', '12.3'] },
  ];
  const AREAS = {};
  ISSUES.forEach(i => { AREAS[i.id] = i.hits[0]; });

  /* ---------------------------------------------------------- state */
  const saved = PCB.store.get('final14', { found: {}, fixed: {}, miss: 0 });
  const st = { view: 'top', found: saved.found || {}, fixed: saved.fixed || {}, miss: saved.miss || 0, flash: null, hintId: null };
  const persist = () => PCB.store.set('final14', { found: st.found, fixed: st.fixed, miss: st.miss });
  const F = id => !!st.fixed[id];

  const L = lab(host, { title: 'Carrier board, rev A: find the mistakes', stack: true });
  const sV = seg({ label: 'Layer view', options: [{ v: 'top', label: 'L1 top' }, { v: 'gnd', label: 'L2 GND' }, { v: 'pwr', label: 'L3 power' }, { v: 'bot', label: 'L4 bottom' }, { v: 'all', label: 'All (x-ray)' }], value: st.view, onChange: v => { st.view = v; draw(); } });
  const hintBtn = el('button', { class: 'btn', onclick: hint }, 'Hint');
  const fixAll = check({ label: 'Show the fixed board (all found issues)', onChange: v => { ISSUES.forEach(i => { if (st.found[i.id]) st.fixed[i.id] = v; }); persist(); draw(); list(); } });
  const reveal = el('button', { class: 'btn', onclick: () => { ISSUES.forEach(i => { if (!st.found[i.id]) st.found[i.id] = 'revealed'; }); persist(); draw(); list(); } }, 'Reveal all');
  const reset = el('button', { class: 'btn', onclick: () => { st.found = {}; st.fixed = {}; st.miss = 0; fixAll.set(false); persist(); draw(); list(); } }, 'Start over');
  const hintTxt = el('div', { class: 'hint' });
  L.controls.append(sV.el, el('div', { class: 'btn-row', style: { alignItems: 'flex-end' } }, hintBtn, reveal, reset), fixAll.el);
  Object.assign(L.controls.style, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 18px', border: '0', padding: '2px 2px 0' });
  L.stage.append(L.controls, hintTxt);
  const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX + 2 * OX} ${BH * PX + 2 * OY + 6}`, style: 'cursor:crosshair' });
  const gBoard = svg('g'), gMk = svg('g');
  S.append(gBoard, gMk);
  L.stage.append(S);
  const M = meters(L.stage, [{ key: 'f', label: 'Found', bar: true }, { key: 'm', label: 'Misses' }, { key: 'r', label: 'Revealed' }, { key: 's', label: 'Score' }]);
  const V = verdicts(L.left, 'Last click');
  const E = explain(L.right, 'Review tips');
  E.set('<p>Review like a checker: follow the <b>current</b>, not the copper. For each power loop, where is the hot loop? For each fast route, where is its return path on every layer it touches? Which way does a discharge travel from each connector?</p><p>Then look at each plane layer on its own: slots, splits, voids and islands are invisible from the top layer.</p>');
  V.set([{ level: 'info', html: 'Click anywhere on the board you think is wrong.' }]);

  /* ---------------------------------------------------------- drawing helpers */
  function poly(g, pts, w, c, extra = {}) { g.append(svg('path', Object.assign({ d: geo.pathD(pts.map(P)), fill: 'none', stroke: c, 'stroke-width': w * PX, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, extra))); }
  function rect(g, x0, y0, x1, y1, fill, extra = {}) { g.append(svg('rect', Object.assign({ x: X(x0), y: Y(y0), width: (x1 - x0) * PX, height: (y1 - y0) * PX, fill }, extra))); }
  function circ(g, x, y, r, fill, extra = {}) { g.append(svg('circle', Object.assign({ cx: X(x), cy: Y(y), r: r * PX, fill }, extra))); }
  function text(g, x, y, t, extra = {}) { g.append(svg('text', Object.assign({ x: X(x), y: Y(y), fill: 'var(--silk)', 'font-size': 10, 'text-anchor': 'middle', text: t }, extra))); }
  function offset(pts, d) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const n1 = i > 0 ? norm(pts[i - 1], p) : norm(p, b), n2 = i < pts.length - 1 ? norm(p, pts[i + 1]) : n1;
      let nx = n1[0] + n2[0], ny = n1[1] + n2[1]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const k = d / Math.max(0.5, nx * n1[0] + ny * n1[1]);
      void a; void b;
      return [p[0] + nx * k, p[1] + ny * k];
    });
  }
  function norm(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [-dy / m, dx / m]; }
  function pair(g, pts, gap, w, c1, c2) { poly(g, offset(pts, gap / 2), w, c1); poly(g, offset(pts, -gap / 2), w, c2 || c1); }
  function via(g, x, y, c = '#e0a64a', r = 0.45) { circ(g, x, y, r, c); circ(g, x, y, r * 0.45, '#111'); }

  const CU = '#e0a64a', BOT = '#5cb8ff', GNDC = '#2f9a64', SILK = 'var(--silk)';

  /* ---------------------------------------------------------- layers */
  function layerGnd(g, op) {
    const G = svg('g', { opacity: op }); g.append(G);
    rect(G, 0.5, 0.5, BW - 0.5, BH - 0.5, GNDC, { rx: 6 });
    // anti-pads row / slot
    if (F('slot')) { for (let x = 34; x <= 46; x += 2) circ(G, x, 64, 0.55, '#0b2a1e'); }
    else rect(G, 33.3, 63.2, 46.7, 64.8, '#0b2a1e', { rx: 4 });
    if (F('rj45')) { rect(G, 66, 80, 82, 90, '#0b2a1e'); text(G, 74, 86, 'void (isolation)', { fill: '#9fb5a8', 'font-size': 9.5 }); }
    // anti-pads for connector through-holes
    for (let x = 68; x <= 80; x += 2) circ(G, x, 76, 0.5, '#0b2a1e');
    for (const [x, y] of [[4, 4], [116, 4], [4, 86], [116, 86]]) circ(G, x, y, 2.2, '#0b2a1e');
    if (op === 1) text(G, 60, 30, 'L2 · GND plane', { fill: '#cfe0d5', 'font-size': 13, 'font-weight': 650 });
  }
  function layerPwr(g, op) {
    const G = svg('g', { opacity: op }); g.append(G);
    rect(G, 1, 1, 36.5, 89, '#a13b4e', { rx: 4 }); // 5 V
    rect(G, 38, 1, 119, 89, '#8a3b4a', { rx: 4 }); // 3.3 V
    if (F('split')) rect(G, 96, 60, 119, 89, '#6c4a9a', { rx: 3, stroke: '#0b2a1e', 'stroke-width': 4 });
    else rect(G, 92, 40, 119, 70, '#6c4a9a', { rx: 3, stroke: '#0b2a1e', 'stroke-width': 4 });
    for (const [x, y] of [[4, 4], [116, 4], [4, 86], [116, 86]]) circ(G, x, y, 2.2, '#0b2a1e');
    if (op === 1) {
      text(G, 18, 30, '5 V', { fill: '#ffd2cb', 'font-size': 13, 'font-weight': 650 });
      text(G, 62, 30, '3.3 V', { fill: '#ffd2cb', 'font-size': 13, 'font-weight': 650 });
      text(G, F('split') ? 107 : 105, F('split') ? 80 : 66, '1.8 V', { fill: '#e2d4ff', 'font-size': 13, 'font-weight': 650 });
      text(G, 60, 12, 'L3 · power islands (seen from the top)', { fill: '#ffd2cb', 'font-size': 11 });
    }
  }
  function layerBot(g, op) {
    const G = svg('g', { opacity: op }); g.append(G);
    // CSI pair on L4
    pair(G, [[78, 54], [98, 54], [106, 46], [106, 36]], 0.8, 0.34, BOT);
    // a few unrelated bottom routes
    poly(G, [[20, 52], [20, 45], [10, 35], [10, 20]], 0.25, BOT, { opacity: 0.7 });
    poly(G, [[56, 52], [56, 46], [50, 40], [30, 40]], 0.25, BOT, { opacity: 0.7 });
    poly(G, [[86, 52], [86, 48], [92, 42], [92, 30]], 0.25, BOT, { opacity: 0.7 });
    if (op === 1) text(G, 60, 30, 'L4 · bottom signals (reference plane: L3)', { fill: '#cfe7ff', 'font-size': 12, 'font-weight': 650 });
  }
  function partsOutline(g, op) {
    const G = svg('g', { opacity: op }); g.append(G);
    const o = { fill: 'none', stroke: SILK, 'stroke-width': 1 };
    [[0, 57, 9, 68], [16, 58, 21, 63], [24, 57, 31, 64], [29, 78, 43, 90], [44, 58, 66, 72], [66, 73, 82, 90], [84.5, 79, 99.5, 90], [112, 24, 120, 42], [100, 60, 110, 70], [101, 79, 112, 90], [28, 47, 92, 51]].forEach(r => rect(G, r[0], r[1], r[2], r[3], 'none', o));
  }
  function layerTop(g, op) {
    const G = svg('g', { opacity: op }); g.append(G);
    // module outline & connector
    rect(G, 25, 6, 95, 51, 'none', { stroke: SILK, 'stroke-dasharray': '6 4', opacity: 0.6, rx: 5 });
    text(G, 60, 26, 'MODULE (mounts above)', { 'font-size': 12, opacity: 0.7 });
    rect(G, 28, 47, 92, 51, '#0b0f0d', { stroke: SILK });
    // stitching vias around the edge
    for (let x = 10; x <= 110; x += 6) { via(G, x, 2, '#7fbf95', 0.35); }
    for (let y = 12; y <= 80; y += 6) { if (y < 66 || y > 88) via(G, 118, y, '#7fbf95', 0.35); }
    // ---- power entry & buck
    rect(G, 0, 57, 9, 68, '#3a3f44', { stroke: SILK }); text(G, 4.5, 63.5, 'DC', {});
    poly(G, [[9, 60], [16, 60]], 1.5, CU);
    rect(G, 16, 58, 21, 63, '#141a17', { stroke: SILK }); text(G, 18.5, 61.2, 'U1', { 'font-size': 9 });
    poly(G, [[21, 60.5], [24, 60.5]], 1.6, '#ffd166');
    rect(G, 24, 57, 31, 64, '#3a3f44', { stroke: SILK }); text(G, 27.5, 61, 'L1', {});
    rect(G, 33, 58.5, 35, 62.5, '#b9a37a', { stroke: SILK }); text(G, 34, 57.6, 'C_OUT', { 'font-size': 8 });
    poly(G, [[31, 60.5], [33, 60.5]], 1.6, CU);
    // C_IN
    if (F('cin')) { rect(G, 13.4, 58.2, 15.4, 61.8, '#b9a37a', { stroke: '#77d48b', 'stroke-width': 1.5 }); }
    else { poly(G, [[16, 59], [14.2, 59], [14.2, 72], [13, 72]], 0.25, CU); rect(G, 11, 72, 13, 76, '#b9a37a', { stroke: SILK }); text(G, 12, 78.5, 'C_IN', { 'font-size': 8 }); }
    // feedback
    if (F('fb')) { poly(G, [[34, 62.5], [34, 67], [18.5, 67], [18.5, 63]], 0.2, '#5cb8ff'); rect(G, 17.2, 64.5, 19.8, 65.7, '#1d2a33', { stroke: '#77d48b' }); }
    else { poly(G, [[34, 62.5], [27.5, 62.5], [27.5, 66], [18.5, 66], [18.5, 63]], 0.2, '#5cb8ff'); rect(G, 22, 65.4, 24.6, 66.6, '#1d2a33', { stroke: SILK }); }
    // bulk electrolytic
    if (F('heat')) { circ(G, 6, 80, 3, '#2f3b48', { stroke: '#77d48b', 'stroke-width': 1.5 }); text(G, 6, 81, 'C_BULK', { 'font-size': 7.5 }); }
    else { circ(G, 27, 71.5, 2.8, '#2f3b48', { stroke: SILK }); text(G, 27, 72.5, 'C_BULK', { 'font-size': 7.5 }); }
    // 5 V to module
    if (F('pwr')) { rect(G, 30, 51, 34.5, 58.5, CU, { opacity: 0.9 }); for (let y = 53; y <= 57; y += 2) { via(G, 31, y); via(G, 33.5, y); } }
    else poly(G, [[34, 58.5], [34, 56], [32, 54], [32, 51]], 0.25, CU);
    // fan header + edge trace
    rect(G, 14, 82, 22, 88, '#1d2a33', { stroke: SILK }); text(G, 18, 86, 'FAN', { 'font-size': 8.5 });
    const ex = F('edge') ? 1.5 : 0.4;
    poly(G, [[14, 85], [ex, 85], [ex, 68.5], [3, 68.5]], 0.25, CU);
    // ---- USB 3
    rect(G, 29, 78, 43, 90, '#2f3b48', { stroke: SILK }); text(G, 36, 86, 'USB 3', {});
    if (F('xtalk')) { pair(G, [[39, 51], [39, 53], [37.9, 55], [37.9, 78]], 0.8, 0.32, CU); pair(G, [[41, 51], [41, 53], [41.9, 55], [41.9, 78]], 0.8, 0.32, CU); for (let y = 58; y <= 76; y += 4) via(G, 39.9, y, '#7fbf95', 0.35); }
    else { pair(G, [[39.5, 51], [39.2, 78]], 0.8, 0.32, CU); pair(G, [[41, 51], [40.7, 78]], 0.8, 0.32, CU); }
    if (F('esd')) { rect(G, 36.5, 74, 43.2, 76.2, '#141a17', { stroke: '#77d48b', 'stroke-width': 1.5 }); text(G, 39.8, 75.6, 'ESD', { 'font-size': 7.5 }); }
    else { rect(G, 38, 54, 43, 56.2, '#141a17', { stroke: SILK }); text(G, 40.5, 55.6, 'ESD', { 'font-size': 7.5 }); }
    // ---- M.2 / PCIe (correct)
    rect(G, 44, 58, 66, 72, '#26323a', { stroke: SILK }); text(G, 55, 66, 'M.2 (PCIe)', {});
    pair(G, [[50, 51], [50, 58]], 0.8, 0.32, CU); pair(G, [[52, 51], [52, 58]], 0.8, 0.32, CU);
    for (const x of [45, 56, 83]) { rect(G, x - 0.6, 52.2, x + 0.6, 53.4, '#b9a37a'); via(G, x, 54.2, '#7fbf95', 0.35); }
    // ---- Ethernet
    rect(G, 66, 73, 82, 90, '#2f3b48', { stroke: SILK }); text(G, 74, 82, 'RJ45 +', {}); text(G, 74, 85, 'magnetics', {});
    pair(G, [[60, 51], [60, 54], [68, 54], [74, 60], [74, 73]], 0.8, 0.32, CU);
    // ---- DP / HDMI
    rect(G, 84.5, 79, 99.5, 90, '#2f3b48', { stroke: SILK }); text(G, 92, 86, 'HDMI', {});
    pair(G, [[69, 51], [69, 53], [80, 64], [90, 64], [90, 79]], 0.8, 0.32, CU);
    // serpentine
    const serp = (x0, y0, y1, side) => { const pts = []; for (let y = y0, k = 0; y <= y1; y += 1, k++) pts.push([x0 + (k % 2 ? side * 1.1 : 0), y], [x0 + (k % 2 ? side * 1.1 : 0), y + 1]); return pts; };
    if (F('serp')) poly(G, serp(71.5, 54.5, 57, -1), 0.22, '#ffd166');
    else poly(G, serp(90.3, 66, 72, 1), 0.22, '#ffd166');
    // ---- CSI
    rect(G, 112, 24, 120, 42, '#2f3b48', { stroke: SILK }); text(G, 116, 34, 'CSI', { 'font-size': 9 });
    pair(G, [[78, 51], [78, 54]], 0.9, 0.32, CU); pair(G, [[106, 36], [112, 36]], 0.9, 0.32, CU);
    for (const [x, y] of [[78, 53.6], [78, 54.4], [106, 35.6], [106, 36.4]]) via(G, x, y);
    if (F('stitch')) for (const [x, y] of [[76.7, 54], [79.3, 54], [106, 34.3], [106, 37.7]]) via(G, x, y, '#7fbf95');
    // ---- audio
    rect(G, 100, 60, 110, 70, '#2d4234', { stroke: SILK }); text(G, 105, 65.5, 'CODEC', { 'font-size': 9 });
    rect(G, 101, 79, 112, 90, '#2d4234', { stroke: SILK }); text(G, 106.5, 85, 'AUDIO', { 'font-size': 9 });
    poly(G, [[88, 51], [88, 56], [97, 56], [100, 61]], 0.2, CU);
    poly(G, [[106, 79], [106, 70]], 0.2, CU);
    if (F('decap')) { rect(G, 110.5, 61, 111.7, 62.8, '#b9a37a', { stroke: '#77d48b' }); via(G, 112.6, 61.9, '#7fbf95', 0.35); }
    else { rect(G, 94.4, 73.8, 95.6, 75.2, '#b9a37a'); poly(G, [[95.6, 74.2], [100, 69.5]], 0.15, CU); poly(G, [[94.6, 75.2], [93, 77.5]], 0.15, CU); via(G, 93, 77.8, '#7fbf95', 0.35); }
    // mounting holes
    for (const [x, y] of [[4, 4], [116, 4], [4, 86], [116, 86]]) { circ(G, x, y, 2.2, '#c9d1d6'); circ(G, x, y, 1.3, '#222'); }
  }

  function draw() {
    gBoard.innerHTML = '';
    gBoard.append(svg('rect', { x: X(0), y: Y(0), width: BW * PX, height: BH * PX, rx: 8, fill: '#0f3526', stroke: '#2f6b51', 'stroke-width': 2 }));
    const v = st.view;
    // each plane view shows, faintly, the signal layer that references it
    if (v === 'gnd') { layerGnd(gBoard, 1); layerTop(gBoard, 0.3); }
    if (v === 'pwr') { layerPwr(gBoard, 1); layerBot(gBoard, 0.55); partsOutline(gBoard, 0.25); }
    if (v === 'bot') { layerPwr(gBoard, 0.2); layerBot(gBoard, 1); partsOutline(gBoard, 0.25); }
    if (v === 'top') layerTop(gBoard, 1);
    if (v === 'all') { layerGnd(gBoard, 0.28); layerPwr(gBoard, 0.22); layerBot(gBoard, 0.8); layerTop(gBoard, 1); }
    gBoard.append(svg('text', { x: X(BW), y: Y(BH) + 16, 'text-anchor': 'end', fill: '#9fb5a8', 'font-size': 10.5, text: { top: 'Viewing L1 (top)', gnd: 'Viewing L2 (GND)', pwr: 'Viewing L3 (power)', bot: 'Viewing L4 (bottom), seen through the board', all: 'X-ray: all layers' }[v] }));
    marks();
  }
  function marks() {
    gMk.innerHTML = '';
    ISSUES.forEach((iss, n) => {
      if (!st.found[iss.id]) return;
      const [x, y] = iss.hits[0];
      const fixed = F(iss.id), rev = st.found[iss.id] === 'revealed';
      gMk.append(svg('circle', { cx: X(x), cy: Y(y), r: 13, fill: fixed ? 'rgba(119,212,139,.25)' : 'rgba(255,107,91,.22)', stroke: fixed ? '#77d48b' : rev ? '#ffd166' : '#ff6b5b', 'stroke-width': 2, 'stroke-dasharray': rev ? '4 3' : null }), svg('text', { x: X(x), y: Y(y) + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 700, style: 'paint-order:stroke', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3, text: fixed ? '✓' : String(n + 1) }));
    });
    if (st.flash) gMk.append(st.flash);
  }
  const visible = iss => st.view === 'all' || iss.layers.includes(st.view);
  S.addEventListener('click', e => {
    const p = PCB.svgPoint(S, e);
    const mx = (p.x - OX) / PX, my = (p.y - OY) / PX;
    if (mx < 0 || my < 0 || mx > BW || my > BH) return;
    let best = null, bd = Infinity;
    for (const iss of ISSUES) {
      if (!visible(iss)) continue;
      for (const [hx, hy, r] of iss.hits) { const d = Math.hypot(mx - hx, my - hy); if (d <= r && d < bd) { bd = d; best = iss; } }
    }
    if (best && !st.found[best.id]) {
      st.found[best.id] = 'found'; persist();
      const n = ISSUES.indexOf(best) + 1;
      V.set([{ level: 'good', html: `<b>#${n} found: ${best.t}.</b> ${best.w}` }]);
      st.flash = null; draw(); list(); score();
      document.getElementById('f-' + best.id)?.animate?.([{ background: 'var(--good-soft)' }, { background: 'var(--surface)' }], { duration: 1600 });
      return;
    }
    if (best) { V.set([{ level: 'info', html: `Already found: #${ISSUES.indexOf(best) + 1} ${best.t}.` }]); return; }
    // nearby on another layer?
    let other = null;
    for (const iss of ISSUES) if (!st.found[iss.id] && !visible(iss)) for (const [hx, hy, r] of iss.hits) if (Math.hypot(mx - hx, my - hy) <= r) other = iss;
    st.miss++; persist();
    V.set([{ level: 'warn', html: other ? `Nothing wrong on <b>this</b> layer here, but you are close to something. Try another layer view.` : 'Nothing wrong here (that counts as a miss). Look for current loops, return paths, connector-side protection and plane shapes.' }]);
    st.flash = svg('text', { x: p.x, y: p.y + 5, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 16, 'font-weight': 800, text: '✕' });
    const f = st.flash; marks(); score();
    setTimeout(() => { if (st.flash === f) { st.flash = null; marks(); } }, 900);
  });
  function hint() {
    const left = ISSUES.filter(i => !st.found[i.id]);
    if (!left.length) { hintTxt.textContent = 'Nothing left to find.'; return; }
    const iss = left[Math.floor(Math.random() * left.length)];
    const lay = { top: 'L1 top', gnd: 'L2 GND', pwr: 'L3 power', bot: 'L4 bottom' };
    hintTxt.textContent = `Hint: look around ${iss.area}, on ${iss.layers.map(l => lay[l]).join(' or ')}.`;
    const [x, y] = iss.hits[0];
    st.flash = svg('circle', { cx: X(x + 3), cy: Y(y - 2), r: 70, fill: 'rgba(255,209,102,.12)', stroke: '#ffd166', 'stroke-width': 2, 'stroke-dasharray': '6 5' });
    const f = st.flash; marks();
    setTimeout(() => { if (st.flash === f) { st.flash = null; marks(); } }, 2500);
  }
  function score() {
    const found = ISSUES.filter(i => st.found[i.id] === 'found').length, rev = ISSUES.filter(i => st.found[i.id] === 'revealed').length;
    const sc = Math.max(0, found * 10 - st.miss * 2);
    M.set('f', `${found + rev} / ${ISSUES.length}`, found + rev === ISSUES.length ? 'good' : 'warn', (found + rev) / ISSUES.length);
    M.set('m', String(st.miss), st.miss > 10 ? 'bad' : st.miss > 4 ? 'warn' : 'good');
    M.set('r', String(rev), rev ? 'warn' : 'good');
    M.set('s', `${sc} / ${ISSUES.length * 10}`, sc >= 100 ? 'good' : sc >= 60 ? 'warn' : 'bad');
  }

  /* ---------------------------------------------------------- found list */
  const box = document.getElementById('found-box');
  function list() {
    box.innerHTML = '';
    const done = ISSUES.filter(i => st.found[i.id]);
    if (!done.length) { box.append(el('p', { class: 'hint' }, 'Your findings will appear here, with the consequence, the fix and a link to the lesson.')); return; }
    const found = ISSUES.filter(i => st.found[i.id] === 'found').length;
    if (done.length === ISSUES.length) box.append(el('div', { class: 'callout rule' }, el('div', { class: 'ct' }, found === ISSUES.length ? `All ${ISSUES.length} found${st.miss ? ` with ${st.miss} miss${st.miss > 1 ? 'es' : ''}` : ', no misses'}. This board is ready for a rev B.` : `Review complete: you found ${found} of ${ISSUES.length} yourself.`), el('p', null, 'Tick "Show the fixed board" to see every correction at once, then step through the layers.')));
    const grid = el('div', { class: 'found-list' });
    ISSUES.forEach((iss, n) => {
      if (!st.found[iss.id]) return;
      const btn = el('button', { class: 'btn' + (F(iss.id) ? '' : ' primary'), onclick: () => { st.fixed[iss.id] = !F(iss.id); persist(); draw(); list(); } }, F(iss.id) ? 'Show the mistake' : 'Show the fix');
      const goto = el('button', { class: 'btn', onclick: () => { st.view = iss.layers[0]; sV.set(st.view); draw(); S.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 'Show on board');
      grid.append(el('div', { class: 'found', id: 'f-' + iss.id },
        el('div', { class: 'ft' }, el('span', { class: 'num' }, '#' + (n + 1)), el('span', null, iss.t), st.found[iss.id] === 'revealed' ? el('span', { class: 'rev' }, 'revealed') : null),
        el('p', null, el('b', null, 'Problem: '), iss.w),
        el('p', null, el('b', null, 'Consequence: '), iss.c),
        el('p', null, el('b', null, 'Fix: '), iss.f),
        el('div', { class: 'row' }, btn, goto, el('a', { href: iss.l[0], style: { fontSize: '.85rem' } }, `Lesson ${iss.l[1]} →`))));
    });
    box.append(grid);
  }
  draw(); list(); score();
})();
