import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const WEIGHT_WORDS = [
  [/thin|hairline/i, 100], [/extra-?light|ultra-?light/i, 200], [/light/i, 300], [/medium/i, 500],
  [/semi-?bold|demi-?bold/i, 600], [/extra-?bold|ultra-?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700],
];

export function guessWeight(fileName) {
  return WEIGHT_WORDS.find(([re]) => re.test(fileName))?.[1] ?? 400;
}

export const fileSlug = (family) => family.replace(/[^A-Za-z0-9]+/g, '');

async function fetchCss(family, weights) {
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`;
  for (const url of [`${base}:wght@${weights.join(';')}&display=block`, `${base}&display=block`]) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res.text();
  }
  throw new Error(`Google Fonts has no family named "${family}"`);
}

function latinFaces(css) {
  const faces = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g;
  for (const [, subset, body] of css.matchAll(re)) {
    if (subset !== 'latin') continue;
    const weight = Number(body.match(/font-weight:\s*(\d+)/)?.[1] ?? 400);
    const style = body.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal';
    const src = body.match(/url\(([^)]+\.woff2)\)/)?.[1];
    if (src) faces.push({ weight, style, src });
  }
  return faces;
}

export async function downloadGoogleFont(family, weights, outDir) {
  const css = await fetchCss(family, weights);
  const faces = latinFaces(css);
  if (!faces.length) throw new Error(`No latin woff2 faces returned for "${family}"`);
  mkdirSync(outDir, { recursive: true });
  const bySource = new Map();
  for (const face of faces) {
    const group = bySource.get(face.src) ?? { ...face, weights: [] };
    group.weights.push(face.weight);
    bySource.set(face.src, group);
  }
  const saved = [];
  for (const group of bySource.values()) {
    const min = Math.min(...group.weights);
    const max = Math.max(...group.weights);
    const weight = min === max ? min : `${min} ${max}`;
    const name = `${fileSlug(family)}-${min === max ? min : `${min}-${max}`}${group.style === 'italic' ? 'i' : ''}.woff2`;
    const res = await fetch(group.src, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`Download failed for ${family} ${weight}`);
    writeFileSync(join(outDir, name), Buffer.from(await res.arrayBuffer()));
    saved.push({ family, weight, style: group.style, file: name });
  }
  return saved;
}

export function fontFaceCss({ family, weight, style = 'normal', url, format = 'woff2' }) {
  return `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; font-display: block; src: url('${url}') format('${format}'); }`;
}

export const FORMAT_BY_EXT = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' };
