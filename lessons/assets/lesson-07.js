/* Lesson 7 — Transmission lines & reflections */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;
  PCB.renderChrome({ lesson: 7 });
  const VEL = 150; // mm/ns (inner layer)
  const ns = mm => mm / VEL * 1e-9;

  function analyse(t, y, vcc, vih) {
    const n = y.length, fin = y[n - 1];
    let mx = -Infinity, cross = -1, ring = Infinity, settle = 0;
    for (let i = 0; i < n; i++) { if (y[i] > mx) mx = y[i]; if (cross < 0 && y[i] >= vih) cross = i; }
    if (cross >= 0) for (let i = cross; i < n; i++) ring = Math.min(ring, y[i]);
    for (let i = 0; i < n; i++) if (Math.abs(y[i] - fin) > 0.05 * Math.max(fin, 0.1)) settle = t[i];
    return { fin, over: mx - Math.max(fin, 0), ring, crossT: cross >= 0 ? t[cross] : null, settle };
  }

  /* =================================================================
     7.1  Launch an edge
     ================================================================= */
  (function labLaunch() {
    const host = document.getElementById('lab-launch'); if (!host) return;
    const L = lab(host, { title: 'A 3.3 V edge on a transmission line' });
    const st = { z0: 50, len: 150, rs: 18, term: 'none', cl: 3, tr: 0.3 };
    const sZ = slider({ label: 'Line impedance Z0', min: 30, max: 110, step: 1, value: st.z0, fmt: v => v + ' Ω', onInput: v => { st.z0 = v; update(); } });
    const sL = slider({ label: 'Line length', min: 10, max: 300, step: 5, value: st.len, fmt: v => v + ' mm', onInput: v => { st.len = v; update(); } });
    const sR = slider({ label: 'Driver output resistance', min: 5, max: 60, step: 1, value: st.rs, fmt: v => v + ' Ω', onInput: v => { st.rs = v; update(); } });
    const sT = seg({ label: 'Termination', options: [{ v: 'none', label: 'none' }, { v: 'series', label: 'series @ driver' }, { v: 'par', label: 'parallel @ load' }, { v: 'thev', label: 'Thevenin @ load' }], value: st.term, onChange: v => { st.term = v; update(); } });
    const sC = slider({ label: 'Receiver input capacitance', min: 0, max: 10, step: 0.5, value: st.cl, fmt: v => v + ' pF', onInput: v => { st.cl = v; update(); } });
    const sE = slider({ label: 'Edge rise time', min: 0.05, max: 3, log: true, value: st.tr, fmt: v => fmtSI(v * 1e-9, 's'), onInput: v => { st.tr = v; update(); } });
    L.controls.append(sZ.el, sL.el, sR.el, sT.el, sC.el, sE.el);
    const wrap = el('div', { class: 'plot-wrap' });
    const cv = el('canvas', { class: 'viz board', style: { height: '170px' } });
    wrap.append(cv);
    L.stage.append(wrap, el('div', { class: 'stage-hint' }, 'Animation: voltage along the line over time (slowed down). Driver on the left, receiver on the right.'));
    const plot = new Plot(L.stage, { title: 'Voltage at the driver (near end) and the receiver (far end)', height: 230, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'rs', label: 'ρ at driver' }, { key: 'rl', label: 'ρ at load' }, { key: 'ov', label: 'Overshoot' }, { key: 'rb', label: 'Lowest after crossing' }, { key: 'set', label: 'Settled after' }, { key: 'p', label: 'Termination power' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Lossless line simulated as an LC ladder (150 mm/ns). Ideal CMOS driver = 3.3 V step behind its output resistance. Thresholds: VIH 2.0 V, VIL 0.8 V.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    let snaps = [], Tsim = 1, lenNow = 150;
    function update() {
      const Td = ns(st.len), N = 120, tau = Td / N;
      const net = new PCB.TLine(tau);
      const end = net.line(0, st.z0, Td, 0, st.len);
      net.C[end] += st.cl * 1e-12;
      let Rs = st.rs;
      if (st.term === 'series') Rs = Math.max(st.rs, st.z0);
      if (st.term === 'par') net.G[end] = 1 / st.z0;
      if (st.term === 'thev') { net.G[end] = 1 / st.z0; net.J[end] = 1.65 / st.z0; }
      const T = Math.max(14 * Td, 4e-9) + 3 * st.tr * 1e-9;
      const nodes = []; for (let i = 0; i <= end; i++) nodes.push(i);
      const r = PCB.simNet(net, { src: 0, Rs, vs: t => 3.3 * PCB.ramp(t, 0.2e-9, st.tr * 1e-9), T, nOut: 700, probes: [0, end], snapshots: 220, snapNodes: nodes });
      snaps = r.snaps; Tsim = T; lenNow = st.len;
      const t = Array.from(r.t, v => v * 1e9);
      plot.draw({
        series: [{ x: t, y: Array.from(r.out[0]), color: 'var(--link)', width: 1.8, label: 'driver (near end)' }, { x: t, y: Array.from(r.out[1]), color: 'var(--bad)', width: 2.4, label: 'receiver (far end)' }],
        bands: [{ y0: 0.8, y1: 2.0, color: 'var(--warn)', alpha: 0.1 }],
        hlines: [{ y: 2.0, color: 'var(--warn)', label: 'VIH 2.0 V', dash: [3, 3] }, { y: 0.8, color: 'var(--warn)', label: 'VIL 0.8 V', dash: [3, 3] }, { y: 3.3, color: 'var(--faint)', dash: [2, 4] }],
        range: { ymin: -1.5, ymax: 6.8 },
      });
      const a = analyse(t, Array.from(r.out[1]), 3.3, 2.0);
      const rhoS = (Rs - st.z0) / (Rs + st.z0);
      const zl = st.term === 'par' || st.term === 'thev' ? st.z0 : Infinity;
      const rhoL = zl === Infinity ? 1 : 0;
      const P = st.term === 'par' ? 3.3 * 3.3 / st.z0 / 2 : st.term === 'thev' ? 1.65 * 1.65 / st.z0 : 0;
      M.set('rs', sig(rhoS, 2), Math.abs(rhoS) < 0.1 ? 'good' : 'warn');
      M.set('rl', st.cl && rhoL === 0 ? '≈0 (+C)' : sig(rhoL, 2), rhoL ? 'warn' : 'good');
      M.set('ov', '+' + sig(a.over, 2) + ' V', a.over > 0.8 ? 'bad' : a.over > 0.3 ? 'warn' : 'good');
      M.set('rb', sig(a.ring, 3) + ' V', a.ring < 2.0 ? 'bad' : a.ring < 2.4 ? 'warn' : 'good');
      M.set('set', sig(a.settle, 3) + ' ns');
      M.set('p', fmtSI(P, 'W'), P > 0.08 ? 'warn' : null);
      const items = [];
      const lumped = st.len < st.tr * VEL / 6;
      if (lumped) items.push({ level: 'good', html: `The line is short compared with the edge (${st.len} mm vs ${sig(st.tr * VEL, 3)} mm edge length), so reflections finish inside the rise time and the result looks clean (lesson 1.4).` });
      if (a.over > 0.3) items.push({ level: a.over > 0.8 ? 'bad' : 'warn', html: `Overshoot to <b>${sig(a.over + a.fin, 3)} V</b>. The open receiver doubles the incoming wave, and the low-impedance driver (ρ = ${sig(rhoS, 2)}) re-reflects it. Overshoot stresses input protection diodes and radiates.` });
      if (a.ring < 2.0) items.push({ level: 'bad', html: `After crossing VIH the signal rings back down to ${sig(a.ring, 3)} V, <b>below the threshold</b>. A clock input would see a second edge (double-clocking).` });
      if (st.term === 'series') items.push({ level: 'good', html: `Series termination: the driver launches half the swing, the open end doubles it to the full 3.3 V, and the reflection is absorbed at the driver. Clean at the far end. Note the half-voltage "step" at the driver for 2×${sig(st.len / VEL, 2)} ns: never put another receiver in the middle of a series-terminated line.` });
      if (st.term === 'par') items.push({ level: a.fin < 2.4 ? 'warn' : 'info', html: `Parallel termination stops the reflection, but the driver and terminator form a divider: the high level is only ${sig(a.fin, 3)} V, and it burns ≈${fmtSI(P, 'W')} continuously.` });
      if (st.term === 'thev') items.push({ level: 'info', html: `Thevenin (or VTT) termination to mid-rail: no reflection and symmetrical swing, at a constant ${fmtSI(P, 'W')}. This is what DDR uses (VTT).` });
      if (st.cl >= 5 && st.term !== 'none') items.push({ level: 'info', html: `${st.cl} pF of receiver capacitance is itself a small discontinuity: it slows the edge and causes a small dip in the reflection.` });
      V.set(items);
      E.set(`<p>Launch: 3.3 V × Z0/(Rs+Z0) = <b>${sig(3.3 * st.z0 / (Rs + st.z0), 3)} V</b> enters the line. It takes ${sig(st.len / VEL, 3)} ns to reach the end, where it reflects with ρ<sub>L</sub> = ${sig(rhoL, 2)}, then reflects again at the driver with ρ<sub>S</sub> = ${sig(rhoS, 2)}.</p><p>Each round trip multiplies the bounce by ρ<sub>S</sub>·ρ<sub>L</sub>. Termination makes one of those zero, which ends it after one trip.</p>`);
    }
    let t0 = performance.now();
    PCB.whenVisible(cv, ts => {
      if (!snaps.length) return;
      const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = 170;
      if (!W) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = H * dpr; }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = PCB.cssVar('--board'); g.fillRect(0, 0, W, H);
      const cyc = 4200, ph = ((ts - t0) % (cyc + 700)) / cyc, fi = Math.min(snaps.length - 1, Math.floor(clamp(ph, 0, 1) * (snaps.length - 1)));
      const s = snaps[fi], n = s.v.length, x0 = 50, x1 = W - 50, yb = 140, sc = 18;
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
      for (const v of [0.8, 2.0, 3.3]) { g.beginPath(); g.moveTo(x0, yb - v * sc); g.lineTo(x1, yb - v * sc); g.stroke(); }
      g.fillStyle = PCB.cssVar('--copper'); g.fillRect(x0, yb, x1 - x0, 4);
      g.beginPath();
      for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / (n - 1), y = yb - s.v[i] * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = '#5cb8ff'; g.lineWidth = 2.5; g.stroke();
      g.lineTo(x1, yb); g.lineTo(x0, yb); g.closePath(); g.fillStyle = 'rgba(92,184,255,.18)'; g.fill();
      g.font = '11px ' + PCB.cssVar('--sans'); g.fillStyle = '#cfe0d5';
      g.textAlign = 'left'; g.fillText(`t = ${sig(s.t * 1e9, 3)} ns`, 10, 18); g.fillText('driver', 6, yb + 18);
      g.textAlign = 'right'; g.fillText('receiver', W - 6, yb + 18); g.fillText(`${lenNow} mm`, W - 10, 18);
      g.fillText('3.3 V', x0 - 4, yb - 3.3 * sc + 4);
    });
    update();
  })();

  /* =================================================================
     7.2  TDR of a route with features
     ================================================================= */
  (function labTDR() {
    const host = document.getElementById('lab-tdr'); if (!host) return;
    const L = lab(host, { title: 'TDR of a 150 mm, 50 Ω route' });
    const FEAT = [
      { k: 'pads', x: 25, t: 'Wide 0402 AC-cap pads (1 mm of ≈35 Ω)' },
      { k: 'via', x: 45, t: 'Signal via (pad C + barrel L)' },
      { k: 'neck', x: 62, t: 'Necked down 5 mm between pads (≈68 Ω)' },
      { k: 'stub', x: 82, t: 'Stub to a test point / pull-up' },
      { k: 'corner', x: 100, t: '4 × 90° corners' },
      { k: 'conn', x: 122, t: 'Connector (6 mm of ≈72 Ω)' },
    ];
    const st = { on: { pads: true, via: true, neck: false, stub: true, corner: false, conn: false }, viaC: 0.5, stub: 10, tr: 50 };
    const checks = FEAT.map(f => check({ label: f.t, checked: st.on[f.k], onChange: v => { st.on[f.k] = v; update(); } }));
    const sVC = slider({ label: 'Via pad capacitance', min: 0.1, max: 1.2, step: 0.05, value: st.viaC, fmt: v => v + ' pF', onInput: v => { st.viaC = v; update(); } });
    const sSL = slider({ label: 'Stub length', min: 1, max: 30, step: 1, value: st.stub, fmt: v => v + ' mm', onInput: v => { st.stub = v; update(); } });
    const sTr = seg({ label: 'TDR / signal edge (rise time)', options: [{ v: 20, label: '20 ps' }, { v: 50, label: '50 ps' }, { v: 200, label: '200 ps' }, { v: 1000, label: '1 ns' }], value: st.tr, onChange: v => { st.tr = v; update(); } });
    L.controls.append(...checks.map(c => c.el), sVC.el, sSL.el, sTr.el);
    const pZ = new Plot(L.stage, { title: 'Impedance profile seen by the edge (TDR)', height: 230, xmin: 0, xmax: 160, xlabel: 'distance along the route [mm]', ylabel: 'Ω', xfmt: v => sig(v, 3), yfmt: v => sig(v, 3) });
    const pR = new Plot(L.stage, { title: 'Edge arriving at the receiver', height: 190, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'min', label: 'Lowest Z' }, { key: 'max', label: 'Highest Z' }, { key: 'rx', label: 'Received rise (10–90%)' }, { key: 'ideal', label: 'Ideal line' }]);
    const V = verdicts(L.left, 'Feature by feature');
    const E = explain(L.right, 'Why');
    const cache = {};
    function build(feat) {
      const tau = ns(0.25);
      const net = new PCB.TLine(tau);
      let cur = 0, x = 0;
      const seg = (z, len) => { cur = net.line(cur, z, ns(len), x, len); x += len; };
      const items = FEAT.filter(f => feat[f.k]).sort((a, b) => a.x - b.x);
      for (const f of items) {
        seg(50, f.x - x);
        if (f.k === 'pads') seg(35, 1);
        if (f.k === 'via') { net.C[cur] += st.viaC * 1e-12; seg(90, 0.5); }
        if (f.k === 'neck') seg(68, 5);
        if (f.k === 'stub') net.line(cur, 50, ns(st.stub), x, 0);
        if (f.k === 'corner') { const cc = phys.microstrip(0.15, 0.1).Cp * 0.075e-12; for (let i = 0; i < 4; i++) { net.C[cur] += cc; seg(50, 4); } }
        if (f.k === 'conn') seg(72, 6);
      }
      seg(50, 150 - x);
      net.G[cur] = 1 / 50;
      return { net, end: cur };
    }
    function run(feat) {
      const { net, end } = build(feat);
      const tr = st.tr * 1e-12, t0 = 0.05e-9;
      const T = 2 * ns(150 + (feat.stub ? 0 : 0)) + t0 + 4 * tr + 0.2e-9;
      const r = PCB.simNet(net, { src: 0, Rs: 50, vs: t => PCB.ramp(t, t0, tr), T, nOut: 900, probes: [0, end] });
      return { r, t0, tr };
    }
    function rise(t, y) {
      const fin = y[y.length - 1]; let a = null, b = null;
      for (let i = 0; i < y.length; i++) { if (a == null && y[i] >= 0.1 * fin) a = t[i]; if (b == null && y[i] >= 0.9 * fin) b = t[i]; }
      return a != null && b != null ? b - a : NaN;
    }
    function update() {
      sVC.el.style.opacity = st.on.via ? 1 : 0.4; sSL.el.style.opacity = st.on.stub ? 1 : 0.4;
      const { r, t0, tr } = run(st.on);
      const key = 'ideal' + st.tr;
      if (!cache[key]) cache[key] = run({});
      const id = cache[key].r;
      // TDR → impedance vs distance
      const xs = [], zs = [];
      for (let i = 0; i < r.t.length; i++) {
        const tt = r.t[i] - t0 - tr / 2;
        if (tt < 0) continue;
        const d = tt * VEL * 1e9 / 2;
        if (d > 158) break;
        const rho = clamp((r.out[0][i] - 0.5) / 0.5, -0.95, 0.95);
        xs.push(d); zs.push(50 * (1 + rho) / (1 - rho));
      }
      const marks = FEAT.filter(f => st.on[f.k]).map(f => ({ x0: f.x - 1, x1: f.x + (f.k === 'corner' ? 16 : f.k === 'conn' ? 6 : f.k === 'neck' ? 5 : 2), color: 'var(--accent)', alpha: 0.12 }));
      pZ.draw({ series: [{ x: xs, y: zs, color: 'var(--accent)', width: 2.2 }], hlines: [{ y: 50, color: 'var(--good)', label: '50 Ω', dash: [4, 4] }], xspans: marks, range: { ymin: 25, ymax: 80 } });
      const tn = Array.from(r.t, v => v * 1e9);
      pR.draw({ series: [{ x: tn, y: Array.from(id.out[1]), color: 'var(--good)', width: 1.6, dash: [5, 3], label: 'ideal line' }, { x: tn, y: Array.from(r.out[1]), color: 'var(--bad)', width: 2.2, label: 'with features' }], range: { ymin: -0.05, ymax: 0.65 } });
      const mn = Math.min(...zs), mx = Math.max(...zs);
      const rr = rise(tn, Array.from(r.out[1])), ri = rise(tn, Array.from(id.out[1]));
      M.set('min', sig(mn, 3) + ' Ω', mn < 42 ? 'bad' : mn < 46 ? 'warn' : 'good');
      M.set('max', sig(mx, 3) + ' Ω', mx > 58 ? 'bad' : mx > 54 ? 'warn' : 'good');
      M.set('rx', sig(rr * 1000, 3) + ' ps', rr > ri * 1.5 ? 'bad' : rr > ri * 1.15 ? 'warn' : 'good');
      M.set('ideal', sig(ri * 1000, 3) + ' ps');
      // per-feature deviation
      const items = [];
      for (const f of FEAT) {
        if (!st.on[f.k]) continue;
        let dev = 0;
        xs.forEach((x, i) => { if (x > f.x - 3 && x < f.x + (f.k === 'corner' ? 18 : 9)) dev = Math.max(dev, Math.abs(zs[i] - 50)); });
        const lvl = dev > 8 ? 'bad' : dev > 3 ? 'warn' : 'good';
        const why = {
          pads: 'Wide pads add capacitance: a dip. Use the smallest package (0402) and consider a plane cut-out under the pads.',
          via: 'Via pad capacitance (dip) followed by barrel inductance (bump). Sized antipads and return vias help (lesson 10).',
          neck: 'A narrow trace has less capacitance per mm: a bump. Keep necks short.',
          stub: `A ${st.stub} mm stub stores and re-releases energy: a dip, then a ripple. Route test points and pull-ups as daisy chains (Sierra §7.3.1.4).`,
          corner: 'Each corner adds ~10 fF. Visible only with very fast edges.',
          conn: 'Connector bodies rarely match exactly: a bump. Pick connectors rated for the interface.',
        }[f.k];
        items.push({ level: lvl, html: `<b>${f.t}</b>: ±${sig(dev, 2)} Ω. ${why}` });
      }
      if (!items.length) items.push({ level: 'good', html: 'Uniform 50 Ω line: the TDR is flat and the edge arrives unchanged.' });
      if (st.tr >= 200) items.push({ level: 'info', html: `With a ${st.tr} ps edge the TDR blurs features shorter than ~${sig(st.tr * 1e-3 * VEL / 2, 3)} mm together, so small ones vanish. Slow signals simply don't see them.` });
      V.set(items);
      E.set(`<p>The TDR edge travels out, partly reflects at each feature, and the reflection returns after 2 × distance / v. Converting ρ to impedance, Z = 50·(1+ρ)/(1−ρ), turns the echo into a map of the route.</p><p>A real high-speed channel has dozens of these features. Each one is small, but they add up and close the eye, which is why every pad, via and connector on a USB 3 or PCIe route is chosen deliberately.</p>`);
    }
    update();
  })();

  /* =================================================================
     7.3  Topology
     ================================================================= */
  (function labTopo() {
    const host = document.getElementById('lab-topo'); if (!host) return;
    const L = lab(host, { title: 'One driver, two receivers' });
    const st = { topo: 'star', ser: false, tr: 0.5 };
    const sTo = seg({ label: 'Topology', options: [{ v: 'star', label: 'T-branch (star)' }, { v: 'daisy', label: 'Daisy chain' }, { v: 'daisyT', label: 'Daisy + end termination' }], value: st.topo, onChange: v => { st.topo = v; update(); } });
    const cS = check({ label: 'Series resistor at the driver', onChange: v => { st.ser = v; update(); } });
    const sE = slider({ label: 'Edge rise time', min: 0.1, max: 2, log: true, value: st.tr, fmt: v => fmtSI(v * 1e-9, 's'), onInput: v => { st.tr = v; update(); } });
    L.controls.append(sTo.el, cS.el, sE.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 150' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Voltage at each receiver', height: 230, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function draw() {
      S.innerHTML = '';
      const W = '#e0a64a';
      const box = (x, y, t) => S.append(svg('rect', { x: x - 26, y: y - 14, width: 52, height: 28, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x, y: y + 4, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: t }));
      const line = (pts) => S.append(svg('path', { d: PCB.geo.pathD(pts), fill: 'none', stroke: W, 'stroke-width': 3 }));
      if (st.topo === 'star') { line([{ x: 70, y: 75 }, { x: 300, y: 75 }]); line([{ x: 300, y: 75 }, { x: 300, y: 30 }, { x: 540, y: 30 }]); line([{ x: 300, y: 75 }, { x: 300, y: 120 }, { x: 540, y: 120 }]); box(540, 30, 'RX 1'); box(540, 120, 'RX 2'); S.append(svg('text', { x: 180, y: 66, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: '50 mm' }), svg('text', { x: 420, y: 22, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: '25 mm' }), svg('text', { x: 420, y: 112, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: '40 mm' })); }
      else { line([{ x: 70, y: 75 }, { x: 560, y: 75 }]); line([{ x: 300, y: 75 }, { x: 300, y: 55 }]); box(300, 38, 'RX 1'); box(560, 108, 'RX 2'); line([{ x: 560, y: 75 }, { x: 560, y: 94 }]); S.append(svg('text', { x: 180, y: 92, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: '50 mm' }), svg('text', { x: 430, y: 92, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: '40 mm' }), svg('text', { x: 316, y: 66, fill: '#cfe0d5', 'font-size': 10, text: '2 mm stub' })); if (st.topo === 'daisyT') S.append(svg('text', { x: 600, y: 80, fill: '#ffd166', 'font-size': 10.5, text: 'VTT' })); }
      box(46, 75, 'DRV');
      if (st.ser) S.append(svg('rect', { x: 86, y: 68, width: 20, height: 14, fill: '#b9a37a' }));
    }
    function update() {
      draw();
      const net = new PCB.TLine(ns(0.5));
      let r1, r2;
      if (st.topo === 'star') { const j = net.line(0, 50, ns(50)); r1 = net.line(j, 50, ns(25)); r2 = net.line(j, 50, ns(40)); }
      else { const j = net.line(0, 50, ns(50)); r1 = net.line(j, 50, ns(2)); r2 = net.line(j, 50, ns(40)); if (st.topo === 'daisyT') { net.G[r2] = 1 / 50; net.J[r2] = 1.65 / 50; } }
      net.C[r1] += 3e-12; net.C[r2] += 3e-12;
      const Rs = st.ser ? 33 : 15;
      const r = PCB.simNet(net, { src: 0, Rs, vs: t => 3.3 * PCB.ramp(t, 0.2e-9, st.tr * 1e-9), T: 6e-9 + 3 * st.tr * 1e-9, nOut: 700, probes: [r1, r2] });
      const t = Array.from(r.t, v => v * 1e9), y1 = Array.from(r.out[0]), y2 = Array.from(r.out[1]);
      plot.draw({ series: [{ x: t, y: y1, color: 'var(--link)', width: 2.2, label: 'RX 1' }, { x: t, y: y2, color: 'var(--bad)', width: 2.2, label: 'RX 2' }], bands: [{ y0: 0.8, y1: 2.0, color: 'var(--warn)', alpha: 0.1 }], hlines: [{ y: 2.0, color: 'var(--warn)', dash: [3, 3], label: 'VIH' }], range: { ymin: -1.5, ymax: 6.5 } });
      const a1 = analyse(t, y1, 3.3, 2.0), a2 = analyse(t, y2, 3.3, 2.0);
      const items = [];
      for (const [n, a] of [['RX 1', a1], ['RX 2', a2]]) {
        const bad = a.ring < 2.0, ov = a.over > 0.8;
        items.push({ level: bad ? 'bad' : ov ? 'warn' : 'good', html: `<b>${n}</b>: overshoot +${sig(a.over, 2)} V, lowest after crossing ${sig(a.ring, 3)} V${bad ? ' (re-crosses VIH: false clocking)' : ''}.` });
      }
      if (st.topo === 'star') items.push({ level: 'info', html: 'Each branch (25 mm and 40 mm) is an unterminated stub for the other. Their reflections return at different times, meet at the junction and ring back into both receivers. Real boards rarely manage exactly equal branches.' });
      if (st.topo !== 'star') items.push({ level: 'info', html: 'Daisy chain: the edge passes RX 1 through a very short stub and continues to RX 2. With an end termination, the only reflection is RX 1\'s tiny stub. This is DDR\'s "fly-by" topology.' });
      V.set(items);
      E.set('<p>Stubs and branches are lines with nothing absorbing at their ends, so they hold and re-release energy. The rule (Sierra §2.3.1, §7.3.1.4): route multi-drop nets as a <b>daisy chain</b> with stubs much shorter than the edge length, and terminate the far end if the edge is fast.</p>');
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'A 15 Ω CMOS driver drives a 50 Ω, 150 mm line into a high-impedance receiver. Where should a series termination resistor go and what value?', opts: ['At the receiver, 50 Ω', 'At the driver pin, about 33–35 Ω', 'In the middle of the line, 50 Ω'], a: 1, ex: 'Series termination works by making the source match the line: R + R<sub>driver</sub> ≈ Z0. It must be at the driver, or the segment between driver and resistor still reflects (Sierra §7.2.3).' },
    { q: 'On a TDR, a dip below 50 Ω at 45 mm most likely means…', opts: ['A narrow neck in the trace', 'Something capacitive: a via pad, wide pad or stub', 'The line is too long'], a: 1, ex: 'Extra capacitance lowers the local impedance (dip). Inductive or narrow features raise it (bump).' },
    { q: 'Why does DDR memory use a daisy-chain ("fly-by") topology for address lines?', opts: ['It is shorter', 'Branches act as unterminated stubs whose reflections ring at every receiver; a terminated daisy chain leaves only tiny stubs', 'It needs fewer vias'], a: 1, ex: 'Lesson 7.3 shows the star topology ringing at both receivers, while the terminated daisy chain is clean.' },
  ]);
})();
