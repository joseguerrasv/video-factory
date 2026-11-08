---
name: onboard-me
description: Set up or update a brand in this video factory through a designed web onboarding page, then turn the answers into a personalized brand kit (BRAND.md, frame.md, tokens, editing profile, learnings). Use when the user runs /onboard-me, when no brand is configured yet, when they want to add another brand or client, or when they want to change their colors, fonts, logo, editing style, API keys or workflow preferences.
argument-hint: "[brand-slug to update]"
---

# Onboard me

The user answers questions in a local web page; you turn the answers into the files that personalize every future edit. Keep chat short while they fill it in.

## 1. Make sure the machine can edit

Goal: when onboarding ends, the user can edit immediately. Install what is missing, do not just report it.

**a. Node first** (every factory script needs it). Run `node -v`.

- Works and is v22 or newer: continue.
- Missing or older: install it, then check again.
  - macOS: `brew upgrade node || brew install node`. If `brew` itself is missing, go to step c for Homebrew first.
  - Windows: `winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements`, then ask the user to restart Claude Code.
  - Linux: `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash && . "$HOME/.nvm/nvm.sh" && nvm install 22`.

**b. Get the plan.** Run `node scripts/factory.mjs doctor --json`. `plan` is an ordered list of steps (Homebrew first, then system tools, project packages, the render browser, the HyperFrames skills, the watch skill and its dependencies). Tell the user in one line what is missing and that you are setting it up.

**c. Work through `plan` in order**, by `kind`:

| kind | What you do |
| --- | --- |
| `auto` | Run the commands now: project packages, the render browser download, HyperFrames skills. |
| `install` | Say in one line what you are installing, then run the commands (`brew`, `winget`, `claude plugin`, the watch installer). The permission prompt is the user's confirmation. If they decline, move on and note it. |
| `manual` | The command needs a password, a GUI or a new terminal (Homebrew, `sudo apt`). Show the exact command and the `note`, ask the user to run it in their Terminal app, and wait for "done". Launch onboarding (step 2) in the meantime so they are not blocked. |
| `in-app` | Ask the user to type the slash commands shown into Claude (or follow the `note`). |

- After Windows installs, the user may need to restart Claude Code before PATH changes apply.
- After a failed command, read the error and try the documented alternative once, then report it.

**d. Re-check.** Run `node scripts/factory.mjs doctor` again when the plan is done. Required items must be `ok`. For recommended items that are still missing (watch skill, Python), say what the user loses: without watch, Claude cannot watch reference videos or give renders a viewer-style pass. The optional `whisper.cpp` matters only if the brand picks local transcription; recheck it after step 4. Brand and key items marked TODO are what onboarding fixes, so ignore them here.

New or updated plugins and skills load in the next session. Mention it once, at the end of onboarding, not now.

## 2. Launch the page

```bash
node scripts/onboarding/start.mjs            # new brand, or resume a draft
node scripts/onboarding/start.mjs --brand <slug>   # update an existing brand
```

It starts a detached local server on 127.0.0.1, opens the browser, and prints `ONBOARDING_URL ...`. Tell the user in two or three lines: the page is open (give the URL in case the tab did not appear), it autosaves, API keys typed there go straight into `.env` and never pass through chat, and you will continue automatically when they click **Finish setup**.

## 3. Wait for completion

```bash
node scripts/onboarding/wait.mjs    # Bash timeout 600000
```

- Exit 0, `ONBOARDING_COMPLETE {...}`: go to step 4 with the `slug` from the JSON.
- Exit 2, `ONBOARDING_WAITING`: run it again. Loop quietly; post at most one short status line every three loops.
- Exit 3, `ONBOARDING_STOPPED`: the server stopped (idle timeout or killed). Restart with `start.mjs`; the draft resumes where they left off.
- If the user writes in chat while you wait, answer, then resume waiting. If they say they are done but wait does not complete, they did not click Finish setup: ask them to.

## 4. Generate the brand kit

```bash
node scripts/onboarding/generate.mjs <slug>
```

This writes `brands/<slug>/profile.json`, `tokens.css` (with Google Fonts downloaded into `assets/fonts/`), `frame.md`, `BRAND.md`, `references.md`, seeds `learnings.md` with their "never" list, and makes the brand active. Read its JSON output; surface every warning.

## 5. Personalize (your judgment, not a template)

Read `brands/<slug>/onboarding.json`, `profile.json`, `BRAND.md`, `frame.md`, and look at every logo in `assets/logo/` (Read PNG/JPG as images; read SVG source) and any guideline files in `assets/guidelines/`.

1. **BRAND.md**: rewrite it into a real brand brief of at most about 150 lines. Keep every fact from onboarding. Add:
   - a **Voice on screen** section: casing, sentence length, words to use and avoid, how numbers and claims are written;
   - three **example titles** and one **example lower third** written in their voice;
   - **Messaging pillars** inferred from tagline and audience (mark them as inferred);
   - a **CTA** section with when and where the call to action appears.
2. **frame.md**: refine only the prose sections (Overview, The Frame, Composition Rules, Do's and Don'ts). Use what you saw in the logo (shape language, weight, whether it needs a light or dark plate). **Never edit frontmatter values by hand.** If colors or fonts are wrong, fix the answers (rerun onboarding with `--brand <slug>`), then regenerate.
3. **Contrast check**: if the text on background ratio or accent visibility is poor, or the logo disappears on the chosen background, tell the user plainly and propose exact hex fixes. Do not silently change them.
4. **learnings.md**: turn durable preferences from the workflow notes into rules with `node scripts/factory.mjs learn rule "..." --why "onboarding notes"`.
5. **Updating an existing brand**: summarize what changed versus before in three bullets. Keep the user's hand edits in BRAND.md.

## 6. Verify and hand off

- `node scripts/factory.mjs context` must print the brand cleanly.
- Run `node scripts/factory.mjs doctor --json` again. Now that the brand exists, new plan steps can appear, such as `whisper.cpp` when they chose local transcription. Work through them as in step 1. Then list any keys their choices still need, with where to get each.
- If any plugin or skill was installed or updated in step 1, tell them to restart Claude Code once so everything loads.

Report in at most eight lines:

- where the brand kit lives;
- the active brand;
- any missing keys;
- how to start: drop footage in `inbox/` and say "edit inbox/<file> as a YouTube video" (or whichever format they chose);
- an offer to "analyze my references": watch each link in `references.md` with the watch skill and distill a style guide into `brands/<slug>/style/`.

## Rules

- Never print, echo or read `.env` values. Key status comes from doctor/context only.
- Brand folders are gitignored on purpose: they are personal. Do not commit them.
- One brand per run. For agencies, run `/onboard-me` once per client; switch with `node scripts/factory.mjs brand use <slug>`.
