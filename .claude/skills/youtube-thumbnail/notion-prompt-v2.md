# YouTube Thumbnail Prompt for Claude, Skool Niche (v2)

v2 built Oct 14, 2026 by Vega Punk. Copy the prompt below into Claude. Broad evidence comes from 13 top
educational channels; views are the rounded counts shown on each channel's Videos tab tonight, and the multiple
compares each video with the median of that channel's last 40 uploads (a rough estimate). The contact sheet is on
the box at /workspace/thumbs/contact_sheet_edu.jpg.

## Prompt (v2)

```text
ROLE: Act as a senior YouTube thumbnail designer for an educational business channel in the Skool niche. You design thumbnails that make the right viewer click in under a second without misleading them. Thumbnail and title are one package: the thumbnail shows the stake, the emotion or the payoff; the title explains it. Never repeat the title word-for-word on the thumbnail.

AUDIENCE: Skool community owners and would-be owners (coaches, course creators, consultants, side-hustlers, roughly 25-55) who want to launch, grow and retain a paid Skool community, automate DMs/CRM/onboarding with AI agents, and see real creator wins they can copy. They scroll on phones, recognise the Skool logo instantly, distrust hype, and click on believable proof and on warnings that save them from mistakes.

WHAT WORKS (from 18 outlier thumbnails on top educational channels, Oct 2026; views from channel pages, multiple = vs that channel's median of its last 40 uploads):
1. A 2-3 word command or contrarian claim, huge and high-contrast, next to one serious face. "BUY NOTHING" (Leila Hormozi, 4.6M, ~34x), "IGNORE EVERYONE" (Leila Hormozi 1.9M ~14x; Dan Koe 1.0M ~5x), "Stop Buying This" (Codie Sanchez, 1.0M, ~4x).
2. One giant money-per-time number as the hero, with a face and one tool/proof prop. "$285/Day" (Iman Gadzhi, 2.6M, ~9x), "$306 PER DAY" + Shopify logo (Mark Tilbury, 18M, ~6x), "2 Hours a day" + "$19,438" chart (Iman Gadzhi, 1.6M, ~5x).
3. A visual framework or contrast you understand without reading the title: whiteboard "GOALS -> SYSTEMS" (Ali Abdaal, 1.7M, ~7x), paycheck split into 5/15/30/50% (Codie Sanchez, 940K, ~4x), "DEBT" struck through with two reacting faces (Graham Stephan, 2.1M, ~5x).
4. A real artifact as proof/stakes instead of a claim: a tweet screenshot reading "We're going bankrupt" over a theme park photo (Alex Hormozi, 1.6M, ~5x), a Forbes cover (Leila Hormozi), a live earnings chart (Iman Gadzhi).
5. Curiosity statements and recognisable logos/faces: "This shouldn't exist." over a machine photo, no face (Veritasium, 63M, ~6x); "BIGGEST LEAP YET" + OpenAI logo (Matt Wolfe, 502K, ~5x); famous guest name/face (Colin and Samir x Linus, 1.2M, ~5x).
Common to almost all: 1 focal subject, 2-4 words, dark or muted background with one bright accent colour (yellow, green, red), closed-mouth confident or serious face, nothing in the bottom-right corner.
SKOOL NOTE: In Skool-specific outliers the Skool logo sits on nearly every winner (11/12) and real Skool UI (member count, price, revenue) is the proof prop. Examples: "$44k in 18 days" (Stephen G. Pope, 186K vs ~18K usual), "SHUT IT DOWN" warning (155K), a "505 members $7" Skool card (Evelyn Weiss, 49K vs ~3.6K usual).

RULES:
1) Text 1-4 words max, heavy font, readable at 160x90 px; it must add something the title does not say (command, number, contrast or payoff).
2) One focal point (face OR number OR artifact); blur, darken or remove everything else.
3) When the host is on camera, use his real photo with one clear emotion matching the promise (confident for wins, serious for warnings/commands, curious for breakdowns). Prefer closed-mouth; no fake shock.
4) 2-3 colours max: dark/muted background + one bright accent. The subject must separate from the background.
5) Use the Skool logo or a real Skool UI element when the video is about Skool; never fake a UI.
6) Mobile first: check at phone size, keep bottom-right empty (duration badge), keep key elements out of the outer 5%.
7) Never invent numbers, results, screenshots, testimonials or member counts. Use a number only if supplied in INPUTS and true; otherwise use a command, contrast or visual stake.
8) Don't promise what the video doesn't deliver; no logos of tools not used; no real people other than the host/guests with permission.
9) Make the 3 concepts genuinely different in layout and angle (e.g. command vs number vs framework) so they work as a YouTube Test & Compare set.
10) 1280x720 (16:9), JPG/PNG under 2 MB.

INPUTS (ask for any that are missing before designing):
- Video title:
- Topic / one-sentence promise:
- Key number (real, with source), or "none":
- the host photo available (y/n), and which expressions:
- Real screenshots/artifacts available (Skool, Stripe, DMs, tweets), y/n:

OUTPUT: 3 distinct thumbnail concepts. For each one:
- Concept name + angle (command / proof number / framework / artifact / curiosity / creator win)
- Layout (rule-of-thirds positions for face, text, logo, proof element)
- Text overlay (exact words, 1-4) + font, colour and stroke
- Colours (hex values)
- Facial expression and pose (or "no face" and why)
- Background and props
- Why it complements the title, and which WHAT WORKS pattern it uses
- Image-generation prompt (one paragraph, 16:9, everything except the host's real face, which is composited in later; no AI-rendered text if the tool garbles text)
- Canva/Photoshop build spec at 1280x720: layer list top to bottom with x/y positions and sizes in px, font sizes, stroke/shadow values, cut-out and glow instructions, export settings
Finish with which concept to upload first and which two to put into Test & Compare.
```

## Evidence: 18 outlier thumbnails from educational channels

| # | Channel | Title | Views (channel page) | vs median of last 40 uploads | Thumbnail notes | Link |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | AlexHormozi | Can I Save This Failing Theme Park in 90 Days? | 1,600,000 | ~5.3x (300,000) | Text-only tweet screenshot 'We're going bankrupt' + theme park photo, Hormozi face. Real-artifact stakes. | https://www.youtube.com/watch?v=xRxVpjeHmeA |
| 2 | CodieSanchezCT | 11 Things That Are a Complete WASTE of Your Money | 1,000,000 | ~3.9x (259,000) | 'Stop Buying This' serif on dark, woman center, logo props (McDonald's, Starbucks, bag). Command + objects. | https://www.youtube.com/watch?v=f9OptlMJwTQ |
| 3 | CodieSanchezCT | Do This Every Time You Get Paid (Paycheck Routine) | 940,000 | ~3.6x (259,000) | Face left, colourful paycheck split 5%/15%/30%/50%. Visual framework. | https://www.youtube.com/watch?v=SU3DRpmW5qM |
| 4 | ColinandSamir | An Unfiltered Conversation with Linus Tech Tips | 1,200,000 | ~5.4x (224,000) | 'The Full Story of Linus Tech Tips' yellow block, guest face. Recognisable guest. | https://www.youtube.com/watch?v=nmNzEf7dXsw |
| 5 | GrahamStephan | I Paid Off My 2.875% Mortgage…Dave Ramsey Was Right | 2,100,000 | ~4.6x (453,000) | Two faces (one shocked older man), 'DEBT' struck through in red. Conflict / two reactions. | https://www.youtube.com/watch?v=9TwzN5wak8A |
| 6 | ImanGadzhi | Laziest Way to Make Money Online In 2026 ($100/day+) | 2,600,000 | ~8.8x (295,000) | '$285/Day' giant white on dark, face center, laptop prop. Number differs from title ($100/day+). | https://www.youtube.com/watch?v=6KB9h-FcD8Q |
| 7 | ImanGadzhi | Laziest Way To Make Money With AI ($373/day+) | 1,600,000 | ~5.4x (295,000) | '2 Hours a day' + '$19,438' green earnings chart + AI chip, face. Effort vs proof. | https://www.youtube.com/watch?v=_67MWD7XW9Q |
| 8 | LeilaHormozi | The Psychology of Making Money | 4,600,000 | ~33.8x (136,000) | 'BUY NOTHING' white on warm grey, single face. 2-word contrarian command. | https://www.youtube.com/watch?v=cgsWQd5EM1k |
| 9 | LeilaHormozi | I'm 33. If You're In Your 20s or 30s, Watch This. | 1,900,000 | ~14.0x (136,000) | 'IGNORE EVERYONE', three images incl. Forbes cover. Proof of authority + command. | https://www.youtube.com/watch?v=Kg2Ux47hwg4 |
| 10 | MarkTilbury | I Tried AI Dropshipping For 7 Days, Here's How You Can Copy Me | 18,000,000 | ~6.0x (3,000,000) | '$306 PER DAY' green on dark, Shopify logo, big grin, cash. Number + tool logo. | https://www.youtube.com/watch?v=xfOT2elC2Ok |
| 11 | MarkTilbury | How to Make Your First $10,000 As a Teen (Stupid Simple) | 11,000,000 | ~3.7x (3,000,000) | '$300/day' + money bag icons, face. Number + simple icons. | https://www.youtube.com/watch?v=5rhHm6WWOIs |
| 12 | aliabdaal | Success Is Hard Until You Build Systems Like This | 1,700,000 | ~6.7x (255,500) | Whiteboard 'GOALS -> SYSTEMS' with grid, Ali pointing. Concept contrast drawn. | https://www.youtube.com/watch?v=MBPHU7aaklM |
| 13 | dankoetalks | I'm 28. Here's How To Get Ahead Of Most 20 Year Olds | 1,000,000 | ~5.2x (193,500) | 'IGNORE EVERYONE' white/black block, serious face on dark. 2-word command. | https://www.youtube.com/watch?v=wdA5y0k7CRA |
| 14 | dankoetalks | If You Have Multiple Interests, Please Take Advantage of the Next 10 Years | 898,000 | ~4.6x (193,500) | 'THE NEW RENAISSANCE' + statue and famous faces (Musk, Jobs). Big idea + icons. | https://www.youtube.com/watch?v=pmQhqVLVApw |
| 15 | johnnyharris | Is Fascism Back? | 7,800,000 | ~2.2x (3,500,000) | Johnny face + red-tinted historic figure, no text. Topic image + face. | https://www.youtube.com/watch?v=GV8KGcFqeLc |
| 16 | kurzgesagt | This Woman Cured Her Cancer with an Insane Method | 21,000,000 | ~3.7x (5,700,000) | '100% VIRUS' yellow, illustrated syringe/virus, bright on dark. Shock claim, no face. | https://www.youtube.com/watch?v=0NY2gAftzJE |
| 17 | mreflow | GPT-6 Astra Is Finally Here (And It's REALLY Good) | 502,000 | ~4.7x (107,000) | 'BIGGEST LEAP YET' + OpenAI logo, face pointing. Tool logo + superlative. | https://www.youtube.com/watch?v=GGzT7zVrRTU |
| 18 | veritasium | The Closest Thing We Have to Alien Technology | 63,000,000 | ~6.3x (10,000,000) | 'This shouldn't exist.' serif text over machine photo, no face. Curiosity statement. | https://www.youtube.com/watch?v=MiUHjLxm3V0 |

## Secondary: Skool-niche evidence (v1, 12 thumbnails)

| Title | Channel | Views | Thumbnail notes / pattern | Link |
| --- | --- | --- | --- | --- |
| $44K in 18 days using Skool.com | Stephen G. Pope | 186,268 | Face smiling left, '$44k in 18 days' 2 lines white on red, Skool logo chip. Number proof. | https://www.youtube.com/watch?v=B3lCI77mYLw |
| Why The Best Business to Start in 2026 is a Skool Community | Alex Hormozi | 177,465 | No text; Hormozi on horse, sky background, Skool logo. Spectacle + celebrity. | https://www.youtube.com/watch?v=rn5-yLUaNw0 |
| DON'T Start a Skool Community Until You Watch This | ItsKeaton | 155,177 | 'SHUT IT DOWN' yellow on red, X over Skool sign, serious face. Warning. | https://www.youtube.com/watch?v=w8x-ACnTD14 |
| Don't Start An AI Agency (Do This Instead) | Stephen G. Pope | 116,263 | Text-only 'AI AGENCIES SUCK', yellow bar + huge white on black. Contrarian. | https://www.youtube.com/watch?v=SDYm5bpqKt8 |
| How I won the Skool Games w a $335K/mo one-man community | Nick Saraev Daily | 73,181 | Thinking face centered, Skool + Maker School logos, no text. Curiosity. | https://www.youtube.com/watch?v=TOhndexmOj4 |
| Top 7 Secrets To Building a $45,000/Month Skool Community | Adnan Pilditch | 70,112 | 'GROW FAST', cash in hands both sides, face center, Skool logo, bookshelf bg. Complementary text. | https://www.youtube.com/watch?v=mf1WAw0FyaI |
| How I Run a $100K/mo Skool Community (Copy This) | Adam Luke | 70,030 | '$140K IN 30 DAYS' black on white, Skool logo, face right. Number differs from title. | https://www.youtube.com/watch?v=d0vj0UaLIS0 |
| What is Skool & How Does it Work (Full Guide) | Evelyn Weiss | 64,703 | Skool logo + 'how it works' red bar, real Skool UI with $51,176, face right. | https://www.youtube.com/watch?v=eMTYrQcCR9g |
| How I made my first $1000 with ZERO audience on Skool | Evelyn Weiss | 49,221 | '8 Steps' red label, Skool card '505 members $7', face left. UI proof. | https://www.youtube.com/watch?v=5QDjbMYonjw |
| How To Grow Your Skool Community (And Make 48K In 17 Days) | Stephen G. Pope | 41,419 | Two faces, Skool logo, '$44K in 17 Days' white on black. Creator duo + number. | https://www.youtube.com/watch?v=RQx5dT2DJyw |
| I Scraped Every Skool Community. This is What I Learned. | Chris Koerner | 35,125 | Three faces, '$555K/MONTH' yellow bar, arrow, Skool hat. Creator-win breakdown. | https://www.youtube.com/watch?v=7d6tzZ_h8dI |
| Build a $9 Skool Instead of Another Side Hustle | Brian O'Neill | 28,909 | 'THIS IS THE PLAY' huge black on white, face right, Skool logo. Complementary text. | https://www.youtube.com/watch?v=mKaGlUr0hC4 |

## Best-practice sources

- YouTube Help, A/B test titles & thumbnails (up to 3 variants, winner by watch time, use 1280x720+):
  https://support.google.com/youtube/answer/13861714
- YouTube Help, Thumbnail & title tips (rule of thirds, readable font, not too complex):
  https://support.google.com/youtube/answer/12340300
- YouTube Help, Add custom thumbnails (16:9, 2 MB mobile limit): https://support.google.com/youtube/answer/72431
- YouTube Blog, Test & Compare guidance (test big layout differences first):
  https://blog.youtube/creator-and-artist-stories/renes-top-five-june-14-2024/
- MrBeast thumbnail team: complementary packaging, faces build trust: https://www.youtube.com/watch?v=HP-rqigfw2s and
  https://www.socialmediatoday.com/news/youtube-shares-insights-mrbeasts-team-creates-compelling-thumbnail/709817/
- Closed-mouth faces won 30/30 MrBeast A/B tests on watch time:
  https://www.theverge.com/2023/9/6/23861576/youtube-face-mrbeast-open-closed-mouth-a-b-testing-thumbnail
