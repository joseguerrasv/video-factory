#!/usr/bin/env node
import { readState } from '../lib/state.mjs';

const FEEDBACK = /\b(don'?t|do not|never|stop|instead|change|swap|replace|remove|cut|trim|move|shift|fix|wrong|off|hate|love|like|prefer|should|shouldn'?t|make (it|the|them)|not (good|great|right)|bad|better|worse|too (much|many|fast|slow|long|short|big|small|loud|quiet|busy|bright|dark)|more|less|faster|slower|bigger|smaller|louder|quieter|earlier|later|again|redo)\b/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let prompt = '';
  try {
    const input = JSON.parse(raw || '{}');
    prompt = String(input.prompt ?? input.user_input ?? '');
  } catch {
    return;
  }
  const { activeProject } = readState();
  if (!activeProject || prompt.trim().startsWith('/') || !FEEDBACK.test(prompt)) return;
  console.log([
    `[video-factory] If this message is feedback on the active edit (video-projects/${activeProject}/):`,
    '1. Log it verbatim first: node scripts/factory.mjs feedback "<the user\'s words>"',
    '2. Apply the change, re-render and re-verify.',
    '3. Distill anything that should apply to future videos: node scripts/factory.mjs learn rule|avoid|win "..." --why "..." (add --technical for tool or pipeline failures). Tell the user in one line what you learned.',
  ].join('\n'));
});
