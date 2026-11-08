#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { activeBrand, loadProfile } from './lib/brands.mjs';
import { availableFilters, ffmpeg, formatTime, mapLimit, parseIntervals, probe, round } from './lib/media.mjs';

const USAGE = `Usage: node scripts/verify-render.mjs <video.mp4> [--out <dir>] [--frames N] [--at t1,t2,...]
                                     [--transcript file.json] [--target-lufs -14] [--width 960]

Writes report.json, REPORT.md, frames/ and contact-sheet.jpg (default: <project>/qa/<stem>/ for renders/, else <dir>/qa/<stem>/).
Prints the verdict, report paths and frame paths (one per line). Exit 0 = pass/warn, 2 = fail, 1 = error.`;

const THRESHOLDS = {
  lufsTolerance: 1.5,
  maxTruePeak: -1,
  edgeBlackAllowance: 0.5,
  midBlackFail: 0.5,
  driftWarn: 0.2,
  driftFail: 1,
  stillRatio: 0.9,
};

const DETECTORS = {
  blackdetect: 'blackdetect=d=0.1:pix_th=0.10',
  freezedetect: 'freezedetect=n=0.003:d=2',
  silencedetect: 'silencedetect=noise=-45dB:d=1.2',
  ebur128: 'ebur128=peak=true:framelog=quiet',
};

const SHEET = { columns: 4, thumbWidth: 480, maxHeight: 1990, padding: 6 };
const FRAME_CONCURRENCY = 4;

function joinNegativeValues(argv) {
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (/^--[\w-]+$/.test(argv[i]) && /^-\d/.test(argv[i + 1] ?? '')) args.push(`${argv[i]}=${argv[++i]}`);
    else args.push(argv[i]);
  }
  return args;
}

function parseTimestamp(value) {
  const parts = String(value).trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) throw new Error(`Invalid timestamp "${value}" (use seconds or mm:ss.s)`);
  return parts.reduce((total, n) => total * 60 + n, 0);
}

function parseNumber(value, name, { min = -Infinity, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) throw new Error(`Invalid ${name}: ${value}`);
  return n;
}

function parseOptions(argv) {
  const { values, positionals } = parseArgs({
    args: joinNegativeValues(argv),
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      frames: { type: 'string', short: 'n' },
      at: { type: 'string', multiple: true },
      transcript: { type: 'string', short: 't' },
      'target-lufs': { type: 'string', default: '-14' },
      width: { type: 'string', short: 'w', default: '960' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  return {
    video: resolve(positionals[0]),
    out: values.out ? resolve(values.out) : null,
    frames: values.frames ? parseNumber(values.frames, '--frames', { min: 1, integer: true }) : null,
    at: (values.at ?? []).flatMap((v) => v.split(',')).filter((v) => v.trim()).map(parseTimestamp),
    transcript: values.transcript ? resolve(values.transcript) : null,
    targetLufs: parseNumber(values['target-lufs'], '--target-lufs'),
    width: parseNumber(values.width, '--width', { min: 64, integer: true }),
  };
}

function defaultOutDir(video) {
  const dir = dirname(video);
  const stem = basename(video, extname(video));
  return basename(dir) === 'renders' ? join(dir, '..', 'qa', stem) : join(dir, 'qa', stem);
}

const num = (value) => (value === undefined || value === null || value === '' || Number.isNaN(Number(value)) ? null : Number(value));

function parseRate(rate) {
  const [n, d] = String(rate ?? '').split('/').map(Number);
  return n && d ? n / d : null;
}

function summarizeProbe({ format = {}, streams = [] }) {
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === 'audio');
  const duration = num(format.duration) ?? num(v?.duration) ?? 0;
  const videoDuration = num(v?.duration);
  const audioDuration = num(a?.duration);
  return {
    duration: round(duration),
    container: format.format_name,
    sizeBytes: num(format.size),
    bitrate: num(format.bit_rate),
    video: v ? {
      codec: v.codec_name,
      profile: v.profile ?? null,
      width: v.width,
      height: v.height,
      fps: round(parseRate(v.avg_frame_rate) ?? parseRate(v.r_frame_rate), 3),
      pixelFormat: v.pix_fmt,
      bitrate: num(v.bit_rate),
      duration: round(videoDuration),
    } : null,
    audio: a ? {
      present: true,
      codec: a.codec_name,
      sampleRate: num(a.sample_rate),
      channels: a.channels,
      layout: a.channel_layout ?? null,
      bitrate: num(a.bit_rate),
      duration: round(audioDuration),
    } : { present: false },
    avDrift: videoDuration !== null && audioDuration !== null ? round(Math.abs(videoDuration - audioDuration)) : null,
  };
}

function parseLoudness(stderr) {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const pick = (label) => {
    const match = summary.match(new RegExp(`(?:^|\\s)${label}:\\s*(-?inf|-?[\\d.]+)`));
    return match && !match[1].endsWith('inf') ? Number(match[1]) : null;
  };
  return { integrated: pick('I'), truePeak: pick('Peak'), lra: pick('LRA') };
}

async function analyze(video, facts) {
  const filters = await availableFilters();
  const has = (name) => filters.has(name);
  const videoChain = ['blackdetect', 'freezedetect'].filter(has).map((f) => DETECTORS[f]);
  const audioChain = facts.audio.present ? ['silencedetect', 'ebur128'].filter(has).map((f) => DETECTORS[f]) : [];
  const skipped = Object.keys(DETECTORS).filter((f) => !has(f));
  const graph = [];
  const maps = [];
  if (videoChain.length) { graph.push(`[0:v:0]${videoChain.join(',')}[v]`); maps.push('-map', '[v]'); }
  if (audioChain.length) { graph.push(`[0:a:0]${audioChain.join(',')}[a]`); maps.push('-map', '[a]'); }
  const { stderr } = graph.length
    ? await ffmpeg(['-nostats', '-i', video, '-filter_complex', graph.join(';'), ...maps, '-f', 'null', '-'])
    : { stderr: '' };
  const intervals = (filter, kind) => (videoChain.includes(DETECTORS[filter]) || audioChain.includes(DETECTORS[filter])
    ? parseIntervals(stderr, kind, facts.duration)
    : null);
  return {
    black: intervals('blackdetect', 'black'),
    freeze: intervals('freezedetect', 'freeze'),
    silence: intervals('silencedetect', 'silence'),
    loudness: audioChain.includes(DETECTORS.ebur128) ? parseLoudness(stderr) : null,
    skipped,
  };
}

function loadTranscript(file) {
  if (!existsSync(file)) throw new Error(`Transcript not found: ${file}`);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const words = Array.isArray(doc) ? doc : doc.words;
  if (!Array.isArray(words)) throw new Error(`${file} has no words array`);
  return {
    file,
    duration: num(doc.audio_duration_secs),
    words: words.filter((w) => w?.text && Number.isFinite(w.start) && Number.isFinite(w.end)),
  };
}

function wordsBetween(words, from, to) {
  return words.filter((w) => w.end >= from && w.start <= to).map((w) => w.text).join(' ');
}

function frameTimes(duration, { frames, at }) {
  const count = frames ?? Math.min(40, Math.max(8, Math.round(duration / 3)));
  const grid = Array.from({ length: count }, (_, i) => ({ t: ((i + 0.5) * duration) / count, grid: true }));
  const extra = at.map((t) => ({ t, grid: false }));
  const seen = new Set();
  return [...grid, ...extra]
    .map((f) => ({ ...f, name: `f_${f.t.toFixed(2).padStart(7, '0')}s.jpg` }))
    .filter((f) => f.t >= 0 && f.t < duration && !seen.has(f.name) && seen.add(f.name))
    .sort((a, b) => a.t - b.t);
}

async function extractFrame(video, frame, dir, width) {
  const file = join(dir, frame.name);
  try {
    await ffmpeg([
      '-loglevel', 'error', '-ss', frame.t.toFixed(3), '-i', video, '-frames:v', '1',
      '-vf', `scale=w='min(${width},iw)':h=-2`, '-q:v', '4', '-update', '1', file,
    ]);
  } catch {}
  return { t: round(frame.t, 2), file, grid: frame.grid, ok: existsSync(file) };
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

function sheetGeometry(count, aspect) {
  const { columns, thumbWidth, maxHeight, padding } = SHEET;
  const rows = Math.ceil(count / columns);
  const fitHeight = Math.floor((maxHeight - 2 * padding - (rows - 1) * padding) / rows);
  const height = Math.min(even(thumbWidth / aspect), even(fitHeight - 1));
  return { columns, rows, width: even(height * aspect), height, padding };
}

async function buildContactSheet(frames, outDir, aspect) {
  if (!frames.length) return null;
  const list = join(outDir, 'contact-sheet.txt');
  const sheet = join(outDir, 'contact-sheet.jpg');
  const g = sheetGeometry(frames.length, aspect);
  const escapePath = (p) => p.replaceAll("'", "'\\''");
  writeFileSync(list, `ffconcat version 1.0\n${frames.map((f) => `file '${escapePath(f.file)}'`).join('\n')}\n`);
  try {
    await ffmpeg([
      '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `scale=${g.width}:${g.height},tile=${g.columns}x${g.rows}:padding=${g.padding}:margin=${g.padding}:color=0x202020`,
      '-frames:v', '1', '-q:v', '3', '-update', '1', sheet,
    ]);
  } finally {
    rmSync(list, { force: true });
  }
  return sheet;
}

const issue = (severity, check, detail, at) => ({ severity, check, detail, ...(at !== undefined ? { at: round(at, 2) } : {}) });

function probeIssues(facts) {
  const issues = [];
  const { video, audio, avDrift } = facts;
  if (!audio.present) issues.push(issue('warn', 'audio', 'No audio stream in the render.'));
  if (video.pixelFormat && video.pixelFormat !== 'yuv420p') {
    issues.push(issue('warn', 'format', `Pixel format ${video.pixelFormat}; use yuv420p for platform/player compatibility.`));
  }
  if (video.width % 2 || video.height % 2) issues.push(issue('warn', 'format', `Odd dimensions ${video.width}x${video.height}; encoders and platforms expect even sizes.`));
  if (avDrift !== null && avDrift > THRESHOLDS.driftWarn) {
    const severity = avDrift > THRESHOLDS.driftFail ? 'fail' : 'warn';
    issues.push(issue(severity, 'av-sync', `Audio and video stream durations differ by ${avDrift}s (video ${video.duration}s, audio ${audio.duration}s).`));
  }
  return issues;
}

function loudnessIssues(loudness, target) {
  if (!loudness) return [];
  const { integrated, truePeak } = loudness;
  const issues = [];
  const fix = `normalize in the final render, e.g. loudnorm=I=${target}:TP=${THRESHOLDS.maxTruePeak}:LRA=11`;
  if (integrated === null || integrated <= -69) {
    issues.push(issue('fail', 'loudness', 'Audio is silent (no measurable loudness).'));
  } else {
    if (Math.abs(integrated - target) > THRESHOLDS.lufsTolerance) {
      issues.push(issue('warn', 'loudness', `Integrated ${integrated} LUFS vs target ${target} ±${THRESHOLDS.lufsTolerance}; ${fix}.`));
    }
  }
  if (truePeak !== null && truePeak > THRESHOLDS.maxTruePeak) {
    const severity = truePeak > 0 ? 'fail' : 'warn';
    issues.push(issue(severity, 'true-peak', `True peak ${truePeak} dBTP exceeds ${THRESHOLDS.maxTruePeak} dBTP${truePeak > 0 ? ' (clipping)' : ''}; ${fix}.`));
  }
  return issues;
}

function blackIssues(black, facts) {
  const frame = facts.video.fps ? 1 / facts.video.fps : 0.04;
  return (black ?? []).flatMap((b) => {
    const atEdge = b.start <= frame + 0.05 || b.end >= facts.duration - frame - 0.1;
    if (atEdge && b.duration <= THRESHOLDS.edgeBlackAllowance) return [];
    const where = atEdge ? (b.start <= frame + 0.05 ? 'at the start' : 'at the end') : 'mid-video';
    const severity = !atEdge && b.duration >= THRESHOLDS.midBlackFail ? 'fail' : 'warn';
    const hint = atEdge ? 'trim or shorten it' : 'likely a gap/missing clip or a dip-to-black; check the frames around it';
    return [issue(severity, 'black-frames', `Black ${b.duration}s ${where} (${formatTime(b.start)}–${formatTime(b.end)}); ${hint}.`, b.start)];
  });
}

function freezeIssues(freeze, facts) {
  return (freeze ?? []).map((f) => {
    const still = f.duration >= facts.duration * THRESHOLDS.stillRatio;
    const detail = still
      ? `Video is frozen for ${f.duration}s of ${facts.duration}s — the render is effectively a still image.`
      : `Frozen video ${f.duration}s (${formatTime(f.start)}–${formatTime(f.end)}); fine for slides/stills, broken if a speaker is on screen.`;
    return issue(still ? 'fail' : 'warn', 'frozen-video', detail, f.start);
  });
}

function silenceContext(words, s) {
  if (!words?.length) return '';
  const before = words.filter((w) => w.end <= s.start + 0.3).at(-1);
  const after = words.find((w) => w.start >= s.end - 0.3);
  const parts = [before && `after "${before.text}"`, after && `before "${after.text}"`].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function silenceIssues(silence, facts, transcript) {
  return (silence ?? []).map((s) => {
    const mostly = s.duration >= facts.duration * THRESHOLDS.stillRatio;
    const detail = mostly
      ? `Audio is silent for ${s.duration}s of ${facts.duration}s.`
      : `Dead air ${s.duration}s (${formatTime(s.start)}–${formatTime(s.end)})${silenceContext(transcript?.words, s)}; cut or cover it unless intentional.`;
    return issue(mostly ? 'fail' : 'warn', 'silence', detail, s.start);
  });
}

function transcriptIssues(transcript, facts) {
  if (!transcript) return [];
  const issues = [];
  if (transcript.duration !== null && Math.abs(transcript.duration - facts.duration) > 0.5) {
    issues.push(issue('warn', 'transcript', `Transcript is for ${transcript.duration}s of audio but the render is ${facts.duration}s; it is probably the source transcript, so caption-sync hints are unreliable. Transcribe the render for sync checks.`));
  }
  const late = transcript.words.filter((w) => w.start > facts.duration + 0.25);
  if (late.length) issues.push(issue('warn', 'transcript', `${late.length} transcript words start after the render ends (${facts.duration}s).`, late[0].start));
  return issues;
}

function frameIssues(frames, requested) {
  const missing = frames.filter((f) => !f.ok);
  const outside = requested.at.filter((t) => t < 0 || t >= requested.duration);
  return [
    ...missing.map((f) => issue('warn', 'frames', `Could not extract a frame at ${f.t}s.`, f.t)),
    ...outside.map((t) => issue('warn', 'frames', `--at ${t}s is outside the video (0–${requested.duration}s); skipped.`)),
  ];
}

function verdictOf(issues) {
  if (issues.some((i) => i.severity === 'fail')) return 'fail';
  return issues.some((i) => i.severity === 'warn') ? 'warn' : 'pass';
}

const fmt = (value, unit = '') => (value === null || value === undefined ? '—' : `${value}${unit}`);
const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

function intervalTable(title, intervals) {
  if (intervals === null) return `**${title}:** check skipped (filter unavailable)`;
  if (!intervals.length) return `**${title}:** none`;
  return `**${title}:** ${intervals.map((i) => `${formatTime(i.start)}–${formatTime(i.end)} (${i.duration}s)`).join(', ')}`;
}

function brandLine() {
  const slug = activeBrand();
  if (!slug) return 'No active brand; use the brand named in the project brief.';
  const name = loadProfile(slug)?.identity?.name ?? slug;
  return `Active brand: **${name}** — compare colors, fonts and logo against \`brands/${slug}/profile.json\` and its assets.`;
}

function renderMarkdown(report, outDir) {
  const { probe: p, loudness: l, analysis: a, issues, frames } = report;
  const rel = (file) => relative(outDir, file);
  const issueRows = issues.length
    ? ['| Severity | Check | At | Detail |', '| --- | --- | --- | --- |', ...issues.map((i) => `| ${i.severity.toUpperCase()} | ${i.check} | ${i.at !== undefined ? formatTime(i.at) : '—'} | ${cell(i.detail)} |`)].join('\n')
    : 'No automated issues found.';
  const frameLines = frames.map((f) => `- \`${f.file}\` — ${formatTime(f.t)}${f.grid ? '' : ' (requested)'}${f.hears ? ` — hears: “${f.hears}”` : ''}${f.ok ? '' : ' — MISSING'}`);
  const sheetOrder = frames.filter((f) => f.grid && f.ok).map((f) => formatTime(f.t)).join(', ');

  return `# Render QA — ${basename(report.video)}

**Verdict: ${report.verdict.toUpperCase()}** · ${p.duration}s · ${p.video.width}×${p.video.height} @ ${fmt(p.video.fps)} fps · ${p.video.codec}/${p.audio.codec ?? 'no audio'} · ${report.generatedAt}

Video: \`${report.video}\`

## Issues

${issueRows}

## Media facts

| Property | Value |
| --- | --- |
| Duration | ${p.duration}s (video ${fmt(p.video.duration, 's')}, audio ${fmt(p.audio.duration, 's')}, drift ${fmt(p.avDrift, 's')}) |
| Resolution | ${p.video.width}×${p.video.height} |
| Frame rate | ${fmt(p.video.fps)} fps |
| Video codec | ${p.video.codec}${p.video.profile ? ` (${p.video.profile})` : ''}, ${p.video.pixelFormat} |
| Bitrate | ${p.bitrate ? `${round(p.bitrate / 1e6, 2)} Mb/s` : '—'} |
| Audio | ${p.audio.present ? `${p.audio.codec}, ${p.audio.sampleRate} Hz, ${p.audio.channels} ch` : 'none'} |
| Container | ${p.container} |

## Loudness

${l ? `Integrated **${fmt(l.integrated, ' LUFS')}** (target ${report.target.lufs} ±${THRESHOLDS.lufsTolerance}) · true peak **${fmt(l.truePeak, ' dBTP')}** (max ${THRESHOLDS.maxTruePeak}) · LRA ${fmt(l.lra, ' LU')}` : 'Not measured (no audio or ebur128 unavailable).'}

## Detected intervals

- ${intervalTable('Black (d≥0.1s, pix_th 0.10)', a.black)}
- ${intervalTable('Frozen (n 0.003, d≥2s)', a.freeze)}
- ${intervalTable('Silence (−45 dB, d≥1.2s)', a.silence)}
${a.skipped.length ? `\nSkipped (filter unavailable in this ffmpeg): ${a.skipped.join(', ')}\n` : ''}
## Frames

${report.contactSheet ? `Contact sheet: \`${report.contactSheet}\` — ${SHEET.columns} columns, left→right, top→bottom at ${sheetOrder}.\n\n` : ''}${frameLines.join('\n')}

## Visual review checklist for Claude

Read \`${report.contactSheet ? rel(report.contactSheet) : 'frames/'}\` first for the overview, then every frame above. For each frame check:

- [ ] Faces and key subjects are not cropped, cut off at the eyes/chin, or covered by graphics, captions or logos.
- [ ] All text is legible (size, weight, contrast against the background) and sits inside the 90% title-safe area (5% margin on every edge).
- [ ] No overflow or clipping: titles, lower thirds and captions fit their boxes; no cut-off or wrapped-off words.
- [ ] Brand colors and fonts are used; no fallback/system fonts, no off-palette colors. ${brandLine()}
- [ ] Captions match what is being said at that moment (compare with the "hears" text when a transcript was given) and appear/disappear in sync.
- [ ] No black flashes, blank frames or glitches at transitions (cross-check the black intervals above).
- [ ] Logo is the correct asset and version, correctly placed, not stretched, blurry or pixelated.
- [ ] Framing and aspect ratio suit the target platform; no letterboxing, stretching or unintended zoom.

Record each problem with its timestamp (it is in the frame filename), fix it in the edit, re-render, and run this check again.
`;
}

function printSummary(report, outDir) {
  const counts = ['fail', 'warn'].map((s) => `${report.issues.filter((i) => i.severity === s).length} ${s}`).join(', ');
  console.log(`verdict: ${report.verdict} (${counts})`);
  console.log(join(outDir, 'REPORT.md'));
  console.log(join(outDir, 'report.json'));
  if (report.contactSheet) console.log(report.contactSheet);
  for (const f of report.frames) if (f.ok) console.log(f.file);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!existsSync(options.video)) throw new Error(`File not found: ${options.video}`);
  const facts = summarizeProbe(await probe(options.video));
  if (!facts.video) throw new Error(`${options.video} has no video stream`);
  if (!facts.duration) throw new Error(`Could not read the duration of ${options.video}`);
  const transcript = options.transcript ? loadTranscript(options.transcript) : null;

  const outDir = options.out ?? resolve(defaultOutDir(options.video));
  const framesDir = join(outDir, 'frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  const [analysis, frames] = await Promise.all([
    analyze(options.video, facts),
    mapLimit(frameTimes(facts.duration, options), FRAME_CONCURRENCY, (f) => extractFrame(options.video, f, framesDir, options.width)),
  ]);
  if (transcript) for (const f of frames) f.hears = wordsBetween(transcript.words, f.t - 1, f.t + 1) || null;
  const aspect = facts.video.width / facts.video.height;
  const contactSheet = await buildContactSheet(frames.filter((f) => f.grid && f.ok), outDir, aspect).catch(() => null);

  const issues = [
    ...probeIssues(facts),
    ...loudnessIssues(analysis.loudness, options.targetLufs),
    ...blackIssues(analysis.black, facts),
    ...freezeIssues(analysis.freeze, facts),
    ...silenceIssues(analysis.silence, facts, transcript),
    ...transcriptIssues(transcript, facts),
    ...frameIssues(frames, { at: options.at, duration: facts.duration }),
    ...(contactSheet ? [] : [issue('warn', 'frames', 'Contact sheet could not be built.')]),
    ...analysis.skipped.map((f) => issue('warn', 'tooling', `ffmpeg filter "${f}" unavailable; that check was skipped.`)),
  ].sort((a, b) => (a.severity === b.severity ? (a.at ?? 0) - (b.at ?? 0) : a.severity === 'fail' ? -1 : 1));

  const report = {
    video: options.video,
    generatedAt: new Date().toISOString(),
    verdict: verdictOf(issues),
    issues,
    probe: facts,
    loudness: analysis.loudness,
    target: { lufs: options.targetLufs, lufsTolerance: THRESHOLDS.lufsTolerance, maxTruePeak: THRESHOLDS.maxTruePeak },
    analysis: { black: analysis.black, freeze: analysis.freeze, silence: analysis.silence, skipped: analysis.skipped },
    transcript: transcript ? { file: transcript.file, duration: transcript.duration, words: transcript.words.length } : null,
    contactSheet,
    frames: frames.map(({ t, file, grid, ok, hears }) => ({ t, file, grid, ok, ...(hears !== undefined ? { hears } : {}) })),
  };

  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'REPORT.md'), renderMarkdown(report, outDir));
  printSummary(report, outDir);
  process.exitCode = report.verdict === 'fail' ? 2 : 0;
}

main().catch((error) => {
  console.error(`verify-render: ${error.message}`);
  process.exitCode = 1;
});
