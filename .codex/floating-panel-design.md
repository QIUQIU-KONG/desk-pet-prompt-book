# Floating Panel Design

## Selected Panel Asset

The internal panel uses:

```text
src/renderer/assets/panel-book-ui-v3b-alpha.png
```

Its prompt record is preserved at:

```text
docs/asset-prompts/panel-book-ui-v3b.txt
```

## Layout

- The panel is a complete open book inside a transparent `1024x700` Electron window.
- Left and right content surfaces use independent coordinates and masks.
- A `120px` center-spine exclusion zone remains empty.
- The left page is the project directory.
- The right page contains search, pending filter, stage filter, sorting, and manuscript prompt entries.
- The close control stays in the upper-right decoration area, separated from sorting.
- Dragging starts only from the central spine drag zone.

## Visual Rules

- The book artwork is the outer frame; do not add a hard rectangular panel border.
- Text remains flat semantic DOM for readability and precise interaction.
- Hover washes and scroll content remain inside page masks.
- Prompt entries use ink separators rather than modern cards.
- Project selection and user-set current project use distinct visual states.
- Dialogs belong visually to the book and must not call unsupported native `prompt` or `confirm` APIs.

## Acceptance

- All content remains inside the parchment safe areas.
- No control crosses the spine or overlaps decorative jewels.
- Transparent window corners remain fully transparent.
- The panel opens centered and returns to the original pet bounds when closed.
- Search, copy, rating 5, pin, edit, project/stage management, and deletion remain usable.
