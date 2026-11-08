---
name: youtube-package
description: Package a finished LONG-FORM video for YouTube in one pass — final render and subtitles → transcript → 10 title pairs and a pick (youtube-titles) → 3 different one-piece thumbnails (youtube-thumbnail) → export and feed check → one approval message. Use right after a long-form edit is delivered, or when asked to "package", "title and thumbnail", "get it ready for YouTube" or "finish the YouTube side" of a video. Runs scripts/youtube/package.mjs as the checklist and resumes from wherever the project stopped.
---

# YouTube package (long-form)

**Scope:** long-form videos only, one brand at a time (the active brand's files; in a repo with several clients,
confirm the client first). Shorts, Reels and TikToks don't get this package.

The flow, start to finish, with as few stops for the user as possible:

```
edit delivered → package.mjs (transcript + status) → titles → pick → thumbnails (1 cost OK) → export + feed check → 1 approval
```

## Steps

1. **Status.** `node scripts/youtube/package.mjs <project-slug>`. It finds the final render and its `.srt`, writes
   `transcript-final.txt` (the only source titles and thumbnails may quote numbers and lines from), writes
   `PACKAGE.md`, and prints the next step. Re-run it after every step; it resumes, so nothing is redone.
2. **Titles** (no stop). Follow the `youtube-titles` skill: 10 BAD/CLICKABLE pairs into `<project>/titles.txt`,
   lint with `check-titles.mjs --source <project>/transcript-final.txt`, fix every FAIL, pick the strongest into
   `<project>/TITLE.txt`. The pick should leave room for the thumbnail to add something (a number, a contrast, a
   command) rather than repeat it.
3. **Thumbnails** (one stop: the cost). Follow the `youtube-thumbnail` skill: 3 genuinely different formats from
   the outlier patterns, varying the host's outfit, position and gesture, each one a single generated image with
   the brand's face / smile / logo references. Dry-run all three first, then ask once for the total
   (about $0.07 each at `high`), then generate. The brand's spend policy decides whether that ask is needed.
4. **Check** before showing anything: face matches the reference (crop side by side), smile natural, logo right,
   every word and number spelled exactly and present in the transcript, nothing important under the duration
   badge. Regenerate a failed concept (another paid call, so include it in the ask or ask again).
5. **Export.** Add each image as `{ "id": "...", "image": "thumbs/gen/<project>/<name>.png" }` to
   `<project>/thumbnails/thumbs.json`, then `node scripts/youtube/render-thumbnails.mjs <project-slug>`
   (1280x720 JPGs under 2 MB + `feed-preview.png` with the chosen title).
6. **One approval message** (the second and last stop): the picked title and the other strongest two, the three
   thumbnail JPGs and `feed-preview.png`, and which thumbnail to upload first with the other two for Test & Compare.
7. **On approval:** write `<project>/thumbnails/APPROVED.json`
   (`{"approved": "<id>", "file": "thumbnails/thumb-<id>.jpg", "title": "...", "by": "<user>", "at": "<date>"}`),
   record the winning title and thumbnail with `factory.mjs learn win`, deliver it (below), and re-run
   `package.mjs` (it should say "Packaged"). Any correction → `factory.mjs feedback "<exact words>"` first, then fix and `learn rule|avoid`.

## Delivery

Packaging comes **before** the video is copied out, so the delivered file can carry the approved title
(`deliver-drive.mjs` names it `<date> <TITLE.txt>`). If the brand has `brands/<slug>/delivery.json`, finish with the
`deliver-video` skill (reads the row's Category first; video, SRT and transcript to Drive; fills the row).

Deliver the title and thumbnail where the brand's `thumbnails.md` **DELIVERY** section says (for example a content-hub database row:
title, title options and the approved thumbnail uploaded as a file). Only when it names no destination, copy the
approved JPG next to the delivered video as `… THUMBNAIL.jpg`. Project working files (`TITLE.txt`, `TITLES.md`,
`thumbnails/`, `PACKAGE.md`) stay in the project. Publishing to YouTube is a separate step: nothing here posts
anywhere, and the YouTube URL / uploaded fields stay empty until it actually goes live.

## Notion sync: automatic on every finish / upload

Whenever a video is finished or uploaded, push **everything** to its Content Hub row
(`brands/<slug>/delivery.json → notion.dataSource`) without being asked, long form **and** every Short. Drive copies
first (`deliver-video` / `deliver-short`); only write a Drive link after the copy has returned it.

**Long form** (row fields):
| Field | What goes in |
| --- | --- |
| **Video link** | Drive link of the newest long-form MP4 (`Ready/<category>/`) |
| **Transcript file** | Drive link of its transcript (`Ready/<category>/Transcripts/`) |
| **YouTube title** / **Title options** | the approved title / all 10 CLICKABLE titles numbered, pick marked |
| **Thumbnail image** | the approved 1280×720 JPG, uploaded as a file |
| **Video CTA** | one line, specific to this video, ending in the brand's link (keep an existing one) |
| **YouTube description** | line 1 = the Video CTA; a 2-line hook (the promise, numbers only from the transcript); "In this video I break down <creator>'s <post>:" + 4–6 bullets of what they'll learn; chapters from the beat times when there are ≥ 3 (first `0:00`, each ≥ 10 s); credit by real Skool name |

**Every Short** (Short N = its number on the row, 1–3):
| Field | What goes in |
| --- | --- |
| **Short N title** | the picked Short title (lint with `check-titles.mjs` against the Short's script; 3 options kept in the page's *Short N* section) |
| **Short N description** | 2–3 lines of what it shows, the long video's YouTube link if live (else "full breakdown on my channel"), the Video CTA, real-name credit, 3–4 hashtags incl. #shorts |
| **Short N thumbnail** | the cover PNG, uploaded as a file |
| **Short N video** | the Short MP4 uploaded as a file (this workspace caps uploads at 5 MB → 720p copy; full quality stays in Drive) |
| **Short N Drive link** | Drive link of the newest Short MP4 (`Ready/<category>/Shorts/`) |
| **Shorts count** / **Shorts status** | number of Shorts on the row / Rendered (Posted is set by the upload step) |
Also: the page's *Short N* section (script, caption, scene list, approval, Drive link) and a
`<name> - title and description.txt` beside the MP4 in Drive.

**New versions** (v2, v3…): new file names in Drive (never overwrite), and every link/file on the row is replaced with
the newest version. **Leave alone:** Uploaded, YouTube URL, Upload date, Skool post fields (other steps own them).

**Verify:** re-query the row and list each field above with its value. Any empty → do it before saying it's done.
