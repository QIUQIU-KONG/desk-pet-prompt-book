# Desktop Pet Layered Effects

## Current Composition

The renderer combines one transparent bitmap with five lightweight CSS effect layers:

1. `floating-shadow`
2. `book-body`
3. `page-glow`
4. `magic-smoke`
5. `stardust`
6. `butterflies`

The bitmap source is `src/renderer/assets/pet-book-body-v5-alpha.png`. CSS and DOM effects live in `src/renderer/index.html` and `src/renderer/styles.css`.

## Layer Responsibilities

### Book Body

- Owns the recognizable book, parchment, spine, pen, ornaments, and jewel.
- Moves only with restrained whole-object floating and feedback emphasis.
- Must remain visually complete without the effect layers.

### Page Glow

- Anchored to the page center.
- Breathes at low intensity while idle.
- Strengthens for capture feedback and panel opening.

### Magic Smoke

- Uses translucent blue-violet shapes.
- Moves slowly upward with a small horizontal drift.
- Must not increase the transparent window's apparent rectangular boundary.

### Stardust

- Uses a limited number of small gold particles.
- Flickers quietly while idle.
- Converges briefly for successful capture feedback.

### Butterflies

- Uses two to four white glowing butterfly shapes.
- Moves infrequently and remains outside primary reading areas.
- Must remain identifiable at the compact pet size.

### Floating Shadow

- Adds a soft blue-violet support glow below the book.
- Breathes in time with the vertical float.
- Must not look like a solid platform.

## Engineering Constraints

- Keep effect layers aligned to the selected bitmap rather than accumulating per-screen offsets.
- Prefer opacity and transform animation to expensive layout animation.
- Keep animation restrained for long-running desktop use.
- Do not reintroduce removed candidate images or duplicate runtime assets.
- Visual changes require browser and transparent Electron screenshot checks.
