import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const packagePath = new URL('../package.json', import.meta.url);
const mainPath = new URL('../src/electron/main.cjs', import.meta.url);
const lifecyclePath = new URL('../src/electron/app-lifecycle.cjs', import.meta.url);
const preloadPath = new URL('../src/electron/preload.cjs', import.meta.url);
const rendererPath = new URL('../src/renderer/index.html', import.meta.url);

test('electron shell project exposes a pet launch script', async () => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const electronVersion = packageJson.devDependencies.electron.replace(/^[^0-9]*/, '');

  assert.equal(packageJson.main, 'src/electron/main.cjs');
  assert.equal(packageJson.scripts.start, 'electron .');
  assert.equal(packageJson.scripts.pet, 'pnpm start');
  assert.equal(packageJson.devDependencies.electron, '39.8.10');
  assert.match(packageJson.scripts['check:syntax'], /src\/electron\/app-lifecycle\.cjs/);
  assert.ok(Number(electronVersion.split('.')[0]) >= 39);
});

test('electron configures stable user data before logging or prompt storage', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.equal(existsSync(lifecyclePath), true);
  assert.match(main, /configureStableUserDataPath\(app\)/);
  assert.ok(main.indexOf('configureStableUserDataPath(app)') < main.indexOf("process.on('uncaughtException'"));
  assert.ok(main.indexOf('configureStableUserDataPath(app)') < main.indexOf('function getPromptStore'));
});

test('electron acquires one application instance and focuses the existing window', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.match(main, /setupSingleInstance\(app,/);
  assert.match(main, /focusPrimaryWindow\(primaryWindow\)/);
  assert.ok(main.indexOf('setupSingleInstance(app,') < main.indexOf('app.whenReady()'));
  assert.match(main, /if \(isPrimaryInstance\)/);
});

test('electron attaches a native right-click exit menu to the pet and panel window', async () => {
  const main = await readFile(mainPath, 'utf8');
  const createWindow = main.match(/function createPetWindow\(\)[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(createWindow, /attachExitContextMenu\(petWindow, Menu, app\)/);
});

test('electron main creates a transparent always-on-top frameless pet window', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.match(main, /new BrowserWindow/);
  assert.match(main, /width:\s*220/);
  assert.match(main, /height:\s*220/);
  assert.match(main, /workArea/);
  assert.match(main, /setPosition\(x,\s*y\)/);
  assert.match(main, /transparent:\s*true/);
  assert.match(main, /frame:\s*false/);
  assert.match(main, /alwaysOnTop:\s*true/);
  assert.match(main, /skipTaskbar:\s*true/);
  assert.match(main, /setAlwaysOnTop\(true,\s*'screen-saver'/);
});

test('electron main wires clipboard capture through ipc and preload', async () => {
  const main = await readFile(mainPath, 'utf8');
  const preload = await readFile(preloadPath, 'utf8');

  assert.match(main, /preload:\s*path\.join\(__dirname,\s*'preload\.cjs'\)/);
  assert.match(main, /ipcMain\.handle\('prompts:captureClipboard'/);
  assert.match(main, /clipboard\.readText\(\)/);
  assert.match(main, /captureText/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('deskPet'/);
  assert.match(preload, /captureClipboardPrompt/);
});

test('electron shell exposes one prompt query contract plus counts and copy-use channels', async () => {
  const main = await readFile(mainPath, 'utf8');
  const preload = await readFile(preloadPath, 'utf8');

  assert.match(main, /ipcMain\.handle\('prompts:query'/);
  assert.match(main, /ipcMain\.handle\('prompts:counts'/);
  assert.match(main, /ipcMain\.handle\('projects:list'/);
  assert.match(main, /ipcMain\.handle\('projects:create'/);
  assert.match(main, /ipcMain\.handle\('projects:listStages'/);
  assert.match(main, /ipcMain\.handle\('prompts:updateProject'/);
  assert.match(main, /ipcMain\.handle\('prompts:updateStage'/);
  assert.match(main, /ipcMain\.handle\('prompts:togglePinned'/);
  assert.match(main, /ipcMain\.handle\('prompts:updateRating'/);
  assert.match(main, /ipcMain\.handle\('prompts:copyPrompt'/);
  assert.match(main, /clipboard\.writeText/);
  assert.match(main, /markPromptUsed/);
  assert.match(preload, /queryPrompts/);
  assert.match(preload, /getPromptCounts/);
  assert.match(preload, /listProjects/);
  assert.match(preload, /createProject/);
  assert.match(preload, /listStagesForProject/);
  assert.match(preload, /updatePromptProject/);
  assert.match(preload, /updatePromptStage/);
  assert.match(preload, /togglePromptPinned/);
  assert.match(preload, /updatePromptRating/);
  assert.match(preload, /copyPrompt/);
  assert.doesNotMatch(main, /prompts:listInbox|prompts:listAll|prompts:listProject/);
  assert.doesNotMatch(preload, /listInboxPrompts|listAllPrompts|listProjectPrompts/);
  assert.doesNotMatch(main, /setSystemBadge\('inbox'/);
});

test('electron shell exposes complete management channels for prompts projects stages keywords and view state', async () => {
  const main = await readFile(mainPath, 'utf8');
  const preload = await readFile(preloadPath, 'utf8');

  [
    'prompts:query',
    'prompts:counts',
    'prompts:update',
    'prompts:delete',
    'projects:rename',
    'projects:togglePinned',
    'projects:delete',
    'stages:create',
    'stages:rename',
    'stages:hide',
    'stages:reorder',
    'keywords:list',
    'keywords:create',
    'viewState:get',
    'viewState:update'
  ].forEach((channel) => {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('${channel}'`));
  });

  [
    'queryPrompts',
    'getPromptCounts',
    'updatePrompt',
    'deletePrompt',
    'renameProject',
    'toggleProjectPinned',
    'deleteProject',
    'createStage',
    'renameStage',
    'hideStage',
    'reorderStage',
    'listKeywords',
    'createKeyword',
    'getViewState',
    'updateViewState'
  ].forEach((apiName) => {
    assert.match(preload, new RegExp(apiName));
  });
});

test('electron shell exposes a drag channel for moving the pet window', async () => {
  const main = await readFile(mainPath, 'utf8');
  const preload = await readFile(preloadPath, 'utf8');

  assert.match(main, /ipcMain\.handle\('window:startDrag'/);
  assert.match(main, /ipcMain\.handle\('window:stopDrag'/);
  assert.match(main, /BrowserWindow\.fromWebContents\(event\.sender\)/);
  assert.match(main, /screen\.getCursorScreenPoint\(\)/);
  assert.match(main, /setBounds\(\{\s*x:/);
  assert.match(main, /width:\s*PET_WINDOW_SIZE/);
  assert.match(main, /height:\s*PET_WINDOW_SIZE/);
  assert.match(preload, /startPetWindowDrag/);
  assert.match(preload, /stopPetWindowDrag/);
  assert.match(preload, /ipcRenderer\.invoke\('window:startDrag'/);
  assert.match(preload, /ipcRenderer\.invoke\('window:stopDrag'/);
});

test('electron shell exposes fixed pet and panel window modes', async () => {
  const main = await readFile(mainPath, 'utf8');
  const preload = await readFile(preloadPath, 'utf8');

  assert.match(main, /const PET_WINDOW_SIZE = 220/);
  assert.match(main, /const PANEL_WINDOW_WIDTH = 1024/);
  assert.match(main, /const PANEL_WINDOW_HEIGHT = 700/);
  assert.match(main, /const WINDOW_MODES =/);
  assert.match(main, /mode:\s*WINDOW_MODES\.PET/);
  assert.match(main, /mode:\s*WINDOW_MODES\.PANEL/);
  assert.match(main, /ipcMain\.handle\('window:openPanel'/);
  assert.match(main, /ipcMain\.handle\('window:closePanel'/);
  assert.match(main, /getCenteredBoundsForMode/);
  assert.match(main, /mode === WINDOW_MODES\.PANEL/);
  assert.match(main, /clampBoundsToDisplay/);
  assert.match(main, /setBounds\(clampBoundsToDisplay/);
  assert.match(preload, /openPetPanel/);
  assert.match(preload, /closePetPanel/);
  assert.match(preload, /ipcRenderer\.invoke\('window:openPanel'/);
  assert.match(preload, /ipcRenderer\.invoke\('window:closePanel'/);
});

test('electron panel mode transitions are idempotent', async () => {
  const main = await readFile(mainPath, 'utf8');
  const applyWindowMode = main.match(/function applyWindowMode\([\s\S]*?\n\}/)?.[0] ?? '';
  const duplicateModeGuard = applyWindowMode.match(/if \(currentMode === mode\)[\s\S]*?\n\s*\}/)?.[0] ?? '';

  assert.match(applyWindowMode, /const currentMode = getWindowMode\(petWindow\)/);
  assert.match(duplicateModeGuard, /lockPetWindowSize\(petWindow\)/);
  assert.match(duplicateModeGuard, /return \{ mode, width, height \}/);
  assert.doesNotMatch(duplicateModeGuard, /__deskPetPetBounds/);
});

test('electron shell locks pet size while dragging across displays', async () => {
  const main = await readFile(mainPath, 'utf8');
  const moveHandler = main.match(/ipcMain\.handle\('window:moveToPointer'[\s\S]*?\n}\);/)?.[0] ?? '';

  assert.match(main, /function lockPetWindowSize/);
  assert.match(main, /setMinimumSize\(PET_WINDOW_SIZE,\s*PET_WINDOW_SIZE\)/);
  assert.match(main, /setMaximumSize\(PET_WINDOW_SIZE,\s*PET_WINDOW_SIZE\)/);
  assert.match(main, /setSize\(PET_WINDOW_SIZE,\s*PET_WINDOW_SIZE,\s*false\)/);
  assert.match(main, /lockPetWindowSize\(petWindow\)/);
  assert.match(main, /display-metrics-changed/);
  assert.match(main, /display-added/);
  assert.match(main, /display-removed/);
  assert.match(main, /getWindowSizeForMode/);
  assert.doesNotMatch(moveHandler, /lockPetWindowSize\(petWindow\)/);
});

test('electron shell keeps a compact pet-size contract', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.doesNotMatch(main, /width:\s*720/);
  assert.doesNotMatch(main, /height:\s*720/);
  assert.doesNotMatch(main, /width:\s*360/);
  assert.doesNotMatch(main, /height:\s*360/);
  assert.doesNotMatch(main, /width:\s*300/);
  assert.doesNotMatch(main, /height:\s*300/);
});

test('electron shell only shows the pet after the preview is ready', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.match(main, /title:\s*'桌宠魔法书预览'/);
  assert.match(main, /show:\s*false/);
  assert.match(main, /once\('ready-to-show'/);
  assert.match(main, /petWindow\.show\(\)/);
});

test('electron shell records startup diagnostics for load failures', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.match(main, /startup-log\.txt/);
  assert.match(main, /appendStartupLog/);
  assert.match(main, /did-fail-load/);
  assert.match(main, /render-process-gone/);
  assert.match(main, /uncaughtException/);
  assert.match(main, /unhandledRejection/);
});

test('electron shell records prompt-store recovery without prompt content', async () => {
  const main = await readFile(mainPath, 'utf8');
  const recoveryHandler = main.match(/onRecovery:[\s\S]*?\n\s*\}/)?.[0] ?? '';

  assert.match(recoveryHandler, /appendStartupLog/);
  assert.match(recoveryHandler, /path\.basename/);
  assert.match(recoveryHandler, /kind/);
  assert.match(recoveryHandler, /reason/);
  assert.doesNotMatch(recoveryHandler, /content|prompts/);
});

test('electron shell loads the desktop pet renderer surface', async () => {
  const main = await readFile(mainPath, 'utf8');

  assert.equal(existsSync(rendererPath), true);
  assert.match(main, /path\.join\(rootDir, 'src', 'renderer', 'index\.html'\)/);
  assert.doesNotMatch(main, /prototype.*desktop-pet-preview/);
  assert.match(main, /loadFile/);
});
