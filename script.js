/* ============================================================
   PHOLX — scroll-driven landing page
   Requires (loaded in index.html): GSAP, ScrollTrigger, Lenis
   Modules: CONFIG · sequence renderers · hero · reveals · stack tabs
            · counters · nav · contact form
   ============================================================ */
(() => {
  'use strict';

  /* ───────────── CONFIG ───────────── */
  const CONFIG = {
    // 'procedural' = zero-asset canvas animation (default)
    // 'images'     = your own frame sequence, see README.md
    mode: 'procedural',

    images: {
      count: 120,                  // number of frames
      start: 1,                    // first frame number
      path: (n) => `assets/frames/frame_${String(n).padStart(4, '0')}.webp`,
      concurrency: 6,
    },

    procedural: { particlesDesktop: 900, particlesMobile: 480 },
    dprCap: { desktop: 2, mobile: 1.5 },   // caps canvas resolution → stable 60fps
    smoothing: 9,                          // higher = snappier canvas follow
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const sstep = (t) => t * t * (3 - 2 * t);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => matchMedia('(max-width: 767px)').matches;

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ───────────── RENDERER: procedural ───────────── */
  function createProceduralRenderer(count) {
    const rnd = mulberry32(20261109);
    const S = [0, 1, 2, 3].map(() => new Float32Array(count * 3));
    const delay = new Float32Array(count);
    const G = Math.PI * (3 - Math.sqrt(5));
    const q = (v, s) => Math.round(v * s) / s;

    for (let i = 0; i < count; i++) {
      const k = i * 3;
      // 0 · scattered cloud
      S[0][k] = (rnd() * 2 - 1) * 2.6;
      S[0][k + 1] = (rnd() * 2 - 1) * 2.0;
      S[0][k + 2] = (rnd() * 2 - 1) * 2.6;
      // 1 · cube-surface lattice
      const face = Math.floor(rnd() * 6), ax = face >> 1, sgn = face % 2 ? 1 : -1;
      const o = [0, 1, 2].filter((x) => x !== ax);
      const c = [0, 0, 0];
      c[ax] = sgn; c[o[0]] = q(rnd() * 2 - 1, 4); c[o[1]] = q(rnd() * 2 - 1, 4);
      S[1][k] = c[0] * 0.95; S[1][k + 1] = c[1] * 0.95; S[1][k + 2] = c[2] * 0.95;
      // 2 · sphere (fibonacci)
      const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = G * i;
      S[2][k] = Math.cos(th) * r * 1.15; S[2][k + 1] = y * 1.15; S[2][k + 2] = Math.sin(th) * r * 1.15;
      // 3 · torus ring
      const u = rnd() * Math.PI * 2, v = rnd() * Math.PI * 2, R = 1.15, rr = 0.42;
      S[3][k] = (R + rr * Math.cos(v)) * Math.cos(u);
      S[3][k + 1] = rr * Math.sin(v);
      S[3][k + 2] = (R + rr * Math.cos(v)) * Math.sin(u);
      delay[i] = rnd();
    }

    // two nearest neighbours on the sphere shape → stable "network" edges
    const nb = new Uint16Array(count * 2);
    for (let i = 0; i < count; i++) {
      let b1 = -1, b2 = -1, d1 = 1e9, d2 = 1e9;
      const ax = S[2][i * 3], ay = S[2][i * 3 + 1], az = S[2][i * 3 + 2];
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const dx = ax - S[2][j * 3], dy = ay - S[2][j * 3 + 1], dz = az - S[2][j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = j; } else if (d < d2) { d2 = d; b2 = j; }
      }
      nb[i * 2] = b1; nb[i * 2 + 1] = b2;
    }

    const W = new Float32Array(count * 3);   // current world positions
    const PX = new Float32Array(count), PY = new Float32Array(count), PZ = new Float32Array(count), PS = new Float32Array(count);

    const KEYS = [0, 0.3, 0.58, 0.82];
    // horizontal offset (fraction of width) so the object sits opposite the text
    const SHIFT = [[0, 0], [0.22, 0], [0.3, 0.2], [0.5, 0.2], [0.58, -0.2], [0.76, -0.2], [0.84, 0], [1, 0]];
    const shiftAt = (p) => {
      for (let i = 1; i < SHIFT.length; i++) {
        if (p <= SHIFT[i][0]) {
          const [a, av] = SHIFT[i - 1], [b, bv] = SHIFT[i];
          return av + (bv - av) * sstep(clamp((p - a) / (b - a)));
        }
      }
      return 0;
    };

    return {
      draw(ctx, p, time, w, h, dpr) {
        ctx.clearRect(0, 0, w, h);
        const wide = w / dpr >= 900;

        let seg = p >= KEYS[2] ? 2 : p >= KEYS[1] ? 1 : 0;
        const u = clamp((p - KEYS[seg]) / (KEYS[seg + 1] - KEYS[seg]));
        const A = S[seg], B = S[seg + 1];

        for (let i = 0, k = 0; i < count; i++, k += 3) {
          const t = sstep(clamp((u - delay[i] * 0.35) / 0.65));
          const wob = Math.sin(time * 0.8 + i) * 0.012;
          W[k] = A[k] + (B[k] - A[k]) * t + wob;
          W[k + 1] = A[k + 1] + (B[k + 1] - A[k + 1]) * t + wob;
          W[k + 2] = A[k + 2] + (B[k + 2] - A[k + 2]) * t;
        }

        const ry = 0.5 + p * Math.PI * 1.7 + time * 0.06;
        const rx = 0.38 + Math.sin(p * Math.PI) * 0.2;
        const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
        const d = 4.6 - p * 1.1;
        const f = (wide ? h : w * 1.1) * 1.05;
        const ox = w / 2 + (wide ? shiftAt(p) * w : 0), oy = h / 2;

        for (let i = 0, k = 0; i < count; i++, k += 3) {
          const x = W[k], y = W[k + 1], z = W[k + 2];
          const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
          const y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
          const zc = z2 + d, sc = f / zc;
          PX[i] = ox + x1 * sc; PY[i] = oy + y1 * sc; PZ[i] = z2; PS[i] = d / zc;
        }

        // soft core glow
        const gr = Math.min(w, h) * 0.7;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, gr);
        g.addColorStop(0, `rgba(99,102,241,${0.16 + 0.1 * Math.min(1, p * 2)})`);
        g.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // network edges (only between particles that are close in world space)
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          for (let m = 0; m < 2; m++) {
            const j = nb[i * 2 + m];
            const dx = W[i * 3] - W[j * 3], dy = W[i * 3 + 1] - W[j * 3 + 1], dz = W[i * 3 + 2] - W[j * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < 0.55) { ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[j], PY[j]); }
          }
        }
        ctx.lineWidth = Math.max(1, dpr * 0.7);
        ctx.strokeStyle = `rgba(130,150,255,${0.05 + 0.15 * Math.min(1, p * 3)})`;
        ctx.stroke();

        // dots — two depth buckets, one fill each
        const base = dpr * (wide ? 1.7 : 1.4);
        ctx.fillStyle = 'rgba(139,92,246,0.55)';
        ctx.beginPath();
        for (let i = 0; i < count; i++) if (PZ[i] >= 0) { ctx.moveTo(PX[i] + base * PS[i], PY[i]); ctx.arc(PX[i], PY[i], Math.max(0.6, base * PS[i]), 0, 6.2832); }
        ctx.fill();
        ctx.fillStyle = 'rgba(205,214,255,0.95)';
        ctx.beginPath();
        for (let i = 0; i < count; i++) if (PZ[i] < 0) { ctx.moveTo(PX[i] + base * PS[i], PY[i]); ctx.arc(PX[i], PY[i], Math.max(0.6, base * PS[i]), 0, 6.2832); }
        ctx.fill();
      },
    };
  }

  /* ───────────── RENDERER: image sequence ───────────── */
  function createImageRenderer(cfg) {
    const frames = new Array(cfg.count);
    const order = [];
    const seen = new Set();
    [8, 4, 2, 1].forEach((step) => {
      for (let i = 0; i < cfg.count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    });
    let cursor = 0;
    const loadOne = () => new Promise((res) => {
      if (cursor >= order.length) return res();
      const i = order[cursor++];
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { frames[i] = im; res(loadOne()); };
      im.onerror = () => res(loadOne());
      im.src = cfg.path(i + cfg.start);
    });
    for (let c = 0; c < cfg.concurrency; c++) loadOne();

    return {
      draw(ctx, p, _t, w, h) {
        ctx.clearRect(0, 0, w, h);
        const target = Math.round(p * (cfg.count - 1));
        let im = null;
        for (let d = 0; d < cfg.count && !im; d++) im = frames[target - d] || frames[target + d] || null;
        if (!im) return;
        const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
        const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      },
    };
  }

  /* ───────────── HERO ───────────── */
  function initHero() {
    const track = $('#hero');
    const canvas = $('#seq-canvas');
    const ctx = canvas.getContext('2d');
    const beats = $$('[data-beat]', track);
    const bar = $('#seq-bar'), count = $('#seq-count'), hint = $('#seq-hint');

    const renderer = CONFIG.mode === 'images'
      ? createImageRenderer(CONFIG.images)
      : createProceduralRenderer(isMobile() ? CONFIG.procedural.particlesMobile : CONFIG.procedural.particlesDesktop);

    let w = 0, h = 0, dpr = 1, target = reduceMotion ? 0.62 : 0, cur = target, visible = true, dirty = true;

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? CONFIG.dprCap.mobile : CONFIG.dprCap.desktop);
      w = Math.round(r.width * dpr); h = Math.round(r.height * dpr);
      canvas.width = w; canvas.height = h;
      dirty = true;
    }
    resize();
    let rt;
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 120); }).observe(canvas.parentElement);

    // text beats: [start, end] of scroll progress
    const WINDOWS = [[0, 0.22], [0.27, 0.5], [0.55, 0.76], [0.82, 1.01]];
    function updateBeats(p) {
      let best = 0, bestO = -1;
      beats.forEach((el, i) => {
        const [a, b] = WINDOWS[i];
        const f = Math.min(0.06, (b - a) * 0.3);
        const inn = i === 0 ? 1 : sstep(clamp((p - a) / f));
        const out = i === beats.length - 1 ? 1 : 1 - sstep(clamp((p - (b - f)) / f));
        const o = inn * out;
        const y = (1 - inn) * 48 - (1 - out) * 48;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
        el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
        if (o > bestO) { bestO = o; best = i; }
      });
      count.textContent = `0${best + 1} / 0${beats.length}`;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
      hint.style.opacity = p > 0.03 ? 0 : 1;
    }
    updateBeats(0);

    ScrollTrigger.create({
      trigger: track, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { target = self.progress; updateBeats(target); },
    });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(track);

    gsap.ticker.add((time, deltaMs) => {
      if (!visible) return;
      const dt = Math.min(0.05, deltaMs / 1000);
      const prev = cur;
      cur = reduceMotion ? target : cur + (target - cur) * (1 - Math.exp(-dt * CONFIG.smoothing));
      if (Math.abs(target - cur) < 0.00005) cur = target;
      const moving = cur !== prev;
      // procedural mode idles with a slow drift; image mode only redraws on change
      if (moving || dirty || (CONFIG.mode === 'procedural' && !reduceMotion)) {
        renderer.draw(ctx, cur, reduceMotion ? 0 : time, w, h, dpr);
        dirty = false;
      }
    });
  }

  /* ───────────── SMOOTH SCROLL ───────────── */
  let lenis = null;
  function initScroll() {
    gsap.registerPlugin(ScrollTrigger);
    if (!reduceMotion && window.Lenis) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });   // touch stays native → no lag on mobile
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const el = id.length > 1 ? $(id) : null;
        if (id === '#top') { e.preventDefault(); lenis ? lenis.scrollTo(0) : scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (!el) return;
        e.preventDefault();
        lenis ? lenis.scrollTo(el, { offset: -10, duration: 1.4 }) : el.scrollIntoView({ behavior: 'smooth' });
        closeMenu();
      });
    });
  }

  /* ───────────── REVEALS + SPOTLIGHT ───────────── */
  function initReveals() {
    if (reduceMotion) return;
    $$('[data-reveal]').forEach((el) => {
      const sibs = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal')) : [];
      const delay = Math.min(sibs.indexOf(el), 4) * 0.08;
      gsap.from(el, {
        y: 40, opacity: 0, duration: 1, delay, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  }

  function initSpotlight() {
    $$('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ───────────── STACK TABS ───────────── */
  const DEV = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/';
  const SPECS = [
    {
      label: 'Systems & Performance',
      blurb: 'Close-to-the-metal engineering for latency-critical, resource-constrained and long-lived software.',
      use: ['Embedded & firmware', 'High-throughput services', 'Performance tuning', 'Legacy mainframe work'],
      tags: [['Assembly', 'ASM'], ['C', 'c/c-original.svg'], ['C++', 'cplusplus/cplusplus-original.svg'], ['Rust', 'rust/rust-original.svg'], ['Zig', 'zig/zig-original.svg'], ['COBOL', 'cobol/cobol-original.svg']],
    },
    {
      label: 'Backend & Enterprise',
      blurb: 'Reliable services and integrations that carry the business logic your operations depend on.',
      use: ['APIs & microservices', 'Enterprise integration', 'Platform modernization', 'Back-office systems'],
      tags: [['Java', 'java/java-original.svg'], ['C#', 'csharp/csharp-original.svg'], ['Go', 'go/go-original.svg'], ['Node.js', 'nodejs/nodejs-original.svg'], ['PHP', 'php/php-original.svg']],
    },
    {
      label: 'Data Science & Analytics',
      blurb: 'From raw tables to dashboards and models — analysis that turns into decisions.',
      use: ['Business intelligence', 'Forecasting & modelling', 'Data pipelines', 'Reporting automation'],
      tags: [['Python', 'python/python-original.svg'], ['Power BI', 'BI'], ['R', 'r/r-original.svg'], ['Excel', 'XLS'], ['Julia', 'julia/julia-original.svg']],
    },
    {
      label: 'Web & Scripting',
      blurb: 'Fast front-ends, glue code and automation that keep delivery moving.',
      use: ['Web applications', 'Tooling & automation', 'Game & plugin scripting', 'DevOps scripts'],
      tags: [['JavaScript', 'javascript/javascript-original.svg'], ['Lua', 'lua/lua-original.svg'], ['TypeScript', 'typescript/typescript-original.svg'], ['Bash', 'bash/bash-original.svg']],
    },
  ];

  function initStack() {
    const tabsEl = $('#spec-tabs'), panel = $('#spec-panel');
    const total = SPECS.reduce((n, s) => n + s.tags.length, 0);
    $('#metric-tech').dataset.count = total;

    tabsEl.innerHTML = SPECS.map((s, i) =>
      `<button class="spec-tab" role="tab" id="tab-${i}" aria-selected="${i === 0}" aria-controls="spec-panel" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">
         <span class="spec-tab__n">0${i + 1}</span><span>${s.label}</span><span class="spec-tab__c">${s.tags.length}</span>
       </button>`).join('');

    const tile = (v) => /\.svg$/.test(v)
      ? `<span class="tag__tile"><img src="${DEV}${v}" alt="" loading="lazy" width="20" height="20"></span>`
      : `<span class="tag__tile">${v}</span>`;

    function show(i, animate = true) {
      const s = SPECS[i];
      $$('.spec-tab', tabsEl).forEach((b, n) => { b.setAttribute('aria-selected', n === i); b.tabIndex = n === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', `tab-${i}`);
      panel.innerHTML =
        `<h3>${s.label}</h3><p>${s.blurb}</p>
         <ul class="spec__use">${s.use.map((u) => `<li>${u}</li>`).join('')}</ul>
         <div class="tags">${s.tags.map(([n, v]) => `<span class="tag">${tile(v)}${n}</span>`).join('')}</div>`;
      if (animate && !reduceMotion) {
        gsap.from(panel.children, { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' });
        gsap.from($$('.tag', panel), { y: 12, opacity: 0, duration: 0.45, stagger: 0.04, delay: 0.15, ease: 'power3.out' });
      }
    }

    tabsEl.addEventListener('click', (e) => { const b = e.target.closest('.spec-tab'); if (b) show(+b.dataset.i); });
    tabsEl.addEventListener('keydown', (e) => {
      const cur = $$('.spec-tab', tabsEl).findIndex((b) => b.tabIndex === 0);
      let n = cur;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (cur + 1) % SPECS.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (cur - 1 + SPECS.length) % SPECS.length;
      else return;
      e.preventDefault(); show(n); $$('.spec-tab', tabsEl)[n].focus();
    });
    show(0, false);
  }

  /* ───────────── COUNTERS ───────────── */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, suffix = el.dataset.suffix || '';
      if (reduceMotion) { el.textContent = end + suffix; return; }
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } }),
      });
    });
  }

  /* ───────────── NAV ───────────── */
  const navLinks = $('#nav-links'), navToggle = $('#nav-toggle');
  function closeMenu() { navLinks.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); }
  function initNav() {
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open);
    });
  }

  /* ───────────── CONTACT FORM (Web3Forms) ───────────── */
  function initForm() {
    const form = $('#contact-form'), status = $('#form-status');
    const say = (msg, cls) => { status.textContent = msg; status.className = 'form__status ' + (cls || ''); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = Object.fromEntries(new FormData(form));
      if (!data.access_key || data.access_key.startsWith('YOUR_')) {
        say('Add your Web3Forms access key in index.html to enable sending.', 'is-err'); return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; say('Sending…');
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) { say('Thanks — we’ll be in touch within one business day.', 'is-ok'); form.reset(); }
        else say(json.message || 'Something went wrong. Please try again.', 'is-err');
      } catch { say('Network error. Please try again or email us directly.', 'is-err'); }
      btn.disabled = false;
    });
  }

  /* ───────────── BOOT ───────────── */
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.gsap || !window.ScrollTrigger) { console.error('GSAP failed to load'); return; }
    initScroll();
    initNav();
    initStack();
    initHero();
    initReveals();
    initSpotlight();
    initCounters();
    initForm();
    window.addEventListener('load', () => ScrollTrigger.refresh());
  });
})();
