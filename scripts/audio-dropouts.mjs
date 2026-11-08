#!/usr/bin/env node
// Find capture dropouts in a recording: runs of exact digital silence (every sample 0.0) with sound on both sides.
// A live microphone never records exact zeros, so such a run inside speech is audio the recorder lost (a buffer
// underrun). Check the source, not the finished mix: there a sound-effect tail or room tone can mask the hole (one sat at
// -54 dB in a final mix), so silence and loudness checks never fire. Samples are read as decoded, never resampled.
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { probe, round } from './lib/media.mjs';

const USAGE = `Usage: node scripts/audio-dropouts.mjs <media> [--min-ms 0.5] [--floor=-50] [--all] [--json]

Lists runs of exact digital silence in the first audio track, per channel, at least --min-ms long. A run with sound on
both sides (the 20 ms before and after it both above --floor dBFS RMS) is a dropout. Runs in quiet passages (a gate,
digital silence between takes) are only counted unless --all is given. Leading and trailing silence are skipped.
Exit 0 = no dropouts inside sound, 2 = dropouts found, 1 = usage or decode error.`;

const dbfs = (meanSquare) => 10 * Math.log10(meanSquare + 1e-20);
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;

/**
 * Streaming scan of interleaved float32 little-endian PCM for runs of exact zeros. push(bytes) with chunks of any size,
 * then end() → { frames, runs }: runs in samples, the same block lost on several channels merged into one,
 * { start, end, channels (1-based), before, after } with before/after the mean square of windowMs on each side.
 */
export function zeroRunScanner({ channels = 1, sampleRate = 48000, minMs = 0.5, windowMs = 20 } = {}) {
  const C = channels, min = Math.max(1, Math.round((minMs / 1000) * sampleRate)), W = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const ring = new Float64Array(W * C), sum = new Float64Array(C), before = new Float64Array(C), runStart = new Array(C).fill(-1);
  const open = [], runs = [];
  let n = 0, rest = Buffer.alloc(0);
  return {
    push(bytes) {
      const buf = rest.length ? Buffer.concat([rest, bytes]) : bytes, usable = buf.length - (buf.length % (4 * C));
      const x = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable));
      rest = Buffer.from(buf.subarray(usable));
      for (let i = 0; i < x.length; i += C, n++) {
        const slot = (n % W) * C;
        for (let c = 0; c < C; c++) {
          const v = x[i + c], q = v * v;
          if (v === 0) {
            if (runStart[c] < 0) { runStart[c] = n; before[c] = Math.max(0, sum[c]) / Math.min(n || 1, W); }
          } else if (runStart[c] >= 0) {
            // a run from the very first sample is lead-in, not a dropout
            if (runStart[c] > 0 && n - runStart[c] >= min) open.push({ c, start: runStart[c], end: n, before: before[c], acc: 0, count: 0 });
            runStart[c] = -1;
          }
          sum[c] += q - ring[slot + c];
          ring[slot + c] = q;
        }
        // the window after each run that just ended, its first sample included
        for (const o of open) { o.acc += x[i + o.c] ** 2; o.count++; }
        while (open.length && open[0].count === W) runs.push(open.shift());
      }
    },
    end() {
      runs.push(...open.splice(0)); // windows the end of the file cut short; runs still open at the end are trailing silence
      runs.sort((a, b) => a.start - b.start);
      const merged = [];
      for (const { c, start, end, before: b, acc, count } of runs) {
        const after = acc / count, last = merged.at(-1);
        if (last && start < last.end) Object.assign(last, { end: Math.max(last.end, end), channels: [...last.channels, c + 1], before: Math.max(last.before, b), after: Math.max(last.after, after) });
        else merged.push({ start, end, channels: [c + 1], before: b, after });
      }
      return { frames: n, runs: merged };
    },
  };
}

/** Runs in seconds and dBFS; inSound when both sides are above floorDb. */
export function describeRuns(runs, { sampleRate, floorDb = -50 }) {
  return runs.map(({ start, end, channels, before, after }) => ({
    start: round(start / sampleRate, 4),
    ms: round(((end - start) / sampleRate) * 1000, 1),
    samples: end - start,
    channels,
    beforeDb: round(dbfs(before), 1),
    afterDb: round(dbfs(after), 1),
    inSound: dbfs(before) >= floorDb && dbfs(after) >= floorDb,
  }));
}

function decode(file, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-map', '0:a:0', '-vn', '-f', 'f32le', '-c:a', 'pcm_f32le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not decode ${file}:\n${stderr.trim().split('\n').slice(-6).join('\n')}`))));
  });
}

export async function scanDropouts(file, { minMs = 0.5, floorDb = -50, windowMs = 20 } = {}) {
  const { streams = [] } = await probe(file);
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!audio) throw new Error(`${file} has no audio track`);
  const sampleRate = Number(audio.sample_rate), channels = Number(audio.channels);
  const scan = zeroRunScanner({ channels, sampleRate, minMs, windowMs });
  await decode(file, (chunk) => scan.push(chunk));
  const { frames, runs } = scan.end();
  return { file, codec: audio.codec_name, sampleRate, channels, duration: round(frames / sampleRate), minMs, floorDb, runs: describeRuns(runs, { sampleRate, floorDb }) };
}

async function main() {
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      allowPositionals: true,
      options: { 'min-ms': { type: 'string' }, floor: { type: 'string' }, all: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
    }));
  } catch (e) { console.error(`${e.message}\n\n${USAGE}`); return 1; } // "--floor -50" needs the = form
  if (values.help) { console.log(USAGE); return 0; }
  const minMs = Number(values['min-ms'] ?? 0.5), floorDb = Number(values.floor ?? -50);
  if (positionals.length !== 1 || !(minMs > 0) || !Number.isFinite(floorDb)) { console.error(USAGE); return 1; }
  let report;
  try { report = await scanDropouts(positionals[0], { minMs, floorDb }); } catch (e) { console.error(e.message); return 1; }
  const hits = report.runs.filter((r) => r.inSound), quiet = report.runs.filter((r) => !r.inSound);
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else {
    const line = (r) => `  ${clock(r.start)}  ${r.ms.toFixed(1).padStart(6)} ms  ${String(r.samples).padStart(6)} samples  ch ${r.channels.join('+')}  before ${r.beforeDb} dBFS, after ${r.afterDb} dBFS`;
    console.log(`${basename(report.file)}: ${report.codec}, ${report.sampleRate} Hz, ${report.channels} ch, ${clock(report.duration)}; zero runs of ${minMs} ms or more`);
    console.log(hits.length ? `${hits.length} dropout${hits.length === 1 ? '' : 's'} inside sound (lost audio, both sides above ${floorDb} dBFS):` : 'No dropouts inside sound.');
    hits.forEach((r) => console.log(line(r)));
    if (quiet.length && values.all) { console.log(`${quiet.length} in quiet passages:`); quiet.forEach((r) => console.log(line(r))); }
    else if (quiet.length) console.log(`${quiet.length} more in quiet passages (--all lists them).`);
  }
  return hits.length ? 2 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
