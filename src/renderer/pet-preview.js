const petShell = document.querySelector('.pet-shell');
const panelShell = document.querySelector('.panel-shell');
const panelClose = document.querySelector('.panel-close');
const panelDragZone = document.querySelector('.panel-drag-zone');
const panelFeedback = document.querySelector('.panel-feedback');
const feedbackLabel = document.querySelector('.feedback-label');
const promptList = document.querySelector('.prompt-list');
const promptPagePrevious = document.querySelector('[data-prompt-page="previous"]');
const promptPageNext = document.querySelector('[data-prompt-page="next"]');
const promptPageStatus = document.querySelector('[data-prompt-page-status]');
const searchInput = document.querySelector('.panel-search input');
const currentViewOnlyInput = document.querySelector('[data-current-view-only]');
const projectList = document.querySelector('[data-project-list]');
const stageList = document.querySelector('[data-stage-list]');
const createProjectToggle = document.querySelector('[data-project-create-toggle]');
const createProjectForm = document.querySelector('[data-project-create-form]');
const createProjectInput = createProjectForm.querySelector('input');
const createProjectCancel = document.querySelector('[data-project-create-cancel]');
const pendingToggle = document.querySelector('[data-pending-toggle]');
const libraryCount = document.querySelector('[data-library-count]');
const pendingCount = document.querySelector('[data-pending-count]');
const pendingNote = document.querySelector('[data-pending-note]');
const sortButton = document.querySelector('[data-sort-button]');
const promptEditModal = document.querySelector('[data-prompt-edit-modal]');
const promptEditForm = document.querySelector('.prompt-edit-form');
const keywordOptions = document.querySelector('[data-keyword-options]');
const promptDeleteDialog = document.querySelector('[data-prompt-delete-dialog]');
const promptDeleteMessage = document.querySelector('[data-prompt-delete-message]');
const promptDeleteConfirm = document.querySelector('[data-prompt-delete-confirm]');
const promptDeleteCancel = document.querySelector('[data-prompt-delete-cancel]');
const textActionDialog = document.querySelector('[data-text-action-dialog]');
const textActionForm = document.querySelector('[data-text-action-form]');
const textActionTitle = document.querySelector('[data-text-action-title]');
const textActionLabel = document.querySelector('[data-text-action-label]');
const textActionInput = document.querySelector('[data-text-action-input]');
const textActionConfirm = document.querySelector('[data-text-action-confirm]');
const textActionCancel = document.querySelector('[data-text-action-cancel]');
const confirmActionDialog = document.querySelector('[data-confirm-action-dialog]');
const confirmActionForm = document.querySelector('[data-confirm-action-form]');
const confirmActionTitle = document.querySelector('[data-confirm-action-title]');
const confirmActionMessage = document.querySelector('[data-confirm-action-message]');
const confirmActionConfirm = document.querySelector('[data-confirm-action-confirm]');
const confirmActionCancel = document.querySelector('[data-confirm-action-cancel]');
const promptEntryView = window.deskPetPromptEntryView;
const promptPagination = window.deskPetPromptPagination;
const isElectronShell = window.location.search.includes('shell=electron');

const SORT_MODES = [
  { id: 'smart', label: '排序：综合' },
  { id: 'rating', label: '排序：评分' },
  { id: 'used', label: '排序：使用' },
  { id: 'updated', label: '排序：更新' }
];

const previewProjects = [
  { id: 'preview-project-1', name: 'Agent 搭建', pinned: true },
  { id: 'preview-project-2', name: '项目复盘', pinned: false }
];

const previewStages = [
  { id: 'preview-stage-1', projectId: 'preview-project-1', name: '需求分析', order: 0 },
  { id: 'preview-stage-2', projectId: 'preview-project-1', name: 'Agent 搭建', order: 1 },
  { id: 'preview-stage-3', projectId: 'preview-project-1', name: '测试验收', order: 2 }
];

const previewPrompts = [
  {
    id: 'preview-1',
    projectId: null,
    stageId: null,
    title: '构建 AGENT.MD 的项目上下文',
    content: '你是一个开发 agent，请先阅读项目文档，理解产品目标与当前阶段...',
    rating: 5,
    pinned: true,
    keywordIds: ['agent', '上下文'],
    keywordNames: ['agent', '上下文'],
    updatedAt: '2026-07-10T08:00:00.000Z',
    lastUsedAt: null,
    useCount: 0
  },
  {
    id: 'preview-2',
    projectId: 'preview-project-1',
    stageId: 'preview-stage-2',
    title: '复盘项目搭建流程',
    content: '请从需求分析、数据模型、交互流程、开发计划四个维度总结...',
    rating: 4,
    pinned: false,
    keywordIds: ['复盘', '流程'],
    keywordNames: ['复盘', '流程'],
    updatedAt: '2026-07-10T09:00:00.000Z',
    lastUsedAt: null,
    useCount: 0
  },
  {
    id: 'preview-3',
    projectId: 'preview-project-2',
    stageId: null,
    title: '拆解需求并形成验收清单',
    content: '把产品目标拆成可验证的交互、数据与质量标准，再开始实现。',
    rating: 3,
    pinned: false,
    keywordIds: ['需求', '验收'],
    keywordNames: ['需求', '验收'],
    updatedAt: '2026-07-10T10:00:00.000Z',
    lastUsedAt: null,
    useCount: 0
  }
];

let clickTimer = 0;
let dragState = null;
let suppressNextClick = false;
let isPanelOpen = false;
let activeView = 'library';
let activeProjectId = null;
let currentProjectId = null;
let pendingOnly = false;
let activeStageId = null;
let sortMode = 'smart';
let projects = [];
let stages = [];
let keywords = [];
let currentPrompts = [];
let panelFeedbackTimer = 0;
let viewStateRestored = false;
let openRatingPromptId = null;
let openPromptMenuId = null;
let pendingDeletePromptId = null;
let pendingTextAction = null;
let pendingConfirmAction = null;
let currentPromptPage = 1;
let promptPageRenderRevision = 0;

if (isElectronShell) {
  document.documentElement.classList.add('electron-shell');
  document.body.classList.add('electron-shell');
}

function setFeedback(text, options = {}) {
  feedbackLabel.textContent = text;

  if (options.panel === false || !isPanelOpen) {
    return;
  }

  window.clearTimeout(panelFeedbackTimer);
  panelFeedback.textContent = text;
  panelFeedback.classList.add('visible');
  panelFeedbackTimer = window.setTimeout(() => {
    panelFeedback.classList.remove('visible');
  }, 1500);
}

function canMovePetWindow() {
  return isElectronShell && Boolean(window.deskPet?.startPetWindowDrag);
}

function setPanelState(open) {
  isPanelOpen = open;
  document.body.classList.toggle('panel-open', open);
  petShell.classList.toggle('panel-open', open);
  setFeedback(open ? '小浮窗已展开' : '单击展开 · 双击捕获', { panel: false });

  if (!open) {
    panelFeedback.classList.remove('visible');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasSearchQuery() {
  return searchInput.value.trim().length > 0;
}

function timestampForPrompt(prompt) {
  return prompt.lastUsedAt || prompt.updatedAt || prompt.createdAt || '';
}

function sortPromptsForMode(prompts) {
  return [...prompts].sort((left, right) => {
    if (sortMode === 'rating') {
      return Number(right.rating || 0) - Number(left.rating || 0);
    }

    if (sortMode === 'used') {
      return String(right.lastUsedAt || '').localeCompare(String(left.lastUsedAt || ''));
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

function keywordsFor(prompt) {
  if (Array.isArray(prompt.keywordNames) && prompt.keywordNames.length > 0) {
    return prompt.keywordNames.slice(0, 3);
  }

  if (Array.isArray(prompt.keywordIds) && prompt.keywordIds.length > 0) {
    return prompt.keywordIds.slice(0, 3);
  }

  return [];
}

function textMatchesPrompt(prompt, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    prompt.title,
    prompt.content,
    prompt.note,
    ...(Array.isArray(prompt.keywordNames) ? prompt.keywordNames : []),
    ...(Array.isArray(prompt.keywordIds) ? prompt.keywordIds : [])
  ].join('\n').toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function parseKeywordNames(value) {
  const names = String(value ?? '')
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

function findPrompt(promptId) {
  return currentPrompts.find((prompt) => prompt.id === promptId);
}

function updatePreviewPrompt(promptId, patch) {
  const prompt = previewPrompts.find((item) => item.id === promptId);

  if (!prompt) {
    return { status: 'not_found' };
  }

  const content = String(patch.content ?? '').trim();
  if (!content) {
    return { status: 'empty' };
  }

  const duplicate = previewPrompts.find((item) => item.id !== promptId && item.content === content);
  if (duplicate) {
    return { status: 'duplicate', prompt: duplicate };
  }

  const keywordNames = [...new Set((patch.keywordNames ?? [])
    .map((name) => String(name).trim())
    .filter(Boolean))];
  const firstContentLine = content.split('\n').find((line) => line.trim())?.trim() || '未命名提示词';
  const projectId = patch.projectId || null;

  Object.assign(prompt, {
    title: String(patch.title ?? '').trim() || firstContentLine,
    content,
    note: String(patch.note ?? '').trim(),
    projectId,
    stageId: projectId ? (patch.stageId || null) : null,
    keywordIds: keywordNames,
    keywordNames,
    rating: Math.max(0, Math.min(5, Math.round(Number(patch.rating) || 0))),
    pinned: Boolean(patch.pinned),
    updatedAt: new Date().toISOString()
  });

  return { status: 'updated', prompt };
}

async function persistViewState() {
  if (!window.deskPet?.updateViewState) {
    return;
  }

  await window.deskPet.updateViewState({
    lastViewType: activeView,
    lastProjectId: activeProjectId,
    currentProjectId,
    pendingOnly,
    sortMode,
    stageFilter: activeStageId
  });
}

function filterPrompts(prompts) {
  const query = searchInput.value.trim();

  return prompts.filter((prompt) => {
    if (!textMatchesPrompt(prompt, query)) {
      return false;
    }

    if (!query && activeView === 'project' && activeStageId) {
      return prompt.stageId === activeStageId;
    }

    return true;
  });
}

function projectOptionsFor(prompt) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    selected: prompt.projectId === project.id
  }));
}

function resetPromptPage() {
  currentPromptPage = 1;
}

function updatePromptPageControls(pageState) {
  promptPageStatus.textContent = `${pageState.page} / ${pageState.totalPages}`;
  promptPagePrevious.disabled = !pageState.hasPrevious;
  promptPageNext.disabled = !pageState.hasNext;
}

function stopPromptPageAnimations() {
  promptList.getAnimations?.().forEach((animation) => animation.cancel());
  promptList.classList.remove('is-page-turning');
}

function positionOpenPromptMenu() {
  const menu = promptList.querySelector('.prompt-more-menu');
  const toggle = promptList.querySelector('.prompt-menu-toggle[aria-expanded="true"]');

  if (!menu || !toggle) {
    return;
  }

  const listBounds = promptList.getBoundingClientRect();
  const toggleBounds = toggle.getBoundingClientRect();
  const menuBounds = menu.getBoundingClientRect();
  const placement = promptPagination.resolveMenuPlacement({
    menuHeight: Math.max(menu.scrollHeight, menuBounds.height),
    spaceAbove: toggleBounds.top - listBounds.top - 4,
    spaceBelow: listBounds.bottom - toggleBounds.bottom - 4
  });

  menu.classList.toggle('opens-upward', placement.direction === 'up');
  menu.classList.toggle('is-constrained', placement.constrained);
  if (placement.constrained) {
    menu.style.setProperty('--prompt-menu-max-height', `${placement.maxHeight}px`);
  } else {
    menu.style.removeProperty('--prompt-menu-max-height');
  }
}

function renderPromptEntries(prompts, options = {}) {
  if (options.transitionRevision == null) {
    promptPageRenderRevision += 1;
    stopPromptPageAnimations();
  } else if (options.transitionRevision !== promptPageRenderRevision) {
    return false;
  }

  const visiblePrompts = sortPromptsForMode(filterPrompts(prompts));
  const pageState = promptPagination.paginate(visiblePrompts, currentPromptPage);
  currentPromptPage = pageState.page || 1;
  updatePromptPageControls(pageState);

  if (pageState.items.length === 0) {
    openRatingPromptId = null;
    openPromptMenuId = null;
    promptList.innerHTML = '<div class="prompt-empty-state"><p>这里暂时没有提示词</p></div>';
    return true;
  }

  const promptIds = new Set(pageState.items.map((prompt) => prompt.id));
  if (!promptIds.has(openRatingPromptId)) {
    openRatingPromptId = null;
  }
  if (!promptIds.has(openPromptMenuId)) {
    openPromptMenuId = null;
  }

  promptList.innerHTML = pageState.items.map((prompt) => promptEntryView.renderPromptEntry({
    prompt,
    keywords: keywordsFor(prompt),
    projectOptions: projectOptionsFor(prompt),
    ratingOpen: openRatingPromptId === prompt.id,
    menuOpen: openPromptMenuId === prompt.id
  })).join('');
  positionOpenPromptMenu();
  return true;
}

async function animatePromptPage(direction) {
  stopPromptPageAnimations();
  const revision = ++promptPageRenderRevision;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || typeof promptList.animate !== 'function') {
    renderPromptEntries(currentPrompts, { transitionRevision: revision });
    return;
  }

  const exitOffset = direction === 'forward' ? -12 : 12;
  promptList.classList.add('is-page-turning');
  const exitAnimation = promptList.animate([
    { opacity: 1, transform: 'translateX(0)' },
    { opacity: 0, transform: `translateX(${exitOffset}px)` }
  ], {
    duration: 90,
    easing: 'ease-in',
    fill: 'forwards'
  });

  await exitAnimation.finished.catch(() => undefined);
  if (revision !== promptPageRenderRevision) {
    return;
  }

  exitAnimation.cancel();
  if (!renderPromptEntries(currentPrompts, { transitionRevision: revision })) {
    return;
  }

  const enterAnimation = promptList.animate([
    { opacity: 0, transform: `translateX(${-exitOffset}px)` },
    { opacity: 1, transform: 'translateX(0)' }
  ], {
    duration: 90,
    easing: 'ease-out',
    fill: 'forwards'
  });

  await enterAnimation.finished.catch(() => undefined);
  if (revision === promptPageRenderRevision) {
    enterAnimation.cancel();
    promptList.classList.remove('is-page-turning');
  }
}

function changePromptPage(direction) {
  const visiblePrompts = sortPromptsForMode(filterPrompts(currentPrompts));
  const pageState = promptPagination.paginate(visiblePrompts, currentPromptPage);
  const nextPage = promptPagination.move(pageState, direction);

  if (nextPage === pageState.page) {
    return;
  }

  currentPromptPage = nextPage;
  openRatingPromptId = null;
  openPromptMenuId = null;
  void animatePromptPage(direction);
}

function setPromptCounts(counts) {
  const total = Number(counts?.total) || 0;
  const pending = Number(counts?.pending) || 0;
  libraryCount.textContent = String(total);
  pendingCount.textContent = String(pending);
  pendingNote.hidden = pending === 0;
  pendingToggle.setAttribute('aria-pressed', String(pendingOnly));
  pendingToggle.classList.toggle('active', pendingOnly);
}

function renderProjectRail() {
  projectList.innerHTML = projects.map((project) => {
    const active = activeView === 'project' && activeProjectId === project.id ? ' active' : '';
    const current = currentProjectId === project.id ? ' current' : '';
    const pinnedMark = project.pinned
      ? '<span class="project-pin-mark" aria-label="已置顶" title="已置顶">★</span>'
      : '';
    const currentMark = current
      ? '<span class="current-project-mark" aria-label="当前项目" title="当前项目">◆</span>'
      : '';

    return `
      <div class="project-entry${active}${current}" data-project-entry-id="${escapeHtml(project.id)}">
        <button class="project-item${active}${current}" type="button" data-project-id="${escapeHtml(project.id)}">
          <span>${escapeHtml(project.name)}</span>
          <b class="project-markers">${currentMark}${pinnedMark}</b>
        </button>
        <div class="project-actions" aria-label="项目操作">
          <button type="button" data-project-action="current" data-project-action-id="${escapeHtml(project.id)}" aria-label="${current ? '清除当前项目' : '设为当前项目'}" title="${current ? '清除当前项目' : '设为当前项目'}">◆</button>
          <button type="button" data-project-action="pin" data-project-action-id="${escapeHtml(project.id)}" aria-label="项目置顶">★</button>
          <button type="button" data-project-action="rename" data-project-action-id="${escapeHtml(project.id)}" aria-label="重命名项目">✎</button>
          <button type="button" data-project-action="delete" data-project-action-id="${escapeHtml(project.id)}" aria-label="删除项目">×</button>
        </div>
      </div>
    `;
  }).join('');

  if (projects.length === 0) {
    projectList.innerHTML = '';
  }
}

function renderStagePills() {
  const allActive = activeStageId === null ? ' active' : '';
  const stageButtons = stages.map((stage) => {
    const active = activeStageId === stage.id ? ' active' : '';
    return `
      <span class="stage-chip${active}">
        <button class="stage-pill${active}" type="button" data-stage-id="${escapeHtml(stage.id)}">${escapeHtml(stage.name)}</button>
        <button class="stage-mini" type="button" data-stage-action="move" data-stage-direction="-1" data-stage-action-id="${escapeHtml(stage.id)}" aria-label="阶段前移">↑</button>
        <button class="stage-mini" type="button" data-stage-action="move" data-stage-direction="1" data-stage-action-id="${escapeHtml(stage.id)}" aria-label="阶段后移">↓</button>
        <button class="stage-mini" type="button" data-stage-action="rename" data-stage-action-id="${escapeHtml(stage.id)}" aria-label="重命名阶段">✎</button>
        <button class="stage-mini" type="button" data-stage-action="hide" data-stage-action-id="${escapeHtml(stage.id)}" aria-label="隐藏阶段">×</button>
      </span>
    `;
  }).join('');

  stageList.innerHTML = `<button class="stage-pill${allActive}" type="button" data-stage-id="">全部</button>${stageButtons}`;
}

function setActiveNavigation() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });
  document.querySelectorAll('[data-project-id]').forEach((button) => {
    button.classList.toggle('active', activeView === 'project' && button.dataset.projectId === activeProjectId);
  });
  pendingToggle.setAttribute('aria-pressed', String(pendingOnly));
  pendingToggle.classList.toggle('active', pendingOnly);
}

async function refreshProjects() {
  projects = window.deskPet?.listProjects ? await window.deskPet.listProjects() : previewProjects;
  renderProjectRail();
  setActiveNavigation();
}

async function refreshStages() {
  if (activeView !== 'project' || !activeProjectId) {
    stages = [];
    activeStageId = null;
    renderStagePills();
    return;
  }

  stages = window.deskPet?.listStagesForProject
    ? await window.deskPet.listStagesForProject(activeProjectId)
    : previewStages.filter((stage) => stage.projectId === activeProjectId);
  renderStagePills();
}

async function refreshKeywords() {
  keywords = window.deskPet?.listKeywords ? await window.deskPet.listKeywords() : [];

  if (keywordOptions) {
    keywordOptions.innerHTML = keywords
      .map((keyword) => `<option value="${escapeHtml(keyword.name)}"></option>`)
      .join('');
  }
}

async function loadPromptsForView(view) {
  activeView = view;
  const query = searchInput.value.trim();
  const currentViewOnly = Boolean(currentViewOnlyInput?.checked);

  if (!window.deskPet?.queryPrompts) {
    const shouldUseAllPrompts = hasSearchQuery() && !currentViewOnly;

    if (shouldUseAllPrompts) {
      currentPrompts = previewPrompts;
    } else if (view === 'project') {
      currentPrompts = previewPrompts.filter((prompt) => prompt.projectId === activeProjectId);
    } else if (pendingOnly) {
      currentPrompts = previewPrompts.filter((prompt) => prompt.projectId == null);
    } else {
      currentPrompts = previewPrompts;
    }
    renderPromptEntries(currentPrompts);
    setPromptCounts({
      total: previewPrompts.length,
      pending: previewPrompts.filter((prompt) => prompt.projectId == null).length
    });
    return;
  }

  try {
    if (window.deskPet?.getPromptCounts) {
      const counts = await window.deskPet.getPromptCounts();
      setPromptCounts(counts);
    }

    const result = await window.deskPet.queryPrompts({
      viewType: view,
      projectId: activeProjectId,
      pendingOnly,
      query,
      currentViewOnly,
      sortMode,
      stageId: !query || currentViewOnly ? activeStageId : null
    });
    currentPrompts = result.prompts;

    renderPromptEntries(currentPrompts);
  } catch {
    promptList.innerHTML = '<div class="prompt-empty-state"><p>加载失败，请稍后再试</p></div>';
  }
}

async function setActiveView(view, projectId = null) {
  resetPromptPage();
  activeView = view === 'project' ? 'project' : 'library';
  activeProjectId = activeView === 'project' ? projectId : null;
  activeStageId = null;
  pendingOnly = false;
  await refreshProjects();
  await refreshStages();
  setActiveNavigation();
  await loadPromptsForView(activeView);
  await persistViewState();
}

async function setPendingFilter(nextPendingOnly) {
  resetPromptPage();
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

async function openPetPanel() {
  if (isPanelOpen) {
    return;
  }

  if (window.deskPet?.openPetPanel) {
    await window.deskPet.openPetPanel();
  }

  setPanelState(true);
  if (!viewStateRestored && window.deskPet?.getViewState) {
    const viewState = await window.deskPet.getViewState();
    activeView = viewState.lastViewType === 'project' ? 'project' : 'library';
    activeProjectId = viewState.lastProjectId || null;
    currentProjectId = viewState.currentProjectId || null;
    pendingOnly = Boolean(viewState.pendingOnly);
    activeStageId = viewState.stageFilter || null;
    sortMode = viewState.sortMode || 'smart';
    sortButton.textContent = SORT_MODES.find((mode) => mode.id === sortMode)?.label ?? '排序：综合';
    searchInput.value = '';
    viewStateRestored = true;
  }
  await refreshProjects();
  await refreshStages();
  await loadPromptsForView(activeView);
}

async function closePetPanel() {
  if (!isPanelOpen) {
    return;
  }

  if (window.deskPet?.closePetPanel) {
    await window.deskPet.closePetPanel();
  }

  closeProjectCreator();
  cancelPromptDeletion();
  cancelTextAction();
  cancelConfirmAction();
  openRatingPromptId = null;
  openPromptMenuId = null;
  setPanelState(false);
}

async function captureClipboardPrompt() {
  if (window.deskPet?.captureClipboardPrompt) {
    return window.deskPet.captureClipboardPrompt();
  }

  if (!navigator.clipboard?.readText) {
    return { status: 'unavailable' };
  }

  const content = String(await navigator.clipboard.readText()).trim();
  if (!content) {
    return { status: 'empty' };
  }

  const duplicate = previewPrompts.find((prompt) => prompt.content === content);
  if (duplicate) {
    return { status: 'duplicate', prompt: duplicate };
  }

  const now = new Date().toISOString();
  const firstContentLine = content.split('\n').find((line) => line.trim())?.trim() || '未命名提示词';
  const prompt = {
    id: `preview-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    projectId: null,
    stageId: null,
    title: firstContentLine.slice(0, 80),
    content,
    note: '',
    rating: 0,
    pinned: false,
    keywordIds: [],
    keywordNames: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    useCount: 0
  };
  previewPrompts.unshift(prompt);

  return { status: 'saved', prompt };
}

async function copyPrompt(promptId) {
  if (!window.deskPet?.copyPrompt) {
    const prompt = findPrompt(promptId);
    if (!prompt) {
      setFeedback('提示词不存在');
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setFeedback('浏览器未开放剪贴板写入');
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt.content);
      prompt.useCount = Number(prompt.useCount || 0) + 1;
      prompt.lastUsedAt = new Date().toISOString();
      setFeedback('复制成功');
      renderPromptEntries(currentPrompts);
    } catch {
      setFeedback('复制失败，请再试一次');
    }
    return;
  }

  const result = await window.deskPet.copyPrompt(promptId);

  if (result.status === 'used') {
    setFeedback('复制成功');
    await loadPromptsForView(activeView);
    return;
  }

  setFeedback('提示词不存在');
}

function captureMessageFor(result) {
  if (result.status === 'saved') {
    return `已捕获：${result.prompt.title}`;
  }

  if (result.status === 'duplicate') {
    return '已经收过啦';
  }

  if (result.status === 'empty') {
    return '剪贴板是空的';
  }

  if (result.status === 'unavailable') {
    return '浏览器未开放剪贴板读取';
  }

  return '已捕获当前剪贴板';
}

async function runCaptureFeedback() {
  petShell.classList.remove('capture-burst');

  try {
    const result = await captureClipboardPrompt();

    window.requestAnimationFrame(() => {
      petShell.classList.add('capture-burst');
      setFeedback(captureMessageFor(result));
    });
  } catch {
    setFeedback('捕获失败，请再试一次');
  }

  window.setTimeout(() => {
    petShell.classList.remove('capture-burst');
    if (!isPanelOpen) {
      setFeedback('单击展开 · 双击捕获');
    }
  }, 920);
}

function beginWindowDrag(event, captureTarget) {
  if (!canMovePetWindow() || event.button !== 0) {
    return;
  }

  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX,
    offsetY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    dragDistance: 0
  };

  captureTarget.setPointerCapture(event.pointerId);
  void window.deskPet.startPetWindowDrag(dragState.offsetX, dragState.offsetY);
}

function trackWindowDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const deltaX = Math.round(event.clientX - dragState.lastClientX);
  const deltaY = Math.round(event.clientY - dragState.lastClientY);

  if (deltaX === 0 && deltaY === 0) {
    return;
  }

  dragState.lastClientX = event.clientX;
  dragState.lastClientY = event.clientY;
  dragState.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

  if (dragState.dragDistance > 6) {
    suppressNextClick = true;
    window.clearTimeout(clickTimer);
  }
}

function endDrag(event) {
  if (dragState?.pointerId === event.pointerId) {
    dragState = null;
    void window.deskPet?.stopPetWindowDrag?.();
  }
}

function cycleSortMode() {
  const currentIndex = SORT_MODES.findIndex((mode) => mode.id === sortMode);
  const nextMode = SORT_MODES[(currentIndex + 1) % SORT_MODES.length];
  sortMode = nextMode.id;
  sortButton.textContent = nextMode.label;
  resetPromptPage();
  renderPromptEntries(currentPrompts);
  void persistViewState();
}

function isProjectCreatorOpen() {
  return !createProjectForm.hidden;
}

function openProjectCreator() {
  createProjectForm.hidden = false;
  createProjectToggle.setAttribute('aria-expanded', 'true');
  createProjectToggle.closest('.project-title-row')?.classList.add('creating');
  createProjectInput.focus();
}

function closeProjectCreator() {
  createProjectForm.hidden = true;
  createProjectForm.reset();
  createProjectToggle.setAttribute('aria-expanded', 'false');
  createProjectToggle.closest('.project-title-row')?.classList.remove('creating');
}

function toggleRatingPicker(promptId) {
  openRatingPromptId = openRatingPromptId === promptId ? null : promptId;
  openPromptMenuId = null;
  renderPromptEntries(currentPrompts);
}

function togglePromptMenu(promptId) {
  openPromptMenuId = openPromptMenuId === promptId ? null : promptId;
  openRatingPromptId = null;
  renderPromptEntries(currentPrompts);
}

async function createProjectFromInput() {
  const name = createProjectInput.value.trim();

  if (!name) {
    setFeedback('先写项目名');
    createProjectInput.focus();
    return;
  }

  const result = window.deskPet?.createProject
    ? await window.deskPet.createProject(name)
    : { status: 'created', project: { id: `preview-project-${Date.now()}`, name, pinned: false } };

  if (result.status === 'created' || result.status === 'duplicate') {
    if (!window.deskPet?.createProject && result.status === 'created') {
      previewProjects.push(result.project);
    }

    closeProjectCreator();
    setFeedback(result.status === 'created' ? '项目已创建' : '项目已存在');
    await setActiveView('project', result.project.id);
  }
}

async function updatePromptProject(promptId, projectId) {
  const nextProjectId = projectId || null;
  const result = window.deskPet?.updatePromptProject
    ? await window.deskPet.updatePromptProject(promptId, nextProjectId, null)
    : { status: 'updated' };

  if (result.status === 'updated') {
    if (!window.deskPet?.updatePromptProject) {
      const prompt = findPrompt(promptId);
      if (prompt) {
        prompt.projectId = nextProjectId;
        prompt.stageId = null;
      }
    }
    openPromptMenuId = null;
    setFeedback(nextProjectId ? '已加入项目' : '已设为待归纳');
    await refreshStages();
    await loadPromptsForView(activeView);
  }
}

async function togglePromptPinned(promptId) {
  const result = window.deskPet?.togglePromptPinned
    ? await window.deskPet.togglePromptPinned(promptId)
    : { status: 'updated' };

  if (result.status === 'updated') {
    if (!window.deskPet?.togglePromptPinned) {
      const prompt = findPrompt(promptId);
      if (prompt) {
        prompt.pinned = !prompt.pinned;
      }
    }
    openPromptMenuId = null;
    setFeedback('置顶状态已更新');
    await loadPromptsForView(activeView);
  }
}

async function updatePromptRating(promptId, rating) {
  const nextRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const result = window.deskPet?.updatePromptRating
    ? await window.deskPet.updatePromptRating(promptId, nextRating)
    : { status: 'updated' };

  if (result.status === 'updated') {
    const prompt = findPrompt(promptId);
    if (prompt) {
      prompt.rating = Number(result.prompt?.rating ?? nextRating);
    }
    openRatingPromptId = null;
    setFeedback('评分已更新');
    await loadPromptsForView(activeView);
  }
}

async function setActiveStageFilter(stageId) {
  resetPromptPage();
  activeStageId = stageId || null;
  renderStagePills();
  await loadPromptsForView(activeView);
  await persistViewState();
}

function renderEditorProjectOptions(selectedProjectId) {
  const options = ['<option value="">待归纳</option>'];

  projects.forEach((project) => {
    const selected = selectedProjectId === project.id ? ' selected' : '';
    options.push(`<option value="${escapeHtml(project.id)}"${selected}>${escapeHtml(project.name)}</option>`);
  });

  promptEditForm.elements.promptProject.innerHTML = options.join('');
}

async function renderEditorStageOptions(projectId, selectedStageId) {
  const availableStages = projectId
    ? (window.deskPet?.listStagesForProject
      ? await window.deskPet.listStagesForProject(projectId)
      : previewStages.filter((stage) => stage.projectId === projectId))
    : [];
  const options = ['<option value="">未分阶段</option>'];

  availableStages.forEach((stage) => {
    const selected = selectedStageId === stage.id ? ' selected' : '';
    options.push(`<option value="${escapeHtml(stage.id)}"${selected}>${escapeHtml(stage.name)}</option>`);
  });

  promptEditForm.elements.promptStage.innerHTML = options.join('');
  promptEditForm.elements.promptStage.disabled = !projectId;
}

async function openPromptEditor(promptId) {
  const prompt = findPrompt(promptId);

  if (!prompt) {
    setFeedback('提示词不存在');
    return;
  }

  openPromptMenuId = null;
  openRatingPromptId = null;
  renderPromptEntries(currentPrompts);
  await refreshProjects();
  await refreshKeywords();
  promptEditForm.elements.promptId.value = prompt.id;
  promptEditForm.elements.promptTitle.value = prompt.title || '';
  promptEditForm.elements.promptContent.value = prompt.content || '';
  promptEditForm.elements.promptNote.value = prompt.note || '';
  promptEditForm.elements.promptRating.value = String(prompt.rating || 0);
  promptEditForm.elements.promptPinned.checked = Boolean(prompt.pinned);
  promptEditForm.elements.promptKeywords.value = keywordsFor(prompt).join('，');
  renderEditorProjectOptions(prompt.projectId);
  await renderEditorStageOptions(prompt.projectId, prompt.stageId);
  promptEditModal.showModal();
}

async function savePromptEditor() {
  const promptId = promptEditForm.elements.promptId.value;
  const projectId = promptEditForm.elements.promptProject.value || null;
  const patch = {
    title: promptEditForm.elements.promptTitle.value,
    content: promptEditForm.elements.promptContent.value,
    note: promptEditForm.elements.promptNote.value,
    projectId,
    stageId: promptEditForm.elements.promptStage.value || null,
    keywordNames: parseKeywordNames(promptEditForm.elements.promptKeywords.value),
    rating: promptEditForm.elements.promptRating.value,
    pinned: promptEditForm.elements.promptPinned.checked
  };
  const result = window.deskPet?.updatePrompt
    ? await window.deskPet.updatePrompt(promptId, patch)
    : updatePreviewPrompt(promptId, patch);

  if (result.status === 'updated') {
    promptEditModal.close();
    setFeedback('提示词已保存');
    await refreshKeywords();
    await refreshStages();
    await loadPromptsForView(activeView);
    return;
  }

  setFeedback(result.status === 'duplicate' ? '已经收过啦' : '保存失败');
}

function requestPromptDeletion(promptId) {
  const prompt = findPrompt(promptId);

  if (!prompt) {
    setFeedback('提示词不存在');
    return;
  }

  pendingDeletePromptId = promptId;
  openPromptMenuId = null;
  openRatingPromptId = null;
  promptDeleteMessage.textContent = `“${prompt.title}”将被永久删除，此操作无法撤销。`;
  renderPromptEntries(currentPrompts);
  promptDeleteDialog.showModal();
}

function cancelPromptDeletion() {
  pendingDeletePromptId = null;
  if (promptDeleteDialog.open) {
    promptDeleteDialog.close();
  }
}

async function deletePrompt(promptId) {
  const result = window.deskPet?.deletePrompt
    ? await window.deskPet.deletePrompt(promptId)
    : { status: 'deleted' };

  if (result.status === 'deleted') {
    if (!window.deskPet?.deletePrompt) {
      const index = previewPrompts.findIndex((prompt) => prompt.id === promptId);
      if (index > -1) {
        previewPrompts.splice(index, 1);
      }
    }
    pendingDeletePromptId = null;
    if (promptDeleteDialog.open) {
      promptDeleteDialog.close();
    }
    setFeedback('提示词已删除');
    await loadPromptsForView(activeView);
    return;
  }

  cancelPromptDeletion();
  setFeedback('提示词不存在');
  await loadPromptsForView(activeView);
}

async function confirmPromptDeletion() {
  if (!pendingDeletePromptId) {
    return;
  }

  promptDeleteConfirm.disabled = true;
  try {
    await deletePrompt(pendingDeletePromptId);
  } finally {
    promptDeleteConfirm.disabled = false;
  }
}

function requestTextAction(action, targetId, options) {
  pendingTextAction = { action, targetId };
  textActionTitle.textContent = options.title;
  textActionLabel.textContent = options.label || '名称';
  textActionInput.value = options.value || '';
  textActionDialog.showModal();
  window.requestAnimationFrame(() => {
    textActionInput.focus();
    textActionInput.select();
  });
}

function cancelTextAction() {
  pendingTextAction = null;
  textActionForm.reset();
  if (textActionDialog.open) {
    textActionDialog.close();
  }
}

function requestConfirmAction(action, targetId, options) {
  pendingConfirmAction = { action, targetId };
  confirmActionTitle.textContent = options.title;
  confirmActionMessage.textContent = options.message;
  confirmActionConfirm.textContent = options.confirmLabel || '确认';
  confirmActionDialog.showModal();
}

function cancelConfirmAction() {
  pendingConfirmAction = null;
  if (confirmActionDialog.open) {
    confirmActionDialog.close();
  }
}

async function submitTextAction() {
  if (!pendingTextAction) {
    return;
  }

  const name = textActionInput.value.trim();
  if (!name) {
    setFeedback('先填写名称');
    textActionInput.focus();
    return;
  }

  const { action, targetId } = pendingTextAction;
  textActionConfirm.disabled = true;

  try {
    if (action === 'rename-project') {
      const project = projects.find((item) => item.id === targetId);
      const result = window.deskPet?.renameProject
        ? await window.deskPet.renameProject(targetId, name)
        : { status: project ? 'updated' : 'not_found', project };
      if (!window.deskPet?.renameProject && project) {
        project.name = name;
      }
      if (result.status === 'updated') {
        cancelTextAction();
        setFeedback('项目已重命名');
        await refreshProjects();
        return;
      }
      setFeedback(result.status === 'duplicate' ? '项目已存在' : '重命名失败');
      return;
    }

    if (action === 'create-stage') {
      const result = window.deskPet?.createStage
        ? await window.deskPet.createStage(targetId, name)
        : {
          status: 'created',
          stage: {
            id: `preview-stage-${Date.now()}`,
            projectId: targetId,
            name,
            order: previewStages.filter((stage) => stage.projectId === targetId).length
          }
        };
      if (!window.deskPet?.createStage && result.status === 'created') {
        previewStages.push(result.stage);
      }
      if (result.status === 'created') {
        cancelTextAction();
        setFeedback('阶段已创建');
        await refreshStages();
        stageList.scrollLeft = stageList.scrollWidth;
        return;
      }
      setFeedback(result.status === 'duplicate' ? '阶段已存在' : '创建阶段失败');
      return;
    }

    if (action === 'rename-stage') {
      const stage = stages.find((item) => item.id === targetId);
      const result = window.deskPet?.renameStage
        ? await window.deskPet.renameStage(targetId, name)
        : { status: stage ? 'updated' : 'not_found', stage };
      if (!window.deskPet?.renameStage && stage) {
        stage.name = name;
      }
      if (result.status === 'updated') {
        cancelTextAction();
        setFeedback('阶段已重命名');
        await refreshStages();
        return;
      }
      setFeedback(result.status === 'duplicate' ? '阶段已存在' : '重命名失败');
    }
  } finally {
    textActionConfirm.disabled = false;
  }
}

async function submitConfirmAction() {
  if (!pendingConfirmAction) {
    return;
  }

  const { action, targetId } = pendingConfirmAction;
  confirmActionConfirm.disabled = true;

  try {
    if (action === 'delete-project') {
      const result = window.deskPet?.deleteProject
        ? await window.deskPet.deleteProject(targetId)
        : { status: 'deleted' };
      if (!window.deskPet?.deleteProject) {
        const index = previewProjects.findIndex((item) => item.id === targetId);
        if (index > -1) {
          previewProjects.splice(index, 1);
        }
        previewPrompts.forEach((prompt) => {
          if (prompt.projectId === targetId) {
            prompt.projectId = null;
            prompt.stageId = null;
          }
        });
      }
      if (result.status === 'deleted') {
        cancelConfirmAction();
        if (currentProjectId === targetId) {
          currentProjectId = null;
        }
        setFeedback('项目已删除，提示词已进入待归纳');
        if (activeView === 'project' && activeProjectId === targetId) {
          await setActiveView('library');
        } else {
          await refreshProjects();
          await loadPromptsForView(activeView);
          await persistViewState();
        }
        return;
      }
      cancelConfirmAction();
      setFeedback('项目不存在');
      return;
    }

    if (action === 'hide-stage') {
      const result = window.deskPet?.hideStage
        ? await window.deskPet.hideStage(targetId)
        : { status: 'updated' };
      if (!window.deskPet?.hideStage) {
        const index = previewStages.findIndex((stage) => stage.id === targetId);
        if (index > -1) {
          previewStages.splice(index, 1);
        }
      }
      if (result.status === 'updated') {
        cancelConfirmAction();
        setFeedback('阶段已隐藏');
        activeStageId = null;
        await refreshStages();
        await loadPromptsForView(activeView);
        await persistViewState();
        return;
      }
      cancelConfirmAction();
      setFeedback('阶段不存在');
    }
  } finally {
    confirmActionConfirm.disabled = false;
  }
}

async function handleProjectAction(action, projectId) {
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    return;
  }

  if (action === 'current') {
    currentProjectId = currentProjectId === projectId ? null : projectId;
    await persistViewState();
    renderProjectRail();
    setActiveNavigation();
    setFeedback(currentProjectId ? '当前项目已设置' : '当前项目已清除');
    return;
  }

  if (action === 'pin') {
    const result = window.deskPet?.toggleProjectPinned
      ? await window.deskPet.toggleProjectPinned(projectId)
      : { status: 'updated', project };
    if (!window.deskPet?.toggleProjectPinned) {
      project.pinned = !project.pinned;
    }
    if (result.status === 'updated') {
      setFeedback('项目置顶已更新');
      await refreshProjects();
    }
    return;
  }

  if (action === 'rename') {
    requestTextAction('rename-project', projectId, {
      title: '重命名项目',
      label: '项目名称',
      value: project.name
    });
    return;
  }

  if (action === 'delete') {
    requestConfirmAction('delete-project', projectId, {
      title: '删除项目',
      message: `“${project.name}”将被删除，项目内提示词会回到待归纳。`,
      confirmLabel: '删除项目'
    });
  }
}

async function handleStageAction(action, stageId, direction = 0) {
  const stage = stages.find((item) => item.id === stageId);

  if (action === 'create') {
    if (activeView !== 'project' || !activeProjectId) {
      setFeedback('先进入一个项目');
      return;
    }

    requestTextAction('create-stage', activeProjectId, {
      title: '新增阶段',
      label: '阶段名称',
      value: ''
    });
    return;
  }

  if (action === 'move') {
    if (!stage) {
      return;
    }

    const currentIndex = stages.findIndex((item) => item.id === stageId);
    const nextOrder = currentIndex + Number(direction || 0);
    const result = window.deskPet?.reorderStage
      ? await window.deskPet.reorderStage(stageId, nextOrder)
      : { status: 'updated', stage };

    if (!window.deskPet?.reorderStage) {
      const targetIndex = Math.max(0, Math.min(stages.length - 1, nextOrder));
      const previewIndex = previewStages.findIndex((item) => item.id === stageId);
      if (previewIndex > -1) {
        const [movedStage] = previewStages.splice(previewIndex, 1);
        previewStages.splice(targetIndex, 0, movedStage);
      }
    }

    if (result.status === 'updated') {
      setFeedback('阶段顺序已更新');
      await refreshStages();
    }
    return;
  }

  if (action === 'rename') {
    if (stage) {
      requestTextAction('rename-stage', stageId, {
        title: '重命名阶段',
        label: '阶段名称',
        value: stage.name
      });
    }
    return;
  }

  if (action === 'hide' && stage) {
    requestConfirmAction('hide-stage', stageId, {
      title: '隐藏阶段',
      message: `“${stage.name}”将从阶段筛选中隐藏，提示词不会被删除。`,
      confirmLabel: '隐藏阶段'
    });
  }
}

function scrollStageListWithWheel(event) {
  if (stageList.scrollWidth <= stageList.clientWidth) {
    return;
  }

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (delta !== 0) {
    event.preventDefault();
    stageList.scrollLeft += delta;
  }
}

stageList.addEventListener('wheel', scrollStageListWithWheel, { passive: false });

petShell.addEventListener('pointerdown', (event) => beginWindowDrag(event, petShell));
petShell.addEventListener('pointermove', trackWindowDrag);
petShell.addEventListener('pointerup', endDrag);
petShell.addEventListener('pointercancel', endDrag);

panelDragZone.addEventListener('pointerdown', (event) => beginWindowDrag(event, panelDragZone));
panelDragZone.addEventListener('pointermove', trackWindowDrag);
panelDragZone.addEventListener('pointerup', endDrag);
panelDragZone.addEventListener('pointercancel', endDrag);

petShell.addEventListener('click', () => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  window.clearTimeout(clickTimer);
  clickTimer = window.setTimeout(() => {
    void openPetPanel();
  }, 180);
});

petShell.addEventListener('dblclick', (event) => {
  event.preventDefault();
  window.clearTimeout(clickTimer);
  void runCaptureFeedback();
});

panelClose.addEventListener('click', () => {
  void closePetPanel();
});

promptList.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const copyButton = target?.closest('[data-copy-prompt-id]');
  const pinButton = target?.closest('[data-pin-prompt-id]');
  const ratingButton = target?.closest('[data-rating-prompt-id]');
  const ratingToggle = target?.closest('[data-rating-toggle]');
  const menuToggle = target?.closest('[data-prompt-menu-toggle]');
  const editButton = target?.closest('[data-edit-prompt-id]');
  const deleteRequest = target?.closest('[data-delete-prompt-request]');
  const promptEntry = target?.closest('.prompt-entry[data-prompt-id]');

  if (copyButton) {
    void copyPrompt(copyButton.dataset.copyPromptId);
    return;
  }

  if (editButton) {
    void openPromptEditor(editButton.dataset.editPromptId);
    return;
  }

  if (deleteRequest) {
    requestPromptDeletion(deleteRequest.dataset.deletePromptRequest);
    return;
  }

  if (pinButton) {
    void togglePromptPinned(pinButton.dataset.pinPromptId);
    return;
  }

  if (ratingButton) {
    void updatePromptRating(ratingButton.dataset.ratingPromptId, ratingButton.dataset.ratingValue);
    return;
  }

  if (ratingToggle) {
    toggleRatingPicker(ratingToggle.dataset.ratingToggle);
    return;
  }

  if (menuToggle) {
    togglePromptMenu(menuToggle.dataset.promptMenuToggle);
    return;
  }

  if (promptEntry && !target?.closest('button, select, input, textarea, label')) {
    void copyPrompt(promptEntry.dataset.promptId);
  }
});

promptList.addEventListener('change', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const projectSelect = target?.closest('[data-project-select-id]');

  if (projectSelect) {
    void updatePromptProject(projectSelect.dataset.projectSelectId, projectSelect.value);
  }
});

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    void setActiveView(button.dataset.view);
  });
});

pendingToggle.addEventListener('click', () => {
  void setPendingFilter(!pendingOnly);
});

projectList.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-project-id]') : null;
  const actionButton = event.target instanceof Element ? event.target.closest('[data-project-action]') : null;

  if (actionButton) {
    void handleProjectAction(actionButton.dataset.projectAction, actionButton.dataset.projectActionId);
    return;
  }

  if (button) {
    void setActiveView('project', button.dataset.projectId);
  }
});

stageList.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-stage-id]') : null;
  const actionButton = event.target instanceof Element ? event.target.closest('[data-stage-action]') : null;

  if (actionButton) {
    void handleStageAction(actionButton.dataset.stageAction, actionButton.dataset.stageActionId, actionButton.dataset.stageDirection);
    return;
  }

  if (button) {
    void setActiveStageFilter(button.dataset.stageId);
  }
});

searchInput.addEventListener('input', () => {
  resetPromptPage();
  void loadPromptsForView(activeView);
});

currentViewOnlyInput.addEventListener('change', () => {
  resetPromptPage();
  void loadPromptsForView(activeView);
});

promptPagePrevious.addEventListener('click', () => {
  changePromptPage('backward');
});

promptPageNext.addEventListener('click', () => {
  changePromptPage('forward');
});

document.querySelector('[data-stage-action="create"]').addEventListener('click', () => {
  void handleStageAction('create');
});

promptEditForm.elements.promptProject.addEventListener('change', () => {
  void renderEditorStageOptions(promptEditForm.elements.promptProject.value || null, null);
});

promptEditForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void savePromptEditor();
});

document.querySelector('[data-editor-close]').addEventListener('click', () => {
  promptEditModal.close();
});

document.querySelector('[data-editor-cancel]').addEventListener('click', () => {
  promptEditModal.close();
});

promptDeleteCancel.addEventListener('click', cancelPromptDeletion);
promptDeleteConfirm.addEventListener('click', () => {
  void confirmPromptDeletion();
});
promptDeleteDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelPromptDeletion();
});

textActionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitTextAction();
});
textActionCancel.addEventListener('click', cancelTextAction);
textActionDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelTextAction();
});

confirmActionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitConfirmAction();
});
confirmActionCancel.addEventListener('click', cancelConfirmAction);
confirmActionDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelConfirmAction();
});

sortButton.addEventListener('click', cycleSortMode);
createProjectToggle.addEventListener('click', () => {
  if (isProjectCreatorOpen()) {
    closeProjectCreator();
  } else {
    openProjectCreator();
  }
});
createProjectCancel.addEventListener('click', closeProjectCreator);
createProjectInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void createProjectFromInput();
  }
});
createProjectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void createProjectFromInput();
});

document.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target : null;

  if (isProjectCreatorOpen() && !target?.closest('.project-title-row')) {
    closeProjectCreator();
  }
});

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  let shouldRender = false;

  if (openRatingPromptId && !target?.closest('[data-rating-toggle], .rating-picker')) {
    openRatingPromptId = null;
    shouldRender = true;
  }

  if (openPromptMenuId && !target?.closest('[data-prompt-menu-toggle], .prompt-more-menu')) {
    openPromptMenuId = null;
    shouldRender = true;
  }

  if (shouldRender) {
    renderPromptEntries(currentPrompts);
  }
});

petShell.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    void openPetPanel();
  }
});

document.addEventListener('keydown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const direction = promptPagination.directionForKey({
    key: event.key,
    panelOpen: isPanelOpen,
    dialogOpen: Boolean(document.querySelector('dialog[open]')),
    contentEditable: Boolean(target?.isContentEditable),
    targetTagName: target?.tagName
  });

  if (!direction) {
    return;
  }

  event.preventDefault();
  changePromptPage(direction);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !isPanelOpen) {
    return;
  }

  if (promptDeleteDialog.open) {
    event.preventDefault();
    cancelPromptDeletion();
    return;
  }

  if (textActionDialog.open) {
    event.preventDefault();
    cancelTextAction();
    return;
  }

  if (confirmActionDialog.open) {
    event.preventDefault();
    cancelConfirmAction();
    return;
  }

  if (isProjectCreatorOpen()) {
    event.preventDefault();
    closeProjectCreator();
    return;
  }

  if (openRatingPromptId) {
    event.preventDefault();
    openRatingPromptId = null;
    renderPromptEntries(currentPrompts);
    return;
  }

  if (openPromptMenuId) {
    event.preventDefault();
    openPromptMenuId = null;
    renderPromptEntries(currentPrompts);
    return;
  }

  if (promptEditModal.open) {
    event.preventDefault();
    promptEditModal.close();
    return;
  }

  void closePetPanel();
});
