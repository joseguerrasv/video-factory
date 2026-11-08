import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PATHS } from './paths.mjs';

export function readState() {
  if (!existsSync(PATHS.stateFile)) return {};
  try { return JSON.parse(readFileSync(PATHS.stateFile, 'utf8')); } catch { return {}; }
}

export function writeState(patch) {
  mkdirSync(PATHS.state, { recursive: true });
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(PATHS.stateFile, JSON.stringify(next, null, 2) + '\n');
  return next;
}
