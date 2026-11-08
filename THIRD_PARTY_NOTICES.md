# Resource provenance

This project vendors selected parts of the **HyperFrames Student Kit**
(MIT, © 2026 Nate Herk; see licenses/STUDENT-KIT-LICENSE) and references
**HyperFrames** (Apache-2.0, HeyGen; see licenses/HYPERFRAMES-LICENSE). Vendored
kit material: the cut-silences, cut-mistakes, video-storytelling,
hyperframes-video-beats, motion-showreel, short-form-edit, and style-library
skills; style-library/ and style-templates/; the shared editing scripts in
scripts/ (preflight, preflight-all, validate-beat-sync, build-edl-review,
video-use-to-hyperframes-transcript, smoke-media, check-kit, style-library/*);
tests/ and their fixtures in examples/editing and examples/short-form;
examples/starter; MOTION_PHILOSOPHY.md; and docs/STORYTELLING-WORKBOOK.md,
docs/SHORT-FORM.md, and docs/TOOLS-AND-API-KEYS.md. Vendored files were adapted
for this project (brand-neutral defaults, Claude Code-only paths, the project's
transcription script, and upstream skill names).

The kit assembles original workspace workflows, design guidance, templates, and
card implementations. New pipeline resources exclude private source recordings
and private reference screenshots. The kit's example media, showcase videos, and
AI Automation Society (AIS) brand assets were not copied into this project.

- HyperFrames: https://github.com/heygen-com/hyperframes (Apache-2.0).
  The HyperFrames skills are not vendored here; they are installed globally with
  `npx hyperframes skills update`. The upstream Apache license is included in
  licenses/HYPERFRAMES-LICENSE.
- GSAP is installed from npm; its own license applies. See the license files in
  node_modules/gsap and https://gsap.com/community/standard-license/.
- Some library styles reference Google Fonts. Font licenses remain with their
  publishers. Install and preserve applicable licenses when localizing fonts.
- Vox, Kallaway, and Infinite are aesthetic reference names. These templates are
  not official brand assets or endorsed by those creators or organizations.

No blanket relicensing of third-party components is implied. See
licenses/STUDENT-KIT-LICENSE for the MIT permission for the original student-kit
material. Imported pipeline resources retain the grant in
licenses/PIPELINE-USE-PERMISSION.txt. This includes the added pipeline skills,
style library, templates, shared editing tools, and short-form workflow.
Third-party notices override these grants for their respective assets.

Library names, handles, statistics, and source labels inside cards are illustrative
placeholders (brand placeholders read `ACME`). Replace them with your own verified
copy before publishing a video.
