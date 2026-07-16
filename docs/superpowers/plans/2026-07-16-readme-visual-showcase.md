# README Visual Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real runtime desktop-pet screenshot to both READMEs and explain the intentional calligraphy as part of the product concept.

**Architecture:** Capture the existing renderer through the repository preview server and system Chrome, producing one documentation-only PNG without changing runtime code. Extend the existing public-documentation regression test so the two READMEs, screenshot, and license/provenance records remain synchronized.

**Tech Stack:** Markdown, Node.js test runner, existing preview server, system Chrome headless screenshot capture, PNG metadata checks.

## Global Constraints

- Keep the existing expanded-panel screenshot as a separate second state.
- The desktop-pet screenshot must come from the running renderer and include glow, stardust, smoke, and luminous butterflies.
- Keep Chinese and English READMEs structurally equivalent.
- Preserve the `license-pending` status of generated artwork and screenshots containing it.
- Do not add project dependencies or change runtime behavior.
- Execute serially and push the completed work to `main`.

---

### Task 1: Runtime Desktop-Pet Screenshot Contract And Capture

**Files:**
- Create: `docs/images/desktop-pet-preview.png`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Produces: a `1280x900` PNG captured from `src/renderer/index.html` in its closed desktop-pet state.
- Consumes: `scripts/preview-server.cjs` and the system Chrome executable resolved from `$env:ProgramFiles`.

- [x] **Step 1: Add the failing public-documentation test**

Extend `public documentation states project status, privacy, and license boundaries` to read `docs/images/desktop-pet-preview.png`, parse its PNG signature and IHDR dimensions, and require:

```js
assert.match(readme, /docs\/images\/desktop-pet-preview\.png/);
assert.match(englishReadme, /docs\/images\/desktop-pet-preview\.png/);
assert.match(readme, /Build agents with clarity\./);
assert.match(readme, /Let prompts become systems\./);
assert.match(englishReadme, /Build agents with clarity\./);
assert.match(englishReadme, /Let prompts become systems\./);
assert.match(assetLicense, /docs\/images\/desktop-pet-preview\.png/);
assert.match(assetProvenance, /docs\/images\/desktop-pet-preview\.png/);
assert.equal(petScreenshot.width, 1280);
assert.equal(petScreenshot.height, 900);
```

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because `docs/images/desktop-pet-preview.png` and the README references do not exist.

- [x] **Step 3: Start the repository preview server**

Use a free local port and start:

```powershell
node scripts/preview-server.cjs 56117
```

Verify `http://127.0.0.1:56117/src/renderer/index.html` returns HTTP 200.

- [x] **Step 4: Capture the running desktop-pet state**

Run Chrome headlessly against the renderer without clicking the pet:

```powershell
$chrome = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
$screenshot = Join-Path (Get-Location) 'docs\images\desktop-pet-preview.png'
& $chrome `
  --headless=new `
  --hide-scrollbars `
  --force-device-scale-factor=1 `
  --window-size=1280,900 `
  --virtual-time-budget=1800 `
  "--screenshot=$screenshot" `
  'http://127.0.0.1:56117/src/renderer/index.html'
```

The screenshot must show the complete floating book, visible glow and butterflies, no expanded panel, no browser chrome, and no personal desktop content.

- [x] **Step 5: Inspect the PNG**

Open `docs/images/desktop-pet-preview.png` at original detail. Confirm the book is centered, uncropped, readable, and the runtime effects remain visible against the dark background.

---

### Task 2: README Storytelling And Asset Records

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `ASSET-LICENSE.md`
- Modify: `docs/asset-provenance.md`
- Modify: `.codex/agent-context.md`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: `docs/images/desktop-pet-preview.png` from Task 1.
- Produces: matching Chinese/English two-state showcases and a six-file visual-license inventory.

- [x] **Step 1: Add the two-state README showcase**

Near the top of both READMEs, present this vertical order:

1. desktop-pet mode using `docs/images/desktop-pet-preview.png`;
2. expanded workspace using `docs/images/app-preview.png`.

Use clear captions and accessible alt text. Do not place the images in a side-by-side table.

- [x] **Step 2: Explain the book-page calligraphy**

Add a dedicated concept section with the exact lines:

```text
Build agents with clarity.
Let prompts become systems.
```

The Chinese README gives the translations “清晰地构建 Agent。” and “让提示词成为系统。” Both READMEs explain that isolated clipboard fragments become clear Agents, reusable prompts, project stages, and repeatable systems; the pen symbolizes turning written intent into an executable workflow.

- [x] **Step 3: Update license and provenance records**

Add `docs/images/desktop-pet-preview.png` to the tables in `ASSET-LICENSE.md` and `docs/asset-provenance.md`. Update the affected README and Agent-context count from five to six while retaining `license-pending`.

- [x] **Step 4: Verify GREEN**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: all public-documentation and readiness tests pass.

- [x] **Step 5: Run complete verification and inspect the diff**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall
git diff --check
git status --short
```

Expected: 89 or more tests pass, readiness reports 0 errors and 0 warnings, audit reports no known high-severity vulnerabilities, and only the planned README, screenshot, license/provenance, context, test, spec, and plan files differ.

- [x] **Step 6: Commit, push, and confirm CI**

Commit the implementation:

```powershell
git add README.md README.en.md ASSET-LICENSE.md docs/asset-provenance.md docs/images/desktop-pet-preview.png .codex/agent-context.md tests/open-source-readiness.test.mjs docs/superpowers/plans/2026-07-16-readme-visual-showcase.md
git commit -m "docs: showcase desktop pet concept"
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall -Push
```

Confirm `main` matches `origin/main` and the final GitHub Actions CI run succeeds.
