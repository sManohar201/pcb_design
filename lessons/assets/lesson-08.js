/* Lesson 8 — Differential pairs */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, geo, legend } = PCB;
  PCB.renderChrome({ lesson: 8 });
  const PS_PER_MM = 6.67; // inner layer, 150 mm/ns

  /* =================================================================
     8.1  Noise rejection and skew
     ================================================================= */
  (function labWhy() {
    const host = document.getElementById('lab-why'); if (!host) return;
    const L = lab(host, { title: 'A differential pair with common-mode noise and skew' });
    const st = { rate: 5, mm: 0, noise: 150 };
    const sR = seg({ label: 'Data rate', options: [1, 2.5, 5, 10].map(v => ({ v, label: v + ' Gb/s' })), value: st.rate, onChange: v => { st.rate = v; update(); } });
    const sM = slider({ label: 'Length mismatch P vs N', min: 0, max: 12, step: 0.1, value: st.mm, fmt: v => `${sig(v, 2)} mm (${sig(v * PS_PER_MM, 3)} ps)`, onInput: v => { st.mm = v; update(); } });
    const sN = slider({ label: 'Common-mode noise on both lines', min: 0, max: 300, step: 10, value: st.noise, fmt: v => v + ' mV', onInput: v => { st.noise = v; update(); } });
    L.controls.append(sR.el, sM.el, sN.el, el('div', { class: 'hint' }, 'Each line swings ±200 mV (400 mV differential). Edges take 30% of a bit time.'));
    const p1 = new Plot(L.stage, { title: 'What each trace carries (single-ended)', height: 170, xlabel: 'bit times (UI)', ylabel: 'mV', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const p2 = new Plot(L.stage, { title: 'What the receiver sees: P − N (differential) and (P+N)/2 (common mode)', height: 170, xlabel: 'bit times (UI)', ylabel: 'mV', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const p3 = new Plot(L.stage, { title: 'Eye diagram of P − N (120 bits overlaid)', height: 200, xmin: -0.5, xmax: 1.5, xlabel: 'UI', ylabel: 'mV', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'sk', label: 'Skew' }, { key: 'pui', label: 'of a bit time', bar: true }, { key: 'cm', label: 'CM spike from skew' }, { key: 'eye', label: 'Eye width' }, { key: 'rej', label: 'Noise left in P − N' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const BITS = []; { let r = 0x5a; for (let i = 0; i < 140; i++) { const b = ((r >> 6) ^ (r >> 5)) & 1; r = ((r << 1) | b) & 0x7f; BITS.push(b); } }
    function wave(t, UI, tr) { // t in UI units
      const i = Math.floor(t); if (i < 1) return BITS[0] ? 1 : -1;
      const cur = BITS[i % BITS.length] ? 1 : -1, prev = BITS[(i - 1) % BITS.length] ? 1 : -1;
      return prev + (cur - prev) * PCB.ramp(t - i, 0, tr);
    }
    function update() {
      const UI = 1 / st.rate; // ns
      const skUI = st.mm * PS_PER_MM / 1000 / UI;
      const tr = 0.3;
      const noise = t => st.noise / 1000 * (Math.sin(2 * Math.PI * 0.6 * t) * 0.8 + 0.2 * Math.sin(2 * Math.PI * 3.1 * t + 1));
      const P = t => 0.2 * wave(t, UI, tr) + noise(t), N = t => -0.2 * wave(t - skUI, UI, tr) + noise(t);
      const ts = [], pp = [], nn = [], dd = [], cc = [];
      for (let i = 0; i <= 600; i++) { const t = 10 + 8 * i / 600; ts.push(t - 10); pp.push(P(t) * 1e3); nn.push(N(t) * 1e3); dd.push((P(t) - N(t)) * 1e3); cc.push((P(t) + N(t)) / 2 * 1e3); }
      p1.draw({ series: [{ x: ts, y: pp, color: 'var(--bad)', width: 1.8, label: 'P' }, { x: ts, y: nn, color: 'var(--link)', width: 1.8, label: 'N' }], range: { ymin: -560, ymax: 560 } });
      p2.draw({ series: [{ x: ts, y: dd, color: 'var(--good)', width: 2.2, label: 'P − N' }, { x: ts, y: cc, color: 'var(--accent)', width: 1.6, label: 'common mode' }], range: { ymin: -560, ymax: 560 } });
      // eye
      const series = []; const ph = 80; const minAbs = new Array(ph + 1).fill(Infinity);
      let cmPk = 0;
      for (let b = 4; b < 124; b++) {
        const x = [], y = [];
        for (let k = 0; k <= ph; k++) {
          const u = -0.5 + 2 * k / ph, t = b + u + skUI / 2;
          const v = (P(t) - N(t)) * 1e3; x.push(u); y.push(v);
          if (u >= 0 && u <= 1) { const j = Math.round(u * ph); minAbs[j] = Math.min(minAbs[j], Math.abs(v)); }
          const cmSk = Math.abs(0.1 * (wave(t, UI, tr) - wave(t - skUI, UI, tr))) * 1e3; if (cmSk > cmPk) cmPk = cmSk;
        }
        series.push({ x, y, color: 'var(--good)', width: 1, alpha: 0.25 });
      }
      p3.draw({ series, range: { ymin: -480, ymax: 480 }, hlines: [{ y: 0, color: 'var(--faint)', dash: [2, 3] }] });
      const open = minAbs.filter((v, j) => j <= ph && isFinite(v) && v > 0.5 * 400 * 0.5).length / (ph + 1);
      const pct = skUI * 100;
      M.set('sk', sig(st.mm * PS_PER_MM, 3) + ' ps');
      M.set('pui', sig(pct, 2) + ' %', pct > 20 ? 'bad' : pct > 5 ? 'warn' : 'good', pct / 50);
      M.set('cm', sig(cmPk, 3) + ' mV', cmPk > 100 ? 'bad' : cmPk > 20 ? 'warn' : 'good');
      M.set('eye', sig(open * 100, 2) + ' % UI', open < 0.25 ? 'bad' : open < 0.4 ? 'warn' : 'good');
      M.set('rej', '0 mV', 'good');
      const items = [];
      items.push({ level: 'good', html: `The ${st.noise} mV of noise is identical on P and N, so it <b>cancels completely</b> in P − N (green). That is the core benefit of differential signalling.` });
      if (st.mm > 0) items.push({ level: pct > 20 ? 'bad' : pct > 5 ? 'warn' : 'info', html: `${sig(st.mm, 2)} mm of mismatch = ${sig(st.mm * PS_PER_MM, 3)} ps = ${sig(pct, 2)}% of a bit at ${st.rate} Gb/s. During every transition P and N briefly point the same way: a <b>${sig(cmPk, 3)} mV common-mode spike</b> that radiates and that the receiver must tolerate.` });
      if (pct > 15) items.push({ level: 'bad', html: 'The differential edges have developed a shoulder (see the eye): the effective rise time is now set by the skew, and the eye is closing.' });
      if (st.mm === 0) items.push({ level: 'info', html: 'Drag the mismatch slider: the same millimetres matter 10× more at 10 Gb/s than at 1 Gb/s.' });
      V.set(items);
      E.set(`<p>Differential signal = P − N, common-mode = (P + N)/2. Noise from outside mostly arrives as common mode, so the receiver ignores it. Skew turns some of the <i>wanted</i> signal into common mode ("mode conversion"), and that is what leaks out as EMI.</p><p>At ${st.rate} Gb/s a bit lasts ${sig(UI * 1000, 3)} ps, so each mm of mismatch costs ${sig(PS_PER_MM / (UI * 10), 2)}% of a bit.</p>`);
    }
    update();
  })();

  /* =================================================================
     8.2  Route a pair: running skew
     ================================================================= */
  (function labRoute() {
    const host = document.getElementById('lab-route'); if (!host) return;
    const L = lab(host, { title: 'TX → RX: track the P/N mismatch along the route' });
    const st = { b1: 'left', b2: 'same', brk: 'asym', via: 'sym', caps: 'sym', comp: 'end', p: 0.25 };
    const sB1 = seg({ label: 'First 90° bend turns', options: [{ v: 'left', label: 'left' }, { v: 'right', label: 'right' }], value: st.b1, onChange: v => { st.b1 = v; update(); } });
    const sB2 = seg({ label: 'Second bend turns', options: [{ v: 'same', label: 'same way' }, { v: 'opp', label: 'opposite way' }], value: st.b2, onChange: v => { st.b2 = v; update(); } });
    const sBk = seg({ label: 'Breakout at TX', options: [{ v: 'sym', label: 'symmetric' }, { v: 'asym', label: 'asymmetric (+0.6 mm)' }], value: st.brk, onChange: v => { st.brk = v; update(); } });
    const sV = seg({ label: 'Via pair', options: [{ v: 'sym', label: 'side by side' }, { v: 'stag', label: 'staggered' }], value: st.via, onChange: v => { st.via = v; update(); } });
    const sC = seg({ label: 'AC coupling caps', options: [{ v: 'sym', label: 'aligned' }, { v: 'asym', label: 'offset' }], value: st.caps, onChange: v => { st.caps = v; update(); } });
    const sComp = seg({ label: 'Length compensation', options: [{ v: 'none', label: 'none' }, { v: 'end', label: 'one tune at RX' }, { v: 'seg', label: 'per segment' }, { v: 'near', label: 'at each mismatch' }], value: st.comp, onChange: v => { st.comp = v; update(); } });
    const sP = slider({ label: 'Pair pitch (W + S)', min: 0.15, max: 0.6, step: 0.01, value: st.p, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.p = v; update(); } });
    L.controls.append(sB1.el, sB2.el, sBk.el, sV.el, sC.el, sComp.el, sP.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 270' });
    L.stage.append(S, legend([['var(--bad)', 'P'], ['var(--link)', 'N'], ['#ffd166', 'serpentine (added length)']]));
    const plot = new Plot(L.stage, { title: 'Running mismatch (P − N) along the route', height: 210, xmin: 0, xmax: 130, xlabel: 'distance from TX [mm]', ylabel: 'mm', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'tot', label: 'Total mismatch (what DRC sees)' }, { key: 's1', label: 'Segment TX → via' }, { key: 's2', label: 'Segment via → RX' }, { key: 'async', label: 'Distance out of step' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    function events() {
      const bend = 1.657 * st.p; // two 45° miters per 90° turn
      const s1 = st.b1 === 'left' ? -1 : 1;
      const s2 = st.b2 === 'same' ? s1 : -s1;
      const ev = [
        { x: 4, d: st.brk === 'asym' ? 0.6 : 0, t: 'breakout' },
        { x: 30, d: s1 * bend, t: 'bend 1' },
        { x: 60, d: st.via === 'stag' ? 0.25 : 0, t: 'vias', via: true },
        { x: 90, d: s2 * bend, t: 'bend 2' },
        { x: 110, d: st.caps === 'asym' ? -0.4 : 0, t: 'AC caps' },
      ];
      const comp = [];
      if (st.comp === 'end') { const tot = ev.reduce((s, e) => s + e.d, 0); if (Math.abs(tot) > 1e-6) comp.push({ x: 124, d: -tot }); }
      if (st.comp === 'near') ev.forEach(e => { if (Math.abs(e.d) > 1e-6) comp.push({ x: e.x + 4, d: -e.d }); });
      if (st.comp === 'seg') {
        const a = ev.filter(e => e.x <= 60).reduce((s, e) => s + e.d, 0), b = ev.filter(e => e.x > 60).reduce((s, e) => s + e.d, 0);
        if (Math.abs(a) > 1e-6) comp.push({ x: 55, d: -a }); if (Math.abs(b) > 1e-6) comp.push({ x: 124, d: -b });
      }
      return { ev, comp };
    }
    // geometry for drawing
    function centerline() {
      const k = 3.0, start = { x: 230, y: st.b1 === 'left' ? 248 : 26 };
      const turn = (d, lr) => (lr === 'left' ? [d[1], -d[0]] : [-d[1], d[0]]);
      const d1 = turn([1, 0], st.b1), d2 = turn(d1, st.b2 === 'same' ? st.b1 : (st.b1 === 'left' ? 'right' : 'left'));
      const p0 = start, p1 = { x: p0.x + 30 * k, y: p0.y }, p2 = { x: p1.x + d1[0] * 60 * k, y: p1.y + d1[1] * 60 * k }, p3 = { x: p2.x + d2[0] * 40 * k, y: p2.y + d2[1] * 40 * k };
      return [p0, p1, p2, p3];
    }
    function offset(pts, d) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(pts.length - 1, i + 1)];
        const n1 = i > 0 ? norm(a, b) : norm(b, c), n2 = i < pts.length - 1 ? norm(b, c) : norm(a, b);
        let nx = n1.x + n2.x, ny = n1.y + n2.y; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
        const cos = nx * n1.x + ny * n1.y || 1;
        out.push({ x: b.x + nx * d / cos, y: b.y + ny * d / cos });
      }
      return out;
    }
    function norm(a, b) { const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1; return { x: dy / m, y: -dx / m }; } // left normal
    function update() {
      const { ev, comp } = events();
      // running mismatch
      const xs = [], ys = [];
      let asyncLen = 0, maxAbs = 0;
      const all = ev.concat(comp).sort((a, b) => a.x - b.x);
      for (let x = 0; x <= 130; x += 0.25) {
        let s = 0; for (const e of all) if (e.x <= x) s += e.d;
        xs.push(x); ys.push(s);
        if (Math.abs(s) > 0.1) asyncLen += 0.25; maxAbs = Math.max(maxAbs, Math.abs(s));
      }
      const at = x => all.filter(e => e.x <= x).reduce((s, e) => s + e.d, 0);
      const tot = at(130), s1 = at(59.9), s2 = tot - at(60);
      plot.draw({ series: [{ x: xs, y: ys, color: 'var(--accent)', width: 2.4 }], bands: [{ y0: -0.1, y1: 0.1, color: 'var(--good)', alpha: 0.15 }], vlines: [{ x: 60, color: 'var(--faint)', label: 'via' }], range: { ymin: Math.min(-1, ...ys) * 1.15, ymax: Math.max(1, ...ys) * 1.15 } });
      M.set('tot', `${sig(tot, 2)} mm (${sig(tot * PS_PER_MM, 2)} ps)`, Math.abs(tot) > 0.1 ? 'bad' : 'good');
      M.set('s1', sig(s1, 2) + ' mm', Math.abs(s1) > 0.1 ? 'warn' : 'good');
      M.set('s2', sig(s2, 2) + ' mm', Math.abs(s2) > 0.1 ? 'warn' : 'good');
      M.set('async', sig(asyncLen, 3) + ' mm', asyncLen > 15 ? 'bad' : asyncLen > 5 ? 'warn' : 'good');
      // drawing
      S.innerHTML = '';
      const C = centerline();
      const P = offset(C, 6), N = offset(C, -6);
      const segLens = [30, 60, 40], at2 = (pts, s) => { let acc = 0; for (let i = 0; i < 3; i++) { if (s <= acc + segLens[i] || i === 2) { const u = (s - acc) / segLens[i]; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * u, y: pts[i].y + (pts[i + 1].y - pts[i].y) * u, i }; } acc += segLens[i]; } };
      S.append(svg('path', { d: geo.pathD(P), fill: 'none', stroke: 'var(--bad)', 'stroke-width': 3, 'stroke-linejoin': 'miter' }), svg('path', { d: geo.pathD(N), fill: 'none', stroke: 'var(--link)', 'stroke-width': 3, 'stroke-linejoin': 'miter' }));
      const box = (p, t) => S.append(svg('rect', { x: p.x - 22, y: p.y - 18, width: 44, height: 36, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, 'font-weight': 650, text: t }));
      box({ x: C[0].x - 22, y: C[0].y }, 'TX'); box({ x: C[3].x + (C[3].x > C[2].x ? 22 : -22), y: C[3].y + (Math.abs(C[3].x - C[2].x) < 1 ? 22 : 0) }, 'RX');
      // vias
      const vp = at2(C, 60), dv = norm(C[1], C[2]), dirv = { x: -dv.y, y: dv.x };
      const st0 = st.via === 'stag' ? 5 : 0;
      S.append(svg('circle', { cx: vp.x + dv.x * 6, cy: vp.y + dv.y * 6, r: 5.5, fill: '#1a1a1a', stroke: '#e0a64a', 'stroke-width': 2 }), svg('circle', { cx: vp.x - dv.x * 6 + dirv.x * st0, cy: vp.y - dv.y * 6 + dirv.y * st0, r: 5.5, fill: '#1a1a1a', stroke: '#e0a64a', 'stroke-width': 2 }));
      // caps
      const cp = at2(C, 110), dc = norm(C[2], C[3]), dirc = { x: -dc.y, y: dc.x }, co = st.caps === 'asym' ? 7 : 0;
      for (const [sgn, o] of [[1, 0], [-1, co]]) S.append(svg('rect', { x: cp.x + dc.x * 6 * sgn + dirc.x * o - 5, y: cp.y + dc.y * 6 * sgn + dirc.y * o - 3, width: 10, height: 6, fill: '#b9a37a', stroke: '#3b2f1a' }));
      // event labels
      ev.filter(e => Math.abs(e.d) > 1e-6).forEach((e, j) => {
        const q = at2(C, e.x), n = norm(C[q.i], C[q.i + 1]);
        const mx = q.x - n.x * 20, my = q.y - n.y * 20;
        S.append(svg('circle', { cx: mx, cy: my, r: 8, fill: '#ffb3ba' }), svg('text', { x: mx, y: my + 4, 'text-anchor': 'middle', fill: '#3a1714', 'font-size': 10.5, 'font-weight': 700, text: String(j + 1) }));
        S.append(svg('text', { x: 14, y: 22 + j * 16, fill: '#ffb3ba', 'font-size': 11, text: `${j + 1}  ${e.t}: ${e.d > 0 ? '+' : ''}${sig(e.d, 2)} mm (P − N)` }));
      });
      comp.forEach((c, j) => S.append(svg('text', { x: 626, y: 22 + j * 16, 'text-anchor': 'end', fill: '#ffd166', 'font-size': 11, text: `serpentine: ${c.d > 0 ? '+' : ''}${sig(c.d, 2)} mm` })));
      for (const c of comp) {
        const q = at2(C, c.x), n = norm(C[q.i], C[q.i + 1]), side = c.d > 0 ? 1 : -1; // + adds to P (left side)
        const dir = { x: -n.y, y: n.x };
        let d = '';
        for (let k = 0; k < 4; k++) { const b = { x: q.x + n.x * 6 * side + dir.x * (k * 5 - 10), y: q.y + n.y * 6 * side + dir.y * (k * 5 - 10) }; const tip = { x: b.x + n.x * 8 * side, y: b.y + n.y * 8 * side }; d += `${k ? 'L' : 'M'} ${b.x} ${b.y} L ${tip.x} ${tip.y} L ${tip.x + dir.x * 5} ${tip.y + dir.y * 5} L ${b.x + dir.x * 5} ${b.y + dir.y * 5} `; }
        S.append(svg('path', { d, fill: 'none', stroke: '#ffd166', 'stroke-width': 2 }));
      }
      const items = [];
      items.push({ level: Math.abs(tot) > 0.1 ? 'bad' : 'good', html: `Total mismatch ${sig(tot, 2)} mm (${sig(tot * PS_PER_MM, 2)} ps). ${Math.abs(tot) > 0.1 ? 'Out of spec for a fast link.' : 'This is all a length-matching DRC checks, and it passes.'}` });
      if (asyncLen > 5) items.push({ level: asyncLen > 15 ? 'bad' : 'warn', html: `But P and N run out of step for <b>${sig(asyncLen, 3)} mm</b>. Sierra §7.3.1.6: signals should not travel asynchronously for more than ~15 mm. Along that stretch the pair carries common-mode current and radiates.` });
      if (Math.abs(s1) > 0.1 || Math.abs(s2) > 0.1) items.push({ level: 'warn', html: `Each segment between vias should be matched on its own (TX→via ${sig(s1, 2)} mm, via→RX ${sig(s2, 2)} mm). Errors in different segments can cancel in the total while each one hurts on its own (Sierra §3.5.4).` });
      if (st.b2 === 'opp' && st.brk === 'sym' && st.caps === 'sym' && st.via === 'sym') items.push({ level: 'good', html: 'Opposite bends cancel each other. Sierra: two bends closer than ~15 mm need no extra compensation.' });
      if (st.comp === 'near' && asyncLen <= 5) items.push({ level: 'good', html: 'Compensating right next to each source of mismatch keeps the pair in step along the whole route.' });
      V.set(items);
      E.set(`<p>A 90° turn built from two 45° miters makes the inner trace shorter by ≈1.66 × pitch = <b>${sig(1.657 * st.p, 2)} mm</b> (${sig(1.657 * st.p * PS_PER_MM, 2)} ps). Tighter pairs (smaller pitch) generate less mismatch per bend.</p><p>The plot is what matters physically: the time the pair spends with P and N out of step. A single big serpentine at the receiver fixes the total but leaves the whole route out of step.</p>`);
    }
    update();
  })();

  /* =================================================================
     8.3  Coupling and pair-to-pair spacing
     ================================================================= */
  (function labCpl() {
    const host = document.getElementById('lab-cpl'); if (!host) return;
    const L = lab(host, { title: 'Coupling inside a pair and to the next pair' });
    const st = { w: 0.1, s: 0.15, h: 0.1, g: 3 };
    const sW = slider({ label: 'Trace width W', min: 0.075, max: 0.25, step: 0.005, value: st.w, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.w = v; update(); } });
    const sS = slider({ label: 'Gap inside the pair S', min: 0.075, max: 0.6, step: 0.005, value: st.s, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.s = v; update(); } });
    const sH = slider({ label: 'Height to plane H', min: 0.06, max: 0.3, step: 0.005, value: st.h, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.h = v; update(); } });
    const sG = slider({ label: 'Gap to the next pair (× W)', min: 1, max: 10, step: 0.5, value: st.g, fmt: v => v + ' W', onInput: v => { st.g = v; update(); } });
    L.controls.append(sW.el, sS.el, sH.el, sG.el);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 150', style: 'background:var(--surface-2)' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Differential impedance vs gap S (microstrip)', height: 200, xmin: 0.075, xmax: 0.6, xlabel: 'S [mm]', ylabel: 'Ω', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'zd', label: 'Z diff' }, { key: 'k', label: 'P–N coupling' }, { key: 'x', label: 'Pair-to-pair coupling' }, { key: 'gap', label: 'Gap to next pair' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const m = phys.diffMicrostrip(st.w, st.s, st.h);
      const ss = [], zz = []; for (let i = 0; i <= 80; i++) { const s = 0.075 + 0.525 * i / 80; ss.push(s); zz.push(phys.diffMicrostrip(st.w, s, st.h).zdiff); }
      plot.draw({ series: [{ x: ss, y: zz, color: 'var(--accent)', width: 2.4 }], bands: [{ y0: 81, y1: 99, color: 'var(--good)', alpha: 0.12 }, { y0: 90, y1: 110, color: 'var(--link)', alpha: 0.08 }], markers: [{ x: st.s, y: m.zdiff, color: 'var(--bad)', r: 5, label: sig(m.zdiff, 3) + ' Ω' }], hlines: [{ y: 90, color: 'var(--good)', label: '90 Ω (USB)', dash: [3, 3] }, { y: 100, color: 'var(--link)', label: '100 Ω', dash: [3, 3] }] });
      const pitch = st.w + st.s, k = 1 / (1 + (pitch / st.h) ** 2);
      const gap = st.g * st.w;
      // aggressor pair (P1,N1) to victim pair (P2,N2): differential pickup ∝ |k(P1→P2) − k(N1→P2) − k(P1→N2) + k(N1→N2)|/2
      const kk = d => 1 / (1 + (d / st.h) ** 2);
      const d0 = gap + st.w; // centre spacing N1 → P2
      const xt = Math.abs(kk(d0) - kk(d0 + pitch) - kk(d0 + pitch) + kk(d0 + 2 * pitch)) / 2 + 0.15 * kk(d0);
      M.set('zd', sig(m.zdiff, 3) + ' Ω');
      M.set('k', sig(k * 100, 2) + ' %');
      M.set('x', sig(xt * 100, 2) + ' %', xt > 0.03 ? 'bad' : xt > 0.01 ? 'warn' : 'good');
      M.set('gap', sig(gap, 2) + ' mm', st.g < 3 ? 'bad' : st.g < 5 ? 'warn' : 'good');
      S.innerHTML = '';
      const sc = 260 / (4 * st.w + 2 * st.s + gap + 0.4);
      const y0 = 110, yT = y0 - st.h * sc;
      S.append(svg('rect', { x: 10, y: yT - 10, width: 620, height: y0 - yT + 10, fill: '#cfe3c9' }), svg('rect', { x: 10, y: y0, width: 620, height: 7, fill: '#5fbf79' }));
      let x = 320 - (4 * st.w + 2 * st.s + gap) * sc / 2;
      const draw = (c, t) => { S.append(svg('rect', { x, y: yT - 6, width: st.w * sc, height: 6, fill: c }), svg('text', { x: x + st.w * sc / 2, y: yT - 12, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 10.5, text: t })); x += st.w * sc; };
      draw('#e0a64a', 'P1'); x += st.s * sc; draw('#e0a64a', 'N1'); x += gap * sc; draw('#b9b2f0', 'P2'); x += st.s * sc; draw('#b9b2f0', 'N2');
      S.append(svg('text', { x: 320, y: 140, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11, text: `pair 1 (aggressor) · gap ${sig(gap, 2)} mm · pair 2 (victim)` }));
      const items = [];
      items.push({ level: m.zdiff > 81 && m.zdiff < 110 ? 'good' : 'warn', html: `Z<sub>diff</sub> = <b>${sig(m.zdiff, 3)} Ω</b>. Gap S changes it only slowly once S > 2H. Tight coupling (S ≈ W) makes it ${sig(phys.diffMicrostrip(st.w, st.w, st.h).zdiff, 3)} Ω.` });
      items.push({ level: xt > 0.03 ? 'bad' : xt > 0.01 ? 'warn' : 'good', html: `Pair-to-pair coupling ≈ ${sig(xt * 100, 2)}% with a ${st.g}W gap. ${st.g < 5 ? 'Sierra §3.5.3 recommends at least 5× the trace width between pairs.' : 'Meets Sierra\'s 5W guideline.'}` });
      V.set(items);
      E.set('<p>Inside a pair, coupling sets the impedance and how much the two traces share their fields. Between pairs, coupling is crosstalk. A differential victim cancels some of it (both its traces hear the aggressor almost equally), but not all, especially at close range where P2 is much nearer than N2.</p><p>Height H sets the reach of every field (lesson 3.3), so a thin dielectric lets you pack pairs closer.</p>');
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'A pair is matched to 0.02 mm in total, but one bend near the TX left P 0.4 mm short and a serpentine fixes it right before the RX. Problem?', opts: ['No, the total matches', 'Yes: the pair runs out of step for most of its length, converting signal to common mode (EMI) along the way', 'Only if there are vias'], a: 1, ex: 'Sierra §3.5.4 / §7.3.1.6: compensate close to the source of the mismatch, and within each segment.' },
    { q: 'Common-mode noise of 200 mV appears equally on P and N. What does an ideal differential receiver see?', opts: ['200 mV', '400 mV', 'Nothing: it cancels in P − N'], a: 2, ex: 'That is the main benefit of differential signalling, and why matching (symmetry) matters so much.' },
    { q: 'Where should a via be placed relative to a differential pair?', opts: ['Between P and N to save space', 'Never between them; any vias in the pair should be a symmetric pair, ideally with ground return vias beside them', 'Anywhere'], a: 1, ex: 'Sierra §3.5.3 / §7.3.1.5: no components or vias between the two traces; use symmetric via pairs with return vias.' },
  ]);
})();
