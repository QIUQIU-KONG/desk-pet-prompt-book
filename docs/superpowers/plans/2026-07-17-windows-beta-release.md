# Windows Beta Installer and GitHub Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `Desk Pet Prompt Book` as the unsigned Windows Pre-release `v0.1.0-beta.1`, with one assisted per-user installer, stable local data, a native right-click exit path, repeatable release validation, and downloadable checksum verification.

**Architecture:** Keep application lifecycle hardening in a small CommonJS module consumed by the Electron main process, keep Windows packaging declarative in `electron-builder.yml`, and keep release identity/artifact validation in a dependency-free Node.js command. GitHub Actions builds only a tagged protected-main commit and creates the Pre-release as its final step; a local interactive Windows acceptance gate runs before the tag exists.

**Tech Stack:** Electron `39.8.10`, Node.js 24, pnpm `11.13.0`, `electron-builder@26.15.3`, NSIS x64, PowerShell/System.Drawing, Node.js built-in test runner, GitHub Actions, GitHub CLI.

## Global Constraints

- Package version is exactly `0.1.0-beta.1`; Git tag is exactly `v0.1.0-beta.1`.
- GitHub release is a Pre-release, never a stable `v0.1.0` release.
- Windows display name is `桌宠提示词魔法书`; executable name is `DeskPetPromptBook.exe`.
- Application identifier is permanently fixed as `com.qiuqiukong.deskpetpromptbook`.
- Installer name is exactly `Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`.
- Build only an unsigned assisted NSIS x64 per-user installer; do not add portable, per-machine, startup-launch, auto-update, or code-signing behavior.
- Create desktop and Start menu shortcuts; retain `%APPDATA%\desk-pet-prompt-book` on uninstall.
- Right-click opens a native menu containing `退出桌宠`; right-click never exits immediately.
- The ICO is the ninth separately licensed noncommercial visual file.
- Do not create or replace the GitHub Release until all tests, local build checks, and real Windows acceptance pass.
- Execute serially, remove obsolete paths, commit coherent deliverables, and push the completed development task.

---

### Task 1: Lock the Windows Packaging Contract

**Files:**
- Create: `tests/windows-packaging.test.mjs`
- Create: `electron-builder.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: the approved release identity and existing `src/**` runtime tree.
- Produces: `pnpm run build:win`, an explicit electron-builder file allowlist, and deterministic NSIS metadata used by later artifact validation.

- [x] **Step 1: Write failing package metadata tests**

Create `tests/windows-packaging.test.mjs` with assertions equivalent to:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const builderConfig = await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8');

test('package metadata identifies the Windows beta build', () => {
  assert.equal(packageJson.version, '0.1.0-beta.1');
  assert.equal(packageJson.devDependencies['electron-builder'], '26.15.3');
  assert.equal(packageJson.scripts['build:win'], 'electron-builder --win nsis --x64 --publish never');
});

test('electron-builder config defines the approved application identity', () => {
  assert.match(builderConfig, /^appId: com\.qiuqiukong\.deskpetpromptbook$/m);
  assert.match(builderConfig, /^productName: 桌宠提示词魔法书$/m);
  assert.match(builderConfig, /^executableName: DeskPetPromptBook$/m);
  assert.match(builderConfig, /^asar: true$/m);
  assert.match(builderConfig, /artifactName: Desk-Pet-Prompt-Book-Setup-\$\{version\}\.\$\{ext\}/);
});

test('NSIS remains assisted per-user and preserves user data', () => {
  assert.match(builderConfig, /oneClick: false/);
  assert.match(builderConfig, /perMachine: false/);
  assert.match(builderConfig, /allowElevation: false/);
  assert.match(builderConfig, /allowToChangeInstallationDirectory: true/);
  assert.match(builderConfig, /createDesktopShortcut: always/);
  assert.match(builderConfig, /createStartMenuShortcut: true/);
  assert.match(builderConfig, /runAfterFinish: true/);
  assert.match(builderConfig, /deleteAppDataOnUninstall: false/);
  assert.doesNotMatch(builderConfig, /portable|runOnStartup|autoUpdater/i);
});
```

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/windows-packaging.test.mjs
```

Expected: FAIL because `electron-builder.yml`, Beta version metadata, dependency, and build script do not exist.

- [x] **Step 3: Add the packaging configuration**

Set `package.json` version and scripts to:

```json
"version": "0.1.0-beta.1",
"scripts": {
  "build:win": "electron-builder --win nsis --x64 --publish never"
},
"devDependencies": {
  "electron": "39.8.10",
  "electron-builder": "26.15.3"
}
```

Create `electron-builder.yml` with this contract:

```yaml
appId: com.qiuqiukong.deskpetpromptbook
productName: 桌宠提示词魔法书
executableName: DeskPetPromptBook
asar: true
directories:
  buildResources: build
  output: dist
files:
  - src/**/*
  - package.json
  - LICENSE
  - ASSET-LICENSE.md
  - PRIVACY.md
win:
  icon: build/icon.ico
  target:
    - target: nsis
      arch:
        - x64
  artifactName: Desk-Pet-Prompt-Book-Setup-${version}.${ext}
nsis:
  oneClick: false
  perMachine: false
  allowElevation: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  createStartMenuShortcut: true
  shortcutName: 桌宠提示词魔法书
  runAfterFinish: true
  deleteAppDataOnUninstall: false
```

- [x] **Step 4: Update the frozen lockfile**

Run:

```powershell
corepack pnpm add --save-dev --save-exact electron-builder@26.15.3
```

Expected: `package.json` retains exact versions and `pnpm-lock.yaml` records electron-builder without changing Electron `39.8.10`.

pnpm `11.13.0` also discovers the transitive Squirrel-only `electron-winstaller` install script. Because this release targets NSIS only, record the supply-chain decision explicitly in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  electron: true
  electron-winstaller: false
```

- [x] **Step 5: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/windows-packaging.test.mjs
git diff --check
git add package.json pnpm-lock.yaml electron-builder.yml tests/windows-packaging.test.mjs
git commit -m "build: configure Windows beta installer"
```

Expected: packaging tests pass and the commit contains no generated `dist/` output.

---

### Task 2: Generate and License the Windows Icon

**Files:**
- Create: `scripts/generate-windows-icon.ps1`
- Create: `build/icon.ico`
- Modify: `tests/windows-packaging.test.mjs`
- Modify: `tests/open-source-readiness.test.mjs`
- Modify: `scripts/open-source-readiness.cjs`
- Modify: `ASSET-LICENSE.md`
- Modify: `docs/asset-provenance.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `.codex/agent-context.md`

**Interfaces:**
- Consumes: `src/renderer/assets/pet-book-body-v5-alpha.png`.
- Produces: `build/icon.ico` containing `16`, `32`, `48`, `64`, `128`, and `256` pixel PNG-compressed ICO entries.

- [x] **Step 1: Extend tests for ICO structure and nine-file licensing**

Add an ICO parser that reads the six-byte ICONDIR header and sixteen-byte entries, normalizing width/height byte `0` to `256`. Require:

```js
assert.equal(icon.readUInt16LE(0), 0);
assert.equal(icon.readUInt16LE(2), 1);
assert.equal(icon.readUInt16LE(4), 6);
assert.deepEqual(readIcoSizes(icon), [16, 32, 48, 64, 128, 256]);
```

Update readiness documentation assertions to require `build/icon.ico`, `nine visual files`, `Nine distributed visual files`, and `9 个分发视觉文件`.

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/windows-packaging.test.mjs tests/open-source-readiness.test.mjs
```

Expected: FAIL because the ICO and nine-file documentation do not exist.

- [x] **Step 3: Add a deterministic icon generator**

Create `scripts/generate-windows-icon.ps1` using `System.Drawing.Bitmap`, `Graphics.DrawImage`, high-quality bicubic interpolation, and one in-memory PNG per approved size. Write a standard ICO header, one directory entry per PNG, and then the PNG payloads in the same order. Resolve source and destination relative to `$PSScriptRoot`; do not embed a personal absolute path.

PowerShell 5 evaluates parameter defaults before `$PSScriptRoot` is available, so the script accepts optional paths and resolves portable defaults in the body:

```powershell
param(
  [string]$SourcePath,
  [string]$OutputPath
)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sizes = @(16, 32, 48, 64, 128, 256)
```

- [x] **Step 4: Generate and inspect the icon**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-windows-icon.ps1
```

Expected: `build/icon.ico` exists, all six entries decode, and the source artwork direction is unchanged.

- [x] **Step 5: Update the visual-license boundary**

Add `build/icon.ico` to the asset table as `Windows application and installer icon derived from the desktop-pet artwork`. Replace current eight-file scope language with nine-file language in current public docs and `.codex/agent-context.md`; historical completed specs/plans remain historical records and are not rewritten.

- [x] **Step 6: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/windows-packaging.test.mjs tests/open-source-readiness.test.mjs
git diff --check
git add scripts/generate-windows-icon.ps1 build/icon.ico tests/windows-packaging.test.mjs tests/open-source-readiness.test.mjs ASSET-LICENSE.md docs/asset-provenance.md README.md README.en.md CONTRIBUTING.md CHANGELOG.md .codex/agent-context.md
git commit -m "build: add licensed Windows application icon"
```

Expected: icon and licensing tests pass and exactly nine current distributed visual files are documented.

---

### Task 3: Harden Electron Data and Lifecycle Behavior

**Files:**
- Create: `src/electron/app-lifecycle.cjs`
- Create: `tests/electron-app-lifecycle.test.mjs`
- Modify: `src/electron/main.cjs`
- Modify: `package.json`
- Modify: `tests/electron-pet-shell.test.mjs`
- Modify: `.codex/product-requirements.md`
- Modify: `.codex/interaction-flows.md`
- Modify: `docs/architecture.md`
- Modify: `docs/data-and-privacy.md`

**Interfaces:**
- Produces: `configureStableUserDataPath(app)`, `setupSingleInstance(app, onSecondInstance)`, `focusPrimaryWindow(window)`, and `attachExitContextMenu(window, Menu, app)`.
- Consumes: Electron `app`, `BrowserWindow`, and `Menu` objects through explicit parameters so behavior can be unit tested without launching Electron.

- [x] **Step 1: Write failing lifecycle unit tests**

Use fakes to require these behaviors:

```js
assert.equal(configureStableUserDataPath(fakeApp), path.join('APPDATA', 'desk-pet-prompt-book'));
assert.deepEqual(fakeApp.setPathCalls, [['userData', path.join('APPDATA', 'desk-pet-prompt-book')]]);
assert.equal(setupSingleInstance(lockingApp, onSecondInstance), true);
assert.equal(setupSingleInstance(rejectedApp, onSecondInstance), false);
assert.equal(rejectedApp.quitCalls, 1);
focusPrimaryWindow(minimizedWindow);
assert.deepEqual(minimizedWindow.calls, ['restore', 'show', 'focus']);
contextMenuHandler({}, {});
assert.equal(menuTemplate[0].label, '退出桌宠');
menuTemplate[0].click();
assert.equal(fakeApp.quitCalls, 1);
```

Extend shell tests to require stable-path configuration before `appendStartupLog`, one instance lock before `app.whenReady`, second-instance focus, and context-menu attachment from `createPetWindow()`.

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/electron-app-lifecycle.test.mjs tests/electron-pet-shell.test.mjs
```

Expected: FAIL because lifecycle helpers and main-process wiring are absent.

- [x] **Step 3: Implement the lifecycle module**

Implement dependency-injected CommonJS functions with this public shape:

```js
const path = require('node:path');
const USER_DATA_DIRECTORY = 'desk-pet-prompt-book';

function configureStableUserDataPath(app) {
  const userDataPath = path.join(app.getPath('appData'), USER_DATA_DIRECTORY);
  app.setPath('userData', userDataPath);
  return userDataPath;
}

function setupSingleInstance(app, onSecondInstance) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on('second-instance', onSecondInstance);
  return true;
}
```

`focusPrimaryWindow` restores only when minimized, then shows and focuses. `attachExitContextMenu` registers `webContents.on('context-menu')`, builds one native item labeled `退出桌宠`, and calls `menu.popup({ window })`; its handler must not call `app.quit()` until the item callback runs.

- [x] **Step 4: Wire lifecycle behavior before application startup**

In `main.cjs`, call `configureStableUserDataPath(app)` before startup-log handlers and prompt-store access. Keep one `primaryWindow` reference, focus it on `second-instance`, attach the exit menu inside `createPetWindow()`, and execute `app.whenReady()`/`window-all-closed` setup only when `setupSingleInstance()` returns true.

- [x] **Step 5: Update product and privacy contracts**

Document `%APPDATA%\desk-pet-prompt-book`, one-process ownership of the prompt file, second-launch focus behavior, and the right-click menu path. Replace the old “multiple independent instances are unsupported” statement with the enforced single-instance behavior.

- [x] **Step 6: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/electron-app-lifecycle.test.mjs tests/electron-pet-shell.test.mjs
git diff --check
git add src/electron/app-lifecycle.cjs src/electron/main.cjs tests/electron-app-lifecycle.test.mjs tests/electron-pet-shell.test.mjs .codex/product-requirements.md .codex/interaction-flows.md docs/architecture.md docs/data-and-privacy.md
git commit -m "feat: harden packaged app lifecycle"
```

Expected: unit and shell contracts pass without launching a second real app instance.

---

### Task 4: Add the Release Identity and Artifact Contract

**Files:**
- Create: `scripts/release-contract.cjs`
- Create: `tests/release-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseReleaseTag(tag)`, `assertBetaReleaseIdentity(options)`, `expectedInstallerName(version)`, `assertExpectedInstaller(distDir, version)`, `writeChecksum(installerPath, checksumPath)`, `verifyChecksum(installerPath, checksumPath)`, and CLI commands `verify-tag`, `prepare-assets`, `verify-assets`.
- Consumes: `package.json`, `origin/main`, `dist/Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`, and `dist/SHA256SUMS.txt`.

- [x] **Step 1: Write failing release-contract tests**

Cover all required rejection paths:

```js
assert.throws(() => parseReleaseTag('0.1.0-beta.1'), /leading v/);
assert.throws(() => assertBetaReleaseIdentity({ tag: 'v0.1.0-beta.2', packageVersion: '0.1.0-beta.1', isOnMain: true }), /does not match/);
assert.throws(() => assertBetaReleaseIdentity({ tag: 'v0.1.0', packageVersion: '0.1.0', isOnMain: true }), /prerelease/);
assert.throws(() => assertBetaReleaseIdentity({ tag: 'v0.1.0-beta.1', packageVersion: '0.1.0-beta.1', isOnMain: false }), /origin\/main/);
assert.equal(expectedInstallerName('0.1.0-beta.1'), 'Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe');
```

In a temporary directory, require a missing installer, an additional setup `.exe`, and a tampered checksum to fail. Require a valid installer to produce `SHA256SUMS.txt` in standard `hash  filename` form and then verify successfully.

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/release-contract.test.mjs
```

Expected: FAIL because the release contract module is absent.

- [x] **Step 3: Implement the dependency-free release command**

Use `node:crypto`, `node:fs`, `node:path`, and `node:child_process`. `verify-tag` reads the package version and runs:

```text
git merge-base --is-ancestor HEAD origin/main
```

Exit `0` means contained, exit `1` means reject, and any other exit is a Git error. `assertExpectedInstaller` scans only top-level setup `.exe` files and requires the exact approved file to be the only candidate. `prepare-assets` writes then re-verifies `dist/SHA256SUMS.txt`; `verify-assets` performs no mutation.

- [x] **Step 4: Add exact package scripts and syntax coverage**

Add:

```json
"release:verify-tag": "node scripts/release-contract.cjs verify-tag",
"release:prepare-assets": "node scripts/release-contract.cjs prepare-assets",
"release:verify-assets": "node scripts/release-contract.cjs verify-assets"
```

Add `node --check scripts/release-contract.cjs` to `check:syntax`.

- [x] **Step 5: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/release-contract.test.mjs tests/windows-packaging.test.mjs
corepack pnpm run check:syntax
git diff --check
git add scripts/release-contract.cjs tests/release-contract.test.mjs package.json
git commit -m "build: validate beta release artifacts"
```

Expected: all malformed identity, source-branch, artifact-name, and checksum cases are rejected.

---

### Task 5: Add Tag-Gated GitHub Release Automation

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `docs/releases/v0.1.0-beta.1.md`
- Modify: `scripts/open-source-readiness.cjs`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: Task 1 build script, Task 4 release-contract commands, protected `origin/main`, and GitHub's built-in `GITHUB_TOKEN`.
- Produces: a recoverable workflow artifact and a GitHub Pre-release containing exactly the setup executable and `SHA256SUMS.txt`.

- [x] **Step 1: Write failing workflow/readiness tests**

Require `.github/workflows/release.yml` in `REQUIRED_PUBLIC_FILES`. Assert the workflow contains:

```js
assert.match(release, /tags:\s*\n\s+- ['"]v\*['"]/);
assert.match(release, /permissions:\s*\n\s+contents: write/);
assert.match(release, /fetch-depth: 0/);
assert.match(release, /node-version: 24/);
assert.match(release, /version: 11\.13\.0/);
assert.match(release, /pnpm run release:verify-tag/);
assert.match(release, /CSC_IDENTITY_AUTO_DISCOVERY:\s*['"]false['"]/);
assert.match(release, /pnpm run build:win/);
assert.match(release, /pnpm run release:prepare-assets/);
assert.match(release, /actions\/upload-artifact@v4/);
assert.match(release, /gh release create/);
assert.match(release, /--prerelease/);
```

Require the `gh release create` step to occur after verification and upload steps.

- [x] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because the workflow and release notes are absent.

- [x] **Step 3: Create the release workflow**

Use one `windows-latest` job with `timeout-minutes: 30`, `contents: write`, full checkout history, pinned pnpm/Node, frozen install, `git fetch origin main:refs/remotes/origin/main`, release identity verification, syntax/tests/readiness/audit, unsigned build, checksum preparation/verification, and `actions/upload-artifact@v4`.

The final step uses the runner GitHub CLI only after every previous step succeeds. It creates an authenticated Draft with both assets, verifies the two asset names, then publishes the Draft as a Pre-release. On any error it deletes the Draft without deleting the immutable Git tag:

```powershell
gh release create "${{ github.ref_name }}" `
  "dist/Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe" `
  "dist/SHA256SUMS.txt" `
  --verify-tag `
  --draft `
  --title "Desk Pet Prompt Book v0.1.0-beta.1" `
  --notes-file "docs/releases/v0.1.0-beta.1.md"
gh release edit "${{ github.ref_name }}" --draft=false --prerelease
```

- [x] **Step 4: Write complete bilingual-use release notes**

`docs/releases/v0.1.0-beta.1.md` states Beta status, direct installer steps, unsigned SmartScreen path `更多信息 -> 仍要运行`, shortcut behavior, no startup launch, stable data path, uninstall data retention, MIT-code/noncommercial-visual boundary, known limitations, and the issue URL.

- [x] **Step 5: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs tests/release-contract.test.mjs tests/windows-packaging.test.mjs
corepack pnpm run readiness
git diff --check
git add .github/workflows/release.yml docs/releases/v0.1.0-beta.1.md scripts/open-source-readiness.cjs tests/open-source-readiness.test.mjs
git commit -m "ci: publish tagged Windows beta release"
```

Expected: readiness requires the release workflow and Release creation remains the workflow's final operation.

---

### Task 6: Update Public Installation and Beta Documentation

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `CHANGELOG.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/architecture.md`
- Modify: `docs/data-and-privacy.md`
- Modify: `.codex/agent-context.md`
- Modify: `.codex/development-plan.md`
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: the verified installer contract and stable data/lifecycle behavior.
- Produces: accurate user-facing download, installation, warning, data-retention, license, and limitation guidance without claiming a stable or signed release.

- [ ] **Step 1: Write failing documentation assertions**

Require both READMEs to mention `v0.1.0-beta.1`, GitHub Releases, `Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`, unsigned/SmartScreen behavior, no startup launch, `%APPDATA%\desk-pet-prompt-book`, and nine visual files. Require the changelog to use `[0.1.0-beta.1]` with the release date instead of the old unreleased `0.1.0` heading.

- [ ] **Step 2: Verify RED**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL on stale source-only Alpha and no-installer statements.

- [ ] **Step 3: Update the public project status and install paths**

Describe the project as an early unsigned Windows Beta. Put the Release download path before source-development commands. Keep source commands for contributors. Explain that uninstall removes application files and shortcuts but intentionally retains the local prompt library.

- [ ] **Step 4: Update limitations and contributor guidance**

Keep no signing, no auto-update, Windows-first, local unencrypted storage, and noncommercial visual limitations explicit. Document how future release contributors regenerate the icon, run release-contract checks, and never move an existing tag.

- [ ] **Step 5: Record the completed release stage**

Add the installer/release acceptance criteria to `.codex/development-plan.md` and update `.codex/agent-context.md` with the fixed app ID, version, data path, exit path, packaging toolchain, and verification commands. Do not mark the Release published until Task 9 verifies GitHub assets.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
git diff --check
git add README.md README.en.md CHANGELOG.md CONTRIBUTING.md docs/architecture.md docs/data-and-privacy.md .codex/agent-context.md .codex/development-plan.md tests/open-source-readiness.test.mjs
git commit -m "docs: document Windows beta installation"
```

Expected: public docs consistently describe the unsigned Beta and do not promise signing, auto-update, portable behavior, or data deletion.

---

### Task 7: Build and Inspect the Real Windows Installer

**Files:**
- Generated and ignored: `dist/Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`
- Generated and ignored: `dist/SHA256SUMS.txt`
- Modify after evidence exists: `docs/superpowers/plans/2026-07-17-windows-beta-release.md`

**Interfaces:**
- Consumes: all implementation tasks and installed Windows tooling.
- Produces: a locally verified unsigned NSIS installer and checksum; no GitHub tag or Release yet.

- [ ] **Step 1: Run the complete local quality gate once**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1
```

Expected: frozen install, syntax, all tests, strict readiness, high-severity audit, and Git whitespace checks pass.

- [ ] **Step 2: Build without code-signing discovery**

Run:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
corepack pnpm run build:win
corepack pnpm run release:prepare-assets
corepack pnpm run release:verify-assets
```

Expected: exactly one top-level setup `.exe` plus `SHA256SUMS.txt`; no portable artifact or partial GitHub Release exists.

- [ ] **Step 3: Inspect executable metadata and checksum**

Use PowerShell `Get-Item ... | Select-Object -ExpandProperty VersionInfo` and `Get-FileHash -Algorithm SHA256`. Require product/file version `0.1.0-beta.1` or Windows' numeric equivalent, product name `桌宠提示词魔法书`, executable metadata for `DeskPetPromptBook`, no signer, and an exact manifest match.

- [ ] **Step 4: Commit the implementation branch and push**

Review `git status`, ensure `dist/` and machine-local evidence are ignored, update plan checkboxes through this point, commit the plan evidence, then run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall -Push
```

Expected: the branch is clean and `origin/release/windows-beta-installer` matches local HEAD.

---

### Task 8: Perform Interactive Windows Install Acceptance

**Files:**
- Modify after acceptance: `docs/superpowers/plans/2026-07-17-windows-beta-release.md`
- Modify after acceptance: `.codex/agent-context.md`

**Interfaces:**
- Consumes: the exact locally built installer from Task 7.
- Produces: evidence that the packaged behavior works in an interactive Windows user session and prompt data survives uninstall.

- [ ] **Step 1: Protect existing local prompt data**

Record whether `%APPDATA%\desk-pet-prompt-book` exists and its current file hashes. Create only a uniquely named non-prompt acceptance marker inside that directory; do not replace, reset, or delete `data/prompts.json` or its backups.

- [ ] **Step 2: Run the assisted installer as the current user**

Install to the default per-user location without elevation. Confirm the wizard offers an install-directory choice and launch-after-finish option.

- [ ] **Step 3: Verify installed application behavior**

Confirm desktop and Start menu shortcuts exist and launch the same `DeskPetPromptBook.exe`. Confirm no Startup-folder shortcut or `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry was added. Launch twice and verify the second launch focuses the existing pet/panel rather than creating another owning instance.

- [ ] **Step 4: Verify the native exit path and data continuity**

Right-click the pet and the expanded panel: each must show one native `退出桌宠` item, and the process exits only after selecting it. Relaunch and confirm existing prompts remain available from `%APPDATA%\desk-pet-prompt-book`.

- [ ] **Step 5: Verify uninstall retention**

Uninstall through Windows. Confirm application files and shortcuts are removed, while the acceptance marker and pre-existing prompt-data hashes remain. Remove only the marker created in Step 1. Reinstall the accepted build so the user retains a convenient installed application after testing.

- [ ] **Step 6: Record acceptance and re-run focused checks**

Record the date, artifact SHA-256, install path, shortcut/no-startup result, single-instance result, exit-menu result, and data-retention result in `.codex/agent-context.md`. Run release artifact verification again, commit the evidence, and push the branch.

---

### Task 9: Merge, Tag Protected Main, and Verify the Pre-release

**Files:**
- No source edits expected after the accepted commit.

**Interfaces:**
- Consumes: a clean pushed feature branch, passing required checks, accepted local installer, and authenticated GitHub CLI.
- Produces: protected-main tag `v0.1.0-beta.1` and a GitHub Pre-release with exactly two uploaded assets.

- [ ] **Step 1: Open the pull request**

Run:

```powershell
gh pr create --base main --head release/windows-beta-installer --title "release: publish Windows beta installer" --body "Adds the unsigned v0.1.0-beta.1 Windows installer, lifecycle hardening, release validation, licensing updates, and tag-gated Pre-release workflow."
```

Expected: PR targets protected `main` and contains only this release work.

- [ ] **Step 2: Wait for every required check**

Run:

```powershell
gh pr checks --watch --interval 10
```

Expected: Windows CI, Ubuntu CI, dependency audit, and CodeQL all pass. Fix failures on the feature branch; do not bypass or tag around them.

- [ ] **Step 3: Merge without rewriting the accepted commit history**

Run:

```powershell
gh pr merge --merge
git fetch origin main
git switch main
git pull --ff-only origin main
```

Expected: local `main` equals protected `origin/main` and includes the accepted implementation.

- [ ] **Step 4: Verify the release contract against main and create the immutable tag**

Run:

```powershell
corepack pnpm run release:verify-tag -- v0.1.0-beta.1
git tag -a v0.1.0-beta.1 -m "Desk Pet Prompt Book v0.1.0-beta.1"
git push origin v0.1.0-beta.1
```

Expected: the tag points to protected main and triggers `release.yml` exactly once.

- [ ] **Step 5: Watch the Release workflow**

Run:

```powershell
gh run list --workflow release.yml --limit 1
gh run watch --exit-status
```

Expected: identity, install, tests, readiness, audit, build, checksum, upload artifact, and final Pre-release creation all pass.

- [ ] **Step 6: Verify public assets independently**

Run `gh release view v0.1.0-beta.1 --json isPrerelease,tagName,assets,url`, download both assets into a new temporary directory, and run the checksum verifier against the downloaded files.

Acceptance requires:

```text
isPrerelease = true
tagName = v0.1.0-beta.1
assets = Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe, SHA256SUMS.txt
```

- [ ] **Step 7: Close the release task**

Update the plan and `.codex/agent-context.md` with the protected-main commit, tag, Release URL, asset SHA-256, and successful workflow run URL. Commit/push only if this evidence edit is explicitly intended to become a follow-up documentation commit for `beta.2`; do not move or rewrite the already published `beta.1` tag.

---

## Self-Review

- Spec coverage: package identity, assisted per-user NSIS behavior, stable data, single instance, right-click exit, icon, nine-file license scope, tag/main validation, checksum, workflow ordering, unsigned warning, local install/uninstall acceptance, protected-main tag, and exact Release assets all have explicit tasks.
- Placeholder scan: no `TBD`, deferred implementation, or unspecified error-handling step remains.
- Interface consistency: package scripts used by the workflow are defined in Tasks 1 and 4; `build/icon.ico` is produced before packaging; lifecycle helper names match their main-process consumers; artifact naming is shared by builder config, release contract, workflow, and acceptance commands.
