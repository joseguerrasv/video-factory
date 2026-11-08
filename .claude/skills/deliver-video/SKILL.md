---
name: deliver-video
description: Deliver a finished video to where the brand keeps it — read the video's row in the brand's content database first (its Category picks the folder), copy the MP4 + SRT to Drive YouTube Uploads/Ready/<category folder> and the plain-text transcript to that folder's Transcripts/, then sync the row automatically (Drive links, title, title options, thumbnail, Video CTA, YouTube description; and the Short N fields for every Short). Driven by brands/<slug>/delivery.json and scripts/youtube/deliver-drive.mjs. Use whenever a video is finished, after youtube-package for long-form, or when asked to "deliver", "upload to Drive", "put it in Ready" or "upload the transcript".
---

# Deliver video

Runs after the edit is verified and, for long-form, after the `youtube-package` approval (so the file can carry
the approved title). The brand's `brands/<slug>/delivery.json` says where things go; no `delivery.json` → this
brand has no delivery destination here, so follow its editing skill or `CLAUDE.local.md` and stop.

## Steps

1. **Read the row first.** Find the video's row in the database `delivery.json → notion.dataSource` names (by its
   title, script or post ID) and read its **Category** exactly as written. Empty, or not in
   `delivery.json → drive.categories` → stop and ask which category it is. Never guess a folder.
2. **Dry run:**
   ```bash
   node scripts/youtube/deliver-drive.mjs <project-slug> --category "<Category>"
   ```
   It finds the final render, and plans:
   - `<video>.mp4` and `.srt` → `YouTube Uploads/Ready/<category folder>/<date> <YouTube title>.*`
   - the plain-text transcript of the final cut (`transcript-final.txt`, built from the subtitles) →
     `YouTube Uploads/Ready/<category folder>/Transcripts/<date> <YouTube title> - transcript.txt`
   Check the folder and names make sense (title from `TITLE.txt`; `--name` to override, `--video` for a
   specific render).
3. **Copy:** the same command with `--yes`. It never creates folders and never overwrites: a file already there
   means a new version, so pass `--name "<...> v2"`. It waits for Drive to sync, prints both Drive links (video and
   transcript) and records them in the project's `DELIVERED.json`.
4. **Fill the row** (as `delivery.json → notion.afterDelivery` says): **Video link** = the video's Drive link,
   **Transcript file** = the transcript's Drive link (property names in `delivery.json → notion.linkProperties`); for
   long-form also **YouTube title**, **Title options**, **Thumbnail image** (the brand's `thumbnails.md` →
   DELIVERY). Leave the YouTube fields (**Uploaded**, **YouTube URL**, **Upload date**) for the upload step.
5. **Report** the three Drive paths, both links and the row link in one short message. A row isn't delivered until
   both links are on it.

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

## Rules

- Only `Ready/` is written. `Uploaded/` and `Failed/` belong to the YouTube upload step.
- Nothing is stored on this computer outside the project folder: no `~/Movies` copies.
- Short-form videos use `deliver-short` instead: they go to `Ready/<category>/Shorts/` with their cover
  (vertical renders are detected automatically by the script).
- No transcript yet (no subtitles beside the render) → make the SRT first (`node scripts/transcribe.mjs` on the
  final render, then convert), never deliver a video without its transcript.
