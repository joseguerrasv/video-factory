import { spawnSync } from 'node:child_process';

// Seconds to the first sample within 30 dB of the peak, plus duration and peak level.
export function measure(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const pcm = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  let peak = 0, at = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) { peak = a; at = i; } }
  const floor = peak * 0.0316;
  let onset = 0;
  while (onset < pcm.length && Math.abs(pcm[onset]) < floor) onset++;
  return { duration: +(pcm.length / 48000).toFixed(3), onset: +(onset / 48000).toFixed(3), peakAt: +(at / 48000).toFixed(3), peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1) };
}
