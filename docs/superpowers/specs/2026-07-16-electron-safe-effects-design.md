# Electron-Safe Desktop-Pet Effects Design

## Goal

Restore a visible magical glow and recognizable luminous butterflies in the real `220x220` Electron desktop-pet window without reintroducing the square compositing residue previously caused by blurred CSS layers on a transparent BrowserWindow.

## Root Cause

The browser preview renders `.floating-shadow`, `.page-glow`, and `.magic-smoke` with `filter: blur()` and `mix-blend-mode: screen`. Electron's transparent-window compositor previously exposed the rectangular offscreen surfaces behind those effects. The current Electron override therefore hides all three layers. The README screenshot was captured from the non-Electron browser preview, so it showed effects that the real desktop pet intentionally disabled.

## Layer Strategy

Add two Electron-only raster resources:

- `src/renderer/assets/pet-safe-glow-v1.png`: a transparent full-book overlay containing a restrained cyan-violet spine glow and a soft lower levitation glow.
- `src/renderer/assets/pet-safe-butterfly-v1.png`: one recognizable white-blue luminous butterfly sprite on a transparent canvas, reused by multiple DOM instances.

The glow overlay follows the same coordinate system and placement as `pet-book-body-v5-alpha.png`. Butterfly instances remain positioned independently so they can drift without requiring multiple bitmap files.

## Electron Rendering Rules

- Keep the original CSS shadow, page-glow, smoke, and CSS butterflies for the browser preview.
- In `body.electron-shell`, continue hiding `.floating-shadow`, `.page-glow`, `.magic-smoke`, and the old CSS `.butterflies` implementation.
- Show the new safe glow overlay and butterfly sprites only in Electron mode.
- Do not use `filter`, `backdrop-filter`, `box-shadow`, `drop-shadow`, or `mix-blend-mode` on Electron-safe effect elements.
- Animate only `opacity` and `transform`.
- The glow may breathe subtly but must not obscure the calligraphy, fountain pen, page border, or blue gemstone.
- Butterflies must remain visibly butterfly-shaped at `220x220`, not collapse into paired light blobs.
- Smoke remains disabled in Electron for this phase because it has the highest transparent-compositor risk.
- With `prefers-reduced-motion: reduce`, safe layers remain visible but stop drifting and pulsing.

## Asset Production

- Produce both images as RGBA PNGs with fully transparent pixels outside the effect.
- The glow overlay uses deterministic raster gradients aligned to the selected book asset.
- The butterfly sprite uses a purpose-built transparent bitmap and is visually checked at its final Electron display size.
- Record both assets in `ASSET-LICENSE.md` and `docs/asset-provenance.md` as `license-pending` visual files.
- Update the distributed visual-file count from six to eight.

## Runtime Integration

- Add semantic decorative image elements to `src/renderer/index.html` with empty alt text and `aria-hidden="true"`.
- Keep the assets non-interactive and non-draggable.
- Add Electron-specific positioning and animations in `src/renderer/styles.css`.
- Do not alter clipboard, window sizing, dragging, panel opening, storage, or prompt workflows.

## Verification

Automated contracts must verify:

- both assets exist and are loaded by the renderer;
- safe Electron elements do not use unsafe filter or blend properties;
- old unsafe layers remain hidden only in Electron mode;
- reduced-motion rules stop safe animations;
- runtime asset and license inventories include the two new files.

Visual verification must cover the real Electron shell at `220x220` against both light and dark backgrounds. Acceptance requires:

- no visible rectangular tint or opaque corner pixels;
- a readable center glow and lower floating light;
- at least two recognizable butterflies;
- the complete book and feedback label remain inside the window;
- dragging and cross-display size remain `220x220`.

After the real Electron result passes, replace the README desktop-pet screenshot with a capture whose effects match the shipped desktop behavior.
