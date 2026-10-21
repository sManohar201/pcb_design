/* PCB Layout Fundamentals — shared core: chrome, widgets, plotting, physics, solver */
(function () {
  'use strict';
  const PCB = (window.PCB = {});

  /* ------------------------------------------------------------------ DOM */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null) n.append(c);
    return n;
  }
  function setAttrs(n, attrs) { for (const k in attrs) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); } return n; }
  PCB.el = el; PCB.svg = svg; PCB.setAttrs = setAttrs;
  PCB.$ = (s, r = document) => r.querySelector(s);

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }
  function resolveColor(c) {
    if (!c) return cssVar('--text');
    const m = /^var\((--[\w-]+)\)$/.exec(c);
    return m ? cssVar(m[1]) : c;
  }
  PCB.cssVar = cssVar; PCB.color = resolveColor;

  /* ----------------------------------------------------------- formatting */
  function sig(x, d = 3) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const r = Number(x.toPrecision(d));
    const mag = Math.floor(Math.log10(Math.abs(r)));
    const dec = Math.max(0, Math.min(8, d - 1 - mag));
    return r.toFixed(dec);
  }
  const PREFIX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  function fmtSI(v, unit = '', d = 3) {
    if (!isFinite(v)) return '—';
    if (v === 0) return '0 ' + unit;
    const a = Math.abs(v);
    for (let i = 0; i < PREFIX.length; i++) {
      const [s, p] = PREFIX[i];
      if (a >= s * 0.9995 || i === PREFIX.length - 1) {
        let n = Number((v / s).toPrecision(d));
        if (Math.abs(n) >= 1000 && i > 0) { const [s2, p2] = PREFIX[i - 1]; return sig(v / s2, d) + ' ' + p2 + unit; }
        return sig(n, d) + ' ' + p + unit;
      }
    }
  }
  PCB.sig = sig; PCB.fmtSI = fmtSI;
  PCB.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  PCB.lerp = (a, b, t) => a + (b - a) * t;

  /* -------------------------------------------------------------- storage */
  const store = {
    get(k, def) { try { const v = localStorage.getItem('pcbcourse:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('pcbcourse:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  PCB.store = store;

  /* ---------------------------------------------------------------- theme */
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    window.dispatchEvent(new Event('pcb-theme'));
  }
  applyTheme(store.get('theme', null));
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.dispatchEvent(new Event('pcb-theme')));

  /* --------------------------------------------------------- course map */
  const LESSONS = [
    { n: 0, t: 'Board tour: anatomy of a carrier board', part: 'A', phase: 3, file: 'lesson-00.html', d: 'What is on a module carrier board, where it goes, and which lesson explains each part.' },
    { n: 1, t: 'Every wire is a resistor and an inductor', part: 'A', phase: 1, file: 'lesson-01.html', d: 'Copper resistance, inductance, V = L·di/dt, and what a power trace does to its neighbours.' },
    { n: 2, t: 'Stackup design', part: 'A', phase: 2, file: 'lesson-02.html', d: 'Layer order, plane pairs, controlled impedance and material loss.' },
    { n: 3, t: 'Return current: every signal is a loop', part: 'B', phase: 1, file: 'lesson-03.html', d: 'Where current really flows back, slots in planes, and changing layers.' },
    { n: 4, t: 'Grounding with multiple voltage levels', part: 'B', phase: 1, file: 'lesson-04.html', d: 'One ground or many? Placement, split planes, power islands, chassis and ESD.' },
    { n: 5, t: 'Power planes & the PDN', part: 'B', phase: 1, file: 'lesson-05.html', d: 'Decoupling, mounting inductance, target impedance and plane current crowding.' },
    { n: 6, t: 'Buck converter layout', part: 'B', phase: 2, file: 'lesson-06.html', d: 'Hot loops, ringing, the inductor, feedback routing and snubbers.' },
    { n: 7, t: 'Transmission lines & reflections', part: 'C', phase: 2, file: 'lesson-07.html', d: 'Watch edges bounce, choose terminations, and find discontinuities with TDR.' },
    { n: 8, t: 'Differential pairs', part: 'C', phase: 2, file: 'lesson-08.html', d: 'Why pairs reject noise, where skew comes from, and how to match it.' },
    { n: 9, t: 'Crosstalk', part: 'C', phase: 2, file: 'lesson-09.html', d: 'Near-end and far-end crosstalk, the 3W rule, guards and adjacent layers.' },
    { n: 10, t: 'Vias', part: 'C', phase: 2, file: 'lesson-10.html', d: 'Via types and stubs, via impedance, current capacity and BGA fanout.' },
    { n: 11, t: 'Memory (DDR) routing', part: 'C', phase: 3, file: 'lesson-11.html', d: 'Byte lanes and strobes, matching in time, fly-by address buses and the timing budget.' },
    { n: 12, t: 'Placement for a carrier board', part: 'D', phase: 3, file: 'lesson-12.html', d: 'Floorplanning, connector orientation and pin order, and thermal placement.' },
    { n: 13, t: 'DFM & “who’s right?”', part: 'D', phase: 3, file: 'lesson-13.html', d: 'Manufacturing rules and their cost, thermal relief and tombstoning, and where the PDFs disagree.' },
    { n: 14, t: '★ Final challenge: review a bad board', part: 'D', phase: 3, file: 'lesson-14.html', d: 'Find the layout mistakes on a carrier board, layer by layer, then see each one fixed.' },
  ];
  const PARTS = { A: 'Foundations', B: 'Grounding & power', C: 'High-speed signals', D: 'Placement & manufacturing' };
  PCB.LESSONS = LESSONS; PCB.PARTS = PARTS;
  PCB.isDone = n => store.get('done', []).includes(n);
  PCB.setDone = (n, v) => {
    const s = new Set(store.get('done', []));
    v ? s.add(n) : s.delete(n);
    store.set('done', [...s]);
    window.dispatchEvent(new Event('pcb-progress'));
  };

  const ICON_SUN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const BRAND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="1.5" stroke="#e0a64a" stroke-width="1.8"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" stroke="#e0a64a" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function renderChrome(opts = {}) {
    const top = document.getElementById('topbar');
    if (top) {
      top.className = 'topbar';
      const pill = el('span', { class: 'progress-pill' });
      const upd = () => {
        const avail = LESSONS.filter(l => l.file).length;
        const done = LESSONS.filter(l => l.file && PCB.isDone(l.n)).length;
        pill.textContent = `${done}/${avail} lessons done`;
      };
      upd(); window.addEventListener('pcb-progress', upd);
      const tbtn = el('button', { class: 'icon-btn', title: 'Toggle light/dark', 'aria-label': 'Toggle theme' });
      const setIcon = () => { tbtn.innerHTML = isDark() ? ICON_SUN : ICON_MOON; };
      setIcon();
      tbtn.addEventListener('click', () => {
        const next = isDark() ? 'light' : 'dark';
        store.set('theme', next); applyTheme(next); setIcon();
      });
      window.addEventListener('pcb-theme', setIcon);
      top.append(
        el('a', { class: 'brand', href: 'index.html', html: `<span class="brand-mark">${BRAND}</span><span>PCB Layout Fundamentals</span>` }),
        el('span', { class: 'spacer' }),
        el('a', { class: 'navlink hide-sm', href: 'index.html' }, 'Course map'),
        pill, tbtn
      );
    }
    const side = document.getElementById('sidebar');
    if (side) {
      side.className = 'sidebar';
      let part = null;
      const subs = [];
      for (const l of LESSONS) {
        if (l.part !== part) { part = l.part; side.append(el('h4', null, `${part} · ${PARTS[part]}`)); }
        const label = l.n === 14 ? l.t : `${l.n}. ${l.t}`;
        const a = el('a', { href: l.file || '#', class: (l.file ? '' : 'locked') + (opts.lesson === l.n ? ' active' : '') + (PCB.isDone(l.n) ? ' done' : ''), title: l.file ? '' : `Coming in phase ${l.phase}` }, label);
        side.append(a);
        if (opts.lesson === l.n) {
          document.querySelectorAll('main h2[id]').forEach(h => {
            const s = el('a', { class: 'sub', href: '#' + h.id }, h.dataset.short || h.textContent);
            subs.push([h, s]); side.append(s);
          });
        }
      }
      if (subs.length && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(ents => {
          ents.forEach(en => {
            if (en.isIntersecting) subs.forEach(([h, s]) => s.classList.toggle('active', h === en.target));
          });
        }, { rootMargin: '-20% 0px -70% 0px' });
        subs.forEach(([h]) => io.observe(h));
      }
    }
    // completion + prev/next
    const tail = document.getElementById('lesson-tail');
    if (tail && opts.lesson != null) {
      const btn = el('button', { class: 'btn primary' });
      const upd = () => { const d = PCB.isDone(opts.lesson); btn.textContent = d ? '✓ Marked complete' : 'Mark lesson complete'; btn.classList.toggle('primary', !d); };
      btn.addEventListener('click', () => { PCB.setDone(opts.lesson, !PCB.isDone(opts.lesson)); upd(); });
      upd();
      tail.append(el('div', { class: 'complete-row' }, btn, el('span', { class: 'hint' }, 'Progress is saved in this browser only.')));
      const avail = LESSONS.filter(l => l.file);
      const i = avail.findIndex(l => l.n === opts.lesson);
      const nav = el('div', { class: 'lesson-nav' });
      const prev = avail[i - 1], next = avail[i + 1];
      nav.append(prev ? el('a', { href: prev.file }, el('small', null, '← Previous'), `${prev.n}. ${prev.t}`) : el('span'));
      nav.append(next ? el('a', { href: next.file, style: { textAlign: 'right' } }, el('small', null, 'Next →'), `${next.n}. ${next.t}`) : el('a', { href: 'index.html', style: { textAlign: 'right' } }, el('small', null, 'End of the course'), 'Back to course map'));
      tail.append(nav);
    }
  }
  PCB.renderChrome = renderChrome;

  /* -------------------------------------------------------------- widgets */
  function lab(container, { title, tag = 'Lab', stack = false, tools } = {}) {
    const head = el('div', { class: 'lab-head' }, el('span', { class: 'lab-tag' }, tag), el('span', { class: 'lab-title' }, title || ''), el('span', { class: 'spacer' }));
    if (tools) head.append(tools);
    const controls = el('div', { class: 'lab-controls' });
    const stage = el('div', { class: 'lab-stage' });
    const body = el('div', { class: 'lab-body' + (stack ? ' stack' : '') }, stack ? null : controls, stage);
    const left = el('div', { class: 'verdicts' });
    const right = el('div', { class: 'explain' });
    const foot = el('div', { class: 'lab-foot' }, left, right);
    const card = el('section', { class: 'lab' }, head, body, foot);
    container.append(card);
    return { card, head, controls, stage, left, right, foot, body };
  }
  PCB.lab = lab;

  function slider({ label, min, max, step, value, log = false, fmt, onInput, hint }) {
    const val = el('span', { class: 'ctl-val' });
    const input = el('input', { type: 'range' });
    const toPos = v => log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) * 1000 : v;
    const fromPos = p => {
      if (!log) return +p;
      const v = Math.exp(Math.log(min) + (p / 1000) * (Math.log(max) - Math.log(min)));
      if (!step) return v;
      return Math.round(v / step) * step;
    };
    if (log) { input.min = 0; input.max = 1000; input.step = 1; }
    else { input.min = min; input.max = max; input.step = step || 'any'; }
    let cur = value;
    input.value = toPos(value);
    const show = () => { val.textContent = fmt ? fmt(cur) : sig(cur); };
    input.addEventListener('input', () => { cur = fromPos(input.value); show(); onInput && onInput(cur); });
    show();
    const node = el('div', { class: 'ctl' }, el('div', { class: 'ctl-row' }, el('span', { class: 'ctl-label' }, label), val), input, hint ? el('div', { class: 'hint' }, hint) : null);
    return {
      el: node, input,
      get value() { return cur; },
      set(v, fire = false) { cur = v; input.value = toPos(v); show(); if (fire && onInput) onInput(cur); },
    };
  }
  PCB.slider = slider;

  function seg({ label, options, value, onChange }) {
    const wrap = el('div', { class: 'seg', role: 'group' });
    let cur = value;
    const btns = options.map(o => {
      const b = el('button', { type: 'button', title: o.title || '' }, o.label);
      b.addEventListener('click', () => { cur = o.v; paint(); onChange && onChange(cur); });
      wrap.append(b);
      return [o.v, b];
    });
    const paint = () => btns.forEach(([v, b]) => b.classList.toggle('on', v === cur));
    paint();
    const node = el('div', { class: 'ctl' }, label ? el('div', { class: 'ctl-row' }, el('span', { class: 'ctl-label' }, label)) : null, wrap);
    return { el: node, get value() { return cur; }, set(v, fire = false) { cur = v; paint(); if (fire && onChange) onChange(cur); } };
  }
  PCB.seg = seg;

  function check({ label, checked = false, onChange }) {
    const input = el('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => onChange && onChange(input.checked));
    const node = el('label', { class: 'chk' }, input, el('span', null, label));
    return { el: node, get value() { return input.checked; }, set(v, fire = false) { input.checked = v; if (fire && onChange) onChange(v); } };
  }
  PCB.check = check;

  function meters(container, defs) {
    const box = el('div', { class: 'meters' });
    const map = {};
    for (const d of defs) {
      const v = el('div', { class: 'm-val' }, '—');
      const bar = d.bar ? el('div', { class: 'bar' }, el('i')) : null;
      const m = el('div', { class: 'meter', title: d.title || '' }, el('div', { class: 'm-label' }, d.label), v, bar);
      box.append(m);
      map[d.key] = { m, v, bar };
    }
    container.append(box);
    return {
      el: box,
      set(key, text, level, frac) {
        const o = map[key]; if (!o) return;
        o.v.textContent = text;
        o.m.className = 'meter' + (level ? ' ' + level : '');
        if (o.bar && frac != null) {
          const i = o.bar.firstChild;
          i.style.width = (PCB.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
          i.style.background = level === 'bad' ? 'var(--bad)' : level === 'warn' ? 'var(--warn)' : level === 'good' ? 'var(--good)' : 'var(--accent)';
        }
      },
    };
  }
  PCB.meters = meters;

  const VD_ICON = { good: '✓', warn: '!', bad: '✕', info: 'i' };
  function verdicts(container, title = 'What happens') {
    container.innerHTML = '';
    const h = el('h5', null, title);
    const list = el('div', { class: 'verdicts' });
    container.append(h, list);
    return {
      set(items) {
        list.innerHTML = '';
        for (const it of items) {
          const row = el('div', { class: 'vd ' + it.level }, el('span', { class: 'ic' }, VD_ICON[it.level] || '•'), el('span', { html: it.html || '' }, it.text || ''));
          list.append(row);
        }
      },
    };
  }
  PCB.verdicts = verdicts;

  function explain(container, title = 'Why') {
    container.innerHTML = '';
    const h = el('h5', null, title);
    const body = el('div');
    container.append(h, body);
    return { set(html) { body.innerHTML = html; } };
  }
  PCB.explain = explain;

  function legend(items) {
    return el('div', { class: 'legend' }, items.map(([c, t, dash]) => el('span', null, el('i', { style: { background: dash ? `repeating-linear-gradient(90deg, ${c} 0 4px, transparent 4px 7px)` : c } }), t)));
  }
  PCB.legend = legend;

  /* ------------------------------------------------------------- quiz */
  function quiz(container, questions) {
    const box = el('div', { class: 'quiz' });
    for (const q of questions) {
      const ex = el('div', { class: 'q-explain', html: q.ex });
      const opts = el('div', { class: 'q-opts' });
      const btns = q.opts.map((o, i) => {
        const b = el('button', { class: 'q-opt', type: 'button', html: o });
        b.addEventListener('click', () => {
          btns.forEach((bb, j) => { bb.disabled = true; if (j === q.a) bb.classList.add('right'); });
          if (i !== q.a) b.classList.add('wrong');
          ex.classList.add('show');
        });
        opts.append(b);
        return b;
      });
      box.append(el('div', { class: 'q' }, el('div', { class: 'q-text', html: q.q }), opts, ex));
    }
    container.append(box);
  }
  PCB.quiz = quiz;

  /* --------------------------------------------------------- SVG dragging */
  function svgPoint(svgRoot, e) {
    const pt = svgRoot.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svgRoot.getScreenCTM().inverse());
  }
  function draggable(svgRoot, target, { onStart, onMove, onEnd } = {}) {
    target.classList.add('draggable');
    target.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      try { target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const p0 = svgPoint(svgRoot, e);
      onStart && onStart(p0, e);
      const move = ev => onMove && onMove(svgPoint(svgRoot, ev), ev);
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        onEnd && onEnd();
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }
  PCB.svgPoint = svgPoint; PCB.draggable = draggable;

  /* ---------------------------------------------------------- canvas plot */
  function niceStep(span, n) {
    const raw = span / n;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  class Plot {
    constructor(parent, o = {}) {
      this.o = Object.assign({ height: 220, xlog: false, ylog: false, xfmt: v => sig(v, 3), yfmt: v => sig(v, 3), margin: { l: 56, r: 14, t: 12, b: 32 } }, o);
      this.wrap = el('div', { class: 'plot-wrap' });
      if (o.title) parent.append(el('div', { class: 'plot-title' }, o.title));
      this.canvas = el('canvas', { style: { height: this.o.height + 'px' } });
      this.wrap.append(this.canvas);
      parent.append(this.wrap);
      this.data = null;
      if ('ResizeObserver' in window) new ResizeObserver(() => this.render()).observe(this.wrap);
      window.addEventListener('pcb-theme', () => this.render());
    }
    draw(data) { this.data = data; this.render(); }
    sx(x) { const { x0, x1, pw, l } = this.f; return l + (this.o.xlog ? (Math.log10(x) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) : (x - x0) / (x1 - x0)) * pw; }
    sy(y) { const { y0, y1, ph, t } = this.f; return t + ph - (this.o.ylog ? (Math.log10(y) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) : (y - y0) / (y1 - y0)) * ph; }
    render() {
      const d = this.data; if (!d) return;
      const c = this.canvas, dpr = window.devicePixelRatio || 1;
      const W = this.wrap.clientWidth, H = this.o.height;
      if (!W) return;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const m = this.o.margin;
      const series = d.series || [];
      let { xmin, xmax, ymin, ymax } = Object.assign({}, this.o, d.range || {});
      if (xmin == null || xmax == null) {
        let a = Infinity, b = -Infinity;
        series.forEach(s => s.x.forEach(v => { if (isFinite(v)) { a = Math.min(a, v); b = Math.max(b, v); } }));
        if (xmin == null) xmin = a; if (xmax == null) xmax = b;
      }
      if (ymin == null || ymax == null) {
        let a = Infinity, b = -Infinity;
        series.forEach(s => s.y.forEach(v => { if (isFinite(v)) { a = Math.min(a, v); b = Math.max(b, v); } }));
        (d.hlines || []).forEach(h => { a = Math.min(a, h.y); b = Math.max(b, h.y); });
        if (!isFinite(a)) { a = 0; b = 1; }
        if (a === b) { a -= 1; b += 1; }
        const pad = this.o.ylog ? 0 : (b - a) * 0.08;
        if (ymin == null) ymin = a - pad; if (ymax == null) ymax = b + pad;
      }
      this.f = { x0: xmin, x1: xmax, y0: ymin, y1: ymax, l: m.l, t: m.t, pw: W - m.l - m.r, ph: H - m.t - m.b };
      const text = cssVar('--muted'), grid = cssVar('--border');
      g.font = '11px ' + cssVar('--sans');
      g.lineWidth = 1;
      // regions
      for (const r of d.xspans || []) {
        g.fillStyle = resolveColor(r.color); g.globalAlpha = r.alpha ?? 0.15;
        const a = this.sx(Math.max(r.x0, xmin)), b = this.sx(Math.min(r.x1, xmax));
        g.fillRect(a, m.t, b - a, this.f.ph); g.globalAlpha = 1;
        if (r.label) { g.fillStyle = resolveColor(r.color); g.fillText(r.label, a + 4, m.t + 12); }
      }
      for (const r of d.bands || []) {
        g.fillStyle = resolveColor(r.color); g.globalAlpha = r.alpha ?? 0.12;
        const a = this.sy(Math.min(r.y1, ymax)), b = this.sy(Math.max(r.y0, ymin));
        g.fillRect(m.l, a, this.f.pw, b - a); g.globalAlpha = 1;
      }
      // grid + ticks
      g.strokeStyle = grid; g.fillStyle = text;
      const xt = this.ticks(xmin, xmax, this.o.xlog, Math.max(3, Math.floor(this.f.pw / 80)));
      const yt = this.ticks(ymin, ymax, this.o.ylog, Math.max(3, Math.floor(this.f.ph / 40)));
      g.textAlign = 'center'; g.textBaseline = 'top';
      for (const v of xt) { const x = this.sx(v); g.beginPath(); g.moveTo(x, m.t); g.lineTo(x, m.t + this.f.ph); g.stroke(); g.fillText(this.o.xfmt(v), x, m.t + this.f.ph + 6); }
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const v of yt) { const y = this.sy(v); g.beginPath(); g.moveTo(m.l, y); g.lineTo(m.l + this.f.pw, y); g.stroke(); g.fillText(this.o.yfmt(v), m.l - 6, y); }
      if (this.o.xlabel) { g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(this.o.xlabel, m.l + this.f.pw, H - 1); }
      if (this.o.ylabel) { g.save(); g.translate(11, m.t + this.f.ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.o.ylabel, 0, 0); g.restore(); }
      // clip
      g.save(); g.beginPath(); g.rect(m.l, m.t, this.f.pw, this.f.ph); g.clip();
      for (const h of d.hlines || []) {
        g.strokeStyle = resolveColor(h.color); g.setLineDash(h.dash || [5, 4]); g.lineWidth = h.width || 1.5;
        const y = this.sy(h.y); g.beginPath(); g.moveTo(m.l, y); g.lineTo(m.l + this.f.pw, y); g.stroke();
        if (h.label) { g.setLineDash([]); g.fillStyle = resolveColor(h.color); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(h.label, m.l + 6, y - 3); }
      }
      for (const v of d.vlines || []) {
        g.strokeStyle = resolveColor(v.color); g.setLineDash(v.dash || [4, 4]); g.lineWidth = v.width || 1.2;
        const x = this.sx(v.x); g.beginPath(); g.moveTo(x, m.t); g.lineTo(x, m.t + this.f.ph); g.stroke();
        if (v.label) { g.setLineDash([]); g.fillStyle = resolveColor(v.color); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(v.label, x + 4, m.t + 4); }
      }
      g.setLineDash([]);
      for (const s of series) {
        g.strokeStyle = resolveColor(s.color); g.lineWidth = s.width || 2; g.globalAlpha = s.alpha ?? 1;
        g.setLineDash(s.dash || []);
        g.beginPath();
        let started = false;
        for (let i = 0; i < s.x.length; i++) {
          const xv = s.x[i], yv = s.y[i];
          if (!isFinite(xv) || !isFinite(yv) || (this.o.ylog && yv <= 0)) { started = false; continue; }
          const X = this.sx(xv), Y = this.sy(yv);
          if (!started) { g.moveTo(X, Y); started = true; } else g.lineTo(X, Y);
        }
        g.stroke();
        if (s.fill) {
          g.lineTo(this.sx(s.x[s.x.length - 1]), this.sy(s.fillTo ?? Math.max(ymin, 0)));
          g.lineTo(this.sx(s.x[0]), this.sy(s.fillTo ?? Math.max(ymin, 0)));
          g.closePath(); g.fillStyle = resolveColor(s.color); g.globalAlpha = s.fillAlpha ?? 0.12; g.fill();
        }
        g.globalAlpha = 1; g.setLineDash([]);
      }
      for (const p of d.markers || []) {
        g.fillStyle = resolveColor(p.color); g.beginPath(); g.arc(this.sx(p.x), this.sy(p.y), p.r || 4, 0, 7); g.fill();
        if (p.label) { g.textAlign = p.align || 'left'; g.textBaseline = 'bottom'; g.fillText(p.label, this.sx(p.x) + (p.align === 'right' ? -7 : 7), this.sy(p.y) - 4); }
      }
      g.restore();
      // legend
      const leg = series.filter(s => s.label);
      if (leg.length) {
        g.textAlign = 'left'; g.textBaseline = 'middle';
        let x = m.l + 8, y = m.t + 10;
        for (const s of leg) {
          const w = g.measureText(s.label).width + 26;
          if (x + w > m.l + this.f.pw) { x = m.l + 8; y += 15; }
          g.fillStyle = cssVar('--surface'); g.globalAlpha = 0.8; g.fillRect(x - 3, y - 7, w, 14); g.globalAlpha = 1;
          g.strokeStyle = resolveColor(s.color); g.lineWidth = 2.5; g.setLineDash(s.dash || []);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y); g.stroke(); g.setLineDash([]);
          g.fillStyle = cssVar('--text'); g.fillText(s.label, x + 20, y);
          x += w + 6;
        }
      }
    }
    ticks(a, b, log, n) {
      const out = [];
      if (log) {
        for (let e = Math.ceil(Math.log10(a) - 1e-9); e <= Math.floor(Math.log10(b) + 1e-9); e++) out.push(Math.pow(10, e));
        if (out.length > 9) return out.filter((_, i) => i % 2 === 0);
        return out;
      }
      const st = niceStep(b - a, n);
      for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
      return out;
    }
  }
  PCB.Plot = Plot;

  /* ---------------------------------------------------------- color maps */
  const HEAT = [[0, [16, 58, 42]], [0.2, [120, 70, 30]], [0.45, [215, 120, 40]], [0.7, [255, 190, 70]], [1, [255, 248, 215]]];
  function heat(t) {
    t = PCB.clamp(t, 0, 1);
    for (let i = 1; i < HEAT.length; i++) {
      if (t <= HEAT[i][0]) {
        const [a, ca] = HEAT[i - 1], [b, cb] = HEAT[i];
        const u = (t - a) / (b - a);
        return [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u];
      }
    }
    return HEAT[HEAT.length - 1][1];
  }
  PCB.heat = heat;
  function tempColor(dT) { // 0..60 °C → blue-ish copper → red
    const t = PCB.clamp(dT / 50, 0, 1);
    const stops = [[0, [224, 166, 74]], [0.35, [245, 190, 60]], [0.65, [245, 120, 40]], [1, [230, 40, 30]]];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const u = (t - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * u)).join(',')})`;
    }
    return 'rgb(230,40,30)';
  }
  PCB.tempColor = tempColor;

  /* --------------------------------------------------------------- physics */
  const phys = {
    mu0: 4e-7 * Math.PI,
    eps0: 8.854e-12,
    c: 2.998e8,
    /** copper resistivity [Ω·m] at T [°C] */
    rhoCu(T = 25) { return 1.72e-8 * (1 + 0.0039 * (T - 25)); },
    /** copper foil thickness in mm for a given weight in oz/ft² */
    tOz(oz) { return 0.0347 * oz; },
    /** DC resistance [Ω] of a trace, lengths in mm */
    traceR(len, w, t, T = 25) { return phys.rhoCu(T) * (len / 1e3) / ((w / 1e3) * (t / 1e3)); },
    /** IPC-2221 temperature rise [°C] for current I [A], width/thickness in mm */
    ipcDeltaT(I, w, t, external = true) {
      const A = (w / 0.0254) * (t / 0.0254); // mil²
      const k = external ? 0.048 : 0.024;
      return Math.pow(I / (k * Math.pow(A, 0.725)), 1 / 0.44);
    },
    /** partial self-inductance [nH] of a flat conductor, all mm (formula in ROHM TWHB-03e §1.6) */
    partialL(l, w, t) { const s = w + t; return 0.2 * l * (Math.log(2 * l / s) + 0.2235 * s / l + 0.5); },
    /** partial mutual inductance [nH] of two parallel filaments length l, spacing d (mm) */
    mutualL(l, d) { return 0.2 * l * (Math.log(l / d + Math.sqrt(1 + (l * l) / (d * d))) - Math.sqrt(1 + (d * d) / (l * l)) + d / l); },
    /** microstrip (Hammerstad) — w, h, t in mm. Returns z0 [Ω], eeff, L' [nH/mm], C' [pF/mm], tpd [ps/mm] */
    microstrip(w, h, er = 4.2, t = 0.035) {
      const we = w + (t / Math.PI) * (1 + Math.log(w / h > 1 / (2 * Math.PI) ? 2 * h / t : 4 * Math.PI * w / t));
      const u = we / h;
      const eeff = (er + 1) / 2 + (er - 1) / 2 * (1 / Math.sqrt(1 + 12 / u) + (u < 1 ? 0.04 * (1 - u) * (1 - u) : 0));
      const z0 = u <= 1 ? 60 / Math.sqrt(eeff) * Math.log(8 / u + u / 4) : 120 * Math.PI / (Math.sqrt(eeff) * (u + 1.393 + 0.667 * Math.log(u + 1.444)));
      const tpd = Math.sqrt(eeff) / phys.c; // s/m
      return { z0, eeff, Lp: z0 * tpd * 1e6, Cp: tpd / z0 * 1e9, tpd: tpd * 1e9 };
    },
    /** symmetric stripline (IPC-2141A) — w, t in mm, b = plane-to-plane spacing in mm */
    stripline(w, b, er = 4.2, t = 0.035) {
      const z0 = 60 / Math.sqrt(er) * Math.log(1.9 * b / (0.8 * w + t));
      const tpd = Math.sqrt(er) / phys.c;
      return { z0, eeff: er, Lp: z0 * tpd * 1e6, Cp: tpd / z0 * 1e9, tpd: tpd * 1e9 };
    },
    /** edge-coupled differential microstrip (IPC-2141 approximation); s = edge gap, mm */
    diffMicrostrip(w, s, h, er = 4.2, t = 0.035) { const m = phys.microstrip(w, h, er, t); return Object.assign({}, m, { zdiff: 2 * m.z0 * (1 - 0.48 * Math.exp(-0.96 * s / h)) }); },
    /** edge-coupled differential stripline (IPC-2141 approximation); b = plane spacing */
    diffStripline(w, s, b, er = 4.2, t = 0.035) { const m = phys.stripline(w, b, er, t); return Object.assign({}, m, { zdiff: 2 * m.z0 * (1 - 0.347 * Math.exp(-2.9 * s / b)) }); },
    /** find width [mm] giving target impedance with fn(w) → z (monotonic decreasing in w) */
    solveWidth(fn, target, lo = 0.03, hi = 5) {
      for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (fn(m) > target) lo = m; else hi = m; }
      return Math.sqrt(lo * hi);
    },
    /** via pad capacitance [F] (Johnson & Graham): T = plane-crossing length, D1 pad, D2 antipad, mm */
    viaC(T, D1, D2, er = 4.2) { return 1.41 * er * (T / 25.4) * D1 / Math.max(D2 - D1, 0.01) * 1e-12; },
    /** via barrel inductance [nH] (Johnson & Graham): h length, d drill, mm */
    viaL(h, d) { const hi = h / 25.4, di = d / 25.4; return 5.08 * hi * (Math.log(4 * hi / di) + 1); },
    /** dielectric loss [dB/inch] (Bogatin rule of thumb) */
    lossDiel(fGHz, Df, eeff) { return 2.3 * fGHz * Df * Math.sqrt(eeff); },
    /** conductor (skin-effect) loss [dB/inch], w in mm */
    lossCond(fGHz, w, z0) { return 36 / ((w / 0.0254) * z0) * Math.sqrt(fGHz); },
    /** via-pair (or via-to-via spreading) loop inductance [nH] — Sierra guide eq. PI-15; mm */
    viaLoopL(h, D, d) { return 0.4 * h * (Math.log(2 * D / d) + 0.25); },
    /** parallel-plate capacitance [F]; area mm², gap mm */
    plateC(area, h, er = 4.2) { return phys.eps0 * er * (area * 1e-6) / (h * 1e-3); },
    /** small-loop differential-mode radiation (Ott): E [V/m] at r [m]; f Hz, A m², I A */
    ottE(f, A, I, r = 3) { return 1.316e-14 * f * f * A * I / r; },
    dBuV(v) { return 20 * Math.log10(Math.max(v, 1e-12) / 1e-6); },
    /** FCC Part 15 Class B radiated limit at 3 m [dBµV/m] */
    fccB(f) { if (f < 30e6) return null; if (f <= 88e6) return 40; if (f <= 216e6) return 43.5; if (f <= 960e6) return 46; return 54; },
    /** peak reflection from a series inductance L [H] hit by a ramp edge tr [s] on Z0.
        τ = L/2Z0; small L → L/(2·Z0·tr), large L → approaches 1 (total reflection). */
    rhoSeriesL(L, z0, tr) { const tau = L / (2 * z0); if (tau <= 0) return 0; return (tau / tr) * (1 - Math.exp(-tr / tau)); },
  };
  PCB.phys = phys;

  /* ---------------------------------------------- 2-D conduction (Laplace) solver
     Solves ∇·(σ∇φ) = −s on a grid (cell size 1), Neumann (insulating) boundary.
     cond: Float32Array (0 = no copper), src: injected current per cell,
     fixed: Uint8Array (1 = Dirichlet), fixedVal: values for fixed cells.        */
  function solveField(o) {
    const { nx, ny, cond, src, fixed, fixedVal } = o;
    const N = nx * ny;
    const phi = o.phi0 && o.phi0.length === N ? o.phi0 : new Float64Array(N);
    const gE = new Float64Array(N), gS = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, a = cond[k];
      if (i < nx - 1) { const b = cond[k + 1]; gE[k] = a > 0 && b > 0 ? 2 * a * b / (a + b) : 0; }
      if (j < ny - 1) { const b = cond[k + nx]; gS[k] = a > 0 && b > 0 ? 2 * a * b / (a + b) : 0; }
    }
    const w = o.omega || 2 / (1 + Math.sin(Math.PI / Math.max(nx, ny)));
    const iters = o.iters || 800;
    for (let it = 0; it < iters; it++) {
      for (let color = 0; color < 2; color++) {
        for (let j = 0; j < ny; j++) {
          for (let i = (j + color) & 1; i < nx; i += 2) {
            const k = j * nx + i;
            if (cond[k] <= 0) continue;
            if (fixed && fixed[k]) { phi[k] = fixedVal[k]; continue; }
            let sum = 0, gs = 0, g;
            if (i < nx - 1 && (g = gE[k])) { sum += g * phi[k + 1]; gs += g; }
            if (i > 0 && (g = gE[k - 1])) { sum += g * phi[k - 1]; gs += g; }
            if (j < ny - 1 && (g = gS[k])) { sum += g * phi[k + nx]; gs += g; }
            if (j > 0 && (g = gS[k - nx])) { sum += g * phi[k - nx]; gs += g; }
            if (!gs) continue;
            const nv = (sum + (src ? src[k] : 0)) / gs;
            phi[k] += w * (nv - phi[k]);
          }
        }
      }
    }
    // current density (per unit cell width) J = −σ∇φ
    const jx = new Float32Array(N), jy = new Float32Array(N), jm = new Float32Array(N);
    let jmax = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (cond[k] <= 0) continue;
      const e = i < nx - 1 && gE[k] ? phi[k + 1] - phi[k] : 0;
      const wv = i > 0 && gE[k - 1] ? phi[k] - phi[k - 1] : 0;
      const s = j < ny - 1 && gS[k] ? phi[k + nx] - phi[k] : 0;
      const n = j > 0 && gS[k - nx] ? phi[k] - phi[k - nx] : 0;
      const nxs = (i < nx - 1 && gE[k] ? 1 : 0) + (i > 0 && gE[k - 1] ? 1 : 0);
      const nys = (j < ny - 1 && gS[k] ? 1 : 0) + (j > 0 && gS[k - nx] ? 1 : 0);
      const gx = nxs ? (e + wv) / nxs : 0, gy = nys ? (s + n) / nys : 0;
      jx[k] = -cond[k] * gx; jy[k] = -cond[k] * gy;
      const mm = Math.hypot(jx[k], jy[k]); jm[k] = mm; if (mm > jmax) jmax = mm;
    }
    return { phi, jx, jy, jm, jmax };
  }
  PCB.solveField = solveField;

  /* ------------------------------------------- transmission-line network simulator
     Lumped LC ladder, leapfrog in time. Nodes have capacitance C to ground, optional
     conductance G and constant current injection J (for Thevenin terminations).
     Edges are inductances between nodes. One node may be driven by a Thevenin source.
     Build lines with PCB.TLine; run with PCB.simNet.                                    */
  class TLine {
    constructor(tau) { this.tau = tau; this.C = [1e-18]; this.G = [0]; this.J = [0]; this.edges = []; this.x = [0]; }
    node(C = 1e-18, x = 0) { this.C.push(C); this.G.push(0); this.J.push(0); this.x.push(x); return this.C.length - 1; }
    /** append a line of impedance z and delay td [s] starting at node `from`; returns end node */
    line(from, z, td, x0 = 0, len = 0) {
      const n = Math.max(1, Math.round(td / this.tau)), tc = td / n, Lc = z * tc, Cc = tc / z;
      let a = from;
      for (let i = 0; i < n; i++) {
        this.C[a] += Cc / 2;
        const b = this.node(Cc / 2, x0 + len * (i + 1) / n);
        this.edges.push({ a, b, L: Lc });
        a = b;
      }
      return a;
    }
  }
  function simNet(net, { src = 0, Rs = 50, vs, T, nOut = 600, probes = [], snapshots = 0, snapNodes = null }) {
    const N = net.C.length, E = net.edges.length;
    const V = new Float64Array(N), I = new Float64Array(E), acc = new Float64Array(N);
    const ea = new Int32Array(E), eb = new Int32Array(E), eL = new Float64Array(E);
    let minTau = Infinity;
    net.edges.forEach((e, i) => { ea[i] = e.a; eb[i] = e.b; eL[i] = e.L; });
    for (let i = 0; i < E; i++) minTau = Math.min(minTau, Math.sqrt(eL[i] * Math.min(net.C[ea[i]], net.C[eb[i]]) * 2));
    const dt = Math.min(net.tau, minTau) * 0.45;
    const steps = Math.ceil(T / dt);
    const t = new Float64Array(nOut + 1), out = probes.map(() => new Float64Array(nOut + 1));
    const snaps = [];
    let k = 0;
    const gs = 1 / Math.max(Rs, 1e-3);
    for (let s = 0; s <= steps; s++) {
      const tt = s * dt;
      for (let i = 0; i < E; i++) I[i] += dt / eL[i] * (V[ea[i]] - V[eb[i]]);
      acc.fill(0);
      for (let i = 0; i < E; i++) { acc[ea[i]] -= I[i]; acc[eb[i]] += I[i]; }
      const v0 = vs(tt + dt);
      for (let n = 0; n < N; n++) {
        let g = net.G[n], inj = acc[n] + net.J[n];
        if (n === src) { g += gs; inj += v0 * gs; }
        V[n] = (V[n] + dt / net.C[n] * inj) / (1 + dt * g / net.C[n]);
      }
      while (k <= nOut && tt >= T * k / nOut) {
        t[k] = T * k / nOut;
        probes.forEach((p, j) => (out[j][k] = V[p]));
        if (snapshots && k % Math.max(1, Math.round(nOut / snapshots)) === 0) snaps.push({ t: tt, v: Float64Array.from(snapNodes || [], n => V[n]) });
        k++;
      }
    }
    return { t, out, snaps, dt };
  }
  PCB.TLine = TLine; PCB.simNet = simNet;
  /** smooth 0→1 ramp of duration tr starting at t0 */
  PCB.ramp = (t, t0, tr) => (t <= t0 ? 0 : t >= t0 + tr ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * (t - t0) / tr));

  /* ---------------------------------------------------------- geometry */
  const geo = {
    dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    /** distance from point p to segment ab, plus param t */
    segDist(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const x = a.x + t * dx, y = a.y + t * dy;
      return { d: Math.hypot(p.x - x, p.y - y), t, x, y };
    },
    polyDist(p, pts) {
      let best = { d: Infinity };
      for (let i = 0; i < pts.length - 1; i++) { const r = geo.segDist(p, pts[i], pts[i + 1]); if (r.d < best.d) { best = r; best.i = i; } }
      return best;
    },
    polyLen(pts) { let s = 0; for (let i = 0; i < pts.length - 1; i++) s += geo.dist(pts[i], pts[i + 1]); return s; },
    /** signed shoelace area */
    area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return s / 2; },
    /** intersection of segments p1p2 and p3p4 → {x,y,t,u} or null */
    segX(p1, p2, p3, p4) {
      const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
      if (Math.abs(d) < 1e-12) return null;
      const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
      const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
      if (t < 0 || t > 1 || u < 0 || u > 1) return null;
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y), t, u };
    },
    /** point at arc-length s along polyline */
    along(pts, s) {
      for (let i = 0; i < pts.length - 1; i++) {
        const L = geo.dist(pts[i], pts[i + 1]);
        if (s <= L || i === pts.length - 2) {
          const t = L ? Math.min(1, s / L) : 0;
          return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t, dx: (pts[i + 1].x - pts[i].x) / (L || 1), dy: (pts[i + 1].y - pts[i].y) / (L || 1) };
        }
        s -= L;
      }
      return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, dx: 1, dy: 0 };
    },
    pathD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' '); },
  };
  PCB.geo = geo;

  /* ------------------------------------------------------- animation loop */
  const anims = new Set();
  let running = false;
  function tick(ts) {
    for (const f of anims) f(ts);
    if (anims.size) requestAnimationFrame(tick); else running = false;
  }
  PCB.animate = f => { anims.add(f); if (!running) { running = true; requestAnimationFrame(tick); } return () => anims.delete(f); };
  /** run fn when element is visible, pause otherwise */
  PCB.whenVisible = (node, fn) => {
    let stop = null;
    const start = () => { if (!stop) stop = PCB.animate(fn); };
    const halt = () => { if (stop) { stop(); stop = null; } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : halt()))).observe(node);
    } else start();
  };
  PCB.reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
})();
