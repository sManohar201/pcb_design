/* Lesson 2 — Stackup design */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;

  PCB.renderChrome({ lesson: 2 });

  /* =================================================================
     2.1  Stackup builder
     ================================================================= */
  (function labStack() {
    const host = document.getElementById('lab-stack'); if (!host) return;
    const L = lab(host, { title: 'Stackup builder (1.6 mm board)' });
    const GOOD = { 4: 'SGPS', 6: 'SGSPGS', 8: 'SGSGPSGS', 10: 'SGSGSPGSGS' };
    const BAD = { 4: 'SPSG', 6: 'SSGPSS', 8: 'SSGSSPSS', 10: 'SSGSSPSSGS' };
    const st = { n: 6, roles: GOOD[6].split(''), outer: 0.1, thin: true };
    const sN = seg({ label: 'Layer count', options: [4, 6, 8, 10].map(v => ({ v, label: v + ' layers' })), value: st.n, onChange: v => { st.n = v; st.roles = GOOD[v].split(''); update(); } });
    const sO = seg({ label: 'Outer prepreg (signal-to-plane height on L1)', options: [{ v: 0.075, label: '0.075 mm' }, { v: 0.1, label: '0.10 mm' }, { v: 0.2, label: '0.20 mm' }, { v: 0.36, label: '0.36 mm' }], value: st.outer, onChange: v => { st.outer = v; update(); } });
    const cT = check({ label: 'Thin core (0.1 mm) wherever a power plane sits next to a ground plane', checked: true, onChange: v => { st.thin = v; update(); } });
    L.controls.append(sN.el, sO.el, cT.el,
      el('div', { class: 'ctl-group-title' }, 'Presets'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => { st.roles = GOOD[st.n].split(''); update(); } }, 'Recommended'),
        el('button', { class: 'btn', onclick: () => { st.roles = BAD[st.n].split(''); update(); } }, 'Common mistake')),
      el('div', { class: 'hint', html: 'Click a copper layer in the drawing to cycle <b>SIG → GND → PWR</b>.' }));
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 420', style: 'background:var(--surface-2)' });
    L.stage.append(S, legend([['#e0a64a', 'signal layer'], ['#5fbf79', 'ground plane'], ['#e06070', 'power plane'], ['#cfe3c9', 'prepreg'], ['#b9d3ae', 'core']]));
    const M = meters(L.stage, [{ key: 'sig', label: 'Routing layers' }, { key: 'gref', label: 'GND-referenced signal layers' }, { key: 'cap', label: 'Plane C per 100 cm²' }, { key: 'sym', label: 'Symmetric?' }, { key: 'w50', label: '50 Ω width on L1' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    function dielectrics() {
      const n = st.n, d = new Array(n - 1).fill(null);
      d[0] = st.outer; d[n - 2] = st.outer;
      for (let i = 1; i < n - 2; i++) {
        const a = st.roles[i], b = st.roles[i + 1];
        if (st.thin && ((a === 'P' && b === 'G') || (a === 'G' && b === 'P'))) { d[i] = 0.1; d[n - 2 - i] = 0.1; } // mirror to stay symmetric
      }
      const fixed = d.reduce((s, v) => s + (v || 0), 0);
      const free = d.filter(v => v == null).length;
      const rest = Math.max(0.06 * free, 1.6 - n * 0.035 - fixed);
      return d.map(v => (v == null ? Math.max(0.06, rest / free) : v));
    }
    function update() {
      const n = st.n, R = st.roles, d = dielectrics();
      const isPlane = r => r === 'G' || r === 'P';
      // ---- analysis
      const sigInfo = [];
      let gref = 0, nsig = 0, broadside = [], unref = [];
      for (let i = 0; i < n; i++) {
        if (R[i] !== 'S') continue;
        nsig++;
        const up = i > 0 ? { r: R[i - 1], h: d[i - 1], l: i } : null, dn = i < n - 1 ? { r: R[i + 1], h: d[i], l: i + 2 } : null;
        const planes = [up, dn].filter(x => x && isPlane(x.r));
        const sigN = [up, dn].filter(x => x && x.r === 'S');
        const g = planes.filter(p => p.r === 'G').sort((a, b) => a.h - b.h)[0];
        const ref = g || planes.sort((a, b) => a.h - b.h)[0];
        let w50 = null, type = null;
        if (ref) {
          if (planes.length === 2) { type = 'stripline'; const b = planes[0].h + planes[1].h + 0.035; w50 = phys.solveWidth(w => phys.stripline(w, b).z0, 50); }
          else { type = 'microstrip'; w50 = phys.solveWidth(w => phys.microstrip(w, ref.h).z0, 50); }
        }
        if (g && g.h <= 0.25) gref++;
        if (!ref) unref.push(i + 1);
        sigN.forEach(x => broadside.push(`L${i + 1}/L${x.l}`));
        sigInfo.push({ i, ref, g, type, w50 });
      }
      broadside = [...new Set(broadside.map(s => s.split('/').map(v => +v.slice(1)).sort((a, b) => a - b).map(v => 'L' + v).join('/')))];
      let capPerCm2 = 0, pg = [];
      for (let i = 0; i < n - 1; i++) if ((R[i] === 'P' && R[i + 1] === 'G') || (R[i] === 'G' && R[i + 1] === 'P')) { capPerCm2 = Math.max(capPerCm2, phys.plateC(100, d[i], 4.2)); pg.push(i); }
      let symD = true; for (let i = 0; i < n - 1; i++) if (Math.abs(d[i] - d[n - 2 - i]) > 1e-6) symD = false;
      const unbalanced = []; for (let i = 0; i < n / 2; i++) if (isPlane(R[i]) !== isPlane(R[n - 1 - i])) unbalanced.push(`L${i + 1}/L${n - i}`);
      const sym = symD && !unbalanced.length;
      const pwrRef = sigInfo.filter(s => s.ref && !s.g).map(s => s.i + 1);
      const ngnd = R.filter(r => r === 'G').length;
      // ---- drawing
      S.innerHTML = '';
      const CU = 9;
      const dpx = d.map(v => 14 + v * 70);
      const totalPx = n * CU + dpx.reduce((a, b) => a + b, 0);
      const sc = Math.min(1, 380 / totalPx);
      let y = 20;
      const x0 = 70, x1 = 400;
      const COL = { S: '#e0a64a', G: '#5fbf79', P: '#e06070' };
      const NAME = { S: 'SIG', G: 'GND', P: 'PWR' };
      for (let i = 0; i < n; i++) {
        const h = CU * sc;
        const r = R[i];
        const bar = svg('rect', { x: x0, y, width: x1 - x0, height: Math.max(h, 4), rx: 2, fill: COL[r], style: 'cursor:pointer' });
        if (r === 'S') { bar.setAttribute('fill', 'transparent'); }
        const grp = svg('g', { style: 'cursor:pointer' });
        grp.append(bar);
        if (r === 'S') for (let k = 0; k < 7; k++) grp.append(svg('rect', { x: x0 + 12 + k * 46, y, width: 24, height: Math.max(h, 4), rx: 1.5, fill: COL.S }));
        grp.addEventListener('click', () => { st.roles[i] = r === 'S' ? 'G' : r === 'G' ? 'P' : 'S'; update(); });
        S.append(grp);
        S.append(svg('text', { x: x0 - 8, y: y + h / 2 + 4, 'text-anchor': 'end', fill: 'var(--text)', 'font-size': 12, 'font-weight': 650, text: `L${i + 1} ${NAME[r]}` }));
        const info = sigInfo.find(s => s.i === i);
        if (info) {
          const txt = info.ref ? `${info.type} · ref L${info.ref.l} ${NAME[info.ref.r]} (${sig(info.ref.h, 2)} mm) · 50 Ω ≈ ${sig(info.w50, 2)} mm` : 'no adjacent plane!';
          S.append(svg('text', { x: x1 + 10, y: y + h / 2 + 4, fill: info.ref ? (info.g ? 'var(--good)' : 'var(--warn)') : 'var(--bad)', 'font-size': 11, text: txt }));
        }
        y += h;
        if (i < n - 1) {
          const hh = dpx[i] * sc;
          const core = i % 2 === 1;
          S.append(svg('rect', { x: x0, y, width: x1 - x0, height: hh, fill: core ? '#b9d3ae' : '#cfe3c9', opacity: 0.85 }));
          S.append(svg('text', { x: (x0 + x1) / 2, y: y + hh / 2 + 4, 'text-anchor': 'middle', fill: '#2d4a2f', 'font-size': 10, text: `${core ? 'core' : 'prepreg'} ${sig(d[i], 2)} mm` }));
          y += hh;
        }
      }
      // ---- meters & verdicts
      const w1 = sigInfo.find(s => s.i === 0);
      M.set('sig', String(nsig));
      M.set('gref', `${gref} / ${nsig}`, gref === nsig ? 'good' : gref ? 'warn' : 'bad');
      M.set('cap', capPerCm2 ? fmtSI(capPerCm2, 'F') : 'none', capPerCm2 > 3e-9 ? 'good' : capPerCm2 ? 'warn' : 'bad');
      M.set('sym', sym ? 'yes' : symD ? 'use pours' : 'no', sym ? 'good' : symD ? 'warn' : 'bad');
      M.set('w50', w1 && w1.w50 ? sig(w1.w50, 2) + ' mm' : '—');
      const items = [];
      if (!ngnd) items.push({ level: 'bad', html: 'There is no ground plane at all. Every return current has to find its own way (lesson 3).' });
      if (unref.length) items.push({ level: 'bad', html: `Signal layer${unref.length > 1 ? 's' : ''} ${unref.map(v => 'L' + v).join(', ')} ${unref.length > 1 ? 'have' : 'has'} <b>no adjacent plane</b>. Impedance is uncontrolled and return currents spread wide.` });
      if (broadside.length) items.push({ level: 'warn', html: `Adjacent signal layers ${broadside.join(', ')} with no plane between: <b>broadside crosstalk</b>. If you must, route them orthogonally and keep fast signals off them (lesson 9).` });
      if (pwrRef.length) items.push({ level: 'warn', html: `${pwrRef.map(v => 'L' + v).join(', ')} reference${pwrRef.length > 1 ? '' : 's'} only a power plane. Fine for slow signals, but fast ones need stitching caps at every island crossing (lesson 4.3).` });
      if (gref === nsig && nsig) items.push({ level: 'good', html: 'Every signal layer sits next to a ground plane: continuous return paths and controllable impedance everywhere.' });
      if (st.outer > 0.25) items.push({ level: 'warn', html: `L1 is ${st.outer} mm above its plane. That gives wide 50 Ω traces (${w1 && w1.w50 ? sig(w1.w50, 2) + ' mm' : '—'}), loose return paths and more crosstalk. Sierra recommends &lt; 10 mil (0.25 mm).` });
      if (!symD) items.push({ level: 'bad', html: 'Dielectric thicknesses are not mirror-symmetric about the centre: the board will <b>bow and twist</b> after lamination, which hurts BGA soldering.' });
      else if (unbalanced.length) items.push({ level: 'info', html: `${unbalanced.join(', ')} pair a signal layer with a plane in the mirror position. That is normal (e.g. the classic 6-layer), but fill unused areas of the signal layer with copper pour so the copper balance stays even.` });
      if (pg.length && st.thin) items.push({ level: 'good', html: `PWR and GND planes are 0.1 mm apart: ${fmtSI(capPerCm2, 'F')} per 100 cm² of almost inductance-free decoupling (lesson 5.3).` });
      if (nsig < 3 && st.n >= 6) items.push({ level: 'info', html: `Only ${nsig} routing layers. Check that the densest part (BGA or connector) can actually fan out.` });
      V.set(items);
      E.set('<p>The stackup decides <b>where every return current flows</b>. A signal layer next to ground gets a tight, continuous return path; one next to another signal layer gets crosstalk instead.</p><p>Thin dielectrics shrink every loop (lesson 3.3), and a thin PWR–GND core adds plane capacitance for free (lesson 5). Symmetry is purely mechanical, but a warped board is just as unusable.</p>');
    }
    update();
  })();

  /* =================================================================
     2.2  Impedance calculator
     ================================================================= */
  (function labZ() {
    const host = document.getElementById('lab-z'); if (!host) return;
    const L = lab(host, { title: 'Controlled-impedance calculator' });
    const st = { type: 'dms', w: 0.1, s: 0.15, h: 0.1, er: 4.1, oz: 0.5, target: 90 };
    const sT = seg({ label: 'Structure', options: [{ v: 'ms', label: 'Microstrip' }, { v: 'sl', label: 'Stripline' }, { v: 'dms', label: 'Diff microstrip' }, { v: 'dsl', label: 'Diff stripline' }], value: st.type, onChange: v => { st.type = v; if (v === 'ms' || v === 'sl') { st.target = 50; sTg.set(50); } update(); } });
    const sW = slider({ label: 'Trace width W', min: 0.05, max: 1, log: true, value: st.w, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.w = v; update(); } });
    const sS = slider({ label: 'Gap S (diff pairs)', min: 0.05, max: 1, log: true, value: st.s, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.s = v; update(); } });
    const sH = slider({ label: 'Height H to plane (stripline: each side)', min: 0.05, max: 1, log: true, value: st.h, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.h = v; update(); } });
    const sE = slider({ label: 'Dielectric constant Dk', min: 3, max: 4.8, step: 0.05, value: st.er, fmt: v => sig(v, 3), onInput: v => { st.er = v; update(); } });
    const sC = seg({ label: 'Copper', options: [{ v: 0.5, label: '½ oz' }, { v: 1, label: '1 oz' }], value: st.oz, onChange: v => { st.oz = v; update(); } });
    const sTg = seg({ label: 'Target', options: [50, 85, 90, 100].map(v => ({ v, label: v + ' Ω' })), value: st.target, onChange: v => { st.target = v; update(); } });
    const fit = el('button', { class: 'btn primary', onclick: () => { const w = solveW(); st.w = w; sW.set(w); update(); } }, 'Solve width for target');
    L.controls.append(sT.el, sW.el, sS.el, sH.el, sE.el, sC.el, sTg.el, fit);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 190', style: 'background:var(--surface-2)' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Impedance vs trace width (other dimensions fixed)', height: 220, xlog: true, xmin: 0.04, xmax: 1.2, xlabel: 'W [mm]', ylabel: 'Ω', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'z', label: 'Impedance' }, { key: 'z0', label: 'Single-line Z0' }, { key: 'ee', label: 'Effective Dk' }, { key: 'tpd', label: 'Delay' }, { key: 'tol', label: 'W ±10% →' }, { key: 'wt', label: 'Width for target' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Hammerstad microstrip and IPC-2141 stripline/differential approximations: typically within 5–10% of a field solver. Your fab\'s solver (with their real materials) is the final word.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const t = () => phys.tOz(st.oz);
    const diff = () => st.type === 'dms' || st.type === 'dsl';
    function zOf(w) {
      const b = 2 * st.h + t();
      if (st.type === 'ms') { const m = phys.microstrip(w, st.h, st.er, t()); return { z: m.z0, m }; }
      if (st.type === 'sl') { const m = phys.stripline(w, b, st.er, t()); return { z: m.z0, m }; }
      if (st.type === 'dms') { const m = phys.diffMicrostrip(w, st.s, st.h, st.er, t()); return { z: m.zdiff, m }; }
      const m = phys.diffStripline(w, st.s, b, st.er, t()); return { z: m.zdiff, m };
    }
    function solveW() { return phys.solveWidth(w => zOf(w).z, st.target, 0.03, 3); }
    st.w = Math.round(solveW() * 1000) / 1000; sW.set(st.w);
    function update() {
      const r = zOf(st.w), z = r.z, m = r.m;
      sS.el.style.opacity = diff() ? 1 : 0.4;
      // drawing
      S.innerHTML = '';
      const strip = st.type === 'sl' || st.type === 'dsl';
      const sc = clamp(150 / Math.max(st.h * (strip ? 2 : 1) + 0.1, (diff() ? 2 * st.w + st.s : st.w) * 0.9), 40, 600);
      const yPl = 160, hpx = st.h * sc, tpx = Math.max(t() * sc, 3);
      const yTop = strip ? yPl - 2 * hpx - tpx : 0;
      S.append(svg('rect', { x: 20, y: strip ? yTop - 6 : 30, width: 600, height: strip ? yPl - yTop + 6 : yPl - 30, fill: '#cfe3c9' }));
      S.append(svg('rect', { x: 20, y: yPl, width: 600, height: 8, fill: '#5fbf79' }));
      if (strip) S.append(svg('rect', { x: 20, y: yTop - 8, width: 600, height: 8, fill: '#5fbf79' }));
      const yT = strip ? yPl - hpx - tpx : yPl - hpx - tpx;
      const wpx = st.w * sc, spx = st.s * sc;
      const xs = diff() ? [320 - spx / 2 - wpx, 320 + spx / 2] : [320 - wpx / 2];
      xs.forEach(x => S.append(svg('rect', { x, y: yT, width: wpx, height: tpx, fill: '#e0a64a' })));
      S.append(svg('text', { x: 320, y: yT - 10, 'text-anchor': 'middle', fill: '#2d4a2f', 'font-size': 11, text: diff() ? `W ${sig(st.w, 2)} · S ${sig(st.s, 2)} mm` : `W ${sig(st.w, 2)} mm` }));
      S.append(svg('line', { x1: 120, y1: yT + tpx, x2: 120, y2: yPl, stroke: '#2d4a2f', 'stroke-width': 1 }));
      S.append(svg('text', { x: 126, y: (yT + tpx + yPl) / 2 + 4, fill: '#2d4a2f', 'font-size': 11, text: `H ${sig(st.h, 2)} mm` }));
      S.append(svg('text', { x: 600, y: yPl + 24, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 11, text: `Dk ${st.er} · ${strip ? 'planes above and below' : 'plane below, air above'}` }));
      // plot
      const ws = [], zs = [];
      for (let i = 0; i <= 120; i++) { const w = 0.04 * Math.pow(30, i / 120); ws.push(w); zs.push(zOf(w).z); }
      plot.draw({ series: [{ x: ws, y: zs, color: 'var(--accent)', width: 2.5 }], bands: [{ y0: st.target * 0.9, y1: st.target * 1.1, color: 'var(--good)', alpha: 0.15 }], hlines: [{ y: st.target, color: 'var(--good)', label: `target ${st.target} Ω ±10%` }], markers: [{ x: st.w, y: z, color: 'var(--bad)', r: 5, label: sig(z, 3) + ' Ω' }], range: { ymin: 20, ymax: Math.max(160, st.target * 1.4) } });
      const zl = zOf(st.w * 0.9).z, zh = zOf(st.w * 1.1).z, wt = solveW();
      const ok = Math.abs(z - st.target) / st.target <= 0.1;
      M.set('z', sig(z, 3) + ' Ω', ok ? 'good' : 'bad');
      M.set('z0', sig(m.z0, 3) + ' Ω');
      M.set('ee', sig(m.eeff, 3));
      M.set('tpd', sig(m.tpd, 3) + ' ps/mm');
      M.set('tol', `${sig(zh, 3)}–${sig(zl, 3)} Ω`);
      M.set('wt', sig(wt, 3) + ' mm');
      const items = [];
      items.push({ level: ok ? 'good' : 'bad', html: `${diff() ? 'Differential' : 'Single-ended'} impedance <b>${sig(z, 3)} Ω</b> vs target ${st.target} Ω (${sig((z / st.target - 1) * 100, 2)}%). ${ok ? 'Within ±10%.' : `Use W ≈ ${sig(wt, 3)} mm (click <b>Solve width</b>).`}` });
      if (st.w > 2 * st.h) items.push({ level: 'warn', html: `W is more than 2× H. Sierra §3.5.8 advises against it: impedance becomes very sensitive to H, and the traces eat routing space.` });
      if (st.w < 0.075) items.push({ level: 'warn', html: `${sig(st.w * 1000, 3)} µm is finer than standard fab capability (~75–100 µm). Expect extra cost; ask your fab first.` });
      if (diff() && st.s > 2 * st.w) items.push({ level: 'info', html: 'Loosely coupled pair (S > 2W): each line is mostly referenced to the plane, so impedance depends less on S but the pair rejects common noise less tightly.' });
      if (diff() && st.s < 0.08) items.push({ level: 'warn', html: 'Gap below ~80 µm: hard to etch reliably.' });
      items.push({ level: 'info', html: `A ±10% width tolerance moves the impedance between ${sig(zh, 3)} and ${sig(zl, 3)} Ω. That is why fabs adjust widths and test coupons (Sierra §3.5.9).` });
      V.set(items);
      E.set(`<p>Z = √(L/C) per unit length. A wider trace or a closer plane adds capacitance and lowers Z. A higher Dk does the same and also slows the signal (${sig(m.tpd, 3)} ps/mm here).</p><p>In a <b>stripline</b> the field is entirely inside the dielectric, so it is slower (Dk<sub>eff</sub> = Dk) but better shielded. A <b>microstrip</b> is partly in air: faster, but it radiates and couples more.</p>`);
    }
    update();
  })();

  /* =================================================================
     2.3  Loss budget
     ================================================================= */
  (function labLoss() {
    const host = document.getElementById('lab-loss'); if (!host) return;
    const L = lab(host, { title: 'Insertion loss of a route' });
    const MAT = {
      fr4: { t: 'Standard FR-4', dk: 4.2, df: 0.02 },
      mid: { t: 'Mid-loss', dk: 3.9, df: 0.01 },
      low: { t: 'Low-loss', dk: 3.6, df: 0.004 },
      ulow: { t: 'Ultra-low-loss', dk: 3.3, df: 0.002 },
    };
    const IF = {
      mipi: { t: 'MIPI CSI 2.5 Gb/s', f: 1.25 }, usb1: { t: 'USB 3.2 Gen 1', f: 2.5 }, pcie3: { t: 'PCIe Gen 3', f: 4 },
      usb2: { t: 'USB 3.2 Gen 2', f: 5 }, pcie4: { t: 'PCIe Gen 4', f: 8 },
    };
    const st = { mat: 'fr4', len: 150, w: 0.1, ifc: 'pcie4' };
    const sM = seg({ label: 'Material', options: Object.entries(MAT).map(([v, m]) => ({ v, label: m.t })), value: st.mat, onChange: v => { st.mat = v; update(); } });
    const sI = seg({ label: 'Interface (Nyquist frequency)', options: Object.entries(IF).map(([v, m]) => ({ v, label: m.t })), value: st.ifc, onChange: v => { st.ifc = v; update(); } });
    const sL = slider({ label: 'Route length', min: 10, max: 400, step: 5, value: st.len, fmt: v => v + ' mm', onInput: v => { st.len = v; update(); } });
    const sW = slider({ label: 'Trace width', min: 0.075, max: 0.3, step: 0.005, value: st.w, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.w = v; update(); } });
    L.controls.append(sM.el, sI.el, sL.el, sW.el);
    const plot = new Plot(L.stage, { title: 'Loss along the route vs frequency', height: 260, xmin: 0, xmax: 12, xlabel: 'GHz', ylabel: 'dB', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'tot', label: 'Loss at Nyquist' }, { key: 'amp', label: 'Amplitude left', bar: true }, { key: 'cd', label: 'Conductor / dielectric' }, { key: 'per', label: 'Per 10 mm' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Bogatin rules of thumb: dielectric ≈ 2.3·f·Df·√Dk dB/inch, conductor ≈ 36·√f/(W[mil]·Z0) dB/inch (smooth copper, 50 Ω). Real copper roughness adds more. Thresholds are illustrative; take your actual PCB loss budget from the interface\'s design guide.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const m = MAT[st.mat], f0 = IF[st.ifc].f, inch = st.len / 25.4;
      const fs = [], c = [], dd = [], tt = [];
      for (let i = 0; i <= 120; i++) {
        const f = 12 * i / 120; fs.push(f);
        const a = phys.lossCond(f, st.w, 50) * inch, b = phys.lossDiel(f, m.df, m.dk) * inch;
        c.push(-a); dd.push(-b); tt.push(-(a + b));
      }
      const lc = phys.lossCond(f0, st.w, 50) * inch, ld = phys.lossDiel(f0, m.df, m.dk) * inch, lt = lc + ld;
      plot.draw({ series: [
        { x: fs, y: c, color: 'var(--accent)', width: 1.5, dash: [5, 3], label: 'conductor' },
        { x: fs, y: dd, color: 'var(--link)', width: 1.5, dash: [5, 3], label: 'dielectric' },
        { x: fs, y: tt, color: 'var(--bad)', width: 2.6, label: 'total' }],
        vlines: [{ x: f0, color: 'var(--text)', label: 'Nyquist ' + f0 + ' GHz' }], range: { ymax: 0.5 } });
      const amp = Math.pow(10, -lt / 20);
      const lvl = lt > 8 ? 'bad' : lt > 4 ? 'warn' : 'good';
      M.set('tot', sig(lt, 3) + ' dB', lvl);
      M.set('amp', sig(amp * 100, 3) + ' %', lvl, amp);
      M.set('cd', `${sig(lc, 2)} / ${sig(ld, 2)} dB`);
      M.set('per', sig(lt / st.len * 10, 2) + ' dB');
      const items = [{ level: lvl, html: `<b>${sig(lt, 3)} dB</b> at ${f0} GHz: only ${sig(amp * 100, 3)}% of the signal amplitude reaches the receiver. ${lvl === 'bad' ? 'That likely eats most of the channel budget before connectors, cables and vias are counted.' : lvl === 'warn' ? 'Noticeable. Check it against the interface\'s budget.' : 'Comfortable.'}` }];
      if (ld > lc && st.mat === 'fr4') items.push({ level: 'info', html: `Dielectric loss dominates (${sig(ld, 2)} dB). A lower-Df material would help more than a wider trace here. Or simply <b>shorten the route</b>: loss scales with length.` });
      if (lc > ld) items.push({ level: 'info', html: `Conductor loss dominates. Wider traces help, but they need a taller dielectric to keep the impedance, which affects the whole stackup.` });
      V.set(items);
      E.set(`<p>Loss rises with frequency, so the <b>edges</b> get rounded off first. A fast signal arrives as a slow one, and the eye closes (lesson 8). Equalisers in USB/PCIe receivers recover some of this, but only up to a limit.</p><p>On a carrier board the cheapest fix is usually <b>placement</b>: put the M.2 slot or USB connector close to the module so the routes stay short.</p>`);
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Which 6-layer stackup gives every signal layer an adjacent ground reference?', opts: ['SIG / SIG / GND / PWR / SIG / SIG', 'SIG / GND / SIG / PWR / GND / SIG', 'GND / SIG / SIG / SIG / SIG / PWR'], a: 1, ex: 'L1 → L2 GND, L3 → L2 GND (and L4 PWR), L6 → L5 GND. The first option leaves L1/L2 and L5/L6 as signal pairs with no plane between them.' },
    { q: 'A 50 Ω microstrip is 0.30 mm wide on a 0.17 mm prepreg. The fab ships the prepreg 10% thicker. The impedance…', opts: ['drops', 'rises', 'is unchanged'], a: 1, ex: 'A thicker dielectric moves the plane away and lowers the capacitance per length, so Z = √(L/C) goes up. That is why fabs adjust trace width per board to hit the target.' },
    { q: 'Why might the fab ask you to route your 50 Ω traces at 0.127 mm instead of 0.125 mm?', opts: ['Better impedance', 'So the impedance-controlled traces have a unique width they can identify and tune', 'It etches better'], a: 1, ex: 'Sierra §3.5.6.1: if every trace is 0.125 mm the fab can\'t tell which ones are impedance-controlled.' },
  ]);
})();
