# Open Source Readiness Design

## Status

- Approved direction: 2026-07-15
- Repository: `QIUQIU-KONG/desk-pet-prompt-book`
- Target: prepare the existing private repository for a later public release
- Visibility: remain private until a separate explicit approval

## Goal

Prepare the project for responsible open-source publication without changing product behavior, exposing private development artifacts, or claiming rights that have not been confirmed.

The first public-ready state should let a new contributor understand the product, install dependencies, run the app, run tests, understand local data handling, report security issues, and know exactly which files are covered by which license.

## Audit Baseline

The repository audit on 2026-07-15 found:

- The repository is private, uses `main`, has one collaborator, no forks, and 15 commits.
- No API keys, access tokens, passwords, or other credential patterns were found in the current tree or text history scan.
- No root `README.md`, `LICENSE`, contribution guide, security policy, privacy document, code of conduct, changelog, CI workflow, Dependabot configuration, or issue/PR templates exist.
- GitHub has no detected license, topics, homepage, discussions, or branch protection.
- The packed Git history is approximately 105 MiB; GitHub reports approximately 108 MiB.
- `.codex/visuals` contains approximately 100.86 MiB of generated drafts and review images.
- Runtime asset folders contain multiple obsolete book backgrounds; only the selected assets and page masks are referenced by production code.
- Tracked text contains machine-specific absolute paths, and the Git history contains 37 matches for personal absolute paths.
- Electron `37.10.3` currently reports 17 dependency vulnerabilities, including four high-severity advisories. The audit reports `39.8.1` as the minimum version that addresses all currently listed high-severity Electron advisories.
- The application already enables Electron sandboxing, context isolation, and disables renderer Node integration.
- The product stores prompt data locally as JSON under Electron `userData`; the data is not encrypted at rest.

## Licensing Decision

### Source Code

Program source code will use the MIT License.

This decision explicitly allows copying, modification, redistribution, commercial use, and closed-source derivative products, provided the copyright and license notice are retained. The user has confirmed that closed-source commercial derivatives are acceptable.

### Visual Assets

Visual assets are not included under the MIT License.

APIMart's Terms of Service, last updated 2026-06-11, state that users retain all rights to generated outputs. The same terms require compliance with the underlying model provider's terms. APIMart's GPT Image 2 page does not provide a model-specific statement confirming the full right to sublicense outputs under CC BY 4.0 or CC0.

Creative Commons also notes that purely AI-generated portions may not be copyrightable and that a CC license only applies to rights the licensor actually holds. Therefore, the first open-source preparation phase will mark visual assets as license-pending and will not claim that they are CC BY 4.0.

Before applying an open asset license, obtain written confirmation that outputs generated through `gpt-image-2` or `gpt-image-2-official` may be commercially used, modified, redistributed, and sublicensed under CC BY 4.0 or CC0, and verify that no third-party reference material limits those rights.

## Recommended Publication Sequence

### Phase 1: Public-Ready Private Repository

Keep the repository private while completing all repository, dependency, documentation, and current-tree cleanup work.

Deliverables:

- MIT `LICENSE` for program code.
- `ASSET-LICENSE.md` that identifies every distributed visual asset and marks its license as pending.
- Chinese `README.md` and English `README.en.md`.
- `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md`.
- `.editorconfig` and `.gitattributes` for stable text encoding and line endings.
- GitHub Actions CI, Dependabot, issue forms, and pull request template.
- Correct package metadata, reproducible Node/pnpm versions, and contributor commands.
- Electron dependency upgrade with a fresh security audit.
- Removal of obsolete runtime assets and machine-specific paths from the current tree.
- A separate history-cleanup report, without rewriting history.

Phase 1 must not change repository visibility and must not force-push.

### Phase 2: Asset License Resolution

Resolve the visual asset license using written provider confirmation and provenance review.

Possible outcomes:

- Apply CC BY 4.0 to rights held in the selected assets.
- Apply CC0 where appropriate and where the user has authority to waive the relevant rights.
- Keep selected assets proprietary and publish the repository as MIT code with separately restricted artwork.
- Replace the artwork with assets having a clearer licensing chain.

### Phase 3: Clean Public History

After Phase 1 passes acceptance and before publication, present a separate destructive-operation proposal.

Preferred options:

1. Rewrite the existing private repository history to remove obsolete binary drafts and personal paths, then force-push with explicit approval.
2. Create a new clean public repository from the approved tree while retaining the current repository as a private development archive.

Keeping the current history unchanged is not recommended because deleting files from the latest tree will not remove the approximately 105 MiB pack or personal paths from old commits.

### Phase 4: Public Visibility And Protection

Only after explicit approval:

- Change repository visibility to public.
- Add repository topics and homepage metadata.
- Enable branch protection or a GitHub ruleset requiring CI on `main`.
- Enable available secret scanning and dependency security features.
- Create the first source release and version tag.

## Repository Structure

The runtime should not depend on internal agent-context asset folders.

Target structure:

```text
src/
  core/
  electron/
  renderer/
    assets/
docs/
  images/
  architecture.md
  data-and-privacy.md
  asset-provenance.md
.codex/
  product and agent context documents
```

The current `prototype/desktop-pet-preview` runtime should move to `src/renderer` in one tested refactor. The selected pet body, selected panel background, and page masks should move with it. Obsolete panel candidates and binary generation drafts should be removed from the current tree after references are updated and tests pass.

Small text prompts that document the generation process may be preserved under `docs/asset-prompts` when they contain no private path or credential. Raw candidate images and acceptance scratch files should not remain in the public source tree.

## Documentation Design

### README

The Chinese README is the primary project page and links to the English version. Both versions include:

- Product purpose and current alpha/source-only status.
- A real screenshot using a selected acceptance image moved to `docs/images`.
- Supported operating system and prerequisites.
- Installation, start, preview, and test commands.
- Clipboard behavior and local data storage disclosure.
- Feature overview and current limitations.
- Repository structure and contribution entry points.
- Security and privacy links.
- Separate code and asset license summary.

The README must not claim that a signed installer or production release exists until one is built and verified.

### Privacy

`PRIVACY.md` documents:

- Clipboard text is read only after the explicit desktop-pet capture gesture.
- Prompt data is stored locally in Electron's `userData` directory.
- The app does not intentionally send prompt-library data to a remote service.
- Local JSON data is not encrypted at rest.
- Browser preview clipboard behavior depends on browser permissions.
- How users can delete local data.

### Security

`SECURITY.md` documents supported versions, private vulnerability reporting, expected response scope, and known local-data considerations. Public issues must not be used to disclose unpatched vulnerabilities.

## Package And Dependency Design

`package.json` should retain `private: true` to prevent accidental npm publication while adding:

- `license: "MIT"`
- repository, bugs, and homepage URLs
- project keywords
- `engines.node`
- an exact `packageManager` field
- conventional `start`, `preview`, `test`, and `audit` scripts

The repository-specific Electron mirror in `.npmrc` should not be imposed on all contributors. Mirror configuration may be documented as an optional local setup for users who need it.

Electron must be upgraded to a non-vulnerable supported version, followed by install, syntax, unit, desktop smoke, and dependency-audit verification. No security-completion claim is allowed while high-severity advisories remain.

## Automation Design

GitHub Actions will run on pull requests and pushes to `main`.

Required checks:

- Install the declared Node and pnpm versions.
- Use `pnpm install --frozen-lockfile`.
- Run JavaScript syntax checks.
- Run the complete test suite.
- Run a high-severity dependency audit or an equivalent dependency review gate.

Dependabot will check npm dependencies weekly. Issue forms will cover bug reports and feature requests. Pull requests will include testing, screenshots for visual changes, privacy impact, and asset provenance checkboxes.

## Safety Boundaries

- Do not change GitHub visibility during Phase 1.
- Do not rewrite or force-push Git history without a separate explicit confirmation.
- Do not label visual assets CC BY 4.0, CC0, or MIT until the relevant rights are confirmed.
- Do not delete the selected runtime assets before their replacements are referenced and verified.
- Do not include API keys, local credential files, generated prompt-library data, or machine-specific paths.
- Do not add an installer or release workflow that produces unsigned binaries without clearly identifying their status.
- Do not mix product feature changes into the open-source preparation phase.

## Verification And Acceptance

Phase 1 is accepted only when:

- All automated tests pass on a clean checkout.
- Runtime JavaScript syntax checks pass.
- `pnpm audit --audit-level high` reports zero high-severity vulnerabilities.
- Current tracked text contains no personal absolute paths or credential patterns.
- Runtime code no longer imports assets from `.codex`.
- Only referenced production visual assets remain in the runtime tree.
- README commands work from a clean installation.
- Documentation links and license references resolve.
- CI configuration validates successfully.
- The repository remains private.
- No history rewrite or force-push has occurred.

## Explicit Non-Goals

- Changing repository visibility.
- Rewriting Git history.
- Selecting a final open license for generated visual assets.
- Publishing signed installers or app-store packages.
- Adding cloud sync, telemetry, accounts, analytics, or product features.
- Redesigning the confirmed desktop-pet or book-panel appearance.
