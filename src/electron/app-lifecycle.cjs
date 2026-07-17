const path = require('node:path');

const USER_DATA_DIRECTORY = 'desk-pet-prompt-book';

function configureStableUserDataPath(app) {
  const userDataPath = path.join(app.getPath('appData'), USER_DATA_DIRECTORY);
  app.setPath('userData', userDataPath);
  return userDataPath;
}

function setupSingleInstance(app, onSecondInstance) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }

  app.on('second-instance', onSecondInstance);
  return true;
}

function focusPrimaryWindow(window) {
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
  return true;
}

function createQuitCoordinator({ app, getPendingWrites, onError, timeoutMs = 5000 }) {
  let quitRequest = null;

  return function requestQuit() {
    if (quitRequest) {
      return quitRequest;
    }

    quitRequest = (async () => {
      let timeout;

      try {
        await Promise.race([
          Promise.resolve().then(() => getPendingWrites()),
          new Promise((_, reject) => {
            timeout = setTimeout(() => {
              reject(new Error(`Timed out waiting for pending writes after ${timeoutMs}ms`));
            }, timeoutMs);
          })
        ]);
      } catch (error) {
        onError(error);
      } finally {
        clearTimeout(timeout);
        app.quit();
      }
    })();

    return quitRequest;
  };
}

function attachExitContextMenu(window, Menu, requestExit) {
  window.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: '退出桌宠',
        click: () => requestExit()
      }
    ]);

    menu.popup({ window });
  });
}

module.exports = {
  USER_DATA_DIRECTORY,
  attachExitContextMenu,
  configureStableUserDataPath,
  createQuitCoordinator,
  focusPrimaryWindow,
  setupSingleInstance
};
