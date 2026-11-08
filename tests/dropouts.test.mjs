import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeRuns, zeroRunScanner } from '../scripts/audio-dropouts.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const script = fileURLToPath(new URL('../scripts/audio-dropouts.mjs', import.meta.url));
const SR = 48000;

// A take as Camo records it: voice on the left, the right channel near -90 dB. The mic opens 0.1 s in, an underrun
// loses 18 blocks of 128 samples on both channels at 1.0 s, and a gate closes on the left in a quiet pause at 1.5 s.
function take() {
  const frames = 2 * SR, x = new Float32Array(frames * 2);
  for (let n = 0; n < frames; n++) {
    const t = n / SR;
    x[2 * n] = (t >= 1.4 && t < 1.8 ? 1e-4 : 0.3) * Math.sin(2 * Math.PI * 180 * t + 0.1);
    x[2 * n + 1] = 3e-5 * Math.sin(2 * Math.PI * 53 * t + 0.7);
  }
  const zero = (a, b, chs = [0, 1]) => { for (let n = a; n < b; n++) for (const c of chs) x[2 * n + c] = 0; };
  zero(0, SR / 10);
  zero(SR, SR + 18 * 128);
  zero(1.5 * SR, 1.6 * SR, [0]);
  return Buffer.from(x.buffer);
}

test('zeroRunScanner finds the lost block on both channels and the gated pause, whatever the chunk size', () => {
  const bytes = take();
  for (const size of [bytes.length, 4093, 777]) {
    const scan = zeroRunScanner({ channels: 2, sampleRate: SR });
    for (let i = 0; i < bytes.length; i += size) scan.push(bytes.subarray(i, i + size));
    const { frames, runs } = scan.end();
    assert.equal(frames, 2 * SR);
    assert.deepEqual(runs.map((r) => [r.start, r.end, r.channels]), [[SR, SR + 2304, [1, 2]], [1.5 * SR, 1.6 * SR, [1]]], `chunks of ${size} bytes`);
  }
});

test('describeRuns calls a run a dropout only with sound on both sides', () => {
  const scan = zeroRunScanner({ channels: 2, sampleRate: SR });
  scan.push(take());
  const [lost, gate] = describeRuns(scan.end().runs, { sampleRate: SR });
  const { beforeDb, afterDb, ...rest } = lost;
  assert.deepEqual(rest, { start: 1, ms: 48, samples: 2304, channels: [1, 2], inSound: true });
  // the tone's RMS is -13.5 dBFS; 20 ms holds 3.6 periods, so a window reads within half a dB of it
  for (const db of [beforeDb, afterDb]) assert.ok(Math.abs(db + 13.5) < 0.5, `level ${db}`);
  assert.equal(gate.inSound, false);
  assert.ok(gate.beforeDb < -80 && gate.afterDb < -80);
});

test('the CLI exits 2 on a decoded file with a hole inside the tone and 0 on a clean one', { skip: !hasFfmpeg }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dropouts-test-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const make = (name, expr) => {
    const file = join(dir, name);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=${SR}:d=1`, '-c:a', 'pcm_s16le', file]);
    return file;
  };
  const holed = spawnSync(process.execPath, [script, make('holed.wav', 'if(between(t,0.5,0.55),0,0.4*sin(2*PI*220*t+0.3))'), '--json'], { encoding: 'utf8' });
  assert.equal(holed.status, 2, holed.stderr);
  const { runs, sampleRate, channels } = JSON.parse(holed.stdout);
  assert.deepEqual([sampleRate, channels, runs.length], [SR, 1, 1]);
  assert.ok(Math.abs(runs[0].start - 0.5) < 0.001 && Math.abs(runs[0].ms - 50) < 1 && runs[0].inSound, JSON.stringify(runs[0]));
  const clean = spawnSync(process.execPath, [script, make('clean.wav', '0.4*sin(2*PI*220*t+0.3)')], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /No dropouts inside sound/);
});
