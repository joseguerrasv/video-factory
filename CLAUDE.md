# Video Factory

A brand-aware editing studio. Raw footage goes in, finished on-brand videos come out, and every correction makes the next edit better. Rendering uses HyperFrames (HTML + GSAP to MP4); the editor is you.

## First run

No brand configured (the session-start context says so) → run `/onboard-me` before any editing. It installs missing tools, opens a local onboarding page, then generates the brand kit. Tool problems → `node scripts/factory.mjs doctor --json` and work through its `plan` (same rules as onboard-me step 1).

## Where things live

| Path | What | In git |
| --- | --- | --- |
| `brands/<slug>/` | One brand: `BRAND.md` (voice), `frame.md` (visual tokens, source of truth), `profile.json` (editing settings), `tokens.css`, `learnings.md`, `assets/` (logo, fonts), `style/` | no |
| `video-projects/<slug>/` | One edit: raw media, transcripts, EDLs, `BEATS.md`, composition, `renders/`, `qa/`, `FEEDBACK.md`, `VERIFY.md` | no |
| `inbox/` | Drop raw footage here | no |
| `learnings/technical.md` | Tool and pipeline lessons shared by every brand | yes |
| `scripts/` | Factory CLI, onboarding app, transcription, render QA, cut tools | yes |
| `.claude/skills/` | Project skills (below). HyperFrames skills are installed globally | yes |
| `style-library/`, `style-templates/` | 406 reusable motion-graphics cards and 2 scene templates | yes |
| `sfx-library/` | Shared sound effects: Kenney CC0 packs and a Mixkit set, indexed in `SFX.md`. Rebuild with `scripts/sfx/install.mjs`, find more with `scripts/sfx/search.mjs` | index only |

## Routing

| Request | Skill |
| --- | --- |
| Set up or change a brand, keys, preferences | `onboard-me` |
| Edit footage into a finished video (default) | `edit-video` |
| Deliver a finished short-form video (Drive Ready/<category>/Shorts + cover + transcript → Notion row) | `deliver-short` |
| Reel, Short, TikTok, short ad from talking-head footage | `short-form-edit` |
| Showreel, sizzle or brand reel cut to music | `motion-showreel` |
| Beginner "make a video" from an idea or script, with preview gates | `make-a-video` |
| Video from a website URL (promo, product tour, social ad) | `website-to-hyperframes` |
| GSAP API reference for compositions | `gsap` (plus global `hyperframes-animation`) |
| Only remove pauses / only remove flubs | `cut-silences` / `cut-mistakes` |
| Finish a video end to end (edit → title + thumbnail → Drive Ready/<category> + transcript → Notion row) | `finish-video` |
| Package a finished long-form video for YouTube (title + thumbnail in one pass) | `youtube-package` |
| Deliver a finished video (read its Notion row → Drive Ready/<category> + transcript → fill the row) | `deliver-video` |
| Long-form YouTube title, title ideas, description | `youtube-titles` (niche context in `brands/<slug>/titles.md`) |
| Long-form YouTube thumbnail, A/B thumbnails | `youtube-thumbnail` (niche context in `brands/<slug>/thumbnails.md`) |
| Story, visual world, beat overlays | `video-storytelling`, `hyperframes-video-beats` |
| Cards and templates | `style-library` |
| Anything HyperFrames (compositions, captions, overlays, audio, CLI) | start at `hyperframes`, which routes to `hyperframes-core`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-creative`, `hyperframes-audio`, `media-use`, `talking-head-recut`, `embedded-captions`, `general-video`, `motion-graphics` |
| Watch a reference video, or give a finished render a viewer-style pass (with transcript) | `watch` skill (the `watch@claude-video` plugin) |
| "Analyze my references" | Watch each link in `brands/<slug>/references.md` with the `watch` skill, write one note per reference in `brands/<slug>/style/`, then a synthesized `style/STYLE.md`, and record the clearest patterns as `learn win` |

## Brand rules

- The active brand's `frame.md` frontmatter is law for color, type, radii and motion timing. Never invent hex values or fonts. Change the brand through `/onboard-me --brand <slug>` + `scripts/onboarding/generate.mjs`, not by hand-editing tokens.
- Copy on screen follows `BRAND.md` voice. Numbers and claims come from the transcript or the user, never invented.
- Multiple brands: `node scripts/factory.mjs brand list | use <slug>`. A project remembers its brand in `project.json`.

## Learning loop

The whole point: the user never has to say the same thing twice.

1. Every correction on an edit → `node scripts/factory.mjs feedback "<exact words>"` before touching anything (a hook reminds you when a project is active).
2. After fixing, distill what generalizes:
   - `node scripts/factory.mjs learn rule "..." --why "..."` for a brand preference;
   - `learn avoid` for something rejected or that failed;
   - `learn win` for something approved;
   - add `--technical` for tool or pipeline failures.
3. Before planning any edit, read the learnings (the session-start context prints them). Never retry anything under "Never again". If a rule was broken, fix the edit and sharpen the rule; never duplicate it.
4. Keep entries short, specific and testable ("Lower thirds hold 2.5 to 3 s", not "better lower thirds"). Consolidate when a file passes about 80 entries.

## Lab notes

`.claude/docs/LAB_NOTES.md` is the running log of what failed and the correct flow.

- Read it at the start of every session, before touching code.
- Before the session ends, ask: "What would have saved me time if I'd known it at the start?" If there's a real answer, add an entry at the top. No lesson means no entry.
- Keep the 5 to 10 most critical rules below as one-liners. Promote a lesson here once it has bitten us twice.

1. The Bash tool runs zsh: quote globs and `--include=*.x` ("no matches found" aborts the command), and unquoted `$vars` don't split.
2. `cd` doesn't carry between Bash calls: use absolute paths.
3. ffmpeg here has no `drawtext` and no `-filter_complex_script`: use `-/filter_complex <file>`.
4. `python3` is Apple's 3.9.6 with no PIL: do image work with sharp in Node, and run the watch scripts with `/opt/homebrew/bin/python3`.
5. Notion `update_content` never matches an uploaded image: insert through the heading text, don't retry.
6. Google Docs can't be read from here (curl 401, browser denied): look in the Notion row, then ask the user to paste it.
7. Never match cuts or captions on exact transcript spelling (`not found: "<phrase>"`, "300" vs "three hundred"): normalise tokens first.
8. A hook's output over 10,000 characters is cut to a 2 KB preview and no setting raises that: the session-start context goes out in pages, one hook per page. Anything a session must always see stays under the cap.
9. When a render starts, say what's running and how long it takes, before the user has to ask.
10. Write every card change as an overlap (the exit starts after the next card's entry starts) and snapshot the junctions at the output fps before the final render: bare frames between cards showed up in two reels in a row.

## Quality bar

- Self-verify every render before showing it: `node scripts/verify-render.mjs <mp4> --transcript <json>`, then Read the report, contact sheet and frames. Fix what you see; record it in `VERIFY.md`.
- Hard fails: black frames mid-video, faces covered, text outside title-safe, off-brand color or font, captions out of sync, clipping audio, loudness far from -14 LUFS.
- Never overwrite raw footage. New filename for every stage. Never mix original timestamps with edited footage.
- Paid calls (Kie.ai, ElevenLabs generation) follow the brand's spend policy. List assets and cost before spending when the policy is `ask`.

## Commands

```bash
node scripts/factory.mjs context [--page n] [--full] | doctor | brand list | brand use <slug>
node scripts/factory.mjs new-video <slug> --source inbox/<file> [--format youtube|shorts|course|podcast|ads|showreel|social|events]
node scripts/factory.mjs feedback "..."          # log a correction on the active project
node scripts/factory.mjs learn rule|avoid|win "..." [--why ".."] [--technical]
node scripts/transcribe.mjs <media> [--provider elevenlabs|groq|openai|local]
node scripts/verify-render.mjs <mp4> [--transcript t.json] [--at 12.5,40]
node scripts/youtube/package.mjs <project>            # YouTube package status + next step (PACKAGE.md)
node scripts/youtube/deliver-drive.mjs <project> --category "<Notion Category>" [--yes]   # Drive Ready/<cat> + Transcripts/
node scripts/youtube/check-titles.mjs --source <script|words.json> --file titles.txt
node scripts/sfx/install.mjs                          # install or refresh sfx-library/
node scripts/sfx/search.mjs "<words>" [--max s] | --get <id> --name <file>   # find and fetch a free effect on Openverse
node scripts/sfx/generate.mjs "<prompt>" --name <file>  # custom effect with ElevenLabs (paid)
npx hyperframes lint | check | preview | render     # run inside the project folder
npm test && npm run check                            # repo health
```

## Environment notes

- ffmpeg 9 removed `-vsync`; use `-fps_mode`. Hardware encoders: `h264_videotoolbox`, `hevc_videotoolbox`, `prores_videotoolbox` on macOS.
- Keys live only in `.env` (gitignored, written by onboarding). Never print or read their values; `doctor` reports status.
- HyperFrames skills are global (`~/.claude/skills`); refresh with `npm run skills:update`.
