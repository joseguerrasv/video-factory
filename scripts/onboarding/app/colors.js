export const isHex = (v) => /^#([0-9a-f]{6})$/i.test(v ?? '');

export function normalizeHex(v) {
  if (!v) return null;
  let s = String(v).trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + [...s.slice(1)].map((c) => c + c).join('');
  return isHex(s) ? s.toUpperCase() : null;
}

export function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (r, g, b) => '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();

export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a, b, t) {
  const [ra, ga, ba] = toRgb(a);
  const [rb, gb, bb] = toRgb(b);
  return toHex(ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t);
}

export const readableOn = (bg) => (contrast(bg, '#FFFFFF') >= contrast(bg, '#111114') ? '#FFFFFF' : '#111114');

function saturation([r, g, b]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export async function extractPalette(src, count = 6) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const size = 96;
  const canvas = document.createElement('canvas');
  const ratio = (img.naturalWidth || size) / (img.naturalHeight || size);
  canvas.width = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
  canvas.height = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue;
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += data[i]; bucket.g += data[i + 1]; bucket.b += data[i + 2];
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .map(({ n, r, g, b }) => ({ n, rgb: [r / n, g / n, b / n] }))
    .map((c) => ({ ...c, score: c.n * (0.35 + saturation(c.rgb)) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const c of ranked) {
    if (picked.every((p) => distance(p.rgb, c.rgb) > 48)) picked.push(c);
    if (picked.length === count) break;
  }
  return picked.map((c) => toHex(...c.rgb));
}
