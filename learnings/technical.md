# Technical learnings

Distilled from real feedback, newest first in each section. Claude reads this before every edit.
Rules: how it should be done. Never again: tried, rejected or failed. What works: approved, worth repeating.
These apply to every brand. Record new ones with `node scripts/factory.mjs learn <kind> "..." --technical`.

## Rules

- [2026-11-03] ffmpeg alimiter delays its output by its lookahead (attack=2 ms is 95 samples at 48 kHz): shift by that before comparing a mix with its stems or subtracting a cue from it
- [2026-11-03] Snap every caption start that falls within 0.05 s of a layout change onto the change itself: a caption 7 ms early showed for one 60 fps frame in the new layout's place over the old shot
- [2026-11-03] Kling clips can hide an internal hard cut: scene-detect every generated clip (ffmpeg select=gt(scene,0.25)) and use only the first shot
- [2026-11-03] Word anchors on a phrase that repeats need a start time: at('Pick one') matched the earlier line and showed a recap row 37 s early. Before rendering, list every anchor with more than one hit and run validate-plan.mjs
- [2026-11-02] Public Skool About pages capture crisply at 2x in local headless Chrome (tools/capture.mjs, gallery.mjs); the built-in browser's zoom only crops. The real Games board with all 100 rows is /skoolers/-/games, in __NEXT_DATA__ pageProps.rows, under the owner's own MRR banner: read the rows, never capture that area
- [2026-11-01] In sharp, a single-band raw output comes back 3-band unless .toColourspace('b-w') is set, and raw input with a too-long buffer is accepted silently. Check the length is width x height. .stats() ignores earlier ops such as .extract(): extract to a buffer first.
- [2026-11-01] When OpenAI image generation has no credits (429), Kie seedream/5-pro-image-to-image takes the same references and prompt, 9:16 at 1530x2720, 16.5 credits per image. Paste the real logo over the generated one afterwards
- [2026-11-01] Scribe returns numbers as digits on some runs and spelled out on others. Never anchor a build on its spelling: normalise the tokens first
- [2026-10-31] Mark real screenshots by recolouring their own pixels with ffmpeg geq (background to #FFEA00, ink to #111114) and reveal it with a width tween on an overflow:hidden wrapper. It works on dark UI, where a multiply marker can't. Don't give each mark its own clip-path: past about 40 clip-path or radial-gradient layers HyperFrames lint flags composition_heavy_overlay_count_high and capture risks black frames
- [2026-10-31] Built-in browser screenshots cap at about 800 px wide. For a crisp real capture, clone the one card into a fixed overlay with CSS zoom so it fills 800 px, and save with the zoom action, which writes a PNG
- [2026-10-31] Static camera: to cut a person out, build a clean plate from the footage (per-pixel median of frames where Vision says background), key against it in a 12 px band around the Vision edge at thresholds 9-24, close 4 px, choke 2 px. Vision alone keeps wall chunks and a dark fringe
- [2026-10-31] A bed captured from speakers or a Loom has no real bass. Measure octave bands against an approved bed, then rebuild the low end with the song's own 110-480 Hz band pitched down an octave (asetrate=24000,aresample=48000,atempo=2; this ffmpeg has no rubberband) and cut the top. It is a stand-in: the licensed file is the fix.
- [2026-10-31] Loom downloads, like Screen Recordings, have a U+202F narrow no-break space before AM/PM. Glob the path. A Loom of a stock-site preview is a stand-in only: the final bed needs the licensed download.
- [2026-10-31] To cut a word out of a joined phrase ('and I'll'), read band energy at 10 ms steps: a nasal shows as the 800-2600 Hz band falling about 15 dB while the low band holds. Cut on the next vowel onset, then re-transcribe the joined audio to confirm the word is gone. Scribe word starts alone left an audible 'and'.
- [2026-10-31] macOS Screen Recording filenames have a narrow no-break space (U+202F) before AM/PM, so typed paths fail silently in ffprobe: glob them
- [2026-10-31] Keep the base video free of punch-ins: apply them live in the composition, only while the speaker is full frame, on the exact frame of the take change. A baked punch-in leaks into every panel and split
- [2026-10-30] Face tracking needs no install on this Mac: a small swiftc binary on Apple Vision did 4,400 frames in 35 s. The nose landmark slips when a hand is near the face, so confirm any big move on real frames before acting on it
- [2026-10-30] Closing a pause in one take: run the picture through the removed time in the frames of the new gap (no jump, A/V stays locked). It reads as motion up to about 6x; faster stutters, so use a plain cut. Never move the crop at a same-framing cut: the whole wall jumps and it reads as a camera bump
- [2026-10-30] Word edges in a quiet room: confirm speech by energy (past -40 dB and sustained), not voicing; autocorrelation misses soft starts like 'That' and would clip them. After any re-cut, LCS-diff a fresh transcript against the words the timeline should hold: it caught a left-in 'F--' and 'that...' that level checks passed
- [2026-10-30] Clean close-mic voice: rebuild the pauses instead of gating them. Drop the audio between phrases, fill the gap with room tone taken from the session, then compress gently (-27 dB 2.5:1, -20 dB 4:1 fast, about +15 dB make-up). Pauses went from -15 to -50 dB peak with the voice tone unchanged
- [2026-10-30] Retake-session raw footage: write the selects as speech spans in playback order (takes.mjs), build a frame-locked EDL, assemble the voice sample-accurately, render cached per-segment x264 (no B-frames, setpts=N/30/TB) and join by stream copy; out-of-order takes then cost nothing and a re-cut only renders what changed. This ffmpeg has no drawtext: label QA sheets another way
- [2026-10-30] Groq Whisper allows 20 requests a minute: pace per-phrase island passes at about 3.3 s per chunk; at 4 parallel most chunks fail with HTTP 429. Boundary 'repeats' (one word split across two chunks) are false alarms: check word duration in Scribe
- [2026-10-30] ElevenLabs Scribe word starts run 60-120 ms late (ends are accurate): take in-points from the 10 ms envelope, never word.start, or the first consonant gets clipped
- [2026-10-25] Long ffmpeg filter graphs go in a file passed with -/filter_complex <file>; -filter_complex_script was removed in this ffmpeg build
- [2026-10-17] When the voice chain needs > ~15 dB make-up gain, put a light denoise (afftdn nf=-65) and a downward expander (agate ~-42 dB, 4:1, range -20 dB, release 300 ms) before the compressors and check the 5th-percentile 100 ms level: room tone must stay >= 25 dB under speech
- [2026-10-17] Find retakes by transcribing each speech island alone (split at >= 60 ms gaps under -42 dB): it catches repeats the full-file Groq pass merges, but invents repeats at stop closures ('it, it's', 'I think, I think'); confirm every candidate on a spectrogram before cutting
- [2026-10-17] To find edit points in a creator's own AAC export, scan the 44.1k audio for near-zero runs (|x| < 2e-4, >= 1.5 ms) inside the room tone: hard splices leave them even where the picture shows no jump; pair with single-frame jumps in the camera-bubble region
- [2026-10-16] HyperFrames renders at 30 fps unless the root has data-fps or the CLI gets --fps; meta.json fps is ignored. Put data-fps="60" on the root (brand export is 1080p60) and check r_frame_rate before delivering
- [2026-10-14] In Remotion edits, load every image with <Img> (or a hidden <Img> preload for SVG <image>), never a plain <img>: the renderer doesn't wait for plain tags and frames come out with blank avatars
- [2026-10-14] Cut out 3D/clay characters with hyperframes remove-background unioned with a white-threshold mask (ffmpeg blend=lighten); white-threshold alone punches holes in white clothes, the AI matte alone drops gray props like laptops
- [2026-10-02] Render long videos (> 15 min) from a Terminal tab with HF_SEGMENTED_CAPTURE=true --resume --keep-segments --experimental-fast-capture=false; background jobs get killed and fast capture stalls
- [2026-10-01] Kie.ai costs: Suno music 12 credits per call (2 takes), Seedream still 14 credits, Kling v3 turbo 5 s 1080p clip about 112 credits. Quote Kling clips individually before batching
- [2026-09-27] Localize every font, image and clip before rendering; HyperFrames renders must not fetch from the network
- [2026-09-27] Mute every <video> and carry sound on sibling <audio> elements; animate a non-timed wrapper, never the video element itself
- [2026-09-27] Visible timed divs need class="clip" plus data-start, data-duration, data-track-index; same-track clips must not overlap
- [2026-09-27] After any cut, use only the retimed transcript that matches that video

## Never again

- [2026-11-01] Don't open background gaps in a cut-out by colour threshold alone: it also punches through dark creases inside the person. Flood fill from outside the matte, through the dark pixels only.
- [2026-11-01] Don't leave white masking boxes on an image-model layout guide: Seedream copies them as real shapes (a box near the cap became a notch in the cap). Mask with content-aware crops, or check the guide's silhouettes before sending
- [2026-10-31] ElevenLabs sound generation with the current key: it lacks the sound_generation permission and returns 401. Add the permission in the ElevenLabs dashboard before planning custom effects
- [2026-10-31] Trusting a quality constant read from a bundled tool. Measure the real output first: the quant table in a captured JPEG showed quality 95 while the source said 80.
- [2026-10-31] Waiting for the encode to show a draft. Once capture ends, captured-frames/ holds every JPEG until the render cleans up, and ffmpeg with h264_videotoolbox gives a full 1080p preview from them. It takes minutes, less if nothing else is running.
- [2026-10-31] ffmpeg tile sheets to .jpg from limited-range video fail with 'Non full-range YUV is non-standard'. Add format=yuvj420p to the filter and -strict unofficial.
- [2026-10-31] overflow:hidden with border-radius on the wrapper of a HyperFrames video: the square video corners still show. Use clip-path: inset(0px round Npx) on the wrapper.
- [2026-10-31] CSS filter on the stage or cursor in a HyperFrames composition: it forces the slow screenshot capture (1080p 3:58 took 17 min), and on an element with clip-path the drop-shadow is clipped away anyway
- [2026-10-30] Voice chain with -38/-30 dB compressors and +23 dB make-up on a clean close mic: it lifts breaths and mouth clicks to speech level (clicks hit -2 dBFS, 71 of 72 pauses held audible noise). Check the pauses of a mix, not just its loudness
- [2026-10-30] Measuring lip sync by correlating mouth-region motion or pixels with the voice: r ~0.1 and the answer follows the reference lag. Use plosive tiles, 8+ samples, and average them; a single reading can be off by 100 ms
- [2026-10-22] GSAP fromTo with a property only in the 'from' object (e.g. opacity or y): fromTo animates only the 'to' keys, so it never applies; use tl.set(start values) at t0, then tl.to
- [2026-10-16] Prompting image models for an 'empty circle' in the centre: Seedream cuts a literal hole with a rim and shadow. Ask for 'flat continuous background in the centre, nothing there'; to fix an existing one, a Seedream edit with the same image as the only reference keeps face and text intact
- [2026-10-16] ffmpeg -filter_complex_script (removed in ffmpeg 9); load a filter graph from a file with -/filter_complex <file>
- [2026-10-16] Feeding HyperFrames a mono premix or voice track: the render upmixes it to dual mono and reads ~3 dB louder (-14 LUFS mono came out -11.1). Upmix the voice to stereo (pan=stereo|c0=c0|c1=c0) before the limiter and measure loudness on the stereo file
- [2026-10-16] Raising a quiet, peaky voice (crest ~17 dB) by +17 dB into a hard limiter: it squashes peaks ~11 dB and sounds crushed. Use highpass 70 Hz + two compressors (-38 dB 3:1, then -30 dB 8:1 fast), gain to -14.5, limiter catching ≤1-2 dB
- [2026-10-02] Trusting the Whisper (Groq) transcript to find repeats: it merges or drops repeated phrases ('to bring you the best to bring you the best' came out as 'bring you the best'). Before locking cuts, re-transcribe the cut audio and scan for repeated 2-6 word phrases; prefer a verbatim provider (ElevenLabs Scribe keeps disfluencies) when its key has speech-to-text permission
- [2026-10-02] Chopping speech at a retake with no pause; for repeated words/phrases with no silence between them, still remove the repeat, cutting at the quietest 10 ms window between the two takes (word boundary, never inside a word) with an 80-100 ms crossfade
- [2026-10-02] Cutting pauses from transcript word gaps alone (Whisper timings can be off by seconds); every cut point must sit in measured silence (silencedetect) or at the quietest 10 ms window, with 80-100 ms fades on hard edges
- [2026-09-27] Never pass -vsync to ffmpeg; use -fps_mode
- [2026-09-27] Never pause scene timelines that are added to the root timeline
- [2026-09-27] Never use Date.now(), unseeded Math.random() or render-time fetches in compositions

## What works
