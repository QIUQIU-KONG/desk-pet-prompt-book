import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { createPromptStore } = require('../src/core/prompt-store.cjs');

async function createTestStore() {
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-'));
  const filePath = path.join(dir, 'prompts.json');
  let nextId = 1;

  return createPromptStore({
    filePath,
    clock: () => '2026-07-10T08:00:00.000Z',
    idGenerator: () => `prompt-${nextId++}`
  });
}

test('captureText saves a prompt with title from the first non-empty line', async () => {
  const store = await createTestStore();

  const result = await store.captureText('\nBuild agents with clarity.\nUse durable context.');

  assert.equal(result.status, 'saved');
  assert.equal(result.prompt.id, 'prompt-1');
  assert.equal(result.prompt.title, 'Build agents with clarity.');
  assert.equal(result.prompt.content, 'Build agents with clarity.\nUse durable context.');
  assert.equal(result.prompt.projectId, null);
  assert.equal(result.prompt.stageId, null);
  assert.equal(result.prompt.rating, 0);
  assert.equal(result.prompt.pinned, false);
  assert.equal(result.prompt.useCount, 0);
});

test('captureText ignores empty clipboard text', async () => {
  const store = await createTestStore();

  const result = await store.captureText(' \n\t ');
  const data = await store.load();

  assert.equal(result.status, 'empty');
  assert.equal(data.prompts.length, 0);
});

test('captureText does not save exact duplicate prompt content', async () => {
  const store = await createTestStore();

  await store.captureText('Same prompt');
  const result = await store.captureText('Same prompt');
  const data = await store.load();

  assert.equal(result.status, 'duplicate');
  assert.equal(result.prompt.title, 'Same prompt');
  assert.equal(data.prompts.length, 1);
});

test('captureText persists prompts to disk', async () => {
  const store = await createTestStore();

  await store.captureText('Persistent prompt');
  const raw = JSON.parse(await readFile(store.filePath, 'utf8'));

  assert.equal(raw.schemaVersion, 1);
  assert.equal(raw.prompts[0].title, 'Persistent prompt');
});

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

test('whenIdle resolves only after queued prompt mutations reach disk', async () => {
  const store = await createTestStore();
  const mutation = store.captureText('Drain this mutation before exit');

  await store.whenIdle();
  const persisted = JSON.parse(await readFile(store.filePath, 'utf8'));

  assert.equal(persisted.prompts[0].content, 'Drain this mutation before exit');
  assert.equal((await mutation).status, 'saved');
});

test('whenIdle reports a queued prompt mutation failure', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-failure-'));
  const blockedParent = path.join(dir, 'not-a-directory');
  await writeFile(blockedParent, 'blocked', 'utf8');
  const store = createPromptStore({
    filePath: path.join(blockedParent, 'prompts.json')
  });

  const mutationError = await store.captureText('This write must fail').then(
    () => assert.fail('The blocked prompt mutation unexpectedly succeeded.'),
    (error) => error
  );

  await assert.rejects(store.whenIdle(), (error) => {
    assert.equal(error, mutationError);
    return true;
  });
});

test('damaged primary storage recovers from backup and quarantines the invalid file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-'));
  const filePath = path.join(dir, 'prompts.json');
  const recoveryEvents = [];
  const store = createPromptStore({
    filePath,
    clock: () => '2026-07-10T08:00:00.000Z',
    idGenerator: () => 'prompt-1'
  });

  await store.captureText('Recover this prompt');
  await writeFile(filePath, '{"schemaVersion":1,"prompts":[', 'utf8');

  const restarted = createPromptStore({
    filePath,
    onRecovery: (event) => recoveryEvents.push(event)
  });
  const data = await restarted.load();
  const restoredPrimary = JSON.parse(await readFile(filePath, 'utf8'));
  const files = await readdir(dir);

  assert.equal(data.prompts[0].content, 'Recover this prompt');
  assert.equal(restoredPrimary.prompts[0].content, 'Recover this prompt');
  assert.equal(files.some((name) => name.startsWith('prompts.json.corrupt-')), true);
  assert.equal(recoveryEvents.length, 1);
  assert.equal(recoveryEvents[0].kind, 'restored_backup');
  assert.equal(recoveryEvents[0].filePath, filePath);
  assert.equal(recoveryEvents[0].backupPath, `${filePath}.bak`);
  assert.equal(Object.hasOwn(recoveryEvents[0], 'content'), false);
});

test('malformed collections and orphan relationships normalize without losing valid prompts', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-'));
  const filePath = path.join(dir, 'prompts.json');
  const rawPrompt = {
    id: 'prompt-1',
    projectId: 'missing-project',
    stageId: 'missing-stage',
    title: 'Valid prompt',
    content: 'Keep this valid content',
    note: '',
    keywordIds: ['missing-keyword'],
    rating: 3,
    pinned: false,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
    lastUsedAt: null,
    useCount: 0
  };

  await writeFile(filePath, `${JSON.stringify({
    schemaVersion: 1,
    prompts: [rawPrompt],
    projects: null,
    stages: 'invalid',
    keywords: null,
    viewState: null
  })}\n`, 'utf8');

  const store = createPromptStore({ filePath });
  const data = await store.load();
  const result = await store.queryPrompts({ query: 'valid content' });

  assert.deepEqual(data.projects, []);
  assert.deepEqual(data.stages, []);
  assert.deepEqual(data.keywords, []);
  assert.equal(data.prompts.length, 1);
  assert.equal(data.prompts[0].projectId, null);
  assert.equal(data.prompts[0].stageId, null);
  assert.deepEqual(data.prompts[0].keywordIds, []);
  assert.deepEqual(result.prompts.map((prompt) => prompt.id), ['prompt-1']);
});

test('pending library query returns unassigned prompts newest first', async () => {
  const store = await createTestStore();

  await store.captureText('First inbox prompt');
  await store.captureText('Second inbox prompt');
  const project = (await store.createProject('Assigned project')).project;
  await store.updatePromptProject('prompt-1', project.id);

  const { prompts } = await store.queryPrompts({
    viewType: 'library',
    pendingOnly: true
  });

  assert.deepEqual(prompts.map((prompt) => prompt.title), ['Second inbox prompt']);
});

test('library query returns every prompt newest first', async () => {
  const store = await createTestStore();

  await store.captureText('First prompt');
  await store.captureText('Second prompt');
  const project = (await store.createProject('Assigned project')).project;
  await store.updatePromptProject('prompt-1', project.id);

  const { prompts } = await store.queryPrompts({ viewType: 'library' });

  assert.deepEqual(prompts.map((prompt) => prompt.title), ['Second prompt', 'First prompt']);
});

test('markPromptUsed records clipboard reuse metadata', async () => {
  let now = '2026-07-10T08:00:00.000Z';
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-'));
  const store = createPromptStore({
    filePath: path.join(dir, 'prompts.json'),
    clock: () => now,
    idGenerator: () => 'prompt-1'
  });

  await store.captureText('Reusable prompt');
  now = '2026-07-10T09:30:00.000Z';
  const result = await store.markPromptUsed('prompt-1');
  const data = await store.load();

  assert.equal(result.status, 'used');
  assert.equal(result.prompt.useCount, 1);
  assert.equal(result.prompt.lastUsedAt, '2026-07-10T09:30:00.000Z');
  assert.equal(data.prompts[0].useCount, 1);
  assert.equal(data.prompts[0].lastUsedAt, '2026-07-10T09:30:00.000Z');
});

test('createProject creates default project stages', async () => {
  const store = await createTestStore();

  const result = await store.createProject('Agent 搭建');
  const projects = await store.listProjects();
  const stages = await store.listStagesForProject(result.project.id);

  assert.equal(result.status, 'created');
  assert.equal(projects[0].name, 'Agent 搭建');
  assert.deepEqual(stages.map((stage) => stage.name), [
    '需求分析',
    '数据分析',
    'Agent 搭建',
    '开发计划',
    '测试验收',
    '项目复盘'
  ]);
});

test('updatePromptProject moves prompts between pending and project views', async () => {
  const store = await createTestStore();

  await store.captureText('Prompt to organize');
  const project = (await store.createProject('项目复盘')).project;
  const moveResult = await store.updatePromptProject('prompt-1', project.id);
  const inbox = (await store.queryPrompts({ viewType: 'library', pendingOnly: true })).prompts;
  const projectPrompts = (await store.queryPrompts({
    viewType: 'project',
    projectId: project.id
  })).prompts;

  assert.equal(moveResult.status, 'updated');
  assert.equal(inbox.length, 0);
  assert.equal(projectPrompts[0].title, 'Prompt to organize');

  await store.updatePromptProject('prompt-1', null);
  assert.equal((await store.queryPrompts({ viewType: 'library', pendingOnly: true })).prompts.length, 1);
});

test('updatePromptRating and togglePromptPinned affect prompt ordering', async () => {
  const store = await createTestStore();

  await store.captureText('Low value prompt');
  await store.captureText('High value prompt');
  await store.updatePromptRating('prompt-1', 5);
  await store.togglePromptPinned('prompt-1');
  const prompts = (await store.queryPrompts({ viewType: 'library' })).prompts;

  assert.deepEqual(prompts.map((prompt) => prompt.title), ['Low value prompt', 'High value prompt']);
  assert.equal(prompts[0].rating, 5);
  assert.equal(prompts[0].pinned, true);
});

test('updatePrompt edits content metadata project stage keywords and searchable keyword labels', async () => {
  const store = await createTestStore();

  await store.captureText('Original title\nOriginal body');
  const project = (await store.createProject('Agent 项目')).project;
  const stage = (await store.listStagesForProject(project.id))[0];
  const result = await store.updatePrompt('prompt-1', {
    title: 'Edited title',
    content: 'Edited body',
    note: '后端 前端',
    projectId: project.id,
    stageId: stage.id,
    keywordNames: ['后端', 'Agent'],
    rating: 4,
    pinned: true
  });
  const searchResult = await store.queryPrompts({ query: 'Agent' });

  assert.equal(result.status, 'updated');
  assert.equal(result.prompt.title, 'Edited title');
  assert.equal(result.prompt.content, 'Edited body');
  assert.equal(result.prompt.note, '后端 前端');
  assert.equal(result.prompt.projectId, project.id);
  assert.equal(result.prompt.stageId, stage.id);
  assert.equal(result.prompt.rating, 4);
  assert.equal(result.prompt.pinned, true);
  assert.deepEqual(result.prompt.keywordNames, ['后端', 'Agent']);
  assert.deepEqual(searchResult.prompts.map((prompt) => prompt.title), ['Edited title']);
});

test('deletePrompt removes prompt from every view without deleting keywords', async () => {
  const store = await createTestStore();

  await store.captureText('Prompt to delete');
  await store.updatePrompt('prompt-1', { keywordNames: ['复盘'] });
  const deleteResult = await store.deletePrompt('prompt-1');
  const data = await store.load();

  assert.equal(deleteResult.status, 'deleted');
  assert.equal((await store.queryPrompts({ viewType: 'library' })).prompts.length, 0);
  assert.equal(data.keywords.length, 1);
  assert.equal(data.keywords[0].name, '复盘');
});

test('project management supports rename pin delete and returns prompts to pending', async () => {
  const store = await createTestStore();

  await store.captureText('Prompt inside project');
  const project = (await store.createProject('旧项目')).project;
  await store.updatePromptProject('prompt-1', project.id);
  const renamed = await store.renameProject(project.id, '新项目');
  const pinned = await store.toggleProjectPinned(project.id);
  const deleted = await store.deleteProject(project.id);
  const inbox = (await store.queryPrompts({ viewType: 'library', pendingOnly: true })).prompts;

  assert.equal(renamed.status, 'updated');
  assert.equal(renamed.project.name, '新项目');
  assert.equal(pinned.status, 'updated');
  assert.equal(pinned.project.pinned, true);
  assert.equal(deleted.status, 'deleted');
  assert.equal((await store.listProjects()).length, 0);
  assert.equal(inbox[0].title, 'Prompt inside project');
  assert.equal(inbox[0].projectId, null);
  assert.equal(inbox[0].stageId, null);
});

test('stage management is scoped per project and hidden stages are excluded from filters', async () => {
  const store = await createTestStore();

  const projectA = (await store.createProject('项目 A')).project;
  const projectB = (await store.createProject('项目 B')).project;
  const created = await store.createStage(projectA.id, '部署发布');
  const renamed = await store.renameStage(created.stage.id, '上线发布');
  const moved = await store.reorderStage(created.stage.id, 0);
  const hidden = await store.hideStage(created.stage.id);
  const stagesA = await store.listStagesForProject(projectA.id);
  const stagesB = await store.listStagesForProject(projectB.id);

  assert.equal(created.status, 'created');
  assert.equal(renamed.stage.name, '上线发布');
  assert.equal(moved.status, 'updated');
  assert.equal(hidden.status, 'updated');
  assert.equal(stagesA.some((stage) => stage.id === created.stage.id), false);
  assert.deepEqual(stagesB.map((stage) => stage.name), [
    '需求分析',
    '数据分析',
    'Agent 搭建',
    '开发计划',
    '测试验收',
    '项目复盘'
  ]);
});

test('queryPrompts defaults to global search but can restrict to current view and sort modes', async () => {
  const store = await createTestStore();

  await store.captureText('Inbox keyword prompt');
  await store.updatePrompt('prompt-1', { note: 'shared-search', rating: 2 });
  await store.captureText('Project keyword prompt');
  await store.updatePrompt('prompt-2', { note: 'shared-search', rating: 5 });
  const project = (await store.createProject('检索项目')).project;
  await store.updatePromptProject('prompt-2', project.id);

  const global = await store.queryPrompts({
    viewType: 'library',
    pendingOnly: true,
    query: 'shared-search',
    currentViewOnly: false,
    sortMode: 'rating'
  });
  const currentOnly = await store.queryPrompts({
    viewType: 'library',
    pendingOnly: true,
    query: 'shared-search',
    currentViewOnly: true,
    sortMode: 'rating'
  });

  assert.deepEqual(global.prompts.map((prompt) => prompt.title), ['Project keyword prompt', 'Inbox keyword prompt']);
  assert.deepEqual(currentOnly.prompts.map((prompt) => prompt.title), ['Inbox keyword prompt']);
});

test('view state persists last view without restoring stale search text', async () => {
  const store = await createTestStore();
  const project = (await store.createProject('状态项目')).project;

  await store.updateViewState({
    lastViewType: 'project',
    lastProjectId: project.id,
    sortMode: 'updated',
    stageFilter: 'stage-1'
  });
  const state = await store.getViewState();

  assert.equal(state.lastViewType, 'project');
  assert.equal(state.lastProjectId, project.id);
  assert.equal(state.sortMode, 'updated');
  assert.equal(state.stageFilter, 'stage-1');
  assert.equal(Object.hasOwn(state, 'searchQuery'), false);
});

test('view state migrates legacy all and inbox views to library state', async () => {
  const store = await createTestStore();
  await store.captureText('Migration seed');
  const data = JSON.parse(await readFile(store.filePath, 'utf8'));

  data.viewState = {
    lastViewType: 'inbox',
    lastProjectId: null,
    sortMode: 'smart',
    stageFilter: null
  };
  await writeFile(store.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const inboxState = await store.getViewState();
  assert.equal(inboxState.lastViewType, 'library');
  assert.equal(inboxState.pendingOnly, true);
  assert.equal(inboxState.currentProjectId, null);

  data.viewState.lastViewType = 'all';
  await writeFile(store.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  const allState = await store.getViewState();
  assert.equal(allState.lastViewType, 'library');
  assert.equal(allState.pendingOnly, false);
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

test('current project is explicit and clears only when that project is deleted', async () => {
  const store = await createTestStore();
  const current = (await store.createProject('Current')).project;
  const other = (await store.createProject('Other')).project;

  await store.updateViewState({
    lastViewType: 'project',
    lastProjectId: other.id,
    currentProjectId: current.id
  });

  const persisted = await store.getViewState();
  assert.equal(persisted.lastProjectId, other.id);
  assert.equal(persisted.currentProjectId, current.id);

  await store.deleteProject(current.id);
  const cleared = await store.getViewState();
  assert.equal(cleared.lastViewType, 'project');
  assert.equal(cleared.lastProjectId, other.id);
  assert.equal(cleared.currentProjectId, null);
});

test('update APIs tolerate empty patch objects from IPC callers', async () => {
  const store = await createTestStore();

  await store.captureText('Stable prompt');
  const promptResult = await store.updatePrompt('prompt-1');
  const stateResult = await store.updateViewState();

  assert.equal(promptResult.status, 'updated');
  assert.equal(promptResult.prompt.title, 'Stable prompt');
  assert.equal(stateResult.status, 'updated');
  assert.equal(stateResult.viewState.lastViewType, 'library');
});

test('changing prompt project through patch clears stale stage when stage is omitted', async () => {
  const store = await createTestStore();

  await store.captureText('Move between projects');
  const projectA = (await store.createProject('项目 A')).project;
  const projectB = (await store.createProject('项目 B')).project;
  const stageA = (await store.listStagesForProject(projectA.id))[0];
  await store.updatePrompt('prompt-1', { projectId: projectA.id, stageId: stageA.id });
  const result = await store.updatePrompt('prompt-1', { projectId: projectB.id });

  assert.equal(result.status, 'updated');
  assert.equal(result.prompt.projectId, projectB.id);
  assert.equal(result.prompt.stageId, null);
});

test('hidden stage is not restored as a persisted view filter', async () => {
  const store = await createTestStore();

  const project = (await store.createProject('阶段项目')).project;
  const stage = (await store.listStagesForProject(project.id))[0];
  await store.updateViewState({
    lastViewType: 'project',
    lastProjectId: project.id,
    stageFilter: stage.id
  });
  await store.hideStage(stage.id);
  const state = await store.getViewState();

  assert.equal(state.lastViewType, 'project');
  assert.equal(state.lastProjectId, project.id);
  assert.equal(state.stageFilter, null);
});

test('captureText preserves a 256 KiB prompt while bounding the generated title', async () => {
  const store = await createTestStore();
  const firstLine = 'A'.repeat(120);
  const content = `${firstLine}\n${'B'.repeat(256 * 1024)}`;

  const result = await store.captureText(content);
  const data = await store.load();

  assert.equal(result.status, 'saved');
  assert.equal(result.prompt.title.length, 80);
  assert.equal(result.prompt.title.endsWith('...'), true);
  assert.equal(data.prompts[0].content, content);
});

test('global search remains responsive across 2000 persisted prompts', async () => {
  const store = await createTestStore();
  const data = await store.load();
  data.prompts = Array.from({ length: 2000 }, (_, index) => ({
    id: `scale-${index}`,
    projectId: null,
    stageId: null,
    title: `Scale prompt ${index}`,
    content: index === 1734 ? 'unique-scale-marker' : `ordinary content ${index}`,
    note: '',
    keywordIds: [],
    rating: index % 6,
    pinned: false,
    createdAt: `2026-07-10T08:${String(index % 60).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-07-10T08:${String(index % 60).padStart(2, '0')}:00.000Z`,
    lastUsedAt: null,
    useCount: 0
  }));
  await store.save(data);

  const startedAt = performance.now();
  const result = await store.queryPrompts({ query: 'unique-scale-marker' });
  const elapsedMs = performance.now() - startedAt;

  assert.deepEqual(result.prompts.map((prompt) => prompt.id), ['scale-1734']);
  assert.ok(elapsedMs < 1000, `Expected search under 1000ms, received ${elapsedMs.toFixed(1)}ms`);
});

test('a reconstructed store preserves the complete prompt workflow state', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desk-pet-store-'));
  const filePath = path.join(dir, 'prompts.json');
  let nextId = 1;
  let now = '2026-07-10T08:00:00.000Z';
  const store = createPromptStore({
    filePath,
    clock: () => now,
    idGenerator: () => `durable-${nextId++}`
  });

  const captured = await store.captureText('Durable prompt\nOriginal body');
  const project = (await store.createProject('Durable project')).project;
  const stage = (await store.listStagesForProject(project.id))[2];
  await store.updatePrompt(captured.prompt.id, {
    title: 'Durable title',
    content: 'Durable body',
    note: 'Durable note',
    projectId: project.id,
    stageId: stage.id,
    keywordNames: ['Agent', '复盘'],
    rating: 5,
    pinned: true
  });
  now = '2026-07-10T09:30:00.000Z';
  await store.markPromptUsed(captured.prompt.id);
  await store.updateViewState({
    lastViewType: 'project',
    lastProjectId: project.id,
    currentProjectId: project.id,
    sortMode: 'rating',
    stageFilter: stage.id
  });

  const restarted = createPromptStore({ filePath });
  const prompt = (await restarted.queryPrompts({ query: 'Durable title' })).prompts[0];
  const restoredProject = (await restarted.listProjects())[0];
  const restoredStages = await restarted.listStagesForProject(project.id);
  const restoredKeywords = await restarted.listKeywords();
  const restoredViewState = await restarted.getViewState();

  assert.equal(prompt.title, 'Durable title');
  assert.equal(prompt.content, 'Durable body');
  assert.equal(prompt.note, 'Durable note');
  assert.deepEqual(prompt.keywordNames, ['Agent', '复盘']);
  assert.equal(prompt.rating, 5);
  assert.equal(prompt.pinned, true);
  assert.equal(prompt.projectId, project.id);
  assert.equal(prompt.stageId, stage.id);
  assert.equal(prompt.useCount, 1);
  assert.equal(prompt.lastUsedAt, '2026-07-10T09:30:00.000Z');
  assert.equal(restoredProject.name, 'Durable project');
  assert.equal(restoredStages.some((item) => item.id === stage.id), true);
  assert.deepEqual(
    new Set(restoredKeywords.map((keyword) => keyword.name)),
    new Set(['Agent', '复盘'])
  );
  assert.equal(restoredViewState.lastProjectId, project.id);
  assert.equal(restoredViewState.currentProjectId, project.id);
  assert.equal(restoredViewState.sortMode, 'rating');
  assert.equal(restoredViewState.stageFilter, stage.id);
});
