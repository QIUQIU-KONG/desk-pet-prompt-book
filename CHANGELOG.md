# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0-beta.1] - 2026-07-17

First release with an unsigned Windows Beta installer. This is a public test release, not a signed stable production release.

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
- Assisted per-user NSIS x64 installer with desktop and Start menu shortcuts.
- Stable `%APPDATA%\desk-pet-prompt-book` data location retained during uninstall.
- Single-instance ownership, second-launch focus, and native right-click `退出桌宠` menu.
- Tag-gated GitHub Pre-release workflow with exact artifact naming and SHA-256 verification.

### Changed

- README desktop-pet preview now uses a pure-white documentation background while preserving the real Electron pet capture.

### Security

- Electron upgraded and pinned to `39.8.10` after dependency review.
- Electron renderer uses context isolation, sandboxing, and disabled Node integration.
- pnpm workspace overrides keep electron-builder on cache-compatible and vulnerability-patched transitive versions.

### Known Limitations

- The Windows Beta installer is unsigned and may trigger SmartScreen.
- No code signing, auto-update, portable build, or stable production release channel.
- Local prompt data is not encrypted at rest.
- AI-generated visual assets retain provider-chain and jurisdiction-dependent rights uncertainty; their permitted use is limited by `ASSET-LICENSE.md`.
