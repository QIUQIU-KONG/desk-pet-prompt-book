# Open Source Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not dispatch parallel agents for this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the private repository for a later responsible public release with MIT-licensed code, explicitly license-pending artwork, current dependencies, public-facing documentation, CI, and a clean current tree.

**Architecture:** Keep the Electron core and JSON storage behavior unchanged. Move the active renderer and its required assets out of prototype/internal context directories, add a reusable repository-readiness audit, then layer package hardening, legal/community documentation, and GitHub automation on top. Current-tree cleanup is allowed; history rewriting and visibility changes are explicitly excluded.

**Tech Stack:** Electron, Node.js CommonJS and ESM tests, plain HTML/CSS/JavaScript, PowerShell, pnpm, GitHub Actions, Dependabot.

**Execution status:** Completed through Task 7 on 2026-07-15; final acceptance commit and remote verification are recorded in the checked steps below.

## Global Constraints

- The repository must remain private throughout this plan.
- Do not rewrite Git history, force-push, delete branches, create a public repository, or change visibility.
- Program code uses MIT; visual assets remain outside MIT and license-pending.
- Do not label any generated image CC BY 4.0 or CC0 without a later rights decision.
- Do not change product behavior or visual direction while reorganizing files.
- Runtime code must not load assets or scripts from `.codex`.
- Remove obsolete binaries only after active references have moved and tests pass.
- Do not commit machine-specific absolute paths, credentials, prompt-library data, or local configuration.
- Keep `package.json` private to prevent accidental npm publication.
- Electron must be at least `39.8.1` and `pnpm audit --audit-level high` must report zero high-severity vulnerabilities.
- Use Node 24 and pnpm `11.13.0` in the documented and CI toolchain.
- Complete every task with focused tests, the full test suite, a focused commit, and `git push origin main`.

## File Map

- `scripts/open-source-readiness.cjs`: reusable current-tree audit and CLI.
- `tests/open-source-readiness.test.mjs`: unit and repository contract tests for open-source readiness.
- `src/renderer/`: active renderer moved from `prototype/desktop-pet-preview`.
- `src/renderer/assets/`: only active pet, panel, and page-mask assets.
- `scripts/preview-server.cjs`: repository-relative local preview server.
- `docs/images/app-preview.png`: README screenshot moved from acceptance output.
- `docs/asset-prompts/`: selected text prompts only, without raw generation candidates.
- `docs/architecture.md`: runtime boundary and data-flow overview.
- `docs/data-and-privacy.md`: storage and clipboard details.
- `docs/asset-provenance.md`: asset source and license status.
- `README.md` and `README.en.md`: Chinese and English project entry points.
- `LICENSE`: MIT license for code.
- `ASSET-LICENSE.md`: explicit exclusion and pending status for artwork.
- `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`: public repository policy documents.
- `.github/workflows/ci.yml`: pull-request and main-branch verification.
- `.github/dependabot.yml`: weekly npm dependency checks.
- `.github/ISSUE_TEMPLATE/`: issue forms and links.
- `.github/pull_request_template.md`: contributor verification checklist.
- `.editorconfig`, `.gitattributes`: stable source formatting and line endings.
- `.codex/open-source-history-cleanup-report.md`: non-destructive history assessment and later options.

---

### Task 1: Add A Reusable Open-Source Readiness Audit

**Files:**
- Create: `scripts/open-source-readiness.cjs`
- Create: `tests/open-source-readiness.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `findSensitivePathMatches(text, filePath) -> Array<{ filePath, line, value }>`.
- Produces: `validatePackageMetadata(packageJson) -> string[]`.
- Produces: `resolveGitBinary(rootDir) -> string`, honoring `DESK_PET_GIT` before portable/project-relative and PATH fallbacks.
- Produces: `auditRepository({ rootDir, strict }) -> Promise<{ errors: string[], warnings: string[], metrics: object }>`.
- Produces CLI: `node scripts/open-source-readiness.cjs [--strict] [--json]`.

- [x] **Step 1: Add failing unit tests for audit primitives**

Create `tests/open-source-readiness.test.mjs` with focused unit cases:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  findSensitivePathMatches,
  validatePackageMetadata
} = require('../scripts/open-source-readiness.cjs');

test('readiness audit detects personal absolute paths but accepts environment paths', () => {
  const userPath = ['C:', 'Users', 'person', 'Desktop', 'file.png'].join('\\');
  const workspacePath = ['D:', 'workspace', 'asset.png'].join('\\');
  assert.equal(findSensitivePathMatches(userPath, 'a.md').length, 1);
  assert.equal(findSensitivePathMatches(workspacePath, 'a.md').length, 1);
  assert.equal(findSensitivePathMatches('%APPDATA%\\desk-pet-prompt-book', 'a.md').length, 0);
  assert.equal(findSensitivePathMatches('$CODEX_HOME/superpowers/skills', 'a.md').length, 0);
});

test('package metadata requires public repository fields while keeping npm private', () => {
  const errors = validatePackageMetadata({
    name: 'desk-pet-prompt-book',
    version: '0.1.0',
    private: true
  });

  assert.ok(errors.some((message) => message.includes('license')));
  assert.ok(errors.some((message) => message.includes('repository')));
  assert.ok(errors.some((message) => message.includes('packageManager')));
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because `scripts/open-source-readiness.cjs` does not exist.

- [x] **Step 3: Implement the audit module and report-only CLI**

Create `scripts/open-source-readiness.cjs` with these required constants and exports:

```js
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const REQUIRED_PUBLIC_FILES = [
  'README.md',
  'README.en.md',
  'LICENSE',
  'ASSET-LICENSE.md',
  'PRIVACY.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md'
];

function resolveGitBinary(rootDir) {
  const candidates = [
    process.env.DESK_PET_GIT,
    path.resolve(rootDir, '..', '.tools', 'PortableGit', 'cmd', 'git.exe')
  ].filter(Boolean);
  return candidates.find((candidate) => fsSync.existsSync(candidate)) || 'git';
}

function findSensitivePathMatches(text, filePath) {
  const pattern = /(?:[A-Za-z]:\\[^\s`"']+|\/Users\/[^\s`"']+|\/home\/[^\s`"']+)/g;
  return String(text).split(/\r?\n/).flatMap((lineText, index) =>
    [...lineText.matchAll(pattern)].map((match) => ({
      filePath,
      line: index + 1,
      value: match[0]
    }))
  );
}

function validatePackageMetadata(packageJson) {
  const errors = [];
  if (packageJson.private !== true) errors.push('package.json must keep private=true');
  if (packageJson.license !== 'MIT') errors.push('package.json license must be MIT');
  if (!packageJson.repository?.url) errors.push('package.json repository.url is required');
  if (!packageJson.bugs?.url) errors.push('package.json bugs.url is required');
  if (!packageJson.homepage) errors.push('package.json homepage is required');
  if (!packageJson.packageManager?.startsWith('pnpm@')) errors.push('package.json packageManager is required');
  if (!packageJson.engines?.node) errors.push('package.json engines.node is required');
  return errors;
}
```

`auditRepository` must call `resolveGitBinary(rootDir)` and use `git ls-files` so ignored and untracked files are excluded, scan tracked text files only, count tracked binary assets, check required files, validate package metadata, and report any runtime reference containing `.codex/`. In non-strict mode, missing future deliverables are warnings; `--strict` promotes them to errors. The CLI must never modify files.

- [x] **Step 4: Add a temporary report script without enabling the strict gate**

Modify `package.json` scripts:

```json
"readiness:report": "node scripts/open-source-readiness.cjs --json"
```

Do not add the strict readiness command yet; the current repository is expected to report warnings until Task 6.

- [x] **Step 5: Run focused and full tests**

Run:

```powershell
node --test tests/open-source-readiness.test.mjs
corepack pnpm test
node scripts/open-source-readiness.cjs --json
```

Expected: unit and full tests pass; report-only CLI exits 0 and lists the known missing deliverables as warnings.

- [x] **Step 6: Commit and push the audit foundation**

```powershell
git add scripts/open-source-readiness.cjs tests/open-source-readiness.test.mjs package.json
git commit -m "test: add open source readiness audit"
git push origin main
```

---

### Task 2: Move The Active Renderer And Required Assets Into Source

**Files:**
- Move: `prototype/desktop-pet-preview/index.html` -> `src/renderer/index.html`
- Move: `prototype/desktop-pet-preview/styles.css` -> `src/renderer/styles.css`
- Move: `prototype/desktop-pet-preview/pet-preview.js` -> `src/renderer/pet-preview.js`
- Move: `prototype/desktop-pet-preview/prompt-entry-view.js` -> `src/renderer/prompt-entry-view.js`
- Move: `.codex/visuals/assets/book-body/pet-book-body-v5-alpha.png` -> `src/renderer/assets/pet-book-body-v5-alpha.png`
- Move: `.codex/visuals/final-electron-acceptance.png` -> `docs/images/app-preview.png`
- Move: `.codex/desktop-pet-preview-server.cjs` -> `scripts/preview-server.cjs`
- Modify: `src/electron/main.cjs`
- Modify: `src/renderer/index.html`
- Modify: `scripts/generate-page-masks.ps1`
- Modify: `scripts/preview-server.cjs`
- Modify: `tests/desktop-pet-preview.test.mjs`
- Modify: `tests/electron-pet-shell.test.mjs`

**Interfaces:**
- Produces renderer entry: `src/renderer/index.html`.
- Produces preview URL: `http://127.0.0.1:<port>/src/renderer/index.html`.
- Preserves all existing renderer `data-*` contracts and Electron preload APIs.

- [x] **Step 1: Change path-contract tests first**

Update test URL construction to `../src/renderer/...` and assert Electron loads the new renderer path:

```js
const htmlPath = new URL('../src/renderer/index.html', import.meta.url);
const cssPath = new URL('../src/renderer/styles.css', import.meta.url);
const jsPath = new URL('../src/renderer/pet-preview.js', import.meta.url);
const promptEntryViewPath = new URL('../src/renderer/prompt-entry-view.js', import.meta.url);
```

Add assertions:

```js
assert.match(main, /path\.join\(rootDir, 'src', 'renderer', 'index\.html'\)/);
assert.doesNotMatch(main, /prototype.*desktop-pet-preview/);
```

- [x] **Step 2: Run focused tests and verify RED**

```powershell
node --test tests/desktop-pet-preview.test.mjs tests/electron-pet-shell.test.mjs
```

Expected: FAIL because `src/renderer` is not present and the main process still loads the prototype path.

- [x] **Step 3: Move the renderer and active binary assets**

Use `git mv` for tracked files and create destination directories before binary moves. Move the four renderer files, the existing renderer `assets` folder, the selected pet body, the final Electron screenshot, and the preview server.

After the moves, `src/renderer/assets` must contain the old runtime candidates temporarily; they are removed only in Task 3 after active references pass.

- [x] **Step 4: Update runtime paths without changing behavior**

Change `src/electron/main.cjs`:

```js
const rendererPath = path.join(rootDir, 'src', 'renderer', 'index.html');
```

Change the selected pet source in `src/renderer/index.html`:

```html
<img class="pet-book" src="./assets/pet-book-body-v5-alpha.png" alt="漂浮展开的魔法书" />
```

Update `scripts/generate-page-masks.ps1` so `$assetDir` resolves to `../src/renderer/assets`; generated mask dimensions and shapes remain unchanged.

Replace the preview server's absolute root and fixed port:

```js
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 56005);
const defaultPath = '/src/renderer/index.html';
```

Validate the requested file using `path.relative(root, file)` and reject paths where the relative value starts with `..` or is absolute.

- [x] **Step 5: Run syntax, focused, and full tests**

```powershell
node --check src/renderer/pet-preview.js
node --check src/renderer/prompt-entry-view.js
node --check scripts/preview-server.cjs
powershell -ExecutionPolicy Bypass -File scripts/generate-page-masks.ps1
node --test tests/desktop-pet-preview.test.mjs tests/electron-pet-shell.test.mjs
corepack pnpm test
```

Expected: all checks pass with no runtime path under `prototype` or `.codex`.

- [x] **Step 6: Run browser and Electron smoke checks**

Start the preview server on an unused port and verify HTTP 200 for `/src/renderer/index.html`. Start Electron, confirm pet mode opens, open/close the panel, and confirm the book and panel assets render.

- [x] **Step 7: Commit and push the renderer relocation**

```powershell
git add src/renderer src/electron/main.cjs scripts/preview-server.cjs docs/images/app-preview.png tests
git commit -m "refactor: move active renderer into source"
git push origin main
```

---

### Task 3: Remove Obsolete Assets And Sanitize The Current Tree

**Files:**
- Delete: obsolete PNG/JPG/SVG files under `.codex/visuals`
- Delete: unused candidate images under `src/renderer/assets`
- Create: `docs/asset-prompts/README.md`
- Move: selected final prompt text files into `docs/asset-prompts/`
- Create: `.editorconfig`
- Create: `.gitattributes`
- Modify: `.gitignore`
- Modify: `AGENT.MD`
- Modify: `.codex/desktop-pet-asset-spec.md`
- Modify: `.codex/desktop-pet-layered-assets.md`
- Modify: `.codex/floating-panel-design.md`
- Modify: `.codex/ui-visual-direction.md`
- Modify: `.codex/development-standards.md`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Produces allowed runtime assets: `pet-book-body-v5-alpha.png`, `panel-book-ui-v3b-alpha.png`, `page-mask-left.png`, `page-mask-right.png`.
- Produces current-tree invariant: no tracked personal absolute path.
- Produces current-tree invariant: no tracked visual-development draft remains under `.codex/visuals`.
- Preserves selected prompt provenance as text only.

- [x] **Step 1: Add failing current-tree contract tests**

Add tests that call `auditRepository({ rootDir, strict: false })` and assert:

```js
assert.equal(result.metrics.runtimeCodexReferences, 0);
assert.deepEqual(result.metrics.runtimeAssets.sort(), [
  'page-mask-left.png',
  'page-mask-right.png',
  'panel-book-ui-v3b-alpha.png',
  'pet-book-body-v5-alpha.png'
]);
assert.equal(result.metrics.personalPathMatches, 0);
```

- [x] **Step 2: Run focused tests and verify RED**

```powershell
node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because obsolete assets and absolute paths remain.

- [x] **Step 3: Preserve only selected text prompts**

Move the final pet-body and panel-generation prompt text into `docs/asset-prompts/`. Create `README.md` there identifying them as process records, not licenses or provider endorsements.

- [x] **Step 4: Remove obsolete current-tree binaries**

Use Git pathspecs to remove tracked `.png`, `.jpg`, `.jpeg`, and `.svg` files under `.codex/visuals` after the selected runtime asset and README screenshot have moved. Remove unused renderer candidates:

```text
panel-book-ui-v2.png
panel-book-ui-v3-alpha.png
panel-heavy-grimoire.png
panel-heavy-grimoire-alpha.png
```

Before removal, verify each resolved target is inside the repository and none is referenced by `src`, `tests`, `scripts`, or public docs.

- [x] **Step 5: Replace personal paths and stale candidate references**

Use repository-relative paths in project context. Replace the hard-coded Superpowers installation path with `$CODEX_HOME/superpowers/skills`. Rewrite asset documents around the four selected runtime files and the preserved prompt records; remove long candidate inventories that reference deleted binaries.

- [x] **Step 6: Add repository text/binary attributes**

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true

[*.{js,cjs,mjs,json,md,yml,yaml,css,html}]
indent_style = space
indent_size = 2
```

Create `.gitattributes`:

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.ico binary
```

Add local verification state and private generation scratch patterns to `.gitignore`:

```gitignore
.codex/last-verified.local.json
.codex/visuals/private-drafts/
```

- [x] **Step 7: Run cleanup verification**

```powershell
$report = node scripts/open-source-readiness.cjs --json | ConvertFrom-Json
if ($report.metrics.personalPathMatches -ne 0) { throw 'Tracked text still contains absolute paths' }
node --test tests/open-source-readiness.test.mjs
corepack pnpm test
node scripts/open-source-readiness.cjs --json
git diff --check
```

Expected: no personal-path matches, exactly four runtime images, no runtime `.codex` references, and all tests pass.

- [x] **Step 8: Commit and push current-tree cleanup**

```powershell
git add .codex AGENT.MD .editorconfig .gitattributes .gitignore docs/asset-prompts src/renderer/assets tests/open-source-readiness.test.mjs
git commit -m "chore: clean private visual development artifacts"
git push origin main
```

---

### Task 4: Harden Package Metadata And Dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `.npmrc`
- Modify: `tests/open-source-readiness.test.mjs`
- Modify: `tests/electron-pet-shell.test.mjs`

**Interfaces:**
- Produces package scripts: `start`, `pet`, `preview`, `check:syntax`, `test`, `audit:high`, `readiness:report`, `readiness`.
- Produces exact package manager: `pnpm@11.13.0`.
- Produces reviewed Electron patch: `39.8.10` (minimum accepted floor remains `39.8.1`).

- [x] **Step 1: Add failing package hardening assertions**

Assert package metadata and scripts:

```js
assert.equal(packageJson.private, true);
assert.equal(packageJson.license, 'MIT');
assert.equal(packageJson.packageManager, 'pnpm@11.13.0');
assert.equal(packageJson.engines.node, '>=24');
assert.match(packageJson.repository.url, /QIUQIU-KONG\/desk-pet-prompt-book/);
assert.equal(packageJson.scripts.start, 'electron .');
assert.match(packageJson.scripts.preview, /scripts\/preview-server\.cjs/);
assert.match(packageJson.scripts.readiness, /--strict/);
assert.ok(Number(packageJson.devDependencies.electron.replace(/^[^0-9]*/, '').split('.')[0]) >= 39);
```

- [x] **Step 2: Run focused tests and verify RED**

```powershell
node --test tests/open-source-readiness.test.mjs tests/electron-pet-shell.test.mjs
```

Expected: FAIL because package metadata and the supported Electron version are missing.

- [x] **Step 3: Update package metadata and scripts**

Set these fields while retaining existing description and main entry:

```json
{
  "private": true,
  "license": "MIT",
  "author": "QIUQIU-KONG",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/QIUQIU-KONG/desk-pet-prompt-book.git"
  },
  "bugs": {
    "url": "https://github.com/QIUQIU-KONG/desk-pet-prompt-book/issues"
  },
  "homepage": "https://github.com/QIUQIU-KONG/desk-pet-prompt-book#readme",
  "engines": {
    "node": ">=24"
  },
  "packageManager": "pnpm@11.13.0"
}
```

Add keywords for Electron, desktop pet, clipboard, prompt management, and Windows. Add the scripts defined in this task's interface. Keep `pet` as an alias to `pnpm start` for compatibility.

- [x] **Step 4: Remove the repository-wide Electron mirror**

Delete `.npmrc`. Document optional mirror setup later in CONTRIBUTING rather than forcing it on every clone.

- [x] **Step 5: Upgrade Electron and refresh the lockfile**

```powershell
corepack pnpm add --save-dev --save-exact electron@39.8.10
corepack pnpm install --lockfile-only
```

Expected: `package.json` and `pnpm-lock.yaml` resolve the reviewed Electron `39.8.10` patch, which clears the advisories present in `39.8.1`.

- [x] **Step 6: Verify dependency, syntax, tests, and Electron smoke**

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm audit --audit-level high
```

Expected: syntax and tests pass; audit exits 0 with no high-severity vulnerabilities. Start Electron and verify pet/panel open and close on the upgraded runtime.

- [x] **Step 7: Commit and push dependency hardening**

```powershell
git add package.json pnpm-lock.yaml tests
git rm .npmrc
git commit -m "chore: harden public package metadata"
git push origin main
```

---

### Task 5: Add Legal, Privacy, Architecture, And Contributor Documentation

**Files:**
- Create: `LICENSE`
- Create: `ASSET-LICENSE.md`
- Create: `README.md`
- Create: `README.en.md`
- Create: `PRIVACY.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Create: `docs/architecture.md`
- Create: `docs/data-and-privacy.md`
- Create: `docs/asset-provenance.md`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Produces clear license boundary: MIT code, excluded license-pending artwork.
- Produces clean-clone setup commands and source-only alpha status.
- Produces privacy disclosure for clipboard and local JSON storage.

- [x] **Step 1: Add failing documentation contract tests**

For every required document, assert it exists, is non-empty, and contains its required marker. Required examples:

```js
assert.match(await readFile('LICENSE', 'utf8'), /MIT License/);
assert.match(await readFile('ASSET-LICENSE.md', 'utf8'), /not licensed under the MIT License/i);
assert.match(await readFile('README.md', 'utf8'), /源码开发阶段/);
assert.match(await readFile('README.en.md', 'utf8'), /source-stage alpha/i);
assert.match(await readFile('PRIVACY.md', 'utf8'), /clipboard/i);
assert.match(await readFile('SECURITY.md', 'utf8'), /privately/i);
```

- [x] **Step 2: Run focused tests and verify RED**

```powershell
node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because public documents do not exist.

- [x] **Step 3: Add MIT and asset boundary documents**

Use the standard MIT License text with:

```text
Copyright (c) 2026 QIUQIU-KONG
```

`ASSET-LICENSE.md` must list the four distributed runtime PNG files and `docs/images/app-preview.png`, state they are not covered by MIT, and state that no redistribution license is granted while provider rights are pending. It must link to `docs/asset-provenance.md`.

- [x] **Step 4: Write bilingual README files**

Both README files must include:

- Source-stage alpha badge/text, not a production-release claim.
- App screenshot from `docs/images/app-preview.png`.
- Windows, Node 24, Corepack, and pnpm prerequisites.
- `corepack pnpm install`, `corepack pnpm start`, `corepack pnpm preview`, and `corepack pnpm test` commands.
- Clipboard capture, search, project, stage, rating, pin, copy, edit, and delete features.
- Local-only data statement and unencrypted JSON warning.
- Project structure and public roadmap.
- Separate code and visual asset license summary.

- [x] **Step 5: Write privacy, security, and contributor policies**

`PRIVACY.md` must state explicit-gesture clipboard access, local Electron `userData` storage, no intentional prompt-library network upload, no at-rest encryption, browser permission differences, and local deletion guidance.

`SECURITY.md` must direct vulnerability reports to GitHub private vulnerability reporting when available and forbid disclosure of unpatched vulnerabilities in public issues.

`CONTRIBUTING.md` must document Corepack/pnpm setup, tests, visual screenshots, privacy review, asset provenance, focused commits, and optional local mirror configuration without restoring `.npmrc`.

Use Contributor Covenant 2.1 for `CODE_OF_CONDUCT.md`, naming the repository owner as the enforcement contact through GitHub.

- [x] **Step 6: Write architecture, data, provenance, and changelog docs**

Document Electron main/preload/renderer/store boundaries, IPC flow, clipboard capture sequence, JSON storage location semantics, no telemetry, and current asset generation/provider uncertainty. `CHANGELOG.md` follows Keep a Changelog style and lists `0.1.0` as unreleased source-stage alpha.

- [x] **Step 7: Run documentation and full verification**

```powershell
node --test tests/open-source-readiness.test.mjs
corepack pnpm test
corepack pnpm run readiness:report
git diff --check
```

Expected: all documentation contracts pass; remaining readiness warnings concern GitHub automation and history only.

- [x] **Step 8: Commit and push public documentation**

```powershell
git add LICENSE ASSET-LICENSE.md README.md README.en.md PRIVACY.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md CHANGELOG.md docs tests/open-source-readiness.test.mjs
git commit -m "docs: add public project documentation"
git push origin main
```

---

### Task 6: Add GitHub CI And Community Automation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Modify: `tests/open-source-readiness.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces required CI checks on pushes to `main` and pull requests.
- Produces weekly npm dependency updates.
- Produces structured issue and pull request intake.
- Enables strict local readiness command: `corepack pnpm run readiness`.

- [x] **Step 1: Add failing automation contract tests**

Assert all automation files exist and verify key content:

```js
assert.match(ci, /pull_request:/);
assert.match(ci, /push:/);
assert.match(ci, /pnpm install --frozen-lockfile/);
assert.match(ci, /pnpm run check:syntax/);
assert.match(ci, /pnpm test/);
assert.match(ci, /pnpm run readiness/);
assert.match(dependabot, /package-ecosystem:\s*"npm"/);
assert.match(pullRequestTemplate, /Asset provenance/i);
```

- [x] **Step 2: Run focused tests and verify RED**

```powershell
node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because `.github` automation files do not exist.

- [x] **Step 3: Create least-privilege CI**

Create `.github/workflows/ci.yml` with `permissions: contents: read`, `timeout-minutes: 20`, Node 24, pnpm 11.13.0, and a Windows/Ubuntu matrix. Required steps:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 11.13.0
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm run check:syntax
- run: pnpm test
- run: pnpm run readiness
```

Add a separate Ubuntu audit job that runs `pnpm audit --audit-level high`.

- [x] **Step 4: Add Dependabot and community templates**

Configure weekly npm updates against `/`. Bug forms collect OS, app commit/version, reproduction, expected/actual behavior, logs with sensitive data removed, and screenshots. Feature forms collect workflow and acceptance value. Disable blank issues and link security reports to `SECURITY.md`.

The pull request template requires test evidence, visual screenshots when applicable, privacy impact, and asset provenance confirmation.

- [x] **Step 5: Enable the strict readiness script**

Add:

```json
"readiness": "node scripts/open-source-readiness.cjs --strict"
```

Update the audit's required-file list to include all `.github` deliverables and public documentation.

- [x] **Step 6: Verify automation contracts and strict readiness**

```powershell
node --test tests/open-source-readiness.test.mjs
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm run readiness
corepack pnpm audit --audit-level high
git diff --check
```

Expected: all commands exit 0.

- [x] **Step 7: Commit and push repository automation**

```powershell
git add .github package.json scripts/open-source-readiness.cjs tests/open-source-readiness.test.mjs
git commit -m "ci: add public repository quality gates"
git push origin main
```

After pushing, inspect the GitHub Actions result. Fix configuration failures before moving to Task 7.

---

### Task 7: Complete Private Open-Source Acceptance And History Report

**Files:**
- Create: `.codex/open-source-history-cleanup-report.md`
- Create: `scripts/verify-and-push.ps1`
- Modify: `.codex/agent-context.md`
- Modify: `.codex/development-plan.md`
- Modify: `.codex/open-source-readiness-implementation-plan.md`
- Modify: `AGENT.MD`
- Modify: `CONTRIBUTING.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Produces a verified Phase 1 state without changing visibility or history.
- Produces metrics and options for a later separately approved history operation.
- Produces one Windows verification/push entry point and an ignored local verification record.

- [x] **Step 1: Run a fresh full verification from the working tree**

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm run readiness
corepack pnpm audit --audit-level high
git diff --check
```

Expected: every command exits 0, all tests pass, and high-severity audit count is zero.

- [x] **Step 2: Run privacy and repository scans**

Scan tracked current text and history separately. Current-tree acceptance requires zero personal path and credential matches. Historical matches are recorded, not modified.

```powershell
git ls-files
git count-objects -vH
git rev-list --count --all
```

Record tracked file count, current binary size, packed history size, commit count, remaining historical absolute-path matches, and the exact path groups responsible for history weight.

- [x] **Step 3: Write the non-destructive history cleanup report**

The report must compare:

1. `git filter-repo` rewrite of the existing private repository followed by a separately approved force-push.
2. A new clean public repository created from the accepted tree while retaining the current private repository.
3. Keeping history unchanged, explicitly marked not recommended.

Include prerequisites, backup procedure, collaborator impact, remote verification, rollback limits, and the requirement for explicit approval. Do not run any rewrite command in this task.

- [x] **Step 4: Verify browser and Electron behavior on the final tree**

At browser `1280x720` and Electron pet/panel modes:

- Verify active assets render from `src/renderer/assets`.
- Verify pet click/double-click separation.
- Verify panel open/close, search, copy, rating 5, pin, edit, project/stage flows, and deletion.
- Verify transparent corners and stable drag size.
- Verify restart persistence with isolated test data.

Record any OS clipboard automation limitation explicitly rather than treating it as a pass.

- [x] **Step 5: Verify GitHub remains private**

Read the repository metadata through GitHub and assert:

```text
visibility=private
default_branch=main
```

Do not modify repository settings. Confirm no force-push occurred by comparing normal commit ancestry with `origin/main`.

- [x] **Step 6: Update durable project context and plan state**

Record the verified open-source Phase 1 status, dependency version, documentation entry points, CI status, asset-license pending state, and explicit remaining gates: provider confirmation, history choice, visibility approval, branch protection, and first release.

- [x] **Step 7: Commit and push final Phase 1 acceptance**

```powershell
git add .codex/open-source-history-cleanup-report.md .codex/agent-context.md .codex/development-plan.md .codex/open-source-readiness-implementation-plan.md
git commit -m "docs: record private open source readiness"
git push origin main
```

- [x] **Step 8: Verify repository and remote state**

```powershell
git status --short --branch
git log -8 --oneline
```

Expected: clean `main...origin/main`, all focused readiness commits visible, repository still private, no rewritten commits, and no required Phase 1 work remaining.

- [x] **Step 9: Close the reusable verification and push gap found in final self-review**

Add `scripts/verify-and-push.ps1` with portable Git/Corepack resolution, the complete local quality gate, dirty-tree push protection, optional `-Push`, and structured output to the ignored `.codex/last-verified.local.json`. Add a contract test and document the helper in agent and contributor instructions.
