import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const scriptPath = new URL('../src/renderer/prompt-pagination.js', import.meta.url);

async function loadPagination() {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(await readFile(scriptPath, 'utf8'), context);
  return context.deskPetPromptPagination;
}

test('paginate returns stable three-item pages and clamps invalid requests', async () => {
  const pagination = await loadPagination();
  const prompts = ['a', 'b', 'c', 'd'];

  const first = pagination.paginate(prompts, 1);
  const second = pagination.paginate(prompts, 2);
  const clamped = pagination.paginate(['only'], 99);

  assert.equal(pagination.PROMPTS_PER_PAGE, 3);
  assert.deepEqual([...first.items], ['a', 'b', 'c']);
  assert.equal(first.page, 1);
  assert.equal(first.totalPages, 2);
  assert.equal(first.hasPrevious, false);
  assert.equal(first.hasNext, true);
  assert.deepEqual([...second.items], ['d']);
  assert.equal(second.hasPrevious, true);
  assert.equal(second.hasNext, false);
  assert.equal(clamped.page, 1);
  assert.deepEqual(prompts, ['a', 'b', 'c', 'd']);
});

test('paginate represents an empty result as page zero', async () => {
  const pagination = await loadPagination();
  const page = pagination.paginate([], 1);

  assert.equal(page.page, 0);
  assert.equal(page.totalPages, 0);
  assert.equal(page.totalItems, 0);
  assert.deepEqual([...page.items], []);
  assert.equal(page.hasPrevious, false);
  assert.equal(page.hasNext, false);
});

test('move and keyboard direction stay within valid non-editing navigation', async () => {
  const pagination = await loadPagination();
  const middle = pagination.paginate(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 2);

  assert.equal(pagination.move(middle, 'backward'), 1);
  assert.equal(pagination.move(middle, 'forward'), 3);
  assert.equal(pagination.move(pagination.paginate(['a'], 1), 'forward'), 1);
  assert.equal(pagination.directionForKey({ key: 'ArrowRight', panelOpen: true }), 'forward');
  assert.equal(pagination.directionForKey({ key: 'ArrowLeft', panelOpen: true }), 'backward');
  assert.equal(pagination.directionForKey({ key: 'ArrowRight', panelOpen: false }), null);
  assert.equal(pagination.directionForKey({ key: 'ArrowRight', panelOpen: true, targetTagName: 'INPUT' }), null);
  assert.equal(pagination.directionForKey({ key: 'ArrowLeft', panelOpen: true, targetTagName: 'BUTTON' }), null);
  assert.equal(pagination.directionForKey({ key: 'ArrowRight', panelOpen: true, contentEditable: true }), null);
  assert.equal(pagination.directionForKey({ key: 'ArrowRight', panelOpen: true, dialogOpen: true }), null);
});

test('menu placement opens toward available space and constrains tight layouts', async () => {
  const pagination = await loadPagination();

  assert.deepEqual(
    { ...pagination.resolveMenuPlacement({ menuHeight: 130, spaceAbove: 20, spaceBelow: 220 }) },
    { direction: 'down', constrained: false, maxHeight: null }
  );
  assert.deepEqual(
    { ...pagination.resolveMenuPlacement({ menuHeight: 130, spaceAbove: 220, spaceBelow: 20 }) },
    { direction: 'up', constrained: false, maxHeight: null }
  );
  assert.deepEqual(
    { ...pagination.resolveMenuPlacement({ menuHeight: 130, spaceAbove: 80, spaceBelow: 50 }) },
    { direction: 'up', constrained: true, maxHeight: 74 }
  );
});
