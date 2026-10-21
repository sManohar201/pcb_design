/* Lesson 0 — Board tour */
(function () {
  'use strict';
  const { el, svg, setAttrs, seg, check, meters, verdicts, explain, lab, sig, fmtSI, clamp, geo, legend } = PCB;
  PCB.renderChrome({ lesson: 0 });
  const PX = 5, OX = 20, OY = 20, BW = 120, BH = 90;
  const X = v => OX + v * PX, Y = v => OY + v * PX;
  const P = p => ({ x: X(p[0]), y: Y(p[1]) });
  const CU = '#e0a64a';

  /* ---------------------------------------------------------- routes (shared) */
  const ROUTES = {
    pcie: { pts: [[50, 51], [50, 58]], pair: true, c: '#ff8f6b' },
    usb: { pts: [[40, 51], [40, 77]], pair: true, c: '#ff8f6b' },
    dp: { pts: [[69, 51], [69, 53], [80, 64], [90, 64], [90, 78]], pair: true, c: '#ff8f6b' },
    csi: { pts: [[78, 51], [78, 54], [98, 54], [106, 46], [106, 36], [111, 36]], pair: true, c: '#ff8f6b' },
    eth: { pts: [[60, 51], [60, 54], [68, 54], [74, 60], [74, 73]], pair: true, c: '#ffd166' },
    i2s: { pts: [[88, 51], [88, 56], [97, 56], [100, 61]], c: '#9fd3ff' },
    i2c: { pts: [[91, 51], [94, 48], [94, 16], [100, 12]], c: '#9fd3ff' },
    uart: { pts: [[93, 51], [96.5, 48], [96.5, 14], [100, 9]], c: '#9fd3ff' },
    fan: { pts: [[47, 51], [47, 55], [43.4, 58], [43.4, 76], [50, 82]], c: '#9fd3ff' },
    pwr: { pts: [[34, 58], [34, 51]], c: '#ff5d6c', w: 3.5 },
  };
  function offset(pts, d) {
    const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [-dy / m, dx / m]; };
    return pts.map((p, i) => {
      const n1 = i > 0 ? nrm(pts[i - 1], p) : nrm(p, pts[i + 1]), n2 = i < pts.length - 1 ? nrm(p, pts[i + 1]) : n1;
      let nx = n1[0] + n2[0], ny = n1[1] + n2[1]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const k = d / Math.max(0.5, nx * n1[0] + ny * n1[1]);
      return [p[0] + nx * k, p[1] + ny * k];
    });
  }
  const path = (pts, w, c, extra = {}) => svg('path', Object.assign({ d: geo.pathD(pts.map(P)), fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, extra));
  function drawRoute(g, k, hi, dim) {
    const r = ROUTES[k];
    const c = hi ? '#ffffff' : r.c, op = dim ? 0.25 : 1;
    if (r.pair) { g.append(path(offset(r.pts, 0.45), hi ? 2.4 : 1.6, c, { opacity: op }), path(offset(r.pts, -0.45), hi ? 2.4 : 1.6, c, { opacity: op })); }
    else g.append(path(r.pts, (r.w || 0.3) * PX * (hi ? 1.4 : 1), c, { opacity: op }));
  }

  /* ---------------------------------------------------------- base board */
  function drawBoard(g) {
    const R = (x0, y0, x1, y1, fill, extra = {}) => g.append(svg('rect', Object.assign({ x: X(x0), y: Y(y0), width: (x1 - x0) * PX, height: (y1 - y0) * PX, rx: 3, fill, stroke: 'var(--silk)', 'stroke-width': 1 }, extra)));
    const T = (x, y, t, extra = {}) => g.append(svg('text', Object.assign({ x: X(x), y: Y(y), 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 10.5, 'pointer-events': 'none', text: t }, extra)));
    g.append(svg('rect', { x: X(0), y: Y(0), width: BW * PX, height: BH * PX, rx: 8, fill: 'var(--board)', stroke: '#2f6b51', 'stroke-width': 2 }));
    R(25, 6, 95, 51, '#1d2730', { opacity: 0.55, 'stroke-dasharray': '6 4', rx: 6 }); T(60, 22, 'MODULE', { 'font-size': 14, 'font-weight': 700 }); T(60, 27, '(sits above the carrier on standoffs)', { 'font-size': 10, opacity: 0.8 });
    R(28, 47, 92, 51, '#0b0f0d');
    for (const x of [34, 45, 56, 66, 83]) { R(x - 0.6, 52, x + 0.6, 53.4, '#b9a37a', { stroke: 'none' }); }
    R(0, 57, 9, 68, '#3a3f44'); T(4.5, 63.5, 'DC in');
    R(10, 57, 13, 60, '#141a17'); R(10, 61, 13, 63.5, '#2b2b2b');
    R(16, 58, 21, 63, '#141a17'); R(24, 57, 31, 64, '#3a3f44'); R(33, 58.5, 35, 62.5, '#b9a37a'); R(13.4, 58.2, 15.4, 61.8, '#b9a37a');
    R(16, 67, 21, 72, '#141a17'); R(24, 66, 30, 72, '#3a3f44'); T(25, 76, '5 V + 3.3 V bucks', { 'font-size': 10 });
    R(29, 77, 43, 90, '#2f3b48'); T(36, 85, 'USB 3');
    R(44, 58, 66, 72, '#26323a'); T(55, 66, 'M.2 Key M (NVMe)');
    R(66, 73, 82, 90, '#2f3b48'); T(74, 81, 'RJ45 +'); T(74, 85, 'magnetics');
    R(84.5, 78, 99.5, 90, '#2f3b48'); T(92, 85, 'HDMI');
    R(111, 22, 120, 44, '#2f3b48'); T(115.5, 34, 'CSI', { 'font-size': 9.5 });
    R(100, 60, 110, 70, '#2d4234'); T(105, 66, 'codec', { 'font-size': 9.5 });
    R(101, 79, 112, 90, '#2d4234'); T(106.5, 85.5, 'audio', { 'font-size': 9.5 });
    R(50, 80, 58, 88, '#1d2a33'); T(54, 85, 'FAN', { 'font-size': 9 });
    R(100, 4, 117, 18, '#1d2a33'); T(108.5, 9, 'UART · EEPROM', { 'font-size': 9 }); T(108.5, 14, 'buttons', { 'font-size': 9 });
    for (const [x, y] of [[4, 4], [116, 4], [4, 86], [116, 86]]) g.append(svg('circle', { cx: X(x), cy: Y(y), r: 2.2 * PX, fill: '#c9d1d6' }), svg('circle', { cx: X(x), cy: Y(y), r: 1.3 * PX, fill: '#222' }));
  }

  /* =================================================================
     0.1  Tour
     ================================================================= */
  (function labTour() {
    const host = document.getElementById('lab-tour'); if (!host) return;
    const Z = [
      { k: 'conn', r: [28, 47, 92, 51.5], t: 'Module connector', what: 'The one connector everything passes through: module power input, every high-speed interface (PCIe, USB, display, camera, Ethernet), and dozens of GPIO, I²C, SPI and UART pins. On the Orin Nano and NX it is a 260-pin SO-DIMM-style edge connector.', why: 'Its position is fixed first, by the module, its heatsink and the enclosure. Every other placement is planned around its pin groups.', risk: 'Interfaces leaving in the wrong order (crossings → vias); skimpy decoupling and ground return at the power pins; fast routes passing under the connector on layers whose plane is cut by its pins.', l: [[12, '12.1 Floorplan'], [5, '5 PDN'], [3, '3 Return current']] },
      { k: 'module', r: [25, 6, 95, 47], t: 'Module footprint', what: 'The area under the module. The module sits a few mm above the carrier on standoffs, with its own heatsink and fan.', why: 'Only low-profile parts (or none) can go here, but routing on the carrier underneath is fine and often necessary.', risk: 'Tall parts colliding with the module; hot regulators under it, adding to its heat; forgetting the standoff keep-outs.', l: [[12, '12.3 Thermal'], [13, '13 DFM']] },
      { k: 'pwrin', r: [0, 56, 14, 69], t: 'Power input & protection', what: 'DC jack, reverse-polarity protection, a TVS diode against surges and often a fuse or eFuse.', why: 'On the edge (the cable must reach it), and before anything else on the board, so surges are clamped where they enter.', risk: 'Long unprotected input traces radiating switching noise back down the cable; TVS placed far from the jack; thin traces for several amps.', l: [[4, '4.4 ESD & chassis'], [1, '1 Copper R & L']] },
      { k: 'buck', r: [14, 55, 37, 76], t: 'Buck regulators', what: 'Switching converters that make 5 V and 3.3 V (and more) from the input, at 90%+ efficiency. Each has a hot loop that switches amps in nanoseconds.', why: 'Close to the power entry and to where their current goes, and as far as possible from analog and from cable connectors.', risk: 'Input capacitor too far away (ringing, EMI), feedback routed past the inductor, switch-node copper too large.', l: [[6, '6 Buck layout'], [5, '5 PDN'], [4, '4 Grounding']] },
      { k: 'decap', r: [30, 51.5, 92, 55], t: 'Decoupling at the module', what: 'Capacitors right beside the module\'s power pins, plus bulk capacitance nearby.', why: 'They supply the fast part of the module\'s current steps, which the regulator is too far away (too inductive) to provide.', risk: 'Long thin connections that add nH of mounting inductance; vias placed far from the pads.', l: [[5, '5 Decoupling & PDN']] },
      { k: 'usb', r: [29, 76, 44, 90], t: 'USB 3 connector', what: 'A 5 Gb/s SuperSpeed TX pair and RX pair, plus the USB 2 D+/D− pair, VBUS and ground. ESD diodes and sometimes common-mode chokes sit at the connector.', why: 'On the edge, directly below the module\'s USB pin group, so the pairs run short and straight.', risk: 'ESD parts far from the connector, TX/RX pairs packed together, a slot in the ground plane under the pairs, too many vias.', l: [[8, '8 Diff pairs'], [9, '9 Crosstalk'], [4, '4.4 ESD']] },
      { k: 'm2', r: [44, 57, 66, 72], t: 'M.2 slot (PCIe)', what: 'An M.2 Key M socket for an NVMe SSD, with PCIe lanes from the module (TX pairs with AC-coupling capacitors, RX pairs, a reference clock pair).', why: 'Close to the PCIe pins with the card lying over the board, oriented so the lane order lines up.', risk: 'Lane order reversed by the connector orientation, AC caps placed asymmetrically within a pair, via stubs at 8 GT/s.', l: [[12, '12.2 Pin order'], [10, '10 Vias'], [7, '7 Transmission lines']] },
      { k: 'eth', r: [66, 73, 82, 90], t: 'Ethernet (RJ45 + magnetics)', what: 'Gigabit Ethernet: four differential pairs from the PHY through transformers ("magnetics") to the jack. The transformer isolates the cable from the board.', why: 'On the edge, near the module\'s Ethernet pins, with the line side kept separate from the board\'s planes.', risk: 'Ground or power planes running under the line side, which bridges the isolation for noise; long MDI pairs.', l: [[4, '4.4 Chassis & isolation'], [8, '8 Diff pairs']] },
      { k: 'hdmi', r: [84.5, 78, 99.5, 90], t: 'HDMI / DisplayPort', what: 'Three or four multi-gigabit data pairs plus a clock pair, an AUX or DDC channel and hot-plug detect.', why: 'On the edge, in order with the module\'s display pins.', risk: 'Skew compensated in the wrong place, impedance bumps at the connector pads, missing ESD.', l: [[8, '8.2 Skew'], [7, '7.2 TDR']] },
      { k: 'csi', r: [111, 22, 120, 44], t: 'Camera connectors (MIPI CSI-2)', what: 'Flat-flex connectors carrying a clock lane and 2–4 data lanes per camera at up to a few Gb/s per lane, plus I²C control.', why: 'On the edge where the camera cables leave the enclosure. Long routes are common here, so each lane is matched to its clock lane.', risk: 'Layer changes without return vias, crossing plane splits, data lanes not matched to the clock lane.', l: [[11, '11 Matching groups'], [3, '3.4 Layer changes']] },
      { k: 'audio', r: [99, 58, 113, 90], t: 'Audio codec & jack', what: 'An analog codec fed by I²S digital audio, driving a headphone or line jack. Microvolt-level signals.', why: 'In the quietest corner, far from the bucks, with its own local decoupling. Same ground, separated by placement.', risk: 'Buck switching noise heard as whine; decoupling caps far from the pins; analog traces next to clocks.', l: [[4, '4 Grounding'], [5, '5.2 Mounting']] },
      { k: 'fan', r: [49, 79, 59, 89], t: 'Fan header', what: 'Power and PWM/tach for the module fan.', why: 'Near the module but out of the way of other connectors; cable routing matters mechanically.', risk: 'Fan motor noise on the supply; traces too near the board edge.', l: [[12, '12.3 Thermal'], [13, '13 DFM']] },
      { k: 'debug', r: [100, 4, 117, 18], t: 'Debug, buttons & EEPROM', what: 'A UART header, power and recovery buttons and an ID EEPROM on I²C. All slow signals.', why: 'Anywhere convenient. These are the nets where you can relax the rules.', risk: 'Not much electrically. Watch ESD on buttons a user touches, and keep the header reachable.', l: [[0, '0.2 Which nets are fast?']] },
      { k: 'holes', r: null, t: 'Mounting holes', what: 'Four holes for standoffs to the enclosure or a heat-spreader plate, usually tied to ground or chassis.', why: 'Positions are fixed by the mechanical design; keep parts and copper clear of the screw heads and washers (Jones).', risk: 'Copper or parts under the washer; no thought given to whether the holes connect to chassis.', l: [[13, '13 DFM'], [12, '12.3 Thermal']] },
      { k: 'board', r: null, t: 'The board itself', what: 'Usually 6–10 layers: signal layers each next to a solid ground plane, power layers in the middle. Controlled-impedance stackup from the fab.', why: 'The stackup decides impedance, crosstalk, plane capacitance and how many layers you have to escape the connector pins.', risk: 'Signal layers without an adjacent plane, adjacent signal layers routed in parallel, an asymmetric stack that warps.', l: [[2, '2 Stackup'], [3, '3 Return current']] },
    ];
    const L = lab(host, { title: 'A module carrier board: click a block' });
    const S = svg('svg', { class: 'viz', viewBox: `0 0 ${BW * PX + 2 * OX} ${BH * PX + 2 * OY}`, style: 'background:var(--board-2)' });
    const gB = svg('g'), gR = svg('g'), gH = svg('g');
    S.append(gB, gR, gH);
    drawBoard(gB);
    for (const k in ROUTES) drawRoute(gR, k, false, false);
    L.controls.append(el('div', { class: 'hint' }, 'Click a block on the board, or pick from the list:'));
    const btns = el('div', { class: 'btn-row' });
    Z.forEach(z => btns.append(el('button', { class: 'btn', onclick: () => select(z.k) }, z.t)));
    L.controls.append(btns);
    L.stage.append(S, legend([['#ff8f6b', 'multi-gigabit pairs'], ['#ffd166', 'Ethernet pairs'], ['#9fd3ff', 'slow signals'], ['#ff5d6c', '5 V power']]));
    const V = verdicts(L.left, 'What it is');
    const E = explain(L.right, 'Placement & pitfalls');
    const hits = [];
    Z.forEach(z => {
      if (!z.r) return;
      const r = svg('rect', { x: X(z.r[0]), y: Y(z.r[1]), width: (z.r[2] - z.r[0]) * PX, height: (z.r[3] - z.r[1]) * PX, rx: 4, fill: 'transparent', stroke: 'transparent', 'stroke-width': 2.5, style: 'cursor:pointer' });
      r.addEventListener('click', e => { e.stopPropagation(); select(z.k); });
      r.addEventListener('pointerenter', () => { if (st.sel !== z.k) setAttrs(r, { stroke: 'rgba(255,255,255,.45)' }); });
      r.addEventListener('pointerleave', () => { if (st.sel !== z.k) setAttrs(r, { stroke: 'transparent' }); });
      hits.push([z.k, r]);
    });
    // modules zone first in list so the connector (smaller) sits on top
    hits.sort((a, b) => (a[0] === 'module' ? -1 : b[0] === 'module' ? 1 : 0)).forEach(([, r]) => gH.append(r));
    for (const [x, y] of [[4, 4], [116, 4], [4, 86], [116, 86]]) { const c = svg('circle', { cx: X(x), cy: Y(y), r: 3 * PX, fill: 'transparent', style: 'cursor:pointer' }); c.addEventListener('click', e => { e.stopPropagation(); select('holes'); }); gH.append(c); }
    S.addEventListener('click', () => select('board'));
    const st = { sel: null };
    function select(k) {
      st.sel = k;
      hits.forEach(([kk, r]) => setAttrs(r, { stroke: kk === k ? '#ffd166' : 'transparent', fill: kk === k ? 'rgba(255,209,102,.12)' : 'transparent' }));
      const z = Z.find(q => q.k === k);
      V.set([{ level: 'info', html: `<b>${z.t}.</b> ${z.what}` }]);
      const links = z.l.map(([n, t]) => { const les = PCB.LESSONS.find(q => q.n === n); return `<a href="${les && les.file ? les.file : '#'}">${t}</a>`; }).join(' · ');
      E.set(`<p><b>Why here:</b> ${z.why}</p><p><b>What goes wrong:</b> ${z.risk}</p><p><b>Lessons:</b> ${links}</p>`);
    }
    select('conn');
  })();

  /* =================================================================
     0.2  Which nets are fast?
     ================================================================= */
  (function labSpeed() {
    const host = document.getElementById('lab-speed'); if (!host) return;
    const L = lab(host, { title: 'Edge length vs route length' });
    const NETS = {
      pcie: { n: 'PCIe Gen3 (to M.2)', rate: '8 GT/s', tr: 35, note: 'Plus the length on the M.2 card itself.' },
      usb: { n: 'USB 3 (5 Gb/s)', rate: '5 Gb/s', tr: 55 },
      dp: { n: 'HDMI / DP', rate: '6 Gb/s per lane', tr: 50 },
      csi: { n: 'MIPI CSI-2 D-PHY', rate: '2.5 Gb/s per lane', tr: 100 },
      eth: { n: 'Gigabit Ethernet MDI', rate: '125 MBd × 4 pairs', tr: 3000, note: 'Edges are deliberately slow, but the pairs still need 100 Ω and symmetry for common-mode rejection.' },
      i2s: { n: 'I²S audio (3 MHz BCLK)', rate: '3 Mb/s', tr: 2000 },
      fan: { n: 'Fan PWM (25 kHz)', rate: '25 kHz', tr: 50000 },
      uart: { n: 'Debug UART', rate: '115 kb/s', tr: 10000 },
      i2c: { n: 'I²C (400 kHz)', rate: '400 kb/s', tr: 300000 },
      gpio: { n: '25 MHz clock from a fast GPIO', rate: '25 MHz', tr: 1000, route: 'i2c', note: 'Same route as the I²C bus, but driven by a fast CMOS output: the 1 ns edge, not the 25 MHz, decides.' },
      pwr: { n: '5 V power to the module', rate: 'DC + load steps', tr: null },
    };
    const st = { k: 'usb' };
    const sN = seg({ label: 'Interface', options: Object.keys(NETS).map(k => ({ v: k, label: NETS[k].n })), value: st.k, onChange: v => { st.k = v; update(); } });
    L.controls.append(sN.el);
    const S = svg('svg', { class: 'viz', viewBox: `0 0 ${BW * PX + 2 * OX} ${BH * PX + 2 * OY}`, style: 'background:var(--board-2)' });
    const gB = svg('g'), gR = svg('g');
    S.append(gB, gR);
    drawBoard(gB);
    const bar = svg('svg', { class: 'viz', viewBox: '0 0 640 96', style: 'background:var(--surface-2)' });
    L.stage.append(S, bar);
    const M = meters(L.stage, [{ key: 'tr', label: 'Edge (rise) time' }, { key: 'el', label: 'Edge length in copper' }, { key: 'crit', label: 'Transmission line beyond' }, { key: 'len', label: 'This route' }, { key: 'fk', label: 'Knee frequency 0.35/tr' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Edge times are typical orders of magnitude for each interface. Propagation ≈ 6.5 ps/mm (between microstrip and stripline in FR-4).'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const n = NETS[st.k], rk = n.route || st.k, r = ROUTES[rk];
      gR.innerHTML = '';
      for (const k in ROUTES) drawRoute(gR, k, k === rk, k !== rk);
      const len = geo.polyLen(r.pts.map(p => ({ x: p[0], y: p[1] })));
      bar.innerHTML = '';
      M.set('len', sig(len, 3) + ' mm');
      if (n.tr == null) {
        M.set('tr', '—'); M.set('el', '—'); M.set('crit', 'n/a'); M.set('fk', '—');
        bar.append(svg('text', { x: 320, y: 52, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--text)', text: 'Power: the questions are resistance (IR drop, heat), inductance (droop on load steps) and loop area.' }));
        V.set([{ level: 'info', html: 'A power net carries current, not edges. What matters is milliohms (IR drop, heating) and nanohenries (droop when the module\'s load jumps), so make it wide, short and paired with its ground return.' }]);
        E.set('<p>Lessons 1 and 5 cover this: copper resistance and IPC heating, then decoupling and the PDN. Lesson 6 covers the converter that makes the rail.</p>');
        return;
      }
      const el_ = n.tr / 6.5, crit = el_ / 6;
      const ratio = len / crit;
      M.set('tr', fmtSI(n.tr * 1e-12, 's'));
      M.set('el', el_ > 1000 ? sig(el_ / 1000, 3) + ' m' : sig(el_, 3) + ' mm');
      M.set('crit', crit > 1000 ? sig(crit / 1000, 3) + ' m' : sig(crit, 3) + ' mm');
      M.set('fk', fmtSI(0.35 / (n.tr * 1e-12), 'Hz'));
      // bar: route length vs edge length, log scale
      const lx = v => 40 + (Math.log10(clamp(v, 0.1, 1e6)) + 1) / 7 * 560;
      for (let e = -1; e <= 6; e++) bar.append(svg('line', { x1: lx(Math.pow(10, e)), y1: 20, x2: lx(Math.pow(10, e)), y2: 62, stroke: 'var(--border)' }), svg('text', { x: lx(Math.pow(10, e)), y: 76, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--faint)', text: e < 3 ? `${Math.pow(10, e)} mm` : `${Math.pow(10, e - 3)} m` }));
      bar.append(svg('rect', { x: lx(0.1), y: 26, width: lx(crit) - lx(0.1), height: 14, fill: 'var(--good)', opacity: 0.3 }), svg('rect', { x: lx(crit), y: 26, width: Math.max(0, lx(1e6) - lx(crit)), height: 14, fill: 'var(--bad)', opacity: 0.22 }));
      bar.append(svg('text', { x: lx(0.1) + 4, y: 37, 'font-size': 10, fill: 'var(--good)', text: 'lumped wire' }), svg('text', { x: Math.min(lx(crit) + 4, 540), y: 37, 'font-size': 10, fill: 'var(--bad)', text: 'transmission line' }));
      bar.append(svg('line', { x1: lx(len), y1: 16, x2: lx(len), y2: 48, stroke: 'var(--accent)', 'stroke-width': 3 }), svg('text', { x: lx(len), y: 12, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700, fill: 'var(--accent)', text: `this route ${Math.round(len)} mm` }));
      bar.append(svg('text', { x: 40, y: 92, 'font-size': 10, fill: 'var(--faint)', text: 'log scale' }));
      const fast = ratio > 1;
      M.set('len', sig(len, 3) + ' mm', fast ? 'bad' : 'good');
      const items = [];
      items.push({ level: fast ? 'bad' : 'good', html: fast ? `<b>${n.n}</b>: the route is ${sig(ratio, 2)}× longer than the critical length (${sig(crit, 2)} mm). It is a <b>transmission line</b>: it needs controlled impedance, a continuous reference plane, matched pairs and few vias (lessons 7–10).` : `<b>${n.n}</b>: the edge is ${el_ > 1000 ? sig(el_ / 1000, 2) + ' m' : sig(el_, 3) + ' mm'} long, far longer than any trace here. Electrically this is a plain wire: route it neatly and keep it away from noisy nodes. Impedance control buys nothing.` });
      if (n.note) items.push({ level: 'info', html: n.note });
      V.set(items);
      E.set(`<p>An edge rising in ${fmtSI(n.tr * 1e-12, 's')} spreads over ${el_ > 1000 ? sig(el_ / 1000, 3) + ' m' : sig(el_, 3) + ' mm'} of trace. If the route is a small fraction of that, the whole trace rises together, and it behaves as a lumped wire. If not, different parts of the trace sit at different voltages at the same instant: reflections, impedance and return paths start to matter.</p><p>The knee frequency 0.35/t<sub>r</sub> = ${fmtSI(0.35 / (n.tr * 1e-12), 'Hz')} is roughly the highest frequency the edge contains, so it is what your layout must handle.</p>`);
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Which part of a carrier board is placed first?', opts: ['The buck converters', 'The module connector and other mechanically fixed parts (mounting holes, edge connectors the enclosure dictates)', 'The decoupling capacitors'], a: 1, ex: 'Everything else is planned around the module connector\'s pin groups and the mechanical constraints.' },
    { q: 'A 10 MHz SPI clock comes from a driver with 0.8 ns edges, over a 120 mm route. Does it need transmission-line care?', opts: ['No, 10 MHz is slow', 'Yes: the edge is ~120 mm long in copper, so the critical length is ~20 mm and the route is much longer', 'Only if it is differential'], a: 1, ex: 'Edge time, not clock frequency, decides. Add a series termination at the driver (lesson 7) and give it a solid reference.' },
    { q: 'Why do the camera connectors usually sit on a board edge, far from the module?', opts: ['Because the cables have to leave the enclosure there, so long CSI routes are common and must be matched to their clock lane', 'To reduce the price', 'Because CSI is slow'], a: 0, ex: 'Mechanical constraints often force long routes. That is when matching and return-path care (lessons 3, 8, 11) pay off.' },
  ]);
})();
