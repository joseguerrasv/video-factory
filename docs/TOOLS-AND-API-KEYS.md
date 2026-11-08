# Tools, accounts, and API keys

Transcription runs through **`node scripts/transcribe.mjs`**, which supports four
providers: `elevenlabs`, `groq`, `openai`, and `local`. The default provider comes
from the active brand's `profile.json`; override it per call with `--provider`.
**Kie.ai** is an optional provider for generated video and image assets. None of
these is required for every edit. Bring your own accounts and credits, and
configure only what you use.

## What you need

| Tool or service | When you need it | Setup and cost |
| --- | --- | --- |
| Claude Code | Following the agent-guided editing skills | Your own assistant access. External service API credits are separate. |
| Node.js 22+, npm, Git, FFmpeg with ffprobe, and Chrome/Chromium | Local editing, preview, and rendering | Install on your computer. FFmpeg 8+ removed `-vsync`; use `-fps_mode`. |
| HyperFrames and GSAP | Video compositions and animation | Installed by `npm ci`. Rendering runs locally. Some templates use online fonts or CDNs; localize selected assets for final rendering. |
| ElevenLabs Scribe | Transcription (`--provider elevenlabs`) | `ELEVENLABS_API_KEY` with `speech_to_text` access and available usage. Audio is sent to ElevenLabs. |
| Groq Whisper | Transcription (`--provider groq`) | `GROQ_API_KEY` and Groq usage. Audio is sent to Groq. |
| OpenAI Whisper API | Transcription (`--provider openai`) | `OPENAI_API_KEY` and API billing. Audio is sent to OpenAI. |
| Local Whisper or whisper.cpp | Transcription on your computer (`--provider local`) | Separate runtime and model installation. No cloud transcription key; needs model downloads, disk space, and local compute. |
| Kie.ai | Optional generated moving B-roll, images, and other supported assets | Your own account, key, and credits. Existing footage and supplied assets can be used instead. |
| Your footage, logos, fonts, music, and sound effects | Building the actual edit | Supply assets you can use. This project does not include a stock-media or music subscription. |

The synthetic starter and checks need no paid transcription or generation API.
Choose a provider only when the next stage needs it.

## Transcription: `scripts/transcribe.mjs`

Keys live in the root `.env` and are usually entered through `/onboard-me`. Then run:

```sh
node scripts/transcribe.mjs video-projects/my-video/assets/raw.mp4
node scripts/transcribe.mjs video-projects/my-video/assets/raw.mp4 --provider groq
```

Without `--provider`, the active brand's `profile.json` choice is used. Every
provider writes the same word-level JSON (format below) beside the input as
`<stem>.json`. Reuse a verified transcript instead of paying to transcribe the
same take again.

Provider references:

- ElevenLabs: key from [ElevenLabs API settings](https://elevenlabs.io/app/settings/api-keys);
  see the [Scribe API documentation](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
  for current model options and usage details.
- OpenAI: word timestamps come from `whisper-1` with `response_format="verbose_json"`
  and `timestamp_granularities=["word"]`. Check current upload limits before
  sending long recordings; split audio when needed and retain chunk offsets. See
  [OpenAI's guide](https://developers.openai.com/api/docs/guides/speech-to-text).
- Groq: hosted Whisper with the same upload-limit and chunk-offset caveats.
- Local: [OpenAI Whisper](https://github.com/openai/whisper) or
  [whisper.cpp](https://github.com/ggml-org/whisper.cpp). Python Whisper requires
  Python and model dependencies; whisper.cpp has its own installation. Neither is
  installed by `npm ci`.

The cutting tools require this common format, with **word-level times in seconds**
on the exact source recording's timeline:

```json
{
  "text": "Hello world.",
  "audio_duration_secs": 2.0,
  "words": [
    { "text": "Hello", "start": 0.2, "end": 0.6 },
    { "text": "world.", "start": 0.7, "end": 1.2 }
  ]
}
```

If a transcript comes from anywhere other than `scripts/transcribe.mjs`, map the
provider's `word` field to `text`, preserve numeric start/end times, and get full
source duration from ffprobe.
Paragraphs, SRT subtitles, and segment-only transcripts do not supply the required
word timing. Request word timestamps or perform alignment; do not invent timing.
Later edits must retime words using their EDL. Short-form plans additionally track
`sourceStart` and `sourceEnd`.

Copy either prompt:

> Transcribe this recording with `--provider openai` instead of the brand default.
> Preserve the source and verify timing against its audio before cutting.

> Use `--provider local` for transcription. Check the local Whisper installation and
> model downloads first. Keep transcription local and use my supplied footage and
> assets without paid generation.

## Kie.ai: generated video and assets

[Kie.ai](https://kie.ai/) is an optional provider for generated video and image
assets. Set `KIE_API_KEY` in `.env` (or through `/onboard-me`) if you choose it. Follow the
[official API guide](https://docs.kie.ai/) for keys, model-specific requests,
task status, and credits.

The short-form skill describes a Kie workflow; this project does **not** bundle a
universal Kie generation script or connected account. The `motion-showreel` skill
includes a small client (`scripts/kie.mjs`) for its three showreel assets: Suno
instrumental music, Seedream stills from a logo reference, and Kling camera moves.
Ask the assistant to configure your selected model using current documentation. Adding a key alone does not
create an integration. Model inputs, formats, availability, and credit costs vary.

Prepare the proposed assets and expected cost before paid work that you have not
already authorized. Keep task IDs, reuse successful outputs, and save chosen
results inside your private project's assets. Inspect their motion, duration,
aspect ratio, and framing in the final edit.

> Use Kie.ai for moving B-roll in the approved scenes. Check my local configuration
> and current model documentation, then show me the assets you propose and expected
> credit cost. Reuse existing footage wherever it fits.

## Other optional tools referenced by bundled skills

These are workflow options, not a claim that every example used them:

- **Narration:** HyperFrames guides describe local Kokoro TTS with extra runtime
  and model setup. ElevenLabs and HeyGen TTS are also mentioned; each needs your
  service access and a configured API or connector.
- **Website capture:** Gemini can optionally provide richer image descriptions.
  Basic capture does not require that key.
- **Stock media:** `PEXELS_API_KEY` enables stock footage/image search where a
  workflow is configured to use it.
- **Older integration examples:** ClickUp or OpenAI access is needed only when
  your selected project actually calls those services.
- **Sound effects:** `motion-showreel` can generate an SFX kit with ElevenLabs
  sound generation (`scripts/sfx.mjs`). It uses `ELEVENLABS_API_KEY`; the key needs
  sound-effects access as well as `speech_to_text`. Your own SFX library works too.
- **Helper runtimes:** some optional scripts require Python. Playwright is
  included for relevant browser workflows; browser binaries may need installation.

A skill's mention of an MCP tool does not install that integration. Ask the
assistant to check which connectors or API clients are available first.

## Configure only what you use

Keys live in the root `.env` (`ELEVENLABS_API_KEY`, `GROQ_API_KEY`,
`OPENAI_API_KEY`, `KIE_API_KEY`, `PEXELS_API_KEY`) and are usually entered through
`/onboard-me`. Leave unused entries blank. `scripts/transcribe.mjs` and the
`motion-showreel` helpers load the root `.env`; other providers need their own
client or environment loading configured by the assistant. Keep credentials out
of compositions, screenshots, and commits.

Check current provider pricing and your balance before paid calls. This project
does not include transcription, generation, voiceover, or assistant credits.
