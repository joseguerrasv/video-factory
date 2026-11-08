#!/usr/bin/env node
// Generates one custom sound effect with ElevenLabs into sfx-library/elevenlabs/.
// Usage: node scripts/sfx/generate.mjs "<prompt>" --name marker-1 [--duration 0.8] [--influence 0.5]
// Bills per generation, so list the sounds and the cost before a batch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadEnv } from '../lib/env.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { name: { type: 'string' }, duration: { type: 'string', default: '1' }, influence: { type: 'string', default: '0.5' } } });
if (!positionals[0] || !values.name) { console.log('Usage: node scripts/sfx/generate.mjs "<prompt>" --name <file> [--duration s] [--influence 0-1]'); process.exit(1); }
loadEnv();
const dir = join(resolve(fileURLToPath(new URL('../..', import.meta.url))), 'sfx-library/elevenlabs');
mkdirSync(dir, { recursive: true });
const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192', {
  method: 'POST',
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ text: positionals[0], model_id: 'eleven_text_to_sound_v2', duration_seconds: Number(values.duration), prompt_influence: Number(values.influence) }),
});
if (!res.ok) { console.error(res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const mp3 = join(dir, `${values.name}.mp3`);
writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(dir, `${values.name}.wav`)]);
rmSync(mp3);
console.log('wrote', join('sfx-library/elevenlabs', `${values.name}.wav`));
