#!/usr/bin/env node
// Render a video's thumbnail variants from <project>/thumbnails/thumbs.json through the Remotion
// "Thumbnail" composition, then write YouTube-ready JPGs and a feed preview at real on-screen sizes.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { activeBrand, loadProfile } from '../lib/brands.mjs';
import { ROOT, projectDir } from '../lib/paths.mjs';

const USAGE = `Usage: node scripts/youtube/render-thumbnails.mjs <project-slug|dir> [--only A,B] [--title "..."]

Reads <project>/thumbnails/thumbs.json:
  { "title": "...", "duration": "10:05", "variants": [ { "id": "A", "layout": "paper", "lines": ["77 paid", "in 7 days"], ... } ] }
A variant { "id": "H", "image": "thumbs/gen/<project>/thumb-H.png" } is a finished one-piece AI thumbnail (no Remotion).
Writes thumb-<id>-1080.png (master), thumb-<id>.jpg (1280×720, < 2 MB, upload this) and feed-preview.png.`;

const MAX_BYTES = 2 * 1024 * 1024; // YouTube's custom thumbnail limit

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function wrap(text, perLine, maxLines) {
  const out = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > perLine && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

async function jpgUnder2MB(src, out) {
  for (const quality of [90, 85, 80, 72, 64]) {
    await sharp(src).resize(1280, 720).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(out);
    if (statSync(out).size < MAX_BYTES) return quality;
  }
  throw new Error(`${out} is still over 2 MB at quality 64`);
}

/** One row per variant: desktop home-feed card (360×202) with title + channel line, and the small sidebar / mobile-search size (168×94). */
async function feedPreview(variants, dir, { title, duration, channel }) {
  const S = 2; // draw at 2× so the preview stays crisp; sizes below are CSS px on YouTube
  const rowH = 300, W = 760;
  const H = 40 + variants.length * rowH;
  const layers = [];
  const svg = [`<rect width="${W * S}" height="${H * S}" fill="#0F0F0F"/>`];
  variants.forEach((v, i) => {
    const y = 30 + i * rowH;
    const jpg = join(dir, `thumb-${v.id}.jpg`);
    layers.push({ file: jpg, left: 20, top: y, w: 360, h: 202 }, { file: jpg, left: 420, top: y, w: 168, h: 94 });
    for (const [x, w, h] of [[20, 360, 202], [420, 168, 94]]) {
      const bw = duration.length * 7.5 + 8;
      svg.push(`<rect x="${(x + w - bw - 4) * S}" y="${(y + h - 22) * S}" width="${bw * S}" height="${18 * S}" rx="${4 * S}" fill="rgba(0,0,0,.8)"/>`,
        `<text x="${(x + w - 4 - bw / 2) * S}" y="${(y + h - 9) * S}" font-family="Roboto, Helvetica, Arial" font-size="${12 * S}" font-weight="600" fill="#fff" text-anchor="middle">${esc(duration)}</text>`);
    }
    wrap(title, 44, 2).forEach((l, j) => svg.push(`<text x="${20 * S}" y="${(y + 228 + j * 22) * S}" font-family="Roboto, Helvetica, Arial" font-size="${16 * S}" font-weight="600" fill="#F1F1F1">${esc(l)}</text>`));
    svg.push(`<text x="${20 * S}" y="${(y + 276) * S}" font-family="Roboto, Helvetica, Arial" font-size="${13 * S}" fill="#AAAAAA">${esc(channel)} · ${esc(v.id)}</text>`);
    wrap(title, 22, 2).forEach((l, j) => svg.push(`<text x="${600 * S}" y="${(y + 14 + j * 18) * S}" font-family="Roboto, Helvetica, Arial" font-size="${13 * S}" font-weight="600" fill="#F1F1F1">${esc(l)}</text>`));
    svg.push(`<text x="${600 * S}" y="${(y + 56) * S}" font-family="Roboto, Helvetica, Arial" font-size="${11 * S}" fill="#AAAAAA">sidebar / mobile search</text>`);
  });
  const base = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${svg.slice(0, 1).join('')}</svg>`));
  const thumbs = await Promise.all(layers.map(async (l) => ({
    input: await sharp(l.file).resize(l.w * S, l.h * S).png().toBuffer(), left: l.left * S, top: l.top * S,
  })));
  const overlay = { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${svg.slice(1).join('')}</svg>`), left: 0, top: 0 };
  const out = join(dir, 'feed-preview.png');
  await base.composite([...thumbs, overlay]).png().toFile(out);
  return out;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { only: { type: 'string' }, title: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help || !positionals[0]) { console.log(USAGE); return values.help ? 0 : 1; }
  const proj = existsSync(positionals[0]) ? resolve(positionals[0]) : projectDir(positionals[0]);
  const dir = join(proj, 'thumbnails');
  const specFile = join(dir, 'thumbs.json');
  if (!existsSync(specFile)) { console.error(`Missing ${relative(ROOT, specFile)}\n\n${USAGE}`); return 1; }
  const spec = JSON.parse(readFileSync(specFile, 'utf8'));
  const only = values.only?.split(',').map((s) => s.trim());
  const variants = (spec.variants ?? []).filter((v) => !only || only.includes(v.id));
  if (!variants.length) { console.error('No variants to render.'); return 1; }
  const titleFile = join(proj, 'TITLE.txt');
  const title = values.title ?? spec.title ?? (existsSync(titleFile) ? readFileSync(titleFile, 'utf8').trim() : 'Untitled video');

  // A variant with "image" is a finished one-piece thumbnail (generate-image.mjs --kind thumbnail): no Remotion,
  // just the YouTube export. Everything else renders through the Remotion "Thumbnail" composition.
  let serveUrl = null, renderStill, selectComposition;
  if (variants.some((v) => !v.image)) {
    const { bundle } = await import('@remotion/bundler');
    ({ renderStill, selectComposition } = await import('@remotion/renderer'));
    console.log('Bundling Remotion project…');
    serveUrl = await bundle({ entryPoint: join(ROOT, 'src/index.ts') });
  }
  for (const v of variants) {
    const { id, ...inputProps } = v;
    const png = join(dir, `thumb-${id}-1080.png`);
    if (v.image) {
      const src = join(ROOT, 'public', v.image);
      if (!existsSync(src)) { console.error(`${id}: missing ${relative(ROOT, src)}`); return 1; }
      await sharp(src).resize(1920, 1080, { fit: 'cover' }).png().toFile(png);
    } else {
      const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps });
      await renderStill({ composition, serveUrl, output: png, inputProps, imageFormat: 'png' });
    }
    const q = await jpgUnder2MB(png, join(dir, `thumb-${id}.jpg`));
    console.log(`${id}: ${relative(ROOT, join(dir, `thumb-${id}.jpg`))} (q${q}, ${(statSync(join(dir, `thumb-${id}.jpg`)).size / 1024).toFixed(0)} KB)`);
  }
  const all = (spec.variants ?? []).filter((v) => existsSync(join(dir, `thumb-${v.id}.jpg`)));
  const preview = await feedPreview(all, dir, { title, duration: spec.duration ?? '10:00', channel: spec.channel ?? loadProfile(activeBrand())?.identity?.host?.name ?? 'Channel' });
  console.log(`Feed preview: ${relative(ROOT, preview)}`);
  writeFileSync(join(dir, 'RENDERED.json'), JSON.stringify({ at: new Date().toISOString(), title, variants: all.map((v) => v.id) }, null, 2));
  return 0;
}

process.exitCode = await main();
