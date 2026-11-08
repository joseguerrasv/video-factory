#!/usr/bin/env node
// Installs the shared sound-effect library into sfx-library/: Kenney's CC0 packs and a curated Mixkit set.
// Safe to re-run: files already on disk are kept. Writes sfx-library/manifest.json with each file's onset, so a cue can
// land its audible hit on the frame instead of the file start.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure } from './measure.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const LIB = join(ROOT, 'sfx-library');
const UA = { 'user-agent': 'Mozilla/5.0' };

const KENNEY = ['interface-sounds', 'ui-audio', 'impact-sounds', 'rpg-audio'];
const MIXKIT = {
  whoosh: { 1489: 'air-woosh', 1490: 'fast-whoosh', 1491: 'arrow-whoosh', 166: 'small-sweep', 3005: 'light-pop-whoosh', 2608: 'air-zoom' },
  click: { 1133: 'camera-shutter', 1109: 'select-click', 1117: 'classic-click', 1113: 'mouse-click-close', 275: 'mouse-double-click', 2997: 'clear-mouse-clicks', 1120: 'click-box-check', 1124: 'plastic-bubble-click', 1110: 'click-error' },
  typing: { 2531: 'laptop-keyboard' },
  paper: { 1530: 'paper-slide', 1104: 'page-turn', 2380: 'paper-quick', 3194: 'pencil-writing', 2369: 'scribble', 2368: 'signing', 1101: 'book-paging', 1102: 'fast-paging', 2995: 'stapling-paper' },
  notify: { 2354: 'message-pop', 2357: 'bubble-pop-alert', 2356: 'dry-pop', 2358: 'long-pop', 951: 'positive-notification', 2870: 'correct-tone', 2867: 'confirmation-tone', 2573: 'option-select', 2580: 'light-button', 2575: 'interface-back', 2841: 'atm-key-press', 2866: 'digital-quick-tone' },
  pop: { 2364: 'hard-pop-click' },
  clock: { 1059: 'tick-tock-close', 1045: 'tick-tock-timer', 1061: 'clock-ticker-single', 1053: 'ticking-counter', 1054: 'electric-ticking-counter', 1064: 'watch-knob-spin', 1063: 'fast-wall-clock' },
};

async function fetchTo(url, file, headers = UA) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function installKenney(pack) {
  const dir = join(LIB, 'kenney', pack);
  if (existsSync(dir)) return;
  const id = Buffer.from(`assets/${pack}`).toString('hex');
  const res = await fetch(`https://kenney.nl/download-link/${id}`, { headers: { ...UA, referer: `https://kenney.nl/assets/${pack}` } });
  const { url } = await res.json();
  if (!url) throw new Error(`No download link for ${pack}`);
  const tmp = mkdtempSync(join(tmpdir(), 'kenney-'));
  await fetchTo(url, join(tmp, 'pack.zip'));
  execFileSync('unzip', ['-q', '-o', 'pack.zip'], { cwd: tmp });
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(join(tmp, 'Audio'))) {
    if (!f.endsWith('.ogg')) continue;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(tmp, 'Audio', f), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(dir, f.replace('.ogg', '.wav'))]);
  }
  rmSync(tmp, { recursive: true });
  console.log(`kenney/${pack}: ${readdirSync(dir).length} files`);
}

async function installMixkit() {
  for (const [group, items] of Object.entries(MIXKIT)) {
    const dir = join(LIB, 'mixkit', group);
    mkdirSync(dir, { recursive: true });
    for (const [id, name] of Object.entries(items)) {
      const out = join(dir, `${name}.wav`);
      if (existsSync(out)) continue;
      const raw = `${out}.dl`;
      const base = `https://assets.mixkit.co/active_storage/sfx/${id}/${id}`;
      await fetchTo(`${base}.wav`, raw).catch(() => fetchTo(`${base}-preview.mp3`, raw)); // some ids only serve the preview
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
      rmSync(raw);
    }
    console.log(`mixkit/${group}: ${Object.keys(items).length} files`);
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.wav') ? [join(dir, e.name)] : []));
}

for (const pack of KENNEY) await installKenney(pack);
await installMixkit();
const creditsFile = join(LIB, 'openverse/credits.json');
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : {};
const entries = walk(LIB).sort().map((f) => {
  const path = relative(LIB, f), source = path.split('/')[0];
  const license = credits[path]?.license ?? { kenney: 'CC0', mixkit: 'Mixkit Sound Effects Free License', elevenlabs: 'ElevenLabs output, paid plan' }[source] ?? 'see SFX.md';
  return { path, source, license, ...measure(f) };
});
writeFileSync(join(LIB, 'manifest.json'), JSON.stringify(entries, null, 1));
console.log(`${basename(LIB)}: ${entries.length} files`);
