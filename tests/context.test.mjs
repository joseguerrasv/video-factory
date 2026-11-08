import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTEXT_PAGES, contextPages, contextText, paginateContext } from '../scripts/factory.mjs';
import { entryText } from '../scripts/lib/learnings.mjs';

// Past this, Claude Code keeps only a 2,000-character preview of a hook's output.
const HOOK_CAP = 10000;

const entries = (kind, count) => Array.from({ length: count }, (_, i) => `- ${kind} ${i} ${'x'.repeat(300)}`);
const shown = (pages) => pages.join('\n').split('\n').filter((line) => line.startsWith('- ') && !line.startsWith('- ...'));

test('entryText keeps the rule and drops its date, reason and project', () => {
  assert.equal(entryText('- [2026-11-01] Say thumbnail: never cover — why: the user asked · project: launch-short'), '- Say thumbnail: never cover');
  assert.equal(entryText('- [2026-11-01] Lower thirds hold 2.5 s — project: demo'), '- Lower thirds hold 2.5 s');
  assert.equal(entryText('- [2026-11-01] Lower thirds hold 2.5 s'), '- Lower thirds hold 2.5 s');
});

test('paginateContext keeps every entry in order, with every page under the cap and naming itself', () => {
  const avoid = entries('avoid', 50);
  const rule = entries('rule', 70);
  const pages = paginateContext(['intro'], [{ title: 'Never again', items: avoid }, { title: 'Rules', items: rule }]);
  assert.ok(pages.length > 1 && pages.length <= CONTEXT_PAGES);
  assert.deepEqual(shown(pages), [...avoid, ...rule]);
  assert.ok(pages[0].includes('intro'));
  pages.forEach((page, i) => {
    assert.ok(page.length < HOOK_CAP, `page ${i + 1} is ${page.length} characters`);
    assert.ok(page.startsWith(`# Video Factory context, page ${i + 1} of ${pages.length}\n`));
    assert.match(page.split('\n').find((line) => /^(##|-) /.test(line)), /^## /, 'a page opens with its section heading');
  });
});

test('paginateContext says how many entries did not fit instead of passing the cap', () => {
  const rule = entries('rule', 500);
  const pages = paginateContext(['intro'], [{ title: 'Rules', items: rule }], { moreIn: 'learnings.md' });
  assert.equal(pages.length, CONTEXT_PAGES);
  for (const page of pages) assert.ok(page.length < HOOK_CAP, `a page is ${page.length} characters`);
  const left = Number(pages.at(-1).match(/- \.\.\.(\d+) more in learnings\.md$/)?.[1]);
  assert.equal(shown(pages).length + left, rule.length);
});

test('the real context stays under the cap on every page', () => {
  const pages = contextPages();
  assert.ok(pages.length <= CONTEXT_PAGES);
  for (const page of pages) assert.ok(page.length < HOOK_CAP, `a page is ${page.length} characters`);
  assert.equal(contextText(), pages[0]);
  assert.equal(contextText({ page: pages.length + 1 }), '');
});

test('.claude/settings.json runs one session-start hook per page', () => {
  const settings = JSON.parse(readFileSync(new URL('../.claude/settings.json', import.meta.url), 'utf8'));
  const commands = settings.hooks.SessionStart.flatMap((entry) => entry.hooks).map((hook) => hook.command).filter((command) => command.includes('session-start.mjs'));
  assert.deepEqual(commands.map((command) => Number(command.match(/ (\d+)$/)?.[1])), Array.from({ length: CONTEXT_PAGES }, (_, i) => i + 1));
});
