# Windows Beta Installer and GitHub Release Design

## Status

Approved for implementation on 2026-07-17.

## Goal

Publish `Desk Pet Prompt Book` as an installable Windows Beta from the public `QIUQIU-KONG/desk-pet-prompt-book` repository. A non-technical user must be able to download one `.exe`, install the application without administrator privileges, launch it from normal Windows shortcuts, and uninstall it without losing prompt data.

## Release Identity

- Package version: `0.1.0-beta.1`.
- Git tag: `v0.1.0-beta.1`.
- GitHub release type: Pre-release.
- Windows display name: `桌宠提示词魔法书`.
- Application identifier: `com.qiuqiukong.deskpetpromptbook`.
- Installed executable name: `DeskPetPromptBook.exe`.
- Installer file name: `Desk-Pet-Prompt-Book-Setup-0.1.0-beta.1.exe`.
- Release checksum file: `SHA256SUMS.txt`.
- The build is unsigned. Release notes must explain the possible Windows SmartScreen warning and the `更多信息 -> 仍要运行` path.

The application identifier is a stable technical identity used by Windows and the installer for upgrades, shortcuts, notifications, and uninstall records. It is public metadata and must not change after the first release without an explicit migration design.

## Packaging Architecture

Use `electron-builder@26.15.3` with an NSIS target. Keep packaging configuration in `electron-builder.yml` and invoke it through explicit package scripts.

The configuration must define:

- `appId: com.qiuqiukong.deskpetpromptbook`;
- `productName: 桌宠提示词魔法书`;
- `executableName: DeskPetPromptBook`;
- `asar: true`;
- `directories.buildResources: build`;
- `directories.output: dist`;
- a Windows NSIS target for `x64`;
- `artifactName: Desk-Pet-Prompt-Book-Setup-${version}.${ext}`;
- `build/icon.ico` as the Windows icon;
- an explicit file allowlist containing runtime source, package metadata, and required license documents.

The installer must be an assisted per-user installer:

- `oneClick: false`;
- `perMachine: false`;
- `allowToChangeInstallationDirectory: true`;
- create desktop and Start menu shortcuts;
- do not create a startup item;
- allow launching the application when installation completes;
- retain application data on uninstall.

No portable target is produced. The application stores data in AppData, so labeling the same behavior as portable would be misleading.

## Stable Data Location

Packaging changes Electron's visible product name, which can otherwise change the default `userData` directory. The main process must explicitly set the data root to:

```text
%APPDATA%\desk-pet-prompt-book
```

This path must be configured before startup logging or prompt-store initialization. Existing source-run data and installed-application data therefore use the same contract. Reinstalling or uninstalling the application must not silently remove the prompt library.

## Release Hardening

### Single Instance

The application must acquire Electron's single-instance lock before creating windows. A second launch must exit its new process and bring the existing desktop pet or panel to the foreground. This prevents multiple processes from writing the same prompt database.

### Right-Click Exit

The frameless, taskbar-hidden application needs a visible exit path. Right-clicking either the desktop-pet state or the expanded panel must open a native context menu with one command:

```text
退出桌宠
```

Selecting it calls the normal Electron quit flow. Right-click must not immediately terminate the application because that would be too easy to trigger accidentally.

### Application Icon

Create `build/icon.ico` from the approved magic-book desktop-pet artwork. The ICO must contain multiple Windows icon sizes, including `16`, `32`, `48`, `64`, `128`, and `256` pixels. The artwork direction must not be redesigned.

The ICO is a derivative visual asset. Update `ASSET-LICENSE.md`, `docs/asset-provenance.md`, the bilingual README files, contribution guidance, readiness tests, and all eight-file wording to a nine-file scope. Release binaries embed the noncommercial visual assets and remain subject to the separate visual-asset license.

## GitHub Release Workflow

Add `.github/workflows/release.yml`, triggered only by tags matching `v*`.

The Windows release job must:

1. check out full history so it can verify the tagged commit belongs to `main`;
2. set up `pnpm@11.13.0` and Node.js 24;
3. run `pnpm install --frozen-lockfile`;
4. verify that the tag, `package.json` version, and expected artifact version agree;
5. run syntax checks, all tests, strict readiness, and the high-severity dependency audit;
6. build the NSIS installer with code-signing discovery disabled;
7. assert that exactly one expected setup executable exists;
8. generate `SHA256SUMS.txt` from the setup executable;
9. upload the installer and checksum as a workflow artifact for recovery;
10. create the GitHub Pre-release only after all previous steps succeed.

Use the runner's authenticated GitHub CLI with the workflow `GITHUB_TOKEN` to create the release. The workflow receives only `contents: write`; no certificate, password, PAT, or publishing secret is required for the unsigned Beta.

The release notes must include:

- Beta status and version;
- Windows installation steps;
- the unsigned SmartScreen warning;
- desktop and Start menu shortcut behavior;
- confirmation that startup launch is not enabled;
- the `%APPDATA%\desk-pet-prompt-book` data path;
- uninstall data-retention behavior;
- the MIT-code and noncommercial-visual-asset boundary;
- a link to known limitations and issue reporting.

## Version and Release Validation

Add a small release-contract script with unit tests. It must reject:

- a tag without the leading `v`;
- a tag version different from `package.json`;
- a non-prerelease version for this Beta workflow;
- a tagged commit that is not contained in `origin/main`;
- a missing or incorrectly named installer;
- a checksum file that does not match the installer.

The workflow creates the GitHub Release only as its final operation. A failed build must never leave a partial Release with missing assets.

## Testing Strategy

### Automated Tests

- Extend Electron shell tests for the fixed `userData` path, single-instance lock, second-instance focus behavior, and native `退出桌宠` context menu.
- Add packaging-contract tests for application identity, Chinese display name, NSIS behavior, shortcuts, no startup item, data retention, artifact naming, file allowlist, and icon path.
- Parse the ICO header in tests and require the approved multi-size entries.
- Test the tag/package version contract and expected asset names.
- Require `release.yml` and the icon in strict open-source readiness.
- Keep the existing 90 tests passing.

### Build Verification

- Run a real local Windows NSIS build.
- Confirm the produced file name and SHA-256 checksum.
- Inspect the installer metadata for product name, version, publisher state, and icon.
- Install as the current user without elevation.
- Confirm desktop and Start menu shortcuts launch the packaged application.
- Confirm no startup entry is created.
- Launch twice and verify only one application instance remains.
- Open the panel, right-click, select `退出桌宠`, and verify the process exits.
- Relaunch and verify prompt data persists.
- Uninstall and verify the application is removed while the AppData prompt library remains.

GitHub Actions additionally rebuilds the same installer on `windows-latest`. GUI behavior is accepted on a real interactive Windows session rather than inferred from a headless runner.

## Failure and Rollback Rules

- Test, audit, build, naming, checksum, or upload failure blocks Release creation.
- Do not replace assets attached to an existing release tag.
- If `beta.1` is defective, keep it traceable and publish `v0.1.0-beta.2` after the correction.
- Do not silently retag a different commit.
- Do not publish an installer built from a commit outside protected `main`.
- If local installation acceptance fails, do not create the release tag.
- The absence of code signing is an explicit Beta limitation, not a hidden warning.

## Non-Goals

This release does not add:

- code signing;
- automatic updates;
- a portable build;
- startup launch;
- per-machine installation;
- automatic deletion of user data during uninstall; or
- a stable `v0.1.0` designation.

Those capabilities require separately reviewed product and migration decisions.

## Acceptance Criteria

- The public repository contains the packaging configuration, release workflow, release-contract tests, icon, and updated licensing documentation.
- All local tests, readiness checks, and dependency audits pass.
- A real unsigned NSIS installer is built and accepted on Windows.
- `v0.1.0-beta.1` points to a protected-main commit.
- The GitHub Pre-release exposes exactly the expected setup executable and checksum file.
- A user can install, launch, right-click to exit, relaunch with data intact, and uninstall without losing prompt data.
