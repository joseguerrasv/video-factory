#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, openAsBlob, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from './lib/env.mjs';
import { PATHS } from './lib/paths.mjs';
import { activeBrand, loadProfile, readJson } from './lib/brands.mjs';
import { detectSilences, extractAudio, inspectMedia, mapLimit, round, run } from './lib/media.mjs';

const USAGE = `Usage: node scripts/transcribe.mjs <media> [--provider elevenlabs|groq|openai|local] [--language en] [--out <file.json>] [--force]

Writes word-level JSON (default: <media dir>/<stem>.json). An existing transcript is reused unless --force.
Provider order: --provider → active brand services.transcription → first key in .env (elevenlabs, groq, openai) → local.`;

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 15 * 60_000;
const UPLOAD_CONCURRENCY = 3;
const SPLIT_WINDOW_SECS = 90;
const WORDLIKE = /[\p{L}\p{N}]/u;

const PROVIDERS = {
  elevenlabs: { envKey: 'ELEVENLABS_API_KEY', model: 'scribe_v2', chunkSecs: Infinity, call: callElevenLabs },
  groq: {
    envKey: 'GROQ_API_KEY',
    model: 'whisper-large-v3',
    chunkSecs: 600,
    call: whisperApi('https://api.groq.com/openai/v1/audio/transcriptions'),
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    model: 'whisper-1',
    chunkSecs: 600,
    call: whisperApi('https://api.openai.com/v1/audio/transcriptions'),
  },
  local: {},
};

const CLOUD_ORDER = ['elevenlabs', 'groq', 'openai'];

const log = (message) => process.stderr.write(`transcribe: ${message}\n`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function parseOptions(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      provider: { type: 'string', short: 'p' },
      language: { type: 'string', short: 'l' },
      out: { type: 'string', short: 'o' },
      force: { type: 'boolean', short: 'f', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  return { ...values, media: resolve(positionals[0]) };
}

function assertProviderName(name, source) {
  if (!Object.hasOwn(PROVIDERS, name)) {
    throw new Error(`Unknown provider "${name}" (from ${source}). Use one of: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return name;
}

function resolveProvider(flag) {
  if (flag) return assertProviderName(flag.toLowerCase(), '--provider');
  const brand = activeBrand();
  const configured = brand ? loadProfile(brand)?.services?.transcription : null;
  if (typeof configured === 'string' && configured) {
    return assertProviderName(configured.toLowerCase(), `brands/${brand}/profile.json services.transcription`);
  }
  return CLOUD_ORDER.find((name) => process.env[PROVIDERS[name].envKey]) ?? 'local';
}

function requireKey(name) {
  const { envKey } = PROVIDERS[name];
  const key = envKey ? process.env[envKey] : null;
  if (envKey && !key) {
    throw new Error(`Provider "${name}" needs ${envKey}. Add it to ${PATHS.env} or the environment, or choose another provider with --provider (${Object.keys(PROVIDERS).join('|')}).`);
  }
  return key;
}

function readExistingTranscript(file) {
  if (!existsSync(file)) return null;
  const doc = readJson(file);
  if (!Array.isArray(doc?.words)) {
    throw new Error(`${file} exists but is not a transcript. Pass --out <file.json>, or --force to overwrite it.`);
  }
  return doc;
}

let languageNameIndex;

function buildLanguageNameIndex() {
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  const index = new Map();
  for (let a = 97; a <= 122; a++) {
    for (let b = 97; b <= 122; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code)?.toLowerCase();
      if (name && name !== code) index.set(name, code);
    }
  }
  return index;
}

function toLanguageCode(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (/^[a-z]{2,3}(?:[-_][a-z0-9]+)*$/.test(v)) {
    try { return Intl.getCanonicalLocales(v.replace('_', '-'))[0].split('-')[0]; } catch {}
  }
  languageNameIndex ??= buildLanguageNameIndex();
  return languageNameIndex.get(v) ?? v;
}

function redactSecrets(text, key) {
  let out = String(text ?? '');
  if (key) out = out.split(key).join('[redacted]');
  return out.replace(/\b(?:sk|gsk|xi)[-_][A-Za-z0-9_*-]{6,}/g, '[redacted]');
}

async function errorDetail(response) {
  const raw = await response.text().catch(() => '');
  try {
    const body = JSON.parse(raw);
    const detail = body.error?.message ?? body.detail?.message ?? body.detail?.status ?? body.detail ?? body.message ?? body;
    return (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300);
  } catch {
    return raw.slice(0, 300) || response.statusText;
  }
}

function retryDelayMs(response, attempt) {
  const header = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 60) * 1000;
  return 2000 * 2 ** attempt + Math.random() * 500;
}

const isRetryableStatus = (status) => status === 408 || status === 409 || status === 429 || status >= 500;

async function postForm({ provider, url, headers, form, key }) {
  const { envKey } = PROVIDERS[provider];
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: form(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const retryable = error.name !== 'TimeoutError' && attempt < MAX_RETRIES;
      if (!retryable) throw new Error(`${provider} request failed: ${redactSecrets(error.cause?.message ?? error.message, key)}`);
      log(`${provider} network error, retrying (${attempt + 1}/${MAX_RETRIES})`);
      await wait(retryDelayMs(null, attempt));
      continue;
    }
    if (response.ok) return response.json();
    const detail = redactSecrets(await errorDetail(response), key);
    if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
      log(`${provider} HTTP ${response.status}, retrying (${attempt + 1}/${MAX_RETRIES})`);
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${provider} rejected the request (HTTP ${response.status}): ${detail}. Check ${envKey} (${PATHS.env} or environment): it may be invalid, expired, out of quota or lacking permissions.`);
    }
    throw new Error(`${provider} HTTP ${response.status}: ${detail}`);
  }
}

async function callElevenLabs({ file, key, language, model }) {
  const blob = await openAsBlob(file, { type: 'audio/flac' });
  const form = () => {
    const body = new FormData();
    body.append('file', blob, basename(file));
    body.append('model_id', model);
    body.append('timestamps_granularity', 'word');
    body.append('tag_audio_events', 'false');
    if (language) body.append('language_code', language);
    return body;
  };
  const body = await postForm({ provider: 'elevenlabs', url: 'https://api.elevenlabs.io/v1/speech-to-text', headers: { 'xi-api-key': key }, form, key });
  return {
    text: body.text ?? '',
    language: body.language_code,
    words: (body.words ?? []).filter((w) => w.type === 'word').map((w) => ({ text: w.text, start: w.start, end: w.end })),
  };
}

function whisperApi(url) {
  return async function callWhisper({ provider, file, key, language, model }) {
    const blob = await openAsBlob(file, { type: 'audio/flac' });
    const form = () => {
      const body = new FormData();
      body.append('file', blob, basename(file));
      body.append('model', model);
      body.append('response_format', 'verbose_json');
      body.append('timestamp_granularities[]', 'word');
      body.append('temperature', '0');
      if (language) body.append('language', language);
      return body;
    };
    const body = await postForm({ provider, url, headers: { authorization: `Bearer ${key}` }, form, key });
    return {
      text: body.text ?? '',
      language: body.language,
      words: (body.words ?? []).map((w) => ({ text: w.word ?? w.text, start: w.start, end: w.end })),
    };
  };
}

const midpoint = (interval) => (interval.start + interval.end) / 2;

async function planChunks(audio, duration, maxSecs) {
  if (duration <= maxSecs) return [{ start: 0, end: duration }];
  const pauses = await detectSilences(audio, { noise: '-40dB', minDuration: 0.3, duration });
  const chunks = [];
  let start = 0;
  while (duration - start > maxSecs) {
    const target = start + maxSecs;
    const pause = pauses.filter((p) => midpoint(p) > target - SPLIT_WINDOW_SECS && midpoint(p) < target).at(-1);
    const end = pause ? midpoint(pause) : target;
    chunks.push({ start, end });
    start = end;
  }
  chunks.push({ start, end: duration });
  return chunks;
}

async function transcribeCloud(name, { media, tmp, language, duration }) {
  const provider = PROVIDERS[name];
  const key = requireKey(name);
  const audio = await extractAudio(media, join(tmp, 'audio.flac'));
  const chunks = await planChunks(audio, duration, provider.chunkSecs);
  log(`${name} (${provider.model}) · ${round(duration, 1)}s audio · ${chunks.length} request${chunks.length > 1 ? 's' : ''}`);
  const parts = await mapLimit(chunks, UPLOAD_CONCURRENCY, async (chunk, index) => {
    const file = chunks.length === 1
      ? audio
      : await extractAudio(audio, join(tmp, `chunk-${index}.flac`), { start: chunk.start, duration: chunk.end - chunk.start });
    const part = await provider.call({ provider: name, file, key, language, model: provider.model });
    return { ...part, words: part.words.map((w) => ({ ...w, start: w.start + chunk.start, end: w.end + chunk.start })) };
  });
  return {
    model: provider.model,
    text: parts.map((p) => p.text.trim()).filter(Boolean).join(' '),
    language: parts.find((p) => p.language)?.language,
    words: parts.flatMap((p) => p.words),
  };
}

function findOnPath(name) {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(dir, name);
    if (dir && existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveHyperframes() {
  const local = join(PATHS.root, 'node_modules', '.bin', 'hyperframes');
  const bin = existsSync(local) ? local : findOnPath('hyperframes');
  if (!bin) {
    throw new Error(`Local transcription needs the HyperFrames CLI, which is not installed. Run \`npm install\` in ${PATHS.root}, or use a cloud provider (--provider groq|openai|elevenlabs).`);
  }
  return bin;
}

function assertLocalEngine() {
  const candidates = [
    process.env.HYPERFRAMES_WHISPER_PATH,
    process.env.HYPERFRAMES_PARAKEET,
    findOnPath('whisper-cli'),
    findOnPath('parakeet-mlx'),
    '/opt/homebrew/bin/whisper-cli',
    '/usr/local/bin/whisper-cli',
    join(homedir(), '.cache', 'hyperframes', 'whisper', 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
    join(homedir(), '.venvs', 'parakeet', 'bin', 'parakeet-mlx'),
  ];
  if (candidates.some((path) => path && existsSync(path))) return;
  const install = process.platform === 'darwin'
    ? 'Run `brew install whisper-cpp`'
    : 'Build whisper.cpp (https://github.com/ggml-org/whisper.cpp#building)';
  throw new Error(`Local transcription needs whisper-cpp, which is not installed. ${install}, or use a cloud provider (--provider groq|openai|elevenlabs).`);
}

function lastJsonLine(text) {
  for (const line of text.trim().split('\n').reverse()) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}

async function transcribeLocal({ media, tmp, language }) {
  const bin = resolveHyperframes();
  assertLocalEngine();
  const audio = await extractAudio(media, join(tmp, 'audio.wav'));
  const workDir = join(tmp, 'hyperframes');
  mkdirSync(workDir);
  log(`local (HyperFrames) · ${basename(media)}`);
  const args = ['transcribe', audio, '--dir', workDir, '--json', ...(language ? ['--language', language] : [])];
  const result = await run(bin, args, { cwd: PATHS.root });
  const summary = lastJsonLine(result.stdout);
  if (result.code !== 0 || !summary?.ok) {
    const reason = summary?.error ?? summary?.reason ?? result.stderr.trim().split('\n').slice(-3).join('\n');
    throw new Error(`hyperframes transcribe failed: ${reason || `exit ${result.code}`}`);
  }
  const words = JSON.parse(readFileSync(summary.transcriptPath ?? join(workDir, 'transcript.json'), 'utf8'));
  const text = words.map((w) => String(w.text ?? '').trim()).filter((t) => WORDLIKE.test(t)).join(' ');
  return { model: summary.model ?? 'whisper.cpp', language, text, words };
}

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function normalizeWords(words, duration) {
  return words
    .map((w) => ({ text: String(w.text ?? '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && WORDLIKE.test(w.text) && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => {
      const start = clamp(w.start, 0, duration);
      return { text: w.text, start: round(start), end: round(clamp(Math.max(w.end, start), 0, duration)) };
    })
    .sort((a, b) => a.start - b.start);
}

function writeAtomic(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, file);
}

const summaryLine = (fields) => console.log(JSON.stringify({ ok: true, ...fields }));

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const { media } = options;
  if (!existsSync(media)) throw new Error(`File not found: ${media}`);
  const out = resolve(options.out ?? join(dirname(media), `${basename(media, extname(media))}.json`));
  if (out === media) throw new Error(`Output would overwrite the input. Pass --out <file.json>.`);

  const existing = options.force ? null : readExistingTranscript(out);
  if (existing) {
    log(`reusing existing transcript ${out} (pass --force to re-transcribe)`);
    summaryLine({ reused: true, out, provider: existing.provider, words: existing.words.length, duration: existing.audio_duration_secs });
    return;
  }

  loadEnv();
  const provider = resolveProvider(options.provider);
  if (provider !== 'local') requireKey(provider);
  const language = options.language ? toLanguageCode(options.language) : null;
  const { duration, hasAudio } = await inspectMedia(media);
  if (!hasAudio) throw new Error(`${media} has no audio stream to transcribe.`);
  if (!duration) throw new Error(`Could not read the duration of ${media}.`);

  const tmp = mkdtempSync(join(tmpdir(), 'transcribe-'));
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  process.once('SIGINT', () => { cleanup(); process.exit(130); });
  try {
    const context = { media, tmp, language, duration };
    const result = provider === 'local' ? await transcribeLocal(context) : await transcribeCloud(provider, context);
    const words = normalizeWords(result.words, duration);
    if (!words.length) log('warning: provider returned no words (silent or non-speech audio?)');
    const lang = language ?? toLanguageCode(result.language);
    const doc = {
      text: result.text.trim(),
      language: lang,
      language_code: lang,
      provider,
      model: result.model,
      audio_duration_secs: round(duration),
      words,
    };
    writeAtomic(out, `${JSON.stringify(doc, null, 2)}\n`);
    summaryLine({ out, provider, words: words.length, duration: doc.audio_duration_secs });
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(`transcribe: ${error.message}`);
  process.exitCode = 1;
});
