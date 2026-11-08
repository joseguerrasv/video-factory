import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PATHS, brandDir } from './paths.mjs';

export const KINDS = {
  rule: '## Rules',
  avoid: '## Never again',
  win: '## What works',
};

const TEMPLATE = (title) => `# ${title}

Distilled from real feedback, newest first in each section. Claude reads this before every edit.
Rules: how it should be done. Never again: tried, rejected or failed. What works: approved, worth repeating.
Keep entries short, specific and testable. Merge duplicates instead of stacking them.

${KINDS.rule}

${KINDS.avoid}

${KINDS.win}
`;

export const learningsFile = (scope) =>
  scope === 'technical' ? PATHS.technicalLearnings : join(brandDir(scope), 'learnings.md');

export function ensureLearnings(scope, title) {
  const file = learningsFile(scope);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, TEMPLATE(title ?? (scope === 'technical' ? 'Technical learnings' : `${scope} — learnings`)));
  }
  return file;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const headingIndex = (lines, heading) => lines.findIndex((line) => line.trim() === heading);

export function appendLearning({ scope, kind, text, why, project, date = new Date() }) {
  if (!KINDS[kind]) throw new Error(`kind must be one of: ${Object.keys(KINDS).join(', ')}`);
  if (!text?.trim()) throw new Error('learning text is required');
  const file = ensureLearnings(scope);
  const lines = readFileSync(file, 'utf8').split('\n');
  if (lines.some((line) => line.startsWith('- ') && normalize(line).includes(normalize(text)))) {
    return { file, added: false, reason: 'duplicate' };
  }
  const stamp = date.toLocaleDateString('en-CA');
  const meta = [why && `why: ${why.trim()}`, project && `project: ${project}`].filter(Boolean).join(' · ');
  const entry = `- [${stamp}] ${text.trim()}${meta ? ` — ${meta}` : ''}`;
  const heading = KINDS[kind];
  let at = headingIndex(lines, heading);
  if (at < 0) {
    while (lines.length && lines.at(-1).trim() === '') lines.pop();
    lines.push('', heading, '');
    at = lines.length - 2;
  }
  const insertAt = lines[at + 1]?.trim() === '' ? at + 2 : at + 1;
  lines.splice(insertAt, 0, entry);
  if (lines[insertAt + 1] !== undefined && lines[insertAt + 1].startsWith('## ')) lines.splice(insertAt + 1, 0, '');
  writeFileSync(file, lines.join('\n').replace(/\n*$/, '\n'));
  return { file, added: true, entry };
}

// An entry as a session reads it: the rule alone, without its date, reason and project.
export const entryText = (entry) => entry.replace(/^- \[\d{4}-\d{2}-\d{2}\] /, '- ').replace(/ — (why|project): .*$/, '');

export function readSections(scope) {
  const file = learningsFile(scope);
  if (!existsSync(file)) return { rule: [], avoid: [], win: [] };
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = {};
  for (const [kind, heading] of Object.entries(KINDS)) {
    const at = headingIndex(lines, heading);
    const items = [];
    for (let i = at + 1; at >= 0 && i < lines.length && !lines[i].startsWith('## '); i += 1) {
      if (lines[i].startsWith('- ')) items.push(lines[i]);
    }
    out[kind] = items;
  }
  return out;
}
