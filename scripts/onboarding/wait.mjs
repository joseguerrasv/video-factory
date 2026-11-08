#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from '../lib/paths.mjs';
import { readJson } from '../lib/brands.mjs';

const COMPLETE = join(PATHS.onboarding, 'complete.json');
const SESSION = join(PATHS.onboarding, 'session.json');
const DRAFT = join(PATHS.onboarding, 'draft.json');
const args = process.argv.slice(2);
const timeoutIndex = args.indexOf('--timeout');
const timeoutSec = Number(timeoutIndex >= 0 ? args[timeoutIndex + 1] : 540);

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function progress() {
  const draft = readJson(DRAFT);
  if (!draft) return 'not started';
  const name = draft.answers?.identity?.name;
  return `on step ${draft.step ?? 0}${name ? ` for "${name}"` : ''}, last saved ${draft.savedAt ?? 'unknown'}`;
}

const deadline = Date.now() + timeoutSec * 1000;
while (Date.now() < deadline) {
  if (existsSync(COMPLETE)) {
    console.log(`ONBOARDING_COMPLETE ${readFileSync(COMPLETE, 'utf8').replace(/\s+/g, ' ').trim()}`);
    process.exit(0);
  }
  const session = readJson(SESSION);
  if (!session?.pid || !alive(session.pid)) {
    console.log(`ONBOARDING_STOPPED The onboarding server is not running (user ${progress()}). Restart with: node scripts/onboarding/start.mjs`);
    process.exit(3);
  }
  await sleep(1500);
}
const session = readJson(SESSION);
console.log(`ONBOARDING_WAITING Still in progress (user ${progress()}). URL: ${session?.url ?? 'unknown'}. Run wait.mjs again to keep waiting.`);
process.exit(2);
