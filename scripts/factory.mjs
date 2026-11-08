#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, linkSync, copyFileSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { PATHS, ROOT, brandDir, projectDir } from './lib/paths.mjs';
import { listBrands, loadProfile, activeBrand, isSlug, readJson } from './lib/brands.mjs';
import { readState, writeState } from './lib/state.mjs';
import { appendLearning, entryText, readSections, KINDS } from './lib/learnings.mjs';
import { envStatus, SERVICE_KEYS } from './lib/env.mjs';
import { FORMAT_SPECS } from './onboarding/brand-kit.mjs';
import { checkSystem, buildPlan } from './setup/requirements.mjs';

const [command, ...rest] = process.argv.slice(2);
const positional = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1]?.startsWith('--') && !['--json', '--full', '--technical', '--apply'].includes(rest[i - 1])));
const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const has = (name) => rest.includes(`--${name}`);
const rel = (p) => relative(ROOT, p) || '.';
const fail = (msg) => { console.error(msg); process.exit(1); };

const PROVIDER_KEY = { elevenlabs: 'ELEVENLABS_API_KEY', groq: 'GROQ_API_KEY', openai: 'OPENAI_API_KEY', local: null };

function resolveBrand(explicit) {
  const slug = explicit ?? activeBrand();
  if (!slug) return null;
  if (!existsSync(brandDir(slug))) fail(`Unknown brand "${slug}". Known: ${listBrands().map((b) => b.slug).join(', ') || 'none'}`);
  return slug;
}

// ---------- context ----------
// Claude Code loads a hook's output only up to 10,000 characters and keeps a 2,000-character preview past that; no
// setting raises it. So the session-start context goes out in pages, one hook per page in .claude/settings.json.
// Hooks run in parallel, so pages can arrive in any order and each one names itself.
export const CONTEXT_PAGES = 5;
const PAGE_CHARS = 9500;

export function paginateContext(intro, sections, { maxPages = CONTEXT_PAGES, pageChars = PAGE_CHARS, moreIn = 'the learnings files' } = {}) {
  const room = pageChars - 200; // leaves space for the page title and the "more" line
  const entries = sections.flatMap(({ title, items }) => items.map((item) => ({ heading: `${title} (${items.length})`, item })));
  const pages = [[...intro]];
  let section;
  for (const [i, { heading, item }] of entries.entries()) {
    const fresh = heading !== section;
    const head = fresh ? ['', `## ${heading}`] : [];
    if ([...pages.at(-1), ...head, item].join('\n').length > room) {
      if (pages.length === maxPages) {
        pages.at(-1).push(`- ...${entries.length - i} more in ${moreIn}`);
        break;
      }
      pages.push([`## ${heading}${fresh ? '' : ', continued'}`, item]);
    } else {
      pages.at(-1).push(...head, item);
    }
    section = heading;
  }
  return pages.map((lines, i) => [`# Video Factory context${pages.length > 1 ? `, page ${i + 1} of ${pages.length}` : ''}`, '', ...lines].join('\n'));
}

export function contextPages({ brand: explicit, project, full = false } = {}) {
  const state = readState();
  const slug = explicit ?? activeBrand();
  if (!slug) return paginateContext(['No brand is set up yet. Before editing anything, run the `onboard-me` skill (/onboard-me) so edits follow a real brand kit.'], []);
  const p = loadProfile(slug);
  if (!p) return paginateContext([`Brand "${slug}" exists but has no profile.json. Run \`node scripts/onboarding/generate.mjs ${slug}\` or /onboard-me.`], []);
  const env = envStatus(SERVICE_KEYS);
  const providerKey = PROVIDER_KEY[p.services.transcription];
  const brands = listBrands().filter((b) => b.ready);
  const e = p.editing;
  const lines = [
    `Active brand: **${p.identity.name}** (brands/${slug}/)${brands.length > 1 ? `. Other brands: ${brands.filter((b) => b.slug !== slug).map((b) => b.slug).join(', ')}` : ''}`,
    `Read before editing: BRAND.md (voice), frame.md (visual tokens, source of truth), profile.json (settings), learnings.md.`,
    '',
    `- Formats: ${p.formats.selected.join(', ')} (primary ${p.formats.primary}), export ${p.formats.quality}`,
    `- Pacing: ${e.pacing.label} (cut-silences --gap ${e.cutSilences.gap} --head-pad ${e.cutSilences.headPad} --tail-pad ${e.cutSilences.tailPad}); fillers ${e.cutMistakes.fillers ? 'cut' : 'keep'}, retakes ${e.cutMistakes.retakes ? 'cut' : 'keep'}`,
    `- Captions: ${e.captions.style}${e.captions.style !== 'none' ? ` (${e.captions.position})` : ''}. Motion: ${e.motion.intensity}. B-roll: ${e.broll.density} from ${e.broll.sources.join(', ') || 'none'}. Camera: ${e.faceTreatments.join(', ') || 'no treatments'}`,
    `- Music: ${e.music.mood}${e.music.mood !== 'none' ? ` (${e.music.source}, duck ${e.music.duckUnderVoiceDb} dB under voice)` : ''}. SFX: ${e.sfx}. Transitions: ${e.transitions}. Loudness ${e.audio.targetLufs} LUFS`,
    `- Workflow: ${p.workflow.autonomy}; stop for ${p.workflow.checkpoints.join(', ') || 'nothing'}. Paid generation: ${p.services.spend.mode}${p.services.spend.capUsd ? ` (cap $${p.services.spend.capUsd}/video)` : ''}. Deliver: ${p.workflow.deliverables.join(', ')}`,
    `- Transcription: ${p.services.transcription}${providerKey ? ` (${providerKey} ${env[providerKey] ? 'set' : 'MISSING'})` : ''}. Kie.ai ${env.KIE_API_KEY ? 'set' : 'not set'}, ElevenLabs ${env.ELEVENLABS_API_KEY ? 'set' : 'not set'}, Pexels ${env.PEXELS_API_KEY ? 'set' : 'not set'}`,
  ];

  const projectSlug = project ?? state.activeProject;
  const proj = projectSlug && readJson(join(projectDir(projectSlug), 'project.json'));
  if (proj) {
    lines.push('', `Active project: video-projects/${projectSlug}/ (${proj.format}, brand ${proj.brand}, status ${proj.status}, feedback rounds ${proj.rounds ?? 0}). Log every correction with \`node scripts/factory.mjs feedback "..."\`.`);
  }

  const s = readSections(slug);
  const t = readSections('technical');
  const total = s.rule.length + s.avoid.length + s.win.length;
  if (total > 80) lines.push('', `learnings.md has ${total} entries. Consolidate duplicates and merge overlapping rules soon.`);
  const moreIn = `brands/${slug}/learnings.md and learnings/technical.md`;
  if (!full) {
    lines.push('', `Entries are newest first, without their dates and reasons: those are in ${moreIn}, or run \`node scripts/factory.mjs context --full\`. If two entries disagree, the newer one wins, and frame.md beats both on color, type and motion timing. Pages load together and can arrive in any order; for a missing one run \`node scripts/factory.mjs context --page <n>\`.`);
  }
  const sections = [
    [`${p.identity.name}: never again`, s.avoid],
    ['Technical: never again', t.avoid],
    [`${p.identity.name}: rules from feedback`, s.rule],
    ['Technical: rules', t.rule],
    [`${p.identity.name}: what works`, s.win],
  ].map(([title, items]) => ({ title, items: full ? items : items.map(entryText) }));
  return full ? paginateContext(lines, sections, { maxPages: 1, pageChars: Infinity }) : paginateContext(lines, sections, { moreIn });
}

export function contextText({ page = 1, ...options } = {}) {
  return contextPages(options)[page - 1] ?? '';
}

// ---------- brand ----------
function brandCommand() {
  const [sub, slugArg] = positional;
  if (!sub || sub === 'list') {
    const active = activeBrand();
    const brands = listBrands();
    if (!brands.length) return console.log('No brands yet. Run /onboard-me.');
    for (const b of brands) console.log(`${b.slug === active ? '*' : ' '} ${b.slug.padEnd(24)} ${b.name}${b.ready ? '' : '  (onboarding not generated)'}`);
    return;
  }
  if (sub === 'use') {
    if (!isSlug(slugArg) || !existsSync(brandDir(slugArg))) fail(`Unknown brand "${slugArg}".`);
    writeState({ activeBrand: slugArg, activeProject: null });
    return console.log(`Active brand: ${slugArg}`);
  }
  if (sub === 'show') {
    const slug = resolveBrand(slugArg);
    if (!slug) fail('No active brand.');
    return console.log(JSON.stringify(loadProfile(slug), null, 2));
  }
  fail('Usage: factory brand [list | use <slug> | show [slug]]');
}

// ---------- learn ----------
function learnCommand() {
  const [kind, ...words] = positional;
  const text = words.join(' ').trim();
  if (!KINDS[kind] || !text) fail('Usage: factory learn <rule|avoid|win> "what was learned" [--why "reason"] [--project slug] [--brand slug] [--technical]');
  const scope = has('technical') ? 'technical' : resolveBrand(opt('brand'));
  if (!scope) fail('No active brand. Pass --brand <slug> or --technical.');
  const project = opt('project') ?? readState().activeProject ?? undefined;
  const result = appendLearning({ scope, kind, text, why: opt('why'), project: scope === 'technical' ? undefined : project });
  console.log(result.added ? `Learned (${kind}, ${scope}): ${text}` : `Already known, not duplicated: ${text}`);
}

// ---------- feedback ----------
function feedbackCommand() {
  const text = positional.join(' ').trim();
  const slug = opt('project') ?? readState().activeProject;
  if (!text) fail('Usage: factory feedback "verbatim user feedback" [--project slug]');
  if (!slug || !existsSync(projectDir(slug))) fail('No active project. Pass --project <slug>.');
  const metaFile = join(projectDir(slug), 'project.json');
  const meta = readJson(metaFile, {});
  const round = (meta.rounds ?? 0) + 1;
  const file = join(projectDir(slug), 'FEEDBACK.md');
  const now = new Date();
  const stamp = `${now.toLocaleDateString('en-CA')} ${now.toTimeString().slice(0, 5)}`;
  const entry = `\n## Round ${round} (${stamp})\n\n> ${text.replace(/\n/g, '\n> ')}\n\nChanges made:\n- \n\nLearned:\n- \n`;
  writeFileSync(file, (existsSync(file) ? readFileSync(file, 'utf8') : `# ${slug}: feedback log\n`) + entry);
  writeFileSync(metaFile, JSON.stringify({ ...meta, rounds: round, status: 'revising', updatedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Logged round ${round} in ${rel(file)}. After fixing, fill in "Changes made" and "Learned", and record durable lessons with factory learn.`);
}

// ---------- new-video ----------
function linkOrCopy(src, dest) {
  try { linkSync(src, dest); return 'hardlink'; } catch { copyFileSync(src, dest); return 'copy'; }
}

function newVideoCommand() {
  const [slug] = positional;
  if (!isSlug(slug)) fail('Usage: factory new-video <kebab-slug> --source <file> [--format youtube|shorts|course|podcast|ads|showreel|social|events] [--brand slug]');
  const brand = resolveBrand(opt('brand'));
  if (!brand) fail('No active brand. Run /onboard-me first.');
  const profile = loadProfile(brand);
  if (!profile) fail(`Brand ${brand} has no profile.json. Run: node scripts/onboarding/generate.mjs ${brand}`);
  const format = opt('format') ?? profile.formats.primary;
  const spec = profile.formats.specs?.[format] ?? { ...FORMAT_SPECS[format], fps: 30, renderScale: 1 };
  if (!spec?.width) fail(`Unknown format "${format}".`);

  const sourceArg = opt('source');
  const source = sourceArg && [resolve(sourceArg), join(PATHS.inbox, sourceArg)].find((p) => existsSync(p) && statSync(p).isFile());
  if (sourceArg && !source) fail(`Source not found: ${sourceArg}`);

  const dest = projectDir(slug);
  if (existsSync(dest)) fail(`Project already exists: video-projects/${slug}`);
  mkdirSync(dest, { recursive: true });
  for (const dir of ['assets', 'compositions', 'renders', 'qa']) mkdirSync(join(dest, dir), { recursive: true });
  copyFileSync(join(PATHS.starter, 'hyperframes.json'), join(dest, 'hyperframes.json'));

  const warnings = [];
  const gsap = join(ROOT, 'node_modules/gsap/dist/gsap.min.js');
  if (existsSync(gsap)) copyFileSync(gsap, join(dest, 'assets/gsap.min.js'));
  else warnings.push('gsap not installed; run npm install, then copy node_modules/gsap/dist/gsap.min.js into assets/.');

  const bdir = brandDir(brand);
  copyFileSync(join(bdir, 'frame.md'), join(dest, 'frame.md'));
  mkdirSync(join(dest, 'brand'), { recursive: true });
  copyFileSync(join(bdir, 'tokens.css'), join(dest, 'brand/tokens.css'));
  if (existsSync(join(bdir, 'assets'))) cpSync(join(bdir, 'assets'), join(dest, 'brand/assets'), { recursive: true });

  let sourceInfo = null;
  if (source) {
    const target = join(dest, 'assets', `raw${extname(source).toLowerCase()}`);
    const mode = linkOrCopy(source, target);
    sourceInfo = { original: isAbsolute(sourceArg) ? source : rel(source), file: rel(target), mode };
  }

  const width = spec.width * (spec.renderScale ?? 1);
  const height = spec.height * (spec.renderScale ?? 1);
  writeFileSync(join(dest, 'meta.json'), JSON.stringify({ id: slug, name: slug, width, height, fps: spec.fps ?? 30 }, null, 2) + '\n');
  const project = {
    slug, brand, format, skill: spec.skill ?? 'edit-video',
    canvas: { width, height, fps: spec.fps ?? 30, aspect: spec.aspect },
    source: sourceInfo,
    status: 'created', rounds: 0,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(dest, 'project.json'), JSON.stringify(project, null, 2) + '\n');
  writeFileSync(join(dest, 'FEEDBACK.md'), `# ${slug}: feedback log\n\nEvery user correction is logged here verbatim (\`node scripts/factory.mjs feedback "..."\`), with what changed and what was learned.\n`);
  writeState({ activeBrand: brand, activeProject: slug });

  console.log(JSON.stringify({ ok: true, project: `video-projects/${slug}`, brand, format, canvas: project.canvas, skill: project.skill, source: sourceInfo, warnings }, null, 2));
}

// ---------- doctor ----------
const MARK = { required: 'FAIL', recommended: 'TODO', installer: 'TODO', setup: 'TODO', optional: 'skip' };

function setupChecks(profile) {
  const env = envStatus(SERVICE_KEYS);
  const checks = [{ id: 'brand', label: 'Brand configured', level: 'setup', ok: Boolean(profile), detail: profile ? `active: ${profile.slug}` : null, fix: { kind: 'in-app', commands: ['/onboard-me'] } }];
  if (!profile) return checks;
  const keyCheck = (key, label, note) => checks.push({ id: key, label, level: 'setup', ok: env[key], fix: { kind: 'in-app', commands: [], note } });
  const key = PROVIDER_KEY[profile.services.transcription];
  if (key) keyCheck(key, `${key} for ${profile.services.transcription} transcription`, 'Add it in /onboard-me (Services step) or in .env');
  if (profile.services.generation.kie && profile.services.spend.mode !== 'never') keyCheck('KIE_API_KEY', 'KIE_API_KEY for AI assets', 'Add it in /onboard-me, or set paid generation to "never"');
  if (profile.services.generation.stock) keyCheck('PEXELS_API_KEY', 'PEXELS_API_KEY for stock B-roll', 'Free key at pexels.com/api');
  return checks;
}

function doctorCommand() {
  const brand = activeBrand();
  const profile = brand && loadProfile(brand);
  const system = checkSystem({ transcription: profile?.services?.transcription });
  const checks = [...system, ...setupChecks(profile)];
  const plan = buildPlan(system);
  const blocking = checks.filter((c) => !c.ok && c.level === 'required');

  if (has('json')) {
    return console.log(JSON.stringify({ ok: !blocking.length, platform: process.platform, checks, plan }, null, 2));
  }
  console.log(`Video Factory doctor (${process.platform})\n`);
  for (const c of checks) {
    console.log(`${c.ok ? 'ok  ' : MARK[c.level]}  ${c.label}${c.detail ? `  (${c.detail})` : ''}`);
  }
  if (plan.length) {
    console.log('\nSetup plan, in order:');
    plan.forEach((step, i) => {
      const how = { auto: 'run', install: 'install', manual: 'you run in Terminal', 'in-app': 'type in Claude' }[step.kind];
      console.log(`${i + 1}. ${step.label} [${how}]${step.commands.length ? `\n     ${step.commands.join('\n     ')}` : ''}${step.note ? `\n     ${step.note}` : ''}`);
    });
  }
  console.log(blocking.length ? `\n${blocking.length} required item(s) missing.` : profile ? '\nReady to edit.' : '\nTools ready. Run /onboard-me to set up a brand.');
  process.exitCode = blocking.length ? 1 : 0;
}

const COMMANDS = {
  context: () => console.log(contextText({ brand: opt('brand'), project: opt('project'), full: has('full'), page: Number(opt('page') ?? 1) })),
  brand: brandCommand,
  learn: learnCommand,
  feedback: feedbackCommand,
  'new-video': newVideoCommand,
  doctor: doctorCommand,
};

if (import.meta.url === `file://${process.argv[1]}` || basename(process.argv[1] ?? '') === 'factory.mjs') {
  const run = COMMANDS[command];
  if (!run) {
    console.log(`Video Factory CLI

  context [--brand s] [--project p] [--page n] [--full]   Brand + learnings, one page at a time (what Claude reads first)
  brand list | use <slug> | show [slug]         Manage brands
  learn <rule|avoid|win> "text" [--why ".."] [--technical] [--brand s] [--project p]
  feedback "verbatim correction" [--project p]  Log a feedback round on the active project
  new-video <slug> --source <file> [--format f] Create a project for the active brand
  doctor [--json]                               Check tools, skills, keys and brand; prints an install plan`);
    process.exit(command ? 1 : 0);
  }
  run();
}
