---
name: youtube-titles
description: Write titles for LONG-FORM YouTube videos as 10 BAD/CLICKABLE pairs — an expert-copywriter framework that studies what generic titles get wrong and what clickable ones in the brand's niche do right (specificity, curiosity, unexpected contrast, relatable frustration, meaningful outcome), using the brand's audience and verified niche data from brands/<slug>/titles.md, then lints every title with check-titles.mjs (no invented numbers, colons, questions, salesy words; ~60 chars). Use for any title, title ideas, a better title, or before thumbnails / publishing. For the thumbnail itself use youtube-thumbnail.
---

# YouTube titles

**Scope: long-form YouTube videos only** (16:9 breakdowns, VSLs, tutorials, talking-head videos). Shorts, Reels
and TikToks don't use this skill.

**One brand at a time.** Everything brand-specific comes from the *active* brand's own files
(`node scripts/factory.mjs context` names it): `brands/<slug>/BRAND.md`, `frame.md`, `learnings.md` and `titles.md`.
In a repo with several clients, confirm which client the video is for and use only that client's files; never
borrow another brand's audience, examples, palette, photos or wording.

**Role:** an expert copywriter who writes titles that make the *right* viewers want to click without misleading
them. Clear, natural flow. The title must promise exactly what the video delivers, presented better.

## Inputs

1. **The topic.** A word, phrase, draft title, script or transcript from the user, or the project's own
   `script*.md` / `voice/*.words.json` / transcript. No topic and no project → ask for one first; write nothing.
2. **The niche file, `brands/<slug>/titles.md`** (active brand): `AUDIENCE`, `WHAT WORKS` (real titles with
   their views vs the channel's typical views), `EXAMPLES` (BAD/CLICKABLE pairs) and `Keywords` to keep.
   - Missing, or `WHAT WORKS` still empty → build it before writing titles: research real titles in the
     brand's niche (WebSearch / the `watch` skill on channels the audience follows), keep only ones with a
     visible view count clearly above that channel's norm, and write each as
     `"Title" (Creator, views vs ~typical)`. Never invent data or view counts. Show the user what you found and
     save it to `titles.md`; the audience comes from `BRAND.md`, the examples are written from the pattern.
3. `BRAND.md` (voice, Avoid list) and `learnings.md` (title feedback already given: never repeat a rejected pattern).

## Method

1. **Analyse the BAD titles** in the niche file: they are generic labels ("How to grow a community"), a topic
   without a reason to click. Note the framing to avoid.
2. **Analyse the CLICKABLE titles and the WHAT WORKS data:** specificity (a real number, person, timeframe),
   curiosity (something worth finding out), unexpected contrasts, relatable frustrations, meaningful outcomes,
   warnings, a constraint the viewer shares. Use the *principles*, never the wording; don't force a contradiction.
3. **Mine the topic for what's true:** the outcome, the number, who got it, the obstacle, the mistake, the
   question the video answers. Only these facts may appear in a title.
4. **Write 10 pairs.** Each pair is about the same video: the BAD title is the generic version of an angle, the
   CLICKABLE title is the better version of that same angle. Ten genuinely different angles, openings and
   structures.
5. **Lint** (write the pairs to `<project>/titles.txt`, or a scratch file when there's no project):
   ```bash
   node scripts/youtube/check-titles.mjs --source <script-or-transcript> --file <titles.txt>
   ```
   It checks only the CLICKABLE lines. Rewrite every FAIL. A number "not in the source" means fix it or drop it,
   never keep it. The checker knows digits and spelled-out numbers only: still read each claim against the source.
6. **Review each CLICKABLE title:** accurate, one idea, its own distinct reason to click, sounds natural read
   aloud.

## Rules

1. Exactly 10 BAD/CLICKABLE pairs, blank line between pairs.
2. Each pair about the same video; never change the subject or what the video promises.
3. Follow principles, not wording: specific outcomes, contrasts, frustrations, obstacles, mistakes, unanswered
   questions. No forced formula.
4. The topic is clear and there's something worth finding out: curiosity, not confusion.
5. Never invent facts, results, tests or experiences. "I" / "My" only when the video is the speaker's own story.
6. Numbers and parentheses used selectively, as numerals, and only when the source supports them.
7. Different angles, openings and structures. A listicle ("3 Rituals…") only with a count the video supports.
8. About 60 characters or fewer, important information early (mobile shows ~45). Keep the niche keywords and
   tool names from `titles.md` (its `Keywords` line) when relevant.
9. Natural language, one cohesive title. No colons, no emoji, no question-form titles, no salesy words
   (unlock, discover, skyrocket, revolutionize, cutting-edge). Declarative "Why…" titles are fine.
10. Return **only the 10 pairs** in chat unless asked for more.

Format:

```
[BAD] <the generic label for this angle>
[CLICKABLE] <the specific, curious, true version of the same angle>

[BAD] ...
[CLICKABLE] ...
```

## Files and the learning loop

- Inside a project, also save the pairs and the checker output to `<project>/TITLES.md`.
- When the user picks or rewrites a title, write it to `<project>/TITLE.txt` (delivery, thumbnails and
  publishing read it), log their words with `factory.mjs feedback "..."`, and record what generalizes with
  `factory.mjs learn win|rule|avoid`. A pattern that proves itself goes into `titles.md` as a new example pair.
- Descriptions, when asked: line 1 restates the promise as a sentence; 2–3 lines of what they'll learn; chapters
  from the beat timestamps (first is `0:00`, at least 3, each ≥ 10 s); the brand CTA; credits for anyone featured.
  Save as `<project>/DESCRIPTION.md`.
