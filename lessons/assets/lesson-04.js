/* Lesson 4 — Grounding with multiple voltage levels */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, geo, legend } = PCB;

  PCB.renderChrome({ lesson: 4 });

  /* =================================================================
     4.1  Power tree: one ground for every rail
     ================================================================= */
  (function labTree() {
    const host = document.getElementById('lab-tree'); if (!host) return;
    const L = lab(host, { title: 'A carrier-board power tree' });
    const st = { loop: 'v18', split: false };
    const sLoop = seg({ label: 'Follow the current loop of…', options: [{ v: 'v5', label: '5 V' }, { v: 'v33', label: '3.3 V' }, { v: 'v18', label: '1.8 V' }, { v: 'csi', label: 'CSI signal' }], value: st.loop, onChange: v => { st.loop = v; update(); } });
    const cSplit = check({ label: 'Give each voltage its own ground (the myth), joined at one star point', onChange: v => { st.split = v; update(); } });
    L.controls.append(sLoop.el, cSplit.el, el('div', { class: 'hint' }, 'Dots: yellow = supply current, blue = signal, orange = return current, red = return current forced to detour.'));

    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 300' });
    const planeG = svg('g'), wires = svg('g'), blocksG = svg('g'), dotsG = svg('g');
    S.append(planeG, wires, blocksG, dotsG);
    L.stage.append(S);
    const M = meters(L.stage, [{ key: 'area', label: 'Loop area (selected)' }, { key: 'via', label: 'Return path' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const BL = {
      in: [20, 40, 72, 44, '12 V IN'], b5: [130, 40, 84, 44, 'BUCK → 5 V'], mod: [470, 28, 140, 64, 'MODULE (5 V)'],
      ldo: [262, 120, 82, 40, 'LDO → 3.3 V'], hub: [470, 120, 140, 40, 'USB HUB (3.3 V)'],
      b18: [262, 194, 82, 40, 'BUCK → 1.8 V'], cam: [470, 194, 140, 40, 'CAMERA (1.8 V)'],
    };
    const gv = k => { const b = BL[k]; return { x: b[0] + b[2] / 2 + (k === 'mod' ? 40 : 0), y: b[1] + b[3] + 10 }; };
    const STAR = { x: 56, y: 170 };
    // island polygons for split mode
    const isl5 = '10,18 632,18 632,104 238,104 238,262 10,262';
    const isl33 = '246,110 632,110 632,178 246,178';
    const isl18 = '246,184 632,184 632,262 246,262';

    for (const k in BL) {
      const [x, y, w, h, t] = BL[k];
      blocksG.append(svg('rect', { x, y, width: w, height: h, rx: 6, fill: '#141a17', stroke: 'var(--silk)', 'stroke-width': 1 }),
        svg('text', { x: x + w / 2, y: y + h / 2 + 4, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11.5, 'font-weight': 600, text: t }));
      const g = gv(k);
      blocksG.append(svg('circle', { cx: g.x, cy: g.y, r: 4, fill: 'var(--copper)', stroke: '#000' }));
    }
    const rail = (pts, c, w = 3.5) => wires.append(svg('path', { d: geo.pathD(pts), fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linejoin': 'round' }));
    rail([{ x: 92, y: 62 }, { x: 130, y: 62 }], '#ff8f6b');
    rail([{ x: 214, y: 62 }, { x: 470, y: 62 }], '#ff5d6c');
    rail([{ x: 232, y: 62 }, { x: 232, y: 140 }, { x: 262, y: 140 }], '#ff5d6c');
    rail([{ x: 232, y: 140 }, { x: 232, y: 214 }, { x: 262, y: 214 }], '#ff5d6c');
    rail([{ x: 344, y: 140 }, { x: 470, y: 140 }], '#ffa94d');
    rail([{ x: 344, y: 214 }, { x: 470, y: 214 }], '#c99bff');
    rail([{ x: 610, y: 214 }, { x: 626, y: 214 }, { x: 626, y: 50 }, { x: 610, y: 50 }], 'var(--sig)', 2);
    wires.append(
      svg('text', { x: 300, y: 56, fill: '#ffb3ba', 'font-size': 10.5, text: '5 V' }),
      svg('text', { x: 400, y: 134, fill: '#ffcf99', 'font-size': 10.5, text: '3.3 V' }),
      svg('text', { x: 400, y: 208, fill: '#dcc4ff', 'font-size': 10.5, text: '1.8 V' }),
      svg('text', { x: 98, y: 56, fill: '#ffc2ad', 'font-size': 10.5, text: '12 V' }),
      svg('text', { x: 632, y: 136, fill: '#9fd3ff', 'font-size': 10.5, 'text-anchor': 'end', text: 'CSI' }));

    const LOOPS = {
      v5: { fwd: [{ x: 214, y: 62 }, { x: 470, y: 62 }], ret: () => [gv('mod'), gv('b5')], c: '#ffd166' },
      v33: { fwd: [{ x: 344, y: 140 }, { x: 470, y: 140 }], ret: () => [gv('hub'), gv('ldo')], c: '#ffd166' },
      v18: { fwd: [{ x: 344, y: 214 }, { x: 470, y: 214 }], ret: () => [gv('cam'), gv('b18')], c: '#ffd166' },
      csi: { fwd: [{ x: 610, y: 214 }, { x: 626, y: 214 }, { x: 626, y: 50 }, { x: 610, y: 50 }], ret: () => (st.split ? [gv('mod'), { x: 236, y: 100 }, STAR, { x: 250, y: 236 }, gv('cam')] : [{ x: 618, y: 54 }, { x: 618, y: 210 }]), c: '#9fd3ff' },
    };
    let fwd = [], ret = [], extra = [];
    function update() {
      planeG.innerHTML = '';
      if (!st.split) {
        planeG.append(svg('rect', { x: 10, y: 18, width: 622, height: 244, rx: 8, fill: 'var(--plane)', opacity: 0.7 }),
          svg('text', { x: 20, y: 284, fill: 'var(--gnd)', 'font-size': 11, text: 'One solid GND plane under everything' }));
      } else {
        planeG.append(svg('polygon', { points: isl5, fill: '#2b5a3f', opacity: 0.85 }), svg('polygon', { points: isl33, fill: '#5a4a2b', opacity: 0.85 }), svg('polygon', { points: isl18, fill: '#47305a', opacity: 0.85 }),
          svg('path', { d: `M 246 144 L ${STAR.x} ${STAR.y} M 246 222 L ${STAR.x} ${STAR.y}`, stroke: 'var(--copper)', 'stroke-width': 2.5 }),
          svg('circle', { cx: STAR.x, cy: STAR.y, r: 7, fill: 'var(--copper)', stroke: '#000' }),
          svg('text', { x: STAR.x, y: STAR.y + 22, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 10.5, text: 'star point' }),
          svg('text', { x: 20, y: 284, fill: '#ffb3a6', 'font-size': 11, text: 'GND_5V · GND_3V3 · GND_1V8 joined only at the star point' }));
      }
      const lp = LOOPS[st.loop];
      fwd = lp.fwd; ret = lp.ret(); extra = [];
      if (st.split && (st.loop === 'v18' || st.loop === 'v33')) {
        const r = st.loop === 'v18' ? 'b18' : 'ldo';
        // the regulator's INPUT current returns to the 5 V domain through the same GND pin
        extra = [gv(r), { x: 250, y: st.loop === 'v18' ? 236 : 160 }, STAR, { x: 170, y: 104 }, gv('b5')];
      }
      const areaPx = Math.abs(geo.area(fwd.concat(ret.slice().reverse())));
      const mm2 = areaPx * 0.0625; // 1 px ≈ 0.25 mm in this sketch
      M.set('area', sig(mm2, 2) + ' mm²', st.split && st.loop === 'csi' ? 'bad' : 'good');
      M.set('via', st.split ? (st.loop === 'csi' ? 'via star point' : extra.length ? 'shared GND pin!' : 'within island') : 'shared plane', st.split && (st.loop === 'csi' || extra.length) ? 'bad' : 'good');
      const items = [];
      if (!st.split) {
        if (st.loop === 'csi') items.push({ level: 'good', html: 'The CSI signal goes from a 1.8 V camera to a 5 V module, and its return current flows back on the <b>shared plane</b>, right under the route. Different rails, same reference: no problem.' });
        else items.push({ level: 'good', html: `The ${st.loop === 'v5' ? '5 V' : st.loop === 'v33' ? '3.3 V' : '1.8 V'} load current returns through the same plane as every other rail. That is fine, because each loop is small and local.` });
        items.push({ level: 'info', html: 'Regulators don\'t care which rail they produce: input, output and GND pin all reference the same ground.' });
      } else {
        if (st.loop === 'csi') items.push({ level: 'bad', html: 'The CSI return current must leave GND_5V, run to the star point and come back through GND_1V8. The loop now encloses a large part of the board: a strong antenna, and an impedance discontinuity for a multi-Gbps link.' });
        else if (extra.length) items.push({ level: 'bad', html: `The ${st.loop === 'v18' ? '1.8 V buck' : '3.3 V LDO'} has <b>one</b> GND pin. Its output return wants GND_${st.loop === 'v18' ? '1V8' : '3V3'}, but its <b>input</b> return current (red) must reach the 5 V domain through the star point. The "separate" grounds are joined at the regulator anyway, just with a long detour added.` });
        else items.push({ level: 'warn', html: 'The 5 V load loop stays in its island here, but every signal leaving the 5 V domain now has a broken return path. Try the CSI loop.' });
      }
      V.set(items);
      E.set(`<p>Ground is the <b>reference</b> that gives every rail and signal its meaning. Non-isolated regulators connect input and output to one GND pin, so their domains are already the same node.</p><p>Separating grounds only makes sense where nothing crosses the boundary except through isolation (transformers, optocouplers, isolated DC/DC). Otherwise you add loop area without removing any connection.</p>`);
    }
    // dots
    const N = 14, F = [], R = [], X = [];
    for (let i = 0; i < N; i++) {
      const a = svg('circle', { r: 2.8 }); const b = svg('circle', { r: 2.8, fill: 'var(--ret)' }); const c = svg('circle', { r: 2.8, fill: '#ff4d4d' });
      dotsG.append(a, b, c); F.push({ n: a, s: i / N }); R.push({ n: b, s: i / N }); X.push({ n: c, s: i / N });
    }
    let last = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      const lf = geo.polyLen(fwd), lr = geo.polyLen(ret), lx = extra.length ? geo.polyLen(extra) : 0;
      const col = LOOPS[st.loop].c;
      F.forEach(d => { d.s = (d.s + dt * 70 / lf) % 1; const q = geo.along(fwd, d.s * lf); setAttrs(d.n, { cx: q.x, cy: q.y, fill: col }); });
      R.forEach(d => { d.s = (d.s + dt * 70 / lr) % 1; const q = geo.along(ret, d.s * lr); setAttrs(d.n, { cx: q.x, cy: q.y, fill: st.split && st.loop === 'csi' ? '#ff4d4d' : 'var(--ret)' }); });
      X.forEach(d => {
        if (!lx) { d.n.style.display = 'none'; return; }
        d.n.style.display = ''; d.s = (d.s + dt * 70 / lx) % 1; const q = geo.along(extra, d.s * lx); setAttrs(d.n, { cx: q.x, cy: q.y });
      });
    });
    update();
  })();

  /* =================================================================
     4.2  Floorplan + ground strategy → noise at a 16-bit ADC
     ================================================================= */
  (function labFloor() {
    const host = document.getElementById('lab-floor'); if (!host) return;
    const L = lab(host, { title: 'Place the blocks, choose a ground strategy, watch the ADC' });
    const BW = 160, BH = 100, PX = 4;
    const LSB = 2.5 / 65536 * 1e6; // µV, 16-bit on 2.5 V ref
    const B = {
      pwr: { label: '12 V IN', sub: 'jack', w: 11, h: 14, type: 'conn' },
      buck: { label: 'BUCK', sub: '12→5 V · 500 kHz', w: 22, h: 16, type: 'noisy' },
      soc: { label: 'JETSON MODULE', sub: '5 V · 4 A', w: 46, h: 30, type: 'dig' },
      usb: { label: 'USB 3', sub: 'conn', w: 12, h: 16, type: 'conn' },
      adc: { label: '16-bit ADC', sub: '+ analog front end', w: 22, h: 14, type: 'ana' },
      sns: { label: 'SENSOR', sub: 'input', w: 11, h: 12, type: 'conn' },
    };
    const C = [
      { id: 'in', a: 'pwr', b: 'buck', kind: 'dc', I: 2 },
      { id: 'p5', a: 'buck', b: 'soc', kind: 'dc', I: 4 },
      { id: 'usb', a: 'soc', b: 'usb', kind: 'hf', amp: 1500, f: 300e6, Ie: 0.01, name: 'USB 3' },
      { id: 'spi', a: 'soc', b: 'adc', kind: 'hf', amp: 300, f: 100e6, Ie: 0.008, name: 'SPI' },
      { id: 'ana', a: 'sns', b: 'adc', kind: 'ana' },
    ];
    const PRESETS = {
      naive: { mode: 'plane', pos: { pwr: [6.5, 52], buck: [52, 74], soc: [104, 40], usb: [153, 82], adc: [74, 82], sns: [6.5, 86] } },
      split: { mode: 'split', sx: 66, ty: 14, pos: { pwr: [6.5, 16], buck: [30, 16], soc: [108, 46], usb: [153, 20], adc: [44, 78], sns: [6.5, 86] } },
      good: { mode: 'plane', pos: { pwr: [6.5, 16], buck: [30, 16], soc: [106, 44], usb: [153, 22], adc: [22, 84], sns: [6.5, 86] } },
    };
    const st = { mode: 'plane', sx: 70, ty: 50, star: { x: 20, y: 50 }, pos: {} };
    function loadPreset(k) {
      const p = PRESETS[k];
      st.mode = p.mode; if (p.sx) st.sx = p.sx; if (p.ty) st.ty = p.ty;
      for (const id in p.pos) st.pos[id] = { x: p.pos[id][0], y: p.pos[id][1] };
      sMode.set(st.mode); update();
    }

    const sMode = seg({ label: 'Ground strategy', options: [
      { v: 'plane', label: 'Solid plane' }, { v: 'split', label: 'Split AGND/DGND' }, { v: 'star', label: 'Star (2-layer)' }], value: st.mode, onChange: v => { st.mode = v; update(); } });
    const cRet = check({ label: 'Show return-current paths', checked: true, onChange: () => update() });
    L.controls.append(sMode.el, cRet.el,
      el('div', { class: 'ctl-group-title' }, 'Start from'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => loadPreset('naive') }, 'Naive layout'),
        el('button', { class: 'btn', onclick: () => loadPreset('split') }, 'Split plane, done wrong'),
        el('button', { class: 'btn', onclick: () => loadPreset('good') }, 'Good layout')),
      el('div', { class: 'hint', html: 'Drag any block. In <b>Split</b> mode drag the split line and the tie bridge; in <b>Star</b> mode drag the star point.' }));

    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX} ${BH * PX}` });
    const gPlane = svg('g'), gField = svg('g'), gRoutes = svg('g'), gRet = svg('g'), gBlocks = svg('g'), gHandles = svg('g');
    S.append(gPlane, gField, gRoutes, gRet, gBlocks, gHandles);
    L.stage.append(S, legend([['var(--pwr)', 'high-current DC'], ['var(--sig)', 'fast digital (USB 3, SPI)'], ['#8ef08e', 'analog input (victim)'], ['var(--ret)', 'return current', true], ['#ffd166', 'buck magnetic field']]));
    const plot = new Plot(L.stage, { title: 'Error at the ADC input over 10 µs (illustrative waveform built from the noise budget)', height: 170, xlabel: 'µs', ylabel: 'µV', xmin: 0, xmax: 10, xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [
      { key: 'buck', label: 'Buck magnetic field' }, { key: 'dig', label: 'Digital return currents' }, { key: 'dc', label: 'DC ground shift' },
      { key: 'tot', label: 'Total (16-bit LSBs)', bar: true }, { key: 'emi', label: 'Worst EMI margin' },
    ]);
    L.stage.append(el('div', { class: 'model-note' }, 'Simplified model. Buck field ∝ 1/d³; digital coupling ∝ 1/(1+(d/s)²) to forward and return paths; DC shift solved for an infinite 1 oz copper sheet; emissions from loop areas (Ott, FCC B). Magnitudes are illustrative, trends are real.'));
    const V = verdicts(L.left, 'What happens');
    const E = explain(L.right, 'Why');

    // ---- blocks (persistent, draggable)
    const COL = { conn: ['#2a2f33', '#c9d1d6'], noisy: ['#3a1714', '#ff7b6b'], dig: ['#122535', '#5cb8ff'], ana: ['#13301c', '#8ef08e'] };
    const nodes = {};
    for (const id in B) {
      const b = B[id], [fill, stroke] = COL[b.type];
      const g = svg('g');
      const r = svg('rect', { x: -b.w * PX / 2, y: -b.h * PX / 2, width: b.w * PX, height: b.h * PX, rx: 5, fill, stroke, 'stroke-width': 1.6 });
      const t1 = svg('text', { y: b.h > 14 ? -2 : 1, 'text-anchor': 'middle', fill: '#eef1e8', 'font-size': b.w > 20 ? 11.5 : 9.5, 'font-weight': 650, text: b.label });
      const t2 = svg('text', { y: b.h > 14 ? 12 : 13, 'text-anchor': 'middle', fill: '#a9b8af', 'font-size': 8.5, text: b.h > 12 ? b.sub : '' });
      g.append(r, t1, t2);
      gBlocks.append(g);
      nodes[id] = g;
      let off = null;
      PCB.draggable(S, g, {
        onStart: p => { off = { x: p.x / PX - st.pos[id].x, y: p.y / PX - st.pos[id].y }; },
        onMove: p => { st.pos[id] = { x: clamp(p.x / PX - off.x, b.w / 2 + 1, BW - b.w / 2 - 1), y: clamp(p.y / PX - off.y, b.h / 2 + 1, BH - b.h / 2 - 1) }; update(); },
      });
    }
    // handles
    const hSplit = svg('rect', { width: 14, height: BH * PX, fill: 'transparent' });
    const hTie = svg('rect', { width: 22, height: 26, rx: 4, fill: 'rgba(224,166,74,.35)', stroke: 'var(--copper)', 'stroke-width': 1.5 });
    const hStar = svg('circle', { r: 10, fill: 'rgba(224,166,74,.35)', stroke: 'var(--copper)', 'stroke-width': 2 });
    gHandles.append(hSplit, hTie, hStar);
    PCB.draggable(S, hSplit, { onMove: p => { st.sx = clamp(p.x / PX, 20, BW - 20); update(); } });
    PCB.draggable(S, hTie, { onMove: p => { st.ty = clamp(p.y / PX, 5, BH - 5); update(); } });
    PCB.draggable(S, hStar, { onMove: p => { st.star = { x: clamp(p.x / PX, 4, BW - 4), y: clamp(p.y / PX, 4, BH - 4) }; update(); } });

    // ---- model
    const side = p => (p.x < st.sx ? 'A' : 'D');
    function retPath(a, b) {
      if (st.mode === 'plane') return [b, a];
      if (st.mode === 'star') return [b, st.star, a];
      if (side(a) === side(b)) return [b, a];
      const t = (st.sx - a.x) / (b.x - a.x), Xy = a.y + t * (b.y - a.y), sb = b.x > st.sx ? 1 : -1, d = 2;
      return [b, { x: st.sx + sb * d, y: Xy }, { x: st.sx + sb * d, y: st.ty }, { x: st.sx - sb * d, y: st.ty }, { x: st.sx - sb * d, y: Xy }, a];
    }
    function loopArea(a, b, ret) {
      const h = st.mode === 'star' ? 1.6 : 0.2;
      return Math.abs(geo.area([a, b].concat(ret.slice(1)))) + h * geo.dist(a, b);
    }
    const RS = 0.49e-3, KDC = RS / (2 * Math.PI);
    function dip(p, inj, ext) { return KDC * Math.log(Math.max(geo.dist(p, ext), 3) / Math.max(geo.dist(p, inj), 3)); }
    const tieP = () => ({ x: st.sx, y: st.ty });
    function phiSide(p, s) {
      let v = 0;
      for (const c of C) if (c.kind === 'dc') {
        const inj = st.pos[c.b], ext = st.pos[c.a];
        const si = side(inj), se = side(ext);
        if (si === se) { if (si === s) v += c.I * dip(p, inj, ext); }
        else { if (si === s) v += c.I * dip(p, inj, tieP()); if (se === s) v += c.I * dip(p, tieP(), ext); }
      }
      return v;
    }
    function dcShift() {
      const a = st.pos.sns, b = st.pos.adc;
      if (st.mode === 'star') return 0;
      if (st.mode === 'plane') {
        let v = 0;
        for (const c of C) if (c.kind === 'dc') v += c.I * (dip(a, st.pos[c.b], st.pos[c.a]) - dip(b, st.pos[c.b], st.pos[c.a]));
        return Math.abs(v);
      }
      const sa = side(a), sbb = side(b);
      if (sa === sbb) return Math.abs(phiSide(a, sa) - phiSide(b, sa));
      let Ix = 0; for (const c of C) if (c.kind === 'dc' && side(st.pos[c.a]) !== side(st.pos[c.b])) Ix += c.I;
      return Math.abs(phiSide(a, sa) - phiSide(tieP(), sa) + phiSide(tieP(), sbb) - phiSide(b, sbb)) + Ix * 0.2e-3;
    }

    function compute() {
      const P = st.pos;
      const ana = C.find(c => c.id === 'ana');
      const aRet = retPath(P.sns, P.adc);
      const aLen = geo.dist(P.sns, P.adc);
      const aArea = loopArea(P.sns, P.adc, aRet);
      const vf = clamp(Math.sqrt(aArea / Math.max(0.2 * aLen, 1)), 1, 20);
      // victim sample points: analog input route up to 12 mm before the ADC, plus front-end zone
      const samples = [];
      const dir = { x: (P.adc.x - P.sns.x) / (aLen || 1), y: (P.adc.y - P.sns.y) / (aLen || 1) };
      for (let s = 0; s <= Math.max(0, aLen - 12); s += 2) samples.push({ x: P.sns.x + dir.x * s, y: P.sns.y + dir.y * s });
      if (!samples.length) samples.push(P.sns);
      const withAdc = samples.concat([P.adc]);
      // buck
      let db = Infinity; for (const s of withAdc) db = Math.min(db, geo.dist(s, P.buck));
      const Nb = 2000 * Math.pow(8 / Math.max(db, 8), 3) * vf;
      // digital
      const s0 = st.mode === 'star' ? 6 : 3;
      const dig = {};
      let emiWorst = Infinity, emiWho = '';
      const routes = {};
      for (const c of C) {
        const a = P[c.a], b = P[c.b];
        const ret = retPath(a, b);
        routes[c.id] = { a, b, ret };
        if (c.kind !== 'hf') continue;
        const vs = c.id === 'usb' ? withAdc : samples;
        let d = Infinity;
        for (const s of vs) d = Math.min(d, geo.polyDist(s, [a, b]).d, geo.polyDist(s, ret).d);
        dig[c.id] = c.amp / (1 + (d / s0) * (d / s0)) * vf;
        const A = loopArea(a, b, ret);
        const Edb = phys.dBuV(phys.ottE(c.f, A * 1e-6, c.Ie));
        const margin = phys.fccB(c.f) - Edb;
        routes[c.id].A = A; routes[c.id].margin = margin;
        if (margin < emiWorst) { emiWorst = margin; emiWho = c.name; }
      }
      const Nd = (dig.usb || 0) + (dig.spi || 0);
      const Ndc = dcShift() * 1e6;
      return { Nb, Nd, Ndc, dig, db, vf, aArea, aRet, routes, emiWorst, emiWho, total: Nb + Nd + Ndc };
    }

    function update() {
      const P = st.pos;
      for (const id in nodes) nodes[id].setAttribute('transform', `translate(${P[id].x * PX} ${P[id].y * PX})`);
      const r = compute();
      // plane
      gPlane.innerHTML = '';
      if (st.mode === 'plane') gPlane.append(svg('rect', { x: 8, y: 8, width: BW * PX - 16, height: BH * PX - 16, rx: 6, fill: 'var(--plane)', opacity: 0.75 }),
        svg('text', { x: 14, y: BH * PX - 14, fill: 'var(--gnd)', 'font-size': 11, text: 'Solid GND plane (L2)' }));
      if (st.mode === 'split') {
        const x = st.sx * PX;
        gPlane.append(svg('rect', { x: 8, y: 8, width: x - 12, height: BH * PX - 16, rx: 6, fill: '#1f6650', opacity: 0.8 }),
          svg('rect', { x: x + 4, y: 8, width: BW * PX - x - 12, height: BH * PX - 16, rx: 6, fill: 'var(--plane)', opacity: 0.75 }),
          svg('rect', { x: x - 6, y: st.ty * PX - 10, width: 12, height: 20, fill: 'var(--copper)' }),
          svg('text', { x: 14, y: BH * PX - 14, fill: '#9cf0c6', 'font-size': 11, 'font-weight': 600, text: 'AGND' }),
          svg('text', { x: BW * PX - 14, y: BH * PX - 14, 'text-anchor': 'end', fill: 'var(--gnd)', 'font-size': 11, 'font-weight': 600, text: 'DGND' }),
          svg('text', { x: x + 10, y: st.ty * PX + 4, fill: 'var(--copper)', 'font-size': 10, text: 'tie' }));
      }
      if (st.mode === 'star') {
        for (const id in P) gPlane.append(svg('line', { x1: P[id].x * PX, y1: P[id].y * PX, x2: st.star.x * PX, y2: st.star.y * PX, stroke: 'var(--copper-dim)', 'stroke-width': 3, opacity: 0.85 }));
        gPlane.append(svg('text', { x: 14, y: BH * PX - 14, fill: '#ffb3a6', 'font-size': 11, text: '2-layer board: no plane, each block has its own ground trace to the star point' }));
      }
      setAttrs(hSplit, { x: st.sx * PX - 7, y: 0 }); hSplit.style.display = st.mode === 'split' ? '' : 'none';
      hSplit.style.cursor = 'ew-resize';
      setAttrs(hTie, { x: st.sx * PX - 11, y: st.ty * PX - 13 }); hTie.style.display = st.mode === 'split' ? '' : 'none';
      setAttrs(hStar, { cx: st.star.x * PX, cy: st.star.y * PX }); hStar.style.display = st.mode === 'star' ? '' : 'none';
      // buck field
      gField.innerHTML = '';
      for (let k = 1; k <= 4; k++) gField.append(svg('circle', { cx: P.buck.x * PX, cy: P.buck.y * PX, r: k * 9 * PX, fill: 'none', stroke: '#ffd166', 'stroke-width': 1.5, opacity: (0.55 / (k * k)).toFixed(3) }));
      gField.append(svg('circle', { cx: P.buck.x * PX, cy: P.buck.y * PX, r: 9 * PX, fill: '#ffd166', opacity: 0.07 }));
      // routes
      gRoutes.innerHTML = ''; gRet.innerHTML = '';
      const ln = (a, b, attrs) => svg('line', Object.assign({ x1: a.x * PX, y1: a.y * PX, x2: b.x * PX, y2: b.y * PX, 'stroke-linecap': 'round' }, attrs));
      for (const c of C) {
        const { a, b, ret } = r.routes[c.id];
        if (c.kind === 'dc') gRoutes.append(ln(a, b, { stroke: 'var(--pwr)', 'stroke-width': 7, opacity: 0.85 }));
        if (c.id === 'usb') {
          const n = { x: -(b.y - a.y), y: b.x - a.x }, m = Math.hypot(n.x, n.y) || 1, o = 0.5;
          gRoutes.append(ln({ x: a.x + n.x / m * o, y: a.y + n.y / m * o }, { x: b.x + n.x / m * o, y: b.y + n.y / m * o }, { stroke: 'var(--sig)', 'stroke-width': 1.8 }),
            ln({ x: a.x - n.x / m * o, y: a.y - n.y / m * o }, { x: b.x - n.x / m * o, y: b.y - n.y / m * o }, { stroke: 'var(--sig)', 'stroke-width': 1.8 }));
        }
        if (c.id === 'spi') gRoutes.append(ln(a, b, { stroke: 'var(--sig)', 'stroke-width': 2.2, 'stroke-dasharray': '7 3' }));
        if (c.id === 'ana') gRoutes.append(ln(a, b, { stroke: '#8ef08e', 'stroke-width': 9, opacity: 0.18 }), ln(a, b, { stroke: '#8ef08e', 'stroke-width': 2.6 }));
        if (cRet.value && c.kind !== 'dc' && (st.mode !== 'plane')) {
          gRet.append(svg('path', { d: geo.pathD(ret.map(p => ({ x: p.x * PX, y: p.y * PX }))), fill: 'none', stroke: 'var(--ret)', 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: 0.9 }));
        }
        if (cRet.value && c.kind !== 'dc' && st.mode === 'plane') {
          gRet.append(svg('path', { d: geo.pathD(ret.map(p => ({ x: p.x * PX, y: p.y * PX }))), fill: 'none', stroke: 'var(--ret)', 'stroke-width': 1.2, 'stroke-dasharray': '3 5', opacity: 0.6 }));
        }
      }
      // DC return current shading in plane mode: show the spread zone of the 4 A return
      if (st.mode === 'plane' && cRet.value) {
        const a = P.buck, b = P.soc, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, len = geo.dist(a, b);
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        gRet.append(svg('ellipse', { cx: mid.x * PX, cy: mid.y * PX, rx: (len / 2 + 6) * PX, ry: Math.max(8, len * 0.28) * PX, fill: 'var(--ret)', opacity: 0.08, transform: `rotate(${ang} ${mid.x * PX} ${mid.y * PX})` }));
      }

      // meters
      const lv = (v, b, w) => (v > b ? 'bad' : v > w ? 'warn' : 'good');
      M.set('buck', fmtSI(r.Nb * 1e-6, 'V'), lv(r.Nb, 4 * LSB, LSB));
      M.set('dig', fmtSI(r.Nd * 1e-6, 'V'), lv(r.Nd, 4 * LSB, LSB));
      M.set('dc', fmtSI(r.Ndc * 1e-6, 'V'), lv(r.Ndc, 4 * LSB, LSB));
      const lsb = r.total / LSB;
      M.set('tot', sig(lsb, 2) + ' LSB', lv(lsb, 4, 1.5), Math.log10(1 + lsb) / 2);
      M.set('emi', `${sig(r.emiWorst, 2)} dB (${r.emiWho})`, r.emiWorst < 0 ? 'bad' : r.emiWorst < 6 ? 'warn' : 'good');

      // waveform
      const ts = [], ys = [];
      const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
      for (let i = 0; i <= 1000; i++) {
        const t = i / 100; // µs
        let y = r.Ndc;
        for (const t0 of [0.3, 2.3, 4.3, 6.3, 8.3, 1.1, 3.1, 5.1, 7.1, 9.1]) {
          if (t >= t0) { const u = t - t0; y += r.Nb * Math.exp(-u / 0.12) * Math.sin(2 * Math.PI * u / 0.06) * (t0 % 2 < 1 ? 1 : -0.8); }
        }
        y += (r.dig.usb || 0) * 0.6 * rnd(i);
        if (t > 4 && t < 7) y += (r.dig.spi || 0) * rnd(i * 7 + 3) * (Math.sin(2 * Math.PI * t * 5) > 0 ? 1 : 0.4);
        ts.push(t); ys.push(y);
      }
      const yr = Math.max(4 * LSB, ...ys.map(Math.abs)) * 1.15;
      plot.draw({ series: [{ x: ts, y: ys, color: 'var(--bad)', width: 1.3 }], bands: [{ y0: -LSB, y1: LSB, color: 'var(--good)', alpha: 0.18 }], hlines: [{ y: LSB, color: 'var(--good)', label: '±1 LSB', dash: [3, 3] }], range: { ymin: -yr, ymax: yr } });

      // verdicts
      const items = [];
      if (r.Nb > LSB) items.push({ level: r.Nb > 4 * LSB ? 'bad' : 'warn', html: `<b>Buck too close to the analog section</b> (${sig(r.db, 2)} mm). Its switching field couples ${sig(r.Nb / LSB, 2)} LSB of spikes at 500 kHz and its harmonics. The field falls off as ~1/d³: doubling the distance cuts it ~8×.` });
      else items.push({ level: 'good', html: `Buck is ${sig(r.db, 2)} mm from the analog section: its magnetic field has died away (${sig(r.Nb / LSB, 2)} LSB).` });
      if (r.Nd > LSB) {
        const who = (r.dig.usb || 0) > (r.dig.spi || 0) ? 'USB 3' : 'SPI';
        items.push({ level: r.Nd > 4 * LSB ? 'bad' : 'warn', html: `<b>${who}</b> currents (forward or return) pass close to the analog input: ${sig(r.Nd / LSB, 2)} LSB. ${st.mode === 'split' ? 'In a split plane, returns that cross away from the tie run along the gap to it, often right through the analog area.' : 'Move the route, or the analog section, so they don\'t share space.'}` });
      } else items.push({ level: 'good', html: 'Fast digital routes and their return currents stay away from the analog input.' });
      if (r.Ndc > LSB) items.push({ level: r.Ndc > 4 * LSB ? 'bad' : 'warn', html: `<b>DC ground shift ${fmtSI(r.Ndc * 1e-6, 'V')}</b> between the sensor and ADC grounds: the module's 4 A return current spreads through the plane between them. Keep the sensor and ADC out of the buck→module current path.` });
      else if (st.mode !== 'star') items.push({ level: 'good', html: `DC ground shift between sensor and ADC is only ${fmtSI(r.Ndc * 1e-6, 'V')}: the big return currents flow elsewhere.` });
      if (st.mode === 'star') items.push({ level: 'info', html: 'Star ground: no other circuit\'s DC current shares the analog ground traces, so the DC shift ≈ 0. That is the strength of star grounding.' });
      if (r.vf > 1.5) items.push({ level: 'bad', html: `The analog input's own return path is no longer under it (loop area ${sig(r.aArea, 2)} mm²), so it picks up ×${sig(r.vf, 2)} more of every field.` });
      if (st.mode === 'split') {
        for (const id of ['usb', 'spi']) {
          const c = C.find(x => x.id === id), a = st.pos[c.a], b = st.pos[c.b];
          if (side(a) !== side(b)) {
            const t = (st.sx - a.x) / (b.x - a.x), Xy = a.y + t * (b.y - a.y);
            if (Math.abs(Xy - st.ty) > 5) items.push({ level: 'bad', html: `${c.name} crosses the split ${sig(Math.abs(Xy - st.ty), 2)} mm away from the tie. Its return current detours along the gap (Sierra §7.3.1.1: tracks must cross <i>only</i> over the tie).` });
            else items.push({ level: 'good', html: `${c.name} crosses the split right over the tie, so its return path is intact.` });
          }
        }
        const adc = st.pos.adc;
        if (Math.abs(adc.x - st.sx) < B.adc.w / 2 && Math.abs(adc.y - st.ty) < 12) items.push({ level: 'good', html: 'The ADC straddles the split with the tie underneath it, the textbook mixed-signal arrangement (Sierra §7.3.1.8).' });
      }
      if (r.emiWorst < 6) items.push({ level: r.emiWorst < 0 ? 'bad' : 'warn', html: `${r.emiWho} loop radiates with ${sig(r.emiWorst, 2)} dB margin to FCC Class B (loop area ${sig(r.routes[r.emiWho === 'SPI' ? 'spi' : 'usb'].A, 3)} mm²).` });
      for (const id of ['pwr', 'usb', 'sns']) {
        const b = B[id], p = st.pos[id];
        const gap = Math.min(p.x - b.w / 2, BW - p.x - b.w / 2, p.y - b.h / 2, BH - p.y - b.h / 2);
        if (gap > 3) items.push({ level: 'warn', html: `${b.label} connector is ${sig(gap, 2)} mm from the board edge. Connectors belong on the edge: cable currents and ESD should enter at the perimeter, not the middle.` });
      }
      V.set(items);
      const lsbTxt = sig(LSB, 3);
      E.set(`<p>Total error ≈ <b>${sig(lsb, 2)} LSB</b> of a 16-bit ADC (1 LSB = ${lsbTxt} µV on a 2.5 V reference). A good layout keeps this near or below 1 LSB.</p>
        <p>Notice what the ground strategy changes. <b>Solid plane</b>: HF returns stay under their own routes, so noise depends only on placement. <b>Split</b>: the analog island is quiet at DC, but any route crossing the gap away from the tie creates a big loop. <b>Star</b>: zero DC sharing, but huge HF loops. Placement fixes problems that ground tricks only move around.</p>`);
    }
    loadPreset('naive');
  })();

  /* =================================================================
     4.3  Power islands vs. signal reference
     ================================================================= */
  (function labIslands() {
    const host = document.getElementById('lab-islands'); if (!host) return;
    const L = lab(host, { title: 'A fast signal routed over a split power layer' });
    const BW = 120, BH = 60, PX = 5;
    const ISL = [
      { id: '5V', x: 2, y: 2, w: 44, h: 56, c: '#7a3f45', t: '5 V' },
      { id: '3V3', x: 48, y: 2, w: 40, h: 30, c: '#7a5a2a', t: '3.3 V' },
      { id: '1V8', x: 48, y: 34, w: 40, h: 24, c: '#553a75', t: '1.8 V' },
      { id: '1V0', x: 90, y: 2, w: 28, h: 56, c: '#6e6a2a', t: '1.0 V' },
    ];
    const CAPS = [{ x: 22, y: 8, i: '5V' }, { x: 30, y: 50, i: '5V' }, { x: 72, y: 8, i: '3V3' }, { x: 80, y: 52, i: '1V8' }, { x: 104, y: 30, i: '1V0' }];
    const st = { ref: 'pwr', stitch: false, pts: [{ x: 10, y: 30 }, { x: 62, y: 20 }, { x: 108, y: 44 }] };
    const sRef = seg({ label: 'This signal layer is next to…', options: [{ v: 'pwr', label: 'the split power layer' }, { v: 'gnd', label: 'a solid GND layer' }], value: st.ref, onChange: v => { st.ref = v; update(); } });
    const cSt = check({ label: 'Add stitching capacitors at every boundary crossing', onChange: v => { st.stitch = v; update(); } });
    L.controls.append(sRef.el, cSt.el, el('div', { class: 'hint' }, 'Drag the three blue handles to reroute the signal. Small squares are the decoupling capacitors on each island (PWR↔GND).'));
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX} ${BH * PX}` });
    const gI = svg('g'), gR = svg('g'), gH = svg('g');
    S.append(gI, gR, gH);
    L.stage.append(S);
    const M = meters(L.stage, [{ key: 'n', label: 'Reference changes' }, { key: 'det', label: 'Return detour (total)' }, { key: 'rho', label: 'Worst reflection (100 ps edge)', bar: true }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const H = st.pts.map(() => svg('circle', { r: 9, fill: 'rgba(92,184,255,.3)', stroke: 'var(--sig)', 'stroke-width': 2 }));
    gH.append(...H);
    H.forEach((h, i) => PCB.draggable(S, h, { onMove: p => { st.pts[i] = { x: clamp(p.x / PX, 2, BW - 2), y: clamp(p.y / PX, 2, BH - 2) }; update(); } }));
    const islandAt = p => { for (const I of ISL) if (p.x >= I.x && p.x <= I.x + I.w && p.y >= I.y && p.y <= I.y + I.h) return I.id; return null; };
    const nearestCap = (p, id) => CAPS.filter(c => c.i === id).reduce((b, c) => (geo.dist(p, c) < geo.dist(p, b) ? c : b));
    function update() {
      const pts = st.pts;
      // walk the route, find island transitions
      const cross = [];
      const total = geo.polyLen(pts);
      let prev = null, prevPt = null;
      for (let s = 0; s <= total; s += 0.25) {
        const q = geo.along(pts, s), id = islandAt(q);
        if (id && prev && id !== prev) cross.push({ x: q.x, y: q.y, a: prev, b: id });
        if (id) { prev = id; prevPt = q; }
      }
      gI.innerHTML = '';
      for (const I of ISL) {
        gI.append(svg('rect', { x: I.x * PX, y: I.y * PX, width: I.w * PX, height: I.h * PX, rx: 4, fill: I.c, opacity: st.ref === 'pwr' ? 0.9 : 0.25 }),
          svg('text', { x: (I.x + 2) * PX, y: (I.y + 6) * PX, fill: '#f3e9e9', 'font-size': 12, 'font-weight': 650, opacity: st.ref === 'pwr' ? 1 : 0.4, text: I.t }));
      }
      for (const c of CAPS) gI.append(svg('rect', { x: (c.x - 1.6) * PX, y: (c.y - 1) * PX, width: 3.2 * PX, height: 2 * PX, fill: '#c9b48a', stroke: '#3b2f1a', opacity: st.ref === 'pwr' ? 1 : 0.4 }));
      if (st.ref === 'gnd') gI.append(svg('rect', { x: 0, y: 0, width: BW * PX, height: BH * PX, fill: 'var(--plane)', opacity: 0.55 }),
        svg('text', { x: BW * PX / 2, y: BH * PX - 12, 'text-anchor': 'middle', fill: 'var(--gnd)', 'font-size': 12, 'font-weight': 600, text: 'Signal references the solid GND layer: the islands (faded) are on the far side of it' }));
      gR.innerHTML = '';
      let det = 0, worst = 0;
      gR.append(svg('path', { d: geo.pathD(pts.map(p => ({ x: p.x * PX, y: p.y * PX }))), fill: 'none', stroke: 'var(--sig)', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
      if (st.ref === 'pwr') for (const x of cross) {
        if (st.stitch) {
          gR.append(svg('rect', { x: (x.x - 2.4) * PX, y: (x.y + 1.8) * PX, width: 4.8 * PX, height: 2.4 * PX, rx: 2, fill: '#ffe2a8', stroke: '#3b2f1a' }));
          const Lx = 0.8; worst = Math.max(worst, phys.rhoSeriesL(Lx * 1e-9, 50, 100e-12));
        } else {
          const ca = nearestCap(x, x.a), cb = nearestCap(x, x.b);
          const d = geo.dist(x, ca) + geo.dist(ca, cb) + geo.dist(cb, x);
          det += d;
          const A = Math.abs(geo.area([x, ca, cb])) + 1;
          const P = d / 1000;
          const Lx = phys.mu0 / (2 * Math.PI) * P * Math.log(Math.max(1.01, 8 * A * 1e-6 / (P * 1e-4))) * 1e9 + 1.2;
          worst = Math.max(worst, phys.rhoSeriesL(Lx * 1e-9, 50, 100e-12));
          gR.append(svg('path', { d: geo.pathD([x, ca, cb, x].map(p => ({ x: p.x * PX, y: p.y * PX }))), fill: 'rgba(255,123,58,.12)', stroke: 'var(--ret)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }));
          gR.append(svg('text', { x: x.x * PX, y: (x.y - 2.5) * PX, 'text-anchor': 'middle', fill: '#ff8a7a', 'font-size': 15, 'font-weight': 800, text: '✕' }));
        }
      }
      H.forEach((h, i) => setAttrs(h, { cx: st.pts[i].x * PX, cy: st.pts[i].y * PX }));
      const n = st.ref === 'pwr' ? cross.length : 0;
      M.set('n', String(n), n ? (st.stitch ? 'warn' : 'bad') : 'good');
      M.set('det', n && !st.stitch ? sig(det, 3) + ' mm' : '—', n && !st.stitch ? 'bad' : 'good');
      M.set('rho', sig(worst * 100, 2) + '%', worst > 0.1 ? 'bad' : worst > 0.03 ? 'warn' : 'good', worst / 0.5);
      const items = [];
      if (st.ref === 'gnd') items.push({ level: 'good', html: 'The signal\'s return flows in the solid GND layer right under it. Island boundaries on the power layer are invisible to it. <b>This is the fix.</b>' });
      else if (!n) items.push({ level: 'good', html: 'The route stays within one island, so its return path (on that island) is continuous. Still, its endpoints need caps to GND, because the driver and receiver reference ground.' });
      else if (st.stitch) items.push({ level: 'warn', html: `${n} crossing(s), each bridged by a stitching capacitor. Much better, but each cap adds ~0.8 nH including vias (${sig(worst * 100, 2)}% bump at 100 ps) and dumps signal return current onto the rails.` });
      else items.push({ level: 'bad', html: `The route crosses <b>${n}</b> island boundar${n > 1 ? 'ies' : 'y'}. At each one the return current must find a way from one rail to the other: down a decoupling cap to GND and back up another (orange loops), adding ${sig(det, 3)} mm of detour.` });
      if (st.ref === 'pwr' && n) items.push({ level: 'info', html: 'Every return detour also injects the signal\'s edges into two power rails, so the noise shows up on unrelated circuits.' });
      V.set(items);
      E.set('<p>A plane only works as a return path if it is <b>continuous under the signal</b>. Power layers are almost always split, because a carrier board has 4–8 rails. That is fine for delivering power, but bad as a reference.</p><p>A stackup like SIG / GND / SIG / PWR / GND / SIG gives every signal layer a ground neighbour (lesson 2). Islands then carry power only.</p>');
    }
    update();
  })();

  /* =================================================================
     4.4  ESD at the connector
     ================================================================= */
  (function labESD() {
    const host = document.getElementById('lab-esd'); if (!host) return;
    const L = lab(host, { title: 'An ESD strike on a USB connector' });
    const st = { x: 10, gnd: 'pad', shell: 'chassis' };
    const GND = { pad: { L: 0.4, t: 'via in/at the pad' }, t3: { L: 3.4, t: 'via after a 3 mm trace' }, t10: { L: 10.4, t: 'via after a 10 mm trace' } };
    const sX = slider({ label: 'TVS diode distance from connector', min: 1, max: 60, step: 0.5, value: st.x, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.x = v; update(); } });
    const sG = seg({ label: 'TVS ground connection', options: [{ v: 'pad', label: 'via at pad' }, { v: 't3', label: '3 mm trace' }, { v: 't10', label: '10 mm trace' }], value: st.gnd, onChange: v => { st.gnd = v; update(); } });
    const sS = seg({ label: 'Connector shell', options: [{ v: 'chassis', label: '→ chassis' }, { v: 'gnd', label: '→ GND at edge' }, { v: 'float', label: 'floating' }], value: st.shell, onChange: v => { st.shell = v; update(); } });
    const zap = el('button', { class: 'btn primary', onclick: () => fire() }, '⚡ Zap: 8 kV contact discharge');
    L.controls.append(sX.el, sG.el, sS.el, zap);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 220' });
    const gS = svg('g'), gZ = svg('g');
    S.append(gS, gZ);
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Voltage at the protected IC pin during the strike', height: 180, xlabel: 'ns', ylabel: 'V', xmin: 0, xmax: 6, xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'Lg', label: 'TVS ground inductance' }, { key: 'pk', label: 'Peak at IC pin', bar: true }, { key: 'trav', label: 'ESD current travels' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'IEC 61000-4-2 8 kV contact ≈ 30 A peak, 0.8 ns rise. TVS modelled as 9 V clamp + 0.3 Ω; ground path ≈ 1 nH/mm + 0.4 nH per via. Danger thresholds are illustrative.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const PXM = 8, X0 = 70; // px per mm along the trace
    let zapT = -1;
    function geom() {
      const xt = X0 + st.x * PXM;
      return { xt, yT: 100, xIC: 590 };
    }
    function draw() {
      const { xt, yT, xIC } = geom();
      gS.innerHTML = '';
      gS.append(svg('rect', { x: 0, y: 30, width: 640, height: 180, fill: 'var(--plane)', opacity: 0.55 }),
        svg('text', { x: 632, y: 204, 'text-anchor': 'end', fill: 'var(--gnd)', 'font-size': 10.5, text: 'GND plane' }));
      // chassis strip
      if (st.shell === 'chassis') gS.append(svg('rect', { x: 0, y: 30, width: 14, height: 180, fill: '#8a8f94' }), svg('text', { x: 18, y: 204, fill: '#c9d1d6', 'font-size': 10.5, text: 'chassis' }));
      // connector
      gS.append(svg('rect', { x: 6, y: 64, width: 56, height: 72, rx: 6, fill: '#3b4045', stroke: '#c9d1d6', 'stroke-width': 2 }),
        svg('text', { x: 34, y: 58, 'text-anchor': 'middle', fill: '#c9d1d6', 'font-size': 10.5, text: 'USB shell' }));
      if (st.shell === 'gnd') gS.append(svg('rect', { x: 30, y: 136, width: 6, height: 20, fill: 'var(--copper)' }));
      if (st.shell === 'chassis') gS.append(svg('rect', { x: 6, y: 96, width: 8, height: 8, fill: '#c9d1d6' }));
      // trace
      gS.append(svg('rect', { x: 62, y: yT - 2.5, width: xIC - 62, height: 5, fill: 'var(--copper)' }));
      // IC
      gS.append(svg('rect', { x: xIC, y: 70, width: 44, height: 60, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x: xIC + 22, y: 104, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: 'USB IC' }));
      // TVS
      const gl = st.gnd === 'pad' ? 0 : st.gnd === 't3' ? 3 : 10;
      gS.append(svg('rect', { x: xt - 9, y: yT + 6, width: 18, height: 14, rx: 2, fill: '#222', stroke: '#ffd166' }), svg('text', { x: xt, y: yT + 35 + gl * PXM * 0.6, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, text: 'TVS' }));
      gS.append(svg('rect', { x: xt - 1.5, y: yT + 2, width: 3, height: 5, fill: 'var(--copper)' }));
      gS.append(svg('rect', { x: xt - 1.5, y: yT + 20, width: 3 + (gl ? 0 : 0), height: 4 + gl * PXM * 0.6, fill: 'var(--copper)' }));
      gS.append(svg('circle', { cx: xt, cy: yT + 26 + gl * PXM * 0.6, r: 4.5, fill: 'var(--copper)', stroke: '#000' }));
      gS.append(svg('text', { x: (62 + xt) / 2, y: yT - 10, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5, text: `${sig(st.x, 2)} mm` }));
    }
    function fire() { zapT = performance.now(); }
    PCB.whenVisible(S, ts => {
      gZ.innerHTML = '';
      if (zapT < 0) return;
      const u = (ts - zapT) / 1400;
      if (u > 1) { zapT = -1; return; }
      const { xt, yT } = geom();
      const gl = st.gnd === 'pad' ? 0 : st.gnd === 't3' ? 3 : 10;
      // path: connector pin → TVS → down to via
      const pts = [{ x: 62, y: yT }, { x: xt, y: yT }, { x: xt, y: yT + 26 + gl * PXM * 0.6 }];
      const tot = geo.polyLen(pts);
      for (let k = 0; k < 6; k++) {
        const s = (u * 1.4 - k * 0.04) * tot;
        if (s < 0 || s > tot) continue;
        const q = geo.along(pts, s);
        gZ.append(svg('circle', { cx: q.x, cy: q.y, r: 7 - k, fill: '#fff6b0', opacity: 0.9 - k * 0.13 }));
      }
      if (u < 0.15) gZ.append(svg('path', { d: 'M 34 8 L 28 30 L 40 30 L 30 62', fill: 'none', stroke: '#fff6b0', 'stroke-width': 3 }));
      if (st.shell === 'float' && u > 0.1 && u < 0.4) gZ.append(svg('path', { d: `M 62 120 L 90 112 L 80 106 L 120 ${yT + 2}`, fill: 'none', stroke: '#ff6b6b', 'stroke-width': 2.5 }));
    });
    function update() {
      draw();
      const Lg = GND[st.gnd].L;
      const Ltr = st.x * 1.0; // nH — trace between connector and TVS
      const ts = [], vs = [];
      let pk = 0;
      for (let i = 0; i <= 600; i++) {
        const t = i / 100;
        const I = t < 0.8 ? 30 * t / 0.8 : 30 * Math.exp(-(t - 0.8) / 1.6) + (t > 2 ? 8 * Math.exp(-(t - 2) / 12) * (1 - Math.exp(-(t - 2) / 2)) : 0);
        const dIdt = t < 0.8 ? 30 / 0.8 : -30 / 1.6 * Math.exp(-(t - 0.8) / 1.6);
        let v = (I > 0.2 ? 9 : I * 45) + I * 0.3 + Lg * dIdt;
        ts.push(t); vs.push(v); pk = Math.max(pk, v);
      }
      plot.draw({ series: [{ x: ts, y: vs, color: 'var(--bad)', width: 2.2, fill: true, fillAlpha: 0.1 }], hlines: [{ y: 40, color: 'var(--warn)', label: 'illustrative danger level for an I/O pin' }], range: { ymin: Math.min(-5, ...vs) * 1.1, ymax: Math.max(40, pk * 1.12) } });
      M.set('Lg', sig(Lg, 2) + ' nH', Lg > 2 ? 'bad' : Lg > 1 ? 'warn' : 'good');
      M.set('pk', sig(pk, 3) + ' V', pk > 80 ? 'bad' : pk > 40 ? 'warn' : 'good', pk / 450);
      M.set('trav', sig(st.x, 2) + ' mm', st.x > 10 ? 'bad' : st.x > 4 ? 'warn' : 'good');
      const items = [];
      items.push({ level: pk > 80 ? 'bad' : pk > 40 ? 'warn' : 'good', html: `The IC pin sees <b>${sig(pk, 3)} V</b> peak: the 9 V clamp plus ${sig(Lg, 2)} nH × 37.5 A/ns ≈ ${sig(Lg * 37.5, 3)} V across the TVS's ground connection. <b>The TVS is only as good as its ground path.</b>` });
      if (st.x > 4) items.push({ level: st.x > 10 ? 'bad' : 'warn', html: `The 30 A pulse runs ${sig(st.x, 2)} mm along the signal trace (≈${sig(Ltr, 2)} nH) before it is diverted, coupling into every trace it passes and radiating from that loop.` });
      else items.push({ level: 'good', html: 'The strike is diverted within a few mm of the connector, before it reaches the rest of the board.' });
      if (st.shell === 'chassis') items.push({ level: 'good', html: 'A shell bonded to chassis sends discharges to the shell (the most common case) straight to the enclosure, without crossing your ground plane.' });
      if (st.shell === 'gnd') items.push({ level: 'info', html: 'A shell tied to GND at the connector is acceptable: the current enters the plane at the board edge. Keep sensitive circuits away from that edge.' });
      if (st.shell === 'float') items.push({ level: 'bad', html: 'A floating shell charges up and <b>arcs to whatever is nearest</b>, often a signal pin or trace (red spark). Always give shells a defined, low-inductance connection.' });
      V.set(items);
      E.set('<p>ESD has a sub-ns rise time, so inductance dominates: V = L·di/dt ≈ 37 V per nH. A 3 mm ground trace on the TVS can add more voltage than the TVS clamps at.</p><p>Same logic as decoupling capacitors (lesson 5): what matters is the <b>loop</b> from the threat, through the protection part, to ground. Make it tiny and put it at the entry point.</p>');
    }
    update();
  })();

  /* ================================================================= quiz */
  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'Your board has 5 V, 3.3 V and 1.8 V rails from non-isolated regulators. How many ground nets/planes?', opts: ['Three, one per voltage', 'One shared ground; separate the noisy and sensitive circuits by placement', 'Two: analog and digital, always'], a: 1, ex: 'All rails and signals reference the same ground, and each regulator\'s GND pin joins its input and output domains anyway. Separate grounds only make sense with galvanic isolation.' },
    { q: 'In a split AGND/DGND design, where must the SPI lines from the SoC to the ADC cross the split?', opts: ['Anywhere; digital signals don\'t care', 'Directly over the tie bridge between AGND and DGND', 'As far as possible from the tie'], a: 1, ex: 'The return current can only cross at the tie. Crossing elsewhere forces it to run along the gap to the tie, creating a large loop that radiates and runs right through the analog area.' },
    { q: 'The TVS diode is right next to the USB connector but its GND pad reaches a via through a 10 mm trace. Main problem?', opts: ['None: placement next to the connector is all that matters', '~10 nH in the ground path adds hundreds of volts at ESD edge rates', 'The trace will fuse'], a: 1, ex: 'V = L·di/dt with ~37 A/ns gives ~37 V per nH. The protection loop must be tiny: put a via at the pad.' },
    { q: 'Why might a star ground give the lowest DC ground shift but still be the worst choice for a Jetson carrier board?', opts: ['It uses too much copper', 'Every return path detours via the star point, so high-frequency loops become huge (EMI and crosstalk)', 'Star grounds don\'t work with ADCs'], a: 1, ex: 'Star grounding stops circuits from sharing DC return paths, but at high frequency the long, separated returns create big loop areas. Boards with fast edges need a plane.' },
  ]);
})();
