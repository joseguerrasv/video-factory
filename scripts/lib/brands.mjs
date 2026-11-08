import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, brandDir } from './paths.mjs';
import { readState } from './state.mjs';

export function slugify(input = '') {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'brand';
}

export const isSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s ?? '');

export function readJson(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function listBrands() {
  if (!existsSync(PATHS.brands)) return [];
  return readdirSync(PATHS.brands, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => {
      const profile = readJson(join(brandDir(d.name), 'profile.json'), {});
      return { slug: d.name, name: profile.identity?.name ?? d.name, ready: Boolean(profile.identity) };
    });
}

export function loadProfile(slug) {
  return readJson(join(brandDir(slug), 'profile.json'));
}

export function activeBrand() {
  const { activeBrand: slug } = readState();
  if (slug && existsSync(brandDir(slug))) return slug;
  const brands = listBrands().filter((b) => b.ready);
  return brands.length === 1 ? brands[0].slug : null;
}
