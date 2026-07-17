const { copyFile, mkdir, readFile, rename, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const DEFAULT_VIEW_STATE = {
  lastViewType: 'library',
  lastProjectId: null,
  currentProjectId: null,
  pendingOnly: false,
  sortMode: 'smart',
  stageFilter: null
};

const DEFAULT_STAGE_NAMES = [
  '需求分析',
  '数据分析',
  'Agent 搭建',
  '开发计划',
  '测试验收',
  '项目复盘'
];

function normalizeViewState(rawState = {}) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const legacyViewType = source.lastViewType;
  const lastViewType = legacyViewType === 'project' ? 'project' : 'library';
  const pendingOnly = legacyViewType === 'inbox'
    ? true
    : Boolean(source.pendingOnly);

  return {
    ...DEFAULT_VIEW_STATE,
    ...source,
    lastViewType,
    lastProjectId: source.lastProjectId || null,
    currentProjectId: source.currentProjectId || null,
    pendingOnly,
    stageFilter: source.stageFilter || null
  };
}

function createInitialData() {
  return {
    schemaVersion: 1,
    prompts: [],
    projects: [],
    stages: [],
    keywords: [],
    viewState: { ...DEFAULT_VIEW_STATE }
  };
}

function normalizeContent(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function titleFromContent(content) {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return '未命名提示词';
  }

  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function timestampForPrompt(prompt) {
  return prompt.lastUsedAt || prompt.updatedAt || prompt.createdAt || '';
}

function sortPrompts(prompts, sortMode = 'smart') {
  return [...prompts].sort((left, right) => {
    if (sortMode === 'rating') {
      return Number(right.rating || 0) - Number(left.rating || 0) || timestampForPrompt(right).localeCompare(timestampForPrompt(left));
    }

    if (sortMode === 'used') {
      return String(right.lastUsedAt || '').localeCompare(String(left.lastUsedAt || '')) || timestampForPrompt(right).localeCompare(timestampForPrompt(left));
    }

    if (sortMode === 'updated') {
      return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    }

    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }

    const ratingDelta = Number(right.rating || 0) - Number(left.rating || 0);
    if (ratingDelta !== 0) {
      return ratingDelta;
    }

    return timestampForPrompt(right).localeCompare(timestampForPrompt(left));
  });
}

function sortProjects(projects) {
  return [...projects].sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }

    return String(left.name).localeCompare(String(right.name), 'zh-Hans-CN');
  });
}

function clampRating(value) {
  const rating = Number(value);

  if (!Number.isFinite(rating)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(rating)));
}

function uniqueTrimmed(values) {
  const seen = new Set();
  const result = [];

  for (const value of values ?? []) {
    const trimmed = String(value ?? '').trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function decoratePrompt(data, prompt) {
  const keywordNames = (prompt.keywordIds ?? [])
    .map((keywordId) => data.keywords.find((keyword) => keyword.id === keywordId)?.name)
    .filter(Boolean);

  return {
    ...prompt,
    keywordNames
  };
}

function promptMatchesQuery(prompt, query) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    prompt.title,
    prompt.content,
    prompt.note,
    ...(prompt.keywordNames ?? [])
  ].join('\n').toLowerCase();

  return haystack.includes(normalizedQuery);
}

function filterPromptsForView(prompts, viewType, projectId, pendingOnly = false) {
  const viewedPrompts = viewType === 'project'
    ? prompts.filter((prompt) => prompt.projectId === projectId)
    : prompts;

  return pendingOnly
    ? viewedPrompts.filter((prompt) => prompt.projectId === null)
    : viewedPrompts;
}

function normalizeStageOrder(stages, projectId) {
  stages
    .filter((stage) => stage.projectId === projectId)
    .sort((left, right) => left.order - right.order)
    .forEach((stage, index) => {
      stage.order = index;
    });
}

function normalizeStoredData(rawData) {
  const source = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? rawData
    : {};
  const projects = (Array.isArray(source.projects) ? source.projects : [])
    .filter((project) => project && typeof project === 'object' && project.id);
  const projectIds = new Set(projects.map((project) => project.id));
  const stages = (Array.isArray(source.stages) ? source.stages : [])
    .filter((stage) => stage && typeof stage === 'object' && stage.id && projectIds.has(stage.projectId));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const keywords = (Array.isArray(source.keywords) ? source.keywords : [])
    .filter((keyword) => keyword && typeof keyword === 'object' && keyword.id);
  const keywordIds = new Set(keywords.map((keyword) => keyword.id));
  const prompts = (Array.isArray(source.prompts) ? source.prompts : [])
    .filter((prompt) => prompt && typeof prompt === 'object' && prompt.id)
    .map((prompt) => {
      const projectId = projectIds.has(prompt.projectId) ? prompt.projectId : null;
      const stage = stageById.get(prompt.stageId);
      const stageId = projectId && stage?.projectId === projectId ? stage.id : null;

      return {
        ...prompt,
        projectId,
        stageId,
        keywordIds: (Array.isArray(prompt.keywordIds) ? prompt.keywordIds : [])
          .filter((keywordId) => keywordIds.has(keywordId))
      };
    });

  return {
    ...createInitialData(),
    ...source,
    prompts,
    projects,
    stages,
    keywords,
    viewState: normalizeViewState(source.viewState)
  };
}

function createPromptStore(options) {
  const filePath = options.filePath;
  const backupPath = `${filePath}.bak`;
  const clock = options.clock ?? (() => new Date().toISOString());
  const idGenerator = options.idGenerator ?? (() => randomUUID());
  const onRecovery = typeof options.onRecovery === 'function' ? options.onRecovery : null;
  let mutationQueue = Promise.resolve();
  let mutationFailure = null;

  function queued(operation) {
    return (...args) => {
      const result = mutationQueue.then(() => operation(...args));
      mutationQueue = result.then(
        () => undefined,
        (reason) => {
          mutationFailure ??= { reason };
        }
      );
      return result;
    };
  }

  function whenIdle() {
    return mutationQueue.then(() => {
      if (mutationFailure) {
        throw mutationFailure.reason;
      }
    });
  }

  function reportRecovery(event) {
    if (!onRecovery) {
      return;
    }

    try {
      onRecovery(event);
    } catch {
      // Recovery must not fail because diagnostics could not be recorded.
    }
  }

  async function readStoredData(dataPath) {
    return normalizeStoredData(JSON.parse(await readFile(dataPath, 'utf8')));
  }

  async function quarantine(dataPath) {
    const corruptPath = `${dataPath}.corrupt-${Date.now()}-${randomUUID().slice(0, 8)}`;

    try {
      await rename(dataPath, corruptPath);
      return corruptPath;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async function restoreBackup({ corruptPath = null, reason, emptyWhenMissing = false }) {
    let data;

    try {
      data = await readStoredData(backupPath);
    } catch (backupError) {
      if (backupError.code === 'ENOENT' && emptyWhenMissing) {
        return createInitialData();
      }

      const corruptBackupPath = backupError.code === 'ENOENT'
        ? null
        : await quarantine(backupPath);
      data = createInitialData();
      await save(data);
      reportRecovery({
        kind: 'reset_store',
        filePath,
        backupPath,
        corruptPath,
        corruptBackupPath,
        reason
      });
      return data;
    }

    await copyFile(backupPath, filePath);
    reportRecovery({
      kind: 'restored_backup',
      filePath,
      backupPath,
      corruptPath,
      reason
    });
    return data;
  }

  async function load() {
    try {
      return await readStoredData(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return restoreBackup({
          reason: 'missing_primary',
          emptyWhenMissing: true
        });
      }

      const corruptPath = await quarantine(filePath);
      return restoreBackup({
        corruptPath,
        reason: error.code || error.name || 'invalid_primary'
      });
    }
  }

  async function save(data) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    const backupTmpPath = `${backupPath}.tmp`;
    const serialized = `${JSON.stringify(normalizeStoredData(data), null, 2)}\n`;
    await writeFile(tmpPath, serialized, 'utf8');
    await rename(tmpPath, filePath);
    await writeFile(backupTmpPath, serialized, 'utf8');
    await rename(backupTmpPath, backupPath);
  }

  async function captureText(text) {
    const content = normalizeContent(text);

    if (!content) {
      return { status: 'empty' };
    }

    const data = await load();
    const duplicate = data.prompts.find((prompt) => prompt.content === content);

    if (duplicate) {
      return { status: 'duplicate', prompt: duplicate };
    }

    const now = clock();
    const prompt = {
      id: idGenerator(),
      projectId: null,
      stageId: null,
      title: titleFromContent(content),
      content,
      note: '',
      keywordIds: [],
      rating: 0,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      useCount: 0
    };

    data.prompts.unshift(prompt);
    await save(data);

    return { status: 'saved', prompt };
  }

  async function listProjects() {
    const data = await load();
    return sortProjects(data.projects);
  }

  async function listStagesForProject(projectId) {
    const data = await load();
    return data.stages
      .filter((stage) => stage.projectId === projectId && !stage.hidden)
      .sort((left, right) => left.order - right.order);
  }

  async function createProject(name) {
    const trimmedName = String(name ?? '').trim();

    if (!trimmedName) {
      return { status: 'empty' };
    }

    const data = await load();
    const duplicate = data.projects.find((project) => project.name === trimmedName);

    if (duplicate) {
      return { status: 'duplicate', project: duplicate };
    }

    const now = clock();
    const project = {
      id: idGenerator(),
      name: trimmedName,
      description: '',
      pinned: false,
      createdAt: now,
      updatedAt: now
    };
    const stages = DEFAULT_STAGE_NAMES.map((stageName, index) => ({
      id: idGenerator(),
      projectId: project.id,
      name: stageName,
      order: index,
      hidden: false,
      createdAt: now,
      updatedAt: now
    }));

    data.projects.push(project);
    data.stages.push(...stages);
    await save(data);

    return { status: 'created', project, stages };
  }

  function ensureKeywords(data, names, now) {
    return uniqueTrimmed(names).map((name) => {
      let keyword = data.keywords.find((item) => item.name === name);

      if (!keyword) {
        keyword = {
          id: idGenerator(),
          name,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
          useCount: 0
        };
        data.keywords.push(keyword);
      }

      keyword.updatedAt = now;
      keyword.lastUsedAt = now;
      keyword.useCount = Number(keyword.useCount || 0) + 1;

      return keyword.id;
    });
  }

  async function updatePrompt(promptId, patch = {}) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    const nextProjectId = Object.hasOwn(patch, 'projectId') ? (patch.projectId || null) : prompt.projectId;
    const projectChanged = nextProjectId !== prompt.projectId;
    const nextStageId = Object.hasOwn(patch, 'stageId')
      ? (patch.stageId || null)
      : (projectChanged ? null : prompt.stageId);

    if (nextProjectId !== null && !data.projects.some((project) => project.id === nextProjectId)) {
      return { status: 'project_not_found' };
    }

    if (nextStageId !== null && !data.stages.some((stage) => stage.id === nextStageId && stage.projectId === nextProjectId)) {
      return { status: 'stage_not_found' };
    }

    if (Object.hasOwn(patch, 'content')) {
      const content = normalizeContent(patch.content);

      if (!content) {
        return { status: 'empty' };
      }

      const duplicate = data.prompts.find((item) => item.id !== promptId && item.content === content);

      if (duplicate) {
        return { status: 'duplicate', prompt: decoratePrompt(data, duplicate) };
      }

      prompt.content = content;
      if (!Object.hasOwn(patch, 'title')) {
        prompt.title = titleFromContent(content);
      }
    }

    if (Object.hasOwn(patch, 'title')) {
      const title = String(patch.title ?? '').trim();
      prompt.title = title || titleFromContent(prompt.content);
    }

    if (Object.hasOwn(patch, 'note')) {
      prompt.note = String(patch.note ?? '').trim();
    }

    if (Object.hasOwn(patch, 'rating')) {
      prompt.rating = clampRating(patch.rating);
    }

    if (Object.hasOwn(patch, 'pinned')) {
      prompt.pinned = Boolean(patch.pinned);
    }

    if (Object.hasOwn(patch, 'keywordNames')) {
      prompt.keywordIds = ensureKeywords(data, patch.keywordNames, clock());
    }

    prompt.projectId = nextProjectId;
    prompt.stageId = nextProjectId === null ? null : nextStageId;
    prompt.updatedAt = clock();
    await save(data);

    return { status: 'updated', prompt: decoratePrompt(data, prompt) };
  }

  async function deletePrompt(promptId) {
    const data = await load();
    const index = data.prompts.findIndex((prompt) => prompt.id === promptId);

    if (index === -1) {
      return { status: 'not_found' };
    }

    const [prompt] = data.prompts.splice(index, 1);
    await save(data);

    return { status: 'deleted', prompt };
  }

  async function renameProject(projectId, name) {
    const trimmedName = String(name ?? '').trim();

    if (!trimmedName) {
      return { status: 'empty' };
    }

    const data = await load();
    const project = data.projects.find((item) => item.id === projectId);

    if (!project) {
      return { status: 'not_found' };
    }

    const duplicate = data.projects.find((item) => item.id !== projectId && item.name === trimmedName);

    if (duplicate) {
      return { status: 'duplicate', project: duplicate };
    }

    project.name = trimmedName;
    project.updatedAt = clock();
    await save(data);

    return { status: 'updated', project };
  }

  async function toggleProjectPinned(projectId) {
    const data = await load();
    const project = data.projects.find((item) => item.id === projectId);

    if (!project) {
      return { status: 'not_found' };
    }

    project.pinned = !project.pinned;
    project.updatedAt = clock();
    await save(data);

    return { status: 'updated', project };
  }

  async function deleteProject(projectId) {
    const data = await load();
    const projectIndex = data.projects.findIndex((project) => project.id === projectId);

    if (projectIndex === -1) {
      return { status: 'not_found' };
    }

    const [project] = data.projects.splice(projectIndex, 1);
    data.stages = data.stages.filter((stage) => stage.projectId !== projectId);
    data.prompts.forEach((prompt) => {
      if (prompt.projectId === projectId) {
        prompt.projectId = null;
        prompt.stageId = null;
        prompt.updatedAt = clock();
      }
    });

    if (data.viewState.lastViewType === 'project' && data.viewState.lastProjectId === projectId) {
      data.viewState.lastViewType = 'library';
      data.viewState.lastProjectId = null;
      data.viewState.pendingOnly = false;
      data.viewState.stageFilter = null;
    }

    if (data.viewState.currentProjectId === projectId) {
      data.viewState.currentProjectId = null;
    }

    await save(data);

    return { status: 'deleted', project };
  }

  async function createStage(projectId, name) {
    const trimmedName = String(name ?? '').trim();

    if (!trimmedName) {
      return { status: 'empty' };
    }

    const data = await load();

    if (!data.projects.some((project) => project.id === projectId)) {
      return { status: 'project_not_found' };
    }

    const now = clock();
    const projectStages = data.stages.filter((stage) => stage.projectId === projectId);
    const stage = {
      id: idGenerator(),
      projectId,
      name: trimmedName,
      order: projectStages.length,
      hidden: false,
      createdAt: now,
      updatedAt: now
    };

    data.stages.push(stage);
    await save(data);

    return { status: 'created', stage };
  }

  async function renameStage(stageId, name) {
    const trimmedName = String(name ?? '').trim();

    if (!trimmedName) {
      return { status: 'empty' };
    }

    const data = await load();
    const stage = data.stages.find((item) => item.id === stageId);

    if (!stage) {
      return { status: 'not_found' };
    }

    stage.name = trimmedName;
    stage.updatedAt = clock();
    await save(data);

    return { status: 'updated', stage };
  }

  async function hideStage(stageId) {
    const data = await load();
    const stage = data.stages.find((item) => item.id === stageId);

    if (!stage) {
      return { status: 'not_found' };
    }

    stage.hidden = true;
    stage.updatedAt = clock();
    if (data.viewState.stageFilter === stage.id) {
      data.viewState.stageFilter = null;
    }
    await save(data);

    return { status: 'updated', stage };
  }

  async function reorderStage(stageId, nextOrder) {
    const data = await load();
    const stage = data.stages.find((item) => item.id === stageId);

    if (!stage) {
      return { status: 'not_found' };
    }

    const projectStages = data.stages
      .filter((item) => item.projectId === stage.projectId)
      .sort((left, right) => left.order - right.order);
    const currentIndex = projectStages.findIndex((item) => item.id === stageId);
    const targetIndex = Math.max(0, Math.min(projectStages.length - 1, Number(nextOrder)));
    projectStages.splice(currentIndex, 1);
    projectStages.splice(targetIndex, 0, stage);
    projectStages.forEach((item, index) => {
      item.order = index;
      item.updatedAt = clock();
    });
    normalizeStageOrder(data.stages, stage.projectId);
    await save(data);

    return { status: 'updated', stage };
  }

  async function listKeywords() {
    const data = await load();
    return [...data.keywords].sort((left, right) => {
      return String(left.name).localeCompare(String(right.name), 'zh-Hans-CN');
    });
  }

  async function createKeyword(name) {
    const trimmedName = String(name ?? '').trim();

    if (!trimmedName) {
      return { status: 'empty' };
    }

    const data = await load();
    const existing = data.keywords.find((keyword) => keyword.name === trimmedName);

    if (existing) {
      return { status: 'duplicate', keyword: existing };
    }

    const now = clock();
    const keyword = {
      id: idGenerator(),
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      useCount: 0
    };

    data.keywords.push(keyword);
    await save(data);

    return { status: 'created', keyword };
  }

  async function queryPrompts(options = {}) {
    const data = await load();
    const viewType = options.viewType === 'project' ? 'project' : 'library';
    const projectId = options.projectId ?? null;
    const pendingOnly = Boolean(options.pendingOnly);
    const query = String(options.query ?? '').trim();
    const currentViewOnly = Boolean(options.currentViewOnly);
    const sortMode = options.sortMode ?? data.viewState.sortMode ?? DEFAULT_VIEW_STATE.sortMode;
    const stageId = options.stageId ?? null;
    let prompts = data.prompts.map((prompt) => decoratePrompt(data, prompt));

    if (!query || currentViewOnly) {
      prompts = filterPromptsForView(prompts, viewType, projectId, pendingOnly);
    }

    if (stageId) {
      prompts = prompts.filter((prompt) => prompt.stageId === stageId);
    }

    prompts = prompts.filter((prompt) => promptMatchesQuery(prompt, query));

    return { prompts: sortPrompts(prompts, sortMode) };
  }

  async function getPromptCounts() {
    const data = await load();
    return {
      total: data.prompts.length,
      pending: data.prompts.filter((prompt) => prompt.projectId === null).length
    };
  }

  async function getViewState() {
    const data = await load();
    const viewState = normalizeViewState(data.viewState);
    const browsedProjectExists = data.projects.some((project) => project.id === viewState.lastProjectId);
    const currentProjectExists = data.projects.some((project) => project.id === viewState.currentProjectId);

    if (viewState.lastViewType === 'project' && !browsedProjectExists) {
      viewState.lastViewType = 'library';
      viewState.lastProjectId = null;
      viewState.pendingOnly = false;
      viewState.stageFilter = null;
    }

    if (viewState.currentProjectId && !currentProjectExists) {
      viewState.currentProjectId = null;
    }

    const { searchQuery, ...restoredViewState } = viewState;
    return restoredViewState;
  }

  async function updateViewState(nextState = {}) {
    const data = await load();
    const allowedViewTypes = new Set(['library', 'project']);
    const viewState = normalizeViewState(data.viewState);

    if (allowedViewTypes.has(nextState.lastViewType)) {
      viewState.lastViewType = nextState.lastViewType;
    }

    if (Object.hasOwn(nextState, 'lastProjectId')) {
      viewState.lastProjectId = nextState.lastProjectId || null;
    }

    if (Object.hasOwn(nextState, 'currentProjectId')) {
      viewState.currentProjectId = nextState.currentProjectId || null;
    }

    if (Object.hasOwn(nextState, 'pendingOnly')) {
      viewState.pendingOnly = Boolean(nextState.pendingOnly);
    }

    if (Object.hasOwn(nextState, 'sortMode')) {
      viewState.sortMode = nextState.sortMode || DEFAULT_VIEW_STATE.sortMode;
    }

    if (Object.hasOwn(nextState, 'stageFilter')) {
      viewState.stageFilter = nextState.stageFilter || null;
    }

    delete viewState.searchQuery;
    data.viewState = viewState;
    await save(data);

    return { status: 'updated', viewState: await getViewState() };
  }

  async function updatePromptProject(promptId, projectId, stageId = null) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    if (projectId !== null && !data.projects.some((project) => project.id === projectId)) {
      return { status: 'project_not_found' };
    }

    if (stageId !== null && !data.stages.some((stage) => stage.id === stageId && stage.projectId === projectId)) {
      return { status: 'stage_not_found' };
    }

    prompt.projectId = projectId;
    prompt.stageId = projectId === null ? null : stageId;
    prompt.updatedAt = clock();
    await save(data);

    return { status: 'updated', prompt };
  }

  async function updatePromptStage(promptId, stageId) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    if (stageId !== null && !data.stages.some((stage) => stage.id === stageId && stage.projectId === prompt.projectId)) {
      return { status: 'stage_not_found' };
    }

    prompt.stageId = stageId;
    prompt.updatedAt = clock();
    await save(data);

    return { status: 'updated', prompt };
  }

  async function updatePromptRating(promptId, rating) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    prompt.rating = clampRating(rating);
    prompt.updatedAt = clock();
    await save(data);

    return { status: 'updated', prompt };
  }

  async function togglePromptPinned(promptId) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    prompt.pinned = !prompt.pinned;
    prompt.updatedAt = clock();
    await save(data);

    return { status: 'updated', prompt };
  }

  async function markPromptUsed(promptId) {
    const data = await load();
    const prompt = data.prompts.find((item) => item.id === promptId);

    if (!prompt) {
      return { status: 'not_found' };
    }

    prompt.useCount += 1;
    prompt.lastUsedAt = clock();
    await save(data);

    return { status: 'used', prompt };
  }

  return {
    filePath,
    load,
    whenIdle,
    save: queued(save),
    captureText: queued(captureText),
    createProject: queued(createProject),
    renameProject: queued(renameProject),
    toggleProjectPinned: queued(toggleProjectPinned),
    deleteProject: queued(deleteProject),
    createStage: queued(createStage),
    renameStage: queued(renameStage),
    hideStage: queued(hideStage),
    reorderStage: queued(reorderStage),
    createKeyword: queued(createKeyword),
    listKeywords,
    queryPrompts,
    getPromptCounts,
    updatePrompt: queued(updatePrompt),
    deletePrompt: queued(deletePrompt),
    getViewState,
    updateViewState: queued(updateViewState),
    listProjects,
    listStagesForProject,
    togglePromptPinned: queued(togglePromptPinned),
    updatePromptProject: queued(updatePromptProject),
    updatePromptRating: queued(updatePromptRating),
    updatePromptStage: queued(updatePromptStage),
    markPromptUsed: queued(markPromptUsed)
  };
}

module.exports = {
  createPromptStore
};
