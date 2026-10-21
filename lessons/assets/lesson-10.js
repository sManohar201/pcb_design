/* Lesson 10 — Vias */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;
  PCB.renderChrome({ lesson: 10 });

  /* =================================================================
     10.1  Via types and stub resonance
     ================================================================= */
  (function labStub() {
    const host = document.getElementById('lab-stub'); if (!host) return;
    const L = lab(host, { title: 'Signal via from L1 down to an inner layer' });
    const THK = { 8: 1.6, 10: 2.0, 12: 2.4 };
    const IFC = { u2: ['USB 3.2 Gen 2', 5], p3: ['PCIe Gen 3', 4], p4: ['PCIe Gen 4', 8], p5: ['PCIe Gen 5', 16] };
    const st = { n: 10, tgt: 3, type: 'through', ifc: 'p4', drill: 0.25 };
    const sN = seg({ label: 'Board', options: [8, 10, 12].map(v => ({ v, label: `${v} layers · ${THK[v]} mm` })), value: st.n, onChange: v => { st.n = v; st.tgt = Math.min(st.tgt, v); sT.input.max = v; sT.set(st.tgt); update(); } });
    const sT = slider({ label: 'Signal leaves the via on layer', min: 2, max: 10, step: 1, value: st.tgt, fmt: v => 'L' + v, onInput: v => { st.tgt = v; update(); } });
    const sTy = seg({ label: 'Via type', options: [{ v: 'through', label: 'through' }, { v: 'back', label: 'back-drilled' }, { v: 'blind', label: 'blind / microvia stack' }], value: st.type, onChange: v => { st.type = v; update(); } });
    const sI = seg({ label: 'Interface (Nyquist)', options: Object.entries(IFC).map(([v, a]) => ({ v, label: `${a[0]} (${a[1]} GHz)` })), value: st.ifc, onChange: v => { st.ifc = v; update(); } });
    const sD = slider({ label: 'Drill diameter', min: 0.1, max: 0.4, step: 0.01, value: st.drill, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.drill = v; update(); } });
    L.controls.append(sN.el, sT.el, sTy.el, sI.el, sD.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 230' });
    L.stage.append(S, legend([['var(--copper)', 'via barrel carrying the signal'], ['#ff5d6c', 'stub (unused barrel)'], ['#555', 'back-drilled hole']]));
    const plot = new Plot(L.stage, { title: 'Transmission through the via (stub resonance)', height: 220, xmin: 0, xmax: 25, xlabel: 'GHz', ylabel: 'dB', xfmt: v => sig(v, 2), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'len', label: 'Stub length' }, { key: 'f', label: 'Stub resonance' }, { key: 'r', label: '× Nyquist', bar: true }, { key: 'loss', label: 'Loss at Nyquist' }, { key: 'ar', label: 'Aspect ratio' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Stub = open quarter-wave resonator: f ≈ c / (4·l·√Dk_eff). Pads and antipads load the barrel, so Dk_eff ≈ 9.6 (√ ≈ 3.1), consistent with the rule of thumb that a 100 mil (2.5 mm) stub notches near 10 GHz. Transmission of a shunt open stub (≈50 Ω) on a 50 Ω line, with a loss floor. Layer depths assumed evenly spaced.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const n = st.n, T = THK[n], tgt = Math.min(st.tgt, n);
      const depth = l => (l - 1) / (n - 1) * T;
      const used = depth(tgt);
      let stub = st.type === 'through' ? T - used : st.type === 'back' ? (tgt === n ? 0 : Math.min(0.2, T - used)) : 0;
      stub = Math.max(stub, 0);
      const SQ = 3.1; // √(effective Dk) of a pad-loaded via barrel (≈2.5× the laminate's Dk)
      const fres = stub > 0.01 ? 300 / (4 * stub * SQ) : Infinity;
      const nyq = IFC[st.ifc][1];
      const s21 = f => { if (stub < 0.01) return -0.05 * f / 10; const bl = 2 * Math.PI * f * SQ / 300 * stub; const tn = Math.tan(bl); const db = -10 * Math.log10(1 + (50 * tn / (2 * 50)) ** 2); return Math.max(db, -25) - 0.03 * f; };
      const fs = [], ys = []; for (let i = 0; i <= 500; i++) { const f = 25 * i / 500; fs.push(f); ys.push(s21(f)); }
      const vl = [{ x: nyq, color: 'var(--text)', label: 'Nyquist' }]; if (isFinite(fres) && fres < 25) vl.push({ x: fres, color: 'var(--bad)', label: 'stub resonance' });
      plot.draw({ series: [{ x: fs, y: ys, color: 'var(--accent)', width: 2.4 }], vlines: vl, range: { ymin: -27, ymax: 1 } });
      const ratio = fres / nyq, lossN = s21(nyq);
      M.set('len', sig(stub, 2) + ' mm', stub > 1 ? 'bad' : stub > 0.4 ? 'warn' : 'good');
      M.set('f', isFinite(fres) ? sig(fres, 3) + ' GHz' : 'none');
      M.set('r', isFinite(ratio) ? '×' + sig(ratio, 2) : '∞', ratio < 2 ? 'bad' : ratio < 3 ? 'warn' : 'good', isFinite(ratio) ? ratio / 6 : 1);
      M.set('loss', sig(lossN, 2) + ' dB', lossN < -3 ? 'bad' : lossN < -1 ? 'warn' : 'good');
      const ar = T / st.drill;
      M.set('ar', sig(ar, 2) + ' : 1', st.type !== 'blind' && ar > 12 ? 'bad' : st.type !== 'blind' && ar > 10 ? 'warn' : 'good');
      // drawing
      S.innerHTML = '';
      const y0 = 25, sc = 180 / T, x = 320;
      for (let l = 1; l <= n; l++) { const y = y0 + depth(l) * sc; S.append(svg('rect', { x: 60, y: y - 2, width: 520, height: 4, fill: l === 1 || l === tgt ? 'var(--copper)' : '#2f6b51' }), svg('text', { x: 52, y: y + 4, 'text-anchor': 'end', fill: '#cfe0d5', 'font-size': 10, text: 'L' + l })); }
      const bw = Math.max(st.drill * sc * 1.2, 6);
      S.append(svg('rect', { x: 60, y: y0 - 3, width: x - 60, height: 6, fill: 'var(--copper)' }), svg('rect', { x, y: y0 + used * sc - 3, width: 260, height: 6, fill: 'var(--copper)' }));
      S.append(svg('rect', { x: x - bw / 2, y: y0, width: bw, height: used * sc, fill: 'var(--copper)' }));
      if (st.type === 'through') S.append(svg('rect', { x: x - bw / 2, y: y0 + used * sc, width: bw, height: (T - used) * sc, fill: '#ff5d6c' }));
      if (st.type === 'back') { S.append(svg('rect', { x: x - bw / 2, y: y0 + used * sc, width: bw, height: stub * sc, fill: '#ff5d6c' }), svg('rect', { x: x - bw * 0.9, y: y0 + (used + stub) * sc, width: bw * 1.8, height: (T - used - stub) * sc, fill: '#555' })); }
      if (st.type === 'blind') S.append(svg('text', { x: x + 12, y: y0 + used * sc + 18, fill: '#cfe0d5', 'font-size': 10.5, text: 'blind/microvias end here' }));
      if (stub > 0.01) S.append(svg('text', { x: x + bw, y: y0 + (used + stub / 2) * sc + 4, fill: '#ff8a7a', 'font-size': 11, 'font-weight': 650, text: ` stub ${sig(stub, 2)} mm` }));
      const items = [];
      if (stub > 0.01) items.push({ level: ratio < 2 ? 'bad' : ratio < 3 ? 'warn' : 'good', html: `A ${sig(stub, 2)} mm stub resonates at <b>${sig(fres, 3)} GHz</b> (${sig(ratio, 2)}× the ${nyq} GHz Nyquist). ${ratio < 2 ? 'It is removing a chunk of your signal\'s spectrum: expect a closed eye.' : ratio < 3 ? 'Marginal: the notch\'s skirt already attenuates the signal.' : 'Far enough above the signal band.'}` });
      else items.push({ level: 'good', html: 'No stub: the via ends where the signal leaves it.' });
      if (st.type === 'through' && tgt < n / 2) items.push({ level: 'info', html: `Routing to L${n} or a layer near the bottom would shrink the stub to ~${sig(T - depth(n - 1), 2)} mm for free. That is why fast signals in thick boards often use the "far" inner layers.` });
      if (st.type === 'back') items.push({ level: 'info', html: 'Back-drilling removes most of the stub (a ~0.2 mm residual remains) at an extra cost per hole. It is common on thick boards carrying 10+ Gb/s.' });
      if (st.type === 'blind') items.push({ level: 'info', html: 'Blind and micro vias avoid stubs entirely but need sequential lamination (Sierra: keep it to ≤ 3 cycles) and add cost. They are standard on HDI boards for fine-pitch BGAs.' });
      if (st.type !== 'blind' && ar > 10) items.push({ level: 'warn', html: `Aspect ratio ${sig(ar, 2)}:1 is beyond the ~10:1 that standard plating handles reliably (Sierra §4.1.2). Use a larger drill or a thinner board.` });
      V.set(items);
      E.set('<p>The signal enters the via and splits: most continues out on the target layer, but part runs down the stub, reflects from its open end and comes back. At the frequency where the stub is λ/4 long, that reflection returns exactly inverted and cancels the signal: a notch.</p><p>Shorter stubs push the notch higher. Below about a third of the notch frequency the stub is mostly harmless.</p>');
    }
    update();
  })();

  /* =================================================================
     10.2  Via as a discontinuity (TDR)
     ================================================================= */
  (function labZvia() {
    const host = document.getElementById('lab-zvia'); if (!host) return;
    const L = lab(host, { title: 'Tune a signal via to 50 Ω' });
    const st = { pad: 0.5, anti: 0.8, drill: 0.25, len: 1.6, ret: 1.0, nfp: true, tr: 50 };
    const sP = slider({ label: 'Pad diameter', min: 0.3, max: 0.8, step: 0.01, value: st.pad, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.pad = v; st.anti = Math.max(st.anti, v + 0.1); sA.set(st.anti); update(); } });
    const sA = slider({ label: 'Antipad diameter (plane clearance)', min: 0.4, max: 1.8, step: 0.02, value: st.anti, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.anti = Math.max(v, st.pad + 0.1); update(); } });
    const sD = slider({ label: 'Drill', min: 0.15, max: 0.4, step: 0.01, value: st.drill, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.drill = v; update(); } });
    const sL = slider({ label: 'Via length (board thickness)', min: 0.8, max: 2.4, step: 0.1, value: st.len, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.len = v; update(); } });
    const sR = slider({ label: 'Distance to nearest ground return via', min: 0.6, max: 10, log: true, value: st.ret, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.ret = v; update(); } });
    const cN = check({ label: 'Keep non-functional pads on unused inner layers', checked: true, onChange: v => { st.nfp = v; update(); } });
    const sT = seg({ label: 'Edge', options: [{ v: 30, label: '30 ps' }, { v: 50, label: '50 ps' }, { v: 150, label: '150 ps' }], value: st.tr, onChange: v => { st.tr = v; update(); } });
    L.controls.append(sP.el, sA.el, sD.el, sL.el, sR.el, cN.el, sT.el);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 150', style: 'background:var(--surface-2)' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'TDR: impedance seen by the edge around the via', height: 220, xmin: -60, xmax: 60, xlabel: 'ps relative to the via', ylabel: 'Ω', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'c', label: 'Via capacitance' }, { key: 'l', label: 'Via loop inductance' }, { key: 'z', label: 'Via impedance √(L/C)' }, { key: 'rho', label: 'Worst reflection', bar: true }]);
    L.stage.append(el('div', { class: 'model-note' }, 'C from the Johnson/Graham pad formula (C ≈ 1.41·Dk·T·D_pad/(D_anti − D_pad)); L from Sierra eq. PI-15 using the return-via distance. Via modelled as a short line of impedance √(L/C) and delay √(LC) between 50 Ω lines.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const C = phys.viaC(st.len, st.pad, st.anti) * (st.nfp ? 1.35 : 1);
      const Lh = phys.viaLoopL(st.len, Math.max(st.ret, st.drill * 1.6), st.drill) * 1e-9;
      const Z = Math.sqrt(Lh / C), td = Math.sqrt(Lh * C);
      const net = new PCB.TLine(0.8e-12);
      let a = net.line(0, 50, 0.3e-9);
      const vstart = a;
      a = net.line(a, Z, Math.max(td, 1.6e-12));
      a = net.line(a, 50, 0.3e-9);
      net.G[a] = 1 / 50;
      const tr = st.tr * 1e-12, t0 = 0.02e-9;
      const r = PCB.simNet(net, { src: 0, Rs: 50, vs: t => PCB.ramp(t, t0, tr), T: 0.9e-9, nOut: 900, probes: [0] });
      const tv = 2 * 0.3e-9 + t0 + tr / 2;
      const xs = [], zs = [];
      for (let i = 0; i < r.t.length; i++) { const x = (r.t[i] - tv) * 1e12; if (x < -60 || x > 60) continue; const rho = clamp((r.out[0][i] - 0.5) / 0.5, -0.9, 0.9); xs.push(x); zs.push(50 * (1 + rho) / (1 - rho)); }
      plot.draw({ series: [{ x: xs, y: zs, color: 'var(--accent)', width: 2.4 }], hlines: [{ y: 50, color: 'var(--good)', dash: [4, 4], label: '50 Ω' }], range: { ymin: 25, ymax: 80 } });
      const worst = Math.max(...zs.map(z => Math.abs((z - 50) / (z + 50))));
      M.set('c', fmtSI(C, 'F'));
      M.set('l', fmtSI(Lh, 'H'));
      M.set('z', sig(Z, 3) + ' Ω', Math.abs(Z - 50) < 7 ? 'good' : Math.abs(Z - 50) < 15 ? 'warn' : 'bad');
      M.set('rho', sig(worst * 100, 2) + ' %', worst > 0.1 ? 'bad' : worst > 0.05 ? 'warn' : 'good', worst / 0.3);
      // drawing (top view of pad + antipad, return via)
      S.innerHTML = '';
      const sc = 50, cx = 160, cy = 75;
      S.append(svg('rect', { x: 10, y: 10, width: 620, height: 130, fill: '#5fbf79', opacity: 0.45 }));
      S.append(svg('circle', { cx, cy, r: st.anti / 2 * sc, fill: 'var(--surface-2)' }), svg('circle', { cx, cy, r: st.pad / 2 * sc, fill: '#e0a64a' }), svg('circle', { cx, cy, r: st.drill / 2 * sc, fill: '#333' }));
      const rx = cx + Math.min(st.ret, 8.5) * sc * 0.5;
      S.append(svg('circle', { cx: rx, cy, r: st.pad / 2 * sc * 0.8, fill: '#5fbf79', stroke: '#2d4a2f' }), svg('text', { x: rx, y: cy + 34, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 10.5, text: `GND via ${sig(st.ret, 2)} mm` }));
      S.append(svg('text', { x: cx, y: 132, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 10.5, text: 'signal via: pad in antipad (plane in green)' }));
      if (rx > 520) S.append(svg('text', { x: 600, y: 30, 'text-anchor': 'end', fill: 'var(--bad)', 'font-size': 10.5, text: '(not to scale)' }));
      const items = [];
      items.push({ level: Math.abs(Z - 50) < 7 ? 'good' : 'warn', html: `Via ≈ <b>${sig(Z, 3)} Ω</b> (${fmtSI(C, 'F')}, ${fmtSI(Lh, 'H')}). ${Z < 43 ? 'Too capacitive: shrink the pad, enlarge the antipad, or remove non-functional pads.' : Z > 57 ? 'Too inductive: bring a ground via closer, or use a shorter via.' : 'Close to the 50 Ω line: the edge barely notices it.'}` });
      if (st.ret > 3) items.push({ level: 'warn', html: `The nearest return via is ${sig(st.ret, 2)} mm away, so the return current detours (lesson 3.4) and the via looks inductive.` });
      if (st.anti > 1.2) items.push({ level: 'warn', html: `Large antipads (${sig(st.anti, 2)} mm) improve this via but punch big holes in the planes. Under a dense connector they merge into a wall (lesson 5.4). Balance per via.` });
      if (st.tr >= 150) items.push({ level: 'info', html: 'With a 150 ps edge the via is much shorter than the edge, so it hardly matters. Via tuning is a multi-Gb/s concern.' });
      V.set(items);
      E.set('<p>Each pad facing a plane through its antipad is a capacitor. More planes, bigger pads and smaller antipads mean more C. The barrel plus its return path is an inductor, and the farther the return via, the more L.</p><p>A via of length ~1.6 mm with √(L/C) ≈ 50 Ω is effectively part of the line. That is what "via impedance control" means.</p>');
    }
    update();
  })();

  /* =================================================================
     10.3  Current capacity
     ================================================================= */
  (function labCur() {
    const host = document.getElementById('lab-cur'); if (!host) return;
    const L = lab(host, { title: 'How many vias for a power connection?' });
    const st = { I: 5, d: 0.3, plt: 25, dT: 10 };
    const sI = slider({ label: 'Current through the layer change', min: 0.5, max: 20, step: 0.5, value: st.I, fmt: v => v + ' A', onInput: v => { st.I = v; update(); } });
    const sD = slider({ label: 'Drill diameter', min: 0.15, max: 0.6, step: 0.01, value: st.d, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.d = v; update(); } });
    const sP = seg({ label: 'Plating thickness', options: [{ v: 20, label: '20 µm' }, { v: 25, label: '25 µm' }, { v: 35, label: '35 µm' }], value: st.plt, onChange: v => { st.plt = v; update(); } });
    const sT = seg({ label: 'Allowed temperature rise', options: [{ v: 5, label: '5 °C' }, { v: 10, label: '10 °C' }, { v: 20, label: '20 °C' }], value: st.dT, onChange: v => { st.dT = v; update(); } });
    L.controls.append(sI.el, sD.el, sP.el, sT.el, el('button', { class: 'btn', onclick: () => { st.d = 0.2; st.plt = 20; st.dT = 5; st.I = 0.8; sD.set(0.2); sP.set(20); sT.set(5); sI.set(0.8); update(); } }, 'Sierra\'s example: 8 mil drill, 5 °C'));
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 170' });
    L.stage.append(S);
    const M = meters(L.stage, [{ key: 'iv', label: 'Current per via' }, { key: 'n', label: 'Vias needed' }, { key: 'n2', label: 'With 50% margin' }, { key: 'r', label: 'R per via' }, { key: 'v', label: 'Drop across the array' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'IPC-2221 external-trace curve applied to the unrolled barrel (width = π × drill, thickness = plating), as in Sierra §7.4.3.2. Resistance of a 1.6 mm thin-walled copper tube.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const A = (Math.PI * st.d / 0.0254) * (st.plt / 25.4);
      const iv = 0.048 * Math.pow(st.dT, 0.44) * Math.pow(A, 0.725);
      const n = Math.ceil(st.I / iv), n2 = Math.ceil(st.I * 1.5 / iv);
      const R = phys.rhoCu(25) * 1.6e-3 / (Math.PI * st.d * 1e-3 * st.plt * 1e-6);
      M.set('iv', sig(iv, 2) + ' A');
      M.set('n', String(n), n > 20 ? 'warn' : null);
      M.set('n2', String(n2));
      M.set('r', fmtSI(R, 'Ω'));
      M.set('v', fmtSI(st.I * R / n2, 'V'));
      S.innerHTML = '';
      const cols = Math.ceil(Math.sqrt(n2 * 2)), pitch = clamp(520 / Math.max(cols, 1), 14, 46);
      S.append(svg('rect', { x: 40, y: 20, width: Math.min(560, cols * pitch + 20), height: Math.ceil(n2 / cols) * pitch + 20, rx: 6, fill: 'var(--copper)', opacity: 0.35 }));
      for (let i = 0; i < n2; i++) S.append(svg('circle', { cx: 50 + (i % cols) * pitch + pitch / 2, cy: 30 + Math.floor(i / cols) * pitch + pitch / 2, r: clamp(st.d / 0.6 * pitch * 0.45, 3, pitch * 0.42), fill: '#1a1a1a', stroke: 'var(--copper)', 'stroke-width': 2 }));
      S.append(svg('text', { x: 600, y: 160, 'text-anchor': 'end', fill: '#cfe0d5', 'font-size': 11, text: `${n2} vias (incl. margin) for ${st.I} A` }));
      const items = [{ level: 'info', html: `Each ${sig(st.d, 2)} mm via carries ≈<b>${sig(iv, 2)} A</b> for a ${st.dT} °C rise, so ${st.I} A needs ${n}, or ${n2} with margin. Spread them across the connection so they share current evenly.` }];
      if (st.d < 0.25 && st.I > 3) items.push({ level: 'warn', html: 'Small vias for big currents get numerous fast. Larger drills, or via arrays under the pads of high-current parts, are more practical.' });
      items.push({ level: 'info', html: `A side benefit: ${n2} vias in parallel also divide the inductance, which matters for regulator input/output connections and decoupling (lesson 5).` });
      V.set(items);
      E.set('<p>A via\'s copper is just its plating: a thin tube about 20–25 µm thick. Unrolled, a 0.3 mm via is a ~0.94 mm wide trace of very thin copper, so it carries about what that trace would.</p><p>Thermal reality is a little kinder, because the via is short and well connected to planes that spread heat. That is why IPC tables for vias are often more generous. Use the margin anyway.</p>');
    }
    update();
  })();

  /* =================================================================
     10.4  BGA fanout capacity
     ================================================================= */
  (function labBGA() {
    const host = document.getElementById('lab-bga'); if (!host) return;
    const L = lab(host, { title: 'Can this BGA be fanned out, and on how many layers?' });
    const st = { pitch: 0.8, via: 0.45, ts: 0.1, rows: 8, vip: false };
    const sP = seg({ label: 'Ball pitch', options: [1.0, 0.8, 0.65, 0.5, 0.4].map(v => ({ v, label: v + ' mm' })), value: st.pitch, onChange: v => { st.pitch = v; update(); } });
    const sV = slider({ label: 'Via pad diameter', min: 0.2, max: 0.6, step: 0.01, value: st.via, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.via = v; update(); } });
    const sTS = seg({ label: 'Trace / space', options: [{ v: 0.075, label: '75/75 µm' }, { v: 0.1, label: '100/100 µm' }, { v: 0.125, label: '125/125 µm' }], value: st.ts, onChange: v => { st.ts = v; update(); } });
    const sR = slider({ label: 'Rows of balls from the edge to the centre', min: 3, max: 14, step: 1, value: st.rows, fmt: v => String(v), onInput: v => { st.rows = v; update(); } });
    const cV = check({ label: 'Via-in-pad (filled & capped)', onChange: v => { st.vip = v; update(); } });
    L.controls.append(sP.el, sV.el, sTS.el, sR.el, cV.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 300' });
    L.stage.append(S, legend([['#cfd6da', 'BGA ball pad (top layer)'], ['var(--copper)', 'via'], ['var(--sig)', 'escape traces on an inner layer, in the channels between vias', true]]));
    const M = meters(L.stage, [{ key: 'ch', label: 'Channel between vias' }, { key: 'n', label: 'Traces per channel' }, { key: 'top', label: 'Rows escaped on top' }, { key: 'lay', label: 'Signal layers needed' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Ball pad ≈ 0.5 × pitch. Each inner layer escapes (traces per channel + 1) rows. Ignores power/ground balls, which in reality free up channels, so treat the count as an upper bound.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const p = st.pitch, ball = 0.5 * p, w = st.ts, s = st.ts;
      const dogOK = p * Math.SQRT2 / 2 >= st.via / 2 + ball / 2 + s;
      const vip = st.vip || !dogOK;
      const ch = p - st.via;
      const n = Math.max(0, Math.floor((ch - s) / (w + s)));
      const nTop = vip ? Math.max(0, Math.floor((p - Math.max(ball, st.via) - s) / (w + s))) : Math.max(0, Math.floor((p - ball - s) / (w + s)));
      const topRows = Math.min(st.rows, 1 + nTop);
      const rest = Math.max(0, st.rows - topRows);
      const layers = 1 + Math.ceil(rest / (n + 1));
      M.set('ch', sig(ch * 1000, 3) + ' µm', ch < 2 * s + w ? 'bad' : null);
      M.set('n', String(n), n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');
      M.set('top', String(topRows));
      M.set('lay', String(layers), layers > 6 ? 'bad' : layers > 4 ? 'warn' : 'good');
      // drawing: 7×5 corner
      S.innerHTML = '';
      const sc = Math.min(48 / p, 70), ox = 60, oy = 40;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
        const x = ox + c * p * sc, y = oy + r * p * sc;
        S.append(svg('circle', { cx: x, cy: y, r: ball / 2 * sc, fill: '#cfd6da' }));
        if (vip) S.append(svg('circle', { cx: x, cy: y, r: st.via / 2 * sc * 0.6, fill: 'var(--copper)' }));
        else if (r < 4 && c < 7) S.append(svg('circle', { cx: x + p * sc / 2, cy: y + p * sc / 2, r: st.via / 2 * sc, fill: 'var(--copper)' }), svg('line', { x1: x, y1: y, x2: x + p * sc / 2, y2: y + p * sc / 2, stroke: 'var(--copper)', 'stroke-width': w * sc }));
      }
      // escape traces in the first channels (between via columns), going down
      for (let c = 0; c < 6; c++) {
        const cx = vip ? ox + (c + 0.5) * p * sc : ox + (c + 1) * p * sc;
        for (let k = 0; k < n; k++) {
          const off = (k - (n - 1) / 2) * (w + s) * sc;
          S.append(svg('line', { x1: cx + off, y1: oy - 20, x2: cx + off, y2: oy + 4.6 * p * sc, stroke: 'var(--sig)', 'stroke-width': Math.max(w * sc, 1.5), 'stroke-dasharray': '6 4', opacity: 0.9 }));
        }
      }
      S.append(svg('text', { x: 620, y: 290, 'text-anchor': 'end', fill: '#cfe0d5', 'font-size': 11, text: vip ? 'via-in-pad' : 'dog-bone fanout' }));
      const items = [];
      if (!dogOK && !st.vip) items.push({ level: 'bad', html: `At ${p} mm pitch a ${sig(st.via, 2)} mm via pad doesn't fit between four balls with ${st.ts * 1000} µm clearance, so dog-bone is impossible. Via-in-pad is forced (shown).` });
      items.push({ level: n === 0 ? 'bad' : n === 1 ? 'warn' : 'good', html: `${sig(ch * 1000, 3)} µm between via pads fits <b>${n}</b> trace${n === 1 ? '' : 's'} at ${st.ts * 1000}/${st.ts * 1000} µm. ${n === 0 ? 'Nothing escapes between vias, so each layer frees just one row. Use smaller vias (laser microvias), finer trace/space, or more layers.' : ''}` });
      items.push({ level: layers > 6 ? 'bad' : layers > 4 ? 'warn' : 'good', html: `Escaping ${st.rows} rows needs about <b>${layers} signal layers</b>, plus the reference planes between them (lesson 2). ${p <= 0.5 ? 'Sierra §4.1.3: at 0.5 mm pitch and below expect 10+ layers with via-in-pad and buried/blind vias.' : ''}` });
      V.set(items);
      E.set('<p>Escape routing is a geometry problem: pitch minus via pad gives the channel, and the channel divided by trace + space gives the traces per channel. Each extra trace per channel frees one more row per layer.</p><p>That is how one fine-pitch part can set the layer count, stackup and via technology of the whole board, so choose packages with this in mind.</p>');
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'A PCIe Gen 4 signal goes L1 → L3 through a 2.0 mm, 10-layer board with a standard through via. Biggest concern?', opts: ['The via\'s DC resistance', 'A ~1.6 mm stub resonating near 15 GHz, under 2× the 8 GHz Nyquist', 'The via is too short'], a: 1, ex: 'Back-drill it, route to a layer near the bottom, or use blind vias.' },
    { q: 'Your signal via looks capacitive on TDR (a dip). Which change helps?', opts: ['Larger pad', 'Larger antipad and removing non-functional pads', 'Moving the return via farther away'], a: 1, ex: 'Less pad area facing the planes, or more clearance, means less capacitance.' },
    { q: 'Roughly how many 0.3 mm vias (25 µm plating, 10 °C rise) for 6 A?', opts: ['1', 'About 4–6', 'About 50'], a: 1, ex: 'The IPC estimate gives ≈1.5 A per via, so 4 vias, or ~6 with margin.' },
  ]);
})();
