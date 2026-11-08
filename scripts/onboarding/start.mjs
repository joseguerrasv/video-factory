#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, ROOT } from '../lib/paths.mjs';
import { readJson } from '../lib/brands.mjs';

const SESSION = join(PATHS.onboarding, 'session.json');
const LOG = join(PATHS.onboarding, 'server.log');
const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const brandIndex = args.indexOf('--brand');
const brand = brandIndex >= 0 ? args[brandIndex + 1] : undefined;

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openBrowser(url) {
  if (noOpen) return;
  const [cmd, cmdArgs] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

function report(url, reused) {
  console.log(`ONBOARDING_URL ${url}`);
  console.log(reused ? 'Onboarding was already running; reopened it.' : 'Onboarding server started in the background.');
  console.log('Next: run `node scripts/onboarding/wait.mjs` to wait for the user to finish.');
}

async function main() {
  const existing = readJson(SESSION);
  if (existing?.pid && alive(existing.pid) && (!brand || existing.brand === brand)) {
    openBrowser(existing.url);
    return report(existing.url, true);
  }
  if (existing?.pid && alive(existing.pid)) process.kill(existing.pid, 'SIGTERM');

  mkdirSync(PATHS.onboarding, { recursive: true });
  const log = openSync(LOG, 'w');
  const child = spawn(process.execPath, [join(ROOT, 'scripts/onboarding/server.mjs'), ...(brand ? ['--brand', brand] : [])], {
    cwd: ROOT, detached: true, stdio: ['ignore', log, log], windowsHide: true,
  });
  child.unref();
  closeSync(log);

  for (let i = 0; i < 100; i += 1) {
    await sleep(100);
    const line = existsSync(LOG) && readFileSync(LOG, 'utf8').split('\n').find((l) => l.startsWith('ONBOARDING_URL ') || l.startsWith('ONBOARDING_ERROR '));
    if (line?.startsWith('ONBOARDING_ERROR')) { console.error(line); process.exit(1); }
    if (line) {
      const url = line.slice('ONBOARDING_URL '.length).trim();
      openBrowser(url);
      return report(url, false);
    }
  }
  console.error(`ONBOARDING_ERROR server did not start. See ${LOG}`);
  process.exit(1);
}

main();
