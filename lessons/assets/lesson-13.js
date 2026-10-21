/* Lesson 13 — DFM & "who's right?" */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, legend } = PCB;
  PCB.renderChrome({ lesson: 13 });

  /* =================================================================
     13.1  Fab capability
     ================================================================= */
  (function labFab() {
    const host = document.getElementById('lab-fab'); if (!host) return;
    const L = lab(host, { title: 'Pick the dimensions, see the fab class and cost' });
    const st = { tw: 5, ts: 5, via: 'th', drill: 0.3, pad: 0.6, thick: 1.6, qfn: 0.25, edge: 0.4, vip: 'none' };
    const CLS = ['standard', 'advanced', 'HDI', 'not buildable'];
    const sTw = slider({ label: 'Trace width', min: 2, max: 8, step: 0.25, value: st.tw, fmt: v => `${sig(v, 3)} mil (${sig(v * 0.0254, 2)} mm)`, onInput: v => { st.tw = v; update(); } });
    const sTs = slider({ label: 'Trace-to-trace space', min: 2, max: 8, step: 0.25, value: st.ts, fmt: v => `${sig(v, 3)} mil`, onInput: v => { st.ts = v; update(); } });
    const sVia = seg({ label: 'Via type', options: [{ v: 'th', label: 'drilled through-hole' }, { v: 'mv', label: 'laser microvia (1 layer)' }], value: st.via, onChange: v => { st.via = v; update(); } });
    const sDr = slider({ label: 'Via drill (finished)', min: 0.1, max: 0.45, step: 0.01, value: st.drill, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.drill = v; update(); } });
    const sPd = slider({ label: 'Via pad diameter', min: 0.2, max: 0.9, step: 0.01, value: st.pad, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.pad = v; update(); } });
    const sTh = slider({ label: 'Board thickness', min: 0.8, max: 3.2, step: 0.1, value: st.thick, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.thick = v; update(); } });
    const sQ = slider({ label: 'QFN pad width (0.5 mm pitch)', min: 0.2, max: 0.35, step: 0.005, value: st.qfn, fmt: v => sig(v, 3) + ' mm', onInput: v => { st.qfn = v; update(); } });
    const sE = slider({ label: 'Copper to board edge', min: 0.1, max: 1, step: 0.05, value: st.edge, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.edge = v; update(); } });
    const sVip = seg({ label: 'Vias inside BGA/QFN pads', options: [{ v: 'none', label: 'none (dog-bone)' }, { v: 'open', label: 'open via in pad' }, { v: 'vippo', label: 'filled + capped (VIPPO)' }], value: st.vip, onChange: v => { st.vip = v; update(); } });
    L.controls.append(sTw.el, sTs.el, sVia.el, sDr.el, sPd.el, sTh.el, sQ.el, sE.el, sVip.el);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 360', style: 'background:var(--surface-2)' });
    L.stage.append(S);
    const M = meters(L.stage, [{ key: 'cls', label: 'Fab class needed' }, { key: 'cost', label: 'Relative board cost' }, { key: 'tight', label: 'At the limit' }, { key: 'asm', label: 'Assembly risks' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Capability limits are typical of mid-range fabs (standard: 5/5 mil, 0.3 mm drill, 0.15 mm ring, 8:1; advanced: 3.5/3.5 mil, 0.2 mm, 0.1 mm, 10:1). Costs are rough multipliers for a 6-layer board. Use your own fab\'s table.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const lvl = c => (c === 0 ? 'good' : c === 1 ? 'warn' : 'bad');
    function update() {
      const checks = [];
      const add = (name, cls, val, note, tight) => checks.push({ name, cls, val, note, tight });
      const twC = st.tw >= 5 ? 0 : st.tw >= 3.5 ? 1 : st.tw >= 2.5 ? 2 : 3;
      const tsC = st.ts >= 5 ? 0 : st.ts >= 3.5 ? 1 : st.ts >= 2.5 ? 2 : 3;
      add('Trace width', twC, `${sig(st.tw, 3)} mil`, 'Narrow traces need thinner starting copper and tighter etch control.', [5, 3.5, 2.5].some(x => st.tw >= x && st.tw < x * 1.1));
      add('Spacing', tsC, `${sig(st.ts, 3)} mil`, 'Tight gaps risk etch shorts (copper slivers left between traces).', [5, 3.5, 2.5].some(x => st.ts >= x && st.ts < x * 1.1));
      const ring = (st.pad - st.drill) / 2;
      let drC, arC = 0, ar;
      if (st.via === 'th') {
        drC = st.drill >= 0.3 ? 0 : st.drill >= 0.2 ? 1 : st.drill >= 0.15 ? 2 : 3;
        ar = st.thick / st.drill;
        arC = ar <= 8 ? 0 : ar <= 10 ? 1 : ar <= 12 ? 2 : 3;
        add('Drill', drC, `${sig(st.drill, 2)} mm`, st.drill < 0.15 ? 'Below what mechanical drills do reliably: this needs a laser.' : 'Smaller bits are slower, break more and cost more per hole.', false);
        add('Aspect ratio', arC, `${sig(ar, 2)} : 1`, 'Plating has to reach the middle of the hole: deep, narrow holes plate thin in the middle and crack under thermal cycling (Sierra: ≤ 10:1).', ar > 7 && ar <= 8 || ar > 9 && ar <= 10);
      } else {
        drC = 2; ar = 0.1 / st.drill;
        arC = ar <= 0.75 ? 2 : 3;
        add('Microvia', 2, `${sig(st.drill, 2)} mm laser`, 'Laser vias span one thin dielectric and need sequential lamination: an HDI process.', false);
        add('Microvia aspect', arC, `${sig(ar, 2)} : 1`, 'Microvias must be shallower than they are wide (Sierra: ≤ 0.75:1) so plating can fill them.', false);
      }
      const ringC = ring >= 0.15 ? 0 : ring >= 0.1 ? 1 : ring >= 0.075 ? 2 : 3;
      add('Annular ring', ringC, `${sig(ring * 1000, 3)} µm`, 'Drill wander can break out of a thin ring: the hole lands partly outside its pad (Jones: "breakouts").', [0.15, 0.1].some(x => ring >= x && ring < x * 1.15));
      const dam = 0.5 - st.qfn - 0.1;
      const damC = dam >= 0.1 ? 0 : dam >= 0.075 ? 1 : 3;
      const edgeC = st.edge >= 0.3 ? 0 : st.edge >= 0.2 ? 1 : 3;
      add('Copper to edge', edgeC, `${sig(st.edge, 2)} mm`, 'Routing or scoring the outline can expose or smear copper that is too close.', false);
      const fabC = Math.max(...checks.map(c => Math.min(c.cls, 3)));
      const buildable = fabC < 3;
      let cost = [1, 1.35, 2.2, NaN][fabC];
      if (st.vip === 'vippo') cost *= 1.18;
      if (st.via === 'th' && ar > 10 && ar <= 12) cost *= 1.15;
      const asm = [];
      if (damC === 3) asm.push('no solder-mask dam between QFN pads');
      else if (damC === 1) asm.push('thin mask dam');
      if (st.vip === 'open') asm.push('open vias in pads wick solder');
      // ---------- drawing
      S.innerHTML = '';
      const panel = (x, y, w, h, title, c) => { S.append(svg('rect', { x, y, width: w, height: h, rx: 8, fill: 'var(--surface)', stroke: c === 3 ? 'var(--bad)' : c === 2 ? 'var(--warn)' : c === 1 ? 'var(--warn)' : 'var(--border)', 'stroke-width': c ? 2 : 1 }), svg('text', { x: x + 10, y: y + 18, 'font-size': 11.5, 'font-weight': 650, fill: 'var(--text)', text: title })); };
      const dim = (x1, y1, x2, y2, t, c = 'var(--muted)', above = true) => S.append(svg('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': 1 }), svg('text', { x: (x1 + x2) / 2 + (x1 === x2 ? 6 : 0), y: (y1 + y2) / 2 + (x1 === x2 ? 4 : above ? -4 : 12), 'text-anchor': x1 === x2 ? 'start' : 'middle', 'font-size': 10, 'font-family': 'var(--mono)', fill: c, text: t }));
      const ccol = c => (c === 3 ? 'var(--bad)' : c ? 'var(--warn)' : 'var(--good)');
      // (a) traces
      panel(10, 10, 305, 165, `Traces: ${CLS[Math.max(twC, tsC)]}`, Math.max(twC, tsC));
      const k = 4; // px per mil
      const yA = 42;
      S.append(svg('rect', { x: 30, y: yA, width: 265, height: st.tw * k, fill: '#e0a64a' }), svg('rect', { x: 30, y: yA + (st.tw + st.ts) * k, width: 265, height: st.tw * k, fill: '#e0a64a' }));
      dim(250, yA, 250, yA + st.tw * k, `${sig(st.tw, 2)}`, ccol(twC));
      dim(272, yA + st.tw * k, 272, yA + (st.tw + st.ts) * k, `${sig(st.ts, 2)}`, ccol(tsC));
      S.append(svg('text', { x: 30, y: 168, 'font-size': 10, fill: 'var(--faint)', text: 'mil (1 mil = 25.4 µm). Standard ≥ 5, advanced ≥ 3.5' }));
      // (b) via
      const viaC = Math.max(drC, arC, ringC);
      panel(325, 10, 305, 165, `Via: ${CLS[viaC]}`, viaC);
      const vs = 120; // px per mm
      const vcx = 400, vcy = 95;
      S.append(svg('circle', { cx: vcx, cy: vcy, r: st.pad / 2 * vs, fill: '#e0a64a' }), svg('circle', { cx: vcx, cy: vcy, r: st.drill / 2 * vs, fill: '#333' }));
      S.append(svg('line', { x1: vcx + st.drill / 2 * vs, y1: vcy, x2: vcx + st.pad / 2 * vs, y2: vcy, stroke: ccol(ringC), 'stroke-width': 2 }));
      S.append(svg('text', { x: vcx, y: 166, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'var(--mono)', fill: ccol(ringC), text: `annular ring ${Math.round(ring * 1000)} µm` }));
      // cross-section
      const csx = 520, csy = 34, ch = 125;
      const scale = ch / Math.max(st.thick, 1);
      const hh = st.via === 'th' ? st.thick * scale : 0.1 * scale * 6;
      const ww = Math.max(4, st.drill * scale * (st.via === 'th' ? 1 : 6));
      S.append(svg('rect', { x: csx - 45, y: csy, width: 90, height: st.via === 'th' ? hh : 60, fill: '#9b8f6a', opacity: 0.5 }), svg('rect', { x: csx - ww / 2 - 3, y: csy, width: ww + 6, height: hh, fill: '#e0a64a' }), svg('rect', { x: csx - ww / 2, y: csy, width: ww, height: hh, fill: 'var(--surface)' }));
      S.append(svg('text', { x: csx, y: csy + Math.max(hh, 60) + 12, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'var(--mono)', fill: ccol(arC), text: `aspect ${sig(ar, 2)}:1` }));
      // (c) QFN pads
      panel(10, 185, 305, 165, `QFN mask dam: ${damC === 0 ? 'OK' : damC === 1 ? 'thin' : 'none possible'}`, damC === 3 ? 2 : damC);
      const qs = 160; // px per mm
      const qx = 50, qy = 222;
      for (let i = 0; i < 3; i++) {
        const x = qx + i * 0.5 * qs;
        S.append(svg('rect', { x: x - 0.05 * qs, y: qy - 0.05 * qs, width: (st.qfn + 0.1) * qs, height: 0.6 * qs, fill: 'var(--surface-2)' }));
        S.append(svg('rect', { x, y: qy, width: st.qfn * qs, height: 0.5 * qs, fill: '#e0a64a' }));
      }
      for (let i = 0; i < 2; i++) {
        const x = qx + i * 0.5 * qs + (st.qfn + 0.05) * qs;
        if (dam > 0) S.append(svg('rect', { x, y: qy - 0.05 * qs, width: dam * qs, height: 0.6 * qs, fill: damC === 3 ? '#9a3b2c' : '#2f7d4f', opacity: 0.9 }));
      }
      S.append(svg('text', { x: 30, y: 342, 'font-size': 10, fill: 'var(--faint)', text: `green = solder-mask dam ${dam > 0 ? Math.round(dam * 1000) + ' µm' : '(none)'} · pale = mask opening (50 µm per side)` }));
      // (d) edge
      panel(325, 185, 305, 165, `Board edge: ${CLS[edgeC] === 'not buildable' ? 'too close' : 'OK'}`, edgeC === 3 ? 2 : edgeC);
      const es = 120;
      const ex = 600;
      S.append(svg('rect', { x: 345, y: 215, width: ex - 345, height: 120, fill: '#2f7d4f', opacity: 0.35 }), svg('line', { x1: ex, y1: 210, x2: ex, y2: 340, stroke: 'var(--text)', 'stroke-width': 2, 'stroke-dasharray': '6 3' }), svg('text', { x: ex - 4, y: 230, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)', text: 'outline' }));
      S.append(svg('rect', { x: 360, y: 245, width: ex - 360 - st.edge * es, height: 70, fill: '#e0a64a', opacity: 0.9 }));
      dim(ex - st.edge * es, 330, ex, 330, `${sig(st.edge, 2)} mm`, ccol(edgeC));
      // ---------- meters/verdicts
      M.set('cls', buildable ? CLS[fabC] : 'not buildable', lvl(Math.min(fabC, 2) + (buildable ? 0 : 1)));
      M.set('cost', buildable ? `× ${sig(cost, 3)}` : '—', !buildable ? 'bad' : cost > 2 ? 'bad' : cost > 1.2 ? 'warn' : 'good');
      const tight = checks.filter(c => c.tight).map(c => c.name);
      M.set('tight', tight.length ? tight.length + ' param' + (tight.length > 1 ? 's' : '') : 'none', tight.length ? 'warn' : 'good');
      M.set('asm', asm.length ? String(asm.length) : 'none', asm.length ? (st.vip === 'open' || damC === 3 ? 'bad' : 'warn') : 'good');
      const items = [];
      if (!buildable) checks.filter(c => c.cls === 3).forEach(c => items.push({ level: 'bad', html: `<b>${c.name} ${c.val}</b>: beyond what this class of fab builds. ${c.note}` }));
      checks.filter(c => c.cls === 1 || c.cls === 2).forEach(c => items.push({ level: 'warn', html: `<b>${c.name} ${c.val}</b> needs the ${CLS[c.cls]} process. ${c.note}` }));
      if (tight.length) items.push({ level: 'info', html: `Right at a class limit: ${tight.join(', ')}. Designs that sit exactly on the limit have lower yield; leave ~10% where you can.` });
      if (damC === 3) items.push({ level: 'bad', html: 'The pads are too close for a mask dam, so the fab opens the mask across the whole row ("gang relief"). Solder can now bridge neighbouring pins.' });
      if (st.vip === 'open') items.push({ level: 'bad', html: 'An open via in a solder pad drains the solder paste down the hole during reflow: voids, starved joints and a solder bump on the other side. Sierra: via-in-pad must be filled (except in thermal pads).' });
      if (st.vip === 'vippo') items.push({ level: 'info', html: 'VIPPO (filled, planarised, plated over) makes the pad flat and solderable, and lets a 0.5 mm BGA escape without dog-bones. It adds a few process steps to the cost.' });
      if (!items.length) items.push({ level: 'good', html: 'Everything sits inside the standard column with some margin: the cheapest, highest-yield board you can order.' });
      V.set(items);
      E.set('<p>Each dimension maps to a physical process step: etching (trace/space), drilling (drill size, positional tolerance → annular ring), plating (aspect ratio), solder-mask imaging (dam), outline routing (edge clearance).</p><p>The board is priced by its <b>hardest</b> feature: one 3-mil gap or one 0.15 mm drill moves the whole panel into the more expensive process. That is why you design to standard rules everywhere except under the one part that forces you not to.</p>');
    }
    update();
  })();

  /* =================================================================
     13.2  Thermal relief & tombstoning
     ================================================================= */
  (function labRelief() {
    const host = document.getElementById('lab-relief'); if (!host) return;
    const L = lab(host, { title: 'Reflow a small resistor: one pad on a GND plane, one on a thin trace' });
    const st = { conn: 'solid', spoke: 0.25, size: '0402', cu: 2, sym: false, t: 0, playing: true };
    const sC = seg({ label: 'Pad A to the GND plane', options: [{ v: 'solid', label: 'solid' }, { v: 'r4', label: '4-spoke relief' }, { v: 'r2', label: '2-spoke relief' }], value: st.conn, onChange: v => { st.conn = v; compute(); } });
    const sSp = slider({ label: 'Spoke width', min: 0.15, max: 0.6, step: 0.05, value: st.spoke, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.spoke = v; compute(); } });
    const sSz = seg({ label: 'Part size', options: ['0201', '0402', '0603'].map(v => ({ v, label: v })), value: st.size, onChange: v => { st.size = v; compute(); } });
    const sCu = seg({ label: 'GND copper tied to pad A', options: [{ v: 1, label: '1 plane' }, { v: 2, label: '2 planes' }, { v: 6, label: '3 planes, 2 oz' }], value: st.cu, onChange: v => { st.cu = v; compute(); } });
    const cSym = check({ label: 'Balance pad B: connect it to a pour with the same style', onChange: v => { st.sym = v; compute(); } });
    const play = el('button', { class: 'btn', onclick: () => { st.playing = !st.playing; play.textContent = st.playing ? 'Pause oven' : 'Run oven'; } }, 'Pause oven');
    const restart = el('button', { class: 'btn', onclick: () => { st.t = 0; st.playing = true; play.textContent = 'Pause oven'; } }, 'Restart');
    L.controls.append(sC.el, sSp.el, sSz.el, sCu.el, cSym.el, el('div', { class: 'btn-row' }, play, restart));
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 200' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Reflow profile: oven, plane and the two pads', height: 220, xmin: 0, xmax: 320, xlabel: 's', ylabel: '°C', xfmt: v => sig(v, 3), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'dt', label: 'Wetting time difference' }, { key: 'pk', label: 'Pad A peak' }, { key: 'risk', label: 'Tombstone risk' }, { key: 'amp', label: 'Spokes carry (+20 °C)' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Lumped thermal model: each pad heats from the oven air and leaks heat to whatever copper it is tied to; the plane lags the oven by its thermal mass. SAC305 liquidus 217 °C. Tombstone threshold (time one end may be molten alone): 0201 ≈ 3 s, 0402 ≈ 5 s, 0603 ≈ 9 s. Illustrative.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const PROF = [[0, 25], [90, 150], [180, 180], [215, 245], [235, 245], [275, 180], [320, 100]];
    const oven = t => { for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const [a, ta] = PROF[i - 1], [b, tb] = PROF[i]; return ta + (tb - ta) * (t - a) / (b - a); } return 100; };
    let R = null;
    function compute() {
      const tauPad = { '0201': 3, '0402': 4, '0603': 6 }[st.size];
      const mass = 4 / tauPad;
      const kRel = n => n * (st.spoke / 0.25) * 0.015;
      const kA = (st.conn === 'solid' ? 0.45 : kRel(st.conn === 'r4' ? 4 : 2)) * mass * Math.sqrt(st.cu / 2);
      const kB = st.sym ? kA : 0.008 * mass;
      const kb = 0.02;
      const tauP = 10 + 8 * st.cu;
      const dt = 0.05;
      let To, Tp = 25, Ta = 25, Tb = 25;
      const ts = [], so = [], sp = [], sa = [], sb = [];
      let tA = NaN, tB = NaN, pkA = 0, pkB = 0;
      for (let i = 0, t = 0; t <= 320; i++, t = i * dt) {
        To = oven(t);
        Tp += dt * (To - Tp) / tauP;
        const dA = (To - Ta) / tauPad + kA * (Tp - Ta) + kb * (Tb - Ta);
        const dB = (To - Tb) / tauPad + kB * (Tp - Tb) + kb * (Ta - Tb);
        Ta += dt * dA; Tb += dt * dB;
        if (isNaN(tA) && Ta >= 217) tA = t; if (isNaN(tB) && Tb >= 217) tB = t;
        pkA = Math.max(pkA, Ta); pkB = Math.max(pkB, Tb);
        if (i % 8 === 0) { ts.push(t); so.push(To); sp.push(Tp); sa.push(Ta); sb.push(Tb); }
      }
      const thr = { '0201': 3, '0402': 5, '0603': 9 }[st.size];
      const dW = isNaN(tA) || isNaN(tB) ? Infinity : Math.abs(tA - tB);
      R = { ts, so, sp, sa, sb, tA, tB, pkA, pkB, dW, thr, first: isNaN(tA) ? 'B' : isNaN(tB) ? 'A' : tA < tB ? 'A' : 'B' };
      const risk = dW >= thr ? 'bad' : dW >= thr / 2 ? 'warn' : 'good';
      M.set('dt', isFinite(dW) ? sig(dW, 2) + ' s' : 'never both', risk);
      M.set('pk', sig(pkA, 3) + ' °C', pkA < 217 ? 'bad' : pkA < 230 ? 'warn' : 'good');
      M.set('risk', risk === 'bad' ? 'high' : risk === 'warn' ? 'moderate' : 'low', risk);
      // spoke current capacity (IPC external, conservative for short spokes)
      if (st.conn === 'solid') M.set('amp', 'n/a (solid)');
      else { const n = st.conn === 'r4' ? 4 : 2; const A = (n * st.spoke / 0.0254) * (0.035 / 0.0254); const I = 0.048 * Math.pow(20, 0.44) * Math.pow(A, 0.725); M.set('amp', '≈ ' + sig(I, 2) + ' A', I < 1 ? 'warn' : 'good'); }
      const items = [];
      if (pkA < 217) items.push({ level: 'bad', html: `Pad A never melts (peak ${Math.round(pkA)} °C): the plane soaks up the heat. That is an <b>open joint</b>, Jones' "dry joint".` });
      else if (pkA < 230) items.push({ level: 'warn', html: `Pad A only peaks at ${Math.round(pkA)} °C, barely above liquidus. Wetting is poor and the joint may be grainy or weak.` });
      if (risk !== 'good' && isFinite(dW)) items.push({ level: risk, html: `Pad ${R.first} melts ${sig(dW, 2)} s before the other. For ${sig(dW, 2)} s, surface tension on one end is free to pull the ${st.size} upright ${risk === 'bad' ? '→ <b>tombstone</b>' : '(it may twist or partly lift)'}. Smaller parts tolerate less imbalance.` });
      if (risk === 'good' && pkA >= 230) items.push({ level: 'good', html: `Both ends melt within ${sig(dW, 2)} s of each other and reach a good peak. The part self-centres on its pads.` });
      if (st.conn === 'solid') items.push({ level: 'info', html: 'A solid connection to a plane is the best electrical and thermal path in operation, and the worst during soldering.' });
      if (st.conn !== 'solid' && st.spoke < 0.2) items.push({ level: 'info', html: 'Very thin spokes solder easily but limit current and can be etched away. Around 0.25 mm is typical; widen them for power pads.' });
      if (st.sym) items.push({ level: 'info', html: 'Matching the thermal load on both pads is the other half of the fix: symmetric copper, symmetric relief.' });
      V.set(items);
      E.set('<p>During reflow, heat flows from the oven air into each pad, and from each pad into whatever copper it touches. A plane is a big thermal mass that lags the oven by tens of seconds, so a pad tied solidly to it stays cooler and melts last.</p><p>Thermal relief replaces the solid connection with a few narrow spokes. That cuts the heat leak by ~10× while adding only a fraction of a milliohm and a few hundredths of a nH, negligible next to the via (lesson 5). That is why it is the default for soldered pads, and unnecessary for vias.</p>');
      drawTop();
    }
    const gTop = svg('g'), gSide = svg('g');
    S.append(gTop, gSide);
    function drawTop() {
      gTop.innerHTML = '';
      const sz = { '0201': [0.6, 0.3], '0402': [1.0, 0.5], '0603': [1.6, 0.8] }[st.size];
      const k = 60; // px/mm
      const cx = 170, cy = 105;
      const pw = sz[1] * 1.1 * k, ph = sz[1] * 1.2 * k, gap = sz[0] * 0.45 * k;
      gTop.append(svg('rect', { x: 10, y: 10, width: 320, height: 180, rx: 8, fill: '#0f3526' }), svg('text', { x: 20, y: 28, fill: '#9fb5a8', 'font-size': 10.5, text: 'top view' }));
      // plane region on the left
      gTop.append(svg('rect', { x: 20, y: 40, width: cx - gap / 2 - pw / 2 + 4, height: 140, fill: '#e0a64a', opacity: 0.85 }));
      const ax = cx - gap / 2 - pw, bx = cx + gap / 2;
      const clr = 0.25 * k;
      if (st.conn !== 'solid') {
        gTop.append(svg('rect', { x: ax - clr, y: cy - ph / 2 - clr, width: pw + 2 * clr, height: ph + 2 * clr, fill: '#0f3526' }));
        const sw = st.spoke * k, n = st.conn === 'r4' ? 4 : 2;
        const spokes = n === 4 ? [[-1, 0], [0, -1], [0, 1], [1, 0]] : [[-1, 0], [0, -1]];
        spokes.forEach(([dx, dy]) => { if (dx === 1) return; const x = dx ? (dx < 0 ? ax - clr : ax + pw) : ax + pw / 2 - sw / 2, y = dy ? (dy < 0 ? cy - ph / 2 - clr : cy + ph / 2) : cy - sw / 2; gTop.append(svg('rect', { x, y, width: dx ? clr : sw, height: dy ? clr : sw, fill: '#e0a64a' })); });
      }
      if (st.sym) gTop.append(svg('rect', { x: bx + pw - 4, y: 40, width: 330 - bx - pw - 6, height: 140, fill: '#e0a64a', opacity: 0.55 }));
      if (st.sym && st.conn !== 'solid') { gTop.append(svg('rect', { x: bx - clr, y: cy - ph / 2 - clr, width: pw + 2 * clr, height: ph + 2 * clr, fill: '#0f3526' })); }
      gTop.append(svg('rect', { x: ax, y: cy - ph / 2, width: pw, height: ph, fill: '#f0c070' }), svg('rect', { x: bx, y: cy - ph / 2, width: pw, height: ph, fill: '#f0c070' }));
      if (!st.sym) gTop.append(svg('rect', { x: bx + pw, y: cy - 0.075 * k, width: 320 - bx - pw, height: 0.15 * k, fill: '#e0a64a' }));
      gTop.append(svg('text', { x: ax + pw / 2, y: cy + ph / 2 + 30, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 700, text: 'A' }), svg('text', { x: bx + pw / 2, y: cy + ph / 2 + 30, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 700, text: 'B' }));
      gTop.append(svg('text', { x: 30, y: 54, fill: '#1b1e1c', 'font-size': 10, 'font-weight': 650, text: 'GND plane' }));
      if (!st.sym) gTop.append(svg('text', { x: 318, y: cy - 10, 'text-anchor': 'end', fill: '#cfe0d5', 'font-size': 10, text: 'thin trace' }));
    }
    function drawSide(t) {
      gSide.innerHTML = '';
      gSide.append(svg('rect', { x: 340, y: 10, width: 290, height: 180, rx: 8, fill: '#0b2a1e' }), svg('text', { x: 350, y: 28, fill: '#9fb5a8', 'font-size': 10.5, text: `side view · t = ${Math.round(t)} s · oven ${Math.round(oven(t))} °C` }));
      const i = Math.min(R.ts.length - 1, Math.round(t / 0.4));
      const Ta = R.sa[i], Tb = R.sb[i];
      const mA = Ta >= 217, mB = Tb >= 217;
      // tilt: only if one side molten alone long enough
      let ang = 0;
      const tFirst = Math.min(isNaN(R.tA) ? 1e9 : R.tA, isNaN(R.tB) ? 1e9 : R.tB);
      if (t > tFirst) {
        const alone = Math.min(t - tFirst, isFinite(R.dW) ? R.dW : 1e9);
        const f = R.dW >= R.thr ? clamp(alone / R.thr, 0, 1) : clamp(alone / R.thr, 0, 1) * (R.dW / R.thr) * 0.35;
        const settled = isFinite(R.dW) && t > tFirst + R.dW && R.dW < R.thr;
        ang = settled ? 0 : f * (R.dW >= R.thr ? 78 : 20);
      }
      const sign = R.first === 'B' ? -1 : 1; // pad that melts first pulls its end down; other end lifts
      const by = 150, ax = 430, bx = 540;
      gSide.append(svg('rect', { x: 360, y: by, width: 250, height: 14, fill: '#1f5a41' }), svg('rect', { x: ax - 20, y: by - 4, width: 40, height: 4, fill: '#e0a64a' }), svg('rect', { x: bx - 20, y: by - 4, width: 40, height: 4, fill: '#e0a64a' }));
      const sol = (x, m, T) => gSide.append(svg('ellipse', { cx: x, cy: by - 6, rx: 20, ry: m ? 6 : 8, fill: m ? '#dfe6ea' : '#8d8d86', opacity: 0.95 }), svg('text', { x, y: by + 32, 'text-anchor': 'middle', fill: m ? '#ffd166' : '#cfe0d5', 'font-size': 10.5, 'font-family': 'var(--mono)', text: `${Math.round(T)}°` }));
      sol(ax, mA, Ta); sol(bx, mB, Tb);
      const pivot = sign > 0 ? ax - 18 : bx + 18;
      const body = svg('g', { transform: `rotate(${-sign * ang} ${pivot} ${by - 8})` });
      body.append(svg('rect', { x: ax - 18, y: by - 26, width: bx - ax + 36, height: 18, rx: 2, fill: '#222' }), svg('rect', { x: ax - 18, y: by - 26, width: 14, height: 18, fill: '#bbb' }), svg('rect', { x: bx + 4, y: by - 26, width: 14, height: 18, fill: '#bbb' }));
      gSide.append(body);
      gSide.append(svg('text', { x: ax, y: by + 46, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 700, text: 'A' }), svg('text', { x: bx, y: by + 46, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 700, text: 'B' }));
      if (ang > 50) gSide.append(svg('text', { x: 485, y: 50, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 13, 'font-weight': 700, text: 'TOMBSTONE' }));
      plot.draw({ series: [{ x: R.ts, y: R.so, color: 'var(--faint)', width: 1.5, dash: [4, 3], label: 'oven air' }, { x: R.ts, y: R.sp, color: 'var(--good)', width: 1.6, label: 'GND plane' }, { x: R.ts, y: R.sa, color: 'var(--bad)', width: 2.2, label: 'pad A' }, { x: R.ts, y: R.sb, color: 'var(--link)', width: 2.2, label: 'pad B' }], hlines: [{ y: 217, color: 'var(--warn)', label: 'liquidus 217 °C' }], vlines: [{ x: t, color: 'var(--accent)', dash: [2, 2] }], range: { ymin: 20, ymax: 260 } });
    }
    let last = 0, lastDraw = 0, hold = 0;
    compute(); drawSide(0);
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (st.playing) {
        if (st.t >= 320) { hold += dt; if (hold > 1.8) { hold = 0; st.t = 0; } }
        else st.t = Math.min(320, st.t + dt * 40);
      }
      if (ts - lastDraw > 70) { lastDraw = ts; drawSide(st.t); }
    });
  })();

  /* =================================================================
     13.3  Who's right?
     ================================================================= */
  (function myths() {
    const host = document.getElementById('myth-box'); if (!host) return;
    const C = [
      { c: 'Never use 90° corners on traces: they reflect and radiate.', w: 'Jones (tidy routing); widespread lore', a: 'dep', v: 'Mostly habit. A 90° corner adds a tiny bit of capacitance, invisible on a TDR until edges reach tens of picoseconds (lesson 7.2). The original reason was manufacturing (acid traps in old etching). Use 45° anyway: it costs nothing and is slightly shorter.', l: ['lesson-07.html#tdr', '7.2'] },
      { c: 'Split the ground into analog and digital planes, joined at a single star point.', w: 'Jones (2004)', a: 'myth', v: 'Outdated for most boards. A signal crossing the split loses its return path (lesson 3). Sierra: one solid plane with partitioned <i>placement</i> works better. Split only for a real reason, such as galvanic isolation or chassis ground.', l: ['lesson-04.html#floorplan', '4.2'] },
      { c: 'One 100 nF capacitor per power pin is all the decoupling you need.', w: 'Common rule of thumb', a: 'dep', v: 'It depends on the target impedance and frequency. Mounting inductance often matters more than the value, and bulk plus mid-value capacitors cover the lower frequencies (lesson 5).', l: ['lesson-05.html', '5'] },
      { c: 'Route from the IC pin to the decoupling cap first, then to the via ("pin → cap → via").', w: 'Classic advice vs. Sierra\'s via-at-pad', a: 'dep', v: 'Both work if the loop is small. What matters is the area of the loop pin → cap → via → plane → back. Short, wide connections with vias right at the capacitor pads win (lesson 5.2).', l: ['lesson-05.html#mounting', '5.2'] },
      { c: 'Add a guard trace between two signals to stop crosstalk.', w: 'Common practice', a: 'dep', v: 'Only if it is grounded with stitching vias along its length. A floating or single-ended guard can make crosstalk worse (lesson 9.2). Often, simply spreading the traces apart does as well.', l: ['lesson-09.html#rules', '9.2'] },
      { c: 'Follow the 3W rule and crosstalk is solved.', w: 'Sierra §3.5.3 (as a guideline)', a: 'dep', v: 'It is a proxy for "spacing large compared to the height above the plane". With a thick dielectric, 3W is not enough; with a thin one it is generous. NEXT also saturates and FEXT grows with length (lesson 9.1).', l: ['lesson-09.html', '9'] },
      { c: 'Length-match every signal in a bus to the same length.', w: 'Over-applied DDR advice', a: 'myth', v: 'Match <i>within groups</i>, to the group\'s reference: bits to their strobe, address to the clock, P to N. Lanes don\'t need to match each other. And match in <b>time</b>: layers have different speeds (lesson 11).', l: ['lesson-11.html#lane', '11.2'] },
      { c: 'Use thermal relief on every pad and via that connects to a plane.', w: 'Tool defaults', a: 'dep', v: 'For soldered pads, yes (Jones). <b>Vias</b> are never soldered, so relief only adds resistance and inductance: connect them directly. High-current pads need wide spokes or a solid connection (lesson 13.2).', l: ['#relief', '13.2'] },
      { c: 'Real designers don\'t auto route.', w: 'Jones (2004)', a: 'dep', v: 'True for critical nets: hot loops, fast pairs and analog must be placed and routed by hand with intent. Constraint-driven tools (Altium ActiveRoute, length tuning) are fine for buses once the rules are right.', l: ['lesson-06.html', '6'] },
      { c: 'Vias are free; use as many as you need.', w: '—', a: 'dep', v: 'On power and ground, yes: more vias in parallel mean lower inductance and resistance. On fast signals, every via is a discontinuity and maybe a stub (lesson 10). Count them, and keep them symmetric in pairs.', l: ['lesson-10.html', '10'] },
      { c: 'Keep high-speed traces and parts away from the board edge.', w: 'Sierra §7.2.2.2', a: 'true', v: 'True. Near the edge, the reference plane ends and the fields fringe, so impedance shifts and radiation rises. Keep fast traces several dielectric heights (or more) inside the plane edge, and stitch the plane edges with ground vias.', l: ['lesson-03.html', '3'] },
      { c: 'Put the buck converter\'s input capacitor as close to the IC as possible, on the same side.', w: 'ROHM §2.1', a: 'true', v: 'True, and the single most important buck layout rule. The input cap closes the hot loop; every mm adds inductance and ringing. A back-side cap through vias adds ~1–2 nH (lesson 6.2).', l: ['lesson-06.html#layout', '6.2'] },
    ];
    const TAG = { true: ['true', 'Mostly true'], dep: ['dep', 'It depends'], myth: ['myth', 'Mostly myth'] };
    const saved = PCB.store.get('myths13', {});
    const score = el('div', { class: 'myth-score' });
    const grid = el('div', { class: 'myths' });
    const reset = el('button', { class: 'btn', onclick: () => { for (const k in saved) delete saved[k]; PCB.store.set('myths13', saved); draw(); } }, 'Reset my answers');
    host.append(el('div', { class: 'btn-row', style: { alignItems: 'center', gap: '12px' } }, score, reset), grid);
    function draw() {
      grid.innerHTML = '';
      let n = 0, ok = 0;
      C.forEach((m, i) => {
        const pick = saved[i];
        const card = el('div', { class: 'myth' + (pick ? ' open' : '') });
        const vote = el('div', { class: 'vote' });
        [['true', 'Agree'], ['dep', 'It depends'], ['myth', 'Disagree']].forEach(([v, t]) => {
          const b = el('button', { class: 'btn' + (pick === v ? ' picked' : ''), type: 'button', onclick: () => { saved[i] = v; PCB.store.set('myths13', saved); draw(); } }, t);
          vote.append(b);
        });
        const [tc, tl] = TAG[m.a];
        const verdict = el('div', { class: 'verdict' }, el('span', { class: 'tag ' + tc }, tl), pick ? el('span', { style: { marginLeft: '6px', fontSize: '.8rem', color: pick === m.a ? 'var(--good)' : 'var(--warn)' } }, pick === m.a ? '✓ matches the evidence' : 'your pick differed') : null, el('div', { html: m.v }), el('a', { href: m.l[0], style: { fontSize: '.82rem' } }, `See lesson ${m.l[1]} →`));
        card.append(el('div', { class: 'claim' }, '“' + m.c + '”'), el('div', { class: 'who' }, m.w), vote, verdict);
        grid.append(card);
        if (pick) { n++; if (pick === m.a) ok++; }
      });
      score.textContent = n ? `You matched the evidence on ${ok} of ${n} answered (${C.length} cards).` : `${C.length} cards. Pick an answer to reveal each verdict.`;
    }
    draw();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Your board meets standard rules everywhere except one 0.15 mm drill under a BGA. What sets the price?', opts: ['The average feature', 'The hardest feature: the whole board moves to the more capable (more expensive) process', 'Only the number of holes'], a: 1, ex: 'Fabs price by the most demanding feature on the panel. Keep everything else standard and confine the hard features to where they are needed.' },
    { q: 'Why must a via inside a solder pad be filled and capped?', opts: ['To look nicer', 'An open hole drains solder paste away during reflow, starving the joint', 'To increase the impedance'], a: 1, ex: 'Sierra §7.4.2: via-in-pad must be filled (except in thermal pads). VIPPO restores a flat, solderable pad.' },
    { q: 'A 0402 resistor tombstones. One pad goes solidly to a GND plane and the other to a thin trace. Fix?', opts: ['Make the trace thinner', 'Use a thermal-relief connection on the plane pad and balance the copper on the two pads', 'Increase the peak oven temperature'], a: 1, ex: 'Tombstoning comes from one end melting well before the other. Relief and symmetric copper make both ends melt together.' },
    { q: 'Should signal and stitching vias use thermal relief to the GND plane?', opts: ['Yes, always', 'No: vias are not soldered, so connect them directly', 'Only on inner layers'], a: 1, ex: 'Relief exists for soldering. On a via it only adds resistance and inductance.' },
  ]);
})();
