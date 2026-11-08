#!/usr/bin/env node
// Generate a thumbnail background or prop with the OpenAI Images API (GPT Image models), save it under
// public/thumbs/gen/<project>/ so the Remotion Thumbnail composition can use it, and log the real cost.
// Paid: without --yes it only prints the plan and an estimate (the brand's spend policy is "ask").
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { loadEnv } from '../lib/env.mjs';
import { ROOT, projectDir } from '../lib/paths.mjs';

const USAGE = `Usage: node scripts/youtube/generate-image.mjs <project-slug|dir> --name bg-A (--prompt "..." | --variant A)
         [--kind background|prop|host|thumbnail|cover] [--reference face.webp]... [--space right|left]
         [--model gpt-image-2.5-sunburst] [--quality high] [--yes]

--variant reads "imagePrompt" from that variant in <project>/thumbnails/thumbs.json.
--kind background: 1920x1088 opaque, cropped to 1920x1080. prop: 1024x1024 transparent PNG.
--kind host: a full 16:9 scene of the host generated from --reference photo(s) of their face (required). The
  reference only teaches the face; it is never placed in the image. --space is the side kept clear for text.
--kind thumbnail / cover: the finished piece in one image, text included; 1920x1080 / 1080x1920.
Without --yes nothing is sent: it prints the plan and the estimated cost. Every paid call is logged to
<project>/thumbnails/SPEND.jsonl with its token usage and cost.`;

// USD per 1M tokens (OpenAI pricing page, Oct 2026, the higher of the two listed tables, so estimates err high).
export const RATES = {
  'gpt-image-2.5-sunburst': { textIn: 5, imageIn: 8, imageOut: 30 },
  'gpt-image-2.5-flare': { textIn: 5, imageIn: 8, imageOut: 30 },
};
const KINDS = {
  background: { size: '1920x1088', background: 'opaque', crop: [1920, 1080] },
  prop: { size: '1024x1024', background: 'transparent', crop: null },
  host: { size: '1920x1088', background: 'opaque', crop: [1920, 1080] },
  // the whole finished thumbnail in one image: host, headline, proof graphic, arrows
  thumbnail: { size: '1920x1088', background: 'opaque', crop: [1920, 1080] },
  // the same for a Short / Reel cover, 9:16
  cover: { size: '1088x1920', background: 'opaque', crop: [1080, 1920] },
};
// background / prop / host: no AI-rendered text, the renderer adds it. thumbnail: one finished piece, text included.
const GUARD = {
  background: 'No text, letters, numbers, logos, watermarks, user interfaces or people anywhere in the image. ' +
    'Leave the left half calm and low-detail for large headline text. 16:9 YouTube thumbnail background.',
  prop: 'A single isolated object on a fully transparent background, no text, letters, logos or people.',
  host: (space) => 'The person is the man in the reference photo(s): keep his exact face, the same person with the same ' +
    'facial features, skin tone, eyebrows, eye shape, nose, lips and jawline; he is the only person in the image. ' +
    'Photorealistic, sharp focus on his face, natural skin texture, no beauty filter. No text, letters, numbers, ' +
    'logos or readable writing anywhere, including on his clothes and cap. ' +
    `He stands on the ${space === 'left' ? 'right' : 'left'} side of the frame; keep the ${space} half clear, darker ` +
    'and low-detail for large headline text and graphics. 16:9 YouTube thumbnail photo.',
  thumbnail: () => 'One finished, cohesive, professionally designed 16:9 YouTube thumbnail: photo, typography and ' +
    'graphics made together as a single image, like a top YouTube thumbnail designer\'s final export. ' +
    'Spell every word, number and price exactly as written in this prompt and add no other text. ' +
    'Keep all text and key elements away from the outer edges and keep the bottom-right corner free of text. ' +
    'Photorealistic person, sharp face, natural skin, no beauty filter.',
  cover: () => 'One finished, cohesive, professionally designed 9:16 Reel and Short cover: photo, typography and ' +
    'graphics made together as a single image, like a top thumbnail designer\'s final export. ' +
    'Spell every word and number exactly as written in this prompt and add no other text. ' +
    'Keep all text inside the centre 3:4 area, because the top and bottom 12.5% of the height are cropped off in the ' +
    'Instagram grid, and away from the side edges. Photorealistic person, sharp face, natural skin, no beauty filter.',
};

export function costOf(usage, model) {
  const r = RATES[model];
  if (!r || !usage) return null;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return (textIn * r.textIn + imageIn * r.imageIn + out * r.imageOut) / 1e6;
}

/** Rough pre-spend estimate: output tokens scale with pixels and quality (third-party measurements, 1024² ≈ 0.05 USD at high). */
export function estimate(kind, quality, model) {
  const [w, h] = KINDS[kind].size.split('x').map(Number);
  const perMegapixel = { low: 0.006, medium: 0.05, high: 0.05, xhigh: 0.12, max: 0.21 }[quality] ?? 0.05;
  const usd = perMegapixel * (w * h) / (1024 * 1024);
  return RATES[model] ? usd : null;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: 'string' }, prompt: { type: 'string' }, variant: { type: 'string' },
      kind: { type: 'string', default: 'background' }, model: { type: 'string', default: 'gpt-image-2.5-sunburst' },
      quality: { type: 'string', default: 'high' }, yes: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
      reference: { type: 'string', multiple: true }, space: { type: 'string', default: 'right' },
    },
  });
  if (values.help || !positionals[0] || !values.name || !(values.prompt || values.variant) || !KINDS[values.kind]) {
    console.log(USAGE); return values.help ? 0 : 1;
  }
  const proj = existsSync(positionals[0]) ? resolve(positionals[0]) : projectDir(positionals[0]);
  const slug = basename(proj);
  let prompt = values.prompt;
  if (values.variant) {
    const spec = JSON.parse(readFileSync(join(proj, 'thumbnails', 'thumbs.json'), 'utf8'));
    prompt = spec.variants?.find((v) => v.id === values.variant)?.imagePrompt;
    if (!prompt) { console.error(`Variant ${values.variant} has no "imagePrompt" in thumbs.json`); return 1; }
  }
  const kind = KINDS[values.kind];
  const refs = (values.reference ?? []).map((r) => resolve(r));
  if (values.kind === 'host' && !refs.length) { console.error('--kind host needs --reference <face photo>'); return 1; }
  for (const r of refs) if (!existsSync(r)) { console.error(`Reference not found: ${r}`); return 1; }
  const guard = typeof GUARD[values.kind] === 'function' ? GUARD[values.kind](values.space) : GUARD[values.kind];
  const fullPrompt = `${prompt.trim()}\n\n${guard}`;
  const outDir = join(ROOT, 'public', 'thumbs', 'gen', slug);
  const out = join(outDir, `${values.name}.png`);
  const est = estimate(values.kind, values.quality, values.model);

  console.log(`Model:    ${values.model} (${values.quality}), ${kind.size}, ${kind.background}`);
  console.log(`Output:   ${relative(ROOT, out)}  → use "thumbs/gen/${slug}/${values.name}.png" in thumbs.json`);
  if (refs.length) console.log(`Reference: ${refs.map((r) => relative(ROOT, r)).join(', ')} (face only; sent to OpenAI, never placed in the image)`);
  console.log(`Estimate: ${est == null ? 'unknown (no rates for this model)' : `~$${est.toFixed(3)}`} (exact cost logged after the call)`);
  console.log(`Prompt:   ${fullPrompt.replace(/\n+/g, ' ')}`);
  if (!values.yes) { console.log('\nDry run: nothing sent. Re-run with --yes once the spend is approved.'); return 0; }
  if (existsSync(out)) { console.error(`\n${relative(ROOT, out)} exists; pick a new --name (generated images are never overwritten).`); return 1; }

  loadEnv();
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is not set in .env'); return 1; }
  const request = { model: values.model, prompt: fullPrompt, n: 1, size: kind.size, quality: values.quality, background: kind.background, output_format: 'png' };
  // With references: the edits endpoint, each reference as a PNG data URL (downscaled to keep input tokens low).
  if (refs.length) {
    request.images = await Promise.all(refs.map(async (r) => ({
      image_url: `data:image/png;base64,${(await sharp(r).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64')}`,
    })));
  }
  let res;
  try {
    res = await fetch(`https://api.openai.com/v1/images/${refs.length ? 'edits' : 'generations'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    // no response, so nothing to log; re-run the same command (a dropped connection is usually not billed)
    console.error(`Network error talking to OpenAI (${e.cause?.code ?? e.name}): nothing saved. Re-run the same command.`);
    return 1;
  }
  const body = await res.json();
  if (!res.ok) { console.error(`OpenAI ${res.status}: ${body.error?.message ?? 'request failed'}`); return 1; }
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) { console.error('No image in the response.'); return 1; }

  mkdirSync(outDir, { recursive: true });
  const raw = Buffer.from(b64, 'base64');
  const img = kind.crop ? sharp(raw).resize(kind.crop[0], kind.crop[1], { fit: 'cover' }) : sharp(raw);
  await img.png().toFile(out);
  const cost = costOf(body.usage, values.model);
  const thumbDir = join(proj, 'thumbnails');
  mkdirSync(thumbDir, { recursive: true });
  appendFileSync(join(thumbDir, 'SPEND.jsonl'), JSON.stringify({
    at: new Date().toISOString(), provider: 'openai', model: values.model, quality: values.quality, size: kind.size,
    file: relative(ROOT, out), references: refs.map((r) => relative(ROOT, r)), usage: body.usage ?? null, usd: cost, prompt,
  }) + '\n');
  writeFileSync(out.replace(/\.png$/, '.prompt.txt'), fullPrompt + '\n');
  console.log(`\nSaved ${relative(ROOT, out)}. Cost: ${cost == null ? 'unknown (no usage returned)' : `$${cost.toFixed(4)}`} (logged to ${relative(ROOT, join(thumbDir, 'SPEND.jsonl'))})`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
