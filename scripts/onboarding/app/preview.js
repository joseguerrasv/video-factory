import { mix, readableOn, normalizeHex } from './colors.js';

const loadedFonts = new Set();

export function ensureFont(family, customFonts = []) {
  if (!family || loadedFonts.has(family)) return;
  const custom = customFonts.find((f) => f.family === family);
  if (custom) {
    new FontFace(family, `url(${custom.url})`).load().then((face) => document.fonts.add(face)).catch(() => {});
  } else {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
    document.head.append(link);
  }
  loadedFonts.add(family);
}

const initials = (name) => (name || 'Your brand').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const SAMPLE = 'This is how your captions will look on every video';

const TEMPLATE = `
  <div class="pv-head">
    <span class="pv-label">Live preview</span>
    <span class="pv-meta" data-pv="meta"></span>
  </div>
  <div class="frame frame--wide" data-pv="wide">
    <div class="f-glow"></div>
    <div class="f-logo" data-pv="logo"></div>
    <div class="f-copy">
      <p class="f-kicker" data-pv="kicker"></p>
      <p class="f-title" data-pv="title"></p>
      <p class="f-tagline" data-pv="tagline"></p>
    </div>
    <div class="f-lower" data-pv="lower">
      <span class="f-lower-bar"></span>
      <span class="f-lower-text"><b data-pv="host"></b><small data-pv="role"></small></span>
    </div>
    <div class="f-caption" data-pv="caption"></div>
  </div>
  <div class="pv-row">
    <div class="frame frame--tall" data-pv="tall">
      <div class="f-glow"></div>
      <div class="f-logo f-logo--sm" data-pv="logo2"></div>
      <div class="f-caption f-caption--tall" data-pv="caption2"></div>
      <p class="f-handle" data-pv="handle"></p>
    </div>
    <div class="pv-tokens">
      <ul class="pv-swatches" data-pv="swatches"></ul>
      <div class="pv-type">
        <p data-pv="headingFont"></p>
        <p data-pv="bodyFont"></p>
      </div>
    </div>
  </div>
`;

export function createPreview(root) {
  root.innerHTML = TEMPLATE;
  const $ = (key) => root.querySelector(`[data-pv="${key}"]`);
  let words = SAMPLE.split(' ');
  let tick = 0;
  let style = 'pop';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  function renderCaption(el, tall) {
    if (style === 'none') { el.hidden = true; return; }
    el.hidden = false;
    el.dataset.style = style;
    const active = reduce.matches ? 1 : tick % words.length;
    if (style === 'pop') {
      const size = tall ? 2 : 3;
      const start = Math.floor(active / size) * size;
      el.innerHTML = words.slice(start, start + size)
        .map((w, i) => `<span class="${start + i === active ? 'is-on' : ''}">${escape(w)}</span>`).join(' ');
    } else if (style === 'karaoke') {
      const start = Math.max(0, Math.min(active - 2, words.length - 6));
      el.innerHTML = words.slice(start, start + 6)
        .map((w, i) => `<span class="${start + i <= active ? 'is-on' : ''}">${escape(w)}</span>`).join(' ');
    } else if (style === 'cinematic') {
      el.innerHTML = `<span>${escape(words[active])}</span>`;
    } else {
      const start = Math.floor(active / 7) * 7;
      el.textContent = words.slice(start, start + 7).join(' ');
    }
  }

  setInterval(() => {
    if (reduce.matches || document.hidden) return;
    tick += 1;
    renderCaption($('caption'), false);
    renderCaption($('caption2'), true);
  }, 420);

  return function update(answers, { logoUrl, customFonts }) {
    const v = answers.visual ?? {};
    const colors = v.colors ?? {};
    const bg = normalizeHex(colors.background) ?? '#0E0F12';
    const text = normalizeHex(colors.text) ?? readableOn(bg);
    const primary = normalizeHex(colors.primary) ?? '#3B82F6';
    const accent = normalizeHex(colors.accent) ?? primary;
    const heading = v.fonts?.heading || 'Geist';
    const body = v.fonts?.body || heading;
    ensureFont(heading, customFonts);
    ensureFont(body, customFonts);

    const vars = {
      '--pv-bg': bg,
      '--pv-surface': mix(bg, text, 0.08),
      '--pv-text': text,
      '--pv-muted': mix(text, bg, 0.38),
      '--pv-primary': primary,
      '--pv-accent': accent,
      '--pv-on-accent': readableOn(accent),
      '--pv-heading': `'${heading}', system-ui, sans-serif`,
      '--pv-body': `'${body}', system-ui, sans-serif`,
    };
    for (const frame of [$('wide'), $('tall')]) {
      for (const [k, val] of Object.entries(vars)) frame.style.setProperty(k, val);
    }

    const name = answers.identity?.name?.trim() || 'Your brand';
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="">`
      : `<span class="f-mark">${escape(initials(name))}</span>`;
    $('logo').innerHTML = logoHtml;
    $('logo2').innerHTML = logoHtml;
    $('kicker').textContent = (answers.voice?.adjectives ?? []).slice(0, 2).join(' and ') || 'Episode 01';
    $('title').textContent = name;
    $('tagline').textContent = answers.identity?.tagline?.trim() || 'Your one-line promise lives here';
    const host = answers.identity?.host ?? {};
    $('host').textContent = host.name?.trim() || 'Your name';
    $('role').textContent = host.title?.trim() || 'Your title';
    const handles = answers.identity?.handles ?? {};
    const handle = Object.values(handles).find((h) => h?.trim());
    $('handle').textContent = handle ? `@${handle.replace(/^@/, '')}` : `@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

    style = answers.editing?.captions?.style ?? 'pop';
    const position = answers.editing?.captions?.position ?? 'bottom';
    $('caption').dataset.position = position;
    const tagline = answers.identity?.tagline?.trim();
    words = (tagline && tagline.split(' ').length >= 5 ? tagline : SAMPLE).split(/\s+/);
    renderCaption($('caption'), false);
    renderCaption($('caption2'), true);
    $('lower').hidden = style === 'cinematic' && position === 'center';

    $('swatches').innerHTML = [['Background', bg], ['Text', text], ['Primary', primary], ['Accent', accent]]
      .map(([label, hex]) => `<li><span style="background:${hex}"></span><small>${label}</small><code>${hex}</code></li>`).join('');
    $('headingFont').innerHTML = `<span style="font-family:var(--pv-heading-font)">Aa</span> ${escape(heading)}`;
    $('headingFont').style.setProperty('--pv-heading-font', vars['--pv-heading']);
    $('bodyFont').innerHTML = `<span style="font-family:var(--pv-body-font)">Aa</span> ${escape(body)}`;
    $('bodyFont').style.setProperty('--pv-body-font', vars['--pv-body']);
    const formats = answers.formats?.selected?.length ?? 0;
    $('meta').textContent = `${formats || 'No'} format${formats === 1 ? '' : 's'}`;
  };
}

export function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
