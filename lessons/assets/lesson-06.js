/* Lesson 6 — Buck converter layout */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, geo, legend } = PCB;

  PCB.renderChrome({ lesson: 6 });

  /* =================================================================
     6.1  Current paths
     ================================================================= */
  (function labPaths() {
    const host = document.getElementById('lab-paths'); if (!host) return;
    const L = lab(host, { title: 'Current paths in a diode-rectified buck (ROHM Fig. 1–3)' });
    const st = { mode: 'auto', phase: 'on' };
    const sM = seg({ label: 'Show', options: [{ v: 'auto', label: 'Switching (animated)' }, { v: 'on', label: 'Q1 on' }, { v: 'off', label: 'Q1 off' }, { v: 'diff', label: 'Difference = hot loop' }], value: st.mode, onChange: v => { st.mode = v; if (v !== 'auto') st.phase = v; draw(); } });
    L.controls.append(sM.el, el('div', { class: 'hint' }, 'Yellow dots: current during the selected state. Red: the loop whose current switches abruptly every cycle.'));
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 290' });
    const gS = svg('g'), gHot = svg('g'), gD = svg('g');
    S.append(gHot, gS, gD);
    L.stage.append(S);
    const V = verdicts(L.left, 'What to notice');
    const E = explain(L.right, 'Why');
    const T = 64, B = 240;
    const PATHS = {
      on: [{ x: 40, y: B }, { x: 40, y: T }, { x: 300, y: T }, { x: 540, y: T }, { x: 540, y: B }, { x: 40, y: B }],
      off: [{ x: 300, y: B }, { x: 300, y: T }, { x: 540, y: T }, { x: 540, y: B }, { x: 300, y: B }],
      diff: [{ x: 170, y: B }, { x: 170, y: T }, { x: 300, y: T }, { x: 300, y: B }, { x: 170, y: B }],
    };
    function cap(x, lbl) { return [svg('line', { x1: x, y1: T, x2: x, y2: 145, stroke: '#cfe0d5', 'stroke-width': 2 }), svg('line', { x1: x - 14, y1: 145, x2: x + 14, y2: 145, stroke: '#cfe0d5', 'stroke-width': 3 }), svg('line', { x1: x - 14, y1: 155, x2: x + 14, y2: 155, stroke: '#cfe0d5', 'stroke-width': 3 }), svg('line', { x1: x, y1: 155, x2: x, y2: B, stroke: '#cfe0d5', 'stroke-width': 2 }), svg('text', { x: x + 18, y: 154, fill: '#cfe0d5', 'font-size': 11, text: lbl })]; }
    function draw() {
      const ph = st.mode === 'auto' ? st.phase : st.mode;
      gS.innerHTML = '';
      const W = '#cfe0d5';
      gS.append(svg('line', { x1: 40, y1: T, x2: 228, y2: T, stroke: W, 'stroke-width': 2 }), svg('line', { x1: 292, y1: T, x2: 320, y2: T, stroke: W, 'stroke-width': 2 }), svg('line', { x1: 410, y1: T, x2: 540, y2: T, stroke: W, 'stroke-width': 2 }), svg('line', { x1: 40, y1: B, x2: 540, y2: B, stroke: W, 'stroke-width': 2 }));
      // source
      gS.append(svg('line', { x1: 40, y1: T, x2: 40, y2: 140, stroke: W, 'stroke-width': 2 }), svg('line', { x1: 26, y1: 140, x2: 54, y2: 140, stroke: W, 'stroke-width': 3 }), svg('line', { x1: 32, y1: 150, x2: 48, y2: 150, stroke: W, 'stroke-width': 3 }), svg('line', { x1: 40, y1: 150, x2: 40, y2: B, stroke: W, 'stroke-width': 2 }), svg('text', { x: 14, y: 130, fill: W, 'font-size': 11, text: 'VIN' }));
      gS.append(...cap(110, 'C_IN'), ...cap(170, 'C_BYP'), ...cap(460, 'C_OUT'));
      // Q1 switch
      const closed = ph === 'on' || ph === 'diff';
      gS.append(svg('circle', { cx: 230, cy: T, r: 3, fill: W }), svg('circle', { cx: 290, cy: T, r: 3, fill: W }),
        svg('line', { x1: 230, y1: T, x2: 290, y2: closed && ph !== 'diff' ? T : T - 26, stroke: W, 'stroke-width': 3 }),
        svg('text', { x: 260, y: T - 32, 'text-anchor': 'middle', fill: W, 'font-size': 11, text: 'Q1 ' + (ph === 'diff' ? '' : closed ? '(on)' : '(off)') }));
      // diode (cathode up)
      gS.append(svg('line', { x1: 300, y1: T, x2: 300, y2: 135, stroke: W, 'stroke-width': 2 }), svg('path', { d: 'M 286 165 L 314 165 L 300 140 Z', fill: W }), svg('line', { x1: 286, y1: 138, x2: 314, y2: 138, stroke: W, 'stroke-width': 3 }), svg('line', { x1: 300, y1: 165, x2: 300, y2: B, stroke: W, 'stroke-width': 2 }), svg('text', { x: 318, y: 158, fill: W, 'font-size': 11, text: 'D1' }));
      // inductor
      let d = 'M 320 64'; for (let i = 0; i < 5; i++) d += ` a 9 9 0 0 1 18 0`;
      gS.append(svg('path', { d, fill: 'none', stroke: W, 'stroke-width': 2.5 }), svg('text', { x: 365, y: 44, 'text-anchor': 'middle', fill: W, 'font-size': 11, text: 'L' }), svg('text', { x: 300, y: 50, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10.5, text: 'SW' }));
      // load
      let z = `M 540 ${T} L 540 110`; for (let i = 0; i < 6; i++) z += ` L ${i % 2 ? 530 : 550} ${118 + i * 12}`; z += ` L 540 190 L 540 ${B}`;
      gS.append(svg('path', { d: z, fill: 'none', stroke: W, 'stroke-width': 2 }), svg('text', { x: 556, y: 154, fill: W, 'font-size': 11, text: 'LOAD' }));
      gHot.innerHTML = '';
      if (ph === 'diff') gHot.append(svg('rect', { x: 170, y: T, width: 130, height: B - T, fill: 'rgba(255,80,60,.18)', stroke: '#ff6b5b', 'stroke-width': 2, 'stroke-dasharray': '6 4' }), svg('text', { x: 235, y: B + 22, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 12, 'font-weight': 700, text: 'HOT LOOP: current jumps every edge' }));
      const items = [];
      if (ph === 'on') items.push({ level: 'info', html: '<b>Q1 on:</b> current flows from the input through Q1 and L to the output. At the instant Q1 turns on, the sudden demand is met first by <b>C_BYP</b>, then C_IN, then the input supply (ROHM §1.2).' });
      if (ph === 'off') items.push({ level: 'info', html: '<b>Q1 off:</b> the inductor keeps its current flowing, now through D1 from ground. The output side barely notices: L smooths everything after it.' });
      if (ph === 'diff') items.push({ level: 'bad', html: '<b>Hot loop:</b> C_BYP → Q1 → SW → D1 → GND → C_BYP carries current in one state and none in the other, switched in a few ns. This loop gets the shortest, widest copper on the board.' });
      items.push({ level: 'good', html: 'The inductor, C_OUT and load current are smooth (triangular ripple), so those paths are much less critical.' });
      V.set(items);
      E.set('<p>Compare the two states: wherever current flows in <i>both</i> (through L to the load), it changes only slowly. Wherever it flows in only one, it switches between 0 and the full load current in nanoseconds, a di/dt of ~10<sup>9</sup> A/s.</p><p>With V = L·di/dt, 1 nH in that loop gives ~1 V of spike. That is why ROHM says the input capacitor and diode are "the most important components" and come first.</p>');
    }
    // dots
    const dots = []; for (let i = 0; i < 18; i++) { const n = svg('circle', { r: 3.4 }); gD.append(n); dots.push({ n, s: i / 18 }); }
    let last = 0, tPh = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (st.mode === 'auto') { tPh += dt; if (tPh > 1.6) { tPh = 0; st.phase = st.phase === 'on' ? 'off' : 'on'; draw(); } }
      const ph = st.mode === 'auto' ? st.phase : st.mode;
      const P = PATHS[ph], len = geo.polyLen(P);
      for (const d of dots) { d.s = (d.s + dt * 0.22) % 1; const q = geo.along(P, d.s * len); setAttrs(d.n, { cx: q.x, cy: q.y, fill: ph === 'diff' ? '#ff6b5b' : '#ffd166' }); }
    });
    draw();
  })();

  /* =================================================================
     6.2  Layout sandbox
     ================================================================= */
  (function labBuck() {
    const host = document.getElementById('lab-buck'); if (!host) return;
    const L = lab(host, { title: 'Lay out a 12 V → 5 V, 2 A buck' });
    const BW = 50, BH = 34, PX = 12;
    const VIN = 12, IOUT = 2, FSW = 500e3;
    const IC = { x: 27, y: 15, w: 5, h: 5 };
    const PIN = { VIN: { x: 27, y: 16 }, GND: { x: 27, y: 19 }, SW: { x: 32, y: 16 }, FB: { x: 29.5, y: 20 } };
    const PART = {
      cbyp: { label: 'C_BYP', w: 1.3, h: 2.0, t: [[0, -0.8], [0, 0.8]], fill: '#b9a37a' },
      cin: { label: 'C_IN', w: 2.0, h: 3.4, t: [[0, -1.4], [0, 1.4]], fill: '#a08a63' },
      d1: { label: 'D1', w: 2.8, h: 4.6, t: [[0, -1.9], [0, 1.9]], fill: '#2b2b2b' },
      ind: { label: 'L', w: 6.6, h: 6.6, t: [[-3.0, 0], [3.0, 0]], fill: '#3a3f44' },
      cout: { label: 'C_OUT', w: 2.0, h: 3.4, t: [[0, -1.4], [0, 1.4]], fill: '#a08a63' },
      rfb: { label: 'R_FB', w: 2.4, h: 3.0, t: [[0, -1.2], [0, 1.2]], fill: '#1d2a33' },
    };
    const PRE = {
      good: { cbyp: [25.1, 17.5], cin: [21.5, 17.5], d1: [34.2, 19.6], ind: [39.6, 14.5], cout: [45, 21], rfb: [29.5, 24.8] },
      bad: { cbyp: [17, 7], cin: [9, 26], d1: [41, 28], ind: [44, 9], cout: [30, 30], rfb: [41, 19.5] },
    };
    const st = { pos: {}, back: false, gndUnder: false, sense: 'cout', vias: 9, swCu: 40 };
    const load = k => { for (const p in PRE[k]) st.pos[p] = { x: PRE[k][p][0], y: PRE[k][p][1] }; if (k === 'bad') { st.sense = 'ind'; st.vias = 0; st.swCu = 160; } else { st.sense = 'cout'; st.vias = 9; st.swCu = 40; } sSense.set(st.sense); sV.set(st.vias); sSw.set(st.swCu); update(); };
    const cBack = check({ label: 'Put C_BYP on the back side, through vias (ROHM Fig. 16)', onChange: v => { st.back = v; update(); } });
    const cG = check({ label: 'Ground plane directly under the inductor', onChange: v => { st.gndUnder = v; update(); } });
    const sSense = seg({ label: 'Feedback senses V_OUT at', options: [{ v: 'cout', label: 'C_OUT terminal' }, { v: 'ind', label: 'inductor output' }], value: st.sense, onChange: v => { st.sense = v; update(); } });
    const sSw = slider({ label: 'Extra switch-node copper (pour)', min: 0, max: 300, step: 10, value: st.swCu, fmt: v => v + ' mm²', onInput: v => { st.swCu = v; update(); } });
    const sV = slider({ label: 'Thermal vias under the IC pad', min: 0, max: 16, step: 1, value: st.vias, fmt: v => String(v), onInput: v => { st.vias = v; update(); } });
    L.controls.append(cBack.el, cG.el, sSense.el, sSw.el, sV.el,
      el('div', { class: 'ctl-group-title' }, 'Start from'),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => load('good') }, 'ROHM-style good layout'), el('button', { class: 'btn', onclick: () => load('bad') }, 'Bad layout (Fig. 18)')),
      el('div', { class: 'hint' }, 'Drag any part on the board.'));
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX} ${BH * PX}` });
    const gBg = svg('g'), gHot = svg('g'), gW = svg('g'), gP = svg('g'), gT = svg('g');
    S.append(gBg, gHot, gW, gP, gT);
    L.stage.append(S, legend([['#ff8f6b', 'VIN'], ['#ffd166', 'switch node'], ['#77d48b', 'power GND'], ['#ff5d6c', 'V_OUT'], ['#5cb8ff', 'feedback'], ['rgba(255,80,60,.6)', 'hot loop area']]));
    const plot = new Plot(L.stage, { title: 'Switch-node voltage at the Q1 turn-on edge', height: 190, xmin: 0, xmax: 60, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [
      { key: 'A', label: 'Hot-loop area' }, { key: 'L', label: 'Hot-loop inductance' }, { key: 'f', label: 'Ringing frequency' }, { key: 'pk', label: 'SW peak' },
      { key: 'emi', label: 'EMI margin (FCC B)' }, { key: 'fb', label: 'Noise into FB' }, { key: 'out', label: 'Output spikes' }, { key: 'tj', label: 'IC junction temp' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Hot-loop L ≈ 1.0 nH (IC + capacitor) + 0.3 nH per mm of external path over the GND plane (ROHM\'s ~1 nH/mm applies without a plane); overshoot saturates as L grows; C_oss ≈ 400 pF + switch-node copper. Emission: Ott loop formula with the ringing burst repeated at 500 kHz. Feedback and output noise use simple distance-coupling models. Illustrative magnitudes.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const nodes = {};
    for (const k in PART) {
      const p = PART[k], g = svg('g');
      g.append(svg('rect', { x: -p.w * PX / 2, y: -p.h * PX / 2, width: p.w * PX, height: p.h * PX, rx: 3, fill: p.fill, stroke: '#e8efe9', 'stroke-width': 1 }));
      p.t.forEach(([dx, dy]) => g.append(svg('rect', { x: dx * PX - 5, y: dy * PX - 4, width: 10, height: 8, fill: '#e0a64a' })));
      g.append(svg('text', { y: k === 'ind' ? 4 : p.h * PX / 2 + 12, 'text-anchor': 'middle', fill: '#eef1e8', 'font-size': 10.5, 'font-weight': 650, text: p.label }));
      if (k === 'd1') g.append(svg('rect', { x: -p.w * PX / 2, y: -p.h * PX / 2 + 4, width: p.w * PX, height: 5, fill: '#cfd6da' }));
      gP.append(g); nodes[k] = g;
      let off;
      PCB.draggable(S, g, {
        onStart: q => { off = { x: q.x / PX - st.pos[k].x, y: q.y / PX - st.pos[k].y }; },
        onMove: q => { st.pos[k] = { x: clamp(q.x / PX - off.x, p.w / 2 + 0.5, BW - p.w / 2 - 0.5), y: clamp(q.y / PX - off.y, p.h / 2 + 0.5, BH - p.h / 2 - 0.5) }; update(); },
      });
    }
    const term = (k, i) => ({ x: st.pos[k].x + PART[k].t[i][0], y: st.pos[k].y + PART[k].t[i][1] });
    const g2 = (d, s) => 1 / (1 + (d / s) * (d / s));

    function update() {
      for (const k in nodes) nodes[k].setAttribute('transform', `translate(${st.pos[k].x * PX} ${st.pos[k].y * PX})`);
      const cp = term('cbyp', 0), cm = term('cbyp', 1), K = term('d1', 0), A = term('d1', 1);
      const i1 = term('ind', 0), i2 = term('ind', 1), op = term('cout', 0), om = term('cout', 1), inp = term('cin', 0), inm = term('cin', 1);
      const r1 = term('rfb', 0), r2 = term('rfb', 1);
      const sense = st.sense === 'cout' ? op : i2;
      // hot loop
      const ext = geo.dist(cp, PIN.VIN) + geo.dist(PIN.SW, K) + geo.dist(A, cm);
      const Lhot = 1.0 + 0.3 * ext + (st.back ? 1.6 : 0); // ≈0.3 nH/mm with the GND plane 0.1 mm below
      const poly = [cp, PIN.VIN, PIN.SW, K, A, cm];
      const Ahot = Math.abs(geo.area(poly));
      const swLen = geo.dist(PIN.SW, K) + geo.dist(PIN.SW, i1);
      const swArea = st.swCu + 1.5 * swLen;
      const Coss = 400e-12 + phys.plateC(swArea, 0.1);
      const f = 1 / (2 * Math.PI * Math.sqrt(Lhot * 1e-9 * Coss));
      const Z = Math.sqrt(Lhot * 1e-9 / Coss);
      const Q = 4, dV = VIN * 0.9 * (1 - Math.exp(-Lhot / 12)); // overshoot grows with loop L, saturating (damped by Q)
      const vpk = VIN + dV;
      const tau = Q / (Math.PI * f);
      const Ih = 2 * IOUT * FSW * tau;
      const lim = phys.fccB(f);
      const Edb = phys.dBuV(phys.ottE(f, (Ahot + 4) * 1e-6, Ih)) + (swArea > 100 ? 20 * Math.log10(swArea / 100) : 0);
      const margin = lim == null ? 99 : lim - Edb;
      // feedback noise
      const swSegs = [[PIN.SW, K], [PIN.SW, i1]];
      let fb = 0, under = false;
      const indRect = { x0: st.pos.ind.x - 3.3, x1: st.pos.ind.x + 3.3, y0: st.pos.ind.y - 3.3, y1: st.pos.ind.y + 3.3 };
      for (const [a, b, wgt] of [[sense, r1, 0.25], [r2, PIN.FB, 1]]) {
        const n = Math.max(2, Math.ceil(geo.dist(a, b) / 0.5));
        let worst = 0;
        for (let i = 0; i <= n; i++) {
          const p = { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n };
          const dsw = Math.min(...swSegs.map(s => geo.segDist(p, s[0], s[1]).d));
          const dind = Math.max(0, geo.dist(p, st.pos.ind) - 3.3);
          if (p.x > indRect.x0 && p.x < indRect.x1 && p.y > indRect.y0 && p.y < indRect.y1) under = true;
          worst = Math.max(worst, 25 * g2(dsw, 1.5) + 15 * g2(dind, 1.5));
        }
        fb += wgt * worst;
      }
      const hiZ = geo.dist(r2, PIN.FB);
      fb += Math.max(0, hiZ - 5) * 0.4 + (under ? 10 : 0) + (st.sense === 'ind' ? 3 : 0);
      // output spikes
      const dg = Math.min(geo.dist(inm, om), geo.dist(cm, om));
      const out = 40 * g2(dg, 7) + 0.6 * geo.dist(i2, op) + (st.gndUnder ? 4 : 0);
      // thermal
      const theta = 30 + 60 * Math.exp(-st.vias / 5);
      const tj = 50 + 0.9 * theta;

      // ---- draw
      gBg.innerHTML = '';
      gBg.append(svg('rect', { x: 0, y: 0, width: BW * PX, height: BH * PX, fill: 'var(--plane)', opacity: 0.45 }));
      gBg.append(svg('text', { x: 8, y: BH * PX - 8, fill: 'var(--gnd)', 'font-size': 10.5, text: 'GND plane on L2 (cut out under the inductor unless ticked)' }));
      if (!st.gndUnder) gBg.append(svg('rect', { x: indRect.x0 * PX, y: indRect.y0 * PX, width: 6.6 * PX, height: 6.6 * PX, fill: 'var(--board)', stroke: '#2f6b51', 'stroke-dasharray': '4 3' }));
      for (let r = 1; r <= 3; r++) gBg.append(svg('circle', { cx: st.pos.ind.x * PX, cy: st.pos.ind.y * PX, r: (3.3 + r * 2.5) * PX, fill: 'none', stroke: '#ffd166', opacity: 0.32 / r }));
      // IC + thermal vias
      gBg.append(svg('rect', { x: IC.x * PX, y: IC.y * PX, width: IC.w * PX, height: IC.h * PX, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x: (IC.x + IC.w / 2) * PX, y: (IC.y + 2.9) * PX, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 10.5, 'font-weight': 650, text: 'BUCK IC' }));
      for (let i = 0; i < st.vias; i++) gBg.append(svg('circle', { cx: (IC.x + 1.2 + (i % 4) * 0.87) * PX, cy: (IC.y + 3.3 + Math.floor(i / 4) * 0.4) * PX, r: 2.2, fill: '#e0a64a' }));
      for (const k in PIN) gBg.append(svg('rect', { x: PIN[k].x * PX - 4, y: PIN[k].y * PX - 4, width: 8, height: 8, fill: '#e0a64a' }), svg('text', { x: PIN[k].x * PX + (k === 'SW' ? 8 : k === 'FB' ? 0 : -8), y: PIN[k].y * PX + (k === 'FB' ? 16 : 4), 'text-anchor': k === 'SW' ? 'start' : k === 'FB' ? 'middle' : 'end', fill: '#cfe0d5', 'font-size': 9.5, text: k }));
      gHot.innerHTML = '';
      gHot.append(svg('path', { d: geo.pathD(poly.map(p => ({ x: p.x * PX, y: p.y * PX }))) + ' Z', fill: 'rgba(255,80,60,.22)', stroke: '#ff6b5b', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }));
      gW.innerHTML = '';
      const wire = (a, b, c, w) => gW.append(svg('line', { x1: a.x * PX, y1: a.y * PX, x2: b.x * PX, y2: b.y * PX, stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', opacity: 0.95 }));
      wire(PIN.VIN, cp, '#ff8f6b', 10); wire(PIN.VIN, inp, '#ff8f6b', 8);
      wire(PIN.GND, cm, '#77d48b', 10); wire(cm, A, '#77d48b', 10); wire(inm, cm, '#77d48b', 8); wire(om, A, '#77d48b', 8);
      wire(PIN.SW, K, '#ffd166', 12); wire(PIN.SW, i1, '#ffd166', 12);
      if (st.swCu > 0) gW.append(svg('circle', { cx: (PIN.SW.x + i1.x) / 2 * PX, cy: (PIN.SW.y + i1.y) / 2 * PX, r: Math.sqrt(st.swCu / Math.PI) * PX, fill: '#ffd166', opacity: 0.28 }));
      wire(i2, op, '#ff5d6c', 10);
      wire(sense, r1, '#5cb8ff', 3); wire(r2, PIN.FB, '#5cb8ff', 3);
      gT.innerHTML = '';
      if (st.back) gT.append(svg('text', { x: st.pos.cbyp.x * PX, y: (st.pos.cbyp.y - 2) * PX, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 10, text: '(bottom side)' }));
      if (under) gT.append(svg('text', { x: st.pos.ind.x * PX, y: (st.pos.ind.y + 5.4) * PX, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 10.5, 'font-weight': 700, text: 'FB under inductor!' }));

      // ---- waveform
      const ts = [], vs = [];
      for (let i = 0; i <= 600; i++) {
        const t = i * 0.1; ts.push(t);
        const t0 = 8, tr = 3;
        let v = VIN * PCB.ramp(t, t0, tr);
        if (t > t0 + tr) { const u = (t - t0 - tr) * 1e-9; v += dV * Math.exp(-u / tau) * Math.sin(2 * Math.PI * f * u); }
        vs.push(v);
      }
      plot.draw({ series: [{ x: ts, y: vs, color: '#e0a64a', width: 2.2 }], hlines: [{ y: 20, color: 'var(--bad)', label: 'SW pin abs. max (illustrative 20 V)' }, { y: VIN, color: 'var(--faint)', dash: [2, 3] }], range: { ymin: -4, ymax: Math.max(24, vpk * 1.1) } });

      // ---- meters
      M.set('A', sig(Ahot, 3) + ' mm²', Ahot > 120 ? 'bad' : Ahot > 50 ? 'warn' : 'good');
      M.set('L', sig(Lhot, 2) + ' nH', Lhot > 10 ? 'bad' : Lhot > 6 ? 'warn' : 'good');
      M.set('f', fmtSI(f, 'Hz'));
      M.set('pk', sig(vpk, 3) + ' V', vpk > 20 ? 'bad' : vpk > 17 ? 'warn' : 'good');
      M.set('emi', lim == null ? 'below 30 MHz' : sig(margin, 2) + ' dB', margin < 0 ? 'bad' : margin < 6 ? 'warn' : 'good');
      M.set('fb', sig(fb, 2) + ' mV', fb > 8 ? 'bad' : fb > 3 ? 'warn' : 'good');
      M.set('out', sig(out, 2) + ' mV', out > 20 ? 'bad' : out > 10 ? 'warn' : 'good');
      M.set('tj', sig(tj, 3) + ' °C', tj > 125 ? 'bad' : tj > 105 ? 'warn' : 'good');

      const items = [];
      items.push({ level: Lhot > 10 ? 'bad' : Lhot > 6 ? 'warn' : 'good', html: `Hot loop: ${sig(ext, 2)} mm of external path → <b>${sig(Lhot, 2)} nH</b>. The switch node rings at ${fmtSI(f, 'Hz')} and overshoots to <b>${sig(vpk, 3)} V</b>${vpk > 20 ? ', beyond the IC\'s rating. Repeated overshoot like this damages parts' : ''}.` });
      if (st.back) items.push({ level: 'bad', html: 'C_BYP on the back side puts two vias in the hot loop. ROHM: "this kind of layout must never be used" (Fig. 16).' });
      if (margin < 6 && lim != null) items.push({ level: margin < 0 ? 'bad' : 'warn', html: `Radiated emission from the ${sig(Ahot, 3)} mm² loop${swArea > 100 ? ' and the large switch-node pour' : ''} has ${sig(margin, 2)} dB margin at ${fmtSI(f, 'Hz')}. ROHM §3.3: the 100–300 MHz band is set by this loop.` });
      if (swArea > 120) items.push({ level: 'warn', html: `${sig(swArea, 3)} mm² of switch-node copper is an antenna swinging 12 V in ns. ROHM §2.3.2: no larger than the current needs (≈1 mm width for 2 A on 1 oz).` });
      if (geo.dist(PIN.SW, i1) > 8) items.push({ level: 'warn', html: `The inductor is ${sig(geo.dist(PIN.SW, i1), 2)} mm from the SW pin. Every mm of switch-node trace radiates. Move it closer (ROHM §2.3.2).` });
      if (st.gndUnder) items.push({ level: 'warn', html: 'Copper directly under the inductor: its field induces <b>eddy currents</b> in the plane, lowering inductance and Q (more loss) and injecting switching noise into ground (ROHM §2.3.2).' });
      if (under) items.push({ level: 'bad', html: 'The feedback trace runs <b>under the inductor</b>: its magnetic field couples straight into the regulator\'s error amplifier.' });
      if (fb > 3) items.push({ level: fb > 8 ? 'bad' : 'warn', html: `${sig(fb, 2)} mV of switching noise reaches the FB pin (0.8 V reference): output errors and possible instability. Keep the divider at the FB pin and route away from SW and L (ROHM §2.5).` });
      else items.push({ level: 'good', html: 'The feedback path is short and away from the switch node and inductor.' });
      if (st.sense === 'ind') items.push({ level: 'warn', html: 'Sensing at the inductor output, before C_OUT, regulates the wrong point (it includes ripple and the C_OUT path). ROHM: sense at or after the output capacitor.' });
      if (dg < 10) items.push({ level: out > 20 ? 'bad' : 'warn', html: `C_OUT's ground is only ${sig(dg, 2)} mm from the input-side ground, so the hundreds-of-MHz noise there leaks to the output. ROHM §2.4: separate them by 1–2 cm.` });
      if (tj > 105) items.push({ level: tj > 125 ? 'bad' : 'warn', html: `Junction ≈ ${sig(tj, 3)} °C with ${st.vias} thermal vias (θ ≈ ${sig(theta, 2)} °C/W). Add vias directly under the exposed pad (ROHM §2.2: ~0.3 mm drill, ~1.2 mm pitch).` });
      V.set(items);
      E.set(`<p>Each ROHM rule shows up as a meter: the <b>hot loop</b> sets ringing and emissions, <b>switch-node copper</b> radiates electric field, the <b>inductor</b> radiates magnetic field into whatever is near or under it, the <b>feedback</b> pin is high impedance and picks everything up, and the <b>thermal vias</b> set the IC temperature.</p><p>Try the bad preset, then fix one rule at a time in ROHM's order.</p>`);
    }
    load('good');
  })();

  /* =================================================================
     6.3  Ringing vs snubber vs slow edges
     ================================================================= */
  (function labSnub() {
    const host = document.getElementById('lab-snub'); if (!host) return;
    const L = lab(host, { title: 'Damping the switch-node ringing' });
    const VIN = 12, I = 2, FSW = 500e3, POUT = 10;
    const st = { L: 6, C: 400, tr: 2, sn: false, Cs: 1000, Rs: 4 };
    const sL = slider({ label: 'Hot-loop inductance (from layout)', min: 1, max: 20, step: 0.5, value: st.L, fmt: v => v + ' nH', onInput: v => { st.L = v; update(); } });
    const sC = slider({ label: 'Switch-node capacitance', min: 150, max: 1200, step: 10, value: st.C, fmt: v => v + ' pF', onInput: v => { st.C = v; update(); } });
    const sT = slider({ label: 'Edge time (BOOT / gate resistor)', min: 1, max: 20, step: 0.5, value: st.tr, fmt: v => v + ' ns', onInput: v => { st.tr = v; update(); } });
    const cS = check({ label: 'RC snubber from SW node to GND', onChange: v => { st.sn = v; update(); } });
    const sCs = slider({ label: 'Snubber C', min: 100, max: 3300, step: 50, value: st.Cs, fmt: v => v + ' pF', onInput: v => { st.Cs = v; update(); } });
    const sRs = slider({ label: 'Snubber R', min: 0.5, max: 20, step: 0.5, value: st.Rs, fmt: v => v + ' Ω', onInput: v => { st.Rs = v; update(); } });
    L.controls.append(sL.el, sC.el, sT.el, cS.el, sCs.el, sRs.el);
    const plot = new Plot(L.stage, { title: 'Switch node at turn-on', height: 240, xmin: 0, xmax: 60, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'pk', label: 'Overshoot' }, { key: 'f', label: 'Ringing' }, { key: 'ps', label: 'Snubber loss' }, { key: 'psw', label: 'Switching loss' }, { key: 'eff', label: 'Efficiency cost', bar: true }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Series R-L-C: the switch drives the node through the hot-loop L, damped by ~1.5 Ω of switch, capacitor-ESR and skin-effect resistance, optionally with an R-C snubber. Snubber loss = C·V²·f (ROHM §3.4); switching loss ≈ V·I·t_edge·f.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function sim() {
      const Lh = st.L * 1e-9, C = st.C * 1e-12, Cs = st.Cs * 1e-12, Rs = st.Rs, R = 1.5, tr = st.tr * 1e-9, t0 = 5e-9; // ≈1.5 Ω: switch R_on + ESR + skin effect
      let i = 0, v = 0, vs = 0;
      const dt = 2e-12, T = 60e-9;
      const ts = [], ys = [];
      let pk = 0;
      for (let k = 0, s = 0; s <= T; k++, s += dt) {
        const vsrc = VIN * PCB.ramp(s, t0, tr);
        i += (vsrc - v - R * i) / Lh * dt;            // symplectic Euler: current first…
        const isn = st.sn ? (v - vs) / Rs : 0;
        v += (i - isn) / C * dt;                       // …then voltage with the new current
        if (st.sn) vs += isn / Cs * dt;
        if (v > pk) pk = v;
        if (k % 50 === 0) { ts.push(s * 1e9); ys.push(v); }
      }
      return { ts, ys, pk };
    }
    function update() {
      sCs.el.style.opacity = sRs.el.style.opacity = st.sn ? 1 : 0.4;
      const r = sim();
      const f = 1 / (2 * Math.PI * Math.sqrt(st.L * 1e-9 * st.C * 1e-12));
      const Ps = st.sn ? st.Cs * 1e-12 * VIN * VIN * FSW : 0;
      const Psw = VIN * I * st.tr * 1e-9 * FSW;
      const Pbase = VIN * I * 2e-9 * FSW;
      const cost = (Ps + Psw - Pbase) / POUT * 100;
      plot.draw({ series: [{ x: r.ts, y: r.ys, color: '#e0a64a', width: 2.3 }], hlines: [{ y: VIN, color: 'var(--faint)', dash: [2, 3], label: 'VIN' }, { y: 20, color: 'var(--bad)', label: 'illustrative abs. max' }], range: { ymin: -2, ymax: Math.max(24, r.pk * 1.08) } });
      const os = r.pk - VIN;
      M.set('pk', `+${sig(os, 2)} V (${sig(r.pk, 3)} V)`, r.pk > 20 ? 'bad' : os > 3 ? 'warn' : 'good');
      M.set('f', fmtSI(f, 'Hz'));
      M.set('ps', fmtSI(Ps, 'W'), Ps > 0.25 ? 'warn' : null);
      M.set('psw', fmtSI(Psw, 'W'));
      M.set('eff', sig(Math.max(0, cost), 2) + ' % of 10 W', cost > 3 ? 'bad' : cost > 1 ? 'warn' : 'good', cost / 6);
      const items = [];
      items.push({ level: r.pk > 20 ? 'bad' : os > 3 ? 'warn' : 'good', html: `Overshoot <b>+${sig(os, 2)} V</b>, ringing at ${fmtSI(f, 'Hz')}. ${st.L > 8 ? 'Most of this is a layout problem: reduce the hot-loop inductance first (6.2).' : ''}` });
      if (st.sn) items.push({ level: Ps > 0.25 ? 'warn' : 'info', html: `The snubber burns C·V²·f = ${fmtSI(Ps, 'W')}. ROHM's example (1000 pF, 12 V, 1 MHz) is 0.144 W, so the resistor needs a 0.25 W rating. Best damping when R ≈ √(L/C) = ${sig(Math.sqrt(st.L * 1e-9 / (st.C * 1e-12)), 2)} Ω.` });
      if (st.tr > 4) items.push({ level: 'info', html: `A ${st.tr} ns edge (BOOT or gate resistor) contains far less energy at the ringing frequency, but each edge now dissipates more: ${fmtSI(Psw, 'W')} of switching loss (ROHM §3.5–3.6).` });
      V.set(items);
      E.set('<p>The ringing is an LC tank: the hot-loop inductance and the switch-node capacitance, excited by each edge. You can make L smaller (layout), add resistance to absorb the energy (snubber), or excite it less (slower edge).</p><p>Only the first is free. The other two trade efficiency for EMI, which is why ROHM puts layout first and snubbers in the "if you still fail" chapter.</p>');
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Which current path in a buck converter needs the most careful layout?', opts: ['Inductor to output capacitor', 'Input bypass cap → high-side switch → diode/low-side switch → ground → cap', 'Feedback divider to FB pin'], a: 1, ex: 'That loop switches between zero and full current in nanoseconds (ROHM Fig. 3). Its inductance creates ringing and its area radiates. The output side carries smooth inductor current.' },
    { q: 'There is no room for C_BYP next to the IC on the top side. Best option?', opts: ['Put C_BYP on the back side with vias', 'Keep C_BYP on top and close; move the bigger C_IN further away or to the back if needed', 'Leave C_BYP out'], a: 1, ex: 'ROHM Fig. 14–16: C_IN can be up to ~2 cm away or on the back, provided C_BYP is right at the pins on the same side. Vias in the hot loop "must never be used".' },
    { q: 'Why shouldn\'t a ground plane run directly under the inductor?', opts: ['It shorts the inductor', 'The inductor\'s field induces eddy currents that reduce inductance and Q, and inject noise into ground', 'It makes the board thicker'], a: 1, ex: 'ROHM §2.3.2. Some designs accept it with shielded inductors, but always check the regulator\'s datasheet layout guidance.' },
  ]);
})();
