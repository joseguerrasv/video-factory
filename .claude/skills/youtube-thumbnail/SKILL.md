---
name: youtube-thumbnail
description: Design thumbnails for LONG-FORM YouTube videos as a senior thumbnail designer — 3 genuinely different concepts (command / proof number / framework / artifact / curiosity / creator win) that complement the title, built on outlier patterns from top educational channels plus the brand's own audience and niche notes in brands/<slug>/thumbnails.md, each with exact text, layout, hex colours, expression, an image-generation prompt and a 1280x720 build spec, then a Test & Compare pick. Where the repo has the OpenAI image generator it generates each thumbnail as one finished image (host from the brand's face reference, text and graphics included) and checks it in a simulated YouTube feed. Use for any thumbnail, thumbnail ideas or A/B thumbnails. Titles come from youtube-titles.
---

# YouTube thumbnail

**Scope: long-form YouTube videos only** (16:9 breakdowns, VSLs, tutorials, talking-head videos). Shorts, Reels
and TikToks don't use this skill.

**One brand at a time.** Everything brand-specific comes from the *active* brand's own files
(`node scripts/factory.mjs context` names it): `brands/<slug>/BRAND.md`, `frame.md`, `learnings.md` and `thumbnails.md`.
In a repo with several clients, confirm which client the video is for and use only that client's files; never
borrow another brand's audience, examples, palette, photos or wording.

**Role:** a senior YouTube thumbnail designer for the brand's educational / business channel. Thumbnails make the
*right* viewer click in under a second without misleading them. Thumbnail and title are one package: the
thumbnail shows the stake, the emotion or the payoff; the title explains it. Never repeat the title word for word.

## Inputs

Gather these from the project first (`TITLE.txt`, the script or transcript, `brands/<slug>/`); ask the user only
for what you can't find, before designing:

- Video title, and the topic as a one-sentence promise.
- Key number (real, with its source in the script / transcript), or "none".
- Host photo available (y/n) and which expressions (see the brand's `thumbnails.md`).
- Real screenshots / artifacts available (the niche's platform UI, dashboards, DMs, posts), y/n.

Brand context, **`brands/<slug>/thumbnails.md`**: AUDIENCE (who scrolls past this), NICHE NOTE (what wins in this
niche: logos, proof props, verified examples), host photos, logos and real artifacts, palette. Missing or its
NICHE NOTE empty → write AUDIENCE from `BRAND.md`, then research outlier thumbnails in the niche (videos well above
their channel's usual views; never invent views), show the user, and save it. Also read `learnings.md`.

## What works (outlier thumbnails on top educational channels, Oct 2026)

1. **A 2–3 word command or contrarian claim**, huge and high-contrast, next to one serious face
   ("BUY NOTHING", "IGNORE EVERYONE", "Stop Buying This").
2. **One giant money-per-time number as the hero**, with a face and one tool / proof prop
   ("$285/Day", "$306 PER DAY" + a platform logo, "2 Hours a day" + an earnings chart).
3. **A visual framework or contrast** you understand without reading the title (whiteboard "GOALS -> SYSTEMS",
   a paycheck split into percentages, a word struck through with two reacting faces).
4. **A real artifact as proof / stakes** instead of a claim (a screenshot of a post, a magazine cover, a live
   earnings chart).
5. **Curiosity statements and recognisable logos / faces** ("This shouldn't exist." over a photo, a superlative +
   a known logo, a famous guest).

Common to almost all: 1 focal subject, 2–4 words, a dark or muted background with one bright accent colour
(yellow, green, red), a closed-mouth confident or serious face, nothing in the bottom-right corner. Closed-mouth
faces also won every one of 30 MrBeast A/B tests on watch time.

## Rules

1. Text 1–4 words, heavy font, readable at 160x90 px. It adds something the title doesn't say (a command, number,
   contrast or payoff).
2. One focal point (face OR number OR artifact). Blur, darken or remove everything else.
3. Host on camera → their real photo with one clear emotion matching the promise (confident for wins, serious for
   warnings / commands, curious for breakdowns). Prefer closed-mouth; no fake shock.
4. 2–3 colours: dark / muted background + one bright accent, from the brand palette (`frame.md`); the subject
   separates from the background.
5. Use the niche platform's logo or a real UI element (from `thumbnails.md`) when the video is about it. Never
   fake a UI.
6. Mobile first: check at phone size, keep the bottom-right empty (duration badge), keep key elements out of the
   outer 5%.
7. Never invent numbers, results, screenshots, testimonials or member counts. A number only if it's true and
   sourced; otherwise a command, contrast or visual stake.
8. Don't promise what the video doesn't deliver; no logos of tools not used; no real people other than the host or
   guests with permission.
9. The 3 concepts differ genuinely in layout and angle (e.g. command vs number vs framework), so they work as a
   YouTube Test & Compare set (up to 3 variants, winner by watch time).
10. 1280x720 (16:9), JPG/PNG under 2 MB.

## Output

3 distinct concepts. For each:

- Concept name + angle (command / proof number / framework / artifact / curiosity / creator win)
- Layout (rule-of-thirds positions for face, text, logo, proof element)
- Text overlay (exact words, 1–4) + font, colour and stroke
- Colours (hex values, from the brand palette)
- Facial expression and pose (or "no face" and why)
- Background and props
- Why it complements the title, and which pattern above it uses
- Image-generation prompt (one paragraph, 16:9, everything except the host's real face, which is composited in
  later; no AI-rendered text if the tool garbles text)
- Build spec at 1280x720: layer list top to bottom with x/y positions and sizes in px, font sizes, stroke / shadow
  values, cut-out and glow instructions, export settings

Finish with which concept to upload first and which two go into Test & Compare. Save it all to
`<project>/thumbnails/CONCEPTS.md`.

## Build

**Default, when the repo has `scripts/youtube/generate-image.mjs` and `OPENAI_API_KEY` is set: one piece, fully
generated by the OpenAI API.** The host, headline, proof graphic, arrows and background are one image, never a
photo with graphics composited on top (that reads as assembled). Per concept:

1. **References, in this order** (from the brand's `thumbnails.md`):
   - the host's face reference, then a tight close-up crop of the same photo (identity);
   - a smile reference when the concept smiles (copy only the expression from it);
   - wardrobe or logo crops (e.g. the host's cap with its logo) rather than a whole approved thumbnail, so the
     concept gets the details without copying that thumbnail's layout. If you do pass a whole example for style,
     blur its face, or the model copies that face instead of the host's.
   - Each concept in a set uses a different format and varies the host (outfit colour, position, pointing or
     gesture); an approved example sets the quality bar, not the layout.
2. **Prompt:** start by naming the roles ("images 1 and 2 are the real face, copy it only from them, don't make
   him younger or smoother; image 3 is the layout and style, never its face"), then describe the thumbnail exactly:
   the host's position, pose, expression and outfit (cap with the real logo, as in the example), the background,
   every word of the headline in quotes with its colours, the proof graphic with its exact numbers, the arrows and
   accents. Numbers only from the source.
3. **Dry-run, get a yes, generate:**
   ```bash
   node scripts/youtube/generate-image.mjs <project-slug> --kind thumbnail --name thumb-ai-01 \
     --reference <face> --reference <face close-up> --reference <example, face blurred> --prompt "..." [--yes]
   ```
   About $0.06–0.07 per attempt at `high`; every call is logged to `<project>/thumbnails/SPEND.jsonl`.
4. **Check before using it:** crop the generated face next to the reference. Same person (face shape, jaw, eyes,
   brows, nose)? Logo on the cap right? Every word and number spelled exactly? If not, adjust the prompt and
   regenerate (another paid call: ask again). Never fix it by pasting graphics on top.
5. **Export:** add `{ "id": "ai-01", "image": "thumbs/gen/<project>/thumb-ai-01.png" }` to
   `<project>/thumbnails/thumbs.json` and run `node scripts/youtube/render-thumbnails.mjs <project-slug>`: it writes
   the 1280x720 JPG under 2 MB and `feed-preview.png` (360x202 and 168x94 with the duration badge).

**Fallback, no image API: Remotion layouts** (`src/thumbs/Thumbnail.tsx`: `layout` paper/dark/craft/bold with
`lines`, `accent`, `card`, `tiers`, `logo`, `face`, `background`, ...) rendered by the same `render-thumbnails.mjs`.

**No renderer and no image API:** deliver `CONCEPTS.md` with the image-generation prompts and build specs, ready for
Canva / Photoshop.

## Verify

Read `feed-preview.png` and every JPG (or check each build spec against this list). Fix and re-check if:

- the main text can't be read at 168 px wide (small labels are decoration, never the message);
- more than one focal point or more than 3 colours compete;
- anything sits in the bottom-right corner or the outer 5%;
- text touches the face, or the face is cut through the eyes;
- the thumbnail repeats the title's words;
- a number isn't in the script / transcript;
- the 3 concepts are the same layout with different words.

Record the check in `<project>/VERIFY.md`. Send the files and name the one to upload first.
Corrections → `factory.mjs feedback "<exact words>"` first, then `learn rule|avoid|win`.
