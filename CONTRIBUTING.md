# Contributing

Thank you for helping improve Desk Pet Prompt Book. The project is an early Windows Beta, and contributions should support the intended maintainable product rather than introduce throwaway MVP paths.

By participating, you agree to follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Before Starting

For a non-trivial change, open an issue or discussion first so scope, product behavior, privacy impact, and acceptance criteria are clear. Keep feature changes separate from repository-maintenance work.

Review these documents when relevant:

- [`README.en.md`](README.en.md) for setup and current scope;
- [`docs/architecture.md`](docs/architecture.md) for process boundaries;
- [`docs/data-and-privacy.md`](docs/data-and-privacy.md) for stored data and clipboard flow;
- [`ASSET-LICENSE.md`](ASSET-LICENSE.md) for visual asset restrictions.

## Development Setup

Requirements are Windows 10/11, Node.js 24 or later, Corepack, and Git. The package manager is pinned to `pnpm@11.13.0`.

```powershell
corepack pnpm install
corepack pnpm start
```

The repository intentionally does not commit an Electron download mirror. If the standard binary source is unavailable in your environment, set `ELECTRON_MIRROR` to an organization-approved mirror for your current shell or user account. Do not restore a repository-wide `.npmrc`, and do not commit mirror credentials.

## Engineering Rules

- Follow the existing Electron main/preload/renderer/core boundaries.
- Keep renderer Node integration disabled and expose new privileged behavior through a narrow preload API.
- Write a failing test before implementing behavior or fixing a bug.
- Remove replaced code and assets once references and tests have moved.
- Avoid unrelated refactors and generated metadata churn.
- Keep source text UTF-8 with LF endings; visual binary files must remain binary in Git.
- Use focused commits whose message states the actual change.

## Verification

During RED/GREEN development, run the smallest relevant test file. Run the full test suite after a complete behavior is working, then run the complete local gate once before opening a pull request. Do not repeatedly install unchanged dependencies or wait for remote CI after each small edit.

Run the complete local gate before opening a pull request:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm run readiness:report
corepack pnpm run audit:high
```

Windows contributors can run the same checks through one maintained helper:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1
```

After a focused commit, maintainers may add `-SkipInstall -Push`. The script refuses to push a dirty working tree, uses Git Credential Manager non-interactively to avoid hidden authentication prompts, and writes command timings to the ignored local record `.codex/last-verified.local.json`. Set `DESK_PET_GIT` or `DESK_PET_COREPACK` only when the standard command resolution is unsuitable; do not commit machine-specific paths.

For renderer or Electron window changes, also verify:

- browser layout at `1280x720`;
- Electron pet mode at `220x220`;
- Electron panel mode at `1024x700`;
- transparent corners, fixed drag size, and open/close restoration; and
- the complete affected user workflow, not only static screenshots.

Attach before/after screenshots for visual changes. Remove real prompts, personal paths, account names, and other sensitive information first.

## Privacy Review

Describe the privacy impact of any change involving clipboard access, stored prompt fields, logs, imports/exports, network calls, telemetry, encryption, or deletion. Update `PRIVACY.md` and `docs/data-and-privacy.md` whenever observable data behavior changes.

The current contract is explicit-gesture clipboard access, local-only prompt storage, no intentional prompt-library upload, and no encryption at rest.

## Asset Provenance

Every visual contribution requires an **asset provenance** record. Include the creator or provider, model/tool when generated, reference sources, governing terms, modification history, attribution, and permission for the intended repository distribution.

Do not add an image merely because it can be downloaded or generated. Do not label artwork MIT, CC BY, CC0, or public domain without evidence that the contributor can grant those rights. Changes to the nine distributed visual files must update `ASSET-LICENSE.md` and `docs/asset-provenance.md`.

## Release Engineering

Regenerate the Windows icon from the approved desktop-pet artwork with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-windows-icon.ps1
```

Release changes must keep `package.json`, the `v`-prefixed tag, `electron-builder.yml`, the expected setup file, and `SHA256SUMS.txt` consistent. Build locally with `corepack pnpm run build:win`, then run `corepack pnpm run release:prepare-assets` and `corepack pnpm run release:verify-assets`.

Create a release tag only from a commit contained in protected `main`. Do not move an existing release tag or replace assets attached to an existing version; publish a new prerelease version for corrections. Never commit signing certificates, passwords, tokens, or generated `dist/` output.

## Pull Request Checklist

- Explain the user or maintenance problem and the chosen behavior.
- Link the issue or approved design when one exists.
- Include RED and GREEN test evidence for behavior changes.
- Include the full verification output summary.
- Describe privacy and security impact.
- Include screenshots for visual changes.
- Confirm asset provenance for any media change.
- Keep the pull request focused and free of local files or credentials.

## Licensing Contributions

Code and ordinary documentation contributions are submitted under the repository's MIT License. Visual assets remain governed by their separately recorded terms and are not accepted under MIT by default.
