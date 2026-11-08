import { STEPS, DEFAULTS, FONTS, SERVICE_KEYS, PROVIDER_KEYS, FORMAT_LABELS } from './steps.js';
import { createPreview, escape } from './preview.js';
import { extractPalette, normalizeHex, contrast, isHex } from './colors.js';

const token = new URLSearchParams(location.search).get('t') ?? '';
const $ = (sel, el = document) => el.querySelector(sel);

const state = {
  step: 0,
  answers: structuredClone(DEFAULTS),
  secrets: {},
  env: {},
  brands: [],
  target: 'new',
  slugTouched: false,
  suggestions: [],
  activeColor: 'primary',
  saveStatus: 'idle',
  submitting: false,
  done: null,
};

// ---------- utils ----------
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function set(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}
function merge(base, extra) {
  if (Array.isArray(extra) || typeof extra !== 'object' || extra === null) return extra ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) && typeof base?.[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}
const slugify = (s) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const icon = (name, cls = '') => `<i class="ph ph-${name} ${cls}" aria-hidden="true"></i>`;

// ---------- api ----------
async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'x-onboard-token': token, ...(body && !(body instanceof Blob) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const saveDraft = debounce(async () => {
  if (state.done) return;
  setSave('saving');
  const payload = { target: state.target, step: state.step, slugTouched: state.slugTouched, answers: state.answers };
  try { localStorage.setItem('vf-onboarding', JSON.stringify(payload)); } catch {}
  try {
    await api('/api/draft', { method: 'PUT', body: payload });
    setSave('saved');
  } catch {
    setSave('offline');
  }
}, 500);

function setSave(status) {
  state.saveStatus = status;
  const el = $('#save-status');
  if (!el) return;
  el.dataset.status = status;
  el.textContent = { idle: 'Autosave on', saving: 'Saving', saved: 'All changes saved', offline: 'Saved in this tab only' }[status];
}

function commit(path, value, { rerender = false } = {}) {
  set(state.answers, path, value);
  if (path === 'identity.name' && !state.slugTouched) {
    set(state.answers, 'identity.slug', slugify(value));
    const slugInput = $('[data-bind="identity.slug"]');
    if (slugInput) slugInput.value = get(state.answers, 'identity.slug') ?? '';
  }
  saveDraft();
  updatePreview();
  if (rerender) renderStep({ keepFocus: true });
  else refreshConditional();
}

// ---------- field renderers ----------
const fieldId = (id) => `f-${id.replace(/\./g, '-')}`;

function labelHtml(field, forId = fieldId(field.id)) {
  return `<label class="label" for="${forId}">${escape(field.label)}${field.required ? ' <span class="req">Required</span>' : ''}</label>`;
}
const helpHtml = (field) => (field.help ? `<p class="help" id="${fieldId(field.id)}-help">${escape(field.help)}</p>` : '');

const RENDER = {
  text(field, value) {
    return `${labelHtml(field)}<input class="input" id="${fieldId(field.id)}" type="${field.type === 'url' ? 'url' : 'text'}" data-bind="${field.id}" value="${escape(value ?? '')}" placeholder="${escape(field.placeholder ?? '')}" ${field.autofocus ? 'data-autofocus' : ''} ${field.help ? `aria-describedby="${fieldId(field.id)}-help"` : ''} autocomplete="off" spellcheck="false">${helpHtml(field)}`;
  },
  url(field, value) { return RENDER.text(field, value); },
  number(field, value) {
    return `${labelHtml(field)}<div class="input-affix"><span>$</span><input class="input" id="${fieldId(field.id)}" type="number" inputmode="decimal" min="${field.min}" max="${field.max}" data-bind="${field.id}" data-number value="${escape(value ?? '')}" placeholder="${escape(field.placeholder ?? '')}"></div>${helpHtml(field)}`;
  },
  textarea(field, value) {
    return `${labelHtml(field)}<textarea class="input textarea" id="${fieldId(field.id)}" rows="3" data-bind="${field.id}" placeholder="${escape(field.placeholder ?? '')}">${escape(value ?? '')}</textarea>${helpHtml(field)}`;
  },
  slug(field, value) {
    return `${labelHtml(field)}<div class="input-affix input-affix--mono"><span>brands/</span><input class="input" id="${fieldId(field.id)}" data-bind="${field.id}" data-slug value="${escape(value ?? '')}" autocomplete="off" spellcheck="false"></div>${slugNotice(value)}${helpHtml(field)}`;
  },
  select(field, value) {
    const options = field.optionsFrom
      ? (get(state.answers, field.optionsFrom) ?? []).map((v) => ({ value: v, label: FORMAT_LABELS[v] ?? v }))
      : field.options;
    return `${labelHtml(field)}<div class="select"><select class="input" id="${fieldId(field.id)}" data-bind="${field.id}">${options.map((o) => `<option value="${escape(o.value)}" ${o.value === value ? 'selected' : ''}>${escape(o.label)}</option>`).join('')}</select>${icon('caret-down')}</div>${helpHtml(field)}`;
  },
  chips(field, value) {
    const selected = field.multi ? value ?? [] : [value];
    const role = field.multi ? 'group' : 'radiogroup';
    return `<p class="label" id="${fieldId(field.id)}">${escape(field.label)}${field.max ? ` <span class="hint-inline">Up to ${field.max}</span>` : ''}</p>
      <div class="chips" role="${role}" aria-labelledby="${fieldId(field.id)}">
        ${field.options.map((o) => `<button type="button" class="chip" data-choice="${field.id}" data-value="${escape(o.value)}" ${field.multi ? 'data-multi' : ''} ${field.max ? `data-max="${field.max}"` : ''} aria-pressed="${selected.includes(o.value)}">${escape(o.label)}${o.hint ? `<small>${escape(o.hint)}</small>` : ''}</button>`).join('')}
      </div>${helpHtml(field)}`;
  },
  cards(field, value) {
    const selected = field.multi ? value ?? [] : [value];
    return `<p class="label" id="${fieldId(field.id)}">${escape(field.label)}</p>
      <div class="cards ${field.swatches ? 'cards--swatch' : ''}" role="${field.multi ? 'group' : 'radiogroup'}" aria-labelledby="${fieldId(field.id)}">
        ${field.options.map((o) => `<button type="button" class="card" data-choice="${field.id}" data-value="${escape(o.value)}" ${field.multi ? 'data-multi' : ''} aria-pressed="${selected.includes(o.value)}">
          ${o.swatches ? `<span class="card-swatches">${o.swatches.map((c) => `<span style="background:${c}"></span>`).join('')}</span>` : ''}
          ${o.icon ? icon(o.icon, 'card-icon') : ''}
          ${field.preview === 'caption' ? `<span class="card-caption" data-style="${o.value}"><span>Your</span> <span class="is-on">words</span> <span>here</span></span>` : ''}
          <span class="card-title">${escape(o.label)}</span>
          ${o.hint ? `<span class="card-hint">${escape(o.hint)}</span>` : ''}
          <span class="card-check">${icon('check')}</span>
        </button>`).join('')}
      </div>${helpHtml(field)}`;
  },
  slider(field, value = 50) {
    return `<div class="slider-head">${labelHtml(field)}<output class="slider-out" for="${fieldId(field.id)}">${sliderWord(field, value)}</output></div>
      <input class="slider" type="range" min="0" max="100" step="1" id="${fieldId(field.id)}" data-bind="${field.id}" data-range value="${value}" style="--fill:${value}%">
      <div class="slider-ends"><span>${escape(field.left)}</span><span>${escape(field.right)}</span></div>${helpHtml(field)}`;
  },
  toggle(field, value) {
    return `<button type="button" class="toggle" role="switch" id="${fieldId(field.id)}" data-toggle="${field.id}" aria-checked="${Boolean(value)}">
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span class="toggle-text"><span class="toggle-label">${escape(field.label)}</span>${field.help ? `<small>${escape(field.help)}</small>` : ''}</span>
    </button>`;
  },
  handles(field, value = {}) {
    const names = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', linkedin: 'LinkedIn' };
    const icons = { youtube: 'youtube-logo', instagram: 'instagram-logo', tiktok: 'tiktok-logo', x: 'x-logo', linkedin: 'linkedin-logo' };
    return `<p class="label">${escape(field.label)}</p>
      <div class="handles">${field.handles.map((h) => `<label class="handle">${icon(icons[h])}<span class="sr-only">${names[h]}</span><input class="input" data-bind="${field.id}.${h}" value="${escape(value[h] ?? '')}" placeholder="${names[h]} handle" autocomplete="off" spellcheck="false"></label>`).join('')}</div>${helpHtml(field)}`;
  },
  upload(field, value = []) {
    return `<p class="label" id="${fieldId(field.id)}">${escape(field.label)}</p>
      <label class="drop" data-drop="${field.id}" data-kind="${field.kind}">
        <input type="file" class="sr-only" data-file="${field.id}" data-kind="${field.kind}" accept="${field.accept}" ${field.multiple ? 'multiple' : ''} aria-labelledby="${fieldId(field.id)}">
        ${icon('upload-simple', 'drop-icon')}
        <span class="drop-text"><b>Drop files here</b> or click to browse</span>
        <span class="drop-accept">${escape(field.accept.replaceAll('.', '').replaceAll(',', ', ').toUpperCase())}</span>
      </label>
      ${value.length ? `<ul class="files">${value.map((f, i) => `<li class="file">
        ${/^image\//.test(f.type) ? `<span class="file-thumb"><img src="${f.url}" alt=""></span>` : `<span class="file-thumb file-thumb--icon">${icon(field.kind === 'font' ? 'text-aa' : 'file')}</span>`}
        <span class="file-meta"><b>${escape(f.family ?? f.name)}</b><small>${escape(f.family ? f.name : formatBytes(f.size))}</small></span>
        <button type="button" class="icon-btn" data-remove="${field.id}" data-index="${i}" aria-label="Remove ${escape(f.name)}">${icon('x')}</button>
      </li>`).join('')}</ul>` : ''}${helpHtml(field)}`;
  },
  palette(field, value = {}) {
    const slots = [['background', 'Background'], ['text', 'Text'], ['primary', 'Primary'], ['accent', 'Accent']];
    const warnings = paletteWarnings(value);
    return `<p class="label">${escape(field.label)}</p>
      <div class="palette">${slots.map(([key, label]) => `
        <div class="color ${state.activeColor === key ? 'is-active' : ''}" data-color-slot="${key}">
          <label class="color-swatch" style="--c:${escape(value[key] ?? '#000000')}">
            <input type="color" data-color="${key}" value="${escape((value[key] ?? '#000000').toLowerCase())}" aria-label="${label} color picker">
          </label>
          <span class="color-meta"><small>${label}</small><input class="color-hex" data-hex="${key}" value="${escape(value[key] ?? '')}" maxlength="7" spellcheck="false" aria-label="${label} hex"></span>
        </div>`).join('')}
      </div>
      ${state.suggestions.length ? `<div class="suggest"><p class="help">From your logo. Click a color to use it as <b>${state.activeColor}</b>.</p><div class="suggest-row">${state.suggestions.map((c) => `<button type="button" class="suggest-chip" data-suggest="${c}" style="--c:${c}" aria-label="Use ${c}"><span></span>${c}</button>`).join('')}</div></div>` : ''}
      ${warnings.length ? `<ul class="warns">${warnings.map((w) => `<li>${icon('warning-circle')}${escape(w)}</li>`).join('')}</ul>` : ''}${helpHtml(field)}`;
  },
  font(field, value) {
    const custom = customFonts();
    const groups = FONTS.reduce((acc, f) => ((acc[f.category] ??= []).push(f.family), acc), {});
    return `${labelHtml(field)}<div class="select"><select class="input" id="${fieldId(field.id)}" data-bind="${field.id}" data-font>
      ${custom.length ? `<optgroup label="Your fonts">${custom.map((f) => `<option ${f.family === value ? 'selected' : ''}>${escape(f.family)}</option>`).join('')}</optgroup>` : ''}
      ${Object.entries(groups).map(([cat, list]) => `<optgroup label="${cat}">${list.map((f) => `<option ${f === value ? 'selected' : ''}>${escape(f)}</option>`).join('')}</optgroup>`).join('')}
    </select>${icon('caret-down')}</div>
    <p class="font-sample" style="font-family:'${escape(value)}', system-ui">The quick brown fox films a take</p>`;
  },
  references(field, value = []) {
    const rows = value.length ? value : [{ url: '', note: '' }];
    return `<p class="label">${escape(field.label)}</p>${helpHtml(field)}
      <div class="refs">${rows.map((r, i) => `<div class="ref">
        <input class="input" data-ref="${i}" data-ref-key="url" value="${escape(r.url)}" placeholder="https://youtube.com/watch?v=" aria-label="Reference ${i + 1} link" spellcheck="false">
        <input class="input" data-ref="${i}" data-ref-key="note" value="${escape(r.note)}" placeholder="What do you love about it?" aria-label="Reference ${i + 1} note">
        <button type="button" class="icon-btn" data-ref-remove="${i}" aria-label="Remove reference ${i + 1}">${icon('x')}</button>
      </div>`).join('')}</div>
      <button type="button" class="btn btn--ghost btn--sm" data-ref-add>${icon('plus')} Add another</button>`;
  },
  secrets() {
    const needed = neededKeys();
    return `<p class="label">API keys</p>
      <div class="keys">${SERVICE_KEYS.map((s) => {
        const saved = state.env[s.key];
        const typed = Boolean(state.secrets[s.key]);
        const need = needed.includes(s.key);
        const status = typed ? 'ready' : saved ? 'saved' : need ? 'needed' : 'optional';
        const statusText = { ready: 'Will be saved', saved: 'Already set', needed: 'Needed for your choices', optional: 'Optional' }[status];
        return `<div class="key" data-status="${status}">
          <div class="key-head"><b>${s.label}</b><span class="key-status">${statusText}</span></div>
          <p class="key-use">${escape(s.use)}. <span class="key-where">Get one at ${escape(s.where)}</span></p>
          <div class="key-input">
            <input class="input input--mono" type="password" data-secret="${s.key}" value="${escape(state.secrets[s.key] ?? '')}" placeholder="${saved ? 'Leave empty to keep the saved key' : 'Paste key'}" autocomplete="off" spellcheck="false" aria-label="${s.label} API key">
            <button type="button" class="icon-btn" data-reveal="${s.key}" aria-label="Show ${s.label} key">${icon('eye')}</button>
          </div>
        </div>`;
      }).join('')}</div>
      <p class="help">Keys go straight into <code>.env</code> in this folder. They are never saved in drafts, never shown to Claude and never committed.</p>`;
  },
};

function sliderWord(field, value) {
  const v = Number(value);
  if (v < 34) return field.left;
  if (v > 66) return field.right;
  return 'Balanced';
}

function slugNotice(slug) {
  if (!slug) return '';
  const existing = state.brands.find((b) => b.slug === slug);
  if (!existing) return '';
  return state.target === slug
    ? ''
    : `<p class="notice">${icon('info')} A brand called "${escape(existing.name)}" already uses this folder. Finishing will update it.</p>`;
}

function paletteWarnings(c = {}) {
  const out = [];
  if (isHex(c.background) && isHex(c.text) && contrast(c.background, c.text) < 4.5) out.push('Text and background are hard to read together. Aim for more contrast.');
  if (isHex(c.background) && isHex(c.accent) && contrast(c.background, c.accent) < 1.8) out.push('The accent almost disappears on the background.');
  return out;
}

const formatBytes = (n = 0) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const customFonts = () => (state.answers.visual?.fontFiles ?? []).filter((f) => f.family).filter((f, i, arr) => arr.findIndex((x) => x.family === f.family) === i);

function neededKeys() {
  const a = state.answers;
  const keys = new Set();
  const provider = PROVIDER_KEYS[a.services?.transcription];
  if (provider) keys.add(provider);
  const spend = a.services?.spend?.mode !== 'never';
  const wantsAi = (a.editing?.broll?.sources ?? []).includes('ai') || (a.editing?.music?.mood !== 'none' && a.editing?.music?.source === 'generated');
  if (spend && wantsAi) keys.add('KIE_API_KEY');
  if ((a.editing?.broll?.sources ?? []).includes('stock')) keys.add('PEXELS_API_KEY');
  if (a.editing?.sfx && a.editing.sfx !== 'none' && spend) keys.add('ELEVENLABS_API_KEY');
  return [...keys];
}

// ---------- layout ----------
function renderField(field) {
  if (field.row) {
    const inner = field.row.filter((f) => !f.showIf || f.showIf(state.answers));
    return `<div class="row">${inner.map(renderField).join('')}</div>`;
  }
  const value = field.type === 'secrets' ? null : get(state.answers, field.id);
  return `<div class="field field--${field.type}" data-field="${field.id}">${RENDER[field.type](field, value)}</div>`;
}

function renderRail() {
  const current = state.step;
  $('#rail-steps').innerHTML = STEPS.map((s, i) => {
    const status = i < current ? 'done' : i === current ? 'current' : 'todo';
    return `<li><button type="button" class="rail-step" data-goto="${i}" data-status="${status}" ${i > furthest ? 'disabled' : ''} ${status === 'current' ? 'aria-current="step"' : ''}>
      <span class="rail-dot">${status === 'done' ? icon('check') : i + 1}</span><span>${escape(s.nav)}</span></button></li>`;
  }).join('');
  const pct = Math.round((current / (STEPS.length - 1)) * 100);
  $('#progress').style.setProperty('--p', `${pct}%`);
  $('#progress-text').textContent = `Step ${current + 1} of ${STEPS.length}`;
  $('#progress-name').textContent = STEPS[current].nav;
}

let furthest = 0;

function renderStep({ keepFocus = false } = {}) {
  const step = STEPS[state.step];
  furthest = Math.max(furthest, state.step);
  const main = $('#step');
  const focusedBind = keepFocus ? document.activeElement?.dataset?.bind : null;
  if (step.custom === 'welcome') main.innerHTML = welcomeHtml();
  else if (step.custom === 'review') main.innerHTML = reviewHtml();
  else {
    main.innerHTML = `<header class="step-head"><h1 tabindex="-1">${escape(step.title)}</h1><p class="lead">${escape(step.lead)}</p></header>
      <div class="fields">${(step.fields ?? []).filter((f) => f.row || !f.showIf || f.showIf(state.answers)).map(renderField).join('')}</div>`;
  }
  lastSignature = conditionalSignature();
  renderRail();
  renderActions();
  if (keepFocus && focusedBind) $(`[data-bind="${focusedBind}"]`)?.focus();
  else if (!keepFocus) {
    main.classList.remove('is-entering');
    void main.offsetWidth;
    main.classList.add('is-entering');
    const target = $('[data-autofocus]', main) ?? $('h1', main);
    target?.focus({ preventScroll: true });
    $('#main-scroll').scrollTo({ top: 0 });
  }
}

const conditionalSignature = () => JSON.stringify((STEPS[state.step].fields ?? []).flatMap((f) => f.row ?? [f]).map((f) => (f.showIf ? f.showIf(state.answers) : true)));
let lastSignature = '';

function refreshConditional() {
  if (!STEPS[state.step].fields) return;
  const signature = conditionalSignature();
  if (signature !== lastSignature) renderStep({ keepFocus: true });
}

function renderActions() {
  const step = STEPS[state.step];
  const isFirst = state.step === 0;
  const isReview = step.custom === 'review';
  $('#actions').innerHTML = `
    <button type="button" class="btn btn--ghost" data-back ${isFirst ? 'hidden' : ''}>${icon('arrow-left')} Back</button>
    <span class="actions-spacer"></span>
    ${!isFirst && !isReview && step.id !== 'basics' ? '<button type="button" class="btn btn--text" data-next="skip">Skip for now</button>' : ''}
    <button type="button" class="btn btn--primary" data-next ${state.submitting ? 'disabled' : ''}>
      ${isFirst ? 'Start' : isReview ? (state.submitting ? 'Finishing' : 'Finish setup') : 'Continue'} ${isReview ? icon('check') : icon('arrow-right')}
    </button>
    <kbd class="kbd" aria-hidden="true">Enter</kbd>`;
}

function welcomeHtml() {
  const draft = state.resumable;
  const brands = state.brands.filter((b) => b.ready);
  const options = [
    { value: 'new', title: 'Set up a new brand', hint: 'Start fresh. About 8 minutes.' },
    ...(draft ? [{ value: 'resume', title: 'Continue where you left off', hint: draft.answers?.identity?.name ? `Draft for ${draft.answers.identity.name}` : 'Unfinished draft' }] : []),
    ...brands.map((b) => ({ value: `brand:${b.slug}`, title: `Update ${b.name}`, hint: `brands/${b.slug}` })),
  ];
  return `<header class="step-head step-head--welcome">
      <h1 tabindex="-1">Let's set up your editing studio.</h1>
      <p class="lead">Answer a few questions about your brand and how you like videos cut. Claude turns your answers into a brand kit and editing rules, then follows them on every video it edits for you.</p>
    </header>
    <ul class="promises">
      <li>${icon('palette')}<span><b>Brand kit</b><small>Colors, fonts, logo and a video design spec</small></span></li>
      <li>${icon('scissors')}<span><b>Editing rules</b><small>Pacing, captions, B-roll and sound defaults</small></span></li>
      <li>${icon('brain')}<span><b>Memory</b><small>Your corrections become rules it will not forget</small></span></li>
    </ul>
    ${options.length > 1 ? `<div class="field"><p class="label" id="mode-label">What would you like to do?</p><div class="cards cards--stack" role="radiogroup" aria-labelledby="mode-label">
      ${options.map((o) => `<button type="button" class="card card--row" data-mode="${escape(o.value)}" aria-pressed="${state.mode === o.value}"><span class="card-title">${escape(o.title)}</span><span class="card-hint">${escape(o.hint)}</span><span class="card-check">${icon('check')}</span></button>`).join('')}
    </div></div>` : ''}
    <p class="help">Everything autosaves. You can close this tab and come back through Claude any time.</p>`;
}

const optLabel = (id, v) => findField(id)?.options?.find((o) => o.value === v)?.label ?? v;
const optLabels = (id, list = []) => list.map((v) => optLabel(id, v)).join(', ');

const SUMMARY = [
  ['basics', 'The basics', (a) => [a.identity?.name, a.identity?.tagline, a.identity?.host?.name && `On camera: ${a.identity.host.name}`]],
  ['audience', 'Audience and voice', (a) => [a.audience?.who, optLabels('voice.adjectives', a.voice?.adjectives), `Energy ${a.voice?.energy ?? 50}/100, polish ${a.voice?.polish ?? 50}/100`, a.voice?.cta && `CTA: ${a.voice.cta}`]],
  ['formats', 'What you make', (a) => [optLabels('formats.selected', a.formats?.selected), optLabel('formats.quality', a.formats?.quality)]],
  ['look', 'Look and feel', (a) => [`${a.visual?.logos?.length ?? 0} logo file(s)`, `${a.visual?.fonts?.heading} and ${a.visual?.fonts?.body}`, optLabel('visual.vibe', a.visual?.vibe)]],
  ['editing', 'Editing style', (a) => [`Pacing ${a.editing?.pacing}/100`, `Captions: ${optLabel('editing.captions.style', a.editing?.captions?.style)}`, `B-roll: ${optLabel('editing.broll.density', a.editing?.broll?.density)}`, `Music: ${optLabel('editing.music.mood', a.editing?.music?.mood)}`]],
  ['taste', 'Your taste', (a) => [`${(a.taste?.references ?? []).filter((r) => r.url).length} reference(s)`, (a.taste?.dislikes ?? []).length ? `Never: ${a.taste.dislikes.join(', ')}` : null]],
  ['services', 'Services and keys', (a) => [`Transcription: ${optLabel('services.transcription', a.services?.transcription)}`, `${optLabel('services.spend.mode', a.services?.spend?.mode)}${a.services?.spend?.mode === 'cap' ? ` ($${a.services.spend.capUsd ?? '?'} per video)` : ''}`]],
  ['workflow', 'Workflow', (a) => [optLabel('workflow.autonomy', a.workflow?.autonomy), optLabels('workflow.deliverables', a.workflow?.deliverables)]],
];

function reviewHtml() {
  const a = state.answers;
  const issues = reviewIssues();
  return `<header class="step-head"><h1 tabindex="-1">Looks good?</h1><p class="lead">Check the summary, then finish. Claude will build your brand kit in this repo.</p></header>
    ${issues.length ? `<ul class="warns warns--block">${issues.map((w) => `<li>${icon('warning-circle')}<span>${w}</span></li>`).join('')}</ul>` : ''}
    <div class="summary">${SUMMARY.map(([id, title, pick]) => {
      const lines = pick(a).filter(Boolean);
      const index = STEPS.findIndex((s) => s.id === id);
      return `<section class="summary-item"><div class="summary-head"><h2>${title}</h2><button type="button" class="btn btn--text btn--sm" data-goto="${index}">Edit</button></div>
        ${lines.length ? `<ul>${lines.map((l) => `<li>${escape(l)}</li>`).join('')}</ul>` : '<p class="help">Skipped. Claude will use sensible defaults.</p>'}</section>`;
    }).join('')}</div>
    <p id="submit-error" class="error" role="alert" hidden></p>`;
}

function reviewIssues() {
  const a = state.answers;
  const issues = [];
  if (!a.identity?.name?.trim()) issues.push('Add a brand name on <b>The basics</b>. It is the only required answer.');
  if (!(a.visual?.logos ?? []).length) issues.push('No logo yet. Videos will use a text mark until you add one.');
  for (const key of neededKeys()) {
    if (!state.env[key] && !state.secrets[key]) {
      const label = SERVICE_KEYS.find((s) => s.key === key)?.label ?? key;
      issues.push(`${label} key is missing but your choices use it. You can add it later in <code>.env</code>.`);
    }
  }
  return issues;
}

function doneHtml(result) {
  return `<div class="done">
    <div class="done-mark"><i class="ph-bold ph-check" aria-hidden="true"></i></div>
    <h1 tabindex="-1">All done.</h1>
    <p class="lead">You can close this tab and go back to Claude.</p>
    <p class="help">Claude is now writing your brand kit into <code>brands/${escape(result.slug)}/</code>.</p>
  </div>`;
}

// ---------- preview ----------
let previewUpdate = () => {};
function updatePreview() {
  const logo = (state.answers.visual?.logos ?? []).find((l) => /^image\//.test(l.type));
  previewUpdate(state.answers, {
    logoUrl: logo?.url,
    customFonts: customFonts().map((f) => ({ family: f.family, url: f.url })),
  });
}

// ---------- navigation ----------
function validateStep() {
  const step = STEPS[state.step];
  if (step.id === 'basics' && !state.answers.identity?.name?.trim()) {
    const input = $('[data-bind="identity.name"]');
    input?.setAttribute('aria-invalid', 'true');
    input?.focus();
    showFieldError('identity.name', 'Add a name so Claude knows who this brand is.');
    return false;
  }
  if (step.id === 'basics' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.answers.identity?.slug ?? '')) {
    set(state.answers, 'identity.slug', slugify(state.answers.identity?.name));
  }
  return true;
}

function showFieldError(id, message) {
  const field = $(`[data-field="${id}"]`);
  if (!field) return;
  $('.field-error', field)?.remove();
  field.insertAdjacentHTML('beforeend', `<p class="field-error" role="alert">${escape(message)}</p>`);
}

async function next() {
  const step = STEPS[state.step];
  if (step.custom === 'welcome') return startFromWelcome();
  if (step.custom === 'review') return submit();
  if (!validateStep()) return;
  go(state.step + 1);
}

function go(index) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, index));
  saveDraft();
  renderStep();
}

async function startFromWelcome() {
  const mode = state.mode ?? 'new';
  if (mode === 'resume' && state.resumable) {
    const d = state.resumable;
    state.answers = merge(structuredClone(DEFAULTS), d.answers);
    state.target = d.target ?? 'new';
    state.slugTouched = Boolean(d.slugTouched);
    furthest = Math.max(1, d.step ?? 1);
    go(Math.max(1, d.step ?? 1));
  } else if (mode.startsWith('brand:')) {
    const slug = mode.slice(6);
    try {
      const { answers } = await api(`/api/brand?slug=${encodeURIComponent(slug)}`);
      state.answers = merge(structuredClone(DEFAULTS), answers);
      state.target = slug;
      state.slugTouched = true;
      furthest = STEPS.length - 1;
      go(1);
    } catch (err) {
      toast(err.message);
    }
  } else {
    state.answers = structuredClone(DEFAULTS);
    state.target = 'new';
    state.slugTouched = false;
    go(1);
  }
  updatePreview();
}

async function submit() {
  if (!state.answers.identity?.name?.trim()) { go(STEPS.findIndex((s) => s.id === 'basics')); return; }
  state.submitting = true;
  renderActions();
  const errorEl = $('#submit-error');
  try {
    const result = await api('/api/submit', { method: 'POST', body: { target: state.target, answers: state.answers, secrets: state.secrets } });
    state.done = result;
    state.secrets = {};
    try { localStorage.removeItem('vf-onboarding'); } catch {}
    document.body.classList.add('is-done');
    $('#done').innerHTML = doneHtml(result);
    $('#done').hidden = false;
    $('#done h1').focus();
  } catch (err) {
    state.submitting = false;
    renderActions();
    if (errorEl) { errorEl.hidden = false; errorEl.textContent = `Could not finish: ${err.message}. Is Claude's onboarding server still running?`; }
  }
}

// ---------- uploads ----------
async function uploadFiles(fieldIdValue, kind, files) {
  const field = STEPS.flatMap((s) => s.fields ?? []).flatMap((f) => f.row ?? [f]).find((f) => f.id === fieldIdValue);
  const list = [...(get(state.answers, fieldIdValue) ?? [])];
  for (const file of files) {
    if (file.size > 60e6) { toast(`${file.name} is larger than 60 MB`); continue; }
    try {
      const meta = await api(`/api/upload?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(file.name)}`, {
        method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' },
      });
      if (kind === 'font') meta.family = fontFamilyFromFile(file.name);
      list.push(meta);
      if (!field?.multiple) break;
    } catch (err) {
      toast(`Upload failed for ${file.name}: ${err.message}`);
    }
  }
  set(state.answers, fieldIdValue, list);
  if (kind === 'logo') await suggestFromLogo();
  saveDraft();
  updatePreview();
  renderStep({ keepFocus: true });
}

function fontFamilyFromFile(name) {
  return name.replace(/\.[^.]+$/, '')
    .replace(/[-_ ]?(thin|extralight|ultralight|light|regular|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|variable|vf|wght)+$/gi, '')
    .replace(/[-_]+/g, ' ').trim() || 'Brand Font';
}

async function suggestFromLogo() {
  const logos = (state.answers.visual?.logos ?? []).filter((l) => /^image\//.test(l.type));
  const found = [];
  for (const logo of logos) {
    try { found.push(...(await extractPalette(logo.url))); } catch {}
  }
  state.suggestions = [...new Set(found)].slice(0, 8);
}

// ---------- events ----------
function bindEvents() {
  const root = document.body;

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      let value = t.value;
      if (t.dataset.range !== undefined) { value = Number(value); t.style.setProperty('--fill', `${value}%`); const out = t.parentElement.querySelector('.slider-out'); const field = findField(t.dataset.bind); if (out && field) out.textContent = sliderWord(field, value); }
      if (t.dataset.number !== undefined) value = value === '' ? null : Number(value);
      if (t.dataset.slug !== undefined) { state.slugTouched = true; value = slugify(value); }
      if (t.dataset.bind === 'identity.name') { t.removeAttribute('aria-invalid'); $('.field-error', t.closest('.field'))?.remove(); }
      commit(t.dataset.bind, value);
      if (t.dataset.font !== undefined) { const sample = t.closest('.field').querySelector('.font-sample'); if (sample) sample.style.fontFamily = `'${value}', system-ui`; }
    } else if (t.dataset.ref !== undefined) {
      const refs = structuredClone(state.answers.taste?.references ?? [{ url: '', note: '' }]);
      refs[Number(t.dataset.ref)] ??= { url: '', note: '' };
      refs[Number(t.dataset.ref)][t.dataset.refKey] = t.value;
      commit('taste.references', refs);
    } else if (t.dataset.secret) {
      state.secrets[t.dataset.secret] = t.value.trim();
      const card = t.closest('.key');
      const status = t.value.trim() ? 'ready' : state.env[t.dataset.secret] ? 'saved' : neededKeys().includes(t.dataset.secret) ? 'needed' : 'optional';
      card.dataset.status = status;
      card.querySelector('.key-status').textContent = { ready: 'Will be saved', saved: 'Already set', needed: 'Needed for your choices', optional: 'Optional' }[status];
    } else if (t.dataset.color) {
      setColor(t.dataset.color, t.value, { rerender: false });
    } else if (t.dataset.hex) {
      const hex = normalizeHex(t.value);
      if (hex) setColor(t.dataset.hex, hex, { rerender: false, fromHex: true });
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.file) uploadFiles(t.dataset.file, t.dataset.kind, [...t.files]);
    if (t.dataset.color || t.dataset.hex) renderStep({ keepFocus: true });
    if (t.tagName === 'SELECT' && t.dataset.bind) refreshConditional();
  });

  root.addEventListener('focusin', (e) => {
    const slot = e.target.closest('[data-color-slot]');
    if (slot && state.activeColor !== slot.dataset.colorSlot) {
      state.activeColor = slot.dataset.colorSlot;
      document.querySelectorAll('[data-color-slot]').forEach((el) => el.classList.toggle('is-active', el === slot));
      const hint = $('.suggest b');
      if (hint) hint.textContent = state.activeColor;
    }
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-color-slot]');
    if (!t) return;
    if (t.dataset.colorSlot && !t.matches('button')) {
      state.activeColor = t.dataset.colorSlot;
      document.querySelectorAll('[data-color-slot]').forEach((el) => el.classList.toggle('is-active', el === t));
      const hint = $('.suggest b');
      if (hint) hint.textContent = state.activeColor;
      return;
    }
    if (t.dataset.choice) return toggleChoice(t);
    if (t.dataset.toggle) { const v = !get(state.answers, t.dataset.toggle); t.setAttribute('aria-checked', v); return commit(t.dataset.toggle, v); }
    if (t.dataset.mode) { state.mode = t.dataset.mode; document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b === t)); return; }
    if (t.dataset.next !== undefined) return next();
    if (t.dataset.back !== undefined) return go(state.step - 1);
    if (t.dataset.goto !== undefined) return go(Number(t.dataset.goto));
    if (t.dataset.remove) { const list = [...(get(state.answers, t.dataset.remove) ?? [])]; list.splice(Number(t.dataset.index), 1); set(state.answers, t.dataset.remove, list); if (t.dataset.remove === 'visual.logos') suggestFromLogo().then(() => renderStep({ keepFocus: true })); return commit(t.dataset.remove, list, { rerender: true }); }
    if (t.dataset.refAdd !== undefined) { const refs = [...(state.answers.taste?.references ?? [])]; refs.push({ url: '', note: '' }); commit('taste.references', refs, { rerender: true }); $$last('[data-ref-key="url"]')?.focus(); return; }
    if (t.dataset.refRemove !== undefined) { const refs = [...(state.answers.taste?.references ?? [])]; refs.splice(Number(t.dataset.refRemove), 1); return commit('taste.references', refs.length ? refs : [{ url: '', note: '' }], { rerender: true }); }
    if (t.dataset.reveal) { const input = $(`[data-secret="${t.dataset.reveal}"]`); const show = input.type === 'password'; input.type = show ? 'text' : 'password'; t.innerHTML = icon(show ? 'eye-slash' : 'eye'); t.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} key`); return; }
    if (t.dataset.suggest) return setColor(state.activeColor, t.dataset.suggest, { rerender: true });
    if (t.id === 'preview-toggle') { document.body.classList.toggle('show-preview'); t.setAttribute('aria-expanded', document.body.classList.contains('show-preview')); }
  });

  for (const type of ['dragenter', 'dragover']) {
    root.addEventListener(type, (e) => { const drop = e.target.closest?.('[data-drop]'); if (drop) { e.preventDefault(); drop.classList.add('is-over'); } });
  }
  root.addEventListener('dragleave', (e) => { e.target.closest?.('[data-drop]')?.classList.remove('is-over'); });
  root.addEventListener('drop', (e) => {
    const drop = e.target.closest?.('[data-drop]');
    if (!drop) return;
    e.preventDefault();
    drop.classList.remove('is-over');
    uploadFiles(drop.dataset.drop, drop.dataset.kind, [...e.dataTransfer.files]);
  });

  document.addEventListener('keydown', (e) => {
    if (state.done) return;
    const tag = e.target.tagName;
    if (e.key === 'Enter' && !e.shiftKey && tag !== 'TEXTAREA' && tag !== 'BUTTON' && tag !== 'SELECT' && !e.isComposing) {
      e.preventDefault();
      next();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      next();
    }
  });
}

const $$last = (sel) => [...document.querySelectorAll(sel)].at(-1);
const findField = (id) => STEPS.flatMap((s) => s.fields ?? []).flatMap((f) => f.row ?? [f]).find((f) => f.id === id);

function toggleChoice(button) {
  const id = button.dataset.choice;
  const value = button.dataset.value;
  if (button.dataset.multi !== undefined) {
    const list = [...(get(state.answers, id) ?? [])];
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1);
    else {
      const max = Number(button.dataset.max);
      if (max && list.length >= max) list.shift();
      list.push(value);
    }
    commit(id, list);
    button.closest('[role]').querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('aria-pressed', list.includes(b.dataset.value)));
    if (id === 'formats.selected' && !list.includes(get(state.answers, 'formats.primary'))) set(state.answers, 'formats.primary', list[0]);
    if (id === 'formats.selected') renderStep({ keepFocus: true });
  } else {
    commit(id, value);
    button.closest('[role]').querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('aria-pressed', b === button));
  }
  if (STEPS[state.step].id === 'services') renderStep({ keepFocus: true });
  else refreshConditional();
}

function setColor(slot, hex, { rerender, fromHex } = {}) {
  const value = normalizeHex(hex);
  if (!value) return;
  set(state.answers, `visual.colors.${slot}`, value);
  const swatch = $(`[data-color-slot="${slot}"] .color-swatch`);
  swatch?.style.setProperty('--c', value);
  if (!fromHex) { const hexInput = $(`[data-hex="${slot}"]`); if (hexInput) hexInput.value = value; }
  saveDraft();
  updatePreview();
  if (rerender) renderStep({ keepFocus: true });
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

// ---------- boot ----------
async function boot() {
  previewUpdate = createPreview($('#preview'));
  bindEvents();
  try {
    const data = await api('/api/bootstrap');
    state.env = data.env ?? {};
    state.brands = data.brands ?? [];
    let draft = data.draft;
    if (!draft) { try { draft = JSON.parse(localStorage.getItem('vf-onboarding') ?? 'null'); } catch {} }
    if (draft?.answers?.identity?.name) { state.resumable = draft; state.mode = 'resume'; }
    if (data.editing) state.mode = `brand:${data.editing}`;
  } catch (err) {
    toast(token ? `Could not reach the onboarding server: ${err.message}` : 'This page needs the link Claude opened for you. Run /onboard-me in Claude again.');
  }
  state.mode ??= 'new';
  setSave('idle');
  renderStep();
  updatePreview();
}

boot();
