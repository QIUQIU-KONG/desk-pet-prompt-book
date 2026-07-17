const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, clipboard, ipcMain, screen } = require('electron');
const { createPromptStore } = require('../core/prompt-store.cjs');
const {
  attachExitContextMenu,
  configureStableUserDataPath,
  createQuitCoordinator,
  focusPrimaryWindow,
  setupSingleInstance
} = require('./app-lifecycle.cjs');

configureStableUserDataPath(app);

const rootDir = path.resolve(__dirname, '..', '..');
const rendererPath = path.join(rootDir, 'src', 'renderer', 'index.html');
const PET_WINDOW_SIZE = 220;
const PANEL_WINDOW_WIDTH = 1024;
const PANEL_WINDOW_HEIGHT = 700;
const WINDOW_MODES = {
  PET: 'pet',
  PANEL: 'panel'
};
const WINDOW_MODE_SIZES = {
  [WINDOW_MODES.PET]: {
    mode: WINDOW_MODES.PET,
    width: PET_WINDOW_SIZE,
    height: PET_WINDOW_SIZE
  },
  [WINDOW_MODES.PANEL]: {
    mode: WINDOW_MODES.PANEL,
    width: PANEL_WINDOW_WIDTH,
    height: PANEL_WINDOW_HEIGHT
  }
};
let promptStore;
let dragSession = null;
let primaryWindow = null;

function appendStartupLog(message) {
  const logPath = path.join(app.getPath('userData'), 'startup-log.txt');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, line, 'utf8');
}

process.on('uncaughtException', (error) => {
  appendStartupLog(`uncaughtException: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (reason) => {
  appendStartupLog(`unhandledRejection: ${reason?.stack || reason}`);
});

function getPromptStore() {
  if (!promptStore) {
    promptStore = createPromptStore({
      filePath: path.join(app.getPath('userData'), 'data', 'prompts.json'),
      onRecovery: ({ kind, reason, filePath, backupPath, corruptPath, corruptBackupPath }) => {
        appendStartupLog(`prompt-store recovery: ${JSON.stringify({
          kind,
          reason,
          file: path.basename(filePath),
          backup: path.basename(backupPath),
          corrupt: corruptPath ? path.basename(corruptPath) : null,
          corruptBackup: corruptBackupPath ? path.basename(corruptBackupPath) : null
        })}`);
      }
    });
  }

  return promptStore;
}

const requestApplicationQuit = createQuitCoordinator({
  app,
  getPendingWrites: () => promptStore?.whenIdle(),
  onError: (error) => {
    appendStartupLog(`quit wait failed: ${error.stack || error.message}`);
  }
});

ipcMain.handle('prompts:captureClipboard', async () => {
  const text = clipboard.readText();
  return getPromptStore().captureText(text);
});

ipcMain.handle('prompts:query', async (_event, options) => {
  return getPromptStore().queryPrompts(options);
});

ipcMain.handle('prompts:counts', async () => {
  return getPromptStore().getPromptCounts();
});

ipcMain.handle('projects:list', async () => {
  return getPromptStore().listProjects();
});

ipcMain.handle('projects:create', async (_event, name) => {
  return getPromptStore().createProject(name);
});

ipcMain.handle('projects:rename', async (_event, projectId, name) => {
  return getPromptStore().renameProject(projectId, name);
});

ipcMain.handle('projects:togglePinned', async (_event, projectId) => {
  return getPromptStore().toggleProjectPinned(projectId);
});

ipcMain.handle('projects:delete', async (_event, projectId) => {
  return getPromptStore().deleteProject(projectId);
});

ipcMain.handle('projects:listStages', async (_event, projectId) => {
  return getPromptStore().listStagesForProject(projectId);
});

ipcMain.handle('stages:create', async (_event, projectId, name) => {
  return getPromptStore().createStage(projectId, name);
});

ipcMain.handle('stages:rename', async (_event, stageId, name) => {
  return getPromptStore().renameStage(stageId, name);
});

ipcMain.handle('stages:hide', async (_event, stageId) => {
  return getPromptStore().hideStage(stageId);
});

ipcMain.handle('stages:reorder', async (_event, stageId, nextOrder) => {
  return getPromptStore().reorderStage(stageId, nextOrder);
});

ipcMain.handle('prompts:updateProject', async (_event, promptId, projectId, stageId = null) => {
  return getPromptStore().updatePromptProject(promptId, projectId, stageId);
});

ipcMain.handle('prompts:updateStage', async (_event, promptId, stageId) => {
  return getPromptStore().updatePromptStage(promptId, stageId);
});

ipcMain.handle('prompts:togglePinned', async (_event, promptId) => {
  return getPromptStore().togglePromptPinned(promptId);
});

ipcMain.handle('prompts:updateRating', async (_event, promptId, rating) => {
  return getPromptStore().updatePromptRating(promptId, rating);
});

ipcMain.handle('prompts:update', async (_event, promptId, patch) => {
  return getPromptStore().updatePrompt(promptId, patch);
});

ipcMain.handle('prompts:delete', async (_event, promptId) => {
  return getPromptStore().deletePrompt(promptId);
});

ipcMain.handle('keywords:list', async () => {
  return getPromptStore().listKeywords();
});

ipcMain.handle('keywords:create', async (_event, name) => {
  return getPromptStore().createKeyword(name);
});

ipcMain.handle('viewState:get', async () => {
  return getPromptStore().getViewState();
});

ipcMain.handle('viewState:update', async (_event, viewState) => {
  return getPromptStore().updateViewState(viewState);
});

ipcMain.handle('prompts:copyPrompt', async (_event, promptId) => {
  const result = await getPromptStore().markPromptUsed(promptId);

  if (result.status === 'used') {
    clipboard.writeText(result.prompt.content);
  }

  return result;
});

function stopPetWindowDrag() {
  if (!dragSession) {
    return;
  }

  const { interval, petWindow } = dragSession;
  clearInterval(interval);
  dragSession = null;

  if (petWindow && !petWindow.isDestroyed()) {
    lockPetWindowSize(petWindow);
  }
}

function getWindowMode(petWindow) {
  return petWindow.__deskPetWindowMode || WINDOW_MODES.PET;
}

function setWindowMode(petWindow, mode) {
  petWindow.__deskPetWindowMode = mode;
}

function getWindowSizeForMode(mode) {
  return WINDOW_MODE_SIZES[mode] || WINDOW_MODE_SIZES[WINDOW_MODES.PET];
}

function clampBoundsToDisplay(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width);
  const maxY = workArea.y + Math.max(0, workArea.height - bounds.height);

  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY)
  };
}

function getCenteredBoundsForMode(anchorBounds, mode) {
  const { width, height } = getWindowSizeForMode(mode);
  const { workArea } = screen.getDisplayMatching(anchorBounds);

  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height
  };
}

function moveDraggedPetWindow() {
  if (!dragSession) {
    return;
  }

  const { petWindow, offsetX, offsetY } = dragSession;

  if (!petWindow || petWindow.isDestroyed()) {
    stopPetWindowDrag();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const { width, height } = getWindowSizeForMode(getWindowMode(petWindow));

  petWindow.setBounds(clampBoundsToDisplay({
    x: Math.round(cursor.x - offsetX),
    y: Math.round(cursor.y - offsetY),
    width,
    height
  }));
}

ipcMain.handle('window:startDrag', (event, offsetX, offsetY) => {
  const petWindow = BrowserWindow.fromWebContents(event.sender);

  if (!petWindow) {
    return;
  }

  stopPetWindowDrag();
  dragSession = {
    petWindow,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    interval: setInterval(moveDraggedPetWindow, 16)
  };
  moveDraggedPetWindow();
});

ipcMain.handle('window:stopDrag', () => {
  stopPetWindowDrag();
});

function lockPetWindowSize(petWindow) {
  if (petWindow.isDestroyed()) {
    return;
  }

  const mode = getWindowMode(petWindow);

  if (mode === WINDOW_MODES.PET) {
    petWindow.setMinimumSize(PET_WINDOW_SIZE, PET_WINDOW_SIZE);
    petWindow.setMaximumSize(PET_WINDOW_SIZE, PET_WINDOW_SIZE);
    petWindow.setSize(PET_WINDOW_SIZE, PET_WINDOW_SIZE, false);
    return;
  }

  const { width, height } = getWindowSizeForMode(mode);
  petWindow.setMinimumSize(width, height);
  petWindow.setMaximumSize(width, height);
  petWindow.setSize(width, height, false);
}

function positionPetWindow(petWindow) {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - PET_WINDOW_SIZE - 24;
  const y = workArea.y + workArea.height - PET_WINDOW_SIZE - 36;
  petWindow.setBounds({
    x: x,
    y: y,
    width: PET_WINDOW_SIZE,
    height: PET_WINDOW_SIZE
  });
  petWindow.setPosition(x, y);
}

function applyWindowMode(petWindow, mode) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentMode = getWindowMode(petWindow);
  const { width, height } = getWindowSizeForMode(mode);

  if (currentMode === mode) {
    lockPetWindowSize(petWindow);
    return { mode, width, height };
  }

  setWindowMode(petWindow, mode);
  const currentBounds = petWindow.getBounds();
  let nextBounds = {
    x: currentBounds.x,
    y: currentBounds.y,
    width,
    height
  };

  if (mode === WINDOW_MODES.PANEL) {
    petWindow.__deskPetPetBounds = currentBounds;
    nextBounds = getCenteredBoundsForMode(currentBounds, mode);
  }

  if (mode === WINDOW_MODES.PET && petWindow.__deskPetPetBounds) {
    nextBounds = {
      ...petWindow.__deskPetPetBounds,
      width,
      height
    };
  }

  petWindow.setMinimumSize(width, height);
  petWindow.setMaximumSize(width, height);
  petWindow.setBounds(clampBoundsToDisplay(nextBounds));

  return { mode, width, height };
}

ipcMain.handle('window:openPanel', (event) => {
  const petWindow = BrowserWindow.fromWebContents(event.sender);
  return applyWindowMode(petWindow, WINDOW_MODES.PANEL);
});

ipcMain.handle('window:closePanel', (event) => {
  const petWindow = BrowserWindow.fromWebContents(event.sender);
  return applyWindowMode(petWindow, WINDOW_MODES.PET);
});

function createPetWindow() {
  const petWindow = new BrowserWindow({
    title: '桌宠魔法书预览',
    width: 220,
    height: 220,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  primaryWindow = petWindow;
  attachExitContextMenu(petWindow, Menu, requestApplicationQuit);
  setWindowMode(petWindow, WINDOW_MODES.PET);
  lockPetWindowSize(petWindow);
  positionPetWindow(petWindow);
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    appendStartupLog(`did-fail-load: ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    appendStartupLog(`render-process-gone: ${JSON.stringify(details)}`);
  });
  petWindow.once('ready-to-show', () => {
    petWindow.show();
  });
  petWindow.once('closed', () => {
    if (primaryWindow === petWindow) {
      primaryWindow = null;
    }
  });
  petWindow.loadFile(rendererPath, {
    query: {
      shell: 'electron'
    }
  }).catch((error) => {
    appendStartupLog(`loadFile rejected: ${error.stack || error.message}`);
  });

  return petWindow;
}

function focusExistingInstance() {
  focusPrimaryWindow(primaryWindow);
}

const isPrimaryInstance = setupSingleInstance(app, focusExistingInstance);

if (isPrimaryInstance) {
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createPetWindow();

    screen.on('display-metrics-changed', () => {
      BrowserWindow.getAllWindows().forEach(lockPetWindowSize);
    });
    screen.on('display-added', () => {
      BrowserWindow.getAllWindows().forEach(lockPetWindowSize);
    });
    screen.on('display-removed', () => {
      BrowserWindow.getAllWindows().forEach(lockPetWindowSize);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createPetWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      void requestApplicationQuit();
    }
  });
}
