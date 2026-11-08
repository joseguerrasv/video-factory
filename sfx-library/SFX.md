# SFX library

Shared sound effects for every edit. Rebuild or extend it with `node scripts/sfx/install.mjs`. It keeps what's on disk and writes `manifest.json` with each file's duration, audible onset and peak, so a cue can land its hit on the frame instead of the file start.

| Source | What | Files | Licence |
| --- | --- | --- | --- |
| `kenney/interface-sounds` | Clicks, ticks, drops, confirmations, errors | 100 | CC0 |
| `kenney/ui-audio` | Mouse clicks, switches, rollovers | 50 | CC0 |
| `kenney/impact-sounds` | Soft thuds, wood, plate, glass | 130 | CC0 |
| `kenney/rpg-audio` | Book flips, cloth, coins, footsteps | 50 | CC0 |
| `mixkit/` | Curated whooshes, clicks, paper, typing, notifications, clocks | 45 | Mixkit Sound Effects Free License. Free in commercial video, not to be redistributed as files, so this folder stays out of git |
| HyperFrames `media-use` | 19 bundled Pixabay effects at `~/.claude/skills/media-use/audio/assets/sfx/` | 19 | Pixabay Content License |
| `elevenlabs/` | Custom effects from `node scripts/sfx/generate.mjs "<prompt>" --name <file>` | 0 | ElevenLabs output. The current key lacks the `sound_generation` permission, so this returns 401 until it's added in the ElevenLabs dashboard |
| `openverse/` | Effects fetched with `node scripts/sfx/search.mjs`: Freesound previews (128 kbps) converted to WAV | 0 | Per file, in `openverse/credits.json`. CC0 by default; a CC BY effect needs its credit in the video's description |

## When the library has no match

1. `node scripts/sfx/search.mjs "paper tear" --max 3` lists effects of 3 s or less, with no key. It shows CC0 only, so nothing needs a credit. Add `--license cc0,by` for more, or `--page 2` for the next 20 results. Other licences are refused, because they can't go in a commercial edit.
2. `node scripts/sfx/search.mjs --get <id> --name paper-tear-1` saves a 48 kHz stereo WAV to `openverse/`, records its licence and credit, and adds it to `manifest.json`. It prints the credit when a video has to carry one.

**Down for now:** Openverse has failed new requests since 2026-10-20 ([issue 5649](https://github.com/WordPress/openverse/issues/5649)). Only answers already in Cloudflare's cache come back, such as "whoosh", so most searches stop after 20 s with a message that says so. Until that's fixed, `elevenlabs/` is the way to get a sound the library doesn't have. Freesound's own API is not a clean swap: its terms leave commercial use to a deal with UPF.

## Sounds that have a job

Using one sound for one meaning is what lets effects walk a viewer through a video.

| Meaning | Sound |
| --- | --- |
| A real source appears | `mixkit/click/camera-shutter` |
| Something gets marked | Two strokes sliced from `mixkit/paper/scribble` (0.08-0.30 s, 0.30-0.52 s) |
| A number counts | `kenney/interface-sounds/tick_001`, pitched up as it climbs |
| A layout change | `mixkit/whoosh/arrow-whoosh`, `mixkit/whoosh/small-sweep`, aligned on the peak |
| A point lands | `kenney/impact-sounds/impactSoft_heavy_001` |
| A step done | `kenney/interface-sounds/confirmation_002` |
| A message sent | `mixkit/notify/message-pop` |
| Time running out | Tick and tock from `mixkit/clock/tick-tock-close` (0.08-0.30 s, 0.57-0.80 s) |
| No | `kenney/interface-sounds/error_004` |
