# Electron-Safe Desktop-Pet Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible magical glow and recognizable butterflies to the real Electron desktop pet without restoring transparent-window square artifacts.

**Architecture:** Keep browser-preview effects unchanged and add two Electron-only RGBA bitmap resources. Electron-safe elements animate only opacity and transform; automated contracts and real `220x220` light/dark composites guard against unsafe filters, blend modes, opaque corners, and layout overflow.

**Tech Stack:** Plain HTML/CSS, Electron 39.8.10, Node.js tests, RGBA PNG assets, built-in image generation with local chroma-key removal, Pillow for deterministic glow/composite validation.

## Global Constraints

- Keep the Electron pet window fixed at `220x220`.
- Do not re-enable Electron smoke in this phase.
- Do not use CSS `filter`, `backdrop-filter`, `box-shadow`, `drop-shadow`, or `mix-blend-mode` on Electron-safe elements.
- Animate Electron-safe effects only through `opacity` and `transform`.
- Preserve browser-preview effects and all prompt workflows.
- Both new visual files remain `license-pending` and increase the distributed visual-file count from six to eight.
- Execute serially and push the completed result to `main`.

---

### Task 1: Electron-Safe Effect Contracts

**Files:**
- Modify: `tests/desktop-pet-preview.test.mjs`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Produces: renderer and repository contracts for `pet-safe-glow-v1.png` and `pet-safe-butterfly-v1.png`.
- Consumes: existing PNG alpha parser and readiness runtime-asset inventory.

- [x] **Step 1: Write failing renderer tests**

Require `index.html` to load both assets through `.electron-safe-glow` and `.electron-safe-butterfly` elements. Require CSS to hide them by default, show them under `body.electron-shell`, hide the old `.butterflies` implementation in Electron, and provide reduced-motion overrides.

Read both PNGs with `readRgbaPng()` and assert transparent corners plus non-empty alpha coverage.

- [x] **Step 2: Write failing readiness tests**

Update the expected runtime asset list with:

```js
'pet-safe-butterfly-v1.png',
'pet-safe-glow-v1.png'
```

Require both files in `ASSET-LICENSE.md` and `docs/asset-provenance.md`, and require both READMEs to state eight distributed visual files.

- [x] **Step 3: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/desktop-pet-preview.test.mjs tests/open-source-readiness.test.mjs
```

Expected: FAIL because the assets, markup, Electron-safe styles, and eight-file documentation do not exist.

---

### Task 2: Generate And Integrate Safe Assets

**Files:**
- Create: `src/renderer/assets/pet-safe-glow-v1.png`
- Create: `src/renderer/assets/pet-safe-butterfly-v1.png`
- Create: `docs/asset-prompts/pet-safe-effects-v1.txt`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/styles.css`
- Modify: `ASSET-LICENSE.md`
- Modify: `docs/asset-provenance.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `.codex/agent-context.md`

**Interfaces:**
- Produces: Electron-only `.electron-safe-glow`, `.electron-safe-butterflies`, and `.electron-safe-butterfly` layers.
- Consumes: `pet-book-body-v5-alpha.png` geometry and the Task 1 contracts.

- [x] **Step 1: Generate the deterministic glow overlay**

Create a `1600x1600` RGBA PNG aligned with the book asset. Include a restrained cyan-white vertical glow along the center crease and a blue-violet elliptical levitation glow below the book. Pixels outside the glow remain fully transparent.

- [x] **Step 2: Generate and extract the butterfly sprite**

Use the built-in image generator to create one elegant white-blue fantasy butterfly with a clear wing silhouette on a perfectly flat `#ff00ff` background. Remove the key locally with the installed imagegen helper, crop transparent margins, and save a polished RGBA PNG. Validate the sprite at approximately `24px` display size on both white and dark backgrounds.

- [x] **Step 3: Add Electron-only semantic markup**

Place the glow image after `.book-body` and a decorative container with three reused butterfly images after the existing browser butterfly container. All new images use empty alt text, `aria-hidden="true"`, and `draggable="false"`.

- [x] **Step 4: Add safe Electron styles**

Hide new layers outside Electron. In Electron, hide old CSS butterflies and show the safe layers. Align the glow with the book; position three butterflies around the upper page area. Use subtle opacity/transform animations only and disable those animations under `prefers-reduced-motion: reduce`.

- [x] **Step 5: Update public asset records**

Record both files and the generation prompt. Update README and Agent-context counts from six to eight without changing `license-pending`.

- [x] **Step 6: Verify GREEN**

Run:

```powershell
corepack pnpm exec node --test tests/desktop-pet-preview.test.mjs tests/open-source-readiness.test.mjs
```

Expected: all renderer, alpha, documentation, and readiness contracts pass.

---

### Task 3: Real Electron Visual Acceptance And Delivery

**Files:**
- Replace: `docs/images/desktop-pet-preview.png`
- Create locally for inspection only: light/dark `220x220` acceptance composites
- Modify: `docs/superpowers/plans/2026-07-16-electron-safe-effects.md`

**Interfaces:**
- Consumes: Task 2 runtime layers.
- Produces: verified real-shell visuals and an updated README screenshot matching shipped behavior.

- [x] **Step 1: Restart the real Electron app**

Stop only the Electron root process started for the previous version, launch the current source, and confirm its renderer process responds.

- [x] **Step 2: Capture the real `220x220` pet**

Use Playwright's Electron connection or `webContents.capturePage()` to save an RGBA capture of the closed pet. Composite the capture over white and dark backgrounds for inspection.

- [x] **Step 3: Inspect visual acceptance**

Confirm no rectangular tint or opaque corner pixels; the center and lower glows are visible; at least two butterflies remain recognizable; the book and feedback label fit; and the window stays `220x220` while dragging.

- [x] **Step 4: Refresh the README screenshot**

Capture the renderer in Electron-shell styling at `1280x900` on a dark neutral documentation background so the README matches shipped effect layers rather than browser-only blur and smoke.

- [x] **Step 5: Run the complete gate**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall
```

Expected: syntax, 90 or more tests, strict readiness, dependency audit, and Git checks pass.

- [x] **Step 6: Review, commit, push, and confirm CI**

Review for unrelated files, generated intermediates, opaque corners, stale six-file counts, and unsafe Electron CSS. Commit the focused implementation, run `scripts/verify-and-push.ps1 -SkipInstall -Push`, confirm `main` matches `origin/main`, and verify the final GitHub Actions CI run succeeds.
