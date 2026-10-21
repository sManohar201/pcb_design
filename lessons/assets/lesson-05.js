/* Lesson 5 — Power planes & the PDN */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, geo, legend } = PCB;

  PCB.renderChrome({ lesson: 5 });

  /* ------------------------------------------------ shared: mounting styles */
  const MOUNT = {
    long: { t: 'traces to vias', desc: '2.5 mm traces out to one via per pad', trace: 2.5, D: 6.0, nv: 1 },
    short: { t: 'vias at pad ends', desc: 'short stubs, one via at each pad end', trace: 0.4, D: 2.2, nv: 1 },
    side: { t: '2 vias / pad, side', desc: 'two vias per pad, beside the pads, close together', trace: 0.15, D: 1.1, nv: 2 },
    vip: { t: 'via-in-pad', desc: 'one filled via in each pad', trace: 0, D: 1.0, nv: 1 },
  };
  const ESL_0402 = 0.35;
  function mountL(k, h) {
    const m = MOUNT[k];
    const ms = phys.microstrip(0.3, Math.max(h, 0.07));
    const Ltr = 2 * m.trace * ms.Lp;
    const Lv = phys.viaLoopL(h, m.D, 0.3) / (m.nv === 2 ? 1.6 : 1);
    return { Ltr, Lv, L: Ltr + Lv };
  }
  const mountSeg = (value, onChange) => seg({ label: 'Capacitor mounting', options: Object.entries(MOUNT).map(([v, m]) => ({ v, label: m.t, title: m.desc })), value, onChange });

  /* =================================================================
     5.1  Load step: on-package C → MLCC bank → bulk → regulator
     ================================================================= */
  (function labDroop() {
    const host = document.getElementById('lab-droop'); if (!host) return;
    const L = lab(host, { title: 'A 1.8 V rail during a load step' });
    const CAPS = { '100n': { C: 100e-9, R: 0.02, L: 0.35, t: '100 nF' }, '1u': { C: 1e-6, R: 0.01, L: 0.4, t: '1 µF' }, '10u': { C: 10e-6, R: 0.005, L: 0.5, t: '10 µF' } };
    const st = { cap: '100n', n: 4, mount: 'short', path: 'plane', dI: 0.5, tr: 1e-9, x: 330 };
    const sCap = seg({ label: 'Local capacitor value', options: Object.entries(CAPS).map(([v, c]) => ({ v, label: c.t })), value: st.cap, onChange: v => { st.cap = v; update(); } });
    const sN = slider({ label: 'Number of local capacitors', min: 0, max: 10, step: 1, value: st.n, fmt: v => v + '×', onInput: v => { st.n = v; update(); } });
    const sM = mountSeg(st.mount, v => { st.mount = v; update(); });
    const sP = seg({ label: 'Power reaches the IC through', options: [{ v: 'plane', label: 'plane pair (0.1 mm)' }, { v: 'trace', label: '0.5 mm trace' }], value: st.path, onChange: v => { st.path = v; update(); } });
    const sI = seg({ label: 'Load step', options: [{ v: 0.5, label: '+0.5 A' }, { v: 2, label: '+2 A' }], value: st.dI, onChange: v => { st.dI = v; update(); } });
    const sT = seg({ label: 'Load edge', options: [{ v: 1e-9, label: '1 ns' }, { v: 10e-9, label: '10 ns' }], value: st.tr, onChange: v => { st.tr = v; update(); } });
    L.controls.append(sCap.el, sN.el, sM.el, sP.el, sI.el, sT.el);

    const S = svg('svg', { class: 'viz board', viewBox: '0 0 600 170' });
    const gB = svg('g'), gD = svg('g');
    const capG = svg('g');
    S.append(gB, gD, capG);
    L.stage.append(S, el('div', { class: 'stage-hint' }, '↔ Drag the capacitor bank. Scale: 4 px per mm.'));
    const pV = new Plot(L.stage, { title: 'Rail voltage at the IC (deviation from 1.800 V)', height: 200, xlog: true, xmin: 0.1e-9, xmax: 20e-6, xlabel: 'time after the step', ylabel: 'mV', xfmt: v => fmtSI(v, 's', 1), yfmt: v => sig(v, 3) });
    const pI = new Plot(L.stage, { title: 'Who supplies the current', height: 180, xlog: true, xmin: 0.1e-9, xmax: 20e-6, xlabel: 'time after the step', ylabel: 'A', xfmt: v => fmtSI(v, 's', 1), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'D', label: 'Cap → IC distance' }, { key: 'Lc', label: 'Cap branch inductance' }, { key: 'droop', label: 'Worst droop', bar: true }, { key: 'when', label: 'Worst at' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Lumped circuit: regulator (slow loop ≈ 100 nH), 220 µF bulk at the regulator, local MLCC bank, 100 nF of on-package capacitance (20 mΩ), current-step load. RK4 integration.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const XIC = 470;
    PCB.draggable(S, capG, { onMove: p => { st.x = clamp(p.x, 150, XIC - 14); update(); } });

    function simulate(prm) {
      const { Lv, Rv, Cb, Rb, Lb, Cc, Rc, Lc, Cd, I0, dI, tr } = prm;
      const V0 = 1.8 + Rv * I0;
      const Rd = 0.02; // on-package capacitance ESR / package resistance
      let y = [I0, 0, 1.8, 0, 1.8, 1.8]; // last state = voltage on the package capacitance
      const hasC = Cc > 0;
      const f = (t, s) => {
        const Il = I0 + dI * clamp(t / tr, 0, 1);
        const [iv, ib, vb, ic, vc, vd] = s;
        const id = iv + ib + (hasC ? ic : 0) - Il;
        const V = vd + Rd * id;
        return [
          (V0 - Rv * iv - V) / Lv,
          (vb - Rb * ib - V) / Lb, -ib / Cb,
          hasC ? (vc - Rc * ic - V) / Lc : 0, hasC ? -ic / Cc : 0,
          id / Cd,
        ];
      };
      const T = 20e-6;
      const samples = [];
      const tsamp = []; for (let i = 0; i <= 600; i++) tsamp.push(0.1e-9 * Math.pow(T / 0.1e-9, i / 600));
      let t = 0, k = 0;
      const add = (a, b, h) => a.map((v, i) => v + b[i] * h);
      while (t < T && k < tsamp.length) {
        const h = Math.min(0.5e-9, Math.max(4e-12, t / 150), tr / 10 > 4e-12 && t < tr * 2 ? tr / 10 : 1);
        const k1 = f(t, y), k2 = f(t + h / 2, add(y, k1, h / 2)), k3 = f(t + h / 2, add(y, k2, h / 2)), k4 = f(t + h, add(y, k3, h));
        y = y.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
        t += h;
        while (k < tsamp.length && tsamp[k] <= t) {
          const il = I0 + dI * clamp(tsamp[k] / tr, 0, 1);
          samples.push({ t: tsamp[k], V: y[5] + Rd * (y[0] + y[1] + (hasC ? y[3] : 0) - il), iv: y[0], ib: y[1], ic: y[3], il }); k++;
        }
      }
      return samples;
    }

    function update() {
      const D = (XIC - st.x) / 4; // mm
      const c = CAPS[st.cap], m = mountL(st.mount, 0.2);
      const pathL = st.path === 'plane' ? phys.viaLoopL(0.1, D, 0.3) : phys.microstrip(0.5, 0.2).Lp * D;
      const n = st.n;
      const Lc = n ? ((c.L + m.L) / n + pathL) * 1e-9 : 1;
      const Lb = (3 + (st.path === 'plane' ? 0.3 : phys.microstrip(0.5, 0.2).Lp * 70)) * 1e-9;
      const out = simulate({ Lv: 100e-9, Rv: 2e-3, Cb: 220e-6, Rb: 0.015, Lb, Cc: n * c.C, Rc: c.R / Math.max(n, 1), Lc, Cd: 100e-9, I0: 0.2, dI: st.dI, tr: st.tr });
      const ts = out.map(o => o.t), dv = out.map(o => (o.V - 1.8) * 1e3);
      let worst = 0, wt = 0; out.forEach(o => { const d = 1.8 - o.V; if (d > worst) { worst = d; wt = o.t; } });
      pV.draw({ series: [{ x: ts, y: dv, color: 'var(--bad)', width: 2.4 }], bands: [{ y0: -54, y1: 54, color: 'var(--good)', alpha: 0.12 }], hlines: [{ y: -54, color: 'var(--good)', label: '−3% (−54 mV)' }], range: { ymin: Math.min(-80, Math.min(...dv) * 1.1), ymax: Math.max(30, Math.max(...dv) * 1.1) } });
      pI.draw({ series: [
        { x: ts, y: out.map(o => o.il), color: 'var(--faint)', width: 1.5, dash: [4, 3], label: 'load' },
        { x: ts, y: out.map(o => o.ic), color: 'var(--link)', width: 2, label: 'local MLCCs' },
        { x: ts, y: out.map(o => o.ib), color: 'var(--accent)', width: 2, label: 'bulk cap' },
        { x: ts, y: out.map(o => o.iv), color: 'var(--good)', width: 2, label: 'regulator' },
      ] });
      // drawing
      gB.innerHTML = '';
      if (st.path === 'plane') gB.append(svg('rect', { x: 8, y: 8, width: 584, height: 154, rx: 8, fill: 'var(--plane)', opacity: 0.7 }), svg('text', { x: 16, y: 158, fill: 'var(--gnd)', 'font-size': 10.5, text: '1.8 V / GND plane pair, 0.1 mm apart' }));
      else gB.append(svg('path', { d: `M 100 85 L ${XIC} 85`, stroke: 'var(--pwr)', 'stroke-width': 4 }), svg('path', { d: `M ${st.x} 85 L ${st.x} 112`, stroke: 'var(--pwr)', 'stroke-width': 3 }), svg('text', { x: 16, y: 158, fill: '#ffb3ba', 'font-size': 10.5, text: '1.8 V delivered by a 0.5 mm trace (GND plane below)' }));
      gB.append(svg('rect', { x: 20, y: 50, width: 80, height: 70, rx: 6, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x: 60, y: 82, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, 'font-weight': 600, text: 'REGULATOR' }), svg('text', { x: 60, y: 98, 'text-anchor': 'middle', fill: '#9fb3a8', 'font-size': 9.5, text: 'slow (µs)' }),
        svg('rect', { x: 108, y: 112, width: 26, height: 22, rx: 4, fill: '#3a3020', stroke: '#c9b48a' }), svg('text', { x: 121, y: 147, 'text-anchor': 'middle', fill: '#c9b48a', 'font-size': 9.5, text: 'bulk' }),
        svg('rect', { x: XIC, y: 35, width: 100, height: 100, rx: 6, fill: '#1d2730', stroke: 'var(--silk)' }), svg('text', { x: XIC + 50, y: 82, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11.5, 'font-weight': 600, text: 'IC / SoC' }), svg('text', { x: XIC + 50, y: 98, 'text-anchor': 'middle', fill: '#9fb3a8', 'font-size': 9.5, text: 'load step' }));
      gD.innerHTML = '';
      gD.append(svg('line', { x1: st.x, y1: 125, x2: XIC, y2: 125, stroke: '#cfe0d5', 'stroke-width': 1, 'stroke-dasharray': '3 3' }), svg('text', { x: (st.x + XIC) / 2, y: 140, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: `${sig(D, 2)} mm` }));
      capG.innerHTML = '';
      const nn = Math.max(st.n, 1);
      capG.append(svg('rect', { x: st.x - 22, y: 98, width: 44, height: 24, rx: 5, fill: 'rgba(201,180,138,.18)', stroke: '#c9b48a', 'stroke-dasharray': '3 2' }));
      for (let i = 0; i < Math.min(nn, 10); i++) capG.append(svg('rect', { x: st.x - 18 + (i % 5) * 7.6, y: 102 + Math.floor(i / 5) * 9, width: 5.5, height: 6.5, fill: st.n ? '#c9b48a' : 'none', stroke: '#3b2f1a' }));
      capG.append(svg('text', { x: st.x, y: 94, 'text-anchor': 'middle', fill: '#ffe2a8', 'font-size': 10.5, text: st.n ? `${st.n}× ${c.t}` : 'no local caps' }));
      M.set('D', sig(D, 2) + ' mm');
      M.set('Lc', st.n ? sig(Lc * 1e9, 2) + ' nH' : '—', st.n ? (Lc * 1e9 > 1.5 ? 'bad' : Lc * 1e9 > 0.6 ? 'warn' : 'good') : 'bad');
      M.set('droop', sig(worst * 1e3, 3) + ' mV', worst > 0.054 ? 'bad' : worst > 0.036 ? 'warn' : 'good', worst / 0.15);
      M.set('when', fmtSI(wt, 's', 2));
      const items = [];
      items.push({ level: worst > 0.054 ? 'bad' : worst > 0.036 ? 'warn' : 'good', html: `Worst droop <b>${sig(worst * 1e3, 3)} mV</b> at ${fmtSI(wt, 's', 2)} after the step (budget: 54 mV = 3%). ${worst > 0.054 ? 'The IC would see an out-of-spec supply: timing failures or a brown-out reset.' : 'Within budget.'}` });
      if (!st.n) items.push({ level: 'bad', html: 'No local capacitors: after the on-package capacitance runs out (a few ns), the only charge left is behind the bulk cap\'s inductance.' });
      if (wt < 30e-9 && worst > 0.036) items.push({ level: 'info', html: 'The worst dip is in the first tens of ns. That is the <b>local capacitors\' inductance</b> at work: lower the mounting inductance, add more capacitors in parallel, or move them closer.' });
      else if (wt >= 30e-9 && wt < 3e-6 && worst > 0.036) items.push({ level: 'info', html: 'The worst dip is at ~100 ns – µs. The local caps have <b>run out of charge</b> (too little capacitance) and the bulk cap is too far away. Add 1–10 µF parts.' });
      if (st.path === 'trace') items.push({ level: D > 10 ? 'bad' : 'warn', html: `With a trace, distance matters: ${sig(D, 2)} mm adds ${sig(pathL, 2)} nH in series with the caps. Drag them closer and compare with the plane.` });
      else items.push({ level: 'info', html: `With a plane pair 0.1 mm apart, ${sig(D, 2)} mm of distance adds only ${sig(pathL, 2)} nH of spreading inductance. Here the <b>mounting</b> (${sig(m.L, 2)} nH per cap) dominates.` });
      V.set(items);
      E.set('<p>Read the bottom plot from left to right: the <b>local MLCCs</b> (blue) take the step first, then hand over to the <b>bulk cap</b> (orange), and finally the <b>regulator</b> (green) catches up after µs. Each tier is slower because its path has more inductance.</p><p>Every handover is a chance for the voltage to dip. Decoupling design is about making each tier fast enough, and big enough, to carry the load until the next one arrives.</p>');
    }
    update();
  })();

  /* =================================================================
     5.2  Mounting inductance
     ================================================================= */
  (function labMount() {
    const host = document.getElementById('lab-mount'); if (!host) return;
    const L = lab(host, { title: 'Capacitor footprint & via placement' });
    const st = { m: 'long', h: 0.2 };
    const sM = mountSeg(st.m, v => { st.m = v; update(); });
    const sH = slider({ label: 'Depth from cap to power/GND planes', min: 0.07, max: 1.5, log: true, value: st.h, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.h = v; update(); }, hint: 'Planes on L2/L3 of a 1.6 mm board ≈ 0.1–0.2 mm; planes in the middle ≈ 0.7 mm.' });
    L.controls.append(sM.el, sH.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 600 250' });
    L.stage.append(S);
    const bars = svg('svg', { class: 'viz', viewBox: '0 0 600 130', style: 'background:var(--surface-2)' });
    L.stage.append(bars);
    const M = meters(L.stage, [{ key: 'esl', label: 'Capacitor ESL' }, { key: 'tr', label: 'Traces' }, { key: 'via', label: 'Via loop' }, { key: 'tot', label: 'Total loop L' }, { key: 'srf', label: '100 nF resonance' }, { key: 'z', label: '|Z| at 100 MHz' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Via loop: Sierra eq. PI-15, L ≈ 0.4·h·[ln(2D/d)+¼] nH; two vias per pad ≈ ÷1.6 (mutual coupling). Traces: microstrip loop inductance over the plane.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    function update() {
      const m = MOUNT[st.m], r = mountL(st.m, st.h);
      const tot = ESL_0402 + r.L;
      const srf = 1 / (2 * Math.PI * Math.sqrt(tot * 1e-9 * 100e-9));
      const z = 2 * Math.PI * 1e8 * tot * 1e-9;
      // footprint drawing (top view, 40 px/mm), centred at (210,105)
      S.innerHTML = '';
      const sc = 40, cx = 210, cy = 112;
      S.append(svg('text', { x: 14, y: 22, fill: '#cfe0d5', 'font-size': 11.5, 'font-weight': 600, text: 'Top view · 0402 capacitor' }));
      const padW = 0.6 * sc, padH = 0.6 * sc, pitch = 1.0 * sc;
      const pads = [cx - pitch / 2, cx + pitch / 2];
      const viaPos = [];
      if (st.m === 'long') { viaPos.push([pads[0] - (m.trace + 0.3) * sc, cy], [pads[1] + (m.trace + 0.3) * sc, cy]); }
      if (st.m === 'short') { viaPos.push([pads[0] - 0.7 * sc, cy], [pads[1] + 0.7 * sc, cy]); }
      if (st.m === 'side') { viaPos.push([pads[0], cy - 0.75 * sc], [pads[0], cy + 0.75 * sc], [pads[1], cy - 0.75 * sc], [pads[1], cy + 0.75 * sc]); }
      if (st.m === 'vip') { viaPos.push([pads[0], cy], [pads[1], cy]); }
      // loop outline
      const left = viaPos.filter(v => v[0] < cx), right = viaPos.filter(v => v[0] > cx);
      const lx = Math.min(...left.map(v => v[0])), rx = Math.max(...right.map(v => v[0]));
      S.append(svg('rect', { x: lx - 4, y: cy - 0.42 * sc, width: rx - lx + 8, height: 0.84 * sc, rx: 8, fill: 'rgba(255,123,58,.13)', stroke: 'var(--ret)', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));
      // traces
      for (const [vx, vy] of viaPos) {
        const px = vx < cx ? pads[0] : pads[1];
        if (Math.abs(vx - px) > 2 || Math.abs(vy - cy) > 2) S.append(svg('line', { x1: px, y1: cy, x2: vx, y2: vy, stroke: 'var(--copper)', 'stroke-width': 0.3 * sc }));
      }
      for (const p of pads) S.append(svg('rect', { x: p - padW / 2, y: cy - padH / 2, width: padW, height: padH, rx: 3, fill: 'var(--copper)' }));
      S.append(svg('rect', { x: cx - 0.5 * sc, y: cy - 0.25 * sc, width: 1.0 * sc, height: 0.5 * sc, rx: 3, fill: '#b9a37a', stroke: '#3b2f1a' }));
      for (const [vx, vy] of viaPos) S.append(svg('circle', { cx: vx, cy: vy, r: 0.3 * sc, fill: '#1a1a1a', stroke: '#e0a64a', 'stroke-width': 0.12 * sc }));
      S.append(svg('text', { x: cx, y: 214, 'text-anchor': 'middle', fill: '#ffb38a', 'font-size': 11, text: 'orange = current loop area (sets the inductance)' }));
      // cross-section on right
      const x0 = 420, top = 70, dpx = clamp(st.h * 70, 8, 120);
      S.append(svg('text', { x: x0, y: 22, fill: '#cfe0d5', 'font-size': 11.5, 'font-weight': 600, text: 'Side view' }));
      S.append(svg('rect', { x: x0, y: top, width: 160, height: dpx + 40, fill: '#1e4a37', opacity: 0.6 }));
      S.append(svg('rect', { x: x0, y: top + dpx, width: 160, height: 5, fill: '#7a3f45' }), svg('rect', { x: x0, y: top + dpx + 10, width: 160, height: 5, fill: '#7c6a3a' }));
      S.append(svg('text', { x: x0 + 164, y: top + dpx + 5, fill: '#ff9aa5', 'font-size': 9.5, text: 'PWR' }), svg('text', { x: x0 + 164, y: top + dpx + 16, fill: 'var(--gnd)', 'font-size': 9.5, text: 'GND' }));
      S.append(svg('rect', { x: x0 + 60, y: top - 12, width: 40, height: 12, fill: '#b9a37a' }));
      const vx1 = x0 + 50, vx2 = x0 + 110;
      S.append(svg('rect', { x: vx1 - 3, y: top, width: 6, height: dpx + 3, fill: 'var(--copper)' }), svg('rect', { x: vx2 - 3, y: top, width: 6, height: dpx + 13, fill: 'var(--copper)' }));
      S.append(svg('text', { x: x0 + 80, y: top + dpx + 36, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: `h = ${sig(st.h, 2)} mm` }));
      // bar chart comparing all styles
      bars.innerHTML = '';
      const keys = Object.keys(MOUNT), vals = keys.map(k => ESL_0402 + mountL(k, st.h).L), mx = Math.max(...vals);
      keys.forEach((k, i) => {
        const y = 14 + i * 28, w = vals[i] / mx * 380;
        bars.append(svg('text', { x: 10, y: y + 13, fill: 'var(--muted)', 'font-size': 11.5, text: MOUNT[k].t }),
          svg('rect', { x: 150, y, width: w, height: 18, rx: 4, fill: k === st.m ? 'var(--accent)' : 'var(--surface-3)' }),
          svg('text', { x: 156 + w, y: y + 13, fill: 'var(--text)', 'font-size': 11.5, 'font-family': 'var(--mono)', text: sig(vals[i], 2) + ' nH' }));
      });
      M.set('esl', ESL_0402 + ' nH');
      M.set('tr', sig(r.Ltr, 2) + ' nH', r.Ltr > 0.5 ? 'bad' : null);
      M.set('via', sig(r.Lv, 2) + ' nH', r.Lv > 0.6 ? 'warn' : null);
      M.set('tot', sig(tot, 2) + ' nH', tot > 1.2 ? 'bad' : tot > 0.7 ? 'warn' : 'good');
      M.set('srf', fmtSI(srf, 'Hz'));
      M.set('z', fmtSI(z, 'Ω'), z > 0.5 ? 'bad' : z > 0.3 ? 'warn' : 'good');
      const best = ESL_0402 + mountL('vip', st.h).L;
      const items = [{ level: tot > 1.2 ? 'bad' : tot > 0.7 ? 'warn' : 'good', html: `Total loop inductance <b>${sig(tot, 2)} nH</b>, of which the capacitor itself is only ${ESL_0402} nH (${sig(ESL_0402 / tot * 100, 2)}%). The footprint is the rest.` }];
      items.push({ level: 'info', html: `Above its ${fmtSI(srf, 'Hz')} resonance this capacitor behaves as an inductor: at 100 MHz it is ${fmtSI(z, 'Ω')}. You would need ${Math.ceil(z / 0.05)} of them in parallel to reach 50 mΩ.` });
      if (st.h > 0.5) items.push({ level: 'warn', html: `The planes are ${sig(st.h, 2)} mm down. Every via is long, so even via-in-pad gives ${sig(best, 2)} nH. Put the power/GND pair near the surface that carries the decoupling (or decouple from the other side).` });
      V.set(items);
      E.set('<p>Inductance is set by the <b>area of the current loop</b>: from one pad, down a via, across the plane pair, up the other via and back through the capacitor. Long traces stretch the loop sideways and deep planes stretch it downward.</p><p>That is why high-speed boards put a solid GND/PWR pair right under the component layers and use via-in-pad or side vias for every decoupling capacitor.</p>');
    }
    update();
  })();

  /* =================================================================
     5.3  PDN impedance vs. target
     ================================================================= */
  (function labPDN() {
    const host = document.getElementById('lab-pdn'); if (!host) return;
    const L = lab(host, { title: 'Build a capacitor bank for one rail' });
    const TYPES = [
      { k: 'bulk', t: '220 µF polymer (bulk)', C: 220e-6, R: 0.015, L: 2.0, color: '#b98b4f', max: 4, mul: 2 },
      { k: 'u10', t: '10 µF 0603', C: 10e-6, R: 0.004, L: 0.5, color: '#d9a400', max: 20, mul: 1 },
      { k: 'u1', t: '1 µF 0402', C: 1e-6, R: 0.008, L: 0.4, color: '#2a9d8f', max: 20, mul: 1 },
      { k: 'n100', t: '100 nF 0402', C: 100e-9, R: 0.02, L: 0.35, color: '#3a86ff', max: 30, mul: 1 },
      { k: 'n10', t: '10 nF 0402', C: 10e-9, R: 0.05, L: 0.3, color: '#9b5de5', max: 20, mul: 1 },
    ];
    const st = { V: 1.8, rip: 3, I: 4, mount: 'short', area: 40, sep: 0.1, n: { bulk: 1, u10: 0, u1: 0, n100: 1, n10: 0 } };
    const sV = seg({ label: 'Rail', options: [{ v: 1.0, label: '1.0 V' }, { v: 1.8, label: '1.8 V' }, { v: 3.3, label: '3.3 V' }, { v: 5, label: '5 V' }], value: st.V, onChange: v => { st.V = v; update(); } });
    const sR = slider({ label: 'Allowed ripple', min: 1, max: 10, step: 0.5, value: st.rip, fmt: v => v + ' %', onInput: v => { st.rip = v; update(); } });
    const sI = slider({ label: 'I max of the load', min: 0.5, max: 10, step: 0.5, value: st.I, fmt: v => v + ' A', onInput: v => { st.I = v; update(); } });
    const sliders = {};
    const capBox = el('div', { class: 'ctl' });
    for (const T of TYPES) { sliders[T.k] = slider({ label: T.t, min: 0, max: T.max, step: 1, value: st.n[T.k], fmt: v => v + '×', onInput: v => { st.n[T.k] = v; update(); } }); capBox.append(sliders[T.k].el); }
    const sM = mountSeg(st.mount, v => { st.mount = v; update(); });
    const sA = slider({ label: 'Plane pair area', min: 5, max: 150, step: 5, value: st.area, fmt: v => v + ' cm²', onInput: v => { st.area = v; update(); } });
    const sS = slider({ label: 'Plane pair spacing', min: 0.05, max: 0.5, log: true, value: st.sep, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.sep = v; update(); } });
    const preset = (o) => () => { Object.assign(st.n, o); for (const k in o) sliders[k].set(o[k]); update(); };
    L.controls.append(sV.el, sR.el, sI.el, el('div', { class: 'ctl-group-title' }, 'Capacitor bank'), capBox, sM.el, el('div', { class: 'ctl-group-title' }, 'Planes'), sA.el, sS.el,
      el('div', { class: 'ctl-group-title' }, 'Presets'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: preset({ bulk: 1, u10: 0, u1: 0, n100: 1, n10: 0 }) }, 'Beginner: 1 × 100 nF'),
        el('button', { class: 'btn', onclick: preset({ bulk: 2, u10: 0, u1: 0, n100: 10, n10: 0 }) }, 'Bulk + 10 × 100 nF'),
        el('button', { class: 'btn', onclick: preset({ bulk: 2, u10: 4, u1: 6, n100: 16, n10: 8 }) }, 'Three+ values')));
    const plot = new Plot(L.stage, { title: '|Z| of the PDN seen by the IC', height: 300, xlog: true, ylog: true, xmin: 1e3, xmax: 1e9, ymin: 1e-4, ymax: 10, xlabel: 'frequency', ylabel: 'Ω', xfmt: v => fmtSI(v, 'Hz', 1), yfmt: v => fmtSI(v, 'Ω', 1) });
    const M = meters(L.stage, [{ key: 'zt', label: 'Target Z' }, { key: 'worst', label: 'Worst |Z| / target', bar: true }, { key: 'wf', label: 'at frequency' }, { key: 'cp', label: 'Plane capacitance' }, { key: 'cnt', label: 'Capacitors used' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Each capacitor: series R-L-C (ESL + mounting). Regulator: 1 mΩ + 30 nH. Plane pair: C = ε·A/h with FR-4 loss. Ideal parts (no DC-bias derating). Above ~200 MHz the IC package dominates.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const cx = (re, im) => ({ re, im });
    const inv = z => { const d = z.re * z.re + z.im * z.im; return cx(z.re / d, -z.im / d); };
    function branch(C, R, Lh, n, w) { const z = cx(R, w * Lh - 1 / (w * C)); return cx(z.re / n, z.im / n); }

    function update() {
      const Zt = st.V * st.rip / 100 / (0.5 * st.I);
      const Lm = mountL(st.mount, 0.2).L;
      const Cp = phys.plateC(st.area * 100, st.sep, 4.2);
      const fs = [], tot = [], per = {};
      TYPES.forEach(T => (per[T.k] = []));
      const pl = [], vr = [];
      for (let i = 0; i <= 360; i++) {
        const f = 1e3 * Math.pow(1e6, i / 360), w = 2 * Math.PI * f;
        fs.push(f);
        let Y = inv(cx(1e-3, w * 30e-9)); vr.push(Math.hypot(1e-3, w * 30e-9));
        const zc = inv(cx(w * Cp * 0.02, w * Cp)); // FR-4 dielectric loss, tanδ ≈ 0.02
        const zp = cx(zc.re + 0.005, zc.im + w * 0.02e-9); pl.push(Math.hypot(zp.re, zp.im));
        let y2 = inv(zp); Y = cx(Y.re + y2.re, Y.im + y2.im);
        for (const T of TYPES) {
          const n = st.n[T.k];
          if (!n) { per[T.k].push(NaN); continue; }
          const z = branch(T.C, T.R, (T.L + Lm * T.mul) * 1e-9, n, w);
          per[T.k].push(Math.hypot(z.re, z.im));
          const yy = inv(z); Y = cx(Y.re + yy.re, Y.im + yy.im);
        }
        const Z = inv(Y); tot.push(Math.hypot(Z.re, Z.im));
      }
      // violations (up to the package region)
      const spans = []; let s0 = null, worst = 0, wf = 0;
      for (let i = 0; i < fs.length; i++) {
        const over = tot[i] > Zt && fs[i] <= 2e8;
        if (fs[i] <= 2e8 && tot[i] / Zt > worst) { worst = tot[i] / Zt; wf = fs[i]; }
        if (over && s0 == null) s0 = fs[i];
        if ((!over || i === fs.length - 1) && s0 != null) { spans.push({ x0: s0, x1: fs[i], color: 'var(--bad)', alpha: 0.13 }); s0 = null; }
      }
      // anti-resonance peaks above target
      const peaks = [];
      for (let i = 2; i < fs.length - 2; i++) if (tot[i] > tot[i - 1] && tot[i] >= tot[i + 1] && tot[i] > Zt && fs[i] > 2e4 && fs[i] < 2e8) peaks.push(fs[i]);
      const series = [];
      series.push({ x: fs, y: vr, color: 'var(--good)', width: 1.2, dash: [4, 3], alpha: 0.7, label: 'regulator' });
      series.push({ x: fs, y: pl, color: 'var(--faint)', width: 1.2, dash: [2, 3], alpha: 0.8, label: 'planes' });
      for (const T of TYPES) if (st.n[T.k]) series.push({ x: fs, y: per[T.k], color: T.color, width: 1.2, dash: [4, 3], alpha: 0.75, label: `${st.n[T.k]}× ${T.t.split(' ')[0]} ${T.t.split(' ')[1]}` });
      series.push({ x: fs, y: tot, color: 'var(--text)', width: 2.8, label: 'total PDN' });
      plot.draw({ series, hlines: [{ y: Zt, color: 'var(--bad)', label: `target ${fmtSI(Zt, 'Ω')}`, dash: [7, 4], width: 2 }], xspans: spans.concat([{ x0: 2e8, x1: 1e9, color: 'var(--faint)', alpha: 0.12, label: 'package/die' }]) });
      const count = TYPES.reduce((s, T) => s + st.n[T.k], 0);
      M.set('zt', fmtSI(Zt, 'Ω'));
      M.set('worst', worst > 100 ? '> ×100' : '×' + sig(worst, 2), worst > 1.5 ? 'bad' : worst > 1 ? 'warn' : 'good', worst / 5);
      M.set('wf', fmtSI(wf, 'Hz'));
      M.set('cp', fmtSI(Cp, 'F'));
      M.set('cnt', String(count));
      const items = [];
      if (worst <= 1) items.push({ level: 'good', html: `The PDN stays below ${fmtSI(Zt, 'Ω')} from 1 kHz to 200 MHz. Any load current change up to ${sig(st.I / 2, 2)} A produces less than ${sig(st.rip, 2)}% ripple.` });
      else {
        const band = wf < 1e5 ? 'low' : wf < 1e7 ? 'mid' : 'high';
        const fix = band === 'low' ? 'Add bulk capacitance (or a faster regulator). This band is below where ceramics help.' : band === 'mid' ? 'Add 1–10 µF ceramics: their resonance sits in this band.' : 'Add more 100 nF / 10 nF parts, reduce mounting inductance, or move the plane pair closer together.';
        items.push({ level: worst > 1.5 ? 'bad' : 'warn', html: `|Z| exceeds the target by ${worst > 100 ? 'more than ×100' : '×' + sig(worst, 2)} around <b>${fmtSI(wf, 'Hz')}</b>. A load current change at that frequency would produce ${worst > 100 ? 'ripple far beyond the budget' : sig(worst * st.rip, 2) + '% ripple'}. ${fix}` });
      }
      if (peaks.length) items.push({ level: 'warn', html: `Anti-resonance peak${peaks.length > 1 ? 's' : ''} at ${peaks.map(f => fmtSI(f, 'Hz')).join(', ')}: two neighbouring capacitor groups with a gap between their resonances. Sierra §6.4.2.2: fill the gap with an intermediate value, or add more parts of the higher-frequency type.` });
      items.push({ level: 'info', html: `The plane pair contributes ${fmtSI(Cp, 'F')}, small but with almost no inductance, so it matters at hundreds of MHz. Thinner spacing helps twice: more C and less L.` });
      V.set(items);
      E.set(`<p>Z<sub>target</sub> = ${st.V} V × ${st.rip}% / (0.5 × ${st.I} A) = <b>${fmtSI(Zt, 'Ω')}</b>. Each dashed V-shaped curve is one capacitor group: capacitive on the left of its dip, inductive on the right. Parallel groups combine like resistors in parallel, so the bold curve follows the lowest one.</p><p>Notice that adding more of the <i>same</i> part lowers its whole curve (÷n), while mounting style shifts the right-hand (inductive) side.</p>`);
    }
    update();
  })();

  /* =================================================================
     5.4  DC current crowding in a power plane (field solve)
     ================================================================= */
  (function labCrowd() {
    const host = document.getElementById('lab-crowd'); if (!host) return;
    const L = lab(host, { title: 'Power plane from regulator to a high-current load, through a via field' });
    const W = 60, H = 30, R = 4; // mm, cells per mm
    const NX = W * R, NY = H * R;
    const st = { I: 6, a: 1.4, pat: 'aligned', neck: 30, oz: 1, field: true, rail: 3.3 };
    const sI = slider({ label: 'Current', min: 1, max: 12, step: 0.5, value: st.I, fmt: v => v + ' A', onInput: v => { st.I = v; schedule(); } });
    const cF = check({ label: 'Signal via field through the plane (e.g. under a connector)', checked: true, onChange: v => { st.field = v; schedule(); } });
    const sA = slider({ label: 'Antipad diameter (via pitch 2.0 mm)', min: 0.8, max: 2.4, step: 0.05, value: st.a, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.a = v; schedule(); } });
    const sP = seg({ label: 'Via arrangement', options: [{ v: 'aligned', label: 'aligned rows' }, { v: 'stagger', label: 'staggered' }], value: st.pat, onChange: v => { st.pat = v; schedule(); } });
    const sN = slider({ label: 'Neck width (another island squeezes in)', min: 4, max: 30, step: 1, value: st.neck, fmt: v => v + ' mm', onInput: v => { st.neck = v; schedule(); } });
    const sO = seg({ label: 'Copper', options: [{ v: 0.5, label: '½ oz' }, { v: 1, label: '1 oz' }, { v: 2, label: '2 oz' }], value: st.oz, onChange: v => { st.oz = v; schedule(); } });
    const sRl = seg({ label: 'Rail voltage (sets the drop budget)', options: [{ v: 5, label: '5 V' }, { v: 3.3, label: '3.3 V' }, { v: 1.8, label: '1.8 V' }], value: st.rail, onChange: v => { st.rail = v; schedule(); } });
    L.controls.append(sRl.el, sI.el, cF.el, sA.el, sP.el, sN.el, sO.el);
    const PX = 10;
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${W * PX} ${H * PX}` });
    const off = document.createElement('canvas'); off.width = NX; off.height = NY;
    const img = svg('image', { x: 0, y: 0, width: W * PX, height: H * PX, preserveAspectRatio: 'none' });
    const over = svg('g');
    S.append(img, over);
    L.stage.append(S, legend([['#2a6b52', 'low current density'], ['#ffd166', 'high'], ['#fff7dd', 'hot spot']]));
    const M = meters(L.stage, [{ key: 'drop', label: 'Voltage drop to load' }, { key: 'pct', label: 'of the rail (budget 1–2%)', bar: true }, { key: 'jmax', label: 'Peak current density' }, { key: 'web', label: 'Copper web between antipads' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Solved DC current flow (2-D Laplace on a 0.25 mm grid with sub-cell copper fractions). Regulator vias on the left edge held at 0 V; current leaves through five load pins on the right.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    let warm = null, pend = false;
    function schedule() { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; update(); }); } }
    function vias() {
      const out = [];
      if (!st.field) return out;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 14; j++) {
        const x = 20 + 2 * i, y = 2 + 2 * j + (st.pat === 'stagger' && i % 2 ? 1 : 0);
        if (y < 28.5) out.push({ x, y });
      }
      return out;
    }
    const PINS = [11, 13, 15, 17, 19].map(y => ({ x: 56, y }));
    function update() {
      const N = NX * NY, cond = new Float32Array(N), src = new Float32Array(N), fixed = new Uint8Array(N), fv = new Float32Array(N);
      const Rs = 0.49e-3 / st.oz, g0 = 1 / Rs;
      const vv = vias(), ar = st.a / 2;
      const nlo = (H - st.neck) / 2, nhi = (H + st.neck) / 2;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        let cu = 0;
        for (let sj = 0; sj < 3; sj++) for (let si = 0; si < 3; si++) {
          const x = (i + (si + 0.5) / 3) / R, y = (j + (sj + 0.5) / 3) / R;
          let ok = true;
          if (x > 42 && x < 47 && (y < nlo || y > nhi)) ok = false;
          if (ok && x > 18.5 && x < 37.5) for (const v of vv) { const dx = x - v.x, dy = y - v.y; if (dx * dx + dy * dy < ar * ar) { ok = false; break; } }
          if (ok) cu++;
        }
        const k = j * NX + i;
        cond[k] = cu / 9 * g0;
        if (i < 2) { fixed[k] = 1; fv[k] = 0; cond[k] = g0; }
      }
      for (const p of PINS) {
        const ci = Math.floor(p.x * R), cj = Math.floor(p.y * R);
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const k = (cj + dj) * NX + ci + di; cond[k] = g0; src[k] = -st.I / PINS.length / 25; }
      }
      const res = PCB.solveField({ nx: NX, ny: NY, cond, src, fixed, fixedVal: fv, iters: warm ? 450 : 1600, phi0: warm });
      warm = res.phi;
      let vmin = 0; for (const p of PINS) vmin = Math.min(vmin, res.phi[Math.floor(p.y * R) * NX + Math.floor(p.x * R)]);
      const drop = -vmin;
      // heat
      const uni = st.I / H; // A/mm if spread evenly over the plane width
      const g = off.getContext('2d'), im = g.createImageData(NX, NY);
      let jmax = 0;
      for (let k = 0; k < N; k++) {
        const jmm = res.jm[k] * R; // A per mm width
        if (cond[k] > 0.05 * g0 && !fixed[k]) jmax = Math.max(jmax, jmm);
        const t = cond[k] <= 0 ? -1 : clamp((Math.log10(Math.max(jmm, 1e-9) / uni) + 0.3) / 1.3, 0, 1); // ½× uniform → dark, 1× → dull copper, 10× → white
        const c = t < 0 ? [8, 22, 16] : PCB.heat(0.08 + 0.92 * t);
        im.data[k * 4] = c[0]; im.data[k * 4 + 1] = c[1]; im.data[k * 4 + 2] = c[2]; im.data[k * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      img.setAttribute('href', off.toDataURL());
      over.innerHTML = '';
      over.append(svg('rect', { x: 0, y: 0, width: 2 * PX, height: H * PX, fill: 'rgba(224,166,74,.55)' }),
        svg('text', { x: 6, y: 14, fill: '#fff', 'font-size': 11, 'font-weight': 650, text: 'REG' }));
      for (const p of PINS) over.append(svg('rect', { x: (p.x - 0.6) * PX, y: (p.y - 0.6) * PX, width: 1.2 * PX, height: 1.2 * PX, fill: '#e8eef2', stroke: '#000' }));
      over.append(svg('text', { x: 52 * PX, y: 8 * PX, fill: '#e8eef2', 'font-size': 11, 'font-weight': 650, text: 'load pins' }));
      for (const v of vv) over.append(svg('circle', { cx: v.x * PX, cy: v.y * PX, r: 0.18 * PX, fill: '#e0a64a' }));
      const tCu = phys.tOz(st.oz), jmm2 = jmax / tCu;
      const web = st.field ? Math.max(0, 2.0 - st.a) : null;
      const pct = drop / st.rail * 100, lvl = pct > 2 ? 'bad' : pct > 1 ? 'warn' : 'good';
      M.set('drop', fmtSI(drop, 'V'), lvl);
      M.set('pct', sig(pct, 2) + ' %', lvl, pct / 4);
      M.set('jmax', sig(jmm2, 2) + ' A/mm²', jmm2 > 50 ? 'bad' : jmm2 > 25 ? 'warn' : 'good');
      M.set('web', web == null ? '—' : sig(web, 2) + ' mm', web == null ? null : web < 0.2 ? 'bad' : web < 0.4 ? 'warn' : 'good');
      const items = [];
      items.push({ level: lvl, html: `<b>${fmtSI(drop, 'V')}</b> drop from regulator to load pins: ${sig(pct, 2)}% of ${st.rail} V. ${lvl === 'bad' ? 'Over a typical 1–2% DC budget: it eats into the load\'s input tolerance and changes with load current.' : lvl === 'warn' ? 'Using up a good part of a typical 1–2% DC budget.' : 'Comfortably inside a typical 1–2% DC budget.'} The same copper costs ${sig(drop / 1.8 * 100, 2)}% on a 1.8 V rail. Low-voltage rails are the hard ones.` });
      if (st.field && web < 0.2) items.push({ level: 'bad', html: `Antipads (${sig(st.a, 2)} mm) on a 2.0 mm pitch leave ${sig(web, 2)} mm webs${st.pat === 'aligned' ? ' and line up into a wall' : ''}. The current must squeeze around the field: see the bright crowding at the edges.` });
      else if (st.field && st.pat === 'aligned') items.push({ level: 'info', html: 'Aligned rows create straight "streets" of copper. Try staggered: zig-zag webs connect in more directions.' });
      if (st.neck < 12) items.push({ level: st.neck < 8 ? 'bad' : 'warn', html: `The ${st.neck} mm neck concentrates all ${st.I} A: current density peaks at ${sig(jmm2, 2)} A/mm² there. Necks are where planes heat up and where voltage drop builds.` });
      if (jmm2 > 50) items.push({ level: 'bad', html: 'Local current density this high heats the copper (compare lesson 1.1). Widen the path or use more copper layers in parallel.' });
      V.set(items);
      E.set('<p>Current in a plane behaves like water through a field of posts: it spreads where it can and <b>crowds</b> where the copper narrows. The voltage drop is the integral of that crowding.</p><p>On a carrier board the worst spots are under the module connector and around BGA-like via fields. That is exactly where the power has to arrive. Keep copper webs between antipads, stagger the vias, and feed high-current rails from more than one side.</p>');
    }
    update();
  })();

  /* ================================================================= quiz */
  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Your decoupling capacitors are 100 nF 0402, connected by 2.5 mm traces to their vias. What change helps most at 100 MHz?', opts: ['Switch to 1 µF in the same footprint', 'Move the vias to the pads (or use via-in-pad) to shrink the loop', 'Use a larger 0805 package'], a: 1, ex: 'Above resonance a capacitor is just an inductor. The value hardly matters there, while the trace-and-via loop inductance dominates.' },
    { q: 'Using Sierra\'s formula, what is the target impedance for a 1.0 V rail with 3% ripple and I<sub>max</sub> = 6 A?', opts: ['50 mΩ', '10 mΩ', '0.5 mΩ'], a: 1, ex: 'Z = 1.0 × 0.03 / (0.5 × 6) = 0.01 Ω = 10 mΩ. Low-voltage, high-current core rails have the hardest PDN targets.' },
    { q: 'The rail dips most ~200 ns after a load step. Which fix targets that time window?', opts: ['More 10 nF capacitors', 'More 1–10 µF capacitors near the load', 'A faster regulator control loop'], a: 1, ex: 'Hundreds of ns is the gap between the small local ceramics running out of charge and the bulk cap/regulator catching up. Mid-value ceramics (1–10 µF) cover it.' },
    { q: 'Why stagger signal vias that pass through a power plane under a connector?', opts: ['It looks tidier', 'It keeps copper webs connecting in several directions, so the plane doesn\'t turn into a wall of merged antipads', 'Staggered vias have lower inductance'], a: 1, ex: 'Aligned antipads merge into lines that block current flow perpendicular to them. Staggering preserves conduction paths and reduces hot spots (Sierra §7.3.1.2).' },
  ]);
})();
