# UI Visual Direction

## Confirmed Direction

The product uses a mature semi-realistic fantasy style built around a floating open ancient magic book.

The active renderer and assets are:

```text
src/renderer/index.html
src/renderer/styles.css
src/renderer/assets/pet-book-body-v5-alpha.png
src/renderer/assets/panel-book-ui-v3b-alpha.png
src/renderer/assets/page-mask-left.png
src/renderer/assets/page-mask-right.png
```

Selected text prompt records are kept under `docs/asset-prompts/`. Raw candidates and review images are not runtime dependencies.

## Desktop Pet

- Open, floating, refined ancient book.
- Thick warm parchment with natural soft page edges.
- Small pen positioned as if writing on the right page.
- Restrained blue-white glow, blue-violet smoke, gold dust, and white glowing butterflies.
- Compact enough to remain unobtrusive on the desktop.
- Idle animation stays slow and quiet.

## Internal Panel

- A separate heavy open-book interface, not an enlarged copy of the pet.
- Clear complete book boundary with transparent safe margins.
- Independent left project page and right manuscript page.
- Flat readable text, masked interaction washes, and an empty center spine.
- Mature, weighty, and refined rather than cute, pastel, or diary-like.
- No modern dashboard cards or hard rectangular outer frame.

## Interaction Motion

- Idle: subtle float and low-frequency effects.
- Capture: brief page-center emphasis without opening the panel.
- Open: page light expands while the window changes to the centered panel mode.
- Close: panel returns to the saved compact pet bounds.

## Avoid

- Closed covers, flat icons, or hard SVG reconstruction.
- Square jewels and rigid rectangular pages.
- Dense atmospheric decoration that hides the product.
- Text baked into panel artwork.
- Controls touching page edges or crossing the spine.
- Reintroducing obsolete candidate assets into runtime code.

## Asset License Boundary

Program code and generated artwork use separate license boundaries. The artwork is not covered by the MIT source-code license while provider rights remain under review.
