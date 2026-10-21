/* Lesson 9 — Crosstalk */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;
  PCB.renderChrome({ lesson: 9 });
  const W = 0.1; // trace width used throughout (mm)

  function coupling(d, h, layer) {
    // d = centre-to-centre spacing; stripline fields are bounded by two planes, so they fall off faster
    const he = layer === 'strip' ? h * 0.8 : h;
    const kL = 1 / (1 + (d / he) ** 2);
    const kC = layer === 'strip' ? kL : kL * 0.6;
    return { kL, kC, Kb: (kL + kC) / 4, Kf: (kC - kL) / 2 };
  }

  /* =================================================================
     9.1  NEXT and FEXT waveforms
     ================================================================= */
  (function labXT() {
    const host = document.getElementById('lab-xt'); if (!host) return;
    const L = lab(host, { title: 'Aggressor edge → victim near end and far end' });
    const st = { s: 0.15, h: 0.1, len: 60, tr: 0.2, layer: 'micro' };
    const sS = slider({ label: 'Edge-to-edge gap', min: 0.05, max: 1.5, log: true, value: st.s, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.s = v; update(); } });
    const sH = slider({ label: 'Height to plane', min: 0.05, max: 0.4, log: true, value: st.h, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.h = v; update(); } });
    const sL = slider({ label: 'Parallel (coupled) length', min: 2, max: 200, log: true, value: st.len, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.len = v; update(); } });
    const sT = slider({ label: 'Aggressor rise time', min: 0.03, max: 3, log: true, value: st.tr, fmt: v => fmtSI(v * 1e-9, 's'), onInput: v => { st.tr = v; update(); } });
    const sLy = seg({ label: 'Layer', options: [{ v: 'micro', label: 'outer (microstrip)' }, { v: 'strip', label: 'inner (stripline)' }], value: st.layer, onChange: v => { st.layer = v; update(); } });
    L.controls.append(sS.el, sH.el, sL.el, sT.el, sLy.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 110' });
    L.stage.append(S);
    const p1 = new Plot(L.stage, { title: 'Noise on the victim (% of the aggressor swing)', height: 220, xlabel: 'ns', ylabel: '%', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const p2 = new Plot(L.stage, { title: 'Peak crosstalk vs coupled length', height: 190, xlog: true, xmin: 2, xmax: 200, xlabel: 'coupled length [mm]', ylabel: '%', xfmt: v => sig(v, 2), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'kb', label: 'NEXT coefficient Kb' }, { key: 'nx', label: 'NEXT peak' }, { key: 'fx', label: 'FEXT peak' }, { key: 'sat', label: 'Saturation length' }, { key: 'mv', label: 'On a 3.3 V aggressor' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Weak-coupling model (Bogatin): NEXT = Kb·[V(t) − V(t−2TD)], FEXT = ½(Cm/C − Lm/L)·TD·dV/dt. Coupling ratios from 1/(1+(d/H)²); microstrip Cm/C ≈ 0.6·Lm/L. Matched terminations.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const v = st.layer === 'strip' ? 150 : 175; // mm/ns
      const c = coupling(st.s + W, st.h, st.layer);
      const Td = st.len / v, tr = st.tr;
      const ramp = t => clamp(t / tr, 0, 1), dr = t => (t > 0 && t < tr ? 1 / tr : 0);
      const T = 2 * Td + 2 * tr + 0.3;
      const ts = [], ne = [], fe = [], ag = [];
      for (let i = 0; i <= 800; i++) {
        const t = T * i / 800; ts.push(t);
        ag.push(ramp(t - 0.1) * 100 * 0.1);
        ne.push(c.Kb * (ramp(t - 0.1) - ramp(t - 0.1 - 2 * Td)) * 100);
        fe.push(c.Kf * Td * dr(t - 0.1 - Td) * 100);
      }
      const nx = Math.max(...ne.map(Math.abs)), fx = Math.max(...fe.map(Math.abs));
      p1.draw({ series: [{ x: ts, y: ag, color: 'var(--faint)', dash: [4, 3], width: 1.3, label: 'aggressor (÷10)' }, { x: ts, y: ne, color: 'var(--link)', width: 2.3, label: 'near end (NEXT)' }, { x: ts, y: fe, color: 'var(--bad)', width: 2.3, label: 'far end (FEXT)' }] });
      const Ls = [], Ns = [], Fs = [];
      for (let i = 0; i <= 80; i++) { const l = 2 * Math.pow(100, i / 80); Ls.push(l); const td = l / v; Ns.push(c.Kb * Math.min(1, 2 * td / tr) * 100); Fs.push(Math.abs(c.Kf) * td / tr * 100); }
      p2.draw({ series: [{ x: Ls, y: Ns, color: 'var(--link)', width: 2.2, label: 'NEXT' }, { x: Ls, y: Fs, color: 'var(--bad)', width: 2.2, label: '|FEXT|' }], vlines: [{ x: v * tr / 2, color: 'var(--faint)', label: 'saturation' }, { x: st.len, color: 'var(--accent)', label: 'your length' }], range: { ymin: 0 } });
      const lsat = v * tr / 2;
      M.set('kb', sig(c.Kb * 100, 2) + ' %');
      M.set('nx', sig(nx, 2) + ' %', nx > 5 ? 'bad' : nx > 2 ? 'warn' : 'good');
      M.set('fx', sig(fx, 2) + ' %', fx > 5 ? 'bad' : fx > 2 ? 'warn' : 'good');
      M.set('sat', sig(lsat, 3) + ' mm');
      M.set('mv', `${sig(nx * 33, 3)} / ${sig(fx * 33, 3)} mV`, Math.max(nx, fx) * 33 > 165 ? 'bad' : Math.max(nx, fx) * 33 > 66 ? 'warn' : 'good');
      // drawing: two lines with arrows
      S.innerHTML = '';
      S.append(svg('rect', { x: 60, y: 30, width: 520, height: 6, fill: 'var(--copper)' }), svg('rect', { x: 60, y: 30 + clamp(st.s * 120, 10, 50), width: 520, height: 6, fill: 'var(--sig)' }));
      const yv = 30 + clamp(st.s * 120, 10, 50);
      S.append(svg('text', { x: 10, y: 37, fill: '#cfe0d5', 'font-size': 11, text: 'aggressor' }), svg('text', { x: 10, y: yv + 7, fill: '#9fd3ff', 'font-size': 11, text: 'victim' }),
        svg('text', { x: 60, y: yv + 30, fill: '#9fd3ff', 'font-size': 11, text: `← NEXT ${sig(nx, 2)}%` }), svg('text', { x: 580, y: yv + 30, 'text-anchor': 'end', fill: '#ff8a7a', 'font-size': 11, text: `FEXT ${sig(fx, 2)}% →` }),
        svg('text', { x: 320, y: 20, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 11, text: `edge travels → · coupled length ${sig(st.len, 3)} mm` }));
      const items = [];
      items.push({ level: nx > 5 ? 'bad' : nx > 2 ? 'warn' : 'good', html: `NEXT ${sig(nx, 2)}%${st.len > lsat ? `, <b>saturated</b>: the line is longer than ${sig(lsat, 3)} mm, so extra length won't make it worse. Only spacing and height reduce it now.` : `, still growing with length (saturates at ${sig(lsat, 3)} mm).`}` });
      if (st.layer === 'micro') items.push({ level: fx > 5 ? 'bad' : fx > 2 ? 'warn' : 'good', html: `FEXT ${sig(fx, 2)}% (negative pulse) grows with length × edge rate: ${sig(st.len, 3)} mm at ${fmtSI(tr * 1e-9, 's')}. Long parallel microstrip runs between fast signals are where it bites.` });
      else items.push({ level: 'good', html: 'Stripline: the field is entirely inside the dielectric, so the capacitive and inductive parts of FEXT cancel. Far-end crosstalk all but disappears.' });
      V.set(items);
      E.set(`<p>Coupling at gap ${sig(st.s, 2)} mm and height ${sig(st.h, 2)} mm: L<sub>m</sub>/L = ${sig(c.kL, 2)}, C<sub>m</sub>/C = ${sig(c.kC, 2)}.</p><p>NEXT is the <b>sum</b> of the two (both push current backward), spread over a round trip. FEXT is their <b>difference</b>, compressed into the edge. That is why it depends on the edge rate and why it vanishes when the two are equal (stripline).</p>`);
    }
    update();
  })();

  /* =================================================================
     9.2  Bus spacing, guards, broadside
     ================================================================= */
  (function labBus() {
    const host = document.getElementById('lab-bus'); if (!host) return;
    const L = lab(host, { title: 'A victim in the middle of a 5-trace bus' });
    const st = { g: 1, h: 0.1, guard: 'none', broad: 'none' };
    const sG = slider({ label: 'Gap between traces (× W)', min: 0.75, max: 6, step: 0.25, value: st.g, fmt: v => `${v} W (centre ${sig(v + 1, 2)} W)`, onInput: v => { st.g = v; update(); } });
    const sH = slider({ label: 'Height to plane', min: 0.05, max: 0.3, step: 0.005, value: st.h, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.h = v; update(); } });
    const sGd = seg({ label: 'Guard traces next to the victim', options: [{ v: 'none', label: 'none' }, { v: 'via', label: 'grounded, stitched' }, { v: 'float', label: 'floating' }], value: st.guard, onChange: v => { st.guard = v; update(); } });
    const sB = seg({ label: 'Another signal layer 0.15 mm above (no plane between)', options: [{ v: 'none', label: 'none' }, { v: 'orth', label: 'routed orthogonal' }, { v: 'par', label: 'routed parallel' }], value: st.broad, onChange: v => { st.broad = v; update(); } });
    L.controls.append(sG.el, sH.el, sGd.el, sB.el);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 170', style: 'background:var(--surface-2)' });
    const bars = svg('svg', { class: 'viz', viewBox: '0 0 640 150', style: 'background:var(--surface-2)' });
    L.stage.append(S, bars);
    const M = meters(L.stage, [{ key: 'tot', label: 'Worst-case NEXT on victim' }, { key: 'mv', label: 'On a 3.3 V bus' }, { key: 'area', label: 'Bus width (5 traces)' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Saturated NEXT from each neighbour, all switching together (worst case). Grounded guard ≈ ×0.3; floating guard modelled as a mild increase. Broadside: vertical coupling to a trace 0.15 mm above.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const pitch = (st.g + 1) * W;
      const contrib = [];
      const gf = st.guard === 'via' ? 0.3 : st.guard === 'float' ? 1.25 : 1;
      contrib.push(['left neighbour', coupling(pitch, st.h, 'micro').Kb * gf]);
      contrib.push(['right neighbour', coupling(pitch, st.h, 'micro').Kb * gf]);
      contrib.push(['2nd left', coupling(2 * pitch, st.h, 'micro').Kb]);
      contrib.push(['2nd right', coupling(2 * pitch, st.h, 'micro').Kb]);
      if (st.broad === 'par') contrib.push(['trace above (parallel)', coupling(0.0001, 0.15, 'strip').Kb * 0.4]);
      if (st.broad === 'orth') contrib.push(['trace above (crossing)', coupling(0.0001, 0.15, 'strip').Kb * 0.4 * 0.02]);
      const tot = contrib.reduce((s, c) => s + c[1], 0) * 100;
      // drawing
      S.innerHTML = '';
      const sc = 520 / (5 * W + 4 * st.g * W + (st.guard !== 'none' ? 2 * W : 0) + 0.3);
      const y0 = 130, yT = y0 - Math.max(st.h * sc, 12);
      S.append(svg('rect', { x: 10, y: yT - 50, width: 620, height: y0 - yT + 50, fill: '#cfe3c9' }), svg('rect', { x: 10, y: y0, width: 620, height: 7, fill: '#5fbf79' }));
      let x = 320 - (5 * W + 4 * st.g * W) * sc / 2;
      for (let i = 0; i < 5; i++) {
        S.append(svg('rect', { x, y: yT - 6, width: W * sc, height: 6, fill: i === 2 ? 'var(--sig)' : '#e0a64a' }), svg('text', { x: x + W * sc / 2, y: yT - 12, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 10.5, text: i === 2 ? 'victim' : 'agg' }));
        if (st.guard !== 'none' && (i === 1 || i === 2)) { const gx = x + W * sc + st.g * W * sc / 2 - 3; S.append(svg('rect', { x: gx, y: yT - 6, width: 6, height: 6, fill: st.guard === 'via' ? '#5fbf79' : '#9aa' })); if (st.guard === 'via') S.append(svg('rect', { x: gx + 1.5, y: yT, width: 3, height: y0 - yT, fill: '#5fbf79' })); }
        x += W * sc + st.g * W * sc;
      }
      if (st.broad !== 'none') S.append(svg('rect', { x: st.broad === 'par' ? 40 : 318, y: yT - 40, width: st.broad === 'par' ? 560 : 4, height: 6, fill: '#c98bd9' }), svg('text', { x: 320, y: yT - 46, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 10.5, text: st.broad === 'par' ? 'trace on the layer above, running along the victim' : 'trace on the layer above, crossing at 90° (end-on view)' }));
      bars.innerHTML = '';
      const mx = Math.max(...contrib.map(c => c[1]), 0.001);
      contrib.forEach(([n, k], i) => {
        const y = 10 + i * 22, w = k / mx * 330;
        bars.append(svg('text', { x: 10, y: y + 13, fill: 'var(--muted)', 'font-size': 11.5, text: n }), svg('rect', { x: 180, y, width: Math.max(w, 1), height: 16, rx: 3, fill: n.includes('above') ? '#c98bd9' : 'var(--accent)' }), svg('text', { x: 186 + w, y: y + 13, fill: 'var(--text)', 'font-size': 11.5, 'font-family': 'var(--mono)', text: sig(k * 100, 2) + ' %' }));
      });
      const mv = tot / 100 * 3300;
      M.set('tot', sig(tot, 3) + ' %', tot > 10 ? 'bad' : tot > 5 ? 'warn' : 'good');
      M.set('mv', sig(mv, 3) + ' mV', mv > 400 ? 'bad' : mv > 165 ? 'warn' : 'good');
      M.set('area', sig(5 * W + 4 * st.g * W, 2) + ' mm');
      const items = [];
      items.push({ level: tot > 10 ? 'bad' : tot > 5 ? 'warn' : 'good', html: `Worst case (all four neighbours switching together): <b>${sig(tot, 3)}%</b> of the aggressor swing, ${sig(mv, 3)} mV on a 3.3 V bus (noise margin ≈ 400 mV). ${st.g + 1 >= 3 ? 'The 3W rule keeps nearest-neighbour coupling small.' : 'Below 3W centre-to-centre the nearest neighbours dominate.'}` });
      if (st.guard === 'via') items.push({ level: 'good', html: 'A grounded guard with stitching vias soaks up much of the field between traces. It costs a whole track of space, though: compare with simply spreading the traces.' });
      if (st.guard === 'float') items.push({ level: 'bad', html: 'A floating (or one-end-grounded) guard is just another conductor that couples to both traces and can resonate. It can make things <b>worse</b>.' });
      if (st.broad === 'par') items.push({ level: 'bad', html: 'A parallel trace directly above with no plane between is the strongest coupling of all: broadside coupling across a thin dielectric. Route the adjacent layer orthogonally, or restack so a plane separates them.' });
      if (st.broad === 'orth') items.push({ level: 'good', html: 'Crossing at 90° limits the coupled length to the trace width, so broadside coupling becomes negligible (Sierra §2.3.3).' });
      V.set(items);
      E.set(`<p>Crosstalk falls as 1/(1+(D/H)²): with H = ${sig(st.h, 3)} mm, moving from 2W to 3W centre spacing roughly halves the nearest-neighbour term, and the second neighbours hardly matter.</p><p>Reducing H shrinks every term at once without costing any area, which is why stackups with thin dielectrics (lesson 2) make routing easier.</p>`);
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'You double the parallel length of two outer-layer traces that are already much longer than the saturation length. NEXT and FEXT…', opts: ['both double', 'NEXT stays the same; FEXT roughly doubles', 'both stay the same'], a: 1, ex: 'NEXT saturates once the coupled length exceeds half the edge length; FEXT accumulates with length (and with edge rate).' },
    { q: 'Why is far-end crosstalk small on inner (stripline) layers?', opts: ['The traces are thinner', 'The field is entirely in the dielectric, so capacitive and inductive coupling are equal and their FEXT contributions cancel', 'Inner layers have no crosstalk at all'], a: 1, ex: 'In a homogeneous dielectric Cm/C = Lm/L, so FEXT ∝ (Cm/C − Lm/L) ≈ 0. NEXT still exists.' },
    { q: 'A guard trace between two signals is connected to ground only at one end. Likely effect?', opts: ['Big improvement', 'Little or even negative: it must be stitched to ground along its length to act as a shield', 'It shorts the signals'], a: 1, ex: 'An unstitched guard couples to both traces and can resonate. Guards need stitching vias at short intervals.' },
  ]);
})();
