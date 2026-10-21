/* Lesson 1 — Every wire is a resistor and an inductor */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;

  PCB.renderChrome({ lesson: 1 });

  /* =================================================================
     1.1  Resistance: regulator → module power trace
     ================================================================= */
  (function labResistance() {
    const host = document.getElementById('lab-r'); if (!host) return;
    const L = lab(host, { title: 'Power trace: 5 V regulator → module' });
    const st = { I: 3, w: 1, len: 60, oz: 1, ret: 'plane' };

    const sI = slider({ label: 'Load current', min: 0.1, max: 10, step: 0.1, value: st.I, fmt: v => sig(v, 2) + ' A', onInput: v => { st.I = v; update(); } });
    const sW = slider({ label: 'Trace width', min: 0.1, max: 10, log: true, value: st.w, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.w = v; update(); } });
    const sL = slider({ label: 'Trace length', min: 5, max: 200, step: 1, value: st.len, fmt: v => v.toFixed(0) + ' mm', onInput: v => { st.len = v; update(); } });
    const sOz = seg({ label: 'Copper weight', options: [{ v: 0.5, label: '½ oz' }, { v: 1, label: '1 oz' }, { v: 2, label: '2 oz' }], value: 1, onChange: v => { st.oz = v; update(); } });
    const sRet = seg({ label: 'Ground return path', options: [{ v: 'plane', label: 'Solid plane' }, { v: 'trace', label: 'Same-width trace' }], value: 'plane', onChange: v => { st.ret = v; update(); } });
    const preset = (w, I) => () => { st.w = w; st.I = I; sW.set(w); sI.set(I); update(); };
    L.controls.append(sI.el, sW.el, sL.el, sOz.el, sRet.el,
      el('div', { class: 'ctl-group-title' }, 'Try'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: preset(0.15, 3) }, '3 A on a 0.15 mm signal trace'),
        el('button', { class: 'btn', onclick: preset(1.5, 3) }, '3 A, 1.5 mm'),
        el('button', { class: 'btn', onclick: preset(8, 6) }, '6 A on an 8 mm pour')));

    // ---- stage
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 240' });
    const plane = svg('rect', { x: 6, y: 6, width: 628, height: 228, rx: 8, fill: 'var(--plane)', opacity: 0.5 });
    const planeTxt = svg('text', { x: 18, y: 226, fill: 'var(--gnd)', 'font-size': 11, text: 'GND plane on the layer below — return current spreads out wide' });
    const reg = svg('g', null,
      svg('rect', { x: 22, y: 58, width: 98, height: 120, rx: 6, fill: '#161a17', stroke: 'var(--silk)', 'stroke-width': 1.2 }),
      svg('text', { x: 71, y: 112, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 13, 'font-weight': 600, text: '5 V REG' }),
      svg('text', { x: 71, y: 130, 'text-anchor': 'middle', fill: '#9fb3a8', 'font-size': 10.5, text: 'regulator' }));
    const mod = svg('g', null,
      svg('rect', { x: 520, y: 48, width: 100, height: 140, rx: 6, fill: '#1d2730', stroke: 'var(--silk)', 'stroke-width': 1.2 }),
      svg('text', { x: 570, y: 112, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 13, 'font-weight': 600, text: 'MODULE' }),
      svg('text', { x: 570, y: 130, 'text-anchor': 'middle', fill: '#9fb3a8', 'font-size': 10.5, text: 'load' }));
    const glow = svg('line', { x1: 120, y1: 88, x2: 520, y2: 88, 'stroke-linecap': 'butt', opacity: 0 });
    const trace = svg('line', { x1: 120, y1: 88, x2: 520, y2: 88, 'stroke-linecap': 'butt' });
    const gtrace = svg('line', { x1: 120, y1: 150, x2: 520, y2: 150, 'stroke-linecap': 'butt', stroke: 'var(--copper-dim)' });
    const dots = svg('g');
    const vSrc = svg('text', { x: 126, y: 70, fill: 'var(--silk)', 'font-size': 12, 'font-family': 'var(--mono)' });
    const vLoad = svg('text', { x: 514, y: 70, 'text-anchor': 'end', fill: 'var(--silk)', 'font-size': 12, 'font-family': 'var(--mono)' });
    const vGnd = svg('text', { x: 514, y: 178, 'text-anchor': 'end', fill: 'var(--gnd)', 'font-size': 12, 'font-family': 'var(--mono)' });
    const dim = svg('text', { x: 320, y: 120, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 11.5 });
    const lblSup = svg('text', { x: 320, y: 66, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 11, text: '+5 V trace →' });
    const lblRet = svg('text', { x: 320, y: 176, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 11, text: '← return current' });
    S.append(plane, planeTxt, glow, trace, gtrace, dots, reg, mod, vSrc, vLoad, vGnd, dim, lblSup, lblRet);
    L.stage.append(S);
    const M = meters(L.stage, [
      { key: 'R', label: 'R (5 V trace)' }, { key: 'drop', label: 'Total drop' }, { key: 'vl', label: 'V at module', bar: true },
      { key: 'P', label: 'Heat in copper' }, { key: 'dT', label: 'Temp rise (IPC-2221)', bar: true }, { key: 'J', label: 'Current density' },
    ]);
    L.stage.append(el('div', { class: 'model-note' }, 'Model: DC resistance with copper tempco; IPC-2221 external-layer curve for temperature rise; plane return treated as a ~30 mm wide sheet.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    // current dots
    const N = 18, supDots = [], retDots = [];
    for (let i = 0; i < N; i++) {
      const a = svg('circle', { r: 2.6, fill: 'var(--hot)' }); dots.append(a); supDots.push({ n: a, s: i / N });
      const b = svg('circle', { r: 2.2, fill: 'var(--gnd)' }); dots.append(b); retDots.push({ n: b, s: i / N, off: (Math.random() - 0.5) });
    }
    let speed = 0.1, last = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      for (const d of supDots) { d.s = (d.s + dt * speed) % 1; setAttrs(d.n, { cx: 120 + d.s * 400, cy: 88 }); }
      for (const d of retDots) {
        d.s = (d.s + dt * speed) % 1;
        const y = st.ret === 'plane' ? 150 + d.off * 120 * Math.sin(Math.PI * d.s) : 150;
        setAttrs(d.n, { cx: 520 - d.s * 400, cy: y });
      }
    });

    function update() {
      const t = phys.tOz(st.oz);
      const dT = phys.ipcDeltaT(st.I, st.w, t);
      const R25 = phys.traceR(st.len, st.w, t, 25);
      const Rh = phys.traceR(st.len, st.w, t, 25 + Math.min(dT, 200));
      const Rret = st.ret === 'plane' ? phys.traceR(st.len, 30, t, 25) : Rh;
      const drop = st.I * (Rh + Rret);
      const vl = 5 - drop;
      const P = st.I * st.I * (Rh + Rret);
      const J = st.I / (st.w * t);
      const squares = st.len / st.w;
      const Rs = phys.traceR(1, 1, t, 25);

      // visuals
      const px = clamp(st.w * 6, 1.5, 44);
      const col = PCB.tempColor(dT);
      setAttrs(trace, { 'stroke-width': px, stroke: col });
      setAttrs(glow, { 'stroke-width': px + 18, stroke: col, opacity: clamp((dT - 15) / 60, 0, 0.45), filter: '' });
      glow.style.filter = 'blur(6px)';
      const isTrace = st.ret === 'trace';
      plane.style.display = isTrace ? 'none' : '';
      planeTxt.style.display = isTrace ? 'none' : '';
      gtrace.style.display = isTrace ? '' : 'none';
      setAttrs(gtrace, { 'stroke-width': px, stroke: isTrace ? PCB.tempColor(dT) : 'var(--copper-dim)' });
      vSrc.textContent = '5.000 V';
      vLoad.textContent = vl.toFixed(3) + ' V';
      vLoad.setAttribute('fill', vl < 4.75 ? '#ff8a7a' : vl < 4.9 ? '#ffd166' : 'var(--silk)');
      vGnd.textContent = 'GND ' + (isTrace ? '+' + fmtSI(st.I * Rret, 'V', 3) : '≈ ' + fmtSI(st.I * Rret, 'V', 2));
      dim.textContent = `${st.len.toFixed(0)} mm × ${sig(st.w, 2)} mm = ${sig(squares, 3)} squares`;
      setAttrs(dim, { y: 88 + px / 2 + 16 });
      speed = 0.05 + st.I * 0.04;

      // meters
      M.set('R', fmtSI(Rh, 'Ω'), null);
      M.set('drop', fmtSI(drop, 'V'), drop > 0.25 ? 'bad' : drop > 0.1 ? 'warn' : 'good');
      M.set('vl', vl.toFixed(3) + ' V', vl < 4.75 ? 'bad' : vl < 4.9 ? 'warn' : 'good', (vl - 4.5) / 0.5);
      M.set('P', fmtSI(P, 'W'), P > 1 ? 'bad' : P > 0.25 ? 'warn' : null);
      M.set('dT', dT > 200 ? '> 200 °C' : sig(dT, 2) + ' °C', dT > 30 ? 'bad' : dT > 10 ? 'warn' : 'good', dT / 60);
      M.set('J', sig(J, 3) + ' A/mm²', J > 100 ? 'bad' : J > 35 ? 'warn' : null);

      const items = [];
      if (vl < 4.75) items.push({ level: 'bad', html: `Module sees <b>${vl.toFixed(2)} V</b>, below the 5 V −5% limit (4.75 V). Expect brown-out resets when the load steps up.` });
      else if (vl < 4.9) items.push({ level: 'warn', html: `Module sees <b>${vl.toFixed(2)} V</b>. Within tolerance, but you have used up margin the regulator and connector also need.` });
      else items.push({ level: 'good', html: `Module sees <b>${vl.toFixed(3)} V</b>. The drop is negligible.` });
      if (dT > 200) items.push({ level: 'bad', html: `The trace would heat by more than 200 °C, i.e. act as a fuse. A 0.15 mm trace is meant for milliamps.` });
      else if (dT > 30) items.push({ level: 'bad', html: `<b>+${sig(dT, 2)} °C</b>: the trace is a heater. Its resistance has risen ${sig((Rh / R25 - 1) * 100, 2)}% (copper ≈ +0.39%/°C, ROHM §1.5), so the drop gets worse as it warms.` });
      else if (dT > 10) items.push({ level: 'warn', html: `+${sig(dT, 2)} °C rise. Acceptable for many designs, but above Jones's comfortable 10 °C target.` });
      else items.push({ level: 'good', html: `+${sig(dT, 2)} °C rise. Cool.` });
      if (isTrace) items.push({ level: 'warn', html: `Ground at the module sits <b>${fmtSI(st.I * Rret, 'V')}</b> above the regulator's ground. Every signal between them now carries that offset (lesson 4).` });
      else items.push({ level: 'info', html: `The return current spreads through the plane, which is thousands of squares wide, so the ground drop is only ${fmtSI(st.I * Rret, 'V')}.` });
      V.set(items);
      E.set(`<p>This trace is <b>${sig(squares, 3)} squares</b> long. Each square of ${st.oz} oz copper is ${fmtSI(Rs, 'Ω')}, so R ≈ ${fmtSI(R25, 'Ω')} cold (${fmtSI(Rh, 'Ω')} at operating temperature).</p>
        <p>At ${sig(st.I, 2)} A that gives ${fmtSI(st.I * Rh, 'V')} of drop on the supply side and <b>${fmtSI(P, 'W')}</b> of heat in total. Resistance scales with length/width, so halving the width doubles the drop. Doubling the copper weight halves it.</p>`);
    }
    update();
  })();

  /* =================================================================
     1.2  Inductance and V = L di/dt
     ================================================================= */
  (function labInductance() {
    const host = document.getElementById('lab-l'); if (!host) return;
    const L = lab(host, { title: 'Trace inductance and the voltage it creates' });
    const st = { len: 20, w: 0.5, dI: 1, tr: 5, plane: false, h: 0.2 };
    const sLen = slider({ label: 'Trace length', min: 1, max: 100, step: 1, value: st.len, fmt: v => v + ' mm', onInput: v => { st.len = v; update(); } });
    const sW = slider({ label: 'Trace width', min: 0.1, max: 10, log: true, value: st.w, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.w = v; update(); } });
    const sI = slider({ label: 'Current change ΔI', min: 0.05, max: 10, log: true, value: st.dI, fmt: v => sig(v, 2) + ' A', onInput: v => { st.dI = v; update(); } });
    const sT = slider({ label: 'In time (edge) Δt', min: 0.2, max: 100, log: true, value: st.tr, fmt: v => sig(v, 2) + ' ns', onInput: v => { st.tr = v; update(); } });
    const cP = check({ label: 'Ground plane underneath (return path 0.2 mm below)', checked: false, onChange: v => { st.plane = v; update(); } });
    const preset = (o) => () => { Object.assign(st, o); sLen.set(st.len); sW.set(st.w); sI.set(st.dI); sT.set(st.tr); cP.set(st.plane); update(); };
    L.controls.append(sLen.el, sW.el, sI.el, sT.el, cP.el,
      el('div', { class: 'ctl-group-title' }, 'Scenarios'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: preset({ len: 10, w: 1, dI: 1, tr: 5, plane: false }) }, 'ROHM example (10 mm, 1 A / 5 ns)'),
        el('button', { class: 'btn', onclick: preset({ len: 30, w: 0.3, dI: 3, tr: 5, plane: false }) }, 'Buck cap 30 mm away'),
        el('button', { class: 'btn', onclick: preset({ len: 3, w: 0.3, dI: 0.5, tr: 0.5, plane: true }) }, 'IC ground pin, 3 mm')));

    const pW = new Plot(L.stage, { title: 'Inductance vs trace width (length fixed)', height: 190, xlog: true, ylog: true, xmin: 0.1, xmax: 10, xlabel: 'width [mm]', ylabel: 'nH', xfmt: v => sig(v, 2), yfmt: v => sig(v, 2) });
    const pT = new Plot(L.stage, { title: 'What happens during the current step', height: 190, xlabel: 'time [ns]', ylabel: 'volts', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [
      { key: 'L', label: 'Inductance' }, { key: 'lpm', label: 'per mm' }, { key: 'V', label: 'Spike V = L·ΔI/Δt' },
      { key: 'w2', label: '2× wider →' }, { key: 'l2', label: '½ as long →' },
    ]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const Liso = (len, w) => phys.partialL(len, w, 0.035);
    const Lpl = (len, w) => phys.microstrip(w, st.h).Lp * len;
    const Lof = (len, w) => (st.plane ? Lpl(len, w) : Liso(len, w));

    function update() {
      const Lnh = Lof(st.len, st.w);
      const Vpk = Lnh * st.dI / st.tr; // nH·A/ns = V
      const ws = [], yi = [], yp = [];
      for (let i = 0; i <= 60; i++) { const w = 0.1 * Math.pow(100, i / 60); ws.push(w); yi.push(Liso(st.len, w)); yp.push(Lpl(st.len, w)); }
      pW.draw({
        series: [
          { x: ws, y: yi, color: 'var(--accent)', label: 'trace alone (partial L)', width: st.plane ? 1.5 : 2.5, alpha: st.plane ? 0.5 : 1 },
          { x: ws, y: yp, color: 'var(--link)', label: 'loop with plane 0.2 mm below', width: st.plane ? 2.5 : 1.5, alpha: st.plane ? 1 : 0.5 },
        ],
        markers: [{ x: st.w, y: Lnh, color: st.plane ? 'var(--link)' : 'var(--accent)', r: 5, label: sig(Lnh, 3) + ' nH' }],
      });
      // time domain: ramp from tr to 2tr
      const T = st.tr * 4, ts = [], vs = [], is = [];
      for (let i = 0; i <= 400; i++) {
        const t = T * i / 400; ts.push(t);
        const u = (t - st.tr) / st.tr;
        is.push(clamp(u, 0, 1) * Vpk);
        vs.push(u >= 0 && u <= 1 ? Vpk : 0);
      }
      pT.draw({
        series: [
          { x: ts, y: is, color: 'var(--faint)', dash: [4, 4], width: 1.5, label: 'current (scaled)' },
          { x: ts, y: vs, color: 'var(--bad)', width: 2.5, label: 'induced voltage', fill: true, fillAlpha: 0.12 },
        ],
        hlines: Vpk > 0.09 ? [{ y: 0.09, color: 'var(--warn)', label: '±5% of a 1.8 V rail (90 mV)' }] : [],
        range: { ymin: 0, ymax: Math.max(Vpk * 1.25, 0.1) },
      });
      const r2 = Lof(st.len, st.w * 2) / Lnh, rl = Lof(st.len / 2, st.w) / Lnh;
      M.set('L', sig(Lnh, 3) + ' nH');
      M.set('lpm', sig(Lnh / st.len, 2) + ' nH/mm');
      M.set('V', fmtSI(Vpk, 'V'), Vpk > 0.3 ? 'bad' : Vpk > 0.05 ? 'warn' : 'good');
      M.set('w2', '×' + sig(r2, 2), 'warn');
      M.set('l2', '×' + sig(rl, 2), 'good');

      const items = [];
      if (Vpk > 0.3) items.push({ level: 'bad', html: `A <b>${fmtSI(Vpk, 'V')}</b> spike appears across this trace while the current changes. On a 1.8 V rail with ±5% tolerance (90 mV) that is ${sig(Vpk / 0.09, 2)}× the budget.` });
      else if (Vpk > 0.05) items.push({ level: 'warn', html: `${fmtSI(Vpk, 'V')} spike: noticeable on low-voltage rails (1.8 V, 1.0 V core supplies).` });
      else items.push({ level: 'good', html: `Only ${fmtSI(Vpk, 'V')}. Harmless at this edge rate.` });
      items.push({ level: 'info', html: `Doubling the width changes L by only ×${sig(r2, 2)}, while halving the length gives ×${sig(rl, 2)}. <b>Short beats wide.</b>` });
      if (!st.plane) items.push({ level: 'info', html: `Tick <b>Ground plane underneath</b>: the loop inductance drops to ${sig(Lpl(st.len, st.w), 3)} nH (×${sig(Lpl(st.len, st.w) / Lnh, 2)}) because the return current flows right under the trace.` });
      else items.push({ level: 'good', html: `With the return path 0.2 mm below, the two halves of the loop nearly cancel, and the plane does more than any width change could.` });
      V.set(items);
      E.set(`<p>If this trace is an IC's <b>ground connection</b>, the IC's internal 0 V jumps by ${fmtSI(Vpk, 'V')} each time its current changes: that is <b>ground bounce</b> (Sierra §2.3.7). If it is the path to a decoupling capacitor, the capacitor can't respond faster than this inductance allows (lesson 5).</p>
        <p>Faster edges make it worse: halve Δt and the spike doubles. ROHM notes that faster MOSFET edges cut switching loss but increase ringing for exactly this reason (§1.3).</p>`);
    }
    update();
  })();

  /* =================================================================
     1.3  Coupling: aggressor next to victim
     ================================================================= */
  (function labCoupling() {
    const host = document.getElementById('lab-x'); if (!host) return;
    const L = lab(host, { title: 'Aggressor trace next to a victim trace' });
    const AGG = {
      dc: { label: '5 A DC power rail', dI: 0, dV: 0, tr: 5e-9, short: 'DC rail' },
      loop: { label: 'Buck hot-loop current: 3 A step in 5 ns', dI: 3, dV: 0, tr: 5e-9, short: 'hot loop' },
      sw: { label: 'Buck switch node: 0→12 V in 5 ns', dI: 0, dV: 12, tr: 5e-9, short: 'switch node' },
      clk: { label: '3.3 V clock, 1 ns edges', dI: 0.066, dV: 3.3, tr: 1e-9, short: 'clock' },
    };
    const VIC = {
      logic: { label: 'Driven logic line (≈50 Ω source)', R: 50, bad: 0.4, warn: 0.15, what: 'a 3.3 V CMOS input (noise margin ≈ 0.4 V)' },
      fb: { label: 'Regulator feedback node (10 kΩ divider)', R: 10e3, bad: 0.016, warn: 0.004, what: 'the FB pin (0.8 V reference; 2% = 16 mV)' },
      adc: { label: 'Analog input (1 kΩ source, 12-bit ADC)', R: 1e3, bad: 0.008, warn: 0.0008, what: 'a 12-bit ADC on 3.3 V (1 LSB = 0.8 mV)' },
    };
    const st = { agg: 'sw', vic: 'fb', D: 1, H: 0.2, len: 30, plane: true, shield: false, guard: false, cross: false };

    const sAgg = seg({ label: 'Aggressor', options: Object.entries(AGG).map(([v, o]) => ({ v, label: o.short, title: o.label })), value: st.agg, onChange: v => { st.agg = v; update(); } });
    const sVic = seg({ label: 'Victim', options: [{ v: 'logic', label: 'logic line' }, { v: 'fb', label: 'FB node' }, { v: 'adc', label: 'ADC input' }], value: st.vic, onChange: v => { st.vic = v; update(); } });
    const sD = slider({ label: 'Spacing D (edge to edge)', min: 0.1, max: 10, log: true, value: st.D, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.D = v; update(); } });
    const sH = slider({ label: 'Height H above plane', min: 0.07, max: 1.6, log: true, value: st.H, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.H = v; update(); } });
    const sLen = slider({ label: 'Parallel run length', min: 2, max: 100, step: 1, value: st.len, fmt: v => v + ' mm', onInput: v => { st.len = v; update(); } });
    const cPlane = check({ label: 'Solid ground plane under both traces', checked: true, onChange: v => { st.plane = v; update(); } });
    const cShield = check({ label: 'Fix: move victim to an inner layer, with the GND plane between', onChange: v => { st.shield = v; update(); } });
    const cGuard = check({ label: 'Fix: grounded guard trace with stitching vias between', onChange: v => { st.guard = v; update(); } });
    const cCross = check({ label: 'Fix: cross at 90° instead of running in parallel', onChange: v => { st.cross = v; update(); } });
    L.controls.append(sAgg.el, sVic.el, sD.el, sH.el, sLen.el, cPlane.el, el('div', { class: 'ctl-group-title' }, 'Fixes'), cShield.el, cGuard.el, cCross.el);

    const aggTitle = el('div', { class: 'stage-hint' });
    L.stage.append(aggTitle);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 230' });
    L.stage.append(S, legend([['var(--copper)', 'copper'], ['var(--ret)', 'aggressor return current in plane'], ['#ffd166', 'magnetic field (di/dt)'], ['#7fc8ff', 'electric field (dv/dt)']]));
    const plot = new Plot(L.stage, { title: 'Noise at the victim during one aggressor edge', height: 190, xlabel: 'time [ns]', ylabel: 'mV', xfmt: v => sig(v, 3), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'k', label: 'Coupling k' }, { key: 'M', label: 'Mutual L' }, { key: 'Cm', label: 'Mutual C' }, { key: 'vL', label: 'Magnetic noise' }, { key: 'vC', label: 'Electric noise' }, { key: 'vT', label: 'Peak at victim' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Simplified coupled-microstrip model: k = 1/(1+(D/H)²) scaled onto each trace\'s own L and C. Good for trends and orders of magnitude, not sign-off.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    function compute() {
      const a = AGG[st.agg], v = VIC[st.vic];
      const Heff = st.plane ? st.H : 3; // without a plane the return is "somewhere" — far away
      let k = 1 / (1 + Math.pow((st.D + 0.575) / Heff, 2)); // centre-to-centre spacing
      if (st.shield) k *= 0.03;
      if (st.guard) k *= 0.35;
      const lenEff = st.cross ? 1.5 : st.len;
      const msA = phys.microstrip(1.0, Heff), msV = phys.microstrip(0.15, Heff);
      const Mnh = k * msA.Lp * lenEff;
      const CmpF = k * msV.Cp * lenEff;
      const Cv = msV.Cp * st.len + 3; // pF, incl. input
      const tau = v.R * (Cv + CmpF) * 1e-12;
      const Vind = Mnh * 1e-9 * a.dI / a.tr;
      const Ic = CmpF * 1e-12 * a.dV / a.tr;
      return { a, v, k, Mnh, CmpF, Cv, tau, Vind, Ic, Heff };
    }

    function update() {
      const c = compute();
      const { a, v } = c;
      aggTitle.innerHTML = `<b>${a.label}</b>  →  victim: ${v.label}`;
      // --- time-domain: edge from t0 to t0+tr
      const tr = a.tr, t0 = tr * 0.5;
      const win = tr * 2 + Math.max(4 * tr, Math.min(4 * c.tau, 400e-9));
      const n = 700, dt = win / n;
      const ts = [], vL = [], vC = [], vT = [];
      let vc = 0;
      const tauS = Math.max(c.tau, tr / 20);
      let vl = 0;
      for (let i = 0; i <= n; i++) {
        const t = i * dt;
        const on = t >= t0 && t <= t0 + tr;
        // capacitive: C dv/dt = Ic - v/R  (first order)
        vc += dt * ((on ? c.Ic * v.R : 0) - vc) / Math.max(c.tau, dt);
        // inductive: EMF during the edge, softened by the victim RC
        vl += dt * ((on ? c.Vind : 0) - vl) / Math.max(Math.min(tauS, tr / 3), dt);
        ts.push(t * 1e9); vL.push(vl * 1e3); vC.push(vc * 1e3); vT.push((vl + vc) * 1e3);
      }
      const pk = Math.max(...vT) / 1e3, pkL = Math.max(...vL) / 1e3, pkC = Math.max(...vC) / 1e3;
      plot.draw({
        series: [
          { x: ts, y: vL, color: '#d9a400', width: 1.5, dash: [5, 3], label: 'magnetic' },
          { x: ts, y: vC, color: 'var(--link)', width: 1.5, dash: [5, 3], label: 'electric' },
          { x: ts, y: vT, color: 'var(--bad)', width: 2.5, label: 'total', fill: true, fillAlpha: 0.1 },
        ],
        hlines: [{ y: v.bad * 1e3, color: 'var(--bad)', label: 'trouble' }, { y: v.warn * 1e3, color: 'var(--warn)', label: 'noticeable' }],
        xspans: [{ x0: t0 * 1e9, x1: (t0 + tr) * 1e9, color: 'var(--accent)', alpha: 0.12 }],
        range: { ymin: 0, ymax: Math.max(pk * 1e3 * 1.2, v.warn * 1e3 * 1.4) },
      });
      M.set('k', sig(c.k, 2));
      M.set('M', fmtSI(c.Mnh * 1e-9, 'H'));
      M.set('Cm', fmtSI(c.CmpF * 1e-12, 'F'));
      M.set('vL', fmtSI(pkL, 'V'), pkL > v.bad ? 'bad' : pkL > v.warn ? 'warn' : 'good');
      M.set('vC', fmtSI(pkC, 'V'), pkC > v.bad ? 'bad' : pkC > v.warn ? 'warn' : 'good');
      M.set('vT', fmtSI(pk, 'V'), pk > v.bad ? 'bad' : pk > v.warn ? 'warn' : 'good');
      drawSection(c);

      const items = [];
      if (st.agg === 'dc') {
        items.push({ level: 'good', html: `<b>No induced noise.</b> A steady 5 A makes a steady magnetic field, and a static field induces nothing (V = L·di/dt with di/dt = 0).` });
        items.push({ level: 'info', html: `A big DC trace can still hurt in other ways: heat, and voltage drop in a <i>shared ground path</i> (lesson 4). But running it next to a signal is electrically fine.` });
      } else {
        const lvl = pk > v.bad ? 'bad' : pk > v.warn ? 'warn' : 'good';
        const dom = pkL > pkC ? 'magnetic (di/dt)' : 'electric (dv/dt)';
        items.push({ level: lvl, html: `Peak noise <b>${fmtSI(pk, 'V')}</b> on ${v.what}. ${lvl === 'bad' ? 'This will cause errors.' : lvl === 'warn' ? 'Measurable; may matter.' : 'Below concern.'} The dominant mechanism is <b>${dom}</b>.` });
        if (st.vic !== 'logic' && pkC > pkL) items.push({ level: 'warn', html: `High-impedance victims hold injected charge: the time constant here is <b>${fmtSI(c.tau, 's')}</b>, so the noise lingers long after the ${fmtSI(a.tr, 's')} edge (see the tail on the plot).` });
        if (!st.plane) items.push({ level: 'bad', html: `Without a plane the return current is far away. Both loops are huge and the fields spread wide, so coupling is several times worse.` });
        if (st.guard && st.D < 0.5) items.push({ level: 'warn', html: `A guard trace needs room: at ${sig(st.D, 2)} mm spacing it won't fit with sensible clearances.` });
        if (st.shield) items.push({ level: 'good', html: `The plane between the layers blocks both fields. Layer assignment is the strongest fix you have.` });
      }
      V.set(items);
      E.set(`<p>Coupling k = 1/(1+(D/H)²) = <b>${sig(c.k, 2)}</b>. Doubling the spacing D once D ≫ H cuts it ~4×, and so does halving H. A thin dielectric to the plane is as good as spacing and costs no area.</p>
        <p>Magnetic noise ∝ M·di/dt (${fmtSI(c.Mnh * 1e-9, 'H')} × ${fmtSI(a.dI / a.tr, 'A/s')}). Electric noise ∝ C<sub>m</sub>·dv/dt into the victim's impedance (${fmtSI(v.R, 'Ω')}), so <b>high-impedance victims suffer most</b> from a switch node.</p>`);
    }

    // ---- cross-section drawing
    const g = svg('g'); S.append(g);
    function drawSection(c) {
      g.innerHTML = '';
      const sc = clamp(380 / (st.D + 3.2), 22, 60); // px per mm
      const top = 84;
      const vH = st.plane ? 16 + 84 * Math.log(st.H / 0.07) / Math.log(1.6 / 0.07) : 110; // vertical scale exaggerated
      const yPlane = top + vH;
      const xA = 150, wA = 1.0 * sc, wV = Math.max(0.15 * sc, 3);
      const xV = xA + wA / 2 + st.D * sc + wV / 2;
      const thick = 7;
      // dielectric
      g.append(svg('rect', { x: 0, y: top, width: 640, height: 230 - top, fill: '#1e4a37', opacity: 0.6 }));
      g.append(svg('text', { x: 12, y: 22, fill: '#cfe0d5', 'font-size': 11, text: 'Cross-section · vertical scale exaggerated' }));
      // plane + return current distribution
      if (st.plane) {
        g.append(svg('rect', { x: 0, y: yPlane, width: 640, height: 6, fill: 'var(--copper-dim)' }));
        g.append(svg('text', { x: 632, y: yPlane + 20, 'text-anchor': 'end', fill: 'var(--gnd)', 'font-size': 11, text: 'GND plane' }));
        if (st.agg !== 'dc') {
          for (let x = 0; x < 640; x += 4) {
            const d = (x - xA) / sc / st.H;
            const j = 1 / (1 + d * d);
            g.append(svg('rect', { x, y: yPlane - 1, width: 4, height: 8, fill: 'var(--ret)', opacity: (j * 0.95).toFixed(3) }));
          }
        }
      } else {
        g.append(svg('text', { x: 632, y: yPlane + 18, 'text-anchor': 'end', fill: '#ff9a8a', 'font-size': 11, text: 'no plane: return path is centimetres away' }));
      }
      const dIdt = c.a.dI / c.a.tr, dVdt = c.a.dV / c.a.tr;
      const mag = clamp(Math.log10(1 + dIdt / 1e7) / 2.5, 0, 1), elec = clamp(Math.log10(1 + dVdt / 1e8) / 2.5, 0, 1);
      // magnetic field rings
      const kk = c.k;
      for (let r = 1; r <= 5; r++) {
        const rx = r * (st.plane ? Math.max(14, vH * 0.6) : 30), ry = rx * (st.plane ? 0.7 : 0.9);
        g.append(svg('ellipse', { cx: xA, cy: top - 3, rx, ry, fill: 'none', stroke: '#ffd166', 'stroke-width': 1.3, opacity: (mag * 0.75 / r).toFixed(3) }));
      }
      // electric field arcs to victim and plane
      if (elec > 0) {
        for (let i = 0; i < 4; i++) {
          const h = 10 + i * 9;
          g.append(svg('path', { d: `M ${xA + wA / 2} ${top - 4} Q ${(xA + xV) / 2} ${top - 4 - h * 1.6} ${xV - wV / 2} ${top - 4}`, fill: 'none', stroke: '#7fc8ff', 'stroke-width': 1.2, opacity: (elec * 0.8 * clamp(kk * 3, 0.15, 1) / (1 + i * 0.5)).toFixed(3) }));
        }
        if (st.plane) for (let i = -2; i <= 2; i++) g.append(svg('line', { x1: xA + i * wA * 0.22, y1: top + 2, x2: xA + i * wA * 0.4, y2: yPlane, stroke: '#7fc8ff', 'stroke-width': 1, opacity: (elec * 0.55).toFixed(3) }));
      }
      // aggressor
      g.append(svg('rect', { x: xA - wA / 2, y: top - thick, width: wA, height: thick, fill: 'var(--copper)' }));
      g.append(svg('text', { x: xA, y: top - 14 - (mag > 0 ? 30 : 0), 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11.5, 'font-weight': 600, text: 'aggressor' }));
      // guard
      if (st.guard && !st.shield) {
        const xg = (xA + wA / 2 + xV - wV / 2) / 2;
        g.append(svg('rect', { x: xg - 3, y: top - thick, width: 6, height: thick, fill: 'var(--gnd)' }));
        if (st.plane) g.append(svg('rect', { x: xg - 1.5, y: top, width: 3, height: yPlane - top, fill: 'var(--gnd)', opacity: 0.7 }));
        g.append(svg('text', { x: xg, y: top + (yPlane - top) / 2 + 4, 'text-anchor': 'middle', fill: 'var(--gnd)', 'font-size': 10, text: st.plane ? '' : 'guard' }));
      }
      // victim
      if (st.shield && st.plane) {
        const yV = yPlane + 30;
        g.append(svg('rect', { x: xV - wV / 2, y: yV - thick, width: wV, height: thick, fill: 'var(--sig)' }));
        g.append(svg('text', { x: xV, y: yV + 16, 'text-anchor': 'middle', fill: 'var(--sig)', 'font-size': 11.5, 'font-weight': 600, text: 'victim (inner layer)' }));
      } else {
        g.append(svg('rect', { x: xV - wV / 2, y: top - thick, width: wV, height: thick, fill: 'var(--sig)' }));
        g.append(svg('text', { x: xV, y: top - 14, 'text-anchor': 'middle', fill: 'var(--sig)', 'font-size': 11.5, 'font-weight': 600, text: 'victim' }));
      }
      // dimension D
      const yd = top + 16;
      g.append(svg('line', { x1: xA + wA / 2, y1: yd, x2: xV - wV / 2, y2: yd, stroke: '#cfe0d5', 'stroke-width': 1, 'marker-start': '', opacity: 0.8 }));
      g.append(svg('text', { x: (xA + wA / 2 + xV - wV / 2) / 2, y: yd + 13, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: `D = ${sig(st.D, 2)} mm` }));
      if (st.plane) g.append(svg('text', { x: xA - wA / 2 - 6, y: (top + yPlane) / 2 + 4, 'text-anchor': 'end', fill: '#cfe0d5', 'font-size': 10.5, text: `H = ${sig(st.H, 2)} mm` }));
    }

    update();
  })();

  /* =================================================================
     1.4  Edge length vs trace length
     ================================================================= */
  (function labTline() {
    const host = document.getElementById('lab-t'); if (!host) return;
    const L = lab(host, { title: 'Is this trace a wire or a transmission line?' });
    const st = { tr: 0.1, len: 40, layer: 'outer' };
    const PRE = [
      ['I²C (≈100 ns)', 100], ['SPI 50 MHz (≈2 ns)', 2], ['RGMII (≈0.8 ns)', 0.8], ['USB 2.0 HS (≈0.5 ns)', 0.5],
      ['MIPI CSI (≈0.15 ns)', 0.15], ['DDR4 (≈0.1 ns)', 0.1], ['USB 3.2 Gen 2 (≈40 ps)', 0.04], ['PCIe Gen 4 (≈25 ps)', 0.025],
    ];
    const sT = slider({ label: 'Rise time', min: 0.02, max: 300, log: true, value: st.tr, fmt: v => fmtSI(v * 1e-9, 's'), onInput: v => { st.tr = v; update(); } });
    const sLen = slider({ label: 'Trace length', min: 2, max: 300, log: true, value: st.len, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.len = v; update(); } });
    const sLay = seg({ label: 'Layer', options: [{ v: 'outer', label: 'Outer (175 mm/ns)' }, { v: 'inner', label: 'Inner (150 mm/ns)' }], value: 'outer', onChange: v => { st.layer = v; update(); } });
    const pre = el('div', { class: 'btn-row' }, PRE.map(([t, tr]) => el('button', { class: 'btn', onclick: () => { st.tr = tr; sT.set(tr); update(); } }, t)));
    L.controls.append(sT.el, sLen.el, sLay.el, el('div', { class: 'ctl-group-title' }, 'Typical edges (approx.)'), pre);

    const wrap = el('div', { class: 'plot-wrap' });
    const cv = el('canvas', { class: 'viz board', style: { height: '200px' } });
    wrap.append(cv);
    L.stage.append(wrap, el('div', { class: 'stage-hint' }, 'Animation: the voltage along the trace as the edge launches from the driver (left). Timescale is slowed down.'));
    const M = meters(L.stage, [{ key: 'v', label: 'Velocity' }, { key: 'edge', label: 'Edge length' }, { key: 'crit', label: 'Critical length (edge/6)' }, { key: 'ratio', label: 'Trace / critical' }, { key: 'fk', label: 'Knee 0.35/tr' }, { key: 'fm', label: 'Sierra Fm 0.5/tr' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    let t0 = performance.now();
    const vel = () => (st.layer === 'outer' ? 175 : 150); // mm/ns
    function frame(ts) {
      const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = 200;
      if (!W) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = H * dpr; }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = PCB.cssVar('--board'); g.fillRect(0, 0, W, H);
      const x0 = 56, x1 = W - 56, yb = 128, amp = 70;
      const v = vel(), Tsim = st.tr + st.len / v; // ns
      const cycle = 2600, hold = 900;
      const ph = (ts - t0) % (cycle + hold);
      const t = PCB.reducedMotion() ? Tsim * 0.6 : Math.min(ph, cycle) / cycle * Tsim;
      // profile
      g.beginPath(); g.moveTo(x0, yb);
      for (let px = x0; px <= x1; px += 2) {
        const x = (px - x0) / (x1 - x0) * st.len;
        const Vn = clamp((t - x / v) / st.tr, 0, 1);
        g.lineTo(px, yb - Vn * amp);
      }
      g.lineTo(x1, yb); g.closePath();
      g.fillStyle = 'rgba(92,184,255,0.22)'; g.fill();
      g.beginPath();
      for (let px = x0; px <= x1; px += 2) {
        const x = (px - x0) / (x1 - x0) * st.len;
        const Vn = clamp((t - x / v) / st.tr, 0, 1);
        px === x0 ? g.moveTo(px, yb - Vn * amp) : g.lineTo(px, yb - Vn * amp);
      }
      g.strokeStyle = '#5cb8ff'; g.lineWidth = 2.5; g.stroke();
      // trace
      g.fillStyle = PCB.cssVar('--copper'); g.fillRect(x0, yb, x1 - x0, 5);
      // driver + receiver
      g.fillStyle = '#e8ece6';
      g.beginPath(); g.moveTo(x0 - 30, yb - 12); g.lineTo(x0 - 4, yb + 2); g.lineTo(x0 - 30, yb + 16); g.closePath(); g.fill();
      g.fillRect(x1 + 6, yb - 10, 22, 26);
      g.font = '11px ' + PCB.cssVar('--sans'); g.fillStyle = '#cfe0d5';
      g.textAlign = 'left'; g.fillText('driver', 8, yb + 34);
      g.textAlign = 'right'; g.fillText('receiver', W - 6, yb + 34);
      g.textAlign = 'left'; g.fillText(`t = ${fmtSI(t * 1e-9, 's')}`, 12, 20);
      g.textAlign = 'right'; g.fillText(`trace = ${sig(st.len, 3)} mm`, W - 12, 20);
      // edge-length bar
      const edge = st.tr * v, frac = edge / st.len;
      const yb2 = yb + 50, barEnd = x0 + Math.min(frac, 1) * (x1 - x0);
      g.fillStyle = '#ffd166'; g.fillRect(x0, yb2, barEnd - x0, 6);
      g.textAlign = 'left'; g.fillStyle = '#ffd166';
      g.fillText(frac > 1 ? `edge length ${sig(edge, 3)} mm: ${sig(frac, 2)}× longer than the trace →` : `edge length ${sig(edge, 3)} mm`, x0, yb2 - 6);
    }
    PCB.whenVisible(cv, frame);

    function update() {
      const v = vel(), edge = st.tr * v, crit = edge / 6, ratio = st.len / crit;
      M.set('v', v + ' mm/ns');
      M.set('edge', sig(edge, 3) + ' mm');
      M.set('crit', sig(crit, 3) + ' mm');
      M.set('ratio', sig(ratio, 2) + '×', ratio > 1 ? 'warn' : ratio > 0.5 ? 'warn' : 'good');
      M.set('fk', fmtSI(0.35 / (st.tr * 1e-9), 'Hz'));
      M.set('fm', fmtSI(0.5 / (st.tr * 1e-9), 'Hz'));
      t0 = performance.now();
      const items = [];
      if (ratio < 0.5) items.push({ level: 'good', html: `<b>Lumped.</b> The edge is ${sig(edge / st.len, 2)}× longer than the trace, so the whole trace rises together. Reflections settle within the rise time. Care about R, L and crosstalk, not impedance.` });
      else if (ratio < 1) items.push({ level: 'warn', html: `<b>Borderline.</b> Reflections begin to show as small overshoot and ringing. Keep it short or add a series termination resistor at the driver.` });
      else items.push({ level: 'warn', html: `<b>Transmission line.</b> The edge travels along the trace (${sig(ratio, 2)}× the critical length). Any impedance change (via, stub, connector, plane gap) reflects part of it. Route as <b>controlled impedance</b> and terminate (lessons 7–8).` });
      items.push({ level: 'info', html: `Highest significant frequency ≈ 0.35/t<sub>r</sub> = ${fmtSI(0.35 / (st.tr * 1e-9), 'Hz')}. Sierra uses the more conservative 0.5/t<sub>r</sub> = ${fmtSI(0.5 / (st.tr * 1e-9), 'Hz')}. Above 50 MHz, Sierra calls it a high-speed design.` });
      V.set(items);
      E.set(`<p>What decides the behaviour is the <b>rise time</b>, not the clock frequency. A 1 MHz signal with a 100 ps edge has the same layout needs as a 1 GHz one.</p>
        <p>Rule: critical length = t<sub>r</sub> × v / 6. Sierra's version (length &gt; λ/12 at F<sub>m</sub> = 0.5/t<sub>r</sub>) works out to the same number. Try a 40 mm trace with each preset to see which interfaces on a carrier board need impedance control.</p>`);
    }
    update();
  })();

  /* ================================================================= quiz */
  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'You double the width of a 20 mm trace. Its partial inductance…', opts: ['halves', 'drops by only ~10–15%', 'doubles', 'is unchanged'], a: 1, ex: 'Inductance depends on width only through a logarithm (ROHM §1.6). To reduce it, shorten the path or bring the return path (a plane) closer.' },
    { q: 'A 5 A DC rail runs 0.5 mm from an I²C line for 40 mm. What is the main electrical concern?', opts: ['Strong inductive noise on I²C', 'Capacitive coupling of the 5 A into the I²C line', 'Nothing from coupling: DC makes no changing field. Watch heat and any shared ground return.'], a: 2, ex: 'V = M·di/dt and I = C·dv/dt are both zero for steady DC. The real risks of a big DC current are temperature rise and voltage drop in a shared ground path.' },
    { q: 'Which victim is most vulnerable to a buck converter\'s switch node (large dv/dt)?', opts: ['A 50 Ω-driven clock line', 'The regulator\'s high-impedance feedback divider node', 'A solid ground pour'], a: 1, ex: 'Capacitively coupled current I = C<sub>m</sub>·dv/dt turns into voltage across the victim\'s impedance. 10 kΩ gives 200× the voltage of 50 Ω, and the noise lingers for the RC time. That is why ROHM insists the FB trace stays short and away from the switch node.' },
    { q: 'A 100 ps edge travels a 40 mm outer-layer trace. Lumped or transmission line?', opts: ['Lumped: 40 mm is short', 'Transmission line: the edge is ~17.5 mm long, critical length ~3 mm', 'Depends only on the clock frequency'], a: 1, ex: 'Edge length = 0.1 ns × 175 mm/ns = 17.5 mm; critical ≈ 17.5/6 ≈ 2.9 mm. 40 mm is ~14× that, so it needs controlled impedance.' },
  ]);
})();
