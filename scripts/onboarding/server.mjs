#!/usr/bin/env node
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { basename, extname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { PATHS, ROOT, brandDir } from '../lib/paths.mjs';
import { envStatus, upsertEnv, SERVICE_KEYS } from '../lib/env.mjs';
import { listBrands, slugify, isSlug, readJson } from '../lib/brands.mjs';

const APP_DIR = join(ROOT, 'scripts', 'onboarding', 'app');
const DIR = PATHS.onboarding;
const UPLOADS = join(DIR, 'uploads');
const DRAFT = join(DIR, 'draft.json');
const SESSION = join(DIR, 'session.json');
const COMPLETE = join(DIR, 'complete.json');
const MAX_UPLOAD = 60 * 1024 * 1024;
const IDLE_MS = Number(process.env.ONBOARDING_IDLE_MS ?? 4 * 60 * 60 * 1000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const KIND_DIRS = { logo: 'logo', font: 'fonts', guidelines: 'guidelines' };

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const editing = flag('--brand');
const token = randomBytes(18).toString('hex');
let lastActivity = Date.now();

mkdirSync(UPLOADS, { recursive: true });
rmSync(COMPLETE, { force: true });

const safeName = (name) => basename(String(name || 'file')).replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-80) || 'file';

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(typeof body === 'object' && !Buffer.isBuffer(body) ? { 'content-type': 'application/json' } : {}), ...headers });
  res.end(payload);
}

function serveFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  createReadStream(file).pipe(res);
}

function within(base, target) {
  const rel = relative(base, target);
  return Boolean(rel) && !isAbsolute(rel) && !rel.split(sep).includes('..');
}

function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(Object.assign(new Error('File too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const readJsonBody = async (req) => JSON.parse((await readBody(req, 5 * 1024 * 1024)).toString('utf8') || '{}');

function brandAnswers(slug) {
  const data = readJson(join(brandDir(slug), 'onboarding.json'));
  if (!data) return null;
  const answers = data.answers ?? data;
  const withUrls = (list = []) => list.map((f) => ({ ...f, url: f.path ? `/files/${f.path}` : f.url }));
  if (answers.visual) {
    for (const key of ['logos', 'fontFiles', 'guidelines']) answers.visual[key] = withUrls(answers.visual[key]);
  }
  return answers;
}

function persistUploads(answers, slug) {
  const assets = join(brandDir(slug), 'assets');
  const move = (list = [], kind) => list.map((f) => {
    if (f.path) return stripUrl(f);
    const source = f.id && join(UPLOADS, f.id);
    if (!source || !existsSync(source)) return null;
    const dir = join(assets, KIND_DIRS[kind] ?? 'misc');
    mkdirSync(dir, { recursive: true });
    let target = join(dir, safeName(f.name));
    if (existsSync(target)) target = join(dir, `${Date.now().toString(36)}-${safeName(f.name)}`);
    try { renameSync(source, target); } catch { copyFileSync(source, target); }
    return stripUrl({ ...f, path: relative(ROOT, target).split(sep).join('/') });
  }).filter(Boolean);
  const v = answers.visual ?? {};
  v.logos = move(v.logos, 'logo');
  v.fontFiles = move(v.fontFiles, 'font');
  v.guidelines = move(v.guidelines, 'guidelines');
  answers.visual = v;
  return answers;
}

function stripUrl({ url, id, ...rest }) { return rest; }

async function handleApi(req, res, url) {
  if (req.headers['x-onboard-token'] !== token) return send(res, 403, { error: 'Invalid session. Reopen the link Claude gave you.' });

  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    return send(res, 200, {
      brands: listBrands(),
      draft: readJson(DRAFT),
      env: envStatus(SERVICE_KEYS),
      editing: editing && isSlug(editing) && existsSync(brandDir(editing)) ? editing : null,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/brand') {
    const slug = url.searchParams.get('slug');
    if (!isSlug(slug)) return send(res, 400, { error: 'Invalid brand' });
    const answers = brandAnswers(slug);
    return answers ? send(res, 200, { answers }) : send(res, 404, { error: 'That brand has no saved onboarding yet' });
  }

  if (req.method === 'PUT' && url.pathname === '/api/draft') {
    const draft = await readJsonBody(req);
    writeFileSync(DRAFT, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }, null, 2));
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/upload') {
    const kind = url.searchParams.get('kind');
    if (!KIND_DIRS[kind]) return send(res, 400, { error: 'Unknown upload kind' });
    const name = safeName(url.searchParams.get('name'));
    const ext = extname(name).toLowerCase();
    if (!MIME[ext] || ['.html', '.js', '.css', '.json'].includes(ext)) return send(res, 415, { error: `Unsupported file type ${ext || '(none)'}` });
    const body = await readBody(req, MAX_UPLOAD);
    const id = `${randomUUID()}${ext}`;
    writeFileSync(join(UPLOADS, id), body);
    return send(res, 200, { id, name, kind, size: body.length, type: MIME[ext], url: `/uploads/${id}` });
  }

  if (req.method === 'POST' && url.pathname === '/api/submit') {
    const { answers, secrets = {}, target } = await readJsonBody(req);
    const name = answers?.identity?.name?.trim();
    if (!name) return send(res, 422, { error: 'A brand name is required' });
    const slug = isSlug(answers.identity.slug) ? answers.identity.slug : slugify(name);
    answers.identity.slug = slug;

    const allowed = Object.fromEntries(Object.entries(secrets).filter(([k, v]) => SERVICE_KEYS.includes(k) && typeof v === 'string' && v.trim()));
    const keysWritten = upsertEnv(allowed);

    mkdirSync(brandDir(slug), { recursive: true });
    const previous = readJson(join(brandDir(slug), 'onboarding.json'));
    persistUploads(answers, slug);
    const record = {
      version: 1,
      slug,
      mode: target && target !== 'new' ? 'update' : previous ? 'update' : 'new',
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      keysProvided: keysWritten,
      answers,
    };
    const file = join(brandDir(slug), 'onboarding.json');
    writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    const result = { ok: true, slug, file: relative(ROOT, file), mode: record.mode, keysWritten };
    writeFileSync(COMPLETE, JSON.stringify({ ...result, completedAt: record.updatedAt }, null, 2));
    rmSync(DRAFT, { force: true });
    send(res, 200, result);
    console.log(`ONBOARDING_COMPLETE ${JSON.stringify(result)}`);
    setTimeout(() => shutdown(0), 600);
    return;
  }

  send(res, 404, { error: 'Unknown endpoint' });
}

const server = createServer(async (req, res) => {
  lastActivity = Date.now();
  try {
    const host = (req.headers.host ?? '').split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return send(res, 403, { error: 'Forbidden host' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (url.pathname.startsWith('/uploads/')) {
      const file = join(UPLOADS, basename(url.pathname));
      return serveFile(res, file);
    }
    if (url.pathname.startsWith('/files/brands/')) {
      const file = normalize(join(ROOT, decodeURIComponent(url.pathname.slice('/files/'.length))));
      return within(PATHS.brands, file) ? serveFile(res, file) : send(res, 403, { error: 'Forbidden' });
    }
    const file = normalize(join(APP_DIR, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
    return within(APP_DIR, file) ? serveFile(res, file) : send(res, 404, { error: 'Not found' });
  } catch (err) {
    send(res, err.status ?? 500, { error: err.message });
  }
});

function shutdown(code) {
  rmSync(SESSION, { force: true });
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 1500).unref();
}

function listen(port, attemptsLeft = 20) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) listen(port + 1, attemptsLeft - 1);
    else { console.error(`ONBOARDING_ERROR ${err.message}`); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const address = `http://127.0.0.1:${port}/?t=${token}`;
    writeFileSync(SESSION, JSON.stringify({ url: address, pid: process.pid, port, startedAt: new Date().toISOString(), brand: editing ?? null }, null, 2));
    console.log(`ONBOARDING_URL ${address}`);
  });
}

setInterval(() => {
  if (Date.now() - lastActivity > IDLE_MS) {
    console.log('ONBOARDING_TIMEOUT idle; the draft is saved and can be resumed with /onboard-me');
    shutdown(3);
  }
}, 60_000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(130));

listen(Number(flag('--port') ?? 4747));
