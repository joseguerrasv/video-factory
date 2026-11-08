# Video Factory

A personal AI video editor that runs in Claude Code. Onboard your brand once, drop raw footage in `inbox/`, and Claude produces finished, on-brand edits: cuts, captions, motion graphics, B-roll, music and sound. It checks its own renders frame by frame and remembers every correction you make.

Built on [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML + GSAP to deterministic MP4) and the editing pipeline from Nate Herk's [HyperFrames Student Kit](https://github.com/nateherkai/hyperframes-student-kit), extended with multi-brand profiles, a guided onboarding app, render QA and a learning loop. Designed for Claude Opus 5.5.

## Quick start

You need Claude Code. Everything else is checked and installed by `/onboard-me`: Node.js 22+, ffmpeg, a private render browser, the HyperFrames CLI and skills, Python, and the [watch](https://github.com/bradautomates/claude-video) skill (so Claude can watch reference videos and your renders). It uses Homebrew on macOS and winget on Windows. Anything that needs your password, such as installing Homebrew itself, is shown as a command for you to paste into Terminal.

```bash
git clone https://github.com/joseguerrasv/video-factory.git video-factory && cd video-factory
claude               # open Claude Code in this folder
```

Then type **`/onboard-me`**. To check the machine any time, run `node scripts/factory.mjs doctor`; it prints an ordered install plan for anything missing. A setup page opens in your browser. It covers:

- your brand: name, logo (with automatic color suggestions), colors, fonts and vibe;
- your audience and voice;
- the formats you publish;
- how you like videos cut: pacing, captions, B-roll, music;
- the references you love and the things you never want;
- your API keys and how hands-on you want to be.

A live preview shows your frames as you answer. Click **Finish setup**, and Claude writes your personal brand kit into `brands/<you>/`.

## Editing

Put footage in `inbox/` and ask in plain language:

> Edit inbox/launch-take-3.mov as a YouTube video. Keep the story about our first 100 users.

> Turn inbox/podcast-ep12.mp4 into three 30-second Shorts.

> Make a 15-second showreel for the brand.

Claude runs the pipeline:

1. **Transcribe:** word-level timestamps.
2. **Cut:** silences are removed at your pacing; flubs and retakes are cut with review if you asked for it.
3. **Plan beats:** the hook, one idea per beat, pattern interrupts, all anchored to your words.
4. **Build:** HyperFrames motion graphics, captions in your style, B-roll, music ducked under voice, sound effects.
5. **Verify:** Claude renders a draft, inspects the frames and audio report, fixes problems and re-renders. You see the draft only after it passes.
6. **Deliver:** you get a final MP4 plus the extras you chose (SRT, ProRes, thumbnails, vertical cutdown).

## It learns

Every correction you give is logged in the project's `FEEDBACK.md`. Anything that should apply to future videos becomes a rule in `brands/<you>/learnings.md`:

- **Rules:** your preferences.
- **Never again:** approaches you rejected or that failed.
- **What works:** choices you approved.

Claude reads these before every edit, so you never repeat yourself. Tool-level lessons shared by every brand live in `learnings/technical.md`.

## Multiple brands

Run `/onboard-me` once per brand or client. Switch with `node scripts/factory.mjs brand use <slug>`. Update a brand with `/onboard-me <slug>`.

## Services

| Service | Used for | Required |
| --- | --- | --- |
| Groq, ElevenLabs or OpenAI | Transcription. The "local" option needs `brew install whisper-cpp` and no key | One of them |
| Kie.ai | AI images, video B-roll (Kling, Veo) and music (Suno) | Optional |
| ElevenLabs | Sound effects and voiceover | Optional |
| Pexels | Free stock footage | Optional |

Keys are entered on the onboarding page and stored only in `.env`, which is never committed. Paid generation follows the spend policy you set: ask first, a budget cap per video, or never.

## Layout

```
.claude/skills/     onboard-me, edit-video, short-form-edit, motion-showreel, cut-silences, cut-mistakes,
                    video-storytelling, hyperframes-video-beats, style-library
scripts/            factory CLI, onboarding app, transcription, render QA, cut and validation tools
style-library/      406 motion-graphics cards in 2 styles, plus scene templates in style-templates/
learnings/          technical lessons shared by all brands
brands/             your brand kits (local only)
video-projects/     your edits (local only)
inbox/              drop footage here (local only)
```

Useful commands: `npm run doctor`, `npm run context`, `npm test`, `npm run check`.

## Credits and licenses

- Editing pipeline, style library and templates are vendored from the HyperFrames Student Kit (MIT, © 2026 Nate Herk). See `licenses/` and `THIRD_PARTY_NOTICES.md`.
- HyperFrames is Apache-2.0, © HeyGen.
- AIS brand materials from the kit are intentionally not included.
