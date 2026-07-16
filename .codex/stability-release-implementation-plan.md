# Stability And Release Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `plan-driven-development-loop` and `superpowers:test-driven-development`. Execute tasks serially and update task checkboxes only after each verification passes.

**Goal:** Complete phase 8 by protecting local prompt data from concurrent writes and damaged files, verifying large/long prompt behavior, and making repeated panel transitions idempotent.

**Architecture:** Keep the existing Electron main/preload/renderer/core boundaries. Add serialization, normalization, backup, and recovery inside `createPromptStore`; keep window state protection in the Electron main process. Do not add a database or dependency.

**Tech Stack:** Node.js 24 CommonJS core, Electron 39.8.10, Node test runner, pnpm 11.13.0, PowerShell verification helper.

## Global Constraints

- Prompt data remains local JSON under Electron `userData`; recovery files must never be uploaded.
- No new runtime or development dependency.
- No visual, layout, product-scope, or clipboard-trigger change.
- Existing prompt/project/stage/keyword/view-state contracts remain compatible.
- Every behavior fix follows RED -> GREEN and the final gate is `scripts/verify-and-push.ps1`.
- The completed work is committed and pushed once after final verification.

---

### Task 1: Serialize Prompt Store Mutations

**Files:**
- Modify: `tests/prompt-store.test.mjs`
- Modify: `src/core/prompt-store.cjs`

**Interfaces:**
- Consumes: the existing async store methods returned by `createPromptStore(options)`.
- Produces: the same method names and return values, with mutating calls executed in invocation order.

- [x] **Step 1: Add the concurrent-write regression test**

Add a test that runs 20 distinct `captureText()` calls through `Promise.all`, expects every result to be `saved`, reloads the file, and expects 20 unique prompts.

```js
test('concurrent prompt mutations are serialized without losing data', async () => {
  const store = await createTestStore();
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) => store.captureText(`Concurrent prompt ${index}`))
  );
  const data = await store.load();

  assert.equal(results.every((result) => result.status === 'saved'), true);
  assert.equal(data.prompts.length, 20);
  assert.equal(new Set(data.prompts.map((prompt) => prompt.content)).size, 20);
});
```

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs`

Expected: the concurrent test fails with a temporary-file rename error or fewer than 20 persisted prompts.

- [x] **Step 3: Queue mutating methods**

Inside `createPromptStore`, add one promise queue and expose every mutating method through a small `queued()` wrapper. Keep read-only methods direct and make a rejected mutation release the queue for the next operation.

```js
let mutationQueue = Promise.resolve();

function queued(operation) {
  return (...args) => {
    const result = mutationQueue.then(() => operation(...args));
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };
}
```

- [x] **Step 4: Verify GREEN**

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs`

Expected: all prompt-store tests pass and 20 prompts persist.

---

### Task 2: Recover And Normalize Local Storage

**Files:**
- Modify: `tests/prompt-store.test.mjs`
- Modify: `src/core/prompt-store.cjs`
- Modify: `src/electron/main.cjs`
- Modify: `docs/data-and-privacy.md`

**Interfaces:**
- Consumes: `createPromptStore({ filePath, clock, idGenerator, onRecovery })`.
- Produces: `prompts.json.bak`, quarantined `prompts.json.corrupt-*` files, normalized in-memory data, and non-sensitive recovery diagnostics.

- [x] **Step 1: Add recovery and malformed-data tests**

Add one test that saves a prompt, corrupts the primary JSON, creates a new store, and expects recovery from `.bak` plus one quarantine file and one `onRecovery` event. Add another test that writes non-array collections and orphan project/stage/keyword references, then expects safe empty collections and cleared invalid references without losing valid prompts.

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs`

Expected: JSON parsing throws and malformed relationships remain invalid.

- [x] **Step 3: Implement backup, quarantine, recovery, and normalization**

Write the same serialized snapshot atomically to the primary and `.bak` paths. On a missing or invalid primary, restore a valid backup when available; otherwise quarantine invalid files and initialize an empty valid store. Normalize collection types and clear prompt references to missing projects, stages, and keywords. Call `onRecovery` with paths and reason only, never prompt content.

- [x] **Step 4: Log Electron recovery diagnostics**

Pass `onRecovery` from `getPromptStore()` to `appendStartupLog`, recording only recovery kind and local file names.

- [x] **Step 5: Document privacy behavior and verify GREEN**

Document local backup/quarantine files and deletion guidance in `docs/data-and-privacy.md`.

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs tests/electron-pet-shell.test.mjs`

Expected: storage and Electron contract tests pass.

---

### Task 3: Establish Long-Content And Scale Baselines

**Files:**
- Modify: `tests/prompt-store.test.mjs`
- Modify if measured baseline fails: `src/core/prompt-store.cjs`

**Interfaces:**
- Consumes: `captureText(text)` and `queryPrompts(options)`.
- Produces: regression coverage for a 256 KiB prompt and global search across 2,000 prompts.

- [x] **Step 1: Add boundary tests**

Verify a 256 KiB body is stored without truncation while its generated title remains at most 80 characters. Seed 2,000 prompts directly, search for one marker, assert exact results, and require the query to complete within 1,000 ms on the supported Node 24 runtime.

- [x] **Step 2: Run the baseline**

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs`

Expected: correctness assertions pass. If the 1,000 ms bound fails, replace repeated keyword-array scans with one per-query `Map` lookup and rerun; do not weaken the bound without measured platform evidence.

- [x] **Step 3: Verify persistence after reconstruction**

Create a second store instance over the same file and assert title, content, note, keywords, rating, pin state, project, stage, use count, last-used time, and view state remain intact.

Run: `corepack pnpm exec node --test tests/prompt-store.test.mjs`

Expected: all boundary and reconstruction tests pass.

---

### Task 4: Make Repeated Panel Transitions Idempotent

**Files:**
- Modify: `tests/electron-pet-shell.test.mjs`
- Modify: `src/electron/main.cjs`
- Modify: `.codex/development-plan.md`
- Modify: `.codex/agent-context.md`

**Interfaces:**
- Consumes: `applyWindowMode(petWindow, mode)` and current `WINDOW_MODES`.
- Produces: duplicate open/close requests that preserve the original compact pet bounds.

- [x] **Step 1: Add the idempotence contract test**

Require `applyWindowMode` to return early when `getWindowMode(petWindow) === mode`, while still applying the fixed size contract. The test must fail against the current main process source.

- [x] **Step 2: Verify RED**

Run: `corepack pnpm exec node --test tests/electron-pet-shell.test.mjs`

Expected: the new idempotence assertion fails.

- [x] **Step 3: Implement the guarded transition**

Read the current mode before saving pet bounds. For a duplicate target mode, call `lockPetWindowSize`, return the existing mode dimensions, and do not replace `__deskPetPetBounds`.

- [x] **Step 4: Verify GREEN and close phase 8**

Run: `corepack pnpm test`

Expected: the complete suite passes. Update phase 8 and the active context with the exact stability scenarios and test count.

- [x] **Step 5: Run final gate, review, commit, and push**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall`

Review: `git diff --check`, focused diff, no credentials, no visual assets, and no unrelated files.

Commit: `git commit -m "feat: harden local prompt storage"`

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-and-push.ps1 -SkipInstall -Push`

Expected: local record reports `passed`, `workingTreeClean=true`, `pushStatus=pushed`, and `remoteSynchronized=true`.
