import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTitle, numbersIn, titlesFromText } from '../scripts/youtube/check-titles.mjs';

test('numbersIn reads digits and spelled-out numbers the way scripts say them', () => {
  const found = numbersIn('Twelve thousand four hundred nineteen. A hundred nineteen, two forty-nine, three and a half hours, seventy-seven, 30%, $10k, $12,419');
  for (const n of [12419, 119, 249, 3.5, 77, 30, 10000]) assert.ok(found.has(n), `missing ${n}`);
});

test('checkTitle fails invented numbers, hype phrases, exclamation marks and emoji', () => {
  const sourceNumbers = numbersIn('seventy-seven new paying members in seven days');
  assert.equal(checkTitle('He Added a Cheaper Tier and Got 77 Members in 7 Days', { sourceNumbers }).level, 'pass');
  const r = checkTitle('77 Members in 8 Days and It Was Easy', { sourceNumbers });
  assert.equal(r.level, 'fail');
  assert.match(r.issues[0].msg, /number 8/);
  assert.equal(checkTitle('The insane tier trick for your community', { avoid: ['insane'] }).level, 'fail');
  assert.equal(checkTitle('How he launched tiers for his community!').level, 'fail');
  assert.equal(checkTitle('How he launched tiers for his community 🚀').level, 'fail');
});

test('checkTitle warns on long titles and stacked caps, and previews the mobile cut', () => {
  const long = checkTitle('How One Skool Creator Rebuilt His Entire Offer Stack Around Three Membership Tiers');
  assert.equal(long.level, 'warn');
  assert.ok(long.mobile.endsWith('…') && [...long.mobile].length <= 46);
  assert.equal(checkTitle('The CHEAP Tier That Made MORE Money').level, 'warn');
  assert.equal(checkTitle('Why AI Agents Beat a VIP Tier in Skool').level, 'pass');
});

test('framework rules: no colons, questions or salesy words; keywords and pairs', () => {
  assert.equal(checkTitle('He Added a Cheaper Tier and Made MORE Money: 77 Members').level, 'fail');
  assert.equal(checkTitle('Is a Cheaper Skool Tier Worth It For You').level, 'pass');
  assert.equal(checkTitle('Is a Cheaper Skool Tier Worth It For You?').level, 'fail');
  assert.equal(checkTitle('Unlock Your Skool Community Growth Plan').level, 'fail');
  assert.equal(checkTitle('Why Most Free Skool Communities Never Make a Sale', { keywords: ['skool'] }).level, 'pass');
  assert.equal(checkTitle('Why most free communities never make a sale', { keywords: ['skool'] }).level, 'warn');
  const pairs = '[BAD] How to grow a Skool community\n[CLICKABLE] Why My Skool Grew Faster After I Closed Free Access\n\n[BAD] Tips\n[CLICKABLE] Don\'t Launch a Paid Skool Until You Fix This';
  assert.deepEqual(titlesFromText(pairs), ['Why My Skool Grew Faster After I Closed Free Access', "Don't Launch a Paid Skool Until You Fix This"]);
});

test('generate-image: cost from usage and a pre-spend estimate', async () => {
  const { costOf, estimate } = await import('../scripts/youtube/generate-image.mjs');
  const usd = costOf({ input_tokens_details: { text_tokens: 100_000, image_tokens: 0 }, output_tokens: 100_000 }, 'gpt-image-2.5-sunburst');
  assert.equal(usd.toFixed(2), '3.50'); // 0.1M text at $5 + 0.1M image out at $30
  assert.equal(costOf({ output_tokens: 1 }, 'unknown-model'), null);
  const bg = estimate('background', 'high', 'gpt-image-2.5-sunburst');
  assert.ok(bg > 0.05 && bg < 0.2, `background estimate ${bg}`);
  assert.equal(estimate('cover', 'high', 'gpt-image-2.5-sunburst').toFixed(6), bg.toFixed(6)); // same pixels, portrait
});

test('package: subtitles to transcript text and final-render pick', async () => {
  const { srtToText } = await import('../scripts/youtube/package.mjs');
  assert.equal(srtToText('1\n00:00:00,000 --> 00:00:01,000\nHello there\n\n2\n00:00:01,000 --> 00:00:02,000\n$17,000 in eight months\n'), 'Hello there $17,000 in eight months');
});

test('deliver-drive: Notion category maps to its Drive folder, unknown ones are refused', async () => {
  const { resolveTarget } = await import('../scripts/youtube/deliver-drive.mjs');
  const cfg = { drive: { root: '/drive/YouTube Uploads/Ready', categories: { 'Skool Wins Series': 'Skool Wins', 'Clinic / Audit Series': 'Diagnostic' } } };
  assert.equal(resolveTarget(cfg, 'Clinic / Audit Series').dir, '/drive/YouTube Uploads/Ready/Diagnostic');
  assert.match(resolveTarget(cfg, 'Skool Wins').error, /Unknown category/);
  // short-form goes to the category's Shorts/ subfolder
  assert.equal(resolveTarget(cfg, 'Skool Wins Series', true).dir, '/drive/YouTube Uploads/Ready/Skool Wins/Shorts');
  assert.equal(resolveTarget({drive: {...cfg.drive, shortsFolder: 'Reels'}}, 'Skool Wins Series', true).dir, '/drive/YouTube Uploads/Ready/Skool Wins/Reels');
});

test('short-cover: only the words change, everything else comes from the template', async () => {
  const { COVER, CUT, WORDMARK, coverPrompt, finishCover } = await import('../scripts/youtube/short-cover.mjs');
  const prompt = coverPrompt({ lead: 'The', number: '$17K', topic: 'Revenue' });
  assert.match(prompt, /"97%" becomes "\$17K", "Retention" becomes "Revenue"/);
  assert.doesNotMatch(prompt, /"The" becomes/);

  const { default: sharp } = await import('sharp');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'short-cover-'));
  const fill = async (name, background, width = COVER.width, height = COVER.height) => {
    await sharp({ create: { width, height, channels: 3, background } }).png().toFile(join(dir, name));
    return join(dir, name);
  };
  const template = await fill('template.png', '#FF0000');
  const base = await fill('base.png', '#0000FF');
  const white = await fill('white.png', '#FFFFFF', 1530, 2720);
  const out = join(dir, 'out.png');
  assert.equal((await finishCover({ generated: white, template, base, out })).crossesCut, false);

  const { data } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * COVER.width + x) * 3, (y * COVER.width + x) * 3 + 3)];
  assert.deepEqual(at(10, 10), [255, 255, 255]);
  assert.deepEqual(at(WORDMARK.left + 5, WORDMARK.top + 5), [255, 0, 0]);
  assert.deepEqual(at(10, CUT + 5), [0, 0, 255]);

  const dark = await fill('dark.png', '#000000', 1530, 2720);
  assert.equal((await finishCover({ generated: dark, template, base, out: join(dir, 'out2.png') })).crossesCut, true);
});
