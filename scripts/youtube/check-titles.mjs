#!/usr/bin/env node
// Lint YouTube title candidates (the youtube-titles framework rules) against the hard limits, the active brand's
// BRAND.md "Avoid" list and titles.md keywords, and the source script / transcript (every number must appear in it).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { activeBrand } from '../lib/brands.mjs';
import { brandDir } from '../lib/paths.mjs';

const USAGE = `Usage: node scripts/youtube/check-titles.mjs [--source <script.md|words.json>]... [--file titles.txt] ["title" ...]
                                             [--brand <slug>] [--json]

Titles come from positional args and/or --file: one per line, or the skill's [BAD]/[CLICKABLE] pairs (only the
CLICKABLE lines are checked). Blank lines and lines starting with # are skipped.
Exit 0 = every title passes or only warns, 2 = at least one fails, 1 = usage error.`;

export const LIMITS = { hard: 100, desktop: 70, ideal: [30, 60], mobile: 45 };
const GENERIC_AVOID = ['you won\'t believe', 'shocking', 'gone wrong', 'must watch', 'guaranteed', 'overnight'];
export const SALESY = ['unlock', 'discover', 'skyrocket', 'revolutionize', 'revolutionise', 'cutting-edge', 'cutting edge', 'game-changer', 'game changer', 'ultimate'];

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, a: 1 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };

/** Every number in a text: digit forms ("$12,419", "3.5", "30%", "10k") and spelled-out runs ("seventy-seven", "twelve thousand four hundred nineteen"). */
export function numbersIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?\s*([kKmM])?(?![a-zA-Z])/g)) {
    let n = Number(m[0].replace(/[,\skKmM]/g, ''));
    if (m[1]) n *= /k/i.test(m[1]) ? 1e3 : 1e6;
    if (Number.isFinite(n)) out.add(n);
  }
  // punctuation ends a number ("a hundred nineteen, three ...")
  const words = text.toLowerCase().replace(/-/g, ' ').match(/[a-z]+|[^a-z\s]/g) ?? [];
  let total = 0, current = 0, active = false;
  const flush = () => { if (active) out.add(total + current); total = 0; current = 0; active = false; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'a' && !active) { current = 1; active = true; } // "a hundred nineteen"
    else if (w in UNITS && w !== 'a') {
      if (current % 100 !== 0 && (current % 10 !== 0 || UNITS[w] >= 10)) flush(); // "seven three" is two numbers
      current += UNITS[w]; active = true;
    } else if (w in TENS) {
      if (current > 0 && current < 10 && total === 0) current *= 100; // price talk: "two forty-nine" = 249
      else if (current % 100 !== 0) flush();
      current += TENS[w]; active = true;
    }
    else if (w in SCALES && active) {
      if (SCALES[w] === 100) current *= 100;
      else { total += current * SCALES[w]; current = 0; }
    } else if (active && w === 'and' && words[i + 1] === 'a' && words[i + 2] === 'half') { current += 0.5; i += 2; } // "three and a half"
    else if (active && w === 'and') continue; // "two hundred and five"
    else flush();
  }
  flush();
  out.delete(1); // "a"/"one" is everywhere; never a meaningful claim on its own
  return out;
}

/** Keywords from the brand's titles.md "- **Keywords:**" line (niche words a title should keep when relevant). */
export function brandKeywords(slug) {
  const file = slug && join(brandDir(slug), 'titles.md');
  if (!file || !existsSync(file)) return [];
  const line = readFileSync(file, 'utf8').split('\n').find((l) => /^\s*-\s*\*\*Keywords:\*\*/.test(l));
  return line ? line.replace(/^.*?\*\*Keywords:\*\*/, '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) : [];
}

/** Titles from a file: the CLICKABLE lines of [BAD]/[CLICKABLE] pairs, else every line. */
export function titlesFromText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const tagged = lines.filter((l) => /^\[CLICKABLE\]/i.test(l));
  const pick = tagged.length ? tagged : lines.filter((l) => !/^\[BAD\]/i.test(l));
  return pick.map((l) => l.replace(/^\[CLICKABLE\]\s*/i, '').replace(/^(?:[-*]|\d+[.)])\s+/, '').trim()).filter(Boolean);
}

/** Quoted phrases from the brand's BRAND.md "- **Avoid:**" (or "- Avoid:") line. */
export function brandAvoid(slug) {
  const file = slug && join(brandDir(slug), 'BRAND.md');
  if (!file || !existsSync(file)) return [];
  const line = readFileSync(file, 'utf8').split('\n').find((l) => /^\s*-\s*(?:\*\*)?Avoid:/.test(l));
  return line ? [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase()) : [];
}

function readSource(file) {
  const raw = readFileSync(file, 'utf8');
  // drop section timestamps ("2:02 – Pillar 1") and the dates and stats in source/credit headers
  if (!file.endsWith('.json')) return raw.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
  const data = JSON.parse(raw);
  const words = Array.isArray(data) ? data : data.words ?? data.segments ?? [];
  if (!Array.isArray(words) || !words.length) return data.text ?? raw;
  return words.map((w) => w.word ?? w.text ?? w.t ?? '').join(' ');
}

export function checkTitle(title, { sourceNumbers = null, avoid = [], keywords = [] } = {}) {
  const issues = [];
  const add = (level, msg) => issues.push({ level, msg });
  const len = [...title].length;
  if (len > LIMITS.hard) add('fail', `${len} chars, YouTube's limit is ${LIMITS.hard}`);
  else if (len > LIMITS.desktop) add('warn', `${len} chars, cut off in search and suggested (aim for ~${LIMITS.ideal[1]})`);
  else if (len > LIMITS.ideal[1]) add('warn', `${len} chars, over the ~${LIMITS.ideal[1]} target`);
  else if (len < LIMITS.ideal[0]) add('warn', `${len} chars, probably too thin to carry the promise`);
  if (/!/.test(title)) add('fail', 'exclamation mark');
  if (/:/.test(title.replace(/\b\d{1,2}:\d{2}\b/g, ''))) add('fail', 'colon (write one cohesive title)');
  if (/\?/.test(title)) add('fail', 'question-form title (declarative "Why..." is fine)');
  if (/\p{Extended_Pictographic}/u.test(title)) add('fail', 'emoji');
  const lower = title.toLowerCase();
  for (const phrase of [...avoid, ...GENERIC_AVOID]) if (lower.includes(phrase)) add('fail', `avoid-list phrase "${phrase}"`);
  for (const w of SALESY) if (new RegExp(`\\b${w}`, 'i').test(title)) add('fail', `salesy word "${w}"`);
  if (keywords.length && !keywords.some((k) => lower.includes(k))) add('warn', `no niche keyword (${keywords.join(', ')}); fine only if none is relevant`);
  const caps = (title.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !/^(AI|CEO|MRR|ROI|SEO|USA|UK|DM|DMS|VSL|CRM|SAAS|YT|TV|VIP)$/.test(w));
  if (caps.length > 1) add('warn', `${caps.length} ALL-CAPS words (${caps.join(', ')}); use one at most`);
  if (sourceNumbers) {
    for (const n of numbersIn(title)) if (!sourceNumbers.has(n)) add('fail', `number ${n} is not in the source`);
  }
  const mobile = len > LIMITS.mobile ? `${[...title].slice(0, LIMITS.mobile).join('').trimEnd()}…` : title;
  const level = issues.some((i) => i.level === 'fail') ? 'fail' : issues.length ? 'warn' : 'pass';
  return { title, chars: len, mobile, level, issues };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { source: { type: 'string', multiple: true }, file: { type: 'string' }, brand: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) { console.log(USAGE); return 0; }
  const titles = [...positionals];
  if (values.file) titles.push(...titlesFromText(readFileSync(values.file, 'utf8')));
  if (!titles.length) { console.error(USAGE); return 1; }
  let sourceNumbers = null;
  if (values.source?.length) {
    sourceNumbers = new Set();
    for (const f of values.source) for (const n of numbersIn(readSource(f))) sourceNumbers.add(n);
  }
  const brand = values.brand ?? activeBrand();
  const avoid = brandAvoid(brand);
  const keywords = brandKeywords(brand);
  const results = titles.map((t) => checkTitle(t, { sourceNumbers, avoid, keywords }));
  if (values.json) console.log(JSON.stringify(results, null, 2));
  else {
    if (!sourceNumbers) console.log('(no --source given: numbers were not checked)\n');
    for (const r of results) {
      console.log(`${r.level.toUpperCase().padEnd(4)}  ${String(r.chars).padStart(3)}  ${r.title}`);
      if (r.chars > LIMITS.mobile) console.log(`            mobile: ${r.mobile}`);
      for (const i of r.issues) console.log(`            ${i.level}: ${i.msg}`);
    }
  }
  return results.some((r) => r.level === 'fail') ? 2 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
