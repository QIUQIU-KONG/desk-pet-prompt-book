# Desktop Pet Asset Specification

## Selected Runtime Asset

The desktop pet uses:

```text
src/renderer/assets/pet-book-body-v5-alpha.png
```

The source-generation prompt record is:

```text
docs/asset-prompts/pet-book-body-v5.txt
```

The prompt record documents the creative process only. It is not proof of copyright ownership or an asset license.

## Visual Identity

- An elegant open ancient magic book floating in the air.
- Warm, layered parchment with soft natural page curls.
- A small suspended pen above the right page.
- Sparse decorative English script related to building AI agents.
- Blue-white light at the page center, blue-violet smoke, restrained gold stardust, and a few white glowing butterflies.
- Semi-realistic fantasy illustration rather than flat icon, hard SVG, or cartoon styling.

## Runtime Requirements

- The subject remains recognizable at the `220x220` pet-window size.
- The PNG keeps transparent corners and a complete book silhouette.
- Smoke, particles, and butterflies must not obscure the book body.
- No opaque rectangular background may appear in the transparent Electron window.
- The selected image is the stable alignment source for all CSS effects.

## Interaction States

- Idle: subtle vertical float, low-intensity page glow, slow smoke, restrained particles, and low-frequency butterfly movement.
- Capture success: page glow strengthens briefly and particles gather toward the center.
- Duplicate capture: a smaller single glow pulse.
- Open panel: the page-center glow expands into the internal book panel.

## Avoid

- Closed book covers.
- Square jewels or rigid rectangular pages.
- Hard geometric SVG reconstruction.
- Dense room scenes, people, hands, desks, or candles.
- Effects that dominate the book silhouette.

## License Status

The image is not covered by the source-code MIT License. Its distribution license remains pending provider-rights confirmation; see `ASSET-LICENSE.md` and `docs/asset-provenance.md` when those public documents are added.
