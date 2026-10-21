/* Lesson 12 — Placement for a carrier board */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, fmtSI, sig, clamp, geo, legend } = PCB;
  PCB.renderChrome({ lesson: 12 });
  const BW = 120, BH = 90; // board, mm
  const MOD = { x0: 25, y0: 6, x1: 95, y1: 51 }; // module footprint (keep-out for tall parts)
  const rectsOverlap = (a, b, gap = 0) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
  const rectDist = (a, b) => { const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1); return Math.hypot(dx, dy); };

  /* =================================================================
     12.1  Floorplan sandbox
     ================================================================= */
  (function labFloor() {
    const host = document.getElementById('lab-floor'); if (!host) return;
    const L = lab(host, { title: 'Floorplan a 120 × 90 mm carrier board' });
    const PX = 5, OX = 20, OY = 22;
    const PINS = { pwr: { x: 31, l: '5V' }, usb: { x: 40, l: 'USB3' }, pcie: { x: 50, l: 'PCIe' }, eth: { x: 60, l: 'ETH' }, dp: { x: 69, l: 'DP' }, csi: { x: 78, l: 'CSI' }, i2s: { x: 88, l: 'I2S' } };
    const PIN_Y = 51;
    const B = {
      dc: { label: 'DC in', w: 9, h: 11, edge: true, fill: '#3a3f44' },
      buck: { label: 'Buck 5 V', w: 12, h: 10, fill: '#5a2c26', hot: true },
      usb: { label: 'USB 3', w: 14, h: 12, edge: true, pin: 'usb', budget: 80, fill: '#2f3b48' },
      m2: { label: 'M.2 PCIe', w: 24, h: 14, pin: 'pcie', budget: 100, fill: '#26323a' },
      eth: { label: 'RJ45 + magnetics', w: 16, h: 18, edge: true, pin: 'eth', budget: 80, fill: '#2f3b48' },
      hdmi: { label: 'HDMI/DP', w: 15, h: 11, edge: true, pin: 'dp', budget: 100, fill: '#2f3b48' },
      csi: { label: 'CSI ×2', w: 8, h: 18, edge: true, pin: 'csi', budget: 80, fill: '#2f3b48' },
      aud: { label: 'Audio', w: 12, h: 12, edge: true, pin: 'i2s', budget: 150, fill: '#2d4234', sens: true },
    };
    const PRE = {
      good: { dc: [4.5, 63], buck: [18, 63], usb: [36, 84], m2: [50, 66], eth: [71, 81], hdmi: [92, 84.5], csi: [116, 33], aud: [114, 84] },
      bad: { dc: [115.5, 84], buck: [99, 68], usb: [113, 22], m2: [22, 74], eth: [8, 26], hdmi: [10, 84.5], csi: [60, 81], aud: [86, 72] },
    };
    const st = { pos: {} };
    const load = k => { for (const b in PRE[k]) st.pos[b] = { x: PRE[k][b][0], y: PRE[k][b][1] }; update(); };
    L.controls.append(
      el('div', { class: 'hint' }, 'Drag the blocks. Connectors marked ⟂ need to sit on the board edge so a cable can reach them. The shaded module area is reserved (the module and its heatsink sit there).'),
      el('div', { class: 'ctl-group-title' }, 'Start from'),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => load('bad') }, 'Random first try'), el('button', { class: 'btn', onclick: () => load('good') }, 'Pin-ordered floorplan')),
      el('div', { class: 'hint' }, 'Route budgets are illustrative: USB3 80 mm, PCIe 100 mm, Ethernet (to magnetics) 80 mm, DP 100 mm, CSI 80 mm. Your module\'s design guide has the real ones.'));
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX + 2 * OX} ${BH * PX + OY + 16}` });
    const gB = svg('g'), gR = svg('g'), gX = svg('g'), gP = svg('g');
    S.append(gB, gR, gX, gP);
    L.stage.append(S, legend([['#77d48b', 'within budget'], ['#ffd166', 'near budget'], ['#ff6b5b', 'over budget'], ['#ff5d6c', '5 V power path', true]]));
    const M = meters(L.stage, [{ key: 'score', label: 'Floorplan score', bar: true }, { key: 'len', label: 'Fast-route length' }, { key: 'x', label: 'Ratsnest crossings' }, { key: 'over', label: 'Over budget' }, { key: 'noise', label: 'Buck ↔ audio' }, { key: 'pwr', label: '5 V path length' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Lengths are Manhattan estimates from the module pin group to the block. Each ratsnest crossing between fast routes is counted as a forced layer change (vias). Distances are edge to edge. A scoring aid, not a sign-off tool.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const X = v => OX + v * PX, Y = v => OY + v * PX;
    // static board
    gB.append(svg('rect', { x: X(0), y: Y(0), width: BW * PX, height: BH * PX, rx: 8, fill: 'var(--plane)', opacity: 0.5, stroke: '#2f6b51' }));
    gB.append(svg('rect', { x: X(MOD.x0), y: Y(MOD.y0), width: (MOD.x1 - MOD.x0) * PX, height: (MOD.y1 - MOD.y0) * PX, rx: 6, fill: '#1d2730', opacity: 0.75, stroke: '#8fa3b0', 'stroke-dasharray': '6 4' }));
    gB.append(svg('text', { x: X(60), y: Y(26), 'text-anchor': 'middle', fill: '#c9d1d6', 'font-size': 13, 'font-weight': 650, text: 'Module (fixed by heatsink & enclosure)' }));
    gB.append(svg('rect', { x: X(28), y: Y(47), width: 64 * PX, height: 4 * PX, fill: '#0b0f0d', stroke: '#c9d1d6' }));
    for (const k in PINS) gB.append(svg('rect', { x: X(PINS[k].x) - 9, y: Y(PIN_Y) - 7, width: 18, height: 7, fill: '#e0a64a' }), svg('text', { x: X(PINS[k].x), y: Y(46), 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, 'font-weight': 650, text: PINS[k].l }));
    gB.append(svg('text', { x: X(1), y: Y(BH) + 14, fill: '#9fb5a8', 'font-size': 10.5, text: 'Board edge: 120 × 90 mm. The coloured pads on the connector are the pin groups each interface leaves from.' }));
    const nodes = {};
    for (const k in B) {
      const b = B[k], g = svg('g');
      const r = svg('rect', { x: -b.w * PX / 2, y: -b.h * PX / 2, width: b.w * PX, height: b.h * PX, rx: 4, fill: b.fill, stroke: '#e8efe9', 'stroke-width': 1.2 });
      const words = b.label.split(' ');
      const t = svg('text', { 'text-anchor': 'middle', fill: '#eef1e8', 'font-size': 10.5, 'font-weight': 650 });
      if (b.w < 13 && words.length > 1) { words.forEach((w, i) => t.append(svg('tspan', { x: 0, dy: i ? 12 : -2, text: w }))); } else { t.append(svg('tspan', { x: 0, dy: 4, text: b.label })); }
      g.append(r, t);
      if (b.edge) g.append(svg('text', { x: b.w * PX / 2 - 4, y: -b.h * PX / 2 + 11, 'text-anchor': 'end', fill: '#ffd166', 'font-size': 10, text: '⟂' }));
      gP.append(g); nodes[k] = { g, r };
      let off;
      PCB.draggable(S, g, {
        onStart: p => { off = { x: (p.x - OX) / PX - st.pos[k].x, y: (p.y - OY) / PX - st.pos[k].y }; },
        onMove: p => { st.pos[k] = { x: clamp((p.x - OX) / PX - off.x, b.w / 2, BW - b.w / 2), y: clamp((p.y - OY) / PX - off.y, b.h / 2, BH - b.h / 2) }; update(); },
      });
    }
    const rect = k => ({ x0: st.pos[k].x - B[k].w / 2, x1: st.pos[k].x + B[k].w / 2, y0: st.pos[k].y - B[k].h / 2, y1: st.pos[k].y + B[k].h / 2 });
    const onEdge = k => { const r = rect(k); return r.x0 <= 0.6 || r.y0 <= 0.6 || r.x1 >= BW - 0.6 || r.y1 >= BH - 0.6; };
    function update() {
      for (const k in nodes) nodes[k].g.setAttribute('transform', `translate(${X(st.pos[k].x)} ${Y(st.pos[k].y)})`);
      // routes
      const routes = [];
      for (const k in B) if (B[k].pin) {
        const a = { x: PINS[B[k].pin].x, y: PIN_Y }, b = { x: st.pos[k].x, y: st.pos[k].y };
        const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        routes.push({ k, a, b, len, budget: B[k].budget, fast: k !== 'aud' });
      }
      const pw1 = { a: { x: PINS.pwr.x, y: PIN_Y }, b: st.pos.buck };
      const pw2 = { a: st.pos.buck, b: st.pos.dc };
      const crosses = [];
      for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
        if (!routes[i].fast || !routes[j].fast) continue;
        const p = geo.segX(routes[i].a, routes[i].b, routes[j].a, routes[j].b);
        if (p && p.t > 0.02 && p.t < 0.98) crosses.push(p);
      }
      let pwrX = 0;
      for (const r of routes) if (r.fast) { if (geo.segX(pw1.a, pw1.b, r.a, r.b)) pwrX++; }
      // overlaps & edges
      const keys = Object.keys(B);
      const bad = new Set();
      const overl = [];
      for (let i = 0; i < keys.length; i++) {
        if (rectsOverlap(rect(keys[i]), MOD)) { bad.add(keys[i]); overl.push(`${B[keys[i]].label} sits in the module area`); }
        for (let j = i + 1; j < keys.length; j++) if (rectsOverlap(rect(keys[i]), rect(keys[j]))) { bad.add(keys[i]); bad.add(keys[j]); overl.push(`${B[keys[i]].label} overlaps ${B[keys[j]].label}`); }
      }
      const offEdge = keys.filter(k => B[k].edge && !onEdge(k));
      offEdge.forEach(k => bad.add(k));
      const dAud = rectDist(rect('buck'), rect('aud'));
      const nearConn = ['usb', 'eth', 'hdmi', 'csi'].filter(k => rectDist(rect('buck'), rect(k)) < 8);
      const pwrLen = Math.abs(pw1.a.x - pw1.b.x) + Math.abs(pw1.a.y - pw1.b.y);
      const inLen = geo.dist(st.pos.dc, st.pos.buck);
      // draw
      gR.innerHTML = ''; gX.innerHTML = '';
      gR.append(svg('line', { x1: X(pw1.a.x), y1: Y(pw1.a.y), x2: X(pw1.b.x), y2: Y(pw1.b.y), stroke: '#ff5d6c', 'stroke-width': 4, 'stroke-dasharray': '8 5', opacity: 0.9 }), svg('line', { x1: X(pw2.a.x), y1: Y(pw2.a.y), x2: X(pw2.b.x), y2: Y(pw2.b.y), stroke: '#ff5d6c', 'stroke-width': 3, 'stroke-dasharray': '8 5', opacity: 0.6 }));
      let over = 0, tot = 0;
      for (const r of routes) {
        const f = r.len / r.budget;
        if (r.fast) tot += r.len;
        if (f > 1) over++;
        const c = f > 1 ? '#ff6b5b' : f > 0.8 ? '#ffd166' : '#77d48b';
        gR.append(svg('line', { x1: X(r.a.x), y1: Y(r.a.y), x2: X(r.b.x), y2: Y(r.b.y), stroke: c, 'stroke-width': 2.2 }));
        const mx = (r.a.x + r.b.x) / 2, my = (r.a.y + r.b.y) / 2;
        gR.append(svg('text', { x: X(mx) + 4, y: Y(my) - 3, fill: c, 'font-size': 10, 'font-family': 'var(--mono)', text: `${Math.round(r.len)}` }));
      }
      crosses.forEach(p => gX.append(svg('circle', { cx: X(p.x), cy: Y(p.y), r: 7, fill: 'none', stroke: '#ff6b5b', 'stroke-width': 2 }), svg('text', { x: X(p.x) + 9, y: Y(p.y) + 4, fill: '#ff8a7a', 'font-size': 9.5, text: 'vias' })));
      for (const k in nodes) setAttrs(nodes[k].r, { stroke: bad.has(k) ? '#ff6b5b' : '#e8efe9', 'stroke-width': bad.has(k) ? 2.5 : 1.2 });
      // noise ring
      gX.append(svg('circle', { cx: X(st.pos.buck.x), cy: Y(st.pos.buck.y), r: 22 * PX, fill: 'none', stroke: '#ffd166', 'stroke-dasharray': '3 5', opacity: 0.35 }));
      // score
      let score = 100;
      score -= crosses.length * 6 + overl.length * 15 + offEdge.length * 12 + over * 8 + (dAud < 15 ? 15 : dAud < 30 ? 7 : 0) + (pwrLen > 35 ? 8 : 0) + nearConn.length * 4 + pwrX * 3;
      score = clamp(score, 0, 100);
      M.set('score', Math.round(score) + ' / 100', score < 50 ? 'bad' : score < 80 ? 'warn' : 'good', score / 100);
      M.set('len', Math.round(tot) + ' mm');
      M.set('x', String(crosses.length), crosses.length > 2 ? 'bad' : crosses.length ? 'warn' : 'good');
      M.set('over', `${over} of ${routes.length}`, over ? 'bad' : 'good');
      M.set('noise', Math.round(dAud) + ' mm', dAud < 15 ? 'bad' : dAud < 30 ? 'warn' : 'good');
      M.set('pwr', Math.round(pwrLen) + ' mm', pwrLen > 35 ? 'warn' : 'good');
      const items = [];
      overl.slice(0, 3).forEach(t => items.push({ level: 'bad', html: t + '.' }));
      if (offEdge.length) items.push({ level: 'bad', html: `Not on the board edge: <b>${offEdge.map(k => B[k].label).join(', ')}</b>. A cable or card must reach these from outside the enclosure.` });
      if (crosses.length) items.push({ level: crosses.length > 2 ? 'bad' : 'warn', html: `<b>${crosses.length} crossing${crosses.length > 1 ? 's' : ''}</b> between fast routes. Each one forces a pair onto another layer (two vias, a stub, a reference change: lessons 3 and 10). The cure is usually to swap two connectors so they follow the pin-group order.` });
      for (const r of routes) if (r.len > r.budget) items.push({ level: 'bad', html: `${B[r.k].label}: ~${Math.round(r.len)} mm from its pins, over the ${r.budget} mm budget. Loss and skew grow with length; move it closer to the ${PINS[B[r.k].pin].l} pins.` });
      if (dAud < 30) items.push({ level: dAud < 15 ? 'bad' : 'warn', html: `The buck converter is ${Math.round(dAud)} mm from the audio block. Its switch node and inductor field (lesson 6) will be audible as whine and hiss. Give analog the far side of the board.` });
      if (nearConn.length) items.push({ level: 'warn', html: `Buck within 8 mm of ${nearConn.map(k => B[k].label).join(', ')}: switching noise couples onto the cable, which then radiates as an antenna.` });
      if (pwrLen > 35) items.push({ level: 'warn', html: `The 5 V path from the buck to the module power pins is ~${Math.round(pwrLen)} mm. Several amps over a long pour means IR drop (lesson 5), and the pour has to cut across other routes' reference planes.` });
      if (inLen > 40) items.push({ level: 'info', html: 'The DC input is far from the buck: keep the raw input (and its protection) short and on the edge, and filter it before it spreads across the board.' });
      if (!items.length) items.push({ level: 'good', html: 'Connectors follow the pin-group order, fast routes are short with no crossings, the buck sits by the power entry and the 5 V pins, and audio is on the far side. That is a floorplan you can route.' });
      V.set(items.slice(0, 7));
      E.set('<p>A floorplan is judged by the routes it forces. Ratsnest lines that cross now become vias later; long ratsnest lines become loss and skew; a regulator placed among the connectors becomes an EMI problem.</p><p>The quickest good floorplan copies the order of the module\'s pin groups onto the board edge, puts the power entry and regulators where their current is going, and leaves the quietest corner for analog. Then every block can be laid out on its own (Jones) and dropped into place.</p>');
    }
    load('bad');
  })();

  /* =================================================================
     12.2  Connector orientation and pin order
     ================================================================= */
  (function labPins() {
    const host = document.getElementById('lab-pins'); if (!host) return;
    const L = lab(host, { title: 'PCIe ×4: module pins → M.2 connector' });
    const st = { rot: 0, side: 'top', rev: false, inv: false };
    const sRot = seg({ label: 'M.2 connector rotation', options: [{ v: 0, label: '0° (card over the board)' }, { v: 180, label: '180° (card off the edge)' }], value: st.rot, onChange: v => { st.rot = v; update(); } });
    const sSide = seg({ label: 'Mounted on', options: [{ v: 'top', label: 'top side' }, { v: 'bottom', label: 'bottom side' }], value: st.side, onChange: v => { st.side = v; update(); } });
    const cRev = check({ label: 'Use lane reversal (L0↔L3, L1↔L2)', onChange: v => { st.rev = v; update(); } });
    const cInv = check({ label: 'Use polarity inversion (swap P/N)', onChange: v => { st.inv = v; update(); } });
    L.controls.append(sRot.el, sSide.el, cRev.el, cInv.el, el('div', { class: 'hint' }, 'Lane reversal and polarity inversion change which net goes to which pin in the schematic. They are only allowed if both ends of the link support them.'));
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 300' });
    L.stage.append(S, legend([['#ff6b5b', 'P'], ['#5cb8ff', 'N'], ['#ffd166', 'crossing → layer change']]));
    const M = meters(L.stage, [{ key: 'lx', label: 'Lane crossings' }, { key: 'tw', label: 'P/N twists' }, { key: 'hop', label: 'Lanes changing layer' }, { key: 'via', label: 'Extra vias' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const NAMES = []; for (let l = 0; l < 4; l++) for (const p of ['P', 'N']) NAMES.push({ l, p });
    const yS = i => 52 + i * 28 + Math.floor(i / 2) * 6;
    function lis(a) { const d = []; for (const x of a) { let lo = 0, hi = d.length; while (lo < hi) { const m = (lo + hi) >> 1; if (d[m] < x) lo = m + 1; else hi = m; } d[lo] = x; } return d.length; }
    function update() {
      const straight = (st.rot === 180) !== (st.side === 'bottom');
      const order = straight ? NAMES.slice() : NAMES.slice().reverse(); // connector pads top→bottom
      const slotOf = (l, p) => order.findIndex(o => o.l === l && o.p === p);
      const map = NAMES.map(({ l, p }) => slotOf(st.rev ? 3 - l : l, st.inv ? (p === 'P' ? 'N' : 'P') : p));
      // crossings
      let tw = 0; const laneSlot = [0, 1, 2, 3].map(l => (map[2 * l] + map[2 * l + 1]) / 2);
      for (let l = 0; l < 4; l++) if (map[2 * l] > map[2 * l + 1]) tw++;
      let lx = 0; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (laneSlot[a] > laneSlot[b]) lx++;
      const hop = 4 - lis(laneSlot);
      const vias = hop * 4 + tw * 2;
      // draw
      S.innerHTML = '';
      S.append(svg('rect', { x: 30, y: 30, width: 80, height: 250, rx: 6, fill: '#1d2730', stroke: 'var(--silk)' }), svg('text', { x: 70, y: 22, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, 'font-weight': 650, text: 'Module TX' }));
      const cx = 540;
      S.append(svg('rect', { x: cx, y: 30, width: 70, height: 250, rx: 6, fill: st.side === 'bottom' ? '#20262b' : '#2a3036', stroke: 'var(--silk)', 'stroke-dasharray': st.side === 'bottom' ? '5 4' : null }), svg('text', { x: cx + 35, y: 22, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, 'font-weight': 650, text: `M.2 (${st.side}, ${st.rot}°)` }));
      // card outline direction
      const cardX = st.rot === 0 ? cx - 160 : cx + 70;
      S.append(svg('rect', { x: Math.max(cardX, 120), y: 290 - 6, width: st.rot === 0 ? 160 : 30, height: 6, fill: st.rot === 0 ? '#77d48b' : '#ff6b5b', opacity: 0.6 }), svg('text', { x: st.rot === 0 ? cx - 80 : 600, y: 296 - 10, 'text-anchor': 'middle', fill: st.rot === 0 ? '#77d48b' : '#ff8a7a', 'font-size': 9.5, text: st.rot === 0 ? 'card lies over the board' : 'card →' }));
      const lines = [];
      NAMES.forEach((n, i) => {
        const a = { x: 110, y: yS(i) }, b = { x: cx, y: yS(map[i]) };
        lines.push([a, b, n]);
        S.append(svg('text', { x: 100, y: yS(i) + 4, 'text-anchor': 'end', fill: 'var(--silk)', 'font-size': 10.5, 'font-family': 'var(--mono)', text: `L${n.l}${n.p}` }), svg('rect', { x: 104, y: yS(i) - 4, width: 10, height: 8, fill: '#e0a64a' }));
      });
      order.forEach((o, i) => S.append(svg('rect', { x: cx - 4, y: yS(i) - 4, width: 10, height: 8, fill: '#e0a64a' }), svg('text', { x: cx + 12, y: yS(i) + 4, fill: 'var(--silk)', 'font-size': 10.5, 'font-family': 'var(--mono)', text: `L${o.l}${o.p}` })));
      lines.forEach(([a, b, n]) => S.append(svg('line', { x1: a.x + 4, y1: a.y, x2: b.x - 4, y2: b.y, stroke: n.p === 'P' ? '#ff6b5b' : '#5cb8ff', 'stroke-width': 2.2 })));
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const p = geo.segX(lines[i][0], lines[i][1], lines[j][0], lines[j][1]);
        if (p && p.t > 0.01 && p.t < 0.99) S.append(svg('circle', { cx: p.x, cy: p.y, r: 4, fill: '#ffd166' }));
      }
      if (st.rev || st.inv) S.append(svg('text', { x: 320, y: 290, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10.5, text: `schematic changed: ${[st.rev ? 'lanes reversed' : '', st.inv ? 'P/N swapped' : ''].filter(Boolean).join(' + ')}` }));
      M.set('lx', String(lx), lx ? 'bad' : 'good');
      M.set('tw', String(tw), tw ? 'warn' : 'good');
      M.set('hop', String(hop), hop ? 'bad' : 'good');
      M.set('via', String(vias), vias > 8 ? 'bad' : vias ? 'warn' : 'good');
      const items = [];
      if (st.rot === 180) items.push({ level: 'bad', html: 'At 180° the M.2 card would stick out past the board edge (or into the enclosure wall). The pin order is now perfect, but mechanics rule this out.' });
      if (st.side === 'bottom') items.push({ level: 'warn', html: 'A bottom-side M.2 mirrors the pin order, which fixes it here, but it needs a second reflow pass, a taller standoff and room in the enclosure below the board.' });
      if (lx) items.push({ level: 'bad', html: `${lx} lane crossing${lx > 1 ? 's' : ''}: at least ${hop} lane${hop > 1 ? 's' : ''} must drop to another layer and come back: ${hop * 4} vias with stubs (lesson 10) and a change of reference plane (lesson 3) on 8 Gb/s signals.` });
      if (tw) items.push({ level: 'warn', html: `${tw} pair${tw > 1 ? 's have' : ' has'} P and N swapped: a crossover needs one line to dive under the other, adding skew and mode conversion (lesson 8).` });
      if (!lx && !tw && st.rot === 0 && st.side === 'top') items.push({ level: 'good', html: `Clean, straight routing with the card lying over the board, achieved by ${st.rev && st.inv ? 'lane reversal + polarity inversion' : st.rev ? 'lane reversal' : 'polarity inversion'}. <b>Check first</b> that the module's design guide allows it for this interface. PCIe receivers must support polarity inversion; lane reversal is optional.` });
      if (!lx && !tw && (st.rot !== 0 || st.side !== 'top')) items.push({ level: 'info', html: 'The ratsnest is straight, but look at the mechanical cost above.' });
      V.set(items);
      E.set('<p>Two ordered lists of pins joined by straight lines cross wherever their orders disagree. Rotating a connector reverses its list, and mounting it on the other side mirrors it again. The minimum number of lanes that must change layer is 4 minus the longest run of lanes already in order.</p><p>That is why experienced designers decide connector rotation and side while looking at the ratsnest, before routing anything, and why "can this interface do lane reversal?" is a question for the design guide on day one.</p>');
    }
    update();
  })();

  /* =================================================================
     12.3  Thermal placement
     ================================================================= */
  (function labHeat() {
    const host = document.getElementById('lab-heat'); if (!host) return;
    const L = lab(host, { title: 'Heat on the carrier board' });
    const NX = 60, NY = 45, CELL = 2; // mm
    const PX = 5, OX = 20, OY = 20;
    const P = {
      buck: { label: 'Buck', w: 6, h: 6, W: 1.2, fill: '#5a2c26' },
      ldo: { label: 'LDO', w: 4, h: 4, W: 0.8, fill: '#5a3a26' },
      ssd: { label: 'M.2 SSD', w: 30, h: 22, W: 2, fill: '#26323a' },
      cap: { label: 'Elec. cap', w: 8, h: 8, W: 0, fill: '#2f3b48', sens: true },
      xtal: { label: 'RTC xtal', w: 5, h: 3, W: 0, fill: '#2d4234', sens: true },
    };
    const PRE = {
      bad: { buck: [30, 66], ldo: [44, 64], ssd: [80, 72], cap: [37, 76], xtal: [50, 58] },
      good: { buck: [12, 62], ldo: [103, 30], ssd: [62, 72], cap: [8, 30], xtal: [110, 60] },
    };
    const st = { pos: {}, cu: 'std', air: 'none', amb: 40, mount: true };
    const sCu = seg({ label: 'Plane copper (heat spreading)', options: [{ v: 'thin', label: '2 planes, ½ oz' }, { v: 'std', label: '4 planes, 1 oz' }, { v: 'heavy', label: '4 planes, 2 oz' }], value: st.cu, onChange: v => { st.cu = v; solve(true); } });
    const sAir = seg({ label: 'Airflow', options: [{ v: 'none', label: 'still air' }, { v: 'lr', label: 'fan: left → right' }, { v: 'rl', label: 'fan: right → left' }], value: st.air, onChange: v => { st.air = v; solve(true); } });
    const sAmb = seg({ label: 'Air inside the enclosure', options: [25, 40, 55].map(v => ({ v, label: v + ' °C' })), value: st.amb, onChange: v => { st.amb = v; solve(true); } });
    const load = k => { for (const p in PRE[k]) st.pos[p] = { x: PRE[k][p][0], y: PRE[k][p][1] }; solve(true); };
    const cMt = check({ label: 'Mounting holes on metal standoffs to the chassis', checked: true, onChange: v => { st.mount = v; solve(true); } });
    L.controls.append(sCu.el, sAir.el, sAmb.el, cMt.el,
      el('div', { class: 'ctl-group-title' }, 'Start from'),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => load('bad') }, 'Everything bunched up'), el('button', { class: 'btn', onclick: () => load('good') }, 'Spread out')),
      el('div', { class: 'hint' }, 'Drag the parts. Heat sources: buck 1.2 W, LDO 0.8 W, SSD 2 W, and 1.5 W from the module through its connector.'));
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${NX * CELL * PX + 2 * OX} ${NY * CELL * PX + OY + 26}` });
    const img = svg('image', { x: OX, y: OY, width: NX * CELL * PX, height: NY * CELL * PX, preserveAspectRatio: 'none' });
    const gA = svg('g'), gP = svg('g'), gT = svg('g');
    S.append(img, gA, gP, gT);
    L.stage.append(S);
    const M = meters(L.stage, [{ key: 'hot', label: 'Hottest board spot' }, { key: 'buck', label: 'Board under buck' }, { key: 'cap', label: 'Electrolytic cap' }, { key: 'life', label: 'Cap life (5000 h @ 105 °C part)' }, { key: 'xt', label: 'RTC drift' }, { key: 'ssd', label: 'Board under SSD' }]);
    L.stage.append(el('div', { class: 'model-note' }, '2-D steady-state heat model: conduction through FR-4 + plane copper, convection + radiation from both faces (still air 20 W/m²K, fan 50 W/m²K), the fan\'s air warming as it crosses the board, and four M3 standoffs to a metal chassis (~14 K/W each). Cap life: 5000 h × 2^((105 − T)/10). RTC crystal: −0.034 ppm/°C² × (T − 25)². Board temperatures, not junction temperatures.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const cv = document.createElement('canvas'); cv.width = NX; cv.height = NY;
    const cx2 = cv.getContext('2d'); const imgD = cx2.createImageData(NX, NY);
    const N = NX * NY;
    let T = new Float64Array(N).fill(40), q = new Float64Array(N), Tair = new Float64Array(NX);
    const HOLES = [[4, 4], [116, 4], [4, 86], [116, 86]];
    const hS = new Float64Array(N);
    const X = v => OX + v * PX, Y = v => OY + v * PX;
    // module outline
    gA.append(svg('rect', { x: X(25), y: Y(6), width: 70 * PX, height: 45 * PX, rx: 6, fill: 'none', stroke: '#c9d1d6', 'stroke-dasharray': '6 4', opacity: 0.7 }), svg('text', { x: X(60), y: Y(28), 'text-anchor': 'middle', fill: '#eef1e8', 'font-size': 12, opacity: 0.85, text: 'module (its heatsink removes most of its heat)' }));
    HOLES.forEach(([hx, hy]) => gA.append(svg('circle', { cx: X(hx), cy: Y(hy), r: 9, fill: '#c9d1d6', stroke: '#555', 'stroke-width': 2 }), svg('circle', { cx: X(hx), cy: Y(hy), r: 4, fill: '#333' })));
    gA.append(svg('text', { x: X(9), y: Y(4) + 4, fill: '#fff', 'font-size': 9.5, style: 'paint-order:stroke', stroke: 'rgba(0,0,0,.5)', 'stroke-width': 3, text: 'standoff to metal chassis' }));
    const airTxt = svg('text', { x: X(60), y: Y(90) + 18, 'text-anchor': 'middle', fill: '#9fb5a8', 'font-size': 11 });
    gA.append(airTxt);
    const nodes = {};
    for (const k in P) {
      const p = P[k], g = svg('g');
      const r = svg('rect', { x: -p.w * PX / 2, y: -p.h * PX / 2, width: p.w * PX, height: p.h * PX, rx: 3, fill: p.fill, stroke: '#e8efe9', opacity: 0.92 });
      const t = svg('text', { y: -p.h * PX / 2 - 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10.5, 'font-weight': 650, style: 'paint-order:stroke', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3, text: p.label });
      const tv = svg('text', { y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10, 'font-family': 'var(--mono)' });
      g.append(r, t, tv); gP.append(g); nodes[k] = { g, tv };
      let off;
      PCB.draggable(S, g, {
        onStart: pt => { off = { x: (pt.x - OX) / PX - st.pos[k].x, y: (pt.y - OY) / PX - st.pos[k].y }; },
        onMove: pt => { st.pos[k] = { x: clamp((pt.x - OX) / PX - off.x, p.w / 2, 120 - p.w / 2), y: clamp((pt.y - OY) / PX - off.y, p.h / 2, 90 - p.h / 2) }; schedule(); },
      });
    }
    let pending = false;
    const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; solve(false); }); };
    const cellsOf = k => { const p = P[k], s = st.pos[k]; const i0 = Math.max(0, Math.floor((s.x - p.w / 2) / CELL)), i1 = Math.min(NX - 1, Math.ceil((s.x + p.w / 2) / CELL) - 1), j0 = Math.max(0, Math.floor((s.y - p.h / 2) / CELL)), j1 = Math.min(NY - 1, Math.ceil((s.y + p.h / 2) / CELL) - 1); const out = []; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(j * NX + i); return out; };
    function solve(full) {
      const kt = 0.3 * 1.6e-3 + { thin: 2 * 17.5e-6, std: 4 * 35e-6, heavy: 4 * 70e-6 }[st.cu] * 390; // W/K per square
      const hA = (st.air === 'none' ? 20 : 50) * (CELL * 1e-3) ** 2; // W/K per cell (both faces)
      q.fill(0);
      for (const k in P) if (P[k].W) { const c = cellsOf(k); c.forEach(i => (q[i] += P[k].W / c.length)); }
      // module heat via connector strip x 28..92, y 47..51
      { const c = []; for (let j = Math.floor(47 / CELL); j <= Math.floor(50.9 / CELL); j++) for (let i = Math.floor(28 / CELL); i <= Math.floor(91.9 / CELL); i++) c.push(j * NX + i); c.forEach(i => (q[i] += 1.5 / c.length)); }
      Tair.fill(st.amb);
      hS.fill(0);
      if (st.mount) HOLES.forEach(([hx, hy]) => { const i0 = Math.floor(hx / CELL), j0 = Math.floor(hy / CELL); for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) hS[(j0 + dj) * NX + i0 + di] += 0.07 / 4; });
      if (full) T.fill(st.amb + 5);
      const passes = st.air === 'none' ? 1 : 3;
      const iters = full ? 700 : 160;
      const w = 1.9;
      for (let ps = 0; ps < passes; ps++) {
        for (let it = 0; it < iters; it++) {
          for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
            const k = j * NX + i;
            let sum = 0, gs = 0;
            if (i > 0) { sum += T[k - 1]; gs++; } if (i < NX - 1) { sum += T[k + 1]; gs++; }
            if (j > 0) { sum += T[k - NX]; gs++; } if (j < NY - 1) { sum += T[k + NX]; gs++; }
            const nv = (kt * sum + hA * Tair[i] + hS[k] * st.amb + q[k]) / (kt * gs + hA + hS[k]);
            T[k] += w * (nv - T[k]);
          }
        }
        if (st.air !== 'none') {
          const mcp = 1.0; // W/K of air flowing across the board
          const cols = st.air === 'lr' ? [...Array(NX).keys()] : [...Array(NX).keys()].reverse();
          let ta = st.amb;
          for (const i of cols) { Tair[i] = ta; let qc = 0; for (let j = 0; j < NY; j++) qc += hA * (T[j * NX + i] - ta); ta += qc / mcp; }
        }
      }
      render();
    }
    function render() {
      const span = 35;
      for (let k = 0; k < N; k++) { const c = PCB.heat((T[k] - st.amb) / span); imgD.data[4 * k] = c[0]; imgD.data[4 * k + 1] = c[1]; imgD.data[4 * k + 2] = c[2]; imgD.data[4 * k + 3] = 255; }
      cx2.putImageData(imgD, 0, 0);
      img.setAttribute('href', cv.toDataURL());
      const avg = k => { const c = cellsOf(k); return c.reduce((s, i) => s + T[i], 0) / c.length; };
      const mx = k => Math.max(...cellsOf(k).map(i => T[i]));
      for (const k in nodes) { nodes[k].g.setAttribute('transform', `translate(${X(st.pos[k].x)} ${Y(st.pos[k].y)})`); nodes[k].tv.textContent = Math.round(P[k].W ? mx(k) : avg(k)) + '°'; }
      airTxt.textContent = st.air === 'none' ? 'Still air: heat leaves by natural convection only' : st.air === 'lr' ? `Fan air enters at the left at ${st.amb} °C and leaves at the right at ${sig(Tair[NX - 1], 3)} °C →` : `← Fan air enters at the right at ${st.amb} °C and leaves at the left at ${sig(Tair[0], 3)} °C`;
      let hot = -Infinity, cold = Infinity; for (let k = 0; k < N; k++) { hot = Math.max(hot, T[k]); cold = Math.min(cold, T[k]); }
      const lifeAt = t => 5000 * Math.pow(2, (105 - t) / 10) / 8760;
      const tb = mx('buck'), tc = avg('cap'), tx = avg('xtal'), ts = avg('ssd');
      const life = 5000 * Math.pow(2, (105 - tc) / 10) / 8760;
      const ppm = 0.034 * (tx - 25) ** 2, spd = ppm * 0.0864;
      M.set('hot', sig(hot, 3) + ' °C', hot > 100 ? 'bad' : hot > 85 ? 'warn' : 'good');
      M.set('buck', sig(tb, 3) + ' °C', tb > 100 ? 'bad' : tb > 85 ? 'warn' : 'good');
      M.set('cap', sig(tc, 3) + ' °C', tc > 70 ? 'bad' : tc > 55 ? 'warn' : 'good');
      M.set('life', sig(life, 2) + ' years', life < 3 ? 'bad' : life < 8 ? 'warn' : 'good');
      M.set('xt', `${sig(spd, 2)} s/day`, spd > 4 ? 'bad' : spd > 1.5 ? 'warn' : 'good');
      M.set('ssd', sig(ts, 3) + ' °C', ts > 70 ? 'bad' : ts > 60 ? 'warn' : 'good');
      const items = [];
      const near = (a, b) => rectDist({ x0: st.pos[a].x - P[a].w / 2, x1: st.pos[a].x + P[a].w / 2, y0: st.pos[a].y - P[a].h / 2, y1: st.pos[a].y + P[a].h / 2 }, { x0: st.pos[b].x - P[b].w / 2, x1: st.pos[b].x + P[b].w / 2, y0: st.pos[b].y - P[b].h / 2, y1: st.pos[b].y + P[b].h / 2 });
      items.push({ level: life < 3 ? 'bad' : life < 8 ? 'warn' : 'good', html: `Electrolytic cap at ${Math.round(tc)} °C: about <b>${sig(life, 2)} years</b> of life (rated 5000 h at 105 °C, doubling every 10 °C cooler). The coolest spot on this board is ${Math.round(cold)} °C, where it would last ${sig(lifeAt(cold), 2)} years.${near('cap', 'buck') < 8 || near('cap', 'ldo') < 8 ? ' Right now it is next to a regulator.' : ''}` });
      items.push({ level: spd > 4 ? 'bad' : spd > 1.5 ? 'warn' : 'good', html: `RTC crystal at ${Math.round(tx)} °C: ${sig(ppm, 2)} ppm slow, about <b>${sig(spd * 30, 2)} s per month</b> of clock error. Tuning-fork crystals are most accurate at 25 °C, so in a warm enclosure the cool spots matter (or use NTP / RTC calibration).` });
      if (near('buck', 'ldo') < 6) items.push({ level: 'warn', html: 'Buck and LDO are side by side, so their heat adds in one spot. Spread heat sources so each gets its own copper to spread into.' });
      if (ts > 60) items.push({ level: ts > 70 ? 'bad' : 'warn', html: `The SSD sits on ${Math.round(ts)} °C copper. NVMe drives throttle when their own sensor (hotter than the board) passes ~70 °C.` });
      if (st.air !== 'none') items.push({ level: 'info', html: 'With a fan, parts downstream breathe air already warmed by everything upstream. Put sensitive parts at the inlet side and the hottest parts near the outlet.' });
      if (!st.mount) items.push({ level: 'info', html: 'Without the metal standoffs, all the heat has to leave through the air. The standoffs are heat sinks too: parts near them run coolest.' });
      if (st.cu === 'thin') items.push({ level: 'info', html: 'Thin, few planes spread heat poorly, so hot spots get hotter. Planes are heat spreaders as well as electrical references.' });
      V.set(items);
      E.set(`<p>The board is a heat spreader. Copper planes conduct heat sideways ~1000× better than FR-4, then both faces hand it to the air. More copper widens the warm area and lowers the peak; airflow raises the transfer coefficient but heats the air as it goes.</p><p>Heat makes two quiet failures: <b>capacitor wear-out</b> (electrolyte evaporates, roughly 2× faster per +10 °C) and <b>drift</b> (crystals, references, sensors). Neither fails on the bench; both fail in the field, in summer.</p>`);
    }
    load('bad');
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Your USB3 and Ethernet connectors are on the board edge in the reverse order of their pin groups on the module connector. What does that cost?', opts: ['Nothing, only length matters', 'Their routes must cross: at least one pair changes layer, adding vias, stubs and a reference change', 'Ethernet will not link'], a: 1, ex: 'Crossing ratsnest lines become layer changes. Swapping the two connectors usually removes the crossing for free.' },
    { q: 'An M.2 connector placed at 0° gives a fully reversed lane order, and 180° is mechanically impossible. Best option?', opts: ['Route the crossings with vias', 'If the design guide allows it, use lane reversal (and polarity inversion for P/N) in the schematic', 'Move the module'], a: 1, ex: 'Lane reversal is optional in PCIe; polarity inversion is required of PCIe receivers. Check the module guide first, then make the change in the schematic.' },
    { q: 'Moving an electrolytic capacitor from 75 °C to 55 °C changes its expected life by about…', opts: ['10%', '2×', '4×'], a: 2, ex: 'Life roughly doubles for each 10 °C drop: 20 °C → 4×.' },
    { q: 'Where should a temperature-sensitive part go on a fan-cooled board?', opts: ['Downstream of the hot parts, where the air moves fastest', 'Upstream, near the air inlet, away from regulators', 'Under the module'], a: 1, ex: 'Air warms as it crosses hot parts, so downstream parts sit in pre-heated air.' },
  ]);
})();
