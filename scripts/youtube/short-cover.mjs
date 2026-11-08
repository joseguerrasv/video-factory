#!/usr/bin/env node
// New Short / Reel thumbnail from the brand's fixed template: same structure, only the text changes.
// Seedream redraws the headline with the new words. Nothing below the headline is regenerated: the person, the
// yellow arc and the page come from base.png, and the real Skool wordmark comes from template.png.
// Paid: without --yes it only prints the plan and the cost. Every paid call is logged to <project>/thumbnails/SPEND.jsonl.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { activeBrand, readJson } from '../lib/brands.mjs';
import { ROOT, brandDir, projectDir } from '../lib/paths.mjs';

const USAGE = `Usage: node scripts/youtube/short-cover.mjs <project-slug|dir> --name cover-a1 --number "97%" --topic "Retention" [--lead "The"] [--yes]
       node scripts/youtube/short-cover.mjs <project-slug|dir> --name cover-a1 --finish <generated.png>

--number goes on the yellow blob, --lead before it, --topic after the skool wordmark.
Without --yes nothing is sent: it prints the plan and the cost. --yes makes one take with Seedream 5 Pro, 16.5 Kie
credits, saved to <project>/assets/cover/gen/<name>.png and logged to <project>/thumbnails/SPEND.jsonl.
--finish skips the model and puts an image you already have on the template. Both write <project>/renders/<name>.png.`;

const MODEL = 'seedream/5-pro-image-to-image';
const CREDITS = 16.5;
export const COVER = { width: 1080, height: 1920 };
// the white band between the swoosh and the cap: the headline stops here and the template's pixels take over
export const CUT = 975;
export const WORDMARK = { left: 52, top: 762, width: 406, height: 140 };

export function coverPrompt({ lead = 'The', number, topic }) {
  const swaps = [['The', lead], ['97%', number], ['Retention', topic]]
    .filter(([from, to]) => from !== to).map(([from, to]) => `"${from}" becomes "${to}"`);
  return [
    'Image 1 is the approved thumbnail. Keep it exactly: the pure white page, the position and size of every element, ' +
      'the black extra-heavy sans-serif, the slight slant on the first word, the hand-drawn bright yellow #FFEA00 ' +
      'highlighter blob behind the number with its three burst strokes at the top right, the tapered yellow swoosh ' +
      'under the last word, the man, his cap, his pose and the yellow semicircle. Image 2 is the real Skool wordmark: ' +
      'keep its lowercase letter shapes, colours and position.',
    `Change only the words: ${swaps.join(', ')}. Fit the blob snugly around the number. If a word is longer, scale it ` +
      'down to stay inside the same side margins, on the same line.',
    `The only text in the image is: ${lead}, ${number}, skool, ${topic}. Spell it exactly. The top of the frame stays ` +
      'empty white. No kicker, no extra words, no other graphics. One finished 9:16 thumbnail.',
  ].join('\n\n');
}

export async function finishCover({ generated, template, base, out }) {
  const { width, height } = COVER;
  // a generated page comes out at 254: this lands it on pure white, so the paste can't show
  const full = await sharp(generated).linear(1.02, 0).resize(width, height, { kernel: 'lanczos3' }).png().toBuffer();
  const headline = await sharp(full).extract({ left: 0, top: 0, width, height: CUT }).png().toBuffer();
  const wordmark = await sharp(template).extract(WORDMARK).png().toBuffer();
  await sharp(base).composite([
    { input: headline, left: 0, top: 0 },
    { input: wordmark, left: WORDMARK.left, top: WORDMARK.top },
  ]).png({ compressionLevel: 9 }).toFile(out);
  const edge = await sharp(full).extract({ left: 0, top: CUT - 1, width, height: 1 }).png().toBuffer();
  const { channels } = await sharp(edge).stats();
  return { crossesCut: Math.min(...channels.slice(0, 3).map((c) => c.min)) < 235 };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: 'string' }, number: { type: 'string' }, topic: { type: 'string' },
      lead: { type: 'string', default: 'The' }, finish: { type: 'string' },
      yes: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !positionals[0] || !values.name || !(values.finish || (values.number && values.topic))) {
    console.log(USAGE); return values.help ? 0 : 1;
  }
  const proj = existsSync(positionals[0]) ? resolve(positionals[0]) : projectDir(positionals[0]);
  const brand = readJson(join(proj, 'project.json'))?.brand ?? activeBrand();
  const kit = join(brandDir(brand), 'assets', 'short-cover');
  const [template, base, wordmark] = ['template.png', 'base.png', 'skool-wordmark.png'].map((f) => join(kit, f));
  for (const f of [template, base, wordmark]) if (!existsSync(f)) { console.error(`Template file not found: ${relative(ROOT, f)}`); return 1; }
  const out = join(proj, 'renders', `${values.name}.png`);
  if (existsSync(out)) { console.error(`${relative(ROOT, out)} exists; pick a new --name (thumbnails are never overwritten).`); return 1; }

  let generated = values.finish && resolve(values.finish);
  if (generated && !existsSync(generated)) { console.error(`Image not found: ${generated}`); return 1; }
  if (!generated) {
    const prompt = coverPrompt(values);
    generated = join(proj, 'assets', 'cover', 'gen', `${values.name}.png`);
    console.log(`Model:    ${MODEL}, 9:16, one take, ${CREDITS} Kie credits`);
    console.log(`Output:   ${relative(ROOT, out)}`);
    console.log(`Prompt:   ${prompt.replace(/\n+/g, ' ')}`);
    if (!values.yes) { console.log('\nDry run: nothing sent. Re-run with --yes to make the take.'); return 0; }
    if (existsSync(generated)) { console.error(`${relative(ROOT, generated)} exists; pick a new --name.`); return 1; }
    const { upload, create, poll, download } = await import('../../.claude/skills/motion-showreel/scripts/kie.mjs');
    const image_urls = [await upload(template), await upload(wordmark)];
    const task = await create(MODEL, { prompt, image_urls, aspect_ratio: '9:16', quality: 'high', output_format: 'png' });
    const res = await poll(task, 6000);
    mkdirSync(dirname(generated), { recursive: true });
    await download(res.resultUrls[0], generated);
    mkdirSync(join(proj, 'thumbnails'), { recursive: true });
    appendFileSync(join(proj, 'thumbnails', 'SPEND.jsonl'), JSON.stringify({ at: new Date().toISOString(), provider: 'kie', model: MODEL, task, name: values.name, credits: CREDITS, prompt }) + '\n');
  }

  mkdirSync(dirname(out), { recursive: true });
  const { crossesCut } = await finishCover({ generated, template, base, out });
  console.log(`Saved ${relative(ROOT, out)}`);
  if (crossesCut) console.log(`Warning: something crosses y=${CUT}, between the swoosh and the cap. Look at it before using this take.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
