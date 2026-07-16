# Book Page Content Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Do not dispatch parallel agents for this plan.

**Goal:** Replace the card-and-sidebar panel with two book-aligned page surfaces while preserving all prompt workflows and fixing rating-five and prompt deletion.

**Architecture:** Keep Electron and the JSON prompt store as the system boundary. Migrate persisted view state to a single `library | project` model with a separate `pendingOnly` filter, then render the left project directory and right prompt manuscript as independent semantic DOM surfaces. Use generated PNG masks only for page-edge clipping; keep text and controls as unwarped DOM.

**Tech Stack:** Electron 37, Node.js CommonJS store and IPC, plain HTML/CSS/JavaScript, Node test runner, Windows PowerShell `System.Drawing` for reproducible mask assets.

## Global Constraints

- Do not add an MVP-only path or preserve the old sidebar/card UI alongside the replacement.
- The product has one prompt library; `projectId === null` means pending organization.
- Search remains global by default unless “current view only” is enabled.
- `currentProjectId` is user-set context and must not change when browsing, creating, or capturing.
- Text remains flat semantic DOM; do not rasterize or perspective-warp it.
- The book artwork remains `panel-book-ui-v3b-alpha.png`; do not redraw the book with CSS.
- Prompt deletion requires confirmation and is permanent; do not add a recycle bin.
- The fifth rating star must save `5` through the real UI path.
- Complete each task with tests, a focused commit, and `git push origin main` so the user receives live versions.

## File Map

- `src/core/prompt-store.cjs`: persisted view-state migration, library/pending queries, counts, and current-project validation.
- `src/electron/main.cjs`: expose only the prompt query/count IPC needed by the panel.
- `src/electron/preload.cjs`: safe renderer bridge for query/count and existing mutations.
- `prototype/desktop-pet-preview/index.html`: independent left/right page DOM, inline project creation, pending filter, and delete confirmation dialog.
- `prototype/desktop-pet-preview/styles.css`: page coordinates, mask usage, manuscript styling, expanded rating hit areas, and menus.
- `prototype/desktop-pet-preview/pet-preview.js`: panel state, project directory behavior, pending filter, menu/rating state, and confirmed deletion.
- `prototype/desktop-pet-preview/prompt-entry-view.js`: pure prompt-entry markup helpers testable without Electron.
- `scripts/generate-page-masks.ps1`: deterministic generation of page clipping masks.
- `prototype/desktop-pet-preview/assets/page-mask-left.png`: left page alpha mask.
- `prototype/desktop-pet-preview/assets/page-mask-right.png`: right page alpha mask.
- `tests/prompt-store.test.mjs`: persisted-state migration and query behavior.
- `tests/electron-pet-shell.test.mjs`: IPC contract cleanup and new counts channel.
- `tests/desktop-pet-preview.test.mjs`: DOM/CSS/view-helper regression coverage.

---

### Task 1: Migrate To Library And Pending View State

**Files:**
- Modify: `src/core/prompt-store.cjs`
- Modify: `src/electron/main.cjs`
- Modify: `src/electron/preload.cjs`
- Modify: `tests/prompt-store.test.mjs`
- Modify: `tests/electron-pet-shell.test.mjs`

**Interfaces:**
- Produces: `queryPrompts({ viewType, projectId, pendingOnly, query, currentViewOnly, sortMode, stageId }) -> Promise<{ prompts }>`.
- Produces: `getPromptCounts() -> Promise<{ total: number, pending: number }>`.
- Produces: `getViewState() -> { lastViewType: 'library' | 'project', lastProjectId, currentProjectId, pendingOnly, sortMode, stageFilter }`.
- Consumes: existing prompt, project, stage, keyword arrays and existing JSON file.

- [x] **Step 1: Add failing store tests for the new state contract**

Extend the test import to `import { mkdtemp, readFile, writeFile } from 'node:fs/promises';`, then add tests that write legacy view state and assert deterministic migration:

```js
test('view state migrates legacy all and inbox views to library state', async () => {
  const store = await createTestStore();
  await store.captureText('Migration seed');
  const filePath = store.filePath;
  const data = JSON.parse(await readFile(filePath, 'utf8'));

  data.viewState = { lastViewType: 'inbox', lastProjectId: null, sortMode: 'smart', stageFilter: null };
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  assert.deepEqual(await store.getViewState(), {
    lastViewType: 'library',
    lastProjectId: null,
    currentProjectId: null,
    pendingOnly: true,
    sortMode: 'smart',
    stageFilter: null
  });

  data.viewState.lastViewType = 'all';
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  assert.equal((await store.getViewState()).pendingOnly, false);
});

test('library query and pending filter share one prompt library', async () => {
  const store = await createTestStore();
  await store.captureText('Pending prompt');
  await store.captureText('Project prompt');
  const project = (await store.createProject('Build')).project;
  await store.updatePromptProject('prompt-2', project.id);

  const library = await store.queryPrompts({ viewType: 'library', pendingOnly: false });
  const pending = await store.queryPrompts({ viewType: 'library', pendingOnly: true });
  const counts = await store.getPromptCounts();

  assert.equal(library.prompts.length, 2);
  assert.deepEqual(pending.prompts.map((prompt) => prompt.title), ['Pending prompt']);
  assert.deepEqual(counts, { total: 2, pending: 1 });
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern "view state migrates|library query" tests/prompt-store.test.mjs
```

Expected: FAIL because `library`, `pendingOnly`, `currentProjectId`, and `getPromptCounts` are not implemented.

- [x] **Step 3: Normalize persisted view state at load time**

Use one normalizer for initial data, legacy data, reads, and updates:

```js
const DEFAULT_VIEW_STATE = {
  lastViewType: 'library',
  lastProjectId: null,
  currentProjectId: null,
  pendingOnly: false,
  sortMode: 'smart',
  stageFilter: null
};

function normalizeViewState(rawState = {}) {
  const legacyType = rawState.lastViewType;
  const lastViewType = legacyType === 'project' ? 'project' : 'library';
  const pendingOnly = legacyType === 'inbox' ? true : Boolean(rawState.pendingOnly);

  return {
    ...DEFAULT_VIEW_STATE,
    ...rawState,
    lastViewType,
    lastProjectId: rawState.lastProjectId || null,
    currentProjectId: rawState.currentProjectId || null,
    pendingOnly,
    stageFilter: rawState.stageFilter || null
  };
}
```

Validate both project identifiers in `getViewState()`. If the browsed project is gone, return the library with `pendingOnly: false`; if only the current project is gone, clear `currentProjectId` without changing the browsed view.

- [x] **Step 4: Replace inbox filtering with library plus pending filtering**

```js
function filterPromptsForView(prompts, viewType, projectId, pendingOnly) {
  const viewed = viewType === 'project'
    ? prompts.filter((prompt) => prompt.projectId === projectId)
    : prompts;

  return pendingOnly
    ? viewed.filter((prompt) => prompt.projectId === null)
    : viewed;
}

async function getPromptCounts() {
  const data = await load();
  return {
    total: data.prompts.length,
    pending: data.prompts.filter((prompt) => prompt.projectId === null).length
  };
}
```

Pass `Boolean(options.pendingOnly)` into `filterPromptsForView`. Keep global search behavior: when a query exists and `currentViewOnly` is false, skip project and pending filters.

- [x] **Step 5: Update view-state mutation and project deletion**

Allow only `library | project`, persist `pendingOnly` and `currentProjectId`, and clear `currentProjectId` when its project is deleted. Deleting the active project must set:

```js
data.viewState.lastViewType = 'library';
data.viewState.lastProjectId = null;
data.viewState.pendingOnly = false;
data.viewState.stageFilter = null;
```

- [x] **Step 6: Replace legacy list IPC with query and counts IPC**

Remove renderer bridge methods and handlers for `prompts:listInbox`, `prompts:listAll`, and `prompts:listProject`. Add:

```js
ipcMain.handle('prompts:counts', async () => getPromptStore().getPromptCounts());
```

```js
getPromptCounts: () => ipcRenderer.invoke('prompts:counts'),
```

Keep `prompts:query` as the only list IPC. Remove store exports that have no remaining production consumer and update their tests to query through the new contract.

- [x] **Step 7: Run the complete test suite and verify GREEN**

Run: `pnpm test`

Expected: all tests pass with no references to legacy list IPC in Electron contract tests.

- [x] **Step 8: Commit and push the view-model version**

```powershell
git add src/core/prompt-store.cjs src/electron/main.cjs src/electron/preload.cjs tests/prompt-store.test.mjs tests/electron-pet-shell.test.mjs
git commit -m "refactor: unify prompt library view state"
git push origin main
```

---

### Task 2: Build The Single-Library Project Directory

**Files:**
- Modify: `prototype/desktop-pet-preview/index.html`
- Modify: `prototype/desktop-pet-preview/pet-preview.js`
- Modify: `prototype/desktop-pet-preview/styles.css`
- Modify: `tests/desktop-pet-preview.test.mjs`

**Interfaces:**
- Consumes: Task 1 `queryPrompts`, `getPromptCounts`, and normalized view state.
- Produces: renderer state `{ activeView, activeProjectId, currentProjectId, pendingOnly }`.
- Produces: inline project-create controls with `data-project-create-toggle`, `data-project-create-form`, and `data-project-create-cancel`.

- [x] **Step 1: Add failing DOM and renderer contract tests**

```js
test('panel exposes one library entry and a pending filter', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /data-view="library"/);
  assert.match(html, /data-pending-toggle/);
  assert.match(html, /记得归纳清理哟~/);
  assert.doesNotMatch(html, /data-view="inbox"|data-view="all"/);
  assert.match(js, /activeView\s*=\s*'library'/);
  assert.match(js, /pendingOnly/);
});

test('project creation expands beside the directory title', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /class="project-title-row"/);
  assert.match(html, /data-project-create-toggle/);
  assert.match(html, /data-project-create-form/);
});
```

- [x] **Step 2: Run the focused frontend tests and verify RED**

Run:

```powershell
node --test --test-name-pattern "one library entry|project creation expands" tests/desktop-pet-preview.test.mjs
```

Expected: FAIL because the old inbox/all navigation and permanent project form still exist.

- [x] **Step 3: Replace the left-page HTML**

Use this structure inside the left page:

```html
<aside class="project-page page-surface" aria-label="项目目录">
  <header class="project-page-header">
    <small>Prompt Archive</small>
    <div class="project-title-row">
      <h2>项目目录</h2>
      <button class="project-create-toggle" type="button" data-project-create-toggle aria-label="新建项目">＋</button>
      <form class="create-project-form" data-project-create-form hidden>
        <input type="text" name="projectName" placeholder="项目名" maxlength="24" />
        <button type="submit" aria-label="确认新建项目">✓</button>
      </form>
    </div>
  </header>
  <nav class="library-entry" aria-label="提示词库">
    <button class="project-item active" type="button" data-view="library">
      <span>提示词库</span><b data-library-count>0</b>
    </button>
  </nav>
  <div class="project-list" data-project-list></div>
</aside>
```

Add a right-page pending control:

```html
<button class="pending-filter" type="button" data-pending-toggle aria-pressed="false">
  待归纳 <b data-pending-count>0</b>
</button>
<span class="pending-note" data-pending-note hidden>记得归纳清理哟~</span>
```

- [x] **Step 4: Migrate renderer state and loading**

Initialize:

```js
let activeView = 'library';
let activeProjectId = null;
let currentProjectId = null;
let pendingOnly = false;
```

Persist and restore all four fields. `loadPromptsForView()` must call `getPromptCounts()` and `queryPrompts()` rather than legacy list methods. Update count text and hide the reminder when `pending === 0`. Enabling the pending filter switches to `library`; selecting a project clears `pendingOnly`; clicking the library entry clears `pendingOnly` and shows the complete library.

- [x] **Step 5: Implement inline project creation and cancellation precedence**

Add `openProjectCreator()`, `closeProjectCreator()`, and `isProjectCreatorOpen()`. On successful creation call `setActiveView('project', result.project.id)` without changing `currentProjectId`. `Escape` closes project creation before it closes rating, menus, dialogs, or the whole panel. A document pointer event outside the title row cancels creation.

```js
function isProjectCreatorOpen() {
  return !createProjectForm.hidden;
}

function openProjectCreator() {
  createProjectForm.hidden = false;
  createProjectToggle.setAttribute('aria-expanded', 'true');
  createProjectInput.focus();
}

function closeProjectCreator() {
  createProjectForm.hidden = true;
  createProjectForm.reset();
  createProjectToggle.setAttribute('aria-expanded', 'false');
}

async function setPendingFilter(nextPendingOnly) {
  pendingOnly = Boolean(nextPendingOnly);
  if (pendingOnly) {
    activeView = 'library';
    activeProjectId = null;
    activeStageId = null;
  }
  await refreshProjects();
  await refreshStages();
  await loadPromptsForView(activeView);
  await persistViewState();
}
```

- [x] **Step 6: Render selected and current project states independently**

Render the selected project with `active`; render `currentProjectId` with `current` and a gold bookmark. Add a project action `current` that toggles `currentProjectId`, persists view state, and does not navigate.

```js
if (action === 'current') {
  currentProjectId = currentProjectId === projectId ? null : projectId;
  await persistViewState();
  renderProjectDirectory();
  setFeedback(currentProjectId ? '当前项目已设置' : '当前项目已清除');
  return;
}
```

- [x] **Step 7: Run frontend and full tests**

Run:

```powershell
node --test tests/desktop-pet-preview.test.mjs
pnpm test
```

Expected: all tests pass and no production renderer code references `activeView === 'inbox'` or `activeView === 'all'`.

- [x] **Step 8: Commit and push the project-directory version**

```powershell
git add prototype/desktop-pet-preview/index.html prototype/desktop-pet-preview/pet-preview.js prototype/desktop-pet-preview/styles.css tests/desktop-pet-preview.test.mjs
git commit -m "feat: add single-library project directory"
git push origin main
```

---

### Task 3: Add Independent Page Coordinates And Masks

**Files:**
- Create: `scripts/generate-page-masks.ps1`
- Create: `prototype/desktop-pet-preview/assets/page-mask-left.png`
- Create: `prototype/desktop-pet-preview/assets/page-mask-right.png`
- Modify: `prototype/desktop-pet-preview/styles.css`
- Modify: `prototype/desktop-pet-preview/index.html`
- Modify: `tests/desktop-pet-preview.test.mjs`

**Interfaces:**
- Consumes: Task 2 `.project-page` and `.prompt-page` DOM surfaces.
- Produces: a `260x400` left mask and `340x400` right mask.
- Produces: centralized CSS coordinates and a minimum `120px` spine exclusion zone.

- [x] **Step 1: Add failing mask and geometry tests**

Add mask paths and assertions using the existing PNG reader:

```js
const leftMaskPath = new URL('../prototype/desktop-pet-preview/assets/page-mask-left.png', import.meta.url);
const rightMaskPath = new URL('../prototype/desktop-pet-preview/assets/page-mask-right.png', import.meta.url);

test('book pages use independent masked safe areas', async () => {
  assert.equal(existsSync(leftMaskPath), true);
  assert.equal(existsSync(rightMaskPath), true);
  const left = await readRgbaPng(leftMaskPath);
  const right = await readRgbaPng(rightMaskPath);
  assert.deepEqual([left.width, left.height], [260, 400]);
  assert.deepEqual([right.width, right.height], [340, 400]);
  assert.equal(left.alphaAt(0, 399), 0);
  assert.ok(left.alphaAt(130, 200) > 240);
  assert.equal(right.alphaAt(339, 399), 0);
  assert.ok(right.alphaAt(170, 200) > 240);
});
```

Also assert CSS defines `--left-page-x`, `--right-page-x`, and `--spine-gap: 120px` and no longer uses `grid-template-columns: 176px`.

- [x] **Step 2: Run the mask test and verify RED**

Run: `node --test --test-name-pattern "independent masked safe areas" tests/desktop-pet-preview.test.mjs`

Expected: FAIL because mask files and new coordinates do not exist.

- [x] **Step 3: Add the deterministic PowerShell mask generator**

Create this complete script so mask generation is reproducible without adding a package dependency:

```powershell
Add-Type -AssemblyName System.Drawing

$assetDir = Join-Path $PSScriptRoot '..\prototype\desktop-pet-preview\assets'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

function Save-PageMask {
  param(
    [System.Drawing.Drawing2D.GraphicsPath]$Shape,
    [int]$Width,
    [int]$Height,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.FillPath($brush, $Shape)
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $Shape.Dispose()
  }
}

$left = New-Object System.Drawing.Drawing2D.GraphicsPath
$left.AddBezier(8, 4, 3, 90, 3, 325, 12, 394)
$left.AddBezier(12, 394, 110, 390, 210, 380, 248, 360)
$left.AddBezier(248, 360, 257, 285, 257, 75, 250, 4)
$left.AddLine(250, 4, 8, 4)
$left.CloseFigure()
Save-PageMask -Shape $left -Width 260 -Height 400 -OutputPath (Join-Path $assetDir 'page-mask-left.png')

$right = New-Object System.Drawing.Drawing2D.GraphicsPath
$right.AddBezier(90, 360, 130, 380, 230, 390, 328, 394)
$right.AddBezier(328, 394, 337, 325, 337, 90, 332, 4)
$right.AddLine(332, 4, 10, 4)
$right.AddBezier(10, 4, 3, 75, 3, 285, 12, 360)
$right.AddBezier(12, 360, 35, 366, 62, 365, 90, 360)
$right.CloseFigure()
Save-PageMask -Shape $right -Width 340 -Height 400 -OutputPath (Join-Path $assetDir 'page-mask-right.png')
```

- [x] **Step 4: Generate and inspect the masks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-page-masks.ps1
```

Expected: both PNGs are created with the dimensions asserted above.

- [x] **Step 5: Replace the shared grid with absolute page coordinates**

Use centralized values:

```css
.panel-content {
  --page-top: 72px;
  --page-height: 400px;
  --left-page-x: 168px;
  --left-page-width: 260px;
  --right-page-x: 548px;
  --right-page-width: 340px;
  --spine-gap: 120px;
  position: relative;
  width: 1024px;
  height: 576px;
  overflow: hidden;
}

.project-page,
.prompt-page {
  position: absolute;
  top: var(--page-top);
  height: var(--page-height);
  overflow: hidden;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
}

.project-page {
  left: var(--left-page-x);
  width: var(--left-page-width);
  -webkit-mask-image: url('./assets/page-mask-left.png');
  mask-image: url('./assets/page-mask-left.png');
}

.prompt-page {
  left: var(--right-page-x);
  width: var(--right-page-width);
  -webkit-mask-image: url('./assets/page-mask-right.png');
  mask-image: url('./assets/page-mask-right.png');
}
```

Remove full-height rectangular panel backgrounds. Keep only faint ink separators and masked hover washes.

- [x] **Step 6: Verify geometry in the local browser**

At a `1280x720` viewport, open the panel and read bounding rectangles. Acceptance:

- `.project-page.right <= 428px` in panel-local coordinates.
- `.prompt-page.left >= 548px`.
- The gap is at least `120px`.
- Both surfaces are `400px` high and remain inside the visible parchment.

- [x] **Step 7: Run tests, commit, and push the page-surface version**

```powershell
pnpm test
git add scripts/generate-page-masks.ps1 prototype/desktop-pet-preview/assets/page-mask-left.png prototype/desktop-pet-preview/assets/page-mask-right.png prototype/desktop-pet-preview/index.html prototype/desktop-pet-preview/styles.css tests/desktop-pet-preview.test.mjs
git commit -m "feat: align content to independent book pages"
git push origin main
```

---

### Task 4: Replace Cards With Manuscript Entries And Reliable Actions

**Files:**
- Create: `prototype/desktop-pet-preview/prompt-entry-view.js`
- Modify: `prototype/desktop-pet-preview/index.html`
- Modify: `prototype/desktop-pet-preview/pet-preview.js`
- Modify: `prototype/desktop-pet-preview/styles.css`
- Modify: `tests/desktop-pet-preview.test.mjs`

**Interfaces:**
- Produces: `window.deskPetPromptEntryView.renderPromptEntry(model) -> string`.
- Model: `{ prompt, keywords, ratingOpen, menuOpen, projectOptions }`.
- Produces: event attributes `data-rating-toggle`, `data-rating-value`, `data-prompt-menu-toggle`, `data-delete-prompt-request`, `data-copy-prompt-id`, and `data-prompt-id`.
- Consumes: existing mutation APIs `updatePromptRating`, `togglePromptPinned`, `updatePrompt`, `deletePrompt`, and `copyPrompt`.

- [x] **Step 1: Reproduce and trace both reported failures**

In the current Electron panel, click the fifth star and record whether the renderer click handler receives `data-rating-value="5"`, whether `prompts:updateRating` returns `updated`, and whether the fifth button is clipped by `.rating-row`. Then click the current delete button and record whether the native confirm opens, whether `prompts:delete` is invoked, and whether the row reloads. The expected root-cause report must identify the first failing boundary for each defect before production code changes.

- [x] **Step 2: Add failing pure-renderer tests**

Add `import vm from 'node:vm';`, define the helper below, and assert the rendered contract:

```js
const promptEntryViewPath = new URL('../prototype/desktop-pet-preview/prompt-entry-view.js', import.meta.url);

async function loadPromptEntryView() {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(await readFile(promptEntryViewPath, 'utf8'), context);
  return context.deskPetPromptEntryView;
}
```

Then add:

```js
test('prompt entry keeps rating collapsed until requested and renders five stars', async () => {
  const view = await loadPromptEntryView();
  const collapsed = view.renderPromptEntry({ prompt: { id: 'p1', title: 'A', content: 'B', rating: 4 }, ratingOpen: false, menuOpen: false, keywords: [], projectOptions: [] });
  const expanded = view.renderPromptEntry({ prompt: { id: 'p1', title: 'A', content: 'B', rating: 4 }, ratingOpen: true, menuOpen: false, keywords: [], projectOptions: [] });

  assert.match(collapsed, />评分 4</);
  assert.doesNotMatch(collapsed, /data-rating-value="5"/);
  assert.equal((expanded.match(/data-rating-value=/g) ?? []).length, 5);
  assert.match(expanded, /data-rating-value="5"/);
});
```

Add a second test asserting prompt markup uses `prompt-entry`, a more button, and a delete request, with no `prompt-card` class or always-visible project select.

- [x] **Step 3: Run focused tests and verify RED**

Run: `node --test --test-name-pattern "rating collapsed|manuscript entry" tests/desktop-pet-preview.test.mjs`

Expected: FAIL because the pure renderer does not exist.

- [x] **Step 4: Implement the pure prompt-entry renderer**

Create the complete browser helper below; it exposes one frozen API and escapes all user text:

```js
(() => {
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderPromptEntry(model) {
    const { prompt, ratingOpen = false, menuOpen = false } = model;
    const id = escapeHtml(prompt.id);
    const rating = Math.max(0, Math.min(5, Number(prompt.rating) || 0));
    const keywords = (model.keywords ?? []).slice(0, 3)
      .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
      .join('');
    const ratingControl = ratingOpen
      ? `<div class="rating-picker" role="group" aria-label="设置评分">${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="rating-star${value <= rating ? ' active' : ''}" data-rating-prompt-id="${id}" data-rating-value="${value}" aria-label="评分 ${value}">★</button>`).join('')}</div>`
      : `<button type="button" class="rating-trigger" data-rating-toggle="${id}" aria-expanded="false">${rating ? `评分 ${rating}` : '评分'}</button>`;
    const projectOptions = [
      '<option value="">待归纳</option>',
      ...(model.projectOptions ?? []).map((project) => `<option value="${escapeHtml(project.id)}"${project.selected ? ' selected' : ''}>${escapeHtml(project.name)}</option>`)
    ].join('');
    const menu = menuOpen ? `
      <div class="prompt-more-menu" data-prompt-menu="${id}">
        <button type="button" data-edit-prompt-id="${id}">编辑</button>
        <button type="button" data-pin-prompt-id="${id}">${prompt.pinned ? '取消置顶' : '置顶'}</button>
        <label>项目<select data-project-select-id="${id}">${projectOptions}</select></label>
        <button type="button" class="danger" data-delete-prompt-request="${id}">删除</button>
      </div>` : '';

    return `
      <article class="prompt-entry" data-prompt-id="${id}">
        <header>
          <h3>${escapeHtml(prompt.title)}</h3>
          ${prompt.pinned ? '<span class="prompt-pin" aria-label="已置顶">★</span>' : ''}
          <button type="button" class="prompt-menu-toggle" data-prompt-menu-toggle="${id}" aria-expanded="${menuOpen}">⋯</button>
          ${menu}
        </header>
        <p>${escapeHtml(prompt.content)}</p>
        <footer>
          <div class="keyword-row">${keywords}</div>
          ${ratingControl}
          <button type="button" data-copy-prompt-id="${id}">复制</button>
        </footer>
      </article>`;
  }

  globalThis.deskPetPromptEntryView = Object.freeze({ escapeHtml, renderPromptEntry });
})();
```

- [x] **Step 5: Add the script and delete confirmation dialog to HTML**

Load `prompt-entry-view.js` before `pet-preview.js`. Add a reusable dialog:

```html
<dialog class="confirm-dialog" data-prompt-delete-dialog>
  <form method="dialog" data-prompt-delete-form>
    <h2>删除提示词</h2>
    <p data-prompt-delete-message></p>
    <div class="dialog-actions">
      <button value="cancel" data-prompt-delete-cancel>取消</button>
      <button value="confirm" data-prompt-delete-confirm>永久删除</button>
    </div>
  </form>
</dialog>
```

- [x] **Step 6: Implement explicit UI state and click precedence**

Use:

```js
let openRatingPromptId = null;
let openPromptMenuId = null;
let pendingDeletePromptId = null;
```

Clicking “评分” opens only that row; clicking a star calls `updatePromptRating`, verifies `status === 'updated'`, closes the picker, and reloads. Clicking `⋯` opens only that menu. Clicking delete request stores the prompt id and calls `showModal()` on the custom dialog. Confirm invokes `deletePrompt` without another native `window.confirm`; cancel clears pending state.

Document click closes rating/menu when the click is outside the open control. `Escape` precedence is: delete dialog, project creator, rating picker, prompt menu, editor dialog, then panel close.

- [x] **Step 7: Style manuscript rows and reliable hit targets**

Remove `.prompt-card`, permanent select, and permanent five-star rules. Add:

```css
.prompt-entry { padding: 8px 6px 9px; border-bottom: 1px solid rgba(73,44,18,.22); background: transparent; }
.prompt-entry:hover { background: linear-gradient(90deg, rgba(88,51,19,.08), transparent 88%); }
.rating-picker { display: grid; grid-template-columns: repeat(5, 28px); gap: 3px; width: 152px; }
.rating-star { width: 28px; height: 28px; padding: 0; border: 0; background: transparent; }
.prompt-more-menu { position: absolute; z-index: 12; min-width: 150px; }
```

The fifth star must remain inside the right-page width at all supported scale factors.

- [x] **Step 8: Verify real interactions in browser and Electron**

Browser checks:

- Click “评分”, then the fifth star; button becomes “评分 5”.
- Click `⋯`, choose delete, cancel; row remains.
- Repeat and confirm; row disappears and count updates.
- Clicking controls does not copy the prompt; clicking the entry body does.

Electron checks use persisted real data and verify the same behavior after app restart.

- [x] **Step 9: Run tests, commit, and push the prompt-entry version**

```powershell
pnpm test
git add prototype/desktop-pet-preview/prompt-entry-view.js prototype/desktop-pet-preview/index.html prototype/desktop-pet-preview/pet-preview.js prototype/desktop-pet-preview/styles.css tests/desktop-pet-preview.test.mjs
git commit -m "feat: add manuscript prompt actions"
git push origin main
```

---

### Task 5: Remove Replaced UI And Complete Desktop Acceptance

**Files:**
- Modify: `prototype/desktop-pet-preview/index.html`
- Modify: `prototype/desktop-pet-preview/styles.css`
- Modify: `prototype/desktop-pet-preview/pet-preview.js`
- Modify: `tests/desktop-pet-preview.test.mjs`
- Modify: `tests/electron-pet-shell.test.mjs`
- Modify: `tests/prompt-store.test.mjs`
- Modify: `.codex/agent-context.md`
- Modify: `.codex/development-plan.md`

**Interfaces:**
- Consumes: all completed task contracts.
- Produces: final panel with no legacy inbox/all navigation, card class, permanent rating row, or obsolete IPC.

- [x] **Step 1: Add stale-code assertions before cleanup**

```js
assert.doesNotMatch(html, /data-view="inbox"|data-view="all"/);
assert.doesNotMatch(css, /\.prompt-card|\.rating-row/);
assert.doesNotMatch(js, /listInboxPrompts|listAllPrompts|setSystemBadge\('inbox'/);
assert.doesNotMatch(main, /prompts:listInbox|prompts:listAll|prompts:listProject/);
```

Run the relevant tests and confirm they fail while any old path remains.

- [x] **Step 2: Delete replaced DOM, CSS, JS, IPC, tests, and copy**

Remove all old sidebar/card/inbox logic rather than commenting it out. Update project deletion feedback to “项目已删除，提示词已进入待归纳”. Update cache-busting query strings once after all runtime files are final.

- [x] **Step 3: Run automated verification**

```powershell
node --check prototype/desktop-pet-preview/pet-preview.js
node --check prototype/desktop-pet-preview/prompt-entry-view.js
pnpm test
git diff --check
```

Expected: syntax checks pass, all tests pass, and diff check reports no errors.

- [x] **Step 4: Run visual and interaction acceptance**

At `1280x720` browser viewport and the real `1024x700` Electron panel:

- Capture a screenshot with library view and at least three prompts.
- Confirm left and right surfaces remain inside page masks and the spine is empty.
- Confirm no rectangular sidebar/card backgrounds remain.
- Confirm project create expands to the right of `＋` and cancels with `Esc`.
- Confirm pending filter/count/reminder behavior.
- Confirm rating `5`, prompt delete cancel, and prompt delete confirm.
- Confirm search, copy, pin, project edit, stage filter, sorting, panel drag, close, and double-click capture still work.
- Confirm there are no square transparent-window residues.

Acceptance note (2026-07-14): browser clipboard copy/capture and all listed interactions passed; Electron rating, copy metadata, pin, edit, project/stage, sorting, delete, drag, close, transparency, and restart persistence passed with isolated data. The current Windows session denied all clipboard writes (`Access is denied`), so the final automated Electron double-click clipboard read used the existing IPC/store coverage and prior manual desktop acceptance rather than a successful OS clipboard write in this session.

- [x] **Step 5: Update durable context with verified implementation status**

Change `.codex/agent-context.md` from “old UI pending replacement” to the verified new implementation. Mark the corresponding development-plan acceptance items complete only after automated and visual checks pass.

- [x] **Step 6: Commit and push the final accepted version**

```powershell
git add prototype/desktop-pet-preview src tests .codex/agent-context.md .codex/development-plan.md
git commit -m "feat: complete book page content redesign"
git push origin main
```

- [x] **Step 7: Verify repository and remote state**

Run:

```powershell
git status --short --branch
git log -5 --oneline
```

Expected: `main...origin/main` with a clean working tree and all five staged versions visible in history.
