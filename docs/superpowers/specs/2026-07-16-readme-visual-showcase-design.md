# README Visual Showcase Design

## Goal

Show the product's complete visual journey in both READMEs: the floating desktop-pet state first, followed by the expanded prompt-management book. Explain the intentional calligraphy on the pet so the artwork reads as product storytelling rather than decoration.

## Showcase Structure

The Chinese and English READMEs use the same vertical sequence near the top:

1. **Desktop-pet mode**: a real runtime screenshot containing the floating book, page glow, stardust, smoke, and luminous butterflies.
2. **Expanded workspace**: the existing application-panel screenshot.
3. **Visual concept**: the two calligraphy lines, their Chinese meaning, and a concise explanation of how they express the product idea.

The two images remain separate rather than being forced into a side-by-side table. Their aspect ratios are different, and a vertical sequence preserves detail on desktop and mobile GitHub views.

## Runtime Screenshot

- Add `docs/images/desktop-pet-preview.png`.
- Capture the running renderer rather than publishing the raw source artwork.
- Keep the complete pet visible with breathing room around it.
- Preserve the actual runtime effects and avoid editor chrome, debug controls, personal desktop content, or temporary test labels.
- Use a dark neutral presentation background so the glow and butterflies remain legible in GitHub light and dark themes.

## Calligraphy Concept

The pet artwork intentionally contains:

- Left page: `Build agents with clarity.`
- Right page: `Let prompts become systems.`

Chinese explanation:

- “清晰地构建 Agent。”
- “让提示词成为系统。”

Together they describe the product direction: prompts should not remain isolated clipboard fragments. Clear intent becomes an Agent; reusable prompts, projects, and stages become a repeatable working system. The writing pen reinforces the transition from an idea being written down to a workflow being built.

## Documentation And Licensing

- Keep `README.md` and `README.en.md` structurally equivalent.
- Add the new screenshot to `ASSET-LICENSE.md` and `docs/asset-provenance.md` because it contains the license-pending generated artwork.
- Update visual-file counts from five to six wherever they describe the distributed asset set.
- Do not change the current `license-pending` conclusion.

## Acceptance Criteria

- Both READMEs visibly show desktop-pet mode before expanded-panel mode.
- The desktop-pet image is an actual runtime capture with glow and butterflies visible.
- Both calligraphy lines are transcribed exactly and explained in Chinese and English.
- The creative explanation connects Agent clarity, prompt reuse, and systemized workflows.
- Asset-license and provenance records include the new screenshot.
- Repository readiness, tests, Git checks, push, and final GitHub Actions verification pass.
