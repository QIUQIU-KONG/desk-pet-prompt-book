# Clean Public Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the complete development history in a private archive while publishing the verified current tree as a new one-commit public `QIUQIU-KONG/desk-pet-prompt-book` repository.

**Architecture:** Licensing and repository-readiness rules are enforced in the existing Node test suite before any GitHub mutation. The old Git history is retained unchanged in a renamed private repository and a verified bundle; a `git archive` export becomes an independent repository with one root commit. GitHub security features and branch protection are configured only after the public repository has passed CI.

**Tech Stack:** Git, GitHub REST API, Git Credential Manager, Node.js 24, pnpm 11.13.0, Node test runner, GitHub Actions, CodeQL.

## Global Constraints

- Public product name: `Desk Pet Prompt Book`; Chinese name: `桌宠提示词魔法书`.
- Existing repository becomes `QIUQIU-KONG/desk-pet-prompt-book-private-archive` and remains private.
- New public repository uses `QIUQIU-KONG/desk-pet-prompt-book` and starts with exactly one root commit.
- Do not rewrite, force-push, delete, or copy the old Git history into the public repository.
- Program code and ordinary documentation remain MIT licensed.
- The eight files listed in `ASSET-LICENSE.md` use the repository's separate noncommercial visual-asset license.
- The visual license permits personal, educational, research, evaluation, noncommercial contribution, modification, display, and forks with retained notices; commercial use, sale, and commercial relicensing are prohibited without written permission.
- The visual license grants only rights the owner actually holds and does not guarantee copyrightability or a complete third-party rights chain for AI-generated content.
- Never print or persist a GitHub access token; acquire it from Git Credential Manager only in process memory.
- Do not remove the private archive after publication.
- Execute serially in the current session; do not dispatch parallel agents.

---

### Task 1: Lock the mixed-license and automation contract with failing tests

**Files:**
- Modify: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: `REQUIRED_PUBLIC_FILES` and repository files read by the existing readiness tests.
- Produces: Regression assertions for the visual license, bilingual README wording, provenance status, CodeQL, and both Dependabot ecosystems.

- [ ] **Step 1: Replace pending-license assertions with the approved contract**

Add assertions requiring:

```js
assert.match(assetLicense, /Desk Pet Prompt Book Noncommercial Visual Asset License/);
assert.match(assetLicense, /personal, educational, research, evaluation/i);
assert.match(assetLicense, /commercial use/i);
assert.match(assetLicense, /written permission/i);
assert.match(assetLicense, /rights.*actually (?:owns|holds)/i);
assert.doesNotMatch(assetLicense, /license-pending/i);
assert.match(readme, /MIT 代码与非商业视觉资产/);
assert.match(englishReadme, /MIT-licensed code with noncommercial visual assets/i);
assert.doesNotMatch(`${readme}\n${englishReadme}\n${assetProvenance}`, /license-pending/i);
```

- [ ] **Step 2: Require CodeQL and GitHub Actions dependency updates**

Read `.github/workflows/codeql.yml` in the automation test and assert:

```js
assert.match(codeql, /github\/codeql-action\/init@v3/);
assert.match(codeql, /github\/codeql-action\/analyze@v3/);
assert.match(codeql, /permissions:[\s\S]*security-events: write/);
assert.match(dependabot, /package-ecosystem:\s*["']github-actions["']/);
assert.ok(REQUIRED_PUBLIC_FILES.includes('.github/workflows/codeql.yml'));
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: FAIL because `license-pending` remains and `.github/workflows/codeql.yml` does not exist.

### Task 2: Implement the approved noncommercial visual license and public documentation

**Files:**
- Modify: `ASSET-LICENSE.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/asset-provenance.md`
- Modify: `CONTRIBUTING.md`
- Modify: `CHANGELOG.md`
- Modify: `.codex/agent-context.md`
- Modify: `.gitattributes`

**Interfaces:**
- Consumes: The eight-file scope already listed in `ASSET-LICENSE.md`.
- Produces: One consistent mixed-license statement for contributors, users, and automated readiness checks.

- [ ] **Step 1: Replace `license-pending` with the formal asset license**

Keep the exact eight-file table and add the title `Desk Pet Prompt Book Noncommercial Visual Asset License, Version 1.0`. Define permitted noncommercial uses, attribution/notice retention, modification and redistribution requirements, prohibited commercial uses, written commercial permission, no warranty, termination on breach, and the AI-rights limitation from the global constraints.

- [ ] **Step 2: Align bilingual public documentation**

Use these summary phrases verbatim:

```text
MIT 代码与非商业视觉资产
MIT-licensed code with noncommercial visual assets
```

Remove every `license-pending` statement, preserve Alpha status, and point readers to `ASSET-LICENSE.md` and `docs/asset-provenance.md` for the exact scope.

- [ ] **Step 3: Align contributor and project records**

Change `CONTRIBUTING.md` from five to eight distributed visual files. Record the adopted license in `CHANGELOG.md` and `.codex/agent-context.md`. In `.gitattributes`, add:

```gitattributes
.codex/open-source-history-cleanup-report.md export-ignore
```

- [ ] **Step 4: Confirm no pending wording remains**

Run:

```powershell
rg -n "license-pending|five distributed visual|五个分发视觉" ASSET-LICENSE.md README.md README.en.md docs/asset-provenance.md CONTRIBUTING.md CHANGELOG.md .codex/agent-context.md
```

Expected: no matches.

### Task 3: Add CodeQL and strengthen repository readiness

**Files:**
- Create: `.github/workflows/codeql.yml`
- Modify: `.github/dependabot.yml`
- Modify: `scripts/open-source-readiness.cjs`
- Test: `tests/open-source-readiness.test.mjs`

**Interfaces:**
- Consumes: Existing GitHub Actions setup and `REQUIRED_PUBLIC_FILES`.
- Produces: Required CodeQL workflow named `CodeQL`, a `CodeQL / Analyze (javascript-typescript)` check, and weekly npm plus GitHub Actions update checks.

- [ ] **Step 1: Add CodeQL as a required public file**

Append `.github/workflows/codeql.yml` to `REQUIRED_PUBLIC_FILES` in `scripts/open-source-readiness.cjs`.

- [ ] **Step 2: Add a least-privilege CodeQL workflow**

Create a JavaScript/TypeScript workflow triggered by pushes to `main`, pull requests to `main`, and a weekly schedule. Use `actions/checkout@v4`, `github/codeql-action/init@v3`, and `github/codeql-action/analyze@v3`, with `contents: read`, `security-events: write`, and pull-request read permission.

- [ ] **Step 3: Add GitHub Actions Dependabot updates**

Add a second weekly update block:

```yaml
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Shanghai"
    open-pull-requests-limit: 5
    commit-message:
      prefix: "deps"
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```powershell
corepack pnpm exec node --test tests/open-source-readiness.test.mjs
```

Expected: all tests in this file pass.

- [ ] **Step 5: Commit the source-tree publication changes**

Run:

```powershell
git add ASSET-LICENSE.md README.md README.en.md docs/asset-provenance.md CONTRIBUTING.md CHANGELOG.md .codex/agent-context.md .gitattributes .github/dependabot.yml .github/workflows/codeql.yml scripts/open-source-readiness.cjs tests/open-source-readiness.test.mjs docs/superpowers/plans/2026-07-16-clean-public-repository.md
git commit -m "docs: prepare clean public repository"
```

### Task 4: Verify, push, and preserve the private archive

**Files:**
- Create outside repository: `$BackupDirectory/desk-pet-prompt-book-private-archive-2026-07-16.bundle`
- Update local-only record: `.codex/last-verified.local.json`

**Interfaces:**
- Consumes: The committed private repository final `HEAD`.
- Produces: A pushed, verified final private tree and an independently verified all-reference bundle.

- [ ] **Step 1: Run the complete local quality gate**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -Push
```

Expected: frozen install, syntax checks, 90 or more tests, strict readiness, high-severity dependency audit, Git checks, and push all succeed.

- [ ] **Step 2: Confirm private CI succeeds and classify CodeQL availability**

Poll the latest Actions runs for commit `HEAD` through the GitHub API. Require successful `CI` jobs on Windows and Ubuntu plus successful `Dependency audit`. Inspect the CodeQL job: success is accepted; a failure is accepted at this private stage only when its log explicitly reports that code scanning is not enabled for the private repository. Record that platform limitation and require CodeQL to succeed after the new repository becomes public. Any source, workflow, extraction, or other CodeQL failure blocks the rename.

- [ ] **Step 3: Create and verify the archival bundle**

Run:

```powershell
$ProjectRoot = Split-Path (Resolve-Path '.').Path -Parent
$BackupDirectory = Join-Path $ProjectRoot 'backups'
$BundlePath = Join-Path $BackupDirectory 'desk-pet-prompt-book-private-archive-2026-07-16.bundle'
New-Item -ItemType Directory -Force $BackupDirectory
git bundle create $BundlePath --all
git bundle verify $BundlePath
```

Expected: `git bundle verify` reports a complete history and lists the repository references.

- [ ] **Step 4: Rename the GitHub repository and preserve privacy**

Use an in-memory Git Credential Manager token with the GitHub REST API to `PATCH /repos/QIUQIU-KONG/desk-pet-prompt-book` to name `desk-pet-prompt-book-private-archive`. Query the renamed repository and require `private: true` before continuing.

- [ ] **Step 5: Update and verify the archive remote**

Run:

```powershell
git remote set-url origin https://github.com/QIUQIU-KONG/desk-pet-prompt-book-private-archive.git
git remote get-url origin
git ls-remote origin HEAD refs/heads/main
```

Expected: the URL uses the archive name and remote `main` resolves to the local final commit.

### Task 5: Create the clean public repository from the verified tree

**Files:**
- Create repository directory: `$ProjectRoot/desk-pet-prompt-book`

**Interfaces:**
- Consumes: The private archive's verified final commit through `git archive`.
- Produces: An independent local Git repository and public GitHub repository with exactly one root commit.

- [ ] **Step 1: Verify export and destination paths**

Resolve the source as the current repository and derive `$ProjectRoot` from its parent. Set `$PublicWorkspace = Join-Path $ProjectRoot 'desk-pet-prompt-book'`. Require the source leaf name to equal `desktop pet`; if the destination exists and is nonempty, stop without deleting it.

- [ ] **Step 2: Export the final tree without Git history**

Run `git archive --format=tar HEAD` and extract it into the empty destination. Confirm `.git` and `.codex/open-source-history-cleanup-report.md` are absent while all required public files are present.

- [ ] **Step 3: Initialize one clean root commit**

Inside the destination, run:

```powershell
git init -b main
git add --all
git commit -m "Initial public release"
git rev-list --count HEAD
git rev-list --max-parents=0 --count HEAD
```

Expected: both counts equal `1`.

- [ ] **Step 4: Create and push the new public GitHub repository**

Use the in-memory credential to `POST /user/repos` with name `desk-pet-prompt-book`, `private: false`, issues enabled, projects disabled, and wiki disabled. Set `origin` to the public URL and push `main`.

- [ ] **Step 5: Verify public identity and visibility**

Query `GET /repos/QIUQIU-KONG/desk-pet-prompt-book` and require `private: false`, `visibility: public`, `default_branch: main`, and the expected repository URL.

### Task 6: Enable public security controls and branch protection

**Files:**
- No source-tree changes.

**Interfaces:**
- Consumes: The successful public repository initial push and its reported check-run names.
- Produces: Security scanning, vulnerability reporting, and protected `main` settings.

- [ ] **Step 1: Enable repository security features**

Through supported GitHub REST endpoints, enable vulnerability alerts, automated security fixes, secret scanning, secret-scanning push protection, and private vulnerability reporting. Query repository security status afterward and treat unsupported or failed settings as blocking findings.

- [ ] **Step 2: Wait for public CI and CodeQL**

Poll Actions runs for the public root commit until `CI` and `CodeQL` complete. Require every run and check to conclude `success`; report the run URLs and exact check names without exposing credentials.

- [ ] **Step 3: Configure `main` branch protection**

Require the successful check contexts discovered in Step 2, including Windows verification, Ubuntu verification, dependency audit, and CodeQL. Require strict up-to-date branches and resolved review conversations; prohibit force-push and deletion.

- [ ] **Step 4: Verify protection and security settings**

Query branch protection and repository security endpoints. Confirm all intended checks and restrictions are represented in the returned state.

### Task 7: Anonymous public-clone acceptance

**Files:**
- Create temporary verification directory outside both repositories.

**Interfaces:**
- Consumes: Public HTTPS clone URL with all credential helpers disabled.
- Produces: Independent evidence that the repository is public, clean, installable, tested, and free of archived history.

- [ ] **Step 1: Clone without credentials**

Run with `credential.helper=` and `GIT_TERMINAL_PROMPT=0` into a new temporary directory:

```powershell
$ProjectRoot = Split-Path (Resolve-Path '.').Path -Parent
$VerificationWorkspace = Join-Path $ProjectRoot 'desk-pet-prompt-book-public-verification'
git -c credential.helper= clone https://github.com/QIUQIU-KONG/desk-pet-prompt-book.git $VerificationWorkspace
```

Expected: clone succeeds without authentication.

- [ ] **Step 2: Verify history isolation**

Require one commit, one root commit, no object IDs from the private archive's earlier commits, no `.codex/open-source-history-cleanup-report.md`, and no absolute personal paths in tracked text.

- [ ] **Step 3: Run the public quality gate**

Run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm run readiness
corepack pnpm audit --audit-level high --registry https://registry.npmjs.org
git diff --check
```

Expected: installation succeeds, all tests pass, readiness reports 0 errors and 0 warnings, audit reports no high-severity vulnerabilities, and the clone remains clean.

- [ ] **Step 4: Record the final state**

Update the private archive's local development context with the public root commit, archive final commit, bundle path, CI run URLs, enabled security settings, and anonymous verification summary. Commit and push only if this record contains no local absolute path intended to remain private; otherwise keep it in the ignored local verification record.

## Self-Review

- Spec coverage: licensing, archive preservation, clean export, GitHub publication, security settings, branch protection, and anonymous verification are each mapped to a task.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation steps remain.
- Interface consistency: the private final `HEAD` is the sole export source; the public root commit is the sole commit checked by CI and anonymous acceptance.
