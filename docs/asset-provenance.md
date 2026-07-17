# Visual Asset Provenance

## Status

The nine distributed visual files are governed by the [Desk Pet Prompt Book Noncommercial Visual Asset License, Version 1.0](../ASSET-LICENSE.md). This document records provenance and known rights limitations; the license file defines the permission granted.

The primary book artwork was created through an Image2/APIMart workflow during product design. The Electron-safe butterfly was created with built-in image generation and local chroma-key extraction, while the glow overlay was generated deterministically with local raster tooling. The retained records do not independently establish the complete underlying model-provider rights chain or confirm that generated outputs may be sublicensed under CC BY 4.0, CC0, or another open asset license.

## Distributed Files

| File | Origin | Relationship |
| --- | --- | --- |
| `src/renderer/assets/pet-book-body-v5-alpha.png` | Selected generated image, then prepared with transparency | Primary desktop-pet artwork |
| `src/renderer/assets/pet-safe-glow-v1.png` | Deterministic local RGBA raster generated with Pillow and NumPy | Electron-safe spine and levitation glow overlay |
| `src/renderer/assets/pet-safe-butterfly-v1.png` | Built-in image generation on a magenta key, then locally extracted and resized | Electron-safe luminous butterfly sprite |
| `src/renderer/assets/panel-book-ui-v3b-alpha.png` | Selected generated image, then prepared with transparency | Primary panel artwork |
| `src/renderer/assets/page-mask-left.png` | Generated locally from the selected panel geometry | Derivative interaction mask |
| `src/renderer/assets/page-mask-right.png` | Generated locally from the selected panel geometry | Derivative interaction mask |
| `docs/images/desktop-pet-preview.png` | Isolated real Electron `220x220` capture at 2x device scale, centered on a pure-white `1280x900` documentation canvas | Contains the selected pet artwork and Electron-safe runtime effects without user data |
| `docs/images/app-preview.png` | Real Electron panel screenshot captured with isolated temporary `userData` and anonymous Agent-development demo records | Contains the selected panel artwork and current UI without user prompt data |
| `build/icon.ico` | Deterministic local multi-size ICO generated from `pet-book-body-v5-alpha.png` with `scripts/generate-windows-icon.ps1` | Derivative Windows application and installer icon |

The mask-generation process is implemented in `scripts/generate-page-masks.ps1`. Deriving a mask locally does not remove restrictions that may apply to the source panel image.

## Prompt Records

- `docs/asset-prompts/pet-book-body-v5.txt`
- `docs/asset-prompts/pet-safe-effects-v1.txt`
- `docs/asset-prompts/panel-book-ui-v3b.txt`

These text files document the selected visual directions. Obsolete image candidates and raw generation drafts are intentionally excluded from the current tree.

## Rights Review

APIMart's general terms were reviewed during planning on 2026-07-15. Those records indicated that users retain rights in outputs while also remaining responsible for the underlying model provider's terms. The retained evidence did not provide a model-specific confirmation of unrestricted redistribution and sublicensing under a Creative Commons license.

The project owner adopted the repository-specific Noncommercial Visual Asset License on 2026-07-16. It permits specified noncommercial use and redistribution while prohibiting commercial use without separate written authorization. It grants only rights the project owner actually holds and does not represent the files as MIT, Creative Commons, public-domain, or OSI-open-source assets.

## Resolution Paths

A later, separately reviewed decision may:

1. apply an open asset license only after the supporting rights evidence is documented;
2. issue separate written permission for a defined commercial use; or
3. replace the artwork with assets that have a clearer licensing chain.

Any change must record the evidence, affected files, attribution requirements, and effective date in this document and the changelog.
