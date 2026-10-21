/* Lesson 11 — Memory (DDR) routing */
(function () {
  'use strict';
  const { el, svg, setAttrs, slider, seg, check, meters, verdicts, explain, lab, Plot, fmtSI, sig, clamp, geo, legend } = PCB;
  PCB.renderChrome({ lesson: 11 });
  const TPD_IN = 6.85, TPD_OUT = 5.95; // ps/mm: stripline (Dk 4.2) and microstrip (Dk_eff ≈ 3.2)
  const PS_VIA = 6; // ps added per via (barrel + pad capacitance), illustrative
  const RATES = [1066, 1600, 2400, 3200, 4266, 6400];
  const RATE_NAME = { 1066: 'DDR3-1066', 1600: 'DDR3-1600', 2400: 'DDR4-2400', 3200: 'DDR4-3200', 4266: 'LPDDR4x-4266', 6400: 'LPDDR5-6400' };
  // shared timing model (ps): what the driver/channel and the DRAM consume regardless of layout
  const eyeLoss = UI => 0.18 * UI + 30; // jitter + ISI at the receiver
  const dramWin = UI => 0.16 * UI + 20; // valid window the DRAM needs (setup + hold)

  /* =================================================================
     11.1  Signal groups
     ================================================================= */
  (function labGroups() {
    const host = document.getElementById('lab-groups'); if (!host) return;
    const L = lab(host, { title: 'A 64-bit bus: controller + four ×16 DRAM chips' });
    const st = { g: 'data', tAnim: 0 };
    const G = {
      data: { n: 'Data (DQ, DM)', sig: 'DQ0–7 + DM/DBI per byte lane; 8 lanes for 64 bits', topo: 'Point-to-point: controller ↔ one chip', dir: 'Both ways (write: controller drives; read: DRAM drives)', clk: 'Its own strobe, DQS (source-synchronous)', match: 'Every bit to its lane\'s DQS, tightly (a few ps)', term: 'On-die termination (ODT) inside the receiver' },
      dqs: { n: 'Strobes (DQS±)', sig: 'One differential DQS pair per byte lane', topo: 'Point-to-point, travels with its lane', dir: 'Both ways', clk: 'It is the clock for its lane', match: 'P to N tightly; lane bits to it; to CK at the chip within tDQSS (fixed by write leveling)', term: 'ODT' },
      addr: { n: 'Address / command', sig: 'A0–A17, BA/BG, ACT, RAS/CAS/WE (DDR4)', topo: 'Fly-by daisy chain through every chip', dir: 'One way: controller → DRAM', clk: 'CK (one bit per clock: half the data rate)', match: 'To CK, measured at each chip (looser than data)', term: 'R_TT to V_TT at the end of the chain' },
      ck: { n: 'Clock (CK±)', sig: 'Differential CK pair (one per rank or per chip group)', topo: 'Fly-by, same order as address', dir: 'One way', clk: 'It is the reference for address/command', match: 'P to N tightly; address/command to it', term: 'Differential termination at the end of the chain' },
      ctl: { n: 'Control', sig: 'CS, CKE, ODT (one set per rank)', topo: 'Fly-by, like address', dir: 'One way', clk: 'CK', match: 'To CK at each chip', term: 'R_TT to V_TT at the end' },
    };
    const sG = seg({ label: 'Show group', options: Object.keys(G).map(k => ({ v: k, label: G[k].n.split(' (')[0] })), value: st.g, onChange: v => { st.g = v; draw(); } });
    L.controls.append(sG.el, el('div', { class: 'hint' }, 'Each thick line on the left/top/bottom is a whole byte lane (11 signals). The centre line is the shared address bus, drawn on an inner layer under the chips.'));
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 290' });
    const gBase = svg('g'), gHi = svg('g'), gDot = svg('g'), gTxt = svg('g');
    S.append(gBase, gHi, gDot, gTxt);
    const tblBox = el('div', { class: 'tbl-wrap' });
    L.stage.append(S, tblBox);
    const V = verdicts(L.left, 'What to notice');
    const E = explain(L.right, 'Why');
    const CX = [245, 345, 445, 545];
    const laneTop = k => [{ x: 120 - k * 20, y: 70 }, { x: 120 - k * 20, y: 55 - k * 8 }, { x: CX[k] - 15, y: 55 - k * 8 }, { x: CX[k] - 15, y: 95 }];
    const laneBot = k => [{ x: 120 - k * 20, y: 230 }, { x: 120 - k * 20, y: 245 + k * 8 }, { x: CX[k] + 15, y: 245 + k * 8 }, { x: CX[k] + 15, y: 185 }];
    const ADDR = [{ x: 140, y: 140 }, { x: 600, y: 140 }];
    const CK = [{ x: 140, y: 156 }, { x: 600, y: 156 }];
    const CTL = [{ x: 140, y: 124 }, { x: 600, y: 124 }];
    const path = (pts, c, w, extra = {}) => svg('path', Object.assign({ d: geo.pathD(pts), fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, extra));
    function draw() {
      const g = st.g;
      gBase.innerHTML = ''; gHi.innerHTML = ''; gTxt.innerHTML = '';
      const dim = '#3f6a57';
      for (let k = 0; k < 4; k++) { gBase.append(path(laneTop(k), dim, 5), path(laneBot(k), dim, 5)); }
      gBase.append(path(CTL, dim, 2), path(ADDR, dim, 4), path(CK, dim, 2), path([{ x: 140, y: 160 }, { x: 600, y: 160 }], dim, 2));
      gBase.append(svg('rect', { x: 30, y: 70, width: 110, height: 160, rx: 6, fill: '#1d2730', stroke: 'var(--silk)' }), svg('text', { x: 85, y: 146, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 12, 'font-weight': 650, text: 'SoC /' }), svg('text', { x: 85, y: 162, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 12, 'font-weight': 650, text: 'controller' }));
      CX.forEach((x, i) => gBase.append(svg('rect', { x: x - 35, y: 95, width: 70, height: 90, rx: 4, fill: '#141a17', stroke: 'var(--silk)', opacity: 0.92 }), svg('text', { x, y: 113, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, 'font-weight': 650, text: `DRAM ${i + 1}` }), svg('text', { x, y: 178, 'text-anchor': 'middle', fill: '#9fb5a8', 'font-size': 9.5, text: `lanes ${2 * i}, ${2 * i + 1}` })));
      gBase.append(svg('rect', { x: 600, y: 116, width: 16, height: 48, rx: 2, fill: '#b9a37a' }), svg('text', { x: 608, y: 180, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, text: 'R_TT' }), svg('text', { x: 608, y: 192, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, text: 'to V_TT' }));
      const hi = '#ffd166';
      if (g === 'data' || g === 'dqs') {
        for (let k = 0; k < 4; k++) { gHi.append(path(laneTop(k), g === 'dqs' && k ? '#7c6a3c' : hi, g === 'dqs' ? 2.5 : 5), path(laneBot(k), g === 'dqs' ? '#7c6a3c' : hi, g === 'dqs' ? 2.5 : 5)); }
        if (g === 'dqs') gHi.append(path(laneTop(0), '#5cb8ff', 2.2, { transform: 'translate(3 0)' }), path(laneTop(0), '#ff7b3a', 2.2, { transform: 'translate(-3 0)' }));
        gTxt.append(svg('text', { x: 320, y: 20, 'text-anchor': 'middle', fill: hi, 'font-size': 11, text: g === 'data' ? 'Eight byte lanes, each point-to-point to one chip. Lanes may differ in length from each other.' : 'Each lane carries its own strobe pair (blue/orange shown on lane 0) right alongside its data bits.' }));
      } else {
        const P = g === 'addr' ? ADDR : g === 'ck' ? CK : CTL;
        gHi.append(path(P, hi, g === 'addr' ? 5 : 3));
        if (g === 'ck') gHi.append(path([{ x: 140, y: 160 }, { x: 600, y: 160 }], hi, 3));
        CX.forEach(x => gHi.append(svg('line', { x1: x, y1: P[0].y, x2: x, y2: P[0].y - 9, stroke: hi, 'stroke-width': 3 }), svg('circle', { cx: x, cy: P[0].y - 9, r: 3, fill: hi })));
        CX.forEach((x, i) => gTxt.append(svg('text', { x, y: 205, 'text-anchor': 'middle', fill: hi, 'font-size': 10.5, 'font-family': 'var(--mono)', text: `+${Math.round((x - CX[0]) / 100 * 14 * TPD_IN)} ps` })));
        gTxt.append(svg('text', { x: 320, y: 20, 'text-anchor': 'middle', fill: hi, 'font-size': 11, text: 'One line visits every chip through a short stub and ends in a termination. Each chip sees it a little later.' }));
      }
      const d = G[g];
      tblBox.innerHTML = '';
      tblBox.append(el('table', { class: 'tbl' }, el('tbody', null,
        [['Signals', d.sig], ['Topology', d.topo], ['Direction', d.dir], ['Timed by', d.clk], ['Matched to', d.match], ['Termination', d.term]].map(([a, b]) => el('tr', null, el('th', null, a), el('td', null, b))))));
      const items = [];
      if (g === 'data') items.push({ level: 'info', html: 'Data is <b>source-synchronous</b>: the strobe travels with the bits it times, so only the skew <i>inside</i> a lane matters. That is why lanes are routed as tight bundles, and why the whole bus doesn\'t need to be one length.' });
      if (g === 'dqs') items.push({ level: 'info', html: 'On a write the controller shifts DQS by a quarter clock so its edge lands in the <b>middle</b> of the data eye. On a read the DRAM sends DQS edge-aligned and the controller delays it internally.' });
      if (g === 'addr' || g === 'ctl') items.push({ level: 'info', html: 'Address and command change once per clock (half the data rate), so their timing is looser, but they are <b>multi-drop</b>: one driver, four receivers. That is a topology problem (lesson 7.3), solved with fly-by + termination.' });
      if (g === 'ck') items.push({ level: 'info', html: 'The clock follows the same fly-by path as the address, so at every chip address and clock arrive together, even though chip 4 sees both a few hundred ps after chip 1.' });
      items.push({ level: 'good', html: 'LPDDR4/5 (used on Jetson modules) use narrower 16-bit channels routed point-to-point to one package, with termination inside the DRAM. The byte-lane rules are the same; there is no long fly-by chain.' });
      V.set(items);
      E.set('<p>Grouping is the first thing to set up, because every rule is "within a group" or "group to its reference". Bits in a lane are matched to their strobe; address and control are matched to the clock; lanes are not matched to each other.</p><p>The same pattern appears in MIPI CSI (data lanes matched to the clock lane) and in multi-lane PCIe (each lane matched within its own pair; lane-to-lane skew is relaxed because the receiver deskews).</p>');
    }
    const dots = [];
    for (let i = 0; i < 12; i++) { const n = svg('circle', { r: 3.5, fill: '#fff' }); gDot.append(n); dots.push(n); }
    const dirTxt = svg('text', { x: 320, y: 284, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10.5 });
    gDot.append(dirTxt);
    let last = 0;
    PCB.whenVisible(S, ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      st.tAnim += dt;
      const ph = (st.tAnim % 2.4) / 2.4;
      const g = st.g;
      if (g === 'data' || g === 'dqs') {
        const write = Math.floor(st.tAnim / 2.4) % 2 === 0;
        dirTxt.textContent = write ? 'WRITE: controller drives, DRAM receives' : 'READ: DRAM drives, controller receives';
        for (let i = 0; i < 12; i++) {
          const k = i % 4, top = i < 8 ? (i < 4) : null;
          if (top === null) { setAttrs(dots[i], { opacity: 0 }); continue; }
          const P = top ? laneTop(k) : laneBot(k), Lp = geo.polyLen(P);
          const s = write ? ph : 1 - ph;
          const q = geo.along(P, s * Lp);
          setAttrs(dots[i], { cx: q.x, cy: q.y, opacity: g === 'dqs' && k ? 0.25 : 1, fill: '#fff' });
        }
      } else {
        dirTxt.textContent = 'Controller drives; the edge passes each chip in turn and is absorbed by R_TT';
        const P = g === 'addr' ? ADDR : g === 'ck' ? CK : CTL;
        for (let i = 0; i < 12; i++) {
          if (i > 2) { setAttrs(dots[i], { opacity: 0 }); continue; }
          const s = (ph + i * 0.04) % 1;
          const q = geo.along(P, s * geo.polyLen(P));
          setAttrs(dots[i], { cx: q.x, cy: q.y, opacity: 1 - i * 0.3, fill: '#fff' });
        }
      }
    });
    draw();
  })();

  /* =================================================================
     11.2  Byte-lane timing
     ================================================================= */
  (function labLane() {
    const host = document.getElementById('lab-lane'); if (!host) return;
    const L = lab(host, { title: 'One byte lane: DQ0–7, DM and their strobe DQS' });
    const NAMES = ['DQ0', 'DQ1', 'DQ2', 'DQ3', 'DQ4', 'DQ5', 'DQ6', 'DQ7', 'DM', 'DQS'];
    const st = { rate: 3200, train: false, sig: NAMES.map(() => ({ len: 40, layer: 'in', vias: 2 })) };
    const PRE = {
      matched: () => st.sig.forEach((s, i) => { s.len = 40 + [0.2, -0.1, 0.1, -0.2, 0, 0.15, -0.1, 0.05, -0.05, 0][i]; s.layer = 'in'; s.vias = 2; }),
      mixed: () => st.sig.forEach((s, i) => { s.len = 40; s.layer = i >= 4 && i <= 8 ? 'out' : 'in'; s.vias = i >= 4 && i <= 8 ? 0 : 2; }),
      rough: () => st.sig.forEach((s, i) => { s.len = 40 + [-5.5, 2, 6.5, -1, 3.5, -3, 0.5, 4.8, -2.4, 0][i]; s.layer = 'in'; s.vias = i === 2 ? 4 : 2; }),
    };
    PRE.mixed();
    const sR = seg({ label: 'Data rate', options: RATES.map(v => ({ v, label: RATE_NAME[v] })), value: st.rate, onChange: v => { st.rate = v; update(); } });
    const cT = check({ label: 'Controller training: per-bit deskew (up to ±30 ps) and DQS re-centring', onChange: v => { st.train = v; update(); } });
    L.controls.append(sR.el, cT.el,
      el('div', { class: 'ctl-group-title' }, 'Start from'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => { PRE.matched(); update(); } }, 'Matched, one layer'),
        el('button', { class: 'btn', onclick: () => { PRE.mixed(); update(); } }, 'Equal length, two layers'),
        el('button', { class: 'btn', onclick: () => { PRE.rough(); update(); } }, 'Unmatched')),
      el('div', { class: 'hint' }, 'Drag the round handle at the end of a trace to change its length. Click a name to toggle its layer: L3 (inner) ↔ L1 (outer). Moving to L1 also removes its two vias.'));
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 430', style: 'background:var(--surface-2)' });
    L.stage.append(S, legend([['var(--sig)', 'inner layer L3 (stripline, 6.85 ps/mm)'], ['#e0a64a', 'outer layer L1 (microstrip, 5.95 ps/mm)'], ['var(--good)', 'valid data window'], ['var(--bad)', 'DRAM setup/hold need']]));
    const M = meters(L.stage, [{ key: 'ui', label: 'Bit time (UI)' }, { key: 'sk', label: 'Lane skew (max − min)' }, { key: 'pui', label: 'Skew as % of UI', bar: true }, { key: 'su', label: 'Setup margin' }, { key: 'ho', label: 'Hold margin' }]);
    L.stage.append(el('div', { class: 'model-note' }, `Flight time = length × (6.85 ps/mm inner, 5.95 ps/mm outer) + ${PS_VIA} ps per via. Each bit's valid window = UI − (0.18·UI + 30 ps) for jitter and ISI; the DRAM needs 0.16·UI + 20 ps around the DQS edge. Illustrative numbers, not a JEDEC budget.`));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const X0 = 80, KX = 12, LMIN = 25, LMAX = 56;
    const lx = len => X0 + (len - 20) * KX;
    const rowY = i => 30 + i * 18;
    const rows = NAMES.map((n, i) => {
      const g = svg('g');
      const lbl = svg('text', { x: 10, y: rowY(i) + 4, 'font-size': 11.5, 'font-family': 'var(--mono)', fill: 'var(--text)', style: 'cursor:pointer', text: n });
      const badge = svg('text', { x: 50, y: rowY(i) + 4, 'font-size': 9.5, 'font-weight': 700, style: 'cursor:pointer' });
      const line = svg('line', { x1: X0, y1: rowY(i), y2: rowY(i), 'stroke-width': i === 9 ? 5 : 3.5, 'stroke-linecap': 'round' });
      const viaG = svg('g');
      const handle = svg('circle', { cy: rowY(i), r: 7, fill: 'var(--surface)', 'stroke-width': 2.5 });
      const info = svg('text', { y: rowY(i) + 4, 'font-size': 10.5, 'font-family': 'var(--mono)', fill: 'var(--muted)' });
      g.append(line, viaG, handle, lbl, badge, info);
      S.append(g);
      const toggle = () => { const s = st.sig[i]; s.layer = s.layer === 'in' ? 'out' : 'in'; s.vias = s.layer === 'in' ? 2 : 0; update(); };
      lbl.addEventListener('click', toggle); badge.addEventListener('click', toggle);
      PCB.draggable(S, handle, { onMove: p => { st.sig[i].len = clamp(20 + (p.x - X0) / KX, LMIN, LMAX); update(); } });
      return { line, handle, badge, info, viaG };
    });
    S.append(svg('text', { x: X0, y: 14, 'font-size': 10.5, fill: 'var(--faint)', text: 'Routed length →   (controller at left, DRAM at the handle)' }));
    const gT = svg('g');
    S.append(gT);
    function update() {
      const UI = 1e6 / st.rate;
      const delay = st.sig.map(s => s.len * (s.layer === 'in' ? TPD_IN : TPD_OUT) + s.vias * PS_VIA);
      const dqs = delay[9];
      let skew = delay.slice(0, 9).map(d => d - dqs);
      if (st.train) skew = skew.map(s => Math.sign(s) * Math.max(0, Math.abs(s) - 30));
      const We = UI - eyeLoss(UI), Rq = dramWin(UI);
      const mx = Math.max(...skew), mn = Math.min(...skew);
      let sample = UI / 2; // DQS edge relative to DQS launch + flight
      if (st.train) sample = UI / 2 + (mx + mn) / 2;
      const left = mx + (UI - We) / 2, right = mn + (UI + We) / 2;
      const setup = sample - left - Rq / 2, hold = right - sample - Rq / 2;
      // ---- route rows
      st.sig.forEach((s, i) => {
        const r = rows[i], c = s.layer === 'in' ? 'var(--sig)' : '#e0a64a', x = lx(s.len);
        setAttrs(r.line, { x2: x, stroke: c });
        setAttrs(r.handle, { cx: x, stroke: c });
        setAttrs(r.badge, { fill: c, text: s.layer === 'in' ? 'L3' : 'L1' });
        setAttrs(r.info, { x: Math.min(x + 12, 524), text: `${sig(s.len, 3)} mm · ${Math.round(delay[i])} ps` });
        r.viaG.innerHTML = '';
        for (let v = 0; v < s.vias; v++) r.viaG.append(svg('circle', { cx: X0 + 8 + v * 9, cy: rowY(i), r: 3.2, fill: 'var(--surface)', stroke: 'var(--muted)', 'stroke-width': 1.3 }));
      });
      // ---- timing diagram
      gT.innerHTML = '';
      const T0 = -0.2 * UI, T1 = 1.2 * UI, TX = t => 80 + (t - T0) / (T1 - T0) * 540;
      const ty = 225;
      gT.append(svg('text', { x: 10, y: ty - 8, 'font-size': 10.5, fill: 'var(--faint)', text: 'Arrival at the DRAM, relative to DQS (one bit time shown)' }));
      gT.append(svg('line', { x1: TX(0), y1: ty, x2: TX(0), y2: 410, stroke: 'var(--border)', 'stroke-dasharray': '3 3' }), svg('line', { x1: TX(UI), y1: ty, x2: TX(UI), y2: 410, stroke: 'var(--border)', 'stroke-dasharray': '3 3' }));
      const hex = (a, b, y, h, fill, op) => { const e = Math.min(8, (b - a) / 2); return svg('path', { d: `M${a} ${y}L${a + e} ${y - h / 2}L${b - e} ${y - h / 2}L${b} ${y}L${b - e} ${y + h / 2}L${a + e} ${y + h / 2}Z`, fill, opacity: op }); };
      for (let i = 0; i < 9; i++) {
        const y = ty + 10 + i * 14;
        const a = TX(skew[i] + (UI - We) / 2), b = TX(skew[i] + (UI + We) / 2);
        gT.append(svg('text', { x: 10, y: y + 4, 'font-size': 10, 'font-family': 'var(--mono)', fill: 'var(--muted)', text: NAMES[i] }), hex(a, b, y, 10, 'var(--good)', 0.55));
      }
      const yc = ty + 10 + 9 * 14 + 8;
      gT.append(svg('text', { x: 10, y: yc + 4, 'font-size': 10, 'font-weight': 700, fill: 'var(--text)', text: 'whole lane' }));
      if (right > left) gT.append(hex(TX(left), TX(right), yc, 16, 'var(--good)', 0.9));
      // sampling point + requirement
      const sx = TX(sample);
      gT.append(svg('rect', { x: TX(sample - Rq / 2), y: ty + 2, width: TX(sample + Rq / 2) - TX(sample - Rq / 2), height: yc + 10 - ty, fill: 'var(--bad)', opacity: 0.13 }));
      gT.append(svg('line', { x1: sx, y1: ty, x2: sx, y2: yc + 12, stroke: 'var(--bad)', 'stroke-width': 2 }), svg('text', { x: sx, y: yc + 26, 'text-anchor': 'middle', 'font-size': 10.5, fill: 'var(--bad)', text: 'DQS edge samples here' }));
      const arrow = (a, b, y, txt, ok) => { gT.append(svg('line', { x1: a, y1: y, x2: b, y2: y, stroke: ok ? 'var(--good)' : 'var(--bad)', 'stroke-width': 1.5 }), svg('text', { x: (a + b) / 2, y: y - 3, 'text-anchor': 'middle', 'font-size': 9.5, fill: ok ? 'var(--good)' : 'var(--bad)', 'font-family': 'var(--mono)', text: txt })); };
      arrow(TX(left), TX(sample - Rq / 2), yc + 40, `setup ${Math.round(setup)} ps`, setup > 0);
      arrow(TX(sample + Rq / 2), TX(right), yc + 40, `hold ${Math.round(hold)} ps`, hold > 0);
      // ---- meters & verdicts
      const rawSk = Math.max(...delay.slice(0, 9)) - Math.min(...delay.slice(0, 9));
      const lvl = m => m < 0 ? 'bad' : m < 0.08 * UI ? 'warn' : 'good';
      M.set('ui', Math.round(UI) + ' ps');
      M.set('sk', Math.round(mx - mn) + ' ps' + (st.train ? ' (trained)' : ''), (mx - mn) > 0.2 * UI ? 'bad' : (mx - mn) > 0.08 * UI ? 'warn' : 'good');
      M.set('pui', sig((mx - mn) / UI * 100, 2) + ' %', (mx - mn) > 0.2 * UI ? 'bad' : (mx - mn) > 0.08 * UI ? 'warn' : 'good', (mx - mn) / UI / 0.4);
      M.set('su', Math.round(setup) + ' ps', lvl(setup));
      M.set('ho', Math.round(hold) + ' ps', lvl(hold));
      const items = [];
      const worst = Math.min(setup, hold);
      items.push({ level: lvl(worst), html: worst < 0 ? `<b>Fails at ${RATE_NAME[st.rate]}.</b> The bits no longer share a common window wide enough for the DRAM: ${worst === setup ? 'the latest bit arrives too close to the DQS edge (setup)' : 'the earliest bit changes again too soon after the DQS edge (hold)'}.` : `Lane works at ${RATE_NAME[st.rate]} with ${Math.round(worst)} ps worst-case margin (${sig(worst / UI * 100, 2)}% of UI).` });
      const layers = new Set(st.sig.map(s => s.layer));
      if (layers.size > 1) {
        const outs = NAMES.filter((n, i) => st.sig[i].layer === 'out');
        items.push({ level: 'warn', html: `${outs.join(', ')} ${outs.length > 1 ? 'are' : 'is'} on the outer layer: ${sig(TPD_IN - TPD_OUT, 2)} ps/mm faster than stripline, so over ~40 mm ${outs.length > 1 ? 'they arrive' : 'it arrives'} ~${Math.round(40 * (TPD_IN - TPD_OUT))} ps early <i>even with identical lengths</i>. Length matching in mm cannot see this.` });
      }
      const vs = new Set(st.sig.map(s => s.vias));
      if (vs.size > 1) items.push({ level: 'info', html: `Via counts differ within the lane (${[...vs].join(' / ')}). Each via adds ~${PS_VIA} ps here; matched layers usually means matched vias too.` });
      if (st.train) items.push({ level: 'info', html: 'Training removes skew <b>up to its range</b> and re-centres DQS. It is a safety net for manufacturing variation, not a substitute for matching: whatever exceeds the range is still lost, and training takes time at every boot.' });
      if (rawSk < 15 && layers.size === 1) items.push({ level: 'good', html: `Same layer, same vias, lengths within ±${sig(Math.max(...st.sig.map(s => Math.abs(s.len - st.sig[9].len))), 2)} mm of DQS: skew ${Math.round(rawSk)} ps. Try raising the data rate to see how much margin remains.` });
      V.set(items);
      E.set(`<p>At ${RATE_NAME[st.rate]} one bit lasts ${Math.round(UI)} ps. Jitter and ISI shrink each bit's valid window to ${Math.round(We)} ps, and the DRAM needs ${Math.round(Rq)} ps of it around the strobe edge. That leaves <b>${Math.round((We - Rq) / 2)} ps per side</b> for everything the layout does, and skew comes straight out of it.</p><p>Each mm of length mismatch costs ~${TPD_IN} ps. Each mm routed on L1 instead of L3 costs ~${sig(TPD_IN - TPD_OUT, 2)} ps, even when the lengths match.</p>`);
    }
    update();
  })();

  /* =================================================================
     11.3  Fly-by address bus
     ================================================================= */
  (function labFly() {
    const host = document.getElementById('lab-flyby'); if (!host) return;
    const L = lab(host, { title: 'Address line to four DRAM chips' });
    const st = { topo: 'tree', stub: 2, rtt: 40, z: 50, rate: 2400, wl: true };
    const sTo = seg({ label: 'Topology', options: [{ v: 'tree', label: 'Balanced T (tree)' }, { v: 'fly', label: 'Fly-by, no termination' }, { v: 'flyT', label: 'Fly-by + R_TT to V_TT' }], value: st.topo, onChange: v => { st.topo = v; update(); } });
    const sS = slider({ label: 'Stub length at each chip', min: 0.5, max: 10, step: 0.5, value: st.stub, fmt: v => sig(v, 2) + ' mm', onInput: v => { st.stub = v; update(); } });
    const sZ = seg({ label: 'Trace impedance', options: [40, 50, 60].map(v => ({ v, label: v + ' Ω' })), value: st.z, onChange: v => { st.z = v; update(); } });
    const sRt = slider({ label: 'R_TT (fly-by + termination only)', min: 20, max: 80, step: 1, value: st.rtt, fmt: v => v + ' Ω', onInput: v => { st.rtt = v; update(); } });
    const sRa = seg({ label: 'Data rate (address runs at half)', options: [1600, 2400, 3200].map(v => ({ v, label: RATE_NAME[v] })), value: st.rate, onChange: v => { st.rate = v; update(); } });
    const cW = check({ label: 'Write leveling (per-lane DQS delay)', checked: st.wl, onChange: v => { st.wl = v; update(); } });
    L.controls.append(sTo.el, sS.el, sZ.el, sRt.el, sRa.el, cW.el);
    const S = svg('svg', { class: 'viz board', viewBox: '0 0 640 150' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Address bit pattern seen at each DRAM (V_DDQ = 1.2 V)', height: 240, xlabel: 'ns', ylabel: 'V', xfmt: v => sig(v, 3), yfmt: v => sig(v, 2) });
    const W = svg('svg', { class: 'viz', viewBox: '0 0 640 128', style: 'background:var(--surface-2)' });
    L.stage.append(el('div', { class: 'plot-title' }, 'Write leveling: CK and DQS edges arriving at each chip'), W);
    const M = meters(L.stage, [{ key: 'zl', label: 'Loaded impedance' }, { key: 'ov', label: 'Worst overshoot' }, { key: 'eye', label: 'Worst eye height' }, { key: 'fl', label: 'Chip 1 → 4 delay' }, { key: 'dq', label: 'Worst DQS–CK (tDQSS)' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'LC-ladder transmission-line simulation (same engine as lesson 7). Driver 34 Ω, each DRAM input 1.2 pF, chips 14 mm apart, trunk 40 mm. Eye height = smallest distance from V_REF (0.6 V) at bit centres; the receiver needs ±100 mV. tDQSS limit ±0.27 tCK (DDR4).'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    const tpd = TPD_IN * 1e-12; // s/mm
    const PAT = [0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0];
    function draw(arr) {
      S.innerHTML = '';
      const Cu = '#e0a64a';
      const line = pts => S.append(svg('path', { d: geo.pathD(pts), fill: 'none', stroke: Cu, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
      const chipX = [250, 350, 450, 550];
      const chip = (x, y, i) => S.append(svg('rect', { x: x - 30, y: y - 18, width: 60, height: 36, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x, y: y + 4, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: `DRAM ${i + 1}` }), arr ? svg('text', { x, y: y - 24, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, 'font-family': 'var(--mono)', text: isFinite(arr[i]) ? `+${Math.round(arr[i] - arr[0])} ps` : '—' }) : null);
      S.append(svg('rect', { x: 14, y: 52, width: 64, height: 40, rx: 5, fill: '#1d2730', stroke: 'var(--silk)' }), svg('text', { x: 46, y: 76, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 11, text: 'SoC' }));
      if (st.topo === 'tree') {
        line([{ x: 78, y: 72 }, { x: 200, y: 72 }]);
        line([{ x: 200, y: 72 }, { x: 200, y: 36 }, { x: 400, y: 36 }]); line([{ x: 200, y: 72 }, { x: 200, y: 108 }, { x: 400, y: 108 }]);
        // second-level branches
        line([{ x: 400, y: 36 }, { x: 400, y: 20 }, { x: 450, y: 20 }]); line([{ x: 400, y: 36 }, { x: 400, y: 52 }, { x: 450, y: 52 }]);
        line([{ x: 400, y: 108 }, { x: 400, y: 92 }, { x: 450, y: 92 }]); line([{ x: 400, y: 108 }, { x: 400, y: 124 }, { x: 450, y: 124 }]);
        [[480, 20], [480, 52], [480, 92], [480, 124]].forEach(([x, y], i) => S.append(svg('rect', { x: x - 30, y: y - 12, width: 60, height: 24, rx: 4, fill: '#141a17', stroke: 'var(--silk)' }), svg('text', { x, y: y + 4, 'text-anchor': 'middle', fill: 'var(--silk)', 'font-size': 10.5, text: `DRAM ${i + 1}` })));
        if (arr) S.append(svg('text', { x: 590, y: 76, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10.5, text: 'all arrive together' }));
      } else {
        line([{ x: 78, y: 72 }, { x: 600, y: 72 }]);
        chipX.forEach((x, i) => { line([{ x, y: 72 }, { x, y: 62 }]); chip(x, 44, i); });
        if (st.topo === 'flyT') S.append(svg('rect', { x: 598, y: 64, width: 20, height: 16, fill: '#b9a37a' }), svg('text', { x: 608, y: 98, 'text-anchor': 'middle', fill: '#ffd166', 'font-size': 10, text: `${st.rtt} Ω→V_TT` }));
        S.append(svg('text', { x: 160, y: 90, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10, text: '40 mm trunk' }), svg('text', { x: 400, y: 120, 'text-anchor': 'middle', fill: '#cfe0d5', 'font-size': 10, text: `14 mm between chips · ${st.stub} mm stubs` }));
      }
    }
    function update() {
      const z = st.z, td = mm => mm * tpd;
      const net = new PCB.TLine(td(1));
      const CIN = 1.2e-12;
      const chips = [];
      const stub = from => { const n = net.line(from, z, td(st.stub)); net.C[n] += CIN; return n; };
      if (st.topo === 'tree') {
        const j0 = net.line(0, z, td(40));
        const a = net.line(j0, z, td(28)), b = net.line(j0, z, td(28));
        for (const j of [a, b]) for (let k = 0; k < 2; k++) chips.push(stub(net.line(j, z, td(10))));
      } else {
        let j = net.line(0, z, td(40));
        for (let k = 0; k < 4; k++) { chips.push(stub(j)); j = net.line(j, z, td(k < 3 ? 14 : 8)); }
        if (st.topo === 'flyT') { net.G[j] = 1 / st.rtt; net.J[j] = 0.6 / st.rtt; }
      }
      const bit = 2e3 / st.rate * 1e-9 * 1; // address: one bit per clock = 2 data UIs
      const tr = Math.max(0.12e-9, 0.25 * bit);
      const vs = t => { const i = Math.floor(t / bit); if (i < 1) return 0; const cur = PAT[Math.min(i, PAT.length - 1)], prev = PAT[Math.min(i - 1, PAT.length - 1)]; return 1.2 * (prev + (cur - prev) * PCB.ramp(t - i * bit, 0, tr)); };
      const T = (PAT.length + 0.5) * bit;
      const r = PCB.simNet(net, { src: 0, Rs: 34, vs, T, nOut: 900, probes: chips });
      const t = Array.from(r.t, v => v * 1e9);
      const ys = r.out.map(a => Array.from(a));
      // arrival = first crossing of 0.6 V after the first rising edge (bit 1)
      const arr = ys.map(y => { for (let i = 1; i < y.length; i++) if (y[i - 1] < 0.6 && y[i] >= 0.6) return r.t[i] * 1e12; return NaN; });
      const tFirst = bit * 1e12 + tr * 1e12 / 2;
      let ov = 0, eye = Infinity;
      ys.forEach((y, k) => {
        const fl = arr[k] - tFirst;
        for (let i = 0; i < y.length; i++) ov = Math.max(ov, y[i] - 1.2, -y[i]);
        for (let b = 1; b < PAT.length - 1; b++) {
          const tc = (b + 0.5) * bit * 1e12 + fl;
          const idx = Math.round(tc / (T * 1e12) * 900);
          if (idx > 0 && idx < y.length) eye = Math.min(eye, Math.abs(y[idx] - 0.6) * (Math.sign(y[idx] - 0.6) === (PAT[b] ? 1 : -1) ? 1 : -1));
        }
      });
      draw(arr);
      const cols = ['var(--link)', 'var(--good)', 'var(--accent)', 'var(--bad)'];
      plot.draw({ series: ys.map((y, k) => ({ x: t, y, color: cols[k], width: 1.8, label: `DRAM ${k + 1}` })), bands: [{ y0: 0.5, y1: 0.7, color: 'var(--warn)', alpha: 0.13 }], hlines: [{ y: 0.6, color: 'var(--faint)', dash: [3, 3], label: 'V_REF ± 100 mV' }], range: { ymin: -0.5, ymax: 1.9 } });
      // loaded impedance (fly-by)
      const Cp = tpd / z * 1e12; // pF/mm
      const Cl = CIN * 1e12 + st.stub * Cp;
      const zl = z / Math.sqrt(1 + Cl / (Cp * 14));
      const spread = arr[3] - arr[0];
      const tCK = 2e6 / st.rate; // ps
      const lim = 0.27 * tCK;
      // DQS lanes all routed ~ the same length: arrive when chip 1's CK does
      const dqsArr = arr.map(() => arr[0]);
      const dqss = arr.map((a, k) => (st.wl ? 0 : dqsArr[k] - a));
      const worstDq = Math.max(...dqss.map(Math.abs));
      // write-leveling strip
      W.innerHTML = '';
      const t0 = Math.min(...arr) - 100, t1 = Math.max(...arr) + 200, X = v => 110 + (v - t0) / (t1 - t0) * 500;
      for (let k = 0; k < 4; k++) {
        const y = 22 + k * 27;
        W.append(svg('text', { x: 10, y: y + 4, 'font-size': 11, fill: 'var(--muted)', text: `DRAM ${k + 1}` }), svg('line', { x1: 100, y1: y, x2: 625, y2: y, stroke: 'var(--border)' }));
        if (isFinite(arr[k])) W.append(svg('line', { x1: X(arr[k]), y1: y - 11, x2: X(arr[k]), y2: y, stroke: 'var(--link)', 'stroke-width': 3 }));
        const dq = st.wl ? arr[k] : dqsArr[k];
        if (isFinite(dq)) W.append(svg('path', { d: `M${X(dq) - 5} ${y + 11} L${X(dq)} ${y + 1} L${X(dq) + 5} ${y + 11} Z`, fill: Math.abs(dqss[k]) > lim ? 'var(--bad)' : 'var(--good)', opacity: 0.85 }));
        if (!st.wl && Math.abs(dqss[k]) > 1) W.append(svg('text', { x: X(dq) + 10, y: y + 4, 'font-size': 10, 'font-family': 'var(--mono)', fill: Math.abs(dqss[k]) > lim ? 'var(--bad)' : 'var(--muted)', text: `${Math.round(dqss[k])} ps` }));
      }
      W.append(svg('text', { x: 625, y: 122, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--faint)', text: 'blue bar = CK edge arrives · triangle = DQS edge for that chip\'s lanes' }));
      M.set('zl', st.topo === 'tree' ? '—' : Math.round(zl) + ' Ω');
      M.set('ov', sig(ov * 1000, 3) + ' mV', ov > 0.3 ? 'bad' : ov > 0.15 ? 'warn' : 'good');
      M.set('eye', isFinite(eye) ? Math.round(eye * 1000) + ' mV' : '—', eye < 0.1 ? 'bad' : eye < 0.2 ? 'warn' : 'good');
      M.set('fl', isFinite(spread) ? Math.round(spread) + ' ps' : '—');
      M.set('dq', Math.round(worstDq) + ' ps', worstDq > lim ? 'bad' : 'good');
      const items = [];
      const eyeOk = eye >= 0.1;
      if (st.topo === 'tree') items.push({ level: eyeOk ? 'warn' : 'bad', html: `Balanced tree: all four chips get the edge at the same time, but every branch is an unterminated stub for the others. Reflections bounce between the branch ends and the junctions: overshoot ${Math.round(ov * 1000)} mV, eye ${Math.round(eye * 1000)} mV. This is why DDR3 dropped the tree used by DDR2.` });
      if (st.topo === 'fly') items.push({ level: eyeOk ? 'warn' : 'bad', html: `Fly-by without termination: the far end is open, so the whole edge reflects back through all four chips. Eye ${Math.round(eye * 1000)} mV.` });
      if (st.topo === 'flyT') {
        const mis = Math.abs(st.rtt - zl) / zl;
        items.push({ level: eyeOk ? (mis < 0.15 ? 'good' : 'warn') : 'bad', html: `Fly-by with ${st.rtt} Ω to V_TT. The four chips load the ${z} Ω trace down to about <b>${Math.round(zl)} Ω</b>; R_TT ${mis < 0.15 ? 'matches it well' : `is ${st.rtt > zl ? 'higher' : 'lower'} than that, so some of the edge still reflects`}. Eye ${Math.round(eye * 1000)} mV.` });
      }
      if (st.stub > 4) items.push({ level: 'warn', html: `${st.stub} mm stubs at each chip add capacitance and their own reflections. Keep the via straight down at the ball and the stub as short as the fanout allows.` });
      if (st.topo !== 'tree') items.push({ level: !st.wl && worstDq > lim ? 'bad' : 'info', html: st.wl ? `The address reaches chip 4 ${Math.round(spread)} ps after chip 1. Write leveling has measured this and delays each lane's DQS to match its own chip's clock (triangles line up with the bars).` : `Without write leveling, DQS reaches every chip at the same time but CK doesn't: chip 4 is off by ${Math.round(worstDq)} ps, beyond tDQSS (±${Math.round(lim)} ps at this rate). Fly-by only works because the controller trains this out.` });
      V.set(items);
      E.set(`<p>Fly-by turns a branching network into one transmission line with small capacitive bumps along it. Spread evenly, those bumps behave like extra capacitance per mm, which lowers the impedance: Z<sub>loaded</sub> = Z<sub>0</sub>/√(1 + C<sub>load</sub>/C<sub>line</sub>) ≈ ${Math.round(zl)} Ω here. Terminating at that value absorbs the edge at the end. The same extra capacitance also <b>slows</b> the edge down, which is why chip 4 is later than the bare 14 mm spacing suggests.</p><p>That's why DDR guides often specify ~40 Ω for address/command and a termination of about the same value. Trunk and stubs are kept short so the chips sit on the line, not on branches.</p>`);
    }
    update();
  })();

  /* =================================================================
     11.4  Timing budget
     ================================================================= */
  (function labBudget() {
    const host = document.getElementById('lab-budget'); if (!host) return;
    const L = lab(host, { title: 'Spend the unit interval' });
    const st = { rate: 3200, tol: 2.5, layer: 'same', vias: true, sp: '2', ref: 'gnd', vref: true, odt: true };
    const sR = seg({ label: 'Data rate', options: RATES.map(v => ({ v, label: RATE_NAME[v] })), value: st.rate, onChange: v => { st.rate = v; update(); } });
    const sT = slider({ label: 'Length-match tolerance in a lane', min: 0.25, max: 10, step: 0.25, value: st.tol, fmt: v => `±${sig(v, 2)} mm`, onInput: v => { st.tol = v; update(); } });
    const sL = seg({ label: 'Lane routed on', options: [{ v: 'same', label: 'one layer' }, { v: 'mixed', label: 'L1 + L3 mixed' }], value: st.layer, onChange: v => { st.layer = v; update(); } });
    const cV = check({ label: 'Same via count on every bit', checked: st.vias, onChange: v => { st.vias = v; update(); } });
    const sSp = seg({ label: 'Spacing between bits in the lane', options: [{ v: '1', label: '1W' }, { v: '2', label: '2W' }, { v: '3', label: '3W' }], value: st.sp, onChange: v => { st.sp = v; update(); } });
    const sRf = seg({ label: 'Reference plane under the lane', options: [{ v: 'gnd', label: 'solid GND' }, { v: 'pwr', label: 'solid VDDQ' }, { v: 'split', label: 'crosses a split' }], value: st.ref, onChange: v => { st.ref = v; update(); } });
    const cR = check({ label: 'VREF decoupled at the DRAM pins', checked: st.vref, onChange: v => { st.vref = v; update(); } });
    const cO = check({ label: 'On-die termination (ODT) enabled', checked: st.odt, onChange: v => { st.odt = v; update(); } });
    L.controls.append(sR.el, sT.el, sL.el, cV.el, sSp.el, sRf.el, cR.el, cO.el);
    const S = svg('svg', { class: 'viz', viewBox: '0 0 640 200', style: 'background:var(--surface-2)' });
    L.stage.append(S);
    const plot = new Plot(L.stage, { title: 'Margin vs data rate with these layout choices', height: 200, xmin: 800, xmax: 7000, xlabel: 'MT/s', ylabel: 'margin [ps]', xfmt: v => sig(v, 2), yfmt: v => sig(v, 3) });
    const M = meters(L.stage, [{ key: 'ui', label: 'Unit interval' }, { key: 'lay', label: 'Layout uses' }, { key: 'mg', label: 'Margin left' }, { key: 'max', label: 'Highest rate that works' }]);
    L.stage.append(el('div', { class: 'model-note' }, 'Illustrative budget. Fixed parts: DRAM valid window 0.16·UI + 20 ps; driver/channel jitter + ISI 0.18·UI + 30 ps. Layout terms are typical magnitudes chosen to show the trend, not values from a datasheet.'));
    const V = verdicts(L.left);
    const E = explain(L.right, 'Why');
    function terms(rate) {
      const UI = 1e6 / rate;
      const t = [
        { k: 'DRAM valid window', v: dramWin(UI), c: '#8b918d', fixed: true },
        { k: 'Jitter + ISI (silicon, channel)', v: eyeLoss(UI), c: '#a7aca8', fixed: true },
        { k: 'Length mismatch', v: 2 * st.tol * TPD_IN, c: '#5cb8ff' },
        { k: 'Layer velocity mismatch', v: st.layer === 'mixed' ? 40 * (TPD_IN - TPD_OUT) : 0, c: '#e0a64a' },
        { k: 'Via-count mismatch', v: st.vias ? 0 : 2 * PS_VIA, c: '#c98bd9' },
        { k: 'Crosstalk jitter', v: { 1: 32, 2: 15, 3: 7 }[st.sp], c: '#ff7b3a' },
        { k: 'Reference plane', v: { gnd: 0, pwr: 8, split: 45 }[st.ref], c: '#77d48b' },
        { k: 'VREF noise', v: st.vref ? 0 : 18, c: '#ffd166' },
        { k: 'Reflections (no ODT)', v: st.odt ? 0 : 0.15 * UI + 20, c: '#ff5d6c' },
      ];
      const used = t.reduce((s, x) => s + x.v, 0);
      return { UI, t, used, margin: UI - used };
    }
    function update() {
      const b = terms(st.rate);
      S.innerHTML = '';
      const sc = 560 / Math.max(b.UI, b.used);
      let x = 40;
      S.append(svg('text', { x: 40, y: 18, 'font-size': 11, fill: 'var(--muted)', text: `One bit time at ${RATE_NAME[st.rate]}: ${Math.round(b.UI)} ps` }));
      S.append(svg('rect', { x: 40, y: 28, width: b.UI * sc, height: 34, fill: 'none', stroke: 'var(--text)', 'stroke-width': 1.5, rx: 3 }));
      const shown = b.t.filter(z => z.v > 0.5);
      shown.forEach(z => { const w = z.v * sc; S.append(svg('rect', { x, y: 32, width: Math.max(w, 1), height: 26, fill: z.c, opacity: 0.9 })); x += w; });
      if (b.margin > 0) S.append(svg('rect', { x, y: 32, width: b.margin * sc, height: 26, fill: 'var(--good)', opacity: 0.35 }), svg('text', { x: x + b.margin * sc / 2, y: 50, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: 'var(--good)', text: b.margin * sc > 60 ? 'margin' : '' }));
      else S.append(svg('line', { x1: 40 + b.UI * sc, y1: 22, x2: 40 + b.UI * sc, y2: 68, stroke: 'var(--bad)', 'stroke-width': 2.5 }), svg('text', { x: 40 + b.UI * sc - 4, y: 80, 'text-anchor': 'end', 'font-size': 10.5, fill: 'var(--bad)', text: 'end of the bit: over budget →' }));
      setAttrs(S, { viewBox: `0 0 640 ${100 + Math.ceil(shown.length / 2) * 20}` });
      // legend rows
      shown.forEach((z, i) => { const col = i % 2, row = Math.floor(i / 2); const lx = 40 + col * 300, ly = 100 + row * 20; S.append(svg('rect', { x: lx, y: ly - 9, width: 12, height: 12, rx: 2, fill: z.c }), svg('text', { x: lx + 18, y: ly + 1, 'font-size': 11, fill: z.fixed ? 'var(--muted)' : 'var(--text)', text: `${z.k}: ${Math.round(z.v)} ps` })); });
      // margin vs rate
      const xs = [], ys = [];
      let maxRate = 0;
      for (let i = 0; i <= 124; i++) { const r = 800 + 50 * i; xs.push(r); const m = terms(r).margin; ys.push(m); if (m > 0) maxRate = r; }
      plot.draw({ series: [{ x: xs, y: ys, color: 'var(--accent)', width: 2.4, label: 'margin' }], hlines: [{ y: 0, color: 'var(--bad)', dash: [4, 3], label: 'no margin' }], vlines: [{ x: st.rate, color: 'var(--link)', label: RATE_NAME[st.rate] }], range: { ymin: -150, ymax: 400 } });
      const layout = b.t.filter(z => !z.fixed).reduce((s, z) => s + z.v, 0);
      M.set('ui', Math.round(b.UI) + ' ps');
      M.set('lay', Math.round(layout) + ' ps', layout > 0.25 * b.UI ? 'bad' : layout > 0.12 * b.UI ? 'warn' : 'good');
      M.set('mg', Math.round(b.margin) + ' ps', b.margin < 0 ? 'bad' : b.margin < 0.08 * b.UI ? 'warn' : 'good');
      M.set('max', maxRate >= 6999 ? '> 7000 MT/s' : Math.round(maxRate / 10) * 10 + ' MT/s');
      const items = [];
      items.push({ level: b.margin < 0 ? 'bad' : b.margin < 0.08 * b.UI ? 'warn' : 'good', html: b.margin < 0 ? `Over budget by ${Math.round(-b.margin)} ps: this lane will fail at ${RATE_NAME[st.rate]} (or only work after training eats into its range).` : `${Math.round(b.margin)} ps left over (${sig(b.margin / b.UI * 100, 2)}% of UI). This layout would work up to about ${Math.round(maxRate / 10) * 10} MT/s.` });
      const big = b.t.filter(z => !z.fixed).sort((a, c) => c.v - a.v)[0];
      if (big && big.v > 5) items.push({ level: 'info', html: `Largest layout term: <b>${big.k}</b> (${Math.round(big.v)} ps). Fix that first.` });
      if (st.ref === 'split') items.push({ level: 'bad', html: 'A lane crossing a plane split loses its return path (lesson 3): ringing and crosstalk jump for every bit that crosses.' });
      if (st.ref === 'pwr') items.push({ level: 'info', html: 'Referencing VDDQ is common and works, because the return current crosses to ground through the decoupling capacitors. Solid ground is still the safer reference.' });
      if (!st.odt) items.push({ level: 'bad', html: 'Without ODT every bit reflects off the receiver and the next bit lands on top of the echo (ISI).' });
      V.set(items);
      E.set(`<p>The two grey blocks are set by the silicon and grow in proportion to the UI. The coloured blocks are <b>your layout</b>, and most of them are fixed in picoseconds. A ±${sig(st.tol, 2)} mm match costs ${Math.round(2 * st.tol * TPD_IN)} ps whether the bit lasts ${Math.round(1e6 / 1600)} ps or ${Math.round(1e6 / 6400)} ps.</p><p>That's why guidelines for faster memories tighten the match tolerance and add new rules (same layer, same vias, wider spacing), rather than only scaling the old ones.</p>`);
    }
    update();
  })();

  PCB.quiz(document.getElementById('quiz-box'), [
    { q: 'DQ3 is 40 mm on L1 (microstrip); DQS is 40 mm on L3 (stripline). Are they matched?', opts: ['Yes, the lengths are equal', 'No: the outer layer is faster, so DQ3 arrives ~35 ps early', 'No: the inner layer is faster'], a: 1, ex: 'Microstrip has part of its field in air (lower effective Dk), so it is ~0.9 ps/mm faster than stripline in FR-4. Match in time, or keep the lane on one layer.' },
    { q: 'Byte lane 0 is 30 mm long and byte lane 5 is 55 mm long. Is that a problem?', opts: ['Yes, all data must be the same length', 'Usually not: each lane is timed by its own DQS, so lanes only need to match internally (within the controller\'s limits)', 'Only on reads'], a: 1, ex: 'Source-synchronous timing makes each lane independent. Lane-to-lane differences are absorbed by training, within the limits the guide gives.' },
    { q: 'Why is the fly-by address bus terminated with ~40 Ω even though the trace is 50 Ω?', opts: ['To save power', 'The DRAM input capacitance spread along the line lowers its effective (loaded) impedance to around 40 Ω', 'Because V_TT is 0.6 V'], a: 1, ex: 'Z_loaded = Z0/√(1 + C_load/C_line). Matching the termination to the loaded impedance absorbs the edge at the end of the chain.' },
    { q: 'In fly-by, chip 4 receives CK ~300 ps after chip 1. What keeps the data writes working?', opts: ['Making the clock trace shorter for chip 4', 'Write leveling: the controller measures each chip\'s CK arrival and delays that lane\'s DQS to match', 'Nothing; fly-by limits you to one chip'], a: 1, ex: 'Write leveling is a training step at start-up. It is why fly-by can replace the balanced tree.' },
  ]);
})();
