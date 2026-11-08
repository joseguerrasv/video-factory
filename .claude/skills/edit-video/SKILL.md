---
name: edit-video
description: Edit raw footage into a finished, on-brand video like a professional editor. Handles transcription, silence and mistake cuts, story and beat planning, motion graphics, captions, B-roll, music and sound with HyperFrames, then a draft render, self-verification from real frames, and learning from every correction. Use for any "edit this video / clip / recording / footage" request; it routes Shorts, Reels, ads, showreels and single operations to the specialist skills.
argument-hint: "<path to footage> [format] [notes]"
---

# Edit a video

You are the editor. The brand kit decides the look and the defaults. The learnings decide what never to repeat. The rendered frames decide whether you are done.

## 0. Load the brand and the lessons

The session-start hook prints the active brand context. If it is missing or stale, run `node scripts/factory.mjs context`. No brand means you run `/onboard-me` first. Then read, in order:

1. `brands/<brand>/BRAND.md` for voice and on-screen copy;
2. `frame.md` for tokens, which are the only allowed colors, fonts and radii;
3. `profile.json` for editing parameters;
4. `learnings.md`: follow the **Rules**, never retry anything under **Never again**, and prefer **What works**;
5. `learnings/technical.md`.

## House style and notes

`docs/EDITING-PLAYBOOK.md` (from Nate Herk's herk-edit-kit) holds a measured
reel style: pacing, layouts, captions, B-roll order, sound palette, the
long-to-Short and narrated-explainer variants, and lessons that cost time. Use it
only to fill gaps: the active brand's `frame.md`, `profile.json` and
`learnings.md` win over it, and the user's brief wins over everything.

## 1. Intake and route

```bash
node scripts/factory.mjs new-video <slug> --source <path-or-inbox-file> [--format youtube|shorts|course|podcast|ads|showreel|social|events]
```

This creates `video-projects/<slug>/` with the brand's `frame.md`, `brand/tokens.css`, the brand fonts and logo, `assets/raw.*` (hardlinked, never modified), `meta.json` sized for the format, `project.json` and `FEEDBACK.md`. Then run `ffprobe` on the source to check duration, resolution, fps, audio and rotation.

Route by format, or by the user's words:

| Format | Owner |
| --- | --- |
| youtube, course, events | this pipeline |
| shorts, podcast, ads, social | `short-form-edit` (same brand rules and verification below) |
| showreel | `motion-showreel` |
| a single operation | `cut-silences`, `cut-mistakes`, `embedded-captions`, `talking-head-recut` |

## 2. Transcribe (word level)

```bash
node scripts/transcribe.mjs video-projects/<slug>/assets/raw.<ext>
```

The provider comes from the brand profile. An existing transcript is reused, so you never pay twice. Skim the transcript for the story before cutting.

Scan the raw audio for capture dropouts too: `node scripts/audio-dropouts.mjs video-projects/<slug>/assets/raw.<ext>`. Exit 2 means the recorder lost audio inside speech (a live mic never records exact zeros). Repair a hit inside a select in a copy of the take before cutting (see `learnings/technical.md`). Scan the raw file only: processed audio and renders hide the hole.

## 3. Cut silences with the brand's pacing

Use the exact `--gap/--head-pad/--tail-pad` values from the context. Follow `cut-silences`. It outputs `assets/edited-silenced.mp4` plus the retimed transcript.

## 4. Cut mistakes

Follow `cut-mistakes`. Fillers and retakes follow `profile.editing.cutMistakes`. If the checkpoints include `cuts`, show the review (`scripts/build-edl-review.mjs`) and wait for approval before applying. Intentional repetition is not a mistake. From here on, use only the final video and its retimed transcript. Never mix timelines.

## 5. Story and beat plan

Load `video-storytelling` and `hyperframes-video-beats`, then write `BEATS.md`. It has one row per beat: transcript anchor phrase, time, the idea on screen, the `frame.md` component, the asset needed with its source, and the camera treatment. Pro standards:

- **Hook in the first 3 seconds.** Open on the strongest line or visual; move slow setup later.
- **One idea on screen at a time**, entering on its spoken word and holding at least the brand's `min-hold`.
- **Pattern interrupts** every 8 to 15 seconds on talking heads: punch-in, B-roll, graphic or layout change. Use only treatments from `profile.editing.faceTreatments`, at the brand's motion intensity and B-roll density.
- **Cover jump cuts** with B-roll or a scale change. Use J and L cuts so audio leads or trails a picture change naturally.
- **Faces stay clear.** Graphics use the free thirds and respect title-safe.
- **End with the brand CTA**, then a clean out.

If the checkpoints include `beats`, show `BEATS.md` before building.

## 6. Assets

Use sources in this order:

1. the user's footage;
2. web capture (screenshots or recordings with `npx hyperframes capture`);
3. stock (Pexels, if the key is set);
4. AI generation (`media-use`, or kie.ai with the `motion-showreel` client).

Respect `profile.services.spend`:

- `ask`: list the assets and estimated cost, then wait;
- `cap`: stay under the cap;
- `never`: no paid calls.

Record every asset in `assets/LEDGER.md` with its source, license or task id, and cost. Localize everything: no render-time network fetches.

## 7. Build the composition

Start at the `hyperframes` router. Use:

- `talking-head-recut` for overlay cards on talking-head footage;
- `embedded-captions` for captions in the brand's caption style;
- `hyperframes-core` for the contract;
- `hyperframes-animation` and `hyperframes-keyframes` for motion and punch-ins;
- `hyperframes-audio` for the mix (music ducked about 18 dB under the voice, SFX subtle);
- `media-use` for music and SFX.

Link `brand/tokens.css` and use only `frame.md` tokens and the brand fonts in `brand/assets/fonts`.

## 8. Validate

From the project dir, run:

```bash
npx hyperframes lint && npx hyperframes check
node ../../scripts/preflight.mjs .
```

For anchored sub-compositions, also run `node ../../scripts/validate-beat-sync.mjs .`. Fix every error; lint passing does not mean it looks good.

## 9. Draft render and self-verification (mandatory)

```bash
npx hyperframes render --quality draft --output renders/draft-v1.mp4
node ../../scripts/verify-render.mjs renders/draft-v1.mp4 --transcript assets/<final-transcript>.json
```

Read `REPORT.md`, the contact sheet, and the frames at every beat entrance and every transition (add `--at t1,t2,...` for exact moments). Check against:

- the REPORT checklist;
- the brand's Pre-Render Self-Audit in `frame.md`;
- the brand learnings.

Fix, re-render and re-verify, up to three internal rounds, before the user sees anything. For long videos or before the final render, also run the `watch` skill on the render at `balanced` detail, which gives a viewer's scene-by-scene pass with the transcript, and compare it against `BEATS.md`. Record what you checked and fixed in `VERIFY.md`. A failure you could not fix becomes a technical learning.

## 10. Deliver

If the checkpoints include `draft`, show the draft and ask. Otherwise:

1. Render final: `npx hyperframes render --output renders/<slug>-final.mp4`, at the brand's fps and scale.
2. Verify it again.
3. Produce the deliverables from `profile.workflow.deliverables`:
   - SRT via `npx hyperframes transcribe <transcript.json> --to srt`;
   - HEVC or ProRes via ffmpeg `hevc_videotoolbox` or `prores_videotoolbox`;
   - for long-form YouTube, the title and thumbnail come from the `youtube-package` skill (step 4), not from verify frames;
   - a vertical cutdown via `short-form-edit`.

Hand off with:

- the final path;
- three bullets on the creative choices;
- one question inviting feedback.

Set `project.json` status to `delivered`.

4. **Long-form YouTube video → run the `youtube-package` skill right away** (transcript → 10 titles and a pick →
   3 one-piece thumbnails → one approval). Shorts skip it.
5. **If the brand has `brands/<slug>/delivery.json`, run the `deliver-video` skill:** read the video's row first,
   its Category picks the Drive folder; video + SRT to `Ready/<category>`, transcript to its `Transcripts/`.

## Learning loop (every time, no exceptions)

- **Any correction from the user**:
  1. `node scripts/factory.mjs feedback "<their exact words>"`;
  2. make the change, re-render and re-verify;
  3. fill in "Changes made" and "Learned" in `FEEDBACK.md`.
- **Would this apply to their future videos?** Record it at brand level:
  - `learn rule "..."` for a preference;
  - `learn avoid "..."` for something they rejected;
  - `learn win "..."` for something they approved or praised.
  Include `--why`. Skip one-off content fixes such as typos or a specific name.
- **Tool or pipeline failure** (a render crash, a bad generation model, an API quirk, an ffmpeg flag): `learn avoid "..." --technical --why "..."`.
- Say in one line what you learned. Never add a duplicate: if a rule already exists and was violated, fix the edit and tighten the rule's wording instead.
- **After an approved delivery**, record one to three wins.
