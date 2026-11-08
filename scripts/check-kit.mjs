#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const fail = message => { console.error(message); errors++; };
// Runtime state and media drop zones are not source; skip them.
const ignore = new Set(['node_modules', '.git', 'video-projects', 'raw-media', 'tmp', 'archives', 'renders', 'inbox', '.factory']);
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => ignore.has(e.name) || e.name === '.env' ? [] : e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]); }
const files = walk(root);
// Brand assets may legitimately hold audio/video (stings, intros); other media stays out of source.
const isBrandAsset = rel => /^brands\/[^/]+\/assets\//.test(rel);
const registry = JSON.parse(readFileSync(join(root,'style-library/registry.json')));
let cards = 0;
const ids = new Set();
for (const style of registry.styles) for (const card of style.cards) {
  cards++;
  if (ids.has(card.id)) fail(`Duplicate card: ${card.id}`); ids.add(card.id);
  const path = join(root,'style-library',card.file);
  if (!existsSync(path)) { fail(`Missing card: ${card.file}`); continue; }
  const html = readFileSync(path,'utf8');
  for (const slot of card.slots) {
    const literal = html.includes(`data-slot="${slot}"`) || html.includes(`data-slot='${slot}'`);
    // Two legacy cards construct slots synchronously in JS; validate those in preview.
    const generated = html.includes('setAttribute("data-slot"') && html.includes(`"${slot}"`);
    if (!literal && !generated) fail(`Missing slot ${slot}: ${card.file}`);
  }
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const value=match[1];
    if (/^(https?:|data:|#)/.test(value)) continue;
    if (!existsSync(resolve(dirname(path), value))) fail(`Missing card dependency ${value}: ${card.file}`);
  }
}
if (cards !== registry.cardCount) fail('Registry count is stale');
let skills = 0;
for (const p of files) {
  const rel = relative(root,p).replaceAll('\\','/');
  if (/\.(mp4|mov|wav|mp3|m4a|zip|pyc|pem|key)$/i.test(p) && !isBrandAsset(rel)) fail(`Private/binary material in source tree: ${rel}`);
  const bytes=readFileSync(p); if(bytes.includes(0)) continue;
  const text=bytes.toString('utf8');
  // Report locations, never the value of a suspected credential.
  if (/(?:sk-[A-Za-z0-9]{20,}|gh[pous]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(text)) fail(`Possible credential: ${rel}`);
  if (/(?:[A-Z]:[\\/](?:Users|home)[\\/]|\/Users\/|\/home\/[a-z])/.test(text)) fail(`Machine-specific path: ${rel}`);
  // The host FFmpeg removed the old vsync option; invocations must use -fps_mode.
  if (rel !== 'scripts/check-kit.mjs' && /\.(mjs|js|md|sh|py)$/.test(p) && /(?:['"]-vsync['"]|\s-vsync\s+(?:-?\d|passthrough|cfr|vfr|drop|auto)\b)/.test(text)) fail(`Removed ffmpeg option vsync (use -fps_mode): ${rel}`);
  if (/\.(mjs|js)$/.test(p)) {
    const check=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
    if(check.status !== 0) fail(`Syntax error: ${rel}\n${check.stderr}`);
  }
  if (p.endsWith('SKILL.md')) {
    skills++;
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm || !/^name: [a-z0-9-]+\s*$/m.test(fm[1]) || !/^description: \S/m.test(fm[1])) fail(`Invalid skill frontmatter: ${rel}`);
    for(const m of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target=m[1].split('#')[0];
      if (!target || /^(https?:|mailto:)/.test(target) || /[<>]/.test(target)) continue;
      if(!existsSync(resolve(dirname(p),target))) fail(`Broken skill resource ${target}: ${rel}`);
    }
  }
}
console.log(`Checked ${files.length} source files, ${registry.styles.length} styles, ${cards} cards, and ${skills} project skills; ${errors} errors.`);
process.exitCode=errors ? 1 : 0;
