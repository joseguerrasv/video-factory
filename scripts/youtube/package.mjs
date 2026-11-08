#!/usr/bin/env node
// YouTube packaging for a finished long-form video: find the final render + subtitles, prepare the transcript
// that titles and thumbnails must quote from, and report where the package stands (titles → pick → thumbnails →
// export → approval) with the exact next step. Writes <project>/PACKAGE.md. The creative steps are the
// youtube-titles and youtube-thumbnail skills; this script is the checklist that ties them together.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, brandDir, projectDir } from '../lib/paths.mjs';
import { activeBrand } from '../lib/brands.mjs';
import { brandAvoid, checkTitle, numbersIn, titlesFromText } from './check-titles.mjs';

const USAGE = `Usage: node scripts/youtube/package.mjs <project-slug|dir> [--video renders/final.mp4] [--json]

Finds the final render (newest renders/*.mp4 that isn't raw, a preview or a snapshot) and its .srt, writes
transcript-final.txt from the subtitles, and prints the package status plus the next step. Writes PACKAGE.md.`;

const SKIP = /(raw|preview|snap|snapshot|720p|notion|test)/i;

export function srtToText(srt) {
  return srt.split(/\r?\n/).filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !l.includes('-->')).join(' ').replace(/\s+/g, ' ').trim();
}

export function pickFinalVideo(dir) {
  const renders = join(dir, 'renders');
  if (!existsSync(renders)) return null;
  const mp4s = readdirSync(renders).filter((f) => f.endsWith('.mp4') && !SKIP.test(f))
    .map((f) => join(renders, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return mp4s[0] ?? null;
}

function duration(file) {
  try {
    const s = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  } catch { return null; }
}

export function packageStatus(dir, videoArg) {
  const video = videoArg ? resolve(videoArg) : pickFinalVideo(dir);
  const srt = video && [video.replace(/\.mp4$/, '.srt'), ...(existsSync(join(dir, 'renders')) ? readdirSync(join(dir, 'renders')).filter((f) => f.endsWith('.srt')).map((f) => join(dir, 'renders', f)) : [])].find(existsSync);
  const transcript = join(dir, 'transcript-final.txt');
  if (srt && (!existsSync(transcript) || statSync(transcript).mtimeMs < statSync(srt).mtimeMs)) writeFileSync(transcript, srtToText(readFileSync(srt, 'utf8')) + '\n');
  const source = existsSync(transcript) ? readFileSync(transcript, 'utf8') : null;

  const titlesFile = join(dir, 'titles.txt');
  const titles = existsSync(titlesFile) ? titlesFromText(readFileSync(titlesFile, 'utf8')) : [];
  const sourceNumbers = source ? numbersIn(source) : null;
  const avoid = brandAvoid(activeBrand());
  const checked = titles.map((t) => checkTitle(t, { sourceNumbers, avoid }));
  const titlePick = existsSync(join(dir, 'TITLE.txt')) ? readFileSync(join(dir, 'TITLE.txt'), 'utf8').trim() : null;

  const tdir = join(dir, 'thumbnails');
  const spec = existsSync(join(tdir, 'thumbs.json')) ? JSON.parse(readFileSync(join(tdir, 'thumbs.json'), 'utf8')) : null;
  const variants = spec?.variants ?? [];
  const missingImages = variants.filter((v) => v.image && !existsSync(join(ROOT, 'public', v.image))).map((v) => v.id);
  const exported = variants.filter((v) => existsSync(join(tdir, `thumb-${v.id}.jpg`))).map((v) => v.id);
  const approved = existsSync(join(tdir, 'APPROVED.json')) ? JSON.parse(readFileSync(join(tdir, 'APPROVED.json'), 'utf8')) : null;
  // delivery (finish-video / deliver-video): only when the brand has a delivery destination
  const brand = activeBrand();
  const hasDelivery = Boolean(brand && existsSync(join(brandDir(brand), 'delivery.json')));
  const delivered = existsSync(join(dir, 'DELIVERED.json')) ? JSON.parse(readFileSync(join(dir, 'DELIVERED.json'), 'utf8')) : null;
  const spend = existsSync(join(tdir, 'SPEND.jsonl')) ? readFileSync(join(tdir, 'SPEND.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

  const s = {
    project: basename(dir), video: video && relative(ROOT, video), srt: srt && relative(ROOT, srt), duration: video && duration(video),
    transcript: source ? relative(ROOT, transcript) : null, transcriptWords: source ? source.split(/\s+/).length : 0,
    titles: { count: titles.length, fail: checked.filter((c) => c.level === 'fail').map((c) => c.title), pick: titlePick },
    thumbnails: { variants: variants.map((v) => v.id), missingImages, exported, feedPreview: existsSync(join(tdir, 'feed-preview.png')), approved: approved?.approved ?? null },
    spendUsd: Number(spend.reduce((a, r) => a + (r.usd ?? 0), 0).toFixed(3)), paidImages: spend.length,
    delivery: hasDelivery ? { category: delivered?.category ?? null, files: delivered?.files?.length ?? 0, driveLink: delivered?.driveLink ?? null } : null,
  };
  const slug = s.project;
  s.next =
    !video ? { step: 'edit', say: 'No final render in renders/ yet: finish and verify the edit first.' }
    : !source ? { step: 'transcript', say: `No subtitles next to the render. Transcribe it: node scripts/transcribe.mjs ${s.video}` }
    : titles.length < 10 ? { step: 'titles', say: `Run the youtube-titles skill: 10 BAD/CLICKABLE pairs from ${s.transcript} into video-projects/${slug}/titles.txt.` }
    : s.titles.fail.length ? { step: 'titles', say: `Fix the failing titles (node scripts/youtube/check-titles.mjs --source ${s.transcript} --file video-projects/${slug}/titles.txt).` }
    : !titlePick ? { step: 'pick-title', say: `Pick the strongest title and write it to video-projects/${slug}/TITLE.txt.` }
    : variants.length < 3 ? { step: 'thumbnails', say: 'Run the youtube-thumbnail skill: 3 different formats, one dry-run cost list, one yes, then generate.' }
    : missingImages.length ? { step: 'generate', say: `Generate the missing images (${missingImages.join(', ')}) with scripts/youtube/generate-image.mjs --kind thumbnail.` }
    : exported.length < variants.length || !s.thumbnails.feedPreview ? { step: 'export', say: `node scripts/youtube/render-thumbnails.mjs ${slug}` }
    : !approved ? { step: 'approve', say: 'Send the user the title and the thumbnail JPGs + feed-preview.png; ask which goes up first.' }
    : hasDelivery && !delivered ? { step: 'deliver', say: `Run the deliver-video skill: read the Notion row's Category, then node scripts/youtube/deliver-drive.mjs ${slug} --category "<Category>" (dry run, then --yes).` }
    : hasDelivery && !delivered.driveLink ? { step: 'link', say: 'Get the Drive link once it syncs (xattr -p "com.google.drivefs.item-id#S" "<mp4>"), put it in the row\'s Video link and in DELIVERED.json.' }
    : hasDelivery && !delivered.notionVideoLink ? { step: 'notion', say: `Fill the Notion row: Video link = ${delivered.driveLink}; Transcript file = ${delivered.transcriptLink ?? '(the transcript\'s Drive link)'}; YouTube title, Title options, Thumbnail image (thumbnails.md → DELIVERY). Then set "notionVideoLink": "updated" and "notionTranscriptLink": "updated" in DELIVERED.json.` }
    : hasDelivery && delivered.transcriptLink !== undefined && !delivered.notionTranscriptLink ? { step: 'notion', say: `Put the transcript's Drive link (${delivered.transcriptLink ?? 'xattr on the transcript file'}) in the row's Transcript file, then set "notionTranscriptLink": "updated" in DELIVERED.json.` }
    : { step: 'done', say: `Finished: "${titlePick}" + thumbnails/thumb-${approved.approved}.jpg${hasDelivery ? `, delivered to Drive (${delivered.category}) and the Notion row` : ''}.` };
  return s;
}

function markdown(s) {
  const tick = (b) => (b ? '✓' : '·');
  return `# YouTube package: ${s.project}

| Step | Status |
| --- | --- |
| ${tick(s.video)} Final render | ${s.video ?? 'none'}${s.duration ? ` (${s.duration})` : ''} |
| ${tick(s.transcript)} Transcript (titles and thumbnails quote only this) | ${s.transcript ?? 'none'}${s.transcript ? `, ${s.transcriptWords} words, from ${s.srt}` : ''} |
| ${tick(s.titles.count >= 10 && !s.titles.fail.length)} Title pairs | ${s.titles.count}/10${s.titles.fail.length ? `, ${s.titles.fail.length} failing` : ''} |
| ${tick(s.titles.pick)} Title picked | ${s.titles.pick ?? '—'} |
| ${tick(s.thumbnails.variants.length >= 3 && !s.thumbnails.missingImages.length)} Thumbnails generated | ${s.thumbnails.variants.join(', ') || '—'}${s.thumbnails.missingImages.length ? ` (missing: ${s.thumbnails.missingImages.join(', ')})` : ''} |
| ${tick(s.thumbnails.feedPreview && s.thumbnails.exported.length)} Exported + feed preview | ${s.thumbnails.exported.join(', ') || '—'} |
| ${tick(s.thumbnails.approved)} Approved by the user | ${s.thumbnails.approved ?? '—'} |
${s.delivery ? `| ${tick(s.delivery.files)} Delivered to Drive (video, SRT, transcript) | ${s.delivery.category ? `${s.delivery.category}, ${s.delivery.files} files` : '—'} |
| ${tick(s.delivery.driveLink && s.next.step === 'done')} Notion row filled (Video link, title, thumbnail) | ${s.delivery.driveLink ?? '—'} |
` : ''}

Image spend: $${s.spendUsd} (${s.paidImages} paid images).

**Next:** ${s.next.say}
`;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { video: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help || !positionals[0]) { console.log(USAGE); return values.help ? 0 : 1; }
  const dir = existsSync(positionals[0]) ? resolve(positionals[0]) : projectDir(positionals[0]);
  if (!existsSync(dir)) { console.error(`No project at ${relative(ROOT, dir)}`); return 1; }
  const s = packageStatus(dir, values.video);
  const md = markdown(s);
  writeFileSync(join(dir, 'PACKAGE.md'), md);
  console.log(values.json ? JSON.stringify(s, null, 2) : md);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
