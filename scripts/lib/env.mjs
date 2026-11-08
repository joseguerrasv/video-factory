import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { PATHS } from './paths.mjs';

export const SERVICE_KEYS = [
  'ELEVENLABS_API_KEY',
  'KIE_API_KEY',
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'PEXELS_API_KEY',
];

const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/;

function unquote(value = '') {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v.replace(/\s+#.*$/, '');
}

export function readEnvFile(file = PATHS.env) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m) out[m[1]] = unquote(m[2]);
  }
  return out;
}

export function loadEnv(file = PATHS.env) {
  const values = readEnvFile(file);
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined && value !== '') process.env[key] = value;
  }
  return values;
}

export function envStatus(keys = SERVICE_KEYS) {
  const values = readEnvFile();
  return Object.fromEntries(keys.map((k) => [k, Boolean(values[k] || process.env[k])]));
}

export function upsertEnv(updates, file = PATHS.env) {
  const entries = Object.entries(updates).filter(([, v]) => typeof v === 'string' && v.trim() !== '');
  if (!entries.length) return [];
  const base = existsSync(file)
    ? readFileSync(file, 'utf8')
    : existsSync(PATHS.envExample) ? readFileSync(PATHS.envExample, 'utf8') : '';
  const lines = base.split(/\r?\n/);
  const written = [];
  for (const [key, raw] of entries) {
    const value = raw.trim().replace(/[\r\n]/g, '');
    const index = lines.findIndex((line) => line.match(LINE)?.[1] === key);
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    written.push(key);
  }
  writeFileSync(file, lines.join('\n').replace(/\n*$/, '\n'));
  try { chmodSync(file, 0o600); } catch {}
  return written;
}
