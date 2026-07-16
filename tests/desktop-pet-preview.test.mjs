import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const htmlPath = new URL('../src/renderer/index.html', import.meta.url);
const cssPath = new URL('../src/renderer/styles.css', import.meta.url);
const jsPath = new URL('../src/renderer/pet-preview.js', import.meta.url);
const assetPath = new URL('../src/renderer/assets/pet-book-body-v5-alpha.png', import.meta.url);
const panelAssetPath = new URL('../src/renderer/assets/panel-book-ui-v3b-alpha.png', import.meta.url);
const leftMaskPath = new URL('../src/renderer/assets/page-mask-left.png', import.meta.url);
const rightMaskPath = new URL('../src/renderer/assets/page-mask-right.png', import.meta.url);
const safeGlowPath = new URL('../src/renderer/assets/pet-safe-glow-v1.png', import.meta.url);
const safeButterflyPath = new URL('../src/renderer/assets/pet-safe-butterfly-v1.png', import.meta.url);
const promptEntryViewPath = new URL('../src/renderer/prompt-entry-view.js', import.meta.url);

async function readRgbaPng(fileUrl) {
  const bytes = await readFile(fileUrl);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      assert.equal(data[8], 8);
      assert.equal(colorType, 6);
    }

    if (type === 'IDAT') {
      idat.push(data);
    }

    offset += length + 12;
  }

  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = inflated[inputOffset++];
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;

    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = row[x];

      if (filter === 1) value = (value + left) & 0xff;
      if (filter === 2) value = (value + up) & 0xff;
      if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (value + predictor) & 0xff;
      }

      pixels[y * stride + x] = value;
    }
  }

  return {
    width,
    height,
    alphaAt(x, y) {
      return pixels[(y * stride) + (x * 4) + 3];
    }
  };
}

async function loadPromptEntryView() {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(await readFile(promptEntryViewPath, 'utf8'), context);
  return context.deskPetPromptEntryView;
}

test('desktop pet preview references the selected v5 transparent book asset', async () => {
  assert.equal(existsSync(assetPath), true);
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /pet-book-body-v5-alpha\.png/);
  assert.match(html, /class="pet-shell"/);
  assert.match(html, /class="book-body"/);
});

test('desktop pet preview keeps valid readable shell labels', async () => {
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /<title>桌宠魔法书预览<\/title>/);
  assert.match(html, /aria-label="桌宠魔法书预览"/);
  assert.match(html, /aria-label="漂浮魔法书桌宠"/);
  assert.match(html, /alt="漂浮的展开古代魔法书桌宠"/);
});

test('desktop pet preview includes layered magical effects', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(html, /class="page-glow"/);
  assert.match(html, /class="magic-smoke"/);
  assert.match(html, /class="stardust"/);
  assert.match(html, /class="butterflies"/);
  assert.match(html, /class="floating-shadow"/);
  assert.match(css, /@keyframes floatPet/);
  assert.match(css, /@keyframes smokeDrift/);
  assert.match(css, /@keyframes glowPulse/);
});

test('desktop pet preview exposes click and double click feedback states', async () => {
  const js = await readFile(jsPath, 'utf8');

  assert.match(js, /addEventListener\('click'/);
  assert.match(js, /addEventListener\('dblclick'/);
  assert.match(js, /openPetPanel/);
  assert.match(js, /closePetPanel/);
  assert.match(js, /capture-burst/);
  assert.match(js, /captureClipboardPrompt/);
  assert.match(js, /已经收过啦/);
});

test('desktop pet preview supports dragging the electron pet window', async () => {
  const js = await readFile(jsPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(js, /pointerdown/);
  assert.match(js, /pointermove/);
  assert.match(js, /startPetWindowDrag/);
  assert.match(js, /stopPetWindowDrag/);
  assert.match(js, /offsetX/);
  assert.match(js, /offsetY/);
  assert.match(js, /event\.clientX/);
  assert.match(js, /dragDistance/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /user-select:\s*none/);
});

test('desktop pet preview includes the safe-margin book UI panel surface', async () => {
  assert.equal(existsSync(panelAssetPath), true);
  const html = await readFile(htmlPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(html, /styles\.css\?v=20260714-final-content/);
  assert.match(html, /panel-book-ui-v3b-alpha\.png/);
  assert.match(html, /class="panel-shell"/);
  assert.match(html, /class="panel-drag-zone"/);
  assert.match(html, /class="panel-close"/);
  assert.match(html, /class="[^"]*project-rail/);
  assert.match(html, /class="panel-search"/);
  assert.match(html, /class="prompt-list"/);
  assert.match(css, /\.panel-shell/);
  assert.match(css, /width:\s*1024px/);
  assert.match(css, /height:\s*700px/);
  assert.match(css, /panel-book-ui-v3b-alpha\.png/);
});

test('desktop pet panel art keeps safe transparent margins around the book', async () => {
  const panel = await readRgbaPng(panelAssetPath);

  assert.equal(panel.width, 2048);
  assert.equal(panel.height, 1152);
  assert.equal(panel.alphaAt(0, 0), 0);
  assert.equal(panel.alphaAt(panel.width - 1, 0), 0);
  assert.equal(panel.alphaAt(1024, 40), 0);
  assert.equal(panel.alphaAt(1024, 1110), 0);
  assert.ok(panel.alphaAt(410, 274) > 220);
  assert.ok(panel.alphaAt(1024, 114) > 220);
  assert.ok(panel.alphaAt(1450, 304) > 220);
  assert.ok(panel.alphaAt(1840, 524) > 220);
});

test('book pages use independent masked safe areas', async () => {
  const css = await readFile(cssPath, 'utf8');

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
  assert.match(css, /--left-page-x:\s*168px/);
  assert.match(css, /--right-page-x:\s*548px/);
  assert.match(css, /--spine-gap:\s*120px/);
  assert.doesNotMatch(css, /grid-template-columns:\s*176px/);
});

test('desktop pet preview opens and closes the electron panel window', async () => {
  const js = await readFile(jsPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(js, /openPetPanel/);
  assert.match(js, /closePetPanel/);
  assert.match(js, /window\.deskPet\.openPetPanel/);
  assert.match(js, /window\.deskPet\.closePetPanel/);
  assert.match(js, /isPanelOpen/);
  assert.match(css, /body\.panel-open/);
  assert.match(css, /transition:\s*opacity 220ms/);
});

test('desktop pet panel exposes one prompt library and a pending filter', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /data-view="library"/);
  assert.match(html, /data-pending-toggle/);
  assert.match(html, /记得归纳清理哟~/);
  assert.doesNotMatch(html, /data-view="inbox"|data-view="all"/);
  assert.match(js, /let activeView\s*=\s*'library'/);
  assert.match(js, /let pendingOnly\s*=\s*false/);
  assert.match(js, /setPendingFilter/);
});

test('project creation expands beside the directory title and can be cancelled', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /class="project-title-row"/);
  assert.match(html, /data-project-create-toggle/);
  assert.match(html, /data-project-create-form/);
  assert.match(html, /data-project-create-cancel/);
  assert.match(js, /function openProjectCreator/);
  assert.match(js, /function closeProjectCreator/);
  assert.match(js, /function isProjectCreatorOpen/);
  assert.match(js, /createProjectInput\.addEventListener\('keydown',[\s\S]*?event\.key === 'Enter'[\s\S]*?createProjectFromInput/);
});

test('selected and current projects remain independent renderer states', async () => {
  const js = await readFile(jsPath, 'utf8');

  assert.match(js, /let currentProjectId\s*=\s*null/);
  assert.match(js, /data-project-action="current"/);
  assert.match(js, /updateViewState\(\{[\s\S]*?currentProjectId[,:]/);
  assert.match(js, /currentProjectId\s*=\s*currentProjectId === projectId \? null : projectId/);
});

test('prompt entry keeps rating collapsed until requested and renders five stars', async () => {
  const view = await loadPromptEntryView();
  const prompt = { id: 'p1', title: 'A', content: 'B', rating: 4 };
  const collapsed = view.renderPromptEntry({
    prompt,
    ratingOpen: false,
    menuOpen: false,
    keywords: [],
    projectOptions: []
  });
  const expanded = view.renderPromptEntry({
    prompt,
    ratingOpen: true,
    menuOpen: false,
    keywords: [],
    projectOptions: []
  });

  assert.match(collapsed, />评分 4</);
  assert.doesNotMatch(collapsed, /data-rating-value="5"/);
  assert.equal((expanded.match(/data-rating-value=/g) ?? []).length, 5);
  assert.match(expanded, /data-rating-value="5"/);
});

test('manuscript prompt entry hides project and delete actions in its more menu', async () => {
  const view = await loadPromptEntryView();
  const model = {
    prompt: { id: 'p1', title: '<Title>', content: 'Body & more', rating: 0, pinned: false },
    ratingOpen: false,
    keywords: ['Agent'],
    projectOptions: [{ id: 'project-1', name: 'Build', selected: true }]
  };
  const closed = view.renderPromptEntry({ ...model, menuOpen: false });
  const open = view.renderPromptEntry({ ...model, menuOpen: true });

  assert.match(closed, /class="prompt-entry"/);
  assert.match(closed, /data-prompt-menu-toggle="p1"/);
  assert.doesNotMatch(closed, /data-delete-prompt-request/);
  assert.match(open, /data-delete-prompt-request="p1"/);
  assert.match(open, /data-project-select-id="p1"/);
  assert.doesNotMatch(open, /prompt-card/);
  assert.match(open, /&lt;Title&gt;/);
  assert.match(open, /Body &amp; more/);
});

test('prompt actions use explicit rating menu state and a reusable delete dialog', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /data-prompt-delete-dialog/);
  assert.match(html, /data-prompt-delete-confirm/);
  assert.match(html, /data-prompt-delete-cancel/);
  assert.match(html, /prompt-entry-view\.js[\s\S]*?pet-preview\.js/);
  assert.match(js, /let openRatingPromptId\s*=\s*null/);
  assert.match(js, /let openPromptMenuId\s*=\s*null/);
  assert.match(js, /let pendingDeletePromptId\s*=\s*null/);
  assert.match(js, /promptDeleteDialog\.showModal\(\)/);
  assert.match(js, /deletePrompt\(pendingDeletePromptId\)/);
  assert.match(html, /data-text-action-dialog/);
  assert.match(html, /data-confirm-action-dialog/);
  assert.match(js, /let pendingTextAction\s*=\s*null/);
  assert.match(js, /let pendingConfirmAction\s*=\s*null/);
  assert.match(js, /requestTextAction/);
  assert.match(js, /requestConfirmAction/);
  assert.doesNotMatch(js, /globalThis\.prompt|window\.confirm/);
});

test('desktop pet preview loads prompts through the unified query contract and copies entries', async () => {
  const js = await readFile(jsPath, 'utf8');
  const html = await readFile(htmlPath, 'utf8');
  const entryView = await readFile(promptEntryViewPath, 'utf8');

  assert.match(js, /loadPromptsForView/);
  assert.match(js, /renderPromptEntries/);
  assert.match(js, /window\.deskPet\.queryPrompts/);
  assert.match(js, /window\.deskPet\.getPromptCounts/);
  assert.match(js, /pendingOnly,\s*\n/);
  assert.doesNotMatch(js, /listInboxPrompts|listAllPrompts|listProjectPrompts/);
  assert.match(js, /window\.deskPet\.listProjects/);
  assert.match(js, /window\.deskPet\.listStagesForProject/);
  assert.match(js, /window\.deskPet\.createProject/);
  assert.match(js, /window\.deskPet\.updatePromptProject/);
  assert.match(js, /window\.deskPet\.togglePromptPinned/);
  assert.match(js, /window\.deskPet\.updatePromptRating/);
  assert.match(js, /window\.deskPet\.copyPrompt/);
  assert.match(html, /class="panel-feedback"/);
  assert.match(html, /class="create-project-form"/);
  assert.match(js, /panelFeedback/);
  assert.doesNotMatch(js, /window\.prompt/);
  assert.match(js, /filterPrompts/);
  assert.match(js, /setActiveView/);
  assert.match(js, /currentViewOnly/);
  assert.match(js, /searchInput\.addEventListener\('input', \(\) => \{[\s\S]*?loadPromptsForView\(activeView\)/);
  assert.match(html, /data-view="library"/);
  assert.match(html, /data-pending-toggle/);
  assert.match(entryView, /prompt-entry[\s\S]*?data-prompt-id/);
  assert.match(js, /data-project-id/);
  assert.match(js, /data-stage-id/);
  assert.match(entryView, /data-pin-prompt-id/);
  assert.match(entryView, /data-rating-prompt-id/);
  assert.match(entryView, /data-project-select-id/);
  assert.match(js, /cycleSortMode/);
  assert.match(js, /复制成功/);
  assert.doesNotMatch(js, /prompt-card|rating-row/);
  assert.doesNotMatch(html, /<article class="prompt-card">/);
});

test('desktop pet panel paginates manuscript entries three at a time', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /class="prompt-pagination"/);
  assert.match(html, /data-prompt-page="previous"/);
  assert.match(html, /data-prompt-page="next"/);
  assert.match(html, /data-prompt-page-status[^>]*aria-live="polite"/);
  assert.match(html, /prompt-pagination\.js[\s\S]*?pet-preview\.js/);
  assert.match(js, /const promptPagination = window\.deskPetPromptPagination/);
  assert.match(js, /let currentPromptPage\s*=\s*1/);
  assert.match(js, /promptPagination\.paginate\(visiblePrompts, currentPromptPage\)/);
  assert.match(js, /pageState\.items\.map/);
  assert.match(js, /promptPageStatus\.textContent/);
  assert.match(js, /pageState\.hasPrevious/);
  assert.match(js, /pageState\.hasNext/);
  assert.match(js, /changePromptPage\('backward'\)/);
  assert.match(js, /changePromptPage\('forward'\)/);
  assert.match(js, /resetPromptPage/);
  assert.match(js, /searchInput\.addEventListener\('input',[\s\S]*?resetPromptPage\(\)/);
  assert.match(js, /contentEditable:\s*Boolean\(target\?\.isContentEditable\)/);
});

test('desktop pet panel exposes real edit delete project stage keyword and scoped-search controls', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');
  const entryView = await readFile(promptEntryViewPath, 'utf8');

  assert.match(html, /class="search-scope-toggle"/);
  assert.match(html, /class="prompt-edit-modal"/);
  assert.match(html, /name="promptTitle"/);
  assert.match(html, /name="promptContent"/);
  assert.match(html, /name="promptNote"/);
  assert.match(html, /name="promptKeywords"/);
  assert.match(html, /name="promptRating"/);
  assert.match(html, /name="promptPinned"/);
  assert.match(js, /window\.deskPet\.queryPrompts/);
  assert.match(js, /window\.deskPet\.updatePrompt/);
  assert.match(js, /window\.deskPet\.deletePrompt/);
  assert.match(js, /window\.deskPet\.renameProject/);
  assert.match(js, /window\.deskPet\.toggleProjectPinned/);
  assert.match(js, /window\.deskPet\.deleteProject/);
  assert.match(js, /window\.deskPet\.createStage/);
  assert.match(js, /window\.deskPet\.renameStage/);
  assert.match(js, /window\.deskPet\.hideStage/);
  assert.match(js, /window\.deskPet\.reorderStage/);
  assert.match(js, /window\.deskPet\.listKeywords/);
  assert.match(js, /window\.deskPet\.getViewState/);
  assert.match(js, /window\.deskPet\.updateViewState/);
  assert.match(js, /openPromptEditor/);
  assert.match(js, /savePromptEditor/);
  assert.match(js, /data-confirm-action|requestConfirmAction/);
  assert.doesNotMatch(js, /globalThis\.prompt|window\.confirm/);
  assert.match(js, /currentViewOnly/);
  assert.match(js, /keywordNames/);
  assert.match(entryView, /data-edit-prompt-id/);
  assert.match(entryView, /data-delete-prompt-request/);
  assert.match(js, /data-project-action/);
  assert.match(js, /data-stage-action/);
  assert.match(js, /data-stage-direction/);
});

test('desktop pet panel keeps creation, pending hint, and rating controls tactile', async () => {
  const css = await readFile(cssPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(css, /\.rating-picker[\s\S]*?grid-template-columns:\s*repeat\(5,\s*28px\)/);
  assert.match(css, /\.rating-star[\s\S]*?width:\s*28px/);
  assert.match(css, /\.rating-star[\s\S]*?height:\s*28px/);
  assert.doesNotMatch(css, /\.prompt-entry:last-child \.prompt-more-menu/);
  assert.match(css, /\.panel-feedback[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.stage-pills[\s\S]*?overflow-x:\s*auto/);
  assert.match(js, /stageList\.scrollLeft\s*=\s*stageList\.scrollWidth/);
});

test('desktop pet panel places prompt menus by page geometry and animates directional turns', async () => {
  const css = await readFile(cssPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(js, /function positionOpenPromptMenu\(\)/);
  assert.match(js, /promptList\.getBoundingClientRect\(\)/);
  assert.match(js, /menu\.getBoundingClientRect\(\)/);
  assert.match(js, /menu\.scrollHeight/);
  assert.match(js, /promptPagination\.resolveMenuPlacement/);
  assert.match(js, /classList\.toggle\('opens-upward'/);
  assert.match(js, /classList\.toggle\('is-constrained'/);
  assert.match(css, /\.prompt-more-menu\.opens-upward[\s\S]*?bottom:\s*27px/);
  assert.match(css, /\.prompt-more-menu\.is-constrained[\s\S]*?overflow-y:\s*auto/);

  assert.match(js, /let promptPageRenderRevision\s*=\s*0/);
  assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.ok((js.match(/promptList\.animate\(/g) ?? []).length >= 2);
  assert.ok((js.match(/duration:\s*90/g) ?? []).length >= 2);
  assert.match(css, /\.panel-main[\s\S]*?grid-template-rows:\s*auto auto auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.prompt-list[\s\S]*?overflow-y:\s*hidden/);
  assert.match(css, /\.prompt-pagination\s*\{/);
});

test('desktop pet panel keeps the cleanup reminder beside its pending filter', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(html, /data-pending-note[^>]*>记得归纳清理哟~</);
  assert.doesNotMatch(html, /class="rail-label"/);
  assert.doesNotMatch(js, /还没有项目/);
  assert.match(html, /搜索范围/);
  assert.match(html, /全局/);
  assert.match(html, /当前页/);
});

test('desktop pet panel removes replaced UI paths and cache-busts final runtime assets', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.doesNotMatch(html, /data-view="inbox"|data-view="all"/);
  assert.doesNotMatch(css, /\.prompt-card|\.rating-row/);
  assert.doesNotMatch(js, /listInboxPrompts|listAllPrompts|setSystemBadge\('inbox'/);
  assert.match(html, /styles\.css\?v=20260714-final-content/);
  assert.match(html, /prompt-entry-view\.js\?v=20260714-final-content/);
  assert.match(html, /pet-preview\.js\?v=20260714-final-content/);
});

test('browser preview editor updates its prompt model instead of faking success', async () => {
  const js = await readFile(jsPath, 'utf8');

  assert.match(js, /id: 'preview-3'/);
  assert.match(js, /function updatePreviewPrompt\(promptId, patch\)/);
  assert.match(js, /const patch = \{[\s\S]*?keywordNames:[\s\S]*?pinned:/);
  assert.match(js, /updatePreviewPrompt\(promptId, patch\)/);
  assert.match(js, /navigator\.clipboard\.writeText\(prompt\.content\)/);
  assert.match(js, /navigator\.clipboard\.readText\(\)/);
  assert.match(js, /previewPrompts\.unshift\(prompt\)/);
});

test('desktop pet preview overlays the pet and panel in the same viewport cell', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /\.pet-shell,\s*\.panel-shell/);
  assert.match(css, /grid-area:\s*1\s*\/\s*1/);
});

test('desktop pet panel fits inside the fixed electron panel window', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /body\.electron-shell\.panel-open \.preview-stage/);
  assert.match(css, /body\.electron-shell\.panel-open \.preview-stage[\s\S]*?padding:\s*0/);
  assert.match(css, /\.panel-bg[\s\S]*?inset:\s*0/);
  assert.match(css, /\.panel-bg[\s\S]*?width:\s*100%/);
  assert.match(css, /\.panel-bg[\s\S]*?height:\s*100%/);
  assert.doesNotMatch(html, /class="panel-drag-zone" title=/);
});

test('desktop pet panel positions both content surfaces inside independent page bounds', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /\.panel-content[\s\S]*?width:\s*1024px/);
  assert.match(css, /\.panel-content[\s\S]*?height:\s*576px/);
  assert.match(css, /\.panel-content[\s\S]*?--page-height:\s*400px/);
  assert.match(css, /\.panel-content[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.project-rail,\s*\.panel-main[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.project-rail,\s*\.panel-main[\s\S]*?height:\s*var\(--page-height\)/);
  assert.match(css, /\.project-rail\s*\{[\s\S]*?left:\s*var\(--left-page-x\)/);
  assert.match(css, /\.project-rail\s*\{[\s\S]*?width:\s*var\(--left-page-width\)/);
  assert.match(css, /\.project-rail\s*\{[\s\S]*?page-mask-left\.png/);
  assert.match(css, /\.panel-main\s*\{[\s\S]*?left:\s*var\(--right-page-x\)/);
  assert.match(css, /\.panel-main\s*\{[\s\S]*?width:\s*var\(--right-page-width\)/);
  assert.match(css, /\.panel-main\s*\{[\s\S]*?page-mask-right\.png/);
  assert.match(css, /\.panel-main\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.project-rail\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.project-list[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.project-list[\s\S]*?max-height:\s*none/);
  assert.match(css, /\.prompt-list[\s\S]*?height:\s*100%/);
  assert.match(css, /\.prompt-list[\s\S]*?min-height:\s*0/);
  assert.doesNotMatch(css, /\.prompt-list[\s\S]*?max-height:\s*300px/);
  assert.match(css, /\.prompt-list[\s\S]*?overflow-y:\s*hidden/);
  assert.match(css, /\.panel-close[\s\S]*?right:\s*138px/);
  assert.match(css, /\.panel-close[\s\S]*?top:\s*88px/);
});

test('desktop pet panel only drags from the central drag zone', async () => {
  const js = await readFile(jsPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.match(js, /panelDragZone\.addEventListener\('pointerdown'/);
  assert.doesNotMatch(js, /panelShell\.addEventListener\('pointerdown'/);
  assert.match(css, /\.panel-drag-zone[\s\S]*?left:\s*390px/);
  assert.match(css, /\.panel-drag-zone[\s\S]*?width:\s*244px/);
});

test('desktop pet panel keeps sort away from the close control', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const toolbarIndex = html.indexOf('class="panel-toolbar"');
  const stageIndex = html.indexOf('class="stage-row"');
  const sortIndex = html.indexOf('class="sort-button"');

  assert.ok(toolbarIndex > -1);
  assert.ok(stageIndex > -1);
  assert.ok(sortIndex > stageIndex);
});

test('desktop pet panel lets the book art act as the outer frame', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /\.project-rail,\s*\.panel-main[\s\S]*?border:\s*0/);
  assert.match(css, /\.project-rail,\s*\.panel-main[\s\S]*?box-shadow:\s*none/);
});

test('desktop pet preview supports an electron transparent shell mode', async () => {
  const css = await readFile(cssPath, 'utf8');
  const js = await readFile(jsPath, 'utf8');

  assert.match(js, /shell=electron/);
  assert.match(js, /electron-shell/);
  assert.match(js, /document\.documentElement\.classList\.add\('electron-shell'\)/);
  assert.match(css, /html\.electron-shell/);
  assert.match(css, /body\.electron-shell/);
  assert.match(css, /body\.electron-shell \.preview-stage/);
  assert.match(css, /background:\s*transparent/);
});

test('desktop pet preview avoids square compositing artifacts in electron mode', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /body\.electron-shell \.page-glow/);
  assert.match(css, /body\.electron-shell \.magic-smoke/);
  assert.match(css, /mix-blend-mode:\s*normal/);
  assert.match(css, /body\.electron-shell \.pet-shell/);
  assert.match(css, /filter:\s*none/);
  assert.match(css, /body\.electron-shell \.floating-shadow/);
  assert.match(css, /display:\s*none/);
});

test('electron shell uses transparent raster glow and butterfly layers without unsafe compositing', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const css = await readFile(cssPath, 'utf8');

  assert.equal(existsSync(safeGlowPath), true);
  assert.equal(existsSync(safeButterflyPath), true);
  assert.match(html, /class="electron-safe-glow"[\s\S]*?pet-safe-glow-v1\.png/);
  assert.match(html, /class="electron-safe-butterflies"/);
  assert.ok((html.match(/class="electron-safe-butterfly/g) ?? []).length >= 3);
  assert.match(html, /pet-safe-butterfly-v1\.png/);
  assert.match(css, /\/\* Electron-safe effects \*\/[\s\S]*?\/\* End Electron-safe effects \*\//);

  const safeCss = css.match(/\/\* Electron-safe effects \*\/([\s\S]*?)\/\* End Electron-safe effects \*\//)?.[1] ?? '';
  assert.doesNotMatch(safeCss, /(?:^|[;{]\s*)(?:filter|backdrop-filter|box-shadow|mix-blend-mode)\s*:/m);
  assert.match(css, /\.magic-smoke span:nth-child\(2\)\s*\{[^}]*?opacity:\s*0\.42/);
  assert.match(safeCss, /\.electron-safe-glow\s*\{[^}]*?opacity:\s*0\.52/);
  assert.match(safeCss, /body\.electron-shell \.butterflies[\s\S]*?display:\s*none/);
  assert.match(safeCss, /body\.electron-shell \.electron-safe-glow[\s\S]*?display:\s*block/);
  assert.match(safeCss, /body\.electron-shell \.electron-safe-butterflies[\s\S]*?display:\s*block/);
  assert.match(safeCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none/);

  const glow = await readRgbaPng(safeGlowPath);
  assert.equal(glow.width, 1600);
  assert.equal(glow.height, 1600);
  assert.equal(glow.alphaAt(0, 0), 0);
  assert.ok(glow.alphaAt(800, 900) > 0);

  const butterfly = await readRgbaPng(safeButterflyPath);
  assert.equal(butterfly.width, 512);
  assert.equal(butterfly.height, 512);
  assert.equal(butterfly.alphaAt(0, 0), 0);
  assert.ok(butterfly.alphaAt(256, 256) > 0);
});

test('desktop pet preview keeps electron feedback compact for a tiny pet', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(css, /body\.electron-shell \.feedback-label/);
  assert.match(css, /min-width:\s*118px/);
  assert.match(css, /font-size:\s*10px/);
});
