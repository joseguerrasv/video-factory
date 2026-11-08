#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { ROOT, brandDir } from '../lib/paths.mjs';
import { readJson, isSlug } from '../lib/brands.mjs';
import { writeState } from '../lib/state.mjs';
import { appendLearning, ensureLearnings } from '../lib/learnings.mjs';
import { downloadGoogleFont, fontFaceCss, guessWeight, FORMAT_BY_EXT } from '../lib/fonts.mjs';
import { buildProfile, buildTokensCss, buildFrameFrontmatter, buildFrameBody, buildBrandMd, buildReferencesMd, splitLines } from './brand-kit.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const skipFonts = args.includes('--no-fonts');

if (!isSlug(slug)) {
  console.error('Usage: node scripts/onboarding/generate.mjs <brand-slug> [--force] [--no-fonts]');
  process.exit(1);
}

const dir = brandDir(slug);
const record = readJson(join(dir, 'onboarding.json'));
if (!record?.answers) {
  console.error(`No onboarding answers at brands/${slug}/onboarding.json. Run /onboard-me first.`);
  process.exit(1);
}

const written = [];
const warnings = [];
const write = (name, content) => {
  const file = join(dir, name);
  writeFileSync(file, content);
  written.push(relative(ROOT, file));
};

const profile = buildProfile(record);
write('profile.json', JSON.stringify(profile, null, 2) + '\n');

const faces = [];
const custom = (record.answers.visual?.fontFiles ?? []).filter((f) => f.path);
for (const f of custom) {
  const url = relative(dir, join(ROOT, f.path)).split('\\').join('/');
  faces.push(fontFaceCss({ family: f.family ?? 'Brand Font', weight: guessWeight(f.name), style: /italic/i.test(f.name) ? 'italic' : 'normal', url, format: FORMAT_BY_EXT[extname(f.name).toLowerCase()] ?? 'woff2' }));
}
const customFamilies = new Set(custom.map((f) => f.family));
const googleFamilies = [...new Set([profile.design.fonts.heading, profile.design.fonts.body])].filter((f) => !customFamilies.has(f));
if (!skipFonts) {
  for (const family of googleFamilies) {
    try {
      const saved = await downloadGoogleFont(family, [400, 500, 600, 700, 800], join(dir, 'assets', 'fonts'));
      for (const s of saved) faces.push(fontFaceCss({ family, weight: s.weight, style: s.style, url: `assets/fonts/${s.file}` }));
      written.push(`brands/${slug}/assets/fonts (${family}: ${saved.length} files)`);
    } catch (err) {
      warnings.push(`Could not download ${family} (${err.message}). Renders will fall back to system fonts until it is available locally.`);
    }
  }
}
write('tokens.css', buildTokensCss(profile, faces));

const frameFile = join(dir, 'frame.md');
const frontmatter = buildFrameFrontmatter(profile);
if (existsSync(frameFile) && !force) {
  const existing = readFileSync(frameFile, 'utf8');
  const body = existing.replace(/^---\n[\s\S]*?\n---\n?/, '');
  write('frame.md', `${frontmatter}\n${body.startsWith('\n') ? body : `\n${body}`}`);
} else {
  write('frame.md', `${frontmatter}\n${buildFrameBody(profile)}`);
}

if (!existsSync(join(dir, 'BRAND.md')) || force) write('BRAND.md', buildBrandMd(profile, record));
else warnings.push('BRAND.md exists and was kept. Update the changed sections by hand (or pass --force to regenerate).');

if (!existsSync(join(dir, 'references.md')) || force) write('references.md', buildReferencesMd(profile));

ensureLearnings(slug, `${profile.identity.name}: learnings`);
let seeded = 0;
for (const item of [...profile.taste.dislikes, ...splitLines(profile.taste.never)]) {
  const { added } = appendLearning({ scope: slug, kind: 'avoid', text: item, why: 'stated in onboarding' });
  if (added) seeded += 1;
}
written.push(`brands/${slug}/learnings.md (${seeded} new avoid rules)`);

mkdirSync(join(dir, 'style'), { recursive: true });
writeState({ activeBrand: slug });

console.log(JSON.stringify({
  ok: true,
  brand: slug,
  name: profile.identity.name,
  written,
  warnings,
  next: [
    'Refine BRAND.md voice and messaging from onboarding.json (keep facts, add judgment).',
    'Refine frame.md prose sections; never change frontmatter values by hand.',
    'Offer to analyze references.md with /watch into brands/<slug>/style/.',
  ],
}, null, 2));
