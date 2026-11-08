---
name: deliver-short
description: Deliver every finished short-form video (Short, Reel, TikTok) to the "Shorts" subfolder of its category in Google Drive — YouTube Uploads/Ready/<category>/Shorts — with its SRT and cover image, the transcript in the category's Transcripts/, then sync the Notion row automatically (Short N title, description, thumbnail, video, Drive link, Shorts status). Use whenever a short / reel / TikTok is finished, or when asked to "upload the short", "put the reel in Drive" or "deliver the short".
---

# Deliver short

Every short-form video lands in **`YouTube Uploads/Ready/<category>/Shorts/`**. Same rules as
`deliver-video` (read the Notion row first, never guess a folder, never create folders, never overwrite), plus:

## Steps

1. **Cover first.** No `cover.png` yet → make one (a 1080x1920 cover from the `youtube-thumbnail` skill, or the brand's own template) and save it as `<render>.cover.png` next to
   the final render (or `cover.png` in the project root). The script copies it beside the video.
2. **Category.** Read the video's row in the content database (`brands/<slug>/delivery.json → notion.dataSource`).
   A Short spun off a long video uses the long video's row/category unless the Short has its own row. Category
   empty or unknown → ask; never guess.
3. **Dry run** (vertical videos are detected automatically; `--short` forces it):
   ```bash
   node scripts/youtube/deliver-drive.mjs <project-slug|dir> --category "<Category>" --video <short.mp4> --name "<YYYY-MM-DD> <title> SHORT"
   ```
   Check the plan says `SHORT-FORM → … /<category>/Shorts` and lists: MP4, SRT, cover, transcript
   (→ `<category>/Transcripts/<name> - transcript.txt`).
4. **Copy** with `--yes`. Links land in the project's `DELIVERED-short.json`.
5. **Row.** If the Short has its own row (Format = Short): **Video link** + **Transcript file** + the cover in
   **Thumbnail image**. If it shares the long video's row (Format = Long-form): append
   "Short (vN): <video link> · transcript: <link>" to **Notes**, never overwrite the long video's links, and set
   **Shorts status** = Rendered (Posted is set by the upload step).
6. Report the Drive folder, links and row in one short message, and send the MP4 to the user.

## Title, description, cover

Every Short ships with: a **title** (≤ 60 chars, lint with `check-titles.mjs` against the Short's script, 3 options +
pick), a **description** (2–3 lines of what it shows, the long video's YouTube link when it exists, the row's
**Video CTA**, the creator credit by real Skool name, 3–4 hashtags incl. #shorts), a **caption** for Reels/TikTok and
the **cover**. Put all of it in the row's *Short N* section (cover as an image) and as
`<name> - title and description.txt` beside the MP4 in `Ready/<category>/Shorts/`.

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
- Shorts never go in the category root and never in `Uploaded/` or `Failed/`.
- A Short is never delivered without its SRT, transcript and cover.
- Name: `<YYYY-MM-DD> <title> SHORT` (add ` v2`, ` v3` for new versions; the script refuses to overwrite).
