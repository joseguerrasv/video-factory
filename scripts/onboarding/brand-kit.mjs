import { contrast, mix, normalizeHex, readableOn } from './app/colors.js';
import { FORMAT_LABELS } from './app/steps.js';

export const FORMAT_SPECS = {
  youtube: { width: 1920, height: 1080, aspect: '16:9', skill: 'edit-video' },
  shorts: { width: 1080, height: 1920, aspect: '9:16', skill: 'short-form-edit' },
  course: { width: 1920, height: 1080, aspect: '16:9', skill: 'edit-video' },
  podcast: { width: 1080, height: 1920, aspect: '9:16', skill: 'short-form-edit' },
  ads: { width: 1080, height: 1920, aspect: '9:16', skill: 'short-form-edit' },
  showreel: { width: 1920, height: 1080, aspect: '16:9', skill: 'motion-showreel' },
  social: { width: 1080, height: 1350, aspect: '4:5', skill: 'short-form-edit' },
  events: { width: 1920, height: 1080, aspect: '16:9', skill: 'edit-video' },
};

const QUALITY = {
  '1080p30': { fps: 30, scale: 1, label: '1080p 30fps' },
  '1080p60': { fps: 60, scale: 1, label: '1080p 60fps' },
  '4k30': { fps: 30, scale: 2, label: '4K 30fps' },
};

const RADII = {
  'dark-premium': 16, 'clean-corporate': 12, 'bold-energetic': 20, 'warm-editorial': 6, 'neon-electric': 14,
  monochrome: 0, 'pastel-soft': 24, 'nature-earth': 12, 'jewel-rich': 10,
};

const MOTION = {
  minimal: { entrance: '0.6s', exit: '0.35s', ease: 'power2.out', stagger: '0.08s', holdMin: '2.5s', rule: 'One element moves at a time. Titles and lower thirds only; no decorative loops.' },
  balanced: { entrance: '0.45s', exit: '0.3s', ease: 'power3.out', stagger: '0.06s', holdMin: '1.8s', rule: 'Animate on key points only: one callout per idea, entrances land on the spoken word.' },
  high: { entrance: '0.3s', exit: '0.22s', ease: 'expo.out', stagger: '0.04s', holdMin: '1.2s', rule: 'Something new on screen every few seconds; kinetic type and punch-ins allowed, cuts snap to beats.' },
};

const CAPTIONS = {
  none: null,
  clean: { case: 'sentence', weight: 500, cqw: 1.9, wordsPerLine: 7, highlight: false, hyperframes: 'embedded-captions: quiet anchor rail' },
  pop: { case: 'upper', weight: 800, cqw: 4.2, wordsPerLine: 3, highlight: true, hyperframes: 'embedded-captions: bold word pop, active word in accent' },
  karaoke: { case: 'sentence', weight: 700, cqw: 3, wordsPerLine: 6, highlight: true, hyperframes: 'embedded-captions: karaoke fill, spoken words turn full opacity' },
  cinematic: { case: 'lower', weight: 800, cqw: 12, wordsPerLine: 1, highlight: false, hyperframes: 'embedded-captions: cinematic, embedded behind the subject (matting)' },
};

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const band = (v, low, mid, high) => (v < 34 ? low : v > 66 ? high : mid);

export function derivePalette(colors = {}) {
  const bg = normalizeHex(colors.background) ?? '#0E0F12';
  const text = normalizeHex(colors.text) ?? readableOn(bg);
  const primary = normalizeHex(colors.primary) ?? '#3B82F6';
  const accent = normalizeHex(colors.accent) ?? primary;
  return {
    bg,
    surface: mix(bg, text, 0.07),
    'surface-2': mix(bg, text, 0.13),
    text,
    'text-muted': mix(text, bg, 0.38),
    border: mix(bg, text, 0.18),
    primary,
    'on-primary': readableOn(primary),
    accent,
    'on-accent': readableOn(accent),
    'caption-text': '#FFFFFF',
    'caption-highlight': contrast(accent, '#111114') > 4 ? accent : primary,
    scrim: 'rgba(0,0,0,0.55)',
  };
}

export function buildProfile(record) {
  const a = record.answers;
  const selected = a.formats?.selected?.length ? a.formats.selected : ['youtube'];
  const quality = QUALITY[a.formats?.quality] ?? QUALITY['1080p30'];
  const pacing = Number(a.editing?.pacing ?? 50);
  const captionStyle = a.editing?.captions?.style ?? 'clean';
  const wantsAi = (a.editing?.broll?.sources ?? []).includes('ai');
  const generatedMusic = a.editing?.music?.mood !== 'none' && a.editing?.music?.source === 'generated';
  const logos = (a.visual?.logos ?? []).map((l) => l.path).filter(Boolean);

  return {
    version: 1,
    slug: record.slug,
    updatedAt: record.updatedAt,
    identity: {
      name: a.identity?.name,
      tagline: a.identity?.tagline ?? '',
      type: a.identity?.type,
      website: a.identity?.website ?? '',
      language: a.identity?.language ?? 'English',
      host: a.identity?.host ?? {},
      handles: Object.fromEntries(Object.entries(a.identity?.handles ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v.replace(/^@/, '')])),
    },
    audience: { who: a.audience?.who ?? '', level: a.audience?.level ?? 'mixed' },
    voice: {
      energy: a.voice?.energy ?? 50, playful: a.voice?.playful ?? 50, bold: a.voice?.bold ?? 50, polish: a.voice?.polish ?? 50,
      adjectives: a.voice?.adjectives ?? [],
      cta: a.voice?.cta ?? '',
      summary: [
        band(a.voice?.energy ?? 50, 'calm', 'steady', 'high-energy'),
        band(a.voice?.playful ?? 50, 'serious', 'warm', 'playful'),
        band(a.voice?.bold ?? 50, 'minimal', 'confident', 'bold'),
        band(a.voice?.polish ?? 50, 'raw', 'clean', 'polished'),
      ].join(', '),
    },
    formats: {
      selected,
      primary: a.formats?.primary && selected.includes(a.formats.primary) ? a.formats.primary : selected[0],
      specs: Object.fromEntries(selected.map((f) => [f, { label: FORMAT_LABELS[f] ?? f, ...FORMAT_SPECS[f], fps: quality.fps, renderScale: quality.scale }])),
      footage: a.formats?.footage ?? [],
      camera: a.formats?.camera ?? 'mixed',
      quality: a.formats?.quality ?? '1080p30',
    },
    editing: {
      pacing: { value: pacing, label: band(pacing, 'breathe', 'balanced', 'tight') },
      cutSilences: { gap: round(0.9 - 0.55 * (pacing / 100)), headPad: round(0.3 - 0.1 * (pacing / 100)), tailPad: round(0.45 - 0.15 * (pacing / 100)) },
      cutMistakes: { fillers: a.editing?.removeFillers ?? true, retakes: a.editing?.removeRetakes ?? true },
      captions: { style: captionStyle, position: a.editing?.captions?.position ?? 'bottom', ...(CAPTIONS[captionStyle] ?? {}) },
      motion: { intensity: a.editing?.motion ?? 'balanced', ...MOTION[a.editing?.motion ?? 'balanced'] },
      broll: { density: a.editing?.broll?.density ?? 'light', sources: a.editing?.broll?.sources ?? ['own'] },
      faceTreatments: a.editing?.faceTreatments ?? [],
      music: { mood: a.editing?.music?.mood ?? 'subtle', source: a.editing?.music?.source ?? 'library', duckUnderVoiceDb: -18 },
      sfx: a.editing?.sfx ?? 'subtle',
      transitions: a.editing?.transitions ?? 'subtle',
      audio: { targetLufs: -14, truePeakDb: -1 },
    },
    services: {
      transcription: a.services?.transcription ?? 'local',
      generation: { kie: wantsAi || generatedMusic, stock: (a.editing?.broll?.sources ?? []).includes('stock') ? 'pexels' : null, webCapture: (a.editing?.broll?.sources ?? []).includes('web') },
      spend: { mode: a.services?.spend?.mode ?? 'ask', capUsd: a.services?.spend?.mode === 'cap' ? Number(a.services?.spend?.capUsd ?? 5) : null },
    },
    workflow: {
      autonomy: a.workflow?.autonomy ?? 'plan-first',
      checkpoints: a.workflow?.autonomy === 'autopilot' ? [] : a.workflow?.checkpoints ?? ['cuts', 'assets'],
      deliverables: a.workflow?.deliverables ?? ['mp4'],
      notes: a.workflow?.notes ?? '',
    },
    design: {
      theme: a.visual?.theme ?? 'dark',
      vibe: a.visual?.vibe ?? 'dark-premium',
      palette: derivePalette(a.visual?.colors),
      fonts: { heading: a.visual?.fonts?.heading ?? 'Geist', body: a.visual?.fonts?.body ?? a.visual?.fonts?.heading ?? 'Geist' },
      radius: RADII[a.visual?.vibe] ?? 12,
      logos,
      guidelines: (a.visual?.guidelines ?? []).map((g) => g.path).filter(Boolean),
    },
    taste: {
      references: (a.taste?.references ?? []).filter((r) => r.url?.trim()),
      admire: a.taste?.admire ?? '',
      dislikes: a.taste?.dislikes ?? [],
      never: a.taste?.never ?? '',
    },
  };
}

export function buildTokensCss(profile, fontFaces) {
  const p = profile.design.palette;
  const m = profile.editing.motion;
  const lines = Object.entries(p).map(([k, v]) => `  --brand-${k}: ${v};`);
  return `/* Generated from brands/${profile.slug}/onboarding.json by scripts/onboarding/generate.mjs.
   Re-run onboarding or edit frame.md, then regenerate. Paths are relative to this file. */
${fontFaces.join('\n')}

:root {
${lines.join('\n')}
  --brand-font-heading: '${profile.design.fonts.heading}', system-ui, sans-serif;
  --brand-font-body: '${profile.design.fonts.body}', system-ui, sans-serif;
  --brand-radius: ${profile.design.radius}px;
  --brand-radius-pill: 999px;
  --brand-ease: ${m.ease};
  --brand-dur-in: ${m.entrance};
  --brand-dur-out: ${m.exit};
  --brand-stagger: ${m.stagger};
}
`;
}

const yamlStr = (s) => JSON.stringify(String(s ?? ''));

export function buildFrameFrontmatter(profile) {
  const p = profile.design.palette;
  const { heading, body } = profile.design.fonts;
  const c = profile.editing.captions;
  const m = profile.editing.motion;
  const r = profile.design.radius;
  const formats = profile.formats.selected.map((f) => `${FORMAT_SPECS[f]?.width}x${FORMAT_SPECS[f]?.height} (${f})`).join(', ');
  return `---
version: alpha
name: ${yamlStr(`${profile.identity.name} Frame`)}
description: >
  Video-first design system for ${profile.identity.name}. Generated from onboarding; tokens in this frontmatter are the source of truth.
unit: ${yamlStr(`the frame; ${formats}`)}
principle: "brand atoms are sacred, composition is free, numbers come from the script"

colors:
${Object.entries(p).map(([k, v]) => `  ${k}: ${yamlStr(v)}`).join('\n')}

radii:
  card: "${r}px"
  control: "${Math.max(0, Math.round(r * 0.6))}px"
  pill: "999px"

typography:
  display:  { fontFamily: ${yamlStr(heading)}, cqw: 4.6, weight: 700, lineHeight: 1.04, tracking: "-0.025em", color: "text" }
  h2:       { fontFamily: ${yamlStr(heading)}, cqw: 3.0, weight: 650, lineHeight: 1.1, tracking: "-0.02em", color: "text" }
  eyebrow:  { fontFamily: ${yamlStr(body)}, cqw: 1.05, weight: 600, tracking: "0.06em", upper: true, color: "accent" }
  body:     { fontFamily: ${yamlStr(body)}, cqw: 1.6, weight: 400, lineHeight: 1.45, color: "text-muted" }
  stat:     { fontFamily: ${yamlStr(heading)}, cqw: 6.0, weight: 750, lineHeight: 1.0, color: "primary" }
  lower-third-name:  { fontFamily: ${yamlStr(heading)}, cqw: 1.7, weight: 650, color: "text" }
  lower-third-title: { fontFamily: ${yamlStr(body)}, cqw: 1.15, weight: 400, color: "text-muted" }
${c.style ? `  caption:  { fontFamily: ${yamlStr(c.style === 'clean' ? body : heading)}, cqw: ${c.cqw}, weight: ${c.weight}, case: ${yamlStr(c.case)}, color: "caption-text", highlight: "${c.highlight ? 'caption-highlight' : 'none'}" }` : ''}

spacing:
  safe-title: "5%"
  safe-action: "3.5%"
  pad-x: "5cqw"
  pad-y: "5cqw"
  gap: "1.4cqw"

components:
  lower-third:
    backgroundColor: "{colors.surface}"
    accentBar: "{colors.accent}, 0.5cqw wide"
    rounded: "{radii.card}"
    typography: "{typography.lower-third-name} + {typography.lower-third-title}"
    description: "Name caption for ${profile.identity.host?.name || 'the host'}. Bottom-left inside title-safe, never over the face."
  callout-card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{radii.card}"
    description: "One idea per card. Enters on its transcript anchor, exits before the next idea."
  caption:
    style: ${yamlStr(c.style ?? 'none')}
    position: ${yamlStr(c.position ?? 'bottom')}
    wordsPerLine: ${c.wordsPerLine ?? 0}
    description: ${yamlStr(c.hyperframes ?? 'No captions by default')}
  logo-bug:
    source: ${yamlStr(profile.design.logos[0] ?? 'text mark using {typography.display}')}
    placement: "top-left inside title-safe, 6cqw tall"
  title-card:
    backgroundColor: "{colors.bg}"
    typography: "{typography.eyebrow} + {typography.display}"
    description: "Opening and chapter titles."

motion:
  intensity: ${yamlStr(m.intensity)}
  ease: ${yamlStr(m.ease)}
  entrance: ${yamlStr(m.entrance)}
  exit: ${yamlStr(m.exit)}
  stagger: ${yamlStr(m.stagger)}
  min-hold: ${yamlStr(m.holdMin)}
---`;
}

export function buildFrameBody(profile) {
  const id = profile.identity;
  const p = profile.design.palette;
  const never = [...profile.taste.dislikes, ...splitLines(profile.taste.never)];
  return `
## Overview

${id.name}${id.tagline ? `: ${id.tagline}` : ''}. Voice: ${profile.voice.summary}${profile.voice.adjectives.length ? ` (${profile.voice.adjectives.join(', ')})` : ''}. Audience: ${profile.audience.who || 'not specified'}.

## The Frame

Primary canvas: ${FORMAT_SPECS[profile.formats.primary]?.width}x${FORMAT_SPECS[profile.formats.primary]?.height} (${profile.formats.primary}). Keep text inside the 5% title-safe area and all motion inside 3.5% action-safe. The speaker's face is the hero: graphics live in the free thirds of the frame and never cover eyes or mouth.

## Colors

| Token | Hex | Role |
|---|---|---|
| bg | ${p.bg} | Canvas and title cards |
| surface | ${p.surface} | Cards, lower thirds, panels |
| text | ${p.text} | Primary text |
| text-muted | ${p['text-muted']} | Secondary text |
| primary | ${p.primary} | Brand color: key shapes, stats, logo fills |
| accent | ${p.accent} | Highlights, active caption word, accent bars. Use sparingly |

## Typography

${profile.design.fonts.heading} for display, titles and numbers. ${profile.design.fonts.body} for body, labels and captions where legibility matters. Never introduce a third family.

## Motion

Intensity ${profile.editing.motion.intensity}. ${profile.editing.motion.rule} Default ease ${profile.editing.motion.ease}, entrances ${profile.editing.motion.entrance}, exits ${profile.editing.motion.exit}, minimum hold ${profile.editing.motion.holdMin}.

## Composition Rules

- One idea on screen at a time; every graphic is anchored to a transcript phrase.
- Lower third appears once per speaker per video, within the first 20 seconds of them speaking.
- Captions: ${profile.editing.captions.style === 'none' ? 'off by default.' : `${profile.editing.captions.style}, ${profile.editing.captions.position}.`}
- B-roll density: ${profile.editing.broll.density}; allowed sources: ${profile.editing.broll.sources.join(', ') || 'none'}.

## Aspect-Ratio Behavior

- 16:9: graphics in the left or right third opposite the speaker.
- 9:16: captions sit above the bottom UI zone (keep the lower 18% clear), graphics in the top half.
- 4:5 and 1:1: center-weighted; shrink display type one step.

## Do's and Don'ts

${never.length ? never.map((n) => `- Don't: ${n}`).join('\n') : '- Add rules here as feedback comes in.'}

## Pre-Render Self-Audit

- Brand hex values and fonts match this file exactly.
- No text outside title-safe; nothing covers the face.
- Every graphic enters on its spoken anchor and holds at least ${profile.editing.motion.holdMin}.
- Loudness near ${profile.editing.audio.targetLufs} LUFS, true peak under ${profile.editing.audio.truePeakDb} dBTP.
- Nothing from the brand's "Never again" learnings appears.
`;
}

export function buildBrandMd(profile, record) {
  const id = profile.identity;
  const handles = Object.entries(id.handles).map(([k, v]) => `${k}: @${v}`).join(', ');
  return `# ${id.name}

> ${id.tagline || 'One-line promise not set yet.'}

This is the brand brief Claude reads before every edit. Visual tokens live in \`frame.md\`, machine settings in \`profile.json\`, and everything learned from feedback in \`learnings.md\`.

## Identity

- Type: ${id.type ?? 'creator'}
- Website: ${id.website || 'not set'}
- On camera: ${id.host?.name ? `${id.host.name}${id.host.title ? `, ${id.host.title}` : ''}` : 'not set'}
- Language: ${id.language}
- Handles: ${handles || 'none'}

## Audience

${profile.audience.who || 'Not described yet.'} Knowledge level: ${profile.audience.level}.

## Voice

${profile.voice.summary}${profile.voice.adjectives.length ? `. Words: ${profile.voice.adjectives.join(', ')}` : ''}.
Default call to action: ${profile.voice.cta || 'not set'}.

## What we make

${profile.formats.selected.map((f) => `- ${FORMAT_LABELS[f] ?? f} (${FORMAT_SPECS[f]?.aspect})${f === profile.formats.primary ? ' (primary)' : ''}`).join('\n')}

Raw footage is usually: ${profile.formats.footage.join(', ') || 'not specified'} (shot on ${profile.formats.camera}). Export: ${profile.formats.quality}.

## Editing defaults

- Pacing: ${profile.editing.pacing.label} (silence gap ${profile.editing.cutSilences.gap}s)
- Cut fillers: ${profile.editing.cutMistakes.fillers ? 'yes' : 'no'}; cut retakes: ${profile.editing.cutMistakes.retakes ? 'yes' : 'no'}
- Captions: ${profile.editing.captions.style}${profile.editing.captions.style !== 'none' ? `, ${profile.editing.captions.position}` : ''}
- Motion graphics: ${profile.editing.motion.intensity}
- B-roll: ${profile.editing.broll.density} from ${profile.editing.broll.sources.join(', ') || 'nowhere'}
- Camera treatments: ${profile.editing.faceTreatments.join(', ') || 'none'}
- Music: ${profile.editing.music.mood}${profile.editing.music.mood !== 'none' ? ` (${profile.editing.music.source})` : ''}; SFX: ${profile.editing.sfx}; transitions: ${profile.editing.transitions}

## Taste

- Admires: ${profile.taste.admire || 'not set'}
- References: ${profile.taste.references.length ? `${profile.taste.references.length} (see references.md)` : 'none yet'}
- Never: ${[...profile.taste.dislikes, ...splitLines(profile.taste.never)].join('; ') || 'nothing listed yet'}

## Workflow

- Autonomy: ${profile.workflow.autonomy}
- Stop for: ${profile.workflow.checkpoints.join(', ') || 'nothing, deliver finished drafts'}
- Paid generation: ${profile.services.spend.mode}${profile.services.spend.capUsd ? ` up to $${profile.services.spend.capUsd} per video` : ''}
- Deliverables: ${profile.workflow.deliverables.join(', ')}
${profile.workflow.notes ? `\n## Notes from onboarding\n\n${profile.workflow.notes}\n` : ''}
<!-- onboarding ${record.updatedAt} -->
`;
}

export function buildReferencesMd(profile) {
  const refs = profile.taste.references;
  return `# ${profile.identity.name}: reference videos

Status: not analyzed yet. Ask Claude to "analyze my references" to watch each one and distill a style guide into \`style/\`.

${refs.length ? refs.map((r, i) => `${i + 1}. ${r.url}${r.note ? `\n   Loves: ${r.note}` : ''}`).join('\n') : 'No references yet. Paste links here any time.'}
${profile.taste.admire ? `\nAdmired creators and brands: ${profile.taste.admire}\n` : ''}`;
}

export function splitLines(text = '') {
  return String(text).split(/\n|(?<=[.;])\s+/).map((s) => s.trim().replace(/[.;]$/, '')).filter((s) => s.length > 2);
}
