# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow [Semantic Versioning](https://semver.org/) once releases begin.

## [0.1.0] - Unreleased

Source-stage alpha. This entry describes the current source tree and is not a packaged production release.

### Added

- Transparent, frameless, always-on-top Electron desktop-pet window.
- Double-click clipboard capture with empty and exact-duplicate handling.
- Single prompt library with pending-state filtering and global search.
- Project, per-project stage, reusable keyword, rating, pin, edit, copy, and delete workflows.
- Explicit current-project marker independent from the browsed project.
- Local JSON persistence for prompt data and view state.
- Open-book panel with independent page masks and compact pet/panel window modes.
- Electron-safe RGBA spine glow, levitation light, and luminous butterfly layers for the transparent pet window.
- Bilingual product-philosophy copy and an anonymized `1024x700` Electron panel screenshot for the README files.
- Automated tests for renderer contracts, Electron IPC/window behavior, and prompt-store behavior.
- Repository readiness audit, public documentation, and separated code/artwork licensing boundaries.
- Desk Pet Prompt Book Noncommercial Visual Asset License for the nine distributed visual files, including the derived Windows icon.

### Changed

- README desktop-pet preview now uses a pure-white documentation background while preserving the real Electron pet capture.

### Security

- Electron upgraded and pinned to `39.8.10` after dependency review.
- Electron renderer uses context isolation, sandboxing, and disabled Node integration.

### Known Limitations

- No installer, code signing, auto-update, or production release channel.
- Local prompt data is not encrypted at rest.
- AI-generated visual assets retain provider-chain and jurisdiction-dependent rights uncertainty; their permitted use is limited by `ASSET-LICENSE.md`.
