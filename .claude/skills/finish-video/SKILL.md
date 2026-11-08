---
name: finish-video
description: Take a video from script or footage to fully finished in one flow — the edit (via the right editing skill), the YouTube title and one-piece thumbnails (youtube-package, long-form only), then delivery (deliver-video / deliver-short: video + SRT to Drive Ready/<category> and /Shorts, transcripts) and an automatic Notion sync of everything, long form and every Short: links, video files, thumbnails, titles and descriptions. Resumes from wherever the project stopped, using scripts/youtube/package.mjs as the single checklist. Use when asked to "finish", "make the video for <row>", "take it all the way", "get it ready" or "do the whole thing" for a video.
---

# Finish video (end to end)

One video, one brand. Confirm the brand is the active one (`node scripts/factory.mjs context`); in a repo with
several clients, confirm which client first and use only that client's files.

```
row / script / footage → edit → verify → title + thumbnail (long-form) → Short + cover → read row → Drive Ready/<category> (+ Shorts/) + Transcripts → Notion sync (long + Shorts: links, files, titles, thumbnails, descriptions) → re-read row
```

The user is stopped at most three times: the image cost, the title + thumbnail approval, and anything the
editing skill itself must ask (its own checkpoints, paid generation).

## Steps

1. **Identify the video.** A project slug, a content-database row (when the brand has
   `brands/<slug>/delivery.json`, its `notion.dataSource` is the database), or new footage / a script. **Read the
   row** if there is one: Title, Category, Format, who records it, the script (page body), key numbers. A row
   without a project yet → create it: `node scripts/factory.mjs new-video <slug> ...`.
2. **Checklist.** `node scripts/youtube/package.mjs <project>`; it prints the next step and writes `PACKAGE.md`.
   Re-run it after every step below and follow its **Next**; it resumes, so nothing is redone.
3. **Edit** (no final render yet), with the skill that fits the row or request:
   - real footage → `edit-video` (Shorts → `short-form-edit`);
   - follow that skill through its own verify step (`verify-render.mjs`, read the report and frames). Stop its
     delivery at the render: steps 4–5 here replace its copy-to-folder step.
4. **Package** (long-form only; Shorts skip to step 5): the `youtube-package` skill — 10 title pairs and a pick,
   3 different one-piece thumbnails (one cost OK), export + feed check, one approval message.
5. **Deliver**: the `deliver-video` skill — read the row's Category again (it may have changed), dry run, copy
   (video + SRT → `Ready/<category folder>`, transcript → its `Transcripts/`), then fill the row: Video link,
   Transcript file, and for long-form YouTube title, Title options, Thumbnail image. No `delivery.json` → deliver the way the
   editing skill or `CLAUDE.local.md` says instead.
6. **Shorts too.** Every long-form video gets its Short(s) (`short-form-edit`, with a cover), delivered with
   `deliver-short` to `Ready/<category>/Shorts/` and recorded on the row. Skip only if the user says no Short.
7. **Notion sync** (automatic, no need to be asked): every field in "Notion sync" below, long form and each Short,
   including both descriptions. Re-query the row.
8. **Done** when `package.mjs` says **Finished** *and* the row check lists every field filled. Report in one message: the title, the approved thumbnail, the
   Drive paths and the row link, plus the image spend.

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

- Every number and quote on screen, in the title or on the thumbnail comes from the script / final transcript.
- Never guess a Drive folder: unknown or empty Category → ask.
- Nothing posts to YouTube; the row's YouTube fields (Uploaded, YouTube URL, Upload date) stay for the upload step.
- Corrections at any step → `factory.mjs feedback "<exact words>"` first, then fix and `learn rule|avoid|win`.
