import { spawn } from 'node:child_process';

const INSTALL_HINT = {
  ffmpeg: 'brew install ffmpeg',
  ffprobe: 'brew install ffmpeg',
};

export const round = (n, digits = 3) => (Number.isFinite(n) ? Number(n.toFixed(digits)) : null);

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = (seconds - m * 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export function run(cmd, args, { timeoutMs = 0, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    let timer;
    if (timeoutMs > 0) timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => {
      clearTimeout(timer);
      if (e.code === 'ENOENT') e.message = `${cmd} not found on PATH${INSTALL_HINT[cmd] ? `. Install: ${INSTALL_HINT[cmd]}` : ''}`;
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: signal ? -1 : code, signal, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
  });
}

function tail(text, lines = 6) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

export async function runChecked(cmd, args, options) {
  const result = await run(cmd, args, options);
  if (result.code !== 0) {
    const reason = result.signal ? `killed (${result.signal})` : `exit ${result.code}`;
    throw new Error(`${cmd} failed (${reason}):\n${tail(result.stderr)}`);
  }
  return result;
}

export const ffmpeg = (args, options) => runChecked('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], options);

export async function probe(file) {
  const { stdout } = await runChecked('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]);
  return JSON.parse(stdout);
}

export async function inspectMedia(file) {
  const { format = {}, streams = [] } = await probe(file);
  return {
    duration: Number(format.duration) || Math.max(0, ...streams.map((s) => Number(s.duration) || 0)),
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
    hasVideo: streams.some((s) => s.codec_type === 'video' && !s.disposition?.attached_pic),
  };
}

export async function mediaDuration(file) {
  const { duration } = await inspectMedia(file);
  if (!duration) throw new Error(`Could not read duration of ${file}`);
  return duration;
}

let filterCache;

export async function availableFilters() {
  if (!filterCache) {
    const { stdout } = await runChecked('ffmpeg', ['-hide_banner', '-filters']);
    filterCache = new Set(
      stdout.split('\n').map((line) => line.match(/^\s*[A-Z.|]{2,3}\s+(\S+)\s/)?.[1]).filter(Boolean),
    );
  }
  return filterCache;
}

export async function extractAudio(input, output, { start = 0, duration, sampleRate = 16000 } = {}) {
  const seek = start > 0 ? ['-ss', String(start)] : [];
  const length = duration ? ['-t', String(duration)] : [];
  await ffmpeg([...seek, ...length, '-i', input, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(sampleRate), output]);
  return output;
}

const INTERVAL_PATTERNS = {
  black: { line: /black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)/g },
  silence: { start: /silence_start:\s*(-?[\d.]+)/, end: /silence_end:\s*([\d.]+)/ },
  freeze: { start: /freezedetect\.freeze_start:\s*([\d.]+)/, end: /freezedetect\.freeze_end:\s*([\d.]+)/ },
};

function pairedIntervals(stderr, { start, end }, duration) {
  const intervals = [];
  let open = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(start);
    if (s) { open = Math.max(0, Number(s[1])); continue; }
    const e = line.match(end);
    if (e && open !== null) { intervals.push([open, Number(e[1])]); open = null; }
  }
  if (open !== null && Number.isFinite(duration)) intervals.push([open, duration]);
  return intervals;
}

export function parseIntervals(stderr, kind, duration) {
  const pattern = INTERVAL_PATTERNS[kind];
  const raw = pattern.line
    ? [...stderr.matchAll(pattern.line)].map((m) => [Number(m[1]), Number(m[2])])
    : pairedIntervals(stderr, pattern, duration);
  return raw.map(([start, end]) => ({ start: round(start), end: round(end), duration: round(end - start) }));
}

export async function detectSilences(file, { noise = '-45dB', minDuration = 1.2, duration } = {}) {
  const { stderr } = await ffmpeg(['-nostats', '-i', file, '-map', '0:a:0', '-af', `silencedetect=noise=${noise}:d=${minDuration}`, '-f', 'null', '-']);
  return parseIntervals(stderr, 'silence', duration);
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
