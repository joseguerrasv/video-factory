#!/usr/bin/env node
// Deliver a finished video to the brand's Drive folder for its Notion category (brands/<slug>/delivery.json).
// Claude reads the video's Notion row first and passes its Category here; the script never guesses a folder,
// never creates one, never overwrites, and is a dry run until --yes.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { activeBrand } from '../lib/brands.mjs';
import { ROOT, brandDir, projectDir } from '../lib/paths.mjs';
import { pickFinalVideo, srtToText } from './package.mjs';

// Files: the MP4 and SRT go to Ready/<category>/, the plain-text transcript to Ready/<category>/Transcripts/.
// Short-form (a vertical video, or --short) goes to Ready/<category>/<shortsFolder>/ instead, with
// its cover image (cover.png / cover.jpg next to the render or in the project root) beside it.
const USAGE = `Usage: node scripts/youtube/deliver-drive.mjs <project-slug|dir> --category "<Notion Category>"
         [--video renders/final.mp4] [--name "<file name without extension>"] [--short | --long]
         (default name: "<YYYY-MM-DD> <TITLE.txt>") [--brand <slug>] [--yes]

Vertical videos (height > width) are treated as short-form automatically; --short / --long override.

Category must be one of the keys in brands/<slug>/delivery.json → drive.categories (exactly as in Notion).
Without --yes it only prints what it would copy and where.`;

// Finder tag "edited - claude" as a binary plist (same value the delivery steps have always written)
const TAG_HEX = '62706c6973743030a1015f100f656469746564202d20636c61756465080a000000000000010100000000000000020000000000000000000000000000001c';

export function resolveTarget(delivery, category, short = false) {
  const folder = delivery?.drive?.categories?.[category];
  if (!folder) return { error: `Unknown category "${category}". Known: ${Object.keys(delivery?.drive?.categories ?? {}).join(' | ') || 'none'}` };
  const root = delivery.drive.root.replace(/^~(?=\/)/, homedir());
  const sub = short ? (delivery.drive.shortsFolder ?? 'Shorts') : null;
  return { dir: sub ? join(root, folder, sub) : join(root, folder), folder: sub ? `${folder}/${sub}` : folder, categoryDir: join(root, folder) };
}

/** true when the video is vertical (short-form) */
export function isVertical(file) {
  try {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim().split(',').map(Number);
    return h > w;
  } catch { return false; }
}

function driveLink(file) {
  try {
    const id = execFileSync('xattr', ['-p', 'com.google.drivefs.item-id#S', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return id ? `https://drive.google.com/file/d/${id}/view` : null;
  } catch { return null; }
}

/** Drive assigns the file id once the upload starts; wait up to `seconds` for it. */
async function waitForLink(file, seconds = 900) {
  for (let i = 0; i < seconds / 5; i++) {
    const link = driveLink(file);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { category: { type: 'string' }, video: { type: 'string' }, name: { type: 'string' }, brand: { type: 'string' }, short: { type: 'boolean' }, long: { type: 'boolean' }, yes: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help || !positionals[0] || !values.category) { console.log(USAGE); return values.help ? 0 : 1; }
  const proj = existsSync(positionals[0]) ? resolve(positionals[0]) : projectDir(positionals[0]);
  const brand = values.brand ?? activeBrand();
  const cfgFile = brand && join(brandDir(brand), 'delivery.json');
  if (!cfgFile || !existsSync(cfgFile)) { console.error(`No delivery.json for brand "${brand}": nothing to deliver to.`); return 1; }
  const delivery = JSON.parse(readFileSync(cfgFile, 'utf8'));
  const video = values.video ? resolve(values.video) : pickFinalVideo(proj);
  if (!video || !existsSync(video)) { console.error('No final video found (pass --video).'); return 1; }
  const short = values.short ? true : values.long ? false : isVertical(video);
  const target = resolveTarget(delivery, values.category, short);
  if (target.error) { console.error(target.error); return 1; }
  if (!existsSync(target.dir)) { console.error(`Drive folder missing: ${target.dir} (is Google Drive for desktop running?). Not creating it.`); return 1; }
  const srt = [video.replace(/\.mp4$/, '.srt')].find(existsSync);
  // default name: "<date> <YouTube title>" from TITLE.txt (the youtube-package pick), else the render's name
  const titleFile = join(proj, 'TITLE.txt');
  const title = existsSync(titleFile) ? readFileSync(titleFile, 'utf8').trim() : null;
  const stem = values.name ?? (title ? `${new Date().toISOString().slice(0, 10)} ${title}`.replace(/[\/:*?"<>|]/g, '-') : basename(video, '.mp4'));
  const want = delivery.files ?? ['mp4'];
  const plan = [[video, join(target.dir, `${stem}.mp4`)], ...(want.includes('srt') && srt ? [[srt, join(target.dir, `${stem}.srt`)]] : [])];
  // short-form cover (a cover) rides along: cover.png|jpg next to the render, then in the project root
  const cover = short ? [video.replace(/\.mp4$/, '.cover.png'), video.replace(/\.mp4$/, '.cover.jpg'), join(proj, 'cover.png'), join(proj, 'cover.jpg')].find(existsSync) : null;
  if (cover) plan.push([cover, join(target.dir, `${stem} - cover${cover.slice(cover.lastIndexOf('.'))}`)]);
  // plain-text transcript (from the final cut's subtitles) → <category>/<transcriptFolder>/
  let transcript = null;
  if (want.includes('transcript')) {
    // shorts keep their transcript in the category's Transcripts/ folder (Shorts/ has none)
    const tdir = [join(target.dir, delivery.drive.transcriptFolder ?? 'Transcripts'), join(target.categoryDir, delivery.drive.transcriptFolder ?? 'Transcripts')].find(existsSync) ?? join(target.dir, delivery.drive.transcriptFolder ?? 'Transcripts');
    if (!existsSync(tdir)) { console.error(`Transcript folder missing: ${tdir}. Not creating it.`); return 1; }
    transcript = join(proj, 'transcript-final.txt');
    if (!existsSync(transcript) || (srt && statSync(transcript).mtimeMs < statSync(srt).mtimeMs)) {
      if (!srt) { console.error('No subtitles next to the video to build the transcript from (transcribe it first).'); return 1; }
      writeFileSync(transcript, srtToText(readFileSync(srt, 'utf8')) + '\n');
    }
    plan.push([transcript, join(tdir, `${stem} - transcript.txt`)]);
  }

  console.log(`Category: ${values.category}${short ? ' · SHORT-FORM' : ''} → Drive: YouTube Uploads/Ready/${target.folder}${transcript ? ` (+ transcript)` : ''}`);
  if (short && !cover) console.log('  (no cover image found: make one with a cover → cover.png)');
  for (const [from, to] of plan) console.log(`  ${relative(ROOT, from)}  (${(statSync(from).size / 1e6).toFixed(1)} MB)\n    → ${to}${existsSync(to) ? '   [ALREADY THERE, will not overwrite]' : ''}`);
  if (plan.some(([, to]) => existsSync(to))) { console.error('\nA file with that name is already in the folder. Pass --name for a new version (e.g. "... v2").'); return 1; }
  if (!values.yes) { console.log('\nDry run: nothing copied. Re-run with --yes.'); return 0; }

  for (const [from, to] of plan) {
    copyFileSync(from, to);
    if (delivery.finderTag) { try { execFileSync('xattr', ['-wx', 'com.apple.metadata:_kMDItemUserTags', TAG_HEX, to]); } catch { /* tag is cosmetic */ } }
  }
  const mp4 = plan[0][1];
  const txt = transcript ? plan.find(([from]) => from === transcript)[1] : null;
  console.log(`\nCopied ${plan.length} file(s). Waiting for Drive to sync the links…`);
  const link = await waitForLink(mp4);
  const transcriptLink = txt ? await waitForLink(txt) : null;
  writeFileSync(join(proj, short ? 'DELIVERED-short.json' : 'DELIVERED.json'), JSON.stringify({ at: new Date().toISOString(), category: values.category, short, folder: target.dir, files: plan.map(([, to]) => to), driveLink: link, transcriptLink }, null, 2) + '\n');
  console.log(`Video link:      ${link ?? 'not synced yet (xattr -p "com.google.drivefs.item-id#S" "<mp4>")'}`);
  if (txt) console.log(`Transcript file: ${transcriptLink ?? 'not synced yet (xattr -p "com.google.drivefs.item-id#S" "<transcript>")'}`);
  console.log('Next: put these in the Notion row: "Video link" and "Transcript file".');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
