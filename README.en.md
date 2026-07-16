# Desk Pet Prompt Book

> Status: **source-stage alpha**. The repository provides runnable source code, not a production release, signed installer, or stability guarantee.

**Desktop-pet mode: a floating prompt spellbook**

<p align="center">
  <img src="docs/images/desktop-pet-preview.png" alt="Floating magic-book desktop pet with a spine glow, stardust, and luminous butterflies" width="900" />
</p>

**Expanded mode: a book-page prompt workspace**

<p align="center">
  <img src="docs/images/app-preview.png" alt="Expanded magic-book prompt-management workspace" width="900" />
</p>

Desk Pet Prompt Book is a Windows-oriented prompt workflow manager. The desktop pet captures clipboard text with lightweight feedback; the expanded magic-book panel handles search, reuse, project organization, and workflow review.

[中文](README.md) | [Privacy](PRIVACY.md) | [Architecture](docs/architecture.md) | [Contributing](CONTRIBUTING.md)

## Product Philosophy

The calligraphy on the desktop pet is intentional product storytelling rather than random decoration:

> **Build agents with clarity. Let prompts become systems.**

This statement describes the product's direction from collecting prompts to building a working system: define an Agent with clear intent, context, and steps, then turn scattered prompts into a dependable, repeatable workflow through reuse, projects, and stages. The fountain pen on the right page symbolizes writing down an idea and continuing until it becomes executable work.

## Core Flow

1. Copy a prompt.
2. Double-click the desktop pet to read the current clipboard text.
3. The app derives a title from the first non-empty line and saves the text in one prompt library.
4. Single-click the pet to open the panel, then find content through global search, the pending filter, or a project.
5. Copy, rate, pin, edit, organize, or delete the prompt.

Identical prompt bodies are not saved twice. Unassigned prompts are a pending state inside the same library, not a separate inbox.

## Implemented Features

- Single-click panel opening, double-click clipboard capture, and lightweight status feedback.
- Global search across title, body, note, and keyword, with optional current-view scope.
- One prompt library with a pending filter.
- Project creation, rename, pin, and deletion; browsing and the explicit current-project marker remain independent.
- Per-project stages with create, rename, hide, and reorder operations.
- Prompt project/stage assignment, reusable keywords, 0-5 rating, pinning, editing, and permanent deletion.
- Copy-use counters and last-used timestamps.
- Smart, rating, recently used, and recently updated sorting.
- Local JSON persistence and last-view restoration.

## Requirements

- Windows 10 or Windows 11.
- Node.js 24 or later.
- Corepack, distributed with Node.js.
- Git.

The project pins `pnpm@11.13.0`. Commands use Corepack to avoid relying on an unrelated global pnpm version.

## Run From Source

```powershell
git clone https://github.com/QIUQIU-KONG/desk-pet-prompt-book.git
cd desk-pet-prompt-book
corepack pnpm install
corepack pnpm start
```

Common commands:

| Command | Purpose |
| --- | --- |
| `corepack pnpm start` | Start the Electron desktop pet |
| `corepack pnpm preview` | Start the local browser preview server |
| `corepack pnpm test` | Run the complete automated test suite |
| `corepack pnpm run check:syntax` | Check runtime JavaScript syntax |
| `corepack pnpm run audit:high` | Check for high-severity dependency vulnerabilities |
| `corepack pnpm run readiness:report` | Print the repository readiness report |
| `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1` | Run the unified local verification gate |

The browser preview is intended for layout and interaction development. Clipboard access depends on browser permission and secure-context rules and does not fully represent Electron behavior.

## Data And Privacy

Prompts, projects, stages, keywords, and view state are stored at `data/prompts.json` under Electron's `userData` directory. A typical Windows location is `%APPDATA%\desk-pet-prompt-book\data\prompts.json`.

- Clipboard text is read only after the user performs the capture gesture.
- The prompt library has no intentional remote upload, telemetry, or cloud-sync path.
- The JSON file is **not encrypted at rest**; anyone with access to the local account's files may be able to read it.
- Deleting a prompt permanently removes that record from the local prompt library.

Read [PRIVACY.md](PRIVACY.md) and [docs/data-and-privacy.md](docs/data-and-privacy.md) before storing sensitive prompts.

## Repository Layout

```text
src/
  core/       Local data model and JSON store
  electron/   Main process, window management, clipboard, and IPC
  renderer/   Magic-book UI and runtime visual assets
scripts/      Preview, audit, and asset-generation scripts
tests/        Node.js automated tests
docs/         Architecture, privacy, provenance, and screenshots
.codex/       Product decisions, development context, and plans
```

Runtime code does not depend on internal `.codex` development material.

## Current Limitations

- This is Windows-first source-stage software without an installer, automatic updates, or code signing.
- Local data is unencrypted, with no accounts, cloud sync, team collaboration, or telemetry.
- Desktop clipboard automation can depend on Windows session permissions and still requires real-session verification.
- Eight distributed visual files use a separate noncommercial license and are not MIT or Creative Commons assets; commercial use requires written permission from the project owner.

## Roadmap

- Continue automated and real-desktop acceptance for pet and panel workflows.
- Continue documenting image-provider and underlying-model terms, replacing assets when a clearer rights chain is needed.
- Publish the verified current tree with a clean root history while retaining the complete earlier development history in a private archive.
- Add signing, installation, upgrade, and release workflows before claiming a production release.

## License

This repository combines **MIT-licensed code with noncommercial visual assets**. Program code and ordinary project documentation are available under the [MIT License](LICENSE), including commercial use and closed-source derivatives when the copyright and license notice are retained.

Eight distributed visual files are excluded from MIT. They may be used for personal learning, education, research, evaluation, and noncommercial contributions or forks, but commercial use, sale, and commercial relicensing require separate written permission. See [ASSET-LICENSE.md](ASSET-LICENSE.md) and [docs/asset-provenance.md](docs/asset-provenance.md).
