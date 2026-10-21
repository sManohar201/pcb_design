/* Lesson 3 — Return current: every signal is a loop */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, phys, fmtSI, sig, clamp, geo, legend } = PCB;

  PCB.renderChrome({ lesson: 3 });

  /* =================================================================
     3.2  Return current on a ground plane (DC field solve + HF path)
     ================================================================= */
  (function labPlane() {
    const host = document.getElementById('lab-plane'); if (!host) return;
    const L = lab(host, { title: 'Return current on a ground plane' });
    const BW = 120, BH = 72, PX = 5;               // board in mm, px per mm
    const D = { x: 17, y: 36 }, LD = { x: 103, y: 36 };   // signal pins
    const GD = { x: 13.5, y: 41 }, GL = { x: 106.5, y: 41 }; // ground vias next to them
    const st = { f: 1e8, h: 0.2, slot: true, stitch: false, sx: 60, sy: 26, slen: 36, wp: [{ x: 40, y: 12 }, { x: 80, y: 12 }] };
    const FC = 1e5; // R/L crossover of a typical plane path (order of magnitude)

    // ---------- controls
    const fmtF = f => (f < 10 ? '≈ DC' : fmtSI(f, 'Hz'));
    const sF = slider({ label: 'Signal frequency', min: 1, max: 3e9, log: true, value: st.f, fmt: fmtF, onInput: v => { st.f = v; refresh(false); } });
    const fBtns = el('div', { class: 'btn-row' }, [['DC', 1], ['1 kHz', 1e3], ['100 kHz', 1e5], ['10 MHz', 1e7], ['1 GHz', 1e9]].map(([t, f]) => el('button', { class: 'btn', onclick: () => { st.f = f; sF.set(f); refresh(false); } }, t)));
    const sH = slider({ label: 'Dielectric height to plane', min: 0.07, max: 1.0, log: true, value: st.h, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.h = v; refresh(false); } });
    const cSlot = check({ label: 'Slot in the ground plane (drag it on the board)', checked: true, onChange: v => { st.slot = v; refresh(true); } });
    const sLen = slider({ label: 'Slot length', min: 6, max: 64, step: 1, value: st.slen, fmt: v => v + ' mm', onInput: v => { st.slen = v; clampSlot(); refresh(true); } });
    const cStitch = check({ label: 'Fix: stitching capacitor across the slot at the crossing', checked: false, onChange: v => { st.stitch = v; refresh(false); } });
    const route = (pts) => () => { st.wp = pts.map(p => ({ ...p })); refresh(false); };
    L.controls.append(sF.el, fBtns, sH.el, cSlot.el, sLen.el, cStitch.el,
      el('div', { class: 'ctl-group-title' }, 'Route shape'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: route([{ x: 40, y: 36 }, { x: 70, y: 36 }]) }, 'Straight'),
        el('button', { class: 'btn', onclick: route([{ x: 40, y: 12 }, { x: 80, y: 12 }]) }, 'Detour north'),
        el('button', { class: 'btn', onclick: route([{ x: 35, y: 60 }, { x: 85, y: 60 }]) }, 'Around the slot')));

    // ---------- stage
    const S = svg('svg', { class: 'viz board', viewBox: `0 0 ${BW * PX} ${BH * PX}` });
    const off = document.createElement('canvas'); off.width = BW * 2; off.height = BH * 2;
    const heatImg = svg('image', { x: 0, y: 0, width: BW * PX, height: BH * PX, preserveAspectRatio: 'none', style: 'image-rendering:auto' });
    const planeBg = svg('rect', { x: 0, y: 0, width: BW * PX, height: BH * PX, fill: 'var(--plane)' });
    const slotG = svg('g');
    const slotR = svg('rect', { fill: '#06150f', stroke: '#2f6b51', 'stroke-width': 1, rx: 3 });
    const slotHit = svg('rect', { fill: 'transparent' });
    slotG.append(slotR, slotHit);
    const retPaths = svg('g');
    const parts = svg('g');
    const sigDots = svg('g');
    const traceP = svg('path', { fill: 'none', stroke: 'var(--sig)', 'stroke-width': 4.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.95 });
    const stitchG = svg('g');
    const comps = svg('g', null,
      svg('rect', { x: 2 * PX, y: 29 * PX, width: 13 * PX, height: 16 * PX, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }),
      svg('text', { x: 8.5 * PX, y: 35 * PX, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: 'driver' }),
      svg('rect', { x: 105 * PX, y: 29 * PX, width: 13 * PX, height: 16 * PX, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }),
      svg('text', { x: 111.5 * PX, y: 35 * PX, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: 'load' }));
    const vias = svg('g', null,
      svg('circle', { cx: GD.x * PX, cy: GD.y * PX, r: 5, fill: 'var(--copper)', stroke: '#000', 'stroke-width': 1 }),
      svg('circle', { cx: GL.x * PX, cy: GL.y * PX, r: 5, fill: 'var(--copper)', stroke: '#000', 'stroke-width': 1 }),
      svg('text', { x: GD.x * PX, y: (GD.y + 5.5) * PX, 'text-anchor': 'middle', fill: 'var(--gnd)', 'font-size': 10, text: 'GND via' }),
      svg('text', { x: GL.x * PX, y: (GL.y + 5.5) * PX, 'text-anchor': 'middle', fill: 'var(--gnd)', 'font-size': 10, text: 'GND via' }));
    const handles = st.wp.map(() => svg('circle', { r: 9, fill: 'rgba(92,184,255,.25)', stroke: 'var(--sig)', 'stroke-width': 2 }));
    const freqLbl = svg('text', { x: 8, y: 16, fill: '#e8efe9', 'font-size': 12.5, 'font-weight': 600 });
    const exLbl = svg('text', { x: BW * PX - 8, y: BH * PX - 8, 'text-anchor': 'end', fill: '#9fb3a8', 'font-size': 10, text: 'return-current width exaggerated ×3 for visibility' });
    S.append(planeBg, heatImg, slotG, retPaths, parts, traceP, sigDots, stitchG, comps, vias, ...handles, freqLbl, exLbl);
    L.stage.append(S, legend([['var(--sig)', 'signal trace (top layer)'], ['var(--ret)', 'return current in the GND plane'], ['#ffd166', 'current density (heat)']]));
    const M = meters(L.stage, [
      { key: 'reg', label: 'Return current regime' }, { key: 'area', label: 'Loop area' }, { key: 'Lp', label: 'Loop inductance' },
      { key: 'det', label: 'Detour around slot' }, { key: 'emi', label: 'Radiated @3 m (20 mA)', bar: true },
    ]);
    L.stage.append(el('div', { class: 'model-note' }, 'Low frequency: solved resistive current flow in the plane. High frequency: return under the trace with a 1/(1+(x/H)²) profile, detouring around slot ends (split inversely to detour length). Radiation: small-loop formula (Ott) vs FCC Class B. Illustrative, not a field solver.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    // ---------- interaction
    handles.forEach((hnd, i) => PCB.draggable(S, hnd, {
      onMove: p => { st.wp[i] = { x: clamp(p.x / PX, 3, BW - 3), y: clamp(p.y / PX, 3, BH - 3) }; refresh(false); },
    }));
    let grab = null;
    PCB.draggable(S, slotHit, {
      onStart: p => { grab = { dx: p.x / PX - st.sx, dy: p.y / PX - st.sy }; },
      onMove: p => { st.sx = p.x / PX - grab.dx; st.sy = p.y / PX - grab.dy; clampSlot(); refresh(true); },
    });
    function clampSlot() {
      st.sx = clamp(st.sx, 24, BW - 24);
      st.sy = clamp(st.sy, st.slen / 2, BH - st.slen / 2);
    }
    const slotY = () => ({ y0: st.sy - st.slen / 2, y1: st.sy + st.slen / 2 });

    // ---------- DC field (solved)
    const NX = BW, NY = BH;
    let field = null, phiWarm = null, jref = 1;
    function solveDC(first) {
      const N = NX * NY;
      const cond = new Float32Array(N).fill(1), src = new Float32Array(N), fixed = new Uint8Array(N), fv = new Float32Array(N);
      if (st.slot) {
        const { y0, y1 } = slotY();
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
          const x = i + 0.5, y = j + 0.5;
          if (Math.abs(x - st.sx) <= 1.0 && y >= y0 && y <= y1) cond[j * NX + i] = 0;
        }
      }
      src[Math.floor(GL.y) * NX + Math.floor(GL.x)] = 1;
      const kd = Math.floor(GD.y) * NX + Math.floor(GD.x); fixed[kd] = 1; fv[kd] = 0;
      field = PCB.solveField({ nx: NX, ny: NY, cond, src, fixed, fixedVal: fv, iters: first || !phiWarm ? 1400 : 350, phi0: phiWarm });
      phiWarm = field.phi;
      const vals = Array.from(field.jm).filter(v => v > 0).sort((a, b) => a - b);
      jref = vals[Math.floor(vals.length * 0.97)] || 1;
    }
    function sampleJ(x, y) { // bilinear on cell centres
      const fx = clamp(x - 0.5, 0, NX - 1.001), fy = clamp(y - 0.5, 0, NY - 1.001);
      const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
      const k = j * NX + i;
      const lerp4 = a => (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + NX] * (1 - u) + a[k + NX + 1] * u) * v;
      return { jx: lerp4(field.jx), jy: lerp4(field.jy), jm: lerp4(field.jm) };
    }

    // ---------- HF return paths with slot detours
    function detour(base, choose) {
      if (!st.slot || st.stitch) return { pts: base, extra: 0, cross: [] };
      const { y0, y1 } = slotY(), e = 1.8;
      const topOK = y0 > 2.5, botOK = y1 < BH - 2.5; // need room to flow around the end
      const s0 = { x: st.sx, y: y0 }, s1 = { x: st.sx, y: y1 };
      const out = [base[0]], cross = [];
      let extra = 0;
      for (let i = 0; i < base.length - 1; i++) {
        const a = base[i], b = base[i + 1];
        const X = geo.segX(a, b, s0, s1);
        if (X) {
          const sgn = Math.sign(b.x - a.x) || 1;
          const dTop = X.y - (y0 - e), dBot = (y1 + e) - X.y;
          let top;
          if (!topOK) top = false; else if (!botOK) top = true; else top = (choose === 'near') === (dTop <= dBot);
          const yE = top ? y0 - e : y1 + e;
          const xa = st.sx - sgn * e, xb = st.sx + sgn * e;
          // current spreads as it turns around the slot end: bulge grows with detour distance
          const bw = 0.45 * Math.abs(X.y - yE), ym = (X.y + yE) / 2;
          const ins = [{ x: X.x, y: X.y }, { x: xa, y: X.y }, { x: xa - sgn * bw, y: ym }, { x: xa, y: yE }, { x: xb, y: yE }, { x: xb + sgn * bw, y: ym }, { x: xb, y: X.y }];
          out.push(...ins.slice(1));
          extra += geo.polyLen(ins.concat([{ x: X.x, y: X.y }]));
          cross.push({ x: X.x, y: X.y });
        }
        out.push(b);
      }
      return { pts: out, extra, cross };
    }
    let model = null;
    function buildModel() {
      const T = [D, st.wp[0], st.wp[1], LD];
      const R0 = [GL, LD, st.wp[1], st.wp[0], D, GD];
      const near = detour(R0, 'near'), far = detour(R0, 'far');
      let variants;
      if (!near.cross.length) variants = [{ ...near, w: 1 }];
      else if (Math.abs(near.extra - far.extra) < 1e-6) variants = [{ ...near, w: 1 }];
      else { const s = near.extra + far.extra; variants = [{ ...near, w: far.extra / s }, { ...far, w: near.extra / s }]; }
      const dc = detour([GL, GD], 'near');
      const F = [GD, D, st.wp[0], st.wp[1], LD, GL];
      const loopA = pts => Math.abs(geo.area(F.concat(pts.slice(1))));
      variants.forEach(v => { v.area = loopA(v.pts); v.len = geo.polyLen(v.pts); });
      const tlen = geo.polyLen(T);
      model = { T, variants, dcA: loopA(dc.pts), dcLen: geo.polyLen(dc.pts), tlen, cross: near.cross, extra: variants.reduce((s, v) => s + v.w * v.extra, 0) };
    }
    const wf = () => (st.f < 10 ? 0 : 1 / (1 + Math.pow(FC / st.f, 2)));

    // ---------- heat map
    function renderHeat() {
      const g = off.getContext('2d');
      const img = g.createImageData(off.width, off.height);
      const w = wf(), hs = clamp(st.h * 3, 0.5, 4);
      for (let py = 0; py < off.height; py++) for (let px = 0; px < off.width; px++) {
        const x = (px + 0.5) / 2, y = (py + 0.5) / 2;
        let tdc = 0, thf = 0;
        if (w < 0.999) { const s = sampleJ(x, y); tdc = Math.sqrt(clamp(s.jm / jref, 0, 1.5)) ; }
        if (w > 0.001) for (const v of model.variants) { const d = geo.polyDist({ x, y }, v.pts).d; thf += v.w / (1 + (d / hs) * (d / hs)); }
        let t = clamp((1 - w) * tdc + w * thf, 0, 1);
        if (st.slot && Math.abs(x - st.sx) <= 1.0) { const { y0, y1 } = slotY(); if (y >= y0 && y <= y1) t = 0; }
        const c = PCB.heat(t), a = Math.pow(t, 0.75);
        const k = (py * off.width + px) * 4;
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = Math.round(a * 235);
      }
      g.putImageData(img, 0, 0);
      heatImg.setAttribute('href', off.toDataURL());
    }

    // ---------- particles
    const NP = 110, P = [];
    for (let i = 0; i < NP; i++) { const n = svg('circle', { r: 2, fill: 'var(--ret)' }); parts.append(n); P.push({ n, age: Math.random() * 6 }); }
    const SIGN = 14, SD = [];
    for (let i = 0; i < SIGN; i++) { const n = svg('circle', { r: 2.2, fill: '#dff1ff' }); sigDots.append(n); SD.push({ n, s: i / SIGN }); }
    function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function respawn(p) {
      p.age = 0;
      if (!model) { p.mode = 'dc'; p.x = GL.x; p.y = GL.y; return; }
      if (Math.random() < wf()) {
        p.mode = 'hf';
        let r = Math.random(); p.vi = 0;
        for (let i = 0; i < model.variants.length; i++) { if (r < model.variants[i].w) { p.vi = i; break; } r -= model.variants[i].w; }
        p.s = Math.random() * 6; p.off = gauss() * clamp(st.h * 3, 0.5, 4) * 0.6;
      } else {
        p.mode = 'dc';
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2;
        p.x = GL.x + Math.cos(a) * r; p.y = GL.y + Math.sin(a) * r;
      }
    }
    P.forEach(respawn);
    let last = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (!model || !field) return;
      const spd = 24;
      for (const p of P) {
        p.age += dt;
        if (p.mode === 'hf') {
          const pv = model.variants[p.vi] || model.variants[0];
          p.s += spd * dt;
          if (p.s > pv.len) { respawn(p); continue; }
          const q = geo.along(pv.pts, p.s);
          setAttrs(p.n, { cx: (q.x - q.dy * p.off) * PX, cy: (q.y + q.dx * p.off) * PX });
        } else {
          const s = sampleJ(p.x, p.y);
          const m = Math.hypot(s.jx, s.jy);
          if (m < 1e-9 || p.age > 9) { respawn(p); continue; }
          p.x += s.jx / m * spd * dt; p.y += s.jy / m * spd * dt;
          if (geo.dist(p, GD) < 1.6 || p.x < 0 || p.y < 0 || p.x > BW || p.y > BH) { respawn(p); continue; }
          setAttrs(p.n, { cx: p.x * PX, cy: p.y * PX });
        }
      }
      for (const d of SD) {
        d.s = (d.s + dt * 0.35) % 1;
        const q = geo.along(model.T, d.s * model.tlen);
        setAttrs(d.n, { cx: q.x * PX, cy: q.y * PX });
      }
    });

    // ---------- refresh
    let solvePending = false;
    function refresh(resolve) {
      if (resolve) {
        if (!solvePending) { solvePending = true; requestAnimationFrame(() => { solvePending = false; solveDC(false); draw(); }); }
        drawGeometry();
        return;
      }
      draw();
    }
    function drawGeometry() {
      buildModel();
      const { y0, y1 } = slotY();
      slotG.style.display = st.slot ? '' : 'none';
      setAttrs(slotR, { x: (st.sx - 1) * PX, y: y0 * PX, width: 2 * PX, height: (y1 - y0) * PX });
      setAttrs(slotHit, { x: (st.sx - 4) * PX, y: y0 * PX, width: 8 * PX, height: (y1 - y0) * PX });
      setAttrs(traceP, { d: geo.pathD(model.T.map(p => ({ x: p.x * PX, y: p.y * PX }))) });
      handles.forEach((hnd, i) => setAttrs(hnd, { cx: st.wp[i].x * PX, cy: st.wp[i].y * PX }));
      retPaths.innerHTML = '';
      const w = wf();
      if (w > 0.05) for (const v of model.variants) {
        retPaths.append(svg('path', { d: geo.pathD(v.pts.map(p => ({ x: p.x * PX, y: p.y * PX }))), fill: 'none', stroke: 'var(--ret)', 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: (0.35 + 0.6 * v.w) * w }));
      }
      stitchG.innerHTML = '';
      if (st.slot && st.stitch) {
        const R0 = [GL, LD, st.wp[1], st.wp[0], D, GD];
        const { y0: a, y1: b } = slotY();
        for (let i = 0; i < R0.length - 1; i++) {
          const X = geo.segX(R0[i], R0[i + 1], { x: st.sx, y: a }, { x: st.sx, y: b });
          if (X) stitchG.append(
            svg('rect', { x: (X.x - 2.4) * PX, y: (X.y + 2.2) * PX, width: 4.8 * PX, height: 2.4 * PX, rx: 2, fill: '#c9b48a', stroke: '#3b2f1a' }),
            svg('text', { x: X.x * PX, y: (X.y + 7.8) * PX, 'text-anchor': 'middle', fill: '#ffe2a8', 'font-size': 10, text: 'stitch cap' }));
        }
      }
      freqLbl.textContent = st.f < 10 ? 'DC / very low frequency: lowest RESISTANCE wins' : st.f < FC / 3 ? `${fmtSI(st.f, 'Hz')}: resistance still dominates` : st.f < FC * 3 ? `${fmtSI(st.f, 'Hz')}: transition` : `${fmtSI(st.f, 'Hz')}: lowest INDUCTANCE wins → return hugs the trace`;
    }
    function draw() {
      drawGeometry();
      if (!field) solveDC(true);
      renderHeat();
      metrics();
    }

    function metrics() {
      const w = wf();
      const hfA = model.variants.reduce((s, v) => s + v.w * v.area, 0);
      const projA = w * hfA + (1 - w) * model.dcA;
      const xsA = st.h * model.tlen;
      const A = projA + xsA; // mm²
      const ms = phys.microstrip(0.2, st.h);
      const Lbase = ms.Lp * model.tlen; // nH
      // slot-detour inductance: roughly µ0/π ≈ 0.4 nH per mm of slot the current must go around (half the extra path)
      const Lproj = w * 0.2 * model.extra;
      const Lt = Lbase + Lproj;
      const det = w * model.extra;
      M.set('reg', w > 0.9 ? 'follows trace' : w < 0.1 ? 'spreads out' : 'mixed', w > 0.9 ? 'good' : null);
      M.set('area', sig(A, 3) + ' mm²', A > 200 ? 'bad' : A > 40 ? 'warn' : 'good');
      M.set('Lp', sig(Lt, 3) + ' nH' + (Lproj > 0.5 ? ` (+${sig(Lproj, 2)})` : ''), Lproj > 5 ? 'bad' : Lproj > 1.5 ? 'warn' : 'good');
      M.set('det', det > 0.5 ? sig(det, 3) + ' mm' : '—', det > 10 ? 'bad' : det > 1 ? 'warn' : null);
      const lim = phys.fccB(st.f);
      let Edb = null;
      if (lim != null) {
        Edb = phys.dBuV(phys.ottE(st.f, A * 1e-6, 0.02));
        M.set('emi', `${sig(Edb, 3)} dBµV/m`, Edb > lim ? 'bad' : Edb > lim - 6 ? 'warn' : 'good', (Edb - (lim - 40)) / 50);
      } else M.set('emi', '< 30 MHz', null, 0);

      const items = [];
      if (w < 0.1) items.push({ level: 'info', html: `At ${fmtF(st.f)} the return current takes the <b>lowest-resistance</b> route: it spreads across the plane between the two ground vias and <b>ignores your trace route</b>. Loop area is large, but nothing radiates at these frequencies.` });
      else if (w > 0.9) items.push({ level: model.cross.length && !st.stitch && st.slot ? 'warn' : 'good', html: `At ${fmtSI(st.f, 'Hz')} the return current takes the <b>lowest-inductance</b> route: directly under the trace, wherever it goes. Drag a route handle and the return follows.` });
      else items.push({ level: 'info', html: `Transition region: part of the return current spreads out and part follows the trace. For a typical plane the crossover is somewhere between ~10 kHz and ~1 MHz.` });
      if (st.slot && model.cross.length) {
        if (st.stitch) items.push({ level: 'good', html: `The stitching capacitor gives the high-frequency return a bridge right at the crossing (Sierra §3.5.5: 10–100 nF, as close to the trace as possible). At DC the capacitor is open, so the low-frequency part still goes around, which is harmless.` });
        else if (w > 0.5) items.push({ level: 'bad', html: `The trace crosses the slot. The return current must detour <b>${sig(model.extra, 3)} mm</b> around ${model.variants.length > 1 ? 'both ends (it splits, mostly via the nearer end)' : 'the open end'}. Loop area is now ${sig(A, 3)} mm² instead of ${sig(xsA, 3)} mm² (×${sig(A / xsA, 2)}).` });
        else items.push({ level: 'info', html: `The trace crosses the slot, but at this frequency the return current spreads out anyway and flows around the slot. The slot hardly matters at DC.` });
      } else if (st.slot && w > 0.5) items.push({ level: 'good', html: `The trace doesn't cross the slot, so the return path under it is intact. Routing <i>around</i> a gap is the cleanest fix.` });
      if (lim != null) items.push({ level: Edb > lim ? 'bad' : Edb > lim - 6 ? 'warn' : 'good', html: `Estimated emission at 3 m for a 20 mA harmonic at ${fmtSI(st.f, 'Hz')}: <b>${sig(Edb, 3)} dBµV/m</b> vs FCC Class B limit ${lim} dBµV/m. ${Edb > lim ? 'This would fail.' : Edb > lim - 6 ? 'Less than 6 dB of margin.' : 'Comfortable margin.'}` });
      V.set(items);
      E.set(`<p>Impedance Z = R + jωL. Plane resistance is tiny and fixed, while the inductive part grows with frequency. Above roughly ${fmtSI(FC, 'Hz')}, minimising L (that is, loop area) is all that matters, so the return current concentrates under the trace.</p>
        <p>Inductance ≈ ${sig(Lbase, 3)} nH for the tight loop alone; the detour adds ≈${sig(Lproj, 2)} nH. For a 1 ns edge on 50 Ω that is a ${sig(phys.rhoSeriesL(Lproj * 1e-9, 50, 1e-9) * 100, 2)}% reflection right at the slot. Radiated field ∝ f² × area × current: ${sig(A / xsA, 2)}× the area means ${sig(20 * Math.log10(A / xsA), 2)} dB more emission at every frequency.</p>`);
    }

    solveDC(true);
    draw();
  })();

  /* =================================================================
     3.3  Return current density profile
     ================================================================= */
  (function labTight() {
    const host = document.getElementById('lab-tight'); if (!host) return;
    const L = lab(host, { title: 'Return current profile under a trace' });
    const st = { h: 0.2, D: 1 };
    const sH = slider({ label: 'Height H above the plane', min: 0.05, max: 1.6, log: true, value: st.h, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.h = v; update(); } });
    const sD = slider({ label: 'Neighbour trace at distance D', min: 0.1, max: 10, log: true, value: st.D, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.D = v; update(); } });
    L.controls.append(sH.el, sD.el,
      el('div', { class: 'ctl-group-title' }, 'Typical stackups'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => { st.h = 1.5; sH.set(1.5); update(); } }, '2-layer 1.6 mm board (H ≈ 1.5 mm)'),
        el('button', { class: 'btn', onclick: () => { st.h = 0.2; sH.set(0.2); update(); } }, '4-layer, thin prepreg (0.2 mm)'),
        el('button', { class: 'btn', onclick: () => { st.h = 0.09; sH.set(0.09); update(); } }, 'HDI / 6-layer (0.09 mm)')));
    const plot = new Plot(L.stage, { title: 'Return current density across the plane (normalised)', height: 230, xmin: -10, xmax: 10, ymin: 0, ymax: 1.08, xlabel: 'distance from trace centre [mm]', xfmt: v => sig(v, 2), yfmt: v => sig(v, 2) });
    const M = meters(L.stage, [{ key: 'half', label: '50% of current within' }, { key: 'ninety', label: '90% within' }, { key: 'in1', label: 'Share within ±1 mm' }, { key: 'k', label: 'Density under neighbour' }]);
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function update() {
      const xs = [], ys = [];
      for (let i = 0; i <= 400; i++) { const x = -10 + 20 * i / 400; xs.push(x); ys.push(1 / (1 + (x / st.h) ** 2)); }
      const k = 1 / (1 + (st.D / st.h) ** 2);
      const ninety = st.h * Math.tan(0.9 * Math.PI / 2);
      plot.draw({
        series: [{ x: xs, y: ys, color: 'var(--ret)', width: 2.5, fill: true, fillAlpha: 0.18 }],
        xspans: [{ x0: -st.h, x1: st.h, color: 'var(--accent)', alpha: 0.14, label: '50%' }],
        vlines: [{ x: st.D, color: 'var(--link)', label: 'neighbour' }],
        markers: [{ x: st.D, y: k, color: 'var(--link)', r: 5, label: sig(k, 2) }],
      });
      const in1 = 2 / Math.PI * Math.atan(1 / st.h);
      M.set('half', '±' + sig(st.h, 2) + ' mm');
      M.set('ninety', '±' + sig(ninety, 2) + ' mm');
      M.set('in1', sig(in1 * 100, 3) + '%', in1 > 0.8 ? 'good' : in1 > 0.5 ? 'warn' : 'bad');
      M.set('k', sig(k, 2), k > 0.1 ? 'bad' : k > 0.02 ? 'warn' : 'good');
      V.set([
        { level: k > 0.1 ? 'bad' : k > 0.02 ? 'warn' : 'good', html: `The neighbour sits in a region where this trace's return current density is <b>${sig(k * 100, 2)}%</b> of the peak. That is also Jones's crosstalk coupling coefficient 1/(1+(D/H)²).` },
        { level: 'info', html: `90% of the return current is within ±${sig(ninety, 2)} mm. ${st.h > 1 ? 'On a 2-layer board the "return path" is a wide smear, so every loop is big.' : 'A thin dielectric keeps each signal\'s fields to itself.'}` },
      ]);
      E.set(`<p>The curve is the image-current solution for a thin wire over an infinite plane. The width scales <b>only with H</b>, so the plane-to-trace distance sets how far each signal's influence reaches.</p><p>This is why the stackup (lesson 2) decides most of your EMI and crosstalk before you route a single trace.</p>`);
    }
    update();
  })();

  /* =================================================================
     3.4  Changing layers — cross-section
     ================================================================= */
  (function labLayers() {
    const host = document.getElementById('lab-layers'); if (!host) return;
    const L = lab(host, { title: 'Signal via: where does the return current go?' });
    const st = { sc: 'B', D: 1, none: false, tr: 100e-12 };
    const sSc = seg({ label: 'Signal changes layers', options: [
      { v: 'A', label: 'L1 → L3', title: 'Both layers reference L2 GND' },
      { v: 'B', label: 'L1 → L6', title: 'L2 GND → L5 GND' },
      { v: 'C', label: 'L1 → L6 (L5 = power)', title: 'L2 GND → L5 1.8 V plane' }], value: st.sc, onChange: v => { st.sc = v; update(); } });
    const sD = slider({ label: 'Nearest stitching via / cap', min: 0.5, max: 30, log: true, value: st.D, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.D = v; update(); } });
    const cNone = check({ label: 'No stitching element nearby (nearest ≈ 40 mm away)', onChange: v => { st.none = v; update(); } });
    const sTr = seg({ label: 'Signal edge (rise time)', options: [{ v: 1e-9, label: '1 ns' }, { v: 100e-12, label: '100 ps' }, { v: 30e-12, label: '30 ps' }], value: st.tr, onChange: v => { st.tr = v; update(); } });
    L.controls.append(sSc.el, sD.el, cNone.el, sTr.el);

    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 300' });
    const g = svg('g'); const dotsG = svg('g');
    S.append(g, dotsG);
    L.stage.append(S, legend([['var(--sig)', 'signal current'], ['var(--ret)', 'return current'], ['#b5a6ff', 'displacement current between planes', true]]));
    const M = meters(L.stage, [{ key: 'path', label: 'Return transition' }, { key: 'L', label: 'Extra L vs ideal via' }, { key: 'rho', label: 'Reflection bump', bar: true }, { key: 'cav', label: 'Plane-cavity noise' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Via-loop inductance from Sierra eq. PI-15: L ≈ 0.4·h·[ln(2D/d)+¼] nH (h = plane spacing, D = via spacing, d = 0.3 mm). Reflection of a series inductance on 50 Ω (ramp edge): ρ = (τ/tr)(1−e^(−tr/τ)), τ = L/2Z0 ≈ L/(2·Z0·tr) when small.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');

    const Y = { L1: 52, L2: 84, L3: 116, L4: 170, L5: 224, L6: 256 };
    const XV = 300;
    let retPath = [], sigPath = [], disp = false;

    function update() {
      const sc = st.sc;
      const Dmm = st.none ? 40 : st.D;
      const dpx = clamp(Dmm * 10, 16, 320);
      const xs = Math.min(XV + dpx, 628);
      const h = 1.1; // mm between L2 and L5 in a typical 1.6 mm 6-layer build
      let Lx, pathTxt;
      // extra inductance relative to an ideal return via placed right beside the signal via (0.5 mm)
      if (sc === 'A') { Lx = 0; pathTxt = 'L2 antipad'; }
      else { Lx = phys.viaLoopL(h, Dmm, 0.3) - phys.viaLoopL(h, 0.5, 0.3) + (sc === 'C' ? 0.6 : 0); pathTxt = sc === 'B' ? (st.none ? 'distant via' : 'GND via') : (st.none ? 'cavity only' : 'stitch cap'); }
      const rho = phys.rhoSeriesL(Lx * 1e-9, 50, st.tr);
      const cav = sc === 'A' ? 0 : st.none ? 2 : Dmm > 8 ? 1 : 0;
      disp = sc !== 'A' && (st.none || Dmm > 8);

      // ---- drawing
      g.innerHTML = '';
      g.append(svg('rect', { x: 0, y: 30, width: 640, height: 250, fill: '#1e4a37', opacity: 0.55 }));
      const layers = [
        ['L1', 'Signal', 'sig'], ['L2', 'GND', 'gnd'], ['L3', 'Signal', 'sig'],
        ['L4', 'PWR 3.3 V', 'pwr'], ['L5', sc === 'C' ? 'PWR 1.8 V' : 'GND', sc === 'C' ? 'pwr' : 'gnd'], ['L6', 'Signal', 'sig']];
      for (const [k, name, type] of layers) {
        const y = Y[k];
        if (type !== 'sig') {
          g.append(svg('rect', { x: 0, y: y - 3, width: 640, height: 6, fill: type === 'gnd' ? '#7c6a3a' : '#7a3f45' }));
          // antipad hole around the signal via
          g.append(svg('rect', { x: XV - 9, y: y - 4, width: 18, height: 8, fill: '#1e4a37' }));
        }
        g.append(svg('text', { x: 8, y: y - 6, fill: type === 'gnd' ? 'var(--gnd)' : type === 'pwr' ? '#ff9aa5' : '#9fd3ff', 'font-size': 10.5, text: `${k} ${name}` }));
      }
      const yT = sc === 'A' ? Y.L3 : Y.L6;
      // signal traces + via
      g.append(svg('rect', { x: 70, y: Y.L1 - 3, width: XV - 70, height: 6, fill: 'var(--copper)' }));
      g.append(svg('rect', { x: XV, y: yT - 3, width: 570 - XV, height: 6, fill: 'var(--copper)' }));
      g.append(svg('rect', { x: XV - 3.5, y: Y.L1 - 3, width: 7, height: yT - Y.L1 + 6, fill: 'var(--copper)' }));
      if (sc !== 'A') g.append(svg('rect', { x: XV - 3.5, y: yT, width: 7, height: 280 - yT, fill: 'var(--copper)', opacity: 0.35 }));
      g.append(svg('text', { x: XV + 8, y: 44, fill: '#e8efe9', 'font-size': 11, text: 'signal via' }));
      // stitching element
      if (sc === 'B') {
        g.append(svg('rect', { x: xs - 3.5, y: Y.L2, width: 7, height: Y.L5 - Y.L2, fill: 'var(--gnd)', opacity: 0.9 }));
        g.append(svg('text', { x: xs, y: Y.L6 + 28, 'text-anchor': 'middle', fill: 'var(--gnd)', 'font-size': 10.5, text: st.none ? 'nearest GND via (40 mm)' : 'GND stitching via' }));
      } else if (sc === 'C') {
        const ym = (Y.L2 + Y.L5) / 2;
        g.append(svg('rect', { x: xs - 1.5, y: Y.L2, width: 3, height: ym - 8 - Y.L2, fill: 'var(--gnd)' }));
        g.append(svg('rect', { x: xs - 1.5, y: ym + 8, width: 3, height: Y.L5 - ym - 8, fill: '#ff9aa5' }));
        g.append(svg('rect', { x: xs - 10, y: ym - 8, width: 20, height: 4, fill: '#e8efe9' }));
        g.append(svg('rect', { x: xs - 10, y: ym + 4, width: 20, height: 4, fill: '#e8efe9' }));
        g.append(svg('text', { x: xs + 14, y: ym + 4, fill: '#ffe2a8', 'font-size': 10.5, text: 'stitching cap' }));
      }
      if (disp) for (let x = XV + 16; x < XV + 120; x += 18) {
        g.append(svg('line', { x1: x, y1: Y.L2 + 5, x2: x, y2: Y.L5 - 5, stroke: '#b5a6ff', 'stroke-width': 1.4, 'stroke-dasharray': '3 4', opacity: 0.8 }));
      }
      if (disp) g.append(svg('text', { x: XV + 20, y: (Y.L3 + Y.L4) / 2 + 4, fill: '#cfc4ff', 'font-size': 10.5, text: 'displacement current → plane cavity rings' }));
      // paths (signal: left→right; return: right→left)
      sigPath = [{ x: 70, y: Y.L1 - 9 }, { x: XV - 9, y: Y.L1 - 9 }, { x: XV - 9, y: yT + 9 }, { x: 570, y: yT + 9 }];
      if (sc === 'A') {
        retPath = [{ x: 570, y: Y.L2 + 6 }, { x: XV + 11, y: Y.L2 + 6 }, { x: XV + 11, y: Y.L2 - 6 }, { x: 70, y: Y.L2 - 6 }];
      } else {
        // return flows on the face of L5 nearest L6 (its underside), to the stitching element, up to L2, then along L2's top face
        retPath = [{ x: 570, y: Y.L5 + 6 }, { x: xs + 6, y: Y.L5 + 6 }, { x: xs + 6, y: Y.L2 - 6 }, { x: 70, y: Y.L2 - 6 }];
      }
      g.append(svg('path', { d: geo.pathD(retPath), fill: 'none', stroke: 'var(--ret)', 'stroke-width': 1.3, 'stroke-dasharray': '5 4', opacity: 0.8 }));

      M.set('path', pathTxt, sc === 'A' ? 'good' : null);
      M.set('L', sig(Lx, 2) + ' nH', Lx > 1.5 ? 'bad' : Lx > 0.6 ? 'warn' : 'good');
      M.set('rho', sig(rho * 100, 2) + '%', rho > 0.1 ? 'bad' : rho > 0.04 ? 'warn' : 'good', rho / 0.3);
      M.set('cav', cav === 2 ? 'high' : cav === 1 ? 'moderate' : 'low', cav === 2 ? 'bad' : cav === 1 ? 'warn' : 'good');

      const items = [];
      if (sc === 'A') items.push({ level: 'good', html: `L1 and L3 both reference <b>L2</b>, one on each face. The return current simply wraps from L2's underside to its top side through the edge of the antipad, right at the via. No stitching via is needed.` });
      if (sc === 'B') {
        if (st.none) items.push({ level: 'bad', html: `The return current has to get from L5 to L2, but the nearest ground via is ~40 mm away. Part of it detours, and part crosses as <b>displacement current</b> through the L2–L5 capacitance, which excites the plane cavity and spreads noise to every via in the area.` });
        else items.push({ level: Dmm <= 1.5 ? 'good' : Dmm < 8 ? 'warn' : 'bad', html: `A GND stitching via <b>${sig(Dmm, 2)} mm</b> away carries the return current from L5 to L2. ${Dmm <= 1.5 ? 'Close enough that the loop stays tiny.' : 'Move it closer: the loop and the plane noise grow with distance.'}` });
      }
      if (sc === 'C') items.push({ level: st.none ? 'bad' : 'warn', html: `L6 references a <b>power</b> plane. The return current must cross from 1.8 V (L5) to GND (L2), and only a capacitor can pass it. A stitching cap adds its own ESL (~0.6 nH incl. mounting), and the noise lands on the 1.8 V rail. Sierra §7.3.1.7: avoid power planes as references for fast signals.` });
      items.push({ level: rho > 0.1 ? 'bad' : rho > 0.04 ? 'warn' : 'good', html: `For a ${fmtSI(st.tr, 's')} edge, ${sig(Lx, 2)} nH of extra return-path inductance looks like a <b>${sig(rho * 100, 2)}%</b> reflection bump. ${st.tr < 50e-12 ? 'At USB 3 / PCIe edge rates even small inductance shows up in the eye.' : ''}` });
      V.set(items);
      E.set(`<p>At high frequency, current flows only on the <b>surface</b> of a plane that faces the signal (skin effect). A signal on L6 has its return on L5's underside, and on L1 the return is on L2's top side. These are different metal surfaces, so the current needs a <b>vertical</b> conductor between them near the via.</p><p>The via-loop inductance grows only logarithmically with distance. The bigger problem with distant stitching is the plane cavity: the return crosses as displacement current and makes the whole L2–L5 pair ring.</p>`);
    }

    // animated dots
    const ND = 16, sd = [], rd = [];
    for (let i = 0; i < ND; i++) {
      const a = svg('circle', { r: 2.4, fill: 'var(--sig)' }); dotsG.append(a); sd.push({ n: a, s: i / ND });
      const b = svg('circle', { r: 2.4, fill: 'var(--ret)' }); dotsG.append(b); rd.push({ n: b, s: i / ND });
    }
    let last = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (!retPath.length) return;
      const ls = geo.polyLen(sigPath), lr = geo.polyLen(retPath);
      for (const d of sd) { d.s = (d.s + dt * 0.25) % 1; const q = geo.along(sigPath, d.s * ls); setAttrs(d.n, { cx: q.x, cy: q.y }); }
      for (const d of rd) { d.s = (d.s + dt * 0.25) % 1; const q = geo.along(retPath, d.s * lr); setAttrs(d.n, { cx: q.x, cy: q.y }); }
    });
    update();
  })();

  /* ================================================================= quiz */
  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'A 500 MHz signal is routed in a big U-shape between two ICs over a solid plane. Where does most of its return current flow?', opts: ['In a straight line between the ICs\' ground pins (shortest path)', 'Directly under the U-shaped trace', 'Spread evenly over the whole plane'], a: 1, ex: 'At high frequency the lowest-impedance path is the lowest-inductance one, i.e. the one that minimises loop area, which is right under the trace. The straight-line path only wins at DC/low frequency.' },
    { q: 'Your USB 3 pair must cross a gap between the GND pour and a 3.3 V pour on its reference layer. Best option?', opts: ['Just cross it: differential signals don\'t need a return path', 'Reroute around the gap; if impossible, add stitching capacitors right at the crossing', 'Add a stitching via 30 mm away'], a: 1, ex: 'Differential pairs still carry common-mode current and are referenced to the plane for their impedance. Route around gaps; failing that, provide a local return bridge (Sierra §3.5.5). A distant via doesn\'t help, because the return must cross where the trace crosses.' },
    { q: 'A signal goes from L1 (over L2 GND) to L3 (between L2 GND and L4 PWR). Does it need a stitching via?', opts: ['Yes, always add one per layer change', 'Mostly no: both layers reference L2, and the return wraps through L2\'s antipad. Watch the L4 side, which needs decoupling nearby.', 'Only if the via is plated'], a: 1, ex: 'When both layers reference opposite faces of the same plane, the return current passes through the antipad edge right at the via. Stitching vias are needed when the reference changes between different planes.' },
  ]);
})();
