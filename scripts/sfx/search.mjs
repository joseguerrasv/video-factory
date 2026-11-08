#!/usr/bin/env node
// Finds sound effects on Openverse (no key needed) and brings one into sfx-library/openverse/.
// Search: node scripts/sfx/search.mjs "paper tear" [--license cc0,by] [--max 5] [--limit 10] [--page 2]
// Fetch:  node scripts/sfx/search.mjs --get <id> --name paper-tear-1
// Effects are Freesound's 128 kbps previews, converted to the library's 48 kHz stereo WAV. A fetch records the licence
// and credit in openverse/credits.json and adds the file to manifest.json, so its onset is there for cue timing.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../lib/paths.mjs';
import { measure } from './measure.mjs';

const API = 'https://api.openverse.org/v1/audio/';
const WAIT_MS = 20000; // healthy answers take under a second; during an outage Cloudflare gives up with a 502 near 60 s
const DOWN = `Openverse did not answer. New requests have been failing since 2026-10-20 (https://github.com/WordPress/openverse/issues/5649), so use sfx-library/ for now`;

// Open licences that survive being cut, pitched and mixed into a video the user sells from. CC BY needs a credit;
// by-sa would bind the video to the same licence, by-nd forbids editing and the rest are non-commercial.
export const LICENSES = ['cc0', 'pdm', 'by'];

export function checkLicenses(list) {
  const refused = list.split(',').filter((license) => !LICENSES.includes(license));
  if (refused.length) throw new Error(`Refused licence: ${refused.join(', ')}. Use ${LICENSES.join(', ')}: anything else can't go in a commercial edit.`);
  return list;
}

// page_size 20 is the most an anonymous request may ask for. Freesound records carry no category, so category=sound_effect
// finds nothing: source=freesound is what keeps this to effects, and pickEffects filters on each one's real duration.
export function searchUrl(query, { license = 'cc0', page = 1 } = {}) {
  const params = { q: query, license, source: 'freesound', page_size: 20, ...(page > 1 ? { page } : {}) };
  return `${API}?${new URLSearchParams(params)}`;
}

export const pickEffects = (results, { max = 5, limit = 10 } = {}) => results.filter((r) => r.url && r.duration && r.duration <= max * 1000).slice(0, limit);

async function ask(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(WAIT_MS) });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError' ? `${DOWN}.` : err.message);
  }
  if (res.status >= 500) throw new Error(`${DOWN} (HTTP ${res.status}).`);
  if (res.status === 429) throw new Error('Openverse rate limit: 20 requests a minute, 200 a day without a key.');
  if (!res.ok) throw new Error(`Openverse ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function searchEffects(query, { license, page, max, limit } = {}) {
  const { result_count, results } = await ask(searchUrl(query, { license, page }));
  return { total: result_count, onPage: results.length, effects: pickEffects(results, { max, limit }) };
}

const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim();
const licenseLabel = ({ license, license_version }) => `${license === 'by' ? 'CC BY' : license.toUpperCase()} ${license_version}`;

export async function fetchEffect(id, name, { lib = join(ROOT, 'sfx-library') } = {}) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw new Error(`Not an Openverse id: ${id}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new Error(`--name takes lowercase letters, digits and dashes: ${name}`);
  const dir = join(lib, 'openverse');
  const path = `openverse/${name}.wav`;
  if (existsSync(join(lib, path))) throw new Error(`${path} already exists: pick a new name.`);

  const effect = await ask(`${API}${id}/`);
  checkLicenses(effect.license);
  if (!effect.url?.startsWith('https://')) throw new Error(`No secure audio link for ${id}: ${effect.url}`);
  const res = await fetch(effect.url, { signal: AbortSignal.timeout(WAIT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${effect.url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('audio/')) throw new Error(`Not audio (${type}): ${effect.url}`);

  const tmp = mkdtempSync(join(tmpdir(), 'openverse-'));
  try {
    const raw = join(tmp, 'effect.dl'), wav = join(tmp, 'effect.wav');
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', wav]);
    mkdirSync(dir, { recursive: true });
    copyFileSync(wav, join(lib, path)); // only a finished conversion reaches the library
  } finally {
    rmSync(tmp, { recursive: true });
  }

  const license = licenseLabel(effect);
  const creditsFile = join(dir, 'credits.json');
  const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : {};
  credits[path] = { id, title: oneLine(effect.title), creator: oneLine(effect.creator), license, page: effect.foreign_landing_url, needsCredit: effect.license === 'by', credit: oneLine(effect.attribution) };
  writeFileSync(creditsFile, JSON.stringify(credits, null, 1));

  const manifestFile = join(lib, 'manifest.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : [];
  const entry = { path, source: 'openverse', license, ...measure(join(lib, path)) };
  manifest.push(entry);
  manifest.sort((a, b) => (a.path < b.path ? -1 : 1));
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
  return { ...entry, ...credits[path] };
}

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { license: { type: 'string', default: 'cc0' }, max: { type: 'string', default: '5' }, limit: { type: 'string', default: '10' }, page: { type: 'string', default: '1' }, get: { type: 'string' }, name: { type: 'string' } } });
  if (values.get) {
    if (!values.name) throw new Error('--get needs --name <file>');
    return fetchEffect(values.get, values.name).then((effect) => {
      console.log(`wrote sfx-library/${effect.path} (${effect.duration} s, audible from ${effect.onset} s, ${effect.license})`);
      if (effect.needsCredit) console.log(`Credit this in the description of any video that uses it:\n  ${effect.credit}`);
    });
  }
  if (!positionals[0]) throw new Error('Usage: node scripts/sfx/search.mjs "<words>" [--license cc0,by] [--max s] [--limit n] [--page n]\n       node scripts/sfx/search.mjs --get <id> --name <file>');
  const license = checkLicenses(values.license);
  const max = Number(values.max);
  return searchEffects(positionals[0], { license, max, limit: Number(values.limit), page: Number(values.page) }).then(({ total, onPage, effects }) => {
    console.log(`${effects.length} effects of ${max} s or less, from ${onPage} on this page (${total} matches, ${license}):`);
    for (const e of effects) {
      console.log(`${(e.duration / 1000).toFixed(1)} s  ${e.license}  ${e.filesize ? `${Math.ceil(e.filesize / 1024)} KB  ` : ''}${oneLine(e.title).slice(0, 70)} (${oneLine(e.creator)})`);
      console.log(`  ${e.id}  ${e.foreign_landing_url}`);
    }
  });
}

if (basename(process.argv[1] ?? '') === 'search.mjs') {
  try {
    await main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
