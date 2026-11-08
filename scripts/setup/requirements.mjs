import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../lib/paths.mjs';

const OS = process.platform;
const IS_WIN = OS === 'win32';

export const HYPERFRAMES_SKILLS = [
  'hyperframes', 'hyperframes-core', 'hyperframes-animation', 'hyperframes-cli', 'hyperframes-creative',
  'hyperframes-audio', 'hyperframes-keyframes', 'media-use',
  'talking-head-recut', 'embedded-captions', 'general-video', 'motion-graphics',
];
export const WATCH = { id: 'watch@claude-video', marketplace: 'bradautomates/claude-video', minVersion: '0.3.2' };
const REQUIRED_FILTERS = ['ebur128', 'blackdetect', 'freezedetect', 'silencedetect'];
const NVM_VERSION = 'v0.40.8';

function run(cmd, args = [], { timeout = 20000, cwd = ROOT } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, cwd, shell: IS_WIN, windowsHide: true });
  return { ok: !r.error && r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const which = (cmd) => {
  const r = run(IS_WIN ? 'where' : 'which', [cmd]);
  return r.ok ? r.out.split(/\r?\n/)[0].trim() : null;
};
const firstLine = (s) => s.split(/\r?\n/)[0].trim();

export function compareVersions(a = '0', b = '0') {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// fix kinds: auto = project-local, safe to run now; install = user or system package install, announce then run;
// manual = needs a password, GUI or new terminal, the user runs it; in-app = a slash command the user types in Claude.
const fix = (kind, commands, note) => ({ kind, commands: [].concat(commands).filter(Boolean), note });

const byOs = (map) => map[OS] ?? map.linux;

function nodeCheck() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    id: 'node', label: 'Node.js 22+', level: 'required', ok: major >= 22, detail: process.version,
    fix: byOs({
      darwin: fix('install', 'brew upgrade node || brew install node'),
      win32: fix('install', 'winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements', 'Restart Claude Code afterwards so the new PATH is picked up'),
      linux: fix('install', `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash && . "$HOME/.nvm/nvm.sh" && nvm install 22`, 'Installs Node 22 for this user with nvm, no sudo'),
    }),
  };
}

function homebrewCheck() {
  if (OS !== 'darwin') return null;
  const path = which('brew');
  return {
    id: 'homebrew', label: 'Homebrew (installs the tools below)', level: 'installer', ok: Boolean(path), detail: path,
    fix: fix('manual', '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', 'Run it in the Terminal app: it asks for your Mac password. Then come back to Claude.'),
  };
}

function wingetCheck() {
  if (!IS_WIN) return null;
  const path = which('winget');
  return {
    id: 'winget', label: 'winget (installs the tools below)', level: 'installer', ok: Boolean(path), detail: path,
    fix: fix('manual', null, 'Install "App Installer" from the Microsoft Store, then restart Claude Code.'),
  };
}

function ffmpegCheck() {
  const ff = which('ffmpeg');
  const fp = which('ffprobe');
  let detail = ff ? firstLine(run('ffmpeg', ['-version']).out) : 'not found';
  let missingFilters = [];
  if (ff) {
    const filters = run('ffmpeg', ['-hide_banner', '-filters']).out;
    missingFilters = REQUIRED_FILTERS.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters));
    if (missingFilters.length) detail += `; missing filters: ${missingFilters.join(', ')}`;
  }
  if (ff && !fp) detail += '; ffprobe not found';
  return {
    id: 'ffmpeg', label: 'ffmpeg and ffprobe', level: 'required', ok: Boolean(ff && fp && !missingFilters.length), detail,
    fix: byOs({
      darwin: fix('install', ff ? 'brew reinstall ffmpeg' : 'brew install ffmpeg'),
      win32: fix('install', 'winget install --id Gyan.FFmpeg --exact --accept-source-agreements --accept-package-agreements', 'Restart Claude Code afterwards so ffmpeg is on PATH'),
      linux: fix('manual', 'sudo apt install -y ffmpeg', 'Or the ffmpeg package for your distribution (dnf, pacman)'),
    }),
  };
}

function pythonCheck() {
  const cmd = IS_WIN ? 'python' : 'python3';
  const r = which(cmd) ? run(cmd, ['--version']) : { ok: false, out: '' };
  const version = r.out.match(/(\d+\.\d+\.\d+)/)?.[1];
  return {
    id: 'python', label: 'Python 3.10+ (used by the watch skill)', level: 'recommended',
    ok: Boolean(version && compareVersions(version, '3.10.0') >= 0), detail: version ?? 'not found',
    fix: byOs({
      darwin: fix('install', 'brew install python'),
      win32: fix('install', 'winget install --id Python.Python.3.12 --exact --accept-source-agreements --accept-package-agreements'),
      linux: fix('manual', 'sudo apt install -y python3'),
    }),
  };
}

function localPackagesCheck() {
  const want = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies ?? {};
  const have = (name) => {
    const file = join(ROOT, 'node_modules', name, 'package.json');
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).version : null;
  };
  const wrong = Object.entries(want).filter(([name, version]) => have(name) !== version);
  return {
    id: 'packages', label: 'HyperFrames CLI and GSAP (this folder)', level: 'required', ok: !wrong.length,
    detail: wrong.length ? `needs ${wrong.map(([n, v]) => `${n}@${v}`).join(', ')}` : Object.keys(want).map((n) => `${n}@${have(n)}`).join(', '),
    fix: fix('auto', 'npm install'),
  };
}

const hyperframesBin = () => join(ROOT, 'node_modules', '.bin', IS_WIN ? 'hyperframes.cmd' : 'hyperframes');

function browserCheck(packagesOk) {
  const r = packagesOk ? run(hyperframesBin(), ['browser', 'path'], { timeout: 30000 }) : { ok: false, out: '' };
  return {
    id: 'browser', label: 'Render browser (Chrome headless)', level: 'required', ok: r.ok,
    detail: r.ok ? firstLine(r.out.split(/\r?\n/).at(-1) ?? '') : packagesOk ? 'not downloaded' : 'checked after npm install',
    fix: fix('auto', 'npx hyperframes browser ensure', 'Downloads a private Chrome for rendering; no admin rights needed'),
  };
}

function hyperframesSkillsCheck() {
  const dir = join(homedir(), '.claude', 'skills');
  const missing = HYPERFRAMES_SKILLS.filter((s) => !existsSync(join(dir, s, 'SKILL.md')));
  return {
    id: 'hyperframes-skills', label: 'HyperFrames skills', level: 'required', ok: !missing.length,
    detail: missing.length ? `missing: ${missing.join(', ')}` : `${HYPERFRAMES_SKILLS.length} installed`,
    fix: fix('auto', 'npm run skills:update', 'Installs into ~/.claude/skills; new skills load in the next session'),
  };
}

function installedPlugins() {
  if (which('claude')) {
    const r = run('claude', ['plugin', 'list', '--json'], { timeout: 30000 });
    if (r.ok) {
      try { return { via: 'cli', list: JSON.parse(r.out.slice(r.out.indexOf('['))) }; } catch {}
    }
  }
  const file = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (!existsSync(file)) return { via: 'none', list: [] };
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const plugins = data.plugins ?? data;
    return { via: 'file', list: Object.entries(plugins).flatMap(([id, v]) => [].concat(v).map((i) => ({ id, ...i, enabled: true }))) };
  } catch {
    return { via: 'none', list: [] };
  }
}

function watchCheck() {
  const { via, list } = installedPlugins();
  const plugin = list.find((p) => p.id === WATCH.id);
  const hasCli = via === 'cli';
  const cli = (cmds) => fix('install', cmds, 'The plugin loads in the next session (or after /reload-plugins)');
  const inApp = (cmds) => fix('in-app', cmds, 'Type these in Claude, then /reload-plugins');
  let result;
  if (!plugin) {
    result = { ok: false, detail: 'not installed', fix: hasCli
      ? cli([`claude plugin marketplace add ${WATCH.marketplace}`, `claude plugin install ${WATCH.id}`])
      : inApp([`/plugin marketplace add ${WATCH.marketplace}`, `/plugin install ${WATCH.id}`]) };
  } else if (compareVersions(plugin.version, WATCH.minVersion) < 0) {
    result = { ok: false, detail: `${plugin.version} installed; ${WATCH.minVersion}+ fixes frame extraction on ffmpeg 9`, fix: hasCli
      ? fix('install', ['claude plugin marketplace update claude-video', `claude plugin update ${WATCH.id}`], 'Restart Claude afterwards to load the new version')
      : fix('in-app', [], 'Type /plugin in Claude, open the watch plugin and update it, then restart Claude') };
  } else if (plugin.enabled === false) {
    result = { ok: false, detail: `${plugin.version} installed but disabled`, fix: hasCli ? cli(`claude plugin enable ${WATCH.id}`) : inApp(`/plugin enable ${WATCH.id}`) };
  } else {
    result = { ok: true, detail: `${plugin.version}`, fix: null };
  }
  return { id: 'watch', label: 'watch skill (Claude watches videos: references and renders)', level: 'recommended', installPath: plugin?.installPath, ...result };
}

function watchDepsCheck(watch) {
  if (!watch.ok || !watch.installPath) return null;
  const setup = join(watch.installPath, 'skills', 'watch', 'scripts', 'setup.py');
  if (!existsSync(setup)) return null;
  const py = IS_WIN ? 'python' : 'python3';
  const r = run(py, [setup, '--json'], { timeout: 30000 });
  let status = null;
  try { status = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch {}
  const missing = status?.missing_binaries ?? [];
  return {
    id: 'watch-deps', label: 'watch skill dependencies (yt-dlp, ffmpeg)', level: 'recommended',
    ok: Boolean(status) && !missing.length, detail: status ? (missing.length ? `missing: ${missing.join(', ')}` : 'ready') : 'could not run its setup check',
    fix: fix('install', `${py} "${setup}"`, 'The watch installer adds yt-dlp and friends (Homebrew on macOS, printed commands elsewhere)'),
  };
}

function whisperCheck(transcription) {
  const found = which('whisper-cli') || which('whisper-cpp');
  const needed = transcription === 'local';
  return {
    id: 'whisper', label: 'whisper.cpp (local transcription)', level: needed ? 'required' : 'optional', ok: Boolean(found), detail: found ?? (needed ? 'not found' : 'only needed for the local provider'),
    fix: byOs({
      darwin: fix('install', 'brew install whisper-cpp'),
      win32: fix('manual', null, 'Pick a cloud transcription provider in /onboard-me, or build whisper.cpp from github.com/ggml-org/whisper.cpp'),
      linux: fix('manual', null, 'Build whisper.cpp from github.com/ggml-org/whisper.cpp, or pick a cloud provider'),
    }),
  };
}

export function checkSystem({ transcription } = {}) {
  const packages = localPackagesCheck();
  const watch = watchCheck();
  return [
    homebrewCheck(), wingetCheck(), nodeCheck(), ffmpegCheck(), packages, browserCheck(packages.ok),
    hyperframesSkillsCheck(), pythonCheck(), watch, watchDepsCheck(watch), whisperCheck(transcription),
  ].filter(Boolean);
}

export function buildPlan(checks) {
  const failing = checks.filter((c) => !c.ok && c.fix && c.level !== 'optional');
  const needsBrew = failing.some((c) => c.fix.commands.some((cmd) => cmd.startsWith('brew ')));
  const needsWinget = failing.some((c) => c.fix.commands.some((cmd) => cmd.startsWith('winget ')));
  return failing
    .filter((c) => c.level !== 'installer' || (c.id === 'homebrew' && needsBrew) || (c.id === 'winget' && needsWinget))
    .map((c) => ({ id: c.id, label: c.label, ...c.fix }));
}
