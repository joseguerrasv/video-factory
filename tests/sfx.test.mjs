import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLicenses, fetchEffect, pickEffects, searchEffects, searchUrl } from '../scripts/sfx/search.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const realFetch = globalThis.fetch;
const id = 'f1dc6045-7965-41de-87f8-4731d2583fd2';
const record = (license = 'cc0', version = '1.0') => ({ id, title: 'Air\nswoosh', creator: 'someone', license, license_version: version, url: 'https://cdn.freesound.org/previews/60/60026_71257-hq.mp3', foreign_landing_url: 'https://freesound.org/people/someone/sounds/60026', attribution: '"Air swoosh" by someone', duration: 490, filesize: 13358 });

// Stands in for Openverse and its audio CDN, so no test reaches the network.
function stubNetwork(t, audio, { type = 'audio/mpeg', item = record() } = {}) {
  globalThis.fetch = async (url) => (String(url).startsWith('https://api.openverse.org/') ? new Response(JSON.stringify(item), { headers: { 'content-type': 'application/json' } }) : new Response(audio, { headers: { 'content-type': type } }));
  t.after(() => { globalThis.fetch = realFetch; });
}

function standIn(t) {
  const lib = mkdtempSync(join(tmpdir(), 'sfx-test-'));
  t.after(() => rmSync(lib, { recursive: true }));
  const source = join(lib, 'source.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.2', '-ar', '44100', '-ac', '1', source]);
  writeFileSync(join(lib, 'manifest.json'), JSON.stringify([{ path: 'kenney/a.wav' }, { path: 'mixkit/z.wav' }]));
  return { lib, audio: readFileSync(source) };
}

test('searchUrl asks for Freesound under the anonymous page limit, with no category or length filter', () => {
  const url = new URL(searchUrl('paper tear'));
  assert.deepEqual(Object.fromEntries(url.searchParams), { q: 'paper tear', license: 'cc0', source: 'freesound', page_size: '20' });
  assert.equal(new URL(searchUrl('paper', { page: 2 })).searchParams.get('page'), '2');
});

test('pickEffects keeps short effects in search order, up to the limit', () => {
  const results = [{ url: 'a', duration: 500 }, { url: 'b', duration: 9000 }, { url: 'c', duration: null }, { url: '', duration: 400 }, { url: 'd', duration: 3000 }, { url: 'e', duration: 2000 }];
  assert.deepEqual(pickEffects(results, { max: 3, limit: 2 }).map((r) => r.url), ['a', 'd']);
});

test('checkLicenses allows only licences a commercial edit can use', () => {
  assert.equal(checkLicenses('cc0,pdm,by'), 'cc0,pdm,by');
  for (const license of ['by-nc', 'by-sa', 'by-nd', 'sampling+']) assert.throws(() => checkLicenses(license), /Refused licence/);
});

test('a hanging or failing Openverse names the outage instead of waiting', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => { throw new DOMException('aborted', 'TimeoutError'); };
  await assert.rejects(searchEffects('stapler'), /Openverse did not answer.*issues\/5649/);
  globalThis.fetch = async () => new Response('error code: 502', { status: 502 });
  await assert.rejects(searchEffects('stapler'), /Openverse did not answer.*HTTP 502/);
});

test('fetchEffect saves a library WAV with its credit and manifest entry', { skip: !hasFfmpeg }, async (t) => {
  const { lib, audio } = standIn(t);
  stubNetwork(t, audio);
  const effect = await fetchEffect(id, 'air-swoosh', { lib });
  assert.equal(effect.license, 'CC0 1.0');
  assert.equal(effect.needsCredit, false);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels', '-of', 'csv=p=0', join(lib, 'openverse/air-swoosh.wav')], { encoding: 'utf8' });
  assert.equal(probe.trim(), 'pcm_s16le,48000,2');
  const credits = JSON.parse(readFileSync(join(lib, 'openverse/credits.json'), 'utf8'));
  assert.equal(credits['openverse/air-swoosh.wav'].title, 'Air swoosh');
  const manifest = JSON.parse(readFileSync(join(lib, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.map((entry) => entry.path), ['kenney/a.wav', 'mixkit/z.wav', 'openverse/air-swoosh.wav']);
  const entry = manifest.at(-1);
  assert.ok(entry.duration > 0.19 && entry.duration < 0.21, `duration ${entry.duration}`);
  assert.equal(entry.license, 'CC0 1.0');
  await assert.rejects(fetchEffect(id, 'air-swoosh', { lib }), /already exists/);
});

test('fetchEffect flags a CC BY effect as needing its credit', { skip: !hasFfmpeg }, async (t) => {
  const { lib, audio } = standIn(t);
  stubNetwork(t, audio, { item: record('by', '4.0') });
  const effect = await fetchEffect(id, 'credited', { lib });
  assert.equal(effect.license, 'CC BY 4.0');
  assert.equal(effect.needsCredit, true);
  assert.equal(effect.credit, '"Air swoosh" by someone');
});

test('fetchEffect refuses bad input and writes nothing', { skip: !hasFfmpeg }, async (t) => {
  const { lib, audio } = standIn(t);
  await assert.rejects(fetchEffect('../../etc', 'x', { lib }), /Not an Openverse id/);
  await assert.rejects(fetchEffect(id, '../escape', { lib }), /--name takes/);
  stubNetwork(t, audio, { item: record('by-nc', '4.0') });
  await assert.rejects(fetchEffect(id, 'non-commercial', { lib }), /Refused licence: by-nc/);
  stubNetwork(t, audio, { type: 'text/html' });
  await assert.rejects(fetchEffect(id, 'a-web-page', { lib }), /Not audio/);
  stubNetwork(t, Buffer.from('not audio at all'));
  await assert.rejects(fetchEffect(id, 'broken-file', { lib }));
  assert.equal(existsSync(join(lib, 'openverse')), false);
});
