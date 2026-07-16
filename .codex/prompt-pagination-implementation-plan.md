# Prompt Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `plan-driven-development-loop` and `superpowers:test-driven-development`. Execute serially and mark checkboxes only after verification.

**Goal:** Replace the clipped scrolling prompt list with three-item manuscript pages, reliable page navigation, subtle directional transitions, and geometry-based menu placement.

**Architecture:** Add one pure renderer helper for pagination, keyboard guards, and menu-placement decisions. Keep DOM state and animation orchestration in `pet-preview.js`; keep prompt data queries unchanged.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js VM tests, Electron 39.8.10, Node test runner.

## Global Constraints

- Keep the fixed `1024×700` Electron panel and existing book assets.
- Show at most 3 prompt entries per page.
- Page state remains renderer-only and is not persisted.
- Do not change prompt storage, search semantics, or project/stage models.
- Do not add dependencies or draw a new book frame.
- Package/installer work remains paused.

---

### Task 1: Pure Pagination And Placement Rules

**Files:**
- Create: `src/renderer/prompt-pagination.js`
- Create: `tests/prompt-pagination.test.mjs`
- Modify: `src/renderer/index.html`
- Modify: `package.json`

**Interfaces:**
- Produces: `globalThis.deskPetPromptPagination` with `PROMPTS_PER_PAGE`, `paginate`, `move`, `directionForKey`, and `resolveMenuPlacement`.
- Consumes: arrays and plain scalar geometry; no DOM dependency.

- [x] **Step 1: Write failing pure-function tests**

Cover these contracts:

```js
paginate(['a', 'b', 'c', 'd'], 1).items // ['a', 'b', 'c']
paginate(['a', 'b', 'c', 'd'], 2).items // ['d']
paginate(['a'], 99).page // 1
paginate([], 1) // page 0, totalPages 0
move(pageState, 'forward') // clamped next page
directionForKey({ key: 'ArrowRight', panelOpen: true }) // 'forward'
resolveMenuPlacement({ menuHeight: 130, spaceAbove: 20, spaceBelow: 220 }) // down
resolveMenuPlacement({ menuHeight: 130, spaceAbove: 220, spaceBelow: 20 }) // up
```

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/prompt-pagination.test.mjs`

Expected: FAIL because `prompt-pagination.js` does not exist.

- [x] **Step 3: Implement and load the helper**

Use an IIFE matching `prompt-entry-view.js`. `paginate` must normalize invalid pages and page sizes, return stable `hasPrevious`/`hasNext` flags, and never mutate its input. `directionForKey` must reject editable or interactive targets and open dialogs. `resolveMenuPlacement` must return `down`, `up`, or a constrained direction with a numeric maximum height.

Load the helper before `pet-preview.js`, add it to `check:syntax`, and expose no Node APIs to the renderer.

- [x] **Step 4: Verify GREEN**

Run: `corepack pnpm exec node --test tests/prompt-pagination.test.mjs`

Expected: all pure-function tests pass.

---

### Task 2: Three-Item Page State And Controls

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/pet-preview.js`
- Modify: `tests/desktop-pet-preview.test.mjs`

**Interfaces:**
- Consumes: `deskPetPromptPagination.paginate()` and `.move()`.
- Produces: `[data-prompt-page="previous"]`, `[data-prompt-page="next"]`, and `[data-prompt-page-status]`.

- [x] **Step 1: Write failing renderer-contract tests**

Require semantic previous/next buttons, a live page status, `currentPromptPage`, slicing through the pure helper, disabled boundary states, and page event handlers. Require no-result state `0 / 0` and three-item page size.

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/desktop-pet-preview.test.mjs`

Expected: FAIL because page controls and renderer state do not exist.

- [x] **Step 3: Implement renderer pagination**

Sort and filter the complete result first, then pass it to `paginate`. Render only `pageState.items`, clamp `currentPromptPage` from the returned state, and update page controls every render. Close rating/menu state when its prompt is not on the active page.

- [x] **Step 4: Reset and clamp state at the correct boundaries**

Reset to page 1 for search input, search scope, project/library selection, pending filter, stage filter, and sort changes. Keep the current page for edits and copies; after deletion or moving a prompt, let `paginate` clamp to the final valid page.

- [x] **Step 5: Add button and keyboard navigation**

Buttons call `changePromptPage('backward'|'forward')`. A document key handler calls `directionForKey` and ignores inputs, textareas, selects, buttons, dialogs, contenteditable elements, a closed panel, and non-arrow keys.

- [x] **Step 6: Verify GREEN**

Run: `corepack pnpm exec node --test tests/prompt-pagination.test.mjs tests/desktop-pet-preview.test.mjs`

Expected: pagination and existing renderer tests pass.

---

### Task 3: Directional Motion And Reliable Menu Placement

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/pet-preview.js`
- Modify: `tests/desktop-pet-preview.test.mjs`

**Interfaces:**
- Consumes: `directionForKey` and `resolveMenuPlacement`.
- Produces: geometry classes `opens-upward` and `is-constrained`; a 180 ms two-phase page transition.

- [x] **Step 1: Write failing menu and motion tests**

Remove the old assertion for `.prompt-entry:last-child`. Require geometry measurement with `getBoundingClientRect()` and `scrollHeight`, the two menu classes, a fixed pagination footer, directional page motion, and a `prefers-reduced-motion` override.

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/desktop-pet-preview.test.mjs`

Expected: FAIL on the old last-child rule and missing motion/menu contracts.

- [x] **Step 3: Implement geometry-based menu placement**

After an open menu is rendered, measure the list, toggle, and menu. Apply the pure placement result. Default downward for a single top entry; open upward near the bottom; constrain and internally scroll only when neither direction fits.

- [x] **Step 4: Implement stable page motion**

Use two 90 ms Web Animations phases on the fixed-size prompt list: old content exits in the selected direction, then new content enters from the opposite direction. Use a revision token to prevent stale transitions after a search/filter change. Skip animation when reduced motion is requested or `Element.animate` is unavailable.

- [x] **Step 5: Refine page-safe CSS and verify GREEN**

Change `.panel-main` to reserve a fifth grid row for the footer. Keep three entries within the list, remove vertical list scrolling, remove the last-child menu rule, and keep menu overflow inside the page.

Run: `corepack pnpm exec node --test tests/prompt-pagination.test.mjs tests/desktop-pet-preview.test.mjs`

Expected: all pagination, menu, motion, and existing visual contracts pass.

---

### Task 4: Documentation And End-To-End Verification

**Files:**
- Modify: `.codex/product-requirements.md`
- Modify: `.codex/interaction-flows.md`
- Modify: `.codex/book-page-content-redesign.md`
- Modify: `.codex/agent-context.md`
- Modify: `.codex/prompt-pagination-implementation-plan.md`

**Interfaces:**
- Produces: durable product and interaction acceptance records.

- [x] **Step 1: Update product and interaction contracts**

Document three-item pages, controls, keyboard guard, reset/clamp rules, menu placement, and reduced-motion behavior. Record the menu clipping root cause as removed behavior.

- [x] **Step 2: Run the complete automated gate**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall`

Expected: syntax, complete tests, readiness, audit, and Git checks pass.

- [x] **Step 3: Restart and inspect Electron**

Stop only the Electron process started for this task, restart from the current source, and verify: one prompt menu visible, four prompts split 3+1, buttons and keyboard navigation, search reset, deletion clamp, and no content crossing the right-page boundary.

- [x] **Step 4: Review, commit, push, and confirm CI**

Review the complete diff for unrelated files, credentials, stale rules, and layout regressions. Commit focused changes, run `scripts/verify-and-push.ps1 -SkipInstall -Push`, confirm `origin/main`, and inspect the final GitHub Actions run once.
